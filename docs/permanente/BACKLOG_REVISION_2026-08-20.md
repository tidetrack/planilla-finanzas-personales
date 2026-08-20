# Backlog de defectos verificados — revision adversarial 2026-08-20

> Producto de una revision multi-agente de los 28 archivos de `src/` que entraron a `main` en el
> PR #6. Siete dimensiones (cirugia de formulas, geometria/SSOT, guards y reversion, idempotencia,
> seguridad de datos, parseo es_AR, codigo muerto) devolvieron **56 hallazgos crudos -> 55 unicos**.
> Se verificaron adversarialmente **los 9 mas severos**: 7 sobrevivieron, 2 fueron refutados.
>
> **Los 46 restantes NO se verificaron.** No estan descartados: estan sin mirar. Si hace falta
> agotar la lista, hay que correr la verificacion sobre ellos.
>
> ESTADO: los items **1, 2 y 3 ya estan arreglados y desplegados** en la v0.24.0. Quedan el 4, el 5
> y el 6; el 7 esta diferido a proposito.

Ordenado por lo que conviene atacar primero (dano real x costo). Todos los archivos estan en `/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c/`.

---

## 1. Presupuesto del Tablero: la conversion de moneda apunta a celdas que ya no son las cotizaciones
**Severidad: alta · Costo: 15 minutos · Hacer primero**

**Que esta mal.** `src/DEVTOOL_Proyeccion.js:333-334` (`_formulaPresupuestoProy`) cablea `$AF$17`, `$AF$18` y `$AF$19` como cotizaciones USD/AUD/EUR. Esas coordenadas eran validas en el layout viejo (el gemelo `docs/permanente/celdas.tsv` las tiene con `tidetrack_usd()`, `TIDETRACK_AUD()`, `tidetrack_EUR()`), pero el bloque de cotizaciones se mudo a las filas 27-29 y hoy AF17:AF19 son el bloque "Saldos Actuales": AF17 es el rotulo de texto "Flujo" y AF18/AF19 son montos de saldo (`SYF_SALDOS_TABLERO` en `src/DEVTOOL_StockYFlujo.js:127-134`, geometria medida en vivo el 2026-08-20 con guard que aborta si AF17 no dice "Flujo"). La v0.23.3 migro StockYFlujo a las funciones y se olvido de este modulo: es el unico lugar de `src/` que todavia autora esas coordenadas.

**Que se rompe.** Tablero N9:N11 (Presupuesto Asignado):
- Un previsto en AUD o EUR se multiplica por un saldo en plata (cientos de miles de ARS) en vez de por una cotizacion. Presupuesto inflado en varios ordenes de magnitud, sin ningun aviso. Este es el peor caso.
- Un previsto en USD multiplica por el texto "Flujo" -> `#VALUE!` visible en la celda (el `IFERROR` de la linea 341 envuelve el `FILTER`, no cada elemento, asi que el error si atraviesa).
- Si el selector `Tablero!N4` se pone en USD/AUD/EUR, `tasa_destino` (linea 334) se rompe por las mismas tres coordenadas.
- No lo frena nada: `_preflightProy` (lineas 219-262) solo valida los rotulos L9/L10/L11, y la verificacion post-escritura pasa porque la hoja Proyeccion nace vacia. Peor: `aplicarProyeccion` es re-ejecutable y compara formula previa vs nueva, asi que "BD de Proyeccion > 2. Crear y cablear" reescribe la referencia podrida cada vez.

**Arreglo.** Reemplazar en las lineas 333-334 `$AF$17`/`$AF$18`/`$AF$19` por `TIDETRACK_USD()`/`TIDETRACK_AUD()`/`TIDETRACK_EUR()` — el mismo criterio ya adoptado en `src/DEVTOOL_StockYFlujo.js:673-687` (una funcion no tiene coordenada que se pueda pudrir). Actualizar la prosa que repite las coordenadas viejas en `src/DEVTOOL_Proyeccion.js:29` y `src/01_Version.js:98`, y dejar la correccion en una entrada nueva de `ZZ_Changelog.js` (la entrada historica de v0.18.0 no se toca: es registro). Despues re-correr "BD de Proyeccion > 2. Crear y cablear" en produccion, porque la celda ya quedo cableada mal.

---

## 2. El ABM "Proyectos" escribe en el catalogo de Categorias de Cuenta
**Severidad: alta (unico defecto que corrompe datos en el uso cotidiano) · Costo: 10 minutos**

**Que esta mal.** `src/00_Config.js:182-187` sigue declarando `RANGES.PROYECTOS` con `start:'P'`, `end:'Q'`, `columns:{nombre:'P', tipo:'Q'}`, pero (a) la columna Q ya se borro fisicamente (`src/DEVTOOL_LimpiarPlanCuentas.js:181`, `deleteColumn`) y (b) la columna P es hoy `CATEGORIAS_CUENTA` (`src/00_Config.js:197-201`). Dos tablas del SSOT apuntando a la misma columna con semanticas distintas. Regla estricta 1: el cambio estructural nunca actualizo Config.

**Que se rompe.** El camino esta en el menu **diario**, no en el Dev: `00_Config.js:408` -> `showAbmPlanCuentas`; `src/UI_AbmPlanCuentas.html:158` sigue ofreciendo `<option value="PROYECTOS">Proyectos</option>`; `src/11_UIService.js:100-103` arma `[nombre, tipoProyecto]` y llama `appendRow('PROYECTOS', ...)`. Resultado: dar de alta un "Proyecto" agrega el nombre al final del catalogo de Categorias de Cuenta en P y deja el tipo suelto en Q (columna que ya no pertenece a ninguna tabla). Eliminar un "Proyecto" desde el mismo ABM da de baja una categoria de cuenta. No hay guard: `appendRow` no valida, la unica validacion de `saveAbmRecord` es contra duplicados leidos de la misma P, y `aplicarLimpiarPlan` dejo la columna sin validacion de datos.

**Arreglo minimo.** Sacar la entidad del ABM, que es lo unico que escribe: `src/UI_AbmPlanCuentas.html:158` y los `case 'PROYECTOS'` de `src/11_UIService.js:100` y `:204`. Recien despues decidir el destino de `RANGES.PROYECTOS` (eliminarla, o apuntarla a una columna inexistente para que los devtools historicos fallen ruidosamente en vez de leer la columna equivocada). No apurar la eliminacion: hay lectores en `DEVTOOL_TipoDeMedios.js:255,:335,:363`, `DEVTOOL_FormulerioV0111.js:688`, `DEVTOOL_Presupuesto.js:711,:1582` y `DEVTOOL_CategorizarCuentas.js:347`.

**Se arregla junto con esto** (misma constante podrida, mismo commit):
- El submenu "Riqueza y categorias" (`00_Config.js:551-556`) esta **muerto**: `_preflightRiqueza` (`src/DEVTOOL_RiquezaYCategorias.js:368-393`) lee la columna de tipo de `PROYECTOS`, que hoy es la ex-R vacia, no encuentra ni Ahorros ni Inversiones y **lanza siempre**. Los dos items solo pueden contestar con un error de preflight. Decidir: re-apuntar el preflight al catalogo vivo, o sacar el submenu.
- `src/DEVTOOL_CategorizarCuentas.js:347-348` toma `RANGES.PROYECTOS.columns.nombre` como "catalogo de categorias de medios", que es la misma P que `yaEnCatalogo`: en la segunda corrida reporta todas las categorias ya cargadas como colision falsa (`:383-386`). No aborta — `:401` lo vuelca a `avisos` — pero es ruido puro en el reporte.

---

## 3. Stock y flujo: una corrida exitosa puede dejar el bloque "Medios Bancarios" vacio
**Severidad: alta (perdida de datos en una corrida que reporta OK) · Costo: 5 minutos · Junto con el 4**

**Que esta mal.** `src/DEVTOOL_StockYFlujo.js:828` setea `limpiar = true` **antes** de los tres `proponer`, sin mirar si esos `proponer` generan cambio.

**Que se rompe.** Si las tres formulas del bloque ya estan aplicadas pero queda pendiente cualquier otro cambio — por ejemplo uno de los `esFormato` de las lineas 794-803, que es exactamente el escenario que introdujo la v0.23.5 —, entonces `plan.cambios.length > 0`, no se sale por la linea 274, se ejecuta `_limpiarBloqueMedios` (linea 305) que borra `C18:I29` **incluidas las tres formulas**, y el bucle de la linea 309 no las vuelve a escribir porque `proponer` las descarto por iguales. `_verificarEscrituraSyf` solo mira las celdas escritas, asi que pasa; `fotoBloque` se descarta al retornar ok. El bloque "Medios Bancarios" queda vacio de forma permanente y el alert dice que salio todo bien.

**Arreglo.** `limpiar` tiene que setearse solo si alguno de los tres `proponer` del bloque efectivamente genero un cambio (que `proponer` devuelva si encolo, y hacer el OR). Alternativa igual de valida: no borrar el bloque cuando las tres formulas objetivo ya coinciden con las vivas.

---

## 4. Stock y flujo: "3. Revertir" no deja la hoja como estaba
**Severidad: alta · Costo: medio (persistir foto + formatos) · Mismo archivo que el 3**

**Que esta mal.** El respaldo persistido (`_respaldarFormulerio`, `src/DEVTOOL_FormulerioV0111.js:1040-1064`) guarda **solo celdas que tenian formula** (`if (!f) continue;`) y no guarda formatos. La foto del contenido estatico del bloque (`fotoBloque`) vive unicamente en memoria (`src/DEVTOOL_StockYFlujo.js:264, 303-304`) y se consume solo en los dos caminos de falla (lineas 327 y 361); en el camino feliz se descarta al retornar en la linea 348. `revertirStockYFlujo` (`:374-402`) solo hace `setFormula` en la linea 400: no restaura valores, no restaura `numberFormat`, no borra nada de lo escrito en celdas que antes estaban vacias.

**Que se rompe al correr "Tidetrack Dev > Stock y flujo > 3. Revertir".**
- Lo estatico de `C18:I29` que se limpio no vuelve: F18 y H18 (valores estaticos viejos) y todo `C19:I29`. Quedan con las formulas nuevas de la corrida, o vacias si la formula repuesta en C18 derrama menos filas. C18 si vuelve, porque tenia formula.
- `AG9:AG12`: la corrida escribio formula + formato de plata sobre celdas vacias; el revertir no borra ninguna de las dos cosas. Hoy no se nota (formato de plata + formula de plata se ve bien), pero es formato huerfano esperando.
- `_revertirEscriturasSyf` (linea 1048) si revierte los `esFormato`, `revertirStockYFlujo` no: la doctrina de la v0.23.5 ("revertir formulas no revierte formatos") se aplico al rollback por falla y no al revertir del menu.

**Arreglo.** Persistir en la hoja de respaldo lo que hoy solo esta en memoria: agregar columnas `tipo` (formula/valor/vacia) y `formato` al respaldo del formulerio, o una segunda hoja `RESP_SYF_BLOQUE`, y que `revertirStockYFlujo` restaure las tres cosas — formulas, valores estaticos y `numberFormat` — y vacie las celdas que el respaldo marca como vacias. Si se decide no hacerlo ahora, el texto del alert de las lineas 388-393 debe decir explicitamente que el bloque Medios Bancarios y AG9:AG12 **no** vuelven a su estado previo (hoy solo avisa por la celda del diagnostico).

---

## 5. Conciliar saldos: si la verificacion falla, las filas de ajuste quedan en el ledger
**Severidad: alta · Costo: bajo (el deshacer) + bajo (el revertir por menu)**

**Que esta mal.** `src/DEVTOOL_ConciliarSaldos.js:149` appendea el bloque de ajustes a Registros, `:153` remide con `_planConciliar` y `:155-160` lanza si algo quedo fuera de tolerancia. Entre el write y el throw no hay `deleteRows` ni restauracion, y no existe `revertirConciliarSaldos` en todo `src/`.

**Que se rompe.** El operador ve un alert encabezado "NO APLICADO" (el catch de `:178` antepone ese texto) mientras las filas siguen en el ledger, contaminando saldos por medio, moneda y tipo en Tablero e Inicio. El camino de falla se alcanza justo por las cicatrices conocidas: la remedicion solo cuenta una fila si el medio (F) no esta vacio, la fecha (H) es Date y >= corte, y el signo sale de `tipo === 'Egreso'` (`:230-236, :248-251`); una celda que quedo vacia por validacion, o un "Inicio Mes" con fecha futura, produce exactamente el throw con las filas ya escritas. Encima, el throw saltea la linea 162, asi que el nombre del respaldo nunca queda en `DocumentProperties`, la hoja de respaldo esta oculta (`MIGRACION_v031_Historico.js:1821`) y el submenu (`00_Config.js:537-540`) no tiene el item "3. Revertir" que si tienen StockYFlujo, Riqueza y el resto.

**Arreglo.** Antes de lanzar, borrar el rango recien escrito: `hojaReg.deleteRows(filasAntes + 1, bloque.length)` y reverificar que la ultima fila con dato volvio a `filasAntes`; si el borrado tambien falla, decirlo y nombrar el rango exacto a borrar a mano. Mover la persistencia del respaldo (linea 162) **antes** del guard, y agregar `revertirConciliarSaldos` + item "3. Revertir (usa el respaldo)" al submenu, para que el modulo quede simetrico con los demas.

---

## 6. Limpiar Plan de Cuentas: la restauracion escribe corrido (latente)
**Severidad: alta si dispara · Costo: bajo (re-fotografiar despues del deleteColumn) · Prioridad baja: hoy no dispara**

**Que esta mal.** `_fotografiarColumnasLpc` (`src/DEVTOOL_LimpiarPlanCuentas.js:160`) guarda **indices absolutos** (P=16, T=20, U=21, V=22, W=23) tomados antes del `hojaPC.deleteColumn(colBorrar)` de la linea 181. `_restaurarColumnasLpc` (`:420-433`) usa `p.col` crudo. El autor conocia el corrimiento — las lineas 192 y 211 hacen `columnLetterToIndex(b.col) - (borrada && ... > colBorrar ? 1 : 0)` — pero la restauracion quedo sin esa resta.

**Que se rompe.** Cualquier excepcion posterior a la linea 181 (dentro de `_reponerValidacionCargas`, del loop de barrido, un `flush`, un timeout de 6 minutos) cae en el catch de `:251` y llama a la misma restauracion con la foto pre-borrado. Esa es la via realista, mas que el bloque `fallas` de `:227`. El dano: los valores de la vieja T se escriben sobre la vieja U, los de U sobre V, los de V sobre W y los de W sobre X (columna que la corrida nunca toco); y el indice 19 — donde quedo la vieja T tras el corrimiento y que el barrido de `:195` acaba de vaciar — no se restaura nunca, o sea que T se pierde. P se restaura bien porque esta a la izquierda de Q. El `setDataValidations` de `:431` repone validaciones en las columnas equivocadas por lo mismo. Y el texto "Se restauro el Plan de Cuentas" de las lineas 232 y 254 es falso: la hoja queda una columna mas angosta y cuatro corridas.

**No dispara hoy.** En el unico target de `targets.yaml` la Q ya se borro en v0.22.1 y la consolidada quedo en R, con lo cual `separadoras = 1` y la linea 373 deja `borrarColumna = false`. Es latente: muerde en cualquier planilla que todavia tenga la columna de aire adentro del bloque de Categorias — o sea, en el proximo cliente.

**Arreglo.** Lo mas simple: re-fotografiar despues del `deleteColumn`. Si se prefiere no re-leer, que la foto guarde tambien las letras y `_restaurarColumnasLpc` reciba el offset y aplique la misma expresion de las lineas 192/211. Corregir tambien el texto de `:232` y `:254`. La opcion mas robusta es mover el `deleteColumn` al final, despues de que toda la verificacion de contenido haya pasado, para que el unico paso irreversible quede fuera de la ventana que la restauracion tiene que deshacer.

---

## 7. Cableado de Presupuesto: despues de un revertir, aplicar se autobloquea — NO arreglar ahora
**Severidad: media · Costo: bajo · Recomendacion: diferir**

**Que esta mal.** `revertirCableadoPresupuesto` restaura y anota `revertidaEn`, pero no borra la hoja `RESP_CABLEADO_<sello>` (declarado explicito en `src/DEVTOOL_CableadoPresupuesto.js:2561`). En la corrida siguiente, `_enVueloCP` (`:579-581`) devuelve false porque existe `revertidaEn`, se entra al camino de ciclo nuevo, y el filtro de huerfanas de `:2266-2269` — que es solo por prefijo de nombre y no consulta el registro — encuentra la hoja y aborta con "sin registro asociado", cuando el registro existe y dice que ese ciclo ya se revirtio.

**Por que diferirlo.** El modulo esta fuera de servicio y no figura en `MENU_CONFIG` (`00_Config.js:581` y la cabecera del archivo): hoy solo se llega invocandolo a mano desde el editor. Ademas el bloqueo no es permanente — el propio mensaje nombra la salida (borrar la hoja oculta a mano). El defecto muerde recien cuando se rehabilite el modulo, que es lo que la cabecera planifica. Anotarlo como precondicion de esa rehabilitacion.

**Arreglo cuando toque.** Excluir del filtro de `:2266-2269` las hojas que el registro referencia (`estadoPrevio.respaldo`), o portar el criterio del modulo hermano `src/MIGRACION_v0.9.5_LayoutNuevo.js:1724-1741`, que compara el contenido del respaldo contra la celda viva y bloquea solo si difieren (tras un revertir coinciden, asi que no bloquea). Ese fix ya esta registrado en `ZZ_Changelog.js:811`; CableadoPresupuesto quedo con el guard ciego.

---

## Agrupamientos

- **1 solo** — es el unico que toca numeros que Franco mira todos los dias. Va aparte y se despliega ya.
- **2 en un commit** con la decision sobre el submenu "Riqueza y categorias" y el aviso falso de CategorizarCuentas: los tres salen de la misma constante podrida.
- **3 y 4 en un commit** — mismo archivo, mismo bloque, y el 3 es una linea. Hacer el 3 aunque el 4 se posponga.
- **5 y 6 sueltos**, cada uno en su commit.
- **7 no entra al backlog activo.**

Recordatorio de gobernanza: cada uno de estos commits cierra con changelog dual (`ZZ_Changelog.js` al tope + `docs/permanente/CHANGELOG.md`) y decision inline donde toque estructura, y el deploy sale exclusivamente por `./sync_targets.command`.