/**
 * 03_SheetManager.js
 * Gestor de acceso a datos sobre las hojas del sistema
 * Abstraccion de operaciones CRUD sobre rangos fijos
 *
 * [CONCEPTO DE NEGOCIO]
 * Capa unica de acceso a datos del sistema. Ningun servicio lee o escribe rangos de Sheets
 * directamente: siempre delega en estas funciones, que resuelven coordenadas desde RANGES.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Tras la migracion 2026-06-22 las hojas tienen layouts heterogeneos: cada entrada de RANGES
 * declara su propio dataRow. getTableRange() y appendRow() leen config.dataRow con fallback a
 * DATA_START_ROW para mantener compatibilidad con llamadas existentes (Plan de Cuentas, etc.).
 *
 * @see 00_Config.js (RANGES, DATA_START_ROW)
 *
 * @version 0.9.4
 * @since 0.1.0
 * @lastModified 2026-06-22
 */

// [AGILE-VALOR] Gestor de BD centralizado basado en ranges dinamicos desde Config. Complejidad minima.

// ============================================
// ACCESO A HOJA
// ============================================

/**
 * Obtiene la hoja especificada por el nombre
 * @param {string} sheetName Nombre de la hoja de cálculo
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 * @throws {Error} Si la hoja no existe
 */
function getSheet(sheetName) {
 const ss = SpreadsheetApp.getActiveSpreadsheet();
 const sheet = ss.getSheetByName(sheetName);

 if (!sheet) {
 throw new Error(`Hoja ${sheetName} no encontrada`);
 }

 return sheet;
}

// ============================================
// OPERACIONES DE LECTURA
// ============================================

/**
 * Obtiene el rango completo de una tabla
 * @param {string} tableName Nombre de la tabla (ej: 'MONEDAS')
 * @returns {GoogleAppsScript.Spreadsheet.Range} Rango de la tabla
 */
function getTableRange(tableName) {
    const config = RANGES[tableName];

    if (!config) {
        throw new Error('Tabla no configurada: ' + tableName);
    }

    const sheet = getSheet(config.sheet);
    const lastRow = sheet.getLastRow();

    // Cada tabla declara su propia fila de inicio de datos; fallback al global para
    // compatibilidad con cualquier tabla que no tenga dataRow explicito.
    const dataStart = config.dataRow || DATA_START_ROW;

    // Evitar errores si la hoja esta vacia al inicio
    const maxRow = lastRow < dataStart ? dataStart : lastRow;

    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;
    const numRows = maxRow - dataStart + 1;

    return sheet.getRange(dataStart, startColIdx, numRows, numCols);
}

/**
 * Obtiene los datos de una tabla como array de arrays
 * @param {string} tableName Nombre de la tabla
 * @returns {Array<Array>} Datos de la tabla
 */
function getTableData(tableName) {
 const range = getTableRange(tableName);
 const values = range.getValues();

 // Filtrar filas vacías (todas las celdas vacías)
 return values.filter(row => row.some(cell => cell !== ''));
}

/**
 * Cuenta el número de filas con datos en una tabla
 * @param {string} tableName Nombre de la tabla
 * @returns {number} Cantidad de filas
 */
function countTableRows(tableName) {
 const data = getTableData(tableName);
 return data.length;
}

// ============================================
// OPERACIONES DE ESCRITURA
// ============================================

/**
 * Agrega una fila al final de una tabla de forma optimizada
 * @param {string} tableName Nombre de la tabla
 * @param {Array} rowData Datos de la fila
 * @returns {number} Índice de la fila agregada
 */
function appendRow(tableName, rowData) {
    const config = RANGES[tableName];
    const sheet = getSheet(config.sheet);

    const dataStart = config.dataRow || DATA_START_ROW;
    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;

    // Buscar la ultima fila con datos usando la primera columna de la tabla especifica
    const lastSheetRow = sheet.getLastRow();
    var newRow = dataStart;

    if (lastSheetRow >= dataStart) {
        // Leer solo la primera columna de la tabla para ser eficiente
        const values = sheet.getRange(dataStart, startColIdx, lastSheetRow - dataStart + 1, 1).getValues();

        var lastDataIndex = -1;
        // Busqueda inversa (bottom-up): mas eficiente asumiendo filas vacias al fondo
        for (var i = values.length - 1; i >= 0; i--) {
            if (values[i][0] !== '') {
                lastDataIndex = i;
                break;
            }
        }
        newRow = lastDataIndex >= 0 ? dataStart + lastDataIndex + 1 : dataStart;
    }

    const range = sheet.getRange(newRow, startColIdx, 1, numCols);

    // Asegurarse de que rowData tenga el largo exacto de columnas para el setValues
    const paddedRowData = rowData.slice();
    while (paddedRowData.length < numCols) {
        paddedRowData.push('');
    }

    range.setValues([paddedRowData]);
    logSuccess('Fila agregada a ' + tableName + ' en fila ' + newRow);

    return newRow;
}

/**
 * Actualiza una fila existente
 * @param {string} tableName Nombre de la tabla
 * @param {number} rowIndex Índice de fila (relativo a DATA_START_ROW)
 * @param {Array} rowData Nuevos datos
 */
function updateRow(tableName, rowIndex, rowData) {
    const config = RANGES[tableName];
    const sheet = getSheet(config.sheet);
    const dataStart = config.dataRow || DATA_START_ROW;
    const actualRow = dataStart + rowIndex;

    const range = sheet.getRange(config.start + actualRow + ':' + config.end + actualRow);

    range.setValues([rowData]);
    logSuccess('Fila ' + rowIndex + ' actualizada en ' + tableName);
}

/**
 * Elimina una fila restringida a su tabla (splice + rewrite) para no afectar columnas vecinas
 * @param {string} tableName Nombre de la tabla
 * @param {number} rowIndex Índice de fila (relativo a DATA_START_ROW)
 */
function deleteRow(tableName, rowIndex) {
    const data = getTableData(tableName);
    if (rowIndex < 0 || rowIndex >= data.length) return;

    // Quitar la fila especifica
    data.splice(rowIndex, 1);

    const config = RANGES[tableName];
    const sheet = getSheet(config.sheet);
    const dataStart = config.dataRow || DATA_START_ROW;
    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;

    // Obtener todo el rango actual para limpiarlo primero
    const maxRow = sheet.getLastRow();
    const rowsToClear = maxRow >= dataStart ? (maxRow - dataStart + 1) : 1;
    sheet.getRange(dataStart, startColIdx, rowsToClear, numCols).clearContent();

    // Reescribir la tabla si quedaron datos
    if (data.length > 0) {
        const paddedData = data.map(function(row) {
            const arr = row.slice();
            while (arr.length < numCols) arr.push('');
            return arr;
        });
        sheet.getRange(dataStart, startColIdx, paddedData.length, numCols).setValues(paddedData);
    }

    logSuccess('Registro ' + rowIndex + ' eliminado aisladamente de ' + tableName);
}


// ============================================
// UTILIDADES DE COLUMNAS
// ============================================

/**
 * Obtiene el índice numérico de una columna desde letra
 * @param {string} columnLetter Letra de columna (ej: 'B', 'AD')
 * @returns {number} Índice 1-based
 */
function columnLetterToIndex(columnLetter) {
 let index = 0;
 for (let i = 0; i < columnLetter.length; i++) {
 index = index * 26 + (columnLetter.charCodeAt(i) - 64);
 }
 return index;
}

