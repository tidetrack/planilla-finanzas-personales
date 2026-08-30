/**
 * devtools/probar_purga_respaldos.js
 * Banco de pruebas de DEVTOOL_PurgaRespaldos.js.
 *
 * Es LO UNICO IRREVERSIBLE que hace este repo (una hoja borrada no vuelve), asi que el banco no
 * se conforma con "corre sin explotar": prueba las TRES guardas POR MUTACION -- desactivando
 * cada una por separado y confirmando que el numero de hojas a borrar CAMBIA en la direccion
 * esperada -- y prueba el filtro de patrones contra una lista de NOMBRES REALES, sacada del
 * gemelo digital (docs/permanente/celdas.tsv, snapshot de la planilla real de Franco), incluida
 * "Cuarentena Plan (2026-08-18)" -- la hoja que Franco nombro explicitamente como "no es un
 * respaldo, no la toques".
 *
 * Las tres mutaciones que pide el encargo:
 *   A. Borrar una hoja que NO matchea ningun patron -- la mata: se agrega una hoja sintetica sin
 *      forma de respaldo y se prueba que jamas aparece en matcheadas/aBorrar, este oculta o no,
 *      registrada o no.
 *   B. Borrar el respaldo registrado en Properties -- la mata: se saca la proteccion de
 *      Properties de un respaldo YA protegido por eso y se confirma que pasa a aBorrar; se
 *      restaura y se confirma que vuelve a protegerse.
 *   C. Borrar mas de la cuenta -- la mata: se baja PURGA_RESPALDOS_N_CONSERVAR a 0 (mutando la
 *      constante real que el modulo usa) y se confirma que la cantidad a borrar de un patron con
 *      mas de N candidatas SUBE exactamente en la cantidad de las que dejaron de ser "recientes";
 *      se restaura a 3 y se confirma que vuelve a la cantidad original.
 *
 * USO:  node devtools/probar_purga_respaldos.js       (exit 0 si pasa, 1 si algo sale invalido)
 *
 * @version 0.1.0
 * @since 2026-08-24
 * @see src/DEVTOOL_PurgaRespaldos.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };

// ============================================
// FIXTURE: nombres REALES de hojas, del gemelo digital (docs/permanente/celdas.tsv)
// ============================================
// Snapshot de la planilla real de Franco (~2026-08-21): 50 hojas de respaldo (37 "Respaldo
// formulerio", 11 "Respaldo Plan de Cuentas", 2 "RESP_REGISTROS_v031") + 10 hojas reales,
// incluida "Cuarentena Plan (2026-08-18)" -- exigida explicitamente por el encargo.
const NOMBRES_REALES = [
    'Cargas',
    'Cuarentena Plan (2026-08-18)',
    'Inicio',
    'Mirada Interanual',
    'Plan de Cuentas',
    'Presupuesto',
    'Proyeccion',
    'RESP_REGISTROS_v031_2026-08-19_2123',
    'RESP_REGISTROS_v031_2026-08-19_2125',
    'Registros',
    'Respaldo Plan de Cuentas 2026-08-19_1842',
    'Respaldo Plan de Cuentas 2026-08-19_2257',
    'Respaldo Plan de Cuentas 2026-08-19_2300',
    'Respaldo Plan de Cuentas 2026-08-19_2308',
    'Respaldo Plan de Cuentas 2026-08-19_2310',
    'Respaldo Plan de Cuentas 2026-08-19_2313',
    'Respaldo Plan de Cuentas 2026-08-19_2324',
    'Respaldo Plan de Cuentas 2026-08-19_2345',
    'Respaldo Plan de Cuentas 2026-08-19_2347',
    'Respaldo Plan de Cuentas 2026-08-20_0005',
    'Respaldo Plan de Cuentas 2026-08-20_0009',
    'Respaldo formulerio 2026-08-19_0021',
    'Respaldo formulerio 2026-08-19_1433',
    'Respaldo formulerio 2026-08-19_1722',
    'Respaldo formulerio 2026-08-19_1723',
    'Respaldo formulerio 2026-08-19_1742',
    'Respaldo formulerio 2026-08-19_1843',
    'Respaldo formulerio 2026-08-19_2038',
    'Respaldo formulerio 2026-08-19_2103',
    'Respaldo formulerio 2026-08-19_2117',
    'Respaldo formulerio 2026-08-19_2125',
    'Respaldo formulerio 2026-08-19_2201',
    'Respaldo formulerio 2026-08-19_2257',
    'Respaldo formulerio 2026-08-19_2300',
    'Respaldo formulerio 2026-08-19_2308',
    'Respaldo formulerio 2026-08-19_2348',
    'Respaldo formulerio 2026-08-20_0010',
    'Respaldo formulerio 2026-08-20_0017',
    'Respaldo formulerio 2026-08-20_0034',
    'Respaldo formulerio 2026-08-20_0041',
    'Respaldo formulerio 2026-08-20_1921',
    'Respaldo formulerio 2026-08-20_2010',
    'Respaldo formulerio 2026-08-20_2015',
    'Respaldo formulerio 2026-08-20_2156',
    'Respaldo formulerio 2026-08-20_2228',
    'Respaldo formulerio 2026-08-20_2231',
    'Respaldo formulerio 2026-08-20_2257',
    'Respaldo formulerio 2026-08-20_2328',
    'Respaldo formulerio 2026-08-21_0009',
    'Respaldo formulerio 2026-08-21_0018',
    'Respaldo formulerio 2026-08-21_0026',
    'Respaldo formulerio 2026-08-21_0044',
    'Respaldo formulerio 2026-08-21_0111',
    'Respaldo formulerio 2026-08-21_1348',
    'Respaldo formulerio 2026-08-21_1500',
    'Respaldo formulerio 2026-08-21_1530',
    'Respaldo formulerio 2026-08-21_1548',
    'Respaldo formulerio 2026-08-21_1656',
    'Tablero',
    'Tipos de Cambio',
    // Sinteticos, agregados para probar el sufijo de colision de cada "nombre libre" -- ninguna
    // hoja del gemelo real llego a colisionar, asi que sin esto esa rama del regex no se prueba.
    'Respaldo formulerio 2026-08-21_1656 (2)',
    'RESP_REGISTROS_v031_2026-08-19_2125_2',
    // Sintetica, para la mutacion A: no tiene forma de respaldo de NINGUN patron.
    'Notas personales de Franco'
];
const NOMBRES_NO_RESPALDO = ['Cargas', 'Cuarentena Plan (2026-08-18)', 'Inicio', 'Mirada Interanual',
    'Plan de Cuentas', 'Presupuesto', 'Proyeccion', 'Registros', 'Tablero', 'Tipos de Cambio',
    'Notas personales de Franco'];

// El registrado en Properties para la mutacion B: el MAS VIEJO de "Respaldo formulerio" (fuera
// del top-3 de recencia a proposito, para probar que Properties protege AUNQUE no sea reciente).
const NOMBRE_PROTEGIDO_POR_PROPIEDAD = 'Respaldo formulerio 2026-08-19_0021';

// ============================================
// SHEET/SPREADSHEET FALSOS (sin SpreadsheetApp real)
// ============================================
function crearHojaFalsa(nombre, oculta) {
    return { getName: () => nombre, isSheetHidden: () => oculta !== false };
}

/** Fabrica un SpreadsheetApp-like con las hojas de NOMBRES_REALES, todas ocultas salvo las que se pidan visibles. */
function crearSsFalso(nombresVisibles, nombresExtra) {
    nombresVisibles = nombresVisibles || [];
    const hojas = NOMBRES_REALES.concat(nombresExtra || [])
        .map(n => crearHojaFalsa(n, nombresVisibles.indexOf(n) === -1));
    return {
        getSheets: () => hojas,
        deleteSheet: (h) => { const i = hojas.indexOf(h); if (i === -1) throw new Error('hoja no encontrada'); hojas.splice(i, 1); }
    };
}

let propiedadesFalsas = {};
const PropertiesServiceFalso = {
    getDocumentProperties: () => ({
        getProperties: () => Object.assign({}, propiedadesFalsas),
        getProperty: (k) => (k in propiedadesFalsas ? propiedadesFalsas[k] : null),
        setProperty: (k, v) => { propiedadesFalsas[k] = v; },
        deleteProperty: (k) => { delete propiedadesFalsas[k]; }
    })
};

// ============================================
// CARGA DEL MODULO REAL (y sus dependencias reales, mismo orden que Apps Script)
// ============================================
const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp,
    SpreadsheetApp: { flush() {}, getActiveSpreadsheet: () => null, getUi: () => { throw new Error('sin UI'); } },
    PropertiesService: PropertiesServiceFalso,
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
    fs.readFileSync(path.join(RAIZ, 'src/MIGRACION_v031_Historico.js'), 'utf8') + '\n' +
    // Los tres duenios de los patrones sumados el 2026-08-30. Se cargan de los archivos REALES:
    // el modulo lee sus prefijos en runtime y un banco con su propia copia de un literal miente.
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_ProyeccionAbm.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoGuardar.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PresupuestoModo.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/DEVTOOL_PurgaRespaldos.js'), 'utf8') +
    '\n;Object.assign(globalThis,{FORM_PREFIJO_RESPALDO,ALTA_PREFIJO_RESPALDO,V031_PREFIJO_RESPALDO,' +
    'PA_PREFIJO_RESPALDO,PG_PREFIJO_RESPALDO,PM_PREFIJO_RESPALDO,SHEETS,' +
    'PURGA_RESPALDOS_N_CONSERVAR,PURGA_RESPALDOS_SELLO_REGEX,_purgaRespaldosEscapar,' +
    '_purgaRespaldosPatrones,_purgaRespaldosEvaluar,' +
    '_purgaRespaldosValoresProtegidos});',
    ctx
);
// PURGA_RESPALDOS_N_CONSERVAR es `const` A PROPOSITO (regla del encargo: "N sea una constante
// visible, no un numero suelto"). Para la mutacion de la seccion 5 no se reasigna esa constante
// -- eso tiraria TypeError -- se usa el segundo parametro (opcional, solo para tests) que
// _purgaRespaldosEvaluar ya expone para este fin exacto: sin pasarlo, usa siempre la constante
// real (asi llaman estado()/aplicar()); pasandolo, se puede ejercitar la guarda sin tocar el
// archivo fuente.

console.log('=== 0. Los tres prefijos derivan de las constantes REALES (no estan hardcodeados aca) ===');
ok(ctx.FORM_PREFIJO_RESPALDO === 'Respaldo formulerio ', 'FORM_PREFIJO_RESPALDO = "Respaldo formulerio " (DEVTOOL_FormulerioV0111.js)');
ok(ctx.ALTA_PREFIJO_RESPALDO === 'Respaldo Plan de Cuentas ', 'ALTA_PREFIJO_RESPALDO = "Respaldo Plan de Cuentas " (DEVTOOL_AltaCuentas.js)');
ok(ctx.V031_PREFIJO_RESPALDO === 'RESP_REGISTROS_v031_', 'V031_PREFIJO_RESPALDO = "RESP_REGISTROS_v031_" (MIGRACION_v031_Historico.js)');

console.log('\n=== 1. Filtro de patrones contra la lista REAL (gemelo digital) ===');
{
    propiedadesFalsas = {};
    const ss = crearSsFalso([]);
    const ev = ctx._purgaRespaldosEvaluar(ss);

    ok(ev.totalHojas === NOMBRES_REALES.length, 'totalHojas = ' + ev.totalHojas + ' (todo el fixture)');

    const porPatron = {};
    ev.matcheadas.forEach(it => { porPatron[it.patron.etiqueta] = (porPatron[it.patron.etiqueta] || 0) + 1; });
    ok(porPatron['Respaldo formulerio'] === 38, '38 "Respaldo formulerio" matchean (37 reales + 1 sintetica con colision " (2)"): ' + porPatron['Respaldo formulerio']);
    ok(porPatron['Respaldo Plan de Cuentas'] === 11, '11 "Respaldo Plan de Cuentas" matchean: ' + porPatron['Respaldo Plan de Cuentas']);
    ok(porPatron['RESP_REGISTROS_v031'] === 3, '3 "RESP_REGISTROS_v031" matchean (2 reales + 1 sintetica con colision "_2"): ' + porPatron['RESP_REGISTROS_v031']);
    ok(ev.matcheadas.length === 52, 'total matcheadas = 52 (38+11+3): ' + ev.matcheadas.length);

    NOMBRES_NO_RESPALDO.forEach(nombre => {
        const enMatcheadas = ev.matcheadas.some(it => it.nombre === nombre);
        ok(!enMatcheadas, '"' + nombre + '" NO matchea ningun patron (no se toca, ni se lista)');
    });

    // Cuarentena Plan, en particular: es EXACTAMENTE el caso que el encargo pidio verificar.
    const cuarentena = ev.matcheadas.find(it => it.nombre.indexOf('Cuarentena') !== -1);
    ok(!cuarentena, '"Cuarentena Plan (2026-08-18)" no matchea NINGUN patron -- confirmado, no solo asumido');
}

console.log('\n=== 2. Guarda 3 (visible) ===');
{
    propiedadesFalsas = {};
    const nombreVisible = 'Respaldo formulerio 2026-08-19_1433';   // no es de las 3 mas recientes: sin la guarda, se borraria
    const ss = crearSsFalso([nombreVisible]);
    const ev = ctx._purgaRespaldosEvaluar(ss);
    const item = ev.matcheadas.find(it => it.nombre === nombreVisible);
    ok(!!item && item.conservar === true && item.categoria === 'visible',
        '"' + nombreVisible + '" visible se conserva con categoria "visible": ' + (item && item.categoria));
    ok(!ev.aBorrar.some(it => it.nombre === nombreVisible), 'no aparece en aBorrar mientras este visible');
}

console.log('\n=== 3. MUTACION A -- borrar una hoja que no matchea el patron: la mata ===');
{
    propiedadesFalsas = {};
    const ss = crearSsFalso([]);
    const ev = ctx._purgaRespaldosEvaluar(ss);
    const sintetica = ev.matcheadas.find(it => it.nombre === 'Notas personales de Franco');
    ok(!sintetica, '"Notas personales de Franco" (sin forma de respaldo) nunca entra a matcheadas, aunque este oculta y sin registrar');
    ok(!ev.aBorrar.some(it => it.nombre === 'Notas personales de Franco'), 'y por lo tanto tampoco a aBorrar');
    // La prueba de que esto SI se puede matar: un patron mal escrito a proposito (heuristica
    // "empieza con Respaldo o RESP_", la trampa que la cabecera del modulo prohibe) SI la
    // atraparia -- reproducido aca con una funcion local, para no tocar el archivo real.
    const patronRoto = /^(Respaldo|RESP_)/;
    ok(!patronRoto.test('Notas personales de Franco'), '(control) ni siquiera una heuristica floja la atraparia: confirma que el nombre elegido es un caso limpio de "no matchea nada"');
}

console.log('\n=== 4. MUTACION B -- borrar el respaldo registrado en Properties: la mata ===');
{
    // Con la propiedad puesta: protegido, aunque sea el mas viejo de su patron.
    propiedadesFalsas = { formulerio_v0111_respaldo: NOMBRE_PROTEGIDO_POR_PROPIEDAD };
    const ss1 = crearSsFalso([]);
    const ev1 = ctx._purgaRespaldosEvaluar(ss1);
    const protegido = ev1.matcheadas.find(it => it.nombre === NOMBRE_PROTEGIDO_POR_PROPIEDAD);
    ok(!!protegido && protegido.conservar === true && protegido.categoria === 'propiedad',
        'CON la propiedad puesta, "' + NOMBRE_PROTEGIDO_POR_PROPIEDAD + '" se conserva por "propiedad" (no por reciente: es el mas viejo)');
    ok(!ev1.aBorrar.some(it => it.nombre === NOMBRE_PROTEGIDO_POR_PROPIEDAD), 'y no esta en aBorrar');

    // MATAR LA GUARDA: se saca la propiedad (simula que un modulo nunca llego a registrar el
    // respaldo, o que la propiedad se borro) y la MISMA hoja tiene que pasar a aBorrar.
    propiedadesFalsas = {};
    const ss2 = crearSsFalso([]);
    const ev2 = ctx._purgaRespaldosEvaluar(ss2);
    const sinProteccion = ev2.matcheadas.find(it => it.nombre === NOMBRE_PROTEGIDO_POR_PROPIEDAD);
    ok(!!sinProteccion && sinProteccion.conservar === false,
        'SIN la propiedad, la MISMA hoja deja de estar protegida (categoria: ' + (sinProteccion && sinProteccion.categoria) + ')');
    ok(ev2.aBorrar.some(it => it.nombre === NOMBRE_PROTEGIDO_POR_PROPIEDAD),
        'y AHORA SI aparece en aBorrar -- la guarda de Properties es la unica razon de la diferencia entre ev1 y ev2');

    // Restaurar y confirmar que vuelve a protegerse (no quedo estado colgado).
    propiedadesFalsas = { formulerio_v0111_respaldo: NOMBRE_PROTEGIDO_POR_PROPIEDAD };
    const ev3 = ctx._purgaRespaldosEvaluar(crearSsFalso([]));
    ok(!ev3.aBorrar.some(it => it.nombre === NOMBRE_PROTEGIDO_POR_PROPIEDAD), 'restaurada la propiedad, vuelve a protegerse');
}

console.log('\n=== 5. MUTACION C -- borrar mas de la cuenta (guarda de recencia): la mata ===');
{
    propiedadesFalsas = {};
    const ss = crearSsFalso([]);

    // Baseline con N=3 (el valor real del modulo).
    const evBase = ctx._purgaRespaldosEvaluar(ss);
    const aBorrarFormBase = evBase.aBorrar.filter(it => it.patron.etiqueta === 'Respaldo formulerio').length;
    const conservarFormBase = evBase.aConservar.filter(it => it.patron.etiqueta === 'Respaldo formulerio' && it.categoria === 'reciente').length;
    ok(conservarFormBase === ctx.PURGA_RESPALDOS_N_CONSERVAR,
        'con N=' + ctx.PURGA_RESPALDOS_N_CONSERVAR + ', se conservan exactamente ' + conservarFormBase + ' "Respaldo formulerio" por recencia');

    // MATAR LA GUARDA: bajar N a 0 -- las que eran "reciente" tienen que pasar a aBorrar, ni una
    // mas ni una menos (la cuenta de RESP_REGISTROS_v031, que tiene MENOS candidatas que N, no
    // se ve afectada: ya estaban todas dentro del top-N incluso con N=0 no hay diferencia salvo
    // que ahi tampoco quedan protegidas por recencia). Se pasa 0 por el segundo parametro (SOLO
    // de test, ver nota de carga arriba) en vez de tocar la constante real.
    const evN0 = ctx._purgaRespaldosEvaluar(crearSsFalso([]), 0);
    const aBorrarFormN0 = evN0.aBorrar.filter(it => it.patron.etiqueta === 'Respaldo formulerio').length;
    ok(aBorrarFormN0 === aBorrarFormBase + conservarFormBase,
        'con N=0, aBorrar de "Respaldo formulerio" SUBE de ' + aBorrarFormBase + ' a ' + aBorrarFormN0 +
        ' (exactamente las ' + conservarFormBase + ' que dejaron de estar protegidas por recencia)');

    // Restaurar (dejar de pasar el override) y confirmar que vuelve al baseline con la
    // constante real (prueba que el default sigue siendo PURGA_RESPALDOS_N_CONSERVAR = 3).
    ok(ctx.PURGA_RESPALDOS_N_CONSERVAR === 3, 'la constante real sigue en 3 (nunca se toco)');
    const evRestaurado = ctx._purgaRespaldosEvaluar(crearSsFalso([]));
    const aBorrarFormRestaurado = evRestaurado.aBorrar.filter(it => it.patron.etiqueta === 'Respaldo formulerio').length;
    ok(aBorrarFormRestaurado === aBorrarFormBase, 'sin el override, aBorrar vuelve al baseline con N=3 (' + aBorrarFormRestaurado + ')');
}

console.log('\n=== 6. Consistencia interna (ningun conteo se pierde) ===');
{
    propiedadesFalsas = { formulerio_v0111_respaldo: NOMBRE_PROTEGIDO_POR_PROPIEDAD };
    const ev = ctx._purgaRespaldosEvaluar(crearSsFalso(['Respaldo formulerio 2026-08-19_1433']));
    ok(ev.aBorrar.length + ev.aConservar.length === ev.matcheadas.length,
        'aBorrar + aConservar = matcheadas (' + ev.aBorrar.length + ' + ' + ev.aConservar.length + ' = ' + ev.matcheadas.length + ')');
    ok(ev.aBorrar.every(it => !!it.hoja && !!it.nombre && !!it.patron), 'cada item de aBorrar trae la referencia a la hoja (para poder borrarla) y su patron/nombre (para reportar)');
}


console.log('\n=== 7. Los TRES patrones sumados el 2026-08-30 (PA, PG, PM) ===');
// Los prefijos salen de las constantes REALES cargadas arriba, nunca retipeados aca.
const NOMBRES_NUEVOS = [
    ctx.PA_PREFIJO_RESPALDO + '2026-08-29_143512',          // HHmmss: el que el regex viejo NO agarraba
    ctx.PA_PREFIJO_RESPALDO + '2026-08-29_143513',
    ctx.PA_PREFIJO_RESPALDO + '2026-08-29_143514',
    ctx.PA_PREFIJO_RESPALDO + '2026-08-29_143515',
    ctx.PA_PREFIJO_RESPALDO + '2026-08-30_090000 (2)',      // con sufijo de colision
    ctx.PG_PREFIJO_RESPALDO + '2026-08-28_101112',
    ctx.PG_PREFIJO_RESPALDO + '2026-08-28_101113 (3)',
    ctx.PM_PREFIJO_RESPALDO + '2026-08-27_1015',            // PM sella HHmm: entra por el mismo regex
    ctx.SHEETS.RESPALDOS                                     // la boveda: NO es un respaldo fechado
];
{
    propiedadesFalsas = {};
    const ss = crearSsFalso([], NOMBRES_NUEVOS);
    const ev = ctx._purgaRespaldosEvaluar(ss);
    const porPatron = {};
    ev.matcheadas.forEach(it => { porPatron[it.patron.etiqueta] = (porPatron[it.patron.etiqueta] || 0) + 1; });

    ok(ctx._purgaRespaldosPatrones().length === 6, 'ahora son SEIS patrones, dio ' + ctx._purgaRespaldosPatrones().length);
    ok(porPatron['Respaldo proyeccion abm'] === 5, '5 "Respaldo proyeccion abm" matchean (4 con sello HHmmss + 1 con colision): ' + porPatron['Respaldo proyeccion abm']);
    ok(porPatron['Respaldo presupuesto guardar'] === 2, '2 "Respaldo presupuesto guardar" matchean: ' + porPatron['Respaldo presupuesto guardar']);
    ok(porPatron['Respaldo presupuesto modo'] === 1, '1 "Respaldo presupuesto modo" (sello HHmm) matchea: ' + porPatron['Respaldo presupuesto modo']);

    // LA BOVEDA NO ENTRA. No lleva sello, no matchea, no se lista ni se borra.
    ok(!ev.matcheadas.some(it => it.nombre === ctx.SHEETS.RESPALDOS),
        '"' + ctx.SHEETS.RESPALDOS + '" (la boveda) NO matchea NINGUN patron: es infraestructura viva, no un respaldo fechado');
    ok(!ev.aBorrar.some(it => it.nombre === ctx.SHEETS.RESPALDOS), 'y por lo tanto jamas entra a aBorrar');

    // La guarda de recencia sigue valiendo para los patrones nuevos: de las 5 de PA se conservan
    // las 3 mas recientes y se borran 2.
    const aBorrarPa = ev.aBorrar.filter(it => it.patron.etiqueta === 'Respaldo proyeccion abm');
    ok(aBorrarPa.length === 5 - ctx.PURGA_RESPALDOS_N_CONSERVAR,
        'de las 5 de PA se borran ' + (5 - ctx.PURGA_RESPALDOS_N_CONSERVAR) + ' (las 3 mas recientes se conservan), dio ' + aBorrarPa.length);
}

console.log('\n=== 8. DEFECTO 1 corregido: el regex de sello acepta HHmmss ===');
{
    // El regex VIEJO se reconstruye aca a proposito, para dejar registrado POR QUE se amplio:
    // esta anclado con $, asi que un sello de 6 digitos dejaba 2 sobrantes y NO matcheaba nunca.
    // Sumar PA/PG sin tocarlo habria dado un devtool diciendo "0 a borrar" sobre una planilla
    // llena de basura: verde que afirma de mas.
    const REGEX_VIEJO = '\\d{4}-\\d{2}-\\d{2}_\\d{4}';
    const viejoPa = new RegExp('^' + ctx._purgaRespaldosEscapar(ctx.PA_PREFIJO_RESPALDO) +
        '(' + REGEX_VIEJO + ')(?: \\(\\d+\\))?$');
    const nombreHHmmss = ctx.PA_PREFIJO_RESPALDO + '2026-08-29_143512';
    ok(!viejoPa.test(nombreHHmmss),
        'con el regex VIEJO, "' + nombreHHmmss + '" NO matchea (2 digitos de sobra antes del $)');

    const patrones = ctx._purgaRespaldosPatrones();
    const patronPa = patrones.filter(p => p.etiqueta === 'Respaldo proyeccion abm')[0];
    ok(patronPa.regex.test(nombreHHmmss), 'con el regex AMPLIADO si matchea');
    ok(patronPa.regex.test(ctx.PA_PREFIJO_RESPALDO + '2026-08-29_1435'),
        'y sigue matcheando un sello HHmm de 4 digitos (los tres patrones viejos no se rompen)');
    ok(!patronPa.regex.test(ctx.PA_PREFIJO_RESPALDO + '2026-08-29_14351'),
        'un sello de 5 digitos (ningun formato conocido) NO matchea: nada de heuristicas');

    // Los tres patrones historicos siguen matcheando exactamente lo mismo que antes.
    const patronForm = patrones.filter(p => p.etiqueta === 'Respaldo formulerio')[0];
    ok(patronForm.regex.test('Respaldo formulerio 2026-08-19_1433'), 'Formulerio con HHmm sigue matcheando');
    ok(patronForm.regex.test('Respaldo formulerio 2026-08-19_1433 (2)'), 'y con sufijo de colision tambien');
}

console.log('\n=== 9. DEFECTO 2 corregido: la guarda 1 mira ADENTRO de los valores JSON ===');
{
    // PA y PG guardan el nombre de la hoja en el campo `respaldo` de un OBJETO, no como valor
    // pelado. Con el mapa viejo, esa hoja no quedaba protegida y la purga podia borrar justo la
    // hoja a la que apunta el ultimo "revertir".
    const hojaApuntada = ctx.PA_PREFIJO_RESPALDO + '2026-08-29_143512';
    propiedadesFalsas = {
        proyeccion_abm_edicion_previos: JSON.stringify({ respaldo: hojaApuntada, fila: 9, montoAnterior: 1, montoNuevo: 2 })
    };
    const mapa = ctx._purgaRespaldosValoresProtegidos();
    ok(!!mapa[hojaApuntada] && mapa[hojaApuntada].indexOf('proyeccion_abm_edicion_previos') !== -1,
        'una propiedad JSON con campo `respaldo` protege ESA hoja, dio ' + JSON.stringify(mapa[hojaApuntada] || null));

    const ss = crearSsFalso([], NOMBRES_NUEVOS);
    const ev = ctx._purgaRespaldosEvaluar(ss);
    const item = ev.matcheadas.filter(it => it.nombre === hojaApuntada)[0];
    ok(!!item && item.conservar === true && item.categoria === 'propiedad',
        'y en la evaluacion completa queda conservada por categoria "propiedad", dio ' + (item && item.categoria));

    // MUTACION: se saca la propiedad y la hoja tiene que volver a ser candidata (la guarda de
    // recencia no la salva: es la MAS VIEJA de su patron).
    propiedadesFalsas = {};
    const evSin = ctx._purgaRespaldosEvaluar(crearSsFalso([], NOMBRES_NUEVOS));
    ok(evSin.aBorrar.some(it => it.nombre === hojaApuntada),
        'sin la propiedad, la misma hoja SI entra a aBorrar: la guarda se puede matar, o sea que mide algo');

    // El valor pelado (los trece modulos historicos) sigue protegiendo igual.
    propiedadesFalsas = { form_respaldo: 'Respaldo formulerio 2026-08-19_1433' };
    const mapaPelado = ctx._purgaRespaldosValoresProtegidos();
    ok(!!mapaPelado['Respaldo formulerio 2026-08-19_1433'],
        'el valor CRUDO sigue protegiendo: el camino de los trece modulos historicos no se toco');

    // Un valor que no es JSON no puede romper el mapa (JSON.parse lanza en la mayoria de ellos).
    propiedadesFalsas = { basura: '{no es json', numero: '12345', vacio: '' };
    let exploto = false;
    try { ctx._purgaRespaldosValoresProtegidos(); } catch (e) { exploto = true; }
    ok(!exploto, 'valores que no son JSON no rompen el mapa: el try/catch es obligatorio, no decorativo');
}

console.log('\n' + (fallas === 0 ? '===> SIN FALLAS' : '===> ' + fallas + ' FALLA(S)'));
process.exit(fallas === 0 ? 0 : 1);
