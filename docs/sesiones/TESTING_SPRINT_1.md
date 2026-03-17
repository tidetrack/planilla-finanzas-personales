# Guía de Testing - Sprint 1 (v0.2.0)

Testing de ConfigService y ExchangeRateService con integración de API.

---

## 📋 Pre-requisitos

- ✅ Sprint 0 completado y testeado
- ✅ 10_ConfigService.js copiado a Apps Script
- ✅ 06_ExchangeRateService.js copiado a Apps Script
- ✅ DB_MONEDAS tiene al menos ARS, USD, EUR

---

## 🧪 Tests de ConfigService

### Test 1: Inicializar Configuración

**Módulo:** `99_SetupDirect.js` (o `10_ConfigService.js` - función `initializeConfig`)

**Objetivo:** Crear configuración inicial del sistema.

**⚠️ IMPORTANTE:** Si ya ejecutaste `setupCompleto()` en Sprint 0 Test 5, este test ya está completo y puedes saltearlo.

**Pasos (si no ejecutaste setupCompleto antes):**
1. Ejecuta: `initializeConfigDirect()` (desde `99_SetupDirect.js`)

**Resultado Esperado en Sheet (DB_CONFIG):**

| config_id (AO) | base_moneda_id (AP) | fuente_tc_preferida (AQ) |
|----------------|---------------------|--------------------------|
| 1 | ARS | oficial |

**Log Esperado:**
```
✅ SUCCESS: Config inicializada: base=ARS, fuente=oficial
```

**Toast:** "Configuración inicializada correctamente"

**✅ Criterio:** Configuración creada correctamente.

---

### Test 2: Leer Configuración

**Módulo:** `10_ConfigService.js` - funciones `getConfig()`, `getBaseMoneda()`, `getFuentePreferida()`

**Objetivo:** Verificar getters.

**Pasos:**
```javascript
function testGetConfig() {
  const config = getConfig();
  Logger.log(`Config completa: ${JSON.stringify(config)}`);
  
  const base = getBaseMoneda();
  Logger.log(`Moneda base: ${base}`);
  
  const fuente = getFuentePreferida();
  Logger.log(`Fuente preferida: ${fuente}`);
}
```

**Resultado Esperado:**
```
Config completa: {"config_id":1,"base_moneda_id":"ARS","fuente_tc_preferida":"oficial"}
Moneda base: ARS
Fuente preferida: oficial
```

**✅ Criterio:** Todos los getters retornan valores correctos.

---

### Test 3: Cambiar Moneda Base

**Módulo:** `10_ConfigService.js` - función `setBaseMoneda(moneda_id)`

**Objetivo:** Modificar moneda base del sistema.

**Pasos:**
1. Ejecuta: `setBaseMoneda('USD')`
2. Acepta el alert de advertencia
3. Verifica en Sheet que cambió a USD

**Resultado Esperado:**
- Alert con advertencia sobre recálculo de histórico
- Columna AP cambia de ARS a USD
- Toast: "Moneda base actualizada a USD"

**✅ Criterio:** Moneda base se actualiza y muestra advertencias.

---

### Test 4: Cambiar Fuente Preferida

**Módulo:** `10_ConfigService.js` - función `setFuentePreferida(fuente)`

**Objetivo:** Modificar fuente de TC.

**Pasos:**
1. Ejecuta: `setFuentePreferida('MEP')`

**Resultado Esperado:**
- Columna AQ cambia de "oficial" a "MEP"
- Toast: "Fuente preferida: MEP"

**✅ Criterio:** Fuente se actualiza correctamente.

---

### Test 5: Validation - Moneda Inexistente

**Módulo:** `10_ConfigService.js` (usa validación de `04_DataValidation.js`)

**Objetivo:** Verificar que no acepta monedas inválidas.

**Pasos:**
```javascript
function testInvalidMoneda() {
  try {
    setBaseMoneda('XXX');
    Logger.log('❌ NO debería permitir XXX');
  } catch (e) {
    Logger.log(`✅ Error esperado: ${e.message}`);
  }
}
```

**Resultado Esperado:**
```
✅ Error esperado: DB_MONEDAS. moneda_id = "XXX" no existe
```

**✅ Criterio:** Rechaza moneda inexistente con FK error.

---

## 🧪 Tests de ExchangeRateService - Manual

### Test 6: Crear Tipo de Cambio Manual

**Módulo:** `06_ExchangeRateService.js` - función `createExchangeRate(fx)`

**Objetivo:** Insertar TC manualmente.

**Pasos:**
```javascript
function testCreateManualRate() {
  // Volver base a ARS si cambió
  setBaseMoneda('ARS');
  
  const fx = {
    base_moneda_id: 'ARS',
    quote_moneda_id: 'USD',
    tc: 1050.50,
    fuente: 'oficial'
  };
  
  createExchangeRate(fx);
}
```

**Resultado Esperado en Sheet (DB_TIPOS_CAMBIO):**

| fx_id | fecha | base | quote | tc | fuente | ... | status |
|-------|-------|------|-------|-----|--------|-----|--------|
| 2026... | 2026-01-17 | ARS | USD | 1050.5 | oficial | ... | ok |

**Log:**
```
✅ SUCCESS: Tipo de cambio creado: ARS/USD = 1050.5 (fuente: oficial, fx_id: ...)
```

**✅ Criterio:** TC se crea correctamente.

---

### Test 7: Validation - tc <= 0

**Módulo:** `06_ExchangeRateService.js` (usa `04_DataValidation.js`)

**Objetivo:** Rechazar TC inválido.

**Pasos:**
```javascript
function testInvalidTC() {
  try {
    createExchangeRate({
      base_moneda_id: 'ARS',
      quote_moneda_id: 'USD',
      tc: -100, // Inválido
      fuente: 'oficial'
    });
    Logger.log('❌ NO debería permitir tc negativo');
  } catch (e) {
    Logger.log(`✅ Error esperado: ${e.message}`);
  }
}
```

**Resultado Esperado:**
```
✅ Error esperado: tc debe ser un número mayor a 0
```

**✅ Criterio:** Rechaza tc <= 0.

---

### Test 8: Validation - base = quote

**Módulo:** `06_ExchangeRateService.js` (usa `04_DataValidation.js`)

**Objetivo:** Rechazar par inválido.

**Pasos:**
```javascript
function testSamePair() {
  try {
    createExchangeRate({
      base_moneda_id: 'ARS',
      quote_moneda_id: 'ARS', // Mismo
      tc: 1,
      fuente: 'oficial'
    });
    Logger.log('❌ NO debería permitir mismo par');
  } catch (e) {
    Logger.log(`✅ Error esperado: ${e.message}`);
  }
}
```

**Resultado Esperado:**
```
✅ Error esperado: base_moneda_id no puede ser igual a quote_moneda_id
```

**✅ Criterio:** Rechaza base = quote.

---

## 🌐 Tests de API Integration

### Test 9: Fetch desde API (USD base)

**Módulo:** `06_ExchangeRateService.js` - función `fetchExchangeRatesFromAPI(baseCurrency, fuente)`

**Objetivo:** Obtener cotizaciones desde ExchangeRate-API.

**Pasos:**
1. Ejecuta: `fetchExchangeRatesFromAPI('USD', 'oficial')`
2. Espera ~3-5 segundos (llamada HTTP)

**Resultado Esperado:**
- Múltiples filas en DB_TIPOS_CAMBIO (una por cada moneda que existe en DB_MONEDAS)
- Toast: "X tipos de cambio actualizados"
- Log con cantidad guardada

**Ejemplo de Filas Guardadas:**

| base | quote | tc | provider | status | raw_payload |
|------|-------|-----|----------|--------|-------------|
| ARS | USD | 1050.25 | exchangerate-api.com | ok | {"base":"USD"...} |
| EUR | USD | 0.92 | exchangerate-api.com | ok | {"base":"USD"...} |

**Log:**
```
ℹ️  INFO: Fetching exchange rates desde API: https://...
ℹ️  INFO: API response recibido: 150 rates
✅ SUCCESS: Fetch completado: 3 rates guardados
```

**✅ Criterio:** 
- Al menos 3 rates guardados (ARS, EUR, USD)
- status = 'ok'
- provider = 'exchangerate-api.com'
- raw_payload tiene JSON

---

### Test 10: Get Latest Rate

**Módulo:** `06_ExchangeRateService.js` - función `getLatestRate(base, quote, fuente)`

**Objetivo:** Obtener último TC para un par.

**Pasos:**
```javascript
function testGetLatestRate() {
  const latest = getLatestRate('ARS', 'USD', 'oficial');
  Logger.log(`Latest rate: ${JSON.stringify(latest)}`);
}
```

**Resultado Esperado:**
```
Latest rate: {"fx_id":"20260117...","tc":1050.25,"fecha":"2026-01-17","fuente":"oficial"}
```

**✅ Criterio:** Retorna el TC más reciente del par.

---

## 🔢 Tests de Cálculo

### Test 11: Calcular Monto Base - Sin Conversión

**Módulo:** `06_ExchangeRateService.js` - función `calculateMontoBase(monto, moneda_id, fx_id)`

**Objetivo:** Verificar que no convierte si ya está en moneda base.

**Pasos:**
```javascript
function testCalculateNoConversion() {
  // Asegurar que base = ARS
  setBaseMoneda('ARS');
  
  const monto = calculateMontoBase(1000, 'ARS', null);
  Logger.log(`Monto base: ${monto}`);
}
```

**Resultado Esperado:**
```
ℹ️  INFO: Sin conversión: 1000 ARS (ya es moneda base)
Monto base: 1000
```

**✅ Criterio:** Retorna mismo monto sin conversión.

---

### Test 12: Calcular Monto Base - Con Conversión

**Módulo:** `06_ExchangeRateService.js`

**Objetivo:** Convertir USD a ARS usando fx_id.

**Pasos:**
```javascript
function testCalculateWithConversion() {
  // Asegurar base = ARS
  setBaseMoneda('ARS');
  
  // Obtener último fx_id para ARS/USD
  const latest = getLatestRate('ARS', 'USD', 'oficial');
  const fx_id = latest.fx_id;
  
  // Convertir 100 USD
  const monto = calculateMontoBase(100, 'USD', fx_id);
  Logger.log(`100 USD = ${monto} ARS`);
}
```

**Resultado Esperado:**
```
ℹ️  INFO: Conversión: 100 USD × 1050.25 = 105025 ARS (fx_id: ...)
100 USD = 105025 ARS
```

**✅ Criterio:** Monto se convierte correctamente (100 * TC).

---

### Test 13: Error sin fx_id

**Módulo:** `06_ExchangeRateService.js`

**Objetivo:** Verificar que requiere fx_id para conversión.

**Pasos:**
```javascript
function testErrorNoFxId() {
  try {
    calculateMontoBase(100, 'USD', null); // Sin fx_id
    Logger.log('❌ Debería requerir fx_id');
  } catch (e) {
    Logger.log(`✅ Error esperado: ${e.message}`);
  }
}
```

**Resultado Esperado:**
```
✅ Error esperado: fx_id requerido para convertir USD a moneda base ARS
```

**✅ Criterio:** Error claro sobre fx_id faltante.

---

### Test 14: Error con fx_id incorrecto

**Módulo:** `06_ExchangeRateService.js`

**Objetivo:** Verificar validación de par.

**Pasos:**
```javascript
function testWrongPair() {
  // Crear TC para EUR/USD
  const fxEUR = createExchangeRate({
    base_moneda_id: 'EUR',
    quote_moneda_id: 'USD',
    tc: 0.92,
    fuente: 'oficial'
  });
  
  try {
    // Intentar usar ese fx para convertir ARS (incorrecto)
    calculateMontoBase(100, 'USD', fxEUR.fx_id);
    Logger.log('❌ NO debería permitir par incorrecto');
  } catch (e) {
    Logger.log(`✅ Error esperado: ${e.message}`);
  }
}
```

**Resultado Esperado:**
```
✅ Error esperado: fx_id incorrecto. Esperado par: ARS/USD, Encontrado: EUR/USD
```

**✅ Criterio:** Valida que fx_id corresponde al par correcto.

---

## ✅ Checklist de Validación Sprint 1

- [ ] Test 1: initializeConfig() crea config
- [ ] Test 2: getConfig() lee correctamente
- [ ] Test 3: setBaseMoneda() cambia y advierte
- [ ] Test 4: setFuentePreferida() cambia fuente
- [ ] Test 5: Rechaza moneda inexistente
- [ ] Test 6: createExchangeRate() manual funciona
- [ ] Test 7: Rechaza tc <= 0
- [ ] Test 8: Rechaza base = quote
- [ ] Test 9: fetchExchangeRatesFromAPI() guarda múltiples rates
- [ ] Test 10: getLatestRate() encuentra TC más reciente
- [ ] Test 11: calculateMontoBase() sin conversión
- [ ] Test 12: calculateMontoBase() con conversión correcta
- [ ] Test 13: Error sin fx_id
- [ ] Test 14: Error con fx_id de par incorrecto

---

## 🎯 Criterios de Aceptación Sprint 1

- ✅ Configuración se puede crear, leer y modificar
- ✅ TC se pueden crear manualmente
- ✅ TC se pueden obtener desde API
- ✅ Validaciones funcionan (tc>0, base≠quote, FK)
- ✅ Conversión de monto_base funciona correctamente
- ✅ Errores son claros y informativos

---

## 🚀 Próximo Paso

Si todos los tests pasan → **Sprint 2**: Medios de Pago + Cuentas

**Versión:** v0.2.0
