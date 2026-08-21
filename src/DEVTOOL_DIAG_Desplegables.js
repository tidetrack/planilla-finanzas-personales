/**
 * DEVTOOL_DIAG_Desplegables.js
 * DIAGNOSTICO TEMPORAL -- mide las validaciones de datos (desplegables) de "Plan de Cuentas" y
 * "Cargas". SE BORRA DESPUES DE MEDIR (este archivo entero, mas su entrada de MENU_CONFIG).
 *
 * [CONCEPTO DE NEGOCIO]
 * Franco pidio auditar todos los desplegables de Plan de Cuentas y Cargas para que una
 * categoria/cuenta/medio nuevo entre solo, sin editar formulas. Antes de tocar nada hay que
 * saber que existe: el gemelo digital (celdas.tsv) trae formula y valor pero NO validaciones de
 * datos -- limitacion conocida del scanner --, asi que esto se mide en vivo con
 * getDataValidations().
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Mismo patron que el diagnostico _DIAG_medirPatronYAuxIp de DEVTOOL_InicioPresupuesto.js
 * (2026-08-21, ya retirado): crear, correr desde una entrada de menu temporal, medir, borrar el
 * diagnostico y dejar la medicion literal en un comentario del modulo que haga el arreglo real.
 * Esta corrida no escribe NADA en la planilla -- solo lee y vuelca el resultado a una hoja nueva
 * para poder copiarlo de vuelta a la conversacion (una alerta de UI trunca textos largos; una
 * hoja no).
 * @see docs/permanente/ARNES_TIDETRACK.md
 *
 * @version 0.1.0 (temporal, no se versiona el sistema por esto)
 * @since 2026-08-21
 * @lastModified 2026-08-21
 */

// ============================================
// GEOMETRIA DEL ESCANEO (generosa a proposito: mejor de mas que perderse un desplegable)
// ============================================

const DIAG_DV_HOJAS = [
    // Plan de Cuentas: los cinco bloques van de C a T (C:D/F:G/I:J/L:N/P:Q) mas la
    // consolidacion R/S/T. Se escanea con margen: A:V, filas 1 a 1005 (la consolidacion R8
    // llega hasta la fila 1000; 1005 deja 5 filas de colchon para ver si algo sigue mas alla).
    { hoja: SHEETS.PLAN_CUENTAS, colIni: 'A', colFin: 'V', filaIni: 1, filaFin: 1005 },
    // Cargas: grilla fija C7:I21 (RANGES.CARGAS). Se escanea B:K, filas 1 a 30: margen arriba
    // para el header (fila 6) y abajo por si algun desplegable se extiende mas alla de la fila 21.
    { hoja: SHEETS.DATA_ENTRY, colIni: 'B', colFin: 'K', filaIni: 1, filaFin: 30 }
];

// ============================================
// LECTURA Y FORMATEO DE UNA VALIDACION
// ============================================

/** Describe los argumentos de una validacion. Un Range se resuelve a 'Hoja'!A1notacion. */
function _diagDescribirArgsDV(args) {
    if (!args || !args.length) return '(sin argumentos)';
    return args.map(function (a) {
        if (a && typeof a.getA1Notation === 'function') {
            try { return "'" + a.getSheet().getName() + "'!" + a.getA1Notation(); }
            catch (e) { return '(rango ilegible: ' + e.message + ')'; }
        }
        if (Array.isArray(a)) return 'LISTA[' + a.join(' | ') + ']';
        return String(a);
    }).join('  ;  ');
}

/** Firma completa de una DataValidation: dos celdas con la misma firma se agrupan en un rango. */
function _diagFirmaDV(dv) {
    if (!dv) return null;
    const criterio = String(dv.getCriteriaType());
    const fuente = _diagDescribirArgsDV(dv.getCriteriaValues());
    const permiteInvalido = dv.getAllowInvalid();
    const ayuda = dv.getHelpText() || '';
    return {
        criterio: criterio, fuente: fuente, permiteInvalido: permiteInvalido, ayuda: ayuda,
        // SEPARADOR COMO SECUENCIA DE ESCAPE, no como byte crudo. La idea de usar un caracter
        // que no puede aparecer en los datos esta bien; escribirlo LITERAL en el fuente no:
        // es invisible al leer, viaja por clasp hasta la planilla y el banco del repo lo
        // prohibe desde que un NUL inyectado por un editor casi se despliega (2026-08-20).
        key: criterio + '\u0001' + fuente + '\u0001' + permiteInvalido + '\u0001' + ayuda
    };
}

// ============================================
// ESCANEO POR COLUMNA (agrupa filas contiguas con la MISMA validacion en un solo rango)
// ============================================

function _diagEscanearHoja(ss, spec) {
    const hoja = ss.getSheetByName(spec.hoja);
    if (!hoja) return [{ hoja: spec.hoja, rango: '(HOJA NO ENCONTRADA)', criterio: '', fuente: '', permiteInvalido: '', ayuda: '', tocaElBorde: false }];

    const colIniIdx = columnLetterToIndex(spec.colIni);
    const colFinIdx = columnLetterToIndex(spec.colFin);
    const numFilas = spec.filaFin - spec.filaIni + 1;
    const numCols = colFinIdx - colIniIdx + 1;
    const matriz = hoja.getRange(spec.filaIni, colIniIdx, numFilas, numCols).getDataValidations();

    const filas = [];
    for (let c = 0; c < numCols; c++) {
        let corrida = null; // { inicioFila (0-based dentro del escaneo), firma }
        for (let f = 0; f <= numFilas; f++) {
            const dv = f < numFilas ? matriz[f][c] : null;
            const firma = dv ? _diagFirmaDV(dv) : null;
            const sigueLaCorrida = corrida && firma && firma.key === corrida.firma.key;

            if (corrida && !sigueLaCorrida) {
                const filaInicioAbs = spec.filaIni + corrida.inicioFila;
                const filaFinAbs = spec.filaIni + f - 1;
                const letra = columnIndexToLetter(colIniIdx + c);
                const rango = letra + filaInicioAbs + (filaFinAbs > filaInicioAbs ? ':' + letra + filaFinAbs : '');
                filas.push({
                    hoja: spec.hoja, rango: rango,
                    criterio: corrida.firma.criterio, fuente: corrida.firma.fuente,
                    permiteInvalido: corrida.firma.permiteInvalido, ayuda: corrida.firma.ayuda,
                    tocaElBorde: filaFinAbs === spec.filaFin
                });
                corrida = null;
            }
            if (firma && !corrida) corrida = { inicioFila: f, firma: firma };
        }
    }
    return filas;
}

// ============================================
// PUBLICA (TEMPORAL) -- correrla desde el menu, no desde el editor
// ============================================

/**
 * Solo lectura. Escanea Plan de Cuentas y Cargas, vuelca el resultado a una hoja nueva
 * "DIAG_Desplegables_TEMP" (la borra y la recrea si ya existia) y deja un resumen en Logger.log.
 * No toca ninguna otra celda del sistema.
 */
function _DIAG_medirDesplegables() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const NOMBRE_HOJA_SALIDA = 'DIAG_Desplegables_TEMP';

    let todas = [];
    DIAG_DV_HOJAS.forEach(function (spec) {
        todas = todas.concat(_diagEscanearHoja(ss, spec));
    });

    // --- Volcado a hoja nueva, para poder copiar/pegar el resultado completo sin truncar ---
    const existente = ss.getSheetByName(NOMBRE_HOJA_SALIDA);
    if (existente) ss.deleteSheet(existente);
    const salida = ss.insertSheet(NOMBRE_HOJA_SALIDA);

    const headers = ['Hoja', 'Rango', 'Criterio', 'Fuente exacta', 'Permite invalido', 'Texto de ayuda', 'Toca el borde escaneado'];
    salida.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (todas.length) {
        const filasSalida = todas.map(function (r) {
            return [r.hoja, r.rango, r.criterio, r.fuente, String(r.permiteInvalido), r.ayuda, r.tocaElBorde ? 'SI -- ampliar el escaneo' : ''];
        });
        salida.getRange(2, 1, filasSalida.length, headers.length).setValues(filasSalida);
    }
    salida.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    salida.autoResizeColumns(1, headers.length);
    SpreadsheetApp.flush();

    // --- Resumen corto por consola/alerta ---
    const resumen = 'DIAG desplegables: ' + todas.length + ' rango(s) con validacion encontrados ' +
        '(' + DIAG_DV_HOJAS.map(function (s) { return s.hoja; }).join(', ') + '). ' +
        'Volcado completo en la hoja "' + NOMBRE_HOJA_SALIDA + '". Copiar esa hoja entera de vuelta.';
    Logger.log(resumen);
    todas.forEach(function (r) {
        Logger.log(r.hoja + '!' + r.rango + ' | ' + r.criterio + ' | fuente=' + r.fuente + ' | permiteInvalido=' + r.permiteInvalido + ' | tocaBorde=' + r.tocaElBorde);
    });

    try {
        SpreadsheetApp.getUi().alert('DIAG Desplegables', resumen, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) { /* sin UI (editor): ya quedo en Logger y en la hoja */ }

    return { ok: true, detalle: resumen, filas: todas };
}
