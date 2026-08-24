/**
 * devtools/probar_presupuesto_resumen.js
 * Banco de pruebas de DEVTOOL_PresupuestoResumen.js.
 *
 * Cuatro mitades, mismo esqueleto que probar_presupuesto_modo.js:
 *
 * 1. ESTRUCTURA DE LAS FORMULAS que el modulo emite: cero arrays literales {}, cero comas fuera
 *    de strings, cero decimales con punto fuera de un string, parentesis/comillas balanceados,
 *    variables de LET de 3+ caracteres.
 *
 * 2. EL CABLEADO: el plan propone EXACTAMENTE las 64 celdas del encargo (30 filas x V + 30 filas
 *    x W + C9 + F19:F21) y NINGUNA otra (ni J/N/R/K/O/S, que son de DEVTOOL_PresupuestoModo.js).
 *    Idempotencia: escribir sobre lo ya escrito no propone nada de nuevo.
 *
 * 3. LA MATEMATICA, espejada en JS (_recalcularAgrupadoPc, la funcion PURA que tambien usa el
 *    invariante en vivo): el signo por naturaleza del bloque (Ingresos suma, Gastos Fijos y
 *    Variables restan -- la convencion medida contra la formula viva de Tablero!AA10, ver la
 *    cabecera del modulo), la deteccion de cuentas sin categoria (gap), y que el monto de gap
 *    efectivamente explique el desvio entre SUM(categoria) y el total del bloque.
 *
 * 4. EL PREFLIGHT, con un mock de hoja y mutaciones dirigidas: cada guard se prueba rompiendolo
 *    a proposito y confirmando que el preflight lo frena.
 *
 * USO:  node devtools/probar_presupuesto_resumen.js
 * @version 0.46.0
 * @since 2026-08-24
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON,
    SpreadsheetApp: {
        newDataValidation: () => {
            const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({ __mock: 'validacion' }) };
            return b;
        },
        flush() {},
        getActiveSpreadsheet: () => ({
            getSheets: () => ['Inicio', 'Tablero', 'Presupuesto', 'Cargas', 'Plan de Cuentas',
                              'Mirada Interanual', 'Registros', 'Tipos de Cambio', 'Proyeccion']
                              .map(n => ({ getName: () => n })),
            getSheetByName: () => null
        })
    },
    PropertiesService: {}, Utilities: { sleep() {} }, Session: {}, Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {},
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_StockYFlujo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_Proyeccion.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_Capitalizacion.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_InicioPresupuesto.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoModo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoResumen.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,MONEDAS_DISPONIBLES,CUENTAS_NEUTRAS,esCuentaNeutra,' +
    'columnLetterToIndex,columnIndexToLetter,getDataRow,IP_MESES,_exclusionNeutrasIp,_colLedger,_refHoja,' +
    '_canonizarFormula,_rotulosCompatibles,_normalizarRotulo,_errorDeCelda,_verificarEscrituraSyf,' +
    '_revertirEscriturasPm,_entradaEscritaPm,_absPm,_condModoHistoricoPm,_fragmentoMesRefPm,' +
    '_mesRefDesdeSelectoresPm,PM_ALPHA,PM_ALPHA_FRACCION,PM_MESES_HISTORICO,PM_MODO,PM_SELECTORES,' +
    'PM_BLOQUES,PM_CLAVES_BLOQUE,PM_FILA_INI,PM_FILA_FIN,PM_FILA_TOTAL,PM_UMBRAL_IDENTIDAD,' +
    'PC_COL_CATEGORIA,PC_COL_MODO_AGRUPADO,PC_COL_PROYECTAR_AGRUPADO,PC_TITULO_MODO_AGRUPADO,' +
    'PC_TITULO_PROYECTAR_AGRUPADO,PC_TITULO_PROYECTAR,PC_ROTULO_CATEGORIAS,PC_ROTULO_NOMBRE,' +
    'PC_CELDA_TITULO_TABLA1,PC_TITULO_TABLA1,PC_FILAS_TABLA2,PC_TOKEN_ROTO,PC_TOKEN_CORRECTO,' +
    'PC_BLOQUES,PC_CLAVES_BLOQUE,_formulaAgrupadoPc,_formulaRotuloMesRefPc,_repararReferenciaTabla2Pc,' +
    '_recalcularAgrupadoPc,_leerMapaCategoriaPc,_verificarInvariantesPc,_preflightPc,_planPc});',
    ctx);

// ============================================================================
// El chequeo estructural de una formula (mismo detector que probar_presupuesto_modo.js)
// ============================================================================
function revisar(nombre, f) {
    const p = [];
    if (!f || f[0] !== '=') p.push('no empieza con =');
    if (f.indexOf('{') !== -1) p.push('tiene un array literal {} -- setFormula no lo traduce en es_AR');
    const sinStrings = f.replace(/"[^"]*"/g, '""');
    if (sinStrings.indexOf(',') !== -1) p.push('tiene una coma fuera de un string: separador equivocado o decimal con coma');
    const decimalConPunto = sinStrings.match(/[0-9]+\.[0-9]+/g);
    if (decimalConPunto) p.push('tiene un decimal con punto fuera de un string: ' + decimalConPunto.join(', '));
    let par = 0, com = 0;
    for (const ch of f) { if (ch === '(') par++; else if (ch === ')') par--; else if (ch === '"') com++; }
    if (par !== 0) p.push('parentesis desbalanceados (' + par + ')');
    if (com % 2 !== 0) p.push('comillas desbalanceadas');
    (f.match(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/g) || []).forEach(x => {
        const v = x.trim().replace(';', '');
        if (v.length <= 2) p.push('variable LET "' + v + '" es muy corta: puede chocar con una funcion');
    });
    if (p.length) { fallas++; console.log('\n### FALLA ' + nombre + ': ' + p.join(', ')); }
    return !p.length;
}

console.log('=== 1. ESTRUCTURA DE LAS FORMULAS ===');
{
    const casos = [
        ['V9 (modo, primera fila)', ctx._formulaAgrupadoPc('modo', 9)],
        ['V20 (modo, fila media)', ctx._formulaAgrupadoPc('modo', 20)],
        ['W38 (a proyectar, ultima fila)', ctx._formulaAgrupadoPc('proyectar', 38)],
        ['C9 (rotulo mes de referencia)', ctx._formulaRotuloMesRefPc()]
    ];
    casos.forEach(([nombre, f]) => ok(revisar(nombre, f), nombre + ': estructura OK'));

    const v9 = ctx._formulaAgrupadoPc('modo', 9);
    ok(v9.indexOf('SUMIF(cat_ingresos') !== -1 && v9.indexOf(' - SUMIF(cat_fijos') !== -1 && v9.indexOf(' - SUMIF(cat_variables') !== -1,
       'V9: ingresos suma, fijos y variables restan (SUMIF(ingresos) - SUMIF(fijos) - SUMIF(variables))');
    ok(v9.indexOf('$J$' + ctx.PM_FILA_INI) !== -1 && v9.indexOf('$N$' + ctx.PM_FILA_INI) !== -1 && v9.indexOf('$R$' + ctx.PM_FILA_INI) !== -1,
       'V9 lee J/N/R (la columna "modo"), no K/O/S');
    const w9 = ctx._formulaAgrupadoPc('proyectar', 9);
    ok(w9.indexOf('$K$' + ctx.PM_FILA_INI) !== -1 && w9.indexOf('$O$' + ctx.PM_FILA_INI) !== -1 && w9.indexOf('$S$' + ctx.PM_FILA_INI) !== -1,
       'W9 lee K/O/S ("Monto a Proyectar"), no J/N/R');
    ok(v9.indexOf("'Plan de Cuentas'!C:D") !== -1 && v9.indexOf("'Plan de Cuentas'!F:G") !== -1 && v9.indexOf("'Plan de Cuentas'!I:J") !== -1,
       'los tres rangos de categoria salen de RANGES.INGRESOS/GASTOS_FIJOS/GASTOS_VARIABLES (C:D, F:G, I:J)');

    const c9 = ctx._formulaRotuloMesRefPc();
    ok(c9.indexOf(ctx._condModoHistoricoPm()) !== -1, 'C9 usa la MISMA condicion de modo que J/N/R (_condModoHistoricoPm)');
    ok(c9.indexOf('TEXT(') === -1, 'C9 no usa TEXT() para el nombre del mes -- evita la trampa del locale en nombres de mes');
    ok(c9.indexOf('SPLIT("' + ctx.IP_MESES + '"') !== -1, 'C9 deriva los nombres de mes de IP_MESES, la misma lista que usa el selector');
    ok(c9.indexOf(ctx.PC_TITULO_TABLA1) !== -1, 'C9 conserva el titulo original como prefijo');

    ['=IFERROR(E19/$E$11;0)', '=IFERROR(E20/$E$11;0)', '=IFERROR(E21/$E$11;0)'].forEach(f => {
        const reparada = ctx._repararReferenciaTabla2Pc(f);
        ok(reparada.indexOf('$E$11') === -1 && reparada.indexOf('$E$18') !== -1,
           '_repararReferenciaTabla2Pc("' + f + '") -> "' + reparada + '"');
        ok(reparada.replace('$E$18', '$E$11') === f, 'la cirugia toco SOLO el token $E$11 -- el resto de la formula es identico');
    });
    ok(ctx._repararReferenciaTabla2Pc('=IFERROR(E19/$E$18;0)') === '=IFERROR(E19/$E$18;0)',
       'idempotente: una formula ya reparada no cambia');
}

console.log('\n=== 2. EL CABLEADO ===');
{
    function hojaBase() {
        const celdas = {};
        const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

        set('C9', ctx.PC_TITULO_TABLA1);
        set('I2', 'Período a Presupuestar'); set('J2', 'Septiembre'); set('J3', 2026);
        set('I4', 'Moneda'); set('J4', 'ARS');
        set('C7', 'Modo'); set('E7', 'Proyección');
        set(ctx.PC_ROTULO_CATEGORIAS.celda, ctx.PC_ROTULO_CATEGORIAS.esperado);
        set(ctx.PC_ROTULO_NOMBRE.celda, ctx.PC_ROTULO_NOMBRE.esperado);
        set(ctx.PC_COL_MODO_AGRUPADO + '7', ctx.PC_TITULO_MODO_AGRUPADO);
        set(ctx.PC_COL_PROYECTAR_AGRUPADO + '7', ctx.PC_TITULO_PROYECTAR_AGRUPADO);
        Object.keys(ctx.PC_BLOQUES).forEach(k => set(ctx.PC_BLOQUES[k].colProyectar + '7', ctx.PC_TITULO_PROYECTAR));

        for (let f = ctx.PM_FILA_INI; f <= ctx.PM_FILA_FIN; f++) {
            set(ctx.PC_COL_CATEGORIA + f, 'Categoria ' + f, "='Plan de Cuentas'!P" + (f - 1));
            set(ctx.PC_COL_MODO_AGRUPADO + f, '');
            set(ctx.PC_COL_PROYECTAR_AGRUPADO + f, '');
        }
        [ctx.PC_COL_MODO_AGRUPADO, ctx.PC_COL_PROYECTAR_AGRUPADO].forEach(col => {
            set(col + ctx.PM_FILA_TOTAL, 0, '=SUM(' + col + ctx.PM_FILA_INI + ':' + col + ')');
        });
        ctx.PC_FILAS_TABLA2.forEach(f => set('F' + f, 0, '=IFERROR(E' + f + '/$E$11;0)'));

        const merges = {}, validaciones = {};
        return {
            celdas, merges, validaciones,
            getRange(a1) {
                const h = this;
                return {
                    getValue() { return (celdas[a1] || { valor: '' }).valor; },
                    getFormula() { return (celdas[a1] || { formula: '' }).formula; },
                    getDisplayValue() { return String((celdas[a1] || { valor: '' }).valor); },
                    isPartOfMerge() { return !!h.merges[a1]; },
                    getMergedRanges() {
                        const ancla = h.merges[a1];
                        return ancla ? [{ getCell: () => ({ getA1Notation: () => ancla }) }] : [];
                    },
                    setFormula(f) { celdas[a1] = { valor: (celdas[a1] || {}).valor, formula: f }; },
                    setValue(x) { celdas[a1] = { valor: x, formula: '' }; }
                };
            }
        };
    }

    const pre = { hoja: hojaBase(), nombre: 'Presupuesto' };
    const plan = ctx._planPc(pre);

    ok(plan.cambios.length === 64, 'el plan propone EXACTAMENTE 64 celdas (30 V + 30 W + C9 + F19:F21), propuso ' + plan.cambios.length);

    const celdasPlan = plan.cambios.map(c => c.celda).sort();
    const esperadas = [];
    for (let f = ctx.PM_FILA_INI; f <= ctx.PM_FILA_FIN; f++) {
        esperadas.push(ctx.PC_COL_MODO_AGRUPADO + f, ctx.PC_COL_PROYECTAR_AGRUPADO + f);
    }
    esperadas.push('C9', 'F19', 'F20', 'F21');
    esperadas.sort();
    ok(JSON.stringify(celdasPlan) === JSON.stringify(esperadas), 'el conjunto exacto de celdas coincide con lo esperado');

    ['J9', 'N9', 'R9', 'K9', 'O9', 'S9', 'J7', 'E7'].forEach(c => {
        ok(celdasPlan.indexOf(c) === -1, 'el plan NUNCA propone ' + c + ' (es de DEVTOOL_PresupuestoModo.js u otro encargo)');
    });

    // Idempotencia: aplicar el plan (simulado) y volver a planificar no debe proponer nada.
    const pre2 = { hoja: hojaBase(), nombre: 'Presupuesto' };
    plan.cambios.forEach(c => pre2.hoja.getRange(c.celda).setFormula(c.formulaNueva));
    const plan2 = ctx._planPc(pre2);
    ok(plan2.cambios.length === 0, 'IDEMPOTENCIA: sobre lo ya escrito, el plan no propone nada de nuevo (propuso ' + plan2.cambios.length + ')');
}

console.log('\n=== 3. LA MATEMATICA (_recalcularAgrupadoPc, espejo puro del agrupado) ===');
{
    // Escenario sintetico. Deliberado: las filas de ETIQUETA (solo U, ninguna cuenta) y las
    // filas de CUENTA (I/M/Q + montos, sin U) van SEPARADAS -- exactamente como en la hoja real,
    // donde el espejo de categorias (U) y los espejos de cuenta (I/M/Q) son dos listas
    // independientes que solo comparten el rango de filas por geometria, no por contenido: la
    // cuenta de la fila 12 no tiene por que pertenecer a la categoria que U12 muestra.
    const mapaIngresos = { 'Trabajo': 'Sueldo', 'Freelance': 'Sueldo' };
    const mapaFijos = { 'Alquiler': 'Vivienda', 'Cuota Auto': 'Auto' };
    const mapaVariables = { 'Nafta': 'Auto', 'Cine': 'Ocio' };

    const filaVacia = { nombreI: '', nombreM: '', nombreQ: '', U: '', J: 0, K: 0, N: 0, O: 0, R: 0, S: 0 };
    const etiqueta = (u) => Object.assign({}, filaVacia, { U: u });
    const cuentaI = (nombre, J, K) => Object.assign({}, filaVacia, { nombreI: nombre, J: J, K: K });
    const cuentaM = (nombre, N, O) => Object.assign({}, filaVacia, { nombreM: nombre, N: N, O: O });
    const cuentaQ = (nombre, R, S) => Object.assign({}, filaVacia, { nombreQ: nombre, R: R, S: S });

    const filas = [
        etiqueta('Sueldo'), etiqueta('Vivienda'), etiqueta('Auto'), etiqueta('Ocio'),
        cuentaI('Trabajo', 1000, 900), cuentaI('Freelance', 200, 150),
        cuentaM('Alquiler', 500, 450), cuentaM('Cuota Auto', 300, 280),
        cuentaQ('Nafta', 80, 70), cuentaQ('Cine', 40, 35),
        // Cuenta sin categoria (gap deliberado): "Sin Categoria" no esta en mapaVariables.
        cuentaQ('Sin Categoria', 999, 111)
    ];

    const r = ctx._recalcularAgrupadoPc(filas, mapaIngresos, mapaFijos, mapaVariables);
    const porU = {};
    r.porCategoria.forEach((c, i) => { if (filas[i].U) porU[filas[i].U] = c; });

    ok(porU['Sueldo'].esperadoV === 1000 + 200, 'Sueldo (Trabajo + Freelance, ambos Ingresos): V = ' + (1000 + 200) + ', dio ' + porU['Sueldo'].esperadoV);
    ok(porU['Sueldo'].esperadoW === 900 + 150, 'Sueldo: W (a proyectar) = ' + (900 + 150) + ', dio ' + porU['Sueldo'].esperadoW);
    ok(porU['Vivienda'].esperadoV === -500, 'Vivienda (Alquiler, un Gasto Fijo): V = -500 (resta), dio ' + porU['Vivienda'].esperadoV);
    ok(porU['Auto'].esperadoV === -(300 + 80), 'Auto (Cuota Auto [fijo] + Nafta [variable]): V = -(300+80) = ' + -(300 + 80) + ', dio ' + porU['Auto'].esperadoV);
    ok(porU['Auto'].esperadoW === -(280 + 70), 'Auto: W = -(280+70) = ' + -(280 + 70) + ', dio ' + porU['Auto'].esperadoW);
    ok(porU['Ocio'].esperadoV === -40, 'Ocio (Cine, un Gasto Variable): V = -40, dio ' + porU['Ocio'].esperadoV);

    ok(r.gaps.length === 1 && r.gaps[0].indexOf('Sin Categoria') !== -1,
       'detecta la cuenta sin categoria ("Sin Categoria"), reporto: ' + JSON.stringify(r.gaps));
    ok(r.gapMontoV === -999 && r.gapMontoW === -111,
       'el monto de gap (lo que se escapa del agrupado) es -999 en V y -111 en W (Sin Categoria es Gasto Variable, resta), dio V=' + r.gapMontoV + ' W=' + r.gapMontoW);

    // MUTACION: si Ingresos tambien restara (signo invertido a proposito, simulando el bug que
    // este chequeo tiene que atrapar), Sueldo pasaria de +1200 a -1200 -- confirma que el
    // resultado depende REALMENTE del signo por bloque, no de una casualidad del fixture.
    const mapaIngresosVacio = {};   // sin ninguna cuenta de ingreso mapeada: Sueldo pasa a depender solo del gasto (aca, nada)
    const rMutado = ctx._recalcularAgrupadoPc(filas, mapaIngresosVacio, mapaFijos, mapaVariables);
    const porUMutado = {};
    rMutado.porCategoria.forEach((c, i) => { if (filas[i].U) porUMutado[filas[i].U] = c; });
    ok(porUMutado['Sueldo'].esperadoV === 0,
       'MUTACION (sin mapa de Ingresos): Sueldo ya no recibe a Trabajo/Freelance -- da 0, no 1200 (prueba que esperadoV depende REALMENTE del mapa de categorias, no de una constante)');

    // Sin gaps: el desvio total tiene que ser EXACTAMENTE 0 en V y W.
    const filasSinGap = filas.slice(0, 10);   // saca la cuenta sin categoria (la ultima)
    const r2 = ctx._recalcularAgrupadoPc(filasSinGap, mapaIngresos, mapaFijos, mapaVariables);
    ok(r2.gaps.length === 0 && r2.gapMontoV === 0 && r2.gapMontoW === 0,
       'sin cuentas huerfanas, gapMonto da exactamente 0 en V y W');
}

console.log('\n=== 4. EL PREFLIGHT (con mock de hoja y mutaciones dirigidas) ===');
{
    function hojaBase() {
        const celdas = {};
        const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

        set('C9', ctx.PC_TITULO_TABLA1);
        set(ctx.PC_ROTULO_CATEGORIAS.celda, ctx.PC_ROTULO_CATEGORIAS.esperado);
        set(ctx.PC_ROTULO_NOMBRE.celda, ctx.PC_ROTULO_NOMBRE.esperado);
        set(ctx.PC_COL_MODO_AGRUPADO + '7', ctx.PC_TITULO_MODO_AGRUPADO);
        set(ctx.PC_COL_PROYECTAR_AGRUPADO + '7', ctx.PC_TITULO_PROYECTAR_AGRUPADO);
        Object.keys(ctx.PC_BLOQUES).forEach(k => set(ctx.PC_BLOQUES[k].colProyectar + '7', ctx.PC_TITULO_PROYECTAR));

        for (let f = ctx.PM_FILA_INI; f <= ctx.PM_FILA_FIN; f++) {
            set(ctx.PC_COL_CATEGORIA + f, 'Categoria ' + f, "='Plan de Cuentas'!P" + (f - 1));
            set(ctx.PC_COL_MODO_AGRUPADO + f, '');
            set(ctx.PC_COL_PROYECTAR_AGRUPADO + f, '');
        }
        [ctx.PC_COL_MODO_AGRUPADO, ctx.PC_COL_PROYECTAR_AGRUPADO].forEach(col => {
            set(col + ctx.PM_FILA_TOTAL, 0, '=SUM(' + col + ctx.PM_FILA_INI + ':' + col + ')');
        });
        ctx.PC_FILAS_TABLA2.forEach(f => set('F' + f, 0, '=IFERROR(E' + f + '/$E$11;0)'));

        const merges = {};
        return {
            celdas, merges,
            getRange(a1) {
                const h = this;
                return {
                    getValue() { return (celdas[a1] || { valor: '' }).valor; },
                    getFormula() { return (celdas[a1] || { formula: '' }).formula; },
                    getDisplayValue() { return String((celdas[a1] || { valor: '' }).valor); },
                    isPartOfMerge() { return !!h.merges[a1]; },
                    getMergedRanges() {
                        const ancla = h.merges[a1];
                        return ancla ? [{ getCell: () => ({ getA1Notation: () => ancla }) }] : [];
                    },
                    setFormula(f) { celdas[a1] = { valor: (celdas[a1] || {}).valor, formula: f }; },
                    setValue(x) { celdas[a1] = { valor: x, formula: '' }; }
                };
            }
        };
    }

    function ssCon(hoja) {
        return { getSheetByName: (n) => (n === ctx.SHEETS.PRESUPUESTO ? hoja : null) };
    }

    // --- Caso base: no tiene que lanzar ---
    {
        const pre = ctx._preflightPc(ssCon(hojaBase()));
        ok(pre.nombre === 'Presupuesto', 'caso base: preflight OK');
    }

    const abortaCon = (mutar, quePrueba) => {
        const h = hojaBase();
        mutar(h);
        try {
            ctx._preflightPc(ssCon(h));
            fallas++;
            console.log('  !!! ' + quePrueba + ' -- NO abortó (deberia haber lanzado)');
        } catch (e) {
            ok(true, quePrueba + ' -- aborta: "' + e.message.slice(0, 70) + '..."');
        }
    };

    abortaCon(h => { h.celdas['U7'].valor = 'Otra Cosa'; }, 'MUTACION rotulo: U7 corrido');
    abortaCon(h => { h.celdas['U8'].valor = 'Cuenta'; }, 'MUTACION rotulo: U8 no dice "Nombre"');
    abortaCon(h => { h.celdas['C9'].valor = 'Otro Titulo Cualquiera'; }, 'MUTACION rotulo: C9 no reconoce el titulo esperado');
    abortaCon(h => { h.merges['C9'] = 'B9'; }, 'MUTACION combinada: C9 mitad muda de B9');
    abortaCon(h => { h.celdas['U15'].formula = ''; }, 'MUTACION mirror: U15 sin formula (falta una categoria del espejo)');
    abortaCon(h => { h.celdas['V15'] = { valor: 12345, formula: '' }; }, 'MUTACION valor a mano: V15=12345 sin formula (dato de Franco)');
    abortaCon(h => { h.celdas['W20'] = { valor: 999, formula: '' }; }, 'MUTACION valor a mano: W20=999 sin formula');
    abortaCon(h => { h.celdas['V8'].formula = ''; }, 'MUTACION total: V8 sin formula (el invariante no tendria que leer)');
    abortaCon(h => { h.celdas['W8'].formula = ''; }, 'MUTACION total: W8 sin formula');
    abortaCon(h => { h.celdas['F19'].formula = '=IFERROR(E19/$E$99;0)'; }, 'MUTACION F19: no referencia ni $E$11 ni $E$18 (patron desconocido)');
    abortaCon(h => { h.celdas['F20'].formula = ''; }, 'MUTACION F20: sin formula');

    // --- F19:F21 ya reparado: no aborta, y el plan no lo vuelve a proponer ---
    {
        const h = hojaBase();
        ctx.PC_FILAS_TABLA2.forEach(f => { h.celdas['F' + f].formula = '=IFERROR(E' + f + '/$E$18;0)'; });
        const pre = ctx._preflightPc(ssCon(h));
        const plan = ctx._planPc(pre);
        ok(!plan.cambios.some(c => c.celda[0] === 'F'), 'con F19:F21 ya reparado, el plan no vuelve a proponerlas');
    }
}

console.log('\n' + '='.repeat(60));
if (fallas === 0) { console.log('TODO OK'); process.exit(0); }
console.log(fallas + ' FALLA(S)');
process.exit(1);
