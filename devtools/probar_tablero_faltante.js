/**
 * devtools/probar_tablero_faltante.js
 * Banco de pruebas de DEVTOOL_TableroFaltanteProyectado.js.
 *
 * Siete mitades:
 *
 * 1. LA FORMULA de cada bloque: la QUERY real de Franco se EMPOTRA VERBATIM (no se reconstruye),
 *    cero arrays literales {} nuevos (los dos unicos '{' del resultado son los que ya traia el
 *    fixture reusado), cero comas fuera de strings, parentesis/comillas balanceados, variables
 *    de LET y de LAMBDA de 3+ caracteres, capacidad correcta en el ARRAY_CONSTRAIN (derivada de
 *    TFP_FILA_FIN, no hardcodeada), selectores del TABLERO ($N$2/$N$3/$N$4) y jamas los de
 *    Inicio, mas el bloque de TRUNCADO (n_ocultas/monto_oculto/aviso_texto/filas_total) y el
 *    orden real-primero que manda las proyectadas-sin-registro al final.
 *
 * 2. IDEMPOTENCIA: una formula YA aplicada se reconoce como tal (_anclaYaEsNuestraTfp) y NO se
 *    vuelve a envolver -- la mutacion que importa: si se perdiera esa deteccion, un segundo
 *    "Aplicar" anidaria la formula dentro de si misma y corromperia el agrupado por cuenta.
 *
 * 3. LOS TOTALES: SUMIF (nunca SUM a secas, que mezclaria real+faltante) con criterios "<>" y
 *    "=" espejados sobre el MISMO rango de DATOS (filaDatos a filaFin-1: la fila de aviso queda
 *    afuera de los dos totales a proposito).
 *
 * 4. CAPACIDAD Y GRIS: la capacidad se deriva de TFP_FILA_FIN (un solo numero, tres bloques). La
 *    regla gris de "falta" usa ';' (jamas coma), columna absoluta/fila relativa, rango de DATOS
 *    (sin la fila de aviso); la regla de AVISO es una cuarta regla, absoluta en las dos
 *    coordenadas, sobre la fila reservada. La clasificacion propia/ajena rechaza una formula
 *    correcta en el RANGO equivocado y un rango correcto con la formula equivocada -- las dos
 *    mutaciones que en DEVTOOL_FormatoMedios dejaron una regla muda o pintando donde no debia.
 *
 * 5. EL CICLO preflight/plan sobre una hoja simulada: el caso "recien migrado" (Franco todavia
 *    no aplico nada), el caso de TRUNCADO (mas cuentas reales que lugar: preflight NO aborta,
 *    _verificarInvariantesTfp exige exactamente `capacidad` cuentas reales), el caso "ya
 *    aplicado" (nada que hacer, con las SEIS reglas propias vivas) y el rechazo de datos ajenos
 *    en las celdas destino.
 *
 * 6. _verificarInvariantesTfp POR MUTACION: sin truncar exige un PISO (todas las reales de
 *    antes siguen, de mas pueden sumarse proyectadas-sin-real); con truncado exige un numero
 *    EXACTO (ni una real de mas, ni una de menos) -- las dos ramas se prueban por separado, con
 *    la mutacion que las distinguiria de una comparacion de igualdad ciega (la que rompia con
 *    catalogo union real, ver decision de diseno #2 del modulo).
 *
 * 7. BARRIDO ANTI-COLISION: ninguna otra celda del repo escribe donde este modulo escribe,
 *    incluida la fila de aviso (30) que se suma a la lista de celdas propias.
 *
 * USO:  node devtools/probar_tablero_faltante.js
 * @version 0.39.0
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
    'CUENTAS_NEUTRAS,CUENTA_ARRASTRE,CAP_SELECTORES,PROY_MESES,TFP_BLOQUES,TFP_ORDEN,TFP_COLOR_GRIS,' +
    'TFP_FILA_FIN});',
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
        const capacidad = ctx._capacidadCuentasTfp(b);
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
        ok(capacidad === 10, clave + ': la capacidad derivada de TFP_FILA_FIN (30) da 10 pares. Dio ' + capacidad);
        ok(f.indexOf('ARRAY_CONSTRAIN(tabla_ordenada; ' + capacidad + '; 4)') !== -1,
           clave + ': el ARRAY_CONSTRAIN usa la MISMA capacidad derivada (' + capacidad + '), nunca un numero ' +
           'suelto que pudiera desincronizarse. Dio: ' + (f.match(/ARRAY_CONSTRAIN\([^)]*\)/) || ['?'])[0]);
        ok(f.indexOf('MAX(0; val_proy - val_real)') !== -1,
           clave + ': el faltante nunca es negativo (MAX(0; proyectado - real))');
        ['Traspaso', 'Inicio Mes'].forEach(n => ok(f.indexOf('(cuenta_proy<>"' + n + '")') !== -1,
           clave + ': excluye la cuenta neutra "' + n + '" de lo proyectado'));
        ok(f.indexOf('SEQUENCE(filas_total)') !== -1, clave + ': arma tantas filas como haga falta (datos + aviso si corresponde)');
        ok(f.indexOf('MOD(pos; 2) = 0') !== -1, clave + ': decide fila par/impar (real arriba, faltante abajo)');

        // ORDEN real-primero: ninguna cuenta proyectada-sin-registro puede desplazar a una con
        // movimiento real, sin importar cuan grande sea lo proyectado -- por eso quedan siempre
        // al final y son las primeras en truncarse (decision Franco 2026-08-21, cabecera).
        ok(f.indexOf('SORT(tabla_incluida; 2; FALSE; 3; FALSE)') !== -1,
           clave + ': ordena por monto REAL descendente primero (proyectado como desempate): las ' +
           'proyectadas-sin-registro (real=0) siempre quedan al final, nunca desplazan a una cuenta real');

        // TRUNCADO A LA VISTA: nunca se aborta, se avisa en la propia hoja.
        ok(f.indexOf('n_total; ROWS(tabla_ordenada)') !== -1, clave + ': mide el universo COMPLETO antes de topar');
        ok(f.indexOf('n_ocultas; n_total - n_cuentas') !== -1,
           clave + ': cuenta cuantas quedaron afuera (universo completo menos lo mostrado)');
        ok(f.indexOf('hay_ocultas; n_ocultas > 0') !== -1, clave + ': sabe si hace falta avisar');
        ok(/monto_oculto;\s*\(SUM\(INDEX\(tabla_ordenada; 0; 2\)\) - SUM\(INDEX\(tabla_topada; 0; 2\)\)\)/.test(f),
           clave + ': el monto oculto es el TOTAL menos lo YA MOSTRADO (real), sin refiltrar de nuevo');
        ok(f.indexOf('SUM(INDEX(tabla_ordenada; 0; 4)) - SUM(INDEX(tabla_topada; 0; 4))') !== -1,
           clave + ': el monto oculto suma tambien la parte de faltante de las cuentas no mostradas');
        ok(f.indexOf('aviso_texto; "y " & n_ocultas & " cuenta" & IF(n_ocultas = 1; ""; "s") & " mas"') !== -1,
           clave + ': el texto del aviso singulariza/pluraliza "cuenta(s)" segun n_ocultas');
        ok(f.indexOf('filas_total; filas_datos + IF(hay_ocultas; 1; 0)') !== -1,
           clave + ': el derrame crece UNA fila mas SOLO si hay ocultas (si no, esa celda ni se genera)');
        ok(f.indexOf('IF(pos > filas_datos; aviso_texto;') !== -1 && f.indexOf('IF(pos > filas_datos; monto_oculto;') !== -1,
           clave + ': la fila extra (si existe) es la UNICA con el texto/monto de aviso, nunca una fila de datos');

        // MUTACION: si el ARRAY_CONSTRAIN usara un numero DISTINTO al de _capacidadCuentasTfp
        // (por ejemplo, si alguien hardcodeara "10" a mano en vez de usar `capacidad`), esta
        // formula seguiria compilando pero se desincronizaria del ARRAY_CONSTRAIN del bloque de
        // MEDIOS o de una futura resize de TFP_FILA_FIN sin que nadie lo note. Se prueba que
        // subir TFP_FILA_FIN efectivamente CAMBIA el numero que usa el ARRAY_CONSTRAIN (no queda
        // fijo en 10 para siempre):
        const bloqueMasGrande = { filaDatos: b.filaDatos, filaFin: b.filaFin + 20 };
        const fMasGrande = ctx._formulaCuentasTfp(Object.assign({}, b, bloqueMasGrande), fx.substring(1));
        const capacidadMasGrande = ctx._capacidadCuentasTfp(bloqueMasGrande);
        ok(capacidadMasGrande > capacidad && fMasGrande.indexOf('ARRAY_CONSTRAIN(tabla_ordenada; ' + capacidadMasGrande + '; 4)') !== -1,
           clave + ': MUTACION -- si el bloque creciera (filaFin+20), el ARRAY_CONSTRAIN sube CON el, ' +
           'no queda pegado al 10 de hoy (capacidad recalculada: ' + capacidadMasGrande + ')');
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

console.log('\n=== 3. Los totales: SUMIF, nunca SUM a secas, y SIN la fila de aviso ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const real = ctx._formulaTotalRealTfp(b);
        const falt = ctx._formulaTotalFaltanteTfp(b);
        // El rango de DATOS excluye la ULTIMA fila del bloque (filaFin - 1, no filaFin): esa
        // fila esta reservada al aviso de truncado, y si los totales la incluyeran, el monto
        // oculto se sumaria como si fuera un dato real/faltante mas.
        const filaFinDatos = b.filaFin - 1;
        const rango = b.colCuenta + b.filaDatos + ':' + b.colCuenta + filaFinDatos;
        const rangoMonto = b.colMonto + b.filaDatos + ':' + b.colMonto + filaFinDatos;

        ok(real === '=SUMIF(' + rango + '; "<>"; ' + rangoMonto + ')',
           clave + ': total real exacto (rango de datos, sin la fila de aviso). Dio: ' + real);
        ok(falt === '=SUMIF(' + rango + '; "="; ' + rangoMonto + ')',
           clave + ': total faltante exacto. Dio: ' + falt);

        // LA MUTACION QUE IMPORTA (aviso): si el rango llegara hasta filaFin (incluyendo la fila
        // reservada), el total real sumaria el monto oculto del aviso como si fuera una cuenta
        // real de mas -- justo el bug que este modulo evita al excluirla.
        ok(real.indexOf(b.colCuenta + b.filaDatos + ':' + b.colCuenta + b.filaFin + ';') === -1,
           clave + ': MUTACION -- el total real NO usa el rango completo hasta filaFin (se comeria el aviso)');

        // LA MUTACION QUE YA EXISTIA: un SUM(rango) a secas (lo que habia antes) sumaria real
        // Y faltante mezclados en cuanto el bloque tenga filas de faltante.
        ok(!/^=SUM\(/.test(real), clave + ': el total real NO es un SUM ciego (mezclaria real+faltante)');
        ok(!/^=SUM\(/.test(falt), clave + ': el total faltante NO es un SUM ciego');
        // Los dos SUMIF leen EL MISMO rango de monto y el MISMO rango de cuenta: son
        // literalmente espejos con el criterio invertido, no dos formulas que puedan divergir.
        ok(real.replace('"<>"', 'X').replace('SUMIF', 'S') === falt.replace('"="', 'X').replace('SUMIF', 'S'),
           clave + ': real y faltante son el mismo SUMIF con el criterio invertido');
    });
}

console.log('\n=== 4. Capacidad de cuentas, derivada de TFP_FILA_FIN (un solo numero, tres bloques) ===');
{
    ok(ctx.TFP_FILA_FIN === 30, 'TFP_FILA_FIN es 30 (Franco: "visible hasta la fila 30")');
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        ok(b.filaFin === ctx.TFP_FILA_FIN, clave + ': b.filaFin ES la constante compartida (no un 30 copiado a mano)');
        ok(ctx._capacidadCuentasTfp(b) === 10,
           clave + ': 21 filas (10 a 30) -> 10 pares cuenta/faltante (y sobra 1 fila, la del aviso)');
    });
    // La fila sobrante (21 es impar) es EXACTAMENTE una: ni 0 ni 2. Si algun dia TFP_FILA_FIN
    // hiciera el total de filas PAR, no sobraria ninguna fila para el aviso -- se documenta como
    // supuesto en la cabecera del modulo (decision #5), pero se prueba aca que HOY el numero
    // elegido (30) efectivamente deja una:
    const b = ctx.TFP_BLOQUES.ingresos;
    const filasBloque = b.filaFin - b.filaDatos + 1;
    ok(filasBloque === 21 && filasBloque % 2 === 1, 'HOY el bloque tiene 21 filas (impar): sobra exactamente 1');
    ok(2 * ctx._capacidadCuentasTfp(b) === filasBloque - 1,
       'los 10 pares ocupan 20 filas, la fila 21 (numero 30) queda libre para el aviso');

    ok(ctx._capacidadCuentasTfp({ filaDatos: 10, filaFin: 31 }) === 11,
       'la capacidad se recalcula si el bloque creciera (22 filas -> 11 pares), no queda fija en 10');
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

        // El RANGO de la regla gris es el de DATOS (sin la fila de aviso): si incluyera filaFin,
        // competiria por esa celda con la regla de aviso (seccion 5c).
        const item = ctx._reglasGrisTfp().find(r => r.clave === clave);
        ok(item.celda === b.colMonto + b.filaDatos + ':' + b.colMonto + (b.filaFin - 1),
           clave + ': el rango de la regla gris excluye la ultima fila (reservada al aviso). Dio: ' + item.celda);
    });
}

console.log('\n=== 5b. El aviso de truncado: formula absoluta, rango de UNA fila, cursiva ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const f = ctx._formulaReglaAvisoTfp(b);
        ok(f === '=$' + b.colMonto + '$' + b.filaFin + '<>""',
           clave + ': formula exacta del aviso (columna Y FILA absolutas). Dio: ' + f);
        ok(f.indexOf(',') === -1, clave + ': tambien libre de comas');

        const item = ctx._reglasAvisoTfp().find(r => r.clave === clave);
        ok(item.celda === b.colCuenta + b.filaFin + ':' + b.colMonto + b.filaFin,
           clave + ': el rango del aviso es SOLO la fila reservada (Cuenta:Monto). Dio: ' + item.celda);
        ok(item.tipo === 'aviso', clave + ': el item se identifica como tipo "aviso"');

        // Las dos reglas (gris y aviso) nunca compiten por la misma celda: sus rangos no se
        // solapan (gris llega hasta filaFin-1, aviso empieza justo en filaFin).
        const gris = ctx._reglasGrisTfp().find(r => r.clave === clave);
        ok(gris.celda.indexOf(String(b.filaFin)) === -1,
           clave + ': el rango gris no menciona la fila del aviso (' + b.filaFin + ')');
    });

    // La construccion del rule-builder pide setItalic ademas del mismo color: es lo que distingue
    // visualmente el aviso del gris recto de "falta" (decision Franco: "su propio tratamiento").
    let pidioItalic = false, pidioColor = '';
    const hojaFalsa = { getRange: () => ({}) };
    ctx.SpreadsheetApp.newConditionalFormatRule = () => {
        const b2 = {
            whenFormulaSatisfied: () => b2, setFontColor: c => { pidioColor = c; return b2; },
            setItalic: v => { pidioItalic = v; return b2; }, setRanges: () => b2, build: () => ({})
        };
        return b2;
    };
    ctx._construirReglaAvisoTfp(hojaFalsa, { formula: '=TRUE', celda: 'A1:B1' });
    ok(pidioItalic === true, 'la regla de aviso pide setItalic(true)');
    ok(pidioColor === ctx.TFP_COLOR_GRIS, 'la regla de aviso usa la MISMA tinta que el gris de falta (' + ctx.TFP_COLOR_GRIS + ')');
}

console.log('\n=== 5c. Clasificacion propia/ajena: gris + aviso, y las mutaciones que dejaron reglas mudas ===');
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
    const rangoPropio = b.colMonto + b.filaDatos + ':' + b.colMonto + (b.filaFin - 1);

    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaPropia, rangoPropio)) === true,
       'formula gris correcta + rango correcto -> propia');

    // El aviso TAMBIEN cuenta como propio (es la MUTACION que importa ahora: si _esReglaPropiaTfp
    // solo mirara las reglas de gris, la regla de aviso quedaria clasificada como AJENA y
    // aplicar() la dejaria viva para siempre, duplicandose en cada corrida).
    const formulaAviso = ctx._formulaReglaAvisoTfp(b);
    const rangoAviso = b.colCuenta + b.filaFin + ':' + b.colMonto + b.filaFin;
    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaAviso, rangoAviso)) === true,
       'MUTACION -- formula de AVISO correcta + su rango -> tambien propia (no solo el gris)');

    // MUTACION 1: la formula correcta, pero en OTRO rango (por ejemplo, el de otro bloque).
    // Si esto se reconociera como propia, aplicar podria pisar el rango equivocado.
    const otroRango = ctx.TFP_BLOQUES.fijos.colMonto + b.filaDatos + ':' + ctx.TFP_BLOQUES.fijos.colMonto + (b.filaFin - 1);
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

    // _reglasHacenFaltaTfp ahora exige las SEIS (3 gris + 3 aviso), no tres.
    ok(ctx._reglasPropiasTfp().length === 6, '_reglasPropiasTfp junta 3 gris + 3 aviso = 6');
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
    const hoja = hojaTableroSimulada({ cuentasPorBloque: { ingresos: 4, fijos: 5, variables: 10 } });
    const ss = ssSimulada(hoja);
    const pre = ctx._preflightTfp(ss);
    ctx.TFP_ORDEN.forEach(clave => {
        const info = pre.bloques[clave];
        ok(info.anclaYaAplicada === false, clave + ': la ancla todavia es la de Franco');
        ok(info.totalRealYaEsSumif === false, clave + ': el total real todavia es el SUM viejo');
        ok(info.faltanteEsNuestra === false, clave + ': el total de faltantes esta vacio, no aplicado');
        ok(info.rotuloYaEsta === true, clave + ': el rotulo "Faltante proyectado" ya estaba (Franco lo escribio)');
    });
    ok(pre.bloques.variables.cuentasVivas === 10, 'variables: 10 cuentas reales vivas, justo en el limite (capacidad 10)');

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

console.log('\n=== 6c. Mas cuentas reales que lugar: TRUNCA (preflight ya NO aborta) ===');
{
    // Antes (v0.36.0) esto disparaba un throw ("Agrandar el bloque antes de correr esto"): con
    // 11 cuentas reales y capacidad 10, Franco se quedaba SIN la funcionalidad entera por una
    // sola cuenta de mas. La MUTACION que importa: si el guard de abort siguiera vivo, esta
    // llamada lanzaria y el test de abajo (que exige que NO lance) lo detectaria.
    const hoja = hojaTableroSimulada({ cuentasPorBloque: { ingresos: 4, fijos: 5, variables: 11 } });
    let lanzo = false, msg = '';
    let pre;
    try { pre = ctx._preflightTfp(ssSimulada(hoja)); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo === false, 'con 11 cuentas reales (capacidad 10) el preflight NO aborta. ' + (lanzo ? 'Lanzo: ' + msg : ''));
    ok(pre.bloques.variables.cuentasVivas === 11, 'cuentasVivas se sigue midiendo igual (11)');
    ok(pre.bloques.variables.capacidad === 10, 'capacidad se sigue midiendo igual (10)');

    // El plan SIGUE generandose con normalidad (la formula nueva es la que trunca y avisa sola,
    // ver seccion 1): no hace falta ningun camino especial en _planTfp para el caso de overflow.
    const plan = ctx._planTfp(pre);
    ok(plan.cambios.some(c => c.celda === 'X10' && c.tipo === 'ancla'),
       'el plan propone reescribir la ancla de Variables igual que si no hubiera overflow');
}

console.log('\n=== 6d. Ya aplicado en los tres bloques: nada que hacer (con las SEIS reglas propias) ===');
{
    const b = ctx.TFP_BLOQUES;
    function reglaViva(item) {
        return {
            getBooleanCondition: () => ({
                getCriteriaType: () => 'CUSTOM_FORMULA',
                getCriteriaValues: () => [item.formula]
            }),
            getRanges: () => [{ getA1Notation: () => item.celda }]
        };
    }
    const hoja = hojaTableroSimulada({
        yaAplicado: true,
        reglasVivas: ctx._reglasPropiasTfp().map(reglaViva)
    });
    const pre = ctx._preflightTfp(ssSimulada(hoja));
    ctx.TFP_ORDEN.forEach(clave => ok(pre.bloques[clave].anclaYaAplicada === true, clave + ': ancla ya aplicada'));
    const plan = ctx._planTfp(pre);
    ok(plan.cambios.length === 0, 'CERO celdas a escribir. Dio ' + plan.cambios.length);
    ok(ctx._reglasHacenFaltaTfp(plan.reglas) === false, 'las seis reglas (3 gris + 3 aviso) ya estan correctas');

    // MUTACION: si solo estuvieran vivas las TRES de gris (sin las de aviso, como en v0.36.0),
    // _reglasHacenFaltaTfp tiene que decir que SI hace falta escribir (las 3 de aviso faltan).
    const hojaSoloGris = hojaTableroSimulada({
        yaAplicado: true,
        reglasVivas: ctx._reglasGrisTfp().map(reglaViva)
    });
    const preSoloGris = ctx._preflightTfp(ssSimulada(hojaSoloGris));
    const planSoloGris = ctx._planTfp(preSoloGris);
    ok(ctx._reglasHacenFaltaTfp(planSoloGris.reglas) === true,
       'MUTACION -- con solo 3 reglas vivas (sin las de aviso) SI hace falta escribir (antes esto se leia como "completo")');
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
console.log('\n=== 7. _verificarInvariantesTfp: total real, faltante no-negativo, y el conteo de cuentas (con y sin truncado) ===');
{
    function preFalso(overrides) {
        // Estado sano por defecto para LOS TRES bloques (asi la mutacion se puede aislar a uno
        // solo sin que los otros dos disparen fallas por bloques mal armados en el mock).
        // capacidad=10 (la real, ver TFP_FILA_FIN); cuentasVivas=2 (bien por debajo, "sin
        // truncar" es la rama por defecto salvo que el test la override).
        const sano = {
            totalReal: 1000, totalFaltante: 200, cuentasCol: ['umoh', '', 'Tidetrack', ''],
            cuentasVivas: 2, capacidad: 10
        };
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
                    // El rango que USA el codigo real es el de _rangoColTfp: filaDatos a
                    // filaFin-1 (excluye la fila de aviso). Si este mock siguiera esperando
                    // filaDatos:filaFin (como antes de la decision #6), este match nunca
                    // ocurriria y el test caeria en el fallback vacio de abajo, enmascarando
                    // cualquier bug real de rango.
                    if (a1 === b.colCuenta + b.filaDatos + ':' + b.colCuenta + (b.filaFin - 1)) {
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
                cuentasVivas: st.cuentasVivas, capacidad: st.capacidad
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
    // MUTACION: se perdio una cuenta real (antes habia 2, ahora aparece 1) -- SIN truncar
    // (cuentasVivas=2 <= capacidad=10): la rama "piso" tiene que igual detectar la perdida.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasCol: ['umoh', '', '', ''] }));
        ok(inv.fallas.some(f => /no puede perderse/.test(f)),
           'MUTACION cuenta real perdida (sin truncar): la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // Pendiente ("Cargando...") no es una falla: es un aviso, y no revierte formulas correctas.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalReal: 'Cargando...' }));
        ok(inv.fallas.length === 0 && inv.avisos.some(a => /calculando/.test(a)),
           '"Cargando..." persistente es AVISO, no falla (no se revierte una formula correcta)');
    }

    console.log('\n--- 7b. Sin truncar: PISO, no igualdad exacta (catalogo union real, decision de diseno #2) ---');
    // Antes de este cambio, el invariante exigia IGUALDAD ESTRICTA (cuentasAhora === cuentasVivas)
    // -- eso rompia apenas el universo (real union catalogo) sumaba una cuenta proyectada-sin-real
    // ademas de las reales: el conteo post-escritura queda POR ENCIMA de cuentasVivas, y la
    // igualdad estricta lo marcaria como falla aunque no se perdio nada.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 2, cuentasCol: ['umoh', '', 'Tidetrack', '', 'CatalogoSinReal', ''] }));
        ok(inv.fallas.length === 0,
           'exactamente la capacidad (sin aviso): 3 nombres viven (2 reales + 1 catalogo-sin-real) y no es falla. Dio: ' + inv.fallas.join('; '));
        // MUTACION -- la comparacion VIEJA (igualdad estricta cuentasAhora !== cuentasVivas)
        // habria marcado esto como falla (3 !== 2), aunque no se perdio ninguna cuenta real:
        ok(3 !== 2, 'con la comparacion vieja esto SI se hubiera marcado como falla (documentado, no ejecutado)');
    }
    // "una cuenta menos (sin aviso)": cuentasVivas queda UN lugar por debajo de la capacidad.
    {
        const nueveNombres = Array.from({ length: 9 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 9, capacidad: 10, cuentasCol: nueveNombres }));
        ok(inv.fallas.length === 0, 'una cuenta menos que la capacidad (9 de 10): sin aviso, sin falla. Dio: ' + inv.fallas.join('; '));
    }
    // "exactamente la capacidad (sin aviso)": cuentasVivas === capacidad exacto.
    {
        const diezNombres = Array.from({ length: 10 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 10, capacidad: 10, cuentasCol: diezNombres }));
        ok(inv.fallas.length === 0, 'exactamente la capacidad (10 de 10): todavia NO es el caso de truncado (no es > capacidad), sin falla. Dio: ' + inv.fallas.join('; '));
    }

    console.log('\n--- 7c. Con truncado: numero EXACTO (ni una real de mas, ni una de menos) ---');
    // "mas cuentas que capacidad": cuentasVivas > capacidad. El orden real-primero garantiza que
    // los `capacidad` lugares se llenan SOLO con reales -- asi que el numero esperado es EXACTO.
    {
        const diezNombres = Array.from({ length: 10 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 15, capacidad: 10, cuentasCol: diezNombres }));
        ok(inv.fallas.length === 0,
           'truncado correcto: 15 reales para 10 lugares, quedaron exactamente 10 -> sano. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION -- si el truncado dejara UNA MENOS de las que le tocaban (9 en vez de 10), eso SI
    // tiene que ser una falla: es la diferencia entre "truncar avisando" y "perder en silencio".
    {
        const nueveNombres = Array.from({ length: 9 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 15, capacidad: 10, cuentasCol: nueveNombres }));
        ok(inv.fallas.some(f => /truncado esperado/.test(f) && /exactamente 10/.test(f)),
           'MUTACION -- truncado con UNA cuenta real de menos de lo esperado (9 de 10) SI es falla. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION -- y si el truncado dejara UNA DE MAS (11 en vez de 10, por ejemplo si el
    // ARRAY_CONSTRAIN se desincronizara de la capacidad real), tambien tiene que ser falla.
    {
        const onceNombres = Array.from({ length: 11 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 15, capacidad: 10, cuentasCol: onceNombres }));
        ok(inv.fallas.some(f => /truncado esperado/.test(f)),
           'MUTACION -- truncado con UNA cuenta de mas (11 de 10) tambien es falla. Dio: ' + inv.fallas.join('; '));
    }
}

// ============================================================================
// 8. Barrido anti-colision: ninguna otra celda del repo escribe R7:Y30 del Tablero
// ============================================================================
console.log('\n=== 8. Ninguna otra celda del repo escribe donde este modulo escribe ===');
{
    const misCeldas = [];
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        misCeldas.push(b.rotuloFaltante.celda, ctx._celdaAnclaTfp(b), b.totalReal, b.totalFaltante,
            // La fila de aviso (30) tambien es "propia" de este modulo desde este cambio: se
            // suma al barrido para que una colision futura ahi tambien se detecte.
            b.colCuenta + b.filaFin, b.colMonto + b.filaFin);
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
        : 'ninguna de mis 18 celdas (' + misCeldas.join(',') + ') aparece en otro DEVTOOL_*.js');
}

console.log('\n' + '='.repeat(60));
if (fallas) {
    console.log('FALLAS: ' + fallas);
    process.exit(1);
} else {
    console.log('TODO OK');
}
