/**
 * 00_Config.js
 * Configuración global del sistema Tidetrack
 * Define constantes, rangos de columnas, y enums
 * 
 * @version 0.1.0
 * @since 0.1.0
 * @lastModified 2026-01-17
 */

// ============================================
// CONFIGURACIÓN DE HOJA
// ============================================

const SHEET_NAME = 'DATA-ENTRY';
const HEADER_ROW = 3;
const DATA_START_ROW = 4;

// ============================================
// MONEDAS HARDCODEADAS DEL SISTEMA
// ============================================

/**
 * Monedas soportadas por el sistema (fijas, no modificables por usuario)
 * @constant
 */
const CURRENCIES = {
  ARS: { id: 'ARS', name: 'Peso Argentino', symbol: '$', decimals: 2, is_base: true },
  USD: { id: 'USD', name: 'Dólar Estadounidense', symbol: 'US$', decimals: 2, is_base: false },
  EUR: { id: 'EUR', name: 'Euro', symbol: '€', decimals: 2, is_base: false },
  AUD: { id: 'AUD', name: 'Dólar Australiano', symbol: 'A$', decimals: 2, is_base: false },
  CNY: { id: 'CNY', name: 'Yuan Chino', symbol: '¥', decimals: 2, is_base: false }
};

/**
 * Moneda base del sistema (todas las conversiones usan esta como referencia)
 * @constant
 */
const BASE_CURRENCY = 'ARS';

/**
 * Array de IDs de monedas disponibles (helper)
 * @constant
 */
const AVAILABLE_CURRENCY_IDS = Object.keys(CURRENCIES);

// ============================================
// RANGOS DE COLUMNAS (FIJOS - NO MODIFICAR)
// ============================================

const RANGES = {
  TIPOS_CAMBIO: {
    start: 'G',
    end: 'R',
    columns: {
      fx_id: 'G',
      fecha: 'H',
      base_moneda_id: 'I',
      quote_moneda_id: 'J',
      tc: 'K',
      fuente: 'L',
      provider: 'M',
      api_endpoint: 'N',
      request_params: 'O',
      fetched_at: 'P',
      status: 'Q',
      raw_payload: 'R'
    }
  },

  MEDIOS_PAGO: {
    start: 'T',
    end: 'X',
    columns: {
      medio_id: 'T',
      nombre_medio: 'U',
      tipo: 'V',
      moneda_id: 'W',
      uso_principal: 'X'
    }
  },

  CUENTAS: {
    start: 'Z',
    end: 'AC',
    columns: {
      cuenta_id: 'Z',
      nombre_cuentas: 'AA',
      macro_tipo: 'AB',
      es_recurrente: 'AC'
    }
  },

  TRANSACCIONES: {
    start: 'AE',
    end: 'AP',
    columns: {
      trx_id: 'AE',
      fecha: 'AF',
      monto: 'AG',
      moneda_id: 'AH',
      sentido: 'AI',
      cuenta_id: 'AJ',
      medio_id: 'AK',
      nota: 'AL',
      fx_id: 'AM',
      monto_base: 'AN',
      cuenta_nombre: 'AO',
      medio_nombre: 'AP'
    }
  },

  AUX_COTIZACIONES: {
    start: 'AV',
    end: 'AZ',
    columns: {
      moneda: 'AV',
      compra: 'AW',
      venta: 'AX',
      updated_at: 'AY',
      fuente: 'AZ'
    }
  }
};

// ============================================
// ENUMS (VALORES CERRADOS)
// ============================================

const ENUM_SENTIDO = ['Ingreso', 'Egreso'];

const ENUM_MACRO_TIPO = [
  'Ingreso',
  'Gasto fijo',
  'Gasto variable',
  'Ahorro',
  'Dólares'
];

const ENUM_TIPO_MEDIO = [
  'efectivo',
  'débito',
  'crédito',
  'billetera',
  'banco'
];

const ENUM_USO_PRINCIPAL = [
  'gasto',
  'ahorro',
  'inversión',
  'mixto'
];

const ENUM_FUENTE_FX = [
  'oficial',
  'MEP',
  'blue',
  'CCL',
  'tarjeta',
  'manual'
];

const ENUM_STATUS_FX = [
  'ok',
  'error',
  'stale'
];

// ============================================
// CONFIGURACIÓN DE API
// ============================================

const API_CONFIG = {
  dolarapi: {
    baseUrl: 'https://dolarapi.com/v1',
    timeout: 8000
  },
  exchangeRate: {
    baseUrl: 'https://api.exchangerate-api.com/v4/latest/',
    timeout: 10000, // 10 segundos
    retries: 3
  }
};

// ============================================
// DEFAULTS
// ============================================

const DEFAULTS = {
  config_id: 1,
  base_moneda_id: 'ARS',
  fuente_tc_preferida: 'oficial',
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires'
};

// ============================================
// MENSAJES DE ERROR
// ============================================

const ERROR_MESSAGES = {
  SHEET_NOT_FOUND: 'Hoja DATA-ENTRY no encontrada',
  INVALID_ENUM: 'Valor no permitido. Valores válidos: ',
  FK_NOT_FOUND: 'Referencia no encontrada en tabla: ',
  VALIDATION_FAILED: 'Validación fallida: ',
  API_ERROR: 'Error al consultar API: ',
  DUPLICATE_ID: 'ID duplicado: ',
  REQUIRED_FIELD: 'Campo obligatorio: '
};

// ============================================
// CONFIGURACIÓN DE MENÚS
// ============================================

const MENU_CONFIG = {
  MAIN_MENU: 'Tidetrack',
  ITEMS: [
    { name: 'Nueva Transacción', function: 'showTransactionDialog' },
    { name: 'Ver Dashboard', function: 'showDashboard' },
    { separator: true },
    { name: 'Generar Datos Demo', function: 'runDataSeed' },
    { name: 'Limpiar Transacciones', function: 'confirmClearTransactions' }
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


// ============================================
// HELPER FUNCTIONS (STUBS FOR DELETED ConfigService)
// ============================================

/**
 * Stub: Devuelve objeto de configuración hardcodeada
 * Reemplaza getConfig() de ConfigService (eliminado)
 * @returns {Object} Configuración del sistema
 */
function getConfig() {
    return {
        config_id: 'CFG-001',
        base_moneda_id: BASE_CURRENCY,
        fuente_tc_preferida: 'oficial'
    };
}

/**
 * Stub: Devuelve la moneda base del sistema
 * Reemplaza getBaseMoneda() de ConfigService (eliminado)
 * @returns {string} ID de la moneda base (BASE_CURRENCY constant)
 */
function getBaseMoneda() {
    return BASE_CURRENCY;
}

/**
 * Stub: Devuelve todas las monedas hardcodeadas
 * Reemplaza getAllMonedas() de MonedaService (eliminado)
 * Convierte CURRENCIES a formato antiguo para backwards compatibility
 * @returns {Array<Object>} Array de objetos con estructura legacy
 */
function getAllMonedas() {
    return Object.values(CURRENCIES).map(c => ({
        moneda_id: c.id,
        nombre_moneda: c.name,
        simbolo: c.symbol,
        iso_code: c.id,
        decimales: c.decimals,
        activo: true
    }));
}

/**
 * Stub: Devuelve array de IDs de monedas
 * Reemplaza getMonedaCodes() de MonedaService (eliminado)
 * @returns {Array<string>} Array de ISO codes
 */
function getMonedaCodes() {
    return AVAILABLE_CURRENCY_IDS;
}
