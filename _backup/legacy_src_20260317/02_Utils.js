/**
 * 02_Utils.js
 * Utilidades generales del sistema Tidetrack
 * Funciones helper transversales
 * 
 * @version 0.1.0
 * @since 0.1.0
 * @lastModified 2026-01-17
 */

// [AGILE-VALOR] Funciones utilitarias transversales necesarias para la base de datos centralizada.

// ============================================
// GENERACIÓN DE IDs
// ============================================

/**
 * Genera un ID único basado en timestamp + random/**
 * Genera un ID único timestamp-based
 * @returns {string} ID en formato YYYYMMDDHHMMSS-RAND
 */
function generateId() {
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${timestamp}-${random}`;
}

/**
 * Genera el próximo ID secuencial para una tabla (SKU)
 * @param {string} tableName Nombre de la tabla
 * @param {string} prefix Prefijo del SKU (ej: 'MON', 'MED')
 * @param {number} padding Cantidad de dígitos (default: 3)
 * @returns {string} Próximo ID (ej: 'MON-004')
 */
function generateNextId(tableName, prefix, padding = 3) {
    try {
        // Obtener datos de la tabla
        const data = getTableData(tableName);

        if (data.length === 0) {
            // Primera entrada
            const firstNumber = '0'.repeat(padding - 1) + '1';
            return `${prefix}-${firstNumber}`;
        }

        // Obtener todos los IDs existentes
        const colIndexes = getColumnIndexes(tableName);
        const idColumnIndex = 0; // Primera columna siempre es el ID

        let maxNumber = 0;

        data.forEach(row => {
            const id = row[idColumnIndex];
            if (id && id.toString().startsWith(prefix)) {
                // Extraer número del SKU (ej: 'MON-003' -> 3)
                const parts = id.toString().split('-');
                if (parts.length === 2) {
                    const number = parseInt(parts[1], 10);
                    if (!isNaN(number) && number > maxNumber) {
                        maxNumber = number;
                    }
                }
            }
        });

        // Siguiente número
        const nextNumber = maxNumber + 1;
        const paddedNumber = nextNumber.toString().padStart(padding, '0');

        return `${prefix}-${paddedNumber}`;
    } catch (e) {
        logError('Error en generateNextId', {
            tableName,
            prefix,
            error: e.toString()
        });
        // Fallback: timestamp-based
        return `${prefix}-${Date.now()}`;
    }
}

/**
 * Genera un ID simple numérico secuencial
 * Útil para monedas y catálogos pequeños
 * @param {string} prefix Prefijo opcional (ej: 'MON', 'MED')
 * @param {number} counter Contador numérico
 * @returns {string} ID formateado
 */
function generateSimpleId(prefix, counter) {
    if (prefix) {
        return `${prefix}${counter.toString().padStart(3, '0')}`;
    }
    return counter.toString();
}

// ============================================
// FECHA Y HORA
// ============================================

/**
 * Obtiene timestamp actual en formato ISO
 * @returns {string} Timestamp ISO 8601
 */
function getCurrentTimestamp() {
    const now = new Date();
    return Utilities.formatDate(now, DEFAULTS.timezone, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Obtiene fecha actual (sin hora)
 * @returns {Date} Fecha actual
 */
function getCurrentDate() {
    return new Date();
}

/**
 * Formatea fecha para visualización
 * @param {Date} date Fecha a formatear
 * @param {string} format Formato (default: 'dd/MM/yyyy')
 * @returns {string} Fecha formateada
 */
function formatDate(date, format = 'dd/MM/yyyy') {
    if (!date) return '';
    return Utilities.formatDate(date, DEFAULTS.timezone, format);
}

// ============================================
// VALIDACIÓN DE ENUMS
// ============================================

/**
 * Valida si un valor pertenece a un enum
 * @param {*} value Valor a validar
 * @param {Array} enumArray Array de valores permitidos
 * @param {string} fieldName Nombre del campo (para error)
 * @returns {boolean} true si es válido
 * @throws {Error} Si el valor no está en el enum
 */
function validateEnum(value, enumArray, fieldName) {
    if (!enumArray.includes(value)) {
        throw new Error(
            `${ERROR_MESSAGES.INVALID_ENUM}${fieldName}. ` +
            `Valores permitidos: [${enumArray.join(', ')}]. ` +
            `Valor recibido: "${value}"`
        );
    }
    return true;
}

// ============================================
// LOGGING Y NOTIFICACIONES
// ============================================

/**
 * Log de error centralizado
 * @param {string} message Mensaje de error
 * @param {Object} context Contexto adicional
 */
function logError(message, context = {}) {
    Logger.log('❌ ERROR: ' + message);
    if (Object.keys(context).length > 0) {
        Logger.log('Contexto: ' + JSON.stringify(context, null, 2));
    }
}

/**
 * Log de información
 * @param {string} message Mensaje informativo
 */
function logInfo(message) {
    Logger.log('ℹ️  INFO: ' + message);
}

/**
 * Log de éxito
 * @param {string} message Mensaje de éxito
 */
function logSuccess(message) {
    Logger.log('✅ SUCCESS: ' + message);
}

/**
 * Muestra notificación toast al usuario
 * @param {string} message Mensaje a mostrar
 * @param {string} title Título de la notificación
 * @param {number} duration Duración en segundos (default: 3)
 */
function showToast(message, title = 'Tidetrack', duration = 3) {
    try {
        SpreadsheetApp.getActiveSpreadsheet().toast(message, title, duration);
    } catch (e) {
        logError('No se pudo mostrar toast', { message, error: e.toString() });
    }
}

/**
 * Muestra alerta al usuario
 * @param {string} message Mensaje de alerta
 * @param {string} title Título de la alerta
 */
function showAlert(message, title = 'Atención') {
    try {
        SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        logError('No se pudo mostrar alerta', { message, error: e.toString() });
    }
}

// ============================================
// UTILIDADES DE DATOS
// ============================================

/**
 * Verifica si un valor está vacío (null, undefined, '')
 * @param {*} value Valor a verificar
 * @returns {boolean} true si está vacío
 */
function isEmpty(value) {
    return value === null || value === undefined || value === '';
}

/**
 * Convierte un array de objetos a array de arrays (para Sheets)
 * @param {Array<Object>} objects Array de objetos
 * @param {Array<string>} keys Orden de las keys
 * @returns {Array<Array>} Array de arrays
 */
function objectsToArrays(objects, keys) {
    return objects.map(obj => keys.map(key => obj[key] !== undefined ? obj[key] : ''));
}

/**
 * Convierte un array de arrays a array de objetos
 * @param {Array<Array>} arrays Array de arrays
 * @param {Array<string>} keys Nombres de las keys
 * @returns {Array<Object>} Array de objetos
 */
function arraysToObjects(arrays, keys) {
    return arrays.map(row => {
        const obj = {};
        keys.forEach((key, index) => {
            obj[key] = row[index];
        });
        return obj;
    });
}

/**
 * Encuentra índice de un elemento por ID
 * @param {Array} array Array donde buscar
 * @param {*} id ID a buscar
 * @param {string} idKey Nombre de la key del ID (default: 'id')
 * @returns {number} Índice (-1 si no se encuentra)
 */
function findIndexById(array, id, idKey = 'id') {
    return array.findIndex(item => item[idKey] === id);
}

// ============================================
// UTILIDADES DE VALIDACIÓN
// ============================================

/**
 * Valida que un número sea positivo
 * @param {number} value Valor a validar
 * @param {string} fieldName Nombre del campo
 * @returns {boolean} true si es válido
 * @throws {Error} Si no es positivo
 */
function validatePositive(value, fieldName) {
    if (typeof value !== 'number' || value <= 0) {
        throw new Error(`${fieldName} debe ser un número mayor a 0. Valor: ${value}`);
    }
    return true;
}

/**
 * Valida que un campo no esté vacío
 * @param {*} value Valor a validar
 * @param {string} fieldName Nombre del campo
 * @returns {boolean} true si es válido
 * @throws {Error} Si está vacío
 */
function validateRequired(value, fieldName) {
    if (isEmpty(value)) {
        throw new Error(`${ERROR_MESSAGES.REQUIRED_FIELD}${fieldName}`);
    }
    return true;
}
