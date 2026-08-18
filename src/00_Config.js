/**
 * 00_Config.js
 * Configuración global del sistema Tidetrack
 * Define constantes, rangos de columnas, y enums
 *
 * @version 0.9.5
 * @since 0.1.0
 * @lastModified 2026-08-13
 */

// [CONCEPTO DE NEGOCIO] Single Source of Truth de nombres de hoja y rangos; ningun modulo hardcodea posiciones.
// [FUNDAMENTO TEORICO / ADMINISTRATIVO] La resolucion de alias tolera renombres de pestanas sin ventana de rotura; ante ambiguedad gana la hoja historica con datos. @see docs/permanente/ARNES_TIDETRACK.md
//
// [FUNDAMENTO TEORICO / ADMINISTRATIVO - LAYOUTS HETEROGENEOS]
// Desde la migracion de la planilla productiva (verificada en vivo el 2026-08-13) las hojas
// NO comparten un unico layout:
//   - Plan de Cuentas: sin migrar. Header fila 3, datos fila 4, offset I+ (ADR-005).
//   - Cargas: sin migrar. Header fila 4, datos fila 5, grilla fija I5:O19.
//   - Registros: migrada. Titulo B2, header fila 5, datos fila 6, columnas B:M.
//   - Tipos de cambio: migrada. Titulo B2, titulos de bloque fila 5, header fila 6,
//     datos fila 7, bloques B:C / E:F / H:I / K:L.
// Por eso cada entrada de RANGES puede declarar su propio headerRow/dataRow. HEADER_ROW y
// DATA_START_ROW quedan como DEFAULT GLOBAL de las tablas que no los declaran (las cinco del
// Plan de Cuentas), no como verdad universal.
// @see docs/permanente/ARNES_TIDETRACK.md (Fase 2 - gemelo digital)

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
    DEBUG_MIRADA: 'DEBUG Mirada',  // antes hardcodeada en 07_MiradaInteranual.js (regla SSOT)
    // decision Franco 2026-08-13: el nombre de la hoja del Presupuesto se fija en el SSOT ANTES
    // de crearla, no despues (MAPA_ARQUITECTURA_PLANILLA.md 14.8, punto 7: la planilla ya tiene
    // tres rotulos distintos para la misma idea -- "Presupuesto del Mes.", "Control de
    // Presupuesto." y "PRESUPUESTO"). String estatico y no getter de alias: es una hoja que el
    // sistema CREA, asi que no hay historico con datos con el que pueda haber ambiguedad.
    // No se duplica en NAV_CONFIG.SHEETS: la navegacion la lee desde aca (regla SSOT).
    PRESUPUESTO: 'Presupuesto'
};

// DEFAULT GLOBAL, no verdad universal: corresponden al layout del Plan de Cuentas, la unica
// hoja cuyas tablas no declaran headerRow/dataRow propios. Toda tabla con layout distinto lo
// declara en su entrada de RANGES y gana sobre estos valores.
const HEADER_ROW = 3;
const DATA_START_ROW = 4;

// ============================================
// CAPACIDAD DE GRID (FILAS FISICAS DE LA HOJA)
// ============================================

// decision Franco 2026-08-13: ante grid insuficiente se AMPLIA con insertRowsAfter, no se aborta.
// Motivo: la hoja "Tipos de cambio" quedo con 41 filas fisicas tras la migracion (29 cotizaciones
// por par, datos 7:35, apenas 6 filas libres). El backfill de las 3.151 cotizaciones perdidas y
// cualquier forzarCargaHistorica necesitan ~830 filas por bloque: abortar dejaria el sistema
// permanentemente bloqueado y obligaria a un paso manual. La ampliacion se hace SIEMPRE al pie
// del grid (insertRowsAfter(getMaxRows(), n)) para no desplazar datos, formulas ni formatos
// existentes, y SIEMPRE antes de la primera escritura, para no fallar a medias.
const GRID_COLCHON_FILAS = 200;   // margen extra al ampliar: evita una ampliacion por lote
const GRID_MAX_FILAS = 50000;     // tope duro de seguridad; superarlo lanza error explicito

// ============================================
// RANGOS DE COLUMNAS (FIJOS - NO MODIFICAR)
// ============================================

const RANGES = {
 // --- Plan de Cuentas: layout historico sin migrar (header fila 3, datos fila 4) ---
 // Sin headerRow/dataRow propios a proposito: usan el default global HEADER_ROW/DATA_START_ROW.
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
    // --- Cargas: layout historico sin migrar (header fila 4, datos fila 5) ---
    // decision Franco 2026-08-13: la geometria de la grilla de carga entra a Config como SSOT.
    // Antes vivia como literal 'I5:O19' en 06_RegistrosService y como numeros magicos (9, 12,
    // 13, 14) en 14_EventHandlers, que ademas usaba DATA_START_ROW (=4) como fila de datos: eso
    // dejaba la fila de encabezado dentro del area "editable" del autocompletado.
    CARGAS: {
        get sheet() { return SHEETS.DATA_ENTRY; },  // getter: preserva la resolucion perezosa del alias
        start: 'I',
        end: 'O',
        headerRow: 4,
        dataRow: 5,
        filas: 15,   // grilla de altura fija I5:O19; no crece, se limpia despues de cada lote
        columns: { monto: 'I', tipo: 'J', cuenta: 'K', medio: 'L', moneda: 'M', fecha: 'N', nota: 'O' }
    },

    // --- Registros: layout migrado (titulo B2, header fila 5, datos fila 6, cols B:M) ---
    // decision Franco 2026-08-13: se adapta el CODIGO al layout nuevo de la planilla, no al reves.
    // Verificado celda por celda sobre la planilla productiva el 2026-08-13.
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

    // --- Tipos de cambio: layout migrado (titulos de bloque fila 5, header fila 6, datos fila 7) ---
    // Bloques horizontales: ARS=B:C | USD=E:F | AUD=H:I | EUR=K:L
    TC_ARS: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'B',
        end: 'C',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'B', cotizacion: 'C' }
    },
    TC_USD: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'E',
        end: 'F',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'E', cotizacion: 'F' }
    },
    TC_AUD: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'H',
        end: 'I',
        headerRow: 6,
        dataRow: 7,
        columns: { fecha: 'H', cotizacion: 'I' }
    },
    TC_EUR: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
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
// CUENTAS NEUTRAS (MOVIMIENTOS PERMUTATIVOS)
// ============================================

// [CONCEPTO DE NEGOCIO]
// Hay movimientos que no son un ingreso ni un gasto: solo mueven plata de una caja propia a
// otra, o inicializan el saldo con el que una caja arranca el mes. El patrimonio no cambia;
// cambia su composicion. Son dos, y viven en la columna Cuenta (RANGES.REGISTROS.columns.cuenta):
//   - "Traspaso":   movimiento entre cajas propias (de la caja de ahorro al dolar, de Mercado
//                   Pago al banco). El pipeline lo escribe como DOS patas, una que sale y una
//                   que entra, y el ledger tiene que poder reconstruirlas: los datos estan bien.
//   - "Inicio Mes": asiento de apertura, el saldo con el que arranca cada caja el dia 1.
//
// [FUNDAMENTO TEORICO / ADMINISTRATIVO]
// Son cuentas de MOVIMIENTOS, permutativas: por definicion no afectan el resultado del periodo.
// El concepto viene del plan de cuentas de planilla-pymes, donde tienen su propio bloque
// (arnes, Fase 6). Aca todavia NO existe ese bloque en la hoja "Plan de Cuentas": hasta que la
// Fase 6 lo cree, esta constante ES el registro de cuentas neutras del sistema.
// @see docs/permanente/ARNES_TIDETRACK.md (Fase 6 - plan de cuentas)
//
// POR QUE EXISTE, medido y no estimado (2026-08-13): la pata que entra de cada traspaso queda
// clasificada como Ingreso. Sumar los ingresos sin excluir estas cuentas da 31,1 M contra 17,5 M
// reales: un 77 % de inflacion. Los saldos de apertura son del mismo genero.
//
// decision Franco 2026-08-13: se corrige SOLO EN LA LECTURA. No se migran las 2.904 filas del
// ledger ni se toca procesarCargas(): los datos son correctos -- son las dos patas de un
// movimiento real, y Tablero!I21 justamente comprueba que cierren --, lo que esta mal es
// sumarlas como ingreso. Por eso esto es una constante de exclusion y no una migracion de datos.
//
// FUENTE UNICA: todo modulo o formula que agregue ingresos o gastos debe excluir estas cuentas,
// y la lista sale de aca. Ningun literal 'Traspaso' suelto en un modulo nuevo: si manana entra
// una tercera cuenta neutra, tiene que alcanzar con agregarla en esta linea.
//
// LA COMPARACION TIENE QUE SER TOLERANTE a mayusculas/minusculas y a espacios (de sobra al
// principio o al final, y dobles adentro). Las cuentas se tipean a mano en la grilla de Cargas
// y se pegan desde planillas viejas, donde conviven "Traspaso", "traspaso " y "Inicio  Mes";
// una comparacion con === sobre el texto crudo deja pasar justo las filas que hay que excluir,
// que es la falla mas cara posible aca (una sola fila colada infla el agregado). Desde codigo
// se compara SIEMPRE con esCuentaNeutra(), que ya lo resuelve. Dentro de una formula de hoja de
// calculo, donde no se puede llamar a esCuentaNeutra(), el equivalente es comparar contra
// TRIM(...) y con funciones insensibles a mayusculas.
const CUENTAS_NEUTRAS = ['Traspaso', 'Inicio Mes'];

/**
 * Normaliza un nombre de cuenta o de medio para poder compararlo.
 *
 * Recorta los extremos, colapsa los espacios internos (incluidos tabulaciones, saltos y el
 * espacio duro   que aparece al pegar desde otras planillas) y pasa a minusculas.
 *
 * @param {*} nombre valor crudo de la celda
 * @returns {string} '' si el valor no es texto util
 */
function normalizarNombreCuenta(nombre) {
    if (nombre === null || nombre === undefined) return '';
    return String(nombre)
        .replace(/[\s ]+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * true si la cuenta es NEUTRA (permutativa) y por lo tanto no suma ni a ingresos ni a gastos.
 * Comparacion tolerante a mayusculas y espacios (ver el comentario de CUENTAS_NEUTRAS).
 *
 * @param {*} nombreCuenta valor de la columna Cuenta
 * @returns {boolean}
 */
function esCuentaNeutra(nombreCuenta) {
    const n = normalizarNombreCuenta(nombreCuenta);
    if (n === '') return false;
    for (let i = 0; i < CUENTAS_NEUTRAS.length; i++) {
        if (normalizarNombreCuenta(CUENTAS_NEUTRAS[i]) === n) return true;
    }
    return false;
}

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
//
// decision Franco 2026-08-13: DOS menus top-level, calcado del patron de planilla-pymes.
// El menu unico mezclaba la operacion cotidiana con herramientas de desarrollo, y la funcion
// que mas se usa -- Procesar Cargas -- estaba rotulada "[Dev]" como si fuera peligrosa.
//   - "Tidetrack": lo que el usuario hace todos los dias. Nada que pueda romper la planilla.
//   - "Tidetrack Dev": migraciones, fixes, diagnosticos y devtools. Todo lo que escribe
//     estructura o formulas vive aca, agrupado por dominio y con el orden de ejecucion
//     explicito en el nombre cuando importa (las migraciones se corren 1 -> 2 -> 3).
//
// Gramatica de items soportada por 12_MenuService.js:
//   { name, function }            item normal
//   { separator: true }           linea divisoria
//   { seccion: 'TEXTO' }          rotulo inerte (Apps Script no tiene encabezados de menu)
//   { submenu: 'Nombre', items }  submenu anidado
const MENU_CONFIG = {
    MAIN_MENU: 'Tidetrack',
    DEV_MENU: 'Tidetrack Dev',

    // --- Menu de uso diario ---
    ITEMS: [
        { seccion: 'REGISTRAR' },
        { name: 'Procesar Cargas', function: 'procesarCargas' },
        { separator: true },
        { seccion: 'ADMINISTRAR' },
        { name: 'Plan de Cuentas', function: 'showAbmPlanCuentas' },
        { separator: true },
        {
            submenu: 'Ir a la hoja', items: [
                // Solo hojas confirmadas existentes en el escaneo del 2026-08-13.
                // 'Espacio blanco 1' y 'Espacio blanco 3' quedaron fuera: no existen.
                { name: 'Inicio', function: 'navigateToInicio' },
                { name: 'Tablero', function: 'navigateToTablero' },
                // "Presupuesto" sale del menu junto con sus devtools: la unica pieza que crea esa
                // hoja es DEVTOOL_Presupuesto.js, que quedo fuera de servicio. La entrada solo
                // podia responder "la hoja no existe". navigateToPresupuesto() y SHEETS.PRESUPUESTO
                // se conservan para reponerla en una linea cuando el modulo este listo.
                { name: 'Cargas', function: 'navigateToCargas' }
            ]
        }
    ],

    // --- Menu de desarrollo, fixes y migraciones ---
    DEV_ITEMS: [
        {
            // Se corren EN ESTE ORDEN: primero el estado (solo lectura), despues aplicar.
            // Revertir usa el respaldo congelado. @see MIGRACION_v0.9.5_LayoutNuevo.js
            submenu: 'Migracion v0.9.5 (layout nuevo)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoMigracionV095' },
                { name: '2. Aplicar', function: 'aplicarMigracionV095' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirMigracionV095' },
                { separator: true },
                { name: 'Reparar formato de cotizaciones', function: 'repararFormatoCotizacionesV095' },
                { name: 'Ver respaldos (cuales sirven)', function: 'estadoRespaldosV095' }
            ]
        },
        { separator: true },
        { seccion: 'FORMULAS Y VISTAS' },
        {
            submenu: 'Mirada Interanual', items: [
                { name: '1. Verificar precondiciones', function: 'verificarPrecondicionesMirada' },
                { name: '2. Inicializar formulas', function: 'inicializarMiradaInteranual' },
                { separator: true },
                { name: 'Diagnosticar (hoja DEBUG)', function: 'diagnosticarMiradaInteranual' },
                { name: 'Auditar balanceo de la formula', function: 'auditarBalanceFormulaMirada' }
            ]
        },
        {
            // Se corren EN ESTE ORDEN: primero el estado (solo lectura), despues aplicar.
            // Revertir usa el respaldo congelado. @see DEVTOOL_RobustezVistas.js
            submenu: 'Robustez de vistas', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoRobustezVistas' },
                { name: '2. Aplicar (envolver QUERY en IFERROR)', function: 'aplicarRobustezVistas' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirRobustezVistas' }
            ]
        },
        // decision Franco 2026-08-13: el PRESUPUESTO SALE DEL MENU hasta su sesion dedicada.
        // Los dos modulos (DEVTOOL_Presupuesto.js y DEVTOOL_CableadoPresupuesto.js) quedaron con
        // bloqueantes abiertos -- el motor declara exito sobre una hoja en ceros, el cableado
        // puede escribir contra celdas vacias -- y sus funciones publicas SIGUEN EXISTIENDO en el
        // proyecto: si estan en el menu, se pueden disparar por accidente con un clic y escribir
        // sobre la planilla productiva. Un modulo a medio terminar no se marca con un comentario,
        // se vuelve inalcanzable. Los archivos se conservan enteros (el trabajo es valioso y la
        // proxima sesion arranca de ahi) con su cabecera NO LISTO y la lista de bloqueantes.
        // Para volver a habilitarlo: reponer aca los dos submenus y la entrada de navegacion.
        { separator: true },
        { seccion: 'DATOS' },
        {
            submenu: 'Tipos de cambio', items: [
                { name: 'Forzar carga historica', function: 'forzarCargaHistorica' },
                { name: 'Recalcular TC en Registros', function: 'recalcularTcRegistros' }
            ]
        },
        {
            submenu: 'BD Antigua (migracion legacy)', items: [
                { name: '1. Analizar', function: 'analizarBdAntigua' },
                { name: '2. Migrar', function: 'migrarBdAntigua' }
            ]
        },
        {
            // Recupera del "PLANILLA FINANZAS_v03.1 | Fran" todo lo que el ledger no tenga
            // (abril a agosto de 2026, los meses en que el pipeline estuvo cortado). Es
            // RE-EJECUTABLE: cruza por ausencia, asi que correrlo de nuevo trae solo lo nuevo.
            // Se corren EN ESTE ORDEN: primero el estado (solo lectura), despues aplicar.
            // Revertir restaura el ledger completo desde el respaldo. @see MIGRACION_v031_Historico.js
            submenu: 'Historico v03.1 (planilla vieja)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoMigracionV031' },
                { name: '2. Aplicar (migrar lo que falta)', function: 'aplicarMigracionV031' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirMigracionV031' }
            ]
        },
        { separator: true },
        { seccion: 'MANTENIMIENTO' },
        { name: 'On/Off proteccion del Plan de Cuentas', function: 'togglePlanCuentasProtection' },
        { name: 'Exportar arquitectura (gemelo digital)', function: 'exportarArquitecturaTotal' }
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
