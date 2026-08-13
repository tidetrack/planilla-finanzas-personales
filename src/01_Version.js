/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.8.3
 * @since 0.1.0
 * @lastModified 2026-08-12
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 9,
 patch: 8,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-08-13',
 releaseName: 'v0.9.8 - Respaldo de formulas como texto literal',

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
v0.8.3 (2026-08-12) - Gobernanza Fase 1 (arnes)
+ 00_Config.js: _resolverNombreHoja(alias) + invalidarCacheNombresHojas(); SHEETS.DATA_ENTRY/TIPOS_CAMBIO/BD_ANTIGUA como getters con alias.
+ SHEETS.MIRADA_INTERANUAL y SHEETS.DEBUG_MIRADA; 07_MiradaInteranual.js deja de hardcodear nombres de hoja.
* MENU_CONFIG sin emojis; RANGES TC_* con sheet como getter (resolucion perezosa).

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
