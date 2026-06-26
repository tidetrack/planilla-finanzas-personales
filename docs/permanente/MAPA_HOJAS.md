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
| Tipos de cambio | — (re-mapear) | Data lake historico de cotizaciones (4 vectores, layout nuevo) | Produccion |
| Registros | — (re-mapear) | Ledger transaccional append-only (layout nuevo) | Produccion |
| Bocetos | — | Prototipado visual de pantallas nuevas | Dev |
| Espacio blanco 2 | — | Espacio libre de trabajo | Dev |

> Nota: los GIDs de "Registros" y "Tipos de cambio" cambiaron con la migracion 2026-06-22 (las hojas de produccion actuales son las ex-"Copia de..."). El GID 709656625 anterior corresponde a la hoja que ahora es "Registros_legacy". Re-mapear via DevTools o inspeccion DOM.

## Hojas Ocultas (Motores y Archivo)

| Nombre | GID | Rol | Referencia |
|--------|-----|-----|-----------|
| CALCU | 367882887 | Motor mensual: cruces matriciales para Tablero | ADR-006 |
| ANUAL | 1358411018 | Motor anual: agregaciones para Mirada Interanual | ADR-006 |
| DATA-ENTRY | 1849033622 | Prototipo del nuevo schema relacional normalizado | DATABASE_SCHEMA.md |
| Registros_legacy | — (re-mapear) | Backup del ledger pre-migracion (~2879 filas, layout I:T) | Migracion 2026-06-22 |
| Tipos de cambio_legacy | — (re-mapear) | Backup del data lake TC pre-migracion (bloques I:J/L:M/O:P/R:S) | Migracion 2026-06-22 |
| CARGAS (Forest.) | — | Backup/prototipo alternativo de hoja de Cargas | Legacy |
| BD Antigua | — | Registros historicos pre-Tidetrack (formato plano) | Legacy |
| Mirada Interanual backup | — | Backup del modulo anual | Legacy |
| PALETAS | — | Sistema de colores y tokens de diseno | Dev |

---

## Layout de Datos - Produccion

> Nota de migracion (2026-06-22): el offset historico de ADR-005 fue eliminado
> en "Registros" y "Tipos de cambio". Esas hojas ahora arrancan en columna B.
> Plan de Cuentas y Cargas NO cambiaron y siguen con offset (I+).

### Plan de Cuentas (gid=738279722) - SIN CAMBIOS

5 tablas relacionales co-ubicadas. Header fila 3, datos desde fila 4. Offset I+.

| Tabla interna | Columnas | Campos |
|---------------|----------|--------|
| INGRESOS | I:J | nombre, proyecto |
| GASTOS_FIJOS | L:M | nombre, proyecto |
| GASTOS_VARIABLES | O:P | nombre, proyecto |
| MEDIOS_PAGO | R:T | nombre, moneda, proyecto |
| PROYECTOS | V:W | nombre, tipo (Liquidez / Ahorro / Inversion) |

Bloque "Categorias": Y2 titulo, Y3 header, Y4 formula consolidadora:
```excel
=ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L;O4:O;R4:R}),"SELECT * WHERE Col1 IS NOT NULL",0))
```
Aplana las 4 tablas de cuentas en una lista plana para los dropdowns de validacion de datos en Cargas.

### Registros (produccion) - LAYOUT NUEVO desde 2026-06-22

Ledger append-only. Header en fila 5, datos desde fila 6. Sin offset (B:M). GID pendiente de re-mapeo.

| Col | Campo | Notas |
|-----|-------|-------|
| B | Monto | Siempre positivo |
| C | Tipo | "Ingreso" o "Egreso" |
| D | Cuenta | FK -> Plan de Cuentas |
| E | Tipo de Cuenta | Ingreso / Gasto fijo / Gasto variable |
| F | Medio | FK -> MEDIOS_PAGO |
| G | Moneda | ARS / USD / AUD / EUR |
| H | Fecha | Timestamp congelado al procesar |
| I | Nota | Texto libre |
| J | Valor ARS | TC ARS congelado |
| K | Valor USD | TC USD congelado |
| L | Valor AUD | TC AUD congelado |
| M | Valor EUR | TC EUR congelado |

### Registros_legacy (oculta) - BACKUP

Hoja de solo lectura. Layout anterior (~2879 filas). Header fila 2, datos desde fila 3.
Columnas I:T (offset historico de ADR-005). GID pendiente de re-mapeo.

### Tipos de cambio (produccion) - LAYOUT NUEVO desde 2026-06-22

4 vectores de cotizaciones historicas. Titulos de bloque fila 5, sub-headers (Fecha/Cotizacion)
fila 6, datos desde fila 7. Sin offset (bloques arrancan en B). GID pendiente de re-mapeo.

| Par | Columnas |
|-----|----------|
| TC_ARS (ARS base = 1.0) | B:C |
| TC_USD (USD/ARS oficial) | E:F |
| TC_AUD (AUD/ARS) | H:I |
| TC_EUR (EUR/ARS) | K:L |

Carga via batch `procesarCargas()` que consume argentinadatos.com (ARS) y frankfurter.app (EUR/AUD).

### Tipos de cambio_legacy (oculta) - BACKUP

Hoja de solo lectura. Layout anterior. Header fila 3, datos desde fila 4.
Bloques I:J (ARS), L:M (USD), O:P (AUD), R:S (EUR). GID pendiente de re-mapeo.

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
| 2026-06-22 | Actualizacion layout Registros (B:M, fila 5/6) y Tipos de cambio (B/E/H/K, fila 6/7). Incorporacion hojas _legacy ocultas. GIDs de produccion pendientes de re-mapeo | docs-keeper |
