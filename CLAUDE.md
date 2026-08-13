# CLAUDE.md - Tidetrack Finanzas Personales

> Leer este archivo completo antes de ejecutar cualquier tarea. Tiene prioridad sobre cualquier suposicion.

> **ARNES TIDETRACK (2026-08-12):** antes de cualquier trabajo estructural en este
> repo, leer `docs/permanente/ARNES_TIDETRACK.md` — el paquete de arranque con todo
> el arnes de gestion destilado de `planilla-pymes` (campana Castellino v1.9-v1.47):
> gemelo digital por JSON, scanner vivo por n8n, gobernanza, contratos de motores,
> verificacion adversarial y la metodologia del plan de cuentas. Se ejecuta por
> fases, en orden, empezando por la Fase 0 (reconciliacion de drift).

## Que es este proyecto

**Tidetrack Personal Finance Tracker** - sistema de finanzas personales construido sobre Google Sheets + Google Apps Script (GAS). Filosofia *Principles First*: friccion minima, habito cotidiano, legibilidad directa en la hoja. La promesa del producto es "paz financiera, todos los dias". No es una app de contabilidad ni un broker: es una herramienta de habito financiero con estetica limpia y multi-moneda nativa.

Este repo contiene el codigo Apps Script de la planilla en produccion (el prototipo funcional que el equipo y los clientes usan hoy). **No es la app web** - esa vive en `tidetrack/planilla-pymes` (PyME) y en la Tidetrack App (personales, stack Next.js). Este repositorio es la base de conocimiento y logica de negocio que se migrara: el schema esta normalizado y es transferible 1:1 a PostgreSQL.

## Stack

- **Backend/DB**: Google Sheets (disciplina relacional estricta, rangos fijos por hoja)
- **Automatizacion**: Google Apps Script (runtime V8, JavaScript numerado 00_-99_)
- **Frontend**: HtmlService (popups modales)
- **Deploy**: Clasp + Node.js
- **Sync**: `scripts/auto-sync.js` (watcher automatico de commits)
- **Timezone**: America/Argentina/Buenos_Aires
- **OAuth Scopes**: spreadsheets, ui, external_request, drive
- **APIs externas**: argentinadatos.com (ARS oficial), frankfurter.app (EUR/AUD)

## Comandos esenciales

```bash
npm run push    # clasp push — sube codigo a Apps Script
npm run watch   # clasp push --watch — sube en modo watcher
npm run pull    # clasp pull — baja codigo desde la nube
npx clasp logs --watch       # logs en tiempo real
node scripts/auto-sync.js    # watcher de GitHub (commit+push automatico)
```

## Estructura del Repositorio

Fuente de verdad: `docs/permanente/ESTRUCTURA.md`

```
src/                    # Codigo fuente Apps Script (modular, numerado)
docs/permanente/        # Documentacion viva del proyecto
.agent/                 # Ecosistema multi-agente (Antigravity, legacy)
.claude/                # Capa Claude Code (agents)
_backup/                # Archivos historicos (SOLO LECTURA, no tocar)
scripts/                # Automatizacion local (auto-sync)
```

## Esquema de Datos

Las tablas viven en Google Sheets. El layout varia por hoja: ver detalle abajo y en `docs/permanente/MAPA_HOJAS.md`. **NUNCA cambiar la estructura de columnas sin actualizar `00_Config.js` primero** (Single Source of Truth de rangos via `RANGES`).

### Plan de Cuentas (5 tablas) - SIN CAMBIOS

Headers en fila 3, datos desde fila 4. Offset horizontal de 6-8 columnas (ADR-005 vigente para esta hoja).

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

Hoja legacy oculta: `Registros_legacy` (layout anterior I:T, header fila 2, ~2879 filas; backup de solo lectura).

### Tipos de cambio (Data Lake) - LAYOUT NUEVO desde 2026-06-22

Titulos de bloque en fila 5, sub-headers Fecha/Cotizacion en fila 6, datos desde fila 7. Sin offset (bloques arrancan en columna B). ADR-005 ya no aplica a esta hoja.

| Par | Columnas |
|-----|----------|
| TC_ARS | B:C |
| TC_USD | E:F |
| TC_AUD | H:I |
| TC_EUR | K:L |

Hoja legacy oculta: `Tipos de cambio_legacy` (bloques I:J/L:M/O:P/R:S, header fila 3).

### Cargas (data entry) - SIN CAMBIOS

Headers en fila 4, datos desde fila 5. Se lee con `getRange('I5:O19')`: Monto=I, Tipo=J, Cuenta=K, Medio=L, Moneda=M, Fecha=N, Nota=O.

### Monedas

No hay tabla de monedas. Son una constante de backend: `MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR']` (ADR-003).

## Modulos del codigo (`src/`)

| Archivo | Responsabilidad |
|---|---|
| `00_Config.js` | Single Source of Truth: SHEETS, RANGES (con headerRow/dataRow por tabla), MONEDAS_DISPONIBLES, menus |
| `01_Version.js` | Control de version semantica |
| `02_Utils.js` | Logging (logError, logInfo, logSuccess), helpers |
| `03_SheetManager.js` | Capa de acceso a datos: getTableData, appendRow, updateRow, deleteRow |
| `06_RegistrosService.js` | Pipeline de procesamiento batch (procesarCargas) |
| `11_UIService.js` | Endpoints para google.script.run (ABM forms) |
| `12_MenuService.js` | Menu personalizado "Tidetrack" |
| `13_NavigationService.js` | Navegacion entre hojas con toast |
| `14_EventHandlers.js` | Triggers: appOnEdit (proteccion Plan Cuentas, autocomplete Cargas) |
| `15_ExchangeRateApi.js` | Motor FX + custom functions (TIDETRACK_USD/EUR/AUD) |
| `98_DevTools_Scanner.js` | Exportar JSON de arquitectura completa |
| `99_MigrationLogic.js` | Migracion de BD legacy + migrarLegacyANuevaProduccion() |
| `UI_SharedStyles.html` | Design System (neumorphic, League Spartan) |
| `UI_AbmPlanCuentas.html` | ABM multi-entidad Plan de Cuentas |
| `ZZ_Changelog.js` | Historial de versiones in-code |

## Logica critica (no tocar sin entender)

**Motor FX (15_ExchangeRateApi.js):** USD se obtiene via `argentinadatos.com/v1/cotizaciones/dolares/oficial` (venta), con cache en memoria durante la ejecucion. EUR y AUD se triangulan via `frankfurter.app` (USD->EUR/AUD). Fallback a la cotizacion mas cercana disponible; ultimo recurso documentado. **Nunca silenciar errores de la API de tipo de cambio - siempre loguear el fallback.**

**Flujo de datos principal:**
1. Usuario ingresa transacciones en "Cargas" (I5:O19).
2. onEdit (appOnEdit) auto-completa fecha y moneda segun el medio seleccionado.
3. procesarCargas() valida el lote (no bloqueante: saltea filas incompletas), deduce tipo_cuenta, busca/genera cotizaciones via APIs.
4. Registros finales se appendean a "Registros" (B:M) con TCs congelados.
5. Hojas ocultas (CALCU, ANUAL) procesan cruces multidimensionales.
6. Tablero consume resultados procesados (separacion de concerns).

## Decisiones Arquitectonicas Vigentes (ADRs)

- **ADR-001**: Google Sheets como backend para MVP. Migracion a PostgreSQL cuando > 3,000 transacciones.
- **ADR-002**: Moneda por defecto reactiva. Una cuenta = un nombre + moneda frecuente. El usuario puede cambiar moneda por transaccion.
- **ADR-003**: Monedas como constante de backend, no como tabla en la hoja.
- **ADR-004**: Data Lake de cotizaciones con carga batch via procesarCargas(). No hay consulta en vivo celda a celda.
- **ADR-005**: Offset estructural. EVOLUCIONADO en 2026-06-22: el offset fue eliminado en las hojas de produccion "Registros" (datos desde columna B) y "Tipos de cambio" (bloques desde columna B). Persiste en Plan de Cuentas (columnas I+) y en las hojas legacy ocultas. Ver GUIA_ARQUITECTURA.md.
- **ADR-006**: Hidden Engines. Hojas ocultas CALCU y ANUAL procesan metricas matriciales. Las vistas publicas solo consumen resultados.

## Convenciones de Codigo

- Idioma: camelCase en ingles para nombres de funcion, espanol para strings de UI.
- Cada archivo tiene header JSDoc con @version, @since, @lastModified.
- Logging: usar logError(), logInfo(), logSuccess() de 02_Utils.js.
- Acceso a datos: siempre via 03_SheetManager.js, nunca acceder directamente a rangos desde servicios.
- Los rangos de columnas estan centralizados en RANGES (00_Config.js). No hardcodear letras de columna fuera de Config.
- Versionado semantico. Changelog en ZZ_Changelog.js y docs/permanente/CHANGELOG.md.

## Reglas Estrictas (irrompibles)

1. **Nunca hardcodear nombres de hojas ni posiciones de columnas** - usar constantes de `00_Config.js`. Todo cambio en el modelo de datos -> actualizar `00_Config.js` primero.
2. **No crear carpetas en raiz.** Solo las existentes. Actualizar ESTRUCTURA.md antes de cualquier cambio estructural.
3. **Todo codigo .js va en src/.** Sin excepciones.
4. **No tocar `_backup/`.** Es solo lectura, archivo historico.
5. **Toda documentacion va en docs/permanente/.** No crear docs sueltos en raiz.
6. **No usar emojis en respuestas ni en codigo.** Tono profesional, en espanol.
7. **No proponer soluciones de banca tradicional sin considerar alternativas descentralizadas o basadas en IA.**
8. **Ante duda o contradiccion entre documentos, preguntar antes de asumir.**
9. **Nunca silenciar errores de la API de tipo de cambio** - siempre loguear el fallback.

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

## Vault Cluster - Inteligencia de Negocio

Este repo es parte del ecosistema Cluster de Franco Diaz Pizarro. La inteligencia de negocio vive en el vault Obsidian (`tidetrack/vault-obsidian-sync`). Antes de tomar decisiones, consulta:

- **Producto**: `04 RECURSOS/productos/Planilla Finanzas.md` - arquitectura, decisiones, friccion conocida
- **App destino**: `04 RECURSOS/productos/Tidetrack App.md` - la app web que reemplaza esta planilla
- **Unidad**: `03 UNIDADES/tidetrack/`
- **Clientes activos**: `02 PROYECTOS/` - buscar clientes con `unit: tidetrack`

**Regla de doble escritura:** toda decision de arquitectura relevante -> documentar tambien en `04 RECURSOS/productos/Planilla Finanzas.md` del vault.

## Convencion de commits (universal - igual en todos los repos del Cluster)

Formato: `tipo(scope): descripcion en espanol`

**Tipos:** `feat` · `fix` · `chore` · `refactor` · `docs` · `test`

**Scopes sugeridos:** `fx` · `registros` · `plan-cuentas` · `ui` · `config` · `migration` · `sheets`

**Ejemplos:**
```
feat(registros): agregar validacion de monto negativo en cargas
fix(fx): corregir cache de cotizacion para fin de semana
chore(config): agregar nueva moneda EUR al plan de cuentas
docs(claude): actualizar CLAUDE.md con estado del proyecto
```

**Branches:** `feat/[slug]` · `fix/[slug]` · `chore/[slug]`

## Equipo

**Franco Diaz Pizarro** - dueno del producto, clientes activos, decisiones de negocio.
**Marcos (Dima)** - identidad visual, diseno de UI popups.

## Documentacion de Referencia

La jerarquia de fuentes de verdad es:

1. `docs/permanente/ESTRUCTURA.md` - Mapa de archivos (fuente canonica de organizacion)
2. `docs/permanente/GUIA_ARQUITECTURA.md` - ADRs y decisiones tecnicas
3. `docs/permanente/DATABASE_SCHEMA.md` - Esquema relacional objetivo (migracion futura a DATA-ENTRY/PostgreSQL)
4. `docs/permanente/MAPA_HOJAS.md` - GIDs, layout y dependencias de todas las hojas
5. `docs/permanente/CONTEXTO_DATOS.md` - Layout real de produccion por hoja
6. `docs/permanente/CONTEXTO_NEGOCIO.md` - Circulo de oro, modelo de negocio, valores
7. `docs/permanente/GUIA_MODULOS.md` - Spec tecnica de cada modulo .js
8. `docs/permanente/ROADMAP_PRODUCTO.md` - Fases del producto
9. `docs/permanente/PRINCIPIOS_DISEÑO.md` - Reglas de UX
10. `docs/permanente/HISTORIAL_DESARROLLO.md` - Bitacora cronologica
11. `docs/permanente/FORMULAS_TABLERO.md` - Codigo fuente y logica de las formulas del Tablero

## Estado Actual del Producto (v0.9.4)

Completado: Core setup, exchange rates, catalogos + CRUD, Design System UI, ABM Plan Cuentas, Hoja de Cargas, batch processing (validacion no bloqueante, proteccion de concurrencia, sort best-effort), utilidad de renombrado de hojas, migracion legacy, DevTools export, reconciliacion al layout de produccion nuevo sin offset (Registros B:M, TC bloques B/E/H/K), funcion migrarLegacyANuevaProduccion().

Pendiente: Dashboard/Tablero (QUERY formulas), presupuestacion mensual, resumen anual.
