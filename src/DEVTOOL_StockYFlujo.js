/**
 * DEVTOOL_StockYFlujo.js
 * Separa STOCK de FLUJO en el Tablero y en Inicio, y cierra el bloque "Movimientos del Mes"
 * con el termino que le faltaba.
 *
 * [CONCEPTO DE NEGOCIO]
 * Un saldo y un movimiento son cosas distintas y la planilla las calculaba igual: filtradas por
 * mes. Por eso hacia falta cargar un "Inicio Mes" todos los meses -- un asiento que reescribe el
 * saldo de apertura de cada medio -- para que los saldos dieran bien. Ese arrastre es la causa
 * de la mitad de los problemas del Tablero.
 *
 * A partir de aca:
 *   FLUJO  (que paso este mes)  -> se filtra por mes. Ingresos, gastos, capitalizacion.
 *   STOCK  (cuanto tengo hoy)   -> NO se filtra por nada. Lee el ledger entero, siempre.
 *
 * Es la distincion entre un estado de resultados y un balance. Mezclarlas es lo que estaba roto.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * decision Franco 2026-08-19. Los saldos pasan a ser independientes del filtro mensual y los
 * asientos 'Inicio Mes' dejan de tener efecto en toda la planilla. NO se borran: quedan en el
 * ledger como historia, pero ninguna formula los mira. La conciliacion mensual contra el banco
 * sigue existiendo como control; lo que cambia es que solo se carga algo CUANDO HAY DIFERENCIA,
 * y ese algo es un movimiento de cuenta 'Ajuste' por la diferencia -- mecanismo que ya existe en
 * el ledger, con 70 filas.
 *
 * ============================================================================
 * POR QUE EL ARRASTRE ROMPIA LAS CUENTAS
 * ============================================================================
 * 'Inicio Mes' hacia DOS trabajos a la vez: era el saldo de apertura (redundante con la suma de
 * los movimientos que lo originaron) y era el ajuste de conciliacion (legitimo). Como el arrastre
 * ES el saldo anterior, sumar el historico lo cuenta dos veces, y se infla mas cuantos mas meses
 * hay. Medido sobre el ledger: los 165 arrastres suman $10.153.852 contra $884.860 de saldo real.
 * Casos limpios: "Frascos Naranja X" mostraba $1.465.839 y su saldo real es $0,00.
 *
 * Ademas los arrastres no tienen Tipo de Cuenta, asi que obligaban a la clausula especial
 * "(Col1 <> 'Inicio Mes' OR Col5 = 'Hogar')" en seis formulas distintas -- una regla que dejaba
 * entrar los arrastres de medios de casa al bucket de INGRESOS, inflando el ingreso del mes con
 * plata que no era ingreso de nada.
 *
 * ============================================================================
 * EL TERMINO QUE FALTABA EN "Movimientos del Mes"
 * ============================================================================
 * El bloque mostraba Ingresos / Gastos Fijos / Gastos Variables / Capitalizacion y los
 * porcentajes nunca cerraban en 100%. No era un error de formula: faltaba un termino.
 *
 * La identidad contable es    Ingresos - Gastos = variacion del patrimonio
 * y el patrimonio tiene dos mitades: los vehiculos de riqueza y las cuentas de todos los dias.
 * Con solo la primera, el resto de la plata -- la que no gastaste pero tampoco moviste a un
 * plazo fijo -- no aparecia en ningun lado.
 *
 *   N16 Ingresos = N17 Gastos Fijos + N18 Gastos Variables + N19 Capitalizacion + N20 Flujo Cotidiano
 *
 * La fila 20 estaba libre y los rotulos del bloque de saldos (AF8 "Flujo", AG8 "Capital") ya
 * usaban ese vocabulario, asi que el nombre no es nuevo: es el que ya estaba.
 *
 * ============================================================================
 * LO QUE NO CIERRA, Y POR QUE SE MUESTRA EN VEZ DE DISIMULARSE
 * ============================================================================
 * Aun con la fila nueva el porcentaje no da 100% exacto, y la causa esta medida: 116 movimientos
 * no clasifican -- 36 sin medio, 70 de cuenta 'Ajuste' (que no esta en el Plan de Cuentas) y 10
 * sin cuenta. Son $3,6M que cambian saldos sin ser ingreso ni gasto de nada.
 *
 * Rellenar eso con una regla inventada seria exactamente el tipo de numero plausible y falso que
 * este proyecto viene sacando de la planilla. Asi que el desvio NO se disimula: se le pone un
 * nombre y una celda (L29). Cuando esos 116 movimientos se resuelvan, el indicador va a cero y
 * el bloque cierra en 100% solo.
 *
 * ============================================================================
 * QUE NO HACE
 * ============================================================================
 * 1. NO borra ni edita una sola fila del ledger. Los 'Inicio Mes' quedan donde estan; lo que
 *    cambia es que ninguna formula los mira. Es reversible sin perder datos.
 * 2. NO unifica los medios escritos con typo ni completa los medios faltantes. Son escrituras
 *    sobre datos de Franco y van por su propia pasada, con su propio respaldo.
 * 3. NO toca el bloque "Disponibilidad de fondos" ni la comprobacion de traspasos.
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoStockYFlujo()    -> solo lectura. Se corre PRIMERO.
 *   aplicarStockYFlujo()   -> preflight + respaldo verificado + escritura + relectura del VALOR.
 *   revertirStockYFlujo()  -> restaura desde el respaldo de la ultima corrida.
 *
 * Reusa tres helpers probados de DEVTOOL_FormulerioV0111.js: _respaldarFormulerio,
 * _leerRespaldoFormulerio y _errorDeCelda.
 *
 * @version 0.14.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 * @see docs/permanente/FUNCIONALIDADES.md
 */

// ============================================
// CONSTANTES
// ============================================

const SYF_PROP_APLICADO = 'stock_y_flujo_aplicado';
const SYF_PROP_RESPALDO = 'stock_y_flujo_respaldo';

/** La cuenta neutra cuyo efecto se apaga en toda la planilla. */
const SYF_ARRASTRE = 'Inicio Mes';

/** Bloque de saldos del Tablero: AE=moneda, AF=flujo cotidiano, AG=capital. */
const SYF_SALDOS_TABLERO = { colMoneda: 'AE', colFlujo: 'AF', colCapital: 'AG', filas: [9, 10, 11, 12] };

/** Bloque "Movimientos del Mes": la fila 20 estaba libre y es donde va el termino que faltaba. */
const SYF_FILA_NUEVA = 20;
const SYF_ROTULO_NUEVO = 'Flujo Cotidiano';
const SYF_CELDA_DIAGNOSTICO = 'L29';

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: reporta que cambiaria. @returns {{ok: boolean, detalle?: string, error?: string}} */
function estadoStockYFlujo() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightSyf(ss);
        const plan = _planSyf(ss, pre);

        const l = [];
        l.push('STOCK Y FLUJO - ESTADO (no se escribio ninguna celda)');
        l.push('');
        l.push('Que cambia conceptualmente:');
        l.push('  - Los SALDOS dejan de filtrarse por mes: pasan a leer el ledger entero y a mostrar');
        l.push('    siempre el saldo actual.');
        l.push('  - Los asientos "' + SYF_ARRASTRE + '" dejan de tener efecto en toda la planilla.');
        l.push('    NO se borran: quedan como historia, pero ninguna formula los mira.');
        l.push('  - El bloque "Movimientos del Mes" suma una fila: ' + SYF_ROTULO_NUEVO + ' (fila ' + SYF_FILA_NUEVA + ').');
        l.push('');
        l.push('Preflight: ' + pre.resumen);
        l.push('');

        if (!plan.cambios.length) {
            l.push('NADA QUE HACER: ya esta todo aplicado.');
            const t = l.join('\n');
            _mostrarSyf('Stock y flujo - estado', t);
            return { ok: true, detalle: t };
        }

        l.push('CAMBIOS PENDIENTES: ' + plan.cambios.length + ' celda(s)');
        l.push('');
        plan.cambios.forEach(function (c) {
            l.push('  ' + c.nombreHoja + '!' + c.celda + '  (' + c.nota + ')');
            l.push('      ' + c.resumen);
        });
        if (plan.avisos.length) {
            l.push('');
            l.push('Avisos:');
            plan.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarSyf('Stock y flujo - estado', t);
        logInfo('estadoStockYFlujo: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarSyf('Stock y flujo - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica. Respaldo verificado, escritura, y relectura del VALOR con reversion del lote. */
function aplicarStockYFlujo() {
    const escritas = [];
    let ss = null, yaRevertido = false, ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarStockYFlujo necesita UI (correr desde el menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightSyf(ss);
        const plan = _planSyf(ss, pre);

        if (!plan.cambios.length) {
            const t = 'Ya estaba aplicado: los saldos leen el ledger entero y el bloque de ' +
                'Movimientos del Mes ya tiene su fila de ' + SYF_ROTULO_NUEVO + '. No se escribio nada.';
            _mostrarSyf('Stock y flujo', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert(
            'Separar stock de flujo',
            'Se van a reescribir ' + plan.cambios.length + ' celda(s).\n\n' +
            'CAMBIAN NUMEROS QUE VENIS MIRANDO:\n' +
            '  - Los saldos dejan de depender del mes seleccionado y muestran el saldo ACTUAL.\n' +
            '  - Los asientos "' + SYF_ARRASTRE + '" dejan de contar en toda la planilla (no se borran).\n' +
            '  - Los Ingresos del mes BAJAN: hasta hoy incluian los arrastres de las cuentas de casa.\n\n' +
            'Ninguna fila del ledger se toca. Antes de escribir se congela un respaldo de todas las ' +
            'formulas de "Inicio" y "Tablero" y se verifica releyendolo.\n\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado por el operador. No se escribio ninguna celda.' };

        const sello = _selloSyf();
        const respaldo = _respaldarFormulerio(ss, sello);

        plan.cambios.forEach(function (c) {
            const rango = ss.getSheetByName(c.nombreHoja).getRange(c.celda);
            const errorPrevio = _errorDeCelda(rango);
            if (c.esValor) rango.setValue(c.valorNuevo);
            else rango.setFormula(c.formulaNueva);
            escritas.push({
                nombreHoja: c.nombreHoja, celda: c.celda, esValor: !!c.esValor,
                previa: c.formulaActual, previoValor: c.valorActual,
                nueva: c.esValor ? c.valorNuevo : c.formulaNueva, errorPrevio: errorPrevio
            });
        });
        SpreadsheetApp.flush();

        const fallas = _verificarEscrituraSyf(ss, escritas);
        if (fallas.length) {
            _revertirEscriturasSyf(ss, escritas);
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA al releer: ' + fallas.join('; ') +
                '. Se restauro cada celda. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(SYF_PROP_APLICADO, sello);
        props.setProperty(SYF_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'STOCK Y FLUJO APLICADO\n\n' +
            '- Celdas reescritas y verificadas: ' + escritas.length + '\n' +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- NO se toco ninguna fila del ledger\n\n' +
            'QUE MIRAR:\n' +
            '  1. "Tablero"!AF9 (saldo cotidiano ARS): tiene que dejar de cambiar cuando cambias\n' +
            '     el mes en N2. Es un saldo, no un movimiento.\n' +
            '  2. "Tablero"!N20: la fila nueva, ' + SYF_ROTULO_NUEVO + '.\n' +
            '  3. "Tablero"!O16: ahora suma cuatro filas. Lo que le falte para 100% esta explicado\n' +
            '     en ' + SYF_CELDA_DIAGNOSTICO + ': son los movimientos que no clasifican.\n' +
            '  4. "Tablero"!N16 (Ingresos) BAJA respecto de antes. Es correcto: ya no cuenta los\n' +
            '     arrastres de "' + SYF_ARRASTRE + '" como si fueran ingresos del mes.\n\n' +
            'Si algo quedo peor: Tidetrack Dev > Stock y flujo > 3. Revertir.';

        logSuccess('aplicarStockYFlujo: ' + escritas.length + ' celda(s).');
        _mostrarSyf('Stock y flujo - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try { _revertirEscriturasSyf(ss, escritas); restaurado = ' Se restauraron las ' + escritas.length + ' celda(s) ya escritas.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + '): revisar el respaldo a mano.'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack, escritas: escritas.length });
        _mostrarSyf('Stock y flujo - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Restaura desde el respaldo de la ultima corrida. */
function revertirStockYFlujo() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'revertirStockYFlujo necesita UI.' }; }
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const nombre = props.getProperty(SYF_PROP_RESPALDO);
        if (!nombre) throw new Error('No hay corrida registrada, asi que no hay respaldo al que volver.');
        const hoja = ss.getSheetByName(nombre);
        if (!hoja) throw new Error('El respaldo "' + nombre + '" ya no existe.');
        const filas = _leerRespaldoFormulerio(hoja);
        if (!filas.length) throw new Error('El respaldo "' + nombre + '" esta vacio.');

        const conf = ui.alert('Revertir stock y flujo',
            'Se restauran ' + filas.length + ' formula(s) desde "' + nombre + '".\n\n' +
            'Los saldos vuelven a depender del mes seleccionado y los arrastres "' + SYF_ARRASTRE +
            '" vuelven a contar.\n\nOJO: la fila ' + SYF_FILA_NUEVA + ' y ' + SYF_CELDA_DIAGNOSTICO +
            ' no estaban en el respaldo porque antes estaban vacias; hay que borrarlas a mano si ' +
            'se quiere volver del todo.\n\nContinuar?', ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se restauro nada.' };

        let n = 0;
        filas.forEach(function (f) {
            const h = ss.getSheetByName(f.nombreHoja);
            if (!h) return;
            h.getRange(f.celda).setFormula(f.formula);
            n++;
        });
        SpreadsheetApp.flush();
        props.deleteProperty(SYF_PROP_APLICADO);
        const t = 'REVERTIDO\n\n- Formulas restauradas: ' + n + ' de ' + filas.length +
            '\n- Respaldo usado: "' + nombre + '" (se conserva)';
        logSuccess('revertirStockYFlujo: ' + n + ' formula(s).');
        _mostrarSyf('Stock y flujo - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarSyf('Stock y flujo - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PREFLIGHT
// ============================================

function _preflightSyf(ss) {
    const nombreInicio = NAV_CONFIG.SHEETS.INICIO;
    const nombreTablero = NAV_CONFIG.SHEETS.TABLERO;
    const hojaInicio = ss.getSheetByName(nombreInicio);
    const hojaTablero = ss.getSheetByName(nombreTablero);
    if (!hojaInicio) throw new Error('No existe la hoja "' + nombreInicio + '".');
    if (!hojaTablero) throw new Error('No existe la hoja "' + nombreTablero + '".');

    const cfg = RANGES.REGISTROS;
    const hojaReg = ss.getSheetByName(cfg.sheet);
    if (!hojaReg) throw new Error('No existe el ledger "' + cfg.sheet + '".');

    // El header del ledger tiene que ser el que las formulas nuevas asumen: se verifica columna
    // por columna contra RANGES en vez de darlo por sabido (un mapeo supuesto ya costo caro).
    const desvios = [];
    ['monto', 'tipo', 'cuenta', 'tipo_cuenta', 'medio', 'moneda'].forEach(function (clave) {
        const letra = cfg.columns[clave];
        if (!letra) { desvios.push('RANGES.REGISTROS no declara la columna "' + clave + '"'); return; }
        const idx = columnLetterToIndex(letra);
        if (idx > hojaReg.getMaxColumns()) { desvios.push('la columna ' + letra + ' no existe en el ledger'); return; }
        const rot = String(hojaReg.getRange(cfg.headerRow, idx).getValue() || '').trim();
        if (!rot) desvios.push('el header ' + letra + cfg.headerRow + ' del ledger esta vacio');
    });
    if (desvios.length) {
        throw new Error('El ledger no tiene la forma que las formulas nuevas necesitan: ' +
            desvios.join('; ') + '. No se escribe nada.');
    }

    // La fila donde va el termino nuevo tiene que estar LIBRE.
    const ocupada = [];
    ['L', 'M', 'N', 'O'].forEach(function (c) {
        const r = hojaTablero.getRange(c + SYF_FILA_NUEVA);
        if (String(r.getValue() || '').trim() !== '' || r.getFormula()) ocupada.push(c + SYF_FILA_NUEVA);
    });
    const filaLibre = !ocupada.length;

    // La celda del diagnostico tambien.
    const rd = hojaTablero.getRange(SYF_CELDA_DIAGNOSTICO);
    const diagLibre = String(rd.getValue() || '').trim() === '' && !rd.getFormula();

    // Los rotulos del bloque de saldos: AF8 "Flujo", AG8 "Capital".
    const s = SYF_SALDOS_TABLERO;
    const rotFlujo = String(hojaTablero.getRange(s.colFlujo + '8').getValue() || '').trim();
    const rotCap = String(hojaTablero.getRange(s.colCapital + '8').getValue() || '').trim();
    if (_normalizarRotulo(rotFlujo) !== 'flujo' || _normalizarRotulo(rotCap) !== 'capital') {
        throw new Error('Los rotulos del bloque de saldos no son los esperados: ' + s.colFlujo +
            '8 dice "' + rotFlujo + '" y ' + s.colCapital + '8 dice "' + rotCap +
            '" (se esperaba "Flujo" y "Capital"). Reescribir esas columnas sobre otro bloque ' +
            'seria escribir en el lugar equivocado.');
    }
    // Y las monedas de AE9:AE12 tienen que ser las del sistema.
    const monedas = [];
    s.filas.forEach(function (f) {
        monedas.push(String(hojaTablero.getRange(s.colMoneda + f).getValue() || '').trim());
    });
    const monedasMal = monedas.filter(function (m) { return MONEDAS_DISPONIBLES.indexOf(m) === -1; });
    if (monedasMal.length) {
        throw new Error('El bloque de saldos rotula monedas desconocidas en ' + s.colMoneda +
            s.filas[0] + ':' + s.colMoneda + s.filas[s.filas.length - 1] + ': ' + monedas.join(', ') + '.');
    }

    return {
        nombreInicio: nombreInicio, nombreTablero: nombreTablero,
        filaLibre: filaLibre, ocupada: ocupada, diagLibre: diagLibre, monedas: monedas,
        resumen: 'ledger "' + cfg.sheet + '" con header en la fila ' + cfg.headerRow +
            '; bloque de saldos rotulado ' + monedas.join('/') +
            '; fila ' + SYF_FILA_NUEVA + (filaLibre ? ' libre' : ' OCUPADA (' + ocupada.join(', ') + ')')
    };
}

// ============================================
// FORMULAS
// ============================================

/**
 * Condicion sobre el tipo de categoria del medio, derivada de TIPOS_RIQUEZA.
 * @param {boolean} esRiqueza true -> "es un vehiculo de riqueza"; false -> su complemento
 */
function _condTipoSyf(esRiqueza, variable) {
    if (esRiqueza) {
        return '(' + TIPOS_RIQUEZA.map(function (t) { return '(' + variable + '="' + t + '")'; }).join(' + ') + ') > 0';
    }
    return TIPOS_RIQUEZA.map(function (t) { return '(' + variable + '<>"' + t + '")'; }).join(' * ') + ' > 0';
}

/** Referencia abierta a una columna del ledger, desde RANGES (regla SSOT). */
function _colLedger(clave) {
    const cfg = RANGES.REGISTROS;
    const l = cfg.columns[clave];
    return "'" + cfg.sheet + "'!" + l + cfg.dataRow + ':' + l;
}

/**
 * Preambulo LET compartido: lee el ledger entero y deja listas las variables de clasificacion.
 * Todas las formulas de STOCK arrancan con esto, asi que hay un solo lugar donde equivocarse.
 */
function _preambuloLedgerSyf() {
    const pc = RANGES.PROYECTOS;
    const medios = RANGES.MEDIOS_PAGO;
    const colCatMedio = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;
    const colTipoCat = columnLetterToIndex(pc.columns.tipo) - columnLetterToIndex(pc.start) + 1;
    return [
        '  monto; ' + _colLedger('monto') + ';',
        '  clase; ' + _colLedger('tipo') + ';',
        '  cuenta; ' + _colLedger('cuenta') + ';',
        '  medio; ' + _colLedger('medio') + ';',
        '  moneda; ' + _colLedger('moneda') + ';',
        '  neto; ARRAYFORMULA(IF(clase="Egreso"; -monto; monto));',
        "  categoria; ARRAYFORMULA(IFERROR(VLOOKUP(medio; '" + medios.sheet + "'!" + medios.start + ':' + medios.end + '; ' + colCatMedio + '; 0); ""));',
        "  tipo_cat; ARRAYFORMULA(IFERROR(VLOOKUP(categoria; '" + pc.sheet + "'!" + pc.start + ':' + pc.end + '; ' + colTipoCat + '; 0); ""));',
        '  vigente; ARRAYFORMULA(cuenta<>"' + SYF_ARRASTRE + '");'
    ].join('\n');
}

/** Saldo por moneda, sobre TODO el ledger. `celdaMoneda` trae el rotulo de la moneda (AE9..AE12). */
function _formulaSaldoPorMoneda(esRiqueza, celdaMoneda) {
    return '=LET(\n' + _preambuloLedgerSyf() + '\n' +
        '  grupo; ARRAYFORMULA(' + _condTipoSyf(esRiqueza, 'tipo_cat') + ');\n' +
        '  SUM(IFERROR(FILTER(neto; moneda=' + celdaMoneda + '; vigente; grupo); 0))\n)';
}

/** Saldo total convertido a la moneda del selector, sobre TODO el ledger. */
function _formulaSaldoConvertido(esRiqueza, celdaSelector) {
    return '=LET(\n' + _preambuloLedgerSyf() + '\n' +
        '  grupo; ARRAYFORMULA(' + _condTipoSyf(esRiqueza, 'tipo_cat') + ');\n' +
        '  suma_ars; SUM(IFERROR(FILTER(neto; moneda="ARS"; vigente; grupo); 0));\n' +
        '  suma_usd; SUM(IFERROR(FILTER(neto; moneda="USD"; vigente; grupo); 0));\n' +
        '  suma_aud; SUM(IFERROR(FILTER(neto; moneda="AUD"; vigente; grupo); 0));\n' +
        '  suma_eur; SUM(IFERROR(FILTER(neto; moneda="EUR"; vigente; grupo); 0));\n' +
        '  total_ars; suma_ars + (suma_usd * TIDETRACK_USD()) + (suma_aud * TIDETRACK_AUD()) + (suma_eur * TIDETRACK_EUR());\n' +
        '  tasa_destino; IFERROR(SWITCH(' + celdaSelector + '; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n' +
        '  total_ars / tasa_destino\n)';
}

/**
 * Flujo Cotidiano del mes: la variacion neta de las cuentas de todos los dias.
 * Es el hermano de N19 (Capacidad de Capitalizacion) y el termino que le faltaba al bloque.
 * Se apoya en el motor del Tablero, que ya esta filtrado por el mes seleccionado.
 */
function _formulaFlujoCotidianoMes() {
    const pc = RANGES.PROYECTOS;
    const medios = RANGES.MEDIOS_PAGO;
    const colCatMedio = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;
    const colTipoCat = columnLetterToIndex(pc.columns.tipo) - columnLetterToIndex(pc.start) + 1;
    const f = FORM_FILA_DERRAME_TABLERO;
    return '=LET(\n' +
        '  monto_neto; ARRAYFORMULA(IF(AK' + f + ':AK="Egreso"; -AJ' + f + ':AJ; AJ' + f + ':AJ));\n' +
        '  vigente; ARRAYFORMULA(AL' + f + ':AL<>"' + SYF_ARRASTRE + '");\n' +
        "  categoria; ARRAYFORMULA(IFERROR(VLOOKUP(AN" + f + ":AN; '" + medios.sheet + "'!" + medios.start + ':' + medios.end + '; ' + colCatMedio + '; 0); ""));\n' +
        "  tipo_cat; ARRAYFORMULA(IFERROR(VLOOKUP(categoria; '" + pc.sheet + "'!" + pc.start + ':' + pc.end + '; ' + colTipoCat + '; 0); ""));\n' +
        '  cotidiano; ARRAYFORMULA((categoria<>"") * (' + _condTipoSyf(false, 'tipo_cat') + '));\n' +
        '  suma_ars; SUM(IFERROR(FILTER(monto_neto; AO' + f + ':AO="ARS"; vigente; cotidiano); 0));\n' +
        '  suma_usd; SUM(IFERROR(FILTER(monto_neto; AO' + f + ':AO="USD"; vigente; cotidiano); 0));\n' +
        '  suma_aud; SUM(IFERROR(FILTER(monto_neto; AO' + f + ':AO="AUD"; vigente; cotidiano); 0));\n' +
        '  suma_eur; SUM(IFERROR(FILTER(monto_neto; AO' + f + ':AO="EUR"; vigente; cotidiano); 0));\n' +
        '  total_ars; suma_ars + (suma_usd * $AF$17) + (suma_aud * $AF$18) + (suma_eur * $AF$19);\n' +
        '  tasa_cambio; IFERROR(SWITCH($N$4; "ARS"; 1; "USD"; $AF$17; "AUD"; $AF$18; "EUR"; $AF$19); 1);\n' +
        '  total_ars / tasa_cambio\n)';
}

/**
 * El indicador que le pone nombre al desvio: cuantos movimientos del mes no clasifican.
 * Sin esto, un O16 en 96% vuelve a ser un misterio -- que es justo lo que veniamos sacando.
 */
function _formulaDiagnosticoSyf() {
    const medios = RANGES.MEDIOS_PAGO;
    const colCatMedio = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;
    const f = FORM_FILA_DERRAME_TABLERO;
    return '=LET(\n' +
        '  monto_neto; ARRAYFORMULA(IF(AK' + f + ':AK="Egreso"; -AJ' + f + ':AJ; AJ' + f + ':AJ));\n' +
        '  vigente; ARRAYFORMULA(AL' + f + ':AL<>"' + SYF_ARRASTRE + '");\n' +
        "  categoria; ARRAYFORMULA(IFERROR(VLOOKUP(AN" + f + ":AN; '" + medios.sheet + "'!" + medios.start + ':' + medios.end + '; ' + colCatMedio + '; 0); ""));\n' +
        '  sin_clasificar; ARRAYFORMULA((AJ' + f + ':AJ<>"") * (categoria=""));\n' +
        '  n; SUM(IFERROR(FILTER(ARRAYFORMULA(SIGN(ABS(monto_neto))); vigente; sin_clasificar); 0));\n' +
        '  m; SUM(IFERROR(FILTER(monto_neto; vigente; sin_clasificar); 0));\n' +
        '  IF(n = 0;\n' +
        '    "Todos los movimientos del mes clasifican.";\n' +
        '    "Sin clasificar: " & TEXT(n; "0") & " movimiento(s) por " & TEXT(m; "$ #.##0,00") & " (sin medio o con un medio que no esta en el Plan de Cuentas). Es lo que le falta al 100%."\n' +
        '  )\n)';
}

// ============================================
// PLAN
// ============================================

function _planSyf(ss, pre) {
    const cambios = [];
    const avisos = [];
    const s = SYF_SALDOS_TABLERO;
    const hojaT = ss.getSheetByName(pre.nombreTablero);
    const hojaI = ss.getSheetByName(pre.nombreInicio);

    function proponer(nombreHoja, celda, nota, nueva, resumen) {
        const actual = ss.getSheetByName(nombreHoja).getRange(celda).getFormula();
        if (_normalizarFormula(actual) === _normalizarFormula(nueva)) return;
        cambios.push({
            nombreHoja: nombreHoja, celda: celda, nota: nota,
            formulaActual: actual, formulaNueva: nueva, resumen: resumen
        });
    }

    // --- STOCKS: saldos por moneda, sobre todo el ledger ---
    s.filas.forEach(function (fila, i) {
        const celdaMon = s.colMoneda + fila;
        proponer(pre.nombreTablero, s.colFlujo + fila, 'Saldo cotidiano ' + pre.monedas[i],
            _formulaSaldoPorMoneda(false, celdaMon),
            'pasa a leer el ledger entero (deja de depender del mes) y a ignorar los "' + SYF_ARRASTRE + '"');
        proponer(pre.nombreTablero, s.colCapital + fila, 'Capital ' + pre.monedas[i],
            _formulaSaldoPorMoneda(true, celdaMon),
            'idem, con la lista blanca de riqueza (' + TIPOS_RIQUEZA.join(' + ') + ')');
    });

    // --- STOCKS de Inicio ---
    proponer(pre.nombreInicio, 'C8', 'Saldo cotidiano (Inicio)',
        _formulaSaldoConvertido(false, '$G$4'),
        'saldo actual de las cuentas cotidianas, todo el ledger, convertido a la moneda de G4');
    proponer(pre.nombreInicio, 'F8', 'Capital Acumulado (Inicio)',
        _formulaSaldoConvertido(true, '$G$4'),
        'capital acumulado real: todo el ledger, sin arrastres, lista blanca de riqueza');

    // --- FLUJO: el termino que faltaba ---
    if (!pre.filaLibre) {
        avisos.push('NO se agrega la fila ' + SYF_FILA_NUEVA + ' (' + SYF_ROTULO_NUEVO + '): las celdas ' +
            pre.ocupada.join(', ') + ' tienen contenido. Sin esa fila, el bloque no puede cerrar en 100%.');
    } else {
        const rotuloActual = String(hojaT.getRange('L' + SYF_FILA_NUEVA).getValue() || '').trim();
        if (rotuloActual !== SYF_ROTULO_NUEVO) {
            cambios.push({
                nombreHoja: pre.nombreTablero, celda: 'L' + SYF_FILA_NUEVA, nota: 'Rotulo de la fila nueva',
                esValor: true, valorActual: rotuloActual, valorNuevo: SYF_ROTULO_NUEVO,
                formulaActual: '', formulaNueva: '',
                resumen: 'rotulo "' + SYF_ROTULO_NUEVO + '" (el vocabulario ya existe: AF8 dice "Flujo")'
            });
        }
        proponer(pre.nombreTablero, 'N' + SYF_FILA_NUEVA, SYF_ROTULO_NUEVO,
            _formulaFlujoCotidianoMes(),
            'variacion neta de las cuentas cotidianas en el mes: el termino que le faltaba al bloque');
        proponer(pre.nombreTablero, 'O' + SYF_FILA_NUEVA, '% del ' + SYF_ROTULO_NUEVO,
            '=IFERROR(N' + SYF_FILA_NUEVA + '/$N$16;0)', 'porcentaje sobre los ingresos del mes');
        proponer(pre.nombreTablero, 'O16', 'Total del bloque',
            '=SUM(O17:O' + SYF_FILA_NUEVA + ')', 'pasa a sumar las CUATRO filas, no tres');
    }

    // --- El diagnostico que le pone nombre al desvio ---
    if (!pre.diagLibre) {
        avisos.push('NO se escribe el indicador de movimientos sin clasificar: ' + SYF_CELDA_DIAGNOSTICO +
            ' tiene contenido.');
    } else {
        proponer(pre.nombreTablero, SYF_CELDA_DIAGNOSTICO, 'Movimientos sin clasificar',
            _formulaDiagnosticoSyf(), 'le pone nombre y numero a lo que le falta al 100%');
    }

    // --- FLUJOS: apagar la clausula especial del arrastre ---
    [[pre.nombreTablero, 'R9', 'Ingresos por cuenta'],
     [pre.nombreTablero, 'U9', 'Gastos fijos por cuenta'],
     [pre.nombreTablero, 'X9', 'Gastos variables por cuenta'],
     [pre.nombreInicio, 'C13', 'Ingresos del mes'],
     [pre.nombreInicio, 'F13', 'Egresos del mes'],
     [pre.nombreInicio, 'C15', 'Delta ingresos vs mes anterior'],
     [pre.nombreInicio, 'F15', 'Delta egresos vs mes anterior']].forEach(function (t) {
        const actual = ss.getSheetByName(t[0]).getRange(t[1]).getFormula();
        if (!actual) { avisos.push(t[0] + '!' + t[1] + ' no tiene formula: se saltea.'); return; }
        const nueva = _apagarArrastreSyf(actual);
        if (nueva === actual) return;
        cambios.push({
            nombreHoja: t[0], celda: t[1], nota: t[2],
            formulaActual: actual, formulaNueva: nueva,
            resumen: 'los "' + SYF_ARRASTRE + '" dejan de contar como ingreso del mes'
        });
    });

    return { cambios: cambios, avisos: avisos };
}

/**
 * Apaga la clausula que dejaba entrar los arrastres cuando el medio era de casa.
 * Dos formas de la misma regla: dentro de un QUERY y dentro de un LET.
 * Reemplazo por FUNCION, nunca por string (leccion de la v0.12.0).
 */
function _apagarArrastreSyf(formula) {
    let out = formula;
    // QUERY:  (Col1 != 'Inicio Mes' OR Col5 = 'Hogar')   ->   Col1 != 'Inicio Mes'
    out = out.replace(
        /\(\s*Col1\s*!=\s*'Inicio Mes'\s*OR\s*Col5\s*=\s*'[^']*'\s*\)/g,
        function () { return "Col1 != 'Inicio Mes'"; }
    );
    // LET:  (cuenta_xxx <> "Inicio Mes") + (tipo_proy_xxx = "Hogar") > 0  ->  cuenta_xxx <> "Inicio Mes"
    out = out.replace(
        /\(\s*(cuenta_\w+)\s*<>\s*"Inicio Mes"\s*\)\s*\+\s*\(\s*tipo_proy_\w+\s*=\s*"[^"]*"\s*\)\s*>\s*0/g,
        function (m, v) { return v + ' <> "Inicio Mes"'; }
    );
    return out;
}

// ============================================
// VERIFICACION
// ============================================

function _verificarEscrituraSyf(ss, escritas) {
    const fallas = [];
    escritas.forEach(function (w) {
        const rango = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
        const ref = w.nombreHoja + '!' + w.celda;
        if (w.esValor) {
            if (String(rango.getValue() || '').trim() !== String(w.nueva).trim()) {
                fallas.push(ref + ' no quedo con el valor escrito');
            }
            return;
        }
        const leida = rango.getFormula();
        if (!leida) { fallas.push(ref + ' quedo SIN formula'); return; }
        if (_normalizarFormula(leida) !== _normalizarFormula(w.nueva)) {
            fallas.push(ref + ' no coincide con lo que se le escribio');
            return;
        }
        if (leida.indexOf('#REF!') !== -1) fallas.push(ref + ' quedo con un #REF!');
        const err = _errorDeCelda(rango);
        if (err) {
            fallas.push(ref + ' quedo en ' + err +
                (w.errorPrevio ? ' (ya estaba en ' + w.errorPrevio + ')' : ' (ANTES CALCULABA BIEN: la rompio esta corrida)'));
        }
    });
    return fallas;
}

function _revertirEscriturasSyf(ss, escritas) {
    escritas.forEach(function (w) {
        try {
            const r = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
            if (w.esValor) r.setValue(w.previoValor === undefined ? '' : w.previoValor);
            else r.setFormula(w.previa);
        } catch (e) {
            logError('No se pudo restaurar ' + w.nombreHoja + '!' + w.celda + ': ' + e.message);
        }
    });
    SpreadsheetApp.flush();
}

// ============================================
// AUXILIARES
// ============================================

function _selloSyf() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

function _mostrarSyf(titulo, mensaje) {
    try {
        SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        Logger.log(titulo + '\n' + mensaje);
    }
}
