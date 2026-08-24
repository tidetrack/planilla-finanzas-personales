/**
 * devtools/probar_tablero_faltante.js
 * Banco de pruebas de DEVTOOL_TableroFaltanteProyectado.js (layout de DOS SECCIONES con FILA
 * SEPARADORA explicita y montos NUMERICOS, v0.41.0).
 *
 * Once mitades:
 *
 * 1. LA FORMULA ANCLA de cada bloque: la QUERY real de Franco se EMPOTRA VERBATIM (no se
 *    reconstruye), seccion 1 (real) y seccion 2 (faltante) apiladas -- nunca intercaladas --,
 *    con una FILA SEPARADORA rotulada entre las dos, capacidad_datos que se reduce en 1 cuando
 *    hace falta separador, capacidad correcta (20 filas de datos, derivada de TFP_FILA_FIN),
 *    selectores del TABLERO y jamas los de Inicio, mas el bloque de TRUNCADO. Los montos son
 *    NUMEROS crudos: NINGUN TEXT() en la formula.
 *
 * 1b. REUSO DEL BLOQUE COMUN: _bloqueComunTfp genera el calculo de real/proyectado/faltante UNA
 *    sola vez en JS y aparece BYTE A BYTE identico dentro de la formula ancla y dentro del total
 *    de faltantes -- si un dia se editara a mano una de las dos formulas de Sheets sin tocar la
 *    otra, quedarian desincronizadas; en este modulo eso es estructuralmente imposible porque
 *    las dos se generan desde la MISMA funcion.
 *
 * 2. IDEMPOTENCIA Y EXTRACCION: una formula YA aplicada (por CUALQUIER version, v0.40.0 o
 *    v0.41.0) se reconoce como "envuelta por este modulo" (_anclaYaEsNuestraTfp) y NO se vuelve
 *    a envolver dos veces. _extraerTablaRealTfp recupera la QUERY real embebida desde una
 *    formula YA aplicada (necesario para que los totales y el reescrito de una segunda corrida
 *    puedan reconstruirse sin la QUERY cruda de Franco, que ya no vive suelta en la celda).
 *
 * 2c. UPGRADE VERSION-PROOF: una ancla que YA tiene aplicada la v0.40.0 (TEXT()/ISTEXT, sin
 *    separador -- el caso concreto de la planilla real de Franco hoy) se reconoce como envuelta
 *    por este modulo, se le EXTRAE la QUERY real correcta, y el preflight la marca como NO
 *    vigente (anclaVigente = false): hace falta reescribirla a la forma v0.41.0. Sin este
 *    chequeo, desplegar v0.41.0 sobre una planilla con v0.40.0 ya aplicada nunca actualizaria la
 *    ancla (el modulo la confundiria con "ya aplicada, nada que hacer").
 *
 * 3. LOS TOTALES POR CONSTRUCCION: el total real es un SUM(INDEX(...)) directo sobre la QUERY de
 *    Franco (nunca relee el derrame, nunca usa SUMIF); el total faltante reusa el bloque comun.
 *    Incluye el diagnostico permanente del bug real que el layout de dos secciones reemplazo: un
 *    SUMIF/COUNTIF con criterio "<>"/"=" A SECAS no distingue una celda genuinamente vacia de una
 *    celda de DERRAME que muestra "" -- las trata a las dos como "con contenido". La seccion 3c
 *    reproduce ese mecanismo con un evaluador SUMIF-like minimo, para que la leccion quede viva
 *    en el banco aunque el layout que la disparo ya no exista.
 *
 * 4. CAPACIDAD: 20 filas de datos (10 a 29, derivadas de TFP_FILA_FIN). Peor caso BAJA de 10 a
 *    9 cuentas en v0.41.0 (la fila separadora se cobra una de las veinte cuando hay faltante).
 *
 * 5. EL GRIS DE LA SECCION DE FALTANTE (COUNTIF POSICIONAL) Y POR QUE NO ES ISTEXT NI UN COUNTIF
 *    DE DUPLICADOS: con un simulador fiel del algoritmo (simularSeccionesConSeparadorTfp mas un
 *    simulador de la propia regla COUNTIF expansiva), se arma un universo con una cuenta que
 *    SOLO vive en la seccion de faltante (sin ningun movimiento real este mes -- la razon de ser
 *    del modulo). Se verifica que la senal posicional la marca gris igual que a cualquier otra
 *    fila de faltante, que la fila separadora NUNCA se marca a si misma, y que los montos son
 *    NUMEROS (no texto) en las dos secciones -- la seleccion suma.
 *
 * 6. FORMATO CONDICIONAL: la regla de aviso (absoluta, cursiva) y la clasificacion propia/ajena
 *    (gris + aviso, las mutaciones que en DEVTOOL_FormatoMedios dejaron una regla muda).
 *
 * 7. EL CICLO preflight/plan sobre una hoja simulada: recien migrado, truncado (preflight NO
 *    aborta), ya aplicado (con las SEIS reglas propias vivas), rechazo de datos ajenos.
 *
 * 8. _verificarInvariantesTfp POR MUTACION: total real que se mueve, faltante negativo, cuenta
 *    real perdida (piso sin truncar, numero exacto con truncado -- contando NOMBRES DISTINTOS,
 *    EXCLUYENDO el rotulo de la fila separadora, que no es una cuenta).
 *
 * 9. BARRIDO ANTI-COLISION: ninguna otra celda del repo escribe donde este modulo escribe.
 *
 * 10. FORMATO DE NUMERO DE LOS TOTALES DE FALTANTE (decision #12): S8/V8/Y8 heredan, copiado en
 *    vivo, el formato de numero de su hermano real S7/V7/Y7 -- nunca un patron inventado. El
 *    plan lo propone cuando el formato vivo de S8 no coincide con el de S7 (aunque la FORMULA ya
 *    sea la correcta), y la escritura/revert respaldan y restauran el formato previo.
 *
 * USO:  node devtools/probar_tablero_faltante.js
 * @version 0.41.0
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
    'TFP_FILA_FIN,TFP_PATRON_MONTO_DEFECTO,TFP_ROTULO_SEPARADOR});',
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
    if (/TEXT\(/.test(f)) p.push('usa TEXT(): los montos de v0.41.0 son NUMEROS crudos, ver decision #7');
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

/**
 * Reconstruye a mano la formula que la v0.40.0 escribia (TEXT()/ISTEXT, sin separador): NO
 * llama a codigo de produccion (ese codigo ya no existe), la reproduce como fixture para poder
 * probar la seccion 2c (upgrade version-proof) contra un caso real: la planilla de Franco tiene
 * HOY una ancla con esta forma.
 */
function fixtureAnclaV0400Aplicada(b, verbatim) {
    const capacidad = ctx._capacidadFilasTfp(b);
    return '=LET(\n' + ctx._bloqueComunTfp(b, verbatim) +
        '  cant_real_bruto; ROWS(tabla_real);\n' +
        '  cant_real; IF(AND(cant_real_bruto = 1; INDEX(tabla_real; 1; 1) = ""); 0; cant_real_bruto);\n' +
        '  tabla_faltante; IFERROR(SORT(FILTER(HSTACK(universo; faltante_por_cuenta); faltante_por_cuenta > 0); 2; FALSE); HSTACK(""; 0));\n' +
        '  cant_faltante; SUMPRODUCT(N(faltante_por_cuenta > 0));\n' +
        '  cant_total_bruto; cant_real + cant_faltante;\n' +
        '  cant_total; IF(cant_total_bruto = 0; 1; cant_total_bruto);\n' +
        '  combinado; IF(cant_total_bruto = 0; HSTACK("Sin movimientos ni proyeccion"; 0);\n' +
        '    IF(cant_real = 0; tabla_faltante; VSTACK(tabla_real; tabla_faltante)));\n' +
        '  cant_mostradas; MIN(cant_total; ' + capacidad + ');\n' +
        '  cant_ocultas; cant_total - cant_mostradas;\n' +
        '  hay_ocultas; cant_ocultas > 0;\n' +
        '  tabla_topada; ARRAY_CONSTRAIN(combinado; cant_mostradas; 2);\n' +
        '  monto_oculto; SUM(INDEX(combinado; 0; 2)) - SUM(INDEX(tabla_topada; 0; 2));\n' +
        '  aviso_texto; "y " & cant_ocultas & " cuenta" & IF(cant_ocultas = 1; ""; "s") & " mas";\n' +
        '  filas_total; cant_mostradas + IF(hay_ocultas; 1; 0);\n' +
        '  idx_fila; SEQUENCE(filas_total);\n' +
        '  cant_real_mostradas; MIN(cant_real; cant_mostradas);\n' +
        '  patron_monto; "#,##0.00";\n' +
        '  nombre_out; MAP(idx_fila; LAMBDA(pos; IF(pos > cant_mostradas; aviso_texto; INDEX(tabla_topada; pos; 1))));\n' +
        '  monto_out; MAP(idx_fila; LAMBDA(pos; IF(pos > cant_mostradas; monto_oculto;\n' +
        '    IF(pos > cant_real_mostradas; TEXT(INDEX(tabla_topada; pos; 2); patron_monto); INDEX(tabla_topada; pos; 2)))));\n' +
        '  HSTACK(nombre_out; monto_out)\n)';
}

// ============================================================================
// Simulador fiel del ALGORITMO v0.41.0 (JS puro, no ejecuta la formula real de Sheets): mismo
// orden de pasos que _formulaCuentasTfp, incluida la fila separadora.
// ============================================================================
function simularSeccionesConSeparadorTfp(tablaReal, universoFaltante, capacidadFilas, rotulo) {
    const cantRealBruto = tablaReal.length;
    const esPlaceholderVacio = cantRealBruto === 1 && tablaReal[0][0] === '';
    const cantReal = esPlaceholderVacio ? 0 : cantRealBruto;
    const tablaFaltante = universoFaltante.slice().sort((a, b) => b[1] - a[1]);
    const cantFaltanteUniverso = tablaFaltante.length;
    const cantTotalBruto = cantReal + cantFaltanteUniverso;
    const cantTotal = cantTotalBruto === 0 ? 1 : cantTotalBruto;
    let combinado;
    if (cantTotalBruto === 0) combinado = [['Sin movimientos ni proyeccion', 0]];
    else if (cantReal === 0) combinado = tablaFaltante;
    else combinado = tablaReal.concat(tablaFaltante);
    const capacidadDatos = cantFaltanteUniverso > 0 ? capacidadFilas - 1 : capacidadFilas;
    const cantMostradas = Math.min(cantTotal, capacidadDatos);
    const cantOcultas = cantTotal - cantMostradas;
    const hayOcultas = cantOcultas > 0;
    const tablaTopada = combinado.slice(0, cantMostradas);
    const sumaCol = arr => arr.reduce((s, r) => s + r[1], 0);
    const montoOculto = sumaCol(combinado) - sumaCol(tablaTopada);
    const avisoTexto = 'y ' + cantOcultas + ' cuenta' + (cantOcultas === 1 ? '' : 's') + ' mas';
    const cantRealMostradas = Math.min(cantReal, cantMostradas);
    const cantFaltanteMostradas = Math.min(cantFaltanteUniverso, cantMostradas - cantRealMostradas);
    const haySeparador = cantFaltanteMostradas > 0;
    const offsetSeparador = haySeparador ? 1 : 0;
    const filaSeparador = cantRealMostradas + 1;
    const filasTotal = cantMostradas + offsetSeparador + (hayOcultas ? 1 : 0);

    const filas = [];
    for (let pos = 1; pos <= filasTotal; pos++) {
        if (pos > cantMostradas + offsetSeparador) {
            filas.push({ nombre: avisoTexto, monto: montoOculto, esSeparador: false, esAviso: true });
            continue;
        }
        if (haySeparador && pos === filaSeparador) {
            filas.push({ nombre: rotulo, monto: '', esSeparador: true, esAviso: false });
            continue;
        }
        const idx = pos <= cantRealMostradas ? pos : pos - offsetSeparador;
        const par = tablaTopada[idx - 1];
        filas.push({ nombre: par[0], monto: par[1], esSeparador: false, esAviso: false });
    }
    return {
        filas, cantReal, cantFaltanteUniverso, cantFaltanteMostradas, haySeparador,
        cantTotal, cantMostradas, cantOcultas, montoOculto
    };
}

/**
 * Simula la propia REGLA de formato condicional (COUNTIF de rango expansivo, anclado una fila
 * arriba, estrictamente ARRIBA de cada fila evaluada -- ver _formulaReglaGrisTfp): para cada fila
 * de DATOS (no el aviso, que vive fuera del rango de esta regla), pregunta si el rotulo aparecio
 * en alguna fila ANTERIOR dentro del mismo derrame.
 */
function marcarGrisPorReglaTfp(filas, rotulo) {
    const soloDatos = filas.filter(f => !f.esAviso);
    return soloDatos.map((f, i) => {
        const vistosArriba = soloDatos.slice(0, i).map(x => x.nombre);
        return vistosArriba.indexOf(rotulo) !== -1;
    });
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
        ok(capacidad === 20, clave + ': la capacidad de filas derivada de TFP_FILA_FIN (30) da 20. Dio ' + capacidad);
        ok(f.indexOf('capacidad_datos; IF(cant_faltante > 0; ' + (capacidad - 1) + '; ' + capacidad + ')') !== -1,
           clave + ': la capacidad de datos se reduce en 1 (' + (capacidad - 1) + ') cuando hay faltante, y usa ' +
           'la capacidad entera (' + capacidad + ') cuando no -- nunca un numero suelto sin relacion a la capacidad');
        ok(f.indexOf('MAX(0; val_proy - val_real)') !== -1,
           clave + ': el faltante nunca es negativo (MAX(0; proyectado - real))');
        ['Traspaso', 'Inicio Mes'].forEach(n => ok(f.indexOf('(cuenta_proy<>"' + n + '")') !== -1,
           clave + ': excluye la cuenta neutra "' + n + '" de lo proyectado'));

        // DOS SECCIONES, NUNCA INTERCALADAS, CON FILA SEPARADORA.
        ok(f.indexOf('VSTACK(tabla_real; tabla_faltante)') !== -1,
           clave + ': seccion 1 (real) va ANTES de la seccion 2 (faltante), apiladas, nunca intercaladas');
        ok(f.indexOf('MOD(pos') === -1, clave + ': no decide fila par/impar (eso era el layout intercalado descartado)');
        ok(f.indexOf('tabla_faltante; IFERROR(SORT(FILTER(HSTACK(universo; faltante_por_cuenta); faltante_por_cuenta > 0); 2; FALSE)') !== -1,
           clave + ': la seccion de faltante filtra SOLO faltante > 0 (una cuenta cubierta no gasta fila) y ordena de mayor a menor');
        ok(f.indexOf('rotulo_separador; "' + ctx.TFP_ROTULO_SEPARADOR + '"') !== -1,
           clave + ': el rotulo de la fila separadora es el literal TFP_ROTULO_SEPARADOR');
        ok(f.indexOf('fila_separador; cant_real_mostradas + 1') !== -1,
           clave + ': la fila separadora se ubica justo despues de la ultima fila real mostrada');
        ok(f.indexOf('hay_separador; cant_faltante_mostradas > 0') !== -1,
           clave + ': el separador solo aparece si hay al menos una fila de faltante mostrada');
        ok(f.indexOf('cant_faltante_mostradas; MIN(cant_faltante; cant_mostradas - cant_real_mostradas)') !== -1,
           clave + ': cant_faltante_mostradas esta acotado por el universo real, no solo por la resta ' +
           '(sin esto, el placeholder "Sin movimientos" dispararia un separador fantasma)');

        // LOS MONTOS SON NUMEROS: NINGUN TEXT() en la formula (decision #7, v0.41.0).
        ok(f.indexOf('TEXT(') === -1, clave + ': NINGUN TEXT() -- los montos son numeros crudos, suman al seleccionarlos');
        ok(f.indexOf('patron_monto') === -1, clave + ': ya no existe patron_monto (era solo para el TEXT() de v0.40.0)');
        ok(f.indexOf('INDEX(tabla_topada; pos - offset_separador; 2)') !== -1,
           clave + ': el monto de la seccion de faltante sale directo de tabla_topada, sin envolver');

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
        ok(f.indexOf('filas_total; cant_mostradas + offset_separador + IF(hay_ocultas; 1; 0)') !== -1,
           clave + ': el derrame crece con el separador (si hay) y UNA fila mas SOLO si hay ocultas');
        ok(f.indexOf('IF(pos > cant_mostradas + offset_separador; aviso_texto;') !== -1 &&
           f.indexOf('IF(pos > cant_mostradas + offset_separador; monto_oculto;') !== -1,
           clave + ': la fila extra (si existe) es la UNICA con el texto/monto de aviso, nunca una fila de datos');

        // MUTACION: si el tope usara un numero DISTINTO al de _capacidadFilasTfp, esta formula
        // seguiria compilando pero se desincronizaria de un futuro resize de TFP_FILA_FIN. Se
        // prueba que subir TFP_FILA_FIN efectivamente CAMBIA el numero que usa el tope.
        const bloqueMasGrande = { filaDatos: b.filaDatos, filaFin: b.filaFin + 20 };
        const fMasGrande = ctx._formulaCuentasTfp(Object.assign({}, b, bloqueMasGrande), fx.substring(1));
        const capacidadMasGrande = ctx._capacidadFilasTfp(bloqueMasGrande);
        ok(capacidadMasGrande > capacidad &&
           fMasGrande.indexOf('capacidad_datos; IF(cant_faltante > 0; ' + (capacidadMasGrande - 1) + '; ' + capacidadMasGrande + ')') !== -1,
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
        const ancla = ctx._formulaCuentasTfp(b, verbatim);
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

    const yaAplicada = ctx._formulaCuentasTfp(b, fx.substring(1));
    ok(ctx._anclaYaEsNuestraTfp(yaAplicada.substring(1)) === true,
       'la formula que este modulo escribe SI se reconoce como "ya nuestra"');

    const vecesUnaCapa = (yaAplicada.match(/tabla_real;/g) || []).length;
    const reenvuelta = ctx._formulaCuentasTfp(b, yaAplicada.substring(1));
    const vecesDosCapaS = (reenvuelta.match(/tabla_real;/g) || []).length;
    ok(vecesDosCapaS > vecesUnaCapa,
       'SIN el guard, envolver la formula ya aplicada la haria crecer (de ' + vecesUnaCapa +
       ' a ' + vecesDosCapaS + ' referencias a "tabla_real"): el anidamiento es real y creciente. ' +
       'Por eso el preflight verifica _anclaYaEsNuestraTfp ANTES de decidir si extraer.');
}

console.log('\n=== 2b. Extraccion de la QUERY real embebida (necesaria en una segunda corrida) ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const fx = fixtureReal(b.categoria);
        const verbatim = fx.substring(1);
        const aplicada = ctx._formulaCuentasTfp(b, verbatim).substring(1);   // sin '='
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

console.log('\n=== 2c. Upgrade version-proof: una ancla v0.40.0 (TEXT/ISTEXT, sin separador) se detecta y se reescribe ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const fx = fixtureReal(b.categoria);
        const verbatim = fx.substring(1);
        const anclaVieja = fixtureAnclaV0400Aplicada(b, verbatim).substring(1);   // sin '='

        ok(ctx._anclaYaEsNuestraTfp(anclaVieja) === true,
           clave + ': una ancla v0.40.0 (ya desplegada en la planilla real de Franco) SI se reconoce ' +
           'como "envuelta por este modulo" -- no es la QUERY cruda de Franco');

        const extraido = ctx._extraerTablaRealTfp(anclaVieja);
        ok(extraido === verbatim,
           clave + ': se extrae la QUERY real original desde DENTRO de la ancla v0.40.0, exacta, ' +
           'lista para reescribir con la forma v0.41.0');

        const anclaNueva = ctx._formulaCuentasTfp(b, extraido);
        ok(ctx._canonizarFormula('=' + anclaVieja) !== ctx._canonizarFormula(anclaNueva),
           clave + ': la ancla v0.40.0 NO es igual (canonizada) a la que este modulo escribiria hoy -- ' +
           'el preflight la marca "no vigente" y la reescribe, no la deja como esta');
        ok(anclaNueva.indexOf('TEXT(') === -1 && anclaNueva.indexOf('rotulo_separador') !== -1,
           clave + ': la version reescrita ya no tiene TEXT() y si tiene la fila separadora');
    });
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
    function sumifAmbiguoLike(filas, criterioNoVacio) {
        return filas.reduce((acc, f) => {
            const tieneContenido = f.esDerrame || f.valor !== '';
            const matchea = criterioNoVacio ? tieneContenido : !tieneContenido;
            return acc + (matchea ? f.monto : 0);
        }, 0);
    }
    function comparacionDeValorLike(filas, quiereVacio) {
        return filas.reduce((acc, f) => {
            const esVacioDeVerdad = f.valor === '';
            const matchea = quiereVacio ? esVacioDeVerdad : !esVacioDeVerdad;
            return acc + (matchea ? f.monto : 0);
        }, 0);
    }

    const filas = [
        { esDerrame: false, valor: 'umoh', monto: 837728.28 },
        { esDerrame: true, valor: '', monto: 162271.72 },
        { esDerrame: false, valor: 'Tidetrack', monto: 260000 },
        { esDerrame: true, valor: '', monto: 40000 }
    ];
    const totalRealSumif = sumifAmbiguoLike(filas, true);
    const totalFaltSumif = sumifAmbiguoLike(filas, false);
    const realEsperado = 837728.28 + 260000;
    const faltEsperado = 162271.72 + 40000;

    ok(Math.abs(totalRealSumif - (realEsperado + faltEsperado)) < 0.001,
       'REPRODUCCION del bug real: el SUMIF-like con criterio "<>" suma real + faltante mezclados ' +
       '(dio ' + totalRealSumif.toFixed(2) + ', se esperaba real puro ' + realEsperado.toFixed(2) + ')');
    ok(totalFaltSumif === 0,
       'REPRODUCCION del bug real: el SUMIF-like con criterio "=" no encuentra NINGUNA fila ' +
       '"vacia de verdad" y el total de faltantes da CERO -- la otra mitad del sintoma');

    const totalRealValor = comparacionDeValorLike(filas, false);
    const totalFaltValor = comparacionDeValorLike(filas, true);
    ok(Math.abs(totalRealValor - realEsperado) < 0.001,
       'la comparacion de VALOR (lo que este modulo usa) separa correctamente: real puro = ' + totalRealValor.toFixed(2));
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
        ok(ctx._capacidadPeorCasoTfp(b) === 9,
           clave + ': peor caso BAJA a 9 cuentas en v0.41.0 (9 pares x2 = 18 + 1 separador = 19, ' +
           'sobre 20 disponibles). Antes (v0.40.0, sin separador) era 10.');
    });
    ok(ctx._capacidadFilasTfp({ filaDatos: 10, filaFin: 51 }) === 41,
       'la capacidad de filas se recalcula si el bloque creciera, no queda fija en 20');
    ok(ctx._capacidadPeorCasoTfp({ filaDatos: 10, filaFin: 51 }) === 20,
       'MUTACION -- el peor caso tambien se recalcula si el bloque creciera: floor((41-1)/2) = 20');
}

console.log('\n=== 5. El gris de la seccion de faltante (COUNTIF posicional) y por que NO es ISTEXT ni duplicados ===');
{
    ctx.TFP_ORDEN.forEach(clave => {
        const b = ctx.TFP_BLOQUES[clave];
        const f = ctx._formulaReglaGrisTfp(b);
        const filaAncla = b.filaDatos - 1;
        ok(f === '=COUNTIF($' + b.colCuenta + '$' + filaAncla + ':' + b.colCuenta + filaAncla +
           '; "' + ctx.TFP_ROTULO_SEPARADOR + '")>0',
           clave + ': formula exacta del gris (COUNTIF expansivo, ancla una fila arriba de filaDatos). Dio: ' + f);
        ok(f.indexOf('ISTEXT') === -1, clave + ': ya no depende de ISTEXT (esa senal murio con TEXT(), decision #7)');
        ok(f.indexOf('$' + b.colMonto) === -1,
           clave + ': la regla YA NO referencia la columna Monto -- la senal es POSICIONAL (columna Cuenta), ' +
           'no de tipo de dato');

        const item = ctx._reglasGrisTfp().find(r => r.clave === clave);
        ok(item.celda === b.colMonto + b.filaDatos + ':' + b.colMonto + (b.filaFin - 1),
           clave + ': el rango donde se APLICA la regla (Monto) excluye la ultima fila (aviso). Dio: ' + item.celda);
    });

    // LA MUTACION QUE IMPORTA (la que Franco pidio verificar en serio): una cuenta proyectada SIN
    // ningun movimiento real aparece UNA SOLA VEZ, siempre en la seccion 2 -- debajo del
    // separador. Se arma ese universo con el simulador fiel del algoritmo.
    const tablaReal = [['umoh', 837728.28], ['Tidetrack', 260000]];
    const universoFaltante = [
        ['umoh', 162271.72],          // aparece en las DOS secciones
        ['Ingresos Extra', 45000]     // SOLO tiene faltante -- sin ningun real este mes
    ];
    const rotulo = ctx.TFP_ROTULO_SEPARADOR;
    const sim = simularSeccionesConSeparadorTfp(tablaReal, universoFaltante, 20, rotulo);
    const marcas = marcarGrisPorReglaTfp(sim.filas, rotulo);
    const soloDatos = sim.filas.filter(f => !f.esAviso);

    ok(sim.haySeparador === true, 'con faltante > 0 en el universo, el simulador arma la fila separadora');
    ok(soloDatos.filter(f => f.esSeparador).length === 1, 'hay EXACTAMENTE una fila separadora en el derrame');

    const idxSeparador = soloDatos.findIndex(f => f.esSeparador);
    ok(marcas[idxSeparador] === false,
       'LA FILA SEPARADORA NUNCA SE MARCA GRIS A SI MISMA (el COUNTIF, en su propia fila, todavia ' +
       'no llego a incluirla -- rango estrictamente arriba)');

    const idxSoloFaltante = soloDatos.findIndex(f => f.nombre === 'Ingresos Extra');
    ok(idxSoloFaltante > idxSeparador, 'la cuenta sin movimiento real aparece DESPUES del separador');
    ok(marcas[idxSoloFaltante] === true,
       'LA SEÑAL ELEGIDA (COUNTIF posicional): la fila de una cuenta sin movimiento real SI se marca ' +
       'gris, aunque aparezca una sola vez en todo el bloque -- porque esta debajo del separador, no ' +
       'porque se repita');
    ok(typeof soloDatos[idxSoloFaltante].monto === 'number',
       'Y ES UN NUMERO: la cuenta sin movimiento real suma en la barra de estado igual que cualquier otra');

    const idxUmohReal = soloDatos.findIndex(f => f.nombre === 'umoh' && !f.esSeparador);
    const idxUmohFaltante = soloDatos.findIndex((f, i) => f.nombre === 'umoh' && i > idxSeparador);
    ok(marcas[idxUmohReal] === false, 'la fila REAL de umoh (arriba del separador) no se marca gris');
    ok(marcas[idxUmohFaltante] === true, 'la fila de FALTANTE de umoh (abajo del separador) si se marca gris');

    // Sanidad del simulador: la seccion 1 encabeza, los montos son numeros en las DOS secciones
    // (salvo el separador, que va vacio), y el total es el esperado.
    ok(soloDatos[0].nombre === 'umoh' && !soloDatos[0].esSeparador,
       'la seccion 1 (real) encabeza el derrame');
    ok(typeof soloDatos[0].monto === 'number' && typeof soloDatos[idxUmohFaltante].monto === 'number',
       'los montos de las DOS secciones son numeros JS (nunca string): la seleccion suma en Sheets');
    ok(soloDatos[idxSeparador].monto === '', 'el Monto de la fila separadora queda vacio ("")');
    ok(sim.cantReal === 2 && sim.cantFaltanteUniverso === 2, 'el simulador cuenta 2 reales y 2 con faltante > 0');

    // MUTACION: sin ninguna cuenta con faltante, no hay separador ni seccion 2.
    const simSinFaltante = simularSeccionesConSeparadorTfp(tablaReal, [], 20, rotulo);
    ok(simSinFaltante.haySeparador === false,
       'MUTACION -- sin ninguna cuenta con faltante > 0, no se arma fila separadora (nada que separar)');
    ok(simSinFaltante.filas.every(f => !f.esSeparador),
       'MUTACION -- confirmado: ninguna fila del derrame es separadora en ese caso');
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
        getNumberFormat() { return this._numberFormat; },
        setNumberFormat(p) { this._numberFormat = p; this._formatoEscrito = p; return this; },
        setFormula(f) { this._formula = f; return this; },
        setValue(v) { this._valor = v; return this; }
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
            celdas[b.colCuenta + b.filaDatos] = celda('umoh', ctx._formulaCuentasTfp(b, fx.substring(1)));
        } else {
            celdas[b.colCuenta + b.filaDatos] = celda('umoh', fixtureReal(b.categoria));
        }

        const formatoReal = (opts.formatoTotalReal !== undefined) ? opts.formatoTotalReal : '#,##0.00';
        if (opts.yaAplicado) {
            const fx = fixtureReal(b.categoria);
            celdas[b.totalReal] = celda(1000, ctx._formulaTotalRealTfp(fx.substring(1)), formatoReal);
        } else {
            celdas[b.totalReal] = celda(1000, '=SUM(' + b.colMonto + b.filaDatos + ':' + b.colMonto + b.filaFin + ')', formatoReal);
        }
        const formatoFaltante = (opts.formatoTotalFaltante !== undefined) ? opts.formatoTotalFaltante : formatoReal;
        if (opts.totalFaltanteConDato) {
            celdas[b.totalFaltante] = celda(500, '', formatoFaltante);
        } else if (opts.yaAplicado) {
            const fx = fixtureReal(b.categoria);
            celdas[b.totalFaltante] = celda(200, ctx._formulaTotalFaltanteTfp(b, fx.substring(1)), formatoFaltante);
        } else {
            celdas[b.totalFaltante] = celda('', '', formatoFaltante);
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
        _celdas: celdas,
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
        ok(info.anclaVigente === false, clave + ': la ancla todavia es la de Franco, no la version vigente');
        ok(info.totalRealYaEsNueva === false, clave + ': el total real todavia es el SUM viejo');
        ok(info.faltanteEsNuestra === false, clave + ': el total de faltantes esta vacio, no aplicado');
        ok(info.rotuloYaEsta === true, clave + ': el rotulo "Faltante proyectado" ya estaba (Franco lo escribio)');
        ok(info.formatoTotalRealVivo === '#,##0.00', clave + ': se leyo el formato de numero vigente del total real');
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

console.log('\n=== 7d. Ya aplicado en los tres bloques (v0.41.0): nada que hacer (con las SEIS reglas propias) ===');
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
    ctx.TFP_ORDEN.forEach(clave => ok(pre.bloques[clave].anclaVigente === true, clave + ': ancla vigente (v0.41.0), nada que reescribir'));
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
    // MUTACION (v0.41.0): el rotulo de la fila separadora, mezclado en la columna Cuenta, NO
    // cuenta como una cuenta distinta -- si contara, podria enmascarar una cuenta real perdida.
    {
        const inv = ctx._verificarInvariantesTfp(preFalso({
            cuentasCol: ['umoh', ctx.TFP_ROTULO_SEPARADOR]
        }));
        ok(inv.fallas.some(f => /no puede perderse/.test(f)),
           'MUTACION -- "umoh" + el rotulo del separador dan 1 nombre-cuenta distinto (el rotulo no ' +
           'cuenta), y se esperaban 2: la falla lo detecta. Dio: ' + inv.fallas.join('; '));
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

// ============================================================================
// 10. Formato de numero de los totales de faltante (decision #12)
// ============================================================================
console.log('\n=== 10. S8/V8/Y8 heredan el formato de numero de S7/V7/Y7, copiado en vivo ===');
{
    // Caso reportado por Franco: S7 tiene formato de moneda, S8 quedo con el formato general
    // (nunca se le seteo ninguno) -- el plan tiene que proponer copiar el formato, AUNQUE la
    // formula de S8 ya sea la correcta (yaAplicado: true simula justo ese caso).
    const hoja = hojaTableroSimulada({
        yaAplicado: true,
        formatoTotalReal: '$#,##0.00',
        formatoTotalFaltante: '0.###############'   // formato general, el default de una celda nueva
    });
    const pre = ctx._preflightTfp(ssSimulada(hoja));
    ctx.TFP_ORDEN.forEach(clave => {
        const info = pre.bloques[clave];
        ok(info.faltanteEsNuestra === true, clave + ': la FORMULA de S8 ya es la correcta');
        ok(info.formatoTotalFaltanteYaEsNueva === false, clave + ': pero el FORMATO todavia no coincide con S7');
    });
    const plan = ctx._planTfp(pre);
    const cambiosFaltante = plan.cambios.filter(c => c.tipo === 'total_faltante');
    ok(cambiosFaltante.length === 3,
       'el plan propone arreglar el formato en los 3 bloques aunque la formula ya estuviera bien. Dio ' +
       cambiosFaltante.length);
    ok(cambiosFaltante.every(c => c.formatoNuevo === '$#,##0.00'),
       'el formatoNuevo propuesto es EXACTAMENTE el leido de S7/V7/Y7 (copiado, no inventado)');

    // Caso ya correcto: formula Y formato coinciden -> nada que hacer para ese total.
    const hojaOk = hojaTableroSimulada({
        yaAplicado: true, formatoTotalReal: '$#,##0.00', formatoTotalFaltante: '$#,##0.00'
    });
    const preOk = ctx._preflightTfp(ssSimulada(hojaOk));
    const planOk = ctx._planTfp(preOk);
    ok(planOk.cambios.filter(c => c.tipo === 'total_faltante').length === 0,
       'MUTACION -- con formula Y formato ya alineados, el plan NO propone tocar el total de faltantes');

    // _escribirCambioTfp aplica el formato ademas de la formula cuando el cambio lo trae.
    const rangoFalso = celda(0, '', '0.###############');
    const hojaFalsa = { getRange: () => rangoFalso };
    ctx._escribirCambioTfp(hojaFalsa, { celda: 'S8', tipo: 'total_faltante', formulaNueva: '=1+1', formatoNuevo: '$#,##0.00' });
    ok(rangoFalso._formula === '=1+1', '_escribirCambioTfp escribe la formula del total de faltantes');
    ok(rangoFalso._formatoEscrito === '$#,##0.00', '_escribirCambioTfp TAMBIEN copia el formato cuando el cambio lo trae');

    // Un cambio de tipo 'ancla' (sin formatoNuevo) NO debe tocar el formato de la celda.
    const rangoAncla = celda(0, '', '0.000');
    const hojaFalsaAncla = { getRange: () => rangoAncla };
    ctx._escribirCambioTfp(hojaFalsaAncla, { celda: 'R10', tipo: 'ancla', formulaNueva: '=2+2' });
    ok(rangoAncla._formatoEscrito === undefined,
       'MUTACION -- un cambio de tipo "ancla" (sin formatoNuevo) NO llama a setNumberFormat');
}

console.log('\n' + '='.repeat(60));
if (fallas) {
    console.log('FALLAS: ' + fallas);
    process.exit(1);
} else {
    console.log('TODO OK');
}
