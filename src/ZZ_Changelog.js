/**
 * ============================================
 * REGISTRO DE ACTUALIZACIONES (CHANGELOG)
 * ============================================
 * Historial descendente de cambios sincronizados al entorno Apps Script.
 * (Añadir nuevos registros arriba)
 *
 * [2026-03-21] v0.7.8 - Fix Case Sensitivity en Auto-Sort:
 * - Se detectó que el Auto-Sorting fallaba silenciosamente si la pestaña física se llamaba "Tipos de Cambio" en lugar de "Tipos de cambio". Se aplicó un bypass de casing (`.toLowerCase()`).
 * 
 * ---
 *
 * [2026-03-21] v0.7.7 - Fix Auto-Sort Lag:
 * - Se optimizó el disparador automático de `appendMassive` eliminando el uso asíncrono de `getLastRow()` por un mapeo matemático estricto según la matriz enviada. Garantiza el Z-A de inmediato.
 * 
 * ---
 *
 * [2026-03-21] v0.7.6 - Alerta UI para Protección Multi-celda:
 * - Se reemplazó el Toast pasivo por una alerta UI (`ui.alert()`) intrusiva en la hoja "Plan de Cuentas" cuando se borran/editan múltiples celdas accidentalmente.
 * - Este cambio garantiza que el usuario sea claramente notificado de que debe usar `Ctrl+Z` para recuperar sus datos.
 *
 * ---
 * [2026-03-21] v0.7.5 - Auto-Sort en Tipos de Cambio:
 * - Se le inyectó inteligencia a `appendMassive` para que al apendear hacia cachés `TC_` en la hoja `Tipos de Cambio`, lea la tabla lateral específica y la ordene cronológicamente de la Z a la A por cuenta propia.
 * 
 * ---
 *
 * [2026-03-21] v0.7.4 - Rename Global "Costos" a "Gastos":
 * - Refactorización quirúrgica de constantes, endpoints y strings en frontend y backend (`COSTOS_FIJOS` -> `GASTOS_FIJOS`).
 * - Actualización de las herramientas de deducción en `RegistrosService` y `MigrationEngine`.
 *
 * ---
 *
 * [2026-03-20] v0.7.3 - Fix Dev Toggle Protección Plan Cuentas:
 * - Se corrigió la UX del menú `togglePlanCuentasProtection()` agregando un prompt de confirmación explícito para evitar desactivaciones accidentales.
 * - Se mejoró `handlePlanCuentasEdit()` (onEdit) para detectar ediciones multi-celda y sugerir al usuario el uso de Ctrl+Z dado que Apps Script no provee oldValue para pegados masivos.
 *
 * ---
 *
 * [2026-03-20] v0.7.2 - Recalculador Masivo TC:
 * - Herramienta [Dev] `recalcularTcRegistros()` para aplicar retrospectivamente la lógica base ARS a la hoja Registros.
 * - Ideal para usuarios que ya migraron BD Antigua antes del parche `v0.7.1`.
 *
 * ---
 *
 * [2026-03-20] v0.7.1 - Base Monetaria ARS:
 * - Se invirtió la matemática de Tipos de Cambio. Ahora `TC_ARS` es fijo en 1.0.
 * - `TC_USD` guarda el valor de argentinadatos, y `TC_EUR`/`TC_AUD` triangulan con Frankfurter hacia ARS.
 * - Mayor facilidad estructural para queries (`Value * Exchange Rate = Value in ARS`).
 *
 * ---
 *
 * [2026-03-20] v0.7.0 - Motor de Migración de BD Legacy:
 * - Se introdujo `99_MigrationLogic.js` con soporte para importar bases 2024+.
 * - Identificador y autocompletador de diccionarios faltantes (Cuentas y Medios).
 * - Se extendió `FLOOR_DATE` en `06_RegistrosService.js` y `15_ExchangeRateApi.js` al 01/01/2024.
 *
 * ---
 *
 * [2026-03-20] v0.6.2 - Carga Histórica de TC:
 * - Se añadió la herramienta [Dev] `forzarCargaHistorica()` en `15_ExchangeRateApi.js`.
 * - Permite generar un barrido desde el 01/01/2026 reconstruyendo el historial de las 4 divisas simultáneas con fallback a viernes para fines de semana.
 *
 * ---
 *
 * [2026-03-20] v0.6.1 - Refactor Columnas Cargas y Registros:
 * - Se adaptó `00_Config.js` y `06_RegistrosService.js` para soportar una nueva columna "Tipo de Cuenta" en la DB de Registros.
 * - En la hoja "Cargas", se añadió "Tipo" manualmente y "Tipo de Cuenta" se eliminó (se deduce eficientemente en backend).
 * - Se corrigieron los índices de ordenamiento `sort()` y mapeo en `RANGES.REGISTROS` hasta la columna T. 
 *
 * ---
 *
 * [2026-03-20] v0.6.0 - Sistema de Registros Batch y Arquitectura Multi-Moneda:
 * - Creación de la hoja "Registros" como Data Lake inmutable y "Tipos de Cambio" como caché estructurado.
 * - `06_RegistrosService.js`: Se incorporó `procesarCargas()` para lectura en bloque de `I5:O19`, anexado a `Registros` y ordenamiento inteligente.
 * - `15_ExchangeRateApi.js`: Se añadió fetching de APIs externas con caché temporal en memoria. (DolarApi y Frankfurter) para ARS/USD/EUR/AUD.
 * - El menú de Tidetrack ganó el ítem `🔧 [Dev] Procesar Cargas`.
 *
 * ---
 *
 * [2026-03-20] v0.5.1 - Autocompletado Hoja Cargas:
 * - Se implementó la lógica de autocompletado en `14_EventHandlers.js` para la hoja "Cargas".
 * - El "Tipo" se deduce automáticamente al elegir la "Cuenta" cruzando datos con el Plan de Cuentas.
 * - La "Moneda" se completa automáticamente según el "Medio" seleccionado.
 * - La "Fecha" se autocompleta con el día en curso al ingresar un "Monto".
 *
 * ---
 *
 * [2026-03-20] v0.5.0 - Refactor Arquitectura de Base de Datos Plan de Cuentas:
 * - Se simplificó la captura de datos (ADR): "Moneda" pasa a ser propiedad exclusiva de "Medios Bancarios". Se elimina del ABM para Ingresos y Egresos.
 * - Reasignación de columnas de la BDD (I:J Ingresos, L:M Costos Fijos, O:P Costos Variables, R:T Medios Bancarios, V:W Proyectos).
 * - Adaptación de Frontend y Backend (`getCategoryAccounts`, `saveAbmRecord`) para rutear arreglos dinámicos no simétricos.
 *
 * ---
 *
 * [2026-03-20] v0.4.9 - Optimización de Rendimiento y Ajustes UI en ABM:
 * - Se optimizó drásticamente el guardado (`appendRow` y `getTableData` en `03_SheetManager.js`) empleando una búsqueda inversa (bottom-up), eliminando el cuelgue al guardar registros.
 * - Se corrigió un error JavaScript en `UI_AbmPlanCuentas.html` provocado por la referencia a un elemento HTML eliminado (`groupAbreviacion`).
 * - Se limitaron las monedas disponibles estrictamente a: ARS, USD, AUD, y EUR (como constante en `00_Config.js`).
 * - Se actualizó la etiqueta visual del selector principal a "¿Qué categoría querés gestionar?".
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
 * implementando un class de botón seleccionado (`.btn-selected`) y halos de foco en formulario con color de acento `#b5bfc6`,
 * y estableciendo el fondo principal a `#eff2f9`.
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
 * permitiendo que las etiquetas `<?!= include() ?>` se rendericen y apliquen correctamente el CSS Institucional al Plan de Cuentas.
 *
 * ---
 *
 * [2026-03-17] v0.4.1 - Refactorización de Back-End y Pop-Up de Cuentas:
 * - Se corrigió archivo .claspignore que impedía el push de código local.
 * - Refactorización de `00_Config.js` y `03_SheetManager.js` para dar soporte a 6 nuevas tablas independientes:
 * (Ingresos, Costos Fijos, Costos Variables, Medios_Pago, Monedas y Proyectos).
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
