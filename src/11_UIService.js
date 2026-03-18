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

// ============================================
// PLAN DE CUENTAS - ABM API
// ============================================

/**
 * Abre el gestor centralizado Multi-ABM del Plan de Cuentas
 */
function showAbmPlanCuentas() {
    const html = HtmlService.createTemplateFromFile('UI_AbmPlanCuentas').evaluate()
        .setWidth(520)
        .setHeight(620);
    SpreadsheetApp.getUi().showModalDialog(html, 'Plan de Cuentas');
}

/**
 * Obtiene Monedas y Proyectos base para poblar los Selects del Pop-Up ABM.
 * Las monedas se leen desde la constante MONEDAS_DISPONIBLES (backend).
 * Los proyectos se leen desde la tabla PROYECTOS de la hoja de cálculo.
 */
function getAbmFormData() {
    try {
        // Monedas: servidas desde constante de backend (ADR-003)
        const monedas = MONEDAS_DISPONIBLES;

        // Proyectos: leídos desde la tabla de la hoja
        let dataProyectos = [];
        try { dataProyectos = getTableData('PROYECTOS'); } catch(e) {}
        const proyectosActivos = dataProyectos.map(row => row[0]).filter(p => p);
        
        return {
            monedas: monedas,
            proyectos: proyectosActivos
        };
    } catch (e) {
        Logger.log('Error getAbmFormData: ' + e.toString());
        return { monedas: MONEDAS_DISPONIBLES, proyectos: [] };
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

        const entity = payload.entityType;

        // Validar que no exista un registro con el mismo nombre en esta entidad
        let existingData = [];
        try { existingData = getTableData(entity); } catch(e) {}
        
        const existingNames = existingData.map(row => (row[0] || '').toString().trim().toLowerCase());
        if (existingNames.includes(payload.nombre.trim().toLowerCase())) {
            throw new Error(`No es posible hacer este ajuste: La cuenta "${payload.nombre}" ya existe en este módulo.`);
        }

        let rowData = [];
        
        switch(entity) {
            case 'INGRESOS':
            case 'COSTOS_FIJOS':
            case 'COSTOS_VARIABLES':
            case 'MEDIOS_PAGO':
                rowData = [
                    payload.nombre.trim(), 
                    payload.monedaRelacionada || '', 
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
