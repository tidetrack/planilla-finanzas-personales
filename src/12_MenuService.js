/**
 * 12_MenuService.js
 * Servicio de menús personalizados para Tidetrack
 */

// [AGILE-VALOR] Interfaz básica desde el menú para las funciones del core.

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

// Los handlers de opciones del menú (ej. showTransactionForm, showDashboard) 
// han sido eliminados de esta versión simplificada orientada únicamente
// a la gestión del Plan de Cuentas (Gestor ABM).
