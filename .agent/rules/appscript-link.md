# Criterios de Vinculacion y Salud de Apps Script

Esta regla define los parametros que DEBEN verificarse para considerar que el proyecto de Google Apps Script esta correctamente vinculado al entorno de codigo local.

## Verificaciones Obligatorias

1. **Configuracion de Clasp (`.clasp.json`)**:
   - Debe existir en la raiz del proyecto.
   - Debe contener un `scriptId` valido apuntando al proyecto correcto.
   - El `rootDir` debe estar configurado para apuntar a `src/`.

2. **Manifiesto (`appsscript.json`)**:
   - Debe existir en `src/appsscript.json`.
   - Las scopes requeridas de OAuth (spreadsheets, ui, external_request, drive) y la zona horaria (America/Argentina/Buenos_Aires) deben ser correctas.

3. **Comunicacion Frontend-Backend**:
   - Cualquier intento de invocar funciones en el servidor desde HTML (`google.script.run`) debe coincidir EXACTAMENTE con funciones globales declaradas en los `.js` del backend. Ninguna macro de interfaz debe apuntar a una funcion inexistente.

4. **Configuracion Global (`00_Config.js`)**:
   - Todos los nombres de hojas (`SHEETS.*`) y rangos fijos (`RANGES.*`) declarados deben existir y coincidir en la planilla de Google Sheets asociada. Errores de `Sheet not found` son el principal indicador de que la vinculacion esta rota.
   - NUNCA hardcodear nombres de hoja o letras de columna fuera de `00_Config.js`.

5. **Logica de UI**:
   - Las funciones que sirven HTML (menus custom, modales ABM) deben invocar y evaluar los templates con `HtmlService.createTemplateFromFile` correctamente, previendo la inclusion de los parciales (ej. `UI_SharedStyles.html`).
