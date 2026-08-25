/**
 * ============================================================================
 * NO LISTO -- FUERA DE SERVICIO DESDE EL 2026-08-13. NO EJECUTAR.
 * ============================================================================
 *
 * Este modulo NO esta en el menu (decision Franco 2026-08-13, ver MENU_CONFIG en 00_Config.js).
 * Sus funciones publicas siguen existiendo en el proyecto, asi que se pueden invocar a mano desde
 * el editor de Apps Script: NO HACERLO. Escribe formulas sobre "Tablero" e "Inicio", las dos
 * vistas que Franco mira todos los dias.
 *
 * BLOQUEANTES ABIERTOS (tres rondas adversariales, ninguna cerrada):
 *   1. Depende de una hoja "Presupuesto" que hoy no existe: la crea DEVTOOL_Presupuesto.js, que
 *      tambien esta fuera de servicio y puede declarar exito sobre una hoja en ceros. Cablear
 *      contra eso deja "Tablero"!S13:S15 -- la entrada del motor de Disponibilidad de Fondos --
 *      leyendo celdas vacias o cero, y el motor no distingue "cero presupuestado" de "sin dato".
 *   2. La cirugia sobre formulas vivas (leer, transformar, escribir) mas su maquina de estados de
 *      respaldo y reversion es donde aparecieron los defectos ronda tras ronda. Sobre formulas
 *      que ya funcionan, el riesgo no se compensa con el beneficio de adelantar esta pieza.
 *   3. La conexion 3 (guard de exclusion de cuentas neutras) hoy no cambia nada -- las cuatro
 *      formulas ya excluyen Traspaso e Inicio Mes --, asi que no hay urgencia que justifique
 *      correr las otras dos antes de tiempo.
 *
 * POR QUE SE CONSERVA EL ARCHIVO: el relevamiento celda por celda que documenta (que vive, que es
 * cascaron, que numeros estan tipeados a mano en el Tablero) es evidencia verificada en vivo el
 * 2026-08-13 y es de donde arranca la sesion dedicada.
 *
 * PARA VOLVER A HABILITARLO: primero DEVTOOL_Presupuesto.js, despues cerrar los bloqueantes de
 * aca, reponer el submenu "Presupuesto - cablear las vistas" en MENU_CONFIG.DEV_ITEMS, y recien
 * ahi correr "1. Ver estado del cableado".
 *
 * ============================================================================
 *
 * DEVTOOL_CableadoPresupuesto.js
 * Cableado del Presupuesto con las vistas que ya existen.
 *
 * [CONCEPTO DE NEGOCIO]
 * "El presupuesto es esa herramienta que mide tu comportamiento financiero historico y te
 * ayuda a pensar en tu proximo mes financiero, armando un presupuesto que divide tus ingresos
 * entre Gastos Fijos, Gastos Variables y Ahorro" (Franco). De ahi sale la Disponibilidad de
 * Fondos: cuanto de la plata que hay HOY le toca a cada macro grupo segun la proporcion
 * presupuestada.
 *
 * El Presupuesto no es una idea nueva en esta planilla: es una OBRA PARADA. Alguien dibujo la
 * UI en "Inicio", escribio el motor en el "Tablero", y nunca cablo la fuente. Verificado en
 * vivo el 2026-08-13, celda por celda:
 *
 *   - "Tablero"!Q11:U17 ("Control de Presupuesto") esta vivo, pero sus tres montos
 *     presupuestados -- S13 Ingresos, S14 Gastos Fijos, S15 Gastos Variables -- son NUMEROS
 *     TIPEADOS A MANO. Sin mes, sin moneda, sin historial.
 *   - "Tablero"!Q20:U24 ("Disponibilidad de fondos") es el motor que Franco describe, y
 *     FUNCIONA: T22+T23+T24 = 9+14+77 = 100 sobre una liquidez de 100. Lee S13:S15. Este
 *     modulo NO LO TOCA.
 *   - "Inicio"!I14:K18 ("Presupuesto del Mes.") es un cascaron: rotulos dibujados
 *     (Composicion / % / Disponibilidad, y las filas Capacidad de Ahorro / Gastos Fijos /
 *     Gastos Variables) con SEIS CELDAS VACIAS, J16:K18, sin una sola formula.
 *
 * Este modulo es el CABLE. No disena nada, no calcula nada nuevo, no mueve un rotulo: conecta
 * lo que ya esta construido. Son tres conexiones independientes entre si.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6, puntos 3, 6 y 7: toda operacion sobre datos vivos es idempotente,
 * tiene respaldo congelado y VERIFICADO antes de mutar, y las formulas se intervienen por
 * CIRUGIA -- se lee la formula viva, se la transforma, se la escribe. Jamas se regenera: el
 * SELECT/WHERE/LABEL de cada QUERY y el cuerpo de cada LET son logica de negocio que este
 * modulo no conoce, no interpreta y no reescribe.
 *
 * Ciclo cerrado, en este orden:
 *   estadoCableadoPresupuesto()   -> que cambiaria. NO ESCRIBE NADA. Se corre primero, siempre.
 *   aplicarCableadoPresupuesto()  -> preflight + respaldo verificado + las conexiones aplicables.
 *   revertirCableadoPresupuesto() -> restaura el contenido original desde el respaldo.
 *
 * LAS TRES CONEXIONES
 *
 *   1. "Tablero"!S13:S15  <- hoja "Presupuesto" por INDEX/MATCH del mes del selector (I4/I6).
 *      Es la unica pieza que le faltaba al motor de Q20:U24. S17 (=S13-S14-S15, Capacidad de
 *      Ahorro) queda como esta: es derivada, y derivarla es correcto.
 *
 *   2. "Inicio"!J16:K18   <- espejo del bloque del Tablero, para que los dos numeros sean
 *      IDENTICOS en ambas vistas por construccion y no por coincidencia.
 *
 *   3. Exclusion de las CUENTAS NEUTRAS -- Traspaso e Inicio Mes, los movimientos que no son
 *      ingreso ni gasto -- en las formulas que suman INGRESOS. Ver CP_CELDAS_INGRESOS: al
 *      2026-08-13 las cuatro ya las excluyen, asi que la conexion 3 es hoy un GUARD, no un
 *      cambio. Existe porque el dia que alguien edite una de esas formulas y se coma la
 *      condicion, los ingresos se inflan un 77 % sin que nada se ponga rojo.
 *
 * DOS COSAS QUE ESTE MODULO VERIFICA ANTES DE ESCRIBIR, Y POR QUE
 *
 *   a. LA GEOMETRIA DEL TABLERO GOBIERNA TODA CONEXION QUE DEPENDA DE ELLA, no solo la que la
 *      lee mas de cerca. Los rotulos Q13:Q15 son lo que le da significado a S13:S15, y las seis
 *      formulas de "Inicio" no calculan nada: MUESTRAN esas celdas. Un guard que solo protegiera
 *      a la conexion 1 dejaria que la 2 espeje un bloque reordenado. Ver
 *      _verificarGeometriaTableroCP.
 *
 *   b. EL CONTRATO CON "Presupuesto" INCLUYE QUE HAYA NUMEROS, no solo que la geometria cierre.
 *      Se comprueba que exista una fila -- una sola, y que el MATCH exacto la vaya a encontrar --
 *      para el mes del selector, y que sus tres montos SEAN numeros. Cablear contra vacio deja
 *      S13:S15 en cero, el motor repartiendo sobre cero, y reemplaza por ceros el unico
 *      presupuesto que Franco tiene cargado. Ver _verificarDatosPresupuestoCP.
 *
 * DOS REGLAS DEL RESPALDO, cicatrices del arnes (seccion 12, puntos 4 y 5):
 *   a. RESPALDO VERIFICADO. Se releen las celdas congeladas antes de mutar una sola celda, y
 *      se exige que NINGUNA haya quedado como formula viva en la hoja de respaldo.
 *   b. RESPALDO INMUTABLE. Mientras exista una corrida sin revertir, el respaldo original no se
 *      pisa: un reintento le APENDEA filas. Un respaldo nuevo seria la foto de las vistas ya
 *      cableadas y revertir devolveria a ese estado declarando exito.
 *
 * Contrato de retorno de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 * Cuando una falla ocurre DESPUES de haber escrito, el mensaje nunca dice "no se modifico" sino
 * "no se pudo confirmar": el modulo no afirma sobre lo que no verifico.
 *
 * @see docs/permanente/ARNES_TIDETRACK.md (seccion 6: gobernanza)
 * @see docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md (seccion 14: el hueco del Presupuesto)
 * @see DEVTOOL_RobustezVistas.js (modulo hermano: mismo contrato, mismo criterio de respaldo)
 * @see MIGRACION_v0.9.5_LayoutNuevo.js (modulo molde del trio estado/aplicar/revertir)
 * @see 00_Config.js (SHEETS / NAV_CONFIG: unico origen de nombres de hoja)
 *
 * @version 0.9.11
 * @since 0.9.11
 * @lastModified 2026-08-13
 */

// ============================================
// CONSTANTES
// ============================================

var CP_VERSION = '0.9.11';

/** Clave del estado en DocumentProperties. Auditoria + puntero al respaldo, NO fuente de verdad. */
var CP_PROP_ESTADO = 'CABLEADO_PRESUPUESTO_ESTADO';

/** Prefijo de las claves que guardan el contenido original verbatim (una por celda). */
var CP_PROP_ORIGINAL_PREFIJO = 'CABLEADO_PRESUPUESTO_ORIGINAL::';

/** Prefijo de la hoja de respaldo (oculta, fechada). */
var CP_RESPALDO_PREFIJO = 'RESP_CABLEADO_';

/** Milisegundos de espera por el lock del documento. */
var CP_LOCK_MS = 30000;

// ============================================
// CONTRATO CON LA HOJA "Presupuesto"
// ============================================

// decision Franco 2026-08-13: este modulo y la hoja "Presupuesto" se construyen EN PARALELO,
// asi que la geometria de la hoja no se puede dar por sabida: se DECLARA como contrato y se
// VERIFICA contra la planilla viva antes de escribir una sola formula. Si lo que hay no coincide
// con lo declarado, el modulo ABORTA la conexion 1 y reporta la geometria que encontro, con
// nombre y letra de columna, para que corregir el contrato sea una linea. Nunca adapta el
// cableado a lo que "parece" estar: escribir un INDEX contra la columna equivocada produce
// numeros plausibles y falsos, que es la unica clase de error que esta planilla no puede
// permitirse -- un #REF! se ve, un presupuesto que apunta a la columna de al lado no.
//
// La geometria declarada sale de MAPA_ARQUITECTURA_PLANILLA.md seccion 14.7 ("Tabla por mes:
// mes | ano | moneda | ingreso_base | pres_fijos | pres_variables | pres_ahorro").
//
// pres_ahorro NO se cablea a ninguna celda: "Tablero"!S17 ya lo deriva como S13-S14-S15, y
// tener dos definiciones de lo mismo (una cargada, otra derivada) es exactamente el defecto
// que el contrato de calculo prohibe. Si la hoja declara un pres_ahorro propio, el estado lo
// reporta como aviso para que la diferencia se resuelva a mano, no en silencio.
var CP_ALIAS_PRESUPUESTO = ['Presupuesto'];

var CP_CONTRATO = {
    version: 1,
    filaHeader: 5,
    filaDatos: 6,
    /** Ultima columna que se inspecciona al buscar los rotulos del header (A..T). */
    colBusquedaHasta: 20,
    /**
     * clave -> { letra declarada, rotulos aceptados (ya normalizados), descripcion }.
     * Los rotulos se comparan normalizados: minusculas, sin acentos, sin espacios ni puntuacion.
     */
    columnas: {
        mes: {
            letra: 'B',
            rotulos: ['mes'],
            descripcion: 'mes en texto capitalizado, con el mismo formato que el selector Tablero!I4 ("Junio")'
        },
        ano: {
            letra: 'C',
            rotulos: ['ano', 'anio', 'ejercicio'],
            descripcion: 'ano como numero, igual que el selector Tablero!I6 (2026)'
        },
        ingresos: {
            letra: 'E',
            rotulos: ['ingresobase', 'ingresopresupuestado', 'ingresos', 'ingreso', 'presingresos'],
            descripcion: 'monto presupuestado de INGRESOS -> Tablero!S13'
        },
        fijos: {
            letra: 'F',
            rotulos: ['presfijos', 'presupuestogastosfijos', 'gastosfijos', 'presgastosfijos'],
            descripcion: 'monto presupuestado de GASTOS FIJOS -> Tablero!S14'
        },
        variables: {
            letra: 'G',
            rotulos: ['presvariables', 'presupuestogastosvariables', 'gastosvariables', 'presgastosvariables'],
            descripcion: 'monto presupuestado de GASTOS VARIABLES -> Tablero!S15'
        }
    },
    /** Rotulos que, si aparecen en el header, se reportan como aviso (no se cablean). */
    avisar: {
        ahorro: ['presahorro', 'presupuestoahorro', 'ahorro', 'capacidaddeahorro'],
        moneda: ['moneda']
    }
};

// ============================================
// CONEXION 1: Tablero!S13:S15
// ============================================

/**
 * Selector del Tablero que gobierna el lookup del presupuesto: mes y ano.
 *
 * SSOT interno del modulo. Estas dos coordenadas las usan DOS caminos que tienen que decir lo
 * mismo -- la formula que se escribe en S13:S15 y la verificacion de que el mes del selector
 * este cargado en la hoja "Presupuesto" -- y si se declararan por separado podrian derivar: la
 * verificacion comprobaria un mes y la formula buscaria otro, que es la peor combinacion posible
 * (un ok que no verifico lo que se escribio).
 */
var CP_TABLERO_SELECTOR = { mes: 'I4', ano: 'I6' };

// decision Franco 2026-08-13: el guard de la conexion 1 es el ROTULO DE LA FILA, no la
// coordenada. Q13/Q14/Q15 dicen "Ingresos" / "Gastos Fijos" / "Gastos Variables" y esos rotulos
// son lo que le da significado a S13/S14/S15. Si alguien reordena el bloque, la coordenada
// sigue existiendo y el rotulo cambia: escribir el presupuesto de ingresos en la fila de gastos
// fijos no rompe nada visible, y el motor de Q20:U24 empieza a repartir mal la plata de Franco.
// Por eso el rotulo manda y una divergencia ABORTA la conexion sin escribir.
//
// El brief de esta tanda describia S13:S15 como (Gastos Fijos, Gastos Variables, Ahorro).
// La planilla viva dice otra cosa -- (Ingresos, Gastos Fijos, Gastos Variables), con el Ahorro
// DERIVADO en S17 = S13-S14-S15 -- y la planilla viva es la verdad del estado (principio rector
// del arnes). Este guard es justamente lo que convierte esa discrepancia en un aborto ruidoso
// en vez de en tres numeros mal puestos.
var CP_TABLERO_MONTOS = [
    {
        clave: 'ingresos', celda: 'S13', celdaRotulo: 'Q13', contrato: 'ingresos',
        rotulos: ['ingresos', 'ingreso'],
        rol: 'monto presupuestado de INGRESOS. Lo leen S17 (capacidad de ahorro), S22 y T22:T24 (motor de disponibilidad)'
    },
    {
        clave: 'fijos', celda: 'S14', celdaRotulo: 'Q14', contrato: 'fijos',
        rotulos: ['gastosfijos'],
        rol: 'monto presupuestado de GASTOS FIJOS. Lo leen S17, S23 (cumplimiento) y T22:T24'
    },
    {
        clave: 'variables', celda: 'S15', celdaRotulo: 'Q15', contrato: 'variables',
        rotulos: ['gastosvariables'],
        rol: 'monto presupuestado de GASTOS VARIABLES. Lo leen S17, S24 (cumplimiento) y T22:T24'
    }
];

/**
 * Celdas del Tablero que este modulo VERIFICA y NO TOCA. Son las que le dan sentido a las tres
 * que si cablea: si su forma cambio, el cableado sigue siendo correcto pero el bloque ya no
 * significa lo mismo, y eso tiene que aparecer en el informe.
 *
 * Para la conexion 1 son AVISO (escribir el presupuesto en S13:S15 sigue siendo correcto aunque
 * el motor haya cambiado de forma). Para la conexion 2 son BLOQUEANTE, porque las seis celdas de
 * "Inicio" no calculan nada: MUESTRAN estas. Ver _verificarGeometriaTableroCP.
 */
var CP_TABLERO_TESTIGOS = [
    { celda: 'S17', celdaRotulo: 'Q17', esperada: '=S13-S14-S15', que: 'Capacidad de Ahorro (derivada)' },
    { celda: 'T22', celdaRotulo: 'Q22', contiene: 'rem_ahorro', que: 'reparto de liquidez al bolsillo Ahorro' },
    { celda: 'T23', celdaRotulo: 'Q23', contiene: 'rem_fijos', que: 'reparto de liquidez al bolsillo Gastos Fijos' },
    { celda: 'T24', celdaRotulo: 'Q24', contiene: 'rem_var', que: 'reparto de liquidez al bolsillo Gastos Variables' }
];

// ============================================
// CONEXION 2: Inicio!J16:K18
// ============================================

// decision Franco 2026-08-13: "Inicio" ESPEJA el bloque del Tablero en vez de recalcularlo.
// El pedido era que los numeros sean identicos en ambas vistas; leer el Tablero lo garantiza
// por construccion, mientras que recalcular con los selectores propios de Inicio (P4/P6) lo
// garantiza solo mientras los dos selectores coincidan. Y recalcular significaria duplicar el
// LET de veinte lineas de T22:T24 -- dos motores para lo mismo es, palabra por palabra, el
// defecto que el contrato de calculo prohibe ("si dos hojas calculan lo mismo con criterios
// distintos, los numeros dejan de ser comparables").
//
// CONSECUENCIA ACEPTADA Y DECLARADA: este bloque de "Inicio" muestra el mes de Tablero!I4,
// no el de Inicio!P4. Cuando difieren, el estado lo reporta como aviso. Es una consecuencia
// visible y explicable; la alternativa era un segundo motor divergiendo en silencio.
var CP_INICIO = {
    titulo: { celda: 'I14', rotulos: ['presupuestodelmes'] },
    headers: [
        { celda: 'I15', rotulos: ['composicion'], que: 'columna de macro grupo' },
        { celda: 'J15', rotulos: ['%', 'porcentaje'], que: 'columna de porcentaje' },
        { celda: 'K15', rotulos: ['disponibilidad'], que: 'columna de disponibilidad' }
    ],
    /** Base del porcentaje: el ingreso presupuestado. Las tres proporciones suman 100 % exacto. */
    baseCelda: 'S13',
    filas: [
        {
            celdaRotulo: 'I16', rotulos: ['capacidaddeahorro', 'ahorro'],
            celdaPorcentaje: 'J16', origenPorcentaje: 'S17',
            celdaDisponibilidad: 'K16', origenDisponibilidad: 'T22'
        },
        {
            celdaRotulo: 'I17', rotulos: ['gastosfijos'],
            celdaPorcentaje: 'J17', origenPorcentaje: 'S14',
            celdaDisponibilidad: 'K17', origenDisponibilidad: 'T23'
        },
        {
            celdaRotulo: 'I18', rotulos: ['gastosvariables'],
            celdaPorcentaje: 'J18', origenPorcentaje: 'S15',
            celdaDisponibilidad: 'K18', origenDisponibilidad: 'T24'
        }
    ]
};

// decision Franco 2026-08-13: el fallback de las seis celdas de "Inicio" es CELDA EN BLANCO,
// nunca un cero. Son celdas de PRESENTACION -- nadie las lee aguas abajo, se leen con los ojos
// --, y ahi un "0 %" o un "$0" son afirmaciones falsas: dicen "tu presupuesto de gastos fijos
// es cero" o "no tenes fondos disponibles" cuando lo que pasa es que no hay presupuesto
// cargado para el mes, o que el motor esta en error. "No hay dato" y "el dato es cero" son
// estados distintos y la planilla no puede confundirlos. Mismo criterio que
// RV_FALLBACK_POR_DEFECTO en DEVTOOL_RobustezVistas.js, que ademas explica por que ahi el texto
// era veneno y aca no: aquellas celdas alimentan aritmetica aguas abajo, estas no alimentan nada.
var CP_INICIO_FALLBACK = '""';

// ============================================
// CONEXION 3: exclusion de Traspaso en los INGRESOS
// ============================================

// [FUNDAMENTO TEORICO / ADMINISTRATIVO] Por que existe esta exclusion, para quien la lea dentro
// de seis meses y le parezca arbitraria:
//
// Un TRASPASO es plata que se mueve de un bolsillo propio a otro (de la caja de ahorro al
// dolar, de Mercado Pago al banco). No es riqueza nueva: el patrimonio no cambia. Pero el
// pipeline lo escribe como DOS filas del ledger, una que sale y una que entra, y 533 de las
// 543 filas de traspaso quedaron con "Tipo de Cuenta" = Ingreso porque la pata que entra se
// clasifica como entrada. Sumar los ingresos sin excluirlas cuenta como sueldo cada vez que
// Franco movio plata de un bolsillo a otro: 31,1 M contra 17,5 M reales, un 77 % de inflacion.
// Medido, no estimado.
//
// decision Franco 2026-08-13: se arregla SOLO EN LAS FORMULAS DE LECTURA. No se migran las
// 2.904 filas del ledger ni se toca procesarCargas(). Los datos estan bien: son dos patas de
// un movimiento real y el ledger tiene que poder reconstruirlo (Tablero!I21 justamente
// comprueba que las dos patas cierren). Lo que esta mal es sumarlas como ingreso.
//
// "Inicio Mes" -- el asiento de apertura, el saldo con el que arranca cada caja el dia 1 -- es
// la OTRA cuenta neutra y es del mismo genero: un saldo de apertura tampoco es un ingreso del
// mes. Las cuatro formulas de CP_CELDAS_INGRESOS ya la excluyen, con la forma
// "(Col1 != 'Inicio Mes' OR Col5 = 'Liquidez')".

// decision Franco 2026-08-13: la fuente unica de las cuentas neutras es CUENTAS_NEUTRAS en
// 00_Config.js. Cuando se escribio este modulo la constante todavia no existia (la agrega otra
// pieza de esta tanda), asi que aca queda DECLARADO SU CONTRATO y el modulo la PREFIERE apenas
// aparezca -- mismo patron que _nombrePresupuestoCP con SHEETS.PRESUPUESTO. El dia que el SSOT
// la declare, este arreglo deja de usarse solo y sin tocar una linea; mientras tanto el concepto
// vive en un unico lugar de este archivo y no repartido por la logica.
//
// CONTRATO ESPERADO en 00_Config.js:
//   const CUENTAS_NEUTRAS = ['Traspaso', 'Inicio Mes'];
//   Valores de la columna D ("Cuenta") de Registros que NO son ingreso ni gasto: solo mueven
//   plata de lugar o inicializan un saldo. Toda formula que agregue ingresos o gastos las
//   excluye; el ledger las conserva porque son movimientos reales (Tablero!I21 comprueba que
//   las dos patas de cada traspaso cierren).
var CP_CUENTAS_NEUTRAS_CONTRATO = ['Traspaso', 'Inicio Mes'];

// decision Franco 2026-08-13: el GUARD cubre las DOS cuentas neutras; la CIRUGIA, solo Traspaso.
// No es una asimetria por descuido, es la unica forma segura de ampliar el alcance:
//   - Traspaso se excluye con una condicion de un solo termino ("Col1 != 'Traspaso'") que no
//     depende de ninguna otra columna: anteponerla al WHERE es una transformacion cerrada.
//   - "Inicio Mes" se excluye, en las cuatro formulas verificadas, como
//     "(Col1 != 'Inicio Mes' OR Col5 = 'Liquidez')" -- depende de Col5, la columna de tipo de
//     proyecto de la tabla VIRTUAL que arma cada ARRAYFORMULA. Este modulo no puede verificar
//     que Col5 exista ni que signifique lo mismo en cada una de ellas. Insertar la forma corta
//     ("Col1 != 'Inicio Mes'" a secas) CAMBIARIA la semantica: dejaria afuera tambien los saldos
//     de apertura de liquidez, que hoy cuentan. Eso es una decision de negocio, no una cirugia.
// Resultado: si a una formula le falta la exclusion de "Inicio Mes", el informe la nombra con
// celda y remedio y la arregla una persona. Antes de este arreglo, faltarla era INVISIBLE.
var CP_CUENTA_CIRUGIA = 'Traspaso';

/** Fragmento que se inserta al frente del WHERE cuando falta. */
var CP_EXCLUSION_TRASPASO = "Col1 != '" + CP_CUENTA_CIRUGIA + "'";

/**
 * Cuentas neutras vigentes: las del SSOT si ya existe, si no las del contrato declarado arriba.
 *
 * @returns {{lista: string[], fuente: string}}
 */
function _cuentasNeutrasCP() {
    if (typeof CUENTAS_NEUTRAS !== 'undefined' &&
        Object.prototype.toString.call(CUENTAS_NEUTRAS) === '[object Array]' &&
        CUENTAS_NEUTRAS.length > 0) {
        return { lista: CUENTAS_NEUTRAS.slice(), fuente: 'CUENTAS_NEUTRAS (00_Config.js)' };
    }
    return {
        lista: CP_CUENTAS_NEUTRAS_CONTRATO.slice(),
        fuente: 'CP_CUENTAS_NEUTRAS_CONTRATO (contrato local: 00_Config.js todavia no declara CUENTAS_NEUTRAS)'
    };
}

/**
 * Formulas que agregan INGRESOS (y sus hermanas de gasto, para que el informe muestre la
 * familia completa). Lista CERRADA y verificada celda por celda sobre la planilla productiva
 * el 2026-08-13. Es deliberadamente declarada y no el resultado de un escaneo: tocar a ciegas
 * cualquier formula que diga "Ingreso" intervendria formulas cuya semantica no se verifico.
 *
 *   modo 'cirugia'   -> si le falta la exclusion, se la inserta en el WHERE de su QUERY.
 *   modo 'auditoria' -> solo se reporta. Ver por que, mas abajo.
 */
// decision Franco 2026-08-13: las formulas con forma de LET (Inicio!I12, L12) son AUDITORIA y
// nunca cirugia. Insertar una condicion en un LET exige entender su grafo de variables --
// declarar una nueva, encontrar cada FILTER donde corresponde aplicarla, no romper el orden de
// declaracion -- y eso ya no es cirugia sobre una formula viva: es reescribirla. Este modulo no
// reescribe formulas. Si alguna vez a un LET le falta la exclusion, el informe lo dice con
// nombre y apellido y lo arregla una persona.
var CP_CELDAS_INGRESOS = [
    {
        hojaClave: 'tablero', celda: 'W4', modo: 'cirugia', marca: "Col3 = 'Ingreso'",
        rol: 'Pareto de ingresos por cuenta. Su total X2 = SUM(X4:X22) alimenta U13 ("Real" de Ingresos del Control de Presupuesto). ES el numero de ingresos del Tablero'
    },
    {
        hojaClave: 'inicio', celda: 'I10', modo: 'cirugia', marca: "Col3 = 'Ingreso'",
        rol: 'KPI "Ingresos." del mes en Inicio'
    },
    {
        hojaClave: 'inicio', celda: 'I12', modo: 'auditoria', marca: 'cond_ingreso_act',
        rol: 'variacion de ingresos contra el mes anterior (forma LET)'
    },
    {
        hojaClave: 'inicio', celda: 'L10', modo: 'auditoria', marca: "Col3 = 'Gasto Fijo'",
        rol: 'KPI "Egresos." del mes en Inicio (hermana de I10; se audita para ver la familia completa)'
    },
    {
        hojaClave: 'tablero', celda: 'Z4', modo: 'auditoria', marca: "Col3 = 'Gasto Fijo'",
        rol: 'Pareto de gastos fijos (alimenta AA2 -> U14)'
    },
    {
        hojaClave: 'tablero', celda: 'AC4', modo: 'auditoria', marca: "Col3 = 'Gasto Variable'",
        rol: 'Pareto de gastos variables (alimenta AD2 -> U15)'
    }
];

/**
 * Divergencias contra el contrato de calculo que este modulo VE y NO ARREGLA. Se listan para
 * que aparezcan en el informe y nadie las confunda con un dano nuevo ni con un olvido.
 * FUERA DE ALCANCE de esta pieza: cada una necesita una decision o un modulo propio.
 */
var CP_FUERA_DE_ALCANCE = [
    // decision Franco 2026-08-13: U17 se evaluo PARA esta pieza y queda AFUERA, con motivo.
    // No es una cirugia: la lista negra no es una condicion que se antepone a un WHERE, es el
    // criterio de clasificacion adentro de un LET -- cambiarla exige declarar la lista blanca,
    // encontrar cada FILTER que la use y no romper el orden de declaracion de las variables.
    // Eso es reescribir la formula, y este modulo no reescribe formulas (mismo criterio que los
    // LET de Inicio!I12/L12 en CP_CELDAS_INGRESOS). Ademas cambia un NUMERO QUE FRANCO MIRA (el
    // ahorro real medido), no un cableado: pasarlo a lista blanca baja el ahorro reportado
    // porque saca la Financiacion, y ese salto tiene que ser una entrega deliberada y anunciada,
    // no un efecto colateral de cablear el presupuesto. Mezclarlo aca ademas rompe la reversion:
    // revertir el cableado devolveria tambien la medicion, dos cosas que no tienen por que ir
    // juntas. Queda como PENDIENTE DOCUMENTADO con su contrato ya cerrado (la whitelist de abajo).
    'Tablero!U17 (Ahorro real) mide el ahorro con LISTA NEGRA -- tipo de proyecto <> "Liquidez" ' +
    'y <> "" --, asi que cuenta Financiacion (Tarjeta de Credito, Prestamo) como ahorro. El ' +
    'contrato de calculo exige LISTA BLANCA (Ahorro, Inversiones, Fondo de Emergencia, ' +
    'Objetivos Personales, Viajes) con Financiacion y Liquidez AFUERA: la deuda no es riqueza. ' +
    'EVALUADO para esta pieza y dejado afuera a proposito: reescribir el LET de U17 no es ' +
    'cirugia, y ademas mueve un numero que Franco mira (baja el ahorro reportado al sacar la ' +
    'Financiacion), lo que merece entrega propia y reversion propia. Modulo aparte.',

    'Mirada Interanual (G10:R14) NO excluye NINGUNA de las dos cuentas neutras (Traspaso, ' +
    'Inicio Mes): es la vista donde el 77 % de inflacion de ingresos esta vivo hoy. Sus formulas ' +
    'las escribe el codigo (07_MiradaInteranual.js, construirFormulaMirada), no el usuario, asi ' +
    'que la correccion va en ESE modulo y llega por deploy, no por cirugia sobre la hoja. Lo que ' +
    'necesita: sumar la columna "cuenta" (D de Registros, via RANGES) al SUMPRODUCT y descontar ' +
    'las filas cuya cuenta este en CUENTAS_NEUTRAS. Este modulo no lo hace ni lo audita celda a ' +
    'celda -- sus 48 celdas estan hoy en #ERROR! por un parse error anterior e independiente --, ' +
    'pero deja el contrato escrito para que la pieza que lo tome no tenga que redescubrirlo.',

    'Tablero!S13:S15 no declara moneda. Al poner Tablero!I9 = USD, U13:U15 y U17 se reescalan ' +
    'y el presupuesto no: todo el bloque queda comparando magnitudes distintas. El cableado no ' +
    'crea el problema ni lo arregla, pero lo hereda; lo resuelve la hoja "Presupuesto" al ' +
    'declarar en que moneda esta cargado cada mes.'
];

// ============================================
// HELPERS DE INFRAESTRUCTURA
// ============================================

// decision Franco 2026-08-13: yaConLock en las tres publicas porque el lock de Apps Script NO es
// reentrante. Un orquestador que ya esta en la seccion critica y encadena estado -> aplicar se
// colgaria contra si mismo al pedirlo de nuevo.
/**
 * Ejecuta fn bajo el lock del documento, salvo que el llamador ya lo tenga.
 *
 * @param {boolean} yaConLock true si el llamador ya esta dentro de la seccion critica
 * @param {Function} fn cuerpo a ejecutar; debe devolver el contrato {ok, detalle?, error?}
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function _conLockCP(yaConLock, fn) {
    if (yaConLock === true) return fn();

    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(CP_LOCK_MS)) {
        return {
            ok: false,
            error: 'No se pudo tomar el lock del documento en ' + (CP_LOCK_MS / 1000) +
                   's. Hay otra ejecucion en curso: esperar a que termine y reintentar. ' +
                   'No se toco ninguna celda.'
        };
    }
    try {
        return fn();
    } finally {
        lock.releaseLock();
    }
}

/** Devuelve la UI si el contexto la tiene (menu), o null (ejecucion headless). */
function _uiCP() {
    try {
        return SpreadsheetApp.getUi();
    } catch (e) {
        return null;
    }
}

/** Alerta best-effort: en contexto headless no rompe, solo loguea. */
function _alertaCP(titulo, texto) {
    var ui = _uiCP();
    if (!ui) return;
    var recorte = texto.length > 1500
        ? texto.substring(0, 1500) + '\n\n[...] Informe completo en los logs (Ver > Registros).'
        : texto;
    try {
        ui.alert(titulo, recorte, ui.ButtonSet.OK);
    } catch (e) {
        logInfo('_alertaCP: sin UI disponible para "' + titulo + '"');
    }
}

// decision Franco 2026-08-13: Apps Script descarta el retorno de un item de menu. Un abort
// silencioso en una herramienta que escribe formulas es indistinguible de "no paso nada", asi
// que todo error llega a pantalla. Los caminos que ya mostraron su propio informe se marcan con
// _avisado para no alertar dos veces; la marca se borra antes de devolver.
/**
 * Muestra en pantalla el error de un resultado que no fue avisado por su propio camino.
 *
 * @param {string} titulo
 * @param {{ok: boolean, detalle?: string, error?: string, _avisado?: boolean}} r
 * @returns {{ok: boolean, detalle?: string, error?: string}} el mismo objeto, sin la marca interna
 */
function _informarResultadoCP(titulo, r) {
    if (!r) return r;
    if (r.ok === false && r.error && r._avisado !== true) _alertaCP(titulo, r.error);
    delete r._avisado;
    return r;
}

/** Sello temporal 'yyyy-MM-dd_HHmm' en la zona horaria del script. */
function _selloCP() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

// decision Franco 2026-08-13: un estado ILEGIBLE no se trata como "no hay estado". El puntero al
// respaldo vive ahi: darlo por vacio haria que la corrida siguiente congelara un respaldo nuevo
// -- posiblemente sobre celdas ya cableadas -- y perdiera el punto de retorno real.
/**
 * Lee el estado guardado.
 *
 * @returns {Object} estado; {} si no hay ninguno; {_corrupto:true, _crudo:string} si es ilegible
 */
function _leerEstadoCP() {
    var crudo = null;
    try {
        crudo = PropertiesService.getDocumentProperties().getProperty(CP_PROP_ESTADO);
        if (!crudo) return {};
        var obj = JSON.parse(crudo);
        if (!obj || typeof obj !== 'object') throw new Error('el estado guardado no es un objeto');
        return obj;
    } catch (e) {
        logError('_leerEstadoCP: estado ILEGIBLE en DocumentProperties', e);
        return { _corrupto: true, _crudo: String(crudo).substring(0, 300) };
    }
}

/** true si hay una corrida aplicada o a medio aplicar que todavia no fue revertida. */
function _enVueloCP(estado) {
    return !!(estado && estado.iniciadaEn && !estado.revertidaEn);
}

/** Persiste el estado (merge sobre lo existente). Las claves internas (_*) no se persisten. */
function _guardarEstadoCP(parcial) {
    var previo = _leerEstadoCP();
    var estado = {};
    for (var k0 in previo) {
        if (Object.prototype.hasOwnProperty.call(previo, k0) && k0.charAt(0) !== '_') estado[k0] = previo[k0];
    }
    for (var k in parcial) {
        if (Object.prototype.hasOwnProperty.call(parcial, k)) estado[k] = parcial[k];
    }
    estado.version = CP_VERSION;
    PropertiesService.getDocumentProperties().setProperty(CP_PROP_ESTADO, JSON.stringify(estado));
    return estado;
}

/** Clave de propiedad para el contenido original de una celda. */
function _claveOriginalCP(hoja, celda) {
    return CP_PROP_ORIGINAL_PREFIJO + hoja + '::' + celda;
}

/**
 * Nombres reales de las hojas que toca este devtool. Unico lugar donde se resuelven: las
 * permanentes salen del SSOT (SHEETS / NAV_CONFIG), ninguna se hardcodea.
 *
 * @returns {Object<string,string>} clave interna -> nombre real de la hoja
 */
function _nombresCP() {
    return {
        tablero: NAV_CONFIG.SHEETS.TABLERO,
        inicio: NAV_CONFIG.SHEETS.INICIO,
        presupuesto: _nombrePresupuestoCP()
    };
}

// decision Franco 2026-08-13: el nombre de la hoja "Presupuesto" se toma de SHEETS.PRESUPUESTO
// SI el config lo declara, y solo si no, del resolver de alias. La pieza hermana de esta tanda
// crea la hoja y es la que corresponde que agregue la constante al SSOT; este modulo no la
// agrega para no pisarle el archivo, pero la PREFIERE apenas exista. Mientras tanto el resolver
// cubre el hueco sin hardcodear un string suelto en medio de la logica.
/** @returns {string} nombre real de la hoja de presupuesto */
function _nombrePresupuestoCP() {
    if (typeof SHEETS === 'object' && SHEETS && SHEETS.PRESUPUESTO) return SHEETS.PRESUPUESTO;
    return _resolverNombreHoja(CP_ALIAS_PRESUPUESTO);
}

/** Devuelve un nombre de hoja libre, agregando sufijo si hace falta. */
function _nombreHojaLibreCP(ss, base) {
    var nombre = base;
    var i = 2;
    while (ss.getSheetByName(nombre)) {
        nombre = base + '_' + i;
        i++;
        if (i > 50) throw new Error('No se pudo encontrar un nombre libre para el respaldo "' + base + '".');
    }
    return nombre;
}

// decision Franco 2026-08-13: helper propio en vez de reusar _textoLiteralV095 o _textoLiteralRV.
// El primero vive en un modulo que su propia cabecera declara TRANSITORIO ("se borra cuando la
// migracion quede consolidada"): depender de el rompe este devtool el dia que se borre el otro
// archivo, y el sintoma seria un ReferenceError EN MEDIO DEL RESPALDO, es decir justo antes de
// mutar. Doce lineas duplicadas cuestan menos que ese acoplamiento.
/**
 * Devuelve el valor listo para escribirse como TEXTO LITERAL en una celda.
 *
 * Sheets parsea todo string que arranque con "=", "+", "-", "@" o "'". En un respaldo eso es
 * inaceptable: la formula respaldada quedaria VIVA y se recalcularia contra la misma vista que
 * el devtool esta por cambiar. El apostrofo inicial es la marca de texto de Sheets y NO forma
 * parte del valor almacenado: getValue() lo devuelve sin el, asi que la verificacion sigue
 * comparando contra el original sin traducciones.
 *
 * @param {*} v
 * @returns {string}
 */
function _textoLiteralCP(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return /^[=+\-@']/.test(s) ? "'" + s : s;
}

/** Compara formulas ignorando espacios en blanco (setFormula normaliza el formato). */
function _formulasEquivalentesCP(a, b) {
    return String(a).replace(/\s+/g, '') === String(b).replace(/\s+/g, '');
}

// decision Franco 2026-08-13: la normalizacion de acentos se hace con un mapa explicito y no
// con String.normalize('NFD'). Los rotulos que compara este modulo salen de la planilla real
// ("Composición", "Categoría", "Año") y de esa comparacion depende que se escriba o no sobre
// produccion: no se apoya en una API cuyo comportamiento pueda variar entre el runtime V8 y el
// banco de pruebas. Seis reemplazos son auditables de un vistazo.
/**
 * Normaliza un rotulo para compararlo: minusculas, sin acentos, sin nada que no sea a-z0-9%.
 *
 * @param {*} v
 * @returns {string}
 */
function _normalizarCP(v) {
    if (v === null || v === undefined) return '';
    var s = String(v).toLowerCase();
    s = s.replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
         .replace(/[óòöôõ]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
    return s.replace(/[^a-z0-9%]/g, '');
}

/** true si el valor de la celda coincide con alguno de los rotulos aceptados. */
function _rotuloCoincideCP(valor, rotulos) {
    var n = _normalizarCP(valor);
    if (!n) return false;
    for (var i = 0; i < rotulos.length; i++) {
        if (n === _normalizarCP(rotulos[i])) return true;
    }
    return false;
}

/** Referencia de hoja lista para meter en una formula, siempre entrecomillada. */
function _refHojaCP(nombre) {
    return "'" + String(nombre).replace(/'/g, "''") + "'";
}

/** Convierte un indice de columna 1-based a su letra ('B', 'AA', ...). */
function _letraColumnaCP(n) {
    var s = '';
    var x = n;
    while (x > 0) {
        var r = (x - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        x = Math.floor((x - 1) / 26);
    }
    return s;
}

/** Convierte una letra de columna a su indice 1-based. */
function _indiceColumnaCP(letra) {
    var s = String(letra).toUpperCase();
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n;
}

// ============================================
// LECTURA Y ESCRITURA DE CELDAS (RESPALDO FIEL)
// ============================================

// decision Franco 2026-08-13: el respaldo guarda el TIPO de lo que habia, no solo el texto.
// Es la diferencia con los dos modulos hermanos, y no es un detalle: Tablero!S13:S15 son
// NUMEROS TIPEADOS, no formulas. getFormula() sobre una constante devuelve cadena vacia, asi
// que un respaldo que solo guardara formulas volveria del revertir con las tres celdas
// VACIAS -- habria destruido el unico presupuesto que Franco tiene cargado, declarando exito.
// Y en el otro extremo, las seis celdas de Inicio hoy estan vacias: su restauracion correcta
// es clearContent(), no escribir un cero.
/**
 * Congela el contenido actual de una celda en un registro restaurable.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @param {string} celda notacion A1
 * @returns {{tipo: string, contenido: string, mostrado: string}} tipo: formula|numero|texto|vacia
 */
function _leerCeldaCP(hoja, celda) {
    var r = hoja.getRange(celda);
    var formula = r.getFormula();
    if (formula) return { tipo: 'formula', contenido: formula, mostrado: r.getDisplayValue() };

    var v = r.getValue();
    if (v === '' || v === null || v === undefined) return { tipo: 'vacia', contenido: '', mostrado: '' };
    if (typeof v === 'number') return { tipo: 'numero', contenido: String(v), mostrado: r.getDisplayValue() };
    if (typeof v === 'boolean') return { tipo: 'texto', contenido: String(v), mostrado: r.getDisplayValue() };
    if (v && typeof v.getTime === 'function') {
        // Una fecha en una celda de presupuesto no es un estado previsto. Se registra como
        // texto ISO para no perderla, y el plan la marca como drift: no se escribe encima.
        return { tipo: 'fecha', contenido: String(v), mostrado: r.getDisplayValue() };
    }
    return { tipo: 'texto', contenido: String(v), mostrado: r.getDisplayValue() };
}

/**
 * Escribe en una celda el contenido registrado por _leerCeldaCP. Es el inverso exacto.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @param {string} celda
 * @param {{tipo: string, contenido: string}} registro
 */
function _escribirCeldaCP(hoja, celda, registro) {
    var r = hoja.getRange(celda);
    if (registro.tipo === 'formula') { r.setFormula(registro.contenido); return; }
    if (registro.tipo === 'vacia') { r.clearContent(); return; }
    if (registro.tipo === 'numero') {
        var n = Number(registro.contenido);
        if (isNaN(n)) throw new Error('El respaldo de ' + celda + ' dice numero pero guarda "' +
                                      registro.contenido + '", que no lo es. No se restaura a ciegas.');
        r.setValue(n);
        return;
    }
    // Texto: pasa por _textoLiteralCP para que un texto que arranque con "=" no reviva como
    // formula al restaurarlo. El apostrofo es marca de formato, no parte del valor.
    r.setValue(_textoLiteralCP(registro.contenido));
}

// ============================================
// CIRUGIA: EXCLUSION DE TRASPASO
// ============================================

/**
 * true si la formula ya excluye la cuenta dada, en cualquiera de las formas validas.
 *
 * Reconoce tanto la condicion suelta ("Col1 != 'Traspaso'") como la que vive dentro de un
 * parentesis con OR ("(Col1 != 'Inicio Mes' OR Col5 = 'Liquidez')"): lo que se comprueba es que
 * la cuenta este siendo excluida, no la forma exacta en que alguien la escribio.
 *
 * @param {string} formula
 * @param {string} cuenta nombre de la cuenta neutra, tal como figura en la columna D de Registros
 * @returns {boolean}
 */
function _yaExcluyeCuentaCP(formula, cuenta) {
    var lit = String(cuenta).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp('(!=|<>)\\s*[\'"]\\s*' + lit + '\\s*[\'"]', 'i').test(String(formula));
}

/**
 * Cuentas neutras que a la formula le FALTA excluir.
 *
 * @param {string} formula
 * @param {string[]} neutras
 * @returns {string[]} subconjunto de neutras ausente de la formula
 */
function _cuentasNeutrasFaltantesCP(formula, neutras) {
    var faltan = [];
    for (var i = 0; i < neutras.length; i++) {
        if (!_yaExcluyeCuentaCP(formula, neutras[i])) faltan.push(neutras[i]);
    }
    return faltan;
}

// decision Franco 2026-08-13: la exclusion se ANTEPONE al WHERE en vez de agregarse al final.
// Anteponer no necesita saber donde termina la clausula -- no hay que distinguir el fin del
// WHERE del comienzo del GROUP BY / ORDER BY / LABEL --, y deja el resto del string byte por
// byte igual. El unico caso en que anteponer cambiaria la semantica es un OR de PRIMER NIVEL
// sin parentesis ("WHERE A OR B" se volveria "(T AND A) OR B"), y por eso existe el escaner de
// profundidad de parentesis: si aparece uno, la formula NO SE TOCA y se reporta.
/**
 * Inserta la exclusion de Traspaso en el WHERE de la QUERY de una formula viva.
 *
 * No genera formula: recibe la formula real, le antepone una condicion al WHERE y devuelve el
 * resto del string intacto -- incluidos los separadores de argumento (";" en este locale), que
 * atraviesan la transformacion sin ser tocados. Es lo que evita la trampa de locale
 * documentada en 07_MiradaInteranual.js.
 *
 * @param {string} formula formula actual, tal como la devuelve getFormula()
 * @param {string} marca fragmento que DEBE estar en el WHERE para reconocerlo como el esperado
 * @returns {{ok: boolean, formula: string, insertado: string, indice: number, problemas: string[]}}
 */
function _insertarExclusionTraspasoCP(formula, marca) {
    var problemas = [];
    var texto = String(formula);
    var salida = { ok: false, formula: texto, insertado: '', indice: -1, problemas: problemas };

    var re = /\bWHERE\b/gi;
    var encontrados = [];
    var m;
    while ((m = re.exec(texto)) !== null) encontrados.push(m.index);

    if (encontrados.length === 0) {
        problemas.push('la formula no tiene una clausula WHERE: no es la QUERY esperada, no se toca.');
        return salida;
    }
    if (encontrados.length > 1) {
        problemas.push('la formula tiene ' + encontrados.length + ' clausulas WHERE: no se elige una a ' +
                       'ciegas. Requiere decision manual.');
        return salida;
    }

    var iWhere = encontrados[0];
    var finWhere = iWhere + 5;   // longitud de "WHERE"

    // Espacios (o saltos de linea) que siguen al WHERE: se reutilizan para que la formula
    // conserve exactamente su estilo de indentacion.
    var ws = '';
    var j = finWhere;
    while (j < texto.length && /\s/.test(texto.charAt(j))) { ws += texto.charAt(j); j++; }
    if (ws === '') {
        problemas.push('despues del WHERE no hay separador: la formula no tiene la forma esperada.');
        return salida;
    }

    var clausula = _clausulaWhereCP(texto, j);

    if (marca && clausula.texto.replace(/\s+/g, ' ').indexOf(String(marca).replace(/\s+/g, ' ')) === -1) {
        problemas.push('el WHERE no contiene "' + marca + '": no es la QUERY que este modulo verifico, no se toca.');
        return salida;
    }
    if (clausula.orDePrimerNivel) {
        problemas.push('el WHERE tiene un OR de primer nivel sin parentesis: anteponer una condicion ' +
                       'con AND cambiaria la semantica de la formula. No se toca.');
        return salida;
    }

    var insertado = CP_EXCLUSION_TRASPASO + ' AND' + ws;
    salida.formula = texto.substring(0, j) + insertado + texto.substring(j);
    salida.insertado = insertado;
    salida.indice = j;
    salida.ok = true;
    return salida;
}

/**
 * Aisla el texto de la clausula WHERE y dice si tiene un OR de primer nivel.
 *
 * Recorre caracter por caracter desde el inicio de la clausula llevando cuenta de las comillas
 * simples (las de los literales de QUERY) y de la profundidad de parentesis. Corta al llegar,
 * en profundidad cero y fuera de comillas, a una palabra clave que cierra el WHERE, o al final
 * del literal de la QUERY (la comilla doble que lo delimita).
 *
 * @param {string} texto formula completa
 * @param {number} desde indice del primer caracter de la clausula
 * @returns {{texto: string, orDePrimerNivel: boolean, fin: number}}
 */
function _clausulaWhereCP(texto, desde) {
    var terminadores = ['GROUP BY', 'ORDER BY', 'LABEL', 'FORMAT', 'LIMIT', 'OFFSET', 'PIVOT', 'OPTIONS'];
    var profundidad = 0;
    var enComillaSimple = false;
    var orDePrimerNivel = false;
    var i = desde;

    for (; i < texto.length; i++) {
        var c = texto.charAt(i);

        if (enComillaSimple) {
            if (c === "'") enComillaSimple = false;
            continue;
        }
        if (c === "'") { enComillaSimple = true; continue; }
        if (c === '"') break;   // se cerro el literal de la QUERY
        if (c === '(') { profundidad++; continue; }
        if (c === ')') {
            if (profundidad === 0) break;   // parentesis de la funcion QUERY: la clausula termino
            profundidad--;
            continue;
        }
        if (profundidad > 0) continue;

        var resto = texto.substring(i);
        var restoNorm = resto.toUpperCase();

        var corta = false;
        for (var t = 0; t < terminadores.length; t++) {
            if (_palabraEnPosicionCP(texto, restoNorm, i, terminadores[t])) { corta = true; break; }
        }
        if (corta) break;

        if (_palabraEnPosicionCP(texto, restoNorm, i, 'OR')) orDePrimerNivel = true;
    }

    return { texto: texto.substring(desde, i), orDePrimerNivel: orDePrimerNivel, fin: i };
}

/**
 * true si en la posicion i empieza la palabra clave dada, delimitada por no-alfanumericos.
 * Los espacios internos de la clave ("GROUP BY") se comparan tolerando cualquier espaciado.
 */
function _palabraEnPosicionCP(texto, restoNorm, i, clave) {
    var partes = clave.split(' ');
    var pos = 0;
    for (var p = 0; p < partes.length; p++) {
        if (restoNorm.substr(pos, partes[p].length) !== partes[p]) return false;
        pos += partes[p].length;
        if (p < partes.length - 1) {
            var espacios = 0;
            while (pos < restoNorm.length && /\s/.test(restoNorm.charAt(pos))) { pos++; espacios++; }
            if (espacios === 0) return false;
        }
    }
    var antes = i > 0 ? texto.charAt(i - 1) : ' ';
    var despues = pos < restoNorm.length ? restoNorm.charAt(pos) : ' ';
    return !/[A-Za-z0-9_]/.test(antes) && !/[A-Za-z0-9_]/.test(despues);
}

// ============================================
// CONSTRUCCION DE LAS FORMULAS DEL CABLEADO
// ============================================

// decision Franco 2026-08-13: las formulas se escriben con ";" como separador de argumentos,
// no con ",". Esta planilla esta en locale es y setFormula NO traduce separadores: una formula
// en sintaxis en-US entra literal y queda rota. Es la misma trampa que documenta
// 07_MiradaInteranual.js, y por eso ninguna de estas formulas usa arrays literales {...}.
/**
 * Formula de lookup de un monto presupuestado por mes/ano.
 *
 * INDEX/MATCH sobre una clave concatenada mes|ano: devuelve la PRIMERA fila que coincide, sin
 * sumar. Se descarta SUMIFS a proposito -- sumaria en silencio dos filas del mismo mes, que es
 * un error de carga que conviene que se vea, no que se promedie solo.
 *
 * IFERROR a 0 cuando el mes no esta presupuestado: 0 es el unico valor numerico honesto ahi, y
 * el motor lo degrada bien (con S13:S15 en cero, suma_rem = 0 y T22:T24 vuelcan toda la
 * liquidez al bolsillo Ahorro, que es lo correcto cuando no hay plan).
 *
 * @param {string} hojaPres nombre real de la hoja de presupuesto
 * @param {Object} cols mapa clave -> letra de columna VERIFICADA en la planilla viva
 * @param {string} claveMonto 'ingresos' | 'fijos' | 'variables'
 * @param {string} celdaMes celda del selector de mes del Tablero (I4)
 * @param {string} celdaAno celda del selector de ano del Tablero (I6)
 * @returns {string}
 */
function _formulaMontoPresupuestoCP(hojaPres, cols, claveMonto, celdaMes, celdaAno) {
    var ref = _refHojaCP(hojaPres);
    var fila = CP_CONTRATO.filaDatos;
    var colMonto = cols[claveMonto];
    var colMes = cols.mes;
    var colAno = cols.ano;

    return '=IFERROR(INDEX(' + ref + '!$' + colMonto + '$' + fila + ':$' + colMonto + '; ' +
           'MATCH($' + celdaMes + ' & "|" & $' + celdaAno + '; ' +
           'ARRAYFORMULA(' + ref + '!$' + colMes + '$' + fila + ':$' + colMes + ' & "|" & ' +
           ref + '!$' + colAno + '$' + fila + ':$' + colAno + '); 0)); 0)';
}

/** Formula de la columna "%" de Inicio: proporcion del macro grupo sobre el ingreso presupuestado. */
function _formulaPorcentajeInicioCP(hojaTablero, celdaOrigen, celdaBase) {
    var ref = _refHojaCP(hojaTablero);
    return '=IFERROR(' + ref + '!$' + celdaOrigen.charAt(0) + '$' + celdaOrigen.substring(1) + ' / ' +
           ref + '!$' + celdaBase.charAt(0) + '$' + celdaBase.substring(1) + '; ' + CP_INICIO_FALLBACK + ')';
}

/** Formula de la columna "Disponibilidad" de Inicio: espejo directo del reparto del Tablero. */
function _formulaDisponibilidadInicioCP(hojaTablero, celdaOrigen) {
    var ref = _refHojaCP(hojaTablero);
    return '=IFERROR(' + ref + '!$' + celdaOrigen.charAt(0) + '$' + celdaOrigen.substring(1) +
           '; ' + CP_INICIO_FALLBACK + ')';
}

// ============================================
// VERIFICACION DE LA GEOMETRIA DEL TABLERO
// ============================================

// decision Franco 2026-08-13: la geometria del bloque del Tablero se verifica UNA VEZ, en un
// solo lugar, y GOBIERNA A TODA CONEXION QUE DEPENDA DE ELLA. Antes de este arreglo el guard
// existia pero vivia adentro de la conexion 1 y solo degradaba las celdas de la conexion 1: con
// el bloque del Tablero reordenado, la conexion 1 abortaba (bien) y la conexion 2 escribia
// igual sus seis formulas contra S13/S14/S15/S17/T22:T24 (mal). Reproducido.
//
// Es el mismo error de razonamiento que el modulo declara en su cabecera y que este guard
// justamente existia para impedir: la conexion 2 no calcula nada, MUESTRA las celdas del
// Tablero bajo los rotulos de "Inicio". Si Q14 deja de decir "Gastos Fijos", entonces S14 deja
// de ser el presupuesto de gastos fijos, y escribir "=Tablero!$S$14 / Tablero!$S$13" debajo del
// rotulo "Gastos Fijos" de Inicio!I17 produce exactamente lo que la cabecera llama la unica
// clase de error que esta planilla no puede permitirse: un numero plausible y falso. Un #REF! se
// ve; un porcentaje que dice ser de gastos fijos y no lo es, no.
//
// De ahi la separacion de severidades, que NO es la misma para las dos conexiones:
//   - ROTULO de fila divergente (Q13/Q14/Q15) -> BLOQUEANTE para las dos. Ni se escribe el monto
//     en la fila equivocada (conexion 1) ni se espeja una fila que ya no es la que dice ser (2).
//   - TESTIGO con otra forma (S17, T22:T24) -> AVISO para la conexion 1 (escribir el presupuesto
//     en S13:S15 sigue siendo correcto aunque el motor haya cambiado) y BLOQUEANTE para la 2
//     (esas celdas son literalmente lo que "Inicio" muestra: si T22 dejo de ser el reparto al
//     bolsillo Ahorro, K16 muestra otra cosa bajo el rotulo "Capacidad de Ahorro").
// La conexion 3 NO depende de esta geometria y por eso no la consulta: sus celdas son QUERY
// sobre Registros y su guard propio es la "marca" del WHERE. Esta dicho para que se lea como
// una decision verificada y no como un olvido.
/**
 * Verifica la geometria del bloque de presupuesto del Tablero. NO ESCRIBE NADA.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja hoja del Tablero
 * @returns {{problemas: string[], testigos: Array, celdas: Object<string,{ok: boolean, que: string, motivo: string}>}}
 *          celdas: veredicto por coordenada del Tablero, para que cualquier conexion pueda
 *          preguntar "puedo apoyarme en esta celda?" antes de escribir una formula que la lea.
 */
function _verificarGeometriaTableroCP(hoja) {
    var geo = { problemas: [], testigos: [], celdas: {}, enError: [] };

    CP_TABLERO_MONTOS.forEach(function (m) {
        var rotulo = hoja.getRange(m.celdaRotulo).getDisplayValue();
        if (_rotuloCoincideCP(rotulo, m.rotulos)) {
            geo.celdas[m.celda] = { ok: true, que: m.rotulos[0], motivo: '' };
            return;
        }
        var motivo = m.celdaRotulo + ' dice "' + rotulo + '" y se esperaba el macro grupo "' +
                     m.rotulos[0] + '"';
        geo.celdas[m.celda] = { ok: false, que: m.rotulos[0], motivo: motivo };
        geo.problemas.push(motivo + '. El bloque de presupuesto no tiene la forma verificada: ' +
                           m.celda + ' ya no es el monto de "' + m.rotulos[0] + '".');
    });

    // decision Franco 2026-08-13: un testigo tiene DOS estados de falla que no son el mismo, y
    // confundirlos cuesta caro en las dos direcciones. Verificado en vivo el 2026-08-13:
    // T22:T24 conservan exactamente las formulas verificadas (dicen rem_ahorro / rem_fijos /
    // rem_var) y sin embargo estan devolviendo "#ERROR!".
    //   - ATENCION   = la FORMA cambio. El testigo ya no es el que este modulo verifico, asi que
    //                  no se sabe que significa esa celda -> BLOQUEANTE para quien la espeje.
    //   - ERROR_VIVO = la forma es la verificada y hoy devuelve error. La celda SIGUE
    //                  significando lo que dice; lo que esta roto es el motor, por una causa que
    //                  este modulo no toca y que se arregla en otro lado -> AVISO, nunca
    //                  bloqueante.
    // Tratar ERROR_VIVO como bloqueante impediria instalar un cable correcto por culpa de un
    // motor roto que se va a arreglar aparte; tratarlo como OK a secas dejaria a Franco cableando
    // seis celdas que van a quedar en blanco sin que nada se lo haya dicho. El fallback en blanco
    // (CP_INICIO_FALLBACK) hace que el resultado sea honesto -- "no hay dato", no un cero falso --
    // y el espejo se enciende solo el dia que el motor vuelva.
    CP_TABLERO_TESTIGOS.forEach(function (t) {
        var rango = hoja.getRange(t.celda);
        var f = rango.getFormula();
        var mostrado = String(rango.getDisplayValue());
        var det = { celda: t.celda, que: t.que, estado: 'OK', nota: '', mostrado: mostrado };
        if (!f) {
            det.estado = 'ATENCION';
            det.nota = 'no tiene formula (esperada: ' + (t.esperada || 'un LET con "' + t.contiene + '"') + ')';
        } else if (t.esperada && !_formulasEquivalentesCP(f, t.esperada)) {
            det.estado = 'ATENCION';
            det.nota = 'su formula es "' + f + '" y se esperaba "' + t.esperada + '"';
        } else if (t.contiene && f.indexOf(t.contiene) === -1) {
            det.estado = 'ATENCION';
            det.nota = 'su formula no menciona "' + t.contiene + '": el motor pudo cambiar de forma';
        } else if (mostrado.charAt(0) === '#') {
            det.estado = 'ERROR_VIVO';
            det.nota = 'conserva la formula verificada pero HOY devuelve "' + mostrado + '"';
            geo.enError.push(t.celda + ' (' + t.que + '): ' + mostrado);
        }
        geo.celdas[t.celda] = {
            ok: det.estado !== 'ATENCION',
            que: t.que,
            motivo: det.estado === 'ATENCION' ? t.celda + ' (' + t.que + '): ' + det.nota : ''
        };
        geo.testigos.push(det);
    });

    return geo;
}

/**
 * Veredicto de una celda del Tablero de la que depende una formula que este modulo va a escribir.
 *
 * Una coordenada NO VERIFICADA se trata igual que una divergente: este modulo no se apoya en una
 * celda cuyo significado no comprobo. Es lo que evita que agregar una fila a CP_INICIO sin
 * declarar su testigo abra un agujero en silencio.
 *
 * @param {Object} geo salida de _verificarGeometriaTableroCP
 * @param {string} celda coordenada del Tablero (ej. 'S14')
 * @returns {{ok: boolean, motivo: string}}
 */
function _dependenciaTableroCP(geo, celda) {
    if (!geo || !geo.celdas) {
        return { ok: false, motivo: 'no se pudo verificar la geometria del Tablero.' };
    }
    var v = geo.celdas[celda];
    if (!v) {
        return {
            ok: false,
            motivo: 'la celda ' + celda + ' del Tablero no esta entre las que este modulo verifica ' +
                    '(CP_TABLERO_MONTOS / CP_TABLERO_TESTIGOS): no se escribe una formula que lea una ' +
                    'coordenada cuyo significado no se comprobo.'
        };
    }
    if (v.ok) return { ok: true, motivo: '' };
    return { ok: false, motivo: v.motivo };
}

// ============================================
// VERIFICACION DEL CONTRATO CON "Presupuesto"
// ============================================

/**
 * Verifica que la hoja "Presupuesto" tenga la geometria declarada en CP_CONTRATO Y QUE TENGA
 * DATOS USABLES para el mes que el Tablero esta mostrando. NO ESCRIBE.
 *
 * Cuando una columna no esta donde el contrato dice, la busca por rotulo en toda la fila de
 * header y REPORTA donde la encontro; pero NO adapta el cableado: devuelve bloqueante. Adaptar
 * en silencio a una geometria que nadie declaro es como se escriben formulas contra la columna
 * de al lado.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hojaTablero hoja del Tablero (para leer el selector)
 * @returns {{ok: boolean, nombre: string, existe: boolean, columnas: Object, problemas: string[],
 *            avisos: string[], header: Array, filasCargadas: number, selector: Object}}
 */
function _verificarContratoPresupuestoCP(ss, hojaTablero) {
    var nombre = _nombrePresupuestoCP();
    var salida = {
        ok: false, nombre: nombre, existe: false, columnas: {},
        problemas: [], avisos: [], header: []
    };

    var hoja = ss.getSheetByName(nombre);
    if (!hoja) {
        salida.problemas.push('la hoja "' + nombre + '" no existe todavia. La crea la pieza hermana de ' +
                              'esta tanda; hasta entonces el cableado del Tablero no se puede escribir ' +
                              '(apuntaria a una hoja inexistente y las tres celdas darian #REF!).');
        return salida;
    }
    salida.existe = true;

    var maxCols = hoja.getMaxColumns();
    var maxFilas = hoja.getMaxRows();
    if (maxFilas < CP_CONTRATO.filaDatos) {
        salida.problemas.push('la hoja "' + nombre + '" tiene ' + maxFilas + ' filas y el contrato ubica ' +
                              'los datos desde la fila ' + CP_CONTRATO.filaDatos + '.');
        return salida;
    }

    var hasta = Math.min(CP_CONTRATO.colBusquedaHasta, maxCols);
    var header = hoja.getRange(CP_CONTRATO.filaHeader, 1, 1, hasta).getValues()[0];
    salida.header = header;

    for (var clave in CP_CONTRATO.columnas) {
        if (!Object.prototype.hasOwnProperty.call(CP_CONTRATO.columnas, clave)) continue;
        var def = CP_CONTRATO.columnas[clave];
        var idxDeclarado = _indiceColumnaCP(def.letra);

        if (idxDeclarado <= hasta && _rotuloCoincideCP(header[idxDeclarado - 1], def.rotulos)) {
            salida.columnas[clave] = def.letra;
            continue;
        }

        var hallazgos = [];
        for (var c = 0; c < header.length; c++) {
            if (_rotuloCoincideCP(header[c], def.rotulos)) hallazgos.push(_letraColumnaCP(c + 1));
        }

        var visto = (idxDeclarado <= hasta)
            ? '"' + String(header[idxDeclarado - 1]) + '"'
            : '(fuera del rango inspeccionado)';

        if (hallazgos.length === 1) {
            salida.problemas.push('columna "' + clave + '" (' + def.descripcion + '): el contrato la declara ' +
                                  'en ' + def.letra + CP_CONTRATO.filaHeader + ', donde dice ' + visto +
                                  '. El rotulo esperado esta en la columna ' + hallazgos[0] + '. ' +
                                  'NO se cablea contra una coordenada que el contrato no declara: ' +
                                  'actualizar CP_CONTRATO.columnas.' + clave + '.letra = "' + hallazgos[0] + '".');
        } else if (hallazgos.length === 0) {
            salida.problemas.push('columna "' + clave + '" (' + def.descripcion + '): no se encontro ninguno ' +
                                  'de sus rotulos aceptados (' + def.rotulos.join(', ') + ') en la fila ' +
                                  CP_CONTRATO.filaHeader + ' de "' + nombre + '". En ' + def.letra +
                                  CP_CONTRATO.filaHeader + ' dice ' + visto + '.');
        } else {
            salida.problemas.push('columna "' + clave + '": el rotulo aparece en mas de una columna (' +
                                  hallazgos.join(', ') + '). Ambiguo: no se elige a ciegas.');
        }
    }

    // Rotulos que se reconocen pero no se cablean: se avisan para que la diferencia sea visible.
    for (var av in CP_CONTRATO.avisar) {
        if (!Object.prototype.hasOwnProperty.call(CP_CONTRATO.avisar, av)) continue;
        for (var h = 0; h < header.length; h++) {
            if (!_rotuloCoincideCP(header[h], CP_CONTRATO.avisar[av])) continue;
            if (av === 'ahorro') {
                salida.avisos.push('"' + nombre + '" declara una columna de ahorro presupuestado en ' +
                                   _letraColumnaCP(h + 1) + ': NO se cablea. Tablero!S17 ya lo deriva como ' +
                                   'S13-S14-S15. Si los dos numeros difieren, la diferencia hay que ' +
                                   'resolverla a mano: dos definiciones del mismo concepto es el defecto ' +
                                   'que el contrato de calculo prohibe.');
            } else {
                salida.avisos.push('"' + nombre + '" declara una columna de moneda en ' + _letraColumnaCP(h + 1) +
                                   ': el cableado NO la lee. El presupuesto se toma tal cual esta cargado y ' +
                                   'el Tablero lo compara contra magnitudes en la moneda de I9 (ver ' +
                                   'CP_FUERA_DE_ALCANCE).');
            }
        }
    }

    if (salida.problemas.length) return salida;

    // La geometria cierra. Ahora los DATOS.
    _verificarDatosPresupuestoCP(hoja, hojaTablero, salida);
    if (salida.problemas.length) return salida;

    salida.ok = true;
    return salida;
}

// decision Franco 2026-08-13: verificar la geometria de la hoja "Presupuesto" NO ALCANZA para
// cablearla; hay que verificar que TENGA NUMEROS, y para el mes que el Tablero va a mostrar.
// Antes de este arreglo el contrato validaba existencia de hoja, alto minimo, rotulos del header
// y contaba filas con Mes no vacio -- y nunca leia una sola celda de monto ni cruzaba el selector
// contra las filas cargadas. Reproducido: con una hoja que tiene la fila del mes y los montos
// VACIOS, el estado devolvia ok:true SIN UN AVISO, aplicar escribia las tres celdas, y S13:S15
// quedaban en 0 con el motor de Q20:U24 repartiendo sobre cero.
//
// El criterio es el mismo que el modulo ya aplica a las celdas de "Inicio" (CP_INICIO_FALLBACK):
// "no hay dato" y "el dato es cero" son estados DISTINTOS y la planilla no puede confundirlos.
// Un presupuesto en cero es una afirmacion -- "este mes no pensas gastar nada" -- y cablear
// contra una celda vacia la fabrica sola. Peor todavia: hoy S13:S15 son los montos que Franco
// tipeo a mano y que funcionan; cablear contra vacio los REEMPLAZA por ceros. Eso no es cablear,
// es borrar un presupuesto declarando exito.
//
// Por que estos casos ABORTAN y no solo avisan: los cinco se arreglan cargando el dato que el
// cableado necesita (o moviendo el selector), son de un minuto, y el costo de equivocarse es que
// todo el bloque Q11:U24 y las seis celdas de "Inicio" muestren ceros que no son ceros. Un
// bloqueante que se levanta cargando lo que falta es un buen bloqueante. Lo que SI queda en
// aviso es lo que no afecta a lo que se esta por escribir hoy: meses futuros a medio cargar.
/**
 * Comprueba que "Presupuesto" tenga datos usables para el mes del selector del Tablero.
 * Acumula bloqueantes y avisos sobre `salida`. NO ESCRIBE.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja hoja "Presupuesto", con geometria ya verificada
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hojaTablero
 * @param {Object} salida objeto de _verificarContratoPresupuestoCP, se muta
 */
function _verificarDatosPresupuestoCP(hoja, hojaTablero, salida) {
    var nombre = salida.nombre;
    var claves = ['mes', 'ano', 'ingresos', 'fijos', 'variables'];
    var idx = {};
    var minCol = Infinity;
    var maxCol = 0;
    claves.forEach(function (k) {
        idx[k] = _indiceColumnaCP(salida.columnas[k]);
        if (idx[k] < minCol) minCol = idx[k];
        if (idx[k] > maxCol) maxCol = idx[k];
    });

    var altoDatos = hoja.getMaxRows() - CP_CONTRATO.filaDatos + 1;
    var bloque = hoja.getRange(CP_CONTRATO.filaDatos, minCol, altoDatos, maxCol - minCol + 1).getValues();

    var filas = [];
    for (var f = 0; f < bloque.length; f++) {
        var mesV = bloque[f][idx.mes - minCol];
        if (_vaciaCP(mesV)) continue;
        filas.push({
            fila: CP_CONTRATO.filaDatos + f,
            mes: mesV,
            ano: bloque[f][idx.ano - minCol],
            clave: _claveMesAnoCP(mesV, bloque[f][idx.ano - minCol]),
            montos: {
                ingresos: bloque[f][idx.ingresos - minCol],
                fijos: bloque[f][idx.fijos - minCol],
                variables: bloque[f][idx.variables - minCol]
            }
        });
    }
    salida.filasCargadas = filas.length;

    if (filas.length === 0) {
        salida.problemas.push('"' + nombre + '" no tiene NINGUNA fila cargada: no hay nada que leer. El ' +
                              'cableado dejaria Tablero!S13:S15 en 0 y borraria los montos que hoy estan ' +
                              'tipeados a mano y funcionando. Cargar el primer mes y volver a correr el estado.');
        return;
    }

    if (!hojaTablero) {
        salida.problemas.push('no se pudo leer el selector del Tablero (' + CP_TABLERO_SELECTOR.mes + '/' +
                              CP_TABLERO_SELECTOR.ano + '): sin el no se puede comprobar que el mes que el ' +
                              'Tablero muestra este cargado en "' + nombre + '", y el cableado se escribiria a ciegas.');
        return;
    }

    var selMes = hojaTablero.getRange(CP_TABLERO_SELECTOR.mes).getValue();
    var selAno = hojaTablero.getRange(CP_TABLERO_SELECTOR.ano).getValue();
    salida.selector = { mes: selMes, ano: selAno };

    if (_vaciaCP(selMes) || _vaciaCP(selAno)) {
        salida.problemas.push('el selector del Tablero esta vacio (' + CP_TABLERO_SELECTOR.mes + '="' +
                              String(selMes) + '", ' + CP_TABLERO_SELECTOR.ano + '="' + String(selAno) +
                              '"): el lookup no tendria que buscar y las tres celdas quedarian en 0. ' +
                              'Elegir mes y ano en el Tablero antes de cablear.');
        return;
    }

    // La formula usa MATCH(...; 0): coincidencia EXACTA sobre mes & "|" & ano. La verificacion
    // arma la misma clave con las mismas dos celdas (CP_TABLERO_SELECTOR) para que no pueda
    // comprobar una cosa y la formula buscar otra.
    var claveSel = _claveMesAnoCP(selMes, selAno);
    var mesTexto = String(selMes) + ' ' + String(selAno);
    var exactas = [];
    var laxas = [];
    filas.forEach(function (r) {
        if (r.clave === claveSel) exactas.push(r);
        else if (_normalizarCP(r.clave) === _normalizarCP(claveSel)) laxas.push(r);
    });

    if (exactas.length === 0 && laxas.length > 0) {
        salida.problemas.push('la fila de ' + mesTexto + ' existe en "' + nombre + '" (fila ' + laxas[0].fila +
                              ': "' + String(laxas[0].mes) + '" / "' + String(laxas[0].ano) + '") pero NO ' +
                              'coincide EXACTAMENTE con el selector del Tablero ("' + String(selMes) + '" / "' +
                              String(selAno) + '"): difieren en mayusculas, acentos o espacios. El MATCH del ' +
                              'cableado es exacto, no la encontraria, y las tres celdas quedarian en 0. ' +
                              'Igualar el texto de la fila al del selector.');
        return;
    }
    if (exactas.length === 0) {
        var cargados = filas.slice(0, 12).map(function (r) { return String(r.mes) + ' ' + String(r.ano); });
        salida.problemas.push('"' + nombre + '" no tiene fila para ' + mesTexto + ', que es lo que el Tablero ' +
                              'esta mostrando (' + CP_TABLERO_SELECTOR.mes + '/' + CP_TABLERO_SELECTOR.ano +
                              '). Cargado hoy: ' + cargados.join(', ') +
                              (filas.length > 12 ? ' [...] y ' + (filas.length - 12) + ' mas' : '') +
                              '. Cablear ahora pondria Tablero!S13:S15 en 0 y borraria los montos tipeados a ' +
                              'mano: cargar el mes, o poner el selector en un mes que si este cargado.');
        return;
    }
    if (exactas.length > 1) {
        salida.problemas.push(mesTexto + ' aparece ' + exactas.length + ' veces en "' + nombre + '" (filas ' +
                              exactas.map(function (r) { return r.fila; }).join(', ') + '). El cableado usa ' +
                              'INDEX/MATCH, que devuelve la PRIMERA en silencio: el presupuesto del mes ' +
                              'dependeria del orden de las filas. Dejar una sola.');
        return;
    }

    // --- La fila del selector: sus tres montos tienen que ser NUMEROS ---
    var fila = exactas[0];
    CP_TABLERO_MONTOS.forEach(function (m) {
        var v = fila.montos[m.contrato];
        if (typeof v === 'number' && isFinite(v)) return;
        salida.problemas.push('la fila ' + fila.fila + ' de "' + nombre + '" (' + mesTexto + ') ' +
                              _porQueNoEsNumeroCP(v) + ' en la columna ' + salida.columnas[m.contrato] +
                              ' (' + CP_CONTRATO.columnas[m.contrato].descripcion + '). Cablear contra eso ' +
                              'deja Tablero!' + m.celda + ' en 0 y el motor de Q20:U24 repartiendo sobre cero: ' +
                              '"no hay presupuesto cargado" y "el presupuesto es cero" no son el mismo estado.');
    });
    if (salida.problemas.length) return;

    salida.filaSelector = fila.fila;

    // --- Avisos: lo que no afecta a lo que se escribe hoy, pero se va a ver manana ---
    if (fila.montos.ingresos <= 0) {
        salida.avisos.push('el ingreso presupuestado de ' + mesTexto + ' es ' + fila.montos.ingresos +
                           ': es la BASE del porcentaje de "Inicio" (J16:J18), asi que esas tres celdas ' +
                           'van a quedar en blanco por division por cero, y el motor va a volcar toda la ' +
                           'liquidez al bolsillo Ahorro. Se cablea igual: el dato esta cargado y dice eso.');
    }

    var incompletas = [];
    var duplicadas = {};
    var yaVistas = {};
    filas.forEach(function (r) {
        if (yaVistas[r.clave]) duplicadas[r.clave] = true; else yaVistas[r.clave] = true;
        if (r.fila === fila.fila) return;
        var faltan = CP_TABLERO_MONTOS.filter(function (m) {
            var v = r.montos[m.contrato];
            return !(typeof v === 'number' && isFinite(v));
        });
        if (faltan.length) incompletas.push(String(r.mes) + ' ' + String(r.ano) + ' (fila ' + r.fila + ')');
    });
    if (incompletas.length) {
        salida.avisos.push(incompletas.length + ' mes(es) de "' + nombre + '" tienen algun monto sin cargar: ' +
                           incompletas.slice(0, 8).join(', ') +
                           (incompletas.length > 8 ? ' [...]' : '') + '. No bloquean el cableado porque no son ' +
                           'el mes del selector, pero el dia que el selector llegue ahi el Tablero va a mostrar 0.');
    }
    var clavesDup = Object.keys(duplicadas);
    if (clavesDup.length) {
        salida.avisos.push(clavesDup.length + ' mes(es) repetido(s) en "' + nombre + '" (' +
                           clavesDup.slice(0, 6).join(', ').replace(/\|/g, ' ') + '). No es el mes del selector, ' +
                           'asi que no bloquea; pero INDEX/MATCH toma la primera fila y el dia que el selector ' +
                           'apunte ahi el numero va a depender del orden.');
    }
}

/** true si el valor de una celda no tiene contenido. */
function _vaciaCP(v) {
    return v === '' || v === null || v === undefined;
}

/**
 * Clave mes|ano tal como la arma la formula del cableado (MATCH sobre mes & "|" & ano).
 * Es la unica forma de comprobar de antemano lo que el MATCH exacto va a encontrar.
 */
function _claveMesAnoCP(mes, ano) {
    return (_vaciaCP(mes) ? '' : String(mes)) + '|' + (_vaciaCP(ano) ? '' : String(ano));
}

/** Explica, en castellano, por que un valor no sirve como monto presupuestado. */
function _porQueNoEsNumeroCP(v) {
    if (_vaciaCP(v)) return 'tiene la celda VACIA';
    if (typeof v === 'number') return 'tiene un numero no finito (' + String(v) + ')';
    if (typeof v === 'string' && v.charAt(0) === '#') return 'tiene el error "' + v + '"';
    if (v && typeof v.getTime === 'function') return 'tiene una fecha';
    if (typeof v === 'boolean') return 'tiene un booleano (' + String(v) + ')';
    return 'tiene texto ("' + String(v).substring(0, 40) + '") en vez de un numero';
}

// ============================================
// PLAN / PREFLIGHT
// ============================================

/**
 * Construye el plan completo leyendo la planilla viva. NO ESCRIBE NADA.
 * Cuerpo compartido por estadoCableadoPresupuesto() (que solo lo informa) y por
 * aplicarCableadoPresupuesto() (que saltea las conexiones con bloqueantes).
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object} plan
 */
function _planCP(ss) {
    var plan = {
        problemas: [],
        avisos: [],
        hojas: {},
        nombres: _nombresCP(),
        conexiones: {},
        estadoGuardado: _leerEstadoCP()
    };

    ['tablero', 'inicio'].forEach(function (clave) {
        plan.hojas[clave] = ss.getSheetByName(plan.nombres[clave]);
        if (!plan.hojas[clave]) {
            plan.problemas.push('no se encontro la hoja ' + clave + ' ("' + plan.nombres[clave] + '").');
        }
    });

    // Un registro ilegible es bloqueante para todo camino que escriba: es donde vive el puntero
    // al unico respaldo valido.
    if (plan.estadoGuardado && plan.estadoGuardado._corrupto) {
        plan.problemas.push('el registro del cableado en DocumentProperties ("' + CP_PROP_ESTADO +
                            '") es ilegible: no se sabe si hay una corrida sin revertir ni cual es su ' +
                            'respaldo. Resolverlo a mano antes de escribir nada.');
    }

    if (plan.problemas.length) {
        // Sin las hojas base no hay plan posible: se devuelven las tres conexiones bloqueadas.
        ['tablero', 'inicio', 'ingresos'].forEach(function (id) {
            plan.conexiones[id] = {
                id: id, titulo: id, celdas: [], pendientes: 0,
                problemas: ['no se pudo construir el plan: ' + plan.problemas.join(' | ')], avisos: []
            };
        });
        plan.nadaQueHacer = false;
        return plan;
    }

    // La geometria del Tablero se verifica UNA VEZ y se comparte: es la que le da significado
    // tanto a las tres celdas que la conexion 1 escribe como a las seis que la conexion 2
    // espeja. Ver la decision completa en _verificarGeometriaTableroCP.
    plan.geometriaTablero = _verificarGeometriaTableroCP(plan.hojas.tablero);

    plan.conexiones.tablero = _planConexionTableroCP(ss, plan);
    plan.conexiones.inicio = _planConexionInicioCP(ss, plan);
    plan.conexiones.ingresos = _planConexionIngresosCP(ss, plan);

    plan.pendientes = 0;
    ['tablero', 'inicio', 'ingresos'].forEach(function (id) {
        plan.pendientes += plan.conexiones[id].pendientes;
    });
    plan.nadaQueHacer = plan.pendientes === 0;

    return plan;
}

/** Conexion 1: Tablero!S13:S15 <- hoja Presupuesto. */
function _planConexionTableroCP(ss, plan) {
    var con = {
        id: 'tablero',
        titulo: 'CONEXION 1 - "' + plan.nombres.tablero + '"!S13:S15 <- "' + plan.nombres.presupuesto + '"',
        celdas: [], pendientes: 0, problemas: [], avisos: [], testigos: []
    };
    var hoja = plan.hojas.tablero;
    var geo = plan.geometriaTablero;

    // --- Guard de rotulos: la fila tiene que ser la que dice ser ---
    // Bloqueante: escribir en S14 cuando Q14 dejo de decir "Gastos Fijos" pone el monto en la
    // fila equivocada y el motor de Q20:U24 empieza a repartir mal.
    geo.problemas.forEach(function (p) {
        con.problemas.push(p + ' Escribir ahi pondria el monto en la fila equivocada.');
    });

    // --- Testigos: se verifican, no se tocan ---
    // Aviso y no bloqueante PARA ESTA CONEXION: si el motor cambio de forma, escribir el
    // presupuesto en S13:S15 sigue siendo correcto. Para la conexion 2, que MUESTRA esas celdas,
    // el mismo hallazgo si bloquea (ver _verificarGeometriaTableroCP).
    geo.testigos.forEach(function (det) {
        if (det.estado !== 'OK') {
            con.avisos.push(det.celda + ' (' + det.que + '): ' + det.nota + '. No se toca; se informa porque el ' +
                            'cableado se apoya en que ese motor sea el verificado.');
        }
        con.testigos.push(det);
    });

    // --- Contrato con la hoja Presupuesto ---
    var contrato = _verificarContratoPresupuestoCP(ss, hoja);
    con.contrato = contrato;
    contrato.problemas.forEach(function (p) { con.problemas.push('contrato con "' + contrato.nombre + '": ' + p); });
    contrato.avisos.forEach(function (a) { con.avisos.push(a); });

    // --- Celdas ---
    CP_TABLERO_MONTOS.forEach(function (m) {
        var det = {
            conexion: 'tablero', hojaClave: 'tablero', hoja: plan.nombres.tablero, celda: m.celda,
            estado: '', nueva: '', nota: '', rol: m.rol,
            actual: _leerCeldaCP(hoja, m.celda)
        };

        var nueva = contrato.ok
            ? _formulaMontoPresupuestoCP(contrato.nombre, contrato.columnas, m.contrato,
                                         CP_TABLERO_SELECTOR.mes, CP_TABLERO_SELECTOR.ano)
            : '';
        det.nueva = nueva;

        if (det.actual.tipo === 'formula') {
            if (nueva && _formulasEquivalentesCP(det.actual.contenido, nueva)) {
                det.estado = 'YA_CABLEADA';
                det.nota = 'ya lee "' + contrato.nombre + '" con la formula esperada';
            } else if (det.actual.contenido.indexOf(contrato.nombre) !== -1) {
                det.estado = 'DRIFT';
                det.nota = 'ya tiene una formula que lee "' + contrato.nombre + '" pero NO es la de este ' +
                           'modulo. No se pisa una formula ajena.';
                con.problemas.push(m.celda + ': ' + det.nota);
            } else {
                det.estado = 'DRIFT';
                det.nota = 'tiene una formula ("' + det.actual.contenido.substring(0, 80) + '") en vez del ' +
                           'monto tipeado que este modulo verifico. No se pisa.';
                con.problemas.push(m.celda + ': ' + det.nota);
            }
        } else if (det.actual.tipo === 'numero') {
            det.estado = contrato.ok && con.problemas.length === 0 ? 'PENDIENTE' : 'BLOQUEADA';
            det.nota = 'monto tipeado a mano (' + det.actual.mostrado + '): pasa a ser un lookup por mes';
        } else if (det.actual.tipo === 'vacia') {
            det.estado = contrato.ok && con.problemas.length === 0 ? 'PENDIENTE' : 'BLOQUEADA';
            det.nota = 'celda vacia: el motor de Q20:U24 esta leyendo un cero';
        } else {
            det.estado = 'DRIFT';
            det.nota = 'contiene ' + det.actual.tipo + ' ("' + det.actual.mostrado + '") donde se esperaba un ' +
                       'monto numerico. No se escribe encima.';
            con.problemas.push(m.celda + ': ' + det.nota);
        }
        con.celdas.push(det);
    });

    // Si aparecio un bloqueante despues de haber marcado alguna celda PENDIENTE, se degradan
    // todas: la conexion es atomica, o se cablean las tres celdas o ninguna.
    if (con.problemas.length) {
        con.celdas.forEach(function (d) { if (d.estado === 'PENDIENTE') d.estado = 'BLOQUEADA'; });
    }
    con.pendientes = con.celdas.filter(function (d) { return d.estado === 'PENDIENTE'; }).length;
    return con;
}

/** Conexion 2: Inicio!J16:K18 <- espejo del bloque del Tablero. */
function _planConexionInicioCP(ss, plan) {
    var con = {
        id: 'inicio',
        titulo: 'CONEXION 2 - "' + plan.nombres.inicio + '"!J16:K18 (espejo de "' + plan.nombres.tablero + '")',
        celdas: [], pendientes: 0, problemas: [], avisos: []
    };
    var hoja = plan.hojas.inicio;
    var hojaTablero = plan.hojas.tablero;
    var geo = plan.geometriaTablero;

    // --- Guard de geometria del TABLERO: sin el, esta conexion escribe a ciegas ---
    // Las seis celdas de "Inicio" no calculan nada: MUESTRAN celdas del Tablero. Su significado
    // no esta en "Inicio" sino alla, asi que verificar solo los rotulos de "Inicio" -- que es
    // todo lo que esta conexion hacia antes de este arreglo -- deja pasar el caso que importa:
    // el bloque del Tablero reordenado, con Inicio!I17 diciendo "Gastos Fijos" y su formula
    // leyendo una fila que ya no lo es. Ver _verificarGeometriaTableroCP.
    var dependencias = [CP_INICIO.baseCelda];
    CP_INICIO.filas.forEach(function (f) {
        dependencias.push(f.origenPorcentaje);
        dependencias.push(f.origenDisponibilidad);
    });
    var yaReportada = Object.create(null);
    dependencias.forEach(function (celda) {
        if (yaReportada[celda]) return;
        yaReportada[celda] = true;
        var v = _dependenciaTableroCP(geo, celda);
        if (v.ok) return;
        con.problemas.push('depende de "' + plan.nombres.tablero + '"!' + celda + ', que no paso la ' +
                           'verificacion de geometria: ' + v.motivo + '. Este bloque no calcula, ESPEJA: ' +
                           'escribirlo mostraria bajo los rotulos de "' + plan.nombres.inicio + '" un numero ' +
                           'que ya no es el que dicen.');
    });

    // La forma es la verificada pero el motor devuelve error HOY: se cablea igual (el cable es
    // correcto y se enciende solo cuando el motor vuelva), pero no en silencio. Sin este aviso,
    // Franco cablea y ve seis celdas en blanco sin ninguna explicacion.
    if (geo && geo.enError && geo.enError.length) {
        con.avisos.push('el motor del Tablero devuelve error en este momento (' + geo.enError.join('; ') +
                        '), aunque sus formulas son las verificadas. El espejo se escribe igual -- es el ' +
                        'cable correcto -- y, por el fallback en blanco, esas celdas de "' + plan.nombres.inicio +
                        '" van a quedar VACIAS y no en cero hasta que el motor vuelva. Se encienden solas: ' +
                        'no hay que volver a cablear.');
    }

    // --- Guard de geometria de la UI: la UI tiene que ser la que se verifico ---
    var titulo = hoja.getRange(CP_INICIO.titulo.celda).getDisplayValue();
    if (!_rotuloCoincideCP(titulo, CP_INICIO.titulo.rotulos)) {
        con.problemas.push(CP_INICIO.titulo.celda + ' dice "' + titulo + '" y se esperaba "Presupuesto del ' +
                           'Mes.". La UI no es la verificada: escribir a ciegas sobre una UI dibujada por ' +
                           'otro es como se rompen las cosas.');
    }
    CP_INICIO.headers.forEach(function (h) {
        var v = hoja.getRange(h.celda).getDisplayValue();
        if (!_rotuloCoincideCP(v, h.rotulos)) {
            con.problemas.push(h.celda + ' dice "' + v + '" y se esperaba "' + h.rotulos[0] + '" (' + h.que +
                               '). La geometria de columnas no coincide.');
        }
    });
    CP_INICIO.filas.forEach(function (f) {
        var v = hoja.getRange(f.celdaRotulo).getDisplayValue();
        if (!_rotuloCoincideCP(v, f.rotulos)) {
            con.problemas.push(f.celdaRotulo + ' dice "' + v + '" y se esperaba el macro grupo "' +
                               f.rotulos[0] + '". Las filas del bloque no estan en el orden verificado: ' +
                               'el % y la disponibilidad quedarian en la fila equivocada.');
        }
    });

    // --- Aviso de selectores desalineados (no bloquea) ---
    try {
        var mesInicio = hoja.getRange('P4').getDisplayValue();
        var anoInicio = hoja.getRange('P6').getDisplayValue();
        var mesTablero = hojaTablero.getRange('I4').getDisplayValue();
        var anoTablero = hojaTablero.getRange('I6').getDisplayValue();
        if (_normalizarCP(mesInicio) !== _normalizarCP(mesTablero) ||
            _normalizarCP(anoInicio) !== _normalizarCP(anoTablero)) {
            con.avisos.push('los selectores no coinciden: "' + plan.nombres.inicio + '" apunta a ' + mesInicio +
                            ' ' + anoInicio + ' y "' + plan.nombres.tablero + '" a ' + mesTablero + ' ' +
                            anoTablero + '. Este bloque espeja el Tablero (ver la decision en CP_INICIO), ' +
                            'asi que mostrara el mes del Tablero. Es la consecuencia declarada de que los ' +
                            'numeros sean identicos en ambas vistas.');
        }
    } catch (e) {
        con.avisos.push('no se pudieron leer los selectores para comparar los meses: ' + e.message);
    }

    // --- Celdas ---
    var pares = [];
    CP_INICIO.filas.forEach(function (f) {
        pares.push({
            celda: f.celdaPorcentaje,
            nueva: _formulaPorcentajeInicioCP(plan.nombres.tablero, f.origenPorcentaje, CP_INICIO.baseCelda),
            rol: 'porcentaje del macro grupo sobre el ingreso presupuestado (' + f.origenPorcentaje + '/' +
                 CP_INICIO.baseCelda + '). Las tres proporciones suman 100 % exacto porque S17 = S13-S14-S15'
        });
        pares.push({
            celda: f.celdaDisponibilidad,
            nueva: _formulaDisponibilidadInicioCP(plan.nombres.tablero, f.origenDisponibilidad),
            rol: 'espejo del reparto de liquidez que ya calcula ' + f.origenDisponibilidad
        });
    });

    pares.forEach(function (p) {
        var det = {
            conexion: 'inicio', hojaClave: 'inicio', hoja: plan.nombres.inicio, celda: p.celda,
            estado: '', nueva: p.nueva, nota: '', rol: p.rol,
            actual: _leerCeldaCP(hoja, p.celda)
        };

        if (det.actual.tipo === 'vacia') {
            det.estado = 'PENDIENTE';
            det.nota = 'vacia: se completa';
        } else if (det.actual.tipo === 'formula' && _formulasEquivalentesCP(det.actual.contenido, p.nueva)) {
            det.estado = 'YA_CABLEADA';
            det.nota = 'ya tiene la formula esperada';
        } else {
            det.estado = 'DRIFT';
            det.nota = 'no esta vacia: contiene ' + det.actual.tipo + ' ("' +
                       String(det.actual.contenido).substring(0, 80) + '"). No se pisa contenido ajeno.';
            con.problemas.push(p.celda + ': ' + det.nota);
        }
        con.celdas.push(det);
    });

    if (con.problemas.length) {
        con.celdas.forEach(function (d) { if (d.estado === 'PENDIENTE') d.estado = 'BLOQUEADA'; });
    }
    con.pendientes = con.celdas.filter(function (d) { return d.estado === 'PENDIENTE'; }).length;
    return con;
}

/** Conexion 3: exclusion de las CUENTAS NEUTRAS en las formulas de ingresos. */
function _planConexionIngresosCP(ss, plan) {
    var neutras = _cuentasNeutrasCP();
    var con = {
        id: 'ingresos',
        titulo: 'CONEXION 3 - exclusion de las cuentas neutras (' + neutras.lista.join(', ') +
                ') en las formulas que suman INGRESOS',
        celdas: [], pendientes: 0, problemas: [], avisos: [], cuentasNeutras: neutras
    };
    con.avisos.push('cuentas neutras vigentes: ' + neutras.lista.join(', ') + ' -- fuente: ' + neutras.fuente +
                    '. Cirugia solo sobre "' + CP_CUENTA_CIRUGIA + '"; el resto se audita (ver la decision ' +
                    'en CP_CUENTA_CIRUGIA).');

    CP_CELDAS_INGRESOS.forEach(function (c) {
        var hoja = plan.hojas[c.hojaClave];
        var det = {
            conexion: 'ingresos', hojaClave: c.hojaClave, hoja: plan.nombres[c.hojaClave], celda: c.celda,
            estado: '', nueva: '', nota: '', rol: c.rol, modo: c.modo,
            actual: _leerCeldaCP(hoja, c.celda), insertado: '', indice: -1
        };

        if (det.actual.tipo !== 'formula') {
            det.estado = 'DRIFT';
            det.nota = 'no tiene formula (contiene ' + det.actual.tipo + '): no es la celda verificada.';
            con.avisos.push(det.hoja + '!' + c.celda + ': ' + det.nota);
            con.celdas.push(det);
            return;
        }

        // Guard sobre TODAS las cuentas neutras. Las que no son la de cirugia solo se reportan:
        // faltarlas era invisible antes de este arreglo, ahora se nombra con celda y remedio.
        var faltan = _cuentasNeutrasFaltantesCP(det.actual.contenido, neutras.lista);
        det.neutrasFaltantes = faltan;
        var faltanSoloAuditables = faltan.filter(function (n) { return n !== CP_CUENTA_CIRUGIA; });
        if (faltanSoloAuditables.length) {
            // El remedio depende de la FORMA de la formula, y este modulo conoce las dos que hay
            // en su lista: una QUERY (se agrega una condicion al WHERE) o un LET (se declara una
            // variable hermana de la de Traspaso). Se nombran las dos en vez de inventar una
            // sola: sugerir el fragmento equivocado para la forma equivocada es peor que no
            // sugerir ninguno.
            var remedio = c.modo === 'cirugia'
                ? 'agregar a mano "(Col1 != \'' + faltanSoloAuditables[0] + '\' OR Col5 = \'Liquidez\') AND" ' +
                  'al WHERE de su QUERY'
                : 'agregar a mano la condicion que corresponda a su forma: si es un LET, una variable ' +
                  'hermana de la de Traspaso ("cuenta <> \'' + faltanSoloAuditables[0] + '\'"); si es una ' +
                  'QUERY, "(Col1 != \'' + faltanSoloAuditables[0] + '\' OR Col5 = \'Liquidez\') AND" al WHERE';
            con.problemas.push(det.hoja + '!' + c.celda + ': NO excluye ' + faltanSoloAuditables.join(' ni ') +
                               ', que es cuenta neutra (' + neutras.fuente + '): los movimientos que solo ' +
                               'mueven plata de lugar estan entrando como ingreso. Este modulo NO la inserta ' +
                               '-- su forma verificada depende de otra columna de la tabla virtual, ver la ' +
                               'decision en CP_CUENTA_CIRUGIA --: ' + remedio + ', con el criterio de negocio ' +
                               'que corresponda.');
        }

        if (faltan.indexOf(CP_CUENTA_CIRUGIA) === -1) {
            det.estado = 'YA_CABLEADA';
            det.nota = 'ya excluye Traspaso: no se toca (guard anti-drift)' +
                       (faltanSoloAuditables.length ? '. PERO le falta ' + faltanSoloAuditables.join(' y ') : '');
            con.celdas.push(det);
            return;
        }

        if (c.modo === 'auditoria') {
            det.estado = 'SOLO_AUDITORIA';
            det.nota = 'NO excluye Traspaso y este modulo no la interviene (forma no apta para cirugia: ' +
                       'ver la decision en CP_CELDAS_INGRESOS). Arreglar a mano.';
            con.problemas.push(det.hoja + '!' + c.celda + ': ' + det.nota);
            con.celdas.push(det);
            return;
        }

        var res = _insertarExclusionTraspasoCP(det.actual.contenido, c.marca);
        if (!res.ok) {
            det.estado = 'DRIFT';
            det.nota = res.problemas.join(' | ');
            con.problemas.push(det.hoja + '!' + c.celda + ': ' + det.nota);
            con.celdas.push(det);
            return;
        }

        det.estado = 'PENDIENTE';
        det.nueva = res.formula;
        det.insertado = res.insertado;
        det.indice = res.indice;
        det.nota = 'le falta la exclusion: se antepone "' + CP_EXCLUSION_TRASPASO + ' AND" al WHERE';
        con.celdas.push(det);
    });

    // decision Franco 2026-08-13: aca un bloqueante NO degrada las celdas pendientes. Las tres
    // conexiones son independientes entre si, y dentro de la 3 cada formula tambien lo es: que
    // un LET de Inicio necesite mano humana no es motivo para dejar el Pareto del Tablero
    // sumando traspasos. Es lo contrario de las conexiones 1 y 2, donde las celdas forman un
    // bloque unico y cablear la mitad seria peor que no cablear nada.
    con.pendientes = con.celdas.filter(function (d) { return d.estado === 'PENDIENTE'; }).length;
    return con;
}

// ============================================
// INFORME
// ============================================

/** Arma el informe humano del plan. */
function _redactarPlanCP(plan) {
    var l = [];
    l.push('CABLEADO DEL PRESUPUESTO v' + CP_VERSION + ' - ESTADO (lectura, no se escribio ninguna celda)');
    l.push('');

    var eg = plan.estadoGuardado || {};
    if (eg._corrupto) {
        l.push('Registro: ILEGIBLE en DocumentProperties (' + eg._crudo + ').');
        l.push('aplicar y revertir ABORTAN mientras siga asi: sin ese registro no se sabe cual es el respaldo.');
    } else if (eg.iniciadaEn) {
        l.push('Registro: ' + (eg.aplicadaEn ? 'aplicado el ' + eg.aplicadaEn
                                             : 'iniciado el ' + eg.iniciadaEn + ' y SIN CIERRE') +
               (eg.revertidaEn ? ' / revertido el ' + eg.revertidaEn : '') +
               (eg.intentos > 1 ? ' / ' + eg.intentos + ' intentos' : ''));
        if (eg.respaldo) l.push('Respaldo: "' + eg.respaldo + '"');
        if (_enVueloCP(eg)) {
            l.push('CORRIDA EN VUELO (sin revertir): una nueva corrida de aplicar REUTILIZA ese respaldo.');
        }
    } else {
        l.push('Registro: sin aplicacion previa.');
    }
    l.push('(el registro es auditoria; lo que sigue se derivo de la planilla viva)');
    l.push('');

    ['tablero', 'inicio', 'ingresos'].forEach(function (id) {
        var con = plan.conexiones[id];
        if (!con) return;
        l.push(con.titulo);
        con.celdas.forEach(function (d) {
            l.push('   ' + d.hoja + '!' + d.celda + ': ' + d.estado + (d.nota ? ' - ' + d.nota : ''));
            if (d.estado === 'PENDIENTE' && d.nueva) {
                l.push('      queda: ' + String(d.nueva).replace(/\s+/g, ' ').substring(0, 220));
            }
        });
        if (con.testigos && con.testigos.length) {
            l.push('   testigos (se verifican, NO se tocan): ' + con.testigos.map(function (t) {
                return t.celda + ' ' + t.estado;
            }).join(', '));
        }
        // Evidencia positiva del contrato de datos: lo que se verifico, no solo lo que fallo.
        if (con.contrato && con.contrato.ok) {
            l.push('   datos de "' + con.contrato.nombre + '": ' + con.contrato.filasCargadas +
                   ' mes(es) cargado(s); el selector ' + CP_TABLERO_SELECTOR.mes + '/' +
                   CP_TABLERO_SELECTOR.ano + ' (' + String(con.contrato.selector.mes) + ' ' +
                   String(con.contrato.selector.ano) + ') resuelve a la fila ' + con.contrato.filaSelector +
                   ', con sus tres montos verificados como numeros.');
        }
        if (con.avisos.length) {
            con.avisos.forEach(function (a) { l.push('   aviso: ' + a); });
        }
        if (con.problemas.length) {
            l.push('   BLOQUEANTES de esta conexion (se saltea entera' +
                   (id === 'ingresos' ? ', salvo las celdas que si son aplicables' : '') + '):');
            con.problemas.forEach(function (p) { l.push('      - ' + p); });
        }
        l.push('   pendientes: ' + con.pendientes);
        l.push('');
    });

    l.push('FUERA DE ALCANCE de esta pieza (se ven, no se arreglan aca):');
    CP_FUERA_DE_ALCANCE.forEach(function (t) { l.push('   - ' + t); });
    l.push('');

    if (plan.avisos.length) {
        l.push('AVISOS GENERALES:');
        plan.avisos.forEach(function (a) { l.push('   - ' + a); });
        l.push('');
    }

    if (plan.problemas.length) {
        l.push('BLOQUEANTES GENERALES: aplicar ABORTA sin tocar nada por:');
        plan.problemas.forEach(function (p) { l.push('   - ' + p); });
    } else if (plan.nadaQueHacer) {
        l.push('VEREDICTO: nada que hacer. Todo lo aplicable ya esta cableado.');
    } else {
        l.push('VEREDICTO: aplicable. aplicarCableadoPresupuesto() escribiria ' + plan.pendientes + ' celda(s).');
    }

    return l.join('\n');
}

// ============================================
// RESPALDO (SIEMPRE ANTES DE MUTAR, SIEMPRE VERIFICADO)
// ============================================

/**
 * Congela el contenido original de las celdas pendientes: en DocumentProperties (registro
 * primario que usa revertir) y en una hoja fechada oculta (copia auditable que sobrevive a un
 * borrado de propiedades). Todo se escribe como TEXTO y se RELEE antes de darlo por bueno.
 *
 * Si ya hay una hoja de respaldo de esta misma corrida (reintento tras un corte), las filas
 * nuevas se APENDEAN: el puntero del estado no se mueve y la lista a restaurar sigue siendo la
 * union de todas las corridas.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Array} pendientes celdas con estado PENDIENTE
 * @param {string} sello
 * @param {GoogleAppsScript.Spreadsheet.Sheet|null} hojaExistente
 * @param {boolean} [soloProps] true para no abrir hoja nueva (la de esta corrida desaparecio)
 * @returns {{nombre: ?string, celdas: number}|null}
 * @throws {Error} si el registro no queda verificado (el llamador aborta ANTES de mutar)
 */
function _respaldarCeldasCP(ss, pendientes, sello, hojaExistente, soloProps) {
    var props = PropertiesService.getDocumentProperties();
    var encabezado = ['hoja', 'celda', 'tipo', 'contenido original', 'valor mostrado antes', 'conexion', 'sello'];
    var nuevas = [];

    pendientes.forEach(function (d) {
        var registro = { tipo: d.actual.tipo, contenido: d.actual.contenido };
        props.setProperty(_claveOriginalCP(d.hoja, d.celda), JSON.stringify(registro));
        nuevas.push([d.hoja, d.celda, d.actual.tipo, d.actual.contenido, d.actual.mostrado, d.conexion, sello]);
    });

    if (nuevas.length === 0) {
        logInfo('_respaldarCeldasCP: no hay celdas pendientes, no se crea hoja de respaldo.');
        return null;
    }

    var malas = [];
    nuevas.forEach(function (fila) {
        var guardada = props.getProperty(_claveOriginalCP(fila[0], fila[1]));
        var esperada = JSON.stringify({ tipo: fila[2], contenido: fila[3] });
        if (guardada !== esperada) malas.push(fila[0] + '!' + fila[1] + ' (DocumentProperties)');
    });

    if (soloProps === true) {
        if (malas.length) {
            throw new Error('El respaldo no quedo verificado en: ' + malas.join(', ') +
                            '. No se muto ninguna celda de las hojas vivas.');
        }
        logInfo('_respaldarCeldasCP: la hoja de respaldo de esta corrida ya no esta; se registran ' +
                nuevas.length + ' celda(s) SOLO en DocumentProperties y no se abre una hoja nueva ' +
                '(abrirla dejaria fuera de la lista las celdas de la corrida anterior).');
        return { nombre: null, celdas: nuevas.length };
    }

    var destino = hojaExistente || null;
    var nombre = destino ? destino.getName() : _nombreHojaLibreCP(ss, CP_RESPALDO_PREFIJO + sello);
    var esNueva = !destino;
    if (esNueva) {
        destino = ss.insertSheet(nombre);
        invalidarCacheNombresHojas();   // el cache de nombres del config quedo viejo
    }

    var primeraFila = esNueva ? 1 : Math.max(destino.getLastRow() + 1, 2);
    var bloque = esNueva ? [encabezado].concat(nuevas) : nuevas;
    asegurarCapacidadFilas(destino, primeraFila + bloque.length - 1);

    var rango = destino.getRange(primeraFila, 1, bloque.length, encabezado.length);
    rango.setNumberFormat('@');   // texto plano para la VISUALIZACION
    // El formato '@' NO alcanza: setValues con un string que arranca en "=" lo hace parsear como
    // FORMULA igual, y el respaldo quedaria vivo, recalculandose contra la misma vista que este
    // modulo esta por cambiar (cicatriz 4 del arnes, la que costo la v0.9.8). El apostrofo
    // fuerza texto y NO forma parte del valor: getValue() lo devuelve sin el.
    rango.setValues(bloque.map(function (fila) {
        return fila.map(_textoLiteralCP);
    }));

    SpreadsheetApp.flush();
    var rangoReleido = destino.getRange(primeraFila, 1, bloque.length, encabezado.length);
    var releido = rangoReleido.getValues();
    var formulasVivas = rangoReleido.getFormulas();

    bloque.forEach(function (fila, i) {
        for (var cf = 0; cf < encabezado.length; cf++) {
            if (formulasVivas[i][cf]) {
                malas.push(fila[0] + '!' + fila[1] + ' (hoja "' + nombre + '", columna ' + (cf + 1) +
                           ': quedo como FORMULA VIVA, no como texto)');
                return;
            }
        }
    });
    bloque.forEach(function (fila, i) {
        for (var c = 0; c < 4; c++) {   // hoja, celda, tipo, contenido: las cuatro que restauran
            if (String(releido[i][c]) !== String(fila[c])) {
                malas.push(fila[0] + '!' + fila[1] + ' (hoja "' + nombre + '", columna ' + (c + 1) + ')');
                return;
            }
        }
    });

    if (malas.length) {
        throw new Error('El respaldo no quedo verificado en: ' + malas.join(', ') +
                        '. No se muto ninguna celda de las hojas vivas.');
    }

    if (esNueva) destino.hideSheet();
    logSuccess('Respaldo VERIFICADO de ' + nuevas.length + ' celda(s) en "' + nombre +
               '" y en DocumentProperties.');
    return { nombre: nombre, celdas: nuevas.length };
}

// ============================================
// OPERACIONES
// ============================================

/**
 * Escribe las celdas pendientes de una conexion y VERIFICA lo escrito.
 *
 * Si la verificacion no cierra, lo dice como "no se pudo confirmar": la celda YA fue escrita y
 * negarlo seria mentir.
 *
 * @param {Object} plan
 * @param {Array} pendientes
 * @returns {{detalle: string[], avisos: string[]}}
 */
function _aplicarCeldasCP(plan, pendientes) {
    var detalle = [];
    var avisos = [];

    pendientes.forEach(function (d) {
        plan.hojas[d.hojaClave].getRange(d.celda).setFormula(d.nueva);
        detalle.push(d.hoja + '!' + d.celda + ': escrita.');
    });

    SpreadsheetApp.flush();

    pendientes.forEach(function (d) {
        var rango = plan.hojas[d.hojaClave].getRange(d.celda);
        var escrita = rango.getFormula();
        var mostrado = rango.getDisplayValue();

        if (!_formulasEquivalentesCP(escrita, d.nueva)) {
            avisos.push('NO SE PUDO CONFIRMAR ' + d.hoja + '!' + d.celda + ': la formula quedo escrita pero ' +
                        'difiere de la esperada (posible normalizacion de locale). Revisar a mano; el ' +
                        'original esta en el respaldo.');
        }
        var eraError = String(d.actual.mostrado).charAt(0) === '#';
        var esError = String(mostrado).charAt(0) === '#';
        if (esError && !eraError) {
            avisos.push('NO SE PUDO CONFIRMAR ' + d.hoja + '!' + d.celda + ': antes mostraba "' +
                        d.actual.mostrado + '" y ahora "' + mostrado + '". Puede ser recalculo en curso o un ' +
                        'error real: verificar en pantalla antes de dar el cableado por bueno.');
        }
    });

    return { detalle: detalle, avisos: avisos };
}

// ============================================
// FUNCIONES PUBLICAS (MENU)
// ============================================

/**
 * Informa QUE CAMBIARIA el cableado, sin escribir una sola celda. Es lo primero que se corre.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}} ok=false si hay bloqueantes
 */
function estadoCableadoPresupuesto(yaConLock) {
    return _informarResultadoCP('Cableado del Presupuesto - estado', _conLockCP(yaConLock, function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var plan = _planCP(ss);
            var informe = _redactarPlanCP(plan);
            Logger.log(informe);
            _alertaCP('Cableado del Presupuesto - estado', informe);

            var bloqueantes = plan.problemas.length;
            ['tablero', 'inicio', 'ingresos'].forEach(function (id) {
                if (plan.conexiones[id]) bloqueantes += plan.conexiones[id].problemas.length;
            });

            if (bloqueantes) {
                return {
                    ok: false,
                    error: 'La planilla no esta en el estado esperado: ' + bloqueantes + ' bloqueante(s). ' +
                           'Las conexiones afectadas se saltean; el resto es aplicable.',
                    detalle: informe
                };
            }
            return { ok: true, detalle: informe };
        } catch (err) {
            // El error viaja con su STACK: un TypeError sin linea ni funcion obliga a adivinar
            // desde afuera. Es una funcion de solo lectura y de uso interno.
            logError('estadoCableadoPresupuesto: fallo la lectura del estado', err);
            var traza = err && err.stack ? String(err.stack).split('\n').slice(0, 6).join('\n') : '(sin stack)';
            return {
                ok: false,
                error: 'No se pudo leer el estado: ' + err.message + '. No se escribio nada.',
                detalle: 'DETALLE TECNICO (copiar y pasar a la sesion de trabajo):\n' + traza
            };
        }
    }));
}

/**
 * Aplica el cableado: preflight, respaldo congelado y verificado, y las conexiones aplicables.
 *
 * Aborta ANTES de tocar una celda si hay bloqueantes generales. La confirmacion es obligatoria
 * cuando hay UI; sin UI solo procede si el llamador declara yaConLock (esta siendo conducida
 * por una rutina que ya decidio), nunca por iniciativa propia.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarCableadoPresupuesto(yaConLock) {
    return _informarResultadoCP('Cableado del Presupuesto - NO APLICADO', _conLockCP(yaConLock, function () {
        // progreso.muto se enciende justo antes de la PRIMERA escritura sobre una hoja viva: es
        // lo que le permite al catch de ultima instancia no mentir en ninguna direccion.
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoAplicarCP(progreso, yaConLock === true);
        } catch (err) {
            logError('aplicarCableadoPresupuesto: excepcion no prevista', err);
            if (!progreso.muto) {
                return {
                    ok: false,
                    error: 'Excepcion no prevista antes de mutar: ' + err.message +
                           '. No se modifico ninguna celda de las hojas vivas' +
                           (progreso.respaldo ? ' (puede haber quedado la hoja de respaldo "' +
                            progreso.respaldo + '", se borra a mano)' : '') + '.'
                };
            }
            return {
                ok: false,
                error: 'Excepcion no prevista DESPUES de haber empezado a escribir: ' + err.message +
                       '. NO SE PUDO CONFIRMAR el estado de la planilla: correr ' +
                       'estadoCableadoPresupuesto() y, si hace falta, revertirCableadoPresupuesto()' +
                       (progreso.respaldo ? ' (respaldo "' + progreso.respaldo + '")' : '') + '.'
            };
        }
    }));
}

/**
 * Cuerpo de aplicarCableadoPresupuesto(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string}} progreso testigo de si ya se escribio
 * @param {boolean} conducida true si el llamador ya tenia el lock
 */
function _cuerpoAplicarCP(progreso, conducida) {
    var ss, plan, informe;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        plan = _planCP(ss);
        informe = _redactarPlanCP(plan);
        Logger.log(informe);
    } catch (err) {
        logError('aplicarCableadoPresupuesto: fallo el preflight', err);
        return { ok: false, error: 'Fallo el preflight: ' + err.message + '. No se escribio nada.' };
    }

    if (plan.problemas.length) {
        _alertaCP('Cableado del Presupuesto - ABORTADO', informe);
        return {
            ok: false,
            error: 'Abortado por preflight, no se toco ninguna celda. Bloqueantes: ' + plan.problemas.join(' | '),
            detalle: informe,
            _avisado: true
        };
    }

    if (plan.nadaQueHacer) {
        _alertaCP('Cableado del Presupuesto', 'Nada que hacer: todo lo aplicable ya esta cableado.\n\n' + informe);
        return { ok: true, detalle: 'Nada que hacer, todo lo aplicable ya esta cableado.\n\n' + informe };
    }

    var pendientes = [];
    ['tablero', 'inicio', 'ingresos'].forEach(function (id) {
        plan.conexiones[id].celdas.forEach(function (d) {
            if (d.estado === 'PENDIENTE') pendientes.push(d);
        });
    });

    // --- Confirmacion ---
    var estadoPrevio = plan.estadoGuardado || {};
    var enVuelo = _enVueloCP(estadoPrevio);
    var ui = _uiCP();
    if (ui) {
        var resumen = ['tablero', 'inicio', 'ingresos'].map(function (id) {
            var c = plan.conexiones[id];
            return '  ' + c.titulo.split(' - ')[0] + ': ' + c.pendientes + ' celda(s)' +
                   (c.problemas.length ? ' (' + c.problemas.length + ' bloqueante(s): se saltea)' : '');
        }).join('\n');

        var resp = ui.alert(
            'Cableado del Presupuesto' + (enVuelo ? ' (reintento)' : ''),
            'Se van a escribir ' + pendientes.length + ' celda(s) de la planilla productiva:\n' +
            resumen + '\n\n' +
            (enVuelo
                ? 'REINTENTO sobre la corrida iniciada el ' + estadoPrevio.iniciadaEn + '.\n' +
                  'Se CONSERVA el respaldo original "' + estadoPrevio.respaldo + '" (no se crea uno nuevo).\n'
                : 'Antes de tocar nada se congela un respaldo verificado (hoja oculta fechada).\n') +
            'Corriste estadoCableadoPresupuesto() y leiste el informe? Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) {
            logInfo('aplicarCableadoPresupuesto: cancelado por el usuario.');
            return { ok: false, error: 'Cancelado por el usuario. No se escribio nada.' };
        }
    } else if (conducida !== true) {
        return {
            ok: false,
            error: 'Sin UI para confirmar una operacion que escribe sobre produccion. ' +
                   'Ejecutar desde el menu tidetrack Dev. No se escribio nada.'
        };
    } else {
        logInfo('aplicarCableadoPresupuesto: sin UI, ejecutado por un llamador que ya tiene el lock.');
    }

    var sello = _selloCP();
    var hechos = [];
    var respaldo = null;

    // --- RESPALDO CONGELADO Y VERIFICADO ANTES DE MUTAR ---
    // decision Franco 2026-08-13: CRITERIO DEL RESPALDO INMUTABLE. Mientras exista una corrida
    // sin revertir, el respaldo original NO se toca y NO se crea uno nuevo: se reutiliza. El
    // caso que lo exige es el reintento sobre una planilla ya medio cableada; un respaldo nuevo
    // ahi seria la foto del estado a medio hacer, y revertir devolveria a el afirmando exito.
    try {
        if (enVuelo) {
            var hojaPrevia = estadoPrevio.respaldo ? ss.getSheetByName(estadoPrevio.respaldo) : null;
            var faltaHoja = !!(estadoPrevio.respaldo && !hojaPrevia);
            if (faltaHoja) {
                hechos.push('aviso: la hoja de respaldo "' + estadoPrevio.respaldo + '" ya no esta; el ' +
                            'registro vive en DocumentProperties y desde ahi se restaura.');
            }
            var res1 = _respaldarCeldasCP(ss, pendientes, sello, hojaPrevia, faltaHoja);
            respaldo = estadoPrevio.respaldo || (res1 ? res1.nombre : null);
            progreso.respaldo = respaldo;

            _guardarEstadoCP({
                respaldo: respaldo,
                intentos: (estadoPrevio.intentos || 1) + 1,
                ultimoIntentoEn: new Date().toISOString()
            });
            hechos.push('respaldo: se reutiliza el original "' + respaldo + '" (reintento, no se pisa).');
        } else {
            // La planilla tambien se consulta como evidencia, no solo el registro: si hay hojas
            // RESP_CABLEADO_* huerfanas, hubo una corrida cuyo registro se perdio. Congelar un
            // respaldo nuevo ahi seria fotografiar un estado posiblemente ya cableado.
            var huerfanas = ss.getSheets()
                .map(function (h) { return h.getName(); })
                .filter(function (n) { return n.indexOf(CP_RESPALDO_PREFIJO) === 0; })
                .sort();
            if (huerfanas.length > 0) {
                return {
                    ok: false,
                    error: 'Hay respaldo(s) de una corrida anterior sin registro asociado: ' +
                           huerfanas.join(', ') + '. No se congela uno nuevo porque podria ser la foto de ' +
                           'un estado ya cableado y revertir devolveria a el. No se modifico ninguna celda. ' +
                           'El punto de retorno candidato es el MAS ANTIGUO: "' + huerfanas[0] + '". ' +
                           'Resolver a mano y borrar la hoja, o restaurar desde ella.'
                };
            }

            var res2 = _respaldarCeldasCP(ss, pendientes, sello, null);
            respaldo = res2 ? res2.nombre : null;
            progreso.respaldo = respaldo;

            // El puntero al respaldo se persiste ANTES de la primera mutacion: si algo corta a
            // mitad de camino, el rastro de donde esta la copia ya quedo guardado.
            _guardarEstadoCP({
                sello: sello,
                respaldo: respaldo,
                celdasRespaldadas: res2 ? res2.celdas : 0,
                respaldoVerificadoEn: new Date().toISOString(),
                iniciadaEn: new Date().toISOString(),
                intentos: 1,
                aplicadaEn: null,
                revertidaEn: null
            });
        }
    } catch (err) {
        logError('aplicarCableadoPresupuesto: fallo el respaldo', err);
        return {
            ok: false,
            error: 'Fallo al congelar o verificar el respaldo: ' + err.message +
                   '. Se aborto ANTES de mutar: no se modifico ninguna celda de las hojas vivas' +
                   (respaldo ? ' (quedo la hoja "' + respaldo + '", se puede borrar a mano)' : '') + '.'
        };
    }

    // El respaldo ya esta escrito y releido: recien ahora se habilita la primera mutacion.
    SpreadsheetApp.flush();
    progreso.muto = true;

    var resultado;
    try {
        resultado = _aplicarCeldasCP(plan, pendientes);
        resultado.detalle.forEach(function (d) { hechos.push(d); });
    } catch (err) {
        logError('aplicarCableadoPresupuesto: fallo la escritura', err);
        _guardarEstadoCP({ pasos: { escritura: 'incierta' } });
        return {
            ok: false,
            error: 'Fallo durante la escritura: ' + err.message +
                   '. NO SE PUDO CONFIRMAR cuales celdas quedaron escritas: correr ' +
                   'estadoCableadoPresupuesto() para ver como quedo. El cableado es idempotente y el ' +
                   'reintento CONSERVA este mismo respaldo, asi que reintentar es seguro. ' +
                   'Respaldo congelado y verificado: "' + respaldo + '".',
            detalle: hechos.join('\n')
        };
    }

    _guardarEstadoCP({
        aplicadaEn: new Date().toISOString(),
        revertidaEn: null,
        pasos: { escritura: 'aplicada' },
        celdasEscritas: pendientes.length
    });

    var salida = ['CABLEADO DEL PRESUPUESTO v' + CP_VERSION + ' APLICADO'];
    salida.push('');
    hechos.forEach(function (h) { salida.push('  ' + h); });
    salida.push('');
    salida.push('Respaldo (hoja oculta): "' + respaldo + '".');
    ['tablero', 'inicio', 'ingresos'].forEach(function (id) {
        var c = plan.conexiones[id];
        if (c.problemas.length) {
            salida.push('');
            salida.push('SALTEADO en ' + c.titulo.split(' - ')[0] + ':');
            c.problemas.forEach(function (p) { salida.push('  - ' + p); });
        }
    });
    if (resultado.avisos.length) {
        salida.push('');
        salida.push('VERIFICACION POSTERIOR:');
        resultado.avisos.forEach(function (a) { salida.push('  - ' + a); });
    }
    salida.push('');
    salida.push('Siguiente paso: correr estadoCableadoPresupuesto() de nuevo (debe reportar "nada que ' +
                'hacer" en lo aplicado) y mirar Tablero!Q11:U24 e Inicio!I14:K18 en pantalla.');

    var texto = salida.join('\n');
    Logger.log(texto);
    _alertaCP('Cableado del Presupuesto aplicado', texto);
    logSuccess('aplicarCableadoPresupuesto: completado. ' + pendientes.length + ' celda(s) escritas.');

    if (resultado.avisos.length) {
        // Se escribio todo, pero hay verificaciones que no cerraron: ok=false para que ningun
        // llamador de la cadena lo tome por un cierre limpio.
        return {
            ok: false,
            error: 'Aplicado, pero NO SE PUDO CONFIRMAR el resultado de ' + resultado.avisos.length +
                   ' verificacion(es) posterior(es). Revisar el detalle antes de darlo por bueno.',
            detalle: texto,
            _avisado: true
        };
    }
    return { ok: true, detalle: texto };
}

/**
 * Deshace el cableado usando el respaldo congelado.
 *
 * Restaura EXACTAMENTE lo que la corrida registro haber cambiado -- con su tipo original: la
 * constante vuelve como numero, la celda vacia vuelve vacia, la formula vuelve como formula --,
 * no la lista fija de celdas candidatas.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirCableadoPresupuesto(yaConLock) {
    return _informarResultadoCP('Revertir cableado - NO REVERTIDO', _conLockCP(yaConLock, function () {
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoRevertirCP(progreso, yaConLock === true);
        } catch (err) {
            logError('revertirCableadoPresupuesto: excepcion no prevista', err);
            if (!progreso.muto) {
                return {
                    ok: false,
                    error: 'Excepcion no prevista antes de restaurar: ' + err.message +
                           '. No se escribio ninguna celda.'
                };
            }
            return {
                ok: false,
                error: 'Excepcion no prevista DESPUES de haber empezado a restaurar: ' + err.message +
                       '. NO SE PUDO CONFIRMAR el estado de la planilla; el respaldo "' + progreso.respaldo +
                       '" sigue intacto. Revisar y reintentar.'
            };
        }
    }));
}

/**
 * Cuerpo de revertirCableadoPresupuesto(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string}} progreso
 * @param {boolean} conducida
 */
function _cuerpoRevertirCP(progreso, conducida) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var estado = _leerEstadoCP();
    var props = PropertiesService.getDocumentProperties();

    if (estado._corrupto) {
        return {
            ok: false,
            error: 'El registro del cableado en DocumentProperties es ilegible, asi que no se sabe cual es ' +
                   'el respaldo valido. NO se restaura nada a ciegas. Fragmento crudo: ' + estado._crudo +
                   '. Buscar las hojas ocultas "' + CP_RESPALDO_PREFIJO + '*" (vale la MAS ANTIGUA) y ' +
                   'restaurar a mano.'
        };
    }

    if (!estado.respaldo && !estado.iniciadaEn) {
        return {
            ok: false,
            error: 'No hay registro de un cableado aplicado (DocumentProperties vacio). Si el respaldo ' +
                   'existe, buscar las hojas ocultas "' + CP_RESPALDO_PREFIJO + '*" y restaurar a mano. ' +
                   'No se toco nada.'
        };
    }
    progreso.respaldo = estado.respaldo;

    var registradas = _celdasRegistradasCP(ss, estado, props);
    if (registradas.length === 0) {
        return {
            ok: false,
            error: 'El registro existe pero no lista una sola celda restaurable: ni la hoja "' +
                   estado.respaldo + '" ni DocumentProperties tienen contenido. NO se escribe nada.'
        };
    }

    // --- VALIDACION DEL RESPALDO ANTES DE ESCRIBIR UNA SOLA CELDA ---
    // decision Franco 2026-08-13: se valida que cada registro sea COHERENTE (tipo conocido,
    // numero parseable, hoja existente) antes de escribir la primera celda. Restaurar a medias
    // -- tres celdas devueltas y tres no -- deja la planilla en un estado que no es ni el
    // anterior ni el posterior, y que nadie sabe leer.
    var problemas = [];
    var tiposValidos = { formula: 1, numero: 1, texto: 1, vacia: 1, fecha: 1 };
    registradas.forEach(function (r) {
        if (!ss.getSheetByName(r.hoja)) {
            problemas.push(r.hoja + '!' + r.celda + ': la hoja no existe.');
            return;
        }
        if (!r.registro || !tiposValidos[r.registro.tipo]) {
            problemas.push(r.hoja + '!' + r.celda + ': el respaldo no dice de que tipo era el contenido (' +
                           (r.registro ? r.registro.tipo : 'sin registro') + ').');
            return;
        }
        if (r.registro.tipo === 'numero' && isNaN(Number(r.registro.contenido))) {
            problemas.push(r.hoja + '!' + r.celda + ': el respaldo dice numero pero guarda "' +
                           r.registro.contenido + '".');
        }
        if (r.registro.tipo === 'fecha') {
            problemas.push(r.hoja + '!' + r.celda + ': el respaldo guarda una fecha, que no es un estado ' +
                           'previsto de estas celdas. Restaurarla a ciegas puede romper el formato: ' +
                           'resolver a mano.');
        }
    });

    if (problemas.length) {
        var textoFalla = 'REVERSION ABORTADA: el respaldo no paso la validacion y NO SE ESCRIBIO NINGUNA ' +
                         'CELDA. Motivos: ' + problemas.join(' | ') + '. Restaurar desde el historial de ' +
                         'versiones de la planilla o a mano.';
        logError('revertirCableadoPresupuesto: respaldo invalido', new Error(problemas.join(' | ')));
        _alertaCP('Revertir cableado - ABORTADO', textoFalla);
        return { ok: false, error: textoFalla, _avisado: true };
    }

    var ui = _uiCP();
    if (ui) {
        var resp = ui.alert(
            'Revertir cableado del Presupuesto',
            'Se van a restaurar ' + registradas.length + ' celda(s) a su contenido original desde "' +
            estado.respaldo + '":\n' +
            registradas.slice(0, 12).map(function (r) {
                return '  ' + r.hoja + '!' + r.celda + ' -> ' + r.registro.tipo +
                       (r.registro.tipo === 'vacia' ? '' : ' (' + String(r.registro.contenido).substring(0, 40) + ')');
            }).join('\n') +
            (registradas.length > 12 ? '\n  [...] y ' + (registradas.length - 12) + ' mas.' : '') + '\n' +
            (estado.revertidaEn ? '\nAVISO: este cableado ya figura revertido el ' + estado.revertidaEn + '.\n' : '') +
            '\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) return { ok: false, error: 'Cancelado por el usuario. No se escribio nada.' };
    } else if (conducida !== true) {
        return { ok: false, error: 'Sin UI para confirmar. Ejecutar desde el menu tidetrack Dev. No se escribio nada.' };
    }

    var restauradas = 0;
    var avisos = [];
    try {
        progreso.muto = true;
        registradas.forEach(function (r) {
            _escribirCeldaCP(ss.getSheetByName(r.hoja), r.celda, r.registro);
            restauradas++;
        });
        SpreadsheetApp.flush();
    } catch (err) {
        logError('revertirCableadoPresupuesto: fallo la restauracion', err);
        return {
            ok: false,
            error: 'Fallo al restaurar: ' + err.message + '. Se alcanzaron a restaurar ' + restauradas +
                   ' de ' + registradas.length + ' celda(s), pero NO SE PUDO CONFIRMAR el estado final. ' +
                   'El respaldo "' + estado.respaldo + '" sigue intacto, revisar y reintentar.'
        };
    }

    // Verificacion posterior: se relee cada celda restaurada. Sin esta lectura, "restauradas"
    // seria una afirmacion sin evidencia, que es justo lo que este modulo no hace.
    registradas.forEach(function (r) {
        var rango = ss.getSheetByName(r.hoja).getRange(r.celda);
        var ahora = _leerCeldaCP(ss.getSheetByName(r.hoja), r.celda);
        var coincide;
        if (r.registro.tipo === 'formula') {
            coincide = _formulasEquivalentesCP(ahora.contenido, r.registro.contenido);
        } else if (r.registro.tipo === 'vacia') {
            coincide = ahora.tipo === 'vacia';
        } else if (r.registro.tipo === 'numero') {
            coincide = ahora.tipo === 'numero' && Number(ahora.contenido) === Number(r.registro.contenido);
        } else {
            coincide = String(ahora.contenido) === String(r.registro.contenido);
        }
        if (!coincide) {
            avisos.push('NO SE PUDO CONFIRMAR ' + r.hoja + '!' + r.celda + ': se escribio el original pero al ' +
                        'releerla dice ' + ahora.tipo + ' "' + String(ahora.contenido).substring(0, 60) +
                        '". El respaldo sigue intacto; revisar en pantalla. (' + rango.getA1Notation() + ')');
        }
    });

    _guardarEstadoCP({
        revertidaEn: new Date().toISOString(),
        pasos: { escritura: avisos.length ? 'revertida sin confirmar' : 'revertida (' + restauradas + ')' }
    });

    var texto = 'CABLEADO DEL PRESUPUESTO v' + CP_VERSION + ' REVERTIDO\n\n  ' +
        restauradas + ' celda(s) restauradas a su contenido original desde "' + estado.respaldo + '".\n' +
        registradas.map(function (r) {
            return '  ' + r.hoja + '!' + r.celda + ': ' + r.registro.tipo;
        }).join('\n') +
        (avisos.length ? '\n\nVERIFICACION POSTERIOR:\n  - ' + avisos.join('\n  - ') : '') +
        '\n\nEl respaldo NO se borra: hacerlo es una decision manual.';
    Logger.log(texto);
    _alertaCP('Cableado del Presupuesto revertido', texto);

    if (avisos.length) {
        return {
            ok: false,
            error: 'NO SE PUDO CONFIRMAR ' + avisos.length + ' verificacion(es) posterior(es) de la reversion.',
            detalle: texto,
            _avisado: true
        };
    }
    return { ok: true, detalle: texto };
}

/**
 * Devuelve las celdas que el cableado efectivamente modifico, con su contenido original.
 *
 * La lista sale de la hoja de respaldo (registro auditable que sobrevive a un borrado de
 * propiedades); si esa hoja no esta, se cae a DocumentProperties recorriendo las celdas
 * candidatas. El VALOR gana siempre desde DocumentProperties, que es el registro primario.
 *
 * @returns {Array<{hoja: string, celda: string, registro: {tipo: string, contenido: string}}>}
 */
function _celdasRegistradasCP(ss, estado, props) {
    var salida = [];
    var hojaResp = estado.respaldo ? ss.getSheetByName(estado.respaldo) : null;

    function desdeProps(hoja, celda, respaldoFila) {
        var crudo = props.getProperty(_claveOriginalCP(hoja, celda));
        if (crudo) {
            try {
                var obj = JSON.parse(crudo);
                if (obj && typeof obj === 'object' && obj.tipo) return obj;
            } catch (e) {
                logError('_celdasRegistradasCP: registro ilegible para ' + hoja + '!' + celda, e);
            }
        }
        return respaldoFila;
    }

    if (hojaResp) {
        var ultima = hojaResp.getLastRow();
        if (ultima >= 2) {
            var filas = hojaResp.getRange(2, 1, ultima - 1, 4).getValues();
            // Una misma celda puede figurar mas de una vez: cada reintento apendea sus
            // pendientes a la misma hoja. Gana la PRIMERA aparicion, que es la mas vieja y por
            // lo tanto la anterior a cualquier escritura. Sin dedupe, "N celdas restauradas"
            // contaria escrituras en vez de celdas: un numero que no significa lo que dice.
            var vistas = Object.create(null);
            filas.forEach(function (f) {
                if (!f[0] || !f[1]) return;
                var hoja = String(f[0]);
                var celda = String(f[1]);
                var clave = hoja + '!' + celda;
                if (vistas[clave]) return;
                vistas[clave] = true;
                salida.push({
                    hoja: hoja, celda: celda,
                    registro: desdeProps(hoja, celda, { tipo: String(f[2]), contenido: String(f[3]) })
                });
            });
        }
        return salida;
    }

    // Sin hoja de respaldo: solo se restauran las celdas de las que hay registro en propiedades.
    // Las que no tienen registro no fueron modificadas por el cableado y no se tocan.
    var nombres = _nombresCP();
    var candidatas = [];
    CP_TABLERO_MONTOS.forEach(function (m) { candidatas.push({ hoja: nombres.tablero, celda: m.celda }); });
    CP_INICIO.filas.forEach(function (f) {
        candidatas.push({ hoja: nombres.inicio, celda: f.celdaPorcentaje });
        candidatas.push({ hoja: nombres.inicio, celda: f.celdaDisponibilidad });
    });
    CP_CELDAS_INGRESOS.forEach(function (c) { candidatas.push({ hoja: nombres[c.hojaClave], celda: c.celda }); });

    candidatas.forEach(function (c) {
        var reg = desdeProps(c.hoja, c.celda, null);
        if (!reg) return;
        salida.push({ hoja: c.hoja, celda: c.celda, registro: reg });
    });
    return salida;
}
