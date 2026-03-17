/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 * 
 * @version 0.1.0
 * @since 0.1.0
 * @lastModified 2026-01-17
 */

const VERSION = {
    major: 0,
    minor: 1,
    patch: 0,

    /**
     * Retorna la versión como string
     * @returns {string} Versión en formato X.Y.Z
     */
    toString: function () {
        return `${this.major}.${this.minor}.${this.patch}`;
    },

    releaseDate: '2026-01-17',
    releaseName: 'Sprint 0 - Core Setup',

    /**
     * Changelog embebido
     * Formato: Semantic Versioning
     * + Agregado
     * * Mejorado
     * - Corregido
     * ! Breaking change
     */
    changelog: `
v0.1.0 (2026-01-17) - Sprint 0: Core Setup
+ Configuración global (00_Config.js)
+ Sistema de versionado (01_Version.js)
+ Utilidades generales (02_Utils.js)
+ Gestor de hojas  (03_SheetManager.js)
+ Validaciones de schema (04_DataValidation.js)
+ Servicio de monedas (05_MonedaService.js)
+ Manifest OAuth (appsscript.json)

Próximo Sprint: v0.2.0 - Tipos de Cambio
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
