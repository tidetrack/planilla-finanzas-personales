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
        // El alert se CUENTA: la regresion que este banco tiene que impedir es que un flujo
        // del shell dispare UI nativa, que en un modal queda detras y el usuario no ve.
        getUi: () => ({
            showModalDialog: (h, titulo) => { if (ultimoModal) ultimoModal._titulo = titulo; },
            alert: (t) => { ctx._alertas.push(String(t)); }
        }),
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
    // CONTRATO REAL del nucleo (06_RegistrosService.js, v0.61.1): LANZA ante cualquier fallo
    // y devuelve {filas, fallbacks:{total, filasAfectadas, anclas}}. Antes este stub simulaba
    // que procesarCargas lanzaba -- cosa que el real NUNCA hacia, porque alertaba y se tragaba
    // el error --, asi que el verde de la seccion 8 no describia produccion. Ahora el stub y
    // el modulo real dicen lo mismo, y el camino de menu se prueba aparte (seccion 24).
    _procesarCargasNucleo() {
        if (ctx._procesarExplota) throw new Error('el lote fallo');
        ctx._loteProcesado = true;
        return { filas: 1, fallbacks: ctx._fallbacksFalsos ||
            { total: 0, filasAfectadas: 0, anclas: [] } };
    },
    _alertas: [],
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
    'abrirRecurrentes,abrirConciliacionNueva,abrirPlanCuentas,abrirProyeccionesElaboradas,'+
    'obtenerCatalogoShell,' +
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
    abrirConciliacionNueva: 'conciliacion', abrirPlanCuentas: 'cuentas',
    // EL PAR SINGULAR/PLURAL, probado a proposito de a dos: 'proyeccion' es la CARGA y
    // 'proyecciones' el ABM de lo guardado. Un typo en cualquiera de las dos puertas cae al
    // Home en silencio (comportamiento deliberado de _abrirShell), asi que el unico lugar
    // donde puede descubrirse el cruce es aca.
    abrirProyeccionesElaboradas: 'proyecciones'
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
ctx._loteProcesado = false; ctx._procesarExplota = false; ctx._alertas = [];
let r = ctx.procesarCargasDesdeShell();
ok(r.ok === true && ctx._loteProcesado === true, 'procesar delega en el nucleo y avisa que salio bien');
ok(/Se procesaron 1 fila\(s\)/.test(r.mensaje || ''),
    'y el exito trae mensaje propio: el cliente puede contar lo que entro');
ctx._procesarExplota = true;
r = ctx.procesarCargasDesdeShell();
ctx._procesarExplota = false;
ok(r.ok === false && /el lote fallo/.test(r.error || ''),
    'si el lote falla devuelve {ok:false, error} en vez de lanzar');
ok(ctx._alertas.length === 0,
    'y NO alerta: un alert nativo desde el shell queda detras del modal, invisible');
// Regla Estricta 9: el fallback de cotizacion no se silencia. Desde el menu lo dice un toast;
// desde el shell el toast queda tapado, asi que viaja en el mensaje de exito.
ctx._fallbacksFalsos = { total: 3, filasAfectadas: 2, anclas: [{}, {}] };
r = ctx.procesarCargasDesdeShell();
ctx._fallbacksFalsos = null;
ok(r.ok === true && /2 fila\(s\) quedaron con el TC de otra fecha/.test(r.mensaje || ''),
    'el fallback de TC viaja en el mensaje de exito del shell (Regla Estricta 9)');
// abrirAbmDesdeShell se retiro con la integracion del ABM al shell (v0.62.0): el Home ya no
// salta a otro modal, entra a la vista 'cuentas' con irAVista y sin round-trip.
ok(typeof ctx.abrirAbmDesdeShell === 'undefined',
    'abrirAbmDesdeShell ya no existe: el salto de modal a modal desaparecio');

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
ok(porId.cuentas && porId.cuentas.listo === true,
   'cuentas: el ABM del Plan es una vista mas, declarada lista (v0.62.0)');
ok(porId.cuentas.titulo === 'Plan de Cuentas',
   'y su titulo es el mismo rotulo que el item de menu, para que la banda no contradiga la ruta');
ok(porId.proyecciones && porId.proyecciones.listo === true,
   'proyecciones: el ABM de lo ya guardado es una vista mas, declarada lista (v0.63.0)');
ok(porId.proyecciones.titulo === 'Proyecciones Elaboradas',
   'y su titulo es el rotulo exacto del item de menu');
ok(porId.proyeccion.id !== porId.proyecciones.id &&
   porId.proyeccion.titulo === 'Proyeccion nueva',
   "el par 'proyeccion' (carga) / 'proyecciones' (ABM) convive con titulos que no se confunden");
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
    // Los DOS despachos dinamicos por literal: enviar() para el contrato {ok} del shell y
    // cuEnviar() para el contrato {success}/throw del ABM del Plan. Sin la segunda linea,
    // saveAbmRecord/updateAbmRecord/deleteAbmRecord quedan fuera del cruce contra el doble --
    // que es exactamente el drift que costo tres releases con registrarTraspasos.
    nombres(/enviar\(\s*'(\w+)'/g, HTML),
    nombres(/cuEnviar\(\s*'(\w+)'/g, HTML)));
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
// El NUCLEO del pipeline, simulado de punta a punta: mueve la grilla de Cargas al ledger y la
// limpia (lo que el real hace, reducido a lo que estas pruebas miden: el saldo resultante).
// Respeta el contrato real: lanza si ctx._nucleoExplota, y devuelve el resumen del lote.
ctx._nucleoLlamadas = 0;
ctx._procesarCargasNucleo = function () {
    ctx._nucleoLlamadas++;
    // Dos formas de romper: siempre, o recien en la N-esima tanda (para probar el corte a
    // mitad de un lote, que es donde el estado de la grilla deja de ser obvio).
    if (ctx._nucleoExplota ||
        (ctx._nucleoExplotaEnLlamada && ctx._nucleoLlamadas === ctx._nucleoExplotaEnLlamada)) {
        throw new Error('la cotizacion del dia no se pudo resolver');
    }
    const cfgC = ctx.RANGES.CARGAS;
    const cIni = col19(cfgC.start);
    const nC = col19(cfgC.end) - cIni + 1;
    const grilla = hojaCargas19.getRange(cfgC.dataRow, cIni, cfgC.filas, nC).getValues();
    const ic = (k) => col19(cfgC.columns[k]) - cIni;
    let filas = 0;
    grilla.forEach(function (f) {
        if (f[ic('monto')] === '' || f[ic('monto')] === null) return;
        const destino = hojaReg19.getLastRow() + 1;
        hojaReg19.getRange(destino, col19(cfgReg19.start), 1, HDR19.length).setValues([
            filaLedger(f[ic('monto')], f[ic('tipo')], f[ic('cuenta')], f[ic('medio')],
                f[ic('moneda')], new Date(String(f[ic('fecha')]) + 'T00:00:00'))
        ]);
        filas++;
    });
    hojaCargas19.getRange(cfgC.dataRow, cIni, cfgC.filas, nC).clearContent();
    return { filas: filas, fallbacks: ctx._fallbacksFalsos ||
        { total: 0, filasAfectadas: 0, anclas: [] } };
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
// v0.63.0: el rotulo dejo de ser "el ABM de X" y paso a ser la VISTA del shell, que ademas
// permite CORREGIR, no solo ver y borrar. El mensaje lo dice con el rotulo exacto del item de
// menu ("Proyecciones Elaboradas") y ubica la puerta ("en el inicio de tidetrack").
ok(/se ven, se corrigen y se borran desde Proyecciones Elaboradas/.test(rp.mensaje || ''),
    'el mensaje dice DONDE se ven, se corrigen y se borran: en Proyecciones Elaboradas');
ok(!/ABM de Proyecciones Elaboradas/.test(rp.mensaje || ''),
    'y ya NO habla de "el ABM": no hay un modal aparte al que mandar al usuario');

// GUARD DE CONTRATO CRUZADO (retiro selectivo, 2026-08-29): el literal 'shell_' vive duplicado
// a proposito en 16_ShellService.js (que lo escribe) y DEVTOOL_PresupuestoGuardar.js (que lo
// excluye del retiro via _esNotaShellPg) -- compartir la const cruzaria archivos en la carga
// alfabetica (cicatriz v0.50.1). Este guard es la UNICA red si alguien cambia un solo lado:
// se carga el PG real en un contexto propio y se cruza contra la nota que el shell ESCRIBIO.
{
    const ctxPg = { console, String, Number, Object, Array, Math, Date, isFinite, JSON };
    vm.createContext(ctxPg);
    vm.runInContext(leerSrc('src/DEVTOOL_PresupuestoGuardar.js') +
        '\n;globalThis.__esNotaShellPg = _esNotaShellPg;', ctxPg);
    ok(ctxPg.__esNotaShellPg(notaPg19) === true,
        'CONTRATO CRUZADO: la nota real que escribio _filaDeProyeccion ES shell para _esNotaShellPg (sobrevive al retiro de PG)');
    ok(ctxPg.__esNotaShellPg(ctx.PG_MARCA + ' 2026-09 2026-08-25_143000') === false,
        'CONTRATO CRUZADO: una nota con sello de _selloPg NO es shell (el retiro de PG si la alcanza)');
}

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
ok(/VISTAS_CON_PREPARADOR_PROPIO = \{ conciliacion: prepararConciliacion, cuentas: prepararCuentas,\s*\n?\s*proyecciones: prepararProyecciones \}/.test(HTML),
    'conciliacion, cuentas y proyecciones no pagan el costo del catalogo del Plan: mapa de preparadores propio');

// -- Plan de Cuentas (vista 'cuentas', v0.62.0) --
ok(/id="vista-cuentas"/.test(HTML) && /id="cuEntidad"/.test(HTML) &&
   /id="cuBtnGuardar"/.test(HTML) && /id="cuBtnBorrar"/.test(HTML),
    'la vista cuentas tiene selector de entidad, boton de guardar y boton de eliminar');
ok(/data-vista="cuentas" onclick="irAVista\('cuentas'\)"/.test(HTML),
    'la tarjeta "Gestionar cuentas" del Home entra a la VISTA, ya no reemplaza el modal');
ok(!/abrirAbm\(/.test(jsShell) && !/abrirAbmDesdeShell/.test(HTML),
    'no queda rastro del salto de modal a modal: ni abrirAbm() en el cliente ni el endpoint');
['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES', 'MEDIOS_PAGO'].forEach(function (e) {
    ok(new RegExp('value="' + e + '"').test(HTML), 'el selector ofrece ' + e);
});
ok(!/value="PROYECTOS"/.test(HTML),
    'PROYECTOS NO se ofrece: esa tabla es hoy el catalogo de Categorias y el servidor la rechaza');
ok(/id="dlAbmCuentas"/.test(HTML) && /list="dlAbmCuentas"/.test(HTML) &&
   !/list="dlCuentas"[^>]*id="cuBuscar"/.test(HTML),
    'el buscador usa su datalist PROPIO: dlCuentas mezcla entidades y no trae rowIndex');
ok(/function cuEnviar\(/.test(jsShell) && /\[fn\]\(datos\)/.test(jsShell),
    'la vista tiene sender propio: el contrato {success}/throw del ABM no cabe en enviar()');
// El contrato del servidor NO se normalizo: los cinco endpoints siguen viviendo en
// 11_UIService.js, sin wrapper en el shell que los traduzca a {ok}. Un wrapper ahi seria una
// segunda implementacion del ABM, y la planilla los invoca tambien por su nombre original.
const UISERVICE = leerSrc('src/11_UIService.js');
['getAbmFormData', 'getCategoryAccounts', 'saveAbmRecord', 'updateAbmRecord',
 'deleteAbmRecord'].forEach(function (fn) {
    ok(new RegExp('function ' + fn + '\\(').test(UISERVICE),
        fn + ' sigue declarado en 11_UIService.js, intacto');
    ok(!new RegExp('function ' + fn + '\\(').test(leerSrc('src/16_ShellService.js')),
        'y el shell NO lo duplica ni lo envuelve');
    ok(usadas.has(fn), 'el cliente llama a ' + fn + ' (endpoint reusado, cero backend nuevo)');
    ok(new RegExp(fn + ': function').test(DOBLE),
        'el doble implementa ' + fn + ' (metodo real, no solo whitelist)');
});
ok(/Confirmar baja/.test(HTML),
    'la baja pide un segundo click sobre el mismo boton: dos pasos, sin dialogo nativo');
// HINT VERAZ. updateRow escribe SOLO la fila del Plan: un renombre NO toca los movimientos ya
// registrados. El modal viejo afirmaba lo contrario ("los cambios afectaran al historial").
ok(/movimientos ya registrados conservan el nombre viejo/.test(HTML),
    'el hint del renombre dice la verdad: el historial conserva el nombre viejo');
ok(!/afectar/i.test((HTML.match(/id="cuHintRenombre"[\s\S]{0,240}/) || [''])[0]),
    'y no quedo copiado el updateAlert del modal, que prometia una cascada que el codigo no hace');
// EL ALIAS SE CONSERVA, no se borra: la botonera de dibujos publicada referencia
// showAbmPlanCuentas POR NOMBRE y no es editable ni auditable desde el repo. Lo que se
// verifica es que sea una linea que delega, no una segunda implementacion del modal.
ok(/function showAbmPlanCuentas\(\)\s*\{\s*abrirPlanCuentas\(\);\s*\}/.test(UISERVICE),
    'showAbmPlanCuentas quedo como alias de UNA linea hacia la puerta del shell');
ok(!/createTemplateFromFile\('UI_AbmPlanCuentas'\)/.test(UISERVICE) &&
   !/setWidth\(520\)/.test(UISERVICE),
    'y ya no crea la plantilla del modal viejo ni declara sus 520x750: el HTML queda huerfano');
ok(funcionesDeMenu(ctx.MENU_CONFIG.ITEMS, []).indexOf('showAbmPlanCuentas') === -1 &&
   funcionesDeMenu(ctx.MENU_CONFIG.ITEMS, []).indexOf('abrirPlanCuentas') !== -1,
    'el item de menu "Plan de Cuentas" apunta a la puerta nueva, no al alias');

// -- Proyecciones Elaboradas (vista 'proyecciones', v0.63.0) --
ok(/id="vista-proyecciones"/.test(HTML) && /id="pabmContenido"/.test(HTML),
    'la vista proyecciones existe y su contenido lo pinta el JS (un solo contenedor vacio)');
ok(/data-vista="proyecciones" onclick="irAVista\('proyecciones'\)"/.test(HTML),
    'la tarjeta del Home entra a la vista, sin round-trip ni salto de modal');
// EL STAGGER SE MIDE, NO SE LEE. La version anterior de este assert comprobaba dos reglas
// con :nth-of-type, que cuenta entre HERMANOS DEL MISMO TAG: como cada .shell-cards viene
// precedido por un .shell-sec, los grupos reales son los divs 2, 4, 6 y 8, la regla de la
// cuarta tarjeta no matcheaba NUNCA y cinco de las ocho entraban con delay 0s. El assert
// estaba en verde sobre CSS que no corria. Ahora se resuelve el delay de cada tarjeta
// emparejando el data-grupo del contenedor con su posicion, que es lo que el navegador hace.
{
    const cuerpoHome = (HTML.match(/<div id="vista-home"[\s\S]*?\n        <\/div>\s*\n    <\/div>/) ||
        [''])[0];
    const grupos = [...cuerpoHome.matchAll(
        /<div class="shell-cards[^"]*" data-grupo="(\d)">([\s\S]*?)\n        <\/div>/g)];
    ok(grupos.length === 4,
        'las cuatro secciones del Home declaran data-grupo (' + grupos.length + ' halladas)');
    const reglas = {};
    [...HTML.matchAll(
        /#vista-home \[data-grupo="(\d)"\] \.shell-card(?::nth-child\((\d)\))? \{ animation-delay: ([\d.]+)s; \}/g)
    ].forEach(m => { reglas[m[1] + ':' + (m[2] || '*')] = Number(m[3]); });
    const delays = [];
    grupos.forEach(function (g) {
        const n = (g[2].match(/<button class="shell-card/g) || []).length;
        for (let i = 1; i <= n; i++) {
            const d = reglas[g[1] + ':' + i];
            delays.push(d === undefined ? reglas[g[1] + ':*'] : d);
        }
    });
    ok(delays.length === 8, 'el Home tiene ocho tarjetas (' + delays.length + ')');
    ok(delays.every(d => typeof d === 'number'),
        'las OCHO resuelven un animation-delay: ninguna se queda en 0s por un selector que no matchea');
    ok(JSON.stringify(delays) === JSON.stringify([0.02, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 0.24]),
        'y el escalonado sigue el orden de lectura sin repetir ni saltear: ' + delays.join(' / '));
}
// La seccion "Revisar" tiene CUATRO tarjetas: en tres columnas la cuarta caia sola en una
// fila huerfana y su titulo se partia en dos lineas (la unica caja mas alta del Home).
ok(/<div class="shell-cards shell-cards--duo" data-grupo="3">/.test(HTML),
    '"Revisar" va a dos columnas: 2x2, sin fila huerfana y con los cuatro titulos en una linea');
ok(/\.shell-cards--duo \{ grid-template-columns: repeat\(auto-fit, minmax\(320px, 1fr\)\); \}/.test(HTML),
    'y lo hace subiendo el piso de la columna, no fijando 2: por debajo de ~652px baja sola a una');
['prepararProyecciones', 'pabmCargarListado', 'pabmRender', 'pabmTarjeta', 'pabmToggleDetalle',
 'pabmCargarDetalle', 'pabmRenderDetalle', 'pabmEditarMonto', 'pabmConfirmarEdicion',
 'pabmPedirBorrado', 'pabmConfirmarBorrado', 'pabmDeshacer', 'pabmErrorEnVista',
 'pabmFmtMonto', 'pabmFmtSello', 'pabmTotalDeFilas'].forEach(function (fn) {
    ok(new RegExp('function ' + fn + '\\(').test(jsShell), fn + '() existe en el cliente');
});
// Los SEIS endpoints se consumen intactos: ninguno vive envuelto ni duplicado en el shell.
['listarPeriodosProyeccion', 'detalleFilasPeriodoProyeccion', 'eliminarPeriodoProyeccion',
 'actualizarMontoFilaProyeccion', 'revertirBajaProyeccionAbm',
 'revertirEdicionMontoProyeccion'].forEach(function (fn) {
    ok(usadas.has(fn), 'el cliente llama a ' + fn + ' (endpoint reusado, cero backend nuevo)');
    ok(new RegExp(fn + ': function').test(DOBLE),
        'el doble implementa ' + fn + ' (metodo real, no solo whitelist)');
    ok(!new RegExp('function ' + fn + '\\(').test(leerSrc('src/16_ShellService.js')),
        'y el shell NO lo duplica ni lo envuelve');
});
// LA MAQUINARIA DEL MODAL VIEJO NO SE PORTO. Su causa raiz (el DOCTYPE en la linea 93, que
// metia al iframe en quirks mode) esta cerrada, y el shell ya demostro canal sano en el mismo
// timing. Reintroducir backoff sin medir seria volver a tratar el sintoma.
ok(!/pingProyeccionAbm/.test(HTML),
    'la vista NO pinguea antes de listar: el experimento de aislamiento del canal termino');
ok(!/REINTENTOS_ESPERA_MS/.test(HTML) && !/localStorage/.test(jsShell),
    'ni backoff ni historial de diagnostico en localStorage: una llamada y un boton Reintentar');
ok(/function prepararProyecciones\([\s\S]*?pabmCargarListado\(\)/.test(jsShell),
    'el listado se pide al ENTRAR a la vista (preparador propio), no al abrir el shell');
ok(/pabmAbiertos = \{\}/.test(jsShell) && /pabmUltimoRevert = null/.test(jsShell),
    'y sin cache entre entradas: la carga de proyeccion y el volcado escriben en la misma BD');
// El re-render completo tras cada mutacion es el contrato heredado del modal: nunca mostrar
// un total viejo. Las tres mutaciones vuelven a pedir el listado entero.
ok((jsShell.match(/pabmCargarListado\(\);/g) || []).length >= 4,
    'toda mutacion re-pide el listado completo: jamas se pintan totales desactualizados');
ok(/window\.alert/.test(jsShell) === false,
    'cero dialogos nativos: el fallo de una edicion sale por mostrarError, no por alert');
ok(/toLocaleString/.test(jsShell) === false,
    'el formato de plata es el de la casa (toFixed + coma), no el toLocaleString del modal');
ok(/aNumero\(crudo\)/.test(jsShell),
    'el monto tipeado se parsea con aNumero(): acepta la coma decimal es-AR, que el modal rechazaba');
ok(/Se puede deshacer justo /.test(HTML) && /por un total de/.test(HTML),
    'la confirmacion de baja dice CUANTO se borra y que la reversion dura un solo cambio');
ok(/PABM_MONEDAS_ORDEN\.indexOf/.test(jsShell),
    'ese total se ordena por moneda y nunca suma monedas distintas entre si (ADR-003)');
ok(/'guardado'/.test(jsShell) && /'shell'/.test(jsShell) && /'recurrentes'/.test(jsShell) &&
   /'base'/.test(jsShell) && /'otros'/.test(jsShell),
    'las cinco poblaciones del servidor tienen su seccion en la vista');
ok(/siempre: true/.test(jsShell) && /siempre: false/.test(jsShell),
    "la asimetria deliberada se conserva: 'guardado' y 'base' se ven aun vacias, las otras no");
ok(/msgVacio/.test(jsShell),
    'y las dos que se ven vacias traen su propio mensaje ("todo base, cero guardado" es produccion)');
ok(/pabm-nota/.test(HTML),
    'la nota libre del usuario se muestra APARTE del sello, bajo la cuenta');
ok(/\.btn--mini, \.alert \.btn \{ height: 32px; padding: 0 12px; font-size: 12px; \}/.test(HTML),
    'el boton chico mide 32px -- la misma altura que el de un aviso, que ahora es su otro ' +
    'consumidor: una sola escala 38/32, sin el escalon intermedio de 30');
ok(/\.alert \.btn \{ flex: 0 0 auto; align-self: center; \}/.test(HTML),
    'y la regla propia de .alert .btn quedo solo con su colocacion: la altura ya no se ' +
    'declara dos veces con dos valores distintos');
// EL ALIAS SE CONSERVA, igual que showAbmPlanCuentas y por la misma razon.
ok(/function showAbmProyeccionElaborada\(\)\s*\{\s*abrirProyeccionesElaboradas\(\);\s*\}/.test(UISERVICE),
    'showAbmProyeccionElaborada quedo como alias de UNA linea hacia la puerta del shell');
ok(!/createTemplateFromFile\('UI_AbmProyeccionElaborada'\)/.test(UISERVICE) &&
   !/setWidth\(720\)/.test(UISERVICE),
    'y ya no crea la plantilla del modal viejo ni declara sus 720x680: el HTML queda huerfano');
ok(funcionesDeMenu(ctx.MENU_CONFIG.ITEMS, []).indexOf('showAbmProyeccionElaborada') === -1 &&
   funcionesDeMenu(ctx.MENU_CONFIG.ITEMS, []).indexOf('abrirProyeccionesElaboradas') !== -1,
    'el item de menu "Proyecciones Elaboradas" apunta a la puerta nueva, no al alias');
// El icono duplicado de Conciliacion (era el mismo check que "Procesar Cargas", dos tarjetas
// mas arriba): dos iconos iguales en la misma seccion no distinguen nada.
ok(!/M20 6L9 17l-5-5/.test(HTML),
    'Conciliacion dejo de usar un check casi identico al de Procesar Cargas');

// ---- Correcciones del control adversarial del 2026-08-30 ----

// (1) EL AVISO VIEJO NO SOBREVIVE A LA OPERACION SIGUIENTE. Ninguna de las cuatro mutaciones
// limpiaba el aviso, asi que tras un error una operacion EXITOSA dejaba las dos cosas en
// pantalla: el banner rojo viejo arriba y el verde de deshacer abajo. Se cubre en el embudo.
{
    const cuerpoCargar = (jsShell.match(/function pabmCargarListado\(\)\s*\{([\s\S]*?)\n\}/) ||
        ['', ''])[1];
    ok(/^\s*(?:\/\/[^\n]*\n\s*)*limpiarAviso\(\);/.test(cuerpoCargar),
        'pabmCargarListado() arranca limpiando el aviso: es el embudo por el que pasan las ' +
        'tres mutaciones, el Reintentar y el ingreso a la vista');
}
['pabmConfirmarEdicion', 'pabmConfirmarBorrado', 'pabmDeshacer'].forEach(function (fn) {
    ok(new RegExp('function ' + fn + '\\([\\s\\S]*?pabmCargarListado\\(\\)').test(jsShell),
        fn + '() vuelve por el embudo, asi que hereda esa limpieza sin repetir la linea');
});
// La misma familia en 'cuentas': los dos cambios de CONTEXTO dejaban el aviso viejo
// describiendo otra entidad u otro modo.
['cuCambioEntidad', 'cuSegModo'].forEach(function (fn) {
    const cuerpo = (jsShell.match(new RegExp('function ' + fn + '\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}')) ||
        ['', ''])[1];
    ok(/limpiarAviso\(\);/.test(cuerpo),
        fn + '() limpia el aviso: cambiar de contexto no deja el mensaje anterior de rotulo');
});

// (2) LA COLUMNA DICE LO QUE ES. La celda imprime f.tipoCuenta -- la columna E de Registros --
// y el rotulo heredado del modal decia "Categoria", que en la vista 'cuentas' de la MISMA
// release significa el otro eje. Dos pantallas del shell contradiciendose en una palabra.
ok(/<th>Cuenta<\/th><th>Tipo de cuenta<\/th>/.test(HTML),
    'el detalle rotula la columna "Tipo de cuenta", el nombre literal de la columna E que muestra');
ok(!/<th>Categoria<\/th>/.test(HTML),
    'y no queda ningun encabezado "Categoria" sobre datos que no son categorias');

// (3) LAS RUTAS DE LOS ESTADOS VACIOS SON REPRODUCIBLES. No existe ningun boton "Guardar
// Proyeccion" en la hoja Presupuesto: el propio comentario de MENU_CONFIG lo dice. Se
// verifica contra el submenu vivo, no contra el texto de memoria.
{
    const subGuardar = ctx.MENU_CONFIG.DEV_ITEMS.filter(
        (x) => x.submenu === 'Presupuesto: guardar proyeccion')[0];
    ok(!!subGuardar, 'el submenu "Presupuesto: guardar proyeccion" existe en MENU_CONFIG');
    const rutaViva = ctx.MENU_CONFIG.DEV_MENU + ' > ' + subGuardar.submenu + ' > ' +
        subGuardar.items.filter((i) => /Aplicar/.test(i.name || ''))[0].name;
    ok(HTML.indexOf(rutaViva) !== -1,
        'la vista deriva del menu la ruta literal "' + rutaViva + '"');
    ok((HTML.match(new RegExp(rutaViva.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length >= 2,
        'y la dicen las DOS menciones: el hint de cabecera y el vacio de "Guardado a mano"');
}
ok(!/Guardar Proyeccion" desde la hoja Presupuesto/.test(HTML) &&
   !/\(Guardar Proyeccion, menu tidetrack Dev\)/.test(HTML),
    'ya no queda ninguna derivacion a un boton "Guardar Proyeccion" que la hoja no tiene');

// (4) UN NETO MIXTO NO SE IMPRIME CON DOS SIGNOS SEGUIDOS. Union por operador, no por ' + '.
{
    const fmt = new Function(
        (jsShell.match(/function pabmFmtMonto[\s\S]*?\n\}/) || [''])[0] + '\n' +
        (jsShell.match(/function pabmFmtLista[\s\S]*?\n\}/) || [''])[0] +
        '\nreturn pabmFmtLista;')();
    ok(fmt([{ monto: 1620000, moneda: 'ARS' }, { monto: -2.99, moneda: 'USD' }]) ===
        '1620000,00 ARS - 2,99 USD',
        'un neto mixto se lee "1620000,00 ARS - 2,99 USD", no "... + -2,99 USD"');
    ok(fmt([{ monto: -5, moneda: 'ARS' }, { monto: 3, moneda: 'USD' }]) === '-5,00 ARS + 3,00 USD',
        'el PRIMER item conserva su signo: un neto negativo sigue siendo negativo');
    ok(fmt([]) === '—', 'la lista vacia sigue siendo un guion largo, nunca un cero');
}

// (5) ACORDEON Y EDICION SE OPERAN CON TECLADO. Eran <div onclick> y <span onclick>: sin
// tabindex, sin role y sin estilo de foco, en la unica vista cuya funcion es corregir.
ok(/<button type="button" class="pabm-head" aria-expanded="false" /.test(HTML),
    'la cabecera de cada periodo es un <button> con aria-expanded, como .bloque-resumen');
ok(/<button type="button" class="pabm-monto" onclick="pabmEditarMonto\(this\)">/.test(HTML),
    'y el monto editable tambien es un <button>, no un <span> con onclick');
ok(!/<div class="pabm-head"/.test(HTML) && !/<span class="pabm-monto"/.test(HTML),
    'no queda ningun control de la vista fuera del orden de tabulacion');
ok(/\.pabm-head:focus-visible \{ outline: 2px solid var\(--teal-tinta\)/.test(HTML) &&
   /\.pabm-monto:focus-visible \{ outline: 2px solid var\(--teal-tinta\)/.test(HTML),
    'los dos tienen el mismo anillo de foco que .bloque-resumen: cero color nuevo');
ok(/headEl\.setAttribute\('aria-expanded', 'true'\)/.test(jsShell) &&
   /headEl\.setAttribute\('aria-expanded', 'false'\)/.test(jsShell),
    'aria-expanded lo mantiene sincronizado el toggle, no se queda mintiendo al plegar');

// (6) UN MEDIO DE PAGO SIN MONEDA NO SALE DEL CLIENTE. Si getAbmFormData falla o vence su
// tope, los desplegables quedan vacios y el backend acepta monedaRelacionada '' sin chistar:
// una cuenta sin moneda rompe ADR-002 y el autocompletado de moneda por medio en Cargas.
{
    const cuerpoGuardar = (jsShell.match(/function cuGuardar\(\)\s*\{([\s\S]*?)\n\}/) || ['', ''])[1];
    ok(/esMedio && !document\.getElementById\('cuMoneda'\)\.value/.test(cuerpoGuardar),
        'cuGuardar corta si es un medio de pago y la moneda quedo vacia');
    ok(cuerpoGuardar.indexOf('No se pudieron leer las monedas') <
       cuerpoGuardar.indexOf('var payload'),
        'y corta ANTES de armar el payload: el {monedaRelacionada:""} no llega a viajar');
}

// (7) CERO PALABRAS INTERNAS EN COPY DE USUARIO. El id de origen 'shell' es contrato con el
// backend y se conserva; el ROTULO no, porque en la UI esta ventana se llama tidetrack.
ok(!/'Manual del shell'/.test(jsShell) && !/\(manual del shell\)/.test(jsShell),
    'ningun rotulo visible dice "shell", la palabra con la que el equipo llama a la ventana');
ok(/titulo: 'Cargadas a mano en tidetrack'/.test(jsShell) &&
   /origen: 'shell'/.test(jsShell),
    'el rotulo cambio pero el id de origen "shell" queda intacto: es clave de contrato');

// (8) LOS TRES SELECTS CONSERVAN SU FLECHA AL ENFOCARSE. La regla de foco de .f reescribia el
// shorthand background y borraba la imagen; con appearance:none tampoco quedaba la nativa,
// asi que el control quedaba SIN NINGUN indicador justo mientras se lo estaba usando. Es la
// cicatriz v0.55.2 dada vuelta -- cero flechas en vez de dos -- y el guard de flechas de esta
// misma seccion no la veia porque solo auditaba .combo.
{
    const reglaSelect = (HTML.match(
        /\.f select\.form-input,\s*\n\.shell-acciones \.form-input \{([^}]*)\}/) || ['', ''])[1];
    const focoSelect = (HTML.match(
        /\.f select\.form-input:focus,\s*\n\.shell-acciones \.form-input:focus \{([^}]*)\}/) ||
        ['', ''])[1];
    ok(/appearance:\s*none/.test(reglaSelect) && /var\(--chevron\)/.test(reglaSelect),
        'los <select> del shell apagan la flecha nativa y dibujan el chevron de la casa');
    ok(/var\(--chevron\)/.test(focoSelect),
        'y el foco repone la IMAGEN, no solo el color: un shorthand background la borra');
    const offsets = [...(reglaSelect + focoSelect).matchAll(/right (\d+)px center/g)]
        .map((m) => m[1]);
    ok(offsets.length === 2 && offsets[0] === offsets[1],
        'las dos reglas usan el MISMO offset: la ley "una sola flecha" dejo de estar escrita ' +
        'dos veces con dos valores (' + offsets.join(' / ') + ')');
    ok((HTML.match(/appearance: none; -webkit-appearance: none; -moz-appearance: none;/g) || [])
            .length === 1,
        'la ley "una sola flecha por combo" se declara UNA vez: la barra de acciones dejo de ' +
        'tener su copia, que era la que podia divergir por separado (y divergio)');
    ok((HTML.match(/var\(--chevron\)/g) || []).length === 3,
        'y el chevron se referencia tres veces en total: base y foco del select, mas el combo');
    ok(!/\.f select\.form-input:focus \{ background-color: #FFFFFF; \}/.test(HTML),
        'y el parche que solo reponia el color quedo retirado');
}

// (9) EL CONFIRMAR DE UNA BAJA SE VE COMO UN BOTON. Vivia dentro de .pabm-conf, con el MISMO
// var(--rojo-bg) de fondo: contraste de relleno 1.00:1 y su unico filo 1.37:1, mientras el
// "Cancelar" de al lado era una pastilla blanca. En la unica accion irreversible de la vista
// la jerarquia estaba invertida.
ok(/\.btn--peligro, \.rec-borrar\[data-conf="1"\] \{\s*background: var\(--rojo-ink\); color: #FFFFFF;/
        .test(HTML),
    'el boton destructivo es SOLIDO (--rojo-ink sobre blanco: 5.89:1 de texto, 5.07:1 de ' +
    'relleno contra el panel), y lo comparte con el estado armado de .rec-borrar');
ok((HTML.match(/box-shadow: inset 0 0 0 1px rgba\(178,59,50,\.22\);/g) || []).length === 0,
    'y no quedo ninguna segunda forma de pintar el mismo boton destructivo confirmado');

// (10) EL SEGMENTADO NEUTRO LLEGA A AA. rgba(46,202,176,.14) sobre --tt-gris componia un
// #D8F1F0 efectivo: 4.38:1 contra --teal-tinta a 12.5px/600, el mas flojo de los cuatro
// estados presionados del mismo componente. El guard de paleta mira procedencia, no contraste.
ok(/\[data-v="Editar"\] \{\s*background: #FFFFFF; color: var\(--teal-tinta\);/.test(HTML),
    'el presionado neutro Crear/Editar es una pastilla BLANCA con los anillos teal: 5.18:1');
ok(!/\[data-v="Crear"\],\s*\n\.seg button\[aria-pressed="true"\]\[data-v="Editar"\] \{\s*background: rgba/
        .test(HTML),
    'y ningun estado presionado del segmentado se pinta con un relleno translucido: los cuatro ' +
    'apoyan sobre un fondo opaco con contraste medido');

// (11) LA PIEL DE VIDRIO SE DECLARA UNA VEZ. Estaba escrita palabra por palabra en tres
// reglas paralelas que habia que mantener sincronizadas a mano, y .pabm-meta/.pabm-chev eran
// copias byte a byte de .bloque-meta/.chev-abrir.
ok(/\.bloque, \.conc-card, \.pabm-card \{/.test(HTML),
    'la piel de vidrio es UNA lista de selectores, no tres reglas identicas');
ok((HTML.match(/box-shadow: inset 0 0 0 1px var\(--vidrio-borde\), var\(--vidrio-luz\), var\(--elev-agua\);/g)
        || []).length === 2,
    'el filo de vidrio queda en DOS reglas -- la tarjeta del Home y la lista compartida --, ' +
    'no en cuatro copias sincronizadas a mano');
['pabm-meta', 'pabm-chev', 'pabm-vacio', 'pabm-cargando'].forEach(function (cls) {
    ok(!new RegExp('class="[^"]*\\b' + cls + '\\b').test(HTML) &&
       !new RegExp('\\.' + cls + '[ ,{:]').test(HTML),
        'la clase .' + cls + ' se retiro: redibujaba un componente que el shell ya tenia ' +
        '(solo queda nombrada en el comentario que explica su retiro)');
});
ok(/<span class="bloque-meta">/.test(HTML) && /<svg class="chev-abrir"[\s\S]{0,400}M6 9l6 6 6-6/.test(HTML),
    'la tarjeta de periodo consume .bloque-meta y .chev-abrir, los componentes de la casa');
ok(/\.conc-hint--tenue \{ color: var\(--ink-3\); \}/.test(HTML) &&
   /class="conc-hint conc-hint--tenue"/.test(HTML),
    'y el parrafo auxiliar tenue es un modificador de .conc-hint, no dos clases nuevas');
ok(/El detalle NO se anima como \.bloque-cuerpo/.test(HTML),
    'la unica divergencia de motion que queda (el detalle no se pliega animado) tiene su razon inline');

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
// (retiro selectivo 2026-08-29) La advertencia "Ojo: ... reemplaza tambien estas proyecciones"
// se retiro del mensaje porque dejo de ser cierta: aplicarGuardarProyeccion excluye del retiro
// las notas con sello 'shell_' (_esNotaShellPg). El mensaje ahora apunta al ABM.
ok(!/Ojo:/.test(rp.mensaje || ''),
    'el mensaje ya NO advierte que Guardar Proyeccion reemplaza las puntuales: el retiro es selectivo');
ok(/Proyecciones Elaboradas, en el inicio de tidetrack/.test(rp.mensaje || ''),
    'y en su lugar dice donde se ven, se corrigen y se borran (la vista del shell)');

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

// -- (16) La regla EXACTA de invalidacion del catalogo (revisada en v0.62.0) --
// Las CARGAS no invalidan: escriben en la grilla, el ledger y los bloques TC, nunca en el
// Plan. Las MUTACIONES DEL PLAN si: sin eso, dar de alta una cuenta y pasar derecho a
// "Movimiento nuevo" ofrecia los desplegables viejos, justo sin la cuenta recien creada.
ok((jsShell.match(/catalogo = null/g) || []).length === 2,
    'catalogo = null aparece dos veces: la declaracion y la invalidacion tras mutar el Plan');
const cuTras = (jsShell.match(/function cuTrasMutacion\([\s\S]*?\n\}/) || [''])[0];
ok(/catalogo = null/.test(cuTras) && /abmCuentas = \[\]/.test(cuTras) &&
   /abmSeleccion = null/.test(cuTras),
    'el exito de alta/cambio/baja del Plan tira el catalogo, la lista y la seleccion');
['guardarMovimientos', 'guardarTraspasos', 'guardarProyecciones', 'guardarConciliacion',
 'guardarRecurrenteUI'].forEach(function (fn) {
    const cuerpo = (jsShell.match(new RegExp('function ' + fn + '\\([\\s\\S]*?\\n\\}')) || [''])[0];
    ok(cuerpo.length > 0 && !/catalogo = null/.test(cuerpo),
        fn + ' NO invalida el catalogo: no toca el Plan de Cuentas');
});

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

// -- (32) El hint de proyeccion cuenta la MISMA historia que el backend (retiro selectivo
//    2026-08-29): Guardar Proyeccion desde la hoja Presupuesto ya NO reemplaza lo cargado por
//    menu, y el hint dice donde se revisa/borra usando el rotulo EXACTO de MENU_CONFIG. --
ok(!/Presupuesto la reemplaza\./.test(HTML),
    'el hint de proyeccion ya no promete que Guardar Proyeccion "la reemplaza" (dejo de ser cierto)');
ok(/no la toca: conviven sumando/.test(HTML),
    'el hint dice la historia nueva: el guardado desde Presupuesto no toca lo cargado por menu');
ok(/Proyecciones Elaboradas, aca en tidetrack/.test(HTML),
    'el hint apunta a la VISTA con el rotulo exacto del item de MENU_CONFIG ("Proyecciones ' +
    'Elaboradas") y dice que vive aca adentro, no en otro modal del menu');

seccion('23. GUARD DE PALETA: el shell viste el brandbook, cero hex fuera de lista');
// decision Franco 2026-08-29: "esta quedando buenisimo de UX pero no son los colores de la
// marca. Ajusta colores." Los colores base son CINCO; todo tono intermedio es un derivado
// DECLARADO por la spec Corriente. Un hex que no este en esta lista es un color inventado
// (los grises #e2e5e9/#dadfe4 y familia, el navy viejo) y pone el banco en ROJO. Esta lista
// es la regla ejecutable: cada entrada dice de que deriva y para que sirve.
const PALETA = {
    // -- base (brandbook Tidetrack) --
    '#1E2A33': 'base: ink (texto primario, wordmark, icono del hero, texto del boton primario)',
    '#2ECAB0': 'base: teal de accion (degrade primario, filo de foco, punto del pie)',
    '#F4F7FA': 'base: gris de superficies secundarias (huecos, rieles, chips, tags)',
    '#FFB380': 'base: durazno decorativo (monograma, hairlines, radial calido)',
    '#FFFFFF': 'base: blanco (lienzo, fondo de foco, vidrio)',
    // -- derivados declarados (spec Corriente 2026-08-29) --
    '#44576A': 'ink-2: ink aclarado AA para secundaria y labels; deriva de #1E2A33',
    '#5A6B7C': 'ink-3: ink aclarado para placeholders y auxiliares; deriva de #1E2A33',
    '#0B7B69': 'teal-tinta: el UNICO teal que puede ser texto sobre blanco; deriva de #2ECAB0',
    '#29B89F': 'teal oscurecido: tramo bajo del degrade del boton primario y el chip hero; deriva de #2ECAB0',
    '#35D6BB': 'teal aclarado: hover del degrade primario; deriva de #2ECAB0',
    // -- semaforo: colores DE FUNCION, no de marca (pares ink/bg AA de la spec) --
    '#0E6B4F': 'verde de funcion, texto: Ingreso activo, pill +, aviso ok',
    '#DDF5EC': 'verde de funcion, riel del par anterior',
    '#B23B32': 'rojo de funcion, texto: Egreso activo, pill -, aviso error',
    '#FCEAE7': 'rojo de funcion, riel del par anterior',
    '#7A4A10': 'ambar de funcion, texto: advertencia, combo fuera de catalogo',
    '#FFF1E2': 'ambar de funcion, riel del par anterior'
};
// Se audita el <style> PROPIO del shell (el design system incluido tiene su propio pase),
// sin comentarios: se miran los hex que RENDERIZAN, no los que se documentan. Los data-URI
// llevan el hex como %23: se decodifica antes de extraer para que no se escape ninguno.
const estiloShell = (HTML.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
ok(estiloShell.length > 0, 'el <style> del shell se pudo aislar para auditarlo');
const cssPaleta = estiloShell.replace(/\/\*[\s\S]*?\*\//g, '').replace(/%23/gi, '#');
const normalizarHex = (h) => {
    let t = h.slice(1);
    if (t.length === 3) t = t.split('').map(c => c + c).join('');
    return '#' + t.toUpperCase();
};
const hexUsados = [...new Set((cssPaleta.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(normalizarHex))];
ok(hexUsados.length > 0, 'se extrajeron hex del estilo (' + hexUsados.length + ' distintos)');
const intrusos = hexUsados.filter(h => !(h in PALETA));
ok(intrusos.length === 0,
    'cada hex del shell esta en la lista blanca del brandbook' +
    (intrusos.length ? ' -- INTRUSOS: ' + intrusos.join(', ') : ''));
// La regla 2 de Franco tambien para rgba(): un gris intruso escrito como
// rgba(226,229,233,.5) no debe pasar en verde. Cada terna r,g,b de rgb()/rgba()
// se convierte a hex y pasa por la MISMA lista blanca (las ternas legales son
// los 5 base y los ink de funcion, todos ya declarados arriba en PALETA).
const ternasUsadas = [...new Set(
    (cssPaleta.match(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g) || []).map(function (t) {
        return '#' + t.match(/\d{1,3}/g)
            .map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
    })
)];
ok(ternasUsadas.length > 0,
    'se extrajeron ternas rgb de los rgba() del estilo (' + ternasUsadas.length + ' distintas)');
const ternasIntrusas = ternasUsadas.filter(h => !(h in PALETA));
ok(ternasIntrusas.length === 0,
    'cada rgba()/rgb() del shell deriva de un color de la lista blanca' +
    (ternasIntrusas.length ? ' -- INTRUSAS: ' + ternasIntrusas.join(', ') : ''));
// Y para keywords CSS de color en posicion de valor: un futuro 'color: navy'
// tampoco pasa. Los url(...) se excluyen (el stroke='white' de los data-URI de
// mask solo aporta alpha, no color); currentColor/transparent/inherit no son
// paleta sino mecanica, y quedan fuera de la lista negra a proposito.
const cssSinUrls = cssPaleta.replace(/url\([^)]*\)/g, 'url(_)');
const kwIntrusos = [...new Set(
    (cssSinUrls.match(/[:\s,(](white|black|navy|gray|grey|silver|red|blue|green|yellow|orange|purple|pink|brown|cyan|magenta|teal|aqua|lime|maroon|olive|coral|salmon|ivory|beige|khaki|gold|azure|snow|linen)(?![\w-])/gi) || [])
        .map(k => k.slice(1).toLowerCase())
)];
ok(kwIntrusos.length === 0,
    'ningun keyword CSS de color renderiza en el estilo del shell' +
    (kwIntrusos.length ? ' -- INTRUSOS: ' + kwIntrusos.join(', ') : ''));
// Sanidad inversa: la marca de verdad se USA (un shell gris que pasara la lista por no
// tener ningun hex tambien seria un shell sin marca).
['#1E2A33', '#2ECAB0', '#F4F7FA', '#FFB380', '#FFFFFF'].forEach(function (base) {
    ok(hexUsados.indexOf(base) !== -1, 'el color base ' + base + ' se usa de verdad en el estilo');
});
// La tipografia del brandbook: Poppins por <link> (la spec fija familia y pesos) y el
// token --font-family del shell la declara primera, con fallback que no cae a serif.
ok(/fonts\.googleapis\.com\/css2\?family=Poppins/.test(HTML),
    'la webfont que se carga es Poppins, la del brandbook');
ok(/--font-family:\s*'Poppins'/.test(cssPaleta),
    "--font-family arranca en 'Poppins': el * del design system la propaga a todo");

// LA SEGUNDA SUPERFICIE HTML DEL PRODUCTO. El shell no es la unica pantalla: hay HTML inline
// con su propio <style> adentro de src/*.js (hoy solo la alerta de edicion multiple de
// 14_EventHandlers.js). Esa alerta ya venia de dos redisenos atras con #dc3545 y League
// Spartan, y la Etapa 5 la restyleo a mano -- pero nada la sostenia: el proximo retoque podia
// volver a meter un hex inventado y los cinco bancos seguian en verde. Se audita con la MISMA
// lista blanca y el MISMO metodo que el shell.
// Se descartan los comentarios de bloque ANTES de buscar el <style>: ZZ_Changelog.js es un
// unico /* */ gigante y habla de HTML, de <style> y de la League Spartan que se retiro --
// documentar un color no es renderizarlo. Se auditan las superficies que SE PINTAN.
const jsConEstilo = fs.readdirSync(path.join(RAIZ, 'src'))
    .filter(f => f.endsWith('.js'))
    .map(f => ({ archivo: 'src/' + f, fuente: leerSrc('src/' + f).replace(/\/\*[\s\S]*?\*\//g, '') }))
    .filter(x => /<style>[\s\S]*?<\/style>/.test(x.fuente));
ok(jsConEstilo.length > 0,
    'hay al menos un src/*.js con <style> embebido para auditar (' +
    jsConEstilo.map(x => x.archivo).join(', ') + ')');
jsConEstilo.forEach(function (x) {
    const bloques = (x.fuente.match(/<style>([\s\S]*?)<\/style>/g) || [])
        .join('\n').replace(/%23/gi, '#');
    const hexJs = [...new Set((bloques.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(normalizarHex))];
    const intrusosJs = hexJs.filter(h => !(h in PALETA));
    ok(intrusosJs.length === 0,
        'cada hex del <style> de ' + x.archivo + ' esta en la lista blanca del brandbook' +
        (intrusosJs.length ? ' -- INTRUSOS: ' + intrusosJs.join(', ') : ''));
    const ternasJs = [...new Set(
        (bloques.match(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g) || []).map(function (t) {
            return '#' + t.match(/\d{1,3}/g)
                .map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
        })
    )].filter(h => !(h in PALETA));
    ok(ternasJs.length === 0,
        'cada rgba()/rgb() del <style> de ' + x.archivo + ' deriva de la lista blanca' +
        (ternasJs.length ? ' -- INTRUSAS: ' + ternasJs.join(', ') : ''));
    const kwJs = [...new Set(
        (bloques.replace(/url\([^)]*\)/g, 'url(_)')
            .match(/[:\s,(](white|black|navy|gray|grey|silver|red|blue|green|yellow|orange|purple|pink|brown|cyan|magenta|teal|aqua|lime|maroon|olive|coral|salmon|ivory|beige|khaki|gold|azure|snow|linen)(?![\w-])/gi) || [])
            .map(k => k.slice(1).toLowerCase())
    )];
    ok(kwJs.length === 0,
        'ningun keyword CSS de color renderiza en el <style> de ' + x.archivo +
        (kwJs.length ? ' -- INTRUSOS: ' + kwJs.join(', ') : ''));
    ok(!/League Spartan/.test(bloques) && /Poppins/.test(bloques),
        x.archivo + ' viste Poppins, no la League Spartan de dos redisenos atras');
});

seccion('24. El pipeline dejo de tragarse los errores: nucleo que lanza, menu que alerta');
// EL DEFECTO QUE CIERRA ESTA SECCION. procesarCargas tenia el alert adentro y no relanzaba:
// invocado desde el shell el aviso quedaba DETRAS del modal y el endpoint devolvia ok:true
// sobre un lote que no entro, o el sintoma confuso "la grilla quedo sin filas libres" en la
// tanda siguiente. Se probaron los tres caminos: nucleo que lanza, shell que lo convierte en
// {ok:false} sin UI nativa, y menu que sigue alertando exactamente igual que siempre.

// -- (a) El nucleo corta el lote y el error DICE en que estado quedo la grilla --
const cfgC24 = ctx.RANGES.CARGAS;
const cIni24 = col19(cfgC24.start);
const nC24 = col19(cfgC24.end) - cIni24 + 1;
hojaCargas19.getRange(cfgC24.dataRow, cIni24, cfgC24.filas, nC24).clearContent();
const hoy24 = new Date();
const iso24 = hoy24.getFullYear() + '-' + String(hoy24.getMonth() + 1).padStart(2, '0') +
    '-' + String(hoy24.getDate()).padStart(2, '0');
const movDe24 = (n) => ({ monto: n, tipo: 'Egreso', cuenta: 'Comidas', medio: 'Galicia',
    moneda: 'ARS', fecha: iso24 });

ctx._alertas = [];
ctx._nucleoExplota = true;
const ledgerAntes24 = hojaReg19.getLastRow();
r = ctx.registrarMovimientos([movDe24(11), movDe24(22)]);
ctx._nucleoExplota = false;
ok(r.ok === false, 'si el pipeline falla, la carga devuelve {ok:false} -- no un "Listo" mentiroso');
ok(/la cotizacion del dia no se pudo resolver/.test(r.error || ''),
    'el error del pipeline llega TEXTUAL al cliente, no traducido a un sintoma');
ok(/2 fila\(s\) escritas en la hoja de Cargas SIN procesar/.test(r.error || ''),
    'y dice en que estado quedo la grilla: las filas sembradas siguen ahi');
ok(/No se deshizo nada/.test(r.error || ''),
    'sin inventar un rollback que el codigo nunca tuvo: lo declara');
ok(ctx._alertas.length === 0, 'cero alerts nativos: desde el shell quedarian detras del modal');
ok(hojaReg19.getLastRow() === ledgerAntes24, 'y el ledger no gano una sola fila');
const grilla24 = ctx._estadoGrillaCargas(hojaCargas19);
ok(grilla24.ocupadas === 2,
    'las 2 filas del lote quedaron EN la grilla, tal como lo dice el mensaje (' +
    grilla24.ocupadas + ' ocupadas)');
hojaCargas19.getRange(cfgC24.dataRow, cIni24, cfgC24.filas, nC24).clearContent();

// -- (b) Corte a MITAD de un lote por tandas: lo que entro, lo que no, y lo que quedo colgado --
const lote24 = [];
for (let i = 0; i < cfgC24.filas + 3; i++) lote24.push(movDe24(100 + i));
ctx._nucleoLlamadas = 0;
ctx._nucleoExplotaEnLlamada = 2;      // la primera tanda entra, la segunda revienta
const ledgerAntesTanda24 = hojaReg19.getLastRow();
r = ctx.registrarMovimientos(lote24);
ctx._nucleoExplotaEnLlamada = 0;
ok(r.ok === false, 'un corte en la segunda tanda tambien devuelve {ok:false}');
ok(new RegExp('Los ' + cfgC24.filas + ' primeros movimientos ya entraron al ledger')
        .test(r.error || ''),
    'el mensaje nombra los que YA se persistieron: reintentar el lote entero los duplicaria');
ok(/3 fila\(s\) escritas en la hoja de Cargas SIN procesar/.test(r.error || ''),
    'y cuantas quedaron colgadas en la grilla');
ok(hojaReg19.getLastRow() - ledgerAntesTanda24 === cfgC24.filas,
    'el ledger gano exactamente la primera tanda, ni una fila mas');
ok(ctx._alertas.length === 0, 'tampoco aca hay UI nativa');
hojaCargas19.getRange(cfgC24.dataRow, cIni24, cfgC24.filas, nC24).clearContent();

// -- (c) Traspasos: la unidad es el PAR, y el mensaje cuenta filas de grilla --
ctx._nucleoExplota = true;
r = ctx.registrarTraspasos([{ origen: 'Galicia', destino: 'Dolar Cash',
    montoOrigen: 100, montoDestino: 0.1, fecha: iso24 }]);
ctx._nucleoExplota = false;
ok(r.ok === false && /2 fila\(s\) escritas/.test(r.error || ''),
    'un traspaso cortado deja DOS filas en la grilla (las dos patas) y el mensaje lo dice');
ok(ctx._alertas.length === 0, 'y sigue sin alertar');
hojaCargas19.getRange(cfgC24.dataRow, cIni24, cfgC24.filas, nC24).clearContent();

// -- (d) Conciliacion: hereda el nucleo por _registrarMovimientosSinLock --
ctx._nucleoExplota = true;
const scConc24 = ctx.obtenerSaldosConciliacion();
const gal24 = scConc24.saldos.filter(x => x.medio === 'Galicia')[0];
r = ctx.registrarConciliacion([{ medio: 'Galicia', saldoVisto: gal24.saldo,
    saldoReal: gal24.saldo + 500 }]);
ctx._nucleoExplota = false;
ok(r.ok === false && /hoja de Cargas SIN procesar/.test(r.error || ''),
    'la conciliacion propaga el mismo error explicado, en vez de "quedo en X en vez de Y"');
ok(ctx._alertas.length === 0, 'y tampoco alerta');
hojaCargas19.getRange(cfgC24.dataRow, cIni24, cfgC24.filas, nC24).clearContent();

// -- (e) GUARD: ningun flujo del shell puede volver a llamar a la version de menu --
const fuenteShell24 = leerSrc('src/16_ShellService.js');
ok(!/^\s*procesarCargas\(\);\s*$/m.test(fuenteShell24),
    'el shell ya NO llama a procesarCargas() (la entrada de menu, que alerta y se traga el error)');
ok((fuenteShell24.match(/_procesarCargasNucleo\(/g) || []).length >= 3,
    'los tres caminos de escritura del shell pasan por el nucleo');

// -- (f) EL CAMINO DE MENU, sin tocar: atrapa, alerta y NO propaga --
// Se carga el modulo real en un contexto propio (el banco del shell no lo carga) para probar
// el wrapper contra el codigo de verdad, no contra una copia de sus mensajes.
{
    const alertasMenu = [];
    const ctxMenu = {
        console, Date, Math, Number, String, Array, Object, isFinite, JSON, RegExp, Error,
        logError() {}, logInfo() {}, logSuccess() {},
        Logger: { log() {} },
        SpreadsheetApp: {
            getActiveSpreadsheet: () => ({ getSheets: () => [], getSheetByName: () => null,
                                           toast() {} }),
            getUi: () => ({ alert: (t) => { alertasMenu.push(String(t)); } })
        }
    };
    vm.createContext(ctxMenu);
    vm.runInContext(
        leerSrc('src/00_Config.js') + '\n' +
        leerSrc('src/03_SheetManager.js') + '\n' +
        leerSrc('src/06_RegistrosService.js') +
        '\n;Object.assign(globalThis,{__procesarCargas: procesarCargas,' +
        ' __nucleo: _procesarCargasNucleo, __MSJ: REG_MSJ_FALTAN_HOJAS});',
        ctxMenu
    );
    // Sin hojas: el nucleo LANZA (antes era un alert + return silencioso).
    let lanzo = false;
    try { ctxMenu.__nucleo(); } catch (e) { lanzo = true; }
    ok(lanzo === true, 'el nucleo LANZA cuando faltan las hojas, en vez de alertar y volver');
    // El menu, en cambio, atrapa y alerta con el MISMO texto de siempre.
    let propago = false;
    try { ctxMenu.__procesarCargas(); } catch (e) { propago = true; }
    ok(propago === false, 'procesarCargas() de menu NO propaga: el habito diario no cambia');
    ok(alertasMenu.length === 1 && alertasMenu[0] === ctxMenu.__MSJ,
        'y alerta textual "' + ctxMenu.__MSJ + '", sin el prefijo "Fallo en el procesamiento"');
}

console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (24 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
