/**
 * devtools/probar_proyeccion_abm.js
 * Banco de pruebas de DEVTOOL_ProyeccionAbm.js.
 *
 * Siete partes:
 * 0. Integridad de los fuentes (sin bytes de control).
 * 1. Helpers de clave/mes/nota: _fechaDesdeClavePa, _mesLabelPa, _partesNotaGuardadoPa.
 * 2. Totales por bloque y moneda (_totalesPorBloquePa): nunca suma monedas distintas entre si,
 *    el neto cubre la union de monedas, y "otrasFilas" nunca se pierde en silencio.
 * 3. listarPeriodosProyeccion: agrupamiento mixto (guardado + base, varios periodos) y el CASO
 *    LIMITE del encargo -- una "Proyeccion" que hoy en produccion solo tiene filas base.
 * 4. detalleFilasPeriodoProyeccion: detalle por periodo+origen, y el caso "sin filas" que no es
 *    un error.
 * 5. eliminarPeriodoProyeccion / revertirBajaProyeccionAbm: borra por clave+origen exacto, deja
 *    intacto el resto (otro periodo, el OTRO origen del mismo mes), respalda, revierte
 *    fila-por-fila identico, y la "doble baja" pisa el registro de revert de la anterior.
 * 6. actualizarMontoFilaProyeccion / revertirEdicionMontoProyeccion: el gate de seguridad contra
 *    filas PB_MARCA, la validacion de monto (incluida la trampa de Number('')===0), y el
 *    roundtrip editar->revertir exacto.
 * 7. pingProyeccionAbm (v0.57.0): forma constante, payload trivial, cero dependencia de
 *    SpreadsheetApp -- el separador del experimento "canal roto entero" vs. "problema de
 *    listarPeriodosProyeccion() o su respuesta" (ver UI_AbmProyeccionElaborada.html).
 *
 * USO:  node devtools/probar_proyeccion_abm.js
 * @version 0.53.0
 * @since 2026-08-25
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.resolve(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// ============================================================================
// CONTEXTO: se cargan Config y los modulos de verdad, sin reimplementar nada. Mismo set de
// archivos que carga probar_presupuesto_guardar.js (orden real de Apps Script), mas el modulo
// nuevo al final.
// ============================================================================
let ssActual = null, propsActual = null;
let tidetrackUsd = () => 1000, tidetrackAud = () => 700, tidetrackEur = () => 1100;

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, isNaN, JSON, parseInt,
    SpreadsheetApp: {
        getActiveSpreadsheet: () => ssActual,
        getUi: () => { throw new Error('sin UI en este escenario (este modulo no deberia llamarla)'); },
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoGuardar.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_ProyeccionAbm.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,MONEDAS_DISPONIBLES,columnLetterToIndex,' +
    'invalidarCacheNombresHojas,IP_MESES,PG_MARCA,PB_MARCA,PA_CATEGORIA_A_CLAVE,' +
    'PA_PROP_PREVIOS_BAJA,PA_PROP_PREVIOS_EDICION,PA_PREFIJO_RESPALDO,' +
    '_claveMesPg,_filasPorNotaPrefijoPg,_filasBasePorMesPg,_leerRespaldoFilasPg,' +
    '_escribirAlPieProyeccionPg,_preflightPb,_borrarGeneradasPb,' +
    '_fechaDesdeClavePa,_mesLabelPa,_partesNotaGuardadoPa,_leerTodasFilasPa,_filasDelPeriodoPa,' +
    '_totalesPorBloquePa,_ordenMonedasPa,_monedasEnFilasPa,_montoValidoPa,_respaldarFilasPa,' +
    'pingProyeccionAbm,listarPeriodosProyeccion,detalleFilasPeriodoProyeccion,eliminarPeriodoProyeccion,' +
    'revertirBajaProyeccionAbm,actualizarMontoFilaProyeccion,revertirEdicionMontoProyeccion});',
    ctx);

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
// 1. HELPERS DE CLAVE / MES / NOTA
// ============================================================================
console.log('\n=== 1. Clave de periodo, rotulo de mes, parseo de Nota guardado ===');
{
    const f = ctx._fechaDesdeClavePa('2026-09');
    ok(f.getFullYear() === 2026 && f.getMonth() === 8 && f.getDate() === 1,
       'clave "2026-09" -> primer dia de septiembre 2026, dio ' + f);
    ok(ctx._fechaDesdeClavePa('2026-13') === null, 'mes 13 (invalido) -> null');
    ok(ctx._fechaDesdeClavePa('2026-00') === null, 'mes 00 (invalido) -> null');
    ok(ctx._fechaDesdeClavePa('26-09') === null, 'anio de dos digitos -> null (formato exacto YYYY-MM)');
    ok(ctx._fechaDesdeClavePa('') === null, 'clave vacia -> null');
    ok(ctx._fechaDesdeClavePa(null) === null, 'clave null -> null (no revienta)');

    ok(ctx._mesLabelPa(2026, 0) === 'Enero 2026', 'mesLabel(2026,0) = "Enero 2026", dio ' + ctx._mesLabelPa(2026, 0));
    ok(ctx._mesLabelPa(2026, 8) === 'Septiembre 2026', 'mesLabel(2026,8) = "Septiembre 2026"');

    const p1 = ctx._partesNotaGuardadoPa(ctx.PG_MARCA + ' 2026-09 2026-08-25_143000');
    ok(p1 && p1.clave === '2026-09' && p1.sello === '2026-08-25_143000',
       'Nota guardado bien formada -> {clave,sello} exactos, dio ' + JSON.stringify(p1));

    ok(ctx._partesNotaGuardadoPa(ctx.PB_MARCA + ' 2026-08-20_2319') === null,
       'una Nota de PB_MARCA no matchea el parser de guardado (los textos no son prefijo uno del otro)');
    ok(ctx._partesNotaGuardadoPa('') === null, 'Nota vacia -> null');
    ok(ctx._partesNotaGuardadoPa(ctx.PG_MARCA + ' solo-un-token') === null,
       'Nota de guardado sin el segundo espacio (sin sello) -> null, no se inventa un sello vacio');
    ok(ctx._partesNotaGuardadoPa(ctx.PG_MARCA + ' no-es-clave 2026-08-25_143000') === null,
       'el primer token no tiene forma YYYY-MM -> null (no se cuela una clave invalida)');
}

// ============================================================================
// 2. TOTALES POR BLOQUE Y MONEDA
// ============================================================================
console.log('\n=== 2. Totales por bloque y moneda (_totalesPorBloquePa) ===');
{
    const filasCrudas = [
        { tipoCuenta: 'Ingreso', moneda: 'ARS', monto: 500000 },
        { tipoCuenta: 'Ingreso', moneda: 'USD', monto: 300 },
        { tipoCuenta: 'Gasto Fijo', moneda: 'ARS', monto: 200000 },
        { tipoCuenta: 'Gasto Variable', moneda: 'ARS', monto: 80000 },
        { tipoCuenta: 'Traspaso', moneda: 'ARS', monto: 999 },   // otrasFilas
        { tipoCuenta: '', moneda: 'ARS', monto: 1 }              // otrasFilas
    ];
    const t = ctx._totalesPorBloquePa(filasCrudas);

    ok(t.otrasFilas === 2, 'las 2 filas sin categoria reconocida se cuentan en otrasFilas, dio ' + t.otrasFilas);

    // MUTACION directa: nunca sumar monedas distintas entre si dentro de un mismo bloque.
    ok(t.ingresos.length === 2, 'ingresos tiene DOS entradas (ARS y USD), no una sola mezclada, dio ' + t.ingresos.length);
    const ingArs = t.ingresos.find(x => x.moneda === 'ARS');
    const ingUsd = t.ingresos.find(x => x.moneda === 'USD');
    ok(ingArs && ingArs.monto === 500000, 'ingresos ARS = 500000 exacto (no 500000+300), dio ' + (ingArs && ingArs.monto));
    ok(ingUsd && ingUsd.monto === 300, 'ingresos USD = 300 exacto, dio ' + (ingUsd && ingUsd.monto));
    ok(!t.ingresos.some(x => x.monto === 500300), 'ninguna entrada de ingresos es la suma ARS+USD mezclada (500300)');

    ok(t.fijos.length === 1 && t.fijos[0].moneda === 'ARS' && t.fijos[0].monto === 200000, 'fijos: solo ARS 200000');
    ok(t.variables.length === 1 && t.variables[0].moneda === 'ARS' && t.variables[0].monto === 80000, 'variables: solo ARS 80000');

    // El neto cubre la UNION de monedas (ARS y USD), con 0 donde un bloque no tuvo esa moneda.
    ok(t.neto.length === 2, 'neto tiene 2 entradas (ARS y USD, la union de los tres bloques), dio ' + t.neto.length);
    const netoArs = t.neto.find(x => x.moneda === 'ARS');
    const netoUsd = t.neto.find(x => x.moneda === 'USD');
    ok(netoArs && netoArs.monto === (500000 - 200000 - 80000), 'neto ARS = ingresosArs - fijosArs - variablesArs, dio ' + (netoArs && netoArs.monto));
    ok(netoUsd && netoUsd.monto === 300, 'neto USD = 300 - 0 - 0 (fijos/variables en USD cuentan 0, no se omiten), dio ' + (netoUsd && netoUsd.monto));

    // Filas vacias: no revienta, todo en cero/vacio.
    const tVacio = ctx._totalesPorBloquePa([]);
    ok(tVacio.ingresos.length === 0 && tVacio.fijos.length === 0 && tVacio.variables.length === 0 &&
       tVacio.neto.length === 0 && tVacio.otrasFilas === 0, 'sin filas: todo vacio, no revienta');
}

// ============================================================================
// Helpers de grilla real (Registros/Proyeccion), mismo patron que probar_presupuesto_guardar.js
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
                return {
                    getValue: () => (f[col - colIni] === undefined ? '' : f[col - colIni]),
                    setValue: (v) => { f[col - colIni] = v; }
                };
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

function propsMock() {
    const store = {};
    return { setProperty: (k, v) => { store[k] = v; }, getProperty: (k) => (k in store ? store[k] : null), deleteProperty: (k) => { delete store[k]; }, _store: store };
}

function activarSs(registrosFilas, proyeccionFilas) {
    const m = crearSsMock(registrosFilas, proyeccionFilas);
    ssActual = { getSheetByName: (n) => m.getSheetByName(n), getSheets: () => m.getSheets(), insertSheet: (n) => m.insertSheet(n), toast() {} };
    propsActual = propsMock();
    return m;
}

function filaCompletaPorNumero(ssMock, fila) {
    const cfg = ctx.RANGES.REGISTROS;
    const colIni = ctx.columnLetterToIndex(cfg.start);
    const ancho = ctx.columnLetterToIndex(cfg.end) - colIni + 1;
    return ssMock._hojas['Proyeccion'].getRange(fila, colIni, 1, ancho).getValues()[0];
}

// ============================================================================
// 3. listarPeriodosProyeccion: agrupamiento mixto + CASO LIMITE del encargo
// ============================================================================
console.log('\n=== 3. listarPeriodosProyeccion ===');
{
    // --- MUTACION 1: agrupamiento mixto -- 2 periodos guardado, 3 meses base ---
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 6, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 110000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 120000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 selloB' }),
        filaProy({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 selloB' }),
        filaProy({ monto: 480000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 9, 1), nota: ctx.PG_MARCA + ' 2026-10 selloC' }),
        filaProy({ monto: 999999, tipo: 'Ingreso', cuenta: 'Ruido', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: 'cargado a mano, sin marca' })
    ];
    activarSs([], filas);

    const r = ctx.listarPeriodosProyeccion();
    ok(r.grupos.guardado.length === 2, 'DOS periodos guardado (2026-09, 2026-10), dio ' + r.grupos.guardado.length);
    ok(r.grupos.base.length === 3, 'TRES meses base (07, 08, 09/2026), dio ' + r.grupos.base.length);
    ok(r.grupos.guardado[0].clave === '2026-10' && r.grupos.guardado[1].clave === '2026-09',
       'guardado ordenado DESC por clave (mas reciente primero), dio ' + r.grupos.guardado.map(g => g.clave).join(','));
    ok(r.grupos.base[0].clave === '2026-09' && r.grupos.base[2].clave === '2026-07',
       'base ordenado DESC por clave, dio ' + r.grupos.base.map(g => g.clave).join(','));

    const g0909 = r.grupos.guardado.find(g => g.clave === '2026-09');
    ok(g0909.filas.length === 2, '2026-09 guardado tiene 2 filas (Sueldo+Alquiler), dio ' + g0909.filas.length);
    ok(g0909.mesLabel === 'Septiembre 2026', 'mesLabel de 2026-09 = "Septiembre 2026", dio ' + g0909.mesLabel);
    ok(g0909.sello === 'selloB', 'sello del grupo guardado = "selloB" (el de la Nota), dio ' + g0909.sello);

    const bAgo = r.grupos.base.find(g => g.clave === '2026-08');
    ok(bAgo.filas.length === 1, '2026-08 base tiene 1 fila, dio ' + bAgo.filas.length);
    ok(Array.isArray(bAgo.sellos) && bAgo.sellos[0] === 'selloA', 'base expone "sellos" (plural, array), dio ' + JSON.stringify(bAgo.sellos));
    ok(g0909.sello !== undefined && bAgo.sello === undefined, 'guardado usa "sello" singular, base NO lo tiene (usa "sellos")');

    const totalFilasVistas = r.grupos.guardado.reduce((a, g) => a + g.filas.length, 0) +
        r.grupos.base.reduce((a, g) => a + g.filas.length, 0);
    ok(totalFilasVistas === 6, 'la fila "sin marca" (Ruido) NUNCA se cuenta en ningun grupo: 6 filas agrupadas de 7 totales, dio ' + totalFilasVistas);

    // --- MUTACION 2: CASO LIMITE OBLIGATORIO -- estado REAL de produccion hoy: SOLO filas base ---
    const soloBase = [
        filaProy({ monto: 50000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 5, 1), nota: ctx.PB_MARCA + ' unicoSello' }),
        filaProy({ monto: 60000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 6, 1), nota: ctx.PB_MARCA + ' unicoSello' })
    ];
    activarSs([], soloBase);
    const r2 = ctx.listarPeriodosProyeccion();
    ok(r2.vacioGuardado === true, 'CASO LIMITE: vacioGuardado===true con una Proyeccion solo-base');
    ok(Array.isArray(r2.grupos.guardado) && r2.grupos.guardado.length === 0, 'CASO LIMITE: grupos.guardado===[] exacto');
    ok(r2.vacioBase === false && r2.grupos.base.length === 2, 'CASO LIMITE: grupos.base poblado y correcto (2 meses), dio ' + r2.grupos.base.length);
}

// ============================================================================
// 4. detalleFilasPeriodoProyeccion
// ============================================================================
console.log('\n=== 4. detalleFilasPeriodoProyeccion ===');
{
    const filas = [
        filaProy({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 selloB', tc_ars: 1, tc_usd: 1000, tc_aud: 700, tc_eur: 1100 }),
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloA' })
    ];
    activarSs([], filas);

    const d = ctx.detalleFilasPeriodoProyeccion('2026-09', 'guardado');
    ok(d.filas.length === 1 && d.filas[0].cuenta === 'Sueldo', 'detalle de 2026-09/guardado: 1 fila, Sueldo');
    ok(d.filas[0].editable === true, 'una fila guardado es editable===true');
    ok(d.filas[0].tcUsd === 1000, 'el detalle expone las cotizaciones congeladas (tcUsd=1000), dio ' + d.filas[0].tcUsd);
    ok(typeof d.filas[0].fecha === 'string', 'la fecha se serializa como string ISO, dio ' + typeof d.filas[0].fecha);

    const d2 = ctx.detalleFilasPeriodoProyeccion('2026-09', 'base');
    ok(d2.filas.length === 1 && d2.filas[0].editable === false, 'detalle de 2026-09/base: 1 fila, editable===false');

    const dVacio = ctx.detalleFilasPeriodoProyeccion('2099-01', 'guardado');
    ok(dVacio.filas.length === 0, 'un periodo sin ninguna fila NO tira: devuelve filas:[] (carrera con otra pestana), dio ' + dVacio.filas.length);

    let lanzo = false;
    try { ctx.detalleFilasPeriodoProyeccion('2026-09', 'lo-que-sea'); } catch (e) { lanzo = true; }
    ok(lanzo, 'origen invalido tira');
    lanzo = false;
    try { ctx.detalleFilasPeriodoProyeccion('no-es-clave', 'guardado'); } catch (e) { lanzo = true; }
    ok(lanzo, 'clave invalida tira');
}

// ============================================================================
// 5. eliminarPeriodoProyeccion / revertirBajaProyeccionAbm
// ============================================================================
console.log('\n=== 5. eliminarPeriodoProyeccion y revertirBajaProyeccionAbm ===');
{
    // base-07, base-08, base-09, guardado-09 (x2 filas), guardado-10
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 6, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 110000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 120000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 selloB' }),
        filaProy({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 selloB' }),
        filaProy({ monto: 480000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 9, 1), nota: ctx.PG_MARCA + ' 2026-10 selloC' })
    ];
    const ssMock = activarSs([], filas);

    // -------- MUTACION 5: clave+origen sin ninguna fila -- tira, no fabrica exito --------
    let lanzo = false;
    try { ctx.eliminarPeriodoProyeccion('2099-01', 'guardado'); } catch (e) { lanzo = true; }
    ok(lanzo, 'borrar un periodo/origen inexistente tira, no fabrica un exito falso');

    // Contenido original de la base de septiembre, ANTES de tocar nada -- para la comparacion
    // fila-por-fila de la MUTACION 7 mas abajo.
    const filasBaseSepAntes = ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'base');
    const contenidoBaseSepAntes = filasBaseSepAntes.map(f => filaCompletaPorNumero(ssMock, f));

    // -------- MUTACION 6: borrar 'guardado' de 2026-09 NO toca 'base' del mismo mes ni otros periodos --------
    const rBaja1 = ctx.eliminarPeriodoProyeccion('2026-09', 'guardado');
    ok(rBaja1.filasBorradas === 2, 'baja de guardado-2026-09: 2 filas borradas, dio ' + rBaja1.filasBorradas);

    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'guardado').length === 0,
       'guardado-2026-09 quedo en cero filas');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'base').length === 1,
       'DECISION 3/coexistencia: base-2026-09 (MISMO mes, OTRO origen) sigue intacto');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-10', 'guardado').length === 1,
       'guardado-2026-10 (otro periodo) sigue intacto');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-07', 'base').length === 1 &&
       ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-08', 'base').length === 1,
       'base-2026-07 y base-2026-08 (otros meses) siguen intactos');

    // -------- ahora borrar 'base' de 2026-09 (mismo mes, el otro origen) tampoco toca lo demas --------
    const rBaja2 = ctx.eliminarPeriodoProyeccion('2026-09', 'base');
    ok(rBaja2.filasBorradas === 1, 'baja de base-2026-09: 1 fila borrada');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-07', 'base').length === 1 &&
       ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-08', 'base').length === 1,
       'tras la SEGUNDA baja, base-07 y base-08 siguen intactos (verdadera aislacion por clave+origen)');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-10', 'guardado').length === 1,
       'guardado-2026-10 sigue intacto tras las dos bajas');

    // -------- MUTACION 12: doble baja consecutiva -- revertir repone la SEGUNDA, no la primera --------
    const rRevert = ctx.revertirBajaProyeccionAbm();
    ok(rRevert.clave === '2026-09' && rRevert.origen === 'base',
       'revertir despues de DOS bajas repone la SEGUNDA (base-2026-09), no la primera (guardado-2026-09), dio ' +
       rRevert.clave + '/' + rRevert.origen);
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'base').length === 1,
       'base-2026-09 volvio (era la segunda baja)');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'guardado').length === 0,
       'guardado-2026-09 SIGUE ausente (la primera baja no es revertible: su registro fue pisado por la segunda -- limitacion esperada, no un bug)');

    // -------- MUTACION 7: lo restaurado es IDENTICO fila por fila, no solo en cantidad --------
    const filasBaseSepDespues = ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'base');
    ok(filasBaseSepDespues.length === contenidoBaseSepAntes.length, 'misma cantidad de filas restauradas');
    const contenidoBaseSepDespues = filasBaseSepDespues.map(f => filaCompletaPorNumero(ssMock, f));
    let idxMonto = ctx.columnLetterToIndex(ctx.RANGES.REGISTROS.columns.monto) - ctx.columnLetterToIndex(ctx.RANGES.REGISTROS.start);
    let idxNota = ctx.columnLetterToIndex(ctx.RANGES.REGISTROS.columns.nota) - ctx.columnLetterToIndex(ctx.RANGES.REGISTROS.start);
    let idxFecha = ctx.columnLetterToIndex(ctx.RANGES.REGISTROS.columns.fecha) - ctx.columnLetterToIndex(ctx.RANGES.REGISTROS.start);
    ok(contenidoBaseSepDespues[0][idxMonto] === contenidoBaseSepAntes[0][idxMonto],
       'monto identico al original (120000), dio ' + contenidoBaseSepDespues[0][idxMonto]);
    ok(contenidoBaseSepDespues[0][idxNota] === contenidoBaseSepAntes[0][idxNota],
       'Nota identica al original, dio "' + contenidoBaseSepDespues[0][idxNota] + '"');
    ok(contenidoBaseSepDespues[0][idxFecha] instanceof Date &&
       contenidoBaseSepDespues[0][idxFecha].getTime() === contenidoBaseSepAntes[0][idxFecha].getTime(),
       'Fecha identica al original (reconstruida como Date), dio ' + contenidoBaseSepDespues[0][idxFecha]);

    // -------- MUTACION 8: revertir SIN ninguna baja previa -- tira --------
    lanzo = false;
    try { ctx.revertirBajaProyeccionAbm(); } catch (e) { lanzo = true; }
    ok(lanzo, 'revertirBajaProyeccionAbm sin baja previa (la property ya se borro tras el revert anterior) tira');
}

// ============================================================================
// 6. actualizarMontoFilaProyeccion / revertirEdicionMontoProyeccion
// ============================================================================
console.log('\n=== 6. actualizarMontoFilaProyeccion y revertirEdicionMontoProyeccion ===');
{
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 selloB' })
    ];
    const ssMock = activarSs([], filas);
    const cfg = ctx.RANGES.REGISTROS;
    const filaBase = cfg.dataRow;          // primera fila de datos: la de PB_MARCA
    const filaGuardado = cfg.dataRow + 1;  // la de PG_MARCA

    // -------- MUTACION 9: editar una fila PB_MARCA -- tira, NO escribe --------
    let lanzo = false, msg = '';
    try { ctx.actualizarMontoFilaProyeccion(filaBase, 999); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('presupuesto base') !== -1, 'editar una fila base tira con mensaje explicito, dio: ' + msg);
    const colMonto = ctx.columnLetterToIndex(cfg.columns.monto);
    const montoBaseTrasIntento = ssMock._hojas['Proyeccion'].getRange(filaBase, colMonto).getValue();
    ok(montoBaseTrasIntento === 100000, 'el monto de la fila base SIGUE en 100000 (no se escribio nada), dio ' + montoBaseTrasIntento);

    // -------- MUTACION 11: nuevoMonto no numerico -- tira, no escribe, para CADA variante --------
    [NaN, '', 'abc', null, undefined, '   '].forEach(valorMalo => {
        let lanzoMal = false;
        try { ctx.actualizarMontoFilaProyeccion(filaGuardado, valorMalo); } catch (e) { lanzoMal = true; }
        ok(lanzoMal, 'nuevoMonto=' + JSON.stringify(valorMalo) + ' tira (incluida la trampa Number("")===0)');
    });
    const montoGuardadoTrasIntentosMalos = ssMock._hojas['Proyeccion'].getRange(filaGuardado, colMonto).getValue();
    ok(montoGuardadoTrasIntentosMalos === 200000, 'tras los 6 intentos invalidos, el monto SIGUE en 200000 (ninguno escribio), dio ' + montoGuardadoTrasIntentosMalos);

    // -------- MUTACION 10: editar una fila PG_MARCA -- escribe, verifica, y revierte exacto --------
    const rEdit = ctx.actualizarMontoFilaProyeccion(filaGuardado, 250000);
    ok(rEdit.montoAnterior === 200000 && rEdit.montoNuevo === 250000 && rEdit.clave === '2026-09',
       'actualizarMontoFilaProyeccion devuelve montoAnterior/montoNuevo/clave correctos, dio ' + JSON.stringify(rEdit));
    const montoTrasEditar = ssMock._hojas['Proyeccion'].getRange(filaGuardado, colMonto).getValue();
    ok(montoTrasEditar === 250000, 'el monto releido de la hoja es 250000, dio ' + montoTrasEditar);

    const rRevertEdit = ctx.revertirEdicionMontoProyeccion();
    ok(rRevertEdit.fila === filaGuardado && rRevertEdit.montoRestaurado === 200000,
       'revertirEdicionMontoProyeccion devuelve la fila y el monto restaurado (200000), dio ' + JSON.stringify(rRevertEdit));
    const montoTrasRevertir = ssMock._hojas['Proyeccion'].getRange(filaGuardado, colMonto).getValue();
    ok(montoTrasRevertir === 200000, 'el monto releido tras revertir es EXACTO al original (200000), dio ' + montoTrasRevertir);

    // revertir de nuevo (sin edicion pendiente) tira.
    lanzo = false;
    try { ctx.revertirEdicionMontoProyeccion(); } catch (e) { lanzo = true; }
    ok(lanzo, 'revertirEdicionMontoProyeccion sin edicion previa tira');

    // Una fila sin ninguna marca tampoco es editable (mismo gate que PB_MARCA).
    const filasSinMarca = [filaProy({ monto: 1, tipo: 'Ingreso', cuenta: 'X', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: 'cargado a mano' })];
    activarSs([], filasSinMarca);
    lanzo = false;
    try { ctx.actualizarMontoFilaProyeccion(cfg.dataRow, 5); } catch (e) { lanzo = true; }
    ok(lanzo, 'una fila sin ninguna marca tampoco se puede editar (mismo gate de PG_MARCA)');

    // fila fuera de rango.
    lanzo = false;
    try { ctx.actualizarMontoFilaProyeccion(99999, 5); } catch (e) { lanzo = true; }
    ok(lanzo, 'un numero de fila fuera del rango vivo tira');
}

// ============================================================================
// 7. pingProyeccionAbm -- experimento de aislamiento del canal google.script.run (v0.57.0)
// ============================================================================
console.log('\n=== 7. pingProyeccionAbm ===');
{
    // Sin ninguna spreadsheet activa (ssActual null, la anterior seccion no la dejo puesta):
    // si pingProyeccionAbm tocara SpreadsheetApp de cualquier forma, esto ya explotaria.
    ssActual = null;
    propsActual = null;

    const r1 = ctx.pingProyeccionAbm();
    ok(r1 && typeof r1 === 'object', 'devuelve un objeto');
    ok(typeof r1.mensaje === 'string' && r1.mensaje.length > 0, 'tiene un campo string no vacio, dio ' + JSON.stringify(r1.mensaje));
    ok(typeof r1.ts === 'number' && isFinite(r1.ts), 'tiene un campo numero finito, dio ' + r1.ts);

    // Constante entre llamadas EN LA FORMA (mismas claves, mismo tipo) -- el "ts" en si puede
    // variar (es un timestamp), lo que tiene que ser constante es que NO dependa de ningun estado
    // de la planilla: llamarlo dos veces seguidas sin tocar nada da la misma forma.
    const r2 = ctx.pingProyeccionAbm();
    ok(Object.keys(r1).sort().join(',') === Object.keys(r2).sort().join(','),
       'dos llamadas seguidas devuelven exactamente las mismas claves, dio ' +
       Object.keys(r1).sort().join(',') + ' vs ' + Object.keys(r2).sort().join(','));
    ok(r1.mensaje === r2.mensaje, 'el campo string es literal-constante entre llamadas (no depende de nada), dio "' + r1.mensaje + '" vs "' + r2.mensaje + '"');

    // El payload en si es minimo -- esto es justo lo que lo hace util como separador: si ESTO
    // falla por el canal, no puede ser "la respuesta es demasiado grande".
    const bytes = JSON.stringify(r1).length;
    ok(bytes < 100, 'el payload del ping es trivial (<100 caracteres), dio ' + bytes);
}

// ============================================================================
console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
