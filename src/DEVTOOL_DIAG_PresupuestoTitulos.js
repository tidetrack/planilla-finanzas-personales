/**
 * DEVTOOL_DIAG_PresupuestoTitulos.js
 * DIAGNOSTICO TEMPORAL, SOLO LECTURA. Borrar este archivo y su entrada de menu cuando el
 * incidente de v0.45.0 quede confirmado y cerrado con Franco.
 *
 * [CONCEPTO DE NEGOCIO]
 * v0.45.0 se desplego y se aplico en la planilla real. "2. Aplicar" NO VERIFICO y se revirtio
 * solo: "Presupuesto!J7/N7/R7 no quedo con el valor escrito". La hipotesis inicial (razonable,
 * es una cicatriz conocida de este repo) era una celda COMBINADA: escribir en la mitad muda de
 * una combinada no da error y no hace nada.
 *
 * El analisis de codigo (ver "EL INCIDENTE DE v0.45.0" en la cabecera de
 * DEVTOOL_PresupuestoModo.js) encontro la causa real: un bug de `_entradaEscritaPm` que hacia
 * que `_verificarEscrituraSyf` comparara el VALOR CALCULADO de la celda contra el TEXTO DE LA
 * FORMULA -- nada que ver con una combinada. Dos hechos lo confirman: (1) el preflight YA tenia
 * un guard para celdas combinadas en J7/N7/R7 y no aborto (si fueran la mitad muda, habria
 * frenado ANTES de escribir, y "1. Ver estado" no habria dicho "93 celdas a escribir"); (2) el
 * texto EXACTO del error reportado es el mensaje de la rama `esValor` de _verificarEscrituraSyf,
 * no el de "quedo SIN formula" (que es lo que se veria si la escritura hubiera sido un no-op).
 *
 * Este diagnostico mide en vivo, de todas formas, si TAMBIEN hay una combinada de por medio en
 * la fila 7 de los tres bloques (mas la columna vecina K/O/S, "Monto a Proyectar", por si el
 * merge cruza la frontera) -- para cerrar la duda con evidencia y no solo con razonamiento sobre
 * el codigo. No escribe una sola celda.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: "no asumas, medi y reporta" antes de confiar en un diagnostico.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoModo.js
 * @version 0.45.1
 * @since 2026-08-24
 * @lastModified 2026-08-24
 */
function _DIAG_medirTitulosPresupuesto() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
        if (!hoja) throw new Error('No existe la hoja "' + SHEETS.PRESUPUESTO + '".');

        const celdas = ['I7', 'J7', 'K7', 'M7', 'N7', 'O7', 'Q7', 'R7', 'S7'];
        const l = ['DIAGNOSTICO: fila 7 de "Presupuesto" (I:S) -- solo lectura, no escribio nada', ''];
        celdas.forEach(function (a1) {
            const r = hoja.getRange(a1);
            const combinada = r.isPartOfMerge();
            let detalleCombinada = 'no combinada';
            if (combinada) {
                const rangos = r.getMergedRanges();
                const primero = rangos && rangos[0];
                const anclaA1 = primero ? primero.getCell(1, 1).getA1Notation() : '?';
                const rangoA1 = primero ? primero.getA1Notation() : '?';
                detalleCombinada = 'COMBINADA ' + rangoA1 + ' -- ancla ' + anclaA1 +
                    (anclaA1 === a1 ? ' (ESTA celda ES el ancla: escribir aca funciona)'
                                    : ' (ESTA celda NO es el ancla: es la mitad muda, escribir aca no hace nada)');
            }
            const formula = r.getFormula();
            const valor = r.getValue();
            l.push(a1 + ':');
            l.push('  ' + detalleCombinada);
            l.push('  formula: ' + (formula || '(sin formula)'));
            l.push('  valor  : ' + JSON.stringify(String(valor)));
            l.push('');
        });
        const t = l.join('\n');
        try { SpreadsheetApp.getUi().alert('DIAG: titulos Presupuesto', t, SpreadsheetApp.getUi().ButtonSet.OK); }
        catch (e) { Logger.log(t); }
        logInfo('_DIAG_medirTitulosPresupuesto: medido, ' + celdas.length + ' celdas.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        try { SpreadsheetApp.getUi().alert('DIAG: titulos Presupuesto - ERROR', msg, SpreadsheetApp.getUi().ButtonSet.OK); }
        catch (e2) { Logger.log(msg); }
        return { ok: false, error: msg };
    }
}
