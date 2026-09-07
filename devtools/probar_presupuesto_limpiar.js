/**
 * devtools/probar_presupuesto_limpiar.js
 * Banco de pruebas de src/DEVTOOL_PresupuestoLimpiar.js.
 *
 * Prueba por MUTACION las decisiones del modulo (ver su cabecera para el porque de cada una):
 *   1. Preflight: aborta ante un rotulo corrido, y ante una formula viva en K/O/S -- mismo
 *      chequeo, mismo mensaje, que Sembrar/Plasmar.
 *   2. El plan solo junta celdas CON CONTENIDO: una celda ya vacia no entra, no se cuenta y no
 *      aporta al total.
 *   3. "Monto a Proyectar" ya vacia: NADA QUE LIMPIAR, sin dialogo -- pedir confirmar una
 *      operacion que no borra nada es friccion sin beneficio.
 *   4. Hay celdas con contenido: SIEMPRE hay confirmacion (a diferencia de Plasmar, aca toda
 *      celda del plan por definicion tiene un valor) con el numero exacto de celdas y
 *      cuanto suman, por bloque.
 *   5. Cancelar la confirmacion no borra nada.
 *   6. Aplicar feliz: borra con clearContent (nunca setValue(0) ni una formula), verifica por
 *      relectura y guarda un respaldo en Document Properties.
 *   7. Si la verificacion post-borrado falla en una celda, se revierte el LOTE ENTERO al valor
 *      previo exacto de cada celda de esta corrida.
 *   8. Revertir protege una edicion manual posterior (si Franco escribio algo nuevo en una
 *      celda despues de limpiarla, revertir la deja como esta) y repone el valor EXACTO en las
 *      demas. Un segundo revertir no tiene nada que hacer.
 *   9. La moneda del total es informativa: J4 invalida o vacia no aborta la operacion.
 *
 * USO:  node devtools/probar_presupuesto_limpiar.js
 * @version 0.67.1
 * @since 2026-09-07
 * @see src/DEVTOOL_PresupuestoLimpiar.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };
const seccion = (t) => console.log('\n== ' + t + ' ==');

// ============================================================================
// CONTEXTO: se cargan Config y los modulos de verdad, sin reimplementar nada
// ============================================================================
let ssActual = null;
let alertas = [];
let botonesUsados = [];
let propiedadesFalsas = {};

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp, Error, parseInt,
    SpreadsheetApp: {
        getActiveSpreadsheet: () => ssActual,
        getUi: () => ({
            alert: (t, m, botones) => {
                alertas.push(t + '\n' + m);
                botonesUsados.push(botones === 'YN' ? 'YN' : 'OK');
                return 'Y';
            },
            ButtonSet: { YES_NO: 'YN', OK: 'OK' },
            Button: { YES: 'Y', NO: 'N' }
        }),
        flush() {}
    },
    PropertiesService: {
        getDocumentProperties: () => ({
            getProperty: (k) => (k in propiedadesFalsas ? propiedadesFalsas[k] : null),
            setProperty: (k, v) => { propiedadesFalsas[k] = v; },
            deleteProperty: (k) => { delete propiedadesFalsas[k]; }
        })
    },
    Utilities: { formatDate: () => '2026-09-07_1200' },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {}
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoModo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoResumen.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoLimpiar.js'), 'utf8') +
    '\n;Object.assign(globalThis,{SHEETS,RANGES,MONEDAS_DISPONIBLES,columnLetterToIndex,MENU_CONFIG,' +
    'PM_TITULO,PM_SELECTORES,PM_BLOQUES,PM_CLAVES_BLOQUE,PM_FILA_INI,PM_FILA_FIN,' +
    '_bloquesPc,PC_TITULO_PROYECTAR,PL_PROP_PREVIOS,_preflightPl,_planLimpiarPl,_monedaVivaPl,' +
    'estadoPresupuestoLimpiar,aplicarPresupuestoLimpiar,revertirPresupuestoLimpiar});',
    ctx
);

// ============================================================================
// HOJA "PRESUPUESTO" -- mock por celda (misma forma que probar_presupuesto_plasmar.js), con
// "tragonas" que ahora resisten TANTO setValue como clearContent (una celda combinada real
// tampoco se banca ninguna de las dos).
// ============================================================================
function crearHojaPresupuesto(celdas, tragonas) {
    tragonas = tragonas || {};
    function getRango(ref) {
        const mRange = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (mRange && mRange[1] === mRange[3]) {
            const col = mRange[1];
            const desde = Number(mRange[2]), hasta = Number(mRange[4]);
            return {
                getValues() {
                    const out = [];
                    for (let f = desde; f <= hasta; f++) {
                        const c = celdas[col + f];
                        out.push([c && c.valor !== undefined ? c.valor : '']);
                    }
                    return out;
                }
            };
        }
        return {
            getValue() { return (celdas[ref] && celdas[ref].valor !== undefined) ? celdas[ref].valor : ''; },
            getFormula() { return (celdas[ref] && celdas[ref].formula) || ''; },
            setValue(v) {
                if (tragonas[ref]) return;
                celdas[ref] = { valor: v, formula: '' };
            },
            clearContent() {
                if (tragonas[ref]) return;
                delete celdas[ref];
            }
        };
    }
    return { celdas: celdas, getRange: getRango };
}

/** Escenario base: rotulos correctos, K/O/S con lo que "kos" indique (por defecto, vacia). */
function hojaPresupuestoBase(opciones) {
    opciones = opciones || {};
    const celdas = {};
    const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

    set(ctx.PM_TITULO.celda, ctx.PM_TITULO.esperado);
    set(ctx.PM_SELECTORES.moneda, ('moneda' in opciones) ? opciones.moneda : 'ARS');

    ctx.PM_CLAVES_BLOQUE.forEach((k) => {
        const bPc = ctx._bloquesPc()[k];
        set(bPc.colProyectar + '7', ctx.PC_TITULO_PROYECTAR);
    });

    (opciones.kos || []).forEach((c) => set(c.celda, c.valor));

    return crearHojaPresupuesto(celdas, opciones.tragonas);
}

function ssCon(hojaPresupuesto) {
    return { getSheetByName: (n) => (n === ctx.SHEETS.PRESUPUESTO ? hojaPresupuesto : null) };
}

// ============================================================================
console.log('BANCO: DEVTOOL_PresupuestoLimpiar (v0.67.1 -- el complemento de Sembrar/Plasmar)');

seccion('1. Preflight: aborta ante un rotulo corrido, y ante una formula viva en K/O/S');
{
    const hoja = hojaPresupuestoBase({});
    hoja.celdas['C2'] = { valor: 'Otra Cosa', formula: '' };
    let lanzo = false, msg = '';
    try { ctx._preflightPl(ssCon(hoja)); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && /no es la que este modulo espera/.test(msg), 'MUTACION rotulo (C2 corrido): el preflight aborta, dio: ' + msg.slice(0, 90));

    const hoja2 = hojaPresupuestoBase({});
    hoja2.celdas['O15'] = { valor: 0, formula: '=1+1' };
    let lanzo2 = false, msg2 = '';
    try { ctx._preflightPl(ssCon(hoja2)); } catch (e) { lanzo2 = true; msg2 = e.message; }
    ok(lanzo2 && /formulas en la zona/i.test(msg2), 'MUTACION (formula viva en O15): el preflight aborta, dio: ' + msg2.slice(0, 90));
}

seccion('2. El plan solo junta celdas CON CONTENIDO: las vacias no cuentan ni suman');
{
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 1000 }, { celda: 'O10', valor: 2000 }] });
    ssActual = ssCon(hoja);
    const pre = ctx._preflightPl(ssActual);
    const plan = ctx._planLimpiarPl(pre);
    ok(plan.aLimpiar.length === 2, 'solo las DOS celdas con contenido entran al plan, dio ' + plan.aLimpiar.length);
    ok(plan.total === 3000, 'el total suma 1000+2000=3000, dio ' + plan.total);
    ok(plan.porBloque.ingresos === 1 && plan.porBloque.fijos === 1 && plan.porBloque.variables === 0,
        'el desglose por bloque es exacto, dio ' + JSON.stringify(plan.porBloque));
}

seccion('3. "Monto a Proyectar" ya vacia: NADA QUE LIMPIAR, sin dialogo');
{
    const hoja = hojaPresupuestoBase({});
    ssActual = ssCon(hoja);
    alertas = []; botonesUsados = [];
    const r = ctx.aplicarPresupuestoLimpiar();
    ok(r.ok, 'aplicar no da error cuando ya esta vacia: ' + (r.error || ''));
    ok(!botonesUsados.includes('YN'), 'ningun dialogo de confirmacion se disparo');
    ok(/NADA QUE LIMPIAR/.test(r.detalle || ''), 'el mensaje dice NADA QUE LIMPIAR, dio: ' + (r.detalle || '').slice(0, 80));

    const rEstado = ctx.estadoPresupuestoLimpiar();
    ok(rEstado.ok && /NADA QUE LIMPIAR/.test(rEstado.detalle || ''), 'estado tambien lo dice, sin escribir nada');
}

seccion('4. Hay celdas con contenido: SIEMPRE hay confirmacion, con el numero exacto y por bloque');
{
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 500000 }, { celda: 'S12', valor: 25000.5 }] });
    ssActual = ssCon(hoja);
    alertas = []; botonesUsados = [];
    const r = ctx.aplicarPresupuestoLimpiar();
    ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));
    ok(botonesUsados.includes('YN'), 'SI hubo dialogo de confirmacion');
    const confirm = alertas.find((a) => /SE VAN A BORRAR/.test(a));
    ok(!!confirm, 'el titulo nombra "SE VAN A BORRAR"');
    ok(confirm && /Suman 525000\.50 ARS/.test(confirm), 'la confirmacion dice EXACTO cuanto suman (525000.50 ARS), dio: ' +
        (confirm && confirm.split('\n').find((l) => /Suman/.test(l))));
    ok(confirm && /Ingresos: 1 celda\(s\)/.test(confirm) && /Gastos Variables: 1 celda\(s\)/.test(confirm),
        'el desglose por bloque aparece en la confirmacion');
}

seccion('5. Cancelar la confirmacion: no se borra nada');
{
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 777 }] });
    ssActual = ssCon(hoja);
    const alertOriginal = ctx.SpreadsheetApp.getUi;
    ctx.SpreadsheetApp.getUi = () => ({
        alert: () => 'N',
        ButtonSet: { YES_NO: 'YN', OK: 'OK' },
        Button: { YES: 'Y', NO: 'N' }
    });
    const r = ctx.aplicarPresupuestoLimpiar();
    ctx.SpreadsheetApp.getUi = alertOriginal;
    ok(!r.ok && /Cancelado/.test(r.error || ''), 'cancelar devuelve ok:false con "Cancelado", dio: ' + r.error);
    ok(hoja.celdas['K9'] && hoja.celdas['K9'].valor === 777, 'K9 SIGUE en 777 -- no se toco nada');
}

seccion('6. Aplicar feliz: borra con clearContent, verifica por relectura, guarda respaldo');
{
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 500000 }, { celda: 'O10', valor: 200000 }] });
    ssActual = ssCon(hoja);
    propiedadesFalsas = {};
    const r = ctx.aplicarPresupuestoLimpiar();
    ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));
    ok(!('K9' in hoja.celdas), 'K9 quedo vacia (clearContent, no setValue(0))');
    ok(!('O10' in hoja.celdas), 'O10 quedo vacia');
    ok(!!propiedadesFalsas[ctx.PL_PROP_PREVIOS], 'quedo un respaldo en Document Properties');
    const previos = JSON.parse(propiedadesFalsas[ctx.PL_PROP_PREVIOS]);
    ok(previos.celdas.length === 2, 'el respaldo trae las DOS celdas borradas');
}

seccion('7. Verificacion que falla: revierte el LOTE ENTERO al valor previo exacto');
{
    // K9 es "tragona": ni setValue ni clearContent le hacen efecto (simula una celda combinada).
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 111 }, { celda: 'O10', valor: 222 }], tragonas: { K9: true } });
    ssActual = ssCon(hoja);
    alertas = []; botonesUsados = [];
    const r = ctx.aplicarPresupuestoLimpiar();
    ok(!r.ok, 'aplicar FALLA en vez de declarar exito sobre un borrado que no verifica');
    ok(/no verifica/i.test(r.error || ''), 'el error dice que la verificacion fallo: ' + r.error);
    ok(hoja.celdas['K9'] && hoja.celdas['K9'].valor === 111, 'K9 (tragona) SIGUE en 111 -- nunca se borro');
    ok(hoja.celdas['O10'] && hoja.celdas['O10'].valor === 222, 'O10 (SI se habia borrado bien) se REPUSO a 222, el valor previo exacto');
}

seccion('8. Revertir: protege una edicion manual posterior, y un segundo revertir no tiene nada que hacer');
{
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 999 }, { celda: 'S15', valor: 55 }] });
    ssActual = ssCon(hoja);
    const rAplicar = ctx.aplicarPresupuestoLimpiar();
    ok(rAplicar.ok, 'aplicar corre sin error: ' + (rAplicar.error || ''));
    ok(!('K9' in hoja.celdas) && !('S15' in hoja.celdas), 'las dos celdas quedaron vacias tras aplicar');

    hoja.celdas['K9'] = { valor: 123456, formula: '' };   // Franco escribe algo nuevo en K9 DESPUES de limpiar
    const rRev = ctx.revertirPresupuestoLimpiar();
    ok(rRev.ok, 'revertir corre sin error: ' + (rRev.error || ''));
    ok(hoja.celdas['K9'].valor === 123456, 'K9 (Franco escribio algo nuevo) SIGUE en 123456 -- revertir no la piso');
    ok(hoja.celdas['S15'] && hoja.celdas['S15'].valor === 55, 'S15 (seguia vacia) se REPUSO a 55, su valor previo exacto');

    const rRev2 = ctx.revertirPresupuestoLimpiar();
    ok(!rRev2.ok && /no hay ninguna corrida/i.test(rRev2.error || ''), 'un segundo revertir no tiene nada que deshacer: ' + rRev2.error);
}

seccion('9. La moneda del total es informativa: J4 invalida o vacia no aborta nada');
{
    const hoja = hojaPresupuestoBase({ moneda: 'PESOS RAROS', kos: [{ celda: 'K9', valor: 100 }] });
    ssActual = ssCon(hoja);
    alertas = []; botonesUsados = [];
    const r = ctx.aplicarPresupuestoLimpiar();
    ok(r.ok, 'aplicar corre sin error aunque J4 sea invalida: ' + (r.error || ''));
    const confirm = alertas.find((a) => /SE VAN A BORRAR/.test(a));
    ok(confirm && /moneda no reconocida en J4/.test(confirm), 'el rotulo de moneda avisa que J4 no es reconocida, sin abortar');
}

// ============================================
console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (9 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
