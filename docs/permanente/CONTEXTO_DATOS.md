# Contexto de Datos (Backend Tracker)

Este documento describe de forma semantica las Hojas de Calculo que actuan como
Bases de Datos dentro de Tidetrack. Se actualiza cada vez que cambia el layout fisico.

**Ultima actualizacion**: 2026-06-22 (reconciliacion al layout de produccion nuevo)

---

## Nota de migracion (2026-06-22)

Las hojas de produccion "Registros" y "Tipos de cambio" son las ex-"Copia de..."
y tienen un layout NUEVO sin el offset historico de ADR-005. Los datos arrancan
en columna B. Las hojas originales pasaron a llamarse "Registros_legacy" y
"Tipos de cambio_legacy" (ocultas, solo lectura, backup).

Plan de Cuentas y Cargas NO cambiaron: mantienen el offset I+.

---

## 1. Registros (Produccion - LAYOUT NUEVO)

- **Rol**: Ledger transaccional append-only. Cada fila = un movimiento financiero procesado.
- **Layout actual**: header en fila 5, datos desde fila 6. Sin offset (datos en B:M).
- **Columnas**:

| Col | Campo | Descripcion |
|-----|-------|-------------|
| B | Monto | Siempre positivo |
| C | Tipo | "Ingreso" o "Egreso" |
| D | Cuenta | Nombre de cuenta (FK -> Plan de Cuentas) |
| E | Tipo de Cuenta | Ingreso / Gasto fijo / Gasto variable (deducido en backend) |
| F | Medio | Nombre del medio de pago (FK -> MEDIOS_PAGO) |
| G | Moneda | ARS / USD / AUD / EUR |
| H | Fecha | Fecha congelada al procesar (YYYY-MM-DD) |
| I | Nota | Texto libre (opcional) |
| J | Valor ARS | TC ARS congelado al momento de la carga |
| K | Valor USD | TC USD congelado al momento de la carga |
| L | Valor AUD | TC AUD congelado al momento de la carga |
| M | Valor EUR | TC EUR congelado al momento de la carga |

- **Escritura**: solo via `procesarCargas()` (06_RegistrosService.js). Tabla append-only.
- **Paleta**: #34475d (headers), #eff2f9 (fondo celdas transaccionales).
- **Formulas**: no. Tabla de ingesta pura (CRUD via Apps Script).

## 1b. Registros_legacy (Oculta - BACKUP)

- **Rol**: Backup del ledger pre-migracion. Solo lectura. No modificar.
- **Layout**: header fila 2, datos desde fila 3. Con offset historico (I:T).
- **Filas**: ~2879 al momento de la migracion 2026-06-22.
- **Columnas legadas**: I=monto, J=tipo, K=cuenta, L=tipo_cuenta, M=medio,
  N=moneda, O=fecha, P=nota, Q=tc_ars, R=tc_usd, S=tc_aud, T=tc_eur.

---

## 2. Plan de Cuentas (Dimension / Catalogo) - SIN CAMBIOS

- **Rol**: Maestro de cuentas, proyectos y clasificaciones.
- **Layout**: header fila 3, datos desde fila 4. Offset I+ (ADR-005 vigente).
- **Estructura**: 1000 filas x 25 columnas.
- **Tablas internas**:

| Tabla | Columnas | Campos |
|-------|----------|--------|
| INGRESOS | I:J | nombre, proyecto |
| GASTOS_FIJOS | L:M | nombre, proyecto |
| GASTOS_VARIABLES | O:P | nombre, proyecto |
| MEDIOS_PAGO | R:T | nombre, moneda, proyecto |
| PROYECTOS | V:W | nombre, tipo |

- **Bloque "Categorias"**: Y2 titulo, Y3 header, Y4 ARRAYFORMULA consolidadora que
  aplana las 4 tablas de cuentas en una lista plana para dropdowns de validacion.
- **Formula consolidadora**:
  ```
  =ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L;O4:O;R4:R}),"SELECT * WHERE Col1 IS NOT NULL",0))
  ```
- **Paleta relacional**: #34475d, #eff2f9 (compartida con Registros).

---

## 3. Tipos de Cambio (Produccion - LAYOUT NUEVO)

- **Rol**: Repositorio de cotizaciones historicas. Data Lake de TCs congelados.
- **Layout actual**: titulos de bloque en fila 5, sub-headers (Fecha/Cotizacion)
  en fila 6, datos desde fila 7. Sin offset (bloques arrancan en B).
- **Bloques**:

| Par | Columnas | Descripcion |
|-----|----------|-------------|
| TC_ARS | B:C | ARS base = 1.0 siempre |
| TC_USD | E:F | Dolar oficial (argentinadatos.com) |
| TC_AUD | H:I | AUD/ARS triangulado via Frankfurter |
| TC_EUR | K:L | EUR/ARS triangulado via Frankfurter |

- **Escritura**: via `appendMassive()` en `06_RegistrosService.js` durante `procesarCargas()`.
  Tambien via `forzarCargaHistorica()` en `15_ExchangeRateApi.js`.
- **Header de anclaje original**: "Monedas." en col 8 (dato del mapeo pre-migracion, ya no aplica).

## 3b. Tipos de cambio_legacy (Oculta - BACKUP)

- **Rol**: Backup del data lake TC pre-migracion. Solo lectura. No modificar.
- **Layout**: header fila 3, datos desde fila 4. Con offset historico.
- **Bloques legados**: TC_ARS=I:J, TC_USD=L:M, TC_AUD=O:P, TC_EUR=R:S.

---

## 4. BD Antigua (Archivo Historico) - SIN CAMBIOS

- **Rol**: Tabla plana legacy pre-Tidetrack.
- **Estructura**: 2950 filas x 8 columnas.
- **Mapeo explicito**: columnas desde A1: Fecha, Ingreso, Egreso, Detalle, Medio, Tipo,
  Observacion, Cuentas Faltantes.
- **Paleta**: #39444d (indica archivo "muerto", no interactivo).

---

## Patron Arquitectonico

Desde 2026-06-22 el patron de offset difiere por hoja:

| Hoja | Offset | Header | Datos |
|------|--------|--------|-------|
| Plan de Cuentas | I+ (ADR-005 vigente) | Fila 3 | Fila 4 |
| Cargas | I+ (ADR-005 vigente) | Fila 4 | Fila 5 |
| Registros (produccion) | Sin offset (B:M) | Fila 5 | Fila 6 |
| Tipos de cambio (produccion) | Sin offset (B+) | Fila 5/6 | Fila 7 |
| Registros_legacy | I+ (legado) | Fila 2 | Fila 3 |
| Tipos de cambio_legacy | I+ (legado) | Fila 3 | Fila 4 |
| BD Antigua | Sin offset (A:H) | Fila 1 | Fila 2 |
