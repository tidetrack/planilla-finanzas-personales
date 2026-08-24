/**
 * DEVTOOL_BloqueCategorias.js
 * El bloque "Categorias" del Tablero pasa a agrupar por la CATEGORIA DE LA CUENTA.
 *
 * [CONCEPTO DE NEGOCIO]
 * Ese bloque tiene que contestar "en que se me va la plata": Vehiculo, Alimentacion y social,
 * Deuda y financiacion. Hoy muestra Hogar / Ahorros / Inversiones / Financiacion, que son los
 * TIPOS DE MEDIO -- o sea DONDE estaba la plata, no PARA QUE se uso. Dos preguntas distintas, y
 * la que el bloque promete es la segunda.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es una consecuencia no prevista de la v0.20.0. Cuando los medios declaraban su tipo a traves de
 * una categoria intermedia, la formula hacia medio -> categoria -> tipo y el bloque agrupaba por
 * esa categoria del medio, que al menos era un nombre propio ("Chanchito", "Meta de Ahorro 1").
 * Al sacar el nivel intermedio, el mismo VLOOKUP pasa a devolver el TIPO, y el bloque quedo
 * mostrando cuatro filas genericas.
 *
 * La correccion no es volver atras: es apuntar al eje correcto. La categoria de la CUENTA vive en
 * los tres bloques de cuentas del Plan (C:D, F:G, I:J), asi que la busqueda es una cascada de
 * tres IFERROR -- una cuenta esta en uno y solo uno de los tres.
 *
 * QUE NO HACE
 * 1. NO toca ninguna otra celda del Tablero. Es una sola formula.
 * 2. NO cambia la estructura del bloque ni sus rotulos.
 *
 * ============================================================================
 * CORRIDA DE FILA EL 2026-08-21
 * ============================================================================
 * Franco le agrego una fila al bloque "Categorias" para dejar lugar al "Faltante proyectado"
 * (ver DEVTOOL_TableroFaltanteProyectado.js): el header "Nombre" que rotulaba la columna bajo de
 * la fila 8 a la 9, y la formula que agrupa bajo con el, de AA9 a AA10. BCAT_CELDA se corrige a
 * AA10, con preflight por rotulo contra AA9 ("Nombre"): si el rotulo no coincide, aborta sin
 * tocar nada, en vez del `if (!actual) throw` generico que antes solo confirmaba "no hay formula"
 * sin decir si es porque la geometria se movio o porque la celda esta legitimamente vacia.
 *
 * ============================================================================
 * EL RANGO DEL VLOOKUP DEL TIPO, CORREGIDO EL 2026-08-24 (segunda cirugia de token, mismo AA10)
 * ============================================================================
 * Franco midio en vivo otra linea del MISMO LET, la que llena la columna Tipo del bloque:
 *   columna_tipo; ARRAYFORMULA(IFERROR(VLOOKUP(columna_aj; 'Plan de Cuentas'!P:P; 2; 0); ""))
 * Le pide la COLUMNA 2 a P:P, que tiene una sola columna: es #REF!, tapado por el IFERROR que lo
 * envuelve. La columna Tipo del bloque "Categorias" no puede mostrar nada, nunca -- ni con la
 * columna Q del Plan de Cuentas llena. El rango correcto es P:Q (RANGES.PROYECTOS: nombre en P,
 * tipo en Q), derivado del config, nunca hardcodeado.
 *
 * QUIEN LO REPARA Y POR QUE ACA: para ESTE bug la celda no tenia duenio. DEVTOOL_RiquezaYCategorias.js
 * declara la coordenada (RIQ_BLOQUE_CATEGORIAS) pero desde la decision de duenio unico del
 * 2026-08-21 (ver su cabecera, seccion "ESTADO AL 2026-08-21") YA NO TOCA AA10 -- su _planRiqueza
 * lo dice explicito, y `_conTipoEnCategorias` (que ya sabia construir el VLOOKUP correcto) quedo
 * retenida solo como prueba de regresion en devtools/probar_riqueza.js, sin ejecutar sobre esta
 * celda. El duenio unico de AA10 decidido por Franco es ESTE modulo. La reparacion entra aca como
 * una SEGUNDA cirugia de token, independiente de `_reapuntarBloqueCategorias` (esa toca la
 * variable `proyecto`, el agrupamiento; esta toca `columna_tipo`, otra linea del mismo LET): un
 * solo escritor para toda la celda, que es justamente lo que pide la regla de duenio unico.
 *
 * QUE NO TOCA: la formula tiene una SEGUNDA variable con el mismo bug de rango, `tipo_proy`
 * (linea 7 del LET), pero quedo MUERTA -- sin ningun lector -- desde que RiquezaYCategorias le
 * saco el filtro `(proyecto<>"") * (tipo_proy<>"Hogar") > 0` (su paso 3, ya aplicado sobre esta
 * celda). Sin lectores, su #REF! tapado no cambia ningun resultado visible: no es el bug que
 * Franco midio, y limpiar la variable muerta -- si se decide hacerlo -- es otro cambio, no este.
 *
 * @version 0.23.0
 * @since 2026-08-19
 * @lastModified 2026-08-24
 */

const BCAT_CELDA = 'AA10';
const BCAT_ROTULO_CELDA = 'AA9';
const BCAT_ROTULO_ESPERADO = 'Nombre';
const BCAT_PROP_RESPALDO = 'bloque_categorias_respaldo';
// decision Franco 2026-08-24: nombre de la variable LET que trae el Tipo de la categoria (mismo
// dato que RIQ_BLOQUE_CATEGORIAS.varNueva en DEVTOOL_RiquezaYCategorias.js -- ese modulo ya no
// escribe AA10, asi que se declara aca de nuevo en vez de importar la constante de un modulo
// retirado de la jurisdiccion).
const BCAT_VAR_TIPO = 'columna_tipo';

/**
 * Reemplaza la definicion de la variable que alimenta el agrupamiento.
 *
 * De:  proyecto; ARRAYFORMULA(IFERROR(VLOOKUP(<medio>; ...L:N; 3; 0); ""));
 * A:   proyecto; ARRAYFORMULA(la categoria de la CUENTA, buscada en los tres bloques);
 *
 * Se conserva el nombre de la variable a proposito: cambiarlo obligaria a tocar todas sus
 * apariciones mas abajo en la misma formula, y cada token de mas es una chance de romperla.
 */
function _reapuntarBloqueCategorias(formula) {
    const cuenta = _colMotorTablero('cuenta');
    const bloques = ['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES'].map(function (clave) {
        const cfg = RANGES[clave];
        const idx = columnLetterToIndex(cfg.columns.proyecto) - columnLetterToIndex(cfg.columns.nombre) + 1;
        return { rango: _refHoja(cfg.sheet) + '!' + cfg.columns.nombre + ':' + cfg.columns.proyecto, idx: idx };
    });
    let expr = '""';
    for (let i = bloques.length - 1; i >= 0; i--) {
        expr = 'IFERROR(VLOOKUP(' + cuenta + '; ' + bloques[i].rango + '; ' + bloques[i].idx + '; 0); ' + expr + ')';
    }
    const nueva = 'ARRAYFORMULA(' + expr + ')';

    // Solo la linea que define la variable, y solo si hoy busca por el bloque de medios.
    const medios = RANGES.MEDIOS_PAGO;
    const rangoMedios = medios.start + ':' + medios.end;
    const re = new RegExp(
        '(\\w+)\\s*;\\s*ARRAYFORMULA\\(\\s*IFERROR\\(\\s*VLOOKUP\\([^;]+;[^;]*' +
        rangoMedios.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*;\\s*\\d+\\s*;\\s*0\\s*\\)\\s*;\\s*""\\s*\\)\\s*\\)', 'g');
    return formula.replace(re, function (m, variable) { return variable + '; ' + nueva; });
}

/** Referencia abierta a una columna del motor del Tablero, derivada de RANGES (regla SSOT). */
function _colMotorTablero(clave) {
    const cfg = RANGES.REGISTROS;
    const offset = columnLetterToIndex(cfg.columns[clave]) - columnLetterToIndex(cfg.start);
    const letra = columnIndexToLetter(columnLetterToIndex(FORM_COL_MOTOR_TABLERO) + offset);
    return letra + FORM_FILA_DERRAME_TABLERO + ':' + letra;
}

/**
 * Repara el rango del VLOOKUP de la variable `columna_tipo`: pedia la columna 2 a un rango de
 * UNA sola columna (RANGES.PROYECTOS.start:start, hoy P:P -- por eso #REF!, tapado por el
 * IFERROR que lo envuelve) y pasa a pedirla al rango real de dos columnas, RANGES.PROYECTOS
 * completo (hoy P:Q), con el indice de columna derivado de `columns.tipo` -- nunca hardcodeado.
 *
 * Cirugia de token: toca SOLO la definicion de `columna_tipo`. Si la formula no tiene esa forma
 * exacta (porque ya se reparo, o porque cambio de otra manera), el regex no matchea y se
 * devuelve la entrada intacta -- mismo criterio que _aListaBlanca/_conTipoEnCategorias de
 * DEVTOOL_RiquezaYCategorias.js: reemplazo por funcion, nunca por string (un '$' de una formula
 * con referencias absolutas se interpretaria como backreference en un replace de string).
 */
function _repararRangoTipoBcat(formula) {
    if (typeof formula !== 'string' || !formula) return formula;
    const cfg = RANGES.PROYECTOS;
    const rangoRoto = "'" + cfg.sheet + "'!" + cfg.start + ':' + cfg.start;      // 'Plan de Cuentas'!P:P
    const rangoCorrecto = "'" + cfg.sheet + "'!" + cfg.start + ':' + cfg.end;    // 'Plan de Cuentas'!P:Q
    const colTipo = columnLetterToIndex(cfg.columns.tipo) - columnLetterToIndex(cfg.start) + 1;  // 2

    const escapar = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    const re = new RegExp(
        '(' + BCAT_VAR_TIPO + '\\s*;\\s*ARRAYFORMULA\\(\\s*IFERROR\\(\\s*VLOOKUP\\([^;()]+;\\s*)' +
        escapar(rangoRoto) +
        '(\\s*;\\s*)\\d+(\\s*;\\s*0\\s*\\)\\s*;\\s*""\\s*\\)\\s*\\))'
    );
    return formula.replace(re, function (m, pre, sep, post) {
        return pre + rangoCorrecto + sep + colTipo + post;
    });
}

/**
 * Corre las dos cirugias de token sobre la formula viva y dice cual de las dos, si alguna,
 * cambia algo. estado y aplicar comparten esta funcion para no poder informar una cosa y
 * escribir otra.
 */
function _diagnosticarBcat(formulaActual) {
    const conCascada = _reapuntarBloqueCategorias(formulaActual);
    const conTipo = _repararRangoTipoBcat(conCascada);
    return {
        formulaNueva: conTipo,
        grupoCambia: conCascada !== formulaActual,
        tipoCambia: conTipo !== conCascada
    };
}

/**
 * Cuenta, sobre el catalogo VIVO (RANGES.PROYECTOS), cuantas categorias tienen nombre pero no
 * tienen Tipo. Solo lectura. Sirve para avisar, con un numero medido y no inventado, que la
 * columna Tipo del Tablero puede seguir en blanco despues de reparar el rango -- por catalogo
 * vacio, no por formula rota.
 */
function _contarCategoriasSinTipoBcat(ss) {
    const cfg = RANGES.PROYECTOS;
    const hojaPC = ss.getSheetByName(cfg.sheet);
    if (!hojaPC) return null;
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const filaDatos = getDataRow(cfg);
    const alto = hojaPC.getMaxRows() - filaDatos + 1;
    if (alto <= 0) return { total: 0, sinTipo: 0 };
    const valores = hojaPC.getRange(filaDatos, colIni, alto, nCols).getValues();
    let total = 0, sinTipo = 0;
    valores.forEach(function (f) {
        const nombre = String(f[0] || '').trim();
        const tipo = String(f[1] || '').trim();
        if (!nombre) return;
        total++;
        if (!tipo) sinTipo++;
    });
    return { total: total, sinTipo: sinTipo };
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * BCAT_CELDA es un dato de derrame (formula, no rotulo fijo), asi que no se puede verificar por
 * su propio contenido. Se verifica por el rotulo de la celda de ARRIBA (el header "Nombre" que
 * encabeza la columna): si ese rotulo no coincide, la geometria se movio de nuevo y no hay que
 * escribir a ciegas. Aborta ruidosamente en vez de seguir de largo.
 */
function _preflightRotuloBcat(hoja) {
    const vivo = String(hoja.getRange(BCAT_ROTULO_CELDA).getValue() || '').trim();
    if (_normalizarRotulo(vivo) !== _normalizarRotulo(BCAT_ROTULO_ESPERADO)) {
        throw new Error(BCAT_ROTULO_CELDA + ' dice "' + vivo + '" y se esperaba "' +
            BCAT_ROTULO_ESPERADO + '". Sin ese rotulo no hay evidencia de que ' + BCAT_CELDA +
            ' siga siendo la columna del bloque "Categorias". No se toco nada.');
    }
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura. */
function estadoBloqueCategorias() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        if (!hoja) throw new Error('No existe la hoja "' + NAV_CONFIG.SHEETS.TABLERO + '".');
        _preflightRotuloBcat(hoja);
        const actual = hoja.getRange(BCAT_CELDA).getFormula();
        if (!actual) throw new Error(BCAT_CELDA + ' no tiene formula.');
        const diag = _diagnosticarBcat(actual);
        const l = ['BLOQUE "CATEGORIAS" DEL TABLERO - ESTADO (no se escribio nada)', ''];

        if (!diag.grupoCambia && !diag.tipoCambia) {
            l.push('NADA QUE HACER: ' + BCAT_CELDA + ' ya agrupa por la categoria de la cuenta y');
            l.push('el Tipo ya busca en el rango correcto (' + RANGES.PROYECTOS.sheet + '!' +
                RANGES.PROYECTOS.start + ':' + RANGES.PROYECTOS.end + ').');
        } else {
            if (diag.grupoCambia) {
                l.push('HOY agrupa por el TIPO DEL MEDIO (Hogar / Ahorros / Inversiones / Financiacion):');
                l.push('eso contesta DONDE estaba la plata, no PARA QUE se uso.');
                l.push('');
                l.push('PASA A AGRUPAR por la CATEGORIA DE LA CUENTA, buscada en los tres bloques del Plan.');
                l.push('Vas a ver Vehiculo, Alimentacion y social, Deuda y financiacion, etc.');
                l.push('');
            }
            if (diag.tipoCambia) {
                l.push('LA COLUMNA TIPO ESTA ROTA: el VLOOKUP le pide la columna 2 a un rango de UNA');
                l.push('sola columna (' + RANGES.PROYECTOS.sheet + '!' + RANGES.PROYECTOS.start + ':' +
                    RANGES.PROYECTOS.start + '), asi que da #REF!, tapado por el IFERROR. La columna');
                l.push('Tipo del bloque nunca pudo mostrar nada. Pasa a buscar en el rango correcto (' +
                    RANGES.PROYECTOS.sheet + '!' + RANGES.PROYECTOS.start + ':' + RANGES.PROYECTOS.end + ').');
                const cat = _contarCategoriasSinTipoBcat(ss);
                if (cat && cat.sinTipo > 0) {
                    l.push('');
                    l.push('OJO: ' + cat.sinTipo + ' de ' + cat.total + ' categoria(s) del Plan de Cuentas');
                    l.push('tienen la columna Tipo (' + RANGES.PROYECTOS.sheet + '!' + RANGES.PROYECTOS.columns.tipo +
                        ') vacia hoy. Reparado el rango, esas van a seguir mostrando el Tipo en blanco --');
                    l.push('ya no por una formula rota, sino porque el catalogo todavia no tiene el dato.');
                }
                l.push('');
            }
            l.push('Es UNA sola celda: ' + NAV_CONFIG.SHEETS.TABLERO + '!' + BCAT_CELDA);
        }
        const t = l.join('\n');
        _mostrarBcat('Bloque Categorias - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarBcat('Bloque Categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica. Respaldo, escritura y relectura del valor. */
function aplicarBloqueCategorias() {
    let ss = null, previa = '';
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        if (!hoja) throw new Error('No existe la hoja "' + NAV_CONFIG.SHEETS.TABLERO + '".');
        _preflightRotuloBcat(hoja);
        const rango = hoja.getRange(BCAT_CELDA);
        previa = rango.getFormula();
        if (!previa) throw new Error(BCAT_CELDA + ' no tiene formula.');
        const diag = _diagnosticarBcat(previa);
        const nueva = diag.formulaNueva;
        if (!diag.grupoCambia && !diag.tipoCambia) {
            const t = BCAT_CELDA + ' ya agrupa por la categoria de la cuenta y el Tipo ya busca ' +
                'en el rango correcto. No se escribio nada.';
            _mostrarBcat('Bloque Categorias', t);
            return { ok: true, detalle: t };
        }

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarFormulerio(ss, sello);

        const errorPrevio = _errorDeCelda(rango);
        rango.setFormula(nueva);
        SpreadsheetApp.flush();

        const leida = rango.getFormula();
        const err = _errorDeCelda(rango);
        const fallas = [];
        if (!leida) fallas.push('quedo SIN formula');
        else if (_canonizarFormula(leida) !== _canonizarFormula(nueva)) fallas.push('no coincide con lo escrito');
        if (err) fallas.push('quedo en ' + err + (errorPrevio ? ' (ya estaba en ' + errorPrevio + ')' : ' (antes calculaba bien)'));
        // El bug del rango del Tipo no tira error DE CELDA (el IFERROR lo tapa, tal cual el
        // original): no alcanza con comparar texto, hay que releer la FORMA. Si _repararRangoTipoBcat
        // todavia encuentra algo para reparar en lo que quedo escrito, la reparacion no prendio.
        if (diag.tipoCambia && leida && _repararRangoTipoBcat(leida) !== leida) {
            fallas.push('el Tipo todavia busca en un rango de una sola columna');
        }
        if (fallas.length) {
            rango.setFormula(previa);
            SpreadsheetApp.flush();
            throw new Error(BCAT_CELDA + ' ' + fallas.join('; ') + '. Se restauro la formula previa. ' +
                'Respaldo en "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(BCAT_PROP_RESPALDO, respaldo.nombre);
        const partes = [];
        if (diag.grupoCambia) partes.push('agrupa por la CATEGORIA DE LA CUENTA en vez del tipo del medio');
        if (diag.tipoCambia) partes.push('el Tipo busca en ' + RANGES.PROYECTOS.sheet + '!' +
            RANGES.PROYECTOS.start + ':' + RANGES.PROYECTOS.end + ' en vez de un rango de una sola columna');
        let detalle = 'BLOQUE "CATEGORIAS" REPARADO\n\n' +
            '- Celda: ' + NAV_CONFIG.SHEETS.TABLERO + '!' + BCAT_CELDA + '\n' +
            '- Cambio: ' + partes.join('; ') + '\n' +
            '- Respaldo: "' + respaldo.nombre + '"\n';
        if (diag.tipoCambia) {
            const cat = _contarCategoriasSinTipoBcat(ss);
            if (cat && cat.sinTipo > 0) {
                detalle += '\nOJO: ' + cat.sinTipo + ' de ' + cat.total + ' categoria(s) del Plan de Cuentas ' +
                    'tienen la columna Tipo vacia hoy. La columna Tipo del Tablero va a seguir en blanco ' +
                    'para esas hasta que se cargue el catalogo -- ya no por una formula rota.\n';
            }
        }
        logSuccess('aplicarBloqueCategorias: ' + BCAT_CELDA + ' reparado (' + partes.join('; ') + ').');
        _mostrarBcat('Bloque Categorias - listo', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarBcat('Bloque Categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarBcat(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
