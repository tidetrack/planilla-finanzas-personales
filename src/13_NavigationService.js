/**
 * 13_NavigationService.js
 * Servicio de navegación entre hojas para Tidetrack
 * Proporciona funciones para cambiar entre hojas y accesos rápidos a funcionalidades
 * 
 * @version 0.6.0
 * @since 0.6.0
 * @lastModified 2026-02-06
 */

// [AGILE-VALOR] Módulo de Navegación básico que permite la coexistencia independiente de Hojas/Módulos.

// ============================================
// NAVEGACIÓN ENTRE HOJAS
// ============================================

/**
 * Navega a la hoja "Inicio"
 * Asignar esta función a botón de navegación "Inicio"
 */
function navigateToInicio() {
 navigateToSheet(NAV_CONFIG.SHEETS.INICIO);
}

/**
 * Navega a la hoja "Tablero"
 * Asignar esta función a botón de navegación "Tablero"
 */
function navigateToTablero() {
 navigateToSheet(NAV_CONFIG.SHEETS.TABLERO);
}

/**
 * Navega a la hoja "Cargas"
 * Asignar esta función a botón de navegación "Cargas"
 */
function navigateToCargas() {
 navigateToSheet(NAV_CONFIG.SHEETS.CARGAS);
}

/**
 * Navega a la hoja "Espacio blanco 1"
 * Asignar esta función a botón de navegación "Espacio blanco 1"
 */
function navigateToEspacioBlanco1() {
 navigateToSheet(NAV_CONFIG.SHEETS.ESPACIO_BLANCO_1);
}

/**
 * Navega a la hoja "Espacio blanco 2"
 * Asignar esta función a botón de navegación "Espacio blanco 2"
 */
function navigateToEspacioBlanco2() {
 navigateToSheet(NAV_CONFIG.SHEETS.ESPACIO_BLANCO_2);
}

/**
 * Navega a la hoja "Espacio blanco 3"
 * Asignar esta función a botón de navegación "Espacio blanco 3"
 */
function navigateToEspacioBlanco3() {
 navigateToSheet(NAV_CONFIG.SHEETS.ESPACIO_BLANCO_3);
}

/**
 * Navega a la hoja "DATA-ENTRY"
 * Función de utilidad para debugging o administración
 */
function navigateToDataEntry() {
 navigateToSheet(NAV_CONFIG.SHEETS.DATA_ENTRY);
}

// ============================================
// FUNCIÓN AUXILIAR DE NAVEGACIÓN
// ============================================

/**
 * Función privada que realiza la navegación a una hoja específica
 * Incluye manejo de errores y feedback visual al usuario
 * 
 * @param {string} sheetName - Nombre de la hoja a la que navegar
 */
function navigateToSheet(sheetName) {
 try {
 const ss = SpreadsheetApp.getActiveSpreadsheet();
 const sheet = ss.getSheetByName(sheetName);
 
 // Validar que la hoja existe
 if (!sheet) {
 SpreadsheetApp.getUi().alert(
 'Hoja no encontrada',
 'La hoja "' + sheetName + '" no existe.\n\nPor favor, verifica que el nombre sea correcto o crea la hoja.',
 SpreadsheetApp.getUi().ButtonSet.OK
 );
 logError('NavigationService', 'Hoja no encontrada: ' + sheetName);
 return;
 }
 
 // Activar la hoja
 ss.setActiveSheet(sheet);
 
 // Mostrar toast de confirmación (si está habilitado)
 if (NAV_CONFIG.SHOW_TOAST_ON_NAVIGATE) {
 const duration = NAV_CONFIG.TOAST_DURATION || 2;
 ss.toast('Navegando a "' + sheetName + '"', 'Navegación', duration);
 }
 
 // Log de navegación
 logInfo('NavigationService', 'Navegación exitosa a: ' + sheetName);
 
 } catch (error) {
 // Manejo de errores inesperados
 SpreadsheetApp.getUi().alert(
 'Error de navegación',
 'Ocurrió un error al intentar navegar a "' + sheetName + '":\n\n' + error.message,
 SpreadsheetApp.getUi().ButtonSet.OK
 );
 logError('NavigationService', 'Error al navegar a ' + sheetName + ': ' + error.message);
 }
}

// ============================================
// ACCIONES RÁPIDAS
// ============================================

// Las funcionalidades de Gestión Rápida (Transacciones, Cuentas, Medios) 
// han sido temporalmente purgadas durante la refactorización a Plan de Cuentas centralizado.
// Los botones en Sheets que apuntaban a quickActionNuevaTransaccion etc., fallarán hasta ser actualizados.

// ============================================
// DOCUMENTACIÓN DE INTEGRACIÓN
// ============================================

/**
 * GUÍA DE INTEGRACIÓN CON BOTONES
 * 
 * Para asignar una función a un botón (imagen/dibujo) en Google Sheets:
 * 
 * 1. Crear o seleccionar el botón (Insertar → Dibujo o Imagen)
 * 2. Clic derecho en el botón → "..." → "Asignar script"
 * 3. Escribir el nombre de la función SIN paréntesis
 * 4. Hacer clic en "Aceptar"
 * 
 * MAPEO DE FUNCIONES A BOTONES:
 * 
 * Navegación:
 * - Botón "Inicio" → navigateToInicio
 * - Botón "Tablero" → navigateToTablero
 * - Botón "Cargas" → navigateToCargas
 * - Botón "Espacio blanco 1" → navigateToEspacioBlanco1
 * - Botón "Espacio blanco 2" → navigateToEspacioBlanco2
 * - Botón "Espacio blanco 3" → navigateToEspacioBlanco3
 * 
 * Acciones rápidas (A implementar en futuro):
 * - Botones dinámicos requerirán nuevas asignaciones.
 * 
 * NOMBRES DE HOJAS CONFIGURABLES:
 * Si necesitas cambiar el nombre de alguna hoja, actualiza NAV_CONFIG.SHEETS en 00_Config.js
 */
