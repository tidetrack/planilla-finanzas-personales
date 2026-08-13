# Mapa de arquitectura de la planilla

> **[CONCEPTO DE NEGOCIO]** La capa SEMÁNTICA del gemelo digital: qué es cada hoja,
> cuáles guardan datos y cuáles los muestran, qué celdas son controles que el
> usuario toca, y dónde vive cada variable. Es el documento que una sesión (humana
> o agente) lee ANTES de escribir una fórmula o mover una columna.
>
> **[FUNDAMENTO TEÓRICO / ADMINISTRATIVO]** Google Sheets tratado como
> *infrastructure as code*: el estado vivo se congela en un artefacto versionable
> y todo cambio se prueba por diff celda por celda contra el snapshot anterior.
> La planilla productiva es la única verdad del estado; este mapa es la lectura
> curada de esa verdad, no un sustituto de ella.
>
> **@see** `docs/permanente/ARNES_TIDETRACK.md` (sección 4 — Fase 2, gemelo digital)
> **@see** `CLAUDE.md` sección 4 (layout real de producción — fuente de verdad del esquema)
> **@see** `docs/permanente/MAPA_HOJAS.md` (GIDs) · `docs/permanente/FORMULAS_TABLERO.md` (fórmulas del Tablero)

**Planilla:** `PLANILLA FINANZAS_v4 .WIP | Personal`
(`1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI`, owner `start.tidetrack@gmail.com`,
registrada en `targets.yaml`).

**Regla de honestidad de este documento.** Toda celda, rango, fórmula o conteo que
aparezca acá está verificado contra el snapshot JSON o contra `src/`. Lo que no se
pudo verificar se declara **pendiente** en vez de afirmarse. Un mapa que manda a una
sesión a una celda que no existe es peor que no tener mapa: si al leer algo acá la
planilla dice otra cosa, gana la planilla y este archivo se corrige en el mismo commit.

**Estado de la evidencia al escribir este mapa (2026-08-13):** el único snapshot
existente es el del **2026-03-23**, producido por el scanner viejo, que sólo
guardaba fórmulas y las primeras 5 filas de valores. Trajo **1.710 celdas en 15
hojas**, de las cuales apenas **44 son de `Registros`** — una hoja de 2.879 filas.
Además, ese snapshot **está ciego al resultado calculado de toda celda con fórmula**
(sección 1.1). Todo lo que este mapa afirma sobre *datos* está limitado por eso, y
todo lo que afirma sobre el estado de la planilla **posterior a marzo de 2026** está
marcado como pendiente. El primer escaneo de cobertura total (scanner v0.8.4, Fase 2)
es lo que cierra esos pendientes.

> **ACTUALIZACION 2026-08-13 (tarde) — el escaneo de cobertura total YA SE HIZO.**
> No con el scanner de Apps Script sino por lectura directa de la Sheets API (cuatro
> tandas, 19 hojas de contenido, formula + valor calculado celda por celda). Cierra la
> mayoria de los pendientes de arriba: GIDs confirmados, resultado calculado de cada
> formula, errores de runtime visibles, `Mirada Interanual` mapeada entera, inventario
> real de 23 hojas.
>
> **Ese escaneo vive en las secciones 10 a 15 de este documento, y es la fuente de
> verdad mas fresca.** Las secciones 2 a 5 y 9 describen el snapshot de marzo y el
> layout previo a la migracion: se conservan como historia y como contrato del gemelo,
> pero **donde contradigan a las secciones 10-15, gana lo nuevo.** Cada seccion vieja
> afectada lleva una nota de reenvio.

---

## ADVERTENCIA CRITICA (2026-08-13): la planilla migro y el codigo no

**Antes de usar cualquier layout de este mapa, lee esto.** Una consulta en vivo a la
Sheets API (2026-08-13, dos agentes independientes, lectura celda por celda) probo que
**la planilla ya no esta en el layout que describen el snapshot de marzo, `CLAUDE.md`
seccion 4 ni la mayor parte de este documento.** La migracion al layout v0.9.x SI se
ejecuto sobre los datos, aunque el codigo v0.9.x nunca se desplego. Es **parcial**:

| Hoja | Layout REAL hoy | Estado |
|---|---|---|
| `Registros` (gid 1546296548) | 14 col (A:N), headers **fila 5** en **B:M**, datos desde **fila 6** | MIGRADA a v0.9.x |
| `Tipos de cambio` (gid 779567597) | 13 col (A:M), bloques **B:C / E:F / H:I / K:L**, titulos fila 5, headers fila 6, datos fila 7 | MIGRADA a v0.9.x |
| `Plan de Cuentas` | headers fila 3, datos fila 4, bloques I:J / L:M / O:P / R:T / V:W | SIN migrar |
| `Cargas` | headers fila 4, datos desde fila 5, `I5:O19` | SIN migrar |
| `Registros_legacy` (oculta) | el layout viejo I:T, headers fila 2, datos fila 3 | backup de la migracion |
| `Tipos de cambio_legacy` (oculta) | bloques I:J / L:M / O:P / R:S, headers fila 3, datos fila 4 | backup de la migracion |

**Todo lo que este mapa afirme sobre el layout de `Registros` o `Tipos de cambio` a
partir del snapshot de marzo describe hoy a las hojas `_legacy`, no a las vivas.**

**Consecuencia en produccion:** el codigo desplegado (v0.8.3) pide `Registros!I:T`
(columnas 9 a 20) sobre una hoja de 14 columnas. `procesarCargas()` tira excepcion y no
limpia la grilla de `Cargas` — hay una carga varada del 2026-06-21 que lo evidencia. Las
formulas de `07_MiradaInteranual.js` (G10:R14) muestran `#ERROR!`: apuntan a siete
columnas que ya no existen. El ultimo registro del ledger es del **2026-03-29**.

**Decision Franco 2026-08-13 (resuelta):** se adapta el CODIGO al layout nuevo (no se
revierte la planilla) y se recuperan por backfill las 3.151 cotizaciones perdidas desde
`Tipos de cambio_legacy`. Eso es la entrega **v0.9.5**. Hasta que esta desplegada, ningun
rango nuevo sobre esas dos hojas se escribe contra el layout I:T, y toda afirmacion de
layout se verifica contra la planilla viva, no contra este mapa ni contra el snapshot de
marzo.

### Geometria de `Mirada Interanual` (verificada en vivo el 2026-08-13)

Era la unica hoja de la release cuya geometria nadie habia confirmado: el snapshot de
marzo no la tiene (nacio en junio) y su descripcion salia del JSDoc del propio modulo,
o sea evidencia circular. Confirmado por lectura directa:

- gid **`199868006`**, 1002 filas x 27 columnas (A:AA), visible, `frozenRowCount: 6`.
  Existe ademas `Mirada Interanual backup` (gid `1045164083`, 999x32, **oculta**).
- Selectores: **`E4` = mes** (hoy `MAYO`), **`F4` = anio** (hoy `2026`), **`R4` = moneda**
  (hoy `ARS`). Hay ademas un selector `N4` = Proyecto (hoy `Todos`) que **el modulo no usa**.
- Rotulos de tipo: `C10` = `Ingresos`, `C11` = `Gastos Fijos`, `C12` = `Gastos Variables`
  (literales exactos, sin espacios ni tildes distintas). `C14` = `Resultados`.
- Fila 9 = indices de mes `1..12` en G9:R9 (no nombres de mes). El modulo no la lee: deriva
  el mes por aritmetica de columna contra `$K$10`.
- Fila 13: vacia (el modulo la saltea, correcto). Fila 14: las 12 formulas de Resultado,
  patron `=G10-G11-G12`.
- Estado actual de G10:R14: las 48 celdas tienen formula y las 48 muestran `#ERROR!`.

**Defecto detectado en las formulas vivas:** las de las filas 11 y 12 referencian `$C10`,
no `$C11`/`$C12`. Como el `IF` clasifica el tipo contra esa celda, las tres filas
calcularian *Ingresos*. Hoy esta tapado por el `#ERROR!`; al arreglar el parse error
apareceria como tres filas identicas. Se corrige en la v0.9.5.

> **RESUELTO — verificado el 2026-08-13 por lectura directa.** La v0.9.5 se aplico y las
> 48 celdas de `G10:R14` **calculan valores reales, cero errores en la hoja**. Las filas
> 11 y 12 ya referencian `$C11` y `$C12` (verificado en el texto vivo de `G11` y `G12`),
> y las formulas leen el layout nuevo (`Registros!$H$6:$H` fechas, `$B$6:$B` montos,
> `$E$6:$E` tipo de cuenta, `$G$6:$G` moneda, `$K$6:$M` TC). Ejemplos leidos:
> `G10 = $1.463.419,82`, `H10 = $3.612.210,86`, `I10 = $5.782.853,07`, `G11 = $425.917,31`.
> Detalle y los defectos de diseno que **quedan abiertos** en la seccion 13.3.

---

## 1. Las tres capas del gemelo digital

| Capa | Archivo | Cómo se produce | Se edita a mano |
|---|---|---|---|
| Cruda | `docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json` | Menú `Tidetrack > [DevTools] Exportar Arquitectura` (`src/98_DevTools_Scanner.js`), se baja de Drive | **NUNCA** |
| Mecánica | `docs/permanente/INVENTARIO_CELDAS.md` | `python3 devtools/generar_inventario_planilla.py` sobre el JSON | **NUNCA** (se regenera) |
| Mecánica | `docs/permanente/celdas.tsv` | `python3 devtools/generar_tsv_celdas.py` sobre el JSON | **NUNCA** (se regenera) |
| Mecánica | `docs/permanente/celdas.tsv.meta` | el mismo generador, en la misma corrida | **NUNCA** (se regenera) |
| Semántica | **este archivo** | Criterio humano | **SIEMPRE a mano** |

`celdas.tsv.meta` es la procedencia del volcado: de qué snapshot salió, de qué fecha,
cuántas filas tiene y —lo que más importa— **cuál de los dos formatos de celda se
volcó** (`formato_celda`). Leerlo antes de sacar conclusiones del TSV.

Reglas de uso:

- **El JSON no entra nunca entero al contexto de una sesión.** Pesa cientos de KB
  hoy y crecerá con la cobertura total. Se lo consulta con `python3 -c` puntual o,
  mejor, por el TSV con `grep`/`awk` (sección 6).
- El inventario y el TSV son **derivados**: si contradicen al JSON, el JSON gana y
  hay que regenerarlos. Si el JSON contradice a este mapa, gana el JSON y hay que
  corregir este mapa en el mismo commit.
- Este mapa **no reemplaza a `00_Config.js`**: los rangos que usa el código viven
  ahí (SSOT). Acá se explica *qué significan*.

### 1.1 Contrato de celda del snapshot — y sus DOS formatos

Cada entrada de `hojas[<hoja>].mapa_celdas[<ref A1>]` tiene esta forma:

```json
{
  "valor":          "<valor crudo si NO hay fórmula; null si la hay>",
  "formula":        "<string o null>",
  "valor_mostrado": "<texto tal como se ve en pantalla>",
  "estilo":         { "…opcional, sólo lo que difiere del default de Sheets…" }
}
```

Hay **dos formatos en circulación** y todo consumidor tiene que tolerar los dos:

| | Snapshot **viejo** (2026-03-23, el único que hay hoy) | Snapshot **nuevo** (scanner v0.8.4 en adelante) |
|---|---|---|
| `valor` | valor crudo, **`null` en toda celda con fórmula** | ídem (se conservó igual a propósito, para no romper consumidores) |
| `formula` | string o `null` | ídem |
| `valor_mostrado` | **no existe** | presente siempre que aporte |
| `estilo` | presente | presente |

Consecuencias operativas, que hay que tener en la cabeza al leer cualquier consulta:

1. **El snapshot viejo está ciego al resultado calculado.** `valor` es `null` en las
   1.205 celdas con fórmula, sin excepción (verificado: `awk -F'\t' 'NR>1 && $3!="" && $4==""'`
   sobre `celdas.tsv` devuelve 1.205 de 1.205). En las hojas que son casi 100 % fórmula
   — `Tablero`, `CALCU`, `ANUAL`, `Inicio` — eso deja sin ningún **resultado calculado**.
   Ojo con la precisión: numeros crudos SI hay (39 en esas cuatro hojas, sobre todo el
   derrame de ARRAYFORMULA serializado como literal en los staging de `Inicio` y
   `Tablero`, mas `CALCU!G3` y `ANUAL!A1`); lo que no hay es el resultado de ninguna
   fórmula. Preguntarle "cuánto da esta celda" al snapshot de marzo no devuelve nada, y
   eso **no** significa que la celda esté vacía ni que el TSV esté roto.
2. **`valor_mostrado` es el único lugar donde viven los errores de runtime.**
   `#REF!`, `#N/A`, `#DIV/0!`, `#VALUE!` resultantes aparecen ahí, no en `valor`.
   En el snapshot viejo sólo se detectan los `#REF!` que quedaron escritos *dentro
   del texto de la fórmula* (sección 6.5).
3. **Nunca asumir que `valor_mostrado` existe.** Todo generador, diff o consulta
   sobre el JSON tiene que degradar limpiamente cuando el campo falta: es lo que
   pasa con el único snapshot versionado hoy.

Definición del campo en `src/98_DevTools_Scanner.js` (decisión inline fechada
2026-08-13, con el criterio de cuándo se emite `valor_mostrado` y cuándo no).

---

## 2. Inventario de hojas por rol de negocio

> **SUPERADA por la seccion 11.** Este inventario es el del snapshot de marzo: 15 hojas,
> sin GIDs confirmados, sin veredicto de conservacion. El inventario vigente son **23
> hojas con GID confirmado y veredicto** (seccion 11). Se conserva porque documenta el
> estado del que se partio: `Espacio blanco 1` existia y hoy **ya no**, `CALCU` figuraba
> como oculta y hoy esta **visible**, y `Mirada Interanual` no figuraba.

Las 15 hojas confirmadas por el snapshot del 2026-03-23. La columna "celdas 03-23"
es lo que trajo el scanner viejo, no el contenido real de la hoja.

### Entrada de datos

| Hoja | Oculta | Filas | Celdas 03-23 | Rol |
|---|---|---|---|---|
| `Cargas` | no | 708 | 26 | Puerta de entrada. El usuario escribe en `I5:O19` (15 filas = hasta 15 movimientos por lote) y `procesarCargas()` los persiste en `Registros`. Bloque de sólo lectura a la derecha: título en `R2` (`Últimos 15 movimientos.`), encabezados `R4:X4`, la QUERY en `R5`. |

### Bases de datos

| Hoja | Oculta | Filas | Celdas 03-23 | Rol |
|---|---|---|---|---|
| `Registros` | no | 2.879 | 44 | Ledger transaccional append-only. La BD principal. Escrita por `06_RegistrosService.js`. |
| `Tipos de Cambio` | no | 815 | 32 | Data lake de cotizaciones (ARS/USD/AUD/EUR). Escrito en batch por el pipeline (ADR-004). |
| `Plan de Cuentas` | no | 1.000 | 40 | Catálogo maestro: 5 tablas relacionales + bloque consolidador de categorías. |
| `BD Antigua` | no | 2.950 | 24 | Histórico pre-Tidetrack (2024+), formato plano. Sólo lectura; la consume `99_MigrationLogic.js`. |

### Motores ocultos (ADR-006)

| Hoja | Oculta | Filas | Celdas 03-23 | Rol |
|---|---|---|---|---|
| `CALCU` | sí | 32 | 142 | Motor mensual: calendario + cruces por cuenta. **Su staging lee `'R CAR'`, una hoja que no existe en el snapshot** (sección 9). |
| `ANUAL` | sí | 98 | 1.026 | Motor anual: matriz mes x cuenta, **840 celdas con `SUMIFS`** (1.680 ocurrencias del token: cada celda lleva dos restados). **Su staging (`P1`) y sus etiquetas de cuenta (`LISTAS`) apuntan a hojas inexistentes** (sección 9). |

### Vistas

| Hoja | Oculta | Filas | Celdas 03-23 | Rol |
|---|---|---|---|---|
| `Inicio` | no | 1.000 | 89 | Pantalla de bienvenida: saldo del mes, riqueza acumulada, calendario, comparación contra el mes anterior. Staging propio en `Y:AK` (mes actual) y `AM:AX` (mes anterior). |
| `Tablero` | no | 1.000 | 116 | Dashboard principal: liquidez y riqueza por moneda, presupuesto vs real, medios bancarios, portafolio de proyectos. Staging propio en `AN:AZ`. |
| `Mirada Interanual` | ? | ? | **no figura** | Vista interanual (Ingresos / Gastos Fijos / Gastos Variables / Resultado por mes). Creada en junio 2026, posterior al snapshot. Sus fórmulas las escribe `07_MiradaInteranual.js` en `G10:R12` y `G14:R14`. |

### Residuales y de trabajo

| Hoja | Oculta | Filas | Celdas 03-23 | Rol |
|---|---|---|---|---|
| `DATA-ENTRY` | sí | 36 | 134 | Prototipo del schema relacional normalizado. Siete títulos de tabla en la fila 2: `DB_MONEDAS` (`B2`), `DB_TIPOS_CAMBIO` (`G2`), `DB_MEDIOS_PAGO` (`T2`), `DB_CUENTAS` (`Z2`), `DB_TRANSACCIONES` (`AE2`), `DB_CONFIG` (`AR2`), `AUX_COTIZACIONES` (`AV2`). Diseño para la migración a PostgreSQL (ADR-001), no está en producción. |
| `Bocetos` | no | 708 | 13 | Prototipado visual. De sus 5 fórmulas, **sólo `AH2` está rota** (`#REF!`); `AH3` (`QUERY('R CAR'!A:G;AH2)`) y las tres de color en `D706:D708` no tienen `#REF!` en su texto, aunque `AH3` depende de una hoja inexistente. |
| `CARGAS (Forest.)` | sí | 4 | 12 | Prototipo alternativo de la hoja de cargas. Su único QUERY (`T4`) apunta a `'R CAR'` y a `TABLERO`, ambas inexistentes en el snapshot. `B2` contiene una imagen (el scanner la serializa como `{"valueType": "IMAGE"}`). |
| `PALETAS` | sí | 17 | 6 | Tokens de color del design system. |
| `Espacio blanco 1` | no | 708 | 3 | Vacía salvo tres fórmulas residuales de color en `D706:D708`. |
| `Espacio blanco 2` | no | 708 | 3 | Ídem: mismas tres fórmulas en `D706:D708`, mismo contenido. |

Notas de nomenclatura y de incertidumbre:

- `NAV_CONFIG.SHEETS` (en `00_Config.js`) declara `ESPACIO_BLANCO_1`, `ESPACIO_BLANCO_2`
  y `ESPACIO_BLANCO_3` — las tres. `'Espacio blanco 3'` **no existe** en el snapshot.
  Es sólo navegación (no lee ni escribe datos), por eso no se le puso resolver de alias.
- Las claves con ambigüedad histórica (`DATA_ENTRY`, `TIPOS_CAMBIO`, `BD_ANTIGUA`)
  se resuelven desde v0.8.3 con `_resolverNombreHoja` en `00_Config.js`. La hoja
  real de entrada se llama `Cargas` (no `Hoja de Cargas`), y el scanner registró
  `Tipos de Cambio` y `BD Antigua` con mayúscula.
- `DEBUG Mirada` la crea a demanda `diagnosticarMiradaInteranual()`. Es efímera:
  si aparece en un escaneo, es un residuo de diagnóstico, no arquitectura.
- **PENDIENTE:** hojas creadas, renombradas, ocultadas o borradas entre 2026-03-23
  y hoy. `Mirada Interanual` es la única que sabemos con certeza que falta en el
  snapshot. El escaneo fresco itera `ss.getSheets()`, así que descubre todo lo
  demás por sí solo.
- **GIDs.** El snapshot de marzo **no** los trae (el scanner viejo no exportaba
  `sheetId`), así que ninguno está confirmado contra el JSON. Los que hay están en
  `MAPA_HOJAS.md` (mapeados a mano el 2026-06-05): Inicio `306858729`, Tablero
  `201314967`, Cargas `1889618311`, Plan de Cuentas `738279722`, CALCU `367882887`,
  ANUAL `1358411018`, DATA-ENTRY `1849033622`. Los de `Registros` y `Tipos de Cambio`
  figuran ahí como "pendiente de re-mapeo", dentro de una nota de migración que
  describe el layout v0.9.x que nunca se desplegó: **no tratarlos como confirmados**.
  El scanner v0.8.4 **sí** exporta `meta.gid` por hoja, así que el primer escaneo de
  cobertura total salda esta deuda entera.

---

## 3. Capa de datos — layout real (producción v0.8.3)

> **PARCIALMENTE SUPERADA por la seccion 12.1.** Lo que esta seccion llama "el layout
> real" describe hoy a las hojas `Registros_legacy` y `Tipos de cambio_legacy`, no a las
> vivas. **Sigue vigente** todo lo de `Plan de Cuentas` (3.3), `Cargas` (3.4) y
> `BD Antigua` (3.5): esas tres hojas no migraron. El layout vivo de `Registros` y
> `Tipos de cambio` esta en 12.1.

Éste es el layout **legacy**, el que existe hoy en la planilla y el que declara
`RANGES` en `00_Config.js`. El layout B:M de los commits v0.9.2-v0.9.4 **nunca se
desplegó**: no asumirlo jamás, aunque `MAPA_HOJAS.md` y `CONTEXTO_DATOS.md` todavía
lo describan. Ante contradicción, gana la sección 4 de `CLAUDE.md`.

### 3.1 Registros (ledger, columnas I:T)

Escrita por `06_RegistrosService.js`. Ordenada por fecha descendente al final de
cada `procesarCargas()` (`sort` por la columna 15 de la hoja, que es `O` = Fecha).

| Col | Campo | Notas |
|---|---|---|
| I | Monto | siempre positivo; el signo lo pone el `Tipo` |
| J | Tipo | `Ingreso` / `Egreso` |
| K | Cuenta | FK al Plan de Cuentas. Valores especiales: `Traspaso` (visible en el snapshot, `K4`/`K5`) e `Inicio Mes` (no aparece en las 44 celdas del snapshot, pero lo filtran explícitamente `W4`, `Z4`, `AC4` y `U17` del Tablero) |
| L | Tipo de Cuenta | deducido contra los catálogos: `Ingreso` / `Gasto Fijo` / `Gasto Variable`. Queda **vacío** en las filas de `Traspaso` (verificado: `L4` y `L5` no existen en el snapshot) |
| M | Medio | FK a MEDIOS_PAGO |
| N | Moneda | `ARS` / `USD` / `AUD` / `EUR` |
| O | Fecha | congelada al procesar |
| P | Nota | texto libre |
| Q | TC ARS | congelado (siempre 1) |
| R | TC USD | congelado, ARS por 1 USD |
| S | TC AUD | congelado, ARS por 1 AUD |
| T | TC EUR | congelado, ARS por 1 EUR |

Los cuatro TC son **ARS por unidad de la moneda**. El patrón de conversión de toda
la planilla es `monto * tc_de_su_moneda / tc_de_la_moneda_elegida`, con `1` para ARS.

**Disputa de filas — CRÍTICO y todavía abierta.** `00_Config.js` declara
`HEADER_ROW = 3` / `DATA_START_ROW = 4` como globales, pero la evidencia dice otra cosa:

- el snapshot del 2026-03-23 tiene los rótulos en la fila 2 (`I2 = "Monto"` …
  `P2 = "Nota"`) y el primer dato en la fila 3 (`I3 = 567974`, `Q3 = 1`, `R3 = 1415`);
- `07_MiradaInteranual.js` lee `Registros!$O$3:$O$5000`;
- `procesarCargas()` appendea con `appendMassive('REGISTROS', …, 2)` y ordena desde la fila 2;
- las QUERY de `Inicio` y `Tablero` leen `Registros!I2:T` con el parámetro de
  encabezados en `0` (le dicen a QUERY que la fila 2 NO es header y la tratan como dato).

Regla operativa vigente: **toda fórmula o rango nuevo sobre `Registros` arranca en
la fila 3**. Los globales `HEADER_ROW`/`DATA_START_ROW` valen para Plan de Cuentas y
Tipos de Cambio, no para Registros.

**Esto lo cierra el primer escaneo de cobertura total**, y de forma trivial: con
todas las celdas volcadas, la fila del header y la primera fila de datos se leen
directo del TSV (receta 6.6). Hasta entonces la disputa queda declarada, no resuelta.

### 3.2 Tipos de Cambio (data lake, bloques con offset)

Header fila 3, datos desde fila 4. Cada bloque es un par (Fecha, Cotización) con
título en la fila 2.

| Par | Columnas | Título en fila 2 |
|---|---|---|
| TC_ARS | I:J | `Peso Argentino.` |
| TC_USD | L:M | `Dólar Estaudonidense.` (sic, con el typo en la planilla) |
| TC_AUD | O:P | `Dólar Australiano.` |
| TC_EUR | R:S | `Euro.` |

Los bloques se ordenan por fecha descendente después de cada inserción batch
(`appendMassive` con `minRow = 4`). ARS es la moneda base: su cotización es siempre 1
(`J4 = 1`, `J5 = 1` en el snapshot).

### 3.3 Plan de Cuentas (catálogo maestro)

Header fila 3, datos desde fila 4. Títulos de bloque en la fila 2. Offset
estructural vigente (ADR-005).

| Tabla | Columnas | Campos | Título fila 2 |
|---|---|---|---|
| INGRESOS | I:J | nombre, proyecto | `Ingresos. ` (con espacio final — cuidado al grepear exacto) |
| GASTOS_FIJOS | L:M | nombre, proyecto | `Gastos Fijos.` |
| GASTOS_VARIABLES | O:P | nombre, proyecto | `Gastos Variables.` |
| MEDIOS_PAGO | R:T | nombre, moneda, proyecto | `Medios Bancarios.` |
| PROYECTOS | V:W | nombre, tipo | `Proyectos.` |

Tipos de proyecto: `CLAUDE.md` declara `Liquidez` / `Ahorro` / `Inversion`. El
snapshot sólo muestra dos filas del bloque (`W4 = Ahorro`, `W5 = Financiación`), y
las fórmulas del Tablero comparan contra `"Liquidez"` (`U4:U7`, `U17`, `AJ10` lo
excluyen; `W4`, `Z4`, `AC4` lo usan en el WHERE de sus QUERY).
O sea: `Ahorro`, `Financiación` y `Liquidez` están confirmados; `Inversion` viene
de `CLAUDE.md` y **no** está confirmado contra la planilla. Pendiente del escaneo
de cobertura total, que trae el bloque `V:W` entero.

**Columna auxiliar `Y` (`Categorias.`)** — `Y4` consolida las cuatro tablas de
cuentas en una lista plana, que alimenta las validaciones de datos de `Cargas`:

```excel
=ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L;O4:O;R4:R}); "select * where Col1 is not null"))
```

Consecuencia operativa: **no insertar ni mover columnas en esta hoja.** Los bloques
están mapeados posicionalmente en `RANGES` (`00_Config.js`), en `Y4`, y en 13 celdas
del `Tablero` que suman 25 referencias a `'Plan de Cuentas'!R:T` y `!V:W`
(`S4:S7`, `U4:U7`, `W4`, `Z4`, `AC4`, `AJ10`, `U17` — conteo verificado en el JSON).

`R:T` y `V:W` forman la cadena relacional que usa todo el Tablero:
`Medio -> Proyecto` (VLOOKUP sobre `R:T`, columna 3) y `Proyecto -> Tipo de proyecto`
(VLOOKUP sobre `V:W`, columna 2). Los VLOOKUP están envueltos en `IFERROR(…; "")` y
los filtros exigen `proyecto <> ""` o `= "Medio Cotidiano"`: leído de las fórmulas,
un medio de pago sin proyecto asignado queda fuera de los KPIs de liquidez y del
portafolio.

### 3.4 Cargas (data entry)

Headers en la fila 4, datos desde la fila 5. El usuario escribe en `I5:O19`
(`06_RegistrosService.js` lee exactamente ese rango).

| Col | Campo |
|---|---|
| I | Monto |
| J | Tipo |
| K | Cuenta |
| L | Medio |
| M | Moneda |
| N | Fecha (autocompletada por `appOnEdit`) |
| O | Nota |

Bloque de sólo lectura a la derecha: título en `R2` (`Últimos 15 movimientos.`),
encabezados `R4:X4` (`Monto`, `Tipo`, `Cuenta`, `Medio`, `Moneda`, `Fecha`, `Nota`),
y la fórmula en `R5`:

```excel
=IFERROR(QUERY({Registros!I2:T}; "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15"; 0); "")
```

Gap de validación conocido: el filtro real de `procesarCargas()` es sólo "Monto no
vacío". Una fila con monto y sin cuenta/medio se procesa igual, con `Tipo de Cuenta`
vacío.

### 3.5 BD Antigua (histórico)

Header en la fila 1, datos desde la fila 2: `Fecha`, `Ingreso`, `Egreso`, `Detalle`,
`Medio`, `Tipo`, `Observacion`, `Cuentas Faltantes`. Formato plano (ingreso y egreso
en columnas separadas, sin moneda ni TC). Sólo lectura salvo por `99_MigrationLogic.js`.

---

## 4. Capa de vistas y motores

> **SUPERADA en los detalles por las secciones 12 y 13.** El patron de tres capas que
> describe abajo **sigue siendo correcto y es la clave para entender la planilla**. Lo
> que cambio son los rangos (las QUERY de staging leen `Registros!B5:M`, no `I2:T`) y
> varias formulas puntuales: en marzo `S13 = X2*1,3`, hoy `S13` es una **constante
> tipeada** (seccion 14.2); `T22:T24` cambio de algoritmo (14.3). Los conteos de celdas
> y de formulas vigentes estan en la seccion 13.1.

El patrón es siempre el mismo, y es el mismo que el de `planilla-pymes`:

1. **Celdas de control** que el usuario edita (mes, año, moneda).
2. **Bloque de staging** en columnas lejanas a la derecha: una QUERY que trae el
   recorte del período desde `Registros`, más una columna calculada de conversión
   a la moneda elegida.
3. **KPIs visibles** que suman sobre el staging, nunca sobre `Registros` directo.

### 4.1 Inicio

- **Staging mes actual `Y4:AK`** — `Y4` es un `LET` que resuelve el rango de fechas
  del mes desde `P4`/`P6` y hace `QUERY(Registros!I2:T; "SELECT * WHERE Col7 >= date … AND Col7 <= date …"; 0)`.
  El mapeo es posicional (SELECT *): `Y`=Monto, `Z`=Tipo, `AA`=Cuenta,
  `AB`=Tipo de Cuenta, `AC`=Medio, `AD`=Moneda, `AE`=Fecha, `AF`=Nota,
  `AG`=TC ARS, `AH`=TC USD, `AI`=TC AUD, `AJ`=TC EUR (rótulos confirmados en `AA3:AJ3`).
- **Columna calculada `AK`**: `AK3` es el rótulo (`="Valor en " & P9`) y `AK4` la
  `ARRAYFORMULA` que convierte a la moneda elegida. Ojo: `AK4` tiene un defecto de
  conversión (anomalía 5).
- **Staging mes anterior `AM4:AX`** — idéntico, con `mes_num - 1`. Alimenta las
  variaciones porcentuales `I12` / `L12`, que eligen la columna de TC con
  `SWITCH(P9; "ARS";9; "USD";10; "AUD";11; "EUR";12)` sobre `CHOOSECOLS(AM4:AX; …)`.
- **KPIs:** `I10 = SUMIFS(AK4:AK; Z4:Z; "Ingreso"; AA4:AA; "<>Traspaso")` (ingresos
  del mes), `L10` (ídem con `"Egreso"`), `I6 = I10-L10`, `L6 = L10-O10`. Calendario
  en `P13` (`SEQUENCE(6;7; DATEVALUE(P4 & " 1 " & P6) - WEEKDAY(…) + 1)`).
- `I11`, `L11` y `O10` los leen `I12`, `L12` y `L6`, pero **no figuran en el
  snapshot**: son celdas de valor o de fórmula que el filtro viejo descartó.
  Pendientes de confirmar en el primer escaneo de cobertura total.

### 4.2 Tablero

- **Staging `AN4:AZ`** — mismo patrón que Inicio: `AN4` es el `LET` + `QUERY` sobre
  `Registros!I2:T` filtrado por el mes de `I4`/`I6`. Mapeo posicional: `AN`=Monto,
  `AO`=Tipo, `AP`=Cuenta, `AQ`=Tipo de Cuenta, `AR`=Medio, `AS`=Moneda, `AT`=Fecha,
  `AU`=Nota, `AV`=TC ARS, `AW`=TC USD, `AX`=TC AUD, `AY`=TC EUR.
- **`AZ4`** = monto convertido a la moneda de `I9` (usa `AS`, la moneda: correcto).
  `AZ3` es el rótulo (`="Valor en " & I9`).
- **Cotizaciones `AL4:AL6`** = `tidetrack_usd()`, `tidetrack_AUD()`, `tidetrack_EUR()`,
  las custom functions de `15_ExchangeRateApi.js`. Son el único punto de la planilla
  que llama a las APIs desde una fórmula; todo lo demás usa TC congelados.
- **Liquidez `S4:S7`** (una fila por moneda, rotuladas en `Q4:Q7`): suma neta
  filtrando los medios cuyo proyecto es `Medio Cotidiano`. La moneda va escrita en
  cada fórmula (`AS4:AS="ARS"` en `S4`, `"USD"` en `S5`, `"AUD"` en `S6`, `"EUR"` en `S7`).
  **Riqueza `U4:U7`**: mismo patrón, filtrando por `tipo_proyecto <> "Liquidez"` y `<> ""`.
- **Listas Pareto:** `W4` (ingresos), `Z4` (gastos fijos), `AC4` (gastos variables) —
  QUERY sobre un array armado en memoria desde el staging, con doble VLOOKUP contra
  el Plan de Cuentas, agrupado por cuenta y ordenado descendente. Los totales
  `X2 = SUM(X4:X22)`, `AA2 = SUM(AA4:AA22)` y `AD2 = SUM(AD4:AD22)`.
- **Presupuesto teórico:** `S13 = X2*1,3`, `S14 = AA2*2`, `S15 = AD2` (multiplicadores
  fijos escritos en la fórmula, no parametrizados). El real es `U13 = X2`, `U14 = AA2`,
  `U15 = AD2`, y los ratios de cumplimiento están en `S22` (`U17 / (S13-S14-S15)`),
  `S23` (`U14/S14`) y `S24` (`U15/S15`).
- **Medios bancarios `AF4`**: QUERY agrupada por medio (`AR`) y moneda (`AS`).
- **Portafolio de proyectos `AJ10`**: `LET` que cruza medio -> proyecto -> tipo,
  convierte con `AL4:AL6` y agrupa por proyecto.
- **Comprobación de traspasos `I21`**: ingresos por `Traspaso` menos egresos por
  `Traspaso`; devuelve `"Traspasos balanceados"` si la diferencia redondeada da cero.
  Es el control de integridad del ledger.
- **Calendario `I13`**: `SEQUENCE(6;7; DATEVALUE(I4 & " 1 " & I6) - WEEKDAY(…) + 1)`.

### 4.3 Mirada Interanual

La única vista cuyas fórmulas **las escribe el código**, no el usuario:
`inicializarMiradaInteranual()` en `07_MiradaInteranual.js`.

- Rango escrito: **`G10:R12` (36 celdas)** — Ingresos / Gastos Fijos / Gastos
  Variables por mes — y **`G14:R14` (12 celdas)** — Resultado = `=<col>10-<col>11-<col>12`.
  Total 48 celdas, de las cuales sólo las 36 de `G10:R12` leen `Registros`; las 12
  de la fila 14 son una resta entre celdas de la propia hoja.
- `K` es el mes de referencia (offset 0); `G` es mes-4 y `R` es mes+7 (cita literal
  del JSDoc del módulo).
- Lee `Registros` filas 3:5000, columnas `O` (fecha), `I` (monto), `L` (tipo de
  cuenta), `N` (moneda), `R`/`S`/`T` (TC USD/AUD/EUR).
- No usa staging: cada celda de `G10:R12` es un `SUMPRODUCT` sobre `Registros`
  directo. Son **36 celdas leyendo 5.000 filas cada una** — si algún día la vista se
  pone lenta, la causa es ésta y la solución es un staging como el de Tablero.
- **Trampa de locale documentada en el módulo:** la planilla está en español
  (separador `;`), así que las fórmulas se construyen en sintaxis en-US y con
  `SPLIT` de un string en vez de arrays literales `{…}`, que `setFormula` no
  traduce y rompen con "Error de análisis de fórmula".

### 4.4 CALCU (motor mensual, oculto)

- **Calendario:** `H2 = DATEVALUE(B3&" 1 "&G3)` y `B5 = SEQUENCE(6;7;H2-WEEKDAY(H2;1)+1)`.
- **Tres bloques de cuentas**, con el título en la fila 2 y el rótulo de cuenta en
  la primera columna de cada bloque: INGRESOS (`K2`, rótulos en `K`, importes en `M`),
  GASTOS FIJOS (`P2` — el valor real es `'GASTOS FIJOS '`, con espacio final —,
  rótulos en `P`, importes en `R`), GASTOS VARIABLES (`U2`, rótulos en `U`, importes
  en `W`). Los importes son `SUMIFS` sobre las columnas `AC` (ingresos) y `AD`
  (egresos) del staging, criteriando por `AE` o por `AG`:
  `M3:M11` = `SUMIFS($AC:$AC;$AE:$AE;K_n) - SUMIFS($AD:$AD;$AE:$AE;K_n)`;
  `R3:R32` y `W3:W32` = la misma resta invertida (`$AD` menos `$AC`), siempre con `$AE:$AE`;
  `M12:M32` = un solo `SUMIFS(AC:AC;AG:AG;K_n)`, criteriando por `AG` en vez de `AE`.
  **Los rótulos de cuenta (`K3:K32`, `P3:P32`, `U3:U32`) están vacíos en el snapshot**,
  así que todos esos `SUMIFS` criterian contra celdas vacías.
- **Totales y resumen:** `M2`, `N2`, `R2`, `S2`, `W2`, `X2` son las sumas de cada
  columna; `F14 = M2`, `F16 = R2`, `F17 = W2`, `F18 = F14-F16-F17` y su espejo
  `F22 = N2`, `F24 = S2`, `F25 = X2`, `F26 = F22-F24-F25`, con los ratios en `E16:E18`
  y `E24:E26`.
- **Staging:** `AB3 = QUERY('R CAR'!A:H; AB2)`, con `AB2` armando el WHERE del mes
  según `B3`. **`'R CAR'` no existe en el snapshot** (sección 9).

### 4.5 ANUAL (motor anual, oculto)

Matriz mes x cuenta. `A1` = año (`2026`), `B1:M1` = los doce meses en mayúsculas,
columna `A` = etiquetas de cuenta, cuerpo = **840 celdas** (70 filas x 12 meses) con
dos `SUMIFS` restados cada una — 1.680 ocurrencias del token en total. Forma verbatim
de `B22`:

```excel
=SUMIFS($Q:$Q;$S:$S;A22;$P:$P;">="&DATE($A$1;1;1);$P:$P;"<="&DATE($A$1;1;31)) - SUMIFS($R:$R;$S:$S;A22;$P:$P;">="&DATE($A$1;1;1);$P:$P;"<="&DATE($A$1;1;31))
```

**Tres bloques de cuentas**, cada uno con sus etiquetas traídas de `LISTAS` y su fila
de totales (todos verificados celda por celda contra el JSON):

| Bloque | Filas del cuerpo | Etiquetas en `A` | Fuente | Fila de totales |
|---|---|---|---|---|
| 1 | 22-31 (10 filas) | `A22:A31` | `=LISTAS!F2` … `=LISTAS!F11` | `B32:M32` = `SUM(B22:B31)` |
| 2 | 35-64 (30 filas) | `A35:A64` | `=LISTAS!H2` … `=LISTAS!H31` | `B65:M65` = `SUM(B35:B64)` |
| 3 | 68-97 (30 filas) | `A68:A97` | `=LISTAS!N2` … `=LISTAS!N31` | `B98:M98` = `SUM(B68:B97)` |

10 + 30 + 30 = **70 referencias a `LISTAS`**, que es exactamente lo que devuelve
`grep -c 'LISTAS!' docs/permanente/celdas.tsv`.

**Resumen `A2:M10`:** `A2 = "RESUMEN ANUAL RESULTADOS"`; `A3 = "Ingresos"` con
`B3:M3 = =B32` (total del bloque 1); `A4 = "Gastos Fijos"` con `B4:M4 = =B65*-1`
(total del bloque 2); fila 6 = `=B3-B4`; fila 8 = `=B98*-1` (total del bloque 3);
fila 10 = `=B6-B8`. **Las filas 6, 8 y 10 no tienen rótulo en la columna `A` en el
snapshot**, así que la lectura "bloque 3 = gastos variables" es una inferencia por
posición (es el tercer bloque y se resta después de los fijos), no un dato leído.
Sueltas: `B15`, `B16`, `B17` = `=1/3`.

**Staging `P:V`**, alimentado por `P1 = QUERY('R CAR'!A:G)` (7 columnas volcadas
desde `P`). El mapeo de columnas se **infiere del uso** en los `SUMIFS`: `$P` = fecha,
`$Q` = ingreso, `$R` = egreso, `$S` = cuenta — coherente con el layout de `BD Antigua`
(`Fecha`, `Ingreso`, `Egreso`, `Detalle`, …), que probablemente era el formato de
`'R CAR'`. No hay forma de confirmarlo mientras la hoja no exista.

**Ni `'R CAR'` ni `LISTAS` existen en el snapshot**, y `P1` figura como `#REF!` en el
campo `encabezados` de la hoja: el motor está roto de raíz (sección 9).

---

## 5. Celdas de control conocidas

> **CONFIRMADA y ampliada por la seccion 12.3.** Las seis celdas que esta seccion daba
> por inferidas (`Inicio!P6`, `P9`, `Tablero!I6`, `I9`, `Q6`, `Q7`) quedaron **leidas y
> confirmadas**. Se agregan tres controles que faltaban: `Tablero!S13:S15` (el
> presupuesto, hoy tipeado a mano) y `Mirada Interanual!N4` (selector de Proyecto que
> ninguna formula lee). Valores vigentes en 12.3.

Son las celdas que el usuario edita y que cambian lo que ve toda una hoja. Antes de
tocar cualquier fórmula, verificar de qué control depende. La columna "quién la lee"
está sacada de las fórmulas del snapshot, salvo la de Mirada Interanual, que sale de
`src/07_MiradaInteranual.js`.

| Hoja | Celda | Rol | Valores | Quién la lee |
|---|---|---|---|---|
| Inicio | `P4` | Mes | `Enero`..`Diciembre` (capitalizado) | `Y4`, `AM4` (vía `MATCH` sobre `SPLIT`), `P13` |
| Inicio | `P6` | Año | número | `Y4`, `AM4`, `P13` (calendario) |
| Inicio | `P9` | Moneda de la vista | `ARS`/`USD`/`AUD`/`EUR` | `AK3` (rótulo), `AK4` (conversión), `I12`, `L12` |
| Tablero | `I4` | Mes | `Enero`..`Diciembre` | `AN4`, `I13` (calendario) |
| Tablero | `I6` | Año | número | `AN4`, `I13` |
| Tablero | `I9` | Moneda de la vista | `ARS`/`USD`/`AUD`/`EUR` | `AZ3` (rótulo), `AZ4` (conversión), `AJ10`, `U17`, `T22`, `T23`, `T24` |
| Mirada Interanual | `E4` | Mes | `ENERO`..`DICIEMBRE` (mayúsculas) | las 36 fórmulas de `G10:R12` |
| Mirada Interanual | `F4` | Año | número | ídem |
| Mirada Interanual | `R4` | Moneda de la vista | `ARS`/`USD`/`AUD`/`EUR` | ídem |
| CALCU | `B3` | Mes | `ENERO`..`DICIEMBRE` (mayúsculas) | `H2`, `AB2` (armado del WHERE) |
| CALCU | `G3` | Año | número | `H2`, `AB2` |
| Cargas | `I5:O19` | Lote de entrada | — | `procesarCargas()`, `appOnEdit` |
| Tablero | `Q4:Q7` | Rótulos de moneda de la tabla de saldos | `ARS`/`USD`/`AUD`/`EUR` | nadie: son rótulos. Los filtros de `S4:S7` tienen la moneda escrita adentro de la fórmula |

Cuidado con el formato del mes: **`Inicio` y `Tablero` usan capitalizado
(`Marzo`), `Mirada Interanual` y `CALCU` usan mayúsculas (`MARZO`)**. Son listas
distintas dentro de fórmulas distintas; un `MATCH` que no encuentra devuelve `#N/A`
y tumba la vista entera.

**Qué de esta tabla NO está en el snapshot de marzo** (o sea, está inferido de las
fórmulas que lo leen, no leído): `Inicio!P6`, `Inicio!P9`, `Tablero!I6`, `Tablero!I9`,
`Tablero!Q6` y `Tablero!Q7`. Las seis son celdas de valor **por debajo de la fila 5**,
exactamente lo que el filtro del scanner viejo descartaba (`Q6`/`Q7` se deducen de los
filtros de `S6` y `S7`, que traen `AUD` y `EUR`).
Lo que sí está confirmado en el snapshot: `Inicio!P4 = "Marzo"`,
`Tablero!I4 = "Marzo"`, `Tablero!Q4 = "ARS"`, `Tablero!Q5 = "USD"`, `CALCU!B3 = "ENERO"`,
`CALCU!G3 = 2026`. El escaneo de cobertura total trae las inferidas con su valor real
y de paso confirma o desmiente la lista completa de esta sección.

---

## 6. Recetas para tareas frecuentes

**Antes de nada, confirmar con qué formato se está trabajando:**

```bash
head -1 docs/permanente/celdas.tsv        # cabecera: orden de columnas
cat  docs/permanente/celdas.tsv.meta      # procedencia y formato_celda
```

El orden lo declara `CABECERA` en `devtools/generar_tsv_celdas.py`: hoy es
`hoja  celda  formula  valor` — o sea **1 = hoja, 2 = celda, 3 = fórmula, 4 = valor** —
y las recetas de abajo usan esos índices.

Qué hay realmente en la columna 4, según el generador: **el valor mostrado cuando el
snapshot lo trae, y el crudo cuando no.** Traducido a los dos formatos de la sección 1.1:

- **snapshot viejo** (el único versionado hoy): las celdas con fórmula tienen la
  columna 4 **vacía**, sin excepción — 1.205 de 1.205;
- **snapshot v0.8.4 o posterior**: la columna 4 trae el resultado calculado y los
  errores de runtime (`#REF!`, `#N/A`, `#DIV/0!`).

`celdas.tsv.meta` dice cuál de los dos es, en el campo `formato_celda`.

Un detalle más que importa al grepear: **una celda = una línea**. Los saltos de línea
de las fórmulas multilínea vienen escapados como `\n` literal, así que un `grep` nunca
parte una fórmula por la mitad.

Los comandos se corren desde la raíz del repo.

### 6.1 "¿Dónde está X?"

```bash
# buscar un rótulo o un nombre de cuenta en toda la planilla
grep -i 'riqueza' docs/permanente/celdas.tsv

# todo lo que hay en una hoja
awk -F'\t' '$1 == "Tablero"' docs/permanente/celdas.tsv | less
```

### 6.2 Todas las fórmulas que leen `Registros`

```bash
awk -F'\t' '$3 ~ /Registros!/ {print $1 "!" $2 "\t" $3}' docs/permanente/celdas.tsv
```

Para cualquier otra hoja, cambiar el patrón (`'Plan de Cuentas'!`, `CALCU!`, …).
Ojo: las hojas con espacio en el nombre se referencian entre comillas simples en la
fórmula, por eso el patrón útil es `Plan de Cuentas` sin el `!`.

### 6.3 Matriz de dependencias (quién lee a quién)

```bash
awk -F'\t' 'NR>1 && $3 ~ /Plan de Cuentas/ {c[$1]++} END {for (h in c) print c[h], h}' \
  docs/permanente/celdas.tsv | sort -rn
```

Con el snapshot de marzo devuelve una sola línea: `13 Tablero`.

El inventario mecánico ya trae esta matriz completa en su sección 2 ("Dependencias
entre hojas"), y el detalle por hoja en la sección 3; el comando de arriba sirve
para una consulta puntual sin abrirlo.

### 6.4 ¿Esta celda es fórmula o valor?

```bash
# celda de valor: devuelve  formula=[]  valor=[Marzo]
awk -F'\t' '$1=="Tablero" && $2=="I4" {print "formula=[" $3 "]  valor=[" $4 "]"}' \
  docs/permanente/celdas.tsv

# celda de formula: devuelve  formula=[=X2*1,3]  valor=[]
awk -F'\t' '$1=="Tablero" && $2=="S13" {print "formula=[" $3 "]  valor=[" $4 "]"}' \
  docs/permanente/celdas.tsv
```

Cómo leer el resultado, según el contrato de la sección 1.1:

- Si `formula` está vacía, lo que se ve en `valor` es lo que hay escrito a mano.
- Si `formula` tiene contenido y `valor` viene **vacío**, hay que mirar
  `celdas.tsv.meta` antes de concluir nada: con el snapshot viejo eso es lo esperado
  (el JSON guarda `null` en el campo `valor` de toda celda con fórmula, y el resultado
  calculado **no está en ninguna parte**); con un snapshot v0.8.4 en adelante, un
  vacío ahí significa que la fórmula efectivamente no muestra nada.
- Salida vacía (cero líneas) significa que **esa celda no está en el snapshot**, no
  que esté vacía en la planilla. El scanner viejo sólo trajo fórmulas y las primeras
  5 filas de valores, así que faltan casi todas las celdas de valor de abajo.

### 6.5 Buscar referencias rotas

```bash
grep -n '#REF!' docs/permanente/celdas.tsv
```

Con el snapshot de marzo devuelve exactamente 7 líneas: `Inicio!D692`, `D693`, `D694`;
`Tablero!D706`, `D707`; `Cargas!D708`; y `Bocetos!AH2`. Son los `#REF!` que quedaron
escritos **dentro del texto de la fórmula** (columna 3). Los errores *resultantes*
(`#N/A` de un VLOOKUP, `#DIV/0!`, un `#REF!` que se propaga) no están en ese snapshot:
viven en `valor_mostrado`, que el formato viejo no tiene (sección 1.1). Con un snapshot
v0.8.4 en adelante aparecen en la columna 4 y este mismo grep los encuentra. Para hojas
fantasma, buscar el nombre:

```bash
grep -c "'R CAR'" docs/permanente/celdas.tsv   # 4
grep -c 'LISTAS!'  docs/permanente/celdas.tsv  # 70
```

### 6.6 Cerrar la disputa de filas de `Registros`

```bash
awk -F'\t' '$1=="Registros" && $2 ~ /^[A-Z]+[1-6]$/ {print $2 "\t" $3 "\t" $4}' \
  docs/permanente/celdas.tsv | sort
```

Ya con el snapshot de marzo se ve el header en la fila 2 (`I2  Monto`, `J2  Tipo`, …)
y el primer dato en la fila 3 (`I3  567974`). Con el snapshot de cobertura total la
evidencia queda completa y hay que corregir `00_Config.js` (o documentar por qué el
global no aplica a esta hoja).

### 6.7 Cuántas celdas trae el snapshot por hoja (sin abrir el JSON)

```bash
python3 -c "
import json
d = json.load(open('docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json'))
for n, h in d['hojas'].items():
    m = h['meta']
    print(f\"{n:24} {m.get('celdas_con_dato', len(h['mapa_celdas'])):7}  filas={m['filas_totales']:6}  {'oculta' if m['es_oculta'] else ''}\")
"
```

El `.get('celdas_con_dato', …)` con fallback es a propósito: el snapshot viejo no
trae ese campo del `meta`.

### 6.8 Prueba de no-daño después de un cambio

El criterio de éxito **no es "quedó bien"**, es: *cero fórmulas modificadas fuera de
lo esperado, y las celdas que desaparecieron son exactamente las esperadas, sin resto.*

El procedimiento completo (con el paso de preservar el snapshot anterior, que es el
que hace posible el diff) es el de la **sección 7**: seguirlo entero. Lo que agrega
esta receta es el diff crudo de respaldo sobre el TSV, por si el diff estructural
deja algo afuera:

```bash
diff <(sort /tmp/celdas_anterior_AAAA-MM-DD.tsv) <(sort docs/permanente/celdas.tsv) | head -60
```

Toda diferencia se justifica una por una antes de commitear. Una diferencia que
nadie puede explicar es un defecto, no ruido.

### 6.9 Antes de tocar el Plan de Cuentas

No insertar ni mover columnas. Verificar el impacto primero:

```bash
awk -F'\t' '$3 ~ /Plan de Cuentas/ {print $1 "!" $2 "\t" $3}' docs/permanente/celdas.tsv
grep -n "PLAN_CUENTAS" src/00_Config.js
```

Un alta o baja de filas dentro de un bloque es segura (la `Y4` y los VLOOKUP son
por columna completa). Mover un bloque de columna no lo es.

---

## 7. Protocolo de actualización

Ejecutable como checklist, en este orden. Cada vez que la planilla cambia de
estructura o de lógica.

> **decisión Franco 2026-08-13:** el paso 1 (preservar el snapshot vigente) es
> obligatorio y va **antes** de bajar nada. El paso 4 pisa el JSON in situ para que
> el diff de git sea parte de la evidencia; sin la copia previa, el paso 7 se queda
> sin el archivo `viejo` que necesita y la prueba de no-daño no se puede correr.
> Ese era exactamente el agujero de la versión anterior de este protocolo.

**1. Preservar el snapshot vigente** (antes de tocar nada):

```bash
FECHA_ANT=$(date +%Y-%m-%d)
cp docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json /tmp/snapshot_anterior_$FECHA_ANT.json
cp docs/permanente/celdas.tsv                           /tmp/celdas_anterior_$FECHA_ANT.tsv
```

Si el paso se salteó y el JSON ya fue pisado, se recupera del último commit
(sólo funciona si el snapshot pisado estaba commiteado):

```bash
git show HEAD:docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json > /tmp/snapshot_anterior.json
git show HEAD:docs/permanente/celdas.tsv                           > /tmp/celdas_anterior.tsv
```

**2. Re-escanear** desde la planilla: menú `Tidetrack > [DevTools] Exportar Arquitectura`.
Deja el archivo `TIDETRACK_ARQUITECTURA_ESTRICTA.json` en la raíz del Drive del
dueño de la planilla y loguea hojas, celdas con dato, peso en MB, duración, el ID de
Drive y la URL de descarga.

**3. Bajar el JSON** de Drive, usando el ID logueado en el paso 2.

**4. Reemplazarlo** en `docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json`
(mismo nombre, mismo lugar; el diff de git es parte de la evidencia).

**5. Regenerar el inventario mecánico:**

```bash
python3 devtools/generar_inventario_planilla.py
```

**6. Regenerar el TSV** (la misma corrida reescribe `celdas.tsv` y `celdas.tsv.meta`):

```bash
python3 devtools/generar_tsv_celdas.py
```

**7. Correr el diff** contra el snapshot que se preservó en el paso 1:

```bash
python3 devtools/diff_snapshots.py /tmp/snapshot_anterior_$FECHA_ANT.json \
  docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json
```

`diff_snapshots.py` toma dos argumentos posicionales, **viejo primero**. Exit codes:
`0` = ninguna fórmula modificada ni eliminada (los cambios de valor y las celdas
nuevas no bloquean), `1` = hay fórmulas modificadas o eliminadas y hace falta
confirmación humana, `2` = error de uso (archivo inexistente, JSON inválido).
Justificar cada diferencia, una por una.

**8. Diff crudo de respaldo** sobre el TSV, por si el estructural deja algo afuera
(receta 6.8):

```bash
diff <(sort /tmp/celdas_anterior_$FECHA_ANT.tsv) <(sort docs/permanente/celdas.tsv) | head -60
```

**9. Si cambió la LÓGICA** (hoja nueva, control nuevo, staging movido, BD con
columnas distintas), **actualizar este mapa a mano**. Es el único de los cinco
artefactos que no se regenera solo. Toda afirmación nueva se verifica contra el JSON
antes de escribirla.

**10. Commitear los artefactos juntos**, en un solo commit
(`docs(arnes): re-escaneo AAAA-MM-DD …`): JSON + `INVENTARIO_CELDAS.md` + `celdas.tsv`
+ `celdas.tsv.meta` + este mapa. Un snapshot sin sus derivados es peor que no tener
snapshot: parece fresco y no lo es.

Desde la Fase 3 del arnés, los pasos 2 a 4 los hace un workflow de n8n. **La instancia
y sus reglas las fija `ARNES_TIDETRACK.md` seccion 5 — no se duplica el dato acá.** Al
2026-08-13 es la instancia de CLIENTES Tidetrack (decision Franco que revierte la
indicacion original del arnes), con etiquetado obligatorio de todo workflow. El scanner
de Apps Script queda como método manual de respaldo y para el diff de no-daño.

---

## 8. Limitaciones conocidas

Qué **no** ve el gemelo, y por qué no hay que pedirle lo que no tiene:

1. **Validaciones de datos (dropdowns).** El scanner no llama a
   `getDataValidations()`. Los dropdowns de `Cargas` se infieren de la columna `Y`
   del Plan de Cuentas, no del JSON. Si algún día hacen falta, se agregan como
   dimensión propia con una extracción masiva más, nunca celda por celda.
2. **El snapshot viejo está ciego al resultado calculado de toda celda con fórmula**
   (sección 1.1). Es la limitación más importante hoy, porque el único snapshot
   versionado es de ese formato: `Tablero`, `CALCU`, `ANUAL` e `Inicio` no tienen un
   solo número en él. El primer escaneo con el scanner v0.8.4 la cierra vía
   `valor_mostrado`.
3. **`errorValue` tipado.** Ni el scanner viejo ni el v0.8.4 traen el tipo de error
   de la API. Con `valor_mostrado`, los `#REF!`/`#N/A`/`#DIV/0!` resultantes sí se
   ven, pero como **texto**: el análisis no distingue un error real de una celda que
   contiene literalmente esa cadena. Con el snapshot viejo ni siquiera eso (receta 6.5).
4. **Origen de las celdas de spill de `ARRAYFORMULA`.** `getFormulas()` devuelve `''`
   en las celdas que una ARRAYFORMULA llena, así que se serializan como valores
   literales, indistinguibles de datos tipeados a mano. Afecta al bloque
   `Categorias` del Plan de Cuentas y a los staging de `Inicio` y `Tablero`.
5. **GIDs / `sheetId`.** El snapshot de marzo no los trae, así que ninguno está
   confirmado contra el JSON y `MAPA_HOJAS.md` es hoy la única fuente. El scanner
   v0.8.4 sí exporta `meta.gid` por hoja: la limitación desaparece con el primer
   escaneo de cobertura total.
6. **Rangos protegidos, gráficos, imágenes, filtros, notas y comentarios.** Del
   formato condicional sólo se cuenta la cantidad de reglas por hoja
   (`reglas_condicionales_qty`), no su contenido. Una celda con una imagen aparece
   con un valor del tipo `{"valueType": "IMAGE"}` (ejemplo real: `CARGAS (Forest.)!B2`).
7. **Es una foto, no un feed.** Los valores son del día del escaneo; lo estable es
   la estructura. La Fase 3 (n8n) es la que mantiene la foto fresca.
8. **El campo `encabezados` es la fila 1 cruda, no el header semántico.** En esta
   planilla los headers reales viven más abajo (Registros fila 2, Plan de Cuentas
   fila 3, Cargas fila 4). El header semántico lo declara `00_Config.js`.
9. **El JSON no entra entero al contexto de una sesión.** Se consulta por TSV o con
   un `python3 -c` acotado. Con cobertura total sobre 2.879 filas de ledger, cargarlo
   completo es a la vez inútil y caro.
10. **Riesgo de corte a los 6 minutos.** Apps Script corta la ejecución; el scanner
    loguea el progreso por hoja, así que si una corrida muere se sabe dónde. Recién
    ahí tiene sentido evaluar particionar por hoja.

---

## 9. Anomalías observadas en el snapshot del 2026-03-23

> **RESUELTA — el escaneo fresco ya contesto las siete.** Veredicto por anomalia:
> **(1) `'R CAR'` no existe** — CONFIRMADO, sigue rota; el origen esta identificado
> (seccion 12.4). **(2) `LISTAS` no existe** — CONFIRMADO, 71 celdas de `ANUAL` en
> `#REF!`. **(3) motores muertos** — CONFIRMADO y ampliado: no solo estan rotos, **nadie
> los lee** (12.4). **(4) `TABLERO` en mayusculas** — CONFIRMADO, sigue en
> `CARGAS (Forest.)!T4`. **(5) `Inicio!AK4` compara la columna equivocada** — **CORREGIDA
> en la hoja viva** (`AK4` ya usa la columna de moneda), pero el mismo defecto migro al
> bloque del mes anterior: `AY3`/`AY4` apuntan a `AD9`, que esta vacia (13.2). **(6)
> formulas de color huerfanas** — CONFIRMADAS y ahora acotadas: quedan en `Inicio`
> (`D692:D694`) y `Tablero` (`D706:D708`). **(7) presupuesto con multiplicadores fijos**
> — **YA NO**: `S13:S15` son hoy tres numeros tipeados a mano, que es peor (seccion 14.2).
> Se conserva el texto original porque documenta de donde venia cada cosa.

Todas verificables en el JSON, todas **pendientes de confirmar contra el estado
actual** de la planilla. No se corrigen desde este documento: se registran para que
el primer escaneo fresco diga si siguen vivas.

1. **`'R CAR'` no existe.** Cuatro referencias, todas verificadas:
   `CALCU!AB3` (`QUERY('R CAR'!A:H;AB2)`), `ANUAL!P1` (`QUERY('R CAR'!A:G)`),
   `Bocetos!AH3` (`QUERY('R CAR'!A:G;AH2)`) y `CARGAS (Forest.)!T4`
   (`QUERY('R CAR'!A:G;TABLERO!AH2)`). Es el nombre de una hoja de registros de una
   versión anterior de la planilla. Sin ella, el staging de ambos motores ocultos
   está vacío o en `#REF!`.
2. **`LISTAS` no existe.** 70 referencias, todas en `ANUAL`, en tres bloques:
   `A22:A31` desde `LISTAS!F2:F11` (10), `A35:A64` desde `LISTAS!H2:H31` (30) y
   `A68:A97` desde `LISTAS!N2:N31` (30). Son las etiquetas de cuenta de la matriz
   anual (detalle en 4.5).
3. **Consecuencia:** `ANUAL` está roto de punta a punta — sin staging y sin
   etiquetas, sus 840 celdas de `SUMIFS` no calculan nada útil. `CALCU` está en la
   misma situación por el lado del staging, y encima con los rótulos de cuenta de
   `K`/`P`/`U` vacíos. Ambos son motores **legacy** anteriores a la arquitectura
   actual: hoy `Tablero` e `Inicio` arman su propio staging desde `Registros`, y
   `Mirada Interanual` (junio 2026) lee `Registros` directo por código.
   **DECISIÓN PENDIENTE de Franco:** repararlos o retirarlos. Mientras tanto,
   ADR-006 ("Hidden Engines") describe una arquitectura que en la práctica sólo
   `CALCU`/`ANUAL` encarnaban, y que ya no está en uso.
4. **`TABLERO` (mayúsculas) referenciada desde `CARGAS (Forest.)!T4`.** La hoja
   real se llama `Tablero`, y ésa es la única celda de toda la planilla que la
   escribe en mayúsculas. Es otro resto de una versión anterior.
5. **`Inicio!AK4` compara la columna equivocada.** La fórmula elige el tipo de
   cambio de origen con `IF(AA4:AA="ARS"; …)`, pero `AA` es **Cuenta** (`AA3 = "Cuenta"`);
   la moneda está en `AD` (`AD3 = "Moneda"`). Ninguna cuenta se llama "ARS"/"USD"/"AUD"/"EUR",
   así que `tasa_origen` cae siempre al default `1` y todo monto se convierte como si
   estuviera en ARS. El `Tablero` hace lo mismo bien (`AZ4` usa `AS`, que sí es
   Moneda). **Si el escaneo fresco confirma que la fórmula sigue así, es un defecto
   de conversión en la pantalla de Inicio para todo registro no-ARS.**
6. **Fórmulas de color huérfanas**, del tipo `=IF(<ref><0,5; "#a9bca1"; IF(<ref><=0,8; "#db9940"; "#da8b7b"))`,
   copiadas en tríos en 9 de las 15 hojas. **El rango no es el mismo en todas**, así
   que un grep guiado por un solo rango se pierde la mitad:

   | Hoja | Celdas | Estado |
   |---|---|---|
   | `Inicio` | `D692:D694` | las 3 con `#REF!` |
   | `Tablero` | `D706:D708` | `D706` y `D707` con `#REF!`; `D708` apunta a `AH43` |
   | `Cargas` | `D706:D708` | `D708` con `#REF!`; `D706`/`D707` apuntan a `I17`/`I18` |
   | `Plan de Cuentas` | `D706:D708` | sin `#REF!` (apuntan a `J17:J19`, celdas que el snapshot no trae) |
   | `Tipos de Cambio` | `D706:D708` | sin `#REF!` (`J17:J19`) |
   | `Bocetos` | `D706:D708` | sin `#REF!` (`J17:J19`) |
   | `Espacio blanco 1` | `D706:D708` | sin `#REF!` (`J17:J19`) |
   | `Espacio blanco 2` | `D706:D708` | sin `#REF!` (`J17:J19`) |
   | `Registros` | **`D2667:D2669`** | sin `#REF!` (`J17:J19`) — **1.961 filas más abajo que en el resto** |

   Son residuos de un sistema de semáforo de color copiado hoja por hoja. Inofensivas,
   pero ensucian el gemelo y hacen ruido en los diffs. `BD Antigua`, `DATA-ENTRY`,
   `CARGAS (Forest.)`, `CALCU`, `ANUAL` y `PALETAS` no las tienen.
7. **Presupuesto con multiplicadores fijos en el Tablero** (`S13 = X2*1,3`,
   `S14 = AA2*2`): el "presupuesto teórico" no es un dato cargado sino una constante
   dentro de la fórmula. No es un error, es una decisión implícita sin documentar;
   queda anotada acá hasta que se defina el módulo de presupuestación.

---

*Capa semántica del gemelo digital — Fase 2 del arnés. Última revisión a mano:
2026-08-13, sobre el snapshot del 2026-03-23 (scanner viejo, cobertura parcial, sin
`valor_mostrado`). La próxima revisión obligatoria es inmediatamente después del
primer escaneo de cobertura total.*

---

# PARTE II — Escaneo de cobertura total del 2026-08-13

> **[CONCEPTO DE NEGOCIO]** Que hace hoy cada hoja de la planilla, cual sirve al MVP y
> cual es lastre, donde se rompe la cadena de datos, y donde encaja la unica pieza que
> falta para que el producto cumpla su promesa: el **Presupuesto**.
>
> **[FUNDAMENTO TEORICO / ADMINISTRATIVO]** Un plan de cuentas sin presupuesto es
> contabilidad retrospectiva: dice que paso. La promesa de Tidetrack es "paz financiera,
> todos los dias", y eso exige la vista prospectiva — cuanto puedo gastar todavia. El
> motor que reparte el ingreso en Gastos Fijos / Gastos Variables / Ahorro y contrasta
> esa asignacion contra el ledger es lo que convierte el registro en decision.
>
> **@see** secciones 1 a 9 de este mismo archivo (contrato del gemelo, historia y layout
> pre-migracion) · `CLAUDE.md` seccion 4 · `docs/permanente/FORMULAS_TABLERO.md`

**Toda afirmacion de esta Parte II esta verificada contra el volcado del escaneo.** Lo
que no se pudo ver esta declarado en la seccion 15, no inferido en el cuerpo. Cuando
algo es inferencia, se dice que lo es.

---

## 10. El escaneo: metodo, alcance y limites

### 10.1 Como se hizo

Lectura directa de la **Google Sheets API** (`spreadsheets.get` con `includeGridData`),
en cuatro tandas por grupo de hojas, mas una consulta de indice
(`spreadsheets.get` sin grid) para el inventario de pestanas. **No** se uso el scanner
de Apps Script (`98_DevTools_Scanner.js`), asi que este volcado **no** reemplaza al
snapshot JSON versionado ni a sus derivados (`INVENTARIO_CELDAS.md`, `celdas.tsv`): es
una lectura paralela, mas fresca y con mejor cobertura, pero **fuera** del protocolo de
la seccion 7. Cerrar esa brecha — correr el scanner y versionar el JSON — queda
pendiente.

Campos pedidos por celda: **`userEnteredValue` + `formattedValue`**. Es decir: la
formula tal como esta escrita, y el resultado tal como se ve en pantalla. Eso resuelve
de una vez la limitacion 2 de la seccion 8 (el snapshot viejo estaba ciego al resultado
calculado): en este volcado **cada formula viene con su numero**.

### 10.2 Que se leyo, hoja por hoja

| Tanda | Hojas | Rango pedido | Cobertura efectiva |
|---|---|---|---|
| Indice | las 23 | solo `properties` | GID, titulo, filas, columnas, filas/columnas congeladas, oculta si/no. **Completo** |
| A | `Inicio`, `Tablero`, `Cargas`, `Plan de Cuentas`, `Mirada Interanual`, `CALCU` | ancho completo, filas 1-100 / 1-60 segun hoja | completa para el area util de todas |
| B | `ANUAL` | `A1:W200` + muestreos en filas 1000 y 3000 | completa (el contenido termina en la fila 98) |
| C | `Registros`, `Tipos de cambio`, `Registros_legacy`, `Tipos de cambio_legacy`, `BD Antigua` | primeras filas | **solo estructural**: headers y primeras filas de datos |
| D | `Bocetos`, `CARGAS (Forest.)`, `Copia de Plan de Cuentas`, `DATA-ENTRY`, `Espacio blanco 2`, `Mirada Interanual backup`, `PALETAS` | rangos acotados | completa salvo `Copia de Plan de Cuentas`, **truncada en la fila 30** |

Las cuatro hojas `RESP_TC_v095_*` / `RESP_FORMULAS_v095_*` **no entraron en ninguna
tanda**: son respaldos creados el mismo dia por el proceso v0.9.5 y no fueron evaluadas.

### 10.3 Censo del escaneo

Celdas con contenido, formulas y celdas en error, por hoja. "Celdas" cuenta lo que la
API devolvio dentro del rango pedido, no el total de la hoja.

| Hoja | Celdas | Formulas | En error |
|---|---|---|---|
| `ANUAL` | 1.039 | 1.010 | **71** |
| `DATA-ENTRY` | 545 | 0 | 0 |
| `CALCU` | 272 | 114 | 1 |
| `Mirada Interanual` | 236 | 48 | **0** |
| `Plan de Cuentas` | 225 | 1 | 0 |
| `Tablero` | 168 | 38 | 2 |
| `Copia de Plan de Cuentas` | 153 | 0 | 0 |
| `Cargas` | 123 | 1 | 0 |
| `Inicio` | 120 | 16 | 5 |
| `Registros` | 88 | 0 | 0 |
| `Tipos de cambio` | 61 | 0 | 0 |
| `BD Antigua` | 53 | 0 | 0 |
| `Tipos de cambio_legacy` | 53 | 0 | 0 |
| `Registros_legacy` | 52 | 0 | 0 |
| `Mirada Interanual backup` | 29 | 0 | 0 |
| `PALETAS` | 28 | 0 | 0 |
| `Bocetos` | 13 | 2 | 1 |
| `CARGAS (Forest.)` | 11 | 1 | 1 |
| `Espacio blanco 2` | 1 | 0 | 0 |

Lectura de un vistazo: **el 82 % de los errores de toda la planilla estan en `ANUAL`**,
una hoja oculta que nadie lee. Las hojas que el usuario mira todos los dias tienen 8
errores entre todas, y 5 de esos 8 son basura fuera de pantalla.

---

## 11. Inventario de las 23 hojas, con veredicto

GID, geometria y visibilidad **verificados** contra el indice de la API. La columna
"veredicto" es una recomendacion, no un hecho: la decision es de Franco.

### 11.1 Nucleo del MVP

Las seis que existen de las siete que Franco pidio, mas `Inicio`.

| Hoja | GID | Dimensiones | Visible | Rol en el producto |
|---|---|---|---|---|
| `Registros` | `1546296548` | 4848 x 14 | si | **La BD.** Ledger append-only, 2.903 filas de datos. Todo lo demas es lectura sobre esto |
| `Tipos de cambio` | `779567597` | 2200 x 13 | si | Data lake de cotizaciones (ADR-004). Cuatro bloques, uno por moneda |
| `Plan de Cuentas` | `738279722` | 1000 x 26 | si | Catalogo maestro: 5 tablas + bloque consolidador. **La unica fuente de la clasificacion** |
| `Cargas` | `1889618311` | 3381 x 25 | si | Puerta de entrada. Grilla `I5:O19` + espejo de los ultimos 15 movimientos |
| `Tablero` | `201314967` | 1000 x 53 | si | Dashboard principal. **Donde ya vive el motor de Disponibilidad de Fondos** |
| `Mirada Interanual` | `199868006` | 1002 x 27 | si | Vista interanual por macro grupo. La unica cuyas formulas escribe el codigo |
| `Inicio` | `306858729` | 1000 x 52 | si | **No es una portada: es un dashboard mensual completo**, con su propio staging y sus propios KPIs. Duplica parcialmente al Tablero |
| **`Presupuesto`** | — | — | — | **NO EXISTE.** Es el hueco. Seccion 14 |

**Veredicto:** las siete se conservan y se auditan (backlog en 13.4). `Inicio` obliga a
una decision de producto que hoy nadie tomo: **o es la portada y el Tablero es el
detalle, o es un segundo tablero redundante.** Hoy tiene tres KPIs que el Tablero
tambien calcula, con **criterios distintos** (13.2), lo que garantiza que en algun
momento muestren numeros diferentes de lo mismo.

### 11.2 Soporte y legado con valor (conservar, ocultas)

| Hoja | GID | Dimensiones | Visible | Que es | Veredicto |
|---|---|---|---|---|---|
| `BD Antigua` | `863780679` | 3735 x 8 | no | Historico pre-Tidetrack, formato plano. La lee `99_MigrationLogic.js` | **Soporte.** Conservar oculta |
| `DATA-ENTRY` | `1849033622` | 997 x 58 | no | **La especificacion del schema PostgreSQL**, prototipada con datos reales: 7 tablas (`DB_MONEDAS`, `DB_TIPOS_CAMBIO`, `DB_MEDIOS_PAGO`, `DB_CUENTAS`, `DB_TRANSACCIONES`, `DB_CONFIG`, `AUX_COTIZACIONES`) con IDs tipo `MON-001`, `FX-00001`, `TRX-`. Cero formulas | **Legado de alto valor.** Es el ADR-001 hecho tabla. Conservar oculta, o exportar a `DATABASE_SCHEMA.md` y recien ahi borrar |
| `PALETAS` | `1962806773` | 1000 x 24 | no | Los dos sistemas de color completos: light *"Liquidity & Flow"* y dark *"Growth & Stability"*, en HEX | **Legado de valor.** Es la unica fuente del sistema de color y Marcos trabaja con esto. Destino natural: `PRINCIPIOS_DISENO.md` |

### 11.3 Legado a archivar (no son producto, pero contienen diseno)

| Hoja | GID | Dimensiones | Visible | Que es | Veredicto |
|---|---|---|---|---|---|
| `CALCU` | `367882887` | 1001 x 34 | **SI** | Motor mensual muerto (12.4). **Contiene la especificacion mas completa del Presupuesto** (14.1) | **Archivar, no reparar.** Ocultarla ya: hoy es una pestana visible que no calcula nada |
| `ANUAL` | `1358411018` | 6113 x 23 | no | Motor anual muerto. Aporta el panel de proporciones 1/3-1/3-1/3 (14.1) | **Archivar, no reparar.** Revivirla cuesta mas que escribir el Presupuesto de cero |
| `Registros_legacy` | `709656625` | 4845 x 21 | no | Backup del ledger pre-migracion (layout `I:T`) | Conservar hasta que la v0.9.x este validada en produccion. Despues, borrar |
| `Tipos de cambio_legacy` | `42932214` | 999 x 20 | no | Backup del data lake pre-migracion. **De aca salio el backfill de cotizaciones** | Idem |
| `Copia de Plan de Cuentas` | `706619955` | 4848 x 17 | **SI** | **No es una copia: es el Plan de Cuentas migrado al layout nuevo** y sin terminar. Le faltan 4 medios de pago y **le falta el bloque consolidador `Categorias`** | **Ocultar hoy mismo.** Esta al lado de la original, visible, con el mismo contenido y desactualizada: es una trampa de edicion |
| `RESP_TC_v095_2026-08-13_1721` | `1124042179` | 1000 x 26 | no | Respaldo automatico del proceso v0.9.5 | Purgar cuando la v0.9.5 este validada |
| `RESP_FORMULAS_v095_2026-08-13_1721` | `621766824` | 1000 x 26 | no | Idem | Idem |
| `RESP_TC_v095_2026-08-13_1724` | `1367927451` | 1000 x 26 | no | Idem (segunda corrida) | Idem |
| `RESP_FORMULAS_v095_2026-08-13_1724` | `146232914` | 1000 x 26 | no | Idem | Idem |

**Nota:** las cuatro `RESP_*` no fueron escaneadas (10.2). Su rol se deduce del nombre y
de la marca de tiempo, no de su contenido. Antes de purgarlas hay que mirarlas.

### 11.4 Basura (borrar)

| Hoja | GID | Dimensiones | Visible | Por que es basura |
|---|---|---|---|---|
| `Mirada Interanual backup` | `1045164083` | 999 x 32 | no | 29 celdas, **cero formulas**: solo rotulos del layout anterior. No respalda nada; el estado real esta en git y en la hoja viva |
| `Bocetos` | `1055914252` | 999 x 40 | no | 13 celdas: restos del `Inicio` viejo, un valor suelto, la paleta antigua (superada por `PALETAS`) y una `QUERY('R CAR'!…)` rota |
| `CARGAS (Forest.)` | `564358147` | 500 x 28 | no | 11 celdas: boceto de una vista de cargas que la hoja `Cargas` ya cubre. Su unica formula apunta a `'R CAR'` y a `TABLERO!AH2`, **dos referencias inexistentes** |
| `Espacio blanco 2` | `1691890552` | 999 x 32 | **SI** | **Una sola celda**: `B13 = "Acciones rapidas"`. Es una plantilla en blanco ocupando una pestana visible del MVP |

**`Espacio blanco 1` ya no existe.** Estaba en el snapshot de marzo y desaparecio: es la
primera baja confirmada del inventario. `NAV_CONFIG.SHEETS` sigue declarando
`ESPACIO_BLANCO_1`, `_2` y `_3`; de las tres, **solo la 2 existe**.

### 11.5 Higiene de pestanas: tres visibles que no son producto

Hoy el usuario ve, entre las pestanas del MVP, tres hojas que no le sirven:
**`Copia de Plan de Cuentas`** (trampa de edicion), **`Espacio blanco 2`** (una celda) y
**`CALCU`** (motor muerto, que ademas segun el ADR-006 deberia estar oculta). Ocultarlas
es el cambio de menor costo y mayor efecto percibido de toda esta auditoria.

### 11.6 Sobre-asignacion de grid

`ANUAL` declara 6.113 filas y su contenido termina en la **98**. `Registros_legacy`
declara 4.845, `Copia de Plan de Cuentas` 4.848, `Cargas` 3.381 con contenido hasta la
**19**. Es grid vacio heredado de resizes viejos, no datos. Recortarlo es cosmetico,
pero baja el peso del archivo y acelera los recalculos.

---

## 12. La cadena de datos, completa

### 12.1 Layout vivo de las dos hojas migradas

Verificado por lectura directa. **Este es el layout que hay que usar; el de la seccion
3.1 y 3.2 describe las hojas `_legacy`.**

**`Registros`** — 14 columnas (`A:N`), titulos de bloque arriba, **headers en la fila 5**,
**datos desde la fila 6**. `A` y `N` estan vacias (el offset de ADR-005, reducido a una
columna por lado).

| Col | Header literal en la hoja | Contenido |
|---|---|---|
| `B` | `Monto` | siempre positivo; el signo lo pone `C` |
| `C` | `Tipo` | `Ingreso` / `Egreso` |
| `D` | `Cuenta` | FK al Plan de Cuentas. Valores especiales: `Traspaso`, `Inicio Mes` |
| `E` | `Tipo de Cuenta` | `Ingreso` / `Gasto Fijo` / `Gasto Variable`, o **vacio** |
| `F` | `Medio` | FK a MEDIOS_PAGO |
| `G` | `Moneda` | `ARS` / `USD` / `AUD` / `EUR` |
| `H` | `Fecha` | congelada al procesar |
| `I` | `Nota` | texto libre |
| `J` | `Valor ARS` | **TC ARS congelado** (siempre 1) |
| `K` | `Valor USD` | **TC USD congelado**, ARS por 1 USD |
| `L` | `Valor AUD` | **TC AUD congelado** |
| `M` | `Valor EUR` | **TC EUR congelado** |

> **Defecto de nomenclatura, confirmado por los datos.** Los headers `J:M` dicen "Valor
> ARS/USD/AUD/EUR", pero **no guardan el monto convertido: guardan el tipo de cambio.**
> Evidencia: la fila 6 es un ingreso de `$100,00` en `ARS` y trae `J6 = 1,00`,
> `K6 = 1.481,94`, `L6 = 1.039,45`, `M6 = 1.699,34`. Si fueran valores convertidos,
> `K6` seria `0,067`. Todas las formulas los usan correctamente como TC; el que engana
> es el rotulo. Renombrarlos a `TC USD` etc. es un cambio de una celda y evita el
> proximo malentendido.

**`Tipos de cambio`** — 13 columnas (`A:M`), **titulos en la fila 5**, **headers en la
fila 6**, **datos desde la fila 7**. Cuatro bloques `(Fecha, Cotizacion)`:

| Par | Columnas | Titulo (fila 5, literal) |
|---|---|---|
| TC_ARS | `B:C` | `Peso Argentino.` |
| TC_USD | `E:F` | `Dolar Estaudonidense.` (con el typo en la planilla) |
| TC_AUD | `H:I` | `Dolar Australiano.` |
| TC_EUR | `K:L` | `Euro.` |

**`Plan de Cuentas`, `Cargas` y `BD Antigua` NO migraron**: siguen exactamente como los
describen las secciones 3.3, 3.4 y 3.5.

### 12.2 El grafo real de dependencias

```
                       Usuario escribe en Cargas!I5:O19
                                    |
                       appOnEdit (14_EventHandlers.js)
                       autocompleta Fecha y Moneda segun el Medio
                                    |
                       procesarCargas() (06_RegistrosService.js)
                       - filtra: SOLO exige Monto no vacio
                       - deduce Tipo de Cuenta contra el Plan de Cuentas
                       - busca/genera cotizaciones (15_ExchangeRateApi.js)
                       - persiste TC en Tipos de cambio (batch)
                                    |
                                    v
              REGISTROS  (B6:M, 2.903 filas, TC congelados en J:M)
                                    |
      +------------------+----------+-----------+------------------+
      |                  |                      |                  |
      v                  v                      v                  v
 Tablero!AN4        Inicio!Y4  y  !AM4     Mirada Interanual   Cargas!R5
 QUERY del mes      QUERY mes actual       48 SUMPRODUCT       ultimos 15
 (I4/I6)            y mes anterior         directos, sin       movimientos
      |                  |                 staging
      v                  v                      |
 staging AN:AZ      staging Y:AK / AM:AY        |
 (+ AZ = conv.      (+ AK / AY = conv.)         |
  a la moneda I9)                               |
      |                  |                      |
      v                  v                      v
 KPIs del Tablero   KPIs de Inicio         G10:R14 por mes
 (S4:S7, U4:U7,     (I6, L6, I10, L10,     Ingresos / Fijos /
  W4/Z4/AC4, AF4,    I12, L12)             Variables / Resultado
  AJ10, U17, I21)
      |
      v
 Control de Presupuesto (Q11:U17)  <--- S13:S15 son CONSTANTES TIPEADAS
      |
      v
 Disponibilidad de fondos (Q20:U24)  <--- el motor que Franco pidio, YA FUNCIONA

 'Plan de Cuentas'!R:T  (Medio -> Proyecto)  ---+
 'Plan de Cuentas'!V:W  (Proyecto -> Tipo)   ---+--> 25 refs desde Tablero
                                                     17 refs desde Inicio

 15_ExchangeRateApi.js --> Tablero!AL4:AL6 (cotizacion VIVA)

 CALCU  --> 'R CAR'  (hoja inexistente)   ... nadie lee CALCU
 ANUAL  --> 'R CAR' + LISTAS (inexistentes) ... nadie lee ANUAL
```

Conteo de referencias entre hojas, medido sobre el texto de las formulas del escaneo:

| Consumidor | Lee `Plan de Cuentas` | Lee `Registros` |
|---|---|---|
| `Tablero` | 25 | 1 (la QUERY de staging) |
| `Inicio` | 17 | 2 (las dos QUERY de staging) |
| `Mirada Interanual` | 0 | **252** (7 rangos x 36 celdas) |
| `Cargas` | 0 | 1 |
| `CALCU` / `ANUAL` | 0 | **0** |

**Ninguna hoja referencia al `Tablero`.** Es un sumidero puro: consume y no alimenta a
nadie. Eso es exactamente lo que lo hace el lugar correcto para el consumo del
Presupuesto, y el lugar incorrecto para su fuente.

### 12.3 Celdas de control vigentes (leidas, no inferidas)

| Hoja | Celda | Rol | Valor al escanear | Formato exigido |
|---|---|---|---|---|
| `Inicio` | `P4` | Mes | `Julio` | **Capitalizado** |
| `Inicio` | `P6` | Ano | `2026` | numero |
| `Inicio` | `P9` | Moneda de la vista | `ARS` | codigo de 3 letras |
| `Tablero` | `I4` | Mes | `Junio` | **Capitalizado** |
| `Tablero` | `I6` | Ano | `2026` | numero |
| `Tablero` | `I9` | Moneda de la vista | `ARS` | codigo de 3 letras |
| `Tablero` | **`S13`** | **Presupuesto de Ingresos** | `$4.024.333,33` | **numero tipeado a mano** |
| `Tablero` | **`S14`** | **Presupuesto de Gastos Fijos** | `$563.406,67` | idem |
| `Tablero` | **`S15`** | **Presupuesto de Gastos Variables** | `$3.098.736,66` | idem |
| `Mirada Interanual` | `E4` | Mes | `MAYO` | **MAYUSCULAS** |
| `Mirada Interanual` | `F4` | Ano | `2026` | numero |
| `Mirada Interanual` | `R4` | Moneda de la vista | `ARS` | codigo de 3 letras |
| `Mirada Interanual` | `N4` | "Proyecto" | `Todos` | **selector muerto: ninguna formula lo lee** |
| `CALCU` | `B3` / `G3` | Mes / Ano | `ENERO` / `2026` | MAYUSCULAS / numero |
| `Cargas` | `I5:O19` | Lote de entrada | — | lo consume `procesarCargas()` |

**Sigue vigente la trampa del formato de mes** (seccion 5): `Inicio` y `Tablero` esperan
`Junio`, `Mirada Interanual` y `CALCU` esperan `JUNIO`. Son tres listas de meses
hardcodeadas en tres lugares distintos, con dos convenciones. Un `MATCH` que falla
devuelve `#N/A` y tumba la vista entera.

**Por que el Tablero se ve vacio hoy:** `I4 = Junio` y el ledger tiene **un solo
registro de junio** (21/6/2026, $100 ARS, Tidetrack/Uala); el resto de las 2.903 filas
termina el 29/3/2026. Poner `I4 = Marzo` puebla el tablero entero. Cualquier auditoria
de las formulas del Tablero hecha en junio se hace sobre un registro: no vale.

### 12.4 CALCU y ANUAL: que son en realidad

**Estan muertos y nadie los lee.** Verificado por dos vias independientes: cero
referencias a `CALCU` o `ANUAL` en las formulas de las otras 18 hojas escaneadas, y cero
lecturas o escrituras desde `src/` (la unica mencion es un comentario en
`98_DevTools_Scanner.js`).

**Su unica entrada son dos hojas que no existen en esta planilla:**

- **`'R CAR'`** — el ledger predecesor. Su layout se reconstruye sin ambiguedad del uso
  en los `SUMIFS`: `A`=Fecha, `B`=Ingreso, `C`=Egreso, `D`=Detalle, `F`=Tipo. Eso es
  **exactamente** el header de `BD Antigua`.
- **`LISTAS`** — el catalogo de cuentas precursor del Plan de Cuentas (bloques en `F`,
  `H`, `N`). 70 referencias, todas en `ANUAL`, todas en `#REF!`.

Hay dos fosiles mas que apuntan al mismo lugar: `Bocetos!AH3` (`QUERY('R CAR'!A:G;AH2)`)
y `'CARGAS (Forest.)'!T4` (`QUERY('R CAR'!A:G; TABLERO!AH2)`, con `TABLERO` en
mayusculas). **Los cuatro forman un bloque de hojas copiadas de una planilla anterior**
— el prototipo "Forest" — cuyo ledger era `'R CAR'`, cuyo catalogo era `LISTAS` y cuyo
dashboard era `TABLERO`. Llegaron aca sin sus fuentes y nunca se recablearon.

Grado de muerte, medido:

| | `CALCU` | `ANUAL` |
|---|---|---|
| Celdas en `#REF!` | 1 (`AB3`, el staging) | **71** (`P1` + los 70 rotulos de `LISTAS`) |
| Celdas mostrando `$0,00` / `0%` | 110 | **936** de 1.039 |
| Valores distintos de cero | **ninguno**, salvo el calendario | **ninguno** |
| Agravante propio | los rotulos de cuenta (`K3:K32`, `P3:P32`, `U3:U32`) estan **vacios**: aunque se reparara el QUERY, cada `SUMIFS` criteriaria contra celda vacia | suma importes **crudos, sin noción de moneda** — inservible en una planilla multi-moneda |

Lo unico vivo en `CALCU` es el calendario (`H2` + `B5 = SEQUENCE(6;7;…)`), que solo
depende de `B3`/`G3`: un widget autonomo sin relacion con las finanzas.

**Recomendacion: archivar, no reparar.** Repuntar `'R CAR'` a `Registros` exige
reescribir las 840 formulas de `ANUAL` (el layout nuevo no tiene columnas separadas de
Ingreso/Egreso, que es lo que el motor asume) y cargar a mano los 70 rotulos que venian
de `LISTAS`. Cuesta mas que escribir el Presupuesto de cero, y el resultado seria un
duplicado peor de `Mirada Interanual`.

**Consecuencia sobre el ADR-006 ("Hidden Engines"): el ADR describe una arquitectura que
en produccion no existe.** El Tablero e Inicio arman su propio staging desde `Registros`
y `Mirada Interanual` lee el ledger directo. Ninguna vista consume resultados de un
motor oculto. El ADR-006 hoy es aspiracional, no descriptivo, y hay que reescribirlo o
retirarlo.

---

## 13. Estado de salud: que falta para que las siete hojas queden auditadas

### 13.1 El titular

**Ninguna de las siete hojas del MVP esta rota.** No hay un solo `#ERROR!` en las
formulas de negocio, `Mirada Interanual` calcula con cero errores y las QUERY de staging
del Tablero e Inicio ya estan migradas al layout `B5:M`. El trabajo pendiente **no es
reparar formulas rotas: son defectos de diseno** que hoy no se ven porque los datos no
los estan ejercitando.

### 13.2 Defectos abiertos, por severidad

Cada uno esta verificado sobre el texto de la formula. La columna "efecto" dice que pasa
cuando se rompe, no que se ve hoy.

| # | Hoja | Defecto | Efecto | Sev |
|---|---|---|---|---|
| **P1** | `Tablero` | **`S13:S15` (el presupuesto) son numeros pelados sin moneda declarada.** Al poner `I9 = USD`, `U13:U15` y `U17` se reescalan pero `S13:S15` no | Todo el bloque Control de Presupuesto y **toda la Disponibilidad de Fondos** devuelven basura en cualquier moneda que no sea ARS | **CRITICO** |
| **P2** | `Tablero` | **`AN4` (la QUERY de staging) no tiene `IFERROR`** | Un mes sin registros devuelve `#N/A` y lo propaga a `AZ` y de ahi a los ~30 consumidores. **Ya esta pasando en `Inicio!Y4`** (`P4 = Julio`, sin registros): 2 de los 5 errores de `Inicio` son esto | **CRITICO** |
| **P3** | `Tablero` | **Dos convenciones de tipo de cambio conviviendo.** `AZ` (y por ende `X2`/`AA2`/`AD2`/`U13:U15`) convierte con **TC congelado** (`AV:AY`); `U17`, `T22:T24` y `AJ10` convierten con **TC vivo** (`AL4:AL6`) | `S22 = U17 / (S13-S14-S15)` compara una magnitud a TC vivo contra un presupuesto nominal. Con multi-moneda real los numeros no cierran, y nadie sabe cual es el correcto | **ALTO** |
| **P4** | `Tablero` | **Liquidez hardcodeada por nombre de proyecto.** `S4:S7` filtra `proyecto = "Medio Cotidiano"`; `U4:U7` filtra `tipo <> "Liquidez"` | Si Franco agrega un segundo proyecto de tipo Liquidez, esa plata **desaparece del Tablero**: no entra en Liquidez (nombre distinto) y queda excluida de Riqueza (tipo Liquidez). Fix: `S4:S7` por tipo, simetrico a `U4:U7` | **ALTO** |
| **P5** | `Tablero` | **La deuda cuenta como riqueza.** `U4:U7` incluye todo lo que no sea `Liquidez`, y `Tarjeta de Credito` y `Prestamo Mac` son de tipo `Financiacion` | Los saldos de financiacion suman a "Riqueza Acumulada". Conceptualmente son pasivo. **Decision de negocio, no bug** | MEDIO |
| **P6** | `Tablero` | **`S22` compara dos definiciones distintas de ahorro.** `S17` (presupuestado) es el residuo `Ingresos - Fijos - Variables`; `U17` (real) es el flujo neto hacia proyectos no liquidos | Si Franco no gasta pero tampoco transfiere a un proyecto de ahorro, `U17 = 0` y el cumplimiento marca 0 % aunque la plata este ahi | MEDIO |
| **P7** | `Tablero` | **Spill reservado insuficiente.** Los tres bloques QUERY reservan hasta la fila 22 (19 filas). El Plan de Cuentas tiene **22 cuentas de Gastos Variables** | Con un mes de volumen real (marzo), el spill queda bloqueado y devuelve `#REF!` | **ALTO** |
| **P8** | `Inicio` | **`AY3` y `AY4` referencian `AD9`, que esta vacia.** Deberian usar `P9`, como hace el bloque del mes actual | El header dice `"Valor en "` sin moneda, y la conversion del mes anterior cae a tasa 1: **el comparativo mes-a-mes esta mal en toda moneda que no sea ARS** | **ALTO** |
| **P9** | `Inicio` | **`I6` se llama "Saldo Actual" pero suma solo el staging del mes**, no el acumulado | Nombre enganoso. Es un defecto de producto, no de calculo | MEDIO |
| **P10** | `Inicio` vs `Tablero` vs `Mirada` | **Tres criterios distintos para las mismas metricas.** `Inicio` y `Tablero` excluyen `Traspaso` e `Inicio Mes`; **`Mirada Interanual` no excluye ninguno de los dos** y ademas no aplica el signo de la columna `C` | Los numeros de Mirada **no son comparables** con los del resto de la planilla. Hay que unificar antes de declararla auditada | **ALTO** |
| **P11** | `Mirada Interanual` | **La ventana de 12 meses esta anclada a la columna `K`, no al mes de referencia** (`off_meses = COLUMN()-COLUMN($K$10)`): `G` es mes-4 y `R` es mes+7, pero los rotulos `G9:R9` dicen 1..12 | **Solo coinciden cuando `E4 = MAYO`** (que es el valor de hoy, por eso se ve bien). Con `E4 = JULIO`, la columna `G` pasa a ser marzo y los rotulos mienten | **ALTO** |
| **P12** | 4 hojas | **Las QUERY de staging arrancan en `Registros!B5`, que es la fila de HEADERS**, con el parametro de encabezados en `0` | Funciona **por accidente**: QUERY infiere `Col1` como numerica, convierte el texto `"Monto"` en null y el `WHERE ... IS NOT NULL` lo descarta. Afecta a `Tablero!AN4`, `Inicio!Y4`, `Inicio!AM4` y `Cargas!R5`. Cambiar a `B6:M` | MEDIO |
| **P13** | `Registros`, `Tipos de cambio` | **`frozenRowCount = 3` con el header en la fila 5** (y en la 6 para TC) | El encabezado se va de pantalla al scrollear. Arreglo de cinco segundos | BAJO |
| **P14** | `Registros` | **Los headers `J:M` dicen "Valor ARS/USD/AUD/EUR" y guardan TIPOS DE CAMBIO** (12.1) | Engana a todo el que lea la hoja. Renombrar | BAJO |
| **P15** | `Tipos de cambio` | **`L7` muestra `25/8/1904`**: la cotizacion EUR del 21/6/2026 (~1.699,34, coincide con `Registros!M6`) esta **formateada como fecha** | Corrupcion de formato, no de dato. Es lo que ataca el item de menu "Reparar formato de cotizaciones" | MEDIO |
| **P16** | `Tablero`, `Inicio` | **Formulas de color huerfanas**: `Tablero!D706:D707` y `Inicio!D692:D694` en `#REF!`, `Tablero!D708` apuntando a una celda vacia | Inofensivas y fuera de pantalla, pero son **5 de los 8 errores** de las hojas del MVP y ensucian todo diagnostico | BAJO |
| **P17** | `Tablero` | Cosmeticos: el header `U21` ("Distribucion de fondos disponibles") esta una columna a la derecha de sus valores (`T22:T24`); `S21` dice `"Cumplimineto"` | Ruido visual | BAJO |
| **P18** | codigo | **`appOnEdit` no usa el resolver de alias.** `14_EventHandlers.js` compara contra el string estatico `'Cargas'`, mientras `procesarCargas` entra por `SHEETS.DATA_ENTRY` (getter con `_resolverNombreHoja`) | Si la pestana se renombra, el procesamiento sigue andando y **el autocompletado de fecha y moneda deja de funcionar en silencio**. Viola la regla 5 de gobernanza | **ALTO** |
| **P19** | codigo | **Doble centinela para "sin clasificar".** `06_RegistrosService.js` escribe `''`; `99_MigrationLogic.js` escribe `'Sin Clasificar'` | Dos valores distintos en la misma columna `Registros.E`. Todo filtro del Presupuesto tiene que contemplar los dos | MEDIO |
| **P20** | codigo | **El filtro de `procesarCargas` solo exige Monto.** Una fila con monto y sin Cuenta entra al ledger con `Tipo de Cuenta` vacio | Registro contablemente invisible: no lo ve Mirada, no lo veria el Presupuesto | MEDIO |

### 13.3 `Mirada Interanual`: funciona, pero esta construida al 17 %

El bloque `G10:R14` calcula bien. Lo que la auditoria descubrio es que **la hoja es
mucho mas grande que ese bloque**: tiene seis secciones con la misma plantilla, y cinco
estan vacias.

| Fila | Seccion | Estado |
|---|---|---|
| `C9` | **Resultados** — Ingresos (10), Gastos Fijos (11), Gastos Variables (12), Resultados (14) | **el unico bloque con formulas** |
| `C16` | Evolucion de Tendencias | vacio (zona de grafico) |
| `C26` | **Manejo de Dinero** — Liquidez (27), Riqueza (28) | rotulos, sin formulas |
| `C30` | Evolucion de Tendencias | vacio |
| `C38` | **Proyectos** — 12 slots (`B39:B50`) | rotulos, sin formulas |
| `C52` | Evolucion de Tendencias | vacio |
| `C62` | **Desglose Ingresos** — 25 slots (`B63:B87`) | rotulos, sin formulas |
| `C89` | **Desglose Gastos Fijos** — 25 slots (`B90:B114`) | rotulos, sin formulas |
| `C116` | **Desglose Gastos Variables** — 25 slots (`B117:B141`) | rotulos, sin formulas |

Espacio libre: columnas `S:AA` enteras y de la fila 142 a la 1002.

### 13.4 Backlog para dejar las siete hojas "auditadas y funcionales"

En este orden. Los primeros cuatro pasos son baratos y desbloquean todo lo demas.

1. **Poner `Tablero!I4 = Marzo` y auditar con datos reales.** Sin esto, cualquier
   validacion se hace sobre un registro y no prueba nada.
2. **P2** — envolver `Tablero!AN4` e `Inicio!Y4`/`AM4` en `IFERROR` con la aridad de 12
   columnas. Es el defecto que puede tumbar una hoja entera con un solo click.
3. **P7** — ampliar el spill reservado de los tres bloques QUERY del Tablero (de la fila
   22 a ~40) antes de que marzo lo reviente.
4. **Higiene:** ocultar `Copia de Plan de Cuentas`, `Espacio blanco 2` y `CALCU`; borrar
   las formulas de color huerfanas (**P16**); arreglar `frozenRowCount` (**P13**) y los
   cosmeticos (**P17**).
5. **P8** — `Inicio!AY3`/`AY4` deben leer `P9`, no `AD9`.
6. **P18** — `appOnEdit` por el resolver de alias, no por string estatico.
7. **Decisiones de Franco, bloqueantes** (no son tecnicas): la convencion de tipo de
   cambio (**P3**), la moneda del presupuesto (**P1**), si `Financiacion` cuenta como
   riqueza (**P5**), y que es "Ahorro" (**P6** y seccion 14.4).
8. **P4** — `S4:S7` por tipo de proyecto, no por nombre.
9. **P10 y P11** — unificar el criterio de `Mirada Interanual` con el del Tablero
   (excluir `Traspaso` e `Inicio Mes`, aplicar el signo) y resolver el anclaje de la
   ventana de 12 meses. Se hace en `07_MiradaInteranual.js`, no en la hoja.
10. **P15** — reparar el formato de `Tipos de cambio!L7`.
11. **P12, P14, P19, P20** — limpieza de contrato: rangos desde `B6`, renombrar `J:M`,
    unificar el centinela de "sin clasificar", endurecer el filtro de `procesarCargas`.
12. **Recien aca, crear `Presupuesto`** y cablear `S13:S15` (seccion 14).

**Medicion pendiente que ningun diseno puede saltear:** cuantas de las 2.903 filas de
`Registros` tienen `E` vacio, `'Sin Clasificar'`, o `Cuenta = "Traspaso"`. En los 15
movimientos mas recientes, **4 de 15 (27 %) son Traspaso**. El orden de magnitud decide
si el Presupuesto puede confiar en `Registros.E` o tiene que reclasificar al leer. El
escaneo de hoy no lo puede contestar: de `Registros` solo se trajo la estructura (10.2).

---

## 14. El hueco del Presupuesto

### 14.1 El hallazgo que cambia el diseno: no hay que inventarlo, hay que conectarlo

**Existen cuatro intentos previos de presupuesto en esta planilla, y uno de ellos ya
funciona.**

| Donde | Que aporta | Estado |
|---|---|---|
| **`Tablero!Q11:U17`** — "Control de Presupuesto." | La matriz `Categoria \| Presupuesto \| Real` con Ingresos, Gastos Fijos, Gastos Variables y `S17 = S13-S14-S15` como Capacidad de Ahorro | **Vivo.** Le falta la fuente de `S13:S15` |
| **`Tablero!Q20:U24`** — "Disponibilidad de fondos." | **El motor completo**: cumplimiento por bolsillo (`S22:S24`) y reparto de la liquidez real entre los tres bolsillos (`T22:T24`) | **Vivo y correcto** (14.3) |
| **`Inicio!I14:K18`** — "Presupuesto del Mes." | El esqueleto de UI ya dibujado: headers `Composicion \| % \| Disponibilidad` y las tres filas exactas (Capacidad de Ahorro, Gastos Fijos, Gastos Variables) | **Cascaron.** Las 6 celdas de datos (`J16:K18`) estan **vacias**, sin una sola formula |
| **`CALCU!B13:F18` y `B21:F26`** | La especificacion mas completa: dos bloques espejo GASTOS REALES / PRESUPUESTO con ingreso, % sobre ingreso por tipo, y ahorro como residuo. Y arriba, el **desglose por cuenta** con columna de real y columna de presupuesto (`M`/`N`, `R`/`S`, `W`/`X`) | **Muerto** (12.4) |
| **`ANUAL!A14:B17`** | El panel de proporciones: `Gastos basicos` / `Reserva-Lujos` / `Ahorro`, cada uno `= 1/3` | **Muerto** (12.4) |

**El Presupuesto no es una idea nueva: es una obra parada.** Alguien diseno la UI en
`Inicio`, escribio el motor en el `Tablero`, y nunca cablo la fuente.

### 14.2 El agujero, exacto

`Tablero!S13`, `S14` y `S15` son **tres numeros tipeados a mano**:

```
S13  $4.024.333,33   (Presupuesto de Ingresos)          <- valor, no formula
S14  $563.406,67     (Presupuesto de Gastos Fijos)      <- valor, no formula
S15  $3.098.736,66   (Presupuesto de Gastos Variables)  <- valor, no formula
```

Sin dimension de mes, sin dimension de moneda, sin historial, sin porcentajes. Todo lo
que cuelga de ellas — `S17`, `S22:S24`, `T22:T24` — hereda esas tres carencias.

> **Nota historica.** En el snapshot de marzo estas mismas celdas eran formulas
> (`S13 = X2*1,3`, `S14 = AA2*2`, `S15 = AD2`): un "presupuesto" derivado del gasto real
> por multiplicadores fijos. Alguien las reemplazo por constantes. El diagnostico no
> cambia — sigue sin haber un presupuesto de verdad —, pero **empeoro**: antes al menos
> se movia con los datos.

### 14.3 Lo que YA funciona y no hay que reescribir

`T22:T24` implementa exactamente lo que Franco describe como "Disponibilidad de Fondos":
reparte la liquidez real entre los tres bolsillos, en proporcion a lo que le falta a cada
uno, con tope por brecha y volcado del excedente al Ahorro. Forma verbatim de `T22`:

```
liquidez_ars      = S4 + S5*AL4 + S6*AL5 + S7*AL6
liquidez_moneda   = liquidez_ars / SWITCH(I9; "ARS";1; "USD";AL4; "AUD";AL5; "EUR";AL6)
rem_ahorro        = MAX(0; (S13-S14-S15) - U17)
rem_fijos         = MAX(0; S14 - U14)
rem_var           = MAX(0; S15 - U15)
suma_rem          = rem_ahorro + rem_fijos + rem_var
base_ahorro       = IF(suma_rem>0; MIN(rem_ahorro; liquidez_moneda * rem_ahorro/suma_rem); 0)
excedente         = IF(liquidez_moneda > suma_rem; liquidez_moneda - suma_rem; 0)
resultado         = IF(suma_rem=0; liquidez_moneda; base_ahorro + excedente)
```

**Verificacion aritmetica sobre los valores leidos:** rem_ahorro = 362.190,00;
rem_fijos = 563.406,67; rem_var = 3.098.736,66; suma_rem = 4.024.333,33;
liquidez = 100 → T22 = 9, T23 = 14, T24 = 77. Suma exacta 100, y coincide celda por
celda con lo que muestra la planilla (`$9,00` / `$14,00` / `$77,00`). **El prorrateo
funciona.**

> `FORMULAS_TABLERO.md` documenta una version anterior y mas pobre de esta formula
> (`liquidez * rem/suma_rem` sin `MIN` ni excedente) y afirma en su cabecera que el
> Tablero "no referencia directamente a `Registros`", lo cual es **falso**: `AN4` es un
> `QUERY(Registros!B5:M; …)`. Ese archivo hay que reescribirlo.

### 14.4 Como se clasifican HOY los tres macro grupos

Esta es la pregunta que decide la arquitectura del Presupuesto, y la respuesta es
incomoda: **los tres macro grupos no viven en el mismo eje.**

**Gastos Fijos y Gastos Variables — por bloque del Plan de Cuentas, congelado al
escribir.** `06_RegistrosService.js` compara el nombre de la cuenta contra los tres
catalogos, en orden, y persiste el literal en `Registros.E`:

```js
if      (ingresosCat.includes(cuentaName))   tipoCuenta = 'Ingreso';
else if (fijosCat.includes(cuentaName))      tipoCuenta = 'Gasto Fijo';
else if (variablesCat.includes(cuentaName))  tipoCuenta = 'Gasto Variable';
```

**Consecuencia dura: mover una cuenta de Gastos Fijos a Gastos Variables NO reclasifica
el historico.** Y `Mirada Interanual` come exclusivamente de esa columna, con igualdad
exacta contra los tres literales: **no existe una cuarta categoria**.

El catalogo actual, contado sobre la hoja: **11 cuentas de Ingreso** (`I4:I14`), **15 de
Gasto Fijo** (`L4:L18`), **22 de Gasto Variable** (`O4:O25`), **28 medios de pago**
(`R4:T31`) y **8 proyectos** (`V4:W11`). El bloque consolidador `Y4` apila Ingresos +
Fijos + Variables + **Medios de Pago** = 76 nombres (verificado: 11+15+22+28; el escaneo
llego hasta la fila 60 y confirma 57 de ellos).

**Ahorro — NO existe como tipo de cuenta. Existe, y ya esta implementado, por otro eje:
el medio de pago.** La cadena, identica en `Tablero!S4:S7`, `U4:U7`, `U17`, `AJ10` e
`Inicio!I6`, `L6`:

```
Medio  --VLOOKUP--> 'Plan de Cuentas'!R:T col 3  = Proyecto
Proyecto --VLOOKUP--> 'Plan de Cuentas'!V:W col 2 = Tipo de proyecto
```

y sobre eso, dos bolsillos:

```
cond_liquidez :  proyecto_del_medio = "Medio Cotidiano"          -> "Liquidez"
cond_riqueza  : (tipo_proy <> "Liquidez") * (tipo_proy <> "")    -> "Riqueza"
```

**El tercer macro grupo ya esta modelado en la planilla, con el nombre "Riqueza".** No
hay una sola linea de Apps Script que lo mencione: es 100 % de formula.

### 14.5 ¿Sirve el eje "tipo" de Proyectos para el tercer macro grupo?

**Si — de hecho ya lo es. Con tres advertencias duras.**

Primero, un desmentido: **`CLAUDE.md` y `MAPA_HOJAS.md` dicen que los tipos de proyecto
son `Liquidez` / `Ahorro` / `Inversion`. Es falso.** Los ocho proyectos vivos declaran
**siete tipos distintos**, texto libre:

| Proyecto | Tipo (valor real, leido) |
|---|---|
| Ahorros | **Ahorro** |
| Tarjeta de Credito | **Financiacion** |
| Medio Cotidiano | **Liquidez** |
| Europa | **Viajes** |
| Cartera de Retiro | **Inversiones** |
| Chanchito | **Fondo de Emergencia** |
| Cambiar el Celular | **Objetivos Personales** |
| Prestamo Mac | **Financiacion** |

Las advertencias:

1. **`tipo <> "Liquidez"` mete la deuda adentro del ahorro.** `Financiacion` es pasivo y
   la negacion lo cuenta como riqueza (**P5**). El Presupuesto debe usar **whitelist
   explicita** — `Ahorro`, `Inversiones`, `Fondo de Emergencia`, `Viajes`,
   `Objetivos Personales` — nunca la negacion heredada.
2. **El campo es texto libre**, sin enum: el ABM lo escribe con
   `payload.tipoProyecto || 'General'`. Un typo rompe el VLOOKUP en silencio.
3. **Los VLOOKUP son por nombre, sin ID.** Renombrar un medio o un proyecto devuelve
   `""`, que en `cond_riqueza` significa "no es riqueza": **falla silenciosa hacia
   abajo**, sin error visible.

**La asimetria que hay que decidir:**

| Macro grupo | Eje | Se resuelve | Reclasifica el historico |
|---|---|---|---|
| Ingresos | `Registros.E = "Ingreso"` | **al escribir** | **No** |
| Gastos Fijos | `Registros.E = "Gasto Fijo"` | **al escribir** | **No** |
| Gastos Variables | `Registros.E = "Gasto Variable"` | **al escribir** | **No** |
| **Ahorro / Riqueza** | `Medio -> R:T -> V:W -> Tipo` | **al leer** | **Si** |

Tres inmutables y uno mutable. **Esa asimetria es la decision de arquitectura numero uno
del Presupuesto:** o se acepta (y el bolsillo Ahorro se comporta distinto de los otros
tres), o se unifica llevando los cuatro al eje de lectura — es decir, dejar de leer
`Registros.E` y recalcular Fijo/Variable por VLOOKUP contra el Plan de Cuentas al
momento de leer, igual que ya hace el Tablero con el medio.

### 14.6 Los dos agujeros del ledger que el Presupuesto va a chocar

**A. El ahorro se registra como `Traspaso`, y `Traspaso` no existe en el Plan de
Cuentas.** Mover plata a un medio de ahorro se registra como **dos filas** (un Egreso
del medio cotidiano y un Ingreso del medio de ahorro), ambas con `Cuenta = "Traspaso"`.
Ese literal **no esta en ningun bloque del catalogo**, asi que `procesarCargas` le
asigna `Tipo de Cuenta = ''`. Resultado:

- `Mirada Interanual` **lo ignora** — bien: no infla ingresos ni gastos.
- Un Presupuesto que se apoye en `Registros.E` **tambien lo ignoraria** — mal: ese es
  exactamente el flujo de ahorro que hay que medir.
- **Solo el Tablero lo ve**, porque clasifica por medio y no por cuenta.

En los 15 movimientos mas recientes, **4 son Traspaso (27 %)**. El control de integridad
existe y esta sano: `Tablero!I21` compara ingresos contra egresos de Traspaso y hoy
devuelve `"Traspasos balanceados"`.

**B. `Compra USD` esta catalogada como GASTO VARIABLE** (`Plan de Cuentas!O20`). Comprar
dolares infla los gastos variables del mes y, si la contrapartida acredita un medio
`Dolar *` (proyecto `Ahorros`), **el mismo movimiento se cuenta como gasto variable y
como riqueza**. Decision de negocio pendiente, no bug.

### 14.7 Contrato propuesto para la hoja `Presupuesto`

**Principio: la hoja nueva es la FUENTE de las proporciones, no un motor nuevo.** El
motor ya existe en `Tablero!Q20:U24` y funciona; lo que hay que hacer es alimentarlo.

Contenido minimo:

| Bloque | Contenido |
|---|---|
| Selectores | mes / ano / moneda, **leyendo los mismos controles que el resto** (`Tablero!I4`/`I6`/`I9`), no duplicandolos |
| Proporciones | 3 celdas: % Gastos Fijos, % Gastos Variables, % Ahorro. Validacion dura: suma = 100 % |
| Base de ingreso | elegible entre (a) ingreso presupuestado manual, (b) promedio de los ultimos N meses reales, (c) ingreso real del mes en curso |
| Tabla por mes | `mes \| ano \| moneda \| ingreso_base \| pres_fijos \| pres_variables \| pres_ahorro` — para que `S13:S15` sea un lookup y no una constante |
| Desglose por cuenta (fase 2) | presupuesto por cuenta del Plan de Cuentas, para comparar contra `W4:X22` / `Z4:AA22` / `AC4:AD22`. Es lo que `CALCU` ya habia disenado con sus columnas `N`/`S`/`X` |

**El cableado en el Tablero son tres celdas**, sin tocar una sola formula existente:

```
S13  =IFERROR(INDEX(Presupuesto!<rango_ingresos>;   MATCH(<mes+ano>; …)); 0)
S14  =IFERROR(INDEX(Presupuesto!<rango_fijos>;      MATCH(<mes+ano>; …)); 0)
S15  =IFERROR(INDEX(Presupuesto!<rango_variables>;  MATCH(<mes+ano>; …)); 0)
```

Con eso, `S17`, `S22:S24` y `T22:T24` empiezan a funcionar por mes. **Requisito previo:
resolver P1** (declarar la moneda del presupuesto y convertirla con la misma convencion
que `I9`).

**Que reutilizar, ya calculado y filtrado por mes** — el Presupuesto no debe re-consultar
`Registros`:

| Dato | Donde vive | Estado |
|---|---|---|
| BD del mes seleccionado | `Tablero!AN4:AZ` | ya filtrada por `I4`/`I6`, ya convertida en `AZ` |
| Real Ingresos / Fijos / Variables | `Tablero!X2`, `AA2`, `AD2` (espejados en `U13:U15`) | netos, en la moneda `I9` |
| Real **por categoria** | `Tablero!W4:X22`, `Z4:AA22`, `AC4:AD22` | agregado por cuenta, ordenado desc |
| Liquidez por moneda | `Tablero!S4:S7` | la base del prorrateo |
| Ahorro real del mes | `Tablero!U17` | — |
| Cotizaciones vivas | `Tablero!AL4:AL6` | — |
| **Serie historica mensual real** | **`Mirada Interanual!G10:R14`** | **Ingresos / Fijos / Variables por mes, 12 meses. Da las proporciones historicas por defecto sin escribir una formula nueva** |

**Lo unico que el Presupuesto tiene que aportar de cero: las proporciones y la base de
ingreso, por mes.**

**Donde ponerlo.** Recomendacion: **hoja propia**, con el Tablero solo consumiendo.
`Espacio blanco 2` (gid `1691890552`, visible, una sola celda) esta disponible como
lienzo. Si en cambio se quiere todo dentro del Tablero, el espacio verificado es:
`U22:U24` (vacia, con su header ya en `U21`), el bloque `Q26:U34` alineado con la columna
de KPIs, y `W24:AD40` para el comparativo por categoria — **este ultimo solo despues de
resolver P7**. Las filas 25 a 705 del Tablero estan completamente libres en las 53
columnas; en las filas 1-24 no queda hueco horizontal.

### 14.8 Las decisiones que necesita Franco antes de que se escriba una formula

Ninguna es tecnica. Ninguna la puede tomar un agente.

1. **¿Que es "Ahorro": residual o medido?** Los cuatro precedentes lo tratan como
   residual (`Ingreso - Fijos - Variables`). Pero si el usuario define tres porcentajes
   que suman 100, **deja de ser residual por definicion**. Y si es medido (suma de
   movimientos hacia proyectos de tipo Ahorro/Inversion), hay que resolver el problema
   del `Traspaso` (14.6.A).
2. **¿`Traspaso` se convierte en cuenta de primera clase** (un bloque nuevo
   "Movimientos internos" en el Plan de Cuentas) **o el Ahorro se mide exclusivamente por
   el eje Medio -> Proyecto?**
3. **¿`Financiacion` (Tarjeta de Credito, Prestamo Mac) entra o no en el bolsillo
   Ahorro?** Hoy el Tablero la mete.
4. **¿`Compra USD` deja de ser Gasto Variable?** Hoy se cuenta doble.
5. **¿En que moneda se define el presupuesto** y como se convierte cuando `I9` cambia?
   (Es P1, y es lo que hoy rompe todo el bloque fuera de ARS.)
6. **La taxonomia, fijada de una vez.** `ANUAL` dice *Gastos basicos / Reserva-Lujos /
   Ahorro*, `CALCU` dice *Gasto Fijo / Gasto Variable / Ahorro*, Franco dice *Gastos
   Fijos / Gastos Variables / Ahorro*. Los tres son el mismo modelo con distinto
   vocabulario, pero **"Reserva / Lujos" no es sinonimo de "Gasto Variable"**: el primero
   es una intencion de asignacion, el segundo una clasificacion contable. Manda la de
   Franco, porque es la que existe en el Plan de Cuentas real.
7. **El nombre de la hoja**, fijado en `00_Config.js` **antes** de crearla, no despues:
   `Inicio!I14` dice "Presupuesto del Mes.", `Tablero!Q11` dice "Control de
   Presupuesto.", `CALCU!B21` dice "PRESUPUESTO".
8. **¿`Inicio` es la portada o un segundo tablero?** (11.1). Si es la portada, el
   Presupuesto se refleja en `I14:K18` y listo. Si es un segundo tablero, hay que
   unificarle los criterios con el Tablero antes de agregarle nada.

---

## 15. Limitaciones declaradas de este escaneo

Lo que **no** se pudo ver, para que nadie le pida a este mapa lo que no tiene.

1. **BOTONES.** Los drawings con script asignado **no son accesibles ni por la Sheets API
   ni por Apps Script**. El rotulo `B13 = "Acciones rapidas"` aparece en `Inicio`,
   `Tablero`, `Cargas`, `Plan de Cuentas`, `Bocetos`, `Espacio blanco 2` y
   `Mirada Interanual backup`: ahi estan los botones. **Se puede inferir que funciones
   existen para ser asignadas** (leyendo `12_MenuService.js`, `11_UIService.js` y
   `MENU_CONFIG`), **nunca cuales estan efectivamente puestas.** Ningun analisis
   automatico va a cerrar esto: se cierra mirando la planilla.
2. **VALIDACIONES DE DATOS (dropdowns): no determinables.** El escaneo pidio
   `userEnteredValue` y `formattedValue`; **cero ocurrencias de `dataValidation` en las
   cuatro tandas.** No se puede confirmar si `Tablero!I4`/`I9`, `Inicio!P4`/`P9`,
   `Mirada!E4`/`R4` o las columnas de `Cargas` tienen lista desplegable o son texto
   libre. **Importa:** si son texto libre, un typo (`"junio"`) produce `MATCH` → `#N/A` y
   tumba la hoja. Inferencia fuerte, no dato: `Plan de Cuentas!Y4:Y79` (los 76 nombres
   consolidados) **no lo consume ninguna formula de la planilla**, asi que su unico
   destino razonable es ser el rango fuente del dropdown de `Cargas!K` — y si es asi,
   **28 de esas 76 opciones son medios de pago**, no cuentas de resultado. Se cierra con
   una tanda pidiendo `fields=sheets(data(rowData(values(dataValidation))))`.
3. **No se leyeron**: `merges`, `conditionalFormats`, `charts`, `protectedRanges`,
   `bandedRanges`, formato de celda ni notas. Por lo tanto **este mapa no dice nada sobre
   graficos ni sobre reglas de formato condicional**, y no puede confirmar si la
   proteccion del Plan de Cuentas tiene `protectedRanges` nativos ademas del trigger
   `appOnEdit`. Si ese trigger se cayo, la hoja esta desprotegida **sin ninguna senal
   visible**, y desde aca no se puede saber.
4. **Deteccion de errores por coincidencia de texto.** Se busco `#REF!`, `#N/A`,
   `#ERROR!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#NUM!`, `#NULL!` en `formattedValue`, no
   `effectiveValue.errorValue`. No distingue un error real de una celda que contenga
   literalmente esa cadena.
5. **De `Registros`, `Tipos de cambio` y `BD Antigua` solo se trajo la estructura**
   (headers y primeras filas). **Los 2.903 registros del ledger no fueron auditados.**
   Todo lo que este mapa afirma sobre el contenido del ledger sale de esas primeras
   filas, del panel de ultimos 15 movimientos, o de los valores calculados que muestran
   las vistas. La medicion pendiente de 13.4 es exactamente esto.
6. **`Copia de Plan de Cuentas` quedo truncada en la fila 30**: no se puede afirmar si su
   contenido debajo de esa fila coincide con el de la hoja real.
7. **Las cuatro hojas `RESP_*` no fueron escaneadas.** Su rol se deduce del nombre.
8. **Este escaneo esta FUERA del protocolo de la seccion 7.** No genero snapshot JSON
   versionado ni regenero `INVENTARIO_CELDAS.md` / `celdas.tsv`, asi que **los derivados
   mecanicos del repo siguen reflejando marzo de 2026 y el layout pre-migracion.** Correr
   el scanner (`98_DevTools_Scanner.js`) y versionar el resultado es deuda abierta.
9. **Es una foto del 2026-08-13.** Lo estable es la estructura; los valores no.

---

*Parte II — escaneo de cobertura total del 2026-08-13 por Sheets API. Cierra las
limitaciones 2 y 5 de la seccion 8 (resultado calculado y GIDs) y deja abiertas la 1
(validaciones de datos) y la 6 (rangos protegidos, graficos, formato condicional).
Proxima revision obligatoria: despues de crear la hoja `Presupuesto`, o despues del
primer escaneo con el scanner de Apps Script versionado segun el protocolo de la
seccion 7 — lo que ocurra primero.*
