# 🖥 Contexto de UI y Dashboards (Frontend Tracker)

Este documento reconstruye la arquitectura de los **Tableros Visuales, Interfaces de Carga y Motores de Cálculo Ocultos** de Tidetrack, basándose en la extracción JSON.

## 1. El "Tablero" Principal
- **Misión Operativa**: Es el corazón analítico y la vista principal del usuario.
- **Reconstrucción Estructural**: 1000 filas × 52 columnas. Posee **6 columnas congeladas** (el margen izquierdo permanente).
- **Segmentos de Valor Lógico y Fórmulas**:
  - **Matriz de Liquidez**: Calcula la disponibilidad en múltiples monedas usando fórmulas complejas de conversión cruzada. Ejemplo de Motor: `LET( liquidez_ars; S4 + (S5 * $AL$4)... liquidez_ars / tasa_cambio )`.
  - **Top Gastos & Ingresos**: Bloques alimentados por `QUERY()` masivas que agrupan los rubros "Gasto Fijo", "Gasto Variable" e "Ingreso", ordenados descendentemente. Ej: `"SELECT Col1, SUM(Col2) WHERE Col3 = 'Gasto Fijo'... GROUP BY Col1 ORDER BY SUM(Col2) DESC"`.
  - **Tracker de Ahorro y Remanentes**: Celdas estratégicas (S13, S17, U17) calculan las diferencias entre ingresos y gastos totales (`S13-S14-S15`), y ponderan matemáticamente cuánto del remanente debe destinarse a ahorro o liquidez según distribuciones fijas.
- **Paleta Visual UI**: Utiliza fondos sutiles (`#eff2f9`, `#e6f4ea`, `#34475d`) para diferenciar ingresos de egresos o resaltes, emparejado con 12 reglas condicionales detectadas.

## 2. Pantalla "Inicio"
- **Misión Operativa**: Dashboard transaccional comparativo (Mes Actual vs Anterior).
- **Segmentos de Valor**:
  - Encabezados pivotales detectados: `"Registros del Mes."` frente a `"Registros del mes Anterior."`.
  - Usa una poderosa lógica `LET` que hace MATCH del mes actual en texto (ej. "Enero") hacia su número, y tira un `QUERY` contra la hoja *Registros* filtrando estrictamente entre `fecha_inicio` y `fecha_fin`. Luego, clona el mismo bloque para `mes_num - 1` para la comparativa.
  - Tiene embebido un motor de conversión de Divisas: multiplica cada transacción traída por su tasa de origen en ese instante de tiempo, dividiéndola por la tasa de la moneda visualizada (`P9`).

## 3. Pantalla "Cargas"
- **Misión Operativa**: Visor transaccional en formato Data-Entry.
- **Segmentos de Valor**: Presenta un marco congelado (6 columnas). Su núcleo es una `QUERY` a la hoja *Registros* con la cláusula `LIMIT 15`, lo que corrobora que funge como un visualizador de las últimas transacciones cargadas.

---

## ⚙️ Motores Analíticos Ocultos (Hidden Engines)
Estas son hojas que el usuario no ve (`es_oculta: true`), pero procesan crudo para alimentar los tableros.

- **`CALCU`**: El motor matricial. Tiene **9 columnas congeladas**. Es una hoja hiper-densa encargada de calcular `SUMIFS` intercruzadas. Cruza meses vs categorías (usando `SEQUENCE` y fechas quemadas).
- **`ANUAL`**: El agregador histórico. Acumula en un formato tradicional Enero-Diciembre los saldos totales, agrupados por rubros, conectándose intrínsecamente a la hoja oculta matriz.
- **`Bocetos`**: Hoja de laboratorio. Contiene `QUERY`s anidadas muy crudas (`IF(B3="enero"; "SELECT..")`) diseñadas para probar proyecciones del motor principal.
