/**
 * MIGRACION_v031_Historico.js
 * Recuperacion del historico cargado en la planilla vieja "PLANILLA FINANZAS_v03.1 | Fran".
 *
 * [CONCEPTO DE NEGOCIO]
 * Entre el 2026-03-29 y el 2026-08-13 el pipeline estuvo cortado (el codigo desplegado pedia
 * "Registros!I:T" sobre una hoja que ya era B:M) y Franco siguio anotando en la planilla vieja.
 * Son casi cinco meses de vida financiera que existen, estan escritos, y no estan en el ledger:
 * abril, mayo, junio, julio y agosto de 2026. Este modulo los trae.
 *
 * NO es una migracion por rango de fechas: es un cruce por AUSENCIA. Se leen las 3.635 filas de
 * la hoja "R CAR" del origen, se cruza cada una contra el ledger vivo y se migra unicamente lo
 * que no esta. Por eso es RE-EJECUTABLE: si Franco sigue cargando en la vieja, se vuelve a
 * correr y trae solo lo nuevo. El origen se lee con SpreadsheetApp.openById() -- nunca desde un
 * archivo exportado, que envejeceria en el primer dia.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6, puntos 3, 6 y 7: toda operacion sobre datos vivos es idempotente,
 * tiene respaldo congelado y VERIFICADO antes de mutar, y declara su contrato. De ahi el trio
 * de funciones publicas, que se corren en este orden:
 *   estadoMigracionV031()   -> dice que traeria, sin escribir una sola celda. Se corre primero.
 *   aplicarMigracionV031()  -> preflight que aborta sin tocar nada + respaldo + un unico batch.
 *   revertirMigracionV031() -> restaura el ledger completo desde el respaldo de la ultima corrida.
 * La idempotencia NO se apoya en la bandera de DocumentProperties: se deriva de los datos vivos
 * en cada corrida (el cruce por ausencia). La bandera es auditoria y puntero al respaldo.
 *
 * POR QUE EL RESPALDO ES EL LEDGER ENTERO Y NO LAS FILAS NUEVAS: al insertar y reordenar por
 * fecha descendente, las filas migradas quedan INTERCALADAS entre las 2.904 existentes. No hay
 * rango que borrar para deshacer. La unica vuelta atras posible es restaurar la foto completa,
 * y por eso el respaldo se congela, se relee y se cuenta ANTES de escribir una sola celda: un
 * respaldo que no se verifico no es un respaldo, es una afirmacion (cicatriz 4 del arnes).
 *
 * DIVERGENCIA DELIBERADA CON EL MOLDE (MIGRACION_v0.9.5_LayoutNuevo.js): alla el respaldo es
 * INMUTABLE porque la migracion es un evento unico y un segundo respaldo seria la foto de una
 * planilla a medio migrar. Aca las corridas repetidas son el caso ESPERADO, asi que cada corrida
 * COMPLETADA congela su propio punto de retorno y el puntero avanza. La regla del molde sigue
 * viva donde corresponde: si una corrida quedo iniciada y sin completar, la siguiente REUTILIZA
 * su respaldo en vez de fotografiar el estado dudoso.
 *
 * Contrato de retorno de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 * Cuando una falla ocurre DESPUES de haber escrito, el mensaje nunca dice "no se registro" sino
 * "no se pudo confirmar": el modulo no afirma sobre lo que no verifico.
 *
 * TRES COSAS QUE ESTE MODULO SE NIEGA A HACER, y por que (revision del 2026-08-13). Las tres son
 * de la misma familia: escribir en el ledger un dato que despues nadie va a poder detectar como
 * falso. Un hueco visible siempre es mejor que un numero equivocado.
 *
 *   1. NO MIGRA SI EL DATA LAKE NO LLEGA HASTA EL LOTE. El preflight compara la fecha mas nueva
 *      a migrar contra la ultima cotizacion de CADA serie y ABORTA si alguna queda corta. La
 *      comprobacion vieja solo miraba si la serie estaba vacia, y el caso real era el otro: series
 *      con 800+ cotizaciones que se cortan en marzo de 2026 mientras el lote llega a agosto. El TC
 *      congelado es el unico dato del ledger que despues no se puede recalcular.
 *      -> se destraba con "Tidetrack Dev > Tipos de cambio > Forzar carga historica".
 *
 *   2. NO MIGRA MONTOS NEGATIVOS. Van a su propio bucket y se listan uno por uno en el informe.
 *      Tomarles el valor absoluto los convertiria en un movimiento del sentido contrario que
 *      nunca existio (@see _leerOrigenV031).
 *
 *   3. NO PARSEA FECHAS CON new Date(texto). Semantica es-AR dd/mm/yyyy explicita, y las que
 *      admiten las dos lecturas no se migran (@see _parsearFechaTextoV031).
 *
 * MODULO TRANSITORIO: se borra cuando Franco deje de cargar en la planilla vieja y el gemelo
 * digital confirme que el ledger quedo completo.
 *
 * @see docs/permanente/ARNES_TIDETRACK.md (seccion 6: gobernanza)
 * @see 00_Config.js (RANGES.REGISTROS, CUENTAS_NEUTRAS, esCuentaNeutra)
 * @see 06_RegistrosService.js (deducirTipoCuenta, appendMassive: la misma logica que el pipeline)
 * @see 03_SheetManager.js (asegurarCapacidadFilas: unico lugar del sistema que amplia grids)
 *
 * @version 0.9.10
 * @since 0.9.10
 * @lastModified 2026-08-13
 */

// ============================================
// CONSTANTES DE LA MIGRACION
// ============================================

var V031_VERSION = '0.9.10';

/** Clave del estado en DocumentProperties. Auditoria + puntero al respaldo, NO fuente de verdad. */
var V031_PROP_ESTADO = 'MIGRACION_V031_ESTADO';

/** Milisegundos de espera por el lock del documento. */
var V031_LOCK_MS = 30000;

// --- ORIGEN: la planilla vieja. Identidad verificada el 2026-08-13. ---

// decision Franco 2026-08-13: el origen se lee por openById y NO por un archivo exportado.
// Un CSV congelado convierte este devtool en un evento unico; el objetivo es lo contrario, que
// se pueda correr de nuevo cada vez que Franco cargue algo mas en la planilla vieja. La cuenta
// del script ya tiene acceso de lectura (verificado); el scope drive del manifiesto lo habilita.
/** "PLANILLA FINANZAS_v03.1 | Fran". 44 caracteres: si no los tiene, esta mal copiado. */
var V031_ORIGEN_ID = '1RkyL_lD97EeeoibyZs40ME-ZylFnwhi38Dm493DP-08';

/** Hoja de datos del origen. Se resuelve por nombre tolerante y, si falla, por gid. */
var V031_ORIGEN_ALIAS_HOJA = ['R CAR', 'R Car', 'RCAR'];
var V031_ORIGEN_GID = 408918509;

/** Layout del origen: header fila 1, datos desde la fila 2, columnas A:G. */
var V031_ORI_FILA_HEADER = 1;
var V031_ORI_FILA_DATOS = 2;
var V031_ORI_ULTIMA_COL = 7;
var V031_ORI_COL = { fecha: 0, ingreso: 1, egreso: 2, detalle: 3, medio: 4, tipo: 5, observacion: 6 };

/**
 * Encabezados esperados del origen, normalizados. Es el GUARD ANTI-DRIFT de la lectura: si
 * alguien reordena o renombra columnas en la planilla vieja, el mapeo A->H, B/C->B, D->D, E->F,
 * G->I deja de ser cierto y este modulo escribiria basura en el ledger con total confianza.
 * Se compara por PREFIJO para tolerar rotulos largos ("Fecha de la operacion").
 */
var V031_ORI_HEADERS_ESPERADOS = [
    { col: 'A', prefijo: 'fecha' },
    { col: 'B', prefijo: 'ingreso' },
    { col: 'C', prefijo: 'egreso' },
    { col: 'D', prefijo: 'detalle' },
    { col: 'E', prefijo: 'medio' },
    { col: 'F', prefijo: 'tipo' },
    { col: 'G', prefijo: 'observ' }
];

/**
 * Encabezados esperados del DESTINO (Registros, fila 5, B:M). Segundo guard anti-drift: la
 * planilla ya migro sola una vez sin avisar (junio 2026) y el codigo tardo cuatro meses y medio
 * en enterarse. Si la fila 5 no dice lo que este modulo cree, se aborta antes de tocar nada.
 * Las cuatro ultimas (J:M) se rotulan "Valor" en la hoja pero guardan COTIZACIONES congeladas:
 * solo se exige que existan, no como se llaman.
 */
var V031_DES_HEADERS_ESPERADOS = [
    { col: 'B', prefijo: 'monto' },
    { col: 'C', prefijo: 'tipo' },
    { col: 'D', prefijo: 'cuenta' },
    { col: 'E', prefijo: 'tipo de cuenta' },
    { col: 'F', prefijo: 'medio' },
    { col: 'G', prefijo: 'moneda' },
    { col: 'H', prefijo: 'fecha' },
    { col: 'I', prefijo: 'nota' }
];

// --- ALIAS DE MEDIOS ---

// decision Franco 2026-08-13: se unifican SOLO los alias evidentes -- los que son el mismo medio
// escrito de dos maneras. Todo lo demas se reporta y decide Franco. La regla que separa un caso
// del otro: si unificar mal fusiona dos cajas distintas, el saldo de las dos queda mal y no hay
// forma de separarlas despues; si se deja sin unificar, sobra un medio en el catalogo y se
// arregla en cualquier momento. El error barato va primero.
var V031_ALIAS_MEDIOS = [
    { origen: 'MP', destino: 'Mercado Pago' },
    { origen: 'Brubank (pesos)', destino: 'Brubank' },
    { origen: 'Frasco transitorio Nx', destino: 'Frasco Transitorio NaranjaX' },
    { origen: 'Frascos NaranjaX', destino: 'Frascos Naranja X' }
];

/**
 * Medios que NO se unifican: se migran tal cual y se reportan como altas candidatas.
 * "Fracsos Nx - Dima" tiene un typo evidente, pero ademas dice "Dima" -- puede ser una caja
 * compartida y no un typo de "Frascos Nx". No se adivina: lo decide Franco.
 */
var V031_MEDIOS_SIN_UNIFICAR = ['YPF - wallet', 'Patagonia TC', 'Fracsos Nx - Dima'];

// --- ALTAS DE CUENTAS PROPUESTAS ---

/**
 * Cuentas del origen que no existen en el Plan de Cuentas, con el bloque propuesto para cada
 * una y el conteo medido el 2026-08-13 sobre el delta. El devtool RECUENTA en vivo: si el
 * conteo declarado y el medido difieren, el informe lo muestra -- es la senal de que Franco
 * siguio cargando.
 *
 * tabla = clave de RANGES donde se daria de alta. null = ninguna (ver "Inicio Mes").
 * Ninguna de estas altas se aplica sin que Franco lo confirme desde el informe de estado.
 */
var V031_ALTAS_PROPUESTAS = [
    {
        cuenta: 'Seguro Compu', tabla: 'GASTOS_FIJOS', filasMedidas: 7,
        motivo: 'prima de seguro: importe recurrente y comprometido de antemano, no discrecional.'
    },
    {
        cuenta: 'Seguro Celu', tabla: 'GASTOS_FIJOS', filasMedidas: 5,
        motivo: 'prima de seguro: mismo criterio que Seguro Compu.'
    },
    {
        cuenta: 'Medicamentos / Accesorios', tabla: 'GASTOS_VARIABLES', filasMedidas: 3,
        motivo: 'consumo eventual, importe y frecuencia variables.'
    },
    {
        cuenta: 'Pago Tarjeta MP', tabla: 'GASTOS_FIJOS', filasMedidas: 2,
        motivo: 'pago del resumen de la tarjeta de Mercado Pago.',
        // La advertencia se imprime en el informe: es una decision de modelo, no de dato.
        advertencia: 'OJO, DECISION DE FRANCO: pagar el resumen de una tarjeta puede NO ser un ' +
            'gasto sino un movimiento permutativo (cancela una deuda; el gasto real ya se ' +
            'registro cuando se consumio). Si en la planilla vieja los consumos con esa tarjeta ' +
            'YA figuran uno por uno, esta cuenta duplicaria el gasto y corresponde declararla ' +
            'CUENTA NEUTRA en CUENTAS_NEUTRAS (00_Config.js) en vez de darla de alta como Gasto ' +
            'Fijo. Son 2 filas: el impacto es chico, la decision de modelo no.'
    },
    {
        cuenta: 'Gastos - Tidetrack', tabla: 'GASTOS_VARIABLES', filasMedidas: 1,
        motivo: 'gasto de la unidad de negocio, sin importe fijo ni recurrencia comprometida.'
    },
    {
        cuenta: 'Inicio Mes', tabla: null, filasMedidas: 25,
        motivo: 'asiento de apertura: NO va en ningun bloque del Plan de Cuentas. Los tres ' +
            'bloques (I:J, L:M, O:P) definen el Tipo de Cuenta, y darle uno la volveria a sumar ' +
            'a los agregados, que es exactamente lo que se esta corrigiendo. Ya esta declarada ' +
            'en CUENTAS_NEUTRAS (00_Config.js), que es su registro hasta que la Fase 6 del arnes ' +
            'cree el bloque de cuentas de Movimientos.'
    }
];

// --- INFERENCIA DE MONEDA ---

// decision Franco 2026-08-13: el origen NO tiene columna de moneda, asi que se INFIERE del medio
// de pago, que es el unico dato que la contiene. Heuristica: un medio cuyo nombre empieza con
// "Dolar" es una caja en dolares (Dolar Brubank, Dolar MEP, Dolar efectivo...). Todo lo demas es
// ARS. Se eligio "empieza con" y no "contiene" a proposito: "contiene" clasificaria como USD a
// una cuenta como "Compra de dolares" pagada en pesos, que es justo la operacion inversa.
// Medido: 29 filas del delta caen en USD. El informe las lista con su medio para que Franco las
// audite de a una si quiere.
var V031_PREFIJO_MONEDA_USD = 'dolar';
var V031_MONEDA_POR_DEFECTO = 'ARS';

// --- VARIOS ---

/** Tolerancia al comparar montos (pesos). Dos decimales: mas fino es ruido de punto flotante. */
var V031_TOLERANCIA_MONTO = 0.005;

/** Cuantas corridas guarda el historial del estado (auditoria; no afecta la reversion). */
var V031_MAX_HISTORIAL = 10;

/** Prefijo de las hojas de respaldo del ledger. */
var V031_PREFIJO_RESPALDO = 'RESP_REGISTROS_v031_';

/** Tope de items que se listan en el informe antes de resumir (el alert corta en 1500). */
var V031_MAX_DETALLE_INFORME = 15;

/**
 * Topes propios de los dos buckets que existen para que Franco DECIDA fila por fila. Son mas
 * altos que V031_MAX_DETALLE_INFORME a proposito: en los demas buckets el conteo alcanza para
 * entender el problema, y en estos dos cada fila es una decision distinta que no se puede tomar
 * sin ver el dato. El informe completo va siempre a los logs (Logger.log del informe entero).
 */
var V031_MAX_NEGATIVAS_INFORME = 50;
var V031_MAX_FECHAS_TEXTO_INFORME = 30;

// ============================================
// HELPERS DE INFRAESTRUCTURA
// ============================================

// decision Franco 2026-08-13: yaConLock en las tres publicas porque el lock de Apps Script NO es
// reentrante. Un orquestador que encadene estado -> aplicar se colgaria contra si mismo.
/**
 * Ejecuta fn bajo el lock del documento, salvo que el llamador ya lo tenga.
 *
 * @param {boolean} yaConLock true si el llamador ya esta dentro de la seccion critica
 * @param {Function} fn cuerpo; debe devolver el contrato {ok, detalle?, error?}
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function _conLockV031(yaConLock, fn) {
    if (yaConLock === true) return fn();

    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(V031_LOCK_MS)) {
        return {
            ok: false,
            error: 'No se pudo tomar el lock del documento en ' + (V031_LOCK_MS / 1000) +
                   's. Hay otra ejecucion en curso: esperar a que termine y reintentar. ' +
                   'No se toco ninguna celda.'
        };
    }
    try {
        return fn();
    } finally {
        lock.releaseLock();
    }
}

/** Devuelve la UI si el contexto la tiene (menu), o null (ejecucion headless). */
function _uiV031() {
    try {
        return SpreadsheetApp.getUi();
    } catch (e) {
        return null;
    }
}

/** Alerta best-effort: en contexto headless no rompe, solo loguea. */
function _alertaV031(titulo, texto) {
    var ui = _uiV031();
    if (!ui) return;
    var recorte = texto.length > 1500
        ? texto.substring(0, 1500) + '\n\n[...] Informe completo en los logs (Ver > Registros de ejecucion).'
        : texto;
    try {
        ui.alert(titulo, recorte, ui.ButtonSet.OK);
    } catch (e) {
        logInfo('_alertaV031: sin UI disponible para "' + titulo + '"');
    }
}

// Cuando estas funciones salen del menu, Apps Script descarta el objeto que devuelven: un abort
// silencioso seria indistinguible de "no paso nada". Todo error llega a pantalla. Los caminos
// que ya mostraron su informe se marcan con _avisado para no alertar dos veces.
/**
 * Muestra el error de un resultado que no fue avisado por su propio camino.
 *
 * @param {string} titulo
 * @param {{ok: boolean, detalle?: string, error?: string, _avisado?: boolean}} r
 * @returns {{ok: boolean, detalle?: string, error?: string}} el mismo objeto, sin la marca interna
 */
function _informarResultadoV031(titulo, r) {
    if (!r) return r;
    if (r.ok === false && r.error && r._avisado !== true) _alertaV031(titulo, r.error);
    delete r._avisado;
    return r;
}

/** Sello temporal 'yyyy-MM-dd_HHmm' en la zona horaria del script. */
function _selloV031() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

// Un estado ILEGIBLE no se trata como "no hay estado": el puntero al respaldo vive ahi, y darlo
// por vacio haria que la corrida siguiente congelara un respaldo nuevo perdiendo el punto de
// retorno real. Se devuelve marcado y todo camino que escriba aborta antes de tocar nada.
/**
 * Lee el estado guardado.
 * @returns {Object} estado; {} si no hay ninguno; {_corrupto:true, _crudo:string} si es ilegible
 */
function _leerEstadoV031() {
    var crudo = null;
    try {
        crudo = PropertiesService.getDocumentProperties().getProperty(V031_PROP_ESTADO);
        if (!crudo) return {};
        var obj = JSON.parse(crudo);
        if (!obj || typeof obj !== 'object') throw new Error('el estado guardado no es un objeto');
        return obj;
    } catch (e) {
        logError('_leerEstadoV031: estado ILEGIBLE en DocumentProperties', e);
        return { _corrupto: true, _crudo: String(crudo).substring(0, 300) };
    }
}

/** Persiste el estado (merge sobre lo existente). Las claves internas (_*) no se persisten. */
function _guardarEstadoV031(parcial) {
    var previo = _leerEstadoV031();
    var estado = {};
    for (var k0 in previo) {
        if (Object.prototype.hasOwnProperty.call(previo, k0) && k0.charAt(0) !== '_') estado[k0] = previo[k0];
    }
    for (var k in parcial) {
        if (Object.prototype.hasOwnProperty.call(parcial, k)) estado[k] = parcial[k];
    }
    estado.version = V031_VERSION;
    PropertiesService.getDocumentProperties().setProperty(V031_PROP_ESTADO, JSON.stringify(estado));
    return estado;
}

/**
 * true si hay una corrida INICIADA que no llego a completarse ni fue revertida.
 *
 * Es el unico caso en que se reutiliza el respaldo anterior en vez de congelar uno nuevo: no se
 * sabe si el batch alcanzo a escribirse, asi que fotografiar ahora podria congelar un estado
 * dudoso y convertir la reversion en un viaje al lugar equivocado. Una corrida COMPLETADA no
 * cuenta como en vuelo: ahi la planilla esta en un estado conocido y bueno, y la corrida
 * siguiente tiene derecho a su propio punto de retorno.
 */
function _corridaEnVueloV031(estado) {
    return !!(estado && estado.iniciadaEn && !estado.completadaEn && !estado.revertidaEn);
}

/** Devuelve un nombre de hoja libre, agregando sufijo si hace falta. */
function _nombreHojaLibreV031(ss, base) {
    var nombre = base;
    var i = 2;
    while (ss.getSheetByName(nombre)) {
        nombre = base + '_' + i;
        i++;
        if (i > 50) throw new Error('No se pudo encontrar un nombre libre para el respaldo "' + base + '".');
    }
    return nombre;
}

// ============================================
// NORMALIZACION Y PARSEO
// ============================================

/** Normalizador de texto del modulo. Delega en el SSOT (00_Config.js) para no tener dos reglas. */
function _normV031(v) {
    return normalizarNombreCuenta(v);
}

/** true si la celda no tiene contenido util. */
function _vaciaV031(v) {
    return v === '' || v === null || v === undefined;
}

/** true si (anio, mes, dia) es una fecha real del calendario. Rechaza 31/02, mes 13, etc. */
function _fechaValidaV031(anio, mes, dia) {
    if (!(anio >= 1900 && anio <= 2999)) return false;
    if (!(mes >= 1 && mes <= 12)) return false;
    if (!(dia >= 1 && dia <= 31)) return false;
    var d = new Date(anio, mes - 1, dia);
    return d.getFullYear() === anio && d.getMonth() === (mes - 1) && d.getDate() === dia;
}

/** Arma 'YYYY-MM-DD' desde partes numericas, sin pasar por Date (ver la trampa de UTC). */
function _isoDesdePartesV031(anio, mes, dia) {
    return String(anio) + '-' + (mes < 10 ? '0' : '') + mes + '-' + (dia < 10 ? '0' : '') + dia;
}

// decision Franco 2026-08-13: el texto de fecha se parsea con semantica es-AR EXPLICITA
// (dd/mm/yyyy) y JAMAS con new Date(string).
//
// POR QUE: el parser nativo lee "12/04/2026" como 4 de DICIEMBRE (mm/dd, semantica de EE.UU.).
// Ese solo error dispara los dos modos de falla del modulo a la vez: el cruce por ausencia
// busca la fila por fecha+monto+sentido, no la encuentra donde ya estaba, y la vuelve a escribir
// -- con el mes cambiado. Duplicado Y adulterado, en silencio. El origen es una planilla es-AR
// que Franco llevo a mano dos anios y medio, asi que dd/mm es la unica lectura defendible.
//
// Y POR QUE ADEMAS NO ALCANZA CON PARSEAR BIEN: "05/06/2026" es 5 de junio leido en es-AR y 6 de
// mayo leido en en-US, y las dos lecturas son fechas validas. Para esos casos no hay dato que
// resuelva la duda desde el codigo, asi que se marcan AMBIGUOS y no se migran: van a su bucket,
// se reportan con las dos lecturas, y Franco le da formato de fecha real a esas celdas en la
// planilla vieja (o corrige lo que corresponda) y vuelve a correr. Adivinar aca cuesta un mes
// entero movido en el ledger, sin rastro; no migrarlas cuesta una corrida mas.
/**
 * Parsea un texto de fecha. Nunca usa new Date(string).
 *
 * @param {*} texto
 * @returns {{iso: ?string, modo: string, ambigua: boolean, isoAlterno: ?string}}
 *   modo: 'iso' | 'dmy' | 'ilegible'. isoAlterno = la fecha que daria la lectura mm/dd, solo
 *   cuando el mismo texto admite las dos y dan resultados distintos.
 */
function _parsearFechaTextoV031(texto) {
    var nulo = { iso: null, modo: 'ilegible', ambigua: false, isoAlterno: null };
    if (typeof texto !== 'string') return nulo;
    var limpio = texto.trim();
    if (limpio === '') return nulo;

    // 1) ISO literal. Se toma tal cual: new Date('2024-01-01') parsea a medianoche UTC y, leido
    //    en America/Argentina/Buenos_Aires (-03), retrocede un dia.
    var iso = limpio.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D.*)?$/);
    if (iso) {
        var aI = Number(iso[1]), mI = Number(iso[2]), dI = Number(iso[3]);
        if (!_fechaValidaV031(aI, mI, dI)) return nulo;
        return { iso: _isoDesdePartesV031(aI, mI, dI), modo: 'iso', ambigua: false, isoAlterno: null };
    }

    // 2) dd/mm/yyyy con separador /, - o . (como escribe una planilla es-AR).
    var m = limpio.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\D.*)?$/);
    if (!m) return nulo;

    var dia = Number(m[1]);
    var mes = Number(m[2]);
    var anio = Number(m[3]);
    if (m[3].length <= 2) anio = 2000 + anio;   // '26' -> 2026
    if (!_fechaValidaV031(anio, mes, dia)) return nulo;

    var res = { iso: _isoDesdePartesV031(anio, mes, dia), modo: 'dmy', ambigua: false, isoAlterno: null };
    // Ambiguedad REAL: si el dia tambien seria un mes valido y no coincide con el mes, el mismo
    // texto leido al reves da OTRA fecha. dia === mes (03/03) no es ambiguo: da lo mismo.
    if (dia <= 12 && dia !== mes) {
        res.ambigua = true;
        res.isoAlterno = _isoDesdePartesV031(anio, dia, mes);
    }
    return res;
}

/**
 * Normaliza un valor de celda a clave de fecha 'YYYY-MM-DD'. null si no es interpretable: el
 * llamador NUNCA descarta en silencio, cuenta y reporta.
 *
 * Duck typing en vez de instanceof Date: instanceof falla contra Date de otro realm (cualquier
 * banco de pruebas que instrumente la API de Sheets), y aca un falso negativo haria que la fila
 * se contara como "sin fecha" y quedara fuera de la migracion.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function _claveFechaV031(valor) {
    if (_vaciaV031(valor)) return null;

    if (valor && typeof valor.getTime === 'function') {
        if (isNaN(valor.getTime())) return null;
        return formatDateISO(valor);
    }
    if (typeof valor === 'string') return _parsearFechaTextoV031(valor).iso;
    return null;   // numeros crudos (seriales), booleanos: no se adivina
}

/**
 * Igual que _claveFechaV031 pero contando COMO llego el dato, para poder reportarlo.
 *
 * Existe porque nunca se verifico si la planilla vieja entrega las fechas como Date o como
 * texto, y el informe tiene que decirlo en vez de suponerlo: una celda de fecha que no llega
 * como Date es una celda que alguien tipeo como texto, y ahi es donde vive el riesgo de mes
 * cambiado. Lo que llega como Date no pasa por ningun parser de texto.
 *
 * @param {*} valor
 * @returns {{iso: ?string, tipo: string, esDate: boolean, ambigua: boolean, isoAlterno: ?string, crudo: string}}
 */
function _analizarFechaOrigenV031(valor) {
    if (_vaciaV031(valor)) {
        return { iso: null, tipo: 'vacia', esDate: false, ambigua: false, isoAlterno: null, crudo: '' };
    }
    if (valor && typeof valor.getTime === 'function') {
        if (isNaN(valor.getTime())) {
            return { iso: null, tipo: 'date-invalida', esDate: true, ambigua: false, isoAlterno: null, crudo: 'fecha invalida' };
        }
        var isoD = formatDateISO(valor);
        return { iso: isoD, tipo: 'date', esDate: true, ambigua: false, isoAlterno: null, crudo: isoD };
    }
    if (typeof valor !== 'string') {
        // Numero crudo (serial sin formato de fecha), booleano: no se adivina. Se reporta.
        return { iso: null, tipo: 'no-texto (' + typeof valor + ')', esDate: false, ambigua: false, isoAlterno: null, crudo: String(valor) };
    }
    var p = _parsearFechaTextoV031(valor);
    return {
        iso: p.iso,
        tipo: p.iso ? ('texto ' + p.modo) : 'texto ilegible',
        esDate: false,
        ambigua: p.ambigua,
        isoAlterno: p.isoAlterno,
        crudo: valor.trim()
    };
}

/**
 * Convierte a numero. Acepta el Number que devuelve Sheets y, defensivamente, texto en formato
 * es-AR ("$ 1.234,56") por si alguna celda del origen quedo como texto. Devuelve null si no se
 * puede afirmar el valor: se cuenta y se reporta, nunca se asume cero.
 *
 * @param {*} valor
 * @returns {number|null}
 */
function _numeroV031(valor) {
    if (_vaciaV031(valor)) return null;
    if (typeof valor === 'number') return isNaN(valor) ? null : valor;
    if (typeof valor !== 'string') return null;

    var s = valor.replace(/[\s $]/g, '').replace(/ /g, '');
    if (s === '') return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {          // 1.234.567,89
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (/^-?\d+,\d+$/.test(s)) {                     // 1234,56
        s = s.replace(',', '.');
    } else if (!/^-?\d+(\.\d+)?$/.test(s)) {
        return null;
    }
    var n = Number(s);
    return isNaN(n) ? null : n;
}

/** Redondea a 2 decimales para comparar montos sin ruido de punto flotante. */
function _redondearV031(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Clave de cruce: fecha + monto + sentido.
 *
 * El monto entra en VALOR ABSOLUTO a proposito. El sentido ya viaja en la clave, y las dos
 * planillas podrian no compartir convencion de signo (el origen parte el monto en dos columnas
 * positivas; el destino guarda un unico monto). Cruzar por signo ademas de por sentido haria
 * que una diferencia de convencion se leyera como "esta fila falta" y duplicaria el ledger.
 */
function _claveCruceV031(fechaIso, monto, sentido) {
    return fechaIso + '|' + Math.abs(_redondearV031(monto)).toFixed(2) + '|' + sentido;
}

/** Normaliza el sentido a 'Ingreso' / 'Egreso'; cualquier otra cosa vuelve normalizada. */
function _sentidoV031(tipo) {
    var n = _normV031(tipo);
    if (n === 'ingreso') return 'Ingreso';
    if (n === 'egreso') return 'Egreso';
    return n;
}

/** Construye un Date local a partir de 'YYYY-MM-DD' (sin pasar por el parser UTC). */
function _fechaDesdeIsoV031(iso) {
    var p = String(iso).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/**
 * Convierte un serial de Sheets a Date local. Se usa SOLO al restaurar: si la copia de formato
 * del respaldo fallo, las fechas vuelven como numeros y escribirlas asi romperia el ledger.
 * Epoca de Sheets: 1899-12-30. Se avanza por dias sobre el mediodia para no depender del DST.
 */
function _serialADateV031(serial) {
    var base = new Date(1899, 11, 30, 12, 0, 0);
    base.setDate(base.getDate() + Math.floor(serial));
    return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

/** Huella comparable de una celda: fechas a ISO, el resto a string. */
function _huellaCeldaV031(valor) {
    if (_vaciaV031(valor)) return '';
    if (valor && typeof valor.getTime === 'function') {
        return isNaN(valor.getTime()) ? 'fecha-invalida' : formatDateISO(valor);
    }
    return String(valor);
}

/** Formatea un numero como monto legible para el informe. El signo va ANTES del $ ("-$4000.00"):
 *  "$-4000.00" se lee mal justo donde el signo es lo que importa (el bucket de negativas). */
function _montoTextoV031(n) {
    if (n === null || n === undefined || isNaN(n)) return 's/d';
    var r = _redondearV031(n);
    return (r < 0 ? '-$' : '$') + Math.abs(r).toFixed(2);
}

// ============================================
// LECTURA DEL ORIGEN (PLANILLA VIEJA)
// ============================================

/**
 * Abre la planilla vieja y devuelve su hoja de datos.
 * Resuelve la hoja por nombre tolerante y, si no aparece, por gid: un renombre de pestana no
 * puede dejar sin recuperar cinco meses de historia.
 *
 * @returns {{ss: Object, hoja: Object, resueltaPor: string}}
 * @throws {Error} si no se puede abrir o la hoja no existe
 */
function _abrirOrigenV031() {
    if (String(V031_ORIGEN_ID).length !== 44) {
        throw new Error('El id de la planilla origen tiene ' + String(V031_ORIGEN_ID).length +
                        ' caracteres y un id de Google Sheets tiene 44. Esta mal copiado.');
    }

    var ss;
    try {
        ss = SpreadsheetApp.openById(V031_ORIGEN_ID);
    } catch (e) {
        throw new Error('No se pudo abrir la planilla origen (id ' + V031_ORIGEN_ID + '): ' +
                        e.message + '. Verificar que la cuenta que corre el script tenga acceso ' +
                        'de lectura a "PLANILLA FINANZAS_v03.1 | Fran". No se escribio nada.');
    }
    if (!ss) throw new Error('openById devolvio vacio para el id ' + V031_ORIGEN_ID + '.');

    var hojas = ss.getSheets();
    var i, j;
    for (i = 0; i < hojas.length; i++) {
        for (j = 0; j < V031_ORIGEN_ALIAS_HOJA.length; j++) {
            if (_normV031(hojas[i].getName()) === _normV031(V031_ORIGEN_ALIAS_HOJA[j])) {
                return { ss: ss, hoja: hojas[i], resueltaPor: 'nombre "' + hojas[i].getName() + '"' };
            }
        }
    }
    for (i = 0; i < hojas.length; i++) {
        if (typeof hojas[i].getSheetId === 'function' && hojas[i].getSheetId() === V031_ORIGEN_GID) {
            return { ss: ss, hoja: hojas[i], resueltaPor: 'gid ' + V031_ORIGEN_GID +
                     ' (la pestana se llama "' + hojas[i].getName() + '", no "' + V031_ORIGEN_ALIAS_HOJA[0] + '")' };
        }
    }
    throw new Error('La planilla origen no tiene una hoja "' + V031_ORIGEN_ALIAS_HOJA[0] +
                    '" ni una con gid ' + V031_ORIGEN_GID + '. Hojas encontradas: ' +
                    hojas.map(function (h) { return h.getName(); }).join(', ') + '.');
}

/** Verifica el encabezado del origen contra lo esperado (guard anti-drift). */
function _verificarHeaderOrigenV031(hoja) {
    var fila = hoja.getRange(V031_ORI_FILA_HEADER, 1, 1, V031_ORI_ULTIMA_COL).getValues()[0];
    var problemas = [];
    V031_ORI_HEADERS_ESPERADOS.forEach(function (esperado, idx) {
        var visto = _normV031(fila[idx]);
        if (visto.indexOf(esperado.prefijo) !== 0) {
            problemas.push('columna ' + esperado.col + ' del origen: se esperaba un rotulo que ' +
                           'empiece con "' + esperado.prefijo + '" y dice "' + String(fila[idx]) + '"');
        }
    });
    return { ok: problemas.length === 0, problemas: problemas, crudo: fila };
}

/**
 * Lee y clasifica las filas del origen.
 *
 * Clasificacion (cada bucket existe porque se reporta por separado):
 *   filas     -> migrables: tienen fecha valida y exactamente uno de Ingreso/Egreso con monto.
 *   sinFecha  -> tienen datos pero no fecha. NO se migran: sin fecha no hay cruce posible (el
 *                cruce es por fecha+monto+sentido) ni tipo de cambio que congelar. Se reportan
 *                con su numero de fila para que Franco las complete en el origen.
 *   sinMonto  -> tienen fecha pero ni Ingreso ni Egreso. NO se migran: sin monto no hay sentido
 *                que declarar, y una fila asi en el ledger es ruido que despues hay que limpiar.
 *   ambiguas  -> tienen Ingreso Y Egreso a la vez. NO se migran: no se adivina cual vale.
 *   ilegibles -> el monto no se pudo interpretar. NO se migran, jamas se asume cero.
 *   negativas -> el monto viene en negativo. NO se migran (ver la decision inline mas abajo).
 *   fechaAmbigua -> la fecha llego como texto y admite dos lecturas distintas. NO se migran.
 *
 * @param {Object} hoja hoja "R CAR" del origen
 * @returns {Object}
 */
function _leerOrigenV031(hoja) {
    var salida = {
        filas: [], sinFecha: [], sinMonto: [], ambiguas: [], ilegibles: [],
        negativas: [], fechaAmbigua: [],
        fechasNoDate: 0, fechasNoDateDetalle: [],
        totalConContenido: 0, ultimaFilaLeida: 0
    };
    var ultima = hoja.getLastRow();
    salida.ultimaFilaLeida = ultima;
    if (ultima < V031_ORI_FILA_DATOS) return salida;

    var datos = hoja.getRange(V031_ORI_FILA_DATOS, 1, ultima - V031_ORI_FILA_DATOS + 1, V031_ORI_ULTIMA_COL).getValues();

    datos.forEach(function (f, idx) {
        var filaFisica = V031_ORI_FILA_DATOS + idx;
        var tieneAlgo = false;
        for (var c = 0; c < V031_ORI_ULTIMA_COL; c++) {
            if (!_vaciaV031(f[c])) { tieneAlgo = true; break; }
        }
        if (!tieneAlgo) return;
        salida.totalConContenido++;

        var detalle = String(f[V031_ORI_COL.detalle] === null || f[V031_ORI_COL.detalle] === undefined ? '' : f[V031_ORI_COL.detalle]).trim();
        var medioOriginal = String(f[V031_ORI_COL.medio] === null || f[V031_ORI_COL.medio] === undefined ? '' : f[V031_ORI_COL.medio]).trim();
        var nota = String(f[V031_ORI_COL.observacion] === null || f[V031_ORI_COL.observacion] === undefined ? '' : f[V031_ORI_COL.observacion]).trim();
        var tipoOrigen = String(f[V031_ORI_COL.tipo] === null || f[V031_ORI_COL.tipo] === undefined ? '' : f[V031_ORI_COL.tipo]).trim();

        var brutoIng = f[V031_ORI_COL.ingreso];
        var brutoEgr = f[V031_ORI_COL.egreso];
        var ing = _numeroV031(brutoIng);
        var egr = _numeroV031(brutoEgr);
        var ingIlegible = !_vaciaV031(brutoIng) && ing === null;
        var egrIlegible = !_vaciaV031(brutoEgr) && egr === null;

        var ctx = {
            filaFisica: filaFisica, detalle: detalle, medioOriginal: medioOriginal,
            nota: nota, tipoOrigen: tipoOrigen,
            monto: (ing !== null ? ing : egr),
            crudo: { ingreso: brutoIng, egreso: brutoEgr, fecha: f[V031_ORI_COL.fecha] }
        };

        if (ingIlegible || egrIlegible) { salida.ilegibles.push(ctx); return; }

        var fecha = _analizarFechaOrigenV031(f[V031_ORI_COL.fecha]);
        ctx.fechaIso = fecha.iso;
        ctx.fechaCrudo = fecha.crudo;
        ctx.fechaTipo = fecha.tipo;
        ctx.fechaAlterna = fecha.isoAlterno;

        // Se cuenta TODA celda de fecha que no haya llegado como Date, incluidas las que despues
        // se parsean bien: el informe tiene que poder decir cuantas hay y como se interpretaron.
        if (!fecha.esDate && fecha.tipo !== 'vacia') {
            salida.fechasNoDate++;
            salida.fechasNoDateDetalle.push({
                filaFisica: filaFisica, crudo: fecha.crudo, tipo: fecha.tipo,
                iso: fecha.iso, ambigua: fecha.ambigua, isoAlterno: fecha.isoAlterno,
                detalle: detalle
            });
        }

        var fechaIso = fecha.iso;
        if (!fechaIso) { salida.sinFecha.push(ctx); return; }
        if (fecha.ambigua) { salida.fechaAmbigua.push(ctx); return; }

        var hayIng = ing !== null && Math.abs(ing) > 0;
        var hayEgr = egr !== null && Math.abs(egr) > 0;
        if (hayIng && hayEgr) { salida.ambiguas.push(ctx); return; }
        if (!hayIng && !hayEgr) { salida.sinMonto.push(ctx); return; }

        // decision Franco 2026-08-13: BUCKET PROPIO para los montos negativos. NO se migran.
        //
        // El origen parte el monto en dos columnas positivas (Ingreso / Egreso), asi que un
        // negativo ahi no es una convencion de signo: es una devolucion, una correccion o un
        // error de carga. Verificado en el origen: la fila 3058 (2024-06-23, "Medicamentos /
        // Accesorios") tiene Ingreso = -34.999,97.
        //
        // POR QUE NO ALCANZA CON TOMAR EL VALOR ABSOLUTO: eso escribiria en el ledger un ingreso
        // de $34.999,97 que nunca existio -- el signo contrario del hecho real -- y ademas la
        // clave de cruce tambien normaliza en absoluto, asi que en la corrida siguiente esa fila
        // seria INDISTINGUIBLE de un ingreso legitimo. Migrarla con el signo invertido es peor
        // que no migrarla: no migrarla deja un hueco visible en el informe, migrarla mal deja un
        // numero falso que nadie va a volver a mirar.
        var columnaMonto = hayIng ? 'Ingreso' : 'Egreso';
        var brutoMonto = hayIng ? ing : egr;
        if (brutoMonto < 0) {
            ctx.columnaMonto = columnaMonto;
            ctx.monto = brutoMonto;
            salida.negativas.push(ctx);
            return;
        }

        var alias = _aplicarAliasMedioV031(medioOriginal);
        // Sin Math.abs: los negativos ya quedaron afuera, asi que lo que se escribe es el valor
        // tal cual vino. El unico lugar donde sigue habiendo valor absoluto es la clave de cruce
        // (_claveCruceV031), y ahi es correcto: compara contra un ledger que podria no compartir
        // convencion de signo.
        var monto = _redondearV031(brutoMonto);
        var sentido = hayIng ? 'Ingreso' : 'Egreso';
        var valorFecha = (f[V031_ORI_COL.fecha] && typeof f[V031_ORI_COL.fecha].getTime === 'function')
            ? f[V031_ORI_COL.fecha]
            : _fechaDesdeIsoV031(fechaIso);

        salida.filas.push({
            filaFisica: filaFisica,
            fechaIso: fechaIso,
            fechaValor: valorFecha,
            monto: monto,
            sentido: sentido,
            cuenta: detalle,
            medioOriginal: medioOriginal,
            medio: alias.medio,
            aliasAplicado: alias.aplicado,
            moneda: _monedaDesdeMedioV031(alias.medio),
            nota: nota,
            tipoOrigen: tipoOrigen,
            clave: _claveCruceV031(fechaIso, monto, sentido),
            medioNorm: _normV031(alias.medio),
            presente: false,
            match: ''
        });
    });

    return salida;
}

/**
 * Aplica el mapa de alias de medios. Comparacion tolerante a mayusculas y espacios.
 * @returns {{medio: string, aplicado: ?string}} aplicado = nombre original si hubo unificacion
 */
function _aplicarAliasMedioV031(medio) {
    var n = _normV031(medio);
    if (n === '') return { medio: medio, aplicado: null };
    for (var i = 0; i < V031_ALIAS_MEDIOS.length; i++) {
        if (_normV031(V031_ALIAS_MEDIOS[i].origen) === n) {
            return { medio: V031_ALIAS_MEDIOS[i].destino, aplicado: medio };
        }
    }
    return { medio: medio, aplicado: null };
}

/** Infiere la moneda a partir del medio (ver V031_PREFIJO_MONEDA_USD). */
function _monedaDesdeMedioV031(medio) {
    var n = _normV031(medio)
        .replace(/[áàäâ]/g, 'a')
        .replace(/[óòöô]/g, 'o');
    return n.indexOf(V031_PREFIJO_MONEDA_USD) === 0 ? 'USD' : V031_MONEDA_POR_DEFECTO;
}

// ============================================
// LECTURA DEL DESTINO Y CRUCE POR AUSENCIA
// ============================================

/** Verifica el encabezado del ledger contra lo esperado (guard anti-drift). */
function _verificarHeaderDestinoV031(hoja) {
    var cfg = RANGES.REGISTROS;
    var colIni = columnLetterToIndex(cfg.start);
    var nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    var problemas = [];

    if (hoja.getMaxRows() < cfg.headerRow) {
        return {
            ok: false,
            problemas: ['la hoja "' + hoja.getName() + '" no llega ni a la fila ' + cfg.headerRow +
                        ', donde deberia estar el encabezado del ledger.'],
            crudo: []
        };
    }
    var fila = hoja.getRange(cfg.headerRow, colIni, 1, nCols).getValues()[0];
    V031_DES_HEADERS_ESPERADOS.forEach(function (esperado, idx) {
        var visto = _normV031(fila[idx]);
        if (visto.indexOf(esperado.prefijo) !== 0) {
            problemas.push('columna ' + esperado.col + ' de "' + hoja.getName() + '" (fila ' + cfg.headerRow +
                           '): se esperaba un rotulo que empiece con "' + esperado.prefijo +
                           '" y dice "' + String(fila[idx]) + '"');
        }
    });
    for (var c = 8; c < nCols; c++) {
        if (_vaciaV031(fila[c])) {
            problemas.push('la columna ' + String.fromCharCode(66 + c) + ' del ledger (tipo de cambio ' +
                           'congelado) no tiene encabezado en la fila ' + cfg.headerRow + '.');
        }
    }
    return { ok: problemas.length === 0, problemas: problemas, crudo: fila };
}

/**
 * Lee el ledger vivo y construye el indice de cruce.
 *
 * El indice es un MULTISET: para cada clave (fecha+monto+sentido) guarda cuantas filas hay y
 * como se reparten por medio. Hace falta que sea multiset y no un set porque el mismo dia puede
 * haber dos gastos identicos legitimos (dos cafes de $3.000), y un set los colapsaria: el
 * segundo se leeria como "ya esta" y se perderia para siempre.
 *
 * @param {Object} hoja hoja Registros
 * @returns {Object}
 */
function _leerDestinoV031(hoja) {
    var cfg = RANGES.REGISTROS;
    var colIni = columnLetterToIndex(cfg.start);
    var nCols = columnLetterToIndex(cfg.end) - colIni + 1;

    var salida = {
        indice: Object.create(null),
        filas: 0, suma: 0, ultimaFila: 0, ultimaFilaConMonto: 0,
        sinFecha: 0, sinMonto: 0, claves: 0,
        primeraHuella: '', cuentas: Object.create(null)
    };

    var ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return salida;

    var datos = hoja.getRange(cfg.dataRow, colIni, ultima - cfg.dataRow + 1, nCols).getValues();
    datos.forEach(function (f, idx) {
        var tieneAlgo = false;
        for (var c = 0; c < nCols; c++) {
            if (!_vaciaV031(f[c])) { tieneAlgo = true; break; }
        }
        if (!tieneAlgo) return;

        salida.filas++;
        salida.ultimaFila = cfg.dataRow + idx;
        if (!salida.primeraHuella) {
            salida.primeraHuella = _huellaCeldaV031(f[0]) + ' / ' + _huellaCeldaV031(f[6]) +
                                   ' / ' + _huellaCeldaV031(f[2]);
        }

        var monto = _numeroV031(f[0]);                 // B
        var sentido = _sentidoV031(f[1]);              // C
        var cuenta = String(_vaciaV031(f[2]) ? '' : f[2]).trim();   // D
        var medioNorm = _normV031(f[4]);               // F
        var fechaIso = _claveFechaV031(f[6]);          // H

        if (!_vaciaV031(f[0])) salida.ultimaFilaConMonto = cfg.dataRow + idx;
        if (monto !== null) salida.suma += monto;
        if (cuenta) salida.cuentas[_normV031(cuenta)] = cuenta;

        if (!fechaIso) { salida.sinFecha++; return; }
        if (monto === null) { salida.sinMonto++; return; }

        var clave = _claveCruceV031(fechaIso, monto, sentido);
        var entrada = salida.indice[clave];
        if (!entrada) {
            entrada = { total: 0, restante: 0, porMedio: Object.create(null) };
            salida.indice[clave] = entrada;
            salida.claves++;
        }
        entrada.total++;
        entrada.restante++;
        entrada.porMedio[medioNorm] = (entrada.porMedio[medioNorm] || 0) + 1;
    });

    salida.suma = _redondearV031(salida.suma);
    return salida;
}

/**
 * Cruza el origen contra el indice del ledger y marca cada fila como presente o faltante.
 *
 * DOS PASADAS, y el orden importa: primero se consumen los calces exactos (fecha+monto+sentido+
 * medio) y recien despues los que solo calzan por fecha+monto+sentido. Con una sola pasada, una
 * fila de origen con medio distinto podria consumir el cupo que necesitaba una fila posterior
 * con el medio exacto, y esa quedaria marcada como faltante: la migracion la duplicaria. El
 * resultado de dos pasadas ademas no depende del orden en que vengan las filas del origen.
 *
 * @param {Array<Object>} filasOrigen mutadas in situ (presente / match)
 * @param {Object} indice de _leerDestinoV031 (se consume: el llamador no debe reutilizarlo)
 * @returns {{presentesPorMedio: number, presentesPorClave: number, faltantes: number}}
 */
function _cruzarV031(filasOrigen, indice) {
    var res = { presentesPorMedio: 0, presentesPorClave: 0, faltantes: 0 };

    filasOrigen.forEach(function (f) {
        var e = indice[f.clave];
        if (e && e.restante > 0 && e.porMedio[f.medioNorm] > 0) {
            e.porMedio[f.medioNorm]--;
            e.restante--;
            f.presente = true;
            f.match = 'fecha+monto+sentido+medio';
            res.presentesPorMedio++;
        }
    });

    filasOrigen.forEach(function (f) {
        if (f.presente) return;
        var e = indice[f.clave];
        if (e && e.restante > 0) {
            e.restante--;
            for (var k in e.porMedio) {
                if (e.porMedio[k] > 0) { e.porMedio[k]--; break; }
            }
            f.presente = true;
            f.match = 'fecha+monto+sentido (el medio no coincide)';
            res.presentesPorClave++;
        }
    });

    filasOrigen.forEach(function (f) { if (!f.presente) res.faltantes++; });
    return res;
}

// ============================================
// TIPOS DE CAMBIO (DEL DATA LAKE, NUNCA DE LA API)
// ============================================

// decision Franco 2026-08-13: los TC salen de la hoja "Tipos de cambio", NO de las APIs. El Data
// Lake tiene la serie diaria completa desde 2024-01-01 (restaurada por backfill el mismo dia:
// 810 cotizaciones ARS y 819 de cada una de las otras tres). Pegarle a la API por 632 filas
// serian 632 fechas x 2 servicios de ida y vuelta, con riesgo de rate limit a mitad del lote y,
// peor, con la posibilidad de congelar en el ledger una cotizacion distinta de la que la
// planilla ya usa para el resto del historico. ADR-004: los TC viven congelados en la hoja.

/**
 * Arma la serie de un par: mapa fecha -> cotizacion + fechas ordenadas para la busqueda.
 * @param {string} tabla clave de RANGES (TC_ARS, TC_USD, TC_AUD, TC_EUR)
 */
function _serieTcV031(tabla) {
    var datos = getTableData(tabla);
    var mapa = Object.create(null);
    var fechas = [];
    var ilegibles = 0;

    datos.forEach(function (f) {
        var iso = _claveFechaV031(f[0]);
        var val = _numeroV031(f[1]);
        if (!iso || val === null) { ilegibles++; return; }
        if (!(iso in mapa)) fechas.push(iso);
        mapa[iso] = val;   // ante fechas repetidas gana la ultima leida
    });
    fechas.sort();   // ISO ordena lexicograficamente = cronologicamente

    return { tabla: tabla, mapa: mapa, fechas: fechas, ilegibles: ilegibles, total: fechas.length };
}

/**
 * Busca la cotizacion de una fecha. Si no hay dato exacto usa la mas cercana ANTERIOR; si la
 * fecha es previa al inicio de la serie usa la mas antigua disponible.
 *
 * Regla Estricta 9: ningun fallback de tipo de cambio se silencia. Esta funcion no loguea (se
 * llamaria miles de veces): devuelve el modo y el llamador loguea cada combinacion distinta.
 *
 * @returns {{valor: ?number, modo: string, fecha: ?string}} modo: exacto|anterior|posterior|ausente
 */
function _buscarTcV031(serie, iso) {
    if (serie.mapa[iso] !== undefined) return { valor: serie.mapa[iso], modo: 'exacto', fecha: iso };

    var lo = 0, hi = serie.fechas.length - 1, res = -1;
    while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (serie.fechas[mid] < iso) { res = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (res >= 0) {
        var fAnt = serie.fechas[res];
        return { valor: serie.mapa[fAnt], modo: 'anterior', fecha: fAnt };
    }
    if (serie.fechas.length > 0) {
        var fPos = serie.fechas[0];
        return { valor: serie.mapa[fPos], modo: 'posterior', fecha: fPos };
    }
    return { valor: null, modo: 'ausente', fecha: null };
}

/**
 * Resuelve los cuatro TC de cada fila y acumula los fallbacks para loguearlos una sola vez por
 * combinacion (par, fecha pedida, fecha usada).
 *
 * @param {Array<Object>} filas filas a migrar (se les agrega .tc y .tcFallback)
 * @param {Object} series {ARS, USD, AUD, EUR}
 * @returns {{filasConFallback: number, detalle: Object, anomaliasArs: Array}}
 */
function _resolverTcV031(filas, series) {
    var detalle = Object.create(null);
    var filasConFallback = 0;
    var anomaliasArs = [];

    filas.forEach(function (f) {
        var tc = {};
        var conFallback = false;
        ['ARS', 'USD', 'AUD', 'EUR'].forEach(function (par) {
            var r = _buscarTcV031(series[par], f.fechaIso);
            tc[par] = r.valor;
            if (r.modo !== 'exacto') {
                conFallback = true;
                var clave = par + '|' + f.fechaIso + '|' + r.modo + '|' + r.fecha;
                detalle[clave] = (detalle[clave] || 0) + 1;
            }
        });
        // El bloque ARS del Data Lake guarda 1.0 (ARS es la unidad base). Un valor distinto no
        // rompe nada aca, pero es sintoma de un Data Lake tocado a mano: se reporta.
        if (tc.ARS !== null && Math.abs(tc.ARS - 1) > V031_TOLERANCIA_MONTO) {
            anomaliasArs.push({ fecha: f.fechaIso, valor: tc.ARS });
        }
        f.tc = tc;
        f.tcFallback = conFallback;
        if (conFallback) filasConFallback++;
    });

    return { filasConFallback: filasConFallback, detalle: detalle, anomaliasArs: anomaliasArs };
}

/** Loguea cada fallback distinto. Regla Estricta 9: nunca se silencia. */
function _loguearFallbacksTcV031(detalleFallback) {
    var claves = Object.keys(detalleFallback);
    if (!claves.length) return;
    logInfo('MIGRACION v031: ' + claves.length + ' combinacion(es) de tipo de cambio resueltas por FALLBACK. ' +
            'Detalle a continuacion (par | fecha pedida | modo | fecha usada | filas afectadas):');
    claves.sort().forEach(function (k) {
        logInfo('  TC FALLBACK -> ' + k.split('|').join(' | ') + ' | ' + detalleFallback[k] + ' fila(s)');
    });
}

// ============================================
// PLAN (SOLO LECTURA)
// ============================================

/**
 * Construye el plan completo de la migracion sin escribir una sola celda.
 * Es lo que consumen estadoMigracionV031() y el preflight de aplicarMigracionV031().
 */
function _planV031(ss) {
    var plan = {
        momento: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'),
        problemas: [], avisos: [],
        nombres: { registros: SHEETS.REGISTROS, tiposCambio: SHEETS.TIPOS_CAMBIO, planCuentas: SHEETS.PLAN_CUENTAS },
        hojas: {},
        origen: null, destino: null, cruce: null,
        aMigrar: [], desgloseMensual: [], porMoneda: { ARS: 0, USD: 0 },
        filasUsd: [], sinTipoCuenta: [], cuentasAusentes: [], mediosAusentes: [],
        altas: [], altasNoPropuestas: [],
        tc: {
            filasConFallback: 0, detalle: {}, anomaliasArs: [], series: {},
            cobertura: [], maxFechaLote: null, minFechaLote: null
        },
        aliasAplicados: Object.create(null),
        capacidad: null,
        estadoGuardado: {}, enVuelo: false,
        nadaQueHacer: false
    };

    var estado = _leerEstadoV031();
    plan.estadoGuardado = estado;
    plan.enVuelo = _corridaEnVueloV031(estado);
    if (estado._corrupto) {
        plan.problemas.push('El registro del devtool en DocumentProperties es ILEGIBLE, asi que no se sabe ' +
                            'cual es el respaldo valido. Fragmento crudo: ' + estado._crudo);
    }

    // --- Hojas del destino ---
    var hojaReg = ss.getSheetByName(plan.nombres.registros);
    var hojaTc = ss.getSheetByName(plan.nombres.tiposCambio);
    var hojaPc = ss.getSheetByName(plan.nombres.planCuentas);
    plan.hojas = { registros: hojaReg, tiposCambio: hojaTc, planCuentas: hojaPc };

    if (!hojaReg) plan.problemas.push('No existe la hoja "' + plan.nombres.registros + '" (el ledger destino).');
    if (!hojaTc) plan.problemas.push('No existe la hoja "' + plan.nombres.tiposCambio + '" (el Data Lake de cotizaciones).');
    if (!hojaPc) plan.problemas.push('No existe la hoja "' + plan.nombres.planCuentas + '".');
    if (plan.problemas.length) return plan;

    // --- Guard anti-drift del destino ---
    var headerDes = _verificarHeaderDestinoV031(hojaReg);
    if (!headerDes.ok) {
        headerDes.problemas.forEach(function (p) {
            plan.problemas.push('LAYOUT DEL LEDGER CAMBIADO: ' + p);
        });
        plan.problemas.push('El layout de "' + plan.nombres.registros + '" no es el que declara RANGES.REGISTROS. ' +
                            'Se aborta: escribir sobre un layout distinto del declarado es exactamente como se ' +
                            'perdieron cuatro meses y medio de pipeline. Actualizar 00_Config.js primero.');
        return plan;
    }

    // --- Origen ---
    var origenRef;
    try {
        origenRef = _abrirOrigenV031();
    } catch (e) {
        plan.problemas.push(e.message);
        return plan;
    }
    var headerOri = _verificarHeaderOrigenV031(origenRef.hoja);
    if (!headerOri.ok) {
        headerOri.problemas.forEach(function (p) { plan.problemas.push('LAYOUT DEL ORIGEN CAMBIADO: ' + p); });
        plan.problemas.push('Se aborta la lectura del origen: con las columnas corridas, el mapeo a Registros ' +
                            'escribiria cada dato en la columna equivocada.');
        return plan;
    }

    var origen = _leerOrigenV031(origenRef.hoja);
    origen.nombreHoja = origenRef.hoja.getName();
    origen.resueltaPor = origenRef.resueltaPor;
    plan.origen = origen;

    // --- Destino y cruce ---
    var destino = _leerDestinoV031(hojaReg);
    plan.destino = destino;
    plan.cruce = _cruzarV031(origen.filas, destino.indice);
    plan.aMigrar = origen.filas.filter(function (f) { return !f.presente; });

    if (plan.aMigrar.length === 0) {
        plan.nadaQueHacer = true;
    }

    // GUARD: appendMassive() -- la misma funcion que usa el pipeline -- ubica el final del ledger
    // escaneando la PRIMERA COLUMNA de la tabla (B, Monto) y escribe a partir de ahi. Si hubiera
    // filas con datos por debajo de la ultima con Monto, el batch las PISARIA en silencio. Es
    // improbable (toda fila del ledger nace con monto) pero el precio de equivocarse es perder
    // filas reales sin dejar rastro, asi que se comprueba antes en vez de confiar.
    if (plan.aMigrar.length > 0 && destino.ultimaFila > destino.ultimaFilaConMonto) {
        plan.problemas.push('El ledger tiene datos hasta la fila ' + destino.ultimaFila + ' pero la ultima ' +
                            'fila con Monto (columna ' + RANGES.REGISTROS.columns.monto + ') es la ' +
                            destino.ultimaFilaConMonto + '. La escritura por lote arrancaria en la ' +
                            (destino.ultimaFilaConMonto + 1) + ' y PISARIA esas filas. Revisar y completar el ' +
                            'Monto de las filas ' + (destino.ultimaFilaConMonto + 1) + ' a ' + destino.ultimaFila +
                            ', o vaciarlas si son restos. No se escribio nada.');
    }

    // --- Catalogos y deduccion de Tipo de Cuenta ---
    var catalogos = leerCatalogosPlanCuentas();
    plan.catalogos = catalogos;
    if (catalogos.ingresos.length === 0 && catalogos.fijos.length === 0 && catalogos.variables.length === 0) {
        plan.problemas.push('Los tres catalogos del Plan de Cuentas (I:J, L:M, O:P) vinieron vacios. Sin ellos ' +
                            'TODAS las filas se migrarian sin Tipo de Cuenta. Revisar la hoja "' +
                            plan.nombres.planCuentas + '".');
        return plan;
    }
    var mediosCat = getTableData('MEDIOS_PAGO').map(function (r) { return r[0]; });
    var mediosNorm = Object.create(null);
    mediosCat.forEach(function (m) { mediosNorm[_normV031(m)] = m; });

    var cuentasAusentes = Object.create(null);
    var mediosAusentes = Object.create(null);

    plan.aMigrar.forEach(function (f) {
        // excluirNeutras: Traspaso e Inicio Mes se migran con su Cuenta tal cual y SIN Tipo de
        // Cuenta. "Traspaso" figura como ingreso en el Plan de Cuentas de produccion, asi que sin
        // esta opcion la deduccion volveria a clasificarlo como Ingreso y las filas nuevas
        // nacerian ya contaminando los agregados.
        f.tipoCuenta = deducirTipoCuenta(f.cuenta, catalogos, { tolerante: true, excluirNeutras: true });
        f.neutra = esCuentaNeutra(f.cuenta);

        if (!f.tipoCuenta && !f.neutra) {
            plan.sinTipoCuenta.push(f);
            var cN = _normV031(f.cuenta);
            if (cN) {
                if (!cuentasAusentes[cN]) cuentasAusentes[cN] = { nombre: f.cuenta, filas: 0 };
                cuentasAusentes[cN].filas++;
            }
        }
        var mN = _normV031(f.medio);
        if (mN && !mediosNorm[mN]) {
            if (!mediosAusentes[mN]) mediosAusentes[mN] = { nombre: f.medio, filas: 0, sinUnificar: false };
            mediosAusentes[mN].filas++;
        }
        if (f.aliasAplicado) {
            var ka = f.aliasAplicado + ' -> ' + f.medio;
            plan.aliasAplicados[ka] = (plan.aliasAplicados[ka] || 0) + 1;
        }
        if (f.moneda === 'USD') { plan.porMoneda.USD++; plan.filasUsd.push(f); }
        else plan.porMoneda.ARS++;
    });

    V031_MEDIOS_SIN_UNIFICAR.forEach(function (m) {
        var n = _normV031(m);
        if (mediosAusentes[n]) mediosAusentes[n].sinUnificar = true;
    });

    plan.cuentasAusentes = Object.keys(cuentasAusentes).map(function (k) { return cuentasAusentes[k]; })
        .sort(function (a, b) { return b.filas - a.filas; });
    plan.mediosAusentes = Object.keys(mediosAusentes).map(function (k) { return mediosAusentes[k]; })
        .sort(function (a, b) { return b.filas - a.filas; });

    // --- Altas propuestas: declaradas + las que aparezcan sin propuesta ---
    var declaradas = Object.create(null);
    V031_ALTAS_PROPUESTAS.forEach(function (a) { declaradas[_normV031(a.cuenta)] = a; });

    V031_ALTAS_PROPUESTAS.forEach(function (a) {
        var n = _normV031(a.cuenta);
        var enDelta = cuentasAusentes[n] ? cuentasAusentes[n].filas : 0;
        var yaExiste = deducirTipoCuenta(a.cuenta, catalogos, { tolerante: true }) !== '';
        var esNeutra = esCuentaNeutra(a.cuenta);
        // "Inicio Mes" no aparece en cuentasAusentes porque las neutras no se cuentan como
        // "sin tipo de cuenta": se las excluye a proposito. Se cuenta aparte.
        if (esNeutra) {
            enDelta = plan.aMigrar.filter(function (f) { return _normV031(f.cuenta) === n; }).length;
        }
        if (enDelta === 0 && !yaExiste) return;   // no aparece en este delta: no se propone nada
        plan.altas.push({
            cuenta: a.cuenta, tabla: a.tabla, motivo: a.motivo, advertencia: a.advertencia || null,
            filasMedidas: a.filasMedidas, filasEnDelta: enDelta,
            yaExiste: yaExiste, esNeutra: esNeutra,
            aplicable: !yaExiste && !!a.tabla && enDelta > 0
        });
    });

    plan.cuentasAusentes.forEach(function (c) {
        if (declaradas[_normV031(c.nombre)]) return;
        plan.altasNoPropuestas.push(c);
    });

    // --- Tipos de cambio ---
    ['ARS', 'USD', 'AUD', 'EUR'].forEach(function (par) {
        plan.tc.series[par] = _serieTcV031('TC_' + par);
    });
    var vacias = ['ARS', 'USD', 'AUD', 'EUR'].filter(function (p) { return plan.tc.series[p].total === 0; });
    if (vacias.length && plan.aMigrar.length > 0) {
        plan.problemas.push('El Data Lake de cotizaciones no tiene datos para: ' + vacias.join(', ') +
                            '. Sin cotizaciones no se pueden congelar los TC de las filas nuevas y el ledger ' +
                            'quedaria con registros sin valor convertible. Correr antes "Forzar carga historica".');
    }

    // --- COBERTURA DEL DATA LAKE CONTRA EL RANGO DEL LOTE (BLOQUEANTE) ---
    //
    // decision Franco 2026-08-13: si alguna serie no llega hasta la fecha mas nueva del lote, la
    // migracion ABORTA. No es un aviso contable.
    //
    // POR QUE ES BLOQUEANTE Y NO UNA LINEA MAS DEL INFORME: la cotizacion congelada es el UNICO
    // dato del ledger que despues no se puede recalcular. Todo lo demas (Tipo de Cuenta, Medio,
    // hasta la Cuenta) se corrige leyendo de nuevo el origen; el TC, no: la fila queda valuada
    // para siempre a la cotizacion del ultimo dia que el Data Lake conocia, y nada en la planilla
    // se pone rojo. Medido el 2026-08-13: TC_ARS llegaba al 2026-03-20 y USD/AUD/EUR al
    // 2026-03-29, con 540 de 541 filas del delta posteriores a esa fecha. Es decir que el lote
    // entero -- julio y agosto incluidos -- se habria congelado a cotizacion de marzo.
    //
    // La comprobacion vieja (serie VACIA) no cubria este caso: las series existen y tienen 800+
    // cotizaciones cada una. Lo que no tienen es el tramo que hace falta. Una serie que existe
    // pero no cubre el lote es exactamente igual de peligrosa que una vacia, y mas enganosa.
    plan.tc.maxFechaLote = null;
    plan.tc.minFechaLote = null;
    plan.aMigrar.forEach(function (f) {
        if (!plan.tc.maxFechaLote || f.fechaIso > plan.tc.maxFechaLote) plan.tc.maxFechaLote = f.fechaIso;
        if (!plan.tc.minFechaLote || f.fechaIso < plan.tc.minFechaLote) plan.tc.minFechaLote = f.fechaIso;
    });

    plan.tc.cobertura = ['ARS', 'USD', 'AUD', 'EUR'].map(function (par) {
        var s = plan.tc.series[par];
        var desde = s.total ? s.fechas[0] : null;
        var hasta = s.total ? s.fechas[s.fechas.length - 1] : null;
        var fuera = 0, antes = 0, primeraFuera = null;
        plan.aMigrar.forEach(function (f) {
            if (hasta === null || f.fechaIso > hasta) {
                fuera++;
                if (primeraFuera === null || f.fechaIso < primeraFuera) primeraFuera = f.fechaIso;
            } else if (f.fechaIso < desde) {
                antes++;
            }
        });
        return {
            par: par, tabla: 'TC_' + par, cotizaciones: s.total, desde: desde, hasta: hasta,
            filasFuera: fuera, primeraFuera: primeraFuera, filasAntes: antes
        };
    });

    var descubiertas = plan.tc.cobertura.filter(function (c) { return c.filasFuera > 0; });
    if (descubiertas.length && plan.aMigrar.length > 0) {
        plan.problemas.push(
            'EL DATA LAKE DE COTIZACIONES NO LLEGA HASTA EL LOTE. La fecha mas nueva a migrar es ' +
            plan.tc.maxFechaLote + ' y las series cubren hasta: ' +
            descubiertas.map(function (c) {
                return c.par + ' hasta ' + (c.hasta || '(vacia)') + ' (' + c.filasFuera +
                       ' fila/s del lote quedan afuera, la primera el ' + c.primeraFuera + ')';
            }).join('; ') + '. Esas filas congelarian por FALLBACK una cotizacion vieja, y el tipo ' +
            'de cambio congelado es el unico dato del ledger que despues NO se puede recalcular: ' +
            'quedarian valuadas para siempre a la cotizacion del ultimo dia que el Data Lake conoce. ' +
            'QUE HACER: correr "Tidetrack Dev > Tipos de cambio > Forzar carga historica" para ' +
            'extender el Data Lake hasta el ' + plan.tc.maxFechaLote + ', volver a correr ' +
            '"1. Ver estado" y confirmar que las cuatro series lleguen a esa fecha, y recien ahi ' +
            'aplicar. No se escribio nada.'
        );
    }

    var previas = plan.tc.cobertura.filter(function (c) { return c.filasAntes > 0; });
    if (previas.length) {
        plan.avisos.push('Hay filas del lote ANTERIORES al inicio de alguna serie de cotizaciones (' +
            previas.map(function (c) { return c.par + ': ' + c.filasAntes + ' fila/s, la serie arranca el ' + c.desde; }).join('; ') +
            '). Esas congelarian la cotizacion mas antigua disponible. "Forzar carga historica" no ' +
            'necesariamente las cubre: revisar si esas fechas son correctas en la planilla vieja.');
    }

    if (!vacias.length && plan.aMigrar.length > 0) {
        var resTc = _resolverTcV031(plan.aMigrar, plan.tc.series);
        plan.tc.filasConFallback = resTc.filasConFallback;
        plan.tc.detalle = resTc.detalle;
        plan.tc.anomaliasArs = resTc.anomaliasArs;
    }

    // --- Desglose mensual ---
    var porMes = Object.create(null);
    plan.aMigrar.forEach(function (f) {
        var mes = f.fechaIso.substring(0, 7);
        if (!porMes[mes]) porMes[mes] = { mes: mes, filas: 0, ingresos: 0, egresos: 0 };
        porMes[mes].filas++;
        if (f.sentido === 'Ingreso') porMes[mes].ingresos++; else porMes[mes].egresos++;
    });
    plan.desgloseMensual = Object.keys(porMes).sort().map(function (k) { return porMes[k]; });

    // --- Capacidad de grid ---
    var cfg = RANGES.REGISTROS;
    var filaFinal = Math.max(destino.ultimaFila, cfg.dataRow - 1) + plan.aMigrar.length;
    plan.capacidad = {
        maxFilasActual: hojaReg.getMaxRows(),
        filaFinalNecesaria: filaFinal,
        ampliaria: filaFinal > hojaReg.getMaxRows(),
        excedeTope: (filaFinal + GRID_COLCHON_FILAS) > GRID_MAX_FILAS
    };
    if (plan.capacidad.excedeTope) {
        plan.problemas.push('Escribir ' + plan.aMigrar.length + ' filas llevaria "' + plan.nombres.registros +
                            '" hasta la fila ' + filaFinal + ' y ampliarla superaria el tope de seguridad de ' +
                            GRID_MAX_FILAS + ' filas.');
    }

    // --- Avisos ---
    if (origen.sinFecha.length) {
        plan.avisos.push(origen.sinFecha.length + ' fila(s) del origen tienen datos pero NO tienen fecha: ' +
                         'no se migran (sin fecha no hay cruce ni tipo de cambio). Hay que ponerles fecha en ' +
                         'la planilla vieja y volver a correr.');
    }
    if (origen.sinMonto.length) {
        plan.avisos.push(origen.sinMonto.length + ' fila(s) del origen tienen fecha pero ni Ingreso ni Egreso: ' +
                         'no se migran (sin monto no hay sentido que declarar).');
    }
    if (origen.ambiguas.length) {
        plan.avisos.push(origen.ambiguas.length + ' fila(s) del origen tienen Ingreso Y Egreso a la vez: ' +
                         'no se migran, no se adivina cual vale.');
    }
    if (origen.ilegibles.length) {
        plan.avisos.push(origen.ilegibles.length + ' fila(s) del origen tienen un monto que no se pudo ' +
                         'interpretar: no se migran (jamas se asume cero).');
    }
    if (origen.negativas.length) {
        plan.avisos.push(origen.negativas.length + ' fila(s) del origen tienen el monto en NEGATIVO: no se ' +
                         'migran y se listan una por una mas abajo para que decidas. Migrarlas en valor ' +
                         'absoluto las convertiria en un movimiento del sentido contrario que nunca existio, ' +
                         'e indistinguible de uno legitimo en la corrida siguiente.');
    }
    if (origen.fechaAmbigua.length) {
        plan.avisos.push(origen.fechaAmbigua.length + ' fila(s) del origen tienen la fecha como TEXTO con dos ' +
                         'lecturas posibles (dd/mm y mm/dd dan fechas distintas): no se migran. Darles formato ' +
                         'de fecha real en la planilla vieja y volver a correr.');
    }
    if (origen.fechasNoDate) {
        plan.avisos.push(origen.fechasNoDate + ' celda(s) de fecha del origen NO llegaron como fecha real sino ' +
                         'como texto (o como otro tipo). Se interpretan con semantica es-AR dd/mm/yyyy, nunca ' +
                         'con new Date(texto), que leeria "12/04/2026" como 4 de diciembre.');
    }
    if (plan.enVuelo) {
        plan.avisos.push('Hay una corrida iniciada el ' + estado.iniciadaEn + ' que no figura completada. ' +
                         'La proxima aplicacion REUTILIZA su respaldo "' + estado.respaldoRegistros +
                         '" en vez de congelar uno nuevo.');
    }

    return plan;
}

/**
 * Bloque de cobertura del Data Lake contra el lote. Se imprime SIEMPRE que exista, incluso en el
 * camino de bloqueantes: si la migracion se aborta justamente por cobertura, este cuadro es lo
 * que dice cuanto falta y hasta donde hay que extender el Data Lake.
 *
 * @returns {Array<string>} lineas (vacio si el plan no llego a calcular la cobertura)
 */
function _bloqueCoberturaTcV031(plan) {
    var L = [];
    if (!plan || !plan.tc || !plan.tc.cobertura || !plan.tc.cobertura.length) return L;

    L.push('COBERTURA DEL DATA LAKE DE COTIZACIONES CONTRA EL LOTE');
    L.push('  filas del lote: ' + plan.aMigrar.length +
           ' | fecha mas vieja: ' + (plan.tc.minFechaLote || 's/d') +
           ' | FECHA MAS NUEVA DEL LOTE: ' + (plan.tc.maxFechaLote || 's/d'));
    plan.tc.cobertura.forEach(function (c) {
        L.push('  serie ' + c.par + ': ' + c.cotizaciones + ' cotizacion(es), cubre ' +
               (c.desde ? c.desde + ' a ' + c.hasta : '(SERIE VACIA)'));
        L.push('      filas del lote posteriores a esa cobertura: ' + c.filasFuera +
               (c.filasFuera ? '  <-- la primera, el ' + c.primeraFuera : '') +
               (c.filasAntes ? ' | anteriores al inicio de la serie: ' + c.filasAntes : ''));
    });
    return L;
}

/**
 * Redacta el informe del plan. Texto plano, sin emojis, pensado para leerse en el alert y
 * completo en los logs.
 */
function _redactarPlanV031(plan) {
    var L = [];
    var i;

    L.push('MIGRACION HISTORICO v03.1 -> ledger "' + plan.nombres.registros + '"   [' + plan.momento + ']');
    L.push('Modulo v' + V031_VERSION + '. Cruce por AUSENCIA (fecha + monto + sentido, medio para desempatar).');
    L.push('');

    if (plan.problemas.length) {
        L.push('BLOQUEANTES (' + plan.problemas.length + '): aplicar abortaria sin tocar una celda.');
        plan.problemas.forEach(function (p) { L.push('  - ' + p); });
        L.push('');
        var cobBloq = _bloqueCoberturaTcV031(plan);
        if (cobBloq.length) {
            cobBloq.forEach(function (l) { L.push(l); });
            L.push('');
        }
        return L.join('\n');
    }

    L.push('ORIGEN: hoja "' + plan.origen.nombreHoja + '" (resuelta por ' + plan.origen.resueltaPor + ')');
    L.push('  filas con contenido: ' + plan.origen.totalConContenido +
           ' | migrables: ' + plan.origen.filas.length +
           ' | sin fecha: ' + plan.origen.sinFecha.length +
           ' | sin monto: ' + plan.origen.sinMonto.length +
           ' | ambiguas: ' + plan.origen.ambiguas.length +
           ' | monto ilegible: ' + plan.origen.ilegibles.length +
           ' | monto NEGATIVO: ' + plan.origen.negativas.length +
           ' | fecha ambigua: ' + plan.origen.fechaAmbigua.length);
    L.push('  celdas de fecha del origen que NO llegaron como fecha real: ' + plan.origen.fechasNoDate +
           (plan.origen.fechasNoDate ? ' (se parsean como dd/mm/yyyy, es-AR; detalle mas abajo)' : ''));
    L.push('DESTINO: ' + plan.destino.filas + ' fila(s) con dato (ultima: ' + plan.destino.ultimaFila +
           '), suma de montos ' + _montoTextoV031(plan.destino.suma));
    L.push('');

    L.push('CRUCE');
    L.push('  ya estaban (calce exacto con medio): ' + plan.cruce.presentesPorMedio);
    L.push('  ya estaban (mismo dia/monto/sentido, otro medio): ' + plan.cruce.presentesPorClave);
    L.push('  FALTAN Y SE MIGRARIAN: ' + plan.aMigrar.length);
    L.push('');

    if (plan.nadaQueHacer) {
        L.push('NADA QUE HACER: el ledger ya tiene todo lo que hay en la planilla vieja.');
        L.push('');
    }

    if (plan.desgloseMensual.length) {
        L.push('DESGLOSE MENSUAL DE LO QUE FALTA');
        plan.desgloseMensual.forEach(function (m) {
            L.push('  ' + m.mes + ': ' + m.filas + ' fila(s)  (ingresos ' + m.ingresos + ' / egresos ' + m.egresos + ')');
        });
        L.push('');
    }

    if (plan.aMigrar.length) {
        L.push('MONEDA (inferida del medio; "' + V031_PREFIJO_MONEDA_USD + '..." al inicio del nombre = USD)');
        L.push('  ARS: ' + plan.porMoneda.ARS + ' | USD: ' + plan.porMoneda.USD);
        if (plan.filasUsd.length) {
            var mediosUsd = Object.create(null);
            plan.filasUsd.forEach(function (f) { mediosUsd[f.medio] = (mediosUsd[f.medio] || 0) + 1; });
            L.push('  medios tomados como USD: ' + Object.keys(mediosUsd).map(function (k) {
                return k + ' (' + mediosUsd[k] + ')';
            }).join(', '));
        }
        L.push('');

        L.push('TIPOS DE CAMBIO (del Data Lake, nunca de la API)');
        ['ARS', 'USD', 'AUD', 'EUR'].forEach(function (p) {
            var s = plan.tc.series[p];
            L.push('  serie ' + p + ': ' + s.total + ' cotizacion(es)' +
                   (s.total ? ' (' + s.fechas[0] + ' a ' + s.fechas[s.fechas.length - 1] + ')' : '') +
                   (s.ilegibles ? ' | ' + s.ilegibles + ' ilegible(s)' : ''));
        });
        L.push('');
        _bloqueCoberturaTcV031(plan).forEach(function (l) { L.push(l); });
        L.push('');
        L.push('  filas que usarian TC de FALLBACK: ' + plan.tc.filasConFallback +
               ' de ' + plan.aMigrar.length);
        var clavesFb = Object.keys(plan.tc.detalle).sort();
        if (clavesFb.length) {
            L.push('  combinaciones de fallback (par | pedida | modo | usada | filas):');
            clavesFb.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (k) {
                L.push('    ' + k.split('|').join(' | ') + ' | ' + plan.tc.detalle[k]);
            });
            if (clavesFb.length > V031_MAX_DETALLE_INFORME) {
                L.push('    [...] ' + (clavesFb.length - V031_MAX_DETALLE_INFORME) + ' mas, todas en los logs.');
            }
        }
        if (plan.tc.anomaliasArs.length) {
            L.push('  AVISO: ' + plan.tc.anomaliasArs.length + ' fecha(s) con cotizacion ARS distinta de 1 ' +
                   '(ARS es la unidad base: revisar el Data Lake).');
        }
        L.push('');
    }

    if (Object.keys(plan.aliasAplicados).length) {
        L.push('ALIAS DE MEDIOS QUE SE UNIFICARIAN');
        Object.keys(plan.aliasAplicados).sort().forEach(function (k) {
            L.push('  ' + k + '  (' + plan.aliasAplicados[k] + ' fila/s)');
        });
        L.push('');
    }

    if (plan.altas.length) {
        L.push('ALTAS DE CUENTAS PROPUESTAS  --  FRANCO TIENE QUE CONFIRMARLAS AL APLICAR');
        plan.altas.forEach(function (a) {
            var destinoTxt = a.tabla ? RANGES[a.tabla].start + ':' + RANGES[a.tabla].end + ' (' + a.tabla + ')' : 'NINGUN BLOQUE';
            L.push('  - "' + a.cuenta + '" -> ' + destinoTxt);
            L.push('      filas en este delta: ' + a.filasEnDelta + ' (medidas el 2026-08-13: ' + a.filasMedidas + ')');
            L.push('      motivo: ' + a.motivo);
            if (a.yaExiste) L.push('      YA EXISTE en el Plan de Cuentas: no se da de alta.');
            if (a.esNeutra) L.push('      CUENTA NEUTRA: no se da de alta en ningun bloque, ya vive en CUENTAS_NEUTRAS.');
            if (a.advertencia) L.push('      ' + a.advertencia);
        });
        L.push('  NOTA: el alta escribe SOLO el nombre; la columna Proyecto queda vacia y hay que');
        L.push('  completarla a mano (el devtool no inventa a que proyecto pertenece una cuenta).');
        L.push('');
    }

    if (plan.altasNoPropuestas.length) {
        L.push('CUENTAS SIN PROPUESTA DECLARADA (aparecieron despues del 2026-08-13): decide Franco.');
        plan.altasNoPropuestas.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (c) {
            L.push('  - "' + c.nombre + '" (' + c.filas + ' fila/s). No se da de alta: se migra sin Tipo de Cuenta.');
        });
        L.push('');
    }

    if (plan.mediosAusentes.length) {
        L.push('MEDIOS QUE NO ESTAN EN EL PLAN DE CUENTAS (solo se reportan, NO se dan de alta)');
        plan.mediosAusentes.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (m) {
            L.push('  - "' + m.nombre + '" (' + m.filas + ' fila/s)' +
                   (m.sinUnificar ? '  [declarado como alta candidata: decide Franco si se unifica]' : ''));
        });
        L.push('');
    }

    if (plan.sinTipoCuenta.length) {
        L.push('FILAS QUE QUEDARIAN SIN TIPO DE CUENTA: ' + plan.sinTipoCuenta.length);
        L.push('  (su cuenta no esta en ningun bloque del Plan de Cuentas; se migran igual, como hace');
        L.push('   procesarCargas. Confirmar las altas de arriba reduce este numero.)');
        L.push('');
    }

    var neutras = plan.aMigrar.filter(function (f) { return f.neutra; }).length;
    if (neutras) {
        L.push('CUENTAS NEUTRAS EN EL LOTE: ' + neutras + ' fila(s) (' + CUENTAS_NEUTRAS.join(', ') + ').');
        L.push('  Migran con su Cuenta tal cual y con el Tipo de Cuenta VACIO a proposito: son');
        L.push('  movimientos permutativos, no afectan resultado. @see CUENTAS_NEUTRAS en 00_Config.js');
        L.push('');
    }

    if (plan.origen.sinFecha.length) {
        L.push('FILAS DEL ORIGEN CON DATOS Y SIN FECHA (NO se migran; ponerles fecha en la planilla vieja)');
        plan.origen.sinFecha.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (f) {
            L.push('  - fila ' + f.filaFisica + ': ' + _montoTextoV031(f.monto) + ' | ' +
                   (f.detalle || '(sin detalle)') + ' | ' + (f.medioOriginal || '(sin medio)'));
        });
        L.push('');
    }

    if (plan.origen.negativas.length) {
        L.push('FILAS DEL ORIGEN CON MONTO NEGATIVO -- NO SE MIGRAN, DECIDE FRANCO (' +
               plan.origen.negativas.length + ')');
        L.push('  Una devolucion o una correccion cargada con signo. Migrarla en valor absoluto la');
        L.push('  volveria un movimiento del sentido contrario que nunca ocurrio, y en la corrida');
        L.push('  siguiente seria indistinguible de uno legitimo (la clave de cruce compara en valor');
        L.push('  absoluto). Corregirlas en la planilla vieja -- pasarlas a la columna que corresponde,');
        L.push('  o anular la fila original -- y volver a correr.');
        plan.origen.negativas.slice(0, V031_MAX_NEGATIVAS_INFORME).forEach(function (f) {
            L.push('  - fila ' + f.filaFisica + ' del origen | ' + (f.fechaIso || 's/f') +
                   ' | columna ' + (f.columnaMonto || 's/d') + ' = ' + _montoTextoV031(f.monto) +
                   ' | "' + (f.detalle || '(sin detalle)') + '"' +
                   ' | medio: ' + (f.medioOriginal || '(sin medio)') +
                   (f.nota ? ' | nota: ' + f.nota : ''));
        });
        if (plan.origen.negativas.length > V031_MAX_NEGATIVAS_INFORME) {
            L.push('  [...] ' + (plan.origen.negativas.length - V031_MAX_NEGATIVAS_INFORME) +
                   ' mas (informe completo en Ver > Registros de ejecucion).');
        }
        L.push('');
    }

    if (plan.origen.fechasNoDate) {
        L.push('CELDAS DE FECHA DEL ORIGEN QUE NO LLEGARON COMO FECHA REAL: ' + plan.origen.fechasNoDate);
        L.push('  Se interpretan con semantica es-AR dd/mm/yyyy EXPLICITA. Nunca con new Date(texto),');
        L.push('  que leeria "12/04/2026" como 4 de diciembre y escribiria la fila con el mes cambiado.');
        L.push('  Las marcadas AMBIGUA admiten las dos lecturas y NO se migran.');
        plan.origen.fechasNoDateDetalle.slice(0, V031_MAX_FECHAS_TEXTO_INFORME).forEach(function (f) {
            L.push('  - fila ' + f.filaFisica + ': "' + f.crudo + '" (' + f.tipo + ') -> ' +
                   (f.iso ? f.iso : 'NO INTERPRETABLE, no se migra') +
                   (f.ambigua ? '   AMBIGUA: leida al reves seria ' + f.isoAlterno + ', NO se migra' : '') +
                   (f.detalle ? ' | "' + f.detalle + '"' : ''));
        });
        if (plan.origen.fechasNoDateDetalle.length > V031_MAX_FECHAS_TEXTO_INFORME) {
            L.push('  [...] ' + (plan.origen.fechasNoDateDetalle.length - V031_MAX_FECHAS_TEXTO_INFORME) +
                   ' mas (informe completo en Ver > Registros de ejecucion).');
        }
        L.push('');
    }

    if (plan.origen.fechaAmbigua.length) {
        L.push('FILAS DEL ORIGEN CON FECHA AMBIGUA (NO se migran; darles formato de fecha real)');
        plan.origen.fechaAmbigua.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (f) {
            L.push('  - fila ' + f.filaFisica + ': "' + f.fechaCrudo + '" -> ' + f.fechaIso +
                   ' leida dd/mm, o ' + f.fechaAlterna + ' leida mm/dd | ' +
                   _montoTextoV031(f.monto) + ' | ' + (f.detalle || '(sin detalle)'));
        });
        L.push('');
    }

    if (plan.origen.ambiguas.length) {
        L.push('FILAS DEL ORIGEN CON INGRESO Y EGRESO A LA VEZ (NO se migran)');
        plan.origen.ambiguas.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (f) {
            L.push('  - fila ' + f.filaFisica + ': ' + (f.detalle || '(sin detalle)'));
        });
        L.push('');
    }

    if (plan.origen.ilegibles.length) {
        L.push('FILAS DEL ORIGEN CON MONTO ILEGIBLE (NO se migran)');
        plan.origen.ilegibles.slice(0, V031_MAX_DETALLE_INFORME).forEach(function (f) {
            L.push('  - fila ' + f.filaFisica + ': ' + (f.detalle || '(sin detalle)'));
        });
        L.push('');
    }

    if (plan.capacidad) {
        L.push('CAPACIDAD DE GRID: "' + plan.nombres.registros + '" tiene ' + plan.capacidad.maxFilasActual +
               ' filas y se necesita llegar a la ' + plan.capacidad.filaFinalNecesaria +
               (plan.capacidad.ampliaria ? ' -> SE AMPLIA antes de escribir.' : ' -> alcanza, no se amplia.'));
        L.push('');
    }

    if (plan.avisos.length) {
        L.push('AVISOS');
        plan.avisos.forEach(function (a) { L.push('  - ' + a); });
        L.push('');
    }

    L.push('QUE HARIA "2. Aplicar": respaldo completo y verificado del ledger -> altas confirmadas ->');
    L.push('escribir ' + plan.aMigrar.length + ' fila(s) en UN solo batch -> reordenar por fecha descendente.');
    L.push('Revertir restaura el ledger entero desde el respaldo de la ultima corrida.');

    return L.join('\n');
}

// ============================================
// RESPALDO (SIEMPRE ANTES DE MUTAR, SIEMPRE VERIFICADO)
// ============================================

/**
 * Mide el area de datos del ledger: filas con dato, suma de montos, ultima fila y huella de la
 * primera. Se usa para verificar el respaldo al crearlo y para revalidarlo al restaurar.
 *
 * Sirve tanto para la hoja viva como para cualquier respaldo suyo: comparten geometria.
 */
function _medirRegistrosV031(hoja) {
    if (!hoja || typeof hoja.getMaxRows !== 'function') {
        throw new Error('_medirRegistrosV031 recibio una hoja invalida (' +
                        (hoja === null ? 'null' : typeof hoja) + '). Suele significar que el ledger o ' +
                        'su respaldo no existe con el nombre esperado.');
    }
    var cfg = RANGES.REGISTROS;
    var colIni = columnLetterToIndex(cfg.start);
    var nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    var salida = {
        filas: 0, suma: 0, ultimaFila: 0, primeraHuella: '',
        maxFilas: hoja.getMaxRows(), maxCols: hoja.getMaxColumns(),
        columnasSuficientes: hoja.getMaxColumns() >= (colIni + nCols - 1)
    };
    if (!salida.columnasSuficientes) return salida;

    var alto = salida.maxFilas - cfg.dataRow + 1;
    if (alto <= 0) return salida;

    var datos = hoja.getRange(cfg.dataRow, colIni, alto, nCols).getValues();
    datos.forEach(function (f, idx) {
        var tieneAlgo = false;
        for (var c = 0; c < nCols; c++) {
            if (!_vaciaV031(f[c])) { tieneAlgo = true; break; }
        }
        if (!tieneAlgo) return;
        salida.filas++;
        salida.ultimaFila = cfg.dataRow + idx;
        var monto = _numeroV031(f[0]);
        if (monto !== null) salida.suma += monto;
        if (!salida.primeraHuella) {
            salida.primeraHuella = _huellaCeldaV031(f[0]) + ' / ' + _huellaCeldaV031(f[6]) +
                                   ' / ' + _huellaCeldaV031(f[2]);
        }
    });
    salida.suma = _redondearV031(salida.suma);
    return salida;
}

/**
 * Congela el ledger completo en una hoja nueva, fechada y oculta, aplanado a VALORES, y LO RELEE
 * para verificarlo. Si la copia no coincide con la hoja viva, LANZA: no existe "respaldo hecho"
 * sin lectura de vuelta, porque un copyTo que no puebla devuelve exito igual (cicatriz 4).
 *
 * @throws {Error} si la copia no queda verificada (el llamador aborta ANTES de mutar)
 */
function _respaldarRegistrosV031(ss, hojaReg, sello) {
    var vivo = _medirRegistrosV031(hojaReg);

    var nombre = _nombreHojaLibreV031(ss, V031_PREFIJO_RESPALDO + sello);
    var destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();   // el cache de nombres del config quedo viejo

    var filas = hojaReg.getMaxRows();
    var cols = hojaReg.getMaxColumns();
    if (destino.getMaxRows() < filas) destino.insertRowsAfter(destino.getMaxRows(), filas - destino.getMaxRows());
    if (destino.getMaxColumns() < cols) destino.insertColumnsAfter(destino.getMaxColumns(), cols - destino.getMaxColumns());

    var origenRango = hojaReg.getRange(1, 1, filas, cols);
    var destinoRango = destino.getRange(1, 1, filas, cols);
    origenRango.copyTo(destinoRango, SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);

    // El formato NO es cosmetico en este respaldo: sin el, las fechas del ledger vuelven como
    // seriales al restaurar. Igual no bloquea el respaldo -- la restauracion sabe convertir
    // seriales a Date --, pero si falla queda registrado.
    var formatoCopiado = true;
    try {
        origenRango.copyTo(destinoRango, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    } catch (e) {
        formatoCopiado = false;
        logInfo('_respaldarRegistrosV031: no se pudo copiar el formato al respaldo (' + e.message +
                '). Las fechas se restauran convirtiendo el serial.');
    }

    // --- VERIFICACION: se relee la copia. Sin esto, "respaldo" es una afirmacion sin evidencia.
    SpreadsheetApp.flush();
    var copia = _medirRegistrosV031(destino);

    var fallas = [];
    if (!copia.columnasSuficientes) {
        fallas.push('la copia quedo con ' + copia.maxCols + ' columnas y el ledger llega a la ' + RANGES.REGISTROS.end);
    }
    if (copia.filas !== vivo.filas) {
        fallas.push('la hoja viva tiene ' + vivo.filas + ' fila(s) con dato y la copia ' + copia.filas);
    }
    if (Math.abs(copia.suma - vivo.suma) > V031_TOLERANCIA_MONTO) {
        fallas.push('la suma de montos no coincide: viva ' + _montoTextoV031(vivo.suma) +
                    ' vs copia ' + _montoTextoV031(copia.suma));
    }
    if (vivo.filas > 0 && copia.primeraHuella !== vivo.primeraHuella) {
        fallas.push('la primera fila de la copia ("' + copia.primeraHuella +
                    '") no coincide con la de la hoja viva ("' + vivo.primeraHuella + '")');
    }

    if (fallas.length) {
        // La hoja se deja VISIBLE: hay que poder mirarla para entender que paso.
        throw new Error('El respaldo de "' + hojaReg.getName() + '" quedo en "' + nombre +
                        '" pero NO VERIFICA contra la hoja viva: ' + fallas.join('; ') +
                        '. No se muto ninguna celda del ledger.');
    }

    destino.hideSheet();
    logSuccess('Respaldo congelado y VERIFICADO de "' + hojaReg.getName() + '" en "' + nombre + '" (' +
               filas + 'x' + cols + ', solo valores; ' + copia.filas + ' filas con dato, suma ' +
               _montoTextoV031(copia.suma) + ').');

    return {
        nombre: nombre, filas: copia.filas, suma: copia.suma, ultimaFila: copia.ultimaFila,
        primeraHuella: copia.primeraHuella, formatoCopiado: formatoCopiado
    };
}

/**
 * Valida que un respaldo siga siendo el que se verifico al crearlo. NO ESCRIBE NADA: es lo que
 * se corre antes de restaurar.
 *
 * El criterio es la IDENTIDAD con el conteo registrado al congelarlo, no una comparacion con la
 * hoja viva: en una reversion legitima la viva tiene MAS filas (justo las que se migraron).
 */
function _validarRespaldoV031(hojaResp, registrado) {
    var problemas = [];
    var avisos = [];

    if (!hojaResp || typeof hojaResp.getMaxRows !== 'function') {
        return {
            ok: false,
            problemas: ['la hoja de respaldo referenciada en el registro no existe en la planilla ' +
                        '(pudo renombrarse o eliminarse a mano). No hay punto de retorno verificable.'],
            avisos: avisos, medida: null
        };
    }
    var m = _medirRegistrosV031(hojaResp);

    if (!m.columnasSuficientes) {
        problemas.push('el respaldo "' + hojaResp.getName() + '" tiene ' + m.maxCols +
                       ' columnas y el ledger llega a la ' + RANGES.REGISTROS.end + '.');
    }
    if (!registrado) {
        avisos.push('el respaldo no tiene conteo registrado: no se puede comparar contra el momento en ' +
                    'que se congelo.');
        if (m.filas === 0) problemas.push('el respaldo no tiene una sola fila con dato.');
        return { ok: problemas.length === 0, problemas: problemas, avisos: avisos, medida: m };
    }
    if (registrado.filas !== undefined && m.filas !== registrado.filas) {
        problemas.push('el respaldo tenia ' + registrado.filas + ' fila(s) con dato cuando se verifico y ' +
                       'ahora tiene ' + m.filas + ': la hoja de respaldo fue alterada.');
    }
    if (registrado.suma !== undefined && Math.abs(m.suma - registrado.suma) > V031_TOLERANCIA_MONTO) {
        problemas.push('la suma de montos del respaldo era ' + _montoTextoV031(registrado.suma) +
                       ' y ahora es ' + _montoTextoV031(m.suma) + ': la hoja de respaldo fue alterada.');
    }
    if (registrado.primeraHuella && m.primeraHuella !== registrado.primeraHuella) {
        problemas.push('la primera fila del respaldo cambio ("' + registrado.primeraHuella + '" -> "' +
                       m.primeraHuella + '").');
    }

    return { ok: problemas.length === 0, problemas: problemas, avisos: avisos, medida: m };
}

// ============================================
// OPERACIONES DE ESCRITURA
// ============================================

/**
 * Da de alta en el Plan de Cuentas las cuentas confirmadas. Solo el nombre: la columna Proyecto
 * queda vacia porque este modulo no sabe a que proyecto pertenece cada cuenta, y llenarla con
 * una suposicion contaminaria los agrupamientos del Tablero.
 *
 * @param {Array<Object>} altas entradas del plan con aplicable === true
 * @returns {{hechas: Array<string>, fallidas: Array<string>}}
 */
function _aplicarAltasV031(altas) {
    var hechas = [];
    var fallidas = [];
    altas.forEach(function (a) {
        if (!a.aplicable) return;
        try {
            appendRow(a.tabla, [a.cuenta]);
            hechas.push(a.cuenta + ' -> ' + a.tabla);
            logSuccess('MIGRACION v031: alta de cuenta "' + a.cuenta + '" en ' + a.tabla + ' (Proyecto vacio).');
        } catch (e) {
            fallidas.push(a.cuenta + ' (' + e.message + ')');
            logError('MIGRACION v031: fallo el alta de "' + a.cuenta + '" en ' + a.tabla, e);
        }
    });
    return { hechas: hechas, fallidas: fallidas };
}

/**
 * Arma la matriz destino (B:M) a partir de las filas a migrar.
 * El orden de las columnas sale de RANGES.REGISTROS.columns, que es el SSOT del layout.
 */
function _matrizDestinoV031(filas) {
    return filas.map(function (f) {
        return [
            f.monto,                       // B Monto
            f.sentido,                     // C Tipo
            f.cuenta,                      // D Cuenta
            f.tipoCuenta,                  // E Tipo de Cuenta (vacio en las neutras, a proposito)
            f.medio,                       // F Medio (con alias ya aplicado)
            f.moneda,                      // G Moneda (inferida del medio)
            f.fechaValor,                  // H Fecha
            f.nota,                        // I Nota (Observacion del origen)
            f.tc.ARS,                      // J
            f.tc.USD,                      // K
            f.tc.AUD,                      // L
            f.tc.EUR                       // M
        ];
    });
}

/**
 * Reordena el ledger por fecha descendente, igual que hace procesarCargas().
 * Best-effort: las filas YA quedaron escritas, y dejar caer todo por un sort fallido invitaria
 * a re-ejecutar y duplicar el lote.
 */
function _reordenarLedgerV031(hojaReg) {
    var cfg = RANGES.REGISTROS;
    var colIni = columnLetterToIndex(cfg.start);
    var nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    var colFecha = columnLetterToIndex(cfg.columns.fecha);
    var ultima = hojaReg.getLastRow();
    if (ultima < cfg.dataRow) return 'sort omitido: el ledger no tiene filas de datos.';
    try {
        hojaReg.getRange(cfg.dataRow, colIni, ultima - cfg.dataRow + 1, nCols)
            .sort({ column: colFecha, ascending: false });
        SpreadsheetApp.flush();   // sort() es perezoso: el flush fuerza el error dentro del try
        return 'ledger reordenado por fecha descendente.';
    } catch (e) {
        logError('MIGRACION v031: sort omitido (posibles celdas combinadas en el ledger)', e);
        return 'AVISO: no se pudo reordenar por fecha (' + e.message + '). Las filas quedaron escritas igual.';
    }
}

// ============================================
// FUNCIONES PUBLICAS (MENU)
// ============================================

/**
 * Informa QUE MIGRARIA, sin escribir una sola celda. Es lo primero que se corre.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}} ok=false si hay bloqueantes
 */
function estadoMigracionV031(yaConLock) {
    return _informarResultadoV031('Migracion historico v03.1 - estado', _conLockV031(yaConLock, function () {
        try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var plan = _planV031(ss);
            var informe = _redactarPlanV031(plan);
            Logger.log(informe);
            _loguearFallbacksTcV031(plan.tc ? plan.tc.detalle : {});
            _alertaV031('Migracion historico v03.1 - estado', informe);

            if (plan.problemas.length) {
                // Los bloqueantes viajan DENTRO del error, no solo en el informe: un llamador
                // headless (o un log) que solo vea .error tiene que poder saber que pasa sin
                // tener que ir a buscar el detalle a otro lado.
                return {
                    ok: false,
                    error: 'La planilla no esta en el estado esperado: ' + plan.problemas.length +
                           ' bloqueante(s). aplicarMigracionV031() abortaria sin tocar nada. ' +
                           'Bloqueantes: ' + plan.problemas.join(' | '),
                    detalle: informe,
                    _avisado: true
                };
            }
            return { ok: true, detalle: informe };
        } catch (err) {
            logError('estadoMigracionV031: fallo la lectura del estado', err);
            var traza = err && err.stack ? String(err.stack).split('\n').slice(0, 6).join('\n') : '(sin stack)';
            return {
                ok: false,
                error: 'No se pudo leer el estado: ' + err.message + '. No se escribio nada.',
                detalle: 'DETALLE TECNICO (copiar y pasar a la sesion de trabajo):\n' + traza
            };
        }
    }));
}

/**
 * Migra al ledger todo lo que la planilla vieja tiene y el ledger no.
 *
 * Aborta ANTES de tocar una celda si el plan trae cualquier bloqueante. La confirmacion es
 * obligatoria cuando hay UI; sin UI solo procede si el llamador declara yaConLock (esta siendo
 * conducida por una rutina que ya decidio), nunca por iniciativa propia.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarMigracionV031(yaConLock) {
    return _informarResultadoV031('Migracion historico v03.1 - NO APLICADA', _conLockV031(yaConLock, function () {
        // progreso.muto se enciende justo antes de la PRIMERA escritura sobre una hoja viva: es
        // lo que le permite al catch de ultima instancia no mentir en ninguna direccion.
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoAplicarV031(progreso, yaConLock === true);
        } catch (err) {
            logError('aplicarMigracionV031: excepcion no prevista', err);
            if (!progreso.muto) {
                return {
                    ok: false,
                    error: 'Excepcion no prevista antes de mutar: ' + err.message +
                           '. No se modifico ninguna celda del ledger' +
                           (progreso.respaldo ? ' (puede haber quedado la hoja de respaldo "' +
                            progreso.respaldo + '", se borra a mano)' : '') + '.'
                };
            }
            return {
                ok: false,
                error: 'Excepcion no prevista DESPUES de haber empezado a escribir: ' + err.message +
                       '. NO SE PUDO CONFIRMAR el estado del ledger: correr estadoMigracionV031() y, ' +
                       'si hace falta, revertirMigracionV031()' +
                       (progreso.respaldo ? ' (respaldo "' + progreso.respaldo + '")' : '') + '.'
            };
        }
    }));
}

/**
 * Cuerpo de aplicarMigracionV031(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 *
 * @param {{muto: boolean, respaldo: ?string}} progreso testigo de si ya se escribio sobre hojas vivas
 * @param {boolean} conducida true si el llamador ya tenia el lock
 */
function _cuerpoAplicarV031(progreso, conducida) {
    var ss, plan, informe;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        plan = _planV031(ss);
        informe = _redactarPlanV031(plan);
        Logger.log(informe);
    } catch (err) {
        logError('aplicarMigracionV031: fallo el preflight', err);
        return { ok: false, error: 'Fallo el preflight: ' + err.message + '. No se escribio nada.' };
    }

    if (plan.problemas.length) {
        _alertaV031('Migracion historico v03.1 - ABORTADA', informe);
        return {
            ok: false,
            error: 'Abortada por preflight, no se toco ninguna celda. Bloqueantes: ' + plan.problemas.join(' | '),
            detalle: informe,
            _avisado: true
        };
    }

    if (plan.nadaQueHacer) {
        _alertaV031('Migracion historico v03.1', 'Nada que hacer: el ledger ya tiene todo lo que hay en ' +
                    'la planilla vieja.\n\n' + informe);
        return { ok: true, detalle: 'Nada que hacer, el ledger ya esta completo.\n\n' + informe };
    }

    _loguearFallbacksTcV031(plan.tc.detalle);

    // --- Confirmacion de la migracion ---
    var ui = _uiV031();
    var rangoFechas = plan.desgloseMensual.length
        ? plan.desgloseMensual[0].mes + ' a ' + plan.desgloseMensual[plan.desgloseMensual.length - 1].mes
        : 's/d';
    if (ui) {
        var resp = ui.alert(
            'Migracion historico v03.1' + (plan.enVuelo ? ' (reintento)' : ''),
            'Se van a agregar ' + plan.aMigrar.length + ' fila(s) al ledger "' + plan.nombres.registros + '".\n' +
            '  meses: ' + rangoFechas + '\n' +
            '  sin Tipo de Cuenta: ' + plan.sinTipoCuenta.length + '\n' +
            '  con TC de fallback: ' + plan.tc.filasConFallback + '\n\n' +
            (plan.enVuelo
                ? 'REINTENTO de la corrida iniciada el ' + plan.estadoGuardado.iniciadaEn + ': se CONSERVA su ' +
                  'respaldo "' + plan.estadoGuardado.respaldoRegistros + '" (no se congela uno nuevo).\n'
                : 'Antes de tocar nada se congela un respaldo verificado del ledger completo.\n') +
            'Corriste "1. Ver estado" y leiste el informe? Continuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) {
            logInfo('aplicarMigracionV031: cancelada por el usuario.');
            return { ok: false, error: 'Cancelada por el usuario. No se escribio nada.' };
        }
    } else if (conducida !== true) {
        return {
            ok: false,
            error: 'Sin UI para confirmar una operacion que escribe sobre produccion. ' +
                   'Ejecutar desde el menu Tidetrack Dev. No se escribio nada.'
        };
    } else {
        logInfo('aplicarMigracionV031: sin UI, ejecutada por un llamador que ya tiene el lock.');
    }

    // --- Confirmacion SEPARADA de las altas de catalogo ---
    // decision Franco 2026-08-13: dos preguntas y no una. Migrar filas es reversible con el
    // respaldo; dar de alta cuentas toca el Plan de Cuentas, que es la hoja de la que dependen
    // todas las vistas, y NO lo cubre el respaldo del ledger. Ante la duda, la migracion sigue
    // y las filas quedan sin Tipo de Cuenta: eso se arregla despues sin perder nada.
    var altasAplicables = plan.altas.filter(function (a) { return a.aplicable; });
    var altasConfirmadas = false;
    if (altasAplicables.length) {
        if (ui) {
            var textoAltas = altasAplicables.map(function (a) {
                return '  - "' + a.cuenta + '" -> ' + RANGES[a.tabla].start + ':' + RANGES[a.tabla].end +
                       ' (' + a.filasEnDelta + ' fila/s)';
            }).join('\n');
            var respAltas = ui.alert(
                'Dar de alta ' + altasAplicables.length + ' cuenta(s) en el Plan de Cuentas?',
                textoAltas + '\n\n' +
                'SI  = se dan de alta y esas filas migran YA clasificadas.\n' +
                'NO  = no se toca el Plan de Cuentas y esas filas migran sin Tipo de Cuenta\n' +
                '      (se puede completar despues a mano).\n\n' +
                'La columna Proyecto queda vacia en cualquier caso: hay que completarla a mano.',
                ui.ButtonSet.YES_NO
            );
            altasConfirmadas = (respAltas === ui.Button.YES);
        } else {
            logInfo('aplicarMigracionV031: sin UI, las altas de catalogo NO se aplican (nadie las confirmo).');
        }
    }

    var sello = _selloV031();
    var hechos = [];
    var estadoPrevio = plan.estadoGuardado || {};
    var respaldo = null;

    // --- RESPALDO CONGELADO Y VERIFICADO ANTES DE MUTAR ---
    try {
        if (plan.enVuelo) {
            // Corrida anterior iniciada y sin completar: no se sabe si su batch entro. Congelar
            // ahora fotografiaria un estado dudoso, asi que se reutiliza el respaldo anterior
            // previa revalidacion (regla del molde v0.9.5).
            var hojaRespPrevia = estadoPrevio.respaldoRegistros ? ss.getSheetByName(estadoPrevio.respaldoRegistros) : null;
            if (!hojaRespPrevia) {
                return {
                    ok: false,
                    error: 'Hay una corrida iniciada el ' + estadoPrevio.iniciadaEn + ' que no figura completada, ' +
                           'y su respaldo "' + estadoPrevio.respaldoRegistros + '" no esta en la planilla. No se ' +
                           'congela uno nuevo: podria ser la foto de un ledger a medio escribir. No se modifico ' +
                           'ninguna celda. Recuperar esa hoja (Archivo > Historial de versiones) y reintentar, o ' +
                           'revisar el ledger a mano y borrar la propiedad "' + V031_PROP_ESTADO + '".'
                };
            }
            var reval = _validarRespaldoV031(hojaRespPrevia, estadoPrevio.respaldoConteo);
            if (!reval.ok) {
                return {
                    ok: false,
                    error: 'El respaldo "' + estadoPrevio.respaldoRegistros + '" de la corrida en curso ya no es ' +
                           'confiable: ' + reval.problemas.join('; ') + '. No se congelo uno nuevo ni se modifico ' +
                           'ninguna celda: sin punto de retorno valido esta migracion no sigue.'
                };
            }
            respaldo = {
                nombre: estadoPrevio.respaldoRegistros,
                filas: reval.medida.filas, suma: reval.medida.suma,
                ultimaFila: reval.medida.ultimaFila, primeraHuella: reval.medida.primeraHuella
            };
            hechos.push('respaldo: se reutiliza el de la corrida en vuelo, "' + respaldo.nombre + '" (no se pisa).');
            _guardarEstadoV031({
                intentos: (estadoPrevio.intentos || 1) + 1,
                ultimoIntentoEn: new Date().toISOString()
            });
        } else {
            respaldo = _respaldarRegistrosV031(ss, plan.hojas.registros, sello);
            hechos.push('respaldo: "' + respaldo.nombre + '" congelado y VERIFICADO (' + respaldo.filas +
                        ' filas, suma ' + _montoTextoV031(respaldo.suma) + ').');
            _guardarEstadoV031({
                iniciadaEn: new Date().toISOString(),
                completadaEn: null,
                revertidaEn: null,
                respaldoRegistros: respaldo.nombre,
                respaldoConteo: {
                    filas: respaldo.filas, suma: respaldo.suma,
                    ultimaFila: respaldo.ultimaFila, primeraHuella: respaldo.primeraHuella
                },
                formatoCopiado: respaldo.formatoCopiado,
                intentos: 1
            });
        }
        progreso.respaldo = respaldo.nombre;
    } catch (errResp) {
        logError('aplicarMigracionV031: fallo el respaldo', errResp);
        return {
            ok: false,
            error: 'No se pudo dejar un respaldo verificado del ledger: ' + errResp.message +
                   ' No se modifico ninguna celda: sin punto de retorno esta migracion no empieza.'
        };
    }

    // --- A PARTIR DE ACA SE ESCRIBE SOBRE HOJAS VIVAS ---
    progreso.muto = true;

    // 1. Altas de catalogo (si Franco las confirmo), ANTES de deducir de nuevo.
    if (altasConfirmadas) {
        var resAltas = _aplicarAltasV031(altasAplicables);
        if (resAltas.hechas.length) hechos.push('altas aplicadas: ' + resAltas.hechas.join(', ') + '.');
        if (resAltas.fallidas.length) hechos.push('AVISO, altas fallidas: ' + resAltas.fallidas.join(', ') + '.');

        // Re-deducir con los catalogos ya actualizados: es el punto de todo el paso.
        var catalogos2 = leerCatalogosPlanCuentas();
        var reclasificadas = 0;
        plan.aMigrar.forEach(function (f) {
            if (f.tipoCuenta || f.neutra) return;
            var t = deducirTipoCuenta(f.cuenta, catalogos2, { tolerante: true, excluirNeutras: true });
            if (t) { f.tipoCuenta = t; reclasificadas++; }
        });
        hechos.push('reclasificadas tras las altas: ' + reclasificadas + ' fila(s).');
    } else if (altasAplicables.length) {
        hechos.push('altas NO aplicadas (no confirmadas): ' + altasAplicables.length + ' cuenta(s) siguen ' +
                    'sin dar de alta y sus filas migran sin Tipo de Cuenta.');
    }

    // 2. Capacidad de grid ANTES de la primera escritura del lote: o entra todo, o no se escribe.
    try {
        asegurarCapacidadFilas(plan.hojas.registros, plan.capacidad.filaFinalNecesaria);
    } catch (errCap) {
        logError('aplicarMigracionV031: capacidad insuficiente en el ledger', errCap);
        return {
            ok: false,
            error: 'No se pudo preparar el grid del ledger: ' + errCap.message +
                   ' No se escribio ninguna fila del lote. El respaldo "' + respaldo.nombre + '" quedo congelado.'
        };
    }

    // 3. Escritura del lote en UN solo batch.
    var matriz = _matrizDestinoV031(plan.aMigrar);
    var filasAntes = plan.destino.filas;
    try {
        appendMassive('REGISTROS', matriz, RANGES.REGISTROS.dataRow);
        hechos.push('escritas ' + matriz.length + ' fila(s) en un unico batch.');
    } catch (errEsc) {
        logError('aplicarMigracionV031: fallo la escritura del lote', errEsc);
        return {
            ok: false,
            error: 'Fallo la escritura del lote: ' + errEsc.message +
                   ' NO SE PUDO CONFIRMAR cuantas filas entraron. Correr "1. Ver estado" para ver el ledger real ' +
                   'y, si quedo a medias, "3. Revertir" con el respaldo "' + respaldo.nombre + '".'
        };
    }

    // 4. Reordenar por fecha descendente (best-effort, igual que el pipeline).
    hechos.push(_reordenarLedgerV031(plan.hojas.registros));

    // 5. Verificacion posterior: se relee el ledger y se compara con lo esperado.
    var despues = _medirRegistrosV031(plan.hojas.registros);
    var esperado = filasAntes + matriz.length;
    var verificado = (despues.filas === esperado);
    if (verificado) {
        hechos.push('verificacion: el ledger paso de ' + filasAntes + ' a ' + despues.filas +
                    ' fila(s) con dato, exactamente las ' + matriz.length + ' esperadas.');
    } else {
        hechos.push('AVISO: se esperaban ' + esperado + ' fila(s) con dato y el ledger tiene ' + despues.filas +
                    '. Las filas se escribieron; revisar el ledger antes de volver a correr.');
        logError('aplicarMigracionV031: la verificacion posterior no cuadra', {
            filasAntes: filasAntes, escritas: matriz.length, esperado: esperado, medido: despues.filas
        });
    }

    // 6. Registro de la corrida.
    var estadoFinal = _leerEstadoV031();
    var historial = (estadoFinal.historial || []).slice(0);
    historial.push({
        sello: sello, respaldo: respaldo.nombre, filasMigradas: matriz.length,
        filasAntes: filasAntes, filasDespues: despues.filas, verificado: verificado
    });
    if (historial.length > V031_MAX_HISTORIAL) historial = historial.slice(historial.length - V031_MAX_HISTORIAL);
    _guardarEstadoV031({
        completadaEn: new Date().toISOString(),
        ultimasFilasMigradas: matriz.length,
        ultimaVerificacion: { esperado: esperado, medido: despues.filas, ok: verificado },
        historial: historial
    });

    var resumen = 'MIGRACION HISTORICO v03.1 APLICADA\n\n' + hechos.map(function (h) { return '- ' + h; }).join('\n') +
                  '\n\nRevertir restaura el ledger completo desde "' + respaldo.nombre + '".\n\n' + informe;
    logSuccess('aplicarMigracionV031: ' + matriz.length + ' fila(s) migradas. Respaldo: ' + respaldo.nombre);
    _alertaV031('Migracion historico v03.1 - aplicada', resumen);

    return { ok: true, detalle: resumen };
}

/**
 * Restaura el ledger completo desde el respaldo de la ultima corrida.
 *
 * @param {boolean} [yaConLock] true si el llamador ya tiene el lock del documento
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirMigracionV031(yaConLock) {
    return _informarResultadoV031('Revertir migracion historico v03.1 - NO REVERTIDA', _conLockV031(yaConLock, function () {
        var progreso = { muto: false, respaldo: null };
        try {
            return _cuerpoRevertirV031(progreso, yaConLock === true);
        } catch (err) {
            logError('revertirMigracionV031: excepcion no prevista', err);
            if (!progreso.muto) {
                return {
                    ok: false,
                    error: 'Excepcion no prevista antes de restaurar: ' + err.message + '. No se escribio ninguna celda.'
                };
            }
            return {
                ok: false,
                error: 'Excepcion no prevista DESPUES de haber empezado a restaurar: ' + err.message +
                       '. NO SE PUDO CONFIRMAR el estado del ledger; el respaldo "' + progreso.respaldo +
                       '" sigue intacto. Revisar y reintentar.'
            };
        }
    }));
}

/**
 * Cuerpo de revertirMigracionV031(). Ya corre bajo el lock y bajo el catch de ultima instancia.
 */
function _cuerpoRevertirV031(progreso, conducida) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var estado = _leerEstadoV031();
    var cfg = RANGES.REGISTROS;

    if (estado._corrupto) {
        return {
            ok: false,
            error: 'El registro del devtool en DocumentProperties es ilegible, asi que no se sabe cual es el ' +
                   'respaldo valido. NO se restaura nada a ciegas. Fragmento crudo: ' + estado._crudo +
                   '. Buscar las hojas ocultas "' + V031_PREFIJO_RESPALDO + '*" y restaurar a mano.'
        };
    }
    if (!estado.respaldoRegistros) {
        return {
            ok: false,
            error: 'No hay registro de una migracion aplicada (DocumentProperties vacio). Si el respaldo existe, ' +
                   'buscar las hojas ocultas "' + V031_PREFIJO_RESPALDO + '*" y restaurar a mano. No se toco nada.'
        };
    }

    var hojaReg = ss.getSheetByName(SHEETS.REGISTROS);
    var hojaResp = ss.getSheetByName(estado.respaldoRegistros);
    if (!hojaReg || !hojaResp) {
        return {
            ok: false,
            error: 'No se encontro ' + (!hojaReg ? 'la hoja "' + SHEETS.REGISTROS + '"' :
                   'la hoja de respaldo "' + estado.respaldoRegistros + '"') + '. No se toco nada.'
        };
    }
    progreso.respaldo = estado.respaldoRegistros;

    // --- VALIDACION DEL RESPALDO ANTES DE ESCRIBIR UNA SOLA CELDA ---
    var vivo = _medirRegistrosV031(hojaReg);
    var validacion = _validarRespaldoV031(hojaResp, estado.respaldoConteo);
    if (validacion.medida && validacion.medida.filas === 0 && vivo.filas > 0) {
        validacion.problemas.push('el respaldo no tiene una sola fila con dato y el ledger vivo tiene ' +
                                  vivo.filas + ': restaurarlo vaciaria el ledger.');
        validacion.ok = false;
    }
    if (!validacion.ok) {
        var textoFalla = 'REVERSION ABORTADA: el respaldo "' + estado.respaldoRegistros + '" no paso la ' +
                         'validacion y NO SE ESCRIBIO NINGUNA CELDA. Motivos: ' + validacion.problemas.join(' | ') +
                         '. Restaurar desde el historial de versiones de la planilla o a mano.';
        logError('revertirMigracionV031: respaldo invalido, no se restaura', new Error(validacion.problemas.join(' | ')));
        _alertaV031('Revertir migracion historico v03.1 - ABORTADA', textoFalla);
        return { ok: false, error: textoFalla, _avisado: true };
    }
    validacion.avisos.forEach(function (a) { logInfo('revertirMigracionV031: ' + a); });

    var medidaResp = validacion.medida;
    var ui = _uiV031();
    if (ui) {
        var resp = ui.alert(
            'Revertir migracion historico v03.1',
            'Se va a restaurar el ledger "' + SHEETS.REGISTROS + '" desde "' + estado.respaldoRegistros + '":\n' +
            '  respaldo: ' + medidaResp.filas + ' fila(s), suma ' + _montoTextoV031(medidaResp.suma) + '\n' +
            '  ledger hoy: ' + vivo.filas + ' fila(s), suma ' + _montoTextoV031(vivo.suma) + '\n\n' +
            'La diferencia (' + (vivo.filas - medidaResp.filas) + ' fila/s) SE PIERDE, incluidas las cargas ' +
            'que hayas hecho por "Procesar Cargas" despues de la migracion.\n' +
            (estado.revertidaEn ? 'AVISO: esta corrida ya figura revertida el ' + estado.revertidaEn + '.\n' : '') +
            '\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (resp !== ui.Button.YES) return { ok: false, error: 'Cancelada por el usuario. No se escribio nada.' };
    } else if (conducida !== true) {
        return { ok: false, error: 'Sin UI para confirmar. Ejecutar desde el menu Tidetrack Dev. No se escribio nada.' };
    }

    var colIni = columnLetterToIndex(cfg.start);
    var nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    var colFechaRel = columnLetterToIndex(cfg.columns.fecha) - colIni;   // indice de H dentro del bloque

    // Capacidad ANTES de limpiar: si el respaldo no entrara, se aborta con el ledger intacto.
    var filaFinal = Math.max(medidaResp.ultimaFila, cfg.dataRow);
    try {
        asegurarCapacidadFilas(hojaReg, filaFinal);
    } catch (errCap) {
        return {
            ok: false,
            error: 'El respaldo llega hasta la fila ' + medidaResp.ultimaFila + ' y no se pudo preparar el grid: ' +
                   errCap.message + ' No se escribio ninguna celda.'
        };
    }

    var alto = medidaResp.ultimaFila >= cfg.dataRow ? (medidaResp.ultimaFila - cfg.dataRow + 1) : 0;
    var bloque = alto > 0 ? hojaResp.getRange(cfg.dataRow, colIni, alto, nCols).getValues() : [];

    // Si el formato no se copio al respaldar, las fechas volvieron como seriales: se convierten.
    var fechasConvertidas = 0;
    bloque.forEach(function (fila) {
        var v = fila[colFechaRel];
        if (typeof v === 'number' && v > 0) {
            fila[colFechaRel] = _serialADateV031(v);
            fechasConvertidas++;
        }
    });

    progreso.muto = true;

    // Limpiar TODA el area de datos viva (puede tener mas filas que el respaldo) y reescribir.
    var altoVivo = hojaReg.getMaxRows() - cfg.dataRow + 1;
    if (altoVivo > 0) hojaReg.getRange(cfg.dataRow, colIni, altoVivo, nCols).clearContent();
    if (bloque.length) hojaReg.getRange(cfg.dataRow, colIni, bloque.length, nCols).setValues(bloque);
    SpreadsheetApp.flush();

    // Verificacion posterior contra el conteo registrado del respaldo.
    var despues = _medirRegistrosV031(hojaReg);
    var okFilas = (despues.filas === medidaResp.filas);
    var okSuma = Math.abs(despues.suma - medidaResp.suma) <= V031_TOLERANCIA_MONTO;

    var hechos = [];
    hechos.push('restauradas ' + bloque.length + ' fila(s) del rango ' + cfg.start + cfg.dataRow + ':' + cfg.end + '.');
    if (fechasConvertidas) hechos.push('convertidas ' + fechasConvertidas + ' fecha(s) desde serial a fecha real.');
    hechos.push('ledger: ' + despues.filas + ' fila(s) con dato, suma ' + _montoTextoV031(despues.suma) + '.');

    if (!okFilas || !okSuma) {
        var falla = 'La restauracion se ejecuto pero NO SE PUDO CONFIRMAR que el ledger haya quedado igual al ' +
                    'respaldo: se esperaban ' + medidaResp.filas + ' fila(s) y suma ' + _montoTextoV031(medidaResp.suma) +
                    ', y quedaron ' + despues.filas + ' fila(s) y suma ' + _montoTextoV031(despues.suma) +
                    '. El respaldo "' + estado.respaldoRegistros + '" SIGUE INTACTO: revisar a mano antes de ' +
                    'volver a correr nada.';
        logError('revertirMigracionV031: verificacion posterior fallida', {
            esperadoFilas: medidaResp.filas, medidoFilas: despues.filas,
            esperadoSuma: medidaResp.suma, medidoSuma: despues.suma
        });
        _alertaV031('Revertir migracion historico v03.1 - SIN CONFIRMAR', falla);
        return { ok: false, error: falla, _avisado: true };
    }

    _guardarEstadoV031({ revertidaEn: new Date().toISOString(), completadaEn: null });

    var resumen = 'MIGRACION HISTORICO v03.1 REVERTIDA\n\n' + hechos.map(function (h) { return '- ' + h; }).join('\n') +
                  '\n\nEl respaldo "' + estado.respaldoRegistros + '" se conserva (hoja oculta).\n' +
                  'Las altas de cuentas del Plan de Cuentas NO se deshacen: son aditivas y quitarlas podria ' +
                  'romper formulas que ya las referencien. Si sobran, borrarlas a mano.';
    logSuccess('revertirMigracionV031: ledger restaurado desde ' + estado.respaldoRegistros);
    _alertaV031('Revertir migracion historico v03.1', resumen);

    return { ok: true, detalle: resumen };
}
