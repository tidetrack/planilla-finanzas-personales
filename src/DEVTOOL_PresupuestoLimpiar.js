/**
 * DEVTOOL_PresupuestoLimpiar.js
 * Vacia TODAS las celdas de "Monto a Proyectar" (K/O/S, DISENO_HOJA_PRESUPUESTO.md) de la hoja
 * "Presupuesto" que tengan contenido -- el COMPLEMENTO de DEVTOOL_PresupuestoSembrar.js y
 * DEVTOOL_PresupuestoPlasmar.js, que ESCRIBEN esa misma columna.
 *
 * [CONCEPTO DE NEGOCIO]
 * Pedido textual de Franco (2026-09-07), tercero de la misma tanda que motivo Plasmar: "deberia
 * existir un boton que limpie los montos a proyectar." K/O/S es la superficie de trabajo MANUAL
 * de Franco (ver la cabecera de DEVTOOL_PresupuestoPlasmar.js, decision de producto 1): un numero
 * tipeado a mano, sembrado desde J/N/R, o plasmado desde la BD "Proyeccion". Hoy la UNICA forma
 * de vaciarla es borrar celda por celda a mano. Este modulo agrega el camino inverso: un boton
 * que la vacia entera, con el mismo seguro que sus dos hermanos -- confirmacion con numeros
 * concretos, verificacion por relectura, reversion protegiendo una edicion posterior.
 *
 * ============================================================================
 * QUE CUENTA COMO "A LIMPIAR" (y por que no son las 90 celdas de la zona)
 * ============================================================================
 * `_planLimpiarPl` recorre las 90 celdas posibles (30 filas x 3 bloques, PM_FILA_INI..PM_FILA_FIN)
 * pero solo junta las que YA TIENEN CONTENIDO (`crudo !== '' && crudo !== null`): vaciar una celda
 * que ya esta vacia no cambia nada y no aporta ningun riesgo que respaldar. Si ninguna celda tiene
 * contenido, `aplicarPresupuestoLimpiar()` corre derecho, sin dialogo -- pedir confirmar una
 * operacion que no borra nada seria friccion sin beneficio, mismo criterio que Sembrar y Plasmar
 * usan para el caso simetrico ("nada que sembrar/plasmar").
 *
 * ============================================================================
 * EL SEGURO: CONFIRMACION EXPLICITA CON NUMEROS CONCRETOS (mismo patron que los dos hermanos)
 * ============================================================================
 * A diferencia de Plasmar (donde "pisa" es una de dos posibilidades), ACA toda celda que entra al
 * plan por definicion YA TIENE UN VALOR: limpiar SIEMPRE es un evento de perdida cuando hay algo
 * que limpiar. Por eso no hace falta una variante "breve" como la que Plasmar agrego para su
 * caso sin-perdida (ver la cabecera de ese modulo, "EL SEGURO"): aca la unica bifurcacion posible
 * es "no hay nada que limpiar" (sin dialogo) contra "hay N celdas con contenido" (dialogo YES_NO
 * completo, contando celdas y sumando montos, POR BLOQUE). Borrar el trabajo manual de Franco sin
 * avisar seria el peor defecto posible para este modulo -- la confirmacion nombra la cuenta EXACTA
 * antes de tocar una sola celda.
 *
 * La moneda que acompania el total es la del selector J4 AL MOMENTO de esta operacion,
 * informativa: K/O/S no guarda en que moneda se tipeo cada celda (mismo supuesto de una sola
 * moneda para toda la hoja que ya hacen Guardar/Sembrar/Plasmar, decision de producto 2 de la
 * cabecera de Plasmar). Si J4 cambio entre que se cargo un numero y hoy, el rotulo de moneda del
 * total puede no ser el que corresponde a cada celda -- el NUMERO de celdas y CUANTO suman siguen
 * siendo exactos, es solo la etiqueta de moneda la que es una lectura del momento.
 *
 * ============================================================================
 * RESPALDO: PropertiesService, CELDA SUELTA -- NO LA BOVEDA DE 18_RespaldoService.js
 * ============================================================================
 * DESVIACION DEL ENCARGO, DEJADA EXPLICITA: el pedido original nombraba la boveda
 * (18_RespaldoService.js) como mecanismo de respaldo. Se evalua y se descarta, por el MISMO
 * argumento, verbatim, que ya dejo por escrito DEVTOOL_PresupuestoPlasmar.js al tomar la misma
 * decision: `guardarRespaldoFilas` (la unica funcion publica de esa boveda) esta atada a la
 * geometria de RANGES.REGISTROS -- lee una banda CONTIGUA de 12 columnas (B:M) para un conjunto
 * de numeros de fila. "Monto a Proyectar" no tiene esa forma: son TRES columnas sueltas (K/O/S)
 * en tres bloques de filas independientes, sin relacion con RANGES.REGISTROS. Forzar esa funcion
 * aca exigiria inventar una nocion de "fila" que no corresponde a nada real, o reescribir la
 * boveda para aceptar celdas sueltas -- una modificacion no pedida a un modulo compartido del que
 * dependen DEVTOOL_ProyeccionAbm.js y DEVTOOL_PresupuestoGuardar.js.
 *
 * Lo que el encargo pide en el fondo -- "nunca crear una hoja por operacion" -- ya lo cumple el
 * patron `PS_PROP_PREVIOS`/`PP_PROP_PREVIOS` que usan Sembrar y Plasmar: PropertiesService puro,
 * cero `insertSheet`. Ese es el patron que este modulo reusa (`PL_PROP_PREVIOS`, mismo formato
 * por celda: `{celda, teniaContenido, valorPrevio}`). Es, ademas, el precedente YA establecido
 * en este mismo repo para escrituras de celda suelta en K/O/S: ni Sembrar ni Plasmar usan la
 * boveda para esta clase de operacion, y DEVTOOL_PurgaRespaldos.js (que purga los respaldos
 * legados de la boveda) nunca mira las claves `presupuesto_sembrar_previos` /
 * `presupuesto_plasmar_previos` -- estan, por diseno, fuera de su alcance. Sumar una TERCERA
 * convencion de respaldo (la boveda) para la MISMA clase de escritura que sus dos hermanos ya
 * resuelven de otra forma hubiera sido la inconsistencia, no la solucion.
 *
 * ============================================================================
 * PREFLIGHT: MAS ANGOSTO QUE EL DE PLASMAR/SEMBRAR (a proposito)
 * ============================================================================
 * Mismo criterio, textual, que ya justifica el preflight angosto de Plasmar ("este modulo no lee
 * el selector de Modo, asi que no lo valida"): `_preflightPl` NO valida PM_SELECTORES (periodo,
 * moneda -- solo se LEE moneda para el rotulo informativo del total, sin abortar si esta vacia o
 * es invalida) ni PM_BLOQUES.rotuloCuenta/tituloBloque (este modulo nunca busca ni muestra
 * nombres de cuenta, solo limpia por numero de fila). Lo que SI valida, porque es exactamente lo
 * que toca:
 *   1. PM_TITULO (C2): que la hoja siga siendo "Presupuesto financiero del Mes".
 *   2. Las tres celdas de titulo "Monto a Proyectar" (K7/O7/S7, PC_TITULO_PROYECTAR): son la
 *      columna que este modulo borra.
 *   3. CERO formulas en la zona K/O/S (PM_FILA_INI..PM_FILA_FIN): si hay una formula viva, algo
 *      escribio ahi que no es Franco a mano ni este modulo, y no sabe convivir con eso -- ABORTA
 *      sin tocar nada, mismo mensaje que sus hermanos.
 *
 * ============================================================================
 * NINGUNA CONSTANTE DE NIVEL SUPERIOR DE ESTE ARCHIVO LEE UN SIMBOLO DE OTRO ARCHIVO
 * ============================================================================
 * Cicatriz v0.50.1: Apps Script evalua src/ en orden alfabetico sin filePushOrder en .clasp.json,
 * y "...PresupuestoLimpiar" ordena DESPUES de "...PresupuestoGuardar" pero ANTES de
 * "...PresupuestoModo" y de "...PresupuestoResumen" -- exactamente los dos archivos de los que
 * este modulo depende para PM_TITULO/PM_CLAVES_BLOQUE/PM_FILA_INI/PM_FILA_FIN/PM_SELECTORES y
 * para `_bloquesPc()`/PC_TITULO_PROYECTAR. Por eso todos esos simbolos, mas SHEETS,
 * MONEDAS_DISPONIBLES y `_rotulosCompatibles` (DEVTOOL_FormulerioV0111.js, que SI carga antes por
 * orden alfabetico -- pero la regla se respeta igual, por si algun dia deja de ser cierto), se
 * leen DENTRO de un cuerpo de funcion, nunca en un const/let de nivel superior de este archivo.
 * `PL_PROP_PREVIOS` es un literal puro: no lee nada de otro archivo, es seguro como const de
 * nivel superior.
 *
 * QUE NO HACE
 * 1. NO toca J/N/R, la columna V/W, las tablas resumen, el selector de Modo, "Guardar Proyeccion"
 *    ni la hoja-BD "Proyeccion": son piezas de otros modulos ya desplegados, y este modulo nunca
 *    abre esa hoja.
 * 2. NO convierte ni valida moneda: el total que muestra es informativo (ver "EL SEGURO" arriba).
 * 3. NO limpia una celda que ya esta vacia (ver "QUE CUENTA COMO 'A LIMPIAR'").
 * 4. NO escribe formulas, nunca: `clearContent()` para borrar, `setValue(numero)` para revertir.
 *
 * Reusa de DEVTOOL_PresupuestoModo.js: PM_TITULO, PM_SELECTORES, PM_BLOQUES, PM_CLAVES_BLOQUE,
 * PM_FILA_INI, PM_FILA_FIN.
 * Reusa de DEVTOOL_PresupuestoResumen.js: _bloquesPc() (colProyectar: K/O/S), PC_TITULO_PROYECTAR.
 * Reusa de DEVTOOL_FormulerioV0111.js: _rotulosCompatibles.
 * Reusa de 00_Config.js/03_SheetManager.js: SHEETS, MONEDAS_DISPONIBLES.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoSembrar.js (el patron de escritura en K/O/S; este modulo hace lo inverso)
 * @see DEVTOOL_PresupuestoPlasmar.js (mismo patron de respaldo por celda suelta, con la razon completa)
 * @see devtools/probar_presupuesto_limpiar.js
 * @version 0.67.1
 * @since 0.67.1
 * @lastModified 2026-09-07
 */

// ============================================
// CONSTANTES PROPIAS (literal puro: no lee ningun simbolo de otro archivo -- ver cabecera)
// ============================================

const PL_PROP_PREVIOS = 'presupuesto_limpiar_previos';

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que "Presupuesto" sea la hoja que este modulo cree que es, ANTES de leer o escribir
 * una sola celda -- por ROTULO, como el resto del arnes. Angosto a proposito (ver cabecera, "MAS
 * ANGOSTO QUE EL DE PLASMAR/SEMBRAR"): este modulo no lee PM_SELECTORES ni PM_BLOQUES.rotuloCuenta,
 * asi que no los valida. Todas las referencias a PM_*, _bloquesPc y PC_TITULO_PROYECTAR van
 * DENTRO del cuerpo (invocacion, no carga) -- ver la cabecera del archivo.
 */
function _preflightPl(ss) {
    const nombre = SHEETS.PRESUPUESTO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const desvios = [];
    const vivoDe = function (celda) { return hoja.getRange(celda).getValue(); };
    const chequear = function (celda, esperado) {
        const vivo = vivoDe(celda);
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(celda + ' dice "' + vivo + '" y se esperaba "' + esperado + '"');
        }
    };

    chequear(PM_TITULO.celda, PM_TITULO.esperado);
    PM_CLAVES_BLOQUE.forEach(function (k) {
        chequear(_bloquesPc()[k].colProyectar + '7', PC_TITULO_PROYECTAR);
    });

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' + desvios.join('; ') +
            '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // --- K/O/S (9-38) tienen que ser una zona de VALORES: si alguna celda ya tiene formula, ---
    // --- algo escribio ahi que no es Franco a mano y este modulo no sabe convivir con eso. ---
    // --- Mismo chequeo, mismo mensaje, que _preflightPs/_preflightPp. ---
    const conFormula = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = _bloquesPc()[k].colProyectar;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            if (hoja.getRange(col + f).getFormula()) conFormula.push(col + f);
        }
    });
    if (conFormula.length) {
        throw new Error('Hay formulas en la zona de "Monto a Proyectar" (deberia ser solo valores ' +
            'tipeados a mano): ' + conFormula.slice(0, 8).join(', ') +
            (conFormula.length > 8 ? ' (y ' + (conFormula.length - 8) + ' mas)' : '') +
            '. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre };
}

// ============================================
// PLAN (solo lectura)
// ============================================

/** Nombre de bloque legible, mismo criterio que sus hermanos. */
function _nombreBloquePl(k) {
    return k === 'ingresos' ? 'Ingresos' : (k === 'fijos' ? 'Gastos Fijos' : 'Gastos Variables');
}

/**
 * La moneda VIVA del selector J4, solo para el rotulo informativo del total (ver cabecera, "EL
 * SEGURO"). Nunca aborta por esto: una moneda vacia o irreconocible no impide limpiar celdas, asi
 * que se devuelve un texto honesto en vez de tirar.
 */
function _monedaVivaPl(hoja) {
    const cruda = String(hoja.getRange(PM_SELECTORES.moneda).getValue() || '').trim();
    return MONEDAS_DISPONIBLES.indexOf(cruda) !== -1 ? cruda : '(moneda no reconocida en J4: "' + cruda + '")';
}

/**
 * Recorre las 90 celdas posibles de K/O/S y junta SOLO las que tienen contenido (ver cabecera,
 * "QUE CUENTA COMO 'A LIMPIAR'"). No escribe nada.
 */
function _planLimpiarPl(pre) {
    const hoja = pre.hoja;
    const aLimpiar = [];   // [{celda, bloque, fila, valorPrevio}]
    const porBloque = {};
    let total = 0;

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = _bloquesPc()[k].colProyectar;
        let nConContenido = 0;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            const celda = col + f;
            const crudo = hoja.getRange(celda).getValue();
            if (crudo === '' || crudo === null) continue;
            aLimpiar.push({ celda: celda, bloque: k, fila: f, valorPrevio: crudo });
            nConContenido++;
            if (isFinite(Number(crudo))) total += Number(crudo);
        }
        porBloque[k] = nConContenido;
    });

    return { aLimpiar: aLimpiar, total: total, porBloque: porBloque };
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: preflight + plan. No escribe nada. */
function estadoPresupuestoLimpiar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPl(ss);
        const plan = _planLimpiarPl(pre);
        const moneda = _monedaVivaPl(pre.hoja);

        const l = ['PRESUPUESTO: LIMPIAR MONTO A PROYECTAR - ESTADO (no se escribio nada)', ''];

        if (!plan.aLimpiar.length) {
            l.push('NADA QUE LIMPIAR: "Monto a Proyectar" (K/O/S) ya esta vacia en "' + pre.nombre + '".');
        } else {
            l.push('CELDAS CON CONTENIDO: ' + plan.aLimpiar.length + ', suman ' + plan.total.toFixed(2) +
                ' ' + moneda + ' (moneda del selector J4 al momento de esta medicion, informativa).');
            l.push('"2. Aplicar" va a pedir CONFIRMACION EXPLICITA antes de borrarlas.');
            l.push('');
            l.push('POR BLOQUE:');
            PM_CLAVES_BLOQUE.forEach(function (k) {
                l.push('  ' + _nombreBloquePl(k) + ': ' + plan.porBloque[k] + ' celda(s) con contenido');
            });
        }

        const detalle = l.join('\n');
        _mostrarPl('Presupuesto: limpiar Monto a Proyectar - estado', detalle);
        logInfo('estadoPresupuestoLimpiar: ' + plan.aLimpiar.length + ' celda(s) con contenido, suman ' + plan.total.toFixed(2) + '.');
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPl('Presupuesto: limpiar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Vacia TODAS las celdas de "Monto a Proyectar" (K/O/S) que tengan contenido. Pide confirmacion
 * explicita SIEMPRE que haya al menos una celda con contenido (ver cabecera, "EL SEGURO":
 * a diferencia de Plasmar, toda celda del plan ya tiene un valor, asi que no hay un caso
 * "sin perdida" que amerite una confirmacion breve). Si no hay ninguna, corre derecho. Verifica
 * releyendo cada celda borrada y revierte el lote entero al estado previo exacto si algo no
 * verifica. SIN PARAMETROS: pensada para asignarse a un dibujo de la hoja "Presupuesto".
 */
function aplicarPresupuestoLimpiar() {
    let ui = null, hoja = null, borradas = [];
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoLimpiar necesita UI (menu tidetrack Dev, o un dibujo en la hoja).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPl(ss);
        hoja = pre.hoja;
        const plan = _planLimpiarPl(pre);
        const moneda = _monedaVivaPl(hoja);

        if (!plan.aLimpiar.length) {
            const t = 'NADA QUE LIMPIAR: "Monto a Proyectar" (K/O/S) ya esta vacia en "' + pre.nombre +
                '". No se toco nada.';
            _mostrarPl('Presupuesto: limpiar Monto a Proyectar', t);
            return { ok: true, detalle: t };
        }

        const confirmacion = [
            'Se van a BORRAR ' + plan.aLimpiar.length + ' celda(s) de "Monto a Proyectar" en "' +
            pre.nombre + '".',
            '',
            'Suman ' + plan.total.toFixed(2) + ' ' + moneda + ' en total (moneda del selector J4 al ' +
            'momento de esta operacion, informativa).',
            '',
            'POR BLOQUE:'
        ];
        PM_CLAVES_BLOQUE.forEach(function (k) {
            if (plan.porBloque[k]) confirmacion.push('  ' + _nombreBloquePl(k) + ': ' + plan.porBloque[k] + ' celda(s)');
        });
        confirmacion.push('');
        confirmacion.push('Esto es TRABAJO MANUAL: numeros tipeados a mano, sembrados o plasmados en esta');
        confirmacion.push('columna. "3. Revertir" repone exactamente lo que habia, siempre que ninguna de');
        confirmacion.push('esas celdas se haya vuelto a editar despues de esta corrida.');
        confirmacion.push('');
        confirmacion.push('Corriste antes "1. Ver estado" y revisaste la lista completa?');
        confirmacion.push('');
        confirmacion.push('Continuar?');

        const conf = ui.alert(
            'Presupuesto: limpiar Monto a Proyectar -- SE VAN A BORRAR ' + plan.aLimpiar.length + ' CELDA(S)',
            confirmacion.join('\n'), ui.ButtonSet.YES_NO
        );
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se borro nada.' };

        plan.aLimpiar.forEach(function (c) {
            hoja.getRange(c.celda).clearContent();
            borradas.push(c);
        });
        SpreadsheetApp.flush();

        // Verificacion: se relee el VALOR de vuelta, nunca se asume que clearContent funciono.
        const fallas = [];
        borradas.forEach(function (c) {
            const releido = hoja.getRange(c.celda).getValue();
            if (releido !== '' && releido !== null) {
                fallas.push(c.celda + ' deberia haber quedado vacia y tiene ' + JSON.stringify(releido));
            }
        });

        if (fallas.length) {
            // Reversion de TODO el lote al estado previo exacto de cada celda.
            borradas.forEach(function (c) {
                try { hoja.getRange(c.celda).setValue(c.valorPrevio); }
                catch (e2) { logError('No se pudo reponer ' + c.celda + ' al revertir: ' + e2.message); }
            });
            SpreadsheetApp.flush();
            throw new Error('Se borro pero NO VERIFICA: ' + fallas.join('; ') + '. Se repuso el valor previo ' +
                'de cada celda de esta corrida.');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PL_PROP_PREVIOS, JSON.stringify({
            sello: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm'),
            celdas: borradas.map(function (c) { return { celda: c.celda, valorPrevio: c.valorPrevio }; })
        }));

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" LIMPIADO.', ''];
        l.push('Celdas borradas y verificadas: ' + borradas.length + ', sumaban ' + plan.total.toFixed(2) + ' ' + moneda + '.');
        l.push('');
        l.push('Para deshacer: "3. Revertir" (tidetrack Dev). Repone EXACTAMENTE el valor previo en cada');
        l.push('celda que TODAVIA este vacia por esta corrida -- si escribiste algo nuevo ahi despues,');
        l.push('revertir la deja como la dejaste, no la pisa.');
        const detalle = l.join('\n');

        logSuccess('aplicarPresupuestoLimpiar: ' + borradas.length + ' celda(s) borradas, sumaban ' + plan.total.toFixed(2) + '.');
        _mostrarPl('Presupuesto: limpiar Monto a Proyectar - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPl('Presupuesto: limpiar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Deshace la ultima corrida aplicada -- solo celda por celda que TODAVIA este vacia por esa
 * corrida. Una celda en la que Franco escribio algo nuevo despues de limpiarla se queda como
 * esta. Mismo patron, textual, que `revertirPresupuestoSembrar`/`revertirPresupuestoPlasmar`.
 */
function revertirPresupuestoLimpiar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(PL_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
        if (!hoja) throw new Error('No existe la hoja "' + SHEETS.PRESUPUESTO + '".');

        let restauradas = 0;
        const dejadasComoEstan = [];
        (previos.celdas || []).forEach(function (c) {
            const rango = hoja.getRange(c.celda);
            const vivo = rango.getValue();
            const sigueVacia = (vivo === '' || vivo === null);
            if (sigueVacia) {
                rango.setValue(c.valorPrevio);
                restauradas++;
            } else {
                dejadasComoEstan.push(c.celda);
            }
        });
        SpreadsheetApp.flush();
        props.deleteProperty(PL_PROP_PREVIOS);

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" (LIMPIADO) REVERTIDO.', ''];
        l.push('Corrida original: sello ' + (previos.sello || '?'));
        l.push('Celdas repuestas a su valor previo: ' + restauradas + ' de ' + (previos.celdas || []).length + ' borradas.');
        if (dejadasComoEstan.length) {
            l.push('Celdas donde se escribio algo nuevo despues de limpiarlas y por eso NO se tocaron: ' +
                dejadasComoEstan.slice(0, 8).join(', ') +
                (dejadasComoEstan.length > 8 ? ' (y ' + (dejadasComoEstan.length - 8) + ' mas)' : ''));
        }
        const detalle = l.join('\n');
        logSuccess('revertirPresupuestoLimpiar: ' + restauradas + ' celda(s) repuestas, ' +
            dejadasComoEstan.length + ' dejadas como estan.');
        _mostrarPl('Presupuesto: limpiar Monto a Proyectar - revertido', detalle);
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPl('Presupuesto: limpiar Monto a Proyectar - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPl(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
