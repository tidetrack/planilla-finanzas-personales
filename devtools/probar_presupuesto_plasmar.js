/**
 * devtools/probar_presupuesto_plasmar.js
 * Banco de pruebas de src/DEVTOOL_PresupuestoPlasmar.js.
 *
 * Prueba por MUTACION las decisiones del encargo (ver la cabecera del modulo real para el
 * porque de cada una):
 *   1. Agrupacion por cuenta: los CINCO origenes (guardado/shell/recurrentes/base/otros) suman
 *      juntos para la misma cuenta -- decision de producto 1 (traer TODO, no solo "guardado").
 *   2. Confirmacion con numeros concretos SOLO cuando hay algo que pisar (pedido explicito).
 *   3. Moneda SIN conversion silenciosa: mezcla de monedas para una cuenta, o una moneda unica
 *      distinta de la del presupuesto, NO se escriben -- se reportan como anomalia.
 *   4. Cuenta que ya no existe en el bloque del Presupuesto vivo: anomalia, no se escribe.
 *   5. Categoria/tipo_cuenta que no mapea a ningun bloque: anomalia, no rompe el resto del plan.
 *   6. Mes sin ninguna fila de origen: nada que hacer, sin dialogo.
 *   7. Escribe VALORES (nunca formulas); verificacion por relectura con reversion de LOTE
 *      ENTERO al estado previo exacto si una celda no verifica.
 *   8. Revertir protege una edicion manual posterior a la corrida (un solo nivel de undo).
 *   9. El aviso de riesgo de doble conteo aparece solo cuando shell/recurrentes/otros
 *      contribuyeron a algo realmente plasmado.
 *  10. Preflight: aborta ante un rotulo corrido o una formula viva en K/O/S.
 *
 * USO:  node devtools/probar_presupuesto_plasmar.js
 * @version 0.66.0
 * @since 2026-09-07
 * @see src/DEVTOOL_PresupuestoPlasmar.js
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
    fs.readFileSync(path.join(RAIZ, 'src/17_RecurrentesService.js'), 'utf8') + '\n' +
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_ProyeccionAbm.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoPlasmar.js'), 'utf8') +
    '\n;Object.assign(globalThis,{SHEETS,RANGES,MONEDAS_DISPONIBLES,columnLetterToIndex,' +
    'PM_TITULO,PM_SELECTORES,PM_BLOQUES,PM_CLAVES_BLOQUE,PM_FILA_INI,PM_FILA_FIN,' +
    '_bloquesPc,PC_TITULO_PROYECTAR,PG_MARCA,PB_MARCA,REC_MARCA,PA_ORIGENES,PA_CATEGORIA_A_CLAVE,' +
    '_origenNotaPa,_leerTodasFilasPa,_preflightPb,_periodoDesdeSelectoresPg,_claveMesPg,' +
    'PP_UMBRAL_IDENTIDAD,PP_PROP_PREVIOS,_preflightPp,_periodoObjetivoPp,_cuentasPresupuestoPp,' +
    '_filasBdPeriodoPp,_agruparPorCuentaPp,_planPlasmarPp,_avisoDobleConteoPp,' +
    'estadoPresupuestoPlasmar,aplicarPresupuestoPlasmar,revertirPresupuestoPlasmar});',
    ctx
);

// ============================================================================
// HOJA "PRESUPUESTO" -- mock por celda (misma forma que probar_presupuesto_sembrar.js)
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
            getDisplayValue() { return String((celdas[ref] && celdas[ref].valor !== undefined) ? celdas[ref].valor : ''); },
            setValue(v) {
                if (tragonas[ref]) return;
                celdas[ref] = { valor: v, formula: '' };
            },
            clearContent() { delete celdas[ref]; }
        };
    }
    return { celdas: celdas, getRange: getRango };
}

/** Escenario base: I/M/Q con nombres de cuenta reales, selector de periodo/moneda default. */
function hojaPresupuestoBase(opciones) {
    opciones = opciones || {};
    const celdas = {};
    const set = (a1, valor, formula) => { celdas[a1] = { valor: valor, formula: formula || '' }; };

    set(ctx.PM_TITULO.celda, ctx.PM_TITULO.esperado);
    set(ctx.PM_SELECTORES.rotuloPeriodo.celda, ctx.PM_SELECTORES.rotuloPeriodo.esperado);
    set(ctx.PM_SELECTORES.mes, opciones.mesSel || 'Septiembre');
    set(ctx.PM_SELECTORES.anio, opciones.anioSel || 2026);
    set(ctx.PM_SELECTORES.rotuloMoneda.celda, ctx.PM_SELECTORES.rotuloMoneda.esperado);
    set(ctx.PM_SELECTORES.moneda, opciones.moneda || 'ARS');

    ctx.PM_CLAVES_BLOQUE.forEach((k) => {
        const bPm = ctx.PM_BLOQUES[k];
        const bPc = ctx._bloquesPc()[k];
        set(bPm.tituloBloque.celda, bPm.tituloBloque.esperado);
        set(bPm.rotuloCuenta.celda, bPm.rotuloCuenta.esperado);
        set(bPc.colProyectar + '7', ctx.PC_TITULO_PROYECTAR);
    });

    // Cuentas vivas: fila 9 de cada bloque.
    set('I9', 'Sueldo');
    set('M9', 'Alquiler');
    set('Q9', 'Nafta');

    (opciones.kos || []).forEach((c) => set(c.celda, c.valor));

    return crearHojaPresupuesto(celdas, opciones.tragonas);
}

// ============================================================================
// HOJAS "REGISTROS" / "PROYECCION" -- mock por grilla (misma forma que probar_presupuesto_guardar.js)
// ============================================================================
function filaProyPp(datos) {
    const cfg = ctx.RANGES.REGISTROS;
    const colIni = ctx.columnLetterToIndex(cfg.start);
    const ancho = ctx.columnLetterToIndex(cfg.end) - colIni + 1;
    const pos = {};
    Object.keys(cfg.columns).forEach((k) => { pos[k] = ctx.columnLetterToIndex(cfg.columns[k]) - colIni; });
    const f = new Array(ancho).fill('');
    Object.keys(datos).forEach((k) => { f[pos[k]] = datos[k]; });
    return f;
}

function hojaGridMock(nombre, filasDatos) {
    const cfg = ctx.RANGES.REGISTROS;
    const dataRow = cfg.dataRow, headerRow = cfg.headerRow;
    const colIni = ctx.columnLetterToIndex(cfg.start);
    const ancho = ctx.columnLetterToIndex(cfg.end) - colIni + 1;
    let grid = [];
    for (let r = 1; r < dataRow; r++) grid.push(new Array(ancho).fill(''));
    Object.keys(cfg.columns).forEach((k) => { grid[headerRow - 1][ctx.columnLetterToIndex(cfg.columns[k]) - colIni] = k; });
    (filasDatos || []).forEach((f) => grid.push(f.slice()));
    function fila1based(n) { while (grid.length < n) grid.push(new Array(ancho).fill('')); return grid[n - 1]; }
    return {
        getName: () => nombre,
        getLastRow: () => grid.length,
        getRange(row, col, nRows, nCols) {
            if (nRows === undefined) {
                const f = fila1based(row);
                const v = f[col - colIni];
                return { getValue: () => (v === undefined ? '' : v) };
            }
            return {
                getValues: () => { const out = []; for (let i = 0; i < nRows; i++) out.push(fila1based(row + i).slice(col - colIni, col - colIni + nCols)); return out; }
            };
        }
    };
}

function ssCon(hojaPresupuesto, filasProyeccion) {
    const hojaRegistros = hojaGridMock(ctx.SHEETS.REGISTROS, []);
    const hojaProyeccion = hojaGridMock(ctx.SHEETS.PROYECCION, filasProyeccion || []);
    return {
        getSheetByName(n) {
            if (n === ctx.SHEETS.PRESUPUESTO) return hojaPresupuesto;
            if (n === ctx.SHEETS.PROYECCION) return hojaProyeccion;
            if (n === ctx.SHEETS.REGISTROS) return hojaRegistros;
            return null;
        }
    };
}

// ============================================================================
console.log('BANCO: DEVTOOL_PresupuestoPlasmar (v0.66.0 -- la vuelta de Guardar Proyeccion)');

seccion('1. Agrupacion: los CINCO origenes suman juntos para la misma cuenta');
{
    const clave = '2026-09';
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProyPp({ monto: 50000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111' }),
        filaProyPp({ monto: 20000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.REC_MARCA + ' 2026-09 2026-08-21_090000 - Bono' }),
        filaProyPp({ monto: 10000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PB_MARCA + ' selloA' }),
        filaProyPp({ monto: 5000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000 retocada' })
    ];
    const hoja = hojaPresupuestoBase({});
    ssActual = ssCon(hoja, filas);
    const pre = ctx._preflightPp(ssActual);
    const plan = ctx._planPlasmarPp(ssActual, pre);

    ok(plan.clave === clave, 'clave del periodo vivo = ' + clave + ', dio ' + plan.clave);
    const sueldo = plan.aPlasmar.find((c) => c.cuenta === 'Sueldo');
    ok(!!sueldo, 'Sueldo entra al plan');
    ok(sueldo && sueldo.valor === 585000, 'Sueldo suma los CINCO origenes: 500000+50000+20000+10000+5000=585000, dio ' + (sueldo && sueldo.valor));
    ok(sueldo && sueldo.origenes.sort().join(',') === 'base,guardado,otros,recurrentes,shell',
        'los cinco origenes quedan registrados, dio ' + (sueldo && sueldo.origenes.sort().join(',')));
    ok(plan.origenesPresentes.sort().join(',') === 'base,guardado,otros,recurrentes,shell',
        'origenesPresentes del plan tambien lista los cinco');
}

seccion('2. Celdas ya cargadas: pisa=true con valorPrevio exacto, y separa por bloque');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 300000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProyPp({ monto: 80000, tipo: 'Egreso', cuenta: 'Nafta', tipo_cuenta: 'Gasto Variable', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 999 }] });   // Sueldo ya tenia 999 en K9
    ssActual = ssCon(hoja, filas);
    const pre = ctx._preflightPp(ssActual);
    const plan = ctx._planPlasmarPp(ssActual, pre);

    const sueldo = plan.aPlasmar.find((c) => c.celda === 'K9');
    const nafta = plan.aPlasmar.find((c) => c.celda === 'S9');
    ok(sueldo && sueldo.pisa === true && sueldo.valorPrevio === 999, 'K9 (Sueldo) pisa=true, valorPrevio=999, dio ' + JSON.stringify(sueldo));
    ok(nafta && nafta.pisa === false, 'S9 (Nafta) estaba vacia: pisa=false, dio ' + JSON.stringify(nafta));
}

seccion('3. MEZCLA DE MONEDAS: la misma cuenta con ARS y USD no se escribe, se reporta');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 100000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProyPp({ monto: 200, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', moneda: 'USD', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111' })
    ];
    const hoja = hojaPresupuestoBase({});
    ssActual = ssCon(hoja, filas);
    const pre = ctx._preflightPp(ssActual);
    const plan = ctx._planPlasmarPp(ssActual, pre);

    ok(!plan.aPlasmar.find((c) => c.cuenta === 'Alquiler'), 'Alquiler NO entra a aPlasmar (mezcla de monedas)');
    ok(plan.anomaliaMezclaMoneda.length === 1 && plan.anomaliaMezclaMoneda[0].cuenta === 'Alquiler',
        'se reporta como anomalia de mezcla de monedas, dio ' + JSON.stringify(plan.anomaliaMezclaMoneda));
}

seccion('4. MONEDA DISTINTA de la del presupuesto: no se escribe, se reporta');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 50, tipo: 'Egreso', cuenta: 'Nafta', tipo_cuenta: 'Gasto Variable', moneda: 'USD', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hoja = hojaPresupuestoBase({ moneda: 'ARS' });   // el presupuesto esta en ARS
    ssActual = ssCon(hoja, filas);
    const pre = ctx._preflightPp(ssActual);
    const plan = ctx._planPlasmarPp(ssActual, pre);

    ok(!plan.aPlasmar.find((c) => c.cuenta === 'Nafta'), 'Nafta NO entra a aPlasmar (proyectada en USD, presupuesto en ARS)');
    ok(plan.anomaliaMonedaDistinta.length === 1 && plan.anomaliaMonedaDistinta[0].moneda === 'USD',
        'se reporta como anomalia de moneda distinta, dio ' + JSON.stringify(plan.anomaliaMonedaDistinta));
}

seccion('5. CUENTA QUE YA NO EXISTE en el bloque vivo del Presupuesto: no se escribe, se reporta');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 1000, tipo: 'Ingreso', cuenta: 'CuentaBorrada', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hoja = hojaPresupuestoBase({});   // I9 = 'Sueldo', 'CuentaBorrada' no esta en ningun lado
    ssActual = ssCon(hoja, filas);
    const pre = ctx._preflightPp(ssActual);
    const plan = ctx._planPlasmarPp(ssActual, pre);

    ok(plan.aPlasmar.length === 0, 'nada entra a aPlasmar');
    ok(plan.anomaliaCuentaNoExiste.length === 1 && plan.anomaliaCuentaNoExiste[0].cuenta === 'CuentaBorrada',
        'se reporta como anomalia de cuenta inexistente, dio ' + JSON.stringify(plan.anomaliaCuentaNoExiste));
}

seccion('6. CATEGORIA DESCONOCIDA: no rompe el resto del plan, se cuenta aparte');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 999, tipo: 'Ingreso', cuenta: 'RaraAvis', tipo_cuenta: 'Categoria Que No Existe', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProyPp({ monto: 100000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hoja = hojaPresupuestoBase({});
    ssActual = ssCon(hoja, filas);
    const pre = ctx._preflightPp(ssActual);
    const plan = ctx._planPlasmarPp(ssActual, pre);

    ok(plan.categoriaDesconocida.length === 1, 'la fila de categoria rara se cuenta aparte, dio ' + plan.categoriaDesconocida.length);
    ok(plan.aPlasmar.length === 1 && plan.aPlasmar[0].cuenta === 'Sueldo', 'Sueldo sigue entrando bien al plan');
}

seccion('7. MES SIN NINGUNA FILA DE ORIGEN: nada que hacer, sin dialogo');
{
    const hoja = hojaPresupuestoBase({});
    ssActual = ssCon(hoja, []);   // "Proyeccion" vacia
    alertas = []; botonesUsados = [];
    const r = ctx.aplicarPresupuestoPlasmar();
    ok(r.ok, 'aplicar no da error cuando no hay nada que plasmar: ' + (r.error || ''));
    ok(!botonesUsados.includes('YN'), 'ningun dialogo de confirmacion se disparo');
}

seccion('8. Confirmacion: aparece SOLO cuando hay pisa, con numeros concretos');
{
    const fecha = new Date(2026, 8, 1);
    const filasConPisa = [
        filaProyPp({ monto: 400000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hojaConPisa = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 111 }] });
    ssActual = ssCon(hojaConPisa, filasConPisa);
    alertas = []; botonesUsados = [];
    const r1 = ctx.aplicarPresupuestoPlasmar();
    ok(r1.ok, 'aplicar corre sin error: ' + (r1.error || ''));
    ok(botonesUsados.includes('YN'), 'SI hubo dialogo de confirmacion (habia una celda con contenido previo)');
    const confirm = alertas.find((a) => /SE VAN A SOBREESCRIBIR/.test(a));
    ok(!!confirm, 'el titulo nombra "SE VAN A SOBREESCRIBIR"');
    ok(confirm && /Lo que se pierde en esas 1 celda\(s\): 111\.00 ARS/.test(confirm),
        'la confirmacion dice EXACTO cuanto se pierde (111.00 ARS), dio: ' + (confirm && confirm.split('\n').find((l) => /se pierde/.test(l))));
    ok(confirm && /400000\.00 ARS/.test(confirm), 'y cuanto va a quedar valiendo (400000.00 ARS)');

    // Sin pisa: sin dialogo YES_NO.
    const filasSinPisa = [
        filaProyPp({ monto: 400000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hojaSinPisa = hojaPresupuestoBase({});   // K9 vacia
    ssActual = ssCon(hojaSinPisa, filasSinPisa);
    alertas = []; botonesUsados = [];
    const r2 = ctx.aplicarPresupuestoPlasmar();
    ok(r2.ok, 'aplicar (sin pisa) corre sin error: ' + (r2.error || ''));
    ok(!botonesUsados.includes('YN'), 'NINGUN dialogo de confirmacion cuando no hay nada que pisar');
}

seccion('9. Aplicar feliz: escribe VALORES, verifica por relectura, revierte el LOTE si algo no verifica');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProyPp({ monto: 200000, tipo: 'Egreso', cuenta: 'Alquiler', tipo_cuenta: 'Gasto Fijo', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hoja = hojaPresupuestoBase({});
    ssActual = ssCon(hoja, filas);
    const r = ctx.aplicarPresupuestoPlasmar();
    ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));
    ok(hoja.celdas['K9'].valor === 500000 && hoja.celdas['K9'].formula === '', 'K9 = 500000, con setValue (nunca formula)');
    ok(hoja.celdas['O9'].valor === 200000 && hoja.celdas['O9'].formula === '', 'O9 = 200000, con setValue');
    ok(!!propiedadesFalsas[ctx.PP_PROP_PREVIOS], 'quedo un respaldo en Document Properties');

    // Verificacion que falla: K9 es "tragona" (simula una celda combinada que no guarda el setValue).
    const hoja2 = hojaPresupuestoBase({ kos: [{ celda: 'O9', valor: 55 }], tragonas: { K9: true } });
    ssActual = ssCon(hoja2, filas);
    alertas = []; botonesUsados = [];
    const r2 = ctx.aplicarPresupuestoPlasmar();
    ok(!r2.ok, 'aplicar FALLA en vez de declarar exito sobre una escritura que no verifica');
    ok(/no verifica/i.test(r2.error || ''), 'el error dice que la verificacion fallo: ' + r2.error);
    ok(!('K9' in hoja2.celdas), 'K9 (tragona, estaba vacia antes) sigue vacia -- no quedo a medias');
    ok(hoja2.celdas['O9'].valor === 55, 'O9 (SI se habia escrito bien, pisando 55) se REVIRTIO a 55, el valor previo exacto');
}

seccion('10. Revertir: protege una edicion manual posterior, y un segundo revertir no tiene nada que hacer');
{
    const fecha = new Date(2026, 8, 1);
    const filas = [
        filaProyPp({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' })
    ];
    const hoja = hojaPresupuestoBase({ kos: [{ celda: 'K9', valor: 777 }] });
    ssActual = ssCon(hoja, filas);
    const rAplicar = ctx.aplicarPresupuestoPlasmar();
    ok(rAplicar.ok, 'aplicar corre sin error: ' + (rAplicar.error || ''));
    ok(hoja.celdas['K9'].valor === 500000, 'K9 quedo en 500000 tras aplicar');

    hoja.celdas['K9'] = { valor: 123456, formula: '' };   // Franco corrige K9 a mano DESPUES de plasmar
    const rRev = ctx.revertirPresupuestoPlasmar();
    ok(rRev.ok, 'revertir corre sin error: ' + (rRev.error || ''));
    ok(hoja.celdas['K9'].valor === 123456, 'K9 (Franco la corrigio despues) SIGUE en 123456 -- revertir no la piso');

    const rRev2 = ctx.revertirPresupuestoPlasmar();
    ok(!rRev2.ok && /no hay ninguna corrida/i.test(rRev2.error || ''), 'un segundo revertir no tiene nada que deshacer: ' + rRev2.error);
}

seccion('11. Aviso de doble conteo: aparece solo cuando shell/recurrentes/otros aportan a lo plasmado');
{
    const fecha = new Date(2026, 8, 1);
    // Solo 'guardado' y 'base' (ninguno de los dos esta en riesgo: Guardar SI los retira).
    const filasSinRiesgo = [
        filaProyPp({ monto: 500000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 2026-08-25_143000' }),
        filaProyPp({ monto: 10000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PB_MARCA + ' selloA' })
    ];
    const hoja1 = hojaPresupuestoBase({});
    ssActual = ssCon(hoja1, filasSinRiesgo);
    const pre1 = ctx._preflightPp(ssActual);
    const plan1 = ctx._planPlasmarPp(ssActual, pre1);
    ok(ctx._avisoDobleConteoPp(plan1.aPlasmar) === '', 'sin shell/recurrentes/otros: NINGUN aviso de doble conteo');

    // Con 'shell' de por medio: el aviso tiene que aparecer.
    const filasConRiesgo = filasSinRiesgo.concat([
        filaProyPp({ monto: 5000, tipo: 'Ingreso', cuenta: 'Sueldo', tipo_cuenta: 'Ingreso', moneda: 'ARS', fecha: fecha, nota: ctx.PG_MARCA + ' 2026-09 shell_2026-08-27_100000111' })
    ]);
    const hoja2 = hojaPresupuestoBase({});
    ssActual = ssCon(hoja2, filasConRiesgo);
    const pre2 = ctx._preflightPp(ssActual);
    const plan2 = ctx._planPlasmarPp(ssActual, pre2);
    const aviso = ctx._avisoDobleConteoPp(plan2.aPlasmar);
    ok(aviso !== '' && /ADVERTENCIA/.test(aviso) && /shell/.test(aviso),
        'con shell de por medio, el aviso de doble conteo SI aparece y lo nombra: ' + aviso.slice(0, 60));
}

seccion('12. Preflight: aborta ante un rotulo corrido, y ante una formula viva en K/O/S');
{
    const hoja = hojaPresupuestoBase({});
    hoja.celdas['I7'] = { valor: 'Otra Cosa', formula: '' };
    let lanzo = false, msg = '';
    try { ctx._preflightPp(ssCon(hoja, [])); } catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo && /no es la que este modulo espera/.test(msg), 'MUTACION rotulo (I7 corrido): el preflight aborta, dio: ' + msg.slice(0, 90));

    const hoja2 = hojaPresupuestoBase({});
    hoja2.celdas['O15'] = { valor: 0, formula: '=1+1' };
    let lanzo2 = false, msg2 = '';
    try { ctx._preflightPp(ssCon(hoja2, [])); } catch (e) { lanzo2 = true; msg2 = e.message; }
    ok(lanzo2 && /formulas en la zona/i.test(msg2), 'MUTACION (formula viva en O15): el preflight aborta, dio: ' + msg2.slice(0, 90));
}

// ============================================
console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (12 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
