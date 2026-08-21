# CHANGELOG - Tidetrack Personal Finance

Historial de versiones y cambios significativos del proyecto.

**Formato:** Las versiones mas recientes aparecen primero (orden cronologico inverso).

> Nota: el historial canonico y completo vive en `src/ZZ_Changelog.js`.
> Este archivo refleja los releases principales para lectura humana rapida.

---

## v0.32.0 - La hoja Inicio queda terminada (2026-08-21)

El bloque **"Presupuesto del Mes"** (`C17:H22`) pasa a tener sus cuatro columnas vivas:

| Columna | Que muestra |
|---|---|
| D | Lo proyectado del mes, desde la BD de Proyeccion |
| E | Lo realmente registrado |
| F | Barra de consumo 0–100% con el semaforo de la planilla anterior |
| G | Distribucion de fondos, con el mismo reparto de tres regimenes del Tablero |

Mas los tres deltas (capital, ingresos, egresos) contra la media de los ultimos 6 meses. `C15`/`F15`
reemplazan formulas que daban **0% eterno**.

Inicio tiene **selectores propios** (`I2`/`I3`/`I4`), independientes de los del Tablero: todas las
formulas nuevas anclan ahi.

### E22 no es un residuo

El plan asigna, la realidad se mide — la misma decision que rige el Tablero desde la v0.31.0. `D22`
es el residuo (lo unico que cierra la asignacion en 100%) y `E22` mide la capitalizacion efectiva.

Y **no es una formula nueva**: es la misma de `Tablero!O19`, parametrizando los selectores. Una
copia habria divergido en el primer arreglo hecho en una sola de las dos hojas, y entonces Inicio y
Tablero mostrarian capitalizaciones distintas para el mismo mes sin que nada lo delate.

### El patron del delta lleva punto, no coma

`'+0.0%;-0.0%'`. El lenguaje de `setNumberFormat` es **independiente del locale** (`.` siempre
decimal, `,` siempre miles) y Sheets lo *renderiza* con coma en es_AR. Con `'+0,0%'` — que es como
se ve el resultado, y por eso engana — el decimal desaparecia: `+35%` en vez de `+34,5%`, sin
ningun error. Distinto de `TEXT()`, que si es locale-aware.

### El modulo estaba sin cablear

Sus tres funciones no figuraban en `MENU_CONFIG`: 964 lineas inalcanzables, mientras sus propios
dialogos mandaban a un menu inexistente.

**Guard nuevo:** el banco verifica que toda funcion invocada por el menu exista en `src/`. El menu
las llama **por string** — un typo o un modulo sin cablear no lo detecta nada: el item aparece y
explota al apretarlo.

`Inicio!C15` y `F15` salen de `DEVTOOL_StockYFlujo`. Es la cuarta celda que se saca de un modulo
por la misma razon (`N19`, `O16`, y estas dos).

## v0.31.1 - Reanclaje al rediseno manual: los montos viven en O (2026-08-20)

Franco rediseno a mano `L7:O19`: movio los **montos** de la columna N a la O, dejo los % del plan en
N como formulas suyas, y **elimino** el % del bloque de la realidad — *"nunca me iba a dar 100% y
era irrelevante"*, que es exactamente correcto desde la v0.31.0.

### Una correccion de diagnostico, anotada porque el error de razonamiento importa mas que el fix

Se anuncio que la Disponibilidad de fondos habia quedado **rota** leyendo `$N$10`/`$N$17`. **Era
falso**, y se comprobo midiendo `O23:O25` en vivo: ya referenciaban `$O$10`/`$O$17`.

Cuando se **mueve** contenido de una columna a otra, Sheets reajusta solas todas las formulas que
lo referencian — exactamente lo contrario de lo que pasa cuando un bloque se **reconstruye a
mano**, que fue el caso de `$AF$17` en la v0.24.0 y quedo como analogia equivocada.

**El reanclaje igual era necesario, por el motivo inverso:** los modulos *generan* las formulas con
las referencias viejas, asi que la proxima corrida de "Aplicar" habria **deshecho** el reajuste que
Sheets hizo bien. El riesgo no estaba en la hoja: estaba en el codigo esperando a correr. Tras el
reanclaje, "Aplicar" reporta "ya estan como corresponde" y no escribe nada.

`DEVTOOL_Proyeccion` escribe `O9:O11`; `DEVTOOL_Capitalizacion` escribe `O12` y `O19`. **El modulo
ya no escribe ningun porcentaje** — esa columna es de Franco, y un modulo que la escribiera pisaria
su trabajo en la proxima corrida.

### Un bug grave encontrado al pasar

`_planCap` habia quedado definida **cuatro veces** en el mismo archivo, resultado de cirugias de
texto acumuladas. En Apps Script la ultima definicion pisa a las anteriores **en silencio** —
`node --check` no protesta, la planilla tampoco — asi que se podia estar editando un cadaver
creyendo editar el codigo vivo.

Quedo una sola, y el banco ahora barre todo `src/` y falla si una funcion esta definida dos veces.

## v0.31.0 - El plan asigna, la realidad se mide (2026-08-20)

> "N19 no debe ser una resta de descarte. Aca si va el valor registrado del mes: lo que se haya
> realmente ahorrado y/o invertido." — Franco

El modelo completo, que cierra el ciclo de todo el dia:

| Celda | Bloque | Que es |
|---|---|---|
| `N12` | Plan | El **residuo** `Ingresos - Fijos - Variables`. Un presupuesto asigna, y el residuo cierra la asignacion en 100%. Nunca negativo: el plan se recorta antes que proyectar desahorro. |
| `N19` | Realidad | La **capitalizacion efectiva**: el flujo neto del mes hacia los medios de Ahorros e Inversiones, traspasos incluidos, con signo. Negativo = ese mes se saco de los frascos. |

La formula de `N19` es la que la v0.26.0 construyo, la v0.29.0 retiro a git — *"para cuando tenga
su propio lugar"* — y esta version trae de vuelta **a su lugar**.

**Consecuencia asumida:** el bloque de la realidad no suma 100%. La diferencia entre los ingresos
reales y la suma de los tres destinos es la plata que quedo sin asignar, o el gasto por encima del
ingreso. En el plan esa diferencia no existe por construccion; en la realidad **es el dato**.

La Disponibilidad de fondos sale ganando sin tocarla: su remanente de capitalizacion (`N12 - N19`)
pasa a significar *"cuanto de lo planeado falta efectivamente capitalizar"*.

## v0.30.1 - La pata de traspaso pierde su Tipo de Cuenta (2026-08-20)

Con el recorte v0.30.0 aplicado, `N12` quedo igual en `-$196.914`: el ajuste recorto 122 mil
cuando el deficit real era 319 mil.

**Causa:** algunas patas de traspaso vienen con "Ingreso" cargado en Tipo de Cuenta. El balance del
recorte las conto como ingreso; la hoja las excluye por cuenta neutra. Dos varas distintas — y la
diferencia era exactamente el monto de esos traspasos proyectados.

**Correccion:** en la lectura, toda pata de traspaso pierde el Tipo de Cuenta que traiga. Un
traspaso capitaliza; no ingresa ni gasta en ningun bloque. El traspaso tampoco se recorta:
capitalizar es el objetivo del plan, no el problema.

## v0.30.0 - Ningun mes se proyecta con desahorro (2026-08-20)

> "Cuando proyectamos entonces, lo hacemos por descarte? Eso se entiende. Ahora quiero que
> revises las proyecciones y hagas que no se proyecte un mes con un desahorro." — Franco

Se proyecta por descarte (la Capacidad es el residuo, v0.29.0), y ahora el plan ademas garantiza
que ese residuo no nazca negativo: **un plan con desahorro adentro no es un plan, es una
resignacion.**

### Como recorta

Si el gasto historico del mes proyectado supera al ingreso historico, el plan se recorta:

1. **Primero los gastos variables**, todos en la misma proporcion — es el unico lugar donde un
   plan puede ceder: los variables son, por definicion, lo que uno decide mes a mes.
2. **Solo si los fijos solos ya superan al ingreso** se recortan tambien los fijos, y el reporte
   lo marca como **anomalia estructural**: ningun recorte de planilla arregla que los contratos
   cuesten mas que el sueldo.

El piso `capacidad = 0` se logra **por recorte del plan, no por tapado** — la identidad
`Ingresos = Fijos + Variables + Capacidad` se cumple con los numeros recortados. (El tapado fue el
error de la v0.27.0.)

### Multi-moneda, y un bug que el banco atrapo

El balance se convierte a ARS con `TIDETRACK_USD/AUD/EUR()` y el factor se aplica a cada linea en
su moneda; los gastos se redondean hacia abajo para que el piso no se perfore por centavos.

Probando eso aparecio un **bug preexistente**: el minimo de linea se comparaba contra el monto
crudo, ciego a la moneda — descartaba 0,9 USD (~900 pesos) como si fueran centavos. El umbral es
ahora en ARS equivalentes, tambien en el filtro original.

Verificado por mutacion (4/4 muertas) y con 3000 meses al azar multi-moneda: capacidad ≥ 0
siempre. El reporte de `1. Ver estado` muestra mes por mes el recorte aplicado.

## Gemelo digital vivo via n8n (2026-08-20)

El refresco del gemelo deja de ser manual. Workflow **"Gemelo a TSV — Finanzas Personales"**
(`JQmnVgb1wWLM3QjT`, instancia de clientes Tidetrack, activo): webhook → Sheets API con
`includeGridData` → transformacion a TSV → respuesta HTTP. Refrescar `docs/permanente/celdas.tsv`
es ahora:

```
curl -sS -o docs/permanente/celdas.tsv \
  "https://n8n-clientes.tidetrack.com.ar/webhook/gemelo-finanzas-tsv-x7k93m2p"
```

159.224 celdas en ~20 segundos, directo de la planilla viva — sin export de Apps Script, sin
Drive, sin descargas a mano. Es la pieza central de la Fase 3 del arnes ("scanner vivo por n8n").
El TSV cae con `formattedValue` y fallback a `userEnteredValue` (la trampa del formato NUMBER sin
patron, que omitia el valor formateado, esta cubierta).

Con el primer refresco quedo confirmada la geometria medida a mano hoy: `Tablero!AE7` = "Tipo de
Medios.", `AE16` = "Saldos Actuales.", `AE25` = "Cotizaciones Monedas.", y el bloque
"Presupuesto del Mes." de Inicio en `C17:H22`.

## v0.29.0 - Vuelve el residuo: los tres destinos suman 100% (2026-08-20)

> "Esa suma siempre tiene que dar 100%... seguis agregando parches sin criterio." — Franco

Tenia razon, y el error era **de analisis, no de implementacion**.

### La identidad

"Presupuesto Asignado" es una **asignacion**: reparte los ingresos que se esperan. Cada peso va a
fijos, a variables, o queda para capitalizar. Entonces

```
Ingresos = Gastos Fijos + Gastos Variables + Capacidad de Capitalizacion
```

no es un resultado que se observa: es la **definicion** de lo que el bloque muestra.

### Que se rompio

La v0.26.0 saco la capacidad del residuo y la puso a medir el flujo real hacia los medios de
riqueza. El motivo parecia bueno — el residuo daba negativo — pero los cuatro numeros pasaron a
salir de **cuatro fuentes independientes**, sin nada que los ate. Nunca mas cerraron: se midio
143,98%.

Lo que siguio fueron parches sobre el sintoma, ninguno capaz de funcionar: piso en cero (v0.27.0),
contar solo las entradas (v0.28.0), reanclar el porcentaje de la fila de Ingresos (v0.28.0). El
problema no estaba en como se calculaba cada numero, sino en que **ya no habia identidad que
respetar**.

### El dato que desarma el motivo original

**El residuo da 100% incluso siendo negativo.** Con fijos+variables por encima de los ingresos, la
capacidad sale negativa y los tres siguen sumando 100% (`46 + 116 − 62 = 100`). El negativo nunca
rompio la suma: era la **senal** de un presupuesto sobrecomprometido. Taparlo fue el error.

### Las dos cosas que se habian confundido

1. **Capacidad** de capitalizacion — lo que queda despues de fijos y variables. Residuo por
   definicion, y lo que hace cerrar el bloque. La fila se llama, literalmente, "Capacidad".
2. **Capitalizacion efectiva** — cuanta plata entro de verdad a los frascos. Medicion util, pero no
   puede vivir en un bloque que tiene que partir el ingreso.

La formula que medía la segunda se retira junto con sus tres helpers, que quedaban sin llamador. El
concepto queda escrito en la cabecera del modulo y el codigo en git.

**Se conserva** lo que era bueno y es independiente: el reparto proporcional de la Disponibilidad
de fondos, y los Ingresos como base del porcentaje.

### Diagnostico nuevo

`Presupuesto base > 1. Ver estado` muestra, mes por mes, que porcentaje de los ingresos se lleva el
gasto presupuestado, y marca los meses sobrecomprometidos. Cuando eso pasa, nombra la causa mas
probable: **los pagos de tarjeta contados dos veces**, una como la compra y otra como el pago del
resumen. En Julio el deficit ($362.568) es casi identico a los pagos de tarjeta del mes
($373.483) — exactamente la forma que deja ese doble conteo.

El banco prueba ahora la identidad sobre 5000 casos al azar, deficit incluido.

## v0.28.0 - Los Ingresos son la base del porcentaje (2026-08-20)

> "El % me da mas de 100%, simplemente tapaste un error con otro error." — Franco

Tenia razon en las dos mitades.

### El segundo error era O9

Venia siendo `SUMA(O10:O12)` — la suma de los otros tres, puesta en la fila de **Ingresos**. Daba
100% por construccion mientras la capitalizacion era el residuo. Al dejar de serlo, esa celda pasa
a mostrar un numero flotante que, leido literalmente, dice *"mis ingresos son el 116% de mis
ingresos"*.

Es una **categoria equivocada, no un numero mal calculado** — por eso ningun arreglo del calculo lo
iba a resolver. Ahora los Ingresos son la base: su porcentaje es 100%, y los otros tres muestran su
parte. Si esos tres suman mas de 100%, el presupuesto no cierra: se ve sumandolos, y es exactamente
sobre lo que actua "Disponibilidad de fondos". Ya no se disfraza en la fila de arriba. Lo mismo en
`O16`, el bloque de la realidad.

### El primer error era el piso en cero

Aplastar un neto negativo a cero no arregla el numero: **lo esconde**, y encima deja el bloque
mostrando `$0,00` sin decir por que.

Se reemplaza por el modelo correcto: el **plan** cuenta solo lo que *entra* a los medios de riqueza;
la **realidad** netea con signo. No es una inconsistencia — es la diferencia entre una intencion y
un hecho. Nadie planifica sacar plata del frasco, asi que en el presupuesto los retiros no restan;
en la realidad si, y si ese mes sacaste mas de lo que pusiste el neto da negativo y hay que poder
verlo. El cumplimiento se lee *"de lo que pensaba apartar, cuanto aparte de verdad"*.

El plan es positivo porque **mide algo positivo**, no porque se le puso un piso.

### Y una tercera celda disputada

`O16` sale de `StockYFlujo`. Era la segunda celda que dos modulos se disputaban, despues de `N19`.
Se agrego al banco un chequeo que recorre todos los `DEVTOOL_` y falla si dos proponen la misma
celda: el numero del Tablero no puede depender del orden en que se aprietan los botones.

## v0.27.1 - Se elimina el alias SYF_ARRASTRE (2026-08-20)

La v0.27.0 dejo `const SYF_ARRASTRE = CUENTA_ARRASTRE` por compatibilidad. Eso **solo funciona si
Apps Script evalua `00_Config.js` antes que `DEVTOOL_StockYFlujo.js`**. Hoy lo hace — `00_` ordena
antes que `DEVTOOL_` — pero es una bomba que estalla el dia que alguien renombra un archivo, y
estallaria en tiempo de carga: sin menu y sin planilla operable.

Los cuatro modulos usan `CUENTA_ARRASTRE` directamente. Sin alias, no hay orden que importe.

Lo encontro el banco de stock y flujo, que quedo en rojo tras la v0.27.0 porque arma sus constantes
a mano en vez de cargar Config: **la misma independencia que lo hace rapido lo convirtio en el
unico que podia ver la dependencia oculta.**

## v0.27.0 - Los traspasos a un frasco son capitalizacion (2026-08-20)

> "Los traspasos indican capitalizacion si se cruza con un medio." — Franco, 2026-08-20

La realidad ya los contaba; el **presupuesto no podia**, porque el presupuesto base excluia todas
las cuentas neutras. Esa asimetria hacia que el cumplimiento comparara dos cosas distintas.

### El dato que lo hizo simple

En este ledger **un traspaso son dos filas**: un Egreso del medio origen y un Ingreso al medio
destino. Verificado en el gemelo — `$7.000` salen de Efectivo y `$7.000` entran a Mercado Pago.

Con eso, filtrar por *"el medio de esta fila es de tipo Ahorros o Inversiones"* hace lo correcto
solo: de un traspaso de casa a un frasco entra la pata que suma y no la que resta, y de un traspaso
entre dos cuentas de casa no entra ninguna. **No hizo falta ninguna regla especial de signo.**

El arrastre sigue afuera aunque toque un frasco: `Inicio Mes` no mueve plata, declara cuanta habia.
Si contara, el saldo de apertura de cada frasco se leeria como capitalizacion del mes.

### Piso en cero, pero solo en el plan

En la proyeccion la capitalizacion no puede dar negativo: planear apartar menos que cero no
significa nada. En la **realidad** si puede, y ahi quiere decir que ese mes se saco plata de los
frascos. Una es una intencion; la otra, un hecho.

### Dos cosas que aparecieron en el camino

- **Las filas de traspaso no traen "Tipo de Cuenta"** — no viven en ninguno de los tres bloques — y
  el lector del presupuesto las descartaba por eso. Ahora ese campo solo se exige a los gastos e
  ingresos, que si necesitan un bloque donde caer.
- **`Inicio Mes` pasa a `00_Config` como `CUENTA_ARRASTRE`.** Vivia dentro de `DEVTOOL_StockYFlujo`
  y otros dos modulos lo tomaban de ahi por el scope global de Apps Script: funciona, pero es una
  dependencia invisible que ningun banco puede cargar sin arrastrar un modulo ajeno.

### El banco tenia un agujero

Probaba el generador de formulas pero **no que bandera le pasa el plan a cada celda**. Una mutacion
que le ponia piso en cero a la realidad pasaba invisible. Se agrego una prueba sobre el plan
armado; ahora las cuatro mutaciones mueren.

## v0.26.1 - El borrado de la carga previa se hace en bloques (2026-08-20)

Recargar el presupuesto base con 413 filas viejas adentro tardaba minutos: `deleteRow` una vez por
fila son 413 llamadas a la API de Sheets. Apps Script corta a los 6 minutos, y un corte a mitad del
borrado deja media carga vieja adentro — justo el estado que la marca en la columna Nota existe
para evitar.

Ahora se agrupan las filas contiguas y se borra cada bloque con `deleteRows(ini, largo)`. Como las
filas generadas quedan siempre juntas, **413 filas pasan a ser una sola llamada**. Se sigue
borrando de abajo hacia arriba: al reves, cada borrado corre los indices de lo que sigue.

## v0.26.0 - La capitalizacion deja de ser un residuo (2026-08-20)

Cuatro cosas que Franco marco mirando el Tablero, y una quinta que aparecio midiendo.

### 1. La Capacidad de Capitalizacion era una resta de descarte

Se calculaba `Ingresos - Fijos - Variables` en las dos columnas. Eso no mide capitalizacion: mide
lo que quedo sin explicar. Y cuando los gastos superan a los ingresos, **da negativo** — medido en
vivo en Julio: `-$318.561,01` en el presupuesto y `-$362.568,02` en la realidad.

> Nadie capitaliza menos cero.

Ahora es la **suma de lo que va a los medios de tipo Ahorros e Inversiones**, con la misma formula
en las dos columnas. Si cada una sumara distinto, el porcentaje de cumplimiento compararia peras
con manzanas.

**Consecuencia a proposito:** los cuatro renglones ya no suman 100%. Esa diferencia es informacion
— la plata que entro y no se gasto ni se capitalizo. Antes se escondia adentro del residuo.

### 2. La Disponibilidad de fondos le daba todo a una sola fila

Cuando las tres categorias se pasaban del 100%, no quedaba remanente que cubrir, la suma de
remanentes daba cero y la formula caia en un caso degenerado. Medido en vivo con 145% / 136% /
114%: `$0,00` / `$0,00` / `$275.428,69`.

Ahora, cuando no queda presupuesto por cubrir, se reparte por **peso de presupuesto**: la misma
prioridad relativa que rige entre 0% y 100%, sin caso especial. **Invariante verificado sobre 4000
casos al azar:** las tres filas suman la liquidez siempre, en los tres regimenes.

### 3. El presupuesto no se movia al cambiar el periodo

La formula **si** filtraba por `$N$2`/`$N$3` — se verifico leyendola en vivo. Lo que no variaba era
el dato: la v0.25.0 cargaba la misma cifra en todos los meses. Ahora cada mes se presupuesta con el
promedio de los **seis meses anteriores a el**. Ningun mes se presupuesta con datos de su propio
futuro, asi que el cumplimiento sigue significando algo y el numero acompana al filtro.

### 4. El presupuesto convertia con celdas que ya no son las cotizaciones

La correccion estaba en el codigo desde la v0.24.0 pero **nunca se habia aplicado a la hoja**. Se
detecto leyendo la formula viva de `N9`, que todavia tenia `$AF$17/18/19` — hoy el texto "Flujo" y
dos montos de saldo. Un deploy no reescribe formulas: hay que volver a correr el modulo que las
escribe.

### 5. Dos modulos se pisaban en N19

StockYFlujo proponia el residuo y Capitalizacion propone la suma. El numero del Tablero habria
dependido del orden en que se aprietan los botones del menu. Se saco la linea de StockYFlujo.

## v0.25.0 - Presupuesto base desde el historial real (2026-08-20)

`Proyeccion` nacia vacia, asi que "Presupuesto Asignado" daba cero y no habia con que probar el
Tablero. Ahora se puede sembrar con un presupuesto derivado de lo que realmente paso.

**El metodo** es el mas viejo y el mas honesto para un primer presupuesto: el **promedio mensual
por cuenta** sobre los ultimos 6 meses completos. El mes en curso no entra — esta a medio
transcurrir y bajaria todas las lineas.

**Tres decisiones que hacen que el numero signifique algo:**

1. **El presupuesto es plano** a lo largo de los meses. Es una linea que uno se fija; lo que varia
   es la realidad, y esa diferencia es justo lo que el Tablero mide.
2. **Se excluyen las cuentas neutras** (traspasos, "Inicio Mes"): no son gasto ni ingreso. Mismo
   criterio que los bloques de la realidad — si difirieran, el cumplimiento compararia peras con
   manzanas.
3. **Se respeta la moneda de origen.** Una cuenta que se paga en dolares se presupuesta en
   dolares. Promediar montos de monedas distintas produce un numero que no existe.

**Repetible sin duplicar:** cada fila generada queda marcada en la columna Nota y al recargar se
borran solo esas. Lo cargado a mano no se toca.

### Verificado por mutacion

El banco de pruebas corre contra un ledger sintetico de respuesta conocida. Se rompio la logica a
proposito de cinco formas y las cinco murieron — pero **la primera version del banco no detectaba
una de ellas**: agrupar sin la moneda pasaba limpio porque ninguna cuenta del ledger de prueba se
pagaba en dos monedas. Se agrego el caso, y ahora esa mutacion produce `20015`, que es 20.000 ARS
mezclados con 15 USD: exactamente el numero inventado que el guard tiene que atajar.

### Y un byte que casi viaja al deploy

El banco chequea ademas que no haya **bytes de control** en `src/` ni `devtools/`. Aparecio un NUL
dentro de un `.join()`, inyectado por una herramienta de edicion. No rompe la sintaxis, no lo
muestra ningun editor, y viaja al deploy sin que nadie lo note.

## v0.24.0 - Tres fixes de la revision adversarial pre-merge (2026-08-20)

Una revision multi-agente de los 28 archivos de `src/` que entraron a `main` devolvio 55 hallazgos
unicos; se verificaron adversarialmente los 9 mas severos y sobrevivieron 7. Estos son los tres
primeros.

### 1. Stock y flujo borraba "Medios Bancarios" y no lo reponia — diciendo que salio todo bien

El plan marcaba `limpiar = true` sin mirar si las tres formulas del bloque iban a reescribirse. Si
ya estaban aplicadas pero quedaba pendiente **cualquier** otro cambio — por ejemplo uno de formato,
que es exactamente lo que introdujo la v0.23.5 — el plan no salia vacio, se limpiaba `C18:I29` con
las formulas adentro, y el bucle no las reponia porque `proponer` las habia descartado por iguales.
El verificador solo mira lo que se escribio, asi que la corrida terminaba en verde.

> **Se materializo en produccion.** La corrida de formatos de la v0.23.5 dejo el bloque vacio.

Ahora la misma condicion decide limpiar y reescribir: borrar sin reponer es imposible por
construccion.

### 2. El presupuesto convertia con celdas que ya no son las cotizaciones

`DEVTOOL_Proyeccion` cableaba `$AF$17/18/19`, que hoy son "Saldos Actuales": `AF17` es el texto
"Flujo" y `AF18`/`AF19` son montos de saldo. Un previsto en AUD se multiplicaba por un saldo en
lugar de por una cotizacion — presupuesto inflado varios ordenes de magnitud, sin un solo aviso.
Pasa a `TIDETRACK_USD/AUD/EUR()`. Era el ultimo lugar de `src/` que autoraba esas coordenadas.

### 3. El ABM del menu diario podia corromper el Plan de Cuentas

Por dos caminos:

- La entidad **"Proyectos"** escribia en `RANGES.PROYECTOS` (P:Q), que desde el rediseno es el
  catalogo de **categorias de cuenta**: un alta agregaba una categoria, una baja borraba una. Se
  retira del selector y los endpoints la rechazan con un mensaje que explica por que.
- **Un solo desplegable alimentaba dos ejes distintos** — la Categoria de una cuenta y el Tipo de
  un medio — los dos leidos de la misma columna P. Se podia dejar un medio con tipo "Alimentacion
  y social". Ahora son dos dominios separados: las categorias salen de `CATEGORIAS_CUENTA` y los
  tipos de la nueva constante `TIPOS_MEDIO` en `00_Config.js`.

## v0.23.3 - La suma por tipo de medio, sobre la geometria real (2026-08-20)

El Tablero ya tenia el bloque **"Tipo de Medios."** (`AE7:AH12`) con los cuatro tipos escritos a
mano; le faltaba la columna Monto. Ahora se llena: cuanta plata hay en cada finalidad, convertida
a la moneda del selector.

### Lo que se aprendio en el camino, que vale mas que el bloque

La v0.23.0 se escribio contra el **gemelo digital**, que tenia el layout viejo: ahi `AE7` era
"Saldos Actuales" con las monedas en las filas 9-12. En la planilla real ese bloque esta en la
fila 16, y las filas 9-12 son **otro bloque**. Se intento escribir ahi y no entro nada:
`AF9:AF12` son la mitad muda de celdas combinadas `AE:AF`.

> El gemelo mintio, y mintio en silencio. Un snapshot desactualizado es peor que no tener snapshot.

### Tres guards nuevos, cada uno por algo que efectivamente paso

1. Los dos bloques se verifican **por su titulo y sus rotulos** antes de escribir. Una posicion se
   pudre sin avisar; un rotulo no.
2. Se comprueba que la celda destino sea el **ancla** de su combinada, no su mitad muda.
3. Se comprueba que el selector de moneda tenga una moneda de verdad.

### Y una coordenada menos que se pueda pudrir

La conversion deja de apuntar a `$AF$17/18/19` y llama a `TIDETRACK_USD/AUD/EUR()`. El bloque de
cotizaciones se habia mudado a las filas 27-29, y **una coordenada que se pudre no da error: da
otro numero**. Una funcion no tiene coordenada que se pueda mover.

Los rotulos de los tipos no se tocan: son de Franco, el script solo suma. "Disponibilidad de
fondos" (`O23:O25`) queda como estaba, porque el bloque por moneda sigue existiendo.

## v0.23.1 - La consolidada del Plan se ubica midiendo (2026-08-20)

"Limpiar Plan de Cuentas" abortaba con *"La consolidada de S8 no tiene formula"* -- cuando la
consolidada estaba perfecta, en R.

**Causa:** el modulo deducia su posicion de una marca en DocumentProperties ("ya se borro la
columna Q?"). El borrado habia ocurrido en una corrida **anterior a que esa marca existiera**,
asi que lo creia pendiente, aplicaba el offset de "antes del borrado" y miraba una columna vacia.

> Una marca de estado puede faltar; la hoja no.

**Correccion:** la consolidada se busca en la hoja -- primera columna a la derecha del bloque de
Categorias cuya celda de datos tiene formula -- y el borrado de columna se decide por
**geometria**: si entre la columna de nombres y la consolidada queda mas de una separadora, sobra
una columna adentro del recuadro. Ninguna de las dos cosas depende ya de recordar nada. La marca
queda como rastro, sin poder de decision.

## v0.23.0 - "Saldos Actuales" suma por tipo de medio (2026-08-20)

### El bloque AE7:AG12 cambia de eje

Mostraba el saldo desglosado por moneda, en dos columnas (Flujo y Capital). Pasa a mostrar
**la suma por tipo de medio** -- Hogar, Ahorros, Inversiones, Financiacion -- con el monto
convertido a la moneda del selector y el peso de cada uno en % sobre el total.

Los tipos son cuatro y el bloque tiene cuatro filas de datos: entra justo. El desglose por
moneda contestaba una pregunta que el bloque "Medios Bancarios" ya contesta cuenta por cuenta;
la que faltaba era **en que finalidad esta la plata**.

### La consecuencia que habia que atar

"Disponibilidad de fondos" (O23:O25) leia `AF9:AF12` como si fueran las cuatro monedas y las
convertia: `AF9 + AF10*tc + AF11*tc + AF12*tc`. Con el bloque nuevo eso multiplicaria por la
cotizacion algo que **ya viene convertido**. Ahora la liquidez es el saldo del tipo Hogar, que
es exactamente la plata disponible para cubrir gastos. Si ese bloque venia dando de mas, era esto.

### Dos trampas cubiertas antes de escribir

Las dos ya conocidas de esta campana:

1. **Validacion de datos** en la columna de rotulos: si solo acepta ARS/USD/AUD/EUR, escribir
   "Hogar" se rechaza y la celda queda **vacia sin lanzar excepcion**. Se abre el dominio antes.
2. **Formato de numero** en la columna del peso: venia en moneda, y un ratio de 0,42 se veria
   como "$0,42". Se pasa a porcentaje antes de escribir.

### El banco de pruebas atajo un bug antes del deploy

El reemplazo que reapunta la liquidez **no era idempotente**: en la segunda pasada
`liquidez_ars;` volvia a matchear desde adentro de `liquidez_moneda; liquidez_ars;` y se comia
la definicion de `presupuesto_ahorro`. Se anclo el patron al shape viejo (`AF9 + ...`). Es
exactamente la razon por la que `devtools/probar_stock_flujo.js` existe.

### Plan de Cuentas

- **"Deudas" pasa a la categoria "Deuda y financiacion".** La categoria cruza bloques a
  proposito: la cuota fija vive en Gastos Fijos y la deuda que se paga cuando se puede, en
  Variables.
- **La columna consolidada es la R, no la S:** se corrio un lugar cuando se borro la Q.
- **El borrado de columna lleva su propia marca de hecho,** para que no pueda repetirse y correr
  todo un lugar mas.

> Los releases v0.14.0 a v0.22.1 quedaron registrados solo en `src/ZZ_Changelog.js` (historial
> canonico). Pendiente su volcado a este archivo.

## v0.13.0 - Riqueza por lista blanca (2026-08-19)

**Cambio de definicion, no correccion de bug.** Hasta hoy el capital acumulado se calculaba como
*todo tipo de categoria que no sea Hogar*. Eso hacia que la **Financiacion** -- Tarjeta de Credito,
Prestamo Mac -- sumara como patrimonio. Una tarjeta es un pasivo. Riqueza pasa a definirse por
**lista blanca**: solo `Ahorros` e `Inversiones`.

### Por que lista blanca y no arreglar la negra

Con "todo lo que no sea Hogar", cualquier tipo nuevo del catalogo entraba a riqueza **sin que
nadie lo decidiera**, por el solo hecho de no llamarse Hogar. Una lista blanca obliga a decidir.
La regla vive en `TIPOS_RIQUEZA` (`00_Config.js`), no repartida por seis formulas.

### La trampa de este cambio

Hay **dos usos del tipo de categoria** que se parecen y no se corrigen igual. Por eso el modulo
trabaja sobre una lista cerrada de celdas en vez de barrer la planilla reemplazando "Hogar":

| Uso | Celdas | Que pasa |
|---|---|---|
| **(a) "es riqueza?"** | `Inicio!F8`, `Tablero!N19`, `Tablero!AG9:AG12` | pasan a lista blanca |
| **(b) "es flujo cotidiano?"** | `Inicio!C8/C13/F13/C15/F15`, `Tablero!R9/U9/X9/AF9:AF12` | **NO se tocan** |

Las (b) son los bloques que dejan entrar los arrastres `Inicio Mes` cuando el medio es de casa, y
los saldos cotidianos -- que ademas filtran por *nombre* de categoria, no por tipo. Romperlas
romperia el saldo cotidiano, que hoy cierra al centavo contra el ledger.

### Impacto medido antes de aplicar

Sobre el ledger crudo (3.458 filas): el cambio mueve meses enteros -- marzo 2026 **−$567.974**,
abril **+$332.974**, junio **+$200.000**, agosto **−$230.000** -- aunque en el acumulado historico
la Financiacion neta apenas +$230.000 en 7 filas. Es el efecto buscado, no un error.

### Added

- **`TIPOS_RIQUEZA`** en `00_Config.js`.
- **`DEVTOOL_RiquezaYCategorias.js`**: trio estado / aplicar / revertir, bajo
  *Tidetrack Dev > Riqueza y categorias*.
- **`devtools/probar_riqueza.js`**: banco de pruebas contra las formulas reales del gemelo.

### Fixed

- **La columna del Tipo del bloque de categorias**. `Tablero!AA9` derrama AA=categoria, AB=vacia,
  AC=monto, y el rotulo `AB8` **ya decia "Tipo"** desde el rediseno: la columna se diseno para eso
  y quedo sin llenar, con una variable que la formula llamaba literalmente `columna_ak_vacia` y
  devolvia `""` siempre. Ahora trae el tipo de cada categoria desde el catalogo.
- **El bloque deja de ocultar las categorias de tipo Hogar.** Con el Tipo a la vista, mostrar todas
  es la lectura por macrosegmento que se buscaba. Si se prefiere lo anterior, es una linea.

### Decidido y no hecho

- `Financiacion` **se deja como un solo tipo**; no se parte en 'Tarjetas' y 'Financiamiento'.

---

## v0.12.1 - Reparar la reparacion (2026-08-19)

Franco corrio "Aplicar reparacion" y el modulo declaro exito. La auditoria sobre la planilla
viva encontro que **tres celdas habian quedado peor que antes**: `Tablero!O23`, `O24` y `O25`
pasaron de `#REF!` a `#ERROR!`. Las otras 24 quedaron bien y las siete agregaciones que se
recalcularon contra el ledger cierran **al centavo**, pero el modulo que vino a combatir los
falsos exitos produjo uno.

### El bug

```js
out.replace(/(\$N\$10\s*-\s*)#REF!/g, '$1$N$17')   // <- string de reemplazo
```

En un string de reemplazo, `$1` es el grupo capturado, `$N` es literal y `$17` **vuelve a ser el
grupo 1** seguido de un `7`. En vez de `$N$10 - $N$17` escribio `$N$10 - $N$N$10 - 7`. Las otras
cuatro sustituciones de esa funcion zafaron por casualidad: dos no tienen grupos (y un `$4` sin
grupo queda literal) y dos llevan el `$1` al final.

### Lo grave no es el bug, es que paso el guard

`_verificarEscrituraFormulerio` comparaba el **texto** releido contra el texto escrito, y exigia
cero `#REF!`, cero `'Liquidez'` y cero anclas viejas. El texto corrupto cumple las cuatro
condiciones. **Comprobar que escribiste lo que querias escribir no es comprobar que funciona.**
Es la cicatriz 5 del arnes -- *un guard que reporta exito sin hacer el trabajo es peor que no
tener guard* -- cometida por el modulo que la cita en su propia cabecera.

### Fixed

- **Todos los reemplazos van por funcion de reemplazo.** El valor devuelto se inserta tal cual y
  esta clase de bug deja de ser posible en un proyecto donde toda formula lleva `$`.
- **El verificador lee el VALOR resultante** de cada celda escrita y revierte el lote entero si
  alguna quedo en error, distinguiendo "ya estaba rota" de "la rompi yo".
- **El modulo deshace el danio**: reconoce el artefacto `$N$N$10 - 7` y lo devuelve a `$N$17`.
  Sin eso, re-correr "Aplicar" contestaria "nada que hacer" con tres celdas rotas a la vista --
  otra vez el mismo modo de falla.
- **Sexto defecto** (hallado por la misma auditoria): las columnas "Valor en X" de `Inicio`
  (`AF8` y `AT8`) **no convierten moneda**. Leen la moneda de la columna de **Cuenta** (`V` y
  `AJ`) en vez de la de **Moneda** (`Y` y `AM`), asi que ninguna rama del `IF` se cumple,
  `tasa_origen` cae al literal `1` y la columna es un passthrough del monto crudo: todo
  movimiento en moneda extranjera entra a `C13`, `F13`, `C15` y `F15` **a valor nominal**. Un
  cobro de 200 USD cuenta como 200 pesos. Medido en junio de 2026: **~$376.740 de ingreso
  desaparecido, el 23% del mes**. `AT8` tomaba ademas la moneda de destino de `Y13` -- que no es
  un selector sino la celda con la moneda del sexto movimiento del mes actual --, y el rotulo
  `AT7` repetia la referencia.

### Added

- **`devtools/probar_formulerio.js`**: corre las transformaciones **reales** del devtool contra
  las formulas **reales** del gemelo (`docs/permanente/celdas.tsv`) y muestra el antes y el
  despues de cada celda. Comprueba la firma `$N$N` del bug de escape, residuos de `#REF!` /
  `Liquidez` / anclas viejas, balanceo de parentesis y comillas, e idempotencia. Habria cortado
  el bug en diez segundos: **no correrlo fue el error de fondo**, mas que el bug en si.

### Diagnosticado, no reparado

- **Quinto defecto**: `Inicio!C15`/`F15` devuelven siempre "0% respecto del mes anterior" aunque
  la variacion real sea de +155%. Causa: cuatro condiciones se ligan a variables de `LET` sin
  `ARRAYFORMULA`; la comparacion rango-contra-escalar se evalua por interseccion implicita,
  `FILTER` recibe una condicion de una sola fila, tira error de tamanio, y el `IFERROR` externo
  lo convierte en 0. La correccion seria envolver esas cuatro (dos en `F15`) en `ARRAYFORMULA`.
  Queda para una pasada propia: es otro mecanismo de falla, no esta verificado de forma
  independiente, y muestra un rotulo feo, no un numero equivocado en una cifra de portada.
- **Un movimiento de $302.209 invisible** para todo el Tablero: en enero 2026 hay una fila del
  ledger con Tipo de Cuenta y Medio vacios. Esta en el derrame pero ningun bloque la recoge. Es
  el gap de validacion de `procesarCargas` materializado -- de las 203 filas sin Tipo de Cuenta.

---

## v0.12.0 - Formulerio reparado (2026-08-19)

El swap v0.11 movio las celdas de las dos hojas que Franco **mira** -- "Inicio" y "Tablero" --
y las formulas se copiaron apuntando a las direcciones viejas. El resultado no eran errores,
que hubieran sido benignos: eran numeros plausibles calculados sobre datos mal apareados. De
toda la superficie del producto solo cuatro celdas mostraban un error visible; el resto mentia
en silencio.

### Added

- **`DEVTOOL_FormulerioV0111.js`**: trio `estadoFormulerioV0111` (solo lectura) /
  `aplicarFormulerioV0111` / `revertirFormulerioV0111`, bajo *Tidetrack Dev > Formulerio v0.11*.
- **`columnIndexToLetter`** en `03_SheetManager.js`, inverso de `columnLetterToIndex`.

### Fixed

- **Anclas corridas tres filas** -- la raiz de casi todo. `Tablero!AJ6` es el motor entero de la
  hoja: un unico QUERY sobre `Registros!B6:M` que **derrama doce columnas desde la fila 6**
  (AJ=Monto, AK=Tipo, AL=Cuenta, AM=Tipo de Cuenta, AN=Medio, AO=Moneda, AR/AS/AT/AU=los TC
  congelados). Quince formulas consumidoras pedian la fila 9, asi que cada monto se apareaba con
  el tipo, la moneda y la cotizacion del movimiento **tres filas mas abajo**. Explica que `N19`
  declarara $63.567.848 de capitalizacion en un mes: montos en pesos multiplicados por la
  cotizacion del dolar porque cayeron en el bucket de moneda equivocado.
- **El selector de moneda perdido**: vivia en `$I$9` y el rediseno lo movio a `N4`; las formulas
  portadas quedaron con `#REF!` en su lugar, **17 tokens en 8 celdas**. Donde el `#REF!` estaba
  envuelto en `IFERROR` se degradaba en silencio -- `AV6` ("Valor en ARS") devolvia una columna
  entera de ceros, y con ella `S7`/`V7`/`Y7`, `N16:N19` y `O16:O19`, o sea el bloque
  "Movimientos del mes" completo. Donde no lo estaba, propagaba (`O23:O25` = `#REF!`).
- **Bloque "Disponibilidad de fondos" rotado una posicion**: el rediseno reordeno los rotulos
  (el orden viejo empezaba por Ahorro, el nuevo por Gastos Fijos) pero las formulas se pegaron
  en el orden viejo. La de Capacidad de Ahorro termino en la fila de Gastos Fijos. Cada una
  calculaba bien lo suyo, en la fila del vecino.
- **Tipo de categoria `'Liquidez'` huerfano**: 14 celdas comparaban contra un tipo que el Plan
  de Cuentas nuevo ya no tiene (hoy son Ahorros / Inversiones / Financiacion / **Hogar**).
  `Hogar` es su equivalente 1:1 -- ambos con una sola categoria, "Medio Cotidiano". Al no
  cumplirse nunca la condicion, el gasto cotidiano se contaba como capital acumulado y los
  arrastres de "Inicio Mes" que si debian entrar quedaban todos afuera.

### Decisiones de diseno

- **El modulo no redacta ni una formula.** Lee cada celda con `getFormula()`, reemplaza los
  tokens equivocados y la escribe de vuelta; el bloque rotado no se reescribe, se **intercambia**.
  Es deliberado: evita de raiz la trampa de locale documentada en `07_MiradaInteranual.js` --
  la planilla es es_AR y `setFormula` no traduce los arrays literales `{}`, que media docena de
  estas formulas usan. Al no autorizar ninguna, el ida y vuelta es identidad.
- **El re-apuntado toca unicamente rangos abiertos de dos letras** (`AK9:AK`), nunca celdas
  sueltas. `AF9:AF12` y `$AF$17:$AF$19` son otro bloque de la hoja, hoy funcionan, y un
  reemplazo numerico 9->6 a ciegas los habria corrompido.
- **La rotacion se decide por el rotulo de cada fila, no por su posicion.** Si el rotulo no es
  el esperado, no se rota nada: mover formulas a ciegas seria repetir el error original con
  otro orden.
- **El mapeo de columnas del motor se deriva de `RANGES.REGISTROS.columns`** y se contrasta
  rotulo por rotulo contra el header del ledger. Un mapeo supuesto y no verificado ya costo caro
  una vez.

### Fuera de alcance (declarado, no olvidado)

- `Tablero!AF9:AF12` e `Inicio!C8` filtran por el **nombre** de la categoria ("Medio Cotidiano")
  en vez de por su tipo. Es fragil -- hardcodea un dato de catalogo -- pero hoy dan el numero
  correcto. Fragil no es roto.
- El Plan de Cuentas tiene una fila huerfana (`P19`/`Q19`, sin nombre y con tipo Hogar) y un
  duplicado ("Meta de Ahorro 3" en `P17`/`P18`). Es dato de Franco, no formula.
- `Inicio!C15`/`F15` devuelven "0% respecto del mes anterior" con `C13` en $1,27M. Es un quinto
  defecto, no uno de estos cuatro, y merece su propio diagnostico.

---

## v0.11.1 - Armas descargadas (2026-08-18)

Con el swap ya aplicado en produccion, la planilla quedo rodeada de codigo que sigue
existiendo, sigue siendo invocable y escribe con la geometria vieja. Este release neutraliza
cuatro vias de escritura peligrosas y cierra el camino lateral que encontro una auditoria
adversarial posterior.

### Fixed

- **Cotizaciones inventadas fuera del sistema** (`99_MigrationLogic.js`): `migrarBdAntigua` y
  `recalcularTcRegistros` rellenaban las fechas sin cotizacion con 1050/650/1100. Esos numeros
  quedaban congelados en el ledger, que es el unico dato que despues no se puede recalcular.
  Ahora ante una sola fecha faltante se aborta **todo-o-nada**, sin escribir una celda.
- **Fallback mudo del motor FX** (`15_ExchangeRateApi.js`): `fetchArsRate` devolvia la
  cotizacion mas reciente disponible sin dejar un solo log (verificado: `fetchArsRate('2026-12-31')`
  devolvia la del 17 sin rastro). Ahora formato invalido y **fecha futura lanzan**, y toda
  cotizacion devuelta fuera de su fecha queda registrada, con resumen de lote.
- **Recalculo de TC sin aviso** (`recalcularTcRegistros`): pide confirmacion nombrando cuantas
  filas pisa y el rango exacto; las filas sin fecha legible se **saltean conservando sus
  cotizaciones** (antes recibian vacios en silencio y el cierre las contaba como recalculadas);
  y el alto sale de la ultima fila con dato en la columna **Fecha**, no de `getLastRow()`, que
  mide cualquier columna (un valor suelto en T40 hacia escribir 34 filas para 2 registros).
- **Toast de `procesarCargas`**: contaba llamadas a la API (una por fecha distinta), asi que
  cinco movimientos de la misma fecha decian "1 fila(s)". Ahora informa filas afectadas del lote.
- **Precondicion de `sincronizarBDsV011`**: chequeaba las dos hojas Fix con `&&`, asi que solo
  abortaba si faltaban las dos. Ahora aborta si falta cualquiera.

### Changed

- **El guard de obsolescencia de la migracion v0.9.5 pasa a estar en TODA funcion que escribe**,
  no solo en las tres entradas publicas. La auditoria encontro que `cuerpoRevertirV095_` -- la
  que hace el trabajo destructivo -- era invocable directa, escribia sobre Tipos de Cambio
  pisando la fila de encabezados y las cuatro columnas de Fecha, y devolvia `ok:true` con
  "MIGRACION v0.9.5 REVERTIDA". Las 22 escrituras del modulo viven en 7 funciones y las 7
  abortan al entrar.
- **Privacidad real de plataforma**: en Apps Script una funcion es privada cuando su nombre
  **TERMINA** en guion bajo (`nombre_`), no cuando empieza (`_nombre`) -- las `_algo` aparecen
  en el dropdown "Ejecutar" del editor. Las funciones internas que escriben de las tres
  migraciones (v0.9.5, v0.11, v03.1) se renombraron con el guion bajo al final. Las entradas
  publicas conservan su nombre: el menu las invoca por string.
- **`procesarCargas` tiene un modo de falla nuevo**: una sola fecha futura tipeada en la grilla
  aborta el **lote completo** sin escribir nada (la grilla queda intacta para corregir y
  reprocesar). Documentado en `FUNCIONALIDADES.md`, seccion 04.

### Removed

- **Submenu del swap v0.11 reducido** a "Ver estado" (solo lectura) y "Purgar respaldos" (el
  paso que le falta a Franco tras validar los tableros). Salen Sincronizar (su trabajo ya esta
  hecho; su docstring ya lo afirmaba mientras el item seguia vivo en `00_Config.js`), Aplicar
  (no se aplica dos veces) y Revertir, que era la unica del quinteto que funcionaba entera y no
  pedia ninguna confirmacion. Revertir queda como salida de emergencia deliberada desde el
  editor y ahora exige confirmar.

---

## v0.11.0 - Swap de hojas Fix (2026-08-18)

El rediseno de Franco (hojas " - Fix" + "Presupuesto - New") pasa a ser el layout canonico.
Incluye la re-adopcion de produccion v0.10.0 como baseline (v0.9.5-v0.10.0 se desarrollaron
fuera del repo el 2026-08-13: layout nuevo + migracion historica desde la planilla v03.1).

### Added

- **`MIGRACION_v0.11_SwapHojasFix.js`**: estado / sincronizar BDs / aplicar / revertir /
  purgar. Renombra las viejas a respaldo oculto, las Fix a canonicas, repuntea formulas
  (con remapeo semantico R:T->L:N y V:W->P:Q para el Plan), recrea la consolidacion de
  cuentas (columna S del Plan) y reconstruye los dropdowns de Cargas.
- **`docs/permanente/FUNCIONALIDADES.md`**: el doc funcional de Franco validado formula
  por formula, con estado real por funcionalidad y el checklist del formulerio.

### Changed

- **`00_Config.js` remapeado a la geometria Fix**: Plan C:D/F:G/I:J/L:N/P:Q (headers 7,
  datos 8), Cargas C7:I21, Registros B:M con datos desde fila 7, TC C:D/F:G/I:J/L:M con
  datos desde fila 8. `HEADER_ROW`/`DATA_START_ROW` globales 3/4 -> 7/8. Canonico de TC:
  'Tipos de Cambio'.
- **MAPA_HOJAS.md y CLAUDE.md reescritos** a la realidad post-swap (las hojas auxiliares
  CALCU/ANUAL/Bocetos/_legacy ya no existen; ADR-005 y ADR-006 quedan superados).

### Removed

- **Migracion v0.9.5 fuera del menu**: incoherente con el config remapeado; el archivo se
  conserva como historia.

---

## v0.8.3 - Gobernanza Fase 1 del arnes (2026-08-12)

Primera version sobre el baseline productivo v0.8.2. Cambios de gobernanza sin
tocar logica de negocio (pipeline, FX y migraciones intactos).

### Added

- **`_resolverNombreHoja(alias)` + `invalidarCacheNombresHojas()`** en `00_Config.js`
  (portadas de planilla-pymes): resolucion de nombres de hoja con alias y cache por
  ejecucion. Politica ante ambiguedad: gana el alias historico (el que tiene los
  datos), con log del estado ambiguo.
- **`SHEETS.DATA_ENTRY` / `TIPOS_CAMBIO` / `BD_ANTIGUA` como getters con alias**:
  corrigen las tres discrepancias config-planilla detectadas en Fase 1
  ('Hoja de Cargas' vs 'Cargas'; 'Tipos de cambio' vs 'Tipos de Cambio';
  'BD antigua' vs 'BD Antigua' — getSheetByName es case-sensitive). `RANGES.TC_*`
  pasa `sheet` a getter para preservar la resolucion perezosa.
- **`SHEETS.MIRADA_INTERANUAL` y `SHEETS.DEBUG_MIRADA`**: `07_MiradaInteranual.js`
  deja de hardcodear nombres de hoja (regla SSOT).
- **`sync_targets.command`** (raiz): deploy oficial. Lee `targets.yaml`, drift-check
  integrado por target (clasp pull a temporal + diff, nunca sobre `src/`),
  confirmacion explicita, confirmacion adicional "pisar" ante drift, `--dry-run`
  con exit 3 para CI, trap de restauracion de `.clasp.json`. Excepcion
  `!sync_targets.command` agregada a `.gitignore`.
- **CLAUDE.md reescrito como contrato operativo** (molde pymes): esquema de datos
  corregido al layout REAL de produccion (Registros I:T, datos desde fila 3; TC en
  bloques con offset), advertencia del layout v0.9.x no desplegado, seccion de
  Gobernanza (changelog dual, decisiones inline, cabeceras de contexto, cero emojis,
  deploy solo por script, regla anti-drift) y seccion "Cuando NO actuar".

### Changed

- **`MENU_CONFIG` sin emojis** (regla cero emojis del arnes).
- `01_Version.js` a 0.8.3.

### Metodologia

Piezas construidas y verificadas con el patron adversarial del arnes (seccion 9):
constructores independientes + 2 refutadores por pieza con schema de veredicto
`{refuted, bloqueantes[], menores[]}`. La ronda 1 refuto 2 de las 3 piezas
(3 bloqueantes: comando `npm run pull` inexistente y peligroso documentado en el
contrato; afirmacion de identidad repo==produccion ya falsa; script de deploy
gitignoreado por `*.command`); todos corregidos antes del commit.

---

## Fase 0 del arnes - Reconciliacion de drift (2026-08-12)

> No es un release de codigo: es la adopcion del estado productivo real como baseline
> del repo, segun `ARNES_TIDETRACK.md` seccion 2. El HEAD de `src/` pasa a reflejar
> la produccion (v0.8.2), no la ultima version documentada (v0.9.4).

### Hallazgo del drift-check (clasp pull a directorio temporal)

- La produccion declara **v0.8.2** e incluye `07_MiradaInteranual.js` (2026-06-23),
  modulo que el repo no conocia. Un `clasp push` ciego lo habria destruido.
- Los cambios **v0.9.2 - v0.9.4** del repo (layout nuevo B:M, batch resiliente)
  **nunca se desplegaron**: el `ZZ_Changelog.js` de produccion termina en v0.8.2.
- Consecuencia: v0.9.x describe un layout que la produccion aun no tiene. Queda
  integro en la historia de git (commit `82d5759` y anteriores) para re-aplicarse
  como cambio nuevo sobre este baseline, con drift-check y deploy controlado.

### Changed

- `src/` completo sincronizado verbatim desde el script productivo (10 archivos:
  9 modificados + `07_MiradaInteranual.js` nuevo). `node --check` OK en los 14 .js.
- `ZZ_Changelog.js` vuelve al contenido productivo (tope v0.8.2) y no se edita en
  esta fase: mantenerlo identico a produccion es parte del baseline verbatim.
- WIP local del clon principal preservado en rama `wip/pre-arnes` (commit `6426b93`):
  `MAPA_HOJAS.md` modificado, 2 prompts y `notas fran.md`. `main` local
  fast-forwardeado a `origin/main`.

### Added

- **`targets.yaml`** en raiz: fuente unica de targets de deploy. `script_id` (de
  `.clasp.json`) y `sheet_id` confirmado por triple fuente (MAPA_HOJAS.md, JSON del
  scanner, metadata de Drive): planilla "PLANILLA FINANZAS_v4 .WIP | Personal",
  owner start.tidetrack@gmail.com. Cierra el pendiente-confirmar del vault.

---

## v0.9.4 - Reconciliacion al layout de produccion nuevo (2026-06-22)

### Changed

- **Layout de produccion nuevo sin offset**: las hojas "Registros" y "Tipos de cambio"
  (ex "Copia de...") migraron a un layout sin el offset historico de ADR-005.
  Registros ahora en columnas B:M (headerRow=5, dataRow=6). Tipos de cambio con
  bloques B:C / E:F / H:I / K:L (titulos fila 5, sub-headers fila 6, datos fila 7).
- **`00_Config.js`**: `RANGES` refactorizado con `headerRow` y `dataRow` por tabla,
  eliminando la dependencia de las constantes globales `HEADER_ROW` / `DATA_START_ROW`
  para Registros y TC.
- **`03_SheetManager.js`**: `getTableRange`, `getTableData`, `appendRow` y
  `appendMassive` ahora leen `headerRow`/`dataRow` desde `RANGES[tableName]`.
- **`06_RegistrosService.js`**: sort de Registros actualizado a columna H (Fecha).
  `appendMassive` de TCs referenciado a los nuevos bloques B/E/H/K.

### Added

- **`99_MigrationLogic.js`**: nueva funcion `migrarLegacyANuevaProduccion()` que copia
  datos de `Registros_legacy` (layout I:T, headerFila2) y `Tipos de cambio_legacy`
  (bloques I:J/L:M/O:P/R:S) al layout nuevo de produccion. Idempotente.
  Nueva entrada de menu [Dev] "Migrar Legacy a Nueva Produccion".
- Hojas `Registros_legacy` y `Tipos de cambio_legacy` ocultas como backup (~2879 filas).

### Notes

- Plan de Cuentas y Cargas NO cambiaron: mantienen su layout historico (header fila 3,
  datos fila 4; columnas I+ con offset).
- ADR-005 actualizado en `GUIA_ARQUITECTURA.md`: el offset se elimino en Registros y
  Tipos de cambio; persiste en Plan de Cuentas y hojas legacy.

---

## v0.9.3 - Sort best-effort tambien en appendMassive (2026-06-21)

### Fixed

- **El error de celdas combinadas seguía abortando `procesarCargas()`**: la v0.9.2 envolvió el sort de "Registros" (paso 7) pero **no** el auto-sort interno de `appendMassive()` para las tablas de cotizaciones (`TC_*` en "Tipos de cambio"). Ese sort sin proteger era el que lanzaba *"Las combinaciones deben estar completamente en el rango"* y frenaba todo vía el `catch` externo. Ahora también está en `try/catch` (best-effort). Los TCs se escriben con `setValues` antes del sort, así que quedan guardados aunque el orden falle.

---

## v0.9.2 - Procesamiento resiliente de cargas (2026-06-21)

### Changed

- **`procesarCargas()` dejó de abortar el lote completo ante filas incompletas.** Ahora procesa las filas válidas, **saltea** las incompletas (quedan en la grilla para corregirse) e informa al final cuántas se omitieron y por qué. La carga ya no se frena por datos faltantes.
- Solo se limpian de la grilla las filas efectivamente procesadas (antes se limpiaba todo `I5:O19`).

### Fixed

- **Bug de sort con celdas combinadas**: el ordenamiento de "Registros" lanzaba *"Las combinaciones deben estar completamente en el rango que se desea ordenar"* y frenaba el guardado. Ahora el sort es **best-effort** (`try/catch`): si falla por merges, se loguea y se continúa — los registros ya quedaron escritos.

### Notas

- La **Nota** nunca fue un campo obligatorio.

---

## v0.9.1 - Fix sort de encabezado + utilidad de renombrado de hojas (2026-06-21)

### Fixed

- **Bug crítico de sort en `procesarCargas()`**: el ordenamiento arrancaba en la fila 2 e incluía el encabezado en `HEADER_ROW` (3), desplazándolo al ordenar por fecha descendente. Corregido para arrancar en `DATA_START_ROW` (4).
- **`appendMassive` para REGISTROS** usaba `minRow=2`; corregido a `DATA_START_ROW` para evitar escritura antes del encabezado en hoja vacía. JSDoc de `minRow` actualizado.

### Added

- **`renameProductionSheets()`**: utilidad de ejecución única para completar la migración de hojas de producción (`Copia de Registros` → `Registros`, `Copia de Tipos de Cambio` → `Tipos de cambio`; las originales reciben sufijo `_legacy`). Idempotente.
- Entrada de menú **[Dev] "Renombrar Hojas a Producción"**.

### Notas

- Los nombres de producción siguen siendo `Registros` y `Tipos de cambio`: las constantes `SHEETS` en `00_Config.js` y las fórmulas del Tablero/CALCU/ANUAL no cambian.

---

## v0.6.0 - Simplificación de Arquitectura de Monedas (2026-02-13) RELEASED

### Resumen del Sprint

Sprint enfocado en simplificar la arquitectura del sistema de monedas, eliminando gestión dinámica y hardcodeando 5 monedas fijas, removiendo UI de configuración y reduciendo complejidad del código.

**Estado:** Sprint completado en 1 día (100%) - RELEASED 
**Fecha de cierre:** 2026-02-13 
**Código reducido:** ~1,190 líneas (~23% del módulo) | **Archivos eliminados:** 4 | **Bugs resueltos:** 3 críticos

---

### Added

#### Core Configuration

- **`CURRENCIES` constant** en `00_Config.js` - 5 monedas hardcodeadas:
 - ARS (Peso Argentino) - Moneda base
 - USD (Dólar Estadounidense)
 - EUR (Euro)
 - AUD (Dólar Australiano)
 - CNY (Yuan Chino)
- **`BASE_CURRENCY` constant** - Define 'ARS' como moneda base del sistema
- **`AVAILABLE_CURRENCY_IDS`** - Array de IDs disponibles para iteración

#### Stub Functions (Compatibility Layer)

- `getConfig()` - Devuelve configuración hardcodeada (reemplaza ConfigService)
- `getBaseMoneda()` - Devuelve 'ARS' directamente
- `getAllMonedas()` - Convierte CURRENCIES a formato legacy para compatibilidad
- `getMonedaCodes()` - Devuelve array de currency IDs

---

### Changed

#### Backend Services Updated

- **`06_ExchangeRateService.js`**:
 - Reemplazadas todas las llamadas a `getMonedaByISO()` con acceso directo a `CURRENCIES`
 - `updateAuxSheet()` usa `Object.values(CURRENCIES)` en lugar de `getAllMonedas()`
 - `saveDolarAPIRate()` usa `CURRENCIES.ARS` y `CURRENCIES.USD` directamente
 - `fetchExchangeRatesFromAPI()` itera sobre `CURRENCIES`
 - Fixed property references: `.moneda_id` → `.id` (3 locations)
- **`04_DataValidation.js`**:
 - `checkMonedaExists()` ahora valida contra `CURRENCIES` en vez de tabla `MONEDAS`
 - Error message mejorado con lista de monedas disponibles

- **`11_UIService.js`**:
 - `getDashboardDropdowns()` usa `Object.values(CURRENCIES)` directamente

- **`98_DataSeeder.js`**:
 - `seedCompleto()` ya no llama a `setupCompleto()` (monedas hardcodeadas)
 - `seedTransacciones()` usa `Object.values(CURRENCIES)` y `BASE_CURRENCY`
 - `randomMoneda()` usa `m.id` en lugar de `m.moneda_id`
 - Logs actualizados reflejando 5 monedas hardcodeadas

- **`99_SetupDirect.js`**:
 - `setupCompleto()` ya no inicializa MONEDAS ni CONFIG
 - Agregados comentarios explicando hardcoding de configuración

---

### Removed

#### Files Deleted (4 archivos, ~1,270 líneas)

- **`UI_Config.html`** - Interfaz de configuración de usuario
- **`05_MonedaService.js`** - Servicio CRUD de monedas
- **`10_ConfigService.js`** - Servicio de gestión de configuración
- **`TEST_DebugConfig.js`** - Tests de configuración

#### Table References Removed

- `MONEDAS` eliminado de `RANGES` en `00_Config.js`
- `CONFIG` eliminado de `RANGES` en `00_Config.js`
- Funciones dinámicas de gestión de monedas eliminadas

---

### Fixed

#### Bug #1: "Tabla no configurada: CONFIG"

- **Síntoma**: Error al ejecutar `updateExchangeRates()`
- **Causa**: Archivos `10_ConfigService.js` y `05_MonedaService.js` eliminados localmente pero presentes en Apps Script
- **Solución**: Eliminación manual de archivos en Apps Script web editor
- **Impacto**: CRÍTICO - Bloqueaba actualización de exchange rates

#### Bug #2: Property Mismatch `.moneda_id` vs `.id`

- **Síntoma**: Rates no se guardaban, validación fallaba con `undefined`
- **Causa**: Código usaba `.moneda_id` en objetos `CURRENCIES` que tienen `.id`
- **Archivos afectados**: `06_ExchangeRateService.js` (líneas 261, 276, 277, 481, 492-493)
- **Solución**: Cambio de todas las referencias `.moneda_id` → `.id`
- **Impacto**: ALTO - Impedía guardado de exchange rates

#### Bug #3: "Tabla no configurada: MONEDAS"

- **Síntoma**: Error al guardar rates desde ExchangeRate-API
- **Causa**: `checkMonedaExists()` validaba contra tabla `MONEDAS` eliminada
- **Archivo afectado**: `04_DataValidation.js` (líneas 37-45)
- **Solución**: Función reescrita para validar contra `CURRENCIES`
- **Impacto**: ALTO - Bloqueaba guardado de rates secundarios (EUR, AUD, CNY)

---

### Metrics

**Reducción de Código**:

- Líneas eliminadas: ~1,270
- Líneas agregadas: ~80
- **Reducción neta: ~1,190 líneas (-23% del módulo de monedas)**

**Complejidad Reducida**:

- 4 archivos menos en el proyecto
- 2 servicios completos eliminados (MonedaService, ConfigService)
- 1 pantalla UI removida (Config manager)
- 2 tablas conceptualmente eliminadas (MONEDAS, CONFIG ya no se usan)

**Verificación de Datos**:

- `updateExchangeRates()` ejecuta sin errores
- DolarAPI guarda 2 rates (oficial + MEP)
- ExchangeRate-API procesa 166 rates, guarda EUR, AUD, CNY
- AUX_COTIZACIONES poblado con 4 monedas en columnas AV-AZ

---

### Lessons Learned

1. **Sincronización Local vs Apps Script**: Archivos eliminados localmente pueden persistir en el editor web
2. **Property Naming Consistency**: Cambios en estructura de datos requieren búsqueda exhaustiva de referencias
3. **Validaciones con Tablas Eliminadas**: Always update validation functions when removing data entities
4. **Debugging Sistemático**: DEBUG logs temporales ayudan a identificar puntos exactos de falla

---

### ADR Candidato

**ADR-001: Hardcoding de Monedas**

**Contexto**: Sistema usaba gestión dinámica con tabla MONEDAS y UI para agregar/editar

**Decisión**: Hardcodear 5 monedas fijas (ARS, USD, EUR, AUD, CNY) en constante `CURRENCIES`

**Razones**:

- Simplicidad: Conjunto de monedas no cambia frecuentemente
- Reducción de complejidad: Elimina capa completa de abstracción
- Mantenibilidad: Un solo archivo contiene toda la configuración
- Performance: No hay queries a BD para obtener monedas

**Consecuencias Positivas**:

- ~23% menos código
- Menos puntos de falla
- Más fácil de entender
- Configuración centralizada

**Consecuencias Negativas**:

- Agregar nueva moneda requiere cambio de código (no UI)
- No hay historial de cambios de monedas en BD

**Estado**: Implementado

---

### Referencias

**Archivos Modificados (6)**:

- `00_Config.js` - Core configuration con CURRENCIES
- `04_DataValidation.js` - Validación actualizada
- `06_ExchangeRateService.js` - Exchange rate services
- `11_UIService.js` - UI helpers
- `98_DataSeeder.js` - Demo data seeders
- `99_SetupDirect.js` - Initial setup

**Documento de sesión**: [`docs/sesiones/2026-02-13_v0.6.0_Simplificacion-Monedas.md`](file:///c:/Users/franc/OneDrive/Escritorio/planilla-finanzas-personales/docs/sesiones/2026-02-13_v0.6.0_Simplificacion-Monedas.md)

---

## v0.5.0 - Sprint 4: ABM Catálogos (2026-01-23) RELEASED

### Resumen del Sprint

Sprint enfocado en gestión completa de Cuentas y Medios de Pago desde interfaz gráfica, permitiendo a usuarios crear, editar y eliminar sus propias categorías y métodos de pago.

**Estado:** Sprint completado en 1 día (100%) - RELEASED 
**Fecha de cierre:** 2026-01-23 
**Código nuevo:** ~2,400 líneas | **Archivos creados:** 2 | **Testing:** 17 tests completos

---

### Added

#### UI Components

- **UI_CuentasManager.html**: Gestor de cuentas con CRUD completo (~857 líneas)
 - Popup 700x650 con diseño Ocean theme
 - Lista searchable de cuentas existentes
 - Formulario crear/editar: nombre, macro_tipo, es_recurrente (toggle switch)
 - Botones Edit/Delete con iconos Material
 - Confirmación para save/delete
 - Modal post-acción ("Seguir aquí" / "Volver al Dashboard")
 - Auto-reset de formulario tras operaciones exitosas
 - Search filter con hide/show dinámico
 - Toggle "Es recurrente" con diseño liquid glass (glassmorphism)

- **UI_MediosManager.html**: Gestor de medios de pago con CRUD completo (~918 líneas)
 - Popup 700x650 con diseño Ocean theme
 - Lista searchable de medios existentes
 - Formulario crear/editar: nombre, tipo, moneda, uso_principal
 - Dropdown dinámico de monedas (DB_MONEDAS)
 - Confirmación para save/delete
 - Modal post-acción con navegación
 - Auto-reset de formulario
 - Search filter con hide/show dinámico

#### Backend Extensions

- **11_UIService.js**: API Wrappers y show functions (+118 líneas)
 - `showCuentasManager()`: Abre popup de cuentas
 - `showMediosManager()`: Abre popup de medios
 - `getCuentasList()`, `createCuentaFromUI()`, `updateCuentaFromUI()`, `deleteCuentaFromUI()`
 - `getMediosList()`, `createMedioFromUI()`, `updateMedioFromUI()`, `deleteMedioFromUI()`

#### Dashboard Integration

- **UI_MainDashboard.html**: Nuevos botones de gestión
 - "Gestionar Cuentas" (icon: category) - reemplaza "Reportes Mensuales"
 - "Gestionar Medios" (icon: credit_card) - reemplaza "Ver Historial"
 - Funciones navigation: `openCuentasManager()`, `openMediosManager()`

#### UX Enhancements (Beyond Original Scope)

- **Back to Dashboard Button**: Navegación directa desde managers
- **Search Filter**: Filtrado en tiempo real de listas
- **Add New Button (+)**: Acceso rápido a formulario desde header
- **Hide on Edit**: Oculta otros items al editar, auto-scroll a form
- **Initially Hidden List**: Solo muestra lista cuando usuario busca
- **Scrollable Header**: Todo el popup scrollea como un bloque
- **Hidden Scrollbars**: Apariencia limpia sin scrollbars internos

---

### Changed

#### Validation Enhancements

- **08_CuentaService.js**: `deleteCuenta()` (líneas 163-173)
 - Agregada validación FK (Foreign Key constraint)
 - Previene eliminación si cuenta tiene transacciones asociadas
 - Mensaje de error claro explicando restricción

- **07_MedioPagoService.js**: `deleteMedioPago()` (líneas 186-196)
 - Agregada validación FK
 - Previene eliminación si medio tiene transacciones asociadas
 - Mensaje de error claro explicando restricción

---

### Fixed

#### Critical Bug #1: Race Condition in confirmAction()

**Issue**: `confirmAction()` llamaba a `closeModal()` primero, que establecía `pendingAction = null`, luego intentaba ejecutar `pendingAction` (ya null). Resultado: acciones nunca se ejecutaban.

**Fix** (UI_CuentasManager.html, UI_MediosManager.html):

```javascript
// ANTES (incorrecto)
function confirmAction() {
 closeModal(); // ← Esto eliminaba pendingAction
 if (pendingAction) {
 // ← Siempre false
 pendingAction(); // ← NUNCA se ejecutaba
 }
}

// DESPUÉS (correcto)
function confirmAction() {
 const actionToExecute = pendingAction; // ← Guardar primero
 pendingAction = null;
 closeModal();
 if (actionToExecute) {
 actionToExecute(); // ← Ahora SÍ ejecuta
 }
}
```

#### Critical Bug #2: Modal Invisible (Z-Index Conflict)

**Issue**: Modal overlay tenía `z-index: 1000` pero `.manager-container` tenía `z-index: 10000`, haciendo que modales quedaran detrás del contenedor y fueran invisibles.

**Fix**:

```css
/* ANTES */
.modal-overlay {
 z-index: 1000; /* Menor que container */
}

/* DESPUÉS */
.modal-overlay {
 z-index: 20000; /* Por encima del container */
}
```

---

### Testing

#### Cuentas Manager (7 tests)

- Create new cuenta
- Edit existing cuenta
- Delete cuenta (no transactions)
- Delete cuenta (with transactions - FK constraint)
- Search filter functionality
- Modal visibility (z-index fix)
- Form auto-reset

#### Medios Manager (6 tests)

- Create new medio
- Edit existing medio
- Delete medio (no transactions)
- Delete medio (with transactions - FK constraint)
- Moneda dropdown population
- Race condition fix verification

#### Integration (4 tests)

- Create cuenta → appears in transaction form dropdown
- Dashboard navigation to managers
- Back to dashboard from managers
- All CRUD operations persist to DB_CUENTAS and DB_MEDIOS_PAGO

---

### Design Features

- **Ocean Theme Consistency**: Ambos popups usan paleta #eff2f9, #39444d, #6e7f8d
- **Material Icons**: category, credit_card, edit, delete, add_circle, arrow_back
- **Inter Font Family**: Consistente con dashboard
- **Border Radius**: 24px container, 18px cards
- **Glassmorphism**: Toggle "Es recurrente" con efecto liquid glass
- **Responsive Design**: Adaptativo a diferentes tamaños

---

## v0.4.0 - Sprint 3: UI Development (2026-01-18) RELEASED

### Resumen del Sprint

Sprint enfocado en interfaces de usuario con diseño neumórfico moderno, menús personalizados y dashboard interactivo.

**Estado:** Days 0-5 completados (100%) - RELEASED 
**Fecha de cierre:** 2026-01-18 
**Código nuevo:** ~3,100 líneas | **Archivos creados:** 9 | **Testing:** Completo

---

### Day 5 Completed: Testing & Documentation 

#### Testing

- End-to-end flow (Menu → Form → Save → Modal → List → Dashboard)
- Form validation (required, positive, date, fx_id conditional)
- UI/UX (hover, loading, success modal, error messages)
- Data display (dashboard stats, recent transactions, filters)
- Responsive design (3-col → 1-col grid, mobile-first)

#### Documentation

- `SPRINT_3_COMPLETO_2026-01-18.md` (comprehensive sprint document)
- Updated `HISTORIAL_DESARROLLO.md` (Sprint 3 marked complete)
- Updated `CHANGELOG.md` (this file, v0.4.0 released)

#### Bug Fixed

- Form ID in `resetForm()` corrected (`'transaction-form'`)

---

### Day 4 Completed: Transaction List View 

#### Added

- **UI_TransactionList.html**: Vista de lista completa (~800 líneas)
 - Tabla: Fecha, Tipo, Monto, Cuenta, Medio, Nota
 - Filtros por sentido (Todos/Ingreso/Egreso)
 - Filtros por cuenta (Todas + lista dinámica)
 - Selector mes/año (consistente con Dashboard)
 - Paginación (50 transacciones max)
 - Badges visuales (verde ingreso, rojo egreso)
 - Responsive (scroll horizontal mobile)

- **11_UIService.js**: `getTransactionsList(year, month, filters)`
 - Filtrado por mes/año y sentido/cuenta
 - Ordenamiento fecha desc
 - Enriquecimiento con nombres (lookup)
 - Retorna: transactions, total, showing

- **12_Menu Service.js**: `showTransactionList()` (modal 1200x900)

#### Testing

- Carga desde menú "Ver Movimientos"
- Filtros funcionales (sentido, cuenta, mes)
- Navegación "← Volver" funcional

---

### Day 3 Completed: Main Dashboard 

#### Added

- **UI_MainDashboard.html**: Dashboard principal con diseño neumórfico
 - Grid de métricas (Saldo, Ingresos, Gastos del mes)
 - Stats cards con iconos y valores dinámicos
 - Sección de acciones rápidas (4 cards navegables)
 - Lista de últimos movimientos (top 5 transacciones)
 - Responsive design (mobile-first)
 - Integración completa con backend

- **11_UIService.js**: Agregado `getDashboardStats()`
 - Cálculo de totales del mes actual
 - Filtrado y ordenamiento de transacciones
 - Enriquecimiento de datos (nombres de cuentas/medios)
 - Retorna: balance, ingresos, egresos, counts, recientes

#### Design Features

- Layout grid adaptativo (3 columnas en desktop, 1 en mobile)
- Action cards con hover effects (translateY + shadow)
- Fecha actual en header con formato locale español
- Iconos emoji para categorías visuales
- Color coding: verde (ingresos), rojo (egresos)

#### Dashboard Metrics

- **Saldo Total:** Ingresos - Egresos del mes
- **Ingresos:** Suma + contador de transacciones
- **Gastos:** Suma + contador de transacciones
- **Recientes:** Top 5 ordenadas por fecha desc

---

### Day 2 Completed: Custom Menus & Quick Actions 

#### Added

- **12_MenuService.js**: Servicio de menús personalizados
 - Trigger `onOpen()` automático
 - Menú "Tidetrack " en barra de Google Sheets
 - Handlers para todas las acciones del menú
 - Confirmaciones para acciones destructivas

- **00_Config.js**: Actualizado con `MENU_CONFIG`
 - Configuración centralizada del menú
 - Items con nombres y funciones asignadas
 - Soporte para separadores

- **11_UIService.js**: Expandido con funciones UI
 - `showTransactionForm()`: Abre formulario de transacción
 - `showMainDashboard()`: Abre dashboard principal
 - `getFormData()`: Obtiene catálogos para dropdowns
 - `createTransaccionFromUI()`: Wrapper para crear transacciones
 - `getLatestRatesForMoneda()`: Obtiene tipos de cambio

- **98_DataSeeder.js**: Agregado wrapper UI
 - `runDataSeedWithConfirmation()`: Dialog de confirmación
 - Auto-inicializa catálogos si no existen
 - Feedback visual de éxito/error

#### Menu Structure

```
Tidetrack 
├── Nueva Transacción 
├── Ver Dashboard 
├── ──────────────────
├── Seed Datos Demo 
└── Limpiar Transacciones ️
```

#### Testing

- Menú aparece automáticamente al abrir Sheet
- Todas las opciones funcionales
- Navegación entre vistas OK
- Confirmaciones de acciones destructivas

---

### Day 1 Completed: Transaction Form 

#### Added

- **UI_TransactionForm.html**: Formulario completo de transacciones
 - Campos: fecha, monto, moneda, sentido, cuenta, medio, nota
 - Validación client-side (JavaScript inline)
 - Validación server-side (integración con DataValidation)
 - Smart defaults: fecha=hoy, sentido=Egreso
 - Dropdowns dinámicos filtrados por sentido
 - Campo fx_id condicional (solo si moneda != base)
 - Feedback visual (success/error alerts)
 - Loading states con spinner
 - Auto-cierre después de guardar exitosamente

- **JS_FormValidation.html**: Validaciones client-side
 - `validateRequired()`, `validatePositive()`, `validateDate()`
 - `showFieldError()`, `clearFieldError()`, `clearAllErrors()`
 - Validación en tiempo real

- **JS_ApiClient.html**: Cliente para google.script.run
 - `submitTransaction()`: Envío asíncrono
 - Handlers de success/failure
 - Loading states management

#### UX Features

- Neumorphic design consistente con design system
- Inputs con sombra inset (depth visual)
- Buttons con micro-animaciones en hover
- Alerts con iconos y colores según tipo
- Form grid responsive (2 cols → 1 col mobile)

#### Testing

- Formulario abre correctamente desde menú
- Validaciones funcionan (required, positive, date)
- Dropdowns cargan catálogos dinámicamente
- Filtro de cuentas por sentido OK
- Campo fx_id aparece/oculta correctamente
- Guardado exitoso de transacciones
- Integración con backend validado

---

### Day 0 Completed: Design System 

#### Added

- **CSS_DesignSystem.html** (500+ líneas): Sistema de diseño completo
 - Variables CSS (colores, tipografía, spacing, shadows)
 - CSS Reset
 - Utilities (typography, spacing, layout, flex, grid)
 - Componentes base (buttons, inputs, selects, labels)
 - Neumorphic shadows (dual light/dark)
 - League Spartan font de Google Fonts
 - Responsive breakpoint (768px)

- **CSS_Components.html** (400+ líneas): Componentes específicos
 - StatCard (métricas financieras con iconos)
 - Badge (status indicators)
 - Alert (success, error, warning, info)
 - Table (con hover states)
 - Modal/Dialog
 - Tooltip
 - Progress bar
 - Skeleton loader
 - Chip/Tag
 - Empty state

- **UI_DesignSystemTest.html**: Página de testing visual
 - Showcase de todos los componentes
 - Paleta de colores
 - Typography scale
 - Estados interactivos

- **11_UIService.js**: Servicio base para dialogs
 - Función `include()` para templates
 - `showDesignSystemTest()` para testing

#### Design Decisions

- **Estética:** Neumorfismo con sombras duales suaves
- **Paleta:** Grises/azules (#e8ecf1 base, acentos verde/rojo para ingresos/egresos)
- **Fuente:** League Spartan (300-700 weights)
- **Arquitectura:** Atomic Design (átomos → moléculas → organismos)

#### Testing

- Visual testing completo
- Todos los componentes renderizan correctamente
- Neumorfismo aplicado (sombras suaves, depth correcta)
- Fuente Google cargada

---

## v0.3.0 - Sprint 2: Catálogos & Data Seeding (2026-01-18) RELEASED

### Resumen del Sprint

Sprint completado exitosamente en 6 días (Day 0 → Day 5) con implementación completa de:

- Sistema de auto-IDs (SKU) para todas las tablas
- Servicios CRUD para catálogos (Medios de Pago, Cuentas)
- TransactionService (core del sistema)
- DataSeeder para generación de datos de prueba
- Suite de testing integral (41/41 tests pasados)

### Day 5 Completed: Integration Testing 

#### Added

- **TESTS_Sprint2_Final.js**: Suite de 5 tests de integración end-to-end
 - Test 1: Setup completo del sistema
 - Test 2: Generación de transacciones (seed)
 - Test 3: Validación de integridad referencial
 - Test 4: Cálculos financieros (totales, promedios)
 - Test 5: Performance y capacidad

- **walkthrough.md**: Documentación completa del Sprint 2
 - Timeline detallado (Days 0-5)
 - Todos los entregables
 - Tests ejecutados
 - Bugs resueltos

#### Testing

- 5/5 tests de integración pasados
- Sistema validado end-to-end
- 41/41 tests totales del sprint

### Day 4 Completed: TransactionService 

#### Added

- **09_TransactionService.js**: Servicio completo para DB_TRANSACCIONES (core del sistema)
 - CRUD: createTransaccion(), getAllTransacciones(), getTransaccionById(), updateTransaccion(), deleteTransaccion()
 - Filtrado: getTransaccionesBySentido(), getTransaccionesByFechas()
 - Auto-ID: Genera TRX-XXXXXX automáticamente
 - Cálculo automático de monto_base
 - Validación CRÍTICA: fx_id obligatorio para monedas extranjeras
 - clearAllTransacciones() - Para re-seed
 - calcularTotales(), getResumenTransacciones()
- **98_DataSeeder.js**: Actualizado con seedTransacciones()
 - Genera N transacciones aleatorias realistas
 - 70% egresos, 30% ingresos
 - 80% moneda base, 20% extranjeras (con fx_id auto)
 - Montos realistas según sentido

#### Testing

- 10/10 tests pasados
- Validación fx_id funcionando correctamente
- Cálculo monto_base verificado
- Seed de 10 transacciones OK

### Day 3 Completed: DataSeeder - Parte 1 

#### Added

- **98_DataSeeder.js**: Utilidades para seeding
 - seedCompleto() - Inicializa todos los catálogos
 - Helper functions: randomDate(), randomMonto(), randomDescripcion(), randomCuenta(), randomMedio(), etc.
 - checkPrerequisites() - Verifica catálogos
 - Placeholders para seedTransacciones() (implementado en Day 4)

#### Testing

- 3/3 tests pasados
- seedCompleto() funciona correctamente
- Todas las funciones helper validadas

### Day 2 Completed: CuentaService 

#### Added

- **08_CuentaService.js**: Servicio completo para DB_CUENTAS
 - CRUD: createCuenta(), getAllCuentas(), getCuentaById(), updateCuenta(), deleteCuenta()
 - Filtrado: getCuentasByMacroTipo()
 - Auto-ID: Genera CTA-XXX automáticamente
 - initializeCuentasBasicas() - 11 cuentas (3 ingresos + 8 egresos)
 - Integración completa con schema (4 columnas: cuenta_id, nombre_cuentas, macro_tipo, es_recurrente)

#### Fixed

- validateCuenta() en DataValidation
 - Agregado parámetro `isUpdate` para evitar error en updates
 - Eliminada función duplicada vieja

#### Testing

- 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando CTA-001, CTA-002, etc.

### Day 1 Completed: MedioPagoService 

#### Added

- **07_MedioPagoService.js**: Servicio completo para DB_MEDIOS_PAGO
 - CRUD: createMedioPago(), getAllMediosPago(), getMedioPagoById(), updateMedioPago(), deleteMedioPago()
 - Filtrado: getMediosByTipo()
 - Auto-ID: Genera MED-XXX automáticamente
 - initializeMediosPagoBasicos() - 5 medios preconfigurados
 - Integración completa con schema (5 columnas: medio_id, nombre_medio, tipo, moneda_id, uso_principal)

#### Fixed

- validateMedioPago() en DataValidation
 - Agregado parámetro `isUpdate` para evitar error en updates
 - Validación de FK moneda_id
 - Validación de enum uso_principal (opcional)

#### Testing

- 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando MED-001, MED-002, etc.

### Day 0 Completed: Auto-ID Migration 

#### Changed

- **02_Utils.js**: Agregado `generateNextId(tableName, prefix, padding)`
- **05_MonedaService.js**: `createMoneda(nombre, simbolo)` - sin moneda_id manual
- **06_ExchangeRateService.js**: fx_id auto-generado (FX-XXXXX)
- **10_ConfigService.js**: config_id auto-generado (CFG-XXX)
- **99_SetupDirect.js**: Actualizado para usar auto-IDs

#### Testing

- 5/5 tests pasados
- MON-001, MON-002, MON-003 en vez de ARS, USD, EUR
- FX-00001, FX-00002 en vez de timestamps

---

## v0.2.0 - Sprint 1: Exchange Rates & Config (2026-01-17)

### Added

- **10_ConfigService.js**: Configuración global del sistema
 - getConfig(), setBaseMoneda(), setFuentePreferida()
 - initializeConfig() con defaults (ARS, oficial)
 - Advertencias al cambiar moneda base
- **06_ExchangeRateService.js**: Gestión de tipos de cambio
 - CRUD de DB_TIPOS_CAMBIO
 - fetchExchangeRatesFromAPI() - Integración con ExchangeRate-API
 - getLatestRate() - Obtiene TC más reciente para un par
 - calculateMontoBase() - Conversión con validación de par
 - cleanupOldRates() - Limpieza de rates antiguos
- **99_SetupDirect.js**: Utilidades de setup
 - setupCompleto() - Inicialización del sistema en un comando
 - initializeMonedasDirect(), initializeConfigDirect()
 - Funciones de testing (test3 a test14)

### Fixed

- Mejorado: initializeMonedas() solo agrega monedas faltantes
- Corregido: Detección de filas vacías en getTableData()
- Implementado: Inserción directa en celdas específicas

### Testing

- 14 tests completos (2026-01-18)
- ConfigService: Lectura, escritura, validaciones
- ExchangeRateService: CRUD, API, cálculos
- Todas las validaciones funcionando correctamente

---

## v0.1.0 - Sprint 0: Core Setup (2026-01-17)

### Added

- **00_Config.js**: Configuración global del sistema
 - Constantes de hoja y rangos de columnas
 - Enums para valores cerrados (sentido, macro_tipo, fuente, status)
 - Configuración de API
 - Mensajes de error centralizados
- **01_Version.js**: Sistema de versionado
 - Control de versiones Semantic Versioning
 - Changelog embebido
 - Funciones de logging de versión
- **02_Utils.js**: Utilidades generales
 - Generación de IDs únicos
 - Manejo de fecha/hora
 - Validación de enums
 - Logging centralizado (error, info, success)
 - Notificaciones al usuario (toast, alert)
 - Utilidades de conversión de datos
- **03_SheetManager.js**: Gestor de acceso a hojas
 - Abstracción de operaciones CRUD
 - Lectura de tablas (`getTableData`, `getTableRange`)
 - Escritura (`appendRow`, `updateRow`, `deleteRow`)
 - Búsqueda por ID (`findById`, `existsById`)
 - Utilidades de columnas
- **04_DataValidation.js**: Validaciones de schema
 - Implementa todas las reglas de DATABASE_SCHEMA
 - Validación de monedas, tipos de cambio, medios, cuentas, transacciones
 - **Regla crítica**: fx_id obligatorio para moneda extranjera
 - Validación de integridad referencial (FKs)
- **05_MonedaService.js**: Servicio de monedas
 - CRUD completo para DB_MONEDAS
 - Inicialización de monedas básicas (ARS, USD, EUR)
 - Utilidades para dropdowns
- **appsscript.json**: Manifest OAuth
 - Scopes para acceso a Sheets y requests externos

### Technical Notes

- Sistema modular con 7 archivos
- ~1,000 líneas de código
- 45+ funciones implementadas
- 6 reglas críticas de validación
- Arquitectura por capas (Config → Utils → SheetManager → Validation → Services)

---

## Formato

Las versiones siguen [Semantic Versioning](https://semver.org/):

- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible hacia atrás
- **PATCH**: Correcciones de bugs

### Tipos de Cambios

- **Added** para nuevas funcionalidades
- **Changed** para cambios en funcionalidad existente
- **Deprecated** para funcionalidades que se eliminarán pronto
- **Removed** para funcionalidades eliminadas
- **Fixed** para correcciones de bugs
- **Security** para vulnerabilidades corregidas

### Added

- **00_Config.js**: Configuración global del sistema
 - Constantes de hoja y rangos de columnas
 - Enums para valores cerrados (sentido, macro_tipo, fuente, status)
 - Configuración de API
 - Mensajes de error centralizados
- **01_Version.js**: Sistema de versionado
 - Control de versiones Semantic Versioning
 - Changelog embebido
 - Funciones de logging de versión
- **02_Utils.js**: Utilidades generales
 - Generación de IDs únicos
 - Manejo de fecha/hora
 - Validación de enums
 - Logging centralizado (error, info, success)
 - Notificaciones al usuario (toast, alert)
 - Utilidades de conversión de datos
- **03_SheetManager.js**: Gestor de acceso a hojas
 - Abstracción de operaciones CRUD
 - Lectura de tablas (`getTableData`, `getTableRange`)
 - Escritura (`appendRow`, `updateRow`, `deleteRow`)
 - Búsqueda por ID (`findById`, `existsById`)
 - Utilidades de columnas
- **04_DataValidation.js**: Validaciones de schema
 - Implementa todas las reglas de DATABASE_SCHEMA
 - Validación de monedas, tipos de cambio, medios, cuentas, transacciones
 - **Regla crítica**: fx_id obligatorio para moneda extranjera
 - Validación de integridad referencial (FKs)
- **05_MonedaService.js**: Servicio de monedas
 - CRUD completo para DB_MONEDAS
 - Inicialización de monedas básicas (ARS, USD, EUR)
 - Utilidades para dropdowns
- **appsscript.json**: Manifest OAuth
 - Scopes para acceso a Sheets y requests externos

### Technical Notes

- Sistema modular con 7 archivos
- ~1,000 líneas de código
- 45+ funciones implementadas
- 6 reglas críticas de validación
- Arquitectura por capas (Config → Utils → SheetManager → Validation → Services)

---

## v0.4.0 - Sprint 3: UI Development (2026-01-18) - IN PROGRESS

### Day 0 Completed: Design System 

#### Added

- **CSS_DesignSystem.html** (500+ líneas): Sistema de diseño completo
 - Variables CSS (colores, tipografía, spacing, shadows)
 - CSS Reset
 - Utilities (typography, spacing, layout, flex, grid)
 - Componentes base (buttons, inputs, selects, labels)
 - Neumorphic shadows (dual light/dark)
 - League Spartan font de Google Fonts
 - Responsive breakpoint (768px)

- **CSS_Components.html** (400+ líneas): Componentes específicos
 - StatCard (métricas financieras con iconos)
 - Badge (status indicators)
 - Alert (success, error, warning, info)
 - Table (con hover states)
 - Modal/Dialog
 - Tooltip
 - Progress bar
 - Skeleton loader
 - Chip/Tag
 - Empty state

- **UI_DesignSystemTest.html**: Página de testing visual
 - Showcase de todos los componentes
 - Paleta de colores
 - Typography scale
 - Estados interactivos

- **11_UIService.js**: Servicio para dialogs
 - Función `include()` para templates
 - `showDesignSystemTest()` para testing

#### Design Decisions

- **Estética:** Neumorfismo con sombras duales suaves
- **Paleta:** Grises/azules (#e8ecf1 base, acentos verde/rojo para ingresos/egresos)
- **Fuente:** League Spartan (300-700 weights)
- **Arquitectura:** Atomic Design (átomos → moléculas → organismos)

#### Testing

- Visual testing completo
- Todos los componentes renderizan correctamente
- Neumorfismo aplicado (sombras suaves, depth correcta)
- Fuente Google cargada

---

## v0.3.0 - Sprint 2: Catálogos & Data Seeding (2026-01-18) RELEASED

### Resumen del Sprint

Sprint completado exitosamente en 6 días (Day 0 → Day 5) con implementación completa de:

- Sistema de auto-IDs (SKU) para todas las tablas
- Servicios CRUD para catálogos (Medios de Pago, Cuentas)
- TransactionService (core del sistema)
- DataSeeder para generación de datos de prueba
- Suite de testing integral (41/41 tests pasados)

### Day 5 Completed: Integration Testing 

#### Added

- **TESTS_Sprint2_Final.js**: Suite de 5 tests de integración end-to-end
 - Test 1: Setup completo del sistema
 - Test 2: Generación de transacciones (seed)
 - Test 3: Validación de integridad referencial
 - Test 4: Cálculos financieros (totales, promedios)
 - Test 5: Performance y capacidad

- **walkthrough.md**: Documentación completa del Sprint 2
 - Timeline detallado (Days 0-5)
 - Todos los entregables
 - Tests ejecutados
 - Bugs resueltos

#### Testing

- 5/5 tests de integración pasados
- Sistema validado end-to-end
- 41/41 tests totales del sprint

### Day 4 Completed: TransactionService 

#### Added

- **09_TransactionService.js**: Servicio completo para DB_TRANSACCIONES (core del sistema)
 - CRUD: createTransaccion(), getAllTransacciones(), getTransaccionById(), updateTransaccion(), deleteTransaccion()
 - Filtrado: getTransaccionesBySentido(), getTransaccionesByFechas()
 - Auto-ID: Genera TRX-XXXXXX automáticamente
 - Cálculo automático de monto_base
 - Validación CRÍTICA: fx_id obligatorio para monedas extranjeras
 - clearAllTransacciones() - Para re-seed
 - calcularTotales(), getResumenTransacciones()
- **98_DataSeeder.js**: Actualizado con seedTransacciones()
 - Genera N transacciones aleatorias realistas
 - 70% egresos, 30% ingresos
 - 80% moneda base, 20% extranjeras (con fx_id auto)
 - Montos realistas según sentido

#### Testing

- 10/10 tests pasados
- Validación fx_id funcionando correctamente
- Cálculo monto_base verificado
- Seed de 10 transacciones OK

### Day 3 Completed: DataSeeder - Parte 1 

#### Added

- **98_DataSeeder.js**: Utilidades para seeding
 - seedCompleto() - Inicializa todos los catálogos
 - Helper functions: randomDate(), randomMonto(), randomDescripcion(), randomCuenta(), randomMedio(), etc.
 - checkPrerequisites() - Verifica catálogos
 - Placeholders para seedTransacciones() (implementado en Day 4)

#### Testing

- 3/3 tests pasados
- seedCompleto() funciona correctamente
- Todas las funciones helper validadas

### Day 2 Completed: CuentaService 

#### Added

- **08_CuentaService.js**: Servicio completo para DB_CUENTAS
 - CRUD: createCuenta(), getAllCuentas(), getCuentaById(), updateCuenta(), deleteCuenta()
 - Filtrado: getCuentasByMacroTipo()
 - Auto-ID: Genera CTA-XXX automáticamente
 - initializeCuentasBasicas() - 11 cuentas (3 ingresos + 8 egresos)
 - Integración completa con schema (4 columnas: cuenta_id, nombre_cuentas, macro_tipo, es_recurrente)

#### Fixed

- validateCuenta() en DataValidation
 - Agregado parámetro `isUpdate` para evitar error en updates
 - Eliminada función duplicada vieja

#### Testing

- 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando CTA-001, CTA-002, etc.

### Day 1 Completed: MedioPagoService 

#### Added

- **07_MedioPagoService.js**: Servicio completo para DB_MEDIOS_PAGO
 - CRUD: createMedioPago(), getAllMediosPago(), getMedioPagoById(), updateMedioPago(), deleteMedioPago()
 - Filtrado: getMediosByTipo()
 - Auto-ID: Genera MED-XXX automáticamente
 - initializeMediosPagoBasicos() - 5 medios preconfigurados
 - Integración completa con schema (5 columnas: medio_id, nombre_medio, tipo, moneda_id, uso_principal)

#### Fixed

- validateMedioPago() en DataValidation
 - Agregado parámetro `isUpdate` para evitar error en updates
 - Validación de FK moneda_id
 - Validación de enum uso_principal (opcional)

#### Testing

- 9/9 tests pasados
- Validaciones funcionando correctamente
- Auto-IDs generando MED-001, MED-002, etc.

### Day 0 Completed: Auto-ID Migration 

#### Changed

- **02_Utils.js**: Agregado `generateNextId(tableName, prefix, padding)`
- **05_MonedaService.js**: `createMoneda(nombre, simbolo)` - sin moneda_id manual
- **06_ExchangeRateService.js**: fx_id auto-generado (FX-XXXXX)
- **10_ConfigService.js**: config_id auto-generado (CFG-XXX)
- **99_SetupDirect.js**: Actualizado para usar auto-IDs

#### Testing

- 5/5 tests pasados
- MON-001, MON-002, MON-003 en vez de ARS, USD, EUR
- FX-00001, FX-00002 en vez de timestamps

---

## v0.2.0 - Sprint 1: Exchange Rates & Config (2026-01-17)

### Added

- **10_ConfigService.js**: Configuración global del sistema
 - getConfig(), setBaseMoneda(), setFuentePreferida()
 - initializeConfig() con defaults (ARS, oficial)
 - Advertencias al cambiar moneda base
- **06_ExchangeRateService.js**: Gestión de tipos de cambio
 - CRUD de DB_TIPOS_CAMBIO
 - fetchExchangeRatesFromAPI() - Integración con ExchangeRate-API
 - getLatestRate() - Obtiene TC más reciente para un par
 - calculateMontoBase() - Conversión con validación de par
 - cleanupOldRates() - Limpieza de rates antiguos
- **99_SetupDirect.js**: Utilidades de setup
 - setupCompleto() - Inicialización del sistema en un comando
 - initializeMonedasDirect(), initializeConfigDirect()
 - Funciones de testing (test3 a test14)

### Fixed

- Mejorado: initializeMonedas() solo agrega monedas faltantes
- Corregido: Detección de filas vacías en getTableData()
- Implementado: Inserción directa en celdas específicas

### Testing

- 14 tests completos (2026-01-18)
- ConfigService: Lectura, escritura, validaciones
- ExchangeRateService: CRUD, API, cálculos
- Todas las validaciones funcionando correctamente

### Próximo Sprint

v0.3.0 - Catálogos & Data Seeding

---

## Próximas Versiones

- Servicio de tipos de cambio (ExchangeRateService)
- Integración con API externa
- Cálculo automático de monto_base
- Servicio de configuración (ConfigService)

---

## Formato

Las versiones siguen [Semantic Versioning](https://semver.org/):

- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible hacia atrás
- **PATCH**: Correcciones de bugs

### Tipos de Cambios

- **Added** para nuevas funcionalidades
- **Changed** para cambios en funcionalidad existente
- **Deprecated** para funcionalidades que se eliminarán pronto
- **Removed** para funcionalidades eliminadas
- **Fixed** para correcciones de bugs
- **Security** para vulnerabilidades corregidas
