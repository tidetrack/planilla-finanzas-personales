/**
 * 18_RespaldoService.js - la boveda de respaldos: congelar filas sin crear una pestania.
 *
 * [CONCEPTO DE NEGOCIO]
 * El deshacer de una edicion puntual no justifica una pestania. Franco, textual: al editar un
 * monto desde la vista Proyecciones Elaboradas veia aparecer detras del modal una hoja nueva
 * ("Respaldo proyeccion abm <sello>"), el grid de fondo saltaba a esa hoja, la pestania
 * desaparecia sola y el foco NO volvia a donde estaba. Tres sintomas, no uno: la pestania que
 * parpadea, el salto de hoja que no se deshace, y la basura que se acumula (nadie borra esas
 * hojas). Este modulo reemplaza esa hoja por una propiedad del documento.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * El respaldo es un mecanismo INTERNO, no un artefacto de la planilla. La filosofia del
 * producto es legibilidad directa de lo que el usuario USA (CLAUDE.md seccion 1) -- una hoja
 * de respaldo no es eso: es plomeria. La disciplina del arnes no se relaja por cambiar de
 * soporte: se escribe, se RELEE por su clave y se compara el VALOR fila por fila antes de
 * declarar exito; si no verifica, LANZA y no se toca la hoja de origen.
 *
 * POR QUE insertSheet NO SE PUEDE "OCULTAR A TIEMPO"
 * `Spreadsheet.insertSheet()` inserta la hoja y la deja VISIBLE y ACTIVA por contrato; no hay
 * variante que la cree oculta. El `SpreadsheetApp.flush()` de la verificacion garantiza que ese
 * estado llegue al cliente, y aunque no estuviera, la relectura posterior fuerza el mismo
 * vaciado. Por eso el defecto no se arregla moviendo el `hideSheet()`: hay que NO CREAR la hoja.
 * Para el unico caso que si necesita una hoja (mas de RESP_TOPE_PROPS filas) queda
 * `_conHojaActivaPreservada`, que mitiga -- no elimina -- el parpadeo, y se paga UNA sola vez
 * en la vida de la planilla porque la boveda se reusa.
 *
 * DOS NIVELES
 *   1. PropertiesService (por defecto, hasta RESP_TOPE_PROPS filas). Cubre el 100% de lo medido:
 *      271 bytes por respaldo de UNA fila contra 9 KB de limite por propiedad (34x de margen);
 *      190 bytes por fila en volumen. Troceado en propiedades de RESP_FILAS_POR_TROZO filas
 *      porque los grupos reales de la Proyeccion de Franco van de 45 a 64 filas y un mes entero
 *      no entra en una sola propiedad.
 *   2. La boveda: UNA hoja oculta (SHEETS.RESPALDOS) que se crea una sola vez y despues solo
 *      recibe filas. Leer = filtrar por token; purgar = borrar filas por token, NUNCA la hoja.
 *
 * ESCRITURA ATOMICA POR CONTRATO: primero TODOS los trozos, el indice AL FINAL. Un indice
 * presente significa respaldo completo; si la escritura muere a mitad no hay indice y el
 * respaldo se considera inexistente, que es justo lo que el que respalda necesita para abortar
 * antes de tocar la hoja de origen.
 *
 * NINGUN const de nivel superior de este archivo lee simbolos de otro archivo (cicatriz
 * v0.50.1: el orden de carga de Apps Script es alfabetico y un ReferenceError de carga tumba el
 * proyecto entero). SHEETS.RESPALDOS, RANGES.RESPALDOS y los helpers ajenos se leen SIEMPRE
 * dentro de cuerpos de funcion. Que 16_ y 17_ carguen ANTES no es un problema: pueden LLAMAR a
 * estas funciones en runtime, cuando todos los archivos ya fueron evaluados; lo que no pueden es
 * referenciarlas en un const de nivel superior.
 *
 * NUMERACION 18_ Y NO DEVTOOL_: es infraestructura de un camino de uso DIARIO, no un devtool.
 * Carga despues de 17_ y antes de los DEVTOOL_*, que son sus consumidores.
 *
 * @see docs/permanente/FUNCIONALIDADES.md
 * @see DEVTOOL_ProyeccionAbm.js (el consumidor que motivo el modulo)
 * @see DEVTOOL_PresupuestoGuardar.js (_leerRespaldoFilasPg: el lector del formato legado)
 * @version 0.64.0
 * @since 0.64.0
 * @lastModified 2026-08-30
 */

// ============================================
// CONSTANTES (literales puros: no leen ningun simbolo de otro archivo)
// ============================================

const RESP_PROP_PREFIJO = 'resp_';

// decision Franco 2026-08-30: 40 y no 48. Medido sobre una fila representativa real de B:M
// (monto de 6 digitos, cuenta "Alquiler departamento", nota de guardado con sello, cuatro TC):
// 190 bytes por fila en el formato compacto [nroFila, [valores]], estable a partir de 10 filas.
// 9216 / 190 = 48 filas por propiedad; 40 deja 20% de margen para cuentas de nombre largo y
// notas libres del shell, que son texto que el usuario escribe y no tiene tope real.
const RESP_FILAS_POR_TROZO = 40;

// decision Franco 2026-08-30: 300 es 5x el grupo mas grande medido en la Proyeccion real
// (64 filas). Por encima de eso el respaldo va a la boveda: 300 filas son 8 trozos y ~57 KB del
// almacen de documento, que tiene 500 KB compartidos con las 36 propiedades que ya viven ahi.
const RESP_TOPE_PROPS = 300;

// Tope duro de Apps Script por VALOR de propiedad. No es una estimacion: es el limite publicado.
const RESP_TOPE_CARACTERES_TROZO = 9216;

const RESP_TITULO_HOJA = 'Respaldos internos.';
const RESP_HEADERS = ['Token', 'Creado', 'Contexto', 'Hoja', 'Fila original', 'Valores'];

// ============================================
// CLAVES DE PROPIEDAD (literales armados en UN solo lugar, nunca concatenados en el punto de uso)
// ============================================

function _claveIndiceResp(token) { return RESP_PROP_PREFIJO + token + '_ix'; }
function _claveTrozoResp(token, i) { return RESP_PROP_PREFIJO + token + '_' + i; }
function _prefijoClavesResp(token) { return RESP_PROP_PREFIJO + token + '_'; }

// ============================================
// LA UNICA CREACION DE HOJA QUE QUEDA
// ============================================

/**
 * Crea una hoja OCULTA devolviendo el foco a la hoja que estaba activa, y recien despues corre
 * `fn(hoja)` para escribirla y verificarla. Si `fn` tira, borra la hoja a medio crear, repone el
 * foco y relanza.
 *
 * El orden importa y es el punto entero de la funcion:
 *   1. leer la hoja activa ANTES de crear nada
 *   2. insertSheet -- nace visible y activa, inevitable
 *   3. setActiveSheet(activa) -- devolver el foco de inmediato
 *   4. hideSheet() -- ocultar ANTES de escribir una sola celda
 *   5. recien entonces escribir, flush, releer y verificar
 * Los pasos 2, 3 y 4 no tienen ningun flush ni ninguna lectura entre medio, asi que llegan al
 * cliente como una sola mutacion cuyo resultado neto es "existe una hoja oculta, la activa no
 * cambio".
 *
 * HONESTIDAD SOBRE EL ALCANCE: las operaciones estructurales de Apps Script (insertSheet,
 * deleteSheet) pueden aplicarse antes que el resto del lote, asi que esto es una MITIGACION del
 * parpadeo, no una garantia. La garantia de que Franco no vea nada la da el nivel 1, que no crea
 * hoja.
 *
 * decision Franco 2026-08-30: leer y reponer el foco va en try/catch propio y NUNCA aborta la
 * operacion. Preservar el foco es una cortesia; perder el respaldo por no poder leer la hoja
 * activa seria cambiar un problema cosmetico por uno de datos.
 */
function _conHojaActivaPreservada(ss, nombre, fn) {
    let activa = null;
    try { activa = ss.getActiveSheet(); } catch (e) { activa = null; }
    const reponerFoco = function () {
        if (!activa) return;
        try { ss.setActiveSheet(activa); }
        catch (e) { logInfo('_conHojaActivaPreservada: no se pudo reponer el foco (' + (e && e.message ? e.message : e) + ').'); }
    };

    const hoja = ss.insertSheet(nombre);
    reponerFoco();
    hoja.hideSheet();
    invalidarCacheNombresHojas();

    try {
        fn(hoja);
    } catch (e) {
        try { ss.deleteSheet(hoja); invalidarCacheNombresHojas(); } catch (e2) { /* la hoja queda, el error manda */ }
        reponerFoco();
        throw e;
    }
    return hoja;
}

/**
 * La boveda, creada UNA sola vez en la vida de la planilla. Toda escritura posterior es un
 * append de filas: nunca una hoja nueva.
 */
function _asegurarBoveda(ss) {
    const nombre = SHEETS.RESPALDOS;
    const existente = ss.getSheetByName(nombre);
    if (existente) return existente;

    const cfg = RANGES.RESPALDOS;
    const colIni = columnLetterToIndex(cfg.start);

    const hoja = _conHojaActivaPreservada(ss, nombre, function (h) {
        h.getRange(2, colIni).setValue(RESP_TITULO_HOJA);
        h.getRange(cfg.headerRow, colIni, 1, RESP_HEADERS.length).setValues([RESP_HEADERS]);
        SpreadsheetApp.flush();

        // RELEER y comparar el VALOR, no el texto que se creyo escribir (memoria del repo).
        const desvios = [];
        const titulo = String(h.getRange(2, colIni).getValue() || '');
        if (titulo !== RESP_TITULO_HOJA) desvios.push('el titulo dice "' + titulo + '"');
        const vivos = h.getRange(cfg.headerRow, colIni, 1, RESP_HEADERS.length).getValues()[0];
        RESP_HEADERS.forEach(function (rotulo, i) {
            const vivo = String(vivos[i] === null || vivos[i] === undefined ? '' : vivos[i]);
            if (vivo !== rotulo) desvios.push('el header ' + (i + 1) + ' dice "' + vivo + '" y se esperaba "' + rotulo + '"');
        });
        if (desvios.length) {
            throw new Error('No se pudo crear la boveda "' + nombre + '": ' + desvios.join('; ') + '.');
        }
    });

    logSuccess('_asegurarBoveda: boveda "' + nombre + '" creada, verificada y oculta (unica vez).');
    return hoja;
}

// ============================================
// SERIALIZACION (formato compacto: [nroFila, [12 valores]], sin stringify interno)
// ============================================

/** Congela `filas` de `hoja` (banda B:M de RANGES.REGISTROS) como pares [nroFila, valores]. */
function _serializarFilasResp(hoja, filas) {
    if (!filas.length) return [];
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const vivas = hoja.getRange(1, colIni, hoja.getLastRow(), ancho).getValues();
    return filas.map(function (fila) {
        const vals = vivas[fila - 1];
        return [fila, vals.map(function (v) { return v instanceof Date ? { __fecha__: v.toISOString() } : v; })];
    });
}

/** Reconstruye las Date de una fila serializada. Inverso exacto de _serializarFilasResp. */
function _rehidratarFilaResp(valores) {
    return valores.map(function (v) {
        return (v && typeof v === 'object' && v.__fecha__) ? new Date(v.__fecha__) : v;
    });
}

// ============================================
// NIVEL 1: PROPIEDADES
// ============================================

/**
 * Escribe el respaldo troceado. Contrato: TODOS los trozos primero, verificacion releyendo por
 * clave, y el indice AL FINAL. Marca sus errores para que el caller sepa que hacer con cada uno:
 *   __respTrozoGrande -> se puede reintentar con trozos mas chicos
 *   __respNoVerifica   -> NO se degrada a la boveda: es una falla real y tiene que LANZAR
 */
function _guardarEnPropsResp(serializadas, token, contexto, nombreHoja, filasPorTrozo) {
    const props = PropertiesService.getDocumentProperties();

    const trozos = [];
    for (let i = 0; i < serializadas.length; i += filasPorTrozo) {
        trozos.push(serializadas.slice(i, i + filasPorTrozo));
    }

    trozos.forEach(function (trozo, i) {
        const texto = JSON.stringify(trozo);
        if (texto.length > RESP_TOPE_CARACTERES_TROZO) {
            // NUNCA se trunca ni se recorta: un respaldo truncado miente peor que uno ausente.
            const e = new Error('un trozo de ' + trozo.length + ' fila(s) ocupa ' + texto.length +
                ' caracteres y el tope por propiedad es ' + RESP_TOPE_CARACTERES_TROZO);
            e.__respTrozoGrande = true;
            throw e;
        }
        props.setProperty(_claveTrozoResp(token, i), texto);
    });

    // Verificacion: releer POR SU CLAVE y comparar la lista de numeros de fila, uno por uno.
    const releidas = [];
    for (let i = 0; i < trozos.length; i++) {
        const crudo = props.getProperty(_claveTrozoResp(token, i));
        if (crudo === null || crudo === undefined) {
            const e = new Error('el trozo ' + i + ' no se pudo releer');
            e.__respNoVerifica = true;
            throw e;
        }
        JSON.parse(crudo).forEach(function (par) { releidas.push(Number(par[0])); });
    }
    if (releidas.length !== serializadas.length) {
        const e = new Error('se esperaban ' + serializadas.length + ' fila(s) y se releyeron ' + releidas.length);
        e.__respNoVerifica = true;
        throw e;
    }
    for (let i = 0; i < releidas.length; i++) {
        if (releidas[i] !== serializadas[i][0]) {
            const e = new Error('el respaldo no coincide fila por fila con lo esperado');
            e.__respNoVerifica = true;
            throw e;
        }
    }

    props.setProperty(_claveIndiceResp(token), JSON.stringify({
        v: 1, token: token, contexto: contexto, hoja: nombreHoja,
        creado: new Date().toISOString(), nFilas: serializadas.length,
        nTrozos: trozos.length, medio: 'props'
    }));
}

/** Borra indice y trozos de un token. Deterministico por el indice, mas barrido por prefijo. */
function _borrarRespaldoProps(token) {
    const props = PropertiesService.getDocumentProperties();
    const claveIx = _claveIndiceResp(token);
    const crudo = props.getProperty(claveIx);
    if (crudo) {
        let nTrozos = 0;
        try { nTrozos = Number(JSON.parse(crudo).nTrozos) || 0; } catch (e) { nTrozos = 0; }
        for (let i = 0; i < nTrozos; i++) props.deleteProperty(_claveTrozoResp(token, i));
        props.deleteProperty(claveIx);
    }
    // Barrido por prefijo: cubre la escritura que murio a mitad, cuando no hay indice que leer.
    const prefijo = _prefijoClavesResp(token);
    let claves = [];
    try { claves = props.getKeys() || []; } catch (e) { claves = []; }
    claves.forEach(function (k) { if (k.indexOf(prefijo) === 0) props.deleteProperty(k); });
}

// ============================================
// NIVEL 2: LA BOVEDA
// ============================================

/** Posiciones de las columnas de la boveda, derivadas de RANGES (Regla Estricta 1). */
function _posBoveda() {
    const cfg = RANGES.RESPALDOS;
    const colIni = columnLetterToIndex(cfg.start);
    const pos = {};
    Object.keys(cfg.columns).forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });
    return { cfg: cfg, colIni: colIni, ancho: columnLetterToIndex(cfg.end) - colIni + 1, pos: pos };
}

/** Las filas de la boveda que llevan `token`, en el orden en que estan escritas. */
function _filasBovedaPorToken(hojaB, token) {
    const g = _posBoveda();
    const ultima = hojaB.getLastRow();
    if (ultima < g.cfg.dataRow) return [];
    const valores = hojaB.getRange(g.cfg.dataRow, g.colIni, ultima - g.cfg.dataRow + 1, g.ancho).getValues();
    const out = [];
    valores.forEach(function (v, i) {
        if (String(v[g.pos.token] || '') !== token) return;
        out.push({
            filaBoveda: g.cfg.dataRow + i,
            fila: Number(v[g.pos.fila_original]),
            valoresJson: String(v[g.pos.valores_json] || '')
        });
    });
    return out;
}

function _guardarEnBovedaResp(ss, serializadas, token, contexto, nombreHoja) {
    const hojaB = _asegurarBoveda(ss);
    const g = _posBoveda();
    const creado = new Date().toISOString();

    if (serializadas.length) {
        const matriz = serializadas.map(function (par) {
            const f = new Array(g.ancho).fill('');
            f[g.pos.token] = token;
            f[g.pos.creado] = creado;
            f[g.pos.contexto] = contexto;
            f[g.pos.hoja] = nombreHoja;
            f[g.pos.fila_original] = par[0];
            f[g.pos.valores_json] = JSON.stringify(par[1]);
            return f;
        });
        const primera = Math.max(hojaB.getLastRow() + 1, g.cfg.dataRow);
        if (primera + matriz.length - 1 > hojaB.getMaxRows()) {
            asegurarCapacidadFilas(hojaB, primera + matriz.length - 1);
        }
        hojaB.getRange(primera, g.colIni, matriz.length, g.ancho).setValues(matriz);
    }
    SpreadsheetApp.flush();

    const releidas = _filasBovedaPorToken(hojaB, token);
    if (releidas.length !== serializadas.length) {
        const e = new Error('se esperaban ' + serializadas.length + ' fila(s) y se releyeron ' + releidas.length);
        e.__respNoVerifica = true;
        throw e;
    }
    for (let i = 0; i < releidas.length; i++) {
        if (releidas[i].fila !== serializadas[i][0]) {
            const e = new Error('el respaldo no coincide fila por fila con lo esperado');
            e.__respNoVerifica = true;
            throw e;
        }
    }
}

/** Borra de abajo hacia arriba y en bloques contiguos (patron _borrarGeneradasPb, con cita). */
function _borrarFilasBoveda(hojaB, filas) {
    if (!filas.length) return 0;
    const ordenadas = filas.slice().sort(function (a, b) { return a - b; });
    const bloques = [];
    let ini = ordenadas[0], largo = 1;
    for (let i = 1; i < ordenadas.length; i++) {
        if (ordenadas[i] === ordenadas[i - 1] + 1) { largo++; continue; }
        bloques.push({ ini: ini, largo: largo });
        ini = ordenadas[i]; largo = 1;
    }
    bloques.push({ ini: ini, largo: largo });
    for (let i = bloques.length - 1; i >= 0; i--) hojaB.deleteRows(bloques[i].ini, bloques[i].largo);
    return bloques.length;
}

// ============================================
// API PUBLICA DEL MODULO (ninguna se expone a google.script.run)
// ============================================

/**
 * Congela `filas` de `hoja` bajo `token`. Elige el nivel por tamanio, escribe, y VERIFICA
 * releyendo. Si no verifica, LANZA con el mensaje historico y la hoja de origen queda intacta.
 *
 * @param {Spreadsheet} ss
 * @param {Sheet} hoja        la hoja de la que se copian las filas (geometria RANGES.REGISTROS)
 * @param {Array<number>} filas numeros de fila reales, en el orden en que se repondran
 * @param {string} token      el sello de la operacion (yyyy-MM-dd_HHmmss); no se inventa uno nuevo
 * @param {string} contexto   quien respalda ('proyeccion-abm', 'presupuesto-guardar')
 * @returns {{token:string, filas:number, medio:string}}
 */
function guardarRespaldoFilas(ss, hoja, filas, token, contexto) {
    const lista = (filas || []).slice();
    const nombreHoja = hoja.getName();
    const serializadas = _serializarFilasResp(hoja, lista);

    const noVerifica = function (detalle) {
        return new Error('El respaldo de filas NO VERIFICA: ' + detalle + '. No se toco "' + nombreHoja + '".');
    };

    if (lista.length <= RESP_TOPE_PROPS) {
        let filasPorTrozo = RESP_FILAS_POR_TROZO;
        for (let intento = 0; intento < 2; intento++) {
            try {
                _guardarEnPropsResp(serializadas, token, contexto, nombreHoja, filasPorTrozo);
                logInfo('guardarRespaldoFilas: ' + lista.length + ' fila(s) de "' + nombreHoja +
                    '" respaldadas en propiedades bajo el token "' + token + '".');
                return { token: token, filas: lista.length, medio: 'props' };
            } catch (e) {
                _borrarRespaldoProps(token);
                if (e && e.__respNoVerifica) throw noVerifica(e.message);
                if (e && e.__respTrozoGrande && intento === 0) {
                    filasPorTrozo = Math.max(1, Math.floor(filasPorTrozo / 2));
                    continue;
                }
                // Un fallback se usa, pero SIEMPRE se loguea (mismo criterio que la Regla
                // Estricta 9 aplica a las cotizaciones). Nunca se sigue de largo sin respaldo.
                logInfo('guardarRespaldoFilas: las propiedades no alcanzaron (' +
                    (e && e.message ? e.message : e) + '); el respaldo "' + token +
                    '" pasa entero a la boveda "' + SHEETS.RESPALDOS + '".');
                break;
            }
        }
    }

    try {
        _guardarEnBovedaResp(ss, serializadas, token, contexto, nombreHoja);
    } catch (e) {
        if (e && e.__respNoVerifica) throw noVerifica(e.message);
        throw e;
    }
    logInfo('guardarRespaldoFilas: ' + lista.length + ' fila(s) de "' + nombreHoja +
        '" respaldadas en la boveda bajo el token "' + token + '".');
    return { token: token, filas: lista.length, medio: 'boveda' };
}

/**
 * Reconstruye la matriz de filas (valores crudos, con Date reconstruida) de un respaldo.
 *
 * Resuelve en ESTE orden, y el orden es parte del contrato:
 *   1. propiedades (indice + trozos)
 *   2. boveda (filtro por token)
 *   3. CAMINO LEGADO: una HOJA que se llame como `ref`. Al desplegar, la planilla puede tener
 *      PA_PROP_PREVIOS_EDICION / PA_PROP_PREVIOS_BAJA / PG_PROP_PREVIOS apuntando con el campo
 *      `respaldo` al nombre de una hoja del formato viejo; sin este paso se rompe EN SILENCIO
 *      el unico deshacer que existe. Es TRANSITORIO: se retira cuando no quede ninguna
 *      propiedad con campo `respaldo` en la planilla (el estado de DEVTOOL_PurgaRespaldos.js
 *      sabe reportarlo, porque su guarda 1 mira adentro de los valores JSON).
 *
 * @param {Spreadsheet} ss
 * @param {string} ref  token del respaldo nuevo, o nombre de hoja del respaldo legado
 * @returns {Array<Array<*>>}
 */
function leerRespaldoFilas(ss, ref) {
    const token = String(ref || '');
    if (!token) throw new Error('No se indico ningun respaldo para leer.');

    const props = PropertiesService.getDocumentProperties();
    const crudoIx = props.getProperty(_claveIndiceResp(token));
    if (crudoIx) {
        const ix = JSON.parse(crudoIx);
        const nTrozos = Number(ix.nTrozos) || 0;
        const out = [];
        for (let i = 0; i < nTrozos; i++) {
            const crudo = props.getProperty(_claveTrozoResp(token, i));
            if (crudo === null || crudo === undefined) {
                throw new Error('El respaldo "' + token + '" quedo incompleto: falta el trozo ' + i +
                    ' de ' + nTrozos + '. No se repuso nada.');
            }
            JSON.parse(crudo).forEach(function (par) { out.push(_rehidratarFilaResp(par[1])); });
        }
        return out;
    }

    const hojaB = ss.getSheetByName(SHEETS.RESPALDOS);
    if (hojaB) {
        const enBoveda = _filasBovedaPorToken(hojaB, token);
        if (enBoveda.length) {
            return enBoveda.map(function (r) { return _rehidratarFilaResp(JSON.parse(r.valoresJson)); });
        }
    }

    // Paso 3, transitorio (ver arriba).
    const hojaLegado = ss.getSheetByName(token);
    if (hojaLegado) return _leerRespaldoFilasPg(hojaLegado);

    throw new Error('El respaldo "' + token + '" ya no esta disponible: no hay indice en propiedades, ' +
        'ni filas en la boveda "' + SHEETS.RESPALDOS + '", ni una hoja con ese nombre.');
}

/**
 * Borra un respaldo que ya no tiene vigencia (despues de un revertir exitoso, o cuando lo pisa
 * otra operacion). Nunca borra la boveda: borra SUS FILAS.
 */
function borrarRespaldoFilas(ss, ref) {
    const token = String(ref || '');
    if (!token) return { token: '', props: false, filasBoveda: 0 };

    const habiaIndice = PropertiesService.getDocumentProperties().getProperty(_claveIndiceResp(token)) !== null;
    _borrarRespaldoProps(token);

    let filasBoveda = 0;
    const hojaB = ss.getSheetByName(SHEETS.RESPALDOS);
    if (hojaB) {
        const enBoveda = _filasBovedaPorToken(hojaB, token);
        if (enBoveda.length) {
            _borrarFilasBoveda(hojaB, enBoveda.map(function (r) { return r.filaBoveda; }));
            filasBoveda = enBoveda.length;
        }
    }
    return { token: token, props: habiaIndice, filasBoveda: filasBoveda };
}
