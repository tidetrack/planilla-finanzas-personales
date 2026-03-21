/**
 * 00_Config.js
 * Configuración global del sistema Tidetrack
 * Define constantes, rangos de columnas, y enums
 * 
 * @version 0.1.0
 * @since 0.1.0
 * @lastModified 2026-01-17
 */

// [AGILE-VALOR] Configuración Core y Central. Define el esqueleto del Plan de Cuentas y Hoja de cargas.

// ============================================
// CONFIGURACIÓN DE HOJAS
// ============================================

const SHEETS = {
    PLAN_CUENTAS: 'Plan de Cuentas',
    DATA_ENTRY: 'Hoja de Cargas',
    REGISTROS: 'Registros',
    TIPOS_CAMBIO: 'Tipos de cambio',
    BD_ANTIGUA: 'BD antigua'
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
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'I',
        end: 'J',
        columns: { fecha: 'I', cotizacion: 'J' }
    },
    TC_USD: {
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'L',
        end: 'M',
        columns: { fecha: 'L', cotizacion: 'M' }
    },
    TC_AUD: {
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'O',
        end: 'P',
        columns: { fecha: 'O', cotizacion: 'P' }
    },
    TC_EUR: {
        sheet: SHEETS.TIPOS_CAMBIO,
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

const MENU_CONFIG = {
    MAIN_MENU: 'Tidetrack',
    ITEMS: [
        { name: 'Gestor: Plan de Cuentas', function: 'showAbmPlanCuentas' },
        { separator: true },
        { name: '🔧 [Dev] Procesar Cargas', function: 'procesarCargas' },
        { name: '🔧 [Dev] Forzar Carga Histórica TC', function: 'forzarCargaHistorica' },
        { separator: true },
        { name: '🔧 [Dev] Analizar BD Antigua', function: 'analizarBdAntigua' },
        { name: '🔧 [Dev] Migrar BD Antigua', function: 'migrarBdAntigua' },
        { name: '🔧 [Dev] Recalcular TC en Registros', function: 'recalcularTcRegistros' },
        { separator: true },
        { name: '🔧 [Dev] On/Off Protección Cuentas', function: 'togglePlanCuentasProtection' }
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
