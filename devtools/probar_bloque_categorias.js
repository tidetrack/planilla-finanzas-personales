/**
 * devtools/probar_bloque_categorias.js
 * Banco de pruebas de DEVTOOL_BloqueCategorias.js.
 *
 * Nace con la reparacion del 2026-08-24: Franco midio en vivo que el VLOOKUP de la columna Tipo
 * del bloque "Categorias" del Tablero (la linea `columna_tipo` del LET de AA10) le pedia la
 * columna 2 a 'Plan de Cuentas'!P:P -- un rango de UNA sola columna, por lo tanto #REF!, tapado
 * por el IFERROR que lo envuelve. La columna Tipo del Tablero no podia mostrar nada, nunca. Este
 * modulo no tenia banco propio (las dos publicas se probaban solo indirectamente, de paso, en
 * probar_riqueza.js seccion 2); con una segunda cirugia de token nueva conviene uno dedicado.
 *
 * Corre las transformaciones REALES del modulo contra la formula REAL de Tablero!AA10 (leida del
 * gemelo digital, docs/permanente/celdas.tsv), mas mutaciones sinteticas para probar que:
 *   1. `_repararRangoTipoBcat` corrige el rango del Tipo y lo hace DERIVANDO RANGES.PROYECTOS
 *      (mutar RANGES.PROYECTOS.end cambia el resultado: si el output no reaccionara, el rango
 *      estaria hardcodeado, que es exactamente lo que CLAUDE.md prohibe).
 *   2. NO toca `tipo_proy` (linea 7 del mismo LET): misma forma rota, pero variable MUERTA, fuera
 *      de alcance de esta reparacion puntual (ver cabecera de DEVTOOL_BloqueCategorias.js).
 *   3. Es idempotente, sola y combinada con `_reapuntarBloqueCategorias` via `_diagnosticarBcat`.
 *   4. `_diagnosticarBcat` contra la celda viva reproduce el estado medido: la cascada de
 *      categoria YA esta aplicada (grupoCambia=false) y el rango del Tipo SI hace falta
 *      repararlo (tipoCambia=true) -- si esto cambiara de signo, es que el gemelo quedo
 *      desactualizado o que la planilla real diverge de lo medido, y hay que parar y mirar.
 *   5. `_contarCategoriasSinTipoBcat` cuenta bien sobre una hoja simulada (con nombre y sin
 *      nombre, con tipo y sin tipo, filas vacias intercaladas).
 *
 * USO:  node devtools/probar_bloque_categorias.js       (exit 0 si pasa, 1 si algo sale invalido)
 *
 * @version 0.1.0
 * @since 2026-08-24
 * @see src/DEVTOOL_BloqueCategorias.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// ============================================
// CARGA DEL MODULO REAL (y sus dependencias, mismo orden que Apps Script las evalua)
// ============================================
const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp,
    SpreadsheetApp: {
        flush() {},
        getActiveSpreadsheet: () => null,
        getUi: () => { throw new Error('sin UI'); }
    },
    PropertiesService: {
        getDocumentProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} })
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_StockYFlujo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_BloqueCategorias.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,NAV_CONFIG,' +
    '_reapuntarBloqueCategorias,_repararRangoTipoBcat,_diagnosticarBcat,' +
    '_contarCategoriasSinTipoBcat,BCAT_VAR_TIPO,BCAT_CELDA});',
    ctx
);

// ============================================
// LA CELDA VIVA (gemelo digital)
// ============================================
const tsv = fs.readFileSync(path.join(RAIZ, 'docs/permanente/celdas.tsv'), 'utf8').split('\n');
let formulaViva = null;
for (const l of tsv) {
    const p = l.split('\t');
    if (p.length < 3) continue;
    if (p[0] === 'Tablero' && p[1] === ctx.BCAT_CELDA) {
        formulaViva = p[2].replace(/\\\\/g, '\x00').replace(/\\n/g, '\n').replace(/\x00/g, '\\');
        break;
    }
}

console.log('=== 1. _repararRangoTipoBcat contra la celda VIVA (Tablero!' + ctx.BCAT_CELDA + ') ===');
if (!formulaViva) {
    fallas++;
    console.log('  ### FALLA no se encontro Tablero!' + ctx.BCAT_CELDA + ' en el gemelo (celdas.tsv). ' +
        'Sin la formula real no se puede probar contra lo que Franco realmente tiene.');
} else {
    const lineaAntes = formulaViva.split('\n').find(l => l.trim().startsWith(ctx.BCAT_VAR_TIPO + ';'));
    ok(!!lineaAntes && /'Plan de Cuentas'!P:P/.test(lineaAntes),
        'la celda viva reproduce el bug medido por Franco (columna_tipo busca en P:P): ' + (lineaAntes || '').trim());

    const reparada = ctx._repararRangoTipoBcat(formulaViva);
    const lineaDespues = reparada.split('\n').find(l => l.trim().startsWith(ctx.BCAT_VAR_TIPO + ';'));
    ok(!!lineaDespues && /'Plan de Cuentas'!P:Q; 2; 0/.test(lineaDespues),
        'columna_tipo pasa a buscar en P:Q con indice 2: ' + (lineaDespues || '').trim());

    // No toca ninguna otra linea del LET: mismo largo de linea a linea salvo la del Tipo.
    const antesLineas = formulaViva.split('\n');
    const despLineas = reparada.split('\n');
    let otrasIguales = antesLineas.length === despLineas.length;
    if (otrasIguales) {
        for (let i = 0; i < antesLineas.length; i++) {
            if (antesLineas[i] === despLineas[i]) continue;
            if (antesLineas[i].trim().startsWith(ctx.BCAT_VAR_TIPO + ';')) continue;
            otrasIguales = false;
            break;
        }
    }
    ok(otrasIguales, 'cirugia de token: ninguna otra linea del LET cambio (ni siquiera tipo_proy)');

    const lineaTipoProyAntes = antesLineas.find(l => l.trim().startsWith('tipo_proy;'));
    const lineaTipoProyDespues = despLineas.find(l => l.trim().startsWith('tipo_proy;'));
    ok(!!lineaTipoProyAntes && lineaTipoProyAntes === lineaTipoProyDespues,
        'tipo_proy (misma forma rota, pero variable muerta) queda INTACTO a proposito: ' +
        (lineaTipoProyAntes || '').trim());

    ok(ctx._repararRangoTipoBcat(reparada) === reparada, 'idempotente: reparar una formula ya reparada no cambia nada');
}

console.log('\n=== 2. Derivado de RANGES, no hardcodeado (mutacion) ===');
{
    const original = { start: ctx.RANGES.PROYECTOS.start, end: ctx.RANGES.PROYECTOS.end, columns: Object.assign({}, ctx.RANGES.PROYECTOS.columns) };
    const sintetica = '=LET(' + ctx.BCAT_VAR_TIPO + '; ARRAYFORMULA(IFERROR(VLOOKUP(x; \'Plan de Cuentas\'!P:P; 2; 0); "")); ' + ctx.BCAT_VAR_TIPO + ')';

    // (a) con la geometria real (P:Q), corrige a P:Q/2.
    const conPQ = ctx._repararRangoTipoBcat(sintetica);
    ok(/'Plan de Cuentas'!P:Q; 2; 0/.test(conPQ), 'con RANGES.PROYECTOS=P:Q corrige a P:Q, indice 2');

    // (b) si RANGES.PROYECTOS creciera a P:R (una columna mas), tiene que corregir a P:R/3, no
    //     seguir clavado en "P:Q; 2" -- eso probaria que el rango esta hardcodeado en el modulo.
    ctx.RANGES.PROYECTOS.end = 'R';
    ctx.RANGES.PROYECTOS.columns = { nombre: 'P', tipo: 'R' };
    const conPR = ctx._repararRangoTipoBcat(sintetica);
    ok(/'Plan de Cuentas'!P:R; 3; 0/.test(conPR),
        'con RANGES.PROYECTOS mutado a P:R (tipo en R) corrige a P:R, indice 3 (prueba que deriva del config): ' +
        (conPR.match(/VLOOKUP\([^)]*\)/) || [''])[0]);

    // restaurar
    ctx.RANGES.PROYECTOS.start = original.start;
    ctx.RANGES.PROYECTOS.end = original.end;
    ctx.RANGES.PROYECTOS.columns = original.columns;
    ok(/'Plan de Cuentas'!P:Q; 2; 0/.test(ctx._repararRangoTipoBcat(sintetica)),
        'restaurado RANGES.PROYECTOS a P:Q, vuelve a corregir a P:Q/2 (sin estado colgado entre corridas)');
}

console.log('\n=== 3. Seguridad de entrada (no explota) ===');
ok(ctx._repararRangoTipoBcat(undefined) === undefined, '_repararRangoTipoBcat(undefined) no explota');
ok(ctx._repararRangoTipoBcat('') === '', '_repararRangoTipoBcat(\'\') no explota');
ok(ctx._repararRangoTipoBcat('=SUM(A1:A10)') === '=SUM(A1:A10)', 'formula sin relacion no matchea y vuelve intacta');

console.log('\n=== 4. _diagnosticarBcat contra la celda viva: reproduce el estado medido ===');
if (formulaViva) {
    const diag = ctx._diagnosticarBcat(formulaViva);
    ok(diag.grupoCambia === false,
        'grupoCambia=false: la cascada de categoria (proyecto) YA esta aplicada en la celda viva ' +
        '(si esto da true, la planilla real diverge de lo medido -- parar y mirar, no asumir)');
    ok(diag.tipoCambia === true,
        'tipoCambia=true: el rango del Tipo hace falta repararlo, tal como midio Franco');
    const diag2 = ctx._diagnosticarBcat(diag.formulaNueva);
    ok(!diag2.grupoCambia && !diag2.tipoCambia, 'idempotente combinado: aplicar el diagnostico dos veces no deja nada pendiente');
}

console.log('\n=== 5. _contarCategoriasSinTipoBcat sobre una hoja simulada ===');
{
    const filas = [
        ['Vehiculo', 'Hogar'], ['Alimentacion', ''], ['', ''], ['Ahorro Meta 1', 'Ahorros'],
        ['Sin tipo', ''], ['Deuda tarjeta', 'Financiacion']
    ];
    const ssFalso = {
        getSheetByName: (n) => n === ctx.RANGES.PROYECTOS.sheet ? {
            getMaxRows: () => ctx._RANGES_TEST_FILA_DATOS + filas.length - 1,
            getRange: () => ({ getValues: () => filas })
        } : null
    };
    ctx._RANGES_TEST_FILA_DATOS = ctx.getDataRow ? ctx.getDataRow(ctx.RANGES.PROYECTOS) : 8;
    const r = ctx._contarCategoriasSinTipoBcat(ssFalso);
    ok(!!r && r.total === 5, 'cuenta 5 categorias CON nombre (la fila vacia no cuenta): total=' + (r && r.total));
    ok(!!r && r.sinTipo === 2, 'de esas, 2 sin Tipo (Alimentacion y "Sin tipo"): sinTipo=' + (r && r.sinTipo));

    const rSinHoja = ctx._contarCategoriasSinTipoBcat({ getSheetByName: () => null });
    ok(rSinHoja === null, 'sin la hoja del Plan de Cuentas, devuelve null en vez de explotar');
}

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
