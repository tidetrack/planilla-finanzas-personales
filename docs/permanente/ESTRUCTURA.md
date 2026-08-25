# Mapa de Archivos - Tidetrack Personal Finance

> Propósito: Fuente de verdad sobre la organización del repositorio. Toda nueva carpeta o archivo debe registrarse aquí antes de crearse. Los agentes de IA usan este documento como referencia canónica.

Versión: v0.47.0 (reconciliación de `src/` contra `ls src/` real: 42 archivos, sin faltantes ni duplicados) | Última actualización: 2026-08-25

---

## Arbol de Carpetas

```
planilla-finanzas-personales/
│
├── src/ # Código fuente (Apps Script) - 42 archivos, verificado contra `ls src/` el 2026-08-25
│ ├── 00_Config.js # Constantes, rangos, enums, monedas, menús (SSOT con resolver de alias de nombres de hoja)
│ ├── 01_Version.js # Control de versión semántica
│ ├── 02_Utils.js # Utilidades generales y logging (logError/logInfo/logSuccess)
│ ├── 03_SheetManager.js # Capa única de acceso a datos (getTableData, appendRow, updateRow, deleteRow)
│ ├── 06_RegistrosService.js # Pipeline batch procesarCargas(): valida, deduce, cotiza y apendea a Registros
│ ├── 07_MiradaInteranual.js # Fórmulas LET/SUMPRODUCT de "Mirada Interanual" (vista de doce meses) + diagnóstico
│ ├── 11_UIService.js # Endpoints para google.script.run (include de HTML, abre el ABM Plan de Cuentas)
│ ├── 12_MenuService.js # Menú personalizado "Tidetrack" (onOpen, ítems de sección)
│ ├── 13_NavigationService.js # Navegación entre hojas con toast
│ ├── 14_EventHandlers.js # Trigger appOnEdit: protección Plan de Cuentas, autocompletado en Cargas
│ ├── 15_ExchangeRateApi.js # Motor de cotizaciones (argentinadatos + frankfurter) y custom functions TIDETRACK_USD/EUR/AUD
│ ├── 98_DevTools_Scanner.js # Scanner de arquitectura total: exporta el gemelo digital en JSON
│ ├── 99_MigrationLogic.js # Migración puntual desde la BD Legacy "BD antigua" y recálculo de TCs
│ ├── DEVTOOL_AltaCuentas.js # Alta en el Plan de Cuentas de las cuentas que el ledger usa y el catálogo no tiene
│ ├── DEVTOOL_BloqueCategorias.js # El bloque Categorías del Tablero agrupa por categoría de cuenta, no por tipo de medio
│ ├── DEVTOOL_CableadoPresupuesto.js # Cableado Presupuesto <-> Tablero - NO LISTO, fuera de servicio desde 2026-08-13
│ ├── DEVTOOL_Capitalizacion.js # Mantiene Ingresos = Fijos + Variables + Capacidad de Capitalización en el presupuesto
│ ├── DEVTOOL_CategorizarCuentas.js # Catálogo de categorías por cuenta (Ingresos/Fijos/Variables), eje del motivo
│ ├── DEVTOOL_ConciliarSaldos.js # Concilia el saldo de cada medio contra el declarado cargando movimientos de "Ajuste"
│ ├── DEVTOOL_FormatoMedios.js # Pinta cada medio del bloque "Medios Bancarios" con el color de su Tipo
│ ├── DEVTOOL_FormulerioV0111.js # Repara las fórmulas de Inicio y Tablero rotas por el swap de hojas Fix (v0.11)
│ ├── DEVTOOL_InicioPresupuesto.js # Llena "Presupuesto del Mes" de Inicio (Presupuesto/Realidad/Consumo/Distribución)
│ ├── DEVTOOL_LimpiarPlanCuentas.js # Deja el Plan de Cuentas en su forma final: categorías unificadas en P, restos barridos
│ ├── DEVTOOL_Presupuesto.js # Motor original de la hoja Presupuesto - NO LISTO, fuera de servicio desde 2026-08-13
│ ├── DEVTOOL_PresupuestoBase.js # Siembra la BD Proyección con un presupuesto base por promedio histórico móvil por cuenta
│ ├── DEVTOOL_PresupuestoGuardar.js # Guarda en Proyección el Monto a Proyectar con TCs congelados (etapa 3 de Presupuesto)
│ ├── DEVTOOL_PresupuestoModo.js # Cablea el selector de Modo y llena J/N/R con el monto de referencia (etapa 1 de Presupuesto)
│ ├── DEVTOOL_PresupuestoResumen.js # Agrupado por categoría (V/W) y rótulos dinámicos de las tablas resumen (etapa 2)
│ ├── DEVTOOL_Proyeccion.js # Crea la BD Proyección (espejo de Registros) y cablea Presupuesto Asignado del Tablero
│ ├── DEVTOOL_PurgaRespaldos.js # Borra las hojas de respaldo que los devtools dejan acumuladas en cada corrida
│ ├── DEVTOOL_RiquezaYCategorias.js # Riqueza por lista blanca (Ahorros+Inversiones) + columna Tipo en categorías
│ ├── DEVTOOL_RobustezVistas.js # Blindaje IFERROR y anti-derrame de los QUERY de staging - anclas PRE-Fix, fuera del menú
│ ├── DEVTOOL_StockYFlujo.js # Separa STOCK (saldo, sin filtro) de FLUJO (movimientos del mes) en Tablero e Inicio
│ ├── DEVTOOL_TableroFaltanteProyectado.js # Agrega la sección "Faltante proyectado" a los tres bloques de cuentas del Tablero
│ ├── DEVTOOL_TipoDeMedios.js # El medio declara su Tipo directo, sin el nivel intermedio de categorías
│ ├── MIGRACION_v0.11_SwapHojasFix.js # Swap de hojas " - Fix" a canónicas: renombre y repunteo (aplicada 2026-08-18)
│ ├── MIGRACION_v0.9.5_LayoutNuevo.js # Migración al layout de junio - OBSOLETA, con guard que aborta si la geometría no coincide
│ ├── MIGRACION_v031_Historico.js # Recupera el histórico de la planilla vieja v03.1 por cruce de ausencia, re-ejecutable
│ ├── UI_AbmPlanCuentas.html # ABM multi-entidad del Plan de Cuentas (popup HtmlService)
│ ├── UI_SharedStyles.html # Design System CSS compartido (paleta de variables, tipografía Google Sans)
│ ├── ZZ_Changelog.js # Historial de versiones in-code, orden descendente
│ └── appsscript.json # Manifiesto OAuth: timezone, scopes (spreadsheets, ui, external_request, drive)
│
├── docs/ # Documentación del proyecto
│ ├── permanente/ # Documentos vivos (actualización continua)
│ │ ├── ARQUITECTURA_AGENTICA.md # Sistema multi-agente de desarrollo (legacy Antigravity)
│ │ ├── CHANGELOG.md # Historial completo de versiones
│ │ ├── CONTEXTO_DATOS.md # Diccionario 100% fiel de Backend (offsets, reglas)
│ │ ├── CONTEXTO_NEGOCIO.md # Círculo de oro, modelo de negocio
│ │ ├── CONTEXTO_UI.md # Arquitectura de los paneles interactivos
│ │ ├── DATABASE_SCHEMA.md # Esquema de tablas en Google Sheets
│ │ ├── ESTRUCTURA.md # Este archivo. Mapa de carpetas. Fuente de verdad.
│ │ ├── FORMULAS_TABLERO.md # Código fuente y lógica de fórmulas del Tablero
│ │ ├── GUIA_ARQUITECTURA.md # ADRs y decisiones técnicas formales
│ │ ├── GUIA_MODULOS.md # Documentación técnica de módulos .js
│ │ ├── HISTORIAL_DESARROLLO.md # Bitácora cronológica del proyecto
│ │ ├── MAPA_HOJAS.md # GIDs, layout y dependencias de todas las hojas (incl. ocultas)
│ │ ├── PLAN_IMPLEMENTACION.md # Hoja de ruta dual Claude Code + Cowork
│ │ ├── planilla-reinversión.md # Documento fundacional del pivote
│ │ ├── PRINCIPIOS_DISEÑO.md # Reglas de UX y experiencia de usuario
│ │ ├── PROMPT_MAESTRO.md # Prompts de referencia para el ecosistema agéntico
│ │ ├── RESUMEN_PROYECTO.md # Visión general de Tidetrack
│ │ ├── ROADMAP_PRODUCTO.md # Etapas y prioridades del producto
│ │ ├── MAPA_ARQUITECTURA_PLANILLA.md # Capa SEMÁNTICA curada del gemelo (el único que se edita a mano)
│ │ ├── INVENTARIO_CELDAS.md # Capa MECÁNICA auto-generada (NO editar: se regenera)
│ │ ├── celdas.tsv # Volcado aplanado para auditoría con awk/grep (NO editar)
│ │ ├── TIDETRACK_ARQUITECTURA_ESTRICTA.json # JSON crudo generado por DevTools (para NotebookLM)
│ │ └── database_er_diagram.png # Diagrama ER de relaciones
│ ├── sesiones/ # Notas de sesiones de trabajo específicas
│ │ ├── 2026-02-13_v0.6.0_Simplificacion-Monedas.md # Sesión simplificación de monedas
│ │ ├── 2026-06-05_bootstrap-gobernanza-claude-code.md # Bootstrap ecosistema Claude Code
│ │ ├── Notas Fran.md # Notas personales del desarrollador
│ │ ├── SPRINT_2_COMPLETO_2026-01-18.md # Cierre Sprint 2
│ │ ├── SPRINT_3_COMPLETO_2026-01-18.md # Cierre Sprint 3
│ │ ├── TESTING_DAY_0.md # Testing inicial
│ │ ├── TESTING_SPRINT_0.md # Testing Sprint 0
│ │ └── TESTING_SPRINT_1.md # Testing Sprint 1
│ ├── PRODUCT_BACKLOG.md # Sprints y backlog priorizado
│ ├── REGLAS_AGENTE.md # Convenciones de desarrollo
│ └── README.md # Índice de documentación
│
├── .claude/ # Capa de gobernanza Claude Code (manda cuando se trabaja desde Claude Code)
│ ├── agents/ # Subagentes especializados (8 agentes activos)
│ │ ├── tidetrack-pm.md # Dispatcher y orquestador central
│ │ ├── gemelo-digital.md # Dueño del gemelo: scanner, snapshot, inventario, TSV, MAPA y diff de no-daño
│ │ ├── appscript-backend.md # Experto en lógica Apps Script (src/*.js, pipelines, deploy)
│ │ ├── appscript-ui.md # Especialista en HtmlService y UI embebida
│ │ ├── docs-keeper.md # Coherencia documental (changelog, ADRs, estructura)
│ │ ├── qa-tester.md # Validación pipeline, integridad relacional, idempotencia
│ │ ├── lean-refactor.md # Limpieza y refactorización sin cambio de comportamiento
│ │ └── security-auditor.md # Scopes OAuth, secrets, funciones expuestas
│ └── agent-memory/ # Memoria persistente de agentes
│   └── tidetrack-pm/ # Memoria del PM (proyecto, usuario, reglas de coordinación)
│     ├── MEMORY.md
│     ├── feedback_coordination_rules.md
│     ├── project_agent_team.md
│     └── user_franco.md
│
├── .agent/ # Capa legacy Antigravity/Gemini (referencia histórica)
│ ├── skills/ # Skills Antigravity (un directorio por agente legacy)
│ │ ├── tidetrack-pm/ # PM legacy (Antigravity)
│ │ ├── agente-contextual/ # Bibliotecario: historial + ADRs
│ │ ├── appscript-backend/ # Backend legacy
│ │ ├── frontend-ui-ux/ # UI legacy
│ │ ├── auto-changelog/ # Versionado automático legacy
│ │ ├── github-docs/ # Documentación legacy
│ │ ├── github-sync/ # Sync legacy
│ │ ├── data-mapper/ # Mapeo de JSONs legacy
│ │ ├── lean-code-expert/ # Refactorización legacy
│ │ ├── creador-de-skills/ # Generador de skills legacy
│ │ ├── gsd/ # Get Shit Done legacy
│ │ └── update-docs/ # Actualización de docs legacy
│ ├── rules/ # Reglas de cumplimiento obligatorio (compartidas Claude Code + Antigravity)
│ │ ├── appscript-link.md # Vínculo y convenciones para Apps Script
│ │ ├── changelog-obligatorio.md # Actualización de changelog en cada iteración
│ │ ├── contexto-en-codigo.md # Cabeceras conceptuales en archivos .js/.html
│ │ ├── dispatcher.md # Lógica de enrutamiento de agentes
│ │ ├── documentacion-conceptual.md # Doc conceptual por feature mayor en docs/permanente/
│ │ ├── estructura-obligatoria.md # Reglas de estructura de carpetas
│ │ └── no-emojis.md # Regla estricta de tono profesional
│ └── workflows/ # Flujos de trabajo reutilizables
│
├── devtools/ # Herramientas locales: corren en tu máquina, NO se deployan (src/ es el rootDir de clasp)
│ ├── generar_inventario_planilla.py # Del snapshot JSON produce INVENTARIO_CELDAS.md (capa mecánica)
│ ├── generar_tsv_celdas.py # Aplana el snapshot a celdas.tsv para auditar con awk/grep sin cargar el JSON
│ ├── diff_snapshots.py # Prueba de no-daño: compara dos snapshots y falla si cambió una fórmula
│ ├── probar_formulerio.js # Banco de pruebas: corre las transformaciones del formulerío contra las fórmulas reales del gemelo ANTES de deployar
│ ├── probar_riqueza.js # Banco de pruebas de la lista blanca de riqueza y la columna Tipo
│ └── probar_stock_flujo.js # Banco de pruebas de las fórmulas de saldo y del Flujo Cotidiano
│
├── scripts/ # Herramientas de automatización local
│ └── auto-sync.js # Watcher: commit + push automático
│
├── _backup/ # Archivos históricos (NO editar)
│
├── README.md # Indice maestro. INICIO AQUI.
├── targets.yaml # Fuente única de targets de deploy: script_id + sheet_id por planilla (Fase 0 del arnés)
├── sync_targets.command # Deploy oficial: drift-check + confirmación + push por target con restauración de .clasp.json (Fase 1; excepción a *.command en .gitignore)
├── .clasp.json # Config de Clasp (deploy a Apps Script)
├── .claspignore # Archivos excluidos del push a GAS
├── .gitignore # Archivos excluidos de Git
├── package.json # Dependencias Node.js
└── iniciar_autosync.command # Acceso directo al watcher (macOS)
```

---

## Reglas de Estructura (Obligatorias)

Estas reglas son definidas en `.agent/rules/estructura-obligatoria.md` y aplicadas por `docs-keeper` (Claude Code) y `agente-contextual` (Antigravity):

| Regla | Detalle |
|---|---|
| [PROHIBIDO] No crear carpetas en raíz | Solo las carpetas existentes. Actualizar este archivo primero. |
| [PROHIBIDO] No guardar código fuera de `/src/` | Todo `.js` de Apps Script va en `src/`. |
| [PROHIBIDO] No tocar `/_backup/` | Solo lectura. Archivos históricos. |
| [PROHIBIDO] No crear docs fuera de `/docs/` | Toda documentación técnica va en `docs/permanente/`. |
| [REQUERIDO] Actualizar `ESTRUCTURA.md` antes de crear | Este archivo se actualiza PRIMERO. |
| [REQUERIDO] Reportar archivos fuera de lugar | El agente los mueve o informa al usuario. |

---

## Workflow de Cierre de Feature

El pipeline estándar para cerrar cualquier feature:

```
1. appscript-backend → implementa lógica GAS (src/*.js)
2. appscript-ui      → implementa popup/interfaz HTML
3. lean-refactor     → limpieza final (si aplica)
4. docs-keeper       → actualiza ZZ_Changelog.js + HISTORIAL_DESARROLLO.md + ESTRUCTURA.md
5. tidetrack-pm      → commit semántico + push
```

---

## Estado de Modulos en `/src/`

| Archivo | Estado | Versión intro |
|---|---|---|
| `00_Config.js` | Activo | v0.1.0 |
| `01_Version.js` | Activo | v0.1.0 |
| `02_Utils.js` | Activo | v0.1.0 |
| `03_SheetManager.js` | Activo - optimizado en v0.4.9 | v0.1.0 |
| `06_RegistrosService.js` | Activo - pipeline batch procesarCargas() | v0.5.0 |
| `07_MiradaInteranual.js` | Activo - fórmulas de "Mirada Interanual" (adoptado de producción) | v0.8.2 |
| `11_UIService.js` | Activo - endpoints ABM en v0.4.7 | v0.4.0 |
| `12_MenuService.js` | Activo | v0.4.0 |
| `13_NavigationService.js` | Activo | v0.4.0 |
| `14_EventHandlers.js` | Activo - appOnEdit con autocomplete y protección | v0.5.0 |
| `15_ExchangeRateApi.js` | Activo - cotizaciones + custom functions GAS | v0.6.0 |
| `98_DevTools_Scanner.js` | Activo - exporta JSON de arquitectura completa | v0.8.0 |
| `99_MigrationLogic.js` | Activo - migración desde BD antigua (legacy) | v0.5.0 |
| `DEVTOOL_AltaCuentas.js` | Activo - alta de cuentas faltantes en el catálogo | v0.15.0 |
| `DEVTOOL_BloqueCategorias.js` | Activo - bloque Categorías por categoría de cuenta | v0.22.0 |
| `DEVTOOL_CableadoPresupuesto.js` | **Fuera del menú** - NO LISTO, bloqueantes abiertos | v0.9.x |
| `DEVTOOL_Capitalizacion.js` | Activo - identidad Ingresos=Fijos+Variables+Capitalización | v0.26.0 |
| `DEVTOOL_CategorizarCuentas.js` | Activo - cuenta → categoría (eje del motivo) | v0.19.0 |
| `DEVTOOL_ConciliarSaldos.js` | Activo - concilia saldos por medio vía cuenta 'Ajuste' | v0.17.0 |
| `DEVTOOL_FormatoMedios.js` | Activo - pinta cada medio con el color de su Tipo | v0.30.1 |
| `DEVTOOL_FormulerioV0111.js` | Activo - repara el formulerío de Inicio/Tablero post-swap | v0.12.0 |
| `DEVTOOL_InicioPresupuesto.js` | Activo - bloque "Presupuesto del Mes" de Inicio | v0.31.0 |
| `DEVTOOL_LimpiarPlanCuentas.js` | Activo - catálogo final, todas las categorías en P | v0.21.0 |
| `DEVTOOL_Presupuesto.js` | **Fuera del menú** - NO LISTO, bloqueantes abiertos | v0.9.x |
| `DEVTOOL_PresupuestoBase.js` | Activo - presupuesto base por promedio histórico móvil | v0.25.0 |
| `DEVTOOL_PresupuestoGuardar.js` | Activo - guarda Monto a Proyectar con TCs congelados (etapa 3) | v0.46.1 |
| `DEVTOOL_PresupuestoModo.js` | Activo - selector de Modo + columnas J/N/R (etapa 1) | v0.45.0 |
| `DEVTOOL_PresupuestoResumen.js` | Activo - agrupado por categoría V/W (etapa 2) | v0.45.1 |
| `DEVTOOL_Proyeccion.js` | Activo - BD de Proyección + Presupuesto Asignado | v0.18.0 |
| `DEVTOOL_PurgaRespaldos.js` | Activo - borra hojas de respaldo acumuladas | v0.44.0 |
| `DEVTOOL_RiquezaYCategorias.js` | Activo - riqueza por lista blanca + columna Tipo | v0.13.0 |
| `DEVTOOL_RobustezVistas.js` | **Fuera del menú** - sus anclas son PRE-Fix, re-verificar | v0.9.x |
| `DEVTOOL_StockYFlujo.js` | Activo - saldos bancarios reales, capitalización residual | v0.14.0 |
| `DEVTOOL_TableroFaltanteProyectado.js` | Activo - sección "Faltante proyectado" en el Tablero | v0.36.0 |
| `DEVTOOL_TipoDeMedios.js` | Activo - medio → tipo (eje patrimonial) | v0.20.0 |
| `MIGRACION_v0.11_SwapHojasFix.js` | Aplicada en producción el 2026-08-18; quedan Ver estado y Purgar | v0.11.0 |
| `MIGRACION_v0.9.5_LayoutNuevo.js` | **Obsoleta** - guard derivado de RANGES en toda función que escribe | v0.9.5 |
| `MIGRACION_v031_Historico.js` | Activo - cruce por ausencia, re-ejecutable | v0.11.0 |
| `UI_AbmPlanCuentas.html` | Activo - ABM multi-entidad Plan de Cuentas | v0.4.1 |
| `UI_SharedStyles.html` | Activo - Design System institucional (neumorphic) | v0.4.3 |
| `ZZ_Changelog.js` | Activo | v0.4.0 |
| `appsscript.json` | Activo | v0.1.0 |

---

*Tidetrack - ESTRUCTURA.md - v0.47.0 - 2026-08-25*
