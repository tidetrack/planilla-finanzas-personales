# CHANGELOG - Tidetrack Personal Finance

Historial de versiones y cambios significativos del proyecto.

**Formato:** Las versiones más recientes aparecen primero (orden cronológico inverso).

---

## v0.6.0 - Simplificación de Arquitectura de Monedas (2026-02-13) ✅ RELEASED

### 🎯 Resumen del Sprint

Sprint enfocado en simplificar la arquitectura del sistema de monedas, eliminando gestión dinámica y hardcodeando 5 monedas fijas, removiendo UI de configuración y reduciendo complejidad del código.

**Estado:** Sprint completado en 1 día (100%) - RELEASED  
**Fecha de cierre:** 2026-02-13  
**Código reducido:** ~1,190 líneas (~23% del módulo) | **Archivos eliminados:** 4 | **Bugs resueltos:** 3 críticos

---

### ✨ Added

#### Core Configuration

- **`CURRENCIES` constant** en `00_Config.js` - 5 monedas hardcodeadas:
  - ARS (Peso Argentino) - Moneda base
  - USD (Dólar Estadounidense)
  - EUR (Euro)
  - AUD (Dólar Australiano)
  - CNY (Yuan Chino)
- **`BASE_CURRENCY` constant** - Define 'ARS' como moneda base del sistema
- **`AVAILABLE_CURRENCY_IDS`** - Array de IDs disponibles para iteración

#### Stub Functions (Compatibility Layer)

- `getConfig()` - Devuelve configuración hardcodeada (reemplaza ConfigService)
- `getBaseMoneda()` - Devuelve 'ARS' directamente
- `getAllMonedas()` - Convierte CURRENCIES a formato legacy para compatibilidad
- `getMonedaCodes()` - Devuelve array de currency IDs

---

### 🔄 Changed

#### Backend Services Updated

- **`06_ExchangeRateService.js`**:
  - Reemplazadas todas las llamadas a `getMonedaByISO()` con acceso directo a `CURRENCIES`
  - `updateAuxSheet()` usa `Object.values(CURRENCIES)` en lugar de `getAllMonedas()`
  - `saveDolarAPIRate()` usa `CURRENCIES.ARS` y `CURRENCIES.USD` directamente
  - `fetchExchangeRatesFromAPI()` itera sobre `CURRENCIES`
  - Fixed property references: `.moneda_id` → `.id` (3 locations)
- **`04_DataValidation.js`**:
  - `checkMonedaExists()` ahora valida contra `CURRENCIES` en vez de tabla `MONEDAS`
  - Error message mejorado con lista de monedas disponibles

- **`11_UIService.js`**:
  - `getDashboardDropdowns()` usa `Object.values(CURRENCIES)` directamente

- **`98_DataSeeder.js`**:
  - `seedCompleto()` ya no llama a `setupCompleto()` (monedas hardcodeadas)
  - `seedTransacciones()` usa `Object.values(CURRENCIES)` y `BASE_CURRENCY`
  - `randomMoneda()` usa `m.id` en lugar de `m.moneda_id`
  - Logs actualizados reflejando 5 monedas hardcodeadas

- **`99_SetupDirect.js`**:
  - `setupCompleto()` ya no inicializa MONEDAS ni CONFIG
  - Agregados comentarios explicando hardcoding de configuración

---

### ❌ Removed

#### Files Deleted (4 archivos, ~1,270 líneas)

- **`UI_Config.html`** - Interfaz de configuración de usuario
- **`05_MonedaService.js`** - Servicio CRUD de monedas
- **`10_ConfigService.js`** - Servicio de gestión de configuración
- **`TEST_DebugConfig.js`** - Tests de configuración

#### Table References Removed

- `MONEDAS` eliminado de `RANGES` en `00_Config.js`
- `CONFIG` eliminado de `RANGES` en `00_Config.js`
- Funciones dinámicas de gestión de monedas eliminadas

---

### 🐛 Fixed

#### Bug #1: "Tabla no configurada: CONFIG"

- **Síntoma**: Error al ejecutar `updateExchangeRates()`
- **Causa**: Archivos `10_ConfigService.js` y `05_MonedaService.js` eliminados localmente pero presentes en Apps Script
- **Solución**: Eliminación manual de archivos en Apps Script web editor
- **Impacto**: CRÍTICO - Bloqueaba actualización de exchange rates

#### Bug #2: Property Mismatch `.moneda_id` vs `.id`

- **Síntoma**: Rates no se guardaban, validación fallaba con `undefined`
- **Causa**: Código usaba `.moneda_id` en objetos `CURRENCIES` que tienen `.id`
- **Archivos afectados**: `06_ExchangeRateService.js` (líneas 261, 276, 277, 481, 492-493)
- **Solución**: Cambio de todas las referencias `.moneda_id` → `.id`
- **Impacto**: ALTO - Impedía guardado de exchange rates

#### Bug #3: "Tabla no configurada: MONEDAS"

- **Síntoma**: Error al guardar rates desde ExchangeRate-API
- **Causa**: `checkMonedaExists()` validaba contra tabla `MONEDAS` eliminada
- **Archivo afectado**: `04_DataValidation.js` (líneas 37-45)
- **Solución**: Función reescrita para validar contra `CURRENCIES`
- **Impacto**: ALTO - Bloqueaba guardado de rates secundarios (EUR, AUD, CNY)

---

### 📊 Metrics

**Reducción de Código**:

- Líneas eliminadas: ~1,270
- Líneas agregadas: ~80
- **Reducción neta: ~1,190 líneas (-23% del módulo de monedas)**

**Complejidad Reducida**:

- 4 archivos menos en el proyecto
- 2 servicios completos eliminados (MonedaService, ConfigService)
- 1 pantalla UI removida (Config manager)
- 2 tablas conceptualmente eliminadas (MONEDAS, CONFIG ya no se usan)

**Verificación de Datos**:

- ✅ `updateExchangeRates()` ejecuta sin errores
- ✅ DolarAPI guarda 2 rates (oficial + MEP)
- ✅ ExchangeRate-API procesa 166 rates, guarda EUR, AUD, CNY
- ✅ AUX_COTIZACIONES poblado con 4 monedas en columnas AV-AZ

---

### 🎓 Lessons Learned

1. **Sincronización Local vs Apps Script**: Archivos eliminados localmente pueden persistir en el editor web
2. **Property Naming Consistency**: Cambios en estructura de datos requieren búsqueda exhaustiva de referencias
3. **Validaciones con Tablas Eliminadas**: Always update validation functions when removing data entities
4. **Debugging Sistemático**: DEBUG logs temporales ayudan a identificar puntos exactos de falla

---

### 📝 ADR Candidato

**ADR-001: Hardcoding de Monedas**

**Contexto**: Sistema usaba gestión dinámica con tabla MONEDAS y UI para agregar/editar

**Decisión**: Hardcodear 5 monedas fijas (ARS, USD, EUR, AUD, CNY) en constante `CURRENCIES`

**Razones**:

- Simplicidad: Conjunto de monedas no cambia frecuentemente
- Reducción de complejidad: Elimina capa completa de abstracción
- Mantenibilidad: Un solo archivo contiene toda la configuración
- Performance: No hay queries a BD para obtener monedas

**Consecuencias Positivas**:

- ~23% menos código
- Menos puntos de falla
- Más fácil de entender
- Configuración centralizada

**Consecuencias Negativas**:

- Agregar nueva moneda requiere cambio de código (no UI)
- No hay historial de cambios de monedas en BD

**Estado**: ✅ Implementado

---

### 📎 Referencias

**Archivos Modificados (6)**:

- `00_Config.js` - Core configuration con CURRENCIES
- `04_DataValidation.js` - Validación actualizada
- `06_ExchangeRateService.js` - Exchange rate services
- `11_UIService.js` - UI helpers
- `98_DataSeeder.js` - Demo data seeders
- `99_SetupDirect.js` - Initial setup

**Documento de sesión**: [`docs/sesiones/2026-02-13_v0.6.0_Simplificacion-Monedas.md`](file:///c:/Users/franc/OneDrive/Escritorio/planilla-finanzas-personales/docs/sesiones/2026-02-13_v0.6.0_Simplificacion-Monedas.md)

---

## v0.5.0 - Sprint 4: ABM Catálogos (2026-01-23) ✅ RELEASED

### 🎯 Resumen del Sprint

Sprint enfocado en gestión completa de Cuentas y Medios de Pago desde interfaz gráfica, permitiendo a usuarios crear, editar y eliminar sus propias categorías y métodos de pago.

**Estado:** Sprint completado en 1 día (100%) - RELEASED  
**Fecha de cierre:** 2026-01-23  
**Código nuevo:** ~2,400 líneas | **Archivos creados:** 2 | **Testing:** ✅ 17 tests completos

---

### ✨ Added

#### UI Components

- **UI_CuentasManager.html**: Gestor de cuentas con CRUD completo (~857 líneas)
  - Popup 700x650 con diseño Ocean theme
  - Lista searchable de cuentas existentes
  - Formulario crear/editar: nombre, macro_tipo, es_recurrente (toggle switch)
  - Botones Edit/Delete con iconos Material
  - Confirmación para save/delete
  - Modal post-acción ("Seguir aquí" / "Volver al Dashboard")
  - Auto-reset de formulario tras operaciones exitosas
  - Search filter con hide/show dinámico
  - Toggle "Es recurrente" con diseño liquid glass (glassmorphism)

- **UI_MediosManager.html**: Gestor de medios de pago con CRUD completo (~918 líneas)
  - Popup 700x650 con diseño Ocean theme
  - Lista searchable de medios existentes
  - Formulario crear/editar: nombre, tipo, moneda, uso_principal
  - Dropdown dinámico de monedas (DB_MONEDAS)
  - Confirmación para save/delete
  - Modal post-acción con navegación
  - Auto-reset de formulario
  - Search filter con hide/show dinámico

#### Backend Extensions

- **11_UIService.js**: API Wrappers y show functions (+118 líneas)
  - `showCuentasManager()`: Abre popup de cuentas
  - `showMediosManager()`: Abre popup de medios
  - `getCuentasList()`, `createCuentaFromUI()`, `updateCuentaFromUI()`, `deleteCuentaFromUI()`
  - `getMediosList()`, `createMedioFromUI()`, `updateMedioFromUI()`, `deleteMedioFromUI()`

#### Dashboard Integration

- **UI_MainDashboard.html**: Nuevos botones de gestión
  - ✅ "Gestionar Cuentas" (icon: category) - reemplaza "Reportes Mensuales"
  - ✅ "Gestionar Medios" (icon: credit_card) - reemplaza "Ver Historial"
  - Funciones navigation: `openCuentasManager()`, `openMediosManager()`

#### UX Enhancements (Beyond Original Scope)

- **Back to Dashboard Button**: Navegación directa desde managers
- **Search Filter**: Filtrado en tiempo real de listas
- **Add New Button (+)**: Acceso rápido a formulario desde header
- **Hide on Edit**: Oculta otros items al editar, auto-scroll a form
- **Initially Hidden List**: Solo muestra lista cuando usuario busca
- **Scrollable Header**: Todo el popup scrollea como un bloque
- **Hidden Scrollbars**: Apariencia limpia sin scrollbars internos

---

### 🔧 Changed

#### Validation Enhancements

- **08_CuentaService.js**: `deleteCuenta()` (líneas 163-173)
  - Agregada validación FK (Foreign Key constraint)
  - Previene eliminación si cuenta tiene transacciones asociadas
  - Mensaje de error claro explicando restricción

- **07_MedioPagoService.js**: `deleteMedioPago()` (líneas 186-196)
  - Agregada validación FK
  - Previene eliminación si medio tiene transacciones asociadas
  - Mensaje de error claro explicando restricción

---

### 🐛 Fixed

#### Critical Bug #1: Race Condition in confirmAction()

**Issue**: `confirmAction()` llamaba a `closeModal()` primero, que establecía `pendingAction = null`, luego intentaba ejecutar `pendingAction` (ya null). Resultado: acciones nunca se ejecutaban.

**Fix** (UI_CuentasManager.html, UI_MediosManager.html):

```javascript
// ANTES (incorrecto)
function confirmAction() {
  closeModal(); // ← Esto eliminaba pendingAction
  if (pendingAction) {
    // ← Siempre false
    pendingAction(); // ← NUNCA se ejecutaba
  }
}

// DESPUÉS (correcto)
function confirmAction() {
  const actionToExecute = pendingAction; // ← Guardar primero
  pendingAction = null;
  closeModal();
  if (actionToExecute) {
    actionToExecute(); // ← Ahora SÍ ejecuta
  }
}
```

#### Critical Bug #2: Modal Invisible (Z-Index Conflict)

**Issue**: Modal overlay tenía `z-index: 1000` pero `.manager-container` tenía `z-index: 10000`, haciendo que modales quedaran detrás del contenedor y fueran invisibles.

**Fix**:

```css
/* ANTES */
.modal-overlay {
  z-index: 1000; /* ❌ Menor que container */
}

/* DESPUÉS */
.modal-overlay {
  z-index: 20000; /* ✅ Por encima del container */
}
```

---

### 📊 Testing

#### Cuentas Manager (7 tests)

- ✅ Create new cuenta
- ✅ Edit existing cuenta
- ✅ Delete cuenta (no transactions)
- ✅ Delete cuenta (with transactions - FK constraint)
- ✅ Search filter functionality
- ✅ Modal visibility (z-index fix)
- ✅ Form auto-reset

#### Medios Manager (6 tests)

- ✅ Create new medio
- ✅ Edit existing medio
- ✅ Delete medio (no transactions)
- ✅ Delete medio (with transactions - FK constraint)
- ✅ Moneda dropdown population
- ✅ Race condition fix verification

#### Integration (4 tests)

- ✅ Create cuenta → appears in transaction form dropdown
- ✅ Dashboard navigation to managers
- ✅ Back to dashboard from managers
- ✅ All CRUD operations persist to DB_CUENTAS and DB_MEDIOS_PAGO

---

### 🎨 Design Features

- **Ocean Theme Consistency**: Ambos popups usan paleta #eff2f9, #39444d, #6e7f8d
- **Material Icons**: category, credit_card, edit, delete, add_circle, arrow_back
- **Inter Font Family**: Consistente con dashboard
- **Border Radius**: 24px container, 18px cards
- **Glassmorphism**: Toggle "Es recurrente" con efecto liquid glass
- **Responsive Design**: Adaptativo a diferentes tamaños

---

## v0.4.0 - Sprint 3: UI Development (2026-01-18) ✅ RELEASED

### 🎯 Resumen del Sprint

Sprint enfocado en interfaces de usuario con diseño neumórfico moderno, menús personalizados y dashboard interactivo.

**Estado:** Days 0-5 completados (100%) - RELEASED  
**Fecha de cierre:** 2026-01-18  
**Código nuevo:** ~3,100 líneas | **Archivos creados:** 9 | **Testing:** ✅ Completo

---

### Day 5 Completed: Testing & Documentation ✅

#### 🧪 Testing

- ✅ End-to-end flow (Menu → Form → Save → Modal → List → Dashboard)
- ✅ Form validation (required, positive, date, fx_id conditional)
- ✅ UI/UX (hover, loading, success modal, error messages)
- ✅ Data display (dashboard stats, recent transactions, filters)
- ✅ Responsive design (3-col → 1-col grid, mobile-first)

#### 📝 Documentation

- ✅ `SPRINT_3_COMPLETO_2026-01-18.md` (comprehensive sprint document)
- ✅ Updated `HISTORIAL_DESARROLLO.md` (Sprint 3 marked complete)
- ✅ Updated `CHANGELOG.md` (this file, v0.4.0 released)

#### 🐛 Bug Fixed

- Form ID in `resetForm()` corrected (`'transaction-form'`)

---

### Day 4 Completed: Transaction List View ✅

#### ✨ Added

- **UI_TransactionList.html**: Vista de lista completa (~800 líneas)
  - Tabla: Fecha, Tipo, Monto, Cuenta, Medio, Nota
  - Filtros por sentido (Todos/Ingreso/Egreso)
  - Filtros por cuenta (Todas + lista dinámica)
  - Selector mes/año (consistente con Dashboard)
  - Paginación (50 transacciones max)
  - Badges visuales (verde ingreso, rojo egreso)
  - Responsive (scroll horizontal mobile)

- **11_UIService.js**: `getTransactionsList(year, month, filters)`
  - Filtrado por mes/año y sentido/cuenta
  - Ordenamiento fecha desc
  - Enriquecimiento con nombres (lookup)
  - Retorna: transactions, total, showing

- **12_Menu Service.js**: `showTransactionList()` (modal 1200x900)

#### 📊 Testing

- ✅ Carga desde menú "Ver Movimientos"
- ✅ Filtros funcionales (sentido, cuenta, mes)
- ✅ Navegación "← Volver" funcional

---

### Day 3 Completed: Main Dashboard ✅

#### ✨ Added

- **UI_MainDashboard.html**: Dashboard principal con diseño neumórfico
  - Grid de métricas (Saldo, Ingresos, Gastos del mes)
  - Stats cards con iconos y valores dinámicos
  - Sección de acciones rápidas (4 cards navegables)
  - Lista de últimos movimientos (top 5 transacciones)
  - Responsive design (mobile-first)
  - Integración completa con backend

- **11_UIService.js**: Agregado `getDashboardStats()`
  - Cálculo de totales del mes actual
  - Filtrado y ordenamiento de transacciones
  - Enriquecimiento de datos (nombres de cuentas/medios)
  - Retorna: balance, ingresos, egresos, counts, recientes

#### 🎨 Design Features

- Layout grid adaptativo (3 columnas en desktop, 1 en mobile)
- Action cards con hover effects (translateY + shadow)
- Fecha actual en header con formato locale español
- Iconos emoji para categorías visuales
- Color coding: verde (ingresos), rojo (egresos)

#### 📊 Dashboard Metrics

- **Saldo Total:** Ingresos - Egresos del mes
- **Ingresos:** Suma + contador de transacciones
- **Gastos:** Suma + contador de transacciones
- **Recientes:** Top 5 ordenadas por fecha desc

---

### Day 2 Completed: Custom Menus & Quick Actions ✅

#### ✨ Added

- **12_MenuService.js**: Servicio de menús personalizados
  - Trigger `onOpen()` automático
  - Menú "Tidetrack 💰" en barra de Google Sheets
  - Handlers para todas las acciones del menú
  - Confirmaciones para acciones destructivas

- **00_Config.js**: Actualizado con `MENU_CONFIG`
  - Configuración centralizada del menú
  - Items con nombres y funciones asignadas
  - Soporte para separadores

- **11_UIService.js**: Expandido con funciones UI
  - `showTransactionForm()`: Abre formulario de transacción
  - `showMainDashboard()`: Abre dashboard principal
  - `getFormData()`: Obtiene catálogos para dropdowns
  - `createTransaccionFromUI()`: Wrapper para crear transacciones
  - `getLatestRatesForMoneda()`: Obtiene tipos de cambio

- **98_DataSeeder.js**: Agregado wrapper UI
  - `runDataSeedWithConfirmation()`: Dialog de confirmación
  - Auto-inicializa catálogos si no existen
  - Feedback visual de éxito/error

#### 🎨 Menu Structure

```
Tidetrack 💰
├── Nueva Transacción ⚡
├── Ver Dashboard 📊
├── ──────────────────
├── Seed Datos Demo 🎲
└── Limpiar Transacciones 🗑️
```

#### 📊 Testing

- ✅ Menú aparece automáticamente al abrir Sheet
- ✅ Todas las opciones funcionales
- ✅ Navegación entre vistas OK
- ✅ Confirmaciones de acciones destructivas

---

### Day 1 Completed: Transaction Form ✅

#### ✨ Added

- **UI_TransactionForm.html**: Formulario completo de transacciones
  - Campos: fecha, monto, moneda, sentido, cuenta, medio, nota
  - Validación client-side (JavaScript inline)
  - Validación server-side (integración con DataValidation)
  - Smart defaults: fecha=hoy, sentido=Egreso
  - Dropdowns dinámicos filtrados por sentido
  - Campo fx_id condicional (solo si moneda != base)
  - Feedback visual (success/error alerts)
  - Loading states con spinner
  - Auto-cierre después de guardar exitosamente

- **JS_FormValidation.html**: Validaciones client-side
  - `validateRequired()`, `validatePositive()`, `validateDate()`
  - `showFieldError()`, `clearFieldError()`, `clearAllErrors()`
  - Validación en tiempo real

- **JS_ApiClient.html**: Cliente para google.script.run
  - `submitTransaction()`: Envío asíncrono
  - Handlers de success/failure
  - Loading states management

#### 🎨 UX Features

- Neumorphic design consistente con design system
- Inputs con sombra inset (depth visual)
- Buttons con micro-animaciones en hover
- Alerts con iconos y colores según tipo
- Form grid responsive (2 cols → 1 col mobile)

#### 📊 Testing

- ✅ Formulario abre correctamente desde menú
- ✅ Validaciones funcionan (required, positive, date)
- ✅ Dropdowns cargan catálogos dinámicamente
- ✅ Filtro de cuentas por sentido OK
- ✅ Campo fx_id aparece/oculta correctamente
- ✅ Guardado exitoso de transacciones
- ✅ Integración con backend validado

---

### Day 0 Completed: Design System ✅

#### ✨ Added

- **CSS_DesignSystem.html** (500+ líneas): Sistema de diseño completo
  - Variables CSS (colores, tipografía, spacing, shadows)
  - CSS Reset
  - Utilities (typography, spacing, layout, flex, grid)
  - Componentes base (buttons, inputs, selects, labels)
  - Neumorphic shadows (dual light/dark)
  - League Spartan font de Google Fonts
  - Responsive breakpoint (768px)

- **CSS_Components.html** (400+ líneas): Componentes específicos
  - StatCard (métricas financieras con iconos)
  - Badge (status indicators)
  - Alert (success, error, warning, info)
  - Table (con hover states)
  - Modal/Dialog
  - Tooltip
  - Progress bar
  - Skeleton loader
  - Chip/Tag
  - Empty state

- **UI_DesignSystemTest.html**: Página de testing visual
  - Showcase de todos los componentes
  - Paleta de colores
  - Typography scale
  - Estados interactivos

- **11_UIService.js**: Servicio base para dialogs
  - Función `include()` para templates
  - `showDesignSystemTest()` para testing

#### 🎨 Design Decisions

- **Estética:** Neumorfismo con sombras duales suaves
- **Paleta:** Grises/azules (#e8ecf1 base, acentos verde/rojo para ingresos/egresos)
- **Fuente:** League Spartan (300-700 weights)
- **Arquitectura:** Atomic Design (átomos → moléculas → organismos)

#### 📊 Testing

- ✅ Visual testing completo
- ✅ Todos los componentes renderizan correctamente
- ✅ Neumorfismo aplicado (sombras suaves, depth correcta)
- ✅ Fuente Google cargada

---

## v0.3.0 - Sprint 2: Catálogos & Data Seeding (2026-01-18) ✅ RELEASED

### 🎯 Resumen del Sprint

Sprint completado exitosamente en 6 días (Day 0 → Day 5) con implementación completa de:

- Sistema de auto-IDs (SKU) para todas las tablas
- Servicios CRUD para catálogos (Medios de Pago, Cuentas)
- TransactionService (core del sistema)
- DataSeeder para generación de datos de prueba
- Suite de testing integral (41/41 tests pasados)

### Day 5 Completed: Integration Testing ✅

#### ✨ Added

- **TESTS_Sprint2_Final.js**: Suite de 5 tests de integración end-to-end
  - Test 1: Setup completo del sistema
  - Test 2: Generación de transacciones (seed)
  - Test 3: Validación de integridad referencial
  - Test 4: Cálculos financieros (totales, promedios)
  - Test 5: Performance y capacidad

- **walkthrough.md**: Documentación completa del Sprint 2
  - Timeline detallado (Days 0-5)
  - Todos los entregables
  - Tests ejecutados
  - Bugs resueltos

#### 📊 Testing

- ✅ 5/5 tests de integración pasados
- ✅ Sistema validado end-to-end
- ✅ 41/41 tests totales del sprint

### Day 4 Completed: TransactionService ✅

#### ✨ Added

- **09_TransactionService.js**: Servicio completo para DB_TRANSACCIONES (core del sistema)
  - CRUD: createTransaccion(), getAllTransacciones(), getTransaccionById(), updateTransaccion(), deleteTransaccion()
  - Filtrado: getTransaccionesBySentido(), getTransaccionesByFechas()
  - Auto-ID: Genera TRX-XXXXXX automáticamente
  - Cálculo automático de monto_base
  - Validación CRÍTICA: fx_id obligatorio para monedas extranjeras
  - clearAllTransacciones() - Para re-seed
  - calcularTotales(), getResumenTransacciones()
- **98_DataSeeder.js**: Actualizado con seedTransacciones()
  - Genera N transacciones aleatorias realistas
  - 70% egresos, 30% ingresos
  - 80% moneda base, 20% extranjeras (con fx_id auto)
  - Montos realistas según sentido

#### 📊 Testing

- ✅ 10/10 tests pasados
- Validación fx_id funcionando correctamente
- Cálculo monto_base verificado
- Seed de 10 transacciones OK

### Day 3 Completed: DataSeeder - Parte 1 ✅

#### ✨ Added

- **98_DataSeeder.js**: Utilidades para seeding
  - seedCompleto() - Inicializa todos los catálogos
  - Helper functions: randomDate(), randomMonto(), randomDescripcion(), randomCuenta(), randomMedio(), etc.
  - checkPrerequisites() - Verifica catálogos
  - Placeholders para seedTransacciones() (implementado en Day 4)

#### 📊 Testing

- ✅ 3/3 tests pasados
- seedCompleto() funciona correctamente
- Todas las funciones helper validadas

### Day 2 Completed: CuentaService ✅

#### ✨ Added

- **08_CuentaService.js**: Servicio completo para DB_CUENTAS
  - CRUD: createCuenta(), getAllCuentas(), getCuentaById(), updateCuenta(), deleteCuenta()
  - Filtrado: getCuentasByMacroTipo()
  - Auto-ID: Genera CTA-XXX automáticamente
  - initializeCuentasBasicas() - 11 cuentas (3 ingresos + 8 egresos)
  - Integración completa con schema (4 columnas: cuenta_id, nombre_cuentas, macro_tipo, es_recurrente)

#### 🔧 Fixed

- validateCuenta() en DataValidation
  - Agregado parámetro `isUpdate` para evitar error en updates
  - Eliminada función duplicada vieja

#### 📊 Testing

- ✅ 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando CTA-001, CTA-002, etc.

### Day 1 Completed: MedioPagoService ✅

#### ✨ Added

- **07_MedioPagoService.js**: Servicio completo para DB_MEDIOS_PAGO
  - CRUD: createMedioPago(), getAllMediosPago(), getMedioPagoById(), updateMedioPago(), deleteMedioPago()
  - Filtrado: getMediosByTipo()
  - Auto-ID: Genera MED-XXX automáticamente
  - initializeMediosPagoBasicos() - 5 medios preconfigurados
  - Integración completa con schema (5 columnas: medio_id, nombre_medio, tipo, moneda_id, uso_principal)

#### 🔧 Fixed

- validateMedioPago() en DataValidation
  - Agregado parámetro `isUpdate` para evitar error en updates
  - Validación de FK moneda_id
  - Validación de enum uso_principal (opcional)

#### 📊 Testing

- ✅ 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando MED-001, MED-002, etc.

### Day 0 Completed: Auto-ID Migration ✅

#### 🔧 Changed

- **02_Utils.js**: Agregado `generateNextId(tableName, prefix, padding)`
- **05_MonedaService.js**: `createMoneda(nombre, simbolo)` - sin moneda_id manual
- **06_ExchangeRateService.js**: fx_id auto-generado (FX-XXXXX)
- **10_ConfigService.js**: config_id auto-generado (CFG-XXX)
- **99_SetupDirect.js**: Actualizado para usar auto-IDs

#### 📊 Testing

- ✅ 5/5 tests pasados
- MON-001, MON-002, MON-003 en vez de ARS, USD, EUR
- FX-00001, FX-00002 en vez de timestamps

---

## v0.2.0 - Sprint 1: Exchange Rates & Config (2026-01-17)

### ✨ Added

- **10_ConfigService.js**: Configuración global del sistema
  - getConfig(), setBaseMoneda(), setFuentePreferida()
  - initializeConfig() con defaults (ARS, oficial)
  - Advertencias al cambiar moneda base
- **06_ExchangeRateService.js**: Gestión de tipos de cambio
  - CRUD de DB_TIPOS_CAMBIO
  - fetchExchangeRatesFromAPI() - Integración con ExchangeRate-API
  - getLatestRate() - Obtiene TC más reciente para un par
  - calculateMontoBase() - Conversión con validación de par
  - cleanupOldRates() - Limpieza de rates antiguos
- **99_SetupDirect.js**: Utilidades de setup
  - setupCompleto() - Inicialización del sistema en un comando
  - initializeMonedasDirect(), initializeConfigDirect()
  - Funciones de testing (test3 a test14)

### 🔧 Fixed

- Mejorado: initializeMonedas() solo agrega monedas faltantes
- Corregido: Detección de filas vacías en getTableData()
- Implementado: Inserción directa en celdas específicas

### 📊 Testing

- ✅ 14 tests completos (2026-01-18)
- ConfigService: Lectura, escritura, validaciones
- ExchangeRateService: CRUD, API, cálculos
- Todas las validaciones funcionando correctamente

---

## v0.1.0 - Sprint 0: Core Setup (2026-01-17)

### ✨ Added

- **00_Config.js**: Configuración global del sistema
  - Constantes de hoja y rangos de columnas
  - Enums para valores cerrados (sentido, macro_tipo, fuente, status)
  - Configuración de API
  - Mensajes de error centralizados
- **01_Version.js**: Sistema de versionado
  - Control de versiones Semantic Versioning
  - Changelog embebido
  - Funciones de logging de versión
- **02_Utils.js**: Utilidades generales
  - Generación de IDs únicos
  - Manejo de fecha/hora
  - Validación de enums
  - Logging centralizado (error, info, success)
  - Notificaciones al usuario (toast, alert)
  - Utilidades de conversión de datos
- **03_SheetManager.js**: Gestor de acceso a hojas
  - Abstracción de operaciones CRUD
  - Lectura de tablas (`getTableData`, `getTableRange`)
  - Escritura (`appendRow`, `updateRow`, `deleteRow`)
  - Búsqueda por ID (`findById`, `existsById`)
  - Utilidades de columnas
- **04_DataValidation.js**: Validaciones de schema
  - Implementa todas las reglas de DATABASE_SCHEMA
  - Validación de monedas, tipos de cambio, medios, cuentas, transacciones
  - **Regla crítica**: fx_id obligatorio para moneda extranjera
  - Validación de integridad referencial (FKs)
- **05_MonedaService.js**: Servicio de monedas
  - CRUD completo para DB_MONEDAS
  - Inicialización de monedas básicas (ARS, USD, EUR)
  - Utilidades para dropdowns
- **appsscript.json**: Manifest OAuth
  - Scopes para acceso a Sheets y requests externos

### 🔧 Technical Notes

- Sistema modular con 7 archivos
- ~1,000 líneas de código
- 45+ funciones implementadas
- 6 reglas críticas de validación
- Arquitectura por capas (Config → Utils → SheetManager → Validation → Services)

---

## Formato

Las versiones siguen [Semantic Versioning](https://semver.org/):

- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible hacia atrás
- **PATCH**: Correcciones de bugs

### Tipos de Cambios

- ✨ **Added** para nuevas funcionalidades
- 🔧 **Changed** para cambios en funcionalidad existente
- 🚨 **Deprecated** para funcionalidades que se eliminarán pronto
- ❌ **Removed** para funcionalidades eliminadas
- 🐛 **Fixed** para correcciones de bugs
- 🔒 **Security** para vulnerabilidades corregidas

### ✨ Added

- **00_Config.js**: Configuración global del sistema
  - Constantes de hoja y rangos de columnas
  - Enums para valores cerrados (sentido, macro_tipo, fuente, status)
  - Configuración de API
  - Mensajes de error centralizados
- **01_Version.js**: Sistema de versionado
  - Control de versiones Semantic Versioning
  - Changelog embebido
  - Funciones de logging de versión
- **02_Utils.js**: Utilidades generales
  - Generación de IDs únicos
  - Manejo de fecha/hora
  - Validación de enums
  - Logging centralizado (error, info, success)
  - Notificaciones al usuario (toast, alert)
  - Utilidades de conversión de datos
- **03_SheetManager.js**: Gestor de acceso a hojas
  - Abstracción de operaciones CRUD
  - Lectura de tablas (`getTableData`, `getTableRange`)
  - Escritura (`appendRow`, `updateRow`, `deleteRow`)
  - Búsqueda por ID (`findById`, `existsById`)
  - Utilidades de columnas
- **04_DataValidation.js**: Validaciones de schema
  - Implementa todas las reglas de DATABASE_SCHEMA
  - Validación de monedas, tipos de cambio, medios, cuentas, transacciones
  - **Regla crítica**: fx_id obligatorio para moneda extranjera
  - Validación de integridad referencial (FKs)
- **05_MonedaService.js**: Servicio de monedas
  - CRUD completo para DB_MONEDAS
  - Inicialización de monedas básicas (ARS, USD, EUR)
  - Utilidades para dropdowns
- **appsscript.json**: Manifest OAuth
  - Scopes para acceso a Sheets y requests externos

### 🔧 Technical Notes

- Sistema modular con 7 archivos
- ~1,000 líneas de código
- 45+ funciones implementadas
- 6 reglas críticas de validación
- Arquitectura por capas (Config → Utils → SheetManager → Validation → Services)

---

## v0.4.0 - Sprint 3: UI Development (2026-01-18) - IN PROGRESS

### Day 0 Completed: Design System ✅

#### ✨ Added

- **CSS_DesignSystem.html** (500+ líneas): Sistema de diseño completo
  - Variables CSS (colores, tipografía, spacing, shadows)
  - CSS Reset
  - Utilities (typography, spacing, layout, flex, grid)
  - Componentes base (buttons, inputs, selects, labels)
  - Neumorphic shadows (dual light/dark)
  - League Spartan font de Google Fonts
  - Responsive breakpoint (768px)

- **CSS_Components.html** (400+ líneas): Componentes específicos
  - StatCard (métricas financieras con iconos)
  - Badge (status indicators)
  - Alert (success, error, warning, info)
  - Table (con hover states)
  - Modal/Dialog
  - Tooltip
  - Progress bar
  - Skeleton loader
  - Chip/Tag
  - Empty state

- **UI_DesignSystemTest.html**: Página de testing visual
  - Showcase de todos los componentes
  - Paleta de colores
  - Typography scale
  - Estados interactivos

- **11_UIService.js**: Servicio para dialogs
  - Función `include()` para templates
  - `showDesignSystemTest()` para testing

#### 🎨 Design Decisions

- **Estética:** Neumorfismo con sombras duales suaves
- **Paleta:** Grises/azules (#e8ecf1 base, acentos verde/rojo para ingresos/egresos)
- **Fuente:** League Spartan (300-700 weights)
- **Arquitectura:** Atomic Design (átomos → moléculas → organismos)

#### 📊 Testing

- ✅ Visual testing completo
- ✅ Todos los componentes renderizan correctamente
- ✅ Neumorfismo aplicado (sombras suaves, depth correcta)
- ✅ Fuente Google cargada

---

## v0.3.0 - Sprint 2: Catálogos & Data Seeding (2026-01-18) ✅ RELEASED

### 🎯 Resumen del Sprint

Sprint completado exitosamente en 6 días (Day 0 → Day 5) con implementación completa de:

- Sistema de auto-IDs (SKU) para todas las tablas
- Servicios CRUD para catálogos (Medios de Pago, Cuentas)
- TransactionService (core del sistema)
- DataSeeder para generación de datos de prueba
- Suite de testing integral (41/41 tests pasados)

### Day 5 Completed: Integration Testing ✅

#### ✨ Added

- **TESTS_Sprint2_Final.js**: Suite de 5 tests de integración end-to-end
  - Test 1: Setup completo del sistema
  - Test 2: Generación de transacciones (seed)
  - Test 3: Validación de integridad referencial
  - Test 4: Cálculos financieros (totales, promedios)
  - Test 5: Performance y capacidad

- **walkthrough.md**: Documentación completa del Sprint 2
  - Timeline detallado (Days 0-5)
  - Todos los entregables
  - Tests ejecutados
  - Bugs resueltos

#### 📊 Testing

- ✅ 5/5 tests de integración pasados
- ✅ Sistema validado end-to-end
- ✅ 41/41 tests totales del sprint

### Day 4 Completed: TransactionService ✅

#### ✨ Added

- **09_TransactionService.js**: Servicio completo para DB_TRANSACCIONES (core del sistema)
  - CRUD: createTransaccion(), getAllTransacciones(), getTransaccionById(), updateTransaccion(), deleteTransaccion()
  - Filtrado: getTransaccionesBySentido(), getTransaccionesByFechas()
  - Auto-ID: Genera TRX-XXXXXX automáticamente
  - Cálculo automático de monto_base
  - Validación CRÍTICA: fx_id obligatorio para monedas extranjeras
  - clearAllTransacciones() - Para re-seed
  - calcularTotales(), getResumenTransacciones()
- **98_DataSeeder.js**: Actualizado con seedTransacciones()
  - Genera N transacciones aleatorias realistas
  - 70% egresos, 30% ingresos
  - 80% moneda base, 20% extranjeras (con fx_id auto)
  - Montos realistas según sentido

#### 📊 Testing

- ✅ 10/10 tests pasados
- Validación fx_id funcionando correctamente
- Cálculo monto_base verificado
- Seed de 10 transacciones OK

### Day 3 Completed: DataSeeder - Parte 1 ✅

#### ✨ Added

- **98_DataSeeder.js**: Utilidades para seeding
  - seedCompleto() - Inicializa todos los catálogos
  - Helper functions: randomDate(), randomMonto(), randomDescripcion(), randomCuenta(), randomMedio(), etc.
  - checkPrerequisites() - Verifica catálogos
  - Placeholders para seedTransacciones() (implementado en Day 4)

#### 📊 Testing

- ✅ 3/3 tests pasados
- seedCompleto() funciona correctamente
- Todas las funciones helper validadas

### Day 2 Completed: CuentaService ✅

#### ✨ Added

- **08_CuentaService.js**: Servicio completo para DB_CUENTAS
  - CRUD: createCuenta(), getAllCuentas(), getCuentaById(), updateCuenta(), deleteCuenta()
  - Filtrado: getCuentasByMacroTipo()
  - Auto-ID: Genera CTA-XXX automáticamente
  - initializeCuentasBasicas() - 11 cuentas (3 ingresos + 8 egresos)
  - Integración completa con schema (4 columnas: cuenta_id, nombre_cuentas, macro_tipo, es_recurrente)

#### 🔧 Fixed

- validateCuenta() en DataValidation
  - Agregado parámetro `isUpdate` para evitar error en updates
  - Eliminada función duplicada vieja

#### 📊 Testing

- ✅ 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando CTA-001, CTA-002, etc.

### Day 1 Completed: MedioPagoService ✅

#### ✨ Added

- **07_MedioPagoService.js**: Servicio completo para DB_MEDIOS_PAGO
  - CRUD: createMedioPago(), getAllMediosPago(), getMedioPagoById(), updateMedioPago(), deleteMedioPago()
  - Filtrado: getMediosByTipo()
  - Auto-ID: Genera MED-XXX automáticamente
  - initializeMediosPagoBasicos() - 5 medios preconfigurados
  - Integración completa con schema (5 columnas: medio_id, nombre_medio, tipo, moneda_id, uso_principal)

#### 🔧 Fixed

- validateMedioPago() en DataValidation
  - Agregado parámetro `isUpdate` para evitar error en updates
  - Validación de FK moneda_id
  - Validación de enum uso_principal (opcional)

#### 📊 Testing

- ✅ 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando MED-001, MED-002, etc.

### Day 0 Completed: Auto-ID Migration ✅

#### 🔧 Changed

- **02_Utils.js**: Agregado `generateNextId(tableName, prefix, padding)`
- **05_MonedaService.js**: `createMoneda(nombre, simbolo)` - sin moneda_id manual
- **06_ExchangeRateService.js**: fx_id auto-generado (FX-XXXXX)
- **10_ConfigService.js**: config_id auto-generado (CFG-XXX)
- **99_SetupDirect.js**: Actualizado para usar auto-IDs

#### 📊 Testing

- ✅ 5/5 tests pasados
- MON-001, MON-002, MON-003 en vez de ARS, USD, EUR
- FX-00001, FX-00002 en vez de timestamps

---

## v0.2.0 - Sprint 1: Exchange Rates & Config (2026-01-17)

### ✨ Added

- **10_ConfigService.js**: Configuración global del sistema
  - getConfig(), setBaseMoneda(), setFuentePreferida()
  - initializeConfig() con defaults (ARS, oficial)
  - Advertencias al cambiar moneda base
- **06_ExchangeRateService.js**: Gestión de tipos de cambio
  - CRUD de DB_TIPOS_CAMBIO
  - fetchExchangeRatesFromAPI() - Integración con ExchangeRate-API
  - getLatestRate() - Obtiene TC más reciente para un par
  - calculateMontoBase() - Conversión con validación de par
  - cleanupOldRates() - Limpieza de rates antiguos
- **99_SetupDirect.js**: Utilidades de setup
  - setupCompleto() - Inicialización del sistema en un comando
  - initializeMonedasDirect(), initializeConfigDirect()
  - Funciones de testing (test3 a test14)

### 🔧 Fixed

- Mejorado: initializeMonedas() solo agrega monedas faltantes
- Corregido: Detección de filas vacías en getTableData()
- Implementado: Inserción directa en celdas específicas

### 📊 Testing

- ✅ 14 tests completos (2026-01-18)
- ConfigService: Lectura, escritura, validaciones
- ExchangeRateService: CRUD, API, cálculos
- Todas las validaciones funcionando correctamente

### 🚀 Próximo Sprint

v0.3.0 - Catálogos & Data Seeding

---

## Próximas Versiones

- Servicio de tipos de cambio (ExchangeRateService)
- Integración con API externa
- Cálculo automático de monto_base
- Servicio de configuración (ConfigService)

---

## Formato

Las versiones siguen [Semantic Versioning](https://semver.org/):

- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible hacia atrás
- **PATCH**: Correcciones de bugs

### Tipos de Cambios

- ✨ **Added** para nuevas funcionalidades
- 🔧 **Changed** para cambios en funcionalidad existente
- 🚨 **Deprecated** para funcionalidades que se eliminarán pronto
- ❌ **Removed** para funcionalidades eliminadas
- 🐛 **Fixed** para correcciones de bugs
- 🔒 **Security** para vulnerabilidades corregidas
