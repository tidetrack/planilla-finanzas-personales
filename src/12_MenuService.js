/**
 * 12_MenuService.js
 * Servicio de menús personalizados para Tidetrack
 */

/**
 * Trigger que se ejecuta automáticamente al abrir la hoja de cálculo
 */
function onOpen() {
    createCustomMenu();
}

/**
 * Crea el menú personalizado en la barra de herramientas de Google Sheets
 */
function createCustomMenu() {
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu(MENU_CONFIG.MAIN_MENU || 'Tidetrack 💰');

    // Construir menú dinámicamente desde la configuración
    if (MENU_CONFIG.ITEMS && Array.isArray(MENU_CONFIG.ITEMS)) {
        MENU_CONFIG.ITEMS.forEach(item => {
            if (item.separator) {
                menu.addSeparator();
            } else {
                menu.addItem(item.name, item.function);
            }
        });
    } else {
        // Fallback si no hay config
        menu.addItem('Nueva Transacción ⚡', 'showTransactionDialog')
            .addItem('Ver Dashboard 📊', 'showDashboard');
    }

    menu.addToUi();
}

// ===== HANDLERS DEL MENÚ =====

/**
 * Abre el diálogo de nueva transacción
 */
function showTransactionDialog() {
    // Delegar al servicio de UI
    if (typeof showTransactionForm === 'function') {
        showTransactionForm();
    } else {
        SpreadsheetApp.getUi().alert('Error: showTransactionForm no está definido en 11_UIService.js');
    }
}

/**
 * Abre el dashboard principal
 */
function showDashboard() {
    // Delegar al servicio de UI
    if (typeof showMainDashboard === 'function') {
        showMainDashboard();
    } else {
        SpreadsheetApp.getUi().alert('Próximamente: Dashboard (Day 3)');
    }
}



/**
 * Wrapper para ejecutar seed de datos
 */
function runDataSeed() {
    if (typeof runDataSeedWithConfirmation === 'function') {
        runDataSeedWithConfirmation();
    } else {
        SpreadsheetApp.getUi().alert('Error: runDataSeedWithConfirmation no está definido en 98_DataSeeder.js');
    }
}

/**
 * Limpia las transacciones (para testing)
 */
function confirmClearTransactions() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
        'Limpiar Transacciones',
        '¿Estás seguro de que quieres BORRAR TODAS las transacciones? Esta acción no se puede deshacer.',
        ui.ButtonSet.YES_NO
    );

    if (result == ui.Button.YES) {
        if (typeof TransactionService !== 'undefined' && TransactionService.clearAllTransacciones) {
            try {
                TransactionService.clearAllTransacciones();
                ui.alert('Todas las transacciones han sido eliminadas.');
            } catch (e) {
                ui.alert('Error al limpiar: ' + e.message);
            }
        } else {
            ui.alert('Error: TransactionService no disponible');
        }
    }
}
