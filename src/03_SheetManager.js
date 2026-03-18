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
    const range = `${config.start}${DATA_START_ROW}:${config.end}${lastRow}`;

    return sheet.getRange(range);
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
 * Agrega una fila al final de una tabla
 * @param {string} tableName Nombre de la tabla
 * @param {Array} rowData Datos de la fila
 * @returns {number} Índice de la fila agregada
 */
function appendRow(tableName, rowData) {
    const config = RANGES[tableName];
    const sheet = getSheet(config.sheet);

    // CRÍTICO: Obtener la última fila con datos EN LAS COLUMNAS DE ESTA TABLA
    // NO usar sheet.getLastRow() que devuelve la última fila de TODA la hoja
    const startCol = columnLetterToIndex(config.start);
    const endCol = columnLetterToIndex(config.end);

    // Buscar la última fila con datos en el rango de columnas de esta tabla
    let lastRowWithData = HEADER_ROW;

    // Leer todas las filas desde DATA_START_ROW hacia abajo en la primera columna de la tabla
    const firstColumn = sheet.getRange(config.start + DATA_START_ROW + ':' + config.start + '1000');
    const values = firstColumn.getValues();

    for (let i = 0; i < values.length; i++) {
        if (values[i][0] !== '') {
            lastRowWithData = DATA_START_ROW + i;
        }
    }

    const newRow = lastRowWithData === HEADER_ROW ? DATA_START_ROW : lastRowWithData + 1;

    const range = sheet.getRange(
        `${config.start}${newRow}:${config.end}${newRow}`
    );

    range.setValues([rowData]);
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
 * Elimina una fila
 * @param {string} tableName Nombre de la tabla
 * @param {number} rowIndex Índice de fila (relativo a DATA_START_ROW)
 */
function deleteRow(tableName, rowIndex) {
    const config = RANGES[tableName];
    const sheet = getSheet(config.sheet);
    const actualRow = DATA_START_ROW + rowIndex;

    sheet.deleteRow(actualRow);
    logSuccess(`Fila ${rowIndex} eliminada de ${tableName}`);
}

// ============================================
// BÚSQUEDA
// ============================================

/**
 * Encuentra una fila por ID
 * @param {string} tableName Nombre de la tabla
 * @param {*} id ID a buscar
 * @param {number} idColumnIndex Índice de columna del ID (0-based)
 * @returns {Object|null} {rowIndex, rowData} o null si no se encuentra
 */
function findById(tableName, id, idColumnIndex = 0) {
    const data = getTableData(tableName);

    for (let i = 0; i < data.length; i++) {
        if (data[i][idColumnIndex] === id) {
            return {
                rowIndex: i,
                rowData: data[i]
            };
        }
    }

    return null;
}

/**
 * Verifica si existe un ID en una tabla
 * @param {string} tableName Nombre de la tabla
 * @param {*} id ID a verificar
 * @param {number} idColumnIndex Índice de columna del ID
 * @returns {boolean} true si existe
 */
function existsById(tableName, id, idColumnIndex = 0) {
    return findById(tableName, id, idColumnIndex) !== null;
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

/**
 * Obtiene índices relativos de columnas para una tabla
 * @param {string} tableName Nombre de la tabla
 * @returns {Object} Mapa de nombre_campo → índice relativo (0-based)
 */
function getColumnIndexes(tableName) {
    const config = RANGES[tableName];
    const startIndex = columnLetterToIndex(config.start);
    const indexes = {};

    Object.keys(config.columns).forEach(fieldName => {
        const colLetter = config.columns[fieldName];
        const colIndex = columnLetterToIndex(colLetter);
        indexes[fieldName] = colIndex - startIndex;
    });

    return indexes;
}
