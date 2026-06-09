# Planilla Finanzas Personales — Contrato del Agente

> Leer este archivo completo antes de ejecutar cualquier tarea. Tiene prioridad sobre cualquier suposición.

## Qué es este proyecto

**Tidetrack Personal Finance Tracker** — sistema de finanzas personales construido sobre Google Sheets + Google Apps Script. v0.7.0 (2026-03-20). Filosofía *Principles First*: fricción mínima, hábito cotidiano, legibilidad directa en la hoja.

Este repo contiene el código Apps Script de la planilla. **No es la app web** — es el prototipo funcional en producción que el equipo y los clientes usan hoy. La app web está en `tidetrack/planilla-pymes` (PyME) y en la Tidetrack App (personales, stack Next.js).

**Stack:**
- Base de datos: Google Sheets (hojas modulares con rangos fijos)
- Backend: Google Apps Script (JavaScript numerado 00_–99_)
- Frontend: HtmlService (popups modales)
- Deploy local: Clasp + Node.js
- Sync: `auto-sync.js` (watcher automático de commits)

## Comandos esenciales

```bash
npm run push    # clasp push — sube código a Apps Script
npm run watch   # clasp push --watch — sube en modo watcher
npm run pull    # clasp pull — baja código desde la nube
node scripts/auto-sync.js   # watcher de GitHub (commit+push automático)
# O doble clic en iniciar_autosync.command desde Finder
```

## Arquitectura — Hojas Modulares

Cada hoja es una tabla independiente con rangos de columnas fijos. **NUNCA cambiar la estructura de columnas sin actualizar `00_Config.js`**.

| Hoja | Contenido |
|---|---|
| `Plan de Cuentas` | Catálogos: Ingresos, Gastos Fijos, Gastos Variables, Medios de Pago, Proyectos |
| `Hoja de Cargas` | Data Entry con autocompletado — columnas definidas en `00_Config.js` |
| `Tablero General` | Dashboard vía `QUERY()` — solo lectura |
| `Presupuestación` | Planificación mensual |
| `Resumen Anual` | Análisis histórico |
| `Tipo de Cambio` | Caché de cotizaciones USD históricas |

## Módulos del código (`/src`)

| Archivo | Responsabilidad |
|---|---|
| `00_Config.js` | Single Source of Truth: rangos, nombres de hojas, monedas, enums |
| `01_Version.js` | Control de versión semántica |
| `02_Utils.js` | Logging, notificaciones, helpers |
| `03_SheetManager.js` | Capa de acceso a datos: `getTableData`, `appendRow`, `updateRow`, `deleteRow` |
| `06_RegistrosService.js` | Lógica de movimientos financieros |
| `11_UIService.js` | Apertura de popups, endpoints para `google.script.run` |
| `12_MenuService.js` | Menú "Tidetrack" en Google Sheets |
| `15_ExchangeRateApi.js` | Motor FX: dolarapi.com → caché → argentinadatos.com → fallback |
| `99_MigrationLogic.js` | Motor de importación de BD legacy 2024+ |
| `ZZ_Changelog.js` | Historial de versiones in-code |

## Lógica crítica (no tocar sin entender)

**Motor FX — prioridad de resolución de cotización USD:**
1. Fecha = HOY → `dolarapi.com/v1/dolares/oficial`
2. Fecha histórica → caché en hoja `Tipo de Cambio`
3. Sin caché → `api.argentinadatos.com/v1/cotizaciones/dolares/oficial`
4. Fallback → día hábil anterior más cercano
5. Último recurso → valor 1 (siempre loguear, nunca silencioso)

**Triangulación relacional:** Cuenta → Proyecto → UEN (auto-inferido). Nunca hardcodear proyectos o UEN.

**IDs de compromisos:** formato `CXC-YYYYMMDD-NNN` / `CXP-YYYYMMDD-NNN`. Verificar duplicados en BD Y en lote actual antes de generar.

## Reglas irrompibles

- Nunca hardcodear nombres de hojas — usar constantes de `00_Config.js`
- Nunca asumir posiciones de columnas sin verificar `00_Config.js`
- No modificar archivos en `_backup/` — solo referencia histórica
- Todo cambio en el modelo de datos → actualizar `00_Config.js` primero
- Nunca silenciar errores de la API de tipo de cambio — siempre loguear el fallback

## Vault Cluster — Inteligencia de Negocio

Este repo es parte del ecosistema Cluster de Franco Díaz Pizarro. La inteligencia de negocio vive en el vault Obsidian (`tidetrack/vault-obsidian-sync`). Antes de tomar decisiones, consultá:

- **Producto**: `04 RECURSOS/productos/Planilla Finanzas.md` — arquitectura, decisiones, fricción conocida
- **App destino**: `04 RECURSOS/productos/Tidetrack App.md` — la app web que reemplaza esta planilla
- **Unidad**: `03 UNIDADES/tidetrack/`
- **Clientes activos**: `02 PROYECTOS/` — buscar clientes con `unit: tidetrack`

**Regla de doble escritura:** toda decisión de arquitectura relevante → documentar en `04 RECURSOS/productos/Planilla Finanzas.md` del vault.

## Convención de commits (universal — igual en todos los repos del Cluster)

Formato: `tipo(scope): descripción en español`

**Tipos:** `feat` · `fix` · `chore` · `refactor` · `docs` · `test`

**Scopes sugeridos:** `fx` · `registros` · `plan-cuentas` · `ui` · `config` · `migration` · `sheets`

**Ejemplos:**
```
feat(registros): agregar validación de monto negativo en cargas
fix(fx): corregir caché de cotización para fin de semana
chore(config): agregar nueva moneda EUR al plan de cuentas
docs(claude): actualizar CLAUDE.md con estado del proyecto
```

**Branches:** `feat/[slug]` · `fix/[slug]` · `chore/[slug]`

## Equipo

**Franco Díaz Pizarro** — dueño del producto, clientes activos, decisiones de negocio.
**Marcos (Dima)** — identidad visual, diseño de UI popups.
