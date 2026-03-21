/**
 * 06_RegistrosService.js
 * Servicio para procesar el lote de Cargas, enriquecerlo y apendear en Registros.
 */

/**
 * Función maestra invocada desde el menú [Dev] o botón.
 */
function procesarCargas() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cargasSheet = ss.getSheetByName(NAV_CONFIG.SHEETS.CARGAS);
    const registrosSheet = ss.getSheetByName(SHEETS.REGISTROS);
    
    if (!cargasSheet || !registrosSheet) {
        SpreadsheetApp.getUi().alert('Faltan configurar las hojas Cargas o Registros.');
        return;
    }

    // 1. Leer I5:O19
    const cargasRange = cargasSheet.getRange('I5:O19');
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
    const ingresosCat = getTableData('INGRESOS').map(r => r[0]);
    const fijosCat = getTableData('GASTOS_FIJOS').map(r => r[0]);
    const variablesCat = getTableData('GASTOS_VARIABLES').map(r => r[0]);

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

            // Deducir Tipo de Cuenta (Ingreso, Gasto Fijo, Gasto Variable)
            let tipoCuenta = '';
            const cuentaName = row[2];
            if (ingresosCat.includes(cuentaName)) tipoCuenta = 'Ingreso';
            else if (fijosCat.includes(cuentaName)) tipoCuenta = 'Gasto Fijo';
            else if (variablesCat.includes(cuentaName)) tipoCuenta = 'Gasto Variable';

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

        // 3. Escribir nuevos TCs a la hoja "Tipos de Cambio"
        if (newTcUsdToAppend.length > 0) appendMassive('TC_USD', newTcUsdToAppend, 4);
        if (newTcAudToAppend.length > 0) appendMassive('TC_AUD', newTcAudToAppend, 4);
        if (newTcEurToAppend.length > 0) appendMassive('TC_EUR', newTcEurToAppend, 4);

        // 4. Escribir los registros en la BD Registros (Debajo del encabezado en Fila 1)
        appendMassive('REGISTROS', registrosToAppend, 2);

        // 5. Ordenar la Hoja Registros por la columna O (Fecha = índice absoluto 15)
        const lastRowReg = registrosSheet.getLastRow();
        if (lastRowReg >= 2) {
            // El rango base empieza en I (col 9) a T (col 20) = 12 columnas
            const baseFullRange = registrosSheet.getRange(2, 9, lastRowReg - 1, 12);
            // Ordenar descendentemente por la columna de fecha. En absolute es la col 15.
            baseFullRange.sort({ column: 15, ascending: false });
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
 * @param {string} tableName Identificador en RANGES
 * @param {Array} data2D Matriz
 * @param {number} minRow Fila en la que inicia la data (2 para Registros, 4 para Catalogos TCs)
 */
function appendMassive(tableName, data2D, minRow = DATA_START_ROW) {
    if (data2D.length === 0) return;
    const config = RANGES[tableName];
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

    const range = sheet.getRange(targetRow, startColIdx, paddedData.length, numCols);
    range.setValues(paddedData);

    // [ALGORITMO AUTOMÁTICO] Si la inserción es de Tipos de Cambio, ordenarla temporalmente Z-A in situ
    if (tableName.startsWith('TC_') && sheet.getName() === SHEETS.TIPOS_CAMBIO) {
        const globalLast = sheet.getLastRow();
        if (globalLast >= minRow) {
            // Buscamos exacto el fondo de esta columna particular (porque las 4 tablas pueden tener distintos largos)
            const colVector = sheet.getRange(minRow, startColIdx, globalLast - minRow + 1, 1).getValues();
            let lastRealRow = minRow - 1;
            for (let i = colVector.length - 1; i >= 0; i--) {
                if (colVector[i][0] !== '') {
                    lastRealRow = minRow + i;
                    break;
                }
            }
            if (lastRealRow >= minRow) {
                const tableRange = sheet.getRange(minRow, startColIdx, lastRealRow - minRow + 1, numCols);
                tableRange.sort({ column: startColIdx, ascending: false }); // Sort x fecha Z-A
            }
        }
    }
}
