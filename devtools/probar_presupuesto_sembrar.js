/**
 * devtools/probar_presupuesto_sembrar.js
 * Banco de pruebas de src/DEVTOOL_PresupuestoSembrar.js.
 *
 * Prueba por MUTACION: cada decision del encargo se rompe a proposito y el banco tiene que
 * matarla. Las decisiones bajo prueba (ver la cabecera del modulo real para el porque de cada
 * una):
 *
 *   1. La correspondencia J->K, N->O, R->S sale de PC_BLOQUES (DEVTOOL_PresupuestoResumen.js),
 *      nunca retipeada.
 *   2. El anuncio de MODO: en "Historico" avisa EXPLICITO que no es la Proyeccion; en
 *      "Proyeccion" no lleva esa advertencia.
 *   3. NUNCA pisa una celda K/O/S con contenido -- incluido el caso limite "0" (un cero tipeado
 *      a mano es contenido real, no "vacio").
 *   4. LA TRAMPA DEL SPILL: una fuente J/N/R que no es un numero real (con cuenta presente,
 *      igual que un #ERROR!) aborta TODA la corrida en vez de sembrar 89 cuentas bien y 1 mal en
 *      silencio. Una fila SIN cuenta se saltea sin marcarla de anomalia.
 *   5. Escribe VALORES (setValue), nunca formulas.
 *   6. El preflight aborta ante un rotulo corrido O ante una formula viva en la zona K/O/S
 *      (deberia ser solo valores tipeados).
 *   7. Si la verificacion post-escritura falla en UNA celda, se revierte el LOTE ENTERO de esta
 *      corrida (no solo la celda que fallo).
 *   8. revertirPresupuestoSembrar() es MAS protector que sus hermanos: solo vacia una celda si
 *      TODAVIA tiene exactamente el numero que la corrida escribio; si Franco la corrigio
 *      despues, la deja como esta.
 *   9. Idempotencia: aplicar dos veces no vuelve a escribir lo ya sembrado.
 *  10. estadoPresupuestoSembrar() no escribe una sola celda.
 *
 * USO:  node devtools/probar_presupuesto_sembrar.js
 * @version 0.1.0
 * @since 2026-08-25
 * @see src/DEVTOOL_PresupuestoSembrar.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };
const seccion = (t) => console.log('\n== ' + t + ' ==');

// ============================================
// CARGA DEL MODULO REAL (mismo orden de dependencias que probar_presupuesto_resumen.js)
// ============================================
let alertas = [];
let propiedadesFalsas = {};
const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp, Error,
    SpreadsheetApp: {
        newDataValidation: () => {
            const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({ __mock: 'validacion' }) };
            return b;
        },
        flush() {},
        getUi: () => ({
            alert: (t, m) => { alertas.push(t + '\n' + m); return 'Y'; },
            ButtonSet: { YES_NO: 'YN', OK: 'OK' },
            Button: { YES: 'Y', NO: 'N' }
        }),
        getActiveSpreadsheet: () => ssActual
    },
    PropertiesService: {
        getDocumentProperties: () => ({
            getProperty: (k) => (k in propiedadesFalsas ? propiedadesFalsas[k] : null),
            setProperty: (k, v) => { propiedadesFalsas[k] = v; },
            deleteProperty: (k) => { delete propiedadesFalsas[k]; }
        })
    },
    Utilities: { formatDate: () => '2026-08-25_1200' },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {}
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoResumen.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoSembrar.js'), 'utf8') +
    '\n;Object.assign(globalThis,{SHEETS,PM_MODO,PM_BLOQUES,PM_CLAVES_BLOQUE,PM_FILA_INI,PM_FILA_FIN,' +
    'PC_BLOQUES,PC_TITULO_PROYECTAR,PS_UMBRAL_IDENTIDAD,PS_PROP_PREVIOS,_preflightPs,_planPs,' +
    '_anuncioModoPs,_lineaBloquePs,estadoPresupuestoSembrar,aplicarPresupuestoSembrar,' +
    'revertirPresupuestoSembrar,_rotulosCompatibles,_normalizarRotulo});',
    ctx
);

// ============================================
// HOJA FALSA -- solo lo que este modulo pide: getRange(a1) de celda unica y
// getRange('COLfila:COLfila') de una columna (getValues), setValue/clearContent/getFormula.
// ============================================
function crearHojaPs(celdas, tragonas) {
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
            getDisplayValue() { return String((celdas[ref] && celdas[ref].valor !== undefined) ? celdas[ref].valor : ''); },
            setValue(v) {
                if (tragonas[ref]) return;   // simula una celda que se traga la escritura (combinada)
                celdas[ref] = { valor: v, formula: '' };
            },
            clearContent() { delete celdas[ref]; }
        };
    }
    return { celdas: celdas, getRange: getRango, _tragonas: tragonas };
}

let ssActual = null;
function ssCon(hoja) {
    return { getSheetByName: (n) => (n === ctx.SHEETS.PRESUPUESTO ? hoja : null) };
}

/**
 * Escenario base: tres bloques con geometria REAL (leida del modulo, no retipeada), cada uno
 * con dos cuentas -- una con K/O/S VACIA (se siembra) y otra con K/O/S LLENA (no se toca).
 * "Cine" en Variables prueba el caso limite: S=0 es un cero tipeado a mano, no "vacio".
 */
function hojaBase(opciones) {
    opciones = opciones || {};
    const modo = opciones.modo || ctx.PM_MODO.proyeccion;
    const celdas = {};
    const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

    set(ctx.PM_MODO.rotulo.celda, ctx.PM_MODO.rotulo.esperado);
    set(ctx.PM_MODO.celda, modo);

    ctx.PM_CLAVES_BLOQUE.forEach((k) => {
        const bPm = ctx.PM_BLOQUES[k];
        const bPc = ctx.PC_BLOQUES[k];
        set(bPm.tituloBloque.celda, bPm.tituloBloque.esperado);
        set(bPm.rotuloCuenta.celda, bPm.rotuloCuenta.esperado);
        set(bPc.colProyectar + '7', ctx.PC_TITULO_PROYECTAR);
    });

    // Ingresos: fila 9 "Sueldo" (J=1000, K vacia -> se siembra); fila 10 "Freelance" (J=200, K=150 -> llena)
    set('I9', 'Sueldo'); set('J9', 1000);
    set('I10', 'Freelance'); set('J10', 200); set('K10', 150);
    // Fijos: fila 9 "Alquiler" (N=500, O vacia); fila 10 "Auto" (N=300, O=280 -> llena)
    set('M9', 'Alquiler'); set('N9', 500);
    set('M10', 'Auto'); set('N10', 300); set('O10', 280);
    // Variables: fila 9 "Nafta" (R=80, S vacia); fila 10 "Cine" (R=40, S=0 -> llena, CASO LIMITE)
    set('Q9', 'Nafta'); set('R9', 80);
    set('Q10', 'Cine'); set('R10', 40); set('S10', 0);

    if (opciones.filaSinCuenta) {
        // Fila 13: sin cuenta (I vacio) pero con un resto de R -- tiene que saltearse, no sembrarse.
        set('R13', 999);
    }
    if (opciones.fuenteInvalida) {
        // Fila 12: CUENTA presente pero la fuente J es "" -- la trampa del spill (ver cabecera).
        set('I12', 'ConCuentaSinFuente'); set('J12', '');
    }

    return crearHojaPs(celdas, opciones.tragonas);
}

function snapshot(hoja) { return JSON.stringify(hoja.celdas); }

// ============================================
console.log('BANCO: DEVTOOL_PresupuestoSembrar');
console.log('  geometria leida de PC_BLOQUES (DEVTOOL_PresupuestoResumen.js), no retipeada aca.');

seccion('0. Sanity: la correspondencia J->K, N->O, R->S sale de PC_BLOQUES');
ok(ctx.PC_BLOQUES.ingresos.colModo === 'J' && ctx.PC_BLOQUES.ingresos.colProyectar === 'K',
    'ingresos: J -> K');
ok(ctx.PC_BLOQUES.fijos.colModo === 'N' && ctx.PC_BLOQUES.fijos.colProyectar === 'O',
    'fijos: N -> O');
ok(ctx.PC_BLOQUES.variables.colModo === 'R' && ctx.PC_BLOQUES.variables.colProyectar === 'S',
    'variables: R -> S');

seccion('1. El plan clasifica bien: vacias, llenas (incl. el cero), sin cuenta');
{
    const hoja = hojaBase({ filaSinCuenta: true });
    const pre = ctx._preflightPs(ssCon(hoja));
    const plan = ctx._planPs(pre);

    const celdasASembrar = plan.aSembrar.map((c) => c.celda).sort();
    ok(JSON.stringify(celdasASembrar) === JSON.stringify(['K9', 'O9', 'S9']),
        'a sembrar: EXACTAMENTE K9, O9, S9 (las tres celdas vacias). Dio ' + JSON.stringify(celdasASembrar));

    const valorK9 = plan.aSembrar.find((c) => c.celda === 'K9').valor;
    ok(valorK9 === 1000, 'K9 se sembraria con 1000 (copiado de J9), dio ' + valorK9);

    const celdasLlenas = plan.yaLlenas.map((c) => c.celda).sort();
    ok(JSON.stringify(celdasLlenas) === JSON.stringify(['K10', 'O10', 'S10']),
        'llenas (no se tocan): K10 (150), O10 (280) y S10 (0 -- CASO LIMITE, un cero tipeado SI ' +
        'cuenta como contenido). Dio ' + JSON.stringify(celdasLlenas));

    ok(plan.porBloque.variables.sinCuenta >= 1,
        'la fila 13 (R13=999 sin cuenta en Q13) se cuenta como "sin cuenta", no se siembra ni se marca anomalia');
    ok(plan.fuenteInvalida.length === 0, 'sin la mutacion de fuente invalida, ninguna anomalia');
}

seccion('2. LA TRAMPA DEL SPILL: cuenta presente + fuente "" -> anomalia, aborta TODO al aplicar');
{
    const hoja = hojaBase({ fuenteInvalida: true });
    ssActual = ssCon(hoja);
    const antes = snapshot(hoja);
    const r = ctx.aplicarPresupuestoSembrar();
    ok(!r.ok, 'aplicar FALLA en vez de sembrar 3 cuentas bien y una mal en silencio');
    ok(/no es un numero valido/.test(r.error || ''), 'el error nombra el problema: ' + (r.error || ''));
    ok(r.error.indexOf('J12') !== -1, 'el error senala la celda exacta (J12)');
    ok(snapshot(hoja) === antes, 'NO SE ESCRIBIO NADA -- ni siquiera K9/O9/S9, que si eran validas');
}

seccion('3. MODO: el anuncio avisa EXPLICITO cuando NO es la Proyeccion');
{
    const preProy = ctx._preflightPs(ssCon(hojaBase({ modo: ctx.PM_MODO.proyeccion })));
    const anuncioProy = ctx._anuncioModoPs(preProy);
    ok(anuncioProy.indexOf('ATENCION') === -1,
        'en modo Proyeccion, el anuncio NO lleva la advertencia');
    ok(anuncioProy.indexOf('Proyeccion') !== -1, 'el anuncio nombra el modo vivo');

    const preHist = ctx._preflightPs(ssCon(hojaBase({ modo: ctx.PM_MODO.historico })));
    const anuncioHist = ctx._anuncioModoPs(preHist);
    ok(anuncioHist.indexOf('ATENCION') !== -1,
        'en modo Historico, el anuncio SI lleva "ATENCION"');
    ok(/NO es la Proyeccion/.test(anuncioHist),
        'y dice EXPLICITO que lo que se copiaria no es la Proyeccion: "' + anuncioHist.split('\n')[1] + '"');

    // MUTACION: si el anuncio dejara de distinguir los modos (ej. siempre el texto de Proyeccion),
    // esta asercion lo agarra -- son dos textos distintos, no una constante compartida.
    ok(anuncioProy !== anuncioHist, 'los dos anuncios son TEXTOS DISTINTOS (no una plantilla que ignora el modo)');
}

seccion('4. Aplicar: siembra SOLO las vacias, con VALORES (no formulas), y no pisa nada');
{
    const hoja = hojaBase();
    ssActual = ssCon(hoja);
    const r = ctx.aplicarPresupuestoSembrar();
    ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));

    ok(hoja.celdas['K9'].valor === 1000 && hoja.celdas['K9'].formula === '',
        'K9 = 1000, escrito con setValue (formula queda vacia)');
    ok(hoja.celdas['O9'].valor === 500 && hoja.celdas['O9'].formula === '', 'O9 = 500 (valor, no formula)');
    ok(hoja.celdas['S9'].valor === 80 && hoja.celdas['S9'].formula === '', 'S9 = 80 (valor, no formula)');

    ok(hoja.celdas['O10'].valor === 280, 'O10 (ya tenia 280) sigue en 280 -- NO se toco');
    ok(hoja.celdas['S10'].valor === 0, 'S10 (ya tenia 0) sigue en 0 -- el cero de Franco no se pisa');

    ok(propiedadesFalsas[ctx.PS_PROP_PREVIOS], 'quedo un respaldo en Document Properties para poder revertir');
    const previos = JSON.parse(propiedadesFalsas[ctx.PS_PROP_PREVIOS]);
    ok(previos.celdas.length === 3, 'el respaldo recuerda las 3 celdas que ESTA corrida escribio, dio ' + previos.celdas.length);

    seccion('4b. Idempotencia: aplicar nuevamente no vuelve a escribir nada');
    const r2 = ctx.aplicarPresupuestoSembrar();
    ok(r2.ok, 'la segunda corrida no da error');
    ok(/No hay ninguna celda/i.test(r2.detalle || ''), 'reconoce que ya no queda nada vacio para sembrar');

    seccion('4c. Revertir: protege una edicion manual posterior, pero limpia el resto');
    hoja.celdas['O9'] = { valor: 999999, formula: '' };   // Franco corrigio O9 a mano DESPUES de sembrarla
    const rRev = ctx.revertirPresupuestoSembrar();
    ok(rRev.ok, 'revertir corre sin error: ' + (rRev.error || ''));
    ok(!('K9' in hoja.celdas), 'K9 (nunca tocada despues de sembrarla) quedo VACIA');
    ok(!('S9' in hoja.celdas), 'S9 (nunca tocada despues de sembrarla) quedo VACIA');
    ok(!!hoja.celdas['O9'] && hoja.celdas['O9'].valor === 999999,
        'O9 (Franco la corrigio a 999999 despues de sembrarla) SIGUE EN 999999 -- revertir no la piso. Dio ' +
        JSON.stringify(hoja.celdas['O9']));
    ok(/dejadas como estan|O9/.test(rRev.detalle), 'el reporte de revertir menciona la celda que dejo como estaba');

    seccion('4d. Doble revertir: la segunda vez no hay nada que deshacer');
    const rRev2 = ctx.revertirPresupuestoSembrar();
    ok(!rRev2.ok, 'revertir DE NUEVO falla (ya no hay corrida registrada)');
    ok(/no hay ninguna corrida/i.test(rRev2.error || ''), 'el error lo explica: ' + rRev2.error);
}

seccion('5. Verificacion post-escritura: si UNA celda no verifica, se revierte el LOTE ENTERO');
{
    // K9 es "tragona": acepta el setValue y no lo guarda -- simula una celda combinada. O9 y S9
    // son normales. Si el modulo solo revirtiera la celda rota, O9/S9 quedarian sembradas con
    // exito PARCIAL, que es exactamente lo que este modulo no puede permitirse (misma leccion
    // que el incidente de DEVTOOL_CuentasComodin.js, seccion 7 de su propio banco).
    const hoja = hojaBase({ tragonas: { K9: true } });
    ssActual = ssCon(hoja);
    const r = ctx.aplicarPresupuestoSembrar();
    ok(!r.ok, 'aplicar FALLA en vez de declarar exito sobre una escritura que no verifica');
    ok(/no verifica/i.test(r.error || ''), 'el error dice que la verificacion fallo: ' + r.error);
    ok(!('K9' in hoja.celdas), 'K9 (la tragona) nunca quedo con el valor');
    ok(!('O9' in hoja.celdas), 'O9 (SI se habia escrito bien) se REVIRTIO igual -- todo o nada');
    ok(!('S9' in hoja.celdas), 'S9 (SI se habia escrito bien) se REVIRTIO igual -- todo o nada');
    ok(!propiedadesFalsas[ctx.PS_PROP_PREVIOS], 'no quedo respaldo de una corrida que no se aplico de verdad');
}

seccion('6. Preflight: aborta ante un rotulo corrido, sin escribir nada');
{
    const hoja = hojaBase();
    hoja.celdas['I7'] = { valor: 'Otra Cosa', formula: '' };
    let lanzo = false;
    try { ctx._preflightPs(ssCon(hoja)); } catch (e) { lanzo = true; ok(/no es la que este modulo espera/.test(e.message), 'mensaje claro: ' + e.message.slice(0, 90)); }
    ok(lanzo, 'MUTACION rotulo (I7 corrido): el preflight aborta');
}

seccion('7. Preflight: aborta si K/O/S ya tiene una FORMULA viva (deberia ser solo valores)');
{
    const hoja = hojaBase();
    hoja.celdas['O15'] = { valor: 0, formula: '=1+1' };
    let lanzo = false;
    try { ctx._preflightPs(ssCon(hoja)); } catch (e) { lanzo = true; ok(/formulas en la zona/i.test(e.message), 'mensaje claro: ' + e.message.slice(0, 90)); }
    ok(lanzo, 'MUTACION (formula viva en O15): el preflight aborta -- drift inesperado');
}

seccion('8. Preflight: aborta si el Modo (E7) no es ninguno de los dos valores conocidos');
{
    const hoja = hojaBase({ modo: 'Un Modo Que No Existe' });
    let lanzo = false;
    try { ctx._preflightPs(ssCon(hoja)); } catch (e) { lanzo = true; }
    ok(lanzo, 'MUTACION (E7 invalido): el preflight aborta');
}

seccion('9. estadoPresupuestoSembrar(): no escribe una sola celda');
{
    const hoja = hojaBase();
    ssActual = ssCon(hoja);
    const antes = snapshot(hoja);
    const r = ctx.estadoPresupuestoSembrar();
    ok(r.ok, 'estado corre sin error');
    ok(snapshot(hoja) === antes, 'la hoja quedo IDENTICA despues de "1. Ver estado"');
    ok(r.detalle.indexOf('K9') !== -1 || /CELDAS A SEMBRAR/.test(r.detalle), 'el reporte describe lo que se sembraria');
}

// ============================================
console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (10 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
