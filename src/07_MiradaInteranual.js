/**
 * 07_MiradaInteranual.js
 * Inicializa y diagnostica las formulas del modulo Mirada Interanual (G10:R14).
 * Invocable desde el menu Tidetrack -> [Dev].
 *
 * [CONCEPTO DE NEGOCIO]
 * Vista interanual del habito financiero: para cada uno de los doce meses de la
 * ventana (mes de referencia -4 .. +7) suma Ingresos, Gastos Fijos y Gastos
 * Variables del ledger, convertidos a la moneda que elige el usuario, y calcula
 * el Resultado. Es la unica vista de la planilla cuyas formulas las escribe el
 * codigo, no el usuario: por eso vive aca y no en una hoja de calculo a mano.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * La conversion respeta el patron unico de toda la planilla:
 * monto * tc_de_su_moneda / tc_de_la_moneda_elegida, con 1 para ARS. Los cuatro
 * TC del ledger estan congelados al momento de la carga (ARS por unidad de la
 * moneda), de modo que la vista es historicamente fiel: no se recotiza el pasado.
 *
 * CONTRATO DE ESCRITURA (v0.9.5):
 * 1. No se toca una sola celda antes de verificar las precondiciones de la hoja.
 * 2. Se respalda y se verifica el respaldo ANTES de mutar; si la escritura no llega
 *    a completarse, se restaura lo previo y se verifica la restauracion.
 * 3. Solo se declara exito si la planilla devolvio valores sanos. Un "#REF!", un
 *    "#N/A" o un "Loading..." se reportan tal cual: nunca como "inicializada".
 *
 * @see docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md (seccion 4.3 Mirada Interanual)
 * @see 00_Config.js (RANGES.REGISTROS: unica fuente de columnas y fila de datos)
 *
 * @version 0.5.0
 * @since 0.8.2
 * @lastModified 2026-08-13
 */

// ============================================
// CONSTANTES DE LA VISTA
// ============================================

// decision Franco 2026-08-13: el layout de la hoja "Mirada Interanual" (que fila y que
// columna ocupa cada concepto) se declara aca y no en RANGES porque RANGES modela tablas
// de datos, no vistas de presentacion. Los rangos de la hoja "Registros" -- la unica
// fuente de datos que toca este modulo -- SI salen de RANGES.REGISTROS (regla SSOT).
const MIRADA_MESES = 'ENERO,FEBRERO,MARZO,ABRIL,MAYO,JUNIO,JULIO,AGOSTO,SEPTIEMBRE,OCTUBRE,NOVIEMBRE,DICIEMBRE';
const MIRADA_COL_REFERENCIA = 'K';   // columna del mes de referencia (offset 0); G = mes-4, R = mes+7
const MIRADA_COLS_VISTA = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
const MIRADA_FILA_INGRESOS = 10;
const MIRADA_FILA_GASTOS_FIJOS = 11;
const MIRADA_FILA_GASTOS_VARIABLES = 12;
const MIRADA_FILA_RESULTADO = 14;

// ============================================
// GEOMETRIA ESPERADA DE LA HOJA (PRECONDICIONES)
// ============================================

// GEOMETRIA VERIFICADA EN VIVO EL 2026-08-13 (hoja gid 199868006, 1002 filas x 27 columnas).
// Confirmado por lectura directa de la planilla: C10 = "Ingresos", C11 = "Gastos Fijos",
// C12 = "Gastos Variables", selectores E4 = mes, F4 = anio, R4 = moneda. Fila 9 = indices de
// mes 1..12 (el modulo no la lee: deriva el mes por aritmetica de columna contra $K$10),
// fila 13 vacia, C14 = "Resultados". La hoja tiene ademas un selector N4 = Proyecto que este
// modulo NO usa. Ver docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md, seccion "Geometria de
// Mirada Interanual".
//
// decision Franco 2026-08-13: aun con la geometria confirmada, todo lo que el preflight exige
// se declara en esta tabla, junta y con nombre, y no como literales sueltos adentro de las
// funciones. La confirmacion es de HOY y la hoja la edita una persona: si manana se corre una
// fila o se renombra un rotulo, ajustarlo es editar esta tabla y nada mas -- ninguna otra
// linea del modulo repite un rotulo, una celda de selector ni un valor de tipo_cuenta.
//
// "rotulo" es lo que tiene que decir la celda de la columna C de esa fila; "tipoBd" es el
// valor de la columna tipo_cuenta del ledger que le corresponde (los tres que escriben
// 06_RegistrosService.js y 99_MigrationLogic.js: Ingreso / Gasto Fijo / Gasto Variable).
const MIRADA_COL_ROTULOS = 'C';
const MIRADA_ROTULOS_ESPERADOS = [
    { fila: MIRADA_FILA_INGRESOS, rotulo: 'Ingresos', tipoBd: 'Ingreso' },
    { fila: MIRADA_FILA_GASTOS_FIJOS, rotulo: 'Gastos Fijos', tipoBd: 'Gasto Fijo' },
    { fila: MIRADA_FILA_GASTOS_VARIABLES, rotulo: 'Gastos Variables', tipoBd: 'Gasto Variable' }
];
const MIRADA_CELDA_SEL_MES = 'E4';      // ENERO..DICIEMBRE (mayusculas)
const MIRADA_CELDA_SEL_ANIO = 'F4';     // numero de 4 digitos
const MIRADA_CELDA_SEL_MONEDA = 'R4';   // una de MONEDAS_DISPONIBLES
const MIRADA_ANIO_MIN = 2000;
const MIRADA_ANIO_MAX = 2100;
const MIRADA_FORMATO_NUMERO = '#,##0.00';

// Estados transitorios de una celda: Sheets todavia esta calculando. NO son un resultado.
const MIRADA_DISPLAY_TRANSITORIOS = ['Loading...', 'Loading…', 'Cargando...', 'Cargando…'];

// ============================================
// HELPERS DE REFERENCIA A1
// ============================================

/**
 * Convierte letras de columna en su numero (A=1, R=18). Sirve para comparar contra
 * getMaxColumns() antes de pedir un rango que no existe.
 * @param {string} letras
 * @returns {number}
 */
function _numeroColumnaMirada(letras) {
    const s = String(letras).toUpperCase();
    if (!/^[A-Z]+$/.test(s)) {
        throw new Error('_numeroColumnaMirada: columna invalida "' + letras + '".');
    }
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        n = n * 26 + (s.charCodeAt(i) - 64);
    }
    return n;
}

/**
 * Convierte 'E4' en '$E$4' (referencia absoluta para intercalar en una formula).
 * @param {string} a1
 * @returns {string}
 */
function _refAbsolutaMirada(a1) {
    const m = /^([A-Za-z]+)(\d+)$/.exec(String(a1).trim());
    if (!m) {
        throw new Error('_refAbsolutaMirada: referencia invalida "' + a1 + '".');
    }
    return '$' + m[1].toUpperCase() + '$' + m[2];
}

/** Rango A1 del bloque de las tres filas de conceptos (hoy G10:R12). */
function _bloqueConceptosMirada() {
    return MIRADA_COLS_VISTA[0] + MIRADA_FILA_INGRESOS + ':' +
        MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1] + MIRADA_FILA_GASTOS_VARIABLES;
}

/** Rango A1 de la fila de Resultado (hoy G14:R14). */
function _filaResultadoMirada() {
    return MIRADA_COLS_VISTA[0] + MIRADA_FILA_RESULTADO + ':' +
        MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1] + MIRADA_FILA_RESULTADO;
}

// ============================================
// REFERENCIAS A "REGISTROS" (DERIVADAS DE CONFIG)
// ============================================

/**
 * Devuelve la referencia A1 absoluta y ABIERTA de una columna del ledger.
 *
 * Ejemplo con el layout de produccion 2026-08: _refColumnaRegistrosMirada('fecha') ->
 * 'Registros'!$H$6:$H
 *
 * decision Franco 2026-08-13: el rango se deja ABIERTO ($H$6:$H) en vez de cerrarlo en
 * una fila fija. El codigo v0.8.x cerraba en la fila 5000 -- un numero inventado que hoy
 * excede el grid real de la hoja (4848 filas) y que ademas quedaba corto apenas el ledger
 * crecia, sin que nadie se enterara. El rango abierto no puede exceder el grid por
 * definicion y se adapta solo a cada carga nueva, que es exactamente lo que hace falta en
 * una vista que se escribe una vez y se consulta durante meses.
 *
 * @param {string} clave clave de RANGES.REGISTROS.columns (fecha, monto, tipo_cuenta, ...)
 * @returns {string} referencia A1 lista para intercalar en una formula
 */
function _refColumnaRegistrosMirada(clave) {
    const cfg = RANGES.REGISTROS;
    const col = cfg.columns[clave];
    if (!col) {
        throw new Error('_refColumnaRegistrosMirada: RANGES.REGISTROS.columns no declara "' + clave + '".');
    }
    // Sin dataRow no hay forma de saber donde arrancan los datos: fallar fuerte es mejor
    // que barrer el encabezado adentro del SUMPRODUCT y devolver un numero mentiroso.
    const fila = cfg.dataRow;
    if (!fila) {
        throw new Error('_refColumnaRegistrosMirada: RANGES.REGISTROS.dataRow no definido en 00_Config.js.');
    }
    // Comillas simples siempre: el nombre de hoja puede resolverse por alias y traer espacios.
    const hoja = "'" + String(cfg.sheet).replace(/'/g, "''") + "'";
    return hoja + '!$' + col + '$' + fila + ':$' + col;
}

/** Claves de RANGES.REGISTROS.columns que este modulo lee. */
const MIRADA_COLUMNAS_LEDGER = ['fecha', 'monto', 'tipo_cuenta', 'moneda', 'tc_usd', 'tc_aud', 'tc_eur'];

// ============================================
// CONSTRUCCION DE LA FORMULA
// ============================================

/**
 * Construye el string de la formula LET/SUMPRODUCT de una celda de G10:R12.
 *
 * TRAMPA DE LOCALE (documentada desde v0.8.2, NO resuelta):
 * la planilla esta en espanol (es_AR): separador de argumentos ";" y separador decimal ",".
 * El modulo v0.8.x asumia que setFormula() traduce de en-US al locale y escribia todo con
 * comas; las 48 celdas de G10:R14 estan hoy en "#ERROR! (Formula parse error.)" y esa
 * suposicion es UNA de las causas candidatas -- la otra, igual de viva, es que las formulas
 * v0.8.x apuntaban a siete columnas que la migracion de agosto ya no tiene
 * (docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md:63). Este modulo NO decide cual de las dos
 * era: el mapeo de columnas ahora sale de RANGES y el separador es un PARAMETRO, y quien
 * escribe verifica el resultado en la celda (ver _escribirFormulaMiradaVerificada). Si la
 * causa era el mapeo, el fallback de separador simplemente no llega a usarse. Los arrays
 * literales {...} siguen prohibidos por el mismo motivo: se usa SPLIT de un string.
 *
 * Las comas que quedan DENTRO de comillas (la lista de meses y el delimitador ",") son
 * datos, no separadores: no se tocan nunca.
 *
 * @param {string} c10Expr    Referencia/literal del label de tipo (ej: '$C10' o '"Ingresos"').
 * @param {string} offsetExpr Expresion del offset mensual (ej: 'COLUMN()-COLUMN($K$10)' o '0').
 * @param {string} selPrefix  Prefijo de hoja para los selectores (ej: '' o "'Mirada Interanual'!").
 * @param {string} [sep]      Separador de argumentos: ',' (en-US, default) o ';' (locale es).
 * @returns {string} Formula completa lista para setFormula().
 */
function construirFormulaMirada(c10Expr, offsetExpr, selPrefix, sep) {
    const s = sep || ',';
    const E = selPrefix + _refAbsolutaMirada(MIRADA_CELDA_SEL_MES);      // selector de mes (ENERO..DICIEMBRE)
    const F = selPrefix + _refAbsolutaMirada(MIRADA_CELDA_SEL_ANIO);     // selector de anio
    const R = selPrefix + _refAbsolutaMirada(MIRADA_CELDA_SEL_MONEDA);   // moneda de la vista

    // Layout 2026-08 de Registros: fecha=H, monto=B, tipo_cuenta=E, moneda=G,
    // tc_usd=K, tc_aud=L, tc_eur=M. Ninguna letra esta escrita aca: sale toda de RANGES.
    const fechas = _refColumnaRegistrosMirada('fecha');
    const montos = _refColumnaRegistrosMirada('monto');
    const tipos = _refColumnaRegistrosMirada('tipo_cuenta');
    const monTx = _refColumnaRegistrosMirada('moneda');
    const tcUsd = _refColumnaRegistrosMirada('tc_usd');
    const tcAud = _refColumnaRegistrosMirada('tc_aud');
    const tcEur = _refColumnaRegistrosMirada('tc_eur');

    // decision Franco 2026-08-13: tipo_bd CIERRA con NA(), no con un "Gasto Variable" por
    // descarte. El else abierto de v0.8.x clasificaba como Gasto Variable cualquier rotulo
    // inesperado (celda vacia, un espacio de mas, la vista corrida una fila) y devolvia un
    // numero bien formateado y equivocado, sin ninguna marca. Un numero mentiroso es peor
    // que un #N/A: con NA() el error se ve en la celda y se propaga a la fila 14, que es
    // exactamente lo que tiene que pasar cuando la vista dejo de estar donde creemos.
    // La cadena se arma desde MIRADA_ROTULOS_ESPERADOS para que el preflight y la formula
    // no puedan discrepar: son la misma tabla.
    let tipoBd = 'NA()';
    for (let i = MIRADA_ROTULOS_ESPERADOS.length - 1; i >= 0; i--) {
        const r = MIRADA_ROTULOS_ESPERADOS[i];
        tipoBd = 'IF(' + c10Expr + '="' + r.rotulo + '"' + s + '"' + r.tipoBd + '"' + s + tipoBd + ')';
    }

    // decision Franco 2026-08-13: ARS entra como literal 1 y no se lee su columna
    // (RANGES.REGISTROS.columns.tc_ars, hoy J = "Valor ARS"). Es el mismo criterio del
    // codigo v0.8.x: ese TC esta congelado en 1 en las 2903 filas del ledger, es la
    // moneda base de la planilla, y leerlo obligaria a 36 celdas a barrer una columna
    // entera para multiplicar por uno. La semantica de conversion queda intacta.
    const pares = [
        'mes_num', 'MATCH(' + E + s + 'SPLIT("' + MIRADA_MESES + '"' + s + '",")' + s + '0)',
        // "off_meses" y no "offset": OFFSET es una funcion de Sheets y un nombre de LET
        // que colisiona con una funcion es una de las causas candidatas del parse error
        // historico (ver diagnosticarMiradaInteranual, micro-test de colision).
        'off_meses', offsetExpr,
        'f_obj', 'EDATE(DATE(' + F + s + 'mes_num' + s + '1)' + s + 'off_meses)',
        'm_obj', 'MONTH(f_obj)',
        'a_obj', 'YEAR(f_obj)',
        'tipo_bd', tipoBd,
        'fechas', fechas,
        'montos', montos,
        'tipos', tipos,
        'mon_tx', monTx,
        'tc_u', tcUsd,
        'tc_a', tcAud,
        'tc_e', tcEur,
        // tc_sel: TC de la moneda ELEGIDA para mirar la vista. tc_tx: TC de la moneda de
        // cada transaccion. conv = tc_tx/tc_sel -> monto * tc_tx / tc_sel (patron unico).
        //
        // decision Franco 2026-08-13: tc_sel tambien cierra con NA(). R4 es UNA celda que el
        // usuario cambia a mano: si dice cualquier cosa que no sea una moneda conocida, el
        // else abierto de v0.8.x la cotizaba en EUR en silencio. Con NA() la vista se apaga
        // y se ve por que.
        'tc_sel', 'IF(' + R + '="ARS"' + s + '1' + s + 'IF(' + R + '="USD"' + s + 'tc_u' + s +
            'IF(' + R + '="AUD"' + s + 'tc_a' + s + 'IF(' + R + '="EUR"' + s + 'tc_e' + s + 'NA()))))',
        // tc_tx NO puede cerrar con NA(): mon_tx es una COLUMNA ABIERTA y sus miles de celdas
        // vacias caerian en la rama de error, y un solo #N/A en el array apaga el SUMPRODUCT
        // entero. Las filas vacias no suman igual (el factor (fechas<>"") y montos=0 las
        // anulan). Queda como riesgo residual conocido y acotado: una fila del ledger con
        // fecha, monto y una moneda que no sea ARS/USD/AUD se cotiza con el TC del EUR. Eso
        // es calidad de dato del ledger y se cierra en la validacion de carga, no aca.
        'tc_tx', 'IF(mon_tx="ARS"' + s + '1' + s + 'IF(mon_tx="USD"' + s + 'tc_u' + s +
            'IF(mon_tx="AUD"' + s + 'tc_a' + s + 'tc_e)))',
        'conv', 'IF(tc_sel=0' + s + '0' + s + 'tc_tx/tc_sel)'
    ];

    const expresion = 'SUMPRODUCT((tipos=tipo_bd)*(MONTH(fechas)=m_obj)*(YEAR(fechas)=a_obj)' +
        '*(fechas<>"")*montos*conv)';

    return '=LET(' + pares.join(s) + s + expresion + ')';
}

/**
 * Audita el balance sintactico de una formula: comillas pareadas, parentesis cerrados
 * y ningun cierre anticipado. No valida semantica -- valida que el string este sano.
 *
 * Las comillas alternan abre/cierra; el escape de Sheets ("" adentro de un string) queda
 * cubierto porque cierra y vuelve a abrir. Los parentesis dentro de comillas se ignoran.
 *
 * @param {string} formula
 * @returns {{comillas:number, comillasBalanceadas:boolean, parentesis:number, parentesisBalanceados:boolean, cierreAnticipado:boolean, largo:number, ok:boolean}}
 */
function auditarBalanceFormulaMirada(formula) {
    let comillas = 0;
    let nivel = 0;
    let minimo = 0;
    let dentroDeTexto = false;

    for (let i = 0; i < formula.length; i++) {
        const ch = formula.charAt(i);
        if (ch === '"') {
            comillas++;
            dentroDeTexto = !dentroDeTexto;
            continue;
        }
        if (dentroDeTexto) continue;
        if (ch === '(') {
            nivel++;
        } else if (ch === ')') {
            nivel--;
            if (nivel < minimo) minimo = nivel;
        }
    }

    const comillasBalanceadas = (comillas % 2 === 0);
    const parentesisBalanceados = (nivel === 0);
    const cierreAnticipado = (minimo < 0);

    return {
        comillas: comillas,
        comillasBalanceadas: comillasBalanceadas,
        parentesis: nivel,
        parentesisBalanceados: parentesisBalanceados,
        cierreAnticipado: cierreAnticipado,
        largo: formula.length,
        ok: comillasBalanceadas && parentesisBalanceados && !cierreAnticipado
    };
}

/**
 * Resume la auditoria en una linea legible para la hoja DEBUG.
 * @param {string} formula
 * @returns {string}
 */
function _resumenBalanceMirada(formula) {
    const a = auditarBalanceFormulaMirada(formula);
    return (a.ok ? 'BALANCE OK' : 'BALANCE ROTO') +
        ' | comillas=' + a.comillas + (a.comillasBalanceadas ? ' (pares)' : ' (IMPARES)') +
        ' | parentesis netos=' + a.parentesis +
        (a.cierreAnticipado ? ' | CIERRE ANTICIPADO' : '') +
        ' | largo=' + a.largo;
}

// ============================================
// LECTURA DEL RESULTADO DE UNA CELDA
// ============================================

/**
 * Recorta un texto para mostrarlo en un toast, un alert o el titulo de un log. El valor
 * completo siempre queda en el contexto del log: lo que se recorta es la vista, no la prueba.
 * @param {*} texto
 * @param {number} [largo]
 * @returns {string}
 */
function _recortarMirada(texto, largo) {
    const t = String(texto === null || texto === undefined ? '' : texto);
    const n = largo || 80;
    return t.length > n ? t.substring(0, n - 3) + '...' : t;
}

/**
 * Clasifica lo que muestra una celda despues de escribirle una formula.
 *
 * decision Franco 2026-08-13: los dos criterios que v0.8.x mezclaba en un solo booleano
 * quedan separados. "Reintentar con otro separador" y "declarar exito" NO son la misma
 * pregunta: '#ERROR!' es literalmente el parse error de Sheets y ahi el separador SI puede
 * ser la causa; '#REF!' o '#N/A' significan que la formula parseo y fallo por otra razon,
 * asi que reintentar no arregla nada -- pero tampoco son un exito. La prueba vieja
 * (display.indexOf('#ERROR!') !== 0) daba por bueno '#REF!', '#VALUE!' y hasta un
 * 'Loading...' a medio calcular, y replicaba eso a 36 celdas cantando "inicializada".
 *
 * @param {*} display valor mostrado por la celda
 * @returns {{estado:string, display:string}} estado: OK | PARSE_ERROR | ERROR_VALOR | TRANSITORIO | TEXTO | VACIO
 */
function _clasificarDisplayMirada(display) {
    const d = String(display === null || display === undefined ? '' : display).trim();
    if (d.indexOf('#ERROR!') === 0) return { estado: 'PARSE_ERROR', display: d };
    if (MIRADA_DISPLAY_TRANSITORIOS.indexOf(d) > -1) return { estado: 'TRANSITORIO', display: d };
    if (d.charAt(0) === '#') return { estado: 'ERROR_VALOR', display: d };
    // Celda en "Texto sin formato" (@): Sheets guarda la formula como TEXTO y la muestra tal
    // cual, sin evaluarla nunca. No hay error, no hay "#": un guard ingenuo la da por buena.
    // El modulo v0.8.x sabia que G10 venia en texto (lo dice su propio comentario) y la
    // prueba de aceptacion que tenia habria cantado exito con las 48 celdas mostrando texto.
    if (d.charAt(0) === '=') return { estado: 'TEXTO', display: d };
    // Una celda con formula SUMPRODUCT siempre muestra algo (0 como minimo). Vacio significa
    // que la escritura no llego o que la celda todavia no resolvio: no es un exito.
    if (d === '') return { estado: 'VACIO', display: '' };
    return { estado: 'OK', display: d };
}

// ============================================
// PRECONDICIONES (PREFLIGHT)
// ============================================

/**
 * Compara un rotulo leido contra el esperado con la MISMA semantica que el "=" de Sheets
 * para texto: insensible a mayusculas, SENSIBLE a espacios.
 * Por eso no se hace trim: 'Ingresos ' con un espacio al final hace FALSO la comparacion
 * de la formula, asi que tiene que abortar el preflight, no pasarlo.
 * @param {*} leido
 * @param {string} esperado
 * @returns {boolean}
 */
function _coincideRotuloMirada(leido, esperado) {
    return String(leido === null || leido === undefined ? '' : leido).toUpperCase() ===
        String(esperado).toUpperCase();
}

/**
 * Verifica que la hoja tenga la geometria que estas 48 formulas dan por sentada, ANTES de
 * escribir una sola celda.
 *
 * decision Franco 2026-08-13: el modulo v0.8.x escribia G10:R14 hardcodeado sin leer nada
 * de la hoja. Es la unica hoja de la entrega cuya geometria nadie verifico en vivo y la
 * migracion de agosto ya movio dos hojas enteras: escribir a ciegas ahi es exactamente la
 * apuesta que no se puede hacer. Lo que se exige esta declarado arriba, en
 * MIRADA_ROTULOS_ESPERADOS y MIRADA_CELDA_SEL_*, para que corregirlo con la verificacion
 * en vivo sea editar constantes y nada mas.
 *
 * @param {Spreadsheet} ss
 * @param {Sheet} sheet hoja "Mirada Interanual"
 * @returns {{ok:boolean, problemas:string[], observado:Object}}
 */
function verificarPrecondicionesMirada(ss, sheet) {
    const problemas = [];
    const observado = {};

    // --- 1. Grid de la vista: si la hoja no llega hasta R14, getRange lanzaria a mitad ---
    const colPrimera = _numeroColumnaMirada(MIRADA_COLS_VISTA[0]);
    const colUltima = _numeroColumnaMirada(MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1]);
    const colRotulos = _numeroColumnaMirada(MIRADA_COL_ROTULOS);
    const colSelMoneda = _numeroColumnaMirada(/^([A-Za-z]+)/.exec(MIRADA_CELDA_SEL_MONEDA)[1]);
    const colNecesaria = Math.max(colPrimera, colUltima, colRotulos, colSelMoneda);
    const maxFilas = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    observado.grid = maxFilas + ' filas x ' + maxCols + ' columnas';

    if (maxFilas < MIRADA_FILA_RESULTADO) {
        problemas.push('la hoja tiene ' + maxFilas + ' filas y la vista escribe hasta la fila ' +
            MIRADA_FILA_RESULTADO);
    }
    if (maxCols < colNecesaria) {
        problemas.push('la hoja tiene ' + maxCols + ' columnas y la vista necesita hasta la columna ' +
            colNecesaria);
    }
    // Sin grid no se sigue: cualquier lectura posterior seria un rango inexistente.
    if (problemas.length) {
        return { ok: false, problemas: problemas, observado: observado };
    }

    // --- 2. Rotulos de fila (los que alimentan tipo_bd) ---
    // Celda por celda a proposito: las filas de MIRADA_ROTULOS_ESPERADOS no tienen por que
    // ser contiguas si manana la vista se reordena.
    MIRADA_ROTULOS_ESPERADOS.forEach(function (esperado) {
        const celda = MIRADA_COL_ROTULOS + esperado.fila;
        const leido = String(sheet.getRange(celda).getDisplayValue());
        observado[celda] = '[' + leido + ']';
        if (!_coincideRotuloMirada(leido, esperado.rotulo)) {
            problemas.push('rotulo ' + celda + ': se esperaba "' + esperado.rotulo +
                '" y hay [' + leido + ']');
        }
    });

    // --- 3. Selectores ---
    const mes = String(sheet.getRange(MIRADA_CELDA_SEL_MES).getDisplayValue());
    observado[MIRADA_CELDA_SEL_MES] = '[' + mes + ']';
    if (MIRADA_MESES.split(',').indexOf(mes.toUpperCase()) < 0) {
        problemas.push('selector de mes ' + MIRADA_CELDA_SEL_MES + ': [' + mes +
            '] no es uno de los doce meses');
    }

    const anioCrudo = sheet.getRange(MIRADA_CELDA_SEL_ANIO).getValue();
    observado[MIRADA_CELDA_SEL_ANIO] = '[' + String(anioCrudo) + ']';
    let anio = null;
    if (typeof anioCrudo === 'number' && isFinite(anioCrudo)) {
        anio = Math.floor(anioCrudo);
    } else if (/^\d{4}$/.test(String(anioCrudo).trim())) {
        anio = parseInt(String(anioCrudo).trim(), 10);
    }
    if (anio === null || anio < MIRADA_ANIO_MIN || anio > MIRADA_ANIO_MAX) {
        problemas.push('selector de anio ' + MIRADA_CELDA_SEL_ANIO + ': [' + String(anioCrudo) +
            '] no es un anio entre ' + MIRADA_ANIO_MIN + ' y ' + MIRADA_ANIO_MAX);
    }

    const moneda = String(sheet.getRange(MIRADA_CELDA_SEL_MONEDA).getDisplayValue());
    observado[MIRADA_CELDA_SEL_MONEDA] = '[' + moneda + ']';
    if (MONEDAS_DISPONIBLES.indexOf(moneda.toUpperCase()) < 0) {
        problemas.push('selector de moneda ' + MIRADA_CELDA_SEL_MONEDA + ': [' + moneda +
            '] no esta en MONEDAS_DISPONIBLES (' + MONEDAS_DISPONIBLES.join(', ') + ')');
    }

    // --- 4. Fuente de datos: la hoja del ledger y sus columnas tienen que existir ---
    // Un #REF! en las 36 celdas nace casi siempre aca. Los NOMBRES de encabezado no se
    // validan a proposito: los declara 00_Config.js (SSOT) y duplicarlos en este modulo
    // crearia una segunda verdad.
    const nombreLedger = RANGES.REGISTROS.sheet;
    const ledger = ss.getSheetByName(nombreLedger);
    observado.ledger = nombreLedger;
    if (!ledger) {
        problemas.push('no existe la hoja de datos "' + nombreLedger +
            '" (RANGES.REGISTROS.sheet): las 36 formulas darian #REF!');
    } else {
        const maxColsLedger = ledger.getMaxColumns();
        const maxFilasLedger = ledger.getMaxRows();
        observado.gridLedger = maxFilasLedger + ' filas x ' + maxColsLedger + ' columnas';
        MIRADA_COLUMNAS_LEDGER.forEach(function (clave) {
            const col = RANGES.REGISTROS.columns[clave];
            if (!col) {
                problemas.push('RANGES.REGISTROS.columns no declara "' + clave + '"');
                return;
            }
            if (_numeroColumnaMirada(col) > maxColsLedger) {
                problemas.push('la hoja "' + nombreLedger + '" no llega a la columna ' + col +
                    ' (' + clave + ')');
            }
        });
        const dataRow = RANGES.REGISTROS.dataRow;
        if (!dataRow) {
            problemas.push('RANGES.REGISTROS.dataRow no definido en 00_Config.js');
        } else if (dataRow > maxFilasLedger) {
            problemas.push('RANGES.REGISTROS.dataRow (' + dataRow + ') excede las ' +
                maxFilasLedger + ' filas de "' + nombreLedger + '"');
        }
    }

    return { ok: problemas.length === 0, problemas: problemas, observado: observado };
}

// ============================================
// RESPALDO Y RESTAURACION
// ============================================

/** @returns {boolean} true si m es una matriz de filas x cols. */
function _dimensionOkMirada(m, filas, cols) {
    if (!m || m.length !== filas) return false;
    for (let f = 0; f < filas; f++) {
        if (!m[f] || m[f].length !== cols) return false;
    }
    return true;
}

/** @returns {boolean} true si las dos matrices de formulas son identicas celda a celda. */
function _matricesFormulasIgualesMirada(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let f = 0; f < a.length; f++) {
        if (a[f].length !== b[f].length) return false;
        for (let c = 0; c < a[f].length; c++) {
            if (String(a[f][c]) !== String(b[f][c])) return false;
        }
    }
    return true;
}

/**
 * Congela el contenido actual de los rangos que se van a mutar y VERIFICA el respaldo antes
 * de devolverlo (dimensiones correctas y dos lecturas consecutivas identicas).
 *
 * decision Franco 2026-08-13 (arnes, cicatriz 4): el respaldo se toma y se verifica ANTES
 * de mutar, nunca despues. Si el respaldo no se puede verificar, no se muta nada: es
 * preferible que el usuario vuelva a intentar a quedarse sin red.
 *
 * @param {Sheet} sheet
 * @param {string[]} a1s rangos a respaldar
 * @returns {{ok:boolean, motivo:string, partes:Array, celdas:number, conFormula:number}}
 */
function _respaldarRangosMirada(sheet, a1s) {
    const partes = [];
    let celdas = 0;
    let conFormula = 0;

    for (let i = 0; i < a1s.length; i++) {
        const a1 = a1s[i];
        const rango = sheet.getRange(a1);
        const filas = rango.getNumRows();
        const cols = rango.getNumColumns();
        const parte = {
            a1: a1,
            filas: filas,
            cols: cols,
            formulas: rango.getFormulas(),
            valores: rango.getValues(),
            formatos: rango.getNumberFormats()
        };

        if (!_dimensionOkMirada(parte.formulas, filas, cols) ||
            !_dimensionOkMirada(parte.valores, filas, cols) ||
            !_dimensionOkMirada(parte.formatos, filas, cols)) {
            return {
                ok: false,
                motivo: 'la lectura de respaldo de ' + a1 + ' no devolvio una matriz ' +
                    filas + 'x' + cols,
                partes: [], celdas: 0, conFormula: 0
            };
        }

        // Verificacion del respaldo: una segunda lectura tiene que dar lo mismo.
        if (!_matricesFormulasIgualesMirada(parte.formulas, rango.getFormulas())) {
            return {
                ok: false,
                motivo: 'el respaldo de ' + a1 + ' no es estable entre dos lecturas consecutivas',
                partes: [], celdas: 0, conFormula: 0
            };
        }

        celdas += filas * cols;
        parte.formulas.forEach(function (fila) {
            fila.forEach(function (f) { if (String(f) !== '') conFormula++; });
        });
        partes.push(parte);
    }

    return { ok: true, motivo: '', partes: partes, celdas: celdas, conFormula: conFormula };
}

/**
 * Devuelve los rangos respaldados a su contenido previo y VERIFICA la restauracion
 * releyendo la hoja. No supone: compara.
 *
 * Una celda que tenia formula se restaura con su formula; una que tenia un valor fijo, con
 * su valor. setValues interpreta como formula todo string que empiece con "=", asi que una
 * sola pasada cubre los dos casos (limitacion conocida: un texto que empezara con "=" y
 * estuviera guardado como texto volveria como formula; en G10:R14 no existe ese caso).
 *
 * @param {Sheet} sheet
 * @param {Object} respaldo resultado de _respaldarRangosMirada
 * @returns {{ok:boolean, divergencias:string[]}}
 */
function _restaurarRespaldoMirada(sheet, respaldo) {
    respaldo.partes.forEach(function (parte) {
        const rango = sheet.getRange(parte.a1);
        const matriz = parte.formulas.map(function (fila, f) {
            return fila.map(function (formula, c) {
                return String(formula) !== '' ? formula : parte.valores[f][c];
            });
        });
        rango.setValues(matriz);
        rango.setNumberFormats(parte.formatos);
    });
    SpreadsheetApp.flush();

    const divergencias = [];
    respaldo.partes.forEach(function (parte) {
        const rango = sheet.getRange(parte.a1);
        const formulas = rango.getFormulas();
        const valores = rango.getValues();
        const primeraCol = _numeroColumnaMirada(/^([A-Za-z]+)/.exec(parte.a1)[1]);
        const primeraFila = parseInt(/^[A-Za-z]+(\d+)/.exec(parte.a1)[1], 10);
        for (let f = 0; f < parte.filas; f++) {
            for (let c = 0; c < parte.cols; c++) {
                const ref = _letraColumnaMirada(primeraCol + c) + (primeraFila + f);
                const espFormula = String(parte.formulas[f][c]);
                const hayFormula = String(formulas[f][c]);
                if (espFormula !== '') {
                    if (espFormula !== hayFormula) {
                        divergencias.push(ref + ': se esperaba la formula previa [' + espFormula +
                            '] y quedo [' + hayFormula + ']');
                    }
                } else if (String(parte.valores[f][c]) !== String(valores[f][c])) {
                    divergencias.push(ref + ': se esperaba el valor previo [' +
                        String(parte.valores[f][c]) + '] y quedo [' + String(valores[f][c]) + ']');
                }
            }
        }
    });

    return { ok: divergencias.length === 0, divergencias: divergencias };
}

/** Inversa de _numeroColumnaMirada (18 -> 'R'). */
function _letraColumnaMirada(numero) {
    let n = numero;
    let s = '';
    while (n > 0) {
        const resto = (n - 1) % 26;
        s = String.fromCharCode(65 + resto) + s;
        n = Math.floor((n - resto - 1) / 26);
    }
    return s;
}

// ============================================
// ESCRITURA VERIFICADA
// ============================================

/**
 * Escribe una formula probando primero la sintaxis en-US (comas) y, si la celda queda en
 * "#ERROR!" (que en Sheets significa exactamente "parse error") o si setFormula lanza,
 * reintenta con el separador del locale espanol (";"). Verifica leyendo la celda, no
 * suponiendo.
 *
 * decision Franco 2026-08-13: se prueba y se mide en vez de elegir a ciegas. Nadie pudo
 * confirmar todavia si setFormula() traduce el separador en esta planilla; este helper hace
 * que la respuesta la de la planilla misma y quede en el log.
 *
 * Reglas, que son DOS y separadas:
 *   - reintentar con el otro separador SOLO ante '#ERROR!' o ante una excepcion de
 *     setFormula (el separador puede ser la causa de un parse error, nunca de un #REF!);
 *   - declarar exito SOLO si el display no empieza con '#' y no es un estado transitorio.
 * Nunca se devuelve ok con un valor de error: se reporta el display exacto.
 *
 * @param {Range} rango celda destino
 * @param {function(string): string} construir recibe el separador y devuelve la formula
 * @returns {{ok:boolean, sep:string|null, display:string, estado:string, intentos:Array}}
 */
function _escribirFormulaMiradaVerificada(rango, construir) {
    const separadores = [',', ';'];
    const intentos = [];

    for (let i = 0; i < separadores.length; i++) {
        const sep = separadores[i];
        const formula = construir(sep);
        let estado;
        let display;

        try {
            rango.setFormula(formula);
            SpreadsheetApp.flush();
            const clas = _clasificarDisplayMirada(rango.getDisplayValue());
            estado = clas.estado;
            display = clas.display;
        } catch (e) {
            // El mismo modulo ya asumia que setFormula puede lanzar (ver el try/catch del
            // diagnostico). Una excepcion es un intento fallido, no el fin del camino: se
            // trata igual que un '#ERROR!' y se pasa al separador siguiente.
            estado = 'EXCEPCION';
            display = 'EXCEPCION setFormula: ' + ((e && e.message) ? e.message : String(e));
        }

        intentos.push({ sep: sep, estado: estado, display: display });

        if (estado === 'OK') {
            logInfo('Mirada Interanual: formula aceptada con separador "' + sep +
                '" (celda: ' + display + ')');
            return { ok: true, sep: sep, display: display, estado: estado, intentos: intentos };
        }

        if (estado === 'PARSE_ERROR' || estado === 'EXCEPCION') {
            logError('Mirada Interanual: rechazo con separador "' + sep + '" (' + estado + ')', {
                display: display,
                balance: _resumenBalanceMirada(formula),
                formula: formula
            });
            continue;
        }

        // ERROR_VALOR / TRANSITORIO / VACIO: la formula parseo. Cambiar el separador no
        // arregla un #REF! ni un #N/A, asi que no se reintenta -- y tampoco se canta exito.
        logError('Mirada Interanual: la formula parseo con separador "' + sep +
            '" pero la celda no devolvio un valor utilizable (' + estado + ': ' +
            _recortarMirada(display) + ')', {
            displayCompleto: display,
            balance: _resumenBalanceMirada(formula),
            formula: formula
        });
        return { ok: false, sep: sep, display: display, estado: estado, intentos: intentos };
    }

    const ultimo = intentos[intentos.length - 1];
    return {
        ok: false,
        sep: null,
        display: ultimo ? ultimo.display : '',
        estado: 'NINGUNA_VARIANTE',
        intentos: intentos
    };
}

/**
 * Relee los rangos escritos y clasifica las 48 celdas. Es la prueba de que la vista quedo
 * sana, no la suposicion de que quedo sana.
 *
 * @param {Sheet} sheet
 * @param {string[]} a1s
 * @returns {{ok:boolean, total:number, sanas:number, porEstado:Object, muestras:string[]}}
 */
function _verificarBloqueMirada(sheet, a1s) {
    const porEstado = {};
    const muestras = [];
    let total = 0;
    let sanas = 0;

    a1s.forEach(function (a1) {
        const rango = sheet.getRange(a1);
        const displays = rango.getDisplayValues();
        const primeraCol = _numeroColumnaMirada(/^([A-Za-z]+)/.exec(a1)[1]);
        const primeraFila = parseInt(/^[A-Za-z]+(\d+)/.exec(a1)[1], 10);
        for (let f = 0; f < displays.length; f++) {
            for (let c = 0; c < displays[f].length; c++) {
                const clas = _clasificarDisplayMirada(displays[f][c]);
                total++;
                porEstado[clas.estado] = (porEstado[clas.estado] || 0) + 1;
                if (clas.estado === 'OK') {
                    sanas++;
                } else if (muestras.length < 6) {
                    // Recortado: un display en estado TEXTO es la formula entera (800+ chars).
                    muestras.push(_letraColumnaMirada(primeraCol + c) + (primeraFila + f) +
                        '=' + (_recortarMirada(clas.display, 40) || '(vacia)'));
                }
            }
        }
    });

    return {
        ok: total > 0 && sanas === total,
        total: total,
        sanas: sanas,
        porEstado: porEstado,
        muestras: muestras
    };
}

/**
 * Verifica que cada fila del bloque replicado interrogue SU PROPIO rotulo: la fila de Gastos
 * Fijos tiene que referenciar $C11 y la de Gastos Variables $C12.
 *
 * decision Franco 2026-08-13: esto se chequea porque ya paso. Las formulas que hay hoy en la
 * planilla (verificacion en vivo del 2026-08-13) tienen las filas 11 y 12 apuntando a $C10:
 * las tres filas calculan Ingresos. Hoy queda tapado por el #ERROR!, pero apenas la formula
 * parsee saldrian tres filas identicas -- tres numeros bien formateados y mentirosos, que es
 * la falla que ningun usuario detecta. La replicacion por copyTo deberia corregirlo sola
 * (fila relativa), pero "deberia" no es una verificacion: se relee y se compara.
 *
 * A diferencia del resto de las verificaciones, si esta falla la vista SI se restaura: un
 * #ERROR! se ve, un numero equivocado no.
 *
 * @param {Sheet} sheet
 * @param {string} a1Bloque
 * @returns {{ok:boolean, problemas:string[], total:number}}
 */
function _verificarReferenciasRotuloMirada(sheet, a1Bloque) {
    const formulas = sheet.getRange(a1Bloque).getFormulas();
    const primeraCol = _numeroColumnaMirada(/^([A-Za-z]+)/.exec(a1Bloque)[1]);
    const primeraFila = parseInt(/^[A-Za-z]+(\d+)/.exec(a1Bloque)[1], 10);

    const refDeFila = {};
    MIRADA_ROTULOS_ESPERADOS.forEach(function (r) {
        refDeFila[r.fila] = '$' + MIRADA_COL_ROTULOS + r.fila;
    });
    const todasLasRefs = MIRADA_ROTULOS_ESPERADOS.map(function (r) {
        return '$' + MIRADA_COL_ROTULOS + r.fila;
    });

    const problemas = [];
    for (let f = 0; f < formulas.length; f++) {
        const fila = primeraFila + f;
        const propia = refDeFila[fila];
        if (!propia) continue;   // fila del bloque sin rotulo declarado: no se opina
        for (let c = 0; c < formulas[f].length; c++) {
            const ref = _letraColumnaMirada(primeraCol + c) + fila;
            const formula = String(formulas[f][c]);
            if (formula === '') {
                problemas.push(ref + ': quedo sin formula');
                continue;
            }
            if (formula.indexOf(propia) < 0) {
                problemas.push(ref + ': no referencia su rotulo ' + propia);
            }
            todasLasRefs.forEach(function (otra) {
                if (otra !== propia && formula.indexOf(otra) > -1) {
                    problemas.push(ref + ': referencia ' + otra + ' en vez de ' + propia);
                }
            });
        }
    }

    return { ok: problemas.length === 0, problemas: problemas.slice(0, 8), total: problemas.length };
}

/**
 * Avisa por los dos canales disponibles. El alert puede no existir (trigger, editor sin UI):
 * por eso va en try/catch y el toast queda siempre.
 * @param {Spreadsheet} ss
 * @param {string} titulo
 * @param {string} mensaje
 * @param {number} segundos
 * @param {boolean} [conAlert] true para los fallos duros
 */
function _avisarMirada(ss, titulo, mensaje, segundos, conAlert) {
    if (conAlert) {
        try {
            SpreadsheetApp.getUi().alert(mensaje);
        } catch (e) {
            logInfo('Mirada Interanual: sin contexto de UI para el alert (' + e.message + ')');
        }
    }
    try {
        ss.toast(mensaje.length > 180 ? mensaje.substring(0, 177) + '...' : mensaje, titulo, segundos);
    } catch (e) {
        logInfo('Mirada Interanual: no se pudo mostrar el toast (' + e.message + ')');
    }
}

// ============================================
// ENTRADAS DEL MENU
// ============================================

/**
 * Escribe las formulas de Mirada Interanual en el rango G10:R14.
 *
 * Layout objetivo:
 *   G10:R10 - Ingresos por mes      G11:R11 - Gastos Fijos      G12:R12 - Gastos Variables
 *   G14:R14 - Resultado (G10 - G11 - G12)
 *
 * Selectores: E4 = mes (uppercase espanol), F4 = anio, R4 = moneda (ARS|USD|AUD|EUR).
 * K = mes de referencia (offset 0). G = mes-4 ... R = mes+7.
 *
 * Fuente: hoja "Registros", layout 2026-08 (headers fila 5, datos desde fila 6, B:M).
 * Las columnas salen de RANGES.REGISTROS: si el layout vuelve a moverse, se cambia
 * 00_Config.js y este modulo sigue sin tocarse.
 *
 * Secuencia (contrato de escritura): precondiciones -> respaldo verificado -> escritura ->
 * verificacion de las 48 celdas. Cualquier corte antes del final restaura lo previo.
 *
 * @since 0.8.2
 */
function inicializarMiradaInteranual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.MIRADA_INTERANUAL);

    if (!sheet) {
        _avisarMirada(ss, 'Sin resolver',
            'Hoja "' + SHEETS.MIRADA_INTERANUAL + '" no encontrada. No se escribio nada.', 8, true);
        logError('inicializarMiradaInteranual: hoja "' + SHEETS.MIRADA_INTERANUAL + '" no encontrada');
        return;
    }

    // ---- 1. PRECONDICIONES: no se toca una celda hasta que la hoja sea la que creemos ----
    const pre = verificarPrecondicionesMirada(ss, sheet);
    if (!pre.ok) {
        _avisarMirada(ss, 'Sin resolver',
            'No se escribio ninguna celda: la hoja no tiene la geometria que estas formulas ' +
            'necesitan.\n\n- ' + pre.problemas.join('\n- '), 10, true);
        logError('inicializarMiradaInteranual: precondiciones no cumplidas, no se escribio nada', {
            problemas: pre.problemas,
            observado: pre.observado
        });
        return;
    }

    const bloque = _bloqueConceptosMirada();
    const filaResultado = _filaResultadoMirada();

    // ---- 2. RESPALDO CONGELADO Y VERIFICADO (antes de mutar, nunca despues) ----
    const respaldo = _respaldarRangosMirada(sheet, [bloque, filaResultado]);
    if (!respaldo.ok) {
        _avisarMirada(ss, 'Sin resolver',
            'No se escribio ninguna celda: no se pudo respaldar el contenido previo (' +
            respaldo.motivo + ').', 10, true);
        logError('inicializarMiradaInteranual: respaldo no verificable, no se escribio nada', {
            motivo: respaldo.motivo
        });
        return;
    }
    logInfo('Mirada Interanual: respaldo verificado de ' + respaldo.celdas + ' celdas (' +
        respaldo.conFormula + ' con formula) antes de escribir.');

    // ---- 3. ESCRITURA ----
    // $C10: columna fija, fila relativa (al copiar a G11/G12 -> $C11/$C12).
    // COLUMN()-COLUMN($K$10): offset en meses respecto al mes de referencia.
    const offsetExpr = 'COLUMN()-COLUMN($' + MIRADA_COL_REFERENCIA + '$' + MIRADA_FILA_INGRESOS + ')';
    const g10 = sheet.getRange(MIRADA_COLS_VISTA[0] + MIRADA_FILA_INGRESOS);
    let intento = null;
    let excepcion = null;

    try {
        // El formato numerico va ANTES de la formula, no despues. Si la celda esta en "Texto
        // sin formato" (@) -- que es como estaba G10 segun el propio comentario de v0.8.x --
        // Sheets guarda la formula como texto y no la evalua nunca: la celda muestra
        // "=LET(..." y ningun separador nuevo cambia eso. El formato previo esta respaldado y
        // la restauracion lo repone si la escritura no llega a completarse.
        sheet.getRange(bloque).setNumberFormat(MIRADA_FORMATO_NUMERO);
        sheet.getRange(filaResultado).setNumberFormat(MIRADA_FORMATO_NUMERO);

        intento = _escribirFormulaMiradaVerificada(g10, function (sep) {
            return construirFormulaMirada('$' + MIRADA_COL_ROTULOS + MIRADA_FILA_INGRESOS,
                offsetExpr, '', sep);
        });

        if (intento.ok) {
            // Replicar al bloque G10:R12 (las referencias relativas se ajustan por celda).
            g10.copyTo(sheet.getRange(bloque));

            // Fila 14: Resultado = Ingresos - Gastos Fijos - Gastos Variables.
            // Es una resta entre celdas de la propia hoja: no tiene separadores de argumentos,
            // asi que no la afecta el locale. Va en UNA sola llamada para no dejar la fila a
            // medio escribir si algo corta en el medio.
            const formulasResultado = [MIRADA_COLS_VISTA.map(function (col) {
                return '=' + col + MIRADA_FILA_INGRESOS +
                    '-' + col + MIRADA_FILA_GASTOS_FIJOS +
                    '-' + col + MIRADA_FILA_GASTOS_VARIABLES;
            })];
            sheet.getRange(filaResultado).setFormulas(formulasResultado);

            // Se reafirma el formato despues de copyTo/setFormulas: copyTo propaga el formato
            // de origen y la fila 14 se escribe recien aca.
            sheet.getRange(bloque).setNumberFormat(MIRADA_FORMATO_NUMERO);
            sheet.getRange(filaResultado).setNumberFormat(MIRADA_FORMATO_NUMERO);
            SpreadsheetApp.flush();
        }
    } catch (e) {
        excepcion = e;
    }

    // ---- 4. LA ESCRITURA NO LLEGO A COMPLETARSE: se restaura lo previo ----
    //
    // decision Franco 2026-08-13: cuando ninguna variante sirve, la hoja NO puede quedar peor
    // que antes. v0.8.x dejaba escrita la ultima variante probada (";") y ademas la replicaba
    // a 36 celdas: elegia como estado final justo la que su propia documentacion dice que
    // nunca puede parsear. Ahora se restaura el contenido previo y se verifica la
    // restauracion; el diagnostico (que no toca la vista) sigue siendo el camino para
    // averiguar la causa.
    if (excepcion || !intento || !intento.ok) {
        const motivo = excepcion
            ? ('EXCEPCION durante la escritura: ' + ((excepcion.message) ? excepcion.message : String(excepcion)))
            : (intento ? (intento.estado + ': ' + _recortarMirada(intento.display))
                : 'la escritura no devolvio resultado');

        let rb = null;
        let errorRb = null;
        try {
            rb = _restaurarRespaldoMirada(sheet, respaldo);
        } catch (e2) {
            errorRb = e2;
        }

        if (rb && rb.ok) {
            _avisarMirada(ss, 'Sin resolver',
                'No se pudo escribir la vista (' + motivo + '). ' +
                'Se restauro el contenido previo de ' + bloque + ' y ' + filaResultado +
                '. Corre el diagnostico.', 10, true);
            logError('inicializarMiradaInteranual: escritura fallida, contenido previo restaurado y verificado', {
                motivo: motivo,
                displayCompleto: intento ? intento.display : '',
                intentos: intento ? intento.intentos : [],
                formulaPreviaG10: respaldo.partes[0].formulas[0][0] || '(vacia)',
                celdasRespaldadas: respaldo.celdas
            });
        } else {
            // Peor caso: fallo la escritura Y fallo la restauracion. Se dice con todas las
            // letras y se deja en el log lo que hacia falta para reponerlo a mano.
            _avisarMirada(ss, 'Revisar a mano',
                'No se pudo escribir la vista (' + motivo + ') y la restauracion del contenido ' +
                'previo NO quedo verificada. Revisa ' + bloque + ' y ' + filaResultado +
                ' y mira los Logs.', 15, true);
            logError('inicializarMiradaInteranual: escritura fallida Y restauracion no verificada', {
                motivo: motivo,
                errorRestauracion: errorRb ? (errorRb.message || String(errorRb)) : '(sin excepcion)',
                divergencias: rb ? rb.divergencias.slice(0, 10) : [],
                respaldoFormulas: respaldo.partes.map(function (p) {
                    return { rango: p.a1, formulas: p.formulas };
                })
            });
        }
        return;
    }

    // ---- 5a. VERIFICACION DE REFERENCIAS: cada fila tiene que mirar SU rotulo ----
    // Si esto falla, la vista mostraria numeros bien formateados y equivocados (tres filas
    // iguales). Un numero que miente es peor que un error visible: se restaura lo previo.
    let refs = null;
    let errorRefs = null;
    try {
        refs = _verificarReferenciasRotuloMirada(sheet, bloque);
    } catch (e4) {
        errorRefs = e4;
    }
    if (!refs || !refs.ok) {
        const detalleRefs = refs
            ? (refs.total + ' observaciones; ' + refs.problemas.join(' | '))
            : ('no se pudo verificar: ' + (errorRefs ? errorRefs.message : 'sin detalle'));
        let rbRef = null;
        try {
            rbRef = _restaurarRespaldoMirada(sheet, respaldo);
        } catch (e5) {
            rbRef = { ok: false, divergencias: ['EXCEPCION al restaurar: ' + e5.message] };
        }
        _avisarMirada(ss, rbRef.ok ? 'Sin resolver' : 'Revisar a mano',
            'La replicacion no dejo cada fila mirando su propio rotulo (' + detalleRefs + '). ' +
            (rbRef.ok
                ? 'Se restauro el contenido previo.'
                : 'Ademas la restauracion NO quedo verificada: revisa ' + bloque + ' a mano.'),
            12, true);
        logError('inicializarMiradaInteranual: referencias de rotulo incorrectas, NO se declara exito', {
            detalle: detalleRefs,
            restauracionVerificada: rbRef.ok,
            divergencias: rbRef.ok ? [] : rbRef.divergencias.slice(0, 10)
        });
        return;
    }

    // ---- 5b. VERIFICACION FINAL: se releen las 48 celdas antes de decir "listo" ----
    //
    // decision Franco 2026-08-13: aca NO se restaura aunque la verificacion encuentre celdas
    // en error. La escritura se completo entera, el bloque quedo homogeneo (una sola
    // generacion de formula, que es lo que el diagnostico necesita mirar) y el estado previo
    // documentado era el mismo error. Lo que si esta prohibido es cantar exito: el toast y el
    // log dicen el valor exacto que devolvio la planilla.
    let post = null;
    try {
        post = _verificarBloqueMirada(sheet, [bloque, filaResultado]);
    } catch (e3) {
        logError('inicializarMiradaInteranual: no se pudo verificar el bloque escrito', {
            error: e3.message
        });
    }

    if (post && post.ok) {
        _avisarMirada(ss, 'Listo',
            'Mirada Interanual inicializada (separador "' + intento.sep + '"): ' +
            post.sanas + '/' + post.total + ' celdas con valor.', 5, false);
        logSuccess('inicializarMiradaInteranual: ' + bloque + ' y ' + filaResultado +
            ' configuradas con separador "' + intento.sep + '". Verificadas ' +
            post.sanas + '/' + post.total + ' celdas sin error.');
        return;
    }

    const detalle = post
        ? (post.sanas + '/' + post.total + ' celdas con valor; ' + post.muestras.join(' | '))
        : 'no se pudo releer el bloque';
    _avisarMirada(ss, 'Sin resolver',
        'Las formulas se escribieron pero la vista NO quedo sana: ' + detalle +
        '. Corre el diagnostico.', 12, true);
    logError('inicializarMiradaInteranual: bloque escrito con celdas en error, NO se declara exito', {
        separador: intento.sep,
        displayG10: _recortarMirada(intento.display, 200),
        porEstado: post ? post.porEstado : null,
        muestras: post ? post.muestras : null
    });
}

/**
 * Diagnostico: escribe en la hoja "DEBUG Mirada" el estado de las formulas y una
 * bateria de micro-tests para aislar exactamente que construccion falla (separadores,
 * colision de nombres de LET, array literal, SPLIT, lectura de Registros, formula completa).
 *
 * Pensado para sacar una captura de esa hoja y compartirla. No toca datos reales.
 *
 * Cada test declara su valor esperado y que significa que falle, para que una sola
 * corrida alcance para decidir cual de las hipotesis del parse error es la buena.
 *
 * @since 0.2.0
 */
function diagnosticarMiradaInteranual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mi = ss.getSheetByName(SHEETS.MIRADA_INTERANUAL);
    let dbg = ss.getSheetByName(SHEETS.DEBUG_MIRADA);
    if (!dbg) dbg = ss.insertSheet(SHEETS.DEBUG_MIRADA);
    dbg.clear();

    dbg.getRange('A1:C1')
        .setValues([['Test', 'Formula / dato', 'Resultado (en vivo)']])
        .setFontWeight('bold');

    let fila = 2;

    // Helper: escribe descripcion + fila de texto (sin evaluar).
    const anotar = (desc, dato) => {
        dbg.getRange(fila, 1).setValue(desc);
        dbg.getRange(fila, 2).setValue(dato);
        fila++;
    };

    // Helper: escribe descripcion + formula como texto + la formula evaluada en vivo.
    const correr = (desc, formula, esperado) => {
        dbg.getRange(fila, 1).setValue(esperado ? desc + '  [esperado: ' + esperado + ']' : desc);
        dbg.getRange(fila, 2).setValue(formula.replace(/^=/, '')); // texto, sin "=" para que no evalue
        try {
            dbg.getRange(fila, 3).setFormula(formula);
        } catch (e) {
            dbg.getRange(fila, 3).setValue('EXCEPCION setFormula: ' + e.message);
        }
        fila++;
    };

    // 0. Estado actual de la celda que falla y de los selectores.
    if (mi) {
        dbg.getRange(fila, 1).setValue('G10 actual: formula almacenada');
        dbg.getRange(fila, 2).setValue(mi.getRange('G' + MIRADA_FILA_INGRESOS).getFormula() || '(vacia)');
        dbg.getRange(fila, 3).setValue(mi.getRange('G' + MIRADA_FILA_INGRESOS).getDisplayValue());
        fila++;
        dbg.getRange(fila, 1).setValue('Selectores ' + MIRADA_CELDA_SEL_MES + ' / ' +
            MIRADA_CELDA_SEL_ANIO + ' / ' + MIRADA_CELDA_SEL_MONEDA);
        dbg.getRange(fila, 2).setValue(
            'mes=' + mi.getRange(MIRADA_CELDA_SEL_MES).getDisplayValue() +
            ' | anio=' + mi.getRange(MIRADA_CELDA_SEL_ANIO).getDisplayValue() +
            ' | moneda=' + mi.getRange(MIRADA_CELDA_SEL_MONEDA).getDisplayValue());
        fila++;

        // 0a. Precondiciones: el mismo preflight que corre la inicializacion, sin escribir nada.
        // Si esto dice PRECONDICIONES NO CUMPLIDAS, inicializarMiradaInteranual() aborta antes
        // de tocar una celda y aca esta el motivo exacto.
        try {
            const pre = verificarPrecondicionesMirada(ss, mi);
            anotar('Precondiciones de la hoja (preflight de la inicializacion)',
                pre.ok ? 'PRECONDICIONES OK' : 'NO CUMPLIDAS: ' + pre.problemas.join(' ;; '));
            anotar('Precondiciones: valores leidos',
                Object.keys(pre.observado).map(function (k) {
                    return k + '=' + pre.observado[k];
                }).join(' | '));
        } catch (e) {
            anotar('Precondiciones de la hoja', 'EXCEPCION en el preflight: ' + e.message);
        }
    } else {
        anotar('AVISO: no se encontro la hoja "' + SHEETS.MIRADA_INTERANUAL + '"', '');
    }

    // 0b. Layout de Registros que esta usando el modulo (sale de RANGES, no de esta hoja).
    anotar('Locale de la planilla', ss.getSpreadsheetLocale());
    anotar('Registros: fila de datos (RANGES.REGISTROS.dataRow)', String(RANGES.REGISTROS.dataRow));
    anotar('Registros: rangos que arma el modulo',
        'fechas=' + _refColumnaRegistrosMirada('fecha') +
        ' | montos=' + _refColumnaRegistrosMirada('monto') +
        ' | tipos=' + _refColumnaRegistrosMirada('tipo_cuenta') +
        ' | moneda=' + _refColumnaRegistrosMirada('moneda'));
    anotar('Registros: TC congelados que arma el modulo',
        'USD=' + _refColumnaRegistrosMirada('tc_usd') +
        ' | AUD=' + _refColumnaRegistrosMirada('tc_aud') +
        ' | EUR=' + _refColumnaRegistrosMirada('tc_eur') +
        ' | ARS=literal 1 (columna ' + RANGES.REGISTROS.columns.tc_ars + ', congelada en 1)');

    // 1. Separador de argumentos: el par decisivo.
    //    En es_AR la coma es separador DECIMAL: si setFormula no traduce, SUM(1,2) da 1,2.
    correr('Separador en-US: SUM con comas', '=SUM(1,2)', '3 si setFormula traduce; 1,2 si no traduce');
    correr('Separador locale es: SUM con punto y coma', '=SUM(1;2)', '3 si el motor espera el locale; #ERROR! si espera en-US');

    // 2. LET disponible.
    correr('LET basico', '=LET(prueba,1,prueba*2)', '2');

    // 3. Colision de nombre de LET con una funcion (hipotesis del parse error historico:
    //    el modulo v0.8.x llamaba "offset" a una de sus variables).
    correr('LET con nombre que colisiona con OFFSET', '=LET(offset,1,offset*2)',
        '2 si el nombre es legal; #ERROR! si colisionar con una funcion rompe');

    // 4. Array literal {} -> la trampa de locale vieja (deberia dar #ERROR!).
    correr('Array literal {} (lo viejo, roto)', '=MATCH("MAYO",{"ENERO","MAYO"},0)', '#ERROR! esperado');

    // 5. SPLIT -> el reemplazo robusto (deberia dar 5).
    correr('SPLIT (lo nuevo): MATCH sobre SPLIT', '=MATCH("MAYO",SPLIT("ENERO,FEBRERO,MARZO,ABRIL,MAYO",","),0)', '5');

    // 6. Lectura de Registros con el layout NUEVO (columna tipo_cuenta, desde dataRow).
    correr('Leer Registros: contar "Ingreso" en tipo_cuenta',
        '=SUMPRODUCT((' + _refColumnaRegistrosMirada('tipo_cuenta') + '="Ingreso")*1)', 'un numero > 0');

    // 7. Formula COMPLETA, las dos variantes de separador, con su auditoria de balance.
    const selPrefix = "'" + SHEETS.MIRADA_INTERANUAL.replace(/'/g, "''") + "'!";
    [',', ';'].forEach(function (sep) {
        const formula = construirFormulaMirada('"' + MIRADA_ROTULOS_ESPERADOS[0].rotulo + '"', '0', selPrefix, sep);
        anotar('Balance sintactico de la formula completa (separador "' + sep + '")',
            _resumenBalanceMirada(formula));
        correr('Formula COMPLETA (mes ref, ' + MIRADA_ROTULOS_ESPERADOS[0].rotulo +
            ', separador "' + sep + '")', formula, 'un numero (ingresos del mes)');
    });

    SpreadsheetApp.flush();
    dbg.autoResizeColumns(1, 3);
    dbg.setActiveSelection('A1');
    dbg.activate();
    ss.toast('Diagnostico listo en la hoja "' + SHEETS.DEBUG_MIRADA + '".', 'Diagnostico', 6);
    logSuccess('diagnosticarMiradaInteranual: reporte escrito en "' + SHEETS.DEBUG_MIRADA + '".');
}
