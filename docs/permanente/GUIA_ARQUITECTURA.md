# Guía de Arquitectura - Tidetrack Personal Finance

Arquitectura técnica del sistema de finanzas personales.

---

## 🎯 Decisión de Arquitectura: Google Sheets como Backend

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
| **Google Sheets** | ✅ Cero costo<br>✅ Acceso inmediato<br>✅ Colaboración nativa | ⚠️ Límite ~5M celdas<br>⚠️ Performance en > 10k filas | **Elegida para MVP** |
| **Firebase/Firestore** | ✅ Escalable<br>✅ Real-time | ❌ Costo<br>❌ Complejidad inicial | ❌ Overkill para MVP |
| **PostgreSQL (Supabase)** | ✅ Relacional robusto<br>✅ Queries complejas | ❌ Requiere deploy<br>❌ Overhead operativo | ⏭️ Migración futura |
| **SQLite local** | ✅ Simple<br>✅ Sin servidor | ❌ No colaborativo<br>❌ Difícil multi-dispositivo | ❌ No cumple requisitos |

#### Consecuencias

**Positivas:**
- ✅ Validación rápida del modelo de datos
- ✅ Usuario puede ver/auditar datos directamente
- ✅ Compatible con flujo original (planilla → producto)
- ✅ Migración futura posible (schema ya está normalizado)

**Negativas:**
- ⚠️ Límites de escala (máx ~5,000 transacciones/año realistas)
- ⚠️ Performance degradada en queries complejas
- ⚠️ Requiere scripts para mantener integridad

**Estrategia de Migración:**
- Cuando > 3,000 transacciones o > 50 cotizaciones/día → Migrar a PostgreSQL
- Schema actual es 1:1 transferible a SQL
- Scripts de conversión simples (CSV export → SQL import)

---

## 🏗️ Arquitectura del Sistema

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
│         Usuario (Google Sheets UI)       │
│   (Interfaz temporal durante MVP)       │
└──────────────────┬──────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────┐
│     Google Apps Script (Backend Logic)   │
├─────────────────────────────────────────┤
│ • Validaciones de integridad            │
│ • Cálculo automático de monto_base      │
│ • Fetch de tipos de cambio (API)        │
│ • Triggers y automatizaciones            │
└──────────────────┬──────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────┐
│   DATA-ENTRY (Google Sheets "Database")  │
├─────────────────────────────────────────┤
│ • DB_MONEDAS          (B:D)             │
│ • DB_TIPOS_CAMBIO     (F:Q)             │
│ • DB_MEDIOS_PAGO      (S:W)             │
│ • DB_CUENTAS          (Y:AB)            │
│ • DB_TRANSACCIONES    (AD:AM)           │
│ • DB_CONFIG           (AO:AQ)           │
└──────────────────┬──────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────┐
│      API Externa (Tipos de Cambio)       │
│   (exchangerate-api.com o similar)      │
└─────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos

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

## 📊 Modelo de Datos

Ver [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) para detalles completos.

**Resumen:**
- 6 tablas en hoja DATA-ENTRY
- Modelo "estrella" con `DB_TRANSACCIONES` como centro
- Catálogos: Monedas, Medios, Cuentas
- Operativa: Tipos de Cambio (con auditoría completa)
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

## 🔐 Seguridad y Privacidad

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

## 🧪 Testing

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

## 📈 Estrategia de Escalabilidad

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

## 🔧 Mantenimiento y Operaciones

### Rutinas Diarias (Automatizadas)

- Fetch de tipos de cambio (8 AM)
- Validación de integridad (11 PM)
- Backup de hoja DATA-ENTRY (12 AM)

### Rutinas Manuales (Mensuales)

- Revisión de catálogos (monedas, medios, cuentas)
- Limpieza de tipos de cambio stale
- Audit de transacciones sin clasificar

---

## 🚀 Roadmap Técnico

### Q1 2026 - MVP en Sheets
- [x] Diseño de schema
- [ ] Implementación de tablas
- [ ] Scripts de validación
- [ ] Script de fetch de TC
- [ ] Dashboard básico

### Q2 2026 - App Mobile (React Native)
- [ ] Diseño de UI/UX
- [ ] Implementación de registro ultrarrápido
- [ ] Integración con Sheets (lectura/escritura)
- [ ] Modo offline básico

### Q3 2026 - Migración a DB Real
- [ ] Setup PostgreSQL (Supabase)
- [ ] API REST (Node.js)
- [ ] Migración de datos históricos
- [ ] Actualización de app mobile

### Q4 2026 - Features Avanzadas
- [ ] Gastos compartidos
- [ ] Rachas y hábitos
- [ ] Educación contextual
- [ ] Optimización de performance

---

**Versión de Arquitectura**: 1.0  
**Stack Actual**: Google Sheets + Apps Script  
**Última actualización**: 2026-01-17
