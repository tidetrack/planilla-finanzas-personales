/**
 * 07_MiradaInteranual.js
 * Inicializa y diagnostica las formulas del modulo Mirada Interanual: la fila de meses
 * (G7:R7), el bloque de datos (G8:R11) y el grafico de tendencias (C14:R21).
 * Invocable desde el menu Tidetrack -> [Dev].
 *
 * [CONCEPTO DE NEGOCIO]
 * Vista interanual del habito financiero: para cada uno de los doce meses de la
 * ventana (mes de referencia -4 .. +7) suma Ingresos, Gastos Fijos y Gastos
 * Variables del ledger, convertidos a la moneda que elige el usuario, y calcula
 * la Capitalizacion (ingresos menos gastos). Desde v0.6.0 tambien rotula cada
 * columna con el nombre de su mes (fila 7) y dibuja las cuatro series como lineas
 * rectas (C14:R21). Es la unica vista de la planilla cuyas formulas las escribe el
 * codigo, no el usuario: por eso vive aca y no en una hoja de calculo a mano.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * La conversion respeta el patron unico de toda la planilla:
 * monto * tc_de_su_moneda / tc_de_la_moneda_elegida, con 1 para ARS. Los cuatro
 * TC del ledger estan congelados al momento de la carga (ARS por unidad de la
 * moneda), de modo que la vista es historicamente fiel: no se recotiza el pasado.
 *
 * CONTRATO DE ESCRITURA (v0.9.5, vigente para las dos entradas de menu que escriben):
 * 1. No se toca una sola celda antes de verificar las precondiciones de la hoja, POR
 *    ROTULO (el gemelo digital puede mentir; un rotulo leido en vivo no).
 * 2. Se respalda y se verifica el respaldo ANTES de mutar; si la escritura no llega
 *    a completarse, se restaura lo previo y se verifica la restauracion.
 * 3. Solo se declara exito si la planilla devolvio VALORES sanos (se relee el display,
 *    nunca se compara texto de formula contra texto escrito). Un "#REF!", un "#N/A" o
 *    un "Loading..." se reportan tal cual: nunca como "inicializada".
 *
 * ESTADO DE LA HOJA (medido en vivo el 2026-09-07): las 36 formulas de G8:R10 y las 12 de
 * G11:R11 YA funcionan con separador ";" y selectores I2/I3/I4. Sobrevivieron al rediseno
 * Fix (Sheets reajusto las referencias al mover los bloques). Por eso el boton
 * "Reescribir formulas G8:R11" es hoy un no-op seguro: devtools/probar_mirada_meses_grafico.js
 * (T1) prueba que lo que construye este modulo es IDENTICO a lo que la hoja guarda.
 *
 * @see docs/permanente/FUNCIONALIDADES.md (seccion 06 Mirada Interanual)
 * @see docs/permanente/celdas.tsv (gemelo digital: formulas reales de G8:R11)
 * @see 00_Config.js (RANGES.REGISTROS: unica fuente de columnas y fila de datos)
 * @see devtools/probar_mirada_meses_grafico.js (banco sin SpreadsheetApp)
 *
 * @version 0.6.0
 * @since 0.8.2
 * @lastModified 2026-09-07
 */

// ============================================
// CONSTANTES DE LA VISTA
// ============================================

// decision Franco 2026-08-13: el layout de la hoja "Mirada Interanual" (que fila y que
// columna ocupa cada concepto) se declara aca y no en RANGES porque RANGES modela tablas
// de datos, no vistas de presentacion. Los rangos de la hoja "Registros" -- la unica
// fuente de datos que toca este modulo -- SI salen de RANGES.REGISTROS (regla SSOT).
// decision Franco 2026-09-07: ratificada al re-alinear. El diagnostico v0.66.1 evaluo mover
// estas constantes a 00_Config.js y lo descarto: nada mas las consume (cardinalidad 1), son
// geometria de PRESENTACION de una sola hoja generada por script, y 00_Config.js es el
// archivo de mas alto riesgo del repo. Se re-alinean aca, en una sola tabla con nombre.
//
// Una sola verdad para los meses: la usan la formula de datos (MATCH del selector), la
// formula de la fila de meses (INDEX del nombre) y las etiquetas esperadas en JS. Si las
// tres leyeran listas distintas, podrian discrepar sin que nadie lo viera.
const MIRADA_MESES = 'ENERO,FEBRERO,MARZO,ABRIL,MAYO,JUNIO,JULIO,AGOSTO,SEPTIEMBRE,OCTUBRE,NOVIEMBRE,DICIEMBRE';
const MIRADA_COL_REFERENCIA = 'K';   // MEDIDO EN VIVO 2026-09-07: columna del mes de referencia (offset 0); G = mes-4, R = mes+7
const MIRADA_COLS_VISTA = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];   // MEDIDO EN VIVO 2026-09-07
const MIRADA_FILA_MESES = 7;              // MEDIDO EN VIVO 2026-09-07: encabezado de la tabla; K7 tiene =I2 (la simulacion de Franco)
const MIRADA_FILA_INGRESOS = 8;           // MEDIDO EN VIVO 2026-09-07: C8 "Ingresos"
const MIRADA_FILA_GASTOS_FIJOS = 9;       // MEDIDO EN VIVO 2026-09-07: C9 "Gastos Fijos"
const MIRADA_FILA_GASTOS_VARIABLES = 10;  // MEDIDO EN VIVO 2026-09-07: C10 "Gastos Variables"
const MIRADA_FILA_RESULTADO = 11;         // MEDIDO EN VIVO 2026-09-07: C11 "Capitalizacion" = G8-G9-G10

// ============================================
// GEOMETRIA ESPERADA DE LA HOJA (PRECONDICIONES)
// ============================================

// GEOMETRIA MEDIDA EN VIVO EL 2026-09-07 (export de Drive del dia, coincidente con el gemelo
// docs/permanente/celdas.tsv del 2026-08-18): C2:F4 titulo; G2:H2 "Mes de Referencia" con
// selector I2 (mes, texto capitalizado, ej. "Mayo"; MATCH es insensible a mayusculas) e I3
// (anio); G4:H4 "Moneda" con selector I4. K2/L2 "Proyecto"/"Todos" es decorativo: ninguna
// formula lo usa y este modulo no lo toca. Fila 7 = encabezado de la tabla (C7 "Resultados.",
// E7 "Interanual.", K7 =I2); filas 8-11 = Ingresos / Gastos Fijos / Gastos Variables /
// Capitalizacion, con E = SUM(G:R). C13:R13 combinada = banda "Evolucion de Tendencias";
// filas 14 a 21 vacias (zona del grafico). Grid de 883 filas x 20 columnas.
//
// Historia: la medicion anterior (2026-08-13) describia la hoja PRE-rediseno (selectores
// E4/F4/R4, rotulos C10:C12, resultado en la fila 14). El rediseno Fix de Franco (swap v0.11,
// 2026-08-18) movio todo; el modulo quedo desalineado hasta esta re-alineacion (v0.6.0).
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
const MIRADA_COL_ROTULOS = 'C';   // MEDIDO EN VIVO 2026-09-07
const MIRADA_ROTULOS_ESPERADOS = [
    { fila: MIRADA_FILA_INGRESOS, rotulo: 'Ingresos', tipoBd: 'Ingreso' },
    { fila: MIRADA_FILA_GASTOS_FIJOS, rotulo: 'Gastos Fijos', tipoBd: 'Gasto Fijo' },
    { fila: MIRADA_FILA_GASTOS_VARIABLES, rotulo: 'Gastos Variables', tipoBd: 'Gasto Variable' }
];
// La fila de resultado no alimenta tipo_bd (es una resta), pero su rotulo es el nombre de una
// serie del grafico: se verifica en el preflight con el mismo rigor que los otros tres.
const MIRADA_ROTULO_RESULTADO = 'Capitalizaci\u00f3n';   // MEDIDO EN VIVO 2026-09-07 (C11, con acento en la hoja)
const MIRADA_CELDA_SEL_MES = 'I2';      // MEDIDO EN VIVO 2026-09-07: uno de MIRADA_MESES (capitalizado o en mayusculas)
const MIRADA_CELDA_SEL_ANIO = 'I3';     // MEDIDO EN VIVO 2026-09-07: numero de 4 digitos
const MIRADA_CELDA_SEL_MONEDA = 'I4';   // MEDIDO EN VIVO 2026-09-07: una de MONEDAS_DISPONIBLES
const MIRADA_ANIO_MIN = 2000;
const MIRADA_ANIO_MAX = 2100;
const MIRADA_FORMATO_NUMERO = '#,##0.00';   // patron canonico (punto decimal), el locale lo pinta con coma

// decision Franco 2026-09-07: la ventana movil de 12 meses casi siempre cruza dos anios
// calendario (con referencia Agosto 2026 va de Abril 2026 a Marzo 2027). Un "Enero" bajo un
// selector que dice 2026 seria ambiguo, asi que cuando el anio del mes difiere del anio de
// referencia (I3) se agrega el anio en dos digitos ("Enero 27"). Con la constante en false
// la fila muestra solo el nombre. Es una eleccion de Franco: se deja facil de invertir, y la
// formula de la hoja y las etiquetas esperadas en JS la leen las dos de aca.
const MIRADA_MESES_SUFIJO_ANIO = true;

// Zona del grafico de tendencias: la banda de titulo y el rectangulo que ocupa el chart.
const MIRADA_CELDA_TITULO_GRAFICO = 'C13';                           // MEDIDO EN VIVO 2026-09-07: C13:R13 combinada
const MIRADA_ROTULO_TITULO_GRAFICO = 'Evoluci\u00f3n de Tendencias';   // MEDIDO EN VIVO 2026-09-07 (con acento en la hoja)
const MIRADA_GRAFICO_FILA_INICIO = 14;   // MEDIDO EN VIVO 2026-09-07: primera fila vacia bajo la banda
const MIRADA_GRAFICO_FILA_FIN = 21;      // pedido textual de Franco 2026-09-07: "En C14:R21 va un grafico"
const MIRADA_GRAFICO_COL_INICIO = 'C';   // idem
const MIRADA_GRAFICO_COL_FIN = 'R';      // idem (misma ultima columna que la tabla)

// decision Franco 2026-09-07: colores SOLO de la lista blanca del brandbook Ed.03 (PALETA en
// devtools/probar_shell.js, tokens :root de UI_Shell.html). Ingresos = verde de funcion,
// Gastos Fijos = Warn (rojo de funcion), Gastos Variables = ambar de funcion, Capitalizacion =
// navy: es la voz de la marca y la metrica que importa, por eso lleva la linea mas gruesa.
// Cada entrada se identifica por FILA (no por posicion) para que el nombre de la serie salga
// de la misma tabla de rotulos que verifica el preflight.
const MIRADA_GRAFICO_SERIES = [
    { fila: MIRADA_FILA_INGRESOS, color: '#1D6A4F', lineWidth: 2 },
    { fila: MIRADA_FILA_GASTOS_FIJOS, color: '#B84A3E', lineWidth: 2 },
    { fila: MIRADA_FILA_GASTOS_VARIABLES, color: '#6B4A18', lineWidth: 2 },
    { fila: MIRADA_FILA_RESULTADO, color: '#182040', lineWidth: 4 }
];
const MIRADA_GRAFICO_FONDO = '#FFFFFF';       // blanco de la lista blanca
const MIRADA_GRAFICO_FORMATO_EJE = '#,##0';   // patron canonico (punto decimal, sin decimales en el eje)
const MIRADA_GRAFICO_CURVA = 'none';          // pedido textual: "linea de rectas"
const MIRADA_GRAFICO_LEYENDA = 'top';         // la banda C13:R13 ya es el titulo: sin titulo interno, leyenda arriba

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
 * Convierte 'I2' en '$I$2' (referencia absoluta para intercalar en una formula).
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

/** Rango A1 del bloque de las tres filas de conceptos (hoy G8:R10). */
function _bloqueConceptosMirada() {
    return MIRADA_COLS_VISTA[0] + MIRADA_FILA_INGRESOS + ':' +
        MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1] + MIRADA_FILA_GASTOS_VARIABLES;
}

/** Rango A1 de la fila de Capitalizacion (hoy G11:R11). */
function _filaResultadoMirada() {
    return MIRADA_COLS_VISTA[0] + MIRADA_FILA_RESULTADO + ':' +
        MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1] + MIRADA_FILA_RESULTADO;
}

/** Rango A1 de la fila de meses (hoy G7:R7). */
function _filaMesesMirada() {
    return MIRADA_COLS_VISTA[0] + MIRADA_FILA_MESES + ':' +
        MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1] + MIRADA_FILA_MESES;
}

/**
 * Argumentos con los que inicializarMiradaInteranual() construye la formula de la celda
 * origen del bloque (G8): el rotulo de SU fila con columna fija y fila relativa ($C8, que al
 * copiar a G9/G10 se vuelve $C9/$C10) y el offset en meses contra la columna de referencia
 * ($K$8, absoluta). Es una funcion pura para que el banco pruebe exactamente estos
 * argumentos y no una copia.
 * @param {number} fila fila de la celda origen (hoy MIRADA_FILA_INGRESOS)
 * @returns {{rotuloExpr:string, offsetExpr:string}}
 */
function _argumentosFormulaDatosMirada(fila) {
    return {
        rotuloExpr: '$' + MIRADA_COL_ROTULOS + fila,
        offsetExpr: 'COLUMN()-COLUMN(' + _refAbsolutaMirada(MIRADA_COL_REFERENCIA + fila) + ')'
    };
}

/**
 * Formulas de la fila de Capitalizacion, una por columna de la vista: Ingresos - Gastos Fijos
 * - Gastos Variables (hoy "=G8-G9-G10" en G). Son restas entre celdas de la propia hoja: sin
 * separadores de argumentos, el locale no las afecta.
 * @returns {string[]}
 */
function _formulasResultadoMirada() {
    return MIRADA_COLS_VISTA.map(function (col) {
        return '=' + col + MIRADA_FILA_INGRESOS +
            '-' + col + MIRADA_FILA_GASTOS_FIJOS +
            '-' + col + MIRADA_FILA_GASTOS_VARIABLES;
    });
}

// ============================================
// REFERENCIAS A "REGISTROS" (DERIVADAS DE CONFIG)
// ============================================

/**
 * Devuelve la referencia A1 absoluta y ABIERTA de una columna del ledger.
 *
 * Ejemplo con el layout de produccion v0.11 (datos desde la fila 7):
 * _refColumnaRegistrosMirada('fecha') -> 'Registros'!$H$7:$H
 * (Sheets le SACA las comillas a un nombre de hoja que no las necesita: la celda guarda
 * Registros!$H$7:$H. Por eso el banco normaliza en ese sentido antes de comparar.)
 *
 * decision Franco 2026-08-13: el rango se deja ABIERTO ($H$7:$H con el dataRow actual; en
 * v0.9.5 era $H$6:$H, la fila la fija RANGES.REGISTROS.dataRow) en vez de cerrarlo en una
 * fila fija. El codigo v0.8.x cerraba en la fila 5000 -- un numero inventado que excedia el
 * grid medido el 2026-08-13 (4848 filas; el rango abierto no depende del grid, por eso no se
 * remide) y que ademas quedaba corto apenas el ledger crecia, sin que nadie se enterara. El
 * rango abierto no puede exceder el grid por definicion y se adapta solo a cada carga nueva,
 * que es exactamente lo que hace falta en una vista que se escribe una vez y se consulta
 * durante meses.
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
 * Construye el string de la formula LET/SUMPRODUCT de una celda de G8:R10.
 *
 * TRAMPA DE LOCALE (documentada desde v0.8.2, RESUELTA por medicion el 2026-09-07):
 * la planilla esta en espanol (es_AR): separador de argumentos ";" y separador decimal ",".
 * setFormula() NO traduce: las 36 formulas que hoy funcionan en G8:R10 estan guardadas con
 * ";" (gemelo docs/permanente/celdas.tsv). El modulo v0.8.x asumia traduccion y escribia
 * con comas, y ademas apuntaba a columnas que la migracion de agosto movio; las 48 celdas
 * del layout pre-Fix (G10:R14) quedaron en "#ERROR! (Formula parse error.)". Por eso el
 * mapeo de columnas sale de RANGES y el separador es un PARAMETRO: quien escribe prueba ","
 * y luego ";" y verifica el resultado en la celda (ver _escribirFormulaMiradaVerificada).
 * Los arrays literales {...} siguen prohibidos por el mismo motivo: se usa SPLIT de un string.
 *
 * Las comas que quedan DENTRO de comillas (la lista de meses y el delimitador ",") son
 * datos, no separadores: no se tocan nunca.
 *
 * @param {string} rotuloExpr Referencia/literal del rotulo de fila (ej: '$C8' o '"Ingresos"').
 * @param {string} offsetExpr Expresion del offset mensual (ej: 'COLUMN()-COLUMN($K$8)' o '0').
 * @param {string} selPrefix  Prefijo de hoja para los selectores (ej: '' o "'Mirada Interanual'!").
 * @param {string} [sep]      Separador de argumentos: ',' (en-US, default) o ';' (locale es).
 * @returns {string} Formula completa lista para setFormula().
 */
function construirFormulaMirada(rotuloExpr, offsetExpr, selPrefix, sep) {
    const s = sep || ',';
    const E = selPrefix + _refAbsolutaMirada(MIRADA_CELDA_SEL_MES);      // selector de mes (ENERO..DICIEMBRE)
    const F = selPrefix + _refAbsolutaMirada(MIRADA_CELDA_SEL_ANIO);     // selector de anio
    const R = selPrefix + _refAbsolutaMirada(MIRADA_CELDA_SEL_MONEDA);   // moneda de la vista

    // Layout v0.11 de Registros: fecha=H, monto=B, tipo_cuenta=E, moneda=G,
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
    // que un #N/A: con NA() el error se ve en la celda y se propaga a la fila de
    // Capitalizacion, que es exactamente lo que tiene que pasar cuando la vista dejo de estar
    // donde creemos.
    // La cadena se arma desde MIRADA_ROTULOS_ESPERADOS para que el preflight y la formula
    // no puedan discrepar: son la misma tabla.
    let tipoBd = 'NA()';
    for (let i = MIRADA_ROTULOS_ESPERADOS.length - 1; i >= 0; i--) {
        const r = MIRADA_ROTULOS_ESPERADOS[i];
        tipoBd = 'IF(' + rotuloExpr + '="' + r.rotulo + '"' + s + '"' + r.tipoBd + '"' + s + tipoBd + ')';
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
        // decision Franco 2026-08-13: tc_sel tambien cierra con NA(). El selector de moneda es
        // UNA celda que el usuario cambia a mano: si dice cualquier cosa que no sea una moneda conocida, el
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
 * decision Franco 2026-09-07 (v0.66.1): a proposito NO esta en MENU_CONFIG. Exige
 * "formula" y menu.addItem() llama a su funcion con cero argumentos -- clickeada desde el
 * menu revienta con TypeError en formula.length. diagnosticarMiradaInteranual() ya la llama
 * con una formula real (las dos variantes de separador) y vuelca el resultado en la hoja
 * DEBUG: ese es el camino soportado para auditar el balance, no un boton propio.
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
    // El modulo v0.8.x sabia que su celda origen (G10, layout pre-Fix) venia en texto (lo dice
    // su propio comentario) y la prueba de aceptacion que tenia habria cantado exito con las 48
    // celdas mostrando texto.
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
 * Interpreta el valor crudo del selector de anio: numero, o texto de 4 digitos (DATE() lo
 * coerciona igual). Devuelve null si no es un anio.
 * @param {*} crudo
 * @returns {number|null}
 */
function _anioSelectorMirada(crudo) {
    if (typeof crudo === 'number' && isFinite(crudo)) return Math.floor(crudo);
    if (/^\d{4}$/.test(String(crudo).trim())) return parseInt(String(crudo).trim(), 10);
    return null;
}

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
 * Verifica que la hoja tenga la geometria que estas 48 formulas (G8:R11) dan por sentada,
 * ANTES de escribir una sola celda.
 *
 * decision Franco 2026-08-13: el modulo v0.8.x escribia G10:R14 (layout pre-Fix) hardcodeado
 * sin leer nada de la hoja. En agosto era la unica hoja de la entrega cuya geometria nadie
 * habia verificado en vivo (se midio recien el 2026-09-07; ver GEOMETRIA MEDIDA EN VIVO
 * arriba) y la migracion de agosto ya habia movido dos hojas enteras: escribir a ciegas ahi
 * es exactamente la apuesta que no se puede hacer. Lo que se exige esta declarado arriba, en
 * MIRADA_ROTULOS_ESPERADOS y MIRADA_CELDA_SEL_*, para que corregirlo con la verificacion
 * en vivo sea editar constantes y nada mas.
 *
 * decision Franco 2026-09-07 (v0.66.1): a proposito NO esta en MENU_CONFIG. Exige (ss,
 * sheet) y menu.addItem() llama a su funcion con cero argumentos -- clickeada desde el menu
 * revienta con TypeError en sheet.getMaxRows(). inicializarMiradaInteranual() ya la corre
 * como paso 1 antes de tocar una celda, y diagnosticarMiradaInteranual() la corre de nuevo
 * (paso 0a) y vuelca "observado" entero en la hoja DEBUG: los dos botones que quedan en el
 * menu ya la ejercitan, con contexto (ss, sheet) real.
 *
 * @param {Spreadsheet} ss
 * @param {Sheet} sheet hoja "Mirada Interanual"
 * @returns {{ok:boolean, problemas:string[], observado:Object}}
 */
function verificarPrecondicionesMirada(ss, sheet) {
    const problemas = [];
    const observado = {};

    // --- 1. Grid de la vista: si la hoja no llega hasta la ultima fila de la vista (R11), getRange lanzaria a mitad ---
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

    // --- 2b. Rotulo de la fila de Capitalizacion: no alimenta tipo_bd, pero es el nombre de una
    // serie del grafico y la fila donde el boton 2 escribe la resta. Mismo rigor. ---
    const celdaResultado = MIRADA_COL_ROTULOS + MIRADA_FILA_RESULTADO;
    const leidoResultado = String(sheet.getRange(celdaResultado).getDisplayValue());
    observado[celdaResultado] = '[' + leidoResultado + ']';
    if (!_coincideRotuloMirada(leidoResultado, MIRADA_ROTULO_RESULTADO)) {
        problemas.push('rotulo ' + celdaResultado + ': se esperaba "' + MIRADA_ROTULO_RESULTADO +
            '" y hay [' + leidoResultado + ']');
    }

    // --- 3. Selectores ---
    const mes = String(sheet.getRange(MIRADA_CELDA_SEL_MES).getDisplayValue());
    observado[MIRADA_CELDA_SEL_MES] = '[' + mes + ']';
    if (MIRADA_MESES.split(',').indexOf(mes.toUpperCase()) < 0) {
        problemas.push('selector de mes ' + MIRADA_CELDA_SEL_MES + ': [' + mes +
            '] no es uno de los doce meses');
    }

    const anioCrudo = sheet.getRange(MIRADA_CELDA_SEL_ANIO).getValue();
    observado[MIRADA_CELDA_SEL_ANIO] = '[' + String(anioCrudo) + ']';
    const anio = _anioSelectorMirada(anioCrudo);
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
 * estuviera guardado como texto volveria como formula; en G7:R11 no existe ese caso).
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
 * Fijos tiene que referenciar $C9 y la de Gastos Variables $C10.
 *
 * decision Franco 2026-08-13: esto se chequea porque ya paso. Las formulas que habia en la
 * planilla pre-Fix (verificacion en vivo del 2026-08-13) tenian las filas 11 y 12 apuntando
 * a $C10: las tres filas calculaban Ingresos. Quedaba tapado por el #ERROR!, pero apenas la formula
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
// FILA DE MESES (G7:R7): FORMULA Y ETIQUETAS ESPERADAS
// ============================================

/**
 * Construye la formula de una celda de la fila de meses (G7:R7): el nombre del mes que le
 * corresponde a esa columna, derivado del selector de mes (I2), del selector de anio (I3) y
 * del offset de columna contra la columna de referencia (K7), con el MISMO mecanismo que la
 * formula de datos (MATCH sobre SPLIT de MIRADA_MESES + EDATE).
 *
 * Equivale a (con ";"):
 *   =LET(mes_num;MATCH($I$2;SPLIT("ENERO,...,DICIEMBRE";",");0);
 *        f_obj;EDATE(DATE($I$3;mes_num;1);COLUMN()-COLUMN($K$7));
 *        nom_mes;PROPER(INDEX(SPLIT("ENERO,...,DICIEMBRE";",");1;MONTH(f_obj)));
 *        IF(YEAR(f_obj)=$I$3;nom_mes;nom_mes&" "&RIGHT(YEAR(f_obj);2)))
 * PROPER da "Septiembre", el estilo del selector I2 ("Mayo"). Con MIRADA_MESES_SUFIJO_ANIO
 * en false la salida es solo nom_mes.
 *
 * Nombres de LET: mes_num, f_obj (los mismos de la formula de datos) y nom_mes. Ninguno
 * coincide con una funcion de Sheets: un nombre que colisiona (N, OFFSET, ROW, ...) hace que
 * la formula no parsee y la celda quede VACIA sin error visible. Sin array literals: la
 * lista entra por SPLIT. Las comas dentro de comillas son datos, no separadores.
 *
 * @param {string} [sep]       separador de argumentos: ',' (default) o ';'
 * @param {string} [selPrefix] prefijo de hoja para los selectores (solo lo usa el diagnostico,
 *                             que evalua la formula desde la hoja DEBUG)
 * @returns {string} formula lista para setFormula()
 */
function construirFormulaMesMirada(sep, selPrefix) {
    const s = sep || ',';
    const pre = selPrefix || '';
    const selMes = pre + _refAbsolutaMirada(MIRADA_CELDA_SEL_MES);
    const selAnio = pre + _refAbsolutaMirada(MIRADA_CELDA_SEL_ANIO);
    const refCol = _refAbsolutaMirada(MIRADA_COL_REFERENCIA + MIRADA_FILA_MESES);
    const lista = 'SPLIT("' + MIRADA_MESES + '"' + s + '",")';

    const pares = [
        'mes_num', 'MATCH(' + selMes + s + lista + s + '0)',
        'f_obj', 'EDATE(DATE(' + selAnio + s + 'mes_num' + s + '1)' + s +
            'COLUMN()-COLUMN(' + refCol + '))',
        'nom_mes', 'PROPER(INDEX(' + lista + s + '1' + s + 'MONTH(f_obj)))'
    ];
    // decision Franco 2026-09-07: sufijo " YY" solo cuando el anio del mes difiere del de
    // referencia (ver MIRADA_MESES_SUFIJO_ANIO). Se compara YEAR() contra la celda I3 tal
    // cual: si I3 fuera texto la comparacion daria FALSE y las 12 celdas llevarian sufijo; el
    // preflight de la entrada de menu exige I3 numerico justamente por eso.
    const salida = MIRADA_MESES_SUFIJO_ANIO
        ? 'IF(YEAR(f_obj)=' + selAnio + s + 'nom_mes' + s + 'nom_mes&" "&RIGHT(YEAR(f_obj)' + s + '2))'
        : 'nom_mes';

    return '=LET(' + pares.join(s) + s + salida + ')';
}

/**
 * Gemela pura en JS de construirFormulaMesMirada: las 12 etiquetas que la fila de meses DEBE
 * mostrar para un mes y un anio de referencia (offsets -4..+7, K = 0). Es la referencia
 * contra la que se verifica el VALOR de cada celda despues de escribir: mismo criterio
 * (PROPER del nombre, sufijo " YY" cuando el anio difiere, respetando
 * MIRADA_MESES_SUFIJO_ANIO). Si la formula y esta funcion discrepan, gana la verificacion:
 * se restaura y se avisa.
 *
 * @param {string} mesRef  nombre del mes (insensible a mayusculas, sensible a espacios, como MATCH)
 * @param {number} anioRef entero entre MIRADA_ANIO_MIN y MIRADA_ANIO_MAX
 * @returns {string[]} 12 etiquetas, una por columna de MIRADA_COLS_VISTA
 * @throws {Error} si mesRef no es un mes o anioRef no es un anio valido
 */
function _etiquetasMesesEsperadasMirada(mesRef, anioRef) {
    const meses = MIRADA_MESES.split(',');
    const idx = meses.indexOf(String(mesRef === null || mesRef === undefined ? '' : mesRef).toUpperCase());
    if (idx < 0) {
        throw new Error('_etiquetasMesesEsperadasMirada: [' + mesRef + '] no es uno de los doce meses.');
    }
    if (typeof anioRef !== 'number' || !isFinite(anioRef) || Math.floor(anioRef) !== anioRef ||
        anioRef < MIRADA_ANIO_MIN || anioRef > MIRADA_ANIO_MAX) {
        throw new Error('_etiquetasMesesEsperadasMirada: [' + anioRef + '] no es un anio entero entre ' +
            MIRADA_ANIO_MIN + ' y ' + MIRADA_ANIO_MAX + '.');
    }
    // El offset de la primera columna sale de la posicion de K en la vista (hoy -4), no de un 4.
    const primerOffset = -MIRADA_COLS_VISTA.indexOf(MIRADA_COL_REFERENCIA);
    return MIRADA_COLS_VISTA.map(function (_col, i) {
        const absoluto = idx + primerOffset + i;
        const anio = anioRef + Math.floor(absoluto / 12);
        const m = ((absoluto % 12) + 12) % 12;
        const nombre = meses[m].charAt(0) + meses[m].slice(1).toLowerCase();
        if (MIRADA_MESES_SUFIJO_ANIO && anio !== anioRef) {
            return nombre + ' ' + String(anio).slice(-2);
        }
        return nombre;
    });
}

// ============================================
// GRAFICO DE TENDENCIAS (C14:R21)
// ============================================

/**
 * Especificacion PURA del grafico: rangos, ancla, series, orientacion y estilo, todo derivado
 * de las constantes de la vista. Devuelve un objeto plano para que el banco lo pruebe sin
 * SpreadsheetApp; _construirGraficoMirada la consume tal cual.
 *
 * Datos: dos rangos. C7:C11 (nombres de serie, con C7 como cabecera de la columna de dominio)
 * y G7:R11 (fila 7 = meses = dominio; filas 8-11 = cuatro series). Con transponer=true cada
 * FILA es una serie y los meses van al eje X.
 *
 * @returns {{rangos:string[], rangoRotulos:string, rangoDatos:string, anclaFila:number,
 *   anclaCol:number, filaFin:number, colFin:string, colFinNumero:number,
 *   series:Array<{fila:number, nombre:string, color:string, lineWidth:number}>,
 *   transponer:boolean, encabezados:number, fondo:string, formatoEjeV:string,
 *   curva:string, leyenda:string}}
 */
function _especificacionGraficoMirada() {
    const colIni = MIRADA_COLS_VISTA[0];
    const colFin = MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1];
    const rangoRotulos = MIRADA_COL_ROTULOS + MIRADA_FILA_MESES + ':' +
        MIRADA_COL_ROTULOS + MIRADA_FILA_RESULTADO;
    const rangoDatos = colIni + MIRADA_FILA_MESES + ':' + colFin + MIRADA_FILA_RESULTADO;

    const rotuloDeFila = {};
    MIRADA_ROTULOS_ESPERADOS.forEach(function (r) { rotuloDeFila[r.fila] = r.rotulo; });
    rotuloDeFila[MIRADA_FILA_RESULTADO] = MIRADA_ROTULO_RESULTADO;

    // Las series del chart son POSICIONALES (fila 8 -> serie 0, ...): la tabla de colores tiene
    // que cubrir exactamente las filas FILA_MESES+1 .. FILA_RESULTADO, en ese orden. Si no,
    // un color quedaria sobre la serie equivocada sin ningun error visible.
    const series = MIRADA_GRAFICO_SERIES.map(function (s, i) {
        const filaEsperada = MIRADA_FILA_MESES + 1 + i;
        if (s.fila !== filaEsperada) {
            throw new Error('_especificacionGraficoMirada: la serie ' + i + ' declara la fila ' +
                s.fila + ' y el rango de datos pone ahi la fila ' + filaEsperada + '.');
        }
        if (!rotuloDeFila[s.fila]) {
            throw new Error('_especificacionGraficoMirada: la fila ' + s.fila + ' no tiene rotulo declarado.');
        }
        return { fila: s.fila, nombre: rotuloDeFila[s.fila], color: s.color, lineWidth: s.lineWidth };
    });
    if (MIRADA_FILA_MESES + series.length !== MIRADA_FILA_RESULTADO) {
        throw new Error('_especificacionGraficoMirada: hay ' + series.length +
            ' series declaradas y el rango de datos tiene ' + (MIRADA_FILA_RESULTADO - MIRADA_FILA_MESES) + ' filas.');
    }

    return {
        rangos: [rangoRotulos, rangoDatos],
        rangoRotulos: rangoRotulos,
        rangoDatos: rangoDatos,
        anclaFila: MIRADA_GRAFICO_FILA_INICIO,
        anclaCol: _numeroColumnaMirada(MIRADA_GRAFICO_COL_INICIO),
        filaFin: MIRADA_GRAFICO_FILA_FIN,
        colFin: MIRADA_GRAFICO_COL_FIN,
        colFinNumero: _numeroColumnaMirada(MIRADA_GRAFICO_COL_FIN),
        series: series,
        transponer: true,
        encabezados: 1,
        mergeStrategy: 'MERGE_COLUMNS',
        fondo: MIRADA_GRAFICO_FONDO,
        formatoEjeV: MIRADA_GRAFICO_FORMATO_EJE,
        curva: MIRADA_GRAFICO_CURVA,
        leyenda: MIRADA_GRAFICO_LEYENDA
    };
}

/**
 * Tamano del grafico en pixeles: la suma de los anchos de columna C..R por la suma de los
 * altos de fila 14..21, MEDIDOS en la hoja al momento de correr (no hardcodeados: Franco
 * ajusta anchos a mano y el grafico tiene que seguir cubriendo exactamente C14:R21).
 * @param {Sheet} sheet
 * @param {Object} spec resultado de _especificacionGraficoMirada
 * @returns {{ancho:number, alto:number}}
 */
function _dimensionesGraficoMirada(sheet, spec) {
    let ancho = 0;
    for (let c = spec.anclaCol; c <= spec.colFinNumero; c++) ancho += sheet.getColumnWidth(c);
    let alto = 0;
    for (let f = spec.anclaFila; f <= spec.filaFin; f++) alto += sheet.getRowHeight(f);
    return { ancho: ancho, alto: alto };
}

/**
 * Construye el EmbeddedChart a partir de la especificacion pura. No lo inserta: eso lo hace
 * la entrada de menu, que necesita saber si quedo insertado antes de retirar los previos.
 *
 * decision Franco 2026-09-07: semantica confirmada en la referencia oficial de
 * EmbeddedChartBuilder (developers.google.com/apps-script/reference/spreadsheet/embedded-chart-builder,
 * consultada el 2026-09-07): addRange "Adds a range to the chart ... Does not add the range if
 * it has already been added"; setMergeStrategy: "Sets the merge strategy to use when more than
 * one range exists. If MERGE_ROWS, rows are merged; if MERGE_COLUMNS, columns are merged.
 * Defaults to MERGE_COLUMNS" (Charts.ChartMergeStrategy.MERGE_COLUMNS: "Charts merges the
 * columns of multiple ranges") -- es lo que pone C7:C11 y G7:R11 lado a lado como UNA grilla de
 * 5 filas x 13 columnas; se fija explicito y no se deja al default (ronda de revision
 * 2026-09-07: el unico parametro que decide como se pegan los dos rangos no puede quedar
 * implicito); setTransposeRowsAndColumns(true) "the rows and columns are switched" (defaults to
 * false) -- transponer esa grilla la vuelve 13 x 5: la primera FILA es C7:C11 (cabecera +
 * nombres de serie, que setNumHeaders(1) toma como encabezados de columna) y la primera COLUMNA
 * es la fila 7 de la hoja (los meses, que useFirstColumnAsDomain toma como dominio); cada fila
 * siguiente = un mes con sus cuatro valores, que es la orientacion "cada FILA de la hoja es una
 * serie"; setNumHeaders(1) "Sets the number of rows or columns of the range that should be
 * treated as headers"; setPosition: "anchorRowPos and anchorColPos are 1-indexed" (14, 3 =
 * C14); setOption "doesn't validate the option you specify is valid for this chart type", por
 * eso los nombres de opcion se cotejaron contra la referencia de opciones de charts embebidos
 * de Apps Script (developers.google.com/apps-script/chart-configuration-options): curveType
 * 'none' ("Straight lines without curve"), useFirstColumnAsDomain, series.{color,lineWidth},
 * colors, legend.position 'top', backgroundColor, width/height en pixeles, todas documentadas
 * ahi. vAxis.format NO figura en esa referencia (solo direction, gridlines, logScale,
 * maxValue, minValue, minorGridlines, textPosition, textStyle, title, titleTextStyle,
 * viewWindow, viewWindowMode): se envia igual como cinturon porque no dana, y si el eje no toma
 * el patron en vivo se quita la opcion y se acepta el default del eje (los datos de G8:R11 ya
 * estan en #,##0.00). La orientacion final se confirma mirando la hoja, no este comentario.
 *
 * @param {Sheet} sheet
 * @param {Object} spec resultado de _especificacionGraficoMirada
 * @param {{ancho:number, alto:number}} dims
 * @returns {EmbeddedChart}
 */
function _construirGraficoMirada(sheet, spec, dims) {
    const opcionesSeries = {};
    spec.series.forEach(function (s, i) {
        opcionesSeries[i] = { color: s.color, lineWidth: s.lineWidth };
    });

    return sheet.newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(sheet.getRange(spec.rangoRotulos))
        .addRange(sheet.getRange(spec.rangoDatos))
        .setMergeStrategy(Charts.ChartMergeStrategy[spec.mergeStrategy])
        .setTransposeRowsAndColumns(spec.transponer)
        .setNumHeaders(spec.encabezados)
        .setPosition(spec.anclaFila, spec.anclaCol, 0, 0)
        .setOption('useFirstColumnAsDomain', true)
        .setOption('curveType', spec.curva)
        .setOption('legend', { position: spec.leyenda })
        .setOption('backgroundColor', spec.fondo)
        .setOption('vAxis', { format: spec.formatoEjeV })
        .setOption('colors', spec.series.map(function (s) { return s.color; }))
        .setOption('series', opcionesSeries)
        .setOption('width', dims.ancho)
        .setOption('height', dims.alto)
        .build();
}

/**
 * Traduce lo que devuelve getHorizontalAlignment() ('left', 'center', 'right', 'general',
 * 'general-left', 'general-right') a un valor que setHorizontalAlignment() acepte. Sin esto,
 * copiar la alineacion de K7 podria lanzar por un 'general-right' y abortar la escritura.
 * @param {*} leida
 * @returns {string}
 */
function _alineacionAplicableMirada(leida) {
    const a = String(leida === null || leida === undefined ? '' : leida).toLowerCase();
    if (a.indexOf('center') > -1) return 'center';
    if (a.indexOf('right') > -1) return 'right';
    if (a.indexOf('left') > -1) return 'left';
    return 'normal';
}

/**
 * Traduce una alineacion LEIDA de la hoja al valor con el que se la REPONE tal como estaba.
 *
 * decision Franco 2026-09-07 (ronda de revision): el camino de ida ya traducia con
 * _alineacionAplicableMirada, pero la restauracion devolvia a setHorizontalAlignments la
 * matriz cruda de getHorizontalAlignments, que para una celda sin alineacion explicita trae
 * 'general' / 'general-left' / 'general-right' -- fuera del dominio documentado del setter
 * ("either 'left', 'center' or 'normal'; a null value resets the alignment"). Hoy G7:J7 y
 * L7:R7 son justamente ese caso. Un 'general*' se repone con null (reset = "volver a como
 * estaba"); todo lo demas pasa por el mismo mapeo que la ida. Sin esto, cualquier fallo de la
 * fila restauraba bien el contenido y aun asi cantaba "restauracion NO verificada" por la
 * alineacion: un rojo que nombra mal la causa.
 * @param {*} leida
 * @returns {?string} 'left' | 'center' | 'right' | 'normal' | null
 */
function _alineacionRestaurableMirada(leida) {
    const a = String(leida === null || leida === undefined ? '' : leida).toLowerCase();
    if (a === '' || a.indexOf('general') === 0) return null;
    return _alineacionAplicableMirada(a);
}

/**
 * Graficos de la hoja que ocupan el lugar del propio: los anclados en (anclaFila, anclaCol).
 * Es la identidad que hace idempotente a la entrada de menu: correrla dos veces deja UN
 * grafico, no dos.
 * @param {Sheet} sheet
 * @param {Object} spec
 * @returns {EmbeddedChart[]}
 */
function _graficosPropiosMirada(sheet, spec) {
    return sheet.getCharts().filter(function (ch) {
        const info = ch.getContainerInfo();
        return info.getAnchorRow() === spec.anclaFila && info.getAnchorColumn() === spec.anclaCol;
    });
}

/**
 * Preflight de la entrada "Meses y grafico": el de la vista (verificarPrecondicionesMirada,
 * que ya cubre rotulos C8:C11, selectores y ledger) MAS lo que esta entrada necesita: el
 * titulo del grafico en C13, K7 no vacia (la simulacion de Franco), la hoja llegando a la
 * fila 21 y a la columna R, y el selector de anio numerico (la formula de mes compara YEAR()
 * contra esa celda). Si el grid de la vista no alcanza, se devuelve tal cual: no hay nada mas
 * que leer con seguridad.
 * @param {Spreadsheet} ss
 * @param {Sheet} sheet
 * @returns {{ok:boolean, problemas:string[], observado:Object}}
 */
function _verificarPrecondicionesMesesGraficoMirada(ss, sheet) {
    const base = verificarPrecondicionesMirada(ss, sheet);
    const problemas = base.problemas.slice();
    const observado = base.observado;

    const maxFilas = sheet.getMaxRows();
    const maxCols = sheet.getMaxColumns();
    const colUltimaVista = _numeroColumnaMirada(MIRADA_COLS_VISTA[MIRADA_COLS_VISTA.length - 1]);
    if (maxFilas < MIRADA_FILA_RESULTADO || maxCols < colUltimaVista) {
        return base;
    }

    const colFinGrafico = _numeroColumnaMirada(MIRADA_GRAFICO_COL_FIN);
    if (maxFilas < MIRADA_GRAFICO_FILA_FIN) {
        problemas.push('la hoja tiene ' + maxFilas + ' filas y el grafico llega hasta la fila ' +
            MIRADA_GRAFICO_FILA_FIN);
    }
    if (maxCols < colFinGrafico) {
        problemas.push('la hoja tiene ' + maxCols + ' columnas y el grafico llega hasta la columna ' +
            MIRADA_GRAFICO_COL_FIN + ' (' + colFinGrafico + ')');
    }

    const titulo = String(sheet.getRange(MIRADA_CELDA_TITULO_GRAFICO).getDisplayValue());
    observado[MIRADA_CELDA_TITULO_GRAFICO] = '[' + titulo + ']';
    if (!_coincideRotuloMirada(titulo, MIRADA_ROTULO_TITULO_GRAFICO)) {
        problemas.push('titulo del grafico ' + MIRADA_CELDA_TITULO_GRAFICO + ': se esperaba "' +
            MIRADA_ROTULO_TITULO_GRAFICO + '" y hay [' + titulo + ']');
    }

    const celdaRef = MIRADA_COL_REFERENCIA + MIRADA_FILA_MESES;
    const simulacion = String(sheet.getRange(celdaRef).getDisplayValue());
    observado[celdaRef] = '[' + simulacion + ']';
    if (simulacion.trim() === '') {
        problemas.push('la celda de referencia ' + celdaRef + ' esta vacia: se esperaba la simulacion ' +
            'del mes de referencia (=' + MIRADA_CELDA_SEL_MES + ')');
    }

    const anioCrudo = sheet.getRange(MIRADA_CELDA_SEL_ANIO).getValue();
    if (typeof anioCrudo !== 'number') {
        problemas.push('selector de anio ' + MIRADA_CELDA_SEL_ANIO + ': [' + String(anioCrudo) +
            '] no es numerico y la formula de mes compara YEAR() contra esa celda');
    }

    return { ok: problemas.length === 0, problemas: problemas, observado: observado };
}

// ============================================
// ENTRADAS DEL MENU
// ============================================

/**
 * (Re)escribe las formulas de datos de Mirada Interanual en el rango G8:R11.
 *
 * Layout (MEDIDO EN VIVO 2026-09-07):
 *   G8:R8 - Ingresos por mes      G9:R9 - Gastos Fijos      G10:R10 - Gastos Variables
 *   G11:R11 - Capitalizacion (G8 - G9 - G10)
 *
 * Selectores: I2 = mes (nombre en espanol, capitalizado o en mayusculas), I3 = anio,
 * I4 = moneda (ARS|USD|AUD|EUR). K = mes de referencia (offset 0). G = mes-4 ... R = mes+7.
 *
 * Fuente: hoja "Registros", layout v0.11 (header fila 6, datos desde fila 7, B:M).
 * Las columnas salen de RANGES.REGISTROS: si el layout vuelve a moverse, se cambia
 * 00_Config.js y este modulo sigue sin tocarse.
 *
 * Hoy es un no-op seguro: la hoja ya guarda formulas identicas a las que construye este
 * modulo (probado en devtools/probar_mirada_meses_grafico.js, T1). Sigue existiendo como
 * boton porque es el camino para reponer el bloque si alguien lo pisa a mano.
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
    // $C8: columna fija, fila relativa (al copiar a G9/G10 -> $C9/$C10).
    // COLUMN()-COLUMN($K$8): offset en meses respecto al mes de referencia.
    const args = _argumentosFormulaDatosMirada(MIRADA_FILA_INGRESOS);
    const celdaOrigen = sheet.getRange(MIRADA_COLS_VISTA[0] + MIRADA_FILA_INGRESOS);
    let intento = null;
    let excepcion = null;

    try {
        // El formato numerico va ANTES de la formula, no despues. Si la celda esta en "Texto
        // sin formato" (@) -- que es como estaba la celda origen segun el propio comentario de
        // v0.8.x -- Sheets guarda la formula como texto y no la evalua nunca: la celda muestra
        // "=LET(..." y ningun separador nuevo cambia eso. El formato previo esta respaldado y
        // la restauracion lo repone si la escritura no llega a completarse.
        sheet.getRange(bloque).setNumberFormat(MIRADA_FORMATO_NUMERO);
        sheet.getRange(filaResultado).setNumberFormat(MIRADA_FORMATO_NUMERO);

        intento = _escribirFormulaMiradaVerificada(celdaOrigen, function (sep) {
            return construirFormulaMirada(args.rotuloExpr, args.offsetExpr, '', sep);
        });

        if (intento.ok) {
            // Replicar al bloque G8:R10 (las referencias relativas se ajustan por celda).
            celdaOrigen.copyTo(sheet.getRange(bloque));

            // Fila de Capitalizacion: Ingresos - Gastos Fijos - Gastos Variables. Va en UNA
            // sola llamada para no dejar la fila a medio escribir si algo corta en el medio.
            sheet.getRange(filaResultado).setFormulas([_formulasResultadoMirada()]);

            // Se reafirma el formato despues de copyTo/setFormulas: copyTo propaga el formato
            // de origen y la fila de Capitalizacion se escribe recien aca.
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
                formulaPreviaOrigen: respaldo.partes[0].formulas[0][0] || '(vacia)',
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
        displayOrigen: _recortarMirada(intento.display, 200),
        porEstado: post ? post.porEstado : null,
        muestras: post ? post.muestras : null
    });
}

/**
 * Entrada de menu "Meses y grafico": escribe la formula de mes en G7:R7 y dibuja el grafico
 * de tendencias en C14:R21, con el contrato de escritura del modulo.
 *
 * Secuencia:
 *   1. preflight por rotulo (vista + titulo C13 + K7 + grid 21/R + I3 numerico): ante cualquier
 *      problema no se escribe nada y se lista;
 *   2. respaldo verificado de G7:R7 (formulas, valores, formatos numericos) y de su alineacion
 *      (que se repone via _alineacionRestaurableMirada: 'general*' vuelve como null = reset);
 *   3. alineacion horizontal de K7 copiada al resto de la fila; formula en G7 probando "," y
 *      ";" (verificada por display); replicacion con copyTo a G7:R7 (COLUMN() relativo, $K$7
 *      absoluto);
 *   4. verificacion de VALOR: las 12 celdas releidas contra _etiquetasMesesEsperadasMirada;
 *      cualquier diferencia restaura el respaldo, verifica la restauracion y NO sigue;
 *   5. grafico: se inserta el nuevo y SOLO si quedo insertado se retiran los previos anclados
 *      en el mismo lugar (si la insercion falla, el grafico anterior sobrevive);
 *   6. verificacion del grafico: rangos y ancla releidos de sheet.getCharts();
 *   7. toast + logSuccess con separador, 12/12 etiquetas y previos retirados.
 *
 * @since 0.6.0
 */
function inicializarMesesYGraficoMirada() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.MIRADA_INTERANUAL);

    if (!sheet) {
        _avisarMirada(ss, 'Sin resolver',
            'Hoja "' + SHEETS.MIRADA_INTERANUAL + '" no encontrada. No se escribio nada.', 8, true);
        logError('inicializarMesesYGraficoMirada: hoja "' + SHEETS.MIRADA_INTERANUAL + '" no encontrada');
        return;
    }

    // ---- 1. PRECONDICIONES ----
    const pre = _verificarPrecondicionesMesesGraficoMirada(ss, sheet);
    if (!pre.ok) {
        _avisarMirada(ss, 'Sin resolver',
            'No se escribio ninguna celda: la hoja no tiene la geometria que la fila de meses y ' +
            'el grafico necesitan.\n\n- ' + pre.problemas.join('\n- '), 10, true);
        logError('inicializarMesesYGraficoMirada: precondiciones no cumplidas, no se escribio nada', {
            problemas: pre.problemas,
            observado: pre.observado
        });
        return;
    }

    // Las etiquetas esperadas se calculan ANTES de tocar la hoja: si los selectores no dan
    // 12 etiquetas, no hay contra que verificar y no se escribe.
    const filaMeses = _filaMesesMirada();
    let esperadas;
    try {
        esperadas = _etiquetasMesesEsperadasMirada(
            sheet.getRange(MIRADA_CELDA_SEL_MES).getDisplayValue(),
            _anioSelectorMirada(sheet.getRange(MIRADA_CELDA_SEL_ANIO).getValue()));
    } catch (e0) {
        _avisarMirada(ss, 'Sin resolver',
            'No se escribio ninguna celda: no se pudieron calcular las etiquetas esperadas (' +
            e0.message + ').', 10, true);
        logError('inicializarMesesYGraficoMirada: etiquetas esperadas no calculables', { error: e0.message });
        return;
    }

    // ---- 2. RESPALDO CONGELADO Y VERIFICADO ----
    const respaldo = _respaldarRangosMirada(sheet, [filaMeses]);
    if (!respaldo.ok) {
        _avisarMirada(ss, 'Sin resolver',
            'No se escribio ninguna celda: no se pudo respaldar ' + filaMeses + ' (' +
            respaldo.motivo + ').', 10, true);
        logError('inicializarMesesYGraficoMirada: respaldo no verificable, no se escribio nada', {
            motivo: respaldo.motivo
        });
        return;
    }
    // La alineacion no forma parte de _respaldarRangosMirada (que congela formulas, valores y
    // formatos numericos): se guarda aparte para reponerla junto con lo demas si algo corta.
    const alineacionesPrevias = sheet.getRange(filaMeses).getHorizontalAlignments();
    logInfo('Mirada Interanual: respaldo verificado de ' + respaldo.celdas + ' celdas de ' +
        filaMeses + ' (' + respaldo.conFormula + ' con formula) antes de escribir.');

    // rb.ok habla SOLO del contenido (formulas/valores verificados por relectura). La alineacion
    // se repone aparte y, si no se puede, se informa como aviso separado (rb.alineacionNoRepuesta)
    // en vez de marcar toda la restauracion como no verificada: el contenido si lo esta.
    const restaurarFila = function () {
        const rb = _restaurarRespaldoMirada(sheet, respaldo);
        rb.alineacionNoRepuesta = null;
        try {
            sheet.getRange(filaMeses).setHorizontalAlignments(alineacionesPrevias.map(function (fila) {
                return fila.map(_alineacionRestaurableMirada);
            }));
        } catch (eAl) {
            rb.alineacionNoRepuesta = eAl.message || String(eAl);
        }
        return rb;
    };
    const textoRestauracion = function (rb) {
        if (!rb.ok) return 'La restauracion de ' + filaMeses + ' NO quedo verificada: revisala a mano.';
        return 'Se restauro y verifico el contenido previo de ' + filaMeses + '.' +
            (rb.alineacionNoRepuesta ? ' La alineacion horizontal NO se pudo reponer (' +
                rb.alineacionNoRepuesta + '): revisala a mano.' : '');
    };

    // ---- 3. ESCRITURA DE LA FILA ----
    const celdaRef = sheet.getRange(MIRADA_COL_REFERENCIA + MIRADA_FILA_MESES);
    const celdaOrigen = sheet.getRange(MIRADA_COLS_VISTA[0] + MIRADA_FILA_MESES);
    let intento = null;
    let excepcion = null;
    try {
        // Solo la alineacion horizontal se copia de K7: el resto del formato de la fila 7
        // (fondo, color, negrita, tamano) no se toca.
        sheet.getRange(filaMeses).setHorizontalAlignment(
            _alineacionAplicableMirada(celdaRef.getHorizontalAlignment()));
        intento = _escribirFormulaMiradaVerificada(celdaOrigen, function (sep) {
            return construirFormulaMesMirada(sep);
        });
        if (intento.ok) {
            // decision Franco 2026-09-07: PASTE_FORMULA y no copyTo a secas. El copyTo normal
            // pega tambien el formato de G7 sobre K7, y K7 lleva el color de texto del
            // resaltado del mes de referencia: se replican las formulas (COLUMN() relativo,
            // $K$7 absoluto se ajustan igual) y el formato de cada celda queda como estaba.
            celdaOrigen.copyTo(sheet.getRange(filaMeses), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
            SpreadsheetApp.flush();
        }
    } catch (e) {
        excepcion = e;
    }

    if (excepcion || !intento || !intento.ok) {
        const motivo = excepcion
            ? ('EXCEPCION durante la escritura: ' + ((excepcion.message) ? excepcion.message : String(excepcion)))
            : (intento ? (intento.estado + ': ' + _recortarMirada(intento.display))
                : 'la escritura no devolvio resultado');
        let rb = null;
        try {
            rb = restaurarFila();
        } catch (e2) {
            rb = { ok: false, divergencias: ['EXCEPCION al restaurar: ' + e2.message], alineacionNoRepuesta: null };
        }
        _avisarMirada(ss, (rb.ok && !rb.alineacionNoRepuesta) ? 'Sin resolver' : 'Revisar a mano',
            'No se pudo escribir la fila de meses (' + motivo + '). ' + textoRestauracion(rb) +
            ' No se toco el grafico.', 12, true);
        logError('inicializarMesesYGraficoMirada: escritura de la fila fallida', {
            motivo: motivo,
            intentos: intento ? intento.intentos : [],
            restauracionVerificada: rb.ok,
            alineacionNoRepuesta: rb.alineacionNoRepuesta || null,
            divergencias: rb.ok ? [] : rb.divergencias.slice(0, 10)
        });
        return;
    }

    // ---- 4. VERIFICACION DE VALOR, celda a celda ----
    const displays = sheet.getRange(filaMeses).getDisplayValues()[0];
    const diferencias = [];
    for (let i = 0; i < MIRADA_COLS_VISTA.length; i++) {
        const ref = MIRADA_COLS_VISTA[i] + MIRADA_FILA_MESES;
        const clas = _clasificarDisplayMirada(displays[i]);
        if (clas.estado !== 'OK' || clas.display !== esperadas[i]) {
            diferencias.push(ref + ': se esperaba [' + esperadas[i] + '] y hay [' +
                _recortarMirada(clas.display, 40) + '] (' + clas.estado + ')');
        }
    }
    if (diferencias.length) {
        let rb = null;
        try {
            rb = restaurarFila();
        } catch (e3) {
            rb = { ok: false, divergencias: ['EXCEPCION al restaurar: ' + e3.message], alineacionNoRepuesta: null };
        }
        _avisarMirada(ss, (rb.ok && !rb.alineacionNoRepuesta) ? 'Sin resolver' : 'Revisar a mano',
            'La fila de meses no mostro lo esperado (' + diferencias[0] +
            (diferencias.length > 1 ? ' y ' + (diferencias.length - 1) + ' mas' : '') + '). ' +
            textoRestauracion(rb) + ' No se toco el grafico.', 12, true);
        logError('inicializarMesesYGraficoMirada: etiquetas de mes distintas de las esperadas, NO se declara exito', {
            separador: intento.sep,
            esperadas: esperadas,
            leidas: displays,
            diferencias: diferencias,
            restauracionVerificada: rb.ok,
            alineacionNoRepuesta: rb.alineacionNoRepuesta || null,
            divergencias: rb.ok ? [] : rb.divergencias.slice(0, 10)
        });
        return;
    }

    // ---- 5. GRAFICO: primero se inserta el nuevo, despues se retiran los previos ----
    //
    // decision Franco 2026-09-07: nunca al reves. Si la insercion falla, el grafico anterior
    // sobrevive y la hoja no queda sin grafico. El nuevo se reconoce por su id (getChartId,
    // que la referencia declara "Integer|null"): si Sheets no diera ids, se acepta como nuevo
    // el ultimo de los anclados en C14 SOLO cuando la cantidad crecio en exactamente uno.
    let spec;
    let dims;
    let previos;
    let idsPrevios;
    let errorGrafico = null;
    try {
        spec = _especificacionGraficoMirada();
        dims = _dimensionesGraficoMirada(sheet, spec);
        previos = _graficosPropiosMirada(sheet, spec);
        idsPrevios = previos.map(function (ch) { return ch.getChartId(); });
        sheet.insertChart(_construirGraficoMirada(sheet, spec, dims));
        SpreadsheetApp.flush();
    } catch (e4) {
        errorGrafico = e4;
    }

    // ---- 6. VERIFICACION DEL GRAFICO ----
    let nuevo = null;
    let detalleGrafico = '';
    if (!errorGrafico) {
        const ahora = _graficosPropiosMirada(sheet, spec);
        const hayIds = idsPrevios.every(function (id) { return id !== null && id !== undefined; }) &&
            ahora.every(function (ch) { return ch.getChartId() !== null && ch.getChartId() !== undefined; });
        if (hayIds) {
            const candidatos = ahora.filter(function (ch) { return idsPrevios.indexOf(ch.getChartId()) < 0; });
            nuevo = candidatos.length === 1 ? candidatos[0] : null;
            if (!nuevo) detalleGrafico = 'se esperaba exactamente un grafico nuevo anclado en ' +
                MIRADA_GRAFICO_COL_INICIO + MIRADA_GRAFICO_FILA_INICIO + ' y hay ' + candidatos.length;
        } else if (ahora.length === previos.length + 1) {
            nuevo = ahora[ahora.length - 1];
        } else {
            detalleGrafico = 'sin ids de grafico y la cantidad anclada en ' + MIRADA_GRAFICO_COL_INICIO +
                MIRADA_GRAFICO_FILA_INICIO + ' paso de ' + previos.length + ' a ' + ahora.length;
        }

        if (nuevo) {
            const rangosLeidos = nuevo.getRanges().map(function (r) { return r.getA1Notation(); }).sort();
            const rangosEsperados = spec.rangos.slice().sort();
            const info = nuevo.getContainerInfo();
            const anclaOk = info.getAnchorRow() === spec.anclaFila && info.getAnchorColumn() === spec.anclaCol;
            if (rangosLeidos.join('|') !== rangosEsperados.join('|') || !anclaOk) {
                detalleGrafico = 'el grafico insertado no es el esperado: rangos [' + rangosLeidos.join(', ') +
                    '] vs [' + rangosEsperados.join(', ') + '], ancla ' + info.getAnchorRow() + '/' +
                    info.getAnchorColumn();
                // Es propio y esta mal: se retira EL NUEVO y los previos quedan como estaban.
                try { sheet.removeChart(nuevo); } catch (e5) { detalleGrafico += ' (y no se pudo retirar: ' + e5.message + ')'; }
                nuevo = null;
            }
        }
    } else {
        detalleGrafico = 'EXCEPCION al insertar: ' + (errorGrafico.message || String(errorGrafico));
    }

    if (!nuevo) {
        _avisarMirada(ss, 'Sin resolver',
            'La fila de meses quedo escrita y verificada (12/12, separador "' + intento.sep +
            '") pero el grafico NO quedo insertado en ' + MIRADA_GRAFICO_COL_INICIO + MIRADA_GRAFICO_FILA_INICIO +
            ' (' + detalleGrafico + '). ' + (previos && previos.length ? 'Los ' + previos.length +
            ' grafico(s) previos se conservan.' : 'No habia grafico previo.'), 12, true);
        logError('inicializarMesesYGraficoMirada: fila de meses OK, grafico NO insertado', {
            detalle: detalleGrafico,
            separador: intento.sep,
            etiquetas: esperadas,
            previosConservados: previos ? previos.length : null
        });
        return;
    }

    let retirados = 0;
    const noRetirados = [];
    previos.forEach(function (ch) {
        try {
            sheet.removeChart(ch);
            retirados++;
        } catch (e6) {
            noRetirados.push(e6.message || String(e6));
        }
    });
    SpreadsheetApp.flush();

    // ---- 7. EXITO, con lo que se verifico y nada mas ----
    const resumen = 'Fila de meses ' + filaMeses + ' (separador "' + intento.sep + '"): ' +
        esperadas.length + '/' + esperadas.length + ' etiquetas verificadas [' + esperadas.join(', ') +
        ']. Grafico insertado en ' + MIRADA_GRAFICO_COL_INICIO + MIRADA_GRAFICO_FILA_INICIO + ':' +
        spec.colFin + spec.filaFin + ' (' + dims.ancho + 'x' + dims.alto + ' px), ' + retirados +
        ' previo(s) retirado(s)' + (noRetirados.length ? ', ' + noRetirados.length + ' NO retirado(s)' : '') + '.';
    _avisarMirada(ss, 'Listo', resumen, 8, false);
    logSuccess('inicializarMesesYGraficoMirada: ' + resumen);
    if (noRetirados.length) {
        logError('inicializarMesesYGraficoMirada: graficos previos que no se pudieron retirar', {
            errores: noRetirados
        });
    }
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

    // 0. Estado actual de la celda origen del bloque y de los selectores.
    const celdaOrigenA1 = MIRADA_COLS_VISTA[0] + MIRADA_FILA_INGRESOS;
    if (mi) {
        dbg.getRange(fila, 1).setValue(celdaOrigenA1 + ' actual: formula almacenada');
        dbg.getRange(fila, 2).setValue(mi.getRange(celdaOrigenA1).getFormula() || '(vacia)');
        dbg.getRange(fila, 3).setValue(mi.getRange(celdaOrigenA1).getDisplayValue());
        fila++;
        // Fila de meses: lo que hay hoy (display) y las 12 etiquetas que DEBERIA mostrar segun
        // los selectores, calculadas en JS (la gemela pura de la formula de mes).
        dbg.getRange(fila, 1).setValue(_filaMesesMirada() + ' actual: valores mostrados');
        dbg.getRange(fila, 2).setValue(mi.getRange(_filaMesesMirada()).getDisplayValues()[0].join(' | '));
        fila++;
        try {
            const etiquetas = _etiquetasMesesEsperadasMirada(
                mi.getRange(MIRADA_CELDA_SEL_MES).getDisplayValue(),
                _anioSelectorMirada(mi.getRange(MIRADA_CELDA_SEL_ANIO).getValue()));
            anotar('Fila de meses: 12 etiquetas esperadas (calculadas en JS desde ' +
                MIRADA_CELDA_SEL_MES + '/' + MIRADA_CELDA_SEL_ANIO + ')', etiquetas.join(' | '));
        } catch (e) {
            anotar('Fila de meses: 12 etiquetas esperadas', 'NO CALCULABLES: ' + e.message);
        }
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

    // 8. Formula de la fila de meses, las dos variantes de separador. Evaluada desde la hoja
    //    DEBUG, COLUMN() es la de la columna C (3) y el offset contra la columna de referencia
    //    da un mes fuera de la ventana: lo que se prueba es que PARSEE y devuelva un nombre.
    const offsetDebug = 3 - _numeroColumnaMirada(MIRADA_COL_REFERENCIA);
    [',', ';'].forEach(function (sep) {
        const formulaMes = construirFormulaMesMirada(sep, selPrefix);
        anotar('Balance sintactico de la formula de mes (separador "' + sep + '")',
            _resumenBalanceMirada(formulaMes));
        correr('Formula de MES (separador "' + sep + '", offset ' + offsetDebug + ' por evaluarse en C)',
            formulaMes, 'un nombre de mes, con " YY" si cae en otro anio');
    });

    SpreadsheetApp.flush();
    dbg.autoResizeColumns(1, 3);
    dbg.setActiveSelection('A1');
    dbg.activate();
    ss.toast('Diagnostico listo en la hoja "' + SHEETS.DEBUG_MIRADA + '".', 'Diagnostico', 6);
    logSuccess('diagnosticarMiradaInteranual: reporte escrito en "' + SHEETS.DEBUG_MIRADA + '".');
}
