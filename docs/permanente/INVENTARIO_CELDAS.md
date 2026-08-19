# Inventario de celdas de la planilla de finanzas personales

> Documento AUTO-GENERADO por `devtools/generar_inventario_planilla.py`
> a partir de `docs/permanente/TIDETRACK_ARQUITECTURA_ESTRICTA.json`.
> NO editar a mano: regenerar tras cada re-escaneo. La capa semantica
> curada vive en `docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md`.

- Planilla: **PLANILLA FINANZAS_v4 .WIP | Personal** (`1YXnN-9X1itjpuxOBBwGwH3LSMqeGBtyCrUcFK4xCcUI`)
- Snapshot: 2026-08-18T22:14:29.098318Z — cobertura: total en las 11 hojas de logica y catalogo; estructura+formulas en los 4 ledgers de datos (ver meta.cobertura_hoja)

> ALCANCE: todo lo que este documento afirma sale del snapshot de la fecha
> indicada arriba. Hojas creadas o renombradas despues de esa fecha no
> figuran aca. Las dependencias se leen de las formulas: una referencia
> construida en runtime (INDIRECT, IMPORTRANGE con URL armada) no es
> detectable, asi que la matriz de la seccion 2 es un piso, no un techo.

## 1. Hojas de la planilla

| Hoja | Filas | Cols | Oculta | Congeladas (f/c) | Celdas con dato | Formulas | Reglas cond. |
|---|---|---|---|---|---|---|---|
| Inicio (anterior 2026-08-18) | 694 | 51 | si | 0/6 | 3143 | 16 | 6 |
| Cuarentena Plan (2026-08-18) | 1911 | 14 | si | 0/0 | 21081 | 0 | 0 |
| Inicio | 124 | 46 | no | 0/0 | 2867 | 13 | 6 |
| Tablero (anterior 2026-08-18) | 708 | 52 | si | 0/6 | 1025 | 38 | 12 |
| Tablero | 84 | 48 | no | 0/16 | 1174 | 43 | 12 |
| Presupuesto | 19 | 24 | no | 0/7 | 63 | 24 | 0 |
| Cargas (anterior 2026-08-18) | 708 | 24 | si | 0/6 | 130 | 4 | 0 |
| Cargas | 21 | 19 | no | 0/0 | 126 | 1 | 0 |
| Plan de Cuentas (anterior 2026-08-18) | 1000 | 25 | si | 0/6 | 260 | 4 | 0 |
| Plan de Cuentas | 83 | 19 | no | 0/0 | 249 | 1 | 0 |
| Mirada Interanual | 13 | 18 | no | 0/0 | 79 | 52 | 0 |
| Registros (anterior 2026-08-18) | 3463 | 13 | si | 3/0 | 38263 | 0 | 0 |
| Registros | 3464 | 13 | no | 0/0 | 38263 | 0 | 0 |
| Tipos de Cambio (anterior 2026-08-18) | 962 | 12 | si | 3/0 | 6705 | 0 | 0 |
| Tipos de Cambio | 963 | 13 | no | 0/0 | 7661 | 0 | 0 |

## 2. Dependencias entre hojas (formulas que leen otra hoja)

| Hoja que lee | Hojas fuente (cantidad de formulas) |
|---|---|
| Inicio (anterior 2026-08-18) | Plan de Cuentas (anterior 2026-08-18) (6), Registros (anterior 2026-08-18) (2) |
| Inicio | Plan de Cuentas (6), Registros (2) |
| Tablero (anterior 2026-08-18) | Plan de Cuentas (anterior 2026-08-18) (13), Registros (anterior 2026-08-18) (1) |
| Tablero | Plan de Cuentas (13), Registros (1) |
| Cargas (anterior 2026-08-18) | Registros (anterior 2026-08-18) (1) |
| Cargas | Registros (1) |
| Mirada Interanual | Registros (36) |

## 3. Detalle por hoja

### Inicio (anterior 2026-08-18)

- Dimensiones: 694 filas x 51 columnas (OCULTA). Celdas con dato: 3143.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 3 (28 celdas de texto, 28 en negrita): I=Aquí tienes un resumen de tu situación financiera actual. | P=Período de Análisis | Y=Monto | Z=Tipo | AA=Cuenta | AB=Tipo de Cuenta | AC=Medio | AD=Moneda | AE=Fecha | AF=Nota | AG=Ars | AH=Usd | AI=Aud | AJ=Eur | AK=Valor en ARS | AM=Monto | AN=Tipo | AO=Cuenta | AP=Tipo de Cuenta | AQ=Medio | AR=Moneda | AS=Fecha | AT=Nota | AU=Ars | AV=Usd | AW=Aud | AX=Eur | AY=Valor en ARS
- Fila 4 (9 celdas de texto, 0 en negrita): P=Julio | Z=Ingreso | AA=Intereses bancos | AB=Ingreso | AC=NaranjaX | AD=ARS | AN=Egreso | AQ=Efectivo | AR=ARS
- Fila 5 (12 celdas de texto, 0 en negrita): I=Saldo Actual. | L=Riqueza Acumulada. | Z=Egreso | AA=Sportclub | AB=Gasto Fijo | AC=NaranjaX | AD=ARS | AN=Ingreso | AO=Intereses bancos | AP=Ingreso | AQ=NaranjaX | AR=ARS
- Fila 6 (11 celdas de texto, 0 en negrita): Z=Egreso | AA=Nafta | AB=Gasto Fijo | AC=NaranjaX | AD=ARS | AN=Egreso | AO=Trabajo | AP=Gasto Variable | AQ=NaranjaX | AR=ARS | AT=almuerzo
- Fila 7 (10 celdas de texto, 0 en negrita): Z=Egreso | AA=Salidas | AB=Gasto Variable | AC=NaranjaX | AD=ARS | AN=Ingreso | AO=Intereses bancos | AP=Ingreso | AQ=NaranjaX | AR=ARS
- Fila 8 (10 celdas de texto, 1 en negrita): P=Moneda | Z=Egreso | AA=Estacionamiento | AB=Gasto Variable | AC=Efectivo | AD=ARS | AN=Egreso | AO=Traspaso | AQ=Frasco Transitorio NaranjaX | AR=ARS
- Fila 9 (12 celdas de texto, 0 en negrita): I=Ingresos. | L=Egresos. | P=ARS | Z=Ingreso | AA=Intereses bancos | AB=Ingreso | AC=NaranjaX | AD=ARS | AN=Ingreso | AO=Traspaso | AQ=NaranjaX | AR=ARS
- Fila 10 (10 celdas de texto, 0 en negrita): Z=Egreso | AA=Juntadas | AB=Gasto Variable | AC=NaranjaX | AD=ARS | AN=Ingreso | AO=Intereses bancos | AP=Ingreso | AQ=NaranjaX | AR=ARS

**Llamadas QUERY (staging de datos):**

- `AM4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num - 1; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num - 1; 1); 0); "yyyy-mm-dd");   QUERY(     'Registros (anterior 2026-08-18)'!B5:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & f
  ```
  - Fuente del QUERY (primer argumento): `Registros (anterior 2026-08-18)!B5:M` (12 columnas, headers leidos de la fila 5 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `AM4:AX` (espeja `Registros (anterior 2026-08-18)!B5:M`, columnas proyectadas B, C, D, E, F, G, H, I, J, K, L, M).
  - Mapeo columnas: B(Monto)->AM, C(Tipo)->AN, D(Cuenta)->AO, E(Tipo de Cuenta)->AP, F(Medio)->AQ, G(Moneda)->AR, H(Fecha)->AS, I(Nota)->AT, J(Valor ARS)->AU, K(Valor USD)->AV, L(Valor AUD)->AW, M(Valor EUR)->AX
  - ATENCION: los headers de la fila 3 de `Inicio (anterior 2026-08-18)` NO confirman el mapeo (4 de 12 discrepan: J='Valor ARS' vs destino AU='Ars'; K='Valor USD' vs destino AV='Usd'; L='Valor AUD' vs destino AW='Aud'; M='Valor EUR' vs destino AX='Eur'). El bloque queda SIN confirmar.
- `Y4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     'Registros (anterior 2026-08-18)'!B5:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin
  ```
  - Fuente del QUERY (primer argumento): `Registros (anterior 2026-08-18)!B5:M` (12 columnas, headers leidos de la fila 5 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `Y4:AJ` (espeja `Registros (anterior 2026-08-18)!B5:M`, columnas proyectadas B, C, D, E, F, G, H, I, J, K, L, M).
  - Mapeo columnas: B(Monto)->Y, C(Tipo)->Z, D(Cuenta)->AA, E(Tipo de Cuenta)->AB, F(Medio)->AC, G(Moneda)->AD, H(Fecha)->AE, I(Nota)->AF, J(Valor ARS)->AG, K(Valor USD)->AH, L(Valor AUD)->AI, M(Valor EUR)->AJ
  - ATENCION: los headers de la fila 3 de `Inicio (anterior 2026-08-18)` NO confirman el mapeo (4 de 12 discrepan: J='Valor ARS' vs destino AG='Ars'; K='Valor USD' vs destino AH='Usd'; L='Valor AUD' vs destino AI='Aud'; M='Valor EUR' vs destino AJ='Eur'). El bloque queda SIN confirmar.
- `I10`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AA4:AA \      IF(Z4:Z="Egreso"; -AK4:AK; AK4:AK) \      AB4:AB \      IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE Col3 = 'Ingreso'  
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AA4:AA \ IF(Z4:Z="Egreso"; -AK4:AK; AK4:AK) \ AB4:AB \ IFERROR(VL...`).
- `L10`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AA4:AA \      IF(Z4:Z="Ingreso"; -AK4:AK; AK4:AK) \      AB4:AB \      IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE (Col3 = 'Gasto Fi
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AA4:AA \ IF(Z4:Z="Ingreso"; -AK4:AK; AK4:AK) \ AB4:AB \ IFERROR(V...`).

**Patrones de formulas (16 formulas, 15 patrones unicos; top 20):**

- **2x** en [D692, D693] — ejemplo `D692`:
  ```
  =IF(#REF!<0,5; "#a9bca1"; IF(#REF!<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [AK3] — ejemplo `AK3`:
  ```
  ="Valor en " & P9
  ```
- **1x** en [AY3] — ejemplo `AY3`:
  ```
  ="Valor en " & AD9
  ```
- **1x** en [Y4] — ejemplo `Y4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     'Registros (anterior 2026-08-18)'!B5:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin
  ```
- **1x** en [AK4] — ejemplo `AK4`:
  ```
  =ARRAYFORMULA(   IF(Y4:Y=""; "";     LET(       tasa_origen; IF(AA4:AA="ARS"; AG4:AG; IF(AA4:AA="USD"; AH4:AH; IF(AA4:AA="AUD"; AI4:AI; IF(AA4:AA="EUR"; AJ4:AJ; 1))));       tasa_destino; IF(P9="ARS"; AG4:AG; IF(P9="USD"; AH4:AH; IF(P9="AUD"; AI4:AI; IF(P9="EUR"; AJ4:AJ; 1))));       IFERROR((Y4:Y * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [AM4] — ejemplo `AM4`:
  ```
  =LET(   mes_num; MATCH(P4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(P6; mes_num - 1; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(P6; mes_num - 1; 1); 0); "yyyy-mm-dd");   QUERY(     'Registros (anterior 2026-08-18)'!B5:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & f
  ```
- **1x** en [AY4] — ejemplo `AY4`:
  ```
  =ARRAYFORMULA(   IF(AM4:AM=""; "";     LET(       tasa_origen; IF(AO4:AO="ARS"; AU4:AU; IF(AO4:AO="USD"; AV4:AV; IF(AO4:AO="AUD"; AW4:AW; IF(AO4:AO="EUR"; AX4:AX; 1))));       tasa_destino; IF(AD9="ARS"; AU4:AU; IF(AD9="USD"; AV4:AV; IF(AD9="AUD"; AW4:AW; IF(AD9="EUR"; AX4:AX; 1))));       IFERROR((AM4:AM * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [I6] — ejemplo `I6`:
  ```
  =LET(   moneda_filtro; $P$9;      monto_neto; ARRAYFORMULA(IF(Z4:Z="Egreso"; -Y4:Y; Y4:Y));   cond_liquidez; ARRAYFORMULA(IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "")="Medio Cotidiano");      suma_ars; SUM(IFERROR(FILTER(monto_neto; AD4:AD="ARS"; cond_liquidez); 0));   suma_usd; SUM(IFERROR(FILTER(monto_neto; AD4:AD="USD"; cond_liquidez); 0));   suma_aud; SUM(IFE
  ```
- **1x** en [L6] — ejemplo `L6`:
  ```
  =LET(   moneda_filtro; $P$9;      monto_neto; ARRAYFORMULA(IF(Z4:Z="Egreso"; -Y4:Y; Y4:Y));      proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); ""));      cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);    
  ```
- **1x** en [I10] — ejemplo `I10`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AA4:AA \      IF(Z4:Z="Egreso"; -AK4:AK; AK4:AK) \      AB4:AB \      IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE Col3 = 'Ingreso'  
  ```
- **1x** en [L10] — ejemplo `L10`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AA4:AA \      IF(Z4:Z="Ingreso"; -AK4:AK; AK4:AK) \      AB4:AB \      IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AC4:AC; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE (Col3 = 'Gasto Fi
  ```
- **1x** en [I12] — ejemplo `I12`:
  ```
  =LET(   monto_act; AK4:AK; tipo_act; Z4:Z; cuenta_act; AA4:AA; cat_act; AB4:AB; medio_act; AC4:AC;   monto_ant; AY4:AY; tipo_ant; AN4:AN; cuenta_ant; AO4:AO; cat_ant; AP4:AP; medio_ant; AQ4:AQ;      monto_neto_act; ARRAYFORMULA(IF(tipo_act="Egreso"; -monto_act; monto_act));   monto_neto_ant; ARRAYFORMULA(IF(tipo_ant="Egreso"; -monto_ant; monto_ant));      proy_act; ARRAYFORMULA(IFERROR(VLOOKUP(med
  ```
- **1x** en [L12] — ejemplo `L12`:
  ```
  =LET(   monto_act; AK4:AK; tipo_act; Z4:Z; cuenta_act; AA4:AA; cat_act; AB4:AB; medio_act; AC4:AC;   monto_ant; AY4:AY; tipo_ant; AN4:AN; cuenta_ant; AO4:AO; cat_ant; AP4:AP; medio_ant; AQ4:AQ;      monto_neto_act; ARRAYFORMULA(IF(tipo_act="Ingreso"; -monto_act; monto_act));   monto_neto_ant; ARRAYFORMULA(IF(tipo_ant="Ingreso"; -monto_ant; monto_ant));      proy_act; ARRAYFORMULA(IFERROR(VLOOKUP(m
  ```
- **1x** en [P13] — ejemplo `P13`:
  ```
  =SEQUENCE(6; 7; DATEVALUE(P4 & " 1 " & P6) - WEEKDAY(DATEVALUE(P4 & " 1 " & P6); 1) + 1)
  ```
- **1x** en [D694] — ejemplo `D694`:
  ```
  =IF(#REF!<0,5; "#da8b7b"; IF(#REF!<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Cuarentena Plan (2026-08-18)

- Dimensiones: 1911 filas x 14 columnas (OCULTA). Celdas con dato: 21081.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 7 (6 celdas de texto, 0 en negrita): D=Egreso | E=Medicamentos / Higiene | F=Gasto Variable | G=NaranjaX | H=ARS | J=Reparo lentes
- Fila 8 (5 celdas de texto, 0 en negrita): D=Ingreso | E=Intereses bancos | F=Ingreso | G=NaranjaX | H=ARS
- Fila 9 (5 celdas de texto, 0 en negrita): D=Ingreso | E=Intereses bancos | F=Ingreso | G=NaranjaX | H=ARS
- Fila 10 (6 celdas de texto, 0 en negrita): D=Ingreso | E=Traspaso | F=Ingreso | G=Frascos Naranja X | H=ARS | J=Carry trade. Dólares actuales: 151,22. Dólares estimados: 155,51

### Inicio

- Dimensiones: 124 filas x 46 columnas (visible). Celdas con dato: 2867.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (3 celdas de texto, 2 en negrita): C=Inicio. | F=Período de Análisis | G=Junio
- Fila 4 (3 celdas de texto, 2 en negrita): C=Aquí tienes un resumen de tu situación financiera actual. | F=Moneda | G=ARS
- Fila 7 (29 celdas de texto, 29 en negrita): C=Saldo Actual. | F=Capital Acumulado. | J=Calendario. | T=Monto | U=Tipo | V=Cuenta | W=Tipo de Cuenta | X=Medio | Y=Moneda | Z=Fecha | AA=Nota | AB=Ars | AC=Usd | AD=Aud | AE=Eur | AF=Valor en ARS | AH=Monto | AI=Tipo | AJ=Cuenta | AK=Tipo de Cuenta | AL=Medio | AM=Moneda | AN=Fecha | AO=Nota | AP=Ars | AQ=Usd | AR=Aud | AS=Eur | AT=Valor en ARS
- Fila 8 (15 celdas de texto, 7 en negrita): J=D | K=L | L=M | M=M | N=J | O=V | P=S | U=Egreso | X=Efectivo | Y=ARS | AI=Egreso | AJ=Juntadas | AK=Gasto Variable | AL=NaranjaX | AM=ARS
- Fila 9 (10 celdas de texto, 0 en negrita): U=Ingreso | V=Intereses bancos | W=Ingreso | X=NaranjaX | Y=ARS | AI=Ingreso | AJ=Intereses bancos | AK=Ingreso | AL=NaranjaX | AM=ARS
- Fila 10 (13 celdas de texto, 0 en negrita): F=0% de Crecimiento histórico | U=Egreso | V=Trabajo | W=Gasto Variable | X=NaranjaX | Y=ARS | AA=almuerzo | AI=Ingreso | AJ=Comidas | AK=Gasto Variable | AL=NaranjaX | AM=ARS | AO=manitos cashback

**Llamadas QUERY (staging de datos):**

- `AH8`:
  ```
  =LET(   mes_num; MATCH(G2; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(G3; mes_num - 1; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(G3; mes_num - 1; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!B6:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   
  ```
  - Fuente del QUERY (primer argumento): `Registros!B6:M` (12 columnas, headers leidos de la fila 6 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `AH8:AS` (espeja `Registros!B6:M`, columnas proyectadas B, C, D, E, F, G, H, I, J, K, L, M).
  - Mapeo columnas: B(Monto)->AH, C(Tipo)->AI, D(Cuenta)->AJ, E(Tipo de Cuenta)->AK, F(Medio)->AL, G(Moneda)->AM, H(Fecha)->AN, I(Nota)->AO, J(Valor ARS)->AP, K(Valor USD)->AQ, L(Valor AUD)->AR, M(Valor EUR)->AS
  - ATENCION: los headers de la fila 7 de `Inicio` NO confirman el mapeo (4 de 12 discrepan: J='Valor ARS' vs destino AP='Ars'; K='Valor USD' vs destino AQ='Usd'; L='Valor AUD' vs destino AR='Aud'; M='Valor EUR' vs destino AS='Eur'). El bloque queda SIN confirmar.
- `T8`:
  ```
  =LET(   mes_num; MATCH(G2; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(G3; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(G3; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!B6:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
  - Fuente del QUERY (primer argumento): `Registros!B6:M` (12 columnas, headers leidos de la fila 6 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `T8:AE` (espeja `Registros!B6:M`, columnas proyectadas B, C, D, E, F, G, H, I, J, K, L, M).
  - Mapeo columnas: B(Monto)->T, C(Tipo)->U, D(Cuenta)->V, E(Tipo de Cuenta)->W, F(Medio)->X, G(Moneda)->Y, H(Fecha)->Z, I(Nota)->AA, J(Valor ARS)->AB, K(Valor USD)->AC, L(Valor AUD)->AD, M(Valor EUR)->AE
  - ATENCION: los headers de la fila 7 de `Inicio` NO confirman el mapeo (4 de 12 discrepan: J='Valor ARS' vs destino AB='Ars'; K='Valor USD' vs destino AC='Usd'; L='Valor AUD' vs destino AD='Aud'; M='Valor EUR' vs destino AE='Eur'). El bloque queda SIN confirmar.
- `C13`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     V8:V \      IF(U8:U="Egreso"; -AF8:AF; AF8:AF) \      W8:W \      IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE Col3 = 'Ingreso'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL     AND (Col1 != 'Inici
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ V8:V \ IF(U8:U="Egreso"; -AF8:AF; AF8:AF) \ W8:W \ IFERROR(VLOOKU...`).
- `F13`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     V8:V \      IF(U8:U="Ingreso"; -AF8:AF; AF8:AF) \      W8:W \      IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE (Col3 = 'Gasto Fijo' OR Col3 = 'Gasto Variable')     AND Col1 != 'Traspaso'     AND Col1 IS
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ V8:V \ IF(U8:U="Ingreso"; -AF8:AF; AF8:AF) \ W8:W \ IFERROR(VLOOK...`).

**Patrones de formulas (13 formulas, 13 patrones unicos; top 20):**

- **1x** en [AF7] — ejemplo `AF7`:
  ```
  ="Valor en " & G4
  ```
- **1x** en [AT7] — ejemplo `AT7`:
  ```
  ="Valor en " & Y13
  ```
- **1x** en [C8] — ejemplo `C8`:
  ```
  =LET(   moneda_filtro; $G$4;      monto_neto; ARRAYFORMULA(IF(U8:U="Egreso"; -T8:T; T8:T));   cond_liquidez; ARRAYFORMULA(IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); "")="Medio Cotidiano");      suma_ars; SUM(IFERROR(FILTER(monto_neto; Y8:Y="ARS"; cond_liquidez); 0));   suma_usd; SUM(IFERROR(FILTER(monto_neto; Y8:Y="USD"; cond_liquidez); 0));   suma_aud; SUM(IFERROR(FILTER(monto_neto; Y8:Y
  ```
- **1x** en [F8] — ejemplo `F8`:
  ```
  =LET(   moneda_filtro; $G$4;      monto_neto; ARRAYFORMULA(IF(U8:U="Egreso"; -T8:T; T8:T));      proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas'!P:Q; 2; 0); ""));      cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      suma_ars; SUM(IFERROR(FILTER(monto_neto; Y8:
  ```
- **1x** en [T8] — ejemplo `T8`:
  ```
  =LET(   mes_num; MATCH(G2; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(G3; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(G3; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!B6:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
- **1x** en [AF8] — ejemplo `AF8`:
  ```
  =ARRAYFORMULA(   IF(T8:T=""; "";     LET(       tasa_origen; IF(V8:V="ARS"; AB8:AB; IF(V8:V="USD"; AC8:AC; IF(V8:V="AUD"; AD8:AD; IF(V8:V="EUR"; AE8:AE; 1))));       tasa_destino; IF(G4="ARS"; AB8:AB; IF(G4="USD"; AC8:AC; IF(G4="AUD"; AD8:AD; IF(G4="EUR"; AE8:AE; 1))));       IFERROR((T8:T * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [AH8] — ejemplo `AH8`:
  ```
  =LET(   mes_num; MATCH(G2; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(G3; mes_num - 1; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(G3; mes_num - 1; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!B6:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   
  ```
- **1x** en [AT8] — ejemplo `AT8`:
  ```
  =ARRAYFORMULA(   IF(AH8:AH=""; "";     LET(       tasa_origen; IF(AJ8:AJ="ARS"; AP8:AP; IF(AJ8:AJ="USD"; AQ8:AQ; IF(AJ8:AJ="AUD"; AR8:AR; IF(AJ8:AJ="EUR"; AS8:AS; 1))));       tasa_destino; IF(Y13="ARS"; AP8:AP; IF(Y13="USD"; AQ8:AQ; IF(Y13="AUD"; AR8:AR; IF(Y13="EUR"; AS8:AS; 1))));       IFERROR((AH8:AH * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [J9] — ejemplo `J9`:
  ```
  =SEQUENCE(6; 7; DATEVALUE(G2 & " 1 " & G3) - WEEKDAY(DATEVALUE(G2 & " 1 " & G3); 1) + 1)
  ```
- **1x** en [C13] — ejemplo `C13`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     V8:V \      IF(U8:U="Egreso"; -AF8:AF; AF8:AF) \      W8:W \      IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE Col3 = 'Ingreso'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL     AND (Col1 != 'Inici
  ```
- **1x** en [F13] — ejemplo `F13`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     V8:V \      IF(U8:U="Ingreso"; -AF8:AF; AF8:AF) \      W8:W \      IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(X8:X; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT SUM(Col2)     WHERE (Col3 = 'Gasto Fijo' OR Col3 = 'Gasto Variable')     AND Col1 != 'Traspaso'     AND Col1 IS
  ```
- **1x** en [C15] — ejemplo `C15`:
  ```
  =LET(   monto_act; AF8:AF; tipo_act; U8:U; cuenta_act; V8:V; cat_act; W8:W; medio_act; X8:X;   monto_ant; AT8:AT; tipo_ant; AI8:AI; cuenta_ant; AJ8:AJ; cat_ant; AK8:AK; medio_ant; AL8:AL;      monto_neto_act; ARRAYFORMULA(IF(tipo_act="Egreso"; -monto_act; monto_act));   monto_neto_ant; ARRAYFORMULA(IF(tipo_ant="Egreso"; -monto_ant; monto_ant));      proy_act; ARRAYFORMULA(IFERROR(VLOOKUP(medio_act
  ```
- **1x** en [F15] — ejemplo `F15`:
  ```
  =LET(   monto_act; AF8:AF; tipo_act; U8:U; cuenta_act; V8:V; cat_act; W8:W; medio_act; X8:X;   monto_ant; AT8:AT; tipo_ant; AI8:AI; cuenta_ant; AJ8:AJ; cat_ant; AK8:AK; medio_ant; AL8:AL;      monto_neto_act; ARRAYFORMULA(IF(tipo_act="Ingreso"; -monto_act; monto_act));   monto_neto_ant; ARRAYFORMULA(IF(tipo_ant="Ingreso"; -monto_ant; monto_ant));      proy_act; ARRAYFORMULA(IFERROR(VLOOKUP(medio_a
  ```

### Tablero (anterior 2026-08-18)

- Dimensiones: 708 filas x 52 columnas (OCULTA). Celdas con dato: 1025.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (7 celdas de texto, 7 en negrita): I=Período de Análisis | Q=Saldos Actuales. | W=Ingresos. | Z=Gastos Fijos. | AC=Gastos Variables. | AF=Medios Bancarios. | AJ=Cotizaciones Monedas.
- Fila 3 (27 celdas de texto, 27 en negrita): Q=Moneda | S=Liquidez | U=Riqueza | W=Cuenta | X=Monto | Z=Cuenta | AA=Monto | AC=Cuenta | AD=Monto | AF=Medio | AG=Moneda | AH=Monto | AJ=Moneda | AL=Cotización | AN=Monto | AO=Tipo | AP=Cuenta | AQ=Tipo de Cuenta | AR=Medio | AS=Moneda | AT=Fecha | AU=Nota | AV=Ars | AW=Usd | AX=Aud | AY=Eur | AZ=Valor en ARS
- Fila 4 (13 celdas de texto, 0 en negrita): I=Agosto | Q=ARS | W=umoh | Z=Pago Tarjeta | AC=Comidas | AF=Frascos Nx - Préstamo | AG=ARS | AJ=USD | AO=Egreso | AP=Trabajo | AQ=Gasto Variable | AR=NaranjaX | AS=ARS
- Fila 5 (13 celdas de texto, 0 en negrita): Q=USD | W=Tidetrack | Z=Prepaga | AC=Computación | AF=Efectivo | AG=ARS | AJ=AUD | AO=Egreso | AP=Salidas | AQ=Gasto Variable | AR=Efectivo | AS=ARS | AU=Plata prestada
- Fila 6 (13 celdas de texto, 0 en negrita): Q=AUD | W=Ingresos Extra | Z=Pago Tarjeta MP | AC=Entretenimiento | AF=NaranjaX | AG=ARS | AJ=EUR | AO=Egreso | AP=Comidas | AQ=Gasto Variable | AR=Efectivo | AS=ARS | AU=Brunch Guada
- Fila 7 (12 celdas de texto, 0 en negrita): Q=EUR | W=Intereses bancos | Z=Auto | AC=Trabajo | AF=Frasco Transitorio NaranjaX | AG=ARS | AO=Egreso | AP=Computación | AQ=Gasto Variable | AR=Efectivo | AS=ARS | AU=Cargador
- Fila 8 (10 celdas de texto, 2 en negrita): I=Moneda | AC=Salidas | AF=Mercado Pago | AG=ARS | AJ=Proyectos. | AO=Ingreso | AP=Intereses bancos | AQ=Ingreso | AR=Mercado Pago | AS=ARS
- Fila 9 (10 celdas de texto, 2 en negrita): I=ARS | AC=Regalos | AF=YPF - wallet | AG=ARS | AJ=Proyecto | AL=Monto | AO=Egreso | AP=Traspaso | AR=Efectivo | AS=ARS
- Fila 10 (8 celdas de texto, 0 en negrita): AC=Medicamentos / Accesorios | AF=Dolar Cash | AG=USD | AJ=Préstamo Mac | AO=Ingreso | AP=Traspaso | AR=Mercado Pago | AS=ARS

**Llamadas QUERY (staging de datos):**

- `AC4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'G
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AP4:AP \ IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \ AQ4:AQ \ IFERROR...`).
- `AF4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({AR4:AR \ AS4:AS \ IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)});   "SELECT Col1, Col2, SUM(Col3)     WHERE Col1 IS NOT NULL AND Col1 <> ''     GROUP BY Col1, Col2     ORDER BY SUM(Col3) DESC     LABEL Col1 '', Col2 '', SUM(Col3) ''";   0 ); {"" \ "" \ ""})
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({AR4:AR \ AS4:AS \ IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)})`).
- `AN4`:
  ```
  =LET(   mes_num; MATCH(I4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(I6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(I6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     'Registros (anterior 2026-08-18)'!B5:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin
  ```
  - Fuente del QUERY (primer argumento): `Registros (anterior 2026-08-18)!B5:M` (12 columnas, headers leidos de la fila 5 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `AN4:AY` (espeja `Registros (anterior 2026-08-18)!B5:M`, columnas proyectadas B, C, D, E, F, G, H, I, J, K, L, M).
  - Mapeo columnas: B(Monto)->AN, C(Tipo)->AO, D(Cuenta)->AP, E(Tipo de Cuenta)->AQ, F(Medio)->AR, G(Moneda)->AS, H(Fecha)->AT, I(Nota)->AU, J(Valor ARS)->AV, K(Valor USD)->AW, L(Valor AUD)->AX, M(Valor EUR)->AY
  - ATENCION: los headers de la fila 3 de `Tablero (anterior 2026-08-18)` NO confirman el mapeo (4 de 12 discrepan: J='Valor ARS' vs destino AV='Ars'; K='Valor USD' vs destino AW='Usd'; L='Valor AUD' vs destino AX='Aud'; M='Valor EUR' vs destino AY='Eur'). El bloque queda SIN confirmar.
- `W4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'In
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AP4:AP \ IF(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \ AQ4:AQ \ IFERROR(...`).
- `Z4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'G
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AP4:AP \ IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \ AQ4:AQ \ IFERROR...`).
- `AJ10`:
  ```
  =LET(   medio; AR4:AR;   moneda; AS4:AS;      monto_neto; ARRAYFORMULA(IF(AN4:AN=""; 0; IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)));      proyecto; ARRAYFORMULA(IFERROR(VLOOKUP(medio; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""));   tipo_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyecto; 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); ""));      tasa_origen; ARRAYFORMULA(IF(moneda="USD"; $AL$4
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `{proy_filtrado \ monto_filtrado}`).

**Patrones de formulas (38 formulas, 36 patrones unicos; top 20):**

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
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)); AS4:AS="ARS"; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [U4] — ejemplo `U4`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto
  ```
- **1x** en [W4] — ejemplo `W4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Egreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'In
  ```
- **1x** en [Z4] — ejemplo `Z4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'G
  ```
- **1x** en [AC4] — ejemplo `AC4`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AP4:AP \      IF(AO4:AO="Ingreso"; -AZ4:AZ; AZ4:AZ) \      AQ4:AQ \      IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""); 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'G
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
  =LET(   mes_num; MATCH(I4; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(I6; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(I6; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     'Registros (anterior 2026-08-18)'!B5:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin
  ```
- **1x** en [AZ4] — ejemplo `AZ4`:
  ```
  =ARRAYFORMULA(   IF(AN4:AN=""; "";     LET(       tasa_origen; IF(AS4:AS="ARS"; AV4:AV; IF(AS4:AS="USD"; AW4:AW; IF(AS4:AS="AUD"; AX4:AX; IF(AS4:AS="EUR"; AY4:AY; 1))));       tasa_destino; IF(I9="ARS"; AV4:AV; IF(I9="USD"; AW4:AW; IF(I9="AUD"; AX4:AX; IF(I9="EUR"; AY4:AY; 1))));       IFERROR((AN4:AN * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [S5] — ejemplo `S5`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)); AS4:AS="USD"; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [U5] — ejemplo `U5`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto
  ```
- **1x** en [AL5] — ejemplo `AL5`:
  ```
  =TIDETRACK_AUD()
  ```
- **1x** en [S6] — ejemplo `S6`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN)); AS4:AS="AUD"; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [U6] — ejemplo `U6`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AO4:AO="Egreso"; -AN4:AN; AN4:AN));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AR4:AR; 'Plan de Cuentas (anterior 2026-08-18)'!R:T; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas (anterior 2026-08-18)'!V:W; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto
  ```

### Tablero

- Dimensiones: 84 filas x 48 columnas (visible). Celdas con dato: 1174.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (4 celdas de texto, 3 en negrita): C=Vista financiera Mensual. | L=Período de Análisis | N=Enero | AJ=Registros del Mes.
- Fila 4 (15 celdas de texto, 14 en negrita): L=Moneda | N=ARS | AJ=Monto | AK=Tipo | AL=Cuenta | AM=Tipo de Cuenta | AN=Medio | AO=Moneda | AP=Fecha | AQ=Nota | AR=Ars | AS=Usd | AT=Aud | AU=Eur | AV=Valor en ARS
- Fila 6 (5 celdas de texto, 0 en negrita): AK=Egreso | AL=Nafta | AM=Gasto Fijo | AN=NaranjaX | AO=ARS
- Fila 7 (12 celdas de texto, 7 en negrita): C=Calendario. | L=Presupuesto Asignado. | R=Ingresos. | U=Gastos Fijos. | X=Gastos Variables. | AA=Proyectos. | AE=Saldos Actuales. | AK=Egreso | AL=Juntadas | AM=Gasto Variable | AN=NaranjaX | AO=ARS
- Fila 8 (27 celdas de texto, 22 en negrita): C=D | D=L | E=M | F=M | G=J | H=V | I=S | L=Categoría | N=Presupuesto | O=% | R=Cuenta | S=Monto | U=Cuenta | V=Monto | X=Cuenta | Y=Monto | AA=Categorías | AB=Tipo | AC=Monto | AE=Moneda | AF=Flujo | AG=Capital | AK=Ingreso | AL=Intereses bancos | AM=Ingreso | AN=NaranjaX | AO=ARS
- Fila 9 (10 celdas de texto, 0 en negrita): L=Ingresos | R=Ingreso Asesor | U=Auto | X=Comidas | AE=ARS | AK=Ingreso | AL=Intereses bancos | AM=Ingreso | AN=NaranjaX | AO=ARS
- Fila 10 (10 celdas de texto, 0 en negrita): L=Gastos Fijos | R=Ingresos Extra | U=Linea telefónica | X=Compra USD | AE=USD | AK=Ingreso | AL=Intereses bancos | AM=Ingreso | AN=NaranjaX | AO=ARS

**Llamadas QUERY (staging de datos):**

- `AJ6`:
  ```
  =LET(   mes_num; MATCH(N2; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(N3; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(N3; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!B6:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
  - Fuente del QUERY (primer argumento): `Registros!B6:M` (12 columnas, headers leidos de la fila 6 de la fuente).
  - Proyeccion: SELECT * (todas las columnas de la fuente) — 12 columnas.
  - Nota: la cadena de la consulta se arma por concatenacion. Los tramos dinamicos caen dentro de literales de datos (entre comillas simples), asi que no pueden alterar las clausulas ni la proyeccion.
  - Staging: `AJ6:AU` (espeja `Registros!B6:M`, columnas proyectadas B, C, D, E, F, G, H, I, J, K, L, M).
  - Mapeo columnas: B(Monto)->AJ, C(Tipo)->AK, D(Cuenta)->AL, E(Tipo de Cuenta)->AM, F(Medio)->AN, G(Moneda)->AO, H(Fecha)->AP, I(Nota)->AQ, J(Valor ARS)->AR, K(Valor USD)->AS, L(Valor AUD)->AT, M(Valor EUR)->AU
  - Verificacion: la fila 5 de `Tablero` no tiene headers en el snapshot, asi que el mapeo no se pudo contrastar.
- `AA9`:
  ```
  =LET(   medio; AN9:AN;   moneda; AO9:AO;      monto_neto; ARRAYFORMULA(IF(AJ6:AJ=""; 0; IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)));      proyecto; ARRAYFORMULA(IFERROR(VLOOKUP(medio; 'Plan de Cuentas'!L:N; 3; 0); ""));   tipo_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyecto; 'Plan de Cuentas'!P:Q; 2; 0); ""));      tasa_origen; ARRAYFORMULA(IF(moneda="USD"; $AF$17; IF(moneda="AUD"; $AF$18; IF(moneda="EUR";
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `{proy_filtrado \ monto_filtrado}`).
- `R9`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AL9:AL \      IF(AK9:AK="Egreso"; -AV6:AV; AV6:AV) \      AM9:AM \      IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Ingreso'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL     AND
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AL9:AL \ IF(AK9:AK="Egreso"; -AV6:AV; AV6:AV) \ AM9:AM \ IFERROR(...`).
- `U9`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AL9:AL \      IF(AK9:AK="Ingreso"; -AV6:AV; AV6:AV) \      AM9:AM \      IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Fijo'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL    
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AL9:AL \ IF(AK9:AK="Ingreso"; -AV6:AV; AV6:AV) \ AM9:AM \ IFERROR...`).
- `X9`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AL9:AL \      IF(AK9:AK="Ingreso"; -AV6:AV; AV6:AV) \      AM9:AM \      IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Variable'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({ AL9:AL \ IF(AK9:AK="Ingreso"; -AV6:AV; AV6:AV) \ AM9:AM \ IFERROR...`).
- `C18`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({AN9:AN \ AO9:AO \ IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)});   "SELECT Col1, Col2, SUM(Col3)     WHERE Col1 IS NOT NULL AND Col1 <> ''     GROUP BY Col1, Col2     ORDER BY SUM(Col3) DESC     LABEL Col1 '', Col2 '', SUM(Col3) ''";   0 ); {"" \ "" \ ""})
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `ARRAYFORMULA({AN9:AN \ AO9:AO \ IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)})`).

**Patrones de formulas (43 formulas, 36 patrones unicos; top 20):**

- **6x** en [O10, O11, O12, O17, O18, O19] — ejemplo `O10`:
  ```
  =IFERROR(N10/$N$9;0)
  ```
- **2x** en [O9, O16] — ejemplo `O9`:
  ```
  =SUM(O10:O12)
  ```
- **2x** en [N24, N25] — ejemplo `N24`:
  ```
  =IFERROR(#REF! / N10; 0)
  ```
- **1x** en [AV4] — ejemplo `AV4`:
  ```
  ="Valor en " & N4
  ```
- **1x** en [AJ6] — ejemplo `AJ6`:
  ```
  =LET(   mes_num; MATCH(N2; SPLIT("Enero,Febrero,Marzo,Abril,Mayo,Junio,Julio,Agosto,Septiembre,Octubre,Noviembre,Diciembre"; ","); 0);   fecha_inicio; TEXT(DATE(N3; mes_num; 1); "yyyy-mm-dd");   fecha_fin; TEXT(EOMONTH(DATE(N3; mes_num; 1); 0); "yyyy-mm-dd");   QUERY(     Registros!B6:M;     "SELECT * WHERE Col7 >= date '" & fecha_inicio & "' AND Col7 <= date '" & fecha_fin & "'";     0   ) )
  ```
- **1x** en [AV6] — ejemplo `AV6`:
  ```
  =ARRAYFORMULA(   IF(AJ6:AJ=""; "";     LET(       tasa_origen; IF(AO9:AO="ARS"; AR9:AR; IF(AO9:AO="USD"; AS9:AS; IF(AO9:AO="AUD"; AT9:AT; IF(AO9:AO="EUR"; AU9:AU; 1))));       tasa_destino; IF(#REF!="ARS"; AR9:AR; IF(#REF!="USD"; AS9:AS; IF(#REF!="AUD"; AT9:AT; IF(#REF!="EUR"; AU9:AU; 1))));       IFERROR((AJ6:AJ * tasa_origen) / tasa_destino; 0)     )   ) )
  ```
- **1x** en [S7] — ejemplo `S7`:
  ```
  =SUM(S9:S27)
  ```
- **1x** en [V7] — ejemplo `V7`:
  ```
  =SUM(V9:V27)
  ```
- **1x** en [Y7] — ejemplo `Y7`:
  ```
  =SUM(Y9:Y27)
  ```
- **1x** en [C9] — ejemplo `C9`:
  ```
  =SEQUENCE(6; 7; DATEVALUE(N2 & " 1 " & N3) - WEEKDAY(DATEVALUE(N2 & " 1 " & N3); 1) + 1)
  ```
- **1x** en [R9] — ejemplo `R9`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AL9:AL \      IF(AK9:AK="Egreso"; -AV6:AV; AV6:AV) \      AM9:AM \      IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Ingreso'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL     AND
  ```
- **1x** en [U9] — ejemplo `U9`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AL9:AL \      IF(AK9:AK="Ingreso"; -AV6:AV; AV6:AV) \      AM9:AM \      IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Fijo'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL    
  ```
- **1x** en [X9] — ejemplo `X9`:
  ```
  =IFERROR(QUERY(   ARRAYFORMULA({     AL9:AL \      IF(AK9:AK="Ingreso"; -AV6:AV; AV6:AV) \      AM9:AM \      IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); "") \     IFERROR(VLOOKUP(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""); 'Plan de Cuentas'!P:Q; 2; 0); "")   });   "SELECT Col1, SUM(Col2)     WHERE Col3 = 'Gasto Variable'     AND Col1 != 'Traspaso'     AND Col1 IS NOT NULL
  ```
- **1x** en [AA9] — ejemplo `AA9`:
  ```
  =LET(   medio; AN9:AN;   moneda; AO9:AO;      monto_neto; ARRAYFORMULA(IF(AJ6:AJ=""; 0; IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)));      proyecto; ARRAYFORMULA(IFERROR(VLOOKUP(medio; 'Plan de Cuentas'!L:N; 3; 0); ""));   tipo_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyecto; 'Plan de Cuentas'!P:Q; 2; 0); ""));      tasa_origen; ARRAYFORMULA(IF(moneda="USD"; $AF$17; IF(moneda="AUD"; $AF$18; IF(moneda="EUR";
  ```
- **1x** en [AF9] — ejemplo `AF9`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)); AO9:AO="ARS"; ARRAYFORMULA(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [AG9] — ejemplo `AG9`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas'!P:Q; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto_neto; AO9:AO="ARS"; cond_riqueza); 0)) )
  ```
- **1x** en [AF10] — ejemplo `AF10`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)); AO9:AO="USD"; ARRAYFORMULA(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [AG10] — ejemplo `AG10`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas'!P:Q; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto_neto; AO9:AO="USD"; cond_riqueza); 0)) )
  ```
- **1x** en [AF11] — ejemplo `AF11`:
  ```
  =SUM(IFERROR(FILTER(ARRAYFORMULA(IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ)); AO9:AO="AUD"; ARRAYFORMULA(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""))="Medio Cotidiano"); 0))
  ```
- **1x** en [AG11] — ejemplo `AG11`:
  ```
  =LET(   monto_neto; ARRAYFORMULA(IF(AK9:AK="Egreso"; -AJ6:AJ; AJ6:AJ));   proyectos; ARRAYFORMULA(IFERROR(VLOOKUP(AN9:AN; 'Plan de Cuentas'!L:N; 3; 0); ""));   tipos_proy; ARRAYFORMULA(IFERROR(VLOOKUP(proyectos; 'Plan de Cuentas'!P:Q; 2; 0); ""));   cond_riqueza; ARRAYFORMULA((tipos_proy<>"Liquidez") * (tipos_proy<>"") > 0);      SUM(IFERROR(FILTER(monto_neto; AO9:AO="AUD"; cond_riqueza); 0)) )
  ```

### Presupuesto

- Dimensiones: 19 filas x 24 columnas (visible). Celdas con dato: 63.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (3 celdas de texto, 2 en negrita): C=Presupuesto financiero del Mes. | I=Período a Presupuestar | J=Enero
- Fila 7 (13 celdas de texto, 13 en negrita): C=Movimientos Promedio históricos. | I=Ingresos. | J=Monto 
Histórico | K=Monto Presupuestado | M=Gastos Fijos. | N=Monto 
Histórico | O=Monto Presupuestado | Q=Gastos Variables. | R=Monto 
Histórico | S=Monto Presupuestado | U=Categorías. | W=Monto 
Histórico | X=Monto Presupuestado
- Fila 8 (8 celdas de texto, 8 en negrita): C=Categoría | E=Presupuesto | F=% | I=Cuenta | M=Cuenta | Q=Cuenta | U=Nombre | V=Tipo

**Patrones de formulas (24 formulas, 18 patrones unicos; top 20):**

- **6x** en [F10, F11, F12, F17, F18, F19] — ejemplo `F10`:
  ```
  =IFERROR(E10/$E$9;0)
  ```
- **2x** en [F9, F16] — ejemplo `F9`:
  ```
  =SUM(F10:F12)
  ```
- **1x** en [J8] — ejemplo `J8`:
  ```
  =SUM(J9:J)
  ```
- **1x** en [K8] — ejemplo `K8`:
  ```
  =SUM(K9:K)
  ```
- **1x** en [N8] — ejemplo `N8`:
  ```
  =SUM(N9:N)
  ```
- **1x** en [O8] — ejemplo `O8`:
  ```
  =SUM(O9:O)
  ```
- **1x** en [R8] — ejemplo `R8`:
  ```
  =SUM(R9:R)
  ```
- **1x** en [S8] — ejemplo `S8`:
  ```
  =SUM(S9:S)
  ```
- **1x** en [W8] — ejemplo `W8`:
  ```
  =SUM(W9:W)
  ```
- **1x** en [X8] — ejemplo `X8`:
  ```
  =SUM(X9:X)
  ```
- **1x** en [E9] — ejemplo `E9`:
  ```
  =J8
  ```
- **1x** en [E10] — ejemplo `E10`:
  ```
  =N8
  ```
- **1x** en [E11] — ejemplo `E11`:
  ```
  =R8
  ```
- **1x** en [E12] — ejemplo `E12`:
  ```
  =W8
  ```
- **1x** en [E16] — ejemplo `E16`:
  ```
  =K8
  ```
- **1x** en [E17] — ejemplo `E17`:
  ```
  =O8
  ```
- **1x** en [E18] — ejemplo `E18`:
  ```
  =S8
  ```
- **1x** en [E19] — ejemplo `E19`:
  ```
  =X8
  ```

### Cargas (anterior 2026-08-18)

- Dimensiones: 708 filas x 24 columnas (OCULTA). Celdas con dato: 130.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 4 (14 celdas de texto, 14 en negrita): I=Monto | J=Tipo | K=Cuenta | L=Medio | M=Moneda | N=Fecha | O=Nota | R=Monto | S=Tipo | T=Cuenta | U=Medio | V=Moneda | W=Fecha | X=Nota
- Fila 5 (4 celdas de texto, 0 en negrita): S=Egreso | T=Trabajo | U=NaranjaX | V=ARS
- Fila 6 (5 celdas de texto, 0 en negrita): S=Egreso | T=Salidas | U=Efectivo | V=ARS | X=Plata prestada
- Fila 7 (5 celdas de texto, 0 en negrita): S=Egreso | T=Comidas | U=Efectivo | V=ARS | X=Brunch Guada
- Fila 8 (5 celdas de texto, 0 en negrita): S=Egreso | T=Computación | U=Efectivo | V=ARS | X=Cargador
- Fila 9 (4 celdas de texto, 0 en negrita): S=Ingreso | T=Intereses bancos | U=Mercado Pago | V=ARS
- Fila 10 (4 celdas de texto, 0 en negrita): S=Egreso | T=Traspaso | U=Efectivo | V=ARS

**Llamadas QUERY (staging de datos):**

- `R5`:
  ```
  =IFERROR(QUERY(   {'Registros (anterior 2026-08-18)'!B5:M};   "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15";   0 ); "")
  ```
  - Fuente del QUERY (primer argumento): `Registros (anterior 2026-08-18)!B5:M` (12 columnas, headers leidos de la fila 5 de la fuente).
  - Proyeccion: SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 — 7 columnas; LIMIT 15 filas.
  - Staging: `R5:X` (espeja `Registros (anterior 2026-08-18)!B5:M`, columnas proyectadas B, C, D, F, G, H, I).
  - Mapeo columnas: B(Monto)->R, C(Tipo)->S, D(Cuenta)->T, F(Medio)->U, G(Moneda)->V, H(Fecha)->W, I(Nota)->X
  - Verificacion: los headers de la fila 4 de `Cargas (anterior 2026-08-18)` confirman 7/7 columnas del mapeo.

**Patrones de formulas (4 formulas, 3 patrones unicos; top 20):**

- **2x** en [D706, D707] — ejemplo `D706`:
  ```
  =IF(I17<0,5; "#a9bca1"; IF(I17<=0,8; "#db9940"; "#da8b7b")) 
  ```
- **1x** en [R5] — ejemplo `R5`:
  ```
  =IFERROR(QUERY(   {'Registros (anterior 2026-08-18)'!B5:M};   "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15";   0 ); "")
  ```
- **1x** en [D708] — ejemplo `D708`:
  ```
  =IF(#REF!<0,5; "#da8b7b"; IF(#REF!<=0,8; "#db9940"; "#a9bca1")) 
  ```

### Cargas

- Dimensiones: 21 filas x 19 columnas (visible). Celdas con dato: 126.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 6 (14 celdas de texto, 14 en negrita): C=Monto | D=Tipo | E=Cuenta | F=Medio | G=Moneda | H=Fecha | I=Nota | M=Monto | N=Tipo | O=Cuenta | P=Medio | Q=Moneda | R=Fecha | S=Nota
- Fila 7 (4 celdas de texto, 0 en negrita): N=Egreso | O=Trabajo | P=NaranjaX | Q=ARS
- Fila 8 (5 celdas de texto, 0 en negrita): N=Egreso | O=Salidas | P=Efectivo | Q=ARS | S=Plata prestada
- Fila 9 (5 celdas de texto, 0 en negrita): N=Egreso | O=Comidas | P=Efectivo | Q=ARS | S=Brunch Guada
- Fila 10 (5 celdas de texto, 0 en negrita): N=Egreso | O=Computación | P=Efectivo | Q=ARS | S=Cargador

**Llamadas QUERY (staging de datos):**

- `M7`:
  ```
  =IFERROR(QUERY(   {Registros!B6:M};   "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15";   0 ); "")
  ```
  - Fuente del QUERY (primer argumento): `Registros!B6:M` (12 columnas, headers leidos de la fila 6 de la fuente).
  - Proyeccion: SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 — 7 columnas; LIMIT 15 filas.
  - Staging: `M7:S` (espeja `Registros!B6:M`, columnas proyectadas B, C, D, F, G, H, I).
  - Mapeo columnas: B(Monto)->M, C(Tipo)->N, D(Cuenta)->O, F(Medio)->P, G(Moneda)->Q, H(Fecha)->R, I(Nota)->S
  - Verificacion: los headers de la fila 6 de `Cargas` confirman 7/7 columnas del mapeo.

**Patrones de formulas (1 formulas, 1 patrones unicos; top 20):**

- **1x** en [M7] — ejemplo `M7`:
  ```
  =IFERROR(QUERY(   {Registros!B6:M};   "SELECT Col1, Col2, Col3, Col5, Col6, Col7, Col8 WHERE Col1 IS NOT NULL ORDER BY Col7 DESC LIMIT 15";   0 ); "")
  ```

### Plan de Cuentas (anterior 2026-08-18)

- Dimensiones: 1000 filas x 25 columnas (OCULTA). Celdas con dato: 260.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (6 celdas de texto, 6 en negrita): I=Ingresos. | L=Gastos Fijos. | O=Gastos Variables. | R=Medios Bancarios. | V=Proyectos. | Y=Categorias.
- Fila 3 (12 celdas de texto, 12 en negrita): I=Cuenta | J=Proyecto | L=Cuenta | M=Proyecto | O=Cuenta | P=Proyecto | R=Medio | S=Moneda | T=Proyecto | V=Proyecto | W=Tipo | Y=Cuenta
- Fila 4 (9 celdas de texto, 0 en negrita): I=Tidetrack | L=Auto | O=Comidas | R=YPF | S=ARS | T=Medio Cotidiano | V=Ahorros | W=Ahorro | Y=Tidetrack
- Fila 5 (9 celdas de texto, 0 en negrita): I=Umoh | L=Gatos | O=Computación | R=Ualá | S=ARS | T=Medio Cotidiano | V=Tarjeta de Crédito | W=Financiación | Y=Umoh
- Fila 6 (9 celdas de texto, 0 en negrita): I=Ingresos Extra | L=Linea telefónica | O=Corte Pelo | R=Santander | S=ARS | T=Medio Cotidiano | V=Medio Cotidiano | W=Liquidez | Y=Ingresos Extra
- Fila 7 (9 celdas de texto, 0 en negrita): I=Intereses bancos | L=MONOTRIBUTO | O=Entretenimiento | R=Reserva MP | S=ARS | T=Ahorros | V=Europa | W=Viajes | Y=Intereses bancos
- Fila 8 (9 celdas de texto, 0 en negrita): I=Ingreso Asesor | L=Nafta | O=Estacionamiento | R=Plazo Fijo | S=ARS | T=Ahorros | V=Cartera de Retiro | W=Inversiones | Y=Ingreso Asesor
- Fila 9 (9 celdas de texto, 0 en negrita): I=Plata Prestada | L=Pago tarjeta | O=Facultad | R=Patagonia | S=ARS | T=Medio Cotidiano | V=Chanchito | W=Fondo de Emergencia | Y=Plata Prestada
- Fila 10 (9 celdas de texto, 0 en negrita): I=Sueldo | L=Prepaga | O=Imprevistos | R=NaranjaX | S=ARS | T=Medio Cotidiano | V=Cambiar el Celular | W=Objetivos Personales | Y=Sueldo

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

### Plan de Cuentas

- Dimensiones: 83 filas x 19 columnas (visible). Celdas con dato: 249.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 6 (5 celdas de texto, 5 en negrita): C=Ingresos. | F=Gastos Fijos. | I=Gastos Variables. | L=Medios Bancarios. | P=Categorías.
- Fila 7 (12 celdas de texto, 11 en negrita): C=Cuenta | D=Categoría | F=Cuenta | G=Categoría | I=Cuenta | J=Categoría | L=Medio | M=Moneda | N=Categoría | P=Nombre | Q=Tipo | S=Cuentas (fuente de validacion - no tocar)
- Fila 8 (9 celdas de texto, 1 en negrita): C=Tidetrack | F=Auto | I=Comidas | L=YPF | M=ARS | N=Medio Cotidiano | P=Meta de Ahorro 1 | Q=Ahorros | S=Tidetrack
- Fila 9 (9 celdas de texto, 1 en negrita): C=Umoh | F=Gatos | I=Computación | L=Ualá | M=ARS | N=Medio Cotidiano | P=Tarjeta de Crédito | Q=Financiación | S=Umoh
- Fila 10 (9 celdas de texto, 0 en negrita): C=Ingresos Extra | F=Linea telefónica | I=Corte Pelo | L=Santander | M=ARS | N=Medio Cotidiano | P=Medio Cotidiano | Q=Hogar | S=Ingresos Extra

**Llamadas QUERY (staging de datos):**

- `S8`:
  ```
  =QUERY(FLATTEN(C8:C1000;F8:F1000;I8:I1000;L8:L1000);"select * where Col1 is not null";0)
  ```
  - Staging: no estimado — el primer argumento del QUERY no es un rango simple de una hoja (es `FLATTEN(C8:C1000;F8:F1000;I8:I1000;L8:L1000)`).

**Patrones de formulas (1 formulas, 1 patrones unicos; top 20):**

- **1x** en [S8] — ejemplo `S8`:
  ```
  =QUERY(FLATTEN(C8:C1000;F8:F1000;I8:I1000;L8:L1000);"select * where Col1 is not null";0)
  ```

### Mirada Interanual

- Dimensiones: 13 filas x 18 columnas (visible). Celdas con dato: 79.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 2 (5 celdas de texto, 4 en negrita): C=Resumen financiero interanual. | G=Mes de Referencia | I=MAYO | L=Proyecto | M=Todos

**Patrones de formulas (52 formulas, 14 patrones unicos; top 20):**

- **36x** en [G8, H8, I8, J8, K8, L8, M8, N8, ...] — ejemplo `G8`:
  ```
  =LET(mes_num;MATCH($I$2;SPLIT("ENERO,FEBRERO,MARZO,ABRIL,MAYO,JUNIO,JULIO,AGOSTO,SEPTIEMBRE,OCTUBRE,NOVIEMBRE,DICIEMBRE";",");0);off_meses;COLUMN()-COLUMN($K$8);f_obj;EDATE(DATE($I$3;mes_num;1);off_meses);m_obj;MONTH(f_obj);a_obj;YEAR(f_obj);tipo_bd;IF($C8="Ingresos";"Ingreso";IF($C8="Gastos Fijos";"Gasto Fijo";IF($C8="Gastos Variables";"Gasto Variable";NA())));fechas;Registros!$H$7:$H;montos;Regi
  ```
- **4x** en [E8, E9, E10, E11] — ejemplo `E8`:
  ```
  =SUM(G8:R8)
  ```
- **1x** en [G11] — ejemplo `G11`:
  ```
  =G8-G9-G10
  ```
- **1x** en [H11] — ejemplo `H11`:
  ```
  =H8-H9-H10
  ```
- **1x** en [I11] — ejemplo `I11`:
  ```
  =I8-I9-I10
  ```
- **1x** en [J11] — ejemplo `J11`:
  ```
  =J8-J9-J10
  ```
- **1x** en [K11] — ejemplo `K11`:
  ```
  =K8-K9-K10
  ```
- **1x** en [L11] — ejemplo `L11`:
  ```
  =L8-L9-L10
  ```
- **1x** en [M11] — ejemplo `M11`:
  ```
  =M8-M9-M10
  ```
- **1x** en [N11] — ejemplo `N11`:
  ```
  =N8-N9-N10
  ```
- **1x** en [O11] — ejemplo `O11`:
  ```
  =O8-O9-O10
  ```
- **1x** en [P11] — ejemplo `P11`:
  ```
  =P8-P9-P10
  ```
- **1x** en [Q11] — ejemplo `Q11`:
  ```
  =Q8-Q9-Q10
  ```
- **1x** en [R11] — ejemplo `R11`:
  ```
  =R8-R9-R10
  ```

### Registros (anterior 2026-08-18)

- Dimensiones: 3463 filas x 13 columnas (OCULTA). Celdas con dato: 38263.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 5 (12 celdas de texto, 12 en negrita): B=Monto | C=Tipo | D=Cuenta | E=Tipo de Cuenta | F=Medio | G=Moneda | H=Fecha | I=Nota | J=Valor ARS | K=Valor USD | L=Valor AUD | M=Valor EUR
- Fila 6 (5 celdas de texto, 0 en negrita): C=Egreso | D=Trabajo | E=Gasto Variable | F=NaranjaX | G=ARS
- Fila 7 (6 celdas de texto, 0 en negrita): C=Egreso | D=Salidas | E=Gasto Variable | F=Efectivo | G=ARS | I=Plata prestada
- Fila 8 (6 celdas de texto, 0 en negrita): C=Egreso | D=Comidas | E=Gasto Variable | F=Efectivo | G=ARS | I=Brunch Guada
- Fila 9 (6 celdas de texto, 0 en negrita): C=Egreso | D=Computación | E=Gasto Variable | F=Efectivo | G=ARS | I=Cargador
- Fila 10 (5 celdas de texto, 0 en negrita): C=Ingreso | D=Intereses bancos | E=Ingreso | F=Mercado Pago | G=ARS

### Registros

- Dimensiones: 3464 filas x 13 columnas (visible). Celdas con dato: 38263.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 6 (12 celdas de texto, 12 en negrita): B=Monto | C=Tipo | D=Cuenta | E=Tipo de Cuenta | F=Medio | G=Moneda | H=Fecha | I=Nota | J=Valor ARS | K=Valor USD | L=Valor AUD | M=Valor EUR
- Fila 7 (5 celdas de texto, 0 en negrita): C=Egreso | D=Trabajo | E=Gasto Variable | F=NaranjaX | G=ARS
- Fila 8 (6 celdas de texto, 0 en negrita): C=Egreso | D=Salidas | E=Gasto Variable | F=Efectivo | G=ARS | I=Plata prestada
- Fila 9 (6 celdas de texto, 0 en negrita): C=Egreso | D=Comidas | E=Gasto Variable | F=Efectivo | G=ARS | I=Brunch Guada
- Fila 10 (6 celdas de texto, 0 en negrita): C=Egreso | D=Computación | E=Gasto Variable | F=Efectivo | G=ARS | I=Cargador

### Tipos de Cambio (anterior 2026-08-18)

- Dimensiones: 962 filas x 12 columnas (OCULTA). Celdas con dato: 6705.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 5 (4 celdas de texto, 4 en negrita): B=Peso Argentino. | E=Dólar Estaudonidense. | H=Dólar Australiano. | K=Euro.
- Fila 6 (8 celdas de texto, 8 en negrita): B=Fecha | C=Cotización | E=Fecha | F=Cotización | H=Fecha | I=Cotización | K=Fecha | L=Cotización

### Tipos de Cambio

- Dimensiones: 963 filas x 13 columnas (visible). Celdas con dato: 7661.

**Filas 1-10 con 3+ celdas de texto** (se informa cuantas de esas celdas estan en negrita, como pista para distinguir un header de una fila de datos; NO es un criterio fiable: hay headers sin negrita y filas de datos con negritas):

- Fila 6 (4 celdas de texto, 4 en negrita): C=Peso Argentino. | F=Dólar Estaudonidense. | I=Dólar Australiano. | L=Euro.
- Fila 7 (8 celdas de texto, 8 en negrita): C=Fecha | D=Cotización | F=Fecha | G=Cotización | I=Fecha | J=Cotización | L=Fecha | M=Cotización

