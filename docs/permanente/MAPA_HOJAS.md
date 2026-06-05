# Mapa de Hojas - Tidetrack Finanzas Personales

Registro canónico de todas las hojas de la planilla con sus GIDs, propósito y layout.

**Spreadsheet ID:** `1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI`  
**URL base:** `https://docs.google.com/spreadsheets/d/1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI/edit?gid=`  
**Mapeado:** 2026-06-05 via Cowork + Claude in Chrome  

---

## Hojas Visibles (UX)

| Nombre | GID | Rol | Estado |
|--------|-----|-----|--------|
| Inicio | 306858729 | Pantalla de bienvenida y navegacion | Produccion |
| Tablero | 201314967 | Dashboard principal: patrimonio, presupuesto, flujo | WIP |
| Cargas | 1889618311 | Formulario batch de carga de transacciones | Produccion |
| Mirada Interanual | — | Resumen historico anual (consume ANUAL) | WIP |
| Plan de Cuentas | 738279722 | Catalogo maestro de 5 tablas relacionales | Produccion |
| Tipos de Cambio | — | Data lake historico de cotizaciones (4 vectores) | Produccion |
| Registros | 709656625 | Ledger transaccional append-only | Produccion |
| Bocetos | — | Prototipado visual de pantallas nuevas | Dev |
| Espacio blanco 2 | — | Espacio libre de trabajo | Dev |

## Hojas Ocultas (Motores y Archivo)

| Nombre | GID | Rol | Referencia |
|--------|-----|-----|-----------|
| CALCU | 367882887 | Motor mensual: cruces matriciales para Tablero | ADR-006 |
| ANUAL | 1358411018 | Motor anual: agregaciones para Mirada Interanual | ADR-006 |
| DATA-ENTRY | 1849033622 | Prototipo del nuevo schema relacional normalizado | DATABASE_SCHEMA.md |
| CARGAS (Forest.) | — | Backup/prototipo alternativo de hoja de Cargas | Legacy |
| BD Antigua | — | Registros historicos pre-Tidetrack (formato plano) | Legacy |
| Mirada Interanual backup | — | Backup del modulo anual | Legacy |
| PALETAS | — | Sistema de colores y tokens de diseno | Dev |

---

## Layout de Datos - Produccion

> Patron universal (ADR-005): todas las BD tienen offset horizontal de 6-8 columnas.
> Columnas A-H son margen UI. Los headers estan en fila 3, datos desde fila 4.

### Plan de Cuentas (gid=738279722)

5 tablas relacionales co-ubicadas en la misma hoja:

| Tabla interna | Columnas | Campos |
|---------------|----------|--------|
| INGRESOS | I:J | nombre, proyecto |
| GASTOS_FIJOS | L:M | nombre, proyecto |
| GASTOS_VARIABLES | O:P | nombre, proyecto |
| MEDIOS_PAGO | R:T | nombre, moneda, proyecto |
| PROYECTOS | V:W | nombre, tipo (Liquidez / Ahorro / Inversion) |

Formula consolidadora en columna de validacion:
```excel
=ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L;O4:O;R4:R}),"SELECT * WHERE Col1 IS NOT NULL",0))
```
Esta formula aplana las 4 tablas de cuentas en una lista plana para los dropdowns de validacion de datos en Cargas.

### Registros (gid=709656625)

Ledger append-only. ~2879 filas x 20 columnas (al momento del mapeo).

| Col | Campo | Notas |
|-----|-------|-------|
| I | monto | Siempre positivo (ADR) |
| J | tipo | "Ingreso" o "Egreso" |
| K | cuenta | FK -> Plan de Cuentas |
| L | tipo_cuenta | Ingreso / Gasto fijo / Gasto variable |
| M | medio | FK -> MEDIOS_PAGO |
| N | moneda | ARS / USD / AUD / EUR |
| O | fecha | Timestamp congelado al procesar |
| P | nota | Texto libre |
| Q | tc_ars | Tipo de cambio ARS congelado |
| R | tc_usd | Tipo de cambio USD congelado |
| S | tc_aud | Tipo de cambio AUD congelado |
| T | tc_eur | Tipo de cambio EUR congelado |

### Tipos de Cambio

4 vectores de cotizaciones historicas, mismo offset que el resto:

| Par | Columnas |
|-----|----------|
| TC_ARS (ARS/ARS base) | I:J |
| TC_USD (USD/ARS) | L:M |
| TC_AUD (AUD/ARS) | O:P |
| TC_EUR (EUR/ARS) | R:S |

Carga via batch `procesarCargas()` que consume argentinadatos.com (ARS) y frankfurter.app (EUR/AUD).

### Cargas (gid=1889618311)

Zona de ingreso de usuario: rango I5:O19 (hasta 15 filas por batch).
El `onEdit` trigger auto-completa fecha y moneda segun el medio seleccionado.
`procesarCargas()` valida el lote, busca cotizaciones y appendea a Registros.

---

## Tablero (gid=201314967) - Dependencias de Modulos

Ver FORMULAS_TABLERO.md para codigo completo de cada modulo.

| Modulo | Rango renderizado | BD consumidas |
|--------|-------------------|---------------|
| Selector moneda global | I9 | — (controlador maestro) |
| Liquidez (por moneda) | S4:S7 | BD Transaccional AN:AZ, Plan de Cuentas R:T + V:W |
| Riqueza acumulada | U4:U7 | BD Transaccional, Plan de Cuentas, Cotizaciones AL4:AL6 |
| Presupuesto vs Real | S13:S15 / U13:U15 | BD Transaccional filtrado por periodo |
| Ahorro real del mes | U17 | BD Transaccional, Plan de Cuentas, selector I9 |
| Disponibilidad de fondos | T20:T22 | Saldos S4:S7, Presupuestos S13:S15, Ejecucion U13:U15 |
| Flujo: Ingresos / Fijos / Variables | Bajo titulos | BD Transaccional + QUERY + BUSCARV doble |
| Medios bancarios | AF:AH | BD Transaccional, Plan de Cuentas |
| Cotizaciones (controlador) | AL4:AL6 | TC congelados o actualizados manualmente |
| Portafolio de proyectos | AJ10:AL22 | BD Transaccional, Plan de Cuentas, Cotizaciones, I9 |

**BD Transaccional del Tablero:** rangos AN:AZ dentro de la misma hoja Tablero.
- AN: monto
- AO: tipo (Ingreso/Egreso)
- AP: categoria de cuenta (incluye "Inicio Mes")
- AQ: categoria de gasto
- AR: medio bancario
- AS: moneda

---

## Motores Ocultos (ADR-006)

### CALCU (gid=367882887)

Procesa cruces multidimensionales del periodo mensual. Las vistas publicas (Tablero) consumen los resultados sin recalcular. Pendiente de documentar su layout interno.

### ANUAL (gid=1358411018)

Procesa agregaciones historicas para Mirada Interanual. Mismo patron que CALCU. Pendiente de documentar su layout interno.

---

## DATA-ENTRY (gid=1849033622) - Schema Futuro

Contiene el nuevo schema relacional normalizado (ver DATABASE_SCHEMA.md v1.0). Aun en diseno; la produccion sigue corriendo en Plan de Cuentas + Registros. La migracion se activara cuando > 3000 transacciones (ADR-001). El schema esta listo para traducirse 1:1 a PostgreSQL.

---

## Historial del Mapa

| Fecha | Accion | Autor |
|-------|--------|-------|
| 2026-06-05 | Primer mapeo completo de GIDs via inspeccion DOM + Chrome | Cowork |
