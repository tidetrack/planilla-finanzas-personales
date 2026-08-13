# Guía de Módulos - Sistema Apps Script

Documentación detallada de cada módulo del sistema modular de Tidetrack Finanzas Personales.

**Ultima actualizacion**: 2026-06-22
**Version Actual**: v0.9.4

> Esta guia describe el estado REAL del codigo en `src/`. La fuente de verdad de la version es el tope de `src/ZZ_Changelog.js`. A partir de v0.9.4, `01_Version.js` esta sincronizado con la version real del sistema.

---

## Índice de Módulos

| # | Módulo | Capa | Estado |
|---|--------|------|--------|
| 00 | Config | Configuración | Activo |
| 01 | Version | Configuración | Activo (metadata desactualizada) |
| 02 | Utils | Utilidades | Activo |
| 03 | SheetManager | Acceso a Datos | Activo |
| 06 | RegistrosService | Servicios / Lógica | Activo |
| 11 | UIService | Interfaz / ABM | Activo |
| 12 | MenuService | Interfaz | Activo |
| 13 | NavigationService | Interfaz | Activo (parcial) |
| 14 | EventHandlers | Eventos (onEdit) | Activo |
| 15 | ExchangeRateApi | API Externa | Activo |
| 98 | DevTools_Scanner | Herramientas / JSON | Activo |
| 99 | MigrationLogic | Migración / Dev | Activo (transitorio) |

**Archivos HTML UI:**
- UI_AbmPlanCuentas.html - ABM multi-entidad del Plan de Cuentas (Alta, Baja, Modificación)
- UI_SharedStyles.html - Design System compartido (variables CSS y componentes base)

**Manifest:**
- appsscript.json - Configuración OAuth, runtime V8 y zona horaria.

> Nota de numeración: el rango 04, 05, 07, 08, 09, 10 NO existe en el código actual. Los módulos históricos `04_DataValidation`, `05_MonedaService` y servicios planificados (07-10) fueron eliminados o nunca implementados durante la refactorización a Plan de Cuentas centralizado. La guía solo documenta lo que existe hoy.

---

## Arquitectura por Capas

```
┌─────────────────────────────────────────────────┐
│ CAPA 5: INTERFAZ Y EVENTOS                        │
│ 11_UIService (ABM), 12_MenuService (menú),        │
│ 13_NavigationService, 14_EventHandlers (onEdit)   │
└─────────────────────┬─────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ CAPA 4: SERVICIOS / LÓGICA DE NEGOCIO             │
│ 06_RegistrosService (batch Cargas -> Registros),  │
│ 15_ExchangeRateApi (cotizaciones), 99_Migration   │
└─────────────────────┬─────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ CAPA 2: ACCESO A DATOS                             │
│ 03_SheetManager (CRUD sobre rangos fijos)         │
└─────────────────────┬─────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ CAPA 1: UTILIDADES Y CONFIG                        │
│ 00_Config, 01_Version, 02_Utils                   │
└─────────────────────────────────────────────────┘

Transversal: 98_DevTools_Scanner (auditoría de arquitectura, lee toda la planilla)
```

> Nota: la capa de "Validación" (03 original) ya no existe como módulo separado. La validación se hace inline en los servicios (`11_UIService`, `06_RegistrosService`).

---

## Módulos Detallados

### 00_Config.js - Configuración Global

**Propósito (negocio)**: Almacenar en un único lugar todas las constantes estructurales del sistema, para no hardcodear nombres de hojas ni rangos en el resto del código.

**Responsabilidades:**
- `SHEETS`: nombres de las hojas físicas (`Plan de Cuentas`, `Hoja de Cargas`, `Registros`, `Tipos de cambio`, `BD antigua`).
- `HEADER_ROW` (3) y `DATA_START_ROW` (4): convención de filas de encabezado y datos.
- `RANGES`: mapa de rangos de columnas fijos por tabla logica. A partir de v0.9.4,
  cada entrada incluye `headerRow` y `dataRow` propios (ya no se usan las constantes
  globales `HEADER_ROW`/`DATA_START_ROW` para Registros y TC):
  - Plan de Cuentas: `INGRESOS` (I:J), `GASTOS_FIJOS` (L:M), `GASTOS_VARIABLES` (O:P),
    `MEDIOS_PAGO` (R:T, incluye moneda), `PROYECTOS` (V:W). headerRow=3, dataRow=4.
  - `REGISTROS` (B:M): layout nuevo sin offset. Monto=B, Tipo=C, Cuenta=D, TipoCuenta=E,
    Medio=F, Moneda=G, Fecha=H, Nota=I, ValorARS=J, ValorUSD=K, ValorAUD=L, ValorEUR=M.
    headerRow=5, dataRow=6.
  - Caches de Tipos de Cambio (layout nuevo): `TC_ARS` (B:C), `TC_USD` (E:F),
    `TC_AUD` (H:I), `TC_EUR` (K:L). headerRow=6, dataRow=7.
- `MONEDAS_DISPONIBLES`: catálogo fijo `['ARS', 'USD', 'AUD', 'EUR']` como constante de backend, sin tabla en la planilla (ADR-003).
- `ERROR_MESSAGES`: mensajes de error centralizados.
- `MENU_CONFIG`: definición declarativa del menú "Tidetrack" (ítems y separadores).
- `NAV_CONFIG`: nombres de hojas de navegación (Inicio, Tablero, Cargas, Espacios blancos, DATA-ENTRY) y configuración de toasts.

**Dependencias:** ninguna. Es la base que todos consumen.

**Consumido por:**
- `SheetManager` usa `RANGES` para resolver columnas.
- `UIService` usa `MONEDAS_DISPONIBLES` y la tabla `PROYECTOS`.
- `MenuService` usa `MENU_CONFIG`.
- `EventHandlers` y servicios usan `SHEETS` y `NAV_CONFIG`.

**Regla Crítica:** Si cambian los rangos de columnas, se actualiza SOLO este archivo. No hardcodear rangos en otros módulos.

> Pendiente de verificación: la cabecera del archivo declara `@version 0.1.0`, desactualizada respecto a la versión real del sistema.

---

### 01_Version.js - Control de Versiones (metadata)

**Propósito (negocio)**: Conservar metadata de versión y un changelog embebido accesible desde código.

**Funciones clave:**
- `getVersion()`: retorna el string de versión desde el objeto `VERSION`.
- `getChangelog()`: retorna el changelog embebido.
- `logVersionInfo()`: imprime versión, release y fecha en el log.

**Estado:** Activo pero DESACTUALIZADO. El objeto `VERSION` declara internamente `0.1.0` (Sprint 0) y un changelog viejo. La fuente de verdad operativa del versionado pasó a `src/ZZ_Changelog.js` (hoy v0.8.0). Sincronizar este módulo es una tarea pendiente.

**Dependencias:** ninguna.

---

### 02_Utils.js - Utilidades Generales

**Propósito (negocio)**: Funciones helper transversales de logging.

**Funciones reales (actuales):**
- `logError(message, context = {})`: log de error con contexto opcional en JSON.
- `logInfo(message)`: log informativo.
- `logSuccess(message)`: log de éxito.

> Estado real: el módulo hoy SOLO contiene helpers de logging. Las utilidades históricas que esta guía describía antes (`generateId`, `formatDate`, `validateEnum`, `showToast`, etc.) ya no están en este archivo. La función de formateo de fecha que el sistema usa hoy (`formatDateISO`) vive en `06_RegistrosService.js`, no acá.

**Dependencias:** ninguna (usa `Logger` nativo de Apps Script).

**Consumido por:** prácticamente todos los servicios para registrar eventos.

---

### 03_SheetManager.js - Gestor de Acceso a Hojas

**Propósito (negocio)**: Abstraer las operaciones CRUD sobre Google Sheets, para que los servicios no conozcan detalles de rangos de columnas.

**Funciones públicas:**
- `getSheet(sheetName)`: obtiene la hoja por nombre o lanza error si no existe.
- `getTableRange(tableName)`: devuelve el `Range` de una tabla lógica según `RANGES`, protegido ante hojas vacías.
- `getTableData(tableName)`: devuelve los datos como array de arrays, filtrando filas totalmente vacías.
- `countTableRows(tableName)`: cuenta filas con datos.
- `appendRow(tableName, rowData)`: agrega una fila al final, usando búsqueda inversa (bottom-up) sobre la primera columna de la tabla para hallar el final de forma eficiente. Aplica padding de columnas.
- `updateRow(tableName, rowIndex, rowData)`: actualiza una fila por índice relativo a `DATA_START_ROW`.
- `deleteRow(tableName, rowIndex)`: elimina una fila de forma aislada (splice + reescritura) para no afectar columnas vecinas de tablas adyacentes en la misma hoja.
- `columnLetterToIndex(columnLetter)`: convierte letra de columna (ej. 'B', 'AD') a índice 1-based.

**Dependencias:** `00_Config` (`RANGES`, `DATA_START_ROW`), `02_Utils` (logging).

**Regla Crítica:** todos los servicios deben operar a través de `SheetManager`, nunca acceder directamente a `getRange()`/`getValues()` (excepto utilidades de muy bajo nivel que lo justifican, como `98_DevTools_Scanner` y `99_MigrationLogic`).

---

### 06_RegistrosService.js - Procesamiento Batch de Cargas

**Propósito (negocio)**: Transformar el lote de la hoja "Cargas" (entrada manual del usuario) en filas enriquecidas de la hoja "Registros", que funciona como Data Lake inmutable multi-moneda. Es el corazón del flujo de carga de movimientos.

**Funciones clave:**
- `procesarCargas()`: funcion maestra invocada desde el menu [Dev].
  - Lee el rango `I5:O19` de "Cargas".
  - Filtra filas con intencion de carga (Monto, Cuenta, Medio o Moneda no vacios).
  - Precarga caches de TC (`TC_USD`, `TC_AUD`, `TC_EUR`) y catalogos de categorias para
    deducir el "Tipo de Cuenta" (Ingreso / Gasto Fijo / Gasto Variable) cruzando con Plan de Cuentas.
  - Fija fecha minima (`FLOOR_DATE` = 2024-01-01); si falta o es invalida usa fecha actual.
  - ARS es base (TC_ARS = 1.0); para fechas sin cache llama a `fetchArsRate` y
    `fetchInternationalRates` (modulo 15) y triangula AUD/EUR.
  - Apendea los nuevos TC a "Tipos de cambio" (bloques B/E/H/K) y los registros a
    "Registros" (B:M) via `appendMassive`.
  - Ordena "Registros" descendentemente por fecha (columna H) y limpia la grilla de Cargas.
- `formatDateISO(dateObj)`: devuelve 'YYYY-MM-DD' neutral a zona horaria. Helper compartido usado por varios módulos (15 y 99).
- `appendMassive(tableName, data2D, minRow)`: inserción masiva eficiente. Encuentra el final de la columna sin depender de `getLastRow()` (evita lag asíncrono). Para tablas `TC_*` en la hoja de Tipos de Cambio aplica auto-sort cronológico Z-A in situ (con bypass de casing vía `toLowerCase()`).

**Dependencias:** `00_Config` (`RANGES`, `SHEETS`, `NAV_CONFIG`), `03_SheetManager` (`getTableData`, `columnLetterToIndex`), `15_ExchangeRateApi` (`fetchArsRate`, `fetchInternationalRates`), `02_Utils` (logging).

---

### 11_UIService.js - ABM del Plan de Cuentas (HTML Service)

**Propósito (negocio)**: Exponer el backend del gestor visual (Alta, Baja, Modificación) del Plan de Cuentas, evitando que el usuario edite la grilla a mano.

**Funciones clave (endpoints `google.script.run`):**
- `include(filename)`: incrusta HTML parcial (CSS/JS) en un template.
- `showAbmPlanCuentas()`: abre el modal `UI_AbmPlanCuentas` (520x750).
- `getAbmFormData()`: devuelve monedas (desde `MONEDAS_DISPONIBLES`) y proyectos (desde tabla `PROYECTOS`) para poblar los selects.
- `saveAbmRecord(payload)`: alta de un registro. Valida nombre obligatorio y duplicados (case-insensitive). Rutea el shape de la fila según `entityType` (INGRESOS / GASTOS_FIJOS / GASTOS_VARIABLES llevan nombre + proyecto; MEDIOS_PAGO lleva nombre + moneda + proyecto; PROYECTOS lleva nombre + tipo).
- `getCategoryAccounts(entityType)`: lista las cuentas de una categoría para el selector de modificación, devolviendo nombre, moneda, proyecto y tipo según corresponda.
- `updateAbmRecord(payload)`: actualiza un registro por `rowIndex`, validando duplicados excluyendo el propio registro.
- `deleteAbmRecord(payload)`: elimina un registro por `rowIndex`.

**Dependencias:** `00_Config` (`MONEDAS_DISPONIBLES`), `03_SheetManager` (`getTableData`, `appendRow`, `updateRow`, `deleteRow`), `HtmlService`. La validación es inline (no hay módulo de validación separado).

**Frontend asociado:** `UI_AbmPlanCuentas.html`.

> Pendiente de verificación: la cabecera declara `@version 0.4.0` / `@lastModified 2026-01-18`, desactualizada respecto a los cambios posteriores (refactor de columnas, rename Costos a Gastos).

---

### 12_MenuService.js - Menú Personalizado

**Propósito (negocio)**: Construir el menú "Tidetrack" en la barra de Google Sheets al abrir la planilla.

**Funciones clave:**
- `onOpen()`: trigger automático de apertura; delega en `createCustomMenu()`.
- `createCustomMenu()`: construye el menú dinámicamente recorriendo `MENU_CONFIG.ITEMS` (ítems y separadores), con fallback ante config ausente.

**Ítems del menú (vía `MENU_CONFIG` en 00_Config):** Gestor Plan de Cuentas, Procesar Cargas, Forzar Carga Histórica TC, Analizar BD Antigua, Migrar BD Antigua, Recalcular TC en Registros, On/Off Protección Cuentas, Exportar Arquitectura (DevTools).

**Dependencias:** `00_Config` (`MENU_CONFIG`). Las funciones invocadas viven en los módulos 06, 11, 14, 15, 98 y 99.

---

### 13_NavigationService.js - Navegación entre Hojas

**Propósito (negocio)**: Permitir saltar entre hojas de la planilla desde botones, con feedback visual (toast).

**Funciones clave:**
- `navigateToInicio()`, `navigateToTablero()`, `navigateToCargas()`, `navigateToEspacioBlanco1/2/3()`, `navigateToDataEntry()`: atajos que delegan en el auxiliar.
- `navigateToSheet(sheetName)`: auxiliar que activa la hoja, valida existencia con alerta de error y muestra toast si está habilitado en `NAV_CONFIG`.

**Estado (parcial):** las funciones de "Acciones Rápidas" (quick actions de transacciones/cuentas/medios) fueron purgadas durante la refactorización a Plan de Cuentas centralizado; los botones de Sheets que apuntaban a ellas fallarían hasta ser reasignados. Solo la navegación entre hojas está activa.

**Dependencias:** `00_Config` (`NAV_CONFIG`), `02_Utils` (logging).

> Pendiente de verificación: `navigateToSheet` invoca `logError`/`logInfo` con dos argumentos (etiqueta y mensaje), pero las firmas reales en `02_Utils` reciben distinto formato. El logging puede no mostrarse como se espera.

---

### 14_EventHandlers.js - Ruteo de Eventos (onEdit)

**Propósito (negocio)**: Centralizar la reacción a ediciones de celdas para (a) proteger el Plan de Cuentas de ediciones manuales y (b) autocompletar la hoja de Cargas.

**Funciones clave:**
- `appOnEdit(e)`: trigger INSTALABLE (renombrado de `onEdit` para evitar doble ejecución). Rutea según la hoja activa a `handlePlanCuentasEdit` o `handleCargasEdit`.
- `handlePlanCuentasEdit(e)`: si la protección está activa (propiedad de documento `PC_PROTECTION_ENABLED`), revierte ediciones individuales con `e.oldValue` o las limpia; ante ediciones multi-celda (que GAS no puede revertir nativamente) muestra una alerta HTML institucional sugiriendo Ctrl+Z, con fallback a `ui.alert()` si corre como trigger simple.
- `togglePlanCuentasProtection()`: alterna la bandera de protección con confirmación explícita (YES/NO).
- `handleCargasEdit(e)`: autocompletado en "Cargas":
  - Columna Monto (I=9): autocompleta Fecha (col 14) con el día actual si está vacía.
  - Columna Medio (L=12): autocompleta Moneda (col 13) cruzando con `MEDIOS_PAGO`; limpia si se borra el medio.

> Pendiente de verificación: el autocompletado de "Tipo" al elegir "Cuenta" (mencionado en el changelog v0.5.1) NO aparece como bloque activo en `handleCargasEdit` (el caso entre Monto y Medio está comentado/ausente). El tipo de cuenta hoy se deduce en backend al procesar cargas (módulo 06).

**Dependencias:** `00_Config` (`SHEETS`, `NAV_CONFIG`, `HEADER_ROW`, `DATA_START_ROW`), `03_SheetManager` (`getTableData`), `PropertiesService`, `HtmlService`.

---

### 15_ExchangeRateApi.js - Cliente de Cotizaciones

**Propósito (negocio)**: Obtener cotizaciones históricas y en tiempo real para valuar movimientos en moneda extranjera, con ARS como base.

**Funciones clave:**
- `fetchArsRate(dateString)`: cotización del dólar oficial (venta) para una fecha, vía argentinadatos. Usa caché en memoria (`cachedArsData`) ordenado por fecha; aplica fallback a la cotización disponible más cercana hacia atrás, con hardcode de seguridad (1000) ante falla extrema.
- `fetchInternationalRates(dateString)`: cotizaciones cruzadas EUR y AUD respecto a USD vía Frankfurter (resuelve fin de semana al último día hábil).
- `forzarCargaHistorica()`: herramienta [Dev] que reconstruye el histórico desde 2024-01-01 hasta hoy para las 4 divisas; usa Frankfurter en modo rango con fallback de hasta 7 días hacia atrás, limpia y reescribe los cachés TC.
- Custom Functions invocables desde celdas: `TIDETRACK_USD()`, `TIDETRACK_EUR()`, `TIDETRACK_AUD()` (cotización de hoy triangulada a ARS).

**Modelo de TC (decisión vigente):** ARS es base fija (TC_ARS = 1.0); TC_USD guarda el oficial argentino; TC_EUR y TC_AUD se triangulan vía Frankfurter hacia ARS. Regla operativa: `Valor * Tipo de Cambio = Valor en ARS`.

**Dependencias:** `UrlFetchApp`, `06_RegistrosService` (`formatDateISO`, `appendMassive`), `00_Config` (`SHEETS`), `02_Utils` (logging).

**APIs externas:** argentinadatos (dólar oficial), Frankfurter (cruces EUR/AUD).

---

### 98_DevTools_Scanner.js - Scanner de Arquitectura Total (gemelo digital)

**Propósito (negocio)**: Auditoría interna. Produce el "gemelo digital" de la planilla: un JSON con el 100% de las celdas que tienen valor o fórmula, más la metadata estructural de cada hoja, para que cualquier sesión (humana o IA) sepa qué hay en cada celda sin abrir la planilla. Es la pieza 1 de la Fase 2 del arnés ("Infrastructure as Code": el estado vivo se congela en un artefacto versionable y todo cambio posterior se prueba por diff celda por celda).

**Funciones clave:**
- `exportarArquitecturaTotal()`: itera `ss.getSheets()` — no hardcodea nombres de hoja, así que descubre hojas nuevas, renombradas u ocultas por sí mismo. Por cada hoja hace **siete extracciones masivas** (`getFormulas`, `getValues`, `getDisplayValues`, `getBackgrounds`, `getFontColors`, `getFontWeights`, `getFontSizes`), nunca una llamada por celda, y arma `meta` + `encabezados` + `mapa_celdas`. Serializa a `TIDETRACK_ARQUITECTURA_ESTRICTA.json`, manda a la papelera las versiones previas y crea el archivo en la raíz de Drive; loguea ID de Drive, URL, peso, cantidad de celdas y duración.
- `_refA1(fila, col)`: notación A1 calculada en memoria. Reemplaza a `getRange(r, c).getA1Notation()`, que costaba un round-trip por celda y hacía inviable la cobertura total.
- `_toastScanner(ss, mensaje, segundos)`: toast defensivo (el scanner también corre desde el editor, donde no hay UI).

**Cobertura (v0.8.4)**: total. Se mapea **toda** celda con valor o fórmula, sin el filtro histórico de "fórmulas y primeras 5 filas" que dejaba ciegas a las BDs (del ledger de Registros, ~2879 filas, el snapshot de 2026-03-23 trajo 44 celdas). Para compensar el tamaño: el estilo se serializa solo cuando difiere del default de Sheets, y la notación A1 se calcula en memoria. Queda **fuera** del alcance de "total" la celda que solo tiene estilo y ningún contenido (la hoja PALETAS es literalmente eso).

**Contrato de celda (v0.8.4)** — lo que asume todo consumidor del JSON:

| Campo | Contenido |
|---|---|
| `valor` | Valor crudo si la celda NO tiene fórmula; `null` si la tiene. |
| `formula` | String de la fórmula, o `null`. |
| `valor_mostrado` | Texto tal como se ve en pantalla. **Siempre** en celdas con fórmula (incluso vacío); en celdas sin fórmula, solo cuando difiere del valor crudo, es decir cuando el formato aporta algo (fecha localizada, moneda, porcentaje). Es el único lugar donde viven los errores de runtime: `#REF!`, `#N/A`, `#DIV/0!`, `#VALUE!`. |
| `estilo` | Opcional: `fondo`, `texto`, `negrita`, `tamano`, solo si difieren del default. |

**Meta por hoja**: `gid` (identidad estable ante renombres, `getSheetId()`), `indice`, `filas_totales`, `columnas_totales`, `filas_congeladas`, `columnas_congeladas`, `es_oculta`, `reglas_condicionales_qty`, `celdas_con_dato`. El `gid` es lo que permite al diff distinguir "hoja renombrada" de "hoja borrada + hoja nueva", y salda el "GID pendiente de re-mapeo" de `MAPA_HOJAS.md`. `encabezados` es la fila 1 cruda: **no** es el header semántico (en esta planilla los headers reales viven más abajo — Registros fila 2, Plan de Cuentas fila 3, Cargas fila 4) y lo declara `00_Config.js`, no el scanner.

**Compatibilidad hacia atrás**: el snapshot de marzo 2026 fue generado por el scanner viejo y **no tiene** `valor_mostrado` ni `gid`. Todo consumidor (generadores de TSV, diff de no-daño) debe degradar limpiamente cuando esos campos faltan, nunca asumirlos presentes.

**Limitaciones conocidas**: el volcado no trae las validaciones de datos (habría que sumar `getDataValidations` como dimensión masiva propia); no trae el **tipado** del error (el `#N/A` llega como texto en `valor_mostrado`, no como `errorValue`, así que el análisis es por cadena y no distingue un error real de una celda que contiene ese texto); y las celdas de spill de `ARRAYFORMULA` se serializan como valores literales, porque `getFormulas()` devuelve `''` en ellas (afecta al bloque "Categorias" de Plan de Cuentas).

**Contrato de nombre**: `MENU_CONFIG` (`00_Config.js`) invoca la función por su nombre exacto (`[DevTools] Exportar Arquitectura` -> `exportarArquitecturaTotal`). No renombrarla sin actualizar `MENU_CONFIG` en el mismo commit.

**Riesgo de tiempo de ejecución**: Apps Script corta a los 6 minutos. La estimación es que entra (siete llamadas masivas por hoja, el resto CPU en memoria, sobre ~275.000 celdas de grilla según el snapshot de marzo 2026), pero **está sin verificar contra Sheets**: la primera corrida real es la que decide. Si se corta, el log de progreso por hoja dice hasta dónde llegó.

**Dependencias:** `SpreadsheetApp`, `DriveApp`. Requiere scope de Drive (ver `appsscript.json`). Loguea con `console.log` en vez de `logInfo`/`logSuccess` de `02_Utils.js`: desvío deliberado y comentado inline, porque esos helpers arrastran un carácter no-ASCII huérfano (variation selector en `02_Utils.js`) y este módulo debe quedar 100% ASCII. Se vuelve a la convención cuando `02_Utils.js` se limpie en su propia pieza.

---

### 99_MigrationLogic.js - Migración de BD Legacy

**Propósito (negocio)**: Utilidades transitorias/dev para importar la base histórica "BD antigua" (2024+) hacia el esquema actual de "Registros".

**Funciones clave:**
- `analizarBdAntigua()`: detecta cuentas y medios faltantes comparando "BD antigua" contra
  el Plan de Cuentas; lista las cuentas faltantes en la columna H de "BD antigua" y
  auto-inserta los medios faltantes en `MEDIOS_PAGO` con moneda ARS por defecto.
- `migrarBdAntigua()`: migra fila por fila a "Registros" (asume que `forzarCargaHistorica()`
  ya corrio). Deduce tipo de cuenta, resuelve moneda por medio, interpola TC desde el cache
  (con fallbacks hardcodeados si falta), apendea masivamente y ordena por fecha.
  Reporta cuantos registros usaron fallback.
- `migrarLegacyANuevaProduccion()` (v0.9.4): copia datos de `Registros_legacy` (layout I:T,
  headerFila2) y `Tipos de cambio_legacy` (bloques I:J/L:M/O:P/R:S, headerFila3) al layout
  nuevo de produccion (Registros B:M, TC bloques B/E/H/K). Idempotente: no duplica registros
  ya existentes. Nueva entrada de menu [Dev] "Migrar Legacy a Nueva Produccion".
- `recalcularTcRegistros()`: herramienta [Dev] que reescribe las columnas TC de "Registros"
  interpolando el cache actual en modo ARS base, para registros migrados antes del parche
  de base ARS.

**Estado:** transitorio/dev (uso puntual de migración, no del flujo cotidiano).

**Dependencias:** `00_Config` (`SHEETS`), `03_SheetManager` (`getTableData`), `06_RegistrosService` (`formatDateISO`, `appendMassive`).

---

## Archivos HTML / UI

### UI_AbmPlanCuentas.html - Modal ABM Multi-entidad

Formulario único que gestiona las 5 entidades del Plan de Cuentas (Ingresos, Gastos Fijos, Gastos Variables, Medios de Pago, Proyectos) con modos CREATE y UPDATE/DELETE. Incluye selector de categoría, selector de cuenta con datalist filtrable, campos dinámicos según entidad, estados de loader/éxito/error y handlers que llaman a los endpoints de `11_UIService` (`getAbmFormData`, `getCategoryAccounts`, `saveAbmRecord`, `updateAbmRecord`, `deleteAbmRecord`). Importa `UI_SharedStyles` vía `include`.

### UI_SharedStyles.html - Design System Compartido

Variables CSS (`:root`) con la paleta institucional (azules `--primary-color` #34475d, semánticos success/danger/warning/info), tipografía, radios, sombras y transiciones; más componentes base (formularios, botones primary/secondary/danger/selected, cards, scrollbar). Se incrusta en los modales mediante `include('UI_SharedStyles')`.

---

## Flujo de Dependencias (real)

```
00_Config ──→ 03_SheetManager ──→ 06_RegistrosService ──→ 15_ExchangeRateApi
    │                │                     │                      │
    │                │                     └──────────────────────┘ (formatDateISO / appendMassive)
    │                ↓
    ├──→ 11_UIService (ABM)        ──→ UI_AbmPlanCuentas.html ──→ UI_SharedStyles.html
    ├──→ 12_MenuService (menú)
    ├──→ 13_NavigationService
    └──→ 14_EventHandlers (onEdit)

99_MigrationLogic depende de 03, 06.
98_DevTools_Scanner es independiente (lee toda la planilla vía SpreadsheetApp/DriveApp).
02_Utils provee logging transversal a todos.
```

**Reglas:**
- Los servicios operan sobre datos vía `03_SheetManager`; las inserciones masivas usan `appendMassive` (06).
- La validación es inline en los servicios (no hay módulo de validación dedicado).
- `formatDateISO` es el helper canónico de fecha, definido en 06 y reusado por 15 y 99.

---

## Convenciones de Código

### Nombrado de Funciones

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| **ABM - Guardar** | `save<Entidad>Record()` | `saveAbmRecord(payload)` |
| **ABM - Actualizar** | `update<Entidad>Record()` | `updateAbmRecord(payload)` |
| **ABM - Eliminar** | `delete<Entidad>Record()` | `deleteAbmRecord(payload)` |
| **Acceso a datos** | `getTable<X>()` / `appendRow()` | `getTableData('INGRESOS')` |
| **Navegación** | `navigateTo<Hoja>()` | `navigateToTablero()` |
| **Handler de evento** | `handle<Contexto>Edit()` | `handleCargasEdit(e)` |
| **Herramienta Dev** | verbo descriptivo | `forzarCargaHistorica()`, `recalcularTcRegistros()` |
| **Custom Function** | `TIDETRACK_<DIVISA>()` | `TIDETRACK_USD()` |
| **Utilidades** | `<verbo><Sustantivo>()` | `formatDateISO()`, `columnLetterToIndex()` |

### Documentación JSDoc

```javascript
/**
 * Descripción breve de la función
 * @param {string} parametro1 Descripción del parámetro
 * @returns {Object} Descripción del retorno
 * @throws {Error} Cuándo lanza error
 */
function miFuncion(parametro1) {
 // ...
}
```

> Nota: varios módulos nuevos (06, 14, 98, 99) no llevan cabecera JSDoc completa con `@version`/`@since`/`@lastModified`. Estandarizar las cabeceras y la regla `contexto-en-codigo.md` (`[CONCEPTO DE NEGOCIO]`) es trabajo pendiente.

---

## Checklist de Implementación de Nuevo Módulo

Cuando crees un nuevo módulo:

1. [ ] Usar número secuencial coherente con la capa (00-03 base, 06+ servicios, 11-14 UI/eventos, 98-99 herramientas/dev).
2. [ ] Incluir header con `[CONCEPTO DE NEGOCIO]` (regla `contexto-en-codigo.md`) y JSDoc por función.
3. [ ] No hardcodear nombres de hojas ni rangos: definirlos en `00_Config`.
4. [ ] Operar sobre la planilla a través de `03_SheetManager` (lectura) y `appendMassive` (escritura batch).
5. [ ] Validar entradas inline antes de escribir; mostrar toast/alert al usuario en operaciones relevantes.
6. [ ] Loggear con `logSuccess()` / `logError()` según corresponda.
7. [ ] Si la función debe aparecer en el menú, agregarla a `MENU_CONFIG.ITEMS` en `00_Config`.
8. [ ] Registrar el cambio en `src/ZZ_Changelog.js` y `docs/permanente/HISTORIAL_DESARROLLO.md` (regla `changelog-obligatorio.md`).
9. [ ] Agregar/actualizar la entrada en esta guía.

---

## Deuda y Pendientes de Verificacion

- `02_Utils.js` arrastra un caracter no-ASCII huerfano (variation selector en `logInfo`, mas el espacio suelto en `logError`/`logSuccess`). Por eso `98_DevTools_Scanner.js` loguea con `console.log`. Limpieza pendiente en pieza propia; ahi se vuelve a la convencion.
- `13_NavigationService` llama a `logError`/`logInfo` con firma de dos argumentos que `02_Utils` no implementa asi.
- Autocompletado de "Tipo" por "Cuenta" en `handleCargasEdit` no esta activo (la deduccion ocurre en backend, modulo 06).
- Numeracion con huecos (04, 05, 07-10 inexistentes) por la refactorizacion a Plan de Cuentas centralizado.
- GIDs de las hojas de produccion pendientes de re-mapeo en `MAPA_HOJAS.md`: desde v0.8.4 el scanner los captura (`meta.gid`), asi que la deuda se salda con la primera corrida completa sobre la planilla viva.
- El scanner no fue corrido todavia contra Sheets: peso del artefacto y duracion siguen estimados, no medidos.

> Nota: el `98_DevTools_Scanner.js` ya no contiene emojis (limpieza hecha en la Fase 2 del arnes).

---

**Version de la Guia**: 5.1
**Ultima actualizacion**: 2026-08-13
**Version del sistema documentada**: v0.9.4 (solo en la historia de git, nunca desplegada). La entrada de `98_DevTools_Scanner.js` esta actualizada a v0.8.4 (Fase 2 del arnes); el resto de las entradas todavia describe el estado de 2026-06-22 y queda pendiente de re-sincronizacion contra el codigo productivo.
**Modulos documentados**: 12 de 12 archivos `.js` existentes + 2 HTML + manifest
