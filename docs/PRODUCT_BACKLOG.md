# Product Backlog - Tidetrack Personal Finance

Gestión de features, mejoras y roadmap del proyecto.

---

## Sprints Completados (v0.1.0 - v0.4.0)

### Sprint 0: Core Setup (v0.1.0) - COMPLETADO
- [x] Crear estructura de carpetas
- [x] Implementar arquitectura agéntica
- [x] Configurar reglas de estructura
- [x] Documentar contexto de negocio
- [x] Diseñar esquema de base de datos (6 tablas)
- [x] Implementar módulos core (Config, Utils, SheetManager, DataValidation, MonedaService)

### Sprint 1: Exchange Rates & Config (v0.2.0) - COMPLETADO
- [x] ExchangeRateService (CRUD + API integration)
- [x] ConfigService (gestión de configuración global)
- [x] Integración con ExchangeRate-API
- [x] Cálculo automático de monto_base

### Sprint 2: Catálogos & Data Seeding (v0.3.0) - COMPLETADO
- [x] Sistema de auto-IDs (SKU) para todas las tablas
- [x] MedioPagoService (CRUD + 5 medios predefinidos)
- [x] CuentaService (CRUD + 11 cuentas predefinidas)
- [x] TransactionService (CRUD + validación fx_id)
- [x] DataSeeder (generación de datos de prueba)
- [x] Suite de testing integral (41/41 tests pasados)

### Sprint 3: UI Development (v0.4.0) - COMPLETADO
- [x] Design System neumórfico completo
- [x] Formulario de transacciones (CREATE)
- [x] Menús personalizados de Google Sheets
- [x] Dashboard principal con métricas del mes
- [x] Lista de transacciones con filtros
- [x] Validación dual (cliente + servidor)
- [x] Responsive design mobile-first

---

### Sprint 4: ABM Catálogos (v0.5.0) - COMPLETADO

**Epic:** Gestión completa de Cuentas y Medios de Pago 
**Objetivo:** Permitir a los usuarios crear, editar y eliminar sus propias categorías y medios de pago desde la interfaz gráfica.

**Features Implementadas:**
- [x] **UI_CuentasManager.html** - Popup 700x650 con CRUD completo de cuentas
- [x] **UI_MediosManager.html** - Popup 700x650 con CRUD completo de medios de pago
- [x] **Validación FK en backend** - Prevención de eliminación con transacciones asociadas
- [x] **Integración con Dashboard** - Botones "Gestionar Cuentas" y "Gestionar Medios"
- [x] **API Wrappers en UIService** - 8 funciones wrapper para operaciones CRUD
- [x] **UX Mejorado** - Search, confirmación, post-action modal, form reset automático
- [x] **Toggle "Es recurrente"** - Diseño liquid glass en CuentasManager
- [x] **Fix crítico** - Race condition en confirmAction() corregida
- [x] **Fix z-index** - Modal overlay visible correctamente (z-index: 20000)

**Fecha de cierre:** 2026-01-23 
**Código nuevo:** ~2,400 líneas | **Archivos creados:** 2 | **Testing:** Completo

---

## Sprint 5: CRUD Transacciones (v0.6.0) - PENDIENTE

### Epic: Completar CRUD de Transacciones
**Objetivo:** Permitir edición y eliminación de transacciones existentes para completar la gestión básica del sistema.

**Features a Implementar:**
- [ ] **Vista detalle de transacción** - Modal/página con información completa de una transacción
- [ ] **Formulario de edición** - Reutilizar UI_TransactionForm en modo edición
- [ ] **Función UPDATE** - updateTransaccion() en TransactionService (ya existe backend)
- [ ] **Función DELETE con confirmación** - Diálogo de confirmación antes de eliminar
- [ ] **Modo edición vs creación** - Toggle en el formulario según contexto
- [ ] **Navegación desde lista** - Botones "Editar" y "Eliminar" en cada fila de transacciones
- [ ] **Validación de integridad** - Evitar edición/eliminación que rompa datos relacionados
- [ ] **Feedback visual** - Toasts y modales de confirmación

**Estimación:** 5 días (Days 0-4) 
**Prioridad:** ALTA - Completa funcionalidad CRUD básica del sistema

**Dependencias:** 
- TransactionService con UPDATE/DELETE implementados (Sprint 2)
- UI_TransactionForm base (Sprint 3)
- UI_MainDashboard con lista (Sprint 3)

---

## Etapa 1: MVP Vivo (3-6 meses)

### Alta Prioridad - Core del Producto

#### Epic: Registro Ultrarrápido
**User Story:** Como usuario, quiero registrar una transacción en < 3 segundos para no perder el hábito

**Features:**
- Captura de transacción con defaults inteligentes (fecha hoy)
- Selección rápida de cuenta/categoría
- Selección de medio de pago
- Nota opcional (no obligatoria)

**RICE Score:** (Pendiente calcular cuando tengamos usuarios)

#### Epic: Presupuesto Basado en Histórico
**User Story:** Como usuario, quiero que el sistema me sugiera un presupuesto realista basado en mis datos pasados

**Features:**
- Cálculo automático de promedio por categoría
- Propuesta de división proporcional (ingresos, gastos fijos, variables, ahorro)
- Edición manual del presupuesto propuesto

#### Epic: Tablero Esencial
**User Story:** Como usuario, quiero ver mi situación financiera del mes en un vistazo

**Features:**
- Vista de disponibilidad (presupuesto vs. real)
- Números grandes y jerárquicos
- Resumen por macro-categorías
- Sin ruido visual

#### Epic: Multi-Moneda Básico
**User Story:** Como viajero, quiero registrar gastos en moneda local sin tener que convertir manualmente

**Features:**
- Registro en moneda de origen
- Conversión automática a moneda base
- Almacenamiento de tipo de cambio (fx_id) con timestamp
- Fuente de cotización definida (ej. ExchangeRate-API)

---

## Etapa 2: Hábito y Retención (6-12 meses)

### Media Prioridad

#### Epic: Rachas de Registro
**User Story:** Como usuario, quiero ver mi racha de días consecutivos para motivarme a seguir registrando

**Features:**
- Contador de días consecutivos
- Celebraciones sobrias (no infantiles)
- Vista de progreso semanal/mensual

#### Epic: Cierres Automáticos
**User Story:** Como usuario, quiero recibir un resumen claro al final de la semana/mes

**Features:**
- Cierre de semana con patrones rápidos
- Cierre de mes comparando presupuesto vs. real
- Formato simple y accionable

#### Epic: Glosario de KPIs en Lenguaje Humano
**User Story:** Como usuario no experto, quiero entender qué significa cada indicador sin buscar en Google

**Features:**
- Micro-explicaciones contextuales (< 100 palabras)
- Aparecen cuando el usuario las necesita
- Tono humano, no académico

---

## Etapa 3: Social y Viral (12+ meses)

### Media-Baja Prioridad

#### Epic: Gastos Compartidos
**User Story:** Como grupo de amigos en un viaje, queremos dividir gastos sin discusiones

**Features:**
- Asociación de transacciones a eventos
- División transparente por participantes
- Cálculo de quién debe a quién
- Recordatorios de pago

#### Epic: Referral Program
**User Story:** Como usuario satisfecho, quiero invitar a mis amigos fácilmente

**Features:**
- Invitación desde evento compartido
- Link de referido con beneficios
- Tracking de invitaciones

---

## Backlog Técnico

### Infraestructura
- [ ] Definir stack tecnológico (mobile-first)
- [ ] Diseñar esquema de base de datos
- [ ] Arquitectura de API (REST/GraphQL)
- [ ] Sistema de autenticación (OAuth 2.0)
- [ ] Integración con API de tipos de cambio

### Calidad
- [ ] Tests E2E con Playwright
- [ ] Tests unitarios de lógica de negocio
- [ ] Auditoría de seguridad OWASP

---

## Bugs Conocidos

(Ninguno - el proyecto aún no está implementado)

---

## Ideas / Icebox

- Integración con WhatsApp para notificaciones
- Exportación a Excel/PDF de reportes
- Modo oscuro
- Widget para pantalla de inicio (mobile)
- Integración con Google Calendar para viajes
- Reconocimiento de tickets por foto (OCR)

---

**El @product-manager debe mantener este documento actualizado.**

**Última actualización**: 2026-01-23 
**Estado:** v0.5.0 (Sprint 4 completo) → Sprint 5 pendiente
