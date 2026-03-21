/**
 * 99_MigrationLogic.js
 * Utilidades transitorias/dev para la migración de la BD Legacy "BD antigua".
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
    const pcFijos = getTableData('COSTOS_FIJOS').map(r => r[0]);
    const pcVariables = getTableData('COSTOS_VARIABLES').map(r => r[0]);
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
    const fijosCat = getTableData('COSTOS_FIJOS').map(r => r[0]);
    const variablesCat = getTableData('COSTOS_VARIABLES').map(r => r[0]);

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
        else if (fijosCat.includes(cuenta)) tipoCuenta = 'Costo Fijo';
        else if (variablesCat.includes(cuenta)) tipoCuenta = 'Costo Variable';

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
        appendMassive('REGISTROS', registrosToAppend, 2);
        
        // Ordenar BD
        const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
        const lastRowReg = registrosSheet.getLastRow();
        if (lastRowReg >= 2) {
            const baseFullRange = registrosSheet.getRange(2, 9, lastRowReg - 1, 12); // I:T
            baseFullRange.sort({ column: 15, ascending: false }); // O = 15
        }
    }

    let msg = `Se migraron ${registrosToAppend.length} transacciones exitosamente.\n\n`;
    if (fallbackCounter > 0) {
        msg += `ATENCIÓN: Ciertas fechas (${fallbackCounter} registros) no encontraron cotización en el caché. Asegúrate de siempre hacer click en "[Dev] Forzar Carga Histórica TC" antes de migrar para nutrir la memoria caché al 100%.`;
    }
    ui.alert('Proceso Completo', msg, ui.ButtonSet.OK);
}
