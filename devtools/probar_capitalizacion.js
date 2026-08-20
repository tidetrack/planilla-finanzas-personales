/**
 * devtools/probar_capitalizacion.js
 * Banco de pruebas de DEVTOOL_Capitalizacion.js.
 *
 * Dos mitades, y conviene saber que prueba cada una:
 *
 * 1. ESTRUCTURA DE LAS FORMULAS que el modulo emite: separadores es_AR, parentesis y comillas
 *    balanceados, cero arrays literales, cero coordenadas de cotizacion, y que las tres filas de
 *    la disponibilidad compartan denominador y difieran solo en su numerador.
 *
 * 2. LA REGLA DE REPARTO, evaluada numericamente. El calculo real lo hace Sheets, asi que aca hay
 *    un espejo de la regla en JS: NO prueba la formula, prueba el DISENO. Sirve para lo que
 *    importa -- que el invariante "las tres filas suman la liquidez" se cumpla en los tres
 *    regimenes y no solo en el que se probo a mano.
 *
 * La mitad 1 ata el espejo a la formula: si la formula deja de tener la forma que el espejo
 * asume, la mitad 1 se rompe y avisa.
 *
 * USO:  node devtools/probar_capitalizacion.js
 * @version 0.26.0
 * @since 2026-08-20
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = '/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c';

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON,
    MONEDAS_DISPONIBLES: ['ARS', 'USD', 'AUD', 'EUR'],
    // SHEETS.PROYECCION es un getter que resuelve el alias contra la planilla viva; aca se le
    // da una planilla falsa que solo conoce los nombres canonicos.
    SpreadsheetApp: {
        flush() {},
        getActiveSpreadsheet: () => ({
            getSheets: () => ['Inicio','Tablero','Presupuesto','Cargas','Plan de Cuentas',
                              'Mirada Interanual','Registros','Tipos de Cambio','Proyeccion']
                              .map(n => ({ getName: () => n })),
            getSheetByName: () => null
        })
    },
    PropertiesService: {}, Utilities: {}, Session: {}, Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {},
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_StockYFlujo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_Proyeccion.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_Capitalizacion.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,TIPOS_RIQUEZA,CAP_BLOQUES,CAP_REFS,SYF_SALDOS_TABLERO});',
    ctx);

function revisar(nombre, f) {
    const p = [];
    if (!f || f[0] !== '=') p.push('no empieza con =');
    if (f.indexOf('{') !== -1) p.push('tiene un array literal {} -- setFormula no lo traduce en es_AR');
    if (f.indexOf(',') !== -1 && !/SPLIT\(/.test(f)) p.push('usa , como separador en vez de ;');
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

console.log('=== 1. La suma hacia los medios de riqueza ===');
[['Proyeccion (presupuesto)', ctx.SHEETS.PROYECCION], ['Registros (realidad)', ctx.RANGES.REGISTROS.sheet]]
    .forEach(([etiqueta, hoja]) => {
        const f = ctx._formulaHaciaRiqueza(hoja);
        if (revisar(etiqueta, f)) console.log('  OK  ' + etiqueta);
        ok(!/\$AF\$\d+/.test(f), etiqueta + ': ninguna coordenada de cotizacion (esas se pudren)');
        ok(/TIDETRACK_USD\(\)/.test(f), etiqueta + ': convierte con las custom functions');
        ok(/\$N\$2/.test(f) && /\$N\$3/.test(f), etiqueta + ': filtra por el periodo del Tablero');
        ok(/Inicio Mes/.test(f), etiqueta + ': excluye los arrastres "Inicio Mes"');
        ctx.TIPOS_RIQUEZA.forEach(t => ok(f.indexOf('"' + t + '"') !== -1, etiqueta + ': incluye el tipo ' + t));
        ok(!/"Hogar"|"Financ/.test(f), etiqueta + ': NO incluye Hogar ni Financiacion');
    });

// Las dos columnas tienen que medir IGUAL, o el porcentaje de cumplimiento compara varas distintas.
const fProy = ctx._formulaHaciaRiqueza(ctx.SHEETS.PROYECCION);
const fReg = ctx._formulaHaciaRiqueza(ctx.RANGES.REGISTROS.sheet);
ok(fProy.replace(new RegExp(ctx.SHEETS.PROYECCION, 'g'), 'X') ===
   fReg.replace(new RegExp(ctx.RANGES.REGISTROS.sheet, 'g'), 'X'),
   'presupuesto y realidad son LA MISMA formula: solo cambia la hoja');

console.log('\n=== 2. Las tres filas de la disponibilidad ===');
const claves = ['fijos', 'variables', 'capitalizacion'];
const fs3 = {};
claves.forEach(k => {
    fs3[k] = ctx._formulaDisponibilidadCap(k);
    if (revisar('disponibilidad:' + k, fs3[k])) console.log('  OK  ' + k);
    // No se puede distinguir "vieja celda de cotizacion" de "fila del bloque de saldos" por la
    // coordenada: AF17-19 eran las cotizaciones y AF18-21 son hoy los saldos, y se solapan.
    // El criterio que SI distingue: las cotizaciones se piden por funcion, y las unicas celdas
    // AF que la formula toca tienen que ser exactamente las cuatro filas del bloque de saldos.
    const filasOk = ctx.SYF_SALDOS_TABLERO.filas.map(x => '$' + ctx.SYF_SALDOS_TABLERO.colFlujo + '$' + x);
    const afs = (fs3[k].match(/\$AF\$\d+/g) || []);
    ok(afs.every(x => filasOk.indexOf(x) !== -1),
       k + ': las unicas celdas AF que toca son las filas del bloque de saldos. Toca ' + [...new Set(afs)].join(','));
    ok(/TIDETRACK_USD\(\)/.test(fs3[k]) && /TIDETRACK_EUR\(\)/.test(fs3[k]),
       k + ': pide las cotizaciones por funcion, no por coordenada');
    ok(/rem_/.test(fs3[k]), k + ': calcula remanentes');
});
ok(/excedente/.test(fs3.capitalizacion), 'solo capitalizacion recibe el excedente');
ok(!/excedente/.test(fs3.fijos) && !/excedente/.test(fs3.variables),
   'fijos y variables NO reciben excedente: el sobrante despues de cubrir todo es capitalizar');
claves.forEach(k => ok(fs3[k].indexOf('rem_' + k + ' / suma_rem') !== -1,
   k + ': su numerador es su propio remanente'));
claves.forEach(k => ok(fs3[k].indexOf('peso_' + k + ' / suma_peso') !== -1,
   k + ': cuando no queda remanente, reparte por SU peso de presupuesto'));
ok(claves.every(k => fs3[k].indexOf('suma_rem; rem_fijos + rem_variables + rem_capitalizacion') !== -1),
   'las tres comparten el mismo denominador: si no, el reparto no sumaria la liquidez');

console.log('\n=== 3. La regla de reparto (espejo en JS del diseno) ===');
// Espejo EXACTO de lo que emite _formulaDisponibilidadCap. La mitad 1 verifica que la formula
// mantenga esta forma; si divergen, esta mitad deja de significar algo y aquella avisa.
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
const suma = (o) => claves.reduce((a, k) => a + o[k], 0);
const cerca = (a, b) => Math.abs(a - b) < 0.000001;

// Regimen 1: queda presupuesto y la plata NO alcanza.
let r = repartir(100, { fijos: 200, variables: 100, capitalizacion: 100 }, { fijos: 0, variables: 0, capitalizacion: 0 });
ok(cerca(suma(r), 100), 'regimen 1 (no alcanza): las tres suman la liquidez. Dio ' + suma(r).toFixed(2));
ok(r.fijos > r.variables, 'regimen 1: la que mas remanente tiene recibe mas');

// Regimen 2: queda presupuesto y la plata SOBRA.
r = repartir(1000, { fijos: 200, variables: 100, capitalizacion: 100 }, { fijos: 0, variables: 0, capitalizacion: 0 });
ok(cerca(suma(r), 1000), 'regimen 2 (sobra): las tres suman la liquidez. Dio ' + suma(r).toFixed(2));
ok(cerca(r.fijos, 200) && cerca(r.variables, 100), 'regimen 2: cada una recibe su remanente completo');
ok(cerca(r.capitalizacion, 100 + 600), 'regimen 2: el sobrante va entero a capitalizacion');

// Regimen 3: EL CASO DE FRANCO. Las tres pasadas del 100%.
const presuF = { fijos: 925178.97, variables: 1385949.56, capitalizacion: 400000 };
const realF = { fijos: 1340140.28, variables: 1879484.34, capitalizacion: 456000 };
r = repartir(275428.69, presuF, realF);
ok(cerca(suma(r), 275428.69), 'regimen 3 (las tres >100%): las tres suman la liquidez. Dio ' + suma(r).toFixed(2));
ok(r.fijos > 0 && r.variables > 0 && r.capitalizacion > 0,
   'regimen 3: NINGUNA queda en cero. Antes se llevaba todo capitalizacion. Dio ' +
   claves.map(k => k + '=' + r[k].toFixed(0)).join(' '));
const totalPresu = claves.reduce((a, k) => a + presuF[k], 0);
ok(cerca(r.variables / 275428.69, presuF.variables / totalPresu),
   'regimen 3: cada una recibe su peso de presupuesto');

// Sin nada presupuestado: partes iguales, no todo a una.
r = repartir(300, { fijos: 0, variables: 0, capitalizacion: 0 }, { fijos: 0, variables: 0, capitalizacion: 0 });
ok(cerca(r.fijos, 100) && cerca(r.variables, 100) && cerca(r.capitalizacion, 100),
   'sin presupuesto: se reparte en partes iguales');

// Y el invariante sobre casos al azar, incluidos presupuestos negativos y reales enormes.
let peor = 0;
for (let i = 0; i < 4000; i++) {
    const rnd = (n) => Math.round((((i * 9301 + 49297 + n * 233) % 233280) / 233280) * 2000000) - 300000;
    const liq = Math.abs(rnd(7)) % 900000;
    const p = { fijos: rnd(1), variables: rnd(2), capitalizacion: rnd(3) };
    const q = { fijos: Math.abs(rnd(4)), variables: Math.abs(rnd(5)), capitalizacion: Math.abs(rnd(6)) };
    peor = Math.max(peor, Math.abs(suma(repartir(liq, p, q)) - liq));
}
ok(peor < 0.000001, '4000 casos al azar: las tres siempre suman la liquidez (peor desvio ' + peor.toExponential(1) + ')');

console.log('\n=== 4. Coherencia con el resto de la planilla ===');
ok(ctx.CAP_REFS.presu.capitalizacion === '$N$12' && ctx.CAP_REFS.real.capitalizacion === '$N$19',
   'la disponibilidad lee la capitalizacion de las mismas celdas que el modulo escribe');
ok(ctx.CAP_BLOQUES.presupuesto.celda === '$N$12'.replace(/\$/g, ''),
   'el presupuesto de capitalizacion se escribe en N12');
ok(ctx.CAP_BLOQUES.realidad.celda === '$N$19'.replace(/\$/g, ''),
   'la realidad de capitalizacion se escribe en N19');
const liq = ctx._liquidezCap();
ctx.SYF_SALDOS_TABLERO.filas.forEach(f => ok(liq.indexOf('$' + ctx.SYF_SALDOS_TABLERO.colFlujo + '$' + f) !== -1,
   'la liquidez incluye la fila ' + f + ' del bloque de saldos'));

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
