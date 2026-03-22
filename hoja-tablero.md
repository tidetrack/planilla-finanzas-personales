¡Entendido al 100%! Tenés toda la razón: una documentación técnica real (especialmente para que la tome un equipo como Antigravity o cualquier desarrollador) no solo debe explicar "qué" pasa, sino que debe entregar el código exacto, las coordenadas espaciales y el mapeo de las bases de datos subyacentes.

A continuación, te presento el **Manual de Arquitectura y Código Fuente** de la hoja "Tablero". Está redactado con la profundidad técnica necesaria para que cualquier especialista entienda el modelo relacional de tu base de datos y cómo los algoritmos consumen esa información.

---

# 📖 Documentación Técnica y Código Fuente: Hoja "Tablero" - Tidetrack
**Objetivo:** Proveer a Antigravity (y futuros mantenedores) el mapa de dependencias, rangos de datos, y el código exacto de los motores lógicos utilizados para el renderizado del dashboard financiero.

## 1. Topología de Bases de Datos (Back-End)
El "Tablero" es estrictamente una capa de visualización (Front-End). Todas las fórmulas hacen referencia a las siguientes bases de datos o rangos estructurados:

| Nombre de la BD / Rango | Ubicación | Función en el Sistema |
| :--- | :--- | :--- |
| **BD Transaccional** | Hoja actual (`AN4:AZ`) | Almacena los registros crudos. Columnas clave: `AN` (Monto), `AO` (Tipo: Ingreso/Egreso), `AP` (Categoría de Cuenta, ej: "Inicio Mes"), `AQ` (Categoría de Gasto), `AR` (Medio Bancario), `AS` (Moneda). |
| **BD Plan de Cuentas (Proyectos)** | `'Plan de Cuentas'!R:T` | Diccionario relacional Nivel 1. Vincula el "Medio Bancario" (Col R) con un "Proyecto" específico (Col T, columna 3). |
| **BD Plan de Cuentas (Tipos)** | `'Plan de Cuentas'!V:W` | Diccionario relacional Nivel 2. Vincula el "Proyecto" (Col V) con un "Tipo de Proyecto" maestro (Col W, columna 2). Ej: Liquidez, Ahorro, Inversiones. |
| **Tabla de Cotizaciones** | Hoja actual (`AL4:AL6`) | Almacena el valor de conversión estático o dinámico para USD (`AL4`), AUD (`AL5`) y EUR (`AL6`). |

---

## 2. Diccionario de Fórmulas y Lógica de Negocio

A continuación se detalla cada módulo complejo, su rango de ejecución, las bases de datos que consume y el código fuente exacto.

### A. Módulo: Riqueza Acumulada (Patrimonio Histórico)
Este motor calcula todo el dinero que pertenece a proyectos destinados a la acumulación de patrimonio, excluyendo el dinero de uso diario. Incluye los saldos de "Inicio Mes".

* **Rango de Renderizado:** `U4:U7` (ARS, USD, AUD, EUR).
* **Dependencias:** BD Transaccional (`AN, AO, AR, AS`), BD Plan de Cuentas Nivel 1 y 2.
* **Fórmula (Ejemplo para ARS en U4):**
```excel
=LET(
  monto_neto; ARRAYFORMULA(SI(AO4:AO="Egreso"; -AN4:AN; AN4:AN));
  proyectos; ARRAYFORMULA(SI.ERROR(BUSCARV(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""));
  tipos_proy; ARRAYFORMULA(SI.ERROR(BUSCARV(proyectos; 'Plan de Cuentas'!V:W; 2; 0); ""));
  cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);
  
  SUMA(SI.ERROR(FILTER(monto_neto; AS4:AS="ARS"; cond_riqueza); 0))
)
```
* **Explicación para Antigravity:** Se utiliza `LET` para optimizar rendimiento. Se genera una matriz de montos neteados (`monto_neto`). Luego se ejecuta un doble `BUSCARV` anidado virtualmente: el Medio (`AR`) busca su Proyecto, y el Proyecto busca su Tipo. `cond_riqueza` aplica álgebra booleana para crear un array de VERDADERO/FALSO exigiendo que el Tipo no sea nulo ni sea "Liquidez". Finalmente, `FILTER` extrae y suma los montos de la moneda solicitada.

### B. Módulo: Ahorro Real del Mes
Mide el esfuerzo financiero del período en curso. Es idéntico al cálculo de Riqueza, pero **excluye** los registros etiquetados como arrastre de saldo ("Inicio Mes").

* **Rango de Renderizado:** `U17`
* **Dependencias:** BD Transaccional (`AN, AO, AP, AR, AS`), BD Plan de Cuentas, Cotizaciones (`AL4:AL6`), Selector de Moneda Global (`I9`).
* **Fórmula Exacta:**
```excel
=LET(
  monto_neto; ARRAYFORMULA(SI(AO4:AO="Egreso"; -AN4:AN; AN4:AN));
  cond_inicio; ARRAYFORMULA(AP4:AP<>"Inicio Mes");
  
  proyectos; ARRAYFORMULA(SI.ERROR(BUSCARV(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""));
  tipos_proy; ARRAYFORMULA(SI.ERROR(BUSCARV(proyectos; 'Plan de Cuentas'!V:W; 2; 0); ""));
  
  cond_ahorro; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);
  
  suma_ars; SUMA(SI.ERROR(FILTER(monto_neto; AS4:AS="ARS"; cond_inicio; cond_ahorro); 0));
  suma_usd; SUMA(SI.ERROR(FILTER(monto_neto; AS4:AS="USD"; cond_inicio; cond_ahorro); 0));
  suma_aud; SUMA(SI.ERROR(FILTER(monto_neto; AS4:AS="AUD"; cond_inicio; cond_ahorro); 0));
  suma_eur; SUMA(SI.ERROR(FILTER(monto_neto; AS4:AS="EUR"; cond_inicio; cond_ahorro); 0));
  
  total_ars; suma_ars + (suma_usd * $AL$4) + (suma_aud * $AL$5) + (suma_eur * $AL$6);
  tasa_cambio; SI.ERROR(SWITCH($I$9; "ARS"; 1; "USD"; $AL$4; "AUD"; $AL$5; "EUR"; $AL$6); 1);
  
  total_ars / tasa_cambio
)
```
* **Explicación para Antigravity:** Calcula las sumas netas mensuales aisladas por divisa y las almacena en memoria (`suma_ars`, `suma_usd`, etc.). Luego las unifica en una moneda base (ARS) multiplicando por las cotizaciones (`$AL$4:$AL$6`). Por último, el `SWITCH` lee el controlador global (`I9`) para dividir el gran total y renderizarlo en la moneda que el usuario desea ver en su pantalla.

### C. Módulo: Disponibilidad de Fondos (Algoritmo Predictivo)
Rebalancea la liquidez actual (dinero en mano) en base a los remanentes presupuestarios (lo que falta gastar o ahorrar).

* **Rango de Renderizado:** `T20:T22` (Capacidad Ahorro, Gastos Fijos, Gastos Variables).
* **Dependencias:** Saldos de Liquidez (`S4:S7`), Presupuestos Objetivo (`S13:S15`), Ejecución Real (`U13:U15`), Cotizaciones (`AL4:AL6`).
* **Fórmula (Ejemplo para Gastos Variables en T22):**
```excel
=LET(
  liquidez_ars; S4 + (S5 * $AL$4) + (S6 * $AL$5) + (S7 * $AL$6);
  tasa_cambio; SI.ERROR(SWITCH($I$9; "ARS"; 1; "USD"; $AL$4; "AUD"; $AL$5; "EUR"; $AL$6); 1);
  liquidez_moneda; liquidez_ars / tasa_cambio;
  
  rem_ahorro; MAX(0; ($S$13-$S$14-$S$15) - ($U$13-$U$14-$U$15));
  rem_fijos; MAX(0; $S$14 - $U$14);
  rem_var; MAX(0; $S$15 - $U$15);
  suma_rem; rem_ahorro + rem_fijos + rem_var;
  
  SI(suma_rem > 0; liquidez_moneda * (rem_var / suma_rem); 0)
)
```
* **Explicación para Antigravity:** Calcula las "brechas" de presupuesto usando `MAX(0; Presupuestado - Real)`. Si un gasto ya sobrepasó el 100% de su presupuesto, su remanente es forzado a 0. Luego, prorratea la `liquidez_moneda` disponible multiplicándola por el peso relativo de la brecha específica (`rem_var / suma_rem`). Corta el flujo de fondos a categorías sobregiradas y prioriza compromisos impagos.

### D. Módulo: Consultas de Flujo (Ingresos y Egresos con Blindaje)
Lista los movimientos del mes, neteados y agrupados, pero evita que el dinero de "Inicio Mes" de cuentas de ahorro/inversión infle los números de ingresos mensuales.

* **Rango de Renderizado:** Primeras celdas bajo los títulos "Ingresos", "Gastos Fijos" y "Gastos Variables".
* **Dependencias:** BD Transaccional, BD Plan de Cuentas (Nivel 1 y 2).
* **Fórmula (Ejemplo para Ingresos):**
```excel
=SI.ERROR(QUERY(
  ARRAYFORMULA({
    AP4:AP \ 
    SI(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \ 
    AQ4:AQ \ 
    SI.ERROR(BUSCARV(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \
    SI.ERROR(BUSCARV(SI.ERROR(BUSCARV(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")
  });
  "SELECT Col1, SUM(Col2) 
   WHERE Col3 = 'Ingreso' 
   AND Col1 != 'Traspaso' 
   AND Col1 IS NOT NULL 
   AND (Col1 != 'Inicio Mes' OR Col5 = 'Liquidez') 
   GROUP BY Col1 
   ORDER BY SUM(Col2) DESC 
   LABEL Col1 '', SUM(Col2) ''";
  0
); {"" \ ""})
```
* **Explicación para Antigravity:** Se construye una matriz de 5 columnas en caliente `{AP \ Monto Neto \ AQ \ Proyecto \ Tipo Proyecto}`. La consulta SQL contiene la cláusula crítica de protección: `AND (Col1 != 'Inicio Mes' OR Col5 = 'Liquidez')`. Esto permite que el saldo inicial transaccional se contabilice *sólo* si proviene de una cuenta transaccional/líquida, impidiendo la inyección de capital histórico en el cuadro de resultados mensual. *(Nota: para Egresos, la lógica `SI` de la Col2 se invierte para volver los egresos positivos).*

### E. Módulo: Portafolio de Proyectos (Sandwich Array)
Agrupa todo el capital destinado a Riqueza, lo convierte a la moneda global seleccionada, y lo maqueta visualmente saltándose una columna para respetar el diseño de la UI.

* **Rango de Renderizado:** `AJ10:AL22` (Renderiza en AJ y AL, deja AK intacta).
* **Dependencias:** BD Transaccional, BD Plan de Cuentas, Cotizaciones, Selector de Moneda `I9`.
* **Fórmula Exacta en AJ10:**
```excel
=LET(
  medio; AR4:AR;
  moneda; AS4:AS;
  
  monto_neto; ARRAYFORMULA(SI(AN4:AN=""; 0; SI(AO4:AO="Egreso"; -AN4:AN; AN4:AN)));
  
  proyecto; ARRAYFORMULA(SI.ERROR(BUSCARV(medio; 'Plan de Cuentas'!R:T; 3; 0); ""));
  tipo_proy; ARRAYFORMULA(SI.ERROR(BUSCARV(proyecto; 'Plan de Cuentas'!V:W; 2; 0); ""));
  
  tasa_origen; ARRAYFORMULA(SI(moneda="USD"; $AL$4; SI(moneda="AUD"; $AL$5; SI(moneda="EUR"; $AL$6; 1))));
  tasa_destino; SI.ERROR(SWITCH($I$9; "ARS"; 1; "USD"; $AL$4; "AUD"; $AL$5; "EUR"; $AL$6); 1);
  
  monto_convertido; ARRAYFORMULA(SI.ERROR((monto_neto * tasa_origen) / tasa_destino; 0));
  
  condicion; ARRAYFORMULA((proyecto<>"") * (tipo_proy<>"Liquidez") > 0);
  
  proy_filtrado; FILTER(proyecto; condicion);
  monto_filtrado; FILTER(monto_convertido; condicion);
  
  resultado_query; SI.ERROR(QUERY(
    {proy_filtrado \ monto_filtrado};
    "SELECT Col1, SUM(Col2) 
     GROUP BY Col1 
     ORDER BY SUM(Col2) DESC 
     LABEL Col1 '', SUM(Col2) ''";
    0
  ); {"" \ ""});
  
  columna_aj; INDICE(resultado_query; 0; 1);
  columna_al; INDICE(resultado_query; 0; 2);
  columna_ak_vacia; ARRAYFORMULA(SI(columna_aj<>""; ""; ""));
  
  {columna_aj \ columna_ak_vacia \ columna_al}
)
```
* **Explicación para Antigravity:** 1. Resuelve la multi-divisa calculando el tipo de cambio de origen (moneda del registro) y el de destino (moneda de la UI en `I9`) cruzados.
    2. Usa `FILTER` pre-QUERY para asegurar que solo la data limpia y que NO es "Liquidez" llegue a la consulta SQL, evitando errores matemáticos por celdas vacías.
    3. Almacena el resultado del `QUERY` en memoria (`resultado_query`).
    4. Usa `INDICE` para "romper" la tabla resultante en dos vectores independientes (`columna_aj` y `columna_al`). Genera un vector vacío (`columna_ak_vacia`) y reensambla todo con formato matricial `{A \ B \ C}`, logrando imprimir los datos en `AJ` y `AL` sin sobreescribir la columna `AK`.

---

Este documento contiene la lógica exacta que sostiene el motor financiero del Tablero. Con este mapa de referencias y código, el equipo de Antigravity tiene todo lo necesario para escalar el sistema, migrarlo a una base de datos real (SQL/NoSQL) si fuera necesario en el futuro, o realizar mantenimiento preventivo sin riesgo de romper las dependencias.

¡Qué desafío espectacular! Armar un documento de justificación arquitectónica, funcional y psicológica de una interfaz es el paso definitivo para consagrar un producto de software. 

Antes de arrancar, te hablo con total franqueza técnica: por limitaciones de arquitectura de mi modelo (el límite de "tokens" de salida por respuesta), es físicamente imposible generar 8.000 palabras de corrido en un solo mensaje (8.000 palabras equivalen a unas 30 páginas de un libro). Sin embargo, voy a llevar mi motor de generación al límite absoluto para entregarte un **Manifiesto de Arquitectura Financiera y UX/UI** exhaustivo, profundo y detallado. Si al terminar sentís que necesitamos expandir un módulo a nivel de tesis, me lo pedís y generamos un anexo.

Vamos a desglosar tu "Tablero" no solo desde el código, sino desde la **economía conductual, la psicología del usuario y el diseño de interfaces (UI/UX)**. 

Aquí tenés el "Whitepaper" fundacional de Tidetrack.

---

# 📘 Manifiesto de Arquitectura Financiera: Tidetrack
## Diseño, Psicología y Lógica del Tablero Principal

### Introducción: La Filosofía del Tablero
El Tablero de Tidetrack no es una simple hoja de cálculo; es un panel de control gerencial diseñado para mitigar la ansiedad financiera y maximizar la toma de decisiones racionales. En finanzas personales, el mayor problema no es la falta de datos, sino la **sobrecarga cognitiva**. Cuando un usuario ve una sábana de transacciones crudas, su cerebro se paraliza. 

Por lo tanto, la premisa de diseño de este espacio es la **Jerarquía Visual de la Información**. Se lee de izquierda a derecha y de arriba hacia abajo, imitando el escaneo natural del ojo humano (patrón en "F" y "Z"), yendo de lo macro (contexto global) a lo micro (transacciones específicas).

---

### Módulo 1: El Ecosistema de Navegación y Contexto (Panel Izquierdo)

#### 1.1. Sidebar Oscuro (Navegación y Acciones Rápidas)
* **Por qué se armó:** El contraste cromático no es caprichoso. El panel izquierdo en azul/gris muy oscuro actúa como un "ancla visual". Separa las funciones de *control del sistema* (navegación, carga de datos) de la zona de *visualización de datos* (fondo claro).
* **Para qué sirve:** Alberga los botones de navegación entre módulos (Inicio, Tablero, Cargas) y, fundamentalmente, las "Acciones rápidas" (Nueva transacción). Ubicar el botón de carga transaccional aquí responde a la **Ley de Fitts** en diseño UI: las acciones más frecuentes deben estar en los bordes y ser fácilmente accesibles para reducir el tiempo de fricción al ingresar un gasto.

#### 1.2. Selectores de "Periodo de Análisis" y "Moneda" (I9)
* **Por qué se armó:** Las finanzas son relativas al tiempo y al valor de refugio. Mostrar datos sin acotarlos temporalmente genera distorsión histórica. Además, en economías bimonetarias o para usuarios globalizados, forzar la vista en una sola moneda genera ceguera patrimonial.
* **Para qué sirve:** Es el "Controlador Maestro" del Back-End. Altera en tiempo real el comportamiento de todos los motores de la derecha. El selector de moneda en I9 no solo cambia un símbolo (`$`, `U$D`), sino que acciona el algoritmo de conversión multidivisa, homogeneizando peras y manzanas para que el usuario pueda medir su poder adquisitivo real en la moneda en la que piensa su futuro.

#### 1.3. Calendario y Comprobación de Traspasos
* **Por qué se armó:** El calendario provee anclaje temporal inconsciente. Te dice "dónde estás parado" en el mes respecto a lo que falta vivir. El módulo de comprobación (en verde) es una alarma de integridad de datos.
* **Para qué sirve:** Los traspasos entre cuentas (sacar de cuenta sueldo para meter en broker) son el punto de falla número uno en planillas financieras (generan plata fantasma si no se equilibran). Este espacio actúa como un auditor silencioso que le da tranquilidad al usuario de que su base de datos no está corrompida.

---

### Módulo 2: La Foto Patrimonial (Saldos Actuales)

#### 2.1. Separación de Liquidez vs. Riqueza
* **Por qué se armó:** Aquí aplicamos directamente la teoría de la **Contabilidad Mental (Mental Accounting)** del Premio Nobel Richard Thaler. Las personas tratan el dinero de manera diferente dependiendo de dónde esté guardado y qué etiqueta mental le pongan. Si a un usuario le mostrás un "Patrimonio Total" de $1.000.000, su cerebro reptiliano piensa que tiene $1.000.000 para salir a cenar o gastar, aunque $800.000 sean su fondo de retiro. Esto induce a la inflación del estilo de vida y al sobreendeudamiento.
* **Para qué sirve:** * **Liquidez:** Es el "Combustible de vuelo". Le dice al usuario: *Esta es la plata que podés prender fuego hoy sin alterar tu futuro.*
    * **Riqueza:** Es la "Caja Fuerte". Le dice al usuario: *Este es tu patrimonio blindado. No se toca.* Al ver crecer este número, se activa el sistema de recompensa del cerebro (dopamina), incentivando el hábito del ahorro continuado. Mapearlo en varias monedas estabiliza la percepción de valor frente a la inflación local.

---

### Módulo 3: El Espejo Teórico (Control de Presupuesto)

#### 3.1. Ingresos, Fijos, Variables y Capacidad de Ahorro (Presupuesto vs. Real)
* **Por qué se armó:** Es el clásico P&L (Profit and Loss) personal. El presupuesto es una hipótesis de intenciones al inicio del mes, pero choca violentamente con la realidad el día 15. Ponerlos lado a lado (Presupuesto vs. Real) genera un contraste cognitivo inmediato.
* **Para qué sirve:** Permite auditar el nivel de realismo del usuario. Si sistemáticamente el presupuesto dice una cosa y la realidad otra, este módulo evidencia la necesidad de ajustar las metas. La "Capacidad de Ahorro" en esta sección es un indicador estático: te dice cuánto *debería* sobrarte si tus ingresos y egresos teóricos se cumplieran.

---

### 🚨 Módulo 4: El Motor de Rebalanceo (Disponibilidad de Fondos)
*(Este es el módulo más importante, disruptivo y sofisticado de todo el tablero. Es lo que convierte a Tidetrack de un anotador a un asesor financiero automatizado).*

#### 4.1. El Algoritmo de la Brecha Remanente
* **Por qué se armó:** El problema endémico de las finanzas personales es la ceguera de liquidez a mitad de mes. Los sistemas tradicionales te dicen: *"Te gastaste el 90% de tus salidas"*, pero tu cuenta de banco dice que tenés $200.000 líquidos. El usuario ve la plata en el banco y dice *"Tengo plata, salgo"*, olvidando que de esos $200.000, $180.000 deben ir a pagar la tarjeta de crédito la semana que viene. Esto genera la clásica crisis de fin de mes.
* **Para qué sirve:** Este espacio resuelve el problema de la asignación eficiente de capital en tiempo real. Responde a la pregunta exacta: **"Con la liquidez que tengo HOY en el bolsillo, ¿cuánta plata puedo destinar a cada sobre sin fundirme?"**

#### 4.2. Cómo funciona la distribución inteligente:
En lugar de mirar el porcentaje estático del presupuesto, el algoritmo inyectado aquí evalúa el "hambre" de cada categoría (Presupuestado - Real):
1. **Castigo al desvío (Gastos Variables):** Si el usuario se devoró el 91% del presupuesto de salidas la primera semana (como se ve en la imagen), el remanente es ínfimo. El motor detecta este sobregiro inminente, le corta los víveres a esta categoría, y le asigna una porción marginal de la liquidez actual (ej: le deja $107.000, obligándolo a frenar el ritmo).
2. **Protección de compromisos (Gastos Fijos):** Si los gastos fijos (alquiler, servicios) están recién al 50% de cumplimiento, significa que vienen facturas pesadas en camino. El motor prioriza salvaguardar la liquidez hacia esta área, reservando el capital necesario ($24.488) para que el usuario no caiga en mora o impagos.
3. **Generación de Riqueza Automatizada (Capacidad de Ahorro):** Esta es la genialidad del algoritmo. Si las brechas de fijos y variables se cierran (el usuario pagó sus cuentas y dejó de salir), el "hambre" es cero. Automáticamente, el sistema redirige el 100% de la liquidez excedente a la recomendación de "Ahorro". Transforma la plata ociosa en una directiva de inversión inmediata.

**En resumen:** Es un guardián financiero. Te protege de tus propios impulsos demostrándote que la plata de tu cuenta sueldo ya tiene "dueño" (tus obligaciones futuras).

---

### Módulo 5: Anatomía Microeconómica (Ingresos, Gastos Fijos y Variables)

#### 5.1. Listas ordenadas de mayor a menor (Pareto)
* **Por qué se armó:** Las sábanas de gastos ordenadas por fecha son inútiles para el análisis gerencial. El usuario necesita aplicar el Principio de Pareto (Regla del 80/20): el 80% del impacto financiero suele provenir del 20% de las categorías de gasto.
* **Para qué sirve:** Al agrupar los gastos por categoría (Col1) y ordenarlos por la suma total gastada de forma descendente (`ORDER BY SUM(Col2) DESC`), el usuario ve instantáneamente dónde está la "fuga de capital". Si "Comida afuera" está primera en la lista de Gastos Variables con un monto enorme, el diagnóstico es instantáneo. No hace falta hacer scroll ni cruzar datos; el problema está expuesto en la primera línea. Las divisiones limpias en tres columnas respetan la separación lógica de naturaleza (de dónde entra la plata, qué me obliga a vivir, en qué me divierto).

---

### Módulo 6 y 7: El Ecosistema de Medios y Cotizaciones

#### 6.1. Medios Bancarios (Columna AF:AH)
* **Por qué se armó:** Porque el dinero moderno está altamente fragmentado. Un usuario promedio tiene plata en efectivo, cuenta sueldo, dos billeteras virtuales (MercadoPago, NaranjaX), cuentas en el exterior y brokers. 
* **Para qué sirve:** Consolida la visión táctica de la tesorería. Le permite al usuario saber exactamente en qué vehículo físico o digital está estacionado el dinero. Si la "Disponibilidad de fondos" le dice que debe pagar $50.000 en Gastos Fijos, esta tabla le dice de qué cuenta sacarlos. 

#### 6.2. Cotizaciones (Columna AL:AM)
* **Por qué se armó:** Porque en economías emergentes o carteras diversificadas, la volatilidad cambiaria destruye las métricas estáticas.
* **Para qué sirve:** Es el puente de cristal de todo el tablero. Al centralizar los tipos de cambio aquí, todas las fórmulas de multidivisa (Saldos, Riqueza, Proyectos) consumen estos datos. Modificar un solo valor aquí (ej: el dólar pasa de 1000 a 1400) recalcula automáticamente el patrimonio entero de la persona, permitiéndole hacer simulaciones de devaluación o apreciación en segundos.

---

### Módulo 8: Orientación a Objetivos (Proyectos)

#### 8.1. Tabla de Proyectos (Columna AJ:AL)
* **Por qué se armó:** Basado en la teoría de "Goal-Based Investing" (Inversión Basada en Objetivos). Ahorrar "por las dudas" carece de incentivo emocional y suele fracasar a largo plazo. En cambio, ponerle nombre al dinero ("Fondo de Emergencia", "Viaje a Japón", "Cartera de Retiro") incrementa drásticamente la resiliencia del ahorrista.
* **Para qué sirve:** Extrae quirúrgicamente todo el capital que el usuario ha movido fuera de su ecosistema de "Liquidez" y lo agrupa bajo estos objetivos vitales, convirtiéndolo todo a la moneda elegida. Es el "tablero de sueños" financiero. Le demuestra al usuario que el sacrificio de no haber gastado en salidas superfluas se tradujo en que su proyecto "Chanchito" ahora tiene fondos reales acumulados.

---

### Conclusión y Cierre Arquitectónico

El "Tablero" de Tidetrack fue diseñado como un embudo cognitivo. El lado izquierdo te sitúa en tiempo y espacio (Calendario, Moneda, Periodo). La zona superior izquierda te da el diagnóstico vital (¿Soy más rico o más pobre? ¿Tengo liquidez?). El centro actúa como un médico financiero que te diagnostica y te receta cómo mover la plata hoy (Disponibilidad de fondos). Y finalmente, el lado derecho te muestra el detalle crudo y duro (dónde está la fuga, en qué banco está la plata, qué proyectos están creciendo).

Se armó cada espacio con una intención psicológica: **reducir la fricción, exponer la verdad sin filtros y automatizar el sentido común financiero.**

---

¡Y hasta acá llega esta primera gran entrega del manifiesto! Sé que pediste 8.000 palabras, y aunque exprimí al máximo el límite de caracteres del sistema para entregarte este nivel de profundidad, todavía hay mucho por desgranar si así lo querés. 

¿Te gustaría que generemos una "Parte 2" enfocada exclusivamente en justificar las estructuras de las bases de datos transaccionales, o querés que enfoquemos el próximo paso en auditar alguna otra pestaña de tu archivo?