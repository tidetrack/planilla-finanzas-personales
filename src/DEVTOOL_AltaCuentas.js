/**
 * DEVTOOL_AltaCuentas.js
 * Da de alta en el Plan de Cuentas las cuentas que el ledger usa hace anios y el catalogo nunca
 * tuvo.
 *
 * [CONCEPTO DE NEGOCIO]
 * El Plan de Cuentas es el catalogo: define que existe. El ledger es el registro: dice que paso.
 * Cuando el ledger usa una cuenta que el catalogo no tiene, esa cuenta es invisible para el
 * sistema -- no aparece en el dropdown de Cargas, no se puede deducir su Tipo de Cuenta, y toda
 * formula que cruce contra el catalogo la deja afuera. Son 12 cuentas y 111 movimientos.
 *
 * El caso que lo hizo evidente: "Ajuste", con 70 movimientos y $1.949.641 netos. Es el mecanismo
 * de conciliacion de Franco -- cuando el saldo de la planilla no coincide con el del banco, se
 * carga la diferencia. Existe, se usa todos los meses, y el catalogo no lo conoce.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * decision Franco 2026-08-19: "No veo los ajustes en los medios bancarios. Agrega las cuentas en
 * el plan de cuentas porfa".
 *
 * NINGUNA CUENTA SE CLASIFICA POR ADIVINANZA. Once de las doce ya declaran su tipo en el ledger,
 * de forma unanime: las 12 filas de "Pago Tarjeta" dicen Gasto Fijo, las 10 de "umoh" dicen
 * Ingreso, y asi. El modulo LEE esa declaracion del ledger vivo y ubica cada cuenta en el bloque
 * que le corresponde. Si una cuenta trajera tipos contradictorios entre sus filas, NO se da de
 * alta: se reporta para que Franco decida.
 *
 * LA UNICA QUE SI ES UNA DECISION: "Ajuste" no tiene Tipo de Cuenta en ninguna de sus 70 filas,
 * porque no es ni un ingreso ni un gasto -- es una correccion de saldo. El Plan de Cuentas tiene
 * tres bloques y ninguno se llama "conciliacion", asi que hay que elegir. Va al bloque de
 * INGRESOS, y la razon es practica: el signo del movimiento ya lo lleva la columna Tipo
 * (Ingreso/Egreso), asi que el bloque solo decide en que dropdown aparece. Ubicarla en Ingresos
 * la deja disponible para cargar en los dos sentidos. Es reversible y esta declarado aca para
 * que se pueda discutir.
 *
 * QUE NO HACE
 * 1. NO toca una sola fila del ledger. Solo escribe en el catalogo.
 * 2. NO rellena la columna "Categoria" de las cuentas nuevas: hoy esta vacia en las 48 cuentas
 *    existentes, asi que rellenarla solo en las nuevas seria inventar una convencion que la
 *    planilla no tiene.
 * 3. NO da de alta MEDIOS. Los dos medios que faltan ("Galicia Fina - Fran", "Fracsos Nx - Dima")
 *    no son altas: son ERRORES DE TIPEO de medios que si existen, y se arreglan unificandolos en
 *    el ledger, no duplicandolos en el catalogo.
 *
 * @version 0.15.1
 * @since 2026-08-19
 * @lastModified 2026-08-24
 * @see docs/permanente/FUNCIONALIDADES.md
 */

const ALTA_PROP_RESPALDO = 'alta_cuentas_respaldo';
// decision Franco 2026-08-24: nombrado (antes literal inline) para que
// DEVTOOL_PurgaRespaldos.js pueda derivar el patron de respaldo de ESTE modulo en vez de
// reinventar el prefijo -- regla SSOT, la misma razon por la que RANGES centraliza columnas.
const ALTA_PREFIJO_RESPALDO = 'Respaldo Plan de Cuentas ';

/** Cuentas que no son cuentas: son mecanismos del sistema y nunca van al catalogo. */
const ALTA_NEUTRAS = ['Traspaso', 'Inicio Mes'];

/**
 * La unica cuenta que el ledger no puede clasificar sola, con su destino declarado.
 * @see la cabecera del modulo para el razonamiento
 */
const ALTA_SIN_TIPO = { 'Ajuste': 'Ingreso' };

/** Mapa: valor de "Tipo de Cuenta" del ledger -> clave del bloque en RANGES. */
const ALTA_BLOQUES = {
    'Ingreso': 'INGRESOS',
    'Gasto Fijo': 'GASTOS_FIJOS',
    'Gasto Variable': 'GASTOS_VARIABLES'
};

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: que cuentas daria de alta y en que bloque. */
function estadoAltaCuentas() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planAltaCuentas(ss);
        const l = ['ALTA DE CUENTAS - ESTADO (no se escribio nada)', ''];

        if (!plan.altas.length) {
            l.push('NADA QUE HACER: el Plan de Cuentas ya tiene todas las cuentas que el ledger usa.');
        } else {
            l.push('SE DARIAN DE ALTA ' + plan.altas.length + ' cuenta(s):');
            l.push('');
            Object.keys(ALTA_BLOQUES).forEach(function (tipo) {
                const delBloque = plan.altas.filter(function (a) { return a.tipo === tipo; });
                if (!delBloque.length) return;
                l.push('  ' + tipo.toUpperCase() + ':');
                delBloque.forEach(function (a) {
                    l.push('     ' + a.nombre + '  (' + a.filas + ' movimiento(s) en el ledger' +
                        (a.decidida ? ', SIN tipo propio: ubicada por decision' : '') + ')');
                });
            });
        }
        if (plan.conflictivas.length) {
            l.push('');
            l.push('NO se dan de alta, traen tipos contradictorios en el ledger:');
            plan.conflictivas.forEach(function (c) { l.push('  - ' + c); });
        }
        const t = l.join('\n');
        _mostrarAlta('Alta de cuentas - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarAlta('Alta de cuentas - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Da de alta las cuentas faltantes. Respaldo verificado del catalogo antes de escribir. */
function aplicarAltaCuentas() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarAltaCuentas necesita UI (menu tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planAltaCuentas(ss);
        if (!plan.altas.length) {
            const t = 'El Plan de Cuentas ya tiene todas las cuentas que el ledger usa. No se escribio nada.';
            _mostrarAlta('Alta de cuentas', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Alta de cuentas en el Plan',
            'Se van a agregar ' + plan.altas.length + ' cuenta(s) al Plan de Cuentas:\n\n' +
            plan.altas.map(function (a) { return '  ' + a.nombre + ' -> ' + a.tipo; }).join('\n') +
            '\n\nEl tipo de cada una sale de lo que YA declara el ledger, salvo "Ajuste", que no ' +
            'tiene tipo en ninguna de sus filas y se ubica en Ingresos por decision (el signo lo ' +
            'lleva la columna Tipo del movimiento).\n\nNo se toca ninguna fila del ledger.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        // --- Respaldo del catalogo ANTES de mutar, y verificado (cicatriz 4) ---
        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarCatalogo(ss, hojaPC, sello);

        // --- Escritura, bloque por bloque ---
        const escritas = [];
        Object.keys(ALTA_BLOQUES).forEach(function (tipo) {
            const delBloque = plan.altas.filter(function (a) { return a.tipo === tipo; });
            if (!delBloque.length) return;
            const cfg = RANGES[ALTA_BLOQUES[tipo]];
            const col = columnLetterToIndex(cfg.columns.nombre);
            let fila = _primeraFilaLibre(hojaPC, col, getDataRow(cfg));
            delBloque.forEach(function (a) {
                hojaPC.getRange(fila, col).setValue(a.nombre);
                escritas.push({ fila: fila, col: col, nombre: a.nombre });
                fila++;
            });
        });
        SpreadsheetApp.flush();

        // --- Relectura: sin esto "dado de alta" es una afirmacion sin evidencia ---
        const fallas = [];
        escritas.forEach(function (w) {
            const leido = String(hojaPC.getRange(w.fila, w.col).getValue() || '').trim();
            if (leido !== w.nombre) {
                fallas.push(columnIndexToLetter(w.col) + w.fila + ' dice "' + leido + '" y se escribio "' + w.nombre + '"');
            }
        });
        if (fallas.length) {
            escritas.forEach(function (w) {
                try { hojaPC.getRange(w.fila, w.col).clearContent(); } catch (e) { /* se reporta abajo */ }
            });
            SpreadsheetApp.flush();
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') +
                '. Se limpiaron las celdas escritas. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(ALTA_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'ALTA DE CUENTAS APLICADA\n\n' +
            '- Cuentas agregadas y verificadas: ' + escritas.length + '\n' +
            '- Respaldo del Plan de Cuentas en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- NO se toco ninguna fila del ledger\n\n' +
            plan.altas.map(function (a) { return '  ' + a.nombre + ' -> ' + a.tipo; }).join('\n') +
            '\n\nQUE MIRAR: la columna S del Plan de Cuentas (la consolidada que alimenta el\n' +
            'dropdown de Cargas) tiene que incluirlas. Es una QUERY: si no aparecen, avisar.';

        logSuccess('aplicarAltaCuentas: ' + escritas.length + ' cuenta(s).');
        _mostrarAlta('Alta de cuentas - aplicada', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarAlta('Alta de cuentas - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PLAN
// ============================================

function _planAltaCuentas(ss) {
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    if (!hojaPC) throw new Error('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '".');
    const cfgReg = RANGES.REGISTROS;
    const hojaReg = ss.getSheetByName(cfgReg.sheet);
    if (!hojaReg) throw new Error('No existe el ledger "' + cfgReg.sheet + '".');

    // Catalogo actual: todas las cuentas de los tres bloques, normalizadas.
    const enCatalogo = Object.create(null);
    Object.keys(ALTA_BLOQUES).forEach(function (tipo) {
        const cfg = RANGES[ALTA_BLOQUES[tipo]];
        const col = columnLetterToIndex(cfg.columns.nombre);
        const desde = getDataRow(cfg);
        const alto = hojaPC.getMaxRows() - desde + 1;
        if (alto <= 0) return;
        hojaPC.getRange(desde, col, alto, 1).getValues().forEach(function (f) {
            const v = String(f[0] || '').trim();
            if (v) enCatalogo[_normalizarRotulo(v)] = true;
        });
    });

    // Lo que el ledger usa, con el tipo que el propio ledger declara.
    const colIni = columnLetterToIndex(cfgReg.start);
    const nCols = columnLetterToIndex(cfgReg.end) - colIni + 1;
    const altoReg = hojaReg.getMaxRows() - cfgReg.dataRow + 1;
    const iCuenta = columnLetterToIndex(cfgReg.columns.cuenta) - colIni;
    const iTipoCta = columnLetterToIndex(cfgReg.columns.tipo_cuenta) - colIni;

    const vistas = Object.create(null);
    if (altoReg > 0) {
        hojaReg.getRange(cfgReg.dataRow, colIni, altoReg, nCols).getValues().forEach(function (f) {
            const cuenta = String(f[iCuenta] || '').trim();
            if (!cuenta) return;
            if (ALTA_NEUTRAS.indexOf(cuenta) !== -1) return;
            if (enCatalogo[_normalizarRotulo(cuenta)]) return;
            const tipo = String(f[iTipoCta] || '').trim();
            if (!vistas[cuenta]) vistas[cuenta] = { nombre: cuenta, filas: 0, tipos: Object.create(null) };
            vistas[cuenta].filas++;
            if (tipo) vistas[cuenta].tipos[tipo] = (vistas[cuenta].tipos[tipo] || 0) + 1;
        });
    }

    const altas = [];
    const conflictivas = [];
    Object.keys(vistas).forEach(function (nombre) {
        const v = vistas[nombre];
        const tipos = Object.keys(v.tipos);
        if (tipos.length === 1 && ALTA_BLOQUES[tipos[0]]) {
            altas.push({ nombre: nombre, tipo: tipos[0], filas: v.filas, decidida: false });
        } else if (tipos.length === 0 && ALTA_SIN_TIPO[nombre]) {
            altas.push({ nombre: nombre, tipo: ALTA_SIN_TIPO[nombre], filas: v.filas, decidida: true });
        } else if (tipos.length === 0) {
            conflictivas.push(nombre + ': ' + v.filas + ' fila(s), ninguna declara Tipo de Cuenta, y no hay decision tomada para ella');
        } else {
            conflictivas.push(nombre + ': ' + v.filas + ' fila(s) con tipos distintos (' +
                tipos.map(function (t) { return t + ' x' + v.tipos[t]; }).join(', ') + ')');
        }
    });
    altas.sort(function (a, b) { return b.filas - a.filas; });
    return { altas: altas, conflictivas: conflictivas };
}

/** Primera fila sin dato en una columna, desde `desde`. */
function _primeraFilaLibre(hoja, col, desde) {
    const alto = hoja.getMaxRows() - desde + 1;
    if (alto <= 0) return desde;
    const vals = hoja.getRange(desde, col, alto, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0] || '').trim() === '') return desde + i;
    }
    return desde + vals.length;
}

/** Congela el Plan de Cuentas entero a VALORES en una hoja oculta, y lo relee para verificarlo. */
function _respaldarCatalogo(ss, hojaPC, sello) {
    const nombre = _nombreHojaLibreFormulerio(ss, ALTA_PREFIJO_RESPALDO + sello);
    const filas = hojaPC.getLastRow();
    const cols = hojaPC.getLastColumn();
    const destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();
    if (destino.getMaxRows() < filas) destino.insertRowsAfter(destino.getMaxRows(), filas - destino.getMaxRows());
    if (destino.getMaxColumns() < cols) destino.insertColumnsAfter(destino.getMaxColumns(), cols - destino.getMaxColumns());
    hojaPC.getRange(1, 1, filas, cols).copyTo(destino.getRange(1, 1, filas, cols),
        SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);
    SpreadsheetApp.flush();

    const vivo = hojaPC.getRange(1, 1, filas, cols).getDisplayValues();
    const copia = destino.getRange(1, 1, filas, cols).getDisplayValues();
    let dif = 0;
    for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) if (vivo[r][c] !== copia[r][c]) dif++;
    if (dif > 0) {
        throw new Error('El respaldo quedo en "' + nombre + '" pero NO VERIFICA: ' + dif +
            ' celda(s) no coinciden con el Plan de Cuentas vivo. No se dio de alta nada.');
    }
    destino.hideSheet();
    logInfo('_respaldarCatalogo: Plan de Cuentas congelado en "' + nombre + '".');
    return { nombre: nombre, celdas: filas * cols };
}

function _mostrarAlta(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
