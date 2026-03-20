# Testing Guide - Day 0: Auto-ID Migration

Guía para testear la migración completa al sistema de Auto-Generación de IDs.

---

## Pre-requisitos

1. Todos los archivos actualizados copiados a Apps Script:
 - `02_Utils.js` (con generateNextId)
 - `05_MonedaService.js` (nuevo createMoneda)
 - `06_ExchangeRateService.js` (fx_id auto)
 - `10_ConfigService.js` (config_id auto)
 - `99_SetupDirect.js` (actualizado)

2. ️ **IMPORTANTE:** Borrar TODOS los datos existentes de las tablas
 - En Google Sheet, borrar filas 4+ de todas las columnas
 - O seleccionar todas las filas con datos y hacer "Delete rows"

---

## Test 1: Verificar generateNextId()

**Objetivo:** Probar la función de generación de IDs.

**Función de Test:**
```javascript
function test_Day0_1_GenerateNextId() {
 // Test con tabla vacía
 const id1 = generateNextId('MONEDAS', 'MON', 3);
 Logger.log(`Primer ID (tabla vacía): ${id1}`);
 // Esperado: MON-001
 
 // Crear una moneda para tener datos
 createMoneda('Test Moneda', 'T$');
 
 // Test con 1 registro
 const id2 = generateNextId('MONEDAS', 'MON', 3);
 Logger.log(`Segundo ID: ${id2}`);
 // Esperado: MON-002
}
```

**Resultado Esperado:**
```
Primer ID (tabla vacía): MON-001
 SUCCESS: Moneda creada: MON-001 - Test Moneda
Segundo ID: MON-002
```

** Criterio:** 
- Primer ID = MON-001
- Segundo ID = MON-002
- IDs son secuenciales y únicos

---

## Test 2: Crear Monedas con Auto-ID

**Objetivo:** Verificar que createMoneda ya NO requiere moneda_id.

**Función de Test:**
```javascript
function test_Day0_2_CreateMonedaAutoId() {
 // ANTES tenías que hacer: createMoneda('ARS', 'Peso', '$')
 // AHORA solo pasas nombre y símbolo
 
 createMoneda('Peso argentino', '$');
 createMoneda('Dólar estadounidense', 'US$');
 createMoneda('Euro', '€');
 
 // Verificar
 const monedas = getAllMonedas();
 Logger.log(`Total monedas: ${monedas.length}`);
 monedas.forEach(m => {
 Logger.log(`${m.moneda_id}: ${m.nombre_moneda} (${m.simbolo})`);
 });
}
```

**Resultado Esperado en Sheet (B4:D6):**

| moneda_id | nombre_moneda | simbolo |
|-----------|---------------|---------|
| MON-001 | Peso argentino | $ |
| MON-002 | Dólar estadounidense | US$ |
| MON-003 | Euro | € |

**Resultado Esperado en Log:**
```
 SUCCESS: Moneda creada: MON-001 - Peso argentino
 SUCCESS: Moneda creada: MON-002 - Dólar estadounidense
 SUCCESS: Moneda creada: MON-003 - Euro
Total monedas: 3
MON-001: Peso argentino ($)
MON-002: Dólar estadounidense (US$)
MON-003: Euro (€)
```

** Criterio:** IDs son MON-001, MON-002, MON-003 (no ARS, USD, EUR)

---

## Test 3: Setup Completo con Auto-IDs

**Objetivo:** Verificar que setupCompleto funciona con auto-IDs.

**Pasos:**
1. **Limpiar Sheet completamente** (borrar filas 4+)
2. Ejecutar: `setupCompleto()`

**Resultado Esperado:**

**DB_MONEDAS (B4:D6):**
| moneda_id | nombre_moneda | simbolo |
|-----------|---------------|---------|
| MON-001 | Peso argentino | $ |
| MON-002 | Dólar estadounidense | US$ |
| MON-003 | Euro | € |

**DB_CONFIG (AO4:AQ4):**
| config_id | base_moneda_id | fuente_tc_preferida |
|-----------|----------------|---------------------|
| CFG-001 | MON-001 | oficial |

**Logs:**
```
==================================================
Iniciando setup completo del sistema
==================================================
Paso 1/2: Inicializando monedas...
 SUCCESS: Moneda creada: MON-001 - Peso argentino
 SUCCESS: Moneda creada: MON-002 - Dólar estadounidense
 SUCCESS: Moneda creada: MON-003 - Euro
Paso 2/2: Inicializando configuración...
 SUCCESS: Config inicializada: base=MON-001, fuente=oficial
==================================================
 Setup completo finalizado exitosamente
==================================================
```

** Criterio:** 
- Monedas tienen MON-XXX
- Config tiene CFG-001
- base_moneda_id = MON-001 (primera moneda creada)

---

## Test 4: Crear Tipos de Cambio con Auto-ID

**Objetivo:** Verificar que fx_id se auto-genera.

**Función de Test:**
```javascript
function test_Day0_4_CreateExchangeRateAutoId() {
 // ANTES: fx_id se generaba con generateId() (timestamp)
 // AHORA: fx_id se genera con generateNextId (FX-00001)
 
 const fx = {
 base_moneda_id: 'MON-001', // ARS según setup
 quote_moneda_id: 'MON-002', // USD según setup
 tc: 1050.50,
 fuente: 'oficial'
 };
 
 createExchangeRate(fx);
 
 // Crear otro
 const fx2 = {
 base_moneda_id: 'MON-003', // EUR
 quote_moneda_id: 'MON-002', // USD
 tc: 0.92,
 fuente: 'oficial'
 };
 
 createExchangeRate(fx2);
 
 // Verificar
 const rates = getAllExchangeRates();
 Logger.log(`Total rates: ${rates.length}`);
 rates.forEach(r => {
 Logger.log(`${r.fx_id}: ${r.base_moneda_id}/${r.quote_moneda_id} = ${r.tc}`);
 });
}
```

**Resultado Esperado:**
```
 SUCCESS: Tipo de cambio creado: MON-001/MON-002 = 1050.5 (fuente: oficial, fx_id: FX-00001)
 SUCCESS: Tipo de cambio creado: MON-003/MON-002 = 0.92 (fuente: oficial, fx_id: FX-00002)
Total rates: 2
FX-00001: MON-001/MON-002 = 1050.5
FX-00002: MON-003/MON-002 = 0.92
```

** Criterio:** fx_id tiene formato FX-XXXXX (no timestamp)

---

## Test 5: API Fetch con Auto-IDs

**Objetivo:** Verificar que API fetch genera fx_id secuenciales.

**Pasos:**
1. Ejecutar: `fetchExchangeRatesFromAPI('USD', 'oficial')`
2. Esperar respuesta (3-5 segundos)

**Resultado Esperado:**
- Múltiples TCs insertados
- Todos con fx_id formato FX-XXXXX

**Verificación:**
```javascript
function test_Day0_5_VerifyApiFetch() {
 const rates = getAllExchangeRates();
 rates.forEach(r => {
 const isValid = r.fx_id.startsWith('FX-');
 Logger.log(`${r.fx_id}: ${isValid ? '' : ''} ${r.base_moneda_id}/${r.quote_moneda_id}`);
 });
}
```

** Criterio:** Todos los fx_id empiezan con "FX-"

---

## Checklist de Validación Day 0

- [ ] Test 1: generateNextId() funciona correctamente
- [ ] Test 2: createMoneda() genera MON-XXX automáticamente
- [ ] Test 3: setupCompleto() crea MON-001, MON-002, MON-003 y CFG-001
- [ ] Test 4: createExchangeRate() genera FX-XXXXX automáticamente
- [ ] Test 5: API fetch usa FX-XXXXX (no timestamp)
- [ ] Verificar en Sheet que NO hay IDs manuales (ARS, USD, EUR)
- [ ] Verificar que todos los IDs son secuenciales

---

## Criterios de Aceptación Day 0

### Funcionales
- NO se requiere proveer IDs manualmente
- IDs se generan automáticamente con formato correcto
- IDs son secuenciales y únicos
- Setup completo funciona con auto-IDs

### Técnicos
- generateNextId() maneja tabla vacía
- generateNextId() extrae max number correctamente
- Todos los servicios usan auto-IDs
- No hay IDs duplicados

---

## Troubleshooting

### Error: "MON-001 ya existe"
**Causa:** Datos viejos en Sheet.
**Solución:** Borrar todas las filas de datos (4+) y volver a ejecutar.

### IDs tipo "20260118..." en vez de "MON-001"
**Causa:** Archivo no actualizado en Apps Script.
**Solución:** Verificar que el archivo copiado sea el correcto.

### Error: "generateNextId is not defined"
**Causa:** 02_Utils.js no actualizado.
**Solución:** Copiar 02_Utils.js con la nueva función.

---

## Próximo Paso

Si **TODOS** los tests pasan → **Día 0 completo**

Siguiente: **Día 1 - MedioPagoService** (Sprint 2)
