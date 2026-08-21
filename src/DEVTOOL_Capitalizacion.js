/**
 * DEVTOOL_Capitalizacion.js
 * Mantiene la IDENTIDAD del bloque de presupuesto y arregla el reparto de la disponibilidad.
 *
 * [CONCEPTO DE NEGOCIO]
 * "Presupuesto Asignado" es una ASIGNACION: reparte los ingresos que esperas. Cada peso que entra
 * va a gastos fijos, a gastos variables, o queda disponible para capitalizar. Por lo tanto
 *
 *     Ingresos = Gastos Fijos + Gastos Variables + Capacidad de Capitalizacion
 *
 * no es un resultado que se observa: es la DEFINICION de lo que el bloque muestra. Los tres
 * destinos tienen que sumar el 100% de los ingresos, siempre, o el bloque no es un presupuesto.
 *
 * [EL ERROR QUE COSTO TRES VERSIONES, ANOTADO PARA NO REPETIRLO]
 * La v0.26.0 saco la capacidad de capitalizacion del residuo y la puso a medir el flujo real hacia
 * los medios de tipo Ahorros e Inversiones. El motivo parecia bueno -- el residuo daba negativo --
 * pero rompio la identidad: los cuatro numeros pasaron a salir de CUATRO FUENTES INDEPENDIENTES de
 * la proyeccion, sin nada que los ate. Nunca mas cerraron. Se midio 143,98%.
 *
 * Lo que siguio fueron parches sobre el sintoma: piso en cero (v0.27.0), contar solo las entradas
 * (v0.28.0), reanclar el porcentaje de la fila de Ingresos (v0.28.0). Ninguno podia funcionar,
 * porque el problema no estaba en como se calculaba cada numero sino en que ya no habia identidad.
 *
 * decision Franco 2026-08-20: "esa suma siempre tiene que dar 100%".
 *
 * Y el dato que desarma el motivo original: EL RESIDUO DA 100% INCLUSO SIENDO NEGATIVO. Con
 * Fijos+Variables por encima de los Ingresos, la capacidad sale negativa y los tres siguen sumando
 * 100% (46 + 116 - 62 = 100). El negativo nunca rompio la suma -- era la SENAL de que el
 * presupuesto esta sobrecomprometido, y taparlo fue el error.
 *
 * [LAS DOS COSAS, Y EL LUGAR DE CADA UNA -- decision Franco 2026-08-20, v0.31.0]
 * 1. CAPACIDAD de capitalizacion (N12, bloque del PLAN): el residuo Ingresos - Fijos - Variables.
 *    Un presupuesto asigna, y el residuo es lo unico que cierra la asignacion en 100%.
 * 2. CAPITALIZACION EFECTIVA (N19, bloque de la REALIDAD): cuanta plata entro de verdad a los
 *    frascos en el mes. La realidad no asigna: se mide. "Aca si va el valor registrado del mes."
 *
 * La v0.26.0 puso la segunda donde iba la primera y rompio la identidad; la v0.29.0 la retiro a
 * git; la v0.31.0 la trajo de vuelta A SU LUGAR. El bloque del plan suma 100% por construccion;
 * el de la realidad no, y esa diferencia es el dato.
 *
 * [LA SEGUNDA MITAD: DISPONIBILIDAD DE FONDOS]
 * El bloque reparte la plata disponible entre las tres categorias segun cuanto presupuesto le
 * queda a cada una. Cuando las tres se pasaron del 100%, no le queda presupuesto a ninguna, la
 * suma de remanentes da cero, y la formula vieja caia en un caso degenerado que le daba TODO a la
 * capitalizacion y CERO a las otras dos. Medido en vivo con 145% / 136% / 114%:
 * $0,00 / $0,00 / $275.428,69.
 *
 * decision Franco 2026-08-20: cuando no queda presupuesto por cubrir, se reparte por PESO DE
 * PRESUPUESTO -- la misma prioridad relativa que rige entre 0% y 100%, sin el caso especial.
 *
 * INVARIANTE verificado: las tres filas SIEMPRE suman la liquidez, en los tres regimenes.
 *
 * QUE NO HACE
 * 1. NO toca el ledger ni la hoja Proyeccion. Solo reescribe siete celdas del Tablero.
 * 2. NO cambia los rotulos: son de Franco.
 *
 * @see docs/permanente/FORMULAS_TABLERO.md
 * @version 0.31.0
 * @since 2026-08-20
 * @lastModified 2026-08-20
 */

/**
 * Geometria MEDIDA EN VIVO el 2026-08-20 y verificada por rotulo antes de escribir.
 *
 * Los tres bloques comparten la columna L para los rotulos y la fila para cada categoria, asi que
 * un desplazamiento se detecta comparando el rotulo, no la posicion.
 */
const CAP_BLOQUES = {
    presupuesto: { titulo: 'L7', rotulo: 'L12', celda: 'N12', esperado: 'Capacidad de Capitalizacion' },
    realidad:    { titulo: 'L14', rotulo: 'L19', celda: 'N19', esperado: 'Capacidad de Capitalizacion' },
    disponibilidad: {
        rotulos: { fijos: 'L23', variables: 'L24', capitalizacion: 'L25' },
        celdas:  { fijos: 'O23', variables: 'O24', capitalizacion: 'O25' },
        esperados: { fijos: 'Gastos Fijos', variables: 'Gastos Variables',
                     capitalizacion: 'Capacidad de Capitalizacion' }
    }
};

/**
 * La celda de % de la fila de INGRESOS, en cada bloque.
 *
 * Venia siendo `SUMA(<las otras tres>)`, que daba 100% por construccion mientras la capitalizacion
 * era el residuo. Al dejar de serlo, esa celda pasa a mostrar un numero flotante en la fila de
 * Ingresos -- se midio 115,99% el 2026-08-20 --, que leido literalmente dice "mis ingresos son el
 * 116% de mis ingresos". Es una categoria equivocada, no un numero mal calculado.
 *
 * decision Franco 2026-08-20: los Ingresos son la BASE contra la que se mide todo lo demas, asi
 * que su porcentaje es 100%. Los otros tres muestran su parte de los ingresos. Si esos tres suman
 * mas de 100%, el presupuesto no cierra -- y eso se ve sumandolos, y es exactamente sobre lo que
 * actua "Disponibilidad de fondos". Ya no se disfraza de otra cosa en la fila de arriba.
 */
const CAP_PORCENTAJE_BASE = {
    presupuesto: { celda: 'O9', monto: 'N9' },
    realidad:    { celda: 'O16', monto: 'N16' }
};

/** Las celdas de presupuesto y realidad de cada categoria, para la disponibilidad. */
const CAP_REFS = {
    presu: { fijos: '$N$10', variables: '$N$11', capitalizacion: '$N$12' },
    real:  { fijos: '$N$17', variables: '$N$18', capitalizacion: '$N$19' }
};

const CAP_PROP_RESPALDO = 'capitalizacion_respaldo';

// ============================================
// FORMULAS
// ============================================

/** La conversion a la moneda del selector, por funcion y nunca por coordenada. */
function _conversionCap(colMoneda) {
    return '  tasa_origen; ARRAYFORMULA(IF(' + colMoneda + '="USD"; TIDETRACK_USD(); IF(' + colMoneda +
        '="AUD"; TIDETRACK_AUD(); IF(' + colMoneda + '="EUR"; TIDETRACK_EUR(); 1))));\n' +
        '  tasa_destino; IFERROR(SWITCH($N$4; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; ' +
        'TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n';
}

/** El rango del mes seleccionado, derivado de los selectores N2/N3. */
function _rangoMesCap() {
    return '  mes_num; MATCH($N$2; SPLIT("' + PROY_MESES + '"; ","); 0);\n' +
        '  desde; DATE($N$3; mes_num; 1);\n' +
        '  hasta; EOMONTH(desde; 0);\n';
}

/** La condicion "el medio de esta fila es un vehiculo de riqueza", desde TIPOS_RIQUEZA. */
function _esRiquezaCap(variable) {
    return '(' + TIPOS_RIQUEZA.map(function (t) { return '(' + variable + '="' + t + '")'; }).join(' + ') + ') > 0';
}

/**
 * La capitalizacion EFECTIVA del mes: el flujo neto hacia los medios de tipo riqueza.
 *
 * decision Franco 2026-08-20: "N19 no debe ser una resta de descarte. Aca va el valor registrado
 * del mes: lo que se haya realmente ahorrado y/o invertido". El modelo completo queda asi:
 *
 *   - N12 (PLAN): el residuo Ingresos - Fijos - Variables. Un presupuesto ASIGNA, y el residuo es
 *     lo unico que hace cerrar la asignacion en 100% (v0.29.0). Nunca negativo, porque el plan se
 *     recorta antes que proyectar desahorro (v0.30.0).
 *   - N19 (REALIDAD): esta formula. La realidad no asigna: SE MIDE. Suma lo que efectivamente
 *     entro a los medios de Ahorros e Inversiones en el mes -- traspasos incluidos, que es como
 *     se capitaliza -- neteado con signo: negativo significa que ese mes se saco de los frascos.
 *
 * CONSECUENCIA ASUMIDA: las filas del bloque de la realidad NO suman 100%. La diferencia entre
 * Ingresos y (Fijos + Variables + Capitalizacion efectiva) es la plata que entro y quedo sin
 * asignar, o la que se gasto por encima de lo que entro. En el bloque del PLAN esa diferencia no
 * existe por construccion; en el de la realidad ES el dato.
 *
 * Se excluye SOLO el arrastre (CUENTA_ARRASTRE): un "Inicio Mes" declara cuanta plata habia, no
 * mueve nada. Los traspasos SI cuentan por la pata cuyo medio es de riqueza.
 */
function _formulaHaciaRiqueza(nombreHoja) {
    const cfg = RANGES.REGISTROS;
    const medios = RANGES.MEDIOS_PAGO;
    const col = function (clave) {
        return _refHoja(nombreHoja) + '!' + cfg.columns[clave] + cfg.dataRow + ':' + cfg.columns[clave];
    };
    const rangoMedios = _refHoja(medios.sheet) + '!' + medios.start + ':' + medios.end;
    const idxTipo = columnLetterToIndex(medios.columns.proyecto) - columnLetterToIndex(medios.start) + 1;

    return '=LET(\n' +
        '  monto; ' + col('monto') + ';\n' +
        '  tipo_mov; ' + col('tipo') + ';\n' +
        '  cuenta; ' + col('cuenta') + ';\n' +
        '  medio; ' + col('medio') + ';\n' +
        '  moneda; ' + col('moneda') + ';\n' +
        '  fecha; ' + col('fecha') + ';\n' +
        '  tipo_medio; ARRAYFORMULA(IFERROR(VLOOKUP(medio; ' + rangoMedios + '; ' + idxTipo + '; 0); ""));\n' +
        '  es_riqueza; ARRAYFORMULA(' + _esRiquezaCap('tipo_medio') + ');\n' +
        // Se excluye SOLO el arrastre. Los traspasos SI cuentan -- decision Franco 2026-08-20:
        // "los traspasos indican capitalizacion si se cruza con un medio" --, y como en este
        // ledger un traspaso son dos filas (Egreso del origen, Ingreso al destino), filtrar por
        // "el medio de esta fila es de riqueza" hace lo correcto solo: de un traspaso de casa a
        // un frasco entra la pata que suma y no la que resta.
        //
        // "Inicio Mes" no: es un punto de corte de conciliacion. Si contara, el arrastre de cada
        // frasco se leeria como si uno hubiera capitalizado ese monto ese mes.
        '  no_corte; ARRAYFORMULA(cuenta <> "' + CUENTA_ARRASTRE + '");\n' +
        // NETEA con signo: si el mes saco mas de los frascos de lo que puso, da negativo, y eso
        // es un hecho que hay que poder ver. (La version "solo entradas" de la v0.28 murio con
        // el piso en cero: aca se mide, no se planifica.)
        '  signo; ARRAYFORMULA(IF(tipo_mov="Egreso"; -1; 1));\n' +
        _rangoMesCap() +
        _conversionCap('moneda') +
        '  convertido; ARRAYFORMULA(monto * signo * tasa_origen / tasa_destino);\n' +
        '  del_mes; ARRAYFORMULA(es_riqueza * no_corte * (fecha>=desde) * (fecha<=hasta));\n' +
        '  SUM(IFERROR(FILTER(convertido; del_mes); 0))\n)';
}

/**
 * El residuo que cierra el bloque: Ingresos menos los dos tipos de gasto.
 *
 * Es una resta de tres celdas y no tiene ninguna gracia, y esa es exactamente la virtud: no hay
 * forma de que no cierre. Cualquier formula mas sofisticada que mida la capitalizacion por su
 * lado -- por buena que sea como medicion -- deja de estar atada a los ingresos, y el bloque
 * empieza a sumar 143%.
 *
 * Puede dar NEGATIVO, y no se tapa: significa que lo presupuestado en fijos y variables ya supera
 * a los ingresos. Los tres siguen sumando 100% igual. Esa es la lectura correcta de un
 * presupuesto sobrecomprometido, y esconderla detras de un piso en cero (v0.27.0) fue lo que
 * hizo falta deshacer.
 */
function _formulaResiduoCap(celdaIngresos, celdaFijos, celdaVariables) {
    return '=' + celdaIngresos + '-' + celdaFijos + '-' + celdaVariables;
}

/** La liquidez disponible: el bucket cotidiano de "Saldos Actuales", convertido al selector. */
function _liquidezCap() {
    const s = SYF_SALDOS_TABLERO;
    const celda = function (i) { return '$' + s.colFlujo + '$' + s.filas[i]; };
    // Las filas del bloque son ARS/USD/AUD/EUR en ese orden, verificado en el preflight.
    return '  liquidez_ars; ' + celda(0) + ' + (' + celda(1) + ' * TIDETRACK_USD()) + (' +
        celda(2) + ' * TIDETRACK_AUD()) + (' + celda(3) + ' * TIDETRACK_EUR());\n' +
        '  tasa_destino; IFERROR(SWITCH($N$4; "ARS"; 1; "USD"; TIDETRACK_USD(); "AUD"; ' +
        'TIDETRACK_AUD(); "EUR"; TIDETRACK_EUR()); 1);\n' +
        '  liquidez; liquidez_ars / tasa_destino;\n';
}

/**
 * El reparto de la plata disponible para UNA de las tres categorias.
 *
 * Tres regimenes, y en los tres las tres filas suman exactamente la liquidez:
 *
 *   1. Queda presupuesto y la plata NO alcanza -> cada una recibe su parte proporcional al
 *      remanente. Suman liquidez porque las proporciones suman 1.
 *   2. Queda presupuesto y la plata SOBRA -> cada una recibe su remanente completo, y el sobrante
 *      va a capitalizacion. Es lo correcto: la plata que sobra despues de cubrir todo lo
 *      presupuestado es, por definicion, capacidad de capitalizar.
 *   3. NO queda presupuesto -- las tres se pasaron del 100% -- -> se reparte por PESO DE
 *      PRESUPUESTO. decision Franco 2026-08-20: la prioridad relativa entre categorias no deberia
 *      cambiar por haberse pasado; es la misma que rige de 0% a 100%. Antes este caso le daba todo
 *      a la capitalizacion y cero a las otras dos.
 *
 * Si ademas no hay NADA presupuestado, se reparte en partes iguales: sin presupuesto no hay
 * prioridad que respetar, y darle todo a una sola seria inventar una.
 */
function _formulaDisponibilidadCap(cual) {
    const p = CAP_REFS.presu, r = CAP_REFS.real;
    const claves = ['fijos', 'variables', 'capitalizacion'];
    const rem = function (k) { return 'MAX(0; ' + p[k] + ' - ' + r[k] + ')'; };
    const peso = function (k) { return 'MAX(0; ' + p[k] + ')'; };

    let s = '=LET(\n' + _liquidezCap();
    claves.forEach(function (k) { s += '  rem_' + k + '; ' + rem(k) + ';\n'; });
    s += '  suma_rem; ' + claves.map(function (k) { return 'rem_' + k; }).join(' + ') + ';\n';
    claves.forEach(function (k) { s += '  peso_' + k + '; ' + peso(k) + ';\n'; });
    s += '  suma_peso; ' + claves.map(function (k) { return 'peso_' + k; }).join(' + ') + ';\n';
    s += '  parte_sin_presupuesto; IF(suma_peso > 0; peso_' + cual + ' / suma_peso; 1/3);\n';
    s += '  reparto; IF(suma_rem > 0; MIN(rem_' + cual + '; liquidez * rem_' + cual +
        ' / suma_rem); liquidez * parte_sin_presupuesto);\n';
    if (cual === 'capitalizacion') {
        // El sobrante solo existe cuando queda presupuesto por cubrir y la plata alcanza para
        // todo. En el regimen 3 no hay sobrante: la liquidez ya se repartio entera por peso.
        s += '  excedente; IF(suma_rem > 0; MAX(0; liquidez - suma_rem); 0);\n';
        s += '  reparto + excedente\n)';
    } else {
        s += '  reparto\n)';
    }
    return s;
}

// ============================================
// PREFLIGHT
// ============================================

function _preflightCap(ss) {
    const nombre = NAV_CONFIG.SHEETS.TABLERO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const rotulo = function (celda) {
        return _normalizarRotulo(String(hoja.getRange(celda).getValue() || '').trim());
    };
    const desvios = [];
    const chequear = function (celda, esperado) {
        const vivo = rotulo(celda);
        if (vivo !== _normalizarRotulo(esperado)) {
            desvios.push(celda + ' dice "' + hoja.getRange(celda).getValue() + '" y se esperaba "' + esperado + '"');
        }
    };
    chequear(CAP_BLOQUES.presupuesto.rotulo, CAP_BLOQUES.presupuesto.esperado);
    chequear(CAP_BLOQUES.realidad.rotulo, CAP_BLOQUES.realidad.esperado);
    const d = CAP_BLOQUES.disponibilidad;
    Object.keys(d.rotulos).forEach(function (k) { chequear(d.rotulos[k], d.esperados[k]); });
    if (desvios.length) {
        throw new Error('Los bloques del Tablero se movieron: ' + desvios.join('; ') +
            '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // El bloque de saldos tiene que rotular ARS/USD/AUD/EUR en ese orden: la liquidez suma sus
    // cuatro filas y multiplica cada una por SU cotizacion. Si el orden cambiara, multiplicaria
    // pesos por la cotizacion del dolar sin dar ningun error.
    const s = SYF_SALDOS_TABLERO;
    const monedas = s.filas.map(function (f) {
        return String(hoja.getRange(s.colMoneda + f).getValue() || '').trim();
    });
    const esperadas = ['ARS', 'USD', 'AUD', 'EUR'];
    if (monedas.join(',') !== esperadas.join(',')) {
        throw new Error('El bloque de saldos rotula ' + monedas.join('/') + ' y la liquidez asume ' +
            esperadas.join('/') + ' en ese orden. No se toco nada.');
    }

    // La hoja de proyeccion tiene que existir: sin ella el presupuesto de capitalizacion da cero
    // y el bloque entero pierde sentido.
    const proy = ss.getSheetByName(SHEETS.PROYECCION);
    if (!proy) {
        throw new Error('No existe la hoja "' + SHEETS.PROYECCION + '". Correr antes ' +
            'Tidetrack Dev > BD de Proyeccion (presupuesto) > 2. Crear y cablear.');
    }

    return { hoja: hoja, nombre: nombre, monedas: monedas };
}

// ============================================
// PLAN
// ============================================

function _planCap(ss, pre) {
    const cambios = [];
    const proponer = function (celda, nota, nueva, resumen) {
        const actual = pre.hoja.getRange(celda).getFormula();
        if (_canonizarFormula(actual) === _canonizarFormula(nueva)) return;
        cambios.push({ celda: celda, nota: nota, formulaActual: actual, formulaNueva: nueva, resumen: resumen });
    };

    proponer(CAP_BLOQUES.presupuesto.celda, 'Capacidad de capitalizacion (presupuesto)',
        _formulaResiduoCap('N9', 'N10', 'N11'),
        'lo que queda de los ingresos despues de fijos y variables: hace cerrar el bloque en 100%');

    proponer(CAP_BLOQUES.realidad.celda, 'Capitalizacion efectiva del mes',
        _formulaHaciaRiqueza(RANGES.REGISTROS.sheet),
        'lo que realmente entro a los medios de ' + TIPOS_RIQUEZA.join(' e ') +
        ' en el mes; negativo significa que se saco de los frascos');

    ['presupuesto', 'realidad'].forEach(function (bloque) {
        const b = CAP_PORCENTAJE_BASE[bloque];
        proponer(b.celda, 'Porcentaje de la fila de Ingresos (' + bloque + ')',
            '=IFERROR(' + b.monto + '/$' + b.monto[0] + '$' + b.monto.slice(1) + '; 0)',
            'los Ingresos son la base: 100%, no la suma de los otros tres');
    });

    const d = CAP_BLOQUES.disponibilidad;
    ['fijos', 'variables', 'capitalizacion'].forEach(function (k) {
        proponer(d.celdas[k], 'Disponibilidad: ' + d.esperados[k],
            _formulaDisponibilidadCap(k),
            'reparte por remanente, y por peso de presupuesto cuando no queda remanente');
    });

    return { cambios: cambios };
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura. */
function estadoCapitalizacion() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightCap(ss);
        const plan = _planCap(ss, pre);
        const l = ['CAPITALIZACION Y DISPONIBILIDAD - ESTADO (no se escribio nada)', ''];
        if (!plan.cambios.length) {
            l.push('NADA QUE HACER: las cinco celdas ya estan como corresponde.');
        } else {
            l.push('CELDAS A REESCRIBIR: ' + plan.cambios.length);
            plan.cambios.forEach(function (c) {
                const vivo = pre.hoja.getRange(c.celda).getDisplayValue();
                l.push('  ' + c.celda.padEnd(5) + c.nota + '  (hoy muestra ' + vivo + ')');
            });
            l.push('');
            l.push('QUE CAMBIA:');
            l.push('  - N12 (plan): el residuo Ingresos - Fijos - Variables, que cierra el 100%.');
            l.push('  - N19 (realidad): la capitalizacion MEDIDA, lo que entro a los frascos en el');
            l.push('    mes. Negativo = se saco. El bloque de la realidad no suma 100%, a proposito.');
            l.push('  - Los cuatro renglones YA NO suman 100%. La diferencia es la plata que entro');
            l.push('    y no se gasto ni se capitalizo: antes se escondia adentro del residuo.');
            l.push('  - Cuando las tres categorias se pasan del 100%, la disponibilidad se reparte');
            l.push('    por peso de presupuesto en vez de darle todo a la capitalizacion.');
        }
        const t = l.join('\n');
        _mostrarCap('Capitalizacion - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarCap('Capitalizacion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica las cinco formulas, con respaldo y verificacion. */
function aplicarCapitalizacion() {
    const escritas = [];
    let ui = null, ss = null, yaRevertido = false;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarCapitalizacion necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightCap(ss);
        const plan = _planCap(ss, pre);
        if (!plan.cambios.length) {
            const t = 'Las cinco celdas ya estan como corresponde. No se escribio nada.';
            _mostrarCap('Capitalizacion', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Capitalizacion y disponibilidad',
            'Se van a reescribir ' + plan.cambios.length + ' celda(s) del Tablero.\n\n' +
            'CAMBIAN NUMEROS QUE VENIS MIRANDO:\n' +
            '  - En el PLAN (N12), la Capacidad es el residuo Ingresos - Fijos - Variables: es lo\n' +
            '    unico que hace cerrar la asignacion en 100%.\n' +
            '  - En la REALIDAD (N19), la capitalizacion SE MIDE: lo que realmente entro a los\n' +
            '    medios de Ahorros e Inversiones en el mes, traspasos incluidos. Negativo\n' +
            '    significa que ese mes se saco de los frascos.\n' +
            '  - Por eso el bloque de la realidad YA NO suma 100%: la diferencia es la plata que\n' +
            '    entro y quedo sin asignar, o el gasto por encima del ingreso. Ese ES el dato.\n' +
            '  - Cuando las tres categorias se pasan del 100%, "Disponibilidad de fondos" reparte\n' +
            '    por peso de presupuesto en vez de darle todo a la capitalizacion.\n\n' +
            'No se toca el ledger ni la hoja de proyeccion.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarFormulerio(ss, sello);

        plan.cambios.forEach(function (c) {
            const rango = pre.hoja.getRange(c.celda);
            const errorPrevio = _errorDeCelda(rango);
            rango.setFormula(c.formulaNueva);
            escritas.push({ nombreHoja: pre.nombre, celda: c.celda, previa: c.formulaActual,
                            nueva: c.formulaNueva, errorPrevio: errorPrevio });
        });
        SpreadsheetApp.flush();

        const fallas = _verificarEscrituraSyf(ss, escritas);

        // Y el invariante: las tres filas de disponibilidad tienen que sumar la liquidez. Si no
        // suman, el reparto pierde o inventa plata, y eso no lo detecta ninguna comparacion de
        // texto -- hay que mirar los numeros.
        const d = CAP_BLOQUES.disponibilidad;
        const repartido = ['fijos', 'variables', 'capitalizacion'].reduce(function (a, k) {
            return a + (Number(pre.hoja.getRange(d.celdas[k]).getValue()) || 0);
        }, 0);
        const liquidez = ['fijos', 'variables', 'capitalizacion'].map(function (k) {
            return pre.hoja.getRange(d.celdas[k]).getValue();
        });
        if (fallas.length === 0 && repartido < 0) {
            fallas.push('el reparto de disponibilidad dio negativo (' + repartido.toFixed(2) + ')');
        }
        if (liquidez.some(function (v) { return typeof v === 'string' && v.indexOf('#') === 0; })) {
            fallas.push('alguna fila de disponibilidad quedo en error');
        }

        if (fallas.length) {
            _revertirEscriturasSyf(ss, escritas);
            yaRevertido = true;
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') +
                '. Se restauro cada celda. El respaldo quedo en "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(CAP_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'CAPITALIZACION Y DISPONIBILIDAD APLICADAS\n\n' +
            '- Celdas reescritas y verificadas: ' + escritas.length + '\n' +
            '- Respaldo en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- Se repartieron ' + repartido.toFixed(2) + ' entre las tres categorias\n\n' +
            'QUE MIRAR:\n' +
            '  1. En el bloque del PLAN: Fijos % + Variables % + Capacidad % = 100%, exacto, en\n' +
            '     cualquier mes. Si no da 100%, algo se rompio.\n' +
            '  2. En el bloque de la REALIDAD ese 100% NO tiene por que darse: N19 mide lo que\n' +
            '     entro a los frascos, y si da negativo es que ese mes se saco de ellos.\n' +
            '  3. En un mes con las tres categorias arriba del 100%, "Disponibilidad de fondos"\n' +
            '     reparte entre las tres en vez de darle todo a una. Julio 2026 es ese caso.\n' +
            '  4. Las tres filas de disponibilidad tienen que sumar la liquidez, siempre.\n\n' +
            'Si algo quedo peor: Tidetrack Dev > Capitalizacion > 3. Revertir.';

        logSuccess('aplicarCapitalizacion: ' + escritas.length + ' celda(s).');
        _mostrarCap('Capitalizacion - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try { _revertirEscriturasSyf(ss, escritas); restaurado = ' Se restauraron las celdas ya escritas.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + ').'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarCap('Capitalizacion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Vuelve a las formulas previas usando el respaldo. */
function revertirCapitalizacion() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const nombre = PropertiesService.getDocumentProperties().getProperty(CAP_PROP_RESPALDO);
        if (!nombre) throw new Error('No hay respaldo registrado de este modulo.');
        const resp = ss.getSheetByName(nombre);
        if (!resp) throw new Error('La hoja de respaldo "' + nombre + '" ya no existe.');

        const celdas = [CAP_BLOQUES.presupuesto.celda, CAP_BLOQUES.realidad.celda]
            .concat(['fijos', 'variables', 'capitalizacion'].map(function (k) {
                return CAP_BLOQUES.disponibilidad.celdas[k];
            }));
        const filas = resp.getDataRange().getValues();
        const hoja = ss.getSheetByName(NAV_CONFIG.SHEETS.TABLERO);
        let repuestas = 0;
        const faltantes = [];
        celdas.forEach(function (celda) {
            const fila = filas.find(function (f) {
                return String(f[0]) === NAV_CONFIG.SHEETS.TABLERO && String(f[1]) === celda;
            });
            if (!fila || !fila[2]) { faltantes.push(celda); return; }
            hoja.getRange(celda).setFormula(String(fila[2]));
            repuestas++;
        });
        SpreadsheetApp.flush();

        const t = 'CAPITALIZACION REVERTIDA\n\n- Celdas repuestas: ' + repuestas + '\n' +
            (faltantes.length ? '- SIN respaldo (quedaron como estan): ' + faltantes.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + nombre + '"';
        logSuccess('revertirCapitalizacion: ' + repuestas + ' celda(s).');
        _mostrarCap('Capitalizacion - revertida', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarCap('Capitalizacion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarCap(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
