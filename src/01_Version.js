/**
 * 01_Version.js
 * Control de versiones del sistema Tidetrack
 * Registro de cambios y metadata de releases
 *
 * @version 0.11.5
 * @since 0.1.0
 * @lastModified 2026-08-25
 */

// [AGILE-VALOR] Control de versiones esencial para el mantenimiento del entorno.

const VERSION = {
 major: 0,
 minor: 55,
 patch: 1,

 /**
 * Retorna la versión como string
 * @returns {string} Versión en formato X.Y.Z
 */
 toString: function () {
 return `${this.major}.${this.minor}.${this.patch}`;
 },

 releaseDate: '2026-08-25',
 releaseName: 'v0.55.1 - El merge dejo dos patch, y tres numeros de version distintos',

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
v0.55.1 (2026-08-25) - El merge dejo dos patch, y tres numeros de version distintos
- El merge de las dos lineas de trabajo dejo en 01_Version.js DOS lineas patch seguidas: patch: 0 (del release v0.55.0) y patch: 1 (que venia de v0.53.1). Git no marco conflicto porque son lineas distintas: las conservo las dos.
- En un literal de objeto JavaScript la clave repetida NO es un error: gana la ultima. Asi que el archivo decia TRES numeros distintos a la vez -- toString() devolvia "0.55.1", releaseName decia v0.55.0, y el changelog embebido seguia encabezado por v0.54.0. targets.yaml, que es la referencia del drift-check, declaraba 0.55.0.
- NINGUN guard lo agarraba, y ninguno podia: parsea perfecto -- verificar_sintaxis.py daba verde con los 44 archivos -- y ES6 permite claves duplicadas en literales incluso en modo estricto. No hay parser de JavaScript que lo rechace.
* verificar_sintaxis.py ahora, ademas de parsear, verifica la COHERENCIA del bloque VERSION: ninguna clave repetida, y major.minor.patch igual a lo que dicen releaseName, el changelog embebido y la entrada de arriba de ZZ_Changelog.js. Eran cuatro lugares que declaraban el numero por separado; ahora tienen que coincidir.

v0.54.0 (2026-08-25) - Presupuesto: ABM de Proyecciones Elaboradas (ver, corregir, dar de baja)
+ Encargo textual de Franco: "en el menu deberiamos poder hacer el ABM de proyecciones
  elaboradas". La hoja "Presupuesto" ya permite decidir cuanto se va a gastar/ingresar el mes
  que viene, y DEVTOOL_PresupuestoGuardar.js (v0.50.0, ya desplegado) guarda esa decision en la
  hoja-BD "Proyeccion" con las cotizaciones del dia congeladas. Hasta este release no habia
  forma de VER, CORREGIR ni BORRAR lo que quedaba guardado ahi sin abrir la hoja a mano y leer
  filas crudas.
+ DEVTOOL_ProyeccionAbm.js (nuevo, 679 lineas): capa de datos con seis funciones publicas --
  listarPeriodosProyeccion(), detalleFilasPeriodoProyeccion(clave, origen),
  eliminarPeriodoProyeccion(clave, origen), revertirBajaProyeccionAbm(),
  actualizarMontoFilaProyeccion(fila, nuevoMonto), revertirEdicionMontoProyeccion(). Distingue
  las DOS poblaciones que hoy conviven en "Proyeccion": el guardado deliberado (marca PG_MARCA,
  DEVTOOL_PresupuestoGuardar.js) y el presupuesto base automatico (marca PB_MARCA,
  DEVTOOL_PresupuestoBase.js, promedio movil historico).
! MEDIDO EN PRODUCCION ANTES DE CONSTRUIR: TODAS las filas de "Proyeccion" son hoy de origen
  base, CERO son guardado manual -- es el caso limite que el banco prueba explicitamente
  (vacioGuardado===true).
+ devtools/probar_proyeccion_abm.js (nuevo, 487 lineas): 12 mutaciones dirigidas, cero fallas.
! Respeta la regla de orden alfabetico de carga de Apps Script (decision inline en la cabecera
  del archivo): todo simbolo de otro archivo se lee DENTRO de cuerpos de funcion, nunca en un
  const de nivel superior -- la misma clase de bug que rompio la carga completa de la planilla
  ese mismo dia con DEVTOOL_PresupuestoGuardar.js (ver v0.50.1, "el proyecto entero no
  cargaba").
+ UI_AbmProyeccionElaborada.html (nuevo): modal con dos secciones acordeon ("Guardado a mano" /
  "Presupuesto base"), tarjeta expandible por periodo con totales por bloque Y POR MONEDA
  (nunca se suman monedas distintas en un mismo numero), edicion de monto inline fila por fila,
  confirmacion de baja con respaldo/reversion. Sigue el patron de UI_AbmPlanCuentas.html y el
  Design System de UI_SharedStyles.html.
+ showAbmProyeccionElaborada() (nueva, 11_UIService.js): abre el modal, mismo patron que
  showAbmPlanCuentas(). Entrada nueva en MENU_CONFIG.ITEMS (00_Config.js): "Proyecciones
  Elaboradas", menu Tidetrack > ADMINISTRAR, al lado de "Plan de Cuentas".
! DECISION: las 6 funciones de datos se llaman DIRECTO desde el HTML por google.script.run, SIN
  wrappers pass-through en 11_UIService.js -- en Apps Script cualquier funcion global ya es
  invocable exista o no el wrapper, asi que un wrapper no reduce la superficie expuesta, solo da
  la sensacion de reducirla. Se deja un comentario para la descubribilidad (que quien audite
  sepa donde mirar), que es lo unico que si vale de la convencion.
+ El dialogo de confirmacion de Baja ahora muestra el TOTAL en pesos (por moneda) ademas de la
  cantidad de filas y el mes -- pedido explicito de Franco durante la revision: "23 filas de
  Septiembre" no dice lo mismo que "23 filas por $2.847.000".
! ALCANCE DEL ABM, deliberado (documentado en la cabecera de los dos archivos nuevos):
  - ALTA: no existe en este ABM. Ya existe -- se elabora en la hoja "Presupuesto" y se guarda
    con "Guardar Proyeccion" (menu tidetrack Dev). El modal tiene un banner que redirige ahi.
    Reconstruir esa logica en un modal hubiera sido duplicar superficie peligrosa sobre una BD
    de produccion.
  - MODIFICACION: solo el monto, solo en filas "guardado a mano". Las filas de presupuesto base
    son un promedio automatico; editarlas a mano las dejaria con una Nota que miente sobre su
    origen. El gate real esta en el SERVIDOR (actualizarMontoFilaProyeccion rechaza toda fila
    que no empiece con PG_MARCA), el modal es la segunda barrera, no la unica.
  - BAJA: por periodo completo (clave+origen), con respaldo automatico en hoja oculta y
    reversion inmediata (una sola accion pendiente de deshacer a la vez -- se pierde con el
    siguiente cambio, avisado en el propio dialogo).
! Verificado: las 72 entradas de MENU_CONFIG (ITEMS+DEV_ITEMS) resuelven a una funcion global
  real (antes eran 71). Los 18 bancos (node devtools/probar_*.js, incluido el nuevo
  probar_proyeccion_abm.js) en verde, probar_carga_apps_script.js en verde (43 archivos, sin
  ReferenceError de orden), verificar_modales.py en verde (4 modales, incluido el nuevo), node
  --check en verde sobre todo src/*.js.

v0.53.0 (2026-08-25) - Merge de recuperacion: --verificado piso v0.52.1, las dos ramas se reconcilian
NOTA DE CONCURRENCIA (segunda vez que las ramas se pisan mutuamente): a las 16:44 el deploy de
  v0.51.2 (esta rama, fix/tablero-pendientes) uso sync_targets.command --verificado. Ese modo
  empuja sin preguntar "solo si el remoto es un commit CONOCIDO del repo" -- y lo era (la punta
  de fix/abm-desplegable-entidad, mas nueva que la propia), pero el chequeo no exigia que fuera
  ANCESTRO de lo que se estaba por pushear. Resultado: la planilla perdio v0.50.0 (rediseno del
  Centro de Operaciones) y v0.52.1 (el fix de la animacion que rebotaba). Nada se perdio de git
  -- todo seguia en origin/fix/abm-desplegable-entidad, punta a0b3c18 -- pero la planilla
  productiva SI corrio con menos codigo del que tenia una hora antes.
! ES LA MISMA CICATRIZ, AL REVES: cfbb173 ("merge: fix/tablero-pendientes -> restaurar el
  Presupuesto que el deploy piso", v0.52.0) fue la respuesta a que un deploy anterior de ESTA
  rama pisara el trabajo de fix/abm-desplegable-entidad. c1f5931 ("el verificador exige que el
  remoto sea ANCESTRO, no solo conocido") ya arreglo devtools/verificar_remoto.py para que esto
  no vuelva a pasar -- ese fix entra al repo con este mismo merge.
! targets.yaml.version_desplegada queda en "0.51.2": es lo que HAY en la planilla ahora mismo
  (el deploy que la piso), no lo que el repo declara. El campo describe el estado real; el
  proximo sync_targets.command corrige la planilla y recien ahi ese numero sube.
+ DEVTOOL_PresupuestoSembrar.js: gana la version de esta rama (v0.51.2, la que pisa con
  confirmacion) sobre la copia vieja (v0.51.0, solo llenaba celdas vacias) que
  fix/abm-desplegable-entidad todavia tenia por haber mergeado esta rama en un punto anterior a
  cfbb173. Git lo resolvio automaticamente, sin conflicto: el otro lado no habia tocado el
  archivo desde el ancestro comun.

v0.53.1 (2026-08-25) - La banda pierde el subtitulo
- Franco senalo el span de la banda: "este span es irrelevante". Lo era. "Que queres hacer" al lado del wordmark no decia nada que la pantalla no dijera ya: las tarjetas del home tienen su propia descripcion, mas larga y mas concreta.
- Con el span se va tambien el campo subtitulo de SHELL_VISTAS. Era su UNICO consumidor, y un campo muerto ahi no es inocuo: SHELL_VISTAS se inyecta ENTERA por template en cada apertura del shell.
- regenerar_servidor_shell.py parseaba SHELL_VISTAS por regex EXIGIENDO el campo; sin el ajuste el regenerador dejaba de encontrar las vistas y escribia una lista vacia, en silencio.

v0.53.0 (2026-08-25) - Seis pedidos de Franco sobre el shell
+ "El boton de gestionar cuentas debe tener el mismo peso que el resto": era un chip de 36px sin descripcion al lado de tarjetas de 116. Un chip comunica "accion secundaria", y administrar el Plan de Cuentas es la estructura sobre la que se apoya todo. Pasa a tarjeta, misma grilla y mismo peso. El CSS de .shell-chip se retira entero por quedar sin uso.
+ "Deberia dejar cargar muchos mas movimientos, no solo 15": el tope era la ALTURA DE LA GRILLA, que es una restriccion de la hoja y no del acto de cargar. Ahora se procesa en TANDAS -- se siembra lo que entra, se procesa, se repite -- y el cliente avisa cuantas van a ser antes de apretar Cargar. Lo mismo para traspasos, con la salvedad de que una tanda nunca parte un traspaso al medio: se divide por pares.
+ "En el Tipo seria genial que se ponga rojo/verde segun el tipo": el estado elegido se tine con el semaforo MEDIDO de la hoja, riel incluido -- el color solo en la letra a 13px no alcanza. Los tonos son los verificados contra AA sobre su propio riel.
+ "En TODOS los desplegables deberias poder acortar tipeando": los select pasan a input con datalist. Un select nativo salta por PREFIJO; un datalist filtra por SUBCADENA, asi que "naran" trae "Frascos Naranja X" y "Dolar NaranjaX", que un select no encuentra nunca. Los datalist son COMPARTIDOS y se pueblan una vez: es lo que hace barato clonar un bloque. El valor libre no se bloquea -- la hoja acepta valores fuera de lista -- pero se AVISA cuando no esta en el Plan.
+ "Los traspasos no tienen interfaz disenada como la de movimientos": era un formulario suelto de una operacion mientras al lado habia bloques con acordeon. Dos gramaticas para el mismo acto de cargar. Ahora comparten la misma, y se pueden cargar varios.
+ "El nombre es tidetrack, todo en minusculas": el wordmark baja a minusculas en el shell, en la barra de menu de Sheets y en los mensajes que nombran el menu. NO se toca la CUENTA "Tidetrack" del Plan de Cuentas, que es un nombre de cuenta y no la marca.
! ENCONTRADO POR EL BANCO, y es lo mas grave de esta vuelta: el changelog de la v0.52.2 tenia BACKTICKS adentro, y ese campo ES un template literal delimitado por backticks. Cerraba el literal a la mitad y 01_Version.js no parseaba -- commiteado y pusheado asi. Apps Script parsea el proyecto ENTERO en cada ejecucion: de haberse desplegado, la planilla quedaba sin menu, sin triggers y sin custom functions. Es el mismo modo de falla que la v0.50.1.
+ devtools/verificar_sintaxis.py (nuevo) + gate en sync_targets.command ANTES del drift-check: ningun deploy sale con un archivo que no parsea. No tiene sentido preguntar si el remoto cambio cuando lo que se va a subir no arranca. Probado en las dos direcciones.
v0.52.2 (2026-08-25) - El movimiento nuevo ya no arranca en dolares
- ENCONTRADO PROBANDO EL SHELL EN UN NAVEGADOR, no leyendo codigo: el primer bloque de Movimiento nuevo nacia con el medio "Dolar Cash" y el prefijo del monto decia USD. No era una eleccion: era el PRIMERO DEL CATALOGO, que esta ordenado alfabeticamente.
! Diez de los quince medios son ARS, y todos los cotidianos tambien. Un default que casi siempre esta mal es peor que no tener default: obliga a corregirlo todas las veces, y el dia que no se corrige entra un gasto en la moneda equivocada.
+ medioPorDefecto(): el primer medio en la MONEDA BASE, que es la primera de MONEDAS_DISPONIBLES (ADR-003: ARS es la base, siempre 1.0). No se retipea "ARS" en el cliente.
+ Banco del shell: exige que exista el default pensado, que la moneda base salga de la constante, y que el primer bloque NO arranque sin medio -- que era lo que dejaba entrar al primero alfabetico.
+ devtools/servidor_shell/ (nuevo): el shell corriendo fuera de Sheets, con el catalogo real y la latencia medida. servidor.py no usa "python3 -m http.server" porque ese modulo llama a os.getcwd() al importarse y muere en un sandbox donde el cwd no es legible. index.html es una copia que regenera devtools/regenerar_servidor_shell.py leyendo el shell real y SHELL_VISTAS del backend.
v0.52.1 (2026-08-25) - El bloque que entra desacelera, no rebota
- La animacion de entrada de un bloque de carga multiple usaba cubic-bezier(.34, 1.56, .64, 1). El 1.56 pasa de largo el valor final y vuelve: el bloque se pasa de posicion y de escala antes de asentarse.
- POR QUE IMPORTA ACA Y NO EN CUALQUIER LADO: en esa pantalla se agregan hasta QUINCE bloques, asi que el rebote se ve quince veces seguidas en una sola carga. Y es una herramienta de cargar plata, cuya voz de marca "traduce, no impresiona". Un objeto real desacelera; no rebota.
+ Pasa a cubic-bezier(.22, 1, .36, 1) -- easeOutQuint: entra rapido y se frena sin pasarse. Queda alineado con las otras dos curvas del sistema, que ya eran desaceleraciones puras.
* El token se llamaba --mov-rebote y ahora es --mov-entra: un nombre que promete un rebote invita a reponerlo.

v0.51.2 (2026-08-25) - Presupuesto: sembrar Monto a Proyectar ahora pisa, con confirmacion
! Fix de diseno sobre v0.51.0/v0.51.1 (sin desplegar): K/O/S no son por mes -- son las mismas
  celdas para cualquier periodo de J2/J3. La regla vieja ("nunca pisar") volvia la funcion util
  una sola vez en la vida. Confirmado el sintoma textual de Franco: "no me deja porque ya hay
  datos".
! aplicarPresupuestoSembrar() ahora escribe TODAS las filas con cuenta y fuente valida, pise o
  no pise -- incluido el cero tipeado a mano, que ya no se protege.
+ estadoPresupuestoSembrar() separa vacias (se llenan) de las que SE PISAN (ya tenian valor),
  por bloque y en total.
+ Confirmacion explicita (patron de DEVTOOL_PurgaRespaldos.js) SOLO cuando hay algo que pisar,
  con el periodo exacto que se esta sembrando. Sin nada que pisar, corre derecho.
! El respaldo pasa a ser el seguro principal: guarda el valor previo EXACTO de cada celda (no
  solo "vacia"), y revertirPresupuestoSembrar() lo repone -- pero solo si la celda todavia tiene
  el numero que esa corrida escribio (la proteccion contra pisar una correccion manual
  posterior se conserva identica).
+ devtools/probar_presupuesto_sembrar.js: nueva prueba de regresion -- sembrar mes A, cambiar
  el selector a mes B, sembrar de nuevo: K/O/S quedan en B, no en A.

v0.51.0 (2026-08-25) - Presupuesto: sembrar Monto a Proyectar desde J/N/R
+ DEVTOOL_PresupuestoSembrar.js (nuevo): siembra K/O/S ("Monto a Proyectar") con lo que J/N/R
  ya muestran para el modo vivo (Proyeccion o Historico), solo en las cuentas donde esa celda
  esta REALMENTE vacia -- nunca pisa un numero que Franco ya cargo a mano. Pedido textual:
  "que te arme los valores de 'Monto a proyectar' que sean iguales a la 'Proyeccion' del mes
  seleccionado", disparado por estadoGuardarProyeccion reportando 53 cuentas vacias.
+ El anuncio de modo es explicito: si el selector esta en "Historico" al momento de sembrar, el
  modulo avisa en mayuscula que lo copiado NO es la Proyeccion sino el promedio ponderado.
+ Trampa del spill (J/N/R puede mostrar "" sin ser un numero): se reusa el mismo criterio que
  ya usa DEVTOOL_PresupuestoGuardar.js para leer K/O/S, y una fuente invalida con cuenta
  presente ABORTA la corrida entera en vez de sembrar bien 89 cuentas y mal una en silencio.
+ revertirPresupuestoSembrar es mas protector que sus hermanos: solo vacia una celda si TODAVIA
  tiene exactamente el numero que la corrida escribio -- si Franco la corrigio despues de
  sembrarla, revertir la deja como esta.
+ devtools/probar_presupuesto_sembrar.js: banco con pruebas de mutacion (no pisar llenas
  incluido el caso limite "0", la trampa del spill, revertir protector, verificacion post
  escritura con reversion de todo el lote).
+ Toda referencia a PM_*/PC_* (DEVTOOL_PresupuestoModo.js, DEVTOOL_PresupuestoResumen.js) se
  lee DENTRO de una funcion, nunca en un const de nivel superior -- la leccion de v0.50.1,
  aplicada de entrada en vez de esperar al proximo incidente.

v0.50.0 (2026-08-25) - Presupuesto: Guardar Proyeccion, con cotizaciones congeladas
+ Tercera y ultima etapa de la hoja "Presupuesto" (sobre el Modo v0.45.1 y el resumen v0.46.1,
  ambos ya desplegados): DEVTOOL_PresupuestoGuardar.js (nuevo) toma "Monto a Proyectar"
  (K/O/S) del periodo de J2/J3 y lo appendea a la BD "Proyeccion". Cierra el circuito con el
  Tablero -- hasta ahora no tenia contra que medir una proyeccion DELIBERADA de Franco, solo
  el promedio historico automatico de DEVTOOL_PresupuestoBase.js.

DECISION 1 -- las cotizaciones congeladas (el punto del encargo):
+ Las cuatro tasas (TC ARS/USD/AUD/EUR) quedan como VALOR NUMERICO en cada fila nueva, nunca
  formula. Se leen llamando a TIDETRACK_USD()/AUD()/EUR() DIRECTO como funciones de Apps
  Script (nunca como formula de celda -- asi no hay "Loading..." que esperar), UNA sola vez
  por corrida (mismo patron que _tasasPb, DEVTOOL_PresupuestoBase.js).
+ Regla Estricta 9: si cualquiera de las tres llamadas falla, la excepcion de
  fetchArsRate/fetchInternationalRates (15_ExchangeRateApi.js) sube SIN CAPTURAR y no se
  escribe absolutamente nada -- ni una fila a medias, ni un TC en blanco.

DECISION 2 -- la fecha de cada fila:
+ El PRIMER DIA del mes proyectado. Verificado, no asumido, contra los DOS consumidores reales
  de "Proyeccion" (_formulaPresupuestoIp, DEVTOOL_InicioPresupuesto.js; _bloqueComunTfp,
  DEVTOOL_TableroFaltanteProyectado.js): los dos filtran por rango de mes completo
  [DATE(anio;mes;1), EOMONTH], nunca por igualdad exacta. Coincide ademas con la convencion que
  ya usa DEVTOOL_PresupuestoBase.js: "Proyeccion" no queda con dos convenciones de fecha.

DECISION 3 -- el marcado, pensado para el ABM que Franco pidio como encargo posterior:
+ La Nota lleva "Presupuesto guardado <clave-de-periodo> <sello>" (ej. "Presupuesto guardado
  2026-09 2026-08-25_143012"). La clave de periodo es lo que permite encontrar "todas las
  filas de la proyeccion guardada de septiembre" con un solo prefijo -- la misma busqueda que
  la idempotencia de este modulo y el ABM futuro van a compartir.
+ Sello a resolucion de SEGUNDOS, no de minuto (a diferencia de sellos hermanos): es la unica
  pieza que distingue dos corridas de "aplicar" para el mismo periodo, y revertirGuardarProyeccion
  solo puede deshacer lo que su propio sello identifica.

DECISION 4 -- convivencia con el presupuesto base historico (DEVTOOL_PresupuestoBase.js):
+ La proyeccion hecha a mano GANA. Al guardar el periodo X se retiran, para ESE mes, las filas
  PB_MARCA del base y las filas propias de un guardado manual anterior del MISMO periodo
  (idempotencia: guardar dos veces no duplica, reemplaza). Nunca se toca una fila de otro
  periodo ni una sin marca. estadoGuardarProyeccion() dice EXACTO cuantas filas de cada
  origen se retirarian, antes de tocar nada.

+ EL INVARIANTE, mas fuerte de lo pedido: se verifica CADA BLOQUE por separado (suma de filas
  de Ingresos == K8, Fijos == O8, Variables == S8) y recien despues el neto (== K8-O8-S8) -- un
  bloque de mas compensando uno de menos no se cuela. Ademas, ANTES de escribir (parte del
  preflight): se confirma que W8 (el agrupado de la etapa 2) cierra contra K8-O8-S8; si el
  cimiento aguas arriba esta roto, aborta sin generar ninguna fila.
+ Preflight PROPIO (_preflightPresupuestoPg), deliberadamente NO acoplado a _preflightPm
  (DEVTOOL_PresupuestoModo.js): ese preflight tambien exige que el selector de Modo (E7) sea
  valido, una condicion sobre columnas (J/N/R) que este modulo jamas lee. El preflight propio
  verifica solo lo que hace falta: identidad de la hoja, selectores de periodo/moneda, titulo
  y rotulo "Cuenta" de los tres bloques, que K7/O7/S7/W7 digan "Monto a Proyectar"
  (PC_TITULO_PROYECTAR, la MISMA constante de DEVTOOL_PresupuestoResumen.js -- nunca una
  segunda con un valor "parecido", la leccion de v0.46.0), sin celdas en error en la banda de
  datos, y que K8/O8/S8/W8 tengan formula.
+ Solo menu tidetrack Dev ("Presupuesto: guardar proyeccion": estado/aplicar/revertir), CERO
  botones en la hoja "Presupuesto" -- pedido explicito de Franco: "por ahora... luego va a
  tener su boton".
+ devtools/probar_presupuesto_guardar.js (nuevo, banco 13): siete secciones. La mas importante
  (pedido explicito del encargo): DE PUNTA A PUNTA con un mock completo de
  "Registros"/"Proyeccion", aplicar el MISMO periodo DOS VECES y confirmar que siguen siendo 3
  filas propias, no 6; revertir repone EXACTO lo que la ultima corrida retiro (con SU TC
  congelado, no el de una corrida posterior); un fallo de la API de cotizaciones a mitad de
  camino no deja NADA escrito ni borrado (todo o nada). Mas: preflight con mutaciones dirigidas
  (rotulo "parecido", celda en error, total sin formula -- mismo patron que el bug real de
  v0.46.0), el invariante ANTES de escribir (W8 desalineado aborta el plan), y la anomalia
  "monto sin cuenta" (aborta, no se pisa un dato que no se entiende).
- Bug propio atrapado por el banco ANTES de llegar a produccion: la verificacion post-revert
  comparaba por PREFIJO de periodo en vez de por Nota EXACTA (prefijo + sello) -- al revertir
  una segunda corrida, las filas restauradas de la PRIMERA corrida (legitimamente con el mismo
  prefijo de periodo) se confundian con "sobrantes de la corrida que se esta revirtiendo" y el
  revert fallaba en falso. Corregido antes del commit: revertirGuardarProyeccion() borra y
  verifica por Nota exacta, nunca por prefijo de periodo solo.
- devtools/probar_tablero_faltante.js: se agrega 'DEVTOOL_PresupuestoGuardar.js': ['S8'] al
  allowlist de falsos positivos del barrido anti-colision (lee Presupuesto!S8, sin relacion
  con el S8 que TFP posee en Tablero -- mismo patron ya documentado para U8 en v0.46.0).
! Los trece bancos en verde. SIN DEPLOY POSTERIOR A ESTE COMMIT: la corrida final ("1. Ver
  estado" antes de "2. Aplicar") la hace Franco.


NOTA DE CONCURRENCIA (renumeracion v0.47.0 -> v0.50.0): esta entrada nacio como "v0.47.0" en
  los commits de esta sesion (rama fix/tablero-pendientes) mientras, en paralelo y sin
  visibilidad mutua, la sesion de fix/abm-desplegable-entidad tambien usaba v0.47.0 para el
  Centro de Operaciones y ya lo habia desplegado. Al mergear las dos ramas (2026-08-25) esta
  entrada se renumera dos veces: primero a v0.49.0 (con la rama abm anclada en v0.48.1), y
  esa segunda asignacion tambien quedo obsoleta porque la rama abm siguio pusheando mientras
  se armaba el merge y llego ELLA MISMA a v0.49.0 ("La tipografia nunca cargaba, y carga
  multiple de movimientos", desplegado real, confirmado contra la planilla en vivo). El
  numero final es v0.50.0, por encima de todo lo que fix/abm-desplegable-entidad llevaba en
  produccion al momento de cerrar este merge (v0.49.0, anclado a f820f2a, verificado con un
  fetch inmediatamente antes de commitear). Guardar Proyeccion en si NUNCA se desplego bajo
  ningun numero (los trece bancos verificaron en local, sin deploy posterior a ningun commit
  de esta entrada), asi que renumerar no reescribe historial real desplegado. No toca ningun
  archivo de la otra sesion (16_ShellService.js, UI_Shell.html, UI_SharedStyles.html,
  DEVTOOL_CuentasComodin.js, DEVTOOL_DIAG_Desplegables.js, DEVTOOL_DIAG_PresupuestoTitulos.js).


v0.49.0 (2026-08-25) - La tipografia nunca cargaba, y carga multiple de movimientos
- LA CAUSA RAIZ DE "HAY DISTORCIONES DE TAMANOS DE LETRAS" NO ERA LA ESCALA: ERA LA FAMILIA.
  Dos cosas encadenadas. Primera: UI_SharedStyles declara 'Google Sans' pero el shell no
  tenia el <link> a Google Fonts, asi que la fuente NUNCA se descargaba y caia al sistema --
  los dos shells decian usar la misma tipografia y no la estaban usando (pymes SI lo carga,
  07_UI_Shell.html:25). Segunda, y peor: los cinco rotulos mas chicos del shell usaban
  var(--font-mono), que declara JetBrains Mono y Fira Code, ninguna instalada en
  macOS/Chrome, asi que resolvia a COURIER NEW. La altura de x de Courier es ~0.42em contra
  ~0.53em de una grotesca: a 10.5px las minusculas median 4,4 px reales al lado de un select
  de 14px sans. Y habia DOS textos declarados en 20px que no se parecian en nada, porque uno
  era sans y el otro Courier -- el ojo lee la diferencia de familia como diferencia de
  tamano. Se venia ajustando la ESCALA, que era tratar el sintoma.
- Se carga la webfont. Se RETIRA el token --font-mono del design system: un token que
  resuelve a algo que nadie eligio es una trampa para el que venga. Una sola familia.
- ESCALA de cinco pasos enteros -- 22/16/14/13/11 -- y se van los 10.5px, que Chrome redondea
  a subpixel distinto segun donde caiga la caja: dos rotulos declarados igual no median igual.
- ALTURA FIJA (42px) en todos los controles. Un select IGNORA line-height en Chrome y calcula
  su alto con su metrica interna; un input[type=date] agrega su propio shadow DOM. Con el
  mismo font-size y el mismo padding daban 43 y 47 px, y el Monto a 20px daba 56: tres
  alturas en la MISMA fila. Nunca se iguala un input con un select por padding, se fija
  height. El Monto vuelve al tamano de todos: un campo se destaca por su lugar en la grilla
  y por el foco, no agrandandole la letra.
- CARGA MULTIPLE (Franco: "no tenes opciones de registros multiples como planilla pymes").
  Bloques repetibles portados de pymes: agregar, quitar, renumerar. Hereda MEDIO y FECHA del
  bloque anterior y nunca monto, cuenta ni nota -- heredar lo que cambia obliga a borrarlo,
  que es peor que tipearlo. El tope sale de las filas LIBRES que informa el backend: la
  grilla de personales es de 15 filas contra las 50 de pymes, asi que dejar agregar sin
  limite seria hacer tipear diez bloques para que el backend conteste que no entran.
- Y no es solo comodidad: cada movimiento suelto disparaba un procesarCargas COMPLETO --
  APIs de cotizacion, persistencia al Data Lake, reordenamiento del ledger entero. Seis
  gastos de a uno eran seis pasadas; ahora es UNA.
- Los cortes del grid se COMPARTEN entre filas. La fila 1 cortaba en 4 y 7 y la fila 2 en 5
  y 8: corridos exactamente una columna, que es la peor distancia posible -- no es
  alineacion ni es contraste, es error.
- Home de TRES columnas: con dos, la septima tarjeta quedaba huerfana con 430 px de blanco al
  lado, que era lo primero que se veia al abrir.
- PIE FIJO al piso. Era estatico y quedaba a 500 px del borde en el Home y a 260 en otra
  vista: un cromo que salta de lugar al navegar hace que la UI se sienta amateur aunque cada
  pantalla por separado este bien.
- Los inputs pierden borde y sombra. La doctrina declarada de este shell es que la superficie
  se define por FONDO y no por linea, y estaba aplicada solo a las tarjetas: el formulario
  tenia siete cajas con contorno de 1px Y sombra. Home y formulario parecian dos productos.
- CONTRASTE: --text-secondary pasa de #6e7f8d a #5f6368. El anterior daba 3.69:1 sobre el
  fondo de bloque #eff2f9 y 4.14:1 sobre blanco, por debajo del minimo AA de 4.5:1. Se veia
  lavado, y lavado en un modal chico se lee como sin terminar.
- FOCO: los inputs tenian un halo GRIS sobre fondo gris, o sea invisible. Ahora usan el mismo
  outline que los botones: un solo tratamiento de foco para todo el sistema.
- Se retira la sugerencia de "usar estos datos" del ultimo movimiento (Franco: "es al
  pedo") junto con la lectura del ledger que la alimentaba. La respuesta a "maximo 2 toques"
  resulto ser la carga multiple, no adivinarle el proximo movimiento.
- Banco del shell: 17 secciones. Los catorce bancos y los tres modales en verde.
v0.50.0 (2026-08-25) - Rediseno del Centro de Operaciones
+ Franco: "necesito un equipo agentico que se ocupe de que el menu tenga un frontend mucho mas bonito". Se armo: cuatro agentes de benchmark (webapp de pymes, contrato de diseno del handoff, centro de operaciones, critica del estado actual), dos direcciones independientes y un director de arte que eligio, injerto y entrego el CSS.
! EL DIRECTOR ENCONTRO QUE LA DIRECCION "MAS SOBRIA" YA HABIA FALLADO DOS VECES, citando el changelog de la v0.48.0: sacar los bordes y definir la superficie por fondo es exactamente lo que se hizo antes de que Franco dijera "sigue feo". La observacion de fondo: una celda de Sheets no necesita borde porque LA GRILLA YA ES EL BORDE; un input flotando en un modal no tiene grilla. Se invierte el plano: lienzo del color de la hoja, tarjetas blancas elevadas.
! Y midio que el Home ANTERIOR armaba ~738px de flujo dentro de un modal de 700: no entraba en si mismo. El nuevo suma 580 con 120 de sobra, contado componente por componente.
+ HOME CON UNA SOLA RESPUESTA OBVIA: card hero para "Movimiento nuevo" -- que es a lo que Franco entra -- y el resto en tarjetas normales y chips. Antes eran siete tarjetas identicas de 116px en tres grillas iguales: cada apertura cobraba una decision.
+ ACORDEON EN LA CARGA MULTIPLE: un solo bloque abierto a la vez. Quince bloques abiertos de 194px son 2.910px en un modal de 700; colapsados son 48px cada uno y el cupo real entra con el boton de Cargar siempre a la vista.
+ Segmentado Egreso/Ingreso en vez de un select de dos opciones, y prefijo de moneda con el select transparente encima: saca una columna entera de la grilla y baja el bloque de tres filas a dos.
+ Total del lote en vivo, y solo si todo comparte moneda: sumar monedas distintas seria mentir.
* CONTRASTE MEDIDO PAR POR PAR. El rojo #c93232 sobre su riel daba 4.47:1 -- abajo de AA -- y pasa a #ad2727 (5.76). El placeholder daba 2.56 y pasa a 3.89.
* El ABM se alinea al mismo sistema: comparte plano con el shell y se le sacan los !important, que peleaban contra el sistema compartido en vez de usarlo. "Gestionar cuentas" reemplaza el modal, asi que tocarla cambiaba de piel.
+ 56 tokens, CERO hex sueltos fuera de :root, 323 usos de var(). Sin build, sin Tailwind, sin JS de terceros.
v0.49.0 (2026-08-25) - La tipografia nunca cargaba, y carga multiple
! LA CAUSA RAIZ DE "HAY DISTORCIONES DE TAMANOS DE LETRAS" NO ERA LA ESCALA, ERA LA FAMILIA. UI_SharedStyles declara 'Google Sans' pero el shell no tenia el <link> a Google Fonts: la fuente NUNCA se descargaba. Y peor: los cinco rotulos mas chicos usaban var(--font-mono), que declara JetBrains Mono y Fira Code -- ninguna instalada -- asi que caian en COURIER NEW. La altura de x de Courier es ~0.42em contra ~0.53em de una grotesca: a 10.5px las minusculas median 4,4 px al lado de un select de 14px sans. Habia DOS cosas declaradas en 20px que no se parecian en nada, porque una era sans y la otra Courier.
+ Se carga la webfont de verdad. Se retira el token --font-mono del design system: un token que resuelve a algo que nadie eligio es una trampa. UNA SOLA FAMILIA en todo el shell, como pymes.
+ Escala de cinco pasos enteros: 22 / 16 / 14 / 13 / 11. Se van los 10.5px, que Chrome redondea distinto segun donde caiga la caja.
+ ALTURA FIJA en todos los controles (42px). Un select ignora line-height y calcula su alto con su metrica interna; un input[type=date] trae su propio shadow DOM. Con el mismo font-size y el mismo padding daban 43 y 47 px, y el Monto a 20px daba 56: TRES ALTURAS EN LA MISMA FILA. Nunca se iguala un input con un select por padding.
+ CARGA MULTIPLE, portada de pymes: bloques repetibles con agregar, quitar y renumerado. Hereda medio y fecha del bloque anterior, nunca monto, cuenta ni nota -- heredar lo que cambia obliga a borrarlo. El tope sale de las filas LIBRES que informa el backend: la grilla de personales es de 15 filas contra las 50 de pymes, asi que dejar agregar sin limite seria hacer tipear diez bloques para que el backend diga que no entran.
+ Los cortes del grid se COMPARTEN entre filas. Antes la fila 1 cortaba en 4 y 7 y la fila 2 en 5 y 8: corridos exactamente una columna, la peor distancia posible.
+ Home de tres columnas: con dos, la septima tarjeta quedaba huerfana con 430px de blanco al lado.
+ Pie FIJO al piso. Antes era estatico y saltaba de lugar al navegar.
+ Los inputs pierden borde y sombra: la doctrina de este shell es que la superficie se define por fondo, y estaba aplicada solo a las tarjetas -- Home y formulario parecian dos productos.
* --text-secondary pasa de #6e7f8d a #5f6368: el anterior daba 3.69:1 sobre el fondo de bloque, por debajo del minimo AA. Y el foco de los inputs deja de ser un halo gris sobre gris (invisible) para usar el mismo outline que los botones.
+ Banco del shell: 17 secciones. Los catorce bancos en verde.
v0.48.1 (2026-08-25) - El shell reacciona: el scriptlet escapaba el JSON
- SINTOMA, reportado por Franco: el shell abria pero NO REACCIONABA. Ningun click hacia
  nada. "Recargo la pagina y no ocurre nada."
- CAUSA: el JSON de las vistas se inyectaba con el scriptlet que hace ESCAPADO CONTEXTUAL
  de HTML, el que convierte cada comilla en &quot;. Adentro de un <script>, en posicion de
  valor, eso es un error de sintaxis -- y un error de sintaxis MATA EL ARCHIVO ENTERO: no se
  define el router, no se define ningun onclick, no se apaga ningun loader. Para inyectar un
  valor en JS va la otra forma, la que no escapa.
- POR QUE PYMES NUNCA LO PISO: su shell solo inyecta un string simple ENTRE COMILLAS
  (VISTA_INICIAL). Ahi el escapado es inofensivo. El problema aparece recien cuando se
  inyecta un objeto crudo, que es lo que hace falta para tener UNA sola lista de vistas.
- ESTE RELEASE CORRIGE EL DIAGNOSTICO DE LA v0.47.1. Ahi se afirmo que los 30 segundos con
  el spinner girando eran porque el DOMContentLoaded pedia el catalogo detras de un overlay.
  ERA FALSO. El script nunca corria, y el loader de esa version nacia visible: no tenia
  quien lo apagara. El sintoma se parecia tanto a una llamada lenta que se acepto la
  explicacion sin probarla, que es exactamente lo que este repo tiene prohibido hacer.
  LO QUE SI QUEDO BIEN de esa version, y se conserva: el shell abre sin pedirle nada al
  servidor, el catalogo es perezoso y hay tope de espera. Buena arquitectura, diagnostico
  equivocado.
- verificar_modales.py suma el CHEQUEO 5, y existe porque este bug se colo justo por el
  PUNTO CIEGO del chequeo 2: los scriptlets se reemplazan por un literal antes de correr
  node --check, asi que el parser nunca ve el escapado y un archivo roto pasaba en verde.
  Ahora se marca todo scriptlet que escapa, dentro de un <script>, en posicion de valor --
  la regla es que ahi adentro solo es seguro DENTRO de un string literal. Probado en las dos
  direcciones: verde sobre el codigo corregido, y senala vistasJson por su nombre sobre el
  codigo roto.
- Y NO SE ESCRIBEN LOS DELIMITADORES LITERALES NI SIQUIERA EN UN COMENTARIO: la plantilla se
  procesa ANTES que el JS, asi que un scriptlet dentro de un comentario tambien se evalua.
  El chequeo 5 lo detecto sobre el comentario que se habia escrito para explicar el bug, que
  por eso mismo era peligroso.
- Banco del shell, seccion 15: exige que el JSON use la forma que no escapa y que el pie use
  la que SI escapa, porque va a texto HTML y ahi escapar es lo correcto.


v0.48.0 (2026-08-25) - Movimiento y Traspaso operan, y el shell deja de ser cuadrado
- MOVIMIENTO NUEVO. Siembra UNA fila en la grilla de Cargas y llama a procesarCargas. NO
  escribe en "Registros" directo, y es deliberado: ese es el unico lugar que congela las
  cuatro cotizaciones del dia, persiste las nuevas al Data Lake, deduce el tipo de cuenta y
  reordena el ledger. Este repo ya dejo escrito por que no puede haber una segunda
  implementacion "equivalente".
- TRASPASO NUEVO. Escribe LAS DOS PATAS JUNTAS, en una sola llamada a setValues: si se
  escribieran por separado y la segunda fallara, quedaria media operacion y eso hace
  desaparecer plata del sistema. La moneda de cada caja la decide el CATALOGO, no el
  operador. Si las cajas no comparten moneda pide los dos montos y deja el TC de la
  operacion escrito en la nota -- el ledger congela el TC OFICIAL del dia, que casi nunca es
  al que se opero, asi que ese dato se perderia si no se guardara ahi. Y avisa cuando el
  traspaso capitaliza, leyendo TIPOS_RIQUEZA del backend en vez de retipear la lista.
- EL GAP DE procesarCargas SE TAPA EN LA PUERTA. Su unico filtro es "monto no vacio": una
  fila con monto y sin cuenta entra igual al ledger con tipo de cuenta vacio. No se toca el
  pipeline (3.469 filas dependen de que se comporte igual), se valida en el shell: cuenta,
  medio y tipo obligatorios, monto positivo, moneda de MONEDAS_DISPONIBLES, medio existente
  en el Plan, y fecha no futura -- una sola fecha futura aborta el LOTE ENTERO.
- LockService en las dos rutas de escritura. Ninguna ruta productiva de este repo tomaba
  lock. Con el shell, dos pestanias abiertas pueden sembrar la MISMA fila libre de la grilla
  y una pisa a la otra sin que nadie se entere.
- Los botones se deshabilitan mientras la llamada viaja, y hay tope de 60 s con un mensaje
  que dice que mirar. Dos clicks son dos movimientos, y en un ledger eso es un duplicado que
  despues hay que ir a buscar a mano.
- "Usar estos datos" propone cuenta, medio y tipo del ultimo movimiento. Es la ruta de dos
  toques que pide el arnes, y sale de leer CINCO filas de "Registros" -- que esta ordenado
  por fecha descendente, asi que las mas recientes son las primeras -- nunca el ledger entero.
- DISENO, decision Franco 2026-08-25, textual: "esta todo muy cuadrado". Se van los bordes
  de 1px de las tarjetas y el radio chico. Cada tarjeta era un rectangulo con contorno
  adentro de otro rectangulo con contorno, y el chip del icono adentro era un tercero. Ahora
  la superficie se define por FONDO y no por linea, que ademas es exactamente lo que hace la
  hoja: no hay un solo setBorder en toda la planilla y los bloques se separan por aire.
  Iconos circulares, radio 14px, mas padding, y fuera la linea del rotulo de seccion y la
  del pie. El unico contorno que queda es el del foco, que es accesibilidad y no decoracion.
- verificar_modales.py suma el CHEQUEO 4: cada onclick/onchange/oninput del HTML tiene que
  apuntar a una funcion que exista en el script. El chequeo 1 mira JS -> DOM; este mira
  DOM -> JS, que es la direccion contraria y por donde se cuela un boton que no hace nada --
  no lanza error al cargar, solo falla en silencio cuando alguien lo aprieta. Probado en las
  dos direcciones: verde sobre el codigo real, y rojo con un handler huerfano inyectado.
- El banco del shell sube de 10 a 14 secciones: los seis rechazos de la validacion, que la
  fila se arme desde RANGES y no retipeando posiciones, el formato de plata de la hoja, y
  que TIPOS_RIQUEZA viaje del backend. Los catorce bancos en verde.
- FALTAN TRES: Proyeccion, Recurrentes y Conciliacion siguen en listo:false y muestran que
  van a hacer y contra que hoja escriben, en vez de prometer.


v0.47.1 (2026-08-24) - El shell abre instantaneo: cero viajes al servidor
- SINTOMA, reportado por Franco con captura: el Centro de Operaciones abria, mostraba el Home
  en gris detras de un overlay con el spinner girando, y a los 30 segundos seguia igual.
- CAUSA, y es un error de diseno mio y no un bug de Apps Script: el DOMContentLoaded pedia
  obtenerCatalogoShell() -- cinco lecturas del Plan de Cuentas -- detras de un overlay a
  pantalla completa, y recien al volver apagaba el loader. El costo de ABRIR pasaba a ser el
  costo del formulario mas caro que todavia no se habia abierto.
- LO QUE LO HACE EVITABLE: el Home no necesita UN SOLO DATO de ese catalogo. Son seis
  tarjetas de texto fijo. Se estaba esperando para llenar desplegables que ninguna pantalla
  abierta estaba mostrando. El diagnostico correcto no era "que lectura tarda" sino "por que
  estamos leyendo antes de dejar ver".
- AHORA EL SHELL HACE CERO LLAMADAS AL SERVIDOR AL ABRIR. El loader nace apagado
  (class="shell-overlay hidden") y el Home se ve completo apenas abre. Lo unico que si venia
  del servidor -- el nombre de la planilla y la version, para el pie -- se inyecta por la
  PLANTILLA, que el backend ya esta renderizando de todos modos: no cuesta ningun viaje.
- EL CATALOGO PASA A SER PEREZOSO. asegurarCatalogo(cuando) lo pide la primera pantalla que
  necesite un desplegable, y de ahi en mas queda en memoria del cliente para todas las demas.
  Se conserva la ventaja del round-trip unico de pymes, sin pagarlo al abrir.
- TOPE DE ESPERA de 15 s en el cliente, con su clearTimeout y su guarda de doble respuesta:
  pase lo que pase del otro lado, el overlay se apaga y le dice a Franco que hacer. Un loader
  que depende de que el servidor conteste para poder apagarse es un loader que puede quedarse
  puesto para siempre -- esta planilla ya pago ese precio dos veces, en la v0.45.2 y en esta.
- diagnosticarShell() (NUEVO, cableado en menu Dev > Shell): cronometra POR SEPARADO el costo
  de abrir la planilla y cada una de las cinco lecturas del catalogo, mas el total. Existe
  porque cinco lecturas encadenadas detras de un overlay dan un unico numero que no dice
  nada. Si el shell vuelve a ponerse lento, el primer paso es correr esto y leer cual de las
  cinco tarda, no adivinar. Solo lectura.
- Banco 13, seccion 9 NUEVA: exige que el listener de arranque no llame al servidor, que el
  overlay nazca apagado, que el pie venga de la plantilla, que el catalogo no se pida dos
  veces y que exista el tope de espera. La regresion queda cerrada por prueba y no por
  promesa. Los trece bancos y verificar_modales en verde.


v0.47.0 (2026-08-24) - Centro de Operaciones: el shell y su Home
- FASE 5 DEL ARNES, portada de planilla-pymes. 16_ShellService.js (NUEVO) + UI_Shell.html
  (NUEVO): modal de 900x700 con Home de seis tarjetas, router de vistas del lado del cliente
  y el catalogo entero del Plan de Cuentas en UN solo round-trip. Entra al menu "Tidetrack"
  como PRIMER item: "Abrir Tidetrack".
- MODAL Y NO SIDEBAR, y el argumento en contra del sidebar era el fuerte: es la unica
  superficie que deja ver la hoja y el formulario a la vez. Se cae por dos razones duras.
  Primera: showSidebar tiene 300 px FIJOS -- la API ignora setWidth() -- y la pantalla de
  Conciliacion necesita cuatro columnas de numeros por cada uno de los quince medios del
  catalogo; en 280 px eso es una columna con scroll, justo la superficie donde NO se ve el
  conjunto, que es lo unico que conciliar necesita. Segunda: lo que hay que mirar no esta en
  la hoja. El saldo por medio lo produce la regla del ultimo corte, no una celda; el promedio
  de referencia lo produce PresupuestoBase. El sidebar resuelve "ver la hoja"; el problema
  real es "ver los numeros", y esos entran ADENTRO de la herramienta.
- 900 Y NO LOS 1000 DE PYMES porque el contenido mas ancho de este repo entra con holgura en
  860 px de contenido. 700 y no 760 porque el ABM ya esta en 750 y ese es el techo practico
  en una pantalla de 900 px con el chrome de Chrome mas el de Sheets: 700 entra siempre, 760
  entra a veces, y un modal que se corta abajo esconde el boton de confirmar -- la peor falla
  posible en una herramienta de habito.
- UNA SOLA WHITELIST DE VISTAS, y esta es la correccion a pymes. Alla la lista vive en TRES
  lugares que el propio comentario del codigo pide "mantener SIEMPRE a la par", y ya fallo:
  'apertura' y 'transferencia' faltaban en la whitelist del backend y sus items de menu
  abrian el Home en silencio. Aca SHELL_VISTAS es la unica: el backend valida contra ella y
  se la INYECTA al HTML por template, asi que el router del cliente se arma DESDE ella y no
  existe una segunda lista que pueda diferir. Mismo criterio con las dimensiones:
  SHELL_GEOMETRIA viaja al HTML y ningun max-width del CSS puede contradecirla (en pymes el
  comentario dice 1120, el codigo 1000 y el fragmento 1080).
- DOS TARJETAS YA OPERAN HOY: "Gestionar cuentas" abre el ABM -- que volvio a abrir en la
  v0.45.2 -- y "Procesar la hoja de Cargas" dispara procesarCargas sin duplicar una linea de
  su logica (es el unico lugar que congela las cuatro cotizaciones y deduce el tipo de
  cuenta). Las otras cuatro vistas muestran QUE van a hacer y contra que hoja escriben, en
  vez de un "proximamente": una tarjeta que promete algo que no hace es peor que una que
  dice a que atenerse.
- UI_SharedStyles.html: los tres colores de ESTADO pasan a ser los MEDIDOS de la planilla.
  Eran #10B981 / #EF4444 / #F59E0B -- los de Tailwind -- que no aparecen en una sola celda de
  la hoja; un popup con esos verdes y rojos se lee como otro producto. Ahora son
  #356854 / #c93232 / #ffb300 con sus rieles #e6f4ea / #fce8e6 / #fef7e0, que son los que el
  codigo declaro canonicos el 2026-08-21 y los que viven LITERALES dentro de las formulas
  SPARKLINE de Inicio!F19:F22. Se agrega --text-data (#39444d), el color del cuerpo de datos
  de la hoja: 4.136 celdas, el mas usado por lejos, y NO es negro puro. Un solo design
  system y no dos, que es la regla que el arnes fijo para esta fase.
- LAS ALERTAS SUBEN AL DESIGN SYSTEM. Nacieron como .shell-error/.shell-ok locales con una
  franja de acento lateral de 3px, y las dos cosas estaban mal. La franja porque LA PLANILLA
  NO USA BORDES: no hay un solo setBorder en todo src/ y los bloques se separan con una
  columna vacia, asi que una barra de color al costado se lee como de otro producto (el
  patron de la casa, en pymes, es borde completo de 1px). Y locales porque una alerta es
  componente de BASE -- las seis pantallas la van a necesitar -- y el contrato de fragmentos
  de la Fase 5 prohibe declarar estilos base fuera del archivo compartido. Ahora son
  .alert / .alert-error / .alert-ok / .alert-warning / .alert-info en UI_SharedStyles.html,
  resueltas con fondo tenido y tinta: el color del fondo ya dice lo que la franja diria.
- LA ESCALA TIPOGRAFICA SE COLAPSA A CINCO PASOS. La primera version tenia SIETE tamanos y
  dos pares que diferian un 4 % -- 10.5/11 y 13.5/14 --: esa diferencia no se ve, asi que no
  era una decision, era deriva. Queda 20 / 16 / 14 / 12 / 10.5, con el salto grande arriba
  (20/16 = 1.25), que es donde hace falta, y los parrafos heredando el cuerpo de 14 px de
  UI_SharedStyles en vez de declarar un 13.5 propio. Abajo los pasos siguen siendo chicos a
  proposito: es una UI densa de operacion y ahi la jerarquia la cargan tambien el peso, la
  versalita, el color y la familia mono. La hoja hace lo mismo -- sus saltos dramaticos estan
  en los KPI (45/32/30/26) y sus rotulos y datos viven apretados en 15/14/12/11/10.
- devtools/probar_shell.js (NUEVO, banco 13): cruza SHELL_VISTAS contra los divs del HTML EN
  LAS DOS DIRECCIONES (ninguna vista sin div, ningun div huerfano), prueba que cada una de
  las seis puertas de menu abre SU vista, que una vista desconocida cae al Home en vez de dar
  error, que obtenerCatalogoShell NUNCA lanza -- ni con getTableData explotando ni sin
  planilla activa, porque una excepcion del servidor deja al cliente con el loader puesto --
  y que TODA cadena google.script.run del HTML tiene withFailureHandler. Los trece bancos en
  verde y devtools/verificar_modales.py en verde sobre los tres modales.


v0.46.1 (2026-08-24) - Tres botones cargados salen del menu Dev
- SALIO DE REVISAR CON QUE CONVIVE EL MENU NUEVO, no de un bug reportado. Tres entradas del
  menu "tidetrack Dev" apuntan a modulos que YA CORRIERON y cuyas constantes describen el
  estado de la planilla ANTES de que corrieran. No son modulos rotos: son modulos que
  cumplieron su trabajo y se quedaron en el menu apuntando a un estado que ya no existe.
- 'Conciliar saldos', EL MAS GRAVE y medido: CONC_OBJETIVOS (DEVTOOL_ConciliarSaldos.js:50)
  tiene SIETE saldos escritos a mano del 2026-08-19, y CONC_RESTO_EN_CERO = true (:61)
  significa "todo medio del Plan que no este en esa lista tiene saldo cero". El catalogo
  tiene QUINCE medios. Es decir que "2. Cargar los ajustes", hoy, forzaria siete medios a
  sus saldos de hace cinco dias y PONDRIA LOS OTROS OCHO EN CERO, con asientos reales en el
  ledger. Un boton al que solo se le puede acertar el dia que se escribio.
- 'Limpiar Plan de Cuentas': su lista de restos de migracion es anterior al alta de la
  categoria 'Seguros' (Plan!P29). Un segundo clic se la lleva puesta.
- 'Tipo de medios': reescribe el Tipo de CADA medio desde su catalogo interno, revirtiendo
  en silencio los que Franco edito a mano en la hoja despues de que el modulo corriera.
- LA LECCION, que vale mas que las tres entradas: el patron estado/aplicar/revertir de este
  repo protege contra escribir MAL. No protege contra escribir DOS VECES con un catalogo
  congelado en el momento en que se escribio el modulo. Un modulo de una sola vez tiene que
  salir del menu cuando termina su trabajo, no quedarse "por si acaso".
- LOS TRES ARCHIVOS SE CONSERVAN ENTEROS: lo que se saca es la PUERTA, no el codigo. El
  calculo del saldo teorico de ConciliarSaldos -- ultimo 'Inicio Mes' de cada medio + todo
  lo posterior, validado 5 de 7 al centavo contra los saldos reales -- es exactamente la
  base de la pantalla de Conciliacion del centro de operaciones, que SI va a pedir los
  saldos en vez de tenerlos escritos en una constante.
- Para reponer cualquiera de los tres hay que actualizar antes sus constantes contra la
  planilla viva. Reponerlos tal cual es reponer el mismo problema.


v0.46.1 (2026-08-24) - Presupuesto: V7 es dinamico, W7 dice "Monto a Proyectar"
! v0.46.0 SE DESPLEGO. Franco corrio "1. Ver estado" en la planilla real y el preflight freno
  SOLO -- correctamente -- antes de escribir una sola celda:

      No se pudo medir: La hoja "Presupuesto" no es la que este modulo espera:
      W7 dice "Monto a Proyectar" y se esperaba "Monto Proyectado".
      Hay que volver a medir antes de escribir. No se toco nada.

+ MEDIDO EN VIVO POR FRANCO (con el modo en "Historico"): el patron es uniforme en los CUATRO
  bloques de la hoja -- Ingresos, Gastos Fijos, Gastos Variables Y Categorias -- de TRES
  columnas cada uno: nombre, una columna que SIGUE AL MODO ("Monto Historico" / "Monto
  Proyectado" segun E7: J/N/R/V) y una columna FIJA ("Monto a Proyectar", siempre el mismo
  texto: K/O/S/W).
- DOS ERRORES, no uno -- el preflight solo reporto el segundo porque abortaba ahi antes de
  llegar al primero:
  1. V7 se trataba como un ROTULO ESTATICO ('Monto Histórico', comparado por preflight, nunca
     escrito por este modulo). Es DINAMICO -- sigue al modo exactamente igual que J7/N7/R7. La
     v0.46.0 nunca lo hubiera actualizado si Franco cambiaba E7 despues de aplicar.
  2. W7 se esperaba como 'Monto Proyectado'. El texto real es 'Monto a Proyectar' -- EL MISMO
     texto exacto que K7/O7/S7, no una variante "parecida".
- CAUSA RAIZ, la misma de siempre en un lugar nuevo: se midio contra docs/permanente/celdas.tsv,
  un snapshot commiteado del 2026-08-18 que quedo viejo -- la cicatriz numero uno de este repo
  ("no fiarse de una geometria memorizada"). Para un rotulo que OTRO modulo hace dinamico (V7,
  que sigue a J7/N7/R7 via DEVTOOL_PresupuestoModo.js), un snapshot es especialmente
  traicionero: captura el texto de un modo puntual y lo hace pasar por una constante fija.
+ EL FIX: V7 pasa a ESCRIBIRSE con _formulaTituloMontoPm() de DEVTOOL_PresupuestoModo.js,
  REUSADA VERBATIM -- nunca una segunda implementacion del mismo titulo (ver _planPc). Ya no
  tiene una constante de texto esperado en el preflight (mismo criterio que J7/N7/R7 en
  DEVTOOL_PresupuestoModo.js: la idempotencia la resuelve la comparacion de formulas de
  _planPc, no un rotulo-chequeo), pero gana el guard de "no puede ser la mitad muda de una
  combinada" (paso 5b, mismo patron que el paso 8 de DEVTOOL_PresupuestoModo.js). El plan pasa
  de 64 a 65 celdas.
- W7 pasa a compararse contra PC_TITULO_PROYECTAR -- LA MISMA constante que ya usa el chequeo
  de K7/O7/S7 -- en vez de una segunda constante (PC_TITULO_PROYECTAR_AGRUPADO) con un valor
  "parecido" pero distinto: es el mismo texto en cuatro celdas, y una segunda constante para
  el mismo dato es exactamente el patron que produjo este bug. Se retira esa constante.
+ Nuevo chequeo en _verificarInvariantesPc: V7 tiene que mostrar la MISMA palabra que J7/N7/R7
  para el modo vivo (mismo criterio que ya usa _verificarInvariantesPm sobre esas tres celdas).
+ CONFIRMADO ANTES DE APLICAR: el modulo sigue sin escribir K/O/S en ningun punto -- Franco ya
  empezo a cargar "Monto a Proyectar" a mano (K8 muestra $1.000.000,00 en la planilla real) y
  el plan de este modulo no toca esa columna.
+ devtools/probar_presupuesto_resumen.js: nueva mutacion reproduce EXACTO el bug real
  (W7="Monto Proyectado" en vez de "Monto a Proyectar") contra el preflight real -- aborta con
  el mismo mensaje que reporto Franco. Nueva seccion 3b construye un mock COMPLETO de hoja para
  _verificarInvariantesPc (a diferencia de la seccion 3, que prueba _recalcularAgrupadoPc en
  aislamiento) y prueba, con un caso sano de CERO fallas, que el chequeo de V7 atrapa el titulo
  si dejara de seguir al modo -- aislado de cualquier otra falla posible. Cableado exacto
  actualizado a 65 celdas (antes 64), incluye V7; W7 confirmado como NUNCA propuesto.
! Los doce bancos en verde. SIN DEPLOY POSTERIOR A ESTE COMMIT: la corrida final ("1. Ver
  estado" antes de "2. Aplicar") la hace Franco.


NOTA DE CONCURRENCIA (v0.46.1, dos lineas de trabajo con el mismo numero): las dos entradas de
  arriba se escribieron en paralelo, sin visibilidad mutua, desde el mismo commit base
  (e952fc2). "Tres botones cargados salen del menu Dev" (fix/abm-desplegable-entidad,
  2026-08-24 20:46) es la que sigue viva en la planilla hoy, dentro de la cadena ininterrumpida
  que llega hasta v0.49.0. "V7 es dinamico, W7 dice Monto a Proyectar" (fix/tablero-pendientes,
  2026-08-24 21:16) NUNCA se desplego bajo el numero v0.46.1 -- se deja tal cual quedo escrita
  en su propio commit, como registro historico honesto, y su trabajo continua en v0.50.0 una
  vez mergeadas las dos ramas.


v0.46.0 (2026-08-24) - Cuentas comodin: el bloque oculto del Plan de Cuentas
- PEDIDO DE FRANCO, textual: "En realidad es una cuenta comodin, no es ingreso fijo o
  variable. Agregala oculta por algun lado".
- EL PROBLEMA QUE CIERRA: "Traspaso" e "Inicio Mes" no son ingreso, ni gasto fijo, ni gasto
  variable, asi que no tenian donde vivir en "Plan de Cuentas" y se tipeaban a mano en la
  grilla de Cargas. De ese "a mano" salen las variantes que el propio 00_Config.js documenta
  -- en el ledger conviven "Traspaso", "traspaso " e "Inicio  Mes" -- y que llama la falla
  mas cara posible, porque una sola fila colada infla el agregado. Con la cuenta en el
  desplegable, la variante ya no se puede escribir.
- DEVTOOL_CuentasComodin.js (NUEVO): crea el bloque en "Plan de Cuentas"!T:U con titulo,
  headers, una nota que explica que es cada comodin, formato COPIADO del bloque de Ingresos
  (ni un hex hardcodeado: si Franco cambia el azul de la hoja, el bloque lo sigue solo) y las
  columnas OCULTAS. Tres publicas: estadoCuentasComodin / aplicarCuentasComodin /
  revertirCuentasComodin.
- POR QUE T:U, medido y no elegido: E, H, K, O y Q son el AIRE entre bloques -- la hoja
  separa por columna vacia y no por borde, esa es su regla visual --, R es la consolidada de
  servicio y S es el aire que le corresponde. T es la primera columna libre de verdad. Sobre
  el gemelo, la hoja usa C, D, F, G, I, J, L, M, N, P y R, y nada mas.
- LA CONSOLIDADA SE EXTIENDE, NO SE REESCRIBE: se detecta el ultimo rango que la formula ya
  aplana y se le agrega T8:T1000 al lado, CON EL SEPARADOR QUE LA PROPIA FORMULA USA. El
  separador de argumentos depende del locale de la planilla (aca ";") y adivinarlo es
  exactamente la trampa que documenta la cabecera de 07_MiradaInteranual.js. Una formula
  rearmada a mano es la forma barata de dejar sin lista al desplegable de Cuenta, que es lo
  unico que consume esa columna.
- NO CAMBIA UNA SOLA FILA DEL LEDGER, y es deliberado: deducirTipoCuenta lee SOLO los
  catalogos de ingresos, fijos y variables (06_RegistrosService.js:255-259), asi que una
  cuenta en un bloque nuevo sigue devolviendo '' -- que es lo correcto para un comodin -- y
  no obliga a migrar ninguna de las 3.469 filas historicas. Las 533 patas de traspaso con
  'Ingreso' y las 96 con vacio quedan como estan; las sigue corrigiendo en la LECTURA la
  exclusion por CUENTAS_NEUTRAS, que ya funciona.
- NO MUEVE LA CUENTA 'Ajuste'. Conceptualmente tambien es un comodin, pero hoy vive en el
  bloque de Ingresos con su destino declarado a proposito (DEVTOOL_AltaCuentas.js:62,
  ALTA_SIN_TIPO = { 'Ajuste': 'Ingreso' }). Moverla cambiaria el tipo de cuenta de todo
  Ajuste futuro: es una decision de Franco, no de este modulo.
- EL CATALOGO NO SE RETIPEA: el bloque es la PROYECCION de CUENTAS_NEUTRAS, que sigue siendo
  la fuente unica. Si manana entra una tercera comodin se agrega ahi y se vuelve a correr
  "2. Aplicar"; el preflight verifica que hoja y constante sigan coincidiendo.
- 00_Config.js suma DOS entradas a RANGES. CUENTAS_COMODIN (T:U) es la del bloque nuevo.
  PLAN_CONSOLIDADA (R) entra porque YA SE MOVIO UNA VEZ SIN QUE NADIE SE ENTERARA: nacio en
  S (MIGRACION_v0.11_SwapHojasFix.js) y quedo en R cuando DEVTOOL_LimpiarPlanCuentas borro
  fisicamente la columna Q. Hasta hoy su coordenada existia SOLO como constante local de ese
  devtool ya consumido, y CLAUDE.md seccion 4 sigue diciendo S -- un modulo que la busque
  ahi opera sobre una columna vacia y reporta exito.
- devtools/probar_cuentas_comodin.js (NUEVO, banco 12): la hoja falsa EVALUA el
  QUERY(FLATTEN(...)) de verdad, asi que "Traspaso aparece en el desplegable" se prueba y no
  se promete. Cuatro mutaciones, cada una por un modo de falla real de este repo: (A) celda
  que se traga la escritura como la mitad muda de una combinada -> la verificacion falla, se
  revierte todo y las columnas NO quedan ocultas, para que el problema quede a la vista;
  (B) formula escrita que no derrama -> revierte y repone la formula previa; (C) bloque
  modelo sin titulo -> el preflight aborta antes de escribir nada; (D) columna destino
  ocupada -> aborta sin pisar. Los doce bancos en verde.


v0.46.0 (2026-08-24) - Presupuesto: categorias (V/W), mes de referencia y el bug de Tabla 2
+ Segunda etapa de la hoja "Presupuesto", sobre el selector de Modo ya desplegado (v0.45.1).
  DEVTOOL_PresupuestoResumen.js (nuevo) construye el agrupado por categoria, el rotulo del mes
  de referencia de la Tabla 1 ("Movimientos Promedio historicos.") y corrige el bug de
  copiar-pegar de la Tabla 2 ("Presupuesto del Mes.").
! DESCUBIERTO ANTES DE CONSTRUIR, MEDIDO CONTRA celdas.tsv (nunca asumido): el encargo describia
  "la columna V" como si fuera una unica columna que cambia de fuente segun el modo de E7. La
  geometria real de la hoja tiene DOS columnas de agrupado, ya tituladas y con SUM() esperando
  contenido -- V7="Monto Historico" / V8=SUM(V9:V) agrupa J/N/R (la columna "modo", que ya
  resuelve internamente Proyeccion/Historico desde v0.45.0); W7="Monto Proyectado" /
  W8=SUM(W9:W) agrupa K/O/S ("Monto a Proyectar", fijo, SIN modo). Las dos tablas resumen ya
  apuntaban cada una a SU propio total -- Tabla 1 (E14=V8), Tabla 2 (E21=W8) -- ninguna mezcla
  fuentes. CONSECUENCIA sobre el invariante que proponia el encargo ("V8 = K8-O8-S8 en modo
  Proyeccion"): esa igualdad es la de W8, no la de V8. El invariante correcto -- y mas fuerte,
  porque vale en LOS DOS MODOS, no solo Proyeccion, ya que V/W no miran el modo y solo
  re-parten lo que J/N/R/K/O/S ya tienen calculado -- es el par V8=J8-N8-R8 y W8=K8-O8-S8.
+ SIGNO VERIFICADO CONTRA LA FORMULA VIVA DEL TABLERO antes de construir (pedido explicito del
  encargo, no asumido): la primera linea del LET de Tablero!AA10 (bloque "Categorias.") es
  monto_neto=IF(tipo="Egreso"; -monto; monto) -- Ingreso suma, Egreso resta, agrupado despues
  por categoria. Esta hoja no tiene un "Tipo" por fila como el ledger (I/M/Q son espejos de
  BLOQUE del Plan de Cuentas, no de movimientos individuales): el bloque de origen reemplaza esa
  senal -- una cuenta espejada desde I (Ingresos) suma, desde M o Q (Gastos Fijos/Variables)
  resta. Misma convencion, expresada con el dato que esta hoja realmente tiene.
+ C9 (titulo de la Tabla 1) agrega el mes de referencia entre parentesis, derivado EN VIVO de
  E7/J2/J3 -- reusa _fragmentoMesRefPm y _condModoHistoricoPm de DEVTOOL_PresupuestoModo.js
  VERBATIM, nunca redeclarados. Nombres de mes via IP_MESES + INDEX (no TEXT(): evita la trampa
  de locale en nombres de mes en letras, ya documentada en este repo). Se elige ampliar C9 (el
  titulo existente) en vez de una celda nueva: el ancla de una combinada es la unica celda
  siempre segura para escribir sin medir en vivo si otra celda esta libre o combinada.
- F19:F21 (Tabla 2) dividian por $E$11 (el Ingresos de la Tabla 1) en vez de $E$18 (el de su
  propia tabla) -- confirmado por Franco como error de copiar-pegar. Cirugia de token
  (_repararReferenciaTabla2Pc): reemplaza SOLO el token roto, reusa el resto de la formula viva
  intacto (mismo patron que _repararRangoTipoBcat, DEVTOOL_BloqueCategorias.js).
+ INVARIANTE EN JS PURO (_recalcularAgrupadoPc), independiente de las formulas de Sheets:
  recalcula el agrupado por categoria leyendo I..W de "Presupuesto" y los tres catalogos del
  Plan de Cuentas via getValues(), compara celda por celda contra V/W y contra
  V8=J8-N8-R8/W8=K8-O8-S8. Una cuenta sin categoria en el Plan de Cuentas se reporta como AVISO
  (no aborta): el desvio de total que produce se prueba EXPLICADO por esa cuenta puntual antes
  de darlo por bueno -- si el desvio no cierra exacto con el hueco conocido, es FALLA real y
  revierte todo.
+ Cableado en MENU_CONFIG: "Presupuesto: categorias y resumen" (estado/aplicar/revertir).
  devtools/probar_presupuesto_resumen.js (nuevo, banco 12): estructura de formulas, cableado
  exacto (64 celdas: 30 V + 30 W + C9 + F19:F21, NUNCA J/N/R/K/O/S), la matematica del agrupado
  espejada en JS con mutacion dirigida (sin mapa de categorias, una categoria 100% Ingreso pasa
  de 1200 a 0), deteccion de cuentas sin categoria, y el preflight con mock de hoja y ONCE
  mutaciones dirigidas (rotulo corrido, C9 combinada, mirror sin formula, valor a mano en V/W,
  totales sin formula, F19/F20 con patron desconocido o sin formula).
- Limpieza: se retiran los dos diagnosticos temporales que ya cumplieron su proposito --
  DEVTOOL_DIAG_Desplegables.js (auditoria de desplegables de Plan de Cuentas/Cargas) y
  DEVTOOL_DIAG_PresupuestoTitulos.js (incidente de v0.45.0, ya confirmado y cerrado) -- y sus
  dos entradas de MENU_CONFIG.
- devtools/probar_tablero_faltante.js: la entrada CONVIVENCIA_OK de
  'DEVTOOL_DIAG_PresupuestoTitulos.js' (['S7'], un falso positivo del barrido anti-colision) se
  retira junto con ese diagnostico y se reemplaza por 'DEVTOOL_PresupuestoResumen.js': ['U8'] --
  mismo tipo de falso positivo: Presupuesto!U8 ("Nombre", header del espejo de categorias)
  colisiona por token con Tablero!U8 (rotuloFaltante del bloque Gastos Fijos de TFP), hojas y
  conceptos totalmente distintos.
! NO TOCADO A PROPOSITO: J/N/R, K/O/S y sus titulos (J7/N7/R7) son de
  DEVTOOL_PresupuestoModo.js. "Guardar Proyeccion" es un encargo posterior segun el contrato de
  diseno (docs/permanente/DISENO_HOJA_PRESUPUESTO.md).
! Los doce bancos en verde. SIN DEPLOY: corre primero "Presupuesto: categorias y resumen >
  1. Ver estado" antes de "2. Aplicar".


NOTA DE CONCURRENCIA (v0.46.0, dos lineas de trabajo con el mismo numero): las dos entradas de
  arriba se escribieron en paralelo, sin visibilidad mutua, desde el mismo commit base
  (e952fc2). "Cuentas comodin: el bloque oculto del Plan de Cuentas" (fix/abm-desplegable-
  entidad, 2026-08-24 20:44) es la que sigue viva en la planilla hoy, dentro de la cadena
  ininterrumpida que llega hasta v0.49.0. "Presupuesto: categorias (V/W), mes de referencia y
  el bug de Tabla 2" (fix/tablero-pendientes, 2026-08-24 20:56) SI se desplego bajo v0.46.0 --
  targets.yaml lo declaro a las 21:01 del mismo dia -- pero quedo pisado horas despues por el
  deploy de v0.48.0 (fix/abm-desplegable-entidad, 2026-08-25 14:32), cuyo src/ local no incluia
  DEVTOOL_PresupuestoResumen.js ni DEVTOOL_PresupuestoGuardar.js. Se deja tal cual quedo escrita
  en su propio commit, como registro historico honesto de que si estuvo en produccion; su
  trabajo continua en v0.50.0 una vez mergeadas las dos ramas, que es tambien cuando vuelve a
  desplegarse.


v0.45.2 (2026-08-24) - El ABM abre: el id del selector de entidad
- SINTOMA: "Plan de Cuentas", el unico item funcional del menu diario, abria a un spinner
  infinito que tapaba el formulario. Desde la v0.24.0, y lo desplegado era v0.45.1: cuatro
  dias con la unica pantalla del producto muerta.
- CAUSA: UI_AbmPlanCuentas.html:250 pedia getElementById('entitySelect'). Ese id no existe.
  El select se llama 'entityType' (:152) y las otras OCHO referencias del archivo lo escriben
  bien -- es un typo, no un renombre a medias. El TypeError ocurria dentro del
  withSuccessHandler de getAbmFormData, asi que la linea 251, la unica que apaga el loader,
  nunca llegaba a correr.
- POR QUE NADIE LO VIO: withFailureHandler cubre fallas del servidor, no excepciones del
  cliente dentro del handler de exito. La falla no deja rastro: ni error en pantalla, ni log,
  ni fila mal escrita. Solo un modal que no abre.
- ORIGEN: a7129d2 [v0.24.0], "tres fixes de la revision adversarial pre-merge", en el mismo
  diff que agrego llenarDominioRelacionado(). El llamado nacio con un id inventado.
- SE AGREGA withFailureHandler en los otros dos puntos con EL MISMO MODO DE FALLA, que hasta
  hoy no lo tenian: getCategoryAccounts (:343) dejaba el input deshabilitado con el
  placeholder 'Buscando...' de forma permanente, y deleteAbmRecord (:408) -- la unica
  operacion irreversible del ABM -- dejaba el loader puesto sin decir si el borrado ocurrio.
- QUE FALTA, anotado y no hecho aca: este repo tiene verificacion adversarial para todo lo que
  ESCRIBE en la planilla y CERO para lo que MUESTRA. planilla-pymes resuelve exactamente esto
  con legacy/devtools/verificar_modales.py, que resuelve los include(), concatena los scripts,
  corre node --check y cruza cada getElementById del JS contra los ids del DOM. Portarlo es
  parte de la Fase 5 del arnes y habria encontrado este bug en la primera corrida.


v0.45.1 (2026-08-24) - Presupuesto: el bug real detras del incidente de v0.45.0
! v0.45.0 SE DESPLEGO Y SE APLICO EN LA PLANILLA REAL: "2. Aplicar" NO VERIFICO y se revirtio solo -- "Presupuesto!J7/N7/R7 no quedo con el valor escrito". Fallaron SOLO los tres titulos; las 90 celdas de monto verificaron bien.
- LA HIPOTESIS INICIAL (razonable, cicatriz conocida del repo) era una celda COMBINADA. NO LO ERA: el preflight ya tenia un guard para exactamente eso y no aborto (si J7 fuera la mitad muda, habria frenado ANTES de escribir, y "1. Ver estado" no habria dicho "93 celdas a escribir"). El texto EXACTO del error es el de la rama esValor de _verificarEscrituraSyf (compara VALOR contra el TEXTO de la formula), no el de "quedo SIN formula" (lo que se veria en un no-op de escritura).
- LA CAUSA REAL: aplicarPresupuestoModo armaba cada entrada de escritas con esValor: teniaValor, donde teniaValor significaba "esta celda TENIA un valor estatico ANTES" (dato para poder revertir). Pero _verificarEscrituraSyf lee ese MISMO campo como "esto se ESCRIBIO con setValue()". Como toda celda de este modulo se escribe con setFormula(), el campo tenia que ser SIEMPRE false para la verificacion -- daba true justo en J7/N7/R7 (las unicas con valor estatico previo), y la verificacion comparaba el resultado CALCULADO de la formula contra el TEXTO de la formula: nunca podian coincidir.
+ _entradaEscritaPm (nueva, extraida de aplicarPresupuestoModo para que el banco la pueda probar directo): construye cada entrada de escritas SIN esValor, y _revertirEscriturasPm (nueva, propia del modulo, no reusa _revertirEscriturasSyf) decide value-vs-formula por previa/previoValor, nunca por un flag prestado de otro significado -- mismo patron que _revertirEscriturasIp en DEVTOOL_InicioPresupuesto.js.
+ devtools/probar_presupuesto_modo.js, seccion 5 (nueva): reproduce el incidente EXACTO contra la funcion real _verificarEscrituraSyf (mismo mensaje de error que reporto Franco) y prueba por mutacion sobre el codigo real (_entradaEscritaPm) que reintroducir esValor:teniaValor lo rompe de nuevo.
+ DEVTOOL_DIAG_PresupuestoTitulos.js (nuevo, TEMPORAL): diagnostico de solo lectura que mide en vivo si J7/N7/R7 (y K/O/S) de "Presupuesto" son celdas combinadas, para cerrar la duda de la hipotesis descartada con evidencia y no solo con analisis de codigo. Cableado en MENU_CONFIG junto al otro diagnostico temporal pendiente. Borrar archivo + entrada de menu cuando Franco confirme.
- probar_tablero_faltante.js: CONVIVENCIA_OK suma 'DEVTOOL_DIAG_PresupuestoTitulos.js': ['S7'] -- falso positivo del barrido anti-colision (texto plano, sin nocion de hoja): el S7 del diagnostico es Presupuesto!S7, no el Tablero!S7 que ese modulo posee.
! Los once bancos en verde.

v0.45.0 (2026-08-24) - Presupuesto: el selector de Modo, cableado
+ El selector de Modo (Presupuesto!E7) tenia el rotulo pero NINGUNA formula lo leia; J/N/R (filas 9-38, 30 cuentas x 3 bloques) estaban vacias, asi que J8/N8/R8 daban $0,00. Ahora las 90 celdas mas los 3 titulos dinamicos (J7/N7/R7: "Monto Historico" / "Monto Proyectado") responden en vivo a E7.
+ Proyeccion: el total de la cuenta en el mes CALENDARIO anterior al de J2/J3. Historico: promedio ponderado EXPONENCIAL de los ultimos 6 meses (misma ventana que los deltas de Inicio). Alpha=0.65: el mes mas reciente pesa 8,62 veces el mas viejo de la ventana.
+ Reusa el patron de _formulaRealidadIp/_formulaAuxFlujoIp (DEVTOOL_InicioPresupuesto.js), convirtiendo a la moneda de J4 con los TC congelados de la MISMA fila del ledger -- cero cotizaciones en vivo, cero "Loading...".
- El alpha viaja como fraccion "(13/20)" y no como "0.65": un decimal con punto depende del locale dentro de una formula con separador ";" (trampa ya documentada en IP_BLOQUE).
+ E7 recibe su validacion de datos si no la tenia; si ya tenia una distinta, el preflight aborta en vez de pisarla.
+ Invariante: recalculo en JS puro (getValues() sobre "Registros") de cada bloque, comparado contra J8/N8/R8 -- dos implementaciones independientes de la misma pregunta.
+ Cableado en MENU_CONFIG: "Presupuesto: selector de Modo". devtools/probar_presupuesto_modo.js (nuevo, banco 11). Los once bancos en verde.
! NO TOCADO A PROPOSITO: la columna V, las tablas resumen (C9:F14, C16:F21) y "Guardar Proyeccion" son encargos posteriores.

v0.44.0 (2026-08-24) - Purga de hojas de respaldo acumuladas
+ DEVTOOL_PurgaRespaldos.js (nuevo): "Las 50 hojas de respaldo acumuladas eliminalas. Generan ruido" (Franco). Dos publicas SOLAMENTE -- estadoPurgaRespaldos (solo lectura) y aplicarPurgaRespaldos (borra) -- SIN revertirPurgaRespaldos: es lo unico irreversible de este repo, y la cabecera explica por que no hay un "deshacer" de mentira.
+ Tres patrones de respaldo conocidos, derivados de las constantes REALES de los modulos que los crean (nunca retipeados): FORM_PREFIJO_RESPALDO ('Respaldo formulerio ', compartido por 9 modulos via _respaldarFormulerio), ALTA_PREFIJO_RESPALDO ('Respaldo Plan de Cuentas ', nueva -- antes literal inline en DEVTOOL_AltaCuentas.js) y V031_PREFIJO_RESPALDO ('RESP_REGISTROS_v031_'). Barrido todo src/: aparecieron OCHO prefijos en total; los otros cinco pertenecen a modulos fuera del menu y se dejan afuera a proposito (documentado en la cabecera). 'Cuarentena Plan (<fecha>)' no matchea ningun patron: no es un respaldo, no se toca.
+ TRES GUARDAS: (1) cualquier hoja registrada como VALOR en Document Properties (13 modulos guardan ahi el nombre de su ultimo respaldo para su propio revertir) queda protegida, sin importar la clave; (2) los 3 mas recientes de CADA patron se conservan igual (PURGA_RESPALDOS_N_CONSERVAR, constante visible); (3) ninguna hoja VISIBLE se borra -- los respaldos se crean siempre ocultos, una visible es evidencia de que alguien la destapo a proposito.
* estadoPurgaRespaldos lista EXACTO que se borraria y que se conserva, con el motivo de cada excepcion, y el total de hojas antes/despues. aplicarPurgaRespaldos pide confirmacion con el numero EXACTO de hojas y la advertencia de que no se puede deshacer, y reporta cuantas borro.
+ Cableado en MENU_CONFIG, seccion MANTENIMIENTO: "Purgar respaldos acumulados (IRREVERSIBLE)".
+ devtools/probar_purga_respaldos.js (nuevo, banco 10): filtro probado contra una lista de NOMBRES REALES sacada del gemelo digital (50 respaldos + 10 hojas reales, incluida "Cuarentena Plan (2026-08-18)"), y las tres guardas probadas POR MUTACION -- desactivar cada una y confirmar que el numero a borrar cambia en la direccion esperada, despues restaurar y confirmar que vuelve al baseline. _purgaRespaldosEvaluar gana un segundo parametro opcional (nConservar) SOLO para esta mutacion, sin tocar la constante real (const a proposito).
* DEVTOOL_AltaCuentas.js: el literal inline 'Respaldo Plan de Cuentas ' pasa a ALTA_PREFIJO_RESPALDO (regla SSOT: el prefijo de un respaldo se declara una vez, en el modulo que lo crea).
! Los diez bancos en verde.

v0.43.0 (2026-08-24) - El rango del VLOOKUP del Tipo, reparado (bloque Categorias del Tablero)
- Franco midio en vivo la linea "columna_tipo" del LET de Tablero!AA10: VLOOKUP(columna_aj; 'Plan de Cuentas'!P:P; 2; 0). Le pide la columna 2 a P:P, que tiene UNA sola columna -- #REF!, tapado por el IFERROR. La columna Tipo del bloque "Categorias" no podia mostrar nada, nunca, ni con la columna Q del Plan de Cuentas llena.
* DUENIO: la coordenada la declara RIQ_BLOQUE_CATEGORIAS (DEVTOOL_RiquezaYCategorias.js), pero ese modulo dejo de tocar AA10 el 2026-08-21 (decision de duenio unico, ver su cabecera). El duenio unico de AA10 es DEVTOOL_BloqueCategorias.js: la reparacion entra ahi, como SEGUNDA cirugia de token (_repararRangoTipoBcat) independiente de _reapuntarBloqueCategorias -- esa toca la variable "proyecto" (el agrupamiento), esta toca "columna_tipo" (otra linea del mismo LET). Un solo escritor para toda la celda.
+ _repararRangoTipoBcat deriva el rango correcto de RANGES.PROYECTOS (P:Q, nombre en P / tipo en Q), nunca hardcodeado: probado por mutacion, mutando RANGES.PROYECTOS.end el resultado se mueve con el config.
* estadoBloqueCategorias/aplicarBloqueCategorias ahora corren las DOS cirugias (_diagnosticarBcat) y reportan cual de las dos, si alguna, hace falta. Medido contra el gemelo: la cascada de categoria YA esta aplicada (grupoCambia=false) y solo el rango del Tipo hacia falta (tipoCambia=true). aplicar() relee la FORMA de lo escrito (no solo el texto ni el error de celda, que el IFERROR tapa) para verificar que la reparacion prendio.
+ Nueva _contarCategoriasSinTipoBcat (solo lectura): cuenta, sobre el catalogo vivo, cuantas categorias tienen nombre y no tienen Tipo. estado()/aplicar() lo muestran para avisar que la columna Tipo puede seguir en blanco despues del arreglo -- ya no por formula rota, por catalogo incompleto.
! NO TOCADO A PROPOSITO: la formula tiene una SEGUNDA variable con el mismo bug de rango, "tipo_proy" (linea 7 del LET), pero esta MUERTA -- sin ningun lector, desde que RiquezaYCategorias le saco el filtro que la consumia. Sin lectores no cambia ningun resultado visible: no es el bug que Franco midio.
+ devtools/probar_bloque_categorias.js (nuevo, el modulo no tenia banco propio): corre la reparacion contra la formula REAL del gemelo, prueba que deriva de RANGES por mutacion, que no toca tipo_proy, idempotencia sola y combinada, y _contarCategoriasSinTipoBcat sobre una hoja simulada. Los nueve bancos en verde.

v0.42.1 (2026-08-24) - Cursiva del faltante uniforme en los tres bloques del Tablero
! v0.42.0 SE DESPLEGO Y APLICO BIEN, pero Franco reporto que los tres bloques NO quedaron iguales: en Ingresos la fila separadora y las filas de faltante se ven en cursiva, en Gastos Fijos y Variables no. Medido antes de tocar nada (diagnostico de solo lectura, ya retirado): en Ingresos, SOLO R14:S18 tenian FontStyle ESTATICO 'italic' -- la fila 19 (tambien de faltante) NO estaba en cursiva, la prueba de que el formato quedo pegado a un rango de filas fijo, no al contenido.
+ _construirReglaGrisTfp ahora TAMBIEN llama setItalic(true): la MISMA regla que ya pintaba gris, igual en los tres bloques, asi que la cursiva pasa a seguir al contenido (COUNTIF posicional de siempre) en vez de a una fila fija.
+ FontStyle estatico limpiado GENERICO en los tres bloques (no hardcodeado a Ingresos): el preflight lo detecta por bloque (_hayCursivaEstaticaTfp), aplicar() respalda el rango completo antes de limpiarlo y revertir lo repone exacto (getFontStyles/setFontStyles). Solo toca FontStyle -- color de fuente y negrita estatica quedan intactos.
* _reglasHacenFaltaTfp ahora compara TAMBIEN bold/italic/color (via _hexDeColorTfp), no solo formula+rango: sin esto, la regla gris de v0.42.0 (misma formula, mismo rango, sin italic) pasaba como "ya esta correcta" y un segundo Aplicar nunca la iba a reescribir en la planilla real.
! devtools/probar_tablero_faltante.js: nueva seccion 5c (setItalic en la regla gris + la mutacion del freshness-check) y nueva seccion 7g (deteccion/limpieza de FontStyle estatico, probada con dos bloques a la vez). Los ocho bancos en verde.

v0.42.0 (2026-08-24) - Invariante del faltante corregido (bug de v0.41.0) + seccion real en negrita
! v0.41.0 SE DESPLEGO Y SE AUTOREVIRTIO: la propia verificacion (_verificarInvariantesTfp) atrapo una discrepancia y revirtio todo el lote solo. El guard funciono perfecto; el bug estaba en el invariante, no en la escritura.
- CAUSA: el preflight contaba FILAS del rango de Cuenta como "cuentas reales antes" -- valido en la primera migracion (QUERY cruda, una fila = una cuenta), falso en un UPGRADE (la planilla ya tenia v0.40.0 aplicada, dos secciones sin separador): Ingresos tiene 4 cuentas reales pero el preflight leia 9 (4 reales + 5 de faltante). Comparaba esa cardinalidad contra los 6 nombres distintos del render nuevo -- dos magnitudes distintas por diseno.
+ _nombresRealesVivosTfp (nueva): deriva el "antes" correcto -- el CONJUNTO de cuentas reales -- leyendo la senal que cada estado ya deja en el render vivo (fila separadora si viene de v0.41.0, tipo de dato del Monto si viene de v0.40.0), sin escribir nada y sin evaluar formulas.
* _verificarInvariantesTfp compara por NOMBRE, no por cardinalidad: cada cuenta del "antes" tiene que seguir en el "despues". Probado por mutacion contra el camino de upgrade exacto que fallo en produccion (seccion 8d del banco).
+ LA SECCION REAL PASA A NEGRITA (pedido de Franco en el mismo release): complemento exacto del gris (mismo COUNTIF, condicion contraria), con la fila separadora excluida a proposito y sin pisar formato existente (solo setBold(true)).
! devtools/probar_tablero_faltante.js: seccion 8 reescrita + nueva 8d (upgrade real), nueva seccion 5b (negrita). Los ocho bancos en verde.

v0.41.0 (2026-08-24) - Faltante proyectado: fila separadora explicita + montos numericos
! Franco, sobre la v0.40.0 ya desplegada: "se separe mas lo proyectado de lo ingresado realmente... busca la manera de diferenciarlos mas" y "la columna de monto debe dejarme que, al seleccionar celdas, te de la suma total". La v0.40.0 pasaba los importes de faltante por TEXT() para pintarlos gris con ISTEXT() -- un texto no suma al seleccionarlo, asi que las dos cosas eran el mismo problema.
+ FILA SEPARADORA EXPLICITA entre las dos secciones: rotulo "Faltante proyectado" en la columna Cuenta, Monto vacio, insertada por el mismo mecanismo que ya insertaba la fila de aviso de truncado (una posicion calculada dentro del mismo MAP).
+ LOS MONTOS VUELVEN A SER NUMEROS en las dos secciones (ningun TEXT()): seleccionar celdas de la columna Monto suma en la barra de estado de Sheets.
* EL GRIS PASA A SER POSICIONAL: =COUNTIF($R$9:R9; "Faltante proyectado")>0, con referencia de fila relativa -- en cada fila, el rango va desde el header hasta la fila anterior (estrictamente arriba). Marca todo lo que esta debajo del separador, nunca al separador mismo, incluida la cuenta sin ningun movimiento real (aparece una sola vez, siempre debajo del separador).
* UPGRADE VERSION-PROOF: _anclaYaEsNuestraTfp se generaliza para reconocer CUALQUIER version ya aplicada (v0.40.0 o v0.41.0), y una comparacion nueva (anclaVigente) decide si hace falta reescribir comparando la formula viva contra la que este modulo generaria hoy. Sin esto, desplegar sobre la planilla real (que hoy tiene v0.40.0 aplicada) nunca la hubiera actualizado.
* PEOR CASO BAJA DE 10 A 9 CUENTAS: la fila separadora consume una de las veinte filas de datos cuando hay al menos una cuenta con faltante (capacidad_datos; IF(cant_faltante > 0; 19; 20)).
- S8/V8/Y8 HEREDAN EL FORMATO DE MONEDA de su hermano real S7/V7/Y7, copiado en vivo con getNumberFormat() (nunca inventado): corrige el bug reportado de totales de faltante sin formato de moneda.
* El conteo de "nombres distintos" de _verificarInvariantesTfp EXCLUYE el rotulo de la fila separadora (no es una cuenta; sin la exclusion podia enmascarar una cuenta real perdida por exactamente uno).
! devtools/probar_tablero_faltante.js: banco reescrito. Nueva seccion 2c (upgrade version-proof contra un fixture v0.40.0 reconstruido a mano), seccion 5 reescrita (simulador con separador + simulador de la regla COUNTIF, prueba por mutacion que el separador nunca se marca a si mismo y que la cuenta sin movimiento real si se marca, montos siempre numericos), nueva seccion 10 (copia de formato de numero). Los ocho bancos del repo en verde.
v0.40.0 (2026-08-21) - Faltante proyectado: dos secciones, no una fila intercalada; totales por construccion
! aplicarTableroFaltanteProyectado() se corrio en la planilla real (v0.39.0, layout intercalado) y la propia verificacion lo atrapo y revirtio solo: "el total real paso de 1.138.583 a 3.218.368,47" en Ingresos (exactamente real + faltante), mismo patron en Gastos Fijos y Variables. Causa medida: los totales usaban SUMIF(rango;"<>"/"=";monto) para separar filas con/sin nombre de cuenta, y en Sheets ese criterio a secas NO compara el VALOR contra "" -- pregunta si la celda "tiene contenido" (formula o dato). Una celda de DERRAME que muestra "" (el resultado de una formula, no un vacio real) cuenta como "con contenido": TODAS las filas caian del lado "<>", el total real sumaba las dos columnas y el de faltantes daba cero siempre. El banco daba VERDE con esto roto: su mock en JS solo puede representar "" como string, sin la distincion Sheets-especifica entre celda vacia de verdad y celda con formula que devolvio ''.
! ADEMAS, Franco cambio el diseno de destino a mitad de la correccion: NO es una fila real y una fila de faltante intercaladas por cuenta. Son DOS SECCIONES dentro del bloque -- arriba TODO lo real, abajo TODO lo faltante, REPITIENDO el nombre de la cuenta (no lo deja vacio). Eso mata la ambiguedad vacio/cadena-vacia de raiz (ninguna fila de Cuenta esta vacia nunca), pero tambien mata el unico dato que los totales viejos usaban para separarse.
+ LOS TOTALES SE CALCULAN POR CONSTRUCCION, nunca releyendo el derrame. S7 (total real) es SUM(INDEX(<QUERY real de Franco, verbatim>;0;2)): suma directo la columna 2 de la QUERY de Franco, la MISMA cifra de siempre -- el invariante "el total real no se mueve" se cumple por construccion, no por coincidencia. S8 (total faltante) reusa el MISMO bloque LET que arma el derrame (_bloqueComunTfp, UNA sola funcion JS: las dos formulas de Sheets no pueden desincronizarse) y suma el faltante sobre el UNIVERSO COMPLETO, no solo lo que entra en pantalla.
+ EL GRIS DE LA SECCION DE FALTANTE ya no puede colgar de "el nombre esta vacio" (esa senal desaparecio) ni de "es la 2da+ vez que aparece este nombre" (COUNTIF de duplicados, evaluado y descartado: una cuenta proyectada SIN ningun movimiento real aparece UNA SOLA VEZ, siempre en la seccion de faltante -- un COUNTIF de duplicados nunca la marca). La senal elegida es el TIPO DE DATO de la celda de Monto: la seccion real escribe un NUMERO, la de faltante el mismo importe pasado por TEXT() (mismo patron que la celda ya tenia en vivo, leido en el preflight). La regla pasa a ser =ISTEXT($S10): no depende de otra columna, no tiene la ambiguedad del SUMIF, y separa las dos secciones sin excepcion. Limitacion aceptada y documentada: un numero-como-texto se alinea a la izquierda por defecto; ajuste manual de alineacion si molesta (Formato > Alinear > Derecha), no automatizado a proposito (evita mutar/respaldar una propiedad de formato mas).
+ LA CAPACIDAD SE RELAJA SOLA: ya no son "10 pares cuenta/faltante" fijos. Las 20 filas de datos (10 a 29, _capacidadFilasTfp) se reparten dinamico -- una cuenta ya cubierta (faltante = 0) ocupa UNA sola fila, no dos. El peor caso garantizado sigue siendo 10 cuentas (si TODAS tuvieran faltante pendiente); en la practica entra mas.
* Sin cambios de principio: la QUERY real de Franco se reusa verbatim, lo proyectado se calcula fresco desde "Proyeccion" agrupado por cuenta, faltante = MAX(0; proyectado - real), una cuenta proyectada sin movimiento real sigue apareciendo (razon de ser del modulo, confirmado explicitamente para el layout nuevo), nunca se aborta por falta de lugar (trunca a la vista y avisa en la fila 30, en cursiva).
! devtools/probar_tablero_faltante.js: reescrito para las dos secciones. Incluye el diagnostico permanente del bug real (evaluador SUMIF-like que reproduce el sintoma exacto medido en la planilla), la prueba de reuso byte-a-byte del bloque comun entre la ancla y el total de faltantes, la extraccion de la QUERY embebida para una segunda corrida (_extraerTablaRealTfp), y el simulador del algoritmo (simularSeccionesTfp) que prueba por mutacion la senal del gris: confirma que ISTEXT marca correctamente a una cuenta sin movimiento real y que la alternativa descartada (COUNTIF de duplicados) NO la habria marcado. 1 falla preexistente sin cambios (colision R10/U10/X10 con DEVTOOL_FormulerioV0111.js y DEVTOOL_StockYFlujo.js, aceptada desde v0.38.0).
NOTA: sesion en paralelo detectada en el mismo worktree (src/DEVTOOL_DIAG_Desplegables.js, entrada de menu temporal en 00_Config.js, celdas.tsv refrescado) -- no tocada por este cambio, reportada a Franco sin intentar reconciliarla.
v0.39.1 (2026-08-21) - Duenio unico por celda: se retiran 9 coordenadas stale, 8 bancos en verde
- decision Franco 2026-08-21, dos decisiones tomadas juntas: (1) retirar las coordenadas que un
  modulo declara administrar y ya administra otro, y (2) duenio unico para las celdas que tres
  modulos se disputaban.
- FORM_CELDAS pasa de 13 a 7 entradas. Retiradas: Inicio!F8 y Tablero!AG9:AG12 (las escribe
  DEVTOOL_StockYFlujo.js), Tablero!AF9:AF12 (vacias; el bloque real vive en AF18:AF21),
  Tablero!N19 (vacia; la escribe DEVTOOL_Capitalizacion.js en O19), Tablero!R10/U10/X10 y AA10
  (por duenio unico). AG9:AG12 no era ruido: con literal:true este modulo le aplicaba su reemplazo
  a una formula VIVA y AJENA (el bloque "Tipo de Medios").
- RIQ_CELDAS pasa de 6 a 0. Con AA10 tambien retirada, DEVTOOL_RiquezaYCategorias.js NO ADMINISTRA
  NINGUNA CELDA: sus publicas lo dicen explicito en vez de contestar "nada que hacer". Sacarlo del
  menu y del repo es una decision aparte, PENDIENTE de Franco -- es retirar un modulo, no reapuntar
  una coordenada.
- Duenio unico: R10/U10/X10 -> DEVTOOL_TableroFaltanteProyectado.js (las reescribe empotrando la
  QUERY de Franco). DEVTOOL_StockYFlujo.js se queda a proposito: hace cirugia de token y respeta el
  envoltorio de TFP corra en el orden que corra. AA10 -> DEVTOOL_BloqueCategorias.js, el unico con
  trabajo vigente ahi.
- CORREGIDO un comentario falso: la cabecera de DEVTOOL_RiquezaYCategorias.js afirmaba que AA10 era
  "EXCLUSIVA de este modulo (ningun otro la escribe)" mientras otros dos la declaraban.
- BANCOS: probar_formulerio 5 FALLA(S) -> SIN FALLAS; probar_riqueza 7 -> SIN FALLAS;
  probar_tablero_faltante 1 -> TODO OK. Los 8 en verde por primera vez. Dos guards nuevos, ambos
  verificados por mutacion: un tripwire que falla si vuelve a entrar una coordenada a RIQ_CELDAS, y
  CONVIVENCIA_OK en la barrida anti-colision -- permiso EXPLICITO por modulo Y por celda, no un
  silenciador (se probo que un modulo no autorizado, y el autorizado sobre una celda fuera de su
  permiso, siguen saliendo como choque).
- REPORTADO, NO RESUELTO: Inicio!C13/F13 las comparten FORM_CELDAS y SYF_ARRASTRE, e Inicio!C15/F15
  FORM_CELDAS y DEVTOOL_InicioPresupuesto.js. Conviven hoy (las tres transformaciones son de token)
  pero no entraron en la decision de duenio unico.

v0.39.0 (2026-08-21) - El bloque de faltante proyectado sube a 30 filas y deja de abortar por falta de lugar
! El preflight de DEVTOOL_TableroFaltanteProyectado.js abortaba si habia mas cuentas reales que lugar ("Agrandar el bloque antes de correr esto"). Medido en la planilla: Gastos Variables tenia 10 cuentas para una capacidad de 9 -- Franco se quedaba sin la funcionalidad entera por una cuenta de mas. Ahora la formula TRUNCA sola a las cuentas de mayor monto y la ultima fila del bloque avisa (en cursiva) cuantas quedaron afuera y por cuanta plata. Esa fila desaparece sola cuando todo entra.
+ TFP_FILA_FIN (30) es la unica fuente de la geometria del bloque (antes cada uno de los tres bloques repetia "filaFin: 28" por separado): 21 filas -> 10 pares cuenta/faltante y sobra exactamente una, la que ocupa el aviso.
+ Los totales y la regla gris de "falta" excluyen esa fila reservada (si no, el monto oculto del aviso se sumaria como si fuera una cuenta real de mas). La regla de aviso es una cuarta regla por bloque, absoluta, sobre esa unica fila.
* Las cuentas proyectadas sin movimiento real real siguen apareciendo (decision Franco: es la razon de ser del modulo) y el orden por monto real descendente ya las manda al final -- son las primeras en truncarse si no entran todas.
* estadoTableroFaltanteProyectado() reporta numeros: cuantas cuentas reales por bloque, cuantas entran, cuantas quedarian afuera.
- _verificarInvariantesTfp pasaba a exigir igualdad estricta entre el conteo de cuentas antes y despues; eso rompia apenas el universo union-con-catalogo sumaba una cuenta proyectada-sin-real de mas. Ahora exige un PISO sin truncar y un numero EXACTO con truncado (garantizado por el orden real-primero).
! devtools/probar_tablero_faltante.js: capacidad y rangos actualizados, mas las mutaciones del truncado (no aborta, exacto en el limite, una cuenta menos, conteo exacto vs piso). 1 falla preexistente sin cambios (colision R10/U10/X10 con DEVTOOL_FormulerioV0111.js, aceptada desde v0.38.0).
v0.38.4 (2026-08-21) - El modulo seguia leyendo R9/U9/X9 mientras su banco probaba R10/U10/X10
- La v0.38.0 corrigio el corrimiento de fila del Tablero en FORM_CELDAS, RIQ_BLOQUE_CATEGORIAS y
  BCAT_CELDA, y actualizo la seccion 5 de devtools/probar_stock_flujo.js a R10/U10/X10 -- pero NO
  toco DEVTOOL_StockYFlujo.js, que es el modulo que esa seccion prueba. El modulo siguio leyendo
  R9/U9/X9 (el header "Cuenta", sin formula) y saliendo por un aviso mudo, "no tiene formula: se
  saltea". La transformacion del arrastre dejo de aplicarse a las tres columnas del Tablero con el
  banco en verde: el banco tenia su propia copia de las coordenadas y solo se actualizo esa.
- SYF_ARRASTRE (nueva): la lista sale del modulo, con el rotulo de cada celda al lado, y
  _preflightSyf la verifica por rotulo y aborta si no coincide. El banco deriva su seccion 5 de
  esta constante en vez de repetirla, asi que modulo y banco no pueden volver a divergir.
- "Sin formula" con el rotulo correcto deja de ser un aviso mudo: nombra la celda y dice que la
  transformacion no se aplico.
- devtools: los 6 bancos que hardcodeaban la ruta absoluta de un worktree ahora derivan RAIZ de
  __dirname (la convencion que probar_tablero_faltante.js ya usaba). Corridos desde otro worktree
  validaban el src de gracious-kalam, no el que se estaba editando.
- Verificado por mutacion: con SYF_ARRASTRE de vuelta en R9/U9/X9 el banco acusa 3 FALLA(S)
  nombrando la celda y su contenido real ("hoy tiene 'Cuenta'"). NO SE DESPLEGO.

v0.38.3 (2026-08-21) - El guard de las auxiliares se bloqueaba a si mismo en la segunda corrida
! Con el modulo ya aplicado, correr "2. Aplicar" de nuevo abortaba en el preflight con "las celdas auxiliares (AW8, AW9, AW10) no estan vacias". Medido contra el gemelo: esa zona no tenia ningun intruso -- tenia el PROMEDIO que la propia corrida anterior habia calculado (el derrame del HSTACK de _tendenciaYPromedioIp). El guard pedia la zona VACIA sin excepcion y se mordia la cola contra su propio resultado.
- _auxAjenaIp / _auxiliaresAjenasIp (nuevas, DEVTOOL_InicioPresupuesto.js) reemplazan el chequeo "sin formula y con valor" por uno que distingue PROPIO de AJENO: reconocen "mia" por la FORMULA de la celda ANCLA (AV8/AV9/AV10), nunca por el valor derramado en el promedio (AW8/AW9/AW10). Esta zona es exclusiva de este modulo, asi que CUALQUIER formula en el ancla -- sea cual sea su texto -- solo pudo haberla puesto una corrida anterior propia; no hace falta comparar contra el texto exacto de _formulaAuxCapitalIp/_formulaAuxFlujoIp de HOY. Misma leccion que _esFormulaDeDeltaIp ya aplico del lado del color en v0.38.2.
* El promedio NUNCA tiene formula propia (HSTACK no la deja): si la tuviera, es ajeno SIEMPRE, sin importar el estado del ancla. El preflight sigue abortando, con el mismo detalle, ante contenido genuinamente ajeno.
! probar_inicio_presupuesto.js (14, nueva): reproduce el bug (guard viejo bloqueado contra la salida real de una corrida anterior), confirma que el fix no bloquea ese caso ni el de una formula pesada de forma futura, y verifica por mutacion que aflojar la deteccion a "texto exacto" o quitar el chequeo del promedio deja de proteger contra contenido ajeno de verdad.

v0.38.2 (2026-08-21) - Dos deltas quedaban con el color invertido: reglas de v0.34.0 sobrevivian mudas
! Ingresos cayo 52,7% y se pintaba VERDE; Egresos cayo 50,5% y se pintaba ROJO -- las dos al reves (Capital bien). Causa: sobre C15/F15 convivian CUATRO reglas de color en vez de dos, dos de v0.34.0 (=$C$15>0/<0, evaluaban la celda visible) mas las dos correctas de hoy (=$AV$9>0/<0, evaluan la auxiliar). En Sheets un texto compara SIEMPRE mayor que cualquier numero: desde que C15/F15 son texto (v0.37.0), "=$C$15>0" da VERDADERO sin condicion y, por ir primera en el orden, le gana a la regla correcta.
- _clasificarReglasIp solo reconocia como "propia" la lista EXACTA de las seis formulas de la generacion vigente; las de v0.34.0 no matcheaban, caian en "ajenas" y aplicarIp las reponia intactas en cada corrida -- huerfanas para siempre. Mismo bug de identificacion que _esReglaPropiaFmt ya documenta en DEVTOOL_FormatoMedios.js, mismo dia, otro modulo.
* _esFormulaDeDeltaIp (nuevo) reconoce por PATRON: comparacion contra cero de UNA sola referencia de celda (=$COL$FILA>0 o <0), sin importar a que celda apunte. Cubre la generacion de hoy y la de v0.34.0 por igual, y a cualquier generacion futura si la auxiliar vuelve a mudarse de columna.
! Las reglas de generacion anterior se barren al aplicar y NO se reponen al revertir -- a diferencia de las "superadas" (texto contiene, preferencia de estilo de Franco que se fotografia y se repone), una regla de generacion anterior de este mismo mecanismo evalua HOY una celda de texto y da un falso positivo permanente: reponerla en un revert reintroduciria el bug. Documentado inline en ambos puntos.
! probar_inicio_presupuesto.js (11b) nunca junto dos generaciones de reglas sobre la MISMA celda de delta -- por eso el bug no lo agarro. Se agrega la reconstruccion exacta (2 reglas de v0.34.0 + 2 de hoy sobre C15) verificada por mutacion: las cuatro clasifican como propias y _reglasHacenFaltaIp da true; mas una asercion sobre el hecho de Sheets que hace esto peligroso (>0/<0 contra texto no falla, da verdadero/falso sin avisar) confirmada contra las seis formulas reales que el modulo escribe.

v0.38.1 (2026-08-21) - El patron con coma decimal era al reves; las auxiliares se veian
! La corrida de v0.37.0 salio mal en la planilla real: "82,0%" se vio "133%", "$211.073,04" se vio "$211.073,04333", "$16.725,60 inyectados" se vio "$16.725,6000". Revertida con revertirInicioPresupuesto(); esta version arregla los dos defectos.
- El comentario que justificaba el patron con coma decimal ("TEXT() SI es sensible al locale") era FALSO -- tercera vez en el dia que una afirmacion sobre locale sin medir cuesta un bug (v0.32.2, v0.33.0). Medido en vivo por setFormula: TEXT() se comporta EXACTAMENTE como setNumberFormat, patron SIEMPRE canonico (punto decimal, coma de miles), sin excepcion. IP_PATRON_PORCENTAJE '0,0%'->'0.0%'; IP_PATRON_MONEDA '$#.##0,00'->'$ #,##0.00'.
- Las auxiliares de los tres deltas (AV8:AW10) quedaban visibles a la derecha del lienzo de Inicio. _ocultarAuxiliaresIp() les da el mismo tratamiento que los otros dos motores de la hoja (columnas ocultas); revertir las destapa solo si fue este modulo el que las oculto.
! probar_inicio_presupuesto.js daba SIN FALLAS con el patron equivocado: solo comprobaba que la constante fuera igual a si misma. Aserciones nuevas verifican la PROPIEDAD (sin coma en el porcentaje, punto decimal en la moneda). Verificado por mutacion: revertir al patron con coma hace fallar el banco en las 4 lineas correctas.

v0.38.0 (2026-08-21) - Cuatro direcciones se corrieron una fila; los bancos ahora lo notan solos
! Franco reacomodo el Tablero a mano para dejar lugar al "Faltante proyectado" (v0.36.0): el header de los cuatro bloques de agregacion bajo de la fila 8 a la 9 y el derrame de datos de la 9 a la 10. Corregido por rotulo (nunca por coordenada memorizada) en FORM_CELDAS/RIQ_BLOQUE_CATEGORIAS/BCAT_CELDA: R9->R10, U9->U10, X9->X10, AA9->AA10, AB8->AB9, L28->L29.
+ Preflight por rotulo nuevo en DEVTOOL_FormulerioV0111.js (_verificarRotulosFormulerio) y DEVTOOL_BloqueCategorias.js (_preflightRotuloBcat): abortan ruidosamente si el rotulo vivo no coincide con lo esperado. Verificado por mutacion.
- Investigado, no inventado: Tablero!N19 esta vacia -- quedo obsoleta el 2026-08-20 cuando DEVTOOL_Capitalizacion.js paso a escribir ese concepto en O19. Tablero!AG9:AG12 e Inicio!F8 (RIQ_CELDAS) tampoco son trabajo de este modulo: DEVTOOL_StockYFlujo.js y DEVTOOL_InicioPresupuesto.js ya los administran en otras coordenadas. Documentado inline, RIQ_CELDAS no se edita sin decision de Franco.
- _conTipoEnCategorias ya no explota con una celda sin formula (mismo criterio que _repararFormula v0.36.1): devuelve la entrada intacta.
! "La celda que el modulo declara administrar no tiene formula" deja de ser benigno en probar_stock_flujo.js, probar_riqueza.js y probar_formulerio.js: ahora es FALLA con la celda y que se encontro en su lugar. probar_formulerio.js pasa a 5 FALLA(S) fijas (los stale de arriba) hasta que se retiren o Franco los de por buenos: es la senal funcionando, no una regresion.
+ Hallazgo nuevo sin resolver: la barrida anti-colision de probar_tablero_faltante.js acusa que DEVTOOL_FormulerioV0111.js y DEVTOOL_TableroFaltanteProyectado.js nombran las mismas R10/U10/X10. Hoy es inocuo (verificado), pero fragil; queda para que Franco decida.

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
