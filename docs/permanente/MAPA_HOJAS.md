# Mapa de Hojas - Tidetrack Finanzas Personales

Registro canonico de todas las hojas de la planilla con su proposito y layout.

**Spreadsheet ID:** `1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI`
**Titulo:** `PLANILLA FINANZAS_v4 .WIP | Personal` (owner start.tidetrack)
**URL base:** `https://docs.google.com/spreadsheets/d/1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI/edit?gid=`
**Ultimo relevamiento completo:** 2026-08-18 (export xlsx de la planilla viva + 8 auditores)

> Este mapa describe el estado POST-SWAP v0.11 (MIGRACION_v0.11_SwapHojasFix.js): Franco
> rediseno la planilla duplicando hojas con sufijo " - Fix" y el swap las convirtio en las
> canonicas, dejando las viejas como respaldos ocultos "<nombre> (anterior 2026-08-18)"
> hasta su purga. Los GIDs sobreviven a los renombres (Sheets los conserva); re-mapearlos
> con el proximo escaneo del gemelo digital.
> El detalle funcional de cada hoja (que funciona, que esta pendiente) vive en
> FUNCIONALIDADES.md; la geometria ejecutable vive en src/00_Config.js (SSOT).

---

## Hojas canonicas (post-swap v0.11)

| Nombre | Rol | Estado funcional |
|--------|-----|------------------|
| Inicio | Dashboard resumen: KPIs de flujo y capital, calendario, presupuesto del mes | Parcial (ver FUNCIONALIDADES 01) |
| Tablero | Vista mensual en profundidad: medios, saldos, traspasos, disponibilidad | Parcial, con formulas a reparar (ver FUNCIONALIDADES 02) |
| Presupuesto | Presupuesto por composicion (historico + presupuestado) | Esqueleto sin motor (ver FUNCIONALIDADES 03) |
| Cargas | Carga de movimientos en lotes de 15 + vista ultimos 15 | Produccion |
| Plan de Cuentas | Catalogo maestro: 5 bloques + columna S de consolidacion | Produccion |
| Mirada Interanual | Matriz conceptos x 12 meses (ventana movil) + tendencias | Funciona; script desalineado (ver FUNCIONALIDADES 06) |
| Registros | BD transaccional de movimientos (ledger) | Produccion |
| Tipos de Cambio | BD de cotizaciones diarias (4 monedas) | Produccion (FX sin filas desde 2026-08-13: diagnosticar) |

## Respaldos del swap (ocultos, hasta la purga)

`Inicio / Tablero / Cargas / Plan de Cuentas / Registros / Tipos de cambio` con sufijo
`(anterior 2026-08-18)`. Se leen entre si (foto consistente del pasado). Se purgan con
`Tidetrack Dev > Migracion v0.11 > 5. Purgar respaldos`, que exige cero referencias vivas y
confirmacion del operador. `Mirada Interanual` y `Presupuesto` no tienen respaldo (la Mirada
vieja fue eliminada a mano antes del swap; Presupuesto es una hoja nueva).

---

## Layout de datos - Produccion (geometria Fix)

### Plan de Cuentas

Titulo C2. Titulos de bloque fila 6, headers de columna fila 7, datos desde fila 8.
En la hoja, la nocion "Proyecto" se rotula "Categoria"; las claves internas de RANGES
conservan el nombre historico.

| Tabla interna (RANGES) | Columnas | Campos |
|------------------------|----------|--------|
| INGRESOS | C:D | nombre, categoria |
| GASTOS_FIJOS | F:G | nombre, categoria |
| GASTOS_VARIABLES | I:J | nombre, categoria |
| MEDIOS_PAGO | L:N | nombre, moneda, categoria |
| PROYECTOS (rotulado "Categorias") | P:Q | nombre, tipo (Ahorros / Inversiones / Financiacion / Hogar) |
| (consolidacion, agregada por el swap) | S | union de las cuentas de los 4 bloques via QUERY acotada a fila 1000; fuente del dropdown de Cuenta en Cargas. No tocar a mano |

Validaciones propias: columnas Categoria de cada bloque (D/G/J/N) -> lista P8:P37; columna
Tipo (Q) -> lista fija de los 4 tipos.
Suciedad conocida: bloque residual C1005:N1033 (movimientos de mayo 2025 incrustados),
'Meta de Ahorro 3' duplicada, Q19 sin nombre. Ver FUNCIONALIDADES 05.

### Cargas

Titulo B2. Headers fila 6, grilla de carga fija C7:I21 (15 filas, numeracion B7:B21; no
crece, se limpia despues de cada lote). Vista "Ultimos 15 movimientos" M6:S21 (QUERY sobre
Registros). Dropdowns: Tipo lista fija Ingreso/Egreso, Cuenta -> Plan!S, Medio -> Plan!L,
Moneda lista fija ARS/USD/AUD/EUR.

| Campo | Columna |
|-------|---------|
| monto | C |
| tipo | D |
| cuenta | E |
| medio | F |
| moneda | G |
| fecha | H |
| nota | I |

### Registros

Titulo B2 ("Hoja de Registros."). Header fila 6, datos desde fila 7, columnas B:M, orden por
fecha descendente (Z-A). Append por `procesarCargas`; las columnas J:M congelan las
cotizaciones del dia del registro (valor pegado, irrecuperable despues).

| Campo | Columna |
|-------|---------|
| monto | B |
| tipo | C |
| cuenta | D |
| tipo_cuenta | E |
| medio | F |
| moneda | G |
| fecha | H |
| nota | I |
| tc_ars / tc_usd / tc_aud / tc_eur | J / K / L / M |

### Tipos de Cambio

Titulo C2. Nombres de moneda fila 6, headers fila 7, datos desde fila 8. Cuatro tablas
paralelas Fecha/Cotizacion, una fila por dia, orden descendente. ARS siempre 1.0 (moneda
base).

| Bloque | Columnas |
|--------|----------|
| TC_ARS | C:D |
| TC_USD | F:G |
| TC_AUD | I:J |
| TC_EUR | L:M |

### Inicio / Tablero / Presupuesto / Mirada Interanual

Vistas sin escritura de script (salvo la Mirada, generable por `07_MiradaInteranual.js`,
hoy desalineado). Su layout interno y el estado de cada bloque estan en FUNCIONALIDADES.md
(secciones 01, 02, 03 y 06); sus motores QUERY leen `Registros` y cruzan contra
`Plan de Cuentas` L:N y P:Q.

---

## Historial del mapa

| Fecha | Accion | Autor |
|-------|--------|-------|
| 2026-06-05 | Primer mapeo completo de GIDs via inspeccion DOM + Chrome | Cowork |
| 2026-06-22 | Actualizacion layout Registros (B:M, fila 5/6) y Tipos de cambio (B/E/H/K, fila 6/7). Incorporacion hojas _legacy ocultas | docs-keeper |
| 2026-08-13 | Migracion v0.9.5 (layout nuevo verificado en vivo) + migracion historica v0.10.0 desde la planilla v03.1 | sesion Claude 2026-08-13 |
| 2026-08-18 | Rediseno de Franco (hojas " - Fix") + swap v0.11: reescritura completa del mapa a la geometria Fix. Las hojas ocultas de junio (CALCU, ANUAL, Bocetos, _legacy, etc.) ya no existen en la planilla | sesion Claude 2026-08-18 |

> Los GIDs de la tabla de junio quedaron obsoletos tras las limpiezas de hojas; se
> re-mapean con el proximo escaneo del gemelo digital (Dev > Exportar arquitectura).
