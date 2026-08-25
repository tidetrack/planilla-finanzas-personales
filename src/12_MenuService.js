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
 * Item inerte: es un TITULO de seccion del menu, no una accion.
 *
 * Apps Script no soporta encabezados de menu -- addItem exige una funcion. Dejarla vacia
 * seria peor: clickear y que no pase nada se lee como una falla. Esta dice lo que es.
 * (Portado de planilla-pymes.)
 */
function _menuSeccion() {
    try {
        SpreadsheetApp.getActiveSpreadsheet()
            .toast('Es un titulo de seccion del menu, no una accion.', 'tidetrack', 3);
    } catch (e) { /* sin planilla activa: silenciado a proposito */ }
}

/**
 * Agrega a un menu los items de una lista de configuracion.
 * Soporta separadores, rotulos de seccion y submenus anidados.
 *
 * @param {GoogleAppsScript.Base.Ui} ui
 * @param {GoogleAppsScript.Base.Menu} menu Menu destino
 * @param {Array<Object>} items Items segun la gramatica de MENU_CONFIG (ver 00_Config.js)
 */
function _agregarItemsMenu(ui, menu, items) {
    items.forEach(function (item) {
        if (item.separator) {
            menu.addSeparator();
        } else if (item.seccion) {
            menu.addItem('--- ' + item.seccion + ' ---', '_menuSeccion');
        } else if (item.submenu) {
            const sub = ui.createMenu(item.submenu);
            _agregarItemsMenu(ui, sub, item.items || []);
            menu.addSubMenu(sub);
        } else {
            menu.addItem(item.name, item.function);
        }
    });
}

/**
 * Crea los menus personalizados en la barra de Google Sheets.
 *
 * decision Franco 2026-08-13: dos menus separados (uso diario / desarrollo), y cada uno
 * se construye en su propio try/catch. Si la configuracion de uno rompiera, el otro
 * igual aparece: quedarse sin ningun menu deja la planilla inoperable desde la UI.
 */
function createCustomMenu() {
    const ui = SpreadsheetApp.getUi();

    try {
        const menu = ui.createMenu(MENU_CONFIG.MAIN_MENU || 'tidetrack');
        if (MENU_CONFIG.ITEMS && Array.isArray(MENU_CONFIG.ITEMS)) {
            _agregarItemsMenu(ui, menu, MENU_CONFIG.ITEMS);
        } else {
            menu.addItem('Error de configuracion del menu', 'onOpen');
        }
        menu.addToUi();
    } catch (e) {
        try { logError('createCustomMenu: fallo el menu principal', e); } catch (e2) { /* onOpen corre en AuthMode limitado */ }
    }

    try {
        if (MENU_CONFIG.DEV_ITEMS && Array.isArray(MENU_CONFIG.DEV_ITEMS)) {
            const menuDev = ui.createMenu(MENU_CONFIG.DEV_MENU || 'tidetrack Dev');
            _agregarItemsMenu(ui, menuDev, MENU_CONFIG.DEV_ITEMS);
            menuDev.addToUi();
        }
    } catch (e) {
        try { logError('createCustomMenu: fallo el menu Dev', e); } catch (e2) { /* idem */ }
    }
}

// ===== HANDLERS DEL MENÚ =====
