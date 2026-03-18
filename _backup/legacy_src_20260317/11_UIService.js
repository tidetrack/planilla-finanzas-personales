/**
 * 11_UIService.js
 * Servicio para gestión de interfaces de usuario (HTML Service)
 * 
 * @version 0.4.0
 * @since 0.4.0
 * @lastModified 2026-01-18
 */

// [AGILE-VALOR] Punto de entrada para la UI de los módulos validados.

/**
 * Incluye el contenido de un archivo HTML dentro de otro (para CSS/JS parciales)
 * Uso: <?!= include('FileName'); ?>
 */
function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Abre el diálogo de Test de Diseño
 */
function showDesignSystemTest() {
    const html = HtmlService.createHtmlOutputFromFile('UI_DesignSystemTest')
        .setWidth(1000)
        .setHeight(800);
    SpreadsheetApp.getUi().showModalDialog(html, 'Design System Test');
}

function showTransactionForm() {
    // Verificamos si existe el archivo
    try {
        const html = HtmlService.createHtmlOutputFromFile('UI_TransactionForm')
            .setWidth(750)
            .setHeight(900);
        SpreadsheetApp.getUi().showModalDialog(html, 'Nueva Transacción');
    } catch (e) {
        SpreadsheetApp.getUi().alert('❌ Error al abrir formulario: ' + e.message);
    }
}

/**
 * Abre el dashboard principal
 */
function showMainDashboard() {
    const html = HtmlService.createHtmlOutputFromFile('UI_MainDashboard')
        .setWidth(1000)
        .setHeight(800);
    SpreadsheetApp.getUi().showModalDialog(html, 'Tidetrack - Dashboard');
}




// ===== API PARA UI (google.script.run) =====

/**
 * Obtiene los datos necesarios para inicializar los dropdowns del formulario
 */
function getFormData() {
    try {
        // Obtener configuración - llamar función directamente
        const baseMoneda = getBaseMoneda();

        // Obtener catálogos - usar monedas hardcodeadas
        const monedas = Object.values(CURRENCIES).map(m => ({
            moneda_id: m.id,
            simbolo: m.symbol,
            nombre_moneda: m.name
        }));

        const cuentas = getAllCuentas().map(c => ({
            cuenta_id: c.cuenta_id,
            nombre_cuentas: c.nombre_cuentas,
            macro_tipo: c.macro_tipo
        }));

        const medios = getAllMediosPago().map(m => ({
            medio_id: m.medio_id,
            nombre_medio: m.nombre_medio,
            tipo: m.tipo
        }));

        return {
            baseMoneda: baseMoneda,
            monedas: monedas,
            cuentas: cuentas,
            medios: medios
        };
    } catch (e) {
        Logger.log('Error en getFormData: ' + e.toString());
        throw new Error('No se pudieron cargar los datos del formulario: ' + e.message);
    }
}

/**
 * Obtiene las tasas de cambio más recientes para un par de monedas
 */
function getLatestRatesForMoneda(baseMonedaId, foreignMonedaId) {
    try {
        // Llamar función directamente
        const rate = getLatestRate(baseMonedaId, foreignMonedaId);
        if (rate) {
            return [{
                fx_id: rate.fx_id,
                tc: rate.valor,
                fuente: rate.fuente,
                fecha_tc: rate.fecha
            }];
        }
        return [];
    } catch (e) {
        Logger.log('Error getting FX rates: ' + e.toString());
        throw e;
    }
}

/**
 * Carga métricas para el dashboard principal
 * @param {number} year Año (default: año actual)
 * @param {number} month Mes (1-12, default: mes actual)
 */
/**
 * Carga métricas para el dashboard principal
 * @param {number} year Año (default: año actual)
 * @param {number} month Mes (1-12, default: mes actual)
 * @param {string} displayCurrency Moneda para visualizar (opcional)
 */
function getDashboardStats(year, month, displayCurrency = null) {
    try {
        // Usar fecha actual si no se especifica
        const now = new Date();
        const targetYear = year || now.getFullYear();
        const targetMonth = month !== undefined ? month : now.getMonth(); // 0-11
        
        const config = getConfig();
        const baseMoneda = config.base_moneda_id;
        
        // Si no se especifica moneda de visualización, usar la base
        const targetCurrency = displayCurrency || baseMoneda;

        const allTrx = getAllTransacciones();

        // 1. Filtrar transacciones del mes especificado
        const trxMonth = allTrx.filter(t => {
            const d = new Date(t.fecha);
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });

        // 2. Calcular totales del mes (Siempre en Moneda Base primero)
        let ingresosBase = 0;
        let egresosBase = 0;
        let ingresosCount = 0;
        let egresosCount = 0;

        trxMonth.forEach(t => {
             // Usar monto_base si existe, convertimos on-the-fly si no (fallback)
             // Asumimos que calculateMontoBase maneja la conversión a la moneda del sistema
             let valorBase = 0;
             
             if (t.monto_base) {
                 valorBase = t.monto_base;
             } else {
                 // Fallback o lógica simplificada: Si es la misma moneda, usar monto. 
                 // Si no, intentar convertir (esto es pesado loop por loop, mejor confiar en monto_base)
                 // Para este sprint, confiamos en que los datos están normalizados o usamos monto directo si coincide
                 if (t.moneda_id === baseMoneda) {
                     valorBase = t.monto;
                 } else {
                     // Si no tenemos monto_base guardado y es otra moneda, NO lo sumamos por ahora
                     // O lo estimamos. Para MVP, sumamos solo si coincide o tiene base.
                     // (Idealmente todo registro tiene monto_base calculado al guardar)
                     if (t.fx_id) {
                         // Si tiene fx referenciado, podríamos buscarlo, pero es lento.
                         // Asumimos 0 si falta datos para no romper estadísticas
                     }
                 }
             }

            if (t.sentido === 'Ingreso') {
                ingresosBase += valorBase;
                ingresosCount++;
            } else {
                egresosBase += valorBase;
                egresosCount++;
            }
        });

        // 3. Convertir a Moneda de Visualización (si es necesario)
        let ingresosDisplay = ingresosBase;
        let egresosDisplay = egresosBase;
        const balanceBase = ingresosBase - egresosBase;
        let balanceDisplay = balanceBase;

        if (targetCurrency !== baseMoneda) {
            // Buscar cotización actual (Presente)
            // Lógica: 1 USD = 1050 ARS (Stored as: Base=ARS, Quote=USD, TC=1050)
            // Queremos pasar de ARS a USD.
            // Formula: Monto USD = Monto ARS / TC
            
            // Buscar rate donde: Base=BaseSistema(ARS), Quote=Target(USD)
            const rate = getLatestRate(baseMoneda, targetCurrency, config.fuente_tc_preferida);
            
            if (rate && rate.tc > 0) {
                ingresosDisplay = ingresosBase / rate.tc;
                egresosDisplay = egresosBase / rate.tc;
                balanceDisplay = balanceBase / rate.tc;
            } else {
                // Si no hay tasa, retornamos 0 o error visual?
                // Mejor retornamos 0 para indicar "no data"
                console.warn(`No rate found for ${baseMoneda}->${targetCurrency}`);
                // Opcional: Fallback a 1 si no se encuentra (para no mostrar 0 absoluto si hay plata)
                // Pero es peligroso. Mejor dejarlo claro.
            }
        }
        
        // 4. Obtener monedas disponibles para el selector
        const availableCurrencies = getAllMonedas().map(m => m.moneda_id);

        // 5. Obtener últimas transacciones (top 5 desc)
        const recent = [...allTrx]
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 5)
            .map(t => ({
                fecha: t.fecha,
                monto: t.monto,
                moneda: t.moneda_id,
                sentido: t.sentido,
                cuenta: t.cuenta_id,
                medio: t.medio_id,
                nota: t.nota
            }));

        // Enriquecer datos recientes con nombres reales
        const cuentasMap = new Map(getAllCuentas().map(c => [c.cuenta_id, c.nombre_cuentas]));
        const mediosMap = new Map(getAllMediosPago().map(m => [m.medio_id, m.nombre_medio]));

        recent.forEach(r => {
            if (cuentasMap.has(r.cuenta)) r.cuenta = cuentasMap.get(r.cuenta);
            if (mediosMap.has(r.medio)) r.medio = mediosMap.get(r.medio);
        });

        return {
            baseCurrency: baseMoneda,
            displayCurrency: targetCurrency,
            availableCurrencies: availableCurrencies,
            balance: balanceDisplay,
            incomeMonth: ingresosDisplay,
            expenseMonth: egresosDisplay,
            incomeCount: ingresosCount,
            expenseCount: egresosCount,
            recentTransactions: recent,
            selectedYear: targetYear,
            selectedMonth: targetMonth // 0-11
        };

    } catch (e) {
        Logger.log('ERROR CRÍTICO en getDashboardStats: ' + e.toString());
        Logger.log('Stack trace: ' + e.stack);
        return {
            baseCurrency: 'ARS',
            displayCurrency: 'ARS',
            availableCurrencies: ['ARS'],
            balance: 0,
            incomeMonth: 0,
            expenseMonth: 0,
            incomeCount: 0,
            expenseCount: 0,
            recentTransactions: [],
            error: e.message
        };
    }
}

/**
 * Crea una transacción recibiendo datos desde la UI
 */
function createTransaccionFromUI(trxData) {
    try {
        Logger.log('Recibiendo transacción desde UI: ' + JSON.stringify(trxData));

        // Llamar al servicio core directamente pasando el objeto completo
        const result = createTransaccion(trxData);

        return {
            success: true,
            trx_id: result.trx_id,
            message: 'Transacción creada correctamente'
        };
    } catch (e) {
        Logger.log('Error creando transacción UI: ' + e.toString());
        throw new Error(e.message);
    }
}

/**
 * Obtiene lista de transacciones con filtros y paginación
 * @param {number} year Año
 * @param {number} month Mes (0-11)
 * @param {Object} filters Filtros { sentido, cuenta_id }
 */
function getTransactionsList(year, month, filters) {
    try {
        // 1. Obtener todas las transacciones
        const allTrx = getAllTransacciones();

        // 2. Filtrar por mes/año
        const targetMonth = month !== undefined ? month : new Date().getMonth();
        const targetYear = year || new Date().getFullYear();

        let filtered = allTrx.filter(t => {
            const d = new Date(t.fecha);
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });

        // 3. Aplicar filtros de sentido
        if (filters && filters.sentido && filters.sentido !== 'Todos') {
            filtered = filtered.filter(t => t.sentido === filters.sentido);
        }

        // 4. Aplicar filtros de cuenta
        if (filters && filters.cuenta_id && filters.cuenta_id !== 'Todas') {
            filtered = filtered.filter(t => t.cuenta_id === filters.cuenta_id);
        }

        // 5. Ordenar por fecha desc (más recientes primero)
        filtered.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        // 6. Limitar a 50
        const limited = filtered.slice(0, 50);

        // 7. Enriquecer con nombres de lookup
        const cuentasMap = new Map(getAllCuentas().map(c => [c.cuenta_id, c.nombre_cuentas]));
        const mediosMap = new Map(getAllMediosPago().map(m => [m.medio_id, m.nombre_medio]));
        const monedasMap = new Map(getAllMonedas().map(m => [m.moneda_id, m.simbolo]));

        const enriched = limited.map(t => ({
            trx_id: t.trx_id,
            fecha: t.fecha,
            monto: t.monto,
            moneda_id: t.moneda_id,
            sentido: t.sentido,
            cuenta_id: t.cuenta_id,
            medio_id: t.medio_id,
            nota: t.nota || '',
            cuenta_nombre: cuentasMap.get(t.cuenta_id) || t.cuenta_id,
            medio_nombre: mediosMap.get(t.medio_id) || t.medio_id,
            moneda_simbolo: monedasMap.get(t.moneda_id) || t.moneda_id
        }));

        // 8. Obtener catálogos para los filtros
        const cuentas = getAllCuentas().map(c => ({
            cuenta_id: c.cuenta_id,
            nombre_cuentas: c.nombre_cuentas
        }));

        return {
            transactions: enriched,
            total: filtered.length,
            showing: enriched.length,
            selectedYear: targetYear,
            selectedMonth: targetMonth + 1, // Convert to 1-12 for UI
            cuentas: cuentas
        };

    } catch (e) {
        Logger.log('Error en getTransactionsList: ' + e.toString());
        Logger.log('Stack trace: ' + e.stack);
        return {
            transactions: [],
            total: 0,
            showing: 0,
            cuentas: [],
            selectedYear: new Date().getFullYear(),
            selectedMonth: new Date().getMonth() + 1,
            error: e.message,
            errorDetails: e.toString()
        };
    }
}

// ============================================
// PLAN DE CUENTAS - ABM API
// ============================================

/**
 * Abre el gestor centralizado Multi-ABM del Plan de Cuentas
 */
function showAbmPlanCuentas() {
    const html = HtmlService.createHtmlOutputFromFile('UI_AbmPlanCuentas')
        .setWidth(600)
        .setHeight(650);
    SpreadsheetApp.getUi().showModalDialog(html, 'Plan de Cuentas');
}

/**
 * Obtiene Monedas y Proyectos base para poblar los Selects del Pop-Up ABM
 */
function getAbmFormData() {
    try {
        // Obtenemos directamente de las columnas deducidas en Config
        let dataMonedas = [];
        try { dataMonedas = getTableData('MONEDAS'); } catch(e) {}
        
        // Si hay data, usamos Columna 1 (Z) que es la abreviación
        const monedasActivas = dataMonedas.map(row => row[1]).filter(a => a); 

        let dataProyectos = [];
        try { dataProyectos = getTableData('PROYECTOS'); } catch(e) {}
        
        // Si hay data, usamos Columna 0 (AC) que es el Nombre del proyecto
        const proyectosActivos = dataProyectos.map(row => row[0]).filter(p => p);
        
        return {
            monedas: monedasActivas.length > 0 ? monedasActivas : ['ARS', 'USD', 'AUD'], // Fallback 
            proyectos: proyectosActivos
        };
    } catch (e) {
        Logger.log('Error getAbmFormData: ' + e.toString());
        return { monedas: ['ARS', 'USD', 'AUD'], proyectos: [] };
    }
}

/**
 * Recibe un payload desde el UI y lo anexa al carril/tabla correspondiente 
 * @param {Object} payload 
 */
function saveAbmRecord(payload) {
    try {
        Logger.log('Guardando ABM Plan de Cuentas: ' + JSON.stringify(payload));
        
        if (!payload.nombre || payload.nombre.trim() === '') {
            throw new Error('El nombre es un campo obligatorio.');
        }

        let rowData = [];
        const entity = payload.entityType;
        
        switch(entity) {
            case 'INGRESOS':
            case 'COSTOS_FIJOS':
            case 'COSTOS_VARIABLES':
            case 'MEDIOS_PAGO':
                if (!payload.monedaRelacionada) throw new Error('Se requiere una moneda base para esta entidad.');
                rowData = [
                    payload.nombre.trim(), 
                    payload.monedaRelacionada, 
                    payload.proyectoRelacionado || ''
                ];
                break;
                
            case 'MONEDAS':
                if (!payload.abreviacion) throw new Error('Se requiere una abreviación para las Monedas (ej. USD).');
                rowData = [
                    payload.nombre.trim(),
                    payload.abreviacion.toUpperCase().trim(),
                    payload.proyectoRelacionado || ''
                ];
                break;
                
            case 'PROYECTOS':
                rowData = [
                    payload.nombre.trim(),
                    payload.tipoProyecto || 'General'
                ];
                break;
                
            default:
                throw new Error('Entidad desconocida: ' + entity);
        }

        appendRow(entity, rowData);
        
        return {
            success: true,
            entityType: entity,
            nombre: payload.nombre
        };
        
    } catch (e) {
        Logger.log('Error saveAbmRecord: ' + e.toString());
        throw new Error(e.message);
    }
}

// ============================================
// SPRINT 4: MANAGERS - SHOW FUNCTIONS
// ============================================

/**
 * Abre el gestor de cuentas
 */
function showCuentasManager() {
    const html = HtmlService.createHtmlOutputFromFile('UI_CuentasManager')
        .setWidth(700)
        .setHeight(650);
    SpreadsheetApp.getUi().showModalDialog(html, 'Gestionar Cuentas');
}

/**
 * Abre el gestor de medios de pago
 */
function showMediosManager() {
    const html = HtmlService.createHtmlOutputFromFile('UI_MediosManager')
        .setWidth(700)
        .setHeight(650);
    SpreadsheetApp.getUi().showModalDialog(html, 'Gestionar Medios de Pago');
}

// ============================================
// CUENTAS - API WRAPPERS
// ============================================

/**
 * Obtiene lista de cuentas para UI
 */
function getCuentasList() {
    return getAllCuentas();
}

/**
 * Crea una cuenta desde UI
 */
function createCuentaFromUI(data) {
    try {
        const result = createCuenta(data.nombre_cuentas, data.macro_tipo, data.es_recurrente);
        return { success: true, cuenta_id: result.cuenta_id };
    } catch (e) {
        throw new Error(e.message);
    }
}

/**
 * Actualiza una cuenta desde UI
 */
function updateCuentaFromUI(cuenta_id, data) {
    try {
        const result = updateCuenta(cuenta_id, data.nombre_cuentas, data.macro_tipo, data.es_recurrente);
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
}

/**
 * Elimina una cuenta desde UI
 */
function deleteCuentaFromUI(cuenta_id) {
    try {
        deleteCuenta(cuenta_id);
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
}

// ============================================
// MEDIOS DE PAGO - API WRAPPERS
// ============================================

/**
 * Obtiene lista de medios de pago para UI
 */
function getMediosList() {
    return getAllMediosPago();
}

/**
 * Crea un medio de pago desde UI
 */
function createMedioFromUI(data) {
    try {
        const result = createMedioPago(data.nombre_medio, data.tipo, data.moneda_id, data.uso_principal);
        return { success: true, medio_id: result.medio_id };
    } catch (e) {
        throw new Error(e.message);
    }
}

/**
 * Actualiza un medio de pago desde UI
 */
function updateMedioFromUI(medio_id, data) {
    try {
        const result = updateMedioPago(medio_id, data.nombre_medio, data.tipo, data.moneda_id, data.uso_principal);
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
}

/**
 * Elimina un medio de pago desde UI
 */
function deleteMedioFromUI(medio_id) {
    try {
        deleteMedioPago(medio_id);
        return { success: true };
    } catch (e) {
        throw new Error(e.message);
    }
}

// ============================================
// CONFIGURATION UI & BACKEND
// ============================================

/**
 * Abre el panel de configuración
 */
function showConfig() {
    const html = HtmlService.createHtmlOutputFromFile('UI_Config')
        .setWidth(1200)
        .setHeight(900);
    SpreadsheetApp.getUi().showModalDialog(html, 'Configuración del Sistema');
}

/**
 * Wrapper para actualizar cotizaciones desde UI
 */
function triggerExchangeRateUpdate() {
    updateExchangeRates(); // Llamamos a la función de 06_ExchangeRateService
    return { success: true };
}

/**
 * Wrapper para crear una nueva moneda desde Config UI
 * @param {Object} currencyData { iso_code, nombre_moneda, simbolo }
 * @returns {Object} Moneda creada
 */
function createMoneda(currencyData) {
    try {
        // La función existente espera parámetros separados pero necesitamos soportar iso_code
        const moneda = {
            moneda_id: generateNextId('MONEDAS', 'MON', 3),
            nombre_moneda: currencyData.nombre_moneda,
            simbolo: currencyData.simbolo,
            iso_code: currencyData.iso_code
        };

        // Validar campos requeridos
        if (!moneda.nombre_moneda || !moneda.simbolo || !moneda.iso_code) {
            throw new Error('Faltan campos requeridos: nombre_moneda, simbolo, iso_code');
        }

        // Convertir a array con todas las columnas
        const colIndexes = getColumnIndexes('MONEDAS');
        const rowData = [
            moneda.moneda_id,
            moneda.nombre_moneda,
            moneda.simbolo,
            moneda.iso_code
        ];

        // Insertar
        appendRow('MONEDAS', rowData);

        logSuccess(`Moneda creada: ${moneda.moneda_id} - ${moneda.nombre_moneda} (${moneda.iso_code})`);
        showToast(`Moneda "${moneda.nombre_moneda}" creada correctamente`);

        return moneda;
    } catch (e) {
        logError('Error creando moneda', { error: e.toString() });
        throw e;
    }
}

/**
 * Wrapper para actualizar una moneda existente desde Config UI
 * @param {Object} currencyData { moneda_id, iso_code, nombre_moneda, simbolo }
 * @returns {Object} Moneda actualizada
 */
function updateMoneda(currencyData) {
    try {
        const result = findById('MONEDAS', currencyData.moneda_id, 0);

        if (!result) {
            throw new Error(`Moneda no encontrada: ${currencyData.moneda_id}`);
        }

        const rowData = [
            currencyData.moneda_id,
            currencyData.nombre_moneda,
            currencyData.simbolo,
            currencyData.iso_code
        ];

        updateRow('MONEDAS', result.rowIndex, rowData);

        logSuccess(`Moneda actualizada: ${currencyData.moneda_id}`);
        showToast(`Moneda "${currencyData.nombre_moneda}" actualizada correctamente`);

        return currencyData;
    } catch (e) {
        logError('Error actualizando moneda', { error: e.toString() });
        throw e;
    }
}

/**
 * Wrapper para eliminar una moneda desde Config UI
 * @param {string} monedaId ID de la moneda a eliminar
 */
function deleteMoneda(monedaId) {
    try {
        const result = findById('MONEDAS', monedaId, 0);

        if (!result) {
            throw new Error(`Moneda no encontrada: ${monedaId}`);
        }

        // TODO: Verificar que no tenga FKs en otras tablas
        logInfo(`ADVERTENCIA: Verificar manualmente que ${monedaId} no tenga referencias`);

        deleteRow('MONEDAS', result.rowIndex);

        logSuccess(`Moneda eliminada: ${monedaId}`);
        showToast(`Moneda "${monedaId}" eliminada`);
    } catch (e) {
        logError('Error eliminando moneda', { error: e.toString() });
        throw e;
    }
}
