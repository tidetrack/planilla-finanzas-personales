/**
 * MIGRACION_v0.9.5_LayoutNuevo.js
 * Migracion asistida de la planilla productiva al layout nuevo (v0.9.5).
 *
 * [CONCEPTO DE NEGOCIO]
 * La planilla productiva migro sola al layout nuevo y el codigo desplegado se quedo en el
 * viejo: desde el 2026-03-29 no entra un solo registro al ledger. Adaptar el codigo (piezas
 * 1 y 2 de la v0.9.5) alcanza para que el sistema vuelva a escribir, pero NO alcanza para
 * dejar la planilla sana: quedaron tres heridas fisicas en la hoja que ningun cambio de
 * codigo cura solo.
 *   1. "Tipos de cambio" tiene 41 filas fisicas de grid y datos hasta la 35: seis filas
 *      libres. Es la restriccion de capacidad mas seria del sistema.
 *   2. De las 3.180 cotizaciones historicas sobrevivieron 29 por par (2026-02-20 a
 *      2026-03-20). Las 3.151 restantes siguen vivas en "Tipos de cambio_legacy".
 *   3. Cuatro formulas de las vistas (Tablero, Inicio x2, Cargas) siguen leyendo
 *      "Registros_legacy": muestran una foto congelada, no el ledger vivo.
 * Este modulo es la unica pieza de la v0.9.5 que TOCA LA PLANILLA. Todo lo demas es codigo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6, puntos 3, 6 y 7: toda operacion sobre datos vivos es
 * idempotente, tiene respaldo congelado ANTES de mutar, y las formulas se intervienen por
 * CIRUGIA (se transforma la referencia, jamas se reescribe la formula). De ahi las tres
 * funciones de este modulo, que son un ciclo cerrado y se corren en este orden:
 *   estadoMigracionV095()   -> dice que cambiaria, sin escribir una sola celda. Se corre primero.
 *   aplicarMigracionV095()  -> preflight que aborta sin tocar nada + respaldo + las tres operaciones.
 *   revertirMigracionV095() -> deshace usando el respaldo.
 * La idempotencia NO se apoya en la bandera de DocumentProperties: se deriva de los datos
 * vivos en cada corrida (dedupe por fecha, guard de formula, tamano de grid). La bandera es
 * auditoria y puntero al respaldo, no fuente de verdad -- la planilla viva es la verdad del
 * estado (principio rector del arnes).
 *
 * DOS REGLAS DEL RESPALDO, ambas cicatrices del arnes (seccion 12, puntos 4 y 5):
 *   a. RESPALDO VERIFICADO. Un respaldo que no se releyo no es un respaldo, es una afirmacion.
 *      Tras congelarlo se hace flush y se lo cuenta bloque por bloque contra la hoja viva; si no
 *      coincide, la migracion aborta ANTES de mutar una sola celda. Al revertir se revalida
 *      contra ese conteo registrado, y recien despues se escribe.
 *   b. RESPALDO INMUTABLE. Mientras exista una corrida sin revertir, el respaldo original NO se
 *      pisa ni se duplica: un reintento lo REUTILIZA. Si se creara uno nuevo, seria la foto de
 *      la planilla ya medio migrada y revertir devolveria a ese estado roto declarando exito.
 *
 * Contrato de retorno de las tres funciones publicas: { ok: boolean, detalle?: string,
 * error?: string }. Cuando una falla ocurre DESPUES de haber escrito, el mensaje nunca dice
 * "no se registro" sino "no se pudo confirmar": el modulo no afirma sobre lo que no verifico.
 *
 * MODULO TRANSITORIO: se borra cuando la migracion quede consolidada y las hojas _legacy se
 * den de baja (decision de Franco, no antes de que el gemelo digital confirme dos corridas
 * limpias de procesarCargas sobre el layout nuevo).
 *
 * @see docs/permanente/ARNES_TIDETRACK.md (seccion 6: gobernanza; Fase 2: gemelo digital)
 * @see 00_Config.js (RANGES: layout nuevo verificado en vivo el 2026-08-13)
 * @see 03_SheetManager.js (asegurarCapacidadFilas: unico lugar que amplia grids)
 *
 * @version 0.9.5
 * @since 0.9.5
 * @lastModified 2026-08-13
 */

// ============================================
// CONSTANTES DE LA MIGRACION
// ============================================

var V095_VERSION = '0.9.5';

/** Clave del estado en DocumentProperties. Auditoria + puntero al respaldo, NO fuente de verdad. */
var V095_PROP_ESTADO = 'MIGRACION_V095_ESTADO';

/** Prefijo de las claves que guardan cada formula original verbatim (una por celda). */
var V095_PROP_FORMULA_PREFIJO = 'MIGRACION_V095_FORMULA::';

/** Segundos de espera por el lock del documento. */
var V095_LOCK_MS = 30000;

// decision Franco 2026-08-13: el grid de "Tipos de cambio" se lleva a 2000 filas como minimo.
// El backfill necesita 825 (fila 7 + 819 cotizaciones - 1). 2000 es un numero redondo, auditable
// de un vistazo, que deja ~1175 filas libres = mas de tres anios de serie diaria por delante, y
// cuesta 2000 x 13 = 26.000 celdas sobre un tope de 10.000.000 por planilla: irrelevante.
// La ampliacion la hace asegurarCapacidadFilas() (03_SheetManager), unico lugar del sistema que
// amplia grids; esa funcion suma ademas su GRID_COLCHON_FILAS, asi que la hoja termina en 2200.
var V095_FILAS_GRID_MINIMO = 2000;

// --- Layout LEGACY (origen). Verificado en vivo el 2026-08-13. ---
var V095_LEG_REGISTROS_FILA_HEADER = 2;
var V095_LEG_REGISTROS_FILA_DATOS = 3;
var V095_LEG_TC_FILA_DATOS = 4;

// --- Layout NUEVO (destino). Verificado en vivo el 2026-08-13. ---
var V095_NUE_REGISTROS_FILA_HEADER = 5;
var V095_NUE_REGISTROS_FILA_DATOS = 6;
var V095_NUE_TC_FILA_DATOS = 7;

/** Alias tolerantes a mayusculas para las hojas de respaldo de la migracion (ocultas). */
var V095_ALIAS_REGISTROS_LEGACY = ['Registros_legacy', 'Registros_Legacy'];
var V095_ALIAS_TC_LEGACY = ['Tipos de cambio_legacy', 'Tipos de Cambio_legacy'];

// decision Franco 2026-08-13: las hojas _legacy NO entran a SHEETS del 00_Config.js.
// SHEETS es el SSOT de las hojas PERMANENTES del sistema; estas dos son andamiaje de una
// migracion puntual y se dan de baja con este mismo modulo. Viven aca, resueltas por el mismo
// _resolverNombreHoja() del config (no por un string suelto), para que el SSOT permanente no
// herede nombres que van a dejar de existir.

/**
 * Bloques de "Tipos de cambio": mapeo columna a columna entre el layout legacy y el nuevo.
 * Legacy: ARS=I:J | USD=L:M | AUD=O:P | EUR=R:S (datos desde fila 4).
 * Nuevo:  ARS=B:C | USD=E:F | AUD=H:I | EUR=K:L (datos desde fila 7).
 */
var V095_BLOQUES_TC = [
    { par: 'ARS', tabla: 'TC_ARS', legacyCol: 9,  nuevaCol: 2,  nuevaLetra: 'B' },
    { par: 'USD', tabla: 'TC_USD', legacyCol: 12, nuevaCol: 5,  nuevaLetra: 'E' },
    { par: 'AUD', tabla: 'TC_AUD', legacyCol: 15, nuevaCol: 8,  nuevaLetra: 'H' },
    { par: 'EUR', tabla: 'TC_EUR', legacyCol: 18, nuevaCol: 11, nuevaLetra: 'K' }
];

/**
 * Mapeo semantico columna a columna del ledger. Es la tabla que habilita la cirugia de
 * formulas: se declara CAMPO POR CAMPO (no por aritmetica de offset) justamente para poder
 * auditar que el orden semantico es identico en ambos layouts. Si algun dia dejara de serlo,
 * los indices Col N de los QUERY dejarian de ser equivalentes y habria que remapearlos.
 */
var V095_MAPA_COLUMNAS_REGISTROS = [
    { n: 1,  campo: 'Monto',          legacy: 'I', nuevo: 'B' },
    { n: 2,  campo: 'Tipo',           legacy: 'J', nuevo: 'C' },
    { n: 3,  campo: 'Cuenta',         legacy: 'K', nuevo: 'D' },
    { n: 4,  campo: 'Tipo de Cuenta', legacy: 'L', nuevo: 'E' },
    { n: 5,  campo: 'Medio',          legacy: 'M', nuevo: 'F' },
    { n: 6,  campo: 'Moneda',         legacy: 'N', nuevo: 'G' },
    { n: 7,  campo: 'Fecha',          legacy: 'O', nuevo: 'H' },
    { n: 8,  campo: 'Nota',           legacy: 'P', nuevo: 'I' },
    { n: 9,  campo: 'Valor ARS',      legacy: 'Q', nuevo: 'J' },
    { n: 10, campo: 'Valor USD',      legacy: 'R', nuevo: 'K' },
    { n: 11, campo: 'Valor AUD',      legacy: 'S', nuevo: 'L' },
    { n: 12, campo: 'Valor EUR',      legacy: 'T', nuevo: 'M' }
];

/** Mapeo de filas del ledger: header legacy 2 -> nuevo 5; primer dato legacy 3 -> nuevo 6. */
var V095_MAPA_FILAS_REGISTROS = { '2': '5', '3': '6' };

/**
 * Celdas cuyas formulas leen "Registros_legacy" y deben pasar a leer el ledger vivo.
 * Medido celda por celda sobre la planilla productiva el 2026-08-13.
 */
var V095_CELDAS_FORMULA = [
    { hojaClave: 'tablero', celda: 'AN4' },
    { hojaClave: 'inicio',  celda: 'Y4'  },
    { hojaClave: 'inicio',  celda: 'AM4' },
    { hojaClave: 'cargas',  celda: 'R5'  }
];

/**
 * #REF! literales preexistentes. FUERA DE ALCANCE de la v0.9.5: son deuda anterior a esta
 * migracion, no los produce ni los cura este modulo. Se listan para que aparezcan en el
 * informe y nadie los confunda con un dano nuevo. NO SE TOCAN.
 */
var V095_REF_CONOCIDOS = [
    { hojaClave: 'tablero', rango: 'D706:D707' },
    { hojaClave: 'inicio',  rango: 'D692:D694' }
];

// ============================================
// HELPERS DE INFRAESTRUCTURA
// ============================================

// decision Franco 2026-08-13: yaConLock en las tres publicas porque el lock de Apps Script NO
// es reentrante. Un llamador que ya esta en la seccion critica (un orquestador que encadena
// estado -> aplicar) se colgaria contra si mismo al pedirlo de nuevo.
/**
 * Ejecuta fn bajo el lock del documento, salvo que el llamador ya lo tenga.
 *
 * @param {boolean} yaConLock true si el llamador ya esta dentro de la seccion critica
 * @param {Function} fn cuerpo a ejecutar; debe devolver el contrato {ok, detalle?, error?}
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function _conLockV095(yaConLock, fn) {
    if (yaConLock === true) return fn();

    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(V095_LOCK_MS)) {
        return {
            ok: false,
            error: 'No se pudo tomar el lock del documento en ' + (V095_LOCK_MS / 1000) +
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
function _uiV095() {
    try {
        return SpreadsheetApp.getUi();
    } catch (e) {
        return null;
    }
}

/** Alerta best-effort: en contexto headless no rompe, solo loguea. */
function _alertaV095(titulo, texto) {
    var ui = _uiV095();
    if (!ui) return;
    var recorte = texto.length > 1500
        ? texto.substring(0, 1500) + '\n\n[...] Informe completo en los logs (Ver > Registros).'
        : texto;
    try {
        ui.alert(titulo, recorte, ui.ButtonSet.OK);
    } catch (e) {
        logInfo('_alertaV095: sin UI disponible para "' + titulo + '"');
    }
}

// decision Franco 2026-08-13: cuando estas funciones salen del menu, el objeto que devuelven no
// lo ve nadie: Apps Script descarta el retorno de un item de menu. Un abort silencioso en una
// herramienta de rollback es indistinguible de "no paso nada", asi que todo error llega a
// pantalla. Los caminos que ya mostraron su propio informe se marcan con _avisado para no
// alertar dos veces; la marca se borra antes de devolver, el contrato publico no cambia.
/**
 * Muestra en pantalla el error de un resultado que no fue avisado por su propio camino.
 *
 * @param {string} titulo
 * @param {{ok: boolean, detalle?: string, error?: string, _avisado?: boolean}} r
 * @returns {{ok: boolean, detalle?: string, error?: string}} el mismo objeto, sin la marca interna
 */
function _informarResultadoV095(titulo, r) {
    if (!r) return r;
    if (r.ok === false && r.error && r._avisado !== true) _alertaV095(titulo, r.error);
    delete r._avisado;
    return r;
}

/** Sello temporal 'yyyy-MM-dd_HHmm' en la zona horaria del script. */
function _selloV095() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

// decision Franco 2026-08-13: un estado ILEGIBLE no se trata como "no hay estado". El puntero
// al respaldo vive ahi: darlo por vacio haria que la corrida siguiente congelara un respaldo
// nuevo -- posiblemente sobre una planilla ya mutada -- y perdiera el punto de retorno real.
// Se devuelve marcado con _corrupto y todo camino que escriba aborta antes de tocar nada.
/**
 * Lee el estado guardado.
 *
 * @returns {Object} estado; {} si no hay ninguno; {_corrupto:true, _crudo:string} si es ilegible
 */
function _leerEstadoV095() {
    var crudo = null;
    try {
        crudo = PropertiesService.getDocumentProperties().getProperty(V095_PROP_ESTADO);
        if (!crudo) return {};
        var obj = JSON.parse(crudo);
        if (!obj || typeof obj !== 'object') throw new Error('el estado guardado no es un objeto');
        return obj;
    } catch (e) {
        logError('_leerEstadoV095: estado ILEGIBLE en DocumentProperties', e);
        return { _corrupto: true, _crudo: String(crudo).substring(0, 300) };
    }
}

/** true si hay una corrida aplicada o a medio aplicar que todavia no fue revertida. */
function _migracionEnVueloV095(estado) {
    return !!(estado && estado.iniciadaEn && !estado.revertidaEn);
}

/** Persiste el estado (merge sobre lo existente). Las claves internas (_*) no se persisten. */
function _guardarEstadoV095(parcial) {
    var previo = _leerEstadoV095();
    var estado = {};
    for (var k0 in previo) {
        if (Object.prototype.hasOwnProperty.call(previo, k0) && k0.charAt(0) !== '_') estado[k0] = previo[k0];
    }
    for (var k in parcial) {
        if (Object.prototype.hasOwnProperty.call(parcial, k)) estado[k] = parcial[k];
    }
    estado.version = V095_VERSION;
    PropertiesService.getDocumentProperties().setProperty(V095_PROP_ESTADO, JSON.stringify(estado));
    return estado;
}

/** Clave de propiedad para la formula original de una celda. */
function _claveFormulaV095(hoja, celda) {
    return V095_PROP_FORMULA_PREFIJO + hoja + '::' + celda;
}

/**
 * Normaliza un valor de celda a clave de fecha 'YYYY-MM-DD'.
 * Devuelve null si no es interpretable: el llamador NUNCA descarta en silencio, cuenta y reporta.
 *
 * Trampa conocida: new Date('2024-01-01') parsea a medianoche UTC y, leido en
 * America/Argentina/Buenos_Aires (-03), retrocede un dia. Por eso el string ISO se toma
 * literal, sin construir un Date.
 *
 * @param {*} valor valor crudo de la celda
 * @returns {string|null}
 */
function _claveFechaV095(valor) {
    if (valor === '' || valor === null || valor === undefined) return null;

    // Duck typing en vez de instanceof Date: instanceof falla contra objetos Date creados en
    // otro realm (el caso de cualquier banco de pruebas que instrumente la API de Sheets), y
    // aca un falso negativo no es un bug menor: la fila se contaria como "fecha ilegible" y el
    // preflight abortaria la migracion entera.
    if (valor && typeof valor.getTime === 'function') {
        if (isNaN(valor.getTime())) return null;
        return formatDateISO(valor);   // getters locales: correcto para los Date que devuelve Sheets
    }
    if (typeof valor === 'string') {
        var limpio = valor.trim();
        var iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return iso[0];        // literal, sin pasar por Date
        var d = new Date(limpio);
        if (!isNaN(d.getTime())) return formatDateISO(d);
        return null;
    }
    return null;   // numeros crudos (seriales), booleanos, etc: no se adivina
}

/**
 * Nombres reales de todas las hojas que toca la migracion. Unico lugar donde se resuelven:
 * las permanentes salen del SSOT (SHEETS / NAV_CONFIG), las dos _legacy del resolver de alias.
 *
 * @returns {Object<string,string>} clave interna -> nombre real de la hoja
 */
function _nombresV095() {
    return {
        registros: SHEETS.REGISTROS,
        tiposCambio: SHEETS.TIPOS_CAMBIO,
        cargas: SHEETS.DATA_ENTRY,
        tablero: NAV_CONFIG.SHEETS.TABLERO,
        inicio: NAV_CONFIG.SHEETS.INICIO,
        registrosLegacy: _resolverNombreHoja(V095_ALIAS_REGISTROS_LEGACY),
        tcLegacy: _resolverNombreHoja(V095_ALIAS_TC_LEGACY)
    };
}

/** Devuelve un nombre de hoja libre, agregando sufijo si hace falta. */
function _nombreHojaLibreV095(ss, base) {
    var nombre = base;
    var i = 2;
    while (ss.getSheetByName(nombre)) {
        nombre = base + '_' + i;
        i++;
        if (i > 50) throw new Error('No se pudo encontrar un nombre libre para el respaldo "' + base + '".');
    }
    return nombre;
}

// ============================================
// CIRUGIA DE FORMULAS
// ============================================

/**
 * Transforma SOLO las referencias a la hoja legacy dentro de una formula viva.
 *
 * No genera formula: recibe la formula real, reemplaza el token hoja!rango y devuelve el
 * resto del string intacto. Los SELECT/WHERE/LABEL de los QUERY son logica de negocio que
 * este modulo no conoce ni interpreta, y los separadores de argumento (coma en-US vs punto y
 * coma en el locale es) atraviesan la transformacion sin ser tocados: es exactamente lo que
 * evita la trampa de locale documentada en 07_MiradaInteranual.js.
 *
 * @param {string} formula formula actual, tal como la devuelve getFormula()
 * @param {string} nombreLegacy nombre real de la hoja legacy
 * @param {string} nombreNuevo nombre real de la hoja viva
 * @returns {{ok: boolean, formula: string, referencias: string[], problemas: string[]}}
 */
function _reapuntarFormulaV095(formula, nombreLegacy, nombreNuevo) {
    var referencias = [];
    var problemas = [];

    var esc = nombreLegacy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // g1 prefijo (evita casar un nombre que termina en el nombre legacy), g2 comilla opcional,
    // g3/g5 marcas $, g4 columna, g6 fila; g7..g10 idem para el extremo del rango (opcional).
    var re = new RegExp(
        '(^|[^A-Za-z0-9_])(\'?)' + esc + '\\2!' +
        '(\\$?)([A-Za-z]{1,3})(\\$?)(\\d*)' +
        '(?::(\\$?)([A-Za-z]{1,3})(\\$?)(\\d*))?',
        'g'
    );

    var mapaCol = {};
    V095_MAPA_COLUMNAS_REGISTROS.forEach(function (c) { mapaCol[c.legacy] = c.nuevo; });

    var nueva = formula.replace(re, function (m, pre, comilla, d1, col1, d2, fila1, d3, col2, d4, fila2) {
        var origen = m.substring(pre.length);

        var nCol1 = mapaCol[col1.toUpperCase()];
        if (!nCol1) {
            problemas.push('columna "' + col1 + '" fuera del ledger I:T en la referencia ' + origen +
                           ': no tiene equivalente en el layout nuevo.');
            return m;
        }
        var nCol2 = '';
        if (col2) {
            nCol2 = mapaCol[col2.toUpperCase()];
            if (!nCol2) {
                problemas.push('columna "' + col2 + '" fuera del ledger I:T en la referencia ' + origen +
                               ': no tiene equivalente en el layout nuevo.');
                return m;
            }
        }

        var nFila1 = '';
        if (fila1) {
            nFila1 = V095_MAPA_FILAS_REGISTROS[fila1];
            if (!nFila1) {
                problemas.push('fila ' + fila1 + ' inesperada en la referencia ' + origen +
                               ' (se esperaba 2=header o 3=primer dato): no se mapea a ciegas.');
                return m;
            }
        } else {
            problemas.push('referencia a columna completa (' + origen + '): incluiria titulo y ' +
                           'encabezados del layout nuevo. Requiere decision manual.');
            return m;
        }

        var nFila2 = '';
        if (fila2) {
            nFila2 = V095_MAPA_FILAS_REGISTROS[fila2];
            if (!nFila2) {
                problemas.push('fila ' + fila2 + ' inesperada en el extremo de la referencia ' + origen + '.');
                return m;
            }
        }

        var destino = comilla + nombreNuevo + comilla + '!' + d1 + nCol1 + d2 + nFila1;
        if (col2) destino += ':' + d3 + nCol2 + d4 + nFila2;

        referencias.push(origen + '  ->  ' + destino);
        return pre + destino;
    });

    return {
        ok: problemas.length === 0 && referencias.length > 0,
        formula: nueva,
        referencias: referencias,
        problemas: problemas
    };
}

/** true si la formula ya apunta al ledger vivo con el rango del layout nuevo. */
function _formulaYaMigradaV095(formula, nombreNuevo) {
    var esc = nombreNuevo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('(^|[^A-Za-z0-9_])(\'?)' + esc + '\\2!\\$?[A-Za-z]{1,3}\\$?\\d*');
    return re.test(formula);
}

/** Compara formulas ignorando espacios en blanco (setFormula normaliza el formato). */
function _formulasEquivalentesV095(a, b) {
    return String(a).replace(/\s+/g, '') === String(b).replace(/\s+/g, '');
}

// ============================================
// PLAN / PREFLIGHT
// ============================================

/**
 * Construye el plan completo de la migracion leyendo la planilla viva. NO ESCRIBE NADA.
 * Es el cuerpo compartido por estadoMigracionV095() (que solo lo informa) y por
 * aplicarMigracionV095() (que aborta si trae problemas bloqueantes).
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {Object} plan
 */
function _planV095(ss) {
    var plan = {
        problemas: [],
        avisos: [],
        hojas: {},
        grid: null,
        tc: [],
        formulas: [],
        estadoGuardado: _leerEstadoV095()
    };

    // --- Resolucion de nombres de hoja (todos via SSOT o via el resolver de alias) ---
    var nombres = _nombresV095();
    plan.nombres = nombres;

    var faltantes = [];
    for (var clave in nombres) {
        if (!Object.prototype.hasOwnProperty.call(nombres, clave)) continue;
        var hoja = ss.getSheetByName(nombres[clave]);
        plan.hojas[clave] = hoja;
        if (!hoja) faltantes.push(clave + ' ("' + nombres[clave] + '")');
    }
    if (faltantes.length) {
        plan.problemas.push('Hojas no encontradas: ' + faltantes.join(', ') + '.');
        return plan;   // sin hojas no hay plan posible
    }

    // --- Coherencia con el config desplegado -------------------------------------------
    // Este modulo lleva su propio mapa de layout a proposito: es la herramienta que MUEVE los
    // datos entre dos layouts, y no puede depender del config que esta migrando. Pero el mapa
    // propio se cruza contra RANGES: si el config desplegado no declara el layout nuevo, el
    // backfill escribiria donde el resto del sistema no lee. Eso es un bloqueo, no un aviso.
    var incoherencias = [];
    V095_BLOQUES_TC.forEach(function (b) {
        var cfg = RANGES[b.tabla];
        if (!cfg) { incoherencias.push('RANGES.' + b.tabla + ' no existe'); return; }
        if (cfg.start !== b.nuevaLetra) {
            incoherencias.push('RANGES.' + b.tabla + '.start=' + cfg.start + ' (se espera ' + b.nuevaLetra + ')');
        }
        if (cfg.dataRow !== V095_NUE_TC_FILA_DATOS) {
            incoherencias.push('RANGES.' + b.tabla + '.dataRow=' + cfg.dataRow + ' (se espera ' + V095_NUE_TC_FILA_DATOS + ')');
        }
    });
    var cfgReg = RANGES.REGISTROS;
    if (!cfgReg || cfgReg.start !== 'B' || cfgReg.end !== 'M' ||
        cfgReg.headerRow !== V095_NUE_REGISTROS_FILA_HEADER || cfgReg.dataRow !== V095_NUE_REGISTROS_FILA_DATOS) {
        incoherencias.push('RANGES.REGISTROS no declara B:M / header ' + V095_NUE_REGISTROS_FILA_HEADER +
                           ' / datos ' + V095_NUE_REGISTROS_FILA_DATOS);
    }
    V095_MAPA_COLUMNAS_REGISTROS.forEach(function (c) {
        if (!cfgReg || !cfgReg.columns) return;
        var declarada = cfgReg.columns[_claveConfigCampoV095(c.campo)];
        if (declarada && declarada !== c.nuevo) {
            incoherencias.push('RANGES.REGISTROS.columns para "' + c.campo + '" = ' + declarada +
                               ' (este modulo mapea ' + c.legacy + ' -> ' + c.nuevo + ')');
        }
    });
    if (incoherencias.length) {
        plan.problemas.push('El config desplegado no coincide con el layout nuevo: ' +
                            incoherencias.join('; ') + '. Desplegar primero las piezas 1 y 2 de la v0.9.5.');
    }

    // Un registro ilegible es bloqueante para todo camino que escriba: es donde vive el puntero
    // al unico respaldo valido. Se declara como problema del plan para que aplicar aborte solo.
    if (plan.estadoGuardado && plan.estadoGuardado._corrupto) {
        plan.problemas.push('El registro de la migracion en DocumentProperties ("' + V095_PROP_ESTADO +
                            '") es ilegible: no se sabe si hay una corrida sin revertir ni cual es su ' +
                            'respaldo. Resolverlo a mano antes de escribir nada.');
    }

    // --- Operacion 1: grid de "Tipos de cambio" ----------------------------------------
    var hojaTc = plan.hojas.tiposCambio;
    var hojaTcLeg = plan.hojas.tcLegacy;

    var maxFilasTc = hojaTc.getMaxRows();
    var maxColsTc = hojaTc.getMaxColumns();
    var colMinimaTc = 12;   // L, ultima columna del bloque EUR
    if (maxColsTc < colMinimaTc) {
        plan.problemas.push('"' + nombres.tiposCambio + '" tiene ' + maxColsTc + ' columnas y el bloque EUR ' +
                            'llega a la L (12). Ampliar columnas es un cambio estructural fuera del alcance ' +
                            'de esta migracion: resolver a mano.');
    }

    // --- Operacion 2: backfill de cotizaciones -----------------------------------------
    var ultimaFilaLeg = hojaTcLeg.getLastRow();
    var filasNecesarias = V095_NUE_TC_FILA_DATOS;

    V095_BLOQUES_TC.forEach(function (b) {
        var det = {
            par: b.par,
            nuevaCol: b.nuevaCol,
            nuevaLetra: b.nuevaLetra,
            destino: 0,             // fechas UNICAS ya presentes en el destino
            ultimaFilaDestino: 0,   // ultima fila fisica ocupada hoy (para limpiar la cola exacta)
            legacy: 0,
            agregaria: 0,
            duplicadosDestino: 0,
            conflictos: 0,
            ilegiblesDestino: [],
            ilegiblesLegacy: 0,
            filas: [],
            total: 0
        };

        // Destino: se lee TODO el grid por debajo del header.
        var altoDest = maxFilasTc - V095_NUE_TC_FILA_DATOS + 1;
        var datosDest = altoDest > 0
            ? hojaTc.getRange(V095_NUE_TC_FILA_DATOS, b.nuevaCol, altoDest, 2).getValues()
            : [];

        var mapa = Object.create(null);
        var orden = [];

        datosDest.forEach(function (fila, i) {
            var vacia = (fila[0] === '' || fila[0] === null) && (fila[1] === '' || fila[1] === null);
            if (vacia) return;
            det.ultimaFilaDestino = V095_NUE_TC_FILA_DATOS + i;
            var clave = _claveFechaV095(fila[0]);
            if (!clave) {
                // Fila con contenido pero sin fecha usable: reconstruir el bloque la borraria.
                det.ilegiblesDestino.push(V095_NUE_TC_FILA_DATOS + i);
                return;
            }
            if (mapa[clave]) { det.duplicadosDestino++; return; }   // gana la primera aparicion
            det.destino++;
            mapa[clave] = { fila: [fila[0], fila[1]], origen: 'destino' };
            orden.push(clave);
        });

        // Legacy: superconjunto puro segun la verificacion del 2026-08-13.
        var altoLeg = ultimaFilaLeg - V095_LEG_TC_FILA_DATOS + 1;
        var datosLeg = altoLeg > 0
            ? hojaTcLeg.getRange(V095_LEG_TC_FILA_DATOS, b.legacyCol, altoLeg, 2).getValues()
            : [];

        datosLeg.forEach(function (fila) {
            var vacia = (fila[0] === '' || fila[0] === null) && (fila[1] === '' || fila[1] === null);
            if (vacia) return;
            var clave = _claveFechaV095(fila[0]);
            if (!clave) { det.ilegiblesLegacy++; return; }
            det.legacy++;
            var previo = mapa[clave];
            if (previo) {
                // decision Franco 2026-08-13: ante misma fecha gana el DESTINO (la hoja viva).
                // El backfill solo agrega lo que falta; jamas pisa una cotizacion en produccion.
                if (previo.origen === 'destino' && !_mismoNumeroV095(previo.fila[1], fila[1])) det.conflictos++;
                return;
            }
            mapa[clave] = { fila: [fila[0], fila[1]], origen: 'legacy' };
            orden.push(clave);
            det.agregaria++;
        });

        // Orden descendente por fecha: es la convencion que appendMassive() impone tras cada
        // insercion de TC (sort Z-A) y la que tiene el ledger. La clave ISO ordena como fecha.
        orden.sort(function (a, b2) { return a < b2 ? 1 : (a > b2 ? -1 : 0); });
        det.filas = orden.map(function (c) { return mapa[c].fila; });
        det.total = det.filas.length;

        if (det.ilegiblesDestino.length) {
            plan.problemas.push('Bloque ' + b.par + ': ' + det.ilegiblesDestino.length + ' fila(s) del destino ' +
                                'tienen contenido pero fecha ilegible (fila ' +
                                det.ilegiblesDestino.slice(0, 5).join(', ') + '). Reconstruir el bloque las ' +
                                'perderia: revisarlas a mano antes de aplicar.');
        }
        if (det.ilegiblesLegacy) {
            plan.avisos.push('Bloque ' + b.par + ': ' + det.ilegiblesLegacy + ' fila(s) de la hoja legacy con ' +
                             'fecha ilegible quedan sin migrar (no se adivina el valor).');
        }
        if (det.conflictos) {
            plan.avisos.push('Bloque ' + b.par + ': ' + det.conflictos + ' fecha(s) con cotizacion distinta ' +
                             'entre destino y legacy. Se conserva la del destino.');
        }
        if (det.duplicadosDestino) {
            plan.avisos.push('Bloque ' + b.par + ': ' + det.duplicadosDestino + ' fila(s) duplicadas por fecha en ' +
                             'el destino se colapsan a una (gana la primera de arriba hacia abajo).');
        }

        filasNecesarias = Math.max(filasNecesarias, V095_NUE_TC_FILA_DATOS + det.total - 1);
        plan.tc.push(det);
    });

    plan.grid = {
        maxFilasActual: maxFilasTc,
        maxColumnas: maxColsTc,
        filasNecesarias: filasNecesarias,
        filaObjetivo: Math.max(filasNecesarias, V095_FILAS_GRID_MINIMO),
        ampliaria: Math.max(filasNecesarias, V095_FILAS_GRID_MINIMO) > maxFilasTc
    };

    // --- Operacion 3: re-apuntado de formulas ------------------------------------------
    V095_CELDAS_FORMULA.forEach(function (obj) {
        var hoja = plan.hojas[obj.hojaClave];
        var det = {
            hojaClave: obj.hojaClave,
            hoja: nombres[obj.hojaClave],
            celda: obj.celda,
            estado: '',
            formulaActual: '',
            formulaNueva: '',
            valorAntes: '',
            referencias: [],
            nota: ''
        };
        var rango = hoja.getRange(obj.celda);
        det.formulaActual = rango.getFormula();
        det.valorAntes = rango.getDisplayValue();

        if (!det.formulaActual) {
            // Una celda vacia no es drift: es un alta. No hay formula que re-apuntar y este
            // modulo no inventa formulas (los SELECT/WHERE son logica de negocio).
            det.estado = 'VACIA';
            det.nota = 'sin formula: nada que re-apuntar (no es drift)';
            plan.formulas.push(det);
            return;
        }

        var res = _reapuntarFormulaV095(det.formulaActual, nombres.registrosLegacy, nombres.registros);

        if (res.referencias.length === 0 && res.problemas.length === 0) {
            if (_formulaYaMigradaV095(det.formulaActual, nombres.registros)) {
                det.estado = 'YA_MIGRADA';
                det.nota = 'ya lee el ledger vivo';
            } else {
                det.estado = 'DRIFT';
                det.nota = 'la formula no referencia "' + nombres.registrosLegacy + '" ni "' + nombres.registros +
                           '": no es la esperada, no se toca';
                plan.problemas.push(det.hoja + '!' + det.celda + ': ' + det.nota + '.');
            }
            plan.formulas.push(det);
            return;
        }

        if (res.problemas.length) {
            det.estado = 'DRIFT';
            det.nota = res.problemas.join(' | ');
            plan.problemas.push(det.hoja + '!' + det.celda + ': ' + det.nota);
            plan.formulas.push(det);
            return;
        }

        det.estado = 'PENDIENTE';
        det.formulaNueva = res.formula;
        det.referencias = res.referencias;
        plan.formulas.push(det);
    });

    var pendientes = plan.formulas.filter(function (f) { return f.estado === 'PENDIENTE'; }).length;
    var agregarian = plan.tc.reduce(function (acc, t) { return acc + t.agregaria; }, 0);
    plan.nadaQueHacer = (!plan.grid.ampliaria && agregarian === 0 && pendientes === 0);
    plan.totalAgregaria = agregarian;

    return plan;
}

/** Traduce el nombre de campo humano a la clave usada en RANGES.REGISTROS.columns. */
function _claveConfigCampoV095(campo) {
    var mapa = {
        'Monto': 'monto', 'Tipo': 'tipo', 'Cuenta': 'cuenta', 'Tipo de Cuenta': 'tipo_cuenta',
        'Medio': 'medio', 'Moneda': 'moneda', 'Fecha': 'fecha', 'Nota': 'nota',
        'Valor ARS': 'tc_ars', 'Valor USD': 'tc_usd', 'Valor AUD': 'tc_aud', 'Valor EUR': 'tc_eur'
    };
    return mapa[campo];
}

/** Comparacion numerica tolerante para detectar conflictos de cotizacion. */
function _mismoNumeroV095(a, b) {
    var na = Number(a);
    var nb = Number(b);
    if (isNaN(na) || isNaN(nb)) return String(a) === String(b);
    if (na === nb) return true;
    var escala = Math.max(Math.abs(na), Math.abs(nb), 1);
    return Math.abs(na - nb) / escala < 1e-9;
}

/** Arma el informe humano del plan. */
function _redactarPlanV095(plan) {
    var l = [];
    l.push('MIGRACION v' + V095_VERSION + ' - ESTADO (lectura, no se escribio ninguna celda)');
    l.push('');

    var eg = plan.estadoGuardado || {};
    if (eg._corrupto) {
        l.push('Bandera: ILEGIBLE en DocumentProperties (' + eg._crudo + ').');
        l.push('aplicarMigracionV095() y revertirMigracionV095() ABORTAN mientras siga asi: sin ese');
        l.push('registro no se sabe cual es el respaldo valido.');
    } else if (eg.aplicadaEn || eg.iniciadaEn) {
        l.push('Bandera: ' + (eg.aplicadaEn ? 'aplicada el ' + eg.aplicadaEn : 'iniciada el ' + eg.iniciadaEn +
               ' y SIN CIERRE (corto a mitad de camino)') +
               (eg.revertidaEn ? ' / revertida el ' + eg.revertidaEn : '') +
               (eg.intentos > 1 ? ' / ' + eg.intentos + ' intentos' : ''));
        if (eg.respaldoTc) {
            l.push('Respaldo TC: "' + eg.respaldoTc + '"' +
                   (eg.respaldoConteo ? ' (verificado: ' + V095_BLOQUES_TC.map(function (b) {
                       return b.par + ' ' + eg.respaldoConteo[b.par];
                   }).join(', ') + ')' : ' (sin conteo verificado registrado)'));
        }
        if (eg.respaldoFormulas) l.push('Respaldo formulas: "' + eg.respaldoFormulas + '"');
        if (_migracionEnVueloV095(eg)) {
            l.push('MIGRACION EN VUELO (sin revertir): una nueva corrida de aplicarMigracionV095()');
            l.push('REUTILIZA ese respaldo y no crea uno nuevo. El punto de retorno sigue siendo el');
            l.push('estado previo a la PRIMERA corrida (grid ' + eg.gridPrevio + ').');
        }
    } else {
        l.push('Bandera: sin registro de aplicacion previa.');
    }
    l.push('(la bandera es auditoria; lo que sigue se derivo de la planilla viva)');
    l.push('');

    if (plan.grid) {
        l.push('1) GRID de "' + plan.nombres.tiposCambio + '"');
        l.push('   filas fisicas hoy: ' + plan.grid.maxFilasActual +
               ' | necesarias para el backfill: ' + plan.grid.filasNecesarias +
               ' | objetivo: ' + plan.grid.filaObjetivo);
        l.push('   ' + (plan.grid.ampliaria
            ? 'AMPLIARIA hasta al menos la fila ' + plan.grid.filaObjetivo +
              ' (asegurarCapacidadFilas agrega ademas su colchon).'
            : 'sin cambios: ya hay capacidad suficiente.'));
        l.push('');
    }

    if (plan.tc.length) {
        l.push('2) BACKFILL de cotizaciones (legacy -> hoja viva, dedupe por fecha)');
        plan.tc.forEach(function (t) {
            l.push('   ' + t.par + ' (col ' + t.nuevaLetra + '): destino ' + t.destino +
                   ' + legacy nuevas ' + t.agregaria + ' = ' + t.total + ' filas' +
                   (t.conflictos ? ' | ' + t.conflictos + ' conflicto(s) de valor: gana el destino' : '') +
                   (t.duplicadosDestino ? ' | ' + t.duplicadosDestino + ' duplicado(s) colapsado(s)' : '') +
                   (t.ilegiblesLegacy ? ' | ' + t.ilegiblesLegacy + ' legacy sin fecha usable' : ''));
        });
        l.push('   orden de escritura: descendente por fecha (misma convencion que appendMassive).');
        l.push('');
    }

    if (plan.formulas.length) {
        l.push('3) FORMULAS que leen la hoja legacy');
        plan.formulas.forEach(function (f) {
            l.push('   ' + f.hoja + '!' + f.celda + ': ' + f.estado + (f.nota ? ' - ' + f.nota : ''));
            f.referencias.forEach(function (r) { l.push('      ' + r); });
        });
        l.push('');
    }

    l.push('#REF! preexistentes FUERA DE ALCANCE (deuda previa, no se tocan):');
    V095_REF_CONOCIDOS.forEach(function (r) {
        l.push('   ' + (plan.nombres ? plan.nombres[r.hojaClave] : r.hojaClave) + '!' + r.rango);
    });
    l.push('');

    if (plan.avisos.length) {
        l.push('AVISOS (no bloquean):');
        plan.avisos.forEach(function (a) { l.push('   - ' + a); });
        l.push('');
    }

    if (plan.problemas.length) {
        l.push('BLOQUEANTES: aplicarMigracionV095() ABORTARIA sin tocar nada por:');
        plan.problemas.forEach(function (p) { l.push('   - ' + p); });
    } else if (plan.nadaQueHacer) {
        l.push('VEREDICTO: nada que hacer, la planilla ya esta en el estado objetivo.');
    } else {
        l.push('VEREDICTO: aplicable. aplicarMigracionV095() agregaria ' + plan.totalAgregaria +
               ' cotizaciones y re-apuntaria ' +
               plan.formulas.filter(function (f) { return f.estado === 'PENDIENTE'; }).length + ' formula(s).');
    }

    return l.join('\n');
}

// ============================================
// RESPALDOS (SIEMPRE ANTES DE MUTAR, SIEMPRE VERIFICADOS)
// ============================================

/** Huella comparable de una celda: las fechas se normalizan a ISO, el resto a string. */
function _huellaCeldaV095(valor) {
    if (valor === '' || valor === null || valor === undefined) return '';
    if (valor && typeof valor.getTime === 'function') {
        return isNaN(valor.getTime()) ? 'fecha-invalida' : formatDateISO(valor);
    }
    return String(valor);
}

// decision Franco 2026-08-13: la verificacion de un respaldo se hace CONTANDO Y COMPARANDO,
// no interpretando. Contar filas con dato por bloque y comparar la primera fila de cada uno
// no depende de fechas legibles ni de tipos: un copyTo que no puebla se detecta igual.
/**
 * Cuenta las filas con dato de cada bloque de par en una hoja con el layout NUEVO de
 * "Tipos de cambio" (B:C / E:F / H:I / K:L, datos desde V095_NUE_TC_FILA_DATOS).
 * Sirve para la hoja viva y para cualquier respaldo suyo: ambas comparten geometria.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 * @returns {{porPar: Object<string,number>, muestra: Object<string,string>, ultimaFila: number,
 *           total: number, columnasSuficientes: boolean, maxFilas: number}}
 */
function _contarBloquesTcV095(hoja) {
    // decision Franco 2026-08-13: guard de argumento. Esta funcion tiene cinco llamadores y
    // recibe hojas que salen de getSheetByName (null si no existe) o de variables que pueden
    // quedar sin asignar. Sin este guard el sintoma es un
    // "TypeError: Cannot read properties of undefined (reading 'getMaxRows')" que no dice
    // NADA de que hoja falta -- fue exactamente lo que vio Franco al correr el estado.
    if (!hoja || typeof hoja.getMaxRows !== 'function') {
        throw new Error('_contarBloquesTcV095 recibio una hoja invalida (' +
                        (hoja === null ? 'null' : typeof hoja) + '). ' +
                        'Suele significar que la hoja de tipos de cambio o su respaldo no existe ' +
                        'con el nombre esperado.');
    }
    var maxFilas = hoja.getMaxRows();
    var maxCols = hoja.getMaxColumns();
    var salida = {
        porPar: {}, muestra: {}, ultimaFila: 0, total: 0,
        columnasSuficientes: maxCols >= 12, maxFilas: maxFilas
    };
    var alto = maxFilas - V095_NUE_TC_FILA_DATOS + 1;

    V095_BLOQUES_TC.forEach(function (b) {
        salida.porPar[b.par] = 0;
        salida.muestra[b.par] = '';
        if (alto <= 0 || maxCols < b.nuevaCol + 1) return;
        var datos = hoja.getRange(V095_NUE_TC_FILA_DATOS, b.nuevaCol, alto, 2).getValues();
        datos.forEach(function (fila, i) {
            var vacia = (fila[0] === '' || fila[0] === null || fila[0] === undefined) &&
                        (fila[1] === '' || fila[1] === null || fila[1] === undefined);
            if (vacia) return;
            salida.porPar[b.par]++;
            salida.total++;
            var filaFisica = V095_NUE_TC_FILA_DATOS + i;
            if (filaFisica > salida.ultimaFila) salida.ultimaFila = filaFisica;
            if (!salida.muestra[b.par]) {
                salida.muestra[b.par] = _huellaCeldaV095(fila[0]) + ' / ' + _huellaCeldaV095(fila[1]);
            }
        });
    });
    return salida;
}

/**
 * Valida que una hoja de respaldo de "Tipos de cambio" siga siendo el respaldo que se
 * verifico al crearla. NO ESCRIBE NADA: es lo que se corre antes de restaurar.
 *
 * El criterio NO puede ser "el respaldo tiene al menos tantas filas como la hoja viva":
 * en una reversion legitima la hoja viva tiene MAS filas (son las que el backfill agrego).
 * El criterio es la identidad con el conteo que quedo registrado cuando el respaldo se
 * verifico celda a celda. Si no hay conteo registrado (respaldo de una version anterior),
 * no se puede afirmar: se exige que no este vacio y se avisa que la comparacion no se hizo.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hojaResp
 * @param {Object<string,number>|null} conteoRegistrado conteo por par guardado al respaldar
 * @returns {{ok: boolean, problemas: string[], avisos: string[], conteo: Object}}
 */
function _validarRespaldoTcV095(hojaResp, conteoRegistrado) {
    var problemas = [];
    var avisos = [];
    if (!hojaResp || typeof hojaResp.getMaxRows !== 'function') {
        return {
            ok: false,
            problemas: ['la hoja de respaldo referenciada en el registro no existe en la planilla ' +
                        '(pudo renombrarse o eliminarse a mano). No hay punto de retorno verificable.'],
            avisos: avisos,
            conteo: { porPar: {}, muestra: {}, ultimaFila: 0, total: 0, columnasSuficientes: false, maxFilas: 0 }
        };
    }
    var conteo = _contarBloquesTcV095(hojaResp);

    if (!conteo.columnasSuficientes) {
        problemas.push('la hoja de respaldo "' + hojaResp.getName() + '" tiene ' + hojaResp.getMaxColumns() +
                       ' columnas y el bloque EUR llega a la L (12).');
    }
    if (conteo.maxFilas < V095_NUE_TC_FILA_DATOS) {
        problemas.push('la hoja de respaldo "' + hojaResp.getName() + '" no llega ni a la fila ' +
                       V095_NUE_TC_FILA_DATOS + ' (primera fila de datos).');
    }

    if (conteoRegistrado) {
        V095_BLOQUES_TC.forEach(function (b) {
            var esperado = conteoRegistrado[b.par];
            if (esperado === undefined || esperado === null) {
                avisos.push('bloque ' + b.par + ': el registro del respaldo no guardo su conteo.');
                return;
            }
            if (conteo.porPar[b.par] !== esperado) {
                problemas.push('bloque ' + b.par + ': el respaldo tenia ' + esperado + ' fila(s) con dato ' +
                               'cuando se verifico y ahora tiene ' + conteo.porPar[b.par] +
                               ': la hoja de respaldo fue alterada.');
            }
        });
    } else {
        avisos.push('el respaldo no tiene conteo registrado (fue creado por una version anterior del ' +
                    'modulo): no se puede comparar contra el momento en que se congelo.');
        if (conteo.total === 0) {
            problemas.push('el respaldo no tiene una sola fila con dato en ninguno de los cuatro bloques.');
        }
    }

    return { ok: problemas.length === 0, problemas: problemas, avisos: avisos, conteo: conteo };
}

/**
 * Congela "Tipos de cambio" en una hoja nueva, fechada y oculta, copiando SOLO VALORES,
 * y LO RELEE para verificarlo. Si la copia no coincide con la hoja viva, lanza: no existe
 * "respaldo hecho" sin lectura de vuelta, porque un copyTo que no puebla devuelve exito igual.
 * Se corre antes de ampliar el grid y antes de escribir una sola cotizacion.
 *
 * @returns {{nombre: string, conteo: Object<string,number>, ultimaFila: number, total: number}}
 * @throws {Error} si la copia no queda verificada (el llamador aborta ANTES de mutar)
 */
function _respaldarTiposCambioV095(ss, hojaTc, sello) {
    var vivo = _contarBloquesTcV095(hojaTc);

    var nombre = _nombreHojaLibreV095(ss, 'RESP_TC_v095_' + sello);
    var destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();   // el cache de nombres del config quedo viejo

    var filas = hojaTc.getMaxRows();
    var cols = hojaTc.getMaxColumns();
    if (destino.getMaxRows() < filas) destino.insertRowsAfter(destino.getMaxRows(), filas - destino.getMaxRows());
    if (destino.getMaxColumns() < cols) destino.insertColumnsAfter(destino.getMaxColumns(), cols - destino.getMaxColumns());

    var origenRango = hojaTc.getRange(1, 1, filas, cols);
    var destinoRango = destino.getRange(1, 1, filas, cols);
    origenRango.copyTo(destinoRango, SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);
    try {
        // Cosmetico: sin el formato, las fechas se ven como seriales. Nunca bloquea el respaldo.
        origenRango.copyTo(destinoRango, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    } catch (e) {
        logInfo('_respaldarTiposCambioV095: no se pudo copiar el formato al respaldo (cosmetico): ' + e.message);
    }

    // --- VERIFICACION: se relee la copia. Sin esto, "respaldo" es una afirmacion sin evidencia.
    SpreadsheetApp.flush();
    var copia = _contarBloquesTcV095(destino);

    var fallas = [];
    if (!copia.columnasSuficientes) {
        fallas.push('la copia quedo con ' + destino.getMaxColumns() + ' columnas y el bloque EUR llega a la L (12)');
    }
    V095_BLOQUES_TC.forEach(function (b) {
        if (copia.porPar[b.par] !== vivo.porPar[b.par]) {
            fallas.push('bloque ' + b.par + ': la hoja viva tiene ' + vivo.porPar[b.par] +
                        ' fila(s) con dato y la copia ' + copia.porPar[b.par]);
        } else if (vivo.porPar[b.par] > 0 && copia.muestra[b.par] !== vivo.muestra[b.par]) {
            fallas.push('bloque ' + b.par + ': la primera fila de la copia ("' + copia.muestra[b.par] +
                        '") no coincide con la de la hoja viva ("' + vivo.muestra[b.par] + '")');
        }
    });

    if (fallas.length) {
        // La hoja se deja VISIBLE: hay que poder mirarla para entender que paso.
        throw new Error('El respaldo de "' + hojaTc.getName() + '" quedo en "' + nombre +
                        '" pero NO VERIFICA contra la hoja viva: ' + fallas.join('; ') +
                        '. No se muto ninguna celda de la hoja viva.');
    }

    destino.hideSheet();
    logSuccess('Respaldo congelado y VERIFICADO de "' + hojaTc.getName() + '" en "' + nombre + '" (' +
               filas + 'x' + cols + ', solo valores; ' + copia.total + ' filas con dato).');
    return { nombre: nombre, conteo: copia.porPar, ultimaFila: copia.ultimaFila, total: copia.total };
}

/**
 * Guarda las formulas originales verbatim: en DocumentProperties (registro primario que usa
 * revertirMigracionV095) y en una hoja fechada oculta (copia auditable que sobrevive a un
 * borrado de propiedades). Las formulas se escriben como TEXTO: la columna se formatea '@'
 * antes del setValues para que Sheets no interprete el '=' inicial. Ambos registros se
 * RELEEN antes de darlos por buenos.
 *
 * Si ya hay una hoja de respaldo de esta misma migracion (reintento tras un corte), las filas
 * nuevas se APENDEAN a ella en vez de abrir una hoja nueva: el puntero del estado no se mueve
 * y la lista de celdas a restaurar sigue siendo la union de todas las corridas.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet|null} hojaExistente hoja de respaldo ya abierta, si la hay
 * @param {boolean} [soloProps] true para NO abrir hoja nueva (la de esta migracion desaparecio:
 *        abrir otra moveria el puntero a una lista parcial y las celdas de la primera corrida
 *        quedarian sin restaurar; DocumentProperties ya las tiene a todas)
 * @returns {{nombre: ?string, celdas: number}|null} null si no habia ninguna formula que respaldar
 * @throws {Error} si el registro no queda verificado (el llamador aborta ANTES de mutar)
 */
/**
 * Devuelve el valor listo para escribirse como TEXTO LITERAL en una celda.
 *
 * Sheets parsea todo string que arranque con "=", "+", "-", "@" o "'". En un respaldo eso es
 * inaceptable: la formula respaldada quedaria viva y se recalcularia contra la hoja que la
 * migracion esta por cambiar. El apostrofo inicial es la marca de texto de Sheets y NO forma
 * parte del valor almacenado: getValue() devuelve el string sin el.
 *
 * @param {*} v
 * @returns {string}
 */
function _textoLiteralV095(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return /^[=+\-@']/.test(s) ? "'" + s : s;
}

function _respaldarFormulasV095(ss, plan, sello, hojaExistente, soloProps) {
    var props = PropertiesService.getDocumentProperties();
    var encabezado = ['hoja', 'celda', 'formula original', 'valor mostrado antes', 'sello'];
    var nuevas = [];

    plan.formulas.forEach(function (f) {
        if (f.estado !== 'PENDIENTE') return;
        props.setProperty(_claveFormulaV095(f.hoja, f.celda), f.formulaActual);
        nuevas.push([f.hoja, f.celda, f.formulaActual, f.valorAntes, sello]);
    });

    if (nuevas.length === 0) {
        logInfo('_respaldarFormulasV095: ninguna formula a re-apuntar, no se crea hoja de respaldo.');
        return null;
    }

    // Verificacion del registro primario (DocumentProperties) antes de seguir.
    var malas = [];
    nuevas.forEach(function (fila) {
        var guardada = props.getProperty(_claveFormulaV095(fila[0], fila[1]));
        if (guardada !== fila[2]) malas.push(fila[0] + '!' + fila[1] + ' (DocumentProperties)');
    });

    if (soloProps === true) {
        if (malas.length) {
            throw new Error('El respaldo de formulas no quedo verificado en: ' + malas.join(', ') +
                            '. No se muto ninguna celda de las hojas vivas.');
        }
        logInfo('_respaldarFormulasV095: la hoja de respaldo de esta migracion ya no esta; se registran ' +
                nuevas.length + ' formula(s) SOLO en DocumentProperties y no se abre una hoja nueva ' +
                '(abrirla dejaria fuera de la lista las celdas de la corrida anterior).');
        return { nombre: null, celdas: nuevas.length };
    }

    var destino = hojaExistente || null;
    var nombre = destino ? destino.getName() : _nombreHojaLibreV095(ss, 'RESP_FORMULAS_v095_' + sello);
    var esNueva = !destino;
    if (esNueva) {
        destino = ss.insertSheet(nombre);
        invalidarCacheNombresHojas();
    }

    var primeraFila = esNueva ? 1 : Math.max(destino.getLastRow() + 1, 2);
    var bloque = esNueva ? [encabezado].concat(nuevas) : nuevas;
    asegurarCapacidadFilas(destino, primeraFila + bloque.length - 1);

    var rango = destino.getRange(primeraFila, 1, bloque.length, 5);
    rango.setNumberFormat('@');   // texto plano para la VISUALIZACION
    // decision Franco 2026-08-13: el formato '@' NO alcanza. setValues con un string que
    // arranca en "=" lo hace parsear como FORMULA igual, asi que la celda quedaba con la
    // formula VIVA (recalculandose contra Registros_legacy: un respaldo que se corrompe solo,
    // cicatriz 4 del arnes) y la relectura devolvia el resultado evaluado en vez del texto.
    // Ese fue el fallo real del primer intento de aplicar: "no quedo verificado ... columna 3".
    // El apostrofo fuerza texto y NO forma parte del valor -- getValue() lo devuelve sin el --,
    // asi que la verificacion sigue comparando contra el string original sin traducciones.
    rango.setValues(bloque.map(function (fila) {
        return fila.map(_textoLiteralV095);
    }));

    // Verificacion de la copia auditable: se relee lo escrito, celda por celda, y se exige
    // ademas que NINGUNA celda haya quedado como formula viva.
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
        throw new Error('El respaldo de formulas no quedo verificado en: ' + malas.join(', ') +
                        '. No se muto ninguna celda de las hojas vivas.');
    }

    if (esNueva) destino.hideSheet();
    logSuccess('Respaldo VERIFICADO de ' + nuevas.length + ' formula(s) en "' + nombre +
               '" y en DocumentProperties.');
    return { nombre: nombre, celdas: nuevas.length };
}

// ============================================
// OPERACIONES
// ============================================

/** Operacion 1: amplia el grid de "Tipos de cambio" hasta el objetivo. Idempotente por tamano. */
function _aplicarGridV095(plan) {
    if (!plan.grid.ampliaria) {
        return 'grid: sin cambios (ya tiene ' + plan.grid.maxFilasActual + ' filas, alcanza para ' +
               plan.grid.filasNecesarias + ').';
    }
    var agregadas = asegurarCapacidadFilas(plan.hojas.tiposCambio, plan.grid.filaObjetivo);
    return 'grid: ampliado de ' + plan.grid.maxFilasActual + ' a ' +
           plan.hojas.tiposCambio.getMaxRows() + ' filas (+' + agregadas + ').';
}

/**
 * Operacion 2: backfill de cotizaciones. Un unico setValues por par, con las filas ya
 * deduplicadas por fecha y ordenadas descendente. Idempotente: en una segunda corrida todas
 * las fechas del legacy ya existen en el destino y el resultado es identico.
 */
function _aplicarBackfillV095(plan) {
    var hojaTc = plan.hojas.tiposCambio;
    var detalle = [];

    // Capacidad de TODOS los bloques antes de escribir el PRIMERO: si el grid no alcanza, el
    // corte tiene que ocurrir con cero cotizaciones escritas, no con dos pares migrados y dos no.
    var filaMasAlta = V095_NUE_TC_FILA_DATOS;
    plan.tc.forEach(function (t) {
        if (t.total === 0) return;
        filaMasAlta = Math.max(filaMasAlta, V095_NUE_TC_FILA_DATOS + t.filas.length - 1);
    });
    if (hojaTc.getMaxRows() < filaMasAlta) {
        asegurarCapacidadFilas(hojaTc, filaMasAlta);   // unico lugar del sistema que amplia grids
    }

    plan.tc.forEach(function (t) {
        if (t.total === 0) {
            detalle.push(t.par + ': sin filas para escribir.');
            return;
        }

        // Formatos de la primera fila de datos preexistente: se propagan a lo escrito para que
        // las fechas no aparezcan como numeros de serie en las filas recien creadas.
        var fmtFecha = null;
        var fmtCotiz = null;
        try {
            if (t.destino > 0) {
                fmtFecha = hojaTc.getRange(V095_NUE_TC_FILA_DATOS, t.nuevaCol).getNumberFormat();
                fmtCotiz = hojaTc.getRange(V095_NUE_TC_FILA_DATOS, t.nuevaCol + 1).getNumberFormat();
            }
        } catch (e) {
            logInfo('_aplicarBackfillV095: no se pudo leer el formato del bloque ' + t.par + ' (cosmetico): ' + e.message);
        }

        // Escribir PRIMERO y limpiar la cola despues: no existe un instante en el que el bloque
        // este vacio. La cola solo puede quedar si el dedupe colapso duplicados.
        var rango = hojaTc.getRange(V095_NUE_TC_FILA_DATOS, t.nuevaCol, t.filas.length, 2);
        rango.setValues(t.filas);

        var ultimaEscrita = V095_NUE_TC_FILA_DATOS + t.filas.length - 1;
        if (t.ultimaFilaDestino > ultimaEscrita) {
            hojaTc.getRange(ultimaEscrita + 1, t.nuevaCol, t.ultimaFilaDestino - ultimaEscrita, 2).clearContent();
        }

        if (fmtFecha) {
            try {
                hojaTc.getRange(V095_NUE_TC_FILA_DATOS, t.nuevaCol, t.filas.length, 1).setNumberFormat(fmtFecha);
                hojaTc.getRange(V095_NUE_TC_FILA_DATOS, t.nuevaCol + 1, t.filas.length, 1).setNumberFormat(fmtCotiz);
            } catch (e) {
                logInfo('_aplicarBackfillV095: no se pudo propagar el formato del bloque ' + t.par + ': ' + e.message);
            }
        }

        detalle.push(t.par + ': ' + t.filas.length + ' filas escritas (+' + t.agregaria + ' nuevas).');
        logSuccess('Backfill ' + t.par + ': ' + t.filas.length + ' filas (agregadas ' + t.agregaria + ').');
    });

    return detalle.join(' ');
}

/**
 * Operacion 3: cirugia sobre las formulas vivas. Escribe la formula transformada, hace flush y
 * verifica lo escrito. Si la verificacion no cierra, lo dice como "no se pudo confirmar":
 * la formula YA fue escrita, negarlo seria mentir.
 */
function _aplicarFormulasV095(plan) {
    var detalle = [];
    var avisos = [];

    plan.formulas.forEach(function (f) {
        if (f.estado !== 'PENDIENTE') {
            detalle.push(f.hoja + '!' + f.celda + ': ' + f.estado.toLowerCase() + ', sin cambios.');
            return;
        }
        plan.hojas[f.hojaClave].getRange(f.celda).setFormula(f.formulaNueva);
        detalle.push(f.hoja + '!' + f.celda + ': re-apuntada.');
    });

    SpreadsheetApp.flush();

    // Verificacion posterior a la escritura (no reemplaza al respaldo: lo complementa).
    plan.formulas.forEach(function (f) {
        if (f.estado !== 'PENDIENTE') return;
        var rango = plan.hojas[f.hojaClave].getRange(f.celda);
        var escrita = rango.getFormula();
        var valorDespues = rango.getDisplayValue();

        if (!_formulasEquivalentesV095(escrita, f.formulaNueva)) {
            avisos.push('NO SE PUDO CONFIRMAR ' + f.hoja + '!' + f.celda + ': la formula quedo escrita pero ' +
                        'difiere de la esperada (posible normalizacion de locale). Revisar a mano; el original ' +
                        'esta en el respaldo.');
        }
        var eraError = String(f.valorAntes).charAt(0) === '#';
        var esError = String(valorDespues).charAt(0) === '#';
        if (esError && !eraError) {
            avisos.push('NO SE PUDO CONFIRMAR ' + f.hoja + '!' + f.celda + ': antes mostraba "' + f.valorAntes +
                        '" y ahora "' + valorDespues + '". Puede ser recalculo en curso o un error real: ' +
                        'verificar en pantalla antes de dar por buena la migracion.');
        }
    });

    return { detalle: detalle.join(' '), avisos: avisos };
}

// ============================================
// FUNCIONES PUBLICAS (MENU)
// ============================================

/**
 * Informa QUE CAMBIARIA la migracion, sin escribir una sola celda. Es lo primero que se corre.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}} ok=false si hay bloqueantes
 */
function estadoMigracionV095(yaConLock) {
    return _informarResultadoV095('Migracion v' + V095_VERSION + ' - estado', _conLockV095(yaConLock, function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var plan = _planV095(ss);
            var informe = _redactarPlanV095(plan);
            Logger.log(informe);
            _alertaV095('Migracion v' + V095_VERSION + ' - estado', informe);

            if (plan.problemas.length) {
                return {
                    ok: false,
                    error: 'La planilla no esta en el estado esperado: ' + plan.problemas.length +
                           ' bloqueante(s). aplicarMigracionV095() abortaria sin tocar nada.',
                    detalle: informe
                };
            }
            return { ok: true, detalle: informe };
        } catch (err) {
            // decision Franco 2026-08-13: el error viaja con su STACK al usuario, no solo el
            // message. Un "TypeError: ... reading 'getMaxRows'" sin linea ni funcion obliga a
            // adivinar desde afuera; con el stack, el diagnostico es inmediato. Es una funcion
            // de solo lectura y de uso interno: no hay nada sensible que exponer.
            logError('estadoMigracionV095: fallo la lectura del estado', err);
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
 * Aplica la migracion: preflight, respaldo congelado y las tres operaciones.
 *
 * Aborta ANTES de tocar una celda si el plan trae cualquier bloqueante. La confirmacion es
 * obligatoria cuando hay UI; sin UI solo procede si el llamador declara yaConLock (esta siendo
 * conducida por una rutina que ya decidio), nunca por iniciativa propia.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarMigracionV095(yaConLock) {
    return _informarResultadoV095('Migracion v' + V095_VERSION + ' - NO APLICADA', _conLockV095(yaConLock, function () {
        // progreso.muto se enciende justo antes de la PRIMERA escritura sobre una hoja viva:
        // es lo que le permite al catch de ultima instancia no mentir en ninguna direccion.
        var progreso = { muto: false, respaldoTc: null };
        try {
            return _cuerpoAplicarV095(progreso, yaConLock === true);
        } catch (err) {
            logError('aplicarMigracionV095: excepcion no prevista', err);
            if (!progreso.muto) {
                return {
                    ok: false,
                    error: 'Excepcion no prevista antes de mutar: ' + err.message +
                           '. No se modifico ninguna celda de las hojas vivas' +
                           (progreso.respaldoTc ? ' (puede haber quedado la hoja de respaldo "' +
                            progreso.respaldoTc + '", se borra a mano)' : '') + '.'
                };
            }
            return {
                ok: false,
                error: 'Excepcion no prevista DESPUES de haber empezado a escribir: ' + err.message +
                       '. NO SE PUDO CONFIRMAR el estado de la planilla: correr estadoMigracionV095() ' +
                       'y, si hace falta, revertirMigracionV095()' +
                       (progreso.respaldoTc ? ' (respaldo "' + progreso.respaldoTc + '")' : '') + '.'
            };
        }
    }));
}

/**
 * Cuerpo de aplicarMigracionV095(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldoTc: ?string}} progreso testigo de si ya se escribio sobre hojas vivas
 * @param {boolean} conducida true si el llamador ya tenia el lock (rutina que ya decidio)
 */
function _cuerpoAplicarV095(progreso, conducida) {
    var ss, plan, informe;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        plan = _planV095(ss);
        informe = _redactarPlanV095(plan);
        Logger.log(informe);
    } catch (err) {
        logError('aplicarMigracionV095: fallo el preflight', err);
        return { ok: false, error: 'Fallo el preflight: ' + err.message + '. No se escribio nada.' };
    }

    if (plan.problemas.length) {
        _alertaV095('Migracion v' + V095_VERSION + ' - ABORTADA', informe);
        return {
            ok: false,
            error: 'Abortada por preflight, no se toco ninguna celda. Bloqueantes: ' + plan.problemas.join(' | '),
            detalle: informe,
            _avisado: true
        };
    }

    if (plan.nadaQueHacer) {
        _alertaV095('Migracion v' + V095_VERSION, 'Nada que hacer: la planilla ya esta en el estado objetivo.\n\n' + informe);
        return { ok: true, detalle: 'Nada que hacer, la planilla ya esta en el estado objetivo.\n\n' + informe };
    }

    // --- Confirmacion ---
    var estadoPrevio = plan.estadoGuardado || {};
    var enVuelo = _migracionEnVueloV095(estadoPrevio);
    var ui = _uiV095();
    if (ui) {
        var resp = ui.alert(
            'Migracion v' + V095_VERSION + (enVuelo ? ' (reintento)' : ''),
            'Se va a modificar la planilla productiva:\n' +
            '  1. ampliar el grid de "' + plan.nombres.tiposCambio + '" hasta la fila ' + plan.grid.filaObjetivo + '\n' +
            '  2. agregar ' + plan.totalAgregaria + ' cotizaciones desde la hoja legacy\n' +
            '  3. re-apuntar ' + plan.formulas.filter(function (f) { return f.estado === 'PENDIENTE'; }).length +
            ' formula(s) al ledger vivo\n\n' +
            (enVuelo
                ? 'REINTENTO sobre la migracion iniciada el ' + estadoPrevio.iniciadaEn + '.\n' +
                  'Se CONSERVA el respaldo original "' + estadoPrevio.respaldoTc + '" (no se crea uno nuevo):\n' +
                  'revertir devuelve la planilla al estado previo a esa primera corrida.\n'
                : 'Antes de tocar nada se congela un respaldo verificado (hojas ocultas fechadas).\n') +
            'Corriste estadoMigracionV095() y leiste el informe? Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) {
            logInfo('aplicarMigracionV095: cancelada por el usuario.');
            return { ok: false, error: 'Cancelada por el usuario. No se escribio nada.' };
        }
    } else if (conducida !== true) {
        return {
            ok: false,
            error: 'Sin UI para confirmar una operacion que escribe sobre produccion. ' +
                   'Ejecutar desde el menu Tidetrack. No se escribio nada.'
        };
    } else {
        logInfo('aplicarMigracionV095: sin UI, ejecutada por un llamador que ya tiene el lock.');
    }

    var sello = _selloV095();
    var hechos = [];
    var respaldoTc = null;
    var respaldoFormulas = null;

    // --- RESPALDO CONGELADO Y VERIFICADO ANTES DE MUTAR ---
    // decision Franco 2026-08-13: CRITERIO DEL RESPALDO INMUTABLE. Mientras exista una
    // corrida sin revertir (iniciadaEn con revertidaEn nulo), el respaldo original NO se
    // toca y NO se crea uno nuevo: se reutiliza, previa revalidacion. El caso que lo exige
    // es el reintento -- que el propio mensaje de error del backfill recomienda -- sobre una
    // planilla ya medio migrada: un respaldo nuevo ahi seria la foto del estado roto, y
    // revertir devolveria a ese estado afirmando exito. El punto de retorno es SIEMPRE el
    // mas antiguo de la serie, y por eso gridPrevio y el puntero tampoco se reescriben.
    // Se descarta versionar respaldos y elegir el mas antiguo al revertir: mismo resultado,
    // pero deja copias del ledger de cotizaciones multiplicandose en cada reintento.
    try {
        if (enVuelo) {
            var hojaRespPrevia = estadoPrevio.respaldoTc ? ss.getSheetByName(estadoPrevio.respaldoTc) : null;
            if (!hojaRespPrevia) {
                return {
                    ok: false,
                    error: 'Hay una migracion v' + V095_VERSION + ' iniciada el ' + estadoPrevio.iniciadaEn +
                           ' y sin revertir, pero su respaldo "' + estadoPrevio.respaldoTc + '" no esta en la ' +
                           'planilla. No se crea un respaldo nuevo: seria la foto de un estado ya migrado y ' +
                           'revertir devolveria a el. No se modifico ninguna celda. Recuperar esa hoja (Archivo > ' +
                           'Historial de versiones) y reintentar, o resolver a mano y borrar la propiedad "' +
                           V095_PROP_ESTADO + '" para empezar de cero.'
                };
            }
            var revalidacion = _validarRespaldoTcV095(hojaRespPrevia, estadoPrevio.respaldoConteo);
            if (!revalidacion.ok) {
                return {
                    ok: false,
                    error: 'El respaldo "' + estadoPrevio.respaldoTc + '" de la migracion en curso ya no es ' +
                           'confiable: ' + revalidacion.problemas.join('; ') + '. No se creo un respaldo nuevo ' +
                           'ni se modifico ninguna celda: sin punto de retorno valido esta migracion no sigue.'
                };
            }
            respaldoTc = estadoPrevio.respaldoTc;
            progreso.respaldoTc = respaldoTc;

            var hojaFormPrevia = estadoPrevio.respaldoFormulas
                ? ss.getSheetByName(estadoPrevio.respaldoFormulas) : null;
            var faltaHojaForm = !!(estadoPrevio.respaldoFormulas && !hojaFormPrevia);
            if (faltaHojaForm) {
                hechos.push('aviso: la hoja de respaldo de formulas "' + estadoPrevio.respaldoFormulas +
                            '" ya no esta; el registro vive en DocumentProperties y desde ahi se restaura.');
            }
            var resForm = _respaldarFormulasV095(ss, plan, sello, hojaFormPrevia, faltaHojaForm);
            // El puntero de formulas solo se MUEVE si antes no habia ninguno (nunca se pisa).
            respaldoFormulas = estadoPrevio.respaldoFormulas || (resForm ? resForm.nombre : null);

            // Solo se registra el reintento. respaldoTc, respaldoConteo y gridPrevio quedan
            // exactamente como los dejo la primera corrida.
            _guardarEstadoV095({
                respaldoFormulas: respaldoFormulas,
                intentos: (estadoPrevio.intentos || 1) + 1,
                ultimoIntentoEn: new Date().toISOString()
            });
            logInfo('aplicarMigracionV095: reintento sobre una migracion en vuelo. Se conserva el respaldo ' +
                    'original "' + respaldoTc + '" (gridPrevio ' + estadoPrevio.gridPrevio + ').');
            hechos.push('respaldo: se reutiliza el original "' + respaldoTc + '" (reintento, no se pisa).');
        } else {
            // decision Franco 2026-08-13: la planilla tambien se consulta como evidencia, no
            // solo el registro de DocumentProperties. El registro puede faltar (borrado a mano,
            // planilla duplicada, propiedad perdida) mientras la planilla YA esta a medio
            // migrar; en ese caso congelar un respaldo nuevo seria fotografiar el estado roto,
            // y revertir devolveria a el declarando exito. Las hojas RESP_TC_v095_* huerfanas
            // son la huella de ese escenario: si existe alguna, se aborta sin escribir y se
            // nombra la mas antigua como punto de retorno.
            var huerfanas = ss.getSheets()
                .map(function (h) { return h.getName(); })
                .filter(function (n) { return n.indexOf('RESP_TC_v095_') === 0; })
                .sort();
            if (huerfanas.length > 0) {
                // decision Franco 2026-08-13: un respaldo huerfano NO siempre significa una
                // planilla a medio migrar. Un intento que aborto ANTES de mutar (por ejemplo el
                // del 2026-08-13, que fallo al verificar el respaldo de formulas) tambien deja
                // uno, y en ese caso la planilla esta intacta y bloquear seria fricción sin
                // motivo. La evidencia que distingue los dos casos esta en los datos: si el
                // respaldo huerfano contiene lo MISMO que la hoja viva, no hubo mutacion.
                var vivoAhora = _contarBloquesTcV095(plan.hojas.tiposCambio);
                var sospechosas = huerfanas.filter(function (n) {
                    var h = ss.getSheetByName(n);
                    if (!h) return false;
                    var c = _contarBloquesTcV095(h);
                    return V095_BLOQUES_TC.some(function (b) {
                        return c.porPar[b.par] !== vivoAhora.porPar[b.par];
                    });
                });
                if (sospechosas.length > 0) {
                    return {
                        ok: false,
                        error: 'Hay respaldos de una corrida anterior sin registro asociado cuyo ' +
                               'contenido DIFIERE de la hoja viva: ' + sospechosas.join(', ') + '. ' +
                               'Eso indica que una migracion quedo a medio aplicar. No se congela un ' +
                               'respaldo nuevo porque seria la foto de ese estado roto. El punto de ' +
                               'retorno candidato es el MAS ANTIGUO: "' + sospechosas[0] + '".'
                    };
                }
                logInfo('aplicarMigracionV095: hay ' + huerfanas.length + ' respaldo(s) huerfano(s) ' +
                        '(' + huerfanas.join(', ') + ') con el MISMO contenido que la hoja viva: son ' +
                        'de un intento que aborto sin mutar. No bloquean; se pueden borrar a mano.');
            }
            var resTc = _respaldarTiposCambioV095(ss, plan.hojas.tiposCambio, sello);
            respaldoTc = resTc.nombre;
            progreso.respaldoTc = respaldoTc;
            var resForm2 = _respaldarFormulasV095(ss, plan, sello, null);
            respaldoFormulas = resForm2 ? resForm2.nombre : null;

            // Se persiste el puntero al respaldo ANTES de la primera mutacion: si algo corta a
            // mitad de camino, el rastro de donde esta la copia ya quedo guardado. Con el
            // puntero va el conteo verificado, que es contra lo que revertir lo revalida.
            _guardarEstadoV095({
                sello: sello,
                respaldoTc: respaldoTc,
                respaldoConteo: resTc.conteo,
                respaldoUltimaFila: resTc.ultimaFila,
                respaldoVerificadoEn: new Date().toISOString(),
                respaldoFormulas: respaldoFormulas,
                iniciadaEn: new Date().toISOString(),
                intentos: 1,
                aplicadaEn: null,
                revertidaEn: null,
                gridPrevio: plan.grid.maxFilasActual
            });
        }
    } catch (err) {
        logError('aplicarMigracionV095: fallo el respaldo', err);
        return {
            ok: false,
            error: 'Fallo al congelar o verificar el respaldo: ' + err.message +
                   '. Se aborto ANTES de mutar: no se modifico ninguna celda de las hojas vivas' +
                   (respaldoTc ? ' (quedo la hoja "' + respaldoTc + '", se puede borrar a mano)' : '') + '.'
        };
    }

    // El respaldo ya esta escrito y releido: recien ahora se habilita la primera mutacion.
    SpreadsheetApp.flush();
    progreso.muto = true;

    // --- OPERACIONES ---
    try {
        hechos.push(_aplicarGridV095(plan));
    } catch (err) {
        logError('aplicarMigracionV095: fallo la ampliacion del grid', err);
        return {
            ok: false,
            error: 'Fallo al ampliar el grid: ' + err.message +
                   '. No se escribio ninguna cotizacion ni se toco ninguna formula. ' +
                   'Respaldo: "' + respaldoTc + '".',
            detalle: hechos.join('\n')
        };
    }

    try {
        hechos.push(_aplicarBackfillV095(plan));
    } catch (err) {
        logError('aplicarMigracionV095: fallo el backfill', err);
        _guardarEstadoV095({ pasos: { grid: 'aplicado', backfill: 'incierto', formulas: 'no ejecutado' } });
        return {
            ok: false,
            error: 'Fallo durante el backfill: ' + err.message +
                   '. NO SE PUDO CONFIRMAR el estado de los bloques de cotizaciones: puede haber pares ' +
                   'escritos y pares sin escribir. El backfill es idempotente y el reintento CONSERVA ' +
                   'este mismo respaldo (no lo pisa con la foto del estado a medio migrar), asi que ' +
                   'reintentar es seguro; antes correr estadoMigracionV095() para ver como quedo. ' +
                   'Respaldo congelado y verificado: "' + respaldoTc + '".',
            detalle: hechos.join('\n')
        };
    }

    var resFormulas;
    try {
        resFormulas = _aplicarFormulasV095(plan);
        hechos.push(resFormulas.detalle);
    } catch (err) {
        logError('aplicarMigracionV095: fallo el re-apuntado de formulas', err);
        _guardarEstadoV095({ pasos: { grid: 'aplicado', backfill: 'aplicado', formulas: 'incierto' } });
        return {
            ok: false,
            error: 'Grid y backfill quedaron aplicados. Fallo el re-apuntado de formulas: ' + err.message +
                   '. NO SE PUDO CONFIRMAR cuales formulas quedaron escritas: revisar con ' +
                   'estadoMigracionV095(). Los originales estan en "' + respaldoFormulas + '" y en ' +
                   'DocumentProperties; revertirMigracionV095() los restaura.',
            detalle: hechos.join('\n')
        };
    }

    _guardarEstadoV095({
        aplicadaEn: new Date().toISOString(),
        revertidaEn: null,
        pasos: { grid: 'aplicado', backfill: 'aplicado', formulas: 'aplicado' },
        cotizacionesAgregadas: plan.totalAgregaria
    });

    var salida = ['MIGRACION v' + V095_VERSION + ' APLICADA'];
    salida.push('');
    hechos.forEach(function (h) { salida.push('  ' + h); });
    salida.push('');
    salida.push('Respaldos (hojas ocultas): "' + respaldoTc + '"' +
                (respaldoFormulas ? ' y "' + respaldoFormulas + '"' : ' (no hubo formulas que respaldar)') + '.');
    if (resFormulas.avisos.length) {
        salida.push('');
        salida.push('VERIFICACION POSTERIOR:');
        resFormulas.avisos.forEach(function (a) { salida.push('  - ' + a); });
    }
    if (plan.avisos.length) {
        salida.push('');
        salida.push('AVISOS DEL PLAN:');
        plan.avisos.forEach(function (a) { salida.push('  - ' + a); });
    }
    salida.push('');
    salida.push('Siguiente paso: correr estadoMigracionV095() de nuevo (debe reportar "nada que hacer") ' +
                'y un lote de prueba de procesarCargas().');

    var texto = salida.join('\n');
    Logger.log(texto);
    _alertaV095('Migracion v' + V095_VERSION + ' aplicada', texto);
    logSuccess('aplicarMigracionV095: completada. ' + plan.totalAgregaria + ' cotizaciones agregadas.');

    if (resFormulas.avisos.length) {
        // Se escribio todo, pero hay verificaciones que no cerraron: ok=false para que
        // ningun llamador de la cadena lo tome por un cierre limpio.
        return {
            ok: false,
            error: 'Aplicada, pero NO SE PUDO CONFIRMAR el resultado de ' + resFormulas.avisos.length +
                   ' verificacion(es) posterior(es). Revisar el detalle antes de dar la migracion por buena.',
            detalle: texto,
            _avisado: true
        };
    }
    return { ok: true, detalle: texto };
}

/**
 * Deshace la migracion usando el respaldo congelado.
 *
 * Restaura solo la superficie que la migracion mutO: los cuatro bloques de datos de
 * "Tipos de cambio" (fila 7 hacia abajo) y las formulas originales. El grid ampliado se
 * devuelve a su tamano previo SOLO si las filas agregadas quedaron vacias; si tienen datos se
 * conservan y se informa (borrarlas seria destruir informacion que no es de esta migracion).
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirMigracionV095(yaConLock) {
    return _informarResultadoV095('Revertir migracion v' + V095_VERSION + ' - NO REVERTIDA', _conLockV095(yaConLock, function () {
        var progreso = { muto: false, respaldoTc: null };
        try {
            return _cuerpoRevertirV095(progreso, yaConLock === true);
        } catch (err) {
            logError('revertirMigracionV095: excepcion no prevista', err);
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
                       '. NO SE PUDO CONFIRMAR el estado de la planilla; el respaldo "' + progreso.respaldoTc +
                       '" sigue intacto. Revisar y reintentar.'
            };
        }
    }));
}

/**
 * Cuerpo de revertirMigracionV095(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldoTc: ?string}} progreso testigo de si ya se escribio sobre hojas vivas
 * @param {boolean} conducida true si el llamador ya tenia el lock (rutina que ya decidio)
 */
function _cuerpoRevertirV095(progreso, conducida) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var estado = _leerEstadoV095();
    var props = PropertiesService.getDocumentProperties();
    var nombres = _nombresV095();

    if (estado._corrupto) {
        return {
            ok: false,
            error: 'El registro de la migracion en DocumentProperties es ilegible, asi que no se sabe cual ' +
                   'es el respaldo valido. NO se restaura nada a ciegas. Fragmento crudo: ' + estado._crudo +
                   '. Buscar las hojas ocultas "RESP_TC_v095_*" (vale la MAS ANTIGUA) y restaurar a mano.'
        };
    }

    if (!estado.respaldoTc && !estado.respaldoFormulas) {
        return {
            ok: false,
            error: 'No hay registro de una migracion aplicada (DocumentProperties vacio). ' +
                   'Si el respaldo existe, buscar las hojas ocultas "RESP_TC_v095_*" / ' +
                   '"RESP_FORMULAS_v095_*" y restaurar a mano. No se toco nada.'
        };
    }

    var hojaTc = ss.getSheetByName(nombres.tiposCambio);
    var hojaResp = estado.respaldoTc ? ss.getSheetByName(estado.respaldoTc) : null;
    if (!hojaTc || !hojaResp) {
        return {
            ok: false,
            error: 'No se encontro ' + (!hojaTc ? 'la hoja "' + nombres.tiposCambio + '"' :
                   'la hoja de respaldo "' + estado.respaldoTc + '"') + '. No se toco nada.'
        };
    }
    progreso.respaldoTc = estado.respaldoTc;

    // --- VALIDACION DEL RESPALDO ANTES DE ESCRIBIR UNA SOLA CELDA ---
    // decision Franco 2026-08-13: el respaldo se valida contra el conteo que quedo registrado
    // cuando se lo verifico al crearlo, NO contra la hoja viva. Compararlo con la hoja viva
    // seria absurdo aca: en una reversion legitima la viva tiene MAS filas (justo las que el
    // backfill agrego). Lo que hay que descartar es que la copia se haya vaciado o alterado
    // entre el respaldo y hoy: restaurar eso vaciaria el Data Lake de cotizaciones.
    var vivo = _contarBloquesTcV095(hojaTc);
    var validacion = _validarRespaldoTcV095(hojaResp, estado.respaldoConteo);
    if (validacion.conteo.total === 0 && vivo.total > 0) {
        validacion.problemas.push('el respaldo no tiene una sola fila con dato en ninguno de los cuatro ' +
                                  'bloques y la hoja viva tiene ' + vivo.total +
                                  ': restaurarlo vaciaria las cotizaciones.');
        validacion.ok = false;
    }
    if (validacion.conteo.ultimaFila > hojaTc.getMaxRows()) {
        validacion.problemas.push('el respaldo llega hasta la fila ' + validacion.conteo.ultimaFila +
                                  ' y "' + nombres.tiposCambio + '" tiene ' + hojaTc.getMaxRows() +
                                  ' filas: no entra completo.');
        validacion.ok = false;
    }
    if (!validacion.ok) {
        var textoFalla = 'REVERSION ABORTADA: el respaldo "' + estado.respaldoTc + '" no paso la validacion ' +
                         'y NO SE ESCRIBIO NINGUNA CELDA. Motivos: ' + validacion.problemas.join(' | ') +
                         '. Restaurar desde el historial de versiones de la planilla o a mano.';
        logError('revertirMigracionV095: respaldo invalido, no se restaura', new Error(validacion.problemas.join(' | ')));
        _alertaV095('Revertir migracion v' + V095_VERSION + ' - ABORTADA', textoFalla);
        return { ok: false, error: textoFalla, _avisado: true };
    }
    validacion.avisos.forEach(function (a) { logInfo('revertirMigracionV095: ' + a); });

    var ui = _uiV095();
    if (ui) {
        var resp = ui.alert(
            'Revertir migracion v' + V095_VERSION,
            'Se van a restaurar las cotizaciones desde "' + estado.respaldoTc + '" (' +
            validacion.conteo.total + ' filas con dato, verificadas) y las formulas originales.\n' +
            'La hoja viva tiene hoy ' + vivo.total + ' filas con dato: la diferencia se pierde.\n' +
            (estado.revertidaEn ? 'AVISO: esta migracion ya figura revertida el ' + estado.revertidaEn + '.\n' : '') +
            (validacion.avisos.length ? 'AVISO: ' + validacion.avisos.join(' | ') + '\n' : '') +
            '\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) return { ok: false, error: 'Cancelada por el usuario. No se escribio nada.' };
    } else if (conducida !== true) {
        return { ok: false, error: 'Sin UI para confirmar. Ejecutar desde el menu Tidetrack. No se escribio nada.' };
    }

    var hechos = [];
    var avisosRevert = [];

    // --- 1. Cotizaciones ---
    try {
        progreso.muto = true;
        // El alto se acota al menor de los dos grids: escribir mas alla del grid vivo tiraria
        // una excepcion a mitad de la restauracion, con bloques restaurados y bloques no.
        var filasResp = Math.min(hojaResp.getMaxRows(), hojaTc.getMaxRows());
        var altoResp = filasResp - V095_NUE_TC_FILA_DATOS + 1;
        V095_BLOQUES_TC.forEach(function (b) {
            if (altoResp > 0) {
                var valores = hojaResp.getRange(V095_NUE_TC_FILA_DATOS, b.nuevaCol, altoResp, 2).getValues();
                hojaTc.getRange(V095_NUE_TC_FILA_DATOS, b.nuevaCol, altoResp, 2).setValues(valores);
            }
            var desde = V095_NUE_TC_FILA_DATOS + Math.max(altoResp, 0);
            var hasta = hojaTc.getMaxRows();
            if (hasta >= desde) hojaTc.getRange(desde, b.nuevaCol, hasta - desde + 1, 2).clearContent();
        });
        SpreadsheetApp.flush();

        // Verificacion posterior: la hoja viva tiene que haber quedado con el mismo conteo
        // por bloque que el respaldo. Sin esta lectura, "restauradas" seria una afirmacion
        // sin evidencia, que es justo lo que este modulo no hace.
        var trasRestaurar = _contarBloquesTcV095(hojaTc);
        var noCuadran = [];
        V095_BLOQUES_TC.forEach(function (b) {
            if (trasRestaurar.porPar[b.par] !== validacion.conteo.porPar[b.par]) {
                noCuadran.push(b.par + ' (respaldo ' + validacion.conteo.porPar[b.par] + ', hoja viva ' +
                               trasRestaurar.porPar[b.par] + ')');
            }
        });
        if (noCuadran.length) {
            avisosRevert.push('NO SE PUDO CONFIRMAR la restauracion de cotizaciones: ' + noCuadran.join(', ') +
                              '. Las celdas YA fueron escritas; el respaldo "' + estado.respaldoTc +
                              '" sigue intacto. Revisar en pantalla antes de dar la reversion por buena.');
        }
        hechos.push('cotizaciones restauradas desde "' + estado.respaldoTc + '" (' +
                    validacion.conteo.total + ' filas con dato' +
                    (noCuadran.length ? '; verificacion posterior NO conforme' : '; verificado') + ').');
    } catch (err) {
        logError('revertirMigracionV095: fallo la restauracion de cotizaciones', err);
        return {
            ok: false,
            error: 'Fallo al restaurar las cotizaciones: ' + err.message +
                   '. NO SE PUDO CONFIRMAR el estado de los bloques: el respaldo "' + estado.respaldoTc +
                   '" sigue intacto, revisar y reintentar.'
        };
    }

    // --- 2. Formulas ---
    // Se restaura EXACTAMENTE lo que la migracion registro haber cambiado, no la lista fija
    // de celdas candidatas: las que estaban vacias o ya migradas nunca se tocaron, y darlas
    // por "no restaurables" seria reportar una falla que no existe.
    var restauradas = 0;
    var sinRegistro = [];
    try {
        var registradas = _celdasRegistradasV095(ss, estado, props, nombres);
        registradas.forEach(function (r) {
            var hoja = ss.getSheetByName(r.hoja);
            if (!hoja) { sinRegistro.push(r.hoja + '!' + r.celda + ' (hoja no encontrada)'); return; }
            if (r.formula === null || r.formula === undefined) { sinRegistro.push(r.hoja + '!' + r.celda); return; }
            hoja.getRange(r.celda).setFormula(r.formula);
            restauradas++;
        });
        SpreadsheetApp.flush();
        hechos.push(restauradas + ' formula(s) restauradas' +
                    (registradas.length === 0 ? ' (la migracion no habia modificado ninguna)' : '') + '.');
    } catch (err) {
        logError('revertirMigracionV095: fallo la restauracion de formulas', err);
        return {
            ok: false,
            error: 'Cotizaciones restauradas. Fallo al restaurar formulas: ' + err.message +
                   '. NO SE PUDO CONFIRMAR cuales quedaron con su formula original: los originales siguen ' +
                   'en "' + estado.respaldoFormulas + '".',
            detalle: hechos.join('\n')
        };
    }

    // --- 3. Grid: solo si las filas agregadas quedaron vacias ---
    var pasoGrid = 'sin cambios';
    try {
        var gridPrevio = estado.gridPrevio;
        var maxActual = hojaTc.getMaxRows();
        if (gridPrevio && maxActual > gridPrevio) {
            var sobrante = hojaTc.getRange(gridPrevio + 1, 1, maxActual - gridPrevio, hojaTc.getMaxColumns());
            if (sobrante.isBlank()) {
                hojaTc.deleteRows(gridPrevio + 1, maxActual - gridPrevio);
                pasoGrid = 'revertido';
                hechos.push('grid devuelto a ' + gridPrevio + ' filas.');
            } else {
                pasoGrid = 'conservado (filas agregadas con contenido)';
                hechos.push('grid conservado en ' + maxActual + ' filas: las filas agregadas tienen contenido ' +
                            'y borrarlas destruiria datos ajenos a esta migracion.');
            }
        }
    } catch (err) {
        logError('revertirMigracionV095: fallo el ajuste del grid (no critico)', err);
        pasoGrid = 'no se pudo ajustar';
        hechos.push('grid: no se pudo ajustar (' + err.message + '); queda ampliado, sin consecuencia funcional.');
    }

    // Los pasos registran lo que REALMENTE paso, no la intencion: el grid puede quedar
    // ampliado a proposito y las formulas restauradas pueden ser cero.
    _guardarEstadoV095({
        revertidaEn: new Date().toISOString(),
        pasos: {
            grid: pasoGrid,
            backfill: avisosRevert.length ? 'restaurado sin confirmar' : 'revertido',
            formulas: sinRegistro.length ? 'revertido parcialmente' : 'revertido (' + restauradas + ')'
        }
    });

    var texto = 'MIGRACION v' + V095_VERSION + ' REVERTIDA\n\n  ' + hechos.join('\n  ') +
        (sinRegistro.length ? '\n\nSIN RESTAURAR (no habia registro del original): ' + sinRegistro.join(', ') +
                              '. Revisar "' + estado.respaldoFormulas + '".' : '') +
        (avisosRevert.length ? '\n\nVERIFICACION POSTERIOR:\n  - ' + avisosRevert.join('\n  - ') : '') +
        '\n\nLos respaldos NO se borran: hacerlo es una decision manual.';
    Logger.log(texto);
    _alertaV095('Migracion v' + V095_VERSION + ' revertida', texto);

    if (sinRegistro.length || avisosRevert.length) {
        return {
            ok: false,
            error: (sinRegistro.length ? 'Revertida parcialmente: ' + sinRegistro.length +
                    ' formula(s) sin registro del original. ' : '') +
                   (avisosRevert.length ? 'NO SE PUDO CONFIRMAR ' + avisosRevert.length +
                    ' verificacion(es) posterior(es).' : ''),
            detalle: texto,
            _avisado: true
        };
    }
    return { ok: true, detalle: texto };
}

/**
 * Devuelve las celdas que la migracion efectivamente modifico, con su formula original.
 *
 * La lista sale de la hoja de respaldo (registro auditable que sobrevive a un borrado de
 * propiedades); si esa hoja no esta, se cae a DocumentProperties recorriendo las celdas
 * candidatas. El VALOR gana siempre desde DocumentProperties, que es el registro primario.
 *
 * @returns {Array<{hoja: string, celda: string, formula: string|null}>}
 */
function _celdasRegistradasV095(ss, estado, props, nombres) {
    var salida = [];
    var hojaResp = estado.respaldoFormulas ? ss.getSheetByName(estado.respaldoFormulas) : null;

    if (hojaResp) {
        var ultima = hojaResp.getLastRow();
        if (ultima >= 2) {
            var filas = hojaResp.getRange(2, 1, ultima - 1, 3).getValues();
            // Una misma celda puede figurar mas de una vez: cada reintento apendea sus pendientes
            // a la misma hoja. Gana la PRIMERA aparicion, que es la mas vieja y por lo tanto la
            // anterior a cualquier re-apuntado. Sin dedupe, "N formulas restauradas" contaria
            // escrituras en vez de celdas: un numero que no significa lo que dice.
            var vistas = Object.create(null);
            filas.forEach(function (f) {
                if (!f[0] || !f[1]) return;
                var hoja = String(f[0]);
                var celda = String(f[1]);
                var clave = hoja + '!' + celda;
                if (vistas[clave]) return;
                vistas[clave] = true;
                var deProps = props.getProperty(_claveFormulaV095(hoja, celda));
                salida.push({
                    hoja: hoja,
                    celda: celda,
                    formula: (deProps !== null && deProps !== undefined) ? deProps : String(f[2])
                });
            });
        }
        return salida;
    }

    // Sin hoja de respaldo: solo se restauran las celdas de las que hay registro en propiedades.
    // Las que no tienen registro no fueron modificadas por la migracion y no se tocan.
    V095_CELDAS_FORMULA.forEach(function (c) {
        var hoja = nombres[c.hojaClave];
        var original = props.getProperty(_claveFormulaV095(hoja, c.celda));
        if (original === null || original === undefined) return;
        salida.push({ hoja: hoja, celda: c.celda, formula: original });
    });
    return salida;
}

// ============================================
// REPARACIONES POSTERIORES A LA MIGRACION
// ============================================

/**
 * Repara el formato de numero de las columnas de Cotizacion de "Tipos de cambio".
 *
 * [CONCEPTO DE NEGOCIO] Una cotizacion que se muestra como fecha es ilegible para el
 * operador aunque el numero guardado sea correcto: el Data Lake deja de poder leerse.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO] El backfill de la v0.9.5 escribio ~819 filas nuevas
 * por par con setValues, que NO propaga formato: las celdas nuevas heredaron el formato que
 * tenia el grid recien ampliado. En el bloque EUR eso resulto en formato de fecha, y 791 de
 * 820 filas de la columna L pasaron a mostrar "25/8/1904" en vez de "$1.699,34" (verificado
 * en vivo el 2026-08-13 contra el respaldo previo, que tiene esas celdas bien formateadas).
 *
 * decision Franco 2026-08-13: se corrige SOLO el formato, nunca los valores. El formato de
 * referencia se toma de la PRIMERA fila de datos de cada bloque, que es anterior al backfill
 * y por lo tanto la que el operador ya validaba como correcta. Si esa fila estuviera vacia el
 * bloque se saltea con aviso: inventar un formato seria peor que dejarlo como esta.
 *
 * @see docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md
 * @param {boolean} [yaConLock] true si el llamador ya tomo el DocumentLock
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function repararFormatoCotizacionesV095(yaConLock) {
    return _informarResultadoV095('Reparar formato de cotizaciones', _conLockV095(yaConLock, function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var nombreTc = SHEETS.TIPOS_CAMBIO;
            var hoja = ss.getSheetByName(nombreTc);
            if (!hoja) {
                return { ok: false, error: 'No se encontro la hoja "' + nombreTc + '". No se toco nada.' };
            }

            var filaDatos = V095_NUE_TC_FILA_DATOS;
            var ultima = hoja.getMaxRows();
            var alto = ultima - filaDatos + 1;
            if (alto <= 1) {
                return { ok: true, detalle: 'La hoja no tiene filas de datos suficientes: nada que reparar.' };
            }

            var lineas = [];
            var corregidos = 0;
            V095_BLOQUES_TC.forEach(function (b) {
                var colCotizacion = b.nuevaCol + 1;   // la Cotizacion va inmediatamente a la derecha de la Fecha
                var refFormato = hoja.getRange(filaDatos, colCotizacion).getNumberFormat();
                var refValor = hoja.getRange(filaDatos, colCotizacion).getValue();
                if (refValor === '' || refValor === null) {
                    lineas.push(b.par + ': la primera fila de datos esta vacia, no hay formato de referencia. Se saltea.');
                    return;
                }

                var rango = hoja.getRange(filaDatos, colCotizacion, alto, 1);
                var formatosAntes = rango.getNumberFormats();
                var distintos = 0;
                for (var i = 0; i < formatosAntes.length; i++) {
                    if (formatosAntes[i][0] !== refFormato) distintos++;
                }

                if (distintos === 0) {
                    lineas.push(b.par + ': ya estaba uniforme (' + refFormato + '). Sin cambios.');
                    return;
                }

                rango.setNumberFormat(refFormato);
                corregidos += distintos;
                lineas.push(b.par + ': ' + distintos + ' celda(s) reformateadas a "' + refFormato + '".');
            });

            SpreadsheetApp.flush();
            var detalle = 'Formato de cotizaciones en "' + nombreTc + '"\n\n' + lineas.join('\n') +
                          '\n\nTotal de celdas reformateadas: ' + corregidos +
                          '.\nNo se modifico NINGUN valor: solo el formato de presentacion.';
            logSuccess('repararFormatoCotizacionesV095: ' + corregidos + ' celda(s) reformateadas.');
            return { ok: true, detalle: detalle };
        } catch (err) {
            logError('repararFormatoCotizacionesV095: fallo', err);
            var traza = err && err.stack ? String(err.stack).split('\n').slice(0, 5).join('\n') : '(sin stack)';
            return {
                ok: false,
                error: 'No se pudo reparar el formato: ' + err.message,
                detalle: 'DETALLE TECNICO:\n' + traza
            };
        }
    }));
}

/**
 * Lista los respaldos de la migracion y marca cuales NO sirven como punto de retorno.
 *
 * [CONCEPTO DE NEGOCIO] Un respaldo que no se puede usar es peor que no tenerlo: invita a
 * confiar en el. Esta herramienta los distingue y deja la decision de borrar en el operador.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO] El primer intento de aplicar la v0.9.5 (2026-08-13,
 * sello _1721) abortó al verificar su respaldo de formulas, y dejo el par de hojas creado.
 * Ese RESP_FORMULAS guarda las formulas como FORMULA VIVA -- el defecto que corrigio la
 * v0.9.8 --, asi que se recalcula y no conserva el texto original: no sirve para revertir.
 * NO se borra nada automaticamente: borrar hojas es irreversible y la decision es de Franco.
 *
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function estadoRespaldosV095() {
    return _informarResultadoV095('Respaldos de la migracion v' + V095_VERSION, (function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var estado = _leerEstadoV095() || {};
            var vigentes = [estado.respaldoTc, estado.respaldoFormulas].filter(Boolean);
            var lineas = [];

            ss.getSheets().forEach(function (h) {
                var n = h.getName();
                if (n.indexOf('RESP_TC_v095_') !== 0 && n.indexOf('RESP_FORMULAS_v095_') !== 0) return;

                var marca = vigentes.indexOf(n) >= 0 ? 'VIGENTE (lo usa revertir)' : 'huerfano';
                var nota = '';

                if (n.indexOf('RESP_FORMULAS_v095_') === 0) {
                    // El unico criterio que importa en un respaldo de formulas: que sean TEXTO.
                    var alto = Math.max(h.getLastRow() - 1, 0);
                    if (alto > 0) {
                        var formulas = h.getRange(2, 3, alto, 1).getFormulas();
                        var vivas = formulas.filter(function (f) { return f[0] !== ''; }).length;
                        nota = vivas > 0
                            ? ' -- INSERVIBLE: ' + vivas + ' formula(s) quedaron VIVAS en vez de texto.'
                            : ' -- ok: las formulas estan como texto.';
                    }
                }
                lineas.push(n + ' [' + marca + ']' + nota);
            });

            if (!lineas.length) {
                return { ok: true, detalle: 'No hay hojas de respaldo de la migracion v' + V095_VERSION + '.' };
            }
            return {
                ok: true,
                detalle: 'Respaldos encontrados:\n\n' + lineas.join('\n') +
                         '\n\nLos marcados INSERVIBLE no pueden usarse para revertir. Los huerfanos ' +
                         'son de intentos previos. Borralos a mano si querés: esta herramienta no ' +
                         'elimina hojas (borrar es irreversible y la decision es tuya).'
            };
        } catch (err) {
            logError('estadoRespaldosV095: fallo', err);
            return { ok: false, error: 'No se pudo listar los respaldos: ' + err.message };
        }
    })());
}
