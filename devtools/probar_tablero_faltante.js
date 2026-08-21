/**
 * devtools/probar_tablero_faltante.js
 * Banco de pruebas de DEVTOOL_TableroFaltanteProyectado.js (layout de DOS SECCIONES, v0.40.0).
 *
 * Nueve mitades:
 *
 * 1. LA FORMULA ANCLA de cada bloque: la QUERY real de Franco se EMPOTRA VERBATIM (no se
 *    reconstruye), seccion 1 (real) y seccion 2 (faltante) apiladas -- nunca intercaladas --,
 *    capacidad correcta (20 filas de datos, derivada de TFP_FILA_FIN), selectores del TABLERO y
 *    jamas los de Inicio, mas el bloque de TRUNCADO y la senal de texto (TEXT/patron_monto) que
 *    separa las dos secciones para el gris.
 *
 * 1b. REUSO DEL BLOQUE COMUN: _bloqueComunTfp genera el calculo de real/proyectado/faltante UNA
 *    sola vez en JS y aparece BYTE A BYTE identico dentro de la formula ancla y dentro del total
 *    de faltantes -- si un dia se editara a mano una de las dos formulas de Sheets sin tocar la
 *    otra, quedarian desincronizadas; en este modulo eso es estructuralmente imposible porque
 *    las dos se generan desde la MISMA funcion.
 *
 * 2. IDEMPOTENCIA Y EXTRACCION: una formula YA aplicada se reconoce como tal
 *    (_anclaYaEsNuestraTfp) y NO se vuelve a envolver. _extraerTablaRealTfp recupera la QUERY
 *    real embebida desde una formula YA aplicada (necesario para que los totales de una segunda
 *    corrida puedan reconstruirse sin la QUERY cruda de Franco, que ya no vive suelta en la
 *    celda).
 *
 * 3. LOS TOTALES POR CONSTRUCCION: el total real es un SUM(INDEX(...)) directo sobre la QUERY de
 *    Franco (nunca relee el derrame, nunca usa SUMIF); el total faltante reusa el bloque comun.
 *    Incluye el diagnostico permanente del bug real que este layout reemplaza: un SUMIF/COUNTIF
 *    con criterio "<>"/"=" A SECAS no distingue una celda genuinamente vacia de una celda de
 *    DERRAME que muestra "" -- las trata a las dos como "con contenido". Con el layout viejo
 *    (intercalado, Cuenta vacia = fila de faltante) eso hacia que el total real sumara real +
 *    faltante y el total de faltantes diera cero: EXACTAMENTE el sintoma medido en la planilla
 *    real el 2026-08-21. La seccion 3c reproduce ese mecanismo con un evaluador SUMIF-like
 *    minimo, para que la leccion quede viva en el banco aunque el layout que la disparo ya no
 *    exista.
 *
 * 4. CAPACIDAD: 20 filas de datos (10 a 29, derivadas de TFP_FILA_FIN), peor caso 10 cuentas (si
 *    TODAS necesitaran sus dos filas).
 *
 * 5. EL GRIS DE LA SECCION DE FALTANTE (ISTEXT) Y POR QUE NO ES UN COUNTIF DE DUPLICADOS: con un
 *    simulador fiel del algoritmo (simularSeccionesTfp, JS puro, sin ejecutar Sheets), se arma un
 *    universo con una cuenta que SOLO vive en la seccion de faltante (sin ningun movimiento real
 *    este mes -- la razon de ser del modulo). Se verifica que la senal ISTEXT la marca gris
 *    igual que a cualquier otra fila de faltante, y que un COUNTIF de "aparece 2+ veces" -- la
 *    alternativa que se evaluo y se descarto -- NO la marcaria: match en cero (esa cuenta aparece
 *    una sola vez), quedaria con el tratamiento visual de "real" a pesar de ser 100% faltante.
 *
 * 6. FORMATO CONDICIONAL: la regla de aviso (absoluta, cursiva) y la clasificacion propia/ajena
 *    (gris + aviso, las mutaciones que en DEVTOOL_FormatoMedios dejaron una regla muda).
 *
 * 7. EL CICLO preflight/plan sobre una hoja simulada: recien migrado, truncado (preflight NO
 *    aborta), ya aplicado (con las SEIS reglas propias vivas), rechazo de datos ajenos.
 *
 * 8. _verificarInvariantesTfp POR MUTACION: total real que se mueve, faltante negativo, cuenta
 *    real perdida (piso sin truncar, numero exacto con truncado -- ahora contando NOMBRES
 *    DISTINTOS, porque un nombre puede repetirse en las dos secciones).
 *
 * 9. BARRIDO ANTI-COLISION: ninguna otra celda del repo escribe donde este modulo escribe.
 *
 * USO:  node devtools/probar_tablero_faltante.js
 * @version 0.40.0
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
    'TFP_FILA_FIN,TFP_PATRON_MONTO_DEFECTO});',
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
    if (/SUMIF/.test(f)) p.push('usa SUMIF: el criterio "<>"/"=" a secas es AMBIGUO en un derrame (ver seccion 3)');
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

// ============================================================================
// Simulador fiel del ALGORITMO (JS puro, no ejecuta la formula real de Sheets): mismo orden de
// pasos que _formulaCuentasTfp, para verificar el diseno con datos concretos sin depender de un
// motor de Sheets. `esTexto: true` en una fila representa lo que TEXT() produce en la formula
// real (un STRING, detectable con ISTEXT).
// ============================================================================
function simularSeccionesTfp(tablaReal, universoFaltante, capacidadFilas) {
    const cantRealBruto = tablaReal.length;
    const esPlaceholderVacio = cantRealBruto === 1 && tablaReal[0][0] === '';
    const cantReal = esPlaceholderVacio ? 0 : cantRealBruto;
    const tablaFaltante = universoFaltante.slice().sort((a, b) => b[1] - a[1]);
    const cantFaltante = tablaFaltante.length;
    const cantTotalBruto = cantReal + cantFaltante;
    const cantTotal = cantTotalBruto === 0 ? 1 : cantTotalBruto;
    let combinado;
    if (cantTotalBruto === 0) combinado = [['Sin movimientos ni proyeccion', 0]];
    else if (cantReal === 0) combinado = tablaFaltante;
    else combinado = tablaReal.concat(tablaFaltante);
    const cantMostradas = Math.min(cantTotal, capacidadFilas);
    const cantOcultas = cantTotal - cantMostradas;
    const hayOcultas = cantOcultas > 0;
    const tablaTopada = combinado.slice(0, cantMostradas);
    const sumaCol = arr => arr.reduce((s, r) => s + r[1], 0);
    const montoOculto = sumaCol(combinado) - sumaCol(tablaTopada);
    const avisoTexto = 'y ' + cantOcultas + ' cuenta' + (cantOcultas === 1 ? '' : 's') + ' mas';
    const filasTotal = cantMostradas + (hayOcultas ? 1 : 0);
    const cantRealMostradas = Math.min(cantReal, cantMostradas);
    const filas = [];
    for (let pos = 1; pos <= filasTotal; pos++) {
        if (pos > cantMostradas) { filas.push({ nombre: avisoTexto, monto: montoOculto, esTexto: false, esAviso: true }); continue; }
        const par = tablaTopada[pos - 1];
        const esTexto = pos > cantRealMostradas;
        filas.push({ nombre: par[0], monto: esTexto ? String(par[1]) : par[1], esTexto: esTexto, esAviso: false });
    }
    return { filas, cantReal, cantFaltante, cantTotal, cantMostradas, cantOcultas, montoOculto };
}

console.log('=== 0. Las tres publicas existen ===');
['estadoTableroFaltanteProyectado', 'aplicarTableroFaltanteProyectado', 'revertirTableroFaltanteProyectado']
    .forEach(n => ok(typeof ctx[n] === 'function', n + ' es una funcion'));

console.log('\n=== 1. Estructura de la formula ancla, por bloque ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const capacidad = ctx._capacidadFilasTfp(b);
        const fx = fixtureReal(b.categoria);
        const f = ctx._formulaCuentasTfp(b, fx.substring(1), '#,##0.00');   // sin el '=' inicial, como lo pasa el preflight
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
        ok(capacidad === 20, clave + ': la capacidad de filas derivada de TFP_FILA_FIN (30) da 20. Dio ' + capacidad);
        ok(f.indexOf('cant_mostradas; MIN(cant_total; ' + capacidad + ')') !== -1,
           clave + ': el tope usa la MISMA capacidad derivada (' + capacidad + '), nunca un numero suelto');
        ok(f.indexOf('MAX(0; val_proy - val_real)') !== -1,
           clave + ': el faltante nunca es negativo (MAX(0; proyectado - real))');
        ['Traspaso', 'Inicio Mes'].forEach(n => ok(f.indexOf('(cuenta_proy<>"' + n + '")') !== -1,
           clave + ': excluye la cuenta neutra "' + n + '" de lo proyectado'));

        // DOS SECCIONES, NUNCA INTERCALADAS: seccion 1 (tabla_real, verbatim y en su propio
        // orden) apilada CON VSTACK antes de la seccion 2 (tabla_faltante) -- no hay ningun
        // MOD/par-impar decidiendo la fila como en el intento intercalado que Franco descarto.
        ok(f.indexOf('VSTACK(tabla_real; tabla_faltante)') !== -1,
           clave + ': seccion 1 (real) va ANTES de la seccion 2 (faltante), apiladas, nunca intercaladas');
        ok(f.indexOf('MOD(pos') === -1, clave + ': no decide fila par/impar (eso era el layout intercalado descartado)');
        ok(f.indexOf('tabla_faltante; IFERROR(SORT(FILTER(HSTACK(universo; faltante_por_cuenta); faltante_por_cuenta > 0); 2; FALSE)') !== -1,
           clave + ': la seccion de faltante filtra SOLO faltante > 0 (una cuenta cubierta no gasta fila) y ordena de mayor a menor');

        // LA SENAL DEL GRIS: TEXT() en la seccion 2, numero crudo en la seccion 1 -- ver seccion 5.
        ok(f.indexOf('TEXT(INDEX(tabla_topada; pos; 2); patron_monto)') !== -1,
           clave + ': la seccion de faltante convierte el monto con TEXT() (la senal ISTEXT del gris)');
        ok(f.indexOf('patron_monto; "#,##0.00"') !== -1,
           clave + ': el patron de formato leido en vivo se embebe como literal');

        // EL PLACEHOLDER DE FRANCO (QUERY que fallo del todo, {"" \\ ""}) no cuenta como una
        // cuenta real con nombre vacio: cant_real lo detecta y lo trata como cero.
        ok(f.indexOf('cant_real; IF(AND(cant_real_bruto = 1; INDEX(tabla_real; 1; 1) = ""); 0; cant_real_bruto)') !== -1,
           clave + ': detecta el placeholder de QUERY-sin-resultados de Franco y no lo cuenta como cuenta real');

        // TRUNCADO A LA VISTA: nunca se aborta, se avisa en la propia hoja.
        ok(f.indexOf('cant_ocultas; cant_total - cant_mostradas') !== -1,
           clave + ': cuenta cuantas filas quedaron afuera (universo completo menos lo mostrado)');
        ok(f.indexOf('hay_ocultas; cant_ocultas > 0') !== -1, clave + ': sabe si hace falta avisar');
        ok(f.indexOf('monto_oculto; SUM(INDEX(combinado; 0; 2)) - SUM(INDEX(tabla_topada; 0; 2))') !== -1,
           clave + ': el monto oculto es el TOTAL menos lo YA MOSTRADO, sin refiltrar de nuevo');
        ok(f.indexOf('aviso_texto; "y " & cant_ocultas & " cuenta" & IF(cant_ocultas = 1; ""; "s") & " mas"') !== -1,
           clave + ': el texto del aviso singulariza/pluraliza "cuenta(s)" segun cant_ocultas');
        ok(f.indexOf('filas_total; cant_mostradas + IF(hay_ocultas; 1; 0)') !== -1,
           clave + ': el derrame crece UNA fila mas SOLO si hay ocultas');
        ok(f.indexOf('IF(pos > cant_mostradas; aviso_texto;') !== -1 && f.indexOf('IF(pos > cant_mostradas; monto_oculto;') !== -1,
           clave + ': la fila extra (si existe) es la UNICA con el texto/monto de aviso, nunca una fila de datos');

        // MUTACION: si el tope usara un numero DISTINTO al de _capacidadFilasTfp, esta formula
        // seguiria compilando pero se desincronizaria de un futuro resize de TFP_FILA_FIN. Se
        // prueba que subir TFP_FILA_FIN efectivamente CAMBIA el numero que usa el tope:
        const bloqueMasGrande = { filaDatos: b.filaDatos, filaFin: b.filaFin + 20 };
        const fMasGrande = ctx._formulaCuentasTfp(Object.assign({}, b, bloqueMasGrande), fx.substring(1), '#,##0.00');
        const capacidadMasGrande = ctx._capacidadFilasTfp(bloqueMasGrande);
        ok(capacidadMasGrande > capacidad && fMasGrande.indexOf('cant_mostradas; MIN(cant_total; ' + capacidadMasGrande + ')') !== -1,
           clave + ': MUTACION -- si el bloque creciera (filaFin+20), el tope sube CON el, no queda pegado al ' +
           capacidad + ' de hoy (capacidad recalculada: ' + capacidadMasGrande + ')');
    });
}

console.log('\n=== 1b. El bloque comun aparece BYTE A BYTE identico en la ancla y en el total de faltantes ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const fx = fixtureReal(b.categoria);
        const verbatim = fx.substring(1);
        const bloqueComun = ctx._bloqueComunTfp(b, verbatim);
        const ancla = ctx._formulaCuentasTfp(b, verbatim, '#,##0.00');
        const totalFaltante = ctx._formulaTotalFaltanteTfp(b, verbatim);
        ok(bloqueComun.length > 0 && ancla.indexOf(bloqueComun) !== -1,
           clave + ': el bloque comun aparece completo dentro de la formula ancla');
        ok(totalFaltante.indexOf(bloqueComun) !== -1,
           clave + ': el MISMO bloque comun (byte a byte) aparece dentro del total de faltantes -- ' +
           'las dos formulas de Sheets no pueden desincronizarse porque nacen de la misma funcion JS');
    });
}

console.log('\n=== 2. Idempotencia: una formula ya aplicada no se vuelve a envolver ===');
{
    const b = ctx.TFP_BLOQUES.ingresos;
    const fx = fixtureReal(b.categoria);
    ok(ctx._anclaYaEsNuestraTfp(fx.substring(1)) === false,
       'la QUERY original de Franco NO se reconoce como "ya nuestra"');

    const yaAplicada = ctx._formulaCuentasTfp(b, fx.substring(1), '#,##0.00');
    ok(ctx._anclaYaEsNuestraTfp(yaAplicada.substring(1)) === true,
       'la formula que este modulo escribe SI se reconoce como "ya nuestra"');

    const vecesUnaCapa = (yaAplicada.match(/tabla_real;/g) || []).length;
    const reenvuelta = ctx._formulaCuentasTfp(b, yaAplicada.substring(1), '#,##0.00');
    const vecesDosCapaS = (reenvuelta.match(/tabla_real;/g) || []).length;
    ok(vecesDosCapaS > vecesUnaCapa,
       'SIN el guard, envolver la formula ya aplicada la haria crecer (de ' + vecesUnaCapa +
       ' a ' + vecesDosCapaS + ' referencias a "tabla_real"): el anidamiento es real y creciente. ' +
       'Por eso el preflight verifica _anclaYaEsNuestraTfp ANTES de llamar a _formulaCuentasTfp.');
}

console.log('\n=== 2b. Extraccion de la QUERY real embebida (necesaria en una segunda corrida) ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const fx = fixtureReal(b.categoria);
        const verbatim = fx.substring(1);
        const aplicada = ctx._formulaCuentasTfp(b, verbatim, '#,##0.00').substring(1);   // sin '='
        const extraido = ctx._extraerTablaRealTfp(aplicada);
        ok(extraido === verbatim,
           clave + ': _extraerTablaRealTfp recupera EXACTAMENTE la QUERY original desde la formula ya ' +
           'aplicada (round-trip), pese a que esa QUERY tiene sus propios parentesis y comillas anidadas');
    });

    // MUTACION: si la formula ancla no tuviera "tabla_real;" (corrupta, o de otro modulo),
    // extraer tiene que fallar RUIDOSO, nunca devolver un string vacio o basura en silencio.
    let lanzo = false;
    try { ctx._extraerTablaRealTfp('=LET(otra_cosa; 1; otra_cosa)'); }
    catch (e) { lanzo = true; }
    ok(lanzo, 'MUTACION -- sin "tabla_real;" en la formula, la extraccion lanza en vez de devolver basura');
}

console.log('\n=== 3. Los totales POR CONSTRUCCION: nunca releen el derrame, nunca usan SUMIF ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const fx = fixtureReal(b.categoria);
        const verbatim = fx.substring(1);
        const real = ctx._formulaTotalRealTfp(verbatim);
        const falt = ctx._formulaTotalFaltanteTfp(b, verbatim);

        ok(real === '=SUM(INDEX(' + verbatim + '; 0; 2))',
           clave + ': total real exacto -- SUM directo de la columna 2 de la QUERY de Franco, ' +
           'nunca relee ningun rango del derrame');
        ok(falt.indexOf('=LET(\n') === 0 && falt.indexOf('SUM(faltante_por_cuenta)\n)') !== -1,
           clave + ': total faltante exacto -- LET con el bloque comun, suma faltante_por_cuenta ' +
           'sobre el UNIVERSO COMPLETO (no el truncado a la vista)');

        // LA MUTACION QUE IMPORTA: ninguno de los dos totales puede volver a usar SUMIF. Es
        // exactamente el mecanismo que causo el bug real medido en la planilla el 2026-08-21 (ver
        // el diagnostico permanente en la seccion 3c) -- si algun cambio futuro reintrodujera un
        // SUMIF con criterio "<>"/"=" a secas, revisar() (usada en la seccion 1 y aca abajo) lo
        // atrapa.
        ok(!/SUMIF/.test(real), clave + ': el total real NO usa SUMIF');
        ok(!/SUMIF/.test(falt), clave + ': el total faltante NO usa SUMIF');
        ok(!/^=SUM\(INDEX\(.*; 0; 1\)/.test(real), clave + ': el total real suma la columna de MONTO (2), no la de nombre (1)');
        revisar('total real ' + clave, real, { llavesEsperadas: (fx.match(/{/g) || []).length });
        revisar('total faltante ' + clave, falt, { llavesEsperadas: (fx.match(/{/g) || []).length });
    });
}

console.log('\n=== 3c. Diagnostico permanente: por que SUMIF("<>"/"=") es ambiguo en un derrame ===');
{
    // Evaluador MINIMO que reproduce el mecanismo REAL de Sheets para SUMIF/COUNTIF con el
    // criterio "<>"/"=" A SECAS (sin operando): esos criterios NO comparan el VALOR contra "" --
    // preguntan si la celda "tiene contenido" (formula o dato). Una celda de DERRAME que muestra
    // "" (el resultado de una formula, no un vacio real) tiene contenido: cuenta como "no vacia".
    // Es la diferencia con una comparacion de VALOR corriente (`=A1=""`), que SI compara el
    // string calculado y trata "" como igual a "".
    function sumifAmbiguoLike(filas, criterioNoVacio) {
        // filas: [{ esDerrame: bool, valor: string }] -- esDerrame=true simula "esta celda es
        // parte de un array-formula/derrame, aunque su VALOR sea ''".
        return filas.reduce((acc, f) => {
            const tieneContenido = f.esDerrame || f.valor !== '';
            const matchea = criterioNoVacio ? tieneContenido : !tieneContenido;
            return acc + (matchea ? f.monto : 0);
        }, 0);
    }
    function comparacionDeValorLike(filas, quiereVacio) {
        // Lo que SI hace una comparacion de valor real (`=A1=""` o, en este modulo, ISTEXT sobre
        // otro campo): mira el VALOR calculado, no si "hay formula detras".
        return filas.reduce((acc, f) => {
            const esVacioDeVerdad = f.valor === '';
            const matchea = quiereVacio ? esVacioDeVerdad : !esVacioDeVerdad;
            return acc + (matchea ? f.monto : 0);
        }, 0);
    }

    // Fixture que reproduce el sintoma real: filas de "real" con nombre (celdas normales, NO son
    // "" ni pertenecen a un derrame vacio) y filas de "faltante" cuyo Cuenta es el resultado ""
    // de una formula de derrame (esDerrame=true, valor='').
    const filas = [
        { esDerrame: false, valor: 'umoh', monto: 837728.28 },
        { esDerrame: true, valor: '', monto: 162271.72 },
        { esDerrame: false, valor: 'Tidetrack', monto: 260000 },
        { esDerrame: true, valor: '', monto: 40000 }
    ];
    const totalRealSumif = sumifAmbiguoLike(filas, true);     // el viejo SUMIF(rango;"<>";monto)
    const totalFaltSumif = sumifAmbiguoLike(filas, false);    // el viejo SUMIF(rango;"=";monto)
    const realEsperado = 837728.28 + 260000;
    const faltEsperado = 162271.72 + 40000;

    ok(Math.abs(totalRealSumif - (realEsperado + faltEsperado)) < 0.001,
       'REPRODUCCION del bug real: el SUMIF-like con criterio "<>" suma real + faltante mezclados ' +
       '(dio ' + totalRealSumif.toFixed(2) + ', se esperaba real puro ' + realEsperado.toFixed(2) +
       ') -- el sintoma medido en Ingresos el 2026-08-21 fue exactamente este: el total paso a ser ' +
       'la suma de las dos columnas');
    ok(totalFaltSumif === 0,
       'REPRODUCCION del bug real: el SUMIF-like con criterio "=" no encuentra NINGUNA fila ' +
       '"vacia de verdad" (todas pertenecen al derrame) y el total de faltantes da CERO -- la otra ' +
       'mitad del sintoma que confirma el diagnostico');

    const totalRealValor = comparacionDeValorLike(filas, false);
    const totalFaltValor = comparacionDeValorLike(filas, true);
    ok(Math.abs(totalRealValor - realEsperado) < 0.001,
       'la comparacion de VALOR (lo que este modulo usa: SUM(INDEX(verbatim;0;2)) para el real, y ' +
       'un calculo propio para el faltante) separa correctamente: real puro = ' + totalRealValor.toFixed(2));
    ok(Math.abs(totalFaltValor - faltEsperado) < 0.001,
       'idem para el faltante: ' + totalFaltValor.toFixed(2) + ' (nunca mezclado con el real)');
}

console.log('\n=== 4. Capacidad de filas, derivada de TFP_FILA_FIN (un solo numero, tres bloques) ===');
{
    ok(ctx.TFP_FILA_FIN === 30, 'TFP_FILA_FIN es 30 (Franco: "visible hasta la fila 30")');
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        ok(b.filaFin === ctx.TFP_FILA_FIN, clave + ': b.filaFin ES la constante compartida (no un 30 copiado a mano)');
        ok(ctx._capacidadFilasTfp(b) === 20, clave + ': 20 filas de datos (10 a 29), la fila 30 reservada al aviso');
        ok(ctx._capacidadPeorCasoTfp(b) === 10,
           clave + ': peor caso 10 cuentas (si TODAS necesitaran real + faltante, dos filas cada una)');
    });
    ok(ctx._capacidadFilasTfp({ filaDatos: 10, filaFin: 51 }) === 41,
       'la capacidad de filas se recalcula si el bloque creciera, no queda fija en 20');
}

console.log('\n=== 5. El gris de la seccion de faltante (ISTEXT) y por que NO es un COUNTIF de duplicados ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const f = ctx._formulaReglaGrisTfp(b);
        ok(f === '=ISTEXT($' + b.colMonto + b.filaDatos + ')',
           clave + ': formula exacta del gris. Dio: ' + f);
        ok(f.indexOf(',') === -1, clave + ': ni una coma (ISTEXT toma un solo argumento, no hay separador que errar)');
        ok(f.indexOf('$' + b.colCuenta + b.filaDatos) === -1,
           clave + ': la regla YA NO referencia la CELDA de Cuenta -- el nombre se repite en las dos ' +
           'secciones, dejo de servir como senal (motivo del cambio de diseno)');

        const item = ctx._reglasGrisTfp().find(r => r.clave === clave);
        ok(item.celda === b.colMonto + b.filaDatos + ':' + b.colMonto + (b.filaFin - 1),
           clave + ': el rango de la regla gris excluye la ultima fila (reservada al aviso). Dio: ' + item.celda);
    });

    // LA MUTACION QUE IMPORTA (la que Franco pidio verificar en serio): una cuenta proyectada SIN
    // ningun movimiento real aparece UNA SOLA VEZ, siempre en la seccion 2. Se arma ese universo
    // con el simulador fiel del algoritmo y se comparan las dos senales candidatas.
    const tablaReal = [['umoh', 837728.28], ['Tidetrack', 260000]];
    const universoFaltante = [
        ['umoh', 162271.72],          // aparece en las DOS secciones (COUNTIF la marcaria bien)
        ['Ingresos Extra', 45000]     // SOLO tiene faltante -- sin ningun real este mes
    ];
    const sim = simularSeccionesTfp(tablaReal, universoFaltante, 20);

    const filaSoloFaltante = sim.filas.find(x => x.nombre === 'Ingresos Extra');
    ok(!!filaSoloFaltante, 'la cuenta sin movimiento real aparece en el derrame (razon de ser del modulo)');
    ok(filaSoloFaltante.esTexto === true,
       'LA SEÑAL ELEGIDA (ISTEXT): la fila de una cuenta sin movimiento real SI se marca como texto ' +
       '(gris), aunque aparezca una sola vez en todo el bloque');

    // La alternativa evaluada y descartada: "esta fila es la 2da+ aparicion de este nombre"
    // (COUNTIF con rango expansivo, la primera propuesta de Franco). Se construye ese conteo
    // sobre el MISMO derrame simulado y se muestra que falla para "Ingresos Extra".
    const nombresDerrame = sim.filas.filter(x => !x.esAviso).map(x => x.nombre);
    function countifDuplicadoLike(nombre, hastaIndice) {
        return nombresDerrame.slice(0, hastaIndice + 1).filter(n => n === nombre).length;
    }
    const idxSoloFaltante = sim.filas.findIndex(x => x.nombre === 'Ingresos Extra');
    const countifSoloFaltante = countifDuplicadoLike('Ingresos Extra', idxSoloFaltante);
    ok(countifSoloFaltante === 1,
       'MUTACION -- CONFIRMADA la falla de la alternativa: un COUNTIF de "aparece 2+ veces" cuenta ' +
       'SOLO 1 aparicion para "Ingresos Extra" (nunca supera 1, nunca se marcaria gris), porque esa ' +
       'cuenta NO tiene una fila "real" previa de la cual ser la repeticion. Confirma por que se ' +
       'descarto esa alternativa y se eligio ISTEXT en su lugar.');

    const idxUmohFaltante = sim.filas.findIndex((x, i) => x.nombre === 'umoh' && i > sim.filas.findIndex(y => y.nombre === 'umoh'));
    const countifUmoh = countifDuplicadoLike('umoh', idxUmohFaltante);
    ok(countifUmoh === 2,
       'la alternativa SI funcionaba para "umoh" (aparece en las dos secciones, count=2): el gap era ' +
       'especifico de las cuentas sin ningun movimiento real, no un fallo general del COUNTIF');

    // Sanidad del simulador: la seccion 1 nunca lleva texto, el total y el orden son los esperados.
    ok(sim.filas[0].esTexto === false && sim.filas[0].nombre === 'umoh',
       'la seccion 1 (real) encabeza el derrame con el numero crudo (no texto)');
    ok(sim.cantReal === 2 && sim.cantFaltante === 2, 'el simulador cuenta 2 reales y 2 con faltante > 0');
}

console.log('\n=== 6. El aviso de truncado: formula absoluta, rango de UNA fila, cursiva ===');
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

        const gris = ctx._reglasGrisTfp().find(r => r.clave === clave);
        ok(gris.celda.indexOf(String(b.filaFin)) === -1,
           clave + ': el rango gris no menciona la fila del aviso (' + b.filaFin + ')');
    });

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

console.log('\n=== 6b. Clasificacion propia/ajena: gris + aviso, y las mutaciones que dejaron reglas mudas ===');
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

    const formulaAviso = ctx._formulaReglaAvisoTfp(b);
    const rangoAviso = b.colCuenta + b.filaFin + ':' + b.colMonto + b.filaFin;
    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaAviso, rangoAviso)) === true,
       'MUTACION -- formula de AVISO correcta + su rango -> tambien propia (no solo el gris)');

    const otroRango = ctx.TFP_BLOQUES.fijos.colMonto + b.filaDatos + ':' + ctx.TFP_BLOQUES.fijos.colMonto + (b.filaFin - 1);
    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaPropia, otroRango)) === false,
       'MUTACION rango equivocado: la MISMA formula en OTRO rango es AJENA (no se toca)');

    const formulaDeOtroBloque = ctx._formulaReglaGrisTfp(ctx.TFP_BLOQUES.variables);
    ok(ctx._esReglaPropiaTfp(reglaFalsa(formulaDeOtroBloque, rangoPropio)) === false,
       'MUTACION formula equivocada: el rango correcto con la formula de OTRO bloque es AJENA');

    const ajena = reglaFalsa('=$N$4="ARS"', 'A1:A1');
    const clases = ctx._clasificarReglasTfp([reglaFalsa(formulaPropia, rangoPropio), ajena]);
    ok(clases.propias.length === 1 && clases.ajenas.length === 1 && clases.ajenas[0] === ajena,
       'de dos reglas (una propia, una ajena), se separan 1 y 1, y la ajena es la MISMA referencia');

    ok(ctx._reglasPropiasTfp().length === 6, '_reglasPropiasTfp junta 3 gris + 3 aviso = 6');
}

// ============================================================================
// 7. PREFLIGHT / PLAN sobre una hoja simulada
// ============================================================================
function celda(valor, formula, numberFormat) {
    return {
        _valor: valor === undefined ? '' : valor,
        _formula: formula || '',
        _numberFormat: numberFormat || '#,##0.00',
        getValue() { return this._valor; },
        getFormula() { return this._formula; },
        getDisplayValue() { return String(this._valor); },
        getNumberFormat() { return this._numberFormat; }
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

        if (opts.yaAplicado) {
            const fx = fixtureReal(b.categoria);
            celdas[b.colCuenta + b.filaDatos] = celda('umoh', ctx._formulaCuentasTfp(b, fx.substring(1), '#,##0.00'));
        } else {
            celdas[b.colCuenta + b.filaDatos] = celda('umoh', fixtureReal(b.categoria));
        }

        if (opts.yaAplicado) {
            const fx = fixtureReal(b.categoria);
            celdas[b.totalReal] = celda(1000, ctx._formulaTotalRealTfp(fx.substring(1)));
        } else {
            celdas[b.totalReal] = celda(1000, '=SUM(' + b.colMonto + b.filaDatos + ':' + b.colMonto + b.filaFin + ')');
        }
        if (opts.totalFaltanteConDato) {
            celdas[b.totalFaltante] = celda(500, '');
        } else if (opts.yaAplicado) {
            const fx = fixtureReal(b.categoria);
            celdas[b.totalFaltante] = celda(200, ctx._formulaTotalFaltanteTfp(b, fx.substring(1)));
        } else {
            celdas[b.totalFaltante] = celda('', '');
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

console.log('\n=== 7a. Recien migrado: Franco escribio el rotulo, nada mas esta aplicado ===');
{
    const hoja = hojaTableroSimulada({ cuentasPorBloque: { ingresos: 4, fijos: 5, variables: 10 } });
    const ss = ssSimulada(hoja);
    const pre = ctx._preflightTfp(ss);
    ctx.TFP_ORDEN.forEach(clave => {
        const info = pre.bloques[clave];
        ok(info.anclaYaAplicada === false, clave + ': la ancla todavia es la de Franco');
        ok(info.totalRealYaEsNueva === false, clave + ': el total real todavia es el SUM viejo');
        ok(info.faltanteEsNuestra === false, clave + ': el total de faltantes esta vacio, no aplicado');
        ok(info.rotuloYaEsta === true, clave + ': el rotulo "Faltante proyectado" ya estaba (Franco lo escribio)');
        ok(info.patronMonto === '#,##0.00', clave + ': se leyo el patron de numero vigente de la celda de Monto');
    });
    ok(pre.bloques.variables.cuentasVivas === 10, 'variables: 10 cuentas reales vivas');

    const plan = ctx._planTfp(pre);
    ok(plan.cambios.length === 9, 'el plan propone 9 celdas (3 anclas + 3 reales + 3 faltantes). Dio ' + plan.cambios.length);
    const celdasEsperadas = ['R10', 'S7', 'S8', 'U10', 'V7', 'V8', 'X10', 'Y7', 'Y8'];
    const celdasPlan = plan.cambios.map(c => c.celda).sort();
    ok(JSON.stringify(celdasPlan) === JSON.stringify(celdasEsperadas.sort()),
       'exactamente esas 9 celdas. Dio: ' + celdasPlan.join(','));
    ok(plan.cambios.every(c => !!c.formulaNueva || c.tipo === 'rotulo'),
       'toda celda que no es rotulo trae su formulaNueva');
    ok(ctx._reglasHacenFaltaTfp(plan.reglas) === true, 'las reglas de gris tambien hacen falta (hoja sin ninguna)');
}

console.log('\n=== 7b. Rotulo faltante: el plan lo agrega ===');
{
    const hoja = hojaTableroSimulada({ rotuloFaltante: false });
    const pre = ctx._preflightTfp(ssSimulada(hoja));
    const plan = ctx._planTfp(pre);
    const rotulos = plan.cambios.filter(c => c.tipo === 'rotulo').map(c => c.celda).sort();
    ok(JSON.stringify(rotulos) === JSON.stringify(['R8', 'U8', 'X8']),
       'los tres rotulos se proponen cuando faltan. Dio: ' + rotulos.join(','));
}

console.log('\n=== 7c. En el borde de la capacidad de filas: preflight NO aborta ===');
{
    // El rango que _preflightTfp lee para cuentasVivas es el MISMO _rangoColTfp (10 a 29, 20
    // celdas) que ahora define la capacidad -- asi que este mock en particular no puede
    // representar "mas cuentas reales que capacidadFilas" (Franco mismo tendria que tener su
    // propio derrame ya desbordando la fila 30 antes de que este modulo toque nada, un escenario
    // que _verificarInvariantesTfp SI prueba directo con numeros construidos en la seccion 8c).
    // Lo que esta seccion verifica es que llenar el rango ENTERO (el borde, 20 de 20) sigue sin
    // disparar ningun abort -- la version vieja abortaba mucho antes de llegar a este punto.
    const hoja = hojaTableroSimulada({ cuentasPorBloque: { ingresos: 4, fijos: 5, variables: 20 } });
    let lanzo = false, msg = '';
    let pre;
    try { pre = ctx._preflightTfp(ssSimulada(hoja)); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo === false, 'con el rango de Cuenta lleno (20 de 20) el preflight NO aborta. ' + (lanzo ? 'Lanzo: ' + msg : ''));
    ok(pre.bloques.variables.cuentasVivas === 20, 'cuentasVivas mide el borde exacto (20)');
    ok(pre.bloques.variables.capacidadFilas === 20, 'capacidadFilas se sigue midiendo igual (20)');

    const plan = ctx._planTfp(pre);
    ok(plan.cambios.some(c => c.celda === 'X10' && c.tipo === 'ancla'),
       'el plan propone reescribir la ancla de Variables igual en el borde de la capacidad');
}

console.log('\n=== 7d. Ya aplicado en los tres bloques: nada que hacer (con las SEIS reglas propias) ===');
{
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

    const hojaSoloGris = hojaTableroSimulada({
        yaAplicado: true,
        reglasVivas: ctx._reglasGrisTfp().map(reglaViva)
    });
    const preSoloGris = ctx._preflightTfp(ssSimulada(hojaSoloGris));
    const planSoloGris = ctx._planTfp(preSoloGris);
    ok(ctx._reglasHacenFaltaTfp(planSoloGris.reglas) === true,
       'MUTACION -- con solo 3 reglas vivas (sin las de aviso) SI hace falta escribir');
}

console.log('\n=== 7e. Dato ajeno en el total de faltantes: NO se pisa ===');
{
    const hoja = hojaTableroSimulada({ totalFaltanteConDato: true });
    let lanzo = false, msg = '';
    try { ctx._preflightTfp(ssSimulada(hoja)); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo, 'con S8 conteniendo un valor ajeno, el preflight aborta');
    ok(msg.indexOf('dato de Franco') !== -1, 'el mensaje explica que podria ser un dato de Franco');
}

console.log('\n=== 7f. Sin la hoja Proyeccion: aborta con mensaje accionable ===');
{
    const hoja = hojaTableroSimulada();
    let lanzo = false, msg = '';
    try { ctx._preflightTfp(ssSimulada(hoja, { sinProyeccion: true })); }
    catch (e) { lanzo = true; msg = e.message; }
    ok(lanzo, 'sin "Proyeccion" el preflight aborta');
    ok(msg.indexOf('BD de Proyeccion') !== -1, 'dice que hay que correr BD de Proyeccion primero');
}

// ============================================================================
// 8. Verificacion de invariantes
// ============================================================================
console.log('\n=== 8. _verificarInvariantesTfp: total real, faltante no-negativo, y nombres distintos ===');
{
    function preFalso(overrides) {
        const sano = {
            totalReal: 1000, totalFaltante: 200, cuentasCol: ['umoh', 'Tidetrack', 'umoh', 'Tidetrack'],
            cuentasVivas: 2, capacidadFilas: 20
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
                cuentasVivas: st.cuentasVivas, capacidadFilas: st.capacidadFilas
            };
        });
        return { hoja: hoja, bloques: bloques };
    }
    // Caso sano: nada cambio.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({}));
        ok(inv.fallas.length === 0, 'caso sano: cero fallas. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION: el total real se movio.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalReal: 1500 }));
        ok(inv.fallas.some(f => /total real paso de/.test(f)),
           'MUTACION total real movido: la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION: el faltante dio negativo.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalFaltante: -50 }));
        ok(inv.fallas.some(f => /faltantes dio negativo/.test(f)),
           'MUTACION faltante negativo: la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // MUTACION: se perdio una cuenta real (antes 2 nombres distintos, ahora 1) -- SIN truncar.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasCol: ['umoh', 'umoh'] }));
        ok(inv.fallas.some(f => /no puede perderse/.test(f)),
           'MUTACION cuenta real perdida (sin truncar): la falla lo detecta. Dio: ' + inv.fallas.join('; '));
    }
    // Pendiente ("Cargando...") no es una falla.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({ totalReal: 'Cargando...' }));
        ok(inv.fallas.length === 0 && inv.avisos.some(a => /calculando/.test(a)),
           '"Cargando..." persistente es AVISO, no falla');
    }

    console.log('\n--- 8b. Sin truncar: PISO sobre nombres DISTINTOS, no igualdad exacta ---');
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({
            cuentasVivas: 2, capacidadFilas: 20, cuentasCol: ['umoh', 'Tidetrack', 'umoh', 'CatalogoSinReal']
        }));
        ok(inv.fallas.length === 0,
           '3 nombres distintos viven (2 reales + 1 catalogo-sin-real) y no es falla. Dio: ' + inv.fallas.join('; '));
    }
    {
        const ochoNombres = Array.from({ length: 8 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 9, capacidadFilas: 20, cuentasCol: ochoNombres }));
        ok(inv.fallas.some(f => /no puede perderse/.test(f)),
           'MUTACION -- 8 nombres distintos contra 9 cuentas reales esperadas: la falla lo detecta');
    }

    console.log('\n--- 8c. Con truncado: piso sobre la capacidad completa ---');
    {
        const veinteNombres = Array.from({ length: 20 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 25, capacidadFilas: 20, cuentasCol: veinteNombres }));
        ok(inv.fallas.length === 0,
           'truncado correcto: 25 reales para 20 filas, quedaron 20 nombres distintos -> sano. Dio: ' + inv.fallas.join('; '));
    }
    {
        const diecinueveNombres = Array.from({ length: 19 }, (_, i) => 'Cuenta' + i);
        const inv = ctx._verificarInvariantesTfp(preFalso({ cuentasVivas: 25, capacidadFilas: 20, cuentasCol: diecinueveNombres }));
        ok(inv.fallas.some(f => /truncado esperado/.test(f)),
           'MUTACION -- truncado con UN nombre distinto de menos (19 de 20) SI es falla. Dio: ' + inv.fallas.join('; '));
    }
}

// ============================================================================
// 9. Barrido anti-colision: ninguna otra celda del repo escribe R7:Y30 del Tablero
// ============================================================================
console.log('\n=== 9. Ninguna otra celda del repo escribe donde este modulo escribe ===');
{
    const misCeldas = [];
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        misCeldas.push(b.rotuloFaltante.celda, ctx._celdaAnclaTfp(b), b.totalReal, b.totalFaltante,
            b.colCuenta + b.filaFin, b.colMonto + b.filaFin);
    });
    // CONVIVENCIAS YA DECIDIDAS -- decision Franco 2026-08-21 (duenio unico de R10/U10/X10).
    // TFP es el duenio: es el que REESCRIBE esas celdas, empotrando la QUERY original de Franco.
    // DEVTOOL_StockYFlujo.js se queda nombrandolas a proposito: `_apagarArrastreSyf` hace CIRUGIA
    // DE TOKEN -- reemplaza un patron y devuelve el resto de la formula intacta --, asi que respeta
    // el envoltorio de TFP corra en el orden que corra. Es compatible por construccion, no por
    // casualidad, y por eso no cuenta como choque.
    // DEVTOOL_FormulerioV0111.js SI se retiro de esas tres (aquel `_repararFormula` reescribia por
    // patron y podia pisar el envoltorio si el patron viejo reaparecia).
    // Esta lista es un permiso EXPLICITO, no un silenciador: cualquier modulo que no este aca sigue
    // saliendo como choque, y agregar uno obliga a escribir por que es compatible.
    const CONVIVENCIA_OK = {
        'DEVTOOL_StockYFlujo.js': ['R10', 'U10', 'X10']
    };
    const dir = path.join(RAIZ, 'src');
    const choques = [];
    const convive = [];
    fs.readdirSync(dir).filter(f => f.indexOf('DEVTOOL_') === 0 && f !== 'DEVTOOL_TableroFaltanteProyectado.js')
        .forEach(f => {
            const src = fs.readFileSync(path.join(dir, f), 'utf8');
            misCeldas.forEach(c => {
                if (src.indexOf("'" + c + "'") !== -1 || src.indexOf('"' + c + '"') !== -1) {
                    if ((CONVIVENCIA_OK[f] || []).indexOf(c) !== -1) { convive.push(c + ' <- ' + f); }
                    else { choques.push(c + ' <- ' + f); }
                }
            });
        });
    if (convive.length) {
        console.log('  (convivencia decidida el 2026-08-21, no es choque: ' + convive.join('; ') + ')');
    }
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
