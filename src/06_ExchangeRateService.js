/**
 * 06_ExchangeRateService.js
 * Servicio de tipos de cambio con integración a API externa
 * Gestión de DB_TIPOS_CAMBIO y cálculo de conversiones
 * 
 * @version 0.2.0
 * @since 0.2.0
 * @lastModified 2026-01-17
 */

// ============================================
// OPERACIONES DE LECTURA
// ============================================

/**
 * Obtiene todos los tipos de cambio
 * @param {Object} filters Filtros opcionales {fuente, status, fecha}
 * @returns {Array<Object>} Array de tipos de cambio
 */
function getAllExchangeRates(filters = {}) {
    const data = getTableData('TIPOS_CAMBIO');
    const colIndexes = getColumnIndexes('TIPOS_CAMBIO');

    let rates = data.map(row => ({
        fx_id: row[colIndexes.fx_id],
        fecha: row[colIndexes.fecha],
        base_moneda_id: row[colIndexes.base_moneda_id],
        quote_moneda_id: row[colIndexes.quote_moneda_id],
        tc: row[colIndexes.tc],
        fuente: row[colIndexes.fuente],
        provider: row[colIndexes.provider],
        api_endpoint: row[colIndexes.api_endpoint],
        request_params: row[colIndexes.request_params],
        fetched_at: row[colIndexes.fetched_at],
        status: row[colIndexes.status],
        raw_payload: row[colIndexes.raw_payload]
    }));

    // Aplicar filtros
    if (filters.fuente) {
        rates = rates.filter(r => r.fuente === filters.fuente);
    }
    if (filters.status) {
        rates = rates.filter(r => r.status === filters.status);
    }
    if (filters.fecha) {
        rates = rates.filter(r => formatDate(r.fecha, 'yyyy-MM-dd') === formatDate(filters.fecha, 'yyyy-MM-dd'));
    }

    return rates;
}

/**
 * Obtiene un tipo de cambio por ID
 * @param {string} fx_id ID del tipo de cambio
 * @returns {Object|null} Tipo de cambio o null
 */
function getExchangeRateById(fx_id) {
    const result = findById('TIPOS_CAMBIO', fx_id, 0);

    if (!result) {
        return null;
    }

    const colIndexes = getColumnIndexes('TIPOS_CAMBIO');
    const row = result.rowData;

    return {
        fx_id: row[colIndexes.fx_id],
        fecha: row[colIndexes.fecha],
        base_moneda_id: row[colIndexes.base_moneda_id],
        quote_moneda_id: row[colIndexes.quote_moneda_id],
        tc: row[colIndexes.tc],
        fuente: row[colIndexes.fuente],
        provider: row[colIndexes.provider],
        api_endpoint: row[colIndexes.api_endpoint],
        request_params: row[colIndexes.request_params],
        fetched_at: row[colIndexes.fetched_at],
        status: row[colIndexes.status],
        raw_payload: row[colIndexes.raw_payload]
    };
}

/**
 * Obtiene el tipo de cambio más reciente para un par
 * @param {string} base Moneda base (ej: 'ARS')
 * @param {string} quote Moneda cotizada (ej: 'USD')
 * @param {string} fuente Fuente preferida (opcional, usa config si no se provee)
 * @param {Date} fecha Fecha máxima (opcional, default hoy)
 * @returns {Object|null} {fx_id, tc, fecha, fuente, raw_payload, request_params} o null si no hay
 */
function getLatestRate(base, quote, fuente = null, fecha = null) {
    // Si no se provee fuente, usar la configurada
    if (!fuente) {
        fuente = getFuentePreferida();
    }

    // Si no se provee fecha, usar hoy
    if (!fecha) {
        fecha = getCurrentDate();
    }

    // Obtener todos los rates del par con la fuente
    const allRates = getAllExchangeRates({ fuente, status: 'ok' });

    // Filtrar por par
    const pairRates = allRates.filter(r =>
        r.base_moneda_id === base && r.quote_moneda_id === quote
    );

    if (pairRates.length === 0) {
        return null;
    }

    // Ordenar por fecha descendente y tomar el más reciente
    pairRates.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const latest = pairRates[0];

    return {
        fx_id: latest.fx_id,
        tc: latest.tc,
        fecha: latest.fecha,
        fuente: latest.fuente,
        raw_payload: latest.raw_payload,      // ← AGREGADO para extraer compra/venta
        request_params: latest.request_params // ← AGREGADO para fallback
    };
}

// ============================================
// OPERACIONES DE ESCRITURA
// ============================================

/**
 * Crea un tipo de cambio manualmente
 * @param {Object} fx Objeto de tipo de cambio
 * @returns {Object} Tipo de cambio creado
 */
function createExchangeRate(fx) {
    // Completar campos si faltan
    if (!fx.fx_id) {
        fx.fx_id = generateNextId('TIPOS_CAMBIO', 'FX', 5);
    }
    if (!fx.fecha) {
        fx.fecha = getCurrentDate();
    }
    if (!fx.fetched_at) {
        fx.fetched_at = getCurrentTimestamp();
    }
    if (!fx.status) {
        fx.status = 'ok';
    }

    // Validar
    validateExchangeRate(fx);

    // Convertir a array
    const rowData = [
        fx.fx_id,
        fx.fecha,
        fx.base_moneda_id,
        fx.quote_moneda_id,
        fx.tc,
        fx.fuente,
        fx.provider || '',
        fx.api_endpoint || '',
        fx.request_params || '',
        fx.fetched_at,
        fx.status,
        fx.raw_payload || ''
    ];

    // Insertar
    appendRow('TIPOS_CAMBIO', rowData);

    logSuccess(
        `Tipo de cambio creado: ${fx.base_moneda_id}/${fx.quote_moneda_id} = ${fx.tc} ` +
        `(fuente: ${fx.fuente}, fx_id: ${fx.fx_id})`
    );

    return fx;
}

/**
 * Elimina un tipo de cambio (usar con precaución)
 * @param {string} fx_id ID del tipo de cambio
 */
function deleteExchangeRate(fx_id) {
    const result = findById('TIPOS_CAMBIO', fx_id, 0);

    if (!result) {
        throw new Error(`Tipo de cambio no encontrado: ${fx_id}`);
    }

    // Advertencia
    logInfo(`ADVERTENCIA: Verificar que ${fx_id} no tenga referencias en transacciones`);

    deleteRow('TIPOS_CAMBIO', result.rowIndex);

    logSuccess(`Tipo de cambio eliminado: ${fx_id}`);
}

// ============================================
// INTEGRACIÓN CON API EXTERNA
// ============================================

/**
 * Obtiene tipos de cambio desde API externa
 * @param {string} baseCurrency Moneda base para la consulta (default: 'USD')
 * @param {string} fuente Etiqueta de fuente (default: 'oficial')
 * @returns {number} Cantidad de rates guardados
 */
function fetchExchangeRatesFromAPI(baseCurrency = 'USD', fuente = 'oficial') {
    const url = `${API_CONFIG.exchangeRate.baseUrl}${baseCurrency}`;

    logInfo(`Fetching exchange rates desde API: ${url}`);

    try {
        // Hacer request
        const response = UrlFetchApp.fetch(url, {
            method: 'GET',
            muteHttpExceptions: true,
            timeout: API_CONFIG.exchangeRate.timeout
        });

        const responseCode = response.getResponseCode();

        if (responseCode !== 200) {
            throw new Error(`API retornó código ${responseCode}`);
        }

        // Parsear JSON
        const rawPayload = response.getContentText();
        const data = JSON.parse(rawPayload);

        logInfo(`API response recibido: ${Object.keys(data.rates).length} rates`);

        // Guardar cada rate
        let guardados = 0;
        const fetched_at = getCurrentTimestamp();
        const fecha = data.date || formatDate(getCurrentDate(), 'yyyy-MM-dd');

        // Para cada par en rates
        Object.keys(data.rates).forEach(quoteCurrency => {
            // Verificar si la moneda está en nuestro sistema hardcodeado
            const moneda = CURRENCIES[quoteCurrency];
            
            if (!moneda) {
                // No es un error, simplemente no tenemos esa moneda configurada
                return;
            }

            // Obtener la moneda base
            const baseMoneda = CURRENCIES[baseCurrency];
            if (!baseMoneda && baseCurrency !== 'USD') {
                // Si la base no existe, no podemos crear rates
                return;
            }
            
            // VALIDACIÓN CRÍTICA: No guardar si base = quote
            if (moneda.id === (baseMoneda ? baseMoneda.id : 'USD')) {
                // Skip USD/USD, ARS/ARS, etc.
                return;
            }

            const rate = data.rates[quoteCurrency];

            // IMPORTANTE: Invertir para nuestra semántica
            // API dice: 1 USD = X quote
            // Nosotros queremos: base=quote, quote=USD, tc=X
            // Ejemplo: 1 USD = 1050 ARS → base=ARS, quote=USD, tc=1050

            const fx = {
                fx_id: generateNextId('TIPOS_CAMBIO', 'FX', 5),
                fecha: new Date(fecha),
                base_moneda_id: moneda.id,  // Usar currency ID
                quote_moneda_id: baseMoneda ? baseMoneda.id : 'USD',  // Fallback a USD
                tc: rate,
                fuente: fuente,
                provider: 'exchangerate-api.com',
                api_endpoint: url,
                request_params: JSON.stringify({ base: baseCurrency }),
                fetched_at: fetched_at,
                status: 'ok',
                raw_payload: rawPayload.substring(0, 1000) // Limitar tamaño
            };

            try {
                createExchangeRate(fx);
                guardados++;
            } catch (e) {
                logError(`Error guardando rate ${quoteCurrency}`, { error: e.toString() });
            }
        });

        logSuccess(`Fetch completado: ${guardados} rates guardados`);
        showToast(`${guardados} tipos de cambio actualizados`, 'API Fetch', 5);

        return guardados;

    } catch (e) {
        logError('Error en fetch de API', { url, error: e.toString() });

        // Guardar registro de error
        const fxError = {
            fx_id: generateId(),
            fecha: getCurrentDate(),
            base_moneda_id: baseCurrency,
            quote_moneda_id: 'ERROR',
            tc: 0,
            fuente: fuente,
            provider: 'exchangerate-api.com',
            api_endpoint: url,
            request_params: JSON.stringify({ base: baseCurrency }),
            fetched_at: getCurrentTimestamp(),
            status: 'error',
            raw_payload: e.toString()
        };

        // NO validar (porque tiene tc=0 y base=quote invalidos)
        // Insertar directamente
        const rowData = [
            fxError.fx_id,
            fxError.fecha,
            fxError.base_moneda_id,
            fxError.quote_moneda_id,
            fxError.tc,
            fxError.fuente,
            fxError.provider,
            fxError.api_endpoint,
            fxError.request_params,
            fxError.fetched_at,
            fxError.status,
            fxError.raw_payload
        ];
        appendRow('TIPOS_CAMBIO', rowData);

        showAlert(`Error al obtener tipos de cambio:\n\n${e.message}`, 'Error API');

        throw e;
    }
}

/**
 * Obtiene cotización oficial USD/ARS desde el BCRA
 * Fuente más estable para ARS/USD oficial (sin límites de request)
 * @returns {number|null} Tipo de cambio o null si falla
 */
function fetchFromBCRA() {
    const url = 'https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/4/2020-01-01/' + 
                formatDate(getCurrentDate(), 'yyyy-MM-dd');
    
    try {
        const response = UrlFetchApp.fetch(url, {
            method: 'GET',
            muteHttpExceptions: true,
            timeout: 10000,
            headers: {
                'Accept': 'application/json'
            }
        });

        const responseCode = response.getResponseCode();
        
        if (responseCode !== 200) {
            logError(`BCRA API retornó código ${responseCode}`);
            return null;
        }

        const data = JSON.parse(response.getContentText());
        
        // Estructura de respuesta BCRA: {"status": 200, "results": [{...}]}
        if (data.results && data.results.length > 0) {
            // Tomar el último valor (más reciente)
            const latestRate = data.results[data.results.length - 1];
            const tc = parseFloat(latestRate.valor);
            
            logInfo(`BCRA: 1 USD = ${tc} ARS (fecha: ${latestRate.fecha})`);
            return tc;
        }
        
        return null;
    } catch (e) {
        logError('Error fetching from BCRA', { error: e.toString() });
        return null;
    }
}

/**
 * Guarda el rate del BCRA en la BD
 * @param {number} tc Tipo de cambio
 */
function saveBCRARate(tc) {
    if (!tc || tc <= 0) return;
    
    const fx = {
        fx_id: generateNextId('TIPOS_CAMBIO', 'FX', 5),
        fecha: getCurrentDate(),
        base_moneda_id: 'ARS',
        quote_moneda_id: 'USD',
        tc: tc,
        fuente: 'oficial',
        provider: 'BCRA',
        api_endpoint: 'api.bcra.gob.ar',
        request_params: JSON.stringify({ variable: 4 }),
        fetched_at: getCurrentTimestamp(),
        status: 'ok',
        raw_payload: ''
    };
    
    try {
        createExchangeRate(fx);
        logSuccess(`Rate BCRA guardado: 1 USD = ${tc} ARS`);
    } catch (e) {
        logError('Error guardando rate BCRA', { error: e.toString() });
    }
}

/**
 * Obtiene cotizaciones de dólar desde DolarAPI (Argentina)
 * Trae oficial y MEP con valores de compra/venta
 * @returns {number} Cantidad de rates guardados
 */
function fetchFromDolarAPI() {
    const endpoints = [
        { path: '/dolares/oficial', fuente: 'oficial' },
        { path: '/dolares/bolsa', fuente: 'MEP' }
    ];
    
    let totalGuardados = 0;
    
    endpoints.forEach(endpoint => {
        try {
            const url = API_CONFIG.dolarapi.baseUrl + endpoint.path;
            
            const response = UrlFetchApp.fetch(url, {
                method: 'GET',
                muteHttpExceptions: true,
                timeout: API_CONFIG.dolarapi.timeout
            });
            
            const responseCode = response.getResponseCode();
            
            if (responseCode !== 200) {
                logError(`DolarAPI ${endpoint.path} retornó código ${responseCode}`);
                return;
            }
            
            const data = JSON.parse(response.getContentText());
            
            // data = { compra, venta, casa, nombre, moneda, fechaActualizacion }
            if (data.compra && data.venta) {
                saveDolarAPIRate(data, endpoint.fuente);
                totalGuardados++;
                logInfo(`DolarAPI: ${endpoint.fuente} - Compra: ${data.compra}, Venta: ${data.venta}`);
            }
            
        } catch (e) {
            logError(`Error fetching ${endpoint.path} from DolarAPI`, { error: e.toString() });
        }
    });
    
    return totalGuardados;
}

/**
 * Guarda una cotización de DolarAPI en la BD
 * @param {Object} rateData Datos de la API {compra, venta, casa, fechaActualizacion}
 * @param {string} fuente Fuente interna (oficial, MEP, etc.)
 */
function saveDolarAPIRate(rateData, fuente) {
    const arsMoneda = CURRENCIES.ARS;
    const usdMoneda = CURRENCIES.USD;
    
    if (!arsMoneda || !usdMoneda) {
        logError('Falta moneda ARS o USD en CURRENCIES hardcodeadas');
        return;
    }
    
    // Validación crítica
    if (arsMoneda.moneda_id === usdMoneda.moneda_id) {
        logError('ARS y USD tienen el mismo ID, verificar configuración de monedas');
        return;
    }
    
    // Calcular TC promedio para uso en conversiones
    const tcPromedio = (parseFloat(rateData.compra) + parseFloat(rateData.venta)) / 2;
    
    const fx = {
        fx_id: generateNextId('TIPOS_CAMBIO', 'FX', 5),
        fecha: new Date(rateData.fechaActualizacion || new Date()),
        base_moneda_id: arsMoneda.moneda_id,
        quote_moneda_id: usdMoneda.moneda_id,
        tc: tcPromedio,  // Promedio para cálculos
        fuente: fuente,
        provider: 'dolarapi.com',
        api_endpoint: '/dolares/' + (rateData.casa || fuente),
        request_params: JSON.stringify({ 
            tipo: rateData.nombre || fuente,
            compra: rateData.compra,
            venta: rateData.venta
        }),
        fetched_at: getCurrentTimestamp(),
        status: 'ok',
        raw_payload: JSON.stringify(rateData).substring(0, 1000)
    };
    
    try {
        createExchangeRate(fx);
        logSuccess(`DolarAPI ${fuente}: 1 USD = ${rateData.compra}/${rateData.venta} ARS`);
    } catch (e) {
        logError(`Error guardando rate ${fuente}`, { error: e.toString() });
    }
}

// ============================================
// CÁLCULO DE CONVERSIÓN
// ============================================

/**
 * Calcula el monto en moneda base del sistema
 * @param {number} monto Monto original
 * @param {string} moneda_id Moneda del monto
 * @param {string} fx_id ID del tipo de cambio (opcional si moneda = base)
 * @returns {number} Monto convertido a moneda base
 */
function calculateMontoBase(monto, moneda_id, fx_id = null) {
    // Obtener moneda base del sistema
    const baseMoneda = getBaseMoneda();

    // CASO 1: Misma moneda que base
    if (moneda_id === baseMoneda) {
        logInfo(`Sin conversión: ${monto} ${moneda_id} (ya es moneda base)`);
        return monto;
    }

    // CASO 2: Moneda diferente - requiere fx_id
    if (!fx_id) {
        throw new Error(
            `fx_id requerido para convertir ${moneda_id} a moneda base ${baseMoneda}`
        );
    }

    // Obtener TC
    const fx = getExchangeRateById(fx_id);
    if (!fx) {
        throw new Error(`fx_id "${fx_id}" no encontrado`);
    }

    if (fx.status !== 'ok') {
        throw new Error(`fx_id "${fx_id}" tiene status="${fx.status}". Solo se permiten status="ok"`);
    }

    // Validar que el fx_id corresponde al par correcto
    // fx debe ser: base=baseMoneda, quote=moneda_id
    if (fx.base_moneda_id !== baseMoneda || fx.quote_moneda_id !== moneda_id) {
        throw new Error(
            `fx_id incorrecto. Esperado par: ${baseMoneda}/${moneda_id}, ` +
            `Encontrado: ${fx.base_moneda_id}/${fx.quote_moneda_id}`
        );
    }

    // Calcular: monto * tc
    const montoBase = monto * fx.tc;

    logInfo(
        `Conversión: ${monto} ${moneda_id} × ${fx.tc} = ${montoBase} ${baseMoneda} ` +
        `(fx_id: ${fx_id})`
    );

    return montoBase;
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Obtiene resumen de tipos de cambio por fuente
 * @returns {Object} {fuente: count}
 */
function getRatesSummary() {
    const rates = getAllExchangeRates({ status: 'ok' });
    const summary = {};

    rates.forEach(r => {
        summary[r.fuente] = (summary[r.fuente] || 0) + 1;
    });

    return summary;
}

/**
 * Limpia tipos de cambio antiguos (> 30 días con status=error o stale)
 * @returns {number} Cantidad eliminada
 */
function cleanupOldRates() {
    const allRates = getAllExchangeRates();
    const now = new Date();
    const threshold = 30 * 24 * 60 * 60 * 1000; // 30 días en ms
    let eliminados = 0;

    allRates.forEach(r => {
        if (r.status === 'error' || r.status === 'stale') {
            const age = now - new Date(r.fecha);
            if (age > threshold) {
                try {
                    deleteExchangeRate(r.fx_id);
                    eliminados++;
                } catch (e) {
                    logError(`Error eliminando ${r.fx_id}`, { error: e.toString() });
                }
            }
        }
    });

    logSuccess(`Limpieza completada: ${eliminados} rates antiguos eliminados`);
    return eliminados;
}

// ============================================
// AUXILIARY SHEET & AUTOMATION
// ============================================

/**
 * Actualiza las cotizaciones auxiliares en DATA-ENTRY (columnas AU-AY)
 * Usado por el Dashboard y fórmulas del usuario
 */
function updateAuxSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
        logError(`Hoja ${SHEET_NAME} no encontrada. No se pudo actualizar cotizaciones auxiliares.`);
        return;
    }

    // Obtener mon edas activas (excluyendo la base)
    const monedas = Object.values(CURRENCIES).filter(c => c.id !== BASE_CURRENCY);
    const baseMoneda = BASE_CURRENCY;
    const fuente = 'oficial'; // Siempre usar oficial para AUX

    // Preparar filas
    const rows = [];
    const timestamp = getCurrentTimestamp();

    monedas.forEach(m => {
        if (m.id === baseMoneda) return; // No listar la base consigo misma

        // Buscar rate directo más reciente
        let rate = getLatestRate(baseMoneda, m.id, fuente);
        let isTriangular = false;

        // Si no hay rate directo, intentar conversión triangular vía USD
        if (!rate) {
            const usdMoneda = CURRENCIES.USD;
            
            if (usdMoneda && m.id !== usdMoneda.id && baseMoneda !== usdMoneda.id) {
                // Buscar base->USD y m->USD (o USD->m)
                const baseToUSD = getLatestRate(baseMoneda, usdMoneda.id, fuente);
                const mToUSD = getLatestRate(m.id, usdMoneda.id, fuente);
                
                if (baseToUSD && mToUSD) {
                    // Conversión triangular: base/m = (base/USD) / (m/USD)
                    // Ejemplo: ARS/EUR = (ARS/USD) / (EUR/USD) = 1400 / 0.84 = 1666.67
                    const triangularTC = baseToUSD.tc / mToUSD.tc;
                    
                    rate = {
                        tc: triangularTC,
                        fuente: fuente + ' (triangular)',
                        raw_payload: JSON.stringify({
                            triangular: true,
                            base_to_usd: baseToUSD.tc,
                            target_to_usd: mToUSD.tc
                        }),
                        request_params: null
                    };
                    
                    isTriangular = true;
                    logInfo(`Conversión triangular para ${m.id}: ${baseMoneda}->${usdMoneda.id}->${m.id} = ${triangularTC.toFixed(2)}`);
                }
            }
        }

        if (rate) {
            // Intentar extraer compra/venta del payload (DolarAPI)
            let compra = rate.tc;
            let venta = rate.tc;
            
            if (!isTriangular) {
                try {
                    const payload = JSON.parse(rate.raw_payload || '{}');
                    logInfo(`DEBUG: Payload para ${m.id}: ${JSON.stringify(payload)}`);
                    
                    if (payload.compra && payload.venta) {
                        compra = parseFloat(payload.compra);
                        venta = parseFloat(payload.venta);
                        logInfo(`DEBUG: Extraído de payload - Compra: ${compra}, Venta: ${venta}`);
                    } else if (rate.request_params) {
                        // Fallback: buscar en request_params
                        const params = JSON.parse(rate.request_params);
                        logInfo(`DEBUG: Request params para ${m.id}: ${JSON.stringify(params)}`);
                        
                        if (params.compra && params.venta) {
                            compra = parseFloat(params.compra);
                            venta = parseFloat(params.venta);
                            logInfo(`DEBUG: Extraído de params - Compra: ${compra}, Venta: ${venta}`);
                        }
                    }
                } catch (e) {
                    // Si falla parsing, usar tc como fallback para ambos
                    logError(`DEBUG: Error parsing payload para ${m.id}: ${e.message}`);
                }
            }
            
            rows.push([
                m.id,                       // AV: Moneda (ID)
                compra,                     // AW: Compra (ahora puede diferir de venta)
                venta,                      // AX: Venta (ahora puede diferir de compra)
                timestamp,                  // AY: Updated At
                rate.fuente                 // AZ: Fuente
            ]);
        }
    });

    // Determinar columnas (AU = columna 47 en notación numérica)
    const colIndexes = getColumnIndexes('AUX_COTIZACIONES');
    const startCol = columnToNumber(RANGES.AUX_COTIZACIONES.start);
    const numCols = 5;

    // Limpiar datos antiguos (desde fila 4 en adelante)
    const lastRow = sheet.getLastRow();
    if (lastRow >= DATA_START_ROW) {
        const rangeToClear = sheet.getRange(DATA_START_ROW, startCol, lastRow - HEADER_ROW, numCols);
        rangeToClear.clearContent();
    }

    // Escribir nuevos datos
    if (rows.length > 0) {
        const targetRange = sheet.getRange(DATA_START_ROW, startCol, rows.length, numCols);
        targetRange.setValues(rows);
    }

    logInfo(`Cotizaciones auxiliares actualizadas: ${rows.length} monedas en DATA-ENTRY (AU-AY)`);
}

/**
 * Helper: Convierte letra de columna a número (A=1, B=2, ..., AU=47)
 */
function columnToNumber(column) {
    let num = 0;
    for (let i = 0; i < column.length; i++) {
        num = num * 26 + (column.charCodeAt(i) - 64);
    }
    return num;
}

/**
 * Configura los triggers automáticos para actualización
 * Se ejecuta una vez al configurar el sistema
 */
function setupAutomatedTriggers() {
    // Eliminar triggers existentes para evitar duplicados
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
        if (t.getHandlerFunction() === 'updateExchangeRates') {
            ScriptApp.deleteTrigger(t);
        }
    });

    // Crear nuevo trigger horario
    ScriptApp.newTrigger('updateExchangeRates')
        .timeBased()
        .everyHours(1)
        .create();

    logSuccess('Trigger automático configurado: updateExchangeRates cada 1 hora');
}

/**
 * Función Wrapper para el Trigger
 * Actualiza API y luego actualiza hoja AUX
 * Usa DolarAPI para ARS/USD, ExchangeRate-API para otras monedas
 */
function updateExchangeRates() {
    try {
        const config = getConfig();
        let successCount = 0;
        
        // ESTRATEGIA HÍBRIDA:
        // 1. DolarAPI para ARS/USD (oficial y MEP) - Argentina específica
        try {
            const dolarCount = fetchFromDolarAPI();
            successCount += dolarCount;
            if (dolarCount > 0) {
                logInfo(`✓ DolarAPI: ${dolarCount} cotizaciones ARS/USD guardadas`);
            }
        } catch (e) {
            logError('DolarAPI falló', { error: e.toString() });
        }
        
        // 2. ExchangeRate-API para otras monedas (EUR, AUD, CNY)
        try {
            const apiCount = fetchExchangeRatesFromAPI('USD', 'oficial');
            successCount += apiCount;
            if (apiCount > 0) {
                logInfo(`✓ ExchangeRate-API: ${apiCount} cotizaciones guardadas`);
            }
        } catch (e) {
            logError('ExchangeRate-API falló', { error: e.toString() });
        }
        
        logInfo(`Total de cotizaciones actualizadas: ${successCount}`);
        
        // 3. Actualizar hoja auxiliar con lo que tengamos
        updateAuxSheet();
        
        showToast(
            `${successCount} cotizaciones actualizadas correctamente`,
            'Actualización Completa',
            5
        );
        
    } catch (e) {
        logError('Fallo crítico en updateExchangeRates', { error: e.toString() });
        showAlert(
            'No se pudieron actualizar cotizaciones desde ninguna fuente.\n' +
            'Verificá tu conexión a Internet.',
            'Error de Actualización'
        );
    }
}
