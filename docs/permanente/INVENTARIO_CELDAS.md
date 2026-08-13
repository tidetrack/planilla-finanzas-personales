# Inventario de celdas de la planilla de finanzas personales

> Documento AUTO-GENERADO por `devtools/generar_inventario_planilla.py`
> a partir de `docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json`.
> NO editar a mano: regenerar tras cada re-escaneo. La capa semantica
> curada vive en `docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md`.

- Planilla: **?** (`1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI`)
- Snapshot: 2026-03-23T22:26:41.785Z — cobertura: ?

> ADVERTENCIA: el JSON de origen no declara `cobertura`. Corresponde al
> scanner viejo (solo formulas y las primeras filas de cada hoja), asi
> que las bases de datos figuran casi vacias. Regenerar este inventario
> despues del primer escaneo con el scanner de cobertura total.

> ALCANCE: todo lo que este documento afirma sale del snapshot de la fecha
> indicada arriba. Hojas creadas o renombradas despues de esa fecha no
> figuran aca. Las dependencias se leen de las formulas: una referencia
> construida en runtime (INDIRECT, IMPORTRANGE con URL armada) no es
> detectable, asi que la matriz de la seccion 2 es un piso, no un techo.

## 1. Hojas de la planilla

| Hoja | Filas | Cols | Oculta | Congeladas (f/c) | Celdas con dato | Formulas | Reglas cond. |
|---|---|---|---|---|---|---|---|
| Inicio | 1000 | 50 | no | 0/6 | 89 | 14 | 2 |
| Tablero | 1000 | 52 | no | 0/6 | 116 | 41 | 12 |
| Cargas | 708 | 24 | no | 0/6 | 26 | 4 | 0 |
| Plan de Cuentas | 1000 | 25 | no | 0/0 | 40 | 4 | 0 |
| Tipos de Cambio | 815 | 19 | no | 0/0 | 32 | 3 | 0 |
| Registros | 2879 | 20 | no | 0/0 | 44 | 3 | 0 |
| BD Antigua | 2950 | 8 | no | 0/0 | 24 | 0 | 0 |
| Bocetos | 708 | 34 | no | 0/6 | 13 | 5 | 0 |
| Espacio blanco 1 | 708 | 4 | no | 0/6 | 3 | 3 | 0 |
| Espacio blanco 2 | 708 | 4 | no | 0/6 | 3 | 3 | 0 |
| DATA-ENTRY | 36 | 52 | si | 0/0 | 134 | 0 | 0 |
| CARGAS (Forest.) | 4 | 20 | si | 0/6 | 12 | 1 | 0 |
| CALCU | 32 | 28 | si | 0/9 | 142 | 114 | 6 |
| ANUAL | 98 | 16 | si | 1/0 | 1026 | 1010 | 3 |
| PALETAS | 17 | 11 | si | 0/0 | 6 | 0 | 2 |

## 2. Dependencias entre hojas (formulas que leen otra hoja)

| Hoja que lee | Hojas fuente (cantidad de formulas) |
|---|---|
| Inicio | Registros (2) |
| Tablero | Plan de Cuentas (13), Registros (1) |
| Cargas | Registros (1) |
| CARGAS (Forest.) | Tablero (1) |

**Referencias a hojas que NO figuran en el snapshot (posibles rotas):**

- `ANUAL` referencia la hoja `LISTAS`, que no figura en este snapshot (70 formulas; primera: `ANUAL!A22`).
- `Bocetos` referencia la hoja `R CAR`, que no figura en este snapshot (1 formulas; primera: `Bocetos!AH3`).
- `CARGAS (Forest.)` referencia la hoja `R CAR`, que no figura en este snapshot (1 formulas; primera: `CARGAS (Forest.)!T4`).
- `CALCU` referencia la hoja `R CAR`, que no figura en este snapshot (1 formulas; primera: `CALCU!AB3`).
- `ANUAL` referencia la hoja `R CAR`, que no figura en este snapshot (1 formulas; primera: `ANUAL!P1`).

**Referencias con el nombre de hoja escrito en otra caja de letras** (Google Sheets las resuelve igual, pero el nombre real es el de la derecha):

- `CARGAS (Forest.)`: `TABLERO!` -> hoja real `Tablero` (1 formulas).

## 3. Detalle por hoja

### Inicio

- Dimensiones: 1000 filas x 50 columnas (visible). Celdas con dato: 89.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 3 (26 celdas de texto, 26 en negrita): I=Aquí tienes un resumen de tu situación financiera actual. | P=Período de Análisis | Y=Monto | Z=Tipo | AA=Cuenta | AB=Tipo de Cuenta | AC=Medio | AD=Moneda | AE=Fecha | AF=Nota | AG=Ars | AH=Usd | AI=Aud | AJ=Eur | AM=Monto | AN=Tipo | AO=Cuenta | AP=Tipo de Cuenta | AQ=Medio | AR=Moneda | AS=Fecha | AT=Nota | AU=Ars | AV=Usd | AW=Aud | AX=Eur
- Fila 4 (13 celdas de texto, 0 en negrita): P=Marzo | Z=Ingreso | AA=Ingreso Viejo | AB=Ingreso | AC=NaranjaX | AD=ARS | AE=2026-03-19T03:00:00.000Z | AN=Ingreso | AO=Intereses bancos | AP=Ingreso | AQ=NaranjaX | AR=ARS | AS=2026-02-28T03:00:00.000Z
- Fila 5 (14 celdas de texto, 0 en negrita): I=Saldo Actual. | L=Riqueza Acumulada. | Z=Ingreso | AA=Traspaso | AC=Frascos Nx - Préstamo | AD=ARS | AE=2026-03-19T03:00:00.000Z | AF=Vence 20/04 | Frasco Fijo | AN=Ingreso | AO=Salidas | AP=Gasto Variable | AQ=Efectivo | AR=ARS | AS=2026-02-28T03:00:00.000Z

**Llamadas QUERY (staging de datos):**

- `AM4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num - 1; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num - 1; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!I2:T;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   
  ```
  - Fuente del QUERY (primer argumento): `Registros!I2:T` (12 columnas, headers leidos de la fila 2 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `AM4:AX` (espeja `Registros!I2:T`, columnas proyectadas I, J, K, L, M, N, O, P, Q, R, S, T).
  - Mapeo columnas: I(Monto)->AM, J(Tipo)->AN, K(Cuenta)->AO, L(Tipo de Cuenta)->AP, M(Medio)->AQ, N(Moneda)->AR, O(Fecha)->AS, P(Nota)->AT, Q->AU, R->AV, S->AW, T->AX
  - Verificacion: los headers de la fila 3 de `Inicio` confirman 8/8 columnas del mapeo; 4 sin header comparable.
- `Y4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!I2:T;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
  - Fuente del QUERY (primer argumento): `Registros!I2:T` (12 columnas, headers leidos de la fila 2 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `Y4:AJ` (espeja `Registros!I2:T`, columnas proyectadas I, J, K, L, M, N, O, P, Q, R, S, T).
  - Mapeo columnas: I(Monto)->Y, J(Tipo)->Z, K(Cuenta)->AA, L(Tipo de Cuenta)->AB, M(Medio)->AC, N(Moneda)->AD, O(Fecha)->AE, P(Nota)->AF, Q->AG, R->AH, S->AI, T->AJ
  - Verificacion: los headers de la fila 3 de `Inicio` confirman 8/8 columnas del mapeo; 4 sin header comparable.

**Patrones de formulas (14 formulas, 13 patrones unicos; top 20):**

- **2x** en [D692, D693] — ejemplo `D692`:
  ```
  =IF(#REF!<0,5; "#a9bca1"; IF(#REF!<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [AK3] — ejemplo `AK3`:
  ```
  ="Valor en " & P9
  ```
- **1x** en [Y4] — ejemplo `Y4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!I2:T;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
- **1x** en [AK4] — ejemplo `AK4`:
  ```
  =ARRAYFORMULA(   IF(Y4:Y=""; "";     LET(       tasa_origen; IF(AA4:AA="ARS"; AG4:AG; IF(AA4:AA="USD"; AH4:AH; IF(AA4:AA="AUD"; AI4:AI; IF(AA4:AA="EUR"; AJ4:AJ; 1))));       tasa_destino; IF(P9="ARS"; AG4:AG; IF(P9="USD"; AH4:AH; IF(P9="AUD"; AI4:AI; IF(P9="EUR"; AJ4:AJ; 1))));       IFERROR((Y4:Y * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [AM4] — ejemplo `AM4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num - 1; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num - 1; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!I2:T;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   
  ```
- **1x** en [I6] — ejemplo `I6`:
  ```
  =I10-L10
  ```
- **1x** en [L6] — ejemplo `L6`:
  ```
  =L10-O10
  ```
- **1x** en [I10] — ejemplo `I10`:
  ```
  =SUMIFS(AK4:AK; Z4:Z; "Ingreso"; AA4:AA; "<>Traspaso")
  ```
- **1x** en [L10] — ejemplo `L10`:
  ```
  =SUMIFS(AK4:AK; Z4:Z; "Egreso"; AA4:AA; "<>Traspaso")
  ```
- **1x** en [I12] — ejemplo `I12`:
  ```
  =LET(   tc_index; SWITCH(P9; "ARS"; 9; "USD"; 10; "AUD"; 11; "EUR"; 12; 9);   tc_col; CHOOSECOLS(AM4:AX; tc_index);   ingresos_prev; IFERROR(SUM(FILTER(IFERROR(AM4:AM / tc_col; 0); AN4:AN = "Ingreso")); 0);   variacion; IFERROR((I11 - ingresos_prev) / ingresos_prev; 0);   TEXT(variacion; "+0%;-0%;0%") & " respecto mes anterior" )
  ```
- **1x** en [L12] — ejemplo `L12`:
  ```
  =LET(   tc_index; SWITCH(P9; "ARS"; 9; "USD"; 10; "AUD"; 11; "EUR"; 12; 9);   tc_col; CHOOSECOLS(AM4:AX; tc_index);   egresos_prev; IFERROR(SUM(FILTER(IFERROR(AM4:AM / tc_col; 0); AN4:AN = "Egreso")); 0);   variacion; IFERROR((L11 - egresos_prev) / egresos_prev; 0);   TEXT(variacion; "+0%;-0%;0%") & " respecto mes anterior" )
  ```
- **1x** en [P13] — ejemplo `P13`:
  ```
  =SEQUENCE(6; 7; DATEVALUE(P4 & " 1 " & P6) - WEEKDAY(DATEVALUE(P4 & " 1 " & P6); 1) + 1)
  ```
- **1x** en [D694] — ejemplo `D694`:
  ```
  =IF(#REF!<0,5; "#da8b7b"; IF(#REF!<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Tablero

- Dimensiones: 1000 filas x 52 columnas (visible). Celdas con dato: 116.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (7 celdas de texto, 7 en negrita): I=Período de Análisis | Q=Saldos Actuales. | W=Ingresos. | Z=Gastos Fijos. | AC=Gastos Variables. | AF=Medios Bancarios. | AJ=Cotizaciones Monedas.
- Fila 3 (26 celdas de texto, 26 en negrita): Q=Moneda | S=Liquidez | U=Riqueza | W=Cuenta | X=Monto | Z=Cuenta | AA=Monto | AC=Cuenta | AD=Monto | AF=Medio | AG=Moneda | AH=Monto | AJ=Moneda | AL=Cotización | AN=Monto | AO=Tipo | AP=Cuenta | AQ=Tipo de Cuenta | AR=Medio | AS=Moneda | AT=Fecha | AU=Nota | AV=Ars | AW=Usd | AX=Aud | AY=Eur
- Fila 4 (10 celdas de texto, 0 en negrita): I=Marzo | Q=ARS | AG=ARS | AJ=USD | AO=Ingreso | AP=Ingreso Viejo | AQ=Ingreso | AR=NaranjaX | AS=ARS | AT=2026-03-19T03:00:00.000Z
- Fila 5 (13 celdas de texto, 0 en negrita): Q=USD | W=Ingreso Viejo | Z=MONOTRIBUTO | AC=Juntadas | AF=NaranjaX | AG=ARS | AJ=AUD | AO=Ingreso | AP=Traspaso | AR=Frascos Nx - Préstamo | AS=ARS | AT=2026-03-19T03:00:00.000Z | AU=Vence 20/04 | Frasco Fijo

**Llamadas QUERY (staging de datos):**

- `AC4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Variable'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AP4:AP \ IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \ AQ4:AQ \ IFERROR...`).
- `AF4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({AR4:AR \ AS4:AS \ IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)});   "SELECT Col1, Col2, SUM(Col3)     WHERE Col1 IS NOT NULL AND Col1 <> ''     GROUP BY Col1, Col2     ORDER BY SUM(Col3) DESC     LABEL Col1 '', Col2 '', SUM(Col3) ''";   0 ); {"" \ "" \ ""})
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({AR4:AR \ AS4:AS \ IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)})`).
- `AN4`:
  ```
  =LET(   mes_num; MATCH(I4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(I6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(I6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!I2:T;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
  - Fuente del QUERY (primer argumento): `Registros!I2:T` (12 columnas, headers leidos de la fila 2 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `AN4:AY` (espeja `Registros!I2:T`, columnas proyectadas I, J, K, L, M, N, O, P, Q, R, S, T).
  - Mapeo columnas: I(Monto)->AN, J(Tipo)->AO, K(Cuenta)->AP, L(Tipo de Cuenta)->AQ, M(Medio)->AR, N(Moneda)->AS, O(Fecha)->AT, P(Nota)->AU, Q->AV, R->AW, S->AX, T->AY
  - Verificacion: los headers de la fila 3 de `Tablero` confirman 8/8 columnas del mapeo; 4 sin header comparable.
- `W4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Ingreso'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL     AND
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AP4:AP \ IF(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \ AQ4:AQ \ IFERROR(...`).
- `Z4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Fijo'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL    
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AP4:AP \ IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \ AQ4:AQ \ IFERROR...`).
- `AJ10`:
  ```
  =LET(   medio; AR4:AR;   moneda; AS4:AS;      monto_neto; ARRAYFORMULA(IF(AN4:AN=""; 0; IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)));      proyecto; ARRAYFORMULA(IFERROR(VLOOKUP(medio; 'Plan de Cuentas'!R:T; 3; 0); ""));   tipo_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyecto; 'Plan de Cuentas'!V:W; 2; 0); ""));      tasa_origen; ARRAYFORMULA(IF(moneda="USD"; $AL$4; IF(moneda="AUD"; $AL$5; IF(moneda="EUR"; $
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `{proy_filtrado \ monto_filtrado}`).

**Patrones de formulas (41 formulas, 38 patrones unicos; top 20):**

- **2x** en [S15, U15] — ejemplo `S15`:
  ```
  =AD2
  ```
- **2x** en [S23, S24] — ejemplo `S23`:
  ```
  =IFERROR(U14 / S14; 0)
  ```
- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(#REF!<0,5; "#a9bca1"; IF(#REF!<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [X2] — ejemplo `X2`:
  ```
  =SUM(X4:X22)
  ```
- **1x** en [AA2] — ejemplo `AA2`:
  ```
  =SUM(AA4:AA22)
  ```
- **1x** en [AD2] — ejemplo `AD2`:
  ```
  =SUM(AD4:AD22)
  ```
- **1x** en [AZ3] — ejemplo `AZ3`:
  ```
  ="Valor en " & I9
  ```
- **1x** en [S4] — ejemplo `S4`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)); AS4:AS="ARS"; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [U4] — ejemplo `U4`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas'!V:W; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto_neto; AS4:AS="ARS"; cond_riqueza); 0)) )
  ```
- **1x** en [W4] — ejemplo `W4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Ingreso'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL     AND
  ```
- **1x** en [Z4] — ejemplo `Z4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Fijo'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL    
  ```
- **1x** en [AC4] — ejemplo `AC4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""); 'Plan de Cuentas'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Variable'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL
  ```
- **1x** en [AF4] — ejemplo `AF4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({AR4:AR \ AS4:AS \ IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)});   "SELECT Col1, Col2, SUM(Col3)     WHERE Col1 IS NOT NULL AND Col1 <> ''     GROUP BY Col1, Col2     ORDER BY SUM(Col3) DESC     LABEL Col1 '', Col2 '', SUM(Col3) ''";   0 ); {"" \ "" \ ""})
  ```
- **1x** en [AL4] — ejemplo `AL4`:
  ```
  =tidetrack_usd()
  ```
- **1x** en [AN4] — ejemplo `AN4`:
  ```
  =LET(   mes_num; MATCH(I4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(I6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(I6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!I2:T;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
- **1x** en [AZ4] — ejemplo `AZ4`:
  ```
  =ARRAYFORMULA(   IF(AN4:AN=""; "";     LET(       tasa_origen; IF(AS4:AS="ARS"; AV4:AV; IF(AS4:AS="USD"; AW4:AW; IF(AS4:AS="AUD"; AX4:AX; IF(AS4:AS="EUR"; AY4:AY; 1))));       tasa_destino; IF(I9="ARS"; AV4:AV; IF(I9="USD"; AW4:AW; IF(I9="AUD"; AX4:AX; IF(I9="EUR"; AY4:AY; 1))));       IFERROR((AN4:AN * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [S5] — ejemplo `S5`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)); AS4:AS="USD"; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [U5] — ejemplo `U5`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas'!V:W; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto_neto; AS4:AS="USD"; cond_riqueza); 0)) )
  ```
- **1x** en [AL5] — ejemplo `AL5`:
  ```
  =tidetrack_AUD()
  ```
- **1x** en [S6] — ejemplo `S6`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)); AS4:AS="AUD"; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas'!R:T; 3; 0); ""))="Medio Cotidiano"); 0))
  ```

### Cargas

- Dimensiones: 708 filas x 24 columnas (visible). Celdas con dato: 26.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 4 (14 celdas de texto, 14 en negrita): I=Monto | J=Tipo | K=Cuenta | L=Medio | M=Moneda | N=Fecha | O=Nota | R=Monto | S=Tipo | T=Cuenta | U=Medio | V=Moneda | W=Fecha | X=Nota
- Fila 5 (5 celdas de texto, 0 en negrita): S=Ingreso | T=Ingreso Viejo | U=NaranjaX | V=ARS | W=2026-03-19T03:00:00.000Z

**Llamadas QUERY (staging de datos):**

- `R5`:
  ```
  =IFERROR(QUERY(   {Registros!I2:T};   "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15";   0 ); "")
  ```
  - Fuente del QUERY (primer argumento): `Registros!I2:T` (12 columnas, headers leidos de la fila 2 de la fuente).
  - Proyeccion: SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 — 7 columnas; LIMIT 15 filas.
  - Staging: `R5:X` (espeja `Registros!I2:T`, columnas proyectadas I, J, K, M, N, O, P).
  - Mapeo columnas: I(Monto)->R, J(Tipo)->S, K(Cuenta)->T, M(Medio)->U, N(Moneda)->V, O(Fecha)->W, P(Nota)->X
  - Verificacion: los headers de la fila 4 de `Cargas` confirman 7/7 columnas del mapeo.

**Patrones de formulas (4 formulas, 3 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(I17<0,5; "#a9bca1"; IF(I17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [R5] — ejemplo `R5`:
  ```
  =IFERROR(QUERY(   {Registros!I2:T};   "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15";   0 ); "")
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(#REF!<0,5; "#da8b7b"; IF(#REF!<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Plan de Cuentas

- Dimensiones: 1000 filas x 25 columnas (visible). Celdas con dato: 40.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (6 celdas de texto, 6 en negrita): I=Ingresos. | L=Gastos Fijos. | O=Gastos Variables. | R=Medios Bancarios. | V=Proyectos. | Y=Categorias.
- Fila 3 (12 celdas de texto, 12 en negrita): I=Cuenta | J=Proyecto | L=Cuenta | M=Proyecto | O=Cuenta | P=Proyecto | R=Medio | S=Moneda | T=Proyecto | V=Proyecto | W=Tipo | Y=Cuenta
- Fila 4 (8 celdas de texto, 0 en negrita): I=Tidetrack | L=Auto | O=Comidas | R=YPF | S=ARS | T=Medio Cotidiano | V=Ahorros | W=Ahorro
- Fila 5 (9 celdas de texto, 0 en negrita): I=Umoh | L=Gatos | O=Computación | R=Ualá | S=ARS | T=Medio Cotidiano | V=Tarjeta de Crédito | W=Financiación | Y=Umoh

**Llamadas QUERY (staging de datos):**

- `Y4`:
  ```
  =ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L;O4:O;R4:R});  "select * where Col1 is not null"))
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `FLATTEN({I4:I;L4:L;O4:O;R4:R})`).

**Patrones de formulas (4 formulas, 3 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(J17<0,5; "#a9bca1"; IF(J17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [Y4] — ejemplo `Y4`:
  ```
  =ARRAYFORMULA(QUERY(FLATTEN({I4:I;L4:L;O4:O;R4:R});  "select * where Col1 is not null"))
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(J19<0,5; "#da8b7b"; IF(J19<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Tipos de Cambio

- Dimensiones: 815 filas x 19 columnas (visible). Celdas con dato: 32.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (4 celdas de texto, 4 en negrita): I=Peso Argentino. | L=Dólar Estaudonidense. | O=Dólar Australiano. | R=Euro.
- Fila 3 (8 celdas de texto, 8 en negrita): I=Fecha | J=Cotización | L=Fecha | M=Cotización | O=Fecha | P=Cotización | R=Fecha | S=Cotización
- Fila 4 (4 celdas de texto, 0 en negrita): I=2026-03-20T12:00:00.000Z | L=2026-03-20T12:00:00.000Z | O=2026-03-20T12:00:00.000Z | R=2026-03-20T12:00:00.000Z
- Fila 5 (4 celdas de texto, 0 en negrita): I=2026-03-19T12:00:00.000Z | L=2026-03-19T12:00:00.000Z | O=2026-03-19T12:00:00.000Z | R=2026-03-19T12:00:00.000Z

**Patrones de formulas (3 formulas, 2 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(J17<0,5; "#a9bca1"; IF(J17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(J19<0,5; "#da8b7b"; IF(J19<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Registros

- Dimensiones: 2879 filas x 20 columnas (visible). Celdas con dato: 44.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (8 celdas de texto, 8 en negrita): I=Monto | J=Tipo | K=Cuenta | L=Tipo de Cuenta | M=Medio | N=Moneda | O=Fecha | P=Nota
- Fila 3 (6 celdas de texto, 0 en negrita): J=Ingreso | K=Ingreso Viejo | L=Ingreso | M=NaranjaX | N=ARS | O=2026-03-19T03:00:00.000Z
- Fila 4 (6 celdas de texto, 0 en negrita): J=Ingreso | K=Traspaso | M=Frascos Nx - Préstamo | N=ARS | O=2026-03-19T03:00:00.000Z | P=Vence 20/04 | Frasco Fijo
- Fila 5 (5 celdas de texto, 0 en negrita): J=Egreso | K=Traspaso | M=NaranjaX | N=ARS | O=2026-03-19T03:00:00.000Z

**Patrones de formulas (3 formulas, 2 patrones unicos; top 20):**

- **2x** en [D2667, D2668] — ejemplo `D2667`:
  ```
  =IF(J17<0,5; "#a9bca1"; IF(J17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [D2669] — ejemplo `D2669`:
  ```
  =IF(J19<0,5; "#da8b7b"; IF(J19<=0,8; "#db9940"; "#a9bca1")) 
  ```

### BD Antigua

- Dimensiones: 2950 filas x 8 columnas (visible). Celdas con dato: 24.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 1 (8 celdas de texto, 8 en negrita): A=Fecha | B=Ingreso | C=Egreso | D=Detalle | E=Medio | F=Tipo | G=Observacion | H=Cuentas Faltantes
- Fila 2 (3 celdas de texto, 0 en negrita): A=2024-01-01T03:00:00.000Z | D=Inicio Mes | E=Efectivo
- Fila 3 (3 celdas de texto, 0 en negrita): A=2024-01-01T03:00:00.000Z | D=Inicio Mes | E=Santander
- Fila 4 (3 celdas de texto, 0 en negrita): A=2024-01-01T03:00:00.000Z | D=Inicio Mes | E=Patagonia
- Fila 5 (3 celdas de texto, 0 en negrita): A=2024-01-01T03:00:00.000Z | D=Inicio Mes | E=Brubank

### Bocetos

- Dimensiones: 708 filas x 34 columnas (visible). Celdas con dato: 13.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (3 celdas de texto, 2 en negrita): H=Bienvenido de nuevo. | N=mes | O=año

**Llamadas QUERY (staging de datos):**

- `AH3`:
  ```
  =QUERY('R CAR'!A:G;AH2)
  ```
  - Staging: no estimado — el primer argumento del QUERY apunta a la hoja `R CAR`, que no figura en este snapshot.

**Patrones de formulas (5 formulas, 4 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(J17<0,5; "#a9bca1"; IF(J17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [AH2] — ejemplo `AH2`:
  ```
  =IF(B3="enero";      "SELECT * WHERE A >= date'"&#REF!&"-01-01' AND A < date'"&#REF!&"-02-01'";  IF(B3="febrero";      "SELECT * WHERE A >= date'"&#REF!&"-02-01' AND A < date'"&#REF!&"-03-01'";  IF(B3="marzo";      "SELECT * WHERE A >= date'"&#REF!&"-03-01' AND A < date'"&#REF!&"-04-01'";  IF(B3="abril";      "SELECT * WHERE A >= date'"&#REF!&"-04-01' AND A < date'"&#REF!&"-05-01'";  IF(B3="mayo";
  ```
- **1x** en [AH3] — ejemplo `AH3`:
  ```
  =QUERY('R CAR'!A:G;AH2)
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(J19<0,5; "#da8b7b"; IF(J19<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Espacio blanco 1

- Dimensiones: 708 filas x 4 columnas (visible). Celdas con dato: 3.

**Patrones de formulas (3 formulas, 2 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(J17<0,5; "#a9bca1"; IF(J17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(J19<0,5; "#da8b7b"; IF(J19<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Espacio blanco 2

- Dimensiones: 708 filas x 4 columnas (visible). Celdas con dato: 3.

**Patrones de formulas (3 formulas, 2 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(J17<0,5; "#a9bca1"; IF(J17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(J19<0,5; "#da8b7b"; IF(J19<=0,8; "#db9940"; "#a9bca1")) 
  ```

### DATA-ENTRY

- Dimensiones: 36 filas x 52 columnas (OCULTA). Celdas con dato: 134.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (7 celdas de texto, 7 en negrita): B=DB_MONEDAS | G=DB_TIPOS_CAMBIO | T=DB_MEDIOS_PAGO | Z=DB_CUENTAS | AE=DB_TRANSACCIONES | AR=DB_CONFIG | AV=AUX_COTIZACIONES
- Fila 3 (45 celdas de texto, 45 en negrita): B=moneda_id | C=nombre_,moneda | D=simbolo | E=iso_code | G=fx_id | H=fecha | I=base_moneda_id | J=quote_moneda_id | K=tc | L=fuente | M=provider | N=api_endpoint | O=request_params | P=fetched_at | Q=status | R=raw_payload | T=medio_id | U=nombre_medio | V=tipo | W=moneda_id | X=uso_principal | Z=cuenta_id | AA=nombre_cuentas | AB=macro_tipo | AC=es_recurrente | AE=trx_id | AF=fecha | AG=monto | AH=moneda_id | AI=sentido | AJ=cuenta_id | AK=medio_id | AL=nota | AM=fx_id | AN=monto_base | AO=nom (...)
- Fila 4 (37 celdas de texto, 11 en negrita): B=MON-001 | C=Peso argentino | D=$ | E=ARS | G=FX-00001 | H=2026-02-11T00:00:00.000Z | I=MON-001 | J=MON-002 | L=oficial | M=exchangerate-api.com | N=https://api.exchangerate-api.com/v4/latest/USD | O={"base":"USD"} | P=2026-02-11T22:16:35.000Z | Q=ok | R={"provider":"https://www.exchangerate-api.com","WARNING_UPGRADE_TO_V6":"https://www.exchangerate-api.com/docs/free","terms":"https://www.exchangerate-api.com/terms","base":"USD","date":"2026-02-11","time_last_updated":1770768001,"rates":{"USD": (...)
- Fila 5 (34 celdas de texto, 11 en negrita): B=MON-002 | C=Dólar estadounidense | D=US$ | E=USD | G=FX-00002 | H=2026-02-11T00:00:00.000Z | I=MON-003 | J=MON-002 | L=oficial | M=exchangerate-api.com | N=https://api.exchangerate-api.com/v4/latest/USD | O={"base":"USD"} | P=2026-02-11T22:16:35.000Z | Q=ok | R={"provider":"https://www.exchangerate-api.com","WARNING_UPGRADE_TO_V6":"https://www.exchangerate-api.com/docs/free","terms":"https://www.exchangerate-api.com/terms","base":"USD","date":"2026-02-11","time_last_updated":1770768001,"rates" (...)

### CARGAS (Forest.)

- Dimensiones: 4 filas x 20 columnas (OCULTA). Celdas con dato: 12.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 4 (7 celdas de texto, 0 en negrita): I=Fecha | J=Monto | K=Moneda | L=Tipo | M=Cuenta/Categoria | N=Medio | O=Nota

**Llamadas QUERY (staging de datos):**

- `T4`:
  ```
  =QUERY('R CAR'!A:G;TABLERO!AH2)
  ```
  - Staging: no estimado — el primer argumento del QUERY apunta a la hoja `R CAR`, que no figura en este snapshot.

**Patrones de formulas (1 formulas, 1 patrones unicos; top 20):**

- **1x** en [T4] — ejemplo `T4`:
  ```
  =QUERY('R CAR'!A:G;TABLERO!AH2)
  ```

### CALCU

- Dimensiones: 32 filas x 28 columnas (OCULTA). Celdas con dato: 142.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (4 celdas de texto, 4 en negrita): B=CALENDARIO | K=INGRESOS | P=GASTOS FIJOS | U=GASTOS VARIABLES
- Fila 4 (7 celdas de texto, 7 en negrita): B=D | C=L | D=M | E=M | F=J | G=V | H=S
- Fila 5 (6 celdas de texto, 0 en negrita): C=2025-12-29T03:00:00.000Z | D=2025-12-30T03:00:00.000Z | E=2025-12-31T03:00:00.000Z | F=2026-01-01T03:00:00.000Z | G=2026-01-02T03:00:00.000Z | H=2026-01-03T03:00:00.000Z

**Llamadas QUERY (staging de datos):**

- `AB3`:
  ```
  =QUERY('R CAR'!A:H;AB2)
  ```
  - Staging: no estimado — el primer argumento del QUERY apunta a la hoja `R CAR`, que no figura en este snapshot.

**Patrones de formulas (114 formulas, 22 patrones unicos; top 20):**

- **30x** en [R3, R4, R5, R6, R7, R8, R9, R10, ...] — ejemplo `R3`:
  ```
  =SUMIFS($AD:$AD;$AE:$AE;P3) - SUMIFS($AC:$AC;$AE:$AE;P3)
  ```
- **30x** en [W3, W4, W5, W6, W7, W8, W9, W10, ...] — ejemplo `W3`:
  ```
  =SUMIFS($AD:$AD;$AE:$AE;U3) - SUMIFS($AC:$AC;$AE:$AE;U3)
  ```
- **21x** en [M12, M13, M14, M15, M16, M17, M18, M19, ...] — ejemplo `M12`:
  ```
  =SUMIFS(AC:AC;AG:AG;K12)
  ```
- **9x** en [M3, M4, M5, M6, M7, M8, M9, M10, ...] — ejemplo `M3`:
  ```
  =SUMIFS($AC:$AC;$AE:$AE;K3)-SUMIFS($AD:$AD;$AE:$AE;K3)
  ```
- **6x** en [E16, E17, E18, E24, E25, E26] — ejemplo `E16`:
  ```
  =IFERROR(F16/$F$14;0)
  ```
- **2x** en [F18, F26] — ejemplo `F18`:
  ```
  =F14-F16-F17
  ```
- **1x** en [H2] — ejemplo `H2`:
  ```
  =DATEVALUE(B3&" 1 "&G3)
  ```
- **1x** en [M2] — ejemplo `M2`:
  ```
  =SUM(M3:M12)
  ```
- **1x** en [N2] — ejemplo `N2`:
  ```
  =SUM(N3:N12)
  ```
- **1x** en [R2] — ejemplo `R2`:
  ```
  =SUM(R3:R32)
  ```
- **1x** en [S2] — ejemplo `S2`:
  ```
  =SUM(S3:S20)
  ```
- **1x** en [W2] — ejemplo `W2`:
  ```
  =SUM(W3:W32)
  ```
- **1x** en [X2] — ejemplo `X2`:
  ```
  =SUM(X3:X20)
  ```
- **1x** en [AB2] — ejemplo `AB2`:
  ```
  =IF(B3="enero";      "SELECT * WHERE A >= date'"&G3&"-01-01' AND A < date'"&G3&"-02-01'";  IF(B3="febrero";      "SELECT * WHERE A >= date'"&G3&"-02-01' AND A < date'"&G3&"-03-01'";  IF(B3="marzo";      "SELECT * WHERE A >= date'"&G3&"-03-01' AND A < date'"&G3&"-04-01'";  IF(B3="abril";      "SELECT * WHERE A >= date'"&G3&"-04-01' AND A < date'"&G3&"-05-01'";  IF(B3="mayo";      "SELECT * WHERE A 
  ```
- **1x** en [AB3] — ejemplo `AB3`:
  ```
  =QUERY('R CAR'!A:H;AB2)
  ```
- **1x** en [B5] — ejemplo `B5`:
  ```
  =SEQUENCE( 6;7;H2-WEEKDAY(H2;1)+1)
  ```
- **1x** en [F14] — ejemplo `F14`:
  ```
  =M2
  ```
- **1x** en [F16] — ejemplo `F16`:
  ```
  =R2
  ```
- **1x** en [F17] — ejemplo `F17`:
  ```
  =W2
  ```
- **1x** en [F22] — ejemplo `F22`:
  ```
  =N2
  ```

### ANUAL

- Dimensiones: 98 filas x 16 columnas (OCULTA). Celdas con dato: 1026.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 1 (12 celdas de texto, 12 en negrita): B=ENERO | C=FEBRERO | D=MARZO | E=ABRIL | F=MAYO | G=JUNIO | H=JULIO | I=AGOSTO | J=SEPTIEMBRE | K=OCTUBRE | L=NOVIEMBRE | M=DICIEMBRE

**Llamadas QUERY (staging de datos):**

- `P1`:
  ```
  =QUERY('R CAR'!A:G)
  ```
  - Staging: no estimado — el primer argumento del QUERY apunta a la hoja `R CAR`, que no figura en este snapshot.

**Patrones de formulas (1010 formulas, 58 patrones unicos; top 20):**

- **759x** en [B22, C22, D22, E22, F22, G22, H22, I22, ...] — ejemplo `B22`:
  ```
  =SUMIFS($Q:$Q;$S:$S;A22;$P:$P;">="&DATE($A$1;1;1);$P:$P;"<="&DATE($A$1;1;31)) - SUMIFS($R:$R;$S:$S;A22;$P:$P;">="&DATE($A$1;1;1);$P:$P;"<="&DATE($A$1;1;31)) 
  ```
- **69x** en [J22, J23, J24, J25, J26, J27, J28, J29, ...] — ejemplo `J22`:
  ```
  =SUMIFS($Q:$Q;$S:$S;A22;$P:$P;">="&DATE($A$1;9;1);$P:$P;"<="&DATE($A$1;9;30)) - SUMIFS($R:$R;$S:$S;A22;$P:$P;">="&DATE($A$1;9;1);$P:$P;"<="&DATE($A$1;9;30)) 
  ```
- **30x** en [A35, A36, A37, A38, A39, A40, A41, A42, ...] — ejemplo `A35`:
  ```
  =LISTAS!H2
  ```
- **30x** en [A68, A69, A70, A71, A72, A73, A74, A75, ...] — ejemplo `A68`:
  ```
  =LISTAS!N2
  ```
- **10x** en [A22, A23, A24, A25, A26, A27, A28, A29, ...] — ejemplo `A22`:
  ```
  =LISTAS!F2
  ```
- **10x** en [C31, D31, E31, F31, G31, H31, I31, K31, ...] — ejemplo `C31`:
  ```
  =SUMIFS($Q:$Q;$U:$U;A31;$P:$P;">="&DATE($A$1;2;1);$P:$P;"<="&DATE($A$1;2;29)) - SUMIFS($R:$R;$U:$U;A31;$P:$P;">="&DATE($A$1;2;1);$P:$P;"<="&DATE($A$1;2;29)) 
  ```
- **3x** en [B15, B16, B17] — ejemplo `B15`:
  ```
  =1/3
  ```
- **3x** en [B32, B65, B98] — ejemplo `B32`:
  ```
  =SUM(B22:B31)
  ```
- **3x** en [C32, C65, C98] — ejemplo `C32`:
  ```
  =SUM(C22:C31)
  ```
- **3x** en [D32, D65, D98] — ejemplo `D32`:
  ```
  =SUM(D22:D31)
  ```
- **3x** en [E32, E65, E98] — ejemplo `E32`:
  ```
  =SUM(E22:E31)
  ```
- **3x** en [F32, F65, F98] — ejemplo `F32`:
  ```
  =SUM(F22:F31)
  ```
- **3x** en [G32, G65, G98] — ejemplo `G32`:
  ```
  =SUM(G22:G31)
  ```
- **3x** en [H32, H65, H98] — ejemplo `H32`:
  ```
  =SUM(H22:H31)
  ```
- **3x** en [I32, I65, I98] — ejemplo `I32`:
  ```
  =SUM(I22:I31)
  ```
- **3x** en [J32, J65, J98] — ejemplo `J32`:
  ```
  =SUM(J22:J31)
  ```
- **3x** en [K32, K65, K98] — ejemplo `K32`:
  ```
  =SUM(K22:K31)
  ```
- **3x** en [L32, L65, L98] — ejemplo `L32`:
  ```
  =SUM(L22:L31)
  ```
- **3x** en [M32, M65, M98] — ejemplo `M32`:
  ```
  =SUM(M22:M31)
  ```
- **2x** en [B4, B8] — ejemplo `B4`:
  ```
  =B65 *-1
  ```

### PALETAS

- Dimensiones: 17 filas x 11 columnas (OCULTA). Celdas con dato: 6.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 4 (3 celdas de texto, 2 en negrita): I=Jerarquía | J=Código HEX | K=Paleta

