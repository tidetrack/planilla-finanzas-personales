/**
 * DEVTOOL_RobustezVistas.js
 * Blindaje de los bloques QUERY de staging que alimentan las vistas.
 *
 * [CONCEPTO DE NEGOCIO]
 * La promesa del producto es "paz financiera, todos los dias". Una planilla que se ve rota
 * la rompe aunque los datos esten intactos. Hoy hay dos defectos que producen exactamente eso:
 *
 *   DEFECTO 1 - QUERY de staging sin IFERROR. Los bloques que filtran el ledger por el mes del
 *   selector devuelven #N/A cuando ese mes no tiene un solo registro, y el #N/A se propaga a
 *   toda la vista que los lee. No es una hipotesis: verificado en vivo el 2026-08-13, el
 *   selector de "Inicio" apunta a julio 2026 y la fecha maxima del ledger es 21/6/2026, asi que
 *   Inicio!Y4 muestra #N/A ahora mismo. El Tablero se salva de casualidad: su selector apunta a
 *   junio, que tiene un unico registro. Un mes sin movimientos es un estado NORMAL del negocio
 *   (un mes que arranca, un mes de vacaciones), no un error: la vista tiene que decir "no hay
 *   nada", no "algo se rompio".
 *
 *   DEFECTO 2 - derrame (spill) de los bloques QUERY. Un bloque que derrama mas filas de las que
 *   tiene libres debajo no se recorta: Sheets lo tumba entero con #REF!. Es el riesgo simetrico
 *   del anterior y aparece justo cuando el selector apunta al mes con MAS movimientos.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6, puntos 3, 6 y 7: toda operacion sobre datos vivos es idempotente,
 * tiene respaldo congelado y VERIFICADO antes de mutar, y las formulas se intervienen por
 * CIRUGIA. Aca la cirugia es literal: se lee la formula viva, se la ENVUELVE, y se la escribe.
 * El SELECT/WHERE/LABEL de cada QUERY es logica de negocio que este modulo no conoce, no
 * interpreta y no regenera jamas. Si la formula no es la esperada, no se toca y se reporta.
 *
 * Ciclo cerrado, en este orden:
 *   estadoRobustezVistas()   -> que celdas estan sin proteger y cuanto espacio de derrame hay.
 *                               NO ESCRIBE NADA. Se corre primero, siempre.
 *   aplicarRobustezVistas()  -> preflight que aborta sin tocar nada + respaldo verificado +
 *                               envoltura IFERROR de las desprotegidas.
 *   revertirRobustezVistas() -> restaura las formulas originales desde el respaldo.
 *
 * QUE DEVUELVE EL IFERROR CUANDO NO HAY DATOS - decision razonada, no default:
 * ver RV_FALLBACK_POR_DEFECTO mas abajo. Resumen: celda EN BLANCO, nunca un cero.
 *
 * DOS REGLAS DEL RESPALDO, calcadas del modulo de migracion porque son cicatrices del arnes:
 *   a. RESPALDO VERIFICADO. Se releen las formulas congeladas antes de mutar una sola celda, y
 *      se exige que NINGUNA haya quedado como formula viva en la hoja de respaldo.
 *   b. RESPALDO INMUTABLE, y no solo la hoja: tambien cada formula. Mientras exista una corrida
 *      sin revertir, el respaldo original no se pisa -- un reintento solo APENDEA las celdas que
 *      todavia no tenian respaldo, y la formula ya congelada de una celda no se vuelve a tomar.
 *      Un respaldo nuevo (o una formula recongelada) seria la foto de las vistas ya intervenidas,
 *      y revertir devolveria a ese estado intermedio declarando exito.
 *
 * Contrato de retorno de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 * Cuando una falla ocurre DESPUES de haber escrito, el mensaje nunca dice "no se modifico" sino
 * "no se pudo confirmar": el modulo no afirma sobre lo que no verifico.
 *
 * @see docs/permanente/ARNES_TIDETRACK.md (seccion 6: gobernanza)
 * @see MIGRACION_v0.9.5_LayoutNuevo.js (modulo molde: mismo contrato, mismo criterio de respaldo)
 * @see 00_Config.js (SHEETS / NAV_CONFIG / RANGES: unico origen de nombres de hoja y columnas)
 *
 * @version 0.9.10
 * @since 0.9.10
 * @lastModified 2026-08-13
 */

// ============================================
// CONSTANTES
// ============================================

var RV_VERSION = '0.9.10';

/** Clave del estado en DocumentProperties. Auditoria + puntero al respaldo, NO fuente de verdad. */
var RV_PROP_ESTADO = 'ROBUSTEZ_VISTAS_ESTADO';

/** Prefijo de las claves que guardan cada formula original verbatim (una por celda). */
var RV_PROP_FORMULA_PREFIJO = 'ROBUSTEZ_VISTAS_FORMULA::';

/** Prefijo de las hojas de respaldo (ocultas, fechadas). */
var RV_RESPALDO_PREFIJO = 'RESP_ROBUSTEZ_';

/** Milisegundos de espera por el lock del documento. */
var RV_LOCK_MS = 30000;

// decision Franco 2026-08-13: el fallback del IFERROR es CELDA EN BLANCO, y se consigue con
// IFERROR de UN SOLO ARGUMENTO -- IFERROR(valor) devuelve vacio ante error, sin segundo
// argumento. Dos motivos, ninguno cosmetico:
//
//   1. NO PUEDE SER CERO. Estos bloques son el insumo de las metricas de la vista. Un cero
//      escrito donde no hubo movimientos se lee como "gaste 0 este mes", que es una afirmacion
//      falsa sobre el dinero de Franco. "No hay datos" y "el dato es cero" son estados distintos
//      y la planilla no puede confundirlos.
//   2. NO PUEDE SER TEXTO. El valor del fallback ATERRIZA EN LA COLUMNA MONTO del bloque de
//      staging (Col1 = Monto), y esa columna la leen aguas abajo formulas que hacen aritmetica
//      (Tablero!S4:S7 con -AN4:AN, AJ10 con monto_neto) y QUERY que infieren el tipo de la
//      columna por mayoria. Un "sin movimientos en el periodo" ahi dentro es una pastilla de
//      veneno: convierte una columna numerica en mixta. El mensaje humano corresponde a la capa
//      de PRESENTACION (la celda que el usuario mira), no a la capa de staging que ninguna
//      persona lee.
//
// Ademas, y no es un detalle menor: IFERROR de un argumento NO NECESITA SEPARADOR, y por lo
// tanto esquiva la trampa de locale documentada en 07_MiradaInteranual.js -- esta planilla usa
// ";" y escribir "," partiria la formula. La envoltura queda locale-agnostica por construccion.
//
// Si algun dia una celda de PRESENTACION necesitara un texto explicito, se declara en su entrada
// de RV_CELDAS (campo fallback) y _envolverIferrorRV deduce el separador de la formula viva.
var RV_FALLBACK_POR_DEFECTO = null;   // null = IFERROR de un argumento = celda en blanco

/**
 * Celdas bajo cirugia. Lista CERRADA y verificada celda por celda sobre la planilla productiva
 * el 2026-08-13 (via el scanner de la Fase 2). Es deliberadamente una lista declarada y no el
 * resultado del escaneo automatico: envolver a ciegas cualquier formula que contenga "QUERY("
 * tocaria formulas cuya semantica este modulo no verifico. El escaneo existe (ver
 * _escanearQueryRV) pero solo REPORTA.
 *
 *   ancho  = columnas que derrama el SELECT (AN4/Y4/AM4: "SELECT *" sobre Registros!B:M = 12;
 *            Cargas!R5: siete columnas explicitas). Se contrasta contra el derrame real.
 *   fallback = null -> IFERROR de un argumento (celda en blanco). Ver RV_FALLBACK_POR_DEFECTO.
 */
var RV_CELDAS = [
    {
        hojaClave: 'tablero', celda: 'AN4', ancho: 12, fallback: null,
        rol: 'staging del mes del selector (Tablero!I4 mes / I6 anio); lo leen S4:S7, U4:U7, W4, Z4, AC4, AF4, AJ10, U17'
    },
    {
        hojaClave: 'inicio', celda: 'Y4', ancho: 12, fallback: null,
        rol: 'staging del mes del selector (Inicio!P4 mes / P6 anio); lo leen I6, L6, I10, L10, I12, L12'
    },
    {
        hojaClave: 'inicio', celda: 'AM4', ancho: 12, fallback: null,
        rol: 'staging del mes ANTERIOR (comparativa mes contra mes de Inicio!I12 y L12)'
    },
    {
        hojaClave: 'cargas', celda: 'R5', ancho: 7, fallback: null,
        rol: 'panel de ultimos 15 movimientos (presentacion). Al 2026-08-13 YA esta protegida con IFERROR(...; ""): se saltea por idempotencia'
    }
];

/**
 * Hojas donde se BUSCAN otras QUERY sin proteger. Solo se reportan: ninguna se toca.
 * Claves de _nombresRV().
 */
var RV_HOJAS_INSPECCION = ['inicio', 'tablero', 'cargas', 'planCuentas', 'mirada'];

// decision Franco 2026-08-13: CALCU y ANUAL quedan FUERA de la inspeccion. Estan confirmadas
// muertas (cero referencias entrantes, fuentes inexistentes, 71 celdas #REF!). Listar sus QUERY
// rotas como pendientes crearia deuda falsa: no hay nada que blindar en una vista que nadie mira.
// Se las nombra aca para que la exclusion sea explicita y no parezca un olvido del escaneo.
var RV_HOJAS_MUERTAS = ['CALCU', 'ANUAL'];

/** Tope de hallazgos extra que entran al informe (evita un informe ilegible). */
var RV_MAX_EXTRAS = 40;

// decision Franco 2026-08-13: no alcanza con que el bloque ENTRE hoy. El mes mas cargado crece
// con el uso (el ledger suma filas todos los meses), asi que un bloque que hoy entra raspando va
// a dejar de entrar sin que nadie toque nada. x1.25 es el umbral a partir del cual se avisa: no
// bloquea -- hoy entra, y afirmar lo contrario seria falso -- pero queda escrito antes de la
// pared, que es cuando todavia se puede hacer lugar sin apuro.
var RV_MARGEN_MINIMO = 1.25;

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
function _conLockRV(yaConLock, fn) {
    if (yaConLock === true) return fn();

    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(RV_LOCK_MS)) {
        return {
            ok: false,
            error: 'No se pudo tomar el lock del documento en ' + (RV_LOCK_MS / 1000) +
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
function _uiRV() {
    try {
        return SpreadsheetApp.getUi();
    } catch (e) {
        return null;
    }
}

/** Alerta best-effort: en contexto headless no rompe, solo loguea. */
function _alertaRV(titulo, texto) {
    var ui = _uiRV();
    if (!ui) return;
    var recorte = texto.length > 1500
        ? texto.substring(0, 1500) + '\n\n[...] Informe completo en los logs (Ver > Registros).'
        : texto;
    try {
        ui.alert(titulo, recorte, ui.ButtonSet.OK);
    } catch (e) {
        logInfo('_alertaRV: sin UI disponible para "' + titulo + '"');
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
function _informarResultadoRV(titulo, r) {
    if (!r) return r;
    if (r.ok === false && r.error && r._avisado !== true) _alertaRV(titulo, r.error);
    delete r._avisado;
    return r;
}

/** Sello temporal 'yyyy-MM-dd_HHmm' en la zona horaria del script. */
function _selloRV() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

// decision Franco 2026-08-13: un estado ILEGIBLE no se trata como "no hay estado". El puntero al
// respaldo vive ahi: darlo por vacio haria que la corrida siguiente congelara un respaldo nuevo
// -- posiblemente sobre vistas ya intervenidas -- y perdiera el punto de retorno real.
/**
 * Lee el estado guardado.
 *
 * @returns {Object} estado; {} si no hay ninguno; {_corrupto:true, _crudo:string} si es ilegible
 */
function _leerEstadoRV() {
    var crudo = null;
    try {
        crudo = PropertiesService.getDocumentProperties().getProperty(RV_PROP_ESTADO);
        if (!crudo) return {};
        var obj = JSON.parse(crudo);
        if (!obj || typeof obj !== 'object') throw new Error('el estado guardado no es un objeto');
        return obj;
    } catch (e) {
        logError('_leerEstadoRV: estado ILEGIBLE en DocumentProperties', e);
        return { _corrupto: true, _crudo: String(crudo).substring(0, 300) };
    }
}

/** true si hay una corrida aplicada o a medio aplicar que todavia no fue revertida. */
function _enVueloRV(estado) {
    return !!(estado && estado.iniciadaEn && !estado.revertidaEn);
}

/** Persiste el estado (merge sobre lo existente). Las claves internas (_*) no se persisten. */
function _guardarEstadoRV(parcial) {
    var previo = _leerEstadoRV();
    var estado = {};
    for (var k0 in previo) {
        if (Object.prototype.hasOwnProperty.call(previo, k0) && k0.charAt(0) !== '_') estado[k0] = previo[k0];
    }
    for (var k in parcial) {
        if (Object.prototype.hasOwnProperty.call(parcial, k)) estado[k] = parcial[k];
    }
    estado.version = RV_VERSION;
    PropertiesService.getDocumentProperties().setProperty(RV_PROP_ESTADO, JSON.stringify(estado));
    return estado;
}

/** Clave de propiedad para la formula original de una celda. */
function _claveFormulaRV(hoja, celda) {
    return RV_PROP_FORMULA_PREFIJO + hoja + '::' + celda;
}

/** Une dos listas de claves 'Hoja!Celda' sin repetir y conservando el orden de aparicion. */
function _unirClavesRV(previas, nuevas) {
    var vistas = Object.create(null);
    var salida = [];
    [previas, nuevas].forEach(function (lista) {
        if (Object.prototype.toString.call(lista) !== '[object Array]') return;
        lista.forEach(function (k) {
            var clave = String(k);
            if (vistas[clave]) return;
            vistas[clave] = true;
            salida.push(clave);
        });
    });
    return salida;
}

/**
 * Nombres reales de las hojas que toca o inspecciona este devtool. Unico lugar donde se
 * resuelven: todos salen del SSOT (SHEETS / NAV_CONFIG), ninguno se hardcodea.
 *
 * @returns {Object<string,string>} clave interna -> nombre real de la hoja
 */
function _nombresRV() {
    return {
        registros: SHEETS.REGISTROS,
        cargas: SHEETS.DATA_ENTRY,
        planCuentas: SHEETS.PLAN_CUENTAS,
        mirada: SHEETS.MIRADA_INTERANUAL,
        tablero: NAV_CONFIG.SHEETS.TABLERO,
        inicio: NAV_CONFIG.SHEETS.INICIO
    };
}

/** Devuelve un nombre de hoja libre, agregando sufijo si hace falta. */
function _nombreHojaLibreRV(ss, base) {
    var nombre = base;
    var i = 2;
    while (ss.getSheetByName(nombre)) {
        nombre = base + '_' + i;
        i++;
        if (i > 50) throw new Error('No se pudo encontrar un nombre libre para el respaldo "' + base + '".');
    }
    return nombre;
}

// decision Franco 2026-08-13: helper propio en vez de reusar _textoLiteralV095. Ese vive en
// MIGRACION_v0.9.5_LayoutNuevo.js, que su propia cabecera declara MODULO TRANSITORIO ("se borra
// cuando la migracion quede consolidada"). Un devtool permanente que dependiera de el se
// rompería el dia que se borre el otro archivo, y el sintoma seria un ReferenceError EN MEDIO
// DEL RESPALDO -- es decir, justo antes de mutar formulas. Doce lineas duplicadas cuestan menos
// que ese acoplamiento.
/**
 * Devuelve el valor listo para escribirse como TEXTO LITERAL en una celda.
 *
 * Sheets parsea todo string que arranque con "=", "+", "-", "@" o "'". En un respaldo eso es
 * inaceptable: la formula respaldada quedaria VIVA y se recalcularia contra la misma vista que
 * el devtool esta por cambiar. El apostrofo inicial es la marca de texto de Sheets y NO forma
 * parte del valor almacenado: getValue() devuelve el string sin el, asi que la verificacion
 * sigue comparando contra el original sin traducciones.
 *
 * @param {*} v
 * @returns {string}
 */
function _textoLiteralRV(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return /^[=+\-@']/.test(s) ? "'" + s : s;
}

// ============================================
// PARSEO DE FORMULAS (sin interpretarlas)
// ============================================

/** Convierte un indice de columna 1-based a su letra ('A', 'AA', ...). */
function _colALetraRV(n) {
    var s = '';
    var i = n;
    while (i > 0) {
        var m = (i - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        i = Math.floor((i - 1) / 26);
    }
    return s;
}

/** Convierte una letra de columna a indice 1-based. */
function _letraAColRV(letra) {
    var s = String(letra).toUpperCase();
    var n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n;
}

/**
 * Parsea una referencia A1 simple ('AN4') a fila y columna 1-based.
 *
 * @param {string} celda
 * @returns {{fila: number, col: number}}
 * @throws {Error} si la referencia no es una celda simple
 */
function _a1RV(celda) {
    var m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(celda).trim());
    if (!m) throw new Error('Referencia de celda invalida en la configuracion del devtool: "' + celda + '".');
    return { fila: parseInt(m[2], 10), col: _letraAColRV(m[1]) };
}

/**
 * Recorre una llamada de funcion desde su parentesis de apertura y devuelve donde cierra y
 * donde estan los separadores de argumento de PRIMER nivel.
 *
 * Respeta literales de texto ("..." con "" como escape) y nombres de hoja entrecomillados
 * ('Plan de Cuentas'), y NO cuenta separadores dentro de literales de matriz {a \ b}: ahi el
 * ";" separa filas de la matriz, no argumentos de la funcion. Sin eso, una envoltura ya
 * existente del tipo IFERROR(QUERY(...); {"" \ ""}) se leeria mal.
 *
 * @param {string} s formula sin el "=" inicial
 * @param {number} desde indice del "(" que abre la llamada
 * @returns {{ok: boolean, cierre: number, cortes: number[]}}
 */
function _recorrerLlamadaRV(s, desde) {
    var prof = 0;
    var llaves = 0;
    var cortes = [];
    var enDobles = false;
    var enSimples = false;

    for (var i = desde; i < s.length; i++) {
        var ch = s.charAt(i);

        if (enDobles) {
            if (ch === '"') {
                if (s.charAt(i + 1) === '"') i++;   // comilla escapada
                else enDobles = false;
            }
            continue;
        }
        if (enSimples) {
            if (ch === "'") {
                if (s.charAt(i + 1) === "'") i++;
                else enSimples = false;
            }
            continue;
        }

        if (ch === '"') { enDobles = true; continue; }
        if (ch === "'") { enSimples = true; continue; }
        if (ch === '{') { llaves++; continue; }
        if (ch === '}') { if (llaves > 0) llaves--; continue; }
        if (ch === '(') { prof++; continue; }
        if (ch === ')') {
            prof--;
            if (prof === 0) return { ok: true, cierre: i, cortes: cortes };
            continue;
        }
        if (prof === 1 && llaves === 0 && (ch === ';' || ch === ',')) cortes.push(i);
    }
    return { ok: false, cierre: -1, cortes: cortes };
}

/**
 * Determina si una formula es EXACTAMENTE una envoltura IFERROR de primer nivel.
 *
 * No alcanza con que la formula contenga "IFERROR": Tablero!AJ10 lleva un
 * IFERROR(QUERY(...); {"" \ ""}) ANIDADO dentro de un LET, y darlo por envuelto (o por
 * desprotegido) seria igual de falso. Tampoco alcanza con que EMPIECE con IFERROR: una
 * formula como IFERROR(x)+1 empieza igual y no es una envoltura.
 *
 * @param {string} formula formula tal como la devuelve getFormula()
 * @returns {{externo: boolean, cuerpo: ?string, args: number, desbalanceada: boolean}}
 */
function _analizarIferrorRV(formula) {
    var s = String(formula === null || formula === undefined ? '' : formula).replace(/^\s*=\s*/, '');
    var m = /^IFERROR\s*\(/i.exec(s);
    if (!m) return { externo: false, cuerpo: null, args: 0, desbalanceada: false };

    var abre = m[0].length - 1;
    var r = _recorrerLlamadaRV(s, abre);
    if (!r.ok) return { externo: false, cuerpo: null, args: 0, desbalanceada: true };
    if (s.substring(r.cierre + 1).trim() !== '') {
        return { externo: false, cuerpo: null, args: 0, desbalanceada: false };   // IFERROR(...) + algo mas
    }

    var finArg1 = r.cortes.length ? r.cortes[0] : r.cierre;
    return {
        externo: true,
        cuerpo: s.substring(abre + 1, finArg1),
        args: r.cortes.length + 1,
        desbalanceada: false
    };
}

/** true si la formula contiene un IFERROR en cualquier nivel (aunque no sea el externo). */
function _tieneIferrorInternoRV(formula) {
    return /IFERROR\s*\(/i.test(String(formula || ''));
}

/**
 * Deduce el separador de argumentos que usa la planilla, leyendolo de la propia formula.
 *
 * La trampa de locale de 07_MiradaInteranual.js en su version mas barata: en vez de asumir ";"
 * o "," se mira cual usa la formula viva, fuera de literales. Solo hace falta cuando el
 * fallback es un texto explicito; con el fallback por defecto (IFERROR de un argumento) no se
 * escribe ningun separador y esta funcion no se llama.
 *
 * @param {string} formula
 * @returns {?string} ';' | ',' | null si no se puede deducir
 */
function _separadorArgsRV(formula) {
    var s = String(formula || '');
    var enDobles = false;
    var enSimples = false;
    var hayComa = false;
    for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        if (enDobles) {
            if (ch === '"') { if (s.charAt(i + 1) === '"') i++; else enDobles = false; }
            continue;
        }
        if (enSimples) {
            if (ch === "'") { if (s.charAt(i + 1) === "'") i++; else enSimples = false; }
            continue;
        }
        if (ch === '"') { enDobles = true; continue; }
        if (ch === "'") { enSimples = true; continue; }
        if (ch === ';') return ';';
        if (ch === ',') hayComa = true;
    }
    return hayComa ? ',' : null;
}

/**
 * CIRUGIA: envuelve la formula viva en IFERROR sin tocar una sola letra de su cuerpo.
 *
 * @param {string} formula formula actual, tal como la devuelve getFormula()
 * @param {?string} fallback texto a devolver ante error; null = IFERROR de un argumento (blanco)
 * @returns {{ok: boolean, formula: ?string, cuerpo: ?string, motivo: ?string}}
 */
function _envolverIferrorRV(formula, fallback) {
    var cuerpo = String(formula).replace(/^\s*=\s*/, '');
    if (!cuerpo) return { ok: false, formula: null, cuerpo: null, motivo: 'la celda no tiene formula' };

    if (fallback === null || fallback === undefined) {
        return { ok: true, formula: '=IFERROR(' + cuerpo + ')', cuerpo: cuerpo, motivo: null };
    }

    var sep = _separadorArgsRV(cuerpo);
    if (!sep) {
        return {
            ok: false, formula: null, cuerpo: cuerpo,
            motivo: 'se pidio un fallback de texto pero la formula no expone ningun separador de ' +
                    'argumentos fuera de literales: no se adivina si la planilla usa ";" o ",".'
        };
    }
    var texto = String(fallback).replace(/"/g, '""');
    return { ok: true, formula: '=IFERROR(' + cuerpo + sep + ' "' + texto + '")', cuerpo: cuerpo, motivo: null };
}

/** Compara formulas ignorando espacios en blanco (setFormula normaliza el formato). */
function _formulasEquivalentesRV(a, b) {
    return String(a).replace(/\s+/g, '') === String(b).replace(/\s+/g, '');
}

/** true si el valor mostrado por una celda es un error de Sheets (#N/A, #REF!, ...). */
function _esErrorRV(valorMostrado) {
    return String(valorMostrado === null || valorMostrado === undefined ? '' : valorMostrado).charAt(0) === '#';
}

// ============================================
// MEDICION DEL DERRAME (DEFECTO 2)
// ============================================

/** true si todas las celdas de la fila leida estan vacias. */
function _filaVaciaRV(fila) {
    for (var i = 0; i < fila.length; i++) {
        var v = fila[i];
        if (v !== '' && v !== null && v !== undefined) return false;
    }
    return true;
}

// decision Franco 2026-08-13: desde Apps Script una celda derramada y una celda tipeada son
// INDISTINGUIBLES por valor (ambas devuelven valor y formula vacia). Lo unico que se puede
// afirmar con evidencia es que el derrame es CONTIGUO desde la celda ancla: por eso la medicion
// es "primera fila ocupada por debajo del derrame actual", y esa fila es el techo real. Es una
// cota conservadora, y la funcion no afirma nada mas fuerte que eso.
/**
 * Mide el espacio de derrame disponible para un bloque QUERY.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @param {number} fila fila 1-based de la celda ancla
 * @param {number} col columna 1-based de la celda ancla
 * @param {number} ancho columnas que derrama el bloque
 * @returns {{alturaActual: number, primeraOcupada: number, capacidadFilas: number,
 *            anchoDisponible: number, anchoSuficiente: boolean, maxFilas: number}}
 */
function _medirDerrameRV(hoja, fila, col, ancho) {
    var maxFilas = hoja.getMaxRows();
    var maxCols = hoja.getMaxColumns();
    var anchoDisponible = maxCols - col + 1;
    var anchoLeer = Math.max(1, Math.min(ancho, anchoDisponible));
    var alto = maxFilas - fila + 1;

    var valores = alto > 0 ? hoja.getRange(fila, col, alto, anchoLeer).getValues() : [];

    var alturaActual = 0;
    while (alturaActual < valores.length && !_filaVaciaRV(valores[alturaActual])) alturaActual++;

    var primeraOcupada = 0;
    for (var j = alturaActual; j < valores.length; j++) {
        if (!_filaVaciaRV(valores[j])) { primeraOcupada = fila + j; break; }
    }

    return {
        alturaActual: alturaActual,
        primeraOcupada: primeraOcupada,
        capacidadFilas: primeraOcupada ? (primeraOcupada - fila) : Math.max(0, maxFilas - fila + 1),
        anchoDisponible: anchoDisponible,
        anchoSuficiente: anchoDisponible >= ancho,
        maxFilas: maxFilas
    };
}

// decision Franco 2026-08-13: el veredicto de DERRAME se calcula aca, en el plan, y no en el
// texto del informe. Que viviera solo en _redactarRV era un agujero real: "NO ALCANZA: faltan N
// filas" se imprimia y nadie lo leia como bloqueante, asi que aplicar seguia de largo. Y el
// resultado era peor que no hacer nada, porque la envoltura IFERROR que instala este modulo TAPA
// justamente el #REF! del derrame que no entra: la vista pasa de "rota" a "vacia", que es la
// misma falla pero silenciosa.
/**
 * Clasifica el espacio de derrame de una celda contra el mes mas cargado del ledger.
 * No decide gravedad (eso depende de si la celda se va a tocar): solo describe.
 *
 * @param {Object} det entrada de plan.celdas, ya con det.derrame medido
 * @param {?Object} carga resultado de _mesMasCargadoRV
 * @returns {{ancho: ?Object, filas: Object}}
 */
function _clasificarDerrameRV(det, carga) {
    var d = det.derrame;
    var v = { ancho: null, filas: null };

    if (!d.anchoSuficiente) {
        v.ancho = {
            clase: 'NO_ENTRA',
            gravedad: null,
            texto: 'el bloque derrama ' + det.ancho + ' columnas y desde ' + det.colLetra +
                   ' solo hay ' + d.anchoDisponible + ' en el grid'
        };
    }

    if (!carga || !carga.maxFilas) {
        v.filas = {
            clase: 'SIN_CONTRASTE', gravedad: null, faltan: 0,
            texto: 'SIN CIFRA DE CONTRASTE: no se pudo medir el mes mas cargado, asi que no se puede ' +
                   'afirmar que el bloque entre'
        };
    } else if (d.capacidadFilas < carga.maxFilas) {
        v.filas = {
            clase: 'NO_ALCANZA', gravedad: null, faltan: carga.maxFilas - d.capacidadFilas,
            texto: 'NO ALCANZA: faltan ' + (carga.maxFilas - d.capacidadFilas) + ' fila(s) (hay ' +
                   d.capacidadFilas + ' libres y el mes mas cargado, ' + carga.mesTop + ', trae ' +
                   carga.maxFilas + ' registros)'
        };
    } else if (d.capacidadFilas < carga.maxFilas * RV_MARGEN_MINIMO) {
        v.filas = {
            clase: 'MARGEN_ESCASO', gravedad: null, faltan: 0,
            texto: 'ENTRA HOY PERO JUSTO: margen x' + (d.capacidadFilas / carga.maxFilas).toFixed(2) +
                   ' (' + d.capacidadFilas + ' libres contra ' + carga.maxFilas + ' del mes mas cargado)'
        };
    } else {
        v.filas = {
            clase: 'ALCANZA', gravedad: null, faltan: 0,
            texto: 'ALCANZA (margen x' + (d.capacidadFilas / carga.maxFilas).toFixed(1) + ')'
        };
    }

    return v;
}

// decision Franco 2026-08-13: el criterio de gravedad NO es "hay riesgo" sino "ESTA CORRIDA
// instalaria la mascara sobre ese riesgo". plan.problemas significa exactamente una cosa --
// motivos por los que aplicar ABORTA sin tocar nada -- y una condicion preexistente sobre una
// celda que esta corrida no escribe no pertenece ahi: bloquear por ella dejaria la herramienta
// tomada de rehen por una celda que ni se toca, y asi es como muere un guard. Por eso: bloquea
// si la celda esta PENDIENTE (se la va a envolver), avisa con nombre y consecuencia si no.
/**
 * Traduce el veredicto de derrame en entradas de plan.problemas o plan.avisos.
 *
 * @param {Object} det entrada de plan.celdas, ya clasificada (det.estado) y con det.derrame.veredicto
 * @param {Object} plan
 */
function _evaluarDerrameRV(det, plan) {
    var v = det.derrame.veredicto;
    var donde = det.hoja + '!' + det.celda;
    var seVaAEnvolver = (det.estado === 'PENDIENTE');
    var noSeToca = ' Esta corrida NO escribe esa celda (' + det.estado + '), asi que no bloquea: ' +
                   'queda anotado como riesgo preexistente.';

    if (v.ancho) {
        v.ancho.gravedad = seVaAEnvolver ? 'BLOQUEANTE' : 'AVISO';
        var base = donde + ': ' + v.ancho.texto + '. Ampliar columnas es un cambio estructural fuera ' +
                   'del alcance de este devtool.';
        if (seVaAEnvolver) {
            plan.problemas.push(base + ' Envolverla en IFERROR taparia el #REF! en lugar de resolverlo.');
        } else {
            plan.avisos.push(base + noSeToca);
        }
    }

    var f = v.filas;
    if (f.clase === 'NO_ALCANZA') {
        f.gravedad = seVaAEnvolver ? 'BLOQUEANTE' : 'AVISO';
        var textoFilas = donde + ': espacio de derrame insuficiente en FILAS. ' + f.texto +
                         '. Cuando el selector apunte a ese mes, Sheets no recorta el bloque: lo ' +
                         'tumba entero con #REF!.';
        if (seVaAEnvolver) {
            plan.problemas.push(textoFilas + ' Y el IFERROR que instalaria esta corrida TAPARIA ese ' +
                                '#REF!: la vista se veria VACIA en vez de rota, que es peor porque ' +
                                'nadie se entera. Hacer lugar debajo del bloque antes de aplicar.');
        } else {
            plan.avisos.push(textoFilas + noSeToca);
        }
    } else if (f.clase === 'MARGEN_ESCASO') {
        f.gravedad = 'AVISO';
        plan.avisos.push(donde + ': ' + f.texto + '. No bloquea (hoy entra), pero el ledger crece todos ' +
                         'los meses: conviene hacer lugar antes de chocar la pared.');
    } else if (f.clase === 'SIN_CONTRASTE' && seVaAEnvolver) {
        f.gravedad = 'AVISO';
        plan.avisos.push(donde + ': ' + f.texto + '. Se envuelve igual, pero si el bloque no entrara el ' +
                         'IFERROR taparia el #REF!: verificar el espacio en pantalla despues de aplicar.');
    }
}

/** Normaliza un valor de fecha a clave de mes 'YYYY-MM'. null si no es interpretable. */
function _claveMesRV(valor) {
    if (valor === '' || valor === null || valor === undefined) return null;

    // Duck typing en vez de instanceof Date: instanceof falla contra Date creados en otro realm
    // (cualquier banco de pruebas que instrumente la API de Sheets), y un falso negativo aca
    // subestimaria el mes mas cargado, que es justo la cifra que decide si hay riesgo.
    if (valor && typeof valor.getTime === 'function') {
        if (isNaN(valor.getTime())) return null;
        var mes = valor.getMonth() + 1;
        return valor.getFullYear() + '-' + (mes < 10 ? '0' + mes : String(mes));
    }
    if (typeof valor === 'string') {
        var s = valor.trim();
        var iso = s.match(/^(\d{4})-(\d{2})/);
        if (iso) return iso[1] + '-' + iso[2];
        var dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
        if (dmy) {
            var m2 = parseInt(dmy[2], 10);
            return dmy[3] + '-' + (m2 < 10 ? '0' + m2 : String(m2));
        }
        return null;
    }
    return null;   // seriales crudos, booleanos: no se adivina
}

/**
 * Mide el mes con MAS registros del historico, leyendo el ledger vivo.
 *
 * Es la cifra contra la que se contrasta la capacidad de derrame: no sirve preguntarse "cuantas
 * filas caben" sin saber "cuantas filas pueden llegar a hacer falta". Se calcula, no se
 * hardcodea, porque crece con el uso.
 *
 * @returns {?{mesTop: ?string, maxFilas: number, meses: number, total: number, ilegibles: number}}
 */
function _mesMasCargadoRV(ss) {
    var cfg = RANGES.REGISTROS;
    var hoja = ss.getSheetByName(cfg.sheet);
    if (!hoja) return null;

    var col = _letraAColRV(cfg.columns.fecha);
    var desde = cfg.dataRow;
    var alto = hoja.getMaxRows() - desde + 1;
    if (alto <= 0 || col > hoja.getMaxColumns()) return null;

    var vals = hoja.getRange(desde, col, alto, 1).getValues();
    var conteo = Object.create(null);
    var total = 0;
    var ilegibles = 0;
    var mesTop = null;
    var maxFilas = 0;
    var meses = 0;

    for (var i = 0; i < vals.length; i++) {
        var v = vals[i][0];
        if (v === '' || v === null || v === undefined) continue;
        var k = _claveMesRV(v);
        if (!k) { ilegibles++; continue; }
        total++;
        if (conteo[k] === undefined) { conteo[k] = 0; meses++; }
        conteo[k]++;
        if (conteo[k] > maxFilas) { maxFilas = conteo[k]; mesTop = k; }
    }

    return { mesTop: mesTop, maxFilas: maxFilas, meses: meses, total: total, ilegibles: ilegibles };
}

// ============================================
// ESCANEO INFORMATIVO (NUNCA TOCA NADA)
// ============================================

/**
 * Busca otras QUERY en las hojas de vista y las clasifica. SOLO REPORTA.
 *
 * Las tres clases importan y no son equivalentes:
 *   SIN_IFERROR  - candidata real: ninguna barrera contra el error.
 *   IFERROR_INTERNO - la QUERY esta envuelta por dentro (caso Tablero!AJ10). Puede estar bien
 *                     cubierta o no: lo decide una persona leyendo la formula, no este modulo.
 *   IFERROR_EXTERNO - ya blindada.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object<string,string>} nombres
 * @param {Object<string,boolean>} yaDeclaradas claves 'Hoja!Celda' que ya estan en RV_CELDAS
 * @returns {{hallazgos: Array<Object>, fallos: string[], truncado: boolean}}
 */
function _escanearQueryRV(ss, nombres, yaDeclaradas) {
    var hallazgos = [];
    var fallos = [];
    var truncado = false;

    RV_HOJAS_INSPECCION.forEach(function (clave) {
        var nombre = nombres[clave];
        try {
            var hoja = ss.getSheetByName(nombre);
            if (!hoja) { fallos.push(nombre + ' (no existe)'); return; }

            var rango = hoja.getDataRange();
            var formulas = rango.getFormulas();
            var filaBase = rango.getRow();
            var colBase = rango.getColumn();

            for (var i = 0; i < formulas.length; i++) {
                for (var j = 0; j < formulas[i].length; j++) {
                    var f = formulas[i][j];
                    if (!f || !/QUERY\s*\(/i.test(f)) continue;

                    var celda = _colALetraRV(colBase + j) + (filaBase + i);
                    if (yaDeclaradas[nombre + '!' + celda]) continue;

                    var an = _analizarIferrorRV(f);
                    if (hallazgos.length >= RV_MAX_EXTRAS) { truncado = true; continue; }
                    hallazgos.push({
                        hoja: nombre,
                        celda: celda,
                        clase: an.externo ? 'IFERROR_EXTERNO'
                             : (_tieneIferrorInternoRV(f) ? 'IFERROR_INTERNO' : 'SIN_IFERROR'),
                        largo: f.length
                    });
                }
            }
        } catch (e) {
            logError('_escanearQueryRV: fallo al inspeccionar "' + nombre + '"', e);
            fallos.push(nombre + ' (' + e.message + ')');
        }
    });

    return { hallazgos: hallazgos, fallos: fallos, truncado: truncado };
}

// ============================================
// PLAN / PREFLIGHT
// ============================================

/**
 * Decide que se le va a hacer a una celda declarada y por que. Solo escribe en det y, cuando la
 * celda no es lo que este modulo espera, en plan.problemas. No mira el derrame.
 *
 * @param {Object} det entrada de plan.celdas en construccion (ya con formulaActual)
 * @param {Object} c entrada de RV_CELDAS
 * @param {Object} plan
 * @param {Object<string,string>} nombres
 */
function _clasificarCeldaRV(det, c, plan, nombres) {
    // decision Franco 2026-08-13: una celda VACIA no es drift, es un alta. No hay formula que
    // envolver y este modulo no inventa formulas: los SELECT/WHERE son logica de negocio.
    if (!det.formulaActual) {
        det.estado = 'VACIA';
        det.nota = 'sin formula: nada que envolver (es un alta, no drift)';
        return;
    }

    // Guard de expectativa: la celda tiene que ser lo que este modulo cree que es.
    var esQuery = /QUERY\s*\(/i.test(det.formulaActual);
    var leeLedger = det.formulaActual.indexOf(nombres.registros) !== -1;
    if (!esQuery || !leeLedger) {
        det.estado = 'DRIFT';
        det.nota = 'la formula ' + (!esQuery ? 'no contiene ningun QUERY' : 'no referencia "' + nombres.registros + '"') +
                   ': no es la esperada, no se toca';
        plan.problemas.push(det.hoja + '!' + det.celda + ': ' + det.nota + '.');
        return;
    }

    // Guard anti-drift / idempotencia: si ya esta envuelta, no se toca.
    var an = _analizarIferrorRV(det.formulaActual);
    if (an.desbalanceada) {
        det.estado = 'DRIFT';
        det.nota = 'la formula empieza con IFERROR( pero sus parentesis no cierran: no se interpreta ' +
                   'ni se reescribe algo que no se pudo leer entero';
        plan.problemas.push(det.hoja + '!' + det.celda + ': ' + det.nota + '.');
        return;
    }
    if (an.externo) {
        det.estado = 'YA_PROTEGIDA';
        det.nota = 'ya esta envuelta en IFERROR (' + an.args + ' argumento(s)): se saltea';
        return;
    }

    var env = _envolverIferrorRV(det.formulaActual, c.fallback);
    if (!env.ok) {
        det.estado = 'DRIFT';
        det.nota = env.motivo;
        plan.problemas.push(det.hoja + '!' + det.celda + ': ' + env.motivo);
        return;
    }

    det.estado = 'PENDIENTE';
    det.formulaNueva = env.formula;
    det.cuerpoOriginal = env.cuerpo;
    if (_tieneIferrorInternoRV(det.formulaActual)) {
        plan.avisos.push(det.hoja + '!' + det.celda + ': la formula ya tenia IFERROR ANIDADO. La ' +
                         'envoltura externa se agrega igual (el anidado no cubre el error del QUERY ' +
                         'externo), pero conviene mirarla en pantalla despues de aplicar.');
    }
}

/**
 * Construye el plan completo leyendo la planilla viva. NO ESCRIBE NADA.
 * Es el cuerpo compartido por estadoRobustezVistas() (que solo lo informa) y por
 * aplicarRobustezVistas() (que aborta si trae bloqueantes).
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object} plan
 */
function _planRV(ss) {
    var plan = {
        problemas: [],
        avisos: [],
        hojas: {},
        celdas: [],
        extras: null,
        carga: null,
        estadoGuardado: _leerEstadoRV()
    };

    var nombres = _nombresRV();
    plan.nombres = nombres;

    // Un registro ilegible es bloqueante para todo camino que escriba: ahi vive el puntero al
    // unico respaldo valido.
    if (plan.estadoGuardado && plan.estadoGuardado._corrupto) {
        plan.problemas.push('El registro del devtool en DocumentProperties ("' + RV_PROP_ESTADO +
                            '") es ilegible: no se sabe si hay una corrida sin revertir ni cual es su ' +
                            'respaldo. Resolverlo a mano antes de escribir nada.');
    }

    // --- Hojas de las celdas bajo cirugia ---
    var faltantes = [];
    RV_CELDAS.forEach(function (c) {
        if (Object.prototype.hasOwnProperty.call(plan.hojas, c.hojaClave)) return;
        var hoja = ss.getSheetByName(nombres[c.hojaClave]);
        plan.hojas[c.hojaClave] = hoja;
        if (!hoja) faltantes.push(c.hojaClave + ' ("' + nombres[c.hojaClave] + '")');
    });
    if (faltantes.length) {
        plan.problemas.push('Hojas no encontradas: ' + faltantes.join(', ') + '.');
        return plan;   // sin hojas no hay plan posible
    }

    // --- Mes mas cargado del ledger (referencia del defecto 2) ---
    try {
        plan.carga = _mesMasCargadoRV(ss);
        if (!plan.carga) {
            plan.avisos.push('No se pudo leer "' + nombres.registros + '" para medir el mes mas cargado: ' +
                             'la capacidad de derrame se informa sin cifra contra la cual contrastarla, ' +
                             'asi que NO se puede descartar que algun bloque no entre (y la envoltura ' +
                             'IFERROR taparia ese #REF!). Verificar el espacio en pantalla.');
        } else if (plan.carga.ilegibles) {
            plan.avisos.push(plan.carga.ilegibles + ' fila(s) del ledger tienen fecha ilegible y no entran ' +
                             'al conteo por mes (no se adivina el mes).');
        }
    } catch (e) {
        logError('_planRV: fallo la medicion del mes mas cargado (no critico)', e);
        plan.avisos.push('No se pudo medir el mes mas cargado: ' + e.message + '.');
    }

    // --- Estado celda por celda ---
    var yaDeclaradas = Object.create(null);

    RV_CELDAS.forEach(function (c) {
        var hoja = plan.hojas[c.hojaClave];
        var pos = _a1RV(c.celda);
        var det = {
            hojaClave: c.hojaClave,
            hoja: nombres[c.hojaClave],
            celda: c.celda,
            colLetra: _colALetraRV(pos.col),
            rol: c.rol,
            ancho: c.ancho,
            fallback: c.fallback,
            estado: '',
            nota: '',
            formulaActual: '',
            formulaNueva: '',
            valorAntes: '',
            derrame: null
        };
        yaDeclaradas[det.hoja + '!' + det.celda] = true;

        var rango = hoja.getRange(c.celda);
        det.formulaActual = rango.getFormula();
        det.valorAntes = rango.getDisplayValue();
        det.derrame = _medirDerrameRV(hoja, pos.fila, pos.col, c.ancho);

        // Orden obligatorio: primero se decide QUE se le va a hacer a la celda (det.estado) y
        // recien despues se juzga el derrame, porque la gravedad del derrame depende justamente
        // de si esta corrida la va a envolver o no.
        _clasificarCeldaRV(det, c, plan, nombres);
        det.derrame.veredicto = _clasificarDerrameRV(det, plan.carga);
        _evaluarDerrameRV(det, plan);

        plan.celdas.push(det);
    });

    // --- Escaneo informativo del resto de las vistas ---
    plan.extras = _escanearQueryRV(ss, nombres, yaDeclaradas);
    if (plan.extras.fallos.length) {
        plan.avisos.push('No se pudo inspeccionar: ' + plan.extras.fallos.join(', ') +
                         '. El informe de otras QUERY queda incompleto (no afecta a la cirugia).');
    }

    var pendientes = plan.celdas.filter(function (c) { return c.estado === 'PENDIENTE'; }).length;
    plan.pendientes = pendientes;
    plan.nadaQueHacer = (pendientes === 0);

    return plan;
}

/** Arma el informe humano del plan. */
function _redactarRV(plan) {
    var l = [];
    l.push('ROBUSTEZ DE VISTAS v' + RV_VERSION + ' - ESTADO (lectura, no se escribio ninguna celda)');
    l.push('');

    var eg = plan.estadoGuardado || {};
    if (eg._corrupto) {
        l.push('Registro: ILEGIBLE en DocumentProperties (' + eg._crudo + ').');
        l.push('aplicarRobustezVistas() y revertirRobustezVistas() ABORTAN mientras siga asi.');
    } else if (eg.aplicadaEn || eg.iniciadaEn) {
        l.push('Registro: ' + (eg.aplicadaEn ? 'aplicada el ' + eg.aplicadaEn
                                             : 'iniciada el ' + eg.iniciadaEn + ' y SIN CIERRE') +
               (eg.revertidaEn ? ' / revertida el ' + eg.revertidaEn : '') +
               (eg.intentos > 1 ? ' / ' + eg.intentos + ' intentos' : ''));
        if (eg.respaldo) l.push('Respaldo: "' + eg.respaldo + '" (' + (eg.celdasRespaldadas || 0) + ' formula(s))');
        if (_enVueloRV(eg)) {
            l.push('CORRIDA EN VUELO (sin revertir): una nueva corrida de aplicarRobustezVistas()');
            l.push('reutiliza ese respaldo y no crea uno nuevo. Las celdas que el ciclo ya congelo');
            l.push('NO se vuelven a congelar (primera escritura gana), asi que el punto de retorno');
            l.push('sigue siendo el estado previo a la PRIMERA corrida.');
        }
    } else {
        l.push('Registro: sin aplicacion previa.');
    }
    l.push('(el registro es auditoria; lo que sigue se derivo de la planilla viva)');
    l.push('');

    l.push('1) DEFECTO 1 - QUERY de staging sin IFERROR');
    plan.celdas.forEach(function (c) {
        l.push('   ' + c.hoja + '!' + c.celda + ': ' + c.estado + (c.nota ? ' - ' + c.nota : ''));
        l.push('      rol: ' + c.rol);
        l.push('      valor hoy: "' + c.valorAntes + '"' + (_esErrorRV(c.valorAntes) ? '  <-- LA VISTA SE VE ROTA' : ''));
    });
    l.push('   fallback elegido: ' + (RV_FALLBACK_POR_DEFECTO === null
        ? 'celda EN BLANCO (IFERROR de un argumento). Nunca cero: "no hay datos" y "el dato es cero" ' +
          'son estados distintos, y un texto envenenaria la columna Monto que leen las metricas.'
        : '"' + RV_FALLBACK_POR_DEFECTO + '"'));
    l.push('');

    l.push('2) DEFECTO 2 - espacio de derrame');
    if (plan.carga && plan.carga.maxFilas) {
        l.push('   mes mas cargado del ledger: ' + plan.carga.mesTop + ' con ' + plan.carga.maxFilas +
               ' registros (' + plan.carga.total + ' registros en ' + plan.carga.meses + ' meses).');
    } else {
        l.push('   mes mas cargado: NO MEDIDO (ver avisos).');
    }
    plan.celdas.forEach(function (c) {
        if (!c.derrame) return;
        var d = c.derrame;
        var v = d.veredicto || {};
        var f = v.filas || { texto: 'sin veredicto', gravedad: null };
        l.push('   ' + c.hoja + '!' + c.celda + ' (' + c.ancho + ' columnas): derrama hoy ' + d.alturaActual +
               ' fila(s) | libres hasta ' + (d.primeraOcupada ? 'la fila ' + d.primeraOcupada + ' (primera ocupada)'
                                                              : 'el fin del grid (fila ' + d.maxFilas + ')') +
               ' = ' + d.capacidadFilas + ' | ' + f.texto);
        // El veredicto de filas se imprime CON su gravedad: que este texto no dijera si bloquea o
        // no fue exactamente el agujero -- se leia como informacion de color y aplicar seguia.
        if (f.gravedad === 'BLOQUEANTE') {
            l.push('      ^ BLOQUEANTE: aplicarRobustezVistas() ABORTA. Envolver este bloque taparia ' +
                   'con una celda en blanco el #REF! que produce la falta de espacio.');
        } else if (f.gravedad === 'AVISO') {
            l.push('      ^ AVISO: no bloquea, pero queda anotado (ver la lista de avisos).');
        }
        if (v.ancho) {
            l.push('      ^ ANCHO ' + (v.ancho.gravedad || 'AVISO') + ': ' + v.ancho.texto + '.');
        }
    });
    l.push('');

    if (plan.extras) {
        l.push('3) OTRAS QUERY encontradas en las vistas (SOLO INFORME, no se tocan)');
        if (!plan.extras.hallazgos.length) {
            l.push('   ninguna fuera de la lista declarada.');
        } else {
            plan.extras.hallazgos.forEach(function (h) {
                l.push('   ' + h.hoja + '!' + h.celda + ': ' + h.clase + ' (' + h.largo + ' caracteres)');
            });
            if (plan.extras.truncado) l.push('   [...] informe recortado en ' + RV_MAX_EXTRAS + ' hallazgos.');
        }
        l.push('   hojas EXCLUIDAS del escaneo por estar muertas: ' + RV_HOJAS_MUERTAS.join(', ') +
               ' (cero referencias entrantes; blindarlas seria deuda falsa).');
        l.push('');
    }

    if (plan.avisos.length) {
        l.push('AVISOS (no bloquean):');
        plan.avisos.forEach(function (a) { l.push('   - ' + a); });
        l.push('');
    }

    if (plan.problemas.length) {
        l.push('BLOQUEANTES: aplicarRobustezVistas() ABORTARIA sin tocar nada por:');
        plan.problemas.forEach(function (p) { l.push('   - ' + p); });
    } else if (plan.nadaQueHacer) {
        l.push('VEREDICTO: nada que hacer, todas las celdas declaradas ya estan protegidas.');
    } else {
        l.push('VEREDICTO: aplicable. aplicarRobustezVistas() envolveria ' + plan.pendientes + ' formula(s).');
    }

    return l.join('\n');
}

// ============================================
// RESPALDO (SIEMPRE ANTES DE MUTAR, SIEMPRE VERIFICADO)
// ============================================

/**
 * Congela las formulas a intervenir en DocumentProperties y en una hoja oculta fechada, y las
 * RELEE para verificarlas. Si la copia no coincide, lanza: el llamador aborta ANTES de mutar.
 *
 * Un respaldo que no se releyo no es un respaldo, es una afirmacion.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {Object} plan
 * @param {string} sello
 * @param {GoogleAppsScript.Spreadsheet.Sheet|null} hojaExistente respaldo ya abierto (reintento)
 * @param {boolean} [soloProps] true para NO abrir hoja nueva (la de esta corrida desaparecio)
 * @param {boolean} [preservar] true en un reintento: lo ya congelado en este ciclo NO se pisa
 * @returns {{nombre: ?string, celdas: number, claves: string[], preservadas: string[]}|null}
 *          null si no habia nada que respaldar
 * @throws {Error} si el respaldo no queda verificado
 */
function _respaldarFormulasRV(ss, plan, sello, hojaExistente, soloProps, preservar) {
    var props = PropertiesService.getDocumentProperties();
    var encabezado = ['hoja', 'celda', 'formula original', 'valor mostrado antes', 'sello'];
    var nuevas = [];
    var preservadas = [];
    // Punto de retorno por celda pendiente: lo que revertir DEBE devolver. Una entrada por celda
    // que esta corrida va a mutar, sea recien congelada o heredada de un intento anterior.
    var puntos = [];

    // decision Franco 2026-08-13: PRIMERA ESCRITURA GANA dentro del ciclo. setProperty pisa sin
    // preguntar, y ese era el agujero: en un reintento, una celda que quedo desprotegida (corte a
    // mitad de camino, o alguien que la edito a mano) volvia a congelarse con su formula DE AHORA
    // -- posiblemente ya intervenida o ya cambiada -- y revertir devolvia a ese estado intermedio
    // declarando exito. El dialogo prometia "el punto de retorno sigue siendo el estado previo a
    // la PRIMERA corrida" y era mentira. Ahora lo es de verdad: si el ciclo ya tiene congelada esa
    // celda, se conserva lo congelado y no se apendea una fila duplicada.
    plan.celdas.forEach(function (c) {
        if (c.estado !== 'PENDIENTE') return;
        var clave = _claveFormulaRV(c.hoja, c.celda);
        var yaCongelada = (preservar === true) ? props.getProperty(clave) : null;

        if (yaCongelada !== null && yaCongelada !== undefined && String(yaCongelada) !== '') {
            preservadas.push(c.hoja + '!' + c.celda);
            puntos.push({ hoja: c.hoja, celda: c.celda, formula: String(yaCongelada) });
            return;
        }
        props.setProperty(clave, c.formulaActual);
        puntos.push({ hoja: c.hoja, celda: c.celda, formula: c.formulaActual });
        nuevas.push([c.hoja, c.celda, c.formulaActual, c.valorAntes, sello]);
    });

    if (puntos.length === 0) {
        logInfo('_respaldarFormulasRV: ninguna formula que envolver, no se crea hoja de respaldo.');
        return null;
    }

    var claves = puntos.map(function (p) { return p.hoja + '!' + p.celda; });

    // Verificacion del registro primario (DocumentProperties) antes de seguir. Se verifican TODAS
    // las celdas que se van a mutar, no solo las recien escritas: una celda cuyo punto de retorno
    // heredado no se pueda releer es tan peligrosa como una sin respaldo.
    var malas = [];
    puntos.forEach(function (p) {
        var guardada = props.getProperty(_claveFormulaRV(p.hoja, p.celda));
        if (guardada !== p.formula) {
            malas.push(p.hoja + '!' + p.celda + ' (DocumentProperties)');
        } else if (String(p.formula).charAt(0) !== '=') {
            malas.push(p.hoja + '!' + p.celda + ' (el punto de retorno congelado no es una formula: "' +
                       String(p.formula).substring(0, 40) + '")');
        }
    });

    if (preservadas.length) {
        logInfo('_respaldarFormulasRV: ' + preservadas.length + ' celda(s) ya tenian su formula original ' +
                'congelada en este ciclo y se CONSERVAN (' + preservadas.join(', ') + '): el punto de ' +
                'retorno sigue siendo el estado previo a la primera corrida.');
    }

    if (nuevas.length === 0) {
        if (malas.length) {
            throw new Error('El respaldo no quedo verificado en: ' + malas.join(', ') +
                            '. No se muto ninguna celda de las hojas vivas.');
        }
        logInfo('_respaldarFormulasRV: no hay formulas nuevas que congelar (todas las pendientes ya ' +
                'estaban respaldadas en este ciclo). No se apendea ninguna fila.');
        return {
            nombre: hojaExistente ? hojaExistente.getName() : null,
            celdas: 0, claves: claves, preservadas: preservadas
        };
    }

    if (soloProps === true) {
        if (malas.length) {
            throw new Error('El respaldo no quedo verificado en: ' + malas.join(', ') +
                            '. No se muto ninguna celda de las hojas vivas.');
        }
        logInfo('_respaldarFormulasRV: la hoja de respaldo de esta corrida ya no esta; se registran ' +
                nuevas.length + ' formula(s) SOLO en DocumentProperties y no se abre una hoja nueva ' +
                '(abrirla dejaria fuera de la lista las celdas de la corrida anterior).');
        return { nombre: null, celdas: nuevas.length, claves: claves, preservadas: preservadas };
    }

    var destino = hojaExistente || null;
    var nombre = destino ? destino.getName() : _nombreHojaLibreRV(ss, RV_RESPALDO_PREFIJO + sello);
    var esNueva = !destino;
    if (esNueva) {
        destino = ss.insertSheet(nombre);
        invalidarCacheNombresHojas();   // el cache de nombres del config quedo viejo
    }

    var primeraFila = esNueva ? 1 : Math.max(destino.getLastRow() + 1, 2);
    var bloque = esNueva ? [encabezado].concat(nuevas) : nuevas;
    asegurarCapacidadFilas(destino, primeraFila + bloque.length - 1);

    var rango = destino.getRange(primeraFila, 1, bloque.length, 5);
    rango.setNumberFormat('@');   // texto plano para la VISUALIZACION
    // decision Franco 2026-08-13: el formato '@' NO alcanza. setValues con un string que arranca
    // en "=" lo hace parsear como FORMULA igual, y el respaldo queda VIVO -- recalculandose
    // contra la misma vista que se esta por cambiar. Es la cicatriz que ya pago el modulo de
    // migracion. El apostrofo de _textoLiteralRV fuerza texto y no forma parte del valor.
    rango.setValues(bloque.map(function (fila) {
        return fila.map(_textoLiteralRV);
    }));

    // Verificacion: se relee lo escrito y se exige que NINGUNA celda haya quedado como formula viva.
    SpreadsheetApp.flush();
    var rangoReleido = destino.getRange(primeraFila, 1, bloque.length, 5);
    var releido = rangoReleido.getValues();
    var formulasVivas = rangoReleido.getFormulas();
    bloque.forEach(function (fila, i) {
        for (var cf = 0; cf < 5; cf++) {
            if (formulasVivas[i][cf]) {
                malas.push(fila[0] + '!' + fila[1] + ' (hoja "' + nombre + '", columna ' + (cf + 1) +
                           ': quedo como FORMULA VIVA, no como texto)');
                return;
            }
        }
    });
    bloque.forEach(function (fila, i) {
        for (var c = 0; c < 3; c++) {
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
    logSuccess('Respaldo VERIFICADO de ' + nuevas.length + ' formula(s) en "' + nombre +
               '" y en DocumentProperties.');
    return { nombre: nombre, celdas: nuevas.length, claves: claves, preservadas: preservadas };
}

// decision Franco 2026-08-13: el punto de retorno es el estado previo a la PRIMERA corrida del
// ciclo, y las dos copias tienen que sostener esa afirmacion:
//   - la HOJA de respaldo es append-only, asi que la PRIMERA fila de una celda es, por
//     construccion, la mas vieja: de ahi sale la formula, no solo la direccion. Antes se
//     deduplicaba por hoja/celda pero el valor se leia igual de DocumentProperties, que se pisaba
//     en cada reintento: se elegia la primera celda con la ULTIMA formula. Eso devolvia a un
//     estado intermedio declarando exito.
//   - DocumentProperties ya no se pisa dentro del ciclo (ver _respaldarFormulasRV), asi que
//     ambas fuentes deben coincidir. Si NO coinciden, no se sabe cual es el punto de retorno: se
//     marca conflicto y el llamador aborta sin escribir. Elegir una a dedo seria adivinar y
//     despues afirmar "restaurado y verificado".
// El ciclo se delimita con estado.celdas: sin ese filtro, una propiedad sobreviviente de un ciclo
// anterior haria que revertir escribiera celdas que ESTA corrida nunca toco.
/**
 * Devuelve las celdas que el ciclo vigente respaldo, con su formula original (la mas vieja).
 *
 * @returns {Array<{hoja: string, celda: string, formula: ?string, fuente: string,
 *                  conflicto: ?{respaldo: string, props: string}}>}
 */
function _celdasRegistradasRV(ss, estado, props, nombres) {
    var salida = [];
    var porClave = Object.create(null);

    // Celdas que pertenecen al ciclo vigente. null = registro viejo sin la lista: se cae al
    // comportamiento historico (todas las declaradas).
    var delCiclo = null;
    if (estado && Object.prototype.toString.call(estado.celdas) === '[object Array]' && estado.celdas.length) {
        delCiclo = Object.create(null);
        estado.celdas.forEach(function (k) { delCiclo[String(k)] = true; });
    }

    var hojaResp = estado.respaldo ? ss.getSheetByName(estado.respaldo) : null;
    if (hojaResp) {
        var ultima = hojaResp.getLastRow();
        if (ultima >= 2) {
            var filas = hojaResp.getRange(2, 1, ultima - 1, 3).getValues();
            filas.forEach(function (f) {
                if (!f[0] || !f[1]) return;
                var hoja = String(f[0]);
                var celda = String(f[1]);
                var clave = hoja + '!' + celda;
                if (delCiclo && !delCiclo[clave]) return;   // fila de un ciclo anterior
                if (porClave[clave]) return;                // PRIMERA aparicion = la mas vieja
                var reg = {
                    hoja: hoja, celda: celda, formula: String(f[2]),
                    fuente: 'respaldo "' + estado.respaldo + '" (fila mas antigua)', conflicto: null
                };
                porClave[clave] = reg;
                salida.push(reg);
            });
        }
    }

    // Cruce con DocumentProperties: completa las celdas que la hoja no tiene (respaldo borrado o
    // corrida registrada solo en propiedades) y contrasta las que si tiene.
    var candidatas = delCiclo
        ? Object.keys(delCiclo)
        : RV_CELDAS.map(function (c) { return nombres[c.hojaClave] + '!' + c.celda; });

    candidatas.forEach(function (clave) {
        var corte = clave.lastIndexOf('!');
        if (corte <= 0) return;
        var hoja = clave.substring(0, corte);
        var celda = clave.substring(corte + 1);
        var deProps = props.getProperty(_claveFormulaRV(hoja, celda));
        if (deProps === null || deProps === undefined || String(deProps) === '') return;

        var reg = porClave[clave];
        if (!reg) {
            reg = {
                hoja: hoja, celda: celda, formula: String(deProps),
                fuente: 'DocumentProperties', conflicto: null
            };
            porClave[clave] = reg;
            salida.push(reg);
            return;
        }
        if (!_formulasEquivalentesRV(reg.formula, deProps)) {
            reg.conflicto = { respaldo: String(reg.formula), props: String(deProps) };
        }
    });

    return salida;
}

// ============================================
// OPERACION: CIRUGIA SOBRE LAS FORMULAS VIVAS
// ============================================

/**
 * Escribe las formulas envueltas, hace flush y verifica lo escrito.
 *
 * La verificacion no es "quedo algo escrito": se REABRE la formula escrita, se comprueba que la
 * envoltura sea IFERROR de primer nivel y se compara su primer argumento contra el cuerpo
 * original. Eso es lo que prueba que la cirugia no toco la logica de negocio.
 *
 * Si la verificacion no cierra, se dice "NO SE PUDO CONFIRMAR": la formula YA fue escrita y
 * negarlo seria mentir.
 *
 * @param {Object} plan
 * @returns {{detalle: string, avisos: string[], escritas: number}}
 */
function _aplicarEnvolturasRV(plan) {
    var detalle = [];
    var avisos = [];
    var escritas = 0;

    plan.celdas.forEach(function (c) {
        if (c.estado !== 'PENDIENTE') {
            detalle.push(c.hoja + '!' + c.celda + ': ' + c.estado.toLowerCase() + ', sin cambios.');
            return;
        }
        plan.hojas[c.hojaClave].getRange(c.celda).setFormula(c.formulaNueva);
        escritas++;
        detalle.push(c.hoja + '!' + c.celda + ': envuelta en IFERROR.');
    });

    SpreadsheetApp.flush();

    plan.celdas.forEach(function (c) {
        if (c.estado !== 'PENDIENTE') return;
        var rango = plan.hojas[c.hojaClave].getRange(c.celda);
        var escrita = rango.getFormula();
        var valorDespues = rango.getDisplayValue();

        var an = _analizarIferrorRV(escrita);
        if (!an.externo) {
            avisos.push('NO SE PUDO CONFIRMAR ' + c.hoja + '!' + c.celda + ': lo escrito no se relee como una ' +
                        'envoltura IFERROR de primer nivel. Revisar a mano; el original esta en el respaldo.');
        } else if (!_formulasEquivalentesRV(an.cuerpo, c.cuerpoOriginal)) {
            avisos.push('NO SE PUDO CONFIRMAR ' + c.hoja + '!' + c.celda + ': el cuerpo dentro del IFERROR no ' +
                        'coincide con la formula original (posible normalizacion de locale). Revisar a mano; ' +
                        'el original esta en el respaldo.');
        }

        if (_esErrorRV(valorDespues)) {
            avisos.push('NO SE PUDO CONFIRMAR ' + c.hoja + '!' + c.celda + ': despues de envolverla la celda ' +
                        'sigue mostrando "' + valorDespues + '" (antes: "' + c.valorAntes + '"). Puede ser ' +
                        'recalculo en curso o un error que el IFERROR no cubre: verificar en pantalla.');
        } else if (_esErrorRV(c.valorAntes)) {
            detalle.push(c.hoja + '!' + c.celda + ': el error "' + c.valorAntes + '" desaparecio de la vista.');
        }
    });

    return { detalle: detalle.join(' '), avisos: avisos, escritas: escritas };
}

// ============================================
// FUNCIONES PUBLICAS (MENU)
// ============================================

/**
 * Informa que celdas estan sin proteger y cuanto espacio de derrame hay. NO ESCRIBE NADA.
 * Es lo primero que se corre.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}} ok=false si hay bloqueantes
 */
function estadoRobustezVistas(yaConLock) {
    return _informarResultadoRV('Robustez de vistas - estado', _conLockRV(yaConLock, function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var plan = _planRV(ss);
            var informe = _redactarRV(plan);
            Logger.log(informe);
            _alertaRV('Robustez de vistas - estado', informe);

            if (plan.problemas.length) {
                return {
                    ok: false,
                    error: 'Las vistas no estan en el estado esperado: ' + plan.problemas.length +
                           ' bloqueante(s). aplicarRobustezVistas() abortaria sin tocar nada.',
                    detalle: informe
                };
            }
            return { ok: true, detalle: informe };
        } catch (err) {
            // El error viaja con su STACK: es una funcion de solo lectura y de uso interno, no hay
            // nada sensible que exponer, y sin la linea el diagnostico se hace adivinando.
            logError('estadoRobustezVistas: fallo la lectura del estado', err);
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
 * Envuelve en IFERROR las QUERY de staging desprotegidas.
 *
 * Aborta ANTES de tocar una celda si el plan trae cualquier bloqueante. La confirmacion es
 * obligatoria cuando hay UI; sin UI solo procede si el llamador declara yaConLock (esta siendo
 * conducida por una rutina que ya decidio), nunca por iniciativa propia.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarRobustezVistas(yaConLock) {
    return _informarResultadoRV('Robustez de vistas - NO APLICADA', _conLockRV(yaConLock, function () {
        // progreso.muto se enciende justo antes de la PRIMERA escritura sobre una hoja viva: es lo
        // que le permite al catch de ultima instancia no mentir en ninguna direccion.
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoAplicarRV(progreso, yaConLock === true);
        } catch (err) {
            logError('aplicarRobustezVistas: excepcion no prevista', err);
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
                       '. NO SE PUDO CONFIRMAR el estado de las vistas: correr estadoRobustezVistas() ' +
                       'y, si hace falta, revertirRobustezVistas()' +
                       (progreso.respaldo ? ' (respaldo "' + progreso.respaldo + '")' : '') + '.'
            };
        }
    }));
}

/**
 * Cuerpo de aplicarRobustezVistas(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string}} progreso testigo de si ya se escribio sobre hojas vivas
 * @param {boolean} conducida true si el llamador ya tenia el lock (rutina que ya decidio)
 */
function _cuerpoAplicarRV(progreso, conducida) {
    var ss, plan, informe;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        plan = _planRV(ss);
        informe = _redactarRV(plan);
        Logger.log(informe);
    } catch (err) {
        logError('aplicarRobustezVistas: fallo el preflight', err);
        return { ok: false, error: 'Fallo el preflight: ' + err.message + '. No se escribio nada.' };
    }

    if (plan.problemas.length) {
        _alertaRV('Robustez de vistas - ABORTADA', informe);
        return {
            ok: false,
            error: 'Abortada por preflight, no se toco ninguna celda. Bloqueantes: ' + plan.problemas.join(' | '),
            detalle: informe,
            _avisado: true
        };
    }

    if (plan.nadaQueHacer) {
        _alertaRV('Robustez de vistas', 'Nada que hacer: todas las celdas declaradas ya estan protegidas.\n\n' + informe);
        return { ok: true, detalle: 'Nada que hacer, todas las celdas declaradas ya estan protegidas.\n\n' + informe };
    }

    // --- Confirmacion ---
    var estadoPrevio = plan.estadoGuardado || {};
    var enVuelo = _enVueloRV(estadoPrevio);
    var ui = _uiRV();
    if (ui) {
        var listaPend = plan.celdas
            .filter(function (c) { return c.estado === 'PENDIENTE'; })
            .map(function (c) { return '  - ' + c.hoja + '!' + c.celda; })
            .join('\n');
        var resp = ui.alert(
            'Robustez de vistas' + (enVuelo ? ' (reintento)' : ''),
            'Se van a envolver en IFERROR ' + plan.pendientes + ' formula(s) de la planilla productiva:\n' +
            listaPend + '\n\n' +
            'La formula existente NO se reescribe: se la envuelve tal cual esta.\n' +
            'Ante error devuelven CELDA EN BLANCO (nunca cero).\n\n' +
            (enVuelo
                ? 'REINTENTO sobre la corrida iniciada el ' + estadoPrevio.iniciadaEn + '.\n' +
                  'Se CONSERVA el respaldo original "' + estadoPrevio.respaldo + '": las celdas que este\n' +
                  'ciclo ya congelo NO se vuelven a congelar (su formula original queda como estaba) y\n' +
                  'solo se apendean las que todavia no tenian respaldo. Por eso el punto de retorno\n' +
                  'sigue siendo el estado previo a la PRIMERA corrida, y no un estado intermedio.\n'
                : 'Antes de tocar nada se congela un respaldo verificado (hoja oculta fechada).\n') +
            'Corriste estadoRobustezVistas() y leiste el informe? Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) {
            logInfo('aplicarRobustezVistas: cancelada por el usuario.');
            return { ok: false, error: 'Cancelada por el usuario. No se escribio nada.' };
        }
    } else if (conducida !== true) {
        return {
            ok: false,
            error: 'Sin UI para confirmar una operacion que escribe sobre produccion. ' +
                   'Ejecutar desde el menu tidetrack Dev. No se escribio nada.'
        };
    } else {
        logInfo('aplicarRobustezVistas: sin UI, ejecutada por un llamador que ya tiene el lock.');
    }

    var sello = _selloRV();
    var hechos = [];
    var respaldo = null;
    var celdasRespaldadas = 0;

    // --- RESPALDO CONGELADO Y VERIFICADO ANTES DE MUTAR ---
    // decision Franco 2026-08-13: RESPALDO INMUTABLE. Mientras exista una corrida sin revertir, el
    // respaldo original no se pisa ni se duplica: se le APENDEAN las nuevas filas. Un respaldo
    // nuevo ahi seria la foto de las vistas ya intervenidas, y revertir devolveria a ese estado
    // declarando exito. El punto de retorno es SIEMPRE el de la primera corrida.
    try {
        if (enVuelo) {
            var hojaPrevia = estadoPrevio.respaldo ? ss.getSheetByName(estadoPrevio.respaldo) : null;
            var faltaHoja = !!(estadoPrevio.respaldo && !hojaPrevia);
            if (faltaHoja) {
                hechos.push('aviso: la hoja de respaldo "' + estadoPrevio.respaldo + '" ya no esta; el ' +
                            'registro vive en DocumentProperties y desde ahi se restaura.');
            }
            // preservar=true: lo que este ciclo ya congelo NO se vuelve a congelar.
            var res = _respaldarFormulasRV(ss, plan, sello, hojaPrevia, faltaHoja, true);
            // El puntero solo se MUEVE si antes no habia ninguno (nunca se pisa).
            respaldo = estadoPrevio.respaldo || (res ? res.nombre : null);
            celdasRespaldadas = (estadoPrevio.celdasRespaldadas || 0) + (res ? res.celdas : 0);
            progreso.respaldo = respaldo;

            _guardarEstadoRV({
                respaldo: respaldo,
                celdasRespaldadas: celdasRespaldadas,
                celdas: _unirClavesRV(estadoPrevio.celdas, res ? res.claves : []),
                intentos: (estadoPrevio.intentos || 1) + 1,
                ultimoIntentoEn: new Date().toISOString()
            });
            hechos.push('respaldo: se reutiliza el original "' + respaldo + '" (reintento, no se pisa).');
            if (res && res.preservadas.length) {
                hechos.push('punto de retorno: ' + res.preservadas.length + ' celda(s) ya estaban ' +
                            'congeladas en este ciclo (' + res.preservadas.join(', ') + ') y se ' +
                            'CONSERVAN tal cual: revertir devuelve al estado previo a la PRIMERA corrida, ' +
                            'no al intermedio.');
            }
        } else {
            var res2 = _respaldarFormulasRV(ss, plan, sello, null, false, false);
            respaldo = res2 ? res2.nombre : null;
            celdasRespaldadas = res2 ? res2.celdas : 0;
            progreso.respaldo = respaldo;

            // Se persiste el puntero ANTES de la primera mutacion: si algo corta a mitad de camino,
            // el rastro de donde esta la copia ya quedo guardado.
            _guardarEstadoRV({
                sello: sello,
                respaldo: respaldo,
                celdasRespaldadas: celdasRespaldadas,
                // Ciclo NUEVO: la lista arranca de cero. Sin esto, una propiedad sobreviviente de un
                // ciclo anterior seria restaurada por un revertir que nunca toco esa celda.
                celdas: res2 ? res2.claves : [],
                respaldoVerificadoEn: new Date().toISOString(),
                iniciadaEn: new Date().toISOString(),
                intentos: 1,
                aplicadaEn: null,
                revertidaEn: null
            });
        }
    } catch (err) {
        logError('aplicarRobustezVistas: fallo el respaldo', err);
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

    var resEnv;
    try {
        resEnv = _aplicarEnvolturasRV(plan);
        hechos.push(resEnv.detalle);
    } catch (err) {
        logError('aplicarRobustezVistas: fallo la envoltura de formulas', err);
        _guardarEstadoRV({ pasos: { formulas: 'incierto' } });
        return {
            ok: false,
            error: 'Fallo al envolver las formulas: ' + err.message +
                   '. NO SE PUDO CONFIRMAR cuales quedaron escritas: revisar con estadoRobustezVistas(). ' +
                   'Los originales estan en "' + respaldo + '" y en DocumentProperties; ' +
                   'revertirRobustezVistas() los restaura.',
            detalle: hechos.join('\n')
        };
    }

    _guardarEstadoRV({
        aplicadaEn: new Date().toISOString(),
        revertidaEn: null,
        pasos: { formulas: 'aplicado' },
        formulasEnvueltas: resEnv.escritas
    });

    var salida = ['ROBUSTEZ DE VISTAS v' + RV_VERSION + ' APLICADA'];
    salida.push('');
    hechos.forEach(function (h) { salida.push('  ' + h); });
    salida.push('');
    salida.push('Respaldo (hoja oculta): ' + (respaldo ? '"' + respaldo + '"' : 'solo DocumentProperties') + '.');
    if (resEnv.avisos.length) {
        salida.push('');
        salida.push('VERIFICACION POSTERIOR:');
        resEnv.avisos.forEach(function (a) { salida.push('  - ' + a); });
    }
    if (plan.avisos.length) {
        salida.push('');
        salida.push('AVISOS DEL PLAN:');
        plan.avisos.forEach(function (a) { salida.push('  - ' + a); });
    }
    salida.push('');
    salida.push('Siguiente paso: correr estadoRobustezVistas() de nuevo (debe reportar "nada que hacer") ' +
                'y mover el selector de mes a un mes SIN registros para ver la vista limpia.');

    var texto = salida.join('\n');
    Logger.log(texto);
    _alertaRV('Robustez de vistas aplicada', texto);
    logSuccess('aplicarRobustezVistas: completada. ' + resEnv.escritas + ' formula(s) envueltas.');

    if (resEnv.avisos.length) {
        // Se escribio todo, pero hay verificaciones que no cerraron: ok=false para que ningun
        // llamador de la cadena lo tome por un cierre limpio.
        return {
            ok: false,
            error: 'Aplicada, pero NO SE PUDO CONFIRMAR el resultado de ' + resEnv.avisos.length +
                   ' verificacion(es) posterior(es). Revisar el detalle antes de darla por buena.',
            detalle: texto,
            _avisado: true
        };
    }
    return { ok: true, detalle: texto };
}

/**
 * Restaura las formulas originales desde el respaldo.
 *
 * Restaura solo la superficie que la corrida mutO: las celdas de las que hay registro. Las que
 * estaban vacias, ya protegidas o en drift nunca se tocaron, y darlas por "no restaurables"
 * seria reportar una falla que no existe.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirRobustezVistas(yaConLock) {
    return _informarResultadoRV('Robustez de vistas - NO REVERTIDA', _conLockRV(yaConLock, function () {
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoRevertirRV(progreso, yaConLock === true);
        } catch (err) {
            logError('revertirRobustezVistas: excepcion no prevista', err);
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
                       '. NO SE PUDO CONFIRMAR el estado de las vistas; el respaldo "' + progreso.respaldo +
                       '" sigue intacto. Revisar y reintentar.'
            };
        }
    }));
}

/**
 * Cuerpo de revertirRobustezVistas(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string}} progreso testigo de si ya se escribio sobre hojas vivas
 * @param {boolean} conducida true si el llamador ya tenia el lock (rutina que ya decidio)
 */
function _cuerpoRevertirRV(progreso, conducida) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var estado = _leerEstadoRV();
    var props = PropertiesService.getDocumentProperties();
    var nombres = _nombresRV();

    if (estado._corrupto) {
        return {
            ok: false,
            error: 'El registro del devtool en DocumentProperties es ilegible, asi que no se sabe cual es ' +
                   'el respaldo valido. NO se restaura nada a ciegas. Fragmento crudo: ' + estado._crudo +
                   '. Buscar las hojas ocultas "' + RV_RESPALDO_PREFIJO + '*" (vale la MAS ANTIGUA) y ' +
                   'restaurar a mano.'
        };
    }

    if (!estado.iniciadaEn && !estado.respaldo) {
        return {
            ok: false,
            error: 'No hay registro de una corrida aplicada (DocumentProperties vacio). Si el respaldo ' +
                   'existe, buscar las hojas ocultas "' + RV_RESPALDO_PREFIJO + '*" y restaurar a mano. ' +
                   'No se toco nada.'
        };
    }
    progreso.respaldo = estado.respaldo || null;

    // --- VALIDACION ANTES DE ESCRIBIR UNA SOLA CELDA ---
    var registradas;
    try {
        registradas = _celdasRegistradasRV(ss, estado, props, nombres);
    } catch (err) {
        logError('revertirRobustezVistas: fallo la lectura del respaldo', err);
        return {
            ok: false,
            error: 'No se pudo leer el respaldo: ' + err.message + '. No se escribio ninguna celda.'
        };
    }

    if (!registradas.length) {
        return {
            ok: false,
            error: 'El respaldo no lista ninguna celda: no hay nada que restaurar y no se escribio nada. ' +
                   (estado.respaldo ? 'Revisar la hoja "' + estado.respaldo + '".'
                                    : 'No quedo registro de hoja de respaldo.')
        };
    }

    // Las dos copias del punto de retorno tienen que decir lo mismo. Si discrepan, cual sea el
    // "estado previo a la primera corrida" es justamente lo que no se sabe: restaurar cualquiera
    // de las dos seria elegir a dedo y despues declarar exito.
    var conflictos = registradas.filter(function (r) { return !!r.conflicto; });
    if (conflictos.length) {
        var textoConf = 'REVERSION ABORTADA y NO SE ESCRIBIO NINGUNA CELDA: las dos copias del respaldo ' +
            'no coinciden sobre cual era la formula original, asi que el punto de retorno es desconocido.\n\n' +
            conflictos.map(function (r) {
                return '  ' + r.hoja + '!' + r.celda + '\n' +
                       '    hoja de respaldo (fila mas antigua): ' + String(r.conflicto.respaldo).substring(0, 200) + '\n' +
                       '    DocumentProperties:                  ' + String(r.conflicto.props).substring(0, 200);
            }).join('\n') +
            '\n\nResolver a mano cual es la buena (la hoja de respaldo es append-only: su fila mas ' +
            'antigua suele ser la anterior a todo) y dejar una sola version antes de reintentar.';
        logError('revertirRobustezVistas: copias del respaldo en conflicto, no se restaura', new Error(textoConf));
        _alertaRV('Robustez de vistas - REVERSION ABORTADA', textoConf);
        return { ok: false, error: textoConf, _avisado: true };
    }

    // Un original que no es formula seria un respaldo corrompido (una formula que quedo viva y se
    // guardo evaluada). Restaurar eso escribiria un valor donde habia logica: se aborta.
    var corruptas = registradas.filter(function (r) {
        return !r.formula || String(r.formula).charAt(0) !== '=';
    });
    if (corruptas.length) {
        var textoCorr = 'REVERSION ABORTADA y NO SE ESCRIBIO NINGUNA CELDA: el respaldo guarda originales ' +
                        'que no son formulas en ' + corruptas.map(function (r) { return r.hoja + '!' + r.celda; }).join(', ') +
                        '. Restaurarlos escribiria un valor donde habia una formula. Recuperar desde el ' +
                        'historial de versiones de la planilla.';
        logError('revertirRobustezVistas: respaldo invalido, no se restaura', new Error(textoCorr));
        _alertaRV('Robustez de vistas - REVERSION ABORTADA', textoCorr);
        return { ok: false, error: textoCorr, _avisado: true };
    }

    var ui = _uiRV();
    if (ui) {
        var resp = ui.alert(
            'Revertir robustez de vistas',
            'Se van a restaurar ' + registradas.length + ' formula(s) originales desde ' +
            (estado.respaldo ? '"' + estado.respaldo + '"' : 'DocumentProperties') + ':\n' +
            registradas.map(function (r) { return '  - ' + r.hoja + '!' + r.celda; }).join('\n') + '\n\n' +
            'Punto de retorno: el estado previo a la PRIMERA corrida de este ciclo' +
            ((estado.intentos || 1) > 1 ? ' (hubo ' + estado.intentos + ' intentos; los reintentos no ' +
                                          'volvieron a congelar lo ya congelado)' : '') + '.\n' +
            'Las vistas vuelven a poder mostrar #N/A en un mes sin registros.\n' +
            (estado.revertidaEn ? 'AVISO: esta corrida ya figura revertida el ' + estado.revertidaEn + '.\n' : '') +
            '\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) return { ok: false, error: 'Cancelada por el usuario. No se escribio nada.' };
    } else if (conducida !== true) {
        return { ok: false, error: 'Sin UI para confirmar. Ejecutar desde el menu tidetrack Dev. No se escribio nada.' };
    }

    var restauradas = 0;
    var sinRestaurar = [];
    var hechos = [];

    try {
        progreso.muto = true;
        registradas.forEach(function (r) {
            var hoja = ss.getSheetByName(r.hoja);
            if (!hoja) { sinRestaurar.push(r.hoja + '!' + r.celda + ' (hoja no encontrada)'); return; }
            hoja.getRange(r.celda).setFormula(r.formula);
            restauradas++;
        });
        SpreadsheetApp.flush();
    } catch (err) {
        logError('revertirRobustezVistas: fallo la restauracion', err);
        return {
            ok: false,
            error: 'Fallo al restaurar las formulas: ' + err.message +
                   '. NO SE PUDO CONFIRMAR cuales quedaron con su formula original; el respaldo ' +
                   (estado.respaldo ? '"' + estado.respaldo + '" ' : '') + 'sigue intacto. Revisar y reintentar.'
        };
    }

    // Verificacion posterior: se relee cada celda restaurada. Sin esta lectura, "restauradas"
    // seria una afirmacion sin evidencia, que es justo lo que este modulo no hace.
    var noCuadran = [];
    registradas.forEach(function (r) {
        var hoja = ss.getSheetByName(r.hoja);
        if (!hoja) return;
        var escrita = hoja.getRange(r.celda).getFormula();
        if (!_formulasEquivalentesRV(escrita, r.formula)) {
            noCuadran.push(r.hoja + '!' + r.celda);
        }
    });
    if (noCuadran.length) {
        hechos.push('NO SE PUDO CONFIRMAR la restauracion de: ' + noCuadran.join(', ') +
                    '. Las celdas YA fueron escritas; el respaldo sigue intacto.');
    }
    hechos.push(restauradas + ' formula(s) restauradas' + (noCuadran.length ? ' (verificacion posterior NO conforme)' : ' y verificadas') + '.');

    _guardarEstadoRV({
        revertidaEn: new Date().toISOString(),
        pasos: { formulas: noCuadran.length ? 'revertido sin confirmar' : 'revertido (' + restauradas + ')' }
    });

    var texto = 'ROBUSTEZ DE VISTAS v' + RV_VERSION + ' REVERTIDA\n\n  ' + hechos.join('\n  ') +
        (sinRestaurar.length ? '\n\nSIN RESTAURAR: ' + sinRestaurar.join(', ') + '.' : '') +
        '\n\nEl respaldo NO se borra: hacerlo es una decision manual.';
    Logger.log(texto);
    _alertaRV('Robustez de vistas revertida', texto);

    if (sinRestaurar.length || noCuadran.length) {
        return {
            ok: false,
            error: (sinRestaurar.length ? 'Revertida parcialmente: ' + sinRestaurar.length + ' celda(s) sin restaurar. ' : '') +
                   (noCuadran.length ? 'NO SE PUDO CONFIRMAR ' + noCuadran.length + ' verificacion(es) posterior(es).' : ''),
            detalle: texto,
            _avisado: true
        };
    }
    return { ok: true, detalle: texto };
}
