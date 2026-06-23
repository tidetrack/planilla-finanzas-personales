/**
 * 07_MiradaInteranual.js
 * Inicializa las fórmulas del módulo Mirada Interanual (G10:R14).
 * Invocable desde el menú Tidetrack → [Dev] → "Inicializar Mirada Interanual".
 *
 * @version 0.1.0
 * @since 0.8.2
 * @lastModified 2026-06-22
 */

/**
 * Escribe las fórmulas de Mirada Interanual en el rango G10:R14.
 *
 * Layout objetivo:
 *   G10:R10 — Ingresos por mes
 *   G11:R11 — Gastos Fijos por mes
 *   G12:R12 — Gastos Variables por mes
 *   G14:R14 — Resultado (G10 - G11 - G12)
 *
 * Selectores consumidos:
 *   E4 = mes de referencia (texto uppercase en español)
 *   F4 = año de referencia (numérico)
 *   R4 = moneda de visualización (ARS | USD | AUD | EUR)
 *
 * La columna K siempre corresponde al mes de referencia (offset=0).
 * G=mes-4, H=mes-3, I=mes-2, J=mes-1, K=mes ref, L=+1 ... R=+7.
 *
 * Fuente de datos: hoja "Registros", filas 3:5000.
 * Los encabezados de Registros viven en la fila 2 y los datos arrancan en la
 * fila 3 (auditado sobre la planilla real: I2='Monto', O2='Fecha', I3=primer dato).
 * Por eso los rangos arrancan en fila 3 y no en DATA_START_ROW=4 (00_Config.js).
 * Columnas relevantes: I=monto, L=tipo_cuenta, N=moneda, O=fecha, R=tc_usd, S=tc_aud, T=tc_eur.
 *
 * Nota: setFormula() interpreta el string en locale en-US (nombres de función y
 * separadores en inglés); Google Sheets lo traduce al locale del spreadsheet al mostrarlo.
 *
 * @since 0.8.2
 */
function inicializarMiradaInteranual() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Mirada Interanual');

    if (!sheet) {
        SpreadsheetApp.getUi().alert('Hoja "Mirada Interanual" no encontrada.');
        logError('inicializarMiradaInteranual: hoja "Mirada Interanual" no encontrada');
        return;
    }

    // Fórmula base para G10:R12.
    // $C10 tiene columna fija y fila relativa: al copiar a G11/G12 cambia a $C11/$C12.
    // COLUMN()-COLUMN($K$10) calcula el offset en meses respecto al mes de referencia.
    // tipo_bd (IF anidado) mapea labels de display ("Ingresos") a valores en BD ("Ingreso").
    // Conversión multi-moneda: tc_tx / tc_sel (ambas referenciadas a ARS=1; monto*TC = ARS).
    const formulaBase = '=LET('
        + 'mes_num,MATCH($E$4,{"ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"},0),'
        + 'offset,COLUMN()-COLUMN($K$10),'
        + 'f_obj,EDATE(DATE($F$4,mes_num,1),offset),'
        + 'm_obj,MONTH(f_obj),'
        + 'a_obj,YEAR(f_obj),'
        + 'tipo_bd,IF($C10="Ingresos","Ingreso",IF($C10="Gastos Fijos","Gasto Fijo","Gasto Variable")),'
        + 'fechas,Registros!$O$3:$O$5000,'
        + 'montos,Registros!$I$3:$I$5000,'
        + 'tipos,Registros!$L$3:$L$5000,'
        + 'mon_tx,Registros!$N$3:$N$5000,'
        + 'tc_u,Registros!$R$3:$R$5000,'
        + 'tc_a,Registros!$S$3:$S$5000,'
        + 'tc_e,Registros!$T$3:$T$5000,'
        + 'tc_sel,IF($R$4="ARS",1,IF($R$4="USD",tc_u,IF($R$4="AUD",tc_a,tc_e))),'
        + 'tc_tx,IF(mon_tx="ARS",1,IF(mon_tx="USD",tc_u,IF(mon_tx="AUD",tc_a,tc_e))),'
        + 'conv,IF(tc_sel=0,0,tc_tx/tc_sel),'
        + 'SUMPRODUCT((tipos=tipo_bd)*(MONTH(fechas)=m_obj)*(YEAR(fechas)=a_obj)*(fechas<>"")*montos*conv))';

    // Escribir G10 y replicar al bloque G10:R12.
    // copyTo ajusta las referencias relativas por celda (COLUMN(), $C10 -> $C11/$C12)
    // y deja fijas las absolutas ($K$10, $E$4, $F$4, $R$4).
    const g10 = sheet.getRange('G10');
    g10.setFormula(formulaBase);
    g10.copyTo(sheet.getRange('G10:R12'));

    // Fila 14: Resultado = Ingresos - Gastos Fijos - Gastos Variables
    const cols = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'];
    cols.forEach(col => {
        sheet.getRange(`${col}14`).setFormula(`=${col}10-${col}11-${col}12`);
    });

    // Normalizar el formato numérico de las celdas de salida.
    // G10 venía en "Texto sin formato" y copyTo propaga ese formato al bloque;
    // se fuerza un formato numérico para que los resultados se muestren como números.
    sheet.getRange('G10:R12').setNumberFormat('#,##0.00');
    sheet.getRange('G14:R14').setNumberFormat('#,##0.00');

    ss.toast('Mirada Interanual inicializada correctamente.', 'Listo', 4);
    logSuccess('inicializarMiradaInteranual: G10:R12 y G14:R14 configuradas.');
}
