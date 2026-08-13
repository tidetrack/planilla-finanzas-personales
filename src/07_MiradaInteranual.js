/**
 * 07_MiradaInteranual.js
 * Inicializa y diagnostica las fórmulas del módulo Mirada Interanual (G10:R14).
 * Invocable desde el menú Tidetrack → [Dev].
 *
 * @version 0.3.0
 * @since 0.8.2
 * @lastModified 2026-08-12
 */

/**
 * Construye el string de la fórmula LET/SUMPRODUCT en sintaxis en-US (comas),
 * que setFormula() traduce al locale del spreadsheet al escribirla.
 *
 * IMPORTANTE (locale): la planilla está en español (separador ";", arrays con "\").
 * Por eso NO se usa un array literal {"ENERO",...} (que setFormula no traduce y rompe
 * con "Error de análisis de fórmula"); en su lugar se usa SPLIT de un string, igual
 * que las fórmulas del Tablero (ej: SPLIT("Enero,Febrero,...";",")).
 *
 * @param {string} c10Expr   Referencia/literal del label de tipo (ej: '$C10' o '"Ingresos"').
 * @param {string} offsetExpr Expresión del offset mensual (ej: 'COLUMN()-COLUMN($K$10)' o '0').
 * @param {string} selPrefix  Prefijo de hoja para los selectores (ej: '' o "'Mirada Interanual'!").
 * @returns {string} Fórmula completa lista para setFormula().
 */
function construirFormulaMirada(c10Expr, offsetExpr, selPrefix) {
    const E = selPrefix + '$E$4';
    const F = selPrefix + '$F$4';
    const R = selPrefix + '$R$4';
    return '=LET('
        + 'mes_num,MATCH(' + E + ',SPLIT("ENERO,FEBRERO,MARZO,ABRIL,MAYO,JUNIO,JULIO,AGOSTO,SEPTIEMBRE,OCTUBRE,NOVIEMBRE,DICIEMBRE",","),0),'
        + 'offset,' + offsetExpr + ','
        + 'f_obj,EDATE(DATE(' + F + ',mes_num,1),offset),'
        + 'm_obj,MONTH(f_obj),'
        + 'a_obj,YEAR(f_obj),'
        + 'tipo_bd,IF(' + c10Expr + '="Ingresos","Ingreso",IF(' + c10Expr + '="Gastos Fijos","Gasto Fijo","Gasto Variable")),'
        + 'fechas,Registros!$O$3:$O$5000,'
        + 'montos,Registros!$I$3:$I$5000,'
        + 'tipos,Registros!$L$3:$L$5000,'
        + 'mon_tx,Registros!$N$3:$N$5000,'
        + 'tc_u,Registros!$R$3:$R$5000,'
        + 'tc_a,Registros!$S$3:$S$5000,'
        + 'tc_e,Registros!$T$3:$T$5000,'
        + 'tc_sel,IF(' + R + '="ARS",1,IF(' + R + '="USD",tc_u,IF(' + R + '="AUD",tc_a,tc_e))),'
        + 'tc_tx,IF(mon_tx="ARS",1,IF(mon_tx="USD",tc_u,IF(mon_tx="AUD",tc_a,tc_e))),'
        + 'conv,IF(tc_sel=0,0,tc_tx/tc_sel),'
        + 'SUMPRODUCT((tipos=tipo_bd)*(MONTH(fechas)=m_obj)*(YEAR(fechas)=a_obj)*(fechas<>"")*montos*conv))';
}

/**
 * Escribe las fórmulas de Mirada Interanual en el rango G10:R14.
 *
 * Layout objetivo:
 *   G10:R10 — Ingresos por mes      G11:R11 — Gastos Fijos      G12:R12 — Gastos Variables
 *   G14:R14 — Resultado (G10 - G11 - G12)
 *
 * Selectores: E4 = mes (uppercase español), F4 = año, R4 = moneda (ARS|USD|AUD|EUR).
 * K = mes de referencia (offset 0). G=mes-4 ... R=mes+7.
 *
 * Fuente: hoja "Registros", filas 3:5000 (header real en fila 2, datos desde fila 3).
 *
 * @since 0.8.2
 */
function inicializarMiradaInteranual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.MIRADA_INTERANUAL);

    if (!sheet) {
        SpreadsheetApp.getUi().alert('Hoja "Mirada Interanual" no encontrada.');
        logError('inicializarMiradaInteranual: hoja "Mirada Interanual" no encontrada');
        return;
    }

    // $C10: columna fija, fila relativa (al copiar a G11/G12 -> $C11/$C12).
    // COLUMN()-COLUMN($K$10): offset en meses respecto al mes de referencia.
    const formulaBase = construirFormulaMirada('$C10', 'COLUMN()-COLUMN($K$10)', '');

    // Escribir G10 y replicar al bloque G10:R12 (las referencias relativas se ajustan por celda).
    const g10 = sheet.getRange('G10');
    g10.setFormula(formulaBase);
    g10.copyTo(sheet.getRange('G10:R12'));

    // Fila 14: Resultado = Ingresos - Gastos Fijos - Gastos Variables
    const cols = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
    cols.forEach(col => {
        sheet.getRange(`${col}14`).setFormula(`=${col}10-${col}11-${col}12`);
    });

    // Normalizar formato numérico (G10 venía en "Texto sin formato"; copyTo lo propaga).
    sheet.getRange('G10:R12').setNumberFormat('#,##0.00');
    sheet.getRange('G14:R14').setNumberFormat('#,##0.00');

    ss.toast('Mirada Interanual inicializada correctamente.', 'Listo', 4);
    logSuccess('inicializarMiradaInteranual: G10:R12 y G14:R14 configuradas.');
}

/**
 * Diagnóstico: escribe en la hoja "DEBUG Mirada" el estado de las fórmulas y una
 * batería de micro-tests para aislar exactamente qué construcción falla (separadores,
 * array literal, SPLIT, lectura de Registros, fórmula completa).
 *
 * Pensado para sacar una captura de esa hoja y compartirla. No toca datos reales.
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
        .setValues([['Test', 'Fórmula / dato', 'Resultado (en vivo)']])
        .setFontWeight('bold');

    let fila = 2;

    // Helper: escribe descripción + fórmula como texto + la fórmula evaluada en vivo.
    const correr = (desc, formula, esperado) => {
        dbg.getRange(fila, 1).setValue(esperado ? `${desc}  [esperado: ${esperado}]` : desc);
        dbg.getRange(fila, 2).setValue(formula.replace(/^=/, '')); // texto, sin "=" para que no evalúe
        try {
            dbg.getRange(fila, 3).setFormula(formula);
        } catch (e) {
            dbg.getRange(fila, 3).setValue('EXCEPCION setFormula: ' + e.message);
        }
        fila++;
    };

    // 0. Estado actual de la celda que falla y de los selectores.
    if (mi) {
        dbg.getRange(fila, 1).setValue('G10 actual: fórmula almacenada');
        dbg.getRange(fila, 2).setValue(mi.getRange('G10').getFormula() || '(vacía)');
        dbg.getRange(fila, 3).setValue(mi.getRange('G10').getDisplayValue());
        fila++;
        dbg.getRange(fila, 1).setValue('Selectores E4 / F4 / R4');
        dbg.getRange(fila, 2).setValue(
            'mes=' + mi.getRange('E4').getDisplayValue() +
            ' | año=' + mi.getRange('F4').getDisplayValue() +
            ' | moneda=' + mi.getRange('R4').getDisplayValue());
        fila++;
    } else {
        dbg.getRange(fila, 1).setValue('AVISO: no se encontró la hoja "Mirada Interanual"');
        fila++;
    }

    // 1. Separador básico (comas que setFormula debe traducir a ";").
    correr('Separador básico: SUM(1,2)', '=SUM(1,2)', '3');
    // 2. Array literal {} -> esto es lo que ROMPÍA en tu locale (debería dar #ERROR!).
    correr('Array literal {} (lo viejo, roto)', '=MATCH("MAYO",{"ENERO","MAYO"},0)', '#ERROR! esperado');
    // 3. SPLIT -> el reemplazo robusto (debería dar 5).
    correr('SPLIT (lo nuevo): MATCH sobre SPLIT', '=MATCH("MAYO",SPLIT("ENERO,FEBRERO,MARZO,ABRIL,MAYO",","),0)', '5');
    // 4. Lectura de Registros desde fila 3 (cuenta de Ingresos).
    correr('Leer Registros: contar "Ingreso"', '=SUMPRODUCT((Registros!$L$3:$L$5000="Ingreso")*1)', 'un número');
    // 5. Fórmula COMPLETA para el mes de referencia (offset 0), tipo Ingresos.
    correr('Fórmula COMPLETA (mes ref, Ingresos)',
        construirFormulaMirada('"Ingresos"', '0', "'Mirada Interanual'!"), 'un número (ingresos del mes)');

    SpreadsheetApp.flush();
    dbg.autoResizeColumns(1, 3);
    dbg.setActiveSelection('A1');
    dbg.activate();
    ss.toast('Diagnóstico listo en la hoja "DEBUG Mirada". Sacá una captura y compartímela.', 'Diagnóstico', 6);
    logSuccess('diagnosticarMiradaInteranual: reporte escrito en "DEBUG Mirada".');
}
