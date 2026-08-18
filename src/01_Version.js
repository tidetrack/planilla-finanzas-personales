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
 minor: 11,
 patch: 0,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-08-18',
 releaseName: 'v0.11.0 - Swap de hojas Fix (el rediseno pasa a ser canonico)',

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
v0.11.0 (2026-08-18) - Swap de hojas Fix
+ MIGRACION_v0.11_SwapHojasFix.js: estado / sincronizar BDs / aplicar / revertir / purgar.
! 00_Config.js remapeado a la geometria Fix (Plan C:D-F:G-I:J-L:N-P:Q h7 d8, Cargas C7:I21, Registros h6 d7, TC C:D-F:G-I:J-L:M h7 d8).
! HEADER_ROW/DATA_START_ROW globales 3/4 -> 7/8. Canonico de TC pasa a 'Tipos de Cambio'.
- Menu: sale la Migracion v0.9.5 (incoherente con el config nuevo); entra el swap v0.11.

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
