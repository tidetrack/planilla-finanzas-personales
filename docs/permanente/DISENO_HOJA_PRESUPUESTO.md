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

| Col | Contenido |
|---|---|
| `I`, `M`, `Q`, `U` | espejo VIVO del Plan de Cuentas (ingresos, fijos, variables, categorias). Tienen que aparecer TODAS las cuentas |
| `J`, `N`, `R` | el monto que cambia con el modo (referencia o ponderado) |
| `K`, `O`, `S` | **lo que Franco escribe a mano**: el monto a proyectar |
| `V` | el agrupado por categoria |

## La columna V

decision Franco 2026-08-24: agrupa **TODO, ingresos incluidos** -- no solo fijos y variables.

No tiene logica de formulerio detras: es agrupar los montos en sus categorias, nada mas. En el
modo proyectado suma desde la columna **"Monto a Proyectar"** (`K`/`O`/`S`), no desde la columna
que muestra el modo.

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

## Historia previa, para no tropezar

`src/DEVTOOL_Presupuesto.js` y `src/DEVTOOL_CableadoPresupuesto.js` construian una version
anterior de esta hoja y estan marcados **"NO LISTO -- FUERA DE SERVICIO DESDE EL 2026-08-13. NO
EJECUTAR"**. La geometria que documentan describe un diseno que Franco ya reemplazo a mano: valen
como referencia historica, no como fuente de verdad. La verdad es la planilla viva.
