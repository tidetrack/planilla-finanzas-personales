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

/**
 * decision Franco 2026-08-19 (segunda vuelta): NO va una quinta fila. "Lo de Flujo cotidiano
 * esta de mas. No es una categoria definida. Todo se debe repartir en fijos, variables y
 * capitalizacion."
 *
 * Con tres buckets la identidad se cierra de la unica forma posible: la CAPITALIZACION pasa a
 * ser el RESIDUO. Capitalizacion = Ingresos - Gastos Fijos - Gastos Variables. Deja de medirse
 * sumando movimientos hacia vehiculos de ahorro y pasa a ser "lo que no gastaste", que es la
 * definicion que Franco quiere leer: si no se fue en gastos, se capitalizo -- este en un plazo
 * fijo o durmiendo en la caja de ahorro.
 *
 * Como es una resta, O16 da 100% SIEMPRE y por construccion. Eso quita un indicador (el
 * porcentaje deja de avisar si algo no cuadra) y por eso el diagnostico de L29 se vuelve mas
 * importante, no menos: es el unico lugar donde queda visible lo que no clasifica.
 */
const SYF_FILA_RESIDUO = 19;

/**
 * Bloque "Medios Bancarios." del Tablero, medido en vivo el 2026-08-19.
 *
 * ESTA HECHO DE CELDAS COMBINADAS, y eso decide como hay que escribirlo:
 *   C17:E17 = "Medio"   F17:G17 = "Moneda"   H17:I17 = "Monto"
 * Cada fila de datos es igual: C18:E18, F18:G18, H18:I18.
 *
 * Una formula que devuelve tres columnas NO PUEDE derramar ahi. La v0.16.0 escribio una sola
 * formula de 3 columnas en C18 y Sheets derramo unicamente la PRIMERA -- los nombres -- fila por
 * fila hacia abajo. Las columnas Moneda y Monto que Franco ve (F:G y H:I) quedaron con los
 * valores estaticos viejos. Resultado: medios nuevos con montos viejos al lado, que es peor que
 * no haber hecho nada, porque parece que anduvo.
 *
 * Por eso van TRES formulas de una columna cada una, ancladas en el primer cuadro de cada
 * cabecera. Las tres derivan de la MISMA matriz ordenada y toman su columna con INDEX, asi que
 * las filas se corresponden siempre, incluso ante empates de saldo.
 */
const SYF_BLOQUE_MEDIOS = {
    filaHeader: 17,
    filaDatos: 18,
    // decision Franco 2026-08-19: el bloque termina en la fila 29, no mas abajo. Marca dos
    // limites a la vez y los dos importan:
    //   - hasta donde se LIMPIA antes de escribir (un derrame no se expande si tiene que pisar
    //     algo, y ese fue el #REF! de F18/H18). Limpiar de mas pisaria lo que haya debajo del
    //     bloque, que no es nuestro.
    //   - cuantas filas puede ocupar el resultado. El derrame se acota con ARRAY_CONSTRAIN a
    //     filaFin - filaDatos + 1 = 12 medios. Si algun dia hubiera mas medios con saldo que
    //     filas, se muestran los 12 mayores en vez de romper el diseno de la hoja.
    filaFin: 29,
    colIni: 'C',
    colFin: 'I',
    columnas: [
        { col: 'C', rotulo: 'Medio', indice: 1 },
        { col: 'F', rotulo: 'Moneda', indice: 2 },
        { col: 'H', rotulo: 'Monto', indice: 3 }
    ]
};

/**
 * Candidatas para el indicador de movimientos sin clasificar, en orden de preferencia.
 * L29 quedo descartada: es parte del merge L28:O29 que contiene la comprobacion de traspasos,
 * asi que escribir ahi no muestra nada (y en el peor caso pisa el control de traspasos).
 */
const SYF_CANDIDATAS_DIAGNOSTICO = ['L31', 'L32', 'L33', 'C34', 'C35'];

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
        l.push('  - La Capacidad de Capitalizacion pasa a ser el RESIDUO: los tres buckets');
        l.push('    (fijos, variables, capitalizacion) reparten el 100% del ingreso.');
        l.push('  - El bloque "Medios Bancarios" pasa a mostrar el SALDO ACTUAL de cada cuenta,');
        l.push('    solo las que tienen saldo, de mayor a menor.');
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
    let ss = null, yaRevertido = false, ui = null, fotoBloque = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarStockYFlujo necesita UI (correr desde el menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightSyf(ss);
        const plan = _planSyf(ss, pre);

        if (!plan.cambios.length) {
            const t = 'Ya estaba aplicado: los saldos leen el ledger entero y la capitalizacion ' +
                'es el residuo de los otros dos buckets. No se escribio nada.';
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

        // El respaldo de formulas NO alcanza para este bloque: lo que hay que quitar de en medio
        // son VALORES estaticos, y un respaldo que solo guarda formulas los perderia sin red.
        // Se fotografia el area completa -- valores y formulas -- antes de limpiarla.
        if (plan.limpiarBloqueMedios) {
            fotoBloque = _fotografiarBloqueMedios(ss, pre.nombreTablero);
            _limpiarBloqueMedios(ss, pre.nombreTablero);
            SpreadsheetApp.flush();
        }

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
            if (fotoBloque) _restaurarBloqueMedios(ss, pre.nombreTablero, fotoBloque);
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
            '  2. El bloque "Medios Bancarios" (C17:I31): las TRES columnas -- Medio, Moneda y\n' +
            '     Monto -- tienen que corresponderse fila por fila. Si el nombre no coincide con\n' +
            '     el monto de al lado, avisar: es el defecto que tuvo la v0.16.0.\n' +
            '  3. "Tablero"!O16 tiene que dar 100%: la capitalizacion es el residuo.\n' +
            '  4. "Tablero"!N16 (Ingresos) BAJA respecto de antes. Es correcto: ya no cuenta los\n' +
            '     arrastres de "' + SYF_ARRASTRE + '" como si fueran ingresos del mes.\n\n' +
            'Si algo quedo peor: Tidetrack Dev > Stock y flujo > 3. Revertir.';

        logSuccess('aplicarStockYFlujo: ' + escritas.length + ' celda(s).');
        _mostrarSyf('Stock y flujo - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && (escritas.length || fotoBloque) && !yaRevertido) {
            try {
                _revertirEscriturasSyf(ss, escritas);
                if (fotoBloque) _restaurarBloqueMedios(ss, NAV_CONFIG.SHEETS.TABLERO, fotoBloque);
                restaurado = ' Se restauraron las ' + escritas.length + ' celda(s) ya escritas y el bloque de medios.';
            }
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
            '" vuelven a contar.\n\nOJO: la celda del indicador de movimientos sin clasificar no ' +
            'estaba en el respaldo porque antes estaba vacia; hay que borrarla a mano si se ' +
            'quiere volver del todo.\n\nContinuar?', ui.ButtonSet.YES_NO);
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

    // La celda del diagnostico tambien. Y ademas NO puede estar combinada: una celda que es
    // parte de un merge sin ser su ancla se lee vacia y se deja escribir sin protestar, pero lo
    // escrito no queda. Se veria igual que "quedo sin formula".
    // Se busca la primera candidata que este LIBRE y que NO sea parte de una celda combinada.
    // L29 fallo por lo segundo: es parte del merge L28:O29 de la comprobacion de traspasos, asi
    // que lo escrito ahi no se muestra -- se veria igual que "no paso nada".
    let celdaDiag = '';
    for (let i = 0; i < SYF_CANDIDATAS_DIAGNOSTICO.length; i++) {
        const r = hojaTablero.getRange(SYF_CANDIDATAS_DIAGNOSTICO[i]);
        let comb = false;
        try { comb = r.isPartOfMerge(); } catch (e) { comb = false; }
        if (!comb && String(r.getValue() || '').trim() === '' && !r.getFormula()) {
            celdaDiag = SYF_CANDIDATAS_DIAGNOSTICO[i];
            break;
        }
    }
    const diagLibre = celdaDiag !== '';

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

    // El bloque de medios se verifica POR SUS ROTULOS antes de escribir. Es el guard que faltaba
    // en la v0.16.0: se escribio una formula de tres columnas sobre celdas combinadas y solo
    // entro la primera, dejando Moneda y Monto con datos viejos.
    const rotulosMal = [];
    SYF_BLOQUE_MEDIOS.columnas.forEach(function (c) {
        const vivo = String(hojaTablero.getRange(c.col + SYF_BLOQUE_MEDIOS.filaHeader).getValue() || '').trim();
        if (_normalizarRotulo(vivo) !== _normalizarRotulo(c.rotulo)) {
            rotulosMal.push(c.col + SYF_BLOQUE_MEDIOS.filaHeader + ' dice "' + vivo + '" y se esperaba "' + c.rotulo + '"');
        }
    });
    const bloqueMediosOk = !rotulosMal.length;
    const bloqueMediosMotivo = rotulosMal.join('; ');

    return {
        bloqueMediosOk: bloqueMediosOk, bloqueMediosMotivo: bloqueMediosMotivo,
        nombreInicio: nombreInicio, nombreTablero: nombreTablero,
        diagLibre: diagLibre, celdaDiag: celdaDiag, monedas: monedas,
        resumen: 'ledger "' + cfg.sheet + '" con header en la fila ' + cfg.headerRow +
            '; bloque de saldos rotulado ' + monedas.join('/')
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

/**
 * Nombre de hoja tal como Sheets lo GUARDA en una formula: entrecomillado solo si lo necesita.
 *
 * Leccion del 2026-08-19: escribi 'Registros'!B7:B y Sheets lo guarda como Registros!B7:B --
 * le saca las comillas porque el nombre no las precisa. La verificacion comparaba texto contra
 * texto, no coincidia, y revertia diez formulas correctas. En la planilla viva hay 256
 * referencias a Registros sin comillas y CERO con comillas: la evidencia estaba a la vista.
 * "Plan de Cuentas" si las lleva, porque tiene espacios.
 */
function _refHoja(nombre) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre) ? nombre : "'" + nombre + "'";
}

/** Referencia abierta a una columna del ledger, desde RANGES (regla SSOT). */
function _colLedger(clave) {
    const cfg = RANGES.REGISTROS;
    const l = cfg.columns[clave];
    return _refHoja(cfg.sheet) + '!' + l + cfg.dataRow + ':' + l;
}

/** Rango abierto de una columna del Plan de Cuentas. */
function _colPlan(cfg, clave) {
    const l = cfg.columns[clave];
    return _refHoja(cfg.sheet) + '!' + l + getDataRow(cfg) + ':' + l;
}

/**
 * PREAMBULO COMPARTIDO -- el corazon del modelo de saldo, y el unico lugar donde puede estar mal.
 *
 * ============================================================================
 * LA REGLA, Y POR QUE ES ESTA
 * ============================================================================
 * SALDO DE UN MEDIO = su ULTIMO asiento "Inicio Mes" + todos los movimientos posteriores.
 *
 * "Inicio Mes" NO es un movimiento: es el punto de corte de una CONCILIACION. Cuando Franco lo
 * carga esta diciendo "el banco dice que tengo esto", y con eso todo lo anterior queda saldado.
 * De ahi que las dos alternativas obvias fallen:
 *   - sumar todo el historico (incluidos los arrastres) DUPLICA: cada arrastre vuelve a contar
 *     el dinero que ya estaba en los movimientos que lo originaron. Da $8,7M contra $0,5M reales.
 *   - ignorar los arrastres (lo que hicieron v0.14 y v0.15) PIERDE EL SALDO DE APERTURA y deja
 *     nueve medios en negativo.
 * La regla del ultimo corte da CERO negativos.
 *
 * VALIDADA CONTRA VERDAD DE CAMPO el 2026-08-19: de siete saldos reales que dio Franco, CINCO
 * coinciden AL CENTAVO -- Frascos Nx - Prestamo $230.000,00, Frasco transitorio Nx $44.141,01,
 * YPF $3.494,90, Dolar Cash US$110,00, Dolar Galicia US$91,10. Los dos que no coinciden son
 * exactamente los que usa a diario (Efectivo, NaranjaX) y la causa esta medida: el ledger
 * terminaba el 12/08 y la medicion se hizo el 19/08. Faltaban siete dias de carga, no de logica.
 *
 * ============================================================================
 * EL MEDIO TIENE QUE EXISTIR EN EL PLAN DE CUENTAS
 * ============================================================================
 * `corte_fila` se resuelve por VLOOKUP contra la lista de medios del catalogo. Un movimiento cuyo
 * medio no este ahi devuelve "" y queda FUERA de todo saldo. No se reparte ni se estima: un saldo
 * bancario es la suma de lo que paso por una cuenta, y un movimiento sin cuenta valida no tiene
 * saldo al que pertenecer. Son 39 filas por $2.147.186 y se cuentan aparte, en L29.
 *
 * Eso resuelve solo el caso "YPF - wallet": son cinco filas y las cinco son "Inicio Mes" -- el
 * arrastre de YPF escrito con otro nombre. Como no esta en el catalogo queda excluido, y YPF da
 * $3.494,90, que es exactamente lo que Franco declaro. Sin tocar una sola fila del ledger.
 *
 * ============================================================================
 * POR QUE UN SOLO MAP Y NO UNO POR MEDIO
 * ============================================================================
 * `cortes` se calcula UNA vez sobre la lista de medios (28 iteraciones) y despues se proyecta a
 * cada fila del ledger con un VLOOKUP vectorizado. La alternativa -- un FILTER por medio dentro
 * de cada formula de saldo -- multiplicaba por ocho el mismo trabajo sobre 3.500 filas.
 */
function _preambuloSaldoSyf() {
    const pc = RANGES.PROYECTOS;
    const medios = RANGES.MEDIOS_PAGO;
    const colCatMedio = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;
    const colTipoCat = columnLetterToIndex(pc.columns.tipo) - columnLetterToIndex(pc.start) + 1;
    const colMonMedio = columnLetterToIndex(medios.columns.moneda) - columnLetterToIndex(medios.start) + 1;
    const rangoMedios = _refHoja(medios.sheet) + '!' + medios.start + ':' + medios.end;
    const rangoCats = _refHoja(pc.sheet) + '!' + pc.start + ':' + pc.end;
    return [
        '  col_medio; ' + _colLedger('medio') + ';',
        '  col_cuenta; ' + _colLedger('cuenta') + ';',
        '  col_fecha; ' + _colLedger('fecha') + ';',
        '  col_moneda; ' + _colLedger('moneda') + ';',
        '  neto; ARRAYFORMULA(IF(' + _colLedger('tipo') + '="Egreso"; -' + _colLedger('monto') + '; ' + _colLedger('monto') + '));',
        '  lista; IFERROR(FILTER(' + _colPlan(medios, 'nombre') + '; ' + _colPlan(medios, 'nombre') + '<>""); "");',
        // El ultimo "Inicio Mes" de cada medio: el punto de corte de su conciliacion.
        '  cortes; MAP(lista; LAMBDA(un_medio; MAX(IFERROR(FILTER(col_fecha; col_medio=un_medio; col_cuenta="' + SYF_ARRASTRE + '"); 0))));',
        '  corte_fila; ARRAYFORMULA(IFERROR(VLOOKUP(col_medio; HSTACK(lista; cortes); 2; 0); ""));',
        // Vigente = el medio existe en el catalogo Y la fila es posterior a su ultima conciliacion.
        '  vigente; ARRAYFORMULA((corte_fila<>"") * (col_fecha>=corte_fila));',
        '  cat_fila; ARRAYFORMULA(IFERROR(VLOOKUP(col_medio; ' + rangoMedios + '; ' + colCatMedio + '; 0); ""));',
        '  tipo_fila; ARRAYFORMULA(IFERROR(VLOOKUP(cat_fila; ' + rangoCats + '; ' + colTipoCat + '; 0); ""));',
        '  mon_lista; ARRAYFORMULA(IFERROR(VLOOKUP(lista; ' + rangoMedios + '; ' + colMonMedio + '; 0); "ARS"));'
    ].join('\n');
}

/** Saldo actual por moneda, de un grupo (riqueza o su complemento). */
function _formulaSaldoPorMoneda(esRiqueza, celdaMoneda) {
    return '=LET(\n' + _preambuloSaldoSyf() + '\n' +
        '  grupo; ARRAYFORMULA(' + _condTipoSyf(esRiqueza, 'tipo_fila') + ');\n' +
        '  SUM(IFERROR(FILTER(neto; vigente; grupo; col_moneda=' + celdaMoneda + '); 0))\n)';
}

/** Saldo actual total de un grupo, convertido a la moneda del selector. */
function _formulaSaldoConvertido(esRiqueza, celdaSelector) {
    return '=LET(\n' + _preambuloSaldoSyf() + '\n' +
        '  grupo; ARRAYFORMULA(' + _condTipoSyf(esRiqueza, 'tipo_fila') + ');\n' +
        '  suma_ars; SUM(IFERROR(FILTER(neto; vigente; grupo; col_moneda="ARS"); 0));\n' +
        '  suma_usd; SUM(IFERROR(FILTER(neto; vigente; grupo; col_moneda="USD"); 0));\n' +
        '  suma_aud; SUM(IFERROR(FILTER(neto; vigente; grupo; col_moneda="AUD"); 0));\n' +
        '  suma_eur; SUM(IFERROR(FILTER(neto; vigente; grupo; col_moneda="EUR"); 0));\n' +
        '  total_ars; suma_ars + (suma_usd * TIDETRACK_USD()) + (suma_aud * TIDETRACK_AUD()) + (suma_eur * TIDETRACK_EUR());\n' +
        '  tasa_destino; IFERROR(SWITCH(' + celdaSelector + '; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n' +
        '  total_ars / tasa_destino\n)';
}

/**
 * Saldo ACTUAL de cada cuenta bancaria, con su moneda. Ordenado de mayor a menor.
 *
 * decision Franco 2026-08-19: "No quiero que me aparezcan todos los medios. Solo los que tienen
 * saldo a la fecha." Se filtran los que quedan en cero -- de 28 medios del catalogo, muestra los
 * que efectivamente tienen plata. Un listado con veinte ceros no es informacion.
 */
/** Filas disponibles para el derrame del bloque de medios, derivadas de sus limites. */
function _altoBloqueMedios() {
    return SYF_BLOQUE_MEDIOS.filaFin - SYF_BLOQUE_MEDIOS.filaDatos + 1;
}

function _formulaSaldoPorMedio(indiceColumna) {
    return '=LET(\n' + _preambuloSaldoSyf() + '\n' +
        '  saldos; MAP(lista; LAMBDA(un_medio;\n' +
        '    SUM(IFERROR(FILTER(neto; vigente; col_medio=un_medio); 0))));\n' +
        '  con_saldo; ARRAYFORMULA(ROUND(saldos; 2)<>0);\n' +
        // La MISMA matriz ordenada en las tres columnas: cada una toma la suya con INDEX y las
        // filas se corresponden siempre, aun con saldos empatados.
        '  ordenada; IFERROR(SORT(FILTER(HSTACK(lista; mon_lista; saldos); con_saldo); 3; FALSE);\n' +
        '    HSTACK("(sin saldos)"; ""; 0));\n' +
        // Acotado al alto del bloque: el diseno de la hoja manda sobre la cantidad de datos.
        '  tabla; ARRAY_CONSTRAIN(ordenada; ' + _altoBloqueMedios() + '; 3);\n' +
        '  INDEX(tabla; 0; ' + indiceColumna + ')\n)';
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
        '  categoria; ARRAYFORMULA(IFERROR(VLOOKUP(AN' + f + ':AN; ' + _refHoja(medios.sheet) + '!' + medios.start + ':' + medios.end + '; ' + colCatMedio + '; 0); ""));\n' +
        '  sin_clasificar; ARRAYFORMULA((AJ' + f + ':AJ<>"") * (categoria=""));\n' +
        // OJO con los nombres de variable: 'n' colisiona con la funcion N() de Sheets y hace
        // que la formula entera no parsee. Es lo que dejo L29 sin nada en la corrida del 1723.
        '  cantidad; SUM(IFERROR(FILTER(ARRAYFORMULA(SIGN(ABS(monto_neto))); vigente; sin_clasificar); 0));\n' +
        '  monto_total; SUM(IFERROR(FILTER(monto_neto; vigente; sin_clasificar); 0));\n' +
        '  IF(cantidad = 0;\n' +
        '    "Todos los movimientos del mes clasifican.";\n' +
        '    "Sin clasificar: " & TEXT(cantidad; "0") & " movimiento(s) por " & TEXT(monto_total; "$ #.##0,00") & " (sin medio o con un medio que no esta en el Plan de Cuentas). Es lo que le falta al 100%."\n' +
        '  )\n)';
}

// ============================================
// PLAN
// ============================================

function _planSyf(ss, pre) {
    const cambios = [];
    const avisos = [];
    let limpiar = false;
    const s = SYF_SALDOS_TABLERO;
    const hojaT = ss.getSheetByName(pre.nombreTablero);
    const hojaI = ss.getSheetByName(pre.nombreInicio);

    function proponer(nombreHoja, celda, nota, nueva, resumen) {
        const actual = ss.getSheetByName(nombreHoja).getRange(celda).getFormula();
        if (_canonizarFormula(actual) === _canonizarFormula(nueva)) return;
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

    // --- SALDO ACTUAL POR MEDIO: tres formulas de UNA columna, por las celdas combinadas ---
    if (pre.bloqueMediosOk) {
        limpiar = true;
        SYF_BLOQUE_MEDIOS.columnas.forEach(function (c) {
            proponer(pre.nombreTablero, c.col + SYF_BLOQUE_MEDIOS.filaDatos,
                'Medios Bancarios: ' + c.rotulo,
                _formulaSaldoPorMedio(c.indice),
                'saldo actual por cuenta, solo las que tienen saldo, de mayor a menor');
        });
    } else {
        avisos.push('NO se toca el bloque "Medios Bancarios": ' + pre.bloqueMediosMotivo +
            '. Escribir ahi a ciegas dejaria nombres nuevos con montos viejos al lado.');
    }

    // --- FLUJO: capitalizacion como residuo, sin quinta fila ---
    // decision Franco: los tres buckets tienen que repartir el 100% del ingreso. Con tres
    // buckets la unica forma de que cierre es que uno sea el residuo, y el que corresponde es
    // la capitalizacion: lo que no se gasto, se capitalizo.
    proponer(pre.nombreTablero, 'N' + SYF_FILA_RESIDUO, 'Capacidad de Capitalizacion',
        '=N16-N17-N18',
        'pasa a ser el RESIDUO (Ingresos - Fijos - Variables), asi los tres reparten el 100%');
    proponer(pre.nombreTablero, 'O16', 'Total del bloque',
        '=SUM(O17:O' + SYF_FILA_RESIDUO + ')',
        'suma las tres filas; con la capitalizacion como residuo da 100% por construccion');

    if (!pre.diagLibre) {
        avisos.push('NO se escribe el indicador de movimientos sin clasificar: ninguna de las ' +
            'celdas candidatas (' + SYF_CANDIDATAS_DIAGNOSTICO.join(', ') + ') esta libre y sin combinar.');
    } else {
        proponer(pre.nombreTablero, pre.celdaDiag, 'Movimientos sin clasificar',
            _formulaDiagnosticoSyf(), 'le pone nombre y numero a lo que no clasifica (celda ' + pre.celdaDiag + ')');
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

    return { cambios: cambios, avisos: avisos, limpiarBloqueMedios: limpiar };
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

/**
 * Canonicaliza una formula para compararla con la que se escribio. Sheets REESCRIBE lo que le
 * mandas: le saca las comillas a los nombres de hoja que no las necesitan y reacomoda espacios.
 * Comparar el texto crudo produce falsos negativos que revierten cambios correctos.
 * Lo que NO se relaja es la comprobacion del VALOR: esa sigue siendo el gate duro.
 */
function _canonizarFormula(f) {
    return String(f || '')
        .replace(/'([A-Za-z_][A-Za-z0-9_]*)'!/g, '$1!')   // 'Registros'! -> Registros!
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Fotografia el area de datos del bloque de medios: valores Y formulas, celda por celda.
 * Es la red que el respaldo de formulas no da, porque lo que hay que sacar de en medio son
 * valores estaticos.
 */
function _fotografiarBloqueMedios(ss, nombreHoja) {
    const b = SYF_BLOQUE_MEDIOS;
    const hoja = ss.getSheetByName(nombreHoja);
    const col = columnLetterToIndex(b.colIni);
    const nCols = columnLetterToIndex(b.colFin) - col + 1;
    const nFilas = Math.min(b.filaFin, hoja.getMaxRows()) - b.filaDatos + 1;
    if (nFilas <= 0) return null;
    const rango = hoja.getRange(b.filaDatos, col, nFilas, nCols);
    return {
        fila: b.filaDatos, col: col, nFilas: nFilas, nCols: nCols,
        valores: rango.getValues(), formulas: rango.getFormulas()
    };
}

/** Deja libre el area para que los tres derrames puedan expandirse. */
function _limpiarBloqueMedios(ss, nombreHoja) {
    const b = SYF_BLOQUE_MEDIOS;
    const hoja = ss.getSheetByName(nombreHoja);
    const col = columnLetterToIndex(b.colIni);
    const nCols = columnLetterToIndex(b.colFin) - col + 1;
    const nFilas = Math.min(b.filaFin, hoja.getMaxRows()) - b.filaDatos + 1;
    if (nFilas <= 0) return;
    hoja.getRange(b.filaDatos, col, nFilas, nCols).clearContent();
}

/** Devuelve el area a como estaba: primero las formulas, y los valores donde no habia formula. */
function _restaurarBloqueMedios(ss, nombreHoja, foto) {
    if (!foto) return;
    const hoja = ss.getSheetByName(nombreHoja);
    const destino = hoja.getRange(foto.fila, foto.col, foto.nFilas, foto.nCols);
    destino.clearContent();
    const salida = [];
    for (let r = 0; r < foto.nFilas; r++) {
        const fila = [];
        for (let c = 0; c < foto.nCols; c++) {
            fila.push(foto.formulas[r][c] ? foto.formulas[r][c] : foto.valores[r][c]);
        }
        salida.push(fila);
    }
    destino.setValues(salida);
    SpreadsheetApp.flush();
}

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
        if (_canonizarFormula(leida) !== _canonizarFormula(w.nueva)) {
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
