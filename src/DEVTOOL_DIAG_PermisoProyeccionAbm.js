/**
 * DEVTOOL_DIAG_PermisoProyeccionAbm.js
 * DIAGNOSTICO TEMPORAL -- mide el PERMISSION_DENIED que tira el modal "Proyecciones Elaboradas"
 * (UI_AbmProyeccionElaborada.html, v0.54.0) al abrir. SE BORRA DESPUES DE MEDIR (este archivo
 * entero, mas su entrada de MENU_CONFIG) -- mismo patron que DEVTOOL_DIAG_Desplegables.js /
 * DEVTOOL_DIAG_CursivaFaltante.js (ya retirado, ver commit 1390bc2).
 *
 * [CONCEPTO DE NEGOCIO]
 * El modal abre bien -- titulo, subtitulo y el banner que redirige a "Guardar Proyeccion" se ven
 * correctos, todo HTML estatico -- pero el listado (la UNICA llamada al servidor que dispara este
 * modal al cargar, `document.addEventListener('DOMContentLoaded', cargarListado)` en
 * UI_AbmProyeccionElaborada.html, que llama `google.script.run...listarPeriodosProyeccion()`)
 * falla siempre con: "Se produjo un error en el servidor al leer desde el almacenamiento. Codigo
 * de error PERMISSION_DENIED." Es reproducible (recargar la pagina entera da el mismo error).
 *
 * LO YA DESCARTADO leyendo el codigo (no repetir sin verificar de nuevo):
 *   - `listarPeriodosProyeccion()` -> `_preflightPb(ss)` -> `_leerTodasFilasPa(hoja)` es puro
 *     `SpreadsheetApp` (00_Config.js/_resolverNombreHoja, DEVTOOL_PresupuestoBase.js/_preflightPb,
 *     DEVTOOL_ProyeccionAbm.js/_leerTodasFilasPa): NINGUNA de las tres toca `PropertiesService`.
 *     Y sin embargo el mensaje dice "almacenamiento", que es el string tipico de esa API -- la
 *     contradiccion es la pista principal, sin resolver solo leyendo.
 *   - `UI_AbmProyeccionElaborada.html` dispara UNA SOLA llamada al servidor al abrir
 *     (`listarPeriodosProyeccion()`, revisado linea por linea: `detalleFilasPeriodoProyeccion`
 *     solo se dispara al abrir una tarjeta de periodo, y `abiertos` arranca vacio). No hay una
 *     segunda llamada escondida que sea la que realmente falla.
 *   - Los MISMOS datos (misma hoja "Proyeccion") se leen bien desde el menu: `estadoGuardarProyeccion`
 *     (tidetrack Dev) corrio hace un rato y reporto periodo, filas y cotizaciones sin problema.
 *   - La planilla es propiedad de start.tidetrack@gmail.com pero Franco la usa logueado como
 *     francodiazpizarro@gmail.com; abrir el proyecto de Apps Script como ese usuario da "No se
 *     pudo abrir el archivo en este momento" con `authuser=3` -- evidencia de que el navegador
 *     tiene varias cuentas de Google activas y que, para ESTE contenedor, se resuelve a una
 *     cuenta sin acceso en al menos un flujo. Hipotesis de trabajo, NO confirmada: un menu
 *     (`SpreadsheetApp.getUi().addItem`) ejecuta la funcion server-side DIRECTO, en el mismo
 *     canal ya autenticado de la pestana de Sheets; un modal HtmlService corre en un iframe de
 *     `googleusercontent.com` que negocia SU PROPIO canal `google.script.run` hacia
 *     script.google.com, y en un navegador multi-cuenta ese segundo canal puede resolver el
 *     `authuser` equivocado -- uno sin permiso sobre ESTE archivo -- incluso con la MISMA sesion
 *     que ya esta usando la hoja sin problema. Esto explicaria por que el mismo codigo, mismos
 *     datos, mismo usuario "logico", funciona desde el menu y no desde el modal.
 *
 * Esta herramienta NO puede reproducir la llamada real que falla (esa es un
 * `google.script.run` disparado desde el navegador dentro del iframe del modal; un item de menu
 * jamas pasa por ese canal, corre server-side directo). Lo que SI hace: correr
 * `listarPeriodosProyeccion()` como funcion directa (mismo camino de codigo, canal distinto) para
 * separar "el dato/la funcion estan rotos" de "el canal google.script.run es el problema" -- si
 * esto sale VERDE, es evidencia a favor de la hipotesis de canal/cuenta, no en contra de que haya
 * que seguir buscando ahi. Reporta ademas identidad (`Session.getEffectiveUser/getActiveUser`),
 * si `PropertiesService` responde, y el `getLastRow()` crudo de "Proyeccion" -- ninguno de los
 * tres deberia importarle a este camino de lectura, pero medirlos cuesta una linea cada uno y
 * descarta sin ambiguedad.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Solo lectura, cero escrituras -- ni siquiera a una hoja temporal de volcado (a diferencia de
 * DEVTOOL_DIAG_Desplegables.js / DEVTOOL_DIAG_CursivaFaltante.js, que si escriben una hoja porque
 * su payload es tabular y grande; esto es un punado de strings cortos, entra en un alert()).
 * Salida por `Logger.log` (Ejecuciones, texto completo, incluido el stack) y `SpreadsheetApp.getUi().alert()`
 * (resumen, recortado si hace falta). Arnes Tidetrack seccion 6, regla de decisiones inline: cada
 * paso de este diagnostico va en try/catch PROPIO, para que un solo paso que falle (por ejemplo
 * `Session.getActiveUser()` sin permiso) no tape la lectura de los demas.
 *
 * [AGREGADO EL MISMO DIA -- TAMANIO DEL PAYLOAD]
 * El paso 5 ahora tambien loguea `JSON.stringify(resultado).length`. Motivo: el sospechoso
 * "la RESPUESTA es demasiado grande para el canal" (crudasFilas, con ~370 filas detras) se puede
 * medir gratis desde ACA -- invocada directo, `listarPeriodosProyeccion()` arma exactamente el
 * mismo objeto que google.script.run tendria que serializar, solo que se queda en el servidor y
 * nunca cruza el canal. Es una linea, y separa "cientos de KB" (el tamanio importa) de "unos pocos
 * KB" (el tamanio no explica nada, hay que seguir mirando el canal).
 *
 * @see src/DEVTOOL_ProyeccionAbm.js (listarPeriodosProyeccion, _leerTodasFilasPa, pingProyeccionAbm)
 * @see src/DEVTOOL_PresupuestoBase.js (_preflightPb)
 * @see src/UI_AbmProyeccionElaborada.html (la unica llamada real que falla, disparada desde el navegador)
 * @see docs/permanente/ARNES_TIDETRACK.md
 *
 * @version 0.1.1 (temporal, no se versiona el sistema por esto -- ver commits chore(diag) previos)
 * @since 2026-08-25
 * @lastModified 2026-08-25
 */

/**
 * Corre los cinco pasos de diagnostico, cada uno con su propio try/catch, y arma el reporte de
 * texto plano. No escribe absolutamente nada en ninguna hoja.
 */
function _DIAG_diagnosticarPermisoProyeccionAbm() {
    const lineas = [];
    const log = function (linea) { lineas.push(linea); Logger.log(linea); };

    log('=== DIAG permiso ABM Proyeccion -- ' + new Date().toISOString() + ' ===');

    // 1. Identidad: quien esta ejecutando esta funcion, en las dos variantes que expone Apps
    // Script. Comparar esto contra lo que se vea corriendo el mismo diagnostico (adaptado) desde
    // el modal es lo que confirmaria o descartaria la hipotesis de cuenta equivocada.
    try {
        log('Session.getEffectiveUser().getEmail(): "' + Session.getEffectiveUser().getEmail() + '"');
    } catch (e) {
        log('Session.getEffectiveUser().getEmail(): ERROR -- ' + e.message);
    }
    try {
        log('Session.getActiveUser().getEmail(): "' + Session.getActiveUser().getEmail() + '"');
    } catch (e) {
        log('Session.getActiveUser().getEmail(): ERROR -- ' + e.message);
    }

    // 2. PropertiesService: el string del error dice "almacenamiento", tipico de esta API, aunque
    // el camino de lectura de listarPeriodosProyeccion no la toca (ver cabecera). Se mide con
    // getKeys(), no con una prop puntual: no hace falta conocer ningun nombre de propiedad ajeno
    // para verificar que el servicio responde.
    try {
        const props = PropertiesService.getDocumentProperties();
        const cantidad = props.getKeys().length;
        log('PropertiesService.getDocumentProperties(): accesible (' + cantidad + ' propiedad(es) guardadas).');
    } catch (e) {
        log('PropertiesService.getDocumentProperties(): ERROR -- ' + e.message);
    }

    // 3. Lectura cruda de la hoja "Proyeccion", SIN pasar por _preflightPb: aisla si el problema
    // (si lo hay desde este canal) esta en llegar a la spreadsheet/hoja en si.
    let ss = null;
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        log('SpreadsheetApp.getActiveSpreadsheet(): OK -- id=' + ss.getId());
        const nombreProy = SHEETS.PROYECCION;
        const hoja = ss.getSheetByName(nombreProy);
        if (!hoja) {
            log('ss.getSheetByName(SHEETS.PROYECCION="' + nombreProy + '"): la hoja NO EXISTE.');
        } else {
            log('hoja "' + hoja.getName() + '".getLastRow(): ' + hoja.getLastRow());
        }
    } catch (e) {
        log('Lectura cruda de "Proyeccion": ERROR -- ' + e.message);
    }

    // 4. _preflightPb(ss) DIRECTO: el mismo chequeo de espejo que usa listarPeriodosProyeccion,
    // aislado del resto (agrupar, totalizar). Si esto ya falla, el problema es leer/comparar
    // encabezados contra "Registros"; si pasa, el problema (si aparece) esta mas adelante.
    if (ss) {
        try {
            const pre = _preflightPb(ss);
            log('_preflightPb(ss): OK -- hoja="' + pre.nombre + '".');
        } catch (e) {
            log('_preflightPb(ss): ERROR -- ' + e.message);
        }
    } else {
        log('_preflightPb(ss): NO SE CORRIO (no hay spreadsheet activa del paso 3).');
    }

    // 5. LA LLAMADA REAL que falla en el modal, pero invocada DIRECTO (funcion a funcion, mismo
    // proceso) en vez de via google.script.run -- ese canal solo existe disparado desde el
    // navegador dentro del iframe del modal, un item de menu jamas pasa por ahi (ver cabecera).
    // Por eso un resultado VERDE aca no cierra el caso: es evidencia a favor de que el problema
    // esta en el canal/la cuenta, no en este codigo.
    try {
        const resultado = listarPeriodosProyeccion();
        log('listarPeriodosProyeccion() invocada DIRECTO (sin pasar por google.script.run): OK -- ' +
            resultado.grupos.guardado.length + ' grupo(s) guardado, ' +
            resultado.grupos.base.length + ' grupo(s) base.');
        // 5b. TAMANIO DEL PAYLOAD -- pedido puntual: separar "el canal esta roto" de "la RESPUESTA
        // de esta funcion es demasiado grande o tiene algo que no serializa" sin escribir todavia
        // ninguna linea de UI. Invocada directo el resultado NUNCA viaja por el canal (se queda en
        // el servidor), asi que este numero es el mismo que veria google.script.run si tuviera que
        // mandarlo -- estimarlo ahora es gratis. Una medicion local con datos mock (7 grupos base,
        // ~370 filas, la misma forma real) dio ~5KB / 123 nodos, contra los 1723 bytes / 85 nodos
        // que el Shell (otra sesion) midio como caso exitoso -- si esta linea confirma ese orden de
        // magnitud en produccion, el tamanio del payload queda descartado como sospechoso.
        const json = JSON.stringify(resultado);
        log('JSON.stringify(listarPeriodosProyeccion()).length: ' + json.length + ' caracteres.');
    } catch (e) {
        log('listarPeriodosProyeccion() invocada DIRECTO: ERROR -- ' + e.message);
        log('stack completo:');
        log(e.stack || '(sin stack disponible)');
    }

    log('=== FIN DIAG ===');
    const resumen = lineas.join('\n');

    // El alert trunca; el texto completo (con el stack, que puede ser largo) siempre queda en
    // Logger.log de arriba, visible en Ejecuciones aunque el alert lo recorte.
    const LIMITE_ALERT = 1800;
    const paraAlert = resumen.length > LIMITE_ALERT
        ? resumen.slice(0, LIMITE_ALERT) + '\n... (recortado -- el texto completo esta en Ejecuciones/Logger.log)'
        : resumen;

    try {
        SpreadsheetApp.getUi().alert('DIAG permiso ABM Proyeccion', paraAlert, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        // Sin UI (por ejemplo corriendo desde el editor): ya quedo todo en Logger.log.
    }

    return { ok: true, detalle: resumen };
}
