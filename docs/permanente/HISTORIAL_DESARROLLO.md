# Historial de Desarrollo - Tidetrack Personal Finance

Registro cronológico de la evolución del proyecto y decisiones importantes.

**Formato:** Las entradas más recientes aparecen primero (orden cronológico inverso).

---

## 2026-03-20 - Refactorización de Columnas "Cargas" y "Registros" (v0.6.1)

### Evento
El usuario modificó la estructura de las hojas Cargas y Registros, separando el campo "Tipo" manual (Ingreso/Egreso) del "Tipo de Cuenta" (Ingreso, Costo Fijo, Costo Variable), que ahora se deduce en backend sin afectar el Data Entry frontal.

### Decisiones Técnicas
- Se desenchufó el onEdit anterior en `14_EventHandlers.js` que autocompletaba el viejo campo Tipo.
- El `06_RegistrosService.js` ahora toma el array de 7 elementos [Monto, Tipo, Cuenta, Medio, Moneda, Fecha, Nota] y fabrica un registro de 12 elementos.
- Se implementó la lógica `ingresosCat.includes(cuentaName)` dentro del forEach de procesamiento para deducir el "Tipo de Cuenta" haciendo cruce directo con los rangos definidos en Plan de Cuentas, y ahorrando una columna en el UI frontal del usuario.

### Archivos Modificados
- **`[MOD]` `src/14_EventHandlers.js`** — Limpieza de listener de columna.
- **`[MOD]` `src/00_Config.js`** — Rango `REGISTROS` ahora es `I:T`.
- **`[MOD]` `src/06_RegistrosService.js`** — Nuevos índices de array y cruce de categorías para deducción.

---

## 2026-03-20 - Sistema de Registros Batch y APIs Multi-Moneda (v0.6.0)

### Evento
Implementación completa del flujo de datos definitivo: traslado en lote desde la hoja "Cargas" a la base de datos "Registros", enriqueciendo cada transacción con cotizaciones históricas de diversas APIs utilizando el USD como ancla.

### Decisiones Técnicas (ADR-003)
- Se desarrolló un sistema **Batch Transfer** (`procesarCargas` en `06_RegistrosService.js`).
- **Data Lake de Cotizaciones**: Se creó la hoja "Tipos de Cambio" como memoria caché de cotizaciones para evitar peticiones redundantes.
- Las consultas históricas se resuelven contra *DolarApi* vía *argentinadatos* (ARS Oficial) y *Frankfurter* (EUR, AUD). 
- El sistema rellena el vector TC (P, Q, R, S) de forma transparente.

### Archivos Modificados/Creados
- **`[NEW]` `src/06_RegistrosService.js`** — Lógica principal de batch processing y guardado en `Registros`.
- **`[NEW]` `src/15_ExchangeRateApi.js`** — Lógicas de fetch contra APIs públicas de cotización.
- **`[MOD]` `src/00_Config.js`** — Se mapearon las nuevas entidades (`REGISTROS`, `TC_ARS`, `TC_EUR`, `TC_AUD`).
- **`[MOD]` `src/12_MenuService.js`** — Se añadió el procesador manual `[Dev] Procesar Cargas`.

---

## 2026-03-20 - Autocompletado de Hoja Cargas (v0.5.1)

### Evento
Implementación de lógica de autocompletado en la hoja "Cargas" para agilizar el Data Entry, respondiendo al diseño ágil y reduciendo fricción.

### Decisiones Técnicas
- Se extendió el sistema de `onEdit` en `14_EventHandlers.js`.
- Se rutean los eventos detectados en la hoja "Cargas" (`NAV_CONFIG.SHEETS.CARGAS`).
- Al seleccionar una Cuenta (Col J), busca sincrónicamente en qué categoría del Plan de Cuentas está y completa el Tipo (Col K).
- Al elegir un Medio (Col L), busca la moneda asociada en la tabla de Medios y la completa (Col M).
- Al cargar un Monto (Col I), completa automáticamente la Fecha (Col N) con `hoy` si la celda original estaba vacía.

### Archivos Modificados
- **`[MOD]` `src/14_EventHandlers.js`** — Controlador de eventos y autocompletado interactivo.
- **`[MOD]` `src/ZZ_Changelog.js`** — Release v0.5.1 documentada.

---

## 2026-03-20 - Creación del Agente `github-docs` y Expansión del Ecosistema Agéntico

### Evento
Se incorporó al equipo un nuevo agente especializado: `github-docs`. Este agente es responsable exclusivo de mantener la documentación técnica pública del repositorio en GitHub, cubriendo el `README.md`, el `HISTORIAL_DESARROLLO.md` y la `GUIA_ARQUITECTURA.md` desde la perspectiva de una audiencia externa (desarrolladores, colaboradores, LLMs que consuman el repo).

### Contexto
El agente `agente-contextual` cumplía un rol mixto: mantenía la memoria interna del proyecto y actuaba intermitentemente como redactor de documentación pública. Se identificó la necesidad de separar ambas responsabilidades para mayor claridad del pipeline.

### Decisiones Técnicas (ADR)
- **Separación de responsabilidades de documentación**: `agente-contextual` = memoria interna + ADRs de código. `github-docs` = documentación pública GitHub-facing.
- **Pipeline actualizado**: la secuencia estándar de cierre de feature ahora incluye un paso explícito de `github-docs` entre `auto-changelog` y `github-sync`.
- **Jerarquía en el organigrama**: `github-docs` ocupa el mismo nivel que `lean-code-expert` y `auto-changelog` (capa de cierre post-implementación), reportando al `tidetrack-pm`.

### Archivos Creados/Modificados
- **`[NEW]` `.agent/skills/github-docs/SKILL.md`** — Skill completo con workflow de 5 fases
- **`[MOD]` `.agent/skills/tidetrack-pm/SKILL.md`** — Organigrama actualizado, pipeline ampliado
- **`[MOD]` `README.md`** — Diagrama y tabla de agentes actualizados

### Resultado
- Nuevo agente `github-docs` operativo con SKILL.md completo
- Organigrama de 8 agentes actualizado en `tidetrack-pm` y `README.md`
- Pipeline de cierre de feature: `...auto-changelog → github-docs → github-sync`

---

## 2026-03-18 - Diseño y Consolidación del Ecosistema Agéntico v2.0

### Evento
Auditoría completa del equipo de agentes existente y rediseño de la arquitectura agéntica. Se consolidaron agentes redundantes, se crearon nuevos skills especializados y se estableció el `tidetrack-pm` como dispatcher central oficial.

### Contexto
El ecosistema de agentes creció orgánicamente y necesitaba un rediseño para evitar solapamiento de responsabilidades. Se evaluó cada agente contra el criterio "una responsabilidad única, no se pisa con otro".

### Decisiones Técnicas
- **`tidetrack-pm` como entry point único**: Todo pedido del usuario pasa por el dispatcher antes de ir a un agente especializado.
- **`auto-changelog` siempre antepenúltimo**: El versionado en código ocurre ANTES de documentar y ANTES del push.
- **`github-sync` siempre último**: Nada sube a GitHub hasta que todo lo anterior esté cerrado.
- **Skills auditados/reescritos**: `appscript-backend`, `appscript-ui`, `auto-changelog`, `agente-contextual`.
- **Skills nuevos**: `tidetrack-pm` como skill formal (antes era implícito).

### Resultado
- Ecosistema de 8 agentes con responsabilidades no superpuestas
- Pipeline estándar de Feature Completa documentado formalmente
- README actualizado con diagrama de arquitectura agéntica

---

## 2026-03-17 a 2026-03-20 - Sprint ABM Plan de Cuentas (v0.4.1 → v0.4.9)

### Evento
Desarrollo completo del ABM (Alta/Baja/Modificación) del Plan de Cuentas: el sistema multi-entidad que permite al usuario gestionar sus propias categorías de Ingresos, Costos Fijos, Costos Variables, Medios de Pago, Monedas y Proyectos desde un popup interactivo en Google Sheets.

### Contexto
El proyecto pivotó de una arquitectura relacional compleja a un sistema de Hojas Modulares. El primer ABM operativo es el Plan de Cuentas, que actúa como catálogo central de todas las categorías del sistema.

### Decisiones Técnicas (ADRs)
- **ADR-001: Arquitectura de Hojas Modulares** — Cada entidad (Ingresos, Gastos, Monedas, etc.) tiene su propia hoja independiente con rangos fijos. No hay una mega-tabla relacional.
- **ADR-002: Moneda por Defecto** — El campo Moneda no es obligatorio en el ABM. Si no se especifica, el sistema usa ARS como moneda base por defecto. Evita fricción innecesaria en el registro diario.
- **Separación UX de éxito vs. alerta**: Reemplazo de `alert()` nativos por estados visuales integrados al Design System (Success State, Error inline con SVG).
- **Validación de duplicados en backend**: `saveAbmRecord()` en `11_UIService.js` verifica unicidad por nombre+módulo antes de persistir.
- **Optimización de SheetManager**: `appendRow()` y `getTableData()` refactorizados con búsqueda inversa (bottom-up) para eliminar cuelgues en hojas con muchas filas.

### Entregables Principales
| Versión | Fecha | Feature |
|---------|-------|---------|
| v0.4.1 | 2026-03-17 | Refactorización backend multi-tabla + `UI_AbmPlanCuentas.html` |
| v0.4.2 | 2026-03-17 | Fix de CSS en popups (templates con `createTemplateFromFile`) |
| v0.4.3 | 2026-03-17 | Creación de `UI_SharedStyles.html` (Design System compartido) |
| v0.4.4 | 2026-03-17 | Success State visual integrado (reemplazo de `alert()`) |
| v0.4.5 | 2026-03-17 | Paleta institucional + botón `.btn-selected` + halos de foco |
| v0.4.6 | 2026-03-17 | Validación de duplicados (UI inline, sin `alert()` nativo) |
| v0.4.7 | 2026-03-17 | ADR-002 documentado + validación de duplicados en backend |
| v0.4.8 | 2026-03-17 | Moneda opcional en formulario ABM |
| v0.4.9 | 2026-03-20 | Optimización crítica de rendimiento + fix JS + restricción monedas |

### Archivos Involucrados
- **`src/00_Config.js`** — Nuevas tablas modulares, monedas restringidas a ARS/USD/AUD/EUR
- **`src/03_SheetManager.js`** — Optimización bottom-up de lectura/escritura
- **`src/11_UIService.js`** — Endpoints ABM + validación de duplicados
- **`src/12_MenuService.js`** — Acceso al ABM desde el menú de Sheets
- **`src/UI_AbmPlanCuentas.html`** — UI Router multi-entidad con states dinámicos
- **`src/UI_SharedStyles.html`** — Design System CSS compartido
- **`src/ZZ_Changelog.js`** — Versiones v0.4.1 → v0.4.9 registradas

### Bugs Críticos Resueltos
1. **Cuelgue al guardar registros** — `appendRow()` buscaba la última fila desde arriba en tablas con muchos datos. Resuelto con búsqueda inversa.
2. **CSS no aplicado en popups** — `createHtmlOutputFromFile()` no interpreta `<?!= include() ?>`. Resuelto con `createTemplateFromFile().evaluate()`.
3. **Error JS en `UI_AbmPlanCuentas`** — Referencia a elemento `groupAbreviacion` eliminado del DOM. Resuelto eliminando la referencia.
4. **Moneda obligatoria causaba fricción** — Campo redefinido como opcional con fallback a ARS.

### Resultado
- ABM Plan de Cuentas funcional con 6 entidades gestionables
- Design System institucional aplicado consistentemente
- Validación de duplicados con feedback visual integrado
- Rendimiento de SheetManager optimizado para operaciones a largo plazo

---

## 2026-03-17 - Organización de Estructura Canónica (Agente Contextual)

### Evento
Aplicación de reglas de organización dictadas por el skill `agente-contextual` para eliminar archivos huérfanos e incongruencias en la raíz del proyecto.

### Acciones Tomadas
- Se movió el archivo resolutivo `planilla-reinversión.md` (un doc valioso dictando la reestructuración completa del proyecto) desde la raíz (`/`) a la ruta canónica `docs/permanente/`.
- Se registró el directorio de utilidades locales `scripts/` y el archivo `planilla-reinversión.md` en el documento oficial `ESTRUCTURA.md` asegurando que todos los archivos queden correctamente mapeados sin Context Rot.

---

## 2026-03-17 - Reinversión del Proyecto y Simplificación Arquitectónica

### Evento
Reinicio del desarrollo con un reenfoque hacia principios básicos ("principles first"), priorizando la simplicidad, modularidad e integración nativa con el ecosistema de Google Sheets y futuras inteligencias artificiales (ej. MCP, Claude Code).

### Contexto
El esquema de base de datos relacional y la fuerte carga de UI (web app) complejizó demasiado una herramienta cuyo fin es simplificar la vida del usuario. Se decide pivotar hacia "Hojas Modulares" independientes, siendo visualmente auditables y sirviendo de base directa para dashboards y automatizaciones externas sin fricciones.

### Decisiones Técnicas (ADR Candidatos)
- **Plan de cuentas centralizado**: Reemplazo de las tablas ocultas por una Hoja visible y relacionable que actúe de eje central. Mapeo estricto 1:1 de columnas para referencia directa en fórmulas.
- **Modularidad Total**: Separación de responsabilidades en Módulos Básicos: Plan de Cuentas, Hoja de Cargas, Hoja Anual, Presupuestación, Panel General, Hoja Base de Datos central. Posibilidad de "DLCs" (Módulo Tarjetas, Préstamos).
- **Escalabilidad AI & Integraciones**: Arquitectura hiper-documentada en GitHub para que agentes (ej. Claude Code) la consuman e integren APIs (Looker, Mails, Drive).
- **Frontend Dogmático**: Minimizar re-ingeniería limitando la UI/UX a reglas precisas (paletas, tipografía, uso de pop-ups).

### Próximos Pasos
- Elaboración y ejecución del Plan de Implementación (`implementation_plan.md`).
- Diseño del esquema modular de hojas y eliminación de la complejidad relacional inicial.

---

## 2026-02-13 - Simplificación de Arquitectura de Monedas (v0.6.0) 

### Evento

Refactorización arquitectónica eliminando gestión dinámica de monedas, hardcodeando 5 monedas fijas y removiendo UI de configuración. Reducción de ~23% en código del módulo de monedas.

### Contexto

El sistema tenía gestión dinámica de monedas (tabla MONEDAS, MonedaService, ConfigService, UI_Config) que agregaba complejidad innecesaria para un conjunto pequeño y fijo de monedas usadas en la planilla personal.

### Decisión Técnica (ADR Candidato)

**Hardcodear 5 monedas**: ARS (base), USD, EUR, AUD, CNY en constante `CURRENCIES` en `00_Config.js`

**Rationale**:

- Simplicidad sobre flexibilidad (monedas no cambian frecuentemente)
- Eliminación de capa completa de abstracción
- Configuración centralizada en un solo archivo
- Performance mejorado (no queries a BD)

### Cambios Implementados

#### Archivos Agregados/Modificados (6):

1. **`00_Config.js`**:
 - Agregado `CURRENCIES` constant (5 monedas)
 - Agregado `BASE_CURRENCY = 'ARS'`
 - Agregado `AVAILABLE_CURRENCY_IDS`
 - Eliminado `MONEDAS` y `CONFIG` de `RANGES`
 - Agregadas 4 funciones stub para compatibilidad

2. **`04_DataValidation.js`**:
 - `checkMonedaExists()` reescrito para validar contra `CURRENCIES`

3. **`06_ExchangeRateService.js`**:
 - Todas las referencias a `getMonedaByISO()` y `getAllMonedas()` reemplazadas
 - Fixed: `.moneda_id` → `.id` (5 ubicaciones)

4. **`11_UIService.js`**, **`98_DataSeeder.js`**, **`99_SetupDirect.js`**:
 - Actualizados para usar `CURRENCIES` directamente

#### Archivos Eliminados (4, ~1,270 líneas):

- `UI_Config.html` - Interfaz de configuración
- `05_MonedaService.js` - CRUD de monedas
- `10_ConfigService.js` - Gestión de configuración
- `TEST_DebugConfig.js` - Tests de configuración

### Bugs Críticos Resueltos

1. **"Tabla no configurada: CONFIG"**
 - Causa: Archivos eliminados localmente pero presentes en Apps Script
 - Solución: Eliminación manual en Apps Script web editor

2. **Property mismatch `.moneda_id` vs `.id`**
 - Causa: Estructura CURRENCIES usa `.id` but código usaba `.moneda_id`
 - Solución: 5 referencias corregidas en ExchangeRateService

3. **"Tabla no configurada: MONEDAS"**
 - Causa: Validaciones referenciaban tabla eliminada
 - Solución: `checkMonedaExists()` reescrito

### Resultado

- Código reducido en ~1,190 líneas (-23% del módulo)
- 4 archivos menos en el proyecto
- Exchange rates actualizándose correctamente
- AUX_COTIZACIONES poblado con 4 monedas (USD, EUR, AUD, CNY)
- Sistema más simple y mantenible

### Lecciones Aprendidas

1. **Sincronización clasp**: Archivos eliminados localmente pueden persistir en Apps Script editor
2. **Property naming**: Cambios en estructura requieren búsqueda exhaustiva de referencias
3. **Cascade validation updates**: Siempre actualizar validaciones al remover entidades
4. **DEBUG logging**: Logs temporales ayudan a identificar puntos exactos de falla

### Documentación Creada

- `docs/sesiones/2026-02-13_v0.6.0_Simplificacion-Monedas.md` - Documento completo de sesión
- `CHANGELOG.md` actualizado con v0.6.0
- `HISTORIAL_DESARROLLO.md` actualizado (esta entrada)

### Próximos Pasos

- [ ] Dashboard currency selector (feature futura)
- [ ] Tests de Sprint 5 (necesitan actualización para CURRENCIES)
- [ ] Considerar remover columnas MONEDAS/CONFIG de sheet (limpieza visual opcional)

---

## 2026-01-23 - Sincronización Completa de Documentación Post-Sprint 3 

### Evento

Limpieza y sincronización integral de toda la documentación del proyecto para reflejar el estado real tras la finalización exitosa del Sprint 3 (v0.4.0) y preparar el terreno para Sprint 4.

### Contexto

Con 4 sprints completados (v0.1.0 → v0.4.0), el proyecto acumuló documentos que reflejaban estados intermedios o pendientes. Esta sincronización asegura que todos los documentos normativos, informativos y contextuales estén alineados con la realidad del código implementado.

### Acciones Tomadas

#### 1. Actualización de Documentos de Raíz

- **ESTRUCTURA.md**:
 - Actualizado estado de `/src/` (de "pendiente" a "16 módulos + 7 HTML")
 - Agregado `GUIA_MODULOS.md` y `database_er_diagram.png` a tabla de permanentes
 - Reflejado workflow completo de desarrollo con checkmarks
 - Fecha actualizada a 2026-01-23, versión v0.4.0

- **README.md**:
 - Sección "Estado del Proyecto" completamente reescrita
 - Sprints 0-3 marcados como completados con detalles de cada day
 - Estadísticas actualizadas: 20 archivos, ~6,200 líneas de código
 - Agregado Sprint 4 como "Próximo Sprint"

#### 2. Actualización del Product Backlog

- **PRODUCT_BACKLOG.md**:
 - Reorganizada sección inicial con Sprints Completados (v0.1.0-v0.4.0)
 - Cada sprint documentado con features implementadas
 - Agregada nueva sección "Sprint 4: CRUD Completo (v0.5.0) - EN PLANIFICACIÓN"
 - Features de Sprint 4 listadas con dependencias cumplidas
 - Fecha actualizada a 2026-01-23

#### 3. Limpieza de Notas Pendientes

- **Notas Fran.md**: Verificado vacío (sin tareas pendientes)

### Resultado

- Todos los documentos reflejan estado real del código (v0.4.0)
- Sprint 3 documentado como 100% completado
- Sprint 4 planificado con alcance claro (UPDATE/DELETE)
- Estadísticas del proyecto actualizadas (6,200 LOC, 20 archivos)
- Estructura de carpetas sincronizada con contenido real
- Roadmap claro para próximo sprint

### Impacto

Esta sincronización cumple los siguientes objetivos:

1. **Memoria del Proyecto**: Documentación fiel al estado real
2. **Onboarding**: Nuevos desarrolladores/agentes pueden leer docs y entender el estado actual
3. **Prevención de Context Rot**: No hay documentos "deshonestos"
4. **Planificación de Sprint 4**: Base clara para comenzar próximo desarrollo

### Próximos Pasos

Proyecto listo para planificar e iniciar **Sprint 4: CRUD Completo (v0.5.0)**

- Formulario de edición de transacciones
- Función DELETE con confirmación
- Navegación desde lista a edición

---

## 2026-01-18 - Sprint 3: UI Development (Days 0-5) COMPLETO

### Evento

Implementación completa de interfaces de usuario con diseño neumórfico moderno, menús personalizados de Google Sheets, dashboard interactivo y lista de transacciones.

### Estado Final

**Days completados:** 0, 1, 2, 3, 4, 5 (100% completado) 
**Fecha de cierre:** 2026-01-18

### Resumen Ejecutivo

- **Duración:** 5 días activos
- **Código nuevo:** ~3,100 líneas (HTML/CSS/JS)
- **Archivos creados:** 9 (7 UI + 2 servicios)
- **Archivos actualizados:** 3 servicios de backend
- **Progress:** 100% del sprint completado 

### Entregables Principales

**Day 0: Design System **

- `CSS_DesignSystem.html` (500+ líneas) - Variables, reset, utilities, componentes base
- `CSS_Components.html` (400+ líneas) - StatCard, Badge, Alert, Table, Modal, etc.
- `UI_DesignSystemTest.html` - Showcase visual de todos los componentes
- Estética: Neumorfismo con League Spartan font
- Paleta: Grises/azules (#e8ecf1 base) con acentos verde/rojo

**Day 1: Transaction Form **

- `UI_TransactionForm.html` (740 líneas) - Formulario completo auto-contenido
- `JS_FormValidation.html` - Validaciones client-side
- `JS_ApiClient.html` - Cliente google.script.run
- Features: Smart defaults, validación dual (client/server), dropdowns dinámicos, campo fx_id condicional
- Modal de éxito con `resetForm()` function

**Day 2: Custom Menus & Quick Actions **

- `12_MenuService.js` - Servicio de menús personalizados (trigger onOpen)
- Menú "Tidetrack " con 5 opciones (Nueva Transacción, Dashboard, Ver Movimientos, Seed, Clear)
- Actualización de `00_Config.js` con MENU_CONFIG
- Actualización de `11_UIService.js` con funciones UI completas
- Wrapper `runDataSeedWithConfirmation()` en DataSeeder

**Day 3: Main Dashboard **

- `UI_MainDashboard.html` (600 líneas) - Dashboard principal
- Grid de métricas (Saldo, Ingresos, Gastos del mes)
- Sección de acciones rápidas (4 cards navegables)
- Lista de últimos 5 movimientos
- `getDashboardStats()` en UIService - Cálculo de totales del mes

**Day 4: Transaction List View **

- `UI_TransactionList.html` (800 líneas) - Lista completa de transacciones
- Filtros por sentido y cuenta
- Selector de mes/año
- Paginación (50 transacciones)
- `getTransactionsList()` en UIService - Filtrado y enriquecimiento de datos

**Day 5: Testing & Documentation **

- Testing end-to-end manual completo
- Validación de flujos completos (crear → ver → filtrar)
- Responsive testing verificado
- Documentación completa: `SPRINT_3_COMPLETO_2026-01-18.md`
- Actualización de HISTORIAL_DESARROLLO y CHANGELOG

### Decisiones Técnicas (ADRs)

**ADR-004: Neumorphic Design System**

- **Decisión:** Usar neumorfismo como estética principal
- **Rationale:** Balance entre modernidad y profesionalismo, diferenciador visual
- **Implementación:** Sombras duales (light + dark), sin borders, depth por shadows

**ADR-005: HTML Dialogs vs Sidebars**

- **Decisión:** Usar `showModalDialog()` en vez de sidebars
- **Rationale:** Mayor espacio visual, mejor para forms complejos, comportamiento nativo
- **Trade-off:** Requiere cerrar para volver a la sheet

**ADR-006: Auto-contenido de Forms**

- **Decisión:** CSS y JS embebidos en cada HTML (no archivos separados)
- **Rationale:** Apps Script no soporta imports tradicionales, evita problemas de CORS
- **Implementación:** Usar `<?!= include('filename') ?>` para compartir

**ADR-007: Client + Server Validation**

- **Decisión:** Validación en ambos lados
- **Rationale:** UX inmediato (client) + seguridad/integridad (server)
- **Implementación:** validateRequired/Positive/Date en JS, DataValidation.js en backend

### Testing Realizado

**Day 0:**

- Todos los componentes renderizan correctamente
- Fuente Google Fonts carga OK
- Neumorphism visual verificado

**Day 1:**

- Formulario abre desde menú
- Dropdowns cargan dinámicamente
- Validaciones funcionan (required, positive, date)
- Filtro de cuentas por sentido OK
- Campo fx_id condicional OK
- Guardado exitoso de transacciones

**Day 2:**

- Menú aparece en Google Sheets
- Todas las opciones funcionales
- Seed con confirmación OK

**Day 3:**

- Dashboard carga métricas reales
- Saldo/Ingresos/Gastos del mes calculan correctamente
- Últimos movimientos se muestran ordenados
- Navegación entre Dashboard y Form OK

### Bugs Resueltos

1. **11_UIService.js - Función huérfana**
 - Problema: Bloque try-catch fuera de función createTransaccionFromUI
 - Impacto: CRÍTICO - Error de sintaxis impedía cargar el servicio
 - Solución: Reencapsulado correctamente en la función

### Métricas del Sprint (Completado)

- **Archivos creados:** 9 nuevos (7 UI + 2 servicios)
- **Archivos modificados:** 3 (Config, UIService, DataSeeder)
- **Líneas de código:** ~3,100 (HTML/CSS: ~2,600, JS: ~500)
- **Componentes UI:** 15+ (Design System + Forms + Dashboards + Lists)
- **Funciones nuevas:** 20+ (Services + Validations + Helpers + UI)
- **Progress:** 100% completado 

### Resultado Final

Sprint completado exitosamente al 100%. Sistema UI completo y funcional con:

- Diseño neumórfico moderno
- Registro de transacciones (CREATE)
- Dashboard con estadísticas en tiempo real
- Lista de transacciones con filtros
- Menús personalizados de Google Sheets
- Validación dual (cliente + servidor)
- Modal de éxito con flujo de continuidad

### Documentación Final

Ver documento completo: `docs/sesiones/SPRINT_3_COMPLETO_2026-01-18.md`

### Próximos Pasos: Sprint 4

**Recomendación**: Completar CRUD con UPDATE y DELETE

- Editar transacción existente
- Eliminar transacción con confirmación
- Formulario en modo edición vs creación

---

## 2026-01-18 (Madrugada) - Sprint 2 COMPLETO 

### Evento

Sprint 2 finalizado exitosamente con implementación completa de catálogos, migración a auto-IDs (SKU), TransactionService, DataSeeder, y testing integral. **41/41 tests pasados**.

### Resumen Ejecutivo

- **Duración:** 6 días (Day 0 → Day 5)
- **Código nuevo:** ~1,500 líneas
- **Módulos creados:** 4 (MedioPago, Cuenta, Transaction, DataSeeder)
- **Módulos actualizados:** 5 (Utils, SheetManager, Validaciones, servicios)
- **Bugs críticos resueltos:** 2
- **Tests ejecutados:** 41/41 

### Entregables Principales

**Auto-IDs (SKU System):**

- MON-XXX, FX-XXXXX, MED-XXX, CTA-XXX, TRX-XXXXXX, CFG-XXX
- Función `generateNextId(tableName, prefix, padding)` en Utils

**Servicios CRUD:**

- `07_MedioPagoService.js` - 5 medios pre-configurados
- `08_CuentaService.js` - 11 cuentas pre-configuradas
- `09_TransactionService.js` - Core del sistema con validación fx_id

**Data Seeding:**

- `98_DataSeeder.js` - Helper functions + seedCompleto()
- `seedTransacciones(cantidad, diasAtras)` - Generación de datos de prueba

**Testing:**

- Suite integral: `TESTS_Sprint2_Final.js` (5 tests end-to-end)
- Cobertura: 100% funcionalidades

### Bugs Críticos Resueltos

1. **SheetManager.appendRow() - Detección de última fila**
 - Problema: Usaba última fila global de hoja, no de tabla específica
 - Impacto: CRÍTICO - Todas las inserciones fallaban
 - Solución: Detección independiente por tabla

2. **validateTransaction() - Error en UPDATE**
 - Problema: Verificaba duplicados en CREATE y UPDATE
 - Impacto: MEDIO - Imposible actualizar transacciones
 - Solución: Parámetro `isUpdate` para distinguir operaciones

### ADRs (Decisiones Técnicas)

- **ADR-001:** Sistema SKU con prefijos y padding configurable
- **ADR-002:** Cada tabla gestiona su última fila independientemente
- **ADR-003:** Patrón `isUpdate` en todas las validaciones

### Próximos Pasos: Sprint 3

Desarrollo de UI (Frontend):

- HTML forms y popups
- Client-side JavaScript
- Custom menus de Google Sheets
- Data visualization y dashboards

Ver: `docs/sesiones/SPRINT_2_COMPLETO_2026-01-18.md` para detalles completos.

---

## 2026-01-17 - Inicio del Proyecto y Documentación de Contexto

### Evento

Inicio oficial del proyecto Tidetrack como sistema de finanzas personales. Se estructura la documentación completa y se configura el entorno de desarrollo con sistema multi-agente.

### Acciones Tomadas

#### 1. Configuración de Sistema Agéntico

- Implementación de arquitectura multi-agente con 6 especialistas:
 - Product Manager (estrategia y backlog)
 - UI/UX Designer (sistemas de diseño)
 - Context Historian (documentación y memoria)
 - QA Tester (automatización de pruebas)
 - Security Auditor (auditoría OWASP)
 - Backend Architect (BD y APIs)
- Configuración de dispatcher para enrutamiento de agentes
- Implementación de regla de estructura obligatoria

#### 2. Documentación Completa del Contexto de Negocio

- **RESUMEN_PROYECTO.md**: Definición operativa, origen, propuesta de valor
- **CONTEXTO_NEGOCIO.md**: Círculo de oro (Why/How/What), modelo B2C, estrategia competitiva
- **PRINCIPIOS_DISEÑO.md**: Reglas de UX, hábito como tecnología, multi-moneda
- **ROADMAP_PRODUCTO.md**: Etapas de MVP a plataforma
- **PRODUCT_BACKLOG.md**: Features priorizadas por etapa
- **REGLAS_AGENTE.md**: Convenciones de desarrollo

#### 3. Reorganización de Archivos Iniciales

- Movimiento de `contexto.md` → `ARQUITECTURA_AGENTICA.md`
- Extracción de contenido de `tidetrack_finanzas_personales.md` (279 líneas) a estructura organizada
- Reset de documentos incorrectos (CHANGELOG, DATABASE_SCHEMA, GUIA_ARQUITECTURA)
- Actualización de README y ESTRUCTURA con contexto correcto

### Rationale

**Por qué documentar primero:**
El proyecto transita de una planilla íntima a un producto escalable. Documentar el contexto de negocio, principios y reglas ANTES de implementar asegura que:

1. **Coherencia:** Toda decisión técnica se alinea con el propósito ("paz financiera")
2. **Velocidad:** Programadores e IAs pueden implementar sin "adivinar" intenciones
3. **Prevención de Context Rot:** La documentación actúa como "memoria externa" del proyecto

**Sistema multi-agente:**
Permite desarrollo paralelo donde cada agente (PM, UX, QA, Security, Backend) tiene responsabilidades claras y respeta las mismas reglas de estructura.

### Resultado

- Contexto de negocio completamente documentado
- Principios de diseño y UX definidos
- Roadmap de MVP a plataforma establecido
- Sistema de agentes configurado
- Estructura de carpetas organizada y validada

### Próximos Pasos

1. **Diseño de Base de Datos** (Tarea inmediata)
 - Modelar entidades: Transactions, Currencies, ExchangeRates, PaymentMethods, Accounts, Budgets, Events, Users
 - Definir relaciones y constraints
 - Documentar en `DATABASE_SCHEMA.md`

2. **Definición de Stack Tecnológico**
 - Mobile-first (React Native vs. Flutter)
 - Backend (Node.js vs. Python FastAPI)
 - Base de datos (PostgreSQL)

- Autenticación (OAuth 2.0)

3. **Implementación del MVP**
 - Registro ultrarrápido
 - Presupuesto basado en histórico
 - Tablero esencial
 - Multi-moneda básico

---

## 2026-01-17 (Tarde) - Diseño Completo de Base de Datos

### Evento

Diseño e implementación del schema completo de base de datos usando Google Sheets como backend con disciplina relacional.

### Acciones Tomadas

#### 1. Decisión de Arquitectura (ADR-001)

- **Decisión:** Usar Google Sheets (hoja DATA-ENTRY) como sistema de base de datos para MVP
- **Rationale:** Costo cero, prototipado rápido, facilidad operativa, migración futura posible
- **Alternativas consideradas:** Firebase, PostgreSQL (Supabase), SQLite

#### 2. Diseño de Schema Relacional

Creación de 6 tablas con ubicaciones fijas en DATA-ENTRY:

| Tabla | Rango | Propósito |
| ---------------- | ----- | ----------------------------------- |
| DB_MONEDAS | B:D | Catálogo de monedas |
| DB_TIPOS_CAMBIO | F:Q | Cotizaciones con auditoría completa |
| DB_MEDIOS_PAGO | S:W | Catálogo de medios de pago |
| DB_CUENTAS | Y:AB | Categorías/cuentas |
| DB_TRANSACCIONES | AD:AM | Tabla central de movimientos |
| DB_CONFIG | AO:AQ | Parámetros globales |

#### 3. Innovación Técnica Clave

**"Congelamiento" de tipo de cambio (`fx_id`):**

- Cada transacción guarda referencia al TC usado (`fx_id`)
- Histórico estable: no cambia aunque actualices cotizaciones
- Auditoría completa: `fetched_at`, `provider`, `raw_payload`

#### 4. Documentación Creada

- **DATABASE_SCHEMA.md**: Schema completo con todas las tablas, columnas, FKs, reglas de integridad
- **GUIA_ARQUITECTURA.md**: ADR-001, stack tecnológico, estrategia de migración
- **database_er_diagram.png**: Diagrama de relaciones entre entidades

### Rationale

**Por qué Google Sheets:**
El esquema está completamente normalizado (3NF) y funciona como base relacional real, pero aprovecha:

- Accesibilidad inmediata (usuario puede ver/auditar datos)
- Costo operativo cero durante validación
- Colaboración nativa de G Suite
- Migración directa a PostgreSQL cuando escale

**Por qué fx_id es crítico:**
Multi-moneda serious requiere que el histórico sea estable. Si una transacción de hace 6 meses usó TC=1000, debe mantenerse así aunque hoy el TC sea 1200. `fx_id` garantiza eso.

**Modelo "Estrella":**
DB_TRANSACCIONES es el centro, rodeado de catálogos (Monedas, Medios, Cuentas) y la tabla operativa de TiposCambio. Esto permite dashboards eficientes agregando `monto_base`.

### Resultado

- Schema relacional completo y normalizado
- 6 tablas con PKs, FKs, y reglas de integridad documentadas
- Enums definidos para consistencia de datos
- ADR-001 documentado (Google Sheets → PostgreSQL)
- Estrategia de migración clara (umbral: 60% capacidad)
- Casos de uso críticos resueltos (gasto en USD con TC congelado)

### Próximos Pasos

1. **Implementación del Schema** (Siguiente paso inmediato)
 - Crear hoja DATA-ENTRY en Google Sheets
 - Definir rangos con nombres (Named Ranges)
 - Crear validaciones de datos (enums)
 - Proteger estructura (bloquear inserción de columnas)

2. **Scripts de Automatación**
 - Script de fetch de tipos de cambio (API)
 - Script de cálculo automático de `monto_base`
 - Script de validación de integridad

3. **Carga de Datos Iniciales**
 - Poblar DB_MONEDAS (ARS, USD, EUR mínimo)
 - Configurar DB_CONFIG (base_moneda_id = ARS)
 - Crear medios y cuentas básicas

---

## 2026-01-17 (Noche) - Sprint 0: Implementación del Core Modular

### Evento

Implementación completa del Sprint 0 del sistema modular de Apps Script, estableciendo la infraestructura base para el proyecto.

### Acciones Tomadas

#### 1. Planificación de Arquitectura Modular

- **Decisión**: Sistema de 13 archivos .js numerados por orden de carga
- **Estrategia**: Arquitectura por capas (Config → Utils → SheetManager → Validation → Services → UI)
- **Versionado**: Semantic Versioning (SemVer) con changelog embebido
- **Sprints**: 6 sprints incrementales planificados

#### 2. Implementación de 7 Archivos (Sprint 0)

| Archivo | Líneas | Responsabilidad |
| -------------------- | ---------- | ---------------------------------------- |
| 00_Config.js | 183 | Constantes, rangos, enums, defaults |
| 01_Version.js | 61 | Control de versiones + changelog |
| 02_Utils.js | 227 | IDs, fecha/hora, validación, logging, UI |
| 03_SheetManager.js | 186 | Abstracción CRUD sobre Sheets |
| 04_DataValidation.js | 194 | Reglas de integridad del schema |
| 05_MonedaService.js | 171 | CRUD de monedas |
| appsscript.json | 9 | Manifest OAuth |
| **TOTAL** | **~1,031** | **7 archivos** |

#### 3. Funcionalidades Implementadas

**Infraestructura:**

- Configuración centralizada de rangos fijos (B:D, F:Q, S:W, etc.)
- 6 enums definidos (SENTIDO, MACRO_TIPO, TIPO_MEDIO, FUENTE_FX, STATUS_FX, USO_PRINCIPAL)
- Sistema de logging con categorías (error, info, success)
- Notificaciones al usuario (toast, alert)

**Capa de Acceso a Datos:**

- `getTableData(tableName)` - Lee tabla completa
- `appendRow(tableName, rowData)` - Agrega fila
- `updateRow(tableName, rowIndex, data)` - Actualiza fila
- `deleteRow(tableName, rowIndex)` - Elimina fila
- `findById(tableName, id, idColumnIndex)` - Búsqueda por ID

**Validaciones Críticas:**

1. `monto > 0` siempre
2. `sentido` define dirección (Ingreso/Egreso)
3. `fx_id` obligatorio si `moneda_id ≠ base_moneda_id`
4. `fx_id` debe tener `status='ok'`
5. `tc > 0`
6. `base_moneda_id ≠ quote_moneda_id`

**Servicio de Monedas:**

- `getAllMonedas()` - Lista todas
- `getMonedaById(moneda_id)` - Obtiene una
- `createMoneda(id, nombre, simbolo)` - Crea con validación
- `updateMoneda(id, nombre, simbolo)` - Actualiza
- `deleteMoneda(id)` - Elimina (con advertencia de FKs)
- `initializeMonedas()` - Seed de ARS, USD, EUR

### Rationale

**Por qué numeración de archivos:**
Apps Script no garantiza orden de carga. La numeración asegura que las dependencias se carguen primero (Config antes que Services).

**Por qué separación por capas:**
Cada capa tiene una responsabilidad clara y no conoce detalles de implementación de capas superiores. Esto facilita testing y mantenimiento.

**Por qué validación antes de escritura:**
Todas las funciones `create*()` llaman a `validate*()` primero. Los errores se detectan antes de corromper datos.

**Por qué changelog embebido:**
Apps Script no tiene control de versiones nativo. El changelog viaja con el código como documentación.

### Resultado

- 7 archivos modulares listos para Apps Script
- ~1,000 líneas de código documentado
- 45+ funciones implementadas
- Todas las reglas de DATABASE_SCHEMA en código
- Sistema versionado (v0.1.0)
- CRUD completo de monedas

### Próximos Pasos

1. **Testing Manual** (Pendiente del usuario)
 - Copiar archivos a Apps Script
 - Ejecutar `initializeMonedas()`
 - Verificar creación de ARS, USD, EUR

2. **Sprint 1** (Próximo)
 - 06_ExchangeRateService.js
 - 10_ConfigService.js
 - Fetch de tipos de cambio desde API
 - Cálculo de monto_base

3. **Documentación**
 - Crear GUIA_MODULOS.md (guía de cada módulo)
 - Actualizar README con instrucciones de deploy

---

**Responsable de este documento**: @context-historian

_Última actualización: 2026-01-17_
