/**
 * 06_RegistrosService.js
 * Servicio para procesar el lote de Cargas, enriquecerlo y apendear en Registros.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pipeline batch de ingestion de transacciones. El usuario carga un lote de movimientos en
 * la grilla de Cargas y esta funcion los enriquece con las cotizaciones del dia y los
 * persiste en el ledger Registros con los TC congelados.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * ADR-004: la carga batch garantiza que cada registro quede inmutable con los tipos de
 * cambio del momento de procesamiento; no hay consulta en vivo celda a celda.
 * Origen (Cargas) y destino (Registros, Tipos de cambio) tienen layouts distintos: el
 * origen no migro (datos fila 5) y los destinos si (Registros datos fila 6, cols B:M;
 * bloques TC datos fila 7). Toda coordenada sale de RANGES.
 *
 * @see 00_Config.js (RANGES.CARGAS, RANGES.REGISTROS, RANGES.TC_*)
 * @see 03_SheetManager.js (getTableData, asegurarCapacidadFilas)
 *
 * @version 0.9.5
 * @since 0.1.0
 * @lastModified 2026-08-13
 */

/**
 * Función maestra invocada desde el menú [Dev] o botón.
 */
function procesarCargas() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cargasSheet = ss.getSheetByName(RANGES.CARGAS.sheet);
    const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);

    if (!cargasSheet || !registrosSheet) {
        SpreadsheetApp.getUi().alert('Faltan configurar las hojas Cargas o Registros.');
        return;
    }

    // 1. Leer la grilla de carga (equivalente a I5:O19, resuelto desde RANGES.CARGAS)
    const cargasCfg = RANGES.CARGAS;
    const cargasStartCol = columnLetterToIndex(cargasCfg.start);
    const cargasNumCols = columnLetterToIndex(cargasCfg.end) - cargasStartCol + 1;
    const cargasRange = cargasSheet.getRange(cargasCfg.dataRow, cargasStartCol, cargasCfg.filas, cargasNumCols);
    const cargasData = cargasRange.getValues();

    // Validar y filtrar filas que tengan como mínimo un Monto cargado
    const validRows = cargasData.filter(row => row[0] !== '');
    if (validRows.length === 0) {
        ss.toast('No hay transacciones completas para registrar.', 'Aviso', 3);
        return;
    }

    ss.toast(`Procesando ${validRows.length} registro(s)...`, 'Procesando', 5);

    // 2. Precargar las cachés de Tipos de Cambio
    const tcUsdData = getTableData('TC_USD');
    const tcAudData = getTableData('TC_AUD');
    const tcEurData = getTableData('TC_EUR');

    // 2.1 Precargar categorías para deducción de Tipo de Cuenta
    const catalogos = leerCatalogosPlanCuentas();

    const cacheMap = { USD: {}, AUD: {}, EUR: {} };
    tcUsdData.forEach(r => { if (r[0]) cacheMap.USD[formatDateISO(r[0])] = r[1] });
    tcAudData.forEach(r => { if (r[0]) cacheMap.AUD[formatDateISO(r[0])] = r[1] });
    tcEurData.forEach(r => { if (r[0]) cacheMap.EUR[formatDateISO(r[0])] = r[1] });

    let newTcUsdToAppend = [];
    let newTcAudToAppend = [];
    let newTcEurToAppend = [];
    const registrosToAppend = [];

    const FLOOR_DATE = new Date('2024-01-01T12:00:00Z');

    try {
        validRows.forEach((row, i) => {
            // Fila: [Monto (0), Tipo (1), Cuenta (2), Medio (3), Moneda (4), Fecha (5), Nota (6)]
            let rawDate = row[5];
            if (!rawDate) rawDate = new Date();
            
            let dateObj = new Date(rawDate);
            if (isNaN(dateObj.getTime())) dateObj = new Date();
            if (dateObj < FLOOR_DATE) dateObj = FLOOR_DATE;

            const dateStr = formatDateISO(dateObj);

            // Deducir Tipo de Cuenta (Ingreso, Gasto Fijo, Gasto Variable).
            // Sin opciones: comportamiento identico al historico (ver deducirTipoCuenta).
            const tipoCuenta = deducirTipoCuenta(row[2], catalogos);

            // ARS Base
            const tcArs = 1.0;

            // TC Internacional (USD vía argentinadatos, AUD/EUR vía triangulación)
            let tcUsd = cacheMap.USD[dateStr];
            let tcAud = cacheMap.AUD[dateStr];
            let tcEur = cacheMap.EUR[dateStr];
            
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

            // Fila Destino: [Monto, Tipo, Cuenta, Tipo de Cuenta, Medio, Moneda, Fecha, Nota, TC_ARS, TC_USD, TC_AUD, TC_EUR]
            registrosToAppend.push([
                row[0], row[1], row[2], tipoCuenta, row[3], row[4], dateObj, row[6],
                tcArs, tcUsd, tcAud, tcEur
            ]);
        });

        // 3. Escribir nuevos TCs a la hoja "Tipos de cambio" (bloques con datos desde la fila 7)
        if (newTcUsdToAppend.length > 0) appendMassive('TC_USD', newTcUsdToAppend, RANGES.TC_USD.dataRow);
        if (newTcAudToAppend.length > 0) appendMassive('TC_AUD', newTcAudToAppend, RANGES.TC_AUD.dataRow);
        if (newTcEurToAppend.length > 0) appendMassive('TC_EUR', newTcEurToAppend, RANGES.TC_EUR.dataRow);

        // 4. Escribir los registros en el ledger Registros (datos desde la fila 6, header en la 5)
        appendMassive('REGISTROS', registrosToAppend, RANGES.REGISTROS.dataRow);

        // 5. Ordenar la hoja Registros por Fecha (columna H = indice absoluto 8), descendente.
        // Layout nuevo: datos en B:M = columnas 2..13 (12 columnas), desde la fila 6.
        // decision Franco 2026-08-13: el sort es best-effort. Los registros YA quedaron escritos
        // en el paso 4; si el sort falla (celdas combinadas cruzando el rango) se loguea y se
        // sigue: dejar caer todo el pipeline invitaria a re-ejecutarlo y duplicar el lote.
        const dataRowReg = RANGES.REGISTROS.dataRow;
        const lastRowReg = registrosSheet.getLastRow();
        if (lastRowReg >= dataRowReg) {
            try {
                const rowCount = lastRowReg - dataRowReg + 1;
                const baseFullRange = registrosSheet.getRange(dataRowReg, 2, rowCount, 12);
                baseFullRange.sort({ column: 8, ascending: false });
                // sort() es perezoso: el flush fuerza el error dentro de este try.
                SpreadsheetApp.flush();
            } catch (sortErr) {
                logError('procesarCargas: sort omitido (posibles celdas combinadas en Registros)', sortErr);
            }
        }

        // 6. Limpiar la grilla de Cargas (solo las celdas utilizadas del lote)
        // en lugar de limpiar todo I5:O19 iterando, podemos limpiar los valids
        cargasRange.clearContent();

        ss.toast(`Registrado exitosamente.`, '¡Éxito!', 4);
        logSuccess(`Batch transfer completo: ${registrosToAppend.length} iteraciones procesadas.`);

    } catch (err) {
        logError("Error al procesar Registros Batch", err);
        SpreadsheetApp.getUi().alert(`Fallo en el procesamiento: ${err.message}`);
    }
}

// ============================================
// DEDUCCION DE TIPO DE CUENTA (COMPARTIDA)
// ============================================

// decision Franco 2026-08-13: la deduccion sale de adentro de procesarCargas() y pasa a ser una
// funcion propia. Motivo: la migracion del historico de la planilla vieja
// (MIGRACION_v031_Historico.js) tiene que clasificar exactamente igual que el pipeline, y una
// segunda implementacion "equivalente" es la forma mas barata de que dos partes del sistema
// clasifiquen distinto sin que nadie se entere. La extraccion PRESERVA el comportamiento
// historico byte por byte: sin opciones, compara con igualdad estricta contra los tres
// catalogos y en el mismo orden de precedencia. Las dos tolerancias nuevas son OPT-IN y solo
// las pide el devtool de migracion, de modo que procesarCargas() no cambia -- lo que respeta
// la decision de Franco de corregir los traspasos solo en las formulas de lectura.

/**
 * Lee los tres catalogos del Plan de Cuentas que definen el Tipo de Cuenta.
 *
 * @returns {{ingresos: string[], fijos: string[], variables: string[]}}
 */
function leerCatalogosPlanCuentas() {
    return {
        ingresos: getTableData('INGRESOS').map(r => r[0]),
        fijos: getTableData('GASTOS_FIJOS').map(r => r[0]),
        variables: getTableData('GASTOS_VARIABLES').map(r => r[0])
    };
}

/**
 * Deduce el Tipo de Cuenta buscando el nombre de la cuenta en los catalogos del Plan de Cuentas.
 *
 * Precedencia (la historica, no se altera): Ingreso -> Gasto Fijo -> Gasto Variable. Una cuenta
 * que no aparece en ningun catalogo devuelve '' -- el gap de validacion conocido del pipeline:
 * la fila se registra igual, con el Tipo de Cuenta vacio.
 *
 * @param {*} nombreCuenta valor de la columna Cuenta
 * @param {{ingresos: string[], fijos: string[], variables: string[]}} catalogos
 * @param {{tolerante?: boolean, excluirNeutras?: boolean}} [opciones]
 *        tolerante: si no hubo match exacto, reintenta normalizando mayusculas y espacios.
 *          Solo puede AGREGAR clasificaciones donde antes quedaba '': nunca cambia una que
 *          ya matcheo exacto.
 *        excluirNeutras: las cuentas de CUENTAS_NEUTRAS devuelven '' aunque figuren en un
 *          catalogo. Hace falta porque "Traspaso" SI esta dado de alta como ingreso en el Plan
 *          de Cuentas de produccion (por eso las 533 patas de traspaso quedaron clasificadas
 *          como Ingreso). Es opt-in a proposito: activarlo por defecto cambiaria como escribe
 *          procesarCargas() de aca en mas, y esa no es la decision que se tomo.
 * @returns {string} 'Ingreso' | 'Gasto Fijo' | 'Gasto Variable' | ''
 */
function deducirTipoCuenta(nombreCuenta, catalogos, opciones) {
    opciones = opciones || {};
    const ingresos = (catalogos && catalogos.ingresos) || [];
    const fijos = (catalogos && catalogos.fijos) || [];
    const variables = (catalogos && catalogos.variables) || [];

    if (opciones.excluirNeutras === true && esCuentaNeutra(nombreCuenta)) return '';

    // --- Camino historico: igualdad estricta, mismo orden. ---
    if (ingresos.indexOf(nombreCuenta) !== -1) return 'Ingreso';
    if (fijos.indexOf(nombreCuenta) !== -1) return 'Gasto Fijo';
    if (variables.indexOf(nombreCuenta) !== -1) return 'Gasto Variable';

    if (opciones.tolerante !== true) return '';

    // --- Reintento tolerante (mayusculas y espacios). Solo llega aca lo que ya quedaba en ''. ---
    const buscado = normalizarNombreCuenta(nombreCuenta);
    if (buscado === '') return '';
    if (_catalogoContiene(ingresos, buscado)) return 'Ingreso';
    if (_catalogoContiene(fijos, buscado)) return 'Gasto Fijo';
    if (_catalogoContiene(variables, buscado)) return 'Gasto Variable';
    return '';
}

/** true si el catalogo tiene un nombre que normaliza igual que el buscado (ya normalizado). */
function _catalogoContiene(catalogo, nombreNormalizado) {
    for (let i = 0; i < catalogo.length; i++) {
        if (normalizarNombreCuenta(catalogo[i]) === nombreNormalizado) return true;
    }
    return false;
}

/**
 * Devuelve un string 'YYYY-MM-DD' independiente de la time zone de GAS (asegura neutralidad).
 */
function formatDateISO(dateObj) {
    if (!dateObj || isNaN(new Date(dateObj).getTime())) return '';
    const d = new Date(dateObj);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Inserción masiva de celdas. Busca eficientemente el final de una columna.
 *
 * @param {string} tableName Identificador en RANGES
 * @param {Array} data2D Matriz de filas a insertar
 * @param {number} [minRow] Primera fila donde puede escribir (inclusive). Debe ser >= la
 *   dataRow de la tabla; si se omite se usa RANGES[tableName].dataRow con fallback a
 *   DATA_START_ROW. Un valor menor pisaria el encabezado.
 */
function appendMassive(tableName, data2D, minRow) {
    if (data2D.length === 0) return;
    const config = RANGES[tableName];
    // Default por tabla: Registros=6, bloques TC=7, Plan de Cuentas=DATA_START_ROW (4).
    minRow = (minRow !== undefined) ? minRow : getDataRow(config);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheet);

    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;

    // Obtener todo el vector vertical de la primera columna para encontrar el último bloque lleno
    const colA1 = `${config.start}1:${config.start}`;
    const values = sheet.getRange(colA1).getValues();

    let lastDataRow = minRow - 1;
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i][0] !== '') {
            lastDataRow = i + 1; // 1-based index
            break;
        }
    }

    const targetRow = Math.max(minRow, lastDataRow + 1);

    // Validar y rellenar las columnas faltantes (Padding por seguridad)
    const paddedData = data2D.map(row => {
        const nr = [...row];
        while (nr.length < numCols) nr.push('');
        return nr;
    });

    // El grid puede no llegar hasta el final del lote (caso Tipos de cambio, con 6 filas
    // libres tras la migracion). Se amplia ANTES del setValues: o entra todo, o no se escribe.
    asegurarCapacidadFilas(sheet, targetRow + paddedData.length - 1);

    const range = sheet.getRange(targetRow, startColIdx, paddedData.length, numCols);
    range.setValues(paddedData);

    // [ALGORITMO AUTOMÁTICO] Si la inserción es de Tipos de Cambio, ordenarla temporalmente Z-A in situ.
    // Best-effort: los datos ya se escribieron, el orden es secundario (mismo criterio que el
    // sort de Registros en procesarCargas).
    if (tableName.startsWith('TC_') && sheet.getName().toLowerCase() === SHEETS.TIPOS_CAMBIO.toLowerCase()) {
        try {
            // Aprovechamos targetRow y la longitud real del array insertado para no depender de sheet.getLastRow() que sufre lag asíncrono
            const finalBlockRow = targetRow + paddedData.length - 1;
            if (finalBlockRow >= minRow) {
                const tableRange = sheet.getRange(minRow, startColIdx, finalBlockRow - minRow + 1, numCols);
                tableRange.sort({ column: startColIdx, ascending: false }); // Sort x fecha Z-A relativo a toda la columna
                SpreadsheetApp.flush();
            }
        } catch (sortErr) {
            logError('appendMassive: sort omitido en ' + tableName + ' (posibles celdas combinadas)', sortErr);
        }
    }
}
