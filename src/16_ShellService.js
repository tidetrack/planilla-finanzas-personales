/**
 * 16_ShellService.js - el Centro de Operaciones: una sola implementacion, N puertas.
 *
 * [CONCEPTO DE NEGOCIO]
 * El objetivo del producto es que Franco no necesite tocar la hoja para operar. Hoy el menu
 * "Tidetrack" tiene tres items y toda la potencia vive en el menu Dev, que son herramientas
 * de migracion con patron estado/aplicar/revertir -- no herramientas de uso diario. Este
 * modulo abre el shell donde van a vivir las seis funciones del uso cotidiano.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es la Fase 5 del arnes, portada de planilla-pymes (07_UI_Shell.html +
 * 07_Backend_AccesosRapidos.js). Tres decisiones vienen de ahi y una la corrige.
 *
 *   1. UNA SOLA IMPLEMENTACION, N PUERTAS DE ENTRADA. Cada item de menu abre EL MISMO shell
 *      parado en una vista distinta. addItem() de Apps Script no acepta argumentos, asi que
 *      cada puerta es una funcion nombrada de una linea que delega en _abrirShell(vista).
 *
 *   2. UN SOLO ROUND-TRIP PARA EL CATALOGO, pero PEREZOSO -- y aca se corrige a pymes por
 *      segunda vez. obtenerCatalogoShell() trae el Plan de Cuentas entero de una vez, en lugar
 *      de un viaje por categoria como hacia el ABM viejo. Pero NO se pide al abrir: el shell
 *      hace CERO llamadas al servidor en el arranque. La primera version lo pedia en el
 *      DOMContentLoaded detras de un overlay y en la planilla real tardo mas de 30 segundos,
 *      con el Home tapado todo ese tiempo -- cuando el Home no necesita un solo dato de ese
 *      catalogo: son seis tarjetas de texto fijo. El costo de abrir tiene que ser el costo de
 *      lo que se ve, no el del formulario mas caro que todavia no se abrio.
 *
 *   3. LA WHITELIST DE VISTAS ES UNA SOLA. En pymes la lista vive en TRES lugares que hay que
 *      mantener a la par a mano, y ya fallo: dos items abrian el Home en silencio porque sus
 *      vistas faltaban en la whitelist del backend. Aca SHELL_VISTAS es la unica, el backend
 *      la usa para validar y se la INYECTA al HTML por template, asi que el router del cliente
 *      no puede desincronizarse de ella: no hay dos listas que puedan diferir.
 *
 * decision Franco 2026-08-24: modal de 900x700, no sidebar. showSidebar tiene 300 px fijos --
 * la API ignora setWidth() -- y la pantalla de Conciliacion necesita cuatro columnas de
 * numeros por cada uno de los quince medios. Ademas el argumento de "ver la hoja al lado" no
 * se sostiene: el saldo por medio no esta en ninguna celda, lo calcula el backend. 900 y no
 * los 1000 de pymes porque el contenido mas ancho entra con holgura; 700 y no 760 porque el
 * ABM ya esta en 750 y es el techo practico -- un modal que se corta abajo esconde el boton
 * de confirmar, que es la peor falla posible en una herramienta de habito.
 *
 * LAS DIMENSIONES SE DECLARAN UNA SOLA VEZ, en SHELL_GEOMETRIA, y el mismo objeto se inyecta
 * al HTML por template. En pymes ese numero vive en tres lugares que ya no coinciden: el
 * comentario dice 1120, el codigo 1000 y el fragmento 1080.
 *
 * @see docs/permanente/ARNES_TIDETRACK.md seccion 7 (Fase 5 - Centro de Operaciones)
 * @version 0.47.0
 * @since 0.47.0
 * @lastModified 2026-08-24
 */

// ============================================
// CONTRATO DEL SHELL
// ============================================

/** Dimensiones del modal. FUENTE UNICA: el HTML las recibe de aca, no las repite. */
const SHELL_GEOMETRIA = { ancho: 900, alto: 700 };

/**
 * Las vistas del shell. UNICA lista: el backend valida contra ella y se la inyecta al
 * cliente, que arma su router desde esto. Agregar una vista es agregar una linea aca.
 *
 * `listo` distingue lo que YA opera de lo que todavia es diseno. Una tarjeta que promete algo
 * que no hace es peor que una que dice cuando va a estar: el shell muestra el estado real.
 */
const SHELL_VISTAS = [
    { id: 'home', titulo: 'Tidetrack', subtitulo: 'Que queres hacer', listo: true },
    { id: 'movimiento', titulo: 'Movimiento nuevo', subtitulo: 'Un gasto o un ingreso', listo: false },
    { id: 'traspaso', titulo: 'Traspaso nuevo', subtitulo: 'Plata de una caja a otra', listo: false },
    { id: 'proyeccion', titulo: 'Proyeccion nueva', subtitulo: 'Lo que pensas gastar', listo: false },
    { id: 'recurrentes', titulo: 'Gastos recurrentes', subtitulo: 'Lo que se repite todos los meses', listo: false },
    { id: 'conciliacion', titulo: 'Conciliacion', subtitulo: 'Lo que dice el sistema contra lo que hay', listo: false }
];

/** La vista a la que se cae si alguien pide una que no existe. */
const SHELL_VISTA_DEFECTO = 'home';

// ============================================
// PUERTAS DE ENTRADA
// ============================================
// Una funcion por item de menu, de una linea, porque addItem() no acepta argumentos.

/** Abre el Centro de Operaciones en el Home. */
function abrirTidetrack() { _abrirShell('home'); }

/** Abre el Centro de Operaciones directo en "Movimiento nuevo". */
function abrirMovimientoNuevo() { _abrirShell('movimiento'); }

/** Abre el Centro de Operaciones directo en "Traspaso nuevo". */
function abrirTraspasoNuevo() { _abrirShell('traspaso'); }

/** Abre el Centro de Operaciones directo en "Proyeccion nueva". */
function abrirProyeccionNueva() { _abrirShell('proyeccion'); }

/** Abre el Centro de Operaciones directo en "Gastos recurrentes". */
function abrirRecurrentes() { _abrirShell('recurrentes'); }

/** Abre el Centro de Operaciones directo en "Conciliacion". */
function abrirConciliacionNueva() { _abrirShell('conciliacion'); }

// ============================================
// APERTURA
// ============================================

/**
 * Abre el shell parado en una vista.
 *
 * @param {string} vista Id de SHELL_VISTAS. Si no existe, cae al Home en silencio -- que es lo
 *   correcto: una puerta mal escrita tiene que dejar al usuario adentro, no darle un error.
 */
function _abrirShell(vista) {
    const valida = SHELL_VISTAS.some(function (v) { return v.id === vista; });
    if (!valida) {
        logInfo('_abrirShell: vista desconocida "' + vista + '", se abre el Home.');
        vista = SHELL_VISTA_DEFECTO;
    }
    const tpl = HtmlService.createTemplateFromFile('UI_Shell');
    tpl.vistaInicial = vista;
    tpl.ancho = SHELL_GEOMETRIA.ancho;
    tpl.alto = SHELL_GEOMETRIA.alto;
    tpl.vistasJson = JSON.stringify(SHELL_VISTAS);
    // El pie viaja EN LA PLANTILLA, no por google.script.run.
    //
    // decision Franco 2026-08-24: el shell hace CERO llamadas al servidor al abrir. La primera
    // version pedia el catalogo entero del Plan de Cuentas en el DOMContentLoaded y tapaba todo
    // con un overlay hasta que volviera; en la planilla real eso tardo mas de 30 segundos y el
    // Home quedo inusable. Y el Home no necesita un solo dato de ese catalogo: son seis
    // tarjetas de texto fijo. Lo unico que si necesitaba -- el nombre de la planilla y la
    // version, para el pie -- ya lo tiene el servidor en el momento de renderizar, asi que se
    // inyecta y no cuesta ningun viaje.
    tpl.planilla = _nombrePlanillaShell();
    tpl.version = (typeof VERSION === 'object' && VERSION.toString) ? VERSION.toString() : '';

    const html = tpl.evaluate()
        .setWidth(SHELL_GEOMETRIA.ancho)
        .setHeight(SHELL_GEOMETRIA.alto);
    // El titulo se rellena con espacios para blanquear la barra del modal: el protagonismo es
    // de la vista, que trae su propio encabezado. Mismo truco que el ABM y que pymes.
    SpreadsheetApp.getUi().showModalDialog(html, '          ');
}

// ============================================
// DATOS
// ============================================

/**
 * TODO el catalogo que el shell necesita, en un solo viaje.
 *
 * PEREZOSO: NO se llama al abrir. Lo pide la primera vista que necesita un desplegable, y a
 * partir de ahi queda en memoria del cliente para todas las demas. Un solo viaje, pero cuando
 * hace falta -- no antes de dejar ver el Home.
 *
 * @returns {Object} catalogo completo, o {error} si algo falla -- nunca lanza: una excepcion
 *   del servidor deja al cliente sin withFailureHandler mostrando un loader eterno, que es
 *   exactamente el bug que costo cuatro dias en la v0.45.2.
 */
function obtenerCatalogoShell() {
    try {
        const nombresDe = function (clave) {
            try {
                return getTableData(clave)
                    .map(function (f) { return String(f[0] || '').trim(); })
                    .filter(function (v) { return v !== ''; });
            } catch (e) {
                logError('obtenerCatalogoShell: no se pudo leer ' + clave, e);
                return [];
            }
        };

        // Los medios son el unico bloque con tres columnas: nombre, moneda y tipo. La moneda
        // es la que el formulario va a pre-llenar sola (ADR-002) y el tipo es lo que decide si
        // un traspaso capitaliza o no.
        let medios = [];
        try {
            medios = getTableData('MEDIOS_PAGO')
                .map(function (f) {
                    return {
                        nombre: String(f[0] || '').trim(),
                        moneda: String(f[1] || '').trim(),
                        tipo: String(f[2] || '').trim()
                    };
                })
                .filter(function (m) { return m.nombre !== ''; });
        } catch (e) {
            logError('obtenerCatalogoShell: no se pudieron leer los medios', e);
        }

        return {
            ok: true,
            planilla: _nombrePlanillaShell(),
            version: (typeof VERSION === 'object' && VERSION.toString) ? VERSION.toString() : '',
            ingresos: nombresDe('INGRESOS'),
            fijos: nombresDe('GASTOS_FIJOS'),
            variables: nombresDe('GASTOS_VARIABLES'),
            categorias: nombresDe('CATEGORIAS_CUENTA'),
            medios: medios,
            monedas: MONEDAS_DISPONIBLES,
            // Las comodines viajan aparte de las tres listas de cuentas: no son ingreso ni
            // gasto, y el formulario tiene que poder ofrecerlas sin mezclarlas.
            // @see DEVTOOL_CuentasComodin.js
            comodines: CUENTAS_NEUTRAS
        };
    } catch (e) {
        logError('obtenerCatalogoShell', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Cierra el shell y abre el ABM del Plan de Cuentas.
 *
 * Apps Script no anida modales: showModalDialog reemplaza al que este abierto. Por eso
 * "Gestionar cuentas" no es una vista del shell todavia sino un salto al modal que ya existe
 * y ya funciona. Cuando el ABM se convierta en fragmento (contrato de la Fase 5) pasa a ser
 * una vista mas y esta funcion desaparece.
 */
function abrirAbmDesdeShell() {
    showAbmPlanCuentas();
}

/**
 * Dispara el procesamiento del lote de la hoja de Cargas desde el shell.
 *
 * No duplica logica: llama al mismo procesarCargas de siempre. Es el unico lugar que congela
 * las cuatro cotizaciones y deduce el tipo de cuenta, y este repo ya dejo escrito por que no
 * puede haber una segunda implementacion equivalente.
 *
 * @returns {{ok:boolean, error?:string}}
 */
function procesarCargasDesdeShell() {
    try {
        procesarCargas();
        return { ok: true };
    } catch (e) {
        logError('procesarCargasDesdeShell', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Mide cuanto tarda cada lectura del catalogo. Solo lectura, no escribe nada.
 *
 * Existe porque la primera version del shell tardaba mas de 30 segundos en abrir y no habia
 * forma de saber POR QUE: cinco lecturas encadenadas detras de un overlay dan un unico numero
 * inutil. Esto las separa y las cronometra una por una, mas el costo de abrir la planilla.
 * Si manana el shell vuelve a ponerse lento, el primer paso es correr esto y mirar el numero,
 * no adivinar.
 *
 * @returns {{ok:boolean, detalle?:string, error?:string}}
 */
function diagnosticarShell() {
    try {
        const l = [];
        const t0 = new Date().getTime();
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojas = ss.getSheets().length;
        l.push('Abrir la planilla y contar hojas: ' + (new Date().getTime() - t0) + ' ms  (' +
            hojas + ' hojas)');

        ['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES', 'CATEGORIAS_CUENTA', 'MEDIOS_PAGO']
            .forEach(function (clave) {
                const t = new Date().getTime();
                let filas = 0, err = '';
                try { filas = getTableData(clave).length; }
                catch (e) { err = ' ERROR: ' + (e && e.message ? e.message : e); }
                l.push('getTableData(' + clave + '): ' + (new Date().getTime() - t) + ' ms  (' +
                    filas + ' filas)' + err);
            });

        const t1 = new Date().getTime();
        const cat = obtenerCatalogoShell();
        l.push('obtenerCatalogoShell() completo: ' + (new Date().getTime() - t1) + ' ms  (ok=' +
            (cat && cat.ok) + ')');
        l.push('');
        l.push('TOTAL: ' + (new Date().getTime() - t0) + ' ms');
        l.push('');
        l.push('Referencia: el shell abre SIN hacer ninguna de estas llamadas. Este catalogo lo');
        l.push('pide recien la primera pantalla que necesita un desplegable.');

        const detalle = l.join('\n');
        try {
            SpreadsheetApp.getUi().alert('Shell - diagnostico de tiempos', detalle,
                SpreadsheetApp.getUi().ButtonSet.OK);
        } catch (e) { Logger.log(detalle); }
        return { ok: true, detalle: detalle };
    } catch (e) {
        logError('diagnosticarShell', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/** El nombre de la planilla, para el pie del shell. Nunca hace fallar la apertura. */
function _nombrePlanillaShell() {
    try {
        return SpreadsheetApp.getActiveSpreadsheet().getName();
    } catch (e) {
        return '';
    }
}
