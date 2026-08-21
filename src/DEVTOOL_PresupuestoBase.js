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
 * 1. CADA MES SE PRESUPUESTA CON LOS MESES ANTERIORES A EL (promedio movil).
 *
 *    La primera version cargaba la MISMA cifra en todos los meses. Era defendible -- un
 *    presupuesto es una linea que uno se fija -- pero rompia el seguimiento: al cambiar el
 *    periodo en el Tablero el presupuesto no se movia, y sin variacion no hay nada que seguir.
 *    decision Franco 2026-08-20.
 *
 *    Ahora el presupuesto de agosto sale de los seis meses anteriores a agosto, el de julio de
 *    los seis anteriores a julio, y asi. Eso es lo que uno hubiera podido presupuestar con la
 *    informacion disponible en ese momento: ningun mes se presupuesta con datos de su propio
 *    futuro. Y el cumplimiento sigue significando algo, porque el mes que se mide nunca entra
 *    en su propio promedio.
 *
 * 2. LOS TRASPASOS SE EXCLUYEN, SALVO LOS QUE CRUZAN UN MEDIO DE RIQUEZA.
 *
 *    Un traspaso comun mueve plata de un bolsillo a otro: no es gasto ni ingreso, y
 *    presupuestarlo seria contarlo dos veces. Pero un traspaso HACIA un frasco de ahorro o una
 *    inversion SI es un acto economico -- es exactamente como se capitaliza.
 *    decision Franco 2026-08-20: "los traspasos indican capitalizacion si se cruza con un medio".
 *
 *    Como en este ledger un traspaso son DOS filas -- un Egreso del medio origen y un Ingreso al
 *    medio destino, verificado en el gemelo: $7.000 sale de Efectivo y $7.000 entra a Mercado
 *    Pago --, filtrar por "el medio de esta fila es de riqueza" hace lo correcto solo: de un
 *    traspaso de Hogar a un frasco entra la pata de Ingreso y no la de Egreso, y de un traspaso
 *    entre dos cuentas de casa no entra ninguna.
 *
 *    Los asientos "Inicio Mes" se excluyen siempre: son puntos de corte de conciliacion.
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

/** Cuantos meses ANTERIORES entran al promedio de cada mes de destino. */
const PB_MESES_VENTANA = 6;

/** Para cuantos meses se carga el presupuesto, contando hacia atras desde el mes en curso. */
const PB_MESES_DESTINO = 7;

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
 * Lee "Registros" UNA vez y devuelve las filas utiles, ya normalizadas y con su mes.
 *
 * Se separa la lectura de la agregacion a proposito: con promedio movil hay que agregar una vez
 * por mes de destino, y releer la hoja siete veces seria lento y ademas podria dar resultados
 * distintos entre pasadas si algo cambia en el medio.
 */
function _leerLedgerPb(ss) {
    const cfg = RANGES.REGISTROS;
    const hoja = ss.getSheetByName(cfg.sheet);
    if (!hoja) throw new Error('No existe el ledger "' + cfg.sheet + '".');

    const desdeFila = cfg.dataRow;
    const ultima = hoja.getLastRow();
    if (ultima < desdeFila) throw new Error('El ledger no tiene filas de datos.');

    const colIni = columnLetterToIndex(cfg.start);
    const colFin = columnLetterToIndex(cfg.end);
    const crudas = hoja.getRange(desdeFila, colIni, ultima - desdeFila + 1, colFin - colIni + 1).getValues();

    const idx = {};
    ['monto', 'tipo', 'cuenta', 'tipo_cuenta', 'medio', 'moneda', 'fecha']
        .forEach(function (k) { idx[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    // El tipo de cada medio, para decidir que traspasos entran. Se lee una vez.
    const tipoDeMedio = _tiposDeMedioPb(ss);

    const filas = [];
    let neutras = 0, sinDatos = 0, traspasosRiqueza = 0;
    let claveMin = null, claveMax = null;

    crudas.forEach(function (f) {
        const fecha = f[idx.fecha];
        if (!(fecha instanceof Date) || isNaN(fecha.getTime())) { sinDatos++; return; }
        const cuenta = String(f[idx.cuenta] || '').trim();
        const tipoCuenta = String(f[idx.tipo_cuenta] || '').trim();
        const monto = Number(f[idx.monto]);
        const medioCrudo = String(f[idx.medio] || '').trim();
        if (!cuenta || !isFinite(monto) || monto === 0) { sinDatos++; return; }

        // Los arrastres nunca. Los traspasos, solo si esta fila toca un medio de riqueza.
        const esTraspaso = esCuentaNeutra(cuenta) && normalizarNombreCuenta(cuenta) !== normalizarNombreCuenta(CUENTA_ARRASTRE);
        if (esCuentaNeutra(cuenta)) {
            const t = tipoDeMedio[normalizarNombreCuenta(medioCrudo)] || '';
            if (!esTraspaso || TIPOS_RIQUEZA.indexOf(t) === -1) { neutras++; return; }
            traspasosRiqueza++;
        } else if (!tipoCuenta) {
            // Un gasto o ingreso sin Tipo de Cuenta no se puede ubicar en ningun bloque.
            // Un traspaso NO lo necesita: no vive en ninguno de los tres.
            sinDatos++; return;
        }

        const clave = _claveMesPb(_mesDePb(fecha));
        if (claveMin === null || clave < claveMin) claveMin = clave;
        if (claveMax === null || clave > claveMax) claveMax = clave;
        filas.push({
            clave: clave, cuenta: cuenta, tipoCuenta: tipoCuenta,
            moneda: String(f[idx.moneda] || 'ARS').trim() || 'ARS',
            tipo: String(f[idx.tipo] || '').trim(),
            medio: String(f[idx.medio] || '').trim(),
            monto: Math.abs(monto)
        });
    });

    return { filas: filas, neutras: neutras, sinDatos: sinDatos, traspasosRiqueza: traspasosRiqueza,
             claveMin: claveMin, claveMax: claveMax };
}

/** El tipo de cada medio del Plan de Cuentas, indexado por nombre normalizado. */
function _tiposDeMedioPb(ss) {
    const cfg = RANGES.MEDIOS_PAGO;
    const hoja = ss.getSheetByName(cfg.sheet);
    if (!hoja) throw new Error('No existe la hoja "' + cfg.sheet + '".');
    const colNom = columnLetterToIndex(cfg.columns.nombre);
    const colTipo = columnLetterToIndex(cfg.columns.proyecto);
    const desde = getDataRow(cfg);
    const alto = hoja.getLastRow() - desde + 1;
    const out = {};
    if (alto <= 0) return out;
    const anchoCols = colTipo - colNom + 1;
    hoja.getRange(desde, colNom, alto, anchoCols).getValues().forEach(function (f) {
        const nom = normalizarNombreCuenta(f[0]);
        if (nom) out[nom] = String(f[anchoCols - 1] || '').trim();
    });
    return out;
}

/**
 * Promedio mensual por (cuenta, moneda) sobre una ventana [claveIni, claveFin).
 *
 * El divisor son los meses DE LA VENTANA, no los meses en que la cuenta aparecio. Una cuenta que
 * gasto una vez en seis meses tiene un promedio mensual bajo, y eso es correcto: es lo que hay que
 * apartar por mes para poder pagarla cuando vuelva a caer.
 */
function _promediosDeVentanaPb(filas, claveIni, claveFin) {
    const acum = {};
    const mesesVistos = {};
    let leidas = 0;

    filas.forEach(function (f) {
        if (f.clave < claveIni || f.clave >= claveFin) return;
        const k = [f.cuenta, f.moneda, f.tipoCuenta, f.tipo].join(' ');
        if (!acum[k]) {
            acum[k] = { cuenta: f.cuenta, moneda: f.moneda, tipoCuenta: f.tipoCuenta, tipo: f.tipo,
                        total: 0, n: 0, medios: {} };
        }
        acum[k].total += f.monto;
        acum[k].n++;
        acum[k].medios[f.medio] = (acum[k].medios[f.medio] || 0) + 1;
        mesesVistos[f.clave] = true;
        leidas++;
    });

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

    return { lineas: lineas, leidas: leidas, mesesConDato: Object.keys(mesesVistos).length };
}

/**
 * El plan completo: para cada mes de destino, el promedio de los meses ANTERIORES a el.
 *
 * Un mes de destino sin ninguna linea no se descarta en silencio: se devuelve igual con la lista
 * vacia, para que el reporte pueda decir cuantos meses quedaron sin presupuesto y por que.
 */
function _planPorMesPb(datos, meses) {
    return meses.map(function (mes) {
        const claveFin = _claveMesPb(mes);
        const iniDate = new Date(mes.getFullYear(), mes.getMonth() - PB_MESES_VENTANA, 1);
        const claveIni = _claveMesPb(iniDate);
        const r = _promediosDeVentanaPb(datos.filas, claveIni, claveFin);
        return { mes: mes, desde: iniDate, lineas: r.lineas, leidas: r.leidas, mesesConDato: r.mesesConDato };
    });
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
 * Borra las filas generadas previamente, de abajo hacia arriba y EN BLOQUES CONTIGUOS.
 *
 * De abajo hacia arriba a proposito: borrar de arriba corre los indices de todo lo que sigue y
 * termina borrando filas que no eran. Es el mismo error que hizo falta corregir en la restauracion
 * del Plan de Cuentas.
 *
 * En bloques porque una llamada por fila no escala: la carga del 2026-08-20 tenia 413 filas que
 * borrar y `deleteRow` una por una se acercaba peligrosamente al limite de 6 minutos de Apps
 * Script. Y un timeout a mitad del borrado deja la hoja con media carga vieja adentro. Como las
 * filas generadas quedan siempre juntas, casi siempre es UNA sola llamada.
 */
function _borrarGeneradasPb(hoja, filas) {
    if (!filas.length) return 0;
    const ordenadas = filas.slice().sort(function (a, b) { return a - b; });
    const bloques = [];
    let ini = ordenadas[0], largo = 1;
    for (let i = 1; i < ordenadas.length; i++) {
        if (ordenadas[i] === ordenadas[i - 1] + 1) { largo++; continue; }
        bloques.push({ ini: ini, largo: largo });
        ini = ordenadas[i]; largo = 1;
    }
    bloques.push({ ini: ini, largo: largo });
    for (let i = bloques.length - 1; i >= 0; i--) hoja.deleteRows(bloques[i].ini, bloques[i].largo);
    return bloques.length;
}

/** Arma la matriz de filas nuevas: una por linea de cada mes de destino. */
function _matrizPb(planPorMes, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const pos = {};
    ['monto', 'tipo', 'cuenta', 'tipo_cuenta', 'medio', 'moneda', 'fecha', 'nota']
        .forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    const filas = [];
    planPorMes.forEach(function (m) {
        m.lineas.forEach(function (l) {
            const fila = new Array(ancho).fill('');
            fila[pos.monto] = l.promedio;
            fila[pos.tipo] = l.tipo;
            fila[pos.cuenta] = l.cuenta;
            fila[pos.tipo_cuenta] = l.tipoCuenta;
            fila[pos.medio] = l.medio;
            fila[pos.moneda] = l.moneda;
            fila[pos.fecha] = m.mes;
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
        const datos = _leerLedgerPb(ss);
        const meses = _mesesDestinoPb();
        const plan = _planPorMesPb(datos, meses);
        const previas = _filasGeneradasPb(pre.hoja);
        const total = plan.reduce(function (a, m) { return a + m.lineas.length; }, 0);

        const fmt = function (d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/yyyy'); };
        const l = ['PRESUPUESTO BASE - ESTADO (no se escribio nada)', ''];
        l.push('METODO: cada mes se presupuesta con los ' + PB_MESES_VENTANA + ' meses ANTERIORES a el.');
        l.push('Ningun mes se presupuesta con datos de su propio futuro, asi que el cumplimiento');
        l.push('significa algo: el mes que se mide nunca entra en su propio promedio.');
        l.push('');
        l.push('Movimientos utiles en el ledger: ' + datos.filas.length);
        l.push('  descartados por ser cuenta neutra (traspasos, Inicio Mes): ' + datos.neutras);
        l.push('  descartados por venir incompletos: ' + datos.sinDatos);
        l.push('');
        l.push('PRESUPUESTO POR MES:');
        plan.forEach(function (m) {
            const suma = m.lineas.reduce(function (a, x) { return a + (x.moneda === 'ARS' ? x.promedio : 0); }, 0);
            l.push('  ' + fmt(m.mes) + '  ' + String(m.lineas.length).padStart(3) + ' lineas' +
                (m.lineas.length ? '   ~' + Math.round(suma).toLocaleString('es-AR') + ' ARS' +
                    '   (promedia desde ' + fmt(m.desde) + ', ' + m.mesesConDato + ' meses con dato)'
                    : '   SIN presupuesto: no hay historial anterior a ese mes'));
        });
        l.push('');
        l.push('TOTAL A ESCRIBIR: ' + total + ' fila(s)');
        if (previas.length) {
            l.push('(se reemplazan ' + previas.length + ' fila(s) de una carga anterior; lo que hayas ' +
                'cargado a mano NO se toca)');
        }
        const ultimo = plan[plan.length - 1];
        if (ultimo && ultimo.lineas.length) {
            l.push('');
            l.push('LAS 10 LINEAS MAS GRANDES DE ' + fmt(ultimo.mes) + ':');
            ultimo.lineas.slice(0, 10).forEach(function (x) {
                l.push('  ' + x.tipoCuenta.padEnd(15) + x.cuenta.padEnd(24) +
                    x.moneda + ' ' + x.promedio.toFixed(2));
            });
        }

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
        const datos = _leerLedgerPb(ss);
        const meses = _mesesDestinoPb();
        const plan = _planPorMesPb(datos, meses);
        const conPresupuesto = plan.filter(function (m) { return m.lineas.length > 0; });
        const totalFilas = plan.reduce(function (a, m) { return a + m.lineas.length; }, 0);

        if (!totalFilas) {
            const t = 'No hay historial suficiente para presupuestar ninguno de los ' + meses.length +
                ' meses. No se escribio nada.';
            _mostrarPb('Presupuesto base', t);
            return { ok: false, error: t };
        }

        const previas = _filasGeneradasPb(pre.hoja);
        const fmt = function (d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'MM/yyyy'); };

        const conf = ui.alert('Cargar presupuesto base en "' + pre.nombre + '"',
            'Se van a escribir ' + totalFilas + ' fila(s) repartidas en ' + conPresupuesto.length +
            ' mes(es), de ' + fmt(meses[0]) + ' a ' + fmt(meses[meses.length - 1]) + '.\n\n' +
            'EL METODO: cada mes se presupuesta con el promedio de los ' + PB_MESES_VENTANA +
            ' meses ANTERIORES a el. Ningun mes se presupuesta con datos de su propio futuro, asi ' +
            'que el presupuesto CAMBIA al cambiar el periodo en el Tablero y el cumplimiento ' +
            'significa algo.\n\n' +
            'Los traspasos entran SOLO si tocan un medio de tipo ' + TIPOS_RIQUEZA.join(' o ') +
            ': un traspaso a un frasco\nes capitalizar. Los "Inicio Mes" nunca: son puntos de corte, no movimientos.\n' +
            'Cada cuenta se presupuesta EN SU MONEDA, y el Tablero convierte con la cotizacion de hoy.\n\n' +
            (plan.length !== conPresupuesto.length
                ? (plan.length - conPresupuesto.length) + ' mes(es) quedan SIN presupuesto por no tener\n' +
                  'historial anterior suficiente. Es correcto: no se puede presupuestar sin pasado.\n\n'
                : '') +
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

        const matriz = _matrizPb(plan, sello);
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
        const sumaPlan = plan.reduce(function (a, m) {
            return a + m.lineas.reduce(function (b, l) { return b + l.promedio; }, 0);
        }, 0);
        if (Math.abs(sumaLeida - sumaPlan) > 1) {
            throw new Error('La suma releida (' + sumaLeida.toFixed(2) + ') no coincide con la ' +
                'planeada (' + sumaPlan.toFixed(2) + '): alguna celda no entro. Revisar a mano.');
        }

        // Y el invariante que hace util a esta version: dos meses consecutivos con presupuesto
        // NO pueden ser identicos, o el presupuesto volveria a no moverse con el periodo.
        let variacion = 'no evaluable (menos de dos meses con presupuesto)';
        if (conPresupuesto.length >= 2) {
            const suma = function (m) { return m.lineas.reduce(function (a, l) { return a + l.promedio; }, 0); };
            const a = suma(conPresupuesto[conPresupuesto.length - 2]);
            const b = suma(conPresupuesto[conPresupuesto.length - 1]);
            variacion = a === b
                ? 'IGUALES (' + a.toFixed(2) + '): el presupuesto no se mueve entre esos dos meses'
                : a.toFixed(2) + ' -> ' + b.toFixed(2);
        }

        PropertiesService.getDocumentProperties().setProperty(PB_PROP_SELLO, sello);

        const detalle = 'PRESUPUESTO BASE CARGADO\n\n' +
            '- Filas escritas y verificadas: ' + matriz.length + '\n' +
            '- Meses con presupuesto: ' + conPresupuesto.length + ' de ' + plan.length + '\n' +
            '- Cada mes promedia los ' + PB_MESES_VENTANA + ' meses anteriores a el\n' +
            '- Ultimos dos meses: ' + variacion + '\n\n' +
            'QUE MIRAR EN EL TABLERO:\n' +
            '  1. "Presupuesto Asignado" (N9:N11) deja de dar cero.\n' +
            '  2. CAMBIA al cambiar el mes en N2: cada mes tiene su propio promedio.\n' +
            '  3. El % de cada fila ya significa algo: cuanto se despego ese mes de lo que venias\n' +
            '     gastando ANTES de ese mes.\n' +
            '  4. "Disponibilidad de fondos" (O23:O25) ya puede repartir contra algo.\n\n' +
            'Es un PUNTO DE PARTIDA, no una decision: las filas estan en "' + pre.nombre + '" y se\n' +
            'editan como cualquier otra.\n\n' +
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
