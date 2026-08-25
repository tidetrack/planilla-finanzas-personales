/**
 * devtools/probar_presupuesto_guardar.js
 * Banco de pruebas de DEVTOOL_PresupuestoGuardar.js.
 *
 * Seis partes:
 * 0. Integridad de los fuentes (sin bytes de control).
 * 1. Periodo/clave/mismo-mes: los helpers de fecha, verificados contra el mismo criterio de
 *    rango-de-mes que ya usan _formulaPresupuestoIp y _bloqueComunTfp (los dos consumidores
 *    reales de "Proyeccion").
 * 2. Cotizaciones congeladas: feliz + Regla Estricta 9 (una API que falla NUNCA se silencia).
 * 3. Lectura de K/O/S: cuentas normales, "sin decidir" (monto vacio) y la anomalia "monto sin
 *    cuenta" (aborta, no se pisa un dato que no se entiende).
 * 4. El preflight, con mutaciones dirigidas -- mismo patron que probar_presupuesto_resumen.js.
 * 5. El plan: el invariante ANTES de escribir (W8 vs K8-O8-S8) y el armado de la matriz nueva
 *    (cotizaciones congeladas como VALOR, marcado por periodo, fecha=primer dia del mes).
 * 6. DE PUNTA A PUNTA con un mock completo de "Registros"/"Proyeccion": aplicar, aplicar DE
 *    NUEVO el mismo periodo (la mutacion que mas importa: no puede duplicar), revertir, y un
 *    fallo de la API de cotizaciones a mitad de camino (no debe dejar nada escrito).
 *
 * USO:  node devtools/probar_presupuesto_guardar.js
 * @version 0.50.0
 * @since 2026-08-25
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// ============================================================================
// CONTEXTO: se cargan Config y los modulos de verdad, sin reimplementar nada
// ============================================================================
let ssActual = null, uiActual = null, propsActual = null;
let tidetrackUsd = () => 1000, tidetrackAud = () => 700, tidetrackEur = () => 1100;

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, parseInt,
    SpreadsheetApp: {
        getActiveSpreadsheet: () => ssActual,
        getUi: () => { if (!uiActual) throw new Error('sin UI en este escenario'); return uiActual; },
        flush() {},
    },
    PropertiesService: { getDocumentProperties: () => propsActual },
    Utilities: { formatDate: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}` },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {},
    TIDETRACK_USD: () => tidetrackUsd(), TIDETRACK_AUD: () => tidetrackAud(), TIDETRACK_EUR: () => tidetrackEur(),
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoBase.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoGuardar.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,MONEDAS_DISPONIBLES,columnLetterToIndex,' +
    'invalidarCacheNombresHojas,PM_TITULO,PM_SELECTORES,PM_BLOQUES,PM_CLAVES_BLOQUE,PM_FILA_INI,' +
    'PM_FILA_FIN,PM_UMBRAL_IDENTIDAD,_bloquesPc,PC_TITULO_PROYECTAR,PC_COL_PROYECTAR_AGRUPADO,' +
    'PB_MARCA,IP_MESES,PG_MARCA,' +
    '_periodoDesdeSelectoresPg,_claveMesPg,_mismoMesPg,_leerCotizacionesVivasPg,' +
    '_preflightPresupuestoPg,_preflightProyeccionPg,_leerFilasPresupuestoPg,_sumarPorBloquePg,' +
    '_filasPorNotaPrefijoPg,_filasBasePorMesPg,_planGuardarPg,_matrizNuevaPg,' +
    'estadoGuardarProyeccion,aplicarGuardarProyeccion,revertirGuardarProyeccion});',
    ctx);

// El sello de cada corrida (_selloPg) sale de `new Date()`: se fija el reloj para que la seccion
// 6 pueda avanzarlo a proposito entre dos "aplicar" consecutivos y garantizar sellos DISTINTOS
// sin depender de que el reloj de pared real tarde un segundo entre dos llamadas de JS (misma
// tecnica que probar_presupuesto_base.js usa para fijar HOY).
const DateReal = Date;
let horaMock = null;
ctx.Date = function (...a) { return a.length ? new DateReal(...a) : new DateReal(horaMock || DateReal.now()); };
ctx.Date.prototype = DateReal.prototype;
Object.setPrototypeOf(ctx.Date, DateReal);

// ============================================================================
// 0. INTEGRIDAD DE LOS FUENTES (sin bytes de control) -- mismo chequeo que los bancos hermanos
// ============================================================================
console.log('=== 0. Integridad de los fuentes (sin bytes de control) ===');
{
    const sospechosos = [];
    ['src', 'devtools'].forEach(d => fs.readdirSync(path.join(RAIZ, d)).forEach(f => {
        const full = path.join(RAIZ, d, f);
        if (fs.statSync(full).isDirectory()) return;
        const b = fs.readFileSync(full);
        for (let i = 0; i < b.length; i++) {
            const c = b[i];
            if (c === 9 || c === 10 || c === 13) continue;   // tab, LF, CR
            if (c < 32 || c === 127) { sospechosos.push(f + ' (byte 0x' + c.toString(16) + ' en offset ' + i + ')'); break; }
        }
    }));
    ok(sospechosos.length === 0, 'sin bytes de control fuera de tab/LF/CR' + (sospechosos.length ? ': ' + sospechosos.join(', ') : ''));
}

// ============================================================================
// 1. PERIODO / CLAVE / MISMO-MES
// ============================================================================
console.log('\n=== 1. Periodo, clave de marcado y mismo-mes ===');
{
    const p = ctx._periodoDesdeSelectoresPg('Septiembre', 2026);
    ok(p.getFullYear() === 2026 && p.getMonth() === 8 && p.getDate() === 1,
       'periodo de "Septiembre"/2026 es el 1/9/2026 (primer dia del mes, ver decision 2), dio ' + p);
    ok(ctx._claveMesPg(p) === '2026-09', 'clave de marcado "2026-09", dio ' + ctx._claveMesPg(p));

    const enero = ctx._periodoDesdeSelectoresPg('Enero', 2026);
    ok(ctx._claveMesPg(enero) === '2026-01', 'ENERO no pierde el cero a la izquierda del mes: dio ' + ctx._claveMesPg(enero));

    ok(ctx._periodoDesdeSelectoresPg('Mes Invalido', 2026) === null, 'mes invalido -> null, no una fecha inventada');
    ok(ctx._periodoDesdeSelectoresPg('Septiembre', NaN) === null, 'anio no finito -> null');

    // _mismoMesPg tiene que coincidir EXACTO con el rango [desde,hasta] que usan
    // _formulaPresupuestoIp y _bloqueComunTfp: cualquier dia del mes adentro, ningun dia afuera.
    ok(ctx._mismoMesPg(new Date(2026, 8, 1), p) === true, 'el primer dia del mes cae en el mismo mes');
    ok(ctx._mismoMesPg(new Date(2026, 8, 30), p) === true, 'el ultimo dia del mes cae en el mismo mes');
    ok(ctx._mismoMesPg(new Date(2026, 7, 31), p) === false, 'el dia anterior (31/8) NO cae en septiembre');
    ok(ctx._mismoMesPg(new Date(2026, 9, 1), p) === false, 'el primer dia del mes siguiente NO cae en septiembre');
    ok(ctx._mismoMesPg('no es una fecha', p) === false, 'un valor que no es Date nunca matchea (no revienta)');
}

// ============================================================================
// 2. COTIZACIONES CONGELADAS -- Regla Estricta 9
// ============================================================================
console.log('\n=== 2. Cotizaciones congeladas (decision 1) ===');
{
    tidetrackUsd = () => 1234.5; tidetrackAud = () => 800; tidetrackEur = () => 1300;
    const c = ctx._leerCotizacionesVivasPg();
    ok(c.ARS === 1 && c.USD === 1234.5 && c.AUD === 800 && c.EUR === 1300,
       'lee las cuatro tasas EN VIVO (ARS=1 fijo), dio ' + JSON.stringify(c));

    // MUTACION: la API de USD falla -- Regla Estricta 9, nunca se silencia ni se inventa un TC.
    tidetrackUsd = () => { throw new Error('HTTP 500'); };
    let lanzo = false, msg = '';
    try { ctx._leerCotizacionesVivasPg(); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('HTTP 500') !== -1, 'si TIDETRACK_USD() lanza, la excepcion SUBE sin capturar (Regla Estricta 9), dio: ' + msg);
    tidetrackUsd = () => 1000;

    // MUTACION: una tasa no numerica (NaN/0/negativa) tampoco se congela en silencio.
    tidetrackAud = () => NaN;
    lanzo = false;
    try { ctx._leerCotizacionesVivasPg(); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('AUD') !== -1, 'una tasa NaN (AUD) aborta con un mensaje que la nombra, dio: ' + msg);
    tidetrackAud = () => 700;
}

// ============================================================================
// Helper: hoja "Presupuesto" mock. Reusado en las secciones 3, 4 y 5.
// ============================================================================
function hojaPresupuestoMock(bloques, overridesTotales) {
    // bloques: { ingresos: [{cuenta, proyectar}], fijos: [...], variables: [...] } -- una entrada
    // por fila 9..38 de cada bloque (I/M/Q + K/O/S). `proyectar: null` deja K/O/S vacio ("sin
    // decidir"); `cuenta: ''` con `proyectar` numerico simula la anomalia "monto sin cuenta".
    const celdas = {};
    const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };
    const setColumna = (col, filaIni, valores) => valores.forEach((v, i) => set(col + (filaIni + i), v));

    set(ctx.PM_TITULO.celda, ctx.PM_TITULO.esperado);
    set(ctx.PM_SELECTORES.rotuloPeriodo.celda, ctx.PM_SELECTORES.rotuloPeriodo.esperado);
    set(ctx.PM_SELECTORES.mes, 'Septiembre');
    set(ctx.PM_SELECTORES.anio, 2026);
    set(ctx.PM_SELECTORES.rotuloMoneda.celda, ctx.PM_SELECTORES.rotuloMoneda.esperado);
    set(ctx.PM_SELECTORES.moneda, 'ARS');

    const nFilas = ctx.PM_FILA_FIN - ctx.PM_FILA_INI + 1;
    ['ingresos', 'fijos', 'variables'].forEach(k => {
        const b = ctx.PM_BLOQUES[k];
        set(b.tituloBloque.celda, b.tituloBloque.esperado);
        set(b.rotuloCuenta.celda, b.rotuloCuenta.esperado);
        set(ctx._bloquesPc()[k].colProyectar + '7', ctx.PC_TITULO_PROYECTAR);

        const entradas = (bloques && bloques[k]) || [];
        const cuentas = new Array(nFilas).fill('');
        const montos = new Array(nFilas).fill('');
        entradas.forEach((e, i) => {
            cuentas[i] = e.cuenta === undefined ? ('Cuenta' + k + i) : e.cuenta;
            montos[i] = (e.proyectar === undefined || e.proyectar === null) ? '' : e.proyectar;
        });
        setColumna(b.colCuenta, ctx.PM_FILA_INI, cuentas);
        setColumna(ctx._bloquesPc()[k].colProyectar, ctx.PM_FILA_INI, montos);
    });
    set(ctx.PC_COL_PROYECTAR_AGRUPADO + '7', ctx.PC_TITULO_PROYECTAR);

    // Totales K8/O8/S8/W8: por defecto, la suma REAL de lo cargado (para que el invariante
    // cierre solo en el caso feliz). `overridesTotales` permite romperlo a proposito.
    const sumar = (k) => ((bloques && bloques[k]) || []).reduce((a, e) => a + (typeof e.proyectar === 'number' ? e.proyectar : 0), 0);
    const totales = Object.assign({
        ingresos: sumar('ingresos'), fijos: sumar('fijos'), variables: sumar('variables')
    }, overridesTotales || {});
    set('K8', totales.ingresos, '=SUM(K9:K38)');
    set('O8', totales.fijos, '=SUM(O9:O38)');
    set('S8', totales.variables, '=SUM(S9:S38)');
    set(ctx.PC_COL_PROYECTAR_AGRUPADO + '8',
        (overridesTotales && 'w8' in overridesTotales) ? overridesTotales.w8 : (totales.ingresos - totales.fijos - totales.variables),
        '=SUM(W9:W38)');

    return {
        celdas,
        getRange(a1) {
            if (a1.indexOf(':') !== -1) {
                const partes = a1.split(':');
                const col = partes[0].match(/[A-Z]+/)[0];
                const filaIni = parseInt(partes[0].match(/[0-9]+/)[0], 10);
                const filaFin = parseInt(partes[1].match(/[0-9]+/)[0], 10);
                const out = [];
                for (let f = filaIni; f <= filaFin; f++) out.push([(celdas[col + f] || { valor: '' }).valor]);
                return { getValues: () => out };
            }
            return {
                getValue: () => (celdas[a1] || { valor: '' }).valor,
                getFormula: () => (celdas[a1] || { formula: '' }).formula,
                getDisplayValue: () => String((celdas[a1] || { valor: '' }).valor),
                isPartOfMerge: () => false,
            };
        }
    };
}

// ============================================================================
// 3. LECTURA DE K/O/S
// ============================================================================
console.log('\n=== 3. Lectura de K/O/S (_leerFilasPresupuestoPg + _sumarPorBloquePg) ===');
{
    const hoja = hojaPresupuestoMock({
        ingresos: [{ cuenta: 'Sueldo', proyectar: 500000 }, { cuenta: 'Freelance', proyectar: null }],
        fijos: [{ cuenta: 'Alquiler', proyectar: 200000 }],
        variables: [{ cuenta: 'Comidas', proyectar: 80000 }, { cuenta: 'Nafta', proyectar: 0 }]
    });
    const lect = ctx._leerFilasPresupuestoPg(hoja);
    ok(lect.filas.length === 4, '4 filas con cuenta Y monto (Freelance sin decidir queda afuera), dio ' + lect.filas.length);
    ok(lect.sinDecidir === 1, 'Freelance (sin decidir) se cuenta aparte, no como error, dio ' + lect.sinDecidir);
    ok(lect.montoSinCuenta.length === 0, 'sin anomalias en este escenario sano');

    const nafta = lect.filas.find(f => f.cuenta === 'Nafta');
    ok(nafta && nafta.monto === 0, 'un 0 explicito SI se guarda (decision deliberada, distinta de "vacio")');
    const sueldo = lect.filas.find(f => f.cuenta === 'Sueldo');
    ok(sueldo.tipo === 'Ingreso' && sueldo.categoria === 'Ingreso', 'Sueldo: tipo=Ingreso, categoria=Ingreso');
    const alquiler = lect.filas.find(f => f.cuenta === 'Alquiler');
    ok(alquiler.tipo === 'Egreso' && alquiler.categoria === 'Gasto Fijo', 'Alquiler: tipo=Egreso, categoria=Gasto Fijo (Ingreso resta, ver PM_BLOQUES.tipoQueResta)');

    const s = ctx._sumarPorBloquePg(lect.filas);
    ok(s.ingresos === 500000 && s.fijos === 200000 && s.variables === 80000,
       'suma por bloque exacta, dio ' + JSON.stringify(s));

    // MUTACION: K con monto pero I vacio -- la anomalia real que el preflight/plan tienen que atrapar.
    const hojaAnomalia = hojaPresupuestoMock({
        ingresos: [{ cuenta: '', proyectar: 999 }]
    });
    const lect2 = ctx._leerFilasPresupuestoPg(hojaAnomalia);
    ok(lect2.filas.length === 0 && lect2.montoSinCuenta.length === 1 && lect2.montoSinCuenta[0].celda === 'K9',
       'monto sin cuenta se detecta en K9 (no se cuela como fila), dio ' + JSON.stringify(lect2.montoSinCuenta));
}

// ============================================================================
// 4. EL PREFLIGHT, con mutaciones dirigidas
// ============================================================================
console.log('\n=== 4. El preflight (_preflightPresupuestoPg) ===');
{
    const ssMinimo = () => ({ getSheetByName: () => hojaPresupuestoMock({ ingresos: [{ cuenta: 'X', proyectar: 100 }] }) });

    // CASO SANO
    {
        const pre = ctx._preflightPresupuestoPg(ssMinimo());
        ok(!!pre.hoja, 'caso sano: no lanza, devuelve la hoja');
    }

    // MUTACION (la clase de bug real que freno v0.46.0): K7 dice otra cosa.
    {
        const hoja = hojaPresupuestoMock({ ingresos: [{ cuenta: 'X', proyectar: 100 }] });
        hoja.celdas['K7'] = { valor: 'Monto Proyectado', formula: '' };   // "parecido" pero no exacto
        let lanzo = false, msg = '';
        try { ctx._preflightPresupuestoPg({ getSheetByName: () => hoja }); } catch (e) { lanzo = true; msg = e.message; }
        ok(lanzo && msg.indexOf('K7') !== -1, 'K7 con un rotulo "parecido" pero no exacto frena el preflight, dio: ' + msg);
    }

    // MUTACION: J2 con un mes que no existe en espanol.
    {
        const hoja = hojaPresupuestoMock({});
        hoja.celdas[ctx.PM_SELECTORES.mes] = { valor: 'September', formula: '' };
        let lanzo = false;
        try { ctx._preflightPresupuestoPg({ getSheetByName: () => hoja }); } catch (e) { lanzo = true; }
        ok(lanzo, 'un mes en ingles ("September") frena el preflight');
    }

    // MUTACION: una celda de la banda de datos en error.
    {
        const hoja = hojaPresupuestoMock({ ingresos: [{ cuenta: 'X', proyectar: 100 }] });
        hoja.celdas['I10'] = { valor: '#REF!', formula: '' };
        let lanzo = false, msg = '';
        try { ctx._preflightPresupuestoPg({ getSheetByName: () => hoja }); } catch (e) { lanzo = true; msg = e.message; }
        ok(lanzo && msg.indexOf('I10') !== -1 && msg.indexOf('#REF!') !== -1,
           'una celda #REF! en la banda de datos frena el preflight (nombra la celda), dio: ' + msg);
    }

    // MUTACION: K8 sin formula (dato pegado a mano, ya no es un SUM real).
    {
        const hoja = hojaPresupuestoMock({ ingresos: [{ cuenta: 'X', proyectar: 100 }] });
        hoja.celdas['K8'] = { valor: 100, formula: '' };
        let lanzo = false, msg = '';
        try { ctx._preflightPresupuestoPg({ getSheetByName: () => hoja }); } catch (e) { lanzo = true; msg = e.message; }
        ok(lanzo && msg.indexOf('K8') !== -1, 'K8 sin formula frena el preflight (el invariante no tiene contra que medir), dio: ' + msg);
    }
}

// ============================================================================
// 5. EL PLAN: el invariante ANTES de escribir, y la matriz nueva
// ============================================================================
console.log('\n=== 5. El plan (_planGuardarPg) y la matriz (_matrizNuevaPg) ===');
{
    const bloques = {
        ingresos: [{ cuenta: 'Sueldo', proyectar: 500000 }],
        fijos: [{ cuenta: 'Alquiler', proyectar: 200000 }],
        variables: [{ cuenta: 'Comidas', proyectar: 80000 }]
    };

    // CASO SANO
    {
        const hoja = hojaPresupuestoMock(bloques);
        const ssMock = { getSheetByName: (n) => (n === 'Proyeccion' ? { getLastRow: () => 6 } : hoja) };
        const plan = ctx._planGuardarPg(ssMock, { hoja: hoja });
        ok(plan.clave === '2026-09' && plan.moneda === 'ARS', 'plan.clave/moneda correctos, dio ' + plan.clave + '/' + plan.moneda);
        ok(plan.lectura.filas.length === 3, '3 filas en el plan (una por bloque)');
        ok(Math.abs(plan.w8 - (500000 - 200000 - 80000)) < 0.001, 'W8 leido correctamente');
    }

    // MUTACION: W8 NO cierra contra K8-O8-S8 -- el cimiento de la etapa 2 esta roto. Tiene que
    // abortar ANTES de devolver ningun plan (no generar filas sobre datos que no cierran).
    {
        const hoja = hojaPresupuestoMock(bloques, { w8: 999999 });
        const ssMock = { getSheetByName: (n) => (n === 'Proyeccion' ? { getLastRow: () => 6 } : hoja) };
        let lanzo = false, msg = '';
        try { ctx._planGuardarPg(ssMock, { hoja: hoja }); } catch (e) { lanzo = true; msg = e.message; }
        ok(lanzo && msg.indexOf('W8') !== -1 && msg.indexOf('no cierra') !== -1,
           'W8 desalineado de K8-O8-S8 aborta el plan ANTES de escribir nada, dio: ' + msg);
    }

    // MUTACION: monto sin cuenta -- el plan tiene que abortar (no _leerFilasPresupuestoPg solo,
    // que ya lo reporta como dato: es _planGuardarPg el que decide frenar la corrida por esto).
    {
        const hoja = hojaPresupuestoMock({ ingresos: [{ cuenta: '', proyectar: 999 }] });
        const ssMock = { getSheetByName: (n) => (n === 'Proyeccion' ? { getLastRow: () => 6 } : hoja) };
        let lanzo = false, msg = '';
        try { ctx._planGuardarPg(ssMock, { hoja: hoja }); } catch (e) { lanzo = true; msg = e.message; }
        ok(lanzo && msg.indexOf('sin cuenta') !== -1, 'monto sin cuenta aborta el plan, dio: ' + msg);
    }

    // LA MATRIZ: cotizaciones congeladas como VALOR, marcado por periodo, medio vacio, fecha=periodo.
    {
        const hoja = hojaPresupuestoMock(bloques);
        const ssMock = { getSheetByName: (n) => (n === 'Proyeccion' ? { getLastRow: () => 6 } : hoja) };
        const plan = ctx._planGuardarPg(ssMock, { hoja: hoja });
        const cotizaciones = { ARS: 1, USD: 1234.5, AUD: 800, EUR: 1300 };
        const matriz = ctx._matrizNuevaPg(plan, cotizaciones, '2026-08-25_1200');
        ok(matriz.length === 3, 'la matriz tiene 3 filas');

        const cfg = ctx.RANGES.REGISTROS;
        const colIni = ctx.columnLetterToIndex(cfg.start);
        const pos = {};
        Object.keys(cfg.columns).forEach(k => pos[k] = ctx.columnLetterToIndex(cfg.columns[k]) - colIni);
        const filaSueldo = matriz.find(f => f[pos.cuenta] === 'Sueldo');
        ok(filaSueldo[pos.monto] === 500000, 'monto de Sueldo = 500000');
        ok(filaSueldo[pos.tipo] === 'Ingreso', 'tipo de Sueldo = Ingreso');
        ok(filaSueldo[pos.tipo_cuenta] === 'Ingreso', 'tipo_cuenta de Sueldo = Ingreso');
        ok(filaSueldo[pos.medio] === '', 'medio vacio (Presupuesto no lo captura, ver cabecera)');
        ok(filaSueldo[pos.moneda] === 'ARS', 'moneda = J4 (ARS en este escenario)');
        ok(filaSueldo[pos.fecha].getTime() === plan.periodo.getTime(), 'fecha = primer dia del periodo, no otra');
        ok(filaSueldo[pos.nota] === 'Presupuesto guardado 2026-09 2026-08-25_1200',
           'Nota = "<PG_MARCA> <clave> <sello>", dio "' + filaSueldo[pos.nota] + '"');
        ok(filaSueldo[pos.tc_ars] === 1 && filaSueldo[pos.tc_usd] === 1234.5 &&
           filaSueldo[pos.tc_aud] === 800 && filaSueldo[pos.tc_eur] === 1300,
           'las CUATRO cotizaciones quedan como VALOR NUMERICO (nunca formula) en cada fila');

        const filaAlquiler = matriz.find(f => f[pos.cuenta] === 'Alquiler');
        ok(filaAlquiler[pos.tipo] === 'Egreso' && filaAlquiler[pos.tipo_cuenta] === 'Gasto Fijo',
           'Alquiler: tipo=Egreso, tipo_cuenta=Gasto Fijo');
    }
}

// ============================================================================
// Helpers de grilla real (Registros/Proyeccion) para la seccion 6
// ============================================================================
function filaProy(datos) {
    const cfg = ctx.RANGES.REGISTROS;
    const colIni = ctx.columnLetterToIndex(cfg.start);
    const ancho = ctx.columnLetterToIndex(cfg.end) - colIni + 1;
    const pos = {};
    Object.keys(cfg.columns).forEach(k => pos[k] = ctx.columnLetterToIndex(cfg.columns[k]) - colIni);
    const f = new Array(ancho).fill('');
    Object.keys(datos).forEach(k => { f[pos[k]] = datos[k]; });
    return f;
}

function hojaGridMock(nombre, filasDatos) {
    const cfg = ctx.RANGES.REGISTROS;
    const dataRow = cfg.dataRow, headerRow = cfg.headerRow;
    const colIni = ctx.columnLetterToIndex(cfg.start);
    const ancho = ctx.columnLetterToIndex(cfg.end) - colIni + 1;
    let grid = [];
    for (let r = 1; r < dataRow; r++) grid.push(new Array(ancho).fill(''));
    Object.keys(cfg.columns).forEach(k => { grid[headerRow - 1][ctx.columnLetterToIndex(cfg.columns[k]) - colIni] = k; });
    (filasDatos || []).forEach(f => grid.push(f.slice()));
    let maxRows = 5000;
    function fila1based(n) { while (grid.length < n) grid.push(new Array(ancho).fill('')); return grid[n - 1]; }
    return {
        getName: () => nombre,
        getLastRow: () => grid.length,
        getMaxRows: () => maxRows,
        insertRowsAfter(after, n) { maxRows += n; },
        getRange(row, col, nRows, nCols) {
            if (nRows === undefined) {
                const f = fila1based(row);
                const v = f[col - colIni];
                return { getValue: () => (v === undefined ? '' : v) };
            }
            return {
                getValues: () => { const out = []; for (let i = 0; i < nRows; i++) out.push(fila1based(row + i).slice(col - colIni, col - colIni + nCols)); return out; },
                setValues: (vals) => { for (let i = 0; i < nRows; i++) { const f = fila1based(row + i); for (let j = 0; j < nCols; j++) f[col - colIni + j] = vals[i][j]; } }
            };
        },
        deleteRows(startRow, numRows) { grid.splice(startRow - 1, numRows); },
        _grid: () => grid,
    };
}

function hojaGenericaMock() {
    let grid = [];
    return {
        getLastRow: () => grid.length,
        hideSheet() {},
        getRange(row, col, nRows, nCols) {
            if (nRows === undefined) { const f = grid[row - 1] || []; return { getValue: () => (f[col - 1] === undefined ? '' : f[col - 1]) }; }
            return {
                getValues: () => { const out = []; for (let i = 0; i < nRows; i++) { const f = grid[row - 1 + i] || []; out.push(f.slice(col - 1, col - 1 + nCols)); } return out; },
                setValues: (vals) => { for (let i = 0; i < nRows; i++) { while (grid.length <= row - 1 + i) grid.push([]); const f = grid[row - 1 + i]; for (let j = 0; j < nCols; j++) f[col - 1 + j] = vals[i][j]; } }
            };
        }
    };
}

function crearSsMock(registrosFilas, proyeccionFilas) {
    const hojas = { 'Registros': hojaGridMock('Registros', registrosFilas), 'Proyeccion': hojaGridMock('Proyeccion', proyeccionFilas) };
    return {
        getSheetByName: (n) => hojas[n] || null,
        getSheets: () => Object.keys(hojas).map(n => ({ getName: () => n })),
        insertSheet: (n) => { hojas[n] = hojaGenericaMock(); return hojas[n]; },
        toast() {},
        _hojas: hojas,
    };
}

function uiMockSiempreSi() {
    return { alert: () => 'YES', Button: { YES: 'YES', NO: 'NO' }, ButtonSet: { YES_NO: 'YES_NO', OK: 'OK' } };
}

function propsMock() {
    const store = {};
    return { setProperty: (k, v) => { store[k] = v; }, getProperty: (k) => (k in store ? store[k] : null), deleteProperty: (k) => { delete store[k]; }, _store: store };
}

function contarFilasConMarca(ssMock, marca) {
    const hoja = ssMock._hojas['Proyeccion'];
    const cfg = ctx.RANGES.REGISTROS;
    const colNota = ctx.columnLetterToIndex(cfg.columns.nota);
    let n = 0;
    for (let f = cfg.dataRow; f <= hoja.getLastRow(); f++) {
        const v = String(hoja.getRange(f, colNota).getValue() || '');
        if (v.indexOf(marca) === 0) n++;
    }
    return n;
}

// ============================================================================
// 6. DE PUNTA A PUNTA (aplicarGuardarProyeccion / revertirGuardarProyeccion, reales)
// ============================================================================
console.log('\n=== 6. De punta a punta: aplicar, aplicar DE NUEVO (no duplica), revertir ===');
{
    tidetrackUsd = () => 1000; tidetrackAud = () => 700; tidetrackEur = () => 1100;

    const bloques = {
        ingresos: [{ cuenta: 'Sueldo', proyectar: 500000 }],
        fijos: [{ cuenta: 'Alquiler', proyectar: 200000 }],
        variables: [{ cuenta: 'Comidas', proyectar: 80000 }]
    };
    const hojaPresu = hojaPresupuestoMock(bloques);

    // "Proyeccion" arranca con: una fila del PRESUPUESTO BASE para SEPTIEMBRE 2026 (el mismo
    // periodo -- tiene que retirarse) y una fila del base para AGOSTO 2026 (otro periodo -- NO
    // se toca). Ver decision 4.
    const filaBaseSep = filaProy({ monto: 450000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' 2026-08-20_2319' });
    const filaBaseAgo = filaProy({ monto: 111111, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' 2026-08-20_2319' });
    const ssMock = crearSsMock([], [filaBaseSep, filaBaseAgo]);

    ssActual = { getSheetByName: (n) => (n === ctx.SHEETS.PRESUPUESTO ? hojaPresu : ssMock.getSheetByName(n)), getSheets: () => ssMock.getSheets().concat([{ getName: () => ctx.SHEETS.PRESUPUESTO }]), insertSheet: (n) => ssMock.insertSheet(n), toast() {} };
    uiActual = uiMockSiempreSi();
    propsActual = propsMock();

    horaMock = new DateReal(2026, 7, 25, 14, 20, 0);
    const r1 = ctx.aplicarGuardarProyeccion();
    ok(r1.ok === true, 'primera corrida: ok=true, detalle: ' + (r1.ok ? '(ver detalle)' : r1.error));

    const propiasN1 = contarFilasConMarca(ssMock, ctx.PG_MARCA);
    ok(propiasN1 === 3, 'se escribieron 3 filas propias (una por bloque), dio ' + propiasN1);

    const proyHoja1 = ssMock._hojas['Proyeccion'];
    ok(proyHoja1.getLastRow() >= ctx.RANGES.REGISTROS.dataRow + 3,
       'Proyeccion crecio con las filas nuevas');

    // El base de SEPTIEMBRE tiene que haberse RETIRADO; el de AGOSTO (otro periodo) SIGUE.
    const cfg = ctx.RANGES.REGISTROS;
    const colFecha = ctx.columnLetterToIndex(cfg.columns.fecha), colNota = ctx.columnLetterToIndex(cfg.columns.nota);
    let quedaBaseSep = false, quedaBaseAgo = false;
    for (let f = cfg.dataRow; f <= proyHoja1.getLastRow(); f++) {
        const nota = String(proyHoja1.getRange(f, colNota).getValue() || '');
        if (nota.indexOf(ctx.PB_MARCA) !== 0) continue;
        const fecha = proyHoja1.getRange(f, colFecha).getValue();
        if (fecha instanceof Date && fecha.getMonth() === 8) quedaBaseSep = true;
        if (fecha instanceof Date && fecha.getMonth() === 7) quedaBaseAgo = true;
    }
    ok(!quedaBaseSep, 'DECISION 4: el base de SEPTIEMBRE (mismo periodo guardado) fue retirado');
    ok(quedaBaseAgo, 'DECISION 4: el base de AGOSTO (otro periodo) NO se toco');

    // Cotizaciones congeladas releidas de la hoja real.
    const colTcUsd = ctx.columnLetterToIndex(cfg.columns.tc_usd);
    let tcUsdEscrito = null;
    for (let f = cfg.dataRow; f <= proyHoja1.getLastRow(); f++) {
        const nota = String(proyHoja1.getRange(f, colNota).getValue() || '');
        if (nota.indexOf(ctx.PG_MARCA) === 0) { tcUsdEscrito = proyHoja1.getRange(f, colTcUsd).getValue(); break; }
    }
    ok(tcUsdEscrito === 1000, 'el TC USD congelado en la fila escrita es el que devolvia TIDETRACK_USD() al momento de aplicar (1000)');

    // -------- LA MUTACION QUE MAS IMPORTA: guardar DOS VECES el mismo periodo no duplica --------
    tidetrackUsd = () => 2000;   // cambia la cotizacion entre las dos corridas: no tiene que importar para la idempotencia
    horaMock = new DateReal(2026, 7, 25, 14, 25, 0);   // sello distinto del de r1, a proposito (ver "El sello de cada corrida" arriba)
    const r2 = ctx.aplicarGuardarProyeccion();
    ok(r2.ok === true, 'segunda corrida (mismo periodo): ok=true');
    const propiasN2 = contarFilasConMarca(ssMock, ctx.PG_MARCA);
    ok(propiasN2 === 3, 'IDEMPOTENCIA: siguen siendo 3 filas propias, NO 6 -- guardar dos veces reemplaza, no duplica (dio ' + propiasN2 + ')');

    const proyHoja2 = ssMock._hojas['Proyeccion'];
    let tcUsdEscrito2 = null;
    for (let f = cfg.dataRow; f <= proyHoja2.getLastRow(); f++) {
        const nota = String(proyHoja2.getRange(f, colNota).getValue() || '');
        if (nota.indexOf(ctx.PG_MARCA) === 0) { tcUsdEscrito2 = proyHoja2.getRange(f, colTcUsd).getValue(); break; }
    }
    ok(tcUsdEscrito2 === 2000, 'la segunda corrida REEMPLAZA con la cotizacion nueva (2000), no arrastra la vieja');

    // -------- REVERTIR: vuelve al estado previo a la ULTIMA corrida aplicada (SOLO la ultima --
    // -- el contrato es "quita lo que escribio ESTA corrida", no un undo-history completo). Lo
    // que r2 retiro fueron las 3 filas de r1 (el base de septiembre ya lo habia retirado r1, asi
    // que r2 no volvio a tocarlo): revertir tiene que reponer las 3 filas de r1 -- con SU TC
    // congelado, 1000, no el 2000 de r2 -- y el base de septiembre sigue sin volver (r1 lo
    // retiro de forma permanente hasta que alguien corra "Presupuesto base" de nuevo). --------
    const r3 = ctx.revertirGuardarProyeccion();
    ok(r3.ok === true, 'revertir: ok=true' + (r3.ok ? '' : ' -- ' + r3.error));
    const propiasN3 = contarFilasConMarca(ssMock, ctx.PG_MARCA);
    ok(propiasN3 === 3, 'tras revertir, vuelven las 3 filas de la corrida ANTERIOR (r1), no cero y no 6, dio ' + propiasN3);

    const proyHoja3 = ssMock._hojas['Proyeccion'];
    let tcUsdRepuesto = null, quedaBaseSepPost = false, quedaBaseAgoPost = false;
    for (let f = cfg.dataRow; f <= proyHoja3.getLastRow(); f++) {
        const nota = String(proyHoja3.getRange(f, colNota).getValue() || '');
        const fecha = proyHoja3.getRange(f, colFecha).getValue();
        if (nota.indexOf(ctx.PG_MARCA) === 0 && tcUsdRepuesto === null) tcUsdRepuesto = proyHoja3.getRange(f, colTcUsd).getValue();
        if (nota.indexOf(ctx.PB_MARCA) === 0 && fecha instanceof Date && fecha.getMonth() === 8) quedaBaseSepPost = true;
        if (nota.indexOf(ctx.PB_MARCA) === 0 && fecha instanceof Date && fecha.getMonth() === 7) quedaBaseAgoPost = true;
    }
    ok(tcUsdRepuesto === 1000, 'las filas repuestas traen el TC de r1 (1000), no el de r2 (2000): es el respaldo correcto, dio ' + tcUsdRepuesto);
    ok(!quedaBaseSepPost, 'el base de septiembre NO vuelve (revertir solo deshace la ULTIMA corrida, no toda la historia)');
    ok(quedaBaseAgoPost, 'el base de agosto (nunca tocado por ninguna corrida) sigue presente');
}

// ============================================================================
// 7. MUTACION: la API de cotizaciones falla A MITAD DE CAMINO -- todo o nada
// ============================================================================
console.log('\n=== 7. La API de cotizaciones falla: no se escribe ni se borra nada ===');
{
    tidetrackUsd = () => 1000; tidetrackAud = () => 700; tidetrackEur = () => 1100;
    const bloques = { ingresos: [{ cuenta: 'Sueldo', proyectar: 500000 }] };
    const hojaPresu = hojaPresupuestoMock(bloques);
    const filaBase = filaProy({ monto: 1, tipo: 'Ingreso', cuenta: 'X', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' sello' });
    const ssMock = crearSsMock([], [filaBase]);
    ssActual = { getSheetByName: (n) => (n === ctx.SHEETS.PRESUPUESTO ? hojaPresu : ssMock.getSheetByName(n)), getSheets: () => ssMock.getSheets().concat([{ getName: () => ctx.SHEETS.PRESUPUESTO }]), insertSheet: (n) => ssMock.insertSheet(n), toast() {} };
    uiActual = uiMockSiempreSi();
    propsActual = propsMock();

    const filasAntes = ssMock._hojas['Proyeccion'].getLastRow();

    tidetrackEur = () => { throw new Error('Frankfurter caido'); };
    const r = ctx.aplicarGuardarProyeccion();
    ok(r.ok === false, 'la API caida hace que aplicar devuelva ok=false');

    const filasDespues = ssMock._hojas['Proyeccion'].getLastRow();
    ok(filasAntes === filasDespues, 'TODO O NADA: "Proyeccion" quedo con EXACTAMENTE las mismas filas que antes (' + filasAntes + '), ni se borro el base ni se escribio nada nuevo');
    ok(contarFilasConMarca(ssMock, ctx.PG_MARCA) === 0, 'cero filas propias: no quedo nada a medio escribir');
}

// ============================================================================
console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
