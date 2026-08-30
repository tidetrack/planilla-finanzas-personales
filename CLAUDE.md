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

**Estado del baseline:** la Fase 0 (2026-08-12) adopto produccion v0.8.2 verbatim; el 2026-08-18 se re-adopto produccion **v0.10.0** verbatim (una sesion del 2026-08-13 desarrollo v0.9.5-v0.10.0 fuera del repo: layout nuevo + migracion historica desde la planilla v03.1 — el drift fue en ambos sentidos, cicatriz conocida). Sobre ese baseline se construyo el **swap v0.11** (hojas Fix -> canonicas). La version del repo la declara `src/01_Version.js`; la efectivamente desplegada se registra en `targets.yaml` (`version_desplegada`); ante duda, el drift-check de `sync_targets.command` es la verdad, y **todo push arranca con un `clasp pull` a temp para comparar `ZZ_Changelog.js`**. El principio rector del arnes: la planilla productiva es la unica verdad del estado; el repo es la unica verdad del codigo; el vault es la unica verdad de las decisiones.

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

## 4. Esquema de datos (layout REAL de produccion, v0.11 — geometria Fix)

Las tablas viven en Google Sheets. **Este es el layout que describe `RANGES` en el `00_Config.js` actual y el que existe en la planilla productiva desde el swap v0.11 (2026-08-18).** NUNCA cambiar la estructura de columnas sin actualizar `00_Config.js` primero.

> Historia en dos saltos: la migracion v0.9.5 (2026-08-13, verificada en vivo) movio
> Registros a B:M y los TC a bloques B/E/H/K; el rediseno de Franco (hojas " - Fix") +
> el swap v0.11 (2026-08-18) corrio TODO el layout de nuevo y reestructuro el Plan de
> Cuentas. El detalle funcional por hoja vive en `docs/permanente/FUNCIONALIDADES.md`;
> el mapa por hoja en `docs/permanente/MAPA_HOJAS.md`.

### Plan de Cuentas (5 tablas + consolidacion)

Titulo C2. Titulos de bloque fila 6, headers fila 7, datos desde fila 8 (los defaults
globales `HEADER_ROW`/`DATA_START_ROW` = 7/8 describen esta hoja). En la hoja la nocion
"Proyecto" se rotula **"Categoria"**; las claves internas de RANGES conservan el nombre
historico.

| Tabla | Columnas | Campos |
|-------|----------|--------|
| INGRESOS | C:D | nombre, categoria |
| GASTOS_FIJOS | F:G | nombre, categoria |
| GASTOS_VARIABLES | I:J | nombre, categoria |
| MEDIOS_PAGO | L:N | nombre, moneda, categoria |
| PROYECTOS (rotulado "Categorias") | P:Q | nombre, tipo (Ahorros/Inversiones/Financiacion/Hogar) |

Ademas: columna S = consolidacion de las cuentas de los 4 bloques (QUERY acotada a fila
1000; la agrega el swap v0.11 espejando la columna Y del Plan viejo). Es la fuente del
dropdown de Cuenta en Cargas: **no tocar a mano**.

### Registros (ledger de transacciones) — columnas B:M

Titulo B2. Header fila 6, datos desde fila 7, orden por fecha descendente (Z-A).

| Col | Campo | | Col | Campo |
|-----|-------|-|-----|-------|
| B | Monto | | H | Fecha |
| C | Tipo | | I | Nota |
| D | Cuenta | | J | TC ARS |
| E | Tipo de Cuenta | | K | TC USD |
| F | Medio | | L | TC AUD |
| G | Moneda | | M | TC EUR |

Las columnas J:M congelan las cotizaciones del dia del registro (valor pegado): es el unico
dato del ledger que despues no se puede recalcular.

### Tipos de Cambio (Data Lake) — bloques C/F/I/L

Titulo C2. Nombres de moneda fila 6, header fila 7, datos desde fila 8. ARS siempre 1.0
(moneda base).

| Par | Columnas |
|-----|----------|
| TC_ARS | C:D |
| TC_USD | F:G |
| TC_AUD | I:J |
| TC_EUR | L:M |

### Cargas (data entry)

Titulo B2. Headers fila 6, grilla fija C7:I21 (15 filas, numeracion B7:B21): Monto=C,
Tipo=D, Cuenta=E, Medio=F, Moneda=G, Fecha=H, Nota=I. Vista "Ultimos 15 movimientos" en
M6:S21 (formula de hoja, el script no la toca). Dropdowns: Cuenta -> Plan!S, Medio ->
Plan!L, Tipo y Moneda listas fijas.

### Monedas

No hay tabla de monedas. Son una constante de backend: `MONEDAS_DISPONIBLES = ['ARS', 'USD', 'AUD', 'EUR']` (ADR-003).

### Hojas reales y nombres

Canonicas post-swap: Inicio, Tablero, Presupuesto, Cargas, Plan de Cuentas, Mirada
Interanual, Registros, Tipos de Cambio. Mas los respaldos ocultos del swap
(`<nombre> (anterior 2026-08-18)`) hasta su purga. Las hojas auxiliares de marzo-junio
(CALCU, ANUAL, Bocetos, _legacy, DATA-ENTRY, etc.) ya no existen.

El resolver de alias de `00_Config.js` sigue vigente: `SHEETS.TIPOS_CAMBIO` acepta
`'Tipos de Cambio'` (canonico desde v0.11) y `'Tipos de cambio'` (grafia historica);
`SHEETS.DATA_ENTRY` acepta `'Cargas'` y `'Hoja de Cargas'`.

## 5. Logica critica (no tocar sin entender)

**Motor FX (15_ExchangeRateApi.js):** USD se obtiene via `argentinadatos.com/v1/cotizaciones/dolares/oficial` (venta), con cache en memoria durante la ejecucion. EUR y AUD se triangulan via `frankfurter.app` (USD->EUR/AUD). Fallback a la cotizacion mas cercana disponible; ultimo recurso documentado. **Nunca silenciar errores de la API de tipo de cambio - siempre loguear el fallback.**

**Flujo de datos principal:**
1. Usuario ingresa transacciones en "Cargas" (grilla C7:I21).
2. onEdit (appOnEdit) auto-completa fecha y moneda segun el medio seleccionado.
3. procesarCargas() filtra el lote de forma no bloqueante — el filtro real es solo Monto no vacio: una fila con Monto pero sin Cuenta/Medio se procesa igual, con tipo_cuenta vacio (gap de validacion conocido) —, deduce tipo_cuenta contra los catalogos del Plan de Cuentas, busca/genera cotizaciones via APIs (cache por fecha, persistencia batch en los bloques TC).
4. Registros finales se appendean a "Registros" (B:M, datos desde fila 7) con TCs congelados y la hoja se ordena por fecha descendente.
5. Las vistas (Inicio, Tablero, Cargas, Mirada Interanual) agregan directo sobre Registros via QUERY, cruzando el Medio contra Plan de Cuentas L:N y P:Q. (Las hojas motor CALCU/ANUAL de la era v0.3 ya no existen.)

**Mirada Interanual (07_MiradaInteranual.js):** escribia por codigo las formulas LET/SUMPRODUCT de la hoja "Mirada Interanual". Trampa de locale documentada en el modulo: la planilla esta en espanol (separador `;`), por eso las formulas se construyen en sintaxis en-US con SPLIT de string en vez de arrays literales (que `setFormula` no traduce). **DESALINEADO desde el rediseno Fix**: el modulo espera selectores E4/F4/R4 y rotulos C10:C12, la hoja nueva usa I2/I3/I4+M2 y C8:C10; su preflight bloquea sin escribir. Re-alinear las constantes MIRADA_* es parte del formulerio (FUNCIONALIDADES.md, seccion 06).

## Decisiones Arquitectonicas Vigentes (ADRs)

- **ADR-001**: Google Sheets como backend para MVP. Migracion a PostgreSQL cuando > 3,000 transacciones.
- **ADR-002**: Moneda por defecto reactiva. Una cuenta = un nombre + moneda frecuente. El usuario puede cambiar moneda por transaccion.
- **ADR-003**: Monedas como constante de backend, no como tabla en la hoja.
- **ADR-004**: Data Lake de cotizaciones con carga batch via procesarCargas(). No hay consulta en vivo celda a celda.
- **ADR-005**: Offset estructural. SUPERADO por el rediseno Fix (2026-08-18): el layout actual arranca en B/C con titulos internos por hoja. Queda documentado como historia; la geometria vigente es la de la seccion 4.
- **ADR-006**: Hidden Engines (CALCU/ANUAL). SUPERADO: esas hojas ya no existen; las vistas agregan directo sobre Registros.
- **ADR-007**: Tarjeta de credito como medio de pago tipo Financiacion, resuelta con la partida doble de los traspasos (consumo = Egreso, pago de resumen = Traspaso). Saldo negativo, ya excluido de TIPOS_RIQUEZA. Sin migracion del historico.

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
