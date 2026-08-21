/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.11.1
 * @since 0.1.0
 * @lastModified 2026-08-18
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 31,
 patch: 0,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-08-20',
 releaseName: 'v0.31.0 - El plan asigna, la realidad se mide: N19 es la capitalizacion efectiva',

 /**
 * Changelog embebido (solo refleja el release vigente).
 * FUENTE DE VERDAD del historial completo: src/ZZ_Changelog.js
 * Formato: Semantic Versioning
 * + Agregado
 * * Mejorado
 * - Corregido
 * ! Breaking change
 */
 changelog: `
v0.22.1 (2026-08-19) - La columna Q se borra de verdad
! Se revierte la decision de la v0.21.0 de solo vaciarla. El bloque "Categorias" ocupa P:Q y solo usa P: queda una columna de aire ADENTRO del recuadro mientras los otros cuatro bloques estan ajustados. Vaciarla no alcanza -- el recuadro la sigue abarcando.
+ LA RED QUE FALTABA: se guarda la regla del desplegable de Cuenta de Cargas ANTES de borrar y se comprueba DESPUES que siga viva; si el corrimiento de columnas la rompio, se repone apuntando a la consolidada en su posicion nueva. Era el unico riesgo real y ahora esta cubierto.
+ Solo borra si la columna esta REALMENTE vacia. Si tuviera datos, avisa y no la toca.
+ "Ajuste" deja de ser un hueco: pasa a la categoria "Conciliacion". No es un ingreso -- es una correccion de saldo contra el banco -- pero vive en el bloque de Ingresos y sin categoria quedaba a la vista como un olvido.

v0.22.0 (2026-08-19) - El bloque Categorias agrupa por la categoria de la cuenta
- El bloque "Categorias" del Tablero mostraba Hogar / Ahorros / Inversiones / Financiacion: los TIPOS DE MEDIO. Eso contesta DONDE estaba la plata, no PARA QUE se uso, que es lo que el bloque promete.
* CONSECUENCIA NO PREVISTA DE LA v0.20.0: cuando los medios declaraban su tipo via una categoria intermedia, el mismo VLOOKUP devolvia esa categoria ("Chanchito", "Meta de Ahorro 1"). Al sacar el nivel intermedio paso a devolver el TIPO, y el bloque quedo con cuatro filas genericas.
+ Ahora agrupa por la CATEGORIA DE LA CUENTA, buscada en los tres bloques del Plan con una cascada de tres IFERROR (una cuenta esta en uno y solo uno).
- Es UNA sola celda y se conserva el nombre de la variable a proposito: cambiarlo obligaria a tocar todas sus apariciones mas abajo, y cada token de mas es una chance de romper la formula.

v0.21.0 (2026-08-19) - Plan de Cuentas en su forma final
+ DEVTOOL_LimpiarPlanCuentas: deja TODAS las categorias en la columna P y barre los restos de las migraciones del dia (contenido, titulos, encabezados y validaciones de Q, T, U, V, W).
! RANGES.CATEGORIAS_CUENTA pasa de U a P. Nacio en U para no pisar el bloque de categorias de medios; ese bloque quedo sin uso cuando los medios pasaron a declarar su tipo directo, asi que P quedo libre y es el lugar natural. Un solo catalogo, una sola columna.
* RANGES.PROYECTOS queda marcado LEGACY: sin uso, pero se conserva porque varios devtools historicos lo leen en sus preflights y quitarlo los dejaria sin arrancar.
- LA COLUMNA Q SE VACIA, NO SE BORRA, y es una decision explicita: borrarla correria S a R, y en S vive la formula que la hoja rotula "fuente de validacion - no tocar" (la que alimenta el desplegable de Cargas). Sheets reacomoda las formulas al correr columnas, pero los rangos de las validaciones no siempre siguen -- y hoy ya nos costo dos corridas descubrir que las validaciones no se comportan como uno espera. El beneficio de borrarla es una columna vacia menos; entre P y S ya hay una separadora. No vale arriesgar la carga de datos por eso.
+ El preflight ABORTA si la consolidada de S perdio su formula, y avisa si quedan formulas apuntando al bloque viejo.

v0.20.2 (2026-08-19) - La misma leccion, en las columnas de categoria de cuentas
- "Categorizar cuentas" murio en D8: "Los datos ingresados infringen las reglas de validacion". Las tres columnas de Categoria tienen el mismo desplegable con la lista vieja que tenia la columna de medios. Esta vez SI lanzo excepcion, asi que no escribio a medias.
+ Se aplica el mismo tratamiento ya probado en la v0.20.1: la validacion de las tres columnas se reemplaza por la lista de categorias de cuentas ANTES de escribir.
+ Foto de respaldo con VALORES y REGLAS de los cuatro rangos que toca, y reversion que libera la validacion, escribe los valores y recien despues repone la regla vieja.
+ Ahora revierte tambien ante excepcion: antes, si fallaba a mitad de camino, el catalogo de categorias quedaba escrito y las columnas no. Una planilla a medio categorizar es peor que una sin categorizar.

v0.20.1 (2026-08-19) - La validacion de la columna era parte del cambio
- LA CORRIDA DE LA v0.20.0 FALLO EN LOS 28 MEDIOS y ademas dejo la columna VACIA. Causa: la columna tiene un DESPLEGABLE con la lista de categorias. Mientras esa lista siga vigente, "Hogar" es un valor invalido -- Sheets lo rechaza, la celda queda vacia, y setValue NO lanza ninguna excepcion. Sin excepcion no hay como enterarse salvo releyendo, que es lo que salvo la situacion.
! Cambiar lo que una columna SIGNIFICA incluye cambiar lo que esa columna ACEPTA. Ahora la validacion se reemplaza por la lista de los cuatro tipos ANTES de escribir.
- La reversion tambien estaba mal por lo mismo: reponia los valores viejos con la regla nueva puesta y se los rechazaba. Ahora libera la validacion, escribe los valores y recien despues repone la regla vieja, en ese orden.
+ La foto de respaldo captura tambien las reglas de validacion, no solo los valores: una foto sin ellas no sirve como punto de retorno.
+ El preflight reporta la validacion que encuentra y avisa si hay medios sin tipo -- mientras esa columna este vacia, el capital del Tablero da cero y todo cae en cotidiano.
ATENCION: la columna quedo VACIA tras la corrida fallida. Correr esta version la deja con los tipos correctos.

v0.20.0 (2026-08-19) - El medio declara su tipo directo
! Se saca el nivel intermedio del eje de medios. Antes iba medio -> categoria -> tipo; ahora el medio declara su TIPO (Hogar / Ahorros / Inversiones / Financiacion) en la misma columna.
- POR QUE, medido: "Meta de Ahorro 1" concentraba 16 de los 28 medios (57%) -- no era una meta, era un cajon de sastre; 5 de las 11 categorias no tenian NINGUN medio; y las 4 restantes tenian uno cada una. Un nivel que deja el 57% en un grupo y el 45% de los grupos vacios no clasifica: solo agrega un salto mas donde equivocarse.
+ Queda: Hogar 9 medios, Ahorros 11, Inversiones 7, Financiacion 1.
! CAMBIO ATOMICO: el catalogo y las 9 formulas que hacian el doble VLOOKUP se escriben en la MISMA corrida y se revierten juntas. Cambiar uno sin el otro dejaria toda la clasificacion en blanco y el capital en cero.
* LA RIQUEZA NO SE MUEVE, y se verifica: los medios que cambian de tipo (IOL, CEDEARS, CRYPTO, FCI, Galicia Fima) se mueven de Ahorros a Inversiones, que estan los dos en la lista blanca. El unico que sale es Brubank, que no tiene movimientos.
- El bloque P:Q queda como esta, sin uso. No se borra: si algun dia vuelven los objetivos de ahorro, el bloque esta.

v0.19.1 (2026-08-19) - Dos ejes, dos catalogos separados
! CORRECCION DE DISENO sobre la v0.19.0, que no llego a correrse: las categorias de CUENTAS dejan de escribirse en P:Q y pasan a su propio catalogo (columna U). P:Q queda intacto como el eje de los MEDIOS.
* SON DOS EJES INDEPENDIENTES del mismo movimiento, no uno anidado en el otro. Medios: DONDE ESTA la plata (Ahorros / Inversiones / Financiacion / Hogar). Cuentas: POR QUE entro o salio. La nafta se puede pagar con la cuenta cotidiana o con la tarjeta: misma categoria de cuenta, distinta finalidad de medio. Si una determinara a la otra, esa diferencia no se podria representar.
+ Y ese cruce es la informacion que se busca. Medido: "Alimentacion" se pago casi toda desde medios de finalidad Hogar ($6.961.137), pero $46.300 salieron de un medio de Ahorros. Comerse los ahorros no lo dice ninguno de los dos ejes por separado.
- La categoria de cuenta NO lleva un "tipo" propio: seria un tercer nivel redundante. El agrupamiento que cruza bloques ya sale del NOMBRE ("Vehiculo" esta en Fijos y en Variables).
+ RANGES.CATEGORIAS_CUENTA declara el bloque nuevo; el preflight avisa si una categoria de cuentas se llamara igual que una de medios.

v0.19.0 (2026-08-19) - Plan de Cuentas de tres niveles
+ DEVTOOL_CategorizarCuentas: ordena las 60 cuentas en 22 CATEGORIAS y le da a cada categoria su TIPO. Las tres columnas "Categoria" de los bloques de cuentas estaban vacias (0 de 11, 0 de 15, 0 de 22).
* EL TIPO CRUZA LOS BLOQUES, y ese cruce es todo el valor del nivel de arriba: "Vehiculo" junta Nafta y Auto (fijos) con Reparaciones y Estacionamiento (variables) -- $4.793.879 en 32 meses, $149.808 por mes, el segundo gasto mas grande despues de los negocios propios. Antes eran cuatro lineas sueltas en dos bloques distintos.
* DOS VOCABULARIOS DE "TIPO" QUE NO SON EL MISMO: los cuatro que ya existian (Ahorros, Inversiones, Financiacion, Hogar) fueron pensados para los MEDIOS y contestan DONDE esta la plata. Las categorias de cuentas contestan PARA QUE se usa. Tres se reutilizan tal cual; Ahorros queda solo para medios; se agregan ocho para cubrir el lado del uso. Forzar las cuentas dentro de los cuatro viejos habria puesto "Sueldo" y "Nafta" bajo etiquetas que no significan nada para ellas.
- El agrupamiento sale de 3.458 movimientos sobre 32 meses: sigue el uso real, no una taxonomia de manual.
! "Compra USD" NO se categoriza a proposito (decision Franco): pasa a ser un traspaso y deja de existir como cuenta. Es la unica del catalogo que queda sin categoria.
+ Preflight que aborta si una categoria del mapa ya existe con OTRO tipo: dos verdades para el mismo nombre romperian toda formula que cruce por categoria.

v0.18.0 (2026-08-19) - BD de Proyeccion
+ DEVTOOL_Proyeccion: crea la hoja "Proyeccion", espejo exacto de "Registros" (se clona con copyTo para heredar diseno, formatos y validaciones de una sola vez, y despues se le borran los datos y se VERIFICA que quedo vacia).
! Tablero N9/N10/N11 dejan de ser constantes tipeadas a mano y pasan a sumar lo cargado en la proyeccion para el mes, anio y moneda seleccionados. Usan EL MISMO criterio que los bloques de la realidad -- filtro por Tipo de Cuenta y exclusion de cuentas neutras -- porque si el presupuesto se sumara distinto que lo real, el porcentaje de cumplimiento compararia peras con manzanas.
* DECISION DE DISENO: un movimiento proyectado NO TIENE cotizacion congelada -- nadie sabe a cuanto va a estar el dolar el mes que viene --, asi que la proyeccion se convierte con la cotizacion de HOY (AF17/18/19) y no con las columnas J:M. Las columnas existen igual porque la hoja es un espejo exacto.
+ SHEETS.PROYECCION entra como getter de alias ('Proyeccion' / 'Proyección'): el nombre natural lleva tilde y esa ambiguedad ya costo caro tres veces en este repo.
NOTA: la hoja nace VACIA, asi que N9:N11 dan cero hasta que se carguen movimientos previstos. Es correcto: hasta hoy esos numeros no salian de ningun lado.

v0.17.1 (2026-08-19) - El bloque de medios termina en la fila 29
! decision Franco: el bloque "Medios Bancarios" llega hasta la fila 29, no mas abajo. Marca dos limites y los dos importaban: hasta donde se LIMPIA antes de escribir (estaba en 45, o sea que podia pisar lo que hubiera debajo del bloque, que no es nuestro) y cuantas filas puede ocupar el resultado.
- El derrame se acota con ARRAY_CONSTRAIN a 12 filas (18 a 29). Si alguna vez hubiera mas medios con saldo que filas, se muestran los 12 mayores en vez de romper el diseno de la hoja.
NOTA: el limite se deriva de las constantes del bloque (filaFin - filaDatos + 1), no se escribe a mano en dos lugares.

v0.17.0 (2026-08-19) - Limpiar antes de derramar, y conciliar contra los saldos declarados
- #REF! EN F18 Y H18: un derrame NO se expande si tiene que pisar algo, y debajo de esas dos columnas quedaban los valores estaticos viejos (ARS, 42327,35...). C18 no fallo solo porque su columna ya la habia pisado la corrida anterior. Ahora el area del bloque se limpia antes de escribir.
! El respaldo de FORMULAS no alcanzaba: lo que hay que sacar de en medio son VALORES. Se fotografia el area completa -- valores y formulas, celda por celda -- antes de limpiar, y se restaura entera si algo falla.
+ DEVTOOL_ConciliarSaldos: mide el saldo de cada medio y carga un movimiento de cuenta 'Ajuste' por la diferencia contra el saldo declarado por Franco. Es su propio mecanismo, el de las 70 filas historicas, no un parche: un ajuste dice "a esta fecha mis registros diferian de la realidad en tanto", queda en el ledger con su fecha y es auditable. Lo que NO seria legitimo es tocar la formula para que devuelva el numero deseado.
! ADVERTENCIA que el modulo declara en el dialogo: el ledger termina el 12/08 y los saldos son al 19. Parte de la diferencia de NaranjaX ($29.635,41) y Efectivo ($102.000,00) son movimientos reales de esos siete dias sin cargar. Al conciliar hoy quedan como un ajuste sin detalle. Si despues se cargan esos dias habra que borrar las filas del ajuste: no se pueden hacer las dos cosas.

v0.16.1 (2026-08-19) - Celdas combinadas: el bloque de medios necesita tres formulas, no una
- SINTOMA: Franco corrio la v0.16.0 y "no noto los cambios". Medido en vivo por Chrome: las formulas SI se habian escrito, pero el bloque "Medios Bancarios" mostraba los medios NUEVOS con los montos VIEJOS al lado. Peor que no hacer nada, porque parece que anduvo.
- CAUSA: el bloque esta hecho de CELDAS COMBINADAS -- C17:E17 "Medio", F17:G17 "Moneda", H17:I17 "Monto", y cada fila de datos igual. Una formula que devuelve tres columnas no puede derramar ahi: Sheets derramo solo la PRIMERA (los nombres) fila por fila, y las columnas Moneda y Monto que Franco ve quedaron con los valores estaticos viejos.
- CORRECCION: TRES formulas de UNA columna, ancladas en C18, F18 y H18. Las tres derivan de la MISMA matriz ordenada y toman su columna con INDEX, asi que las filas se corresponden siempre, aun con saldos empatados.
+ Preflight que verifica los tres rotulos del bloque antes de escribir, y banco de pruebas que exige que las tres columnas salgan de la misma matriz.
- El indicador de movimientos sin clasificar se muda: L29 es parte del merge L28:O29 que contiene la comprobacion de traspasos, asi que lo escrito ahi NO SE MOSTRABA. Ahora se busca la primera celda candidata libre y sin combinar, y se informa cual se uso.
NOTA: lo que SI habia quedado bien en la v0.16.0 y sigue igual: el bloque Saldos Actuales (AE:AG, celdas simples), N19 como residuo y O16 sumando tres filas. La comprobacion de traspasos de L28 nunca se piso.

v0.16.0 (2026-08-19) - El saldo se corta en la ultima conciliacion
! REGLA NUEVA Y VALIDADA: saldo de un medio = su ULTIMO asiento "Inicio Mes" + todo lo posterior. Ese asiento no es un movimiento, es el punto de corte de una conciliacion: cuando se carga, todo lo anterior queda saldado. Sumar todo duplica ($8,7M contra $0,5M reales); ignorar los arrastres (v0.14/v0.15) pierde el saldo de apertura y deja NUEVE medios en negativo. La regla del corte da CERO negativos.
+ VALIDADA CONTRA VERDAD DE CAMPO: de siete saldos reales que dio Franco, CINCO coinciden AL CENTAVO. Los dos que no son los que usa a diario, y la causa esta medida: el ledger terminaba el 12/08 y se midio el 19/08. Faltaban siete dias de carga, no de logica.
+ Tablero!C18 lista solo los medios CON saldo distinto de cero, ordenados de mayor a menor (decision Franco: "no quiero que me aparezcan todos los medios").
- "YPF - wallet" queda resuelto sin tocar el ledger: son 5 filas y las cinco son "Inicio Mes" -- el arrastre de YPF con otro nombre. Como no esta en el Plan de Cuentas, el filtro de medio valido lo excluye y YPF da $3.494,90, exactamente lo declarado.
* Un solo MAP sobre los 28 medios y despues un VLOOKUP vectorizado por fila, en vez de un FILTER por medio dentro de cada formula: el mismo trabajo sobre 3.500 filas se hacia ocho veces.

v0.15.0 (2026-08-19) - Saldos bancarios reales
! EL SALDO EXIGE QUE EL MEDIO EXISTA EN EL PLAN. La v0.14 clasificaba por "el tipo de categoria no es de riqueza", condicion que un medio inexistente cumple: las 39 filas sin medio valido ($2.147.186) caian enteras en el saldo cotidiano. Franco lo vio de una. De los $2.574.778 que mostraba, $2.407.180 eran filas sin medio. El saldo real de las cuentas es $517.658 (ARS: cotidiano $427.591 + riqueza $90.067; USD: -434,41).
! FUERA la fila "Flujo Cotidiano" (decision Franco: "no es una categoria definida"). La Capacidad de Capitalizacion pasa a ser el RESIDUO: Ingresos - Gastos Fijos - Gastos Variables. Los tres buckets reparten el 100% por construccion.
+ Tablero!C18 pasa a mostrar el SALDO ACTUAL de cada cuenta bancaria con su moneda, sobre todo el historico. Antes sumaba solo el mes seleccionado, asi que nunca era un saldo.
+ DEVTOOL_AltaCuentas: da de alta las 12 cuentas que el ledger usa y el catalogo no tiene (111 movimientos), entre ellas 'Ajuste' con 70. Once traen su tipo declarado por el propio ledger de forma unanime; 'Ajuste' no tiene tipo en ninguna fila y se ubica en Ingresos por decision declarada.
- "Frasco transitorio USD" NO EXISTE: ni en el ledger ni en el catalogo. El unico parecido es "Frasco Transitorio NaranjaX", que es ARS y apunta a Meta de Ahorro 1. El total USD del ledger es -434,41 y esta enteramente en medios de riqueza.

v0.14.1 (2026-08-19) - Los dos defectos que abortaron la corrida de v0.14.0
- COMILLAS DE MAS: se escribia 'Registros'!B7:B y Sheets lo guarda como Registros!B7:B, porque el nombre no necesita comillas. La verificacion comparaba texto contra texto, no coincidia, y revertia diez formulas CORRECTAS. En la planilla viva hay 256 referencias sin comillas y cero con comillas: la evidencia estaba a la vista y no la mire. Ahora el nombre se entrecomilla solo si lo necesita (_refHoja) y la comparacion canonicaliza ambos lados.
- VARIABLE LET QUE CHOCA CON UNA FUNCION: Tablero!L29 usaba 'n' como nombre de variable y N() es una funcion de Sheets, asi que la formula entera no parseaba y la celda quedaba sin nada. Pasa a llamarse 'cantidad' y 'monto_total'.
+ El banco de pruebas rechaza las dos clases de error, y ademas toda variable LET de una o dos letras. Verificado que los guards DISPARAN reproduciendo los bugs viejos: un guard que no salta es peor que no tenerlo.
+ Preflight: detecta celdas combinadas con isPartOfMerge(). Una celda que es parte de un merge sin ser su ancla se lee vacia y se deja escribir, pero lo escrito no queda.
NOTA: la corrida fallida NO dejo dano. La reversion del lote funciono como debia y las 21 celdas volvieron a su formula previa.

v0.14.0 (2026-08-19) - Stock y flujo separados
! Los SALDOS dejan de filtrarse por mes: leen el ledger entero y muestran siempre el saldo actual. Los MOVIMIENTOS siguen filtrados por mes. Es la diferencia entre un balance y un estado de resultados; mezclarlas era lo que estaba roto.
! Los asientos "Inicio Mes" dejan de tener efecto en toda la planilla. NO se borran: quedan como historia, pero ninguna formula los mira. Hacian dos trabajos a la vez -- saldo de apertura (redundante) y ajuste de conciliacion (legitimo) -- y por eso sumar el historico daba $10.153.852 contra $884.860 de saldo real.
- Los Ingresos del mes BAJAN: la clausula "(Col1 <> 'Inicio Mes' OR Col5 = 'Hogar')" dejaba entrar los arrastres de las cuentas de casa al bucket de ingresos. Se apaga en las seis formulas que la tenian.
+ Fila 20 del Tablero: "Flujo Cotidiano", el termino que le faltaba al bloque. N16 = N17 + N18 + N19 + N20. O16 pasa a sumar cuatro filas.
+ Tablero!L29: indicador de movimientos sin clasificar. Le pone nombre y numero a lo que le falte al 100% en vez de disimularlo -- son 116 movimientos (36 sin medio, 70 de cuenta 'Ajuste', 10 sin cuenta).
+ devtools/probar_stock_flujo.js: banco de pruebas de las formulas nuevas antes de desplegar.

v0.13.0 (2026-08-19) - Riqueza por lista blanca
! CAMBIO DE DEFINICION (decision Franco): riqueza deja de ser "todo lo que no sea Hogar" y pasa a ser la lista blanca TIPOS_RIQUEZA = Ahorros + Inversiones. La Financiacion (tarjetas y prestamos) SALE del patrimonio: una tarjeta es un pasivo, no capital.
+ TIPOS_RIQUEZA en 00_Config.js: la regla de negocio en el SSOT y no repartida por seis formulas. Con lista negra, cualquier tipo nuevo entraba a riqueza por el solo hecho de no llamarse Hogar.
+ DEVTOOL_RiquezaYCategorias: trio estado / aplicar / revertir. Toca SEIS celdas (Inicio!F8, Tablero!N19 y AG9:AG12) y deja intactas las DIEZ que preguntan por flujo cotidiano.
+ La columna del Tipo del bloque de categorias (Tablero!AB, cuyo rotulo AB8 ya decia "Tipo") deja de estar vacia: trae el tipo de cada categoria desde el catalogo. Y el bloque deja de ocultar las de tipo Hogar, que era lo que impedia leerlo como macrosegmentacion.
+ devtools/probar_riqueza.js: banco de pruebas contra las formulas reales del gemelo antes de desplegar.

v0.12.1 (2026-08-19) - Reparar la reparacion
- BUG PROPIO: la v0.12.0 escribio en produccion tres formulas que NO PARSEAN. En _reponerReferencias, el string de reemplazo '$1$N$17' se expande como grupo1 + "$N" + grupo1 + "7": escribio "$N$10 - $N$N$10 - 7". O23/O24/O25 pasaron de #REF! a #ERROR!, o sea PEOR que antes.
- Todos los reemplazos pasan a ir por FUNCION de reemplazo: el valor devuelto se inserta tal cual y esta clase de bug deja de ser posible.
- El modulo repara ademas el artefacto "$N$N$10 - 7" que aquella corrida dejo escrito; sin eso, re-correr Aplicar contestaria "nada que hacer" con tres celdas rotas.
! El verificador ahora LEE EL VALOR de cada celda escrita y revierte el lote entero si alguna queda en error. Antes solo comparaba texto, y por eso el texto corrupto paso sus cuatro pruebas: cicatriz 5 cometida por el modulo que la cita.
+ devtools/probar_formulerio.js: corre las transformaciones reales contra las formulas reales del gemelo antes de desplegar. Habria cortado el bug en diez segundos.
+ SEXTO DEFECTO reparado: "Inicio"!AF8 y AT8 ("Valor en X") leian la moneda de la columna de CUENTA en vez de la de MONEDA, asi que nunca convertian: todo movimiento en moneda extranjera entraba a C13/F13/C15/F15 a valor nominal (junio 2026: ~$376.740 de ingreso desaparecido, el 23% del mes). AT8 tomaba ademas la moneda de destino de Y13, una CELDA DE DATOS, en vez del selector G4.

v0.12.0 (2026-08-19) - Formulerio reparado
+ DEVTOOL_FormulerioV0111: repara los cuatro defectos que el swap v0.11 dejo en las formulas de "Inicio" y "Tablero". Trio estado / aplicar / revertir, con respaldo congelado y verificado.
- Anclas corridas: quince formulas del Tablero pedian AK9:AK / AO9:AO / AR9:AR mientras el motor (AJ6) derrama desde la fila 6. Cada monto se apareaba con el tipo, la moneda y la cotizacion del movimiento tres filas mas abajo. No daba error: daba otro numero.
- Selector de moneda: diecisiete #REF! en ocho celdas repuestos a $N$4 (y a N17/N18 los reales de fijos y variables). Con AV6 en #REF! toda la columna "Valor en ARS" devolvia cero y con ella el bloque "Movimientos del mes" entero.
- Bloque "Disponibilidad de fondos": estaba rotado una posicion respecto de sus rotulos. La formula de Capacidad de Ahorro vivia en la fila de Gastos Fijos. Se intercambian, no se reescriben.
- Tipo 'Liquidez' huerfano: catorce celdas comparaban contra un tipo de categoria que el Plan de Cuentas nuevo ya no tiene. Pasa a 'Hogar', su equivalente 1:1.
+ columnIndexToLetter en 03_SheetManager (inverso de columnLetterToIndex).

v0.11.1 (2026-08-18) - Armas descargadas
- fetchArsRate: fecha invalida o FUTURA lanza en vez de devolver la ultima cotizacion publicada.
- migrarBdAntigua / recalcularTcRegistros: sin cotizacion real se aborta todo-o-nada (fuera 1050/650/1100).
- recalcularTcRegistros: pide confirmacion nombrando cuantas filas pisa, saltea (sin blanquear) las filas sin fecha y acota el rango a la ultima fila con Fecha, no a getLastRow().
- MIGRACION v0.9.5: el guard de obsolescencia pasa a estar en TODA funcion que escribe, no solo en las publicas. La auditoria encontro que cuerpoRevertirV095_ se invocaba directo y pisaba Tipos de Cambio declarando exito.
! Privacidad real de plataforma: en Apps Script una funcion es privada si TERMINA en guion bajo, no si empieza. Las internas que escriben (v0.9.5, v0.11, v031) se renombraron con el guion bajo al final.
- Menu: salen Sincronizar / Aplicar / Revertir del swap v0.11 (ya aplicado); quedan Ver estado y Purgar. Revertir ahora exige confirmacion.
! procesarCargas: una sola fecha futura en la grilla aborta el LOTE COMPLETO sin escribir nada.

Historial completo y canónico en: src/ZZ_Changelog.js
 `
};

/**
 * Obtiene la versión actual del sistema
 * @returns {string} Versión formateada
 */
function getVersion() {
 return VERSION.toString();
}

/**
 * Obtiene el changelog completo
 * @returns {string} Historial de cambios
 */
function getChangelog() {
 return VERSION.changelog;
}

/**
 * Muestra información de versión en log
 */
function logVersionInfo() {
 Logger.log('='.repeat(50));
 Logger.log('Tidetrack Personal Finance - Apps Script');
 Logger.log(`Versión: ${getVersion()}`);
 Logger.log(`Release: ${VERSION.releaseName}`);
 Logger.log(`Fecha: ${VERSION.releaseDate}`);
 Logger.log('='.repeat(50));
}
