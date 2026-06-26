/**
 * 06_RegistrosService.js
 * Servicio para procesar el lote de Cargas, enriquecerlo y apendear en Registros.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pipeline batch de ingestion de transacciones financieras. El usuario carga un lote
 * de movimientos en la Hoja de Cargas y esta funcion los valida, enriquece con
 * cotizaciones del dia y los persiste en el ledger Registros con TCs congelados.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * La carga batch (ADR-004) garantiza que cada registro quede inmutable con los tipos
 * de cambio del momento de procesamiento. No hay consulta en vivo celda a celda.
 * La validacion previa al append es la unica barrera contra datos corruptos en el ledger.
 *
 * @see 00_Config.js (SHEETS, RANGES, MONEDAS_DISPONIBLES)
 * @see 03_SheetManager.js (getTableData, appendMassive)
 * @see 15_ExchangeRateApi.js (fetchArsRate, fetchInternationalRates)
 *
 * @version 0.9.4
 * @since 0.1.0
 * @lastModified 2026-06-22
 */

// ============================================
// HELPERS DE VALIDACION DE LOTE
// ============================================

/**
 * Determina si una fila de Cargas tiene "intencion de carga":
 * al menos uno de los campos Monto/Cuenta/Medio/Moneda esta no-vacio.
 * Los campos opcionales (Tipo, Fecha, Nota) no se usan como indicador.
 *
 * @param {Array} row Fila raw de la grilla I5:O19
 * @returns {boolean}
 */
function filaConIntencion_(row) {
    // row[0]=Monto, row[2]=Cuenta, row[3]=Medio, row[4]=Moneda
    return row[0] !== '' || row[2] !== '' || row[3] !== '' || row[4] !== '';
}

/**
 * Valida una fila con intencion de carga contra las reglas de negocio.
 * Devuelve null si es valida, o un string con el motivo de rechazo si no lo es.
 *
 * @param {Array} row Fila raw [Monto, Tipo, Cuenta, Medio, Moneda, Fecha, Nota]
 * @param {Array<string>} ingresosCat Nombres del catalogo INGRESOS
 * @param {Array<string>} fijosCat Nombres del catalogo GASTOS_FIJOS
 * @param {Array<string>} variablesCat Nombres del catalogo GASTOS_VARIABLES
 * @returns {string|null} Motivo de rechazo, o null si es valida
 */
function validarFila_(row, ingresosCat, fijosCat, variablesCat) {
    const errores = [];

    // Monto: presente, parseble como numero, y mayor que cero
    if (row[0] === '' || row[0] === null || row[0] === undefined) {
        errores.push('Monto ausente');
    } else {
        const monto = parseFloat(String(row[0]).replace(',', '.'));
        if (isNaN(monto)) {
            errores.push('Monto no es un numero valido');
        } else if (monto <= 0) {
            errores.push('Monto debe ser mayor que cero');
        }
    }

    // Cuenta: presente
    if (row[2] === '' || row[2] === null || row[2] === undefined) {
        errores.push('Cuenta ausente');
    } else {
        // Cuenta debe pertenecer a uno de los catalogos para que tipoCuenta sea deducible
        const cuentaName = String(row[2]).trim();
        const enIngresos = ingresosCat.includes(cuentaName);
        const enFijos = fijosCat.includes(cuentaName);
        const enVariables = variablesCat.includes(cuentaName);
        if (!enIngresos && !enFijos && !enVariables) {
            errores.push('Cuenta "' + cuentaName + '" no existe en el Plan de Cuentas');
        }
    }

    // Medio: presente
    if (row[3] === '' || row[3] === null || row[3] === undefined) {
        errores.push('Medio de pago ausente');
    }

    // Moneda: presente y dentro de MONEDAS_DISPONIBLES
    if (row[4] === '' || row[4] === null || row[4] === undefined) {
        errores.push('Moneda ausente');
    } else if (!MONEDAS_DISPONIBLES.includes(String(row[4]).trim())) {
        errores.push('Moneda "' + String(row[4]).trim() + '" no valida (valores permitidos: ' + MONEDAS_DISPONIBLES.join(', ') + ')');
    }

    return errores.length > 0 ? errores.join('; ') : null;
}

// ============================================
// PIPELINE PRINCIPAL
// ============================================

/**
 * Funcion maestra invocada desde el menu [Dev] o boton.
 *
 * Robustez (v0.9.0 -> v0.9.2):
 * - Proteccion contra ejecucion concurrente via LockService (DocumentLock, timeout 100ms).
 * - Deteccion de filas con "intencion de carga" basada en Monto/Cuenta/Medio/Moneda.
 * - Validacion por fila: monto numerico > 0, cuenta en catalogo, medio presente,
 *   moneda en MONEDAS_DISPONIBLES. La Nota NO es obligatoria.
 * - v0.9.2: validacion NO bloqueante. Las filas incompletas se SALTEAN (no frenan el lote),
 *   quedan en la grilla para corregirse, y se reportan al final con su motivo. Solo se
 *   limpian de la grilla las filas efectivamente procesadas.
 * - v0.9.2: el sort de Registros es best-effort (try/catch). Si la hoja tiene celdas
 *   combinadas que cruzan el rango, el orden se omite pero los registros se guardan igual.
 * - tipoCuenta no tiene fallback silencioso a '': solo se procesan filas cuya cuenta existe.
 */
function procesarCargas() {
    logInfo('=== procesarCargas INICIO ===');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    // --- PROTECCION DE CONCURRENCIA ---
    // Previene doble-click durante los segundos de fetch de cotizaciones.
    const lock = LockService.getDocumentLock();
    const lockObtained = lock.tryLock(100);
    if (!lockObtained) {
        ui.alert('Ya hay un procesamiento en curso. Espere unos segundos y vuelva a intentar.');
        logInfo('procesarCargas: lock no disponible, ejecucion abortada por concurrencia.');
        return;
    }

    try {
        _procesarCargasCore_(ss, ui);
    } finally {
        // El lock siempre se libera, incluso ante errores no capturados internamente.
        lock.releaseLock();
    }
}

/**
 * Nucleo del pipeline. Separado de procesarCargas para que el bloque finally
 * del lock sea limpio independientemente del flujo interno.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {GoogleAppsScript.Base.Ui} ui
 */
function _procesarCargasCore_(ss, ui) {
    const cargasSheet = ss.getSheetByName(NAV_CONFIG.SHEETS.CARGAS);
    const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);

    if (!cargasSheet || !registrosSheet) {
        ui.alert('Faltan configurar las hojas Cargas o Registros.');
        return;
    }

    // 1. Leer I5:O19
    const cargasRange = cargasSheet.getRange('I5:O19');
    const cargasData = cargasRange.getValues();

    // 1a. Identificar filas con intencion de carga (al menos un campo clave no vacio)
    const filasConIntencion = [];
    cargasData.forEach(function(row, idx) {
        if (filaConIntencion_(row)) {
            filasConIntencion.push({ row: row, idx: idx }); // idx 0-based dentro de la grilla I5:O19
        }
    });

    if (filasConIntencion.length === 0) {
        ss.toast('No hay transacciones para registrar.', 'Aviso', 3);
        return;
    }

    // 2. Precargar catalogos para deduccion de tipo de cuenta (necesarios en validacion)
    const ingresosCat = getTableData('INGRESOS').map(function(r) { return String(r[0]).trim(); });
    const fijosCat = getTableData('GASTOS_FIJOS').map(function(r) { return String(r[0]).trim(); });
    const variablesCat = getTableData('GASTOS_VARIABLES').map(function(r) { return String(r[0]).trim(); });

    // 3. VALIDACION NO BLOQUEANTE: separar filas validas de las omitidas.
    //    Una fila incompleta NO frena el lote: se saltea, queda en la grilla para que el
    //    usuario la corrija, y se reporta al final con su motivo. (Nota nunca es obligatoria;
    //    validarFila_ no la exige.)
    const validas = [];
    const omitidas = [];
    filasConIntencion.forEach(function(entrada) {
        const motivo = validarFila_(entrada.row, ingresosCat, fijosCat, variablesCat);
        if (motivo === null) {
            validas.push(entrada);
        } else {
            omitidas.push('Fila ' + (entrada.idx + 1) + ': ' + motivo);
        }
    });

    if (validas.length === 0) {
        // No hay nada que escribir; se informan las omitidas y la grilla queda intacta.
        const msg = 'No se proceso ninguna fila por datos incompletos.\n\n' + omitidas.join('\n');
        logInfo('procesarCargas: sin filas validas; ' + omitidas.length + ' omitidas.');
        ui.alert('Sin filas para procesar', msg, ui.ButtonSet.OK);
        return;
    }

    // 4. Procesar las filas validas
    ss.toast('Procesando ' + validas.length + ' registro(s)...', 'Procesando', 5);

    // 4a. Precargar caches de Tipos de Cambio
    const tcUsdData = getTableData('TC_USD');
    const tcAudData = getTableData('TC_AUD');
    const tcEurData = getTableData('TC_EUR');

    const cacheMap = { USD: {}, AUD: {}, EUR: {} };
    tcUsdData.forEach(function(r) { if (r[0]) cacheMap.USD[formatDateISO(r[0])] = r[1]; });
    tcAudData.forEach(function(r) { if (r[0]) cacheMap.AUD[formatDateISO(r[0])] = r[1]; });
    tcEurData.forEach(function(r) { if (r[0]) cacheMap.EUR[formatDateISO(r[0])] = r[1]; });

    var newTcUsdToAppend = [];
    var newTcAudToAppend = [];
    var newTcEurToAppend = [];
    const registrosToAppend = [];
    const filasProcesadasIdx = []; // idx (0-based) de las filas escritas, para limpiar solo esas

    const FLOOR_DATE = new Date('2024-01-01T12:00:00Z');

    var pasoActual = 'enriquecimiento de filas';

    try {
        validas.forEach(function(entrada) {
            const row = entrada.row;

            // Fila: [Monto(0), Tipo(1), Cuenta(2), Medio(3), Moneda(4), Fecha(5), Nota(6)]
            var rawDate = row[5];
            if (!rawDate) rawDate = new Date();

            var dateObj = new Date(rawDate);
            if (isNaN(dateObj.getTime())) dateObj = new Date();
            if (dateObj < FLOOR_DATE) dateObj = FLOOR_DATE;

            const dateStr = formatDateISO(dateObj);

            // Deducir Tipo de Cuenta (la validacion previa garantiza que la cuenta existe)
            var tipoCuenta = '';
            const cuentaName = String(row[2]).trim();
            if (ingresosCat.includes(cuentaName)) tipoCuenta = 'Ingreso';
            else if (fijosCat.includes(cuentaName)) tipoCuenta = 'Gasto Fijo';
            else if (variablesCat.includes(cuentaName)) tipoCuenta = 'Gasto Variable';

            // TC ARS (base)
            const tcArs = 1.0;

            // TC Internacional (USD via argentinadatos, AUD/EUR via triangulacion)
            var tcUsd = cacheMap.USD[dateStr];
            var tcAud = cacheMap.AUD[dateStr];
            var tcEur = cacheMap.EUR[dateStr];

            if (!tcUsd || !tcAud || !tcEur) {
                const arsRate = fetchArsRate(dateStr);
                const intlRates = fetchInternationalRates(dateStr);

                tcUsd = arsRate;
                tcAud = arsRate / intlRates.AUD;
                tcEur = arsRate / intlRates.EUR;

                cacheMap.USD[dateStr] = tcUsd;
                cacheMap.AUD[dateStr] = tcAud;
                cacheMap.EUR[dateStr] = tcEur;

                newTcUsdToAppend.push([dateObj, tcUsd]);
                newTcAudToAppend.push([dateObj, tcAud]);
                newTcEurToAppend.push([dateObj, tcEur]);
            }

            // Fila destino: [Monto, Tipo, Cuenta, Tipo de Cuenta, Medio, Moneda, Fecha, Nota, TC_ARS, TC_USD, TC_AUD, TC_EUR]
            registrosToAppend.push([
                row[0], row[1], row[2], tipoCuenta, row[3], row[4], dateObj, row[6],
                tcArs, tcUsd, tcAud, tcEur
            ]);
            filasProcesadasIdx.push(entrada.idx);
        });

        // 5. Escribir nuevos TCs a la hoja "Tipos de cambio"
        pasoActual = 'append cotizaciones TC';
        if (newTcUsdToAppend.length > 0) appendMassive('TC_USD', newTcUsdToAppend, RANGES.TC_USD.dataRow);
        if (newTcAudToAppend.length > 0) appendMassive('TC_AUD', newTcAudToAppend, RANGES.TC_AUD.dataRow);
        if (newTcEurToAppend.length > 0) appendMassive('TC_EUR', newTcEurToAppend, RANGES.TC_EUR.dataRow);

        // 6. Escribir los registros en el ledger Registros.
        // minRow = RANGES.REGISTROS.dataRow (6): datos arrancan debajo del header en fila 5.
        pasoActual = 'append Registros';
        appendMassive('REGISTROS', registrosToAppend, RANGES.REGISTROS.dataRow);

        // 7. Ordenar la hoja Registros por fecha (columna H = indice absoluto 8), best-effort.
        // El sort arranca en RANGES.REGISTROS.dataRow para NO incluir el encabezado.
        // Layout nuevo: datos en B:M (col 2..13), columna fecha = H (col 8).
        // Si la hoja tiene celdas combinadas que cruzan el rango, Sheets lanza error; en ese
        // caso se loguea y se continua: los registros YA estan escritos, el orden es secundario.
        pasoActual = 'sort Registros';
        try {
            const lastRowReg = registrosSheet.getLastRow();
            if (lastRowReg >= RANGES.REGISTROS.dataRow) {
                // Rango B:M = col 2..13, 12 columnas; ordenar por H = col 8
                const rowCount = lastRowReg - RANGES.REGISTROS.dataRow + 1;
                const baseFullRange = registrosSheet.getRange(RANGES.REGISTROS.dataRow, 2, rowCount, 12);
                baseFullRange.sort({ column: 8, ascending: false });
                // Forzar flush para capturar aqui un eventual error de celdas combinadas.
                SpreadsheetApp.flush();
            }
        } catch (sortErr) {
            logError('procesarCargas: sort omitido (posibles celdas combinadas en Registros)', sortErr);
        }
        pasoActual = 'limpiar grilla';

        // 8. Limpiar SOLO las filas procesadas (cols I:O = 9..15). Las omitidas quedan en la grilla.
        filasProcesadasIdx.forEach(function(idx) {
            cargasSheet.getRange(5 + idx, 9, 1, 7).clearContent();
        });

        // 9. Reporte final
        logSuccess('procesarCargas: ' + registrosToAppend.length + ' registros procesados, '
            + omitidas.length + ' omitidos.');
        if (omitidas.length > 0) {
            ui.alert('Procesamiento parcial',
                'Registrados: ' + registrosToAppend.length + '.\n'
                + 'Omitidos: ' + omitidas.length + ' (quedan en la grilla para corregir).\n\n'
                + omitidas.join('\n'),
                ui.ButtonSet.OK);
        } else {
            ss.toast('Registrado exitosamente.', 'Exito', 4);
        }

    } catch (err) {
        logError('procesarCargas: error durante el pipeline', err);
        ui.alert('Fallo en el procesamiento [paso: ' + pasoActual + ']: ' + err.message);
    }
}

// ============================================
// HELPERS DE FECHA
// ============================================

/**
 * Devuelve un string 'YYYY-MM-DD' independiente de la time zone de GAS.
 * @param {Date|string} dateObj
 * @returns {string}
 */
function formatDateISO(dateObj) {
    if (!dateObj || isNaN(new Date(dateObj).getTime())) return '';
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

// ============================================
// HELPER DE INSERCION MASIVA
// ============================================

/**
 * Insercion masiva de celdas. Busca eficientemente el final de una columna.
 *
 * @param {string} tableName Identificador en RANGES
 * @param {Array<Array>} data2D Matriz de filas a insertar
 * @param {number} minRow Fila minima donde puede escribir (inclusive).
 *   DEBE ser >= la dataRow de la tabla. Si se omite, se usa RANGES[tableName].dataRow con
 *   fallback a DATA_START_ROW. Pasar un valor menor puede sobreescribir el encabezado.
 */
function appendMassive(tableName, data2D, minRow) {
    const config = RANGES[tableName];
    minRow = (minRow !== undefined) ? minRow : (config.dataRow || DATA_START_ROW);
    if (data2D.length === 0) return;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);

    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;

    // Obtener todo el vector vertical de la primera columna para encontrar el ultimo bloque lleno
    const colA1 = config.start + '1:' + config.start;
    const values = sheet.getRange(colA1).getValues();

    var lastDataRow = minRow - 1;
    for (var i = values.length - 1; i >= 0; i--) {
        if (values[i][0] !== '') {
            lastDataRow = i + 1; // 1-based index
            break;
        }
    }

    const targetRow = Math.max(minRow, lastDataRow + 1);

    // Padding de columnas faltantes por seguridad
    const paddedData = data2D.map(function(row) {
        const nr = row.slice();
        while (nr.length < numCols) nr.push('');
        return nr;
    });

    const range = sheet.getRange(targetRow, startColIdx, paddedData.length, numCols);
    range.setValues(paddedData);

    // Auto-sort para tablas TC_* en la hoja Tipos de cambio (best-effort).
    // Los datos ya se escribieron con setValues; el orden es secundario. Si la hoja tiene
    // celdas combinadas que cruzan el rango, Sheets lanza error: se loguea y se continua,
    // para no abortar el pipeline de procesarCargas (los TCs ya quedaron guardados).
    if (tableName.indexOf('TC_') === 0 && sheet.getName().toLowerCase() === SHEETS.TIPOS_CAMBIO.toLowerCase()) {
        try {
            const finalBlockRow = targetRow + paddedData.length - 1;
            if (finalBlockRow >= minRow) {
                const tableRange = sheet.getRange(minRow, startColIdx, finalBlockRow - minRow + 1, numCols);
                tableRange.sort({ column: startColIdx, ascending: false });
                // sort() es perezoso: forzar flush aqui para que un eventual error de celdas
                // combinadas se lance DENTRO de este try y no en una operacion posterior.
                SpreadsheetApp.flush();
            }
        } catch (sortErr) {
            logError('appendMassive: sort omitido en ' + tableName + ' (posibles celdas combinadas)', sortErr);
        }
    }
}

// ============================================
// UTILIDAD DE MIGRACION DE HOJAS (EJECUCION UNICA)
// ============================================

/**
 * Renombra las hojas para completar la migracion de produccion 2026-06-21.
 * Orden de operaciones:
 *   1. Renombrar hojas originales a _legacy (para liberar los nombres)
 *   2. Renombrar copias a los nombres definitivos de produccion
 * INVOCAR UNA SOLA VEZ desde el menu [Dev] -> "Renombrar Hojas a Produccion".
 * Idempotente: verifica existencia antes de renombrar.
 * @since 0.9.1
 */
function renameProductionSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const renames = [
        // Paso 1: liberar los nombres originales
        { from: 'Registros',        to: 'Registros_legacy' },
        { from: 'Tipos de cambio',  to: 'Tipos de cambio_legacy' },
        // Paso 2: asignar nombres de produccion a las copias
        { from: 'Copia de Registros',       to: 'Registros' },
        { from: 'Copia de Tipos de Cambio', to: 'Tipos de cambio' },
    ];

    const results = [];

    renames.forEach(function(rename) {
        const from = rename.from;
        const to = rename.to;
        const sheet = ss.getSheetByName(from);
        if (!sheet) {
            results.push('SKIP: \'' + from + '\' no encontrada.');
            return;
        }
        if (ss.getSheetByName(to)) {
            results.push('SKIP: \'' + to + '\' ya existe -- \'' + from + '\' no se renombro.');
            return;
        }
        sheet.setName(to);
        results.push('OK: \'' + from + '\' -> \'' + to + '\'');
        logSuccess('renameProductionSheets: \'' + from + '\' -> \'' + to + '\'');
    });

    SpreadsheetApp.getUi().alert('Resultado del renombrado:\n\n' + results.join('\n'));
}
