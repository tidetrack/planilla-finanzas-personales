/**
 * devtools/probar_presupuesto_modo.js
 * Banco de pruebas de DEVTOOL_PresupuestoModo.js.
 *
 * Cuatro mitades:
 *
 * 1. ESTRUCTURA DE LAS FORMULAS que el modulo emite: cero arrays literales {} (setFormula no los
 *    traduce en es_AR), cero comas fuera de strings, cero DECIMALES CON PUNTO fuera de un string
 *    (la trampa de locale ya documentada en IP_BLOQUE/00_Config.js: "un literal con punto
 *    depende del locale" -- PM_ALPHA=0.65 tiene que viajar como fraccion "(13/20)", nunca como
 *    "0.65"), parentesis y comillas balanceados, variables de LET/LAMBDA de 3+ caracteres, y
 *    CERO llamadas a TIDETRACK_*() (a diferencia de DEVTOOL_InicioPresupuesto, este modulo no
 *    necesita cotizacion en vivo: usa los TC congelados de la propia fila del ledger).
 *
 * 2. EL CABLEADO: que el plan proponga EXACTAMENTE las 93 celdas del pedido (J7/N7/R7 + 30 filas
 *    x 3 columnas de J/N/R) y NINGUNA de las celdas de otros encargos (K/O/S "Monto a
 *    Proyectar", la columna V/W de Categorias, las dos tablas resumen C9:F14/C16:F21). Ademas
 *    idempotencia: escribir sobre lo ya escrito no propone nada de nuevo.
 *
 * 3. LA MATEMATICA, espejada en JS (no prueba la formula de Sheets: prueba el DISENO que esa
 *    formula implementa, igual que el resto de los bancos de este repo):
 *    - el numero concreto que pide el encargo (8.62 veces) sale de PM_ALPHA, y PM_ALPHA_FRACCION
 *      (la que realmente viaja en la formula) es ese mismo numero sin error de redondeo;
 *    - _sumaMesPm/_promedioPonderadoPm (el espejo del invariante) contra escenarios sinteticos:
 *      conversion de moneda con TC de la MISMA fila, el signo que resta en el tipo contrario, la
 *      exclusion de cuentas neutras, el corte de fecha, y que el ponderado le de mas peso al mes
 *      reciente que a uno viejo (mutacion: si el orden de los pesos se invirtiera, este chequeo
 *      lo detecta).
 *
 * 4. EL PREFLIGHT, con un mock de hoja y mutaciones dirigidas: cada guard se prueba rompiendolo
 *    a proposito (rotulo corrido, modo desconocido, E7 combinada, validacion ajena, un mirror
 *    sin formula, un valor a mano en la zona destino, un titulo combinado, un total sin formula)
 *    y confirmando que el preflight lo frena. Un guard que no se puede romper no esta probado.
 *
 * USO:  node devtools/probar_presupuesto_modo.js
 * @version 0.45.0
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoModo.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,MONEDAS_DISPONIBLES,CUENTAS_NEUTRAS,esCuentaNeutra,' +
    'columnLetterToIndex,columnIndexToLetter,IP_MESES,_exclusionNeutrasIp,_colLedger,_canonizarFormula,' +
    '_rotulosCompatibles,_normalizarRotulo,_errorDeCelda,' +
    'PM_ALPHA,PM_ALPHA_FRACCION,PM_MESES_HISTORICO,PM_MODO,PM_TITULO_PALABRA,PM_TITULO,PM_SELECTORES,' +
    'PM_BLOQUES,PM_CLAVES_BLOQUE,PM_FILA_INI,PM_FILA_FIN,PM_FILA_TOTAL,PM_UMBRAL_IDENTIDAD,' +
    '_formulaMontoPm,_formulaTituloMontoPm,_condModoHistoricoPm,_esModoHistoricoPm,_sumaMesPm,' +
    '_promedioPonderadoPm,_mesRefDesdeSelectoresPm,_edateMesesPm,_finDeMesPm,_tasaFilaPm,_absPm,' +
    '_preflightPm,_planPm,_construirValidacionModoPm});',
    ctx);

// ============================================================================
// El chequeo estructural de una formula (trampas es_AR + la trampa del decimal con punto)
// ============================================================================
function revisar(nombre, f) {
    const p = [];
    if (!f || f[0] !== '=') p.push('no empieza con =');
    if (f.indexOf('{') !== -1) p.push('tiene un array literal {} -- setFormula no lo traduce en es_AR');
    const sinStrings = f.replace(/"[^"]*"/g, '""');
    if (sinStrings.indexOf(',') !== -1) p.push('tiene una coma fuera de un string: separador equivocado o decimal con coma');
    // LA TRAMPA DEL PUNTO: un numero con punto decimal FUERA de un string ("0.65", "8.6") no es
    // seguro en una formula es_AR (ver IP_BLOQUE, 00_Config.js). Los enteros ("6", "20", "13")
    // no caen aca -- son enteros, no decimales.
    const decimalConPunto = sinStrings.match(/[0-9]+\.[0-9]+/g);
    if (decimalConPunto) p.push('tiene un decimal con punto fuera de un string: ' + decimalConPunto.join(', ') + ' -- tiene que ser fraccion entera');
    if (/TIDETRACK_(USD|EUR|AUD)\(\)/.test(f)) p.push('llama a una cotizacion EN VIVO -- este modulo solo usa TC congelados de la fila');
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
        ['J9 (ingresos, primera fila)', ctx._formulaMontoPm('ingresos', 9)],
        ['N20 (fijos, fila media)', ctx._formulaMontoPm('fijos', 20)],
        ['R38 (variables, ultima fila)', ctx._formulaMontoPm('variables', 38)],
        ['titulo dinamico', ctx._formulaTituloMontoPm()]
    ];
    casos.forEach(([nombre, f]) => ok(revisar(nombre, f), nombre + ': estructura OK'));

    const f = ctx._formulaMontoPm('ingresos', 9);
    ok(f.indexOf(ctx.PM_ALPHA_FRACCION) !== -1, 'la formula usa la fraccion (13/20), no el 0.65 crudo');
    ok(f.indexOf('REGEXMATCH') !== -1 && f.indexOf('LOWER(TRIM(') !== -1, 'el modo se lee con REGEXMATCH(LOWER(TRIM(...));"hist")');
    ok(f.indexOf('$J$2') !== -1 && f.indexOf('$J$3') !== -1 && f.indexOf('$J$4') !== -1 && f.indexOf('$E$7') !== -1,
       'referencia los cuatro selectores de forma absoluta');
    ok(f.indexOf('SEQUENCE(' + ctx.PM_MESES_HISTORICO + ')') !== -1, 'la ventana historica usa SEQUENCE(' + ctx.PM_MESES_HISTORICO + ')');
    ok(f.indexOf('EOMONTH(ancla_periodo') === -1 && f.indexOf('EDATE(ancla_periodo; -1)') !== -1,
       'el mes de referencia es EDATE(ancla;-1), el mes calendario anterior');

    const t = ctx._formulaTituloMontoPm();
    ok(t.indexOf('CHAR(10)') !== -1, 'el titulo dinamico conserva el salto de linea (dos renglones, como el estatico medido)');
    ok(t.indexOf(ctx.PM_TITULO_PALABRA.historico) !== -1 && t.indexOf(ctx.PM_TITULO_PALABRA.proyectado) !== -1,
       'el titulo dinamico usa las dos palabras del contrato');
}

console.log('\n=== 2. EL CABLEADO ===');
{
    // Un mock minimo de hoja SOLO para _planPm: todas las celdas destino vacias (sin formula).
    function hojaVacia() {
        const celdas = {};
        // Los titulos J7/N7/R7 HOY son texto ESTATICO ("Monto \nHistórico"), no formula --
        // igual que en la planilla real medida. El resto de la banda (montos) esta vacia.
        const valores = { J7: 'Monto \nHistórico', N7: 'Monto \nHistórico', R7: 'Monto \nHistórico' };
        return {
            getRange(a1) {
                return {
                    getFormula() { return (celdas[a1] || ''); },
                    getValue() { return valores[a1] || ''; },
                    setFormula(f) { celdas[a1] = f; }
                };
            }
        };
    }
    const pre = { hoja: hojaVacia(), validacion: { existe: false } };
    const plan = ctx._planPm(pre);

    const esperadas = new Set();
    ['J', 'N', 'R'].forEach(col => {
        esperadas.add(col + '7');
        for (let f = ctx.PM_FILA_INI; f <= ctx.PM_FILA_FIN; f++) esperadas.add(col + f);
    });
    ok(esperadas.size === 93, 'el conjunto esperado tiene 93 celdas (3 titulos + 30x3 montos). Dio ' + esperadas.size);
    ok(plan.cambios.length === 93, 'el plan propone exactamente 93 celdas. Dio ' + plan.cambios.length);

    const propuestas = new Set(plan.cambios.map(c => c.celda));
    let coincide = propuestas.size === esperadas.size;
    esperadas.forEach(c => { if (!propuestas.has(c)) coincide = false; });
    ok(coincide, 'el plan propone EXACTAMENTE el conjunto esperado, ni una celda de mas ni de menos');

    const prohibidas = ['K9', 'O20', 'S38', 'V9', 'W20', 'C9', 'E11', 'F14', 'C16', 'E18', 'F21', 'J8', 'N8', 'R8'];
    const tocaProhibida = plan.cambios.some(c => prohibidas.indexOf(c.celda) !== -1);
    ok(!tocaProhibida, 'el plan NUNCA toca K/O/S, V/W, las tablas resumen ni los totales existentes (J8/N8/R8)');

    // EL FIX DEL VALOR ESTATICO: J7/N7/R7 hoy NO tienen formula (texto estatico medido). El plan
    // tiene que capturar valorActual con ese texto exacto -- si no lo captura, revertir perderia
    // el titulo original de Franco en vez de restaurarlo (la misma cicatriz que F10 documenta en
    // DEVTOOL_InicioPresupuesto.js). MUTACION: comentar la linea "valorActual: actual ? '' :
    // rango.getValue()" en _planPm dejaria valorActual undefined y esta asercion lo detecta.
    const cambioJ7 = plan.cambios.find(c => c.celda === 'J7');
    ok(!!cambioJ7 && cambioJ7.valorActual === 'Monto \nHistórico',
       'el plan captura el VALOR estatico previo de J7 ("' + (cambioJ7 && cambioJ7.valorActual) + '"), no solo que no tiene formula');
    ['N7', 'R7'].forEach(celda => {
        const c = plan.cambios.find(x => x.celda === celda);
        ok(!!c && c.valorActual === 'Monto \nHistórico', 'idem ' + celda);
    });

    // Idempotencia: si la hoja YA tiene exactamente lo que el plan generaria, no propone nada.
    function hojaYaAplicada() {
        const celdas = {};
        ['ingresos', 'fijos', 'variables'].forEach(k => {
            const col = ctx.PM_BLOQUES[k].colMonto;
            celdas[col + '7'] = ctx._formulaTituloMontoPm();
            for (let f = ctx.PM_FILA_INI; f <= ctx.PM_FILA_FIN; f++) celdas[col + f] = ctx._formulaMontoPm(k, f);
        });
        return { getRange: (a1) => ({ getFormula: () => celdas[a1] || '', getValue: () => '', setFormula(v) { celdas[a1] = v; } }) };
    }
    const planIdempotente = ctx._planPm({ hoja: hojaYaAplicada(), validacion: { existe: true } });
    ok(planIdempotente.cambios.length === 0, 'sobre una hoja ya aplicada, el plan no propone NADA (idempotencia). Dio ' + planIdempotente.cambios.length);
}

console.log('\n=== 3. LA MATEMATICA ===');
{
    ok(Math.abs(13 / 20 - ctx.PM_ALPHA) < 1e-15, 'PM_ALPHA_FRACCION (13/20) es EXACTAMENTE PM_ALPHA (0.65), sin desvio de redondeo');
    const ratio = 1 / Math.pow(ctx.PM_ALPHA, ctx.PM_MESES_HISTORICO - 1);
    ok(Math.abs(ratio - 8.6182) < 0.001, 'el mes mas reciente pesa ' + ratio.toFixed(4) + ' veces el mas viejo (se documento 8.62)');
    ok(ratio > 6, 'el ponderado es mas agresivo que un lineal de 6 meses (ratio 2:1, segun DISENO_HOJA_PRESUPUESTO.md)');
    ok(ratio < 32, 'y no tan agresivo como para que solo el ultimo mes importe (r=0.5 daria 32x, se descarto)');

    // --- _esModoHistoricoPm: robusto a variantes de acento/mayuscula, alineado con el REGEXMATCH de la formula ---
    ok(ctx._esModoHistoricoPm('Histórico') === true, '"Histórico" (con tilde) -> historico');
    ok(ctx._esModoHistoricoPm('Historico') === true, '"Historico" (SIN tilde) -> historico -- la formula no puede exigir el acento exacto');
    ok(ctx._esModoHistoricoPm('HISTÓRICO ') === true, '"HISTÓRICO " (mayusculas + espacio) -> historico');
    ok(ctx._esModoHistoricoPm('Proyección') === false, '"Proyección" -> NO historico');
    ok(ctx._esModoHistoricoPm('') === false, 'vacio -> NO historico (cae en Proyeccion por defecto)');
    // MUTACION: una comparacion EXACTA (en vez de "contiene hist") fallaria justo en el caso sin tilde.
    const exactoMalo = (v) => String(v || '').trim().toLowerCase() === 'histórico';
    ok(exactoMalo('Historico') === false && ctx._esModoHistoricoPm('Historico') === true,
       'MUTACION: un match EXACTO se rompe con "Historico" sin tilde; el match por substring "hist" no');

    // --- _sumaMesPm: conversion con TC de la MISMA fila, signo, exclusion de neutras, corte de fecha ---
    const filas = [
        // Ingreso en ARS dentro del mes de referencia: entra tal cual (tasa 1/1).
        { monto: 1000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS',
          fecha: new Date(2026, 7, 15), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400 },
        // Ingreso en USD el mismo mes: convierte a ARS multiplicando por su propia tasa (destino ARS = tc_ars = 1).
        { monto: 10, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'USD',
          fecha: new Date(2026, 7, 20), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400 },
        // Egreso contra la MISMA cuenta de Ingresos: resta (una devolucion).
        { monto: 200, tipo: 'Egreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS',
          fecha: new Date(2026, 7, 22), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400 },
        // Cuenta neutra: se excluye SIEMPRE aunque matchee categoria/fecha.
        { monto: 99999, tipo: 'Ingreso', cuenta: 'Traspaso', tipo_cuenta: 'Ingreso', moneda: 'ARS',
          fecha: new Date(2026, 7, 10), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400 },
        // Fuera del mes de referencia (julio): no cuenta.
        { monto: 500, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS',
          fecha: new Date(2026, 6, 15), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400 },
        // Otra cuenta, misma categoria: no cuenta para el filtro POR CUENTA (si cuenta=null, si suma).
        { monto: 300, tipo: 'Ingreso', cuenta: 'Ingreso Extra', tipo_cuenta: 'Ingreso', moneda: 'ARS',
          fecha: new Date(2026, 7, 5), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400 }
    ];
    const desde = new Date(2026, 7, 1), hasta = new Date(2026, 7, 31, 23, 59, 59, 999);
    const totalSueldo = ctx._sumaMesPm(filas, 'Sueldo', 'Ingreso', 'Egreso', 'ARS', desde, hasta);
    ok(Math.abs(totalSueldo - (1000 + 10 * 1300 - 200)) < 1e-9,
       'Sueldo en agosto = 1000 + 13000 - 200 = 13800 (ARS+USD convertido-Egreso). Dio ' + totalSueldo);

    const totalCategoria = ctx._sumaMesPm(filas, null, 'Ingreso', 'Egreso', 'ARS', desde, hasta);
    ok(Math.abs(totalCategoria - (totalSueldo + 300)) < 1e-9,
       'toda la categoria Ingreso en agosto = Sueldo + Ingreso Extra (Traspaso y julio quedan afuera). Dio ' + totalCategoria);

    const totalUsd = ctx._sumaMesPm(filas, 'Sueldo', 'Ingreso', 'Egreso', 'USD', desde, hasta);
    ok(Math.abs(totalUsd - totalSueldo / 1300) < 1e-9,
       'el mismo total, pedido en USD, se divide por la tasa USD de la MISMA fila (' + totalUsd.toFixed(4) + ')');

    // MUTACION: si el signo NO se invirtiera para el tipo contrario, el Egreso sumaria en vez de restar.
    const sinSignoInvertido = filas.filter(f => f.cuenta === 'Sueldo')
        .reduce((acc, f) => acc + f.monto * (f.moneda === 'USD' ? 1300 : 1), 0);
    ok(sinSignoInvertido !== totalSueldo, 'MUTACION: sin invertir el signo el total daria distinto (' + sinSignoInvertido + ' != ' + totalSueldo + ')');

    // --- _promedioPonderadoPm: mas peso al mes reciente que a uno viejo ---
    const filasCrecientes = [];
    for (let m = 0; m < 6; m++) {
        filasCrecientes.push({
            monto: 1000 * (m + 1), tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS',
            fecha: new Date(2026, 2 + m, 15), tc_ars: 1, tc_usd: 1300, tc_aud: 850, tc_eur: 1400
        });
    }
    const mesRefPond = new Date(2026, 7, 1);   // agosto: la ventana de 6 meses termina en agosto, arranca en marzo
    const pond = ctx._promedioPonderadoPm(filasCrecientes, 'Sueldo', 'Ingreso', 'Egreso', 'ARS', mesRefPond);
    const simple = (1000 + 2000 + 3000 + 4000 + 5000 + 6000) / 6;
    ok(pond > simple, 'con una serie CRECIENTE (1000..6000), el ponderado exponencial (' + pond.toFixed(2) +
       ') da MAS ALTO que el promedio simple (' + simple.toFixed(2) + ') -- pesa mas el ultimo mes, que es el mas grande');
    const filasDecrecientes = filasCrecientes.map(f => ({ ...f, monto: 7000 - f.monto }));
    const pondDecreciente = ctx._promedioPonderadoPm(filasDecrecientes, 'Sueldo', 'Ingreso', 'Egreso', 'ARS', mesRefPond);
    ok(pondDecreciente < simple, 'con una serie DECRECIENTE, el ponderado da MENOS que el simple -- confirma que pesa el ultimo mes, no el primero');

    // MUTACION: si los pesos se calcularan al reves (mas peso al mes VIEJO), la serie creciente
    // daria un ponderado MENOR al simple en vez de mayor.
    function pesosAlReves(filas2, cuenta, cat, tipoResta, monedaDestino, mesRef) {
        let sp = 0, spo = 0;
        for (let k = 1; k <= ctx.PM_MESES_HISTORICO; k++) {
            const iniK = ctx._edateMesesPm(mesRef, k - ctx.PM_MESES_HISTORICO);
            const finK = ctx._finDeMesPm(iniK);
            const valor = ctx._sumaMesPm(filas2, cuenta, cat, tipoResta, monedaDestino, iniK, finK);
            const peso = Math.pow(ctx.PM_ALPHA, ctx.PM_MESES_HISTORICO - (ctx.PM_MESES_HISTORICO + 1 - k));   // invertido
            spo += valor * peso; sp += peso;
        }
        return sp ? spo / sp : 0;
    }
    const pondMutado = pesosAlReves(filasCrecientes, 'Sueldo', 'Ingreso', 'Egreso', 'ARS', mesRefPond);
    ok(pondMutado < simple, 'MUTACION: con los pesos invertidos, la serie creciente da MENOS que el simple (' +
       pondMutado.toFixed(2) + ' < ' + simple.toFixed(2) + ') -- lo opuesto de lo correcto, confirma que el chequeo detecta el orden de los pesos');

    // --- _mesRefDesdeSelectoresPm: el mes calendario ANTERIOR, sin depender de "Inicio Mes" ---
    const ref = ctx._mesRefDesdeSelectoresPm('Septiembre', 2026);
    ok(ref.getFullYear() === 2026 && ref.getMonth() === 7, 'Septiembre 2026 -> mes de referencia Agosto 2026. Dio ' + ref.getFullYear() + '-' + (ref.getMonth() + 1));
    const refEnero = ctx._mesRefDesdeSelectoresPm('Enero', 2026);
    ok(refEnero.getFullYear() === 2025 && refEnero.getMonth() === 11, 'Enero 2026 -> mes de referencia Diciembre 2025 (cruza el anio). Dio ' + refEnero.getFullYear() + '-' + (refEnero.getMonth() + 1));
    ok(ctx._mesRefDesdeSelectoresPm('Mes Invalido', 2026) === null, 'un mes que no es espanol valido devuelve null (no explota, no inventa una fecha)');
}

console.log('\n=== 4. EL PREFLIGHT (con mock de hoja y mutaciones dirigidas) ===');
{
    function hojaBase() {
        const celdas = {};
        const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

        set('C2', 'Presupuesto financiero del Mes.');
        set('I2', 'Período a Presupuestar'); set('J2', 'Septiembre'); set('J3', 2026);
        set('I4', 'Moneda'); set('J4', 'ARS');
        set('C7', 'Modo'); set('E7', 'Proyección');
        const bloques = { ingresos: ['I', 'Ingresos. '], fijos: ['M', 'Gastos Fijos.'], variables: ['Q', 'Gastos Variables.'] };
        Object.keys(bloques).forEach(k => {
            const [col, titulo] = bloques[k];
            set(col + '7', titulo);
            set(col + '8', 'Cuenta');
            for (let f = 9; f <= 38; f++) set(col + f, 'Cuenta ' + f, "='Plan de Cuentas'!X" + (f - 1));
        });
        ['J', 'N', 'R'].forEach(col => {
            set(col + '7', 'Monto \nHistórico');
            set(col + '8', 0, '=SUM(' + col + '9:' + col + ')');
            for (let f = 9; f <= 38; f++) set(col + f, '');
        });

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
                    getDataValidation() {
                        const v = h.validaciones[a1];
                        return v ? { getCriteriaType: () => v.tipo, getCriteriaValues: () => v.valores } : null;
                    },
                    setFormula(f) { celdas[a1] = { valor: (celdas[a1] || {}).valor, formula: f }; },
                    setValue(x) { celdas[a1] = { valor: x, formula: '' }; },
                    setDataValidation() {}
                };
            }
        };
    }

    function ssCon(hoja) {
        return { getSheetByName: (n) => (n === ctx.SHEETS.PRESUPUESTO ? hoja : null) };
    }

    // --- Caso base: no tiene que lanzar ---
    {
        const pre = ctx._preflightPm(ssCon(hojaBase()));
        ok(pre.modoVivo === 'Proyección' && pre.validacion.existe === false, 'caso base: preflight OK, modo="Proyección", sin validacion todavia');
    }

    const abortaCon = (mutar, quePrueba) => {
        const h = hojaBase();
        mutar(h);
        try {
            ctx._preflightPm(ssCon(h));
            fallas++;
            console.log('  !!! ' + quePrueba + ' -- NO abortó (deberia haber lanzado)');
        } catch (e) {
            ok(true, quePrueba + ' -- aborta: "' + e.message.slice(0, 70) + '..."');
        }
    };

    abortaCon(h => { h.celdas['C2'].valor = 'Otra Hoja Cualquiera'; }, 'MUTACION rotulo: C2 corrido');
    abortaCon(h => { h.celdas['E7'].valor = 'Anual'; }, 'MUTACION modo desconocido: E7="Anual"');
    abortaCon(h => { h.merges['E7'] = 'D7'; }, 'MUTACION combinada: E7 mitad muda de D7');
    abortaCon(h => { h.validaciones['E7'] = { tipo: 'VALUE_IN_LIST', valores: [['Si', 'No']] }; }, 'MUTACION validacion ajena: E7 con opciones Si/No');
    abortaCon(h => { h.celdas['I15'].formula = ''; }, 'MUTACION mirror: I15 sin formula (falta una cuenta del espejo)');
    abortaCon(h => { h.celdas['J15'] = { valor: 12345, formula: '' }; }, 'MUTACION valor a mano: J15=12345 sin formula (dato de Franco)');
    abortaCon(h => { h.merges['J7'] = 'I7'; }, 'MUTACION titulo combinado: J7 mitad muda de I7');
    abortaCon(h => { h.celdas['J8'].formula = ''; }, 'MUTACION total: J8 sin formula (el invariante no tendria que leer)');

    // --- Validacion YA correcta: no aborta, y el plan no la vuelve a proponer ---
    {
        const h = hojaBase();
        h.validaciones['E7'] = { tipo: 'VALUE_IN_LIST', valores: [[ctx.PM_MODO.proyeccion, ctx.PM_MODO.historico]] };
        const pre = ctx._preflightPm(ssCon(h));
        ok(pre.validacion.existe === true, 'con la validacion correcta ya puesta, el preflight la reconoce y no aborta');
        const plan = ctx._planPm(pre);
        ok(plan.faltaValidacion === false, 'y el plan no la vuelve a pedir (idempotencia de la validacion)');
    }
}

console.log('\n' + '='.repeat(60));
if (fallas === 0) { console.log('TODO OK'); process.exit(0); }
console.log(fallas + ' FALLA(S)');
process.exit(1);
