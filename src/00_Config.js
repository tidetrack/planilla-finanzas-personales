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
  DATA_ENTRY: 'Hoja de Cargas'
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
    end: 'K',
    columns: { nombre: 'I', moneda: 'J', proyecto: 'K' }
  },
  COSTOS_FIJOS: {
    sheet: SHEETS.PLAN_CUENTAS,
    start: 'M',
    end: 'O',
    columns: { nombre: 'M', moneda: 'N', proyecto: 'O' }
  },
  COSTOS_VARIABLES: {
    sheet: SHEETS.PLAN_CUENTAS,
    start: 'Q',
    end: 'S',
    columns: { nombre: 'Q', moneda: 'R', proyecto: 'S' }
  },
  MEDIOS_PAGO: {
    sheet: SHEETS.PLAN_CUENTAS,
    start: 'U',
    end: 'W',
    columns: { nombre: 'U', moneda: 'V', proyecto: 'W' }
  },
  PROYECTOS: {
    sheet: SHEETS.PLAN_CUENTAS,
    start: 'AC',
    end: 'AD',
    columns: { nombre: 'AC', tipo: 'AD' }
  }
};

// ============================================
// CATÁLOGOS FIJOS (SIN BD)
// ============================================

// ADR-003: Las monedas disponibles se gestionan como constante de backend.
// No requieren una tabla en la hoja de cálculo.
const MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR', 'BRL', 'GBP', 'CAD', 'CLP', 'UYU'];

// ============================================
// ENUMS (VALORES CERRADOS)
// ============================================

const ENUM_SENTIDO = ['Ingreso', 'Egreso'];

const ENUM_MACRO_TIPO = [
  'Ingreso',
  'Gasto fijo',
  'Gasto variable',
  'Ahorro',
  'Dólares' // U otro tipo de categorización personalizada
];

// ============================================
// MENSAJES DE ERROR
// ============================================

const ERROR_MESSAGES = {
  SHEET_NOT_FOUND: 'Hoja DATA-ENTRY no encontrada',
  INVALID_ENUM: 'Valor no permitido. Valores válidos: ',
  VALIDATION_FAILED: 'Validación fallida: ',
  DUPLICATE_ID: 'ID duplicado: ',
  REQUIRED_FIELD: 'Campo obligatorio: '
};

// ============================================
// CONFIGURACIÓN DE MENÚS
// ============================================

const MENU_CONFIG = {
  MAIN_MENU: 'Tidetrack',
  ITEMS: [
    { name: 'Gestor: Plan de Cuentas', function: 'showAbmPlanCuentas' }
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
  TOAST_DURATION: 2  // segundos
};
