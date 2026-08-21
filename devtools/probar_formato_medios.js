/**
 * devtools/probar_formato_medios.js
 * Banco de pruebas de DEVTOOL_FormatoMedios.js.
 *
 * Tres mitades:
 *
 * 1. LA FORMULA de cada regla: derivada entera de RANGES y SYF_BLOQUE_MEDIOS, con el MISMO
 *    separador que todo el resto del repo (';') y con la referencia al Plan de Cuentas
 *    envuelta en INDIRECT(). Hasta v0.33.0 este banco exigia lo contrario -- comas, por una
 *    "excepcion de locale" que resulto ser falsa -- y por eso daba verde sobre cuatro reglas
 *    que no pintaban nada. Ver la nota medida en la cabecera de _formulaReglaFmt.
 *
 * 2. EL CICLO agregar/quitar sobre un mock de getConditionalFormatRules /
 *    setConditionalFormatRules: las reglas AJENAS sobreviven SIEMPRE (misma referencia, mismo
 *    orden), aplicar dos veces no duplica, revertir deja solo las ajenas, y si la escritura no
 *    verifica se restaura la foto previa completa.
 *
 * 3. EL CODIGO FUENTE: sin hex hardcodeado (la SSOT del color es el formato de Franco), sin
 *    setFormula/setValue (el modulo no escribe celdas), sin el patron que barre el sweep de
 *    colisiones de probar_capitalizacion, y con la medicion del 2026-08-21 documentada inline.
 *
 * USO:  node devtools/probar_formato_medios.js
 * @version 0.31.0
 * @since 2026-08-20
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = '/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c';

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// ============================================
// MOCKS
// ============================================

// El estado mutable que las publicas ven a traves de SpreadsheetApp.getActiveSpreadsheet().
const mundo = { ss: null, ui: null };
const props = {};

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp,
    MONEDAS_DISPONIBLES: ['ARS', 'USD', 'AUD', 'EUR'],
    SpreadsheetApp: {
        flush() {},
        getActiveSpreadsheet: () => mundo.ss,
        getUi: () => {
            if (!mundo.ui) throw new Error('sin UI');
            return mundo.ui;
        },
        newConditionalFormatRule: () => {
            const r = { formula: null, color: null, rangos: [] };
            const b = {
                whenFormulaSatisfied(f) { r.formula = f; return b; },
                setFontColor(c) { r.color = c; return b; },
                setRanges(rs) { r.rangos = rs; return b; },
                build() {
                    return {
                        _mock: r,
                        getBooleanCondition: () => ({
                            getCriteriaType: () => 'CUSTOM_FORMULA',
                            getCriteriaValues: () => [r.formula]
                        }),
                        getRanges: () => r.rangos
                    };
                }
            };
            return b;
        }
    },
    PropertiesService: {
        getDocumentProperties: () => ({
            setProperty: (k, v) => { props[k] = v; },
            getProperty: (k) => (k in props ? props[k] : null),
            deleteProperty: (k) => { delete props[k]; }
        })
    },
    Utilities: { formatDate: () => '2026-08-20_0000' },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {},
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormulerioV0111.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_StockYFlujo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormatoMedios.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,NAV_CONFIG,SYF_BLOQUE_MEDIOS,SYF_TIPOS_TABLERO,DATA_START_ROW});',
    ctx);

/** Hoja Tablero falsa: rotulos del gemelo 2026-08-20, colores de fuente y reglas mutables. */
function crearHoja(colores, reglasIniciales, opciones) {
    opciones = opciones || {};
    const valores = Object.assign({
        AE7: 'Tipo de Medios.',
        AE9: 'Ahorros', AE10: 'Financiación', AE11: 'Hogar', AE12: 'Inversiones',
        C17: 'Medio'
    }, opciones.valores || {});
    return {
        _reglas: reglasIniciales.slice(),
        getRange(a1) {
            return {
                getValue: () => (valores[a1] !== undefined ? valores[a1] : ''),
                getDisplayValue: () => String(valores[a1] || ''),
                getA1Notation: () => a1,
                getFontColorObject: () => {
                    const c = colores[a1];
                    return {
                        getColorType: () => (c && c.tema ? 'THEME' : 'RGB'),
                        asRgbColor: () => {
                            if (c && c.tema) throw new Error('asRgbColor sobre color de tema');
                            return { asHexString: () => c };
                        }
                    };
                }
            };
        },
        getConditionalFormatRules() { return this._reglas.slice(); },
        setConditionalFormatRules(rs) {
            this._reglas = opciones.sabotaje ? opciones.sabotaje(rs.slice()) : rs.slice();
        }
    };
}

function crearPlanilla(hojaTablero) {
    const nombres = ['Inicio', 'Tablero', 'Presupuesto', 'Cargas', 'Plan de Cuentas',
                     'Mirada Interanual', 'Registros', 'Tipos de Cambio', 'Proyeccion'];
    return {
        getSheets: () => nombres.map(n => ({ getName: () => n })),
        getSheetByName: (n) => {
            if (n === 'Tablero') return hojaTablero;
            if (n === 'Plan de Cuentas') return { getName: () => n };
            return null;
        }
    };
}

function crearUi(respuesta) {
    const ui = {
        Button: { YES: 'SI', NO: 'NO' },
        ButtonSet: { YES_NO: 'YES_NO', OK: 'OK' },
        alert: (t, m, botones) => (botones === ui.ButtonSet.YES_NO ? ui.Button[respuesta] : ui.Button.YES)
    };
    return ui;
}

/** Regla booleana ajena generica. */
function reglaAjena(criterio, valor, rango) {
    return {
        getBooleanCondition: () => ({ getCriteriaType: () => criterio, getCriteriaValues: () => [valor] }),
        getRanges: () => [{ getA1Notation: () => rango }]
    };
}

const COLORES_SANOS = { AE9: '#1a7f37', AE10: '#b35900', AE11: '#0b5394', AE12: '#FF7A00CC' };
const TIPOS = ['Ahorros', 'Financiación', 'Hogar', 'Inversiones'];

// ============================================
// 1. LA FORMULA
// ============================================

console.log('=== 1. La formula de cada regla (locale es_AR: aca el ";" es OBLIGATORIO) ===');
{
    const cfg = ctx.RANGES.MEDIOS_PAGO;
    const catalogoEsperado = "'" + cfg.sheet + "'!$" + cfg.columns.nombre + '$' +
        ctx.DATA_START_ROW + ':$' + cfg.end;
    const indiceEsperado = (cfg.columns.proyecto.charCodeAt(0) - cfg.columns.nombre.charCodeAt(0)) + 1;

    ok(ctx._catalogoMediosFmt() === catalogoEsperado,
       'el catalogo se deriva de RANGES.MEDIOS_PAGO: ' + ctx._catalogoMediosFmt());
    ok(!/\$N\$\d/.test(ctx._catalogoMediosFmt()),
       'filas ABIERTAS: sin tope de fila que se pudra cuando Franco agregue un medio');
    ok(ctx._indiceTipoMedioFmt() === indiceEsperado,
       'el indice del Tipo se deriva de las columnas de RANGES: ' + ctx._indiceTipoMedioFmt());

    const b = ctx.SYF_BLOQUE_MEDIOS;
    const colFinEsperada = String.fromCharCode(b.columnas[1].col.charCodeAt(0) - 1);
    const rangoEsperado = b.columnas[0].col + b.filaDatos + ':' + colFinEsperada + b.filaFin;
    ok(ctx._rangoMediosFmt() === rangoEsperado,
       'el rango se deriva de SYF_BLOQUE_MEDIOS: ' + ctx._rangoMediosFmt());
    // decision Franco 2026-08-21: se abrio una fila mas en la hoja (C16:I29 -> C16:I30, para
    // poder sumar un medio 13o). SYF_BLOQUE_MEDIOS.filaFin paso de 29 a 30 y este rango tiene
    // que seguirlo SOLO: si el test siguiera exigiendo 'C18:E29' daria VERDE sobre la geometria
    // vieja mientras el codigo ya mira la nueva -- exactamente el agujero que Franco pidio cerrar.
    ok(ctx._rangoMediosFmt() === 'C18:E30',
       'y con la geometria de hoy (filaFin=30) da C18:E30 (la columna Medio con sus combinadas C:E)');

    TIPOS.forEach(tipo => {
        const f = ctx._formulaReglaFmt(tipo);
        const p = [];
        if (f[0] !== '=') p.push('no empieza con =');
        if (f.indexOf('{') !== -1) p.push('tiene un array literal {}');
        if (f.indexOf(',') !== -1) p.push('usa "," -- con coma la regla no parsea en es_AR y no pinta nunca');
        if (f.indexOf(';') === -1) p.push('no tiene ";": la regla se evalua en el locale de la planilla');
        let par = 0, com = 0;
        for (const ch of f) { if (ch === '(') par++; else if (ch === ')') par--; else if (ch === '"') com++; }
        if (par !== 0) p.push('parentesis desbalanceados (' + par + ')');
        if (com % 2 !== 0) p.push('comillas desbalanceadas');
        if (p.length) { fallas++; console.log('  !!! ' + tipo + ': ' + p.join(', ')); }
        else console.log('  OK  ' + tipo + ': estructura sana');

        ok(f.indexOf('$' + b.columnas[0].col + b.filaDatos + ';') !== -1,
           tipo + ': evalua $C18 (columna absoluta, fila relativa)');
        ok(f.indexOf('$' + b.columnas[0].col + '$' + b.filaDatos) === -1,
           tipo + ': la fila NO es absoluta (cada fila del rango evalua su propio medio)');
        ok(f.indexOf(catalogoEsperado) !== -1, tipo + ': consulta el catalogo derivado de RANGES');
        ok(f.indexOf('; ' + indiceEsperado + '; 0)') !== -1,
           tipo + ': indice derivado y busqueda exacta (ultimo argumento 0)');
        ok(f.indexOf('="' + tipo + '"') !== -1, tipo + ': compara contra el rotulo LEIDO, intacto');
        ok(!/TIDETRACK_|Registros!|Proyeccion!/.test(f),
           tipo + ': no toca cotizaciones ni el ledger: solo catalogo y rotulo');
    });

    // LAS DOS COSAS QUE HACEN QUE LA REGLA PINTE, medidas en la planilla el 2026-08-21 sobre
    // C18:E29 con los cuatro medios de tipo Hogar como testigo:
    //   con COMA  -> Sheets acepta la regla y no pinta NADA (no parsea en es_AR, y no avisa)
    //   con ';'   -> pinta exactamente los cuatro medios Hogar
    //   sin INDIRECT -> "Formula no valida": Sheets rechaza la referencia a otra hoja
    // Las dos aserciones de abajo existen para que nadie "simplifique" ninguna de las dos.
    const esperada = '=VLOOKUP($C18; INDIRECT("' + catalogoEsperado + '"); ' + indiceEsperado + '; 0)="Ahorros"';
    ok(ctx._formulaReglaFmt('Ahorros') === esperada,
       'formula completa exacta: ' + ctx._formulaReglaFmt('Ahorros'));
    ['Ahorros', 'Inversiones', 'Hogar', 'Financiación'].forEach(t => {
        const f = ctx._formulaReglaFmt(t);
        ok(f.indexOf('INDIRECT("') !== -1, t + ': la referencia al Plan de Cuentas va por INDIRECT');
        ok(!/[,;]\s*'Plan de Cuentas'!/.test(f),
           t + ': ninguna referencia DIRECTA a otra hoja (Sheets la rechaza como invalida)');
        // El separador: mismo locale que TODO el resto del repo, sin excepciones.
        ok(f.indexOf(', ') === -1 && f.indexOf(',') === -1,
           t + ': ni una coma. Con coma la regla se guarda pero no parsea en es_AR y no pinta nunca');
        ok((f.match(/;/g) || []).length === 3, t + ': los tres separadores del VLOOKUP son ";"');
    });
    ok(ctx._formulaReglaFmt('Fra"nco').indexOf('Fra""nco') !== -1,
       'una comilla en el rotulo se dobla (no rompe la formula)');
    ok(ctx._formulaReglaFmt('Financiación').indexOf('Financiación') !== -1,
       'los acentos del rotulo pasan intactos');
}

console.log('\n=== 1b. Canonizacion tolerante para la verificacion ===');
{
    const conComa = ctx._formulaReglaFmt('Hogar');
    const conPuntoYComa = conComa.replace(/, /g, ';');
    ok(ctx._canonizarFormulaCondFmt(conComa) === ctx._canonizarFormulaCondFmt(conPuntoYComa),
       'si Sheets re-serializara con ";", la verificacion NO revierte una regla correcta');
    ok(ctx._canonizarFormulaCondFmt(ctx._formulaReglaFmt('Hogar')) !==
       ctx._canonizarFormulaCondFmt(ctx._formulaReglaFmt('Ahorros')),
       'pero dos tipos distintos JAMAS canonizan igual');
}

console.log('\n=== 1c. Normalizacion de colores ===');
{
    ok(ctx._normalizarHexFmt('#FF00AA') === '#ff00aa', 'hex a minusculas');
    ok(ctx._normalizarHexFmt('#80ff00aa') === '#ff00aa', '#aarrggbb (9 chars) pierde el canal alfa');
    ok(ctx._normalizarHexFmt('#1a7f37') === '#1a7f37', 'un hex sano queda igual');
}

// ============================================
// 2. IDENTIFICACION DE REGLAS
// ============================================

console.log('\n=== 2. Que regla es propia y cual es ajena ===');
{
    const formulaPropia = ctx._formulaReglaFmt('Ahorros');
    const propia = {
        getBooleanCondition: () => ({ getCriteriaType: () => 'CUSTOM_FORMULA', getCriteriaValues: () => [formulaPropia] }),
        getRanges: () => [{ getA1Notation: () => ctx._rangoMediosFmt() }]
    };
    const gradiente = { getBooleanCondition: () => null, getRanges: () => [{ getA1Notation: () => 'S9:S27' }] };
    const booleanaAjena = reglaAjena('NUMBER_GREATER_THAN', 0, 'L29');
    const customAjena = reglaAjena('CUSTOM_FORMULA', '=$N$12<0', ctx._rangoMediosFmt());
    // La trampa: MISMA formula que las propias pero en OTRO rango. Es ajena y debe sobrevivir.
    const trampa = reglaAjena('CUSTOM_FORMULA', formulaPropia, 'C34:C35');

    ok(ctx._esReglaPropiaFmt(propia) === true, 'formula propia + rango propio -> propia');
    ok(ctx._esReglaPropiaFmt(gradiente) === false, 'una regla de gradiente jamas es propia');
    ok(ctx._esReglaPropiaFmt(booleanaAjena) === false, 'una booleana que no es CUSTOM_FORMULA es ajena');
    ok(ctx._esReglaPropiaFmt(customAjena) === false,
       'CUSTOM_FORMULA en el rango propio pero SIN el VLOOKUP al catalogo -> ajena');
    ok(ctx._esReglaPropiaFmt(trampa) === false,
       'la formula propia en OTRO rango es AJENA: la identifican las dos condiciones juntas');

    const clases = ctx._clasificarReglasFmt([gradiente, propia, booleanaAjena, trampa]);
    ok(clases.propias.length === 1 && clases.ajenas.length === 3,
       'clasificar separa 1 propia y 3 ajenas');
    ok(clases.ajenas[0] === gradiente && clases.ajenas[1] === booleanaAjena && clases.ajenas[2] === trampa,
       'las ajenas conservan su orden relativo (misma referencia)');
}

// ============================================
// 3. EL CICLO COMPLETO
// ============================================

console.log('\n=== 3. Aplicar: las ajenas sobreviven, aplicar dos veces no duplica ===');
{
    const formulaVieja = ctx._formulaReglaFmt('Ahorros');
    const propiaVieja = {
        getBooleanCondition: () => ({ getCriteriaType: () => 'CUSTOM_FORMULA', getCriteriaValues: () => [formulaVieja] }),
        getRanges: () => [{ getA1Notation: () => ctx._rangoMediosFmt() }]
    };
    const gradiente = { getBooleanCondition: () => null, getRanges: () => [{ getA1Notation: () => 'S9:S27' }] };
    const booleanaAjena = reglaAjena('NUMBER_GREATER_THAN', 0, 'L29');
    const trampa = reglaAjena('CUSTOM_FORMULA', formulaVieja, 'C34:C35');
    const ajenas = [gradiente, booleanaAjena, trampa];

    const hoja = crearHoja(COLORES_SANOS, [gradiente, propiaVieja, booleanaAjena, trampa]);
    mundo.ss = crearPlanilla(hoja);
    mundo.ui = crearUi('YES');
    delete props.formato_medios_aplicado;

    const r1 = ctx.aplicarFormatoMedios();
    ok(r1.ok === true, 'aplicar sobre hoja sana devuelve ok. ' + (r1.error || ''));
    ok(hoja._reglas.length === 7, 'quedan 3 ajenas + 4 propias = 7 reglas. Hay ' + hoja._reglas.length);
    ok(hoja._reglas[0] === gradiente && hoja._reglas[1] === booleanaAjena && hoja._reglas[2] === trampa,
       'las 3 ajenas sobreviven ADELANTE, con su misma referencia y orden');
    ok(hoja._reglas.indexOf(propiaVieja) === -1, 'la regla propia VIEJA se reemplazo, no se duplico');

    const propiasVivas = hoja._reglas.filter(r => r._mock);
    ok(propiasVivas.length === 4, 'se escribieron exactamente 4 reglas propias (una por tipo)');
    const porTipo = {};
    propiasVivas.forEach(r => {
        TIPOS.forEach(t => { if (r._mock.formula.indexOf('="' + t + '"') !== -1) porTipo[t] = r._mock; });
    });
    ok(Object.keys(porTipo).length === 4, 'hay una regla por cada rotulo leido de AE9:AE12');
    ok(porTipo['Ahorros'] && porTipo['Ahorros'].color === '#1a7f37',
       'Ahorros toma el color de fuente vivo de AE9 (#1a7f37)');
    ok(porTipo['Financiación'] && porTipo['Financiación'].color === '#b35900',
       'Financiación toma el de AE10, con el rotulo acentuado tal cual');
    ok(porTipo['Hogar'] && porTipo['Hogar'].color === '#0b5394', 'Hogar toma el de AE11');
    ok(porTipo['Inversiones'] && porTipo['Inversiones'].color === '#7a00cc',
       'Inversiones normaliza el hex de 9 chars de AE12 a #7a00cc (sin canal alfa)');
    ok(propiasVivas.every(r => r._mock.rangos.length === 1 &&
        r._mock.rangos[0].getA1Notation() === ctx._rangoMediosFmt()),
       'las 4 reglas cubren exactamente ' + ctx._rangoMediosFmt());
    ok(String(props.formato_medios_aplicado || '').indexOf('Ahorros=#1a7f37') !== -1,
       'la aplicacion queda registrada en DocumentProperties');

    const r2 = ctx.aplicarFormatoMedios();
    ok(r2.ok === true, 'aplicar por SEGUNDA vez tambien devuelve ok');
    ok(hoja._reglas.length === 7, 'y sigue habiendo 7 reglas: no duplica. Hay ' + hoja._reglas.length);
    ok(hoja._reglas[0] === gradiente && hoja._reglas[1] === booleanaAjena && hoja._reglas[2] === trampa,
       'las ajenas sobreviven tambien a la segunda pasada');

    console.log('\n=== 3b. Revertir: quita SOLO las propias ===');
    const r3 = ctx.revertirFormatoMedios();
    ok(r3.ok === true, 'revertir devuelve ok');
    ok(hoja._reglas.length === 3, 'quedan solo las 3 ajenas. Hay ' + hoja._reglas.length);
    ok(hoja._reglas[0] === gradiente && hoja._reglas[1] === booleanaAjena && hoja._reglas[2] === trampa,
       'y son exactamente las mismas, en el mismo orden');
    ok(!('formato_medios_aplicado' in props), 'revertir borra el registro de aplicacion');

    const r4 = ctx.revertirFormatoMedios();
    ok(r4.ok === true && /No hay reglas/.test(r4.detalle || ''),
       'revertir sin reglas propias avisa y no toca nada');
    ok(hoja._reglas.length === 3, 'las ajenas siguen intactas tras el segundo revertir');
}

console.log('\n=== 3c. Cancelar en el dialogo no escribe nada ===');
{
    const ajena = reglaAjena('NUMBER_GREATER_THAN', 0, 'L29');
    const hoja = crearHoja(COLORES_SANOS, [ajena]);
    mundo.ss = crearPlanilla(hoja);
    mundo.ui = crearUi('NO');
    const r = ctx.aplicarFormatoMedios();
    ok(r.ok === false && /Cancelado/.test(r.error || ''), 'cancelar devuelve ok:false con aviso');
    ok(hoja._reglas.length === 1 && hoja._reglas[0] === ajena, 'las reglas quedaron como estaban');
}

console.log('\n=== 3d. Si la escritura no verifica, se restaura la foto previa ===');
{
    const ajena1 = reglaAjena('NUMBER_GREATER_THAN', 0, 'L29');
    const ajena2 = { getBooleanCondition: () => null, getRanges: () => [{ getA1Notation: () => 'S9:S27' }] };
    // Sabotaje: la "planilla" tira a la basura toda regla propia que se le mande.
    const hoja = crearHoja(COLORES_SANOS, [ajena1, ajena2],
        { sabotaje: rs => rs.filter(r => !ctx._esReglaPropiaFmt(r)) });
    mundo.ss = crearPlanilla(hoja);
    mundo.ui = crearUi('YES');
    const r = ctx.aplicarFormatoMedios();
    ok(r.ok === false && /NO VERIFICA/.test(r.error || ''),
       'la relectura detecta que las propias no quedaron y falla fuerte');
    ok(hoja._reglas.length === 2 && hoja._reglas[0] === ajena1 && hoja._reglas[1] === ajena2,
       'y la hoja queda con su foto previa: las 2 ajenas intactas');
}

console.log('\n=== 4. Preflight por rotulo y colores imposibles ===');
{
    mundo.ui = crearUi('YES');

    const hojaMovida = crearHoja(COLORES_SANOS, [], { valores: { AE7: 'Otra cosa' } });
    mundo.ss = crearPlanilla(hojaMovida);
    let r = ctx.estadoFormatoMedios();
    ok(r.ok === false && /AE7/.test(r.error || ''), 'titulo corrido en AE7 -> aborta y lo nombra');

    const hojaSinTipo = crearHoja(COLORES_SANOS, [], { valores: { AE11: '' } });
    mundo.ss = crearPlanilla(hojaSinTipo);
    r = ctx.estadoFormatoMedios();
    ok(r.ok === false && /AE11/.test(r.error || ''), 'un tipo vacio -> aborta y nombra la celda');

    const hojaDuplicada = crearHoja(COLORES_SANOS, [], { valores: { AE11: 'Ahorros' } });
    mundo.ss = crearPlanilla(hojaDuplicada);
    r = ctx.estadoFormatoMedios();
    ok(r.ok === false && /dos veces/.test(r.error || ''), 'un tipo duplicado -> aborta (dos reglas iguales)');

    const hojaSinHeader = crearHoja(COLORES_SANOS, [], { valores: { C17: 'Cuenta' } });
    mundo.ss = crearPlanilla(hojaSinHeader);
    r = ctx.estadoFormatoMedios();
    ok(r.ok === false && /C17/.test(r.error || ''), 'header del bloque de medios corrido -> aborta');

    const hojaTema = crearHoja(Object.assign({}, COLORES_SANOS, { AE10: { tema: true } }), []);
    mundo.ss = crearPlanilla(hojaTema);
    r = ctx.estadoFormatoMedios();
    ok(r.ok === false && /AE10/.test(r.error || '') && /tema/.test(r.error || ''),
       'un color de TEMA no se adivina: aborta claro nombrando la celda');
    r = ctx.aplicarFormatoMedios();
    ok(r.ok === false && hojaTema._reglas.length === 0,
       'y aplicar con color de tema tampoco escribe nada');

    // El titulo real termina en punto y el preflight compara por contencion normalizada.
    const hojaSana = crearHoja(COLORES_SANOS, []);
    mundo.ss = crearPlanilla(hojaSana);
    r = ctx.estadoFormatoMedios();
    ok(r.ok === true, 'estado sobre hoja sana: ok (el punto final de "Tipo de Medios." no molesta)');
    ok(/#1a7f37/.test(r.detalle) && /#7a00cc/.test(r.detalle),
       'el estado muestra los hex leidos en vivo (incluido el normalizado)');
    ok(/ajenas: 0/.test(r.detalle), 'el estado cuenta las reglas de la hoja');
    ok(hojaSana._reglas.length === 0, 'estado no escribio ninguna regla');

    const hojaRepetida = crearHoja(Object.assign({}, COLORES_SANOS, { AE11: '#1a7f37' }), []);
    mundo.ss = crearPlanilla(hojaRepetida);
    r = ctx.estadoFormatoMedios();
    ok(r.ok === true && /indistinguibles/.test(r.detalle),
       'dos tipos con el mismo color: AVISA sin abortar (el color es decision de Franco)');
}

console.log('\n=== 5. El codigo fuente del modulo ===');
{
    const src = fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_FormatoMedios.js'), 'utf8');
    ok(!/#[0-9a-fA-F]{6}/.test(src),
       'CERO hex hardcodeado: la unica fuente de color es el formato vivo de Franco');
    ok(!/\.setFormula\(|\.setValue\(|\.setValues\(/.test(src),
       'el modulo no escribe NINGUNA celda: solo reglas de formato condicional');
    ok(/getFontColorObject/.test(src) && /asRgbColor/.test(src) && /asHexString/.test(src),
       'los colores se leen en vivo con getFontColorObject().asRgbColor().asHexString()');
    ok(/Formula no valida/.test(src) && /2026-08-21/.test(src),
       'la medicion en la planilla (coma no pinta / sin INDIRECT es invalida) esta documentada inline');
    ok(!/EXCEPCION DOCUMENTADA A LA REGLA DE LOCALE/.test(src),
       'ya no queda la "excepcion de locale": era falsa y es lo que dejo las reglas mudas');
    // El sweep de colisiones de probar_capitalizacion busca este patron en TODOS los DEVTOOL_.
    const sweep = /proponer\(\s*(?:[A-Za-z_.]+\s*,\s*)?'([A-Z]{1,2}\d{1,3})'/g;
    ok(!sweep.test(src),
       'ninguna celda entra al sweep de colisiones: este modulo no propone formulas de celda');
    ok(!/'C18'|'F18'|'H18'/.test(src),
       'no nombra literalmente las celdas que otros modulos ya poseen (trampa 6)');
    ok(/decision Franco 2026-08-20/.test(src), 'las decisiones estructurales estan fechadas inline');
}

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
