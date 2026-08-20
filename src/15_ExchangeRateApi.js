/**
 * 15_ExchangeRateApi.js
 * Cliente para extracción de cotizaciones históricas.
 * Integración con DolarApi (via argentinadatos) y Frankfurter.
 *
 * [CONCEPTO DE NEGOCIO]
 * Motor de cotizaciones del sistema: provee los tipos de cambio historicos de las cuatro
 * monedas (ARS, USD, AUD, EUR) al pipeline de cargas y a las custom functions de celda.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * ADR-004: las cotizaciones viven congeladas en la hoja "Tipos de Cambio". forzarCargaHistorica
 * reconstruye ese data lake completo bajo contrato TODO-O-NADA: antes de limpiar una sola celda
 * verifica el CONTENIDO (las cuatro monedas tienen que traer cotizaciones) y la capacidad fisica
 * del grid. Si algo falta, aborta con el detalle por moneda y la hoja queda intacta.
 * NINGUNA coordenada de la hoja se escribe aca: todas salen de RANGES.TC_* (regla SSOT), asi
 * que el modulo sobrevivio sin cambios al swap v0.11 (bloques C:D / F:G / I:J / L:M, titulos
 * fila 6, header fila 7, datos desde la fila 8). Por eso no se repite la geometria en esta
 * cabecera: la unica fuente es 00_Config.js.
 *
 * REGLA ESTRICTA 9 (nunca se silencia un fallback de tipo de cambio), implementada en tres
 * niveles dentro de fetchArsRate: fecha invalida o futura -> lanza; cotizacion de otra fecha ->
 * queda registrada (una linea por cotizacion ancla + resumen de lote via resumirFallbacksArs);
 * serie vacia -> lanza. Nunca se devuelve un numero inventado.
 *
 * @see 00_Config.js (RANGES.TC_*)
 * @see 03_SheetManager.js (asegurarCapacidadFilas)
 *
 * @version 0.11.1
 * @since 0.1.0
 * @lastModified 2026-08-18
 */

// Caché en memoria durante la ejecución del script para no pedir el JSON gigante múltiple veces
let cachedArsData = null;

// ============================================
// TRAZA DE FALLBACKS DE COTIZACION (Regla Estricta 9)
// ============================================

// [FUNDAMENTO TEORICO / ADMINISTRATIVO]
// Un TC que no corresponde a la fecha pedida se CONGELA en el registro y en el Data Lake: es
// irreversible sin recalcular. La Regla Estricta 9 lo cubre entero -- ningun fallback de la
// API de tipo de cambio se silencia --, pero el fallback "cotizacion mas reciente disponible"
// (la fecha pedida es posterior al ultimo dato de la serie, o cae en fin de semana/feriado)
// era MUDO: devolvia el valor sin emitir un solo log. Verificado el 2026-08-18:
// fetchArsRate('2026-12-31') devolvia 1510 -- la cotizacion del 17 -- sin dejar rastro.
//
// decision Franco 2026-08-18: se loguea UNA VEZ POR COTIZACION ANCLA, no una vez por llamada.
// El ruido importa: forzarCargaHistorica pide dia por dia desde 2024-01-01 y procesarCargas
// puede pedir cientos de fechas en un lote; un log por llamada serian ~600 lineas identicas y
// el log deja de leerse (un log que nadie lee es tan mudo como no loguearlo).
// La clave del resumen es la fecha DEVUELTA, no la pedida, y eso lo acota solo: todas las
// fechas posteriores al fin de la serie caen sobre la MISMA ancla, asi que ese caso emite
// exactamente una linea por corrida por mas filas que traiga el lote. La primera vez que
// aparece un ancla se loguea con el detalle completo (que fecha se pidio, cual se devolvio,
// con que valor); las repeticiones solo suman al contador y salen en el resumen final con el
// rango de fechas que abarcaron. Ninguna corrida con fallback queda sin al menos una linea.
var _arsFallbackResumen = null;

/** Reinicia el acumulador de fallbacks. Se llama al levantar la serie de la API. */
function _resetResumenFallbackArs() {
    _arsFallbackResumen = Object.create(null);
}

/**
 * Anota que se devolvio una cotizacion que NO es la de la fecha pedida.
 *
 * @param {string} tipo 'posterior' (ancla anterior a la fecha pedida) o 'anterior' (serie que arranca despues)
 * @param {string} fechaPedida fecha solicitada, 'YYYY-MM-DD'
 * @param {string} fechaDevuelta fecha de la cotizacion efectivamente devuelta, 'YYYY-MM-DD'
 * @param {number} valor cotizacion devuelta
 */
function _registrarFallbackArs(tipo, fechaPedida, fechaDevuelta, valor) {
    if (!_arsFallbackResumen) _resetResumenFallbackArs();

    var entrada = _arsFallbackResumen[fechaDevuelta];
    if (!entrada) {
        entrada = {
            tipo: tipo, valor: valor, veces: 0,
            primeraPedida: fechaPedida, ultimaPedida: fechaPedida,
            // decision Franco 2026-08-18: se guarda el SET de fechas pedidas, no solo el rango.
            // 'veces' cuenta resoluciones de la API (una por fecha distinta que no estaba en
            // cache), no filas del lote: un llamador que quiera informar filas afectadas
            // necesita saber QUE fechas cayeron en fallback para cruzarlas contra su lote.
            pedidas: Object.create(null)
        };
        _arsFallbackResumen[fechaDevuelta] = entrada;
        // Primera aparicion de esta ancla: detalle completo, siempre, sin excepcion.
        logInfo(
            'fetchArsRate: FALLBACK -- se pidio ' + fechaPedida + ' y se devuelve la cotizacion del ' +
            fechaDevuelta + ' (' + valor + '). Motivo: ' +
            (tipo === 'posterior'
                ? 'la serie de la API no llega a esa fecha (fin de semana, feriado o fecha posterior al ultimo dato publicado).'
                : 'la serie de la API arranca despues de esa fecha.') +
            ' Este TC se congela tal cual en el registro y en el Data Lake.'
        );
    }
    entrada.veces++;
    entrada.pedidas[fechaPedida] = true;
    if (fechaPedida < entrada.primeraPedida) entrada.primeraPedida = fechaPedida;
    if (fechaPedida > entrada.ultimaPedida) entrada.ultimaPedida = fechaPedida;
}

/**
 * Cierra la traza de fallbacks de la corrida: loguea el resumen y reinicia el acumulador.
 *
 * La llaman los procesos por LOTE al terminar (procesarCargas, forzarCargaHistorica) para que
 * el operador vea de un vistazo cuantas filas se llevaron un TC que no es el de su fecha.
 * Es seguro llamarla siempre: sin fallbacks no escribe nada.
 *
 * `total` cuenta RESOLUCIONES DE COTIZACION (una por fecha distinta que hubo que ir a buscar),
 * no filas de ningun lote: cinco movimientos de la misma fecha son una sola resolucion. El que
 * quiera contar filas afectadas cruza su lote contra `fechasPedidas`.
 *
 * @returns {{total: number, anclas: Array, fechasPedidas: string[]}} resumen para el llamador
 */
function resumirFallbacksArs() {
    var resumen = { total: 0, anclas: [], fechasPedidas: [] };
    if (!_arsFallbackResumen) return resumen;

    var vistas = Object.create(null);
    for (var fechaDevuelta in _arsFallbackResumen) {
        if (!Object.prototype.hasOwnProperty.call(_arsFallbackResumen, fechaDevuelta)) continue;
        var e = _arsFallbackResumen[fechaDevuelta];
        resumen.total += e.veces;
        resumen.anclas.push({
            fechaDevuelta: fechaDevuelta, tipo: e.tipo, valor: e.valor, veces: e.veces,
            primeraPedida: e.primeraPedida, ultimaPedida: e.ultimaPedida
        });
        for (var pedida in e.pedidas) {
            if (!Object.prototype.hasOwnProperty.call(e.pedidas, pedida)) continue;
            if (!vistas[pedida]) { vistas[pedida] = true; resumen.fechasPedidas.push(pedida); }
        }
    }
    resumen.fechasPedidas.sort();

    if (resumen.total > 0) {
        var detalle = resumen.anclas.map(function (a) {
            return a.veces + ' pedido(s) entre ' + a.primeraPedida + ' y ' + a.ultimaPedida +
                   ' resueltos con la cotizacion del ' + a.fechaDevuelta + ' (' + a.valor + ')';
        }).join(' | ');
        logInfo('fetchArsRate: RESUMEN DE FALLBACKS de esta corrida -> ' + detalle +
                '. Total de cotizaciones devueltas fuera de su fecha: ' + resumen.total + '.');
    }

    _resetResumenFallbackArs();
    return resumen;
}

/**
 * Obtiene la cotización del ARS Oficial (venta) para una fecha (formato YYYY-MM-DD).
 * Utiliza un caché en memoria del array histórico si procesa un lote.
 *
 * Nunca devuelve un numero inventado y nunca devuelve en silencio una cotizacion que no sea
 * la de la fecha pedida: o es exacta, o queda logueada, o lanza (Regla Estricta 9).
 */
function fetchArsRate(dateString) {
    // decision Franco 2026-08-18: la fecha se valida ANTES de la llamada a la API.
    // Un dateString con formato invalido producia `new Date(NaN)`, contra el que TODA
    // comparacion da false: el bucle no matcheaba nunca y la funcion caia al fallback de la
    // cotizacion mas antigua, devolviendo la de 2024-01-01 como si fuera la pedida. Basura
    // adentro, cotizacion plausible afuera: el peor de los fallos posibles en este motor.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString))) {
        logError('fetchArsRate: fecha con formato invalido', { fechaPedida: String(dateString) });
        throw new Error(
            'Fecha invalida para cotizacion ARS: "' + dateString + '". Se espera YYYY-MM-DD. ' +
            'No se devuelve ningun tipo de cambio.'
        );
    }

    // decision Franco 2026-08-18: una fecha FUTURA es un error, no un fallback.
    // Antes devolvia la ultima cotizacion publicada como si fuera la del dia pedido: el TC de
    // un dia que todavia no ocurrio no existe, y congelarlo en un registro fechado adelante
    // es inventar un dato con apariencia de dato. El caso es real (un tipeo en la columna
    // Fecha de Cargas alcanza) y hasta hoy pasaba entero y sin rastro.
    var hoyIso = formatDateISO(new Date());
    if (hoyIso && dateString > hoyIso) {
        logError('fetchArsRate: se pidio una cotizacion para una fecha futura', {
            fechaPedida: dateString,
            hoy: hoyIso
        });
        throw new Error(
            'No hay cotizacion ARS para ' + dateString + ': es una fecha futura (hoy es ' + hoyIso +
            '). Revisar la fecha del movimiento. No se escribe ningun tipo de cambio.'
        );
    }

    if (!cachedArsData) {
        try {
            const url = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial/';
            const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

            if (response.getResponseCode() !== 200) {
                throw new Error("HTTP " + response.getResponseCode());
            }

            cachedArsData = JSON.parse(response.getContentText());
            // Ordenar de más reciente a más antigua para búsqueda
            cachedArsData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            // Serie recien levantada = corrida nueva: la traza de fallbacks arranca limpia.
            _resetResumenFallbackArs();
        } catch (e) {
            logError('Error fetching ARS rates', e);
            throw new Error('No se pudo conectar con la API de Dólar.' + e.toString());
        }
    }

    const targetDate = new Date(dateString + 'T12:00:00Z');

    for (let record of cachedArsData) {
        if (new Date(record.fecha + 'T12:00:00Z') <= targetDate) {
            // Regla Estricta 9: si la cotizacion devuelta no es la de la fecha pedida, se
            // deja rastro. Silencioso SOLO cuando la fecha coincide exactamente.
            if (record.fecha !== dateString) {
                _registrarFallbackArs('posterior', dateString, record.fecha, record.venta);
            }
            return record.venta;
        }
    }

    // Fallback: cotización más antigua disponible.
    // Regla Estricta 9: NUNCA se silencia un fallback de la API de tipo de cambio.
    // Este caso es real y frecuente al pedir fechas anteriores al inicio de la serie.
    if (cachedArsData.length > 0) {
        const masAntigua = cachedArsData[cachedArsData.length - 1];
        _registrarFallbackArs('anterior', dateString, masAntigua.fecha, masAntigua.venta);
        return masAntigua.venta;
    }

    // decision Franco 2026-08-13: el hardcode 1000 dejo de devolverse como si fuera una
    // cotizacion. La API respondio 200 pero con una serie vacia: no hay dato, y escribir un
    // numero inventado contamina el Data Lake Y los TC que se congelan en cada registro
    // (irreversible sin recalcular). Fallar ruidosamente es preferible: el llamador aborta
    // antes de escribir, en vez de persistir 1000 como verdad.
    logError('fetchArsRate: la API de dolar respondio sin ninguna cotizacion utilizable', {
        fechaPedida: dateString,
        registrosRecibidos: 0
    });
    throw new Error(
        'No hay cotizacion ARS disponible para ' + dateString +
        ': la API respondio sin datos. No se escribe ningun tipo de cambio.'
    );
}

/**
 * Obtiene las cotizaciones cruzadas para EUR y AUD usando Frankfurter.
 */
function fetchInternationalRates(dateString) {
    try {
        // La API Frankfurter usa la fecha YYYY-MM-DD. Si es fin de semana, devuelve el último día hábil automáticamente.
        const url = `https://api.frankfurter.app/${dateString}?from=USD&to=EUR,AUD`;
        const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        
        if (response.getResponseCode() !== 200) {
            throw new Error("HTTP " + response.getResponseCode());
        }

        const data = JSON.parse(response.getContentText());
        return {
            EUR: data.rates.EUR, // Ej: 0.95 (1 USD = 0.95 EUR)
            AUD: data.rates.AUD  // Ej: 1.55 (1 USD = 1.55 AUD)
        };
    } catch (e) {
        logError(`Error fetching Frankfurter rates for date: ${dateString}`, e);
        throw new Error('No se pudo obtener cotizaciones internacionales: ' + e.toString());
    }
}

/**
 * Herramienta [Dev] para forzar la carga del histórico desde el 01/01/2024 hasta hoy.
 * Sobreescribe o llena los datos en la hoja Tipos de Cambio para las 4 monedas.
 */
function forzarCargaHistorica() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert('Forzar Carga Histórica', '¿Estás seguro de que querés cargar todos los tipos de cambio desde el 01/01/2024 hasta hoy? Esto demorará unos segundos y reescribirá el caché.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.TIPOS_CAMBIO);

    // Fechas de rango
    const startDate = new Date('2024-01-01T12:00:00Z');
    const endDate = new Date();
    
    // Obtener array histórico de ARS (llamada inicial levanta y purga caché en script).
    // Si la API falla se informa al usuario en vez de romper con un error crudo; el fallo
    // queda logueado (nunca se silencia un problema de la API de tipo de cambio).
    try {
        fetchArsRate(formatDateISO(startDate));
    } catch (arsErr) {
        logError('forzarCargaHistorica: fallo al contactar la API ARS', arsErr);
        ui.alert(
            'Error al contactar la API ARS',
            'No se pudo obtener el historial de cotizaciones del dolar desde argentinadatos.com.\n\n' +
            'Detalle: ' + arsErr.message + '\n\n' +
            'Verifica la conexion a internet y volve a intentarlo.',
            ui.ButtonSet.OK
        );
        return;
    }

    // Configurar Batch Request a Frankfurter
    const startStr = formatDateISO(startDate);
    const endStr = formatDateISO(endDate);
    const frankUrl = `https://api.frankfurter.app/${startStr}..${endStr}?from=USD&to=EUR,AUD`;
    let frankData = {};
    try {
        const res = UrlFetchApp.fetch(frankUrl, { muteHttpExceptions: true });
        if (res.getResponseCode() === 200) {
            frankData = JSON.parse(res.getContentText()).rates;
        } else {
            throw new Error("Frankfurter (Historical) HTTP " + res.getResponseCode());
        }
    } catch (e) {
        // Regla estricta 9: un fallo de la API de tipo de cambio nunca se silencia. Antes solo
        // se avisaba por UI y no quedaba rastro en los logs de ejecucion.
        logError('forzarCargaHistorica: fallo al contactar la API Frankfurter (historico)', {
            url: frankUrl,
            detalle: e.message
        });
        ui.alert('Error contactando a Frankfurter API: ' + e.message);
        return;
    }

    // Helper para buscar Frankfurter con fallback al día anterior (fines de semana)
    function getFrankRate(dateStr, currency) {
        let checkDate = new Date(dateStr + "T12:00:00Z");
        for (let i = 0; i < 7; i++) {
            let dStr = formatDateISO(checkDate);
            if (frankData[dStr] && frankData[dStr][currency]) {
                return frankData[dStr][currency];
            }
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return null;
    }

    let arsAppend = [];
    let usdAppend = [];
    let audAppend = [];
    let eurAppend = [];

    // Iterar día por día
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        let currentStr = formatDateISO(d);
        let currDateObj = new Date(d);
        
        let valUsdInArs = fetchArsRate(currentStr);
        let valEurInUsd = getFrankRate(currentStr, 'EUR');
        let valAudInUsd = getFrankRate(currentStr, 'AUD');

        if (valUsdInArs) {
            usdAppend.push([currDateObj, valUsdInArs]);
            arsAppend.push([currDateObj, 1.0]); // ARS base

            if (valEurInUsd) eurAppend.push([currDateObj, valUsdInArs / valEurInUsd]);
            if (valAudInUsd) audAppend.push([currDateObj, valUsdInArs / valAudInUsd]);
        }
    }

    // Los cuatro bloques del data lake, en un solo lugar: la misma lista gobierna la
    // validacion, la limpieza, la escritura y el reporte. Que limpiar y que escribir no
    // puedan volver a discrepar es justamente el punto (ver decision de abajo).
    const bloquesTc = [
        { moneda: 'ARS', tabla: 'TC_ARS', filas: arsAppend },
        { moneda: 'USD', tabla: 'TC_USD', filas: usdAppend },
        { moneda: 'AUD', tabla: 'TC_AUD', filas: audAppend },
        { moneda: 'EUR', tabla: 'TC_EUR', filas: eurAppend }
    ];
    const detallePorMoneda = bloquesTc
        .map(function (b) { return b.moneda + ': ' + b.filas.length; })
        .join(' | ');

    // decision Franco 2026-08-13: contrato TODO-O-NADA verificado por CONTENIDO, no solo por
    // capacidad. Si CUALQUIERA de los cuatro bloques viene sin cotizaciones se aborta ANTES del
    // primer clearContent y la hoja queda intacta.
    // Motivo (cicatriz 5 del arnes: un guard que reporta exito sin haber hecho el trabajo es
    // peor que no tener guard): la version anterior limpiaba los cuatro bloques y despues
    // escribia solo los que tenian filas, con un unico chequeo Math.max(...) === 0 que solo
    // detectaba la falla de las cuatro monedas a la vez. ARS y USD se pushean siempre juntas,
    // asi que el unico vaciado parcial posible -- Frankfurter devolviendo 200 sin rates utiles
    // (contrato cambiado, rango truncado, dias no cubiertos) -- era justamente el que no se
    // detectaba: AUD y EUR quedaban en cero y el toast cantaba exito igual.
    // Se aborta en vez de reescribir solo lo que llego porque las cuatro series tienen que
    // cubrir el mismo rango de fechas: los TC se congelan por registro y una serie con 2 anios
    // y otra con 29 dias es un data lake corrupto, mas caro de detectar que una carga fallida.
    // decision Franco 2026-08-13: el guard verifica COBERTURA PAREJA, no solo "tiene alguna
    // fila". Un bloque vacio es el caso extremo; el peligroso es el intermedio -- Frankfurter
    // devolviendo 200 con el rango truncado a unos pocos dias -- que pasaba el chequeo de
    // "length === 0", limpiaba los cuatro bloques y dejaba AUD/EUR con 2 cotizaciones donde
    // habia 29, cantando exito. Dos condiciones, ambas previas al primer clearContent:
    //   1. RETROCESO: ningun bloque puede traer menos filas de las que la hoja ya tiene.
    //   2. DISPARIDAD: los cuatro bloques tienen que cubrir el mismo rango; se tolera un
    //      margen chico porque las fuentes difieren en dias habiles (ARS es diaria,
    //      Frankfurter no cotiza fines de semana ni feriados).
    const TOLERANCIA_COBERTURA = 0.9;
    const filasMaximas = bloquesTc.reduce(function (max, b) { return Math.max(max, b.filas.length); }, 0);
    const sinDatos = bloquesTc.filter(function (b) {
        if (b.filas.length === 0) return true;
        if (b.filas.length < filasMaximas * TOLERANCIA_COBERTURA) return true;
        const cfg = RANGES[b.tabla];
        const colInicio = columnLetterToIndex(cfg.start);
        const filasGrid = sheet.getMaxRows() - cfg.dataRow + 1;
        if (filasGrid <= 0) return false;
        const existentes = sheet.getRange(cfg.dataRow, colInicio, filasGrid, 1)
            .getValues()
            .filter(function (fila) { return fila[0] !== '' && fila[0] !== null; }).length;
        return b.filas.length < existentes;
    });
    if (sinDatos.length > 0) {
        const monedasSinDatos = sinDatos.map(function (b) { return b.moneda; }).join(', ');
        // Nunca se silencia una degradacion de la API de tipo de cambio: queda en el log
        // con el detalle por moneda, ademas del aviso al usuario.
        logError(
            'forzarCargaHistorica: sin cotizaciones para ' + monedasSinDatos +
            '. La hoja NO fue modificada.',
            { detallePorMoneda: detallePorMoneda, rango: startStr + '..' + endStr }
        );
        ui.alert(
            'Carga historica incompleta',
            'Cobertura insuficiente o despareja en: ' + monedasSinDatos + '.\n\n' +
            'Filas generadas por moneda -> ' + detallePorMoneda + '\n\n' +
            'No se modifico ninguna celda de la hoja de tipos de cambio: entra el data lake ' +
            'completo o no entra nada. Se aborta tanto si una moneda no trajo nada como si ' +
            'trajo menos de lo que la hoja ya tenia o mucho menos que las demas. Revisa la ' +
            'disponibilidad de las APIs y volve a intentarlo.',
            ui.ButtonSet.OK
        );
        return;
    }

    // CAPACIDAD ANTES DE TOCAR NADA.
    // La hoja quedo con 41 filas fisicas tras la migracion y este proceso escribe ~830 por
    // bloque. Si se limpiara primero y el grid reventara despues, se perderia el data lake
    // entero. Se amplia (o se aborta con error explicito) ANTES del clearContent, con el
    // bloque mas largo como referencia: los cuatro bloques comparten la misma hoja y fila.
    const dataRowTc = RANGES.TC_ARS.dataRow;
    const filasNecesarias = bloquesTc.reduce(function (max, b) {
        return Math.max(max, b.filas.length);
    }, 0);
    try {
        asegurarCapacidadFilas(sheet, dataRowTc + filasNecesarias - 1);
    } catch (capErr) {
        logError('forzarCargaHistorica: capacidad insuficiente en la hoja de tipos de cambio', capErr);
        ui.alert('No se pudo preparar la hoja', capErr.message, ui.ButtonSet.OK);
        return;
    }

    // Limpiar y reescribir bloque por bloque, sin tocar titulos (fila 5) ni encabezados (fila 6).
    // Las coordenadas salen de RANGES (regla SSOT), no de literales A1: antes el clearContent
    // usaba 'B7:C'/'E7:F'/'H7:I'/'K7:L' hardcodeados mientras la escritura usaba RANGES, de modo
    // que un cambio de layout podia dejar limpieza y escritura apuntando a columnas distintas.
    // El clearContent de cada bloque va inmediatamente antes de SU escritura: ningun bloque
    // queda vacio esperando datos que otro paso deberia traer.
    bloquesTc.forEach(function (b) {
        const cfg = RANGES[b.tabla];
        const colInicio = columnLetterToIndex(cfg.start);
        const numCols = columnLetterToIndex(cfg.end) - colInicio + 1;
        const filasGrid = sheet.getMaxRows() - cfg.dataRow + 1;
        if (filasGrid > 0) {
            sheet.getRange(cfg.dataRow, colInicio, filasGrid, numCols).clearContent();
        }
        appendMassive(b.tabla, b.filas, cfg.dataRow);
    });

    // Reporte POR MONEDA con las cantidades reales escritas. El total unico anterior
    // ("N registros por divisa", tomado de arsAppend) daba por supuesto que las cuatro series
    // tenian el mismo largo, que es exactamente lo que fallaba sin avisar.
    logSuccess('forzarCargaHistorica: cotizaciones escritas -> ' + detallePorMoneda);

    // Cierre de la traza de fallbacks del lote (Regla Estricta 9). Este proceso pide dia por
    // dia desde 2024-01-01: los dias sin cotizacion publicada (fines de semana, feriados y la
    // cola posterior al ultimo dato de la serie) se resolvieron con la cotizacion de otra
    // fecha, y eso tiene que quedar contado en el log de la corrida, no solo en la primera
    // aparicion de cada ancla.
    const fallbacks = resumirFallbacksArs();
    const avisoFallback = fallbacks.total > 0
        ? '\n\nATENCION: ' + fallbacks.total + ' dia(s) se resolvieron con la cotizacion de otra fecha ' +
          '(dias sin publicacion). Detalle por fecha en el log de ejecucion.'
        : '';

    ss.toast('Cotizaciones escritas -> ' + detallePorMoneda, 'Carga historica completa', 8);
    if (fallbacks.total > 0) {
        ui.alert('Carga historica completa (con fallbacks)',
                 'Cotizaciones escritas -> ' + detallePorMoneda + avisoFallback, ui.ButtonSet.OK);
    }
}

// ============================================
// CUSTOM FORMULAS (Funciones Personalizadas para celdas)
// ============================================

/**
 * Devuelve la cotización Oficial del Dólar Estadounidense (Venta) de hoy.
 * Úsala en cualquier celda escribiendo: =TIDETRACK_USD()
 * @customfunction
 */
function TIDETRACK_USD() {
    const today = formatDateISO(new Date());
    return fetchArsRate(today);
}

/**
 * Devuelve la cotización del Euro triangulada a ARS de hoy.
 * Úsala en cualquier celda escribiendo: =TIDETRACK_EUR()
 * @customfunction
 */
function TIDETRACK_EUR() {
    const today = formatDateISO(new Date());
    const ars = fetchArsRate(today);
    const intl = fetchInternationalRates(today);
    return ars / intl.EUR;
}

/**
 * Devuelve la cotización del Dólar Australiano triangulada a ARS de hoy.
 * Úsala en cualquier celda escribiendo: =TIDETRACK_AUD()
 * @customfunction
 */
function TIDETRACK_AUD() {
    const today = formatDateISO(new Date());
    const ars = fetchArsRate(today);
    const intl = fetchInternationalRates(today);
    return ars / intl.AUD;
}

