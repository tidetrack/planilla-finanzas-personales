# Guía de Módulos - Sistema Apps Script

Documentación detallada de cada módulo del sistema modular de Tidetrack.

**Última actualización**: 2026-01-23  
**Versión Actual**: v0.4.0 (Sprint 3 completo)

---

## 📋 Índice de Módulos

| # | Módulo | Capa | Estado |
|---|--------|------|--------|
| 00 | Config | Configuración | ✅ v0.4.0 |
| 01 | Version | Configuración | ✅ v0.1.0 |
| 02 | Utils | Utilidades | ✅ v0.3.0 |
| 03 | SheetManager | Acceso a Datos | ✅ v0.3.0 |
| 04 | DataValidation | Validación | ✅ v0.3.0 |
| 05 | MonedaService | Servicio | ✅ v0.3.0 |
| 06 | ExchangeRateService | Servicio | ✅ v0.2.0 |
| 07 | MedioPagoService | Servicio | ✅ v0.3.0 |
| 08 | CuentaService | Servicio | ✅ v0.3.0 |
| 09 | TransactionService | Servicio | ✅ v0.3.0 |
| 10 | ConfigService | Servicio | ✅ v0.2.0 |
| 11 | UIService | Interfaz | ✅ v0.4.0 |
| 12 | MenuService | Interfaz | ✅ v0.4.0 |
| 98 | DataSeeder | Testing | ✅ v0.3.0 |
| 99 | SetupDirect | Utilidades | ✅ v0.2.0 |

**Archivos HTML UI:**
- CSS_DesignSystem.html - ✅ v0.4.0
- CSS_Components.html - ✅ v0.4.0
- UI_DesignSystemTest.html - ✅ v0.4.0
- UI_TransactionForm.html - ✅ v0.4.0
- UI_MainDashboard.html - ✅ v0.4.0
- JS_FormValidation.html - ✅ v0.4.0
- JS_ApiClient.html - ✅ v0.4.0

---

## 🏗️ Arquitectura por Capas

```
┌─────────────────────────────────────┐
│  CAPA 5: INTERFAZ (UI)              │
│  11_UIPopups, 12_MenuActions        │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  CAPA 4: SERVICIOS (Business Logic) │
│  05-10: Moneda, FX, Medio, Cuenta,  │
│         Transaction, Config         │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  CAPA 3: VALIDACIÓN                 │
│  04_DataValidation                  │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  CAPA 2: ACCESO A DATOS             │
│  03_SheetManager                    │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  CAPA 1: UTILIDADES Y CONFIG        │
│  00_Config, 01_Version, 02_Utils    │
└─────────────────────────────────────┘
```

---

## 📦 Módulos Detallados

### 00_Config.js - Configuración Global

**Propósito**: Almacenar todas las constantes del sistema en un único lugar.

**Responsabilidades:**
- Definir nombre de hoja (`DATA-ENTRY`)
- Definir filas de encabezado y datos (3 y 4)
- **Rangos de columnas fijos** para las 6 tablas
- **Enums** (valores cerrados) para validación
- Configuración de API externa
- Defaults del sistema
- Mensajes de error centralizados

**Uso por Otros Módulos:**
- `SheetManager` usa `RANGES` para determinar columnas
- `DataValidation` usa `ENUM_*` para validar valores
- `ExchangeRateService` usa `API_CONFIG` para fetch

**Ejemplo de Uso:**
```javascript
// Obtener rango de monedas
const monedasConfig = RANGES.MONEDAS; // {start: 'B', end: 'D', columns: {...}}

// Validar sentido
if (!ENUM_SENTIDO.includes(valor)) {
  throw new Error("Sentido inválido");
}
```

**Regla Crítica:** Si cambias los rangos de columnas, **actualiza solo este archivo**. No hardcodees rangos en otros módulos.

---

### 01_Version.js - Control de Versiones

**Propósito**: Mantener registro de versión actual y changelog embebido.

**Responsabilidades:**
- Almacenar versión actual (major, minor, patch)
- Changelog completo del proyecto
- Funciones para obtener versión y changelog
- Logging de información de versión

**Uso:**
```javascript
// Obtener versión
const version = getVersion(); // "0.1.0"

// Mostrar info en log
logVersionInfo();
// Output:
// Tidetrack Personal Finance - Apps Script
// Versión: 0.1.0
// Release: Sprint 0 - Core Setup
```

**Actualización:**
```javascript
// Al inicio de cada sprint, actualizar:
const VERSION = {
  major: 0,
  minor: 2,  // ← Incrementar minor
  patch: 0,
  changelog: `
    v0.2.0 (2026-01-20)
    + Agregado: ExchangeRateService
    ...
  `
};
```

---

### 02_Utils.js - Utilidades Generales

**Propósito**: Funciones helper reutilizables en todo el sistema.

**Responsabilidades:**

#### Generación de IDs
```javascript
generateId()
// Output: "20260117223000-1234"

generateSimpleId('MON', 5)
// Output: "MON005"
```

#### Fecha y Hora
```javascript
getCurrentTimestamp()
// Output: "2026-01-17T22:30:00"

formatDate(new Date(), 'dd/MM/yyyy')
// Output: "17/01/2026"
```

#### Validación
```javascript
validateEnum('Ingreso', ENUM_SENTIDO, 'sentido')
// ✅ OK

validateEnum('Salida', ENUM_SENTIDO, 'sentido')
// ❌ Error: Valor no permitido

validatePositive(100, 'monto')
// ✅ OK

validateRequired(null, 'moneda_id')
// ❌ Error: Campo obligatorio
```

#### Logging
```javascript
logError('Error al cargar datos', {tabla: 'MONEDAS'})
// Output: ❌ ERROR: Error al cargar datos

logSuccess('Moneda creada correctamente')
// Output: ✅ SUCCESS: Moneda creada correctamente
```

#### Notificaciones
```javascript
showToast('Moneda creada', 'Éxito', 3)
// Muestra toast en Sheets por 3 segundos

showAlert('Confirmar eliminación', 'Atención')
// Muestra diálogo de alerta
```

---

### 03_SheetManager.js - Gestor de Acceso a Hojas

**Propósito**: Abstracción de operaciones CRUD sobre Google Sheets.

**Responsabilidades:**
- Acceso a hoja DATA-ENTRY
- Lectura de rangos por tabla
- Escritura (append, update, delete)
- Búsqueda por ID
- Utilidades de columnas

**¿Por qué existe?**
Evita que los servicios tengan que conocer detalles de rangos de columnas. Si cambia la ubicación de una tabla, solo se actualiza `Config` y `SheetManager`.

**API Principal:**

#### Lectura
```javascript
// Obtener datos de tabla
const data = getTableData('MONEDAS');
// Retorna: [['ARS', 'Peso argentino', '$'], ['USD', '...', '...']]

// Contar filas
const count = countTableRows('MONEDAS'); // 3
```

#### Escritura
```javascript
// Agregar fila
const newRow = ['EUR', 'Euro', '€'];
appendRow('MONEDAS', newRow);

// Actualizar fila (índice 0-based relativo a DATA_START_ROW)
updateRow('MONEDAS', 0, ['ARS', 'Peso Argentino', '$']);

// Eliminar fila
deleteRow('MONEDAS', 2); // Elimina fila índice 2 (EUR)
```

#### Búsqueda
```javascript
// Buscar por ID
const result = findById('MONEDAS', 'USD', 0); // 0 = columna del ID
// Retorna: {rowIndex: 1, rowData: ['USD', 'Dólar estadounidense', 'US$']}

// Verificar existencia
const existe = existsById('MONEDAS', 'EUR', 0); // true/false
```

**Regla Crítica:** Todos los servicios deben usar `SheetManager`, **nunca** acceder directamente a `getRange()` o `getValues()`.

---

### 04_DataValidation.js - Validaciones de Integridad

**Propósito**: Implementar todas las reglas del DATABASE_SCHEMA.

**Responsabilidades:**
- Validar objetos antes de escritura
- Verificar integridad referencial (FKs)
- Aplicar reglas de negocio
- Validar enums

**Funciones de Validación:**

#### Monedas
```javascript
function validateMoneda(moneda) {
  // Verifica:
  // - moneda_id, nombre_moneda, simbolo no vacíos
  // - moneda_id no duplicado
}
```

#### Tipos de Cambio
```javascript
function validateExchangeRate(fx) {
  // Verifica:
  // - tc > 0
  // - base_moneda_id ≠ quote_moneda_id
  // - base y quote existen en DB_MONEDAS
  // - fuente y status son enums válidos
}
```

#### Transacciones (REGLA CRÍTICA)
```javascript
function validateTransaction(trx, config) {
  // Verifica:
  // - monto > 0
  // - sentido válido (Ingreso/Egreso)
  // - cuenta_id, medio_id, moneda_id existen (FKs)
  
  // REGLA FUNDAMENTAL:
  if (trx.moneda_id !== config.base_moneda_id) {
    // fx_id es OBLIGATORIO
    validateRequired(trx.fx_id, 'fx_id');
    
    // fx_id debe existir y tener status='ok'
    const fx = findById('TIPOS_CAMBIO', trx.fx_id, 0);
    if (fx.status !== 'ok') {
      throw new Error("fx_id debe tener status='ok'");
    }
  }
}
```

**Uso en Servicios:**
```javascript
function createMoneda(id, nombre, simbolo) {
  const moneda = {moneda_id: id, nombre_moneda: nombre, simbolo};
  
  // SIEMPRE validar antes de escribir
  validateMoneda(moneda);
  
  // Solo si validación pasa, escribir
  appendRow('MONEDAS', [id, nombre, simbolo]);
}
```

---

### 05_MonedaService.js - Servicio de Monedas

**Propósito**: CRUD completo para DB_MONEDAS.

**Responsabilidades:**
- Crear, leer, actualizar, eliminar monedas
- Inicialización de datos básicos (ARS, USD, EUR)
- Utilidades para UI (lista de códigos para dropdowns)

**API Completa:**

#### Lectura
```javascript
// Todas las monedas
const monedas = getAllMonedas();
// [{moneda_id: 'ARS', nombre_moneda: '...', simbolo: '$'}, ...]

// Una moneda
const ars = getMonedaById('ARS');
// {moneda_id: 'ARS', nombre_moneda: 'Peso argentino', simbolo: '$'}

// Verificar existencia
const existe = monedaExists('USD'); // true/false

// Para dropdowns
const codes = getMonedaCodes(); // ['ARS', 'USD', 'EUR']
```

#### Escritura
```javascript
// Crear
createMoneda('BRL', 'Real brasileño', 'R$');
// ✅ Valida + inserta + muestra toast

// Actualizar
updateMoneda('BRL', 'Real de Brasil', 'R$');

// Eliminar
deleteMoneda('BRL');
// ⚠️ Muestra advertencia si tiene FKs
```

#### Inicialización
```javascript
// Seed de monedas básicas (solo si tabla vacía)
initializeMonedas();
// Crea: ARS, USD, EUR
```

**Flujo Interno:**
```
Usuario llama createMoneda('EUR', 'Euro', '€')
    ↓
MonedaService valida (via DataValidation)
    ↓
Si OK: MonedaService escribe (via SheetManager)
    ↓
SheetManager accede a Sheets (usando Config)
    ↓
Fila insertada + Toast mostrado
```

---

## 🔄 Flujo de Dependencias

```
Config ────→ Utils ────→ SheetManager ────→ DataValidation ────→ Services
  ↑                                               ↓
  └───────────────────────────────────────────────┘
           (Services leen Config para validaciones)
```

**Reglas:**
- ❌ Servicios NO llaman a otros Servicios directamente
- ✅ Servicios llaman a DataValidation
- ✅ DataValidation llama a SheetManager (para verificar FKs)
- ✅ SheetManager llama a Utils

---

## 📚 Convenciones de Código

### Nombrado de Funciones

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| **CRUD - Obtener todos** | `getAll<Entidad>()` | `getAllMonedas()` |
| **CRUD - Obtener uno** | `get<Entidad>ById(id)` | `getMonedaById('USD')` |
| **CRUD - Crear** | `create<Entidad>(params)` | `createMoneda(id, nombre, simbolo)` |
| **CRUD - Actualizar** | `update<Entidad>(id, params)` | `updateMoneda(id, nombre, simbolo)` |
| **CRUD - Eliminar** | `delete<Entidad>(id)` | `deleteMoneda(id)` |
| **Validación** | `validate<Entidad>(obj)` | `validateMoneda(moneda)` |
| **Verificación** | `<entidad>Exists(id)` | `monedaExists('USD')` |
| **Utilidades** | `<verbo><Sustantivo>()` | `generateId()`, `formatDate()` |

### Documentación JSDoc

```javascript
/**
 * Descripción breve de la función
 * @param {string} parametro1 Descripción del parámetro
 * @returns {Object} Descripción del retorno
 * @throws {Error} Cuándo lanza error
 */
function miFuncion(parametro1) {
  // ...
}
```

---

## ✅ Checklist de Implementación de Nuevo Módulo

Cuando crees un nuevo módulo (ej: `07_MedioPagoService.js`):

1. [ ] Usar número secuencial correcto
2. [ ] Incluir header JSDoc con @version, @since, @lastModified
3. [ ] Implementar funciones CRUD estándar:
   - [ ] `getAll<Entidad>()`
   - [ ] `get<Entidad>ById(id)`
   - [ ] `create<Entidad>(...)`
   - [ ] `update<Entidad>(id, ...)`
   - [ ] `delete<Entidad>(id)`
4. [ ] Llamar a `validate<Entidad>()` antes de crear/actualizar
5. [ ] Usar `SheetManager` para todas las operaciones de Sheets
6. [ ] Mostrar toast al usuario en operaciones exitosas
7. [ ] Loggear con `logSuccess()`, `logError()` según corresponda
8. [ ] Actualizar `01_Version.js` con nuevo changelog
9. [ ] Agregar entrada en esta guía

---

## 🚀 Próximos Módulos (Planificados)

### 06_ExchangeRateService.js (Sprint 1)
- `getAllExchangeRates()`
- `getLatestRate(base, quote, fuente)`
- `fetchExchangeRatesFromAPI()` - Fetch desde ExchangeRate-API
- `calculateMontoBase(monto, moneda_id, fx_id)`

### 07_MedioPagoService.js (Sprint 2)
- CRUD de DB_MEDIOS_PAGO
- `getMediosByTipo(tipo)`

### 08_CuentaService.js (Sprint 2)
- CRUD de DB_CUENTAS
- `getCuentasByMacroTipo(macro_tipo)`

### 09_TransactionService.js (Sprint 3) - CORE
- CRUD de DB_TRANSACCIONES
- `createTransaction()` con lógica completa de fx_id y monto_base
- `getMonthSummary(year, month)`

### 10_ConfigService.js (Sprint 2)
- `getConfig()` - Obtener configuración activa
- `getBaseMoneda()` - Moneda base del sistema
- `setBaseMoneda(moneda_id)` - Cambiar moneda base

### 11_UIPopups.js (Sprint 4)
- `showTransactionPopup()` - Popup de registro
- `showExchangeRatePopup()` - Popup de tipo de cambio
- Formularios HTML dinámicos

### 12_MenuActions.js (Sprint 4)
- `onOpen()` - Crear menú personalizado
- `menuRegistrarTransaccion()`
- `menuActualizarTC()`
- `menuValidarIntegridad()`

---

**Versión de la Guía**: 2.0  
**Última actualización**: 2026-01-23  
**Módulos Documentados**: 15 de 15 (100% completo)  
**Archivos HTML UI**: 7 de 7 (100% completo)
