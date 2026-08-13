/**
 * 03_SheetManager.js
 * Gestor de acceso a hoja DATA-ENTRY
 * Abstracción de operaciones CRUD sobre rangos fijos
 * 
 * @version 0.1.0
 * @since 0.1.0
 * @lastModified 2026-01-17
 */

// [AGILE-VALOR] Gestor de BD centralizado basado en ranges dinámicos desde Config. Complejidad mínima.

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
 throw new Error(`Tabla no configurada: ${tableName}`);
 }

 const sheet = getSheet(config.sheet);
 const lastRow = sheet.getLastRow();
 
 // Evitar errores si la hoja está vacía al inicio
 const maxRow = lastRow < DATA_START_ROW ? DATA_START_ROW : lastRow;
 
 const startColIdx = columnLetterToIndex(config.start);
 const endColIdx = columnLetterToIndex(config.end);
 const numCols = endColIdx - startColIdx + 1;
 const numRows = maxRow - DATA_START_ROW + 1;

 return sheet.getRange(DATA_START_ROW, startColIdx, numRows, numCols);
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

 const startColIdx = columnLetterToIndex(config.start);
 const endColIdx = columnLetterToIndex(config.end);
 const numCols = endColIdx - startColIdx + 1;

 // Buscar la última fila con datos usando la primera columna de la tabla específica
 const lastSheetRow = sheet.getLastRow();
 let newRow = DATA_START_ROW;
 
 if (lastSheetRow >= DATA_START_ROW) {
 // Leer רק la primera columna de la tabla para ser hiper-rápido
 const values = sheet.getRange(DATA_START_ROW, startColIdx, lastSheetRow - DATA_START_ROW + 1, 1).getValues();
 
 let lastDataIndex = -1;
 // Búsqueda inversa (bottom-up) es más eficiente asumiendo que las filas vacías están al fondo
 for (let i = values.length - 1; i >= 0; i--) {
 if (values[i][0] !== '') {
 lastDataIndex = i;
 break;
 }
 }
 newRow = lastDataIndex >= 0 ? DATA_START_ROW + lastDataIndex + 1 : DATA_START_ROW;
 }

 const range = sheet.getRange(newRow, startColIdx, 1, numCols);
 
 // Asegurarse de que rowData tenga el largo exacto de columnas para el setValues
 const paddedRowData = [...rowData];
 while(paddedRowData.length < numCols) {
 paddedRowData.push('');
 }

 range.setValues([paddedRowData]);
 logSuccess(`Fila agregada a ${tableName} en fila ${newRow}`);

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
 const actualRow = DATA_START_ROW + rowIndex;

 const range = sheet.getRange(
 `${config.start}${actualRow}:${config.end}${actualRow}`
 );

 range.setValues([rowData]);
 logSuccess(`Fila ${rowIndex} actualizada en ${tableName}`);
}

/**
 * Elimina una fila restringida a su tabla (splice + rewrite) para no afectar columnas vecinas
 * @param {string} tableName Nombre de la tabla
 * @param {number} rowIndex Índice de fila (relativo a DATA_START_ROW)
 */
function deleteRow(tableName, rowIndex) {
 const data = getTableData(tableName);
 if (rowIndex < 0 || rowIndex >= data.length) return;
 
 // Quitar la fila específica
 data.splice(rowIndex, 1);
 
 const config = RANGES[tableName];
 const sheet = getSheet(config.sheet);
 const startColIdx = columnLetterToIndex(config.start);
 const endColIdx = columnLetterToIndex(config.end);
 const numCols = endColIdx - startColIdx + 1;
 
 // Obtener todo el rango actual para limpiarlo primero
 const maxRow = sheet.getLastRow();
 const rowsToClear = maxRow >= DATA_START_ROW ? (maxRow - DATA_START_ROW + 1) : 1;
 sheet.getRange(DATA_START_ROW, startColIdx, rowsToClear, numCols).clearContent();
 
 // Reescribir la tabla si quedaron datos
 if (data.length > 0) {
 const paddedData = data.map(row => {
 const arr = [...row];
 while (arr.length < numCols) arr.push('');
 return arr;
 });
 sheet.getRange(DATA_START_ROW, startColIdx, paddedData.length, numCols).setValues(paddedData);
 }
 
 logSuccess(`Registro ${rowIndex} eliminado aislamientamente de ${tableName}`);
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

