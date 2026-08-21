/**
 * devtools/probar_inicio_presupuesto.js
 * Banco de pruebas de DEVTOOL_InicioPresupuesto.js.
 *
 * Cuatro mitades:
 *
 * 1. ESTRUCTURA DE LAS FORMULAS que el modulo emite: cero arrays literales {} (setFormula no
 *    los traduce en es_AR), cero comas fuera de strings (el separador es ;, y un decimal 0,5
 *    tambien caeria aca), parentesis y comillas balanceados, variables de LET y de LAMBDA de
 *    3+ caracteres, cotizaciones SOLO por TIDETRACK_*(), selectores de INICIO y jamas los del
 *    Tablero, y el SPARKLINE armado con VSTACK/HSTACK.
 *
 * 2. EL CABLEADO: que el plan proponga exactamente las celdas del pedido y NINGUNA que ya
 *    escriba otro modulo (el barrido anti-colision de probar_capitalizacion, extendido: como
 *    este modulo pasa las celdas por constante y no por literal, sus celdas se inyectan al
 *    barrido desde el plan real).
 *
 * 3. LA MATEMATICA, espejada en JS: la identidad D19=D20+D21+D22, los tres regimenes del
 *    reparto (mismo diseno que DEVTOOL_Capitalizacion), el delta contra la tendencia, y desde
 *    v0.37.0 el PROMEDIO de esa misma ventana. No prueban la formula: prueban el DISENO, y la
 *    mitad 1 ata el espejo a la forma de la formula.
 *
 * 4. DESDE v0.37.0: que las celdas AUXILIARES (trastienda AV/AW) carguen la formula pesada UNA
 *    sola vez, que las celdas VISIBLES (F10/C15/F15) sean texto liviano que solo LEE esas
 *    auxiliares, que el color siga siendo numerico apuntando a la auxiliar (nunca al texto), y
 *    que F10 sume el flujo del periodo REFERENCIANDO E22 en vez de recalcularlo. Cubre, por
 *    mutacion dirigida: la regla de color mirando el texto en vez de la auxiliar (el bug de
 *    v0.34.0, reconstruido a proposito), la serie pesada calculada dos veces, F10 anclado a
 *    TODAY() en vez del selector, el flujo reimplementado en vez de leer E22, el monto del
 *    flujo con signo Y con la palabra a la vez, y la palabra invertida (positivo="retirados").
 *
 * USO:  node devtools/probar_inicio_presupuesto.js
 * @version 0.37.0
 * @since 2026-08-20
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON,
    SpreadsheetApp: {
        flush() {},
        getActiveSpreadsheet: () => ({
            getSheets: () => ['Inicio', 'Tablero', 'Presupuesto', 'Cargas', 'Plan de Cuentas',
                              'Mirada Interanual', 'Registros', 'Tipos de Cambio', 'Proyeccion']
                              .map(n => ({ getName: () => n })),
            getSheetByName: () => null
        })
    },
    PropertiesService: {}, Utilities: { sleep() {},}, Session: {}, Logger: { log() {} },
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_InicioPresupuesto.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,TIPOS_RIQUEZA,CUENTAS_NEUTRAS,CUENTA_ARRASTRE,CAP_SELECTORES,IP_RESUMEN,IP_AUX,IP_SUFIJO_DELTA,IP_MESES_TENDENCIA,' +
    'MONEDAS_DISPONIBLES,IP_BLOQUE,IP_RESUMEN,IP_SELECTORES,IP_MOTOR,IP_MESES_TENDENCIA,IP_FLECHA_SUBE,IP_FLECHA_BAJA,IP_FLECHA_PLANA,IP_CLAVES_DELTA,IP_MAS_ES_MEJOR,IP_MENOS_ES_MEJOR,IP_COLOR_VERDE,IP_COLOR_ROJO,IP_PATRON_PORCENTAJE,IP_PATRON_MONEDA,IP_SEPARADOR});',
    ctx);

// ============================================================================
// El chequeo estructural de una formula (trampas es_AR)
// ============================================================================
function revisar(nombre, f) {
    const p = [];
    if (!f || f[0] !== '=') p.push('no empieza con =');
    if (f.indexOf('{') !== -1) p.push('tiene un array literal {} -- setFormula no lo traduce en es_AR');
    // Comas: se sacan los strings ("Enero,Febrero...", colores) y no puede quedar NI UNA.
    // Esto atrapa tanto una coma-separador como un literal decimal 0,5.
    const sinStrings = f.replace(/"[^"]*"/g, '""');
    if (sinStrings.indexOf(',') !== -1) p.push('tiene una coma fuera de un string: separador equivocado o decimal con coma');
    let par = 0, com = 0;
    for (const ch of f) { if (ch === '(') par++; else if (ch === ')') par--; else if (ch === '"') com++; }
    if (par !== 0) p.push('parentesis desbalanceados (' + par + ')');
    if (com % 2 !== 0) p.push('comillas desbalanceadas');
    (f.match(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/g) || []).forEach(x => {
        const v = x.trim().replace(';', '').trim();
        if (v.length <= 2) p.push('variable LET "' + v + '" es muy corta: puede chocar con una funcion');
    });
    (f.match(/LAMBDA\(\s*[A-Za-z_][A-Za-z0-9_]*\s*[;)]/g) || []).forEach(x => {
        const v = x.replace(/LAMBDA\(\s*/, '').replace(/\s*[;)]$/, '');
        if (v.length <= 2) p.push('parametro de LAMBDA "' + v + '" es muy corto: puede chocar con una funcion');
    });
    if (/DATEVALUE/.test(f)) p.push('usa DATEVALUE, que depende del locale: el mes va por MATCH+SPLIT');
    if (/Tipos de Cambio|Tipos de cambio/.test(f)) p.push('referencia el bloque de cotizaciones por coordenada: las cotizaciones van por TIDETRACK_*()');
    if (/Tablero!|\$N\$[234]/.test(f)) p.push('referencia al Tablero o a sus selectores: Inicio y Tablero tienen selectores INDEPENDIENTES');
    if (p.length) { fallas++; console.log('\n### FALLA ' + nombre + ': ' + p.join(', ')); }
    return !p.length;
}

// ============================================================================
// El plan real del modulo, sobre una hoja falsa vacia (propone todo)
// ============================================================================
const hojaFalsa = {
    getRange: () => ({ getFormula: () => '', getValue: () => '', getDisplayValue: () => '', getNumberFormat: () => '' }),
    // Hoja sin ninguna regla de color: el plan tiene que proponer las seis.
    getConditionalFormatRules: () => []
};
const plan = ctx._planIp(null, { hoja: hojaFalsa, nombre: 'Inicio' });
const porCelda = {};
plan.cambios.forEach(c => {
    if (!c.esFormato) porCelda[c.celda] = c.formulaNueva;
});

console.log('=== 0. Las tres publicas existen ===');
['estadoInicioPresupuesto', 'aplicarInicioPresupuesto', 'revertirInicioPresupuesto'].forEach(n =>
    ok(typeof ctx[n] === 'function', n + ' es una funcion'));

console.log('\n=== 1. EL CABLEADO: que celda recibe que ===');
{
    const esperadasFormula = ['D19', 'D20', 'D21', 'D22', 'E19', 'E20', 'E21', 'E22',
                              'F19', 'F20', 'F21', 'F22', 'G19', 'G20', 'G21', 'G22',
                              'AV8', 'AV9', 'AV10', 'F10', 'C15', 'F15'];
    ok(Object.keys(porCelda).length === esperadasFormula.length,
       'el plan propone ' + esperadasFormula.length + ' formulas. Propuso ' + Object.keys(porCelda).length);
    esperadasFormula.forEach(c => ok(!!porCelda[c], c + ' recibe formula'));
    Object.keys(porCelda).forEach(c => ok(esperadasFormula.indexOf(c) !== -1,
       c + ' esta en la lista esperada (no hay celdas de mas)'));
    // DESDE v0.37.0: los deltas son TEXTO por formula, no numero con formato. Ningun cambio
    // propuesto puede ser de formato -- si alguno lo fuera, seria un resabio del diseno v0.34.0.
    ok(plan.cambios.every(c => !c.esFormato),
       'ningun cambio propuesto es de formato: los tres deltas dejaron de ser numero con formato');
}

console.log('\n=== 1b. Ningun modulo se pisa con otro (barrido anti-colision) ===');
// Reusa el barrido de probar_capitalizacion (celdas literales en llamadas a proponer) y le
// INYECTA las celdas del plan real de este modulo, que van por constante y el regex no ve.
{
    const dir = path.join(RAIZ, 'src');
    const prop = {};
    fs.readdirSync(dir).filter(f => f.indexOf('DEVTOOL_') === 0).forEach(f => {
        const src = fs.readFileSync(path.join(dir, f), 'utf8');
        const re = /proponer\(\s*(?:[A-Za-z_.]+\s*,\s*)?'([A-Z]{1,2}\d{1,3})'/g;
        let m;
        while ((m = re.exec(src)) !== null) {
            (prop[m[1]] = prop[m[1]] || new Set()).add(f);
        }
    });
    plan.cambios.forEach(c => {
        if (c.esFormato) return;   // el formato de una celda propia no es una colision consigo misma
        (prop[c.celda] = prop[c.celda] || new Set()).add('DEVTOOL_InicioPresupuesto.js');
    });
    const choques = Object.keys(prop).filter(c => prop[c].size > 1)
        .map(c => c + ' <- ' + [...prop[c]].join(' y '));
    ok(choques.length === 0, choques.length ? 'DOS MODULOS EN LA MISMA CELDA: ' + choques.join('; ')
                                            : 'ninguna celda la proponen dos modulos distintos');

    // Y contra la lista MEDIDA de celdas que otros modulos ya escriben (trampa 6): el regex no
    // ve las que se proponen por constante, asi que la lista va explicita.
    const tomadas = ['N9', 'N10', 'N11', 'N12', 'N16', 'N17', 'N18', 'N19', 'O9', 'O10', 'O11', 'O12',
                     'O16', 'O23', 'O24', 'O25', 'AG9', 'AG10', 'AG11', 'AG12', 'C18', 'F18', 'H18',
                     'C8', 'F8'];
    const invadidas = plan.cambios.map(c => c.celda).filter(c => tomadas.indexOf(c) !== -1);
    ok(invadidas.length === 0, invadidas.length
        ? 'el plan propone celdas de otros modulos: ' + invadidas.join(', ')
        : 'el plan no toca ninguna celda que ya escriba otro modulo');
}

console.log('\n=== 2. Estructura de las 22 formulas ===');
Object.keys(porCelda).forEach(c => { if (revisar(c, porCelda[c])) console.log('  OK  ' + c); });

console.log('\n=== 3. LA IDENTIDAD: la Capacidad es el residuo, en las dos columnas ===');
{
    ok(porCelda.D22 === '=D19-D20-D21', 'D22 es el residuo del presupuesto. Dio ' + porCelda.D22);
    // decision Franco 2026-08-20: el plan asigna (D22 residuo), la realidad SE MIDE (E22).
    ok(porCelda.E22 !== '=E19-E20-E21', 'E22 NO es un residuo: la realidad se mide, no se descarta');
    ok(porCelda.E22.indexOf(ctx.RANGES.REGISTROS.sheet + '!') !== -1,
       'E22 lee el LEDGER: es la capitalizacion efectiva del mes');
    ok(/\$I\$2/.test(porCelda.E22) && /\$I\$4/.test(porCelda.E22),
       'E22 usa los selectores de INICIO ($I$2/$I$4), no los del Tablero');
    ok(!/\$N\$[234]/.test(porCelda.E22), 'E22 no toca los selectores del Tablero ni por accidente');
    // Y que sea LA MISMA formula que Tablero!O19: si divergen, las dos hojas mostrarian
    // capitalizaciones distintas para el mismo mes sin que nada lo delate.
    const oTablero = ctx._formulaHaciaRiqueza(ctx.RANGES.REGISTROS.sheet, ctx.CAP_SELECTORES.tablero);
    ok(porCelda.E22.replace(/\$I\$([234])/g, 'S$1') === oTablero.replace(/\$N\$([234])/g, 'S$1'),
       'E22 e Tablero!O19 son LA MISMA formula salvo los selectores de cada hoja');
    [porCelda.D22].forEach(f =>
        ok(!/MAX\(0/.test(f), 'sin piso en cero: taparlo esconde el sobrecompromiso (' + f + ')'));
    // El espejo numerico: los tres destinos suman el 100% de los ingresos, siempre.
    const residuo = (ing, fij, vari) => ing - fij - vari;
    const suman100 = (ing, fij, vari) => ing === 0 ||
        Math.abs((fij + vari + residuo(ing, fij, vari)) / ing - 1) < 1e-12;
    ok(suman100(100, 40, 30), 'caso normal: 40 + 30 + 30 = 100%');
    ok(suman100(100, 200, 300), 'deficit extremo: la identidad aguanta el residuo negativo');
    let peor = 0;
    for (let i = 0; i < 3000; i++) {
        const r = n => ((i * 7919 + n * 104729) % 1000003) / 1000003;
        const ing = 1 + r(1) * 5000000, fij = r(2) * 4000000, vari = r(3) * 4000000;
        peor = Math.max(peor, Math.abs((fij + vari + residuo(ing, fij, vari)) / ing - 1));
    }
    ok(peor < 1e-12, '3000 casos al azar: la identidad se cumple siempre (peor desvio ' + peor.toExponential(1) + ')');
}

console.log('\n=== 4. Columna D: el presupuesto lee la Proyeccion con los selectores de INICIO ===');
['D19', 'D20', 'D21'].forEach(c => {
    const f = porCelda[c];
    ok(f.indexOf(ctx.SHEETS.PROYECCION + '!') !== -1, c + ' lee la hoja ' + ctx.SHEETS.PROYECCION);
    ok(/\$I\$2/.test(f) && /\$I\$3/.test(f) && /\$I\$4/.test(f),
       c + ' usa los selectores de Inicio ($I$2/$I$3/$I$4)');
    ok(/MATCH\(\$I\$2; SPLIT\("Enero,/.test(f), c + ' resuelve el mes con MATCH+SPLIT de la lista castellana');
    ok(/TIDETRACK_USD\(\)/.test(f) && /TIDETRACK_AUD\(\)/.test(f) && /TIDETRACK_EUR\(\)/.test(f),
       c + ' convierte con TIDETRACK en vivo (la Proyeccion no congela TC)');
    ctx.CUENTAS_NEUTRAS.forEach(cta => ok(f.indexOf('<>"' + cta + '"') !== -1,
       c + ' excluye la cuenta neutra "' + cta + '"'));
    ok(/\(fecha>=desde\) \* \(fecha<=hasta\)/.test(f), c + ' acota al mes seleccionado');
    ok(f.indexOf('Registros!') === -1, c + ' NO lee Registros: el presupuesto sale de la Proyeccion');
});
ok(/tipo_cuenta="Ingreso"/.test(porCelda.D19), 'D19 filtra Ingreso');
ok(/tipo_cuenta="Gasto Fijo"/.test(porCelda.D20), 'D20 filtra Gasto Fijo');
ok(/tipo_cuenta="Gasto Variable"/.test(porCelda.D21), 'D21 filtra Gasto Variable');

console.log('\n=== 5. Columna E: la realidad lee el motor de la hoja (TC congelados) ===');
{
    const refValor = ctx.IP_MOTOR.colValor + ctx.IP_MOTOR.filaDatos + ':' + ctx.IP_MOTOR.colValor;
    const refTipo = ctx._rangoMotorIp('tipo');
    const refCuenta = ctx._rangoMotorIp('cuenta');
    const refCat = ctx._rangoMotorIp('tipo_cuenta');
    ok(refValor === 'AF8:AF' && refTipo === 'U8:U' && refCuenta === 'V8:V' && refCat === 'W8:W',
       'las columnas del motor derivadas de RANGES son las medidas (AF8:AF, U8:U, V8:V, W8:W). ' +
       'Dieron ' + [refValor, refTipo, refCuenta, refCat].join(', '));
    ['E19', 'E20', 'E21'].forEach(c => {
        const f = porCelda[c];
        ok(f.indexOf(refValor) !== -1, c + ' suma la columna convertida ' + refValor);
        ok(f.indexOf(refTipo) !== -1 && f.indexOf(refCuenta) !== -1 && f.indexOf(refCat) !== -1,
           c + ' lee tipo/cuenta/categoria del motor');
        ok(!/TIDETRACK/.test(f), c + ' NO reconvierte: la columna del motor ya trae los TC congelados');
        ok(!/QUERY/.test(f), c + ' no usa QUERY: LET+FILTER, sin arrays literales');
        ctx.CUENTAS_NEUTRAS.forEach(cta => ok(f.indexOf('<>"' + cta + '"') !== -1,
           c + ' excluye la cuenta neutra "' + cta + '"'));
        ok(f.indexOf('(cuenta_mov<>"")') !== -1, c + ' excluye las filas sin cuenta');
    });
    ok(/IF\(tipo_mov="Egreso"; -monto_conv/.test(porCelda.E19),
       'E19 (ingresos): un Egreso resta (devolucion)');
    [['E20', 'Gasto Fijo'], ['E21', 'Gasto Variable']].forEach(par => {
        ok(new RegExp('cat_mov="' + par[1] + '"').test(porCelda[par[0]]), par[0] + ' filtra ' + par[1]);
        ok(/IF\(tipo_mov="Ingreso"; -monto_conv/.test(porCelda[par[0]]),
           par[0] + ' (gastos): un Ingreso resta (reintegro)');
    });
}

console.log('\n=== 6. Columna F: la barra de consumo ===');
['F19', 'F20', 'F21', 'F22'].forEach(c => {
    const f = porCelda[c];
    const fila = c.slice(1);
    ok(/SPARKLINE\(/.test(f), c + ' es un SPARKLINE');
    ok(f.indexOf('VSTACK(HSTACK("charttype"; "bar"); HSTACK("max"; 1)') !== -1 &&
       f.indexOf('HSTACK("color1"; color_nivel); HSTACK("color2"; riel_nivel))') !== -1,
       c + ' arma las opciones con VSTACK/HSTACK, sin arrays literales');
    // LA BARRA VA APILADA. Suelta, al 0% mide cero y no se dibuja: la fila queda visualmente
    // vacia, igual que una celda sin formula. Paso el 2026-08-21 con la Capacidad de
    // Capitalizacion, justo el mes que mas gritaba.
    ok(f.indexOf('SPARKLINE(HSTACK(consumo; 1 - consumo)') !== -1,
       c + ' apila el resto contra un riel: al 0% la barra tiene que verse igual');
    ok(/riel_nivel; IF\(consumo/.test(f), c + ' el riel tambien sigue el semaforo de la fila');
    ok(f.indexOf('#e6f4ea') !== -1 && f.indexOf('#fef7e0') !== -1 && f.indexOf('#fce8e6') !== -1,
       c + ' el riel usa los tonos PALIDOS de los mismos pares del Tablero');
    ok(f.indexOf('$E$' + fila + ' / $D$' + fila) !== -1, c + ' mide E' + fila + '/D' + fila);
    ok(/MAX\(0; MIN\(1;/.test(f), c + ' acota el consumo a 0..1');
    ok(/1\/2/.test(f) && /4\/5/.test(f),
       c + ' usa los umbrales 1/2 y 4/5 (fracciones, sin decimales con coma)');
    ok(f.indexOf('#356854') !== -1 && f.indexOf('#ffb300') !== -1 && f.indexOf('#c93232') !== -1,
       c + ' usa la paleta de los formatos condicionales del Tablero');
    ok(!/#a9bca1|#db9940|#da8b7b/.test(f), c + ' ya no trae la paleta vieja de la planilla anterior');
    // Sin presupuesto no se divide: es la trampa de N25 (dividir por algo que tiende a cero da
    // un numero absurdo con cara de dato, no un error).
    ok(f.indexOf('IF($D$' + fila + ' <= 0; IF($E$' + fila + ' > 0; 1; 0);') !== -1,
       c + ' con presupuesto <= 0 no divide: resuelve el cumplimiento antes del cociente');
});
ok(porCelda.F22.indexOf('$E$22 / $D$22') !== -1, 'la fila de Capacidad mide E22/D22, igual que las otras');

// EL SEMAFORO SE DA VUELTA SEGUN LA FILA (decision Franco 2026-08-21).
{
    const masEsMejor = ['F19', 'F22'];   // Ingresos, Capacidad de Capitalizacion
    const menosEsMejor = ['F20', 'F21']; // Gastos Fijos, Gastos Variables
    masEsMejor.forEach(c => {
        ok(porCelda[c].indexOf('IF(consumo >= 4/5; "#356854"') !== -1,
           c + ' (mas es mejor) da VERDE del 80% de cumplimiento para arriba');
        ok(porCelda[c].indexOf('IF(consumo >= 1/2; "#ffb300"; "#c93232")') !== -1,
           c + ' (mas es mejor) cae a rojo por debajo del 50%');
    });
    menosEsMejor.forEach(c => {
        ok(porCelda[c].indexOf('IF(consumo < 1/2; "#356854"') !== -1,
           c + ' (menos es mejor) da VERDE por debajo del 50% de consumo');
        ok(porCelda[c].indexOf('IF(consumo <= 4/5; "#ffb300"; "#c93232")') !== -1,
           c + ' (menos es mejor) llega a rojo pasado el 80%');
    });
    // La mutacion que importa: si alguien uniformiza el semaforo, las dos escalas se vuelven una.
    ok(porCelda.F19.indexOf('consumo >= 4/5') !== -1 && porCelda.F21.indexOf('consumo < 1/2') !== -1,
       'las dos escalas conviven: uniformizarlas volveria a pintar de rojo un mes que se paso de bueno');
}

console.log('\n=== 7. Columna G: la distribucion de fondos disponibles ===');
{
    ok(porCelda.G19 === '=""', 'G19 (Ingresos) queda vacia: los ingresos no reciben distribucion. Dio ' + porCelda.G19);
    ok(!/reparto|rem_|peso_/.test(porCelda.G19), 'G19 no calcula ningun reparto');
    const claves = ['fijos', 'variables', 'capitalizacion'];
    const celdaDe = { fijos: 'G20', variables: 'G21', capitalizacion: 'G22' };
    claves.forEach(k => {
        const f = porCelda[celdaDe[k]];
        ok(/liquidez; \$C\$8/.test(f), celdaDe[k] + ': la liquidez es el Saldo Actual de la propia hoja ($C$8)');
        ok(f.indexOf('suma_rem; rem_fijos + rem_variables + rem_capitalizacion') !== -1,
           celdaDe[k] + ': comparte el denominador con las otras dos (si no, el reparto no sumaria la liquidez)');
        ok(f.indexOf('rem_' + k + ' / suma_rem') !== -1, celdaDe[k] + ': su numerador es su propio remanente');
        ok(f.indexOf('peso_' + k + ' / suma_peso') !== -1,
           celdaDe[k] + ': cuando no queda remanente, reparte por SU peso de presupuesto');
        ok(/rem_fijos; MAX\(0; \$D\$20 - \$E\$20\)/.test(f),
           celdaDe[k] + ': el remanente de fijos se mide contra D20/E20 de este bloque');
        ok(/rem_capitalizacion; MAX\(0; \$D\$22 - \$E\$22\)/.test(f),
           celdaDe[k] + ': el remanente de capitalizacion se mide contra D22/E22');
    });
    ok(/excedente/.test(porCelda.G22), 'solo capitalizacion recibe el excedente');
    ok(!/excedente/.test(porCelda.G20) && !/excedente/.test(porCelda.G21),
       'fijos y variables NO reciben excedente: el sobrante despues de cubrir todo es capitalizar');
}

console.log('\n=== 7b. La regla de reparto (espejo en JS del diseno, como en probar_capitalizacion) ===');
{
    const claves = ['fijos', 'variables', 'capitalizacion'];
    function repartir(liquidez, presu, real) {
        const rem = {}, peso = {};
        claves.forEach(k => { rem[k] = Math.max(0, presu[k] - real[k]); peso[k] = Math.max(0, presu[k]); });
        const sumaRem = claves.reduce((a, k) => a + rem[k], 0);
        const sumaPeso = claves.reduce((a, k) => a + peso[k], 0);
        const out = {};
        claves.forEach(k => {
            const parte = sumaPeso > 0 ? peso[k] / sumaPeso : 1 / 3;
            out[k] = sumaRem > 0 ? Math.min(rem[k], liquidez * rem[k] / sumaRem) : liquidez * parte;
        });
        out.capitalizacion += sumaRem > 0 ? Math.max(0, liquidez - sumaRem) : 0;
        return out;
    }
    const suma = o => claves.reduce((a, k) => a + o[k], 0);
    const cerca = (a, b) => Math.abs(a - b) < 0.000001;

    let r = repartir(100, { fijos: 200, variables: 100, capitalizacion: 100 }, { fijos: 0, variables: 0, capitalizacion: 0 });
    ok(cerca(suma(r), 100), 'regimen 1 (no alcanza): las tres suman la liquidez. Dio ' + suma(r).toFixed(2));
    r = repartir(1000, { fijos: 200, variables: 100, capitalizacion: 100 }, { fijos: 0, variables: 0, capitalizacion: 0 });
    ok(cerca(suma(r), 1000) && cerca(r.capitalizacion, 700), 'regimen 2 (sobra): el sobrante va entero a capitalizacion');
    r = repartir(300, { fijos: 100, variables: 200, capitalizacion: 100 }, { fijos: 150, variables: 250, capitalizacion: 150 });
    ok(cerca(suma(r), 300) && r.fijos > 0 && r.variables > 0 && r.capitalizacion > 0,
       'regimen 3 (todo pasado del 100%): reparte por peso, ninguna queda en cero');
    let peor = 0;
    for (let i = 0; i < 3000; i++) {
        const rnd = n => Math.round((((i * 9301 + 49297 + n * 233) % 233280) / 233280) * 2000000) - 300000;
        const liq = Math.abs(rnd(7)) % 900000;
        const p = { fijos: rnd(1), variables: rnd(2), capitalizacion: rnd(3) };
        const q = { fijos: Math.abs(rnd(4)), variables: Math.abs(rnd(5)), capitalizacion: Math.abs(rnd(6)) };
        peor = Math.max(peor, Math.abs(suma(repartir(liq, p, q)) - liq));
    }
    ok(peor < 0.000001, '3000 casos al azar: las tres siempre suman la liquidez (peor desvio ' + peor.toExponential(1) + ')');
}

console.log('\n=== 8. AV8 (auxiliar de capital): la formula pesada, ANCLADA AL SELECTOR ===');
{
    const f = porCelda.AV8;
    ok(f.indexOf('MAP(SEQUENCE(' + ctx.IP_MESES_TENDENCIA + ')') !== -1,
       'AV8 recorre los ' + ctx.IP_MESES_TENDENCIA + ' meses previos con MAP/SEQUENCE, sin arrays literales');
    // decision Franco 2026-08-21: la ventana ahora ANCLA AL SELECTOR, no a TODAY(). Es la
    // mutacion que Franco pidio cubrir explicitamente: "la tendencia del capital anclada a
    // TODAY() en vez de al selector" tiene que morir aca.
    ok(/EOMONTH\(ancla_mes; k_mes - 6\)/.test(f),
       'AV8 ancla cada punto de la serie al selector (ancla_mes), no a TODAY()');
    ok(!/TODAY\(\)/.test(f), 'AV8 YA NO usa TODAY() en ningun lado');
    ok(/mes_num; MATCH\(\$I\$2; SPLIT\("Enero,/.test(f) && /ancla_mes; DATE\(\$I\$3; mes_num; 1\)/.test(f),
       'AV8 resuelve el mes con el MISMO patron que los auxiliares de flujo (selector de Inicio)');
    ok(/\$I\$2/.test(f) && /\$I\$3/.test(f), 'AV8 SI depende del selector de mes/anio (dejo de ser un stock puro)');
    ok(!/\$I\$4/.test(f), 'AV8 NO depende del selector de moneda: el delta es un cociente en ARS');
    ok(f.indexOf('col_cuenta="' + ctx.CUENTA_ARRASTRE + '"') !== -1 && f.indexOf('col_fecha<=tope') !== -1,
       'el corte es el ultimo "' + ctx.CUENTA_ARRASTRE + '" de cada medio ACOTADO a la fecha de cierre');
    ctx.TIPOS_RIQUEZA.forEach(t => ok(f.indexOf('(tipo_fila="' + t + '")') !== -1,
       'la lista blanca de riqueza incluye "' + t + '"'));
    ok(f.indexOf("'Plan de Cuentas'!") !== -1, 'el tipo del medio sale del Plan de Cuentas vivo (no del mapa TDM)');
    ok(/TIDETRACK_USD\(\)/.test(f) && /TIDETRACK_AUD\(\)/.test(f) && /TIDETRACK_EUR\(\)/.test(f),
       'convierte las monedas por funcion, no por coordenada');
    ok(/SLOPE\(serie_cap; SEQUENCE\(6\)\)/.test(f), 'AV8 mide la TENDENCIA de la serie (SLOPE)');
    ok(f.indexOf('HSTACK(tend_frac; nivel_tend)') !== -1,
       'AV8 termina en HSTACK(tendencia; promedio): las dos salen de la MISMA serie, calculada una sola vez');
    ok(!/capital_hoy/.test(f), 'AV8 no compara el capital de hoy contra nada: un punto solo no es una tendencia');
    ok(!/AVERAGE\(cierres_previos\)/.test(f), 'AV8 no promedia cierres previos por fuera de _tendenciaYPromedioIp');
}

console.log('\n=== 8b. F10 (visible): LEE la auxiliar, no la recalcula, y agrega el flujo del periodo ===');
{
    const f = porCelda.F10;
    // LA SERIE PESADA NO SE DUPLICA: si F10 volviera a traer alguno de estos tokens, la estaria
    // recalculando por su cuenta -- exactamente la mutacion que Franco pidio cubrir.
    ['MAP(SEQUENCE', 'SLOPE(', 'capital_al', 'FILTER(', 'TIDETRACK_USD()', 'TIDETRACK_AUD()', 'TIDETRACK_EUR()']
        .forEach(tok => ok(f.indexOf(tok) === -1, 'F10 NO contiene "' + tok + '": la serie pesada vive SOLO en la auxiliar AV8'));

    const refTend = ctx._absIp(ctx.IP_AUX.deltaCapital.tendencia);
    const refProm = ctx._absIp(ctx._celdaPromedioIp(ctx.IP_AUX.deltaCapital.tendencia));
    ok(refTend === '$AV$8', 'la auxiliar de capital es AV8. Dio ' + refTend);
    ok(refProm === '$AW$8', 'el promedio de capital derrama en AW8, una columna a la derecha de AV8. Dio ' + refProm);
    ok(f.indexOf(refTend) !== -1, 'F10 lee la tendencia de la auxiliar (' + refTend + ')');
    ok(f.indexOf(refProm) !== -1, 'F10 lee el promedio derramado de la auxiliar (' + refProm + ')');

    // EL FLUJO DEL PERIODO: se REFERENCIA E22, no se recalcula. Mutacion pedida por Franco: "el
    // flujo del periodo calculado con una formula propia en vez de reusar _formulaHaciaRiqueza".
    const refE22 = ctx._absIp(ctx.IP_BLOQUE.colRealidad + ctx.IP_BLOQUE.filas.capitalizacion.fila);
    ok(refE22 === '$E$22', 'la celda de capitalizacion real es E22. Dio ' + refE22);
    ok(f.indexOf(refE22) !== -1, 'F10 lee ' + refE22 + ' (la MISMA capitalizacion medida que ya usan E22 y Tablero!O19)');
    ok(f.indexOf(ctx.RANGES.REGISTROS.sheet + '!') === -1,
       'F10 NO lee Registros directo: el flujo del periodo sale de referenciar E22, no de recalcularlo');
    ['es_riqueza', 'no_corte', 'tipo_medio', 'signo;'].forEach(tok =>
        ok(f.indexOf(tok) === -1, 'F10 no reimplementa _formulaHaciaRiqueza (sin "' + tok + '"): la reusa por referencia'));

    // "inyectados" si es positivo, "retirados" si es negativo, EN ESE ORDEN -- la palabra
    // invertida es una de las mutaciones que Franco pidio cubrir explicitamente.
    // El patron va por la CONSTANTE (ctx.IP_PATRON_MONEDA), nunca hardcodeado: hardcodear el
    // string exacto es justo el agujero que dejo pasar el patron con coma decimal de v0.37.0
    // (ver seccion 10 mas abajo, donde SI se fija el valor correcto de la constante).
    ok(f.indexOf('flujo>0; TEXT(flujo; "' + ctx.IP_PATRON_MONEDA + '") & " inyectados en " & $I$2') !== -1,
       'F10: flujo POSITIVO dice "inyectados", SIN ABS() -- ahi el signo ya es positivo');
    ok(f.indexOf('flujo<0; TEXT(ABS(flujo); "' + ctx.IP_PATRON_MONEDA + '") & " retirados en " & $I$2') !== -1,
       'F10: flujo NEGATIVO dice "retirados" y usa ABS() -- la palabra ya dice el signo, no se repite con un "-"');
    ok(f.indexOf('"sin movimientos de capital en " & $I$2') !== -1,
       'F10: flujo en CERO tiene su propia frase (ni "inyectados" ni "retirados" describen a cero)');
    ok(f.indexOf('$I$2') !== -1, 'F10 nombra el MES elegido (selector), no un mes fijo');

    // EL GUARDIAN ISNUMBER: sin el, un "Loading..." de la auxiliar o de E22 se concatenaria como
    // si fuera un dato, en vez de mostrarse tal cual.
    ['ISNUMBER(tendencia)', 'ISNUMBER(promedio)', 'ISNUMBER(flujo)'].forEach(tok =>
        ok(f.indexOf(tok) !== -1, 'F10 revisa ' + tok + ' antes de armar el texto'));
    ok(/pendiente; IF\(NOT\(ISNUMBER\(tendencia\)\); tendencia;/.test(f),
       'si la tendencia no es numero, F10 propaga ESA celda pendiente tal cual (no arma texto encima)');
    ok(/IF\(pendiente<>""; pendiente; LET\(/.test(f), 'F10 corta ANTES de concatenar si algo esta pendiente');
}

console.log('\n=== 9. AV9 y AV10 (auxiliares de flujo): la formula pesada de ingresos/egresos ===');
[['AV9', true], ['AV10', false]].forEach(par => {
    const c = par[0], esIngresos = par[1];
    const f = porCelda[c];
    ok(f.indexOf('Registros!') !== -1, c + ' lee directo de Registros');
    ok(/\$I\$2/.test(f) && /\$I\$3/.test(f), c + ' ancla al mes del selector de Inicio');
    ok(!/\$I\$4/.test(f), c + ' NO depende del selector de moneda: cociente en ARS con TC congelados');
    ['tc_ars', 'tc_usd', 'tc_aud', 'tc_eur'].forEach(k =>
        ok(f.indexOf(ctx._colLedger(k)) !== -1, c + ' usa la columna congelada ' + ctx._colLedger(k)));
    ok(/MAP\(SEQUENCE\(6\); LAMBDA\(k_mes;/.test(f), c + ' arma una serie de 6 totales mensuales con MAP/SEQUENCE');
    ok(/EDATE\(ancla_mes; k_mes - 6\)/.test(f), c + ' corre la ventana de -5 a 0 meses respecto del selector');
    ok(/EOMONTH\(ini_k; 0\)/.test(f) && /col_fecha>=ini_k/.test(f) && /col_fecha<=fin_k/.test(f),
       c + ' cada punto es un mes calendario cerrado');
    ok(/SLOPE\(serie_flujo; SEQUENCE\(6\)\)/.test(f), c + ' mide la TENDENCIA de la serie, no el mes contra una media');
    ok(f.indexOf('HSTACK(tend_frac; nivel_tend)') !== -1,
       c + ' termina en HSTACK(tendencia; promedio): una sola serie, dos numeros');
    ok(!/monto_previos|media_prev|monto_actual/.test(f), c + ' ya no separa "el mes" de "los previos"');
    ctx.CUENTAS_NEUTRAS.forEach(cta => ok(f.indexOf('<>"' + cta + '"') !== -1,
       c + ' excluye la cuenta neutra "' + cta + '"'));
    ok(f.indexOf('(col_cuenta<>"")') !== -1, c + ' excluye las filas sin cuenta');
    ok(/base_mov; ARRAYFORMULA\(/.test(f),
       c + ' envuelve las condiciones en ARRAYFORMULA: la interseccion implicita es lo que rompio la formula vieja');
    ok(/IF\(nivel_tend=0; 0;/.test(f), c + ' con la serie entera en cero no divide');
    if (esIngresos) {
        ok(/col_cat="Ingreso"/.test(f), c + ' filtra Ingreso');
        ok(/="Egreso"; -/.test(f), c + ' (ingresos): un Egreso resta');
    } else {
        ok(/col_cat="Gasto Fijo"/.test(f) && /col_cat="Gasto Variable"/.test(f), c + ' filtra los dos tipos de gasto');
        ok(/="Ingreso"; -/.test(f), c + ' (egresos): un Ingreso resta');
    }
});

console.log('\n=== 9b. C15 y F15 (visibles): LEEN su auxiliar, no la recalculan ===');
[['C15', 'deltaIngresos'], ['F15', 'deltaEgresos']].forEach(par => {
    const celda = par[0], clave = par[1];
    const f = porCelda[celda];
    ['MAP(SEQUENCE', 'SLOPE(', 'FILTER(', 'Registros!'].forEach(tok =>
        ok(f.indexOf(tok) === -1, celda + ' NO contiene "' + tok + '": la serie pesada vive SOLO en la auxiliar'));
    const refTend = ctx._absIp(ctx.IP_AUX[clave].tendencia);
    const refProm = ctx._absIp(ctx._celdaPromedioIp(ctx.IP_AUX[clave].tendencia));
    ok(f.indexOf(refTend) !== -1, celda + ' lee la tendencia de su auxiliar (' + refTend + ')');
    ok(f.indexOf(refProm) !== -1, celda + ' lee el promedio derramado (' + refProm + ')');
});

console.log('\n=== 9c. La tendencia Y el promedio (espejo en JS del diseno) ===');
{
    // Espejo exacto de _tendenciaYPromedioIp: pendiente de minimos cuadrados sobre los 6 puntos,
    // multiplicada por el largo de la ventana, sobre el nivel medio (tendencia); y el nivel
    // medio crudo (promedio) -- el mismo AVERAGE que ya se calculaba y se descartaba.
    const promedio = serie => serie.reduce((a, b) => a + b, 0) / serie.length;
    const tendencia = serie => {
        const n = serie.length;
        const xs = serie.map((_, i) => i + 1);
        const mx = xs.reduce((a, b) => a + b, 0) / n;
        const my = promedio(serie);
        const num = serie.reduce((a, y, i) => a + (xs[i] - mx) * (y - my), 0);
        const den = xs.reduce((a, x) => a + (x - mx) * (x - mx), 0);
        const pend = den === 0 ? 0 : num / den;
        return my === 0 ? 0 : pend * (n - 1) / Math.abs(my);
    };
    const cerca = (a, b) => Math.abs(a - b) < 1e-9;

    ok(cerca(tendencia([100, 100, 100, 100, 100, 100]), 0), 'serie plana -> 0% de tendencia');
    ok(tendencia([100, 110, 120, 130, 140, 150]) > 0, 'serie que sube -> tendencia positiva');
    ok(tendencia([150, 140, 130, 120, 110, 100]) < 0, 'serie que baja -> tendencia negativa');
    ok(cerca(tendencia([100, 110, 120, 130, 140, 150]), -tendencia([150, 140, 130, 120, 110, 100])),
       'la misma serie al reves da la tendencia opuesta: el signo es la direccion');
    ok(cerca(tendencia([0, 0, 0, 0, 0, 0]), 0), 'serie toda en cero -> 0%, sin division por cero');

    // La recta que sube 10 por mes sobre un nivel medio de 125 sube 50 en la ventana: 40%.
    ok(cerca(tendencia([100, 110, 120, 130, 140, 150]), 50 / 125), 'una recta de +10/mes sobre nivel 125 da +40%');

    // EL SIGNO SOBREVIVE A UNA SERIE NEGATIVA. Un capital en rojo que se achica es crecimiento;
    // dividir por el promedio sin ABS() lo daria al reves y nadie lo notaria.
    ok(tendencia([-500, -400, -300, -200, -100, -50]) > 0, 'una deuda que se achica es tendencia POSITIVA');

    // POR QUE LA TENDENCIA Y NO EL MES CONTRA LA MEDIA (decision Franco 2026-08-21). Un solo mes
    // fuera de linea movia el numero viejo el doble que la serie entera.
    const conPico = [100, 100, 100, 100, 100, 200];
    const viejoDelta = 200 / ((100 * 5) / 5) - 1;   // el mes contra la media de los 5 previos
    ok(viejoDelta === 1, 'el diseno viejo leia ese pico como +100%');
    ok(tendencia(conPico) < viejoDelta, 'la tendencia no se deja arrastrar por un mes suelto: dio ' +
       (tendencia(conPico) * 100).toFixed(1) + '%, contra el ' + (viejoDelta * 100).toFixed(0) + '% de antes');
    ok(tendencia([100, 120, 140, 160, 180, 200]) > tendencia(conPico),
       'un crecimiento sostenido pesa mas que un mes aislado; el diseno viejo no los distinguia');

    // EL PROMEDIO -- desde v0.37.0 se EXPONE en vez de descartarse. Es el nivel medio crudo, sin
    // ABS(): un capital promedio negativo (una deuda promedio) tiene que seguir viendose negativo.
    ok(cerca(promedio([100, 110, 120, 130, 140, 150]), 125), 'el promedio de la ventana es su AVERAGE simple');
    ok(cerca(promedio([-500, -400, -300, -200, -100, -50]), -1550 / 6),
       'el promedio conserva el signo: una deuda promedio sigue siendo negativa');
    ok(cerca(promedio([0, 0, 0, 0, 0, 0]), 0), 'una ventana entera en cero promedia cero, sin division por nada');
}

console.log('\n=== 10. Coherencia con las constantes del modulo ===');
{
    const filas = ctx.IP_BLOQUE.filas;
    ok(filas.ingresos.fila === 19 && filas.fijos.fila === 20 && filas.variables.fila === 21 &&
       filas.capitalizacion.fila === 22, 'las filas del bloque son 19..22 (las medidas)');
    ok(ctx.IP_BLOQUE.colPresupuesto === 'D' && ctx.IP_BLOQUE.colRealidad === 'E' &&
       ctx.IP_BLOQUE.colConsumo === 'F' && ctx.IP_BLOQUE.colDistribucion === 'G',
       'las columnas del bloque son D/E/F/G (las medidas)');
    ok(ctx.IP_RESUMEN.saldo.celda === 'C8' && ctx.IP_RESUMEN.capital.celda === 'F8',
       'C8/F8 estan declaradas SOLO para revisarlas: el plan no las propone (verificado en 1b)');
    ok(ctx.IP_SELECTORES.mes === 'I2' && ctx.IP_SELECTORES.anio === 'I3' && ctx.IP_SELECTORES.moneda === 'I4',
       'los selectores son I2/I3/I4: la moneda vive en I4, G4 es solo el rotulo');

    // LA GEOMETRIA DE LAS AUXILIARES, medida contra el gemelo el 2026-08-21 (celdas.tsv).
    ok(ctx.IP_AUX.deltaCapital.tendencia === 'AV8' && ctx.IP_AUX.deltaIngresos.tendencia === 'AV9' &&
       ctx.IP_AUX.deltaEgresos.tendencia === 'AV10',
       'las tres auxiliares son AV8/AV9/AV10: una fila por delta, calcando las filas del resumen visible');
    ok(ctx._celdaPromedioIp('AV8') === 'AW8' && ctx._celdaPromedioIp('AV9') === 'AW9' &&
       ctx._celdaPromedioIp('AV10') === 'AW10',
       'el promedio de cada delta cae una columna a la derecha de su tendencia -- ahi derrama el HSTACK');
    ok(ctx._celdaPromedioIp('Z99') === 'AA99',
       '_celdaPromedioIp generaliza mas alla de la columna AV: no hardcodea la letra');

    // LOS PATRONES DE TEXT(): MEDIDO en la planilla real el 2026-08-21 (ver "EL TEXTO DE LOS
    // TRES DELTAS" en DEVTOOL_InicioPresupuesto.js) -- van CANONICOS (punto decimal, coma de
    // miles), la MISMA convencion que setNumberFormat, sin excepcion de locale. Un comentario
    // que afirmaba lo contrario (coma decimal "porque TEXT() si sigue el locale") salio a la
    // planilla en v0.37.0 y produjo exactamente esto: "82,0%" se vio "133%" (perdio el decimal)
    // y "$211.073,04" se vio "$211.073,04333" (decimales de sobra).
    //
    // ESTE ES EL AGUJERO DEL BANCO. Hasta esta version, las dos lineas de abajo pineaban el
    // patron VIEJO ('0,0%' / '$#.##0,00') -- el banco daba SIN FALLAS con el bug adentro, porque
    // solo comprobaba que la constante fuera igual a si misma, nunca que la convencion fuera la
    // correcta. MUTACION VERIFICADA a mano el 2026-08-21: revertir IP_PATRON_PORCENTAJE a '0,0%'
    // (o IP_PATRON_MONEDA a '$#.##0,00') hace fallar ESTAS CUATRO lineas -- las dos ok() de mas
    // abajo no alcanzaban solas, porque solo miran la CONSTANTE; la falla real la dan las dos
    // reglas de "sin coma fuera de comillas" y "con punto decimal", que no dependen de que
    // literal se haya escrito antes.
    ok(ctx.IP_PATRON_PORCENTAJE === '0.0%', 'el patron de porcentaje es CANONICO (punto decimal). Dio ' + ctx.IP_PATRON_PORCENTAJE);
    ok(ctx.IP_PATRON_MONEDA === '$ #,##0.00', 'el patron de moneda es CANONICO (coma de miles, punto decimal, espacio despues del $ -- igual que las 93 formulas propias de Franco en la hoja). Dio ' + ctx.IP_PATRON_MONEDA);
    // Las dos de abajo son la red que de verdad mata la mutacion "volver a la coma decimal": no
    // pinean un literal, verifican la PROPIEDAD que hace que el patron sea correcto o no.
    ok(ctx.IP_PATRON_PORCENTAJE.indexOf(',') === -1,
       'el patron de porcentaje NO tiene coma: si la tuviera, seria el patron viejo que se comia el decimal');
    ok(/^\$ #,##0\.0+$/.test(ctx.IP_PATRON_MONEDA),
       'el patron de moneda tiene el PUNTO como separador decimal (y la coma como separador de miles, dentro de "#,##0"). Dio ' + ctx.IP_PATRON_MONEDA);
    ok(ctx.IP_SEPARADOR.indexOf('·') !== -1, 'el separador visual es un punto medio (U+00B7), tipografia y no emoji');

    // LAS FLECHAS siguen vivas: se concatenan a mano ahora (ya no van en un formato de numero).
    ok(ctx.IP_FLECHA_SUBE === '▲' && ctx.IP_FLECHA_BAJA === '▼' && ctx.IP_FLECHA_PLANA === '–',
       'las flechas son simbolos geometricos Unicode, no emojis');

    // El sufijo se sigue derivando de IP_MESES_TENDENCIA: no puede desfasarse de la ventana real.
    ok(ctx.IP_SUFIJO_DELTA.indexOf(String(ctx.IP_MESES_TENDENCIA)) !== -1,
       'el sufijo nombra los ' + ctx.IP_MESES_TENDENCIA + ' meses que realmente se promedian');

    // Y LAS TRES VISIBLES USAN ESTAS PIEZAS DE VERDAD, no solo la constante existe suelta.
    [['F10', 'deltaCapital'], ['C15', 'deltaIngresos'], ['F15', 'deltaEgresos']].forEach(par => {
        const celda = par[0], clave = par[1], f = porCelda[celda];
        ok(f.indexOf(ctx.IP_SUFIJO_DELTA) !== -1, celda + ' concatena el sufijo de tendencia');
        ok(f.indexOf(ctx.IP_SEPARADOR) !== -1, celda + ' concatena el separador visual');
        ok(f.indexOf('promedio ') !== -1, celda + ' rotula el promedio con la palabra "promedio"');
        ok(f.indexOf(ctx.IP_PATRON_MONEDA) !== -1, celda + ' formatea el promedio en pesos con el patron de moneda');
        // LA FLECHA REEMPLAZA AL SIGNO: se arma con IF(tendencia>0/<0/else), y el porcentaje va
        // en ABS() -- si no, "-52,7%" repetiria el signo que la flecha ya dijo.
        ok(new RegExp('flecha; IF\\(tendencia>0; "' + ctx.IP_FLECHA_SUBE + '"; IF\\(tendencia<0; "' +
            ctx.IP_FLECHA_BAJA + '"; "' + ctx.IP_FLECHA_PLANA + '"\\)\\)').test(f),
           celda + ' arma la flecha por el SIGNO de la tendencia, en el orden sube/baja/plana');
        ok(f.indexOf('TEXT(ABS(tendencia); "' + ctx.IP_PATRON_PORCENTAJE + '")') !== -1,
           celda + ' formatea el porcentaje en ABS(tendencia): la flecha ya dice el signo, no se repite');
        ok(!/TEXT\(tendencia;/.test(f),
           celda + ' nunca formatea la tendencia CON signo (seria "+52,7%" y flecha diciendo lo mismo dos veces)');
        void clave;
    });
}

console.log('\n=== 11. EL COLOR DE LOS DELTAS: apunta a la AUXILIAR, nunca al texto visible ===');
{
    const R = ctx.IP_RESUMEN, A = ctx.IP_AUX;
    const reglas = ctx._reglasDeltaIp();
    ok(reglas.length === 6, 'seis reglas: un par por celda, ni una compartida. Dio ' + reglas.length);

    reglas.forEach(r => {
        ok(/^=\$[A-Z]+\$\d+[<>]0$/.test(r.formula),
           r.celda + ': la condicion es NUMERICA sobre una sola celda (' + r.formula + ')');
        ok(!/contiene|TEXT|"/.test(r.formula),
           r.celda + ': no mira el texto mostrado -- eso se rompe solo al cambiar el formato');

        // LA MUTACION CENTRAL que Franco pidio cubrir: la regla de color apuntando a la celda de
        // TEXTO (F10/C15/F15) en vez de a la auxiliar numerica. Sobre un texto la condicion NO
        // SE CUMPLE NUNCA -- exactamente la superficie del bug de v0.34.0, en otro punto del
        // mismo modulo.
        const refAux = ctx._absIp(A[r.clave].tendencia);
        const refVisible = ctx._absIp(R[r.clave].celda);
        ok(r.formula === '=' + refAux + '>0' || r.formula === '=' + refAux + '<0',
           r.celda + ': la formula evalua la auxiliar ' + refAux + '. Dio ' + r.formula);
        ok(r.formula.indexOf(refVisible) === -1,
           r.celda + ': la formula NO menciona la celda visible ' + refVisible +
           ' -- sobre un texto la condicion no se cumpliria nunca');
        ok(r.celda === R[r.clave].celda, 'el RANGO que se pinta sigue siendo la celda visible ' + R[r.clave].celda);
    });

    const porCeldaReglas = {};
    reglas.forEach(r => { porCeldaReglas[r.celda] = (porCeldaReglas[r.celda] || 0) + 1; });
    ctx.IP_CLAVES_DELTA.forEach(k => ok(porCeldaReglas[R[k].celda] === 2,
       R[k].celda + ' tiene exactamente su propio par de reglas'));

    // LA POLARIDAD, que es el fondo del asunto (heredado de v0.34.0, sigue vigente).
    const color = (clave, signo) => {
        const refAux = ctx._absIp(A[clave].tendencia);
        const r = reglas.find(x => x.clave === clave && x.formula === '=' + refAux + signo + '0');
        return r && r.color;
    };
    ok(color('deltaCapital', '>') === ctx.IP_COLOR_VERDE,
       'capital que SUBE -> verde. Es el caso que Franco reporto en rojo');
    ok(color('deltaCapital', '<') === ctx.IP_COLOR_ROJO, 'capital que BAJA -> rojo');
    ok(color('deltaIngresos', '>') === ctx.IP_COLOR_VERDE, 'ingresos que SUBEN -> verde');
    ok(color('deltaIngresos', '<') === ctx.IP_COLOR_ROJO, 'ingresos que BAJAN -> rojo');
    ok(color('deltaEgresos', '>') === ctx.IP_COLOR_ROJO,
       'egresos que SUBEN -> ROJO, aunque la flecha apunte para el mismo lado que en capital');
    ok(color('deltaEgresos', '<') === ctx.IP_COLOR_VERDE, 'egresos que BAJAN -> verde');
    ok(color('deltaCapital', '>') !== color('deltaEgresos', '>'),
       'capital y egresos NO pueden compartir polaridad: agruparlos fue el bug de v0.34.0');

    ok(ctx.IP_RESUMEN.deltaEgresos.sentido === ctx.IP_MENOS_ES_MEJOR, 'egresos declara menos_es_mejor');
    ok(ctx.IP_RESUMEN.deltaCapital.sentido === ctx.IP_MAS_ES_MEJOR &&
       ctx.IP_RESUMEN.deltaIngresos.sentido === ctx.IP_MAS_ES_MEJOR,
       'capital e ingresos declaran mas_es_mejor');
}

console.log('\n=== 11a. La regla CONSTRUIDA: rango = celda visible, formula = auxiliar (DISTINTAS) ===');
{
    // Probar el plan y NO la construccion dejaba un agujero justo donde vivia el bug de v0.34.0:
    // el rango se fija en _construirReglaDeltaIp, no en _reglasDeltaIp.
    const espia = [];
    ctx.SpreadsheetApp.newConditionalFormatRule = () => {
        const r = { _formula: null, _color: null, _negrita: false, _rangos: null };
        const api = {
            whenFormulaSatisfied: f => { r._formula = f; return api; },
            setFontColor: c => { r._color = c; return api; },
            setBold: b => { r._negrita = b; return api; },
            setRanges: rr => { r._rangos = rr; return api; },
            build: () => { espia.push(r); return r; }
        };
        return api;
    };
    const hojaEspia = { getRange: a1 => ({ _a1: a1, getA1Notation: () => a1 }) };
    const items = ctx._reglasDeltaIp();
    items.forEach(item => ctx._construirReglaDeltaIp(hojaEspia, item));

    ok(espia.length === 6, 'se construyen las seis reglas. Dio ' + espia.length);
    espia.forEach((r, i) => {
        const item = items[i];
        ok(r._rangos.length === 1, 'cada regla cubre UN solo rango');
        ok(r._rangos[0]._a1 === item.celda, 'el rango que se PINTA es la celda visible ' + item.celda);
        ok(r._negrita === true, 'la regla mantiene la negrita que ya tenian los deltas');
        ok(r._color === ctx.IP_COLOR_VERDE || r._color === ctx.IP_COLOR_ROJO,
           'el color sale de la paleta del modulo, no de un hex suelto');

        const m = r._formula.match(/^=\$([A-Z]+)\$(\d+)[<>]0$/);
        ok(!!m, 'la formula ' + r._formula + ' tiene la forma =$COL$FILA>0');
        const enFormula = m ? m[1] + m[2] : '';
        const refAux = ctx.IP_AUX[item.clave].tendencia;
        ok(enFormula === refAux, 'la formula EVALUA la auxiliar ' + refAux + '. Dio ' + enFormula);

        // LA MUTACION CENTRAL, reconstruida a proposito: si la regla volviera a apuntar a la
        // celda que se pinta (el bug de v0.34.0, mirando el texto), esto tiene que fallar.
        ok(enFormula !== item.celda,
           'la celda que se EVALUA (' + enFormula + ') y la celda que se PINTA (' + item.celda +
           ') son DISTINTAS -- si coincidieran, la formula estaria mirando el texto en vez de la auxiliar');
    });
    const celdasPintadas = espia.map(r => r._rangos[0]._a1);
    ctx.IP_CLAVES_DELTA.forEach(k => ok(celdasPintadas.filter(c => c === ctx.IP_RESUMEN[k].celda).length === 2,
       ctx.IP_RESUMEN[k].celda + ' recibe sus dos reglas y las de nadie mas'));
    delete ctx.SpreadsheetApp.newConditionalFormatRule;
}

console.log('\n=== 11b. Clasificar reglas vivas: propias, superadas, ajenas ===');
{
    const R = ctx.IP_RESUMEN, A = ctx.IP_AUX;
    const hexA = h => ({ asRgbColor: () => ({ asHexString: () => h }) });
    const regla = (tipo, valor, rangos, hex) => ({
        getRanges: () => rangos.map(r => ({ getA1Notation: () => r })),
        getBooleanCondition: () => ({
            getCriteriaType: () => tipo,
            getCriteriaValues: () => [valor],
            getFontColorObject: () => (hex ? hexA(hex) : null),
            getBackgroundObject: () => null,
            getBold: () => true, getItalic: () => false,
            getStrikethrough: () => false, getUnderline: () => false
        })
    });
    const calendario = regla('CUSTOM_FORMULA', '=SUMAR.SI.CONJUNTO(...)>0', ['J8:P14'], '#2c4e40');
    const textoC15 = regla('TEXT_CONTAINS', '+', [R.deltaIngresos.celda], '#356854');
    const textoF = regla('TEXT_CONTAINS', '+', [R.deltaCapital.celda, R.deltaEgresos.celda], '#c5221f');
    // La regla PROPIA reconocida: RANGO en la celda visible, FORMULA sobre la auxiliar -- el
    // diseno real desde v0.37.0 (antes las dos coincidian en F10).
    const mia = regla('CUSTOM_FORMULA', '=' + ctx._absIp(A.deltaCapital.tendencia) + '>0',
                      [R.deltaCapital.celda], ctx.IP_COLOR_VERDE);

    const c = ctx._clasificarReglasIp([calendario, textoC15, textoF, mia]);
    ok(c.ajenas.indexOf(calendario) !== -1, 'la regla del calendario es AJENA y se repone intacta');
    ok(c.superadas.length === 2, 'las dos reglas de "el texto contiene" sobre deltas se levantan');
    ok(c.propias.indexOf(mia) !== -1, 'la regla propia se reconoce por formula (sobre la auxiliar) Y rango de una celda visible');
    ok(c.superadas.some(x => x.foto.rangos.length === 2 && x.foto.texto === '#c5221f'),
       'la foto de la regla levantada guarda sus rangos y su color, para poder reponerla');
    ok(c.superadas.every(x => x.foto.negrita === true), 'y guarda la negrita');

    // LA MUTACION: una regla con la formula CORRECTA (apunta a la auxiliar) pero el RANGO puesto
    // en la auxiliar en vez de en la celda visible -- no se reconoce como propia, porque el
    // rango no esta entre las tres celdas visibles que _clasificarReglasIp sabe pintar.
    const rangoEquivocado = regla('CUSTOM_FORMULA', '=' + ctx._absIp(A.deltaCapital.tendencia) + '>0',
                                  [A.deltaCapital.tendencia], ctx.IP_COLOR_VERDE);
    const c4 = ctx._clasificarReglasIp([rangoEquivocado]);
    ok(c4.propias.length === 0,
       'una regla con la formula correcta pero pintando la AUXILIAR (no la celda visible) no se reconoce como propia');

    // LA GUARDA QUE PROTEGE LO AJENO: una regla que toca un delta PERO se extiende afuera no se
    // levanta. Levantarla apagaria formato en celdas que no son de este modulo.
    const desborda = regla('TEXT_CONTAINS', '-', [R.deltaCapital.celda, 'Z99'], '#c5221f');
    const c2 = ctx._clasificarReglasIp([desborda]);
    ok(c2.superadas.length === 0, 'una regla que desborda los deltas NO se levanta');
    ok(c2.ajenas.indexOf(desborda) !== -1, 'y se repone intacta');
    ok(c2.desbordan.length === 1, 'pero se REPORTA, no se ignora en silencio');

    // Un tipo que no sabemos reponer tampoco se levanta.
    const otroTipo = regla('NUMBER_GREATER_THAN', '5', [R.deltaCapital.celda], '#c5221f');
    const c3 = ctx._clasificarReglasIp([otroTipo]);
    ok(c3.superadas.length === 0 && c3.desbordan.length === 1,
       'un tipo de regla que no sabemos reconstruir se deja quieto y se reporta');

    // Idempotencia: con las seis propias puestas y nada superado, no hace falta tocar nada.
    const seis = ctx._reglasDeltaIp().map(r => regla('CUSTOM_FORMULA', r.formula, [r.celda], r.color));
    ok(!ctx._reglasHacenFaltaIp(ctx._clasificarReglasIp(seis.concat([calendario]))),
       'con las seis correctas ya puestas, aplicar no toca las reglas');
    // Pero el color invertido SI se detecta.
    const invertidas = ctx._reglasDeltaIp().map(r => regla('CUSTOM_FORMULA', r.formula, [r.celda],
        r.color === ctx.IP_COLOR_VERDE ? ctx.IP_COLOR_ROJO : ctx.IP_COLOR_VERDE));
    ok(ctx._reglasHacenFaltaIp(ctx._clasificarReglasIp(invertidas)),
       'la formula correcta con el COLOR invertido se detecta y se reescribe');
    // Y aunque las seis propias esten perfectas, si sobrevive una regla vieja de texto HAY que
    // tocar.
    ok(ctx._reglasHacenFaltaIp(ctx._clasificarReglasIp(seis.concat([textoF]))),
       'con una regla vieja de "el texto contiene" todavia viva, aplicar SI tiene que actuar');

    // EL BUG REAL, reconstruido tal cual lo encontro Franco en produccion: CUATRO reglas sobre
    // C15 donde debia haber dos -- dos de v0.34.0 que evaluan la celda visible directamente
    // (=$C$15>0 / =$C$15<0, correctas cuando C15 era numero, mudas desde que C15 es texto) mas
    // las dos de hoy que evaluan la auxiliar (=$AV$9>0 / =$AV$9<0). Antes de este fix las viejas
    // caian en "ajenas" y aplicarIp las reponia intactas para siempre -- la version anterior de
    // esta prueba nunca junto a las dos generaciones en la misma celda y por eso no lo agarro.
    const viejaMas = regla('CUSTOM_FORMULA', '=' + ctx._absIp(R.deltaIngresos.celda) + '>0',
                           [R.deltaIngresos.celda], ctx.IP_COLOR_VERDE);
    const viejaMenos = regla('CUSTOM_FORMULA', '=' + ctx._absIp(R.deltaIngresos.celda) + '<0',
                             [R.deltaIngresos.celda], ctx.IP_COLOR_ROJO);
    const nuevaMas = regla('CUSTOM_FORMULA', '=' + ctx._absIp(A.deltaIngresos.tendencia) + '>0',
                           [R.deltaIngresos.celda], ctx.IP_COLOR_VERDE);
    const nuevaMenos = regla('CUSTOM_FORMULA', '=' + ctx._absIp(A.deltaIngresos.tendencia) + '<0',
                             [R.deltaIngresos.celda], ctx.IP_COLOR_ROJO);
    const cCuatro = ctx._clasificarReglasIp([viejaMas, viejaMenos, nuevaMas, nuevaMenos]);
    ok(cCuatro.propias.length === 4,
       'las cuatro reglas sobre C15 (dos de v0.34.0 + dos de hoy) se reconocen TODAS como propias. Dio ' +
       cCuatro.propias.length);
    ok(cCuatro.ajenas.length === 0 && cCuatro.superadas.length === 0 && cCuatro.desbordan.length === 0,
       'ninguna de las cuatro queda huerfana en otro monton (ni ajena, ni superada, ni reportada como desborde)');
    ok(ctx._reglasHacenFaltaIp(cCuatro),
       'con dos generaciones conviviendo en la misma celda, aplicar SI tiene que actuar: barre las cuatro y escribe las dos correctas');

    // EL HECHO DE SHEETS QUE HACE ESTO PELIGROSO, y por el que el bug nunca disparo un error: en
    // Sheets un texto compara SIEMPRE mayor que cualquier numero, asi que ">0" contra una celda
    // de TEXTO no falla -- da VERDADERO sin condicion -- y "<0" da FALSO sin condicion. Ninguna
    // excepcion, ningun log: el unico sintoma es el color pintado. Por eso la garantia real no es
    // "el codigo no explota", es "las reglas que este modulo ESCRIBE jamas evaluan la celda de
    // texto que pintan". Se verifica sobre las seis reglas reales (_reglasDeUnDeltaIp), no sobre
    // datos de prueba armados a mano.
    ctx.IP_CLAVES_DELTA.forEach(function (k) {
        ctx._reglasDeUnDeltaIp(k).forEach(function (r) {
            const m = r.formula.match(/^=\$([A-Z]+)\$([0-9]+)[<>]0$/);
            const evaluada = m ? m[1] + m[2] : '';
            ok(!!m, k + ': la formula ' + r.formula + ' tiene la forma =$COL$FILA>0/<0');
            ok(evaluada !== r.celda,
               k + ': la regla que este modulo escribe evalua ' + evaluada + ', NUNCA ' + r.celda +
               ' (la celda de texto que pinta) -- si coincidieran, un ">0" contra texto daria' +
               ' VERDADERO siempre y el bug de v0.34.0 volveria a pasar sin avisar');
        });
    });
}

console.log('\n=== 12. El verificador distingue PENDIENTE de FALLA (auxiliares numericas + visibles de texto) ===');
{
    const hojaDe = (valores) => ({
        getRange: (celda) => ({
            getValue: () => (celda in valores ? valores[celda] : ''),
            getFormula: () => ''
        })
    });
    const F = ctx.IP_BLOQUE.filas, B = ctx.IP_BLOQUE, A = ctx.IP_AUX;
    const base = {};
    [['colPresupuesto', [100, 40, 30, 30]], ['colRealidad', [90, 30, 30, 30]]].forEach(([c, v]) => {
        ['ingresos', 'fijos', 'variables', 'capitalizacion'].forEach((k, j) => { base[B[c] + F[k].fila] = v[j]; });
    });
    base[B.colDistribucion + F.ingresos.fila] = '';
    [['fijos', 10], ['variables', 20], ['capitalizacion', 70]].forEach(([k, v]) => { base[B.colDistribucion + F[k].fila] = v; });
    base[ctx.IP_RESUMEN.saldo.celda] = 100;
    // Las seis auxiliares: numeros de verdad (tendencia + su promedio derramado).
    ctx.IP_CLAVES_DELTA.forEach(k => {
        base[A[k].tendencia] = 0.1;
        base[ctx._celdaPromedioIp(A[k].tendencia)] = 123456.78;
    });
    // Las tres visibles: TEXTO, como las arma de verdad la formula.
    base[ctx.IP_RESUMEN.deltaCapital.celda] = '▲ 10,0% de tendencia a 6 meses · promedio $123.456,78 · $50.000,00 inyectados en Agosto';
    base[ctx.IP_RESUMEN.deltaIngresos.celda] = '▲ 10,0% de tendencia a 6 meses · promedio $123.456,78';
    base[ctx.IP_RESUMEN.deltaEgresos.celda] = '▲ 10,0% de tendencia a 6 meses · promedio $123.456,78';

    let r = ctx._verificarInvariantesIp(hojaDe(base));
    ok(r.fallas.length === 0 && r.avisos.length === 0,
       'todo numerico/textual y coherente: sin fallas ni avisos. Fallas: ' + JSON.stringify(r.fallas) +
       ' Avisos: ' + JSON.stringify(r.avisos));

    // Una AUXILIAR "cargando": aviso, nunca falla -- revertir destruiria una formula buena.
    const cargandoAux = Object.assign({}, base);
    cargandoAux[A.deltaCapital.tendencia] = 'Loading...';
    r = ctx._verificarInvariantesIp(hojaDe(cargandoAux));
    ok(r.fallas.length === 0, 'una auxiliar cargando NO es falla');
    ok(r.avisos.some(a => a.indexOf(A.deltaCapital.tendencia) !== -1), 'y queda un aviso nombrando la celda auxiliar pendiente');

    // Un PROMEDIO derramado "cargando" -- mismo trato, en castellano.
    const cargandoProm = Object.assign({}, base);
    cargandoProm[ctx._celdaPromedioIp(A.deltaIngresos.tendencia)] = 'Cargando...';
    r = ctx._verificarInvariantesIp(hojaDe(cargandoProm));
    ok(r.fallas.length === 0 && r.avisos.length > 0, 'el promedio "Cargando..." tambien es aviso, no falla');

    // Una AUXILIAR en error real: SI es falla.
    const errorAux = Object.assign({}, base);
    errorAux[A.deltaEgresos.tendencia] = '#REF!';
    r = ctx._verificarInvariantesIp(hojaDe(errorAux));
    ok(r.fallas.length > 0 && r.fallas.some(f => f.indexOf(A.deltaEgresos.tendencia) !== -1),
       'una auxiliar en #REF! SI es falla y se nombra');

    // Un string cualquiera en una auxiliar (ni "Loading..." ni error "#..."): el lector de
    // numeros lo trata igual que "todavia calculando" (comportamiento heredado de
    // _leerYaCalculadoIp, sin cambios en v0.37.0) -- termina en aviso, no en falla.
    const auxTextoRaro = Object.assign({}, base);
    auxTextoRaro[A.deltaIngresos.tendencia] = 'no soy un numero';
    r = ctx._verificarInvariantesIp(hojaDe(auxTextoRaro));
    ok(r.fallas.length === 0, 'un string que no es numero ni error de celda se trata como pendiente, no como falla');
    ok(r.avisos.some(a => a.indexOf(A.deltaIngresos.tendencia) !== -1), 'y queda un aviso nombrando la auxiliar');

    // Una celda VISIBLE (F10/C15/F15) "cargando": aviso, no falla. F10 depende de su auxiliar Y
    // de E22 (las dos con TIDETRACK_* adentro), asi que hereda la misma cicatriz que ya obligo a
    // _leerYaCalculadoIp en v0.31.0.
    const cargandoVisible = Object.assign({}, base);
    cargandoVisible[ctx.IP_RESUMEN.deltaCapital.celda] = 'Loading...';
    r = ctx._verificarInvariantesIp(hojaDe(cargandoVisible));
    ok(r.fallas.length === 0, 'F10 "cargando" NO es falla');
    ok(r.avisos.some(a => a.indexOf(ctx.IP_RESUMEN.deltaCapital.celda) !== -1), 'y queda un aviso nombrando F10');

    // Una celda VISIBLE en error real: SI es falla, con el error nombrado.
    const errorVisible = Object.assign({}, base);
    errorVisible[ctx.IP_RESUMEN.deltaIngresos.celda] = '#VALUE!';
    r = ctx._verificarInvariantesIp(hojaDe(errorVisible));
    ok(r.fallas.length > 0 && r.fallas.some(f => f.indexOf('#VALUE!') !== -1),
       'C15 en #VALUE! SI es falla y se nombra el error');

    // Una celda VISIBLE vacia: se trata como pendiente (no se puede distinguir de "todavia
    // calculando" sin una senal explicita) -- documentado, no un olvido.
    const vacia = Object.assign({}, base);
    vacia[ctx.IP_RESUMEN.deltaEgresos.celda] = '';
    r = ctx._verificarInvariantesIp(hojaDe(vacia));
    ok(r.fallas.length === 0 && r.avisos.some(a => a.indexOf(ctx.IP_RESUMEN.deltaEgresos.celda) !== -1),
       'F15 vacia se trata como pendiente, no como falla (no hay forma de distinguirla de "todavia calculando")');

    // La identidad del PLAN rota sigue siendo falla (sin cambios respecto de v0.34.0).
    const roto = Object.assign({}, base);
    roto[B.colPresupuesto + F.capitalizacion.fila] = 999;
    r = ctx._verificarInvariantesIp(hojaDe(roto));
    ok(r.fallas.some(f => /identidad/.test(f)), 'la identidad del PLAN rota sigue siendo falla');

    // Pero en la REALIDAD no aplica: ahi la capitalizacion se mide y la diferencia es el dato.
    const realDistinta = Object.assign({}, base);
    realDistinta[B.colRealidad + F.capitalizacion.fila] = -50;
    r = ctx._verificarInvariantesIp(hojaDe(realDistinta));
    ok(!r.fallas.some(f => /identidad/.test(f)),
       'la realidad NO tiene que cerrar la identidad: E22 se mide, no es el residuo');
    ok(r.avisos.some(a => /sin asignar/.test(a)),
       'y la diferencia se reporta como informacion: la plata que entro y no se gasto ni capitalizo');
}

console.log('\n=== 13. Las auxiliares (AV:AW) se ocultan, igual que los otros dos motores de la hoja ===');
{
    // Bug reportado en la corrida de v0.37.0: los numeros de AV8:AW10 se veian sueltos a la
    // derecha del lienzo de Inicio. Medido el 2026-08-21: los otros dos motores (T:AG, AH:AT)
    // estan TODOS ocultos y AV/AW no. _colAuxiliaresIp deriva la columna de IP_AUX (nunca
    // hardcodeada), y _ocultarAuxiliaresIp/_mostrarAuxiliaresIp son las dos puntas que
    // aplicarInicioPresupuesto/revertirInicioPresupuesto usan para curarlo y deshacerlo.
    ok(ctx._colAuxiliaresIp() === 'AV',
       '_colAuxiliaresIp deriva AV de IP_AUX.deltaCapital.tendencia. Dio ' + ctx._colAuxiliaresIp());

    const llamadas = [];
    const hojaEspia = {
        hideColumns: (idx, cant) => llamadas.push(['hide', idx, cant]),
        showColumns: (idx, cant) => llamadas.push(['show', idx, cant])
    };
    ctx._ocultarAuxiliaresIp(hojaEspia);
    ok(llamadas.length === 1 && llamadas[0][0] === 'hide',
       '_ocultarAuxiliaresIp llama a hideColumns exactamente una vez');
    ok(llamadas[0][1] === ctx.columnLetterToIndex('AV') && llamadas[0][2] === 2,
       '_ocultarAuxiliaresIp arranca en AV y cubre 2 columnas (tendencia + su promedio derramado ' +
       'en AW). Dio indice ' + llamadas[0][1] + ', cantidad ' + llamadas[0][2]);

    llamadas.length = 0;
    ctx._mostrarAuxiliaresIp(hojaEspia);
    ok(llamadas.length === 1 && llamadas[0][0] === 'show' &&
       llamadas[0][1] === ctx.columnLetterToIndex('AV') && llamadas[0][2] === 2,
       '_mostrarAuxiliaresIp destapa el MISMO rango que oculta _ocultarAuxiliaresIp');
}

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
