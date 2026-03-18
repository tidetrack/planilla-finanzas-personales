/**
 * ============================================
 * REGISTRO DE ACTUALIZACIONES (CHANGELOG)
 * ============================================
 * Historial descendente de cambios sincronizados al entorno Apps Script.
 * (Añadir nuevos registros arriba)
 * 
 * ---
 *
 * [2026-03-17] v0.4.8 - Moneda Opcional en ABM Plan de Cuentas:
 * - El campo Moneda en el formulario ya no es obligatorio (ADR-002: Principio de Moneda por Defecto).
 * - Se eliminó el atributo `required` del HTML y la validación `throw` del backend.
 * 
 * ---
 *
 * [2026-03-17] v0.4.7 - Opción 3 (Moneda por Defecto, ADR-002) + Validación de Duplicados:
 * - Se documentó la regla en GUIA_ARQUITECTURA.md (ADR-002) y PRINCIPIOS_DISEÑO.md.
 * - Validación de duplicados en `saveAbmRecord` (11_UIService.js): arroja error limpio si el nombre ya existe en el módulo.
 * - Alerta de error visual integrada en el DOM del pop-up (no más alert() nativos).
 * - Se oculta el errorAlert al cambiar entidad o al reintentar guardado.
 * 
 * ---
 * 
 * [2026-03-17] v0.4.6 - Validación de Duplicados en ABM:
 * - Se agregó una validación en `saveAbmRecord` (11_UIService.js) para evitar la creación de cuentas duplicadas.
 * - Si el usuario intenta registrar el mismo nombre de cuenta en la misma entidad, el sistema arroja error (desde Backend).
 * - Se reemplazó la alerta nativa `alert()` en Frontend por un mensaje de error integrado al diseño (inline UI con SVG y colores semánticos).
 * 
 * ---
 * 
 * [2026-03-17] v0.4.5 - Ajustes de Proporciones y Paleta de Colores en ABM:
 * - Se ajustó el tamaño del modal Plan de Cuentas de 600x650 a 520x620 para mejorar las proporciones y centrar el foco en el formulario.
 * - Se actualizó la paleta de colores institucional en `UI_SharedStyles.html`: oscureciendo los paneles principales a `#34475d`, 
 *   implementando un class de botón seleccionado (`.btn-selected`) y halos de foco en formulario con color de acento `#b5bfc6`,
 *   y estableciendo el fondo principal a `#eff2f9`.
 * 
 * ---
 * 
 * [2026-03-17] v0.4.4 - Mejoras UI_AbmPlanCuentas:
 * - Se reemplazaron las alertas JavaScript nativas de "Guardado Exitoso" por un "Success State" visual e integrado en el DOM, utilizando el Design System y permitiendo continuar agregando o cerrar el modal amigablemente.
 * 
 * ---
 * 
 * [2026-03-17] v0.4.3 - Creación de UI_SharedStyles:
 * - Se agregó el archivo base de CSS `UI_SharedStyles.html` que faltaba en el repositorio.
 * - Esto soluciona la excepción "No se encontró el archivo HTML llamado UI_SharedStyles" al abrir pop-ups.
 * 
 * ---
 * 
 * [2026-03-17] v0.4.2 - Fix de UI Styles en Pop-ups:
 * - Se corrigió `11_UIService.js` para usar `createTemplateFromFile().evaluate()` en lugar de `createHtmlOutputFromFile`, 
 *   permitiendo que las etiquetas `<?!= include() ?>` se rendericen y apliquen correctamente el CSS Institucional al Plan de Cuentas.
 * 
 * ---
 * 
 * [2026-03-17] v0.4.1 - Refactorización de Back-End y Pop-Up de Cuentas:
 * - Se corrigió archivo .claspignore que impedía el push de código local.
 * - Refactorización de `00_Config.js` y `03_SheetManager.js` para dar soporte a 6 nuevas tablas independientes:
 *   (Ingresos, Costos Fijos, Costos Variables, Medios_Pago, Monedas y Proyectos).
 * - Creación de `UI_AbmPlanCuentas.html`: Pop-Up interactivo Multi-ABM con lógica de UI Router (mostrar/ocultar campos dinámicamente).
 * - Inyección de endpoints de lectura/escritura en `11_UIService.js` para conectar el HTML con las hojas de cálculo.
 * - Modificación de `12_MenuService.js` para incluir el botón de acceso en el submenú de Tidetrack.
 * 
 * ---
 * 
 * [2026-03-17] v0.4.0 - Configuración Inicial del Repo Local:
 * - El proyecto migró de formato web a código local mediante Clasp y Node.
 * - Se conectó el proyecto con GitHub mediante un Watcher automático (github-autopilot).
 */
