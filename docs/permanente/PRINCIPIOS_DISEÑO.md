# Principios de Diseño - Tidetrack Personal Finance

Reglas de diseño de producto, UX y hábitos que definen la experiencia.

---

## Principios de UX y Diseño de Interacción

### 1. La Estética es un Mecanismo de Reducción de Fricción

> Si hablar de números se siente frío o intimidante, se pospone. 
> Si se siente claro y agradable, se visit a más.

**Objetivo:** Una experiencia limpia, transparente y fácil de entender, con colores y resúmenes claves.

### 2. Separar Captura de Análisis

**En el momento de registrar:** El usuario está en contexto de vida (pagando, caminando, viajando). No quiere elegir entre 40 categorías ni escribir novelas.

**Estrategia:** Registro mínimo ahora + Momentos de revisión después

| Actividad | Tiempo Objetivo |
|-----------|----------------|
| Registro | < 3 segundos |
| Análisis | Minutos |
| Decisión | Segundos |

### 3. Evitar Moralizar

**Regla de oro:** El dato es espejo, no martillo.

- Celebrar constancia y logros
- Castigar gastos

**Foco:** Empoderar, no juzgar.

### 4. Consistencia de Criterios

En un sistema multi-moneda, multi-medio y multi-evento, el usuario se pierde si cada pantalla usa reglas distintas.

**Convenciones a Fijar:**
- Qué es ingreso, gasto, transferencia
- Cómo se convierte moneda
- Qué fuente de tipo de cambio se usa
- Cómo se redondea
- Cómo se define "disponibilidad"

---

## Hábito como Tecnología

### El Problema Central

El problema de finanzas personales **no es la falta de información**, sino **la falta de constancia** en registrar y revisar.

### Diseño de Hábito

**Secuencia repetible:**
1. Abrir app
2. Cargar transacción
3. Cerrar app

**Tiempo objetivo:** Segundos

**Recompensa inmediata:**
- Ver el movimiento reflejado
- Ver la disponibilidad ajustarse
- Ver la racha mantenerse

### Rachas: Identidad, no Gamificación

Las rachas funcionan porque convierten una acción pequeña en **identidad**:

> "Yo soy alguien que sabe qué pasa con su plata"

**Tono:** Sobrio. Celebración como progreso, no como juego.

### Rituales

| Ritual | Frecuencia | Propósito |
|--------|-----------|-----------|
| Registro | Diario | Captura de dato |
| Cierre de semana | Semanal | Patrones rápidos |
| Cierre de mes | Mensual | Presupuesto vs. real |

### Notificaciones: Acompañamiento, no Vigilancia

**Principio:** Contextuales y respetuosas

- Recordatorios suaves si no se registró
- Alertas si disponibilidad baja rápido
- Mensajes de cierre al final del día
- Spam invasivo

**El usuario debe sentir:** Acompañamiento positivo

---

## Modo Viaje y Multi-Moneda

### Por Qué es Diferencial

El modo viaje no es un "feature simpático". Es una **prueba de estrés para el sistema**.

### Tres Decisiones de Diseño Críticas

#### 1. Registro en Moneda de Origen

**Regla:** Cada transacción se registra en su moneda de origen.

 No se fuerza al usuario a convertir antes de registrar 
 Registro natural + Conversión automática en back

#### 2. Moneda Base de Visualización

**Regla:** El sistema mantiene una moneda base elegida como referencia.

**Objetivo:** Tableros y presupuestos comparables

#### 3. Auditoría de Tipo de Cambio

**Regla:** El tipo de cambio utilizado queda guardado (fx_id) asociado a la transacción.

**Objetivo:** El histórico no se "mueve" según cambie una cotización futura

#### 4. Flexibilidad Bi-monetaria en el Registro (Moneda por Defecto)

**Regla:** Las cuentas se crean en el Plan de Cuentas asociadas a una única moneda "por defecto" (la de mayor uso) para acelerar la carga, pero el usuario debe poder sobrescribir libremente dicha moneda al momento de registrar la transacción particular.

 No duplicar conceptos o cuentas (evitar "Sueldo ARS" y "Sueldo USD").
 Un solo concepto maestral ("Sueldo") que autocompleta la moneda más probable, pero permite iterarla con 1 clic.

### Pipeline de Conversión

```
Usuario registra → "5000" en moneda local
 ↓
Sistema busca/guarda TC del día (fx_id)
 ↓
Calculo monto equivalente en moneda base
 ↓
Almacena ambos: monto_origen + monto_base
```

### Bitácora de Viaje

**Valor agregado:** Transacción + Contexto = Memoria

- Notas de texto
- Fotos de tickets
- Ubicación del gasto

**Resultado:** Finanzas + Experiencia

---

## ‍‍ Gastos Compartidos

### Principio: Opt-in y Progresivo

**Regla:** La colaboración no debe matar el hábito individual.

**Flujo:**
1. Usuario registra primero
2. Luego asocia al evento (opcional)
3. Sistema calcula división

### Cierre por Evento

**Más que cálculo, es un ritual:**

- Resumen: Total, por rubro, por moneda
- Quién debe a quién
- Generación de mensajes/transferencias

### Acelerador de Crecimiento

**Mecanismo natural de referral:**
- Usuario invita amigos para dividir gastos
- Amigos entran con confianza (invitación desde uso real)

---

## Educación Breve Integrada

### Principio: Del Dato al Criterio, Sin Curso

**Regla:** El contenido debe servir al hábito, no competir contra él.

### Microcontenidos Accionables

**Formato:**
- Glosario corto (< 100 palabras)
- Aparece cuando el usuario lo necesita
- Lenguaje humano, no jerga

**Ejemplo:**
```
 Gasto variable alto

Tus gastos variables están 20% arriba del promedio.

Qué significa: Gastos que cambian mes a mes (ej. salidas, ropa).

Palancas: Revisar frecuencia de compras espontáneas.
```

### Feedback Basado en Comportamiento

**Observa patrones → Convierte en aprendizaje**

- Patrones del usuario específico
- No tips genéricos
- Respeta privacidad

---

## Economía de Atención

**Principio maestro:** Cada interacción extra tiene costo.

### Reducción de Decisiones

- No pedir elegir entre 10 opciones cuando 1 alcanza
- No pedir escribir cuando nota opcional funciona
- No pedir convertir moneda cuando back puede hacerlo

### Cada Reducción de Fricción = Mayor Probabilidad de Hábito

---

**Versión del Documento**: 1.0 
**Última actualización**: 2026-01-17
