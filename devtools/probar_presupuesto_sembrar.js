/**
 * devtools/probar_presupuesto_sembrar.js
 * Banco de pruebas de src/DEVTOOL_PresupuestoSembrar.js.
 *
 * Prueba por MUTACION: cada decision del encargo se rompe a proposito y el banco tiene que
 * matarla. Las decisiones bajo prueba (ver la cabecera del modulo real para el porque de cada
 * una):
 *
 *   1. La correspondencia J->K, N->O, R->S sale de _bloquesPc() (DEVTOOL_PresupuestoResumen.js),
 *      nunca retipeada.
 *   2. El anuncio de MODO: en "Historico" avisa EXPLICITO que no es la Proyeccion; en
 *      "Proyeccion" no lleva esa advertencia.
 *   3. SIEMBRA TODA fila con cuenta y fuente valida, PISE O NO -- incluido el caso limite "0"
 *      (un cero tipeado a mano tambien se pisa: fix v0.51.2, ver seccion 4 mas abajo).
 *   4. LA TRAMPA DEL SPILL: una fuente J/N/R que no es un numero real (con cuenta presente,
 *      igual que un #ERROR!) aborta TODA la corrida en vez de sembrar 89 cuentas bien y 1 mal en
 *      silencio. Una fila SIN cuenta se saltea sin marcarla de anomalia.
 *   5. Escribe VALORES (setValue), nunca formulas.
 *   6. El preflight aborta ante un rotulo corrido O ante una formula viva en la zona K/O/S
 *      (deberia ser solo valores tipeados).
 *   7. Si la verificacion post-escritura falla en UNA celda, se revierte el LOTE ENTERO de esta
 *      corrida AL ESTADO PREVIO EXACTO de cada celda (no solo "vaciar" -- fix v0.51.2).
 *   8. revertirPresupuestoSembrar() es MAS protector que sus hermanos: solo repone una celda si
 *      TODAVIA tiene exactamente el numero que la corrida escribio; si Franco la corrigio
 *      despues, la deja como esta. Y repone EXACTO lo que habia antes (vacio, o un valor).
 *   9. Confirmacion explicita SOLO cuando hay algo que pisar (fix v0.51.2): si no hay ninguna
 *      celda con contenido previo, aplicar corre derecho, sin dialogo.
 *  10. LA REGRESION QUE REPORTO FRANCO: sembrar el mes A, cambiar el selector al mes B (con
 *      montos de origen distintos) y sembrar de nuevo -- K/O/S tienen que quedar con los
 *      valores de B, no con los de A. Antes de este fix, "ya hay datos" bloqueaba la segunda
 *      siembra sin escribir nada.
 *  11. estadoPresupuestoSembrar() no escribe una sola celda, y separa vacias de "SE PISAN".
 *
 * USO:  node devtools/probar_presupuesto_sembrar.js
 * @version 0.2.0
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
let alertas = [];       // texto completo de cada alert (titulo + mensaje)
let botonesUsados = []; // 'YN' o 'OK' por cada llamada a ui.alert, en orden -- para distinguir
                         // una confirmacion (YES_NO) de un simple aviso (OK).
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
            alert: (t, m, botones) => {
                alertas.push(t + '\n' + m);
                botonesUsados.push(botones === 'YN' ? 'YN' : 'OK');
                return 'Y';
            },
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
    'PM_SELECTORES,IP_MESES,_mesRefDesdeSelectoresPm,' +
    '_bloquesPc,PC_TITULO_PROYECTAR,PS_UMBRAL_IDENTIDAD,PS_PROP_PREVIOS,_preflightPs,_planPs,' +
    '_anuncioModoPs,_periodoPs,_lineaBloquePs,estadoPresupuestoSembrar,aplicarPresupuestoSembrar,' +
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
 * con dos cuentas -- una con K/O/S VACIA (se siembra sin pisar) y otra con K/O/S LLENA (se
 * siembra PISANDO, desde v0.51.2). "Cine" en Variables prueba el caso limite: S=0 es un cero
 * tipeado a mano, no "vacio" -- y AHORA tambien se pisa, a proposito.
 *
 * Tambien deja armado el selector de periodo (I2 rotulo + J2 mes + J3 anio, PM_SELECTORES) con
 * un default valido, para que _periodoPs() tenga algo real que interpretar. `opciones.mesSel` /
 * `opciones.anioSel` lo pisan (usado por la seccion 10, el cambio de mes A a mes B).
 */
function hojaBase(opciones) {
    opciones = opciones || {};
    const modo = opciones.modo || ctx.PM_MODO.proyeccion;
    const celdas = {};
    const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

    set(ctx.PM_MODO.rotulo.celda, ctx.PM_MODO.rotulo.esperado);
    set(ctx.PM_MODO.celda, modo);

    set(ctx.PM_SELECTORES.rotuloPeriodo.celda, ctx.PM_SELECTORES.rotuloPeriodo.esperado);
    set(ctx.PM_SELECTORES.mes, opciones.mesSel || 'Septiembre');
    set(ctx.PM_SELECTORES.anio, opciones.anioSel || 2026);

    ctx.PM_CLAVES_BLOQUE.forEach((k) => {
        const bPm = ctx.PM_BLOQUES[k];
        const bPc = ctx._bloquesPc()[k];
        set(bPm.tituloBloque.celda, bPm.tituloBloque.esperado);
        set(bPm.rotuloCuenta.celda, bPm.rotuloCuenta.esperado);
        set(bPc.colProyectar + '7', ctx.PC_TITULO_PROYECTAR);
    });

    // Ingresos: fila 9 "Sueldo" (J=1000, K vacia -> se siembra); fila 10 "Freelance" (J=200, K=150 -> se pisa)
    set('I9', 'Sueldo'); set('J9', 1000);
    set('I10', 'Freelance'); set('J10', 200); set('K10', 150);
    // Fijos: fila 9 "Alquiler" (N=500, O vacia); fila 10 "Auto" (N=300, O=280 -> se pisa)
    set('M9', 'Alquiler'); set('N9', 500);
    set('M10', 'Auto'); set('N10', 300); set('O10', 280);
    // Variables: fila 9 "Nafta" (R=80, S vacia); fila 10 "Cine" (R=40, S=0 -> se pisa, CASO LIMITE)
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
console.log('BANCO: DEVTOOL_PresupuestoSembrar (v0.51.2 -- ahora pisa, con confirmacion)');
console.log('  geometria leida de _bloquesPc() (DEVTOOL_PresupuestoResumen.js), no retipeada aca.');

seccion('0. Sanity: la correspondencia J->K, N->O, R->S sale de _bloquesPc()');
ok(ctx._bloquesPc().ingresos.colModo === 'J' && ctx._bloquesPc().ingresos.colProyectar === 'K',
    'ingresos: J -> K');
ok(ctx._bloquesPc().fijos.colModo === 'N' && ctx._bloquesPc().fijos.colProyectar === 'O',
    'fijos: N -> O');
ok(ctx._bloquesPc().variables.colModo === 'R' && ctx._bloquesPc().variables.colProyectar === 'S',
    'variables: R -> S');

seccion('1. El plan clasifica bien: vacias (se llenan), pisan (tenian valor, incl. el cero), sin cuenta');
{
    const hoja = hojaBase({ filaSinCuenta: true });
    const pre = ctx._preflightPs(ssCon(hoja));
    const plan = ctx._planPs(pre);

    const celdasASembrar = plan.aSembrar.map((c) => c.celda).sort();
    ok(JSON.stringify(celdasASembrar) === JSON.stringify(['K10', 'K9', 'O10', 'O9', 'S10', 'S9']),
        'a sembrar: las SEIS celdas con cuenta+fuente validas (vacias Y llenas). Dio ' + JSON.stringify(celdasASembrar));

    const porCelda = {};
    plan.aSembrar.forEach((c) => { porCelda[c.celda] = c; });

    ok(porCelda['K9'].valor === 1000 && porCelda['K9'].pisa === false,
        'K9 se sembraria con 1000 (copiado de J9), pisa=false (estaba vacia)');
    ok(porCelda['K10'].valor === 200 && porCelda['K10'].pisa === true && porCelda['K10'].valorPrevio === 150,
        'K10 se sembraria con 200 (copiado de J10), pisa=true, valorPrevio=150 (lo que tenia)');
    ok(porCelda['S10'].pisa === true && porCelda['S10'].valorPrevio === 0,
        'S10 (CASO LIMITE: tenia un CERO tipeado a mano) tambien pisa=true, valorPrevio=0 -- el cero SI cuenta como contenido previo');

    ok(plan.porBloque.ingresos.vacias === 1 && plan.porBloque.ingresos.pisa === 1,
        'bloque ingresos: 1 vacia + 1 pisa, dio ' + JSON.stringify(plan.porBloque.ingresos));
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
    ok(!r.ok, 'aplicar FALLA en vez de sembrar bien y una mal en silencio');
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

seccion('4. Aplicar: siembra TODO (vacias Y llenas), con VALORES (no formulas) -- PISA a proposito');
{
    const hoja = hojaBase();
    ssActual = ssCon(hoja);
    const r = ctx.aplicarPresupuestoSembrar();
    ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));

    ok(hoja.celdas['K9'].valor === 1000 && hoja.celdas['K9'].formula === '',
        'K9 = 1000, escrito con setValue (formula queda vacia)');
    ok(hoja.celdas['O9'].valor === 500 && hoja.celdas['O9'].formula === '', 'O9 = 500 (valor, no formula)');
    ok(hoja.celdas['S9'].valor === 80 && hoja.celdas['S9'].formula === '', 'S9 = 80 (valor, no formula)');

    ok(hoja.celdas['K10'].valor === 200, 'K10 (tenia 150) AHORA SE PISA a 200 -- fix v0.51.2, ya no se protege');
    ok(hoja.celdas['O10'].valor === 300, 'O10 (tenia 280) se pisa a 300');
    ok(hoja.celdas['S10'].valor === 40, 'S10 (tenia el cero de Franco) se pisa a 40 -- el cero YA NO se protege');

    ok(propiedadesFalsas[ctx.PS_PROP_PREVIOS], 'quedo un respaldo en Document Properties para poder revertir');
    const previos = JSON.parse(propiedadesFalsas[ctx.PS_PROP_PREVIOS]);
    ok(previos.celdas.length === 6, 'el respaldo recuerda las 6 celdas que ESTA corrida escribio (3 vacias + 3 pisadas), dio ' + previos.celdas.length);
    const previoK10 = previos.celdas.find((c) => c.celda === 'K10');
    ok(previoK10 && previoK10.pisa === true && previoK10.valorPrevio === 150,
        'el respaldo de K10 recuerda pisa=true y valorPrevio=150 (para poder reponerlo, no solo vaciarlo)');

    seccion('4a. La confirmacion SI aparecio (hubo celdas para pisar) y avisa cuantas y el periodo');
    const ultimaConfirm = alertas.slice().reverse().find((a) => /SE VAN A PISAR/.test(a));
    ok(!!ultimaConfirm, 'hubo un dialogo de confirmacion con "SE VAN A PISAR" en el titulo');
    ok(/3 SE VAN A PISAR/.test(ultimaConfirm) || /de las cuales 3/.test(ultimaConfirm),
        'la confirmacion dice el numero exacto de celdas a pisar (3): ' + ultimaConfirm.split('\n')[0]);
    ok(/PERIODO/.test(ultimaConfirm), 'la confirmacion incluye de que periodo se esta sembrando');

    seccion('4b. Idempotencia: aplicar de nuevo con el MISMO periodo deja el mismo resultado (repisa, no duplica)');
    const r2 = ctx.aplicarPresupuestoSembrar();
    ok(r2.ok, 'la segunda corrida no da error: ' + (r2.error || ''));
    ok(hoja.celdas['K9'].valor === 1000 && hoja.celdas['K10'].valor === 200,
        'con la misma fuente, el resultado final es identico (1000/200) -- pisar dos veces con el mismo dato no cambia nada');

    seccion('4c. Revertir: protege una edicion manual posterior, pero repone el resto AL VALOR PREVIO EXACTO');
    // Antes de revertir, "previos" en Properties es el de la CORRIDA 4b (la mas reciente): partia
    // de K9/K10/... ya sembrados por 4/4b con los mismos valores, asi que valorPrevio == valorEscrito
    // para todas -- revertir deberia dejar la hoja IGUAL (no hay cambio real que deshacer), salvo
    // la celda que se edita a mano ahora mismo:
    hoja.celdas['O9'] = { valor: 999999, formula: '' };   // Franco corrigio O9 a mano DESPUES de la ultima siembra
    const rRev = ctx.revertirPresupuestoSembrar();
    ok(rRev.ok, 'revertir corre sin error: ' + (rRev.error || ''));
    ok(!!hoja.celdas['O9'] && hoja.celdas['O9'].valor === 999999,
        'O9 (Franco la corrigio a 999999 despues de sembrar) SIGUE EN 999999 -- revertir no la piso. Dio ' +
        JSON.stringify(hoja.celdas['O9']));
    ok(/dejadas como estan|O9/.test(rRev.detalle), 'el reporte de revertir menciona la celda que dejo como estaba');

    seccion('4d. Doble revertir: la segunda vez no hay nada que deshacer');
    const rRev2 = ctx.revertirPresupuestoSembrar();
    ok(!rRev2.ok, 'revertir DE NUEVO falla (ya no hay corrida registrada)');
    ok(/no hay ninguna corrida/i.test(rRev2.error || ''), 'el error lo explica: ' + rRev2.error);
}

seccion('5. Verificacion post-escritura: si UNA celda no verifica, se revierte el LOTE ENTERO al estado previo EXACTO');
{
    // K9 es "tragona": acepta el setValue y no lo guarda -- simula una celda combinada. O9 y S9
    // (y el resto) son normales. Si el modulo solo revirtiera la celda rota, el resto quedaria
    // sembrado con exito PARCIAL, que es exactamente lo que este modulo no puede permitirse
    // (misma leccion que el incidente de DEVTOOL_CuentasComodin.js, seccion 7 de su propio banco).
    // Ademas O10 tenia un valor previo (150 en K10 en el escenario base, pero probamos con O10=280
    // pisado) -- confirma que la reversion repone el VALOR PREVIO, no solo "vacia".
    const hoja = hojaBase({ tragonas: { K9: true } });
    ssActual = ssCon(hoja);
    const antesO10 = hoja.celdas['O10'].valor; // 280, el valor "manual" antes de este intento
    const r = ctx.aplicarPresupuestoSembrar();
    ok(!r.ok, 'aplicar FALLA en vez de declarar exito sobre una escritura que no verifica');
    ok(/no verifica/i.test(r.error || ''), 'el error dice que la verificacion fallo: ' + r.error);
    ok(!('K9' in hoja.celdas), 'K9 (la tragona, estaba vacia antes) nunca quedo con el valor, y sigue vacia');
    ok(hoja.celdas['O9'] === undefined, 'O9 (SI se habia escrito bien, estaba vacia antes) se REVIRTIO a vacia -- todo o nada');
    ok(hoja.celdas['O10'].valor === antesO10,
        'O10 (SI se habia escrito bien, PISANDO 280) se REVIRTIO A 280 -- el valor previo exacto, no a vacio. Dio ' +
        hoja.celdas['O10'].valor);
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

seccion('9. Confirmacion SOLO cuando hay algo que pisar: si todo esta vacio, aplicar corre derecho');
{
    // Escenario a mano SIN ninguna celda K/O/S con contenido previo (a diferencia de hojaBase()).
    const celdas = {};
    const set = (a1, valor) => { celdas[a1] = { valor: valor, formula: '' }; };
    set(ctx.PM_MODO.rotulo.celda, ctx.PM_MODO.rotulo.esperado);
    set(ctx.PM_MODO.celda, ctx.PM_MODO.proyeccion);
    set(ctx.PM_SELECTORES.rotuloPeriodo.celda, ctx.PM_SELECTORES.rotuloPeriodo.esperado);
    set(ctx.PM_SELECTORES.mes, 'Septiembre'); set(ctx.PM_SELECTORES.anio, 2026);
    ctx.PM_CLAVES_BLOQUE.forEach((k) => {
        const bPm = ctx.PM_BLOQUES[k], bPc = ctx._bloquesPc()[k];
        set(bPm.tituloBloque.celda, bPm.tituloBloque.esperado);
        set(bPm.rotuloCuenta.celda, bPm.rotuloCuenta.esperado);
        set(bPc.colProyectar + '7', ctx.PC_TITULO_PROYECTAR);
    });
    set('I9', 'Sueldo'); set('J9', 1000);   // K9 vacia
    set('M9', 'Alquiler'); set('N9', 500);  // O9 vacia
    set('Q9', 'Nafta'); set('R9', 80);      // S9 vacia
    const hoja = crearHojaPs(celdas);
    ssActual = ssCon(hoja);

    alertas = []; botonesUsados = [];
    const r = ctx.aplicarPresupuestoSembrar();
    ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));
    ok(hoja.celdas['K9'].valor === 1000 && hoja.celdas['O9'].valor === 500 && hoja.celdas['S9'].valor === 80,
        'las tres celdas (todas vacias) se sembraron igual');
    ok(!botonesUsados.includes('YN'),
        'NINGUN dialogo de confirmacion (YES_NO) se disparo -- no habia nada que pisar. Botones usados: ' +
        JSON.stringify(botonesUsados));
    ok(botonesUsados.filter((b) => b === 'OK').length >= 1,
        'si se mostro el aviso final de "aplicado" (OK), eso no es una confirmacion, es solo un reporte');
}

seccion('10. LA REGRESION QUE REPORTO FRANCO: sembrar el mes A, cambiar el selector al mes B (montos ' +
    'de origen distintos) y sembrar de nuevo -- K/O/S tienen que quedar con B, no con A');
{
    // --- Mes A: selector "Septiembre 2026" (default de hojaBase), fuente J9/N9/R9 = 1000/500/80 ---
    // Fila 11 de Variables (Q11/R11/S11) queda SIN CUENTA en A (no existe todavia en el Plan) --
    // pero S11 YA tiene un monto tipeado a mano de mucho antes (777): un dato REALMENTE viejo,
    // anterior a cualquier corrida de este modulo, que A ni siquiera mira (se saltea por falta de
    // cuenta, no llega a "pisa"). Sirve para el chequeo de revertir mas abajo: una celda que
    // NINGUNA de las dos corridas (A ni B) toco hasta que B la pisa por primera vez.
    const hojaA = hojaBase({ mesSel: 'Septiembre', anioSel: 2026 });
    hojaA.celdas['S11'] = { valor: 777, formula: '' };   // manual viejo, fila todavia sin cuenta
    ssActual = ssCon(hojaA);
    const rA = ctx.aplicarPresupuestoSembrar();
    ok(rA.ok, 'sembrar el mes A corre sin error: ' + (rA.error || ''));
    ok(hojaA.celdas['K9'].valor === 1000 && hojaA.celdas['O9'].valor === 500 && hojaA.celdas['S9'].valor === 80,
        'tras sembrar A: K9/O9/S9 = 1000/500/80 (lo que J9/N9/R9 mostraban en A)');
    ok(hojaA.celdas['K10'].valor === 200 && hojaA.celdas['O10'].valor === 300 && hojaA.celdas['S10'].valor === 40,
        'A TAMBIEN pisa la fila 10 (tenia 150/280/0): sembrar toca TODAS las filas validas, no solo ' +
        'las que van a cambiar en B -- por eso "valorPrevio" de la proxima corrida (B) para esta fila ' +
        'va a ser lo que A dejo, no el 150/280/0 original');
    ok(hojaA.celdas['S11'].valor === 777, 'S11 (sin cuenta en A) NO fue tocada -- se saltea, sigue en 777');

    // --- Cambio de selector a mes B: DEVTOOL_PresupuestoModo.js ya recalculo J/N/R para el nuevo
    // periodo (montos DISTINTOS de A). K/O/S siguen exactamente como quedaron sembradas de A --
    // son las MISMAS celdas, ese es el sintoma que reporto Franco: "ya hay datos". Ademas, la
    // cuenta de la fila 11 recien se da de alta para B (Q11 aparece con nombre y R11 con fuente
    // valida): esa fila SI entra al plan de B, y S11 pasa a "pisa" por primera vez.
    const celdasB = JSON.parse(JSON.stringify(hojaA.celdas));
    celdasB[ctx.PM_SELECTORES.mes] = { valor: 'Diciembre', formula: '' };   // selector cambiado a mes B
    celdasB['J9'] = { valor: 4000, formula: '' };  // Ingresos, mes B
    celdasB['N9'] = { valor: 1300, formula: '' };  // Fijos, mes B
    celdasB['R9'] = { valor: 220, formula: '' };   // Variables, mes B
    celdasB['Q11'] = { valor: 'CuentaNuevaEnB', formula: '' };
    celdasB['R11'] = { valor: 999, formula: '' };
    const hojaB = crearHojaPs(celdasB);
    ssActual = ssCon(hojaB);

    const estadoB = ctx.estadoPresupuestoSembrar();
    ok(estadoB.ok, 'estado en el mes B corre sin error');
    ok(/SE PISAN/.test(estadoB.detalle), 'el estado avisa que hay celdas que SE PISAN antes de aplicar');
    ok(/Diciembre/.test(estadoB.detalle), 'el estado nombra el periodo de B (Diciembre), no el de A');

    const rB = ctx.aplicarPresupuestoSembrar();
    ok(rB.ok, 'sembrar el mes B corre sin error (con confirmacion, que el mock siempre acepta): ' + (rB.error || ''));

    ok(hojaB.celdas['K9'].valor === 4000, 'K9 QUEDA EN 4000 (el valor de B), no en 1000 (el de A). Dio ' + hojaB.celdas['K9'].valor);
    ok(hojaB.celdas['O9'].valor === 1300, 'O9 queda en 1300 (B), no en 500 (A). Dio ' + hojaB.celdas['O9'].valor);
    ok(hojaB.celdas['S9'].valor === 220, 'S9 queda en 220 (B), no en 80 (A). Dio ' + hojaB.celdas['S9'].valor);
    ok(hojaB.celdas['S11'].valor === 999, 'S11 (recien con cuenta en B) se pisa por primera vez, con 999 (R11)');

    // El respaldo de "revertir" es el de la corrida B (la ultima, un solo nivel de undo). Tiene
    // que reponer el estado EXACTO previo a B: para la fila 9, lo que A habia sembrado
    // (1000/500/80); para la fila 10, lo que A YA habia sembrado ahi (200/300/40, no el 150/280/0
    // original -- A tambien la piso, ver arriba); para la fila 11 (el caso limpio, nunca tocado
    // hasta B), el 777 verdaderamente viejo, anterior a las dos corridas.
    const rRevB = ctx.revertirPresupuestoSembrar();
    ok(rRevB.ok, 'revertir despues de B corre sin error: ' + (rRevB.error || ''));
    ok(hojaB.celdas['K9'].valor === 1000, 'revertir repone K9 al valor previo A LA CORRIDA B (1000, lo que A habia sembrado)');
    ok(hojaB.celdas['O9'].valor === 500, 'revertir repone O9 a 500');
    ok(hojaB.celdas['S9'].valor === 80, 'revertir repone S9 a 80');
    ok(hojaB.celdas['K10'].valor === 200, 'revertir repone K10 a 200 (lo que A YA habia sembrado -- un solo nivel de undo, no vuelve al 150 original)');
    ok(hojaB.celdas['O10'].valor === 300, 'revertir repone O10 a 300 (idem, lo que A sembro)');
    ok(hojaB.celdas['S10'].valor === 40, 'revertir repone S10 a 40 (idem, lo que A sembro)');
    ok(hojaB.celdas['S11'].valor === 777, 'revertir repone S11 a 777 -- el manual REALMENTE viejo, protegido porque ' +
        'ninguna corrida lo habia pisado hasta B');
}

seccion('11. estadoPresupuestoSembrar(): no escribe una sola celda, y separa vacias de "SE PISAN"');
{
    const hoja = hojaBase();
    ssActual = ssCon(hoja);
    const antes = snapshot(hoja);
    const r = ctx.estadoPresupuestoSembrar();
    ok(r.ok, 'estado corre sin error');
    ok(snapshot(hoja) === antes, 'la hoja quedo IDENTICA despues de "1. Ver estado"');
    ok(r.detalle.indexOf('K9') === -1 && /CELDAS A SEMBRAR/.test(r.detalle),
        'el reporte describe el total a sembrar (no lista celda por celda en el resumen)');
    ok(/3 vacia\(s\) se llenan, 3 SE PISAN/.test(r.detalle),
        'el reporte separa EXACTO: 3 vacias se llenan, 3 se pisan. Dio: ' +
        (r.detalle.match(/CELDAS A SEMBRAR.*/)||[''])[0]);
}

// ============================================
console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (11 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
