# Estructura del Proyecto - Tidetrack Personal Finance

Este documento describe la organización de carpetas del proyecto.

---

## 📁 Estructura de Carpetas

```
planilla-finanzas-personales/  # Tid etrack Personal Finance Tracker
├── 📁 scripts/                  # Scripts locales auxiliares (.js)
│
├── 📁 src/                     # Código fuente
│   ├── Bloques .js (00-12, 98-99) # 16 módulos backend (v0.4.0)
│   ├── Archivos HTML UI           # 7 vistas y componentes (v0.4.0)
│   └── appsscript.json            # Manifest OAuth
│
├── 📁 docs/                    # Documentación
│   ├── 📁 permanente/          # Docs permanentes
│   │   ├── ARQUITECTURA_AGENTICA.md  # Sistema multi-agente de desarrollo
│   │   ├── CHANGELOG.md              # Historial completo de versiones (v0.1-v0.4)
│   │   ├── DATABASE_SCHEMA.md        # Esquema BD completo (6 tablas)
│   │   ├── GUIA_ARQUITECTURA.md      # ADRs y arquitectura técnica
│   │   ├── GUIA_MODULOS.md           # Documentación de módulos .js
│   │   ├── HISTORIAL_DESARROLLO.md   # Evolución cronológica completa
│   │   ├── planilla-reinversión.md   # Documento base de reinversión del alcance
│   │   ├── RESUMEN_PROYECTO.md       # Visión general de Tidetrack
│   │   ├── CONTEXTO_NEGOCIO.md       # Círculo de Oro, modelo de negocio
│   │   ├── ROADMAP_PRODUCTO.md       # Etapas y prioridades
│   │   ├── PRINCIPIOS_DISEÑO.md      # UX, hábitos, lenguaje humano
│   │   └── database_er_diagram.png   # Diagrama ER de base de datos
│   ├── 📁 sesiones/            # Docs de sesiones de trabajo
│   ├── PRODUCT_BACKLOG.md      # Backlog y roadmap
│   ├── REGLAS_AGENTE.md        # Reglas de desarrollo
│   └── README.md               # Índice de documentación
│
├── 📁 _backup/                 # Archivos históricos (no usar)
│
├── 📁 .agent/                  # Configuración de agentes IA
│   ├── rules/                  # Reglas generales
│   │   ├── dispatcher.md       # Enrutamiento de agentes
│   │   └── estructura-obligatoria.md  # Cumplimiento de estructura
│   └── workflows/              # Agentes especializados
│       ├── product-manager.md
│       ├── ui-ux-designer.md
│       ├── agente-contexctual.md
│       ├── qa-tester.md
│       ├── security-auditor.md
│       └── backend-architect.md
│
├── 📄 README.md                # ← INICIO AQUÍ
├── 📄 ESTRUCTURA.md            # Este archivo
└── 📄 Notas Fran.md            # Notas personales
```

---

## 🎯 Propósito de Cada Carpeta

### `/src` - Código Fuente

Sistema completo de Apps Script para gestión de finanzas personales.

**Backend (16 módulos .js):**
- `00_Config.js` hasta `12_MenuService.js` - Core del sistema
- `98_DataSeeder.js`, `99_SetupDirect.js`, `99_ForceReload.js` - Utilidades
- `appsscript.json` - Manifest OAuth

**Frontend (7 archivos HTML):**
- Design System: `CSS_DesignSystem.html`, `CSS_Components.html`
- Vistas: `UI_TransactionForm.html`, `UI_MainDashboard.html`
- Componentes: `JS_FormValidation.html`, `JS_ApiClient.html`
- Testing: `UI_DesignSystemTest.html`

### `/docs` - Documentación

Toda la documentación del proyecto:

#### `/permanente` - Documentación Permanente

Documentos que se mantienen actualizados:

| Archivo | Propósito |
|-|--|
| `ARQUITECTURA_AGENTICA.md` | Sistema multi-agente para desarrollo |
| `CHANGELOG.md` | Historial completo de versiones v0.1-v0.4 |
| `DATABASE_SCHEMA.md` | Esquema completo de BD (6 tablas relacionales) |
| `GUIA_ARQUITECTURA.md` | ADRs y decisiones de arquitectura técnica |
| `GUIA_MODULOS.md` | Documentación técnica de módulos .js |
| `HISTORIAL_DESARROLLO.md` | Evolución cronológica del proyecto |
| `planilla-reinversión.md` | Hito de reinversión: Principios de simplificación y modularidad |
| `RESUMEN_PROYECTO.md` | Visión, propuesta de valor, diferenciadores |
| `CONTEXTO_NEGOCIO.md` | Círculo de oro, modelo de negocio, estrategia |
| `ROADMAP_PRODUCTO.md` | Etapas de desarrollo y prioridades |
| `PRINCIPIOS_DISEÑO.md` | Reglas de UX, hábitos, multi-moneda |
| `database_er_diagram.png` | Diagrama ER de relaciones entre tablas |

#### `/sesiones` - Histórico de Sesiones

Documentación de sesiones de trabajo específicas.

### `/_backup` - Archivos Históricos

Archivos legacy que se mantienen por referencia. **NO editar ni usar**.

### `/.agent` - Sistema de Agentes IA

Configuración del sistema multi-agente para desarrollo colaborativo con IA.

---

## 🔄 Workflow de Desarrollo

1. **Planificar**: Sprint planning y definición de alcance ✅
2. **Diseñar**: Modelo de datos y arquitectura ✅
3. **Implementar**: Código backend y frontend ✅ (Sprints 0-3)
4. **Testing**: Validación manual y automatizada ✅
5. **Documentar**: Actualizar CHANGELOG, HISTORIAL, GUIA_MODULOS ✅
6. **Release**: Marcar versión y registrar en CHANGELOG ✅

**Estado Actual:** v0.4.0 - Sprint 3 completado al 100%

---

## 📝 Archivos Importantes en Raíz

- **README.md**: Punto de entrada del proyecto
- **ESTRUCTURA.md**: Este archivo - mapa de carpetas
- **Notas Fran.md**: Notas personales

---

**Proyecto**: Tidetrack Personal Finance Tracker  
**Última actualización**: 2026-01-23  
**Versión actual**: v0.4.0 (Sprint 3 completo)
