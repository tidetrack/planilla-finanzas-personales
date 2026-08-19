/**
 * 03_SheetManager.js
 * Gestor de acceso a datos sobre las hojas del sistema
 * Abstracción de operaciones CRUD sobre rangos fijos
 *
 * [CONCEPTO DE NEGOCIO]
 * Capa unica de acceso a datos. Ningun servicio lee ni escribe rangos de Sheets
 * directamente: siempre delega aca, y las coordenadas salen de RANGES.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Las hojas de produccion tienen layouts heterogeneos (Plan de Cuentas sin migrar,
 * Registros y Tipos de cambio migradas). Cada entrada de RANGES puede declarar su
 * propio dataRow; estas funciones lo leen con fallback a DATA_START_ROW, que es el
 * default del Plan de Cuentas. Ademas se controla la capacidad fisica del grid antes
 * de escribir, porque la hoja "Tipos de cambio" quedo con muy pocas filas libres.
 *
 * @see 00_Config.js (RANGES, DATA_START_ROW, GRID_COLCHON_FILAS, GRID_MAX_FILAS)
 *
 * @version 0.9.5
 * @since 0.1.0
 * @lastModified 2026-08-13
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

/**
 * Devuelve la primera fila de datos de una tabla de RANGES.
 * Las tablas del Plan de Cuentas no declaran dataRow: caen al default global.
 *
 * @param {Object} config Entrada de RANGES
 * @returns {number} Fila 1-based donde arrancan los datos
 */
function getDataRow(config) {
    return (config && config.dataRow) ? config.dataRow : DATA_START_ROW;
}

// ============================================
// CAPACIDAD DEL GRID
// ============================================

// decision Franco 2026-08-13: ante grid insuficiente se amplia, no se aborta (ver 00_Config.js).
/**
 * Garantiza que la hoja tenga al menos `filaFinal` filas fisicas de grid.
 *
 * Existe porque tras la migracion la hoja "Tipos de cambio" quedo con 41 filas fisicas
 * (datos 7:35, seis libres): cualquier escritura masiva de cotizaciones -- backfill o
 * forzarCargaHistorica -- excede el grid y Sheets lanza "out of bounds" DESPUES de haber
 * borrado el contenido previo. Por eso esta verificacion se llama ANTES de la primera
 * escritura o limpieza de un lote: o hay lugar para todo el lote, o no se toca nada.
 *
 * La ampliacion se hace al pie del grid (insertRowsAfter sobre la ultima fila fisica), que
 * no desplaza datos, formulas ni formatos existentes.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet Hoja destino
 * @param {number} filaFinal Ultima fila 1-based que se va a escribir
 * @returns {number} Cantidad de filas agregadas (0 si ya habia lugar)
 * @throws {Error} Si ampliar superaria GRID_MAX_FILAS
 */
function asegurarCapacidadFilas(sheet, filaFinal) {
    const maxRows = sheet.getMaxRows();
    if (filaFinal <= maxRows) return 0;

    const faltantes = filaFinal - maxRows;
    const aInsertar = faltantes + GRID_COLCHON_FILAS;

    if (maxRows + aInsertar > GRID_MAX_FILAS) {
        throw new Error(
            'La hoja "' + sheet.getName() + '" necesita llegar a la fila ' + filaFinal +
            ' pero ampliarla superaria el tope de seguridad de ' + GRID_MAX_FILAS +
            ' filas (actual: ' + maxRows + '). No se escribio nada.'
        );
    }

    sheet.insertRowsAfter(maxRows, aInsertar);
    logInfo('asegurarCapacidadFilas: "' + sheet.getName() + '" ampliada de ' + maxRows +
            ' a ' + (maxRows + aInsertar) + ' filas (se necesitaba hasta la ' + filaFinal + ').');
    return aInsertar;
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

    // Cada tabla declara su propia fila de datos; el Plan de Cuentas cae al default global.
    const dataStart = getDataRow(config);

    // Evitar errores si la hoja está vacía al inicio
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

    const dataStart = getDataRow(config);
    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;

    // Buscar la última fila con datos usando la primera columna de la tabla específica
    const lastSheetRow = sheet.getLastRow();
    let newRow = dataStart;

    if (lastSheetRow >= dataStart) {
        // Leer solo la primera columna de la tabla para ser hiper-rápido
        const values = sheet.getRange(dataStart, startColIdx, lastSheetRow - dataStart + 1, 1).getValues();

        let lastDataIndex = -1;
        // Búsqueda inversa (bottom-up) es más eficiente asumiendo que las filas vacías están al fondo
        for (let i = values.length - 1; i >= 0; i--) {
            if (values[i][0] !== '') {
                lastDataIndex = i;
                break;
            }
        }
        newRow = lastDataIndex >= 0 ? dataStart + lastDataIndex + 1 : dataStart;
    }

    // El grid puede estar agotado (caso Tipos de cambio): ampliar antes de escribir.
    asegurarCapacidadFilas(sheet, newRow);

    const range = sheet.getRange(newRow, startColIdx, 1, numCols);

    // Asegurarse de que rowData tenga el largo exacto de columnas para el setValues
    const paddedRowData = [...rowData];
    while (paddedRowData.length < numCols) {
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
    const actualRow = getDataRow(config) + rowIndex;

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
    const dataStart = getDataRow(config);
    const startColIdx = columnLetterToIndex(config.start);
    const endColIdx = columnLetterToIndex(config.end);
    const numCols = endColIdx - startColIdx + 1;

    // Obtener todo el rango actual para limpiarlo primero
    const maxRow = sheet.getLastRow();
    const rowsToClear = maxRow >= dataStart ? (maxRow - dataStart + 1) : 1;
    sheet.getRange(dataStart, startColIdx, rowsToClear, numCols).clearContent();

    // Reescribir la tabla si quedaron datos
    if (data.length > 0) {
        const paddedData = data.map(row => {
            const arr = [...row];
            while (arr.length < numCols) arr.push('');
            return arr;
        });
        sheet.getRange(dataStart, startColIdx, paddedData.length, numCols).setValues(paddedData);
    }

    logSuccess(`Registro ${rowIndex} eliminado aisladamente de ${tableName}`);
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
 * Obtiene la letra de columna desde un índice numérico (inverso de columnLetterToIndex)
 * @param {number} index Índice 1-based (ej: 2 -> 'B', 36 -> 'AJ')
 * @returns {string} Letra de columna
 */
function columnIndexToLetter(index) {
 let letra = '';
 let n = index;
 while (n > 0) {
 const resto = (n - 1) % 26;
 letra = String.fromCharCode(65 + resto) + letra;
 n = Math.floor((n - 1) / 26);
 }
 return letra;
}
