/**
 * devtools/probar_tablero_faltante.js
 * Banco de pruebas de DEVTOOL_TableroFaltanteProyectado.js.
 *
 * Cinco mitades:
 *
 * 1. LA FORMULA de cada bloque: la QUERY real de Franco se EMPOTRA VERBATIM (no se reconstruye),
 *    cero arrays literales {} nuevos (los dos unicos '{' del resultado son los que ya traia el
 *    fixture reusado), cero comas fuera de strings, parentesis/comillas balanceados, variables
 *    de LET y de LAMBDA de 3+ caracteres, capacidad correcta en el ARRAY_CONSTRAIN, selectores
 *    del TABLERO ($N$2/$N$3/$N$4) y jamas los de Inicio.
 *
 * 2. IDEMPOTENCIA: una formula YA aplicada se reconoce como tal (_anclaYaEsNuestraTfp) y NO se
 *    vuelve a envolver -- la mutacion que importa: si se perdiera esa deteccion, un segundo
 *    "Aplicar" anidaria la formula dentro de si misma y corromperia el agrupado por cuenta.
 *
 * 3. LOS TOTALES: SUMIF (nunca SUM a secas, que mezclaria real+faltante) con criterios "<>" y
 *    "=" espejados sobre el MISMO rango.
 *
 * 4. EL GRIS: la regla usa ';' (jamas coma), columna absoluta/fila relativa, y la clasificacion
 *    propia/ajena rechaza una formula correcta en el RANGO equivocado y un rango correcto con la
 *    formula equivocada -- las dos mutaciones que en DEVTOOL_FormatoMedios dejaron una regla
 *    muda o pintando donde no debia.
 *
 * 5. EL CICLO preflight/plan sobre una hoja simulada: el caso "recien migrado" (Franco todavia
 *    no aplico nada), el guard de capacidad (mas cuentas reales que lugar, aborta), el caso
 *    "ya aplicado" (nada que hacer) y el rechazo de datos ajenos en las celdas destino.
 *
 * USO:  node devtools/probar_tablero_faltante.js
 * @version 0.36.0
 * @since 2026-08-21
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// ============================================
// CARGA DEL MODULO REAL (y sus dependencias, en el mismo orden que Apps Script las evalua)
// ============================================
const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp,
    SpreadsheetApp: {
        flush() {},
        getActiveSpreadsheet: () => null,
        getUi: () => { throw new Error('sin UI'); },
        newConditionalFormatRule: () => { throw new Error('no se uso en esta carga'); }
    },
    PropertiesService: {
        getDocumentProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} })
    },
    Utilities: { sleep() {}, formatDate: () => '2026-08-21_1200' },
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
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_Proyeccion.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_Capitalizacion.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_TableroFaltanteProyectado.js'), 'utf8') +
    '\n;Object.assign(globalThis,{RANGES,SHEETS,NAV_CONFIG,MONEDAS_DISPONIBLES,TIPOS_RIQUEZA,' +
    'CUENTAS_NEUTRAS,CUENTA_ARRASTRE,CAP_SELECTORES,PROY_MESES,TFP_BLOQUES,TFP_ORDEN,TFP_COLOR_GRIS});',
    ctx);

// ============================================================================
// El chequeo estructural de una formula (mismas trampas es_AR que el resto del repo)
// ============================================================================
function revisar(nombre, f, opts) {
    opts = opts || {};
    const p = [];
    if (!f || f[0] !== '=') p.push('no empieza con =');
    // Los '{' del fixture reusado (tabla_real de Franco) son esperados; cualquier '{' DE MAS
    // (autoria propia) no lo es.
    const llaves = (f.match(/{/g) || []).length;
    if (llaves !== (opts.llavesEsperadas || 0)) {
        p.push('tiene ' + llaves + ' "{" y se esperaban ' + (opts.llavesEsperadas || 0) +
            ' (solo las del fixture reusado; nada nuevo se autoria con {} -- ver trampa 1 de InicioPresupuesto)');
    }
    const sinStrings = f.replace(/"[^"]*"/g, '""');
    if (sinStrings.indexOf(',') !== -1) p.push('tiene una coma fuera de un string: separador equivocado o decimal con coma');
    let par = 0, com = 0;
    for (const ch of f) { if (ch === '(') par++; else if (ch === ')') par--; else if (ch === '"') com++; }
    if (par !== 0) p.push('parentesis desbalanceados (' + par + ')');
    if (com % 2 !== 0) p.push('comillas desbalanceadas');
    (f.match(/\n\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/g) || []).forEach(x => {
        const v = x.trim().replace(';', '').trim();
        if (v.length <= 2) p.push('variable LET "' + v + '" es muy corta: puede chocar con una funcion');
    });
    (f.match(/LAMBDA\(\s*[A-Za-z_][A-Za-z0-9_]*(\s*;\s*[A-Za-z_][A-Za-z0-9_]*)*\s*[;)]/g) || []).forEach(x => {
        x.replace(/^LAMBDA\(\s*/, '').replace(/\s*[;)]$/, '').split(';').forEach(v => {
            v = v.trim();
            if (v.length <= 2) p.push('parametro de LAMBDA "' + v + '" es muy corto: puede chocar con una funcion');
        });
    });
    if (/DATEVALUE/.test(f)) p.push('usa DATEVALUE, que depende del locale: el mes va por MATCH+SPLIT');
    if (/\$I\$[234]/.test(f)) p.push('referencia los selectores de INICIO: este modulo es del TABLERO');
    if (p.length) { fallas++; console.log('\n### FALLA ' + nombre + ': ' + p.join(', ')); }
    else console.log('  OK  ' + nombre + ': estructura sana');
    return !p.length;
}

// ============================================================================
// Fixture: una formula "real" al estilo de las que Franco ya tiene en R10/U10/X10
// ============================================================================
function fixtureReal(categoria) {
    return '=IFERROR(QUERY(\n  ARRAYFORMULA({\n    AL6:AL \\ \n    IF(AK6:AK="Egreso"; -AV6:AV; AV6:AV) \\ \n    AM6:AM\n  });\n' +
        '  "SELECT Col1, SUM(Col2) WHERE Col3 = \'' + categoria + '\' AND Col1 != \'Traspaso\' ' +
        'AND Col1 IS NOT NULL AND Col1 != \'Inicio Mes\' GROUP BY Col1 ORDER BY SUM(Col2) DESC LABEL Col1 \'\', SUM(Col2) \'\'";\n  0\n); {"" \\ ""})';
}

console.log('=== 0. Las tres publicas existen ===');
['estadoTableroFaltanteProyectado', 'aplicarTableroFaltanteProyectado', 'revertirTableroFaltanteProyectado']
    .forEach(n => ok(typeof ctx[n] === 'function', n + ' es una funcion'));

console.log('\n=== 1. Estructura de la formula ancla, por bloque ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const fx = fixtureReal(b.categoria);
        const f = ctx._formulaCuentasTfp(b, fx.substring(1));   // sin el '=' inicial, como lo pasa el preflight
        const llavesFixture = (fx.match(/{/g) || []).length;
        revisar('ancla ' + clave, f, { llavesEsperadas: llavesFixture });

        ok(f.indexOf('tabla_real; ' + fx.substring(1) + ';') !== -1,
           clave + ': la QUERY real de Franco se empotra VERBATIM (no se reescribe)');
        ok(f.indexOf(ctx.SHEETS.PROYECCION) !== -1, clave + ': lee la hoja Proyeccion');
        ok(f.indexOf('TIDETRACK_USD()') !== -1 && f.indexOf('TIDETRACK_AUD()') !== -1 && f.indexOf('TIDETRACK_EUR()') !== -1,
           clave + ': convierte lo proyectado con las custom functions (un previsto no tiene TC congelado)');
        ok(f.indexOf('$N$2') !== -1 && f.indexOf('$N$3') !== -1 && f.indexOf('$N$4') !== -1,
           clave + ': usa los selectores del TABLERO (CAP_SELECTORES.tablero)');
        ok(f.indexOf('"' + b.categoria + '"') !== -1, clave + ': filtra la proyeccion por su categoria');
        ok(f.indexOf('ARRAY_CONSTRAIN(tabla_ordenada; 9; 4)') !== -1,
           clave + ': acota a la capacidad del bloque (9 pares en 19 filas). Dio: ' +
           (f.match(/ARRAY_CONSTRAIN\([^)]*\)/) || ['?'])[0]);
        ok(f.indexOf('MAX(0; val_proy - val_real)') !== -1,
           clave + ': el faltante nunca es negativo (MAX(0; proyectado - real))');
        ['Traspaso', 'Inicio Mes'].forEach(n => ok(f.indexOf('(cuenta_proy<>"' + n + '")') !== -1,
           clave + ': excluye la cuenta neutra "' + n + '" de lo proyectado'));
        ok(f.indexOf('SEQUENCE(n_cuentas * 2)') !== -1, clave + ': arma 2 filas por cuenta incluida');
        ok(f.indexOf('MOD(pos; 2) = 0') !== -1, clave + ': decide fila par/impar (real arriba, faltante abajo)');
    });
}

console.log('\n=== 2. Idempotencia: una formula ya aplicada no se vuelve a envolver ===');
{
    const b = ctx.TFP_BLOQUES.ingresos;
    const fx = fixtureReal(b.categoria);
    ok(ctx._anclaYaEsNuestraTfp(fx.substring(1)) === false,
       'la QUERY original de Franco NO se reconoce como "ya nuestra"');

    const yaAplicada = ctx._formulaCuentasTfp(b, fx.substring(1));
    ok(ctx._anclaYaEsNuestraTfp(yaAplicada.substring(1)) === true,
       'la formula que este modulo escribe SI se reconoce como "ya nuestra"');

    // LA MUTACION QUE IMPORTA: si _anclaYaEsNuestraTfp no existiera (o se rompiera), el
    // preflight tomaria `yaAplicada` como si fuera la QUERY original de Franco y la
    // _formulaCuentasTfp() la volveria a envolver -- un anidamiento que ademas corrompe
    // nombres_real/montos_real (dejan de ser el agrupado limpio por cuenta: pasan a ser el
    // propio derrame de dos-filas-por-cuenta). Se demuestra el dano CONCRETO simulando que el
    // guard no estuviera (llamando a _formulaCuentasTfp directo con la formula ya aplicada,
    // que es exactamente lo que el preflight NO hace gracias al guard probado arriba):
    const vecesUnaCapa = (yaAplicada.match(/tabla_real;/g) || []).length;
    const reenvuelta = ctx._formulaCuentasTfp(b, yaAplicada.substring(1));
    const vecesDosCapaS = (reenvuelta.match(/tabla_real;/g) || []).length;
    ok(vecesDosCapaS > vecesUnaCapa,
       'SIN el guard, envolver la formula ya aplicada la haria crecer (de ' + vecesUnaCapa +
       ' a ' + vecesDosCapaS + ' referencias a "tabla_real"): el anidamiento es real y creciente. ' +
       'Por eso el preflight verifica _anclaYaEsNuestraTfp ANTES de llamar a _formulaCuentasTfp.');
}

console.log('\n=== 3. Los totales: SUMIF, nunca SUM a secas ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const real = ctx._formulaTotalRealTfp(b);
        const falt = ctx._formulaTotalFaltanteTfp(b);
        const rango = b.colCuenta + b.filaDatos + ':' + b.colCuenta + b.filaFin;
        const rangoMonto = b.colMonto + b.filaDatos + ':' + b.colMonto + b.filaFin;

        ok(real === '=SUMIF(' + rango + '; "<>"; ' + rangoMonto + ')',
           clave + ': total real exacto. Dio: ' + real);
        ok(falt === '=SUMIF(' + rango + '; "="; ' + rangoMonto + ')',
           clave + ': total faltante exacto. Dio: ' + falt);

        // LA MUTACION QUE IMPORTA: un SUM(rango) a secas (lo que habia antes) sumaria real
        // Y faltante mezclados en cuanto el bloque tenga filas de faltante.
        ok(!/^=SUM\(/.test(real), clave + ': el total real NO es un SUM ciego (mezclaria real+faltante)');
        ok(!/^=SUM\(/.test(falt), clave + ': el total faltante NO es un SUM ciego');
        // Los dos SUMIF leen EL MISMO rango de monto y el MISMO rango de cuenta: son
        // literalmente espejos con el criterio invertido, no dos formulas que puedan divergir.
        ok(real.replace('"<>"', 'X').replace('SUMIF', 'S') === falt.replace('"="', 'X').replace('SUMIF', 'S'),
           clave + ': real y faltante son el mismo SUMIF con el criterio invertido');
    });
}

console.log('\n=== 4. Capacidad de cuentas, derivada del alto del bloque (no hardcodeada dos veces) ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        ok(ctx._capacidadCuentasTfp(ctx.TFP_BLOQUES[clave]) === 9,
           clave + ': 19 filas (10 a 28) -> 9 pares cuenta/faltante');
    });
    ok(ctx._capacidadCuentasTfp({ filaDatos: 10, filaFin: 29 }) === 10,
       'la capacidad se recalcula si el bloque creciera (20 filas -> 10 pares), no queda fija en 9');
}

console.log('\n=== 5. El gris de las filas de faltante (formato condicional) ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const f = ctx._formulaReglaGrisTfp(b);
        ok(f === '=AND($' + b.colCuenta + b.filaDatos + '=""; ' + b.colMonto + b.filaDatos + '<>"")',
           clave + ': formula exacta. Dio: ' + f);
        // LA TRAMPA DEL SEPARADOR (medida en DEVTOOL_FormatoMedios v0.33.0): con coma, Sheets
        // acepta la regla y NO PINTA NADA, sin avisar. Ni una coma.
        ok(f.indexOf(',') === -1, clave + ': ni una coma en la regla (con coma no parsea en es_AR)');
        ok((f.match(/;/g) || []).length === 1, clave + ': un solo separador ";" (los dos args de AND)');
        // Columna ABSOLUTA, fila RELATIVA: cada fila de la regla evalua su propia cuenta/monto.
        ok(f.indexOf('$' + b.colCuenta + b.filaDatos) !== -1, clave + ': columna Cuenta absoluta');
        ok(f.indexOf('$' + b.colCuenta + '$' + b.filaDatos) === -1, clave + ': la FILA no es absoluta');
    });
}

console.log('\n=== 5b. Clasificacion propia/ajena: las dos mutaciones que dejaron reglas mudas ===');
{
    function reglaFalsa(formula, rango, tipo) {
        return {
            getBooleanCondition: () => ({
                getCriteriaType: () => tipo || 'CUSTOM_FORMULA',
                getCriteriaValues: () => [formula]
            }),
            getRanges: () => [{ getA1Notation: () => rango }]
        };
    }
    const b = ctx.TFP_BLOQUES.ingresos;
    const formulaPropia = ctx._formulaReglaGrisTfp(b);
    const rangoPropio = b.colMonto + b.filaDatos + ':' + b.colMonto + b.filaFin;

    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaPropia, rangoPropio)) === true,
       'formula correcta + rango correcto -> propia');

    // MUTACION 1: la formula correcta, pero en OTRO rango (por ejemplo, el de otro bloque).
    // Si esto se reconociera como propia, aplicar podria pisar el rango equivocado.
    const otroRango = ctx.TFP_BLOQUES.fijos.colMonto + b.filaDatos + ':' + ctx.TFP_BLOQUES.fijos.colMonto + b.filaFin;
    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaPropia, otroRango)) === false,
       'MUTACION rango equivocado: la MISMA formula en OTRO rango es AJENA (no se toca)');

    // MUTACION 2: el rango correcto, pero la formula de OTRO bloque (o cualquier variante).
    const formulaDeOtroBloque = ctx._formulaReglaGrisTfp(ctx.TFP_BLOQUES.variables);
    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaDeOtroBloque, rangoPropio)) === false,
       'MUTACION formula equivocada: el rango correcto con la formula de OTRO bloque es AJENA');

    // MUTACION 3: la formula con COMA en vez de ';' (la trampa historica). No coincide byte a
    // byte con lo que este modulo escribe, asi que nunca se reconoce como propia -- y por lo
    // tanto una regla asi (heredada, muda) se preserva como ajena y se reporta, no se "arregla"
    // en silencio adoptandola.
    const conComa = formulaPropia.replace(';', ',');
    ok(ctx._esReglaPropiaTfp(reglaFalsa(conComa, rangoPropio)) === false,
       'MUTACION separador coma: no se reconoce como propia (no es exactamente lo que este modulo escribe)');

    // Una regla totalmente ajena (otro proposito, otro rango) sobrevive intacta.
    const ajena = reglaFalsa('=$N$4="ARS"', 'A1:A1');
    const clases = ctx._clasificarReglasTfp([reglaFalsa(formulaPropia, rangoPropio), ajena]);
    ok(clases.propias.length === 1 && clases.ajenas.length === 1 && clases.ajenas[0] === ajena,
       'de dos reglas (una propia, una ajena), se separan 1 y 1, y la ajena es la MISMA referencia');
}

// ============================================================================
// 6. PREFLIGHT / PLAN sobre una hoja simulada
// ============================================================================
function celda(valor, formula) {
    return {
        _valor: valor === undefined ? '' : valor,
        _formula: formula || '',
        getValue() { return this._valor; },
        getFormula() { return this._formula; },
        getDisplayValue() { return String(this._valor); }
    };
}

/** Arma una hoja Tablero simulada. `estado` decide que tan aplicado esta cada bloque. */
function hojaTableroSimulada(opts) {
    opts = opts || {};
    const cuentasPorBloque = opts.cuentasPorBloque || { ingresos: 2, fijos: 2, variables: 2 };
    const celdas = {};
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        celdas[b.titulo.celda] = celda(b.titulo.esperado + '.');
        celdas[b.rotuloFaltante.celda] = celda(
            (opts.rotuloFaltante === false) ? '' : b.rotuloFaltante.esperado);
        celdas[b.headerCuenta.celda] = celda(b.headerCuenta.esperado);
        celdas[b.headerMonto.celda] = celda(b.headerMonto.esperado);

        const anclaCelda = clave + 'Ancla';
        if (opts.yaAplicado) {
            const fx = fixtureReal(b.categoria);
            celdas[b.colCuenta + b.filaDatos] = celda('umoh', ctx._formulaCuentasTfp(b, fx.substring(1)));
        } else {
            celdas[b.colCuenta + b.filaDatos] = celda('umoh', fixtureReal(b.categoria));
        }

        celdas[b.totalReal] = celda(1000,
            opts.yaAplicado ? ctx._formulaTotalRealTfp(b) : '=SUM(' + b.colMonto + b.filaDatos + ':' + b.colMonto + b.filaFin + ')');
        if (opts.totalFaltanteConDato) {
            celdas[b.totalFaltante] = celda(500, '');
        } else {
            celdas[b.totalFaltante] = celda('', opts.yaAplicado ? ctx._formulaTotalFaltanteTfp(b) : '');
        }

        // Columna Cuenta: N cuentas con nombre, el resto vacio, hasta filaFin.
        const n = cuentasPorBloque[clave] || 0;
        for (let f = b.filaDatos; f <= b.filaFin; f++) {
            if (f === b.filaDatos) continue;   // ya seteada arriba (ancla)
            const conNombre = (f - b.filaDatos) < n;
            celdas[b.colCuenta + f] = celda(conNombre ? ('Cuenta' + f) : '');
        }
    });
    celdas['N2'] = celda('Agosto');
    celdas['N3'] = celda(2026);
    celdas['N4'] = celda('ARS');

    const reglasVivas = opts.reglasVivas || [];
    return {
        getRange(a1) {
            const rango = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(a1);
            if (rango && rango[1] === rango[3]) {
                // Rango de una sola columna (R10:R28): getValues() barre celda por celda.
                const col = rango[1], desde = Number(rango[2]), hasta = Number(rango[4]);
                return {
                    getValues() {
                        const filas = [];
                        for (let f = desde; f <= hasta; f++) {
                            if (!celdas[col + f]) celdas[col + f] = celda('');
                            filas.push([celdas[col + f].getValue()]);
                        }
                        return filas;
                    }
                };
            }
            if (!celdas[a1]) celdas[a1] = celda('');
            return celdas[a1];
        },
        getConditionalFormatRules: () => reglasVivas
    };
}

function ssSimulada(hojaTablero, opts) {
    opts = opts || {};
    const hojas = { Tablero: hojaTablero, Proyeccion: {} };
    if (opts.sinProyeccion) delete hojas.Proyeccion;
    return { getSheetByName: nombre => hojas[nombre] || null };
}

console.log('\n=== 6a. Recien migrado: Franco escribio el rotulo, nada mas esta aplicado ===');
{
    const hoja = hojaTableroSimulada({ cuentasPorBloque: { ingresos: 4, fijos: 5, variables: 9 } });
    const ss = ssSimulada(hoja);
    const pre = ctx._preflightTfp(ss);
    ctx.TFP_ORDEN.forEach(clave => {
        const info = pre.bloques[clave];
        ok(info.anclaYaAplicada === false, clave + ': la ancla todavia es la de Franco');
        ok(info.totalRealYaEsSumif === false, clave + ': el total real todavia es el SUM viejo');
        ok(info.faltanteEsNuestra === false, clave + ': el total de faltantes esta vacio, no aplicado');
        ok(info.rotuloYaEsta === true, clave + ': el rotulo "Faltante proyectado" ya estaba (Franco lo escribio)');
    });
    ok(pre.bloques.variables.cuentasVivas === 9, 'variables: 9 cuentas reales vivas, justo en el limite');

    const plan = ctx._planTfp(pre);
    // 3 anclas + 3 totales reales + 3 totales de faltante = 9. El rotulo NO se propone (ya esta).
    ok(plan.cambios.length === 9, 'el plan propone 9 celdas (3 anclas + 3 reales + 3 faltantes). Dio ' + plan.cambios.length);
    const celdasEsperadas = ['R10', 'S7', 'S8', 'U10', 'V7', 'V8', 'X10', 'Y7', 'Y8'];
    const celdasPlan = plan.cambios.map(c => c.celda).sort();
    ok(JSON.stringify(celdasPlan) === JSON.stringify(celdasEsperadas.sort()),
       'exactamente esas 9 celdas. Dio: ' + celdasPlan.join(','));
    ok(plan.cambios.every(c => !!c.formulaNueva || c.tipo === 'rotulo'),
       'toda celda que no es rotulo trae su formulaNueva (el bug que se corrigio en el desarrollo)');
    ok(_reglasHacenFaltaTfpSafe(ctx, plan) === true, 'las reglas de gris tambien hacen falta (hoja sin ninguna)');
}
function _reglasHacenFaltaTfpSafe(ctx, plan) { return ctx._reglasHacenFaltaTfp(plan.reglas); }

console.log('\n=== 6b. Rotulo faltante: el plan lo agrega ===');
{
    const hoja = hojaTableroSimulada({ rotuloFaltante: false });
    const pre = ctx._preflightTfp(ssSimulada(hoja));
    const plan = ctx._planTfp(pre);
    const rotulos = plan.cambios.filter(c => c.tipo === 'rotulo').map(c => c.celda).sort();
    ok(JSON.stringify(rotulos) === JSON.stringify(['R8', 'U8', 'X8']),
       'los tres rotulos se proponen cuando faltan. Dio: ' + rotulos.join(','));
}

console.log('\n=== 6c. Guard de capacidad: mas cuentas reales que lugar -> ABORTA ===');
{
    const hoja = hojaTableroSimulada({ cuentasPorBloque: { ingresos: 4, fijos: 5, variables: 10 } });
    let lanzo = false, msg = '';
    try { ctx._preflightTfp(ssSimulada(hoja)); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo, 'con 10 cuentas reales (capacidad 9) el preflight aborta');
    ok(msg.indexOf('Agrandar el bloque') !== -1, 'el mensaje dice que hay que agrandar el bloque, no que se recorta solo');
}

console.log('\n=== 6d. Ya aplicado en los tres bloques: nada que hacer ===');
{
    const b = ctx.TFP_BLOQUES;
    function reglaViva(clave) {
        const bl = b[clave];
        return {
            getBooleanCondition: () => ({
                getCriteriaType: () => 'CUSTOM_FORMULA',
                getCriteriaValues: () => [ctx._formulaReglaGrisTfp(bl)]
            }),
            getRanges: () => [{ getA1Notation: () => bl.colMonto + bl.filaDatos + ':' + bl.colMonto + bl.filaFin }]
        };
    }
    const hoja = hojaTableroSimulada({
        yaAplicado: true,
        reglasVivas: ['ingresos', 'fijos', 'variables'].map(reglaViva)
    });
    const pre = ctx._preflightTfp(ssSimulada(hoja));
    ctx.TFP_ORDEN.forEach(clave => ok(pre.bloques[clave].anclaYaAplicada === true, clave + ': ancla ya aplicada'));
    const plan = ctx._planTfp(pre);
    ok(plan.cambios.length === 0, 'CERO celdas a escribir. Dio ' + plan.cambios.length);
    ok(ctx._reglasHacenFaltaTfp(plan.reglas) === false, 'las tres reglas de gris ya estan correctas');
}

console.log('\n=== 6e. Dato ajeno en el total de faltantes: NO se pisa ===');
{
    const hoja = hojaTableroSimulada({ totalFaltanteConDato: true });
    let lanzo = false, msg = '';
    try { ctx._preflightTfp(ssSimulada(hoja)); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo, 'con S8 conteniendo un valor ajeno, el preflight aborta');
    ok(msg.indexOf('dato de Franco') !== -1, 'el mensaje explica que podria ser un dato de Franco');
}

console.log('\n=== 6f. Sin la hoja Proyeccion: aborta con mensaje accionable ===');
{
    const hoja = hojaTableroSimulada();
    let lanzo = false, msg = '';
    try { ctx._preflightTfp(ssSimulada(hoja, { sinProyeccion: true })); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo, 'sin "Proyeccion" el preflight aborta');
    ok(msg.indexOf('BD de Proyeccion') !== -1, 'dice que hay que correr BD de Proyeccion primero');
}

// ============================================================================
// 7. Verificacion de invariantes
// ============================================================================
console.log('\n=== 7. _verificarInvariantesTfp: identidad del total real, faltante no-negativo, sin perder cuentas ===');
{
    function preFalso(overrides) {
        // Estado sano por defecto para LOS TRES bloques (asi la mutacion se puede aislar a uno
        // solo sin que los otros dos disparen fallas por bloques mal armados en el mock).
        const sano = { totalReal: 1000, totalFaltante: 200, cuentasCol: ['umoh', '', 'Tidetrack', ''] };
        const estados = {};
        ctx.TFP_ORDEN.forEach(clave => { estados[clave] = Object.assign({}, sano); });
        Object.assign(estados.ingresos, overrides || {});

        const hoja = {
            getRange(a1) {
                for (const clave of ctx.TFP_ORDEN) {
                    const b = ctx.TFP_BLOQUES[clave];
                    const st = estados[clave];
                    if (a1 === b.totalReal) return { getValue: () => st.totalReal };
                    if (a1 === b.totalFaltante) return { getValue: () => st.totalFaltante };
                    if (a1 === b.colCuenta + b.filaDatos + ':' + b.colCuenta + b.filaFin) {
                        return { getValues: () => st.cuentasCol.map(v => [v]) };
                    }
                }
                return { getValue: () => '', getValues: () => [['']] };
            }
        };
        const bloques = {};
        ctx.TFP_ORDEN.forEach(clave => {
            const st = estados[clave];
            bloques[clave] = {
                b: ctx.TFP_BLOQUES[clave],
                totalRealValorPrevio: st.totalRealPrevio !== undefined ? st.totalRealPrevio : 1000,
                cuentasVivas: st.cuentasVivas !== undefined ? st.cuentasVivas : 2
            };
        });
        return { hoja: hoja, bloques: bloques };
    }
    // Caso sano: nada cambio.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({}));
        ok(inv.fallas.length === 0, 'caso sano: cero fallas. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION: el total real se movio (el refactor NO puede mover el total real).
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalReal: 1500 }));
        ok(inv.fallas.some(f => /total real paso de/.test(f)),
           'MUTACION total real movido: la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION: el faltante dio negativo (el MAX(0;...) de la formula estaria roto).
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalFaltante: -50 }));
        ok(inv.fallas.some(f => /faltantes dio negativo/.test(f)),
           'MUTACION faltante negativo: la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION: se perdio una cuenta real (antes habia 2, ahora aparece 1).
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasCol: ['umoh', '', '', ''] }));
        ok(inv.fallas.some(f => /no puede perderse ni duplicarse/.test(f)),
           'MUTACION cuenta real perdida: la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // Pendiente ("Cargando...") no es una falla: es un aviso, y no revierte formulas correctas.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalReal: 'Cargando...' }));
        ok(inv.fallas.length === 0 && inv.avisos.some(a => /calculando/.test(a)),
           '"Cargando..." persistente es AVISO, no falla (no se revierte una formula correcta)');
    }
}

// ============================================================================
// 8. Barrido anti-colision: ninguna otra celda del repo escribe R7:Y28 del Tablero
// ============================================================================
console.log('\n=== 8. Ninguna otra celda del repo escribe donde este modulo escribe ===');
{
    const misCeldas = [];
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        misCeldas.push(b.rotuloFaltante.celda, ctx._celdaAnclaTfp(b), b.totalReal, b.totalFaltante);
    });
    const dir = path.join(RAIZ, 'src');
    const choques = [];
    fs.readdirSync(dir).filter(f => f.indexOf('DEVTOOL_') === 0 && f !== 'DEVTOOL_TableroFaltanteProyectado.js')
        .forEach(f => {
            const src = fs.readFileSync(path.join(dir, f), 'utf8');
            misCeldas.forEach(c => {
                // Busca la celda como literal de string ('R10' o "R10"), que es como los otros
                // modulos declaran sus propias celdas destino.
                if (src.indexOf("'" + c + "'") !== -1 || src.indexOf('"' + c + '"') !== -1) {
                    choques.push(c + ' <- ' + f);
                }
            });
        });
    ok(choques.length === 0, choques.length
        ? 'CELDAS QUE OTRO MODULO TAMBIEN NOMBRA: ' + choques.join('; ') +
          ' (revisar si son escrituras activas o referencias historicas/diagnosticas)'
        : 'ninguna de mis 12 celdas (' + misCeldas.join(',') + ') aparece en otro DEVTOOL_*.js');
}

console.log('\n' + '='.repeat(60));
if (fallas) {
    console.log('FALLAS: ' + fallas);
    process.exit(1);
} else {
    console.log('TODO OK');
}
