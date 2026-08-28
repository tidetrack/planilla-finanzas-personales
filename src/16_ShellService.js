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
 * decision Franco 2026-08-25: la banda no lleva subtitulo. "Que queres hacer" al lado del
 * wordmark no decia nada que la pantalla no dijera ya -- las tarjetas del home tienen su
 * propia descripcion, mas larga y mas concreta. Con el span se va el campo `subtitulo`:
 * era su UNICO consumidor, y un campo muerto en esta lista viaja igual en cada apertura
 * del shell, porque SHELL_VISTAS se inyecta ENTERA por template.
 *
 * Las vistas del shell. UNICA lista: el backend valida contra ella y se la inyecta al
 * cliente, que arma su router desde esto. Agregar una vista es agregar una linea aca.
 *
 * `listo` distingue lo que YA opera de lo que todavia es diseno. Una tarjeta que promete algo
 * que no hace es peor que una que dice cuando va a estar: el shell muestra el estado real.
 */
const SHELL_VISTAS = [
    { id: 'home', titulo: 'tidetrack', listo: true },
    { id: 'movimiento', titulo: 'Movimiento nuevo', listo: true },
    { id: 'traspaso', titulo: 'Traspaso nuevo', listo: true },
    { id: 'proyeccion', titulo: 'Proyeccion nueva', listo: true },
    { id: 'recurrentes', titulo: 'Gastos recurrentes', listo: true },
    { id: 'conciliacion', titulo: 'Conciliacion', listo: true }
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
    // Los tipos que componen la riqueza viajan al cliente para que el formulario de traspaso
    // pueda avisar "esto capitaliza" sin retipear la lista. TIPOS_RIQUEZA sigue siendo el SSOT.
    tpl.tiposRiquezaJson = JSON.stringify(TIPOS_RIQUEZA);
    tpl.planilla = _nombrePlanillaShell();
    tpl.version = (typeof VERSION === 'object' && VERSION.toString) ? VERSION.toString() : '';

    // Se cronometra la EVALUACION de la plantilla, que es lo unico caro del camino de
    // apertura: procesa los scriptlets y resuelve el include del design system. El numero
    // queda guardado para que diagnosticarShell lo pueda mostrar sin tener que adivinar.
    const t0 = new Date().getTime();
    const html = tpl.evaluate()
        .setWidth(SHELL_GEOMETRIA.ancho)
        .setHeight(SHELL_GEOMETRIA.alto);
    _marcarTiempo('shell_evaluar_ms', new Date().getTime() - t0);
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
            comodines: CUENTAS_NEUTRAS,
            // Cuantas filas quedan libres en la grilla de Cargas. El cliente lo necesita para
            // cortar el boton "Agregar otro" en el tope REAL: la grilla de personales es de
            // altura fija (15 filas), a diferencia de las 50 de pymes. Sin esto, el operador
            // tipea diez bloques para que el backend le diga que no entran.
            libres: _filasLibresCargas(),
            // La ALTURA de la grilla, para que el cliente pueda decir en cuantas tandas se va
            // a procesar un lote grande. El tope de la grilla ya no corta la carga, pero el
            // usuario tiene derecho a saber que su lote de 40 son tres pasadas.
            filasGrilla: RANGES.CARGAS.filas
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

        // El costo de EVALUAR LA PLANTILLA del shell, medido aparte: es lo unico caro del
        // camino de apertura que este codigo controla.
        const tTpl = new Date().getTime();
        const tpl = HtmlService.createTemplateFromFile('UI_Shell');
        tpl.vistaInicial = 'home';
        tpl.ancho = SHELL_GEOMETRIA.ancho;
        tpl.alto = SHELL_GEOMETRIA.alto;
        tpl.vistasJson = JSON.stringify(SHELL_VISTAS);
        tpl.tiposRiquezaJson = JSON.stringify(TIPOS_RIQUEZA);
        tpl.planilla = ''; tpl.version = '';
        const salida = tpl.evaluate().getContent();
        l.push('Evaluar la plantilla del shell: ' + (new Date().getTime() - tTpl) + ' ms  (' +
            Math.round(salida.length / 1024) + ' KB de HTML)');

        const t1 = new Date().getTime();
        const cat = obtenerCatalogoShell();
        l.push('obtenerCatalogoShell() completo: ' + (new Date().getTime() - t1) + ' ms  (ok=' +
            (cat && cat.ok) + ')');
        l.push('');
        l.push('TOTAL: ' + (new Date().getTime() - t0) + ' ms');
        l.push('');
        l.push('Referencia: el shell abre SIN hacer ninguna de estas llamadas. Este catalogo lo');
        l.push('pide recien la primera pantalla que necesita un desplegable.');
        l.push('');
        const ultima = PropertiesService.getDocumentProperties().getProperty('shell_evaluar_ms');
        if (ultima) l.push('Ultima apertura real del shell, solo la plantilla: ' + ultima + ' ms');
        l.push('');
        l.push('LO QUE ESTE NUMERO NO INCLUYE, y suele ser lo que mas se siente: Apps Script');
        l.push('PARSEA EL PROYECTO ENTERO en cada ejecucion, incluido el onOpen que dibuja el');
        l.push('menu. Hoy el proyecto pesa ~2 MB en 45 archivos. Si la plantilla y las lecturas');
        l.push('de arriba dan numeros chicos y aun asi se siente lento, el costo esta ahi y la');
        l.push('salida es sacar del deploy lo que no tiene entrada de menu.');

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

// ============================================
// ESCRITURA
// ============================================

// decision Franco 2026-08-25: se retiro _ultimosMovimientos y la tarjeta de "usar estos
// datos". Franco: "la opcion de ultimos registro no me gusta, es al pedo". El arnes pedia
// "maximo 2 toques" y la respuesta a eso resulto ser la CARGA MULTIPLE, no adivinarle el
// proximo movimiento: cuando cargas seis gastos de una sentada, lo que ahorra tiempo es no
// tener que abrir seis veces el formulario. Se va tambien la lectura del ledger que la
// alimentaba: un viaje menos.

/**
 * Estado de la grilla de Cargas: cuantas filas libres quedan y cuantas ya estan ocupadas.
 *
 * Importa por dos razones. Una: la grilla es de ALTURA FIJA (15 filas) y un traspaso consume
 * dos, asi que sembrar sin mirar puede escribir fuera del area que procesarCargas lee. Dos:
 * procesarCargas hace clearContent() sobre la grilla ENTERA al terminar, no sobre el lote --
 * si Franco tiene filas tipeadas a mano, se procesan junto con la nuestra. Eso no es un bug
 * que este modulo pueda arreglar, pero SI se lo puede decir antes en vez de sorprenderlo.
 */
function _estadoGrillaCargas(hojaCargas) {
    const cfg = RANGES.CARGAS;
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const datos = hojaCargas.getRange(cfg.dataRow, colIni, cfg.filas, nCols).getValues();
    let ocupadas = 0;
    let primeraLibre = -1;
    datos.forEach(function (fila, i) {
        const vacia = fila.every(function (c) { return c === '' || c === null; });
        if (vacia) { if (primeraLibre === -1) primeraLibre = i; }
        else { ocupadas++; }
    });
    return {
        ocupadas: ocupadas,
        primeraLibre: primeraLibre,
        libres: cfg.filas - ocupadas,
        filaHoja: primeraLibre === -1 ? -1 : cfg.dataRow + primeraLibre
    };
}

/** Arma la fila de la grilla en el ORDEN de RANGES.CARGAS, sin retipear posiciones. */
function _filaDeCarga(d) {
    const c = RANGES.CARGAS.columns;
    const colIni = columnLetterToIndex(RANGES.CARGAS.start);
    const fila = [];
    for (let i = 0; i < columnLetterToIndex(RANGES.CARGAS.end) - colIni + 1; i++) fila.push('');
    fila[columnLetterToIndex(c.monto) - colIni] = d.monto;
    fila[columnLetterToIndex(c.tipo) - colIni] = d.tipo;
    fila[columnLetterToIndex(c.cuenta) - colIni] = d.cuenta;
    fila[columnLetterToIndex(c.medio) - colIni] = d.medio;
    fila[columnLetterToIndex(c.moneda) - colIni] = d.moneda;
    fila[columnLetterToIndex(c.fecha) - colIni] = d.fecha;
    fila[columnLetterToIndex(c.nota) - colIni] = d.nota || '';
    return fila;
}

/**
 * Valida lo que manda el cliente. Devuelve la lista de problemas; vacia = todo bien.
 *
 * La validacion vive EN EL SERVIDOR aunque el cliente ya valide: el cliente es sugerencia, el
 * servidor es la regla. Y procesarCargas tiene un gap conocido -- su unico filtro es "monto no
 * vacio", asi que una fila sin cuenta entra igual al ledger con tipo vacio. Este es el lugar
 * donde ese gap se tapa para todo lo que entre por el shell.
 */
function _validarMovimiento(d, catalogos) {
    const p = [];
    const monto = Number(d.monto);
    if (!d.monto && d.monto !== 0) p.push('Falta el monto.');
    else if (isNaN(monto)) p.push('El monto no es un numero.');
    else if (monto <= 0) p.push('El monto tiene que ser mayor a cero. Para que salga plata, elegi el tipo Egreso.');

    if (!d.cuenta) p.push('Falta la cuenta.');
    if (!d.medio) p.push('Falta el medio.');
    if (!d.tipo) p.push('Falta el tipo (Ingreso o Egreso).');
    if (d.moneda && MONEDAS_DISPONIBLES.indexOf(d.moneda) === -1) {
        p.push('La moneda "' + d.moneda + '" no es una de las que maneja la planilla.');
    }
    if (d.medio && catalogos && catalogos.medios && catalogos.medios.indexOf(d.medio) === -1) {
        p.push('El medio "' + d.medio + '" no esta en el Plan de Cuentas.');
    }
    if (d.fecha) {
        const f = new Date(d.fecha);
        if (isNaN(f.getTime())) p.push('La fecha no se entiende.');
        else if (f > _finDeHoy()) p.push('La fecha es futura. procesarCargas rechaza el lote entero si encuentra una.');
    }
    return p;
}

/** Fin del dia de hoy, para comparar fechas sin que la hora del momento moleste. */
function _finDeHoy() {
    const h = new Date();
    h.setHours(23, 59, 59, 999);
    return h;
}

/** Filas libres de la grilla de Cargas. Nunca lanza: si falla, se asume la grilla entera. */
function _filasLibresCargas() {
    try {
        const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RANGES.CARGAS.sheet);
        if (!hoja) return RANGES.CARGAS.filas;
        return _estadoGrillaCargas(hoja).libres;
    } catch (e) {
        logError('_filasLibresCargas', e);
        return RANGES.CARGAS.filas;
    }
}

/** Los nombres de medio del catalogo, para validar sin traer todo el objeto. */
function _nombresDeMedio() {
    try {
        return getTableData('MEDIOS_PAGO')
            .map(function (f) { return String(f[0] || '').trim(); })
            .filter(function (v) { return v !== ''; });
    } catch (e) {
        logError('_nombresDeMedio', e);
        return [];
    }
}

/**
 * Registra UN movimiento: siembra una fila en la grilla de Cargas y deja que procesarCargas
 * haga el resto.
 *
 * NO escribe en "Registros" directo, y es deliberado. procesarCargas es el UNICO lugar que
 * congela las cuatro cotizaciones del dia, persiste las nuevas al Data Lake, deduce el tipo de
 * cuenta y reordena el ledger. Este repo ya dejo escrito por que no puede haber una segunda
 * implementacion "equivalente": es la forma mas barata de que dos partes del sistema
 * clasifiquen distinto sin que nadie se entere.
 *
 * @param {Object} d {monto, tipo, cuenta, medio, moneda, fecha, nota}
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function registrarMovimiento(d) {
    return _conLock(function () {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaCargas = ss.getSheetByName(RANGES.CARGAS.sheet);
        if (!hojaCargas) return { ok: false, error: 'No existe la hoja "' + RANGES.CARGAS.sheet + '".' };

        const problemas = _validarMovimiento(d, { medios: _nombresDeMedio() });
        if (problemas.length) return { ok: false, problemas: problemas };

        const grilla = _estadoGrillaCargas(hojaCargas);
        if (grilla.primeraLibre === -1) {
            return { ok: false, error: 'La grilla de Cargas esta llena (' + RANGES.CARGAS.filas +
                ' filas). Procesa lo que hay antes de cargar otro movimiento.' };
        }

        const colIni = columnLetterToIndex(RANGES.CARGAS.start);
        const fila = _filaDeCarga(d);
        hojaCargas.getRange(grilla.filaHoja, colIni, 1, fila.length).setValues([fila]);
        SpreadsheetApp.flush();

        procesarCargas();

        const otras = grilla.ocupadas;
        let mensaje = 'Listo. Cargaste ' + _plata(d.monto, d.moneda) + ' en ' + d.cuenta + '.';
        if (otras > 0) {
            mensaje += ' Se procesaron tambien ' + otras + ' fila(s) que ya estaban en la grilla.';
        }
        return { ok: true, mensaje: mensaje };
    });
}

/**
 * Registra VARIOS movimientos de una sola vez.
 *
 * [POR QUE EXISTE, y no es solo comodidad]
 * Cada llamada a registrarMovimiento dispara un procesarCargas COMPLETO: pega a las APIs de
 * cotizacion, persiste lo nuevo al Data Lake, reordena el ledger entero por fecha. Cargar seis
 * gastos de a uno son seis pasadas de eso. En lote es UNA. La carga multiple es, antes que una
 * comodidad, la forma de que cargar seis cosas no cueste seis veces lo que cuesta una.
 *
 * [CONTRATO]
 * O ENTRAN TODOS O NO ENTRA NINGUNO. Se valida el lote entero ANTES de escribir una sola
 * celda, y se devuelve el numero de fila de cada problema para que la pantalla pueda marcar
 * cual esta mal. Un lote a medio escribir en la grilla es peor que un lote rechazado: la mitad
 * buena se procesa en la corrida siguiente sin que nadie recuerde por que estaba ahi.
 *
 * @param {Array<Object>} lista movimientos {monto, tipo, cuenta, medio, moneda, fecha, nota}
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function registrarMovimientos(lista) {
    return _conLock(function () { return _registrarMovimientosSinLock(lista); });
}

/**
 * El cuerpo de registrarMovimientos, SIN lock propio.
 *
 * Existe porque el lock de documento no es reentrante garantizado y la Conciliacion necesita
 * medir los saldos y escribir sus ajustes bajo EL MISMO lock: si registrarConciliacion llamara
 * a registrarMovimientos (que toma el suyo), el segundo tryLock podria fallar contra el primero.
 * Todo caller NUEVO tiene que envolverlo en _conLock; nunca llamarlo pelado desde un endpoint.
 */
function _registrarMovimientosSinLock(lista) {
        if (!Array.isArray(lista) || !lista.length) {
            return { ok: false, error: 'No llego ningun movimiento para cargar.' };
        }
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaCargas = ss.getSheetByName(RANGES.CARGAS.sheet);
        if (!hojaCargas) return { ok: false, error: 'No existe la hoja "' + RANGES.CARGAS.sheet + '".' };

        // El catalogo de medios se lee UNA vez para todo el lote, no una por fila.
        const medios = _nombresDeMedio();

        const problemas = [];
        lista.forEach(function (d, i) {
            _validarMovimiento(d, { medios: medios }).forEach(function (p) {
                problemas.push('Fila ' + (i + 1) + ': ' + p);
            });
        });
        if (problemas.length) return { ok: false, problemas: problemas };

        // EL TOPE DE LA GRILLA NO ES EL TOPE DE LA CARGA.
        //
        // decision Franco 2026-08-25: "deberia dejar cargar muchos mas movimientos, no solo
        // 15". La grilla de Cargas es de altura fija (RANGES.CARGAS.filas) y esa es una
        // restriccion de LA HOJA, no del acto de cargar. Se procesa en TANDAS: se siembra lo
        // que entra, se procesa, y se repite con lo que queda. Cada tanda es un procesarCargas
        // -- con su pasada de cotizaciones -- asi que se avisa cuantas van a ser, pero ya no
        // hay un numero que corte la carga.
        const colIni = columnLetterToIndex(RANGES.CARGAS.start);
        let entraron = 0;
        let tandas = 0;

        while (entraron < lista.length) {
            const grilla = _estadoGrillaCargas(hojaCargas);
            if (grilla.libres <= 0) {
                return { ok: false, error: 'La grilla de Cargas quedo sin filas libres despues ' +
                    'de ' + tandas + ' tanda(s). Entraron ' + entraron + ' de ' + lista.length +
                    ' movimientos; revisa la hoja antes de reintentar el resto.' };
            }
            const tanda = lista.slice(entraron, entraron + grilla.libres);
            const filas = tanda.map(_filaDeCarga);

            // UNA sola escritura por tanda: si se escribiera fila por fila y fallara la
            // tercera, quedarian dos sueltas en la grilla.
            hojaCargas.getRange(grilla.filaHoja, colIni, filas.length, filas[0].length).setValues(filas);
            SpreadsheetApp.flush();
            procesarCargas();

            entraron += tanda.length;
            tandas++;
        }

        const total = lista.reduce(function (a, d) { return a + (Number(d.monto) || 0); }, 0);
        const monedas = {};
        lista.forEach(function (d) { monedas[d.moneda] = true; });
        const unaSolaMoneda = Object.keys(monedas).length === 1;

        let mensaje = lista.length === 1
            ? 'Listo. Cargaste ' + _plata(lista[0].monto, lista[0].moneda) + ' en ' + lista[0].cuenta + '.'
            : 'Listo. Cargaste ' + lista.length + ' movimientos' +
              (unaSolaMoneda ? ', ' + _plata(total, lista[0].moneda) + ' en total' : '') + '.';
        if (tandas > 1) mensaje += ' Se procesaron en ' + tandas + ' tandas.';
        return { ok: true, mensaje: mensaje };
}

/**
 * Registra un traspaso entre dos cajas propias: DOS filas, una que sale y una que entra.
 *
 * El modelo ya estaba adoptado en este repo antes que la herramienta -- CUENTAS_NEUTRAS lo
 * documenta y el ledger tiene 533 pares historicos -- pero las dos filas se tipeaban a mano,
 * que es de donde salen las variantes "traspaso " que arruinan los agregados. Aca se escriben
 * juntas o no se escribe ninguna: media operacion hace desaparecer plata del sistema.
 *
 * MULTIMONEDA: la moneda de cada pata la decide el CATALOGO, no el operador. Si las cajas no
 * comparten moneda hay que dar los dos montos, y el tipo de cambio de la operacion queda
 * escrito en la nota -- el ledger congela el TC OFICIAL del dia, que casi nunca es al que se
 * opero, asi que el dato se perderia si no se guardara aca.
 *
 * @param {Object} d {origen, destino, montoOrigen, montoDestino, fecha, nota}
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function registrarTraspaso(d) {
    return registrarTraspasos([d]);
}

/** El catalogo de medios como mapa nombre -> {moneda, tipo}. Una sola lectura por lote. */
function _mapaDeMedios() {
    const medios = {};
    getTableData('MEDIOS_PAGO').forEach(function (f) {
        const n = String(f[0] || '').trim();
        if (n) medios[n] = { moneda: String(f[1] || '').trim(), tipo: String(f[2] || '').trim() };
    });
    return medios;
}

/**
 * Valida UN traspaso y devuelve sus dos patas listas para sembrar.
 * @returns {{problemas:Array<string>, filas?:Array, resumen?:Object}}
 */
function _prepararTraspaso(d, medios) {
        const problemas = [];
        if (!d.origen) problemas.push('Falta la caja de origen.');
        if (!d.destino) problemas.push('Falta la caja de destino.');
        if (d.origen && !medios[d.origen]) problemas.push('El medio "' + d.origen + '" no esta en el Plan de Cuentas.');
        if (d.destino && !medios[d.destino]) problemas.push('El medio "' + d.destino + '" no esta en el Plan de Cuentas.');
        if (d.origen && d.origen === d.destino) problemas.push('El origen y el destino son la misma caja.');

        const mOrigen = d.origen && medios[d.origen] ? medios[d.origen].moneda : '';
        const mDestino = d.destino && medios[d.destino] ? medios[d.destino].moneda : '';
        const cruzaMoneda = mOrigen && mDestino && mOrigen !== mDestino;

        const montoO = Number(d.montoOrigen);
        if (!d.montoOrigen && d.montoOrigen !== 0) problemas.push('Falta el monto que sale.');
        else if (isNaN(montoO) || montoO <= 0) problemas.push('El monto que sale tiene que ser un numero mayor a cero.');

        let montoD = montoO;
        if (cruzaMoneda) {
            montoD = Number(d.montoDestino);
            if (!d.montoDestino && d.montoDestino !== 0) {
                problemas.push('Las dos cajas tienen monedas distintas (' + mOrigen + ' y ' + mDestino +
                    '), asi que hace falta tambien el monto que entra.');
            } else if (isNaN(montoD) || montoD <= 0) {
                problemas.push('El monto que entra tiene que ser un numero mayor a cero.');
            }
        }
        if (d.fecha) {
            const f = new Date(d.fecha);
            if (isNaN(f.getTime())) problemas.push('La fecha no se entiende.');
            else if (f > _finDeHoy()) problemas.push('La fecha es futura.');
        }
        if (problemas.length) return { problemas: problemas };

        // La nota es la MISMA en las dos patas: es lo unico que permite reconstruir el par
        // despues, porque el ledger no tiene un campo que las vincule.
        let nota = d.nota || ('Traspaso ' + d.origen + ' a ' + d.destino);
        if (cruzaMoneda) {
            const tc = Math.round((montoO / montoD) * 100) / 100;
            nota += '. TC de la operacion ' + tc;
        }

        const base = { cuenta: CUENTAS_NEUTRAS[0], fecha: d.fecha, nota: nota };
        const sale = _filaDeCarga(Object.assign({}, base,
            { monto: montoO, tipo: 'Egreso', medio: d.origen, moneda: mOrigen }));
        const entra = _filaDeCarga(Object.assign({}, base,
            { monto: montoD, tipo: 'Ingreso', medio: d.destino, moneda: mDestino }));

        return {
            problemas: [],
            filas: [sale, entra],
            resumen: { origen: d.origen, destino: d.destino, montoO: montoO, montoD: montoD,
                       mOrigen: mOrigen, mDestino: mDestino, cruza: cruzaMoneda,
                       tipoDestino: medios[d.destino] ? medios[d.destino].tipo : '' }
        };
}

/**
 * Registra VARIOS traspasos de una vez.
 *
 * Cada traspaso son DOS filas de la grilla -- una que sale y una que entra -- y las dos se
 * escriben juntas o no se escribe ninguna: media operacion hace desaparecer plata del sistema.
 * Igual que los movimientos, el tope de la grilla no corta la carga: se procesa en tandas, y
 * una tanda nunca parte un traspaso al medio.
 *
 * @param {Array<Object>} lista {origen, destino, montoOrigen, montoDestino, fecha, nota}
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function registrarTraspasos(lista) {
    return _conLock(function () {
        if (!Array.isArray(lista) || !lista.length) {
            return { ok: false, error: 'No llego ningun traspaso para cargar.' };
        }
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaCargas = ss.getSheetByName(RANGES.CARGAS.sheet);
        if (!hojaCargas) return { ok: false, error: 'No existe la hoja "' + RANGES.CARGAS.sheet + '".' };

        let medios;
        try { medios = _mapaDeMedios(); }
        catch (e) { return { ok: false, error: 'No se pudo leer el catalogo de medios: ' + e.message }; }

        // Se valida el lote ENTERO antes de escribir una sola celda.
        const problemas = [];
        const preparados = [];
        lista.forEach(function (d, i) {
            const r = _prepararTraspaso(d, medios);
            r.problemas.forEach(function (p) { problemas.push('Traspaso ' + (i + 1) + ': ' + p); });
            if (!r.problemas.length) preparados.push(r);
        });
        if (problemas.length) return { ok: false, problemas: problemas };

        const colIni = columnLetterToIndex(RANGES.CARGAS.start);
        let hechos = 0, tandas = 0;
        while (hechos < preparados.length) {
            const grilla = _estadoGrillaCargas(hojaCargas);
            // Se divide por PARES: una tanda nunca parte un traspaso al medio.
            const caben = Math.floor(grilla.libres / 2);
            if (caben <= 0) {
                return { ok: false, error: 'La grilla de Cargas quedo sin lugar para otro par ' +
                    'despues de ' + tandas + ' tanda(s). Entraron ' + hechos + ' de ' +
                    preparados.length + ' traspasos.' };
            }
            const tanda = preparados.slice(hechos, hechos + caben);
            const filas = [];
            tanda.forEach(function (t) { filas.push(t.filas[0], t.filas[1]); });
            hojaCargas.getRange(grilla.filaHoja, colIni, filas.length, filas[0].length).setValues(filas);
            SpreadsheetApp.flush();
            procesarCargas();
            hechos += tanda.length;
            tandas++;
        }

        let mensaje;
        if (preparados.length === 1) {
            const r = preparados[0].resumen;
            mensaje = 'Listo. Pasaste ' + _plata(r.montoO, r.mOrigen) + ' de ' + r.origen +
                ' a ' + r.destino + (r.cruza ? ' (' + _plata(r.montoD, r.mDestino) + ')' : '') + '.';
            if (TIPOS_RIQUEZA.indexOf(r.tipoDestino) !== -1) {
                mensaje += ' Eso capitaliza: la plata paso a una caja de ' + r.tipoDestino + '.';
            }
        } else {
            mensaje = 'Listo. Registraste ' + preparados.length + ' traspasos.';
            const capitalizan = preparados.filter(function (t) {
                return TIPOS_RIQUEZA.indexOf(t.resumen.tipoDestino) !== -1;
            }).length;
            if (capitalizan) mensaje += ' ' + capitalizan + ' de ellos capitalizan.';
            if (tandas > 1) mensaje += ' Se procesaron en ' + tandas + ' tandas.';
        }
        return { ok: true, mensaje: mensaje };
    });
}

// ============================================
// PROYECCIONES SUELTAS (vista "Proyeccion nueva")
// ============================================

/**
 * Registra proyecciones sueltas: filas nuevas en la BD "Proyeccion", directo, sin pasar por
 * la grilla de Cargas. Contrato: o entran todas o no entra ninguna.
 *
 * NO pasa por procesarCargas, y es deliberado: una proyeccion no es un movimiento real -- no
 * tiene fecha de operacion en el ledger sino un MES OBJETIVO, y su cotizacion congelada es la
 * del dia en que se DECIDIO, no la de cada fecha de movimiento. Es exactamente la semantica de
 * "Guardar Proyeccion" (DEVTOOL_PresupuestoGuardar.js, decision 1), calcada aca sin invocar
 * sus helpers privados. La escritura es ADITIVA: el shell suma filas, nunca borra las del
 * presupuesto base ni las de un guardado previo.
 *
 * @param {Array<Object>} lista {cuenta, monto, moneda, mes ('YYYY-MM'), nota}
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function registrarProyecciones(lista) {
    return _conLock(function () {
        if (!Array.isArray(lista) || !lista.length) {
            return { ok: false, error: 'No llego ninguna proyeccion para guardar.' };
        }
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hoja = ss.getSheetByName(SHEETS.PROYECCION);
        if (!hoja) {
            return { ok: false, error: 'No existe la hoja "' + SHEETS.PROYECCION + '". Correla ' +
                'desde tidetrack Dev, "BD de Proyeccion (presupuesto)", antes de usar esta pantalla.' };
        }
        _preflightEspejoProyeccionShell(ss, hoja);

        // Se valida el lote ENTERO antes de tocar una celda (contrato de registrarMovimientos).
        const catalogos = _catalogosDeCuentasShell();
        const problemas = [];
        const tipos = [];
        lista.forEach(function (d, i) {
            const r = _validarProyeccion(d, catalogos);
            r.problemas.forEach(function (p) { problemas.push('Fila ' + (i + 1) + ': ' + p); });
            tipos.push(r.tipoCuenta);
        });
        if (problemas.length) return { ok: false, problemas: problemas };

        // Cotizaciones DESPUES de validar y ANTES de escribir: si la API falla, el corte es
        // limpio -- la excepcion sube al catch de _conLock y sale como {ok:false, error}.
        const cot = _cotizacionesCongeladasShell();

        // Resolucion de segundos (misma razon que _selloPg: dos corridas en el mismo minuto
        // son plausibles) y prefijo 'shell_' para que el origen quede auditable a simple
        // vista en la hoja y el sello sea inconfundible con los de PG.
        const sello = 'shell_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');

        // Pre-scan de convivencia (solo lectura, alimenta el mensaje final): hay ya filas de
        // estos meses, sean de un guardado previo (PG) o del presupuesto base (PB)?
        // PG_MARCA y PB_MARCA se leen ACA ADENTRO, nunca en un const de nivel superior:
        // 16_ ordena antes que DEVTOOL_ en la carga alfabetica de Apps Script y un top-level
        // que los lea tumba el proyecto entero (cicatriz v0.50.1).
        const cfg = RANGES.REGISTROS;
        const clavesLote = {};
        lista.forEach(function (d) { clavesLote[d.mes] = true; });
        let hayPrevias = false;
        const ultima = hoja.getLastRow();
        if (ultima >= cfg.dataRow) {
            const n = ultima - cfg.dataRow + 1;
            const notas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota), n, 1).getValues();
            const fechas = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.fecha), n, 1).getValues();
            Object.keys(clavesLote).forEach(function (clave) {
                if (hayPrevias) return;
                const partes = clave.split('-');
                const anio = Number(partes[0]);
                const mes = Number(partes[1]);
                for (let i = 0; i < n; i++) {
                    const nota = String(notas[i][0] || '');
                    if (nota.indexOf(PG_MARCA + ' ' + clave + ' ') === 0) { hayPrevias = true; return; }
                    if (nota.indexOf(PB_MARCA) === 0) {
                        const f = fechas[i][0];
                        if (f instanceof Date && f.getFullYear() === anio && f.getMonth() === mes - 1) {
                            hayPrevias = true;
                            return;
                        }
                    }
                }
            });
        }

        const filas = lista.map(function (d, i) { return _filaDeProyeccion(d, tipos[i], cot, sello); });

        // UNA sola escritura al pie; Proyeccion es append-only y NO se ordena (PG tampoco).
        const colIni = columnLetterToIndex(cfg.start);
        const primera = Math.max(hoja.getLastRow() + 1, cfg.dataRow);
        if (primera + filas.length - 1 > hoja.getMaxRows()) {
            asegurarCapacidadFilas(hoja, primera + filas.length - 1);
        }
        hoja.getRange(primera, colIni, filas.length, filas[0].length).setValues(filas);
        SpreadsheetApp.flush();

        // VERIFICACION por relectura: las filas de ESTA corrida son las que llevan el sello
        // (con segundos + prefijo shell_ es unico). El conteo y la suma POR MONEDA tienen que
        // cerrar contra el lote de entrada; jamas se suman monedas distintas entre si.
        const fin = hoja.getLastRow();
        const nRe = fin - cfg.dataRow + 1;
        const notasRe = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.nota), nRe, 1).getValues();
        const montosRe = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.monto), nRe, 1).getValues();
        const monedasRe = hoja.getRange(cfg.dataRow, columnLetterToIndex(cfg.columns.moneda), nRe, 1).getValues();
        const escritas = [];
        const sumaRe = {};
        for (let i = 0; i < nRe; i++) {
            if (String(notasRe[i][0] || '').indexOf(' ' + sello) === -1) continue;
            escritas.push(cfg.dataRow + i);
            const mon = String(monedasRe[i][0] || '');
            sumaRe[mon] = (sumaRe[mon] || 0) + (Number(montosRe[i][0]) || 0);
        }
        const sumaLote = {};
        lista.forEach(function (d) { sumaLote[d.moneda] = (sumaLote[d.moneda] || 0) + Number(d.monto); });
        let detalleFalla = '';
        if (escritas.length !== lista.length) {
            detalleFalla = 'se esperaban ' + lista.length + ' fila(s) y se releyeron ' + escritas.length;
        } else {
            Object.keys(sumaLote).forEach(function (mon) {
                if (Math.abs((sumaRe[mon] || 0) - sumaLote[mon]) > 0.01) {
                    detalleFalla = 'la suma en ' + mon + ' no cierra al releer';
                }
            });
        }
        if (detalleFalla) {
            _quitarFilasShell(hoja, escritas);
            SpreadsheetApp.flush();
            logError('registrarProyecciones: no verifica (' + detalleFalla + '); se quito lo escrito.');
            return { ok: false, error: 'Se escribio pero no verifica: ' + detalleFalla +
                '. Se quito lo escrito: no quedo nada a medias.' };
        }

        const claves = Object.keys(clavesLote);
        const monedasLote = Object.keys(sumaLote);
        let mensaje;
        if (lista.length === 1) {
            mensaje = 'Listo. Proyectaste ' + _plata(lista[0].monto, lista[0].moneda) + ' en ' +
                lista[0].cuenta + ' para ' + _mesEnCastellanoShell(lista[0].mes) + '.';
        } else {
            mensaje = 'Listo. Guardaste ' + lista.length + ' proyecciones' +
                (claves.length === 1 ? ' para ' + _mesEnCastellanoShell(claves[0]) : ' en varios meses') +
                (monedasLote.length === 1 ? ', ' + _plata(sumaLote[monedasLote[0]], monedasLote[0]) + ' en total' : '') +
                '.';
        }
        // decision Franco 2026-08-26: el shell SUMA, nunca reemplaza. Retirar filas base o un
        // guardado previo es territorio de Guardar Proyeccion y del ABM, que tienen respaldo y
        // reversion; duplicar esa maquinaria aca seria una segunda superficie de borrado sobre
        // una BD de produccion. El costo es que una puntual convive (y suma) con el base del
        // mismo mes: el mensaje lo dice.
        if (hayPrevias) mensaje += ' Se suman a lo que ese mes ya tenia proyectado.';
        logSuccess('registrarProyecciones: ' + lista.length + ' fila(s) en "' + SHEETS.PROYECCION + '".');
        return { ok: true, mensaje: mensaje };
    });
}

/**
 * Comprueba que "Proyeccion" siga siendo un espejo EXACTO de "Registros" en su fila de header.
 *
 * Implementacion PROPIA sobre Config (mismas fuentes que _preflightPb, cero invocaciones a
 * helpers ajenos: los DEVTOOL_Presupuesto* son de otra linea de trabajo). Al primer desvio
 * LANZA nombrando columna, esperado y vivo -- no se escribe nada.
 */
function _preflightEspejoProyeccionShell(ss, hoja) {
    const cfg = RANGES.REGISTROS;
    const hojaReg = ss.getSheetByName(cfg.sheet);
    if (!hojaReg) throw new Error('No existe el ledger "' + cfg.sheet + '".');
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const enLedger = hojaReg.getRange(cfg.headerRow, colIni, 1, nCols).getValues()[0];
    const enProy = hoja.getRange(cfg.headerRow, colIni, 1, nCols).getValues()[0];
    for (let i = 0; i < nCols; i++) {
        const esperado = String(enLedger[i] === null || enLedger[i] === undefined ? '' : enLedger[i]).trim();
        const vivo = String(enProy[i] === null || enProy[i] === undefined ? '' : enProy[i]).trim();
        if (esperado !== vivo) {
            throw new Error('La hoja "' + SHEETS.PROYECCION + '" dejo de espejar a "' + cfg.sheet +
                '": la columna ' + columnIndexToLetter(colIni + i) + ' dice "' + vivo +
                '" y se esperaba "' + esperado + '". No se escribio nada.');
        }
    }
}

/** Los tres catalogos de cuentas del Plan, una lectura por lote (mismo patron que obtenerCatalogoShell). */
function _catalogosDeCuentasShell() {
    const nombresDe = function (clave) {
        return getTableData(clave)
            .map(function (f) { return String(f[0] || '').trim(); })
            .filter(function (v) { return v !== ''; });
    };
    return {
        ingresos: nombresDe('INGRESOS'),
        fijos: nombresDe('GASTOS_FIJOS'),
        variables: nombresDe('GASTOS_VARIABLES')
    };
}

/**
 * Valida UNA proyeccion. A diferencia de _validarMovimiento, aca una cuenta fuera de catalogo
 * BLOQUEA: una fila sin tipo_cuenta valido cae en "otrasFilas" del ABM de Proyecciones
 * Elaboradas y no suma en ningun bloque del Tablero. Se clasifica SIN la opcion tolerante:
 * el nombre escrito en la BD tiene que ser el canonico del Plan, porque los consumidores
 * cruzan por nombre exacto.
 *
 * @returns {{problemas:Array<string>, tipoCuenta:string}}
 */
function _validarProyeccion(d, catalogos) {
    const problemas = [];
    let tipoCuenta = '';
    const monto = Number(d.monto);
    if (!d.monto && d.monto !== 0) problemas.push('Falta el monto.');
    else if (isNaN(monto)) problemas.push('El monto no es un numero.');
    else if (monto <= 0) problemas.push('El monto tiene que ser mayor a cero.');

    if (!d.cuenta) {
        problemas.push('Falta la cuenta.');
    } else if (esCuentaNeutra(d.cuenta)) {
        problemas.push('La cuenta "' + d.cuenta + '" es tecnica del sistema: no se proyecta.');
    } else {
        tipoCuenta = deducirTipoCuenta(d.cuenta, catalogos);
        if (tipoCuenta === '') {
            problemas.push('La cuenta "' + d.cuenta + '" no esta en el Plan de Cuentas. Una ' +
                'proyeccion necesita saber si es ingreso, gasto fijo o variable.');
        }
    }
    if (!d.moneda || MONEDAS_DISPONIBLES.indexOf(d.moneda) === -1) {
        problemas.push('La moneda "' + (d.moneda || '') + '" no es una de las que maneja la planilla.');
    }
    if (!d.mes || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(d.mes))) {
        problemas.push('El mes no se entiende: se espera anio y mes.');
    } else {
        const partes = String(d.mes).split('-');
        const primero = new Date(Number(partes[0]), Number(partes[1]) - 1, 1);
        const hoy = new Date();
        // El mes en curso SI se acepta, igual que PG lo permite desde J2/J3.
        if (primero < new Date(hoy.getFullYear(), hoy.getMonth(), 1)) {
            problemas.push('Ese mes ya paso: una proyeccion es de aca para adelante.');
        }
    }
    return { problemas: problemas, tipoCuenta: tipoCuenta };
}

/**
 * Las cuatro cotizaciones del dia, congeladas: UNA lectura por corrida (todas las filas del
 * lote son la misma decision del mismo instante, misma razon que la decision 1 de PG). Un
 * fallo de la API LANZA sin silenciarse ni reemplazarse por un default (Regla Estricta 9);
 * la excepcion la atrapa el catch de _conLock y sale como {ok:false, error}.
 */
function _cotizacionesCongeladasShell() {
    // decision Franco 2026-08-26: cotizaciones propias del shell leyendo las MISMAS custom
    // functions publicas (15_ExchangeRateApi.js) que usa Guardar Proyeccion. No se invoca
    // _leerCotizacionesVivasPg: prefijo privado de un modulo de otra linea de trabajo.
    const usd = Number(TIDETRACK_USD());
    const aud = Number(TIDETRACK_AUD());
    const eur = Number(TIDETRACK_EUR());
    const chequear = function (nombre, v) {
        if (!isFinite(v) || v <= 0) {
            throw new Error('La cotizacion de ' + nombre + ' no es un numero valido ("' + v +
                '"): no se escribio nada.');
        }
    };
    chequear('USD', usd);
    chequear('AUD', aud);
    chequear('EUR', eur);
    return { ARS: 1, USD: usd, AUD: aud, EUR: eur };
}

/** Arma la fila B:M de una proyeccion en el ORDEN de RANGES.REGISTROS (misma tecnica que _filaDeCarga). */
function _filaDeProyeccion(d, tipoCuenta, cot, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const fila = new Array(ancho).fill('');
    const poner = function (clave, valor) { fila[columnLetterToIndex(cfg.columns[clave]) - colIni] = valor; };
    // decision Franco 2026-08-26: la Nota lleva el marcado de PG a proposito. Es el UNICO
    // formato que el ABM de Proyecciones Elaboradas reconoce sin tocarlo, y retipear el literal
    // seria la segunda constante "parecida" que ya costo caro (leccion v0.46.0). La nota libre
    // del usuario viaja al final, visible en la hoja.
    const nota = PG_MARCA + ' ' + d.mes + ' ' + sello + (d.nota ? ' ' + d.nota : '');
    const partes = String(d.mes).split('-');
    poner('monto', Number(d.monto));
    poner('tipo', tipoCuenta === 'Ingreso' ? 'Ingreso' : 'Egreso');
    poner('cuenta', d.cuenta);
    poner('tipo_cuenta', tipoCuenta);
    // Misma convencion que PG: no hay medio en una proyeccion y ningun consumidor lo lee.
    poner('medio', '');
    poner('moneda', d.moneda);
    // PRIMER DIA del mes: la convencion unica de la hoja, los consumidores filtran por rango.
    poner('fecha', new Date(Number(partes[0]), Number(partes[1]) - 1, 1));
    poner('nota', nota);
    poner('tc_ars', cot.ARS);
    poner('tc_usd', cot.USD);
    poner('tc_aud', cot.AUD);
    poner('tc_eur', cot.EUR);
    return fila;
}

/** Borra una lista de filas fisicas, de abajo hacia arriba para no correr los indices. */
function _quitarFilasShell(hoja, filas) {
    filas.slice().sort(function (a, b) { return b - a; }).forEach(function (f) { hoja.deleteRow(f); });
}

/** 'sep 2026' -> 'septiembre 2026': el mes de una clave 'YYYY-MM' en castellano sobrio. */
function _mesEnCastellanoShell(clave) {
    const partes = String(clave).split('-');
    // IP_MESES se lee ACA ADENTRO (vive en DEVTOOL_InicioPresupuesto.js, que carga despues).
    const meses = IP_MESES.split(',');
    return meses[Number(partes[1]) - 1].toLowerCase() + ' ' + partes[0];
}

// ============================================
// CONCILIACION (vista "Conciliacion")
// ============================================

/** Diferencias por debajo de esto no generan ajuste (misma cifra que el DEVTOOL: sub-centavo). */
const SHELL_CONC_TOLERANCIA = 0.005;

/**
 * Saldo por medio con la regla que cierra al centavo: ultimo asiento CUENTA_ARRASTRE del
 * medio + todo lo posterior (fecha >= corte). PORT VERBATIM de _planConciliar
 * (DEVTOOL_ConciliarSaldos.js:198-252, validado 5/7 al centavo contra saldos reales el
 * 2026-08-19): mismas lecturas via RANGES, mismo corte, mismo neto. Vive aca y no se invoca
 * el DEVTOOL porque aquel es un one-shot con los objetivos de Franco hardcodeados, candidato
 * declarado a salir del deploy, y su retorno no trae los saldos de todos los medios.
 *
 * @returns {{medios:Array<{medio:string, moneda:string, saldo:number}>, ultimaFechaLedger:string}}
 */
function _saldosPorMedioShell(ss) {
    const cfg = RANGES.REGISTROS;
    const hojaReg = ss.getSheetByName(cfg.sheet);
    if (!hojaReg) throw new Error('No existe el ledger "' + cfg.sheet + '".');
    const cfgMed = RANGES.MEDIOS_PAGO;
    const hojaPC = ss.getSheetByName(cfgMed.sheet);
    if (!hojaPC) throw new Error('No existe la hoja "' + cfgMed.sheet + '".');

    // Catalogo de medios con su moneda (fallback 'ARS', como el original).
    const colMed = columnLetterToIndex(cfgMed.start);
    const nColsMed = columnLetterToIndex(cfgMed.end) - colMed + 1;
    const filaMed = getDataRow(cfgMed);
    const altoMed = hojaPC.getMaxRows() - filaMed + 1;
    const medios = [];
    const monedaDe = Object.create(null);
    if (altoMed > 0) {
        hojaPC.getRange(filaMed, colMed, altoMed, nColsMed).getValues().forEach(function (f) {
            const nombre = String(f[0] || '').trim();
            if (!nombre) return;
            medios.push(nombre);
            monedaDe[nombre] = String(f[1] || '').trim() || 'ARS';
        });
    }

    // Ledger: saldo por medio con la regla del ultimo corte.
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const alto = hojaReg.getMaxRows() - cfg.dataRow + 1;
    const iMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
    const iTipo = columnLetterToIndex(cfg.columns.tipo) - colIni;
    const iCuenta = columnLetterToIndex(cfg.columns.cuenta) - colIni;
    const iMedio = columnLetterToIndex(cfg.columns.medio) - colIni;
    const iFecha = columnLetterToIndex(cfg.columns.fecha) - colIni;

    const filas = [];
    let ultimaFecha = null;
    if (alto > 0) {
        hojaReg.getRange(cfg.dataRow, colIni, alto, nCols).getValues().forEach(function (f) {
            const medio = String(f[iMedio] || '').trim();
            const fecha = f[iFecha];
            if (!medio || !(fecha instanceof Date)) return;
            const monto = Number(f[iMonto]) || 0;
            const tipo = String(f[iTipo] || '').trim();
            filas.push({
                medio: medio, cuenta: String(f[iCuenta] || '').trim(), fecha: fecha.getTime(),
                neto: (tipo === 'Egreso' ? -monto : monto)
            });
            if (!ultimaFecha || fecha.getTime() > ultimaFecha) ultimaFecha = fecha.getTime();
        });
    }

    const cortes = Object.create(null);
    filas.forEach(function (f) {
        if (f.cuenta !== CUENTA_ARRASTRE) return;
        if (cortes[f.medio] === undefined || f.fecha > cortes[f.medio]) cortes[f.medio] = f.fecha;
    });
    const saldos = Object.create(null);
    medios.forEach(function (m) { saldos[m] = 0; });
    filas.forEach(function (f) {
        if (saldos[f.medio] === undefined) return;             // medio fuera del Plan: no participa
        const corte = cortes[f.medio] === undefined ? -Infinity : cortes[f.medio];
        if (f.fecha >= corte) saldos[f.medio] += f.neto;
    });

    const tz = Session.getScriptTimeZone();
    return {
        medios: medios.map(function (m) {
            return { medio: m, moneda: monedaDe[m], saldo: Math.round(saldos[m] * 100) / 100 };
        }),
        ultimaFechaLedger: ultimaFecha
            ? Utilities.formatDate(new Date(ultimaFecha), tz, 'dd/MM/yyyy')
            : '(sin datos)'
    };
}

/**
 * Los saldos que el sistema calcula por medio, para la tabla de Conciliacion.
 * Llamada cara: lee el ledger entero (~3.500 filas x 12 columnas) en un getValues.
 * NO lee bloques TC: las cotizaciones las congela procesarCargas al escribir.
 *
 * Nunca lanza (cicatriz v0.45.2: excepcion sin withFailureHandler = loader eterno).
 *
 * @returns {{ok:boolean, saldos?:Array<{medio:string, moneda:string, saldo:number}>,
 *            tolerancia?:number, ultimaFechaLedger?:string, hoy?:string, error?:string}}
 */
function obtenerSaldosConciliacion() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const medicion = _saldosPorMedioShell(ss);
        return {
            ok: true,
            saldos: medicion.medios,
            tolerancia: SHELL_CONC_TOLERANCIA,
            ultimaFechaLedger: medicion.ultimaFechaLedger,
            hoy: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')
        };
    } catch (e) {
        logError('obtenerSaldosConciliacion', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    }
}

/**
 * Carga los ajustes de conciliacion como movimientos de CUENTA_AJUSTE, por el MISMO camino
 * que todo lo demas: siembra en Cargas y procesarCargas congela TCs y deduce tipo de cuenta.
 * O entran todos o no entra ninguno.
 *
 * POR QUE EL PIPELINE Y NO LA ESCRITURA DIRECTA DEL DEVTOOL: (1) procesarCargas es el UNICO
 * lugar que congela las cuatro cotizaciones -- y las busca via API para la fecha del dia,
 * mejor que el fallback "mas reciente disponible" de _tcParaFechaConc; (2) el ledger queda
 * reordenado por fecha como con toda carga; (3) el shell ya tiene lock, tandas y validacion
 * de lote resueltos para este camino; (4) este repo ya dejo escrito dos veces que una segunda
 * implementacion equivalente es la forma mas barata de clasificar distinto sin que nadie se
 * entere. El costo asumido y declarado: tipo_cuenta de los ajustes queda 'Ingreso' (la cuenta
 * esta dada de alta en el bloque Ingresos del Plan), no '' como escribia el DEVTOOL.
 *
 * @param {Array<{medio:string, saldoVisto:number, saldoReal:number}>} lista
 * @returns {{ok:boolean, mensaje?:string, problemas?:Array<string>, error?:string}}
 */
function registrarConciliacion(lista) {
    return _conLock(function () {
        if (!Array.isArray(lista) || !lista.length) {
            return { ok: false, error: 'No llego ninguna caja para conciliar.' };
        }
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const medicion = _saldosPorMedioShell(ss);
        const mapa = Object.create(null);
        medicion.medios.forEach(function (m) { mapa[m.medio] = m; });

        // Se valida el lote ENTERO antes de escribir. ANTI-CARRERA: la vista se cargo antes y
        // otra pestania pudo escribir en el medio; si el saldo medido ahora no es el que el
        // cliente vio, se aborta el lote entero.
        const problemas = [];
        lista.forEach(function (d) {
            const m = mapa[d.medio];
            if (!m) { problemas.push('El medio "' + d.medio + '" no esta en el Plan de Cuentas.'); return; }
            if (!isFinite(Number(d.saldoReal))) {
                problemas.push('El saldo real de "' + d.medio + '" no es un numero.');
                return;
            }
            if (Math.abs(m.saldo - Number(d.saldoVisto)) > SHELL_CONC_TOLERANCIA) {
                problemas.push('El saldo de "' + d.medio + '" cambio desde que abriste la vista (era ' +
                    _plata(d.saldoVisto, m.moneda) + ', ahora ' + _plata(m.saldo, m.moneda) +
                    '). Volve a entrar a Conciliacion.');
            }
        });
        if (problemas.length) return { ok: false, problemas: problemas };

        // El cliente ya filtra las diferencias sub-tolerancia; el servidor es la regla.
        const hoyIso = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const movs = [];
        const conciliados = [];
        lista.forEach(function (d) {
            const m = mapa[d.medio];
            const saldoReal = Math.round(Number(d.saldoReal) * 100) / 100;
            const delta = Math.round((saldoReal - m.saldo) * 100) / 100;
            if (Math.abs(delta) <= SHELL_CONC_TOLERANCIA) return;
            movs.push({
                monto: Math.abs(delta),
                tipo: delta >= 0 ? 'Ingreso' : 'Egreso',
                cuenta: CUENTA_AJUSTE,
                medio: d.medio,
                // La moneda es la del CATALOGO, nunca la del cliente.
                moneda: m.moneda,
                fecha: hoyIso,
                nota: 'Conciliacion: saldo real ' + _plata(saldoReal, m.moneda) + ' contra ' +
                    _plata(m.saldo, m.moneda) + ' registrado'
            });
            conciliados.push({ medio: d.medio, moneda: m.moneda, saldoReal: saldoReal, delta: delta });
        });
        if (!conciliados.length) {
            return { ok: true, mensaje: 'Todos los saldos ya coinciden. No se cargo nada.' };
        }

        // El MISMO cuerpo que la carga de movimientos, bajo el lock que YA tenemos tomado.
        const r = _registrarMovimientosSinLock(movs);
        if (!r.ok) return r;

        // VERIFICACION por relectura (portada de aplicarConciliarSaldos): cada medio conciliado
        // tiene que quedar en su saldoReal. Si no, el error es fuerte y sin silenciar; las
        // filas NO se borran (el DEVTOOL tampoco lo hace): ya son asientos del ledger.
        const releida = _saldosPorMedioShell(ss);
        const mapaRe = Object.create(null);
        releida.medios.forEach(function (m) { mapaRe[m.medio] = m; });
        const fallas = [];
        conciliados.forEach(function (c) {
            const m = mapaRe[c.medio];
            const vivo = m ? m.saldo : NaN;
            if (!isFinite(vivo) || Math.abs(vivo - c.saldoReal) > SHELL_CONC_TOLERANCIA) {
                fallas.push('"' + c.medio + '" quedo en ' + _plata(vivo || 0, c.moneda) +
                    ' en vez de ' + _plata(c.saldoReal, c.moneda));
            }
        });
        if (fallas.length) {
            logError('registrarConciliacion: no verifica al releer: ' + fallas.join('; '));
            return { ok: false, error: 'Se cargaron los ajustes pero al releer ' + fallas.join('; ') +
                '. Revisa la hoja Registros: las filas nuevas ya estan en el ledger.' };
        }

        // Mensaje SIN sumar monedas distintas entre si.
        let mensaje;
        if (conciliados.length === 1) {
            mensaje = 'Listo. ' + conciliados[0].medio + ' quedo en ' +
                _plata(conciliados[0].saldoReal, conciliados[0].moneda) + '.';
        } else {
            const porMoneda = {};
            conciliados.forEach(function (c) {
                if (!porMoneda[c.moneda]) porMoneda[c.moneda] = { n: 0, total: 0 };
                porMoneda[c.moneda].n++;
                porMoneda[c.moneda].total += Math.abs(c.delta);
            });
            const partes = Object.keys(porMoneda).map(function (mon) {
                return porMoneda[mon].n + ' en ' + mon + ' por ' + _plata(porMoneda[mon].total, mon);
            });
            mensaje = 'Listo. Se cargaron ' + conciliados.length + ' ajustes: ' + partes.join(' | ');
        }
        logSuccess('registrarConciliacion: ' + conciliados.length + ' ajuste(s).');
        return { ok: true, mensaje: mensaje };
    });
}

/**
 * Corre `fn` con el lock del documento tomado.
 *
 * Ninguna ruta productiva de este repo tomaba lock hasta hoy. Con el shell, dos pestanias
 * abiertas pueden sembrar la MISMA fila libre de la grilla y una pisa a la otra sin que nadie
 * se entere. El lock es por documento porque la grilla es un recurso del documento.
 */
function _conLock(fn) {
    let lock = null;
    try {
        lock = LockService.getDocumentLock();
        if (!lock.tryLock(20000)) {
            return { ok: false, error: 'La planilla esta ocupada procesando otra carga. Proba de nuevo en unos segundos.' };
        }
    } catch (e) {
        // Sin LockService disponible se sigue igual: es una proteccion, no un requisito.
        logError('_conLock: no se pudo tomar el lock', e);
        lock = null;
    }
    try {
        return fn();
    } catch (e) {
        logError('_conLock: la operacion fallo', e);
        return { ok: false, error: String(e && e.message ? e.message : e) };
    } finally {
        if (lock) { try { lock.releaseLock(); } catch (e) { /* ya liberado */ } }
    }
}

/** Formatea plata como la planilla: simbolo pegado, miles con punto, dos decimales. */
function _plata(monto, moneda) {
    const n = Number(monto) || 0;
    const partes = n.toFixed(2).split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const simbolo = (moneda === 'USD' || moneda === 'AUD') ? 'US$' : (moneda === 'EUR' ? 'EUR ' : '$');
    return simbolo + partes.join(',');
}

/**
 * Guarda un tiempo medido para que el diagnostico lo pueda leer despues.
 *
 * Existe porque el usuario percibe "tarda mucho" y desde el codigo no hay forma de saber que
 * tramo tarda: la apertura de un modal mezcla el parseo del proyecto entero, la evaluacion de
 * la plantilla y el render del iframe. Sin numeros por tramo, cualquier explicacion es una
 * suposicion -- y en este repo ya se aceptaron dos suposiciones equivocadas seguidas.
 */
function _marcarTiempo(clave, ms) {
    try {
        PropertiesService.getDocumentProperties().setProperty(clave, String(ms));
    } catch (e) { /* medir nunca puede romper lo que mide */ }
}

/** El nombre de la planilla, para el pie del shell. Nunca hace fallar la apertura. */
function _nombrePlanillaShell() {
    try {
        return SpreadsheetApp.getActiveSpreadsheet().getName();
    } catch (e) {
        return '';
    }
}
