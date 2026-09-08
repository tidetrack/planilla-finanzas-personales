/**
 * devtools/probar_mirada_meses_grafico.js
 * Banco de pruebas de v0.67.0 "Mirada Interanual: meses con nombre y grafico de tendencias"
 * (src/07_MiradaInteranual.js). Node puro: sin red, sin SpreadsheetApp.
 *
 * [CONCEPTO DE NEGOCIO]
 * La Mirada Interanual es la unica vista de la planilla cuyas formulas las escribe el codigo.
 * Este banco prueba, ANTES de que el modulo toque la planilla productiva, que (a) lo que el
 * modulo construye para G8:R11 es IDENTICO a lo que la hoja ya guarda (el boton "Reescribir
 * formulas" es entonces un no-op seguro), (b) la formula de la fila de meses es, caracter a
 * caracter, la de la especificacion, y su gemela en JS produce las etiquetas esperadas, y (c)
 * el grafico se especifica sobre las celdas correctas con colores de la lista blanca del
 * brandbook Y el constructor del chart consume esa especificacion (no una copia).
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Convenciones de la casa: RAIZ se deriva de __dirname (un banco con ruta absoluta valida el
 * src de otro worktree); el modulo se carga del archivo real con vm.runInContext (una copia
 * en el banco es un banco verde sobre codigo que no corre); las coordenadas que se prueban
 * SALEN de las constantes del modulo, nunca se repiten como literal aca (si el modulo apunta
 * mal, el banco apunta mal y lo dice contra el gemelo); la paleta se EXTRAE de
 * devtools/probar_shell.js, no se copia. Las EXPECTATIVAS de la spec (colores por nombre de
 * serie, filas 8..11, selectores I2/I3/I4, texto de la formula de mes) si son literales: son
 * lo que Franco pidio, no una coordenada copiada del modulo.
 *
 * NORMALIZACION DE COMILLAS (T1): el modulo escribe 'Registros'!$H$7:$H (comillas siempre,
 * porque el nombre puede resolverse por alias y traer espacios). Sheets le SACA las comillas a
 * un nombre que no las necesita y guarda Registros!$H$7:$H, que es lo que el gemelo exporta.
 * Se normaliza en ESE sentido (se quitan las comillas a lo que arma el modulo) porque es la
 * unica direccion determinista: el banco no tiene forma de saber que nombres Sheets habria
 * dejado con comillas para ponerselas al gemelo.
 *
 * EL BANCO SE PRUEBA A SI MISMO (T7, las tres direcciones de un guard): ademas del verde
 * sobre el modulo real, carga en memoria copias SABOTEADAS del modulo y exige que el chequeo
 * que protege cada cosa FALLE sobre ellas. El sabotaje se confirma sobre los VALORES que ve
 * el modulo cargado, no sobre el texto (un "= 10;" tambien matchea otra constante). Verificado
 * el 2026-09-07:
 *   - selector de mes vuelto a E4, fila de Ingresos vuelta a 10, sufijo en false: T1 detecta
 *     el diff en la primera referencia y T2 detecta 'Enero' donde debia decir 'Enero 27';
 *   - M13 (el IF del sufijo compara contra el selector de MES) y M14 (offset corrido en +1):
 *     T3 los pone en rojo con el diff de caracteres contra la formula dorada (en la ronda 1
 *     del banco pasaban en verde: T3 solo miraba substrings);
 *   - M26 (setTransposeRowsAndColumns(false) literal), M27 (setPosition(13, 3) literal) y
 *     M29 (sin addRange del rango de rotulos): T4b los pone en rojo porque EJECUTA
 *     _construirGraficoMirada con un builder grabador (en la ronda 1 pasaban en verde: el banco
 *     solo miraba la especificacion pura);
 *   - M12 (swap de colores Ingresos <-> Capitalizacion, ambos en la lista blanca): T4 lo pone
 *     en rojo por la tabla de colores POR NOMBRE de serie.
 * Si un sabotaje no hace fallar al chequeo, el banco sale en rojo: un guard que no dispara no
 * protege nada.
 *
 * USO:  node devtools/probar_mirada_meses_grafico.js   (exit 0 si pasa, 1 si algo sale mal)
 *
 * @version 1.1.0
 * @since 2026-09-07
 * @lastModified 2026-09-07
 * @see src/07_MiradaInteranual.js
 * @see src/00_Config.js (MENU_CONFIG.DEV_ITEMS, submenu 'Mirada Interanual')
 * @see docs/permanente/celdas.tsv (gemelo digital: formulas reales contra las que se prueba)
 * @see devtools/probar_shell.js (PALETA: lista blanca del brandbook Ed.03)
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };
const seccion = (t) => console.log('\n== ' + t + ' ==');

// ============================================
// Carga del modulo real con stubs de Apps Script
// ============================================
const EXPORTS = `
;Object.assign(globalThis, {
  MIRADA_MESES, MIRADA_COL_REFERENCIA, MIRADA_COLS_VISTA, MIRADA_FILA_MESES, MIRADA_FILA_INGRESOS,
  MIRADA_FILA_GASTOS_FIJOS, MIRADA_FILA_GASTOS_VARIABLES, MIRADA_FILA_RESULTADO, MIRADA_COL_ROTULOS,
  MIRADA_ROTULOS_ESPERADOS, MIRADA_ROTULO_RESULTADO, MIRADA_CELDA_SEL_MES, MIRADA_CELDA_SEL_ANIO,
  MIRADA_CELDA_SEL_MONEDA, MIRADA_ANIO_MIN, MIRADA_ANIO_MAX, MIRADA_MESES_SUFIJO_ANIO,
  MIRADA_CELDA_TITULO_GRAFICO, MIRADA_ROTULO_TITULO_GRAFICO, MIRADA_GRAFICO_FILA_INICIO,
  MIRADA_GRAFICO_FILA_FIN, MIRADA_GRAFICO_COL_INICIO, MIRADA_GRAFICO_COL_FIN, MIRADA_GRAFICO_SERIES,
  construirFormulaMirada, construirFormulaMesMirada, auditarBalanceFormulaMirada,
  _argumentosFormulaDatosMirada, _formulasResultadoMirada, _etiquetasMesesEsperadasMirada,
  _especificacionGraficoMirada, _dimensionesGraficoMirada, _construirGraficoMirada,
  _alineacionAplicableMirada, _alineacionRestaurableMirada, _refAbsolutaMirada, _numeroColumnaMirada
});`;

// Stubs de los enums de Charts: valores distinguibles para que el grabador pueda afirmar que
// el constructor paso EXACTAMENTE el miembro esperado (y no un string parecido).
const CHARTS_STUB = {
    ChartType: { LINE: 'ChartType.LINE', COLUMN: 'ChartType.COLUMN' },
    ChartMergeStrategy: { MERGE_COLUMNS: 'ChartMergeStrategy.MERGE_COLUMNS', MERGE_ROWS: 'ChartMergeStrategy.MERGE_ROWS' }
};

function cargarModulo(fuente) {
    const ctx = {
        console,
        SHEETS: { MIRADA_INTERANUAL: 'Mirada Interanual', DEBUG_MIRADA: 'DEBUG Mirada', REGISTROS: 'Registros' },
        MONEDAS_DISPONIBLES: ['ARS', 'USD', 'AUD', 'EUR'],
        RANGES: {
            REGISTROS: {
                sheet: 'Registros', start: 'B', end: 'M', headerRow: 6, dataRow: 7,
                columns: { monto: 'B', tipo: 'C', cuenta: 'D', tipo_cuenta: 'E', medio: 'F', moneda: 'G',
                           fecha: 'H', nota: 'I', tc_ars: 'J', tc_usd: 'K', tc_aud: 'L', tc_eur: 'M' }
            }
        },
        logInfo() {}, logError() {}, logSuccess() {},
        SpreadsheetApp: {}, Charts: CHARTS_STUB
    };
    vm.createContext(ctx);
    vm.runInContext(fuente + EXPORTS, ctx, { filename: '07_MiradaInteranual.js' });
    return ctx;
}

const fuenteModulo = fs.readFileSync(path.join(RAIZ, 'src/07_MiradaInteranual.js'), 'utf8');
const M = cargarModulo(fuenteModulo);

// ============================================
// Gemelo digital: formulas reales de la hoja
// ============================================
const HOJA = 'Mirada Interanual';
const F = {};
for (const linea of fs.readFileSync(path.join(RAIZ, 'docs/permanente/celdas.tsv'), 'utf8').split('\n')) {
    const p = linea.split('\t');
    if (p.length < 4 || p[0] !== HOJA) continue;
    if (p[2]) F[p[1]] = p[2].replace(/\\\\/g, '\x00').replace(/\\n/g, '\n').replace(/\x00/g, '\\');
}

/** Sheets guarda Registros!$H$7:$H; el modulo escribe 'Registros'!$H$7:$H (ver cabecera). */
function normalizarComillasHoja(formula) {
    return formula.replace(/'([A-Za-z0-9_]+)'!/g, '$1!');
}

function primerDiff(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return { pos: i, a: a.substring(Math.max(0, i - 25), i + 40), b: b.substring(Math.max(0, i - 25), i + 40) };
}

/** Separa una formula por el separador de nivel superior, respetando comillas y parentesis. */
function partesNivelSuperior(cuerpo, sep) {
    const partes = [];
    let nivel = 0, enStr = false, actual = '';
    for (const ch of cuerpo) {
        if (ch === '"') enStr = !enStr;
        if (!enStr) {
            if (ch === '(') nivel++;
            else if (ch === ')') nivel--;
            else if (ch === sep && nivel === 0) { partes.push(actual); actual = ''; continue; }
        }
        actual += ch;
    }
    partes.push(actual);
    return partes;
}

function fueraDeComillas(formula) {
    let enStr = false, out = '';
    for (const ch of formula) {
        if (ch === '"') { enStr = !enStr; continue; }
        if (!enStr) out += ch;
    }
    return out;
}

// ============================================
// T1: lo que construye el modulo para G8:R11 es IDENTICO a lo que la hoja guarda
// ============================================
/** @returns {{ok:boolean, detalle:string[]}} sobre el contexto dado (real o saboteado) */
function chequearT1(ctx) {
    const detalle = [];
    const filas = ctx.MIRADA_ROTULOS_ESPERADOS.map(r => r.fila);
    const colOrigen = ctx.MIRADA_COLS_VISTA[0];
    let todoOk = true;
    // El offset se arma como lo hace inicializarMiradaInteranual: con la fila ORIGEN del bloque.
    const offset = ctx._argumentosFormulaDatosMirada(ctx.MIRADA_FILA_INGRESOS).offsetExpr;
    filas.forEach(fila => {
        const celda = colOrigen + fila;
        const real = F[celda];
        if (!real) { detalle.push(celda + ': el gemelo no tiene formula en esa celda'); todoOk = false; return; }
        const rotulo = ctx._argumentosFormulaDatosMirada(fila).rotuloExpr;
        const construida = normalizarComillasHoja(ctx.construirFormulaMirada(rotulo, offset, '', ';'));
        if (construida !== real) {
            const d = primerDiff(construida, real);
            detalle.push(celda + ': difiere en la posicion ' + d.pos + '\n        modulo: ...' + d.a + '...\n        gemelo: ...' + d.b + '...');
            todoOk = false;
        } else {
            detalle.push(celda + ': identica al gemelo (' + real.length + ' caracteres, separador ";")');
        }
    });
    const celdaResultado = colOrigen + ctx.MIRADA_FILA_RESULTADO;
    const resultado = ctx._formulasResultadoMirada()[0];
    if (resultado !== F[celdaResultado]) {
        detalle.push(celdaResultado + ': el modulo arma [' + resultado + '] y el gemelo guarda [' + F[celdaResultado] + ']');
        todoOk = false;
    } else {
        detalle.push(celdaResultado + ': ' + resultado + ' (igual al gemelo)');
    }
    return { ok: todoOk, detalle };
}

seccion('T1. Boton 2 es un no-op seguro: formulas del modulo == formulas reales de la hoja');
{
    const r = chequearT1(M);
    r.detalle.forEach(d => ok(!/difiere|no tiene|arma \[/.test(d), d));
    ok(r.ok, 'T1 en conjunto');
}

// ============================================
// T2: etiquetas esperadas en JS
// ============================================
/** @returns {{ok:boolean, detalle:string[]}} */
function chequearT2(ctx) {
    const detalle = [];
    let todoOk = true;
    const casos = [
        ['Mayo', 2026, ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']],
        ['Agosto', 2026, ['Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero 27', 'Febrero 27', 'Marzo 27']],
        ['Enero', 2026, ['Septiembre 25', 'Octubre 25', 'Noviembre 25', 'Diciembre 25', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto']],
        ['Diciembre', 2026, ['Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero 27', 'Febrero 27', 'Marzo 27', 'Abril 27', 'Mayo 27', 'Junio 27', 'Julio 27']],
        ['MAYO', 2026, ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']]
    ];
    casos.forEach(([mes, anio, esperado]) => {
        let obtenido;
        try { obtenido = ctx._etiquetasMesesEsperadasMirada(mes, anio); }
        catch (e) { detalle.push('(' + mes + ', ' + anio + ') lanzo: ' + e.message); todoOk = false; return; }
        const igual = obtenido.length === 12 && obtenido.every((v, i) => v === esperado[i]);
        if (!igual) {
            const i = obtenido.findIndex((v, k) => v !== esperado[k]);
            detalle.push('(' + mes + ', ' + anio + ') difiere en la columna ' + ctx.MIRADA_COLS_VISTA[i] +
                ': se esperaba [' + esperado[i] + '] y dio [' + obtenido[i] + ']');
            todoOk = false;
        } else {
            detalle.push('(' + mes + ', ' + anio + ') -> ' + obtenido.join(', '));
        }
    });
    return { ok: todoOk, detalle };
}

seccion('T2. _etiquetasMesesEsperadasMirada: la gemela en JS de la formula de mes');
{
    const r = chequearT2(M);
    r.detalle.forEach(d => ok(!/difiere|lanzo/.test(d), d));
    const lanza = (fn) => { try { fn(); return false; } catch (e) { return true; } };
    ok(lanza(() => M._etiquetasMesesEsperadasMirada('Mayonesa', 2026)), 'mes invalido lanza');
    ok(lanza(() => M._etiquetasMesesEsperadasMirada('', 2026)), 'mes vacio lanza');
    ok(lanza(() => M._etiquetasMesesEsperadasMirada('Mayo', M.MIRADA_ANIO_MAX + 1)), 'anio por encima de MIRADA_ANIO_MAX lanza');
    ok(lanza(() => M._etiquetasMesesEsperadasMirada('Mayo', M.MIRADA_ANIO_MIN - 1)), 'anio por debajo de MIRADA_ANIO_MIN lanza');
    ok(lanza(() => M._etiquetasMesesEsperadasMirada('Mayo', 2026.5)), 'anio no entero lanza');
    ok(lanza(() => M._etiquetasMesesEsperadasMirada('Mayo', '2026')), 'anio como texto lanza (la entrada de menu lo parsea antes)');
    ok(r.ok, 'T2 en conjunto');
}

// ============================================
// T3: la formula de mes, las dos variantes de separador, contra la formula DORADA de la spec
// ============================================
/**
 * Formula dorada: el texto de la especificacion B de v0.67.0, armado aca desde las referencias
 * derivadas de las constantes del modulo y MIRADA_MESES. Es una expectativa de la spec (lo que
 * Franco pidio), no una copia del modulo: si el modulo cambia el orden de un argumento, el IF
 * del sufijo o el offset, esto lo dice con el diff de caracteres.
 */
function formulaMesDorada(ctx, s) {
    const refMes = ctx._refAbsolutaMirada(ctx.MIRADA_CELDA_SEL_MES);
    const refAnio = ctx._refAbsolutaMirada(ctx.MIRADA_CELDA_SEL_ANIO);
    const refCol = ctx._refAbsolutaMirada(ctx.MIRADA_COL_REFERENCIA + ctx.MIRADA_FILA_MESES);
    const lista = 'SPLIT("' + ctx.MIRADA_MESES + '"' + s + '",")';
    const salida = ctx.MIRADA_MESES_SUFIJO_ANIO
        ? 'IF(YEAR(f_obj)=' + refAnio + s + 'nom_mes' + s + 'nom_mes&" "&RIGHT(YEAR(f_obj)' + s + '2))'
        : 'nom_mes';
    return '=LET(mes_num' + s + 'MATCH(' + refMes + s + lista + s + '0)' + s +
        'f_obj' + s + 'EDATE(DATE(' + refAnio + s + 'mes_num' + s + '1)' + s + 'COLUMN()-COLUMN(' + refCol + '))' + s +
        'nom_mes' + s + 'PROPER(INDEX(' + lista + s + '1' + s + 'MONTH(f_obj)))' + s +
        salida + ')';
}

/** @returns {{ok:boolean, detalle:string[]}} igualdad caracter a caracter con la dorada, en ambos separadores */
function chequearT3(ctx) {
    const detalle = [];
    let todoOk = true;
    [',', ';'].forEach(sep => {
        const f = ctx.construirFormulaMesMirada(sep);
        const dorada = formulaMesDorada(ctx, sep);
        if (f !== dorada) {
            const d = primerDiff(f, dorada);
            detalle.push('(' + sep + ') difiere de la formula dorada en la posicion ' + d.pos +
                '\n        modulo: ...' + d.a + '...\n        dorada: ...' + d.b + '...');
            todoOk = false;
        } else {
            detalle.push('(' + sep + ') identica a la formula dorada de la spec (' + f.length + ' caracteres)');
        }
    });
    return { ok: todoOk, detalle };
}

seccion('T3. construirFormulaMesMirada: formula dorada, balance, referencias, separadores, nombres de LET');
{
    const FUNCIONES_SHEETS = ['N', 'OFFSET', 'ROW', 'COLUMN', 'DATE', 'MONTH', 'YEAR', 'TEXT', 'INDEX', 'MATCH',
        'SPLIT', 'EDATE', 'PROPER', 'RIGHT', 'LEFT', 'IF', 'LET', 'SUM', 'SUMPRODUCT', 'DAY', 'NOW', 'TODAY',
        'VALUE', 'T', 'AND', 'OR', 'NOT', 'MID', 'LEN', 'UPPER', 'LOWER', 'ROUND', 'ABS', 'MAX', 'MIN',
        'COUNT', 'NA', 'ISNA', 'IFERROR', 'CHOOSE', 'FILTER', 'QUERY', 'UNIQUE', 'SORT', 'SEQUENCE'];
    const refMes = M._refAbsolutaMirada(M.MIRADA_CELDA_SEL_MES);
    const refAnio = M._refAbsolutaMirada(M.MIRADA_CELDA_SEL_ANIO);
    const refCol = M._refAbsolutaMirada(M.MIRADA_COL_REFERENCIA + M.MIRADA_FILA_MESES);
    const meses = M.MIRADA_MESES.split(',');

    const dor = chequearT3(M);
    dor.detalle.forEach(d => ok(!/difiere/.test(d), d));

    [',', ';'].forEach(sep => {
        const otro = sep === ',' ? ';' : ',';
        const f = M.construirFormulaMesMirada(sep);
        console.log('  formula (' + sep + '): ' + f);
        const bal = M.auditarBalanceFormulaMirada(f);
        ok(bal.ok, '(' + sep + ') balance de comillas y parentesis OK');
        ok(f.indexOf(refMes) > -1 && f.indexOf(refAnio) > -1 && f.indexOf(refCol) > -1,
            '(' + sep + ') contiene ' + refMes + ', ' + refAnio + ' y ' + refCol + ' (derivadas de las constantes)');
        // Semantica minima aun sin la dorada: el offset se calcula contra la celda de referencia
        // SIN corrimiento y el sufijo compara contra el selector de ANIO (mutaciones M14 y M13).
        ok(f.indexOf('EDATE(DATE(' + refAnio + sep + 'mes_num' + sep + '1)' + sep + 'COLUMN()-COLUMN(' + refCol + '))') > -1,
            '(' + sep + ') EDATE con offset COLUMN()-COLUMN(' + refCol + ') sin corrimiento');
        if (M.MIRADA_MESES_SUFIJO_ANIO) {
            ok(f.indexOf('IF(YEAR(f_obj)=' + refAnio + sep + 'nom_mes' + sep) > -1,
                '(' + sep + ') el sufijo compara YEAR(f_obj) contra el selector de ANIO ' + refAnio);
        }
        ok(!/\$E\$4|\$F\$4|\$R\$4|\$K\$10/.test(f), '(' + sep + ') no contiene las referencias viejas ($E$4, $F$4, $R$4, $K$10)');
        ok(f.indexOf('{') < 0 && f.indexOf('}') < 0, '(' + sep + ') sin array literal {...}');
        ok(fueraDeComillas(f).indexOf(otro) < 0, '(' + sep + ') ningun "' + otro + '" fuera de comillas');
        ok(f.startsWith('=LET(') && f.endsWith(')'), '(' + sep + ') es un LET completo');
        const cuerpo = f.substring('=LET('.length, f.length - 1);
        const partes = partesNivelSuperior(cuerpo, sep);
        ok(partes.length % 2 === 1 && partes.length >= 3, '(' + sep + ') LET con pares nombre/valor y una expresion final (' + partes.length + ' partes)');
        const nombres = partes.filter((_, i) => i % 2 === 0 && i < partes.length - 1);
        nombres.forEach(n => {
            ok(/^[a-z_][a-z0-9_]*$/.test(n), '(' + sep + ') nombre de LET "' + n + '" es un identificador simple en minusculas');
            ok(FUNCIONES_SHEETS.indexOf(n.toUpperCase()) < 0, '(' + sep + ') nombre de LET "' + n + '" no colisiona con una funcion de Sheets');
        });
        ok(meses.every(m => f.indexOf(m) > -1), '(' + sep + ') los 12 nombres de MIRADA_MESES aparecen en la formula');
        ok(f.indexOf('PROPER(') > -1, '(' + sep + ') usa PROPER (estilo del selector: "Mayo")');
        if (M.MIRADA_MESES_SUFIJO_ANIO) {
            ok(f.indexOf('RIGHT(YEAR(f_obj)' + sep + '2)') > -1, '(' + sep + ') con MIRADA_MESES_SUFIJO_ANIO=true agrega el anio en dos digitos');
        }
    });
    ok(M.construirFormulaMesMirada() === M.construirFormulaMesMirada(','), 'sin argumento equivale a ","');
    const conPrefijo = M.construirFormulaMesMirada(';', "'Mirada Interanual'!");
    ok(conPrefijo.indexOf("'Mirada Interanual'!" + refMes) > -1, 'el prefijo de hoja (diagnostico) se aplica a los selectores');
    ok(dor.ok, 'T3 dorada en conjunto');
}

// ============================================
// T4: especificacion pura del grafico
// ============================================
// Expectativa de la spec C.5 (y del changelog v0.67.0): un color por NOMBRE de serie. La
// pertenencia a la PALETA no alcanza: un swap Ingresos <-> Capitalizacion (ambos en la lista
// blanca) deja la leyenda contradiciendo la documentacion sin que nada lo diga (mutacion M12).
const COLOR_ESPERADO_POR_SERIE = {
    'Ingresos': '#1D6A4F',
    'Gastos Fijos': '#B84A3E',
    'Gastos Variables': '#6B4A18',
    'Capitalizaci\u00f3n': '#182040'
};

/** @returns {{ok:boolean, detalle:string[]}} asignacion de color por nombre de serie */
function chequearColoresPorSerie(ctx) {
    const detalle = [];
    let todoOk = true;
    const spec = ctx._especificacionGraficoMirada();
    spec.series.forEach(s => {
        const esperado = COLOR_ESPERADO_POR_SERIE[s.nombre];
        if (!esperado) { detalle.push('serie "' + s.nombre + '" no tiene color esperado en la spec'); todoOk = false; return; }
        if (String(s.color).toUpperCase() !== esperado) {
            detalle.push('serie "' + s.nombre + '" tiene el color ' + s.color + ' y la spec fija ' + esperado);
            todoOk = false;
        } else {
            detalle.push('serie "' + s.nombre + '" color ' + s.color + ' = el de la spec');
        }
    });
    return { ok: todoOk, detalle };
}

seccion('T4. _especificacionGraficoMirada: rangos, series, ancla, tamano y paleta');
{
    const shellSrc = fs.readFileSync(path.join(RAIZ, 'devtools/probar_shell.js'), 'utf8');
    const ini = shellSrc.indexOf('const PALETA = {');
    const fin = shellSrc.indexOf('};', ini);
    ok(ini > -1 && fin > ini, 'PALETA extraida de devtools/probar_shell.js (no copiada)');
    const PALETA = new Set([...shellSrc.slice(ini, fin).matchAll(/'(#[0-9A-Fa-f]{6})'\s*:/g)].map(m => m[1].toUpperCase()));
    ok(PALETA.size >= 8, 'la lista blanca tiene al menos 8 colores (' + PALETA.size + ')');

    const spec = M._especificacionGraficoMirada();
    const rotulosEsperado = M.MIRADA_COL_ROTULOS + M.MIRADA_FILA_MESES + ':' + M.MIRADA_COL_ROTULOS + M.MIRADA_FILA_RESULTADO;
    const datosEsperado = M.MIRADA_COLS_VISTA[0] + M.MIRADA_FILA_MESES + ':' + M.MIRADA_COLS_VISTA[M.MIRADA_COLS_VISTA.length - 1] + M.MIRADA_FILA_RESULTADO;
    ok(spec.rangoRotulos === rotulosEsperado, 'rango de rotulos derivado de las constantes: ' + spec.rangoRotulos);
    ok(spec.rangoDatos === datosEsperado, 'rango de datos derivado de las constantes: ' + spec.rangoDatos);
    ok(spec.rangos.length === 2 && spec.rangos[0] === spec.rangoRotulos && spec.rangos[1] === spec.rangoDatos, 'rangos = [rotulos, datos]');
    // Con la geometria medida en vivo estos rangos son C7:C11 y G7:R11: se dice, no se asume.
    console.log('  (con la geometria actual: ' + spec.rangoRotulos + ' y ' + spec.rangoDatos + ')');

    const filasEsperadas = [];
    for (let f = M.MIRADA_FILA_MESES + 1; f <= M.MIRADA_FILA_RESULTADO; f++) filasEsperadas.push(f);
    ok(spec.series.length === 4, '4 series');
    ok(spec.series.map(s => s.fila).join(',') === filasEsperadas.join(','), 'series en el orden de las filas ' + filasEsperadas.join(', '));
    const nombresEsperados = M.MIRADA_ROTULOS_ESPERADOS.map(r => r.rotulo).concat([M.MIRADA_ROTULO_RESULTADO]);
    ok(spec.series.map(s => s.nombre).join('|') === nombresEsperados.join('|'), 'nombres de serie = rotulos esperados: ' + nombresEsperados.join(', '));
    ok(spec.transponer === true, 'transponer = true (cada FILA es una serie)');
    ok(spec.encabezados === 1, 'encabezados = 1 (la fila de meses)');
    ok(spec.mergeStrategy === 'MERGE_COLUMNS' && CHARTS_STUB.ChartMergeStrategy[spec.mergeStrategy],
        'mergeStrategy = MERGE_COLUMNS (C7:C11 y G7:R11 lado a lado como 5 x 13), explicito y miembro del enum');
    ok(spec.anclaFila === 14 && spec.anclaCol === 3, 'ancla fila 14, columna 3 (C): ' + spec.anclaFila + '/' + spec.anclaCol);
    ok(spec.anclaFila === M.MIRADA_GRAFICO_FILA_INICIO && spec.anclaCol === M._numeroColumnaMirada(M.MIRADA_GRAFICO_COL_INICIO), 'ancla derivada de las constantes');
    ok(spec.filaFin === 21 && spec.colFin === 'R' && spec.colFinNumero === 18, 'ultima fila 21, ultima columna R (18)');
    spec.series.forEach(s => {
        ok(PALETA.has(String(s.color).toUpperCase()), 'serie "' + s.nombre + '" color ' + s.color + ' esta en la lista blanca');
        ok(typeof s.lineWidth === 'number' && s.lineWidth > 0, 'serie "' + s.nombre + '" lineWidth ' + s.lineWidth);
    });
    const porSerie = chequearColoresPorSerie(M);
    porSerie.detalle.forEach(d => ok(!/tiene el color|no tiene color/.test(d), d));
    ok(PALETA.has(spec.fondo.toUpperCase()), 'fondo ' + spec.fondo + ' esta en la lista blanca');
    const capital = spec.series[spec.series.length - 1];
    ok(spec.series.slice(0, -1).every(s => s.lineWidth < capital.lineWidth), 'Capitalizacion lleva la linea mas gruesa');
    ok(spec.curva === 'none', 'curveType none (rectas)');
    ok(spec.formatoEjeV === '#,##0' && spec.formatoEjeV.indexOf(',') === 1, 'formato del eje canonico (#,##0)');
    ok(spec.leyenda === 'top', 'leyenda arriba');
}

// ============================================
// T4b: el constructor del chart CONSUME la especificacion (se ejecuta con stubs grabadores)
// ============================================
/**
 * Sheet y builder falsos que GRABAN cada llamada. El ancho de cada columna es 10*numero y el
 * alto de cada fila 3*numero: sumas deterministas que el banco puede recalcular por su cuenta.
 */
function sheetGrabador() {
    const llamadas = [];
    const builder = {};
    ['setChartType', 'addRange', 'setMergeStrategy', 'setTransposeRowsAndColumns', 'setNumHeaders',
        'setPosition', 'setOption'].forEach(n => {
        builder[n] = function () { llamadas.push([n].concat(Array.from(arguments))); return builder; };
    });
    builder.build = function () { llamadas.push(['build']); return { construidoPorElStub: true }; };
    const sheet = {
        getRange: (a1) => ({ a1: a1 }),
        newChart: () => builder,
        getColumnWidth: (c) => 10 * c,
        getRowHeight: (f) => 3 * f
    };
    return { sheet, llamadas };
}

/** @returns {{ok:boolean, detalle:string[]}} lo grabado por el builder contra la spec y dims */
function chequearT4b(ctx) {
    const detalle = [];
    let todoOk = true;
    const fila = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const { sheet, llamadas } = sheetGrabador();
    const spec = ctx._especificacionGraficoMirada();
    const dims = ctx._dimensionesGraficoMirada(sheet, spec);

    let anchoEsperado = 0;
    for (let c = spec.anclaCol; c <= spec.colFinNumero; c++) anchoEsperado += 10 * c;
    let altoEsperado = 0;
    for (let f = spec.anclaFila; f <= spec.filaFin; f++) altoEsperado += 3 * f;
    fila(dims.ancho === anchoEsperado && dims.alto === altoEsperado,
        'dimensiones = suma de anchos C..' + spec.colFin + ' por suma de altos ' + spec.anclaFila + '..' + spec.filaFin +
        ' medidos en el sheet (' + dims.ancho + 'x' + dims.alto + ')');

    let chart = null;
    try { chart = ctx._construirGraficoMirada(sheet, spec, dims); }
    catch (e) { fila(false, '_construirGraficoMirada lanzo con stubs: ' + e.message); return { ok: false, detalle }; }
    fila(chart && chart.construidoPorElStub === true, 'devuelve lo que build() del builder devolvio');
    fila(llamadas[llamadas.length - 1][0] === 'build', 'build() es la ultima llamada');

    const de = (n) => llamadas.filter(l => l[0] === n);
    const ranges = de('addRange').map(l => l[1] && l[1].a1);
    fila(ranges.join('|') === [spec.rangoRotulos, spec.rangoDatos].join('|'),
        'addRange recibio exactamente [' + spec.rangoRotulos + ', ' + spec.rangoDatos + '] en ese orden (recibio [' + ranges.join(', ') + '])');
    fila(de('setChartType').length === 1 && de('setChartType')[0][1] === CHARTS_STUB.ChartType.LINE, 'setChartType(Charts.ChartType.LINE)');
    fila(de('setMergeStrategy').length === 1 && de('setMergeStrategy')[0][1] === CHARTS_STUB.ChartMergeStrategy[spec.mergeStrategy],
        'setMergeStrategy(Charts.ChartMergeStrategy.' + spec.mergeStrategy + ')');
    const idxMerge = llamadas.findIndex(l => l[0] === 'setMergeStrategy');
    const idxUltimoRange = llamadas.map(l => l[0]).lastIndexOf('addRange');
    fila(idxMerge > idxUltimoRange, 'setMergeStrategy va despues del segundo addRange');
    fila(de('setTransposeRowsAndColumns').length === 1 && de('setTransposeRowsAndColumns')[0][1] === spec.transponer,
        'setTransposeRowsAndColumns(spec.transponer = ' + spec.transponer + ')');
    fila(de('setNumHeaders').length === 1 && de('setNumHeaders')[0][1] === spec.encabezados,
        'setNumHeaders(spec.encabezados = ' + spec.encabezados + ')');
    const pos = de('setPosition')[0] || [];
    fila(de('setPosition').length === 1 && pos[1] === spec.anclaFila && pos[2] === spec.anclaCol && pos[3] === 0 && pos[4] === 0,
        'setPosition(' + spec.anclaFila + ', ' + spec.anclaCol + ', 0, 0) (recibio ' + pos.slice(1).join(', ') + ')');

    const opciones = {};
    de('setOption').forEach(l => { opciones[l[1]] = l[2]; });
    fila(opciones.useFirstColumnAsDomain === true, 'setOption useFirstColumnAsDomain true');
    fila(opciones.curveType === spec.curva, 'setOption curveType = spec.curva (' + spec.curva + ')');
    fila(opciones.legend && opciones.legend.position === spec.leyenda, 'setOption legend.position = spec.leyenda (' + spec.leyenda + ')');
    fila(opciones.backgroundColor === spec.fondo, 'setOption backgroundColor = spec.fondo');
    fila(opciones.vAxis && opciones.vAxis.format === spec.formatoEjeV, 'setOption vAxis.format = spec.formatoEjeV (cinturon: no documentado en Apps Script)');
    fila(Array.isArray(opciones.colors) && opciones.colors.join('|') === spec.series.map(s => s.color).join('|'),
        'setOption colors = colores de las series en orden');
    const seriesOk = opciones.series && spec.series.every((s, i) =>
        opciones.series[i] && opciones.series[i].color === s.color && opciones.series[i].lineWidth === s.lineWidth);
    fila(!!seriesOk, 'setOption series[i] = {color, lineWidth} de cada serie, por posicion');
    fila(opciones.width === dims.ancho && opciones.height === dims.alto, 'setOption width/height = dims medidas');
    return { ok: todoOk, detalle };
}

seccion('T4b. _construirGraficoMirada ejecutado con stubs grabadores: consume la spec, no una copia');
{
    const r = chequearT4b(M);
    r.detalle.forEach(d => ok(!/^FALLA: /.test(d), d.replace(/^FALLA: /, '')));
    ok(r.ok, 'T4b en conjunto');
}

// ============================================
// T4c: la alineacion que se RESTAURA cae en el dominio del setter
// ============================================
seccion('T4c. _alineacionRestaurableMirada: solo left/center/right/normal/null llegan a setHorizontalAlignments');
{
    const DOMINIO = ['left', 'center', 'right', 'normal', null];
    const leidas = ['general', 'general-left', 'general-right', 'left', 'center', 'right', 'normal', '', null, undefined, 'LEFT', 'General-Right'];
    leidas.forEach(l => {
        const r = M._alineacionRestaurableMirada(l);
        ok(DOMINIO.indexOf(r) > -1, 'leida [' + String(l) + '] -> restaurable [' + String(r) + '] esta en el dominio del setter');
    });
    ok(M._alineacionRestaurableMirada('general') === null && M._alineacionRestaurableMirada('general-left') === null &&
        M._alineacionRestaurableMirada('general-right') === null, "'general*' (celda sin alineacion explicita) vuelve como null = reset");
    ok(M._alineacionRestaurableMirada('left') === 'left' && M._alineacionRestaurableMirada('center') === 'center' &&
        M._alineacionRestaurableMirada('right') === 'right', 'una alineacion explicita se repone tal cual');
    ok(M._alineacionRestaurableMirada('right') === M._alineacionAplicableMirada('right') &&
        M._alineacionRestaurableMirada('left') === M._alineacionAplicableMirada('left'),
        'para valores explicitos ida y vuelta usan el mismo mapeo');
    // Y lo que va hacia adelante (copia de K7) nunca es 'general*' tampoco.
    ['general', 'general-left', 'general-right', 'left', 'center', 'right', null].forEach(l => {
        ok(['left', 'center', 'right', 'normal'].indexOf(M._alineacionAplicableMirada(l)) > -1,
            'aplicable [' + String(l) + '] -> ' + M._alineacionAplicableMirada(l));
    });
}

// ============================================
// T5: coherencia geometrica de las constantes
// ============================================
seccion('T5. Coherencia geometrica de las constantes re-alineadas');
{
    const byFila = {};
    M.MIRADA_ROTULOS_ESPERADOS.forEach(r => { byFila[r.fila] = r; });
    ok(byFila[8] && byFila[8].rotulo === 'Ingresos' && byFila[8].tipoBd === 'Ingreso', 'fila 8: Ingresos / Ingreso');
    ok(byFila[9] && byFila[9].rotulo === 'Gastos Fijos' && byFila[9].tipoBd === 'Gasto Fijo', 'fila 9: Gastos Fijos / Gasto Fijo');
    ok(byFila[10] && byFila[10].rotulo === 'Gastos Variables' && byFila[10].tipoBd === 'Gasto Variable', 'fila 10: Gastos Variables / Gasto Variable');
    ok(M.MIRADA_FILA_INGRESOS === 8 && M.MIRADA_FILA_GASTOS_FIJOS === 9 && M.MIRADA_FILA_GASTOS_VARIABLES === 10, 'MIRADA_FILA_* = 8, 9, 10');
    ok(M.MIRADA_FILA_RESULTADO === 11 && M.MIRADA_ROTULO_RESULTADO === 'Capitalizaci\u00f3n', 'MIRADA_FILA_RESULTADO = 11, rotulo "Capitalizaci\u00f3n"');
    ok(M.MIRADA_FILA_MESES === 7, 'MIRADA_FILA_MESES = 7');
    ok(M.MIRADA_FILA_MESES < M.MIRADA_FILA_INGRESOS, 'la fila de meses esta por encima de la primera fila de datos');
    ok(M.MIRADA_CELDA_SEL_MES === 'I2' && M.MIRADA_CELDA_SEL_ANIO === 'I3' && M.MIRADA_CELDA_SEL_MONEDA === 'I4', 'selectores I2 / I3 / I4');
    ok(M.MIRADA_CELDA_TITULO_GRAFICO === 'C13' && M.MIRADA_ROTULO_TITULO_GRAFICO === 'Evoluci\u00f3n de Tendencias', 'titulo del grafico en C13 "Evoluci\u00f3n de Tendencias"');
    const filaBanda = parseInt(M.MIRADA_CELDA_TITULO_GRAFICO.replace(/^[A-Z]+/, ''), 10);
    ok(M.MIRADA_GRAFICO_FILA_INICIO === filaBanda + 1, 'la zona del grafico arranca justo debajo de la banda (' + (filaBanda + 1) + ')');
    ok(M.MIRADA_GRAFICO_FILA_INICIO > M.MIRADA_FILA_RESULTADO, 'la zona del grafico esta debajo de la tabla');
    ok(M.MIRADA_COL_REFERENCIA === 'K' && M.MIRADA_COLS_VISTA.indexOf('K') === 4, 'K es la referencia y ocupa la 5ta columna de la vista (offset -4)');
    ok(M.MIRADA_COLS_VISTA.length === 12, '12 columnas de vista');
    // Las coordenadas del gemelo tienen que existir donde el modulo dice (verificacion por ROTULO
    // del texto de celdas.tsv: si el gemelo se corrio, esto lo dice).
    const V = {};
    for (const linea of fs.readFileSync(path.join(RAIZ, 'docs/permanente/celdas.tsv'), 'utf8').split('\n')) {
        const p = linea.split('\t');
        if (p.length >= 4 && p[0] === HOJA) V[p[1]] = p[3];
    }
    M.MIRADA_ROTULOS_ESPERADOS.forEach(r => {
        const celda = M.MIRADA_COL_ROTULOS + r.fila;
        ok(String(V[celda] || '').toUpperCase() === r.rotulo.toUpperCase(), 'gemelo ' + celda + ' dice "' + V[celda] + '"');
    });
    ok(String(V[M.MIRADA_COL_ROTULOS + M.MIRADA_FILA_RESULTADO] || '').toUpperCase() === M.MIRADA_ROTULO_RESULTADO.toUpperCase(),
        'gemelo C' + M.MIRADA_FILA_RESULTADO + ' dice "' + V[M.MIRADA_COL_ROTULOS + M.MIRADA_FILA_RESULTADO] + '"');
    ok(String(V[M.MIRADA_CELDA_TITULO_GRAFICO] || '').toUpperCase() === M.MIRADA_ROTULO_TITULO_GRAFICO.toUpperCase(),
        'gemelo ' + M.MIRADA_CELDA_TITULO_GRAFICO + ' dice "' + V[M.MIRADA_CELDA_TITULO_GRAFICO] + '"');
}

// ============================================
// T6: menu
// ============================================
seccion('T6. MENU_CONFIG wirea inicializarMesesYGraficoMirada con aridad cero');
{
    const configSrc = fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8');
    const marca = "submenu: 'Mirada Interanual'";
    const ini = configSrc.indexOf(marca);
    const fin = configSrc.indexOf(']', ini);
    const bloque = ini > -1 ? configSrc.slice(ini, fin + 1) : '';
    const funciones = [...bloque.matchAll(/function:\s*'([^']+)'/g)].map(m => m[1]);
    ok(ini > -1, 'MENU_CONFIG declara el submenu "Mirada Interanual"');
    ok(funciones.indexOf('inicializarMesesYGraficoMirada') > -1, 'el submenu wirea inicializarMesesYGraficoMirada');
    ok(funciones[0] === 'inicializarMesesYGraficoMirada', 'es el primer item (lo que falta va primero)');
    ok(funciones.indexOf('inicializarMiradaInteranual') > -1 && funciones.indexOf('diagnosticarMiradaInteranual') > -1,
        'siguen wireadas inicializarMiradaInteranual y diagnosticarMiradaInteranual');
    ['inicializarMesesYGraficoMirada', 'inicializarMiradaInteranual', 'diagnosticarMiradaInteranual'].forEach(nombre => {
        const m = new RegExp('function\\s+' + nombre + '\\s*\\(([^)]*)\\)').exec(fuenteModulo);
        ok(m && m[1].trim() === '', '"' + nombre + '" declarada en el modulo con cero parametros');
    });
}

// ============================================
// T7: el banco se prueba a si mismo (un guard que no dispara no protege nada)
// ============================================
/** Aplica un reemplazo literal y exige que haya cambiado el texto (si no, el sabotaje no ocurrio). */
function sabotear(fuente, reemplazos) {
    let s = fuente;
    const noAplicados = [];
    reemplazos.forEach(([a, b]) => {
        const t = s.replace(a, b);
        if (t === s) noAplicados.push(a);
        s = t;
    });
    return { fuente: s, noAplicados };
}

seccion('T7. Sabotaje en memoria: cada chequeo tiene que FALLAR sobre el modulo que rompe lo que protege');
{
    // 7a. Geometria desalineada: T1 y T2 caen.
    const geo = sabotear(fuenteModulo, [
        ["const MIRADA_CELDA_SEL_MES = 'I2';", "const MIRADA_CELDA_SEL_MES = 'E4';"],
        ['const MIRADA_FILA_INGRESOS = 8;', 'const MIRADA_FILA_INGRESOS = 10;'],
        ['const MIRADA_MESES_SUFIJO_ANIO = true;', 'const MIRADA_MESES_SUFIJO_ANIO = false;']
    ]);
    ok(geo.noAplicados.length === 0, 'los tres reemplazos del sabotaje geometrico cambiaron el texto' +
        (geo.noAplicados.length ? ' (no aplicados: ' + geo.noAplicados.join(' | ') + ')' : ''));
    let S = null;
    try { S = cargarModulo(geo.fuente); } catch (e) { ok(false, 'la copia saboteada no carga: ' + e.message); }
    if (S) {
        // El sabotaje se confirma sobre los VALORES que ve el modulo cargado, no sobre el texto.
        ok(S.MIRADA_CELDA_SEL_MES === 'E4' && S.MIRADA_FILA_INGRESOS === 10 && S.MIRADA_MESES_SUFIJO_ANIO === false,
            'el modulo saboteado VE E4 / fila 10 / sufijo false (verificado sobre el contexto cargado)');
        const t1 = chequearT1(S);
        ok(!t1.ok, 'T1 FALLA sobre el modulo saboteado (' + (t1.detalle.find(d => /difiere/.test(d)) || 'sin diff').split('\n')[0] + ')');
        const t2 = chequearT2(S);
        ok(!t2.ok, 'T2 FALLA sobre el modulo saboteado (' + (t2.detalle.find(d => /difiere/.test(d)) || 'sin diff') + ')');
    }

    // 7b. Formula de mes con la semantica cambiada (M13: sufijo contra el selector de MES;
    //     M14: offset corrido en +1): T3 dorada cae en las dos.
    const m13 = sabotear(fuenteModulo, [["'IF(YEAR(f_obj)=' + selAnio", "'IF(YEAR(f_obj)=' + selMes"]]);
    ok(m13.noAplicados.length === 0, 'M13 aplicado (el IF del sufijo compara contra el selector de mes)');
    const m14 = sabotear(fuenteModulo, [["'COLUMN()-COLUMN(' + refCol + '))'", "'COLUMN()-COLUMN(' + refCol + ')+1)'"]]);
    ok(m14.noAplicados.length === 0, 'M14 aplicado (offset corrido en +1)');
    [['M13', m13], ['M14', m14]].forEach(([nombre, sab]) => {
        let C = null;
        try { C = cargarModulo(sab.fuente); } catch (e) { ok(false, nombre + ': la copia saboteada no carga: ' + e.message); }
        if (C) {
            const t3 = chequearT3(C);
            ok(!t3.ok, 'T3 FALLA sobre ' + nombre + ' (' + (t3.detalle.find(d => /difiere/.test(d)) || 'sin diff').split('\n')[0] + ')');
        }
    });

    // 7c. Constructor que ignora la spec (M26: transponer false literal; M27: ancla literal;
    //     M29: sin el rango de rotulos): T4b cae en las tres.
    const m26 = sabotear(fuenteModulo, [['.setTransposeRowsAndColumns(spec.transponer)', '.setTransposeRowsAndColumns(false)']]);
    const m27 = sabotear(fuenteModulo, [['.setPosition(spec.anclaFila, spec.anclaCol, 0, 0)', '.setPosition(13, 3, 0, 0)']]);
    const m29 = sabotear(fuenteModulo, [['        .addRange(sheet.getRange(spec.rangoRotulos))\n', '']]);
    [['M26', m26], ['M27', m27], ['M29', m29]].forEach(([nombre, sab]) => {
        ok(sab.noAplicados.length === 0, nombre + ' aplicado');
        let C = null;
        try { C = cargarModulo(sab.fuente); } catch (e) { ok(false, nombre + ': la copia saboteada no carga: ' + e.message); }
        if (C) {
            const t4b = chequearT4b(C);
            ok(!t4b.ok, 'T4b FALLA sobre ' + nombre + ' (' + (t4b.detalle.find(d => /^FALLA/.test(d)) || 'sin falla') + ')');
        }
    });

    // 7d. Swap de colores dentro de la lista blanca (M12): la tabla por nombre de serie cae.
    const m12 = sabotear(fuenteModulo, [
        ["{ fila: MIRADA_FILA_INGRESOS, color: '#1D6A4F'", "{ fila: MIRADA_FILA_INGRESOS, color: '#182040'"],
        ["{ fila: MIRADA_FILA_RESULTADO, color: '#182040'", "{ fila: MIRADA_FILA_RESULTADO, color: '#1D6A4F'"]
    ]);
    ok(m12.noAplicados.length === 0, 'M12 aplicado (swap de colores Ingresos <-> Capitalizacion)');
    let C12 = null;
    try { C12 = cargarModulo(m12.fuente); } catch (e) { ok(false, 'M12: la copia saboteada no carga: ' + e.message); }
    if (C12) {
        const col = chequearColoresPorSerie(C12);
        ok(!col.ok, 'T4 (colores por serie) FALLA sobre M12 (' + (col.detalle.find(d => /tiene el color/.test(d)) || 'sin diff') + ')');
    }
}

// ============================================
console.log('\n' + '='.repeat(50));
if (fallas === 0) {
    console.log('TODO OK. 0 fallas.');
    process.exit(0);
} else {
    console.log(fallas + ' falla(s). Revisar arriba.');
    process.exit(1);
}
