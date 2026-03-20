# Tidetrack - Personal Finance Tracker

> "Paz financiera, todos los días."

Sistema de finanzas personales *Principles First*, construido sobre Google Sheets + Apps Script. Diseñado para sostener un hábito cotidiano con fricción mínima, operado a través de Hojas Modulares escalables y preparado para integrarse con herramientas de IA (MCP, Claude Code).

---

## Wiki del Proyecto

Este repositorio sirve como documentación técnica completa. Cada sección es una página de referencia navegable.

| Documento | Propósito |
|---|---|
| [README.md](./README.md) | Este archivo. Índice maestro del proyecto. |
| [ESTRUCTURA.md](./ESTRUCTURA.md) | Mapa de archivos y carpetas del repo. |
| [Módulos del Sistema](./docs/permanente/GUIA_MODULOS.md) | Documentación técnica de cada archivo `.js`. |
| [Guía de Arquitectura + ADRs](./docs/permanente/GUIA_ARQUITECTURA.md) | Decisiones técnicas formales (Architecture Decision Records). |
| [Historial de Desarrollo](./docs/permanente/HISTORIAL_DESARROLLO.md) | Bitácora cronológica completa del proyecto. |
| [Schema de Base de Datos](./docs/permanente/DATABASE_SCHEMA.md) | Estructura de tablas en Google Sheets. |
| [Contexto de Negocio](./docs/permanente/CONTEXTO_NEGOCIO.md) | Círculo de oro, propuesta de valor y estrategia. |
| [Roadmap de Producto](./docs/permanente/ROADMAP_PRODUCTO.md) | Etapas del MVP a la plataforma. |
| [Principios de Diseño](./docs/permanente/PRINCIPIOS_DISEÑO.md) | Reglas de UX, hábito como tecnología, multi-moneda. |
| [Product Backlog](./docs/PRODUCT_BACKLOG.md) | Sprints completados y features pendientes. |
| [Arquitectura Agéntica](./docs/permanente/ARQUITECTURA_AGENTICA.md) | Sistema multi-agente de desarrollo con IA. |
| [Changelog Completo](./docs/permanente/CHANGELOG.md) | Historial de versiones v0.1 a actual. |

---

## Qué es Tidetrack?

**Tidetrack** es una herramienta de registro ultrarrápido, lectura clara y planificación financiera personal. El proyecto pivotó de una arquitectura relacional compleja hacia un **Ecosistema de Hojas Modulares**, donde cada entidad (Ingresos, Gastos, Medios de Pago, etc.) vive en su propia hoja independiente con rangos fijos.

Esto hace que los datos sean:
- **Legibles directamente** en la hoja de cálculo
- **Estables** ante cambios en otros módulos
- **Consumibles por IA** sin transformaciones adicionales

---

## Arquitectura del Sistema

### Hojas Modulares (Google Sheets)

El sistema está compuesto por hojas independientes. Cada una tiene rangos fijos de columnas y actúa como una tabla de base de datos.

| Hoja | Rango | Contenido |
|---|---|---|
| `Plan de Cuentas` | I:K, M:O, Q:S, U:W, Y:Z | Catálogos: Ingresos, Costos Fijos, Costos Variables, Medios de Pago, Proyectos |
| `Hoja de Cargas` | *(pendiente)* | Data Entry simplificado |
| `Tablero General` | *(pendiente)* | Dashboard con métricas del mes vía `QUERY()` |
| `Presupuestación` | *(pendiente)* | Módulo de planificación mensual |
| `Resumen Anual` | *(pendiente)* | Análisis histórico por año |

### Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Base de datos | Google Sheets (hojas modulares con rangos fijos) |
| Backend / Automatización | Google Apps Script (JavaScript) |
| Frontend | HtmlService (popups modales) |
| Deploy local | [Clasp](https://github.com/google/clasp) + Node.js |
| Versionado | Git + GitHub (watcher automático via `auto-sync.js`) |
| Monedas soportadas | ARS (base), USD, EUR, AUD |

---

## Código Fuente (`/src`)

Todos los archivos están numerados para garantizar el orden de carga en Apps Script.

### Backend - Módulos `.js`

| Archivo | Responsabilidad |
|---|---|
| `00_Config.js` | Constantes globales, rangos de tablas, monedas disponibles, enums |
| `01_Version.js` | Control de versión semántica del proyecto |
| `02_Utils.js` | Utilidades generales (logging, notificaciones, helpers) |
| `03_SheetManager.js` | Capa de acceso a datos: `getTableData`, `appendRow`, `updateRow`, `deleteRow` |
| `11_UIService.js` | Servicios de UI: apertura de popups, endpoints para `google.script.run` |
| `12_MenuService.js` | Menú personalizado "Tidetrack" en Google Sheets |
| `13_NavigationService.js` | Gestión de navegación entre hojas |
| `ZZ_Changelog.js` | Registro in-code de cambios por versión |

### Frontend - Archivos `.html`

| Archivo | Responsabilidad |
|---|---|
| `UI_SharedStyles.html` | Design System CSS compartido (variables, paleta, tipografía) |
| `UI_AbmPlanCuentas.html` | ABM multi-entidad para el Plan de Cuentas (Alta/Baja/Modificación) |

---

## Ecosistema Agéntico

El proyecto se desarrolla con un equipo de agentes de IA especializados en [Antigravity](https://antigravity.dev). Cada agente tiene **una responsabilidad única** y opera en una secuencia coordinada.

```
 [ tidetrack-pm ] <- Dispatcher Central
 |
 ┌───────────────────┴──────────────────────┐
 v v v
 [agente-contextual] [appscript-backend] [appscript-ui]
 (historial + ADRs) (lógica GAS + Sheets) (popups HTML)
 v v v
 [lean-code-expert] [auto-changelog] [github-docs]
 (limpieza 0 waste) (versionado auto) (README + docs)
 |
 [github-sync]
 (commit + push)
```

| Agente | Slug | Responsabilidad |
|---|---|---|
| Orquestador | `tidetrack-pm` | Dispatcher central. Enruta todos los pedidos al agente correcto. |
| Bibliotecario | `agente-contextual` | Memoria interna del proyecto. Historial, ADRs, estructura canónica. |
| Backend GAS | `appscript-backend` | Lógica de Apps Script: services, SheetManager, triggers. |
| Frontend GAS | `appscript-ui` | UI popups HTML + Design System + `google.script.run`. |
| Cirujano Lean | `lean-code-expert` | Elimina código muerto, variables sin uso y duplicidad sin piedad. |
| Changelog | `auto-changelog` | Actualiza `ZZ_Changelog.js` al cerrar cada feature. |
| Redactor | `github-docs` | Mantiene README, historial público y documentación GitHub. |
| Git | `github-sync` | Commits semánticos convencionales + push automático. |

> Nota: La documentación está escrita para que cualquier LLM pueda leer este repositorio, entender el contexto completo y operar sobre las hojas de cálculo sin fricción.

---

## Estado Actual del Proyecto

**Versión**: `v0.4.9` | **Fecha**: 2026-03-20

| Sprint | Versión | Estado | Descripción |
|---|---|---|---|
| Sprint 0 | v0.1.0 | Completo | Core setup: Config, Utils, SheetManager |
| Sprint 1 | v0.2.0 | Completo | Exchange Rates + integración API |
| Sprint 2 | v0.3.0 | Completo | Catálogos + CRUD + 41/41 tests |
| Sprint 3 | v0.4.0 | Completo | UI Design System neumórfico |
| ABM Plan Cuentas | v0.4.1-v0.4.9 | Completo | ABM multi-entidad + optimización |
| Hoja de Cargas | v0.5.0 | Próximo | Data Entry simplificado |
| Módulos Análisis | v0.6.0+ | Roadmap | Dashboard, Presupuestación, Anual |

---

## Estructura de Carpetas

```text
/
├── .agent/ # Skills y workflows de los agentes de IA
│ ├── skills/ # Un directorio por agente con su SKILL.md
│ ├── rules/ # Reglas de estructura y dispatch
│ └── workflows/ # Flujos de trabajo reutilizables
├── src/ # Código fuente: .js (backend) + .html (frontend)
├── docs/ # Documentación del proyecto
│ ├── permanente/ # Documentos vivos: historial, ADRs, guías
│ └── sesiones/ # Notas de sesiones de trabajo
├── scripts/ # Herramientas locales (ej. auto-sync.js)
├── _backup/ # Archivos históricos (solo referencia, no editar)
└── README.md # Índice maestro <- estás aquí
```

Ver [ESTRUCTURA.md](./ESTRUCTURA.md) para el mapa detallado de cada archivo.

---

## Cómo Trabajar con Este Repo

### Deploy a Google Apps Script

```bash
# Instalar dependencias
npm install

# Push del código a Apps Script
npx clasp push

# Ver logs en tiempo real
npx clasp logs --watch
```

### Watcher automático de GitHub

```bash
# Inicia el watcher que hace commit+push automatico en cada cambio
node scripts/auto-sync.js
```

O doble clic en `iniciar_autosync.command` desde Finder.

### Convención de commits

El proyecto usa [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(abm): agregar validación de duplicados
fix(sheet-manager): corregir búsqueda de última fila
docs(readme): actualizar tabla de módulos
chore(config): agregar moneda AUD
```

---

*Tidetrack Personal Finance Tracker - v0.4.9 - Última actualización: 2026-03-20*