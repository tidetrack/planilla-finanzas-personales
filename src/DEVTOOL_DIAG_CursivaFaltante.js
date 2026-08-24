/**
 * DEVTOOL_DIAG_CursivaFaltante.js
 * DIAGNOSTICO TEMPORAL -- mide de donde sale la cursiva que hoy se ve en la seccion de faltante
 * del bloque Ingresos del Tablero, y que NO se ve en Gastos Fijos ni Gastos Variables. SE BORRA
 * DESPUES DE MEDIR (este archivo entero, mas su entrada de MENU_CONFIG).
 *
 * [CONCEPTO DE NEGOCIO]
 * v0.42.0 desplego la negrita de la seccion real (DEVTOOL_TableroFaltanteProyectado.js, decision
 * #14) y quedo bien aplicada: la seccion real esta en negrita en la seccion correspondiente. Pero
 * Franco reporto que los tres bloques NO quedaron iguales: en Ingresos, tanto la fila separadora
 * ("Faltante proyectado") como las filas de faltante se ven en CURSIVA; en Gastos Fijos la fila
 * separadora se ve en cursiva pero las filas de faltante no, y ninguna de las dos en Gastos
 * Variables. Como los tres bloques los escribe el MISMO codigo en la MISMA corrida
 * (aplicarTableroFaltanteProyectado), esa diferencia no puede venir de las reglas de este modulo
 * tal cual estan hoy -- viene de otro lado: formato estatico que Franco puso a mano en Ingresos,
 * o una regla de formato condicional sobreviviente de una version anterior que la clasificacion
 * propia/ajena actual (_esReglaPropiaTfp) no reconoce como propia porque su formula o su rango ya
 * cambiaron entre versiones.
 *
 * REVISADO EN EL CODIGO ANTES DE ESCRIBIR ESTE DIAGNOSTICO (no descarta nada por las dudas, solo
 * ACOTA que hay que medir): `_construirReglaGrisTfp` NUNCA llamo `.setItalic(...)` en NINGUNA
 * version de DEVTOOL_TableroFaltanteProyectado.js (v0.36.0 a v0.42.0, revisadas las seis corridas
 * de ese archivo en el historial de git) -- solo `_construirReglaAvisoTfp` lo hace, y esa regla
 * vive en una sola celda fija (la fila 30, "y N cuenta(s) mas"), nunca en la fila separadora ni en
 * las filas de faltante. Osea: la cursiva de Ingresos casi seguro NO es una regla huerfana de
 * ESTE modulo. Pero podria ser (a) formato estatico que Franco escribio a mano, o (b) una regla
 * condicional de OTRO modulo que pisa ese rango por casualidad -- ninguna de las dos se puede
 * descartar sin medir la planilla real en vivo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Mismo patron que DEVTOOL_DIAG_Desplegables.js (2026-08-21, todavia sin retirar): diagnostico de
 * SOLO LECTURA, disparado desde una entrada de menu temporal, que vuelca el resultado a una hoja
 * nueva (una alerta de UI trunca texto largo, una hoja no) para poder copiarlo de vuelta a la
 * conversacion. No escribe NADA en las celdas que audita. Reusa geometria y helpers YA probados de
 * DEVTOOL_TableroFaltanteProyectado.js (TFP_ORDEN, TFP_BLOQUES, TFP_FILA_FIN, _esReglaPropiaTfp)
 * en vez de medir la geometria de nuevo por su cuenta -- mismo scope global de Apps Script, sin
 * import.
 * @see docs/permanente/ARNES_TIDETRACK.md
 * @see DEVTOOL_TableroFaltanteProyectado.js
 *
 * @version 0.1.0 (temporal, no se versiona el sistema por esto)
 * @since 2026-08-24
 * @lastModified 2026-08-24
 */

/** El hex RGB de un Color de Apps Script, o una descripcion legible si no es RGB (p.ej. THEME). */
function _diagCfHexColor(color) {
    if (!color) return '';
    try {
        return color.getColorType() === SpreadsheetApp.ColorType.RGB
            ? color.asRgbColor().asHexString()
            : '(' + String(color.getColorType()) + ')';
    } catch (e) {
        return '(error leyendo color: ' + e.message + ')';
    }
}

/**
 * Formato ESTATICO (el de la celda, no el que un formato condicional pinta encima) de colCuenta y
 * colMonto de un bloque, fila por fila, desde filaDatos hasta TFP_FILA_FIN inclusive (incluye la
 * fila 30 de aviso, para tener el mismo dato de referencia que ya se conoce: esa SI lleva cursiva
 * por regla propia, sirve de control). Una sola lectura de rango por bloque (4 propiedades x 3
 * bloques = 12 llamadas a la API en vez de 126 celda por celda).
 */
function _diagCfFormatoEstaticoBloque(hoja, b) {
    const colIniIdx = columnLetterToIndex(b.colCuenta);
    const colFinIdx = columnLetterToIndex(b.colMonto);
    const numFilas = TFP_FILA_FIN - b.filaDatos + 1;
    const numCols = colFinIdx - colIniIdx + 1;
    const rango = hoja.getRange(b.filaDatos, colIniIdx, numFilas, numCols);

    const valores = rango.getValues();
    const estilos = rango.getFontStyles();
    const pesos = rango.getFontWeights();
    const colores = rango.getFontColorObjects();

    const filas = [];
    for (let f = 0; f < numFilas; f++) {
        for (let c = 0; c < numCols; c++) {
            const filaAbs = b.filaDatos + f;
            const colLetra = columnIndexToLetter(colIniIdx + c);
            filas.push([
                b.titulo.esperado, colLetra + filaAbs, String(valores[f][c]),
                estilos[f][c], pesos[f][c], _diagCfHexColor(colores[f][c])
            ]);
        }
    }
    return filas;
}

/**
 * Todas las reglas de formato condicional VIVAS en la hoja Tablero (no solo las que este modulo
 * reconoce como suyas): rango, formula, bold/italic/color/strikethrough/underline de la condicion,
 * y la clasificacion que _esReglaPropiaTfp le da HOY. Una regla ajena que pise el rango de
 * Ingresos y no el de Fijos/Variables explicaria la cursiva sin tocar ninguna formula nueva.
 */
function _diagCfReglasVivas(hoja) {
    const reglas = hoja.getConditionalFormatRules();
    return reglas.map(function (r, idx) {
        const rangos = r.getRanges().map(function (rg) { return rg.getA1Notation(); }).join(' , ');
        const cond = r.getBooleanCondition();
        let esPropia = false;
        try { esPropia = _esReglaPropiaTfp(r); } catch (e) { esPropia = '(error: ' + e.message + ')'; }

        if (!cond) {
            return [idx, rangos, '(no es CUSTOM_FORMULA booleana -- probablemente gradiente)', '', '', '', '', '', '', esPropia];
        }
        const valores = cond.getCriteriaValues() || [];
        const formula = valores.length ? String(valores[0]) : '';
        return [
            idx, rangos, String(cond.getCriteriaType()), formula,
            String(cond.getBold()), String(cond.getItalic()), _diagCfHexColor(cond.getFontColorObject()),
            String(cond.getStrikethrough()), String(cond.getUnderline()),
            esPropia === true ? 'PROPIA de Tfp' : (esPropia === false ? 'ajena' : esPropia)
        ];
    });
}

/**
 * Solo lectura. Mide el formato estatico y las reglas de formato condicional vivas de los tres
 * bloques del Tablero, vuelca todo a una hoja nueva "DIAG_CursivaFaltante_TEMP" (la borra y la
 * recrea si ya existia) y deja un resumen en Logger.log. No toca ninguna otra celda del sistema.
 */
function _DIAG_medirCursivaFaltante() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const NOMBRE_HOJA_SALIDA = 'DIAG_CursivaFaltante_TEMP';

    const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
    if (!hoja) {
        const msg = 'No existe la hoja "' + NAV_CONFIG.SHEETS.TABLERO + '".';
        Logger.log(msg);
        try { SpreadsheetApp.getUi().alert('DIAG Cursiva Faltante - ERROR', msg, SpreadsheetApp.getUi().ButtonSet.OK); }
        catch (e) { /* sin UI */ }
        return { ok: false, error: msg };
    }

    let filasEstatico = [];
    TFP_ORDEN.forEach(function (clave) {
        filasEstatico = filasEstatico.concat(_diagCfFormatoEstaticoBloque(hoja, TFP_BLOQUES[clave]));
    });
    const filasReglas = _diagCfReglasVivas(hoja);

    const existente = ss.getSheetByName(NOMBRE_HOJA_SALIDA);
    if (existente) ss.deleteSheet(existente);
    const salida = ss.insertSheet(NOMBRE_HOJA_SALIDA);

    let filaCursor = 1;
    salida.getRange(filaCursor, 1).setValue(
        'FORMATO ESTATICO (colCuenta + colMonto, fila ' + TFP_BLOQUES.ingresos.filaDatos +
        ' a ' + TFP_FILA_FIN + ' -- incluye la fila de aviso como control, ya sabida en cursiva)');
    filaCursor++;
    const headersEstatico = ['Bloque', 'Celda', 'Valor', 'FontStyle (estatico)', 'FontWeight (estatico)', 'FontColor (estatico)'];
    salida.getRange(filaCursor, 1, 1, headersEstatico.length).setValues([headersEstatico]).setFontWeight('bold');
    filaCursor++;
    if (filasEstatico.length) {
        salida.getRange(filaCursor, 1, filasEstatico.length, headersEstatico.length).setValues(filasEstatico);
        filaCursor += filasEstatico.length;
    }
    filaCursor += 2;

    salida.getRange(filaCursor, 1).setValue(
        'REGLAS DE FORMATO CONDICIONAL VIVAS EN "' + NAV_CONFIG.SHEETS.TABLERO + '" (TODAS, no solo las que este modulo reconoce como propias)');
    filaCursor++;
    const headersReglas = ['Indice', 'Rango(s)', 'CriteriaType', 'Formula', 'Bold', 'Italic', 'FontColor', 'Strikethrough', 'Underline', 'Clasificacion (_esReglaPropiaTfp)'];
    salida.getRange(filaCursor, 1, 1, headersReglas.length).setValues([headersReglas]).setFontWeight('bold');
    filaCursor++;
    if (filasReglas.length) {
        salida.getRange(filaCursor, 1, filasReglas.length, headersReglas.length).setValues(filasReglas);
    }
    salida.autoResizeColumns(1, headersReglas.length);
    SpreadsheetApp.flush();

    const resumen = 'DIAG cursiva/faltante: ' + filasEstatico.length + ' celda(s) de formato estatico y ' +
        filasReglas.length + ' regla(s) de formato condicional volcadas en "' + NOMBRE_HOJA_SALIDA + '". ' +
        'Copiar esa hoja entera de vuelta a la conversacion.';
    Logger.log(resumen);
    filasReglas.forEach(function (f) { Logger.log(f.join(' | ')); });

    try { SpreadsheetApp.getUi().alert('DIAG Cursiva Faltante', resumen, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { /* sin UI (editor): ya quedo en Logger y en la hoja */ }

    return { ok: true, detalle: resumen, filasEstatico: filasEstatico, filasReglas: filasReglas };
}
