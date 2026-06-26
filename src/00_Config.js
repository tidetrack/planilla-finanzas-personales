/**
 * 00_Config.js
 * Configuracion global del sistema Tidetrack
 * Define constantes, rangos de columnas, y enums
 *
 * [CONCEPTO DE NEGOCIO]
 * Single Source of Truth de toda constante estructural del sistema: nombres de hojas,
 * rangos de columnas, filas de encabezado/datos y enumeraciones de catalogo. Cualquier
 * cambio aqui se propaga a toda la logica de acceso a datos via RANGES y SheetManager.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Despues de la migracion 2026-06-22 las hojas de produccion tienen layouts heterogeneos:
 * Plan de Cuentas sigue el esquema original (header fila 3, datos fila 4), mientras que
 * Registros (header 5, datos 6) y Tipos de cambio (sub-header 6, datos 7) reflejan el
 * nuevo diseno limpio. Por eso cada entrada de RANGES declara su propio headerRow/dataRow
 * en lugar de depender del global HEADER_ROW/DATA_START_ROW.
 * HEADER_ROW y DATA_START_ROW se mantienen como defaults globales para compatibilidad con
 * los modulos que aun los usan directamente (Plan de Cuentas, migrarBdAntigua, etc.).
 *
 * @see 03_SheetManager.js (usa config.dataRow || DATA_START_ROW en getTableRange)
 * @see 06_RegistrosService.js (appendMassive usa RANGES.*.dataRow)
 *
 * @version 0.9.4
 * @since 0.1.0
 * @lastModified 2026-06-22
 */

// [AGILE-VALOR] Configuración Core y Central. Define el esqueleto del Plan de Cuentas y Hoja de cargas.

// ============================================
// CONFIGURACIÓN DE HOJAS
// ============================================

const SHEETS = {
    PLAN_CUENTAS: 'Plan de Cuentas',
    DATA_ENTRY: 'Cargas',
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
    // --- Plan de Cuentas: layout original (header fila 3, datos fila 4) ---
    INGRESOS: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'I',
        end: 'J',
        headerRow: 3,
        dataRow: 4,
        columns: { nombre: 'I', proyecto: 'J' }
    },
    GASTOS_FIJOS: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'L',
        end: 'M',
        headerRow: 3,
        dataRow: 4,
        columns: { nombre: 'L', proyecto: 'M' }
    },
    GASTOS_VARIABLES: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'O',
        end: 'P',
        headerRow: 3,
        dataRow: 4,
        columns: { nombre: 'O', proyecto: 'P' }
    },
    MEDIOS_PAGO: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'R',
        end: 'T',
        headerRow: 3,
        dataRow: 4,
        columns: { nombre: 'R', moneda: 'S', proyecto: 'T' }
    },
    PROYECTOS: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'V',
        end: 'W',
        headerRow: 3,
        dataRow: 4,
        columns: { nombre: 'V', tipo: 'W' }
    },

    // --- Registros: layout nuevo (header fila 5, datos fila 6) ---
    REGISTROS: {
        sheet: SHEETS.REGISTROS,
        start: 'B',
        end: 'M',
        headerRow: 5,
        dataRow: 6,
        columns: {
            monto: 'B', tipo: 'C', cuenta: 'D', tipo_cuenta: 'E',
            medio: 'F', moneda: 'G', fecha: 'H', nota: 'I',
            tc_ars: 'J', tc_usd: 'K', tc_aud: 'L', tc_eur: 'M'
        }
    },

    // --- Tipos de cambio: layout nuevo (sub-header fila 6, datos fila 7) ---
    // Bloques horizontales: ARS=B:C | USD=E:F | AUD=H:I | EUR=K:L
    TC_ARS: {
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'B',
        end: 'C',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'B', cotizacion: 'C' }
    },
    TC_USD: {
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'E',
        end: 'F',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'E', cotizacion: 'F' }
    },
    TC_AUD: {
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'H',
        end: 'I',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'H', cotizacion: 'I' }
    },
    TC_EUR: {
        sheet: SHEETS.TIPOS_CAMBIO,
        start: 'K',
        end: 'L',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'K', cotizacion: 'L' }
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
        { name: '🔧 [Dev] On/Off Protección Cuentas', function: 'togglePlanCuentasProtection' },
        { separator: true },
        { name: '🔧 [Dev] Renombrar Hojas a Produccion', function: 'renameProductionSheets' },
        { name: '🔧 [Dev] Migrar Datos a Produccion Nueva', function: 'migrarLegacyANuevaProduccion' },
        { separator: true },
        { name: '🤖 [DevTools] Exportar Arquitectura', function: 'exportarArquitecturaTotal' }
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
