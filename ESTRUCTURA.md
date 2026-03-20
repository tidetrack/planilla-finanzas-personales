# Mapa de Archivos - Tidetrack Personal Finance

> Propósito: Fuente de verdad sobre la organización del repositorio. Toda nueva carpeta o archivo debe registrarse aquí antes de crearse. Los agentes de IA usan este documento como referencia canónica.

Versión: v0.4.9 | Última actualización: 2026-03-20

---

## Arbol de Carpetas

```
planilla-finanzas-personales/
│
├── src/ # Código fuente (Apps Script)
│ ├── 00_Config.js # Constantes, rangos, enums, monedas
│ ├── 01_Version.js # Control de versión semántica
│ ├── 02_Utils.js # Utilidades generales y logging
│ ├── 03_SheetManager.js # Layer de acceso a datos (CRUD sobre Sheets)
│ ├── 11_UIService.js # Servicios de UI y endpoints GAS
│ ├── 12_MenuService.js # Menú personalizado "Tidetrack"
│ ├── 13_NavigationService.js # Navegación entre hojas
│ ├── UI_SharedStyles.html # Design System CSS compartido
│ ├── UI_AbmPlanCuentas.html # ABM multi-entidad Plan de Cuentas
│ ├── ZZ_Changelog.js # Historial de versiones in-code
│ └── appsscript.json # Manifest OAuth de Apps Script
│
├── docs/ # Documentación del proyecto
│ ├── permanente/ # Documentos vivos (actualización continua)
│ │ ├── ARQUITECTURA_AGENTICA.md # Sistema multi-agente de desarrollo
│ │ ├── CHANGELOG.md # Historial completo de versiones
│ │ ├── CONTEXTO_NEGOCIO.md # Círculo de oro, modelo de negocio
│ │ ├── DATABASE_SCHEMA.md # Esquema de tablas en Google Sheets
│ │ ├── GUIA_ARQUITECTURA.md # ADRs y decisiones técnicas formales
│ │ ├── GUIA_MODULOS.md # Documentación técnica de módulos .js
│ │ ├── HISTORIAL_DESARROLLO.md # Bitácora cronológica del proyecto
│ │ ├── planilla-reinversión.md # Documento fundacional del pivote
│ │ ├── PRINCIPIOS_DISEÑO.md # Reglas de UX y experiencia de usuario
│ │ ├── RESUMEN_PROYECTO.md # Visión general de Tidetrack
│ │ ├── ROADMAP_PRODUCTO.md # Etapas y prioridades del producto
│ │ └── database_er_diagram.png # Diagrama ER de relaciones
│ ├── sesiones/ # Notas de sesiones de trabajo específicas
│ ├── PRODUCT_BACKLOG.md # Sprints y backlog priorizado
│ ├── REGLAS_AGENTE.md # Convenciones de desarrollo
│ └── README.md # Índice de documentación
│
├── .agent/ # Configuración del ecosistema agéntico
│ ├── skills/ # Un directorio por agente
│ │ ├── tidetrack-pm/ # Dispatcher y orquestador central
│ │ ├── agente-contextual/ # Bibliotecario: historial + ADRs
│ │ ├── appscript-backend/ # Experto en lógica Apps Script
│ │ ├── frontend-ui-ux/ # Especialista en HtmlService y UI
│ │ ├── auto-changelog/ # Versionado automático
│ │ ├── github-docs/ # Documentación técnica pública GitHub
│ │ ├── github-sync/ # Commits y push a repositorio
│ │ ├── lean-code-expert/ # Limpieza y refactorización
│ │ ├── creador-de-skills/ # Generador de nuevos skills
│ │ ├── gsd/ # Get Shit Done: planificación y ejecución
│ │ └── update-docs/ # Actualización de documentación
│ ├── rules/ # Reglas de cumplimiento obligatorio
│ │ ├── dispatcher.md # Lógica de enrutamiento de agentes
│ │ ├── no-emojis.md # Regla estricta de tono profesional
│ │ └── estructura-obligatoria.md # Reglas de estructura de carpetas
│ └── workflows/ # Flujos de trabajo reutilizables
│
├── scripts/ # Herramientas de automatización local
│ └── auto-sync.js # Watcher: commit + push automático
│
├── _backup/ # Archivos históricos (NO editar)
│
├── README.md # Indice maestro. INICIO AQUI.
├── ESTRUCTURA.md # Este archivo. Mapa de carpetas.
├── Notas Fran.md # Notas personales del desarrollador
├── .clasp.json # Config de Clasp (deploy a Apps Script)
├── .claspignore # Archivos excluidos del push a GAS
├── .gitignore # Archivos excluidos de Git
├── package.json # Dependencias Node.js
└── iniciar_autosync.command # Acceso directo al watcher (macOS)
```

---

## Reglas de Estructura (Obligatorias)

Estas reglas son aplicadas por el agente `agente-contextual` y definidas en `.agent/rules/estructura-obligatoria.md`:

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
1. appscript-backend → implementa lógica GAS
2. appscript-ui → implementa popup/interfaz HTML
3. lean-code-expert → limpieza final (si aplica)
4. auto-changelog → actualiza ZZ_Changelog.js
5. github-docs → actualiza README + docs públicos ← este archivo
6. github-sync → commit semántico + push
```

---

## Estado de Modulos en `/src/`

| Archivo | Estado | Versión intro |
|---|---|---|
| `00_Config.js` | Activo | v0.1.0 |
| `01_Version.js` | Activo | v0.1.0 |
| `02_Utils.js` | Activo | v0.1.0 |
| `03_SheetManager.js` | Activo - optimizado en v0.4.9 | v0.1.0 |
| `11_UIService.js` | Activo - endpoints ABM en v0.4.7 | v0.4.0 |
| `12_MenuService.js` | Activo | v0.4.0 |
| `13_NavigationService.js` | Activo | v0.4.0 |
| `UI_SharedStyles.html` | Activo - Design System institucional | v0.4.3 |
| `UI_AbmPlanCuentas.html` | Activo - ABM en refinamiento | v0.4.1 |
| `ZZ_Changelog.js` | Activo | v0.4.0 |
| `appsscript.json` | Activo | v0.1.0 |

---

*Tidetrack - ESTRUCTURA.md - v0.4.9 - 2026-03-20*
