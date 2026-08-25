# Hoja Presupuesto - diseno acordado

> Decisiones de Franco del 2026-08-24. Este documento es el contrato de la hoja; se escribe
> ANTES de construirla para que la implementacion no tenga que adivinar.

## Para que existe la hoja

No es un reporte: es una **herramienta de decision**. Todo lo que muestra esta al servicio de que
Franco complete a mano tres columnas -- `K` (ingresos), `O` (fijos), `S` (variables) -- con
criterio en vez de a ojo. Despues guarda esa proyeccion en la BD y el Tablero puede medir contra
ella. Eso es lo que hoy le falta al "Faltante proyectado" del Tablero para tener contra que
comparar.

## El selector de MODO (C7:F7)

Dos valores, y NO son dos formas de promediar lo mismo: son dos preguntas distintas.

| Modo | Que muestra en J / N / R | Para que sirve |
|---|---|---|
| **Proyeccion** | los movimientos del **mes de referencia** | lo que se repite igual: alquiler, prepaga, cuota |
| **Historico** | promedio **exponencialmente ponderado** | lo que varia: comidas, salidas, nafta |

decision Franco 2026-08-24: el ponderado es **exponencial**, no lineal. Un lineal sobre seis
meses le da al ultimo mes el doble que al primero; el exponencial le da mucho mas y olvida rapido
lo viejo, que es lo que responde bien a un cambio de habito. Textual: "para entender la evolucion
desde la realidad financiera y no como un simple promedio pedorro".

El titulo de esas columnas CAMBIA con el modo: "Monto Historico" o "Monto Proyectado".

## El mes de referencia

decision Franco 2026-08-24: es el **mes calendario anterior** al periodo que se presupuesta,
tomado del selector `J2`. Si se presupuesta septiembre, la referencia es agosto -- no el corte de
"Inicio Mes", que en esta planilla no siempre coincide con el mes calendario.

Toma **todos los movimientos** de ese mes de referencia.

El cuadro "Movimientos Promedio Historicos" (`C9:F14`) **tiene que decir cual es el mes de
referencia**, no darlo por sobreentendido.

## Que hay en cada columna

El patron es **uniforme en los cuatro bloques**, y es de TRES columnas. Medido en la planilla
viva el 2026-08-24, con el modo en "Historico":

| Bloque | nombre | sigue al MODO | fijo |
|---|---|---|---|
| Ingresos | `I` | `J` -- rotulo `J7` | `K` -- rotulo `K7` "Monto a Proyectar" |
| Gastos Fijos | `M` | `N` -- rotulo `N7` | `O` -- rotulo `O7` |
| Gastos Variables | `Q` | `R` -- rotulo `R7` | `S` -- rotulo `S7` |
| Categorias | `U` | `V` -- rotulo `V7` | `W` -- rotulo `W7` |

- `I`/`M`/`Q`/`U`: espejo VIVO del Plan de Cuentas. Tienen que aparecer TODAS las cuentas.
- `J`/`N`/`R`: el monto que cambia con el modo (mes de referencia o ponderado).
- `K`/`O`/`S`: **lo que Franco escribe a mano**, el monto a proyectar. Ningun modulo las escribe.
- `V`/`W`: **son DOS agrupados por categoria, no uno.** `V` agrupa la columna del modo
  (`J`/`N`/`R`) y `W` agrupa la de "Monto a Proyectar" (`K`/`O`/`S`). Cada tabla resumen apunta a
  su propio total: la Tabla 1 a `V8`, la Tabla 2 a `W8`.

**Los rotulos `J7`/`N7`/`R7`/`V7` son DINAMICOS** (los escribe el modulo del modo). Un snapshot
del gemelo los captura con el texto del modo que estaba puesto en ese momento y los hace pasar
por constantes: es la trampa que freno el deploy de v0.46.0. Todo preflight que los verifique
tiene que aceptar cualquiera de los dos valores, o derivarlos de la constante del modulo que los
escribe -- nunca repetir el string.

## La columna V

decision Franco 2026-08-24: agrupa **TODO, ingresos incluidos** -- no solo fijos y variables.

No tiene logica de formulerio detras: es agrupar los montos en sus categorias, nada mas. En el
modo proyectado suma desde la columna **"Monto a Proyectar"** (`K`/`O`/`S`), no desde la columna
que muestra el modo.

La convencion de signos se confirmo contra la formula viva de `Tablero!AA10`
(`monto_neto = IF(tipo="Egreso"; -monto; monto)`): ingreso suma, egreso resta. Como la hoja
Presupuesto no tiene un campo "Tipo" por movimiento, el BLOQUE DE ORIGEN reemplaza esa senal:
Ingresos suma, Gastos Fijos y Variables restan.

De ahi sale el par de invariantes: **`V8 = J8 - N8 - R8`** y **`W8 = K8 - O8 - S8`**. Si agrupar
por categoria y restar directo no dan lo mismo, algo esta mal. Y explica por que la Tabla 1
rotula a `V8` como "Capacidad de Capitalizacion": el total del agrupado ES ingresos menos
egresos.

Consecuencia a respetar: como agrupa ingresos y egresos juntos, cada categoria queda positiva o
negativa segun su naturaleza. Es la misma convencion que ya usa el bloque "Categorias." del
Tablero (Negocios propios positivo, Otros negativo), asi que las dos hojas tienen que leerse
igual.

## El cuadro C9:F14

Sigue al modo:
- **Historico** -> totales de los montos historicos
- **Proyeccion** -> totales proyectados del mes de referencia

## El cierre del circuito

"Guardar Proyeccion" escribe el periodo presupuestado en la BD (`Proyeccion`), para poder medirlo
y seguirlo desde el Tablero.

## Lo que ya existe, medido el 2026-08-24

La hoja es hoy un **cascaron**: la estructura esta, el contenido no.

| Existe y funciona | Existe y NO esta cableado | No existe |
|---|---|---|
| espejo vivo del Plan de Cuentas en `I`/`M`/`Q`/`U`, 1:1 por formula | el selector de Modo (`E7`): CERO formulas de la hoja lo referencian | todo el contenido de `J`,`K`,`N`,`O`,`R`,`S`,`V`,`W` (filas 9-38): vacias |
| dos tablas resumen (`C9:F14` y `C16:F21`) con formulas | el selector de periodo (`J2`/`J3`/`J4`): tampoco lo lee ninguna formula | el guardado a la BD |

Los totales de la fila 8 son `SUM` de rangos vacios, por eso dan $0,00.

**Conclusion**: no hay que "hacer que el filtro cambie las columnas". Hay que construir las
columnas Y el filtro. El unico cimiento reutilizable es el espejo del Plan de Cuentas.

## Dos correcciones de Franco (2026-08-24)

1. **`F19:F21` (los porcentajes de la Tabla 2) dividian por `$E$11`**, que es el Ingresos de la
   Tabla 1. Franco confirmo que **es un error de copiar-pegar**: tienen que dividir por `$E$18`,
   el Ingresos de su propia tabla.
2. **La asimetria de filas ya no existe**: Franco emparejo los cuatro bloques, todos espejan
   ahora 30 filas.

## Un hueco conocido que hay que tener presente

La hoja `Proyeccion` (la BD) **no tiene cotizaciones congeladas**: 4 celdas con contenido en las
columnas de TC contra 13.916 en `Registros`. Es un volcado batch del 2026-08-20, no un flujo
vivo. Consecuencia: una proyeccion cargada en USD/AUD/EUR no se puede convertir con la cotizacion
del dia en que se proyecto, solo con la del dia en que se mira -- lo que distorsiona cualquier
seguimiento a varios meses. Franco ya lo habia marcado. **No se resuelve en este trabajo, pero
quien construya el guardado tiene que saber que existe.**

## Historia previa, para no tropezar

`src/DEVTOOL_Presupuesto.js` y `src/DEVTOOL_CableadoPresupuesto.js` construian una version
anterior de esta hoja y estan marcados **"NO LISTO -- FUERA DE SERVICIO DESDE EL 2026-08-13. NO
EJECUTAR"**. La geometria que documentan describe un diseno que Franco ya reemplazo a mano: valen
como referencia historica, no como fuente de verdad. La verdad es la planilla viva.
