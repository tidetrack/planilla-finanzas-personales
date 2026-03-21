/**
 * 15_ExchangeRateApi.js
 * Cliente para extracción de cotizaciones históricas.
 * Integración con DolarApi (via argentinadatos) y Frankfurter.
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
            const url = 'https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial';
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
    
    // Fallback: cotización más antigua disponible
    if (cachedArsData.length > 0) {
        return cachedArsData[cachedArsData.length - 1].venta;
    }
    
    return 1000; // Hardcode seguro por falla extrema
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
    
    // Obtener array histórico de ARS (Llamada inicial levanta y purga caché en script)
    fetchArsRate(formatDateISO(startDate)); 
    
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
        
        // ars busca siempre via fetchArsRate que usa la caché en memoria que ya cargamos arriba:
        let rateArs = fetchArsRate(currentStr);
        let rateEur = getFrankRate(currentStr, 'EUR');
        let rateAud = getFrankRate(currentStr, 'AUD');
        let rateUsd = 1.0;

        if (rateArs) arsAppend.push([currDateObj, rateArs]);
        if (rateEur) eurAppend.push([currDateObj, rateEur]);
        if (rateAud) audAppend.push([currDateObj, rateAud]);
        usdAppend.push([currDateObj, rateUsd]);
    }

    // Limpiar celdas previas (I4 a T, saltando los headers en row 3)
    sheet.getRange('I4:J').clearContent();
    sheet.getRange('L4:M').clearContent();
    sheet.getRange('O4:P').clearContent();
    sheet.getRange('R4:S').clearContent();

    // Escribir los arrays masivamente
    if (arsAppend.length > 0) appendMassive('TC_ARS', arsAppend, 4);
    if (usdAppend.length > 0) appendMassive('TC_USD', usdAppend, 4);
    if (audAppend.length > 0) appendMassive('TC_AUD', audAppend, 4);
    if (eurAppend.length > 0) appendMassive('TC_EUR', eurAppend, 4);

    ss.toast(`Se generaron ${arsAppend.length} registros históricos por divisa.`, '¡Carga Exitosa!', 6);
}
