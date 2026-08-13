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
 * ADR-004: las cotizaciones viven congeladas en la hoja "Tipos de cambio" (layout migrado:
 * bloques B:C / E:F / H:I / K:L, header fila 6, datos desde la fila 7). forzarCargaHistorica
 * reconstruye ese data lake completo bajo contrato TODO-O-NADA: antes de limpiar una sola celda
 * verifica el CONTENIDO (las cuatro monedas tienen que traer cotizaciones) y la capacidad fisica
 * del grid (la hoja quedo con apenas 6 filas libres tras la migracion). Si algo falta, aborta con
 * el detalle por moneda y la hoja queda intacta.
 *
 * @see 00_Config.js (RANGES.TC_*)
 * @see 03_SheetManager.js (asegurarCapacidadFilas)
 *
 * @version 0.9.5
 * @since 0.1.0
 * @lastModified 2026-08-13
 */

// Caché en memoria durante la ejecución del script para no pedir el JSON gigante múltiple veces
let cachedArsData = null;

/**
 * Obtiene la cotización del ARS Oficial (venta) para una fecha (formato YYYY-MM-DD).
 * Utiliza un caché en memoria del array histórico si procesa un lote.
 */
function fetchArsRate(dateString) {
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
        } catch (e) {
            logError('Error fetching ARS rates', e);
            throw new Error('No se pudo conectar con la API de Dólar.' + e.toString());
        }
    }

    const targetDate = new Date(dateString + 'T12:00:00Z');
    
    for (let record of cachedArsData) {
        if (new Date(record.fecha + 'T12:00:00Z') <= targetDate) {
            return record.venta;
        }
    }
    
    // Fallback: cotización más antigua disponible.
    // Regla Estricta 9: NUNCA se silencia un fallback de la API de tipo de cambio.
    // Este caso es real y frecuente al pedir fechas anteriores al inicio de la serie.
    if (cachedArsData.length > 0) {
        const masAntigua = cachedArsData[cachedArsData.length - 1];
        logInfo(
            'fetchArsRate: fallback a la cotizacion mas antigua disponible (' + masAntigua.fecha +
            ') para la fecha pedida ' + dateString + '. La serie de la API no cubre esa fecha.'
        );
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
    ss.toast('Cotizaciones escritas -> ' + detallePorMoneda, 'Carga historica completa', 8);
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

