/**
 * devtools/probar_proyeccion_abm.js
 * Banco de pruebas de DEVTOOL_ProyeccionAbm.js.
 *
 * Siete partes:
 * 0. Integridad de los fuentes (sin bytes de control).
 * 1. Helpers de clave/mes y el CLASIFICADOR _origenNotaPa (2026-08-29): cinco origenes
 *    (guardado/shell/recurrentes/base/otros) por forma de sello, formato historico del shell
 *    con nota libre pegada, malformadas a 'otros', nunca invisibles.
 * 2. Totales por bloque y moneda (_totalesPorBloquePa): nunca suma monedas distintas entre si,
 *    el neto cubre la union de monedas, y "otrasFilas" nunca se pierde en silencio.
 * 3. listarPeriodosProyeccion: cinco poblaciones separadas en el MISMO mes, payload acotado
 *    (guardia anti-inflado: sin filas[]/monedas/anio/sello/sellos), corridas/ultimoSello, y el
 *    CASO LIMITE -- una "Proyeccion" solo con filas base.
 * 4. detalleFilasPeriodoProyeccion: detalle por periodo+origen con notaLibre, editabilidad por
 *    origen (guardado y shell si; base/recurrentes/otros no), y el caso "sin filas".
 * 5. eliminarPeriodoProyeccion / revertirBajaProyeccionAbm: baja SELECTIVA por origen (la de
 *    'guardado' ya no arrastra shell -- hallazgo 3), recurrentes y otros borrables (hallazgo
 *    4), reversion exacta, y el revert de un respaldo LEGADO mixto sin falso error.
 * 6. actualizarMontoFilaProyeccion / revertirEdicionMontoProyeccion: gate POR ORIGEN (shell
 *    editable; base/recurrentes/otros rechazadas cada una con su mensaje), la validacion de
 *    monto (incluida la trampa de Number('')===0), y el roundtrip editar->revertir exacto.
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
    // 17_RecurrentesService: aporta REC_MARCA, que el clasificador lee en runtime. Va ANTES de
    // los DEVTOOL_* como en Apps Script (los digitos ordenan antes que las letras); sus const
    // de nivel superior son literales puros, no leen otros archivos (probar_carga_apps_script
    // es la red si eso cambiara).
    fs.readFileSync(path.join(RAIZ, 'src/17_RecurrentesService.js'), 'utf8') + '\n' +
    // 18_RespaldoService: la boveda de respaldos. Carga DESPUES de 17_ y ANTES de los
    // DEVTOOL_*, igual que en Apps Script (los digitos ordenan antes que las letras).
    fs.readFileSync(path.join(RAIZ, 'src/18_RespaldoService.js'), 'utf8') + '\n' +
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
    'invalidarCacheNombresHojas,IP_MESES,PG_MARCA,PB_MARCA,REC_MARCA,PA_CATEGORIA_A_CLAVE,' +
    'PA_ORIGENES,PA_PROP_PREVIOS_BAJA,PA_PROP_PREVIOS_EDICION,PA_PREFIJO_RESPALDO,' +
    '_claveMesPg,_filasPorNotaPrefijoPg,_filasBasePorMesPg,_leerRespaldoFilasPg,' +
    '_escribirAlPieProyeccionPg,_preflightPb,_borrarGeneradasPb,' +
    '_fechaDesdeClavePa,_mesLabelPa,_origenNotaPa,_leerTodasFilasPa,_filasDelPeriodoPa,' +
    '_totalesPorBloquePa,_ordenMonedasPa,_monedasEnFilasPa,_montoValidoPa,_respaldarFilasPa,' +
    'pingProyeccionAbm,listarPeriodosProyeccion,detalleFilasPeriodoProyeccion,eliminarPeriodoProyeccion,' +
    'revertirBajaProyeccionAbm,actualizarMontoFilaProyeccion,revertirEdicionMontoProyeccion,' +
    'PA_MSJ_NO_EDITABLE,_motivoBajaBloqueadaPa,MENU_CONFIG,' +
    'RESP_PROP_PREFIJO,RESP_FILAS_POR_TROZO,RESP_TOPE_PROPS,RESP_TOPE_CARACTERES_TROZO,' +
    'guardarRespaldoFilas,leerRespaldoFilas,borrarRespaldoFilas,_conHojaActivaPreservada,' +
    '_claveIndiceResp,_claveTrozoResp,REC_HORIZONTE_MESES,_clavesVentanaRec});',
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

    const fechaSep = new Date(2026, 8, 1);

    // (i) PG puro -> guardado, sello exacto, notaLibre vacia.
    const pG = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 2026-08-25_143000', fechaSep);
    ok(pG && pG.origen === 'guardado' && pG.clave === '2026-09' && pG.sello === '2026-08-25_143000' && pG.notaLibre === '',
       'PG puro -> guardado con {clave,sello} exactos y notaLibre vacia, dio ' + JSON.stringify(pG));

    // (ii) shell SIN y CON nota libre (formato historico: la nota pegada tras el sello).
    const pS1 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111', fechaSep);
    ok(pS1 && pS1.origen === 'shell' && pS1.clave === '2026-09' &&
       pS1.sello === 'shell_2026-08-27_100000111' && pS1.notaLibre === '',
       'shell sin nota libre -> origen shell, sello = SOLO el token shell_, dio ' + JSON.stringify(pS1));
    const pS2 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111 vacaciones en la costa', fechaSep);
    ok(pS2 && pS2.origen === 'shell' && pS2.sello === 'shell_2026-08-27_100000111' &&
       pS2.notaLibre === 'vacaciones en la costa',
       'shell con nota libre (formato historico) -> la nota libre queda SEPARADA del sello, dio ' + JSON.stringify(pS2));

    // (ii-bis) VINTAGE v0.56.0-v0.58.0: el shell desplegado en esa ventana escribia el sello SIN
    // milisegundos ('shell_yyyy-MM-dd_HHmmss', 6 digitos) -- esas filas viven en produccion y
    // tienen que clasificar 'shell' (editables, bajo su rotulo), no degradar a 'otros'.
    const pS3 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000', fechaSep);
    ok(pS3 && pS3.origen === 'shell' && pS3.clave === '2026-09' &&
       pS3.sello === 'shell_2026-08-27_100000' && pS3.notaLibre === '',
       'shell historico sin ms (vintage v0.56-v0.58) -> origen shell, dio ' + JSON.stringify(pS3));
    const pS4 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000 finde largo', fechaSep);
    ok(pS4 && pS4.origen === 'shell' && pS4.sello === 'shell_2026-08-27_100000' && pS4.notaLibre === 'finde largo',
       'shell historico sin ms CON nota libre -> shell con notaLibre separada, dio ' + JSON.stringify(pS4));
    // Un largo intermedio (7 digitos) no es ningun vintage conocido: degrada a 'otros', visible.
    const pS5 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_1000001', fechaSep);
    ok(pS5 && pS5.origen === 'otros' && pS5.clave === '2026-09',
       'un sello shell de 7 digitos (ningun vintage) -> otros, no se disfraza de shell, dio ' + JSON.stringify(pS5));

    // (iii) REC con y sin ': nota'.
    const pR1 = ctx._origenNotaPa(ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Netflix', fechaSep);
    ok(pR1 && pR1.origen === 'recurrentes' && pR1.clave === '2026-09' &&
       pR1.sello === '2026-08-21_090000' && pR1.notaLibre === 'Netflix',
       'REC sin nota -> recurrentes, notaLibre = el nombre sin el separador, dio ' + JSON.stringify(pR1));
    const pR2 = ctx._origenNotaPa(ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Netflix: plan familiar', fechaSep);
    ok(pR2 && pR2.origen === 'recurrentes' && pR2.notaLibre === 'Netflix: plan familiar',
       'REC con nota -> notaLibre = "nombre: nota", dio ' + JSON.stringify(pR2));

    // Base bien formada: clave derivada de la Fecha.
    const pB = ctx._origenNotaPa(ctx.PB_MARCA + ' 2026-08-20_2319', fechaSep);
    ok(pB && pB.origen === 'base' && pB.clave === '2026-09' && pB.sello === '2026-08-20_2319',
       'PB con fecha valida -> base, clave del mes de la Fecha, dio ' + JSON.stringify(pB));

    // (iv) Malformadas -> 'otros', nunca invisibles.
    const pO1 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-13 2026-08-25_143000', fechaSep);
    ok(pO1 && pO1.origen === 'otros' && pO1.clave === '2026-09',
       'PG con clave invalida (mes 13) -> otros, clave por la Fecha de la fila, dio ' + JSON.stringify(pO1));
    const pO2 = ctx._origenNotaPa(ctx.PG_MARCA + ' 2026-09 2026-08-25_143000 editada a mano', fechaSep);
    ok(pO2 && pO2.origen === 'otros' && pO2.clave === '2026-09' && pO2.sello === null,
       'PG con cola tras el sello (nota editada a mano) -> otros, NO se disfraza de guardado, dio ' + JSON.stringify(pO2));
    const pO3 = ctx._origenNotaPa(ctx.REC_MARCA + ' 2026-09 sello-raro - Netflix', fechaSep);
    ok(pO3 && pO3.origen === 'otros' && pO3.clave === '2026-09',
       'REC malformada (sello irreconocible) -> otros, conserva la clave parseada, dio ' + JSON.stringify(pO3));
    const pO4 = ctx._origenNotaPa(ctx.PB_MARCA + ' 2026-08-20_2319', 'no es una fecha');
    ok(pO4 && pO4.origen === 'otros' && pO4.clave === 'sin-fecha',
       'PB con fecha invalida -> otros con clave "sin-fecha" (antes era invisible), dio ' + JSON.stringify(pO4));
    const pO5 = ctx._origenNotaPa(ctx.PG_MARCA + ' no-es-clave sin-forma', 'tampoco fecha');
    ok(pO5 && pO5.origen === 'otros' && pO5.clave === 'sin-fecha',
       'PG con clave invalida Y fecha invalida -> otros "sin-fecha", dio ' + JSON.stringify(pO5));

    // Sin ninguna marca -> null (fuera del alcance del ABM, como siempre).
    ok(ctx._origenNotaPa('cargado a mano, sin marca', fechaSep) === null, 'sin marca -> null');
    ok(ctx._origenNotaPa('', fechaSep) === null, 'Nota vacia -> null');
    ok(ctx._origenNotaPa(null, fechaSep) === null, 'Nota null -> null (no revienta)');
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

// La hoja generica que devuelve insertSheet: cubre la boveda (18_RespaldoService.js) y el
// formato legado. `_traza` registra el ORDEN de las operaciones -- es lo que hace medible la
// regla de la unica creacion (foco repuesto y hideSheet ANTES de la primera escritura).
function hojaGenericaMock(nombre, traza) {
    let grid = [];
    const anotar = (que) => { if (traza) traza.push(que); };
    const hoja = {
        getName: () => nombre || 'generica',
        getLastRow: () => grid.length,
        getMaxRows: () => Math.max(grid.length, 1000),
        hideSheet() { anotar('hideSheet'); hoja._oculta = true; },
        deleteRows(startRow, numRows) { grid.splice(startRow - 1, numRows); },
        insertRowsAfter() {},
        getRange(row, col, nRows, nCols) {
            if (nRows === undefined) {
                return {
                    getValue: () => { const f = grid[row - 1] || []; return f[col - 1] === undefined ? '' : f[col - 1]; },
                    setValue: (v) => { anotar('escribir'); while (grid.length <= row - 1) grid.push([]); grid[row - 1][col - 1] = v; },
                    setNumberFormat: () => {}
                };
            }
            return {
                getValues: () => { const out = []; for (let i = 0; i < nRows; i++) { const f = grid[row - 1 + i] || []; out.push(f.slice(col - 1, col - 1 + nCols)); } return out; },
                setValues: (vals) => { anotar('escribir'); for (let i = 0; i < nRows; i++) { while (grid.length <= row - 1 + i) grid.push([]); const f = grid[row - 1 + i]; for (let j = 0; j < nCols; j++) f[col - 1 + j] = vals[i][j]; } },
                setNumberFormat: () => {},
                copyTo: () => {}
            };
        },
        _grid: () => grid
    };
    return hoja;
}

function crearSsMock(registrosFilas, proyeccionFilas) {
    const hojas = { 'Registros': hojaGridMock('Registros', registrosFilas), 'Proyeccion': hojaGridMock('Proyeccion', proyeccionFilas) };
    const traza = [];
    let activa = hojas['Proyeccion'];
    const m = {
        getSheetByName: (n) => hojas[n] || null,
        getSheets: () => Object.keys(hojas).map(n => ({ getName: () => n })),
        getActiveSheet: () => activa,
        setActiveSheet: (h) => { traza.push('setActiveSheet'); activa = h; return h; },
        insertSheet: (n) => { traza.push('insertSheet'); hojas[n] = hojaGenericaMock(n, traza); activa = hojas[n]; m.insertSheetLlamadas++; return hojas[n]; },
        deleteSheet: (h) => { traza.push('deleteSheet'); Object.keys(hojas).forEach(n => { if (hojas[n] === h) delete hojas[n]; }); },
        toast() {},
        insertSheetLlamadas: 0,
        _traza: traza,
        _activa: () => activa,
        _hojas: hojas,
    };
    return m;
}

function propsMock() {
    const store = {};
    return {
        setProperty: (k, v) => { store[k] = String(v); },
        getProperty: (k) => (k in store ? store[k] : null),
        deleteProperty: (k) => { delete store[k]; },
        getKeys: () => Object.keys(store),
        getProperties: () => Object.assign({}, store),
        _store: store
    };
}

let ssMockActivo = null;
function activarSs(registrosFilas, proyeccionFilas) {
    const m = crearSsMock(registrosFilas, proyeccionFilas);
    ssActual = m;
    ssMockActivo = m;
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
console.log('\n=== 3. listarPeriodosProyeccion: cinco poblaciones, payload acotado ===');
{
    // --- MUTACION 1: los CINCO origenes conviviendo en el MISMO mes (mas otros meses) ---
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 6, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 110000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 120000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: 'Santander', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProy({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProy({ monto: 480000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 9, 1), nota: ctx.PG_MARCA + ' 2026-10 2026-08-26_090000' }),
        // (vi) DOS corridas shell del mismo mes, una con nota libre pegada (formato historico).
        filaProy({ monto: 30000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111' }),
        filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones' }),
        filaProy({ monto: 5000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Netflix' }),
        // 'otros': una nota PG editada a mano (cola tras el sello) y una PB sin fecha valida.
        filaProy({ monto: 777, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000 retocada' }),
        filaProy({ monto: 888, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: '', nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 999999, tipo: 'Ingreso', cuenta: 'Ruido', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: 'cargado a mano, sin marca' })
    ];
    activarSs([], filas);

    const r = ctx.listarPeriodosProyeccion();
    ok(Object.keys(r.grupos).sort().join(',') === 'base,guardado,otros,recurrentes,shell',
       'la respuesta trae EXACTAMENTE las cinco poblaciones, dio ' + Object.keys(r.grupos).sort().join(','));
    ok(!('vacioGuardado' in r) && !('vacioBase' in r),
       'vacioGuardado/vacioBase se retiraron del payload: el cliente usa grupos.X.length');

    ok(r.grupos.guardado.length === 2, 'DOS periodos guardado (2026-09, 2026-10), dio ' + r.grupos.guardado.length);
    ok(r.grupos.base.length === 3, 'TRES meses base (07, 08, 09/2026), dio ' + r.grupos.base.length);
    ok(r.grupos.shell.length === 1 && r.grupos.recurrentes.length === 1,
       'shell y recurrentes son grupos PROPIOS (hallazgos 2 y 4): ya no se funden ni son invisibles');
    ok(r.grupos.guardado[0].clave === '2026-10' && r.grupos.guardado[1].clave === '2026-09',
       'guardado ordenado DESC por clave (mas reciente primero), dio ' + r.grupos.guardado.map(g => g.clave).join(','));
    ok(r.grupos.base[0].clave === '2026-09' && r.grupos.base[2].clave === '2026-07',
       'base ordenado DESC por clave, dio ' + r.grupos.base.map(g => g.clave).join(','));

    const g0909 = r.grupos.guardado.find(g => g.clave === '2026-09');
    ok(g0909.nFilas === 2, '2026-09 guardado tiene nFilas=2 (Sueldo+Alquiler, sin la editada a mano), dio ' + g0909.nFilas);
    ok(g0909.mesLabel === 'Septiembre 2026', 'mesLabel de 2026-09 = "Septiembre 2026", dio ' + g0909.mesLabel);
    ok(g0909.corridas === 1 && g0909.ultimoSello === '2026-08-25_143000',
       'guardado 2026-09: corridas=1, ultimoSello el de la Nota, dio ' + g0909.corridas + '/' + g0909.ultimoSello);

    // (vi) corridas del shell: dos sellos distintos, ultimoSello el mayor.
    const sSep = r.grupos.shell[0];
    ok(sSep.clave === '2026-09' && sSep.nFilas === 2 && sSep.corridas === 2,
       'shell 2026-09: 2 filas de 2 corridas distintas, dio nFilas=' + sSep.nFilas + ' corridas=' + sSep.corridas);
    ok(sSep.ultimoSello === 'shell_2026-08-28_110000222',
       'ultimoSello del shell = el mayor lexicografico (cronologico), dio ' + sSep.ultimoSello);

    const recSep = r.grupos.recurrentes[0];
    ok(recSep.clave === '2026-09' && recSep.nFilas === 1 && recSep.ultimoSello === '2026-08-21_090000',
       'recurrentes 2026-09: 1 fila con su sello propio, dio ' + JSON.stringify({ n: recSep.nFilas, s: recSep.ultimoSello }));

    // 'otros': la editada a mano (2026-09) y la PB sin fecha ('sin-fecha', SIEMPRE al final).
    ok(r.grupos.otros.length === 2 && r.grupos.otros[0].clave === '2026-09' &&
       r.grupos.otros[1].clave === 'sin-fecha',
       'otros: la nota editada a mano y la PB sin fecha, con "sin-fecha" al final, dio ' + r.grupos.otros.map(g => g.clave).join(','));
    ok(r.grupos.otros[1].mesLabel === 'Sin mes reconocible' && r.grupos.otros[1].corridas === 0 &&
       r.grupos.otros[1].ultimoSello === null,
       'el grupo "sin-fecha" rotula "Sin mes reconocible", corridas=0, ultimoSello=null');

    // (v) GUARDIA ANTI-INFLADO: los campos que la pantalla no pinta NO viajan.
    const todosLosGrupos = [].concat(r.grupos.guardado, r.grupos.shell, r.grupos.recurrentes, r.grupos.base, r.grupos.otros);
    const clavesEsperadas = 'clave,corridas,mesLabel,nFilas,otrasFilas,totales,ultimoSello';
    todosLosGrupos.forEach(function (g) {
        ok(Object.keys(g).sort().join(',') === clavesEsperadas &&
           !('filas' in g) && !('monedas' in g) && !('anio' in g) && !('sello' in g) && !('sellos' in g),
           'grupo ' + g.clave + ': claves EXACTAS del contrato nuevo (sin filas/monedas/anio/sello/sellos)');
    });

    // Los totales del grupo shell salen SOLO de sus filas (no absorben guardado ni rec).
    ok(sSep.totales.variables.length === 1 && sSep.totales.variables[0].monto === 75000,
       'los totales del grupo shell suman SOLO sus filas (30000+45000), dio ' + JSON.stringify(sSep.totales.variables));

    // La fila sin marca no aparece en ningun grupo.
    const totalFilasVistas = todosLosGrupos.reduce((a, g) => a + g.nFilas, 0);
    ok(totalFilasVistas === 11, 'la fila "sin marca" (Ruido) NUNCA se cuenta: 11 filas agrupadas de 12, dio ' + totalFilasVistas);

    // --- MUTACION 2: CASO LIMITE -- una Proyeccion SOLO con filas base ---
    const soloBase = [
        filaProy({ monto: 50000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 5, 1), nota: ctx.PB_MARCA + ' unicoSello' }),
        filaProy({ monto: 60000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 6, 1), nota: ctx.PB_MARCA + ' unicoSello' })
    ];
    activarSs([], soloBase);
    const r2 = ctx.listarPeriodosProyeccion();
    ok(Array.isArray(r2.grupos.guardado) && r2.grupos.guardado.length === 0, 'CASO LIMITE: grupos.guardado===[] exacto');
    ok(r2.grupos.shell.length === 0 && r2.grupos.recurrentes.length === 0 && r2.grupos.otros.length === 0,
       'CASO LIMITE: shell/recurrentes/otros tambien vacios (el cliente los oculta enteros)');
    ok(r2.grupos.base.length === 2, 'CASO LIMITE: grupos.base poblado y correcto (2 meses), dio ' + r2.grupos.base.length);
}

// ============================================================================
// 4. detalleFilasPeriodoProyeccion
// ============================================================================
console.log('\n=== 4. detalleFilasPeriodoProyeccion: detalle y editabilidad POR ORIGEN ===');
{
    const filas = [
        filaProy({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000', tc_ars: 1, tc_usd: 1000, tc_aud: 700, tc_eur: 1100 }),
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones' }),
        filaProy({ monto: 5000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Netflix' }),
        filaProy({ monto: 888, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: '', nota: ctx.PB_MARCA + ' selloA' })
    ];
    activarSs([], filas);

    const d = ctx.detalleFilasPeriodoProyeccion('2026-09', 'guardado');
    ok(d.filas.length === 1 && d.filas[0].cuenta === 'Sueldo', 'detalle de 2026-09/guardado: SOLO su fila (ni shell ni rec)');
    ok(d.filas[0].editable === false && d.filas[0].notaLibre === '',
       'una fila guardado YA NO es editable (2026-08-30): la marca de la nota es una afirmacion');
    ok(d.editable === false && /Presupuesto: guardar proyeccion/.test(d.motivoNoEditable),
       'y el grupo trae el motivo REACTIVO con la ruta de menu, dio: ' + d.motivoNoEditable);
    ok(d.filas[0].tcUsd === 1000, 'el detalle expone las cotizaciones congeladas (tcUsd=1000), dio ' + d.filas[0].tcUsd);
    ok(typeof d.filas[0].fecha === 'string', 'la fecha se serializa como string ISO, dio ' + typeof d.filas[0].fecha);

    const d2 = ctx.detalleFilasPeriodoProyeccion('2026-09', 'base');
    ok(d2.filas.length === 1 && d2.filas[0].editable === false, 'detalle de 2026-09/base: 1 fila, editable===false');

    // Shell: editable, con la nota libre separada (lo que identifica la fila para el usuario).
    const d3 = ctx.detalleFilasPeriodoProyeccion('2026-09', 'shell');
    ok(d3.filas.length === 1 && d3.filas[0].editable === true && d3.motivoNoEditable === '' && d3.filas[0].notaLibre === 'vacaciones',
       'detalle de 2026-09/shell: UNICO editable, sin motivo de bloqueo, notaLibre separada, dio ' + JSON.stringify({ e: d3.filas[0].editable, n: d3.filas[0].notaLibre }));

    // Recurrentes: visible pero NO editable; la notaLibre trae el nombre.
    const d4 = ctx.detalleFilasPeriodoProyeccion('2026-09', 'recurrentes');
    ok(d4.filas.length === 1 && d4.filas[0].editable === false && d4.filas[0].notaLibre === 'Netflix',
       'detalle de 2026-09/recurrentes: visible, NO editable, notaLibre = nombre, dio ' + JSON.stringify({ e: d4.filas[0].editable, n: d4.filas[0].notaLibre }));

    // 'sin-fecha' SOLO con 'otros'; con otro origen tira.
    const d5 = ctx.detalleFilasPeriodoProyeccion('sin-fecha', 'otros');
    ok(d5.filas.length === 1 && d5.mesLabel === 'Sin mes reconocible' && d5.filas[0].editable === false,
       'detalle de sin-fecha/otros: la PB sin fecha es visible y no editable, mesLabel "Sin mes reconocible"');
    let lanzo = false;
    try { ctx.detalleFilasPeriodoProyeccion('sin-fecha', 'guardado'); } catch (e) { lanzo = true; }
    ok(lanzo, 'clave "sin-fecha" con origen distinto de "otros" tira');

    const dVacio = ctx.detalleFilasPeriodoProyeccion('2099-01', 'guardado');
    ok(dVacio.filas.length === 0, 'un periodo sin ninguna fila NO tira: devuelve filas:[] (carrera con otra pestana), dio ' + dVacio.filas.length);

    lanzo = false;
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
    // base-07/08/09, guardado-09 (x2), guardado-10, shell-09 (x2), rec-09, otros-09
    const notaShell1 = ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111';
    const notaShell2 = ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones';
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 6, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 110000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 120000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProy({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProy({ monto: 480000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 9, 1), nota: ctx.PG_MARCA + ' 2026-10 2026-08-26_090000' }),
        filaProy({ monto: 30000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: notaShell1 }),
        filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: notaShell2 }),
        filaProy({ monto: 5000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Netflix' }),
        filaProy({ monto: 777, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000 retocada' })
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

    // -------- MUTACION 6 (hallazgo 3): borrar 'guardado' de 2026-09 NO arrastra el shell del
    // mismo mes, ni el rec, ni el base, ni otros periodos --------
    const rBaja1 = ctx.eliminarPeriodoProyeccion('2026-09', 'guardado');
    ok(rBaja1.filasBorradas === 2, 'baja de guardado-2026-09: 2 filas borradas (SOLO el guardado puro), dio ' + rBaja1.filasBorradas);

    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'guardado').length === 0,
       'guardado-2026-09 quedo en cero filas');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'shell').length === 2,
       'HALLAZGO 3 RESUELTO: las 2 filas shell del MISMO mes siguen intactas tras la baja del guardado');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'recurrentes').length === 1,
       'la fila de recurrentes del mismo mes sigue intacta');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'otros').length === 1,
       'la fila "otros" (nota editada a mano) del mismo mes sigue intacta');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'base').length === 1,
       'DECISION 3/coexistencia: base-2026-09 (MISMO mes, OTRO origen) sigue intacto');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-10', 'guardado').length === 1,
       'guardado-2026-10 (otro periodo) sigue intacto');
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-07', 'base').length === 1 &&
       ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-08', 'base').length === 1,
       'base-2026-07 y base-2026-08 (otros meses) siguen intactos');

    // -------- baja de 'shell' (hallazgo 4, borrable por fin) borra SOLO lo suyo y revierte --------
    const rBajaShell = ctx.eliminarPeriodoProyeccion('2026-09', 'shell');
    ok(rBajaShell.filasBorradas === 2, 'baja de shell-2026-09: 2 filas borradas, dio ' + rBajaShell.filasBorradas);
    ok(ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'recurrentes').length === 1 &&
       ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'base').length === 1 &&
       ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-10', 'guardado').length === 1,
       'la baja de shell dejo intactos rec, base y el guardado de octubre');
    const rRevShell = ctx.revertirBajaProyeccionAbm();
    ok(rRevShell.origen === 'shell' && ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'shell').length === 2,
       'revertir repone las 2 filas shell exactas');
    const notasShellVivas = ctx._leerTodasFilasPa(ssMock._hojas['Proyeccion']).map(f => f.nota);
    ok(notasShellVivas.indexOf(notaShell1) !== -1 && notasShellVivas.indexOf(notaShell2) !== -1,
       'las notas shell repuestas son IDENTICAS (nota libre incluida)');

    // -------- baja de 'otros' (hallazgo 4): funciona y el revert repone --------
    const rBajaOtros = ctx.eliminarPeriodoProyeccion('2026-09', 'otros');
    ok(rBajaOtros.filasBorradas === 1 && ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'otros').length === 0,
       'baja de otros-2026-09: la nota irreconocible se puede borrar por mes');
    const rRevOtros = ctx.revertirBajaProyeccionAbm();
    ok(rRevOtros.origen === 'otros' && ctx._filasDelPeriodoPa(ssMock._hojas['Proyeccion'], '2026-09', 'otros').length === 1,
       'y su revert tambien repone exacto');

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

    // -------- (x) LA BAJA DE 'recurrentes' DEPENDE DE LA VENTANA (2026-08-30) --------
    // Dentro del horizonte NO se borra: la proxima sincronizacion lo repone sola y un borrado
    // que se deshace solo es una trampa. Fuera del horizonte SI: es historia congelada y este
    // ABM es la unica via de limpiarla. Las dos claves se DERIVAN de _clavesVentanaRec (nunca
    // se tipean: un banco con su propia copia de la ventana miente cuando pasa el tiempo).
    {
        const ventana = ctx._clavesVentanaRec();
        const claveDentro = ventana[0];
        const claveFuera = '2020-01';   // siempre pasada: jamas puede caer en la ventana
        ok(ventana.length === ctx.REC_HORIZONTE_MESES,
           'la ventana tiene REC_HORIZONTE_MESES claves, dio ' + ventana.length);
        ok(ventana.indexOf(claveFuera) === -1, '"' + claveFuera + '" esta FUERA de la ventana, como se necesita');

        const notaRecDentro = ctx.REC_MARCA + ' ' + claveDentro + ' 2026-08-21_090000 - Netflix';
        const notaRecFuera = ctx.REC_MARCA + ' ' + claveFuera + ' 2026-08-21_090000 - Netflix';
        const fDentro = ctx._fechaDesdeClavePa(claveDentro);
        const ssV = activarSs([], [
            filaProy({ monto: 5000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: fDentro, nota: notaRecDentro }),
            filaProy({ monto: 4000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2020, 0, 1), nota: notaRecFuera })
        ]);
        const hojaV = ssV._hojas['Proyeccion'];

        let lanzoV = false, msgV = '';
        try { ctx.eliminarPeriodoProyeccion(claveDentro, 'recurrentes'); } catch (e) { lanzoV = true; msgV = e.message; }
        ok(lanzoV && /Gastos recurrentes/.test(msgV) && /pausalo o ponele fecha de fin/.test(msgV),
           'un mes de recurrentes DENTRO de la ventana se rechaza nombrando donde se corrige, dio: ' + msgV);
        ok(ctx._filasDelPeriodoPa(hojaV, claveDentro, 'recurrentes').length === 1,
           'y la fila sigue ahi: el gate corta ANTES de respaldar y borrar');
        ok(ssV.insertSheetLlamadas === 0, 'el rechazo no crea ninguna hoja');

        const rFuera = ctx.eliminarPeriodoProyeccion(claveFuera, 'recurrentes');
        ok(rFuera.filasBorradas === 1 && ctx._filasDelPeriodoPa(hojaV, claveFuera, 'recurrentes').length === 0,
           'un mes de recurrentes FUERA de la ventana SI se borra (historia congelada)');
        const rRevFuera = ctx.revertirBajaProyeccionAbm();
        ok(rRevFuera.origen === 'recurrentes' && ctx._filasDelPeriodoPa(hojaV, claveFuera, 'recurrentes').length === 1,
           'y su revert repone la fila exacta');

        // El gate tambien vale en el detalle, para que el cliente pueda esconder el boton.
        const detDentro = ctx.detalleFilasPeriodoProyeccion(claveDentro, 'recurrentes');
        ok(/Gastos recurrentes/.test(detDentro.bajaBloqueada), 'el detalle del mes dentro de la ventana trae bajaBloqueada');
        const detFuera = ctx.detalleFilasPeriodoProyeccion(claveFuera, 'recurrentes');
        ok(detFuera.bajaBloqueada === '', 'el detalle del mes fuera de la ventana NO trae bajaBloqueada');
        // Los otros cuatro origenes nunca se bloquean por ventana.
        ok(ctx._motivoBajaBloqueadaPa(claveDentro, 'shell') === '' &&
           ctx._motivoBajaBloqueadaPa(claveDentro, 'guardado') === '' &&
           ctx._motivoBajaBloqueadaPa(claveDentro, 'base') === '' &&
           ctx._motivoBajaBloqueadaPa(claveDentro, 'otros') === '',
           'la ventana solo bloquea la baja de recurrentes, no la de los otros cuatro origenes');
    }

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

    // -------- (ix) RESPALDO LEGADO MIXTO: una baja 'guardado' PRE-CAMBIO arrastro filas shell.
    // El revert repone el respaldo ENTERO y verifica contra la clasificacion DEL RESPALDO, no
    // contra previos.filas: si comparara contra previos.filas, fallaria en falso con las filas
    // ya repuestas. --------
    {
        const notaMixShell = ctx.PG_MARCA + ' 2026-11 shell_2026-08-27_100000333 mezclada';
        const notaMixPg = ctx.PG_MARCA + ' 2026-11 2026-08-25_150000';
        const filasMix = [
            filaProy({ monto: 1000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 10, 1), nota: notaMixPg }),
            filaProy({ monto: 2000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 10, 1), nota: notaMixShell })
        ];
        const ssMock2 = activarSs([], filasMix);
        const hojaProy2 = ssMock2._hojas['Proyeccion'];
        const cfg2 = ctx.RANGES.REGISTROS;
        // Se simula la baja legada: respaldo de AMBAS filas (guardado + shell juntas, como
        // hacia la version anterior) y borrado de ambas, con el registro origen='guardado'.
        const filasAmbas = [cfg2.dataRow, cfg2.dataRow + 1];
        // Respaldo del formato LEGADO, armado a mano: una HOJA con 'fila_original'/'valores_json'
        // y la propiedad apuntando por el campo `respaldo`. Es el estado que la planilla puede
        // tener al momento del deploy; si el lector nuevo no lo entiende, el unico deshacer que
        // existe se rompe EN SILENCIO.
        const nombreLegado = ctx.PA_PREFIJO_RESPALDO + '2026-08-29_090000';
        const hojaLegado = ssActual.insertSheet(nombreLegado);
        const colIniL = ctx.columnLetterToIndex(cfg2.start);
        const anchoL = ctx.columnLetterToIndex(cfg2.end) - colIniL + 1;
        hojaLegado.getRange(1, 1, 1, 2).setValues([['fila_original', 'valores_json']]);
        hojaLegado.getRange(2, 1, filasAmbas.length, 2).setValues(filasAmbas.map(function (f) {
            const vals = hojaProy2.getRange(f, colIniL, 1, anchoL).getValues()[0];
            return [f, JSON.stringify(vals.map(v => v instanceof Date ? { __fecha__: v.toISOString() } : v))];
        }));
        ctx._borrarGeneradasPb(hojaProy2, filasAmbas);
        propsActual.setProperty(ctx.PA_PROP_PREVIOS_BAJA, JSON.stringify({
            respaldo: nombreLegado, clave: '2026-11', origen: 'guardado', filas: 2
        }));
        const rLegado = ctx.revertirBajaProyeccionAbm();
        ok(rLegado.filasRepuestas === 2, 'CAMINO LEGADO: un respaldo del formato viejo (HOJA + campo `respaldo`) se lee y se repone ENTERO (2 filas), dio ' + rLegado.filasRepuestas);
        ok(ctx._filasDelPeriodoPa(hojaProy2, '2026-11', 'guardado').length === 1 &&
           ctx._filasDelPeriodoPa(hojaProy2, '2026-11', 'shell').length === 1,
           'las dos filas volvieron, cada una clasificando a su origen -- sin falso error de verificacion');
    }
}

// ============================================================================
// 6. actualizarMontoFilaProyeccion / revertirEdicionMontoProyeccion
// ============================================================================
console.log('\n=== 6. actualizarMontoFilaProyeccion y revertirEdicionMontoProyeccion ===');
{
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones' }),
        filaProy({ monto: 5000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Netflix' }),
        filaProy({ monto: 777, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000 retocada' })
    ];
    const ssMock = activarSs([], filas);
    const cfg = ctx.RANGES.REGISTROS;
    const filaBase = cfg.dataRow;          // primera fila de datos: la de PB_MARCA
    const filaGuardado = cfg.dataRow + 1;  // guardado PG puro
    const filaShell = cfg.dataRow + 2;     // puntual del shell
    const filaRec = cfg.dataRow + 3;       // volcado de recurrentes
    const filaOtros = cfg.dataRow + 4;     // nota editada a mano ('otros')

    // -------- MUTACION 9: editar una fila PB_MARCA -- tira, NO escribe --------
    let lanzo = false, msg = '';
    try { ctx.actualizarMontoFilaProyeccion(filaBase, 999); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('presupuesto base') !== -1, 'editar una fila base tira con mensaje explicito, dio: ' + msg);
    const montoBaseTrasIntento = ssMock._hojas['Proyeccion'].getRange(ctx.RANGES.REGISTROS.dataRow,
        ctx.columnLetterToIndex(cfg.columns.monto)).getValue();
    ok(montoBaseTrasIntento === 100000, 'el monto de la fila base SIGUE en 100000 (no se escribio nada), dio ' + montoBaseTrasIntento);

    // -------- MUTACION 9-bis (2026-08-30): 'guardado' DEJA de editarse --------
    // Mismo argumento con el que ya se bloqueaba 'base': la marca de la Nota es una AFIRMACION
    // y no puede quedar en pie con un valor que ya no la cumple.
    lanzo = false; msg = '';
    try { ctx.actualizarMontoFilaProyeccion(filaGuardado, 250000); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('hoja Presupuesto') !== -1,
       'editar una fila guardado tira nombrando la hoja Presupuesto, dio: ' + msg);
    const colMonto = ctx.columnLetterToIndex(cfg.columns.monto);
    ok(ssMock._hojas['Proyeccion'].getRange(filaGuardado, colMonto).getValue() === 200000,
       'y el monto guardado SIGUE en 200000: el gate corta del lado del SERVIDOR, aunque el cliente mande la edicion');

    // -------- MUTACION 11: nuevoMonto no numerico -- tira, no escribe, para CADA variante --------
    [NaN, '', 'abc', null, undefined, '   '].forEach(valorMalo => {
        let lanzoMal = false;
        try { ctx.actualizarMontoFilaProyeccion(filaShell, valorMalo); } catch (e) { lanzoMal = true; }
        ok(lanzoMal, 'nuevoMonto=' + JSON.stringify(valorMalo) + ' tira (incluida la trampa Number("")===0)');
    });
    const montoShellTrasIntentosMalos = ssMock._hojas['Proyeccion'].getRange(filaShell, colMonto).getValue();
    ok(montoShellTrasIntentosMalos === 45000, 'tras los 6 intentos invalidos, el monto SIGUE en 45000 (ninguno escribio), dio ' + montoShellTrasIntentosMalos);

    // -------- MUTACION 10: editar la fila shell -- escribe, verifica, y revierte exacto --------
    const rEdit = ctx.actualizarMontoFilaProyeccion(filaShell, 50000);
    ok(rEdit.origen === 'shell' && rEdit.montoAnterior === 45000 && rEdit.montoNuevo === 50000 &&
       rEdit.clave === '2026-09',
       'la UNICA poblacion editable (shell) se edita y devuelve origen/montoAnterior/montoNuevo/clave, dio ' + JSON.stringify(rEdit));
    const montoTrasEditar = ssMock._hojas['Proyeccion'].getRange(filaShell, colMonto).getValue();
    ok(montoTrasEditar === 50000, 'el monto releido de la hoja es 50000, dio ' + montoTrasEditar);
    ok(ssMock.insertSheetLlamadas === 0,
       'HOJA AUXILIAR: editar un monto NO crea ni una hoja (antes creaba una por edicion), dio ' + ssMock.insertSheetLlamadas);

    const rRevertEdit = ctx.revertirEdicionMontoProyeccion();
    ok(rRevertEdit.fila === filaShell && rRevertEdit.montoRestaurado === 45000,
       'revertirEdicionMontoProyeccion devuelve la fila y el monto restaurado (45000), dio ' + JSON.stringify(rRevertEdit));
    const montoTrasRevertir = ssMock._hojas['Proyeccion'].getRange(filaShell, colMonto).getValue();
    ok(montoTrasRevertir === 45000, 'el monto releido tras revertir es EXACTO al original (45000), dio ' + montoTrasRevertir);

    // revertir de nuevo (sin edicion pendiente) tira.
    lanzo = false;
    try { ctx.revertirEdicionMontoProyeccion(); } catch (e) { lanzo = true; }
    ok(lanzo, 'revertirEdicionMontoProyeccion sin edicion previa tira');

    // -------- (viii) los otros tres origenes, cada uno con SU lugar de correccion --------
    lanzo = false; msg = '';
    try { ctx.actualizarMontoFilaProyeccion(filaRec, 9999); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('Gastos recurrentes') !== -1 && msg.indexOf('se actualiza sola') !== -1,
       'una fila de recurrentes se rechaza apuntando a Gastos recurrentes, dio: ' + msg);
    ok(ssMock._hojas['Proyeccion'].getRange(filaRec, colMonto).getValue() === 5000,
       'el monto del recurrente sigue en 5000 (no se escribio nada)');

    lanzo = false; msg = '';
    try { ctx.actualizarMontoFilaProyeccion(filaOtros, 9999); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && msg.indexOf('No se reconoce el origen') !== -1,
       'una fila "otros" (nota editada a mano) se rechaza con su mensaje propio, dio: ' + msg);

    // -------- LAS RUTAS DE MENU DE LOS MENSAJES SALEN DE MENU_CONFIG, no de una copia --------
    {
        const rutas = [];
        const recorrer = function (items, camino) {
            (items || []).forEach(function (it) {
                if (it.submenu) { recorrer(it.items, camino.concat([it.submenu])); return; }
                if (it.name) rutas.push(camino.concat([it.name]).join(' > '));
            });
        };
        recorrer(ctx.MENU_CONFIG.DEV_ITEMS, [ctx.MENU_CONFIG.DEV_MENU]);
        ok(rutas.indexOf('tidetrack Dev > Presupuesto: guardar proyeccion > 2. Aplicar') !== -1,
           'la ruta del mensaje de "guardado" existe TAL CUAL en MENU_CONFIG');
        ok(ctx.PA_MSJ_NO_EDITABLE.guardado.indexOf('tidetrack Dev > Presupuesto: guardar proyeccion > 2. Aplicar') !== -1,
           'y el mensaje la nombra literal, sin parafrasear');
        ok(rutas.some(r => r.indexOf('tidetrack Dev > Presupuesto base (desde el historial)') === 0),
           'el submenu del presupuesto base existe TAL CUAL en MENU_CONFIG');
        ok(ctx.PA_MSJ_NO_EDITABLE.base.indexOf('tidetrack Dev > Presupuesto base (desde el historial)') !== -1,
           'y el mensaje de "base" lo nombra literal');
        ok(ctx.PA_MSJ_NO_EDITABLE.recurrentes.indexOf('Gastos recurrentes') !== -1 &&
           ctx.MENU_CONFIG.ITEMS.some(it => it.name === 'Gastos recurrentes'),
           'el mensaje de "recurrentes" nombra el item de menu "Gastos recurrentes", que existe');
    }

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

// -------- MUTACION 12 (2026-08-30): LA PLANILLA SE MOVIO ENTRE LA EDICION Y EL DESHACER -------
// Escenario propio (activarSs nuevo) porque BORRA una fila y correria los indices del resto.
// El camino de uso que lo provoca es normal: corrijo un monto en Proyecciones Elaboradas, paso a
// Gastos recurrentes, guardo uno -- eso dispara la fase 2, que borra y reescribe hasta
// REC_HORIZONTE_MESES meses de filas REC via _borrarFilasRec -- vuelvo y toco Deshacer.
// Antes del guard, el deshacer escribia en el NUMERO DE FILA guardado sin comprobar nada: pisaba
// el monto de la fila del presupuesto base, dejaba la editada sin revertir, devolvia exito y
// ademas borraba el respaldo, o sea que no quedaba con que reponer.
{
    const cfg = ctx.RANGES.REGISTROS;
    const colMonto = ctx.columnLetterToIndex(cfg.columns.monto);
    // El orden importa: una fila ARRIBA de la editada (la que se borra) y otra ABAJO (la que
    // termina ocupando el numero de fila guardado). Sin la de abajo, el deshacer caeria en una
    // fila vacia y el escenario no demostraria lo grave: que pisaba una fila del presupuesto
    // base, justo una de las poblaciones que este ABM se niega a dejar editar.
    const filas = [
        filaProy({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', medio: '', moneda: 'ARS', fecha: new Date(2026, 7, 1), nota: ctx.PB_MARCA + ' selloA' }),
        filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones' }),
        filaProy({ monto: 70000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PB_MARCA + ' selloB' })
    ];
    const ssMock = activarSs([], filas);
    const filaBase = cfg.dataRow;
    const filaShell = cfg.dataRow + 1;

    const rEdit = ctx.actualizarMontoFilaProyeccion(filaShell, 50000);
    ok(rEdit.montoAnterior === 45000 && rEdit.montoNuevo === 50000,
       'MUTACION 12: se edita la fila shell (45000 -> 50000) para montar el escenario');

    // El deleteRows exacto que hace _borrarFilasRec en cada sincronizacion: todo lo de abajo sube
    // un renglon y la fila guardada en la propiedad pasa a apuntar a OTRA fila.
    ssMock._hojas['Proyeccion'].deleteRows(filaBase, 1);
    const notaEnLaFilaVieja = String(ssMock._hojas['Proyeccion']
        .getRange(filaShell, ctx.columnLetterToIndex(cfg.columns.nota)).getValue());
    ok(notaEnLaFilaVieja.indexOf(ctx.PB_MARCA) === 0,
       'tras el deleteRows la fila ' + filaShell + ' es una fila del PRESUPUESTO BASE, no la editada: "' + notaEnLaFilaVieja + '"');

    const montosAntes = [filaBase, filaShell].map(f => ssMock._hojas['Proyeccion'].getRange(f, colMonto).getValue());
    let lanzoIdent = false, msgIdent = '';
    try { ctx.revertirEdicionMontoProyeccion(); } catch (e) { lanzoIdent = true; msgIdent = e.message; }
    ok(lanzoIdent && /ya no es la que se edito/.test(msgIdent),
       'el deshacer LANZA nombrando el desvio en vez de escribir a ciegas, dio: ' + msgIdent);

    const montosDespues = [filaBase, filaShell].map(f => ssMock._hojas['Proyeccion'].getRange(f, colMonto).getValue());
    ok(JSON.stringify(montosAntes) === JSON.stringify(montosDespues),
       'y NO escribio una sola celda: los montos siguen ' + JSON.stringify(montosDespues) +
       ' (eran ' + JSON.stringify(montosAntes) + ')');
    ok(montosDespues[1] === 70000,
       'en particular la fila base que quedo en el numero guardado conserva sus 70000: el deshacer no la piso');
    ok(montosDespues[0] === 50000,
       'y la fila editada de verdad sigue en 50000: quedo sin revertir, pero VISIBLE y con su respaldo');

    // Y no se llevo puestas las herramientas para reintentar: un deshacer que falla y ademas
    // borra el respaldo deja al usuario sin salida.
    const previosVivos = propsActual.getProperty(ctx.PA_PROP_PREVIOS_EDICION);
    ok(!!previosVivos, 'la propiedad de la edicion pendiente NO se borro: se puede reintentar');
    let respaldoVivo = [];
    try { respaldoVivo = ctx.leerRespaldoFilas(ssMock, JSON.parse(previosVivos).token); } catch (e) { respaldoVivo = []; }
    ok(respaldoVivo.length === 1,
       'y el respaldo sigue guardado (' + respaldoVivo.length + ' fila): el usuario conserva con que reponer a mano');

    // CONTROL EN LA OTRA DIRECCION: sin corrimiento, el deshacer sigue funcionando. Un guard que
    // se pone rojo en estado sano seria tan malo como el defecto que cierra.
    const filasOk = [filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones' })];
    const ssSano = activarSs([], filasOk);
    ctx.actualizarMontoFilaProyeccion(cfg.dataRow, 50000);
    const rSano = ctx.revertirEdicionMontoProyeccion();
    ok(rSano.montoRestaurado === 45000 &&
       ssSano._hojas['Proyeccion'].getRange(cfg.dataRow, colMonto).getValue() === 45000,
       'sin corrimiento el deshacer sigue reponiendo exacto (45000): el guard no dispara en estado sano');
}

// ============================================================================
// 7. pingProyeccionAbm -- experimento de aislamiento del canal google.script.run (v0.57.0)
// ============================================================================
console.log('\n=== 7. pingProyeccionAbm ===');
{
    // Sin ninguna spreadsheet activa (ssActual null, la anterior seccion no la dejo puesta):
    // si pingProyeccionAbm tocara SpreadsheetApp de cualquier forma, esto ya explotaria.
    ssActual = null;

    // La huella del ping SI se prueba: se le da un almacen de mentira y se verifica que la selle.
    // Es la pieza que biseca ida vs vuelta, asi que un banco que la esquivara dejaria sin cubrir
    // justo el instrumento del que va a depender el diagnostico.
    const almacen = {};
    propsActual = {
        setProperty: function (k, v) { almacen[k] = v; return this; },
        getProperty: function (k) { return Object.prototype.hasOwnProperty.call(almacen, k) ? almacen[k] : null; },
        deleteProperty: function (k) { delete almacen[k]; return this; },
        getKeys: function () { return Object.keys(almacen); }
    };

    const r1 = ctx.pingProyeccionAbm();
    ok(typeof almacen['ping_abm_ultimo'] === 'string' && Number(almacen['ping_abm_ultimo']) > 0,
       'sella la huella "ping_abm_ultimo" al entrar (dio ' + JSON.stringify(almacen['ping_abm_ultimo']) + ')');

    // Y si el almacen falla, el ping tiene que responder IGUAL: el instrumento no rompe lo que mide.
    propsActual = { setProperty: function () { throw new Error('almacen caido'); } };
    const rSinAlmacen = ctx.pingProyeccionAbm();
    ok(rSinAlmacen && rSinAlmacen.mensaje === 'pong',
       'con el almacen caido el ping responde igual, no se lleva puesto el canal que esta midiendo');
    propsActual = {
        setProperty: function (k, v) { almacen[k] = v; return this; },
        getProperty: function (k) { return Object.prototype.hasOwnProperty.call(almacen, k) ? almacen[k] : null; },
        deleteProperty: function (k) { delete almacen[k]; return this; },
        getKeys: function () { return Object.keys(almacen); }
    };

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
// 8. LA BOVEDA DE RESPALDOS (18_RespaldoService.js): CERO HOJAS EN EL CAMINO DIARIO
// ============================================================================
// La queja de Franco, medida: al editar un monto aparecia una pestania "Respaldo proyeccion abm
// <sello>", el grid de fondo saltaba a esa hoja y el foco no volvia. El mock cuenta las llamadas
// a insertSheet y registra el ORDEN de setActiveSheet / hideSheet / escrituras, asi que estas
// pruebas miden el HECHO (cuantas hojas se crearon, en que orden), no un mensaje.
console.log('\n=== 8. Boveda de respaldos: el respaldo deja de crear una hoja ===');
{
    const cfg = ctx.RANGES.REGISTROS;
    const colMonto = ctx.columnLetterToIndex(cfg.columns.monto);
    const notaShell = ctx.PG_MARCA + ' 2026-09 shell_2026-08-28_110000222 vacaciones';

    // -------- 8.1 editar un monto: CERO insertSheet --------
    // PROBADO EN ROJO contra el codigo anterior: con _respaldarFilasPa creando la hoja, esto
    // daba 1 y la prueba fallaba. Si pasara en verde contra el codigo viejo, no mediria nada.
    {
        const ssM = activarSs([], [filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: notaShell })]);
        ctx.actualizarMontoFilaProyeccion(cfg.dataRow, 50000);
        ok(ssM.insertSheetLlamadas === 0, '8.1 editar un monto crea CERO hojas, dio ' + ssM.insertSheetLlamadas);
        ok(ssM._traza.length === 0, '8.1 y no hay una sola operacion de hoja nueva en la traza');
        ok(ssM._activa() === ssM._hojas['Proyeccion'], '8.1 la hoja activa no cambio');

        // 8.2 roundtrip exacto con el respaldo en PROPIEDADES (no en una hoja).
        const previos = JSON.parse(propsActual.getProperty(ctx.PA_PROP_PREVIOS_EDICION));
        ok(typeof previos.token === 'string' && previos.token.length > 0 && previos.respaldo === undefined,
           '8.2 la propiedad de la edicion guarda un TOKEN, ya no un nombre de hoja: ' + JSON.stringify(previos));
        ok(propsActual.getProperty(ctx._claveIndiceResp(previos.token)) !== null,
           '8.2 y existe el indice "' + ctx._claveIndiceResp(previos.token) + '" en propiedades');
        const rRev = ctx.revertirEdicionMontoProyeccion();
        ok(rRev.montoRestaurado === 45000 &&
           ssM._hojas['Proyeccion'].getRange(cfg.dataRow, colMonto).getValue() === 45000,
           '8.2 revertir repone el VALOR exacto (45000) leyendo el respaldo de propiedades');
        ok(propsActual.getProperty(ctx._claveIndiceResp(previos.token)) === null,
           '8.2 y el respaldo se retira despues del revert: la boveda no crece sola');
    }

    // -------- 8.3 baja de un periodo de 64 filas (el grupo mas grande medido en la Proyeccion
    // real de Franco): cero hojas, respaldo troceado, revert exacto --------
    {
        const filas64 = [];
        for (let i = 0; i < 64; i++) {
            filas64.push(filaProy({ monto: 1000 + i, tipo: 'Egreso', cuenta: 'Alquiler departamento',
                tipo_cuenta: 'Gasto Fijo', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1),
                nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }));
        }
        const ssM = activarSs([], filas64);
        const hojaP = ssM._hojas['Proyeccion'];
        const antes = ctx._filasDelPeriodoPa(hojaP, '2026-09', 'guardado').map(f => filaCompletaPorNumero(ssM, f));

        const rBaja = ctx.eliminarPeriodoProyeccion('2026-09', 'guardado');
        ok(rBaja.filasBorradas === 64 && ssM.insertSheetLlamadas === 0,
           '8.3 borrar 64 filas crea CERO hojas, dio ' + ssM.insertSheetLlamadas);
        const token = JSON.parse(propsActual.getProperty(ctx.PA_PROP_PREVIOS_BAJA)).token;
        const ix = JSON.parse(propsActual.getProperty(ctx._claveIndiceResp(token)));
        ok(ix.nFilas === 64 && ix.nTrozos === 2 && ix.medio === 'props' && ix.contexto === 'proyeccion-abm',
           '8.3 el respaldo quedo troceado en 2 propiedades de hasta ' + ctx.RESP_FILAS_POR_TROZO +
           ' filas, dio ' + JSON.stringify({ n: ix.nFilas, t: ix.nTrozos, m: ix.medio }));

        ctx.revertirBajaProyeccionAbm();
        const despues = ctx._filasDelPeriodoPa(hojaP, '2026-09', 'guardado').map(f => filaCompletaPorNumero(ssM, f));
        ok(despues.length === 64, '8.3 el revert repone las 64 filas, dio ' + despues.length);
        let idenNo = 0;
        const idxFecha = ctx.columnLetterToIndex(cfg.columns.fecha) - ctx.columnLetterToIndex(cfg.start);
        for (let i = 0; i < 64; i++) {
            for (let j = 0; j < antes[i].length; j++) {
                const a = antes[i][j], b = despues[i][j];
                const igual = (j === idxFecha)
                    ? (a instanceof Date && b instanceof Date && a.getTime() === b.getTime())
                    : (a === b);
                if (!igual) idenNo++;
            }
        }
        ok(idenNo === 0, '8.3 las 64 filas repuestas son IDENTICAS celda por celda (fechas incluidas), desvios: ' + idenNo);
    }

    // -------- 8.4 el borde del troceado: 40 filas = 1 trozo, 41 = 2 --------
    {
        const armar = (n) => {
            const fs2 = [];
            for (let i = 0; i < n; i++) {
                fs2.push(filaProy({ monto: 100 + i, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable',
                    medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }));
            }
            const ssM = activarSs([], fs2);
            const filas = ctx._filasDelPeriodoPa(ssM._hojas['Proyeccion'], '2026-09', 'guardado');
            const r = ctx.guardarRespaldoFilas(ssM, ssM._hojas['Proyeccion'], filas, 'sello_' + n, 'proyeccion-abm');
            return { ssM: ssM, ix: JSON.parse(propsActual.getProperty(ctx._claveIndiceResp(r.token))), token: r.token, medio: r.medio };
        };
        const r40 = armar(ctx.RESP_FILAS_POR_TROZO);
        ok(r40.ix.nTrozos === 1, '8.4 ' + ctx.RESP_FILAS_POR_TROZO + ' filas = 1 trozo, dio ' + r40.ix.nTrozos);
        const r41 = armar(ctx.RESP_FILAS_POR_TROZO + 1);
        ok(r41.ix.nTrozos === 2, '8.4 ' + (ctx.RESP_FILAS_POR_TROZO + 1) + ' filas = 2 trozos, dio ' + r41.ix.nTrozos);

        // 8.5 NINGUN trozo supera el tope por propiedad. Se mide el largo del string REALMENTE
        // guardado en el almacen, no un estimado.
        let mayor = 0;
        for (let i = 0; i < r41.ix.nTrozos; i++) {
            mayor = Math.max(mayor, propsActual.getProperty(ctx._claveTrozoResp(r41.token, i)).length);
        }
        ok(mayor <= ctx.RESP_TOPE_CARACTERES_TROZO,
           '8.5 el trozo mas grande realmente guardado mide ' + mayor + ' caracteres (tope ' +
           ctx.RESP_TOPE_CARACTERES_TROZO + ')');
    }

    // -------- 8.6 escritura atomica: si muere a mitad, NO queda indice ni trozos sueltos --------
    // Matiz declarado: cuando las propiedades fallan, el modulo NO se rinde -- pasa el respaldo
    // entero a la boveda y lo LOGUEA (mismo criterio que la Regla Estricta 9 con el fallback de
    // cotizaciones). Lo que se prueba aca es el invariante de atomicidad: en propiedades no queda
    // NADA a medias. La parte "y entonces no se toca la Proyeccion" se prueba abajo, cortando
    // tambien la boveda.
    {
        const fs3 = [];
        for (let i = 0; i < 45; i++) {
            fs3.push(filaProy({ monto: 100 + i, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable',
                medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }));
        }
        const ssM = activarSs([], fs3);
        const hojaP = ssM._hojas['Proyeccion'];
        const filas = ctx._filasDelPeriodoPa(hojaP, '2026-09', 'guardado');

        const setReal = propsActual.setProperty;
        propsActual.setProperty = function (k, v) {
            if (k === ctx._claveTrozoResp('sello_atomico', 1)) throw new Error('almacen lleno');
            return setReal(k, v);
        };
        const r = ctx.guardarRespaldoFilas(ssM, hojaP, filas, 'sello_atomico', 'proyeccion-abm');
        propsActual.setProperty = setReal;

        ok(propsActual.getProperty(ctx._claveIndiceResp('sello_atomico')) === null,
           '8.6 si un trozo no se pudo escribir, NO queda indice: sin indice, el respaldo se considera inexistente');
        const sueltas = propsActual.getKeys().filter(k => k.indexOf(ctx.RESP_PROP_PREFIJO + 'sello_atomico_') === 0);
        ok(sueltas.length === 0, '8.6 y no queda ningun trozo suelto en propiedades, dio ' + sueltas.length);
        ok(r.medio === 'boveda', '8.6 el respaldo cayo entero a la boveda (fallback declarado y logueado), dio ' + r.medio);
        ok(ctx.leerRespaldoFilas(ssM, 'sello_atomico').length === 45,
           '8.6 y desde la boveda se relee completo: 45 filas');

        // Ahora SI el caso terminal: propiedades rotas Y la boveda imposible de crear. El
        // respaldo lanza, y eliminarPeriodoProyeccion no toca una sola fila de la Proyeccion.
        const ssM2 = activarSs([], fs3);
        const hojaP2 = ssM2._hojas['Proyeccion'];
        const antes2 = ctx._filasDelPeriodoPa(hojaP2, '2026-09', 'guardado').length;
        const setReal2 = propsActual.setProperty;
        propsActual.setProperty = function () { throw new Error('almacen lleno'); };
        ssM2.insertSheet = function () { throw new Error('no se puede crear la boveda'); };
        let lanzo8 = false;
        try { ctx.eliminarPeriodoProyeccion('2026-09', 'guardado'); } catch (e) { lanzo8 = true; }
        propsActual.setProperty = setReal2;
        ok(lanzo8, '8.6 sin ningun soporte para el respaldo, la baja LANZA');
        ok(ctx._filasDelPeriodoPa(hojaP2, '2026-09', 'guardado').length === antes2,
           '8.6 y la Proyeccion quedo intacta: ' + antes2 + ' filas, las mismas que antes');
    }

    // -------- 8.7 CAMINO LEGADO en la edicion de monto (el de la baja ya se probo en la 5) ----
    {
        const ssM = activarSs([], [filaProy({ monto: 45000, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable', medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: notaShell })]);
        const hojaP = ssM._hojas['Proyeccion'];
        const colIni = ctx.columnLetterToIndex(cfg.start);
        const ancho = ctx.columnLetterToIndex(cfg.end) - colIni + 1;
        const nombreLegado = ctx.PA_PREFIJO_RESPALDO + '2026-08-29_101010';
        const hojaLegado = ssM.insertSheet(nombreLegado);
        hojaLegado.getRange(1, 1, 1, 2).setValues([['fila_original', 'valores_json']]);
        hojaLegado.getRange(2, 1, 1, 2).setValues([[cfg.dataRow,
            JSON.stringify(hojaP.getRange(cfg.dataRow, colIni, 1, ancho).getValues()[0]
                .map(v => v instanceof Date ? { __fecha__: v.toISOString() } : v))]]);
        // La planilla ya tenia el monto cambiado y la propiedad VIEJA apuntando a esa hoja.
        hojaP.getRange(cfg.dataRow, colMonto).setValue(99999);
        propsActual.setProperty(ctx.PA_PROP_PREVIOS_EDICION, JSON.stringify({
            respaldo: nombreLegado, fila: cfg.dataRow, montoAnterior: 45000, montoNuevo: 99999
        }));
        const rLeg = ctx.revertirEdicionMontoProyeccion();
        ok(rLeg.montoRestaurado === 45000 && hojaP.getRange(cfg.dataRow, colMonto).getValue() === 45000,
           '8.7 una edicion pendiente del formato VIEJO (campo `respaldo` = hoja) se revierte igual: el deploy no rompe el deshacer');
    }

    // -------- 8.8 mas de RESP_TOPE_PROPS filas -> boveda, creada UNA sola vez --------
    {
        const n = ctx.RESP_TOPE_PROPS + 1;
        const fs4 = [];
        for (let i = 0; i < n; i++) {
            fs4.push(filaProy({ monto: 10 + i, tipo: 'Egreso', cuenta: 'Comidas', tipo_cuenta: 'Gasto Variable',
                medio: '', moneda: 'ARS', fecha: new Date(2026, 8, 1), nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }));
        }
        const ssM = activarSs([], fs4);
        const hojaP = ssM._hojas['Proyeccion'];
        const filas = ctx._filasDelPeriodoPa(hojaP, '2026-09', 'guardado');

        const r1 = ctx.guardarRespaldoFilas(ssM, hojaP, filas, 'sello_grande_1', 'proyeccion-abm');
        ok(r1.medio === 'boveda' && r1.filas === n,
           '8.8 ' + n + ' filas (mas de RESP_TOPE_PROPS=' + ctx.RESP_TOPE_PROPS + ') van a la boveda, dio ' + r1.medio);
        ok(ssM.insertSheetLlamadas === 1, '8.8 la boveda se crea UNA vez, dio ' + ssM.insertSheetLlamadas);
        ok(!!ssM._hojas[ctx.SHEETS.RESPALDOS] && ssM._hojas[ctx.SHEETS.RESPALDOS]._oculta === true,
           '8.8 y queda oculta');
        ok(propsActual.getProperty(ctx._claveIndiceResp('sello_grande_1')) === null,
           '8.8 un respaldo de boveda no deja indice en propiedades');

        const r2 = ctx.guardarRespaldoFilas(ssM, hojaP, filas, 'sello_grande_2', 'proyeccion-abm');
        ok(r2.medio === 'boveda' && ssM.insertSheetLlamadas === 1,
           '8.8 una SEGUNDA operacion de mas de ' + ctx.RESP_TOPE_PROPS + ' filas NO vuelve a crear la hoja: se reusa, dio ' +
           ssM.insertSheetLlamadas + ' llamada(s) en total');

        ok(ctx.leerRespaldoFilas(ssM, 'sello_grande_1').length === n,
           '8.8 leer por token devuelve SOLO las filas de ese token (' + n + ')');
        ctx.borrarRespaldoFilas(ssM, 'sello_grande_1');
        ok(ctx.leerRespaldoFilas(ssM, 'sello_grande_2').length === n,
           '8.8 borrar un token no se lleva puesto el otro');
        ok(!!ssM._hojas[ctx.SHEETS.RESPALDOS],
           '8.8 y borrar por token NUNCA borra la boveda: se borran FILAS, no la hoja');
    }

    // -------- 8.9 EL ORDEN de la unica creacion: foco repuesto y hideSheet ANTES de escribir --
    // Es un test de ORDEN, no de resultado: lo que hacia visible la hoja era escribir (y por lo
    // tanto vaciar al cliente) con la hoja todavia activa y visible.
    {
        const ssM = activarSs([], []);
        const antesActiva = ssM._activa();
        ctx._conHojaActivaPreservada(ssM, 'Hoja de prueba', function (h) {
            h.getRange(2, 2).setValue('titulo');
        });
        const t = ssM._traza;
        const iInsert = t.indexOf('insertSheet');
        const iFoco = t.indexOf('setActiveSheet');
        const iHide = t.indexOf('hideSheet');
        const iEscribir = t.indexOf('escribir');
        ok(iInsert === 0, '8.9 la traza arranca con insertSheet, dio ' + JSON.stringify(t));
        ok(iFoco > iInsert && iFoco < iHide, '8.9 el foco se repone DESPUES de insertSheet y ANTES de hideSheet');
        ok(iHide < iEscribir, '8.9 hideSheet ocurre ANTES de la primera escritura de celdas');
        ok(ssM._activa() === antesActiva, '8.9 y la hoja activa al terminar es la misma que antes de crear');

        // Si fn falla, la hoja se borra y el foco vuelve igual.
        const ssM2 = activarSs([], []);
        const antesActiva2 = ssM2._activa();
        let lanzo9 = false;
        try {
            ctx._conHojaActivaPreservada(ssM2, 'Hoja rota', function () { throw new Error('no verifica'); });
        } catch (e) { lanzo9 = true; }
        ok(lanzo9, '8.9 si la verificacion falla, relanza');
        ok(!ssM2._hojas['Hoja rota'], '8.9 y borra la hoja a medio crear');
        ok(ssM2._activa() === antesActiva2, '8.9 y repone el foco igual');
    }
}

// ============================================================================
console.log('\n' + (fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
