# Historial de Desarrollo - Tidetrack Personal Finance

Registro cronologico de la evolucion del proyecto y decisiones importantes.

**Formato:** Las entradas mas recientes aparecen primero (orden cronologico inverso).

---

## 2026-08-21 - El guard de las auxiliares se bloqueaba a si mismo en la segunda corrida (v0.38.3)

### Evento

Con `v0.38.2` ya verificado en la planilla (los tres deltas con flecha, decimales y colores
correctos, auxiliares ocultas), Franco corrio `aplicarInicioPresupuesto()` una segunda vez sobre
la hoja ya aplicada y el modulo abortó de entrada, en el preflight, con:

```
NO APLICADO. Las celdas auxiliares de los deltas (AW8, AW9, AW10) no estan vacias.
Medido contra el gemelo el 2026-08-21: esa zona (columnas AV/AW, a la derecha del
motor de la hoja) no tenia ninguna celda con contenido. Si algo la ocupo desde
entonces, hay que volver a medir antes de escribir. No se toco nada.
```

Franco tuvo que correr `3. Revertir` y recien despues `2. Aplicar` para poder repetir la corrida.
El mensaje manda a "volver a medir" una invasion que no existe: el modulo iba a chocarse contra
esto la primera vez que alguien lo corriera dos veces seguidas.

### Causa

`AV8`/`AV9`/`AV10` (la celda ancla de cada delta) llevan la formula pesada
`HSTACK(tendencia; promedio)` de `_tendenciaYPromedioIp` (ver la cabecera de `IP_AUX` en
`DEVTOOL_InicioPresupuesto.js`): la tendencia queda en el ancla y el promedio **derrama** una
columna a la derecha, en `AW8`/`AW9`/`AW10`. Un derrame nunca deja una formula propia en la celda
donde cae — solo un valor — asi que `AW8:AW10` estaban ocupadas por un numero sin formula, y el
preflight (paso 8) exigia la zona **vacia** sin excepcion. En la primera corrida eso es cierto; en
la segunda, nunca lo es — el guard se bloqueaba contra el resultado de su propia corrida anterior.
No era un guard de mas ni de menos: confundia "vacia" con "libre para escribir", que solo coinciden
la primera vez.

### El arreglo

Se agregan `_auxAjenaIp` / `_auxiliaresAjenasIp` (`DEVTOOL_InicioPresupuesto.js`), que reemplazan
el chequeo "sin formula y con valor" por uno que distingue **PROPIO** de **AJENO**:

- La celda **ancla** es la unica de toda la hoja que puede tener una formula que derrame HSTACK a
  su derecha — esa zona es exclusiva de este modulo, medida sin ningun contenido antes de la
  primera corrida (misma medicion que ya documentaba la cabecera de `IP_AUX`). Por eso
  **cualquier formula** en el ancla, sea cual sea su texto, solo pudo haberla puesto una corrida
  anterior de este mismo modulo: alcanza con preguntar "tiene formula", sin comparar esa formula
  contra lo que `_formulaAuxCapitalIp`/`_formulaAuxFlujoIp` generan hoy.
- La celda de **promedio** nunca tiene una formula propia (es pura celda de derrame). Si el ancla
  es mia y el promedio no tiene formula propia, su contenido es justamente ese derrame: nada que
  objetar. Si el ancla NO es mia (vacia, o un valor estatico) y cualquiera de las dos celdas tiene
  contenido, es ajeno. Y si el promedio tuviera una formula **propia** (no un derrame), es ajeno
  **siempre**, sin importar el estado del ancla.

Reconocer por la **presencia** de una formula en el ancla — y no por su texto exacto — es la misma
leccion que `_esFormulaDeDeltaIp` ya aplico del lado del color de los deltas en `v0.38.2`:
identificar por lo que NO cambia entre generaciones, no por la forma de HOY, para que el guard no
se rompa de nuevo el dia que la formula pesada cambie de forma (ya paso dos veces en un solo dia,
del lado de los patrones `TEXT()` y de las reglas de color). El preflight sigue abortando, con el
mismo mensaje detallado, ante contenido genuinamente ajeno — solo dejo de confundir el resultado
de su propia corrida anterior con una invasion.

### Agujero de banco tapado (verificado por mutacion)

`probar_inicio_presupuesto.js` nunca ejercitaba el preflight en una segunda corrida — probaba las
formulas que el plan propone sobre una hoja vacia, nunca el guard de las auxiliares contra su
propio resultado. Se agrega la seccion 14, que:

- reproduce **el caso del bug**: las seis celdas auxiliares con las formulas reales que el modulo
  escribe (`_formulaAuxCapitalIp()` / `_formulaAuxFlujoIp()`) en el ancla y el numero que ese
  HSTACK derramaria en el promedio, y confirma que `_auxiliaresAjenasIp` no reporta ninguna celda
  ajena;
- confirma que una formula de **forma futura** en el ancla (no el texto de hoy) se sigue
  reconociendo como propia;
- confirma los tres casos de contenido genuinamente ajeno (valor suelto en el ancla, valor suelto
  en el promedio sin ancla, formula propia en el promedio aunque el ancla sea mia);
- y verifica **por mutacion** que aflojar la deteccion rompe la proteccion: reconocer por **texto
  exacto** en vez de por presencia de formula vuelve a bloquear la formula de forma futura (la
  fragilidad que este fix elimina), y quitar el chequeo de la formula propia del promedio deja sin
  detectar exactamente el caso que ese chequeo cubre. Se suma la reconstruccion del guard **viejo**
  (valor-only en las dos celdas, sin mirar la formula del ancla): aplicado sobre la salida real de
  una corrida anterior, bloquea las tres celdas de promedio (`AW8`, `AW9`, `AW10`) — reproduce el
  sintoma exacto que reporto Franco, confirmando que el fix es lo que lo resuelve. Dos asserts
  finales leen el archivo fuente y confirman que el preflight quedo cableado a la funcion nueva y
  que el chequeo viejo ya no esta en el codigo.

### Verificacion

`node devtools/probar_inicio_presupuesto.js` da `SIN FALLAS` con las nuevas aserciones (seccion
14). El resto de los bancos del repo se corrio completo: todos verdes salvo los tres ya
diagnosticados y dejados en rojo a proposito (`probar_formulerio.js`, 5; `probar_riqueza.js`, 7;
`probar_tablero_faltante.js`, 1) — sin cambios respecto del estado previo a esta sesion.

---

## 2026-08-21 - Dos deltas quedaban con el color invertido: reglas de v0.34.0 sobrevivian mudas (v0.38.2)

### Evento

La v0.38.1 arreglo los decimales del texto de los tres deltas y las columnas auxiliares (ambos
verificados en la planilla), pero dejo un tercer defecto sin diagnosticar: los **colores** de dos
de los tres deltas quedaban invertidos. En la corrida real, `Ingresos` cayo 52,7% y se mostraba
**en VERDE**; `Egresos` cayo 50,5% y se mostraba **en ROJO** — las dos al reves. `Capital` estaba
bien.

### Diagnostico

Leyendo el panel de formato condicional de Google Sheets sobre `C15` (el delta de Ingresos)
aparecian **cuatro** reglas donde debia haber dos:

```
=$C$15>0  -> #356854 verde   <- generacion v0.34.0, sobrevivio
=$C$15<0  -> #c93232 rojo    <- generacion v0.34.0, sobrevivio
=$AV$9>0  -> #356854 verde   <- generacion v0.38.1, correcta
=$AV$9<0  -> #c93232 rojo    <- generacion v0.38.1, correcta
```

El mecanismo: `C15` (y `F15`, el delta de Egresos) contienen **texto** desde v0.37.0 (flecha +
tendencia + promedio concatenados en un solo string). En Google Sheets **un texto compara SIEMPRE
mayor que cualquier numero**. La condicion `=$C$15>0` contra una celda de texto no lanza ningun
error — evalua **VERDADERO** sin condicion, siempre — y como esa regla va **primera** en el orden
de evaluacion de la lista de formato condicional, le gana a la regla correcta que esta al lado con
la formula perfecta. En Ingresos eso pinta verde (ahi la regla de "sube" es verde); en Egresos
pinta rojo (ahi la regla de "sube" es roja). Las dos invertidas, de forma perfectamente
consistente con la explicacion, y sin ningun sintoma mas alla del color: ninguna excepcion,
ningun log, nada que hubiera avisado antes de mirar la planilla.

### Por que sobrevivieron

`_clasificarReglasIp` (`DEVTOOL_InicioPresupuesto.js`) reconocia como "propias" **solo** las
reglas de la generacion vigente: comparaba la formula viva contra la lista exacta de las seis
formulas que `_reglasDeltaIp()` genera hoy (comparacion string contra la auxiliar numerica
`AV8`/`AV9`/`AV10`, ver `IP_AUX`). Las reglas de v0.34.0 evaluaban la **propia celda visible** del
delta (`=$C$15>0`) — correcto en su momento, cuando esa celda todavia era un numero — y por lo
tanto no coincidian textualmente con ninguna de las seis formulas de hoy. `_clasificarReglasIp`
las mandaba al monton `ajenas`, y ese monton se repone **intacto y por referencia** en cada
corrida (es el mecanismo que protege reglas de verdad ajenas, como el calendario en `J8:P14`).
Resultado: las reglas rotas de v0.34.0 quedaban huerfanas para siempre — ni se reemplazaban al
aplicar, ni se quitaban al revertir, porque el modulo nunca las reconocia como suyas.

Es **exactamente el mismo bug de identificacion** que el comentario de `_esReglaPropiaFmt` ya
documenta en `DEVTOOL_FormatoMedios.js` (escrito el mismo dia, otro modulo): identificar una
regla propia por la forma exacta de la generacion de HOY deja huerfana a cualquier generacion
anterior en cuanto una referencia se muda de lugar.

### El arreglo

Generalizado a proposito, no un parche puntual para esta generacion: se agrega
`_esFormulaDeDeltaIp`, que reconoce una regla propia por lo que **no cambia** entre generaciones
del mismo mecanismo — el rango de la regla es exactamente **una** celda de delta, y la formula es
una comparacion contra cero de **una sola referencia** de celda absoluta (`=$COL$FILA>0` o
`=$COL$FILA<0`) — sin exigir que esa referencia apunte a la auxiliar de hoy. La funcion cubre por
igual:

- la generacion actual (`=$AV$9>0`, evalua la auxiliar de `IP_AUX`), y
- la de v0.34.0 (`=$C$15>0`, evaluaba directamente la celda visible),

y a cualquier generacion futura, si la auxiliar vuelve a mudarse de columna, sin que haga falta
tocar este codigo de nuevo. `_clasificarReglasIp` usa esta funcion en el punto donde antes
comparaba contra la lista exacta; el resto de la clasificacion (`superadas`, `ajenas`,
`desbordan`, y la guarda contra reglas que tocan un delta pero se extienden fuera de el) queda
intacto.

### Que pasa al aplicar y al revertir

Con el cambio, las reglas de generacion anterior caen en `propias` y se **barren** al aplicar:
`aplicarInicioPresupuesto()` sigue escribiendo exactamente `ajenas + las seis reglas correctas`,
nunca reproduce lo que habia en `propias`. La pregunta simetrica es que hace `revertirInicioPresupuesto()`
— y la respuesta, deliberada, es: **no las repone**, a diferencia de las reglas `superadas` (el
tipo "el texto contiene", que si se fotografian con su foto de color/negrita/rango y se restauran
al revertir). La diferencia es de fondo: una regla superada es una preferencia de **estilo** de
Franco que perdio efecto por una razon ajena a ella (la flecha reemplazo al signo en el texto). Una
regla de generacion anterior de este mismo mecanismo de color, en cambio, hoy evalua contra cero
una celda que es texto — eso es un **falso positivo permanente**, no una preferencia. Reponerla en
un revert reintroduciria exactamente el bug que esta version corrige. Documentado inline en
`revertirInicioPresupuesto()`, junto al bloque que quita las reglas propias.

### Agujero de banco tapado (verificado por mutacion)

La seccion 11b de `probar_inicio_presupuesto.js` ya probaba `_clasificarReglasIp` con reglas
propias de la generacion actual y con reglas de texto viejas (`superadas`), pero **nunca** las
combinaba: nunca puso dos generaciones de `CUSTOM_FORMULA` sobre la **misma** celda de delta, que
es exactamente la forma del bug real. Se agrego la reconstruccion literal del caso que Franco
encontro en produccion — cuatro reglas sobre `C15` (dos formulas de v0.34.0 + las dos de hoy) — y
se verifico por mutacion que las **cuatro** clasifican como `propias` (ninguna cae en `ajenas`,
`superadas` ni `desbordan`) y que `_reglasHacenFaltaIp` da `true` sobre esa clasificacion.

Se sumo ademas una asercion sobre el hecho de Sheets que hace este bug peligroso en primer lugar:
que **ninguna** de las seis reglas que el modulo efectivamente escribe (`_reglasDeUnDeltaIp`,
sobre las tres claves de `IP_CLAVES_DELTA`) evalua la celda de texto visible que pinta. La
justificacion queda inline en el propio test: una comparacion `>0`/`<0` contra una celda de texto
no falla nunca — da verdadero o falso sin condicion — y por eso este bug no disparo ninguna
excepcion ni quedo logueado en ningun lado.

### Verificacion

`node devtools/probar_inicio_presupuesto.js` da `SIN FALLAS` con las nuevas aserciones. El resto
de los bancos del repo se corrio completo: todos verdes salvo los tres ya diagnosticados y dejados
en rojo a proposito (`probar_formulerio.js`, 5; `probar_riqueza.js`, 7;
`probar_tablero_faltante.js`, 1) — sin cambios respecto del estado previo a esta sesion.

---

## 2026-08-21 - El patron con coma decimal estaba al reves; las auxiliares quedaban visibles (v0.38.1)

### Evento

La v0.37.0 (deltas de la hoja Inicio con tendencia + promedio concatenados en un solo texto) se
desplego con `sync_targets.command` y se corrio en la planilla real con
`aplicarInicioPresupuesto()`. Salio mal: `"82,0%"` se vio `"133%"` (perdio el decimal),
`"promedio $211.073,04"` se vio `"$211.073,04333"` (5 decimales de mas), `"$16.725,60
inyectados"` se vio `"$16.725,6000"` (4 decimales de mas), y las celdas auxiliares de trastienda
(`AV8:AW10`) quedaron visibles a la derecha del lienzo, rompiendo el diseno. Se revirtio en el
momento con `revertirInicioPresupuesto()` (la hoja volvio a formulas y colores de v0.34.0) y esta
sesion arregla los dos defectos.

### Defecto 1 — el patron de `TEXT()` estaba al reves de lo que decia el comentario

El comentario de `DEVTOOL_InicioPresupuesto.js` afirmaba que `TEXT()` "SI es sensible al locale"
(a diferencia de `setNumberFormat`, que "NO lo es") y que por eso el patron de formato tenia que
ir con coma decimal. La afirmacion nunca se habia medido, y es la **tercera vez en el mismo dia**
que una suposicion sobre locale sin medir cuesta un bug — antes v0.32.2 (el patron con coma de
`setNumberFormat` se comia el decimal en silencio) y v0.33.0 (`DEVTOOL_FormatoMedios`
documentaba una "excepcion" a la regla de locale que era falsa).

Medicion: se agrego una funcion de diagnostico temporal (`_DIAG_medirPatronYAuxIp`) que escribe,
**por `setFormula` desde Apps Script** (nunca tipeado a mano en la UI, que traduce el separador
al escribir y falsearia la prueba), las dos variantes del patron sobre numeros conocidos en una
hoja temporal descartable. Se desplego con `sync_targets.command` y Franco la corrio desde una
entrada de menu igualmente temporal. Resultado literal:

```
TEXT(0,82; "0,0%")                  -> "82%"              (coma: PIERDE el decimal)
TEXT(0,82; "0.0%")                  -> "82,0%"             (punto: correcto)
TEXT(211073,043333; "$ #.##0,00")   -> "$ 211.073,04333"   (coma: decimales de sobra)
TEXT(211073,043333; "$ #,##0.00")   -> "$ 211.073,04"      (punto: correcto)
TEXT(16725,6; "$ #.##0,00")         -> "$ 16.725,6000"
TEXT(16725,6; "$ #,##0.00")         -> "$ 16.725,60"
```

Conclusion: `TEXT()` se comporta **exactamente como `setNumberFormat`** — el patron va siempre
canonico (punto decimal, coma de miles), sin excepcion de locale. Lo que sigue el locale de la
hoja (es_AR) es el *renderizado* final en pantalla, no el patron que se escribe por codigo. No
hay excepcion a la regla de locale documentada en `DEVTOOL_FormatoMedios.js`: es la misma regla,
sin matices. `IP_PATRON_PORCENTAJE` pasa de `'0,0%'` a `'0.0%'`; `IP_PATRON_MONEDA` de
`'$#.##0,00'` a `'$ #,##0.00'` (con el espacio despues del `$`, igual que las 93 formulas propias
de Franco ya presentes en la hoja Inicio — mantenerlo evita que el monto se vea distinto al resto
de la pantalla). El comentario falso se corrigio explicitamente en el codigo con la medicion
literal, siguiendo el mismo estilo de `_formulaReglaFmt` en `DEVTOOL_FormatoMedios.js`.

### Defecto 2 — las celdas auxiliares quedaban visibles

`IP_AUX` ubica la formula pesada de cada delta (tendencia + promedio derramado) en `AV8:AW10`, a
la derecha del motor de la hoja. La misma funcion de diagnostico midio el estado de visibilidad
de las tres zonas de infraestructura de Inicio: los dos motores existentes (`T:AG`, columnas del
mes en curso, y `AH:AT`, columnas del mes anterior) estan **todos** con
`isColumnHiddenByUser()=true`; `AV` y `AW` daban `false` — ahi estaba el agujero que producia los
"numeros sueltos" que Franco vio en la corrida.

Solucion: `_ocultarAuxiliaresIp(hoja)` nuevo, que llama a `hoja.hideColumns()` sobre la columna
que `_colAuxiliaresIp()` deriva de `IP_AUX.deltaCapital.tendencia` (nunca hardcodeada) y su
vecina (donde derrama el promedio). `aplicarInicioPresupuesto()` la llama despues de escribir y
verificar las formulas. `revertirInicioPresupuesto()` destapa las columnas con
`_mostrarAuxiliaresIp()` **solo si fue este modulo el que las oculto** (capturado ANTES de
escribir nada, con `isColumnHiddenByUser`): si Franco ya las tenia ocultas por su cuenta, revertir
no le toca esa decision.

### Agujero de banco tapado (verificado por mutacion)

`devtools/probar_inicio_presupuesto.js` daba **SIN FALLAS con el patron equivocado** en produccion:
las dos aserciones que fijaban `IP_PATRON_PORCENTAJE`/`IP_PATRON_MONEDA` solo comprobaban que la
constante fuera igual a si misma (`=== '0,0%'`), nunca que la convencion fuera la correcta — un
banco que se limita a repetir el valor que el propio modulo declara no puede detectar que ese
valor este mal desde el origen. Se agregaron dos aserciones que verifican la PROPIEDAD en vez del
literal (el patron de porcentaje no tiene coma; el de moneda tiene el punto como separador
decimal), y se de-hardcodeo el patron de moneda en los tests de `F10` (usaban un regex con el
literal viejo escapado, que hubiera quedado silenciosamente obsoleto con el cambio). Mutacion
verificada a mano: revertir las dos constantes al patron con coma hace fallar el banco en
exactamente las 4 lineas nuevas (confirmado corriendo el banco con la mutacion aplicada, y
restaurado despues). Se agrego ademas la seccion 13, que verifica por espia que
`_ocultarAuxiliaresIp`/`_mostrarAuxiliaresIp` llaman a `hideColumns`/`showColumns` sobre el mismo
rango derivado de `IP_AUX`.

### Estado de los bancos

`node devtools/probar_*.js`: todos en verde salvo los dos ya rojos a proposito desde v0.38.0
(`probar_formulerio.js`, 5 fallas; `probar_riqueza.js`, 7 fallas — declaraciones de propiedad
obsoletas ya diagnosticadas, sin tocar) y el hallazgo pre-existente de `probar_tablero_faltante.js`
(colision R10/U10/X10 entre `DEVTOOL_FormulerioV0111.js` y `DEVTOOL_TableroFaltanteProyectado.js`,
documentado en v0.38.0 como "queda para que Franco decida" — no forma parte de esta sesion).

## 2026-08-21 - Realineacion post-reacomodo del Tablero + bancos endurecidos contra el silencio (v0.38.0)

### Evento

Franco reacomodo la hoja Tablero a mano el 2026-08-21 para dejar lugar al bloque "Faltante
proyectado" que `DEVTOOL_TableroFaltanteProyectado.js` (v0.36.0) agrego el mismo dia: en los
cuatro bloques de agregacion (Ingresos, Gastos Fijos, Gastos Variables, Categorias) el header
que vivia en la fila 8 bajo a la 9 y el derrame de datos que vivia en la 9 bajo a la 10. Cuatro
direcciones cableadas en `DEVTOOL_FormulerioV0111.js` (`FORM_CELDAS`) y una en
`DEVTOOL_RiquezaYCategorias.js` / `DEVTOOL_BloqueCategorias.js` quedaron apuntando al header en
vez del derrame. Sesion dedicada a: (1) realinear las seis direcciones, siempre verificando por
ROTULO contra el gemelo (`docs/permanente/celdas.tsv`) y nunca por coordenada memorizada; (2)
agregar preflight por rotulo donde faltaba; (3) investigar (sin inventar) dos hallazgos que
`probar_riqueza.js` y `probar_stock_flujo.js` ya venian senalando: `Tablero!N19` vacia y
`Tablero!AG9:AG12`/`Inicio!F8` "SIN CAMBIO"; (4) endurecer tres bancos de pruebas que trataban
"la celda declarada no tiene formula" como benigno.

### Direcciones corregidas (verificadas por rotulo y por mutacion)

| Declarada | Corregida | Modulo | Rotulo de control |
|---|---|---|---|
| `Tablero!R9` | `Tablero!R10` | `FORM_CELDAS` | `R9`="Cuenta" |
| `Tablero!U9` | `Tablero!U10` | `FORM_CELDAS` | `U9`="Cuenta" |
| `Tablero!X9` | `Tablero!X10` | `FORM_CELDAS` | `X9`="Cuenta" |
| `Tablero!AA9` | `Tablero!AA10` | `FORM_CELDAS`, `RIQ_BLOQUE_CATEGORIAS.celda`, `BCAT_CELDA` | `AA9`="Nombre" |
| `Tablero!AB8` | `Tablero!AB9` | `RIQ_BLOQUE_CATEGORIAS.celdaRotuloTipo` | `AB9`="Tipo" |
| `Tablero!L28` | `Tablero!L29` | `FORM_CELDAS` | `L28`="Comprobacion Traspasos" |

Metodo de verificacion: para cada una, se revirtio la coordenada a la version vieja, se corrio el
banco correspondiente y se confirmo que reportaba FALLA con el mensaje correcto (celda + que hay
hoy en su lugar), y recien despues se restauro la correccion. Documentado con el output completo
en el reporte de la sesion.

### Preflight por rotulo (defensa nueva)

- `DEVTOOL_FormulerioV0111.js`: `FORM_CELDAS` gana los campos opcionales `rotuloCelda`/
  `rotuloEsperado` en las cuatro entradas de agregacion por cuenta y en "Comprobacion de
  traspasos". `_verificarRotulosFormulerio(ss, nombreTablero)` los recorre y
  `_preflightFormulerio()` aborta el modulo entero (no escribe nada) si algun rotulo vivo no
  coincide. Verificado mockeando `R9="Fecha"`: el preflight lo detecta y lo reporta.
- `DEVTOOL_BloqueCategorias.js`: `_preflightRotuloBcat()` nuevo, verifica `AA9="Nombre"` antes de
  tocar `AA10`, tanto en `estadoBloqueCategorias()` como en `aplicarBloqueCategorias()`.
- `DEVTOOL_RiquezaYCategorias.js` ya tenia este preflight (`rotuloTipoOk` contra
  `celdaRotuloTipo`); solo se corrigio la coordenada de control (AB8 -> AB9).

### Investigado, no inventado

**`Tablero!N19`** — declarada en `FORM_CELDAS` y en `RIQ_CELDAS` como "Capitalizacion real del
mes", esta **vacia** en el gemelo (sin formula, sin valor). No es efecto del reacomodo de hoy:
quedo obsoleta el **2026-08-20**, un dia antes, cuando el rediseno manual de Franco sobre
`L7:O19` movio los montos de la columna N a la O. Esa celda la escribe hoy
`DEVTOOL_Capitalizacion.js` en **`Tablero!O19`** (decision Franco 2026-08-20: *"N19 no debe ser
una resta de descarte. Aca si va el valor registrado del mes"*), con preflight por rotulo propio
(`L19`="Capacidad de Capitalizacion") y calcula exactamente eso — el flujo neto medido hacia
Ahorros + Inversiones, excluyendo el arrastre "Inicio Mes" — verificado contra el gemelo:
`-$59.989,12` hoy. No se escribio ninguna formula en N19 ni se removio la declaracion de
`FORM_CELDAS`/`RIQ_CELDAS`: se documento el hallazgo inline en ambos modulos.

**`Tablero!AG9:AG12`** e **`Inicio!F8`** (seis celdas de `RIQ_CELDAS`) — `probar_riqueza.js` las
reportaba "SIN CAMBIO: el patron no matcheo", y hacia falta distinguir idempotencia (ok) de
desalineacion (bug). Ninguna de las dos: las dos celdas fueron **repurposadas por un modulo mas
nuevo**, con estructura de formula enteramente distinta.
- `Inicio!F8` pertenece a `DEVTOOL_InicioPresupuesto.js` desde v0.32.0.
- `Tablero!AG9:AG12` en el layout de hoy son el bloque **"Tipo de Medios"**
  (`DEVTOOL_StockYFlujo.js`, `SYF_TIPOS_TABLERO`, agrupa por Ahorros/Financiacion/Hogar/
  Inversiones — otra pregunta de negocio, "donde esta la finalidad de la plata"). El bloque
  "Capital por moneda" que `RIQ_CELDAS`/`FORM_CELDAS` creen administrar ahi se corrio a
  **`Tablero!AG18:AG21`** cuando "Tipo de Medios" se inserto arriba de el; ese bloque
  (`SYF_SALDOS_TABLERO`) ya lo escribe y verifica `DEVTOOL_StockYFlujo.js` con su propio
  preflight por rotulo. Confirmado contra el gemelo, celda por celda.

`RIQ_CELDAS`/`FORM_CELDAS` no se editan para retirar estas entradas: es una decision de Franco
(formalizar el retiro o no), documentada pero no ejecutada.

### `_conTipoEnCategorias` ya no explota (crash reportado por el coordinador)

Moria con `Cannot read properties of undefined (reading 'replace')` al procesar `Tablero!AA9`
(ya sin formula, corrida a `AA10`) desde `probar_riqueza.js`. Mismo criterio que
`_repararFormula` (v0.36.1): una celda sin formula es un ESTADO, no un error. Ahora
`_conTipoEnCategorias` devuelve la entrada intacta si no recibe un string no vacio, y el
diagnostico de "por que esta vacia" lo hace quien llama.

### Tres bancos dejan de tratar "sin formula" como benigno

`probar_stock_flujo.js` imprimia `(sin snapshot) Tablero!R9` para las tres celdas corridas y
terminaba en **"SIN FALLAS"**: trataba "la celda que el modulo declara administrar no tiene
formula" como un estado benigno, que es precisamente el modo de falla que este repo viene
sufriendo — un banco en verde sobre una geometria que ya cambio. Se aplico el mismo criterio, con
el mismo mensaje ("celda + que se encontro en su lugar", leido de la columna VALOR del gemelo, no
solo FORMULA), en `probar_riqueza.js` (secciones 1 y 2, y la celda del bloque de categorias pasa
a leerse de `RIQ_BLOQUE_CATEGORIAS.celda` en vez de estar hardcodeada) y en
`probar_formulerio.js` (secciones 1 y 4).

**Consecuencia aceptada, no una regresion**: `probar_formulerio.js` pasa de "SIN FALLAS" a
**5 FALLA(S) fijas** (`Tablero!AF9:AF12` y `Tablero!N19`, los mismos stale documentados arriba) y
`probar_riqueza.js` de 5 a **7 hallazgos**. Van a seguir en rojo hasta que Franco decida retirar
esas entradas de `FORM_CELDAS`/`RIQ_CELDAS` o las de por formalmente aceptadas.

### Hallazgo nuevo, sin resolver: colision de territorio

Al corregir `FORM_CELDAS` a `R10/U10/X10`, la barrida anti-colision preexistente de
`probar_tablero_faltante.js` (seccion 8: busca sus propias celdas como literal de string en el
resto de `src/DEVTOOL_*.js`) empezo a acusar que `DEVTOOL_FormulerioV0111.js` y
`DEVTOOL_TableroFaltanteProyectado.js` nombran las mismas tres celdas. Es real. Verificado que hoy
es **inocuo**: el "anclas" de `FORM_CELDAS` busca el patron viejo `AL9:AL` (bug del swap v0.11) y
ni la formula real de Franco en R10/U10/X10 ni la version que la envuelve
`DEVTOOL_TableroFaltanteProyectado.js` lo contienen (las dos ya usan `AL6:AL`), asi que
`_repararFormula` es un no-op contra las dos. Pero es **fragil**: si el patron viejo reapareciera,
correr "Formulerio v0.11 > Aplicar" despues de "Tablero Faltante Proyectado > Aplicar"
reescribiria una celda que hoy es territorio exclusivo del segundo modulo, potencialmente
corrompiendo la sub-formula `tabla_real` que este ultimo empotra. No se resolvio en esta sesion
(retirar la entrada de `FORM_CELDAS` es una decision de ownership, no una correccion de
coordenada); queda para que Franco decida.

### Archivos NO tocados (jurisdiccion de otra sesion en paralelo)

Por instruccion explicita: `src/DEVTOOL_InicioPresupuesto.js`,
`devtools/probar_inicio_presupuesto.js` y `docs/permanente/celdas.tsv`.

### No desplegado

Todos los cambios quedan en el repo, branch `fix/tablero-pendientes`. El deploy real a la
planilla productiva lo hace Franco por `sync_targets.command`.

---

## 2026-08-18 - Swap de hojas Fix: el rediseno de Franco pasa a ser canonico (v0.11.0)

### Evento

Franco rediseno la planilla completa duplicando hojas con sufijo " - Fix" (mas
"Presupuesto - New") y entrego un documento funcional por hoja. Esta sesion: (1) re-adopto
produccion v0.10.0 como baseline verbatim — una sesion del 2026-08-13 habia desarrollado
v0.9.5-v0.10.0 (layout nuevo + migracion historica v03.1) fuera del repo, drift en ambos
sentidos —; (2) valido el doc de Franco formula por formula con 8 auditores independientes
sobre el export de la planilla viva y lo formalizo en `docs/permanente/FUNCIONALIDADES.md`;
(3) construyo `MIGRACION_v0.11_SwapHojasFix.js` (quinteto estado / sincronizar / aplicar /
revertir / purgar) auditado por 5 refutadores adversariales; (4) remapeo `00_Config.js` a la
geometria Fix en el mismo release y reescribio MAPA_HOJAS.md y el CLAUDE.md.

### Decisiones clave

- **Repunteo semantico, no textual a ciegas**: las referencias de las vistas al Plan viejo
  (`'Plan de Cuentas'!R:T` y `!V:W`) se remapean a la posicion nueva de los mismos bloques
  (L:N y P:Q, columnas completas: el corrimiento de filas no las afecta). Toda referencia
  que ningun patron cubre queda apuntando al respaldo y se lista en el informe.
- **La ventana export->swap se cierra con `sincronizarBDsV011`**: lo cargado en las BDs
  viejas despues de la duplicacion se copia a las Fix cruzando por AUSENCIA (multiconjunto),
  nunca por rango. Filas presentes solo en la Fix abortan el swap.
- **La columna Y del Plan viejo se recrea como columna S del nuevo** (consolidacion de
  cuentas, fuente del dropdown de Cuenta en Cargas), acotada a fila 1000 por el bloque
  residual C1005:N1033. Los dropdowns se reconstruyen por script: las fuentes de Validacion
  de Datos siguen al objeto hoja, no al nombre.
- **Respaldos por renombre + ocultamiento, purga aparte**: borrar hojas es irreversible;
  la purga exige cero referencias vivas y confirmacion del operador.
- **Migracion v0.9.5 retirada del menu**: su preflight espera la geometria pre-Fix y su
  revertir restauraria el layout anterior al rediseno.

### Pendiente (fase formulerio, hoja por hoja)

Checklist completo en FUNCIONALIDADES.md ("Pendientes del formulerio"): taxonomia
'Liquidez' huerfana en Inicio, columna 'Valor en ARS' y #REF!/#VALUE! del Tablero, motor del
Presupuesto, realineacion de 07_MiradaInteranual, calendarios estaticos, trigger FX detenido
desde 2026-08-13, limpieza del catalogo.

---

## 2026-08-12 - Fase 1 del arnes Tidetrack: gobernanza (v0.8.3)

### Evento

Segunda fase del arnes, ejecutada sobre el baseline v0.8.2 de la Fase 0. Tres piezas
construidas en paralelo por agentes constructores y auditadas por refutadores
adversariales independientes (2 lentes por pieza, schema {refuted, bloqueantes,
menores}), segun ARNES_TIDETRACK.md seccion 9.

1. **CLAUDE.md contrato**: reescrito con el molde de pymes (que vive aca / comandos /
   jurisdiccion / modelo de datos / logica critica / gobernanza / reglas / cuando NO
   actuar). El esquema de datos vuelve a describir el layout REAL de produccion
   (Registros I:T con datos desde fila 3 — la disputa de filas quedo documentada como
   CRITICO —, TC en bloques con offset, ADR-005 vigente) y el layout B:M queda
   marcado como codigo v0.9.x no desplegado.
2. **sync_targets.command**: port de sync_clients.command de pymes con mejora local:
   drift-check integrado por target ANTES de confirmar (pull a temporal + diff;
   un pull fallido se trata como drift, nunca como exito), confirmacion "pisar"
   por target divergente, --dry-run con exit code para CI, trap de restauracion.
   Probado en seco contra produccion: detecto correctamente el delta v0.8.3 local
   vs v0.8.2 remoto, y un refutador verifico ademas que el remoto sigue identico
   al baseline de Fase 0 byte a byte.
3. **Injerto v0.8.3 en src/**: _resolverNombreHoja + getters con alias en SHEETS
   (tres discrepancias config-planilla corregidas), RANGES.TC_* con sheet perezoso,
   SSOT para Mirada Interanual, menu sin emojis. Sin cambios de logica de negocio.
   Verificado con node --check y simulacion de carga GAS en node (mocks).

### Hallazgos de la verificacion adversarial (ronda 1)

- CLAUDE.md documentaba `npm run pull` — script inexistente en package.json y ademas
  peligroso (un clasp pull en la raiz pisa src/). Corregido: la inspeccion remota es
  `sync_targets.command --dry-run` o pull manual a temporal.
- CLAUDE.md afirmaba en presente "src/ == produccion v0.8.2", falso desde el propio
  commit de la fase (v0.8.3 pendiente de deploy). Corregido: baseline anclado a la
  Fase 0 como hecho historico; la version desplegada vive en targets.yaml.
- sync_targets.command estaba gitignoreado (`*.command`): el commit lo habria
  excluido en silencio. Corregido con la excepcion `!sync_targets.command`.

### Deuda declarada

- `NAV_CONFIG.SHEETS` duplica 'Cargas' (el pipeline llega a la hoja por ahi, no por
  SHEETS.DATA_ENTRY); consolidacion pendiente para una fase posterior.
- Semantica latente del alias de DATA_ENTRY: si algun dia coexistieran las hojas
  'Cargas' y 'Hoja de Cargas', la politica "gana el ultimo alias" elegiria
  'Hoja de Cargas' (que nunca existio como hoja con datos). Escenario hipotetico
  sin consumidores hoy; revisar el orden si DATA_ENTRY gana consumidores (Fase 2/4).
- Emojis en entradas HISTORICAS de ZZ_Changelog.js (baseline productivo verbatim):
  la regla cero emojis aplica a lo nuevo; no se reescribe historia.
- Nadie ejecuto v0.8.3 contra Sheets todavia al momento del commit; el humo real es
  el deploy controlado por sync_targets.command.

### Cierre de fase (mismo dia)

v0.8.3 desplegada a produccion via `sync_targets.command` (drift-check previo
mostro exactamente el delta esperado; confirmacion "pisar" por protocolo del
script; 17 archivos pusheados; trap restauro `.clasp.json`). Dry-run posterior:
**sin drift** — repo == planilla en v0.8.3. `targets.yaml` actualizado a
`version_desplegada: "0.8.3"`. Queda pendiente el humo funcional de Franco en la
planilla (menu sin emojis visible, procesar una carga, forzar TC).

---

## 2026-08-12 - Fase 0 del arnes Tidetrack: reconciliacion de drift

### Evento

Primera fase del arnes de gestion (`ARNES_TIDETRACK.md`, destilado de planilla-pymes).
Objetivo: repo == origin == planilla, identidades registradas. Se ejecuto completa:

1. **Checkpoint del WIP local**: el clon principal estaba en `0dfacea` (v0.8.0), 9
   commits detras de origin, con trabajo sin commitear. Se preservo todo en la rama
   `wip/pre-arnes` (commit `6426b93`: MAPA_HOJAS.md modificado + 2 prompts +
   notas fran.md) y `main` local se fast-forwardeo a `origin/main` (`1405758`).
2. **Drift-check contra la planilla**: `clasp pull` a directorio temporal (nunca
   sobre `src/`) y diff archivo por archivo. Resultado: **fork bidireccional**.
   - Produccion adelante: v0.8.2 con `07_MiradaInteranual.js` (2026-06-23), modulo
     desconocido por el repo. Un push ciego lo destruia (cicatriz 1 de pymes, calcada).
   - Repo adelante: v0.9.2-v0.9.4 (layout nuevo B:M) jamas desplegados; el
     ZZ_Changelog productivo termina en v0.8.2.
3. **Adopcion del baseline**: produccion adoptada verbatim en `src/` (commit
   `chore(sync)`). La planilla productiva es la unica verdad del estado. v0.9.x queda
   en la historia de git para re-aplicarse con deploy controlado.
4. **Identidades**: creado `targets.yaml` (raiz) con `script_id` y `sheet_id`
   confirmado por triple fuente (MAPA_HOJAS.md + JSON del scanner + metadata Drive).
   Se cerro el `sheets_id: pendiente-confirmar` de la pagina de producto del vault.

### Implicancia critica para el codigo

El HEAD de `src/` vuelve a describir la produccion real: **layout legacy** (Registros
con datos desde fila 3, header fila 2 segun auditoria del modulo Mirada Interanual;
Config con DATA_START_ROW global). La migracion al layout B:M documentada en CLAUDE.md
y CONTEXTO_DATOS.md es codigo v0.9.x NO desplegado: hasta que una fase posterior lo
re-aplique y despliegue con drift-check, toda formula o modulo nuevo debe validarse
contra el estado vivo de la planilla (gemelo digital, Fase 2), no contra los docs.

### Pendientes que esta fase deja planteados

- Resolver el destino de v0.9.x (re-deploy con migracion de layout, o descarte
  parcial): decision de Franco, probablemente en Fase 4 (contratos de motores).
- CLAUDE.md y CONTEXTO_DATOS.md describen el layout nuevo como vigente; la Fase 1
  (CLAUDE.md contrato) debe reescribirlos contra el estado real.
- Revisar la rama `wip/pre-arnes`: el MAPA_HOJAS.md modificado documentaba las hojas
  ocultas (CALCU, ANUAL); evaluar merge tras la Fase 1.

---

## 2026-06-22 - Reconciliacion al layout de produccion nuevo (v0.9.4)

### Evento

Tras confirmar el layout real de produccion via export DevTools, se reconcililo el codigo
de `src/` y toda la documentacion al nuevo estado fisico de las hojas. Las hojas "Registros"
y "Tipos de cambio" son ahora las ex-"Copia de...", que no tienen el offset historico de
ADR-005. Las hojas originales pasaron a llamarse con sufijo `_legacy` y quedaron ocultas
como backup de solo lectura.

### Cambios en codigo (`src/`)

**00_Config.js**: `RANGES` refactorizado. Cada entrada ahora incluye `headerRow` y `dataRow`
propios por tabla, eliminando la dependencia de las constantes globales para las tablas con
layout nuevo. Registros en B:M (headerRow=5, dataRow=6); TC en bloques B:C/E:F/H:I/K:L
(headerRow=6, dataRow=7 para las tablas TC; la fila 5 es el titulo de bloque).

**03_SheetManager.js**: `getTableRange`, `getTableData`, `appendRow` y `appendMassive`
ahora leen `headerRow`/`dataRow` desde `RANGES[tableName]` en lugar de las constantes
globales. Retrocompatible: si la entrada de RANGES no tiene `headerRow`/`dataRow` propios,
cae al valor global.

**06_RegistrosService.js**: sort de Registros actualizado a columna H (Fecha, posicion 8
en el nuevo layout). `appendMassive` de TCs referenciado a los nuevos nombres de bloques
(TC_ARS=B:C, TC_USD=E:F, etc.). `procesarCargas()` sin cambio de comportamiento.

**99_MigrationLogic.js**: nueva funcion `migrarLegacyANuevaProduccion()` que lee las hojas
`_legacy` (en su layout original con offset) y escribe al layout nuevo de produccion.
Idempotente: detecta registros ya migrados por fecha+cuenta+monto antes de insertar.
Nueva entrada de menu [Dev] "Migrar Legacy a Nueva Produccion".

### Cambios documentales

- `CLAUDE.md`: seccion "Esquema de Datos" reescrita al layout nuevo. ADR-005 actualizado.
  Version del producto actualizada a v0.9.4.
- `docs/permanente/MAPA_HOJAS.md`: layout de Registros (B:M, fila 5/6) y Tipos de cambio
  (B/E/H/K, fila 6/7) actualizados. Hojas legacy incorporadas al inventario. GIDs de
  produccion marcados como pendientes de re-mapeo.
- `docs/permanente/CONTEXTO_DATOS.md`: reescritura completa del offset y estructura de
  todas las hojas. Tabla de patron por hoja al final.
- `docs/permanente/GUIA_ARQUITECTURA.md`: ADR-005 evolucionado con la migracion 2026-06-22.
  Se documenta que el offset persiste solo en Plan de Cuentas, Cargas y hojas legacy.
- `docs/permanente/GUIA_MODULOS.md`: RANGES de 00_Config y procesarCargas en 06 actualizados
  al layout nuevo. Funcion `migrarLegacyANuevaProduccion()` documentada en 99_MigrationLogic.
  Version de la guia: 5.0.
- `docs/permanente/DATABASE_SCHEMA.md`: nota aclaratoria al inicio distinguiendo el schema
  objetivo (DATA-ENTRY/PostgreSQL) de la produccion actual.
- `docs/permanente/CHANGELOG.md`: entry v0.9.4 agregada al tope.
- `src/ZZ_Changelog.js`: entry v0.9.4 agregada al tope.
- `src/01_Version.js`: sincronizado a 0.9.4 con cabecera [CONCEPTO DE NEGOCIO] completa.

### Decision de diseno

Se decidio no replicar el offset en las hojas de produccion nueva porque son hojas frescas
sin dependencias UI en las columnas A-H. El beneficio (RANGES mas simples, menor distancia
entre columna conceptual y columna fisica) supera el riesgo (diferencia de layout entre
produccion y legacy). Las hojas legacy ocultas conservan el layout original intacto para
referencia y rollback si fuera necesario.

### Archivos Modificados

- `[MOD]` Backend: `src/01_Version.js`, `src/ZZ_Changelog.js`.
- `[MOD]` Docs: `CLAUDE.md`, `docs/permanente/MAPA_HOJAS.md`,
  `docs/permanente/CONTEXTO_DATOS.md`, `docs/permanente/GUIA_ARQUITECTURA.md`,
  `docs/permanente/GUIA_MODULOS.md`, `docs/permanente/DATABASE_SCHEMA.md`,
  `docs/permanente/CHANGELOG.md`, `docs/permanente/HISTORIAL_DESARROLLO.md`.

---

## 2026-06-21 - Robustez del pipeline de carga batch (v0.9.0)

### Evento

Iteracion de robustez sobre `src/06_RegistrosService.js` para cerrar los Gaps 2 y 3 identificados durante la auditoria de Fase 1 (entrada 2026-06-05): ausencia de validacion contra el Plan de Cuentas antes de escribir al ledger, y la posibilidad de que `tipoCuenta` quedara vacio de forma silenciosa. Se aprovecho la misma sesion para agregar proteccion de concurrencia y mejorar la claridad estructural del modulo.

### Cambios implementados

**1. Deteccion de intencion de carga**

La logica de filtrado inicial solo excluia filas con Monto vacio (`row[0]`). A partir de esta version, una fila se considera "con intencion de carga" si cualquiera de los campos Monto, Cuenta, Medio o Moneda contiene un valor no vacio. Esto garantiza que filas parcialmente completas sean capturadas y evaluadas (y en su caso rechazadas con mensaje) antes de que el usuario las pierda.

**2. Funcion validarFila_() - validacion estricta previa al pipeline**

Se introdujo la funcion privada `validarFila_()` que verifica cuatro condiciones antes de que el lote avance:
- Monto numerico mayor a cero.
- Cuenta presente en alguno de los tres catalogos (INGRESOS, GASTOS_FIJOS, GASTOS_VARIABLES).
- Medio de pago no vacio.
- Moneda dentro de `MONEDAS_DISPONIBLES` (ARS, USD, AUD, EUR).

Si cualquier fila del lote falla al menos una condicion, el lote completo se aborta sin escribir nada en el ledger. El rechazo es total: no se escribe ninguna fila parcialmente valida.

**3. Eliminacion del fallback silencioso de tipoCuenta**

Anteriormente, si la cuenta no matcheaba ningun catalogo, `tipoCuenta` quedaba como cadena vacia y la fila se escribia igual en Registros. Este vector de corrupcion silenciosa queda cerrado: la validacion previa garantiza que toda cuenta que llegue al pipeline ya existe en algun catalogo, por lo que `tipoCuenta` nunca puede quedar vacio. Cierra el Gap 2 identificado en auditoria.

**4. Comportamiento ante rechazo: alerta sin limpiar grilla**

Cuando el lote es rechazado, la grilla de Cargas NO se limpia. El usuario recibe un `ui.alert()` con la lista de filas rechazadas y sus motivos especificos (por ejemplo, "Fila 3: Monto no es un numero valido", "Fila 5: Cuenta no encontrada en ningun catalogo"). Esto permite al usuario corregir los datos directamente sin necesidad de re-ingresarlos.

**5. Proteccion de concurrencia con LockService**

Se envuelve el cuerpo de `procesarCargas()` con `LockService.getDocumentLock()` usando `tryLock(100ms)`. Si el lock no puede adquirirse (ejecucion concurrente), el usuario recibe un aviso y la funcion retorna inmediatamente sin ejecutar. Protege contra doble-clic o ejecuciones simultaneas desde distintos clientes.

**6. Refactor estructural: extraccion de _procesarCargasCore_()**

El nucleo del pipeline (validacion, deduplicacion, fetch de cotizaciones, escritura al ledger) se movio a la funcion privada `_procesarCargasCore_()`. `procesarCargas()` queda como orquestador del lock con un bloque `try/finally` limpio. El comportamiento del happy-path (lote valido) es funcionalmente identico al anterior.

### Impacto en calidad del dato

Los Gaps 2 y 3 de la auditoria de Fase 1 quedan cerrados con esta iteracion:
- **Gap 2 cerrado**: nunca mas puede escribirse un registro con `tipo_cuenta=''` al ledger.
- **Gap 3 parcialmente mitigado**: `validarFila_()` garantiza `monto > 0` del lado del input del usuario; la validacion de `tc > 0` sobre la respuesta de API queda como deuda menor pendiente.

### Decision de diseno

Se evaluo si rechazar solo las filas invalidas y procesar el resto (rechazo parcial). Se decidio mantener rechazo total del lote para preservar la atomicidad del batch: o todo el lote entra, o ninguna fila entra. Esto evita estados intermedios en el ledger cuando el usuario tiene un lote mixto con errores de tipeo.

### Archivos Modificados

- **`[MOD]` Backend**: `src/06_RegistrosService.js`.
- **`[MOD]` Docs**: `src/ZZ_Changelog.js` (v0.9.0), `docs/permanente/HISTORIAL_DESARROLLO.md`.

---

## 2026-06-05 - Cierre Fase 1: auditoría de módulos deprecados y gap de validación

### Evento
Cierre del último ítem de la Fase 1 de `PLAN_IMPLEMENTACION.md`: verificar que la lógica de los módulos deprecados en `_backup/legacy_src_20260317/` fue absorbida por el `src/` actual (v0.8.0). Auditoría ejecutada por el agente `qa-tester` (read-only) con los dos hallazgos críticos verificados manualmente contra el código.

### Hallazgo principal
La migración de marzo no fue un porting 1:1 sino una **reescritura arquitectónica deliberada**: el modelo relacional con IDs (`CUENTAS`, `MEDIOS_PAGO`, `TRANSACCIONES` con `trx_id`/`cuenta_id`/`medio_id`) se reemplazó por strings planos en las hojas del Plan de Cuentas. Ninguna función legacy sobrevive con el mismo nombre en `src/`.

### Destino de cada módulo deprecado
- `04_DataValidation.js` -> PARCIAL. Validación de nombre vacío/duplicado quedó inline en `11_UIService.js`; los chequeos de integridad referencial (FK) no se reimplementaron.
- `06_ExchangeRateService.js` -> PARCIAL. Fetch de cotizaciones reescrito en `15_ExchangeRateApi.js` (argentinadatos + Frankfurter + custom functions). Se eliminaron el CRUD programático de TIPOS_CAMBIO, el trigger horario y la hoja auxiliar.
- `07_MedioPagoService.js` / `08_CuentaService.js` -> PARCIAL. CRUD absorbido en `11_UIService.js` (ABM) + `03_SheetManager.js`. Se perdió el FK check antes de eliminar.
- `09_TransactionService.js` -> PARCIAL. Ingesta batch reemplazada por `06_RegistrosService.js:procesarCargas`. Lectura/update/delete individual y resumen estadístico no reimplementados (no son gap inmediato: el Tablero usa fórmulas QUERY).
- `98_DataSeeder.js` -> DROPPED intencional. El slot 98 lo ocupa `98_DevTools_Scanner.js` (función distinta).
- `TESTS_Sprint5.js` -> DROPPED obsoleto. Testea un modelo de datos que ya no existe.

### Gaps de validación detectados (deuda derivada a appscript-backend)
La simplificación a strings planos eliminó la capa de integridad referencial sin reemplazo. Verificados en código:
- **[CRITICO] Gap 1 — Delete sin FK check.** `11_UIService.js:deleteAbmRecord` (línea 226) llama `deleteRow` sin verificar si la cuenta/medio tiene Registros asociados. Riesgo de Registros huérfanos silenciosos.
- **[CRITICO] Gap 2 — Carga sin validar contra Plan de Cuentas.** `06_RegistrosService.js:procesarCargas` (líneas 66-71) deduce `tipoCuenta` y, si la cuenta no matchea ningún catálogo, la escribe igual con `tipo_cuenta=''` sin alertar. Severidad real condicionada a si la Hoja de Cargas usa dropdowns (pendiente de confirmar con Cowork).
- **[MODERADO] Gap 3 — Cotización sin validar `tc > 0`.** `procesarCargas` congela el valor devuelto por la API sin chequear que sea > 0.
- **[BAJO] Gap 4 — Sin operaciones de lectura/query programática del ledger.** Deuda para presupuestación, resumen anual y la futura webapp.
- **[BAJO] Gap 5 — Sin trigger horario de cotizaciones.** Solo se actualizan vía ejecución manual de `[Dev] Forzar Carga Histórica TC`.

### Conclusión
La absorción funcional del core está completa y la reescritura está justificada para el MVP en Sheets. Los Gaps 1 y 2 son los únicos con impacto operacional inmediato y quedan como pendientes de evaluación de fix por `appscript-backend`. Con esto se da por cerrada la Fase 1 de sincronización de conocimiento.

### Archivos Modificados
- **`[MOD]` Docs**: `HISTORIAL_DESARROLLO.md`.

---

## 2026-06-05 - Sync de metadata y limpieza documental (v0.8.0 mantenimiento)

### Evento
Cierre de la sesión dual Claude Code + Cowork. Tras consolidar el bootstrap de gobernanza y el mapeo de hojas, se resolvieron hallazgos menores de coherencia detectados durante la sincronización de la documentación.

### Decisiones Técnicas
- Se sincronizó `01_Version.js`, que declaraba internamente `0.1.0` (Sprint 0) desde enero, a la versión real del producto `v0.8.0`. Para evitar futuras derivas, el changelog embebido del módulo dejó de duplicar el historial y ahora declara explícitamente a `src/ZZ_Changelog.js` como fuente de verdad canónica.
- Se eliminó `docs/permanente/TABLERO_ARQUITECTURA.md`, un placeholder vacío de 0 bytes que no aportaba valor; el documento de arquitectura del Tablero se creará formalmente cuando comience esa feature (las fórmulas ya viven en `FORMULAS_TABLERO.md`).
- Se sincronizó `ESTRUCTURA.md` a v0.8.0: módulos faltantes de `src/`, los tres documentos de Cowork (`MAPA_HOJAS`, `PLAN_IMPLEMENTACION`, `FORMULAS_TABLERO`) y la nueva capa de gobernanza `.claude/`.

### Archivos Modificados
- **`[MOD]` Backend**: `01_Version.js`, `ZZ_Changelog.js`.
- **`[MOD]` Docs**: `ESTRUCTURA.md`, `HISTORIAL_DESARROLLO.md`.
- **`[DEL]` Docs**: `TABLERO_ARQUITECTURA.md` (placeholder vacío).

---

## 2026-03-23 - Escrutinio Arquitectónico v1.0 (Infrastructure as Code)

### Evento
El usuario proporcionó un JSON masivo (`TIDETRACK_ARQUITECTURA_ESTRICTA.json`) generado desde la planilla para que la inteligencia artificial realice un barrido 100% fiel de toda la arquitectura de datos, fórmulas y metadatos visuales, sin omitir un solo detalle.

### Decisiones Técnicas
- Se implementó un protocolo mediante el agente `@data-mapper` para separar el paradigma documental en dos grandes ejes: `CONTEXTO_DATOS.md` (para Bases de Datos) y `CONTEXTO_UI.md` (para tableros e interfaces interactuables).
- Se ejecutó un script en Node.js que parseó los 580KB de datos brutos, aislando patrones de fórmulas matriciales `QUERY` y `LET`, identificando el offset permanente de 6 a 8 columnas en todas las hojas.
- Se actualizaron las reglas canónicas en `GUIA_ARQUITECTURA.md` incluyendo el ADR-005 (Offset estructural) y ADR-006 (Hidden Engines).
- Se preservó el JSON original en `_backup/` para referencias futuras inmutables.

### Archivos Modificados
- **`[MOD]` Docs**: `GUIA_ARQUITECTURA.md`, `HISTORIAL_DESARROLLO.md`.
- **`[NEW]` Docs**: `CONTEXTO_DATOS.md`, `CONTEXTO_UI.md`.
- **`[DEL]` Docs**: `CONTEXTO_LLM.md` (dividido en los dos archivos anteriores).

## 2026-03-21 - Fix Auto-Sorting Sync Cache (v0.7.7)

### Evento
El Auto-Sorting introducido en v0.7.5 no terminaba de gatillar durante las inyecciones rápidas como el forzado de carga histórica, dejando las fechas mezcladas.

### Decisiones Técnicas
- Se comprobó que el método `sheet.getLastRow()` de GAS sufre de un delay interno provocado por la caché asíncrona de inserción múltiple (`setValues()`), lo que provocaba que la medición determinara que la tabla estaba vacía al momento de ordenar.
- Como Fix Definitivo se prescindió del chequeo visual de GAS y se introdujo un algoritmo matemático ciego: `targetRow + paddedData.length - 1`, lo que predice exactamente qué tan honda llegó la tabla y fuerza el sort inmediatamente.

### Archivos Modificados
- **`[MOD]` Backend**: `06_RegistrosService.js`.
- **`[MOD]` Docs**: `ZZ_Changelog.js` y `HISTORIAL_DESARROLLO.md`.

---

## 2026-03-21 - Alerta UI para Protección Multi-celda (v0.7.6)

### Evento
El usuario decidió optar por mantener la protección de Plan de Cuentas vía `onEdit`, pero solicitó una alerta visual más clara e intrusiva para cuando ocurran ediciones multi-celda accidentalmente, en lugar de intentar reconstruirlas mediante caché complejo.

### Decisiones Técnicas
- Se implementó `SpreadsheetApp.getUi().alert()` dentro de la interrupción `isMultiCell` en `handlePlanCuentasEdit()` (`14_EventHandlers.js`).
- La alerta detiene el flujo visual y exige al usuario hacer clic en "Aceptar" para continuar, asegurándose de que lea la instrucción de usar `Ctrl+Z` para recuperar sus datos. 
- Se añadió un bloque `try/catch` con fallback a `toast` por si el trigger asíncrono pierde el contexto de UI.

### Archivos Modificados
- **`[MOD]` Backend**: `14_EventHandlers.js`.
- **`[MOD]` Docs**: `ZZ_Changelog.js` y `HISTORIAL_DESARROLLO.md`.

---

## 2026-03-21 - Auto-Sorting de Base de Datos Cached (v0.7.5)

### Evento
El usuario solicitó que la solapa de Base de Datos de `Tipos de Cambio` tuviera siempre el formato de lectura descendente (Z a A), alojando las fechas más recientes en la cima de la tabla (Fila 4), sin tener que depender de manipulación manual.

### Decisiones Técnicas
- Modificada la directriz central `appendMassive()` de `06_RegistrosService.js`.
- Se incrustó un algoritmo hook condicional que escanea si la inserción (Target) es un caché modular `TC_*` (como `TC_ARS` o `TC_USD`).
- Si es verdadero, el script mide el vector individual específico de esa tabla dentro del sheet global (ya que hay 4 tablas asimétricas viviendo una al lado de la otra). Captura hasta la última fila poblada de esa columna particular, la encierra y dispara automáticamente un `Range.sort(descending: true)` por cuenta propia sin fricción de usuario. 

### Archivos Modificados
- **`[MOD]` Backend**: `06_RegistrosService.js`.
- **`[MOD]` Docs**: `ZZ_Changelog.js` y `HISTORIAL_DESARROLLO.md`.

---

## 2026-03-21 - Nomenclatura Global a "Gastos" (v0.7.4)

### Evento
El usuario solicitó cambiar la nomenclatura de "Costos Fijos" y "Costos Variables" a "Gastos Fijos" y "Gastos Variables" respectivamente en toda la extensión del proyecto y la UI.

### Decisiones Técnicas
- Se realizó un barrido con Replace All mediante regex identificando 14 locaciones específicas a modificar.
- Modificadas las claves de configuración del diccionario `RANGES` en `00_Config.js`. 
- Modificados los endpoints del `switch` statement en `11_UIService.js` y el Frontend HTML de la modal `UI_AbmPlanCuentas.html`.
- Cambios en las lógicas literales de deducción base y en la migración.
- El cambio a nivel celda de base de datos fue advertido al usuario para que lo realice manually mediante "Buscar y Reemplazar", dada la política estricta de Antigravity de no mutar Data operativa por accidente. 

### Archivos Modificados
- **`[MOD]` Backend**: `00_Config.js`, `06_RegistrosService.js`, `11_UIService.js`, `99_MigrationLogic.js`.
- **`[MOD]` Frontend**: `UI_AbmPlanCuentas.html`.
- **`[MOD]` Docs**: `CONTEXTO_LLM.md`, `GUIA_ARQUITECTURA.md`, `README.md`, `ZZ_Changelog.js`, `HISTORIAL_DESARROLLO.md`.

---

## 2026-03-20 - Fix Dev Toggle Protección Plan Cuentas (v0.7.3)

### Evento
El usuario reportó que la función dev de proteger la hoja "Plan de Cuentas" no funcionaba ("no me funcionó"). Se identificó que la UX del toggle era confusa (el estado por defecto era protegido, por lo que el primer clic lo desprotegía) y que las ediciones multi-celda (como copy-paste masivo) no se revertían automáticamente.

### Decisiones Técnicas
- Se reescribió explícitamente la función `togglePlanCuentasProtection()` (`14_EventHandlers.js`) para mostrar un cuadro de diálogo (YES/NO) revelando el estado actual (Activado/Desactivado) previo a la confirmación.
- Debido a las limitaciones de GAS (sin `e.oldValue` en multi-edit), `handlePlanCuentasEdit()` ahora intercepta operaciones `range.getNumRows() > 1` y advierte mediante un `toast` que deben presionar `Ctrl+Z` si afectaron datos accidentalmente.

### Archivos Modificados
- **`[MOD]` `src/14_EventHandlers.js`**: Refactor de toggle e interrupción isMultiCell.
- **`[MOD]` Docs**: `ZZ_Changelog.js` e `HISTORIAL_DESARROLLO.md` actualizados a v0.7.3.

---

## 2026-03-20 - Recalculador Masivo de Tipos de Cambio (v0.7.2)

### Evento
Al introducir la *Base Monetaria ARS* (v0.7.1), surgió la necesidad de aplicar esta nueva lógica matemática a las transacciones que ya habitaban en la hoja `Registros` (especialmente las recién importadas desde `BD antigua` con el motor v0.7.0).

### Decisiones Técnicas
- Se incorporó la función `recalcularTcRegistros()` en `99_MigrationLogic.js`.
- Es una macro altamente agresiva que extrae la columna de Fecha de toda la hoja `Registros` en un solo array, mapea la caché para cada día, crea un array 2D exacto del volumen de la hoja (con `1.0`, `TC_USD`, `TC_AUD`, `TC_EUR`) y aplica un `.setValues()` aplastando masivamente las columnas Q:T.
- La función se expuso en el menú estandar `[Dev] Recalcular TC en Registros` y asume que el usuario pobló la caché previamente.

### Archivos Modificados
- **`[MOD]` `src/99_MigrationLogic.js`**: Núcleo del recalculador batch.
- **`[MOD]` `src/00_Config.js`**: Endpoint de UI menu.

---

## 2026-03-20 - Pivot Monetario a Base ARS (v0.7.1)

### Evento
El usuario detectó que gestionar la consolidación general patrimonial usando el USD como moneda ancla 1.0 dificultaba enormemente las llamadas `QUERY` analíticas y la legibilidad. Se solicitó pivotar el sistema entero para que ARS sea la base real y las divisas se guarden bajo su cotización directa en Pesos.

### Decisiones Técnicas
- Se transpusieron lógicamente las inyecciones en la base de datos de Tipos de Cambio. `TC_ARS` quedó como un fixed value de `1.0`. Por su parte, la extracción directa de la API `argentinadatos` ahora alimenta de lleno a `TC_USD`.
- Para EUR y AUD se incorporó el recálculo matemático de "Triangulación" (`cotizacion_USD_en_ARS / ratio_Euro_vs_Dolar`) ya que las APIs provistas funcionan como pares relativos al dólar (EUR/USD).
- Se actualizó el `PROMPT_MAESTRO` y `CONTEXTO_LLM` para enseñarle al cerebro Gemini/NotebookLM que de ahora en más, unificar y agrupar importes es mera cuestión de multiplicar cada celda iterada.

### Archivos Modificados
- **`[MOD]` `src/15_ExchangeRateApi.js`, `src/06_RegistrosService.js`, `src/99_MigrationLogic.js`** — Transposición del núcleo de caché y fallback matemáticos.
- **`[MOD]` Docs**: `CONTEXTO_LLM.md`, `PROMPT_MAESTRO.md`, `ZZ_Changelog.js`, `HISTORIAL_DESARROLLO.md`.

---

## 2026-03-20 - Motor de Migración de Base de Datos Legacy (v0.7.0)

### Evento
El usuario requirió un motor automatizado permanente para migrar bases de datos (2024+) provenientes del sistema anterior de registro no-estandarizado, deduciendo automáticamente información cruzada y detectando diccionarios faltantes.

### Decisiones Técnicas
- Se amplió la constante `FLOOR_DATE` a `2024-01-01` en los servicios de API y Registros para permitir descargas masivas históricas de cotizaciones.
- Se introdujo el módulo `99_MigrationLogic.js` con dos etapas funcionales interactivas:
  1. **Análisis de Faltantes**: Cruza `BD antigua` contra `Plan de Cuentas`. Inyecta masivamente medios desconocidos con "ARS" usando `appendMassive` y devuelve en pantalla las "Cuentas" desconocidas imprimiéndolas en la Columna H de la BD antigua para decisión del usuario.
  2. **Migración Titánica**: Procesa por batch la traducción del modelo viejo (A:G) al modelo `Registros` (12-Array), consultando en el acto la memoria caché cargada de Tipos de Cambio.
- Se actualizó el `CONTEXTO_LLM.md` para instruir a la IA sobre la naturaleza de la hoja `BD_ANTIGUA`.

### Archivos Modificados
- **`[NEW]` `src/99_MigrationLogic.js`** — Funciones de análisis y parseo masivo.
- **`[MOD]` `src/00_Config.js`** — Añadida hoja `BD_ANTIGUA` y menús Dev interactivos correspondientes.
- **`[MOD]` `src/06_RegistrosService.js` / `15_ExchangeRateApi.js`** — Modificación del piso temporal histórico (2024).
- **`[MOD]` `docs/permanente/CONTEXTO_LLM.md`** — Adición estricta del esquema de la hoja transicional de migración.

---

## 2026-03-20 - Herramienta de Carga Histórica de Tipos de Cambio (v0.6.2)

### Evento
El usuario solicitó una función bajo demanda para popular forzosamente el historial de cotizaciones desde el 01/01/2026, llenando de manera estructurada los años anteriores de "Tipos de Cambio".

### Decisiones Técnicas
- Se extendió la UI de `12_MenuService.js` con una nueva acción: `[Dev] Forzar Carga Histórica TC`.
- La función `forzarCargaHistorica()` anidó un fetch estructurado por lotes: extrae todo el arreglo de *argentinadatos* en una llamada y utiliza la consulta _Time Series_ de *Frankfurter API* (`start..end`) para resolver EUR y AUD rápidamente sin hacer cientos de peticiones HTTP en un loop.
- Se implementó fallback manual al día hábil anterior si la API no reporta valor para un sábado/domingo determinado.

### Archivos Modificados
- **`[MOD]` `src/00_Config.js`** — Se añadió `TC_USD` al catálogo de rangos mapeados (I, L, O, R).
- **`[MOD]` `src/12_MenuService.js`** — Se mapeó el trigger UI.
- **`[MOD]` `src/15_ExchangeRateApi.js`** — Creación del algoritmo maestro de rellenado batch.

---

## 2026-03-20 - Refactorización de Columnas "Cargas" y "Registros" (v0.6.1)

### Evento
El usuario modificó la estructura de las hojas Cargas y Registros, separando el campo "Tipo" manual (Ingreso/Egreso) del "Tipo de Cuenta" (Ingreso, Costo Fijo, Costo Variable), que ahora se deduce en backend sin afectar el Data Entry frontal.

### Decisiones Técnicas
- Se desenchufó el onEdit anterior en `14_EventHandlers.js` que autocompletaba el viejo campo Tipo.
- El `06_RegistrosService.js` ahora toma el array de 7 elementos [Monto, Tipo, Cuenta, Medio, Moneda, Fecha, Nota] y fabrica un registro de 12 elementos.
- Se implementó la lógica `ingresosCat.includes(cuentaName)` dentro del forEach de procesamiento para deducir el "Tipo de Cuenta" haciendo cruce directo con los rangos definidos en Plan de Cuentas, y ahorrando una columna en el UI frontal del usuario.

### Archivos Modificados
- **`[MOD]` `src/14_EventHandlers.js`** — Limpieza de listener de columna.
- **`[MOD]` `src/00_Config.js`** — Rango `REGISTROS` ahora es `I:T`.
- **`[MOD]` `src/06_RegistrosService.js`** — Nuevos índices de array y cruce de categorías para deducción.

---

## 2026-03-20 - Sistema de Registros Batch y APIs Multi-Moneda (v0.6.0)

### Evento
Implementación completa del flujo de datos definitivo: traslado en lote desde la hoja "Cargas" a la base de datos "Registros", enriqueciendo cada transacción con cotizaciones históricas de diversas APIs utilizando el USD como ancla.

### Decisiones Técnicas (ADR-003)
- Se desarrolló un sistema **Batch Transfer** (`procesarCargas` en `06_RegistrosService.js`).
- **Data Lake de Cotizaciones**: Se creó la hoja "Tipos de Cambio" como memoria caché de cotizaciones para evitar peticiones redundantes.
- Las consultas históricas se resuelven contra *DolarApi* vía *argentinadatos* (ARS Oficial) y *Frankfurter* (EUR, AUD). 
- El sistema rellena el vector TC (P, Q, R, S) de forma transparente.

### Archivos Modificados/Creados
- **`[NEW]` `src/06_RegistrosService.js`** — Lógica principal de batch processing y guardado en `Registros`.
- **`[NEW]` `src/15_ExchangeRateApi.js`** — Lógicas de fetch contra APIs públicas de cotización.
- **`[MOD]` `src/00_Config.js`** — Se mapearon las nuevas entidades (`REGISTROS`, `TC_ARS`, `TC_EUR`, `TC_AUD`).
- **`[MOD]` `src/12_MenuService.js`** — Se añadió el procesador manual `[Dev] Procesar Cargas`.

---

## 2026-03-20 - Autocompletado de Hoja Cargas (v0.5.1)

### Evento
Implementación de lógica de autocompletado en la hoja "Cargas" para agilizar el Data Entry, respondiendo al diseño ágil y reduciendo fricción.

### Decisiones Técnicas
- Se extendió el sistema de `onEdit` en `14_EventHandlers.js`.
- Se rutean los eventos detectados en la hoja "Cargas" (`NAV_CONFIG.SHEETS.CARGAS`).
- Al seleccionar una Cuenta (Col J), busca sincrónicamente en qué categoría del Plan de Cuentas está y completa el Tipo (Col K).
- Al elegir un Medio (Col L), busca la moneda asociada en la tabla de Medios y la completa (Col M).
- Al cargar un Monto (Col I), completa automáticamente la Fecha (Col N) con `hoy` si la celda original estaba vacía.

### Archivos Modificados
- **`[MOD]` `src/14_EventHandlers.js`** — Controlador de eventos y autocompletado interactivo.
- **`[MOD]` `src/ZZ_Changelog.js`** — Release v0.5.1 documentada.

---

## 2026-03-20 - Creación del Agente `github-docs` y Expansión del Ecosistema Agéntico

### Evento
Se incorporó al equipo un nuevo agente especializado: `github-docs`. Este agente es responsable exclusivo de mantener la documentación técnica pública del repositorio en GitHub, cubriendo el `README.md`, el `HISTORIAL_DESARROLLO.md` y la `GUIA_ARQUITECTURA.md` desde la perspectiva de una audiencia externa (desarrolladores, colaboradores, LLMs que consuman el repo).

### Contexto
El agente `agente-contextual` cumplía un rol mixto: mantenía la memoria interna del proyecto y actuaba intermitentemente como redactor de documentación pública. Se identificó la necesidad de separar ambas responsabilidades para mayor claridad del pipeline.

### Decisiones Técnicas (ADR)
- **Separación de responsabilidades de documentación**: `agente-contextual` = memoria interna + ADRs de código. `github-docs` = documentación pública GitHub-facing.
- **Pipeline actualizado**: la secuencia estándar de cierre de feature ahora incluye un paso explícito de `github-docs` entre `auto-changelog` y `github-sync`.
- **Jerarquía en el organigrama**: `github-docs` ocupa el mismo nivel que `lean-code-expert` y `auto-changelog` (capa de cierre post-implementación), reportando al `tidetrack-pm`.

### Archivos Creados/Modificados
- **`[NEW]` `.agent/skills/github-docs/SKILL.md`** — Skill completo con workflow de 5 fases
- **`[MOD]` `.agent/skills/tidetrack-pm/SKILL.md`** — Organigrama actualizado, pipeline ampliado
- **`[MOD]` `README.md`** — Diagrama y tabla de agentes actualizados

### Resultado
- Nuevo agente `github-docs` operativo con SKILL.md completo
- Organigrama de 8 agentes actualizado en `tidetrack-pm` y `README.md`
- Pipeline de cierre de feature: `...auto-changelog → github-docs → github-sync`

---

## 2026-03-18 - Diseño y Consolidación del Ecosistema Agéntico v2.0

### Evento
Auditoría completa del equipo de agentes existente y rediseño de la arquitectura agéntica. Se consolidaron agentes redundantes, se crearon nuevos skills especializados y se estableció el `tidetrack-pm` como dispatcher central oficial.

### Contexto
El ecosistema de agentes creció orgánicamente y necesitaba un rediseño para evitar solapamiento de responsabilidades. Se evaluó cada agente contra el criterio "una responsabilidad única, no se pisa con otro".

### Decisiones Técnicas
- **`tidetrack-pm` como entry point único**: Todo pedido del usuario pasa por el dispatcher antes de ir a un agente especializado.
- **`auto-changelog` siempre antepenúltimo**: El versionado en código ocurre ANTES de documentar y ANTES del push.
- **`github-sync` siempre último**: Nada sube a GitHub hasta que todo lo anterior esté cerrado.
- **Skills auditados/reescritos**: `appscript-backend`, `appscript-ui`, `auto-changelog`, `agente-contextual`.
- **Skills nuevos**: `tidetrack-pm` como skill formal (antes era implícito).

### Resultado
- Ecosistema de 8 agentes con responsabilidades no superpuestas
- Pipeline estándar de Feature Completa documentado formalmente
- README actualizado con diagrama de arquitectura agéntica

---

## 2026-03-17 a 2026-03-20 - Sprint ABM Plan de Cuentas (v0.4.1 → v0.4.9)

### Evento
Desarrollo completo del ABM (Alta/Baja/Modificación) del Plan de Cuentas: el sistema multi-entidad que permite al usuario gestionar sus propias categorías de Ingresos, Costos Fijos, Costos Variables, Medios de Pago, Monedas y Proyectos desde un popup interactivo en Google Sheets.

### Contexto
El proyecto pivotó de una arquitectura relacional compleja a un sistema de Hojas Modulares. El primer ABM operativo es el Plan de Cuentas, que actúa como catálogo central de todas las categorías del sistema.

### Decisiones Técnicas (ADRs)
- **ADR-001: Arquitectura de Hojas Modulares** — Cada entidad (Ingresos, Gastos, Monedas, etc.) tiene su propia hoja independiente con rangos fijos. No hay una mega-tabla relacional.
- **ADR-002: Moneda por Defecto** — El campo Moneda no es obligatorio en el ABM. Si no se especifica, el sistema usa ARS como moneda base por defecto. Evita fricción innecesaria en el registro diario.
- **Separación UX de éxito vs. alerta**: Reemplazo de `alert()` nativos por estados visuales integrados al Design System (Success State, Error inline con SVG).
- **Validación de duplicados en backend**: `saveAbmRecord()` en `11_UIService.js` verifica unicidad por nombre+módulo antes de persistir.
- **Optimización de SheetManager**: `appendRow()` y `getTableData()` refactorizados con búsqueda inversa (bottom-up) para eliminar cuelgues en hojas con muchas filas.

### Entregables Principales
| Versión | Fecha | Feature |
|---------|-------|---------|
| v0.4.1 | 2026-03-17 | Refactorización backend multi-tabla + `UI_AbmPlanCuentas.html` |
| v0.4.2 | 2026-03-17 | Fix de CSS en popups (templates con `createTemplateFromFile`) |
| v0.4.3 | 2026-03-17 | Creación de `UI_SharedStyles.html` (Design System compartido) |
| v0.4.4 | 2026-03-17 | Success State visual integrado (reemplazo de `alert()`) |
| v0.4.5 | 2026-03-17 | Paleta institucional + botón `.btn-selected` + halos de foco |
| v0.4.6 | 2026-03-17 | Validación de duplicados (UI inline, sin `alert()` nativo) |
| v0.4.7 | 2026-03-17 | ADR-002 documentado + validación de duplicados en backend |
| v0.4.8 | 2026-03-17 | Moneda opcional en formulario ABM |
| v0.4.9 | 2026-03-20 | Optimización crítica de rendimiento + fix JS + restricción monedas |

### Archivos Involucrados
- **`src/00_Config.js`** — Nuevas tablas modulares, monedas restringidas a ARS/USD/AUD/EUR
- **`src/03_SheetManager.js`** — Optimización bottom-up de lectura/escritura
- **`src/11_UIService.js`** — Endpoints ABM + validación de duplicados
- **`src/12_MenuService.js`** — Acceso al ABM desde el menú de Sheets
- **`src/UI_AbmPlanCuentas.html`** — UI Router multi-entidad con states dinámicos
- **`src/UI_SharedStyles.html`** — Design System CSS compartido
- **`src/ZZ_Changelog.js`** — Versiones v0.4.1 → v0.4.9 registradas

### Bugs Críticos Resueltos
1. **Cuelgue al guardar registros** — `appendRow()` buscaba la última fila desde arriba en tablas con muchos datos. Resuelto con búsqueda inversa.
2. **CSS no aplicado en popups** — `createHtmlOutputFromFile()` no interpreta `<?!= include() ?>`. Resuelto con `createTemplateFromFile().evaluate()`.
3. **Error JS en `UI_AbmPlanCuentas`** — Referencia a elemento `groupAbreviacion` eliminado del DOM. Resuelto eliminando la referencia.
4. **Moneda obligatoria causaba fricción** — Campo redefinido como opcional con fallback a ARS.

### Resultado
- ABM Plan de Cuentas funcional con 6 entidades gestionables
- Design System institucional aplicado consistentemente
- Validación de duplicados con feedback visual integrado
- Rendimiento de SheetManager optimizado para operaciones a largo plazo

---

## 2026-03-17 - Organización de Estructura Canónica (Agente Contextual)

### Evento
Aplicación de reglas de organización dictadas por el skill `agente-contextual` para eliminar archivos huérfanos e incongruencias en la raíz del proyecto.

### Acciones Tomadas
- Se movió el archivo resolutivo `planilla-reinversión.md` (un doc valioso dictando la reestructuración completa del proyecto) desde la raíz (`/`) a la ruta canónica `docs/permanente/`.
- Se registró el directorio de utilidades locales `scripts/` y el archivo `planilla-reinversión.md` en el documento oficial `ESTRUCTURA.md` asegurando que todos los archivos queden correctamente mapeados sin Context Rot.

---

## 2026-03-17 - Reinversión del Proyecto y Simplificación Arquitectónica

### Evento
Reinicio del desarrollo con un reenfoque hacia principios básicos ("principles first"), priorizando la simplicidad, modularidad e integración nativa con el ecosistema de Google Sheets y futuras inteligencias artificiales (ej. MCP, Claude Code).

### Contexto
El esquema de base de datos relacional y la fuerte carga de UI (web app) complejizó demasiado una herramienta cuyo fin es simplificar la vida del usuario. Se decide pivotar hacia "Hojas Modulares" independientes, siendo visualmente auditables y sirviendo de base directa para dashboards y automatizaciones externas sin fricciones.

### Decisiones Técnicas (ADR Candidatos)
- **Plan de cuentas centralizado**: Reemplazo de las tablas ocultas por una Hoja visible y relacionable que actúe de eje central. Mapeo estricto 1:1 de columnas para referencia directa en fórmulas.
- **Modularidad Total**: Separación de responsabilidades en Módulos Básicos: Plan de Cuentas, Hoja de Cargas, Hoja Anual, Presupuestación, Panel General, Hoja Base de Datos central. Posibilidad de "DLCs" (Módulo Tarjetas, Préstamos).
- **Escalabilidad AI & Integraciones**: Arquitectura hiper-documentada en GitHub para que agentes (ej. Claude Code) la consuman e integren APIs (Looker, Mails, Drive).
- **Frontend Dogmático**: Minimizar re-ingeniería limitando la UI/UX a reglas precisas (paletas, tipografía, uso de pop-ups).

### Próximos Pasos
- Elaboración y ejecución del Plan de Implementación (`implementation_plan.md`).
- Diseño del esquema modular de hojas y eliminación de la complejidad relacional inicial.

---

## 2026-02-13 - Simplificación de Arquitectura de Monedas (v0.6.0) 

### Evento

Refactorización arquitectónica eliminando gestión dinámica de monedas, hardcodeando 5 monedas fijas y removiendo UI de configuración. Reducción de ~23% en código del módulo de monedas.

### Contexto

El sistema tenía gestión dinámica de monedas (tabla MONEDAS, MonedaService, ConfigService, UI_Config) que agregaba complejidad innecesaria para un conjunto pequeño y fijo de monedas usadas en la planilla personal.

### Decisión Técnica (ADR Candidato)

**Hardcodear 5 monedas**: ARS (base), USD, EUR, AUD, CNY en constante `CURRENCIES` en `00_Config.js`

**Rationale**:

- Simplicidad sobre flexibilidad (monedas no cambian frecuentemente)
- Eliminación de capa completa de abstracción
- Configuración centralizada en un solo archivo
- Performance mejorado (no queries a BD)

### Cambios Implementados

#### Archivos Agregados/Modificados (6):

1. **`00_Config.js`**:
 - Agregado `CURRENCIES` constant (5 monedas)
 - Agregado `BASE_CURRENCY = 'ARS'`
 - Agregado `AVAILABLE_CURRENCY_IDS`
 - Eliminado `MONEDAS` y `CONFIG` de `RANGES`
 - Agregadas 4 funciones stub para compatibilidad

2. **`04_DataValidation.js`**:
 - `checkMonedaExists()` reescrito para validar contra `CURRENCIES`

3. **`06_ExchangeRateService.js`**:
 - Todas las referencias a `getMonedaByISO()` y `getAllMonedas()` reemplazadas
 - Fixed: `.moneda_id` → `.id` (5 ubicaciones)

4. **`11_UIService.js`**, **`98_DataSeeder.js`**, **`99_SetupDirect.js`**:
 - Actualizados para usar `CURRENCIES` directamente

#### Archivos Eliminados (4, ~1,270 líneas):

- `UI_Config.html` - Interfaz de configuración
- `05_MonedaService.js` - CRUD de monedas
- `10_ConfigService.js` - Gestión de configuración
- `TEST_DebugConfig.js` - Tests de configuración

### Bugs Críticos Resueltos

1. **"Tabla no configurada: CONFIG"**
 - Causa: Archivos eliminados localmente pero presentes en Apps Script
 - Solución: Eliminación manual en Apps Script web editor

2. **Property mismatch `.moneda_id` vs `.id`**
 - Causa: Estructura CURRENCIES usa `.id` but código usaba `.moneda_id`
 - Solución: 5 referencias corregidas en ExchangeRateService

3. **"Tabla no configurada: MONEDAS"**
 - Causa: Validaciones referenciaban tabla eliminada
 - Solución: `checkMonedaExists()` reescrito

### Resultado

- Código reducido en ~1,190 líneas (-23% del módulo)
- 4 archivos menos en el proyecto
- Exchange rates actualizándose correctamente
- AUX_COTIZACIONES poblado con 4 monedas (USD, EUR, AUD, CNY)
- Sistema más simple y mantenible

### Lecciones Aprendidas

1. **Sincronización clasp**: Archivos eliminados localmente pueden persistir en Apps Script editor
2. **Property naming**: Cambios en estructura requieren búsqueda exhaustiva de referencias
3. **Cascade validation updates**: Siempre actualizar validaciones al remover entidades
4. **DEBUG logging**: Logs temporales ayudan a identificar puntos exactos de falla

### Documentación Creada

- `docs/sesiones/2026-02-13_v0.6.0_Simplificacion-Monedas.md` - Documento completo de sesión
- `CHANGELOG.md` actualizado con v0.6.0
- `HISTORIAL_DESARROLLO.md` actualizado (esta entrada)

### Próximos Pasos

- [ ] Dashboard currency selector (feature futura)
- [ ] Tests de Sprint 5 (necesitan actualización para CURRENCIES)
- [ ] Considerar remover columnas MONEDAS/CONFIG de sheet (limpieza visual opcional)

---

## 2026-01-23 - Sincronización Completa de Documentación Post-Sprint 3 

### Evento

Limpieza y sincronización integral de toda la documentación del proyecto para reflejar el estado real tras la finalización exitosa del Sprint 3 (v0.4.0) y preparar el terreno para Sprint 4.

### Contexto

Con 4 sprints completados (v0.1.0 → v0.4.0), el proyecto acumuló documentos que reflejaban estados intermedios o pendientes. Esta sincronización asegura que todos los documentos normativos, informativos y contextuales estén alineados con la realidad del código implementado.

### Acciones Tomadas

#### 1. Actualización de Documentos de Raíz

- **ESTRUCTURA.md**:
 - Actualizado estado de `/src/` (de "pendiente" a "16 módulos + 7 HTML")
 - Agregado `GUIA_MODULOS.md` y `database_er_diagram.png` a tabla de permanentes
 - Reflejado workflow completo de desarrollo con checkmarks
 - Fecha actualizada a 2026-01-23, versión v0.4.0

- **README.md**:
 - Sección "Estado del Proyecto" completamente reescrita
 - Sprints 0-3 marcados como completados con detalles de cada day
 - Estadísticas actualizadas: 20 archivos, ~6,200 líneas de código
 - Agregado Sprint 4 como "Próximo Sprint"

#### 2. Actualización del Product Backlog

- **PRODUCT_BACKLOG.md**:
 - Reorganizada sección inicial con Sprints Completados (v0.1.0-v0.4.0)
 - Cada sprint documentado con features implementadas
 - Agregada nueva sección "Sprint 4: CRUD Completo (v0.5.0) - EN PLANIFICACIÓN"
 - Features de Sprint 4 listadas con dependencias cumplidas
 - Fecha actualizada a 2026-01-23

#### 3. Limpieza de Notas Pendientes

- **Notas Fran.md**: Verificado vacío (sin tareas pendientes)

### Resultado

- Todos los documentos reflejan estado real del código (v0.4.0)
- Sprint 3 documentado como 100% completado
- Sprint 4 planificado con alcance claro (UPDATE/DELETE)
- Estadísticas del proyecto actualizadas (6,200 LOC, 20 archivos)
- Estructura de carpetas sincronizada con contenido real
- Roadmap claro para próximo sprint

### Impacto

Esta sincronización cumple los siguientes objetivos:

1. **Memoria del Proyecto**: Documentación fiel al estado real
2. **Onboarding**: Nuevos desarrolladores/agentes pueden leer docs y entender el estado actual
3. **Prevención de Context Rot**: No hay documentos "deshonestos"
4. **Planificación de Sprint 4**: Base clara para comenzar próximo desarrollo

### Próximos Pasos

Proyecto listo para planificar e iniciar **Sprint 4: CRUD Completo (v0.5.0)**

- Formulario de edición de transacciones
- Función DELETE con confirmación
- Navegación desde lista a edición

---

## 2026-01-18 - Sprint 3: UI Development (Days 0-5) COMPLETO

### Evento

Implementación completa de interfaces de usuario con diseño neumórfico moderno, menús personalizados de Google Sheets, dashboard interactivo y lista de transacciones.

### Estado Final

**Days completados:** 0, 1, 2, 3, 4, 5 (100% completado) 
**Fecha de cierre:** 2026-01-18

### Resumen Ejecutivo

- **Duración:** 5 días activos
- **Código nuevo:** ~3,100 líneas (HTML/CSS/JS)
- **Archivos creados:** 9 (7 UI + 2 servicios)
- **Archivos actualizados:** 3 servicios de backend
- **Progress:** 100% del sprint completado 

### Entregables Principales

**Day 0: Design System **

- `CSS_DesignSystem.html` (500+ líneas) - Variables, reset, utilities, componentes base
- `CSS_Components.html` (400+ líneas) - StatCard, Badge, Alert, Table, Modal, etc.
- `UI_DesignSystemTest.html` - Showcase visual de todos los componentes
- Estética: Neumorfismo con League Spartan font
- Paleta: Grises/azules (#e8ecf1 base) con acentos verde/rojo

**Day 1: Transaction Form **

- `UI_TransactionForm.html` (740 líneas) - Formulario completo auto-contenido
- `JS_FormValidation.html` - Validaciones client-side
- `JS_ApiClient.html` - Cliente google.script.run
- Features: Smart defaults, validación dual (client/server), dropdowns dinámicos, campo fx_id condicional
- Modal de éxito con `resetForm()` function

**Day 2: Custom Menus & Quick Actions **

- `12_MenuService.js` - Servicio de menús personalizados (trigger onOpen)
- Menú "Tidetrack " con 5 opciones (Nueva Transacción, Dashboard, Ver Movimientos, Seed, Clear)
- Actualización de `00_Config.js` con MENU_CONFIG
- Actualización de `11_UIService.js` con funciones UI completas
- Wrapper `runDataSeedWithConfirmation()` en DataSeeder

**Day 3: Main Dashboard **

- `UI_MainDashboard.html` (600 líneas) - Dashboard principal
- Grid de métricas (Saldo, Ingresos, Gastos del mes)
- Sección de acciones rápidas (4 cards navegables)
- Lista de últimos 5 movimientos
- `getDashboardStats()` en UIService - Cálculo de totales del mes

**Day 4: Transaction List View **

- `UI_TransactionList.html` (800 líneas) - Lista completa de transacciones
- Filtros por sentido y cuenta
- Selector de mes/año
- Paginación (50 transacciones)
- `getTransactionsList()` en UIService - Filtrado y enriquecimiento de datos

**Day 5: Testing & Documentation **

- Testing end-to-end manual completo
- Validación de flujos completos (crear → ver → filtrar)
- Responsive testing verificado
- Documentación completa: `SPRINT_3_COMPLETO_2026-01-18.md`
- Actualización de HISTORIAL_DESARROLLO y CHANGELOG

### Decisiones Técnicas (ADRs)

**ADR-004: Neumorphic Design System**

- **Decisión:** Usar neumorfismo como estética principal
- **Rationale:** Balance entre modernidad y profesionalismo, diferenciador visual
- **Implementación:** Sombras duales (light + dark), sin borders, depth por shadows

**ADR-005: HTML Dialogs vs Sidebars**

- **Decisión:** Usar `showModalDialog()` en vez de sidebars
- **Rationale:** Mayor espacio visual, mejor para forms complejos, comportamiento nativo
- **Trade-off:** Requiere cerrar para volver a la sheet

**ADR-006: Auto-contenido de Forms**

- **Decisión:** CSS y JS embebidos en cada HTML (no archivos separados)
- **Rationale:** Apps Script no soporta imports tradicionales, evita problemas de CORS
- **Implementación:** Usar `<?!= include('filename') ?>` para compartir

**ADR-007: Client + Server Validation**

- **Decisión:** Validación en ambos lados
- **Rationale:** UX inmediato (client) + seguridad/integridad (server)
- **Implementación:** validateRequired/Positive/Date en JS, DataValidation.js en backend

### Testing Realizado

**Day 0:**

- Todos los componentes renderizan correctamente
- Fuente Google Fonts carga OK
- Neumorphism visual verificado

**Day 1:**

- Formulario abre desde menú
- Dropdowns cargan dinámicamente
- Validaciones funcionan (required, positive, date)
- Filtro de cuentas por sentido OK
- Campo fx_id condicional OK
- Guardado exitoso de transacciones

**Day 2:**

- Menú aparece en Google Sheets
- Todas las opciones funcionales
- Seed con confirmación OK

**Day 3:**

- Dashboard carga métricas reales
- Saldo/Ingresos/Gastos del mes calculan correctamente
- Últimos movimientos se muestran ordenados
- Navegación entre Dashboard y Form OK

### Bugs Resueltos

1. **11_UIService.js - Función huérfana**
 - Problema: Bloque try-catch fuera de función createTransaccionFromUI
 - Impacto: CRÍTICO - Error de sintaxis impedía cargar el servicio
 - Solución: Reencapsulado correctamente en la función

### Métricas del Sprint (Completado)

- **Archivos creados:** 9 nuevos (7 UI + 2 servicios)
- **Archivos modificados:** 3 (Config, UIService, DataSeeder)
- **Líneas de código:** ~3,100 (HTML/CSS: ~2,600, JS: ~500)
- **Componentes UI:** 15+ (Design System + Forms + Dashboards + Lists)
- **Funciones nuevas:** 20+ (Services + Validations + Helpers + UI)
- **Progress:** 100% completado 

### Resultado Final

Sprint completado exitosamente al 100%. Sistema UI completo y funcional con:

- Diseño neumórfico moderno
- Registro de transacciones (CREATE)
- Dashboard con estadísticas en tiempo real
- Lista de transacciones con filtros
- Menús personalizados de Google Sheets
- Validación dual (cliente + servidor)
- Modal de éxito con flujo de continuidad

### Documentación Final

Ver documento completo: `docs/sesiones/SPRINT_3_COMPLETO_2026-01-18.md`

### Próximos Pasos: Sprint 4

**Recomendación**: Completar CRUD con UPDATE y DELETE

- Editar transacción existente
- Eliminar transacción con confirmación
- Formulario en modo edición vs creación

---

## 2026-01-18 (Madrugada) - Sprint 2 COMPLETO 

### Evento

Sprint 2 finalizado exitosamente con implementación completa de catálogos, migración a auto-IDs (SKU), TransactionService, DataSeeder, y testing integral. **41/41 tests pasados**.

### Resumen Ejecutivo

- **Duración:** 6 días (Day 0 → Day 5)
- **Código nuevo:** ~1,500 líneas
- **Módulos creados:** 4 (MedioPago, Cuenta, Transaction, DataSeeder)
- **Módulos actualizados:** 5 (Utils, SheetManager, Validaciones, servicios)
- **Bugs críticos resueltos:** 2
- **Tests ejecutados:** 41/41 

### Entregables Principales

**Auto-IDs (SKU System):**

- MON-XXX, FX-XXXXX, MED-XXX, CTA-XXX, TRX-XXXXXX, CFG-XXX
- Función `generateNextId(tableName, prefix, padding)` en Utils

**Servicios CRUD:**

- `07_MedioPagoService.js` - 5 medios pre-configurados
- `08_CuentaService.js` - 11 cuentas pre-configuradas
- `09_TransactionService.js` - Core del sistema con validación fx_id

**Data Seeding:**

- `98_DataSeeder.js` - Helper functions + seedCompleto()
- `seedTransacciones(cantidad, diasAtras)` - Generación de datos de prueba

**Testing:**

- Suite integral: `TESTS_Sprint2_Final.js` (5 tests end-to-end)
- Cobertura: 100% funcionalidades

### Bugs Críticos Resueltos

1. **SheetManager.appendRow() - Detección de última fila**
 - Problema: Usaba última fila global de hoja, no de tabla específica
 - Impacto: CRÍTICO - Todas las inserciones fallaban
 - Solución: Detección independiente por tabla

2. **validateTransaction() - Error en UPDATE**
 - Problema: Verificaba duplicados en CREATE y UPDATE
 - Impacto: MEDIO - Imposible actualizar transacciones
 - Solución: Parámetro `isUpdate` para distinguir operaciones

### ADRs (Decisiones Técnicas)

- **ADR-001:** Sistema SKU con prefijos y padding configurable
- **ADR-002:** Cada tabla gestiona su última fila independientemente
- **ADR-003:** Patrón `isUpdate` en todas las validaciones

### Próximos Pasos: Sprint 3

Desarrollo de UI (Frontend):

- HTML forms y popups
- Client-side JavaScript
- Custom menus de Google Sheets
- Data visualization y dashboards

Ver: `docs/sesiones/SPRINT_2_COMPLETO_2026-01-18.md` para detalles completos.

---

## 2026-01-17 - Inicio del Proyecto y Documentación de Contexto

### Evento

Inicio oficial del proyecto Tidetrack como sistema de finanzas personales. Se estructura la documentación completa y se configura el entorno de desarrollo con sistema multi-agente.

### Acciones Tomadas

#### 1. Configuración de Sistema Agéntico

- Implementación de arquitectura multi-agente con 6 especialistas:
 - Product Manager (estrategia y backlog)
 - UI/UX Designer (sistemas de diseño)
 - Context Historian (documentación y memoria)
 - QA Tester (automatización de pruebas)
 - Security Auditor (auditoría OWASP)
 - Backend Architect (BD y APIs)
- Configuración de dispatcher para enrutamiento de agentes
- Implementación de regla de estructura obligatoria

#### 2. Documentación Completa del Contexto de Negocio

- **RESUMEN_PROYECTO.md**: Definición operativa, origen, propuesta de valor
- **CONTEXTO_NEGOCIO.md**: Círculo de oro (Why/How/What), modelo B2C, estrategia competitiva
- **PRINCIPIOS_DISEÑO.md**: Reglas de UX, hábito como tecnología, multi-moneda
- **ROADMAP_PRODUCTO.md**: Etapas de MVP a plataforma
- **PRODUCT_BACKLOG.md**: Features priorizadas por etapa
- **REGLAS_AGENTE.md**: Convenciones de desarrollo

#### 3. Reorganización de Archivos Iniciales

- Movimiento de `contexto.md` → `ARQUITECTURA_AGENTICA.md`
- Extracción de contenido de `tidetrack_finanzas_personales.md` (279 líneas) a estructura organizada
- Reset de documentos incorrectos (CHANGELOG, DATABASE_SCHEMA, GUIA_ARQUITECTURA)
- Actualización de README y ESTRUCTURA con contexto correcto

### Rationale

**Por qué documentar primero:**
El proyecto transita de una planilla íntima a un producto escalable. Documentar el contexto de negocio, principios y reglas ANTES de implementar asegura que:

1. **Coherencia:** Toda decisión técnica se alinea con el propósito ("paz financiera")
2. **Velocidad:** Programadores e IAs pueden implementar sin "adivinar" intenciones
3. **Prevención de Context Rot:** La documentación actúa como "memoria externa" del proyecto

**Sistema multi-agente:**
Permite desarrollo paralelo donde cada agente (PM, UX, QA, Security, Backend) tiene responsabilidades claras y respeta las mismas reglas de estructura.

### Resultado

- Contexto de negocio completamente documentado
- Principios de diseño y UX definidos
- Roadmap de MVP a plataforma establecido
- Sistema de agentes configurado
- Estructura de carpetas organizada y validada

### Próximos Pasos

1. **Diseño de Base de Datos** (Tarea inmediata)
 - Modelar entidades: Transactions, Currencies, ExchangeRates, PaymentMethods, Accounts, Budgets, Events, Users
 - Definir relaciones y constraints
 - Documentar en `DATABASE_SCHEMA.md`

2. **Definición de Stack Tecnológico**
 - Mobile-first (React Native vs. Flutter)
 - Backend (Node.js vs. Python FastAPI)
 - Base de datos (PostgreSQL)

- Autenticación (OAuth 2.0)

3. **Implementación del MVP**
 - Registro ultrarrápido
 - Presupuesto basado en histórico
 - Tablero esencial
 - Multi-moneda básico

---

## 2026-01-17 (Tarde) - Diseño Completo de Base de Datos

### Evento

Diseño e implementación del schema completo de base de datos usando Google Sheets como backend con disciplina relacional.

### Acciones Tomadas

#### 1. Decisión de Arquitectura (ADR-001)

- **Decisión:** Usar Google Sheets (hoja DATA-ENTRY) como sistema de base de datos para MVP
- **Rationale:** Costo cero, prototipado rápido, facilidad operativa, migración futura posible
- **Alternativas consideradas:** Firebase, PostgreSQL (Supabase), SQLite

#### 2. Diseño de Schema Relacional

Creación de 6 tablas con ubicaciones fijas en DATA-ENTRY:

| Tabla | Rango | Propósito |
| ---------------- | ----- | ----------------------------------- |
| DB_MONEDAS | B:D | Catálogo de monedas |
| DB_TIPOS_CAMBIO | F:Q | Cotizaciones con auditoría completa |
| DB_MEDIOS_PAGO | S:W | Catálogo de medios de pago |
| DB_CUENTAS | Y:AB | Categorías/cuentas |
| DB_TRANSACCIONES | AD:AM | Tabla central de movimientos |
| DB_CONFIG | AO:AQ | Parámetros globales |

#### 3. Innovación Técnica Clave

**"Congelamiento" de tipo de cambio (`fx_id`):**

- Cada transacción guarda referencia al TC usado (`fx_id`)
- Histórico estable: no cambia aunque actualices cotizaciones
- Auditoría completa: `fetched_at`, `provider`, `raw_payload`

#### 4. Documentación Creada

- **DATABASE_SCHEMA.md**: Schema completo con todas las tablas, columnas, FKs, reglas de integridad
- **GUIA_ARQUITECTURA.md**: ADR-001, stack tecnológico, estrategia de migración
- **database_er_diagram.png**: Diagrama de relaciones entre entidades

### Rationale

**Por qué Google Sheets:**
El esquema está completamente normalizado (3NF) y funciona como base relacional real, pero aprovecha:

- Accesibilidad inmediata (usuario puede ver/auditar datos)
- Costo operativo cero durante validación
- Colaboración nativa de G Suite
- Migración directa a PostgreSQL cuando escale

**Por qué fx_id es crítico:**
Multi-moneda serious requiere que el histórico sea estable. Si una transacción de hace 6 meses usó TC=1000, debe mantenerse así aunque hoy el TC sea 1200. `fx_id` garantiza eso.

**Modelo "Estrella":**
DB_TRANSACCIONES es el centro, rodeado de catálogos (Monedas, Medios, Cuentas) y la tabla operativa de TiposCambio. Esto permite dashboards eficientes agregando `monto_base`.

### Resultado

- Schema relacional completo y normalizado
- 6 tablas con PKs, FKs, y reglas de integridad documentadas
- Enums definidos para consistencia de datos
- ADR-001 documentado (Google Sheets → PostgreSQL)
- Estrategia de migración clara (umbral: 60% capacidad)
- Casos de uso críticos resueltos (gasto en USD con TC congelado)

### Próximos Pasos

1. **Implementación del Schema** (Siguiente paso inmediato)
 - Crear hoja DATA-ENTRY en Google Sheets
 - Definir rangos con nombres (Named Ranges)
 - Crear validaciones de datos (enums)
 - Proteger estructura (bloquear inserción de columnas)

2. **Scripts de Automatación**
 - Script de fetch de tipos de cambio (API)
 - Script de cálculo automático de `monto_base`
 - Script de validación de integridad

3. **Carga de Datos Iniciales**
 - Poblar DB_MONEDAS (ARS, USD, EUR mínimo)
 - Configurar DB_CONFIG (base_moneda_id = ARS)
 - Crear medios y cuentas básicas

---

## 2026-01-17 (Noche) - Sprint 0: Implementación del Core Modular

### Evento

Implementación completa del Sprint 0 del sistema modular de Apps Script, estableciendo la infraestructura base para el proyecto.

### Acciones Tomadas

#### 1. Planificación de Arquitectura Modular

- **Decisión**: Sistema de 13 archivos .js numerados por orden de carga
- **Estrategia**: Arquitectura por capas (Config → Utils → SheetManager → Validation → Services → UI)
- **Versionado**: Semantic Versioning (SemVer) con changelog embebido
- **Sprints**: 6 sprints incrementales planificados

#### 2. Implementación de 7 Archivos (Sprint 0)

| Archivo | Líneas | Responsabilidad |
| -------------------- | ---------- | ---------------------------------------- |
| 00_Config.js | 183 | Constantes, rangos, enums, defaults |
| 01_Version.js | 61 | Control de versiones + changelog |
| 02_Utils.js | 227 | IDs, fecha/hora, validación, logging, UI |
| 03_SheetManager.js | 186 | Abstracción CRUD sobre Sheets |
| 04_DataValidation.js | 194 | Reglas de integridad del schema |
| 05_MonedaService.js | 171 | CRUD de monedas |
| appsscript.json | 9 | Manifest OAuth |
| **TOTAL** | **~1,031** | **7 archivos** |

#### 3. Funcionalidades Implementadas

**Infraestructura:**

- Configuración centralizada de rangos fijos (B:D, F:Q, S:W, etc.)
- 6 enums definidos (SENTIDO, MACRO_TIPO, TIPO_MEDIO, FUENTE_FX, STATUS_FX, USO_PRINCIPAL)
- Sistema de logging con categorías (error, info, success)
- Notificaciones al usuario (toast, alert)

**Capa de Acceso a Datos:**

- `getTableData(tableName)` - Lee tabla completa
- `appendRow(tableName, rowData)` - Agrega fila
- `updateRow(tableName, rowIndex, data)` - Actualiza fila
- `deleteRow(tableName, rowIndex)` - Elimina fila
- `findById(tableName, id, idColumnIndex)` - Búsqueda por ID

**Validaciones Críticas:**

1. `monto > 0` siempre
2. `sentido` define dirección (Ingreso/Egreso)
3. `fx_id` obligatorio si `moneda_id ≠ base_moneda_id`
4. `fx_id` debe tener `status='ok'`
5. `tc > 0`
6. `base_moneda_id ≠ quote_moneda_id`

**Servicio de Monedas:**

- `getAllMonedas()` - Lista todas
- `getMonedaById(moneda_id)` - Obtiene una
- `createMoneda(id, nombre, simbolo)` - Crea con validación
- `updateMoneda(id, nombre, simbolo)` - Actualiza
- `deleteMoneda(id)` - Elimina (con advertencia de FKs)
- `initializeMonedas()` - Seed de ARS, USD, EUR

### Rationale

**Por qué numeración de archivos:**
Apps Script no garantiza orden de carga. La numeración asegura que las dependencias se carguen primero (Config antes que Services).

**Por qué separación por capas:**
Cada capa tiene una responsabilidad clara y no conoce detalles de implementación de capas superiores. Esto facilita testing y mantenimiento.

**Por qué validación antes de escritura:**
Todas las funciones `create*()` llaman a `validate*()` primero. Los errores se detectan antes de corromper datos.

**Por qué changelog embebido:**
Apps Script no tiene control de versiones nativo. El changelog viaja con el código como documentación.

### Resultado

- 7 archivos modulares listos para Apps Script
- ~1,000 líneas de código documentado
- 45+ funciones implementadas
- Todas las reglas de DATABASE_SCHEMA en código
- Sistema versionado (v0.1.0)
- CRUD completo de monedas

### Próximos Pasos

1. **Testing Manual** (Pendiente del usuario)
 - Copiar archivos a Apps Script
 - Ejecutar `initializeMonedas()`
 - Verificar creación de ARS, USD, EUR

2. **Sprint 1** (Próximo)
 - 06_ExchangeRateService.js
 - 10_ConfigService.js
 - Fetch de tipos de cambio desde API
 - Cálculo de monto_base

3. **Documentación**
 - Crear GUIA_MODULOS.md (guía de cada módulo)
 - Actualizar README con instrucciones de deploy

---

**Responsable de este documento**: @context-historian

_Última actualización: 2026-08-19_


---

# 2026-08-19 — Campaña Tablero v4 (sesión larga, en curso)

> Registro pedido explícitamente por Franco al cierre de la jornada. Se deja acá porque es la
> bitácora cronológica del repo; el detalle técnico de cada release está en CHANGELOG.md y el
> estado funcional hoja por hoja en FUNCIONALIDADES.md.

## Qué se desplegó (todo con drift-check, drift cero)

| Versión | Qué |
|---|---|
| v0.12.0 | Formulerío: anclas fila 9→6, selector de moneda `#REF!`→`$N$4`, bloque Disponibilidad rotado, `'Liquidez'`→`'Hogar'` |
| v0.12.1 | Reparar la reparación: bug de escape de `$` que rompió O23:O25, y el verificador que solo miraba texto |
| v0.13.0 | Riqueza por lista blanca (Ahorros+Inversiones) + columna Tipo en el bloque de categorías |
| v0.14.0 | Stock vs flujo: saldos independientes del mes, arrastres apagados, fila Flujo Cotidiano |
| v0.14.1 | Dos defectos de escritura: comillas de más en `'Registros'!` y variable `LET` llamada `n` |
| v0.15.0 | El saldo exige medio válido, capitalización como residuo, alta de 12 cuentas |

## Los tres errores propios de la jornada, y qué se aprendió de cada uno

1. **Escape de `$` en un string de reemplazo** (v0.12.0). `'$1$N$17'` produce `$N$N$10 - 7`, no
   `$N$17`. Escribió tres fórmulas que no parsean en producción. **Todos los reemplazos pasan a
   ir por función de reemplazo.**
2. **Un verificador que comparaba texto, no resultado.** El texto corrupto pasaba sus cuatro
   pruebas. **Ahora se lee el VALOR de cada celda escrita y se revierte el lote si queda en
   error.** Es la cicatriz 5 del arnés cometida por el módulo que la cita.
3. **No correr las transformaciones contra datos reales antes de desplegar.** Nacieron
   `devtools/probar_formulerio.js` y `devtools/probar_stock_flujo.js`, que corren las funciones
   REALES contra las fórmulas REALES del gemelo. Se verificó que los guards **disparan**,
   reproduciendo los bugs históricos contra ellos: un guard que no salta es peor que no tenerlo.

## El hallazgo grande: el arrastre `Inicio Mes` es un punto de corte, no un movimiento

Diagnóstico equivocado en v0.14/v0.15: se apagaron los `Inicio Mes` por completo, asumiendo que
eran redundantes. **No lo son.** Cuando Franco carga un `Inicio Mes` está diciendo "el banco dice
que tengo esto": es una CONCILIACIÓN que salda todo lo anterior.

| Regla de saldo | Medios en negativo |
|---|---|
| Sumar todo, incluidos arrastres | 1 (pero duplica: $8,7M) |
| Ignorar arrastres (v0.14/v0.15) | **9** |
| **Último arrastre del medio + todo lo posterior** | **0** |

## Validación contra verdad de campo (2026-08-19)

Franco pasó siete saldos reales. **Cinco coinciden AL CENTAVO** con la regla del último arrastre:
Frascos Nx - Préstamo $230.000,00 · Frasco transitorio Nx $44.141,01 · YPF - wallet $3.494,90 ·
Dolar Cash US$110,00 · Dolar Galicia US$91,10.

Los dos que no coinciden son **exactamente los que usa todos los días**: Efectivo (delta $102.000)
y NaranjaX (delta $29.635,41). Causa medida: **el ledger termina el 2026-08-12 y hoy es 08-19**.
Faltan siete días de carga. No es un error de cálculo — los cinco que dan exacto son los que no
tuvieron movimiento reciente.

## Hallazgos de datos, medidos y sin resolver

- **`YPF - wallet` son 5 filas y las cinco son `Inicio Mes`** (abril a agosto, siempre $3.494,90).
  Es el arrastre de `YPF` escrito con otro nombre: se cuentan como dos medios y **duplican
  $3.494,90**. `YPF` es el que está en el Plan de Cuentas y el que tiene la historia real.
- **`Galicia Fina - Fran`**: una sola fila, −$259.994,57, no está en el Plan. Typo de
  `Galicia Fima - Fran`.
- **`Fracsos Nx - Dima`**: 2 filas, $0,50. Trivial.
- **39 filas sin medio válido, $2.147.186.** Con el saldo exigiendo medio, quedan fuera y se
  cuentan aparte en `Tablero!L29`.
- **Traspasos: sanos.** 291 pares perfectos entre medios distintos, 1 solo con ambas patas en el
  mismo medio, 45 filas sin par.
- **12 cuentas del ledger no estaban en el Plan** (111 movimientos), la mayor `Ajuste` con 70
  filas y $1.949.641. Alta preparada en `DEVTOOL_AltaCuentas.js`.

## La planilla predecesora (auditada por Chrome)

**El ID que se venía usando era el del Apps Script, no el de la planilla.** La v03.1 real es
`1RkyL_lD97EeeoibyZs40ME-ZylFnwhi38Dm493DP-08` ("PLANILLA FINANZAS_v03.1 | Fran").

Su TABLERO organiza los saldos en **tres bloques — FLUJO DE CAJA, AHORROS, DÓLARES —**, cada medio
con un **checkbox**, y lista solo ~10 medios en Flujo de Caja, no los 28 del catálogo. Tiene un
`Flujo mes anterior` y un `COMPROBACIÓN MOVIMIENTOS: Traspaso $0,00`. **Es una vista MENSUAL con
arrastre, no un saldo acumulado** — de ahí que sus $51.509,27 y US$241,42 sean valores de enero
2026, que es exactamente lo que el Tablero v4 venía reproduciendo.

## Estado al cierre y qué sigue

**El código desplegado (v0.15.0) todavía tiene el modelo de saldo equivocado** (ignora los
arrastres, produce negativos). La corrección está diseñada y validada contra los cinco saldos
reales, pero **no escrita en código todavía**. Es lo primero de la próxima sesión.

Pendiente además:
1. Unificar `YPF - wallet` → `YPF` en el ledger (quita el doble conteo de $3.494,90).
2. Bloque de saldos con la regla validada: solo medios con saldo distinto de cero, agrupados como
   en la v03.1.
3. Confirmar con Franco si CRYPTO ($50.607,27) y FCI ($25.937,88) tienen saldo real.
4. BD Proyección (espejo de Registros) para el bloque Presupuesto Asignado.
5. Función de developer que repare cotizaciones históricas por fecha (decisión Franco: el TC vive
   en el registro, no hace falta un data lake permanente).
6. Quinto defecto: `Inicio!C15`/`F15` siempre en "0%" por condiciones de `LET` sin `ARRAYFORMULA`.

## Nota fuera de este repo

Franco dejó pedido para mañana, en otro contexto (`wdwmbdb1qw`): **correcciones de search** y
**análisis en profundidad de PMAX**. Es trabajo de Google Ads, no de esta planilla; se anota acá
sólo para que no se pierda hasta que se registre en el proyecto que corresponda.

## 2026-08-20 - La suma por tipo de medio, y el dia que el gemelo mintio

Franco pidio la sumatoria por tipo de medios en el Tablero. Lo que empezo como llenar una columna
termino siendo la leccion mas cara de la campana.

**Lo entregado.** El bloque "Tipo de Medios." (`AE7:AH12`) ya existia con los cuatro tipos escritos
a mano y la columna Monto vacia. Ahora se llena, convertido a la moneda del selector:

| Tipo | Monto |
|---|---|
| Ahorros | $210.791,01 |
| Financiacion | $230.000,00 |
| Hogar | $45.428,69 |
| Inversiones | $138.016,50 |
| **Total** | **$624.236,20** |

Cuadra al centavo contra los saldos que Franco declaro: $319.569,70 en ARS mas US$201,10 al cambio.

**Lo que salio mal, que es lo que importa.** La primera version se escribio contra
`docs/permanente/celdas.tsv` -- el gemelo digital -- que tenia el layout viejo. En el gemelo `AE7`
era "Saldos Actuales" con las monedas en las filas 9-12. En la planilla real ese bloque esta en la
fila 16, las filas 9-12 son otro bloque, y `AF9:AF12` son la mitad muda de celdas combinadas
`AE:AF`. Se escribio ahi y no entro nada.

> Un snapshot desactualizado es peor que no tener snapshot: da confianza falsa y miente en silencio.

**Lo que quedo de defensa,** cada cosa por algo que efectivamente paso:

1. **Un canario que diagnostica.** "Quedo SIN formula" tiene dos causas -- la celda no acepta
   escritura, o la formula no parsea -- y son indistinguibles desde afuera. Ahora el verificador
   escribe `=1+1` en la misma celda: si entra, el problema es la formula; si no, es la celda.
2. **Verificacion por rotulos, no por coordenada.** Los dos bloques se comprueban por su titulo y
   sus encabezados antes de escribir. Una posicion se pudre sin avisar; un rotulo no.
3. **Ancla de combinada.** Se comprueba que la celda destino no sea la mitad muda de un merge.
4. **Sin coordenadas de cotizacion.** La conversion pasa a `TIDETRACK_USD/AUD/EUR()`. El bloque de
   Cotizaciones se habia mudado de la fila 17 a la 27, y una referencia que se corre **no da error:
   da otro numero**.
5. **El formato es parte del plan.** Un intento previo dejo esas celdas en formato porcentaje y
   $230.000 se leia "23000000,0%" -- el valor bien, la pantalla mintiendo. Revertir formulas no
   revierte formatos, asi que ahora el formato se propone, se verifica y se revierte igual que una
   formula.

**Ademas, en la misma sesion.** "Deudas" paso a la categoria "Deuda y financiacion" (la categoria
cruza bloques a proposito: la cuota fija en Gastos Fijos, la deuda elastica en Variables). Y
"Limpiar Plan de Cuentas" dejo de deducir la posicion de la consolidada de una marca en
DocumentProperties -- que faltaba, porque el borrado que la corrio ocurrio antes de que la marca
existiera -- y pasa a **medirla** en la hoja, con el borrado de columna decidido por geometria.

**Pendiente.** Refrescar `celdas.tsv` desde el export nuevo que quedo en Drive
(`TIDETRACK_ARQUITECTURA_ESTRICTA.json`, 40 hojas, 154.736 celdas). Mientras tanto, la fuente de
verdad de la geometria es la planilla, medida en vivo.

Versiones: v0.23.0 a v0.23.5.
