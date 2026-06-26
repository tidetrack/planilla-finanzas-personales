# Plan de Implementacion - Tidetrack Finanzas Personales

Hoja de ruta para poner el repositorio al nivel del proyecto planilla-pymes: documentacion completa, Claude Code al tanto del estado real, Cowork como visualizador y auditor de la planilla.

**Generado:** 2026-06-05 via sesion Cowork  
**Version del producto al momento de este plan:** v0.8.0  

---

## Contexto

Este repositorio ya tiene una base solida: CLAUDE.md con ADRs, docs/permanente/ con 15+ archivos, un ecosistema multi-agente en .agent/, y el src/ con 13 modulos AppScript. Con Gemini se avanzo mucho en la logica de la planilla, especialmente el motor del Tablero. El objetivo ahora es que Claude Code tome el control total del mantenimiento, mejoras y desarrollo de la webapp, y que Cowork sirva como visualizador y auditor de la planilla en tiempo real.

---

## Modelo dual: Claude Code + Cowork

### Claude Code - Rol

Claude Code vive en el repositorio. Su funcion es:
- Mantener y mejorar el AppScript (src/)
- Documentar cambios automaticamente via skills (auto-changelog, update-docs)
- Desarrollar la webapp del portal de clientes
- Mantener sincronizado el CLAUDE.md y docs/ con el estado real

### Cowork - Rol

Cowork tiene acceso a la planilla via Chrome. Su funcion es:
- Pasear por la planilla y auditar el estado de las hojas
- Documentar cambios visuales y de layout
- Detectar discrepancias entre lo documentado y lo que hay en la planilla
- Actualizar MAPA_HOJAS.md cuando cambia la arquitectura

---

## Fase 1: Sincronizacion de Conocimiento (Inmediato)

### 1.1 Para Claude Code

**Objetivo:** Que Claude Code tenga un mapeo 100% fiel del estado actual del codebase.

Lo que falta hacer (en orden de prioridad):

**Actualizar GUIA_MODULOS.md**  
El archivo dice v0.4.8 (2026-03-17) pero los modulos estan en v0.8.0. Claude Code debe leer cada archivo de src/ y actualizar la guia con el estado real de cada modulo.

**Mover hoja-tablero.md a docs/permanente/FORMULAS_TABLERO.md**  
El archivo esta en la raiz violando la regla de estructura. Contiene la documentacion completa de las formulas del Tablero generada con Gemini. Moverlo y actualizar las referencias en CLAUDE.md.

**Ejecutar la skill `data-mapper`**  
El repo tiene la skill `.agent/skills/data-mapper/SKILL.md`. Usarla para generar un mapa actualizado de la arquitectura de datos del src/ actual.

**Ejecutar la skill `map-codebase` del flujo GSD**  
El flujo GSD tiene un agente `gsd-codebase-mapper` que genera la documentacion de arquitectura. Usarlo para tener un snapshot actualizado en `docs/permanente/`.

**Revisar y cerrar el gap de modulos faltantes**  
El _backup/ tiene modulos 04_DataValidation, 07_MedioPagoService, 08_CuentaService, 09_TransactionService que fueron deprecados en el refactor. Verificar que su logica fue absorbida en los modulos actuales y documentar el gap en HISTORIAL_DESARROLLO.md.

### 1.2 Para Cowork

**Objetivo:** Documentar visualmente lo que Claude Code no puede ver.

Lo que ya se hizo en esta sesion:
- Mapeados los GIDs de todas las hojas (MAPA_HOJAS.md creado)
- Identificadas las hojas ocultas: CALCU, ANUAL, DATA-ENTRY, CARGAS (Forest.), BD Antigua, Mirada Interanual backup, PALETAS
- Confirmado el layout de Tablero, Plan de Cuentas, Registros, Cargas

Lo que falta hacer en sesiones Cowork:
- Navegar CALCU (gid=367882887) y documentar su layout interno en MAPA_HOJAS.md
- Navegar ANUAL (gid=1358411018) y documentar su layout interno
- Confirmar visualmente el rango de carga I5:O19 en Cargas y los dropdowns que consume
- Documentar los botones, filtros y controles UX de cada hoja visible
- Revisar DATA-ENTRY (gid=1849033622) y validar que el schema en DATABASE_SCHEMA.md esta al dia

---

## Fase 2: Completar el Producto (3-6 semanas)

Pendientes del roadmap v0.8.0 que Claude Code debe resolver:

### 2.1 Dashboard/Tablero

El Tablero existe en la planilla con sus formulas documentadas en FORMULAS_TABLERO.md. Lo que falta en el AppScript es el soporte backend para que las formulas del Tablero tengan datos frescos. Especificamente:

- Implementar la lectura de presupuesto mensual (S13:S15) desde un ABM similar al de Plan de Cuentas
- Documentar y eventualmente migrar las formulas del Tablero a CALCU para que el Tablero solo consuma resultados (separacion de concerns, ADR-006)

### 2.2 Presupuestacion mensual

El Tablero ya tiene la columna de "Presupuesto" (S13:S15) pero el ingreso de esos valores es manual. Agregar un ABM de presupuesto mensual similar al ABM de Plan de Cuentas.

### 2.3 Resumen anual

La hoja Mirada Interanual existe pero ANUAL (el motor) no esta completamente documentado. Claude Code debe leer el estado actual de ANUAL, documentarlo en MAPA_HOJAS.md y luego completar el motor si tiene gaps.

---

## Fase 3: Webapp - Portal de Clientes

El objetivo de largo plazo del repositorio es migrar a una webapp independiente. El CLAUDE.md ya lo documenta. El plan de desarrollo es:

### Arquitectura target

```
planilla-finanzas-personales/
  src/           # AppScript (backend actual - se mantiene en paralelo)
  webapp/        # Portal de clientes (nueva)
    api/         # REST API (Node.js / Express o similar)
    frontend/    # Dashboard web
    shared/      # Tipos compartidos, validaciones
  docs/          # Documentacion unificada
```

### Stack sugerido

- **API:** Node.js + Express (misma stack que los scripts existentes)
- **DB:** PostgreSQL (migracion 1:1 desde Sheets segun DATABASE_SCHEMA.md)
- **Frontend:** React + Design System existente (neumorphic, League Spartan)
- **Auth:** A definir (Google OAuth natural para usuarios de Sheets)

### Primer milestone de webapp

Antes de empezar a codear, Claude Code debe:
1. Crear `webapp/` con la estructura base
2. Hacer un Discovery (`gsd-discovery-phase`) para definir el MVP del portal
3. Definir que datos expone la API (lectura de Registros, Tablero, Plan de Cuentas)

---

## Checklist de Estado del Repositorio

### Documentacion

- [x] CLAUDE.md con ADRs y reglas
- [x] DATABASE_SCHEMA.md (schema futuro)
- [x] CONTEXTO_DATOS.md
- [x] CONTEXTO_NEGOCIO.md
- [x] RESUMEN_PROYECTO.md
- [x] ROADMAP_PRODUCTO.md
- [x] HISTORIAL_DESARROLLO.md
- [x] GUIA_ARQUITECTURA.md
- [x] MAPA_HOJAS.md (creado 2026-06-05)
- [ ] FORMULAS_TABLERO.md (mover desde raiz hoja-tablero.md)
- [ ] GUIA_MODULOS.md actualizada a v0.8.0
- [ ] Layout interno de CALCU documentado
- [ ] Layout interno de ANUAL documentado

### AppScript (src/)

- [x] 00_Config.js
- [x] 01_Version.js
- [x] 02_Utils.js
- [x] 03_SheetManager.js
- [x] 06_RegistrosService.js
- [x] 11_UIService.js
- [x] 12_MenuService.js
- [x] 13_NavigationService.js
- [x] 14_EventHandlers.js
- [x] 15_ExchangeRateApi.js
- [x] 98_DevTools_Scanner.js
- [x] 99_MigrationLogic.js
- [ ] Modulo de presupuestacion mensual (pendiente)
- [ ] Modulo de resumen anual (pendiente)

### Infraestructura del Agente (.agent/)

- [x] Rules: dispatcher, estructura-obligatoria, no-emojis
- [x] Skills: appscript-backend, data-mapper, frontend-ui-ux, github-docs, gsd, auto-changelog, agente-contextual
- [x] Workflows: backend-architect, gsd, product-manager, qa-tester, ui-ux-designer

### Webapp

- [ ] Estructura webapp/ creada
- [ ] Discovery completado
- [ ] API v1 (lectura de datos)
- [ ] Frontend MVP

---

## Como usar este plan

**Claude Code**: leer este archivo al inicio de cada sesion de trabajo, marcar los items del checklist, y actualizar HISTORIAL_DESARROLLO.md al completar cada milestone.

**Cowork**: usar este archivo como guia para saber que auditar en la planilla. Cada sesion de navegacion debe traducirse en una actualizacion de MAPA_HOJAS.md.

**Ambos**: ante cualquier decision arquitectonica que no este cubierta por los ADRs existentes, abrir un nuevo ADR en GUIA_ARQUITECTURA.md antes de implementar.

---

**Proxima sesion sugerida (Claude Code):** actualizar GUIA_MODULOS.md + mover hoja-tablero.md.  
**Proxima sesion sugerida (Cowork):** navegar CALCU y ANUAL para documentar su layout.
