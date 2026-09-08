/**
 * devtools/probar_mirada_meses_grafico.js
 * Banco de pruebas de v0.68.0 "Mirada Interanual: meses con nombre y grafico de tendencias"
 * (src/07_MiradaInteranual.js). Node puro: sin red, sin SpreadsheetApp.
 *
 * [CONCEPTO DE NEGOCIO]
 * La Mirada Interanual es la unica vista de la planilla cuyas formulas las escribe el codigo.
 * Este banco prueba, ANTES de que el modulo toque la planilla productiva, que (a) lo que el
 * modulo construye para G8:R11 es IDENTICO a lo que la hoja ya guarda (el boton "Reescribir
 * formulas" es entonces un no-op seguro), (b) la formula de la fila de meses es, caracter a
 * caracter, la de la especificacion, y su gemela en JS produce las etiquetas esperadas, (c)
 * el grafico se especifica sobre las celdas correctas con colores de la lista blanca del
 * brandbook Y el constructor del chart consume esa especificacion (no una copia), y (d) la
 * ENTRADA DE MENU ENTERA, ejecutada contra un doble de hoja en memoria, cumple su contrato de
 * escritura en siete direcciones distintas (T8).
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
 *     en rojo por la tabla de colores POR NOMBRE de serie;
 *   - M30 (la restauracion repone la alineacion CRUDA de getHorizontalAlignments, o sea el fix
 *     de la ronda anterior revertido), M31 (el preflight deja de bloquear) y M32 (no se retiran
 *     los graficos previos): T8 (g), T8 (c) y T8 (b) los ponen en rojo. Sin ellos esos tres
 *     comportamientos no tenian un solo chequeo -- el fix de alineacion era codigo muerto que
 *     nadie extranaba.
 * Si un sabotaje no hace fallar al chequeo, el banco sale en rojo: un guard que no dispara no
 * protege nada.
 *
 * USO:  node devtools/probar_mirada_meses_grafico.js   (exit 0 si pasa, 1 si algo sale mal)
 *
 * @version 1.2.0
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
  _alineacionAplicableMirada, _alineacionRestaurableMirada, _refAbsolutaMirada, _numeroColumnaMirada,
  verificarPrecondicionesMirada, _verificarPrecondicionesMesesGraficoMirada, inicializarMesesYGraficoMirada
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
 * Formula dorada: el texto de la especificacion B de v0.68.0, armado aca desde las referencias
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
// Expectativa de la spec C.5 (y del changelog v0.68.0): un color por NOMBRE de serie. La
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
// T8: la entrada de menu EJECUTADA contra un DOBLE de hoja en memoria
// ============================================
/**
 * Hasta la ronda anterior el banco probaba las PIEZAS (formulas, spec, constructor del chart) y
 * nunca la ORQUESTACION: preflight, respaldo, escritura, verificacion de valor, restauracion y
 * grafico no tenian un solo chequeo. Un verde sobre las piezas con la orquestacion rota es
 * exactamente el "banco verde sobre codigo que no corre" de las cicatrices.
 *
 * El doble reproduce la geometria MEDIDA EN VIVO el 2026-09-07 (ver "GEOMETRIA ESPERADA DE LA
 * HOJA" en src/07_MiradaInteranual.js): selectores I2 "Mayo" / I3 2026 numerico / I4 "ARS";
 * fila 7 con C7 "Resultados.", E7 "Interanual.", K7 con =I2 y G7:J7 + L7:R7 VACIAS; rotulos
 * C8:C11 (C11 con acento); G8:R11 con formula y valor; C13 con la banda; grid 883 x 20. Mas la
 * hoja "Registros" con sus columnas, que el preflight tambien mira.
 *
 * Tres decisiones del doble, que son las que lo hacen una prueba y no un decorado:
 *
 * 1. TRAMPA DE LOCALE REAL. Las formulas se EVALUAN con un mini-interprete propio (LET, MATCH,
 *    SPLIT, INDEX, DATE, EDATE, MONTH, YEAR, PROPER, RIGHT, IF, COLUMN, referencias y
 *    operadores) que acepta UNICAMENTE ";" como separador de argumentos: una coma fuera de
 *    comillas es un parse error y la celda queda en "#ERROR!", igual que la planilla es_AR. Asi
 *    el modulo tiene que reintentar de verdad, y lo que el banco verifica es el VALOR de cada
 *    celda, no el texto de la formula. El interprete es independiente del modulo: no reutiliza
 *    una sola linea suya, y se prueba a si mismo antes de usarse como vara de medir.
 * 2. FORMATO TEXTO. Una celda en "@" guarda lo que le manda setFormula como TEXTO y lo muestra
 *    tal cual, sin error y sin evaluar. Es la cicatriz "un numero bien formateado y equivocado
 *    es peor que un error visible" en su version mas silenciosa.
 * 3. DOMINIO DEL SETTER. setHorizontalAlignment(s) del doble LANZA ante cualquier valor fuera
 *    de 'left' | 'center' | 'right' | 'normal' | null, como el setter real. Es lo que le da un
 *    guard al fix de alineacion de la ronda anterior: sin esto, revertir su unico callsite a la
 *    forma cruda dejaba el banco entero en verde y el helper como codigo muerto (T7, M30).
 *
 * El doble REGISTRA toda mutacion (escrituras[]) para poder exigir CERO escrituras cuando el
 * preflight bloquea: "no se escribio nada" se mide, no se supone.
 */

// ---- A1: numero de columna, letra, celdas de un rango ----
const A1COL = (letras) => String(letras).toUpperCase().split('').reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0);
function A1LETRA(n) {
    let s = '';
    let x = n;
    while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = (x - r - 1) / 26; }
    return s;
}
function A1PARSE(ref) {
    const m = /^\$?([A-Za-z]+)\$?(\d+)$/.exec(String(ref).trim());
    if (!m) throw new Error('A1PARSE: referencia invalida ' + ref);
    return { col: A1COL(m[1]), fila: parseInt(m[2], 10) };
}
/** Matriz de referencias ('G7') de un rango A1, en orden de filas. */
function celdasDelRango(a1) {
    const partes = String(a1).toUpperCase().split(':');
    const a = A1PARSE(partes[0]);
    const b = A1PARSE(partes[1] || partes[0]);
    const filas = [];
    for (let f = Math.min(a.fila, b.fila); f <= Math.max(a.fila, b.fila); f++) {
        const cols = [];
        for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) cols.push(A1LETRA(c) + f);
        filas.push(cols);
    }
    return filas;
}
/** Traslada las referencias RELATIVAS de una formula al copiarla (las que llevan $ no se tocan). */
function trasladarFormula(formula, dCol, dFila) {
    let out = '';
    let enStr = false;
    let i = 0;
    while (i < formula.length) {
        const ch = formula[i];
        if (ch === '"') { enStr = !enStr; out += ch; i++; continue; }
        if (enStr) { out += ch; i++; continue; }
        const m = /^(\$?)([A-Z]+)(\$?)(\d+)/.exec(formula.slice(i));
        if (m && !/[A-Za-z0-9_]/.test(formula[i - 1] || '')) {
            const col = m[1] ? m[2] : A1LETRA(A1COL(m[2]) + dCol);
            const fila = m[3] ? m[4] : (parseInt(m[4], 10) + dFila);
            out += m[1] + col + m[3] + fila;
            i += m[0].length;
            continue;
        }
        out += ch;
        i++;
    }
    return out;
}

// ---- Mini-interprete de formulas de hoja (separador ";" y nada mas) ----
const REF_ENVUELTA = '__refDeHoja';
function desenvolver(x) { return (x && typeof x === 'object' && x[REF_ENVUELTA]) ? x.v : x; }
function textoDe(x) {
    const v = desenvolver(x);
    if (v === null || v === undefined) return '';
    return String(v);
}
function numeroDe(x) {
    const v = desenvolver(x);
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v));
    if (isNaN(n)) { const e = new Error('#VALUE!'); e.valorError = '#VALUE!'; throw e; }
    return n;
}
function fechaDe(x) {
    const v = desenvolver(x);
    if (v instanceof Date) return v;
    const e = new Error('#VALUE!');
    e.valorError = '#VALUE!';
    throw e;
}
function igualSheets(a, b) {
    const x = desenvolver(a);
    const y = desenvolver(b);
    if (typeof x === 'number' && typeof y === 'number') return x === y;
    if (x instanceof Date || y instanceof Date) return String(x) === String(y);
    return String(x === null || x === undefined ? '' : x).toUpperCase() ===
        String(y === null || y === undefined ? '' : y).toUpperCase();
}

/**
 * Evalua una formula de hoja. `ent` = { leerCelda(ref), columna, fila }.
 * Lanza con .parseError = true ante cualquier problema de sintaxis -- incluida una coma fuera de
 * comillas, que es la trampa de locale -- y con .valorError ante un error de valor tipo #N/A.
 */
function evaluarFormulaHoja(texto, ent) {
    const SEP = ';';
    const s = String(texto).replace(/^=/, '');
    let i = 0;
    let scope = {};
    const parseError = (m) => { const e = new Error('parse: ' + m); e.parseError = true; throw e; };
    const valorError = (v) => { const e = new Error(v); e.valorError = v; throw e; };
    const saltar = () => { while (i < s.length && s[i] === ' ') i++; };

    function expr() { return comparacion(); }
    function comparacion() {
        let v = concatenacion();
        saltar();
        while (i < s.length && (s[i] === '=' || s[i] === '<' || s[i] === '>')) {
            let op = s[i++];
            if (s[i] === '=' || s[i] === '>') op += s[i++];
            const d = concatenacion();
            const ig = igualSheets(v, d);
            v = (op === '=') ? ig
                : (op === '<>') ? !ig
                    : (op === '<') ? numeroDe(v) < numeroDe(d)
                        : (op === '>') ? numeroDe(v) > numeroDe(d)
                            : (op === '<=') ? numeroDe(v) <= numeroDe(d)
                                : numeroDe(v) >= numeroDe(d);
            saltar();
        }
        return v;
    }
    function concatenacion() {
        let v = aditivo();
        saltar();
        while (s[i] === '&') { i++; v = textoDe(v) + textoDe(aditivo()); saltar(); }
        return v;
    }
    function aditivo() {
        let v = multiplicativo();
        saltar();
        while (s[i] === '+' || s[i] === '-') {
            const op = s[i++];
            const d = multiplicativo();
            v = op === '+' ? numeroDe(v) + numeroDe(d) : numeroDe(v) - numeroDe(d);
            saltar();
        }
        return v;
    }
    function multiplicativo() {
        let v = unario();
        saltar();
        while (s[i] === '*' || s[i] === '/') {
            const op = s[i++];
            const d = unario();
            v = op === '*' ? numeroDe(v) * numeroDe(d) : numeroDe(v) / numeroDe(d);
            saltar();
        }
        return v;
    }
    function unario() { saltar(); if (s[i] === '-') { i++; return -numeroDe(unario()); } return primario(); }
    function primario() {
        saltar();
        if (i >= s.length) parseError('fin de formula inesperado');
        if (s[i] === '(') { i++; const v = expr(); saltar(); if (s[i] !== ')') parseError('falta ")"'); i++; return v; }
        if (s[i] === '"') {
            i++;
            let out = '';
            while (i < s.length) {
                if (s[i] === '"') { if (s[i + 1] === '"') { out += '"'; i += 2; continue; } i++; return out; }
                out += s[i++];
            }
            parseError('comilla sin cerrar');
        }
        if (/[0-9]/.test(s[i])) {
            let j = i;
            while (j < s.length && /[0-9.]/.test(s[j])) j++;
            const n = parseFloat(s.slice(i, j));
            i = j;
            return n;
        }
        if (s[i] === '$' || /[A-Za-z_]/.test(s[i])) {
            let j = i;
            while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++;
            const tok = s.slice(i, j);
            i = j;
            saltar();
            if (s[i] === '(') {
                i++;
                if (tok.toUpperCase() === 'LET') return evaluarLet();
                const args = [];
                saltar();
                if (s[i] === ')') {
                    i++;
                } else {
                    for (;;) {
                        args.push(expr());
                        saltar();
                        if (s[i] === SEP) { i++; continue; }
                        if (s[i] === ')') { i++; break; }
                        parseError('separador inesperado ' + JSON.stringify(s[i] || 'EOF') + ' en ' + tok);
                    }
                }
                return llamar(tok.toUpperCase(), args);
            }
            if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(tok)) {
                // Las referencias viajan ENVUELTAS: COLUMN($K$7) necesita la referencia, no su valor.
                const env = {};
                env[REF_ENVUELTA] = true;
                env.ref = tok.replace(/\$/g, '').toUpperCase();
                env.v = ent.leerCelda(env.ref);
                return env;
            }
            if (Object.prototype.hasOwnProperty.call(scope, tok)) return scope[tok];
            parseError('identificador desconocido "' + tok + '"');
        }
        parseError('token inesperado ' + JSON.stringify(s[i]));
    }
    function evaluarLet() {
        const previo = scope;
        scope = Object.assign({}, scope);
        for (;;) {
            saltar();
            let j = i;
            while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
            const nombre = s.slice(i, j);
            let k = j;
            while (k < s.length && s[k] === ' ') k++;
            if (!nombre || s[k] !== SEP) break;   // no es "nombre;valor": es la expresion final
            i = k + 1;
            const valor = expr();
            scope[nombre] = valor;
            saltar();
            if (s[i] !== SEP) parseError('LET: falta el separador tras el valor de ' + nombre);
            i++;
        }
        const final = expr();
        saltar();
        if (s[i] !== ')') parseError('LET sin cerrar');
        i++;
        scope = previo;
        return final;
    }
    function comoArray(x) {
        const v = desenvolver(x);
        return Array.isArray(v) ? v : [v];
    }
    function llamar(n, a) {
        switch (n) {
            case 'MATCH': {
                const arr = comoArray(a[1]);
                for (let k = 0; k < arr.length; k++) if (igualSheets(arr[k], a[0])) return k + 1;
                valorError('#N/A');
                break;
            }
            case 'SPLIT': return textoDe(a[0]).split(textoDe(a[1]));
            case 'INDEX': {
                const arr = comoArray(a[0]);
                const idx = a.length > 2 ? numeroDe(a[2]) : numeroDe(a[1]);
                if (idx < 1 || idx > arr.length) valorError('#REF!');
                return arr[idx - 1];
            }
            case 'DATE': return new Date(Date.UTC(numeroDe(a[0]), numeroDe(a[1]) - 1, numeroDe(a[2])));
            case 'EDATE': {
                const d = fechaDe(a[0]);
                return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + numeroDe(a[1]), d.getUTCDate()));
            }
            case 'MONTH': return fechaDe(a[0]).getUTCMonth() + 1;
            case 'YEAR': return fechaDe(a[0]).getUTCFullYear();
            case 'PROPER': return textoDe(a[0]).toLowerCase()
                .replace(/(^|[^A-Za-z\u00c0-\u024f])([a-z\u00e0-\u024f])/g, (_m, p, c) => p + c.toUpperCase());
            case 'UPPER': return textoDe(a[0]).toUpperCase();
            case 'RIGHT': { const t = textoDe(a[0]); const k = a.length > 1 ? numeroDe(a[1]) : 1; return t.slice(t.length - k); }
            case 'LEFT': { const t = textoDe(a[0]); const k = a.length > 1 ? numeroDe(a[1]) : 1; return t.slice(0, k); }
            case 'IF': return desenvolver(a[0]) ? desenvolver(a[1]) : desenvolver(a[2]);
            case 'COLUMN': {
                if (!a.length) return ent.columna;
                if (!a[0] || !a[0][REF_ENVUELTA]) parseError('COLUMN espera una referencia');
                return A1PARSE(a[0].ref).col;
            }
            case 'ROW': {
                if (!a.length) return ent.fila;
                if (!a[0] || !a[0][REF_ENVUELTA]) parseError('ROW espera una referencia');
                return A1PARSE(a[0].ref).fila;
            }
            default: parseError('funcion no soportada por el doble: ' + n);
        }
    }

    const resultado = expr();
    saltar();
    if (i < s.length) parseError('sobra texto tras la expresion: ' + JSON.stringify(s.slice(i, i + 12)));
    return desenvolver(resultado);
}

// ---- Doble de la planilla ----
const FORMATO_GENERAL = '0.###############';
const ALINEACIONES_VALIDAS = ['left', 'center', 'right', 'normal'];

/**
 * @param {Object} [cfg] variantes de la corrida: rotuloC11, rotuloC13, k7Vacia, anioComoTexto,
 *   formatoG7 (ej. '@'), insertChartLanza, distorsionarRangos, graficoPrevio
 */
function dobleDeMirada(cfg) {
    const o = cfg || {};
    const celdas = {};
    const escrituras = [];
    const avisos = [];
    const alertas = [];
    const logs = { info: [], error: [], success: [] };
    const alineacionesRecibidas = [];
    const charts = [];
    let proximoId = 500;

    const cel = (ref) => {
        if (!celdas[ref]) {
            celdas[ref] = { formula: '', valor: '', formato: FORMATO_GENERAL, alin: null, color: null, evaluar: true };
        }
        return celdas[ref];
    };
    const poner = (ref, campos) => Object.assign(cel(ref), campos);
    const entornoDe = (ref) => {
        const p = A1PARSE(ref);
        return { columna: p.col, fila: p.fila, leerCelda: (otra) => (otra === ref ? '' : valorDe(otra)) };
    };
    const valorDe = (ref) => {
        const c = cel(ref);
        if (c.formula && c.evaluar) {
            // La formula PARSEA y la celda devuelve igual un error de valor: es el caso que
            // ningun cambio de separador arregla (un #REF! por una hoja renombrada, por ejemplo).
            if (o.errorEnG7 && ref === 'G7') return '#REF!';
            try { return evaluarFormulaHoja(c.formula, entornoDe(ref)); }
            catch (e) { return e.parseError ? '#ERROR!' : (e.valorError || '#VALUE!'); }
        }
        return c.valor;
    };
    const displayDe = (ref) => {
        const v = valorDe(ref);
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v);
    };
    const alineacionDe = (ref) => {
        const c = cel(ref);
        if (c.alin) return c.alin;
        // Sin alineacion explicita Sheets devuelve 'general-left' / 'general-right' segun el tipo.
        return typeof valorDe(ref) === 'number' ? 'general-right' : 'general-left';
    };

    // ---- Geometria medida en vivo el 2026-09-07 ----
    poner('I2', { valor: 'Mayo' });
    poner('I3', o.anioComoTexto ? { valor: '2026', formato: '@' } : { valor: 2026 });
    poner('I4', { valor: 'ARS' });
    poner('C7', { valor: 'Resultados.' });
    poner('E7', { valor: 'Interanual.' });
    poner('K7', o.k7Vacia ? { alin: 'center', color: '#2c4e40' } : { formula: '=I2', alin: 'center', color: '#2c4e40' });
    poner('C8', { valor: 'Ingresos' });
    poner('C9', { valor: 'Gastos Fijos' });
    poner('C10', { valor: 'Gastos Variables' });
    poner('C11', { valor: o.rotuloC11 || 'Capitalizaci\u00f3n' });
    poner('C13', { valor: o.rotuloC13 || 'Evoluci\u00f3n de Tendencias' });
    // G8:R11: la formula REAL del gemelo mas un valor. El doble no las evalua (la entrada de menu
    // no las toca): son el bloque que la hoja ya tiene calculado.
    celdasDelRango('G8:R11').forEach((filaRefs, fi) => filaRefs.forEach((ref, ci) => {
        poner(ref, { formula: F[ref] || '', valor: (fi + 1) * 1000 + ci, formato: '#,##0.00', evaluar: false });
    }));
    if (o.formatoG7) poner('G7', { formato: o.formatoG7 });

    const anchoCol = (c) => 60 + 5 * c;        // deterministas y distintos entre si: el banco
    const altoFila = (f) => 20 + (f % 7);      // recalcula las sumas por su cuenta

    function rangoDe(a1) {
        const refs = celdasDelRango(a1);
        const ultima = refs[refs.length - 1][refs[0].length - 1];
        const norm = (refs.length === 1 && refs[0].length === 1) ? refs[0][0] : refs[0][0] + ':' + ultima;
        const mapa = (fn) => refs.map((f) => f.map(fn));
        const r = {
            __a1: norm,
            getA1Notation: () => norm,
            getNumRows: () => refs.length,
            getNumColumns: () => refs[0].length,
            getFormulas: () => mapa((ref) => cel(ref).formula),
            getValues: () => mapa((ref) => valorDe(ref)),
            getDisplayValues: () => mapa((ref) => displayDe(ref)),
            getNumberFormats: () => mapa((ref) => cel(ref).formato),
            getHorizontalAlignments: () => mapa((ref) => alineacionDe(ref)),
            getValue: () => valorDe(refs[0][0]),
            getDisplayValue: () => displayDe(refs[0][0]),
            getHorizontalAlignment: () => alineacionDe(refs[0][0]),
            setFormula: (f) => {
                const ref = refs[0][0];
                escrituras.push({ op: 'setFormula', a1: ref, valor: f });
                // Celda en "Texto sin formato": Sheets guarda la formula como TEXTO y la muestra
                // tal cual, sin error y sin evaluarla nunca.
                if (cel(ref).formato === '@') poner(ref, { formula: '', valor: String(f) });
                else poner(ref, { formula: String(f), valor: '' });
                return r;
            },
            setValues: (m) => {
                escrituras.push({ op: 'setValues', a1: norm });
                refs.forEach((f, fi) => f.forEach((ref, ci) => {
                    const v = m[fi][ci];
                    if (typeof v === 'string' && v.charAt(0) === '=' && cel(ref).formato !== '@') poner(ref, { formula: v, valor: '' });
                    else poner(ref, { formula: '', valor: v });
                }));
                return r;
            },
            setNumberFormat: (patron) => {
                escrituras.push({ op: 'setNumberFormat', a1: norm, valor: patron });
                refs.forEach((f) => f.forEach((ref) => poner(ref, { formato: patron })));
                return r;
            },
            setNumberFormats: (m) => {
                escrituras.push({ op: 'setNumberFormats', a1: norm });
                refs.forEach((f, fi) => f.forEach((ref, ci) => poner(ref, { formato: m[fi][ci] })));
                return r;
            },
            setHorizontalAlignment: (v) => {
                alineacionesRecibidas.push(v);
                if (v !== null && v !== undefined && ALINEACIONES_VALIDAS.indexOf(v) < 0) {
                    throw new Error('The parameters (String) don\'t match the method signature for ' +
                        'SpreadsheetApp.Range.setHorizontalAlignment (valor fuera de dominio: ' + String(v) + ')');
                }
                escrituras.push({ op: 'setHorizontalAlignment', a1: norm, valor: v });
                refs.forEach((f) => f.forEach((ref) => poner(ref, { alin: (v === null || v === 'normal') ? null : v })));
                return r;
            },
            setHorizontalAlignments: (m) => {
                const planos = [].concat.apply([], m);
                planos.forEach((v) => alineacionesRecibidas.push(v));
                planos.forEach((v) => {
                    if (v !== null && v !== undefined && ALINEACIONES_VALIDAS.indexOf(v) < 0) {
                        throw new Error('The parameters (String[][]) don\'t match the method signature for ' +
                            'SpreadsheetApp.Range.setHorizontalAlignments (valor fuera de dominio: ' + String(v) + ')');
                    }
                });
                escrituras.push({ op: 'setHorizontalAlignments', a1: norm });
                refs.forEach((f, fi) => f.forEach((ref, ci) => {
                    const v = m[fi][ci];
                    poner(ref, { alin: (v === null || v === undefined || v === 'normal') ? null : v });
                }));
                return r;
            },
            copyTo: (destino, tipo) => {
                escrituras.push({ op: 'copyTo', a1: norm, destino: destino.__a1, tipo: tipo });
                if (tipo !== 'CopyPasteType.PASTE_FORMULA') {
                    throw new Error('el doble solo modela PASTE_FORMULA (recibio ' + String(tipo) + ')');
                }
                const origen = refs[0][0];
                const p0 = A1PARSE(origen);
                const f0 = cel(origen).formula;
                celdasDelRango(destino.__a1).forEach((f) => f.forEach((ref) => {
                    const p = A1PARSE(ref);
                    // PASTE_FORMULA: SOLO la formula. Formato numerico, alineacion y color quedan.
                    poner(ref, { formula: trasladarFormula(f0, p.col - p0.col, p.fila - p0.fila), valor: '', evaluar: true });
                }));
                return r;
            }
        };
        return r;
    }

    function chartDe(est) {
        const ch = {
            __est: est,
            __id: null,
            getChartId: () => ch.__id,
            getRanges: () => est.rangos.map((a1) => rangoDe(a1)),
            getContainerInfo: () => ({ getAnchorRow: () => est.ancla.fila, getAnchorColumn: () => est.ancla.col }),
            getOptions: () => ({ get: (k) => est.opciones[k] })
        };
        return ch;
    }
    function builderGrabador() {
        const est = { rangos: [], opciones: {}, tipo: null, merge: null, transponer: null, encabezados: null, ancla: null };
        const b = {
            setChartType: (t) => { est.tipo = t; return b; },
            addRange: (rg) => { est.rangos.push(rg.getA1Notation()); return b; },
            setMergeStrategy: (m) => { est.merge = m; return b; },
            setTransposeRowsAndColumns: (v) => { est.transponer = v; return b; },
            setNumHeaders: (n) => { est.encabezados = n; return b; },
            setPosition: (f, c, ox, oy) => { est.ancla = { fila: f, col: c, ox: ox, oy: oy }; return b; },
            setOption: (k, v) => { est.opciones[k] = v; return b; },
            build: () => chartDe(est)
        };
        return b;
    }

    const hojaMirada = {
        getName: () => 'Mirada Interanual',
        getMaxRows: () => 883,
        getMaxColumns: () => 20,
        getRange: rangoDe,
        getColumnWidth: anchoCol,
        getRowHeight: altoFila,
        newChart: builderGrabador,
        getCharts: () => charts.slice(),
        insertChart: (ch) => {
            if (o.insertChartLanza) throw new Error('Se produjo un error inesperado al insertar el grafico.');
            ch.__id = proximoId++;
            if (o.distorsionarRangos) ch.__est.rangos = ['A1:B2'];
            charts.push(ch);
        },
        removeChart: (ch) => {
            const k = charts.indexOf(ch);
            if (k < 0) throw new Error('El grafico no pertenece a esta hoja.');
            charts.splice(k, 1);
        }
    };
    const hojaRegistros = {
        getName: () => 'Registros',
        getMaxRows: () => 2903,
        getMaxColumns: () => 13
    };
    if (o.graficoPrevio) {
        const previo = chartDe({
            rangos: ['C7:C11', 'G7:R11'], opciones: {}, tipo: 'ChartType.LINE',
            merge: 'ChartMergeStrategy.MERGE_COLUMNS', transponer: true, encabezados: 1,
            ancla: { fila: 14, col: 3, ox: 0, oy: 0 }
        });
        previo.__id = proximoId++;
        charts.push(previo);
    }

    const ss = {
        getSheetByName: (n) => (n === 'Mirada Interanual' ? hojaMirada : (n === 'Registros' ? hojaRegistros : null)),
        toast: (mensaje, titulo) => avisos.push({ titulo: titulo, mensaje: mensaje })
    };
    const SpreadsheetAppDoble = {
        getActiveSpreadsheet: () => ss,
        flush: () => {},
        getUi: () => ({ alert: (m) => alertas.push(m) }),
        CopyPasteType: { PASTE_FORMULA: 'CopyPasteType.PASTE_FORMULA', PASTE_NORMAL: 'CopyPasteType.PASTE_NORMAL' }
    };

    return {
        SpreadsheetApp: SpreadsheetAppDoble, escrituras, avisos, alertas, logs, alineacionesRecibidas,
        anchoCol, altoFila, charts,
        display: displayDe,
        celda: cel,
        fotoDe: (a1) => celdasDelRango(a1).map((f) => f.map((ref) => JSON.stringify({
            formula: cel(ref).formula, valor: valorDe(ref), formato: cel(ref).formato,
            alin: alineacionDe(ref), color: cel(ref).color
        }))).join('|')
    };
}

/** Corre inicializarMesesYGraficoMirada() del contexto dado contra un doble (nuevo o reusado). */
function correrEntradaMirada(ctx, cfgODoble) {
    const doble = (cfgODoble && cfgODoble.escrituras) ? cfgODoble : dobleDeMirada(cfgODoble);
    const previo = {
        SpreadsheetApp: ctx.SpreadsheetApp, logInfo: ctx.logInfo, logError: ctx.logError, logSuccess: ctx.logSuccess
    };
    ctx.SpreadsheetApp = doble.SpreadsheetApp;
    ctx.logInfo = (m) => doble.logs.info.push(String(m));
    ctx.logError = (m) => doble.logs.error.push(String(m));
    ctx.logSuccess = (m) => doble.logs.success.push(String(m));
    let excepcion = null;
    try { ctx.inicializarMesesYGraficoMirada(); } catch (e) { excepcion = e; }
    Object.assign(ctx, previo);
    return { doble: doble, excepcion: excepcion };
}

const ETIQUETAS_MAYO_2026 = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const FILA_MESES_A1 = 'G7:R7';
// Lo que el usuario ve, por los tres canales. El toast se recorta a 180 caracteres, asi que el
// mensaje COMPLETO es el del alert: los tres se concatenan para no medir contra un texto podado.
const textoAvisos = (d) => d.avisos.map((a) => a.titulo + ': ' + a.mensaje).join(' || ') +
    ' || ' + d.alertas.join(' || ') + ' || ' + d.logs.error.join(' || ');
const displaysFila = (d) => celdasDelRango(FILA_MESES_A1)[0].map((ref) => d.display(ref));
const fueraDeDominio = (d) => d.alineacionesRecibidas.filter((v) => v !== null && v !== undefined && ALINEACIONES_VALIDAS.indexOf(v) < 0);

// ---- (a) el camino verde ----
function chequearT8a(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const corrida = correrEntradaMirada(ctx, {});
    const doble = corrida.doble;
    if (corrida.excepcion) { linea(false, '(a) la entrada de menu LANZO: ' + corrida.excepcion.message); return { ok: false, detalle }; }
    const vistos = displaysFila(doble);
    linea(vistos.join('|') === ETIQUETAS_MAYO_2026.join('|'),
        '(a) G7:R7 muestra los doce meses con I2="Mayo" e I3=2026: [' + vistos.join(', ') + ']');
    linea(doble.logs.success.length === 1, '(a) se llamo a logSuccess exactamente una vez (' + doble.logs.success.length + ')');
    linea(doble.avisos.length >= 1 && doble.avisos[doble.avisos.length - 1].titulo === 'Listo',
        '(a) el ultimo aviso es "Listo" (' + (doble.avisos.length ? doble.avisos[doble.avisos.length - 1].titulo : 'ninguno') + ')');
    linea(doble.charts.length === 1, '(a) queda exactamente UN grafico (' + doble.charts.length + ')');
    if (doble.charts.length === 1) {
        const ch = doble.charts[0];
        const info = ch.getContainerInfo();
        linea(info.getAnchorRow() === 14 && info.getAnchorColumn() === 3,
            '(a) el grafico quedo anclado en (14, 3) = C14 (leido ' + info.getAnchorRow() + ', ' + info.getAnchorColumn() + ')');
        const rangos = ch.getRanges().map((r) => r.getA1Notation()).sort();
        const spec = ctx._especificacionGraficoMirada();
        linea(rangos.join('|') === spec.rangos.slice().sort().join('|'),
            '(a) rangos del grafico = [' + spec.rangos.join(', ') + '] (leidos [' + rangos.join(', ') + '])');
        let anchoEsp = 0;
        for (let c = 3; c <= 18; c++) anchoEsp += doble.anchoCol(c);
        let altoEsp = 0;
        for (let f = 14; f <= 21; f++) altoEsp += doble.altoFila(f);
        linea(ch.getOptions().get('width') === anchoEsp && ch.getOptions().get('height') === altoEsp,
            '(a) tamano = anchos C..R por altos 14..21 MEDIDOS en la hoja (' + anchoEsp + 'x' + altoEsp + ')');
    }
    linea(fueraDeDominio(doble).length === 0,
        '(a) todo lo que llego a setHorizontalAlignment(s) esta en el dominio del setter (' +
        JSON.stringify(doble.alineacionesRecibidas) + ')');
    linea(doble.celda('K7').color === '#2c4e40' && doble.celda('K7').formato === FORMATO_GENERAL,
        '(a) K7 conserva el color del resaltado y su formato numerico (la replicacion no los piso)');
    linea(doble.escrituras.some((e) => e.op === 'copyTo' && e.tipo === 'CopyPasteType.PASTE_FORMULA'),
        '(a) la replicacion a la fila se hizo con PASTE_FORMULA');
    return { ok: todoOk, detalle };
}

// ---- (b) idempotencia: dos corridas, UN grafico ----
function chequearT8b(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const primera = correrEntradaMirada(ctx, {});
    if (primera.excepcion) { linea(false, '(b) la primera corrida LANZO: ' + primera.excepcion.message); return { ok: false, detalle }; }
    const segunda = correrEntradaMirada(ctx, primera.doble);
    if (segunda.excepcion) { linea(false, '(b) la segunda corrida LANZO: ' + segunda.excepcion.message); return { ok: false, detalle }; }
    linea(primera.doble.charts.length === 1,
        '(b) dos corridas seguidas dejan UN solo grafico, no dos (' + primera.doble.charts.length + ')');
    linea(primera.doble.logs.success.length === 2, '(b) las dos corridas declararon exito (' + primera.doble.logs.success.length + ')');
    linea(displaysFila(primera.doble).join('|') === ETIQUETAS_MAYO_2026.join('|'),
        '(b) la fila de meses sigue correcta despues de la segunda corrida');
    return { ok: todoOk, detalle };
}

// ---- (c) preflight en rojo: CERO escrituras y la causa con nombre ----
const CASOS_PREFLIGHT = [
    ['rotulo C11 cambiado', { rotuloC11: 'Capitalizacion Neta' }, /C11/],
    ['banda C13 cambiada', { rotuloC13: 'Tendencias' }, /C13/],
    ['K7 vacia', { k7Vacia: true }, /K7/],
    ['I3 como texto', { anioComoTexto: true }, /I3/]
];
function chequearT8c(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    CASOS_PREFLIGHT.forEach((caso) => {
        const nombre = caso[0];
        const corrida = correrEntradaMirada(ctx, caso[1]);
        const doble = corrida.doble;
        if (corrida.excepcion) { linea(false, '(c) ' + nombre + ': la entrada LANZO ' + corrida.excepcion.message); return; }
        linea(doble.escrituras.length === 0,
            '(c) ' + nombre + ': CERO escrituras (' + doble.escrituras.length + (doble.escrituras.length
                ? ': ' + doble.escrituras.map((e) => e.op + ' ' + e.a1).join(', ') : '') + ')');
        linea(doble.logs.success.length === 0, '(c) ' + nombre + ': no se declaro exito');
        linea(doble.charts.length === 0, '(c) ' + nombre + ': no se inserto ningun grafico');
        linea(caso[2].test(textoAvisos(doble)), '(c) ' + nombre + ': el aviso nombra la causa (' + caso[2] + ')');
    });
    return { ok: todoOk, detalle };
}

// ---- (d) G7 en "Texto sin formato" (@) ----
/**
 * El invariante es UNO y no admite grises: la fila nunca puede terminar mostrando el TEXTO de la
 * formula, y nunca se canta exito sobre eso. Como se llega ahi es una decision del modulo y hay
 * dos salidas legitimas: neutralizar el formato antes de escribir (lo que hace la funcion hermana
 * inicializarMiradaInteranual) o abortar nombrando el formato y restaurar. El chequeo exige el
 * invariante siempre, y ademas lo que corresponda a la salida que el modulo haya elegido.
 */
function chequearT8d(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const doble = dobleDeMirada({ formatoG7: '@' });
    const antes = doble.fotoDe(FILA_MESES_A1);
    const corrida = correrEntradaMirada(ctx, doble);
    if (corrida.excepcion) { linea(false, '(d) la entrada LANZO: ' + corrida.excepcion.message); return { ok: false, detalle }; }
    const texto = textoAvisos(doble);
    const vistos = displaysFila(doble);
    const exito = doble.logs.success.length > 0;
    // Invariante duro, valga la salida que valga.
    linea(!vistos.some((v) => String(v).charAt(0) === '='),
        '(d) ninguna celda de G7:R7 quedo mostrando el TEXTO de la formula: [' + vistos.join(', ') + ']');
    linea(vistos.join('|') === ETIQUETAS_MAYO_2026.join('|') || doble.fotoDe(FILA_MESES_A1) === antes,
        '(d) la fila termina o con los doce meses correctos o EXACTAMENTE como estaba: nunca a medio escribir');
    if (exito) {
        linea(vistos.join('|') === ETIQUETAS_MAYO_2026.join('|'),
            '(d) el modulo neutralizo el formato "@" y la fila muestra los doce meses');
        linea(doble.celda('G7').formato !== '@',
            '(d) G7 dejo de estar en "Texto sin formato" (' + doble.celda('G7').formato + ')');
        linea(doble.escrituras.some((e) => e.op === 'setNumberFormat' || e.op === 'setNumberFormats'),
            '(d) el formato se fijo con una escritura explicita, no por casualidad');
    } else {
        linea(doble.charts.length === 0, '(d) sin exito no se inserto ningun grafico');
        linea(doble.fotoDe(FILA_MESES_A1) === antes,
            '(d) G7:R7 queda EXACTAMENTE como estaba (formula, valor, formato numerico y alineacion)');
        linea(/formato|texto sin formato|TEXTO|@/i.test(texto),
            '(d) el aviso nombra el formato como causa: ' + texto.slice(0, 170));
    }
    console.log('  (d) salida elegida por el modulo: ' + (exito
        ? 'neutraliza el formato y escribe' : 'aborta y restaura'));
    linea(fueraDeDominio(doble).length === 0,
        '(d) todo lo que llego a setHorizontalAlignment(s) esta en el dominio del setter (' +
        JSON.stringify(doble.alineacionesRecibidas) + ')');
    return { ok: todoOk, detalle };
}

// ---- (g) la celda devuelve un error de VALOR: se restaura y no se toca el grafico ----
/**
 * Es el unico camino que ejerce la RESTAURACION completa de la fila, y por eso es el que le da
 * guard al fix de alineacion de la ronda anterior (T7, M30): reponer la matriz CRUDA de
 * getHorizontalAlignments manda 'general-left' al setter, que en el doble lanza igual que el real.
 * Un '#REF!' parsea: cambiar el separador no lo arregla y declarar exito seria mentir.
 */
function chequearT8g(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const doble = dobleDeMirada({ errorEnG7: true, graficoPrevio: true });
    const antes = doble.fotoDe(FILA_MESES_A1);
    const corrida = correrEntradaMirada(ctx, doble);
    if (corrida.excepcion) { linea(false, '(g) la entrada LANZO: ' + corrida.excepcion.message); return { ok: false, detalle }; }
    const texto = textoAvisos(doble);
    linea(doble.logs.success.length === 0, '(g) con la celda en "#REF!" NO se canta exito');
    linea(doble.fotoDe(FILA_MESES_A1) === antes,
        '(g) G7:R7 vuelve EXACTAMENTE a como estaba: formula, valor, formato numerico y alineacion');
    linea(doble.charts.length === 1 && doble.charts[0].__est.rangos.join('+') === 'C7:C11+G7:R11',
        '(g) el grafico previo no se toco (' + doble.charts.length + ')');
    linea(/#REF!|ERROR_VALOR|no se pudo escribir/i.test(texto), '(g) el aviso nombra el estado de la celda: ' + texto.slice(0, 170));
    linea(/restaur/i.test(texto), '(g) el aviso dice que se restauro');
    // H-2: el guard del fix de alineacion vive aca.
    linea(fueraDeDominio(doble).length === 0,
        '(g) la restauracion mando a setHorizontalAlignments solo valores del dominio (' +
        JSON.stringify(doble.alineacionesRecibidas) + ')');
    linea(!/alineacion horizontal NO se pudo reponer/i.test(texto),
        '(g) no hubo que reportar una alineacion sin reponer: la restauracion fue completa');
    return { ok: todoOk, detalle };
}

// ---- (e) insertChart lanza: la fila queda, los graficos previos sobreviven ----
function chequearT8e(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const corrida = correrEntradaMirada(ctx, { insertChartLanza: true, graficoPrevio: true });
    const doble = corrida.doble;
    if (corrida.excepcion) { linea(false, '(e) la entrada LANZO en vez de reportar: ' + corrida.excepcion.message); return { ok: false, detalle }; }
    const texto = textoAvisos(doble);
    linea(displaysFila(doble).join('|') === ETIQUETAS_MAYO_2026.join('|'),
        '(e) la fila de meses queda ESCRITA y correcta aunque el grafico falle');
    linea(doble.logs.success.length === 0, '(e) no se declara exito');
    linea(/grafico NO|no quedo insertado|no se inserto/i.test(texto), '(e) el aviso dice que el grafico no se inserto: ' + texto.slice(0, 170));
    linea(doble.charts.length === 1 && doble.charts[0].__est.ancla.fila === 14,
        '(e) el grafico PREVIO SOBREVIVE (' + doble.charts.length + ' grafico(s) en la hoja)');
    linea(/previo/i.test(texto), '(e) el aviso dice que los previos se conservan');
    return { ok: todoOk, detalle };
}

// ---- (f) el chart insertado sale con rangos equivocados: se retira EL NUEVO ----
function chequearT8f(ctx) {
    const detalle = [];
    let todoOk = true;
    const linea = (c, m) => { detalle.push((c ? '' : 'FALLA: ') + m); if (!c) todoOk = false; };
    const corrida = correrEntradaMirada(ctx, { distorsionarRangos: true, graficoPrevio: true });
    const doble = corrida.doble;
    if (corrida.excepcion) { linea(false, '(f) la entrada LANZO: ' + corrida.excepcion.message); return { ok: false, detalle }; }
    const texto = textoAvisos(doble);
    const rangosVivos = doble.charts.map((c) => c.__est.rangos.join('+'));
    linea(doble.logs.success.length === 0, '(f) no se declara exito con un grafico de rangos equivocados');
    linea(doble.charts.length === 1, '(f) queda UN solo grafico (' + doble.charts.length + ': ' + rangosVivos.join(' / ') + ')');
    linea(rangosVivos.indexOf('A1:B2') < 0, '(f) el grafico con rangos equivocados NO quedo en la hoja: se retiro EL NUEVO');
    linea(rangosVivos.indexOf('C7:C11+G7:R11') > -1, '(f) el grafico PREVIO, con los rangos buenos, quedo intacto');
    linea(/no es el esperado|rangos/i.test(texto), '(f) el aviso nombra el problema de rangos: ' + texto.slice(0, 170));
    return { ok: todoOk, detalle };
}

seccion('T8. inicializarMesesYGraficoMirada() EJECUTADA contra un doble de hoja, en siete direcciones');
{
    // El interprete del doble es la vara de medir: se prueba a si mismo antes de usarse.
    const ent = { columna: 11, fila: 7, leerCelda: (r) => ({ I2: 'Mayo', I3: 2026 }[r]) };
    ok(evaluarFormulaHoja('=$I$2', ent) === 'Mayo', 'interprete: una referencia devuelve el valor de la celda');
    ok(evaluarFormulaHoja('=PROPER("SEPTIEMBRE")', ent) === 'Septiembre', 'interprete: PROPER("SEPTIEMBRE") = "Septiembre"');
    ok(evaluarFormulaHoja('=YEAR(EDATE(DATE(2026;12;1);1))', ent) === 2027, 'interprete: EDATE cruza el fin de anio');
    ok(evaluarFormulaHoja('=MATCH("mayo";SPLIT("ENERO,FEBRERO,MARZO,ABRIL,MAYO";",");0)', ent) === 5,
        'interprete: MATCH sobre SPLIT es insensible a mayusculas');
    ok(evaluarFormulaHoja('=COLUMN()-COLUMN($K$7)', ent) === 0,
        'interprete: COLUMN() usa la columna de la celda y COLUMN(ref) la de la referencia');
    ok(evaluarFormulaHoja('="x"&RIGHT(YEAR(DATE(2027;1;1));2)', ent) === 'x27', 'interprete: concatenacion y RIGHT');
    let parseo = null;
    try { evaluarFormulaHoja('=MATCH($I$2,SPLIT("A,B";","),0)', ent); } catch (e) { parseo = e; }
    ok(parseo && parseo.parseError === true, 'interprete: una coma fuera de comillas es PARSE ERROR (trampa de locale es_AR)');
    ok(evaluarFormulaHoja(M.construirFormulaMesMirada(';'),
        { columna: 7, fila: 7, leerCelda: (r) => ({ I2: 'Mayo', I3: 2026 }[r]) }) === 'Enero',
        'interprete: la formula REAL del modulo con ";" evaluada en la columna G da "Enero"');

    [['a', chequearT8a], ['b', chequearT8b], ['c', chequearT8c], ['d', chequearT8d],
        ['e', chequearT8e], ['f', chequearT8f], ['g', chequearT8g]]
        .forEach((par) => {
            const r = par[1](M);
            r.detalle.forEach((d) => ok(!/^FALLA: /.test(d), d.replace(/^FALLA: /, '')));
            ok(r.ok, 'T8 (' + par[0] + ') en conjunto');
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

    // 7e. M30: el fix de alineacion de la ronda anterior revertido a su forma buggy (la matriz
    //     CRUDA de getHorizontalAlignments va derecho al setter, con sus 'general-left'). Sin
    //     este sabotaje el fix no tenia guard: revertirlo dejaba los chequeos en verde y
    //     _alineacionRestaurableMirada como codigo muerto. T8 (g) es el camino que ejerce la
    //     restauracion de la fila, y ahi tiene que caer.
    const m30 = sabotear(fuenteModulo, [['fila.map(_alineacionRestaurableMirada)', 'fila']]);
    ok(m30.noAplicados.length === 0, 'M30 aplicado (la restauracion repone la alineacion CRUDA, sin traducir)');
    let C30 = null;
    try { C30 = cargarModulo(m30.fuente); } catch (e) { ok(false, 'M30: la copia saboteada no carga: ' + e.message); }
    if (C30) {
        const t8g = chequearT8g(C30);
        ok(!t8g.ok, 'T8 (g) FALLA sobre M30 (' + (t8g.detalle.find(d => /^FALLA/.test(d)) || 'sin falla') + ')');
    }

    // 7f. M31: el preflight deja de bloquear (su resultado se fuerza a ok sin tocar la llamada).
    //     Es el sabotaje que le da guard al "no se escribio ninguna celda": sin el, T8 (c) podria
    //     estar contando cero escrituras por cualquier otra razon.
    const m31 = sabotear(fuenteModulo, [[
        'const pre = _verificarPrecondicionesMesesGraficoMirada(ss, sheet);',
        '_verificarPrecondicionesMesesGraficoMirada(ss, sheet);\n    const pre = { ok: true, problemas: [], observado: {} };'
    ]]);
    ok(m31.noAplicados.length === 0, 'M31 aplicado (el preflight de la entrada deja de bloquear)');
    let C31 = null;
    try { C31 = cargarModulo(m31.fuente); } catch (e) { ok(false, 'M31: la copia saboteada no carga: ' + e.message); }
    if (C31) {
        const t8c = chequearT8c(C31);
        ok(!t8c.ok, 'T8 (c) FALLA sobre M31 (' + (t8c.detalle.find(d => /^FALLA/.test(d)) || 'sin falla') + ')');
    }

    // 7g. M32: el retiro de los graficos previos desaparece. La entrada deja de ser idempotente y
    //     dos clics dejan DOS graficos apilados sobre C14, cantando exito los dos. T8 (b) cae.
    const m32 = sabotear(fuenteModulo, [['            sheet.removeChart(ch);\n', '']]);
    ok(m32.noAplicados.length === 0, 'M32 aplicado (no se retiran los graficos previos)');
    let C32 = null;
    try { C32 = cargarModulo(m32.fuente); } catch (e) { ok(false, 'M32: la copia saboteada no carga: ' + e.message); }
    if (C32) {
        const t8b = chequearT8b(C32);
        ok(!t8b.ok, 'T8 (b) FALLA sobre M32 (' + (t8b.detalle.find(d => /^FALLA/.test(d)) || 'sin falla') + ')');
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
