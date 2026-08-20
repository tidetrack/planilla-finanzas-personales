/**
 * DEVTOOL_ConciliarSaldos.js
 * Concilia el saldo de cada medio de pago contra los saldos reales que declaro Franco, cargando
 * un movimiento de cuenta "Ajuste" por la diferencia.
 *
 * [CONCEPTO DE NEGOCIO]
 * Cuando la planilla dice que una cuenta tiene $50.607 y el banco dice que tiene $0, la planilla
 * no esta mal calculada: le FALTAN MOVIMIENTOS. La plata salio y nadie la anoto. El mecanismo que
 * Franco ya usa para eso es la cuenta "Ajuste" -- 70 movimientos historicos en el ledger --, y
 * este modulo lo automatiza: mide el saldo, lo compara contra el declarado, y carga la diferencia.
 *
 * No es un parche cosmetico. Un ajuste de conciliacion es un asiento legitimo: dice "a esta fecha
 * mis registros diferian de la realidad en tanto". Queda en el ledger, con su fecha, visible y
 * auditable. Lo que NO seria legitimo es tocar la formula para que devuelva el numero deseado.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * decision Franco 2026-08-19, declarada dos veces: los saldos actuales son los de
 * CONC_OBJETIVOS y "el resto son 0".
 *
 * ADVERTENCIA QUE HAY QUE TENER PRESENTE. El ledger termina el 2026-08-12 y los saldos son al 19.
 * Parte de la diferencia de NaranjaX ($29.635,41) y Efectivo ($102.000,00) son movimientos reales
 * de esos siete dias que todavia no se cargaron. Al conciliar hoy, esos gastos quedan registrados
 * como un "Ajuste" sin detalle en vez de como los movimientos que fueron. Es una decision con
 * costo: se gana un saldo correcto hoy y se pierde el detalle de esa semana.
 * SI DESPUES SE CARGAN ESOS SIETE DIAS, el saldo va a quedar mal por el monto del ajuste y habra
 * que borrar estas filas (o cargar otro ajuste en sentido contrario). No se pueden hacer las dos
 * cosas.
 *
 * COMO SE MIDE EL SALDO: igual que las formulas del Tablero -- ultimo asiento "Inicio Mes" del
 * medio + todos los movimientos posteriores. @see DEVTOOL_StockYFlujo.js
 *
 * QUE NO HACE
 * 1. NO inventa cotizaciones. Si no hay TC para la fecha del ajuste, usa la mas reciente
 *    disponible y lo DECLARA en el informe (Regla Estricta 9: nunca silenciar un fallback de FX).
 * 2. NO borra ni edita filas existentes. Solo agrega movimientos nuevos al final del ledger.
 * 3. NO toca medios que no esten en el Plan de Cuentas.
 *
 * @version 0.17.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 */

const CONC_PROP_RESPALDO = 'conciliar_saldos_respaldo';
const CONC_CUENTA_AJUSTE = 'Ajuste';

/**
 * Saldos reales declarados por Franco el 2026-08-19, con los nombres del PLAN DE CUENTAS.
 * Franco los escribio con su propia nomenclatura; la equivalencia esta al lado.
 */
const CONC_OBJETIVOS = {
    'NaranjaX': 17433.79,
    'Efectivo': 24500.00,
    'YPF': 3494.90,                          // Franco lo llama "YPF - wallet"
    'Frasco Transitorio NaranjaX': 44141.01, // Franco lo llama "Frasco transitorio Nx"
    'Frascos Nx - Préstamo': 230000.00,
    'Dolar Cash': 110.00,
    'Dolar Galicia': 91.10
};

/** "El resto son 0": todo medio del Plan que no este en CONC_OBJETIVOS tiene saldo cero. */
const CONC_RESTO_EN_CERO = true;

/** Diferencias por debajo de esto no generan ajuste. */
const CONC_TOLERANCIA = 0.005;

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: que ajustes cargaria. @returns {{ok:boolean, detalle?:string, error?:string}} */
function estadoConciliarSaldos() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planConciliar(ss);
        const l = ['CONCILIACION DE SALDOS - ESTADO (no se escribio nada)', ''];
        l.push('Saldo medido = ultimo "Inicio Mes" del medio + todo lo posterior.');
        l.push('');
        if (!plan.ajustes.length) {
            l.push('NADA QUE HACER: los ' + plan.medidos + ' medios del Plan ya coinciden con los');
            l.push('saldos declarados.');
        } else {
            l.push('SE CARGARIAN ' + plan.ajustes.length + ' movimiento(s) de cuenta "' + CONC_CUENTA_AJUSTE + '":');
            l.push('');
            l.push('  MEDIO                          MONEDA      SALDO HOY       OBJETIVO        AJUSTE');
            plan.ajustes.forEach(function (a) {
                l.push('  ' + _padConc(a.medio, 30) + ' ' + _padConc(a.moneda, 6) + ' ' +
                    _padIzqConc(_montoConc(a.saldo), 14) + ' ' + _padIzqConc(_montoConc(a.objetivo), 14) +
                    ' ' + _padIzqConc(_montoConc(a.delta), 13));
            });
            l.push('');
            l.push('Fecha de los ajustes: ' + plan.fechaTexto);
            l.push('Cotizaciones: ' + plan.tcOrigen);
        }
        if (plan.avisos.length) {
            l.push('');
            l.push('Avisos:');
            plan.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarConc('Conciliacion de saldos - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarConc('Conciliacion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Carga los ajustes. Respaldo del ledger verificado antes de escribir. */
function aplicarConciliarSaldos() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarConciliarSaldos necesita UI (menu Tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planConciliar(ss);
        if (!plan.ajustes.length) {
            const t = 'Los saldos ya coinciden con los declarados. No se cargo nada.';
            _mostrarConc('Conciliacion de saldos', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Conciliar saldos contra los declarados',
            'Se van a CARGAR ' + plan.ajustes.length + ' movimiento(s) nuevos en "' +
            RANGES.REGISTROS.sheet + '", de cuenta "' + CONC_CUENTA_AJUSTE + '" y fecha ' +
            plan.fechaTexto + ':\n\n' +
            plan.ajustes.map(function (a) {
                return '  ' + a.medio + ': ' + _montoConc(a.saldo) + ' -> ' + _montoConc(a.objetivo) +
                    '  (' + _montoConc(a.delta) + ')';
            }).join('\n') +
            '\n\nOJO: el ledger termina el ' + plan.ultimaFechaLedger + '. Si despues cargas los ' +
            'movimientos que faltan de esos dias, el saldo va a quedar mal por el monto del ajuste ' +
            'y habra que borrar estas filas. No se pueden hacer las dos cosas.\n\n' +
            'No se edita ni se borra ninguna fila existente.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se cargo nada.' };

        const hojaReg = ss.getSheetByName(RANGES.REGISTROS.sheet);
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = respaldarRegistrosV031_(ss, hojaReg, sello);

        const filasAntes = _ultimaFilaConDatoConc(hojaReg);
        const cfg = RANGES.REGISTROS;
        const colIni = columnLetterToIndex(cfg.start);
        const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
        const bloque = plan.ajustes.map(function (a) { return _filaAjusteConc(a, plan); });
        hojaReg.getRange(filasAntes + 1, colIni, bloque.length, nCols).setValues(bloque);
        SpreadsheetApp.flush();

        // Relectura: se vuelve a medir el saldo y tiene que dar el objetivo.
        const verif = _planConciliar(ss);
        const fallas = verif.ajustes.filter(function (a) { return Math.abs(a.delta) > CONC_TOLERANCIA; });
        if (fallas.length) {
            throw new Error('Se cargaron los ajustes pero los saldos NO dan el objetivo al releer: ' +
                fallas.map(function (a) { return a.medio + ' quedo en ' + _montoConc(a.saldo); }).join('; ') +
                '. Las filas nuevas quedaron en el ledger (a partir de la fila ' + (filasAntes + 1) +
                ') y el respaldo previo esta en "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(CONC_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'CONCILIACION APLICADA\n\n' +
            '- Movimientos cargados: ' + bloque.length + ' (filas ' + (filasAntes + 1) + ' a ' +
            (filasAntes + bloque.length) + ')\n' +
            '- Fecha: ' + plan.fechaTexto + '  |  Cotizaciones: ' + plan.tcOrigen + '\n' +
            '- Respaldo del ledger previo: "' + respaldo.nombre + '"\n' +
            '- Verificado releyendo: los ' + bloque.length + ' saldos dan el objetivo declarado\n\n' +
            plan.ajustes.map(function (a) { return '  ' + a.medio + ' -> ' + _montoConc(a.objetivo); }).join('\n') +
            '\n\nAhora el bloque "Medios Bancarios" del Tablero tiene que mostrar estos numeros.\n' +
            'Para deshacerlo: borrar esas filas del ledger, o restaurar el respaldo.';

        logSuccess('aplicarConciliarSaldos: ' + bloque.length + ' ajuste(s).');
        _mostrarConc('Conciliacion - aplicada', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarConc('Conciliacion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PLAN
// ============================================

function _planConciliar(ss) {
    const cfg = RANGES.REGISTROS;
    const hojaReg = ss.getSheetByName(cfg.sheet);
    if (!hojaReg) throw new Error('No existe el ledger "' + cfg.sheet + '".');
    const cfgMed = RANGES.MEDIOS_PAGO;
    const hojaPC = ss.getSheetByName(cfgMed.sheet);
    if (!hojaPC) throw new Error('No existe la hoja "' + cfgMed.sheet + '".');

    // Catalogo de medios con su moneda.
    const colMed = columnLetterToIndex(cfgMed.start);
    const nColsMed = columnLetterToIndex(cfgMed.end) - colMed + 1;
    const filaMed = getDataRow(cfgMed);
    const altoMed = hojaPC.getMaxRows() - filaMed + 1;
    const medios = [];
    const monedaDe = Object.create(null);
    if (altoMed > 0) {
        hojaPC.getRange(filaMed, colMed, altoMed, nColsMed).getValues().forEach(function (f) {
            const nombre = String(f[0] || '').trim();
            if (!nombre) return;
            medios.push(nombre);
            monedaDe[nombre] = String(f[1] || '').trim() || 'ARS';
        });
    }

    // Ledger: saldo por medio con la regla del ultimo corte.
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const alto = hojaReg.getMaxRows() - cfg.dataRow + 1;
    const iMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
    const iTipo = columnLetterToIndex(cfg.columns.tipo) - colIni;
    const iCuenta = columnLetterToIndex(cfg.columns.cuenta) - colIni;
    const iMedio = columnLetterToIndex(cfg.columns.medio) - colIni;
    const iFecha = columnLetterToIndex(cfg.columns.fecha) - colIni;

    const filas = [];
    let ultimaFecha = null;
    if (alto > 0) {
        hojaReg.getRange(cfg.dataRow, colIni, alto, nCols).getValues().forEach(function (f) {
            const medio = String(f[iMedio] || '').trim();
            const fecha = f[iFecha];
            if (!medio || !(fecha instanceof Date)) return;
            const monto = Number(f[iMonto]) || 0;
            const tipo = String(f[iTipo] || '').trim();
            filas.push({
                medio: medio, cuenta: String(f[iCuenta] || '').trim(), fecha: fecha.getTime(),
                neto: (tipo === 'Egreso' ? -monto : monto)
            });
            if (!ultimaFecha || fecha.getTime() > ultimaFecha) ultimaFecha = fecha.getTime();
        });
    }

    const cortes = Object.create(null);
    filas.forEach(function (f) {
        if (f.cuenta !== SYF_ARRASTRE) return;
        if (cortes[f.medio] === undefined || f.fecha > cortes[f.medio]) cortes[f.medio] = f.fecha;
    });
    const saldos = Object.create(null);
    medios.forEach(function (m) { saldos[m] = 0; });
    filas.forEach(function (f) {
        if (saldos[f.medio] === undefined) return;             // medio fuera del Plan: no participa
        const corte = cortes[f.medio] === undefined ? -Infinity : cortes[f.medio];
        if (f.fecha >= corte) saldos[f.medio] += f.neto;
    });

    // Objetivos, normalizando el nombre para tolerar acentos y mayusculas.
    const objetivoDe = Object.create(null);
    const noEncontrados = [];
    Object.keys(CONC_OBJETIVOS).forEach(function (nombre) {
        const real = medios.filter(function (m) { return _normalizarRotulo(m) === _normalizarRotulo(nombre); })[0];
        if (!real) { noEncontrados.push(nombre); return; }
        objetivoDe[real] = CONC_OBJETIVOS[nombre];
    });

    const avisos = [];
    if (noEncontrados.length) {
        avisos.push('Estos medios declarados no existen en el Plan de Cuentas y se saltean: ' +
            noEncontrados.join(', ') + '.');
    }

    const ajustes = [];
    medios.forEach(function (m) {
        const objetivo = objetivoDe[m] !== undefined ? objetivoDe[m] : (CONC_RESTO_EN_CERO ? 0 : null);
        if (objetivo === null) return;
        const saldo = _redondearConc(saldos[m]);
        const delta = _redondearConc(objetivo - saldo);
        if (Math.abs(delta) <= CONC_TOLERANCIA) return;
        ajustes.push({ medio: m, moneda: monedaDe[m], saldo: saldo, objetivo: objetivo, delta: delta });
    });
    ajustes.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });

    const hoy = new Date();
    const tz = Session.getScriptTimeZone();
    const tc = _tcParaFechaConc(ss, hoy);

    return {
        ajustes: ajustes, avisos: avisos, medidos: medios.length,
        fecha: hoy, fechaTexto: Utilities.formatDate(hoy, tz, 'dd/MM/yyyy'),
        ultimaFechaLedger: ultimaFecha ? Utilities.formatDate(new Date(ultimaFecha), tz, 'dd/MM/yyyy') : '(sin datos)',
        tc: tc.valores, tcOrigen: tc.origen
    };
}

/** Arma la fila del ledger para un ajuste, con las columnas en el orden de RANGES. */
function _filaAjusteConc(a, plan) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const fila = new Array(nCols).fill('');
    const poner = function (clave, valor) {
        const i = columnLetterToIndex(cfg.columns[clave]) - colIni;
        if (i >= 0 && i < nCols) fila[i] = valor;
    };
    poner('monto', Math.abs(a.delta));
    poner('tipo', a.delta >= 0 ? 'Ingreso' : 'Egreso');
    poner('cuenta', CONC_CUENTA_AJUSTE);
    poner('tipo_cuenta', '');       // un ajuste no es ingreso ni gasto: es correccion de saldo
    poner('medio', a.medio);
    poner('moneda', a.moneda);
    poner('fecha', plan.fecha);
    poner('nota', 'Conciliacion automatica: saldo declarado ' + _montoConc(a.objetivo) +
        ' contra ' + _montoConc(a.saldo) + ' registrado');
    poner('tc_ars', plan.tc.ARS);
    poner('tc_usd', plan.tc.USD);
    poner('tc_aud', plan.tc.AUD);
    poner('tc_eur', plan.tc.EUR);
    return fila;
}

/**
 * Cotizaciones para la fecha del ajuste. Si no hay para ese dia exacto usa la mas reciente
 * anterior y lo DECLARA -- nunca se inventa un numero (Regla Estricta 9).
 */
function _tcParaFechaConc(ss, fecha) {
    const bloques = { ARS: RANGES.TC_ARS, USD: RANGES.TC_USD, AUD: RANGES.TC_AUD, EUR: RANGES.TC_EUR };
    const valores = {};
    const notas = [];
    const objetivo = fecha.getTime();
    Object.keys(bloques).forEach(function (mon) {
        const cfg = bloques[mon];
        const hoja = ss.getSheetByName(cfg.sheet);
        if (!hoja) { valores[mon] = ''; notas.push(mon + ': sin hoja'); return; }
        const col = columnLetterToIndex(cfg.start);
        const filaDatos = getDataRow(cfg);
        const alto = hoja.getMaxRows() - filaDatos + 1;
        if (alto <= 0) { valores[mon] = ''; notas.push(mon + ': sin datos'); return; }
        const datos = hoja.getRange(filaDatos, col, alto, 2).getValues();
        let mejorFecha = null, mejorValor = '';
        datos.forEach(function (f) {
            if (!(f[0] instanceof Date)) return;
            const t = f[0].getTime();
            if (t > objetivo) return;
            if (mejorFecha === null || t > mejorFecha) { mejorFecha = t; mejorValor = f[1]; }
        });
        valores[mon] = mejorValor === '' ? '' : Number(mejorValor);
        if (mejorFecha === null) notas.push(mon + ': SIN cotizacion');
        else if (Utilities.formatDate(new Date(mejorFecha), Session.getScriptTimeZone(), 'yyyy-MM-dd') !==
                 Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd')) {
            const t = Utilities.formatDate(new Date(mejorFecha), Session.getScriptTimeZone(), 'dd/MM/yyyy');
            notas.push(mon + ': se usa la del ' + t);
            logInfo('_tcParaFechaConc: ' + mon + ' sin cotizacion para la fecha del ajuste; se usa la del ' + t);
        }
    });
    return { valores: valores, origen: notas.length ? notas.join(' | ') : 'del dia' };
}

// ============================================
// AUXILIARES
// ============================================

function _ultimaFilaConDatoConc(hojaReg) {
    const cfg = RANGES.REGISTROS;
    const col = columnLetterToIndex(cfg.columns.monto);
    const alto = hojaReg.getMaxRows() - cfg.dataRow + 1;
    if (alto <= 0) return cfg.dataRow - 1;
    const vals = hojaReg.getRange(cfg.dataRow, col, alto, 1).getValues();
    let ultima = cfg.dataRow - 1;
    for (let i = 0; i < vals.length; i++) {
        if (String(vals[i][0] || '').trim() !== '') ultima = cfg.dataRow + i;
    }
    return ultima;
}

function _redondearConc(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function _montoConc(n) {
    const v = _redondearConc(n);
    return (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2);
}

function _padConc(s, n) {
    let t = String(s);
    while (t.length < n) t += ' ';
    return t.slice(0, n);
}

function _padIzqConc(s, n) {
    let t = String(s);
    while (t.length < n) t = ' ' + t;
    return t;
}

function _mostrarConc(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
