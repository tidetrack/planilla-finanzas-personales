# Guía de Testing - Sprint 0 (v0.1.0)

Instrucciones paso a paso para testear el sistema modular antes de avanzar al Sprint 1.

---

## Pre-requisitos

- Google Sheet creado con hoja llamada **DATA-ENTRY**
- Encabezados en fila 3 de cada tabla (ver DATABASE_SCHEMA.md)
- Apps Script project vinculado al Sheet

---

## Paso 1: Deploy de Código a Apps Script

### 1.1 Abrir Apps Script Editor

1. Abre tu Google Sheet
2. Menú: **Extensions → Apps Script**
3. Verás "Code.gs" por defecto

### 1.2 Copiar Archivos en Orden

**CRÍTICO:** Copiar en orden numérico (las dependencias importan)

#### A) Manifest (appsscript.json)

1. En Apps Script, click en **️ Project Settings** (lado izquierdo)
2. Marca checkbox: **"Show appsscript.json manifest file"**
3. Vuelve a **Editor** (icono < >)
4. Click en `appsscript.json`
5. **Reemplaza** todo el contenido con:
 ```
 Copiar contenido de: src/appsscript.json
 ```

#### B) Archivos de Código (.js)

Para cada archivo, crear nuevo y copiar contenido:

1. **00_Config.js**
 - Click en **+** junto a "Files"
 - Nombre: `00_Config`
 - Copiar contenido de `src/00_Config.js`
 
2. **01_Version.js**
 - Nuevo archivo: `01_Version`
 - Copiar contenido de `src/01_Version.js`
 
3. **02_Utils.js**
 - Nuevo archivo: `02_Utils`
 - Copiar contenido de `src/02_Utils.js`
 
4. **03_SheetManager.js**
 - Nuevo archivo: `03_SheetManager`
 - Copiar contenido de `src/03_SheetManager.js`
 
5. **04_DataValidation.js**
 - Nuevo archivo: `04_DataValidation`
 - Copiar contenido de `src/04_DataValidation.js`
 
6. **05_MonedaService.js**
 - Nuevo archivo: `05_MonedaService`
 - Copiar contenido de `src/05_MonedaService.js`

#### C) Eliminar Code.gs (opcional)

- Puedes eliminar el archivo `Code.gs` si no lo usas
- O dejarlo vacío

### 1.3 Guardar Proyecto

1. Click en ** Save project**
2. Nombre del proyecto: `Tidetrack v0.1.0`

---

## Paso 2: Tests Unitarios

### Test 1: Verificar Versión

**Objetivo:** Confirmar que el sistema cargó correctamente.

**Pasos:**
1. En Apps Script Editor, selecciona función: `logVersionInfo`
2. Click en **️ Run**
3. Autoriza permisos si es la primera vez

**Resultado Esperado:**
```
==================================================
Tidetrack Personal Finance - Apps Script
Versión: 0.1.0
Release: Sprint 0 - Core Setup
Fecha: 2026-01-17
==================================================
```

** Criterio de Éxito:** Se muestra la información de versión sin errores.

---

### Test 2: Acceso a Hoja DATA-ENTRY

**Objetivo:** Verificar que SheetManager puede acceder a la hoja.

**Pasos:**
1. Crea una función temporal en cualquier archivo:
 ```javascript
 function testSheetAccess() {
 const sheet = getSheet();
 Logger.log(`Hoja encontrada: ${sheet.getName()}`);
 Logger.log(`Total filas: ${sheet.getLastRow()}`);
 }
 ```
2. Ejecuta `testSheetAccess`

**Resultado Esperado:**
```
Hoja encontrada: DATA-ENTRY
Total filas: 3 (o más si ya tiene datos)
```

** Criterio de Éxito:** No hay error "Hoja DATA-ENTRY no encontrada".

** Si falla:** Verifica que tu hoja se llama exactamente `DATA-ENTRY` (case-sensitive).

---

### Test 3: Generar ID Único

**Objetivo:** Verificar utilidades de generación de IDs.

**Pasos:**
1. Función temporal:
 ```javascript
 function testGenerateId() {
 const id1 = generateId();
 const id2 = generateId();
 Logger.log(`ID 1: ${id1}`);
 Logger.log(`ID 2: ${id2}`);
 Logger.log(`¿Son diferentes?: ${id1 !== id2}`);
 }
 ```
2. Ejecuta `testGenerateId`

**Resultado Esperado:**
```
ID 1: 20260117230500-1234
ID 2: 20260117230500-5678
¿Son diferentes?: true
```

** Criterio de Éxito:** IDs son únicos y tienen formato correcto.

---

### Test 4: Validación de Enums

**Objetivo:** Verificar que la validación de enums funciona.

**Pasos:**
1. Función temporal:
 ```javascript
 function testEnumValidation() {
 try {
 // Válido
 validateEnum('Ingreso', ENUM_SENTIDO, 'sentido');
 Logger.log(' Ingreso es válido');
 
 // Inválido
 validateEnum('Salida', ENUM_SENTIDO, 'sentido');
 Logger.log(' Salida NO debería ser válido');
 } catch (e) {
 Logger.log(` Error esperado: ${e.message}`);
 }
 }
 ```
2. Ejecuta `testEnumValidation`

**Resultado Esperado:**
```
 Ingreso es válido
 Error esperado: Valor no permitido. Valores válidos: sentido...
```

** Criterio de Éxito:** El valor válido pasa, el inválido lanza error.

---

## Paso 3: Test de Integración - Monedas

### Test 5: Inicializar Monedas Básicas

**Objetivo:** Poblar DB_MONEDAS con ARS, USD, EUR.

**Pre-requisito:** Asegúrate que la tabla DB_MONEDAS esté vacía (filas 4+ en columnas B:D).

**Módulo:** `99_SetupDirect.js`

**Pasos:**
1. Ejecuta función: `setupCompleto()`
2. Espera el toast en tu Sheet: "Sistema inicializado correctamente"

**Resultado Esperado en Sheet:**

| moneda_id (B) | nombre_moneda (C) | simbolo (D) |
|---------------|-------------------|-------------|
| ARS | Peso argentino | $ |
| USD | Dólar estadounidense | US$ |
| EUR | Euro | € |

**Resultado Esperado en Log:**
```
==================================================
Iniciando setup completo del sistema
==================================================
Paso 1/2: Inicializando monedas...
 SUCCESS: Monedas básicas inicializadas: ARS, USD, EUR
Paso 2/2: Inicializando configuración...
 SUCCESS: Config inicializada: base=ARS, fuente=oficial
==================================================
 Setup completo finalizado exitosamente
==================================================
```

** Criterio de Éxito:** 
- Las 3 monedas aparecen en filas 4, 5, 6 (columnas B:D)
- Config aparece en fila 4 (columnas AO:AQ)
- Toast se muestra en Sheet
- No hay errores en log

**️ NOTA:** `setupCompleto()` inicializa TANTO monedas como configuración en un solo paso.

---

### Test 6: Crear Moneda Manual

**Objetivo:** Crear una moneda manualmente (BRL).

**Pasos:**
1. Función temporal:
 ```javascript
 function testCreateMoneda() {
 createMoneda('BRL', 'Real brasileño', 'R$');
 }
 ```
2. Ejecuta `testCreateMoneda`

**Resultado Esperado en Sheet:**

| moneda_id (B) | nombre_moneda (C) | simbolo (D) |
|---------------|-------------------|-------------|
| ARS | Peso argentino | $ |
| USD | Dólar estadounidense | US$ |
| EUR | Euro | € |
| BRL | Real brasileño | R$ |

**Resultado Esperado en Log:**
```
 SUCCESS: Moneda creada: BRL - Real brasileño
```

** Criterio de Éxito:** BRL aparece en fila 7 (después de EUR).

---

### Test 7: Validación de Duplicados

**Objetivo:** Verificar que no se pueden crear IDs duplicados.

**Pasos:**
1. Función temporal:
 ```javascript
 function testDuplicateValidation() {
 try {
 createMoneda('ARS', 'Peso', '$'); // ARS ya existe
 Logger.log(' NO debería permitir duplicado');
 } catch (e) {
 Logger.log(` Error esperado: ${e.message}`);
 }
 }
 ```
2. Ejecuta `testDuplicateValidation`

**Resultado Esperado:**
```
 Error esperado: ID duplicado: moneda_id = "ARS"
```

** Criterio de Éxito:** El sistema rechaza el duplicado con error claro.

---

### Test 8: Obtener Todas las Monedas

**Objetivo:** Leer datos de la tabla.

**Pasos:**
1. Función temporal:
 ```javascript
 function testGetAllMonedas() {
 const monedas = getAllMonedas();
 Logger.log(`Total monedas: ${monedas.length}`);
 monedas.forEach(m => {
 Logger.log(`- ${m.moneda_id}: ${m.nombre_moneda} (${m.simbolo})`);
 });
 }
 ```
2. Ejecuta `testGetAllMonedas`

**Resultado Esperado:**
```
Total monedas: 4
- ARS: Peso argentino ($)
- USD: Dólar estadounidense (US$)
- EUR: Euro (€)
- BRL: Real brasileño (R$)
```

** Criterio de Éxito:** Retorna las 4 monedas con datos correctos.

---

### Test 9: Obtener Moneda por ID

**Objetivo:** Buscar una moneda específica.

**Pasos:**
1. Función temporal:
 ```javascript
 function testGetMonedaById() {
 const usd = getMonedaById('USD');
 Logger.log(`Moneda encontrada: ${JSON.stringify(usd)}`);
 
 const xxx = getMonedaById('XXX');
 Logger.log(`Moneda inexistente: ${xxx}`);
 }
 ```
2. Ejecuta `testGetMonedaById`

**Resultado Esperado:**
```
Moneda encontrada: {"moneda_id":"USD","nombre_moneda":"Dólar estadounidense","simbolo":"US$"}
Moneda inexistente: null
```

** Criterio de Éxito:** 
- USD se encuentra correctamente
- XXX retorna null (no error)

---

### Test 10: Actualizar Moneda

**Objetivo:** Modificar una moneda existente.

**Pasos:**
1. Función temporal:
 ```javascript
 function testUpdateMoneda() {
 updateMoneda('BRL', 'Real de Brasil', 'R$');
 }
 ```
2. Ejecuta `testUpdateMoneda`
3. Verifica en Sheet que BRL cambió de "Real brasileño" a "Real de Brasil"

**Resultado Esperado en Log:**
```
 SUCCESS: Moneda actualizada: BRL
```

** Criterio de Éxito:** El nombre se actualizó en la fila 7, columna C.

---

### Test 11: Eliminar Moneda

**Objetivo:** Borrar una moneda.

**Pasos:**
1. Función temporal:
 ```javascript
 function testDeleteMoneda() {
 deleteMoneda('BRL');
 }
 ```
2. Ejecuta `testDeleteMoneda`
3. Verifica en Sheet que BRL desapareció

**Resultado Esperado en Log:**
```
️ INFO: ADVERTENCIA: Verificar manualmente que BRL no tenga referencias
 SUCCESS: Moneda eliminada: BRL
```

** Criterio de Éxito:** 
- BRL ya no está en la tabla
- Solo quedan ARS, USD, EUR

---

## Paso 4: Verificación Final

### Checklist de Validación

Marca cada item cuando esté confirmado:

- [ ] **Versión:** `getVersion()` retorna "0.1.0"
- [ ] **Acceso a Sheet:** `getSheet()` funciona sin error
- [ ] **IDs únicos:** `generateId()` genera IDs diferentes
- [ ] **Enums:** Validación rechaza valores inválidos
- [ ] **Seed:** `initializeMonedas()` crea ARS, USD, EUR
- [ ] **Create:** `createMoneda()` inserta correctamente
- [ ] **Read:** `getAllMonedas()` lee todas las filas
- [ ] **Update:** `updateMoneda()` modifica datos
- [ ] **Delete:** `deleteMoneda()` borra filas
- [ ] **Validación:** Duplicados son rechazados
- [ ] **UI:** Toasts aparecen en Sheet

---

## Criterios de Aceptación del Sprint 0

Para considerar el Sprint 0 completo y listo para Sprint 1:

### Funcional
- Todas las funciones de MonedaService ejecutan sin errores
- Datos se persisten correctamente en DATA-ENTRY
- Validaciones funcionan (duplicados, enums, campos requeridos)
- Toasts confirman operaciones exitosas

### Técnico
- No hay errores de sintaxis
- No hay warnings en Apps Script Editor
- Logging funciona correctamente
- Arquitectura por capas respetada (Services usan SheetManager, no acceso directo)

---

## Troubleshooting

### Error: "Hoja DATA-ENTRY no encontrada"

**Causa:** La hoja no se llama exactamente "DATA-ENTRY".

**Solución:**
1. Verifica el nombre de tu hoja en Sheet
2. Renombra a `DATA-ENTRY` (case-sensitive)
3. O modifica `SHEET_NAME` en `00_Config.js`

---

### Error: "Exception: Service Spreadsheets failed"

**Causa:** Permisos OAuth no autorizados.

**Solución:**
1. En Apps Script, ejecuta cualquier función
2. Click en "Review Permissions"
3. Selecciona tu cuenta Google
4. Click "Allow"

---

### Error: "ReferenceError: RANGES is not defined"

**Causa:** Los archivos no se cargaron en orden correcto.

**Solución:**
1. Verifica que los archivos se llamen exactamente `00_Config`, `01_Version`, etc.
2. Apps Script carga alfabéticamente, los números garantizan el orden
3. Refresca el editor (Ctrl+R)

---

### Toast no aparece en Sheet

**Causa:** Estás ejecutando desde Apps Script Editor, no desde Sheet.

**Verificación:**
- Los toasts solo aparecen cuando hay un Sheet activo
- Los logs siempre funcionan (View → Logs)

---

## Reporte de Testing

Después de completar los tests, documenta resultados:

**Fecha:** _____________________

**Tester:** _____________________

**Versión Testeada:** v0.1.0

### Resultados

| Test # | Nombre | Status | Notas |
|--------|--------|--------|-------|
| 1 | Verificar Versión | Pass / Fail | |
| 2 | Acceso a Hoja | Pass / Fail | |
| 3 | Generar ID | Pass / Fail | |
| 4 | Validación Enums | Pass / Fail | |
| 5 | Inicializar Monedas | Pass / Fail | |
| 6 | Crear Moneda | Pass / Fail | |
| 7 | Validar Duplicados | Pass / Fail | |
| 8 | Get All Monedas | Pass / Fail | |
| 9 | Get By ID | Pass / Fail | |
| 10 | Update Moneda | Pass / Fail | |
| 11 | Delete Moneda | Pass / Fail | |

**¿Listo para Sprint 1?** SÍ / NO

**Issues Encontrados:**
- _____________________
- _____________________

---

**Próximo Paso:** Si todos los tests pasan → Comenzar Sprint 1 (ExchangeRateService)
