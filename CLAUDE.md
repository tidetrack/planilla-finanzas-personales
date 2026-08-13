# CLAUDE.md - Tidetrack Finanzas Personales (contrato operativo)

> Leer este archivo completo antes de ejecutar cualquier tarea. Tiene prioridad sobre cualquier suposicion.

> **ARNES TIDETRACK:** antes de cualquier trabajo estructural en este repo, leer
> `docs/permanente/ARNES_TIDETRACK.md` — el paquete de arranque con todo el arnes
> de gestion destilado de `planilla-pymes` (campana Castellino v1.9-v1.47):
> gemelo digital por JSON, scanner vivo por n8n, gobernanza, contratos de motores,
> verificacion adversarial y la metodologia del plan de cuentas. Se ejecuta por
> fases, en orden. Estado: **Fase 0 (reconciliacion de drift) COMPLETADA el
> 2026-08-12**; **Fase 1 (Gobernanza) COMPLETADA el 2026-08-12** (v0.8.3
> desplegada, drift-check posterior sin drift). Las fases siguientes se ejecutan
> en orden, cada una cierra con verificacion + commit + changelog dual.

## 1. Que es este proyecto

**Tidetrack Personal Finance Tracker** - sistema de finanzas personales construido sobre Google Sheets + Google Apps Script (GAS). Filosofia *Principles First*: friccion minima, habito cotidiano, legibilidad directa en la hoja. La promesa del producto es "paz financiera, todos los dias". No es una app de contabilidad ni un broker: es una herramienta de habito financiero con estetica limpia y multi-moneda nativa.

Este repo contiene el codigo Apps Script de la planilla en produccion (el prototipo funcional que el equipo y los clientes usan hoy). **No es la app web** - esa vive en `tidetrack/planilla-pymes` (PyME) y en la Tidetrack App (personales, stack Next.js). Este repositorio es la base de conocimiento y logica de negocio que se migrara: el schema esta normalizado y es transferible 1:1 a PostgreSQL.

**Estado desde la Fase 0 (2026-08-12):** el baseline adoptado en la Fase 0 fue el script productivo **v0.8.2**, verbatim. Desde entonces el repo puede ir POR DELANTE de produccion entre deploys: la version del repo la declara `src/01_Version.js`, y la efectivamente desplegada se registra en `targets.yaml` (`version_desplegada`); ante duda, el drift-check de `sync_targets.command` es la verdad. Los commits v0.9.2-v0.9.4 (layout B:M de Registros, TC en bloques B/E/H/K) **nunca se desplegaron** y viven solo en la historia de git. El principio rector del arnes: la planilla productiva es la unica verdad del estado; el repo es la unica verdad del codigo; el vault es la unica verdad de las decisiones.

### Stack

- **Backend/DB**: Google Sheets (disciplina relacional estricta, rangos fijos por hoja)
- **Automatizacion**: Google Apps Script (runtime V8, JavaScript numerado 00_-99_)
- **Frontend**: HtmlService (popups modales)
- **Deploy**: Clasp + Node.js, gobernado por `targets.yaml` + `sync_targets.command`
- **Sync**: `scripts/auto-sync.js` (watcher automatico de commits)
- **Timezone**: America/Argentina/Buenos_Aires
- **OAuth Scopes**: spreadsheets, ui, external_request, drive
- **APIs externas**: argentinadatos.com (ARS oficial), frankfurter.app (EUR/AUD)

## 2. Comandos

**Camino canonico de deploy:**

```bash
./sync_targets.command       # DEPLOY OFICIAL: lee targets.yaml, drift-check integrado,
                             # muestra que va a pushear, pide confirmacion explicita,
                             # clasp push por target y restaura .clasp.json ante cualquier corte
```

**Desarrollo y diagnostico:**

```bash
./sync_targets.command --dry-run   # inspeccionar el estado remoto: drift-check completo sin pushear (exit 3 si hay drift o la verificacion fallo)
npm run watch                # clasp push --watch — SOLO contra un sandbox declarado, nunca produccion
npx clasp logs --watch       # logs en tiempo real
node scripts/auto-sync.js    # watcher de GitHub (commit+push automatico del repo)
```

**Para bajar el codigo remoto NO existe `npm run pull`** y esta prohibido correr `clasp pull` en la raiz (con `rootDir: "src"` pisaria `src/` — Regla Estricta 11). Inspeccion remota: `sync_targets.command --dry-run`, o manualmente un `clasp pull` desde un directorio temporal con su propio `.clasp.json`.

**`npm run push` es via EXCEPCIONAL de desarrollo**, no el camino de deploy. Si se usa, exige drift-check manual previo: `clasp pull` a un directorio temporal (**NUNCA sobre `src/`**) y diff archivo por archivo contra el repo. Si el remoto esta adelante, se adopta primero como baseline en un commit propio (`chore(sync): ...`) antes de tocar nada.

**Regla anti-drift (cicatriz 1 de pymes, calcada aca en la Fase 0):** todo cambio nace en el repo y llega a la planilla solo via `sync_targets.command`. Nunca desarrollar directo en el editor de Apps Script. Antes de deployar, verificar que el remoto no este adelante (comparar `ZZ_Changelog.js` remoto vs local). En este repo la produccion estuvo adelante del repo (v0.8.2 con `07_MiradaInteranual.js` desconocido por git): un push ciego lo destruia.

## 3. Estructura del repositorio y modulos

Fuente de verdad de la organizacion: `docs/permanente/ESTRUCTURA.md`.

```
src/                    # Codigo fuente Apps Script (modular, numerado)
docs/permanente/        # Documentacion viva del proyecto
.agent/                 # Ecosistema multi-agente (Antigravity, legacy)
.claude/                # Capa Claude Code (agents)
_backup/                # Archivos historicos (SOLO LECTURA, no tocar)
scripts/                # Automatizacion local (auto-sync)
targets.yaml            # Fuente unica de targets de deploy (script_id + sheet_id confirmados)
sync_targets.command    # Deploy oficial con drift-check (excepcion explicita en .gitignore)
```

Modulos de `src/` (17 archivos):

| Archivo | Responsabilidad |
|---|---|
| `00_Config.js` | Single Source of Truth: SHEETS (con resolver de alias `_resolverNombreHoja`), RANGES, HEADER_ROW/DATA_START_ROW, MONEDAS_DISPONIBLES, MENU_CONFIG, NAV_CONFIG. MUY ALTO RIESGO |
| `01_Version.js` | Control de version semantica |
| `02_Utils.js` | Logging (logError, logInfo, logSuccess), helpers |
| `03_SheetManager.js` | Capa de acceso a datos: getTableData, appendRow, updateRow, deleteRow |
| `06_RegistrosService.js` | Pipeline de procesamiento batch (procesarCargas, appendMassive) |
| `07_MiradaInteranual.js` | Formulas LET/SUMPRODUCT de la hoja Mirada Interanual (G10:R14) + diagnostico. Release v0.8.2 en produccion el 2026-06-22, auditado sobre la planilla el 2026-06-23; se adopto al repo en Fase 0 |
| `11_UIService.js` | Endpoints para google.script.run (ABM forms) |
| `12_MenuService.js` | Menu personalizado "Tidetrack" |
| `13_NavigationService.js` | Navegacion entre hojas con toast |
| `14_EventHandlers.js` | Triggers: appOnEdit (proteccion Plan Cuentas, autocomplete Cargas) |
| `15_ExchangeRateApi.js` | Motor FX + custom functions (TIDETRACK_USD/EUR/AUD) |
| `98_DevTools_Scanner.js` | Exportar JSON de arquitectura completa (se reemplaza en Fase 2 por el scanner cobertura total) |
| `99_MigrationLogic.js` | Migracion de BD legacy (analizar/migrar BD Antigua, recalcular TCs) |
| `UI_SharedStyles.html` | Design System (neumorphic, League Spartan) |
| `UI_AbmPlanCuentas.html` | ABM multi-entidad Plan de Cuentas |
| `ZZ_Changelog.js` | Historial de versiones in-code. OBLIGATORIO al final de cada cambio |
| `appsscript.json` | Manifiesto OAuth |

## 4. Esquema de datos (layout REAL de produccion, v0.8.2)

Las tablas viven en Google Sheets. **Este es el layout que describe `RANGES` en el `00_Config.js` actual y el que existe en la planilla productiva.** NUNCA cambiar la estructura de columnas sin actualizar `00_Config.js` primero.

> **ADVERTENCIA:** `docs/permanente/CONTEXTO_DATOS.md` y versiones anteriores de este
> CLAUDE.md describen un layout B:M "nuevo" para Registros y Tipos de cambio. Ese
> layout es codigo v0.9.x NO desplegado (ver subseccion al final). No asumirlo.

### Plan de Cuentas (5 tablas)

Headers en fila 3, datos desde fila 4. Offset horizontal de 6-8 columnas (ADR-005 vigente).

| Tabla | Columnas | Campos |
|-------|----------|--------|
| INGRESOS | I:J | nombre, proyecto |
| GASTOS_FIJOS | L:M | nombre, proyecto |
| GASTOS_VARIABLES | O:P | nombre, proyecto |
| MEDIOS_PAGO | R:T | nombre, moneda, proyecto |
| PROYECTOS | V:W | nombre, tipo (Liquidez/Ahorro/Inversion) |

Ademas: bloque "Categorias" en columna Y (Y2 titulo, Y3 header, Y4 formula ARRAYFORMULA/QUERY/FLATTEN consolidadora).

### Registros (ledger de transacciones) — columnas I:T

| Col | Campo | | Col | Campo |
|-----|-------|-|-----|-------|
| I | Monto | | O | Fecha |
| J | Tipo | | P | Nota |
| K | Cuenta | | Q | TC ARS |
| L | Tipo de Cuenta | | R | TC USD |
| M | Medio | | S | TC AUD |
| N | Moneda | | T | TC EUR |

**Disputa de filas — CRITICO:** el codigo declara `HEADER_ROW = 3` / `DATA_START_ROW = 4` como globales, pero la evidencia real (scanner DevTools 2026-03: I2=Monto, I3=primer dato; auditoria del modulo Mirada Interanual 2026-06-23, que lee `Registros!$O$3:$O$5000`) ubica el **header en fila 2 y los datos desde fila 3**. Coherente con eso, `procesarCargas()` appendea con `minRow=2` y ordena desde la fila 2. Regla operativa: **toda formula o rango nuevo sobre Registros arranca en fila 3**. El gemelo digital de la Fase 2 cierra esta disputa de forma definitiva.

### Tipos de cambio (Data Lake) — bloques con offset

Header fila 3, datos desde fila 4 (globales de Config; `appendMassive` usa `minRow=4`).

| Par | Columnas |
|-----|----------|
| TC_ARS | I:J |
| TC_USD | L:M |
| TC_AUD | O:P |
| TC_EUR | R:S |

### Cargas (data entry)

Headers en fila 4, datos desde fila 5. Se lee con `getRange('I5:O19')`: Monto=I, Tipo=J, Cuenta=K, Medio=L, Moneda=M, Fecha=N, Nota=O. La hoja real se llama **`Cargas`** (via `NAV_CONFIG.SHEETS.CARGAS`).

### Monedas

No hay tabla de monedas. Son una constante de backend: `MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR']` (ADR-003).

### Hojas reales de la planilla y discrepancias de nombres

Segun el scanner (2026-03-23, unica evidencia de cobertura total): Inicio, Tablero, Cargas, Plan de Cuentas, Tipos de Cambio, Registros, BD Antigua, Bocetos, Espacio blanco 1, Espacio blanco 2, DATA-ENTRY, CARGAS (Forest.), CALCU, ANUAL, PALETAS. La hoja "Mirada Interanual" se creo despues (junio 2026). Hay INCERTIDUMBRE declarada sobre renombres posteriores a marzo 2026; la Fase 2 (gemelo digital) resuelve el estado exacto.

Discrepancias config vs planilla detectadas (`getSheetByName` es case-sensitive). Las tres primeras las resuelve desde v0.8.3 el resolver de alias de `00_Config.js` (las constantes son getters; la columna "valor historico" muestra lo que el config v0.8.2 declaraba en duro):

| Constante | Valor historico (pre-v0.8.3) | Hoja real (scanner) |
|---|---|---|
| `SHEETS.DATA_ENTRY` | `'Hoja de Cargas'` | `Cargas` |
| `SHEETS.TIPOS_CAMBIO` | `'Tipos de cambio'` | `Tipos de Cambio` |
| `SHEETS.BD_ANTIGUA` | `'BD antigua'` | `BD Antigua` |
| `NAV_CONFIG.SHEETS.ESPACIO_BLANCO_3` | `'Espacio blanco 3'` | no existe en el scanner (sin resolver: solo navegacion) |

### Layout v0.9.x NO desplegado

Los commits v0.9.2-v0.9.4 (2026-06-22) movieron Registros a B:M (header fila 5, datos fila 6) y los TC a bloques B:C/E:F/H:I/K:L, con `headerRow`/`dataRow` por tabla en RANGES y hojas `_legacy` de backup. **Ese codigo jamas llego a la planilla**: el ZZ_Changelog productivo termina en v0.8.2. Existe solo en la historia de git, para re-aplicarse (o descartarse — decision de Franco, probablemente en Fase 4) con deploy controlado y migracion de datos. Hasta entonces, ningun modulo ni formula nueva debe asumir el layout B:M.

## 5. Logica critica (no tocar sin entender)

**Motor FX (15_ExchangeRateApi.js):** USD se obtiene via `argentinadatos.com/v1/cotizaciones/dolares/oficial` (venta), con cache en memoria durante la ejecucion. EUR y AUD se triangulan via `frankfurter.app` (USD->EUR/AUD). Fallback a la cotizacion mas cercana disponible; ultimo recurso documentado. **Nunca silenciar errores de la API de tipo de cambio - siempre loguear el fallback.**

**Flujo de datos principal:**
1. Usuario ingresa transacciones en "Cargas" (I5:O19).
2. onEdit (appOnEdit) auto-completa fecha y moneda segun el medio seleccionado.
3. procesarCargas() filtra el lote de forma no bloqueante — el filtro real es solo Monto no vacio: una fila con Monto pero sin Cuenta/Medio se procesa igual, con tipo_cuenta vacio (gap de validacion conocido) —, deduce tipo_cuenta contra los catalogos del Plan de Cuentas, busca/genera cotizaciones via APIs (cache por fecha, persistencia batch en los bloques TC).
4. Registros finales se appendean a "Registros" (I:T) con TCs congelados y la hoja se ordena por fecha descendente.
5. Hojas ocultas (CALCU, ANUAL) procesan cruces multidimensionales.
6. Tablero consume resultados procesados (separacion de concerns).

**Mirada Interanual (07_MiradaInteranual.js):** escribe por codigo las formulas LET/SUMPRODUCT del rango G10:R14 de la hoja "Mirada Interanual" (Ingresos / Gastos Fijos / Gastos Variables por mes + Resultado), leyendo Registros filas 3:5000 con conversion de moneda por los TC congelados. Trampa de locale documentada en el modulo: la planilla esta en espanol (separador `;`), por eso las formulas se construyen en sintaxis en-US con SPLIT de string en vez de arrays literales (que `setFormula` no traduce). Selectores: E4=mes, F4=anio, R4=moneda.

## Decisiones Arquitectonicas Vigentes (ADRs)

- **ADR-001**: Google Sheets como backend para MVP. Migracion a PostgreSQL cuando > 3,000 transacciones.
- **ADR-002**: Moneda por defecto reactiva. Una cuenta = un nombre + moneda frecuente. El usuario puede cambiar moneda por transaccion.
- **ADR-003**: Monedas como constante de backend, no como tabla en la hoja.
- **ADR-004**: Data Lake de cotizaciones con carga batch via procesarCargas(). No hay consulta en vivo celda a celda.
- **ADR-005**: Offset estructural. **VIGENTE EN PRODUCCION en todas las hojas** (Plan de Cuentas I+, Registros I:T, Tipos de cambio I:J..R:S). La eliminacion del offset en Registros/TC (2026-06-22) fue codigo v0.9.x que nunca se desplego; la evolucion queda pendiente de decision y deploy controlado (ver seccion 4). Ver GUIA_ARQUITECTURA.md.
- **ADR-006**: Hidden Engines. Hojas ocultas CALCU y ANUAL procesan metricas matriciales. Las vistas publicas solo consumen resultados.

## Convenciones de Codigo

- Idioma: camelCase en ingles para nombres de funcion, espanol para strings de UI.
- Cada archivo tiene header JSDoc con @version, @since, @lastModified.
- Logging: usar logError(), logInfo(), logSuccess() de 02_Utils.js.
- Acceso a datos: siempre via 03_SheetManager.js, nunca acceder directamente a rangos desde servicios.
- Los rangos de columnas estan centralizados en RANGES (00_Config.js). No hardcodear letras de columna fuera de Config.
- Versionado semantico. Changelog en ZZ_Changelog.js y docs/permanente/CHANGELOG.md.

## 6. Gobernanza (arnes, Fase 1)

Reglas portadas de planilla-pymes; cada una existe porque su ausencia costo datos (las cicatrices estan en `ARNES_TIDETRACK.md` seccion 12):

1. **Changelog dual obligatorio.** Todo cambio a `src/` actualiza `ZZ_Changelog.js` al tope con SemVer Y `docs/permanente/CHANGELOG.md`. Sin esto la tarea NO esta cerrada.
2. **Decisiones inline.** Toda eleccion estructural se comenta en el codigo como `// decision Franco YYYY-MM-DD: <razon>`. Son el changelog real dentro del codigo.
3. **Cabecera de contexto** en todo archivo nuevo: `[CONCEPTO DE NEGOCIO]` + `[FUNDAMENTO TEORICO / ADMINISTRATIVO]` + `@see` a la doc correspondiente.
4. **Cero emojis** en codigo, UI, logs, commits y docs.
5. **SSOT en 00_Config.js.** Nombres de hoja SIEMPRE via `SHEETS`. Las claves con ambiguedad conocida (`DATA_ENTRY`, `TIPOS_CAMBIO`, `BD_ANTIGUA`) son getters que resuelven alias con `_resolverNombreHoja` (renombres de pestanas sin ventana de rotura); el resto son strings estaticos — toda ambiguedad nueva se resuelve agregando el getter, no hardcodeando. Politica ante ambiguedad nombre nuevo/viejo: **gana el historico, el que tiene los datos.**
6. **Deploy solo via `sync_targets.command`** con drift-check previo. `npm run push` directo es excepcional y exige el drift-check manual de la seccion 2.
7. **Regla anti-drift.** Todo cambio nace en el repo y llega a la planilla solo via el script. Nunca desarrollar directo en el editor de Apps Script. Antes de deployar, verificar que el remoto no este adelante.

## Reglas Estrictas (irrompibles)

1. **Nunca hardcodear nombres de hojas ni posiciones de columnas** - usar constantes de `00_Config.js`. Todo cambio en el modelo de datos -> actualizar `00_Config.js` primero, verificar que el rango nuevo existe en la planilla real, y actualizar todos los consumidores en el mismo commit.
2. **No crear carpetas en raiz.** Solo las existentes. Actualizar ESTRUCTURA.md antes de cualquier cambio estructural.
3. **Todo codigo .js va en src/.** Sin excepciones.
4. **No tocar `_backup/`.** Es solo lectura, archivo historico.
5. **Toda documentacion va en docs/permanente/.** No crear docs sueltos en raiz.
6. **No usar emojis en respuestas ni en codigo.** Tono profesional, en espanol.
7. **No proponer soluciones de banca tradicional sin considerar alternativas descentralizadas o basadas en IA.**
8. **Ante duda o contradiccion entre documentos, preguntar antes de asumir.**
9. **Nunca silenciar errores de la API de tipo de cambio** - siempre loguear el fallback.
10. **Toda modificacion de `src/` cierra con changelog dual** (Gobernanza regla 1) y, si toca estructura, con decision inline (regla 2).
11. **Ningun deploy sin drift-check.** El camino es `sync_targets.command`; nunca `clasp push` a ciegas ni `clasp pull` sobre `src/`.

## 7. Cuando NO actuar (derivar en vez de resolver)

- Tarea de UI embebida `.html` (HtmlService, Design System, modales) -> invocar `appscript-ui`.
- Solo actualizar documentacion o changelog sin tocar codigo -> `docs-keeper`.
- Decision de producto o priorizacion -> `tidetrack-pm`.
- Contradiccion entre documentos, o entre docs y planilla -> **preguntar a Franco, no asumir.** En este repo los docs ya estuvieron dos veces desalineados de produccion; la planilla viva (gemelo digital) es la verdad del estado.
- Nunca deployar por iniciativa propia sin drift-check previo. El deploy sale exclusivamente por `sync_targets.command`.

## Equipo de Agentes (Claude Code)

Este repo se opera tanto desde Google Antigravity (Gemini) como desde Claude Code. La capa de Antigravity vive en `.agent/` (skills, workflows, rules). La capa de Claude Code vive en `.claude/agents/` y es la que manda cuando se trabaja desde Claude Code. Punto de entrada unico para tareas no triviales: `tidetrack-pm`.

| Si la tarea es... | Invocar |
|---|---|
| Estado real de la planilla: que hay en una celda, de donde sale un numero, probar que un cambio no rompio nada, refrescar el snapshot, workflow n8n del scanner | `gemelo-digital` |
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

**Scopes sugeridos:** `fx` · `registros` · `plan-cuentas` · `ui` · `config` · `migration` · `sheets` · `arnes`

**Ejemplos:**
```
feat(registros): agregar validacion de monto negativo en cargas
fix(fx): corregir cache de cotizacion para fin de semana
chore(config): agregar resolver de alias de nombres de hoja
docs(claude): actualizar CLAUDE.md con estado del proyecto
```

**Branches:** `feat/[slug]` · `fix/[slug]` · `chore/[slug]`

## Equipo

**Franco Diaz Pizarro** - dueno del producto, clientes activos, decisiones de negocio.
**Marcos (Dima)** - identidad visual, diseno de UI popups.

## Documentacion de Referencia

La jerarquia de fuentes de verdad es:

1. `docs/permanente/ARNES_TIDETRACK.md` - Plan de fases del arnes de gestion (rige el trabajo estructural)
2. `docs/permanente/ESTRUCTURA.md` - Mapa de archivos (fuente canonica de organizacion)
3. `docs/permanente/GUIA_ARQUITECTURA.md` - ADRs y decisiones tecnicas
4. `docs/permanente/DATABASE_SCHEMA.md` - Esquema relacional objetivo (migracion futura a DATA-ENTRY/PostgreSQL)
5. `docs/permanente/MAPA_HOJAS.md` - GIDs, layout y dependencias de todas las hojas
6. `docs/permanente/CONTEXTO_DATOS.md` - Layout por hoja. ATENCION: describe el layout v0.9.x no desplegado; hasta su reescritura, para el layout real vale la seccion 4 de este contrato
7. `docs/permanente/CONTEXTO_NEGOCIO.md` - Circulo de oro, modelo de negocio, valores
8. `docs/permanente/GUIA_MODULOS.md` - Spec tecnica de cada modulo .js
9. `docs/permanente/ROADMAP_PRODUCTO.md` - Fases del producto
10. `docs/permanente/PRINCIPIOS_DISEÑO.md` - Reglas de UX
11. `docs/permanente/HISTORIAL_DESARROLLO.md` - Bitacora cronologica
12. `docs/permanente/FORMULAS_TABLERO.md` - Codigo fuente y logica de las formulas del Tablero

## Estado Actual del Producto

**Version productiva: v0.8.3** (desplegada el 2026-08-12 via `sync_targets.command`; drift-check posterior: sin drift). Los commits v0.9.2-v0.9.4 quedaron en la historia de git sin desplegar (ver seccion 4).

Completado: Core setup, exchange rates, catalogos + CRUD, Design System UI, ABM Plan Cuentas, Hoja de Cargas, batch processing (procesarCargas con cache TC y persistencia batch), migracion de BD Antigua, Mirada Interanual (formulas por codigo + diagnostico), DevTools export, Fase 0 del arnes (reconciliacion de drift, targets.yaml con identidades confirmadas), Fase 1 del arnes (este contrato, resolver de alias, sync_targets.command, changelog dual; v0.8.3 desplegada).

Pendiente: Fases 2-6 del arnes (gemelo digital, n8n, contratos de motores, centro de operaciones, plan de cuentas), destino de v0.9.x (decision de Franco), Dashboard/Tablero (QUERY formulas), presupuestacion mensual, resumen anual.
