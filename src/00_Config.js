/**
 * 00_Config.js
 * Configuración global del sistema Tidetrack
 * Define constantes, rangos de columnas, y enums
 *
 * @version 0.8.3
 * @since 0.1.0
 * @lastModified 2026-08-12
 */

// [CONCEPTO DE NEGOCIO] Single Source of Truth de nombres de hoja y rangos; ningun modulo hardcodea posiciones.
// [FUNDAMENTO TEORICO / ADMINISTRATIVO] La resolucion de alias tolera renombres de pestanas sin ventana de rotura; ante ambiguedad gana la hoja historica con datos. @see docs/permanente/ARNES_TIDETRACK.md

// [AGILE-VALOR] Configuración Core y Central. Define el esqueleto del Plan de Cuentas y Hoja de cargas.

// ============================================
// RESOLUCION DE NOMBRES DE HOJA (ALIAS)
// ============================================

// Cache de los nombres de hoja de la planilla activa. Se llena una vez por
// ejecucion: sin esto, cada acceso a una clave resuelta dispararia getSheets().
var _CACHE_NOMBRES_HOJAS;   // undefined = sin resolver, false = no hay planilla

// decision Franco 2026-08-12: resolver de alias portado de pymes; ante ambiguedad gana el historico (Fase 1 arnes).
/**
 * Resuelve el nombre de una hoja que puede llamarse de mas de una forma.
 *
 * Existe por las tres discrepancias config vs planilla detectadas en la Fase 1
 * del arnes ('Hoja de Cargas' vs 'Cargas'; 'Tipos de cambio' vs 'Tipos de Cambio';
 * 'BD antigua' vs 'BD Antigua': getSheetByName es case-sensitive) y por los
 * renombres futuros de la migracion de layout. Devuelve el primer alias que
 * exista; si no existe ninguno, el canonico (el primero de la lista), que es lo
 * que corresponde para que los mensajes de error nombren el destino correcto.
 *
 * @param {string[]} alias nombres aceptados, el primero es el canonico
 * @returns {string}
 */
function _resolverNombreHoja(alias) {
    if (_CACHE_NOMBRES_HOJAS === undefined) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) {
            // Sin planilla activa (por ejemplo, corriendo desde el editor).
            Logger.log('[_resolverNombreHoja] sin planilla activa; se asume el canonico');
            _CACHE_NOMBRES_HOJAS = false;
        } else {
            // Object.create(null): un objeto literal daria truthy para "constructor",
            // "toString" y demas nombres heredados del prototipo.
            const mapa = Object.create(null);
            ss.getSheets().forEach(function (s) { mapa[s.getName().trim()] = true; });
            _CACHE_NOMBRES_HOJAS = mapa;
        }
    }
    if (!_CACHE_NOMBRES_HOJAS) return alias[0];

    const existentes = alias.filter(function (a) { return _CACHE_NOMBRES_HOJAS[a]; });
    if (!existentes.length) return alias[0];

    // AMBIGUEDAD: si conviven varios alias, la planilla quedo a medio migrar.
    // Gana el ULTIMO alias -- el historico, el que tiene los datos -- para no
    // escribir jamas dentro de una hoja nueva y vacia. Y se deja rastro, porque
    // es un estado que hay que resolver a mano.
    if (existentes.length > 1) {
        Logger.log('[_resolverNombreHoja] AMBIGUO, conviven: ' + existentes.join(' | ') +
                   '. Se usa el historico: ' + existentes[existentes.length - 1]);
        return existentes[existentes.length - 1];
    }
    return existentes[0];
}

/** Invalida el cache. Llamarla justo despues de renombrar hojas (migraciones). */
function invalidarCacheNombresHojas() {
    _CACHE_NOMBRES_HOJAS = undefined;
}

// ============================================
// CONFIGURACIÓN DE HOJAS
// ============================================

const SHEETS = {
    PLAN_CUENTAS: 'Plan de Cuentas',
    get DATA_ENTRY() { return _resolverNombreHoja(['Cargas', 'Hoja de Cargas']); },   // canonico real: Cargas; 'Hoja de Cargas' era el valor viejo del config, se conserva como alias defensivo
    REGISTROS: 'Registros',
    get TIPOS_CAMBIO() { return _resolverNombreHoja(['Tipos de cambio', 'Tipos de Cambio']); },  // el codigo v0.8.x usa minuscula, el scanner de marzo registro mayuscula: el resolver devuelve la que exista
    get BD_ANTIGUA() { return _resolverNombreHoja(['BD antigua', 'BD Antigua']); },  // el config viejo usa minuscula, el scanner de marzo registro 'BD Antigua': el resolver devuelve la que exista
    MIRADA_INTERANUAL: 'Mirada Interanual',  // antes hardcodeada en 07_MiradaInteranual.js (regla SSOT)
    DEBUG_MIRADA: 'DEBUG Mirada'  // antes hardcodeada en 07_MiradaInteranual.js (regla SSOT)
};

const HEADER_ROW = 3;
const DATA_START_ROW = 4;

// ============================================
// RANGOS DE COLUMNAS (FIJOS - NO MODIFICAR)
// ============================================

const RANGES = {
 INGRESOS: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'I',
 end: 'J',
 columns: { nombre: 'I', proyecto: 'J' }
 },
    GASTOS_FIJOS: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'L',
 end: 'M',
 columns: { nombre: 'L', proyecto: 'M' }
 },
    GASTOS_VARIABLES: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'O',
 end: 'P',
 columns: { nombre: 'O', proyecto: 'P' }
 },
 MEDIOS_PAGO: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'R',
 end: 'T',
 columns: { nombre: 'R', moneda: 'S', proyecto: 'T' }
 },
    PROYECTOS: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'V',
        end: 'W',
        columns: { nombre: 'V', tipo: 'W' }
    },
    REGISTROS: {
        sheet: SHEETS.REGISTROS,
        start: 'I',
        end: 'T',
        columns: { monto: 'I', tipo: 'J', cuenta: 'K', tipo_cuenta: 'L', medio: 'M', moneda: 'N', fecha: 'O', nota: 'P', tc_ars: 'Q', tc_usd: 'R', tc_aud: 'S', tc_eur: 'T' }
    },
    TC_ARS: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'I',
        end: 'J',
        columns: { fecha: 'I', cotizacion: 'J' }
    },
    TC_USD: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'L',
        end: 'M',
        columns: { fecha: 'L', cotizacion: 'M' }
    },
    TC_AUD: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'O',
        end: 'P',
        columns: { fecha: 'O', cotizacion: 'P' }
    },
    TC_EUR: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'R',
        end: 'S',
        columns: { fecha: 'R', cotizacion: 'S' }
    }
};

// ============================================
// CATÁLOGOS FIJOS (SIN BD)
// ============================================

// ADR-003: Las monedas disponibles se gestionan como constante de backend.
// No requieren una tabla en la hoja de cálculo.
const MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR'];

// ============================================
// MENSAJES DE ERROR
// ============================================

const ERROR_MESSAGES = {
 SHEET_NOT_FOUND: 'Hoja no encontrada'
};

// ============================================
// CONFIGURACIÓN DE MENÚS
// ============================================

// decision Franco 2026-08-12: cero emojis tambien en el menu (Fase 1 arnes).
const MENU_CONFIG = {
    MAIN_MENU: 'Tidetrack',
    ITEMS: [
        { name: 'Gestor: Plan de Cuentas', function: 'showAbmPlanCuentas' },
        { separator: true },
        { name: '[Dev] Procesar Cargas', function: 'procesarCargas' },
        { name: '[Dev] Forzar Carga Historica TC', function: 'forzarCargaHistorica' },
        { separator: true },
        { name: '[Dev] Analizar BD Antigua', function: 'analizarBdAntigua' },
        { name: '[Dev] Migrar BD Antigua', function: 'migrarBdAntigua' },
        { name: '[Dev] Recalcular TC en Registros', function: 'recalcularTcRegistros' },
        { separator: true },
        { name: '[Dev] On/Off Proteccion Cuentas', function: 'togglePlanCuentasProtection' },
        { separator: true },
        { name: '[Dev] Inicializar Mirada Interanual', function: 'inicializarMiradaInteranual' },
        { name: '[Dev] Diagnosticar Mirada Interanual', function: 'diagnosticarMiradaInteranual' },
        { separator: true },
        { name: '[DevTools] Exportar Arquitectura', function: 'exportarArquitecturaTotal' }
    ]
};

// ============================================
// CONFIGURACIÓN DE NAVEGACIÓN
// ============================================

const NAV_CONFIG = {
 SHEETS: {
 INICIO: 'Inicio',
 TABLERO: 'Tablero',
 CARGAS: 'Cargas',
 ESPACIO_BLANCO_1: 'Espacio blanco 1',
 ESPACIO_BLANCO_2: 'Espacio blanco 2',
 ESPACIO_BLANCO_3: 'Espacio blanco 3',
 DATA_ENTRY: 'DATA-ENTRY'
 },
 SHOW_TOAST_ON_NAVIGATE: true,
 TOAST_DURATION: 2 // segundos
};
