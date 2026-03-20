# Reglas del Agente - Tidetrack Personal Finance

Reglas específicas de desarrollo para este proyecto.

---

## Principios de Desarrollo

### 1. Fricción Mínima es la Regla #1

**Toda decisión de diseño debe responder:**
> "¿Esto reduce o aumenta la fricción del registro?"

- Si aumenta fricción en registro → Rechazar
- Si reduce fricción → Priorizar

### 2. Lenguaje Humano, no Jerga Contable

**Reglas:**
- Variables en español
- Comentarios solo cuando código no es auto-explicativo
- Mensajes al usuario en tono cálido pero no infantil

### 3. Auditoría de Tipo de Cambio

**Regla crítica para multi-moneda:**
- El `fx_id` (tipo de cambio) se almacena con timestamp
- Una vez asociado a transacción, NO cambia
- El histórico no se "mueve" con cotizaciones futuras

---

## Estructura de Archivos

**REGLA CRÍTICA:** Ver `.agent/rules/estructura-obligatoria.md`

- Código fuente SIEMPRE en `/src/`
- Documentación SIEMPRE en `/docs/`
- Archivos legacy en `/_backup/`
- NUNCA crear carpetas temporales en la raíz

---

## Convenciones de Naming

### Backend (Base de Datos y API)

```sql
-- Tablas en plural, snake_case
CREATE TABLE transactions (...);
CREATE TABLE exchange_rates (...);

-- Columnas en singular, snake_case
amount_base DECIMAL(15, 2)
currency_code VARCHAR(3)
```

### Frontend (JavaScript/TypeScript)

```javascript
// Camel case para variables y funciones
const montoDisponible = calculateAvailability();
function registrarTransaccion(data) { }

// Pascal case para componentes/clases
class TransactionManager { }
const RegisterScreen = () => { };

// UPPER_CASE para constantes
const MAX_TRANSACTION_NOTE_LENGTH = 500;
const DEFAULT_CURRENCY = 'ARS';
```

---

## ️ Reglas de Base de Datos

### 1. Registro en Moneda de Origen

```sql
-- Cada transacción almacena:
amount_origin DECIMAL(15, 2) -- Monto en moneda original
currency_origin VARCHAR(3) -- Moneda en que se pagó
amount_base DECIMAL(15, 2) -- Monto convertido a moneda base
currency_base VARCHAR(3) -- Moneda de referencia del usuario
fx_id INT -- ID del tipo de cambio usado
```

### 2. Auditabilidad de Conversiones

```sql
-- Tabla de tipos de cambio con timestamp
CREATE TABLE exchange_rates (
 id SERIAL PRIMARY KEY,
 from_currency VARCHAR(3),
 to_currency VARCHAR(3),
 rate DECIMAL(10, 6),
 source VARCHAR(50), -- Ej: 'exchangerate-api'
 fetched_at TIMESTAMP
);
```

### 3. Normalización vs. Performance

- **Default:** 3NF (tercera forma normal)
- **Excepción:** Desnormalizar solo con justificación documentada

---

## Testing

### Prioridades de Testing

1. **Lógica de conversión multi-moneda:** Tests unitarios exhaustivos
2. **Cálculo de disponibilidad:** Tests con múltiples escenarios
3. **Division de gastos compartidos:** Tests de edge cases
4. **Flujo de registro:** Tests E2E con Playwright

### Formato de Tests

```javascript
describe('Multi-Currency Conversion', () => {
 it('should freeze exchange rate with transaction', () => {
 // Test que fx_id no cambia en histórico
 });
 
 it('should convert to base currency correctly', () => {
 // Test de conversión USD -> ARS
 });
});
```

---

## Documentación

### Cuándo Documentar

| Evento | Acción |
|--------|--------|
| Feature compleja nueva | Actualizar `GUIA_ARQUITECTURA.md` |
| Cambio en esquema de BD | Actualizar `DATABASE_SCHEMA.md` |
| Decisión técnica importante | Crear ADR en `/docs/permanente/adr/` |
| Release de versión | Actualizar `CHANGELOG.md` |

### ADR (Architecture Decision Records)

**Formato:**
```markdown
# ADR-001: Uso de fx_id para Congelar Tipo de Cambio

## Contexto
Los tipos de cambio varían constantemente...

## Decisión
Almacenar fx_id con cada transacción...

## Consecuencias
+ Histórico estable y auditable
- Mayor complejidad en queries
```

---

## Prohibiciones

- NO hardcodear credenciales (usar variables de entorno)
- NO modificar archivos en `/_backup/`
- NO hacer cambios sin actualizar documentación
- NO agregar features que aumenten fricción de registro
- NO moralizar sobre gastos del usuario
- NO infantilizar con gamificación excesiva

---

## ️ Stack Tecnológico (Pendiente Definir)

### Preferencias Iniciales

**Frontend:**
- React Native o Flutter (mobile-first)
- TypeScript para type safety

**Backend:**
- Node.js con Express o FastAPI (Python)
- PostgreSQL para base de datos

**Infraestructura:**
- Docker para containerización
- OAuth 2.0 para autenticación

---

## ️ Reglas Específicas del Schema (Google Sheets)

### Reglas de Integridad Críticas

#### 1. Regla del fx_id (Congelamiento de Tipo de Cambio)

**Contexto:** Multi-moneda requiere histórico estable.

**Regla:**
```
SI DB_TRANSACCIONES.moneda_id = DB_CONFIG.base_moneda_id:
 → fx_id puede ser nulo
 → monto_base = monto

SI DB_TRANSACCIONES.moneda_id ≠ DB_CONFIG.base_moneda_id:
 → fx_id es OBLIGATORIO
 → fx_id debe existir en DB_TIPOS_CAMBIO
 → monto_base = monto × tc (del registro fx_id)
```

**Implementación en Scripts:**
```javascript
function validateTransaction(trx) {
 const baseMoneda = getConfig().base_moneda_id;
 
 if (trx.moneda_id !== baseMoneda && !trx.fx_id) {
 throw new Error("fx_id obligatorio para moneda extranjera");
 }
 
 if (trx.fx_id) {
 const fx = getExchangeRate(trx.fx_id);
 if (!fx || fx.status !== 'ok') {
 throw new Error("fx_id inválido o con status≠ok");
 }
 }
}
```

#### 2. Regla de Positividad de Montos

**Regla:** `monto` siempre > 0, `sentido` define la dirección.

**Rationale:** Evita ambigüedades (¿-500 es egreso o error de carga?).

**Validación:**
```javascript
if (trx.monto <= 0) {
 throw new Error("monto debe ser > 0");
}
if (!['Ingreso', 'Egreso'].includes(trx.sentido)) {
 throw new Error("sentido debe ser 'Ingreso' o 'Egreso'");
}
```

#### 3. Regla de Tipo de Cambio Válido

**Para `DB_TIPOS_CAMBIO`:**
```javascript
// tc debe ser > 0
if (fx.tc <= 0) {
 throw new Error("tc debe ser > 0");
}

// base ≠ quote
if (fx.base_moneda_id === fx.quote_moneda_id) {
 throw new Error("base_moneda_id no puede ser igual a quote_moneda_id");
}

// Ambas monedas deben existir
if (!monedaExists(fx.base_moneda_id) || !monedaExists(fx.quote_moneda_id)) {
 throw new Error("base o quote no existen en DB_MONEDAS");
}
```

### Reglas de Enums (Valores Cerrados)

**CRÍTICO:** Estos campos solo admiten valores de conjuntos cerrados.

| Campo | Valores Permitidos |
|-------|-------------------|
| `sentido` | "Ingreso", "Egreso" |
| `macro_tipo` | "Ingreso", "Gasto fijo", "Gasto variable", "Ahorro", "Dólares" |
| `tipo` (medios) | "efectivo", "débito", "crédito", "billetera", "banco" |
| `uso_principal` | "gasto", "ahorro", "inversión", "mixto" |
| `fuente` | "oficial", "MEP", "tarjeta", "blue", "manual" |
| `status` | "ok", "error", "stale" |

**Implementación:** Data Validation en Google Sheets con dropdown lists.

### Reglas de Ubicación Física (Google Sheets)

**CRÍTICO:** Las tablas tienen rangos fijos. NO insertar columnas.

| Tabla | Rango | Protección |
|-------|-------|------------|
| DB_MONEDAS | B:D | Bloquear inserción de columnas |
| DB_TIPOS_CAMBIO | F:Q | Bloquear inserción de columnas |
| DB_MEDIOS_PAGO | S:W | Bloquear inserción de columnas |
| DB_CUENTAS | Y:AB | Bloquear inserción de columnas |
| DB_TRANSACCIONES | AD:AM | Bloquear inserción de columnas |
| DB_CONFIG | AO:AQ | Bloquear inserción de columnas |

**Si necesitás agregar campos:**
1. Actualizar `DATABASE_SCHEMA.md` PRIMERO
2. Consultar con equipo
3. Crear nueva columna al final del rango
4. Actualizar scripts

---

**Estas reglas deben ser seguidas por TODOS los agentes.**

**Última actualización**: 2026-01-17
