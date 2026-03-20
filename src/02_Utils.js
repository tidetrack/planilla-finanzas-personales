/**
 * 02_Utils.js
 * Utilidades generales del sistema Tidetrack
 * Funciones helper transversales
 *
 * @version 0.4.0
 * @since 0.1.0
 * @lastModified 2026-03-20
 */

// [AGILE-VALOR] Funciones utilitarias transversales necesarias para logging.

// ============================================
// LOGGING Y NOTIFICACIONES
// ============================================

/**
 * Log de error centralizado
 * @param {string} message Mensaje de error
 * @param {Object} context Contexto adicional
 */
function logError(message, context = {}) {
 Logger.log(' ERROR: ' + message);
 if (Object.keys(context).length > 0) {
 Logger.log('Contexto: ' + JSON.stringify(context, null, 2));
 }
}

/**
 * Log de información
 * @param {string} message Mensaje informativo
 */
function logInfo(message) {
 Logger.log('️ INFO: ' + message);
}

/**
 * Log de éxito
 * @param {string} message Mensaje de éxito
 */
function logSuccess(message) {
 Logger.log(' SUCCESS: ' + message);
}
