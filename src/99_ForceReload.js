/**
 * 99_ForceReload.js
 * BACKUP completo de funciones UI para evitar problemas de carga
 */

// ===== UI FUNCTIONS =====

function showTransactionForm() {
    try {
        const html = HtmlService.createHtmlOutputFromFile('UI_TransactionForm')
            .setWidth(580)
            .setHeight(850);
        SpreadsheetApp.getUi().showModalDialog(html, 'Nueva Transacción');
    } catch (e) {
        SpreadsheetApp.getUi().alert('Error: ' + e.message);
    }
}

function getFormData() {
    try {
        const baseMoneda = getBaseMoneda();
        const monedas = getAllMonedas().map(m => ({
            moneda_id: m.moneda_id,
            simbolo: m.simbolo,
            nombre_moneda: m.nombre_moneda
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
        return { baseMoneda, monedas, cuentas, medios };
    } catch (e) {
        Logger.log('Error en getFormData: ' + e.toString());
        throw new Error('No se pudieron cargar los datos: ' + e.message);
    }
}

function createTransaccionFromUI(trxData) {
    try {
        Logger.log('Creando transacción: ' + JSON.stringify(trxData));
        const result = createTransaccion(trxData);
        return {
            success: true,
            trx_id: result.trx_id,
            message: 'Transacción creada correctamente'
        };
    } catch (e) {
        Logger.log('Error: ' + e.toString());
        throw new Error(e.message);
    }
}

function getLatestRatesForMoneda(baseMonedaId, foreignMonedaId) {
    try {
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
        return [];
    }
}

function showMainDashboard() {
    const html = HtmlService.createHtmlOutputFromFile('UI_MainDashboard')
        .setWidth(1200)
        .setHeight(700);
    SpreadsheetApp.getUi().showModalDialog(html, 'Tidetrack - Dashboard');
}

function getDashboardStats(year, month) {
    try {
        const now = new Date();
        const targetYear = year || now.getFullYear();
        const targetMonth = month !== undefined ? month : now.getMonth();

        const config = getConfig();
        const allTrx = getAllTransacciones();

        const trxMonth = allTrx.filter(t => {
            const d = new Date(t.fecha);
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });

        let ingresos = 0;
        let egresos = 0;
        let ingresosCount = 0;
        let egresosCount = 0;

        trxMonth.forEach(t => {
            if (t.sentido === 'Ingreso') {
                ingresos += t.monto_base;
                ingresosCount++;
            } else if (t.sentido === 'Egreso') {
                egresos += t.monto_base;
                egresosCount++;
            }
        });

        return {
            currency: config.base_moneda_id || 'ARS',
            balance: (ingresos - egresos),
            incomeMonth: ingresos,
            expenseMonth: egresos,
            incomeCount: ingresosCount,
            expenseCount: egresosCount,
            selectedYear: targetYear,
            selectedMonth: targetMonth + 1
        };
    } catch (e) {
        Logger.log('ERROR en getDashboardStats: ' + e.toString());
        return {
            currency: 'ARS',
            balance: 0,
            incomeMonth: 0,
            expenseMonth: 0,
            incomeCount: 0,
            expenseCount: 0,
            selectedYear: new Date().getFullYear(),
            selectedMonth: new Date().getMonth() + 1,
            error: e.message
        };
    }
}

// ===== TEST FUNCTION =====

function testAllFunctions() {
    const ui = SpreadsheetApp.getUi();
    let errors = [];

    // Test 1
    if (typeof showTransactionForm !== 'function') {
        errors.push('showTransactionForm NO definida');
    }

    // Test 2
    if (typeof getFormData !== 'function') {
        errors.push('getFormData NO definida');
    }

    // Test 3
    if (typeof createTransaccionFromUI !== 'function') {
        errors.push('createTransaccionFromUI NO definida');
    }

    // Test 4
    if (typeof showMainDashboard !== 'function') {
        errors.push('showMainDashboard NO definida');
    }

    if (errors.length > 0) {
        ui.alert('❌ ERRORES:\n' + errors.join('\n'));
    } else {
        ui.alert('✅ Todas las funciones UI están correctamente definidas.\n\nAhora puedes usar el menú Tidetrack normalmente.');
    }
}
