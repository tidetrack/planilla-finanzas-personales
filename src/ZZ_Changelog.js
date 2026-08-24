/**
 * ===================================== * REGISTRO DE ACTUALIZACIONES (CHANGELOG)
 * ===================================== * Historial descendente de cambios sincronizados al entorno Apps Script.
 * (Añadir nuevos registros arriba)
 *
 * [2026-08-24] v0.43.0 - El rango del VLOOKUP del Tipo, reparado (bloque Categorias del Tablero).
 * - Franco midio en vivo, sobre la planilla real, la linea `columna_tipo` del LET de Tablero!AA10
 *   (el bloque "Categorias" del Tablero): `VLOOKUP(columna_aj; 'Plan de Cuentas'!P:P; 2; 0)`. Le
 *   pide la COLUMNA 2 a P:P, que tiene UNA sola columna: es #REF!, tapado por el IFERROR que lo
 *   envuelve. Consecuencia: la columna Tipo del bloque no podia mostrar nada, nunca -- ni con la
 *   columna Q del Plan de Cuentas llena. No lee una columna vacia: lee un rango invalido y lo
 *   esconde.
 * - QUIEN LO REPARA Y POR QUE: la coordenada la declara RIQ_BLOQUE_CATEGORIAS en
 *   DEVTOOL_RiquezaYCategorias.js, pero ese modulo dejo de tocar AA10 el 2026-08-21 por la
 *   decision de duenio unico (ver su propia cabecera, seccion "ESTADO AL 2026-08-21"): su
 *   `_planRiqueza` lo dice explicito, y `_conTipoEnCategorias` -- que YA sabia construir el
 *   VLOOKUP correcto -- quedo retenida solo como prueba de regresion en probar_riqueza.js, sin
 *   ejecutar sobre esta celda. El duenio unico de AA10, decidido por Franco, es
 *   DEVTOOL_BloqueCategorias.js. La reparacion entra ahi como una SEGUNDA cirugia de token,
 *   `_repararRangoTipoBcat`, independiente de `_reapuntarBloqueCategorias` (esa toca la variable
 *   `proyecto`, el agrupamiento; esta toca `columna_tipo`, otra linea del mismo LET): un solo
 *   escritor para toda la celda, tal como pide la regla de duenio unico que el propio repo se dio.
 * - `_repararRangoTipoBcat` DERIVA el rango de RANGES.PROYECTOS (P:Q: nombre en P, tipo en Q; el
 *   indice de columna sale de `columns.tipo`), nunca hardcodeado. Probado por mutacion: mutar
 *   RANGES.PROYECTOS.end mueve el resultado con el config (devtools/probar_bloque_categorias.js,
 *   seccion 2). No toca ninguna otra linea del LET (verificado linea por linea contra la formula
 *   real): en particular deja INTACTA `tipo_proy` (linea 7), que tiene la MISMA forma rota pero
 *   esta MUERTA -- sin ningun lector, desde que RiquezaYCategorias le saco el filtro que la
 *   consumia (`_conTipoEnCategorias`, paso 3, ya aplicado sobre esta celda). Sin lectores, su
 *   #REF! tapado no cambia ningun resultado visible: no es el bug que Franco midio.
 * - `estadoBloqueCategorias`/`aplicarBloqueCategorias` corren ahora las DOS cirugias via
 *   `_diagnosticarBcat` y reportan cual de las dos, si alguna, hace falta. Medido contra el
 *   gemelo digital (docs/permanente/celdas.tsv): la cascada de categoria YA esta aplicada
 *   (`grupoCambia=false`) y solo el rango del Tipo hacia falta (`tipoCambia=true`) -- consistente
 *   con que `aplicarBloqueCategorias` ya se habia corrido en produccion para el primer defecto.
 *   `aplicar()` relee la FORMA de lo escrito para verificar la reparacion del Tipo (no alcanza con
 *   el texto ni con el error de celda: el IFERROR tapa el #REF!, tal como tapaba el original).
 * - Nueva `_contarCategoriasSinTipoBcat` (solo lectura): cuenta, sobre el catalogo vivo
 *   (RANGES.PROYECTOS), cuantas categorias tienen nombre y no tienen Tipo. `estado()`/`aplicar()`
 *   lo muestran para avisar, con un numero medido y no inventado, que la columna Tipo del Tablero
 *   puede seguir en blanco despues del arreglo -- ya no por una formula rota, por catalogo
 *   incompleto (la columna Q del Plan de Cuentas, ademas, no tiene desplegable hoy: se carga a
 *   mano; agregarle uno queda propuesto, no aplicado, a la espera de que Franco lo pida).
 * - devtools/probar_bloque_categorias.js (NUEVO): el modulo no tenia banco propio -- las dos
 *   publicas se probaban solo de paso, en la seccion 2 de probar_riqueza.js. Corre las
 *   transformaciones REALES contra la formula REAL de Tablero!AA10 (leida del gemelo): confirma
 *   el bug medido, la reparacion, que ninguna otra linea del LET se toca, que tipo_proy queda
 *   intacto a proposito, idempotencia sola y combinada con `_reapuntarBloqueCategorias`, la
 *   mutacion que prueba la dependencia de RANGES, seguridad de entrada (undefined/vacio/formula
 *   ajena) y `_contarCategoriasSinTipoBcat` sobre una hoja simulada. Los nueve bancos en verde.
 *
 * [2026-08-24] v0.42.1 - Cursiva del faltante uniforme en los tres bloques (era formato estatico pegado a filas fijas en Ingresos).
 * - v0.42.0 SE DESPLEGO Y APLICO BIEN (la negrita de la seccion real quedo correcta), pero Franco reporto
 *   que los tres bloques del Tablero NO quedaron iguales: en Ingresos la fila separadora y las filas de
 *   faltante se ven en CURSIVA; en Gastos Fijos y Variables no. Los tres bloques los escribe el MISMO
 *   codigo en la MISMA corrida, asi que la diferencia no podia venir de ninguna regla de este modulo.
 * - SE MIDIO ANTES DE TOCAR NADA (diagnostico de solo lectura, DEVTOOL_DIAG_CursivaFaltante.js, ya
 *   retirado): en Ingresos, SOLO R14:S18 tenian FontStyle ESTATICO 'italic' (la fila separadora + cuatro
 *   filas de faltante). LA FILA 19 (tambien de faltante) NO estaba en cursiva: la prueba de que el
 *   formato estaba pegado a un RANGO DE FILAS FIJO, no al CONTENIDO de la fila -- la misma trampa que
 *   este modulo ya documenta para el gris (decision #8), esta vez del lado de Franco. En Gastos Fijos y
 *   Variables, CERO celdas en cursiva. Se habia revisado antes, por las dudas, el historial de git de
 *   las seis versiones del modulo: ninguna version de _construirReglaGrisTfp llamo jamas setItalic() --
 *   no hay ninguna regla huerfana que barrer, el origen es 100% formato estatico.
 * - LA RESOLUCION, en dos partes: (a) _construirReglaGrisTfp ahora TAMBIEN llama setItalic(true) -- la
 *   MISMA regla que ya pintaba gris, igual en los tres bloques, asi que la cursiva pasa a seguir al
 *   CONTENIDO (via el mismo COUNTIF posicional de la decision #8) en vez de a una fila fija. (b) El
 *   FontStyle estatico se limpia como parte de aplicar(), GENERICO en los tres bloques (no hardcodeado
 *   a "Ingresos R14:S18"): el preflight lee (solo lectura) el FontStyle de _rangoDatosTfp(b) de CADA
 *   bloque: si alguno tiene 'italic', el plan agrega un item aparte (plan.cursivaEstatica); aplicar()
 *   respalda el rango completo (getFontStyles) antes de limpiarlo (setFontStyle('normal')) y revertir lo
 *   repone exacto (setFontStyles). Solo se toca el FontStyle -- color de fuente y negrita estatica que
 *   hubiera quedan intactos.
 * - AJUSTE IMPRESCINDIBLE para que (a) funcione en un segundo "Aplicar": _reglasHacenFaltaTfp comparaba
 *   SOLO formula+rango. La regla gris de v0.42.0 ya vigente en la planilla de Franco calza formula+rango
 *   EXACTO con la de v0.42.1 (solo cambia el estilo) -- _esReglaPropiaTfp la reconoce como propia igual
 *   (correcto, formula+rango es y debe seguir siendo su unico criterio de identidad), pero comparar solo
 *   por identidad hacia que "ya esta correcta" diera VERDADERO con un estilo VIEJO: aplicar() nunca la
 *   iba a reescribir. Ahora tambien compara bold/italic/color (via _hexDeColorTfp, mismo patron que
 *   _hexDeColorIp de DEVTOOL_InicioPresupuesto.js: asRgbColor() con try/catch, sin depender de
 *   SpreadsheetApp.ColorType) -- mismo diagnostico y misma solucion que ya paso en ese modulo.
 * - devtools/probar_tablero_faltante.js: nueva seccion 5c (setItalic en la regla gris, los nueve items
 *   declaran bold/italic/color, _hexDeColorTfp, y la mutacion que importa: formula+rango correctos con
 *   estilo viejo SI dispara la reescritura) y nueva seccion 7g (deteccion/limpieza del FontStyle
 *   estatico, probado con DOS bloques a la vez para confirmar que no quedo hardcodeado a Ingresos, y
 *   round-trip getFontStyles/setFontStyles fiel para el respaldo/reversion). Los ocho bancos en verde;
 *   las tres mutaciones centrales (quitar el setItalic de la regla gris, revertir el freshness-check a
 *   formula+rango, y limitar la limpieza a un solo bloque) confirmadas a mano contra el banco real.
 *
 * [2026-08-24] v0.42.0 - v0.41.0 se autoreviritio (bug del invariante, corregido) + la seccion real en negrita.
 * - EL DESPLIEGUE DE v0.41.0 SE REVIRTIO SOLO: aplicarTableroFaltanteProyectado() se corrio contra la
 *   planilla real y su propia verificacion (_verificarInvariantesTfp) lo atrapo y revirtio: "quedaron 6
 *   nombre(s) distinto(s) y antes habia 9 cuenta(s) con movimiento real" en Ingresos, mismo patron en
 *   Gastos Fijos y Variables. El guard funciono exactamente como debe -- el bug estaba en el invariante,
 *   no en la escritura.
 * - LA CAUSA: el preflight media "cuentas reales antes" contando FILAS no vacias del rango de Cuenta
 *   (`cuentasVivas`). Correcto en la PRIMERA MIGRACION (la celda ancla es la QUERY cruda de Franco,
 *   GROUP BY Col1, una fila = una cuenta), pero FALSO en un UPGRADE: la planilla de Franco ya tenia
 *   v0.40.0 aplicada (dos secciones, sin separador), asi que el rango de Cuenta YA mezclaba cuentas
 *   reales y de faltante -- Ingresos tiene 4 cuentas reales pero el preflight leyo 9 (4 reales + 5 de
 *   faltante). El "despues" (nombres DISTINTOS del render nuevo, 6: la union de reales y faltantes)
 *   nunca podia coincidir contra esa cardinalidad: eran dos magnitudes distintas por diseno, no un
 *   error de conteo.
 * - LA CORRECCION: _nombresRealesVivosTfp (nueva) deriva el "antes" correcto -- el CONJUNTO de cuentas
 *   con movimiento real -- leyendo la señal que cada estado ya deja en el render vivo, sin escribir
 *   nada (el preflight nunca escribe) y sin evaluar ninguna formula: la fila separadora rotulada si el
 *   bloque ya viene de v0.41.0 (todo arriba de ella es real), o el TIPO de dato del Monto si viene de
 *   v0.40.0 (NUMERO = real, STRING = faltante via su TEXT()). Sin ninguna de las dos señales, es la
 *   QUERY cruda de Franco, una fila = una cuenta, el comportamiento de siempre.
 * - _verificarInvariantesTfp deja de comparar CARDINALIDADES para comparar el CONJUNTO por NOMBRE: cada
 *   cuenta del "antes" tiene que seguir apareciendo en el "despues". Mas estricto que un piso numerico
 *   (un SWAP que perdiera una cuenta real y ganara otra por otro motivo daria la MISMA cardinalidad,
 *   pero es exactamente la perdida que el invariante existe para atrapar). El caso de TRUNCADO esperado
 *   sigue usando el piso por cardinalidad de siempre, sin cambios.
 * - PROBADO POR MUTACION contra el camino de upgrade exacto que hizo fallar la planilla real: partiendo
 *   de un bloque v0.40.0 ya aplicado (fixture con 4 reales + 5 de faltante, los mismos numeros del
 *   reporte de Franco), reaplicar NO dispara el invariante; si de ese mismo estado desaparece una
 *   cuenta real de verdad, SI lo dispara y la NOMBRA (seccion 8d del banco).
 * - PEDIDO DE FRANCO EN EL MISMO RELEASE, sobre el bloque de Ingresos con captura delante: "quiero que
 *   las filas de los faltantes proyectados queden como estan, pero que los ingresos de verdad
 *   aparezcan en negrito." La seccion de faltante NO se toca (gris, igual que hoy); la seccion real
 *   pasa a NEGRITA -- la misma idea de separar mas las dos secciones, resuelta del otro lado (resaltar
 *   lo real en vez de apagar mas lo proyectado).
 * - LA REGLA DE NEGRITA (_formulaReglaNegritaTfp) reusa el MISMO COUNTIF expansivo posicional del gris
 *   y le pide la condicion CONTRARIA (=0 en vez de >0): es su complemento exacto, no un mecanismo
 *   nuevo. Tres decisiones resueltas explicitamente: (a) la fila separadora, que tambien cae del lado
 *   "COUNTIF=0", queda EXCLUIDA con una guarda -- no es un ingreso real, es un rotulo de seccion, y
 *   "QUE NO HACE" punto 4 ya la dejaba sin tratamiento propio desde v0.41.0; (b) las filas vacias se
 *   excluyen por COMPARACION DE VALOR ($col$fila<>""), nunca un SUMIF/COUNTIF a secas -- la misma
 *   ambiguedad Sheets-especifica del bug de v0.40.0; (c) abarca las DOS columnas (Cuenta y Monto) con
 *   una sola regla de rango de dos columnas por bloque (ej. R10:S29), con la columna ANCLADA en Cuenta
 *   para que la MISMA fila decida el estilo de sus dos celdas.
 * - NO SE PISA FORMATO EXISTENTE: la regla SOLO llama setBold(true), nunca setFontColor ni setBold(false)
 *   -- si el Monto de la seccion real ya tenia negrita ESTATICA (posible segun la captura de Franco), no
 *   cambia nada visualmente; si en cambio fuera otra regla condicional ajena, la clasificacion
 *   propia/ajena ya existente (_esReglaPropiaTfp) la preserva intacta. Esta sesion no pudo confirmar en
 *   vivo cual de las dos es -- queda para la corrida final.
 * - devtools/probar_tablero_faltante.js: seccion 8 reescrita (preFalso modela ahora el "antes" por
 *   CONJUNTO de nombres, no por cardinalidad) mas la nueva seccion 8d (reproduce el camino de upgrade
 *   exacto con los numeros reales del reporte); nueva seccion 5b (negrita: complemento del gris, la
 *   fila separadora excluida, setBold sin pisar setFontColor/setItalic). Los ocho bancos del repo en
 *   verde.
 *
 * [2026-08-24] v0.41.0 - Faltante proyectado: fila separadora explicita + montos numericos (reemplaza el gris por TEXT()).
 * - EL PEDIDO DE FRANCO, sobre la v0.40.0 ya desplegada y funcionando: (1) "Necesito que,
 *   visualmente, se separe mas lo proyectado de lo ingresado realmente porque parece que no se
 *   registra bien. Busca la manera de diferenciarlos mas." (2) "Ademas, la columna de monto debe
 *   dejarme que, al seleccionar celdas, te de la suma total. Para asi hacer proyecciones." Y
 *   despues: "Dale resolvelo".
 * - LA RESTRICCION QUE INVALIDABA EL DISENO ANTERIOR: en v0.40.0 los importes de la seccion de
 *   faltante eran TEXTO (pasaban por TEXT() para que ISTEXT() los pudiera pintar gris). Un texto
 *   no suma al seleccionarlo: la barra de estado de Sheets no muestra nada. Se estaba rompiendo
 *   una afordancia basica de planilla a cambio de un color.
 * - LA SOLUCION, una FILA SEPARADORA explicita (rotulo "Faltante proyectado" en la columna
 *   Cuenta, Monto vacio) entre las dos secciones, resuelve las dos cosas a la vez: (a) le da a
 *   Franco la separacion visual que pedia -- ya no ve la misma cuenta dos veces sin nada que
 *   explique por que --, y (b) libera a los montos de necesitar TEXT() como senal de color: son
 *   NUMEROS crudos en las dos secciones, la seleccion vuelve a sumar. La fila se inserta con el
 *   mismo mecanismo que ya insertaba la fila de aviso de truncado (una posicion calculada dentro
 *   del mismo MAP), asi que la razon que en v0.40.0 descartaba una fila separadora ("el limite
 *   entre secciones es dinamico") deja de ser un obstaculo: no hace falta "saltear" nada.
 * - EL GRIS PASA A SER POSICIONAL: `=COUNTIF($R$9:R9; "Faltante proyectado")>0` (R9 es el header,
 *   una fila arriba de la primera fila de datos), aplicada con referencia de fila relativa sobre
 *   R10:R29. En la fila N, Sheets reescribe el rango a R9:R(N-1) -- ESTRICTAMENTE arriba de la
 *   fila evaluada. Eso deja afuera a la fila separadora misma (en su propia fila el rango todavia
 *   no la incluye) y marca TODA fila estrictamente debajo, sin excepcion, incluida la cuenta sin
 *   ningun movimiento real (el contraejemplo que en v0.40.0 ya habia descartado un COUNTIF de
 *   "aparece 2+ veces": esa cuenta aparece una sola vez, pero esa unica vez esta siempre debajo
 *   del separador -- la senal no depende de cuantas veces se repite el nombre, solo de la
 *   posicion). Verificado con un simulador fiel del algoritmo mas un simulador de la propia regla
 *   COUNTIF (secciones 5 del banco).
 * - UPGRADE VERSION-PROOF: la planilla real de Franco tenia v0.40.0 ya desplegada (TEXT()/ISTEXT,
 *   sin separador). `_anclaYaEsNuestraTfp` se generalizo para reconocer CUALQUIER version de este
 *   modulo (markers de `_bloqueComunTfp`, compartidos entre versiones, en vez de markers propios
 *   de la formula de armado que SI cambiaron), y una comparacion nueva (`anclaVigente`) decide si
 *   la formula VIVA coincide con la que este modulo escribiria HOY -- si no coincide (formula
 *   cruda de Franco, o una version anterior como v0.40.0), se reescribe. Sin este chequeo,
 *   desplegar v0.41.0 sobre v0.40.0 ya aplicada nunca la hubiera actualizado (la habria confundido
 *   con "ya aplicada, nada que hacer"). Probado en la seccion 2c del banco con un fixture que
 *   reconstruye a mano la forma exacta que escribia v0.40.0.
 * - CAPACIDAD RECALCULADA: la fila separadora consume una de las veinte filas de datos cuando hay
 *   al menos una cuenta con faltante (`capacidad_datos; IF(cant_faltante > 0; 19; 20)` dentro de
 *   la formula). El PEOR CASO garantizado sin truncar (si TODAS las cuentas tuvieran faltante
 *   pendiente) baja de 10 a 9 cuentas -- `_capacidadPeorCasoTfp` pasa de `floor(capacidad/2)` a
 *   `floor((capacidad-1)/2)`.
 * - TOTALES DE FALTANTE SIN FORMATO DE MONEDA (bug reportado aparte, corregido en el mismo
 *   cambio): S8/V8/Y8 nunca tuvieron un `setNumberFormat` propio y salian con el formato general
 *   (`1242057,19` al lado de `$1.138.583,00`). Se leen ahora, en vivo, con `getNumberFormat()`, el
 *   patron del hermano real S7/V7/Y7 -- y se COPIA tal cual a S8/V8/Y8, nunca se inventa un
 *   patron nuevo. El formato previo se respalda celda por celda (fuera de `_respaldarFormulerio`,
 *   que solo fotografia formulas) para que el revert lo devuelva exacto.
 * - INVARIANTE AJUSTADO: el conteo de "nombres distintos" que usa `_verificarInvariantesTfp` para
 *   chequear que ninguna cuenta real se perdio ahora EXCLUYE el rotulo de la fila separadora --
 *   sin la exclusion, ese rotulo sumaba +1 al piso y podia enmascarar una cuenta real perdida por
 *   exactamente uno.
 * - devtools/probar_tablero_faltante.js: banco reescrito para el separador y los montos
 *   numericos. Nueva seccion 2c (upgrade version-proof contra un fixture v0.40.0 reconstruido a
 *   mano), seccion 5 reescrita (simularSeccionesConSeparadorTfp + marcarGrisPorReglaTfp, prueba
 *   por mutacion que la fila separadora nunca se marca a si misma y que la cuenta sin movimiento
 *   real si se marca, con montos siempre numericos), y nueva seccion 10 (copia de formato de
 *   numero de S7/V7/Y7 a S8/V8/Y8, con mutaciones de formula-ok-pero-formato-viejo). Los ocho
 *   bancos del repo (`node devtools/probar_*.js`) corren en verde.
 *
 * [2026-08-21] v0.40.0 - Faltante proyectado: dos secciones (no fila intercalada), totales por construccion.
 * - EL BUG REAL, medido en la planilla: Franco corrio aplicarTableroFaltanteProyectado() (v0.39.0,
 *   layout intercalado: cada cuenta con una fila real y una fila de faltante SIN nombre debajo) y
 *   la propia verificacion lo atrapo y revirtio solo: "el total real paso de 1.138.583 a
 *   3.218.368,47" en Ingresos -- exactamente real + faltante -- y el mismo patron en Gastos Fijos
 *   y Variables. El guard funciono perfecto; el bug era de la formula.
 * - LA CAUSA: los totales pasaron a SUMIF(rango;"<>";monto) para "real" (filas CON nombre) y su
 *   espejo SUMIF(rango;"=";monto) para "faltante" (filas SIN nombre). En Google Sheets, ese
 *   criterio A SECAS (sin operando) no compara el VALOR de la celda contra "" -- pregunta si la
 *   celda "tiene contenido" (formula o dato). Una celda que pertenece a un DERRAME de array y
 *   muestra "" (el resultado de una formula, no un vacio real) CUENTA COMO "CON CONTENIDO". Con
 *   eso, TODAS las filas del derrame (las que tenian nombre Y las que mostraban "") caian del
 *   lado "<>": el total real sumaba real + faltante, y el total de faltantes daba CERO siempre
 *   (ningun SUMIF conseguia una fila que calificara como "vacia" para el criterio "="). El banco
 *   de pruebas daba VERDE con esto roto: su mock en JS solo puede representar "" como string, sin
 *   la distincion Sheets-especifica entre "celda vacia de verdad" y "celda con formula que
 *   devolvio ''" -- un agujero de cobertura, ahora corregido con un evaluador que reproduce el
 *   mecanismo exacto (seccion 3c del banco).
 * - EL PIVOTE DE DISENO (Franco, a mitad de la correccion): el layout objetivo NO es una fila
 *   real + una fila de faltante intercaladas por cuenta. Son DOS SECCIONES dentro del bloque --
 *   arriba TODO lo real, abajo TODO lo faltante, REPITIENDO el nombre de la cuenta (no lo deja
 *   vacio). Esto mata la ambiguedad vacio/cadena-vacia DE RAIZ (ninguna fila de Cuenta esta vacia
 *   nunca), pero tambien mata el unico dato que los totales viejos usaban para separar las dos
 *   secciones -- exige un rediseno completo de totales y del gris, no un parche del criterio.
 * - TOTALES POR CONSTRUCCION (unica opcion viable con el layout nuevo, no solo la preferida): S7
 *   (total real) es SUM(INDEX(<QUERY real de Franco, verbatim>;0;2)) -- suma directo la columna 2
 *   de la QUERY de Franco, sin pasar por el derrame; es matematicamente la MISMA cifra de
 *   siempre, asi que el invariante "el total real no se mueve" se cumple por construccion. S8
 *   (total faltante) reusa el MISMO bloque LET que arma el derrame (_bloqueComunTfp, UNA sola
 *   funcion JS que genera el texto para las dos formulas de Sheets: no pueden desincronizarse) y
 *   suma faltante_por_cuenta sobre el UNIVERSO COMPLETO, no el truncado a la vista.
 * - EL GRIS DE LA SECCION DE FALTANTE: se evaluo un COUNTIF de rango expansivo ("es la 2da+ vez
 *   que aparece este nombre", la primera propuesta) y se DESCARTO -- una cuenta proyectada SIN
 *   ningun movimiento real aparece UNA SOLA VEZ, siempre en la seccion de faltante, y un COUNTIF
 *   de duplicados nunca la marca (quedaria con el tratamiento visual de "real" siendo 100%
 *   faltante). La senal elegida es el TIPO DE DATO de la celda de Monto: la seccion real escribe
 *   un NUMERO; la de faltante, el mismo importe pasado por TEXT() (con el patron de formato que
 *   la celda ya tenia en vivo, leido una sola vez en el preflight). La regla pasa a ser
 *   =ISTEXT($S10): no depende de ninguna otra columna, no tiene la ambiguedad del SUMIF viejo, y
 *   separa las dos secciones sin excepcion, incluidas las cuentas que solo viven en la seccion de
 *   faltante. Limitacion CONOCIDA y aceptada: un numero-como-texto se alinea a la izquierda por
 *   defecto (a diferencia de un numero real, a la derecha) -- ajuste manual si molesta (Formato >
 *   Alinear > Derecha), no automatizado a proposito (evita mutar y tener que respaldar/revertir
 *   una propiedad de formato mas).
 * - LA CAPACIDAD SE RELAJA SOLA: ya no son "10 pares cuenta/faltante" fijos de la version
 *   anterior. Las 20 filas de datos (10 a 29, TFP_FILA_FIN sigue en 30) se reparten dinamico: una
 *   cuenta ya cubierta (faltante = 0) ocupa UNA sola fila, no dos. El peor caso garantizado sin
 *   truncar sigue siendo 10 cuentas (si TODAS necesitaran las dos filas); en la practica entra
 *   mas. Sigue sin abortar nunca por falta de lugar: trunca a la vista (seccion real completa
 *   primero, faltante ordenado de mayor a menor) y avisa en la fila 30, en cursiva.
 * - SIN CAMBIOS DE PRINCIPIO: la QUERY real de Franco se reusa verbatim (nunca se reescribe), lo
 *   proyectado se calcula fresco desde "Proyeccion" agrupado por cuenta con las mismas
 *   conversiones TIDETRACK_*(), faltante = MAX(0; proyectado - real), y una cuenta proyectada sin
 *   ningun movimiento real SIGUE apareciendo -- confirmado explicitamente para el layout nuevo,
 *   es la razon de ser del modulo entero.
 * - devtools/probar_tablero_faltante.js: reescrito para las dos secciones (9 mitades). Incluye el
 *   diagnostico permanente del bug real (seccion 3c, evaluador SUMIF-like que reproduce el
 *   sintoma exacto medido en la planilla real, ambas mitades: total real inflado y total
 *   faltante en cero), la prueba de reuso byte a byte del bloque comun entre la ancla y el total
 *   de faltantes (seccion 1b), la extraccion de la QUERY embebida para una segunda corrida
 *   (_extraerTablaRealTfp, seccion 2b), y el simulador fiel del algoritmo (simularSeccionesTfp,
 *   seccion 5) que prueba POR MUTACION la senal del gris: confirma que ISTEXT marca correctamente
 *   a una cuenta sin ningun movimiento real, y que la alternativa descartada (COUNTIF de
 *   duplicados) NO la habria marcado (count=1, nunca supera 1). 1 falla preexistente sin cambios
 *   (colision R10/U10/X10 con DEVTOOL_FormulerioV0111.js y DEVTOOL_StockYFlujo.js, aceptada desde
 *   v0.38.0. No se toca).
 * NOTA OPERATIVA: se detecto una sesion en paralelo trabajando sobre el mismo worktree
 * (src/DEVTOOL_DIAG_Desplegables.js nuevo, una entrada de menu temporal agregada a
 * MENU_CONFIG en 00_Config.js, y docs/permanente/celdas.tsv refrescado) -- ninguno de esos
 * archivos fue tocado por este cambio; se reporta a Franco en vez de reconciliarlo en silencio.
 * [2026-08-21] v0.39.1 - Duenio unico por celda: se retiran 9 coordenadas stale, los 8 bancos en verde.
 * - DOS DECISIONES DE FRANCO tomadas juntas: (1) retirar toda coordenada que un modulo declara
 *   administrar y que hoy administra otro, y (2) duenio unico para las celdas que tres modulos se
 *   disputaban. Ninguna de las dos es una correccion de bug: es sacar ambiguedad del contrato.
 * - POR QUE IMPORTABA: probar_formulerio arrancaba con 5 FALLA(S) fijas y probar_riqueza con 7.
 *   Doce lineas rojas permanentes que habia que aprender a ignorar -- y un banco con rojo de fondo
 *   es exactamente donde se esconde el rojo nuevo. Es la leccion de la v0.38.4, donde un banco en
 *   verde tapo que StockYFlujo apuntaba a la celda equivocada.
 * - FORM_CELDAS: 13 -> 7 entradas. Cada retiro con su duenio verificado contra el gemelo:
 *     Inicio!F8 y Tablero!AG9:AG12 -> DEVTOOL_StockYFlujo.js. AG9:AG12 NO eran ruido inocuo: esas
 *       filas son hoy el bloque "Tipo de Medios" (AG8 = "Monto") y, con literal:true, este modulo
 *       le aplicaba su reemplazo a una formula viva y ajena. El "Capital" real vive en AG18:AG21.
 *     Tablero!AF9:AF12 -> ESTAN VACIAS; el bloque real se corrio a AF18:AF21 (headers AF17/AG17).
 *     Tablero!N19 -> ESTA VACIA; la escribe DEVTOOL_Capitalizacion.js en O19.
 *     Tablero!R10/U10/X10 y AA10 -> por la decision de duenio unico (abajo).
 * - RIQ_CELDAS: 6 -> 0. CONSECUENCIA QUE SE REPORTA, NO SE OCULTA: con AA10 tambien fuera,
 *   DEVTOOL_RiquezaYCategorias.js no administra ninguna celda. Sus tres publicas ahora lo dicen
 *   explicito ("MODULO SIN CELDAS A CARGO", con el duenio de cada una) en vez de contestar el
 *   mismo "nada que hacer" que daban cuando si tenian trabajo. Retirarlo del menu (00_Config.js)
 *   y del repo QUEDA PENDIENTE DE FRANCO: es sacar un modulo, no reapuntar una coordenada.
 * - DUENIO UNICO:
 *     R10/U10/X10 -> DEVTOOL_TableroFaltanteProyectado.js, que las REESCRIBE empotrando la QUERY
 *       original de Franco. Sale DEVTOOL_FormulerioV0111.js (su _repararFormula reescribe por
 *       patron y podia pisar el envoltorio si el patron viejo reaparecia). SE QUEDA
 *       DEVTOOL_StockYFlujo.js: _apagarArrastreSyf hace cirugia de token -- reemplaza un patron y
 *       devuelve el resto intacto --, asi que respeta el envoltorio corra en el orden que corra.
 *       Compatible por construccion, no por casualidad.
 *     AA10 -> DEVTOOL_BloqueCategorias.js, el unico con trabajo VIGENTE ahi (cambia el eje de
 *       agrupacion al de la categoria de la CUENTA, con preflight por rotulo propio). Lo que hacia
 *       RiquezaYCategorias (columna_ak_vacia -> columna_tipo) ya esta aplicado: medido en el
 *       gemelo, el AA10 vivo no contiene columna_ak_vacia. Por eso el banco daba "SIN CAMBIO".
 * - COMENTARIO FALSO CORREGIDO: la cabecera de DEVTOOL_RiquezaYCategorias.js afirmaba que AA10 era
 *   "EXCLUSIVA de este modulo (ningun otro la escribe)" mientras DEVTOOL_FormulerioV0111.js y
 *   DEVTOOL_BloqueCategorias.js tambien la declaraban. Un comentario que miente cuesta lo mismo
 *   que un guard que miente.
 * - BANCOS -- LOS 8 EN VERDE POR PRIMERA VEZ: probar_formulerio 5 -> SIN FALLAS; probar_riqueza
 *   7 -> SIN FALLAS; probar_tablero_faltante 1 -> TODO OK. Dos guards nuevos, los dos verificados
 *   POR MUTACION antes de darlos por buenos:
 *     (a) tripwire en probar_riqueza: si vuelve a entrar una coordenada a RIQ_CELDAS es FALLA. El
 *         loop que verifica celda por celda sigue existiendo (se comprobo); lo que la falla agrega
 *         es que reabrir una retirada decidida no pueda pasar en silencio.
 *     (b) CONVIVENCIA_OK en la barrida anti-colision de probar_tablero_faltante: permiso EXPLICITO
 *         por modulo Y por celda. Probado que un modulo no autorizado que nombre R10 sigue saliendo
 *         como choque, Y que el autorizado sobre una celda fuera de su permiso (S8) tambien. No es
 *         un silenciador.
 * - REPORTADO, NO RESUELTO: Inicio!C13/F13 las comparten FORM_CELDAS y SYF_ARRASTRE; Inicio!C15/F15
 *   FORM_CELDAS y DEVTOOL_InicioPresupuesto.js. Las tres transformaciones son de token y hoy
 *   conviven, pero no entraron en esta decision de duenio unico.
 *
 * [2026-08-21] v0.39.0 - El bloque de faltante proyectado sube a 30 filas y deja de abortar por falta de lugar.
 * - EL SINTOMA, medido en la planilla real: Franco corrio estadoTableroFaltanteProyectado() y
 *   "Gastos Variables." dio "10 cuenta(s) con movimiento real hoy, y el bloque solo entra 9
 *   pares cuenta/faltante en su capacidad actual (10 a 28). Agrandar el bloque antes de correr
 *   esto: nunca se recorta una cuenta real en silencio." El preflight ABORTABA por diseno: Franco
 *   se quedaba sin la funcionalidad entera por una sola cuenta de mas, y la proxima categoria
 *   nueva iba a repetir el bloqueo. El principio ("nunca se pierde una cuenta real en silencio")
 *   era correcto; la conclusion (abortar) no.
 * - CAMBIO 1, la capacidad: TFP_FILA_FIN (30) es ahora la UNICA fuente de la geometria del
 *   bloque, compartida por los tres (Ingresos/Gastos Fijos/Gastos Variables) -- antes cada uno
 *   repetia "filaFin: 28" por separado. 21 filas (10 a 30) dan 10 pares cuenta/faltante (antes
 *   19 filas / 9 pares) y sobra EXACTAMENTE una fila (21 es impar): esa fila sobrante es donde
 *   vive el aviso de truncado del cambio 2, no un desperdicio.
 * - CAMBIO 2, el importante: el preflight YA NO ABORTA por falta de lugar. La formula
 *   (_formulaCuentasTfp) trunca sola a las `capacidad` cuentas de MAYOR monto -- real
 *   descendente primero, proyectado como desempate, el mismo orden de siempre -- y, si algo
 *   quedo afuera (n_ocultas > 0), la ULTIMA fila del bloque (la reservada por el cambio 1) pasa
 *   a decir "y N cuenta(s) mas" con el monto que representan (real + faltante de las no
 *   mostradas, calculado como el total completo menos el ya mostrado, sin refiltrar). Esa fila
 *   se ve en CURSIVA, misma tinta que el gris de "falta" (TFP_COLOR_GRIS) pero con su propio
 *   tratamiento -- decision Franco: "el gris del faltante ya es un lenguaje establecido en ese
 *   bloque; quizas ese renglon merece su propio tratamiento". Cuando todas las cuentas entran,
 *   esa fila del derrame ni se genera: desaparece sola, no hay que "limpiarla" en otro lado.
 * - Los totales (S7/S8, V7/V8, Y7/Y8) y la regla gris de "falta" pasan a excluir esa fila
 *   reservada (_rangoColTfp ahora corta en filaFin-1, no en filaFin): si la incluyeran, el monto
 *   oculto del aviso se sumaria como si fuera una cuenta real de mas, rompiendo el invariante de
 *   que el total real no se mueve por este refactor. La regla de aviso es una CUARTA regla por
 *   bloque, absoluta en columna Y fila (vive en una sola celda fija), asi que nunca compite por
 *   lugar con la regla gris (que recorre el rango de datos).
 * - decision Franco 2026-08-21 (proyectadas sin registro): SIGUEN apareciendo -- es la razon de
 *   ser del modulo, sacarlas reintroduciria la invisibilidad que el "Faltante proyectado" vino a
 *   resolver. El orden por monto real descendente ya las manda siempre al final (ninguna
 *   proyectada-sin-real puede desplazar a una cuenta con movimiento real) y son las primeras en
 *   truncarse si no entran todas: nada que cablear aparte, es una consecuencia del orden
 *   existente, verificada por test.
 * - estadoTableroFaltanteProyectado() reporta numeros por bloque: cuantas cuentas reales hoy,
 *   cuantas entran, cuantas quedarian afuera (piso GARANTIZADO por el orden real-primero, sin
 *   reimplementar en JS el filtro de "Proyeccion" -- ver decision de diseno #1 del modulo).
 * - _verificarInvariantesTfp pasa de exigir IGUALDAD ESTRICTA (cuentasAhora === cuentasVivas) a
 *   exigir un PISO cuando no hay truncado (el universo union con el catalogo puede sumar cuentas
 *   proyectadas-sin-real ademas de las reales, y eso no es perder nada) y un numero EXACTO
 *   cuando si lo hay (el orden real-primero garantiza que los `capacidad` lugares se llenan SOLO
 *   con cuentas reales). La igualdad estricta vieja habria marcado como falla el caso sano de
 *   "una cuenta proyectada-sin-real se sumo al derrame", revirtiendo una escritura correcta.
 * - devtools/probar_tablero_faltante.js: capacidad y rangos actualizados a la geometria nueva, y
 *   extendido con las mutaciones del truncado -- mas cuentas que capacidad ya NO aborta, exacto
 *   en el limite sin aviso, una cuenta menos sin aviso, el conteo EXACTO (truncado) vs PISO (sin
 *   truncar) del invariante, y las seis reglas de color (3 gris + 3 aviso) en la clasificacion
 *   propia/ajena. 1 falla preexistente SIN CAMBIOS (colision R10/U10/X10 con
 *   DEVTOOL_FormulerioV0111.js, ya diagnosticada y aceptada desde v0.38.0).
 * [2026-08-21] v0.38.4 - El modulo seguia leyendo R9/U9/X9 mientras su banco probaba R10/U10/X10.
 * - EL SINTOMA: dos bancos (probar_stock_flujo.js, probar_riqueza.js) reventaban con
 *   "Cannot read properties of undefined (reading 'replace')". Eso ya se corrigio en la v0.38.0
 *   (guard de _repararFormula) y las referencias R9/U9/X9 de FORM_CELDAS pasaron a R10/U10/X10.
 *   Lo que quedo sin corregir es lo que ese crash tapaba del otro lado: DEVTOOL_StockYFlujo.js.
 * - LA CAUSA: el reacomodo del Tablero del 2026-08-21 (Franco abrio la fila 8 para "Faltante
 *   proyectado") corrio el header "Cuenta" de la fila 8 a la 9 y el derrame de datos de la 9 a la
 *   10. Verificado contra el gemelo: Tablero!R8/U8/X8 = "Faltante proyectado", R9/U9/X9 =
 *   "Cuenta" (sin formula), R10/U10/X10 = la QUERY real. La v0.38.0 corrigio FORM_CELDAS
 *   (DEVTOOL_FormulerioV0111.js), RIQ_BLOQUE_CATEGORIAS y BCAT_CELDA, y actualizo la seccion 5 de
 *   devtools/probar_stock_flujo.js a R10/U10/X10 -- pero no toco el modulo que esa seccion prueba.
 *   DEVTOOL_StockYFlujo.js siguio nombrando R9/U9/X9 en su lista de "apagar el arrastre", no
 *   encontraba formula en el header, y salia por `avisos.push(... 'no tiene formula: se saltea')`.
 * - POR QUE NADIE LO VIO: el banco tenia su PROPIA COPIA de las coordenadas. Actualizar la copia
 *   del banco lo puso en verde probando R10 contra el gemelo, mientras el modulo -- contra la
 *   planilla -- no aplicaba la transformacion a NINGUNA de las tres columnas del Tablero. Un banco
 *   verde sobre codigo que no se ejecuta es peor que un banco en rojo. Es la misma leccion que la
 *   v0.38.0 ya habia escrito para probar_riqueza.js ("la celda se lee de RIQ_BLOQUE_CATEGORIAS.celda
 *   en vez de hardcodearse"), aplicada aca tarde.
 * - EL ARREGLO: SYF_ARRASTRE (nueva, DEVTOOL_StockYFlujo.js) declara las 5 celdas con su ROTULO al
 *   lado -- R10/"Cuenta"@R9, U10, X10, Inicio!C13/"Ingresos."@C12, F13/"Egresos."@F12 --, y
 *   _preflightSyf las verifica por rotulo con _normalizarRotulo y ABORTA si alguno no coincide,
 *   igual que ya hacia con SYF_TIPOS_TABLERO, SYF_SALDOS_TABLERO y SYF_BLOQUE_MEDIOS. Una posicion
 *   se pudre en silencio; un rotulo, no.
 * - devtools/probar_stock_flujo.js deriva su seccion 5 de SYF_ARRASTRE en vez de repetir la lista:
 *   modulo y banco no pueden volver a divergir. C15/F15 se siguen probando aparte, a proposito (ya
 *   no las escribe este modulo -- las reescribe DEVTOOL_InicioPresupuesto -- pero la transformacion
 *   tiene que seguir siendo correcta contra ellas).
 * - "Sin formula" con el rotulo YA verificado deja de ser un aviso mudo: nombra la celda, su nota y
 *   dice que la transformacion no se aplico ahi.
 * - devtools: seis bancos (probar_stock_flujo, probar_riqueza, probar_formulerio, probar_capitalizacion,
 *   probar_formato_medios, probar_presupuesto_base) hardcodeaban RAIZ a la ruta absoluta de un
 *   worktree concreto. Corridos desde cualquier otro worktree leian el src de AQUEL y validaban
 *   codigo que no era el que se estaba editando -- otra forma del mismo verde enganoso. Ahora
 *   derivan RAIZ de __dirname, la convencion que probar_tablero_faltante.js y
 *   probar_inicio_presupuesto.js ya usaban.
 * - VERIFICADO POR MUTACION: con SYF_ARRASTRE devuelta a R9/U9/X9, probar_stock_flujo.js pasa de
 *   SIN FALLAS a 3 FALLA(S) nombrando celda y contenido real ("Tablero!R9: hoy tiene 'Cuenta'").
 *   Restaurado, vuelve a SIN FALLAS. Los 8 bancos corren desde este worktree con los mismos
 *   resultados que el baseline: probar_riqueza 7 FALLA(S) y probar_formulerio 5 FALLA(S) (ambas
 *   documentadas como deliberadas en la v0.38.0), probar_tablero_faltante 1 FALLA, el resto limpio.
 * - HALLAZGO REPORTADO, NO RESUELTO: al declarar R10/U10/X10 en SYF_ARRASTRE, la barrida
 *   anti-colision de probar_tablero_faltante.js (seccion 8) ahora acusa TRES modulos sobre esas
 *   celdas -- DEVTOOL_FormulerioV0111.js (ya reportado en v0.38.0), DEVTOOL_TableroFaltanteProyectado.js
 *   y ahora, explicitamente, DEVTOOL_StockYFlujo.js. No es una colision nueva: es la que existia
 *   sin declararse, porque el modulo apuntaba a la celda equivocada. Es menos riesgosa que la de
 *   Formulerio: _apagarArrastreSyf hace CIRUGIA DE TOKEN sobre la formula viva (reemplaza un
 *   patron y deja el resto intacto), asi que respeta el envoltorio que TFP le pone alrededor a la
 *   QUERY de Franco, corra en el orden que corra. Hoy ademas es un no-op: la formula viva ya
 *   excluye el arrastre. Que los tres modulos se declaren duenios de la misma celda sigue siendo
 *   una decision de Franco, no una correccion de coordenada.
 * - NO SE DESPLEGO. Cambios solo en el repo.
 *
 * [2026-08-21] v0.38.3 - El guard de las auxiliares se bloqueaba a si mismo en la segunda corrida.
 * - EL SINTOMA, reportado por Franco: con DEVTOOL_InicioPresupuesto.js ya aplicado, correr
 *   "2. Aplicar" de nuevo abortaba en el preflight con "las celdas auxiliares de los deltas
 *   (AW8, AW9, AW10) no estan vacias". Franco tuvo que "3. Revertir" y volver a aplicar para
 *   poder correr el modulo una segunda vez.
 * - LA CAUSA: AW8:AW10 no tenian ningun intruso -- tenian el PROMEDIO que la propia corrida
 *   anterior habia calculado, el derrame del HSTACK(tendencia; promedio) de
 *   _tendenciaYPromedioIp que vive en la celda ancla AV8/AV9/AV10 (ver la cabecera de IP_AUX,
 *   DEVTOOL_InicioPresupuesto.js). El preflight (paso 8) exigia esa zona VACIA sin excepcion, y
 *   en la SEGUNDA corrida nunca lo esta: el guard se bloqueaba contra su propio resultado.
 * - EL ARREGLO: _auxAjenaIp / _auxiliaresAjenasIp (nuevas) reemplazan el chequeo "sin formula y
 *   con valor" en las dos celdas por igual, por uno que distingue PROPIO de AJENO. La celda
 *   ANCLA (AV8/AV9/AV10) es la UNICA de toda la hoja que puede tener una formula que derrame
 *   HSTACK a su derecha -- esa zona es exclusiva de este modulo, medida sin ningun contenido
 *   antes de la primera corrida --, asi que CUALQUIER formula ahi, sea cual sea su TEXTO, solo
 *   pudo haberla puesto una corrida anterior de este mismo modulo. No hace falta comparar esa
 *   formula contra lo que _formulaAuxCapitalIp/_formulaAuxFlujoIp generan HOY: es la misma
 *   leccion que _esFormulaDeDeltaIp ya aplico del lado del color en v0.38.2 (reconocer por lo que
 *   NO cambia entre generaciones, no por la forma exacta de hoy), evitando que el guard vuelva a
 *   romperse el dia que la formula pesada cambie de forma.
 * - LA CELDA DE PROMEDIO (_celdaPromedioIp) en cambio NUNCA tiene una formula propia -- HSTACK no
 *   deja formula en la celda de al lado, solo el valor derramado. Si la tuviera, es ajena
 *   SIEMPRE, sin importar el estado del ancla: alguien escribio una formula de verdad justo
 *   donde el HSTACK necesita derramar. El preflight sigue abortando, con el mismo mensaje
 *   detallado, ante contenido genuinamente ajeno -- solo dejo de confundir el resultado de su
 *   propia corrida anterior con una invasion.
 * - devtools/probar_inicio_presupuesto.js (seccion 14, nueva): reproduce el bug con las FORMULAS
 *   REALES que el modulo escribe (una segunda corrida ya no bloquea), prueba la robustez ante una
 *   formula pesada de forma futura (se reconoce por presencia de formula, no por texto exacto), y
 *   verifica por mutacion que aflojar la deteccion a "texto exacto" o quitar el chequeo de la
 *   formula propia del promedio deja de proteger contra contenido ajeno de verdad -- incluida la
 *   reconstruccion del guard VIEJO (valor-only), que SI reproduce el bug reportado contra la
 *   salida de su propia corrida anterior, confirmando que el fix es lo que lo resuelve.
 *
 * [2026-08-21] v0.38.2 - Dos deltas quedaban con el color invertido: reglas de v0.34.0 sobrevivian mudas.
 * - EL SINTOMA, visto en la planilla: Ingresos cayo 52,7% y se pintaba EN VERDE; Egresos cayo
 *   50,5% y se pintaba EN ROJO -- las dos al reves (Capital estaba bien). Diagnosticado leyendo
 *   el panel de formato condicional sobre C15: habia CUATRO reglas donde debia haber dos.
 *     =$C$15>0  -> verde   (generacion v0.34.0, sobrevivio)
 *     =$C$15<0  -> rojo    (generacion v0.34.0, sobrevivio)
 *     =$AV$9>0  -> verde   (generacion v0.38.1, correcta)
 *     =$AV$9<0  -> rojo    (generacion v0.38.1, correcta)
 * - EL MECANISMO: C15/F15 son TEXTO desde v0.37.0 (flecha + tendencia + promedio concatenados),
 *   y en Google Sheets un TEXTO compara SIEMPRE mayor que cualquier numero. "=$C$15>0" contra una
 *   celda de texto no lanza error -- da VERDADERO sin condicion -- y como esa regla va primera en
 *   el orden de evaluacion, le gana a la regla correcta que esta al lado con la formula perfecta.
 *   En Ingresos eso pinta verde (la regla de "sube" es verde ahi); en Egresos pinta rojo (la
 *   regla de "sube" en egresos es roja). Las dos invertidas, perfectamente consistente con la
 *   explicacion, y sin ninguna excepcion ni log que lo delatara: el unico sintoma es el color.
 * - POR QUE SOBREVIVIERON: _clasificarReglasIp (DEVTOOL_InicioPresupuesto.js) solo reconocia como
 *   "propia" la lista EXACTA de las seis formulas de la generacion vigente (_formulasPropiasIp,
 *   comparacion string contra la auxiliar AV8/AV9/AV10). Las reglas de v0.34.0 evaluaban la
 *   PROPIA celda del delta (correcto cuando esa celda todavia era numero), no matcheaban esa
 *   lista, caian en el monton "ajenas" y aplicarInicioPresupuesto() las reponia INTACTAS en cada
 *   corrida -- huerfanas para siempre, ni se reemplazaban ni se quitaban. Es EXACTAMENTE el mismo
 *   bug de identificacion que el comentario de _esReglaPropiaFmt ya documenta en
 *   DEVTOOL_FormatoMedios.js, escrito el mismo dia, en otro modulo: identificar una regla propia
 *   por la forma EXACTA de HOY deja huerfana a cualquier generacion anterior.
 * - EL ARREGLO, generalizado (no un parche puntual para esta generacion): se agrega
 *   _esFormulaDeDeltaIp, que reconoce una regla propia por lo que NO cambia entre generaciones --
 *   el rango es exactamente UNA celda de delta, y la formula es una comparacion contra cero de
 *   UNA sola referencia de celda absoluta (=$COL$FILA>0 o =$COL$FILA<0) -- sin exigir que esa
 *   referencia sea la auxiliar de hoy. Cubre por igual la generacion actual (=$AV$9>0, evalua la
 *   auxiliar) y la de v0.34.0 (=$C$15>0, evaluaba la celda visible), y a cualquier generacion
 *   futura si la auxiliar vuelve a mudarse de columna: no hace falta volver a tocar este codigo.
 *   _clasificarReglasIp usa esta funcion en vez de la lista exacta; el resto de la clasificacion
 *   (superadas / ajenas / desbordan, y la guarda contra reglas que se extienden fuera de un
 *   delta) queda intacto.
 * - QUE PASA AL APLICAR Y AL REVERTIR: las reglas de generacion anterior ahora caen en "propias"
 *   y se BARREN al aplicar (aplicarInicioPresupuesto() solo reescribe las ajenas + las seis
 *   correctas, nunca reproduce lo que estaba en propias). NO se reponen al revertir, a
 *   diferencia de las reglas "superadas" (texto contiene, que SI se fotografian y se restauran):
 *   una regla superada es una preferencia de estilo de Franco que perdio efecto por una razon
 *   ajena a ella; una regla de generacion anterior de ESTE MISMO mecanismo hoy evalua contra cero
 *   una celda de texto, lo que en Sheets da un falso positivo PERMANENTE -- reponerla en un
 *   revert reintroduciria exactamente el bug que esta version corrige. Documentado inline en
 *   revertirInicioPresupuesto() con la razon completa.
 * - AGUJERO DE BANCO TAPADO: la seccion 11b de probar_inicio_presupuesto.js probaba
 *   _clasificarReglasIp con reglas propias de la generacion actual y con reglas de texto viejas,
 *   pero nunca junto dos generaciones de CUSTOM_FORMULA sobre la MISMA celda de delta -- por eso
 *   nunca agarro este bug. Se agrega la reconstruccion exacta del caso real: cuatro reglas sobre
 *   C15 (dos de v0.34.0 + dos de hoy), verificado por mutacion que las CUATRO clasifican como
 *   propias y que _reglasHacenFaltaIp da true. Se suma ademas una asercion sobre el hecho de
 *   Sheets que hace esto peligroso -- que ninguna de las SEIS reglas que el modulo efectivamente
 *   ESCRIBE (_reglasDeUnDeltaIp) evalua la celda de texto visible que pinta, confirmando que un
 *   ">0"/"<0" contra esa celda nunca puede colarse de nuevo sin que el banco lo note.
 *
 * [2026-08-21] v0.38.1 - El patron con coma decimal era al reves; las auxiliares se veian.
 * - LA CORRIDA DE v0.37.0 SALIO MAL EN LA PLANILLA REAL: "82,0%" se vio "133%" (perdio el
 *   decimal), "promedio $211.073,04" se vio "$211.073,04333" (5 decimales de mas), "$16.725,60
 *   inyectados" se vio "$16.725,6000" (4 decimales de mas). Revertido en el momento con
 *   revertirInicioPresupuesto() (la hoja volvio a formulas y colores de v0.34.0); esta version
 *   arregla los dos defectos y deja el modulo listo para volver a correr.
 * - DEFECTO 1 (decimales): el comentario de DEVTOOL_InicioPresupuesto.js afirmaba que TEXT() "SI
 *   es sensible al locale" y que por eso el patron de formato iba con coma decimal (al reves de
 *   setNumberFormat). ERA FALSO. Medido en la planilla real el 2026-08-21, escribiendo las dos
 *   variantes por setFormula (nunca tipeadas a mano: la UI traduce al tipear, la API no) sobre
 *   numeros conocidos:
 *     TEXT(0,82; "0,0%")                -> "82%"              (coma: PIERDE el decimal)
 *     TEXT(0,82; "0.0%")                -> "82,0%"            (punto: correcto)
 *     TEXT(211073,043333; "$ #.##0,00") -> "$ 211.073,04333"  (coma: decimales de sobra)
 *     TEXT(211073,043333; "$ #,##0.00") -> "$ 211.073,04"     (punto: correcto)
 *   TEXT() se comporta EXACTAMENTE como setNumberFormat: el patron va SIEMPRE canonico (punto
 *   decimal, coma de miles), sin excepcion de locale -- lo que sigue el locale es el RENDERIZADO
 *   final, no el patron que se escribe. Es la TERCERA vez en el mismo dia que una afirmacion
 *   sobre locale sin medir cuesta un bug (v0.32.2, v0.33.0): el comentario se corrigio con la
 *   medicion literal en vez de solo cambiar el valor. IP_PATRON_PORCENTAJE pasa de '0,0%' a
 *   '0.0%'; IP_PATRON_MONEDA de '$#.##0,00' a '$ #,##0.00' (con el espacio despues del "$" que
 *   ya usan las 93 formulas propias de Franco en la hoja).
 * - DEFECTO 2 (auxiliares visibles): las celdas de trastienda de los tres deltas (AV8:AW10)
 *   quedaban VISIBLES -- numeros sueltos a la derecha del lienzo de Inicio, rompiendo el diseno.
 *   Medido: los otros dos motores de la hoja (T:AG, AH:AT) estan TODOS con
 *   isColumnHiddenByUser()=true; AV/AW daban false. _ocultarAuxiliaresIp() les da el mismo
 *   tratamiento (hoja.hideColumns, columna derivada de IP_AUX, nunca hardcodeada);
 *   aplicarInicioPresupuesto() la llama despues de escribir y verificar, y
 *   revertirInicioPresupuesto() destapa las columnas SOLO si fue este modulo el que las oculto
 *   (si Franco ya las tenia ocultas por su cuenta, revertir no le toca esa decision).
 * - AGUJERO DE BANCO TAPADO: probar_inicio_presupuesto.js daba SIN FALLAS con el patron
 *   equivocado -- solo comprobaba que la constante fuera igual a si misma, nunca la convencion.
 *   Las dos aserciones nuevas (sin coma en el patron de porcentaje; patron de moneda con punto
 *   decimal) verifican la PROPIEDAD, no un literal. Verificado por mutacion: revertir las dos
 *   constantes al patron con coma hace fallar el banco en las 4 lineas correctas (confirmado y
 *   restaurado). Se agrego ademas la seccion 13 (estructura de _ocultarAuxiliaresIp/
 *   _mostrarAuxiliaresIp) y se de-hardcodeo el patron de moneda en los tests de F10 (usaban el
 *   literal viejo escapado en un regex, que hubiera quedado obsoleto con el cambio).
 * - Diagnostico temporal: la medicion se hizo con una funcion agregada solo para esto
 *   (_DIAG_medirPatronYAuxIp), corrida por Franco desde una entrada de menu igualmente temporal.
 *   Las dos se retiraron del codigo apenas se leyo el resultado; no tocan produccion.
 *
 * [2026-08-21] v0.38.0 - Cuatro direcciones se corrieron una fila; los bancos ahora lo notan solos.
 * - CONTEXTO: Franco reacomodo el Tablero a mano el 2026-08-21 para dejar lugar al bloque
 *   "Faltante proyectado" (DEVTOOL_TableroFaltanteProyectado.js, v0.36.0): en los cuatro bloques
 *   de agregacion (Ingresos, Gastos Fijos, Gastos Variables, Categorias) el header que vivia en
 *   la fila 8 paso a la 9, y el derrame de datos que vivia en la 9 paso a la 10. Cuatro
 *   direcciones cableadas en DEVTOOL_FormulerioV0111.js (FORM_CELDAS) y una en
 *   DEVTOOL_RiquezaYCategorias.js / DEVTOOL_BloqueCategorias.js quedaron apuntando al HEADER en
 *   vez del derrame. Medido por ROTULO contra el gemelo (docs/permanente/celdas.tsv), nunca por
 *   coordenada memorizada.
 * - CORREGIDO, verificado contra el gemelo y matado por mutacion (revertir la coordenada y
 *   confirmar que el banco correspondiente lo acusa, despues restaurar):
 *     Tablero!R9  -> R10  (FORM_CELDAS, "Ingresos por cuenta")
 *     Tablero!U9  -> U10  (FORM_CELDAS, "Gastos fijos por cuenta")
 *     Tablero!X9  -> X10  (FORM_CELDAS, "Gastos variables por cuenta")
 *     Tablero!AA9 -> AA10 (FORM_CELDAS "Agregado por categoria", RIQ_BLOQUE_CATEGORIAS.celda,
 *                          DEVTOOL_BloqueCategorias.js BCAT_CELDA)
 *     Tablero!AB8 -> AB9  (RIQ_BLOQUE_CATEGORIAS.celdaRotuloTipo, el rotulo "Tipo")
 *     Tablero!L28 -> L29  (FORM_CELDAS "Comprobacion de traspasos": el TITULO bajo de L27 a L28
 *                          por el mismo rediseno, y la formula -- que ya vivia una fila debajo de
 *                          su titulo -- la siguio de L28 a L29)
 * - PREFLIGHT POR ROTULO NUEVO, para que esto no vuelva a pasar en silencio:
 *     - DEVTOOL_FormulerioV0111.js: FORM_CELDAS gana los campos opcionales rotuloCelda/
 *       rotuloEsperado; _verificarRotulosFormulerio() los recorre y _preflightFormulerio() ABORTA
 *       el modulo entero si alguno no coincide. Verificado por mutacion: mockeando R9="Fecha" en
 *       vez de "Cuenta", el preflight lo detecta y lista la celda, lo que dice y lo que se
 *       esperaba.
 *     - DEVTOOL_BloqueCategorias.js: _preflightRotuloBcat() nuevo, verifica AA9="Nombre" antes de
 *       tocar AA10 en estado y en aplicar. Verificado por mutacion (rotulo mockeado a "Cuenta").
 *     - DEVTOOL_RiquezaYCategorias.js ya tenia este preflight (rotuloTipoOk contra
 *       celdaRotuloTipo); solo se corrigio la coordenada. Verificado con la MISMA logica de
 *       comparacion mockeando AB8 vacia (la direccion vieja): el chequeo pasa de true a false.
 * - INVESTIGADO, NO INVENTADO -- Tablero!N19 ("Capitalizacion real del mes", declarada en
 *   FORM_CELDAS y en RIQ_CELDAS) esta VACIA en el gemelo: sin formula y sin valor. NO es un
 *   efecto del reacomodo del 2026-08-21: quedo obsoleta un dia antes, el 2026-08-20, cuando el
 *   rediseno manual de Franco sobre L7:O19 movio los montos de la columna N a la O ("los montos
 *   pasaron de N a O" -- ver DEVTOOL_Capitalizacion.js). Hoy esa celda la escribe
 *   DEVTOOL_Capitalizacion.js en Tablero!O19 (decision Franco 2026-08-20: "N19 no debe ser una
 *   resta de descarte. Aca si va el valor registrado del mes"), con su propio preflight por
 *   rotulo (L19="Capacidad de Capitalizacion") y verificado contra el gemelo: O19 hoy calcula
 *   -$59.989,12 con exactamente la logica que Franco pidio (flujo neto medido hacia Ahorros +
 *   Inversiones, excluyendo el arrastre "Inicio Mes"). No se toco: ni se escribio una formula
 *   nueva en N19 ni se borro la declaracion vieja, se documento el hallazgo inline en los dos
 *   modulos que la declaran.
 * - INVESTIGADO -- Tablero!AG9:AG12 e Inicio!F8 (RIQ_CELDAS): probar_riqueza.js los reportaba
 *   "SIN CAMBIO: el patron no matcheo" y la pregunta era si eso es idempotencia (correcto) o
 *   desalineacion (bug). Diagnostico, celda por celda:
 *     - Inicio!F8: pertenece a DEVTOOL_InicioPresupuesto.js desde v0.32.0. Su formula viva ya
 *       tiene la condicion de riqueza en lista blanca incorporada con una estructura entera
 *       distinta (MAP/LAMBDA por corte de "Inicio Mes"); el patron de RIQ_CELDAS busca la forma
 *       VIEJA (tipos_proy<>"Hogar") que ya no existe ahi. No le pertenece mas a este modulo.
 *     - Tablero!AG9:AG12: en el layout de HOY hay DOS bloques distintos con esas coordenadas. Las
 *       filas 9-12 son el bloque "Tipo de Medios" (nuevo, DEVTOOL_StockYFlujo.js
 *       SYF_TIPOS_TABLERO, agrupa por Ahorros/Financiacion/Hogar/Inversiones -- ES OTRA COSA). El
 *       bloque que RIQ_CELDAS declara administrar ("Capital ARS/USD/AUD/EUR") se corrio a las
 *       filas 18-21 (SYF_SALDOS_TABLERO) cuando "Tipo de Medios" se inserto arriba. Confirmado
 *       contra el gemelo: AG18:AG21 tienen HOY la formula que agrupa por moneda; AG9:AG12 tienen
 *       una formula que agrupa por AE9:AE12 (los cuatro tipos). Ninguna de las dos es trabajo de
 *       este modulo: DEVTOOL_StockYFlujo.js ya escribe y verifica el bloque de las filas 18-21
 *       con su propio preflight por rotulo.
 *   RIQ_CELDAS no se edita para sacar estas tres entradas: se documenta el hallazgo inline (no
 *   inventar una formula sin que Franco decida si formalmente se retiran).
 * - CRASH CORREGIDO -- _conTipoEnCategorias() (DEVTOOL_RiquezaYCategorias.js) moria con
 *   "Cannot read properties of undefined (reading 'replace')" al recibir la celda de AA9 (ya sin
 *   formula, corrida a AA10) desde probar_riqueza.js. Mismo criterio que _repararFormula en
 *   v0.36.1: una celda sin formula es un estado, no un error; ahora devuelve la entrada intacta
 *   si no es un string no vacio, y quien llama hace el diagnostico.
 * - BANCOS ENDURECIDOS -- "la celda que el modulo declara administrar no tiene formula" dejo de
 *   ser benigno en TRES bancos, no solo en el que reporto el sintoma:
 *     - devtools/probar_stock_flujo.js: imprimia "(sin snapshot) Tablero!R9" para las tres
 *       celdas corridas y terminaba en "SIN FALLAS" -- exactamente el modo de falla que este repo
 *       viene sufriendo, un banco en verde sobre una geometria que ya cambio. Ahora es FALLA, con
 *       mensaje de que celda y que se encontro en su lugar (rotulo o valor via un mapa VALOR
 *       ademas del mapa FORMULA que ya leia del gemelo). Los tres nombres de celda de la seccion
 *       5 se actualizan a R10/U10/X10.
 *     - devtools/probar_riqueza.js: la misma indulgencia en la seccion 1 (las 6 celdas de
 *       RIQ_CELDAS) se vuelve FALLA; la celda del bloque de categorias se lee de
 *       RIQ_BLOQUE_CATEGORIAS.celda en vez de hardcodearse "Tablero!AA9", asi que sigue
 *       probando la celda correcta aunque se vuelva a corregir. De paso: prueba explicita de que
 *       _conTipoEnCategorias(undefined) y ('') no explotan.
 *     - devtools/probar_formulerio.js: mismo endurecimiento en la seccion 1 (FORM_CELDAS) y la
 *       seccion 4 (FORM_MONEDA_INICIO). CONSECUENCIA ACEPTADA: este banco pasa de "SIN FALLAS" a
 *       5 FALLA(S) fijas -- AF9:AF12 y N19, los cinco stale ya documentados arriba -- hasta que
 *       Franco decida retirarlos de FORM_CELDAS o quede satisfecho con que otros modulos ya los
 *       administran. Es la senal funcionando, no una regresion: antes esos cinco pasaban en
 *       silencio.
 * - HALLAZGO NUEVO, NO RESUELTO -- al corregir FORM_CELDAS a R10/U10/X10, la barrida anti-colision
 *   de devtools/probar_tablero_faltante.js (seccion 8, preexistente) empezo a acusar que
 *   DEVTOOL_FormulerioV0111.js y DEVTOOL_TableroFaltanteProyectado.js nombran las MISMAS tres
 *   celdas. Es real: los dos modulos declaran administrar R10/U10/X10. Verificado que hoy es
 *   INOCUO -- el "anclas" de FORM_CELDAS busca el patron viejo "AL9:AL" y ni la formula real de
 *   Franco ni la version envuelta por TFP lo contienen (ambas ya usan AL6:AL), asi que
 *   _repararFormula es un no-op contra las dos --, pero es fragil: si alguna vez el patron viejo
 *   reaparece, aplicar "Formulerio v0.11" DESPUES de "Tablero Faltante Proyectado" reescribiria
 *   una celda que hoy es territorio exclusivo de TFP. No se resuelve aca (retirar la entrada de
 *   FORM_CELDAS es una decision de Franco, no una correccion de coordenada); queda reportado.
 * - Version: 0.37.1 -> 0.38.0. Se corrige de paso la incoherencia entre VERSION.patch (quedo en 1
 *   con la v0.37.0) y VERSION.releaseName (decia "v0.37.0"): a partir de aca major.minor.patch
 *   coincide siempre con lo que dice releaseName.
 * - NO SE DESPLEGO. Cambios solo en el repo (branch fix/tablero-pendientes); el deploy real a la
 *   planilla lo hace Franco por sync_targets.command.
 *
 * [2026-08-21] v0.37.0 - Los deltas dicen cuanto, no solo cuanto por ciento.
 * - PEDIDO (Franco): "Podes ponerme ingresos / egresos y capitalizacion promedio? Como para
 *   entender valores y por que estamos para arriba o para abajo en el mes". Aclaracion: va
 *   concatenado en los mismos tres deltas del resumen (F10 capital, C15 ingresos, F15 egresos),
 *   no en una tarjeta nueva. Y despues: "cuanto capital se inyecto o retiro en el periodo de
 *   analisis", solo para F10.
 * - F10/C15/F15 PASAN DE NUMERO A TEXTO. Un formato de numero puede llevar texto FIJO (las
 *   flechas de v0.34.0) pero no puede embeber un VALOR CALCULADO como el promedio. Eso rompe dos
 *   cosas a la vez: el formato con flechas deja de aplicar sobre texto (se concatena a mano), y
 *   las seis reglas de color de v0.34.0 -- que miraban "=$F$10>0" -- mueren en silencio sobre un
 *   texto, la MISMA superficie del bug de esa manana. No se repite: las reglas pasan a apuntar
 *   a una celda AUXILIAR NUMERICA nueva (IP_AUX), nunca al texto visible.
 * - CELDAS AUXILIARES DE TRASTIENDA (AV8/AV9/AV10 + su promedio derramado en AW). Medido contra
 *   el gemelo (celdas.tsv, refrescado antes de medir): el motor de la hoja usa T:AF y AH:AT con
 *   AG en blanco entre los dos, angosto y encajado entre dos motores que spillean -- no es lugar
 *   para escribir a mano. De AU en adelante no hay NINGUNA celda con contenido en toda la hoja
 *   Inicio: ahi van las auxiliares, con AU de separador (misma convencion que el propio AG).
 * - LA SERIE PESADA SE CALCULA UNA SOLA VEZ. Cada delta arma su serie de 6 meses con un MAP+FILTER
 *   (en Capital, ademas, un FILTER por cada medio dentro de cada mes): calcularla dos veces --
 *   tendencia por un lado, promedio por otro -- duplicaria ese costo. Una sola formula por delta
 *   devuelve HSTACK(tendencia; promedio): la tendencia queda en la celda ancla y el promedio
 *   DERRAMA una columna a la derecha, por construccion.
 * - F10 SUMA UN TERCER DATO: cuanto capital se inyecto o retiro en el mes elegido. Ese numero YA
 *   EXISTE (Inicio!E22, la misma _formulaHaciaRiqueza que alimenta Tablero!O19): se REFERENCIA la
 *   celda, no se llama de nuevo a la formula ni se reescribe su logica -- es LA MISMA celda leida
 *   dos veces, no dos formulas iguales que podrian divergir. "inyectados" si es positivo,
 *   "retirados" si es negativo (en valor absoluto: la palabra ya dice el signo), y una frase
 *   aparte si da cero.
 * - LA INCONSISTENCIA QUE DESTAPA EL CAMBIO, resuelta: F10 anclaba su ventana de 6 meses a
 *   TODAY() ("el capital es un stock, no se filtra por periodo") mientras C15/F15 anclaban al
 *   SELECTOR de mes/anio. Invisible mientras nadie miraba el numero; con el promedio y el flujo
 *   al lado, media linea reaccionaria al filtro de mes y la otra mitad no. F10 pasa a anclar
 *   tambien al selector. Coincide con HOY en el mes en curso (por eso esta corrida no cambia
 *   nada visible) y solo cambia de verdad al mirar un mes pasado. OJO: F8 (Capital Acumulado, de
 *   DEVTOOL_StockYFlujo, fuera de jurisdiccion de este modulo) sigue anclado a HOY -- si el
 *   selector se mueve a un mes pasado, F8 y F10 van a hablar de momentos distintos en la misma
 *   pantalla. Reportado a Franco, no resuelto aca.
 * - EL GUARDIAN ISNUMBER en F10: depende de su auxiliar y de E22, las dos con TIDETRACK_* adentro
 *   y por lo tanto capaces de mostrar "Loading..." mientras la cotizacion resuelve (la cicatriz
 *   de E22 en v0.31.0). F10 revisa ISNUMBER() de las tres entradas ANTES de armar la frase: si
 *   alguna todavia no es numero, devuelve esa misma celda pendiente tal cual en vez de arriesgar
 *   un texto con forma de dato pero sin serlo.
 * - El banco prueba, con mutaciones dirigidas: la regla de color apuntando a la celda de texto en
 *   vez de a la auxiliar (el bug de esa manana, reconstruido a proposito), la serie pesada
 *   calculada dos veces, F10 anclado a TODAY() en vez del selector, el flujo reimplementado en
 *   vez de leer E22, el monto del flujo con signo Y con la palabra a la vez, y la palabra
 *   invertida (positivo mostrando "retirados").
 * - NOTA DE CONCURRENCIA: esta version se escribio en paralelo a la v0.36.0 (Tablero,
 *   sesion distinta sobre DEVTOOL_TableroFaltanteProyectado.js). La v0.36.0 llego a VERSION
 *   primero y se llevo ese numero; esta entrada nacio como "v0.35.0" mientras las dos convivian
 *   en el mismo archivo y se renumero a v0.37.0 para no chocar. No toca ninguno de los archivos
 *   de esa otra sesion (00_Config.js, DEVTOOL_StockYFlujo.js, DEVTOOL_FormatoMedios.js).
 *
 * [2026-08-21] v0.36.1 - Un modulo que busca formulas rotas no puede morir en la primera.
 * - _repararFormula tiraba "Cannot read properties of undefined (reading 'replace')" cuando la
 *   celda que le tocaba no tenia formula. Una celda sin formula NO es un error, es un estado:
 *   pasa cada vez que la geometria de la hoja se mueve y una direccion de FORM_CELDAS queda
 *   apuntando a un rotulo o a una celda vacia.
 * - EL CRASH TAPABA LA SENAL. Dos bancos quedaron sin poder correr (probar_stock_flujo,
 *   probar_riqueza) y por eso nadie vio lo que estaban por decir: que despues del reacomodo
 *   manual del Tablero del 2026-08-21, CUATRO direcciones de FORM_CELDAS quedaron una fila
 *   corridas -- Tablero R9/U9/X9 (los tres bloques de cuentas) y AA9 (Categorias) ahora son la
 *   fila de headers, y sus formulas viven en la fila 10. Un modulo cuyo trabajo es detectar
 *   formulas desalineadas no puede morirse al encontrar la primera.
 * - Con el arreglo, probar_riqueza vuelve a correr y reporta 5 hallazgos reales, y
 *   probar_stock_flujo llega hasta el final. Las direcciones en si NO se corrigen aca: eso es
 *   un cambio de geometria que va con su propia verificacion contra la planilla viva.
 *
 * [2026-08-21] v0.36.0 - Cada cuenta dice tambien cuanto le falta.
 * - PEDIDO (Franco): en los bloques de cuentas de Ingresos, Gastos Fijos y Gastos Variables del
 *   Tablero, cada cuenta pasa a ocupar DOS FILAS: arriba el nombre y lo REALMENTE registrado en
 *   el mes (oscuro, como ya estaba); abajo, sin nombre, el FALTANTE proyectado para esa cuenta
 *   este mes (gris). Franco eligio esta opcion sobre agregar una columna nueva o mostrar solo un
 *   total. Categorias y el resto del Tablero quedan sin tocar.
 * - LA FORMULA "REAL" DE FRANCO (R10/U10/X10: una QUERY que agrupa el motor del Tablero por
 *   cuenta) SE REUSA VERBATIM, nunca se reescribe. El preflight la lee de la celda ancla,
 *   verifica su forma (QUERY, SUM(Col2), GROUP BY Col1, la categoria correcta) y la empotra tal
 *   cual dentro de un LET nuevo. Reconstruirla en JS arriesgaba un desvio sutil -- una cuenta que
 *   el ledger tiene y el catalogo no, que la QUERY data-driven de Franco SI captura.
 * - LO PROYECTADO se calcula fresco, cuenta por cuenta, desde "Proyeccion" (mismo criterio que
 *   Tablero!N9:N11: selectores $N$2/$N$3/$N$4, exclusion de cuentas neutras, conversion con
 *   TIDETRACK_*() en vivo porque un previsto no tiene TC congelado), sobre el universo de
 *   cuentas = catalogo del bloque UNION las que ya aparecen en lo real. FALTANTE = MAX(0;
 *   proyectado - real): nunca negativo, y una cuenta proyectada sin ningun movimiento real
 *   aparece igual, con su faltante completo -- si no, quedaba invisible.
 * - LAS DOS FILAS SE INTERCALAN EN LA MISMA FORMULA (SEQUENCE + MOD deciden fila par/impar), asi
 *   que siguen siendo UNA sola formula anclada en R10/U10/X10: no hay una segunda formula
 *   "faltante" aparte que se pudiera desalinear de la primera en un recalculo.
 * - EL BLOQUE NO CRECE. S7=SUM(S10:S28) ya definia la capacidad viva: 19 filas, 9 pares
 *   cuenta/faltante como mucho (ARRAY_CONSTRAIN a la capacidad, ordenado por real y despues por
 *   proyectado). El preflight cuenta las cuentas reales de HOY y aborta si esa cantidad sola ya
 *   supera la capacidad: una cuenta real nunca se recorta en silencio, primero hay que agrandar
 *   el bloque.
 * - LOS TOTALES SE REESCRIBEN: S7 pasa de SUM (que ahora sumaria real+faltante mezclados) a
 *   SUMIF(R10:R28;"<>";S10:S28) -- solo las filas CON nombre. El nuevo S8 es el espejo exacto:
 *   SUMIF(R10:R28;"=";S10:S28), las filas SIN nombre. Se verifica al releer que el total real NO
 *   se movio ni un centavo por este refactor.
 * - EL GRIS ES FORMATO CONDICIONAL (AND(cuenta vacia; monto no vacio) sobre la columna Monto),
 *   nunca pintura: el bloque es un derrame que se reordena en cada recalculo. Separador ';'
 *   siempre (con coma la regla no parsea en es_AR y no pinta, sin avisar -- la misma trampa
 *   medida en v0.33.0); las reglas ajenas de la hoja se reponen intactas y por referencia.
 * - IDEMPOTENCIA: una formula ya aplicada por este modulo se reconoce (_anclaYaEsNuestraTfp) y
 *   NO se vuelve a envolver. Sin esa deteccion, un segundo "Aplicar" habria anidado la formula
 *   dentro de si misma -- el banco demuestra el crecimiento concreto (de 3 a 6 referencias a
 *   "tabla_real" al envolver dos veces) que esa deteccion evita.
 * - DEVTOOL_TableroFaltanteProyectado.js: trio estado/aplicar/revertir, cableado en el menu
 *   Tidetrack Dev como "Faltante proyectado (Tablero)". El banco (probar_tablero_faltante.js)
 *   prueba, con mutaciones dirigidas: el total real convertido en SUM ciego, el separador coma
 *   en la regla gris, la formula gris en el rango de otro bloque, el faltante dando negativo, y
 *   una cuenta real perdida en el derrame.
 * - DE PASO (pedido aparte de Franco, mismo dia): SYF_BLOQUE_MEDIOS.filaFin pasa de 29 a 30 --
 *   Franco abrio una fila mas en "Medios Bancarios" (C16:I29 -> C16:I30) para poder sumar un
 *   medio 13. Es el UNICO punto de verdad del borde (decision de la v0.17.1): el alto y el
 *   ARRAY_CONSTRAIN de la formula de saldos por medio se derivan de esta constante, asi que el
 *   12 que mostraba la formula viva pasa a 13 solo con este cambio. probar_formato_medios.js
 *   actualiza su asercion de 'C18:E29' a 'C18:E30' -- si hubiera quedado en 29 habria dado VERDE
 *   sobre la geometria vieja mientras el codigo ya miraba la nueva.
 *
 * [2026-08-21] v0.34.0 - La flecha dice la direccion, el color dice si es buena noticia.
 * - SINTOMA (Franco): "La tendencia del capital acumulado esta en rojo para un numero positivo..
 *   como es? No lo entiendo". Capital Acumulado mostraba "+82,0% de tendencia a 6 meses" EN ROJO.
 * - CAUSA, medida en la planilla. Habia cuatro reglas de formato condicional del tipo "el texto
 *   contiene", y estaban BIEN PENSADAS por metrica:
 *       C15      contiene "+" -> verde      C15      contiene "-" -> rojo
 *       F10,F15  contiene "+" -> ROJO       F10,F15  contiene "-" -> verde
 *   Para egresos (F15) "sube = rojo" es correcto. Pero F10 (capital) estaba AGRUPADO con F15 en
 *   el mismo par, asi que heredaba la polaridad de los egresos. Una sola regla sirviendo a dos
 *   celdas de significado opuesto: exactamente la misma falla que tenia el semaforo de las
 *   barras en v0.33.0, en otro lado de la misma hoja.
 * - FLECHAS DE TICKER. decision Franco 2026-08-21: "seria ideal colocar flechitas de sube-baja
 *   como en los tickers financieros". El patron de numero pasa a tener TRES secciones y la
 *   flecha REEMPLAZA al signo: "SUBE 82,0% de tendencia a 6 meses". Son simbolos geometricos
 *   Unicode (U+25B2 / U+25BC / U+2013), no emojis: la regla 6 prohibe emojis, no tipografia.
 *   Ademas degrada bien -- si el color fallara, la flecha sola sigue diciendo para donde fue.
 * - EL MODULO PASA A SER DUENO DEL COLOR, no solo del formato. Separarlos es lo que produjo el
 *   bug: el formato decia "+82,0%" y una regla ajena decidia que ese "+" era rojo. Seis reglas
 *   nuevas, UN PAR POR CELDA con rango de UNA sola celda -- son dos mas de las necesarias, y ese
 *   par de mas es lo que hace imposible que una celda quede arrastrada por la polaridad de otra.
 * - Y LA CONDICION AHORA ES NUMERICA (=$F$10>0) EN VEZ DE DE TEXTO. Las reglas viejas miraban si
 *   el texto mostrado contenia "+" o "-": funcionaban de casualidad y se rompen solas en cuanto
 *   cambia el formato de numero, que es justo lo que pasa ahora que la flecha reemplaza al signo.
 * - LAS REGLAS AJENAS NO SE TOCAN. Se reponen POR REFERENCIA (nunca reconstruidas), asi que las
 *   del calendario J8:P14 no corren riesgo. Y una regla que toca un delta PERO se extiende fuera
 *   de el no se levanta: se reporta. Levantarla apagaria formato en celdas ajenas.
 * - Revertir quita las seis propias y REPONE las viejas desde una foto (rangos, colores,
 *   negrita, cursiva, tachado, subrayado).
 * - El banco mata siete mutaciones, entre ellas la reconstruccion exacta del bug (capital con la
 *   polaridad de egresos) y la de agrupar celdas en un rango. Dos de esas siete SOBREVIVIAN a la
 *   primera version del banco: no se probaba _construirReglaDeltaIp (donde se fija el rango) ni
 *   el caso "quedan reglas viejas por levantar". Probar el plan no es probar lo que se escribe.
 *
 * [2026-08-21] v0.33.0 - El semaforo no puede correr para un solo lado.
 * - LA BARRA DE CONSUMO SE DA VUELTA SEGUN LA FILA. decision Franco 2026-08-21: en Capacidad de
 *   Capitalizacion la barra tiene que dar VERDE del 80% de cumplimiento para arriba. No es mover
 *   un umbral: es que la escala se INVIERTE. Gastar el 100% del presupuesto de Gastos Variables
 *   es agotarlo (rojo); capitalizar el 100% de lo planificado es cumplir el plan (verde). Un solo
 *   semaforo no puede servir a las dos lecturas. Ingresos entra en el mismo grupo por la misma
 *   razon y no por analogia: en la corrida del 2026-08-21 cobrar 1.645.687 contra 1.546.662
 *   presupuestados se pintaba de ROJO.
 * - SIN PRESUPUESTO YA NO SE DIVIDE. El cumplimiento era IFERROR(E/D; 0), y con D en cero eso
 *   daba la respuesta equivocada, no un error: capitalizar 385.400 sobre un plan de 0 se leia
 *   como 0% de cumplimiento. Ahora se resuelve antes del cociente: sin presupuesto, cumplio el
 *   que movio plata. Es la misma trampa que Franco marco en N25 (=O19/O12 con O12 = 15,31 dando
 *   -391830%): dividir por algo que tiende a cero da un numero absurdo con cara de dato.
 * - LA BARRA VA APILADA, PARA QUE EL 0% SE VEA. Una barra suelta al 0% de cumplimiento mide
 *   CERO y no se dibuja: la fila queda visualmente vacia, indistinguible de una celda sin
 *   formula. Se vio en la corrida del 2026-08-21 -- Capacidad de Capitalizacion, 15,31
 *   presupuestados contra -59.989 reales, sin barra ninguna, justo el mes que mas gritaba.
 *   Ahora se apila el resto (1 - consumo) contra un riel del tono palido del mismo nivel: la
 *   barra ocupa siempre el ancho completo y el 0% se lee como un riel vacio, que es lo que
 *   Franco pidio el 2026-08-20 ("un grafico de barra que represente del 0% al 100%").
 * - LA PALETA PASA A SER LA DEL TABLERO. Salen los colores heredados de la planilla anterior
 *   (#a9bca1 / #db9940 / #da8b7b) y entran los de los formatos condicionales del Tablero:
 *   #356854 verde, #ffb300 amarillo, #c93232 rojo, con sus fondos palidos #e6f4ea / #fef7e0 /
 *   #fce8e6. Dos paletas parecidas pero distintas para la misma idea se leen como si dijeran
 *   cosas distintas. Las barras pintan con el tono SATURADO porque son tinta sobre el blanco de
 *   la hoja; el palido existe para ir detras de un texto y sobre blanco no se ve.
 * - LOS TRES DELTAS MIDEN TENDENCIA, NO UN MES. decision Franco 2026-08-21: "los delta no son 1
 *   mes vista, sino 6 meses vista... se visualiza crecimiento de tendencias". Antes F10/C15/F15
 *   comparaban UN mes contra la media de los seis previos, que mide cuanto se desvio ese mes --
 *   un dato que salta con cualquier sueldo que cae un dia antes o despues. Ahora se arma la serie
 *   de seis totales mensuales y se mide la pendiente de su recta de minimos cuadrados, expresada
 *   como fraccion del nivel medio de la ventana. El bench lo deja demostrado: la serie
 *   [100,100,100,100,100,200] valia +100% con el diseno viejo y da +61,2% con la tendencia,
 *   mientras que un crecimiento sostenido a los mismos 200 pesa MAS que el pico suelto. El
 *   diseno viejo no distinguia esos dos casos. La etiqueta acompana: "de tendencia a 6 meses".
 * - LA REALIDAD YA NO TIENE QUE CERRAR LA IDENTIDAD. El verificador de la hoja Inicio exigia
 *   Ingresos = Fijos + Variables + Capitalizacion en las DOS columnas, y desde v0.32.0 eso es
 *   falso por diseno: el plan ASIGNA (D22 es el residuo) pero la realidad SE MIDE (E22 es la
 *   capitalizacion efectiva). El 2026-08-21 esa exigencia revirtio una corrida entera con las
 *   formulas correctas por un desvio de 230.899,99 que era exactamente el dato: la plata que
 *   entro y no se gasto ni se capitalizo. Ahora en la columna E eso se reporta como aviso.
 * - FORMATO DE MEDIOS: LA REGLA ERA MUDA, POR DOS MOTIVOS INDEPENDIENTES. Las cuatro reglas de
 *   color del bloque "Medios Bancarios." del Tablero existian y no pintaban nada. Medido en la
 *   planilla el 2026-08-21 sobre C18:E29, con los cuatro medios de tipo Hogar como testigo:
 *     (a) referenciaban 'Plan de Cuentas'!$L$8:$N de forma DIRECTA. Sheets rechaza eso en una
 *         formula de formato condicional: al intentarlo a mano contesta "Formula no valida".
 *         Va envuelto en INDIRECT().
 *     (b) usaban COMA como separador. El modulo documentaba una "excepcion de locale" -- que la
 *         API de reglas recibe sintaxis canonica EN-US -- y esa afirmacion es FALSA: la formula
 *         se guarda verbatim y se evalua en el locale de la planilla. Con coma, en es_AR, no
 *         parsea; y una regla que no parsea no da error, simplemente nunca se cumple. Con ';'
 *         pinta exactamente los cuatro medios Hogar y ninguno mas.
 *   El banco de pruebas EXIGIA la coma, asi que daba verde sobre reglas mudas. Se dio vuelta, y
 *   las dos mutaciones (volver a la coma, sacar el INDIRECT) ahora lo matan.
 *   La identificacion de reglas propias NO mira ni el separador ni el INDIRECT, a proposito: si
 *   exigiera la forma correcta, las reglas rotas que quedaron dejarian de reconocerse como
 *   propias y no habria forma de reemplazarlas ni de quitarlas.
 * - Y EL MODULO NUNCA HABIA ESTADO EN EL MENU. Existia desde el 2026-08-20 sin entrada en
 *   MENU_CONFIG, o sea que no habia forma de correrlo desde la planilla. Se cablea como
 *   "Color de los medios (Tablero)".
 * - CORRECCION DE UNA AFIRMACION FALSA EN LOS COMENTARIOS: DEVTOOL_FormatoMedios decia que "la
 *   API de Apps Script no permite leer el formato de una regla ya existente". BooleanCondition
 *   expone getBackgroundObject() y getFontColorObject(). La conclusion que sostenia (rehacer las
 *   reglas siempre) sigue siendo la correcta por simple; el motivo, no.
 *
 * [2026-08-21] v0.32.2 - Los deltas dicen contra que se comparan.
 * - decision Franco 2026-08-21: "-10,4%" solo no se entiende, no dice contra que se compara. Los
 *   tres deltas pasan a mostrarse como "-10,4% vs. media 6 meses".
 * - EL TEXTO VA EN EL FORMATO DE NUMERO, no concatenado con TEXT(). Con TEXT() la celda dejaria
 *   de ser un NUMERO y pasaria a ser una cadena: cualquier formula que despues la sume, la compare
 *   o le aplique formato condicional dejaria de funcionar, y lo haria EN SILENCIO -- un texto que
 *   dice "-10,4%" se ve identico a un numero que vale -0,104.
 * - El sufijo se deriva de IP_MESES_MEDIA para que la etiqueta no pueda desfasarse de la ventana
 *   que realmente se promedia.
 *
 * [2026-08-21] v0.32.1 - Una custom function calculando NO es una falla.
 * - SINTOMA: la primera corrida de la hoja Inicio se revirtio entera con "la columna Realidad no
 *   releyo numeros en las cuatro filas". Las formulas estaban PERFECTAS.
 * - CAUSA: las funciones propias -- TIDETRACK_USD/AUD/EUR -- no calculan de forma sincronica. En
 *   su primer calculo la celda devuelve el texto "Loading..." y recien despues el numero. El
 *   verificador relee inmediatamente despues del flush(), ve un string, concluye "esto no es un
 *   numero" y revierte. E22 empezo a llamarlas al medir la capitalizacion, y ahi aparecio.
 * - Es un FALSO NEGATIVO caro: destruye trabajo correcto y manda a buscar el bug donde no esta.
 * - CORRECCION: se relee con reintentos y pausas crecientes. Si al final sigue cargando, eso es
 *   PENDIENTE, no FALLA: las formulas quedan escritas y el dialogo dice que invariantes no se
 *   pudieron comprobar. Un #REF! sigue siendo falla y no se espera por el.
 * - BUG PROPIO ATRAPADO POR EL BANCO en el mismo commit: G19 tiene que estar VACIA, y el lector
 *   nuevo interpretaba el vacio como "todavia calculando". Esa celda va con lectura cruda.
 * - APLICA A CUALQUIER MODULO que escriba formulas con custom functions y verifique releyendo.
 *
 * [2026-08-21] v0.32.0 - La hoja Inicio queda terminada.
 * - LO QUE HACE: el bloque "Presupuesto del Mes" (C17:H22) pasa a tener sus cuatro columnas vivas
 *   -- D lo proyectado del mes desde la BD de Proyeccion, E lo realmente registrado, F una barra
 *   de consumo 0..100% con el semaforo de la planilla anterior, y G la distribucion de fondos con
 *   el MISMO reparto de tres regimenes del Tablero. Y los tres deltas (capital, ingresos, egresos)
 *   contra la media de los ultimos 6 meses; C15/F15 reemplazan formulas que daban 0% eterno.
 * - SELECTORES PROPIOS: Inicio tiene los suyos (I2/I3/I4) y son independientes de los del Tablero.
 *   Todas las formulas nuevas anclan ahi y ninguna a N2/N3/N4.
 *
 * - E22 NO ES UN RESIDUO. decision Franco 2026-08-20 aplicada tambien aca: el plan asigna, la
 *   realidad se mide. D22 es el residuo -- lo unico que cierra la asignacion en 100% -- y E22 mide
 *   la capitalizacion efectiva del mes. Y no es una formula nueva: es LA MISMA de Tablero!O19,
 *   parametrizando los selectores. Una copia habria divergido en el primer arreglo hecho en una
 *   sola de las dos hojas, y entonces Inicio y Tablero mostrarian capitalizaciones distintas para
 *   el mismo mes sin que nada lo delate.
 *
 * - EL PATRON DEL DELTA LLEVA PUNTO, NO COMA: '+0.0%;-0.0%'. El lenguaje de setNumberFormat es
 *   INDEPENDIENTE DEL LOCALE ('.' siempre decimal, ',' siempre miles) y Sheets lo RENDERIZA con
 *   coma en es_AR. Con '+0,0%' -- que es como se ve el resultado, y por eso engana -- el decimal
 *   desaparecia: '+35%' en vez de '+34,5%', sin ningun error. Distinto de TEXT(), que si es
 *   locale-aware; la constante venia de la C15 vieja, donde el patron vivia adentro de un TEXT().
 *
 * - EL MODULO ESTABA SIN CABLEAR: sus tres funciones no figuraban en MENU_CONFIG, asi que 964
 *   lineas quedaban inalcanzables mientras sus propios dialogos mandaban a un menu inexistente.
 *   GUARD NUEVO: el banco verifica que TODA funcion invocada por el menu exista en src/. El menu
 *   las llama POR STRING -- un typo o un modulo sin cablear no lo detecta nada, el item aparece y
 *   explota al apretarlo.
 *
 * - Inicio!C15 y F15 salen de DEVTOOL_StockYFlujo: ahora las reescribe este modulo. Es la cuarta
 *   celda que se saca de un modulo por la misma razon (N19, O16, y estas dos): dos modulos sobre
 *   la misma celda hacen que el numero dependa del orden en que se aprietan los botones del menu.
 *
 * - Verificado por mutacion (4/4): E22 de vuelta a residuo, E22 con los selectores del Tablero,
 *   el patron con coma, y descablear el modulo del menu.
 *
 * [2026-08-20] v0.31.1 - Reanclaje al rediseno manual: los montos viven en la columna O.
 * - Franco rediseno a mano L7:O19: movio los MONTOS de la columna N a la O, dejo los % del plan
 *   en N como formulas suyas (=IFERROR(O9/$O$9;0)) y ELIMINO el % del bloque de la realidad --
 *   "nunca me iba a dar 100% y era irrelevante", que es exactamente correcto desde la v0.31.0.
 * - CORRECCION DE UN DIAGNOSTICO PROPIO, anotada porque el error de razonamiento importa mas que
 *   el fix: se anuncio que la Disponibilidad de fondos habia quedado ROTA leyendo $N$10/$N$17.
 *   ERA FALSO, y se comprobo midiendo O23:O25 en vivo: ya referenciaban $O$10/$O$17. Cuando se
 *   MUEVE contenido de una columna a otra, Sheets reajusta solas todas las formulas que lo
 *   referencian -- exactamente lo contrario de lo que pasa cuando un bloque se reconstruye a mano,
 *   que fue el caso de $AF$17 en la v0.24.0 y quedo como analogia equivocada.
 * - EL REANCLAJE IGUAL ERA NECESARIO, por el motivo inverso: los modulos GENERAN las formulas con
 *   las referencias viejas, asi que la proxima corrida de "Aplicar" habria DESHECHO el reajuste
 *   que Sheets hizo bien. El riesgo no estaba en la hoja: estaba en el codigo esperando a correr.
 *   Tras el reanclaje, "Aplicar" reporta "ya estan como corresponde" y no escribe nada.
 * - REANCLADO: DEVTOOL_Proyeccion escribe O9:O11; DEVTOOL_Capitalizacion escribe O12 y O19 y sus
 *   CAP_REFS enteras apuntan a O. El modulo YA NO ESCRIBE NINGUN PORCENTAJE: se retiro
 *   CAP_PORCENTAJE_BASE. Esa columna es de Franco y un modulo que la escribiera pisaria su
 *   trabajo en la proxima corrida.
 * - BUG GRAVE ENCONTRADO AL PASAR: _planCap habia quedado definida CUATRO veces en el mismo
 *   archivo, resultado de cirugias de texto acumuladas. En Apps Script la ultima definicion pisa
 *   a las anteriores EN SILENCIO -- node --check no protesta, la planilla tampoco -- asi que se
 *   podia estar editando un cadaver creyendo editar el codigo vivo. Quedo una sola.
 * - GUARD NUEVO en el banco: barre todo src/ y falla si una funcion esta definida dos veces.
 *
 * [2026-08-20] v0.31.0 - El plan asigna, la realidad se mide.
 * - decision Franco 2026-08-20: "N19 no debe ser una resta de descarte. Aca si va el valor
 *   registrado del mes: lo que se haya realmente ahorrado y/o invertido".
 * - EL MODELO COMPLETO, que cierra el ciclo de todo el dia:
 *     N12 (PLAN): el residuo Ingresos - Fijos - Variables. Un presupuesto ASIGNA y el residuo es
 *       lo unico que cierra la asignacion en 100% (v0.29.0). Nunca negativo: el plan se recorta
 *       antes que proyectar desahorro (v0.30.0).
 *     N19 (REALIDAD): la capitalizacion EFECTIVA -- el flujo neto del mes hacia los medios de
 *       Ahorros e Inversiones, traspasos incluidos, neteado con signo. Negativo significa que ese
 *       mes se saco de los frascos. La realidad no asigna: SE MIDE.
 * - La formula de N19 es la que la v0.26.0 construyo, la v0.29.0 retiro a git ("para cuando tenga
 *   su propio lugar") y esta version trae de vuelta A SU LUGAR. Sin piso, neteando.
 * - CONSECUENCIA ASUMIDA: el bloque de la realidad NO suma 100%. La diferencia entre los ingresos
 *   reales y (fijos + variables + capitalizacion efectiva) es la plata que quedo sin asignar o el
 *   gasto por encima del ingreso. En el plan esa diferencia no existe por construccion; en la
 *   realidad ES el dato. Los dialogos lo explican.
 * - La Disponibilidad de fondos sale ganando sin tocarla: su remanente de capitalizacion
 *   (N12 - N19) pasa a significar "cuanto de lo planeado falta efectivamente capitalizar".
 * - Verificado por mutacion (3/3): volver N19 al residuo, leer la Proyeccion en vez del ledger,
 *   y contar solo entradas (esconderia los retiros).
 *
 * [2026-08-20] v0.30.1 - La pata de traspaso pierde su Tipo de Cuenta.
 * - SINTOMA: con el recorte v0.30.0 aplicado, N12 quedo igual en -$196.914. El ajuste recorto
 *   122 mil cuando el deficit real era 319 mil.
 * - CAUSA: algunas patas de traspaso vienen con "Ingreso" cargado en Tipo de Cuenta. El balance
 *   del recorte las conto como ingreso; la hoja las excluye por cuenta neutra. Dos varas: el
 *   ajustador vio menos deficit del que el Tablero muestra, y la diferencia es exactamente el
 *   monto de esos traspasos proyectados (196.9k).
 * - CORRECCION: en la lectura, toda pata de traspaso pierde el Tipo de Cuenta que traiga. Un
 *   traspaso capitaliza; no ingresa ni gasta en ningun bloque. Asi el balance del ajustador y el
 *   del Tablero miden con la misma vara, y el traspaso tampoco se recorta: capitalizar es el
 *   objetivo del plan, no el problema.
 * - Se verifico en la hoja tras recargar: N12 >= 0 con la identidad intacta.
 *
 * [2026-08-20] v0.30.0 - Ningun mes se proyecta con desahorro.
 * - decision Franco 2026-08-20: "que no se proyecte un mes con un desahorro". Se proyecta por
 *   descarte (la Capacidad es el residuo, v0.29.0), y ahora el plan ademas garantiza que ese
 *   residuo no nazca negativo: un plan con desahorro adentro no es un plan, es una resignacion.
 * - COMO: si el gasto historico del mes proyectado supera al ingreso historico, el plan se
 *   RECORTA. Primero los GASTOS VARIABLES, todos en la misma proporcion -- es el unico lugar
 *   donde un plan puede ceder. Solo si los fijos solos ya superan al ingreso se recortan tambien
 *   los fijos, y el reporte lo marca como ANOMALIA ESTRUCTURAL: ningun recorte de planilla
 *   arregla que los contratos cuesten mas que el sueldo.
 * - El piso capacidad=0 se logra POR RECORTE DEL PLAN, no por tapado: la identidad
 *   Ingresos = Fijos + Variables + Capacidad se cumple con los numeros recortados. (El tapado
 *   fue el error de la v0.27.0; la diferencia esta documentada en la cabecera del modulo.)
 * - MULTI-MONEDA: el balance se calcula convirtiendo a ARS con TIDETRACK_USD/AUD/EUR() -- desde
 *   GAS directamente, son funciones del proyecto -- y el factor se aplica a cada linea EN SU
 *   MONEDA. Redondeo de gastos hacia ABAJO para que el piso no se perfore por centavos.
 * - BUG PREEXISTENTE ATRAPADO POR EL BANCO: el minimo de linea (PB_MINIMO) se comparaba contra
 *   el monto crudo, ciego a la moneda: descartaba 0,9 USD (~900 pesos) como si fueran centavos.
 *   Ahora el umbral es en ARS equivalentes, tambien en el filtro original del promedio.
 * - El reporte de "1. Ver estado" muestra mes por mes el recorte aplicado (deficit en ARS, % en
 *   variables, % en fijos si hubo anomalia). Un plan recortado sin aviso pareceria un error.
 * - Verificado por mutacion (4/4 muertas: no recortar, fijos antes que variables, redondeo hacia
 *   arriba, balance ciego a la moneda) y con 3000 meses al azar multi-moneda: capacidad >= 0
 *   siempre. El banco de stock-flujo ademas se adapto al gemelo fresco: una formula viva que ya
 *   viene transformada es idempotencia, no falla.
 *
 * [2026-08-20] v0.29.0 - Vuelve el residuo. Los tres destinos suman el 100% de los ingresos.
 *
 * Franco: "esa suma siempre tiene que dar 100%... seguis agregando parches sin criterio".
 * Tenia razon, y el error era de analisis, no de implementacion.
 *
 * LA IDENTIDAD. "Presupuesto Asignado" es una ASIGNACION: reparte los ingresos que se esperan.
 * Cada peso va a fijos, a variables, o queda para capitalizar. Entonces
 *     Ingresos = Fijos + Variables + Capacidad de Capitalizacion
 * no es un resultado que se observa: es la DEFINICION de lo que el bloque muestra.
 *
 * QUE SE ROMPIO. La v0.26.0 saco la capacidad del residuo y la puso a medir el flujo real hacia
 * los medios de riqueza. El motivo parecia bueno -- el residuo daba negativo -- pero los cuatro
 * numeros pasaron a salir de CUATRO FUENTES INDEPENDIENTES, sin nada que los ate. Nunca mas
 * cerraron: se midio 143,98%.
 *
 * LOS PARCHES QUE SIGUIERON, todos sobre el sintoma y ninguno capaz de funcionar: piso en cero
 * (v0.27.0), contar solo las entradas (v0.28.0), reanclar el porcentaje de la fila de Ingresos
 * (v0.28.0). El problema no estaba en como se calculaba cada numero, sino en que ya no habia
 * identidad que respetar.
 *
 * EL DATO QUE DESARMA EL MOTIVO ORIGINAL: el residuo da 100% INCLUSO SIENDO NEGATIVO. Con
 * fijos+variables por encima de los ingresos, la capacidad sale negativa y los tres siguen sumando
 * 100% (46 + 116 - 62 = 100). El negativo nunca rompio la suma: era la SENAL de un presupuesto
 * sobrecomprometido. Taparlo fue el error, no mostrarlo.
 *
 * LAS DOS COSAS QUE SE HABIAN CONFUNDIDO:
 *   1. CAPACIDAD de capitalizacion -- lo que queda despues de fijos y variables. Residuo por
 *      definicion, y lo que hace cerrar el bloque. La fila se llama, literalmente, "Capacidad".
 *   2. CAPITALIZACION EFECTIVA -- cuanta plata entro de verdad a los frascos. Medicion util, pero
 *      no puede vivir en un bloque que tiene que partir el ingreso.
 * La formula que medía la segunda se retira, junto con sus tres helpers, que quedaban sin llamador.
 * El concepto queda escrito en la cabecera del modulo y el codigo en git (v0.28.0).
 *
 * LO QUE SE CONSERVA de estas tres versiones, porque era bueno y es independiente: el reparto
 * proporcional de la Disponibilidad de fondos cuando las tres categorias se pasaron del 100%, y
 * los Ingresos como base del porcentaje en O9/O16.
 *
 * EL BANCO prueba ahora LA IDENTIDAD sobre 5000 casos al azar, deficit incluido, y mata tres
 * mutaciones nuevas: ponerle piso al residuo, cruzar las celdas de los dos bloques, y sumar en
 * vez de restar.
 *
 * DIAGNOSTICO NUEVO en "Presupuesto base > 1. Ver estado": muestra, mes por mes, que porcentaje de
 * los ingresos se lleva el gasto presupuestado y marca los meses sobrecomprometidos. Y nombra la
 * causa mas probable cuando eso pasa: los pagos de tarjeta contados dos veces, una como la compra
 * y otra como el pago del resumen. En Julio el deficit ($362.568) es casi identico a los pagos de
 * tarjeta del mes ($373.483), que es exactamente la forma que deja ese doble conteo.
 *
 * [2026-08-20] v0.28.0 - El porcentaje de la fila de Ingresos, y el fin del piso en cero.
 *
 * Franco: "el % me da mas de 100%, simplemente tapaste un error con otro error". Tenia razon en
 * las dos mitades.
 *
 * 1. EL SEGUNDO ERROR ERA O9. Venia siendo `SUMA(O10:O12)` -- la suma de los otros tres, puesta en
 *    la fila de INGRESOS. Daba 100% por construccion mientras la capitalizacion era el residuo. Al
 *    dejar de serlo, esa celda pasa a mostrar un numero flotante que, leido literalmente, dice
 *    "mis ingresos son el 116% de mis ingresos". Es una categoria equivocada, no un numero mal
 *    calculado, y por eso ningun arreglo del calculo lo iba a resolver.
 *    Ahora los Ingresos son la BASE: su porcentaje es 100%, y los otros tres muestran su parte.
 *    Si esos tres suman mas de 100%, el presupuesto no cierra -- se ve sumandolos, y es
 *    exactamente sobre lo que actua "Disponibilidad de fondos". Ya no se disfraza en la fila de
 *    arriba. Lo mismo en O16, el bloque de la realidad.
 *
 * 2. EL PRIMER ERROR ERA EL PISO EN CERO. Aplastar un neto negativo a cero no arregla el numero:
 *    lo esconde, y encima deja el bloque mostrando $0,00 sin decir por que. Se reemplaza por el
 *    modelo correcto: el PLAN cuenta solo lo que ENTRA a los medios de riqueza; la REALIDAD netea
 *    con signo. No es una inconsistencia -- es la diferencia entre una intencion y un hecho. Nadie
 *    planifica sacar plata del frasco, asi que en el presupuesto los retiros no restan; en la
 *    realidad si, y si ese mes sacaste mas de lo que pusiste el neto da negativo y hay que poder
 *    verlo. El cumplimiento se lee "de lo que pensaba apartar, cuanto aparte de verdad".
 *    El plan es positivo porque mide algo positivo, no porque se le puso un piso.
 *
 * 3. O16 SALE DE StockYFlujo. Era la segunda celda que dos modulos se disputaban, despues de N19.
 *    Se agrego al banco un chequeo que recorre todos los DEVTOOL_ y falla si dos proponen la misma
 *    celda: el numero del Tablero no puede depender del orden en que se aprietan los botones.
 *
 * [2026-08-20] v0.27.1 - Se elimina el alias SYF_ARRASTRE.
 * - La v0.27.0 dejo `const SYF_ARRASTRE = CUENTA_ARRASTRE` por compatibilidad. Eso solo funciona
 *   si Apps Script evalua 00_Config.js ANTES que DEVTOOL_StockYFlujo.js. Hoy lo hace -- "00_"
 *   ordena antes que "DEVTOOL_" -- pero es una bomba que estalla el dia que alguien renombra un
 *   archivo, y estallaria en tiempo de carga: sin menu y sin planilla operable.
 * - Los cuatro modulos usan CUENTA_ARRASTRE directamente. Sin alias, no hay orden que importe.
 * - Lo encontro el banco de stock y flujo, que quedo en rojo tras la v0.27.0 porque arma sus
 *   constantes a mano en vez de cargar Config: la misma independencia que lo hace rapido lo
 *   convirtio en el unico que podia ver la dependencia oculta.
 *
 * [2026-08-20] v0.27.0 - Los traspasos a un frasco SON capitalizacion, y el plan tiene piso en cero.
 * - decision Franco 2026-08-20: "los traspasos indican capitalizacion si se cruza con un medio".
 *   La realidad ya los contaba; el PRESUPUESTO no podia, porque el presupuesto base excluia todas
 *   las cuentas neutras. Esa asimetria hacia que el cumplimiento comparara dos cosas distintas.
 * - COMO SE RESOLVIO, y el dato que lo hizo simple: en este ledger UN TRASPASO SON DOS FILAS --
 *   un Egreso del medio origen y un Ingreso al medio destino. Se verifico en el gemelo: $7.000
 *   salen de Efectivo y $7.000 entran a Mercado Pago. Con eso, filtrar por "el medio de ESTA fila
 *   es de tipo Ahorros o Inversiones" hace lo correcto solo: de un traspaso de casa a un frasco
 *   entra la pata que suma y no la que resta, y de un traspaso entre dos cuentas de casa no entra
 *   ninguna. No hizo falta ninguna regla especial de signo.
 * - EL ARRASTRE SIGUE AFUERA aunque toque un frasco: "Inicio Mes" no mueve plata, declara cuanta
 *   habia. Si contara, el saldo de apertura de cada frasco se leeria como capitalizacion del mes.
 * - PISO EN CERO SOLO EN EL PLAN. decision Franco: en la proyeccion la capitalizacion no puede dar
 *   negativo -- planear apartar menos que cero no significa nada. En la REALIDAD si puede, y ahi
 *   quiere decir que ese mes se saco plata de los frascos. Son dos cosas distintas: una es una
 *   intencion y la otra un hecho.
 * - DE PASO: las filas de traspaso no traen "Tipo de Cuenta" -- no viven en ninguno de los tres
 *   bloques --, y el lector del presupuesto las descartaba por eso. Ahora ese campo solo se exige
 *   a los gastos e ingresos, que si necesitan un bloque donde caer.
 * - SSOT: "Inicio Mes" pasa a 00_Config como CUENTA_ARRASTRE. Vivia dentro de DEVTOOL_StockYFlujo
 *   y otros dos modulos lo tomaban de ahi por el scope global de Apps Script: funciona, pero es
 *   una dependencia invisible que ningun banco puede cargar sin arrastrar un modulo ajeno.
 * - EL BANCO TENIA UN AGUJERO: probaba el generador de formulas pero no QUE BANDERA LE PASA EL
 *   PLAN A CADA CELDA. Una mutacion que le ponia piso en cero a la realidad pasaba invisible.
 *   Se agrego una prueba sobre el plan armado; ahora las cuatro mutaciones mueren.
 *
 * [2026-08-20] v0.26.1 - El borrado de la carga previa se hace en BLOQUES, no fila por fila.
 * - SINTOMA: recargar el presupuesto base con 413 filas viejas adentro tardaba minutos. Se vio en
 *   vivo el 2026-08-20: la corrida quedo "Ejecutando secuencia de comandos" un rato largo.
 * - CAUSA: `deleteRow` una vez por fila, o sea 413 llamadas a la API de Sheets. Apps Script corta
 *   a los 6 minutos, y un corte a mitad del borrado deja media carga vieja adentro de la hoja --
 *   justo el estado que la marca en Nota existe para evitar.
 * - CORRECCION: se agrupan las filas contiguas y se borra cada bloque con `deleteRows(ini, largo)`.
 *   Como las filas generadas quedan siempre juntas, 413 filas pasan a ser UNA sola llamada.
 *   Se sigue borrando de abajo hacia arriba: al reves, cada borrado corre los indices de lo que
 *   sigue y termina borrando filas que no eran.
 *
 * [2026-08-20] v0.26.0 - La capitalizacion deja de ser un residuo, y el presupuesto sigue al periodo.
 * Cuatro cosas que Franco marco mirando el Tablero, y una quinta que aparecio midiendo.
 *
 * 1. LA CAPACIDAD DE CAPITALIZACION ERA UNA RESTA DE DESCARTE. Se calculaba `Ingresos - Fijos -
 *    Variables` en las dos columnas. Eso no mide capitalizacion: mide lo que quedo sin explicar,
 *    y cuando los gastos superan a los ingresos da NEGATIVO. Medido en vivo el 2026-08-20 en
 *    Julio: -$318.561,01 en el presupuesto y -$362.568,02 en la realidad. Nadie capitaliza menos
 *    cero. Ahora es la SUMA de lo que va a los medios de tipo Ahorros e Inversiones, con la MISMA
 *    formula en las dos columnas -- si cada una sumara distinto, el cumplimiento compararia peras
 *    con manzanas. CONSECUENCIA A PROPOSITO: los cuatro renglones ya no suman 100%, y esa
 *    diferencia es informacion -- la plata que entro y no se gasto ni se capitalizo. Antes se
 *    escondia adentro del residuo y lo volvia negativo.
 *
 * 2. LA DISPONIBILIDAD DE FONDOS LE DABA TODO A UNA SOLA FILA cuando las tres categorias se
 *    pasaban del 100%. Sin remanente que cubrir, la suma de remanentes daba cero y la formula
 *    caia en un caso degenerado. Medido en vivo con 145% / 136% / 114%: $0,00 / $0,00 /
 *    $275.428,69. Ahora, cuando no queda presupuesto por cubrir, se reparte por PESO DE
 *    PRESUPUESTO: la misma prioridad relativa que rige entre 0% y 100%, sin caso especial.
 *    INVARIANTE verificado sobre 4000 casos al azar: las tres filas suman la liquidez SIEMPRE,
 *    en los tres regimenes.
 *
 * 3. EL PRESUPUESTO NO SE MOVIA AL CAMBIAR EL PERIODO. La formula si filtraba por $N$2/$N$3 --
 *    se verifico leyendola en vivo --; lo que no variaba era el dato: la v0.25.0 cargaba la misma
 *    cifra en todos los meses. Ahora cada mes se presupuesta con el promedio de los seis meses
 *    ANTERIORES a el. Ningun mes se presupuesta con datos de su propio futuro, asi que el
 *    cumplimiento sigue significando algo y el numero acompana al filtro.
 *
 * 4. EL PRESUPUESTO CONVERTIA CON CELDAS QUE YA NO SON LAS COTIZACIONES. La correccion estaba en
 *    el codigo desde la v0.24.0 pero NUNCA SE HABIA APLICADO A LA HOJA: se detecto leyendo la
 *    formula viva de N9, que todavia tenia $AF$17/18/19 -- hoy el texto "Flujo" y dos montos de
 *    saldo. Un deploy no reescribe formulas; hay que volver a correr el modulo que las escribe.
 *
 * 5. DOS MODULOS SE PISABAN EN N19. StockYFlujo proponia el residuo y Capitalizacion propone la
 *    suma. El numero del Tablero habria dependido del orden en que se aprietan los botones del
 *    menu. Se saco la linea de StockYFlujo.
 *
 * Bancos de prueba: probar_capitalizacion.js (estructura de las formulas + la regla de reparto
 * sobre 4000 casos) y probar_presupuesto_base.js (promedio movil). Los dos verificados por
 * mutacion. El banco del presupuesto atajo que su propio ledger sintetico no podia distinguir
 * julio de agosto -- todos los movimientos caian en las dos ventanas --, asi que el invariante
 * "el presupuesto se mueve" no probaba nada hasta que se agrego un movimiento en el mes bisagra.
 *
 * [2026-08-20] v0.25.0 - Presupuesto base: la hoja Proyeccion se siembra desde el historial real.
 * - PROBLEMA: "Proyeccion" nacia vacia, asi que "Presupuesto Asignado" (N9:N11) daba cero y
 *   "Disponibilidad de fondos" no podia decir nada. No habia con que probar el Tablero.
 * - METODO, que es el mas viejo y el mas honesto para un primer presupuesto: PROMEDIO HISTORICO
 *   POR CUENTA. Se toman los ultimos 6 meses COMPLETOS, se suma lo de cada cuenta y se divide por
 *   6. El mes en curso no entra al promedio: esta a medio transcurrir y bajaria todas las lineas.
 * - TRES DECISIONES que hacen que el numero signifique algo:
 *     1. El presupuesto es PLANO a lo largo de los meses. Una linea que uno se fija; lo que varia
 *        es la realidad, y esa diferencia es justo lo que el Tablero mide.
 *     2. Se excluyen las CUENTAS NEUTRAS (traspasos, "Inicio Mes"): no son gasto ni ingreso.
 *        Mismo criterio que los bloques de la realidad -- si difirieran, el cumplimiento
 *        compararia peras con manzanas.
 *     3. Se respeta la MONEDA DE ORIGEN: una cuenta que se paga en dolares se presupuesta en
 *        dolares. Promediar montos de monedas distintas produce un numero que no existe.
 * - REPETIBLE SIN DUPLICAR: cada fila generada queda marcada en la columna Nota, y al recargar se
 *   borran solo esas. Lo cargado a mano no se toca. Hay un "3. Quitar la carga" que la saca entera.
 * - BANCO DE PRUEBAS con ledger sintetico de respuesta conocida, y VERIFICADO POR MUTACION: se
 *   rompio la logica a proposito de cinco formas distintas y las cinco murieron. La cuarta --
 *   agrupar sin la moneda -- no la detectaba la primera version del banco, porque ninguna cuenta
 *   del ledger de prueba se pagaba en dos monedas. Se agrego el caso.
 * - EL BANCO CHEQUEA ADEMAS QUE NO HAYA BYTES DE CONTROL en src/ ni devtools/. Aparecio un NUL
 *   dentro de un .join() -- inyectado por una herramienta de edicion, no por un humano. No rompe
 *   la sintaxis, no lo muestra ningun editor y viaja al deploy sin que nadie lo note.
 *
 * [2026-08-20] v0.24.0 - Tres fixes de la revision adversarial pre-merge.
 *
 * 1. STOCK Y FLUJO BORRABA "MEDIOS BANCARIOS" Y NO LO REPONIA, diciendo que salio todo bien.
 *    El plan marcaba `limpiar = true` sin mirar si las tres formulas del bloque iban a
 *    reescribirse. Si ya estaban aplicadas pero quedaba pendiente CUALQUIER otro cambio -- por
 *    ejemplo uno de formato, que es exactamente lo que introdujo la v0.23.5 --, el plan no salia
 *    vacio, se limpiaba C18:I29 con las formulas adentro, y el bucle no las reponia porque
 *    `proponer` las habia descartado por iguales. El verificador solo mira lo que se escribio.
 *    ESTE DEFECTO SE MATERIALIZO EN PRODUCCION: la corrida de formatos de la v0.23.5 dejo el
 *    bloque vacio. Ahora la misma condicion decide limpiar y reescribir: borrar sin reponer es
 *    imposible por construccion.
 *
 * 2. EL PRESUPUESTO CONVERTIA CON CELDAS QUE YA NO SON LAS COTIZACIONES. DEVTOOL_Proyeccion
 *    cableaba $AF$17/18/19, que hoy son "Saldos Actuales": AF17 es el texto "Flujo" y AF18/AF19
 *    son montos de saldo. Un previsto en AUD se multiplicaba por un saldo en vez de por una
 *    cotizacion -- presupuesto inflado varios ordenes de magnitud, sin un solo aviso. Pasa a
 *    TIDETRACK_USD/AUD/EUR(). Era el ultimo lugar de src/ que autoraba esas coordenadas.
 *
 * 3. EL ABM DEL MENU DIARIO PODIA CORROMPER EL PLAN DE CUENTAS, por dos caminos:
 *    (a) la entidad "Proyectos" escribia en RANGES.PROYECTOS (P:Q), que desde el rediseno es el
 *        catalogo de CATEGORIAS DE CUENTA: un alta agregaba una categoria y una baja borraba una.
 *        Se retira del selector y los endpoints la RECHAZAN con un mensaje que dice por que.
 *    (b) un solo desplegable alimentaba dos ejes distintos -- la Categoria de una cuenta y el
 *        Tipo de un medio --, los dos leidos de la misma columna P. Se podia dejar un medio con
 *        tipo "Alimentacion y social". Ahora son dos dominios: las categorias salen de
 *        CATEGORIAS_CUENTA y los tipos de la nueva constante TIPOS_MEDIO en 00_Config.
 *
 * [2026-08-20] v0.23.5 - El formato es parte del plan, y se revierte como todo lo demas.
 * - La reparacion de formato de la v0.23.4 colgaba del camino de escritura, asi que cuando no
 *   habia formulas que cambiar la corrida salia antes de llegar a ella: decia "ya estaba aplicado"
 *   con los montos todavia mostrandose como porcentaje. Una reparacion que solo corre si ademas
 *   hay otra cosa que hacer no es una reparacion.
 * - Ahora el formato es un cambio del plan como cualquier otro: se propone, se cuenta en la
 *   confirmacion, se verifica al releer, y SE REVIERTE si algo falla. Revertir formulas sin
 *   revertir formatos es exactamente como se llego al formato porcentaje que hubo que reparar.
 *
 * [2026-08-20] v0.23.4 - El bloque de tipos hereda el formato de plata (y repara un destrozo propio).
 * - SINTOMA: los montos por tipo se veian "21079101,0%", "23000000,0%". Los numeros estaban BIEN
 *   -- Hogar daba 45.428,69, que es Efectivo + NaranjaX + YPF al centavo -- pero se mostraban en
 *   formato porcentaje, que multiplica por 100 al mostrar.
 * - CAUSA: un intento anterior de este mismo modulo (v0.23.0) puso ahi formato de porcentaje,
 *   cuando creia que esa columna iba a mostrar el peso de cada tipo sobre el total. Ese intento se
 *   revirtio en las formulas pero NO en el formato: revertir texto no revierte formato.
 * - CORRECCION: la columna Monto hereda el formato de la columna Flujo de "Saldos Actuales", que
 *   es la columna de plata mas cercana y la que ya estaba formateada. Un modulo que puede romper
 *   un formato tiene que poder reponerlo.
 *
 * [2026-08-20] v0.23.3 - La suma por tipo de medio, sobre la geometria REAL del Tablero.
 * - Lo pedido: que el Tablero muestre cuanta plata hay en cada finalidad. El bloque ya existia --
 *   "Tipo de Medios.", AE7:AH12, con los cuatro tipos escritos a mano por Franco -- y solo le
 *   faltaba la columna Monto. Ahora se llena.
 * - LO QUE SE APRENDIO EN EL CAMINO, que vale mas que el bloque: la v0.23.0 fue escrita contra el
 *   gemelo digital, que tenia el layout viejo. En el gemelo, AE7 era "Saldos Actuales" con las
 *   monedas en las filas 9-12. En la planilla real, ese bloque esta en la fila 16 y las filas
 *   9-12 son OTRO bloque. Se intento escribir ahi y no entro nada: AF9:AF12 son la mitad muda de
 *   celdas combinadas AE:AF. El gemelo mintio, y mintio en silencio.
 * - TRES GUARDS NUEVOS, cada uno por algo que efectivamente paso:
 *     1. Los dos bloques se verifican POR SU TITULO Y SUS ROTULOS antes de escribir. Una posicion
 *        se pudre sin avisar; un rotulo no.
 *     2. Se comprueba que la celda destino sea el ANCLA de su combinada, no su mitad muda.
 *     3. Se comprueba que el selector de moneda tenga una moneda de verdad.
 * - Y la conversion deja de apuntar a $AF$17/18/19: llama a TIDETRACK_USD/AUD/EUR(). Ese bloque de
 *   cotizaciones se mudo a las filas 27-29, y una coordenada que se pudre no da error -- da otro
 *   numero. Una funcion no tiene coordenada que se pueda mover.
 * - Los rotulos de los tipos NO se tocan: son de Franco, el script solo suma.
 * - "Disponibilidad de fondos" (O23:O25) queda como estaba: el bloque por moneda sigue existiendo.
 *
 * [2026-08-20] v0.23.2 - El verificador dice POR QUE una celda quedo sin formula.
 * - "quedo SIN formula" es un sintoma, no un diagnostico, y esta campana ya perdio tiempo dos
 *   veces adivinando cual de las dos causas posibles era. Ahora el verificador las separa solo:
 *     a) LA CELDA no acepta formulas -- parte de una combinada sin ser su ancla, o protegida. Lo
 *        escrito se traga sin excepcion (asi se perdio L29 el 2026-08-19).
 *     b) LA FORMULA no parsea. Sheets la rechaza y deja la celda VACIA, sin error visible (asi se
 *        perdio una formula entera por usar "n" de variable de LET, que choca con la funcion N()).
 * - El canario las distingue: se escribe "=1+1" en la MISMA celda. Si entra, la celda esta sana y
 *   el problema es la formula; si no entra, el problema es la celda. Despues se limpia.
 * - Cuando el problema es la formula, el mensaje ademas lista las variables de LET declaradas,
 *   que es donde vive la colision en la practica.
 *
 * [2026-08-20] v0.23.1 - La consolidada del Plan se ubica MIDIENDO, no por marca de estado.
 * - SINTOMA: "Limpiar Plan de Cuentas" abortaba con "La consolidada de S8 no tiene formula",
 *   cuando la consolidada estaba perfecta -- en R.
 * - CAUSA: el modulo deducia su posicion de una marca en DocumentProperties ("ya se borro la
 *   columna Q?"). El borrado habia ocurrido en una corrida ANTERIOR a que esa marca existiera,
 *   asi que lo creia pendiente, aplicaba el offset de "antes del borrado" y miraba una columna
 *   vacia. Una marca de estado puede faltar; la hoja no.
 * - CORRECCION: la consolidada se busca en la hoja -- primera columna a la derecha del bloque de
 *   Categorias cuya celda de datos tiene formula -- y el borrado de columna se decide por
 *   GEOMETRIA: si entre la columna de nombres y la consolidada queda mas de una separadora, sobra
 *   una columna adentro del recuadro. Ninguna de las dos cosas depende ya de recordar nada.
 * - La marca queda como rastro, sin poder de decision.
 *
 * [2026-08-20] v0.23.0 - "Saldos Actuales" deja de ser un desglose por moneda.
 * - EL BLOQUE AE7:AG12 pasa a sumar POR TIPO DE MEDIO: Hogar, Ahorros, Inversiones,
 *   Financiacion, cada uno con su monto convertido a la moneda del selector y su peso en % sobre
 *   el total. decision Franco 2026-08-19. Los tipos son cuatro y el bloque tiene cuatro filas de
 *   datos: entra justo. El desglose por moneda que habia ahi contestaba una pregunta que ya
 *   contesta el bloque "Medios Bancarios", cuenta por cuenta; la que faltaba era "en que finalidad
 *   esta mi plata".
 * - CONSECUENCIA QUE HABIA QUE ATAR: "Disponibilidad de fondos" (O23:O25) leia AF9:AF12 como si
 *   fueran las cuatro monedas y las convertia (AF9 + AF10*tc + AF11*tc + AF12*tc). Con el bloque
 *   nuevo eso multiplicaria por la cotizacion algo que ya viene convertido. Ahora la liquidez es
 *   el saldo del tipo Hogar, que es exactamente la plata disponible para cubrir gastos. Si
 *   "Disponibilidad de fondos" te venia dando de mas, era esto.
 * - DOS TRAMPAS CUBIERTAS ANTES DE ESCRIBIR, las dos ya conocidas de esta campana: la validacion
 *   de datos de la columna de rotulos (si solo acepta ARS/USD/AUD/EUR, "Hogar" se rechaza y la
 *   celda queda VACIA sin lanzar excepcion) y el formato de numero de la columna del peso (venia
 *   en moneda, y un ratio de 0,42 se veria "$0,42").
 * - EL BANCO DE PRUEBAS ATAJO UN BUG ANTES DEL DEPLOY: el reemplazo de la liquidez no era
 *   idempotente -- en la segunda pasada "liquidez_ars;" volvia a matchear desde adentro de
 *   "liquidez_moneda; liquidez_ars;" y se comia la definicion de presupuesto_ahorro. Se anclo el
 *   patron al shape viejo ("AF9 + ..."). Es la razon por la que el banco existe.
 * - "Deudas" pasa a la categoria "Deuda y financiacion". La categoria cruza bloques a proposito:
 *   la cuota fija vive en Gastos Fijos y la deuda que se paga cuando se puede, en Variables.
 * - LPC: la columna consolidada es la R, no la S -- se corrio cuando se borro la Q. Y el borrado
 *   de columna pasa a llevar su propia marca de hecho, para que no pueda repetirse y volver a
 *   correr todo un lugar mas.
 *
 * [2026-08-19] v0.22.1 - La columna Q se borra de verdad, con la red que faltaba.
 * - SE REVIERTE la decision de la v0.21.0 de solo vaciarla, y Franco tenia razon en insistir: el
 *   bloque "Categorias" ocupa P:Q y solo usa P, asi que queda una columna de aire ADENTRO del
 *   recuadro mientras los otros cuatro bloques estan ajustados. Vaciarla no alcanza -- el recuadro
 *   la sigue abarcando y el bloque se ve desprolijo. Yo habia mirado celdas sueltas en vez del
 *   bloque completo, y por eso no lo vi.
 * - LA RED QUE FALTABA, y es lo que hacia que la decision anterior fuera razonable: se guarda la
 *   regla del desplegable de Cuenta de Cargas ANTES de borrar, y se comprueba DESPUES que siga
 *   viva. Si el corrimiento de columnas la rompio, se repone apuntando a la consolidada en su
 *   posicion nueva. Con la red puesta, el riesgo que justificaba no borrar desaparece.
 * - Solo borra si la columna esta REALMENTE vacia; si tuviera datos, avisa y no la toca.
 * - "Ajuste" deja de ser un hueco: pasa a la categoria "Conciliacion". No es un ingreso -- es una
 *   correccion de saldo contra el banco -- pero vive en el bloque de Ingresos, y sin categoria
 *   quedaba a la vista como un olvido en medio de una columna completa.
 *
 * [2026-08-19] v0.22.0 - El bloque "Categorias" agrupa por la categoria de la cuenta.
 * - SINTOMA: el bloque mostraba Hogar / Ahorros / Inversiones / Financiacion. Son los TIPOS DE
 *   MEDIO: contestan DONDE estaba la plata, no PARA QUE se uso, que es justo lo que ese bloque
 *   promete. Cuatro filas genericas donde deberia haber "Vehiculo", "Alimentacion y social",
 *   "Deuda y financiacion".
 * - CAUSA: consecuencia no prevista de la v0.20.0. Cuando los medios declaraban su tipo A TRAVES
 *   de una categoria intermedia, el VLOOKUP de esa formula devolvia la categoria del medio -- al
 *   menos un nombre propio, "Chanchito", "Meta de Ahorro 1". Al sacar el nivel intermedio, el
 *   MISMO VLOOKUP pasa a devolver el tipo. La formula no cambio; cambio lo que hay del otro lado.
 *   Es el modo de falla mas silencioso que hay: nada se rompe, solo empieza a decir otra cosa.
 * - CORRECCION: no volver atras, sino apuntar al eje correcto. La categoria de la CUENTA vive en
 *   los tres bloques del Plan (C:D, F:G, I:J), asi que la busqueda es una cascada de tres IFERROR
 *   -- una cuenta esta en uno y solo uno de los tres.
 * - Es UNA sola celda, y se conserva el nombre de la variable a proposito: cambiarlo obligaria a
 *   tocar todas sus apariciones mas abajo en la misma formula, y cada token de mas es una chance
 *   de romperla.
 *
 * [2026-08-19] v0.21.0 - Plan de Cuentas en su forma final.
 * - decision Franco: "necesito que en la columna P esten todas las categorias, que la columna Q
 *   la elimines, y que revises porque quedaron cosas escritas en las columnas STU".
 * - QUE HABIA, medido en vivo: P y Q con titulo y encabezado pero SIN datos (el catalogo de
 *   categorias de medios se vacio al pasar los medios a tipo directo); S con la consolidada viva;
 *   U con dos categorias sueltas que dejo la corrida que murio en D8; y algo en V7. Nada de eso
 *   rompia nada, y justamente por eso se queda para siempre si no se barre a proposito.
 * - TODAS LAS CATEGORIAS PASAN A LA COLUMNA P. Nacieron en U para no pisar el bloque de
 *   categorias de medios; ese bloque quedo sin uso en la v0.20.0, asi que P quedo libre y es el
 *   lugar natural. Un catalogo con restos de versiones anteriores al lado deja de ser confiable:
 *   el que lo lee tiene que adivinar que parte esta viva.
 * - LA COLUMNA Q SE VACIA, NO SE BORRA, y la razon es concreta, no pereza. Borrar una columna
 *   CORRE todo lo que esta a su derecha: R pasa a Q, S a R. Y en S vive la formula que la propia
 *   hoja rotula "fuente de validacion - no tocar", la que alimenta el desplegable de Cuenta en
 *   Cargas. Sheets reacomoda las referencias de las FORMULAS al correr columnas, pero los rangos
 *   de las REGLAS DE VALIDACION no siempre siguen -- y hoy dos corridas seguidas se cayeron
 *   justamente por dar por sentado como se comportan las validaciones. El beneficio de borrarla
 *   es una columna vacia menos, y entre P y S ya hay una separadora (R) igual que entre todos los
 *   demas bloques. No vale arriesgar la carga de movimientos por eso. Queda sin contenido, sin
 *   titulo, sin encabezado y sin validacion: a la vista es una columna que no existe, y borrarla
 *   de verdad despues es un click a mano con la planilla ya estable.
 * - EL PREFLIGHT ABORTA si la consolidada de S perdio su formula: si esa columna ya esta rota,
 *   hay que arreglarla ANTES de barrer nada a su alrededor, no despues.
 *
 * [2026-08-19] v0.20.2 - La misma leccion, en las columnas de categoria de cuentas.
 * - "Categorizar cuentas" murio en D8: "Los datos ingresados en la celda D8 infringen las reglas
 *   de validacion de datos definidas en ella". Las tres columnas de Categoria de los bloques de
 *   cuentas tienen el MISMO desplegable con la lista vieja que tenia la columna de medios.
 * - DIFERENCIA CON EL CASO ANTERIOR, y vale registrarla: aca Sheets SI lanzo excepcion, asi que
 *   no escribio a medias. En la columna de medios el rechazo fue SILENCIOSO -- la celda quedaba
 *   vacia sin error. El mismo tipo de regla se comporta distinto segun como este configurada, y
 *   por eso no alcanza con confiar en que "si falla, avisa": hay que releer.
 * - Se aplica el tratamiento ya probado el mismo dia en la v0.20.1: la validacion de las tres
 *   columnas se reemplaza por la lista de categorias de cuentas ANTES de escribir; la foto de
 *   respaldo captura valores Y reglas de los cuatro rangos; y la reversion libera la validacion,
 *   escribe los valores y recien al final repone la regla vieja.
 * - AHORA REVIERTE TAMBIEN ANTE EXCEPCION. Antes el catch solo informaba: si moria a mitad de
 *   camino, el catalogo de categorias quedaba escrito y las columnas no. Una planilla a medio
 *   categorizar es peor que una sin categorizar, porque parece hecha.
 *
 * [2026-08-19] v0.20.1 - La validacion de la columna era parte del cambio.
 * - QUE PASO: la corrida de la v0.20.0 fallo en los 28 medios -- "no quedo con su tipo en el
 *   catalogo" -- y ademas dejo la columna VACIA, con lo que ningun medio clasificaba: capital del
 *   Tablero en cero y todo cayendo en cotidiano.
 * - LA CAUSA, vista en pantalla: la columna tiene un DESPLEGABLE de validacion con la lista de
 *   categorias. Mientras esa lista siga vigente, "Hogar" es un valor INVALIDO: Sheets lo rechaza,
 *   la celda queda vacia, y setValue NO LANZA NINGUNA EXCEPCION. Sin excepcion no hay forma de
 *   enterarse salvo releyendo la celda -- que es justo lo que hace el verificador desde la
 *   v0.12.1, y es lo unico que evito que esto pasara inadvertido.
 * - LA LECCION: cambiar lo que una columna SIGNIFICA incluye cambiar lo que esa columna ACEPTA.
 *   Una migracion que cambia el dominio de una columna y no toca su validacion no esta terminada:
 *   esta escribiendo contra una regla que dice lo contrario. Ahora la validacion se reemplaza por
 *   la lista de los cuatro tipos ANTES de escribir.
 * - LA REVERSION ESTABA MAL POR EL MISMO MOTIVO, y por eso la columna quedo vacia en vez de
 *   volver a su estado previo: reponia los valores viejos con la regla nueva ya puesta y se los
 *   rechazaba uno por uno. Ahora libera la validacion, escribe los valores, y recien al final
 *   repone la regla vieja. El orden importa.
 * - La foto de respaldo captura ahora tambien las REGLAS de validacion, no solo los valores. Una
 *   foto sin ellas no es un punto de retorno: es la mitad de uno.
 * - El preflight reporta la validacion que encuentra en la columna y avisa cuantos medios estan
 *   hoy sin tipo, con la consecuencia dicha en voz alta.
 *
 * [2026-08-19] v0.20.0 - El medio declara su tipo directo: fuera el nivel intermedio.
 * - decision Franco: "en medios bancarios utilicemos simplemente tipo". Antes la cadena era
 *   medio -> categoria -> tipo; ahora el medio declara su TIPO en la misma columna del catalogo.
 * - POR QUE, y la medicion es contundente: "Meta de Ahorro 1" concentraba 16 de los 28 medios,
 *   el 57% -- no era una meta, era el cajon donde caia todo lo que no era cotidiano. Cinco de
 *   las once categorias no tenian NINGUN medio (Tarjeta de Credito, Cambiar el Celular, Meta de
 *   Ahorro 2, Meta de Ahorro 3 y una sin nombre) y las cuatro restantes tenian exactamente uno.
 *   Un nivel de agrupamiento que deja el 57% en un solo grupo y el 45% de los grupos vacios no
 *   agrega informacion: agrega un salto mas donde equivocarse.
 * - QUEDA: Hogar 9 medios, Ahorros 11, Inversiones 7, Financiacion 1. Una distribucion real.
 * - ES UN CAMBIO ATOMICO y por eso el modulo escribe las dos mitades en la misma corrida: el
 *   catalogo y las nueve formulas que encadenaban dos VLOOKUP. Cambiar el catalogo sin las
 *   formulas haria que el segundo VLOOKUP busque un tipo dentro de la tabla de categorias, no lo
 *   encuentre, y TODA la clasificacion devuelva cadena vacia -- el capital a cero y el saldo
 *   cotidiano comiendose todo. Se revierten juntas.
 * - LA RIQUEZA NO SE MUEVE, y se verifica medio por medio: los unicos que cambian de tipo se
 *   mueven DENTRO de la riqueza (IOL, CEDEARS, CRYPTO, FCI y los Galicia Fima pasan de Ahorros a
 *   Inversiones, y las dos estan en la lista blanca). El unico que sale es Brubank, que no tiene
 *   un solo movimiento en el ledger. El preflight marca con un aviso cualquier medio que cruce
 *   el limite, por si en el futuro alguno lo hace de verdad.
 * - El colapso de las formulas se probo contra las NUEVE formulas reales del gemelo antes de
 *   desplegar: cambia todas, no deja residuos de P:Q, deja los parentesis balanceados y es
 *   idempotente. Las dos formas de la cadena -- anidada dentro de los arrays de QUERY, y en dos
 *   variables de LET consecutivas -- se colapsan las dos.
 * - EL BLOQUE P:Q NO SE BORRA. Queda como esta, sin uso. Es dato de Franco y borrarlo no aporta
 *   nada; si algun dia quiere volver a llevar objetivos de ahorro, el bloque esta ahi.
 *
 * [2026-08-19] v0.19.1 - Dos ejes, dos catalogos separados.
 * - CORRECCION DE DISENO sobre la v0.19.0, que no llego a correrse en la planilla. Franco freno y
 *   pregunto en voz alta si no convenia "separar las categorias de medios y las categorias de
 *   cuentas y listo". Tenia razon, y la v0.19.0 las estaba mezclando en P:Q.
 * - SON DOS EJES INDEPENDIENTES DEL MISMO MOVIMIENTO, no uno anidado en el otro:
 *     MEDIOS  -> DONDE ESTA la plata. Medio -> categoria (P:Q) -> tipo/finalidad: Ahorros,
 *                Inversiones, Financiacion, Hogar.
 *     CUENTAS -> POR QUE entro o salio. Cuenta -> categoria (catalogo nuevo, columna U).
 *   La nafta se puede pagar con la cuenta cotidiana o con la tarjeta: misma categoria de cuenta,
 *   distinta finalidad de medio. Si una determinara a la otra, esa diferencia no se podria
 *   representar.
 * - Y ESE CRUCE ES LA INFORMACION QUE SE BUSCA, medido sobre el ledger: "Alimentacion" se pago
 *   casi toda desde medios de finalidad Hogar ($6.961.137), pero $46.300 salieron de un medio de
 *   Ahorros. Comerse los ahorros no lo dice ninguno de los dos ejes por separado, solo el cruce.
 * - LA CATEGORIA DE CUENTA NO LLEVA UN "TIPO" PROPIO. Seria un tercer nivel redundante: el
 *   agrupamiento que cruza bloques ya sale del NOMBRE. "Vehiculo" figura en Gastos Fijos (Nafta,
 *   Auto) y en Variables (Reparaciones, Estacionamiento), y con eso alcanza para sumar los
 *   $4.793.879 que cuesta el auto. Los ocho tipos que la v0.19.0 iba a inventar se descartan.
 * - RANGES.CATEGORIAS_CUENTA declara el bloque nuevo (columna U del Plan de Cuentas) con su
 *   fundamento inline. El preflight avisa -- sin abortar -- si una categoria de cuentas se
 *   llamara igual que una de medios: no rompe nada, pero confunde al leer.
 * - P:Q NO SE TOCA. Es el eje de los medios y queda exactamente como esta.
 *
 * [2026-08-19] v0.19.0 - Plan de Cuentas de tres niveles: cuenta, categoria, tipo.
 * - EL PROBLEMA: 60 cuentas sueltas y las tres columnas "Categoria" de los bloques de cuentas
 *   VACIAS -- 0 de 11 en Ingresos, 0 de 15 en Gastos Fijos, 0 de 22 en Variables. Sin ese nivel
 *   intermedio no se puede leer nada por encima del detalle: "Nafta" y "Auto" son dos lineas
 *   sueltas en vez de "el auto me cuesta tanto".
 * - LA ESTRUCTURA: CUENTA -> CATEGORIA -> TIPO. La categoria agrupa dentro de su bloque; el TIPO
 *   es la macro-segmentacion y CRUZA los bloques. Ese cruce es todo el valor del nivel de arriba:
 *   "Vehiculo" junta Nafta y Auto (fijos) con Reparaciones y Estacionamiento (variables) y da
 *   $4.793.879 en 32 meses, $149.808 por mes -- el segundo gasto mas grande de Franco despues de
 *   sus propios negocios, y hasta hoy invisible porque estaba partido en dos bloques.
 * - LOS DOS VOCABULARIOS DE "TIPO", que es la parte que hubo que aclarar: los cuatro que ya
 *   vivian en P:Q (Ahorros, Inversiones, Financiacion, Hogar) fueron pensados para los MEDIOS DE
 *   PAGO y contestan DONDE ESTA la plata. Las categorias de CUENTAS contestan otra cosa: PARA QUE
 *   se usa. Tres de los cuatro sirven para las dos preguntas y se reutilizan tal cual; "Ahorros"
 *   queda solo para medios, porque ninguna cuenta de gasto o ingreso es un vehiculo de ahorro; y
 *   se agregan ocho (Ingresos, Negocios, Vehiculo, Salud, Bienestar, Obligaciones, Equipamiento,
 *   Otros) para cubrir el lado del uso. Forzar las cuentas dentro de los cuatro viejos habria
 *   puesto "Sueldo" y "Nafta" bajo etiquetas que no significan nada para ellas.
 * - Ambos vocabularios conviven en la MISMA tabla P:Q sin chocar: un medio busca su propia
 *   categoria y una cuenta la suya. Lo unico que no puede pasar es que dos categorias distintas
 *   se llamen igual con tipos distintos, y el preflight ABORTA si eso ocurre -- dos verdades para
 *   el mismo nombre romperian toda formula que cruce por categoria.
 * - EL AGRUPAMIENTO SALE DE LOS DATOS: 3.458 movimientos sobre 32 meses. Sigue el uso real de
 *   Franco, no una taxonomia de manual.
 * - "Compra USD" NO se categoriza, a proposito (decision Franco): pasa a ser un traspaso y deja
 *   de existir como cuenta. Categorizarla seria consagrar algo que esta por desaparecer. Es la
 *   unica cuenta del catalogo que queda sin categoria, y el informe lo dice con su motivo.
 * - NO unifica las cuentas escritas de dos formas ("Pago tarjeta" / "Pago Tarjeta"): las mapea a
 *   la misma categoria, asi que el agrupamiento ya sale bien, pero el par sigue existiendo hasta
 *   que se decida cual se queda. Son seis pares y el mayor parte $2.123.503 en dos mitades.
 *
 * [2026-08-19] v0.18.0 - BD de Proyeccion: el presupuesto deja de estar tipeado a mano.
 * - EL PROBLEMA: el Tablero compara lo que PASO contra lo que estaba PREVISTO. La mitad de "lo
 *   que paso" sale del ledger desde siempre; la mitad de "lo previsto" eran TRES CONSTANTES
 *   escritas a mano en N9, N10 y N11 que nadie podia auditar ni cambiar sin abrir la celda.
 * - LA HOJA: "Proyeccion", espejo exacto de "Registros". Se clona con copyTo y no se reconstruye
 *   por codigo: un copyTo trae de una el ancho de las columnas, los formatos numericos, las
 *   validaciones, el formato condicional y las filas congeladas. Reponer todo eso a mano es
 *   superficie para equivocarse en silencio, y el pedido de Franco fue explicito -- "desde la
 *   arquitectura hasta el diseno".
 * - Y SE LE BORRAN LOS DATOS, con verificacion de que quedo vacia. Un espejo que arranca con los
 *   3.500 movimientos del ledger adentro seria un presupuesto identico a la realidad: daria 100%
 *   de cumplimiento siempre, que es el peor error posible en esta hoja porque es invisible.
 * - EL CABLEADO usa EL MISMO CRITERIO que los bloques de la realidad (filtro por Tipo de Cuenta,
 *   exclusion de las cuentas neutras). Si el presupuesto se sumara distinto que lo real, el
 *   porcentaje de cumplimiento compararia peras con manzanas y nadie lo notaria.
 * - DECISION DE DISENO, la mas importante del modulo: un movimiento proyectado NO TIENE
 *   cotizacion congelada, y no puede tenerla -- nadie sabe a cuanto va a estar el dolar el mes que
 *   viene. Por eso la proyeccion se convierte con la cotizacion de HOY (AF17/AF18/AF19) y no con
 *   las columnas J:M del espejo. Un presupuesto en dolares vale lo que vale hoy y se re-evalua
 *   solo cuando la cotizacion cambia. Las columnas J:M existen igual porque la hoja es un espejo
 *   exacto: si algun dia se quiere congelar un TC previsto, la columna esta.
 * - SHEETS.PROYECCION entra como GETTER DE ALIAS ('Proyeccion' / 'Proyección') y no como string
 *   estatico. El nombre natural en castellano lleva tilde, ninguna otra pestania de la planilla
 *   usa acentos, y esa clase exacta de ambiguedad ya costo caro tres veces en este repo.
 * - La hoja nace VACIA: N9:N11 dan cero hasta que Franco cargue movimientos previstos. Es
 *   correcto y hay que decirlo, porque un cero puede leerse como "se rompio": hasta hoy esos tres
 *   numeros no salian de ningun lado.
 *
 * [2026-08-19] v0.17.1 - El bloque de medios termina en la fila 29.
 * - decision Franco: "en medios bancarios la formula debe llegar hasta la fila 29, no 30". Marca
 *   DOS limites a la vez y los dos importaban:
 *     (a) hasta donde se LIMPIA el area antes de escribir. Estaba en 45, heredado de una
 *         estimacion mia, o sea que la limpieza podia pisar lo que hubiera debajo del bloque --
 *         que no es nuestro. Un area de limpieza mas grande que el bloque es un destructor
 *         silencioso esperando a que alguien ponga algo ahi.
 *     (b) cuantas filas puede ocupar el resultado. El derrame se acota con ARRAY_CONSTRAIN a 12
 *         filas (18 a 29). Si alguna vez hubiera mas medios con saldo que filas disponibles, se
 *         muestran los 12 mayores en vez de derramar sobre el bloque de abajo.
 * - El alto se DERIVA de las constantes del bloque (filaFin - filaDatos + 1) en vez de escribirse
 *   a mano en dos lugares: mover el limite es cambiar un numero, no dos que se pueden
 *   desincronizar.
 *
 * [2026-08-19] v0.17.0 - Limpiar antes de derramar, y conciliar contra los saldos declarados.
 * - EL #REF! DE F18 Y H18: un derrame NO se expande si tiene que pisar contenido, y debajo de las
 *   columnas Moneda y Monto quedaban los valores estaticos viejos ("ARS", "42327,35"...). C18 no
 *   fallo por casualidad: su columna ya la habia pisado la corrida anterior. Ahora el area de
 *   datos del bloque se LIMPIA antes de escribir las tres formulas.
 * - Y ESO OBLIGO A CORREGIR EL RESPALDO: el de este modulo guarda FORMULAS, y lo que hay que
 *   sacar de en medio son VALORES. Un respaldo que no cubre lo que vas a destruir no es un
 *   respaldo. Se fotografia el area completa -- valores y formulas, celda por celda -- antes de
 *   limpiar, y se restaura entera si la verificacion falla.
 * - CONCILIACION CONTRA LOS SALDOS DECLARADOS (DEVTOOL_ConciliarSaldos). Franco declaro dos veces
 *   los saldos reales de sus cuentas y que "el resto son 0". Cuando la planilla dice $50.607 y el
 *   banco dice $0, la planilla no esta mal calculada: le FALTAN MOVIMIENTOS. El mecanismo que
 *   Franco ya usa para eso es la cuenta 'Ajuste' -- 70 filas historicas --, y este modulo lo
 *   automatiza: mide, compara contra el declarado, y carga la diferencia.
 *   No es cosmetica. Un ajuste de conciliacion es un asiento legitimo: dice "a esta fecha mis
 *   registros diferian de la realidad en tanto", queda en el ledger con fecha y nota, y es
 *   auditable. Lo que NO seria legitimo es tocar la formula para que devuelva el numero deseado.
 * - LA ADVERTENCIA QUE EL MODULO PONE EN EL DIALOGO, porque tiene costo: el ledger termina el
 *   2026-08-12 y los saldos son al 19. Parte de la diferencia de NaranjaX ($29.635,41) y Efectivo
 *   ($102.000,00) son movimientos REALES de esos siete dias que todavia no se cargaron. Al
 *   conciliar hoy, esos gastos quedan como un ajuste sin detalle en vez de como los movimientos
 *   que fueron: se gana un saldo correcto y se pierde el detalle de la semana. Y si despues se
 *   cargan esos dias, el saldo va a quedar mal por el monto del ajuste y habra que borrar esas
 *   filas. No se pueden hacer las dos cosas, y conviene decidirlo antes.
 * - El modulo no inventa cotizaciones: si no hay TC para la fecha del ajuste usa la mas reciente
 *   anterior y lo DECLARA en el informe (Regla Estricta 9).
 *
 * [2026-08-19] v0.16.1 - Celdas combinadas: el bloque de medios necesita tres formulas, no una.
 * - SINTOMA: Franco corrio la v0.16.0 y dijo "no note los cambios". Se midio en vivo por Chrome
 *   sobre la planilla productiva en vez de suponer: las formulas SI estaban escritas (AF9, AG9,
 *   C18, N19, O16 tenian el modelo nuevo), pero el bloque "Medios Bancarios" mostraba los medios
 *   NUEVOS con los montos VIEJOS al lado. Es peor que no haber hecho nada, porque parece que
 *   anduvo: la lista de cuentas era correcta y los numeros de al lado no.
 * - CAUSA, y es de geometria: el bloque esta hecho de CELDAS COMBINADAS. C17:E17 dice "Medio",
 *   F17:G17 "Moneda", H17:I17 "Monto", y cada fila de datos repite ese patron. Una formula que
 *   devuelve TRES columnas no puede derramar sobre eso: Sheets derramo unicamente la primera --
 *   los nombres -- fila por fila hacia abajo, y las columnas Moneda y Monto reales, que son F:G y
 *   H:I, quedaron con los valores estaticos que ya tenian.
 * - CORRECCION: tres formulas de UNA columna, ancladas en C18, F18 y H18. Las tres derivan de la
 *   MISMA matriz ordenada y toman su columna con INDEX, de modo que las filas se corresponden
 *   siempre, aun cuando dos medios tengan el mismo saldo. Mas un preflight que verifica los tres
 *   rotulos antes de escribir, y un chequeo en el banco de pruebas que exige que las tres salgan
 *   de la misma matriz.
 * - EL DIAGNOSTICO SE MUDA DE L29. Esa celda es parte del merge L28:O29 que contiene la
 *   comprobacion de traspasos: escribir ahi no muestra nada. El guard de isPartOfMerge existia
 *   desde la v0.14.1 pero solo se aplicaba a esa unica celda; ahora se recorre una lista de
 *   candidatas y se usa la primera libre y sin combinar, informando cual fue.
 * - LO QUE SI HABIA QUEDADO BIEN y no se toca: el bloque "Saldos Actuales" (AE:AG) son celdas
 *   simples y tienen el modelo correcto; N19 es el residuo; O16 suma las tres filas; y la
 *   comprobacion de traspasos de L28 nunca se piso -- se verifico leyendola.
 * - LECCION: el guard de celdas combinadas se habia escrito para UNA celda cuando el problema era
 *   de toda una familia. Un guard puntual sobre un defecto estructural solo tapa el caso que ya
 *   conocias.
 *
 * [2026-08-19] v0.16.0 - El saldo se corta en la ultima conciliacion.
 * - LA REGLA: saldo de un medio = su ULTIMO asiento "Inicio Mes" + todos los movimientos
 *   posteriores. "Inicio Mes" NO es un movimiento: es el punto de corte de una CONCILIACION.
 *   Cuando Franco lo carga esta diciendo "el banco dice que tengo esto", y con eso todo lo
 *   anterior queda saldado. Por eso fallan las dos alternativas obvias: sumar todo el historico
 *   DUPLICA (cada arrastre vuelve a contar el dinero que ya estaba en los movimientos que lo
 *   originaron: $8,7M contra $0,5M reales), e ignorar los arrastres -- lo que hicieron la v0.14 y
 *   la v0.15 -- PIERDE EL SALDO DE APERTURA y deja nueve medios en negativo.
 * - CERO NEGATIVOS. Franco lo habia dicho como requisito ("no pueden haber saldos negativos") y
 *   resulto ser el sintoma exacto del modelo equivocado, no una regla de presentacion.
 * - VALIDADA CONTRA VERDAD DE CAMPO, que es lo que faltaba en las dos vueltas anteriores. Franco
 *   paso siete saldos reales y CINCO coinciden AL CENTAVO: Frascos Nx - Prestamo $230.000,00,
 *   Frasco transitorio Nx $44.141,01, YPF $3.494,90, Dolar Cash US$110,00, Dolar Galicia
 *   US$91,10. Los dos que no coinciden son exactamente los que usa todos los dias -- Efectivo
 *   (delta $102.000) y NaranjaX (delta $29.635,41) -- y la causa esta medida: el ledger terminaba
 *   el 2026-08-12 y la medicion se hizo el 19. Faltaban siete dias de carga, no de logica. Si el
 *   calculo estuviera roto fallaria en los siete, no en los dos que tienen movimiento reciente.
 * - EL MEDIO TIENE QUE EXISTIR EN EL PLAN DE CUENTAS. El corte se resuelve por VLOOKUP contra el
 *   catalogo: un movimiento cuyo medio no este ahi queda fuera de todo saldo. Un saldo bancario
 *   es la suma de lo que paso por una cuenta, y un movimiento sin cuenta valida no tiene saldo al
 *   que pertenecer. Son 39 filas por $2.147.186 y se cuentan aparte, en L29.
 * - ESO RESUELVE SOLO EL CASO "YPF - wallet", sin tocar una fila del ledger: son cinco filas y las
 *   cinco son "Inicio Mes", el arrastre de YPF escrito con otro nombre. Como no esta en el
 *   catalogo queda excluido, y YPF da $3.494,90, que es exactamente lo que Franco declaro. Los
 *   estabamos contando como dos medios y duplicaban ese monto.
 * - Tablero!C18 lista SOLO los medios con saldo distinto de cero, de mayor a menor. decision
 *   Franco: "no quiero que me aparezcan todos los medios, solo los que tienen saldo a la fecha".
 *   Un listado con veinte ceros no es informacion.
 * - RENDIMIENTO: los cortes se calculan con UN solo MAP sobre los 28 medios del catalogo y
 *   despues se proyectan a cada fila con un VLOOKUP vectorizado. La forma ingenua -- un FILTER
 *   por medio dentro de cada formula de saldo -- repetia ocho veces el mismo barrido de 3.500
 *   filas.
 * - LOS TRASPASOS ESTABAN SANOS y quedan documentados como tales: 291 pares perfectos entre
 *   medios distintos, uno solo con ambas patas en el mismo medio, 45 filas sin par. La sospecha
 *   sobre ellos era razonable pero la medicion la descarto.
 *
 * [2026-08-19] v0.15.0 - Saldos bancarios reales: el medio pasa a ser obligatorio.
 * - EL DEFECTO QUE FRANCO CAZO MIRANDO UN NUMERO: "aparece que tengo un flujo de ARS $2.574.778
 *   pero este mes tuve ingresos por $1.138.512... probablemente la diferencia no sea por eso".
 *   Tenia razon. De esos $2,57M, $2,40M eran filas SIN MEDIO. La condicion de la v0.14 era "el
 *   tipo de categoria no es de riqueza", y un medio inexistente la cumple porque su tipo es
 *   cadena vacia: las 39 filas sin medio valido caian enteras en el saldo cotidiano. Ahora se
 *   exige que el medio exista en el Plan de Cuentas. Un saldo bancario es la suma de lo que paso
 *   POR UNA CUENTA; un movimiento sin cuenta no tiene saldo al que pertenecer, asi que no se
 *   reparte ni se estima: se deja afuera y se cuenta aparte.
 * - SALDOS REALES, medidos: ARS $517.658 (cotidiano $427.591 + riqueza $90.067), USD -434,41.
 *   Por medio: NaranjaX $144.177, Efectivo $112.500, Frascos Nx - Prestamo $230.000, Uala
 *   -$38.892, Patagonia -$13.850. Total de las cuentas del Plan: $517.224.
 * - FUERA LA QUINTA FILA. decision Franco: "lo de Flujo cotidiano esta de mas, no es una
 *   categoria definida; todo se debe repartir en fijos, variables y capitalizacion". Con tres
 *   buckets la identidad se cierra de la unica forma posible: la capitalizacion pasa a ser el
 *   RESIDUO (Ingresos - Fijos - Variables). Deja de medirse sumando movimientos hacia vehiculos
 *   de ahorro y pasa a ser "lo que no gastaste", que es la definicion que se quiere leer.
 *   Contrapartida honesta: O16 da 100% por construccion, asi que deja de avisar si algo no
 *   cuadra. Por eso el diagnostico de L29 se vuelve MAS importante, no menos.
 * - Tablero!C18 pasa a mostrar el SALDO ACTUAL por cuenta bancaria, sobre todo el historico.
 *   Antes sumaba solo el mes seleccionado: nunca habia sido un saldo. Es lo que Franco venia
 *   pidiendo desde el primer mensaje de la sesion.
 * - ALTA DE 12 CUENTAS que el ledger usa hace anios y el catalogo nunca tuvo, 111 movimientos.
 *   La mas importante es 'Ajuste' (70 filas, $1.949.641): el mecanismo de conciliacion contra el
 *   banco, que existia en los datos y era invisible para el sistema. Once traen su tipo declarado
 *   por el propio ledger de forma unanime (las 12 filas de "Pago Tarjeta" dicen Gasto Fijo, las
 *   10 de "umoh" dicen Ingreso): no se adivina ninguna. 'Ajuste' es la unica decision, porque no
 *   tiene tipo en ninguna de sus 70 filas -- no es ingreso ni gasto, es una correccion de saldo.
 *   Va al bloque de Ingresos: el signo ya lo lleva la columna Tipo del movimiento, asi que el
 *   bloque solo decide en que dropdown aparece, y ahi queda disponible en los dos sentidos.
 * - "Frasco transitorio USD" NO EXISTE, ni en el ledger ni en el catalogo. El unico parecido es
 *   "Frasco Transitorio NaranjaX", que es ARS y apunta a Meta de Ahorro 1. El total USD del
 *   ledger es -434,41 y esta enteramente en medios de riqueza (Dolar NaranjaX -636,51, Dolar
 *   Cash 110, Dolar Galicia 91,10, Dolar Patagonia 1,00).
 *
 * [2026-08-19] v0.14.1 - Los dos defectos que abortaron la corrida de v0.14.0.
 * - LO PRIMERO: la corrida fallida NO dejo dano. La reversion del lote funciono exactamente como
 *   debia y las 21 celdas volvieron a su formula previa. El guard hizo su trabajo; lo que fallo
 *   fue lo que el guard estaba comparando.
 * - DEFECTO 1, COMILLAS DE MAS (10 formulas). Se escribia 'Registros'!B7:B y Sheets lo GUARDA como
 *   Registros!B7:B: le saca las comillas porque el nombre no las necesita. La verificacion
 *   comparaba el texto releido contra el texto escrito, no coincidian, y revertia diez formulas
 *   CORRECTAS. La evidencia estaba a la vista en el gemelo: 256 referencias a Registros sin
 *   comillas y CERO con comillas. Correccion en dos capas: _refHoja() entrecomilla solo cuando el
 *   nombre lo requiere (Plan de Cuentas si, Registros no), y _canonizarFormula() normaliza ambos
 *   lados antes de comparar, porque Sheets reescribe lo que le mandas. La comprobacion del VALOR
 *   -- que es el gate duro, el que caza las formulas que no calculan -- no se relajo.
 * - DEFECTO 2, UNA VARIABLE QUE CHOCA CON UNA FUNCION (Tablero!L29). La formula usaba 'n' como
 *   nombre de variable de LET, y N() es una funcion de Sheets: la formula entera no parsea y la
 *   celda queda SIN NADA, que es distinto de quedar con un error. Pasa a llamarse 'cantidad' y
 *   'monto_total'.
 * - EL BANCO DE PRUEBAS AHORA RECHAZA LAS DOS CLASES, y ademas toda variable LET de una o dos
 *   letras. Y se verifico que los guards DISPARAN, reproduciendo los tres bugs historicos contra
 *   ellos ('Registros' entrecomillado, la variable n, y el $N$N de la v0.12.0): un guard que no
 *   salta es peor que no tenerlo, que es la cicatriz 5 y ya la cometimos una vez en este mismo
 *   modulo.
 * - PREFLIGHT: detecta celdas combinadas con isPartOfMerge(). Una celda que es parte de un merge
 *   sin ser su ancla se lee vacia y se deja escribir sin protestar, pero lo escrito no queda: se
 *   veria igual que "quedo sin formula" y mandaria el diagnostico por el camino equivocado.
 *
 * [2026-08-19] v0.14.0 - Stock y flujo separados: los saldos dejan de depender del mes.
 * - EL PROBLEMA DE FONDO: un saldo y un movimiento son cosas distintas y la planilla los calculaba
 *   igual, filtrados por mes. Por eso hacia falta cargar un "Inicio Mes" todos los meses -- un
 *   asiento que reescribe el saldo de apertura de cada medio -- para que los saldos dieran bien.
 *   A partir de aca: FLUJO se filtra por mes, STOCK lee el ledger entero y no se filtra por nada.
 * - POR QUE EL ARRASTRE ROMPIA TODO: 'Inicio Mes' hacia DOS trabajos a la vez, saldo de apertura
 *   (redundante con la suma de los movimientos que lo originaron) y ajuste de conciliacion
 *   (legitimo). Como el arrastre ES el saldo anterior, sumar el historico lo cuenta dos veces y se
 *   infla mas cuantos mas meses hay. Medido: los 165 arrastres suman $10.153.852 contra $884.860
 *   de saldo real. "Frascos Naranja X" mostraba $1.465.839 y su saldo real es $0,00.
 * - LOS INGRESOS DEL MES BAJAN, y es correcto. Los arrastres no tienen Tipo de Cuenta, asi que
 *   obligaban a la clausula "(Col1 <> 'Inicio Mes' OR Col5 = 'Hogar')" en seis formulas: una regla
 *   que metia los arrastres de las cuentas de casa dentro de INGRESOS. Plata que no era ingreso de
 *   nada, contada como ingreso del mes. Se apaga en las seis.
 * - EL TERMINO QUE FALTABA. El bloque "Movimientos del Mes" nunca cerraba en 100% y no era un bug
 *   de formula: faltaba un sumando. La identidad es Ingresos - Gastos = variacion del patrimonio, y
 *   el patrimonio tiene dos mitades: los vehiculos de riqueza y las cuentas de todos los dias. Con
 *   solo la primera, la plata que no gastaste pero tampoco moviste a un plazo fijo no aparecia en
 *   ningun lado. Va a la fila 20, "Flujo Cotidiano" -- vocabulario que ya existia en la hoja, AF8
 *   dice "Flujo" y AG8 dice "Capital". N16 = N17 + N18 + N19 + N20.
 * - LO QUE NO CIERRA SE MUESTRA, NO SE DISIMULA. Aun con la fila nueva el porcentaje no da 100%
 *   exacto: 116 movimientos no clasifican (36 sin medio, 70 de cuenta 'Ajuste' -- que no esta en el
 *   Plan de Cuentas -- y 10 sin cuenta), $3,6M que cambian saldos sin ser ingreso ni gasto.
 *   Rellenarlo con una regla inventada seria exactamente el numero plausible y falso que este
 *   proyecto viene sacando de la planilla. Va a Tablero!L29 con nombre y monto; cuando esos 116 se
 *   resuelvan, el indicador va a cero y el bloque cierra solo.
 * - NO SE TOCA NI UNA FILA DEL LEDGER. Los 'Inicio Mes' quedan donde estan; lo que cambia es que
 *   ninguna formula los mira. Reversible sin perder datos.
 * - VERIFICACION: preflight que cruza el header del ledger contra RANGES columna por columna,
 *   exige que la fila 20 y L29 esten libres y que los rotulos AF8/AG8 digan "Flujo"/"Capital";
 *   respaldo congelado y releido antes de mutar; relectura del VALOR de cada celda con reversion
 *   del lote entero. Mas devtools/probar_stock_flujo.js, que revisa separadores es_AR, balanceo y
 *   ausencia de arrays literales autorados en cada formula generada, antes de desplegar.
 *
 * [2026-08-19] v0.13.0 - Riqueza por lista blanca, y el Tipo a la vista en el bloque de categorias.
 * - CAMBIO DE DEFINICION, no correccion de bug (decision de Franco del 2026-08-19). Hasta hoy el
 *   capital acumulado se calculaba como "todo tipo de categoria que NO sea Hogar". Eso hacia que
 *   la FINANCIACION -- Tarjeta de Credito, Prestamo Mac -- sumara como patrimonio. Una tarjeta es
 *   un pasivo. Riqueza pasa a definirse por LISTA BLANCA: solo Ahorros e Inversiones.
 * - POR QUE LISTA BLANCA Y NO ARREGLAR LA NEGRA: con "todo lo que no sea Hogar", cualquier tipo
 *   nuevo del catalogo entraba a riqueza sin que nadie lo decidiera, por el solo hecho de no
 *   llamarse Hogar. Una lista blanca obliga a decidir. La regla vive en TIPOS_RIQUEZA
 *   (00_Config.js), no repartida por seis formulas.
 * - LA TRAMPA DE ESTE CAMBIO, y por que el modulo trabaja sobre una lista cerrada de celdas en
 *   vez de barrer la planilla reemplazando "Hogar": hay DOS usos del tipo de categoria que se
 *   parecen y no se corrigen igual. (a) "es riqueza?" -> las seis celdas que ligan cond_riqueza /
 *   cond_ahorro: Inicio!F8, Tablero!N19 y Tablero!AG9:AG12. (b) "es flujo cotidiano?" -> las diez
 *   que dejan entrar los arrastres 'Inicio Mes' cuando el medio es de casa (Inicio!C13/F13/C15/F15,
 *   Tablero!R9/U9/X9) y los saldos cotidianos (Inicio!C8, Tablero!AF9:AF12, que ademas filtran por
 *   NOMBRE de categoria y no por tipo). Las (b) NO se tocan: romperlas romperia el saldo cotidiano,
 *   que hoy cierra al centavo contra el ledger.
 * - IMPACTO MEDIDO sobre el ledger crudo antes de aplicar: el cambio mueve meses enteros --
 *   marzo 2026 -$567.974, abril +$332.974, junio +$200.000, agosto -$230.000 -- aunque en el
 *   acumulado historico la Financiacion neta solo +$230.000 en 7 filas. Es el efecto buscado.
 * - LA COLUMNA DEL TIPO. Tablero!AA9 derrama AA=categoria, AB=vacia, AC=monto, y el rotulo AB8 YA
 *   DECIA "Tipo" desde el rediseno: la columna se diseno para eso y quedo sin llenar, con una
 *   variable que la formula llamaba literalmente columna_ak_vacia y devolvia "" siempre. Ahora
 *   trae el tipo de cada categoria (VLOOKUP al catalogo) y la variable se llama columna_tipo.
 *   Ademas el bloque deja de filtrar las categorias de tipo Hogar: con el Tipo a la vista, mostrar
 *   todas es la lectura por macrosegmento que se buscaba. Si se prefiere lo otro, es una linea.
 * - CATALOGO: se deja 'Financiacion' como un solo tipo (decision de Franco). No se parte en
 *   'Tarjetas' y 'Financiamiento'.
 * - VERIFICACION: preflight que exige que el catalogo tenga al menos una categoria de cada tipo de
 *   la lista blanca (si no, el capital daria cero) y que el rotulo AB8 diga "Tipo"; respaldo
 *   congelado y releido antes de mutar; y relectura del VALOR de cada celda escrita, con reversion
 *   del lote entero si alguna queda en error. Mas devtools/probar_riqueza.js, que corre las
 *   transformaciones reales contra las formulas reales del gemelo ANTES de desplegar.
 *
 * [2026-08-19] v0.12.1 - Reparar la reparacion: el modulo que arreglo el formulerio rompio tres
 * celdas, y su verificador lo dejo pasar.
 * - QUE PASO: Franco corrio "Aplicar reparacion" y el modulo declaro exito. La auditoria sobre
 *   la planilla viva encontro que "Tablero"!O23, O24 y O25 habian pasado de #REF! a #ERROR!
 *   (Formula parse error): quedaron PEOR que antes. Las otras 24 celdas quedaron bien, y las
 *   siete agregaciones que se recalcularon contra el ledger cierran AL CENTAVO.
 * - EL BUG, en una linea: en _reponerReferencias habia dos reemplazos que usaban string de
 *   reemplazo en vez de funcion --  out.replace(/(\$N\$10\s*-\s*)#REF!/g, '$1$N$17'). En un
 *   string de reemplazo '$1' es el grupo capturado, '$N' es literal y '$17' vuelve a ser el
 *   grupo 1 seguido de un 7. En vez de "$N$10 - $N$17" escribio "$N$10 - $N$N$10 - 7". Las
 *   otras cuatro sustituciones de esa funcion zafaron por casualidad: dos no tienen grupos (y
 *   un '$4' sin grupo queda literal) y dos llevan el '$1' al final.
 * - LO GRAVE NO ES EL BUG SINO QUE PASO EL GUARD. _verificarEscrituraFormulerio comparaba el
 *   TEXTO releido contra el texto escrito y exigia cero #REF!, cero 'Liquidez' y cero anclas
 *   viejas. El texto corrupto cumple las cuatro. Comprobar que escribiste lo que querias
 *   escribir NO ES comprobar que funciona. Es la cicatriz 5 del arnes -- "un guard que reporta
 *   exito sin hacer el trabajo es peor que no tener guard" -- cometida por el modulo que la
 *   cita en su propia cabecera.
 * - CORRECCION EN TRES CAPAS, ninguna apoyada en la otra: (a) TODOS los reemplazos van por
 *   funcion de reemplazo, asi el valor devuelto se inserta tal cual y el problema no puede
 *   existir en un proyecto donde toda formula lleva '$'; (b) el verificador LEE EL VALOR
 *   RESULTANTE de cada celda y revierte el lote entero si alguna quedo en error, distinguiendo
 *   "ya estaba rota" de "la rompi yo"; (c) devtools/probar_formulerio.js corre las
 *   transformaciones REALES contra las formulas REALES del gemelo antes de desplegar. Esa
 *   tercera capa habria cortado el bug en diez segundos: no correrla fue el error de fondo.
 * - REPARACION DEL DANIO: el modulo reconoce y deshace el artefacto "$N$N$10 - 7" que aquella
 *   corrida dejo escrito. Sin eso, re-correr "Aplicar" contestaria "nada que hacer" con tres
 *   celdas rotas a la vista -- otra vez el mismo modo de falla.
 * - SEXTO DEFECTO, hallado por la misma auditoria y reparado aca: las columnas "Valor en X" de
 *   "Inicio" (AF8 y AT8) NO CONVIERTEN MONEDA. Leen la moneda de la columna de CUENTA (V y AJ)
 *   en vez de la de MONEDA (Y y AM), asi que ninguna rama del IF se cumple, tasa_origen cae al
 *   literal 1 y la columna es un passthrough del monto crudo: todo movimiento en moneda
 *   extranjera entra a C13, F13, C15 y F15 A VALOR NOMINAL. Un cobro de 200 USD cuenta como 200
 *   pesos. Medido en junio de 2026: ~$376.740 de ingreso desaparecido, el 23% del mes. AT8
 *   ademas tomaba la moneda de DESTINO de Y13 -- que no es un selector sino la celda con la
 *   moneda del sexto movimiento del mes actual --, y el rotulo AT7 repetia la referencia.
 * - QUINTO DEFECTO diagnosticado pero NO reparado: "Inicio"!C15/F15 devuelven siempre "0%
 *   respecto del mes anterior" aunque la variacion real sea de +155%. Causa: cuatro condiciones
 *   se ligan a variables de LET sin ARRAYFORMULA, la comparacion se evalua por interseccion
 *   implicita, FILTER recibe una condicion de una fila y tira error de tamanio, y el IFERROR
 *   externo lo vuelve 0. Queda para una pasada propia: es otro mecanismo de falla y muestra un
 *   rotulo feo, no un numero equivocado en una cifra de portada.
 *
 * [2026-08-19] v0.12.0 - Formulerio reparado: "Inicio" y "Tablero" dejan de mentir.
 * - CONTEXTO: el swap v0.11 movio las celdas de las dos hojas que Franco MIRA y las formulas se
 *   copiaron apuntando a las direcciones viejas. El resultado no eran errores -- eso hubiera
 *   sido benigno -- sino numeros plausibles calculados sobre datos mal apareados. Solo cuatro
 *   celdas mostraban un error visible (#REF!/#VALUE! en el Tablero); el resto mentia en silencio.
 * - DEFECTO 1, EL DE FONDO: "Tablero"!AJ6 es el motor entero de la hoja, un unico QUERY sobre
 *   Registros!B6:M que DERRAMA doce columnas desde la fila 6. Quince formulas consumidoras
 *   pedian la fila 9 (AK9:AK, AO9:AO, AR9:AR...), asi que cada monto se apareaba con el tipo, la
 *   moneda y la cotizacion del movimiento TRES FILAS MAS ABAJO. De ahi que N19 declarara
 *   $63.567.848 de capitalizacion en un mes: montos en pesos multiplicados por la cotizacion del
 *   dolar porque cayeron en el bucket de moneda equivocado.
 * - DEFECTO 2: el selector de moneda vivia en $I$9 y el rediseno lo movio a N4; las formulas
 *   portadas quedaron con #REF! en su lugar -- diecisiete tokens en ocho celdas. Donde el #REF!
 *   estaba envuelto en IFERROR se degradaba en silencio: AV6 ("Valor en ARS") devolvia una
 *   columna entera de ceros, y con ella S7/V7/Y7, N16/N17/N18 y O16:O19, o sea el bloque
 *   "Movimientos del mes" completo. Donde no lo estaba, propagaba (O23:O25 = #REF!).
 * - DEFECTO 3: el bloque "Disponibilidad de fondos" quedo rotado UNA POSICION respecto de sus
 *   rotulos. El rediseno reordeno las etiquetas (el orden viejo empezaba por Ahorro, el nuevo
 *   por Gastos Fijos) pero las formulas se pegaron en el orden viejo: la de Capacidad de Ahorro
 *   terminó en la fila de Gastos Fijos. Cada una calculaba bien lo suyo, en la fila del vecino.
 * - DEFECTO 4: catorce celdas comparaban contra el tipo de categoria 'Liquidez', que el Plan de
 *   Cuentas nuevo ya no tiene (sus tipos son Ahorros / Inversiones / Financiacion / Hogar).
 *   'Hogar' es su equivalente 1:1 -- ambos con una sola categoria, "Medio Cotidiano". Al no
 *   cumplirse nunca la condicion, el gasto cotidiano se contaba como capital acumulado y los
 *   arrastres de "Inicio Mes" que si debian entrar quedaban todos afuera.
 * - COMO SE REPARA, Y POR QUE ASI: el modulo NO redacta ni una formula. Lee cada celda con
 *   getFormula(), reemplaza los tokens equivocados y la escribe de vuelta. El bloque rotado no
 *   se reescribe: se INTERCAMBIA. Es deliberado y evita de raiz la trampa de locale de
 *   07_MiradaInteranual -- la planilla es es_AR y setFormula no traduce los arrays literales {},
 *   que media docena de estas formulas usan. Al no autorizar ninguna, el ida y vuelta es
 *   identidad.
 * - GUARDS QUE ABORTAN SIN ESCRIBIR: el mapeo de columnas del motor se deriva de
 *   RANGES.REGISTROS.columns y se contrasta rotulo por rotulo contra el header del ledger (un
 *   mapeo supuesto y no verificado ya nos costo una vez); la rotacion se decide por el ROTULO de
 *   cada fila y no por su posicion; el catalogo debe tener cero 'Liquidez' y al menos un 'Hogar';
 *   el selector N4 debe contener una moneda del sistema. Y el re-apuntado toca UNICAMENTE rangos
 *   abiertos de dos letras (AK9:AK), nunca celdas sueltas: AF9:AF12 y $AF$17:$AF$19 son otro
 *   bloque de la hoja, hoy funcionan, y un reemplazo numerico 9->6 a ciegas los corrompia.
 * - RESPALDO: congela TODAS las formulas de las dos hojas como texto (apostrofo inicial, no
 *   setNumberFormat: ya nos paso en v0.9.8 que un respaldo "de texto" quedara vivo y
 *   recalculando) y lo RELEE antes de mutar. Si la relectura posterior a escribir no verifica, o
 *   si setFormula lanza a mitad del lote, cada celda vuelve a su formula previa.
 * - LO QUE NO TOCA, A PROPOSITO: AF9:AF12 e "Inicio"!C8 filtran por el NOMBRE de la categoria en
 *   vez de por su tipo -- fragil, pero hoy dan el numero correcto, y fragil no es roto. Tampoco
 *   limpia el Plan de Cuentas (fila huerfana P19/Q19, duplicado "Meta de Ahorro 3"): eso es dato
 *   de Franco. Ni el "0%" de "Inicio"!C15/F15, que es un quinto defecto y merece su diagnostico.
 *
 * [2026-08-18] v0.11.1 - Armas descargadas: se neutralizan las vias de escritura peligrosas
 * que quedaron vivas despues del swap, y se cierra el camino lateral que encontro la auditoria:
 * - CONTEXTO: con el swap v0.11 ya aplicado en produccion, la planilla quedo rodeada de codigo
 *   que sigue existiendo, sigue siendo invocable y escribe con la geometria vieja. Cuatro vias
 *   se neutralizaron en esta ronda; una auditoria adversarial posterior encontro que la
 *   neutralizacion principal se podia esquivar.
 * - VIA 1 - COTIZACIONES INVENTADAS (99_MigrationLogic). migrarBdAntigua y
 *   recalcularTcRegistros rellenaban las fechas sin cotizacion con 1050/650/1100: numeros sin
 *   ningun respaldo que quedaban CONGELADOS en el ledger, que es el unico dato que despues no
 *   se puede recalcular. Ahora ante una sola fecha faltante se aborta TODO-O-NADA, sin escribir
 *   una celda, listando las fechas y remitiendo a "Forzar carga historica".
 * - VIA 2 - FALLBACK MUDO DE FX (15_ExchangeRateApi). fetchArsRate devolvia la cotizacion mas
 *   reciente disponible sin emitir un solo log (verificado: fetchArsRate('2026-12-31')
 *   devolvia 1510, la del 17, sin rastro). Ahora: formato invalido -> lanza; fecha FUTURA ->
 *   lanza (el TC de un dia que no ocurrio no existe); cotizacion de otra fecha -> queda
 *   registrada, una linea por cotizacion ancla mas un resumen de lote (resumirFallbacksArs).
 * - VIA 3 - RECALCULO SIN AVISO (99_MigrationLogic). recalcularTcRegistros sobreescribe los TC
 *   congelados de todo el ledger de una sola vez: ahora pide confirmacion explicita NOMBRANDO
 *   cuantas filas va a pisar y el rango exacto. Ademas (a) las filas sin fecha legible se
 *   SALTEAN conservando sus cotizaciones -- antes recibian vacios en J:M en silencio y el
 *   cierre las contaba como recalculadas -- y se cuentan y se nombran; (b) el alto sale de la
 *   ultima fila con dato en la columna FECHA y no de getLastRow(), que mide cualquier columna:
 *   un valor suelto en T40 hacia escribir J7:M40, 34 filas para 2 registros reales.
 * - VIA 4 - MIGRACION v0.9.5 OBSOLETA. Su geometria caduco con el swap y revertir habria pisado
 *   la fila 7 (encabezados) y corrido el Data Lake una columna a la izquierda, destruyendo la
 *   columna Fecha de los cuatro bloques. Se le puso un guard que se deriva del CONFIG
 *   (_geometriaObsoletaV095 cruza el mapa del modulo contra RANGES y se apaga solo si algun dia
 *   vuelven a coincidir).
 * - LO QUE ENCONTRO LA AUDITORIA: el guard de la via 4 estaba SOLO en las tres entradas
 *   publicas. cuerpoRevertirV095_ -- que es la que hace todo el trabajo destructivo -- era
 *   invocable directo, no pasaba por el guard, escribia setValues sobre Tipos de Cambio B7:C1000
 *   y equivalentes en E/H/K, y encima devolvia ok:true con "MIGRACION v0.9.5 REVERTIDA".
 *   Exactamente el dano que el guard dice evitar, reportado como exito.
 * - DATO DE PLATAFORMA QUE LO CAUSABA: en Google Apps Script una funcion es privada cuando su
 *   nombre TERMINA en guion bajo (nombre_), NO cuando empieza (_nombre). Todas las funciones
 *   _algo del proyecto son PUBLICAS: aparecen en el dropdown "Ejecutar" del editor. Toda
 *   defensa apoyada en "es interna porque empieza con guion bajo" era falsa.
 * - CORRECCION EN DOS CAPAS, ninguna apoyada en la otra: (a) el guard vive ahora en TODA funcion
 *   que escribe -- las 22 escrituras del modulo v0.9.5 estan en 7 funciones y las 7 abortan al
 *   entrar, mas el guardado de estado y el cuerpo de aplicar; (b) esas funciones se renombraron
 *   para TERMINAR en guion bajo, que es lo unico que de verdad las saca del dropdown. Las cinco
 *   entradas publicas conservan su nombre porque el menu las invoca por string. Mismo criterio
 *   aplicado a MIGRACION_v0.11 y MIGRACION_v031: sus helpers que escriben se renombraron, y los
 *   dos cuerpos de v031 (aplicar/revertir) abortan explicito si se los invoca sin su testigo de
 *   progreso en vez de depender de un TypeError accidental.
 * - MENU DEL SWAP v0.11 REDUCIDO a lo que todavia tiene trabajo. Salen "2. Sincronizar BDs"
 *   (su docstring ya afirmaba estar fuera del menu mientras el item seguia vivo en
 *   00_Config.js: la afirmacion era falsa, ahora es verdadera), "3. Aplicar" (no se aplica dos
 *   veces) y "4. Revertir", que era la unica del quinteto que funcionaba entera y NO pedia
 *   ninguna confirmacion: un clic devolvia la planilla al layout viejo contra un config que
 *   describe el nuevo. Revertir sigue invocable como salida de emergencia deliberada y ahora
 *   exige confirmacion (o revertirSwapV011(true) sin UI). Quedan "Ver estado" (solo lectura) y
 *   "Purgar respaldos", que es el paso que le falta a Franco tras validar los tableros.
 * - La precondicion de sincronizar chequeaba las dos hojas Fix con && ("faltan las dos"): con
 *   una sola presente seguia y trabajaba a medias. Ahora aborta si falta cualquiera.
 * - procesarCargas: el toast de fallbacks contaba LLAMADAS A LA API (una por fecha distinta),
 *   asi que cinco movimientos de la misma fecha decian "1 fila(s)". Ahora cruza las fechas del
 *   lote contra las que cayeron en fallback e informa filas afectadas sobre el total.
 * - MODO DE FALLA NUEVO, documentado: una sola fecha futura tipeada en la grilla de Cargas
 *   ABORTA EL LOTE COMPLETO (correcto como todo-o-nada, pero es nuevo en el habito diario; la
 *   grilla queda intacta para corregir y reprocesar). @see FUNCIONALIDADES.md seccion 04.
 *
 * [2026-08-18] v0.11.0 - Swap de hojas Fix: el rediseno de Franco pasa a ser canonico:
 * - CONTEXTO: Franco rediseno la planilla duplicando hojas con sufijo " - Fix" (mas
 *   "Presupuesto - New") y las declaro definitivas. El layout se corrio entero: Plan de
 *   Cuentas reestructurado (bloques C:D/F:G/I:J/L:N/P:Q, headers fila 7, datos fila 8;
 *   "Proyecto" pasa a llamarse "Categoria" y aparecen los tipos generales
 *   Ahorros/Inversiones/Financiacion/Hogar), Cargas con grilla C7:I21, Registros con datos
 *   desde fila 7 y Tipos de Cambio en C:D/F:G/I:J/L:M con datos desde fila 8.
 * - NUEVO MIGRACION_v0.11_SwapHojasFix.js: quinteto estado / sincronizar / aplicar /
 *   revertir / purgar. Aplicar renombra las viejas a "<nombre> (anterior YYYY-MM-DD)" y las
 *   oculta, renombra las Fix a canonicas, repuntea las formulas y reconstruye los dropdowns.
 *   Los respaldos NO se borran: la purga es un paso aparte que exige cero referencias vivas
 *   y confirmacion del operador.
 * - SINCRONIZAR cubre la ventana export->swap: todo lo cargado en las BDs viejas despues de
 *   la duplicacion (movimientos y cotizaciones) se copia a las Fix cruzando por AUSENCIA
 *   (multiconjunto fecha+monto+tipo+cuenta+medio; fechas por dia en TC), nunca por rango.
 *   Filas presentes solo en la Fix abortan el swap: una diferencia no entendida no se pisa.
 * - REPUNTEO SEMANTICO, no textual a ciegas: dos reglas derivadas del censo real de
 *   referencias. (1) Plan viejo: 'Plan de Cuentas'!R:T y !V:W (columnas completas) se
 *   remapean a la posicion nueva de los mismos bloques (L:N y P:Q). (2) Registros: TODAS las
 *   referencias reales son ancladas por fila (B5:M1005, $B$6:$B883...) y la BD nueva corrio
 *   una fila (header 5->6, datos 6->7): se reescriben celda por celda sumando 1 a cada numero
 *   de fila, guardando la formula anterior para el rollback. Toda referencia que ninguna
 *   regla cubre queda apuntando al respaldo y se LISTA en el informe en vez de adivinarse.
 * - El bloque residual C1005:N1033 que el Plan Fix arrastra se mueve a una hoja de CUARENTENA
 *   oculta (getLastRow/appendRow del ABM y los dropdowns lo ingeririan como catalogo). Nada
 *   se borra: la cuarentena queda para decision de Franco.
 * - La columna Y del Plan viejo (consolidacion de cuentas de los 4 bloques, fuente del
 *   dropdown de Cuenta en Cargas) se recrea como columna S del Plan nuevo. La formula se
 *   escribe con ";" y FLATTEN de argumentos multiples (sin array literal) por la trampa de
 *   locale es_AR verificada en vivo (setFormula no traduce separadores), y la escritura se
 *   VERIFICA leyendo la celda. Dropdowns de Cargas reconstruidos (Cuenta -> Plan!S, Medio ->
 *   Plan!L, ambos acotados a la fila 1000) porque las fuentes de Validacion de Datos siguen
 *   al objeto hoja, no al nombre.
 * - Maquina de estados sin callejones: una corrida muerta sin catch (timeout de 6 min, corte
 *   manual) deja estado "en vuelo" y "4. Revertir" la RECONCILIA mirando que hoja quedo con
 *   que nombre; el rollback del catch deshace repunteos ademas de renombres y solo marca
 *   revertido si quedo completo. La comparacion de BDs usa la fila COMPLETA (12 columnas)
 *   como clave y detecta cotizaciones divergentes por fecha: toda diferencia no entendida
 *   frena el swap en vez de pisarse.
 * - 00_Config.js remapeado a la geometria Fix EN EL MISMO RELEASE (regla: config y planilla
 *   cambian juntos). HEADER_ROW/DATA_START_ROW 3/4 -> 7/8; canonico de TC ahora
 *   'Tipos de Cambio' (la grafia vieja queda de alias). Entre el push y aplicarSwapV011 el
 *   sistema queda intencionalmente inconsistente: el swap se corre inmediatamente despues.
 * - RETIRADOS DEL MENU la Migracion v0.9.5 y 'Robustez de vistas': ambos tienen anclas de la
 *   geometria pre-Fix (la v0.9.5 en su preflight contra RANGES; RobustezVistas en su lista
 *   cerrada RV_CELDAS: Tablero!AN4, Inicio!Y4/AM4, Cargas!R5) y post-swap operarian sobre
 *   celdas equivocadas. Los archivos se conservan enteros como historia.
 * - PENDIENTES CONOCIDOS que el swap NO resuelve (fase formulerio, hoja por hoja): la
 *   condicion 'Liquidez' de Inicio quedo huerfana (el tipo ya no existe en la taxonomia
 *   nueva; 'Medio Cotidiano' ahora es 'Hogar'), el Tablero Fix tiene #REF!/#VALUE! y su
 *   columna 'Valor en ARS' esta en ceros sin formula, Presupuesto es un cascaron sin motor,
 *   el calendario de Inicio es estatico, y 07_MiradaInteranual espera anclajes viejos (su
 *   preflight bloquea sin escribir). Detalle en docs/permanente/FUNCIONALIDADES.md.
 *
 * ---
 *
 * [2026-08-13] v0.10.0 - Migracion historica desde la planilla v03.1:
 * - CONTEXTO: mientras el pipeline estuvo roto (2026-03-29 a 2026-08-13) Franco siguio
 *   cargando sus finanzas en la planilla vieja "PLANILLA FINANZAS_v03.1 | Fran". El ledger
 *   nuevo quedo con un agujero: abril 2026 (106 movimientos), mayo (110), junio (112) y
 *   julio/agosto completos. Casi cinco meses de historia fuera de la planilla.
 * - NUEVO MIGRACION_v031_Historico.js: trio estado/aplicar/revertir. Lee la planilla vieja EN
 *   VIVO con openById (re-ejecutable: si Franco sigue cargando alla, se vuelve a correr y trae
 *   solo lo nuevo). El delta NO se define por rango de fechas sino por AUSENCIA en el destino,
 *   cruzando fecha + monto + sentido con el medio como desempate: de 3.635 filas del origen,
 *   2.896 ya estaban y 632 faltaban. Migrar "toda la BD" habria duplicado ~2.880 movimientos.
 * - Transformacion: monto partido en dos columnas -> Monto + Tipo; Tipo de Cuenta se DEDUCE
 *   contra el Plan de Cuentas (no se copia); moneda inferida del medio; TC congelados tomados
 *   de la hoja Tipos de cambio por fecha; alias de medios unificados (MP -> Mercado Pago y
 *   tres mas, decision Franco).
 * - GUARD DE COBERTURA DE TC (el bloqueante mas caro de la ronda): el Data Lake llega hasta
 *   2026-03-20 (ARS) y 2026-03-29 (USD/AUD/EUR), y 540 de 541 filas del lote son posteriores.
 *   Sin guard, TODAS congelaban una cotizacion de fallback y julio/agosto quedaban valuados a
 *   la de junio. La cotizacion congelada es el unico dato del ledger que despues no se puede
 *   recalcular. Ahora el preflight compara max(fecha del lote) contra max(fecha de cada serie)
 *   y ABORTA indicando correr "Forzar carga historica" primero.
 * - Dos buckets que NO se migran y se reportan uno por uno: filas con MONTO NEGATIVO (hay una
 *   real: -$34.999,97 en "Medicamentos / Accesorios", que migrada con abs() habria entrado como
 *   un ingreso ficticio indistinguible de uno legitimo) y filas con FECHA AMBIGUA (dia <= 12 y
 *   distinto del mes: "12/04/2026" tiene dos lecturas validas y ningun dato resuelve la duda).
 * - Parser de fechas es-AR explicito: cero new Date(string), que interpreta dd/mm con semantica
 *   de EE.UU. y habria duplicado filas cambiandoles el mes.
 * - Respaldo completo de Registros congelado y VERIFICADO antes de mutar: al insertar y
 *   reordenar por fecha las filas migradas quedan intercaladas, asi que no hay vuelta atras por
 *   rango. revertir restaura desde ahi.
 * - RETIRADOS DEL MENU: DEVTOOL_Presupuesto.js y DEVTOOL_CableadoPresupuesto.js quedan en el
 *   repo con cabecera "NO LISTO" y sus bloqueantes enumerados, pero inalcanzables desde la UI.
 *   Tres rondas adversariales no cerraron sus defectos de "declarar exito sin hacer el trabajo"
 *   (el motor informa ok sobre una hoja en ceros; el cableado escribe contra celdas vacias).
 *   Decision Franco: el Presupuesto se retoma en una sesion dedicada, con la planilla completa.
 *
 * ---
 *
 * [2026-08-13] v0.9.9 - Reparacion del formato de cotizaciones + auditoria de respaldos:
 * - HALLAZGO (verificacion post-migracion en vivo): el backfill de la v0.9.5 dejo 791 de 820
 *   filas de la columna Cotizacion de EUR mostrando FECHAS en vez de montos ("25/8/1904" en
 *   lugar de "$1.699,34"). Los valores guardados son correctos: es formato de celda. Causa:
 *   setValues no propaga formato y las filas nuevas heredaron el del grid recien ampliado.
 * - NUEVO repararFormatoCotizacionesV095(): toma como referencia el formato de la PRIMERA fila
 *   de datos de cada bloque (anterior al backfill, ya validada) y lo aplica al resto. Corrige
 *   SOLO formato, nunca valores, y saltea con aviso cualquier bloque sin fila de referencia.
 * - NUEVO estadoRespaldosV095(): lista las hojas de respaldo y marca cuales NO sirven. El
 *   primer intento de aplicar (sello _1721) dejo un RESP_FORMULAS con las formulas VIVAS -- el
 *   defecto que corrigio la v0.9.8 -- que no puede usarse para revertir. No borra nada: borrar
 *   hojas es irreversible y la decision es del operador.
 * - Verificacion independiente de la migracion (por Sheets API, no por el propio modulo): grid
 *   2200 OK; ARS 810 sin duplicados y en orden; las 4 formulas re-apuntadas son CIRUGIA PURA
 *   (unica diferencia contra el respaldo: la referencia de hoja) y sus indices ColN alinean con
 *   el header real; Registros_legacy intacta.
 *
 * ---
 *
 * [2026-08-13] v0.9.8 - El respaldo de formulas se guarda como TEXTO, no como formula viva:
 * - SINTOMA: aplicarMigracionV095() abortaba con "El respaldo de formulas no quedo verificado
 *   en: Tablero!AN4 ... columna 3". Aborto ANTES de mutar, o sea el contrato todo-o-nada
 *   funciono: ninguna celda de las hojas vivas se toco.
 * - CAUSA: setNumberFormat('@') afecta la visualizacion, NO el parseo. setValues con un string
 *   que arranca en "=" lo guarda igual como FORMULA. La celda del respaldo quedaba con la
 *   formula VIVA recalculandose contra Registros_legacy (un respaldo que se corrompe solo:
 *   cicatriz 4 del arnes) y la relectura devolvia el resultado evaluado en vez del texto.
 * - FIX: nuevo _textoLiteralV095() antepone el apostrofo de Sheets a todo valor que empiece
 *   con = + - @ o '. El apostrofo NO forma parte del valor (getValue lo devuelve sin el), asi
 *   que la verificacion sigue comparando contra el string original.
 * - La verificacion ahora exige ademas que NINGUNA celda del respaldo haya quedado como formula
 *   viva (getFormulas sobre las cinco columnas), que es la condicion que de verdad importa.
 * - El guard de respaldos huerfanos deja de bloquear a ciegas: compara el contenido del respaldo
 *   contra la hoja viva. Si coinciden, el respaldo es de un intento que aborto sin mutar y no
 *   bloquea; solo aborta si DIFIEREN, que es la firma de una migracion a medio aplicar.
 *
 * ---
 *
 * [2026-08-13] v0.9.7 - Guards de hoja invalida y stack en el informe de estado:
 * - estadoMigracionV095() fallaba con "TypeError: Cannot read properties of undefined
 *   (reading 'getMaxRows')", un mensaje que no dice que hoja falta.
 * - _contarBloquesTcV095 (cinco llamadores) y _validarRespaldoTcV095 validan su argumento y
 *   fallan nombrando el problema en vez de reventar sobre undefined.
 * - El catch de estadoMigracionV095 devuelve ademas las primeras lineas del stack.
 *
 * ---
 *
 * [2026-08-13] v0.9.6 - Menus separados: "Tidetrack" (uso diario) y "Tidetrack Dev" (desarrollo):
 * - Calcado del patron de planilla-pymes. El menu unico mezclaba la operacion cotidiana con
 *   herramientas que escriben estructura, y "Procesar Cargas" -- la funcion que mas se usa --
 *   estaba rotulada "[Dev]" como si fuera peligrosa.
 * - "Tidetrack": REGISTRAR (Procesar Cargas) + ADMINISTRAR (Plan de Cuentas) + submenu "Ir a
 *   la hoja" (solo hojas confirmadas por el escaneo: Inicio, Tablero, Cargas; quedaron fuera
 *   'Espacio blanco 1' y 'Espacio blanco 3', que ya no existen).
 * - "Tidetrack Dev": migracion v0.9.5, Mirada Interanual, Tipos de cambio, BD Antigua y
 *   mantenimiento, agrupados en submenus por dominio y numerados donde el orden importa.
 * - 00_Config.js: MENU_CONFIG soporta ahora secciones ({seccion}) y submenus ({submenu, items}),
 *   ademas de items y separadores. 12_MenuService.js los arma recursivamente.
 * - NUEVO _menuSeccion(): los rotulos de seccion son items inertes que avisan por toast que son
 *   un titulo (Apps Script no soporta encabezados de menu, y un item que no hace nada se lee
 *   como una falla).
 * - Cada menu se construye en su propio try/catch: si uno rompiera, el otro igual aparece.
 *
 * ---
 *
 * [2026-08-13] v0.9.5 - Adaptacion al layout REAL de la planilla (el pipeline vuelve a poder escribir):
 * - CONTEXTO: la planilla migro a B:M en junio pero el codigo nunca acompanio, asi que
 *   procesarCargas pedia Registros!I:T (col 9-20) sobre una hoja de 14 columnas y tiraba
 *   excepcion. Ultimo registro del ledger: 2026-03-29. Decision Franco 2026-08-13: se adapta
 *   el codigo al layout nuevo, no se revierte la planilla.
 * - 00_Config.js: RANGES.REGISTROS -> B:M (headerRow 5, dataRow 6); RANGES.TC_* -> B:C / E:F /
 *   H:I / K:L (headerRow 6, dataRow 7). Plan de Cuentas y Cargas SIN cambios (no migraron):
 *   sus entradas no declaran headerRow/dataRow y siguen cayendo a los globales 3/4.
 * - 03_SheetManager.js: getTableRange/getTableData/appendRow/appendMassive leen headerRow y
 *   dataRow por tabla, con fallback a los globales. 06_RegistrosService.js: append y sort por
 *   la columna de Fecha del layout nuevo (H). 99_MigrationLogic.js: lecturas y escrituras al
 *   layout nuevo (fecha H=8, valores de moneda J:M=10..13).
 * - 07_MiradaInteranual.js: formulas remapeadas (fecha O->H, monto I->B, tipo de cuenta L->E,
 *   moneda N->G, TC R/S/T->K/L/M) y filas 3 -> 6. Ahora verifica precondiciones antes de
 *   escribir (rotulos C10:C12 y selectores E4/F4/R4), protege setFormula, y NO declara exito
 *   si la celda queda en cualquier valor de error (antes solo miraba #ERROR!, asi que un #REF!
 *   se replicaba a las 36 celdas cantando exito). Nuevo guard que verifica que cada fila
 *   replicada interrogue SU rotulo: hoy las filas 11 y 12 apuntan a $C10 y calcularian todas
 *   Ingresos, tapado por el #ERROR!.
 * - 15_ExchangeRateApi.js: forzarCargaHistorica verifica capacidad Y cobertura ANTES del primer
 *   clearContent (contrato todo-o-nada). Aborta si un bloque viene vacio, si trae menos filas
 *   que las que la hoja ya tiene, o si queda muy por debajo de los demas. fetchArsRate loguea
 *   sus fallbacks (Regla Estricta 9) y deja de devolver el hardcode 1000 como si fuera
 *   cotizacion: lanza, porque un TC inventado se congela en cada registro.
 * - NUEVO MIGRACION_v0.9.5_LayoutNuevo.js: estado/aplicar/revertir con respaldo congelado y
 *   VERIFICADO antes de mutar, respaldo original inmutable ante reintentos, DocumentLock y
 *   contrato {ok, detalle, error}. Amplia el grid de Tipos de cambio (tenia 6 filas libres),
 *   hace backfill idempotente de las 3.151 cotizaciones perdidas desde la hoja legacy, y
 *   re-apunta por cirugia las formulas de Tablero/Inicio/Cargas que aun leen Registros_legacy.
 *
 * ---
 *
 * [2026-08-13] v0.8.4 - Gemelo digital Fase 2 (arnes): scanner de cobertura total:
 * - 98_DevTools_Scanner.js reescrito: mapea TODA celda con valor o formula. El filtro r < 5
 *   de la version anterior dejaba ciegas a las BDs (44 celdas de una hoja Registros de 2879 filas).
 * - NUEVO: valor_mostrado via getDisplayValues() - unico lugar donde viven los errores de
 *   runtime (#N/A, #DIV/0!, #REF!), que el campo valor nunca traia para celdas con formula.
 * - NUEVO: gid (getSheetId()) por hoja en meta. Sin el, un renombre es indistinguible de
 *   borrado + alta y el diff de no-danio reporta destruccion masiva falsa.
 * - Estilo serializado solo si difiere del default; notacion A1 calculada en memoria.
 * - Sin cambios en logica de negocio. Herramientas de soporte fuera de src/: devtools/
 *   (inventario, TSV de auditoria, diff de no-danio) y MAPA_ARQUITECTURA_PLANILLA.md.
 * - HALLAZGO: el primer escaneo en vivo probo que Registros y Tipos de cambio YA ESTAN en el
 *   layout v0.9.x mientras el codigo desplegado asume el viejo. Ver CHANGELOG.md.
 *
 * ---
 *
 * [2026-08-12] v0.8.3 - Gobernanza Fase 1 (arnes): resolver de nombres de hoja + menu sin emojis:
 * - NUEVO: _resolverNombreHoja(alias) + invalidarCacheNombresHojas() en 00_Config.js (portado de pymes).
 *   SHEETS.DATA_ENTRY / TIPOS_CAMBIO / BD_ANTIGUA pasan a getters con alias: corrigen las tres
 *   discrepancias config-planilla detectadas ('Hoja de Cargas' vs 'Cargas'; 'Tipos de cambio' vs
 *   'Tipos de Cambio'; 'BD antigua' vs 'BD Antigua') sin ventana de rotura ante renombres.
 *   Politica: ante ambiguedad gana el alias historico (el que tiene los datos), con log.
 * - RANGES TC_*: sheet pasa a getter para preservar la resolucion perezosa.
 * - NUEVO: SHEETS.MIRADA_INTERANUAL y SHEETS.DEBUG_MIRADA; 07_MiradaInteranual.js deja de
 *   hardcodear nombres de hoja (regla SSOT).
 * - MENU_CONFIG sin emojis (regla cero emojis del arnes, Fase 1).
 * - Sin cambios de logica de negocio: pipeline, FX y migraciones intactos.
 *
 * ---
 *
 * [2026-06-22] v0.8.2 - Módulo Mirada Interanual:
 * - NUEVO: `07_MiradaInteranual.js`. `inicializarMiradaInteranual()` setea las fórmulas LET/SUMPRODUCT
 *   en G10:R14 de la hoja "Mirada Interanual" (Ingresos/Gastos Fijos/Gastos Variables por mes + Resultado).
 * - Lógica: offset mensual vía `COLUMN()-COLUMN($K$10)`, navegación cross-year vía `EDATE`,
 *   conversión multi-moneda vía `tc_tx/tc_sel` (ambas relativas a ARS=1).
 * - Rangos de Registros desde fila 3 (header real en fila 2, datos desde fila 3, auditado sobre la planilla).
 * - FIX locale: el lookup del mes usa `SPLIT("ENERO,...,DICIEMBRE";",")` en vez de array literal `{...}`.
 *   El array literal con comas rompía con "Error de análisis de fórmula" en locale español (separador ";", arrays "\").
 *   Se replica el patrón ya usado en las fórmulas del Tablero.
 * - NUEVO: `diagnosticarMiradaInteranual()` + menú [Dev] "Diagnosticar Mirada Interanual": escribe una hoja
 *   "DEBUG Mirada" con micro-tests (separadores, array literal, SPLIT, lectura de Registros, fórmula completa)
 *   para aislar fallas sin adivinar.
 * - NUEVO: entrada de menú [Dev] → "Inicializar Mirada Interanual" en `00_Config.js`.
 * - Nota: v0.8.1 queda reservada para el track de `06_RegistrosService.js` (prompt separado).
 *
 * ---
 *
 * [2026-06-05] v0.8.0 (mantenimiento) - Sync de metadata y limpieza documental:
 * - Sincronizado `01_Version.js` de 0.1.0 (Sprint 0) a v0.8.0; el changelog embebido ahora apunta a este archivo como fuente de verdad.
 * - Eliminado `docs/permanente/TABLERO_ARQUITECTURA.md` (placeholder vacío de 0 bytes); se recreará al construir el Tablero.
 * - `ESTRUCTURA.md` sincronizado a v0.8.0 (módulos de src/, docs de Cowork, capa .claude/).
 *
 * ---
 *
 * [2026-03-23] v0.8.0 - Herramientas de Escrutinio Arquitectónico:
 * - Módulo DevTools añadido: `98_DevTools_Scanner.js`. 
 * - Permite exportar el 100% de la arquitectura de la planilla (metadatos, fórmulas, colores, offsets) a un snapshot JSON.
 * - Actualización de permisos de Drive en `appsscript.json`.
 * 
 * ---
 *
 * [2026-03-22] v0.7.9 - Fórmulas Nativas Tiempo Real (RealTime API):
 * - Se integraron 3 Custom Functions (`=TIDETRACK_USD()`, `=TIDETRACK_EUR()`, `=TIDETRACK_AUD()`) disponibles globalmente para invocar desde cualquier celda de Google Sheets.
 * 
 * ---
 *
 * [2026-03-21] v0.7.8 - Fix Case Sensitivity en Auto-Sort:
 * - Se detectó que el Auto-Sorting fallaba silenciosamente si la pestaña física se llamaba "Tipos de Cambio" en lugar de "Tipos de cambio". Se aplicó un bypass de casing (`.toLowerCase()`).
 * 
 * ---
 *
 * [2026-03-21] v0.7.7 - Fix Auto-Sort Lag:
 * - Se optimizó el disparador automático de `appendMassive` eliminando el uso asíncrono de `getLastRow()` por un mapeo matemático estricto según la matriz enviada. Garantiza el Z-A de inmediato.
 * 
 * ---
 *
 * [2026-03-21] v0.7.6 - Alerta UI para Protección Multi-celda:
 * - Se reemplazó el Toast pasivo por una alerta UI (`ui.alert()`) intrusiva en la hoja "Plan de Cuentas" cuando se borran/editan múltiples celdas accidentalmente.
 * - Este cambio garantiza que el usuario sea claramente notificado de que debe usar `Ctrl+Z` para recuperar sus datos.
 *
 * ---
 * [2026-03-21] v0.7.5 - Auto-Sort en Tipos de Cambio:
 * - Se le inyectó inteligencia a `appendMassive` para que al apendear hacia cachés `TC_` en la hoja `Tipos de Cambio`, lea la tabla lateral específica y la ordene cronológicamente de la Z a la A por cuenta propia.
 * 
 * ---
 *
 * [2026-03-21] v0.7.4 - Rename Global "Costos" a "Gastos":
 * - Refactorización quirúrgica de constantes, endpoints y strings en frontend y backend (`COSTOS_FIJOS` -> `GASTOS_FIJOS`).
 * - Actualización de las herramientas de deducción en `RegistrosService` y `MigrationEngine`.
 *
 * ---
 *
 * [2026-03-20] v0.7.3 - Fix Dev Toggle Protección Plan Cuentas:
 * - Se corrigió la UX del menú `togglePlanCuentasProtection()` agregando un prompt de confirmación explícito para evitar desactivaciones accidentales.
 * - Se mejoró `handlePlanCuentasEdit()` (onEdit) para detectar ediciones multi-celda y sugerir al usuario el uso de Ctrl+Z dado que Apps Script no provee oldValue para pegados masivos.
 *
 * ---
 *
 * [2026-03-20] v0.7.2 - Recalculador Masivo TC:
 * - Herramienta [Dev] `recalcularTcRegistros()` para aplicar retrospectivamente la lógica base ARS a la hoja Registros.
 * - Ideal para usuarios que ya migraron BD Antigua antes del parche `v0.7.1`.
 *
 * ---
 *
 * [2026-03-20] v0.7.1 - Base Monetaria ARS:
 * - Se invirtió la matemática de Tipos de Cambio. Ahora `TC_ARS` es fijo en 1.0.
 * - `TC_USD` guarda el valor de argentinadatos, y `TC_EUR`/`TC_AUD` triangulan con Frankfurter hacia ARS.
 * - Mayor facilidad estructural para queries (`Value * Exchange Rate = Value in ARS`).
 *
 * ---
 *
 * [2026-03-20] v0.7.0 - Motor de Migración de BD Legacy:
 * - Se introdujo `99_MigrationLogic.js` con soporte para importar bases 2024+.
 * - Identificador y autocompletador de diccionarios faltantes (Cuentas y Medios).
 * - Se extendió `FLOOR_DATE` en `06_RegistrosService.js` y `15_ExchangeRateApi.js` al 01/01/2024.
 *
 * ---
 *
 * [2026-03-20] v0.6.2 - Carga Histórica de TC:
 * - Se añadió la herramienta [Dev] `forzarCargaHistorica()` en `15_ExchangeRateApi.js`.
 * - Permite generar un barrido desde el 01/01/2026 reconstruyendo el historial de las 4 divisas simultáneas con fallback a viernes para fines de semana.
 *
 * ---
 *
 * [2026-03-20] v0.6.1 - Refactor Columnas Cargas y Registros:
 * - Se adaptó `00_Config.js` y `06_RegistrosService.js` para soportar una nueva columna "Tipo de Cuenta" en la DB de Registros.
 * - En la hoja "Cargas", se añadió "Tipo" manualmente y "Tipo de Cuenta" se eliminó (se deduce eficientemente en backend).
 * - Se corrigieron los índices de ordenamiento `sort()` y mapeo en `RANGES.REGISTROS` hasta la columna T. 
 *
 * ---
 *
 * [2026-03-20] v0.6.0 - Sistema de Registros Batch y Arquitectura Multi-Moneda:
 * - Creación de la hoja "Registros" como Data Lake inmutable y "Tipos de Cambio" como caché estructurado.
 * - `06_RegistrosService.js`: Se incorporó `procesarCargas()` para lectura en bloque de `I5:O19`, anexado a `Registros` y ordenamiento inteligente.
 * - `15_ExchangeRateApi.js`: Se añadió fetching de APIs externas con caché temporal en memoria. (DolarApi y Frankfurter) para ARS/USD/EUR/AUD.
 * - El menú de Tidetrack ganó el ítem `🔧 [Dev] Procesar Cargas`.
 *
 * ---
 *
 * [2026-03-20] v0.5.1 - Autocompletado Hoja Cargas:
 * - Se implementó la lógica de autocompletado en `14_EventHandlers.js` para la hoja "Cargas".
 * - El "Tipo" se deduce automáticamente al elegir la "Cuenta" cruzando datos con el Plan de Cuentas.
 * - La "Moneda" se completa automáticamente según el "Medio" seleccionado.
 * - La "Fecha" se autocompleta con el día en curso al ingresar un "Monto".
 *
 * ---
 *
 * [2026-03-20] v0.5.0 - Refactor Arquitectura de Base de Datos Plan de Cuentas:
 * - Se simplificó la captura de datos (ADR): "Moneda" pasa a ser propiedad exclusiva de "Medios Bancarios". Se elimina del ABM para Ingresos y Egresos.
 * - Reasignación de columnas de la BDD (I:J Ingresos, L:M Costos Fijos, O:P Costos Variables, R:T Medios Bancarios, V:W Proyectos).
 * - Adaptación de Frontend y Backend (`getCategoryAccounts`, `saveAbmRecord`) para rutear arreglos dinámicos no simétricos.
 *
 * ---
 *
 * [2026-03-20] v0.4.9 - Optimización de Rendimiento y Ajustes UI en ABM:
 * - Se optimizó drásticamente el guardado (`appendRow` y `getTableData` en `03_SheetManager.js`) empleando una búsqueda inversa (bottom-up), eliminando el cuelgue al guardar registros.
 * - Se corrigió un error JavaScript en `UI_AbmPlanCuentas.html` provocado por la referencia a un elemento HTML eliminado (`groupAbreviacion`).
 * - Se limitaron las monedas disponibles estrictamente a: ARS, USD, AUD, y EUR (como constante en `00_Config.js`).
 * - Se actualizó la etiqueta visual del selector principal a "¿Qué categoría querés gestionar?".
 *
 * ---
 *
 * [2026-03-17] v0.4.8 - Moneda Opcional en ABM Plan de Cuentas:
 * - El campo Moneda en el formulario ya no es obligatorio (ADR-002: Principio de Moneda por Defecto).
 * - Se eliminó el atributo `required` del HTML y la validación `throw` del backend.
 *
 * ---
 *
 * [2026-03-17] v0.4.7 - Opción 3 (Moneda por Defecto, ADR-002) + Validación de Duplicados:
 * - Se documentó la regla en GUIA_ARQUITECTURA.md (ADR-002) y PRINCIPIOS_DISEÑO.md.
 * - Validación de duplicados en `saveAbmRecord` (11_UIService.js): arroja error limpio si el nombre ya existe en el módulo.
 * - Alerta de error visual integrada en el DOM del pop-up (no más alert() nativos).
 * - Se oculta el errorAlert al cambiar entidad o al reintentar guardado.
 *
 * ---
 *
 * [2026-03-17] v0.4.6 - Validación de Duplicados en ABM:
 * - Se agregó una validación en `saveAbmRecord` (11_UIService.js) para evitar la creación de cuentas duplicadas.
 * - Si el usuario intenta registrar el mismo nombre de cuenta en la misma entidad, el sistema arroja error (desde Backend).
 * - Se reemplazó la alerta nativa `alert()` en Frontend por un mensaje de error integrado al diseño (inline UI con SVG y colores semánticos).
 *
 * ---
 *
 * [2026-03-17] v0.4.5 - Ajustes de Proporciones y Paleta de Colores en ABM:
 * - Se ajustó el tamaño del modal Plan de Cuentas de 600x650 a 520x620 para mejorar las proporciones y centrar el foco en el formulario.
 * - Se actualizó la paleta de colores institucional en `UI_SharedStyles.html`: oscureciendo los paneles principales a `#34475d`,
 * implementando un class de botón seleccionado (`.btn-selected`) y halos de foco en formulario con color de acento `#b5bfc6`,
 * y estableciendo el fondo principal a `#eff2f9`.
 *
 * ---
 *
 * [2026-03-17] v0.4.4 - Mejoras UI_AbmPlanCuentas:
 * - Se reemplazaron las alertas JavaScript nativas de "Guardado Exitoso" por un "Success State" visual e integrado en el DOM, utilizando el Design System y permitiendo continuar agregando o cerrar el modal amigablemente.
 *
 * ---
 *
 * [2026-03-17] v0.4.3 - Creación de UI_SharedStyles:
 * - Se agregó el archivo base de CSS `UI_SharedStyles.html` que faltaba en el repositorio.
 * - Esto soluciona la excepción "No se encontró el archivo HTML llamado UI_SharedStyles" al abrir pop-ups.
 *
 * ---
 *
 * [2026-03-17] v0.4.2 - Fix de UI Styles en Pop-ups:
 * - Se corrigió `11_UIService.js` para usar `createTemplateFromFile().evaluate()` en lugar de `createHtmlOutputFromFile`,
 * permitiendo que las etiquetas `<?!= include() ?>` se rendericen y apliquen correctamente el CSS Institucional al Plan de Cuentas.
 *
 * ---
 *
 * [2026-03-17] v0.4.1 - Refactorización de Back-End y Pop-Up de Cuentas:
 * - Se corrigió archivo .claspignore que impedía el push de código local.
 * - Refactorización de `00_Config.js` y `03_SheetManager.js` para dar soporte a 6 nuevas tablas independientes:
 * (Ingresos, Costos Fijos, Costos Variables, Medios_Pago, Monedas y Proyectos).
 * - Creación de `UI_AbmPlanCuentas.html`: Pop-Up interactivo Multi-ABM con lógica de UI Router (mostrar/ocultar campos dinámicamente).
 * - Inyección de endpoints de lectura/escritura en `11_UIService.js` para conectar el HTML con las hojas de cálculo.
 * - Modificación de `12_MenuService.js` para incluir el botón de acceso en el submenú de Tidetrack.
 *
 * ---
 *
 * [2026-03-17] v0.4.0 - Configuración Inicial del Repo Local:
 * - El proyecto migró de formato web a código local mediante Clasp y Node.
 * - Se conectó el proyecto con GitHub mediante un Watcher automático (github-autopilot).
 */
