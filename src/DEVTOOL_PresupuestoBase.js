/**
 * DEVTOOL_PresupuestoBase.js
 * Carga en la hoja "Proyeccion" un presupuesto base derivado del historial real.
 *
 * [CONCEPTO DE NEGOCIO]
 * La hoja "Proyeccion" nace vacia, asi que "Presupuesto Asignado" del Tablero (N9:N11) da cero y
 * "Disponibilidad de fondos" no puede decir nada. Este modulo la siembra con un presupuesto base
 * calculado a partir de lo que Franco efectivamente gasto e ingreso, para que el Tablero tenga
 * contra que comparar y se pueda probar de punta a punta.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * El metodo es el mas viejo y el mas honesto que hay para un primer presupuesto: **promedio
 * historico por cuenta**. Se toma una ventana de meses completos, se suma lo de cada cuenta y se
 * divide por la cantidad de meses de la ventana. Eso da el gasto mensual tipico de esa cuenta.
 *
 * Tres decisiones que hacen que el numero signifique algo:
 *
 * 1. EL PRESUPUESTO ES PLANO A LO LARGO DE LOS MESES. La misma cifra se carga en cada mes de
 *    destino. Un presupuesto es una linea que uno se fija, no una prediccion mes a mes; lo que
 *    varia es la realidad. Asi el porcentaje de cumplimiento del Tablero dice algo real: cuanto
 *    se despego ESE mes de la linea.
 *
 * 2. SE EXCLUYEN LAS CUENTAS NEUTRAS. Los traspasos y los asientos "Inicio Mes" no son gasto ni
 *    ingreso: mueven plata de un bolsillo a otro. Presupuestarlos seria contarlos dos veces. Es
 *    el mismo criterio que usan los bloques de la realidad del Tablero -- si difirieran, el
 *    cumplimiento compararia peras con manzanas.
 *
 * 3. SE RESPETA LA MONEDA DE ORIGEN. Una cuenta que se paga en dolares se presupuesta en dolares,
 *    y el Tablero la convierte con la cotizacion del dia como hace con cualquier previsto. Promediar
 *    montos de monedas distintas en un mismo numero seria inventar una cifra que no existe.
 *
 * QUE NO HACE
 * 1. NO toca "Registros". Lee y no escribe.
 * 2. NO borra lo que vos hayas cargado a mano en "Proyeccion": solo reemplaza las filas que este
 *    mismo modulo genero, que quedan marcadas en la columna Nota.
 * 3. NO inventa cuentas: solo aparecen las que tienen movimientos en la ventana.
 *
 * @see docs/permanente/FUNCIONALIDADES.md
 * @version 0.25.0
 * @since 2026-08-20
 * @lastModified 2026-08-20
 */

/**
 * Marca que identifica las filas generadas por este modulo.
 *
 * Es lo que hace que la carga sea repetible sin duplicar: en cada corrida se borran las filas que
 * empiezan con esta marca y se escriben las nuevas. Sin la marca habria que vaciar la hoja entera,
 * y eso se llevaria puesto cualquier previsto cargado a mano.
 */
const PB_MARCA = 'Presupuesto base historico';

/** Cuantos meses COMPLETOS entran al promedio. El mes en curso no cuenta: esta a medio transcurrir. */
const PB_MESES_VENTANA = 6;

/** Para cuantos meses se carga el presupuesto: la ventana mas el mes en curso, para poder navegar. */
const PB_MESES_DESTINO = PB_MESES_VENTANA + 1;

/** Debajo de esto, la cuenta no se presupuesta: es ruido de redondeo, no una linea. */
const PB_MINIMO = 1;

const PB_PROP_SELLO = 'presupuesto_base_sello';

// ============================================
// LECTURA DEL HISTORIAL
// ============================================

/** Primer dia del mes de una fecha, normalizado a medianoche. */
function _mesDePb(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/** Clave estable de un mes, para agrupar y comparar sin depender de objetos Date. */
function _claveMesPb(fecha) {
    return fecha.getFullYear() * 100 + fecha.getMonth();
}

/**
 * Lee "Registros" y devuelve el promedio mensual por (cuenta, moneda) sobre la ventana.
 *
 * La ventana termina en el ultimo mes COMPLETO -- el anterior al actual -- y va hacia atras
 * PB_MESES_VENTANA meses. El mes en curso se excluye a proposito: promediar un mes a medio
 * transcurrir baja artificialmente todas las lineas.
 */
function _promediosPb(ss) {
    const cfg = RANGES.REGISTROS;
    const hoja = ss.getSheetByName(cfg.sheet);
    if (!hoja) throw new Error('No existe el ledger "' + cfg.sheet + '".');

    const desdeFila = cfg.dataRow;
    const ultima = hoja.getLastRow();
    if (ultima < desdeFila) throw new Error('El ledger no tiene filas de datos.');

    const colIni = columnLetterToIndex(cfg.start);
    const colFin = columnLetterToIndex(cfg.end);
    const filas = hoja.getRange(desdeFila, colIni, ultima - desdeFila + 1, colFin - colIni + 1).getValues();

    const idx = {};
    ['monto', 'tipo', 'cuenta', 'tipo_cuenta', 'medio', 'moneda', 'fecha']
        .forEach(function (k) { idx[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    const hoy = new Date();
    const finVentana = new Date(hoy.getFullYear(), hoy.getMonth(), 1);           // 1ro del mes en curso
    const iniVentana = new Date(hoy.getFullYear(), hoy.getMonth() - PB_MESES_VENTANA, 1);
    const claveIni = _claveMesPb(iniVentana), claveFin = _claveMesPb(finVentana);

    const acum = {};
    const mesesVistos = {};
    let leidas = 0, fueraVentana = 0, neutras = 0, sinDatos = 0;

    filas.forEach(function (f) {
        const fecha = f[idx.fecha];
        if (!(fecha instanceof Date) || isNaN(fecha.getTime())) { sinDatos++; return; }
        const clave = _claveMesPb(_mesDePb(fecha));
        if (clave < claveIni || clave >= claveFin) { fueraVentana++; return; }

        const cuenta = String(f[idx.cuenta] || '').trim();
        const tipoCuenta = String(f[idx.tipo_cuenta] || '').trim();
        const monto = Number(f[idx.monto]);
        if (!cuenta || !tipoCuenta || !isFinite(monto) || monto === 0) { sinDatos++; return; }
        if (esCuentaNeutra(cuenta)) { neutras++; return; }

        const moneda = String(f[idx.moneda] || 'ARS').trim() || 'ARS';
        const tipo = String(f[idx.tipo] || '').trim();
        const medio = String(f[idx.medio] || '').trim();
        const k = [cuenta, moneda, tipoCuenta, tipo].join(' ');

        if (!acum[k]) {
            acum[k] = {
                cuenta: cuenta, moneda: moneda, tipoCuenta: tipoCuenta, tipo: tipo,
                total: 0, n: 0, medios: {}
            };
        }
        acum[k].total += Math.abs(monto);
        acum[k].n++;
        acum[k].medios[medio] = (acum[k].medios[medio] || 0) + 1;
        mesesVistos[clave] = true;
        leidas++;
    });

    // El divisor son los meses DE LA VENTANA, no los meses en que la cuenta aparecio. Una cuenta
    // que gasto una vez en seis meses tiene un promedio mensual bajo, y eso es correcto: es lo que
    // hay que apartar por mes para poder pagarla cuando vuelva a caer.
    const lineas = Object.keys(acum).map(function (k) {
        const a = acum[k];
        const medio = Object.keys(a.medios).sort(function (x, y) { return a.medios[y] - a.medios[x]; })[0] || '';
        return {
            cuenta: a.cuenta, moneda: a.moneda, tipoCuenta: a.tipoCuenta, tipo: a.tipo, medio: medio,
            promedio: Math.round((a.total / PB_MESES_VENTANA) * 100) / 100,
            movimientos: a.n
        };
    }).filter(function (l) { return l.promedio >= PB_MINIMO; });

    lineas.sort(function (a, b) {
        if (a.tipoCuenta !== b.tipoCuenta) return a.tipoCuenta < b.tipoCuenta ? -1 : 1;
        return b.promedio - a.promedio;
    });

    return {
        lineas: lineas,
        iniVentana: iniVentana, finVentana: finVentana,
        mesesConDato: Object.keys(mesesVistos).length,
        leidas: leidas, fueraVentana: fueraVentana, neutras: neutras, sinDatos: sinDatos
    };
}

/** Los meses de destino: los de la ventana mas el mes en curso, del mas viejo al mas nuevo. */
function _mesesDestinoPb() {
    const hoy = new Date();
    const out = [];
    for (let i = PB_MESES_DESTINO - 1; i >= 0; i--) {
        out.push(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1));
    }
    return out;
}

// ============================================
// ESCRITURA EN LA HOJA PROYECCION
// ============================================

/** Localiza la hoja Proyeccion y comprueba que tenga la misma geometria que el ledger. */
function _preflightPb(ss) {
    const cfg = RANGES.REGISTROS;
    const nombre = SHEETS.PROYECCION;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) {
        throw new Error('No existe la hoja "' + nombre + '". Correr antes ' +
            'Tidetrack Dev > BD de Proyeccion (presupuesto) > 2. Crear y cablear.');
    }

    // La hoja es un espejo del ledger: si los encabezados no coinciden, escribir ahi seria
    // escribir en columnas equivocadas. Se verifica por ROTULO, no por posicion.
    const desvios = [];
    ['monto', 'tipo', 'cuenta', 'tipo_cuenta', 'medio', 'moneda', 'fecha', 'nota'].forEach(function (k) {
        const col = columnLetterToIndex(cfg.columns[k]);
        const enLedger = String(ss.getSheetByName(cfg.sheet).getRange(cfg.headerRow, col).getValue() || '').trim();
        const enProy = String(hoja.getRange(cfg.headerRow, col).getValue() || '').trim();
        if (_normalizarRotulo(enLedger) !== _normalizarRotulo(enProy)) {
            desvios.push(cfg.columns[k] + cfg.headerRow + ': el ledger dice "' + enLedger +
                '" y la proyeccion dice "' + enProy + '"');
        }
    });
    if (desvios.length) {
        throw new Error('"' + nombre + '" dejo de ser un espejo exacto de "' + cfg.sheet + '": ' +
            desvios.join('; ') + '. No se escribe nada.');
    }
    return { hoja: hoja, nombre: nombre };
}

/** Las filas que este modulo genero en una corrida previa, por su marca en la columna Nota. */
function _filasGeneradasPb(hoja) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const colNota = columnLetterToIndex(cfg.columns.nota);
    const notas = hoja.getRange(cfg.dataRow, colNota, ultima - cfg.dataRow + 1, 1).getValues();
    const out = [];
    notas.forEach(function (f, i) {
        if (String(f[0] || '').indexOf(PB_MARCA) === 0) out.push(cfg.dataRow + i);
    });
    return out;
}

/**
 * Borra las filas generadas previamente, de abajo hacia arriba.
 *
 * De abajo hacia arriba a proposito: borrar de arriba corre los indices de todo lo que sigue y
 * termina borrando filas que no eran. Es el mismo error que hizo falta corregir en la restauracion
 * del Plan de Cuentas.
 */
function _borrarGeneradasPb(hoja, filas) {
    for (let i = filas.length - 1; i >= 0; i--) hoja.deleteRow(filas[i]);
}

/** Arma la matriz de filas nuevas: una por linea y mes de destino. */
function _matrizPb(lineas, meses, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const pos = {};
    ['monto', 'tipo', 'cuenta', 'tipo_cuenta', 'medio', 'moneda', 'fecha', 'nota']
        .forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    const filas = [];
    meses.forEach(function (mes) {
        lineas.forEach(function (l) {
            const fila = new Array(ancho).fill('');
            fila[pos.monto] = l.promedio;
            fila[pos.tipo] = l.tipo;
            fila[pos.cuenta] = l.cuenta;
            fila[pos.tipo_cuenta] = l.tipoCuenta;
            fila[pos.medio] = l.medio;
            fila[pos.moneda] = l.moneda;
            fila[pos.fecha] = mes;
            // Las columnas J:M (los TC congelados) quedan VACIAS a proposito: un movimiento que
            // todavia no ocurrio no tiene cotizacion del dia, y el Tablero lo convierte con la
            // de hoy. Llenarlas seria inventar un dato.
            fila[pos.nota] = PB_MARCA + ' ' + sello;
            filas.push(fila);
        });
    });
    return filas;
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: dice que se cargaria, sin escribir. */
function estadoPresupuestoBase() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPb(ss);
        const h = _promediosPb(ss);
        const meses = _mesesDestinoPb();
        const previas = _filasGeneradasPb(pre.hoja);

        const fmt = function (d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/yyyy'); };
        const l = ['PRESUPUESTO BASE - ESTADO (no se escribio nada)', ''];
        l.push('VENTANA DEL PROMEDIO: ' + fmt(h.iniVentana) + ' a ' +
            fmt(new Date(h.finVentana.getFullYear(), h.finVentana.getMonth() - 1, 1)) +
            ' (' + PB_MESES_VENTANA + ' meses completos, ' + h.mesesConDato + ' con movimientos)');
        l.push('SE CARGA EN: ' + fmt(meses[0]) + ' a ' + fmt(meses[meses.length - 1]) +
            ' (' + meses.length + ' meses)');
        l.push('');
        l.push('Movimientos leidos del ledger: ' + h.leidas);
        l.push('  descartados por estar fuera de la ventana: ' + h.fueraVentana);
        l.push('  descartados por ser cuenta neutra (traspasos, Inicio Mes): ' + h.neutras);
        l.push('  descartados por venir incompletos: ' + h.sinDatos);
        l.push('');
        l.push('LINEAS DE PRESUPUESTO: ' + h.lineas.length + ' -> ' +
            (h.lineas.length * meses.length) + ' filas a escribir');
        if (previas.length) {
            l.push('(se reemplazan ' + previas.length + ' fila(s) de una carga anterior; lo que hayas ' +
                'cargado a mano NO se toca)');
        }
        l.push('');
        l.push('LAS 12 LINEAS MAS GRANDES:');
        h.lineas.slice(0, 12).forEach(function (x) {
            l.push('  ' + x.tipoCuenta.padEnd(15) + x.cuenta.padEnd(24) +
                x.moneda + ' ' + x.promedio.toFixed(2) + '  (' + x.movimientos + ' mov.)');
        });

        const t = l.join('\n');
        _mostrarPb('Presupuesto base - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPb('Presupuesto base - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Carga el presupuesto base en la hoja Proyeccion. Repetible: reemplaza su propia carga previa. */
function aplicarPresupuestoBase() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoBase necesita UI (menu Tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPb(ss);
        const h = _promediosPb(ss);
        if (!h.lineas.length) {
            const t = 'No hay movimientos en la ventana de los ultimos ' + PB_MESES_VENTANA +
                ' meses completos. No se escribio nada.';
            _mostrarPb('Presupuesto base', t);
            return { ok: false, error: t };
        }
        const meses = _mesesDestinoPb();
        const previas = _filasGeneradasPb(pre.hoja);
        const totalFilas = h.lineas.length * meses.length;

        const conf = ui.alert('Cargar presupuesto base en "' + pre.nombre + '"',
            'Se van a escribir ' + totalFilas + ' fila(s): ' + h.lineas.length +
            ' lineas de presupuesto por ' + meses.length + ' meses.\n\n' +
            'EL METODO: el promedio mensual de cada cuenta sobre los ultimos ' + PB_MESES_VENTANA +
            ' meses completos, cargado igual en todos los meses. Un presupuesto es una linea fija; ' +
            'lo que varia es la realidad, y eso es lo que el Tablero compara.\n\n' +
            'Se excluyen los traspasos y los "Inicio Mes": no son gasto ni ingreso.\n' +
            'Cada cuenta se presupuesta EN SU MONEDA, y el Tablero convierte con la cotizacion de hoy.\n\n' +
            (previas.length
                ? 'Se reemplazan ' + previas.length + ' fila(s) de una carga anterior de este mismo\n' +
                  'modulo. Lo que hayas cargado a mano NO se toca.\n\n'
                : '') +
            'NO se toca "' + RANGES.REGISTROS.sheet + '".\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) {
            return { ok: false, error: 'Cancelado por el operador. No se escribio ninguna fila.' };
        }

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');

        if (previas.length) {
            _borrarGeneradasPb(pre.hoja, previas);
            SpreadsheetApp.flush();
            const quedan = _filasGeneradasPb(pre.hoja);
            if (quedan.length) {
                throw new Error('Quedaron ' + quedan.length + ' fila(s) de la carga anterior sin ' +
                    'borrar. Se corta antes de escribir para no duplicar el presupuesto.');
            }
        }

        const matriz = _matrizPb(h.lineas, meses, sello);
        const cfg = RANGES.REGISTROS;
        const colIni = columnLetterToIndex(cfg.start);
        const primera = Math.max(pre.hoja.getLastRow() + 1, cfg.dataRow);
        if (primera + matriz.length - 1 > pre.hoja.getMaxRows()) {
            pre.hoja.insertRowsAfter(pre.hoja.getMaxRows(),
                primera + matriz.length - 1 - pre.hoja.getMaxRows());
        }
        pre.hoja.getRange(primera, colIni, matriz.length, matriz[0].length).setValues(matriz);
        SpreadsheetApp.flush();

        // Verificacion: se releen las filas escritas y se comprueba que la suma coincida con lo
        // planeado. Contar filas no alcanza -- una validacion de datos puede aceptar la fila y
        // rechazar una celda, y el presupuesto quedaria corto sin que nadie se entere.
        const escritas = _filasGeneradasPb(pre.hoja);
        if (escritas.length !== matriz.length) {
            throw new Error('Se escribieron ' + matriz.length + ' filas y al releer aparecen ' +
                escritas.length + '. Revisar "' + pre.nombre + '" a mano.');
        }
        const colMonto = columnLetterToIndex(cfg.columns.monto);
        const sumaLeida = pre.hoja.getRange(primera, colMonto, matriz.length, 1).getValues()
            .reduce(function (a, f) { return a + (Number(f[0]) || 0); }, 0);
        const sumaPlan = h.lineas.reduce(function (a, l) { return a + l.promedio; }, 0) * meses.length;
        if (Math.abs(sumaLeida - sumaPlan) > 1) {
            throw new Error('La suma releida (' + sumaLeida.toFixed(2) + ') no coincide con la ' +
                'planeada (' + sumaPlan.toFixed(2) + '): alguna celda no entro. Revisar a mano.');
        }

        PropertiesService.getDocumentProperties().setProperty(PB_PROP_SELLO, sello);

        const fmt = function (d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/yyyy'); };
        const detalle = 'PRESUPUESTO BASE CARGADO\n\n' +
            '- Filas escritas y verificadas: ' + matriz.length + '\n' +
            '- Lineas de presupuesto: ' + h.lineas.length + '\n' +
            '- Meses: ' + fmt(meses[0]) + ' a ' + fmt(meses[meses.length - 1]) + '\n' +
            '- Promedio calculado sobre ' + PB_MESES_VENTANA + ' meses completos\n\n' +
            'QUE MIRAR EN EL TABLERO:\n' +
            '  1. "Presupuesto Asignado" (N9:N11) deja de dar cero.\n' +
            '  2. El % de cada fila ya significa algo: cuanto se despego ese mes de la linea.\n' +
            '  3. Cambiando el mes en N2 los numeros NO deberian moverse mucho -- el presupuesto\n' +
            '     es plano a proposito --, pero "Movimientos del Mes" si se mueve. Esa diferencia\n' +
            '     entre una linea fija y una realidad que varia es justamente lo que se mira.\n' +
            '  4. "Disponibilidad de fondos" (O23:O25) ya puede repartir contra algo.\n\n' +
            'Es un PUNTO DE PARTIDA, no una decision: las filas estan en "' + pre.nombre + '" y se\n' +
            'editan como cualquier otra. Volver a correr esto reemplaza solo lo que genero el\n' +
            'modulo y respeta lo que hayas tocado a mano... siempre que le cambies la Nota.\n\n' +
            'Para sacarlo: Tidetrack Dev > Presupuesto base > 3. Quitar la carga.';

        logSuccess('aplicarPresupuestoBase: ' + matriz.length + ' filas.');
        _mostrarPb('Presupuesto base - cargado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPb('Presupuesto base - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Quita del todo la carga generada por este modulo. No toca lo cargado a mano. */
function quitarPresupuestoBase() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'quitarPresupuestoBase necesita UI (menu Tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPb(ss);
        const filas = _filasGeneradasPb(pre.hoja);
        if (!filas.length) {
            const t = 'No hay filas generadas por este modulo en "' + pre.nombre + '". Nada que quitar.';
            _mostrarPb('Presupuesto base', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Quitar el presupuesto base',
            'Se van a borrar ' + filas.length + ' fila(s) de "' + pre.nombre + '": las que este ' +
            'modulo genero, marcadas en la columna Nota.\n\nLo que hayas cargado a mano NO se toca.\n\n' +
            'El "Presupuesto Asignado" del Tablero vuelve a dar cero.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se borro nada.' };

        _borrarGeneradasPb(pre.hoja, filas);
        SpreadsheetApp.flush();

        const quedan = _filasGeneradasPb(pre.hoja);
        if (quedan.length) {
            throw new Error('Quedaron ' + quedan.length + ' fila(s) sin borrar. Revisar a mano.');
        }
        PropertiesService.getDocumentProperties().deleteProperty(PB_PROP_SELLO);

        const t = 'PRESUPUESTO BASE QUITADO\n\n- Filas borradas y verificadas: ' + filas.length +
            '\n- No se toco ninguna fila cargada a mano.';
        logSuccess('quitarPresupuestoBase: ' + filas.length + ' filas.');
        _mostrarPb('Presupuesto base - quitado', t);
        return { ok: true, detalle: t };

    } catch (e) {
        const msg = 'NO SE QUITO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPb('Presupuesto base - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPb(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
