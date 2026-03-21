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
