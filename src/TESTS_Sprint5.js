/**
 * TESTS_Sprint5.js
 * Script de validación para el Sprint 5 (Multi-moneda y Configuración)
 */

function TEST_Sprint5_FullSuite() {
    const results = [];
    
    logInfo('=== INICIANDO TEST SUITE SPRINT 5 ===');

    // TEST 0: Verificar ISO Code Mapping
    try {
        const usdMoneda = getMonedaByISO('USD');
        const arsMoneda = getMonedaByISO('ARS');
        
        if (usdMoneda && arsMoneda) {
            results.push(`✅ ISO Mapping OK: USD=${usdMoneda.moneda_id}, ARS=${arsMoneda.moneda_id}`);
        } else {
            results.push('❌ Error ISO Mapping: Falta USD o ARS en base de datos');
        }
    } catch (e) {
        results.push('❌ Error verificando ISO codes: ' + e.message);
    }

    // TEST 1: Verificar Configuración Inicial
    try {
        const config = getConfig();
        if (config.base_moneda_id && config.fuente_tc_preferida) {
            results.push('✅ Configuración cargada correctamente: ' + config.base_moneda_id);
        } else {
            results.push('❌ Error en Configuración: Faltan campos');
        }
    } catch (e) {
        results.push('❌ Error obteniendo Config: ' + e.message);
    }

    // TEST 2: Validar API Fetch con DolarAPI + ExchangeRate-API
    try {
        // Forzamos un update completo (DolarAPI + ExchangeRate-API)
        updateExchangeRates();
        
        // Verificar que se hayan guardado rates de DolarAPI
        const usdMoneda = getMonedaByISO('USD');
        const arsMoneda = getMonedaByISO('ARS');
        
        if (usdMoneda && arsMoneda) {
            const oficialRate = getLatestRate(arsMoneda.moneda_id, usdMoneda.moneda_id, 'oficial');
            const mepRate = getLatestRate(arsMoneda.moneda_id, usdMoneda.moneda_id, 'MEP');
            
            if (oficialRate || mepRate) {
                results.push(`✅ DolarAPI OK: Oficial=${oficialRate ? 'Sí' : 'No'}, MEP=${mepRate ? 'Sí' : 'No'}`);
            } else {
                results.push('⚠️ DolarAPI no trajo rates (verificar conectividad)');
            }
        }
    } catch (e) {
        results.push('❌ Error en updateExchangeRates: ' + e.message);
    }

    // TEST 3: Validar Escritura en AUX (ahora en DATA-ENTRY AV-AZ)
    try {
        updateAuxSheet();
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DATA-ENTRY');
        if (sheet && sheet.getLastRow() >= 4) {
            // Leer desde columna AV (47) 
            const data = sheet.getRange(4, 48, 1, 5).getValues()[0]; // AV=48 en index
            if (data[0]) {
                results.push(`✅ AUX (DATA-ENTRY AV-AZ) actualizada. Primer dato: ${data[0]} = ${data[1]}`);
            } else {
                results.push('⚠️ AUX actualizada pero sin datos (monedas sin rates?)');
            }
        } else {
            results.push('❌ DATA-ENTRY no encontrada o vacía');
        }
    } catch (e) {
        results.push('❌ Error writing AUX: ' + e.message);
    }

    // TEST 4: Validar Conversión en Dashboard
    try {
        // Simulamos dashboard en diferentes monedas
        const statsBase = getDashboardStats(2025, 0, null); // Base currency
        const statsUSD = getDashboardStats(2025, 0, 'USD'); 

        if (statsBase.balance !== statsUSD.balance) {
            results.push(`✅ Conversión Dashboard activa: Base ${statsBase.balance} vs USD ${statsUSD.balance}`);
        } else {
            if(statsBase.balance === 0) {
                results.push('⚠️ Balance es 0, no se puede verificar conversión matemática.');
            } else {
                results.push('⚠️ Balance igual (puede ser mismo currency o sin rates)');
            }
        }
    } catch (e) {
        results.push('❌ Error Dashboard Logic: ' + e.message);
    }

    // TEST 5: Debug Payloads & Raw Data (DolarAPI)
    try {
        const arsMoneda = getMonedaByISO('ARS');
        const usdMoneda = getMonedaByISO('USD');
        
        if (arsMoneda && usdMoneda) {
            // Oficial
            const oficialRate = getLatestRate(arsMoneda.moneda_id, usdMoneda.moneda_id, 'oficial');
            if (oficialRate && oficialRate.raw_payload) {
                const payload = JSON.parse(oficialRate.raw_payload);
                if (payload.compra && payload.venta) {
                    results.push(`✅ Payload Oficial OK: Compra=${payload.compra}, Venta=${payload.venta}`);
                } else {
                    results.push(`⚠️ Payload Oficial incompleto: ${oficialRate.raw_payload}`);
                }
            }
            
            // MEP
            const mepRate = getLatestRate(arsMoneda.moneda_id, usdMoneda.moneda_id, 'MEP');
            if (mepRate && mepRate.raw_payload) {
                const payload = JSON.parse(mepRate.raw_payload);
                if (payload.compra && payload.venta) {
                    results.push(`✅ Payload MEP OK: Compra=${payload.compra}, Venta=${payload.venta}`);
                } else {
                    results.push(`⚠️ Payload MEP incompleto: ${mepRate.raw_payload}`);
                }
            }
        }
    } catch (e) {
        results.push('❌ Error Debug Payload: ' + e.message);
    }

    // REPORTE FINAL
    logInfo('=== RESULTADOS ===');
    results.forEach(r => logInfo(r));
    
    // Mostrar alerta con resumen
    SpreadsheetApp.getUi().alert('Resultados del Test:\n\n' + results.join('\n'));
}

/**
 * FUNCI�N DE PRUEBA - Ejecutar manualmente desde Script Editor
 * Para poblar las cotizaciones en DATA-ENTRY (columnas AV-AZ)
 */
function TEST_PopulateExchangeRates() {
  try {
    Logger.log('=== INICIANDO ACTUALIZACI�N DE COTIZACIONES ===');
    
    // Ejecutar la funci�n principal
    updateExchangeRates();
    
    Logger.log('? Cotizaciones actualizadas exitosamente');
    Logger.log('Revis� las columnas AV-AZ en la hoja DATA-ENTRY');
    
    // Verificar qu� se escribi�
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DATA-ENTRY');
    const startCol = 48; // AV
    const data = sheet.getRange(4, startCol, 10, 5).getValues();
    
    Logger.log('\\n=== DATOS ESCRITOS (primeras 10 filas) ===');
    data.forEach((row, idx) => {
      if (row[0]) { // Solo si tiene moneda
        Logger.log(`Fila ${idx + 4}: ${row[0]} | Compra: ${row[1]} | Venta: ${row[2]} | Fuente: ${row[4]}`);
      }
    });
    
  } catch (e) {
    Logger.log('? ERROR: ' + e.message);
    Logger.log(e.stack);
  }
}

