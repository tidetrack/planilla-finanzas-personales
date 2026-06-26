/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * [CONCEPTO DE NEGOCIO] Fuente de verdad de la version semantica del sistema.
 * Permite a cualquier agente, script o usuario verificar la version activa sin
 * leer el changelog completo. Garantiza trazabilidad ante incidentes en produccion.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO] Semantic Versioning (semver.org):
 * MAJOR.MINOR.PATCH. Feature = incremento MINOR. Bug fix = incremento PATCH.
 * Breaking change = incremento MAJOR.
 *
 * @version 0.9.4
 * @since 0.1.0
 * @lastModified 2026-06-22
 * @see src/ZZ_Changelog.js - historial completo canonico
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 9,
 patch: 4,

 /**
 * Retorna la version como string
 * @returns {string} Version en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-06-22',
 releaseName: 'v0.9.4 - Reconciliacion al layout de produccion nuevo (Registros B:M, TC bloques B/E/H/K)',

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
v0.9.4 (2026-06-22) - Reconciliacion al layout de produccion nuevo
* 00_Config.js: RANGES actualizado al layout nuevo. Registros ahora en B:M (headerRow=5,
  dataRow=6). TC con bloques B:C/E:F/H:I/K:L (headerRow=5/6, dataRow=7). Cada entrada
  de RANGES ahora lleva headerRow y dataRow propios por tabla.
* 03_SheetManager.js: adaptado para leer headerRow/dataRow desde RANGES por tabla
  en lugar de las constantes globales HEADER_ROW/DATA_START_ROW.
* 06_RegistrosService.js: columna de sort de Registros actualizada a col H (fecha),
  appendMassive referenciado a bloques nuevos de TC.
+ 99_MigrationLogic.js: nueva funcion migrarLegacyANuevaProduccion() que copia datos
  desde Registros_legacy (I:T, headerFila2) y Tipos_de_cambio_legacy al layout nuevo.
  Nueva entrada de menu [Dev] "Migrar Legacy a Nueva Produccion".

Historial completo y canonico en: src/ZZ_Changelog.js
 `
};

/**
 * Obtiene la version actual del sistema
 * @returns {string} Version formateada
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
 * Muestra informacion de version en log
 */
function logVersionInfo() {
 Logger.log('='.repeat(50));
 Logger.log('Tidetrack Personal Finance - Apps Script');
 Logger.log(`Version: ${getVersion()}`);
 Logger.log(`Release: ${VERSION.releaseName}`);
 Logger.log(`Fecha: ${VERSION.releaseDate}`);
 Logger.log('='.repeat(50));
}
