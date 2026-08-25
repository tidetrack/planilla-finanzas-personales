/**
 * devtools/probar_shell.js
 * Banco de pruebas de src/16_ShellService.js + src/UI_Shell.html.
 *
 * El shell no escribe en la planilla, asi que el riesgo no es corromper datos: es que la
 * PUERTA no abra, o que abra a un loader eterno. Ese fue el bug de la v0.45.2 y costo cuatro
 * dias. Por eso el banco prueba, en este orden de importancia:
 *
 *   1. Que ningun camino deje al usuario sin nada. obtenerCatalogoShell NUNCA lanza: devuelve
 *      {ok:false, error} aunque el Plan de Cuentas no exista, aunque getTableData explote y
 *      aunque la planilla entera falle. Una excepcion del servidor deja al cliente esperando.
 *   2. Que la whitelist de vistas sea UNA SOLA. En pymes la lista vive en tres lugares y ya
 *      fallo: dos items de menu abrian el Home en silencio. Aca el banco cruza SHELL_VISTAS
 *      contra los divs del HTML, contra el router y contra las funciones de menu.
 *   3. Que cada puerta del menu exista de verdad como funcion.
 *
 * Nada se retipea: las vistas, las dimensiones y los ids salen de los archivos reales,
 * cargados desde RAIZ derivada de __dirname.
 *
 * USO:  node devtools/probar_shell.js       (exit 0 si pasa, 1 si algo sale mal)
 *
 * @version 0.1.0
 * @since 2026-08-24
 * @see src/16_ShellService.js
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const RAIZ = path.join(__dirname, '..');

let fallas = 0;
const ok = (c, m) => { if (c) console.log('  OK  ' + m); else { console.log('  !!! ' + m); fallas++; } };
const seccion = (t) => console.log('\n== ' + t + ' ==');

// ============================================
// STUBS
// ============================================
let ultimoModal = null;
let tablasFalsas = {
    INGRESOS: [['Sueldo', 'Trabajo y negocio'], ['Tidetrack', 'Negocios propios'], ['', '']],
    GASTOS_FIJOS: [['Nafta', 'Vehiculo'], ['Prepaga Salud', 'Salud']],
    GASTOS_VARIABLES: [['Comidas', 'Alimentacion y social']],
    CATEGORIAS_CUENTA: [['Vehiculo'], ['Salud'], ['']],
    MEDIOS_PAGO: [['Galicia', 'ARS', 'Hogar'], ['Dolar Cash', 'USD', 'Ahorros'], ['', '', '']]
};
let getTableDataExplota = false;

function plantillaFalsa() {
    const t = {};
    t.evaluate = () => ({
        setWidth: function (w) { t._ancho = w; return this; },
        setHeight: function (h) { t._alto = h; return this; }
    });
    return t;
}

const ctx = {
    console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp, Error,
    HtmlService: {
        createTemplateFromFile: (n) => { const t = plantillaFalsa(); t._archivo = n; ultimoModal = t; return t; },
        createHtmlOutputFromFile: () => ({ getContent: () => '' })
    },
    SpreadsheetApp: {
        getUi: () => ({ showModalDialog: (h, titulo) => { if (ultimoModal) ultimoModal._titulo = titulo; } }),
        getActiveSpreadsheet: () => ({ getName: () => 'PLANILLA FINANZAS_v4 .WIP | Personal' })
    },
    PropertiesService: { getDocumentProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {} }) },
    Utilities: { formatDate: () => '2026-08-24_1200' },
    Session: { getScriptTimeZone: () => 'America/Argentina/Buenos_Aires' },
    Logger: { log() {} },
    logInfo() {}, logError() {}, logSuccess() {},
    // Se stubean SOLO las dependencias externas al shell, nunca su propia logica.
    getTableData: (clave) => {
        if (getTableDataExplota) throw new Error('boom');
        if (!(clave in tablasFalsas)) throw new Error('tabla desconocida: ' + clave);
        return tablasFalsas[clave];
    },
    showAbmPlanCuentas() { ctx._abmAbierto = true; },
    procesarCargas() { if (ctx._procesarExplota) throw new Error('el lote fallo'); ctx._loteProcesado = true; }
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/01_Version.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/16_ShellService.js'), 'utf8') +
    '\n;Object.assign(globalThis,{SHELL_VISTAS,SHELL_GEOMETRIA,SHELL_VISTA_DEFECTO,_abrirShell,' +
    'abrirTidetrack,abrirMovimientoNuevo,abrirTraspasoNuevo,abrirProyeccionNueva,' +
    'abrirRecurrentes,abrirConciliacionNueva,obtenerCatalogoShell,abrirAbmDesdeShell,' +
    'procesarCargasDesdeShell,diagnosticarShell,MENU_CONFIG,CUENTAS_NEUTRAS,MONEDAS_DISPONIBLES});',
    ctx
);

const HTML = fs.readFileSync(path.join(RAIZ, 'src/UI_Shell.html'), 'utf8');

console.log('BANCO: 16_ShellService + UI_Shell');
console.log('  vistas declaradas: ' + ctx.SHELL_VISTAS.map(v => v.id).join(', '));
console.log('  modal: ' + ctx.SHELL_GEOMETRIA.ancho + 'x' + ctx.SHELL_GEOMETRIA.alto);

seccion('1. Las dimensiones se declaran UNA sola vez');
ctx.abrirTidetrack();
ok(ultimoModal._archivo === 'UI_Shell', 'abre la plantilla UI_Shell');
ok(ultimoModal._ancho === ctx.SHELL_GEOMETRIA.ancho && ultimoModal._alto === ctx.SHELL_GEOMETRIA.alto,
    'el modal usa exactamente SHELL_GEOMETRIA (' + ctx.SHELL_GEOMETRIA.ancho + 'x' + ctx.SHELL_GEOMETRIA.alto + ')');
ok(/^\s+$/.test(ultimoModal._titulo), 'el titulo del modal va en blanco (barra de Sheets sin texto)');
ok(ultimoModal.vistasJson === JSON.stringify(ctx.SHELL_VISTAS),
    'la whitelist se INYECTA al HTML: el cliente no tiene una lista propia');
ok(ultimoModal.ancho === ctx.SHELL_GEOMETRIA.ancho,
    'el ancho tambien viaja al HTML, para que ningun CSS lo contradiga');
// El riesgo real, y la cicatriz de pymes, no es que el CSS tenga anchos: es que las
// DIMENSIONES DEL MODAL aparezcan escritas tambien en el HTML y dejen de coincidir con el
// backend (en pymes el comentario dice 1120, el codigo 1000 y el fragmento 1080). Se busca
// eso y no cualquier max-width -- el 560px de un parrafo es ancho de LECTURA, no de shell.
const dims = new RegExp('(' + ctx.SHELL_GEOMETRIA.ancho + '|' + ctx.SHELL_GEOMETRIA.alto + ')\\s*px');
ok(!dims.test(HTML),
    'las dimensiones del modal NO estan retipeadas en el CSS: solo viven en SHELL_GEOMETRIA');

seccion('2. Cada puerta de entrada abre SU vista');
const PUERTAS = {
    abrirTidetrack: 'home', abrirMovimientoNuevo: 'movimiento', abrirTraspasoNuevo: 'traspaso',
    abrirProyeccionNueva: 'proyeccion', abrirRecurrentes: 'recurrentes',
    abrirConciliacionNueva: 'conciliacion'
};
Object.keys(PUERTAS).forEach(function (fn) {
    ok(typeof ctx[fn] === 'function', fn + '() existe');
    ctx[fn]();
    ok(ultimoModal.vistaInicial === PUERTAS[fn], fn + '() abre en "' + PUERTAS[fn] + '"');
});

seccion('3. Una vista desconocida cae al Home, no rompe');
ctx._abrirShell('esta-vista-no-existe');
ok(ultimoModal.vistaInicial === ctx.SHELL_VISTA_DEFECTO,
    'una puerta mal escrita deja al usuario en el Home en vez de darle un error');

seccion('4. La whitelist es UNA SOLA: backend, HTML y router coinciden');
ctx.SHELL_VISTAS.forEach(function (v) {
    ok(HTML.indexOf('id="vista-' + v.id + '"') !== -1,
        'el HTML tiene el div de la vista "' + v.id + '"');
});
const divs = (HTML.match(/id="vista-([a-z]+)"/g) || []).map(s => s.replace(/id="vista-|"/g, ''));
divs.forEach(function (d) {
    ok(ctx.SHELL_VISTAS.some(v => v.id === d),
        'el div "vista-' + d + '" corresponde a una vista declarada (no hay huerfanos)');
});
ok(divs.length === ctx.SHELL_VISTAS.length,
    'hay exactamente ' + ctx.SHELL_VISTAS.length + ' vistas en el HTML, ni una de mas');

seccion('5. El menu solo apunta a funciones que existen');
function funcionesDeMenu(items, acc) {
    (items || []).forEach(function (it) {
        if (it.function) acc.push(it.function);
        if (it.items) funcionesDeMenu(it.items, acc);
    });
    return acc;
}
const delMenu = funcionesDeMenu(ctx.MENU_CONFIG.ITEMS, []);
ok(delMenu.indexOf('abrirTidetrack') !== -1, 'el menu principal tiene "Abrir Tidetrack"');
ok(ctx.MENU_CONFIG.ITEMS[0].function === 'abrirTidetrack',
    'es el PRIMER item: es la puerta principal');
['estadoConciliarSaldos', 'aplicarConciliarSaldos', 'estadoLimpiarPlan', 'aplicarLimpiarPlan',
 'estadoTipoDeMedios', 'aplicarTipoDeMedios'].forEach(function (f) {
    const todos = funcionesDeMenu(ctx.MENU_CONFIG.ITEMS, funcionesDeMenu(ctx.MENU_CONFIG.DEV_ITEMS, []));
    ok(todos.indexOf(f) === -1, '"' + f + '" ya NO esta en ningun menu (boton cargado retirado)');
});

seccion('6. El catalogo llega entero en un solo viaje');
let cat = ctx.obtenerCatalogoShell();
ok(cat.ok === true, 'devuelve ok');
ok(cat.ingresos.length === 2 && cat.ingresos.indexOf('Sueldo') !== -1, 'trae los ingresos, sin filas vacias');
ok(cat.fijos.length === 2 && cat.variables.length === 1, 'trae fijos y variables');
ok(cat.medios.length === 2, 'trae los medios sin filas vacias');
ok(cat.medios[0].nombre === 'Galicia' && cat.medios[0].moneda === 'ARS' && cat.medios[0].tipo === 'Hogar',
    'cada medio trae nombre, moneda Y tipo (los tres ejes que el formulario necesita)');
ok(JSON.stringify(cat.monedas) === JSON.stringify(ctx.MONEDAS_DISPONIBLES),
    'las monedas salen de la constante de backend (ADR-003)');
ok(JSON.stringify(cat.comodines) === JSON.stringify(ctx.CUENTAS_NEUTRAS),
    'las comodines viajan APARTE de las tres listas de cuentas');
ok(cat.planilla.length > 0 && cat.version.length > 0, 'trae el nombre de la planilla y la version');

seccion('7. MUTACION: el catalogo NUNCA lanza, aunque todo falle');
getTableDataExplota = true;
cat = ctx.obtenerCatalogoShell();
getTableDataExplota = false;
ok(cat && cat.ok === true, 'si una tabla explota igual devuelve ok: el shell abre');
ok(cat.ingresos.length === 0 && cat.medios.length === 0,
    'las listas quedan vacias en vez de romper el viaje entero');

const guardar = ctx.SpreadsheetApp.getActiveSpreadsheet;
ctx.SpreadsheetApp.getActiveSpreadsheet = () => { throw new Error('sin planilla'); };
cat = ctx.obtenerCatalogoShell();
ctx.SpreadsheetApp.getActiveSpreadsheet = guardar;
ok(cat && typeof cat === 'object' && !(cat instanceof Error),
    'ni siquiera una planilla caida hace lanzar a obtenerCatalogoShell');

seccion('8. Las acciones devuelven resultado, no excepciones');
ctx._loteProcesado = false; ctx._procesarExplota = false;
let r = ctx.procesarCargasDesdeShell();
ok(r.ok === true && ctx._loteProcesado === true, 'procesar delega en procesarCargas y avisa que salio bien');
ctx._procesarExplota = true;
r = ctx.procesarCargasDesdeShell();
ctx._procesarExplota = false;
ok(r.ok === false && /el lote fallo/.test(r.error || ''),
    'si el lote falla devuelve {ok:false, error} en vez de lanzar');
ctx._abmAbierto = false;
ctx.abrirAbmDesdeShell();
ok(ctx._abmAbierto === true, 'abrirAbmDesdeShell llama al ABM que ya existe, sin duplicarlo');

seccion('9. ABRIR NO CUESTA NINGUN VIAJE AL SERVIDOR');
// La regresion que motiva esta seccion: la primera v0.47.0 pedia el catalogo en el
// DOMContentLoaded detras de un overlay a pantalla completa, y en la planilla real tardo mas de
// 30 segundos con el Home tapado todo ese rato -- para llenar desplegables que ninguna pantalla
// abierta estaba mostrando.
// Se ancla al LISTENER, no a la palabra: "DOMContentLoaded" tambien aparece en el docstring
// de asegurarCatalogo (que si llama al servidor, y debe), y un regex flojo lo agarraba a el.
const domReady = (HTML.match(/addEventListener\('DOMContentLoaded'[\s\S]*?\n\}\);/) || [''])[0];
ok(domReady.length > 0, 'se encontro el listener de arranque para inspeccionarlo');
ok(domReady.indexOf('google.script.run') === -1,
    'el arranque NO llama al servidor: el Home se ve apenas abre');
ok(/class="shell-overlay hidden"/.test(HTML),
    'el loader arranca APAGADO, no tapando el shell');
ok(HTML.indexOf('<?= planilla ?>') !== -1 && HTML.indexOf('<?= version ?>') !== -1,
    'el pie viene inyectado por la plantilla, no por un round-trip');
ok(!!ultimoModal.planilla && !!ultimoModal.version,
    'el backend le pasa planilla y version a la plantilla al renderizar');
ok(/function asegurarCatalogo/.test(HTML), 'el catalogo se pide con asegurarCatalogo(), perezoso');
ok(/if \(catalogo\)/.test(HTML), 'una vez traido, no se vuelve a pedir');
ok(/setTimeout/.test(HTML) && /clearTimeout/.test(HTML),
    'hay tope de espera: el overlay se apaga aunque el servidor no conteste nunca');
ok(typeof ctx.diagnosticarShell === 'function', 'existe diagnosticarShell() para medir');
ok(funcionesDeMenu(ctx.MENU_CONFIG.DEV_ITEMS, []).indexOf('diagnosticarShell') !== -1,
    'el diagnostico esta cableado al menu Dev');

seccion('10. El cliente no puede quedarse con el loader puesto');
const cadenas = HTML.split('google.script.run').slice(1);
ok(cadenas.length >= 3, 'hay al menos tres llamadas al backend');
cadenas.forEach(function (c, i) {
    ok(c.indexOf('withFailureHandler') !== -1,
        'la llamada #' + (i + 1) + ' tiene withFailureHandler');
});
ok((HTML.match(/loader\(false\)/g) || []).length >= 4,
    'todos los caminos apagan el loader, exito y falla');
// Se miran solo las lineas EJECUTABLES: el modulo tiene un comentario que dice "NUNCA
// google.script.host.close()", y un test que se tropieza con su propia documentacion es ruido.
const jsShell = (HTML.match(/<script[^>]*>([\s\S]*?)<\/script>/) || ['', ''])[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
ok(jsShell.indexOf('host.close') === -1,
    'salirDeVista NO cierra el modal: el contrato de fragmentos lo prohibe');
ok(/function salirDeVista\s*\(\s*\)\s*\{\s*irAVista\('home'\)/.test(jsShell),
    'salirDeVista vuelve al Home, que es lo que el contenedor decide que significa "salir"');

console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (10 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
