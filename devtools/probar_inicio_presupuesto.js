/**
 * devtools/probar_inicio_presupuesto.js
 * Banco de pruebas de DEVTOOL_InicioPresupuesto.js.
 *
 * Tres mitades:
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
 *    reparto (mismo diseno que DEVTOOL_Capitalizacion) y el delta contra la media. No prueban
 *    la formula: prueban el DISENO, y la mitad 1 ata el espejo a la forma de la formula.
 *
 * USO:  node devtools/probar_inicio_presupuesto.js
 * @version 0.31.0
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
    '\n;Object.assign(globalThis,{RANGES,SHEETS,TIPOS_RIQUEZA,CUENTAS_NEUTRAS,CUENTA_ARRASTRE,CAP_SELECTORES,IP_RESUMEN,IP_FORMATO_DELTA,IP_SUFIJO_DELTA,IP_MESES_TENDENCIA,' +
    'MONEDAS_DISPONIBLES,IP_BLOQUE,IP_RESUMEN,IP_SELECTORES,IP_MOTOR,IP_FORMATO_DELTA,IP_MESES_TENDENCIA});',
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
    getRange: () => ({ getFormula: () => '', getValue: () => '', getDisplayValue: () => '', getNumberFormat: () => '' })
};
const plan = ctx._planIp(null, { hoja: hojaFalsa, nombre: 'Inicio' });
const porCelda = {}, formatos = {};
plan.cambios.forEach(c => {
    if (c.esFormato) formatos[c.celda] = c.formatoNuevo;
    else porCelda[c.celda] = c.formulaNueva;
});

console.log('=== 0. Las tres publicas existen ===');
['estadoInicioPresupuesto', 'aplicarInicioPresupuesto', 'revertirInicioPresupuesto'].forEach(n =>
    ok(typeof ctx[n] === 'function', n + ' es una funcion'));

console.log('\n=== 1. EL CABLEADO: que celda recibe que ===');
{
    const esperadasFormula = ['D19', 'D20', 'D21', 'D22', 'E19', 'E20', 'E21', 'E22',
                              'F19', 'F20', 'F21', 'F22', 'G19', 'G20', 'G21', 'G22',
                              'F10', 'C15', 'F15'];
    const esperadasFormato = ['F10', 'C15', 'F15'];
    ok(Object.keys(porCelda).length === esperadasFormula.length,
       'el plan propone ' + esperadasFormula.length + ' formulas. Propuso ' + Object.keys(porCelda).length);
    esperadasFormula.forEach(c => ok(!!porCelda[c], c + ' recibe formula'));
    Object.keys(porCelda).forEach(c => ok(esperadasFormula.indexOf(c) !== -1,
       c + ' esta en la lista esperada (no hay celdas de mas)'));
    ok(Object.keys(formatos).length === esperadasFormato.length,
       'el plan propone ' + esperadasFormato.length + ' formatos. Propuso ' + Object.keys(formatos).length);
    esperadasFormato.forEach(c => ok(formatos[c] === ctx.IP_FORMATO_DELTA,
       c + ' recibe el formato ' + ctx.IP_FORMATO_DELTA + '. Recibio "' + formatos[c] + '"'));
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

console.log('\n=== 2. Estructura de las 19 formulas ===');
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

console.log('\n=== 8. F10: el delta de capital ===');
{
    const f = porCelda.F10;
    ok(f.indexOf('MAP(SEQUENCE(' + ctx.IP_MESES_TENDENCIA + ')') !== -1,
       'F10 recorre los ' + ctx.IP_MESES_TENDENCIA + ' meses previos con MAP/SEQUENCE, sin arrays literales');
    ok(/EOMONTH\(TODAY\(\); k_mes - 6\)/.test(f), 'cada punto de la serie es el EOMONTH de TODAY() corrido k-6 meses');
    // k va 1..6, asi que los corrimientos son -5..0: la ventana CIERRA en el mes en curso. Una
    // ventana que terminara el mes pasado no veria el movimiento que Franco acaba de cargar.
    ok(!/EOMONTH\(TODAY\(\); -k_mes\)/.test(f), 'la ventana termina en el mes en curso, no el mes pasado');
    ok(!/\$I\$2|\$I\$3/.test(f), 'F10 NO depende del selector de mes: el capital es un stock');
    ok(!/\$I\$4/.test(f), 'F10 NO depende del selector de moneda: el delta es un cociente en ARS');
    ok(f.indexOf('col_cuenta="' + ctx.CUENTA_ARRASTRE + '"') !== -1 && f.indexOf('col_fecha<=tope') !== -1,
       'el corte es el ultimo "' + ctx.CUENTA_ARRASTRE + '" de cada medio ACOTADO a la fecha de cierre');
    ctx.TIPOS_RIQUEZA.forEach(t => ok(f.indexOf('(tipo_fila="' + t + '")') !== -1,
       'la lista blanca de riqueza incluye "' + t + '"'));
    ok(f.indexOf("'Plan de Cuentas'!") !== -1, 'el tipo del medio sale del Plan de Cuentas vivo (no del mapa TDM)');
    ok(/TIDETRACK_USD\(\)/.test(f) && /TIDETRACK_AUD\(\)/.test(f) && /TIDETRACK_EUR\(\)/.test(f),
       'convierte las monedas por funcion, no por coordenada');
    ok(/SLOPE\(serie_cap; SEQUENCE\(6\)\)/.test(f), 'F10 mide la TENDENCIA de la serie (SLOPE), no un mes contra una media');
    ok(!/capital_hoy/.test(f), 'F10 ya no compara el capital de hoy contra nada: un punto solo no es una tendencia');
    ok(!/AVERAGE\(cierres_previos\)/.test(f), 'F10 ya no promedia cierres previos');
}

console.log('\n=== 9. C15 y F15: los deltas de flujo (reemplazan las formulas rotas) ===');
[['C15', true], ['F15', false]].forEach(par => {
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

console.log('\n=== 9b. La tendencia (espejo en JS del diseno) ===');
{
    // Espejo exacto de _tendenciaIp: pendiente de minimos cuadrados sobre los 6 puntos,
    // multiplicada por el largo de la ventana, sobre el nivel medio.
    const tendencia = serie => {
        const n = serie.length;
        const xs = serie.map((_, i) => i + 1);
        const mx = xs.reduce((a, b) => a + b, 0) / n;
        const my = serie.reduce((a, b) => a + b, 0) / n;
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
    // Y el contraste que cierra el argumento: el mismo salto REPARTIDO en los seis meses -- una
    // tendencia de verdad -- pesa MAS que el pico suelto, que es exactamente al reves de como lo
    // leia el diseno viejo (ahi los dos daban +100%).
    ok(tendencia([100, 120, 140, 160, 180, 200]) > tendencia(conPico),
       'un crecimiento sostenido pesa mas que un mes aislado; el diseno viejo no los distinguia');
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
    // El lenguaje de patrones de setNumberFormat es INDEPENDIENTE DEL LOCALE: '.' es siempre el
    // separador decimal. Con coma, Sheets lo lee como separador de MILES y el decimal desaparece
    // ('+35%' en vez de '+34,5%'), sin ningun error. Se ve con coma porque asi lo RENDERIZA es_AR.
    ok(/^\+0\.0%"/.test(ctx.IP_FORMATO_DELTA) && ctx.IP_FORMATO_DELTA.indexOf(';-0.0%"') !== -1,
       'el patron del delta usa PUNTO decimal (se muestra con coma). Dio ' + ctx.IP_FORMATO_DELTA);
    ok(!/0,0%/.test(ctx.IP_FORMATO_DELTA),
       'ninguna coma en la parte NUMERICA: seria separador de miles y se comeria el decimal');
    // decision Franco 2026-08-21: el delta lleva texto que diga contra que se compara.
    ok(ctx.IP_FORMATO_DELTA.indexOf(ctx.IP_SUFIJO_DELTA) !== -1,
       'el patron concatena el texto explicativo: "' + ctx.IP_SUFIJO_DELTA + '"');
    ok((ctx.IP_FORMATO_DELTA.match(/"/g) || []).length % 2 === 0,
       'las comillas del texto literal estan balanceadas');
    ok(ctx.IP_SUFIJO_DELTA.indexOf(String(ctx.IP_MESES_TENDENCIA)) !== -1,
       'el texto nombra los ' + ctx.IP_MESES_TENDENCIA + ' meses que realmente se promedian: no puede desfasarse');
    // Va en el FORMATO, no en un TEXT(): la celda tiene que seguir siendo un numero.
    ok(!/TEXT\(/.test(ctx._formulaDeltaIp ? ctx._formulaDeltaIp('capital') : ''),
       'el delta NO usa TEXT(): con texto la celda dejaria de ser numero y nada lo delataria');
}

console.log('=== El verificador distingue PENDIENTE de FALLA ===');
// Las custom functions (TIDETRACK_*) devuelven "Loading..." en su primer calculo. Un verificador
// que relee enseguida ve un string y revierte formulas correctas: paso el 2026-08-21 con E22.
{
    const hojaDe = (valores) => ({
        getRange: (celda) => ({
            getValue: () => (celda in valores ? valores[celda] : ''),
            getFormula: () => '', getNumberFormat: () => ctx.IP_FORMATO_DELTA
        })
    });
    const F = ctx.IP_BLOQUE.filas, B = ctx.IP_BLOQUE;
    const base = {};
    [['colPresupuesto', [100, 40, 30, 30]], ['colRealidad', [90, 30, 30, 30]]].forEach(([c, v]) => {
        ['ingresos','fijos','variables','capitalizacion'].forEach((k, j) => { base[B[c] + F[k].fila] = v[j]; });
    });
    base[B.colDistribucion + F.ingresos.fila] = '';
    [['fijos', 10], ['variables', 20], ['capitalizacion', 70]].forEach(([k, v]) => { base[B.colDistribucion + F[k].fila] = v; });
    base[ctx.IP_RESUMEN.saldo.celda] = 100;
    [ctx.IP_RESUMEN.deltaCapital, ctx.IP_RESUMEN.deltaIngresos, ctx.IP_RESUMEN.deltaEgresos]
        .forEach(d => { base[d.celda] = 0.1; });

    let r = ctx._verificarInvariantesIp(hojaDe(base));
    ok(r.fallas.length === 0 && r.avisos.length === 0, 'todo numerico y coherente: sin fallas ni avisos');

    // Una celda "cargando": aviso, NUNCA falla.
    const cargando = Object.assign({}, base);
    cargando[B.colRealidad + F.capitalizacion.fila] = 'Loading...';
    r = ctx._verificarInvariantesIp(hojaDe(cargando));
    ok(r.fallas.length === 0, 'una custom function cargando NO es falla: revertir destruiria formulas buenas');
    ok(r.avisos.length > 0, 'pero si deja aviso: el invariante quedo sin comprobar');

    // Idem en castellano, que es como lo muestra esta planilla.
    const cargando2 = Object.assign({}, base);
    cargando2[B.colRealidad + F.capitalizacion.fila] = 'Cargando...';
    r = ctx._verificarInvariantesIp(hojaDe(cargando2));
    ok(r.fallas.length === 0 && r.avisos.length > 0, '"Cargando..." recibe el mismo trato que "Loading..."');

    // Un ERROR de celda SI es falla, y no se espera.
    const conError = Object.assign({}, base);
    conError[B.colRealidad + F.fijos.fila] = '#REF!';
    r = ctx._verificarInvariantesIp(hojaDe(conError));
    ok(r.fallas.length > 0 && /#REF!/.test(r.fallas.join(' ')), 'un #REF! SI es falla y se nombra');

    // La identidad del PLAN rota sigue siendo falla.
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

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
