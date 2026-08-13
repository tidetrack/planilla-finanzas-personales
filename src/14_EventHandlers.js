/**
 * 14_EventHandlers.js
 * Módulo centralizado para el ruteo de eventos simples de Apps Script (onEdit, onOpen, etc.)
 */

/**
 * Trigger Instalable: appOnEdit
 * (Se renombró de 'onEdit' para evitar que se ejecute dos veces, una vez configurado el Instalable).
 * Se ejecuta al modificarse cualquier celda en la planilla (requiere configuración manual en Triggers).
 * 
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e Objeto del evento
 */
function appOnEdit(e) {
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
        const isMultiCell = range.getNumRows() > 1 || range.getNumColumns() > 1;

        if (isMultiCell) {
            // No podemos revertir con exactitud múltiples celdas si tenían datos previos. 
            // Sugerimos al usuario hacer Ctrl+Z con una alerta intrusiva y visible.
            const ui = SpreadsheetApp.getUi();
            // Intentar mostrar diálogo HTML personalizado con diseño institucional (rojo, tipografía correcta).
            // NOTA: Requiere que onEdit sea un disparador instalable. En trigger simple fallará e irá al catch.
            try {
                const htmlOutput = HtmlService.createHtmlOutput(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;600&display=swap" rel="stylesheet">
                        <style>
                            body { font-family: 'League Spartan', sans-serif; background-color: #fdf2f2; padding: 20px; color: #2d3748; }
                            .alert-container { border-left: 4px solid #dc3545; padding-left: 15px; }
                            h2 { color: #dc3545; margin-top: 0; font-weight: 600; }
                            p { font-size: 14px; line-height: 1.5; }
                            .highlight { background-color: #fce8e8; padding: 2px 6px; border-radius: 4px; font-weight: 600; color: #dc3545; }
                            /* Botón simulado para consistencia visual, aunque el modal debe cerrarse con la X nativa */
                            .btn-close { display: inline-block; margin-top: 15px; padding: 8px 16px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-family: 'League Spartan', sans-serif; font-weight: 600; text-align: center; width: 100%; box-sizing: border-box; }
                        </style>
                    </head>
                    <body>
                        <div class="alert-container">
                            <h2>Edición Múltiple Bloqueada</h2>
                            <p>El sistema de seguridad ha detectado la alteración de múltiples celdas en el Plan de Cuentas.</p>
                            <p>Para proteger la integridad de la base de datos, el sistema no puede restaurar esto masivamente de forma automática.</p>
                            <p>Si esto fue un accidente, por favor cierra esta ventana e inmediatamente presiona <span class="highlight">Ctrl + Z</span> (Deshacer) en tu teclado.</p>
                            <button class="btn-close" onclick="google.script.host.close()">Entendido</button>
                        </div>
                    </body>
                    </html>
                `).setWidth(450).setHeight(340);
                
                ui.showModalDialog(htmlOutput, 'Alerta de Seguridad Crítica');
            } catch (error) {
                // Fallback a alert limpio nativo (sin emojis) si se ejecuta desde el OnEdit simple
                ui.alert(
                    'Edición Múltiple Detectada',
                    'El sistema de protección detectó que borraste o modificaste múltiples celdas a la vez en el Plan de Cuentas.\n\nAl no poder restaurarlas automáticamente, te solicitamos que presiones "Aceptar" e inmediatamente uses Ctrl+Z (Deshacer) en tu teclado si esto fue un accidente.',
                    ui.ButtonSet.OK
                );
            }
        } else {
            if (e.oldValue !== undefined) {
                range.setValue(e.oldValue);
            } else {
                range.clearContent();
            }
            e.source.toast(
                'Bloqueado. Para proteger tus métricas, ingresá desde la acción rápida > Gestionar Cuentas.',
                'Edición Directa Bloqueada',
                6
            );
        }
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
    
    const estadoStr = isCurrentlyProtected ? 'ACTIVADA' : 'DESACTIVADA';
    
    const response = ui.alert(
        'Configuración de Protección',
        `La protección de la hoja "Plan de Cuentas" actualmente se encuentra:\n\n[ ${estadoStr} ]\n\n¿Deseás cambiar este estado?`,
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        if (isCurrentlyProtected) {
            props.setProperty('PC_PROTECTION_ENABLED', 'false');
            ui.alert(
                'Protección Desactivada',
                'Ahora podés editar el Plan de Cuentas libremente en la grilla sin que el sistema revierta tus cambios.\n\nRECORDÁ reactivarla cuando termines para evitar daños accidentales a la base de datos.',
                ui.ButtonSet.OK
            );
        } else {
            props.setProperty('PC_PROTECTION_ENABLED', 'true');
            ui.alert(
                'Protección Activada',
                'La hoja Plan de Cuentas vuelve a estar blindada contra ediciones manuales accidentales.',
                ui.ButtonSet.OK
            );
        }
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
