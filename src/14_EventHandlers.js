/**
 * 14_EventHandlers.js
 * Módulo centralizado para el ruteo de eventos simples de Apps Script (onEdit, onOpen, etc.)
 */

/**
 * Trigger Simple: onEdit
 * Se ejecuta automáticamente al modificarse cualquier celda en la planilla.
 * Actúa como un Router/Dispatcher hacia módulos o validadores específicos.
 * 
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e Objeto del evento
 */
function onEdit(e) {
    if (!e || !e.range) return;

    const sheetName = e.source.getActiveSheet().getName();

    // 1. Ruteo para la hoja "Plan de Cuentas"
    if (sheetName === SHEETS.PLAN_CUENTAS) {
        handlePlanCuentasEdit(e);
    }

    // 2. Ruteo para la hoja "Cargas"
    if (sheetName === NAV_CONFIG.SHEETS.CARGAS) {
        handleCargasEdit(e);
    }
}

/**
 * Maneja los intentos de edición directa en la hoja "Plan de Cuentas".
 * Restaura el valor original (si es posible) y abre el ABM automáticamente.
 * 
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e 
 */
function handlePlanCuentasEdit(e) {
    // 0. Revisar si el usuario desactivó la protección manualmente
    const props = PropertiesService.getDocumentProperties();
    if (props.getProperty('PC_PROTECTION_ENABLED') === 'false') {
        return; // Salir sin proteger si la bandera está apagada
    }

    const range = e.range;
    const row = range.getRow();

    // Si la edición ocurre en el área de datos (por debajo de la fila de encabezados)
    if (row > HEADER_ROW) {

        // 1. Revertir el valor usando e.oldValue para celda individual
        // Si no hay oldValue (la celda estaba vacía o fue un pegado múltiple), limpiamos.
        // Nota: Multi-ediciones no tienen oldValue disponible nativamente en GAS.
        if (e.oldValue !== undefined) {
            range.setValue(e.oldValue);
        } else {
            // Checkeo para evitar limpiar una multi-selección accidentalmente borrada
            if (range.getNumRows() === 1 && range.getNumColumns() === 1) {
                range.clearContent();
            }
        }

        // 2. Mostrar Alerta / Toast nativo
        // (Nota: Google Apps Script bloquea showModalDialog dentro de triggers simples por seguridad anti-phishing)
        e.source.toast(
            'Para proteger tus métricas, ingresá desde la acción rápida > Gestionar Cuentas.',
            'Edición Directa Bloqueada',
            6
        );
    }
}

/**
 * Alterna el estado de protección de la hoja Plan de Cuentas.
 * Ideado para asignarse a un botón (Dibujo) en la interfaz de la planilla.
 */
function togglePlanCuentasProtection() {
    const props = PropertiesService.getDocumentProperties();
    // El estado por defecto (si no existe) es protegido ('true')
    const currentState = props.getProperty('PC_PROTECTION_ENABLED');
    const isCurrentlyProtected = currentState !== 'false';
    const ui = SpreadsheetApp.getUi();
    
    if (isCurrentlyProtected) {
        props.setProperty('PC_PROTECTION_ENABLED', 'false');
        ui.alert(
            '🔓 Protección Desactivada',
            'Ahora podés editar el Plan de Cuentas libremente en la grilla sin que el sistema revierta tus cambios.\n\n⚠️ RECORDÁ reactivarla cuando termines para evitar daños accidentales a la base de datos.',
            ui.ButtonSet.OK
        );
    } else {
        props.setProperty('PC_PROTECTION_ENABLED', 'true');
        ui.alert(
            '🔒 Protección Activada',
            'La hoja Plan de Cuentas vuelve a estar blindada contra ediciones manuales accidentales.',
            ui.ButtonSet.OK
        );
    }
}

/**
 * Maneja las ediciones en la hoja "Cargas" para autocompletar datos automágicamente.
 * Delegado al agente appscript-backend.
 * 
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e 
 */
function handleCargasEdit(e) {
    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();
    const sheet = e.source.getActiveSheet();

    // Solo actuamos en el área de datos
    if (row < DATA_START_ROW) return;

    // Ignorar si es una multi-selección/limpieza masiva
    if (range.getNumRows() > 1 || range.getNumColumns() > 1) return;

    const value = e.value;

    // 1. Edición en Columna "Monto" (I = 9) -> Autocompletar Fecha (N = 14)
    if (col === 9) {
        if (value) {
            const fechaCell = sheet.getRange(row, 14);
            if (!fechaCell.getValue()) {
                // Formatear la fecha actual sin zona horaria confusa para hojas
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                fechaCell.setValue(today);
            }
        }
        return;
    }


    // 3. Edición en Columna "Medio" (L = 12) -> Autocompletar Moneda (M = 13)
    if (col === 12) {
        const monedaCell = sheet.getRange(row, 13);
        if (!value) {
            monedaCell.clearContent();
            return;
        }

        try {
            const medios = getTableData('MEDIOS_PAGO');
            const medioInfo = medios.find(r => r[0] === value);
            if (medioInfo && medioInfo[1]) {
                monedaCell.setValue(medioInfo[1]);
            }
        } catch (error) {
            Logger.log("Error al buscar moneda: " + error);
        }
        return;
    }
}
