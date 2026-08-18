/**
 * 99_MigrationLogic.js
 * Utilidades transitorias/dev para la migración de la BD Legacy "BD antigua".
 *
 * [CONCEPTO DE NEGOCIO]
 * Herramientas de ejecucion puntual para incorporar el historial de la planilla vieja al
 * ledger vigente y para recalcular en bloque los tipos de cambio congelados de Registros.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * El origen (BD Antigua) conserva su layout historico (datos desde la fila 2, cols A:G).
 * El destino (Registros) esta migrado: datos desde la fila 6, cols B:M, fecha en H y los
 * cuatro TC en J:M. Escribir con las coordenadas viejas corrompe el ledger, asi que toda
 * coordenada de destino sale de RANGES.REGISTROS.
 *
 * @see 00_Config.js (RANGES.REGISTROS)
 *
 * @version 0.9.5
 * @since 0.1.0
 * @lastModified 2026-08-13
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
        // Sin minRow explicito: MEDIOS_PAGO no declara dataRow y cae al default del Plan de Cuentas (4).
        appendMassive('MEDIOS_PAGO', mediosToAppend);
    }

    SpreadsheetApp.getUi().alert(
        'Análisis Completo',
        `Medios agregados automáticamente en Plan de Cuentas: ${mediosFaltantes.length}\n` +
        `Cuentas faltantes listadas en la Columna H de "BD antigua": ${cuentasFaltantes.length}\n\n` +
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
        // Datos de Registros desde la fila 6 (header en la 5) en el layout migrado.
        appendMassive('REGISTROS', registrosToAppend, RANGES.REGISTROS.dataRow);

        // Ordenar BD por Fecha descendente. Layout migrado: B:M = cols 2..13, fecha en H = 8.
        // Sort best-effort: los registros ya estan escritos; un fallo de orden no debe empujar
        // al usuario a re-ejecutar la migracion (duplicaria todo el historico).
        const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
        const dataRowReg = RANGES.REGISTROS.dataRow;
        const lastRowReg = registrosSheet.getLastRow();
        if (lastRowReg >= dataRowReg) {
            try {
                const rowCount = lastRowReg - dataRowReg + 1;
                const baseFullRange = registrosSheet.getRange(dataRowReg, 2, rowCount, 12); // B:M
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
 * Lee las fechas de la columna H y sobrescribe las columnas J:M interpolando el Caché actual
 * (Modo ARS Base), segun el layout migrado de Registros.
 */
function recalcularTcRegistros() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Precaución', '¿Verificaste tener la Caché cargada al 100%? Esta acción sobreescribirá todas las cotizaciones de la Hoja Registros.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
    
    const dataRow = RANGES.REGISTROS.dataRow;
    const lastRow = registrosSheet.getLastRow();
    if (lastRow < dataRow) return;

    // Obtener Fechas desde la col H (indice absoluto 8) del layout migrado.
    // Los datos arrancan en dataRow (6); cantidad de filas = lastRow - dataRow + 1.
    const rowCount = lastRow - dataRow + 1;
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

        // Layout migrado: J=10(ARS), K=11(USD), L=12(AUD), M=13(EUR)
        newValues.push([1.0, tcUsd, tcAud, tcEur]);
    });

    // Sobreescribir columnas J:M desde la fila de datos
    const tcRange = registrosSheet.getRange(dataRow, 10, rowCount, 4);
    tcRange.setValues(newValues);

    let msg = `Se recalcularon ${newValues.length} transacciones exitosamente.\n\n`;
    if (fallbackCounter > 0) msg += `ATENCIÓN: Hubo ${fallbackCounter} interpolaciones usando fallback.`;
    ui.alert('Proceso Completo', msg, ui.ButtonSet.OK);
}
