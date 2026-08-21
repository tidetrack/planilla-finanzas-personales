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

console.log('=== 1. LA IDENTIDAD: los tres destinos suman el 100% de los ingresos ===');
// Este es EL invariante del bloque, y el que se perdio entre la v0.26.0 y la v0.28.0 cuando la
// capacidad de capitalizacion paso a medirse por su cuenta. Se midio 143,98% en la planilla viva.
// Se prueba numericamente sobre la definicion del residuo, incluidos los casos de deficit.
{
    const residuo = (ing, fij, vari) => ing - fij - vari;
    const suman100 = (ing, fij, vari) => {
        if (ing === 0) return true;
        const cap = residuo(ing, fij, vari);
        return Math.abs((fij + vari + cap) / ing - 1) < 1e-12;
    };
    ok(suman100(100, 40, 30), 'caso normal: 40 + 30 + 30 = 100%');
    ok(suman100(1992567.52, 925178.97, 1385949.56),
       'el caso REAL de Franco (deficit): los tres suman 100% aunque la capacidad de negativo');
    ok(residuo(1992567.52, 925178.97, 1385949.56) < 0,
       'y esa capacidad efectivamente da negativo: el presupuesto esta sobrecomprometido');
    ok(suman100(100, 200, 300), 'deficit extremo: 200% + 300% - 400% = 100%');
    ok(suman100(100, 0, 0), 'sin gastos: 0 + 0 + 100% = 100%');
    let peor = 0;
    for (let i = 0; i < 5000; i++) {
        const r = n => ((i * 7919 + n * 104729) % 1000003) / 1000003;
        const ing = 1 + r(1) * 5000000, fij = r(2) * 4000000, vari = r(3) * 4000000;
        const cap = residuo(ing, fij, vari);
        peor = Math.max(peor, Math.abs((fij + vari + cap) / ing - 1));
    }
    ok(peor < 1e-12, '5000 casos al azar: la identidad se cumple siempre (peor desvio ' + peor.toExponential(1) + ')');
}

console.log('\n=== 1b. El modelo mixto: el plan asigna, la realidad se mide ===');
{
    const presu = ctx._formulaResiduoCap('O9', 'O10', 'O11');
    ok(presu === '=O9-O10-O11', 'O12 (plan): el residuo que cierra el 100%. Dio ' + presu);
    ok(!/MAX\(0/.test(presu) && presu.indexOf('{') === -1 && presu.indexOf(',') === -1,
       'el residuo: sin piso, sin arrays, sin comas');

    // N19: la capitalizacion EFECTIVA -- decision Franco 2026-08-20: "aca si va el valor
    // registrado del mes". Todas las trampas de una formula larga aplican.
    const real = ctx._formulaHaciaRiqueza(ctx.RANGES.REGISTROS.sheet);
    ok(real[0] === '=' && real.indexOf('{') === -1, 'N19: sin arrays literales (es_AR)');
    ok(!/,(?![^(]*\))/.test('') && !/\$AF\$\d+/.test(real), 'N19: ninguna coordenada de cotizacion');
    ok(/TIDETRACK_USD\(\)/.test(real) && /TIDETRACK_EUR\(\)/.test(real), 'N19: convierte por funcion');
    ok(/\$N\$2/.test(real) && /\$N\$3/.test(real), 'N19: filtra por el periodo del Tablero');
    ok(real.indexOf('Inicio Mes') !== -1, 'N19: excluye el arrastre');
    ctx.TIPOS_RIQUEZA.forEach(t => ok(real.indexOf('"' + t + '"') !== -1, 'N19: incluye el tipo ' + t));
    ok(!/"Hogar"|"Financ/.test(real), 'N19: NO incluye Hogar ni Financiacion');
    ok(!/Traspaso/.test(real), 'N19: NO excluye los traspasos (capitalizar es traspasar a un frasco)');
    ok(/IF\(tipo_mov="Egreso"; -1; 1\)/.test(real),
       'N19: NETEA con signo -- negativo significa que se saco de los frascos');
    ok(!/MAX\(0/.test(real), 'N19: sin piso -- la realidad se muestra como es');
    let par = 0, com = 0;
    for (const ch of real) { if (ch === '(') par++; else if (ch === ')') par--; else if (ch === '"') com++; }
    ok(par === 0 && com % 2 === 0, 'N19: parentesis y comillas balanceados');
    (real.match(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/g) || []).forEach(x => {
        const v = x.trim().replace(';', '');
        ok(v.length > 2, 'N19: variable LET "' + v + '" no choca con funciones');
    });
    ok(real.indexOf(ctx.RANGES.REGISTROS.sheet + '!') !== -1, 'N19: lee el LEDGER, no la proyeccion');
    ok(real.indexOf('Proyecc') === -1, 'N19: no toca la hoja de proyeccion ni por accidente');
}

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

console.log('\n=== 3b. El CABLEADO: que formula va a cada celda ===');
// Probar el generador no alcanza: hay que probar que el plan le pase la bandera correcta a cada
// celda. Una mutacion que le ponia piso en cero a la REALIDAD pasaba invisible sin esto, porque
// el banco llamaba al generador con su propia bandera en vez de mirar lo que arma el modulo.
{
    const hojaFalsa = {
        getRange: () => ({ getFormula: () => '', getValue: () => '', getDisplayValue: () => '' })
    };
    const ssFalso = { getSheetByName: () => hojaFalsa };
    const plan = ctx._planCap(ssFalso, { hoja: hojaFalsa, nombre: 'Tablero' });
    const porCelda = {};
    plan.cambios.forEach(c => { porCelda[c.celda] = c.formulaNueva; });

    ok(Object.keys(porCelda).length === 5, 'el plan propone 5 celdas (sin porcentajes: esa columna es de Franco). Propuso ' + Object.keys(porCelda).length);
    const presu = porCelda[ctx.CAP_BLOQUES.presupuesto.celda] || '';
    const real = porCelda[ctx.CAP_BLOQUES.realidad.celda] || '';
    ok(presu === '=O9-O10-O11',
       ctx.CAP_BLOQUES.presupuesto.celda + ' (plan) es el residuo. Dio ' + presu);
    ok(real.length > 400 && real.indexOf(ctx.RANGES.REGISTROS.sheet + '!') !== -1,
       ctx.CAP_BLOQUES.realidad.celda + ' (realidad) es la formula MEDIDA sobre el ledger, no un residuo');
    ok(!/=O16-O17-O18|=N16-N17-N18/.test(real), 'O19 ya NO es la resta de descarte (decision Franco 2026-08-20)');
    ok(!/MAX\(0;/.test(presu) && !/MAX\(0;/.test(real), 'ninguna lleva piso en cero');
    ok(!/O1[6789]/.test(presu), 'el residuo del plan no toca celdas de la realidad');
}

console.log('\n=== 3c. El modulo NO escribe porcentajes (columna de Franco) ===');
{
    const hojaFalsa = { getRange: () => ({ getFormula: () => '', getValue: () => '', getDisplayValue: () => '' }) };
    const plan = ctx._planCap({ getSheetByName: () => hojaFalsa }, { hoja: hojaFalsa, nombre: 'Tablero' });
    const celdas = plan.cambios.map(c => c.celda).sort();
    ok(celdas.length === 5, 'el plan propone 5 celdas (O12, O19 y las tres de disponibilidad). Propuso ' + celdas.join(','));
    ok(!celdas.some(c => /^N\d/.test(c)),
       'NINGUNA celda de la columna N: el % del plan es de Franco y la realidad no lleva %');
    ok(celdas.indexOf('O12') !== -1 && celdas.indexOf('O19') !== -1,
       'reanclado al rediseno manual: montos en O');
    ok(typeof ctx.CAP_PORCENTAJE_BASE === 'undefined', 'CAP_PORCENTAJE_BASE se retiro del modulo');
}

console.log('\n=== 3d. Ningun modulo se pisa con otro ===');
// Ya paso dos veces: N19 (StockYFlujo vs Capitalizacion) y O16. Cuando dos modulos proponen
// formulas distintas para la misma celda, el numero del Tablero pasa a depender del orden en que
// se aprietan los botones del menu, y no hay forma de notarlo mirando la planilla.
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
    const choques = Object.keys(prop).filter(c => prop[c].size > 1)
        .map(c => c + ' <- ' + [...prop[c]].join(' y '));
    ok(choques.length === 0, choques.length ? 'DOS MODULOS EN LA MISMA CELDA: ' + choques.join('; ')
                                            : 'ninguna celda la proponen dos modulos distintos');
}

console.log('\n=== 3e. Reanclaje al rediseno manual de Franco (montos en O) ===');
{
    const claves2 = ['fijos', 'variables', 'capitalizacion'];
    claves2.forEach(k => {
        ok(/^\$O\$\d+$/.test(ctx.CAP_REFS.presu[k]), 'CAP_REFS.presu.' + k + ' apunta a la columna O. Dio ' + ctx.CAP_REFS.presu[k]);
        ok(/^\$O\$\d+$/.test(ctx.CAP_REFS.real[k]), 'CAP_REFS.real.' + k + ' apunta a la columna O. Dio ' + ctx.CAP_REFS.real[k]);
    });
    ok(ctx.CAP_BLOQUES.presupuesto.celda === 'O12' && ctx.CAP_BLOQUES.realidad.celda === 'O19',
       'los dos residuos/medidas van a O12 y O19');
    const disp = ctx._formulaDisponibilidadCap('fijos');
    ok(!/\$N\$1[0-9]/.test(disp),
       'la disponibilidad no toca la columna N: ahi viven los % de Franco y celdas vacias');
}

console.log('\n=== 4. Coherencia con el resto de la planilla ===');
ok(ctx.CAP_REFS.presu.capitalizacion === '$O$12' && ctx.CAP_REFS.real.capitalizacion === '$O$19',
   'la disponibilidad lee la capitalizacion de las mismas celdas que el modulo escribe');
ok(ctx.CAP_BLOQUES.presupuesto.celda === 'O12', 'el residuo del plan se escribe en O12');
ok(ctx.CAP_BLOQUES.realidad.celda === 'O19', 'la capitalizacion efectiva se escribe en O19');
const liq = ctx._liquidezCap();
ctx.SYF_SALDOS_TABLERO.filas.forEach(f => ok(liq.indexOf('$' + ctx.SYF_SALDOS_TABLERO.colFlujo + '$' + f) !== -1,
   'la liquidez incluye la fila ' + f + ' del bloque de saldos'));

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
