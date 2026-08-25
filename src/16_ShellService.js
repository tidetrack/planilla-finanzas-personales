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
    { id: 'movimiento', titulo: 'Movimiento nuevo', subtitulo: 'Un gasto o un ingreso', listo: true },
    { id: 'traspaso', titulo: 'Traspaso nuevo', subtitulo: 'Plata de una caja a otra', listo: true },
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
    // Los tipos que componen la riqueza viajan al cliente para que el formulario de traspaso
    // pueda avisar "esto capitaliza" sin retipear la lista. TIPOS_RIQUEZA sigue siendo el SSOT.
    tpl.tiposRiquezaJson = JSON.stringify(TIPOS_RIQUEZA);
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
            comodines: CUENTAS_NEUTRAS,
            // Para heredar la fila anterior: el objetivo del arnes es "menos de 3 segundos,
            // maximo 2 toques", y eso se consigue proponiendo, no preguntando. Es una lectura
            // de 5 filas, no del ledger.
            ultimos: _ultimosMovimientos(5)
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

// ============================================
// ESCRITURA
// ============================================

/**
 * Los ultimos movimientos del ledger, para que el formulario pueda proponer defaults.
 *
 * Es una lectura BARATA a proposito: "Registros" esta ordenado por fecha descendente, asi que
 * los mas recientes son las primeras filas de datos. Se leen N y nada mas -- nunca el ledger
 * entero. El objetivo del arnes para esta fase es "registro en menos de 3 segundos, maximo 2
 * toques", y eso se consigue heredando la fila anterior, no pidiendole todo al usuario.
 *
 * @param {number} n cuantos traer
 * @returns {Array<Object>} vacio si algo falla; nunca lanza
 */
function _ultimosMovimientos(n) {
    try {
        const cfg = RANGES.REGISTROS;
        const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.sheet);
        if (!hoja) return [];
        const colIni = columnLetterToIndex(cfg.start);
        const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
        const disponibles = hoja.getLastRow() - cfg.dataRow + 1;
        if (disponibles <= 0) return [];
        const alto = Math.min(n, disponibles);
        const iMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
        const iTipo = columnLetterToIndex(cfg.columns.tipo) - colIni;
        const iCuenta = columnLetterToIndex(cfg.columns.cuenta) - colIni;
        const iMedio = columnLetterToIndex(cfg.columns.medio) - colIni;
        const iMoneda = columnLetterToIndex(cfg.columns.moneda) - colIni;

        return hoja.getRange(cfg.dataRow, colIni, alto, nCols).getValues()
            .map(function (f) {
                return {
                    monto: f[iMonto],
                    tipo: String(f[iTipo] || '').trim(),
                    cuenta: String(f[iCuenta] || '').trim(),
                    medio: String(f[iMedio] || '').trim(),
                    moneda: String(f[iMoneda] || '').trim()
                };
            })
            .filter(function (m) { return m.cuenta !== '' || m.medio !== ''; });
    } catch (e) {
        logError('_ultimosMovimientos', e);
        return [];
    }
}

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
    return _conLock(function () {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const hojaCargas = ss.getSheetByName(RANGES.CARGAS.sheet);
        if (!hojaCargas) return { ok: false, error: 'No existe la hoja "' + RANGES.CARGAS.sheet + '".' };

        const medios = {};
        try {
            getTableData('MEDIOS_PAGO').forEach(function (f) {
                const n = String(f[0] || '').trim();
                if (n) medios[n] = { moneda: String(f[1] || '').trim(), tipo: String(f[2] || '').trim() };
            });
        } catch (e) {
            return { ok: false, error: 'No se pudo leer el catalogo de medios: ' + e.message };
        }

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
        if (problemas.length) return { ok: false, problemas: problemas };

        const grilla = _estadoGrillaCargas(hojaCargas);
        if (grilla.libres < 2) {
            return { ok: false, error: 'Un traspaso ocupa DOS filas de la grilla de Cargas y quedan ' +
                grilla.libres + '. Procesa lo que hay antes.' };
        }

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

        // LAS DOS JUNTAS, en una sola escritura. Si se escribieran por separado y la segunda
        // fallara, quedaria media operacion en la grilla.
        const colIni = columnLetterToIndex(RANGES.CARGAS.start);
        hojaCargas.getRange(grilla.filaHoja, colIni, 2, sale.length).setValues([sale, entra]);
        SpreadsheetApp.flush();

        procesarCargas();

        let mensaje = 'Listo. Pasaste ' + _plata(montoO, mOrigen) + ' de ' + d.origen + ' a ' + d.destino;
        if (cruzaMoneda) mensaje += ' (' + _plata(montoD, mDestino) + ')';
        mensaje += '.';
        const tipoDestino = medios[d.destino] ? medios[d.destino].tipo : '';
        if (TIPOS_RIQUEZA.indexOf(tipoDestino) !== -1) {
            mensaje += ' Eso capitaliza: la plata paso a una caja de ' + tipoDestino + '.';
        }
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

/** El nombre de la planilla, para el pie del shell. Nunca hace fallar la apertura. */
function _nombrePlanillaShell() {
    try {
        return SpreadsheetApp.getActiveSpreadsheet().getName();
    } catch (e) {
        return '';
    }
}
