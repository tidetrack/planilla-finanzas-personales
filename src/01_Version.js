/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 * 
 * @version 0.9.2
 * @since 0.1.0
 * @lastModified 2026-06-21
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 9,
 patch: 2,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-06-21',
 releaseName: 'v0.9.2 - Procesamiento resiliente de cargas',

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
v0.9.2 (2026-06-21) - Procesamiento resiliente de cargas
* procesarCargas() ya no aborta el lote por filas incompletas: procesa las válidas, saltea las incompletas (quedan en la grilla) y las reporta.
* Solo se limpian de la grilla las filas efectivamente procesadas.
- Fix: el sort de Registros lanzaba error ante celdas combinadas y frenaba todo. Ahora es best-effort (try/catch): si falla, los registros igual se guardan.

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
