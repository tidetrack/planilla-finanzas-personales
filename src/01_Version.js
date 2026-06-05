/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 * 
 * @version 0.8.0
 * @since 0.1.0
 * @lastModified 2026-06-05
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 8,
 patch: 0,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-03-23',
 releaseName: 'v0.8.0 - Herramientas de Escrutinio Arquitectónico',

 /**
 * Changelog embebido (solo refleja el release vigente).
 * FUENTE DE VERDAD del historial completo: src/ZZ_Changelog.js
 * Formato: Semantic Versioning
 * + Agregado
 * * Mejorado
 * - Corregido
 * ! Breaking change
 */
 changelog: `
v0.8.0 (2026-03-23) - Herramientas de Escrutinio Arquitectónico
+ Módulo DevTools (98_DevTools_Scanner.js): exporta el 100% de la arquitectura a un snapshot JSON.
+ Custom Functions de cotización en tiempo real (TIDETRACK_USD/EUR/AUD).
* Permisos de Drive actualizados en appsscript.json.

Historial completo y canónico en: src/ZZ_Changelog.js
 `
};

/**
 * Obtiene la versión actual del sistema
 * @returns {string} Versión formateada
 */
function getVersion() {
 return VERSION.toString();
}

/**
 * Obtiene el changelog completo
 * @returns {string} Historial de cambios
 */
function getChangelog() {
 return VERSION.changelog;
}

/**
 * Muestra información de versión en log
 */
function logVersionInfo() {
 Logger.log('='.repeat(50));
 Logger.log('Tidetrack Personal Finance - Apps Script');
 Logger.log(`Versión: ${getVersion()}`);
 Logger.log(`Release: ${VERSION.releaseName}`);
 Logger.log(`Fecha: ${VERSION.releaseDate}`);
 Logger.log('='.repeat(50));
}
