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
