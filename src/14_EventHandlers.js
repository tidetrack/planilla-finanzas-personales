/**
 * 14_EventHandlers.js
 * Módulo centralizado para el ruteo de eventos simples de Apps Script (onEdit, onOpen, etc.)
 *
 * [CONCEPTO DE NEGOCIO]
 * Capa de eventos de la planilla: blinda el Plan de Cuentas contra la edicion directa y
 * autocompleta fecha y moneda en la grilla de Cargas mientras el usuario tipea.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Ninguna de las dos hojas que toca este modulo migro de layout. Plan de Cuentas mantiene
 * su header en la fila 3 (HEADER_ROW) y Cargas el suyo en la fila 4 con datos desde la 5
 * (RANGES.CARGAS). La guardia de Cargas usa RANGES.CARGAS.dataRow y no DATA_START_ROW: ese
 * default vale para el Plan de Cuentas (4) y dejaba la fila de encabezado de Cargas dentro
 * del area de autocompletado.
 *
 * @see 00_Config.js (SHEETS, NAV_CONFIG, HEADER_ROW, RANGES.CARGAS)
 *
 * @version 0.63.1
 * @since 0.1.0
 * @lastModified 2026-08-29
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
            // Intentar mostrar diálogo HTML personalizado con el lenguaje Corriente.
            // NOTA: Requiere que onEdit sea un disparador instalable. En trigger simple fallará e irá al catch.
            //
            // decision Franco 2026-08-29: esta pantalla se restilea a Corriente (Poppins, par
            // rojo de FUNCION #B23B32/#FCEAE7 de la lista blanca del brandbook, titulo del
            // dialogo en blanco como el shell) pero CONSERVA su geometria propia 450x340: es
            // la UNICA excepcion a SHELL_GEOMETRIA (900x700) en todo el sistema. Motivo: no es
            // una pantalla de flujo sino una interrupcion de emergencia disparada por un
            // trigger sobre una edicion accidental. Abrirla del tamano del Centro de
            // Operaciones la haria leer como una pantalla mas donde hay que hacer algo, cuando
            // lo unico que pide es cerrar y hacer Ctrl+Z. Queda whitelisteada, comentada, en
            // el assert DIMENSIONES UNICAS de devtools/probar_shell.js.
            try {
                const htmlOutput = HtmlService.createHtmlOutput(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
                        <style>
                            body { font-family: 'Poppins', 'DM Sans', 'Segoe UI', sans-serif; background: #FFFFFF; padding: 22px; color: #1E2A33; margin: 0; }
                            /* Filo COMPLETO de 1px al 15%, no una barra lateral gruesa: es
                               el tratamiento que .alert-error usa en el shell
                               (UI_Shell.html:854-857) y este dialogo tiene que leerse como
                               parte del mismo sistema. El border-left de acento era ademas
                               el unico del proyecto. */
                            .aviso { background: #FCEAE7; box-shadow: inset 0 0 0 1px rgba(178,59,50,.15); border-radius: 14px; padding: 16px 18px; }
                            h2 { color: #B23B32; margin: 0 0 10px; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
                            p { font-size: 13px; line-height: 1.55; color: #44576A; margin: 0 0 10px; }
                            .tecla { background: #FFFFFF; border: 1px solid #B23B32; padding: 1px 7px; border-radius: 6px; font-weight: 600; color: #B23B32; }
                            .btn-close { display: block; margin-top: 16px; padding: 11px 16px; background: #B23B32; color: #FFFFFF; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; text-align: center; width: 100%; box-sizing: border-box; }
                        </style>
                    </head>
                    <body>
                        <div class="aviso">
                            <h2>Edicion multiple bloqueada</h2>
                            <p>Se modificaron varias celdas del Plan de Cuentas a la vez. El sistema no puede restaurarlas de forma automatica.</p>
                            <p>Si fue un accidente: cerra esta ventana y presiona <span class="tecla">Ctrl + Z</span> enseguida.</p>
                            <p>Para cambiar el Plan de Cuentas, entra por el menu tidetrack &gt; Plan de Cuentas.</p>
                            <button class="btn-close" onclick="google.script.host.close()">Entendido</button>
                        </div>
                    </body>
                    </html>
                `).setWidth(450).setHeight(340);

                ui.showModalDialog(htmlOutput, '          ');
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
            // decision Franco 2026-08-29: el toast nombraba "la accion rapida > Gestionar
            // Cuentas", una ruta que no existe: no hay ningun menu llamado "accion rapida", y
            // "Gestionar cuentas" es el rotulo de una TARJETA adentro del Centro de
            // Operaciones, no una entrada de menu. Un aviso que bloquea al usuario y despues
            // lo manda a un lugar inexistente lo deja sin salida. La ruta real y literal es
            // la entrada de MENU_CONFIG. @see 00_Config.js (MENU_CONFIG, 'Plan de Cuentas')
            e.source.toast(
                'Bloqueado. Para cambiar el Plan de Cuentas, entra por el menu tidetrack > Plan de Cuentas.',
                'Edicion directa bloqueada',
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

    // Solo actuamos en el área de datos de la grilla (fila 5 en adelante; la 4 es el header).
    // decision Franco 2026-08-13: la fila sale de RANGES.CARGAS.dataRow, no de DATA_START_ROW,
    // que es el default del Plan de Cuentas y dejaba el encabezado de Cargas como editable.
    const cargasCfg = RANGES.CARGAS;
    if (row < cargasCfg.dataRow) return;

    // Ignorar si es una multi-selección/limpieza masiva
    if (range.getNumRows() > 1 || range.getNumColumns() > 1) return;

    const value = e.value;

    // Indices absolutos de la grilla, resueltos desde Config (Cargas no migro: I..O = 9..15)
    const colMonto = columnLetterToIndex(cargasCfg.columns.monto);   // I = 9
    const colMedio = columnLetterToIndex(cargasCfg.columns.medio);   // L = 12
    const colMoneda = columnLetterToIndex(cargasCfg.columns.moneda); // M = 13
    const colFecha = columnLetterToIndex(cargasCfg.columns.fecha);   // N = 14

    // 1. Edición en Columna "Monto" -> Autocompletar Fecha
    if (col === colMonto) {
        if (value) {
            const fechaCell = sheet.getRange(row, colFecha);
            if (!fechaCell.getValue()) {
                // Formatear la fecha actual sin zona horaria confusa para hojas
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                fechaCell.setValue(today);
            }
        }
        return;
    }


    // 3. Edición en Columna "Medio" -> Autocompletar Moneda
    if (col === colMedio) {
        const monedaCell = sheet.getRange(row, colMoneda);
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
