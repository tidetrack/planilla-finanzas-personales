/**
 * 00_Config.js
 * Configuración global del sistema Tidetrack
 * Define constantes, rangos de columnas, y enums
 *
 * @version 0.11.2
 * @since 0.1.0
 * @lastModified 2026-08-24
 */

// [CONCEPTO DE NEGOCIO] Single Source of Truth de nombres de hoja y rangos; ningun modulo hardcodea posiciones.
// [FUNDAMENTO TEORICO / ADMINISTRATIVO] La resolucion de alias tolera renombres de pestanas sin ventana de rotura; ante ambiguedad gana la hoja historica con datos. @see docs/permanente/ARNES_TIDETRACK.md
//
// [FUNDAMENTO TEORICO / ADMINISTRATIVO - LAYOUTS HETEROGENEOS]
// decision Franco 2026-08-18: la geometria de este config describe las hojas FIX (el rediseno
// que el swap v0.11 convierte en canonico). Se remapea en el MISMO release que ejecuta el
// swap: entre el deploy y aplicarSwapV011 el sistema queda intencionalmente inconsistente
// (config nuevo sobre hojas viejas), por eso el swap se corre inmediatamente despues del push.
// Layout post-swap:
//   - Plan de Cuentas: titulo C2, titulos de bloque fila 6, header fila 7, datos fila 8,
//     bloques C:D (Ingresos) / F:G (Gastos Fijos) / I:J (Gastos Variables) / L:N (Medios) /
//     P:Q (Categorias, ex Proyectos). La nocion "Proyecto" pasa a llamarse "Categoria" en la
//     hoja; las claves internas de RANGES conservan su nombre historico.
//   - Cargas: titulo B2, header fila 6, datos filas 7-21, grilla fija C7:I21 (numeracion B7:B21).
//   - Registros: titulo B2, header fila 6, datos fila 7, columnas B:M (sin cambio de columnas).
//   - Tipos de Cambio: titulo C2, titulos de bloque fila 6, header fila 7, datos fila 8,
//     bloques C:D / F:G / I:J / L:M.
// Cada entrada de RANGES puede declarar su propio headerRow/dataRow. HEADER_ROW y
// DATA_START_ROW quedan como DEFAULT GLOBAL de las tablas que no los declaran (las cinco del
// Plan de Cuentas), no como verdad universal.
// @see docs/permanente/ARNES_TIDETRACK.md (Fase 2 - gemelo digital)
// @see MIGRACION_v0.11_SwapHojasFix.js

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
    get TIPOS_CAMBIO() { return _resolverNombreHoja(['Tipos de Cambio', 'Tipos de cambio']); },  // canonico post-swap v0.11: 'Tipos de Cambio' (C mayuscula, la hoja Fix); la grafia vieja queda como alias defensivo
    get BD_ANTIGUA() { return _resolverNombreHoja(['BD antigua', 'BD Antigua']); },  // el config viejo usa minuscula, el scanner de marzo registro 'BD Antigua': el resolver devuelve la que exista
    MIRADA_INTERANUAL: 'Mirada Interanual',  // antes hardcodeada en 07_MiradaInteranual.js (regla SSOT)
    DEBUG_MIRADA: 'DEBUG Mirada',  // antes hardcodeada en 07_MiradaInteranual.js (regla SSOT)
    // decision Franco 2026-08-13: el nombre de la hoja del Presupuesto se fija en el SSOT ANTES
    // de crearla, no despues (MAPA_ARQUITECTURA_PLANILLA.md 14.8, punto 7: la planilla ya tiene
    // tres rotulos distintos para la misma idea -- "Presupuesto del Mes.", "Control de
    // Presupuesto." y "PRESUPUESTO"). String estatico y no getter de alias: es una hoja que el
    // sistema CREA, asi que no hay historico con datos con el que pueda haber ambiguedad.
    // No se duplica en NAV_CONFIG.SHEETS: la navegacion la lee desde aca (regla SSOT).
    PRESUPUESTO: 'Presupuesto',
    // BD de PROYECCION: espejo de "Registros" donde se carga lo previsto. Getter de alias y no
    // string estatico por el acento: el nombre natural en castellano lleva tilde ("Proyeccion"
    // vs "Proyección") y esa clase de ambiguedad ya costo caro en este repo tres veces. El
    // canonico es SIN tilde -- ninguna otra pestania de la planilla usa acentos -- pero si
    // alguien la renombra con tilde el resolver la encuentra igual.
    get PROYECCION() { return _resolverNombreHoja(['Proyeccion', 'Proyección']); }
};

// DEFAULT GLOBAL, no verdad universal: corresponden al layout del Plan de Cuentas, la unica
// hoja cuyas tablas no declaran headerRow/dataRow propios. Toda tabla con layout distinto lo
// declara en su entrada de RANGES y gana sobre estos valores.
// decision Franco 2026-08-18: 7/8 desde el swap v0.11 (Plan de Cuentas Fix: header 7, datos 8).
const HEADER_ROW = 7;
const DATA_START_ROW = 8;

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
 // --- Plan de Cuentas: layout Fix (titulos de bloque fila 6, header fila 7, datos fila 8) ---
 // Sin headerRow/dataRow propios a proposito: usan el default global HEADER_ROW/DATA_START_ROW.
 // En la hoja los headers dicen Cuenta/Categoria; la clave interna 'proyecto' se conserva
 // (renombrarla tocaria todos los consumidores sin cambiar ningun comportamiento).
 INGRESOS: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'C',
 end: 'D',
 columns: { nombre: 'C', proyecto: 'D' }
 },
    GASTOS_FIJOS: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'F',
 end: 'G',
 columns: { nombre: 'F', proyecto: 'G' }
 },
    GASTOS_VARIABLES: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'I',
 end: 'J',
 columns: { nombre: 'I', proyecto: 'J' }
 },
 MEDIOS_PAGO: {
 sheet: SHEETS.PLAN_CUENTAS,
 start: 'L',
 end: 'N',
 columns: { nombre: 'L', moneda: 'M', proyecto: 'N' }
 },
    // El bloque se rotula 'Categorias' en la hoja Fix (Nombre/Tipo, con los tipos generales
    // Ahorros/Inversiones/Financiacion/Hogar). La clave interna conserva el nombre historico.
    // LEGACY, sin uso desde la v0.20.0. Era el catalogo de categorias de MEDIOS con su tipo;
    // los medios ahora declaran su tipo directo en la columna N y este bloque quedo vacio. Se
    // conserva la entrada porque varios devtools historicos la leen en sus preflights -- todos
    // ya aplicados -- y quitarla los dejaria sin poder arrancar. No escribir aca.
    PROYECTOS: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'P',
        end: 'Q',
        columns: { nombre: 'P', tipo: 'Q' }
    },
    // decision Franco 2026-08-19: catalogo SEPARADO para las categorias de CUENTAS. Contesta
    // POR QUE entro o salio la plata, que es un eje INDEPENDIENTE del anterior -- el mismo gasto
    // de Vehiculo puede pagarse desde un medio cotidiano o desde uno de ahorro, y ese cruce es
    // justamente la informacion que se busca. Mezclar los dos catalogos en P:Q obligaria a que
    // uno determine al otro y esa informacion se perderia.
    // decision Franco 2026-08-19 (segunda vuelta): TODAS las categorias van en la columna P.
    // Nacio en U para no pisar el bloque de categorias de medios, pero ese bloque quedo sin uso
    // cuando los medios pasaron a declarar su tipo directo (v0.20.0): P quedo libre y es el lugar
    // natural. Un solo catalogo de categorias, en una sola columna.
    CATEGORIAS_CUENTA: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'P',
        end: 'P',
        columns: { nombre: 'P' }
    },
    // decision Franco 2026-08-24: las CUENTAS COMODIN entran al Plan de Cuentas, ocultas.
    // No son ingreso, ni gasto fijo, ni gasto variable: son mecanismos del sistema
    // ("Traspaso" mueve plata entre dos cajas propias, "Inicio Mes" declara con cuanto
    // arranca una caja). Hasta hoy no tenian donde vivir en la hoja y se tipeaban a mano en
    // la grilla de Cargas, que es de donde salen las variantes "traspaso " e "Inicio  Mes"
    // que documenta CUENTAS_NEUTRAS mas abajo. Con la cuenta en el desplegable, la variante
    // no se puede escribir.
    //
    // POR QUE T:U y no antes: E, H, K, O y Q son el AIRE entre bloques -- la hoja separa por
    // columna vacia y no por borde --, R es la consolidada de servicio y S es su aire. T es
    // la primera columna libre de verdad. Medido sobre el gemelo el 2026-08-24: la hoja usa
    // C, D, F, G, I, J, L, M, N, P y R, y nada mas.
    //
    // EL CATALOGO NO VIVE ACA: el bloque es la PROYECCION de CUENTAS_NEUTRAS. Una cuenta
    // comodin nueva se agrega a esa constante y se vuelve a correr el devtool.
    // @see DEVTOOL_CuentasComodin.js
    CUENTAS_COMODIN: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'T',
        end: 'U',
        columns: { nombre: 'T', nota: 'U' }
    },

    // La columna de servicio que consolida las cuentas de los cuatro bloques con un
    // QUERY(FLATTEN(...)) y alimenta el desplegable de Cuenta de la hoja de Cargas.
    //
    // ENTRA AL SSOT PORQUE YA SE MOVIO UNA VEZ SIN QUE NADIE SE ENTERARA: nacio en S
    // (MIGRACION_v0.11_SwapHojasFix.js) y quedo en R cuando la limpieza borro fisicamente la
    // columna Q. Hasta hoy su coordenada existia SOLO como constante local de un devtool ya
    // consumido (DEVTOOL_LimpiarPlanCuentas.js, LPC_COL_CONSOLIDADA) y CLAUDE.md seguia
    // diciendo S. Un modulo que la busque en S opera sobre una columna vacia y reporta exito.
    //
    // NO SE ESCRIBE A MANO. La escribe la migracion del swap y la extiende el devtool de
    // cuentas comodin; el resto del sistema solo la LEE.
    PLAN_CONSOLIDADA: {
        sheet: SHEETS.PLAN_CUENTAS,
        start: 'R',
        end: 'R',
        columns: { nombre: 'R' }
    },

    // --- Cargas: layout Fix (titulo B2, header fila 6, datos filas 7-21, numeracion B7:B21) ---
    // decision Franco 2026-08-13: la geometria de la grilla de carga entra a Config como SSOT.
    // Antes vivia como literal 'I5:O19' en 06_RegistrosService y como numeros magicos (9, 12,
    // 13, 14) en 14_EventHandlers, que ademas usaba DATA_START_ROW (=4) como fila de datos: eso
    // dejaba la fila de encabezado dentro del area "editable" del autocompletado.
    CARGAS: {
        get sheet() { return SHEETS.DATA_ENTRY; },  // getter: preserva la resolucion perezosa del alias
        start: 'C',
        end: 'I',
        headerRow: 6,
        dataRow: 7,
        filas: 15,   // grilla de altura fija C7:I21; no crece, se limpia despues de cada lote
        columns: { monto: 'C', tipo: 'D', cuenta: 'E', medio: 'F', moneda: 'G', fecha: 'H', nota: 'I' }
    },

    // --- Registros: layout Fix (titulo B2, header fila 6, datos fila 7, cols B:M) ---
    // decision Franco 2026-08-13: se adapta el CODIGO al layout nuevo de la planilla, no al reves.
    // El orden de columnas B:M no cambio entre la vieja y la Fix; solo bajo una fila.
    REGISTROS: {
        sheet: SHEETS.REGISTROS,
        start: 'B',
        end: 'M',
        headerRow: 6,
        dataRow: 7,
        columns: {
            monto: 'B', tipo: 'C', cuenta: 'D', tipo_cuenta: 'E',
            medio: 'F', moneda: 'G', fecha: 'H', nota: 'I',
            tc_ars: 'J', tc_usd: 'K', tc_aud: 'L', tc_eur: 'M'
        }
    },

    // --- Tipos de Cambio: layout Fix (titulos de bloque fila 6, header fila 7, datos fila 8) ---
    // Bloques horizontales: ARS=C:D | USD=F:G | AUD=I:J | EUR=L:M
    TC_ARS: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'C',
        end: 'D',
        headerRow: 7,
        dataRow: 8,
        columns: { fecha: 'C', cotizacion: 'D' }
    },
    TC_USD: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'F',
        end: 'G',
        headerRow: 7,
        dataRow: 8,
        columns: { fecha: 'F', cotizacion: 'G' }
    },
    TC_AUD: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'I',
        end: 'J',
        headerRow: 7,
        dataRow: 8,
        columns: { fecha: 'I', cotizacion: 'J' }
    },
    TC_EUR: {
        get sheet() { return SHEETS.TIPOS_CAMBIO; },  // getter: preserva la resolucion perezosa del alias
        start: 'L',
        end: 'M',
        headerRow: 7,
        dataRow: 8,
        columns: { fecha: 'L', cotizacion: 'M' }
    }
};

// ============================================
// CATÁLOGOS FIJOS (SIN BD)
// ============================================

// ADR-003: Las monedas disponibles se gestionan como constante de backend.
// No requieren una tabla en la hoja de cálculo.
const MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR'];

// decision Franco 2026-08-19: RIQUEZA se define por LISTA BLANCA, no por lista negra.
// Solo los tipos de categoria de abajo componen la situacion patrimonial. Todo lo demas
// -- Hogar, Financiacion y lo que se agregue -- es macrosegmentacion de analisis, no capital.
//
// Antes las formulas preguntaban "todo lo que NO sea Hogar", con dos consecuencias malas:
// (1) FINANCIACION sumaba como patrimonio, o sea una tarjeta de credito contaba como capital
//     cuando es un pasivo; (2) cualquier tipo nuevo entraba a riqueza sin que nadie lo decidiera,
//     por el solo hecho de no llamarse Hogar. Una lista blanca obliga a decidir.
//
// OJO al tocar esto: hay DOS usos distintos del tipo de categoria en las formulas y solo UNO
// se rige por esta constante. "Es riqueza?" -> aca. "Es flujo cotidiano?" (los bloques que
// incluyen 'Inicio Mes' cuando el medio es de casa, y los saldos de Inicio!C8 / Tablero!AF9:AF12)
// -> sigue siendo el tipo Hogar y NO depende de esta lista. Confundirlos rompe el saldo
// cotidiano, que hoy cierra al centavo contra el ledger.
// @see DEVTOOL_RiquezaYCategorias.js
const TIPOS_RIQUEZA = ['Ahorros', 'Inversiones'];

// Los cuatro tipos que puede declarar un MEDIO: donde esta la plata, no para que se movio.
//
// decision Franco 2026-08-20: entran como constante de backend, mismo criterio que
// MONEDAS_DISPONIBLES (ADR-003), porque son un dominio cerrado que se decide y no una tabla que
// el usuario administre. Existe porque el ABM del menu diario llenaba el desplegable del Tipo de
// un medio con el catalogo de CATEGORIAS DE CUENTA -- las dos cosas se leian de la misma columna
// P --, y con eso se podia dejar un medio con tipo "Alimentacion y social". Son dos ejes
// independientes: el medio dice DONDE, la cuenta dice PARA QUE, y cada uno tiene su dominio.
//
// TIPOS_RIQUEZA es un SUBCONJUNTO de esta lista: los que componen patrimonio.
const TIPOS_MEDIO = ['Hogar', 'Ahorros', 'Inversiones', 'Financiación'];

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
 * La cuenta que marca un PUNTO DE CORTE de conciliacion, no un movimiento.
 *
 * Es neutra como el traspaso, pero por una razon distinta y eso importa: un traspaso mueve plata
 * de un bolsillo a otro, y cuando el bolsillo de destino es un frasco ESO SI ES capitalizar. Un
 * "Inicio Mes" no mueve nada -- declara cuanto habia. Por eso hay modulos que aceptan traspasos y
 * rechazan arrastres, y necesitan poder nombrar a este por separado.
 *
 * decision Franco 2026-08-20: entra a Config porque ya lo usan cuatro modulos. Antes vivia como
 * SYF_ARRASTRE dentro de DEVTOOL_StockYFlujo y los demas lo tomaban de ahi por el scope global de
 * Apps Script -- funciona, pero es una dependencia invisible que ningun banco de pruebas puede
 * cargar sin arrastrar un modulo que no tiene nada que ver.
 *
 * Se elimino el alias `SYF_ARRASTRE = CUENTA_ARRASTRE` en vez de dejarlo por compatibilidad: un
 * `const` de un archivo que referencia el `const` de otro solo funciona si Apps Script evalua los
 * archivos en el orden correcto. Hoy lo hace -- "00_" ordena antes que "DEVTOOL_" --, pero es una
 * bomba que estalla el dia que alguien renombra un archivo. Sin alias, no hay orden que importe.
 */
const CUENTA_ARRASTRE = 'Inicio Mes';

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
            // decision Franco 2026-08-18 (post-swap): el submenu queda REDUCIDO a los dos
            // items que todavia tienen trabajo por delante. El swap ya se aplico en produccion
            // el 2026-08-18, asi que los otros tres pasos no son "el proximo paso" de nada:
            // son botones cargados apuntando a la planilla viva. Criterio item por item:
            //   1. Ver estado -> SE CONSERVA. Solo lectura, y es la herramienta con la que
            //      Franco verifica el swap antes de purgar. Nunca escribe una celda.
            //   2. Sincronizar BDs -> SALE. Su trabajo (copiar a las Fix lo cargado en las
            //      viejas entre la duplicacion y el swap) ya esta hecho y no se repite. Ademas
            //      leeria "Registros" con la geometria VIEJA -- datos desde la fila 6, que hoy
            //      es el ENCABEZADO -- y copiaria basura al ledger. Su docstring ya decia
            //      "FUERA DEL MENU": hasta hoy era falso, la entrada seguia viva aca.
            //   3. Aplicar swap -> SALE. No se aplica dos veces; su propio preflight lo
            //      rechaza, pero un item de menu que solo puede contestar "ya se hizo" es
            //      ruido en un menu donde el vecino de al lado si escribe.
            //   4. Revertir -> SALE, y es la que mas importa sacar. Es la unica del quinteto
            //      que HOY funcionaria de punta a punta (swap aplicado, respaldos vivos, sin
            //      purgar) y NO pedia ninguna confirmacion: un clic deshacia el rediseno
            //      entero -- renombra las 8 hojas, repuntea las formulas al reves -- dejando
            //      la planilla en el layout viejo contra un 00_Config.js que describe el
            //      nuevo, es decir el sistema roto de los dos lados. Sigue existiendo como
            //      salida de emergencia deliberada desde el editor y ahora exige confirmar.
            //   5. Purgar respaldos -> SE CONSERVA aunque sea IRREVERSIBLE: es el unico paso
            //      que le queda pendiente a Franco (purgar recien despues de validar los
            //      tableros). Ya exige cero referencias vivas + confirmacion explicita del
            //      operador, y sin UI no corre.
            // @see MIGRACION_v0.11_SwapHojasFix.js
            submenu: 'Migracion v0.11 (swap hojas Fix)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoSwapV011' },
                { separator: true },
                { name: '2. Purgar respaldos (IRREVERSIBLE)', function: 'purgarRespaldosV011' }
            ]
        },
        // decision Franco 2026-08-18: la MIGRACION v0.9.5 SALE DEL MENU con el swap v0.11.
        // Su preflight cruza contra RANGES esperando la geometria pre-Fix (Registros header 5,
        // TC en B:C..K:L): con el config remapeado solo puede reportar incoherencia, y su
        // "revertir" restauraria un respaldo con el layout anterior al rediseno. El archivo
        // MIGRACION_v0.9.5_LayoutNuevo.js se conserva entero como historia ejecutable.
        { separator: true },
        { seccion: 'FORMULAS Y VISTAS' },
        {
            // Repara los cuatro defectos que el swap v0.11 dejo en las formulas de "Inicio" y
            // "Tablero": anclas corridas tres filas respecto del derrame del motor, el selector
            // de moneda perdido como #REF!, el bloque "Disponibilidad de fondos" rotado una
            // posicion respecto de sus rotulos, y el tipo de categoria 'Liquidez' que ya no
            // existe en el catalogo. Se corren EN ESTE ORDEN: estado (solo lectura) y despues
            // aplicar. @see DEVTOOL_FormulerioV0111.js
            // Lleva la definicion de RIQUEZA de lista negra ("todo lo que no sea Hogar", que hacia
            // que una tarjeta de credito contara como patrimonio) a la lista blanca de
            // TIPOS_RIQUEZA, y llena la columna AB del bloque de categorias con el Tipo -- el
            // rotulo AB8 ya decia "Tipo" y la columna estaba vacia a proposito desde el rediseno.
            // @see DEVTOOL_RiquezaYCategorias.js
            // Separa STOCK de FLUJO: los saldos dejan de filtrarse por mes y pasan a leer el
            // ledger entero, los asientos 'Inicio Mes' dejan de tener efecto (sin borrarlos), y
            // el bloque "Movimientos del Mes" suma la fila que le faltaba para cerrar en 100%.
            // @see DEVTOOL_StockYFlujo.js
            // Da de alta en el Plan de Cuentas las 12 cuentas que el ledger usa hace anios y
            // el catalogo nunca tuvo -- entre ellas 'Ajuste', el mecanismo de conciliacion de
            // Franco con 70 movimientos. @see DEVTOOL_AltaCuentas.js
            // Crea la BD de Proyeccion (espejo de Registros) y cablea el bloque "Presupuesto
            // Asignado" del Tablero, que hasta ahora eran tres constantes tipeadas a mano.
            // @see DEVTOOL_Proyeccion.js
            submenu: 'BD de Proyeccion (presupuesto)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoProyeccion' },
                { name: '2. Crear y cablear', function: 'aplicarProyeccion' }
            ]
        },
        {
            // Siembra la hoja Proyeccion con un presupuesto base derivado del historial real:
            // el promedio mensual de cada cuenta sobre los ultimos meses completos. Sin esto la
            // hoja nace vacia y "Presupuesto Asignado" no tiene contra que comparar.
            // @see DEVTOOL_PresupuestoBase.js
            // La Capacidad de Capitalizacion deja de ser un residuo y pasa a sumar lo que va a
            // los medios de riqueza; y la Disponibilidad de fondos deja de volcar todo en una
            // sola fila cuando las tres categorias se pasaron del presupuesto.
            // @see DEVTOOL_Capitalizacion.js
            // Termina la hoja Inicio: el bloque "Presupuesto del Mes" (D19:G22 -- proyectado,
            // realidad, barra de consumo y distribucion) y los tres deltas contra la media de
            // los ultimos 6 meses. @see DEVTOOL_InicioPresupuesto.js
            submenu: 'Hoja Inicio (presupuesto y deltas)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoInicioPresupuesto' },
                { name: '2. Aplicar', function: 'aplicarInicioPresupuesto' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirInicioPresupuesto' }
            ]
        },
        {
            // Cablea el selector de Modo (E7) de la hoja "Presupuesto" -- hasta ahora texto sin
            // ninguna formula que lo leyera -- y llena J/N/R (filas 9-38, 30 cuentas x 3
            // bloques) con el monto que corresponde a cada modo (mes de referencia en
            // Proyeccion, promedio ponderado exponencial de 6 meses en Historico), mas sus
            // titulos dinamicos. La columna V, las dos tablas resumen y "Guardar Proyeccion"
            // quedan para un encargo posterior. @see DEVTOOL_PresupuestoModo.js
            // @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
            submenu: 'Presupuesto: selector de Modo', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoPresupuestoModo' },
                { name: '2. Aplicar', function: 'aplicarPresupuestoModo' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirPresupuestoModo' }
            ]
        },
        {
            submenu: 'Capitalizacion y disponibilidad', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoCapitalizacion' },
                { name: '2. Aplicar', function: 'aplicarCapitalizacion' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirCapitalizacion' }
            ]
        },
        {
            submenu: 'Presupuesto base (desde el historial)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoPresupuestoBase' },
                { name: '2. Cargar', function: 'aplicarPresupuestoBase' },
                { name: '3. Quitar la carga', function: 'quitarPresupuestoBase' }
            ]
        },
        {
            // Ordena las 60 cuentas en 22 categorias y le da a cada categoria su tipo. La
            // categoria agrupa dentro del bloque; el TIPO cruza los bloques y es lo que permite
            // preguntar cuanto cuesta el auto entre fijos y variables. @see DEVTOOL_CategorizarCuentas.js
            // Saca el nivel intermedio del eje de medios: cada medio declara su TIPO directo.
            // Catalogo y formulas se escriben JUNTOS -- son inseparables. @see DEVTOOL_TipoDeMedios.js
            // Deja el Plan de Cuentas en su forma final: todas las categorias en P y los restos
            // de las migraciones barridos. @see DEVTOOL_LimpiarPlanCuentas.js
            // El bloque "Categorias" del Tablero agrupaba por el TIPO DEL MEDIO desde la
            // v0.20.0; pasa a agrupar por la CATEGORIA DE LA CUENTA. @see DEVTOOL_BloqueCategorias.js
            submenu: 'Bloque Categorias del Tablero', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoBloqueCategorias' },
                { name: '2. Aplicar', function: 'aplicarBloqueCategorias' }
            ]
        },
        // decision Franco 2026-08-24: SALEN DEL MENU 'Limpiar Plan de Cuentas' y 'Tipo de
        // medios'. Los dos YA CORRIERON sobre la planilla y sus constantes describen el Plan
        // de ANTES de que corrieran, no el de hoy. El patron estado/aplicar de este repo
        // protege contra escribir MAL; no protege contra escribir DOS VECES con un catalogo
        // congelado en el momento en que se escribio el modulo. Concretamente:
        //   - 'Limpiar Plan de Cuentas' borra lo que su lista declara como resto de migracion.
        //     Esa lista es de antes del alta de la categoria 'Seguros' (Plan!P29): un segundo
        //     clic se la lleva puesta.
        //   - 'Tipo de medios' reescribe el Tipo de CADA medio desde su catalogo interno, y
        //     revierte en silencio los que Franco edito a mano en la hoja despues.
        // Los archivos se conservan enteros: lo que se saca es la PUERTA, no el codigo. Para
        // reponerlos hay que actualizar antes sus constantes contra la planilla viva.
        {
            // decision Franco 2026-08-21: el modulo existia desde el 2026-08-20 pero nunca se
            // habia cableado, asi que no habia forma de correrlo desde la planilla.
            submenu: 'Color de los medios (Tablero)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoFormatoMedios' },
                { name: '2. Aplicar', function: 'aplicarFormatoMedios' },
                { separator: true },
                { name: '3. Revertir (quita solo sus reglas)', function: 'revertirFormatoMedios' }
            ]
        },
        {
            // decision Franco 2026-08-21: cada cuenta de Ingresos/Gastos Fijos/Gastos Variables
            // pasa a ocupar dos filas (real oscura + faltante proyectado gris) en vez de una.
            // @see DEVTOOL_TableroFaltanteProyectado.js
            submenu: 'Faltante proyectado (Tablero)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoTableroFaltanteProyectado' },
                { name: '2. Aplicar', function: 'aplicarTableroFaltanteProyectado' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirTableroFaltanteProyectado' }
            ]
        },
        {
            submenu: 'Categorizar cuentas', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoCategorizar' },
                { name: '2. Aplicar', function: 'aplicarCategorizar' }
            ]
        },
        {
            submenu: 'Alta de cuentas faltantes', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoAltaCuentas' },
                { name: '2. Aplicar', function: 'aplicarAltaCuentas' }
            ]
        },
        {
            // Crea el bloque OCULTO de cuentas comodin en el Plan de Cuentas (T:U) y lo suma a
            // la consolidada, para que el desplegable de Cuenta de la hoja de Cargas ofrezca
            // "Traspaso" e "Inicio Mes" en vez de que se tipeen a mano -- que es de donde
            // salen las variantes "traspaso " e "Inicio  Mes" que documenta CUENTAS_NEUTRAS.
            // No toca una sola fila del ledger ni mueve la cuenta 'Ajuste'.
            // @see DEVTOOL_CuentasComodin.js
            submenu: 'Cuentas comodin (bloque oculto)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoCuentasComodin' },
                { name: '2. Aplicar', function: 'aplicarCuentasComodin' },
                { separator: true },
                { name: '3. Revertir', function: 'revertirCuentasComodin' }
            ]
        },
        // decision Franco 2026-08-24: SALE DEL MENU 'Conciliar saldos', y es la mas urgente de
        // las tres. No es un modulo roto: es un modulo que YA CUMPLIO y quedo apuntando a un
        // estado que ya no existe. CONC_OBJETIVOS (DEVTOOL_ConciliarSaldos.js:50) tiene SIETE
        // saldos escritos a mano del 2026-08-19, y CONC_RESTO_EN_CERO = true (:61) significa
        // "todo medio del Plan que no este en esa lista tiene saldo cero". El catalogo tiene
        // QUINCE medios. O sea que "2. Cargar los ajustes", hoy, forzaria siete medios a sus
        // saldos de hace cinco dias y PONDRIA LOS OTROS OCHO EN CERO, con asientos reales en
        // el ledger. Un boton al que solo se le puede acertar el dia que se escribio.
        // El archivo se conserva entero -- su calculo del saldo teorico (ultimo 'Inicio Mes'
        // de cada medio + todo lo posterior, validado 5/7 al centavo) es la base de la
        // pantalla de Conciliacion del centro de operaciones, que SI va a pedir los saldos en
        // vez de tenerlos escritos. @see DEVTOOL_ConciliarSaldos.js
        {
            submenu: 'Stock y flujo', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoStockYFlujo' },
                { name: '2. Aplicar', function: 'aplicarStockYFlujo' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirStockYFlujo' }
            ]
        },
        {
            submenu: 'Riqueza y categorias', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoRiquezaCategorias' },
                { name: '2. Aplicar', function: 'aplicarRiquezaCategorias' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirRiquezaCategorias' }
            ]
        },
        {
            submenu: 'Formulerio v0.11 (Inicio + Tablero)', items: [
                { name: '1. Ver estado (no escribe nada)', function: 'estadoFormulerioV0111' },
                { name: '2. Aplicar reparacion', function: 'aplicarFormulerioV0111' },
                { separator: true },
                { name: '3. Revertir (usa el respaldo)', function: 'revertirFormulerioV0111' }
            ]
        },
        {
            submenu: 'Mirada Interanual', items: [
                { name: '1. Verificar precondiciones', function: 'verificarPrecondicionesMirada' },
                { name: '2. Inicializar formulas', function: 'inicializarMiradaInteranual' },
                { separator: true },
                { name: 'Diagnosticar (hoja DEBUG)', function: 'diagnosticarMiradaInteranual' },
                { name: 'Auditar balanceo de la formula', function: 'auditarBalanceFormulaMirada' }
            ]
        },
        // decision Franco 2026-08-18: 'Robustez de vistas' SALE DEL MENU con el swap v0.11.
        // Su lista cerrada RV_CELDAS (Tablero!AN4, Inicio!Y4/AM4, Cargas!R5) fue verificada
        // sobre las hojas PRE-Fix: post-swap esas celdas no son los motores de las hojas
        // nuevas y estado/aplicar operarian sobre celdas equivocadas. El archivo
        // DEVTOOL_RobustezVistas.js se conserva; re-verificar sus anclas en el formulerio.
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
        { name: 'Exportar arquitectura (gemelo digital)', function: 'exportarArquitecturaTotal' },
        {
            // decision Franco 2026-08-24: "Las 50 hojas de respaldo acumuladas eliminalas.
            // Generan ruido". Lo UNICO irreversible de este repo (una hoja borrada no vuelve):
            // por eso, a diferencia de sus vecinos de este menu, NO tiene "3. Revertir".
            // Corre SIEMPRE primero "1. Ver estado" -- no borra nada -- y recien despues
            // "2. Aplicar", que pide confirmacion explicita con el numero exacto de hojas.
            // @see DEVTOOL_PurgaRespaldos.js
            submenu: 'Purgar respaldos acumulados (IRREVERSIBLE)', items: [
                { name: '1. Ver estado (no borra nada)', function: 'estadoPurgaRespaldos' },
                { name: '2. Aplicar (borra, no se puede deshacer)', function: 'aplicarPurgaRespaldos' }
            ]
        },
        // ENTRADA TEMPORAL -- decision Franco 2026-08-21: auditoria de desplegables de Plan de
        // Cuentas y Cargas (columna R en rojo + desplegables cerrados). Correrla UNA vez, copiar
        // la hoja "DIAG_Desplegables_TEMP" que genera, y despues BORRAR esta entrada junto con
        // src/DEVTOOL_DIAG_Desplegables.js entero. @see DEVTOOL_DIAG_Desplegables.js
        { separator: true },
        { name: 'DIAG TEMPORAL: medir desplegables (Plan de Cuentas + Cargas)', function: '_DIAG_medirDesplegables' },
        // ENTRADA TEMPORAL -- decision Franco 2026-08-24: confirmar en vivo si J7/N7/R7 de
        // "Presupuesto" (o su vecina K/O/S) son celdas COMBINADAS, para cerrar con evidencia la
        // duda del incidente de v0.45.0 (la causa real ya esta identificada y arreglada en
        // DEVTOOL_PresupuestoModo.js -- ver "EL INCIDENTE DE v0.45.0" en su cabecera -- pero
        // Franco pidio la medicion en vivo de todas formas). Solo lectura. Correrla, confirmar,
        // y BORRAR esta entrada junto con src/DEVTOOL_DIAG_PresupuestoTitulos.js entero.
        // @see DEVTOOL_DIAG_PresupuestoTitulos.js
        { name: 'DIAG TEMPORAL: medir titulos combinados (Presupuesto, incidente v0.45.0)', function: '_DIAG_medirTitulosPresupuesto' }
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
