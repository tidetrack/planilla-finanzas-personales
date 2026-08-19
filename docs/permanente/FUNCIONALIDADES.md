# Funcionalidades - Planilla de Finanzas Personales (v4)

> Documento funcional de la planilla "PLANILLA FINANZAS_v4 .WIP | Personal", escrito por
> Franco el 2026-08-18 al declarar definitivas las hojas " - Fix", y VALIDADO formula por
> formula contra el export de la planilla viva (2026-08-18 18:51) por 8 auditores
> independientes. Cada funcionalidad lleva su estado real:
>
> - **FUNCIONA**: cableada y verificada contra formulas concretas.
> - **PARCIAL**: existe pero con defectos o dependencias sin conectar.
> - **PENDIENTE**: declarada en el doc pero sin motor de calculo (fase de formulerio).
> - **ROTO**: formulas con error visible (#REF!, #VALUE!) o resultados incorrectos.
>
> Los nombres de hoja son los CANONICOS post-swap v0.11 (MIGRACION_v0.11_SwapHojasFix.js).
> La geometria de referencia vive en 00_Config.js (SSOT) y en MAPA_HOJAS.md.

---

## 01 | Inicio

Dos funciones a grandes rasgos: ver el capital y el flujo de fondos.

**Layout**: titulo C2:C4; filtros F2:G4 (G2 mes, G3 anio, G4 moneda); KPI Saldo Actual C7:C8;
KPI Capital Acumulado F7:F10; calendario J7:P14; KPI Ingresos C12:C15; KPI Egresos F12:F15;
Presupuesto del Mes C17:G22; staging del periodo T7:AF1005; staging del mes anterior AH7:AT1005.

**Motor**: dos QUERY (T8 y AH8) traen de `Registros` todos los movimientos del periodo
seleccionado y del inmediato anterior, y los derraman como staging. Todos los KPI agregan
sobre esos derrames, cruzando el Medio contra el Plan de Cuentas (categoria del medio y tipo
de la categoria).

| Funcionalidad | Estado | Detalle |
|---|---|---|
| 1. Ingresos vs Egresos con delta vs periodo anterior | FUNCIONA | C13/F13 (QUERY que excluye Traspaso y trata el arrastre 'Inicio Mes' por tipo) + C15/F15 (delta % contra el staging del mes previo). |
| 2. Presupuesto del Mes (Presupuesto / Realidad / Consumo / Distribucion de fondos disponibles) | PENDIENTE | Existen los headers (C18:G18) y las 4 filas (Ingresos, Gastos Fijos, Gastos Variables, Capacidad de Capitalizacion); D19:G22 esta vacio, sin formulas. Depende de cablear la hoja Presupuesto. |
| 3. Calendario con colores (rojo egresos, verde ingresos) | PARCIAL | La grilla J9:P14 es ESTATICA (junio 2026): no se recalcula al cambiar G2/G3. Los colores serian formato condicional (no verificable en el export). |
| 4. Capital: saldo acumulativo de proyectos de ahorro+inversion | PARCIAL | F8 suma el mes seleccionado apoyandose en los arrastres 'Inicio Mes' (no es una suma historica completa). El "% de Crecimiento historico" (F10) es TEXTO estatico, sin formula. |
| 5. Filtros de periodo y moneda | FUNCIONA | G2/G3 alimentan los dos motores; G4 alimenta el Saldo Actual y el header 'Valor en X' del staging. |

**Deuda critica de taxonomia** (celdas corregidas el 2026-08-19 contra la planilla viva; la
lista anterior de esta ficha estaba mal): las que comparan contra el tipo `'Liquidez'` son
**F8, C13, F13, C15 y F15** -- cinco celdas, siete ocurrencias. Ese tipo NO EXISTE en el Plan
de Cuentas nuevo: la categoria 'Medio Cotidiano' hoy es tipo `'Hogar'` (los tipos son
Ahorros / Inversiones / Financiacion / Hogar), asi que la condicion nunca se cumple. Efecto:
F8 (Capital Acumulado) esta contando el gasto cotidiano como capital, y C13/F13 excluyen
TODOS los arrastres 'Inicio Mes' cuando deberian dejar entrar los de medios cotidianos.

**C8 NO esta roto** -- filtra por el NOMBRE de la categoria ("Medio Cotidiano"), no por el
tipo, asi que hoy da el numero correcto. Es fragil (hardcodea un dato de catalogo) pero
fragil no es roto: se deja como esta.

Reparado el 2026-08-19 por `DEVTOOL_FormulerioV0111.js`.

**SEXTO DEFECTO, hallado despues y mas caro que el anterior: `Inicio` nunca convirtio moneda.**
Las dos columnas "Valor en X" (`AF8`, mes actual; `AT8`, mes anterior) leen la moneda de la
columna de **Cuenta** (`V` y `AJ`) en vez de la de **Moneda** (`Y` y `AM`). Ninguna rama del `IF`
se cumple nunca, `tasa_origen` cae al literal `1`, y la columna entera es un passthrough del
monto crudo: **todo movimiento en moneda extranjera entra a C13, F13, C15 y F15 a valor
nominal.** Un cobro de 200 USD cuenta como 200 pesos. Medido en junio de 2026: C13 mostraba
$1.268.947,31 cuando el ingreso real convertido es $1.645.337,26 -- **$376.740 desaparecidos, el
23% del mes**. `AT8` ademas tomaba la moneda de destino de `Y13`, que no es un selector sino la
celda con la moneda del **sexto movimiento del mes actual**; el rotulo `AT7` repetia la
referencia. `C8` y `F8` no estaban afectadas: convierten por su cuenta y usan `Y8:Y` bien.
Reparado en v0.12.1, **pendiente de correr**.

---

## 02 | Tablero

Vista mensual en profundidad. Franco declaro al entregarlo: "faltaria ajustar todo el sistema
de formulas para que dispare correctamente la informacion".

**Layout**: titulo y filtros C2, L2:N4; calendario C7:I14; Medios Bancarios C16:H22;
Presupuesto Asignado L7:O12; Movimientos del Mes L14:O19; Disponibilidad de fondos L21:O25;
Comprobacion de Traspasos L27:L28; vistas generales de cuentas R7:Y27 y AA7:AC; Saldos
Actuales AE7:AG12; Cotizaciones AE15:AF19; motor "Registros del Mes" AJ2:AV+.

**Motor**: QUERY en AJ6 sobre `Registros` filtrando por mes/anio (N2/N3); todo lo demas
agrega sobre ese derrame. Cotizaciones por funciones Apps Script custom
(`tidetrack_usd`/`TIDETRACK_AUD`/`tidetrack_EUR`).

| Funcionalidad | Estado | Detalle |
|---|---|---|
| 1. Calendario | PARCIAL | Fechas estaticas (dic-2025/feb-2026), no derivan de N2/N3. |
| 2. Medios bancarios | FUNCIONA | Cableado y devolviendo valores. |
| 3. Presupuesto asignado | PENDIENTE | N9:N11 son constantes tipeadas a mano; no lee de la hoja Presupuesto. |
| 4. Movimientos del mes | **FUNCIONA** | Reparado y **verificado contra el ledger**: N16 = $1.118.535,58, N17 = $455.797,31, N18 = $250.665,80 (Enero 2026, ARS) coinciden **al centavo** con una reconstruccion independiente desde las 3.458 filas crudas de `Registros`. N19 paso de $63.567.848 a **$372.451,30**, tambien reproducible. La columna AV derrama 79 filas, cero ceros, y `AV = monto x tasa_origen / tasa_destino` cierra en 10 de 10 muestras. |
| 5. Disponibilidad de fondos | **PARCIAL - fix pendiente de correr** | La columna N quedo **reparada y rotada bien** (N23 = N17/N10 = 81%, N24 = N18/N11 = 8%, N25 = N19/(N9-N10-N11) = 103%, cada una bajo su rotulo). **O23:O25 quedaron PEOR que antes**: pasaron de `#REF!` a `#ERROR!` por un bug de escape de `$` en la v0.12.0 (ver CHANGELOG v0.12.1). La v0.12.1 lo repara; falta correr "Aplicar" de nuevo. |
| 6. Comprobacion de traspasos (suma 0) | **FUNCIONA** | L28 dice "Traspasos balanceados", y es un **verde legitimo, no un falso verde**: verificado contra el ledger (Enero 2026: Traspaso/Ingreso $197.000,62 = Traspaso/Egreso $197.000,62) y con AV poblada -- 79 valores no nulos que suman $3.209.995,33 --, asi que la suma cero no viene de sumar ceros. |
| 7. Vistas generales de cuentas | **FUNCIONA** | R9/U9/X9 devuelven cuentas y montos; S7/V7/Y7 cierran contra N16/N17/N18. El bloque Categorias (AA9) dejo de estar vacio: devuelve "Chanchito" $365.751,30 y "Meta de Ahorro 1" $37.000,00. |
| 8. Saldos actuales | **FUNCIONA** | AF9 paso de -$791.499,05 a **$51.509,27**, recalculado y exacto; AG9 = $37.000 y AG10 = 241,42 USD, ambos verificados. Nota: AF9:AF12 filtran por el NOMBRE de la categoria ("Medio Cotidiano") en vez de por su tipo -- fragil, pero da el numero correcto. |
| 9. Cotizaciones | FUNCIONA | Via funciones custom del script. La serie diaria llega al 2026-08-18 en las cuatro monedas tras correr "Forzar carga historica" (verificado 2026-08-19 sobre valores crudos). |

### El defecto estructural, ya identificado y con reparacion escrita

`Tablero!AJ6` es el **motor entero** de la hoja: un unico QUERY sobre `Registros!B6:M` que
derrama doce columnas **desde la fila 6** (AJ=Monto, AK=Tipo, AL=Cuenta, AM=Tipo de Cuenta,
AN=Medio, AO=Moneda, AP=Fecha, AQ=Nota, AR/AS/AT/AU=los TC congelados). Quince formulas
consumidoras piden la **fila 9**. Cada monto se aparea con el tipo, la moneda y la cotizacion
del movimiento tres filas mas abajo. **No da error: da otro numero.** Explica que N19 declare
$63.567.848 de capitalizacion en un mes -- montos en pesos multiplicados por la cotizacion del
dolar porque cayeron en el bucket de moneda equivocado.

Junto con el selector de moneda perdido (17 `#REF!` en 8 celdas), el bloque rotado y el tipo
`'Liquidez'` huerfano (14 celdas contra un tipo que el catalogo nuevo ya no tiene; su
equivalente 1:1 es `Hogar`), son los cuatro defectos que repara
**`DEVTOOL_FormulerioV0111.js`** -- *Tidetrack Dev > Formulerio v0.11*.

> **Estado al 2026-08-19: Franco corrio "2. Aplicar". El apareamiento quedo corregido** -- en la
> prueba de corrimiento, 73 de 76 filas del derrame coinciden con la MISMA fila del ledger contra
> 40 con la fila +3 --, **y las siete agregaciones recalculadas cierran al centavo**. Pero esa
> corrida **rompio O23:O25** (bug de escape de `$`, ver CHANGELOG v0.12.1) y dejo al descubierto
> un **sexto defecto**: la conversion de moneda de "Inicio" nunca convirtio. La v0.12.1 repara
> las dos cosas; **falta correr "2. Aplicar" otra vez**.

Fuera de alcance declarado: el Plan de Cuentas tiene una fila huerfana (P19/Q19, sin nombre y
con tipo Hogar) y un duplicado ("Meta de Ahorro 3" en P17/P18) -- es dato, no formula. Y
`Inicio!C15`/`F15` devuelven "0% respecto del mes anterior" con `C13` en $1,27M: es un **quinto
defecto**, distinto de estos cuatro, sin diagnosticar.

---

## 03 | Presupuesto

Hoja completamente nueva (sin contraparte vieja). Base declarada: listas por composicion con
monto historico promedio (ponderado hacia lo reciente) + monto presupuestado a mano; el
presupuesto del mes define la asignacion proporcional y alimenta el Presupuesto del Mes de
Inicio y el Presupuesto Asignado del Tablero.

**Layout**: titulo C2; selectores I2:J4 (mes/anio/moneda); resumen "Movimientos Promedio
historicos" C7:F12; resumen "Presupuesto del Mes" C14:F19; listas Ingresos I7:K1005,
Gastos Fijos M7:O1005, Gastos Variables Q7:S1005, Categorias U7:X1005 (cada una con
Monto Historico y Monto Presupuestado).

| Funcionalidad | Estado | Detalle |
|---|---|---|
| 1. Monto historico promedio por cuenta | PENDIENTE | No hay ninguna formula contra Registros ni poblado de cuentas desde el Plan. Solo existe la capa de agregacion (SUMs de listas vacias: todo da 0). |
| 2. Monto presupuestado manual + comparacion | PENDIENTE | Columnas presentes, sin datos ni formula de comparacion. |
| 3. Presupuesto del mes que alimenta Inicio/Tablero | PENDIENTE | Nada lo consume todavia. |
| Selectores de periodo/moneda | PENDIENTE | Las celdas existen; ninguna formula las referencia. |

**Contrato de arranque del formulerio**: el cableado debe partir del contrato de calculo del
2026-08-13 documentado en las cabeceras de `DEVTOOL_Presupuesto.js` y
`DEVTOOL_CableadoPresupuesto.js` (ambos NO LISTO y fuera del menu; sus bloqueantes estan
enumerados ahi). Defecto ya detectado en las formulas existentes: F17:F19 dividen por el
ingreso HISTORICO ($E$9) en vez del presupuestado (E16) — decidir la base antes de poblar.

---

## 04 | Cargas

Centro de carga de movimientos en lotes de 15.

**Layout**: titulo B2; numeracion del lote B7:B21; headers C6:I6 (Monto, Tipo, Cuenta, Medio,
Moneda, Fecha, Nota); bloque de carga C7:I21; vista "Ultimos 15 movimientos" M6:S21 (motor:
una QUERY en M7 sobre `Registros`, ORDER BY fecha DESC LIMIT 15).

| Funcionalidad | Estado | Detalle |
|---|---|---|
| 1. Carga por lotes de 15 registros | FUNCIONA | Grilla C7:I21 + `procesarCargas` del script (config remapeado en v0.11). Dropdowns: Tipo (lista fija), Cuenta (Plan!S consolidada), Medio (Plan!L), Moneda (lista fija) — los dos del Plan los reconstruye el swap. |
| 2. Vista ultimos 15 movimientos | FUNCIONA | Post-swap lee la BD canonica. Deuda: rango cerrado hasta la fila 3371 (cuando Registros crezca mas alla, la vista deja de ver lo nuevo; pasar a rango abierto en el formulerio). |
| Fixes esteticos | PARCIAL | La Fix limpio restos de la vieja (rotulo huerfano, formulas #REF!). Pendientes: typo "Utimos" en M2 y formato de fecha en R7:R21 (hoy seriales). |

### Modo de falla nuevo desde v0.11.1: una fecha futura aborta el lote completo

Desde el 2026-08-18 `fetchArsRate` LANZA ante una fecha posterior a hoy en vez de devolver la
ultima cotizacion publicada como si fuera la del dia pedido. Es lo correcto — el tipo de cambio
de un dia que todavia no ocurrio no existe, y hasta ahora quedaba congelado en el registro sin
dejar rastro — pero cambia el habito diario: **una sola fila de la grilla con la fecha mal
tipeada (el ano, tipicamente) frena el procesamiento de las 15**.

Que se ve: el alert "Fallo en el procesamiento" con la fecha pedida y el dia de hoy. Que pasa
con los datos: **nada se escribe** y la grilla C7:I21 queda intacta, con el lote completo listo
para corregir la fecha y volver a "Procesar Cargas". Es todo-o-nada a proposito: escribir "las
que se pudo" partiria el lote en dos sin dejar forma de saber cuales entraron.

El caso hermano —dias sin cotizacion publicada (fin de semana, feriado)— NO aborta: se resuelve
con la cotizacion del dia habil anterior y el toast de cierre informa **cuantas filas del lote**
quedaron con el TC de otra fecha, con el detalle por fecha en el log.

---

## 05 | Plan de Cuentas

Catalogo maestro puro (cero formulas de negocio): la fuente de verdad de cuentas, medios y
categorias.

**Layout**: titulo C2; Ingresos C6:D18 (11 cuentas); Gastos Fijos F6:G22 (15); Gastos
Variables I6:J29 (22); Medios Bancarios L6:N35 (28 medios con Moneda y Categoria);
Categorias P6:Q19 (Nombre/Tipo). Headers de bloque fila 6, headers de columna fila 7,
datos desde fila 8. Columna S (agregada por el swap v0.11): consolidacion de las cuentas de
los 4 bloques, fuente del dropdown de Cuenta en Cargas (espeja la columna Y del Plan viejo).

| Funcionalidad | Estado | Detalle |
|---|---|---|
| 1. Cinco registros (Ingreso / Gastos Fijos / Gastos Variables / Medios / Categorias) | FUNCIONA | Validado 1:1 contra los datos. La nocion "Proyecto" pasa a llamarse "Categoria". |
| 2. Categorias generales (macrosegmentacion) | FUNCIONA | Los tipos de Q son exactamente Ahorros / Financiacion / Inversiones / Hogar (ej.: Europa -> Ahorros). Dropdown en Q y en las columnas Categoria de cada bloque (fuente P8:P37). |
| 3. Distribucion de medios / traspaso Hogar->Ahorro = capitalizacion | PARCIAL | La estructura lo soporta (cada medio tiene Categoria, cada Categoria tiene Tipo; 'Medio Cotidiano' es tipo Hogar), pero ninguna vista lo computa todavia con la taxonomia nueva (ver deuda 'Liquidez' en 01-Inicio). |

**Suciedad detectada en el catalogo** (limpiar con Franco):
- Bloque residual C1005:N1033: ~29 filas de movimientos estilo Registros (mayo 2025)
  incrustadas en la hoja. La columna S del swap se acota a la fila 1000 para no ingerirlas.
- 'Meta de Ahorro 3' duplicada (P17 y P18) y fila huerfana Q19='Hogar' sin nombre en P19.
- Cuentas eliminadas del catalogo nuevo que siguen en el historico de Registros (Seguro
  Compu, Seguro Celu, Pago Tarjeta MP, Medicamentos / Accesorios, Gastos - Tidetrack): sus
  movimientos historicos quedan fuera de cualquier vista que enumere desde el catalogo.
- 'Traspaso' y 'Ajuste' aparecen como cuentas en el historico pero no estan en ningun
  catalogo (ni viejo ni nuevo): decidir si se catalogan o se documentan como cuentas
  virtuales del sistema.
- Las columnas Categoria por cuenta individual (D, G, J) existen solo como header: estan
  vacias en todas las filas. La Categoria efectiva opera en Medios (N) y en el bloque P:Q.

---

## 06 | Mirada Interanual

Resumen de categorias con vision interanual y tendencias.

**Layout**: titulo C2; filtros G2:I4 (I2 mes, I3 anio, I4 moneda) y M2 (proyecto); tabla
C7:R11 (conceptos x 12 meses; columna E = total interanual por concepto; fila 11 =
Capitalizacion); zona de graficos desde C13.

| Funcionalidad | Estado | Detalle |
|---|---|---|
| 1. Resumen de categorias en 12 meses | FUNCIONA | 36 formulas LET/SUMPRODUCT sobre Registros. OJO: la ventana NO es anio calendario sino movil (mes de referencia -4 a +7, columna K = mes seleccionado). |
| 2. Capitalizacion | PARCIAL | NO se suma del ledger: es el residual Ingresos - Gastos Fijos - Gastos Variables (puede dar negativa). Es "capacidad de capitalizacion", no capitalizacion efectiva. |
| 3. Tendencias (graficos) | NO VERIFICABLE | Los exports no incluyen charts; solo existe el rotulo C13. |
| 4. Filtro por periodo | FUNCIONA | I2/I3 mueven la ventana. |
| 5. Filtro por moneda | NO VERIFICADO | I4 existe y la arquitectura de formula incluye conversion, pero el tramo quedo truncado en el export. |
| 6. Filtro por proyecto | PENDIENTE | M2 ('Todos') es decorativo: ninguna formula lo referencia. |

**Relacion con el script**: esta era la unica hoja GENERADA por script
(`07_MiradaInteranual.js`). Las formulas de la Fix son las del modulo, pero la hoja movio
selectores y filas (el script espera E4/F4/R4 y rotulos C10:C12; la Fix usa I2/I3/I4+M2 y
C8:C10). El preflight del modulo bloquea sin escribir; re-alinear las constantes MIRADA_* es
parte del formulerio. Los rangos estan cerrados en la fila 883 (verificar en vivo; dejar
abiertos al regenerar).

---

## 07 | Bases de datos (no estaban en el doc de Franco)

### Registros

BD transaccional de movimientos. Titulo B2 ("Hoja de Registros."), headers fila 6 (B6:M6),
datos desde fila 7 en B:M, orden por fecha descendente. Columnas: Monto, Tipo
(Ingreso/Egreso), Cuenta, Tipo de Cuenta, Medio, Moneda, Fecha (timestamp), Nota, y
Valor ARS/USD/AUD/EUR: snapshot de cotizaciones del dia del registro, pegado como valor.
Ese snapshot CONGELA el tipo de cambio historico: es el unico dato del ledger que despues no
se puede recalcular. Escriben: `procesarCargas`, `recalcularTcRegistros`, migraciones.

### Tipos de Cambio

BD de cotizaciones diarias. Titulo C2, nombres de moneda fila 6, headers fila 7, datos desde
fila 8: C:D Peso Argentino (siempre 1.0, moneda base), F:G Dolar Estadounidense, I:J Dolar
Australiano, L:M Euro. Una fila por dia (timestamp 09:00), orden descendente. Escribe:
`15_ExchangeRateApi` (`forzarCargaHistorica` + actualizador). **Pendiente de diagnostico: no
hay filas nuevas desde el 2026-08-13** — revisar el trigger instalable del FX.

---

## Pendientes del formulerio (fase siguiente, hoja por hoja)

Lo que el swap v0.11 NO resolvio a proposito (repuntear a ciegas habria corrompido en
silencio). En orden sugerido:

1. ~~**Taxonomia 'Liquidez' huerfana (Inicio)**~~ y ~~**Tablero: AV, #REF!, desfase de
   anclas, SUMIFS de traspasos, filas de cumplimiento**~~ -- **DIAGNOSTICADOS Y CON
   REPARACION ESCRITA** el 2026-08-19. Resultaron ser cuatro defectos de una sola raiz, que
   se intersectan sobre las mismas celdas: arreglar uno a mano arriesgaba pisar los otros.
   Van juntos, en una sola pasada, por `DEVTOOL_FormulerioV0111.js`
   (*Tidetrack Dev > Formulerio v0.11*). La regla de taxonomia quedo definida por medicion,
   no por eleccion: `'Liquidez'` -> `'Hogar'` es una sustitucion **1:1** -- en el catalogo
   viejo 'Medio Cotidiano' era tipo 'Liquidez' y hoy es tipo 'Hogar', y ninguna otra
   categoria usa 'Hogar'. El conjunto "capital" (Ahorros + Inversiones + Financiacion) queda
   identico al de antes.
   **Corrido el 2026-08-19 y auditado en vivo.** Resultado: el apareamiento quedo corregido y
   las siete agregaciones recalculadas contra el ledger cierran al centavo, PERO la corrida
   rompio `O23:O25` (pasaron de `#REF!` a `#ERROR!`). Reparado en v0.12.1 junto con el sexto
   defecto. **PENDIENTE: correr "2. Aplicar" una segunda vez.**
   Queda abierta una decision de negocio que el arreglo NO toma: `Financiacion` (Tarjeta de
   Credito, Prestamo Mac) sigue contando como capital, igual que antes. Una tarjeta es un
   pasivo; si Franco quiere cambiarlo, es una linea mas en la misma pasada.
2. **Quinto defecto -- `Inicio!C15`/`F15` siempre en "0%"**, aunque la variacion real del mes
   sea de +155%. Diagnosticado el 2026-08-19: cuatro condiciones se ligan a variables de `LET`
   **sin envolverlas en `ARRAYFORMULA`**; la comparacion rango-contra-escalar se evalua por
   interseccion implicita, `FILTER` recibe una condicion de una sola fila, tira error de
   tamanio, y el `IFERROR` externo lo convierte en 0. Con los dos meses en 0, `TEXT` imprime la
   tercera seccion del formato. Correccion propuesta: envolver `cond_ingreso_act`,
   `cond_no_traspaso_act` y sus gemelas `_ant` en `ARRAYFORMULA` (cuatro lineas en `C15`, dos en
   `F15`). NO aplicado todavia: es un mecanismo de falla distinto y no esta verificado de forma
   independiente.
3. **Presupuesto**: cablear monto historico promedio (contrato del 2026-08-13 en los
   DEVTOOL), poblar cuentas desde el Plan, conectar los selectores, decidir la base de los
   porcentajes (E16 vs $E$9), y recien despues conectar Inicio (D19:G22) y Tablero (N9:N11).
4. **Mirada Interanual**: re-alinear las constantes MIRADA_* del script con la hoja nueva
   (o regenerar la hoja desde el script); abrir los rangos cerrados en 883; decidir el rotulo
   Capitalizacion vs Resultados; cablear o quitar el filtro Proyecto.
5. **Calendarios** (Inicio y Tablero): derivarlos del periodo seleccionado.
6. **Cargas**: rango abierto en la vista de ultimos 15; typo M2; formato de fecha R7:R21.
7. **FX**: diagnosticar el trigger del actualizador (sin filas desde 2026-08-13).
8. **Limpieza del catalogo**: residual C1005:N1033, 'Meta de Ahorro 3' duplicada, Q19
   huerfana, decision sobre cuentas historicas eliminadas y sobre 'Traspaso'/'Ajuste'.
9. **Integridad del ledger** (nuevo, medido el 2026-08-19): **203 de 3.458 filas (5,9%) no
   tienen Tipo de Cuenta** -- 122 Ingreso y 81 Egreso; 2024: 22, 2025: 41, 2026: 140. El patron
   dominante son pares Egreso/Ingreso de `Traspaso`, y hay filas con Cuenta directamente vacia.
   Es el gap de validacion de `procesarCargas` (filtra solo por Monto no vacio) materializado.
   Consecuencia concreta ya observada: en enero 2026 hay un movimiento de **$302.209 con Tipo de
   Cuenta y Medio vacios que es invisible para TODO el Tablero** -- esta en el derrame pero
   ningun bloque lo recoge. Dos frentes: cerrar el gap en `procesarCargas` y sanear lo existente.
10. **Las patas de Egreso de los Traspasos llevan Tipo de Cuenta "Ingreso"** en el derrame. Hoy
   es inocuo porque todos los bloques excluyen `Cuenta = 'Traspaso'`, pero cualquier agregacion
   futura que no lo haga va a sumar ~$394.001 de traspasos como ingreso.

---

*Generado el 2026-08-18. Fuentes: doc funcional de Franco (2026-08-18), export de la
planilla viva (2026-08-18 18:51), validacion por 8 auditores independientes, script
productivo v0.10.0. Actualizar junto con cada release que toque hojas o formulas
(regla changelog-obligatorio).*
