/**
 * DEVTOOL_LimpiarPlanCuentas.js
 * Deja el Plan de Cuentas en su forma final: un solo catalogo de categorias en P, y los restos
 * de las migraciones del dia barridos.
 *
 * [CONCEPTO DE NEGOCIO]
 * El Plan de Cuentas quedo con arqueologia de una jornada larga: la columna Q con el titulo y el
 * encabezado de un bloque que ya no tiene datos, el catalogo de categorias de cuentas escrito a
 * medias en U por una corrida que murio en D8, y sobras sueltas mas a la derecha. Nada de eso
 * rompe nada, y justamente por eso se queda para siempre si no se barre a proposito.
 *
 * decision Franco 2026-08-19: "necesito que en la columna P esten todas las categorias, que la
 * columna Q la elimines, y que revises porque quedaron cosas escritas en las columnas STU".
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Un catalogo es una fuente de verdad, y una fuente de verdad con restos de versiones anteriores
 * al lado deja de ser confiable: el que la lee tiene que adivinar que parte esta viva. Barrerlo
 * no es cosmetica.
 *
 * ============================================================================
 * POR QUE LA COLUMNA Q SE VACIA Y NO SE BORRA -- llamada de criterio, no pereza
 * ============================================================================
 * Borrar fisicamente una columna CORRE todo lo que esta a su derecha: R pasa a Q, S a R, T a S,
 * U a T. Y en S vive la formula que la propia hoja rotula "fuente de validacion - no tocar": es
 * la que alimenta el desplegable de Cuenta en la hoja de Cargas.
 *
 * Sheets reacomoda las referencias de las FORMULAS al correr columnas, pero los rangos de las
 * REGLAS DE VALIDACION no siempre siguen -- y hoy ya nos costo dos corridas descubrir que las
 * validaciones se comportan distinto de lo que uno espera. Si esa referencia se rompe, el
 * desplegable de Cargas se queda sin lista y la planilla deja de poder cargar movimientos.
 *
 * El beneficio de borrarla es una columna vacia menos. Entre P y S ya hay una columna separadora
 * (R), igual que entre todos los demas bloques de la hoja: dejar Q vacia agrega una segunda
 * separadora y nada mas. No vale arriesgar la carga de datos por eso.
 *
 * Queda vacia de contenido, de titulo, de encabezado y de validacion: a la vista es una columna
 * que no existe. Si despues de verificar que todo anda se la quiere borrar de verdad, es un
 * click a mano y con la planilla ya estable.
 *
 * ============================================================================
 * QUE NO TOCA
 * ============================================================================
 * 1. La columna S. Es la consolidada de cuentas que alimenta el desplegable de Cargas, y la hoja
 *    lo dice en su propio encabezado. Se VERIFICA que siga teniendo su formula, y si no la tiene
 *    se aborta antes de escribir nada.
 * 2. Los bloques de cuentas (C:D, F:G, I:J) ni el de medios (L:N).
 * 3. El ledger.
 *
 * @version 0.21.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 */

const LPC_PROP_RESPALDO = 'limpiar_plan_respaldo';

/** Columnas a barrer por completo: contenido, titulo, encabezado y validacion. */
const LPC_COLUMNAS_A_BARRER = ['Q', 'T', 'U', 'V', 'W'];

/** La consolidada, que se verifica y no se toca. */
const LPC_COL_CONSOLIDADA = 'S';

/** Fila del titulo de bloque en el Plan de Cuentas (los headers van en HEADER_ROW). */
const LPC_FILA_TITULO = 6;

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: que barreria y que escribiria. */
function estadoLimpiarPlan() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planLpc(ss);
        const l = ['PLAN DE CUENTAS - LIMPIEZA (no se escribio nada)', ''];
        l.push('CATEGORIAS a dejar en la columna ' + RANGES.CATEGORIAS_CUENTA.columns.nombre + ': ' +
            plan.categorias.length);
        l.push('   ' + plan.categorias.join(', '));
        l.push('');
        l.push('A BARRER:');
        if (!plan.aBarrer.length) l.push('   (nada: ya esta limpio)');
        plan.aBarrer.forEach(function (b) {
            l.push('   columna ' + b.col + ': ' + b.detalle);
        });
        l.push('');
        l.push('LA CONSOLIDADA (columna ' + LPC_COL_CONSOLIDADA + '): ' + plan.consolidada);
        l.push('   No se toca. Es la que alimenta el desplegable de Cuenta en Cargas.');
        if (plan.avisos.length) {
            l.push('');
            l.push('Avisos:');
            plan.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarLpc('Limpiar Plan de Cuentas - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarLpc('Limpiar Plan de Cuentas - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Escribe las categorias en P y barre los restos. */
function aplicarLimpiarPlan() {
    let ui = null, ss = null, foto = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarLimpiarPlan necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planLpc(ss);

        const conf = ui.alert('Dejar el Plan de Cuentas en su forma final',
            'Se va a:\n\n' +
            '  - dejar las ' + plan.categorias.length + ' categorias en la columna ' +
            RANGES.CATEGORIAS_CUENTA.columns.nombre + ', con su desplegable\n' +
            '  - barrer ' + plan.aBarrer.length + ' columna(s): ' +
            (plan.aBarrer.map(function (b) { return b.col; }).join(', ') || 'ninguna') + '\n\n' +
            'La columna ' + LPC_COL_CONSOLIDADA + ' NO se toca: es la que alimenta el desplegable de ' +
            'Cargas.\n\n' +
            'La columna Q se deja VACIA, no se borra: borrarla correria S a R y el rango de esa ' +
            'validacion podria no seguirla, dejando la carga de movimientos sin lista. Entre P y S ' +
            'ya hay una columna separadora, asi que a la vista queda igual.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarCatalogo(ss, hojaPC, sello);
        foto = _fotografiarColumnasLpc(ss);

        // --- 1. Las categorias en P, con el dominio abierto primero ---
        const cfg = RANGES.CATEGORIAS_CUENTA;
        const colP = columnLetterToIndex(cfg.columns.nombre);
        const desdeP = getDataRow(cfg);
        const altoP = hojaPC.getMaxRows() - desdeP + 1;
        if (altoP > 0) {
            const rangoP = hojaPC.getRange(desdeP, colP, altoP, 1);
            rangoP.clearDataValidations();
            rangoP.clearContent();
            const salida = plan.categorias.map(function (c) { return [c]; });
            if (salida.length) hojaPC.getRange(desdeP, colP, salida.length, 1).setValues(salida);
        }
        hojaPC.getRange(LPC_FILA_TITULO, colP).setValue('Categorías.');
        hojaPC.getRange(HEADER_ROW, colP).setValue('Nombre');

        // --- 2. Barrer los restos ---
        plan.aBarrer.forEach(function (b) {
            const col = columnLetterToIndex(b.col);
            const alto = hojaPC.getMaxRows() - LPC_FILA_TITULO + 1;
            if (alto <= 0) return;
            const rango = hojaPC.getRange(LPC_FILA_TITULO, col, alto, 1);
            rango.clearDataValidations();
            rango.clearContent();
        });
        SpreadsheetApp.flush();

        // --- 3. Relectura ---
        const fallas = [];
        const leidas = altoP > 0
            ? hojaPC.getRange(desdeP, colP, Math.max(plan.categorias.length, 1), 1).getValues()
                .map(function (f) { return String(f[0] || '').trim(); })
            : [];
        plan.categorias.forEach(function (c, i) {
            if (leidas[i] !== c) fallas.push('la categoria "' + c + '" no quedo en la fila ' + (desdeP + i));
        });
        plan.aBarrer.forEach(function (b) {
            const col = columnLetterToIndex(b.col);
            const alto = hojaPC.getMaxRows() - LPC_FILA_TITULO + 1;
            const resto = hojaPC.getRange(LPC_FILA_TITULO, col, alto, 1).getValues()
                .filter(function (f) { return String(f[0] || '').trim() !== ''; }).length;
            if (resto > 0) fallas.push('la columna ' + b.col + ' quedo con ' + resto + ' celda(s) con dato');
        });
        // Y la consolidada tiene que seguir intacta.
        if (!hojaPC.getRange(LPC_COL_CONSOLIDADA + getDataRow(RANGES.INGRESOS)).getFormula()) {
            fallas.push('la consolidada de la columna ' + LPC_COL_CONSOLIDADA + ' perdio su formula');
        }

        if (fallas.length) {
            _restaurarColumnasLpc(ss, foto);
            foto = null;
            throw new Error('Se escribio pero NO VERIFICA al releer: ' + fallas.slice(0, 5).join('; ') +
                (fallas.length > 5 ? ' (y ' + (fallas.length - 5) + ' mas)' : '') +
                '. Se restauro el Plan de Cuentas. El respaldo esta en "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(LPC_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'PLAN DE CUENTAS EN SU FORMA FINAL\n\n' +
            '- Categorias en la columna ' + cfg.columns.nombre + ': ' + plan.categorias.length + '\n' +
            '- Columnas barridas: ' + (plan.aBarrer.map(function (b) { return b.col; }).join(', ') || 'ninguna') + '\n' +
            '- La consolidada de ' + LPC_COL_CONSOLIDADA + ' quedo intacta y con su formula\n' +
            '- Respaldo del catalogo previo: "' + respaldo.nombre + '"\n\n' +
            'LA COLUMNA Q quedo VACIA de contenido, titulo, encabezado y validacion: a la vista es\n' +
            'una columna que no existe. No se borro fisicamente porque eso correria S a R y el\n' +
            'rango de esa validacion podria no seguirla, dejando el desplegable de Cargas sin lista.\n' +
            'Si despues de verificar que todo anda la queres borrar de verdad, es un click a mano.\n\n' +
            'QUE MIRAR: el desplegable de Cuenta en la hoja de Cargas tiene que seguir funcionando.';

        logSuccess('aplicarLimpiarPlan: ' + plan.categorias.length + ' categorias, ' + plan.aBarrer.length + ' columnas barridas.');
        _mostrarLpc('Limpiar Plan de Cuentas - listo', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && foto) {
            try { _restaurarColumnasLpc(ss, foto); restaurado = ' Se restauro el Plan de Cuentas.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + '): usar el respaldo.'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarLpc('Limpiar Plan de Cuentas - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PLAN
// ============================================

function _planLpc(ss) {
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    if (!hojaPC) throw new Error('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '".');
    const avisos = [];

    // La consolidada TIENE que seguir viva: sin ella la hoja de Cargas se queda sin desplegable.
    const celdaCons = LPC_COL_CONSOLIDADA + getDataRow(RANGES.INGRESOS);
    const formulaCons = hojaPC.getRange(celdaCons).getFormula();
    if (!formulaCons) {
        throw new Error('La consolidada de ' + celdaCons + ' no tiene formula. Esa columna alimenta ' +
            'el desplegable de Cuenta en Cargas: si ya esta rota, hay que arreglarla ANTES de barrer ' +
            'nada alrededor. No se toco nada.');
    }

    // Las categorias salen del mapa de DEVTOOL_CategorizarCuentas: una sola fuente, sin copiar.
    const categorias = [];
    CATZ_MAPA.forEach(function (m) {
        if (categorias.indexOf(m.categoria) === -1) categorias.push(m.categoria);
    });
    categorias.sort();

    // Que hay realmente en cada columna a barrer.
    const aBarrer = [];
    LPC_COLUMNAS_A_BARRER.forEach(function (letra) {
        const col = columnLetterToIndex(letra);
        if (col > hojaPC.getMaxColumns()) return;
        const alto = hojaPC.getMaxRows() - LPC_FILA_TITULO + 1;
        if (alto <= 0) return;
        const vals = hojaPC.getRange(LPC_FILA_TITULO, col, alto, 1).getValues();
        const conDato = vals.filter(function (f) { return String(f[0] || '').trim() !== ''; });
        let conValidacion = 0;
        try {
            hojaPC.getRange(LPC_FILA_TITULO, col, alto, 1).getDataValidations().forEach(function (f) {
                if (f[0]) conValidacion++;
            });
        } catch (e) { conValidacion = 0; }
        if (!conDato.length && !conValidacion) return;
        const muestra = conDato.slice(0, 4).map(function (f) { return '"' + String(f[0]).slice(0, 18) + '"'; });
        aBarrer.push({
            col: letra,
            detalle: conDato.length + ' celda(s) con dato' +
                (muestra.length ? ' (' + muestra.join(', ') + (conDato.length > 4 ? ', ...' : '') + ')' : '') +
                (conValidacion ? ' y ' + conValidacion + ' con validacion' : '')
        });
    });

    // Formulas que todavia apuntan al bloque viejo: si quedara alguna, vaciar Q la dejaria sin
    // fuente. Se avisa; no se aborta, porque vaciar no mueve columnas.
    const cfgViejo = RANGES.PROYECTOS;
    const refViejo = cfgViejo.start + ':' + cfgViejo.end;
    const colgadas = [];
    [NAV_CONFIG.SHEETS.INICIO, NAV_CONFIG.SHEETS.TABLERO].forEach(function (nombreHoja) {
        const hoja = ss.getSheetByName(nombreHoja);
        if (!hoja) return;
        const ultF = Math.max(1, hoja.getLastRow());
        const ultC = Math.max(1, hoja.getLastColumn());
        if (ultF * ultC > 400000) return;
        hoja.getRange(1, 1, ultF, ultC).getFormulas().forEach(function (fila, r) {
            fila.forEach(function (f, c) {
                if (f && f.indexOf(refViejo) !== -1) {
                    colgadas.push(nombreHoja + '!' + columnIndexToLetter(c + 1) + (r + 1));
                }
            });
        });
    });
    if (colgadas.length) {
        avisos.push('OJO: ' + colgadas.length + ' formula(s) todavia apuntan a ' + refViejo +
            ' y ese bloque se vacia: ' + colgadas.slice(0, 6).join(', ') +
            (colgadas.length > 6 ? ' y ' + (colgadas.length - 6) + ' mas' : '') +
            '. Correr antes "Tipo de medios", que es el que las colapsa.');
    }

    return {
        categorias: categorias, aBarrer: aBarrer, avisos: avisos,
        consolidada: 'viva, formula de ' + formulaCons.length + ' caracteres en ' + celdaCons
    };
}

// ============================================
// FOTO Y RESTAURACION
// ============================================

function _fotografiarColumnasLpc(ss) {
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    const letras = LPC_COLUMNAS_A_BARRER.concat([RANGES.CATEGORIAS_CUENTA.columns.nombre]);
    const partes = [];
    letras.forEach(function (letra) {
        const col = columnLetterToIndex(letra);
        if (col > hojaPC.getMaxColumns()) return;
        const alto = hojaPC.getMaxRows() - LPC_FILA_TITULO + 1;
        if (alto <= 0) return;
        const rango = hojaPC.getRange(LPC_FILA_TITULO, col, alto, 1);
        let dv = null;
        try { dv = rango.getDataValidations(); } catch (e) { dv = null; }
        partes.push({ col: col, desde: LPC_FILA_TITULO, valores: rango.getValues(), validaciones: dv });
    });
    return partes;
}

function _restaurarColumnasLpc(ss, foto) {
    if (!foto || !foto.length) return;
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    foto.forEach(function (p) {
        const rango = hojaPC.getRange(p.desde, p.col, p.valores.length, 1);
        rango.clearDataValidations();
        rango.setValues(p.valores);
    });
    SpreadsheetApp.flush();
    foto.forEach(function (p) {
        if (!p.validaciones) return;
        try { hojaPC.getRange(p.desde, p.col, p.valores.length, 1).setDataValidations(p.validaciones); }
        catch (e) { logError('_restaurarColumnasLpc: no se pudo reponer la validacion de la columna ' + p.col); }
    });
    SpreadsheetApp.flush();
}

function _mostrarLpc(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
