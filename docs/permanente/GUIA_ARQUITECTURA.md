# Guía de Arquitectura - Tidetrack Personal Finance

Arquitectura técnica del sistema de finanzas personales.

---

## Decisión de Arquitectura: Google Sheets como Backend

### ADR-001: Uso de Google Sheets para MVP

**Fecha**: 2026-01-17

#### Contexto

Tidetrack necesita un backend que permita:
- Registro multi-moneda con conversiones auditables
- Soporte para transacciones con "tipo de cambio congelado"
- Facilidad de prototip ado y validación con usuarios
- Costo operativo cero durante validación de producto

#### Decisión

**Usar Google Sheets (hoja DATA-ENTRY) como sistema de base de datos con disciplina relacional.**

Implementación:
- 6 tablas con posiciones fijas de columnas
- Encabezados en fila 3, datos desde fila 4
- Integridad referencial mediante validaciones
- Scripts de automatización para carga de tipos de cambio

#### Alternativas Consideradas

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| **Google Sheets** | Cero costo<br> Acceso inmediato<br> Colaboración nativa | ️ Límite ~5M celdas<br>️ Performance en > 10k filas | **Elegida para MVP** |
| **Firebase/Firestore** | Escalable<br> Real-time | Costo<br> Complejidad inicial | Overkill para MVP |
| **PostgreSQL (Supabase)** | Relacional robusto<br> Queries complejas | Requiere deploy<br> Overhead operativo | ️ Migración futura |
| **SQLite local** | Simple<br> Sin servidor | No colaborativo<br> Difícil multi-dispositivo | No cumple requisitos |

#### Consecuencias

**Positivas:**
- Validación rápida del modelo de datos
- Usuario puede ver/auditar datos directamente
- Compatible con flujo original (planilla → producto)
- Migración futura posible (schema ya está normalizado)

**Negativas:**
- ️ Límites de escala (máx ~5,000 transacciones/año realistas)
- ️ Performance degradada en queries complejas
- ️ Requiere scripts para mantener integridad

**Estrategia de Migración:**
- Cuando > 3,000 transacciones o > 50 cotizaciones/día → Migrar a PostgreSQL
- Schema actual es 1:1 transferible a SQL
- Scripts de conversión simples (CSV export → SQL import)

### ADR-002: Manejo de Cuentas Bi-monetarias (Moneda por Defecto)

**Fecha**: 2026-03-17

#### Contexto
Existen flujos de ingreso o egreso que ocurren intrínsecamente en monedas paralelas o rotativas (ej. un "Sueldo" cobrado 80% en ARS y 20% en USD). Se analizó si la integridad referencial obligaba a duplicar cada cuenta por moneda ("Sueldo ARS", "Sueldo USD").

#### Decisión
**Elegimos utilizar un modelo de "Moneda por Defecto" reactiva (UX Ágil).** 

Implementación:
- En el catálogo **Plan de Cuentas**, se registra un único identificador conceptual (ej. "Sueldo") atado a su moneda de mayor frecuencia estadística (ej. "ARS").
- En el frontend de la **Hoja de Cargas**, seleccionar la cuenta disparará un auto-fill de la moneda para acelerar la carga en el 80% de los casos rutinarios.
- El objeto "Moneda" del formulario siempre estará desbloqueado, permitiendo al usuario mutar la divisa a voluntad y de forma específica para esa única transacción.

#### Consecuencias
**Positivas:**
- Plan de cuentas minimalista, limpio y sin duplicidad conceptual de entidades.
- Ingreso de datos (Data Entry) ultrarrápido garantizado por la predicción UI.
- Flexibilidad funcional para transacciones aisladas o atípicas.

**Negativas:**
- ️ Demanda programar escuchadores de eventos DOM (`onchange`) y lógica reactiva en el formulario HTML futuro de transacciones. 

### ADR-003: Monedas como Constante de Backend (sin tabla en BD)

**Fecha**: 2026-03-17

#### Contexto
Inicialmente se teniía una tabla `MONEDAS` en la hoja de cálculo. Las monedas son un catálogo estable (ARS, USD, EUR, etc.) que rara vez varía, y su mantenimiento en una BD generaba complejidad innecesaria en el UI (un ABM extra, validaciones relacionales, etc.).

#### Decisión
**Eliminar la tabla `MONEDAS` de la hoja de cálculo. Definirlas como constante `MONEDAS_DISPONIBLES` en `00_Config.js`.**

Implementación:
- La constante se gestiona desde el código fuente (Apps Script).
- El select de moneda en el formulario ABM y de cargas se puebla dinámicamente desde el backend.
- Para agregar/quitar una moneda, se edita el array en `00_Config.js`.

#### Consecuencias
**Positivas:**
- Plan de cuentas simplificado: 5 tablas en vez de 6.
- El ABM "Plan de Cuentas" gana foco: sólo gestiona entidades realmente variables (Ingresos, Costos, Medios, Proyectos).
- Elimina una DB table en la hoja, reduciendo superficie de errores.

**Negativas:**
- ️ Agregar una nueva moneda requiere un deploy de código (no apto para usuario final sin acceso al repo).

### ADR-004: Data Lake de Cotizaciones (Carga en Batch)

**Fecha**: 2026-03-20

#### Contexto
Registrar matrices con todas las cotizaciones cruzadas ralentiza la planilla y agota límites de APIs. Consultar en vivo celda por celda es inviable.

#### Decisión
**Implementar un Vector Base respecto al USD y trasladar datos en lote a un Data Lake.**

Implementación:
- El usuario ingresa la data de forma asíncrona en la hoja `Cargas` temporal.
- Mediante un disparador (o Menú), el script `procesarCargas()` (en `06_RegistrosService.js`) evalúa el lote.
- Realiza llamadas a `argentinadatos` (ARS) y `Frankfurter` (AUD/EUR), cacheando los promedios en la hoja `Tipos de cambio`.
- Anexa finalmente los vectores optimizados (monto, tc_ars, tc_usd, tc_eur, tc_aud) al historial maestro de `Registros`.

#### Consecuencias
**Positivas:**
- Rendimiento ultraveloz: mínima carga de red hacia las APIs.
- Escalable a miles de filas sin romper quotas de ejecución de Google.
- Mantiene aislados los Registros definitivos de la interacción diaria.

**Negativas:**
- ️ Impide tener la data "viva" de las tablas convertidas instantes de la carga; requiere apretar "Cargar Lote".

### ADR-005: Estructura de Bloques Analiticos y Margen de UI (Offset)

**Fecha original**: 2026-03-23
**Actualizado**: 2026-06-22 (evolucion parcial del offset)

#### Contexto original
A traves del escrutinio profundo del JSON de arquitectura, se detecto un patron de diseno
universal no documentado previamente: la convivencia entre "Frontends" y "Backends" en
Google Sheets requiere manipulacion visual del DOM de la grilla.

#### Decision original (2026-03-23)
Implementar un "Offset" estructural en las Bases de Datos y "Frozen Columns" en los Tableros.

Implementacion:
- **Tableros / UI**: hojas como `Inicio`, `Tablero` y `Cargas` tienen congeladas exactamente
  6 columnas a la izquierda. Genera un "Sidebar" permanente mientras el escrutinio horizontal
  fluye a la derecha.
- **Bases de Datos (Data Lakes)**: hojas como `Registros` y `Plan de Cuentas` comenzaban su
  header en la columna H o I. Las primeras 7 columnas quedaban vacias para reservar espacio
  de margen UI.

#### Evolucion (2026-06-22): eliminacion del offset en Registros y Tipos de cambio

Durante la migracion a layout de produccion nuevo (hojas ex-"Copia de..."), se elimino el
offset en las hojas de datos transaccionales:

- **"Registros" (produccion)**: datos ahora en B:M. Header en fila 5, datos desde fila 6.
  Sin columnas vacias de margen a la izquierda.
- **"Tipos de cambio" (produccion)**: bloques de TC ahora en B:C / E:F / H:I / K:L.
  Titulos fila 5, sub-headers fila 6, datos desde fila 7. Sin margen.

**El offset PERSISTE en**:
- `Plan de Cuentas`: columnas I+ (header fila 3, datos fila 4). Sin cambios.
- `Cargas`: columnas I+ (header fila 4, datos fila 5). Sin cambios.
- Hojas legacy ocultas (`Registros_legacy`, `Tipos de cambio_legacy`): conservan el
  layout original con offset como backup de solo lectura.

#### Racional de la evolucion
Las hojas de produccion nueva son hojas frescas ("Copia de...") sin el margen UI
heredado. Se decidio no replicar el offset en las copias para simplificar las
referencias de RANGES en 00_Config.js y alinearse con un modelo mas cercano al
schema objetivo (PostgreSQL), donde las columnas arrancan en posicion 1.

#### Estado
Vigente con alcance reducido: aplica a Plan de Cuentas, Cargas y hojas legacy.
No aplica a Registros ni Tipos de cambio de produccion.

### ADR-006: Motores Singulares de Cálculo (Hidden Engines)

**Fecha**: 2026-03-23

#### Contexto
Procesar métricas matriciales directamente en la hoja `Tablero` provocaba anidamientos absurdos de `SUMIFS` e interfaces frágiles frente a manipulaciones del usuario.

#### Decisión
**Segregar el procesamiento matricial en Hojas Ocultas que actúan como Motores de Cálculo.**

Implementación:
- La hoja oculta `CALCU` absorbe el cruce multidimensional (Mes vs Rubro) resolviendo `SUMIFS` a lo largo de 30 columnas y 30 filas.
- La hoja oculta `ANUAL` consolida la data empaquetada.
- Las vistas públicas (el Frontend) solo consumen estos resultados, logrando una estricta Separación de Concerns.

---

### ADR-007: Tarjeta de Credito como Medio de Pago tipo Financiacion (Partida Doble)

**Fecha**: 2026-08-30

#### Contexto
El producto no tenia un modelo declarado para tarjetas de credito. El catalogo Plan de
Cuentas ya distingue `TIPOS_MEDIO` (donde esta la plata: Hogar, Ahorros, Inversiones,
Financiacion) de `TIPOS_RIQUEZA` (que compone patrimonio: solo Ahorros e Inversiones,
decision Franco 2026-08-19 por lista blanca), y esa lista blanca ya excluye Financiacion a
proposito -- pero la funcionalidad de dar de alta una tarjeta como medio nunca se ejercito.
`FUNCIONALIDADES.md` (seccion "Pendientes del formulerio", item 1) dejo constancia de que las
formulas LEGACY de Inicio/Tablero siguen sin aplicar esa lista blanca: un frente de arreglo
tecnico distinto y anterior a esta decision, que esta no resuelve.

Franco necesitaba una forma de registrar consumos y pagos de tarjeta sin duplicar el gasto
(contarlo al consumir Y de nuevo al pagar el resumen) y sin que la deuda de la tarjeta
contaminara el calculo de patrimonio.

#### Decisión
**Una tarjeta de credito se modela como un MEDIO DE PAGO de tipo `Financiacion`, con saldo
negativo (deuda), resuelta con la misma partida doble que ya usan los traspasos.**

Implementacion (ninguna pieza es codigo nuevo; el sistema ya la soportaba):
- **Consumo con tarjeta**: una fila Egreso en Registros, Cuenta = el gasto real, Medio = la
  tarjeta. Debe: el gasto. Haber: la tarjeta (la deuda sube).
- **Pago del resumen**: un Traspaso (dos filas, la que sale y la que entra). Debe: la tarjeta
  (la deuda baja). Haber: la caja real. Consumo y pago quedan en LADOS DISTINTOS del libro --
  por eso no hay doble conteo: el gasto se cuenta cuando se consume, no cuando se paga.
- **Diferencia de cambio del pago** (impuesto PAIS, percepciones, IVA, IIBB): NO es parte del
  traspaso. El traspaso mueve la plata al tipo de cambio del dia; el sobrecosto que cobra el
  banco es un GASTO propio y se carga aparte, como Egreso a una cuenta `GastosBancarios`
  (Gastos Variables, porque el monto escala con el consumo en dolares del mes, no es un
  compromiso fijo conocido de antemano).
- **Multimoneda**: una tarjeta con saldo en ARS y en USD se da de alta como DOS medios
  ("Tarjeta X ARS" / "Tarjeta X USD"), uno por moneda -- `RANGES.MEDIOS_PAGO` asume un medio
  = una moneda (ADR-002), y el emisor entrega dos saldos separados de por si. El traspaso ya
  sabe cruzar monedas: `_prepararTraspaso` (`16_ShellService.js`, ~linea 727) pide el monto de
  ambos lados cuando las monedas difieren y congela las cuatro cotizaciones del dia.
- **Recurrentes en tarjeta**: se declaran una vez en la hoja Recurrentes con `medio` = la
  tarjeta (`RANGES.RECURRENTES` ya tiene ese campo, columna F); no se marca nada cada mes, y
  el pago del resumen sigue siendo un traspaso aparte, sin duplicar el gasto.
- **Alta de catalogo**: a mano, en el Plan de Cuentas (no hay ABM que la automatice todavia)
  -- los medios "Tarjeta \<nombre\> ARS/USD" tipo Financiacion y la cuenta "GastosBancarios".
- **Sin migracion**: el historico de "Pago tarjeta" queda como esta; reescribirlo
  descuadraria conciliaciones ya verificadas al centavo. El modelo aplica hacia adelante.

#### Alternativas descartadas
- **La tarjeta como CUENTA de gasto fijo** (en vez de medio). Se descarto porque rompe el
  saldo de las cajas reales: cada consumo llevaria como Medio la caja que en teoria paga
  (efectivo, banco), descontando esa caja en el momento del consumo en vez de en el pago del
  resumen. Confunde "cuando se gasta" con "cuando se paga", que es exactamente lo que la
  partida doble esta para separar.
- **Un medio multimoneda unico** (una sola "Tarjeta X" con saldo en dos monedas a la vez). Se
  descarto porque exige cambiar el modelo entero de medios (`RANGES.MEDIOS_PAGO` asume un
  medio = una moneda, ADR-002) y rompería el motor de conciliacion ya validado al centavo
  contra el ledger real.

#### Consecuencias
**Positivas:**
- Cero codigo nuevo: el modelo se apoya en `TIPOS_MEDIO`/`TIPOS_RIQUEZA` (`00_Config.js`), la
  partida doble de traspasos (`16_ShellService.js`) y el campo `medio` de Recurrentes -- todo
  ya construido y probado para otro caso de uso.
- La deuda de tarjeta nunca cuenta como patrimonio (`TIPOS_RIQUEZA` la excluye por lista
  blanca).
- El gasto se cuenta una sola vez, en el momento del consumo, sin importar cuando se paga el
  resumen.

**Negativas:**
- Requiere disciplina manual: Franco da de alta los medios y la cuenta GastosBancarios a
  mano, sin validacion de que efectivamente sean tipo Financiacion.
- Una tarjeta multimoneda ocupa dos filas de medio en el Plan de Cuentas en vez de una; quien
  lea el catalogo sin este ADR puede no entender por que existen "Tarjeta X ARS" y
  "Tarjeta X USD" por separado.
- El historico de "Pago tarjeta" queda inconsistente con el modelo nuevo (sin migracion): un
  analisis que mezcle ambos periodos sin saberlo puede sacar conclusiones erroneas sobre el
  comportamiento de gasto con tarjeta.

---

## ️ Arquitectura del Sistema

### Stack Tecnológico

| Componente | Tecnología | Razón |
|------------|------------|-------|
| **Backend/DB** | Google Sheets | MVP rápido, costo cero |
| **Automatización** | Google Apps Script (JavaScript) | Integración nativa con Sheets |
| **Frontend (futuro)** | React Native / Flutter | Mobile-first |
| **API Tipos de Cambio** | ExchangeRate-API o similar | Cotizaciones actualizadas |
| **Autenticación** | Google OAuth | Nativa con ecosistema Google |

### Diagrama de Componentes

```
┌─────────────────────────────────────────┐
│ Usuario (Google Sheets UI) │
│ (Interfaz temporal durante MVP) │
└──────────────────┬──────────────────────┘
 │
 ↓
┌─────────────────────────────────────────┐
│ Google Apps Script (Backend Logic) │
├─────────────────────────────────────────┤
│ • Validaciones e integridad (ABM) │
│ • Navegación entre hojas │
│ • Catálogos fijos: MONEDAS_DISPONIBLES │ ← ADR-003
└──────────────────┬──────────────────────┘
 │
 ↓
┌─────────────────────────────────────────┐
│ Plan de Cuentas (Google Sheet) │
├─────────────────────────────────────────┤
│ • INGRESOS (I:K) │
│ • COSTOS_FIJOS (M:O) │
│ • COSTOS_VARIABLES (Q:S) │
│ • MEDIOS_PAGO (U:W) │
│ • PROYECTOS (Y:Z) │
└─────────────────────────────────────────┘
```

---

## Flujo de Datos

### 1. Registro de Transacción

```
Usuario carga transacción
 ↓
Apps Script valida:
 - cuenta_id existe?
 - medio_id existe?
 - moneda_id existe?
 ↓
SI moneda ≠ base:
 - Buscar fx_id aplicable
 - Calcular monto_base
 ↓
Guardar en DB_TRANSACCIONES
```

### 2. Actualización de Tipos de Cambio

```
Trigger diario (o manual)
 ↓
Apps Script llama API
 ↓
Recibe JSON con cotizaciones
 ↓
Para cada par de monedas:
 - Crear nuevo fx_id
 - Guardar tc, fuente, provider
 - Guardar timestamp y raw_payload
 ↓
Registrar en DB_TIPOS_CAMBIO
```

### 3. Generación de Dashboard

```
Usuario pide reporte mensual
 ↓
Apps Script query:
 - Filtrar DB_TRANSACCIONES por fecha
 - Agrupar por cuenta_id
 - Sumar monto_base (todo en moneda base)
 ↓
Generar tabla resumen
```

---

## Modelo de Datos

Ver [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) para detalles completos.

**Resumen:**
- 5 tablas en hoja Plan de Cuentas (Ingresos, Gastos Fijos, Gastos Variables, Medios de Pago, Proyectos)
- Monedas: constante `MONEDAS_DISPONIBLES` en `00_Config.js` (ADR-003)
- Catálogos: Medios, Cuentas, Proyectos
- Operativa: Tipos de Cambio (con auditoría completa, a implementar)
- Config: Parámetros globales (moneda base, fuente preferida)

**Innovación clave:**
```sql
-- Cada transacción "congela" su tipo de cambio
SELECT trx_id, monto, fx_id, monto_base
FROM DB_TRANSACCIONES
WHERE fecha = '2026-01-17'

-- El histórico NO cambia aunque actualices cotizaciones
```

---

## Seguridad y Privacidad

### Acceso a Datos

**MVP (Google Sheets):**
- Archivo privado del usuario en su Google Drive
- Compartir solo con colaboradores autorizados
- OAuth nativo de Google

**Futuro (API + DB):**
- Autenticación OAuth 2.0
- Encriptación en tránsito (HTTPS)
- Encriptación en reposo (DB encrypted)
- No se comparten datos con terceros (excepto API de TC)

### Datos Sensibles

**Qué se guarda:**
- Transacciones financieras personales
- Medios de pago (nombres, no números de tarjeta)
- Notas de contexto

**Qué NO se guarda:**
- Números de tarjeta completos
- Contraseñas bancarias
- Datos de cuentas reales

---

## Testing

### Fase MVP (Google Sheets)

**Manual Testing:**
- Validar carga de transacciones
- Verificar cálculo de `monto_base`
- Auditar integridad referencial

**Scripts de Validación:**
```javascript
function validateIntegrity() {
 // Verificar que todas las FK existen
 // Verificar que tc > 0
 // Verificar que monto > 0
 // Generar reporte de inconsistencias
}
```

### Fase Futura (App)

- Unit tests: Lógica de conversión multi-moneda
- Integration tests: API de tipos de cambio
- E2E tests: Flujo completo de registro con Playwright

---

## Estrategia de Escalabilidad

### Límites de Google Sheets

| Métrica | Límite Sheets | Umbral de Alerta |
|---------|---------------|------------------|
| Celdas totales | ~5,000,000 | 3,000,000 (60%) |
| Transacciones/año | ~5,000 | 3,000 |
| Tipos de cambio/día | ~100 | 50 |
| Usuarios concurrentes | ~100 | 50 |

### Plan de Migración a PostgreSQL

**Trigger de migración:** Alcanzar 60% de capacidad

**Pasos:**
1. Exportar cada tabla a CSV
2. Crear schema SQL equivalente (ya está normalizado)
3. Importar CSVs con `COPY FROM`
4. Validar integridad con scripts
5. Migrar Apps Script a API REST (Node.js/FastAPI)
6. Actualizar frontend para consumir API

**Tiempo estimado:** 2-3 semanas

---

## Mantenimiento y Operaciones

### Rutinas Diarias (Automatizadas)

- Fetch de tipos de cambio (8 AM)
- Validación de integridad (11 PM)
- Backup de hoja DATA-ENTRY (12 AM)

### Rutinas Manuales (Mensuales)

- Revisión de catálogos (monedas, medios, cuentas)
- Limpieza de tipos de cambio stale
- Audit de transacciones sin clasificar

---

## Roadmap Técnico

### Etapa 1: MVP Vivo (Core)
- [x] Arquitectura de Hojas Modulares y catálogos
- [x] Validaciones de backend y endpoints
- [x] Componentes de UI y ABM Plan Cuentas
- [ ] Hoja de Cargas (Data Entry rápido)

### Etapa 2: Análisis y Hábito
- [ ] Módulo Tablero General (vía QUERY)
- [ ] Módulo Presupuestación Mensual
- [ ] Módulo Resumen Anual
- [ ] Sistema de rachas de registro

### Etapa 3: Plataforma (Futuro)
- [ ] Gastos compartidos entre usuarios
- [ ] Evaluación de migración a DB externa (si excede límites)
- [ ] Educación financiera contextual

---

**Versión de Arquitectura**: 1.2 
**Stack Actual**: Google Sheets + Apps Script 
**Última actualización**: 2026-03-20
