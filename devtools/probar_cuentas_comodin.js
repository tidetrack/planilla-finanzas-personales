/**
 * devtools/probar_cuentas_comodin.js
 * Banco de pruebas de src/DEVTOOL_CuentasComodin.js.
 *
 * El modulo toca la hoja troncal del sistema y, sobre todo, toca LA CONSOLIDADA: la formula
 * que alimenta el desplegable de Cuenta de la hoja de Cargas. Si esa formula queda mal,
 * Franco no puede cargar un solo movimiento. Por eso el banco no verifica el TEXTO de la
 * formula sino su DERRAME: la hoja falsa evalua el QUERY(FLATTEN(...)) de verdad, asi que
 * "Traspaso aparece en el desplegable" se prueba y no se promete.
 *
 * Nada de la geometria se retipea aca: T, U, R, las filas 6/7/8 y el catalogo salen del
 * modulo real y de 00_Config.js, cargados desde RAIZ derivada de __dirname. Un banco con su
 * propia copia de las coordenadas da verde sobre codigo que no corre.
 *
 * Las mutaciones (una guarda que no se puede probar rota es una guarda que no sirve):
 *   A. La celda destino se traga la escritura (combinada) -> la verificacion falla, se
 *      revierte todo y las columnas NO quedan ocultas.
 *   B. La formula de la consolidada no derrama -> se revierte y se repone la formula previa.
 *   C. El bloque modelo no tiene titulo -> el preflight aborta ANTES de escribir nada.
 *   D. La columna destino esta ocupada por otro bloque -> aborta sin pisar.
 *
 * USO:  node devtools/probar_cuentas_comodin.js      (exit 0 si pasa, 1 si algo sale mal)
 *
 * @version 0.1.0
 * @since 2026-08-24
 * @see src/DEVTOOL_CuentasComodin.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };
const seccion = (t) => console.log('\n== ' + t + ' ==');

// ============================================
// HOJA FALSA
// ============================================
// Modela lo justo: valores, formulas, copyTo de formato (no-op observable), ocultamiento de
// columnas, y el DERRAME de la consolidada. Las celdas "tragonas" simulan una combinada:
// aceptan la escritura y no la guardan, que es exactamente como Sheets se come un setValue
// sobre la mitad muda de una combinada -- sin lanzar excepcion.

function letraAIndice(l) {
    let n = 0;
    for (let i = 0; i < l.length; i++) n = n * 26 + (l.charCodeAt(i) - 64);
    return n;
}
function indiceALetra(n) {
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
}

function crearHojaFalsa(nombre, opciones) {
    opciones = opciones || {};
    const valores = Object.create(null);   // "fila,col" -> valor
    const formulas = Object.create(null);
    const ocultas = Object.create(null);
    const tragonas = opciones.tragonas || {};   // "fila,col" -> true
    const MAX_FILAS = opciones.filas || 200;
    const MAX_COLS = opciones.cols || 30;
    const noDerrama = { v: !!opciones.noDerrama };

    const k = (f, c) => f + ',' + c;

    // El derrame real de =QUERY(FLATTEN(rangos);"...";0): concatena los rangos en orden y
    // saca los vacios. Es lo que hace la consolidada de la planilla.
    function recalcular() {
        Object.keys(formulas).forEach(function (clave) {
            const f = formulas[clave];
            const partes = clave.split(',').map(Number);
            // limpiar el derrame anterior
            for (let i = 0; i < MAX_FILAS; i++) delete valores[k(partes[0] + i, partes[1])];
            if (noDerrama.v) return;
            const rangos = f.match(/([A-Z]+)(\d+):\1(\d+)?/g) || [];
            const salida = [];
            rangos.forEach(function (r) {
                const m = r.match(/^([A-Z]+)(\d+):[A-Z]+(\d+)?$/);
                const col = letraAIndice(m[1]);
                const desde = Number(m[2]);
                const hasta = m[3] ? Number(m[3]) : MAX_FILAS;
                for (let fila = desde; fila <= Math.min(hasta, MAX_FILAS); fila++) {
                    const v = valores[k(fila, col)];
                    if (v !== undefined && String(v).trim() !== '') salida.push(v);
                }
            });
            salida.forEach(function (v, i) { valores[k(partes[0] + i, partes[1])] = v; });
        });
    }

    function rango(fila, col, nFilas, nCols) {
        nFilas = nFilas || 1; nCols = nCols || 1;
        return {
            getValue: () => { const v = valores[k(fila, col)]; return v === undefined ? '' : v; },
            setValue: (v) => {
                if (!tragonas[k(fila, col)]) valores[k(fila, col)] = v;
                return rango(fila, col, nFilas, nCols);
            },
            getValues: () => {
                const out = [];
                for (let r = 0; r < nFilas; r++) {
                    const f = [];
                    for (let c = 0; c < nCols; c++) {
                        const v = valores[k(fila + r, col + c)];
                        f.push(v === undefined ? '' : v);
                    }
                    out.push(f);
                }
                return out;
            },
            setValues: (m) => {
                for (let r = 0; r < m.length; r++)
                    for (let c = 0; c < m[r].length; c++)
                        if (!tragonas[k(fila + r, col + c)]) valores[k(fila + r, col + c)] = m[r][c];
                return rango(fila, col, nFilas, nCols);
            },
            getFormula: () => formulas[k(fila, col)] || '',
            setFormula: (f) => { formulas[k(fila, col)] = f; recalcular(); return rango(fila, col, nFilas, nCols); },
            getDisplayValues: function () { return this.getValues().map(r => r.map(v => String(v))); },
            clearContent: () => {
                for (let r = 0; r < nFilas; r++) for (let c = 0; c < nCols; c++) {
                    delete valores[k(fila + r, col + c)]; delete formulas[k(fila + r, col + c)];
                }
            },
            clear: function () { this.clearContent(); },
            // PASTE_VALUES tiene que copiar de verdad: _respaldarCatalogo respalda con eso y
            // despues RELEE la copia para verificarla celda por celda. Con un copyTo mudo el
            // respaldo queda vacio y el modulo se niega a escribir -- que es lo correcto de
            // su parte, pero convierte al banco en un probador de su propio stub.
            // PASTE_FORMAT si es no-op: el formato no cambia ningun valor, que es lo unico
            // que este banco puede afirmar.
            copyTo: function (destino, tipo) {
                if (tipo === 'V' && destino && destino.setValues) destino.setValues(this.getValues());
            }
        };
    }

    return {
        getName: () => nombre,
        getMaxRows: () => MAX_FILAS,
        getMaxColumns: () => MAX_COLS,
        getLastRow: () => MAX_FILAS,
        getLastColumn: () => MAX_COLS,
        getRange: rango,
        hideColumns: (c, n) => { for (let i = 0; i < (n || 1); i++) ocultas[c + i] = true; },
        showColumns: (c, n) => { for (let i = 0; i < (n || 1); i++) delete ocultas[c + i]; },
        insertRowsAfter: () => {}, insertColumnsAfter: () => {}, hideSheet: () => {},
        // helpers del banco, no de la API
        _estaOculta: (letra) => !!ocultas[letraAIndice(letra)],
        _leer: (ref) => {
            const m = ref.match(/^([A-Z]+)(\d+)$/);
            const v = valores[k(Number(m[2]), letraAIndice(m[1]))];
            return v === undefined ? '' : v;
        },
        _columna: (letra, desde, hasta) => {
            const out = [];
            for (let f = desde; f <= hasta; f++) {
                const v = valores[k(f, letraAIndice(letra))];
                if (v !== undefined && String(v).trim() !== '') out.push(v);
            }
            return out;
        },
        _romperDerrame: () => { noDerrama.v = true; recalcular(); },
        _recalcular: recalcular
    };
}

// Plan de Cuentas con los datos REALES del gemelo (docs/permanente/celdas.tsv, 2026-08-21).
const INGRESOS = ['Tidetrack', 'Umoh', 'Ingresos Extra', 'Intereses bancos', 'Ingreso Asesor',
    'Plata Prestada', 'Sueldo', 'FF', 'Ingreso Viejo', 'Inversiones', 'Rendimientos', 'Ajuste'];
const FIJOS = ['Auto', 'Gatos', 'Linea telefónica', 'MONOTRIBUTO', 'Nafta', 'Pago tarjeta',
    'Prepaga Salud', 'SportClub'];
const VARIABLES = ['Comidas', 'Computación', 'Corte Pelo', 'Entretenimiento'];
const MEDIOS = ['Dolar Cash', 'Dolar Galicia', 'Efectivo', 'Galicia', 'Mercado Pago', 'NaranjaX'];

/** La formula viva de la consolidada, copiada del gemelo: separador ";" (locale es-AR). */
const FORMULA_R_REAL =
    '=QUERY(FLATTEN(C8:C1000;F8:F1000;I8:I1000;L8:L1000);"select * where Col1 is not null";0)';

function crearPlanFalso(opciones) {
    opciones = opciones || {};
    const h = crearHojaFalsa('Plan de Cuentas', opciones);
    if (opciones.sinTituloModelo !== true) h.getRange(6, letraAIndice('C')).setValue('Ingresos.');
    h.getRange(6, letraAIndice('F')).setValue('Gastos Fijos.');
    h.getRange(6, letraAIndice('I')).setValue('Gastos Variables.');
    h.getRange(6, letraAIndice('L')).setValue('Medios Bancarios.');
    h.getRange(7, letraAIndice('C')).setValue('Cuenta');
    h.getRange(7, letraAIndice('D')).setValue('Categoría');
    h.getRange(7, letraAIndice('R')).setValue('Cuentas (fuente de validacion - no tocar)');
    [['C', INGRESOS], ['F', FIJOS], ['I', VARIABLES], ['L', MEDIOS]].forEach(function (par) {
        par[1].forEach(function (v, i) { h.getRange(8 + i, letraAIndice(par[0])).setValue(v); });
    });
    if (opciones.ocupada) h.getRange(6, letraAIndice('T')).setValue(opciones.ocupada);
    if (opciones.sinFormulaR !== true) h.getRange(8, letraAIndice('R')).setFormula(FORMULA_R_REAL);
    return h;
}

let propiedadesFalsas = {};
let alertas = [];
let ssActual = null;

function crearSsFalso(plan) {
    const extra = [];
    return {
        getSheetByName: (n) => (n === 'Plan de Cuentas' ? plan : (extra.find(h => h.getName() === n) || null)),
        insertSheet: (n) => { const h = crearHojaFalsa(n, {}); extra.push(h); return h; },
        getSheets: () => [plan].concat(extra)
    };
}

// ============================================
// CARGA DEL MODULO REAL
// ============================================
const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp, Error,
    SpreadsheetApp: {
        flush() {},
        getActiveSpreadsheet: () => ssActual,
        getUi: () => ({ alert: (t, m) => { alertas.push(t + '\n' + m); }, ButtonSet: { OK: 'OK' } }),
        CopyPasteType: { PASTE_VALUES: 'V', PASTE_FORMAT: 'F' }
    },
    PropertiesService: {
        getDocumentProperties: () => ({
            getProperty: (k) => (k in propiedadesFalsas ? propiedadesFalsas[k] : null),
            setProperty: (k, v) => { propiedadesFalsas[k] = v; },
            deleteProperty: (k) => { delete propiedadesFalsas[k]; }
        })
    },
    Utilities: { formatDate: () => '2026-08-24_1200' },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {}
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_AltaCuentas.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_CuentasComodin.js'), 'utf8') +
    // Los `const` de un script de vm viven en su scope lexico, no en el contexto: hay que
    // exportarlos a mano, igual que los otros bancos del repo.
    '\n;Object.assign(globalThis,{CC_COL_NOMBRE,CC_COL_NOTA,CC_TITULO,CC_FILA_TITULO,' +
    'estadoCuentasComodin,aplicarCuentasComodin,revertirCuentasComodin,_separadorFormulaComodin,' +
    'CUENTAS_NEUTRAS,HEADER_ROW,DATA_START_ROW,RANGES,SHEETS});',
    ctx
);
const { CC_COL_NOMBRE, CC_COL_NOTA, CC_TITULO, CC_FILA_TITULO } = ctx;
const NEUTRAS = ctx.CUENTAS_NEUTRAS;
const HEADER = ctx.HEADER_ROW, DATOS = ctx.DATA_START_ROW;

function reset(opciones) {
    propiedadesFalsas = {}; alertas = [];
    const plan = crearPlanFalso(opciones);
    ssActual = crearSsFalso(plan);
    return plan;
}

// ============================================
console.log('BANCO: DEVTOOL_CuentasComodin');
console.log('  geometria leida del modulo -> bloque en ' + CC_COL_NOMBRE + ':' + CC_COL_NOTA +
    ', titulo fila ' + CC_FILA_TITULO + ', headers ' + HEADER + ', datos ' + DATOS);
console.log('  catalogo leido de 00_Config -> CUENTAS_NEUTRAS = [' + NEUTRAS.join(', ') + ']');

seccion('1. El modulo no retipea nada');
ok(CC_COL_NOMBRE === 'T' && CC_COL_NOTA === 'U', 'el bloque va a T:U (columnas libres medidas)');
ok(NEUTRAS.length >= 2 && NEUTRAS.indexOf('Traspaso') !== -1 && NEUTRAS.indexOf('Inicio Mes') !== -1,
    'el catalogo sale de CUENTAS_NEUTRAS, no de una lista propia');
ok(ctx.RANGES.CUENTAS_COMODIN && ctx.RANGES.CUENTAS_COMODIN.columns.nombre === CC_COL_NOMBRE,
    'RANGES.CUENTAS_COMODIN coincide con la constante del modulo (SSOT)');
ok(ctx.RANGES.PLAN_CONSOLIDADA && ctx.RANGES.PLAN_CONSOLIDADA.columns.nombre === 'R',
    'RANGES.PLAN_CONSOLIDADA declara la columna R (no S, como decia CLAUDE.md)');

seccion('2. Estado: no escribe una sola celda');
let plan = reset();
const antesT = plan._leer('T6'), antesR = plan.getRange(8, letraAIndice('R')).getFormula();
let r = ctx.estadoCuentasComodin();
ok(r.ok, 'estado corre sin error');
ok(plan._leer('T6') === antesT, 'T6 sigue vacia despues de estado');
ok(plan.getRange(8, letraAIndice('R')).getFormula() === antesR, 'la consolidada no se toco');
ok(/EL BLOQUE NO EXISTE/.test(r.detalle), 'reporta que el bloque no existe');
ok(r.detalle.indexOf('T8:T1000') !== -1, 'muestra la formula que quedaria, con el rango nuevo');

seccion('3. Aplicar: el bloque queda escrito y oculto');
plan = reset();
r = ctx.aplicarCuentasComodin();
ok(r.ok, 'aplicar corre sin error: ' + (r.error || ''));
ok(plan._leer('T6') === CC_TITULO, 'T6 = "' + CC_TITULO + '"');
ok(plan._leer('T7') === 'Cuenta', 'T7 = "Cuenta"');
ok(plan._leer('U7') === 'Que es', 'U7 = "Que es"');
NEUTRAS.forEach(function (n, i) {
    ok(plan._leer(CC_COL_NOMBRE + (DATOS + i)) === n, CC_COL_NOMBRE + (DATOS + i) + ' = "' + n + '"');
    ok(String(plan._leer(CC_COL_NOTA + (DATOS + i))).length > 10,
        CC_COL_NOTA + (DATOS + i) + ' explica que es "' + n + '"');
});
ok(plan._estaOculta('T') && plan._estaOculta('U'), 'las columnas T y U quedaron OCULTAS');

seccion('4. La consolidada: derrame real, no texto de formula');
const formulaFinal = plan.getRange(8, letraAIndice('R')).getFormula();
ok(formulaFinal.indexOf('T8:T1000') !== -1, 'la formula incluye el bloque nuevo');
ok(formulaFinal.indexOf('L8:L1000;T8:T1000') !== -1,
    'usa el separador ";" que la propia formula ya traia (locale es-AR), no una coma');
ok(formulaFinal.indexOf('C8:C1000') !== -1 && formulaFinal.indexOf('select * where Col1 is not null') !== -1,
    'el resto de la formula quedo intacto');
const derrame = plan._columna('R', DATOS, 200);
NEUTRAS.forEach(function (n) {
    ok(derrame.indexOf(n) !== -1, '"' + n + '" APARECE en el desplegable de Cuenta');
});
INGRESOS.concat(FIJOS, VARIABLES, MEDIOS).forEach(function (n) {
    if (derrame.indexOf(n) === -1) ok(false, 'se perdio "' + n + '" del desplegable');
});
ok(derrame.length === INGRESOS.length + FIJOS.length + VARIABLES.length + MEDIOS.length + NEUTRAS.length,
    'el desplegable tiene exactamente las cuentas de antes + las ' + NEUTRAS.length + ' comodines');

seccion('5. Idempotencia: aplicar dos veces no duplica');
const antesSegunda = plan._columna('R', DATOS, 200).length;
r = ctx.aplicarCuentasComodin();
ok(r.ok, 'la segunda corrida no da error');
ok(/ya existe/i.test(r.detalle || ''), 'reconoce que ya estaba aplicado');
ok(plan._columna('R', DATOS, 200).length === antesSegunda, 'el desplegable no crecio');
ok(plan._columna('T', DATOS, 200).length === NEUTRAS.length, 'no se duplicaron las cuentas en T');

seccion('6. Revertir: deja la hoja como estaba');
r = ctx.revertirCuentasComodin();
ok(r.ok, 'revertir corre sin error');
ok(plan._leer('T6') === '' && plan._columna('T', DATOS, 200).length === 0, 'T quedo vacia');
ok(!plan._estaOculta('T') && !plan._estaOculta('U'), 'las columnas volvieron a estar visibles');
ok(plan.getRange(8, letraAIndice('R')).getFormula() === FORMULA_R_REAL,
    'la consolidada volvio EXACTAMENTE a la formula original');
const derrameTrasRevertir = plan._columna('R', DATOS, 200);
ok(derrameTrasRevertir.indexOf('Traspaso') === -1, 'el desplegable ya no ofrece las comodines');
ok(derrameTrasRevertir.length === INGRESOS.length + FIJOS.length + VARIABLES.length + MEDIOS.length,
    'el desplegable volvio a su cantidad original');

seccion('7. MUTACION A: la celda destino se traga la escritura (combinada)');
// T8 tragona: acepta el setValues y no guarda. Es como Sheets se come una escritura sobre la
// mitad muda de una combinada, SIN lanzar excepcion. Si la verificacion mirara el texto que
// creyo escribir, esto pasaria en verde.
plan = reset({ tragonas: { [DATOS + ',' + letraAIndice('T')]: true } });
r = ctx.aplicarCuentasComodin();
ok(!r.ok, 'aplicar FALLA en vez de declarar exito sobre una celda muda');
ok(/no verifica/i.test(r.error || ''), 'el error dice que la verificacion fallo');
ok(plan._leer('T6') === '', 'se revirtio: T6 quedo vacia');
ok(!plan._estaOculta('T'), 'NO se ocultaron las columnas: el problema queda a la vista');
ok(plan.getRange(8, letraAIndice('R')).getFormula() === FORMULA_R_REAL,
    'la consolidada volvio a su formula original');

seccion('8. MUTACION B: la formula queda escrita pero no derrama');
plan = reset();
plan._romperDerrame();
r = ctx.aplicarCuentasComodin();
ok(!r.ok, 'aplicar FALLA aunque la formula este escrita');
ok(/consolidada/i.test(r.error || ''), 'el error nombra a la consolidada');
ok(plan._leer('T6') === '', 'se revirtio el bloque entero');

seccion('9. MUTACION C: el bloque modelo no tiene titulo (la hoja no es la esperada)');
plan = reset({ sinTituloModelo: true });
r = ctx.aplicarCuentasComodin();
ok(!r.ok, 'el preflight aborta');
ok(/geometria esperada/i.test(r.error || ''), 'el error explica que la hoja no tiene la forma esperada');
ok(plan._leer('T6') === '', 'no se escribio NADA antes de abortar');

seccion('10. MUTACION D: la columna destino ya esta ocupada por otro bloque');
plan = reset({ ocupada: 'Otro bloque de Franco.' });
r = ctx.aplicarCuentasComodin();
ok(!r.ok, 'aborta en vez de pisar');
ok(/no se pisa nada/i.test(r.error || ''), 'el error lo dice explicito');
ok(plan._leer('T6') === 'Otro bloque de Franco.', 'lo que habia sigue intacto');

seccion('11. El separador se DETECTA, no se asume');
ok(ctx._separadorFormulaComodin('=FLATTEN(C8:C1000;F8:F1000)', ['C8:C1000', 'F8:F1000']) === ';',
    'formula con ";" -> devuelve ";"');
ok(ctx._separadorFormulaComodin('=FLATTEN(C8:C1000,F8:F1000)', ['C8:C1000', 'F8:F1000']) === ',',
    'formula con "," -> devuelve "," (no rompe una planilla en locale en-US)');

// ============================================
console.log('\n' + (fallas === 0
    ? 'TODO EN VERDE (' + '11 secciones)'
    : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
