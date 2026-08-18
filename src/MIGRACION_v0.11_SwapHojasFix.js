/**
 * ============================================
 * MIGRACION v0.11 - SWAP DE HOJAS FIX
 * ============================================
 *
 * [CONCEPTO DE NEGOCIO]
 * Franco rediseno la planilla duplicando hojas con sufijo " - Fix" (y una
 * "Presupuesto - New"). Esas copias son las DEFINITIVAS: layout corrido,
 * Plan de Cuentas reestructurado (bloques C:D/F:G/I:J/L:N/P:Q, la nocion
 * "Proyecto" pasa a llamarse "Categoria" y aparecen las categorias generales
 * Ahorros/Inversiones/Financiacion/Hogar). Este modulo convierte las Fix en
 * las hojas principales: renombra las viejas a respaldo oculto, renombra las
 * Fix a sus nombres canonicos, repuntea las formulas que quedaron mirando a
 * las viejas y reconstruye las validaciones de datos que el renombre no
 * arrastra. La purga (borrado fisico de los respaldos) es un paso aparte y
 * explicito: borrar hojas es irreversible.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * En Google Sheets las referencias de formula y las fuentes de Validacion de
 * Datos siguen al OBJETO hoja, no al nombre: renombrar 'Registros' a
 * 'Registros (anterior)' arrastra todas las formulas que la miraban. Por eso
 * el swap repuntea, y el repunteo es SEMANTICO, nunca un reemplazo textual a
 * ciegas. Hay exactamente dos reglas, derivadas del censo real de referencias
 * (2026-08-18):
 *   1. Plan de Cuentas: las vistas lo miran con columnas completas R:T
 *      (Medios) y V:W (Proyectos). Esos bloques se mudaron a L:N y P:Q con la
 *      misma estructura interna: se remapea la COLUMNA y el corrimiento de
 *      filas no afecta (columna completa).
 *   2. Registros: las vistas lo miran con rangos ANCLADOS POR FILA
 *      (B5:M1005, $B$6:$B883...) y la BD nueva corrio una fila (header 5->6,
 *      datos 6->7). Se reescribe celda por celda sumando 1 a cada numero de
 *      fila del rango, ademas del cambio de hoja.
 * Toda otra referencia a un respaldo queda donde esta y se LISTA en el
 * informe: repuntear lo que no se entiende es corromper en silencio.
 *
 * El dropdown de Cuenta de Cargas apuntaba a la columna Y del Plan viejo
 * (consolidacion de los 4 bloques); el Plan nuevo no la tiene y se recrea en
 * la columna S. La formula se escribe con ";" y sin arrays literales: en esta
 * planilla (locale es_AR) setFormula NO traduce separadores (trampa
 * verificada en vivo, ver 07_MiradaInteranual.js y decision Franco 2026-08-13
 * en DEVTOOL_CableadoPresupuesto.js), y la escritura se VERIFICA leyendo la
 * celda resultante.
 *
 * El Plan Fix arrastra un bloque residual de movimientos (C1005:N1033) que
 * romperia el ABM y los dropdowns (getLastRow/appendRow miden la columna
 * entera): aplicar lo mueve a una hoja de cuarentena oculta y limpia el
 * catalogo. Nada se borra: la cuarentena queda para que Franco decida.
 *
 * Contrato de todos los caminos publicos: {ok, detalle?, error?}.
 * Todo corre bajo el lock del documento. El estado vive en
 * DocumentProperties para que revertir/purgar usen los nombres REALES que
 * se aplicaron, no una re-derivacion. Un estado "en vuelo" (corrida muerta
 * sin catch: timeout de 6 min, corte manual) NO es terminal: "4. Revertir"
 * lo reconcilia mirando que hojas quedaron con que nombre.
 *
 * @see docs/permanente/MAPA_HOJAS.md
 * @see docs/permanente/FUNCIONALIDADES.md
 */

var V011_VERSION = '0.11.0';
var V011_PROP_ESTADO = 'MIGRACION_V011_SWAP_ESTADO';
var V011_LOCK_MS = 30000;
var V011_FILA_TOPE_CATALOGO = 1000;   // el catalogo del Plan termina antes; mas alla, cuarentena

// Tabla del swap. 'Presupuesto - New' y 'Mirada Interanual - Fix' no tienen
// hoja vieja (la version anterior de Mirada ya fue eliminada a mano y
// Presupuesto es una hoja nueva): para ellas el swap es solo el renombre.
// La vieja de 'Tipos de Cambio' se llama 'Tipos de cambio' (c minuscula):
// la busqueda de la vieja es SIEMPRE case-insensitive por ese caso.
var V011_SWAPS = [
    { fix: 'Inicio - Fix',            canonico: 'Inicio' },
    { fix: 'Tablero - Fix',           canonico: 'Tablero' },
    { fix: 'Presupuesto - New',       canonico: 'Presupuesto' },
    { fix: 'Cargas - Fix',            canonico: 'Cargas' },
    { fix: 'Plan de Cuentas - Fix',   canonico: 'Plan de Cuentas' },
    { fix: 'Mirada Interanual - Fix', canonico: 'Mirada Interanual' },
    { fix: 'Registros - Fix',         canonico: 'Registros' },
    { fix: 'Tipos de Cambio - Fix',   canonico: 'Tipos de Cambio' }
];

// Geometria CONGELADA de las hojas viejas y Fix al momento de escribir esta
// migracion (2026-08-18). NO leer de RANGES: el config ya describe el layout
// nuevo (post-swap) y este modulo necesita la foto vieja para comparar y
// sincronizar. Mismo criterio que MIGRACION_v0.9.5 (una migracion congela su
// propia geometria).
var V011_GEO = {
    registrosVieja: { colIni: 2, colFin: 13, filaDatos: 6 },   // B:M, datos desde fila 6
    registrosFix:   { colIni: 2, colFin: 13, filaDatos: 7, colFechaAbs: 8 },   // B:M, datos desde fila 7, fecha en H
    tcVieja: { filaDatos: 7, bloques: { ARS: 2, USD: 5, AUD: 8, EUR: 11 } },   // B:C/E:F/H:I/K:L
    tcFix:   { filaDatos: 8, bloques: { ARS: 3, USD: 6, AUD: 9, EUR: 12 } },   // C:D/F:G/I:J/L:M
    cargasFixGrilla: { filaIni: 7, filaFin: 21 }               // C7:I21
};

// Remapeo semantico de las referencias al Plan de Cuentas (regla 1 de la
// cabecera). Son referencias de columna completa: bijetivas y reversibles.
var V011_REMAP_PLAN = [
    { de: '!R:T', a: '!L:N' },
    { de: '!V:W', a: '!P:Q' }
];

// Formula de la columna S del Plan nuevo (consolidacion de cuentas, espeja la
// Y del Plan viejo). Separador ";" y FLATTEN con argumentos multiples en vez
// de un array literal: las dos trampas de locale de la casa. Acotada a la
// fila 1000: defensa en profundidad ademas de la cuarentena del residual.
// SIN IFERROR a proposito: un error de la QUERY tiene que VERSE (y lo detecta
// la verificacion de escritura); envuelto en IFERROR("") seria indistinguible
// de un catalogo vacio. headers=0 explicito: sin el, QUERY adivina y podria
// tragarse la primera cuenta como encabezado.
var V011_FORMULA_S8 =
    '=QUERY(FLATTEN(C8:C1000;F8:F1000;I8:I1000;L8:L1000);"select * where Col1 is not null";0)';
var V011_FORMULA_S8_ENUS =
    '=QUERY(FLATTEN(C8:C1000,F8:F1000,I8:I1000,L8:L1000),"select * where Col1 is not null",0)';

// ============================================
// HELPERS DEL MODULO (autocontenidos, sufijo V011)
// ============================================

/** Ejecuta fn bajo el lock del documento, salvo que el llamador ya lo tenga. */
function _conLockV011(yaConLock, fn) {
    if (yaConLock === true) return fn();
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(V011_LOCK_MS)) {
        return {
            ok: false,
            error: 'No se pudo tomar el lock del documento en ' + (V011_LOCK_MS / 1000) +
                   's. Hay otra ejecucion en curso: esperar y reintentar. No se toco ninguna celda.'
        };
    }
    try {
        return fn();
    } finally {
        lock.releaseLock();
    }
}

/** Devuelve la UI si el contexto la tiene (menu), o null (ejecucion headless). */
function _uiV011() {
    try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

/** Alerta best-effort: en contexto headless no rompe, solo loguea. */
function _alertaV011(titulo, texto) {
    var ui = _uiV011();
    if (!ui) { logInfo('[V011] ' + titulo + ': ' + texto); return; }
    var recorte = texto.length > 1800
        ? texto.substring(0, 1800) + '\n\n[...] Informe completo en los logs (Ver > Registros de ejecucion).'
        : texto;
    try { ui.alert(titulo, recorte, ui.ButtonSet.OK); }
    catch (e) { logInfo('_alertaV011: sin UI para "' + titulo + '"'); }
}

/** Muestra el resultado si su propio camino no lo aviso ya. */
function _informarResultadoV011(titulo, r) {
    if (!r) return r;
    if (r.ok === false && r.error && r._avisado !== true) _alertaV011(titulo, r.error);
    if (r.ok === true && r.detalle && r._avisado !== true) _alertaV011(titulo, r.detalle);
    delete r._avisado;
    return r;
}

/** Sello 'yyyy-MM-dd' para el nombre de los respaldos. */
function _selloV011() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Lee el estado guardado. {} si no hay; {_corrupto:true} si es ilegible. */
function _leerEstadoV011() {
    var crudo = null;
    try {
        crudo = PropertiesService.getDocumentProperties().getProperty(V011_PROP_ESTADO);
        if (!crudo) return {};
        var obj = JSON.parse(crudo);
        if (!obj || typeof obj !== 'object') throw new Error('el estado guardado no es un objeto');
        return obj;
    } catch (e) {
        logError('_leerEstadoV011: estado ILEGIBLE en DocumentProperties', e);
        return { _corrupto: true, _crudo: String(crudo).substring(0, 300) };
    }
}

/** Persiste el estado (merge). Las claves internas (_*) no se persisten. */
function _guardarEstadoV011(parcial) {
    var previo = _leerEstadoV011();
    var estado = {};
    for (var k0 in previo) {
        if (Object.prototype.hasOwnProperty.call(previo, k0) && k0.charAt(0) !== '_') estado[k0] = previo[k0];
    }
    for (var k in parcial) {
        if (Object.prototype.hasOwnProperty.call(parcial, k)) estado[k] = parcial[k];
    }
    estado.version = V011_VERSION;
    PropertiesService.getDocumentProperties().setProperty(V011_PROP_ESTADO, JSON.stringify(estado));
    return estado;
}

/** true si hay una corrida iniciada que no se completo ni se revirtio. */
function _swapEnVueloV011(estado) {
    return !!(estado && estado.iniciadaEn && !estado.completadaEn && !estado.revertidaEn);
}

/** true si el swap esta aplicado y vigente. */
function _swapAplicadoV011(estado) {
    return !!(estado && estado.completadaEn && !estado.revertidaEn);
}

/**
 * Busca una hoja por nombre SIN distinguir mayusculas. getSheetByName es
 * case-sensitive, pero la unicidad de nombres de Sheets NO lo es: este helper
 * se usa tanto para encontrar la vieja 'Tipos de cambio' como para chequear
 * colisiones de nombre antes de renombrar.
 */
function _hojaInsensibleV011(ss, nombre) {
    var objetivo = String(nombre).toLowerCase();
    var hojas = ss.getSheets();
    for (var i = 0; i < hojas.length; i++) {
        if (hojas[i].getName().toLowerCase() === objetivo) return hojas[i];
    }
    return null;
}

/** Invalida el cache de nombres del resolver de alias, si el SSOT lo expone. */
function _invalidarCacheV011() {
    try {
        if (typeof invalidarCacheNombresHojas === 'function') invalidarCacheNombresHojas();
    } catch (e) {
        logError('_invalidarCacheV011', e);
    }
}

/**
 * Clave de comparacion de una fila de Registros: las 12 columnas B:M.
 * Una fila EDITADA en cualquier columna deja de matchear y aparece como
 * diferencia en ambos sentidos, que es lo que frena el swap para que el
 * operador mire: una diferencia no entendida nunca se pisa ni se ignora.
 */
function _claveRegistroV011(fila) {
    var partes = [];
    for (var i = 0; i < fila.length; i++) {
        var v = fila[i];
        if (v instanceof Date) partes.push('D' + v.getTime());
        else if (typeof v === 'number') partes.push('N' + v);
        else partes.push('S' + String(v).trim());
    }
    return partes.join('|');
}

/** Lee las filas de datos B:M de una hoja de Registros desde filaDatos. */
function _filasRegistrosV011(hoja, geo) {
    var ultima = hoja.getLastRow();
    if (ultima < geo.filaDatos) return [];
    var valores = hoja.getRange(geo.filaDatos, geo.colIni, ultima - geo.filaDatos + 1,
                                geo.colFin - geo.colIni + 1).getValues();
    var filas = [];
    for (var i = 0; i < valores.length; i++) {
        if (valores[i][0] !== '' && valores[i][0] !== null) filas.push(valores[i]);
    }
    return filas;
}

/**
 * Compara Registros vieja contra Fix como multiconjuntos de filas completas.
 * El caso esperado es que la vieja tenga filas de MAS (Franco cargo despues
 * de duplicar): esas se sincronizan. Filas solo en la Fix (o filas editadas,
 * que aparecen en ambos lados como distintas) frenan el swap.
 */
function _compararRegistrosV011(hojaVieja, hojaFix) {
    var viejas = _filasRegistrosV011(hojaVieja, V011_GEO.registrosVieja);
    var fixs = _filasRegistrosV011(hojaFix, V011_GEO.registrosFix);
    var enFix = {};
    for (var i = 0; i < fixs.length; i++) {
        var kf = _claveRegistroV011(fixs[i]);
        enFix[kf] = (enFix[kf] || 0) + 1;
    }
    var soloVieja = [];
    var restante = {};
    for (var k in enFix) restante[k] = enFix[k];
    for (var j = 0; j < viejas.length; j++) {
        var kv = _claveRegistroV011(viejas[j]);
        if (restante[kv]) restante[kv]--;
        else soloVieja.push(viejas[j]);
    }
    var soloFix = 0;
    for (var k2 in restante) soloFix += restante[k2];
    return { totalVieja: viejas.length, totalFix: fixs.length, soloVieja: soloVieja, soloFix: soloFix };
}

/** Lee un bloque de Tipos de cambio como mapa fecha(dia)->cotizacion. */
function _mapaTcV011(hoja, colFecha, filaDatos) {
    var ultima = hoja.getLastRow();
    var mapa = {};
    if (ultima < filaDatos) return mapa;
    var valores = hoja.getRange(filaDatos, colFecha, ultima - filaDatos + 1, 2).getValues();
    for (var i = 0; i < valores.length; i++) {
        var f = valores[i][0];
        if (f === '' || f === null) continue;
        var clave = (f instanceof Date)
            ? Utilities.formatDate(f, Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(f).trim();
        if (!(clave in mapa)) mapa[clave] = { fecha: f, cotizacion: valores[i][1] };
    }
    return mapa;
}

/**
 * Compara los 4 bloques de TC vieja vs Fix. Ademas del delta de fechas,
 * detecta cotizaciones DISTINTAS para una misma fecha (correccion manual
 * post-duplicado): eso tambien frena el swap, porque "solo agregar" no la
 * propagaria y moriria con la purga.
 */
function _compararTcV011(hojaVieja, hojaFix) {
    var res = {};
    for (var mon in V011_GEO.tcVieja.bloques) {
        var mv = _mapaTcV011(hojaVieja, V011_GEO.tcVieja.bloques[mon], V011_GEO.tcVieja.filaDatos);
        var mf = _mapaTcV011(hojaFix, V011_GEO.tcFix.bloques[mon], V011_GEO.tcFix.filaDatos);
        var soloVieja = [];
        var soloFix = 0;
        var divergentes = [];
        for (var k in mv) {
            if (!(k in mf)) soloVieja.push(mv[k]);
            else if (String(mv[k].cotizacion) !== String(mf[k].cotizacion)) divergentes.push(k);
        }
        for (var k2 in mf) { if (!(k2 in mv)) soloFix++; }
        res[mon] = {
            totalVieja: Object.keys(mv).length, totalFix: Object.keys(mf).length,
            soloVieja: soloVieja, soloFix: soloFix, divergentes: divergentes
        };
    }
    return res;
}

/**
 * Reescribe en un string de formula toda referencia al respaldo de Registros:
 * cambia la hoja a 'Registros' y suma 1 a CADA numero de fila del rango
 * (la BD nueva corrio una fila: header 5->6, datos 6->7). Las referencias de
 * columna completa (sin numero) solo cambian de hoja. deltaFilas = -1 hace la
 * inversa (revertir). Si el corrimiento produjera una fila menor a 1 (una
 * referencia a la fila 1 en la inversa), la referencia NO se toca: corromper
 * una formula es peor que dejarla redirigida.
 */
function _ajustarRefRegistrosV011(formula, nombreOrigen, nombreDestino, deltaFilas) {
    var esc = String(nombreOrigen).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp("'" + esc + "'!(\\$?)([A-Z]{1,3})(\\$?)(\\d+)?(:(\\$?)([A-Z]{1,3})(\\$?)(\\d+)?)?", 'g');
    var destino = nombreDestino.indexOf(' ') >= 0 || nombreDestino.indexOf('-') >= 0
        ? "'" + nombreDestino + "'" : nombreDestino;
    return formula.replace(re, function (m, d1, c1, d2, r1, resto, d3, c2, d4, r2) {
        var n1 = r1 ? parseInt(r1, 10) + deltaFilas : null;
        var n2 = r2 ? parseInt(r2, 10) + deltaFilas : null;
        if ((n1 !== null && n1 < 1) || (n2 !== null && n2 < 1)) return m;
        var out = destino + '!' + d1 + c1 + d2 + (n1 !== null ? n1 : '');
        if (resto) out += ':' + d3 + c2 + d4 + (n2 !== null ? n2 : '');
        return out;
    });
}

/**
 * Repuntea, celda por celda, las referencias de una hoja al respaldo de
 * Registros. Devuelve las celdas tocadas con su formula anterior (para poder
 * deshacer exacto en el rollback).
 */
function _repuntearRegistrosV011(hoja, nombreOrigen, nombreDestino, deltaFilas) {
    var tocadas = [];
    var celdas = hoja.createTextFinder("'" + nombreOrigen + "'!").matchFormulaText(true).findAll();
    for (var i = 0; i < celdas.length; i++) {
        var formula = celdas[i].getFormula();
        if (!formula) continue;
        var nueva = _ajustarRefRegistrosV011(formula, nombreOrigen, nombreDestino, deltaFilas);
        if (nueva !== formula) {
            tocadas.push({ a1: celdas[i].getA1Notation(), anterior: formula });
            celdas[i].setFormula(nueva);
        }
    }
    return tocadas;
}

/**
 * Escribe la formula de S8 y VERIFICA el resultado (trampa de locale).
 * Exito = la celda evalua a un valor no vacio y sin '#': con el catalogo real
 * (siempre tiene cuentas) cualquier otra cosa es una formula rota. La
 * formula no lleva IFERROR justamente para que un fallo de evaluacion no se
 * disfrace de catalogo vacio.
 */
function _escribirConsolidacionV011(hojaPlan) {
    hojaPlan.getRange('S7').setValue('Cuentas (fuente de validacion - no tocar)');
    var celda = hojaPlan.getRange('S8');
    var variantes = [V011_FORMULA_S8, V011_FORMULA_S8_ENUS];
    for (var i = 0; i < variantes.length; i++) {
        celda.setFormula(variantes[i]);
        SpreadsheetApp.flush();
        var v = celda.getValue();
        var esError = (typeof v === 'string' && v.charAt(0) === '#');
        if (!esError && v !== '' && v !== null) {
            return { ok: true, separador: (i === 0 ? ';' : ',') };
        }
    }
    return { ok: false };
}

/** Aplica las validaciones de la grilla de Cargas contra el Plan canonico. */
function _validacionesCargasV011(hojaCargas, hojaPlan) {
    var g = V011_GEO.cargasFixGrilla;
    var tope = V011_FILA_TOPE_CATALOGO;
    var reglaCuenta = SpreadsheetApp.newDataValidation()
        .requireValueInRange(hojaPlan.getRange('S8:S' + tope), true)
        .setAllowInvalid(true).build();
    hojaCargas.getRange('E' + g.filaIni + ':E' + g.filaFin).setDataValidation(reglaCuenta);
    var reglaMedio = SpreadsheetApp.newDataValidation()
        .requireValueInRange(hojaPlan.getRange('L8:L' + tope), true)
        .setAllowInvalid(true).build();
    hojaCargas.getRange('F' + g.filaIni + ':F' + g.filaFin).setDataValidation(reglaMedio);
}

/**
 * Mueve a una hoja de cuarentena oculta todo contenido del Plan por debajo
 * del tope del catalogo (el bloque residual C1005:N1033 que la Fix arrastra;
 * si se dejara, getLastRow/appendRow del ABM y los dropdowns lo ingeririan
 * como cuentas). Nada se borra: los valores quedan en la cuarentena.
 * Devuelve null si no habia residual.
 */
function _cuarentenaResidualV011(ss, hojaPlan, sello) {
    var ultima = hojaPlan.getLastRow();
    var desde = V011_FILA_TOPE_CATALOGO + 1;
    if (ultima < desde) return null;
    var ancho = Math.max(hojaPlan.getLastColumn(), 14);
    var rango = hojaPlan.getRange(desde, 1, ultima - desde + 1, ancho);
    var valores = rango.getValues();
    var hayAlgo = false;
    for (var i = 0; i < valores.length && !hayAlgo; i++) {
        for (var j = 0; j < valores[i].length; j++) {
            if (valores[i][j] !== '' && valores[i][j] !== null) { hayAlgo = true; break; }
        }
    }
    if (!hayAlgo) return null;
    var nombre = 'Cuarentena Plan (' + sello + ')';
    var n = 2;
    while (ss.getSheetByName(nombre)) { nombre = 'Cuarentena Plan (' + sello + ')_' + n; n++; }
    var hojaQ = ss.insertSheet(nombre);
    hojaQ.getRange(1, 1).setValue('Contenido movido desde "Plan de Cuentas" filas ' + desde + '-' + ultima +
        ' por el swap v0.11 (residual fuera del catalogo). Decidir con Franco si se conserva o se borra.');
    hojaQ.getRange(3, 1, valores.length, valores[0].length).setValues(valores);
    hojaQ.hideSheet();
    rango.clearContent();
    return { hoja: nombre, filas: valores.length, desde: desde };
}

/** Resumen de presencia de hojas y deltas, compartido por estado y preflight. */
function _diagnosticoV011(ss, estado) {
    var d = { pares: [], problemas: [], deltaRegistros: null, deltaTc: null, pendienteSync: false, aplicado: false };

    // Con el swap aplicado el diagnostico cambia de pregunta: ya no busca las
    // hojas Fix (no existen mas con ese nombre), verifica que las canonicas y
    // los respaldos registrados esten donde el estado dice.
    if (_swapAplicadoV011(estado)) {
        d.aplicado = true;
        for (var a = 0; a < V011_SWAPS.length; a++) {
            var hayCanonica = !!ss.getSheetByName(V011_SWAPS[a].canonico);
            d.pares.push({ fix: V011_SWAPS[a].fix, canonico: V011_SWAPS[a].canonico, hayFix: false, nombreVieja: null, hayCanonica: hayCanonica });
            if (!hayCanonica) d.problemas.push('Falta la hoja canonica "' + V011_SWAPS[a].canonico + '".');
        }
        var respaldos = estado.respaldos || [];
        if (!estado.purgadaEn) {
            for (var b = 0; b < respaldos.length; b++) {
                if (!ss.getSheetByName(respaldos[b])) d.problemas.push('Falta el respaldo "' + respaldos[b] + '".');
            }
        }
        return d;
    }

    for (var i = 0; i < V011_SWAPS.length; i++) {
        var s = V011_SWAPS[i];
        var hojaFix = ss.getSheetByName(s.fix);
        var hojaVieja = _hojaInsensibleV011(ss, s.canonico);
        d.pares.push({
            fix: s.fix, canonico: s.canonico,
            hayFix: !!hojaFix,
            nombreVieja: hojaVieja ? hojaVieja.getName() : null
        });
        if (!hojaFix) d.problemas.push('Falta la hoja "' + s.fix + '".');
    }
    var regVieja = _hojaInsensibleV011(ss, 'Registros');
    var regFix = ss.getSheetByName('Registros - Fix');
    if (regVieja && regFix && regVieja.getSheetId() !== regFix.getSheetId()) {
        d.deltaRegistros = _compararRegistrosV011(regVieja, regFix);
        if (d.deltaRegistros.soloVieja.length > 0) d.pendienteSync = true;
        if (d.deltaRegistros.soloFix > 0) {
            d.problemas.push('Registros - Fix tiene ' + d.deltaRegistros.soloFix +
                ' fila(s) que la vieja NO tiene (o filas editadas que ya no coinciden). Revisar a mano antes del swap.');
        }
    }
    var tcVieja = _hojaInsensibleV011(ss, 'Tipos de Cambio');
    var tcFix = ss.getSheetByName('Tipos de Cambio - Fix');
    if (tcVieja && tcFix && tcVieja.getSheetId() !== tcFix.getSheetId()) {
        d.deltaTc = _compararTcV011(tcVieja, tcFix);
        for (var mon in d.deltaTc) {
            if (d.deltaTc[mon].soloVieja.length > 0) d.pendienteSync = true;
            if (d.deltaTc[mon].soloFix > 0) {
                d.problemas.push('Tipos de Cambio - Fix (' + mon + ') tiene ' + d.deltaTc[mon].soloFix +
                    ' fecha(s) que la vieja no tiene. Revisar a mano.');
            }
            if (d.deltaTc[mon].divergentes.length > 0) {
                d.problemas.push('Tipos de Cambio (' + mon + '): cotizacion DISTINTA entre vieja y Fix para ' +
                    d.deltaTc[mon].divergentes.length + ' fecha(s) (' +
                    d.deltaTc[mon].divergentes.slice(0, 3).join(', ') + '...). Revisar a mano.');
            }
        }
    }
    return d;
}

// ============================================
// 1. VER ESTADO (no escribe nada)
// ============================================

function estadoSwapV011() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var estado = _leerEstadoV011();
    var d = _diagnosticoV011(ss, estado);
    var lineas = ['SWAP DE HOJAS FIX - estado (v' + V011_VERSION + ')', ''];
    var problemasEstado = [];

    if (estado._corrupto) problemasEstado.push('El estado guardado es ILEGIBLE: no aplicar ni purgar hasta resolverlo.');
    if (_swapEnVueloV011(estado)) {
        problemasEstado.push('Hay una corrida iniciada el ' + estado.iniciadaEn +
            ' que no termino. Usar "4. Revertir" para reconciliar.');
    }

    if (d.aplicado) {
        lineas.push('El swap YA FUE APLICADO el ' + estado.completadaEn +
                    (estado.purgadaEn ? ' y los respaldos fueron purgados el ' + estado.purgadaEn + '.' : '. Respaldos ocultos disponibles.'));
        if (estado.remanentes && estado.remanentes.length) {
            lineas.push('Referencias que quedaron mirando respaldos (fase formulerio): ' + estado.remanentes.join(', '));
        }
        if (estado.cuarentena) {
            lineas.push('Residual del Plan en cuarentena: hoja oculta "' + estado.cuarentena.hoja + '" (' + estado.cuarentena.filas + ' filas).');
        }
    } else if (problemasEstado.length === 0) {
        lineas.push('El swap todavia no fue aplicado.');
    }
    lineas.push('');
    lineas.push('Hojas:');
    for (var i = 0; i < d.pares.length; i++) {
        var p = d.pares[i];
        if (d.aplicado) {
            lineas.push('  ' + p.canonico + '  [' + (p.hayCanonica ? 'ok' : 'FALTA') + ']');
        } else {
            lineas.push('  ' + p.fix + ' -> ' + p.canonico + '  [Fix: ' + (p.hayFix ? 'ok' : 'FALTA') +
                        ' | vieja: ' + (p.nombreVieja ? p.nombreVieja : 'no hay (solo renombre)') + ']');
        }
    }
    if (d.deltaRegistros) {
        lineas.push('');
        lineas.push('Registros: vieja ' + d.deltaRegistros.totalVieja + ' filas, Fix ' + d.deltaRegistros.totalFix +
                    '. Solo en la vieja: ' + d.deltaRegistros.soloVieja.length + '. Solo en la Fix: ' + d.deltaRegistros.soloFix + '.');
    }
    if (d.deltaTc) {
        var partes = [];
        for (var mon in d.deltaTc) {
            partes.push(mon + ': vieja ' + d.deltaTc[mon].totalVieja + ' / Fix ' + d.deltaTc[mon].totalFix +
                        ' / solo vieja ' + d.deltaTc[mon].soloVieja.length);
        }
        lineas.push('Tipos de cambio: ' + partes.join(' | '));
    }
    if (!d.aplicado) lineas.push('Plan de Cuentas: reestructurado, no se compara. La Fix es la verdad nueva.');
    if (d.pendienteSync) {
        lineas.push('');
        lineas.push('HAY DATOS SIN SINCRONIZAR: correr "2. Sincronizar BDs" antes de aplicar.');
    }
    var todosProblemas = problemasEstado.concat(d.problemas);
    if (todosProblemas.length) {
        lineas.push('');
        lineas.push('Problemas: ' + todosProblemas.join(' / '));
    }
    var texto = lineas.join('\n');
    logInfo('[V011] ' + texto);
    _alertaV011('Swap hojas Fix - estado', texto);
    return { ok: todosProblemas.length === 0, detalle: texto, _avisado: true };
}

// ============================================
// 2. SINCRONIZAR BDs (viejas -> Fix)
// ============================================

/**
 * Copia a las BDs Fix lo que Franco cargo en las viejas DESPUES de
 * duplicarlas: filas de Registros y fechas de Tipos de cambio que existen
 * en la vieja y faltan en la Fix. Solo agrega, nunca borra. Las filas nuevas
 * se apilan DEBAJO de la ultima fila de datos (mismo criterio que
 * appendMassive: heredan formato de datos, no del header) y al final se
 * ordena por fecha descendente (regla de la casa: Z-A).
 */
function sincronizarBDsV011(yaConLock) {
    var r = _conLockV011(yaConLock, function () {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var estado = _leerEstadoV011();
        if (estado._corrupto) return { ok: false, error: 'El estado guardado es ilegible. No se sincroniza.' };
        if (_swapAplicadoV011(estado)) {
            return { ok: false, error: 'El swap ya fue aplicado: las BDs canonicas son las nuevas y no hay nada que sincronizar.' };
        }
        var partes = [];
        var avisos = [];

        // --- FASE DE ANALISIS: todos los deltas y TODOS los chequeos de aborto
        // se resuelven ANTES de escribir una sola celda. Un "revisar a mano"
        // con escrituras parciales ya hechas le mentiria al operador.
        var regVieja = _hojaInsensibleV011(ss, 'Registros');
        var regFix = ss.getSheetByName('Registros - Fix');
        var delta = null;
        if (!regVieja || !regFix) {
            avisos.push('Registros: no estan las dos hojas (vieja y Fix), no se comparo.');
        } else if (regVieja.getSheetId() !== regFix.getSheetId()) {
            delta = _compararRegistrosV011(regVieja, regFix);
            if (delta.soloFix > 0) {
                return { ok: false, error: 'Registros - Fix tiene ' + delta.soloFix +
                    ' fila(s) que la vieja no tiene (o filas editadas que ya no coinciden). ' +
                    'Sincronizar seria pisar una diferencia no entendida: revisar a mano. No se toco ninguna celda.' };
            }
        }
        var tcVieja = _hojaInsensibleV011(ss, 'Tipos de Cambio');
        var tcFix = ss.getSheetByName('Tipos de Cambio - Fix');
        var deltasTc = null;
        if (!tcVieja || !tcFix) {
            avisos.push('Tipos de cambio: no estan las dos hojas (vieja y Fix), no se comparo.');
        } else if (tcVieja.getSheetId() !== tcFix.getSheetId()) {
            deltasTc = _compararTcV011(tcVieja, tcFix);
            for (var monChk in deltasTc) {
                if (deltasTc[monChk].divergentes.length > 0) {
                    return { ok: false, error: 'Tipos de Cambio (' + monChk + '): cotizacion DISTINTA entre vieja y Fix para ' +
                        deltasTc[monChk].divergentes.length + ' fecha(s): ' + deltasTc[monChk].divergentes.slice(0, 5).join(', ') +
                        '. Sincronizar no propagaria la correccion: revisar a mano. No se toco ninguna celda.' };
                }
            }
        }

        // --- FASE DE ESCRITURA ---
        if (delta && delta.soloVieja.length > 0) {
            var geo = V011_GEO.registrosFix;
            var anchoReg = geo.colFin - geo.colIni + 1;
            // Ultima fila con dato en CUALQUIERA de las 12 columnas: una fila a
            // medio cargar (Monto vacio pero detalle tipeado) tambien cuenta,
            // apilarse "debajo de la ultima B" la pisaria en silencio.
            var ultimaDato = geo.filaDatos - 1;
            var banda = regFix.getRange(geo.filaDatos, geo.colIni,
                Math.max(regFix.getLastRow() - geo.filaDatos + 1, 1), anchoReg).getValues();
            for (var i0 = 0; i0 < banda.length; i0++) {
                for (var j0 = 0; j0 < anchoReg; j0++) {
                    if (banda[i0][j0] !== '' && banda[i0][j0] !== null) { ultimaDato = geo.filaDatos + i0; break; }
                }
            }
            var faltanFilas = (ultimaDato + delta.soloVieja.length) - regFix.getMaxRows();
            if (faltanFilas > 0) regFix.insertRowsAfter(regFix.getMaxRows(), faltanFilas + 50);
            regFix.getRange(ultimaDato + 1, geo.colIni, delta.soloVieja.length, anchoReg)
                  .setValues(delta.soloVieja);
            try {
                // Range.sort usa el indice ABSOLUTO de columna de la hoja (fecha = H).
                regFix.getRange(geo.filaDatos, geo.colIni,
                    ultimaDato + delta.soloVieja.length - geo.filaDatos + 1, anchoReg)
                      .sort({ column: geo.colFechaAbs, ascending: false });
            } catch (eSort) {
                logError('sincronizarBDsV011: fallo el sort de Registros - Fix (datos ya escritos)', eSort);
                avisos.push('Registros: las filas se copiaron pero el ORDEN Z-A fallo (' + eSort + '). Ordenar a mano por Fecha descendente.');
            }
            partes.push('Registros: +' + delta.soloVieja.length + ' fila(s)');
        } else if (delta) {
            partes.push('Registros: sin diferencias');
        }

        if (deltasTc) {
            for (var mon in deltasTc) {
                var dm = deltasTc[mon];
                if (dm.soloVieja.length === 0) continue;
                var colFecha = V011_GEO.tcFix.bloques[mon];
                var filaDatos = V011_GEO.tcFix.filaDatos;
                var ultimaFila = filaDatos - 1;
                var col = tcFix.getRange(filaDatos, colFecha, Math.max(tcFix.getLastRow() - filaDatos + 1, 1), 2).getValues();
                for (var i = 0; i < col.length; i++) {
                    if ((col[i][0] !== '' && col[i][0] !== null) || (col[i][1] !== '' && col[i][1] !== null)) {
                        ultimaFila = filaDatos + i;
                    }
                }
                var faltan = ultimaFila + dm.soloVieja.length - tcFix.getMaxRows();
                if (faltan > 0) tcFix.insertRowsAfter(tcFix.getMaxRows(), faltan + 50);
                var filasNuevas = [];
                for (var j = 0; j < dm.soloVieja.length; j++) {
                    filasNuevas.push([dm.soloVieja[j].fecha, dm.soloVieja[j].cotizacion]);
                }
                tcFix.getRange(ultimaFila + 1, colFecha, filasNuevas.length, 2).setValues(filasNuevas);
                try {
                    tcFix.getRange(filaDatos, colFecha, ultimaFila + filasNuevas.length - filaDatos + 1, 2)
                         .sort({ column: colFecha, ascending: false });
                } catch (eSortTc) {
                    logError('sincronizarBDsV011: fallo el sort del bloque TC ' + mon, eSortTc);
                    avisos.push('TC ' + mon + ': fechas copiadas pero el orden Z-A fallo. Ordenar a mano.');
                }
                partes.push('TC ' + mon + ': +' + filasNuevas.length + ' fecha(s)');
            }
        }

        var detalle = (partes.length ? 'Sincronizacion terminada. ' + partes.join(' | ')
                                     : 'No habia nada para sincronizar.') +
                      (avisos.length ? '\nAvisos: ' + avisos.join(' / ') : '');
        logInfo('[V011] ' + detalle);
        return { ok: true, detalle: detalle };
    });
    return _informarResultadoV011('Swap hojas Fix - sincronizar', r);
}

// ============================================
// 3. APLICAR
// ============================================

function aplicarSwapV011() {
    var r = _conLockV011(false, function () {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var estado = _leerEstadoV011();

        // --- Preflight: nada se toca hasta pasar TODOS los chequeos ---
        if (estado._corrupto) return { ok: false, error: 'El estado guardado es ilegible. No se aplica.' };
        if (_swapAplicadoV011(estado)) {
            return { ok: false, error: 'El swap ya fue aplicado el ' + estado.completadaEn + '. No se aplica dos veces.' };
        }
        if (_swapEnVueloV011(estado)) {
            return { ok: false, error: 'Hay una corrida iniciada el ' + estado.iniciadaEn +
                ' que no termino. Correr "4. Revertir": reconcilia los renombres a medio hacer y limpia el estado.' };
        }
        var d = _diagnosticoV011(ss, estado);
        if (d.problemas.length) return { ok: false, error: 'Preflight fallo: ' + d.problemas.join(' / ') };
        if (d.pendienteSync) {
            return { ok: false, error: 'Hay datos en las BDs viejas que faltan en las Fix. ' +
                'Correr "2. Sincronizar BDs" primero: si no, el swap dejaria afuera esos movimientos.' };
        }

        var sello = _selloV011();
        var plan = [];   // {fix, canonico, hojaFix, hojaVieja|null, respaldo|null}
        for (var i = 0; i < V011_SWAPS.length; i++) {
            var s = V011_SWAPS[i];
            var hojaFix = ss.getSheetByName(s.fix);
            var hojaVieja = _hojaInsensibleV011(ss, s.canonico);
            var respaldo = null;
            if (hojaVieja) {
                respaldo = s.canonico + ' (anterior ' + sello + ')';
                // La unicidad de nombres de Sheets es case-insensitive: el chequeo tambien.
                if (_hojaInsensibleV011(ss, respaldo)) {
                    return { ok: false, error: 'Ya existe una hoja "' + respaldo + '". Renombrarla o borrarla antes de aplicar.' };
                }
            }
            plan.push({ fix: s.fix, canonico: s.canonico, hojaFix: hojaFix, hojaVieja: hojaVieja, respaldo: respaldo });
        }

        _guardarEstadoV011({ iniciadaEn: new Date().toISOString(), sello: sello,
                             completadaEn: null, revertidaEn: null, purgadaEn: null,
                             cuarentena: null, respaldos: null, repunteos: null, remanentes: null });

        // pasos ejecutados, para poder deshacer en orden inverso si algo revienta
        var hechos = [];
        try {
            // --- Paso 1: viejas -> respaldo (y ocultar) ---
            for (var p1 = 0; p1 < plan.length; p1++) {
                var it1 = plan[p1];
                if (!it1.hojaVieja) continue;
                var nombreOriginal = it1.hojaVieja.getName();
                it1.hojaVieja.setName(it1.respaldo);
                it1.hojaVieja.hideSheet();
                hechos.push({ tipo: 'renombreVieja', de: nombreOriginal, a: it1.respaldo });
            }
            // --- Paso 2: Fix -> canonico ---
            for (var p2 = 0; p2 < plan.length; p2++) {
                var it2 = plan[p2];
                it2.hojaFix.setName(it2.canonico);
                hechos.push({ tipo: 'renombreFix', de: it2.fix, a: it2.canonico });
            }
            _invalidarCacheV011();

            // --- Paso 3: repunteo de formulas en las 8 hojas nuevas ---
            // Tras el paso 1 toda referencia que miraba una hoja vieja quedo
            // reescrita por Sheets como "'<respaldo>'!". Solo se repuntea lo
            // que las dos reglas semanticas de la cabecera cubren; el resto se
            // lista. Los respaldos no se tocan: se leen entre si, que es lo
            // que los mantiene consistentes como foto del pasado.
            var repunteos = [];
            var respaldoPlan = null;
            var respaldoRegistros = null;
            for (var rp = 0; rp < plan.length; rp++) {
                if (plan[rp].canonico === 'Plan de Cuentas') respaldoPlan = plan[rp].respaldo;
                if (plan[rp].canonico === 'Registros') respaldoRegistros = plan[rp].respaldo;
            }
            for (var p3 = 0; p3 < plan.length; p3++) {
                var hojaNueva = plan[p3].hojaFix;   // ya renombrada a canonico
                // 3a. Plan de Cuentas: remapeo de columnas (R:T->L:N, V:W->P:Q),
                // columnas completas: el corrimiento de filas no afecta.
                if (respaldoPlan) {
                    for (var rm = 0; rm < V011_REMAP_PLAN.length; rm++) {
                        var buscado = "'" + respaldoPlan + "'" + V011_REMAP_PLAN[rm].de;
                        var reemplazo = "'Plan de Cuentas'" + V011_REMAP_PLAN[rm].a;
                        var n = hojaNueva.createTextFinder(buscado).matchFormulaText(true).replaceAllWith(reemplazo);
                        if (n > 0) {
                            repunteos.push(hojaNueva.getName() + ': ' + n + ' x Plan ' + V011_REMAP_PLAN[rm].de + ' -> ' + V011_REMAP_PLAN[rm].a);
                            hechos.push({ tipo: 'repunteoPlan', hoja: hojaNueva.getName(), buscado: buscado, reemplazo: reemplazo });
                        }
                    }
                }
                // 3b. Registros: cambio de hoja + corrimiento de UNA fila en cada
                // numero de fila del rango (header 5->6, datos 6->7). Celda por
                // celda, guardando la formula anterior para el rollback.
                if (respaldoRegistros) {
                    var tocadas = _repuntearRegistrosV011(hojaNueva, respaldoRegistros, 'Registros', +1);
                    if (tocadas.length > 0) {
                        repunteos.push(hojaNueva.getName() + ': ' + tocadas.length + ' x Registros (+1 fila)');
                        hechos.push({ tipo: 'repunteoRegistros', hoja: hojaNueva.getName(), celdas: tocadas });
                    }
                }
            }
            // 3c. Remanentes: referencias a respaldos que ninguna regla cubrio
            // (p.ej. una referencia con rango a Tipos de cambio, que corrio de
            // fila Y de columna). No se tocan: se listan para el formulerio.
            var remanentes = [];
            for (var p3c = 0; p3c < plan.length; p3c++) {
                var hojaChk = plan[p3c].hojaFix;
                for (var p3d = 0; p3d < plan.length; p3d++) {
                    if (!plan[p3d].respaldo) continue;
                    var hallados = hojaChk.createTextFinder("'" + plan[p3d].respaldo + "'!")
                                          .matchFormulaText(true).findAll();
                    for (var h = 0; h < hallados.length; h++) {
                        remanentes.push(hojaChk.getName() + '!' + hallados[h].getA1Notation() + ' -> ' + plan[p3d].respaldo);
                    }
                }
            }

            // --- Paso 4: cuarentena del residual del Plan ---
            var hojaPlanNueva = ss.getSheetByName('Plan de Cuentas');
            var cuarentena = _cuarentenaResidualV011(ss, hojaPlanNueva, sello);
            if (cuarentena) {
                hechos.push({ tipo: 'cuarentena', hoja: cuarentena.hoja, desde: cuarentena.desde });
                // Se persiste YA, no recien al final: si la corrida muere sin catch
                // (timeout, corte manual), revertir tiene que saber que la cuarentena
                // existe para devolverla en la reconciliacion.
                _guardarEstadoV011({ cuarentena: { hoja: cuarentena.hoja, filas: cuarentena.filas, desde: cuarentena.desde } });
            }

            // --- Paso 5: columna S del Plan nuevo (consolidacion de cuentas) ---
            var resS = _escribirConsolidacionV011(hojaPlanNueva);
            hechos.push({ tipo: 'columnaS' });
            var avisoS = resS.ok ? null
                : 'ATENCION: la formula de consolidacion (Plan!S8) quedo con error en los dos separadores. ' +
                  'El dropdown de Cuenta de Cargas va a estar vacio hasta arreglarla a mano.';

            // --- Paso 6: validaciones de Cargas que el renombre no arrastra ---
            // Las fuentes de Validacion de Datos siguen al objeto hoja: los
            // dropdowns de Cuenta y Medio quedaron mirando el respaldo del Plan
            // (y Cuenta ademas miraba la columna Y, que el Plan nuevo no tiene).
            var hojaCargasNueva = ss.getSheetByName('Cargas');
            _validacionesCargasV011(hojaCargasNueva, hojaPlanNueva);
            hechos.push({ tipo: 'validaciones' });

            var respaldos = [];
            for (var rr = 0; rr < plan.length; rr++) { if (plan[rr].respaldo) respaldos.push(plan[rr].respaldo); }
            _guardarEstadoV011({
                completadaEn: new Date().toISOString(),
                respaldos: respaldos,
                repunteos: repunteos,
                remanentes: remanentes
            });
            _invalidarCacheV011();

            var detalle = 'Swap aplicado.\n' +
                '- Respaldos ocultos: ' + respaldos.length + ' (sufijo "(anterior ' + sello + ')").\n' +
                '- Repunteos: ' + (repunteos.length ? repunteos.join(' | ') : 'ninguno hizo falta') + '.\n' +
                '- Referencias que quedaron mirando respaldos (revisar en el formulerio): ' +
                (remanentes.length ? remanentes.join(', ') : 'ninguna') + '.\n' +
                (cuarentena ? '- Residual del Plan movido a la hoja oculta "' + cuarentena.hoja + '" (' + cuarentena.filas + ' filas).\n' : '') +
                '- Dropdowns de Cargas reconstruidos (Cuenta -> Plan!S, Medio -> Plan!L).\n' +
                (avisoS ? '- ' + avisoS + '\n' : '') +
                '\nLos respaldos NO se borraron: quedan ocultos. Verificar los tableros y despues correr "5. Purgar respaldos".';
            logInfo('[V011] ' + detalle);
            return { ok: true, detalle: detalle };

        } catch (e) {
            // Rollback en orden inverso: primero deshacer repunteos (mientras
            // los nombres siguen post-renombre), despues los renombres.
            logError('aplicarSwapV011: fallo a mitad de camino, deshaciendo', e);
            var rollbackOk = true;
            for (var u = hechos.length - 1; u >= 0; u--) {
                var paso = hechos[u];
                try {
                    if (paso.tipo === 'repunteoPlan') {
                        var hojaRb = ss.getSheetByName(paso.hoja);
                        if (hojaRb) hojaRb.createTextFinder(paso.reemplazo).matchFormulaText(true).replaceAllWith(paso.buscado);
                    } else if (paso.tipo === 'repunteoRegistros') {
                        var hojaRb2 = ss.getSheetByName(paso.hoja);
                        if (hojaRb2) {
                            for (var c = 0; c < paso.celdas.length; c++) {
                                hojaRb2.getRange(paso.celdas[c].a1).setFormula(paso.celdas[c].anterior);
                            }
                        }
                    } else if (paso.tipo === 'cuarentena') {
                        var hojaQ = ss.getSheetByName(paso.hoja);
                        var hojaPlanRb = ss.getSheetByName('Plan de Cuentas') || ss.getSheetByName('Plan de Cuentas - Fix');
                        if (hojaQ && hojaPlanRb) {
                            var datosQ = hojaQ.getDataRange().getValues().slice(2);
                            if (datosQ.length) {
                                hojaPlanRb.getRange(paso.desde, 1, datosQ.length, datosQ[0].length).setValues(datosQ);
                            }
                            ss.deleteSheet(hojaQ);
                        }
                    } else if (paso.tipo === 'columnaS') {
                        var hojaPlanRb2 = ss.getSheetByName('Plan de Cuentas') || ss.getSheetByName('Plan de Cuentas - Fix');
                        if (hojaPlanRb2) hojaPlanRb2.getRange('S7:S8').clearContent();
                    } else if (paso.tipo === 'validaciones') {
                        // Se restauran al final, cuando el Plan ya recupero su nombre viejo.
                    } else if (paso.tipo === 'renombreFix' || paso.tipo === 'renombreVieja') {
                        var hojaRen = ss.getSheetByName(paso.a);
                        if (hojaRen) {
                            hojaRen.setName(paso.de);
                            if (paso.tipo === 'renombreVieja') hojaRen.showSheet();
                        }
                    }
                } catch (e2) {
                    rollbackOk = false;
                    logError('aplicarSwapV011: fallo el rollback del paso ' + u + ' (' + paso.tipo + ')', e2);
                }
            }
            // Dropdowns de Cargas - Fix de vuelta a sus fuentes viejas, best-effort.
            try { _restaurarValidacionesViejasV011(ss); } catch (e3) { logError('rollback validaciones', e3); }
            _invalidarCacheV011();
            if (rollbackOk) {
                _guardarEstadoV011({ revertidaEn: new Date().toISOString(), errorUltimaCorrida: String(e), cuarentena: null });
                return { ok: false, error: 'El swap fallo y se deshizo todo (renombres y repunteos): ' + e +
                    '\nVerificar con "1. Ver estado".' };
            }
            return { ok: false, error: 'El swap fallo (' + e + ') y el rollback quedo INCOMPLETO. ' +
                'Correr "4. Revertir" para reconciliar, y verificar con "1. Ver estado".' };
        }
    });
    return _informarResultadoV011('Swap hojas Fix - aplicar', r);
}

/** Dropdowns de 'Cargas - Fix' contra las fuentes del Plan viejo (Y y R). */
function _restaurarValidacionesViejasV011(ss) {
    var hojaCargasFix = ss.getSheetByName('Cargas - Fix');
    var hojaPlanVieja = ss.getSheetByName('Plan de Cuentas');
    if (!hojaCargasFix || !hojaPlanVieja) return;
    var maxFilas = hojaPlanVieja.getMaxRows();
    var g = V011_GEO.cargasFixGrilla;
    hojaCargasFix.getRange('E' + g.filaIni + ':E' + g.filaFin).setDataValidation(
        SpreadsheetApp.newDataValidation()
            .requireValueInRange(hojaPlanVieja.getRange('Y4:Y' + maxFilas), true)
            .setAllowInvalid(true).build());
    hojaCargasFix.getRange('F' + g.filaIni + ':F' + g.filaFin).setDataValidation(
        SpreadsheetApp.newDataValidation()
            .requireValueInRange(hojaPlanVieja.getRange('R4:R' + maxFilas), true)
            .setAllowInvalid(true).build());
}

// ============================================
// 4. REVERTIR (incluye reconciliar una corrida muerta)
// ============================================

/**
 * Deshace un swap aplicado, o RECONCILIA una corrida que murio a mitad de
 * camino (timeout, corte manual): mira que hoja quedo con que nombre y
 * devuelve cada una a su lugar. Requiere que los respaldos sigan existiendo
 * (si ya se purgaron, no hay vuelta atras).
 *
 * Nota deliberada: el repunteo inverso es por patron sobre las 8 hojas Fix.
 * Si despues del swap se escribieron formulas NUEVAS contra las hojas
 * canonicas, tambien quedan redirigidas a las viejas restauradas: revertir
 * restaura el MUNDO pre-swap, no distingue autores de formulas.
 */
function revertirSwapV011() {
    var r = _conLockV011(false, function () {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var estado = _leerEstadoV011();
        if (estado._corrupto) return { ok: false, error: 'El estado guardado es ilegible. No se revierte a ciegas.' };
        var enVuelo = _swapEnVueloV011(estado);
        if (!_swapAplicadoV011(estado) && !enVuelo) {
            return { ok: false, error: 'No hay un swap aplicado ni una corrida a medio hacer para revertir.' };
        }
        if (estado.purgadaEn) {
            return { ok: false, error: 'Los respaldos fueron purgados el ' + estado.purgadaEn + ': no queda de donde restaurar.' };
        }
        var sello = estado.sello;
        if (!sello) return { ok: false, error: 'El estado no registra el sello del swap. Revision manual.' };

        var acciones = [];
        var avisos = [];

        // Paso 1: reconciliar nombres. Para cada par, la hoja puede estar en
        // cualquiera de los dos nombres (canonico o Fix) segun donde murio la
        // corrida; el respaldo puede existir o no (Presupuesto/Mirada no
        // tienen, y una vieja tambien puede haber faltado al aplicar). La
        // regla que distingue los casos NO es una lista fija de pares: si el
        // nombre Fix sigue ocupado, la hoja con nombre canonico ES la vieja
        // (la corrida murio antes de renombrar la Fix) y no se toca; si el
        // nombre Fix esta libre, la hoja con nombre canonico es la ex-Fix y
        // vuelve a su sufijo.
        for (var i = 0; i < V011_SWAPS.length; i++) {
            var s = V011_SWAPS[i];
            var respaldo = s.canonico + ' (anterior ' + sello + ')';
            var hojaRespaldo = ss.getSheetByName(respaldo);
            var hojaCanonica = ss.getSheetByName(s.canonico);
            var hojaFixNombre = ss.getSheetByName(s.fix);

            if (hojaCanonica && !hojaFixNombre &&
                (!hojaRespaldo || hojaCanonica.getSheetId() !== hojaRespaldo.getSheetId())) {
                hojaCanonica.setName(s.fix);
                acciones.push(s.canonico + ' -> ' + s.fix);
            }
            if (hojaRespaldo) {
                var original = (s.canonico === 'Tipos de Cambio') ? 'Tipos de cambio' : s.canonico;
                hojaRespaldo.setName(original);
                hojaRespaldo.showSheet();
                acciones.push(respaldo + ' -> ' + original);
            }
        }
        _invalidarCacheV011();

        // Paso 2: repunteos inversos en las hojas Fix. Tras los renombres, las
        // formulas repunteadas quedaron mirando "'Plan de Cuentas - Fix'!L:N" y
        // "'Registros - Fix'!..." (siguieron a sus objetos): se las devuelve a
        // su forma original contra las hojas restauradas.
        for (var p3 = 0; p3 < V011_SWAPS.length; p3++) {
            var hojaFix = ss.getSheetByName(V011_SWAPS[p3].fix);
            if (!hojaFix) continue;
            for (var rm = 0; rm < V011_REMAP_PLAN.length; rm++) {
                hojaFix.createTextFinder("'Plan de Cuentas - Fix'" + V011_REMAP_PLAN[rm].a)
                       .matchFormulaText(true)
                       .replaceAllWith("'Plan de Cuentas'" + V011_REMAP_PLAN[rm].de);
            }
            _repuntearRegistrosV011(hojaFix, 'Registros - Fix', 'Registros', -1);
        }

        // Paso 3: devolver la cuarentena al Plan Fix. El nombre es
        // deterministico ('Cuarentena Plan (<sello>)'), asi que se busca aunque
        // el estado no la registre (una corrida muerta entre el paso 4 y el
        // guardado final la deja hecha pero sin clave en el estado).
        var nombreQ = (estado.cuarentena && estado.cuarentena.hoja)
            ? estado.cuarentena.hoja : 'Cuarentena Plan (' + sello + ')';
        var hojaQ = ss.getSheetByName(nombreQ);
        var hojaPlanFix = ss.getSheetByName('Plan de Cuentas - Fix');
        if (hojaQ && hojaPlanFix) {
            var desdeQ = (estado.cuarentena && estado.cuarentena.desde)
                ? estado.cuarentena.desde : V011_FILA_TOPE_CATALOGO + 1;
            var datosQ = hojaQ.getDataRange().getValues().slice(2);
            if (datosQ.length) {
                hojaPlanFix.getRange(desdeQ, 1, datosQ.length, datosQ[0].length).setValues(datosQ);
            }
            ss.deleteSheet(hojaQ);
            acciones.push('cuarentena devuelta al Plan Fix');
        } else if (!hojaQ && estado.cuarentena && estado.cuarentena.hoja) {
            avisos.push('La hoja de cuarentena "' + estado.cuarentena.hoja +
                '" ya no existe: el residual del Plan (filas 1005+) NO se pudo devolver.');
        }
        // La columna S se limpia SIEMPRE (es un paso independiente de la cuarentena).
        if (hojaPlanFix) hojaPlanFix.getRange('S7:S8').clearContent();

        // Paso 4: dropdowns de 'Cargas - Fix' de vuelta a sus fuentes viejas.
        _restaurarValidacionesViejasV011(ss);

        _guardarEstadoV011({ revertidaEn: new Date().toISOString(), cuarentena: null });
        var detalle = (enVuelo ? 'Corrida a medio hacer RECONCILIADA y revertida.' : 'Swap revertido.') +
            '\nAcciones: ' + (acciones.length ? acciones.join(' | ') : 'ninguna hizo falta') +
            '\nHojas viejas restauradas con sus nombres, hojas Fix con su sufijo, formulas y dropdowns devueltos.' +
            (avisos.length ? '\nAVISOS: ' + avisos.join(' / ') : '');
        logInfo('[V011] ' + detalle);
        return { ok: true, detalle: detalle };
    });
    return _informarResultadoV011('Swap hojas Fix - revertir', r);
}

// ============================================
// 5. PURGAR RESPALDOS (IRREVERSIBLE)
// ============================================

/**
 * Borra fisicamente los respaldos de un swap aplicado. Solo corre si NINGUNA
 * formula de la planilla sigue mirandolos. Limite conocido: el escaneo ve
 * formulas (TextFinder), no fuentes de Validacion de Datos ni rangos de
 * graficos; las dos validaciones que miraban al Plan viejo las reconstruyo
 * aplicar, pero un grafico anclado a una hoja vieja moriria con la purga.
 * Confirmacion por UI directa (regla de la casa: ninguna funcion destructiva
 * toma su confirmacion de un dialogo de lote). La hoja de cuarentena NO se
 * purga: es de Franco.
 */
function purgarRespaldosV011() {
    var r = _conLockV011(false, function () {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var estado = _leerEstadoV011();
        if (estado._corrupto) return { ok: false, error: 'El estado guardado es ilegible. No se purga.' };
        if (!_swapAplicadoV011(estado)) return { ok: false, error: 'No hay un swap aplicado: nada que purgar.' };
        if (estado.purgadaEn) return { ok: false, error: 'Los respaldos ya fueron purgados el ' + estado.purgadaEn + '.' };
        var respaldos = estado.respaldos || [];
        if (!respaldos.length) return { ok: false, error: 'El estado no registra respaldos. Revision manual.' };

        var esRespaldo = {};
        for (var i = 0; i < respaldos.length; i++) esRespaldo[respaldos[i]] = true;
        var refsVivas = [];
        var hojas = ss.getSheets();
        for (var h = 0; h < hojas.length; h++) {
            if (esRespaldo[hojas[h].getName()]) continue;
            for (var j = 0; j < respaldos.length; j++) {
                var hallados = hojas[h].createTextFinder("'" + respaldos[j] + "'!").matchFormulaText(true).findAll();
                for (var k = 0; k < hallados.length; k++) {
                    refsVivas.push(hojas[h].getName() + '!' + hallados[k].getA1Notation() + ' -> ' + respaldos[j]);
                }
            }
        }
        if (refsVivas.length) {
            return { ok: false, error: 'Hay ' + refsVivas.length + ' formula(s) viva(s) mirando respaldos. No se purga.\n' +
                refsVivas.slice(0, 15).join('\n') };
        }

        var ui = _uiV011();
        if (ui) {
            var resp = ui.alert('Purgar respaldos (IRREVERSIBLE)',
                'Se van a BORRAR definitivamente ' + respaldos.length + ' hoja(s) de respaldo:\n\n' +
                respaldos.join('\n') + '\n\nNo hay vuelta atras. Confirmar?', ui.ButtonSet.YES_NO);
            if (resp !== ui.Button.YES) return { ok: false, error: 'Purga cancelada por el operador.', _avisado: true };
        } else {
            // Sin UI no hay confirmacion posible: borrar hojas sin operador es inaceptable.
            return { ok: false, error: 'La purga solo corre desde el menu (necesita confirmacion del operador).' };
        }

        var borradas = [];
        for (var b = 0; b < respaldos.length; b++) {
            var hojaB = ss.getSheetByName(respaldos[b]);
            if (hojaB) { ss.deleteSheet(hojaB); borradas.push(respaldos[b]); }
        }
        _guardarEstadoV011({ purgadaEn: new Date().toISOString(), purgadas: borradas });
        var detalle = 'Respaldos purgados: ' + (borradas.length ? borradas.join(', ') : 'ninguno (ya no existian)') + '.' +
            (estado.cuarentena ? '\nLa hoja de cuarentena "' + estado.cuarentena.hoja + '" NO se toco: decidir aparte.' : '');
        logInfo('[V011] ' + detalle);
        return { ok: true, detalle: detalle };
    });
    return _informarResultadoV011('Swap hojas Fix - purgar', r);
}
