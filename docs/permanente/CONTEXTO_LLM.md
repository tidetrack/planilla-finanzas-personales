# Contexto del Proyecto para LLMs (Tidetrack)

Este documento es la **fuente de la verdad (Source of Truth)** diseñada específicamente para que modelos de lenguaje (LLMs como Gemini, ChatGPT, Claude) entiendan la arquitectura, el modelo de datos y las reglas de negocio del sistema **Tidetrack** (Google Sheets + Google Apps Script).

Si estás leyendo esto como una Inteligencia Artificial, utilizá las siguientes definiciones estrictas para sugerir fórmulas, macros o implementaciones.

## 1. Arquitectura General y Stack

- **Plataforma**: Google Sheets funciona como Frontend (UI) y Base de Datos (Tablas posicionales).
- **Backend**: Google Apps Script (JavaScript V8).
- **Paradigma**: Posicional Estricto. Las tablas no usan A, B, C convencionalmente, sino rangos específicos flotantes (ej: I a T). Los encabezados y datos tienen filas de inicio inmutables.
- **Multimoneda**: El sistema siempre consolida transacciones cruzando su valor contra el USD utilizando un esquema Batch.

---

## 2. Definición de Hojas y Esquemas de Base de Datos

### A. Hoja: `Plan de Cuentas`
Actúa como catálogo de entidades estáticas. 
- **Fila de Encabezados**: 3
- **Fila de Inicio de Datos**: 4
- **Catalogos / Rangos**:
  - `INGRESOS`: Columnas **I:J** (I = Nombre, J = Proyecto)
  - `COSTOS_FIJOS`: Columnas **L:M** (L = Nombre, M = Proyecto)
  - `COSTOS_VARIABLES`: Columnas **O:P** (O = Nombre, P = Proyecto)
  - `MEDIOS_PAGO`: Columnas **R:T** (R = Nombre, S = Moneda, T = Proyecto)
  - `PROYECTOS`: Columnas **V:W** (V = Nombre, W = Tipo)

### B. Hoja: `Cargas`
Interfaz de usuario tabular (Data Entry temporal) para carga diaria por lote (Batch).
- **Zona de Trabajo**: **I5:O19**
- **Columnas**:
  - **I**: Monto *(Numérico)*
  - **J**: Tipo *(Texto manual: "Ingreso" o "Egreso")*
  - **K**: Cuenta *(Dropdown dinámico desde Plan de Cuentas)*
  - **L**: Medio *(Dropdown dinámico desde Plan de Cuentas)*
  - **M**: Moneda *(Auto-completado por macro basado en el Medio)*
  - **N**: Fecha *(Auto-completado por macro al poner Monto. Formato: YYYY-MM-DD)*
  - **O**: Nota *(Texto libre)*
- **Comportamiento**: Un script lee desde `I5:O19`, procesa y mueve a la bd, luego borra esta zona.

### C. Hoja: `Registros`
Data Lake inmutable e histórico con absolutamente todas las transacciones procesadas y enriquecidas con Tipos de Cambio.
- **Fila de Encabezados**: 2
- **Fila de Inicio de Datos**: 3
- **Columnas (Rango I:T - 12 columnas exactas)**:
  - **I**: Monto
  - **J**: Tipo *(Traído de Cargas)*
  - **K**: Cuenta
  - **L**: Tipo de Cuenta *(Deducido en backend: "Ingreso", "Costo Fijo" o "Costo Variable")*
  - **M**: Medio
  - **N**: Moneda
  - **O**: Fecha *(Sirve de pivote para ordenar Z-A dinámicamente)*
  - **P**: Nota
  - **Q**: TC_ARS *(Siempre 1.0)*
  - **R**: TC_USD *(Cotización del dólar en pesos)*
  - **S**: TC_AUD *(Cantidad de pesos equivalentes a 1 AUD)*
  - **T**: TC_EUR *(Cantidad de pesos equivalentes a 1 EUR)*

### D. Hoja: `Tipos de Cambio`
Memoria caché estática de cotizaciones diarias para evitar exceder los límites de la API HTTP.
- **Fila de Encabezados**: 3
- **Fila de Inicio de Datos**: 4
- **Grupos (Fecha | Cotización)**:
  - **TC_ARS**: Columnas **I:J** (siempre 1.0)
  - **TC_USD**: Columnas **L:M**
  - **TC_AUD**: Columnas **O:P**
  - **TC_EUR**: Columnas **R:S**

### E. Hoja: `BD antigua` (Módulo de Migración Legacy)
Herramienta permanente para transicionar usuarios desde versiones 2024.
- **Fila de Encabezados**: 1
- **Fila de Inicio de Datos**: 2
- **Columnas**:
  - **A**: Fecha
  - **B**: Ingreso (Monto)
  - **C**: Egreso (Monto)
  - **D**: Detalle (Equivale a Cuenta)
  - **E**: Medio
  - **G**: Observación (Nota)
  - **H**: Cuentas Faltantes (Columna calculada por el script de análisis)

---

## 3. Lógica Backend (Apps Script) Existente

- **`00_Config.js`**: Único archivo que almacena el diccionario de constantes (`RANGES`, `SHEETS`, `MONEDAS_DISPONIBLES` = ['ARS', 'USD', 'AUD', 'EUR']).
- **`03_SheetManager.js`**: Primitivas CRUD. Funciones expuestas útiles: `getTableData(tableName)`, `appendRow()`.
- **`14_EventHandlers.js`**: Aloja la función `onEdit(e)`. 
  - Reglas actuales: Si la edición ocurre en `Cargas` -> `Monto (Col 9)`, establece la fecha de hoy en `Fecha (Col 14)`. Si ocurre en `Medio (Col 12)`, autocompleta la `Moneda (Col 13)`.
- **`15_ExchangeRateApi.js`**: Expone `fetchArsRate(dateStr)` (API DolarApi/Argentinadatos) y `fetchInternationalRates(dateStr)` (API Frankfurter). También posee `forzarCargaHistorica()` para purgar y llenar masivamente "Tipos de Cambio".
- **`06_RegistrosService.js`**: El corazón analítico.
  - Función `procesarCargas()`: Lee `I5:O19` en "Cargas". Por cada iteración asocia la cotización correspondiente extraida de "Tipos de Cambio" (o hace un API request en vuelo), deduce el `Tipo de Cuenta`, ensambla el vector de 12 elementos y lo anexa a "Registros". Acto seguido sortea a "Registros" descendentemente usando la columna 15 (Fecha) como absolute sort y vacía "Cargas".

## 4. Lineamientos de Colaboración IA
1. Al sugerir fórmulas a nivel celda, respetá estrictamente que los datos inician en las filas correspondientes dictadas arriba, NUNCA asumas que empiezan en A1.
2. Al formular `QUERY`, recordá que se hace sobre notación escalar global (`Registros!I2:T`). Para referenciar a la fecha, usá `Col7` (O relacional a I). Para TC de cada moneda, usá `Col9` a `Col12`. 
3. Toda nueva entidad debe registrarse primero en `00_Config.js` (Objeto `RANGES`).
4. Evitar usar `A:Z` generalizado; Tidetrack ancla todo a constantes de columnas para minimizar la superficie de error y no interferir con paneles UI dibujados en columnas A-H.
