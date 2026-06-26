/**
 * 99_MigrationLogic.js
 * Utilidades transitorias/dev para la migracion de datos legacy al layout de produccion nuevo.
 *
 * [CONCEPTO DE NEGOCIO]
 * Herramientas de ejecucion unica para poblar las hojas de produccion nuevas desde las hojas
 * _legacy ocultas. Permite migrar el historial de transacciones y tipos de cambio sin necesidad
 * de re-ingreso manual ni reprocesamiento batch.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Tras la migracion de hojas 2026-06-22, las hojas "Registros" y "Tipos de cambio" tienen un
 * layout limpio (sin el offset I:T historico de ADR-005). Los datos historicos viven en
 * "Registros_legacy" (cols I:T, datos desde fila 3) y "Tipos de cambio_legacy" (bloques I:J,
 * L:M, O:P, R:S, datos desde fila 4). migrarLegacyANuevaProduccion() es el puente entre ambos
 * mundos: copia los datos crudos, escribe los sub-headers de Tipos de cambio, y reporta cuantas
 * filas migro. La funcion es idempotente: aborta si ya hay datos en B6 de Registros.
 *
 * @see 00_Config.js (SHEETS, RANGES)
 *
 * @version 0.9.4
 * @since 0.9.4
 * @lastModified 2026-06-22
 */

/**
 * Analiza faltantes en el Plan de Cuentas actual vs la BD antigua.
 * Las Cuentas faltantes se listan en H2:H de BD antigua.
 * Los Medios faltantes se insertan en MEDIOS_PAGO con moneda ARS por defecto.
 */
function analizarBdAntigua() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bdSheet = ss.getSheetByName(SHEETS.BD_ANTIGUA);
    
    if (!bdSheet) {
        SpreadsheetApp.getUi().alert("No se encontró la hoja 'BD antigua'.");
        return;
    }

    const lastRow = bdSheet.getLastRow();
    if (lastRow < 2) return;

    // Extraer Detalles (Col D) y Medios (Col E)
    // A=0, B=1, C=2, D=3, E=4
    const dataRange = bdSheet.getRange(2, 4, lastRow - 1, 2); 
    const data = dataRange.getValues();

    const uniqueCuentas = [...new Set(data.map(r => r[0]).filter(v => v !== ''))];
    const uniqueMedios = [...new Set(data.map(r => r[1]).filter(v => v !== ''))];

    // Cargar Plan de Cuentas Actual
    const pcIngresos = getTableData('INGRESOS').map(r => r[0]);
    const pcFijos = getTableData('GASTOS_FIJOS').map(r => r[0]);
    const pcVariables = getTableData('GASTOS_VARIABLES').map(r => r[0]);
    const pcAllCuentas = [...pcIngresos, ...pcFijos, ...pcVariables];
    
    const pcMediosData = getTableData('MEDIOS_PAGO'); // [Nombre, Moneda, Proyecto]
    const pcAllMedios = pcMediosData.map(r => r[0]);

    // Faltantes de Cuentas
    const cuentasFaltantes = uniqueCuentas.filter(c => !pcAllCuentas.includes(c));
    
    // Anotar en Columna H (8) de BD antigua
    bdSheet.getRange('H:H').clearContent();
    bdSheet.getRange('H1').setValue('Cuentas Faltantes');
    if (cuentasFaltantes.length > 0) {
        const cuentasArr = cuentasFaltantes.map(c => [c]);
        bdSheet.getRange(2, 8, cuentasArr.length, 1).setValues(cuentasArr);
    }

    // Faltantes de Medios
    const mediosFaltantes = uniqueMedios.filter(m => !pcAllMedios.includes(m));
    if (mediosFaltantes.length > 0) {
        const mediosToAppend = mediosFaltantes.map(m => [m, 'ARS', '']); // Nombre, Moneda ARS, Proyecto vacio
        appendMassive('MEDIOS_PAGO', mediosToAppend, 4); // Fila inicial de catalogos es 4
    }

    SpreadsheetApp.getUi().alert(
        'Análisis Completo',
        `📌 Medios agregados automáticamente en Plan de Cuentas: ${mediosFaltantes.length}\n` +
        `📌 Cuentas faltantes listadas en la Columna H de "BD antigua": ${cuentasFaltantes.length}\n\n` +
        `Por favor, agrega manualmente estas cuentas al Plan de Cuentas antes de ejecutar la Migración defintiva.`,
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

/**
 * Migra fila por fila hacia la DB Registros. 
 * Asume que ya se ejecutó forzarCargaHistorica().
 */
function migrarBdAntigua() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Precaución', '¿Verificaste que agregaste todas las Cuentas faltantes al Plan de Cuentas? Si faltan cuentas, el sistema se verá obligado a ignorarlas y listarlas como Sin Clasificar.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const bdSheet = ss.getSheetByName(SHEETS.BD_ANTIGUA);
    const lastRow = bdSheet.getLastRow();
    if (lastRow < 2) return;

    ss.toast("Procesando Migración Masiva...", "En progreso", 10);

    const oldData = bdSheet.getRange(2, 1, lastRow - 1, 7).getValues(); 
    // A=0(Fecha), B=1(Ing), C=2(Egr), D=3(Cuenta), E=4(Medio), F=5(Ignorar), G=6(Nota)

    // Diccionarios actuales de Cotizaciones
    const tcUsdData = getTableData('TC_USD');
    const tcAudData = getTableData('TC_AUD');
    const tcEurData = getTableData('TC_EUR');
    
    // Hash Maps rápidos
    const cacheMap = { USD: {}, AUD: {}, EUR: {} };
    tcUsdData.forEach(r => { if (r[0]) cacheMap.USD[formatDateISO(r[0])] = r[1]; });
    tcAudData.forEach(r => { if (r[0]) cacheMap.AUD[formatDateISO(r[0])] = r[1]; });
    tcEurData.forEach(r => { if (r[0]) cacheMap.EUR[formatDateISO(r[0])] = r[1]; });

    const ingresosCat = getTableData('INGRESOS').map(r => r[0]);
    const fijosCat = getTableData('GASTOS_FIJOS').map(r => r[0]);
    const variablesCat = getTableData('GASTOS_VARIABLES').map(r => r[0]);

    // Mapa de Medios -> Moneda
    const pcMediosData = getTableData('MEDIOS_PAGO');
    const medioToCurrency = {};
    pcMediosData.forEach(m => { medioToCurrency[m[0]] = m[1] || 'ARS'; });

    const registrosToAppend = [];
    let fallbackCounter = 0;

    oldData.forEach(row => {
        let rawDate = row[0];
        if (!rawDate) return;
        
        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) return;

        let monto = 0;
        let tipo = '';
        if (row[1] !== '' && row[1] > 0) { // Hay Ingreso
            monto = row[1];
            tipo = 'Ingreso';
        } else if (row[2] !== '' && row[2] > 0) { // Hay Egreso
            monto = row[2];
            tipo = 'Egreso';
        } else {
            return; // ignorar fila sin montos
        }

        const cuenta = row[3] || 'Desconocida';
        let tipoCuenta = 'Sin Clasificar';
        if (ingresosCat.includes(cuenta)) tipoCuenta = 'Ingreso';
        else if (fijosCat.includes(cuenta)) tipoCuenta = 'Gasto Fijo';
        else if (variablesCat.includes(cuenta)) tipoCuenta = 'Gasto Variable';

        const medio = row[4];
        let moneda = medioToCurrency[medio] || 'ARS';
        const nota = row[6] || '';

        const dateStr = formatDateISO(dateObj);

        // Uso de caché pre-llenada por forzarCargaHistorica(). 
        // Si no se encuentra, usa fallback genérico
        let tcUsd = cacheMap.USD[dateStr];
        let tcAud = cacheMap.AUD[dateStr];
        let tcEur = cacheMap.EUR[dateStr];
        
        if (!tcUsd || !tcAud || !tcEur) {
            fallbackCounter++;
        }
        
        // Asignaciones finales si fallback
        if (!tcUsd) tcUsd = 1050.0;
        if (!tcAud) tcAud = 650.0;
        if (!tcEur) tcEur = 1100.0;

        registrosToAppend.push([
            monto, tipo, cuenta, tipoCuenta, medio, moneda, dateObj, nota,
            1.0, tcUsd, tcAud, tcEur
        ]);
    });

    if (registrosToAppend.length > 0) {
        // minRow = RANGES.REGISTROS.dataRow (6): datos arrancan debajo del header en fila 5.
        appendMassive('REGISTROS', registrosToAppend, RANGES.REGISTROS.dataRow);

        // Ordenar por Fecha (col H = indice absoluto 8) de forma descendente.
        // Sort best-effort: si hay celdas combinadas en Registros el sort lanza error;
        // los registros ya estan escritos antes de llegar aqui, asi que se loguea y continua.
        const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
        const lastRowReg = registrosSheet.getLastRow();
        if (lastRowReg >= RANGES.REGISTROS.dataRow) {
            try {
                const rowCount = lastRowReg - RANGES.REGISTROS.dataRow + 1;
                // Columna 2 = B (primer campo del layout nuevo), 12 columnas = B:M.
                const baseFullRange = registrosSheet.getRange(RANGES.REGISTROS.dataRow, 2, rowCount, 12);
                baseFullRange.sort({ column: 8, ascending: false }); // H = 8 = Fecha
                SpreadsheetApp.flush();
            } catch (sortErr) {
                logError('migrarBdAntigua: sort omitido (posibles celdas combinadas en Registros)', sortErr);
            }
        }
    }

    let msg = `Se migraron ${registrosToAppend.length} transacciones exitosamente.\n\n`;
    if (fallbackCounter > 0) {
        msg += `ATENCIÓN: Ciertas fechas (${fallbackCounter} registros) no encontraron cotización en el caché. Asegúrate de siempre hacer click en "[Dev] Forzar Carga Histórica TC" antes de migrar para nutrir la memoria caché al 100%.`;
    }
    ui.alert('Proceso Completo', msg, ui.ButtonSet.OK);
}

/**
 * Herramienta [Dev] para recalcular todos los TC de la base de Registros en bloque.
 * Lee las fechas y sobrescribe las columnas Q:T interpolando el Caché actual (Modo ARS Base).
 */
function recalcularTcRegistros() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Precaución', '¿Verificaste tener la Caché cargada al 100%? Esta acción sobreescribirá todas las cotizaciones de la Hoja Registros.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
    
    const lastRow = registrosSheet.getLastRow();
    if (lastRow < RANGES.REGISTROS.dataRow) return;

    // Obtener Fechas desde col H (indice absoluto 8) en el layout nuevo.
    // Datos arrancan en RANGES.REGISTROS.dataRow (6); cantidad de filas = lastRow - (dataRow - 1).
    const dataRow = RANGES.REGISTROS.dataRow;
    const rowCount = lastRow - (dataRow - 1);
    const fechasRange = registrosSheet.getRange(dataRow, 8, rowCount, 1);
    const fechasData = fechasRange.getValues();

    // Diccionarios actuales de Cotizaciones
    const tcUsdData = getTableData('TC_USD');
    const tcAudData = getTableData('TC_AUD');
    const tcEurData = getTableData('TC_EUR');
    
    const cacheMap = { USD: {}, AUD: {}, EUR: {} };
    tcUsdData.forEach(r => { if (r[0]) cacheMap.USD[formatDateISO(r[0])] = r[1]; });
    tcAudData.forEach(r => { if (r[0]) cacheMap.AUD[formatDateISO(r[0])] = r[1]; });
    tcEurData.forEach(r => { if (r[0]) cacheMap.EUR[formatDateISO(r[0])] = r[1]; });

    const newValues = [];
    let fallbackCounter = 0;

    fechasData.forEach(row => {
        let rawDate = row[0];
        if (!rawDate) {
            newValues.push(['', '', '', '']);
            return;
        }
        
        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) {
            newValues.push(['', '', '', '']);
            return;
        }

        const dateStr = formatDateISO(dateObj);

        let tcUsd = cacheMap.USD[dateStr];
        let tcAud = cacheMap.AUD[dateStr];
        let tcEur = cacheMap.EUR[dateStr];
        
        if (!tcUsd || !tcAud || !tcEur) fallbackCounter++;
        
        if (!tcUsd) tcUsd = 1050.0;
        if (!tcAud) tcAud = 650.0;
        if (!tcEur) tcEur = 1100.0;

        // J=10(ARS), K=11(USD), L=12(AUD), M=13(EUR) - layout nuevo
        newValues.push([1.0, tcUsd, tcAud, tcEur]);
    });

    // Sobreescribir columnas J:M (10-13) desde la fila de datos (dataRow=6)
    const tcRange = registrosSheet.getRange(dataRow, 10, rowCount, 4);
    tcRange.setValues(newValues);

    var msg = 'Se recalcularon ' + newValues.length + ' transacciones exitosamente.\n\n';
    if (fallbackCounter > 0) msg += 'ATENCION: Hubo ' + fallbackCounter + ' interpolaciones usando fallback.';
    ui.alert('Proceso Completo', msg, ui.ButtonSet.OK);
}

// ============================================
// MIGRACION A LAYOUT DE PRODUCCION NUEVO (EJECUCION UNICA)
// ============================================

/**
 * Copia los datos historicos desde las hojas _legacy al layout de produccion nuevo.
 *
 * Flujo:
 *   1. Confirmacion del usuario antes de escribir.
 *   2. Idempotencia: aborta si B6 de "Registros" ya tiene datos (evita duplicar).
 *   3. Registros: copia I3:T(ultima) de "Registros_legacy" -> B6 de "Registros" (12 cols, mismo orden).
 *   4. Tipos de cambio: escribe sub-headers en fila 6, luego copia cada bloque desde la legacy.
 *   5. Reporte con conteo de filas migradas por tabla.
 *
 * INVOCAR UNA SOLA VEZ desde el menu [Dev] -> "Migrar Datos a Produccion Nueva".
 *
 * @since 0.9.4
 */
function migrarLegacyANuevaProduccion() {
    var ui = SpreadsheetApp.getUi();
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Confirmacion
    var resp = ui.alert(
        'Migracion de datos legacy',
        'Esta accion copiara los datos historicos de "Registros_legacy" y "Tipos de cambio_legacy" ' +
        'a las hojas de produccion nuevas "Registros" y "Tipos de cambio".\n\n' +
        'Si ya hay datos en produccion la operacion se abortara para no duplicar. Continuar?',
        ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) {
        logInfo('migrarLegacyANuevaProduccion: cancelada por el usuario.');
        return;
    }

    // --- Hojas de destino ---
    var registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
    var tcSheet = ss.getSheetByName(SHEETS.TIPOS_CAMBIO);

    // --- Hojas de origen ---
    var registrosLegacy = ss.getSheetByName('Registros_legacy');
    var tcLegacy = ss.getSheetByName('Tipos de cambio_legacy');

    if (!registrosSheet || !tcSheet) {
        ui.alert('Error: no se encontraron las hojas de produccion "Registros" o "Tipos de cambio".');
        return;
    }
    if (!registrosLegacy || !tcLegacy) {
        ui.alert('Error: no se encontraron las hojas legacy "Registros_legacy" o "Tipos de cambio_legacy".');
        return;
    }

    // 2. Idempotencia: verificar si ya hay datos en B6 de Registros
    var checkCell = registrosSheet.getRange('B6').getValue();
    if (checkCell !== '' && checkCell !== null) {
        ui.alert(
            'Datos ya presentes',
            'La celda B6 de "Registros" ya contiene datos. La migracion fue abortada para evitar duplicacion.',
            ui.ButtonSet.OK
        );
        logInfo('migrarLegacyANuevaProduccion: abortada por idempotencia (B6 no vacia).');
        return;
    }

    var filasRegistros = 0;
    var filasTcArs = 0;
    var filasTcUsd = 0;
    var filasTcAud = 0;
    var filasTcEur = 0;

    // 3. Migrar Registros: leer I3:T de legacy, escribir en B6 de produccion
    // Layout legacy: datos desde fila 3, columnas I(9)..T(20), 12 columnas
    var legLastRow = registrosLegacy.getLastRow();
    if (legLastRow >= 3) {
        var legData = registrosLegacy.getRange(3, 9, legLastRow - 2, 12).getValues();
        // Filtrar filas completamente vacias (primera columna vacia = sin monto)
        var legDataFiltrado = legData.filter(function(row) {
            return row[0] !== '' && row[0] !== null;
        });
        if (legDataFiltrado.length > 0) {
            registrosSheet.getRange(6, 2, legDataFiltrado.length, 12).setValues(legDataFiltrado);
            filasRegistros = legDataFiltrado.length;
            logSuccess('migrarLegacyANuevaProduccion: Registros migrados=' + filasRegistros);
        }
    }

    // 4. Tipos de cambio: escribir sub-headers en fila 6 y copiar bloques desde legacy
    // Sub-headers en fila 6: B6=Fecha, C6=Cotizacion, E6=Fecha, F6=Cotizacion, H6=Fecha, I6=Cotizacion, K6=Fecha, L6=Cotizacion
    tcSheet.getRange('B6').setValue('Fecha');
    tcSheet.getRange('C6').setValue('Cotizacion');
    tcSheet.getRange('E6').setValue('Fecha');
    tcSheet.getRange('F6').setValue('Cotizacion');
    tcSheet.getRange('H6').setValue('Fecha');
    tcSheet.getRange('I6').setValue('Cotizacion');
    tcSheet.getRange('K6').setValue('Fecha');
    tcSheet.getRange('L6').setValue('Cotizacion');
    logInfo('migrarLegacyANuevaProduccion: sub-headers Tipos de cambio escritos.');

    // Helper para copiar un bloque TC desde legacy a produccion
    // legSheet: hoja origen | legStartCol: columna inicio en legacy (1-based) | numCols: 2
    // destSheet: hoja destino | destStartCol: columna inicio en destino (1-based) | destStartRow: 7
    function copiarBloqueTC(legSheet, legStartCol, destSheet, destStartCol) {
        var lastLegRow = legSheet.getLastRow();
        if (lastLegRow < 4) return 0;
        var datos = legSheet.getRange(4, legStartCol, lastLegRow - 3, 2).getValues();
        var datosFiltrados = datos.filter(function(row) {
            return row[0] !== '' && row[0] !== null;
        });
        if (datosFiltrados.length > 0) {
            destSheet.getRange(7, destStartCol, datosFiltrados.length, 2).setValues(datosFiltrados);
        }
        return datosFiltrados.length;
    }

    // Layout legacy: ARS=I:J (col 9:10), USD=L:M (col 12:13), AUD=O:P (col 15:16), EUR=R:S (col 18:19)
    // Layout nuevo: ARS=B:C (col 2:3), USD=E:F (col 5:6), AUD=H:I (col 8:9), EUR=K:L (col 11:12)
    filasTcArs = copiarBloqueTC(tcLegacy, 9,  tcSheet, 2);
    filasTcUsd = copiarBloqueTC(tcLegacy, 12, tcSheet, 5);
    filasTcAud = copiarBloqueTC(tcLegacy, 15, tcSheet, 8);
    filasTcEur = copiarBloqueTC(tcLegacy, 18, tcSheet, 11);

    logSuccess('migrarLegacyANuevaProduccion: TC migrados - ARS=' + filasTcArs + ' USD=' + filasTcUsd + ' AUD=' + filasTcAud + ' EUR=' + filasTcEur);

    // 5. Reporte final
    ui.alert(
        'Migracion completada',
        'Registros migrados: ' + filasRegistros + '\n' +
        'Tipos de cambio ARS: ' + filasTcArs + '\n' +
        'Tipos de cambio USD: ' + filasTcUsd + '\n' +
        'Tipos de cambio AUD: ' + filasTcAud + '\n' +
        'Tipos de cambio EUR: ' + filasTcEur,
        ui.ButtonSet.OK
    );
}
