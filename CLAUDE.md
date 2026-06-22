# CLAUDE.md - Tidetrack Finanzas Personales

## Identidad del Proyecto

Tidetrack es un sistema de finanzas personales construido sobre Google Sheets + Google Apps Script (GAS). Este repositorio contiene el backend completo (AppScript), la UI embebida (HtmlService), y toda la documentacion tecnica del producto. El objetivo de largo plazo es migrar este sistema a una aplicacion web independiente.

La promesa del producto es "paz financiera, todos los dias". No es una app de contabilidad ni un broker: es una herramienta de habito financiero con estetica limpia, multi-moneda nativa, y vision de plataforma.

## Stack Actual

- **Backend/DB**: Google Sheets (disciplina relacional estricta)
- **Automatizacion**: Google Apps Script (runtime V8)
- **Deploy**: Clasp (npx clasp push / npx clasp push --watch)
- **Timezone**: America/Argentina/Buenos_Aires
- **OAuth Scopes**: spreadsheets, ui, external_request, drive
- **APIs externas**: argentinadatos.com (ARS), frankfurter.app (EUR/AUD)

## Estructura del Repositorio

Fuente de verdad: `docs/permanente/ESTRUCTURA.md`

```
src/                    # Codigo fuente Apps Script (modular, numerado)
docs/permanente/        # Documentacion viva del proyecto
.agent/                 # Ecosistema multi-agente (Antigravity, legacy)
_backup/                # Archivos historicos (SOLO LECTURA, no tocar)
scripts/                # Automatizacion local (auto-sync)
```

### Modulos en src/ (orden de dependencia)

00_Config.js -> Constantes globales, SHEETS, RANGES, MONEDAS_DISPONIBLES, menus
01_Version.js -> Control de version semantica
02_Utils.js -> Logging (logError, logInfo, logSuccess)
03_SheetManager.js -> Capa de acceso a datos (getTableData, appendRow, updateRow, deleteRow)
06_RegistrosService.js -> Pipeline de procesamiento batch (procesarCargas)
11_UIService.js -> Endpoints para google.script.run (ABM forms)
12_MenuService.js -> Menu personalizado "Tidetrack"
13_NavigationService.js -> Navegacion entre hojas con toast
14_EventHandlers.js -> Triggers: appOnEdit (proteccion Plan Cuentas, autocomplete Cargas)
15_ExchangeRateApi.js -> Fetch de cotizaciones + custom functions (TIDETRACK_USD/EUR/AUD)
98_DevTools_Scanner.js -> Exportar JSON de arquitectura completa
99_MigrationLogic.js -> Migracion desde BD antigua
UI_SharedStyles.html -> Design System (neumorphic, League Spartan)
UI_AbmPlanCuentas.html -> ABM multi-entidad Plan de Cuentas
ZZ_Changelog.js -> Historial de versiones in-code

## Esquema de Datos

Las tablas viven en Google Sheets. El layout varia por hoja: ver detalle abajo y en `docs/permanente/MAPA_HOJAS.md`.

### Plan de Cuentas (5 tablas) - SIN CAMBIOS

Headers en fila 3, datos desde fila 4. Offset horizontal de 6-8 columnas (ADR-005 vigente).

| Tabla | Columnas | Campos |
|-------|----------|--------|
| INGRESOS | I:J | nombre, proyecto |
| GASTOS_FIJOS | L:M | nombre, proyecto |
| GASTOS_VARIABLES | O:P | nombre, proyecto |
| MEDIOS_PAGO | R:T | nombre, moneda, proyecto |
| PROYECTOS | V:W | nombre, tipo (Liquidez/Ahorro/Inversion) |

Ademas: bloque "Categorias" en columna Y (Y2 titulo, Y3 header, Y4 formula ARRAYFORMULA/QUERY/FLATTEN consolidadora).

### Registros (ledger de transacciones) - LAYOUT NUEVO desde 2026-06-22

Headers en fila 5, datos desde fila 6. Sin offset (datos comienzan en columna B). ADR-005 ya no aplica a esta hoja.

| Col | Campo |
|-----|-------|
| B | Monto |
| C | Tipo |
| D | Cuenta |
| E | Tipo de Cuenta |
| F | Medio |
| G | Moneda |
| H | Fecha |
| I | Nota |
| J | Valor ARS |
| K | Valor USD |
| L | Valor AUD |
| M | Valor EUR |

Hojas legacy ocultas: `Registros_legacy` (layout anterior I:T, header fila 2, ~2879 filas).

### Tipos de Cambio (Data Lake) - LAYOUT NUEVO desde 2026-06-22

Titulos de bloque en fila 5, sub-headers Fecha/Cotizacion en fila 6, datos desde fila 7. Sin offset (bloques arrancan en columna B). ADR-005 ya no aplica a esta hoja.

| Par | Columnas |
|-----|----------|
| TC_ARS | B:C |
| TC_USD | E:F |
| TC_AUD | H:I |
| TC_EUR | K:L |

Hoja legacy oculta: `Tipos de cambio_legacy` (bloques I:J/L:M/O:P/R:S, header fila 3).

### Monedas

No hay tabla de monedas. Son una constante de backend: `MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR']` (ADR-003).

## Decisiones Arquitectonicas Vigentes (ADRs)

- **ADR-001**: Google Sheets como backend para MVP. Migracion a PostgreSQL cuando > 3,000 transacciones.
- **ADR-002**: Moneda por defecto reactiva. Una cuenta = un nombre + moneda frecuente. El usuario puede cambiar moneda por transaccion.
- **ADR-003**: Monedas como constante de backend, no como tabla en la hoja.
- **ADR-004**: Data Lake de cotizaciones con carga batch via procesarCargas(). No hay consulta en vivo celda a celda.
- **ADR-005**: Offset estructural. EVOLUCIONADO en 2026-06-22: el offset fue eliminado en las hojas de produccion "Registros" (datos desde columna B) y "Tipos de cambio" (bloques desde columna B). Persiste en Plan de Cuentas (columnas I+) y en las hojas legacy ocultas. Ver GUIA_ARQUITECTURA.md.
- **ADR-006**: Hidden Engines. Hojas ocultas CALCU y ANUAL procesan metricas matriciales. Las vistas publicas solo consumen resultados.

## Flujo de Datos Principal

1. Usuario ingresa transacciones en "Hoja de Cargas" (I5:O19)
2. onEdit trigger auto-completa fecha y moneda segun medio seleccionado
3. procesarCargas() valida el lote, deduce tipo_cuenta, busca/genera cotizaciones via APIs
4. Registros finales se appendean a hoja "Registros" con TCs congelados
5. Hojas ocultas (CALCU, ANUAL) procesan cruces multidimensionales
6. Tablero consume resultados procesados (separacion de concerns)

## Convenciones de Codigo

- Idioma de variables y funciones: camelCase en ingles para nombres de funcion, espanol para strings de UI
- Cada archivo tiene header JSDoc con @version, @since, @lastModified
- Logging: usar logError(), logInfo(), logSuccess() de 02_Utils.js
- Acceso a datos: siempre via 03_SheetManager.js (getTableData, appendRow, etc.), nunca acceder directamente a rangos desde servicios
- Los rangos de columnas estan centralizados en RANGES (00_Config.js). No hardcodear letras de columna fuera de Config.
- Versionado semantico. Changelog en ZZ_Changelog.js y docs/permanente/CHANGELOG.md

## Reglas Estrictas

1. **No crear carpetas en raiz.** Solo las existentes. Actualizar ESTRUCTURA.md antes de cualquier cambio estructural.
2. **Todo codigo .js va en src/.** Sin excepciones.
3. **No tocar _backup/.** Es solo lectura, archivo historico.
4. **Toda documentacion va en docs/permanente/.** No crear docs sueltos en raiz.
5. **No usar emojis en respuestas ni en codigo.** Tono profesional, en espanol.
6. **No proponer soluciones de banca tradicional sin considerar alternativas descentralizadas o basadas en IA.**
7. **Ante duda o contradiccion entre documentos, preguntar antes de asumir.**

## Equipo de Agentes (Claude Code)

Este repo se opera tanto desde Google Antigravity (Gemini) como desde Claude Code. La capa de Antigravity vive en `.agent/` (skills, workflows, rules). La capa de Claude Code vive en `.claude/agents/` y es la que manda cuando se trabaja desde Claude Code. Punto de entrada unico para tareas no triviales: `tidetrack-pm`.

| Si la tarea es... | Invocar |
|---|---|
| Logica Apps Script en `src/*.js`, `00_Config.js`, pipeline de carga, cotizaciones, migraciones, deploy clasp | `appscript-backend` |
| UI embebida `.html` (HtmlService), Design System neumorfico, endpoints `google.script.run`, menus | `appscript-ui` |
| Changelog dual, ADRs, `ESTRUCTURA.md`, esquema de datos, `CLAUDE.md` | `docs-keeper` |
| Validar pipeline batch, cascada de cotizaciones, integridad relacional, idempotencia | `qa-tester` |
| Duplicacion, dead code, simplificacion en `src/` (sin cambiar comportamiento) | `lean-refactor` |
| Scopes OAuth, secrets, claves de API, funciones expuestas | `security-auditor` |
| Tarea ambigua o que cruza varias disciplinas | `tidetrack-pm` |

Reglas operativas en `.agent/rules/`: `no-emojis`, `estructura-obligatoria`, `dispatcher`, `changelog-obligatorio`, `contexto-en-codigo`, `documentacion-conceptual`, `appscript-link`.

## Documentacion de Referencia

La jerarquia de fuentes de verdad es:

1. `docs/permanente/ESTRUCTURA.md` - Mapa de archivos (fuente canonica de organizacion)
2. `docs/permanente/GUIA_ARQUITECTURA.md` - ADRs y decisiones tecnicas
3. `docs/permanente/DATABASE_SCHEMA.md` - Esquema relacional completo
4. `docs/permanente/MAPA_HOJAS.md` - GIDs, layout y dependencias de todas las hojas
5. `docs/permanente/CONTEXTO_NEGOCIO.md` - Circulo de oro, modelo de negocio, valores
6. `docs/permanente/GUIA_MODULOS.md` - Spec tecnica de cada modulo .js
7. `docs/permanente/ROADMAP_PRODUCTO.md` - Fases del producto
8. `docs/permanente/PRINCIPIOS_DISEÑO.md` - Reglas de UX
9. `docs/permanente/HISTORIAL_DESARROLLO.md` - Bitacora cronologica
10. `docs/permanente/FORMULAS_TABLERO.md` - Codigo fuente y logica de las formulas del Tablero
11. `docs/permanente/PLAN_IMPLEMENTACION.md` - Hoja de ruta Claude Code + Cowork

## Estado Actual del Producto (v0.9.4)

Completado: Core setup, exchange rates, catalogos + CRUD, Design System UI, ABM Plan Cuentas, Hoja de Cargas, batch processing (validacion no bloqueante, proteccion de concurrencia, sort best-effort), utilidad de renombrado de hojas, migracion legacy, DevTools export, reconciliacion al layout de produccion nuevo sin offset (Registros B:M, TC bloques B/E/H/K), funcion migrarLegacyANuevaProduccion().

Pendiente: Dashboard/Tablero (QUERY formulas), presupuestacion mensual, resumen anual.

## Vision de Migracion a Web App

Este repositorio es la base de conocimiento y logica de negocio que se migrara a una aplicacion web independiente. El schema de datos ya esta normalizado y es transferible 1:1 a PostgreSQL. La logica de procesamiento batch, cotizaciones, y validaciones son los bloques que se traduciran a una API REST. El Design System (neumorphic, League Spartan, paleta de colores) define la identidad visual que debe mantenerse.

## Comandos Utiles

```bash
npm install              # Instalar clasp
npx clasp push           # Deploy a Apps Script
npx clasp push --watch   # Deploy con hot reload
npx clasp logs --watch   # Logs en tiempo real
```
