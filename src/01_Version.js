/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 * 
 * @version 0.9.3
 * @since 0.1.0
 * @lastModified 2026-06-21
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 9,
 patch: 3,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-06-21',
 releaseName: 'v0.9.3 - Sort best-effort tambien en appendMassive (TC)',

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
v0.9.3 (2026-06-21) - Sort best-effort tambien en appendMassive
- Fix: el auto-sort interno de appendMassive (tablas TC en "Tipos de cambio") seguía lanzando el error de celdas combinadas y abortaba procesarCargas. Ahora también está en try/catch. Era el sort que 0.9.2 no había cubierto.

v0.9.2 (2026-06-21) - Procesamiento resiliente de cargas
* procesarCargas() ya no aborta el lote por filas incompletas: procesa las válidas, saltea las incompletas y las reporta.
- Sort de Registros (paso 7) ahora best-effort.

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
