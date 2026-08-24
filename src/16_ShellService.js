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
 *   2. UN SOLO ROUND-TRIP AL ABRIR. obtenerCatalogoShell() trae el Plan de Cuentas entero de
 *      una vez y con eso se pueblan todos los desplegables. El ABM viejo hacia un viaje por
 *      categoria; con seis pantallas en el mismo shell eso se vuelve caro.
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
 * Se llama una vez en el DOMContentLoaded y alimenta todos los desplegables de todas las
 * vistas. Cada pantalla despues hace su init perezoso con lo que ya esta en memoria.
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

/** El nombre de la planilla, para el pie del shell. Nunca hace fallar la apertura. */
function _nombrePlanillaShell() {
    try {
        return SpreadsheetApp.getActiveSpreadsheet().getName();
    } catch (e) {
        return '';
    }
}
