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
const _propsStore = {};
const propsFalsas = {
    setProperty: (k, v) => { _propsStore[k] = String(v); },
    getProperty: (k) => (k in _propsStore ? _propsStore[k] : null),
    deleteProperty: (k) => { delete _propsStore[k]; },
    getKeys: () => Object.keys(_propsStore),
    getProperties: () => Object.assign({}, _propsStore)
};

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
    // Almacen de propiedades DE VERDAD: 18_RespaldoService guarda ahi los respaldos y un
    // stub que traga las escrituras haria pasar en verde un respaldo que no existe.
    PropertiesService: { getDocumentProperties: () => propsFalsas },
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
    fs.readFileSync(path.join(RAIZ, 'src/17_RecurrentesService.js'), 'utf8') + '\n' +
    // 18_RespaldoService: aporta _conHojaActivaPreservada, que 17_ usa en runtime para su
    // unica creacion de hoja. Carga DESPUES de 17_, igual que en Apps Script.
    fs.readFileSync(path.join(RAIZ, 'src/18_RespaldoService.js'), 'utf8') +
    '\n;Object.assign(globalThis,{SHELL_VISTAS,SHELL_GEOMETRIA,SHELL_VISTA_DEFECTO,_abrirShell,' +
    'abrirTidetrack,abrirMovimientoNuevo,abrirTraspasoNuevo,abrirProyeccionNueva,' +
    'abrirRecurrentes,abrirConciliacionNueva,abrirPlanCuentas,abrirProyeccionesElaboradas,'+
    'obtenerCatalogoShell,' +
    'procesarCargasDesdeShell,diagnosticarShell,_validarMovimiento,_estadoGrillaCargas,_filaDeCarga,_plata,TIPOS_RIQUEZA,columnLetterToIndex,RANGES,SHEETS,MENU_CONFIG,CUENTAS_NEUTRAS,MONEDAS_DISPONIBLES,' +
    'SHELL_CONC_TOLERANCIA,CUENTA_AJUSTE,CUENTA_ARRASTRE,REC_MARCA,REC_ACTIVO_SI,REC_ACTIVO_NO,REC_MESES,' +
    'REC_HORIZONTE_MESES,REC_HEADERS,obtenerRecurrentes,guardarRecurrente,borrarRecurrente,' +
    'sincronizarRecurrentes,estadoHorizonteRecurrentes,_recPosterioresRec,' +
    '_clavesVentanaRec,_correEnMesRec,_claveVigenciaRec,_vigenciaValidaRec,_filasRecEnClaves,' +
    '_conHojaActivaPreservada});',
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
            // updateRow (03_SheetManager) llama getRange en notacion A1 ('B7:K7'). El mock no la
            // soportaba y devolvia col=NaN: la EDICION de un recurrente reventaba en el banco por
            // una limitacion del doble, no del producto. Se traduce a fila/col/nf/nc.
            if (typeof fila === 'string') {
                const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(fila);
                if (!m) throw new Error('notacion A1 no soportada por el mock: ' + fila);
                const aCol = (L) => L.split('').reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0);
                col = aCol(m[1]);
                nf = Number(m[4]) - Number(m[2]) + 1;
                nc = aCol(m[3]) - col + 1;
                fila = Number(m[2]);
            }
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
                copyTo: function () { /* formato: no aplica en el banco */ },
                setNumberFormat: function () { /* formato: no aplica en el banco */ }
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
// La traza registra el ORDEN de las operaciones de la unica creacion de hoja: es lo que hace
// medible que el foco vuelva y la hoja se oculte ANTES de la primera escritura.
const trazaHojas = [];
let hojaActivaFalsa = null;
const ssFalsa = {
    getName: () => 'PLANILLA FALSA',
    getSheets: () => Object.keys(hojasFalsas).map(n => hojasFalsas[n]),
    getSheetByName: (n) => hojasFalsas[n] || null,
    getActiveSheet: () => hojaActivaFalsa,
    setActiveSheet: (h) => { trazaHojas.push('setActiveSheet'); hojaActivaFalsa = h; return h; },
    insertSheet: (n) => {
        trazaHojas.push('insertSheet');
        const h = hojaFalsa(n);
        const setValuesReal = h.getRange;
        h.getRange = function (f, c, nf, nc) {
            const r = setValuesReal.call(h, f, c, nf, nc);
            const sv = r.setValues, sV = r.setValue;
            if (sv) r.setValues = function (v) { trazaHojas.push('escribir'); return sv.call(r, v); };
            if (sV) r.setValue = function (v) { trazaHojas.push('escribir'); return sV.call(r, v); };
            return r;
        };
        const hideReal = h.hideSheet;
        h.hideSheet = function () { trazaHojas.push('hideSheet'); return hideReal.call(h); };
        hojasFalsas[n] = h;
        hojaActivaFalsa = h;
        return h;
    },
    deleteSheet: (h) => { trazaHojas.push('deleteSheet'); delete hojasFalsas[h.getName()]; }
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

// --- Recurrentes: HORIZONTE RODANTE CON VIGENCIA (v0.64.0) ---
let lr = ctx.obtenerRecurrentes();
ok(lr.ok === true && lr.recurrentes.length === 0,
    'obtenerRecurrentes con hoja ausente devuelve lista vacia SIN lanzar (leer no crea la hoja)');
const recBase19 = { nombre: 'Netflix', cuenta: 'Comidas', monto: 5000, moneda: 'ARS',
    medio: 'Galicia', dia: 5, nota: '', activo: 'Si', desde: '', hasta: '' };
let gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { cuenta: ctx.CUENTAS_NEUTRAS[0] }));
ok(gr.ok === false && /comodin del sistema/.test((gr.problemas || []).join(' ')),
    'una cuenta comodin no puede ser recurrente');
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { dia: 0 }));
ok(gr.ok === false, 'dia 0 se rechaza');
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { dia: 32 }));
ok(gr.ok === false, 'dia 32 se rechaza');
// VIGENCIA: formato y orden.
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { desde: 'el mes que viene' }));
ok(gr.ok === false && /"Desde"/.test((gr.problemas || []).join(' ')), 'un "Desde" que no es un mes se rechaza');
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { hasta: '2026-13' }));
ok(gr.ok === false && /"Hasta"/.test((gr.problemas || []).join(' ')), 'un mes 13 en "Hasta" se rechaza');
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { desde: '2027-01', hasta: '2026-12' }));
ok(gr.ok === false && /no puede ser anterior/.test((gr.problemas || []).join(' ')),
    'un "Hasta" anterior al "Desde" se rechaza nombrando los dos meses');

const trazaAntesRec = trazaHojas.length;
gr = ctx.guardarRecurrente(recBase19);
ok(gr.ok === true, 'un recurrente valido se guarda: ' + (gr.error || (gr.problemas || []).join('; ') || 'ok'));
ok(!!hojasFalsas[ctx.SHEETS.RECURRENTES] && hojasFalsas[ctx.SHEETS.RECURRENTES]._oculta === true,
    'la hoja se creo en el primer guardado y quedo OCULTA');
// LA REGLA DE LA UNICA CREACION, medida por ORDEN y no por resultado: el foco vuelve y la hoja
// se oculta ANTES de la primera escritura. Antes se ocultaba DESPUES de verificar, y el flush de
// esa verificacion ya habia empujado al cliente la pestania visible y activa.
{
    const t = trazaHojas.slice(trazaAntesRec);
    const iInsert = t.indexOf('insertSheet');
    const iFoco = t.indexOf('setActiveSheet');
    const iHide = t.indexOf('hideSheet');
    const iEscribir = t.indexOf('escribir');
    ok(iInsert === 0, 'la traza de la creacion arranca con insertSheet, dio ' + JSON.stringify(t.slice(0, 5)));
    ok(iFoco > iInsert && iFoco < iHide, 'el foco se repone DESPUES de insertSheet y ANTES de hideSheet');
    ok(iHide < iEscribir, 'hideSheet ocurre ANTES de la primera escritura de celdas');
}
lr = ctx.obtenerRecurrentes();
ok(lr.ok === true && lr.recurrentes.length === 1 && lr.recurrentes[0].activo === true &&
   lr.recurrentes[0].desde === '' && lr.recurrentes[0].hasta === '',
    'la lectura devuelve el recurrente con activo booleano y la vigencia vacia (desde siempre / sin fin)');
ok(ctx.REC_HEADERS.length === 10 && ctx.REC_HEADERS[8] === 'Desde' && ctx.REC_HEADERS[9] === 'Hasta',
    'la hoja tiene las dos columnas de vigencia en el header');

// FASE 2: guardar un recurrente YA sincroniza el horizonte. No hay boton de volcado ni mes.
const ventana19 = ctx._clavesVentanaRec();
const filasRecEnVentana = () => ctx._filasRecEnClaves(hojaProy19, ventana19).length;
ok(gr.sincronizado === true, 'guardar dispara la SEGUNDA FASE y la declara (sincronizado:true)');
ok(filasRecEnVentana() === ctx.REC_HORIZONTE_MESES,
    'el horizonte quedo lleno: una fila por cada uno de los ' + ctx.REC_HORIZONTE_MESES +
    ' meses, dio ' + filasRecEnVentana());
ok(ventana19.length === ctx.REC_HORIZONTE_MESES, 'la ventana tiene REC_HORIZONTE_MESES claves');

// IDEMPOTENCIA: dos corridas seguidas sin cambios dejan el MISMO estado, no el doble.
let sr = ctx.sincronizarRecurrentes();
ok(sr.ok === true && filasRecEnVentana() === ctx.REC_HORIZONTE_MESES,
    'sincronizar dos veces deja N filas, no 2N (idempotente por ventana): ' + (sr.error || sr.mensaje));

// EL INVARIANTE DURO: nunca se escribe ni se borra antes del mes en curso.
const clavePasada19 = '2020-01';
const notaPasada19 = ctx.REC_MARCA + ' ' + clavePasada19 + ' 2020-01-05_090000 - Netflix';
{
    const destino = hojaProy19.getLastRow() + 1;
    const filaP = new Array(col19(cfgReg19.end) - col19(cfgReg19.start) + 1).fill('');
    filaP[col19(cfgReg19.columns.monto) - col19(cfgReg19.start)] = 5000;
    filaP[col19(cfgReg19.columns.moneda) - col19(cfgReg19.start)] = 'ARS';
    filaP[col19(cfgReg19.columns.fecha) - col19(cfgReg19.start)] = new Date(2020, 0, 5);
    filaP[col19(cfgReg19.columns.nota) - col19(cfgReg19.start)] = notaPasada19;
    hojaProy19.getRange(destino, col19(cfgReg19.start), 1, HDR19.length).setValues([filaP]);
}
ctx.sincronizarRecurrentes();
ok(notasProy19().indexOf(notaPasada19) !== -1,
    'INVARIANTE: una fila REC de un mes ANTERIOR al mes en curso sobrevive intacta a la sincronizacion');

ok(notasProy19().filter(n => n.indexOf(ctx.PG_MARCA) === 0).length === 1,
    'las filas PG NO se tocaron: los recurrentes son aditivos');

// VIGENCIA: "Hasta" saca al recurrente de los meses posteriores, sin tocar los anteriores.
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { hasta: ventana19[2] }));
ok(gr.ok === true && filasRecEnVentana() === 3,
    'con Hasta = el tercer mes de la ventana, el horizonte queda con 3 filas, dio ' + filasRecEnVentana());
// PAUSADO: sale de TODO el horizonte futuro, pero la regla no se pierde.
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { activo: 'No' }));
ok(gr.ok === true && filasRecEnVentana() === 0, 'pausado sale del horizonte entero, dio ' + filasRecEnVentana());
ok(ctx.obtenerRecurrentes().recurrentes.length === 1, 'y la regla sigue en la BD: pausar no borra');
gr = ctx.guardarRecurrente(recBase19);
ok(gr.ok === true && filasRecEnVentana() === ctx.REC_HORIZONTE_MESES,
    'reactivarlo repone el horizonte completo (la pausa es reversible sin perder fechas)');

// REGLA ESTRICTA 9: si la API de FX cae, no se escribe una sola celda.
ctx._fxExplota = true;
sr = ctx.sincronizarRecurrentes();
ctx._fxExplota = false;
ok(sr.ok === false && /API caida/.test(sr.error || '') && filasRecEnVentana() === ctx.REC_HORIZONTE_MESES,
    'si la API de FX cae, la sincronizacion corta SIN escribir y SIN tocar el horizonte previo');

// FASE 2 FALLIDA: el recurrente NO se pierde, y se avisa con la razon exacta.
ctx._fxExplota = true;
gr = ctx.guardarRecurrente(Object.assign({}, recBase19, { monto: 7777 }));
ctx._fxExplota = false;
ok(gr.ok === true && gr.sincronizado === false && /API caida/.test(gr.aviso || ''),
    'fase 2 caida: ok:true + sincronizado:false + aviso con la razon, dio ' + JSON.stringify({ ok: gr.ok, s: gr.sincronizado, a: gr.aviso }));
ok(ctx.obtenerRecurrentes().recurrentes[0].monto === 7777,
    'y el recurrente quedo guardado igual: la API caida no le hace perder el dato al usuario');
ctx.sincronizarRecurrentes();

// LA VERIFICACION DE VIGENCIA FALLA: el ok:false NO puede dejar la BD cambiada (2026-08-30).
// Antes se devolvia el error con la fila YA ESCRITA y sin correr la fase 2: el usuario veia un
// fallo, el recurrente quedaba en la hoja y la proyeccion no se sincronizaba -- un estado a
// medias que el mensaje ni nombraba. Se fuerza el desvio haciendo mentir a la relectura, que es
// exactamente lo que pasa en la planilla si la celda J o K quedo como Date en vez de texto.
{
    const realObtener = ctx.obtenerRecurrentes;
    const mentir = function () {
        const r = realObtener();
        if (r.ok) r.recurrentes.forEach(function (x) { x.hasta = '1999-01'; });
        return r;
    };

    // (a) EDICION: la fila anterior se repone tal cual.
    const antesEdicion = JSON.parse(JSON.stringify(realObtener().recurrentes));
    ctx.obtenerRecurrentes = mentir;
    let gv = ctx.guardarRecurrente(Object.assign({}, recBase19, { monto: 31337 }));
    ctx.obtenerRecurrentes = realObtener;
    ok(gv.ok === false && /no quedo como se escribio/.test(gv.error || ''),
        'una vigencia que no verifica devuelve ok:false, dio: ' + (gv.error || '').slice(0, 80));
    ok(/se repuso como estaba antes/.test(gv.error || ''),
        'y el mensaje DICE en que estado quedo la hoja, no lo deja implicito');
    const despuesEdicion = realObtener().recurrentes;
    ok(JSON.stringify(despuesEdicion) === JSON.stringify(antesEdicion),
        'la BD quedo EXACTAMENTE como estaba (monto ' + despuesEdicion[0].monto + ', no 31337)');

    // (b) ALTA: el alta se quita entera, no queda un recurrente fantasma.
    const cuantosAntes = realObtener().recurrentes.length;
    ctx.obtenerRecurrentes = mentir;
    gv = ctx.guardarRecurrente(Object.assign({}, recBase19, { nombre: 'Fantasma', monto: 999 }));
    ctx.obtenerRecurrentes = realObtener;
    ok(gv.ok === false && /NO quedo guardado/.test(gv.error || ''),
        'un ALTA que no verifica se retira y el mensaje lo dice, dio: ' + (gv.error || '').slice(-70));
    const nombresDespues = realObtener().recurrentes.map(function (x) { return x.nombre; });
    ok(realObtener().recurrentes.length === cuantosAntes && nombresDespues.indexOf('Fantasma') === -1,
        'y "Fantasma" no quedo en la hoja: ' + JSON.stringify(nombresDespues));
}

// ESTADO DEL HORIZONTE: solo lectura, no escribe, y dice si quedo corto.
let eh19 = ctx.estadoHorizonteRecurrentes();
ok(eh19.ok === true && eh19.desincronizado === false && eh19.mesesFaltantes.length === 0,
    'estadoHorizonteRecurrentes: al dia despues de sincronizar');
ok(eh19.ventana.desde === ventana19[0] && eh19.ventana.hasta === ventana19[ventana19.length - 1],
    'la ventana informada es la real');
ok(eh19.activos === 1 && eh19.pausados === 0 && eh19.filasEnVentana === ctx.REC_HORIZONTE_MESES,
    'informa activos, pausados y filas en ventana');
{
    // Se saca una fila a mano: el estado tiene que verlo y NO arreglarlo solo.
    const filasV = ctx._filasRecEnClaves(hojaProy19, ventana19);
    hojaProy19.deleteRows(filasV[0], 1);
    const antesDeMedir = filasRecEnVentana();
    eh19 = ctx.estadoHorizonteRecurrentes();
    ok(eh19.desincronizado === true && eh19.mesesFaltantes.length === 1,
        'si el horizonte quedo corto, el estado lo dice (mesesFaltantes)');
    ok(filasRecEnVentana() === antesDeMedir, 'y NO escribe nada al medir: leer no vuelca');
    ctx.sincronizarRecurrentes();
}

{
    // LO QUE QUEDO FUERA DE LA VENTANA HACIA ADELANTE (2026-08-30). El modelo viejo dejaba
    // volcar a cualquier mes entre 2024 y 2100, asi que una planilla real puede tener filas REC
    // en meses lejanos. El horizonte rodante NO las toca -- _escribirClavesRec no toca una fila
    // fuera de sus claves, jamas -- pero la proyeccion las sigue sumando aunque la vigencia diga
    // otra cosa. Hasta esta version nada las denunciaba. Se siembra una en ventana+13.
    const lejano = new Date();
    const dLejano = new Date(lejano.getFullYear(), lejano.getMonth() + ctx.REC_HORIZONTE_MESES + 1, 1);
    const claveLejana = dLejano.getFullYear() + '-' + String(dLejano.getMonth() + 1).padStart(2, '0');
    const cfgP19 = ctx.RANGES.REGISTROS;
    const anchoP19 = col19(cfgP19.end) - col19(cfgP19.start) + 1;
    const filaLejana = new Array(anchoP19).fill('');
    filaLejana[col19(cfgP19.columns.monto) - col19(cfgP19.start)] = 12345;
    filaLejana[col19(cfgP19.columns.moneda) - col19(cfgP19.start)] = 'ARS';
    filaLejana[col19(cfgP19.columns.fecha) - col19(cfgP19.start)] = new Date(dLejano.getFullYear(), dLejano.getMonth(), 5);
    filaLejana[col19(cfgP19.columns.nota) - col19(cfgP19.start)] =
        ctx.REC_MARCA + ' ' + claveLejana + ' 2026-01-01_000000 - Volcado viejo';
    hojaProy19.getRange(hojaProy19.getLastRow() + 1, col19(cfgP19.start), 1, anchoP19).setValues([filaLejana]);

    const antesSync = hojaProy19.getLastRow();
    const srLejano = ctx.sincronizarRecurrentes();
    ok(srLejano.ok === true, 'la sincronizacion corre con una fila REC fuera de la ventana: ' + (srLejano.error || 'ok'));
    ok(ctx._recPosterioresRec(hojaProy19, ventana19[ventana19.length - 1]).filas === 1,
        'y la fila lejana SOBREVIVE: el horizonte no toca nada fuera de sus claves');
    ok(hojaProy19.getLastRow() >= antesSync - ctx.REC_HORIZONTE_MESES,
        'la hoja no se vacio: la fila lejana sigue contada en el total');

    const ehLejano = ctx.estadoHorizonteRecurrentes();
    ok(ehLejano.sobrantes === 1 && (ehLejano.mesesSobrantes || [])[0] === claveLejana,
        'el estado la REPORTA como sobrante y nombra su mes (' + claveLejana + '), dio ' +
        JSON.stringify({ n: ehLejano.sobrantes, m: ehLejano.mesesSobrantes }));
    ok(ehLejano.filasEnVentana === ctx.REC_HORIZONTE_MESES,
        'sin contarla como si estuviera en la ventana: filasEnVentana sigue en ' + ehLejano.filasEnVentana);
    ok(ehLejano.desincronizado === false,
        'y NO se declara desincronizado por ella: "Poner al dia" no la puede arreglar, seria un boton que miente');

    // Lo de ATRAS no es sobrante: es historia congelada por el invariante duro del modulo.
    ok(ctx._recPosterioresRec(hojaProy19, ventana19[ventana19.length - 1]).claves.length === 1,
        'la fila REC de un mes PASADO (sembrada al inicio de la seccion) no se cuenta como sobrante');

    // Se retira para no contaminar los escenarios siguientes.
    const filasLejanas = [];
    const notasTodas = hojaProy19.getRange(cfgP19.dataRow, col19(cfgP19.columns.nota),
        hojaProy19.getLastRow() - cfgP19.dataRow + 1, 1).getValues();
    notasTodas.forEach(function (f, i) {
        if (String(f[0] || '').indexOf(ctx.REC_MARCA + ' ' + claveLejana + ' ') === 0) filasLejanas.push(cfgP19.dataRow + i);
    });
    filasLejanas.reverse().forEach(function (f) { hojaProy19.deleteRows(f, 1); });
    ok(ctx._recPosterioresRec(hojaProy19, ventana19[ventana19.length - 1]).filas === 0,
        'y se limpia el escenario: cero sobrantes al salir');
}

let br = ctx.borrarRecurrente('No Existe');
ok(br.ok === false && /No existe un recurrente/.test(br.error), 'borrar un recurrente inexistente avisa');
br = ctx.borrarRecurrente('Netflix');
ok(br.ok === true && ctx.obtenerRecurrentes().recurrentes.length === 0,
    'borrar quita la fila de la BD');
ok(br.sincronizado === true && filasRecEnVentana() === 0,
    'y la fase 2 lo saca del horizonte entero, dio ' + filasRecEnVentana() + ' fila(s)');
ok(notasProy19().indexOf(notaPasada19) !== -1,
    'pero lo proyectado en un mes ANTERIOR al mes en curso queda: la historia no se reescribe');

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

// -- Recurrentes: HORIZONTE RODANTE CON VIGENCIA (v0.64.0) --
// EL SELECTOR DE MES SE FUE. Las aserciones son INVERSAS a proposito: el modelo viejo hacia
// elegir un mes y apretar "volcar", y la unica forma de que eso no vuelva de a poco es que su
// vocabulario entero (los dos ids, la funcion de armado, la confirmacion y el boton) tenga un
// test que se ponga rojo si reaparece.
ok(/id="recLista"/.test(HTML) && /id="recBtnSync"/.test(HTML),
    'la vista recurrentes tiene su lista y UN boton de conjunto: poner al dia la proyeccion');
ok(!/id="recMes"/.test(HTML) && !/id="recAnio"/.test(HTML),
    'y ya no tiene selector de mes ni de anio: el usuario no elige un mes');
['llenarPeriodoVolcado', 'pedirVolcado', 'mostrarConfirmacionVolcado'].forEach(function (fn) {
    ok(!new RegExp('function ' + fn + '\\(').test(jsShell),
        fn + '() se retiro del cliente con el modelo viejo');
});
ok(/enviar\('guardarRecurrente'/.test(HTML) && /enviar\('borrarRecurrente'/.test(HTML) &&
   /enviar\('sincronizarRecurrentes'/.test(HTML),
    'recurrentes guarda, borra y sincroniza por enviar()');
ok(usadas.has('obtenerRecurrentes') && usadas.has('estadoHorizonteRecurrentes'),
    'la lista se lee del backend y el estado del horizonte se PIDE al entrar, sin escribir');
ok(/function pedirEstadoHorizonte\([\s\S]*?estadoHorizonteRecurrentes\(\)/.test(jsShell) &&
   !/function pedirEstadoHorizonte\([\s\S]*?\.sincronizarRecurrentes\(/.test(jsShell),
    'entrar a la vista es SOLO LECTURA: el preparador mide, nunca sincroniza (volcar como ' +
    'efecto de mirar es el efecto oculto que este modelo vino a sacar)');
ok(/boton\.classList\.toggle\('hidden', !r\.desincronizado\)/.test(jsShell),
    'el boton primario aparece SOLO si desincronizado === true: al dia no hay nada que hacer');
ok(/Confirmar borrado/.test(HTML),
    'borrar pide un segundo click sobre el mismo boton: dos pasos, sin dialogo nativo');
// FASE 2: el recurrente NUNCA se pierde por culpa de la API (Regla Estricta 9).
{
    const cuerpoEnviar = (jsShell.match(/function enviar\([\s\S]*?\n\}/) || [''])[0];
    ok(/r\.ok && r\.aviso/.test(cuerpoEnviar) && /alSalirBien\(\)/.test(cuerpoEnviar),
        'enviar() distingue ok:true con aviso: la escritura entro y la sincronizacion no, ' +
        'y no lo trata como un fallo del guardado');
    ok(/mostrarAvisoConAccion\([\s\S]*?'Reintentar sincronizacion', sincronizarRecurrentesUI\)/
            .test(cuerpoEnviar),
        'y ofrece el reintento al lado del motivo, en vez de silenciar el fallo');
}
ok(/function mostrarAvisoConAccion\(/.test(jsShell) &&
   /alerta\.className = 'alert alert-warning'/.test(jsShell),
    'ese aviso reusa el markup de la confirmacion que se borro: cero CSS y cero color nuevo');
// VIGENCIA: dos campos nuevos que viajan en las dos direcciones.
ok(/class="form-input r-desde" type="month"/.test(HTML) &&
   /class="form-input r-hasta" type="month"/.test(HTML),
    'el bloque tiene Desde y Hasta como type="month": la clave YYYY-MM sin parseo de texto libre');
{
    const cuerpoGuardarRec = (jsShell.match(/function guardarRecurrenteUI\([\s\S]*?\n\}/) || [''])[0];
    ok(/desde: b\.querySelector\('\.r-desde'\)\.value/.test(cuerpoGuardarRec) &&
       /hasta: b\.querySelector\('\.r-hasta'\)\.value/.test(cuerpoGuardarRec),
        'la vigencia VIAJA al backend en el payload de guardarRecurrente');
    ok(/r\.desde \|\| ''/.test(jsShell) && /r\.hasta \|\| ''/.test(jsShell),
        'y vuelve a poblar el bloque desde la hoja: vacio sigue siendo vacio, sin default inventado');
}
ok(/Vacio = siempre/.test(HTML) && /Vacio = sin fin/.test(HTML) &&
   /Sale de los meses futuros/.test(HTML),
    'pausar y poner fecha de fin se distinguen en UNA linea cada uno, no en un parrafo');
ok(/Los cambios entran desde el mes en curso/.test(HTML),
    'y la consecuencia declarada del modelo (el mes en curso SI se reescribe) esta dicha');
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
ok(/Se puede deshacer\.<\/p>/.test(HTML) && !/Se puede deshacer justo /.test(HTML),
    'la confirmacion de baja es UNA linea: se cayo el matiz "pero no una vez que hagas otro ' +
    'cambio", que no cambiaba la decision en ese momento -- el boton Deshacer la sostiene');
ok(/Borrar <b>' \+ filas\.length \+ '<\/b> filas de/.test(jsShell),
    'y sigue diciendo CUANTAS filas y de que mes se borran');
ok(/PABM_MONEDAS_ORDEN\.indexOf/.test(jsShell),
    'ese total se ordena por moneda y nunca suma monedas distintas entre si (ADR-003)');
ok(/'guardado'/.test(jsShell) && /'shell'/.test(jsShell) && /'recurrentes'/.test(jsShell) &&
   /'base'/.test(jsShell) && /'otros'/.test(jsShell),
    'las cinco poblaciones del servidor tienen su seccion en la vista');
ok(/siempre: true/.test(jsShell) && /siempre: false/.test(jsShell),
    "la asimetria deliberada se conserva: 'guardado' y 'base' se ven aun vacias, las otras no");
ok(!/msgVacio/.test(jsShell) && /vacioRot/.test(jsShell) && /vacioRuta/.test(jsShell),
    'y las dos que se ven vacias cambiaron su parrafo por una linea con boton ' +
    '("todo base, cero guardado" sigue siendo el estado real de produccion y se sigue viendo)');
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
    // DENSIDAD 2026-08-30: la ruta dejo de estar DOS veces como prosa permanente (el parrafo de
    // cabecera y el estado vacio de 133 caracteres). Queda UNA sola vez, y como respuesta a un
    // click: es el `vacioRuta` del estado vacio de "Guardado a mano", que el boton revela.
    // La otra mencion, la del bloqueo de edicion, la manda ahora el SERVIDOR
    // (PA_MSJ_NO_EDITABLE, cruzado contra MENU_CONFIG por probar_proyeccion_abm.js): el cliente
    // no la retipea, la muestra.
    ok(new RegExp("vacioRuta: '" + rutaViva.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'").test(jsShell),
        'y vive en el vacioRuta de la seccion, que el boton del estado vacio revela al apretarlo');
    ok(!/<p class="conc-hint">Aca vive lo ya guardado/.test(HTML),
        'el parrafo de cabecera de 212 caracteres que la repetia se retiro entero');
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
ok(/\.pabm-head:focus-visible \{ outline: 2px solid var\(--tt-teal\)/.test(HTML) &&
   /\.pabm-monto:focus-visible \{ outline: 2px solid var\(--tt-teal\)/.test(HTML),
    'los dos tienen el mismo anillo de foco que .bloque-resumen: cero color nuevo');
// El token --teal-tinta era un teal OSCURECIDO A MANO para poder escribir con el, porque la
// menta #2ECAB0 daba 1.86:1 sobre blanco. El teal del brandbook Ed.03 da 6.00:1 calculado, asi
// que ese token dejo de tener razon de existir: dos nombres para un solo valor es la clase de
// duplicacion que este repo persigue en el CSS.
ok(!/teal-tinta:/.test(HTML) && !/var\(--teal-tinta\)/.test(HTML),
    'y --teal-tinta se retiro: con #2E6B7A no hace falta un segundo teal para poder escribir');
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
// ACTUALIZADO v0.64.0: la regla dejo de ser una lista de dos selectores. Los <select> de
// mes/anio de recurrentes eran el UNICO consumidor de .shell-acciones .form-input y se fueron
// con el modelo de horizonte rodante, asi que la regla se retiro entera -- una regla sin
// consumidor es exactamente lo que persigue el guard 31, dos secciones mas abajo.
{
    const reglaSelect = (HTML.match(
        /\.f select\.form-input \{([^}]*)\}/) || ['', ''])[1];
    const focoSelect = (HTML.match(
        /\.f select\.form-input:focus \{([^}]*)\}/) || ['', ''])[1];
    ok(!/\.shell-acciones \.form-input/.test(HTML),
        'la barra de acciones ya no declara .form-input: se quedo sin consumidor y se retiro');
    ok(/appearance:\s*none/.test(reglaSelect) && /var\(--chevron\)/.test(reglaSelect),
        'los <select> del shell apagan la flecha nativa y dibujan el chevron de la casa');
    ok(/var\(--chevron\)/.test(focoSelect),
        'y el foco repone la IMAGEN, no solo el color: un shorthand background la borra');
    const offsets = [...(reglaSelect + focoSelect).matchAll(/right (\d+)px center/g)]
        .map((m) => m[1]);
    ok(offsets.length === 2 && offsets[0] === offsets[1],
        'base y foco usan el MISMO offset: la ley "una sola flecha" dejo de estar escrita ' +
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
ok(/\[data-v="Editar"\] \{\s*background: #FFFFFF; color: var\(--tt-teal\);/.test(HTML),
    'el presionado neutro Crear/Editar es una pastilla BLANCA con los anillos teal: 6.00:1');
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
 'estadoHorizonteRecurrentes', 'sincronizarRecurrentes'].forEach(function (fn) {
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
// estadoVolcadoRecurrentes SALIO de esta lista: desde v0.64.0 el cliente no lo llama (se fue
// con el selector de mes). Su reemplazo, estadoHorizonteRecurrentes, entra en su lugar -- y con
// el mismo rigor: los SIETE campos tienen que tener lector. Asi se cazo 'pausados' en su dia.
[['obtenerSaldosConciliacion', ctx.obtenerSaldosConciliacion()],
 ['estadoHorizonteRecurrentes', ctx.estadoHorizonteRecurrentes()]].forEach(function (par) {
    ok(par[1] && par[1].ok === true, par[0] + ' respondio ok para poder listar sus campos');
    Object.keys(par[1] || {}).filter(k => k !== 'ok' && k !== 'error').forEach(function (campo) {
        ok(new RegExp('\\b(?:r|saldosConc)\\s*\\.\\s*' + campo + '\\b').test(jsShell),
            par[0] + '.' + campo + ' tiene lector en el cliente');
    });
});

// GUARD DE TRANSICION (v0.64.0), en TRES estados y no en dos. La version anterior asumia que la
// UI nueva y el retiro de los endpoints transitorios del backend caian en el mismo commit. No
// cayeron: la etapa de UI (esta) borro el selector de mes, y el retiro de volcarRecurrentesAlMes
// y estadoVolcadoRecurrentes de 17_RecurrentesService.js es un paso propio, con su propia
// verificacion. Un guard que se pone rojo en un estado sano -- porque el repo esta en un punto
// intermedio que el guard no contemplo -- es tan malo como uno que afirma de mas.
//
// El estado se DERIVA del repo, no se declara a mano, y cada uno exige lo suyo:
//   A. UI vieja (existe #recMes): estadoHorizonteRecurrentes no tiene por que estar consumido.
//   B. UI nueva, backend con los transitorios todavia vivos: el cliente NO puede llamarlos, y
//      todos los campos del payload nuevo tienen que tener lector. Es donde esta el repo hoy.
//   C. UI nueva y transitorios retirados: ademas, no queda rastro de ellos en el backend.
// DEUDA CON NOMBRE Y CONDICION: el paso de B a C es retirar volcarRecurrentesAlMes(d) y
// estadoVolcadoRecurrentes(d) de 17_RecurrentesService.js -- ya no tienen un solo llamador -- y
// con ellos sus casos de la seccion 19 y del doble. Este guard lo detecta solo y cambia de rama.
{
    const uiVieja = /id="recMes"/.test(HTML);
    const REC_SRC = leerSrc('src/17_RecurrentesService.js');
    const transitoriosVivos = /function volcarRecurrentesAlMes/.test(REC_SRC);
    const eh = ctx.estadoHorizonteRecurrentes();
    ok(eh.ok === true, 'estadoHorizonteRecurrentes respondio ok para poder listar sus campos');
    const campos = Object.keys(eh).filter(k => k !== 'ok' && k !== 'error');
    if (uiVieja) {
        ok(/enviar\('volcarRecurrentesAlMes'/.test(HTML),
            'ESTADO A: la vista de recurrentes es todavia la del modelo viejo (selector de mes + ' +
            'boton de volcado), por eso los dos endpoints transitorios siguen vivos');
        ok(typeof ctx.sincronizarRecurrentes === 'function' && typeof ctx.estadoHorizonteRecurrentes === 'function',
            'y el backend ya expone el modelo nuevo, listo para que la UI lo estrene: ' + campos.join(', '));
    } else {
        campos.forEach(function (campo) {
            ok(new RegExp('\\br\\s*\\.\\s*' + campo + '\\b').test(jsShell),
                'estadoHorizonteRecurrentes.' + campo + ' tiene lector en el cliente');
        });
        ok(!/volcarRecurrentesAlMes/.test(jsShell) && !/estadoVolcadoRecurrentes/.test(jsShell),
            'con la vista nueva, los dos endpoints transitorios ya no se llaman desde el cliente');
        ok(!usadas.has('volcarRecurrentesAlMes') && !usadas.has('estadoVolcadoRecurrentes'),
            'y tampoco quedan en el cruce de endpoints que el shell invoca de verdad');
        if (transitoriosVivos) {
            ok(typeof ctx.volcarRecurrentesAlMes === 'function',
                'ESTADO B (el de hoy): la UI ya es la nueva y los transitorios siguen en el ' +
                'backend, sin ningun llamador. Retirarlos es el paso siguiente, y este guard ' +
                'pasa solo a la rama C cuando eso ocurra');
        } else {
            ok(!/estadoVolcadoRecurrentes/.test(REC_SRC),
                'ESTADO C: los dos transitorios se retiraron del backend, no queda un camino de ' +
                'escritura sin UI que lo justifique');
        }
    }
}

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

// -- (19) El anio ya no puede venir del cliente: se retiro con volcarRecurrentesAlMes(d).
// Aquel endpoint tomaba {mes, anio} y _periodoValidoRec atajaba el anio de dos digitos (Date
// mapea 26 a 1926 y el volcado quedaba invisible). El modelo de horizonte rodante no acepta un
// periodo: la ventana la calcula el backend con _clavesVentanaRec. Lo que se verifica ahora es
// que la ventana sea siempre de cuatro cifras, sin que nadie pueda pasarle otra cosa.
ok(ctx._clavesVentanaRec().every(c => /^\d{4}-\d{2}$/.test(c)),
    'las claves de la ventana son siempre YYYY-MM: el anio ya no viaja desde el cliente');

// -- (6) La sincronizacion revalida lo leido de la hoja Recurrentes y corta ANTES de borrar --
gr = ctx.guardarRecurrente(recBase19);
ok(gr.ok === true, 'se re-crea el recurrente para el escenario de hoja corrupta');
const hojaRec22 = hojasFalsas[ctx.SHEETS.RECURRENTES];
const cfgRec22 = ctx.RANGES.RECURRENTES;
const filasHorizonte22 = () => ctx._filasRecEnClaves(hojaProy19, ctx._clavesVentanaRec()).length;
const antesCorrupto22 = filasHorizonte22();
const celdaMonto22 = hojaRec22.getRange(cfgRec22.dataRow, col19(cfgRec22.columns.monto), 1, 1);
celdaMonto22.setValue('$4.500');   // pegado a mano en la hoja oculta: Number() da NaN
let sr22 = ctx.sincronizarRecurrentes();
ok(sr22.ok === false && /Netflix/.test(sr22.error || '') && /monto/.test(sr22.error || ''),
    'un monto con texto corta la sincronizacion NOMBRANDO la fila y el campo invalidos (antes fallaba abierto: NaN > tolerancia da false)');
ok(filasHorizonte22() === antesCorrupto22, 'y el horizonte previo quedo intacto: se corto antes de borrar');
// La vigencia entra en la MISMA revalidacion: la hoja es oculta pero editable a mano.
celdaMonto22.setValue(5000);
const celdaHasta22 = hojaRec22.getRange(cfgRec22.dataRow, col19(cfgRec22.columns.hasta), 1, 1);
celdaHasta22.setValue('el ano que viene');
sr22 = ctx.sincronizarRecurrentes();
ok(sr22.ok === false && /Netflix/.test(sr22.error || '') && /Hasta/.test(sr22.error || ''),
    'una vigencia ilegible pegada a mano tambien corta, nombrando el campo Hasta');
ok(filasHorizonte22() === antesCorrupto22, 'y tampoco toco el horizonte');
celdaHasta22.setValue('');
sr22 = ctx.sincronizarRecurrentes();
ok(sr22.ok === true && filasHorizonte22() === ctx.REC_HORIZONTE_MESES,
    'con la hoja reparada la sincronizacion vuelve a operar y llena el horizonte, dio ' + filasHorizonte22());

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
ok((jsShell.match(/\['recBtnSync', btn\]/g) || []).length === 2,
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

seccion('23. GUARD DE PALETA: el shell viste el brandbook Ed.03, cero hex fuera de lista');
// PEDIDO DE FRANCO 2026-08-30, textual: "Me gusta ese verde agua, pero la identidad de tidetrack
// esta mas asociada a un color navy #1E2A55 y, de ultima, podrias utilizar tambien color teal
// #2E6B7A". La lista blanca se REEMPLAZO entera: el teal menta #2ECAB0 y sus tres derivados,
// el ink #1E2A33 con sus dos aclarados, el gris #F4F7FA y el durazno #FFB380 SALIERON del
// proyecto. Los que entran son los tokens del brandbook Ed.03 mas los tres pares del semaforo.
//
// REGLA DE ORO del brandbook, que es la que ordena para que sirve cada uno: "El navy es la voz,
// el cloud es el espacio. Todo lo demas se usa con cuidado."
//
// Los contrastes de los comentarios estan CALCULADOS (WCAG 2.x, luminancia relativa), no
// declarados de memoria: el bloque de verificacion de contraste que sigue a la lista los vuelve
// a calcular en cada corrida y falla si alguno se cae por debajo de AA.
const PALETA = {
    // -- primarios (brandbook Ed.03) --
    '#182040': 'Navy: la VOZ. Logo, wordmark, texto, boton primario. 15.92:1 sobre blanco',
    '#F4F5F8': 'Cloud: el ESPACIO. Superficie de chips, tags y rieles del segmentado',
    // -- neutros y secundarios, de uso moderado (brandbook Ed.03) --
    '#1E2A55': 'Navy 700: texto cuerpo, labels y tramo alto del degrade primario. 13.84:1',
    '#6B7290': 'Navy 400: auxiliar y muted. 4.74:1 sobre blanco, 4.54:1 sobre Paper',
    '#2E6B7A': 'Teal: acento EDITORIAL. Foco, hover, hairlines, chip del hero. 6.00:1 sobre blanco',
    '#E8E3D5': 'Sand: calido/papel. Riel de atencion del ambar y radial ambiente',
    '#FAFAFC': 'Paper: el hueco de los inputs. Es donde vive el texto auxiliar, que sobre Cloud no llegaba a AA',
    '#FFFFFF': 'Blanco: lienzo, fondo de foco, vidrio y texto del boton primario',
    // -- semaforo: colores DE FUNCION, no de marca. El brandbook legisla marca, no estado.
    //    El rojo NO es inventado: es Warn del brandbook. El brandbook lo reserva para "no
    //    hacer" y en esta planilla el egreso y la accion destructiva comparten ese registro de
    //    alarma; inventar un segundo rojo para no reusarlo habria agregado un color al sistema
    //    para decir exactamente lo mismo. Verde y ambar si son de funcion pura: el brandbook no
    //    trae ninguno, y se recalibraron para convivir con el navy en vez de con la menta.
    '#B84A3E': 'Warn del brandbook, usado como rojo de funcion: Egreso, neto negativo, borrar',
    '#F9F1F0': 'riel del rojo (8% de su ink sobre blanco). 4.62:1 contra su ink',
    '#1D6A4F': 'verde de funcion, texto: Ingreso, neto positivo, aviso ok. 6.51:1 sobre blanco',
    '#E8F0ED': 'riel del verde (10% de su ink sobre blanco). 5.61:1 contra su ink',
    '#6B4A18': 'ambar de funcion, texto: advertencia, combo fuera de catalogo. 8.02:1 sobre blanco'
    // El riel del ambar NO tiene entrada propia: es Sand (#E8E3D5), que ya esta arriba.
};
// LOS CONTRASTES SE CALCULAN, NO SE DECLARAN. Un comentario que dice "5.18:1" envejece solo; el
// guard de paleta mira PROCEDENCIA y por eso dejaba pasar un par ilegible con colores legales
// (fue exactamente lo que paso con el segmentado Crear/Editar). Estos son los pares que de
// verdad se pintan uno sobre el otro en el shell.
{
    const lum = (h) => {
        const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255)
            .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const contraste = (a, b) => {
        const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const PARES = [
        ['#182040', '#FFFFFF', 4.5, 'ink-1 sobre el lienzo'],
        ['#1E2A55', '#FFFFFF', 4.5, 'ink-2 (texto cuerpo) sobre el lienzo'],
        ['#6B7290', '#FFFFFF', 4.5, 'ink-3 sobre el lienzo'],
        ['#6B7290', '#FAFAFC', 4.5, 'ink-3 sobre Paper: placeholders y la pastilla "sin datos aun"'],
        ['#1E2A55', '#F4F5F8', 4.5, 'ink-2 sobre Cloud: los botones del segmentado'],
        ['#2E6B7A', '#FFFFFF', 4.5, 'el teal como texto (lapiz, hover, Crear/Editar presionado)'],
        ['#FFFFFF', '#182040', 4.5, 'texto del boton primario sobre su tramo mas oscuro'],
        ['#FFFFFF', '#2E6B7A', 4.5, 'texto del boton primario sobre su tramo de hover, y el icono del hero'],
        ['#FFFFFF', '#B84A3E', 4.5, 'texto del boton destructivo solido'],
        ['#1D6A4F', '#E8F0ED', 4.5, 'par verde de funcion'],
        ['#B84A3E', '#F9F1F0', 4.5, 'par rojo de funcion'],
        ['#6B4A18', '#E8E3D5', 4.5, 'par ambar de funcion (su riel es Sand)']
    ];
    PARES.forEach(function (par) {
        const r = contraste(par[0], par[1]);
        ok(r >= par[2],
            par[3] + ': ' + par[0] + ' sobre ' + par[1] + ' da ' + r.toFixed(2) +
            ':1 (minimo ' + par[2] + ')');
    });
    // Y la regla que separa las dos superficies neutras, que es la razon de que Paper exista.
    ok(contraste('#6B7290', '#F4F5F8') < 4.5,
        'queda anotado por que ink-3 NO puede apoyar en Cloud: da ' +
        contraste('#6B7290', '#F4F5F8').toFixed(2) + ':1, por debajo de AA. Por eso el hueco de ' +
        'los inputs es Paper y Cloud queda para los chips, cuyo contenido es ink-2');
}
// Se audita el <style> PROPIO del shell, sin comentarios: se miran los hex que RENDERIZAN, no
// los que se documentan. El design system incluido (src/UI_SharedStyles.html) pasa por el MISMO
// metodo mas abajo, en el barrido de todos los .html de src/ -- hasta el 2026-08-30 su "pase
// propio" se limitaba a comprobar que no existiera --font-mono, y por ese hueco vivia una paleta
// entera de otra generacion que ademas renderizaba. Los data-URI
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
['#182040', '#F4F5F8', '#2E6B7A', '#E8E3D5', '#FFFFFF'].forEach(function (base) {
    ok(hexUsados.indexOf(base) !== -1, 'el color base ' + base + ' se usa de verdad en el estilo');
});
// Y el reves del reves: los colores de la paleta ANTERIOR no pueden haber quedado en ningun
// rincon. Un recolor a medias (el teal menta sobreviviendo en un hover o en un data-URI) es la
// forma tipica en que una identidad vieja vuelve de a poco.
['#2ECAB0', '#1E2A33', '#F4F7FA', '#FFB380', '#0B7B69', '#29B89F', '#35D6BB',
 '#44576A', '#5A6B7C', '#0E6B4F', '#DDF5EC', '#B23B32', '#FCEAE7', '#7A4A10',
 '#FFF1E2'].forEach(function (viejo) {
    ok(hexUsados.indexOf(viejo) === -1,
        'el color ' + viejo + ' de la paleta anterior no sobrevive en ningun rincon del estilo');
});
// La tipografia del brandbook Ed.03: DM Sans por <link>, con los CUATRO pesos que declara.
ok(/fonts\.googleapis\.com\/css2\?family=DM\+Sans:wght@300;400;500;700/.test(HTML),
    'la webfont que se carga es DM Sans con los pesos 300/400/500/700 del brandbook');
ok(!/family=Poppins/.test(HTML),
    'y Poppins ya no se descarga: la familia anterior salio del proyecto');
ok(/--font-family:\s*'DM Sans'/.test(cssPaleta),
    "--font-family arranca en 'DM Sans': el * del design system la propaga a todo");
// EL PESO 600 NO EXISTE EN DM SANS. Dejarlo habria hecho que cada navegador lo resolviera a su
// manera (sintesis o salto a 700), que es una diferencia visible entre la maquina de Franco y
// la de cualquier otro. Los 27 pesos 600 del rediseno anterior pasaron a 500.
ok(!/font-weight:\s*600/.test(cssPaleta),
    'ningun font-weight: 600 en el estilo: DM Sans no lo trae y el navegador lo inventaria');
{
    const pesos = [...new Set((cssPaleta.match(/font-weight:\s*(\d{3})/g) || [])
        .map((m) => m.replace(/\D/g, '')))].sort();
    ok(pesos.every((w) => ['300', '400', '500', '700'].indexOf(w) !== -1),
        'y los pesos que si se usan son los declarados por el brandbook: ' + pesos.join(', '));
}

// LOS OTROS .html DE src/. El <style> de arriba es el del shell, pero el shell INCLUYE
// literalmente src/UI_SharedStyles.html (<?!= include('UI_SharedStyles'); ?>, linea 16) y ese
// archivo no lo auditaba NADIE: el comentario de este guard decia "el design system incluido
// tiene su propio pase", pero ese pase se limitaba a comprobar que no existiera --font-mono.
// Probado en rojo el 2026-08-30: metiendo '--intruso-menta: #2ECAB0;' en UI_SharedStyles.html los
// tres verificadores seguian en VERDE. No era hipotetico -- el archivo traia una paleta entera de
// otra generacion (#34475d, #eff2f9, #CBD5E1, #94A3B8, #DC2626...) y parte RENDERIZABA: sus
// scrollbars globales pintaban en todo contenedor con overflow salvo .shell-scroll, que era el
// unico que el shell redefine, y por eso la tabla de Conciliacion mostraba la barra de la
// generacion anterior. Ahora TODO .html de src/ pasa por la misma lista blanca y el mismo metodo.
fs.readdirSync(path.join(RAIZ, 'src'))
    .filter(f => f.endsWith('.html') && f !== 'UI_Shell.html')
    .forEach(function (archivo) {
        const ruta = 'src/' + archivo;
        const bloques = (leerSrc(ruta).match(/<style>([\s\S]*?)<\/style>/g) || [])
            .join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/%23/gi, '#');
        ok(bloques.length > 0, ruta + ' aporta un <style> auditable');
        const hexH = [...new Set((bloques.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(normalizarHex))];
        const intrusosH = hexH.filter(h => !(h in PALETA));
        ok(intrusosH.length === 0,
            'cada hex de ' + ruta + ' esta en la lista blanca del brandbook' +
            (intrusosH.length ? ' -- INTRUSOS: ' + intrusosH.join(', ') : ''));
        const ternasH = [...new Set(
            (bloques.match(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/g) || []).map(function (t) {
                return '#' + t.match(/\d{1,3}/g)
                    .map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
            })
        )].filter(h => !(h in PALETA));
        ok(ternasH.length === 0,
            'cada rgba()/rgb() de ' + ruta + ' deriva de la lista blanca' +
            (ternasH.length ? ' -- INTRUSAS: ' + ternasH.join(', ') : ''));
        const kwH = [...new Set(
            (bloques.replace(/url\([^)]*\)/g, 'url(_)')
                .match(/[:\s,(](white|black|navy|gray|grey|silver|red|blue|green|yellow|orange|purple|pink|brown|cyan|magenta|teal|aqua|lime|maroon|olive|coral|salmon|ivory|beige|khaki|gold|azure|snow|linen)(?![\w-])/gi) || [])
                .map(k => k.slice(1).toLowerCase())
        )];
        ok(kwH.length === 0,
            'ningun keyword CSS de color renderiza en ' + ruta +
            (kwH.length ? ' -- INTRUSOS: ' + kwH.join(', ') : ''));
        ok(!/League Spartan/.test(bloques) && !/Poppins/.test(bloques) && !/Google Sans/.test(bloques),
            ruta + ' no arrastra ninguna familia de las generaciones anteriores');
    });
// Y el reves: el teal menta y Poppins no pueden sobrevivir en NINGUN .html de src/, ni siquiera
// fuera de un <style>. El changelog de esta release afirma que "el teal menta #2ECAB0 SALE del
// proyecto entero"; hasta hoy esa frase no la sostenia ningun banco, y era falsa -- quedaban 5
// apariciones de #2ECAB0 y 4 de Poppins en UI_AbmPlanCuentas.html y 4 y 4 en
// UI_AbmProyeccionElaborada.html, mas el <link> a fonts.googleapis.com/css2?family=Poppins en los
// dos. Los dos archivos se borraron (eran huerfanos desde v0.62/v0.63); este assert es lo que
// impide que la afirmacion vuelva a ser una promesa.
{
    const sucios = [];
    fs.readdirSync(path.join(RAIZ, 'src')).filter(f => f.endsWith('.html')).forEach(function (f) {
        const crudo = leerSrc('src/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
        if (/#2ECAB0/i.test(crudo)) sucios.push('src/' + f + ' (#2ECAB0)');
        if (/Poppins/.test(crudo)) sucios.push('src/' + f + ' (Poppins)');
    });
    ok(sucios.length === 0,
        'ni el teal menta ni Poppins sobreviven en ningun .html de src/' +
        (sucios.length ? ' -- QUEDAN: ' + sucios.join(', ') : ''));
}

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
    ok(!/League Spartan/.test(bloques) && !/Poppins/.test(bloques) && /DM Sans/.test(bloques),
        x.archivo + ' viste DM Sans: ni la League Spartan de dos redisenos atras ni la ' +
        'Poppins del anterior');
});

seccion('25. DENSIDAD DE LA VISTA proyecciones: los cuatro objetivos, medidos');
// El muro que se saco, medido antes de sacarlo: 212 caracteres de encabezado con dos rutas de
// menu, cinco parrafos `sub` (60+65+82+50+90) y dos estados vacios (133+103) = 795 caracteres
// de prosa PERMANENTE antes del primer numero. Toda esa prosa era PREVENTIVA: le explicaba
// reglas a quien todavia no habia chocado con ninguna.
// Los cuatro objetivos son verificables, no opinables, y aca se verifican de verdad: el
// encabezado se EJECUTA con datos sinteticos en vez de leerse, que es la diferencia entre medir
// y creerle a un comentario.
{
    // El <script> crudo, con comentarios: los dos marcadores de la zona de prosa son
    // comentarios y jsShell los borra.
    const jsCrudo = (HTML.match(/<script[^>]*>([\s\S]*?)<\/script>/) || ['', ''])[1];
    const sinComent = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

    const iniZona = jsCrudo.indexOf('// ---- PROSA PERMANENTE DE LA VISTA');
    const finZona = jsCrudo.indexOf('// ---- fin prosa permanente');
    ok(iniZona !== -1 && finZona > iniZona,
        'la vista declara su zona de prosa permanente entre dos marcadores: es lo que hace ' +
        'medible el objetivo O-4 sin tener que adivinar que se lee en pantalla');
    const zona = sinComent(jsCrudo.slice(iniZona, finZona));

    // La region ENTERA de la vista, para el objetivo O-2.
    const iniVista = jsCrudo.indexOf('// PROYECCIONES ELABORADAS -- vista');
    const finVista = jsCrudo.indexOf('// ACCIONES DEL HOME');
    ok(iniVista !== -1 && finVista > iniVista, 'la region de la vista se pudo aislar');
    const regionVista = sinComent(jsCrudo.slice(iniVista, finVista));

    // PROSA = una FRASE: dos palabras de tres o mas letras separadas por un espacio. Un literal
    // suelto como 'ingresos' o 'neg' es un identificador, no prosa, y contarlo haria ruido; un
    // fragmento de markup (lleva '<' o un atributo '="') tampoco es prosa.
    const literales = (txt) => {
        const salida = []; let m;
        const re = /'((?:[^'\\\n]|\\.)*)'/g;
        while ((m = re.exec(txt)) !== null) salida.push(m[1]);
        return salida;
    };
    const esProsa = (t) => t.indexOf('<') === -1 && t.indexOf('="') === -1 &&
        /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(t);

    // ---- O-3: PABM_SECCIONES pierde el campo `sub` en las cinco entradas ----
    const bloqueSecciones = (zona.match(/var PABM_SECCIONES = \[[\s\S]*?\n\];/) || [''])[0];
    ok(bloqueSecciones.length > 0, 'O-3: PABM_SECCIONES se pudo aislar para auditarla');
    ok(!/\bsub\s*:/.test(bloqueSecciones),
        'O-3: ninguna de las cinco secciones declara ya el campo `sub` (eran 347 caracteres ' +
        'de parrafo permanente, uno por seccion)');
    ok((bloqueSecciones.match(/origen:/g) || []).length === 5,
        'y las cinco secciones siguen ahi: se saco la prosa, no las poblaciones');
    ok((bloqueSecciones.match(/editable:/g) || []).length === 5,
        'lo unico que sobrevive del `sub` es la condicion de edicion, ahora como dato');

    // ---- O-1: el encabezado es UNA cadena y no supera 80 caracteres ----
    // Se EJECUTA la funcion real extraida del HTML, con un dataset a proposito grande (cuatro
    // digitos de filas, doce meses distintos repartidos entre origenes, sello del shell con
    // milisegundos): si el encabezado se pasa de 80 con datos plausibles, tiene que doler aca.
    const zonaEjec = new Function(
        zona + '\n' + (jsShell.match(/function pabmFmtSello[\s\S]*?\n\}/) || [''])[0] +
        '\nreturn { enc: pabmEncabezado, sec: PABM_SECCIONES, vacio: PABM_ROT_VACIO, ' +
        'nueva: PABM_ROT_NUEVA, candado: PABM_CANDADO_TITULO };')();
    const grupoFalso = (clave, n, sello) => ({ clave: clave, mesLabel: clave, nFilas: n,
        corridas: 1, ultimoSello: sello, totales: {} });
    const mesesFalsos = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
        '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08'];
    const datosFalsos = { grupos: {
        base: mesesFalsos.map((c) => grupoFalso(c, 120, '2026-08-01_090000')),
        guardado: [grupoFalso('2026-09', 40, '2026-08-20_143012')],
        shell: [grupoFalso('2026-10', 8, 'shell_2026-08-29_181203445')]
    } };
    const encab = zonaEjec.enc(datosFalsos.grupos);
    ok(typeof encab === 'string' && encab.indexOf('\n') === -1,
        'O-1: el encabezado es UNA sola cadena');
    ok(encab.length <= 80,
        'O-1: y mide ' + encab.length + ' caracteres con datos grandes (tope 80): "' + encab + '"');
    ok(/1488 filas/.test(encab) && /12 meses/.test(encab),
        'los numeros salen de lo que listarPeriodosProyeccion YA devuelve, y los meses se ' +
        'cuentan por clave distinta: el mismo mes en dos origenes es un mes, no dos');
    ok(/<span class="pabm-resumen">' \+ escapar\(pabmEncabezado\(grupos\)\)/.test(jsShell),
        'y es lo unico que el encabezado imprime como texto: el resto de esa linea es un boton');

    // ---- O-2: ninguna cadena de prosa de la vista supera 120 caracteres ----
    // LISTA BLANCA VACIA, y esa es la noticia. Las cuatro cadenas que hoy superarian el tope
    // son los mensajes de bloqueo por origen, y ya no viven aca: las manda el servidor en
    // `motivoNoEditable` (PA_MSJ_NO_EDITABLE, con las rutas de MENU_CONFIG que
    // probar_proyeccion_abm.js cruza contra el config vivo). El cliente las muestra, no las
    // retipea -- que es tambien lo que impide que las dos copias se separen con el tiempo.
    const PROSA_PERMITIDA = [];
    const largas = literales(regionVista).filter(esProsa)
        .filter((t) => t.length > 120 && PROSA_PERMITIDA.indexOf(t) === -1);
    ok(largas.length === 0,
        'O-2: ninguna cadena de prosa de la vista supera 120 caracteres' +
        (largas.length ? ' -- LARGAS: ' + largas.map((t) => t.length + ' "' + t.slice(0, 60) + '..."').join(' | ') : ''));
    ['Se corrige en la hoja Presupuesto', 'se vuelve a volcar el mes',
     'El presupuesto base se recalcula', 'No se reconoce el origen de esta fila'].forEach(function (frag) {
        ok(jsShell.indexOf(frag) === -1,
            'el cliente no retipea el mensaje de bloqueo del servidor ("' + frag + '")');
    });

    // ---- O-4: prosa permanente en el estado normal, de 795 a <= 200 ----
    // Se mide EXACTAMENTE el mismo conjunto que daba 795: el encabezado, los cinco `sub` (que
    // ya no existen) y los dos estados vacios. Los titulos de seccion no entran, igual que
    // antes: son rotulos, no prosa.
    let o4 = encab.length;
    const detalle = ['encabezado ' + encab.length];
    zonaEjec.sec.filter((x) => x.siempre).forEach(function (x) {
        const n = zonaEjec.vacio.length + (x.vacioRot || '').length;
        o4 += n;
        detalle.push('vacio de "' + x.titulo + '" ' + n);
    });
    o4 += zonaEjec.nueva.length;
    detalle.push('boton del encabezado ' + zonaEjec.nueva.length);
    ok(o4 <= 200,
        'O-4: la prosa permanente del estado normal quedo en ' + o4 + ' caracteres, de 795 ' +
        '(tope 200) -- ' + detalle.join(', '));

    // LOS DIENTES DE O-4. Sumar constantes chicas no sirve de nada si manana alguien escribe un
    // parrafo adentro de una funcion de render: la suma de arriba seguiria dando 113 y la
    // pantalla volveria a tener un muro. Las tres funciones del estado normal no pueden tener
    // una sola frase propia; los dos bloques condicionales (el banner de deshacer y el aviso de
    // filas no reconocidas) viven en funciones aparte JUSTAMENTE porque no son estado normal.
    ['pabmRender', 'pabmTarjeta', 'pabmSeccionHtml'].forEach(function (fn) {
        const cuerpo = (regionVista.match(new RegExp('function ' + fn + '\\([\\s\\S]*?\\n\\}')) || [''])[0];
        ok(cuerpo.length > 0, fn + '() se pudo aislar');
        const prosa = literales(cuerpo).filter(esProsa);
        ok(prosa.length === 0,
            fn + '() no escribe una sola frase propia: todo rotulo sale de la zona de prosa' +
            (prosa.length ? ' -- HALLADAS: ' + prosa.map((t) => '"' + t + '"').join(', ') : ''));
    });
    ['pabmBannerRevert', 'pabmAvisoOtras'].forEach(function (fn) {
        ok(new RegExp('function ' + fn + '\\(').test(jsShell),
            fn + '() existe: lo condicional se aparta del estado normal en vez de contarse como si siempre estuviera');
    });

    // ---- La densidad, del lado del DOM ----
    ok(/class="pabm-neto"/.test(HTML) && /font-size: 18px; font-weight: 700/.test(HTML),
        'el neto es el UNICO numero grande de la tarjeta (18px/700): la jerarquia la dan el ' +
        'tamano, el color y el espacio, no una caja nueva');
    ok(/\.pabm-comp \{[^}]*font-size: 11px/.test(HTML),
        'y los tres componentes van en 11px tenue, con la moneda escrita UNA sola vez junto al neto');
    ok(!/pabm-totales/.test(HTML),
        'el bloque de cuatro pares "Rotulo: valor" del mismo tamano y peso se retiro entero');
    ok(/\.shell-sec \.pabm-sec-total \{\s*order: 1;/.test(HTML),
        'cada seccion lleva su total del otro lado de la estela (order:1 sobre el ::after)');
    ok(/pabmFmtListaTope\(pabmNetoDeSeccion\(lista\), 2\)/.test(jsShell),
        'ese total es la suma POR MONEDA de los netos de sus meses, acotada a dos con un "+N"');
    ok(/function pabmCandadoSvg\(/.test(jsShell) && /class="pabm-candado"/.test(HTML) === false,
        'el candado se dibuja por funcion (SVG stroke como todos los iconos), no como markup suelto');
    ok(zonaEjec.candado.length <= 120 && /toca un monto/.test(zonaEjec.candado),
        'y su title dice, en una frase, que el monto revela donde se corrige');
}

seccion('26. EDICION RESTRINGIDA POR ORIGEN: el cliente respeta el gate del servidor');
// El pedido de Franco fue textual: "me preocupa que se puedan editar los montos de TODO".
// Despues del cambio se edita UNA sola poblacion, 'shell', que es la unica que no tiene un
// documento aguas arriba con el que pueda discrepar. El gate REAL sigue siendo del servidor
// (probar_proyeccion_abm.js lo prueba ahi); lo que se verifica aca es que el cliente no
// invente su propia version del gate ni de los mensajes.
ok(/function pabmCeldaFija\(/.test(jsShell),
    'la fila no editable tiene su propia celda, con candado en vez de lapiz');
ok(/pabm-monto pabm-monto--fijo/.test(HTML) && /onclick="pabmMostrarMotivo\(this\)"/.test(HTML),
    'y sigue siendo un <button>: antes no respondia al click y el usuario no sabia por que');
ok(/pabmMotivos\[origen\] = det\.motivoNoEditable \|\| ''/.test(jsShell),
    'el motivo lo guarda el cliente TAL COMO lo manda el servidor, una vez por grupo');
ok(/var motivo = pabmMotivos\[card\.dataset\.origen\]/.test(jsShell),
    'y lo lee por el origen de la tarjeta cuando alguien toca un monto que no se edita');
ok(/fila\.className = 'pabm-motivo'/.test(jsShell) && /\}, 6000\);/.test(jsShell),
    'la linea aparece bajo esa fila y se retira sola a los 6 s: reactiva, nunca permanente');
ok(/f\.editable\s*\n?\s*\?/.test(jsShell) || /var celdaMonto = f\.editable/.test(jsShell),
    'la celda editable la decide el campo `editable` del servidor, no una lista propia del cliente');
ok(!/origen === 'guardado' \|\| origen === 'shell'/.test(jsShell),
    "y no queda ninguna copia cliente del gate viejo ('guardado' tambien editable)");
// BAJA BLOQUEADA. Un borrado que la proxima sincronizacion deshace sola es una trampa, no una
// funcion: el boton no se muestra, y el motivo que se muestra en su lugar es el del servidor.
ok(/var baja = det\.bajaBloqueada/.test(jsShell),
    'el boton "Borrar este periodo" no se dibuja cuando el servidor manda bajaBloqueada');
ok(/'<p class="pabm-pie">' \+ escapar\(det\.bajaBloqueada\)/.test(jsShell),
    'y en su lugar se dice el motivo del servidor, que es el mismo que aplica el gate');
ok(!/pabmNotaPie/.test(jsShell),
    'la nota al pie por origen (cuatro variantes permanentes) se retiro: el motivo es reactivo');
// El doble tiene que hablar el MISMO contrato, o la vista se valida en local contra otra cosa.
['motivoNoEditable', 'bajaBloqueada'].forEach(function (campo) {
    ok(new RegExp(campo).test(DOBLE), 'el doble devuelve ' + campo + ' en el detalle');
});
ok(/var editable = \(origen === 'shell'\);/.test(DOBLE),
    "y aplica el mismo gate: solo 'shell' se edita");
ok(/PA_MSJ_NO_EDITABLE_DOBLE/.test(DOBLE) && /proyBajaBloqueadaDoble/.test(DOBLE),
    'con los cuatro mensajes y el bloqueo de baja por ventana, para que mirar la vista en ' +
    'local no sea mirar una pantalla distinta a la de produccion');

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

console.log('\n' + (fallas === 0 ? 'TODO EN VERDE (26 secciones)' : fallas + ' PRUEBA(S) FALLARON'));
process.exit(fallas === 0 ? 0 : 1);
