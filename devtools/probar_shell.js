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
    procesarCargas() { if (ctx._procesarExplota) throw new Error('el lote fallo'); ctx._loteProcesado = true; },
    LockService: { getDocumentLock: () => ({ tryLock: () => !ctx._lockOcupado, releaseLock() {} }) }
};
vm.createContext(ctx);
vm.runInContext(
    fs.readFileSync(path.join(RAIZ, 'src/00_Config.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/01_Version.js'), 'utf8') + '\n' +
    // 03_SheetManager aporta columnLetterToIndex/getDataRow, que el shell usa para derivar
    // la geometria de la grilla desde RANGES en vez de retipear posiciones.
    fs.readFileSync(path.join(RAIZ, 'src/03_SheetManager.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(RAIZ, 'src/16_ShellService.js'), 'utf8') + '\n' +
    // 17_RecurrentesService: la BD de recurrentes y su volcado a Proyeccion. Carga DESPUES
    // del shell, igual que en Apps Script (16_ < 17_ en el orden alfabetico).
    fs.readFileSync(path.join(RAIZ, 'src/17_RecurrentesService.js'), 'utf8') +
    '\n;Object.assign(globalThis,{SHELL_VISTAS,SHELL_GEOMETRIA,SHELL_VISTA_DEFECTO,_abrirShell,' +
    'abrirTidetrack,abrirMovimientoNuevo,abrirTraspasoNuevo,abrirProyeccionNueva,' +
    'abrirRecurrentes,abrirConciliacionNueva,obtenerCatalogoShell,abrirAbmDesdeShell,' +
    'procesarCargasDesdeShell,diagnosticarShell,_validarMovimiento,_estadoGrillaCargas,_filaDeCarga,_plata,TIPOS_RIQUEZA,columnLetterToIndex,RANGES,SHEETS,MENU_CONFIG,CUENTAS_NEUTRAS,MONEDAS_DISPONIBLES,' +
    'SHELL_CONC_TOLERANCIA,CUENTA_AJUSTE,CUENTA_ARRASTRE,REC_MARCA,REC_ACTIVO_SI,REC_ACTIVO_NO,REC_MESES});',
    ctx
);

// 03_SheetManager declara su propio getTableData y, al cargarse, PISA el stub del contexto.
// Se repone despues: este banco prueba el shell, no la capa de datos, y necesita catalogos
// deterministas. Lo que NO se stubea es columnLetterToIndex/getDataRow, que son justamente lo
// que hace que el shell derive la geometria de RANGES en vez de retipearla.
ctx.getTableData = (clave) => {
    if (getTableDataExplota) throw new Error('boom');
    if (!(clave in tablasFalsas)) throw new Error('tabla desconocida: ' + clave);
    return tablasFalsas[clave];
};

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
// Lo que hay que impedir es que el TAMANO DEL MODAL este declarado dos veces y se
// desincronice -- la cicatriz de pymes, donde el comentario dice 1120, el codigo 1000 y el
// fragmento 1080. Un breakpoint de media query NO es eso: es una respuesta a que Sheets
// recorte el dialogo. Y un numero dentro de un comentario tampoco. Se buscan DECLARACIONES
// DE TAMANO, que es la unica forma en que las dos fuentes pueden contradecirse.
const cssSinComentarios = HTML
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^{]*\{/g, '@media {');
const dims = new RegExp(
    '(?:^|[;{\\s])(?:min-|max-)?(?:width|height)\\s*:\\s*(?:' +
    ctx.SHELL_GEOMETRIA.ancho + '|' + ctx.SHELL_GEOMETRIA.alto + ')px');
ok(!dims.test(cssSinComentarios),
    'el TAMANO del modal no esta declarado en el CSS: solo vive en SHELL_GEOMETRIA');

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
ok(typeof cat.filasGrilla === 'number' && cat.filasGrilla === ctx.RANGES.CARGAS.filas,
    'filasGrilla viaja y sale de RANGES: el cliente cuenta tandas con el dato real');
// La poda 2026-08-29: los cinco campos sin consumidor en el cliente ya no viajan. Dos de
// ellos (categorias, libres) costaban una lectura de hoja por apertura de formulario.
['planilla', 'version', 'categorias', 'comodines', 'libres'].forEach(function (campo) {
    ok(!(campo in cat), 'el catalogo ya NO arrastra "' + campo + '": campo muerto, podado');
});

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

seccion('11. Validacion de Movimiento: el gap de procesarCargas se tapa aca');
// procesarCargas filtra SOLO por "monto no vacio": una fila sin cuenta entra igual al ledger
// con tipo vacio. Ese gap es conocido y no se arregla en el pipeline; se tapa en la puerta.
const catalogosVal = { medios: ['Galicia', 'Dolar Cash'] };
const okBase = { monto: 100, tipo: 'Egreso', cuenta: 'Comidas', medio: 'Galicia', moneda: 'ARS' };
ok(ctx._validarMovimiento(okBase, catalogosVal).length === 0, 'un movimiento completo pasa');
ok(ctx._validarMovimiento(Object.assign({}, okBase, { cuenta: '' }), catalogosVal).length === 1,
    'sin cuenta NO pasa (es el gap de procesarCargas)');
ok(ctx._validarMovimiento(Object.assign({}, okBase, { monto: '' }), catalogosVal).length === 1, 'sin monto no pasa');
ok(ctx._validarMovimiento(Object.assign({}, okBase, { monto: -5 }), catalogosVal).length === 1,
    'monto negativo no pasa: para que salga plata se usa el tipo Egreso');
ok(ctx._validarMovimiento(Object.assign({}, okBase, { medio: 'Banco Inventado' }), catalogosVal).length === 1,
    'un medio que no esta en el Plan no pasa');
ok(ctx._validarMovimiento(Object.assign({}, okBase, { moneda: 'BRL' }), catalogosVal).length === 1,
    'una moneda que la planilla no maneja no pasa');
const manana = new Date(); manana.setDate(manana.getDate() + 2);
ok(ctx._validarMovimiento(Object.assign({}, okBase, { fecha: manana.toISOString() }), catalogosVal).length === 1,
    'fecha futura no pasa: procesarCargas aborta el LOTE ENTERO si encuentra una');
const hoy = new Date();
ok(ctx._validarMovimiento(Object.assign({}, okBase, { fecha: hoy.toISOString() }), catalogosVal).length === 0,
    'la fecha de hoy SI pasa (se compara contra el fin del dia, no contra el instante)');
// La trampa del parseo UTC: el input type=date manda 'YYYY-MM-DD' pelado y new Date() lo
// parsea en UTC -- en UTC-3 la fecha de MANIANA caia 21:00 de hoy y pasaba la validacion,
// dejando el lote atascado en la grilla (fetchArsRate rechaza fechas futuras).
const isoPlano = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
const mananaPlano = new Date(); mananaPlano.setDate(mananaPlano.getDate() + 1);
ok(ctx._validarMovimiento(Object.assign({}, okBase, { fecha: isoPlano(mananaPlano) }), catalogosVal).length === 1,
    "la fecha de MANIANA como 'YYYY-MM-DD' pelado NO pasa: se parsea con componentes locales, no UTC");
ok(ctx._validarMovimiento(Object.assign({}, okBase, { fecha: isoPlano(hoy) }), catalogosVal).length === 0,
    "la fecha de HOY como 'YYYY-MM-DD' pelado SI pasa");
ok(ctx._validarMovimiento(Object.assign({}, okBase, { nota: '=HOY()' }), catalogosVal).length === 1,
    'una nota que empieza con "=" se rechaza: setValues la escribiria como formula viva');

seccion('12. La fila se arma desde RANGES, no retipeando posiciones');
const fila = ctx._filaDeCarga({ monto: 123, tipo: 'Egreso', cuenta: 'Comidas', medio: 'Galicia',
    moneda: 'ARS', fecha: '2026-08-25', nota: 'hola' });
const cc = ctx.RANGES.CARGAS.columns;
const base = ctx.RANGES.CARGAS.start.charCodeAt(0) - 64;
const idx = (l) => l.charCodeAt(0) - 64 - base;
ok(fila.length === 7, 'la fila tiene el ancho de la grilla (C:I)');
ok(fila[idx(cc.monto)] === 123, 'el monto cae en la columna que declara RANGES');
ok(fila[idx(cc.cuenta)] === 'Comidas', 'la cuenta tambien');
ok(fila[idx(cc.nota)] === 'hola', 'y la nota');

seccion('13. Formato de plata igual al de la hoja');
ok(ctx._plata(319569.7, 'ARS') === '$319.569,70', 'ARS: simbolo pegado, miles con punto, coma decimal');
ok(ctx._plata(1430, 'USD') === 'US$1.430,00', 'USD lleva US$');

seccion('14. Las dos vistas nuevas estan marcadas como listas');
const porId = {};
ctx.SHELL_VISTAS.forEach(v => { porId[v.id] = v; });
ok(porId.movimiento.listo === true, 'movimiento: listo');
ok(porId.traspaso.listo === true, 'traspaso: listo');
ok(porId.proyeccion.listo === true && porId.recurrentes.listo === true &&
   porId.conciliacion.listo === true,
   'las tres vistas nuevas quedaron declaradas LISTAS (su backend existe y se prueba abajo)');
ok(/class="[^"]*b-monto/.test(HTML) && /class="[^"]*t-montoO/.test(HTML),
    'los dos formularios existen y los dos son bloques repetibles');
ok(/enviar\('registrarMovimientos'/.test(HTML) && /enviar\('registrarTraspasos'/.test(HTML),
    'el cliente llama a los endpoints de LOTE, no a los de a uno');

seccion('16. Carga multiple: bloques repetibles con tope real');
ok(/function agregarBloqueMovimiento/.test(HTML), 'se pueden agregar bloques');
ok(/function quitarBloqueMovimiento/.test(HTML), 'y quitarlos');
ok(/function renumerarBloques/.test(HTML), 'los bloques se renumeran al agregar o quitar');
// El tope YA NO es la grilla: el backend procesa en tandas. Lo que queda como limite es el
// tiempo de ejecucion, y el usuario ve cuantas tandas va a costar antes de apretar Cargar.
ok(/function cupoMaximo/.test(HTML) && /CUPO_BLOQUES/.test(HTML),
    'el tope es un techo de tiempo, no la altura de la grilla');
ok(/catalogo\.filasGrilla/.test(HTML),
    'el tamano de tanda sale del backend, no se retipea 15 en el cliente');
ok(/tandas/.test(HTML), 'el cliente avisa en cuantas tandas se va a procesar');
ok(typeof ctx.registrarTraspasos === 'function', 'existe el endpoint de traspasos en lote');
ok(ctx.registrarTraspasos([]).ok === false, 'un lote de traspasos vacio se rechaza');
ok(/function agregarBloqueTraspaso/.test(HTML) && /function quitarBloqueTraspaso/.test(HTML),
    'los traspasos tambien se agregan y se quitan como bloques');
ok(/list="dlCuentas"/.test(HTML) && /list="dlMedios"/.test(HTML),
    'los desplegables son filtrables: input con datalist, no select');
ok(/<datalist id="dlCuentas">/.test(HTML) && /<datalist id="dlMedios">/.test(HTML),
    'los datalist son COMPARTIDOS, se pueblan una vez y cada bloque los referencia');
// La flecha nativa del datalist y el chevron dibujado tienen que ser LA MISMA flecha: una
// invisible encima de la otra. Si alguien la apaga con display:none se pierde el click que
// abre la lista (medido: el click pasa a mover el cursor dentro del texto), y si el ancho
// deja de coincidir con el padding-right, la zona clickeable se corre del dibujo.
const reglaFlecha = (HTML.match(
    /\.f \.combo input:not\(\[type="date"\]\)::-webkit-calendar-picker-indicator\s*\{([^}]*)\}/) || [])[1] || '';
const padCombo = (HTML.match(/\.f \.combo input \{[^}]*padding-right:\s*(\d+)px/) || [])[1];
ok(reglaFlecha !== '', 'el combo neutraliza la flecha nativa del datalist: una sola flecha por campo');
ok(/opacity:\s*0\s*;/.test(reglaFlecha) && !/display:\s*none/.test(reglaFlecha),
    'la flecha nativa queda INVISIBLE pero clickeable: nunca display:none, ahi vive el click que abre la lista');
ok(!!padCombo && new RegExp('width:\\s*' + padCombo + 'px').test(reglaFlecha) &&
   new RegExp('margin:\\s*0 -' + padCombo + 'px 0 0').test(reglaFlecha),
    'la zona clickeable mide lo mismo que el padding-right: el click cae sobre el chevron dibujado');
ok(!/\.f \.form-input\[type="date"\]::-webkit-calendar-picker-indicator\s*\{[^}]*opacity:\s*0\s*;/.test(HTML),
    'los campos de fecha conservan su flecha visible: la regla del combo no los alcanza');
ok(/aria-pressed="true"\]\[data-v="Egreso"\]/.test(HTML) &&
   /aria-pressed="true"\]\[data-v="Ingreso"\]/.test(HTML),
    'el Tipo elegido se pinta con el semaforo, rojo o verde');
ok(/<h1 id="shellTitulo">tidetrack<\/h1>/.test(HTML),
    'la marca va en minusculas');
ok(typeof ctx._filasLibresCargas === 'undefined',
    '_filasLibresCargas se retiro con la poda de "libres": ya no tenia llamadores');
ok(/heredaMedio|heredaFecha/.test(HTML),
    'un bloque nuevo hereda medio y fecha del anterior');
ok(/function medioPorDefecto/.test(HTML),
    'el PRIMER bloque tiene un default pensado, no el primero del catalogo');
ok(/catalogo\.monedas \|\| \[\]\)\[0\]/.test(HTML),
    'la moneda base sale de MONEDAS_DISPONIBLES, no se retipea "ARS"');
ok(!/heredaMedio = ''/.test(HTML),
    'el primer bloque NO arranca sin medio: eso dejaba el primero alfabetico, que es en USD');
ok(!/heredaMonto|heredaCuenta|heredaNota/.test(HTML),
    'y NO hereda monto, cuenta ni nota: heredar lo que cambia obliga a borrarlo');
ok(typeof ctx.registrarMovimientos === 'function', 'existe el endpoint de lote');
const lote = ctx.registrarMovimientos([]);
ok(lote.ok === false, 'un lote vacio se rechaza');

seccion('17. Tipografia: una sola familia y la fuente se carga de verdad');
// El bug que Franco vio como "distorciones de tamanos de letras": --font-mono declara
// JetBrains Mono y Fira Code, ninguna instalada, asi que los rotulos caian en Courier New.
// A 10.5px la altura de x de Courier es ~4,4px al lado de un select de 14px sans.
// Se miran las DECLARACIONES, no el archivo entero: los comentarios de este shell explican
// el bug y nombran tanto --font-mono como 10.5px. Un test que se tropieza con la
// documentacion del bug que previene es ruido, y ya paso tres veces en esta campana.
const sinComentarios = HTML
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
ok(/fonts\.googleapis\.com/.test(HTML),
    'el HTML CARGA la webfont: sin el link, Google Sans nunca se descarga');
ok(!/var\(--font-mono\)/.test(sinComentarios),
    'cero usos de la familia mono en el shell: una sola familia, como pymes');
ok(!/10\.5px/.test(sinComentarios),
    'cero 10.5px: Chrome los redondea distinto segun donde caiga la caja');
ok(!/var\(--font-mono\)/.test(
        fs.readFileSync(path.join(RAIZ, 'src/UI_SharedStyles.html'), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')),
    'el token --font-mono ya no existe en el design system: resolvia a Courier New');
ok(/--alto-control/.test(HTML) && /height: var\(--alto-control\)/.test(HTML),
    'los controles tienen ALTURA FIJA: un select ignora line-height y un date trae su propio shadow DOM');
ok(/b\.disabled = v/.test(HTML),
    'los botones se deshabilitan mientras viaja: dos clicks serian dos movimientos en el ledger');
ok(HTML.indexOf('tiposRiquezaJson') !== -1,
    'TIPOS_RIQUEZA viaja del backend al cliente, no se retipea');

seccion('15. El JSON se inyecta con el scriptlet que NO escapa');
// El bug de la v0.48.0: se inyecto con la forma que hace escapado contextual, que convierte
// cada comilla en &quot;. Adentro de un <script> eso es un error de sintaxis, y un error de
// sintaxis mata el archivo entero -- no corre el router, no corre ningun onclick. El sintoma
// ("abre pero no reacciona") se parece tanto a una llamada lenta que costo dos diagnosticos.
const escapa = (v) => new RegExp('<\\?=\\s*' + v + '\\s*\\?>').test(HTML);
const noEscapa = (v) => new RegExp('<\\?!=\\s*' + v + '\\s*\\?>').test(HTML);
ok(noEscapa('vistasJson') && !escapa('vistasJson'), 'vistasJson usa la forma que NO escapa');
ok(noEscapa('tiposRiquezaJson') && !escapa('tiposRiquezaJson'),
    'tiposRiquezaJson tambien');
ok(escapa('planilla') && escapa('version'),
    'el pie SI usa la que escapa: va a texto HTML, y ahi escapar es lo correcto');

seccion('18. El servidor local de pruebas: el doble sigue al shell, el marco a la geometria');
// El drift que vivio tres releases: el shell paso a registrarTraspasos (plural) en v0.53.0 y
// el doble siguio doblando el singular. No fallaba limpio -- enviar() ya habia prendido el
// loader y armado el tope de 60 s, asi que la pantalla colgaba un minuto y despues mandaba a
// revisar Registros por un movimiento que nunca se escribio. Aca se cruza el shell contra el
// doble en las DOS formas de llamada: la cadena directa y el despacho dinamico de enviar().
const DOBLE = fs.readFileSync(path.join(RAIZ, 'devtools/servidor_shell/doble.js'), 'utf8');
const MARCO = fs.readFileSync(path.join(RAIZ, 'devtools/servidor_shell/marco.html'), 'utf8');
const HANDLERS = ['withSuccessHandler', 'withFailureHandler'];
const nombres = (re, txt) => {
    const salida = []; let m;
    while ((m = re.exec(txt)) !== null) { if (HANDLERS.indexOf(m[1]) === -1) salida.push(m[1]); }
    return salida;
};
const usadas = new Set([].concat(
    nombres(/\}\)\s*\.(\w+)\s*\(/g, HTML),
    nombres(/google\.script\.run\s*\.(\w+)\s*\(/g, HTML),
    nombres(/enviar\(\s*'(\w+)'/g, HTML)));
const listaDoble = DOBLE.match(/\[([^\]]*?)\]\.forEach/);
const expuestas = new Set(
    (listaDoble ? listaDoble[1].match(/'(\w+)'/g) || [] : []).map((t) => t.slice(1, -1)));
const faltan = [...usadas].filter((n) => !expuestas.has(n));
ok(listaDoble !== null, 'el doble expone su API por una whitelist legible');
ok(faltan.length === 0,
    'el doble implementa TODO lo que el shell llama por google.script.run' +
    (faltan.length ? ' -- faltan: ' + faltan.join(', ') : ''));
ok(usadas.has('registrarTraspasos'),
    'el shell llama al endpoint de traspasos en LOTE: si vuelve el singular, el doble se entera');

// El catalogo del doble es el CONTRATO del backend. Si el backend gana un campo y el doble no,
// la vista que lo estrene descubre en local que llega undefined -- y no siempre rompe fuerte:
// filasGrilla faltaba y coincidia por casualidad con el fallback duro a 15 del cliente.
const clavesBackend = Object.keys(ctx.obtenerCatalogoShell()).sort();
const clavesDoble = Object.keys(
    JSON.parse((DOBLE.match(/var CATALOGO_REAL = (\{[\s\S]*?\});/) || [])[1] || '{}')).sort();
ok(clavesDoble.length > 0, 'el catalogo del doble se puede leer como JSON');
ok(clavesDoble.join(',') === clavesBackend.join(','),
    'el catalogo del doble tiene EXACTAMENTE los campos que devuelve obtenerCatalogoShell');

// La geometria del modal vive UNA sola vez, en SHELL_GEOMETRIA. El marco la recibe por hueco:
// si alguien escribe 900 a mano ahi, la simulacion deja de seguir a la fuente y miente.
ok(/--sim-ancho:\s*\{\{ANCHO\}\}px/.test(MARCO) && /--sim-alto:\s*\{\{ALTO\}\}px/.test(MARCO),
    'el marco NO tiene la geometria escrita: la recibe de SHELL_GEOMETRIA por hueco');
ok(/(?<![-\w])src="\{\{SHELL_SRC\}\}"/.test(MARCO) && /data-src="\{\{SHELL_SRC\}\}"/.test(MARCO),
    'el iframe del marco recibe el nombre del shell por hueco, en src Y en data-src');
ok(/width:\s*var\(--sim-ancho\)/.test(MARCO) && /height:\s*var\(--sim-alto\)/.test(MARCO) &&
   !/\.sim-lienzo\s*\{[^}]*(width|height):\s*\d+%/.test(MARCO),
    'el iframe mide ancho x alto EXACTOS: si fuera porcentaje, el marco no simularia nada');
ok(/transform\s*=\s*'scale\(/.test(MARCO) && /Math\.min\(1,/.test(MARCO),
    'si la ventana no da se escala el DIALOGO con transform y nunca por encima de 1');

seccion('19. Backend de las tres vistas nuevas: proyeccion, conciliacion, recurrentes');
// Las constantes ajenas que el backend lee en runtime se DERIVAN de los archivos reales,
// nunca se retipean: un banco con su propia copia de un literal miente (memoria del repo).
const leerSrc = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
ctx.PG_MARCA = /const PG_MARCA = '([^']+)'/.exec(leerSrc('src/DEVTOOL_PresupuestoGuardar.js'))[1];
ctx.PB_MARCA = /const PB_MARCA = '([^']+)'/.exec(leerSrc('src/DEVTOOL_PresupuestoBase.js'))[1];
ok(!!ctx.PG_MARCA && !!ctx.PB_MARCA,
    'PG_MARCA y PB_MARCA se leyeron de los archivos reales, no de una copia');
// IP_MESES NO se define a proposito: la ruta diaria del shell no puede depender de un
// DEVTOOL (candidato a salir del deploy). Si 16_ShellService volviera a leerlo, los tests
// de proyeccion de abajo explotarian con ReferenceError al armar el mensaje. Se miran solo
// las lineas EJECUTABLES: la decision inline documenta el cambio nombrando la constante.
const srcShellEjecutable = leerSrc('src/16_ShellService.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
ok(!/IP_MESES/.test(srcShellEjecutable),
    'el shell no depende de IP_MESES: los meses salen de REC_MESES (misma linea de trabajo)');
ok(ctx.REC_MARCA.indexOf(ctx.PG_MARCA) !== 0 && ctx.PG_MARCA.indexOf(ctx.REC_MARCA) !== 0 &&
   ctx.REC_MARCA.indexOf(ctx.PB_MARCA) !== 0 && ctx.PB_MARCA.indexOf(ctx.REC_MARCA) !== 0,
    'REC_MARCA no es prefijo de PG/PB ni al reves: el indexOf(...)===0 nunca confunde');

// Se stubean SOLO dependencias externas al shell: el motor FX (15) y el clasificador (06).
ctx._fxExplota = false;
ctx.TIDETRACK_USD = () => { if (ctx._fxExplota) throw new Error('API caida'); return 1300; };
ctx.TIDETRACK_AUD = () => 850;
ctx.TIDETRACK_EUR = () => 1500;
ctx.leerCatalogosPlanCuentas = () => ({
    ingresos: tablasFalsas.INGRESOS.map(f => f[0]).filter(v => v),
    fijos: tablasFalsas.GASTOS_FIJOS.map(f => f[0]).filter(v => v),
    variables: tablasFalsas.GASTOS_VARIABLES.map(f => f[0]).filter(v => v)
});
ctx.deducirTipoCuenta = (cuenta, cats) => {
    if ((cats.ingresos || []).indexOf(cuenta) !== -1) return 'Ingreso';
    if ((cats.fijos || []).indexOf(cuenta) !== -1) return 'Gasto Fijo';
    if ((cats.variables || []).indexOf(cuenta) !== -1) return 'Gasto Variable';
    return '';
};

// Una planilla falsa CON hojas de verdad (grilla en memoria), porque estas vistas escriben.
function hojaFalsa(nombre) {
    const grid = [];
    for (let r = 0; r < 80; r++) grid.push(new Array(20).fill(''));
    return {
        _grid: grid,
        getName: () => nombre,
        getMaxRows: () => grid.length,
        getLastRow: function () {
            for (let r = grid.length - 1; r >= 0; r--) {
                if (grid[r].some(c => c !== '' && c !== null)) return r + 1;
            }
            return 0;
        },
        getRange: function (fila, col, nf, nc) {
            nf = nf || 1; nc = nc || 1;
            return {
                getValues: function () {
                    const out = [];
                    for (let r = 0; r < nf; r++) out.push((grid[fila - 1 + r] || []).slice(col - 1, col - 1 + nc));
                    return out;
                },
                getValue: function () { return (grid[fila - 1] || [])[col - 1]; },
                setValues: function (vals) {
                    vals.forEach((v, i) => v.forEach((c, j) => { grid[fila - 1 + i][col - 1 + j] = c; }));
                },
                setValue: function (v) { grid[fila - 1][col - 1] = v; },
                clearContent: function () {
                    for (let r = 0; r < nf; r++) for (let c = 0; c < nc; c++) grid[fila - 1 + r][col - 1 + c] = '';
                },
                copyTo: function () { /* formato: no aplica en el banco */ }
            };
        },
        insertRowsAfter: function (pos, cant) { for (let i = 0; i < cant; i++) grid.push(new Array(20).fill('')); },
        deleteRows: function (ini, cant) {
            grid.splice(ini - 1, cant);
            for (let i = 0; i < cant; i++) grid.push(new Array(20).fill(''));
        },
        deleteRow: function (fila) { this.deleteRows(fila, 1); },
        hideSheet: function () { this._oculta = true; }
    };
}
const hojasFalsas = {};
const ssFalsa = {
    getName: () => 'PLANILLA FALSA',
    getSheets: () => Object.keys(hojasFalsas).map(n => hojasFalsas[n]),
    getSheetByName: (n) => hojasFalsas[n] || null,
    insertSheet: (n) => { hojasFalsas[n] = hojaFalsa(n); return hojasFalsas[n]; },
    deleteSheet: (h) => { delete hojasFalsas[h.getName()]; }
};
// La geometria de las hojas falsas se DERIVA de RANGES, no se retipea.
const cfgReg19 = ctx.RANGES.REGISTROS;
const col19 = (letra) => ctx.columnLetterToIndex(letra);
const HDR19 = ['Monto', 'Tipo', 'Cuenta', 'Tipo de Cuenta', 'Medio', 'Moneda', 'Fecha', 'Nota',
    'TC ARS', 'TC USD', 'TC AUD', 'TC EUR'];
const hojaReg19 = ssFalsa.insertSheet(cfgReg19.sheet);
hojaReg19.getRange(cfgReg19.headerRow, col19(cfgReg19.start), 1, HDR19.length).setValues([HDR19]);
const hojaProy19 = ssFalsa.insertSheet('Proyeccion');
hojaProy19.getRange(cfgReg19.headerRow, col19(cfgReg19.start), 1, HDR19.length).setValues([HDR19]);
const hojaPlan19 = ssFalsa.insertSheet('Plan de Cuentas');
const cfgMed19 = ctx.RANGES.MEDIOS_PAGO;
hojaPlan19.getRange(8, col19(cfgMed19.start), 2, 3)
    .setValues([['Galicia', 'ARS', 'Hogar'], ['Dolar Cash', 'USD', 'Ahorros']]);
const hojaCargas19 = ssFalsa.insertSheet('Cargas');
// Ledger inicial: Galicia arranca con un 'Inicio Mes' de 1000 y un egreso de 200 -> saldo 800.
const filaLedger = (monto, tipo, cuenta, medio, moneda, fecha) => {
    const fila = new Array(col19(cfgReg19.end) - col19(cfgReg19.start) + 1).fill('');
    const pon = (k, v) => { fila[col19(cfgReg19.columns[k]) - col19(cfgReg19.start)] = v; };
    pon('monto', monto); pon('tipo', tipo); pon('cuenta', cuenta);
    pon('medio', medio); pon('moneda', moneda); pon('fecha', fecha);
    return fila;
};
hojaReg19.getRange(cfgReg19.dataRow, col19(cfgReg19.start), 2, HDR19.length).setValues([
    filaLedger(1000, 'Ingreso', ctx.CUENTA_ARRASTRE, 'Galicia', 'ARS', new Date(2026, 7, 1)),
    filaLedger(200, 'Egreso', 'Comidas', 'Galicia', 'ARS', new Date(2026, 7, 10))
]);

// El stub global de formatDate devuelve un sello fijo; la conciliacion necesita fechas DE
// VERDAD (la fecha del ajuste viaja como 'yyyy-MM-dd' y se valida). Se formatea en serio.
ctx.Utilities = {
    formatDate: function (fecha, tz, formato) {
        const p2 = (n) => String(n).padStart(2, '0');
        const y = fecha.getFullYear(), M = p2(fecha.getMonth() + 1), d = p2(fecha.getDate());
        if (formato === 'yyyy-MM-dd') return y + '-' + M + '-' + d;
        if (formato === 'dd/MM/yyyy') return d + '/' + M + '/' + y;
        return y + '-' + M + '-' + d + '_' + p2(fecha.getHours()) + p2(fecha.getMinutes()) + p2(fecha.getSeconds());
    }
};
const SpreadsheetAppPrevio = ctx.SpreadsheetApp;
ctx.SpreadsheetApp = {
    getUi: SpreadsheetAppPrevio.getUi,
    getActiveSpreadsheet: () => ssFalsa,
    flush: () => {},
    CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' }
};
ctx.invalidarCacheNombresHojas();
// El lock, instrumentado: cuenta cuantas veces se toma (el refactor SinLock no puede duplicarlo).
let locksTomados = 0;
ctx.LockService = {
    getDocumentLock: () => ({ tryLock: () => { locksTomados++; return !ctx._lockOcupado; }, releaseLock() {} })
};
// getTableData del stub gana una tabla: RECURRENTES, resuelta sobre la hoja falsa con la
// geometria de RANGES (las demas siguen siendo los catalogos deterministas de siempre).
const getTableDataBase19 = ctx.getTableData;
ctx.getTableData = function (clave) {
    if (clave === 'RECURRENTES') {
        const cfg = ctx.RANGES.RECURRENTES;
        const hoja = hojasFalsas[cfg.sheet];
        if (!hoja) throw new Error('no existe la hoja ' + cfg.sheet);
        const ult = hoja.getLastRow();
        if (ult < cfg.dataRow) return [];
        return hoja.getRange(cfg.dataRow, col19(cfg.start), ult - cfg.dataRow + 1,
            col19(cfg.end) - col19(cfg.start) + 1).getValues()
            .filter(f => f.some(c => c !== ''));
    }
    return getTableDataBase19(clave);
};
// procesarCargas simulado de punta a punta: mueve la grilla de Cargas al ledger y la limpia
// (lo que el real hace, reducido a lo que estas pruebas miden: el saldo resultante).
ctx.procesarCargas = function () {
    const cfgC = ctx.RANGES.CARGAS;
    const cIni = col19(cfgC.start);
    const nC = col19(cfgC.end) - cIni + 1;
    const grilla = hojaCargas19.getRange(cfgC.dataRow, cIni, cfgC.filas, nC).getValues();
    const ic = (k) => col19(cfgC.columns[k]) - cIni;
    grilla.forEach(function (f) {
        if (f[ic('monto')] === '' || f[ic('monto')] === null) return;
        const destino = hojaReg19.getLastRow() + 1;
        hojaReg19.getRange(destino, col19(cfgReg19.start), 1, HDR19.length).setValues([
            filaLedger(f[ic('monto')], f[ic('tipo')], f[ic('cuenta')], f[ic('medio')],
                f[ic('moneda')], new Date(String(f[ic('fecha')]) + 'T00:00:00'))
        ]);
    });
    hojaCargas19.getRange(cfgC.dataRow, cIni, cfgC.filas, nC).clearContent();
};

// --- Proyeccion ---
const hoy19 = new Date();
const mesFut19 = new Date(hoy19.getFullYear(), hoy19.getMonth() + 1, 1);
const claveFut19 = mesFut19.getFullYear() + '-' + String(mesFut19.getMonth() + 1).padStart(2, '0');
ok(ctx.registrarProyecciones([]).ok === false, 'un lote de proyecciones vacio se rechaza');
let rp = ctx.registrarProyecciones([{ cuenta: 'Comidas', monto: 100, moneda: 'ARS', mes: '2020-01' }]);
ok(rp.ok === false && rp.problemas && /ya paso/.test(rp.problemas[0]), 'un mes pasado se rechaza');
rp = ctx.registrarProyecciones([{ cuenta: 'Cuenta Inventada', monto: 100, moneda: 'ARS', mes: claveFut19 }]);
ok(rp.ok === false && rp.problemas && /no esta en el Plan/.test(rp.problemas[0]),
    'cuenta fuera del Plan BLOQUEA (a diferencia del movimiento: sin tipo no suma en ningun bloque)');
rp = ctx.registrarProyecciones([{ cuenta: ctx.CUENTAS_NEUTRAS[0], monto: 100, moneda: 'ARS', mes: claveFut19 }]);
ok(rp.ok === false && /tecnica del sistema/.test(rp.problemas[0]), 'una cuenta neutra no se proyecta');
const notasProy19 = () => {
    const ult = hojaProy19.getLastRow();
    if (ult < cfgReg19.dataRow) return [];
    return hojaProy19.getRange(cfgReg19.dataRow, col19(cfgReg19.columns.nota),
        ult - cfgReg19.dataRow + 1, 1).getValues().map(f => String(f[0] || '')).filter(v => v);
};
ctx._fxExplota = true;
rp = ctx.registrarProyecciones([{ cuenta: 'Comidas', monto: 10, moneda: 'ARS', mes: claveFut19 }]);
ctx._fxExplota = false;
ok(rp.ok === false && /API caida/.test(rp.error || ''), 'si la API de FX cae, corta con {ok:false} (Regla 9)');
ok(notasProy19().length === 0, 'y NO escribio ninguna fila');
rp = ctx.registrarProyecciones([{ cuenta: 'Comidas', monto: 5000, moneda: 'ARS', mes: claveFut19, nota: 'extra' }]);
ok(rp.ok === true, 'una proyeccion valida entra: ' + (rp.error || (rp.problemas || []).join('; ') || 'ok'));
const notaPg19 = notasProy19()[0] || '';
ok(notaPg19.indexOf(ctx.PG_MARCA + ' ' + claveFut19 + ' shell_') === 0,
    'la Nota lleva el marcado PG + clave + sello shell_: el ABM la reconoce sin tocarlo');
ok(/ extra$/.test(notaPg19), 'la nota libre del usuario viaja al final, visible en la hoja');
ok(/para (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) \d{4}\./.test(rp.mensaje),
    'el mensaje nombra el mes en castellano');

// --- Conciliacion ---
ok(ctx.registrarConciliacion([]).ok === false, 'un lote de conciliacion vacio se rechaza');
let sc = ctx.obtenerSaldosConciliacion();
ok(sc.ok === true && Array.isArray(sc.saldos) && sc.saldos.length === 2,
    'obtenerSaldosConciliacion mide TODOS los medios del Plan (no un snapshot)');
const galicia19 = sc.saldos.filter(x => x.medio === 'Galicia')[0];
ok(!!galicia19 && galicia19.saldo === 800,
    'el saldo aplica la regla del ultimo Inicio Mes + lo posterior (dio ' + (galicia19 && galicia19.saldo) + ')');
ok(sc.tolerancia === ctx.SHELL_CONC_TOLERANCIA, 'la tolerancia viaja del backend: el cliente no la retipea');
let rc = ctx.registrarConciliacion([{ medio: 'Banco Inventado', saldoVisto: 0, saldoReal: 10 }]);
ok(rc.ok === false && /no esta en el Plan/.test(rc.problemas[0]), 'un medio fuera del Plan se rechaza');
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: 123, saldoReal: 500 }]);
ok(rc.ok === false && /cambio desde que abriste/.test(rc.problemas[0]),
    'ANTI-CARRERA: si el saldo cambio desde que se abrio la vista, aborta el lote entero');
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: 800, saldoReal: 800 }]);
ok(rc.ok === true && /ya coinciden/.test(rc.mensaje), 'sin diferencias no se carga nada');
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: 800, saldoReal: 1000 }]);
ok(rc.ok === true && /Galicia quedo en \$1\.000,00/.test(rc.mensaje || ''),
    'un ajuste real entra por el pipeline y verifica al releer: ' + (rc.error || rc.mensaje));
sc = ctx.obtenerSaldosConciliacion();
ok(sc.saldos.filter(x => x.medio === 'Galicia')[0].saldo === 1000,
    'el saldo releido quedo en el declarado');
const cuentaAjuste19 = hojaReg19.getRange(cfgReg19.dataRow, col19(cfgReg19.columns.cuenta),
    hojaReg19.getLastRow() - cfgReg19.dataRow + 1, 1).getValues()
    .filter(f => String(f[0]) === ctx.CUENTA_AJUSTE).length;
ok(cuentaAjuste19 === 1, 'el ajuste quedo en el ledger con la cuenta CUENTA_AJUSTE');
locksTomados = 0;
ctx.registrarMovimientos([]);
ok(locksTomados === 1, 'registrarMovimientos toma el lock exactamente UNA vez (el refactor no lo duplico)');
locksTomados = 0;
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: 1000, saldoReal: 1000 }]);
ok(rc.ok === true && locksTomados === 1,
    'registrarConciliacion tambien: mide y escribe bajo UN solo lock, sin re-entrar');

// --- Recurrentes ---
let lr = ctx.obtenerRecurrentes();
ok(lr.ok === true && lr.recurrentes.length === 0,
    'obtenerRecurrentes con hoja ausente devuelve lista vacia SIN lanzar (leer no crea la hoja)');
const recBase19 = { nombre: 'Netflix', cuenta: 'Comidas', monto: 5000, moneda: 'ARS',
    medio: 'Galicia', dia: 5, nota: '', activo: 'Si' };
let gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { cuenta: ctx.CUENTAS_NEUTRAS[0] }));
ok(gr.ok === false && /comodin del sistema/.test((gr.problemas || []).join(' ')),
    'una cuenta comodin no puede ser recurrente');
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { dia: 0 }));
ok(gr.ok === false, 'dia 0 se rechaza');
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { dia: 32 }));
ok(gr.ok === false, 'dia 32 se rechaza');
gr = ctx.guardarRecurrente(recBase19);
ok(gr.ok === true, 'un recurrente valido se guarda: ' + (gr.error || (gr.problemas || []).join('; ') || 'ok'));
ok(!!hojasFalsas[ctx.SHEETS.RECURRENTES] && hojasFalsas[ctx.SHEETS.RECURRENTES]._oculta === true,
    'la hoja se creo en el primer guardado y quedo OCULTA recien despues de verificar');
lr = ctx.obtenerRecurrentes();
ok(lr.ok === true && lr.recurrentes.length === 1 && lr.recurrentes[0].activo === true,
    'la lectura devuelve el recurrente, con activo como booleano');
const filasRec19 = () => notasProy19().filter(n => n.indexOf(ctx.REC_MARCA + ' ' + claveFut19 + ' ') === 0).length;
const periodo19 = { mes: mesFut19.getMonth() + 1, anio: mesFut19.getFullYear() };
let vr = ctx.volcarRecurrentesAlMes(periodo19);
ok(vr.ok === true && filasRec19() === 1,
    'el volcado escribe una fila por recurrente activo: ' + (vr.error || vr.mensaje));
vr = ctx.volcarRecurrentesAlMes(periodo19);
ok(vr.ok === true && filasRec19() === 1,
    'volcar DOS veces el mismo mes deja N filas, no 2N (idempotente por periodo)');
ok(/Se reemplazo el volcado anterior/.test(vr.mensaje), 'y el mensaje dice que reemplazo');
ok(notasProy19().filter(n => n.indexOf(ctx.PG_MARCA) === 0).length === 1,
    'las filas PG del mismo mes NO se tocaron: los recurrentes son aditivos');
ctx._fxExplota = true;
vr = ctx.volcarRecurrentesAlMes(periodo19);
ctx._fxExplota = false;
ok(vr.ok === false && filasRec19() === 1,
    'si la API de FX cae, el volcado corta SIN escribir y SIN tocar el volcado previo');
const ev19 = ctx.estadoVolcadoRecurrentes(periodo19);
ok(ev19.ok === true && ev19.activos === 1 && ev19.previasPropias === 1 && ev19.otrasDelMes.manual === 1,
    'estadoVolcado informa activos, previas propias y las filas ajenas del mes ANTES de escribir');
let br = ctx.borrarRecurrente('No Existe');
ok(br.ok === false && /No existe un recurrente/.test(br.error), 'borrar un recurrente inexistente avisa');
br = ctx.borrarRecurrente('Netflix');
ok(br.ok === true && ctx.obtenerRecurrentes().recurrentes.length === 0,
    'borrar quita la fila de la BD (lo ya volcado no se toca)');
ok(filasRec19() === 1, 'y efectivamente lo volcado sigue en Proyeccion');

seccion('20. El cliente de las tres vistas nuevas');
// El backend ya se probo en la 19; aca se prueba que el HTML lo INVOQUE de verdad y que el
// doble del servidor local siga al shell (el drift doble-shell ya costo tres releases).
ok(HTML.indexOf('Todavia no esta construida') === -1,
    'no queda ningun placeholder "en construccion": las tarjetas prometen solo lo que opera');
// Se mira el HTML sin comentarios: el CSS nuevo DOCUMENTA que .shell-pendiente se retiro,
// y un test que se tropieza con la documentacion del cambio que verifica es ruido.
ok(!/shell-pendiente/.test(sinComentarios),
    'el CSS y el DOM de la vista-en-construccion se retiraron enteros: cero clases muertas');

// -- Proyeccion --
ok(/id="proyLista"/.test(HTML) && /id="proyBtnGuardar"/.test(HTML) && /id="proyCupo"/.test(HTML),
    'la vista proyeccion tiene lista de bloques, cupo y boton de guardar');
ok(/class="form-input p-mes" type="month"/.test(HTML),
    'el mes objetivo es un input type="month" (degrada a texto libre; la regex vive en el servidor)');
ok(!/p-medio/.test(HTML),
    'una proyeccion NO pide medio: la BD lo deja vacio a proposito y ningun consumidor lo lee');
ok(/enviar\('registrarProyecciones'/.test(HTML),
    'proyeccion guarda por enviar(): lote entero, doble-click bloqueado, cuatro finales');
ok(/PLANTILLA_PROYECCION/.test(HTML) && /abrirBloqueProyeccion/.test(HTML),
    'proyeccion reusa el patron de bloques repetibles con acordeon');
ok(/no lleva cotizacion congelada/.test(HTML) === false,
    'el texto falso sobre cotizaciones no congeladas se retiro: PG congela J:M desde v0.50.0');

// -- Recurrentes --
ok(/id="recLista"/.test(HTML) && /id="recBtnVolcar"/.test(HTML) &&
   /id="recMes"/.test(HTML) && /id="recAnio"/.test(HTML),
    'la vista recurrentes tiene lista, periodo (mes y anio) y boton de volcado');
ok(/enviar\('guardarRecurrente'/.test(HTML) && /enviar\('borrarRecurrente'/.test(HTML) &&
   /enviar\('volcarRecurrentesAlMes'/.test(HTML),
    'recurrentes guarda, borra y vuelca por enviar()');
ok(usadas.has('obtenerRecurrentes') && usadas.has('estadoVolcadoRecurrentes'),
    'la lista se lee del backend y el volcado pide su estado ANTES de escribir');
ok(/Confirmar borrado/.test(HTML),
    'borrar pide un segundo click sobre el mismo boton: dos pasos, sin dialogo nativo');
ok(/Confirmar volcado/.test(HTML) && /alert-warning/.test(HTML),
    'el volcado se confirma INLINE con los numeros reales, nunca como efecto oculto');
ok(/data-v="Si"/.test(HTML) && /data-v="No"/.test(HTML) &&
   /\[data-activo="Si"\]/.test(HTML) && /\[data-activo="No"\]/.test(HTML),
    'el estado Activo/Pausado usa el segmentado y el punto del resumen, verde/ambar del semaforo');

// -- Conciliacion --
ok(/id="concContenido"/.test(HTML) && /id="concBtnGuardar"/.test(HTML) && /id="concResumen"/.test(HTML),
    'la vista conciliacion tiene su contenido, su resumen y su boton Conciliar');
ok(usadas.has('obtenerSaldosConciliacion') && /enviar\('registrarConciliacion'/.test(HTML),
    'mide los saldos con su propio viaje y carga los ajustes por enviar()');
ok(/saldosConc = null/.test(jsShell),
    'la medicion NO se cachea entre entradas: cada entrada a la vista re-mide');
ok(!/0\.005/.test(jsShell),
    'la tolerancia no esta retipeada en el cliente: viaja en la respuesta del backend');
ok(/Reintentar/.test(HTML),
    'el estado de error de la medicion vive EN la vista, con boton Reintentar');
ok(/quedan adentro del ajuste, sin detalle/.test(HTML),
    'la advertencia del ledger corto (portada del DEVTOOL) esta en la vista');
ok(/'mas' : 'menos'/.test(jsShell) && /entra como /.test(jsShell),
    'el semaforo de direccion dice ademas COMO entra el ajuste (Ingreso/Egreso)');
// Conciliacion NO pasa por asegurarCatalogo: su preparador va en el mapa propio.
ok(/VISTAS_CON_PREPARADOR_PROPIO = \{ conciliacion: prepararConciliacion \}/.test(HTML),
    'prepararConciliacion no paga el costo del catalogo del Plan: mapa de preparadores propio');

// -- El doble sigue al shell tambien en lo nuevo (la whitelist ya se cruzo en la 18;
//    aca se fija que los OCHO endpoints nuevos esten de verdad implementados) --
['registrarProyecciones', 'obtenerSaldosConciliacion', 'registrarConciliacion',
 'obtenerRecurrentes', 'guardarRecurrente', 'borrarRecurrente',
 'estadoVolcadoRecurrentes', 'volcarRecurrentesAlMes'].forEach(function (fn) {
    ok(new RegExp(fn + ': function').test(DOBLE),
        'el doble implementa ' + fn + ' (metodo real, no solo whitelist)');
});

seccion('21. GUARD: todo campo que viaja tiene consumidor real en el cliente');
// Asi sobrevivio 'libres' dos auditorias: los tests exigian que el campo VIAJE, no que
// alguien lo lea. La lista del backend se obtiene EJECUTANDO los endpoints en el vm (un
// banco con copia propia miente, memoria del repo); la del cliente se busca SOLO en jsShell
// (el <script> sin comentarios), para que un comentario que nombre el campo no cuente.
const camposCatalogo = Object.keys(ctx.obtenerCatalogoShell())
    .filter(k => k !== 'ok' && k !== 'error');
camposCatalogo.forEach(function (campo) {
    const consumidor = new RegExp(
        '\\b(?:catalogo|data)\\s*\\.\\s*' + campo + '\\b' +
        '|\\[\\s*[\'"]' + campo + '[\'"]\\s*\\]' +
        '|\\{[^{}]*\\b' + campo + '\\b[^{}]*\\}\\s*=\\s*(?:catalogo|data)\\b');
    ok(consumidor.test(jsShell),
        'catalogo.' + campo + ' tiene al menos un consumidor real en UI_Shell.html');
});
// Lo mismo para los endpoints de medicion (asi se cazo 'pausados'). Salvedad documentada:
// el alias generico 'r' puede dar falso positivo si dos endpoints comparten nombre de campo.
[['obtenerSaldosConciliacion', ctx.obtenerSaldosConciliacion()],
 ['estadoVolcadoRecurrentes', ctx.estadoVolcadoRecurrentes(periodo19)]].forEach(function (par) {
    ok(par[1] && par[1].ok === true, par[0] + ' respondio ok para poder listar sus campos');
    Object.keys(par[1] || {}).filter(k => k !== 'ok' && k !== 'error').forEach(function (campo) {
        ok(new RegExp('\\b(?:r|saldosConc)\\s*\\.\\s*' + campo + '\\b').test(jsShell),
            par[0] + '.' + campo + ' tiene lector en el cliente');
    });
});

seccion('22. Correcciones de la pasada adversarial post-v0.58.0');
// -- (1) La escritura por tandas NO pisa una fila tipeada a mano en el medio de la grilla --
const cfgC22 = ctx.RANGES.CARGAS;
const cIni22 = col19(cfgC22.start);
const hoy22 = new Date();
const iso22 = hoy22.getFullYear() + '-' + String(hoy22.getMonth() + 1).padStart(2, '0') +
    '-' + String(hoy22.getDate()).padStart(2, '0');
const filaManual22 = ctx._filaDeCarga({ monto: 777, tipo: 'Egreso', cuenta: 'Comidas',
    medio: 'Galicia', moneda: 'ARS', fecha: iso22, nota: 'tipeada a mano' });
// La manual va en la fila 10 de la grilla (indice 9), con las 9 de arriba vacias: el hueco.
hojaCargas19.getRange(cfgC22.dataRow + 9, cIni22, 1, filaManual22.length).setValues([filaManual22]);
const estado22 = ctx._estadoGrillaCargas(hojaCargas19);
ok(estado22.libres === cfgC22.filas - 1 && estado22.libresContiguas === 9,
    '_estadoGrillaCargas distingue libres (' + estado22.libres + ') de libresContiguas (' +
    estado22.libresContiguas + '): la tanda solo puede usar el tramo contiguo');
const lote22 = [];
for (let i = 0; i < 10; i++) {
    lote22.push({ monto: 100 + i, tipo: 'Egreso', cuenta: 'Comidas', medio: 'Galicia',
        moneda: 'ARS', fecha: iso22 });
}
const antesLedger22 = hojaReg19.getLastRow();
r = ctx.registrarMovimientos(lote22);
ok(r.ok === true, 'un lote de 10 con la fila manual en el medio entra: ' + (r.error || 'ok'));
const nuevas22 = hojaReg19.getLastRow() - antesLedger22;
ok(nuevas22 === 11, 'el ledger gano 11 filas: las 10 del lote MAS la manual (gano ' + nuevas22 + ')');
const montosLedger22 = hojaReg19.getRange(cfgReg19.dataRow, col19(cfgReg19.columns.monto),
    hojaReg19.getLastRow() - cfgReg19.dataRow + 1, 1).getValues().map(f => f[0]);
ok(montosLedger22.indexOf(777) !== -1,
    'la fila tipeada a mano NO se piso: su monto llego intacto al ledger');

// -- (3 del encargo) procesarCargasDesdeShell ahora toma el lock --
locksTomados = 0;
r = ctx.procesarCargasDesdeShell();
ok(r.ok === true && locksTomados === 1,
    'procesarCargasDesdeShell toma el lock: era el unico endpoint de escritura sin el');

// -- (4) Conciliar con filas manuales pendientes ABORTA antes de calcular deltas --
let scAntes22 = ctx.obtenerSaldosConciliacion();
const saldoGal22 = scAntes22.saldos.filter(x => x.medio === 'Galicia')[0].saldo;
hojaCargas19.getRange(cfgC22.dataRow, cIni22, 1, filaManual22.length).setValues([filaManual22]);
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: saldoGal22, saldoReal: saldoGal22 + 500 }]);
ok(rc.ok === false && /grilla de Cargas/.test(rc.error || ''),
    'con la grilla ocupada la conciliacion aborta: el saldo medido no incluye lo pendiente y el ajuste doble-contaria');
hojaCargas19.getRange(cfgC22.dataRow, cIni22, 1, filaManual22.length).clearContent();
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: saldoGal22, saldoReal: saldoGal22 }]);
ok(rc.ok === true, 'con la grilla vacia la conciliacion vuelve a operar');

// -- (18) saldoVisto no numerico ya no desactiva el anti-carrera en silencio --
rc = ctx.registrarConciliacion([{ medio: 'Galicia', saldoReal: 100 }]);
ok(rc.ok === false && /Volve a entrar a Conciliacion/.test((rc.problemas || []).join(' ')),
    'saldoVisto ausente o no numerico se rechaza explicito en vez de apagar el guard (NaN > x da false)');

// -- (19) anio fuera de rango en el volcado --
let vr22 = ctx.volcarRecurrentesAlMes({ mes: 8, anio: 26 });
ok(vr22.ok === false && /cuatro cifras/.test(vr22.error || ''),
    'anio de dos digitos se rechaza: Date lo mapearia a 1926 y el volcado seria invisible');
ok(ctx.estadoVolcadoRecurrentes({ mes: 8, anio: 2026.5 }).ok === false,
    'anio no entero tambien se rechaza, en el estado y en el volcado');

// -- (6) El volcado revalida lo leido de la hoja Recurrentes y corta ANTES de borrar --
gr = ctx.guardarRecurrente(recBase19);
ok(gr.ok === true, 'se re-crea el recurrente para el escenario de hoja corrupta');
const hojaRec22 = hojasFalsas[ctx.SHEETS.RECURRENTES];
const cfgRec22 = ctx.RANGES.RECURRENTES;
const celdaMonto22 = hojaRec22.getRange(cfgRec22.dataRow, col19(cfgRec22.columns.monto), 1, 1);
celdaMonto22.setValue('$4.500');   // pegado a mano en la hoja oculta: Number() da NaN
vr22 = ctx.volcarRecurrentesAlMes(periodo19);
ok(vr22.ok === false && /Netflix/.test(vr22.error || ''),
    'un monto con texto corta el volcado NOMBRANDO la fila invalida (antes fallaba abierto: NaN > tolerancia da false)');
ok(filasRec19() === 1, 'y el volcado previo del mes quedo intacto: se corto antes de borrar');
celdaMonto22.setValue(5000);
vr22 = ctx.volcarRecurrentesAlMes(periodo19);
ok(vr22.ok === true && filasRec19() === 1,
    'con el monto reparado el volcado vuelve a operar (y sigue idempotente)');

// -- (21) Dos lotes de proyecciones en el mismo segundo: el rollback no cruza corridas --
const notasAntes22 = notasProy19().length;
rp = ctx.registrarProyecciones([{ cuenta: 'Comidas', monto: 100, moneda: 'ARS', mes: claveFut19 }]);
const rp2 = ctx.registrarProyecciones([{ cuenta: 'Comidas', monto: 200, moneda: 'ARS', mes: claveFut19 }]);
ok(rp.ok === true && rp2.ok === true, 'dos lotes seguidos (mismo segundo de reloj) entran los dos');
ok(notasProy19().length === notasAntes22 + 2,
    'quedaron LAS DOS filas: la verificacion es por bloque propio y un sello repetido no puede borrar la corrida anterior');
ok(/Guardar Proyeccion para ese mes/.test(rp.mensaje || ''),
    'el mensaje declara que un Guardar Proyeccion posterior del mes reemplaza tambien las puntuales del shell');

// -- (14) aNumero: el punto sin coma tambien es separador de miles cuando el patron es-AR
//    es inequivoco. Se prueba la FUNCION REAL extraida del HTML, no una copia. --
const fuenteANumero = (jsShell.match(/function aNumero\([\s\S]*?\n\}/) || [''])[0];
ok(fuenteANumero.length > 0, 'aNumero se pudo extraer del HTML para probarla de verdad');
const aNum = new Function('return ' + fuenteANumero + ';')();
ok(aNum('500.000') === 500000, "aNumero('500.000') = 500000 (antes: 500, ajuste gigante y falso en conciliacion)");
ok(aNum('1.234') === 1234, "aNumero('1.234') = 1234 (patron de miles es-AR)");
ok(aNum('12.400,50') === 12400.5, "aNumero('12.400,50') = 12400.5 (coma decimal, como siempre)");
ok(aNum('12400.50') === 12400.5, "aNumero('12400.50') = 12400.5 (punto decimal cuando NO matchea miles)");
ok(aNum('12.34') === 12.34, "aNumero('12.34') = 12.34 (dos decimales: no es patron de miles)");
ok(aNum('') === '', 'vacio sigue siendo vacio');

// -- mesCortoCliente ya no promete meses que el backend va a negar (degradacion de type=month) --
const fuenteMesCorto = (jsShell.match(/function mesCortoCliente\([\s\S]*?\n\}/) || [''])[0];
ok(fuenteMesCorto.length > 0, 'mesCortoCliente se pudo extraer del HTML');
const mesCorto = new Function('return ' + fuenteMesCorto + ';')();
ok(mesCorto('2026-13') === '2026-13',
    "mesCortoCliente('2026-13') devuelve la clave cruda, no 'ene 2027' por rollover de Date");
ok(mesCorto('septiembre') === 'septiembre',
    "texto libre degradado devuelve el texto crudo, nunca 'Invalid Date'");

// -- (11) El mensaje de exito sobrevive a la navegacion: alSalirBien ANTES de mostrarOk --
ok(/alSalirBien\(\);\s*mostrarOk\(/.test(jsShell),
    'el exito navega PRIMERO y muestra el mensaje DESPUES: limpiarAviso de irAVista ya paso');
ok(!/mostrarOk\(r\.mensaje[^\n]*;\s*alSalirBien\(\)/.test(jsShell),
    'no quedo el orden viejo (mostrarOk borrado en el mismo tick por irAVista)');

// -- (12) Los botones por bloque de recurrentes se deshabilitan mientras viaja --
ok(/typeof bt === 'string' \? document\.getElementById\(bt\) : bt/.test(jsShell),
    'enviar() acepta elementos ademas de ids: los botones por bloque no tienen id');
ok((jsShell.match(/\['recBtnVolcar', btn\]/g) || []).length === 2,
    'guardar Y borrar de cada bloque recurrente pasan SU boton a enviar (doble Enter bloqueado)');

// -- (13) Con el catalogo caido, los botones Agregar no tiran TypeError ni dejan DOM a medias --
ok(/function avisoSinCatalogo/.test(jsShell),
    'existe el aviso comun para el catalogo ausente');
ok((jsShell.match(/if \(!catalogo\) \{ avisoSinCatalogo\(\); return; \}/g) || []).length === 4,
    'movimiento, traspaso, proyeccion y recurrentes guardan la entrada si catalogo es null');

// -- (16) El catalogo ya no se tira despues de cada guardado (solo la declaracion queda) --
ok((jsShell.match(/catalogo = null/g) || []).length === 1,
    'cero invalidaciones del catalogo por guardado: nada de lo que el cliente consume cambia al guardar');

// -- (24) Los campos de un bloque colapsado salen del orden de Tab --
ok(/\.bloque\[data-estado="resumen"\] \.bloque-cuerpo > \.inner \{ visibility: hidden; \}/.test(HTML),
    'el cuerpo colapsado lleva visibility:hidden: sin paradas de foco invisibles ni Enter sobre botones ocultos');

// -- (25) El Mes de proyeccion tiene ancho para el anio --
const plantillaProy22 = (HTML.match(/var PLANTILLA_PROYECCION =[\s\S]*?';\n/) || [''])[0];
ok(plantillaProy22.indexOf('f c3') === -1 &&
   (plantillaProy22.match(/f c4/g) || []).length === 3,
    'proyeccion reparte 4+4+4: el Mes ya no recorta el anio ("septiembre de 2...")');

// -- (27) La tabla de conciliacion scrollea dentro de su card en vez de clipear Estado --
ok(/\.conc-card \{[^}]*overflow-x: auto/.test(HTML),
    'la conc-card scrollea horizontal por debajo de ~530px: la columna Estado siempre alcanzable');

// -- (28) Un solo separador de eco en toda la casa --
ok(!/join\(' - '\)/.test(jsShell),
    'el resumen de recurrentes usa el punto medio de toda la casa, no guion');

// -- (30) Los endpoints singulares sin llamadores se retiraron --
ok(typeof ctx.registrarMovimiento === 'undefined' && typeof ctx.registrarTraspaso === 'undefined',
    'registrarMovimiento y registrarTraspaso (singulares) ya no existen: cero llamadores medidos');

// -- (31) CSS muerto retirado (mismo estilo de guard que shell-pendiente) --
['\\.f\\.c7', '\\.f\\.c8', 'hint\\.fuerte', 'form-select', 'alert-info'].forEach(function (patron) {
    ok(!new RegExp(patron).test(sinComentarios),
        'sin rastro ejecutable de ' + patron.replace(/\\/g, '') + ': la regla muerta no volvio');
});

console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (22 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
