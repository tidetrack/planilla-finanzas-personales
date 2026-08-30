/**
 * DEVTOOL_PresupuestoGuardar.js
 * Tercera y ultima etapa de la hoja "Presupuesto": el guardado a la base de datos. Toma
 * "Monto a Proyectar" (K/O/S, lo que Franco escribe a mano) para el periodo de J2/J3 y lo
 * appendea a "Proyeccion" -- con las cotizaciones del dia CONGELADAS como valor -- para que el
 * Tablero pueda medir contra una proyeccion deliberada, no solo contra el promedio historico.
 *
 * [CONCEPTO DE NEGOCIO]
 * Las etapas 1 y 2 (DEVTOOL_PresupuestoModo.js v0.45.1, DEVTOOL_PresupuestoResumen.js v0.46.1,
 * ambas desplegadas) le dan a Franco lo que necesita para DECIDIR: el mes de referencia, el
 * promedio ponderado, el agrupado por categoria. Esta etapa cierra el circuito: Franco escribio
 * K8/O8/S8/W8 en pantalla, y hay que persistir exactamente eso en la BD ("Proyeccion") para que
 * el Tablero (DEVTOOL_TableroFaltanteProyectado.js) y la hoja Inicio (DEVTOOL_InicioPresupuesto.js,
 * _formulaPresupuestoIp) tengan, mes a mes, contra que medir la realidad. Sin esto "Guardar
 * Proyeccion" no existe y Franco no tiene forma de dejar un compromiso escrito.
 *
 * Franco, textual: "Dale con Guardar Proyeccion, con las cotizaciones congeladas. Esto dejalo
 * como funcionalidad por ahora en tidetrack dev. Luego va a tener su boton." -- por eso este
 * modulo SOLO se cablea en el menu tidetrack Dev (ver 00_Config.js MENU_CONFIG.DEV_ITEMS): CERO
 * botones nuevos en la hoja "Presupuesto". "Luego, en el menu deberiamos poder hacer el ABM de
 * proyecciones elaboradas" -- el ABM es un encargo POSTERIOR, pero condiciona el diseno de ESTE
 * modulo: el marcado que usa (ver decision 3) es justamente lo que el ABM va a necesitar para
 * poder listar/editar/borrar por periodo. Se disena para ese consumidor futuro sin construirlo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO, respaldo verificado antes de mutar,
 * verificacion del VALOR resultante (invariante independiente, no solo del texto), reversion
 * completa. Regla Estricta 9 (00_Config.js / CLAUDE.md): un fallo de la API de cotizaciones
 * NUNCA se silencia -- ver decision 1.
 *
 * ============================================================================
 * DECISION 1 -- LAS COTIZACIONES CONGELADAS (el punto del encargo)
 * ============================================================================
 * Medido antes de construir (DISENO_HOJA_PRESUPUESTO.md, "Un hueco conocido"): "Proyeccion" tiene
 * 4 celdas con contenido en J:M contra 13.916 en "Registros" -- es un volcado batch del
 * 2026-08-20 (DEVTOOL_PresupuestoBase.js) que deja las columnas TC VACIAS a proposito, porque un
 * mes que todavia no ocurrio no tiene cotizacion propia. Consecuencia: hoy una proyeccion en
 * USD/AUD/EUR no se puede reconvertir con la cotizacion del dia en que se proyecto.
 *
 * Este modulo cierra ese hueco PARA LAS FILAS QUE ESCRIBE (no para las de PresupuestoBase, que
 * quedan como estaban -- ver decision 4): antes de escribir una sola fila, se leen las tres
 * custom functions DIRECTO como funciones de Apps Script -- `TIDETRACK_USD()`, `TIDETRACK_AUD()`,
 * `TIDETRACK_EUR()`, nunca como formula de celda -- y el resultado se pega como VALOR NUMERICO en
 * J:M de cada fila nueva (ARS=1 siempre, la moneda base). "Nunca como formula de celda" es la
 * unica forma de evitar la trampa de "Loading..." documentada en el encargo: una custom function
 * SI puede devolver el string literal "Loading..." la primera vez que el motor de Sheets la
 * recalcula en una CELDA (mientras la llamada asincrona a la API todavia no volvio) -- pero
 * llamada como funcion JS comun desde Apps Script, ejecuta sincronicamente y devuelve el numero
 * o LANZA. No hay tercera opcion, y por eso no hay "Loading..." que esperar. Es el mismo patron
 * que ya usa `_tasasPb()` en DEVTOOL_PresupuestoBase.js (`Number(TIDETRACK_USD())`) para su
 * balance multi-moneda -- reusado a proposito, no reinventado.
 *
 * "Nunca silenciar un fallback de la API de cotizaciones" (Regla Estricta 9) se cumple por
 * construccion: `fetchArsRate`/`fetchInternationalRates` (15_ExchangeRateApi.js) LANZAN ante
 * cualquier fallo real (HTTP distinto de 200, serie vacia, JSON invalido), y esa excepcion sube
 * sin capturar hasta el catch de `aplicarGuardarProyeccion`, que revierte lo que ya se haya
 * escrito y termina en "NO APLICADO". No hay ninguna rama que escriba una fila con TC en blanco o
 * inventado: si la cotizacion no se puede obtener, NO se escribe nada -- exactamente el hueco que
 * este encargo pide cerrar, no repetirlo.
 *
 * UNA SOLA LLAMADA POR CORRIDA, no una por fila ni una por moneda de cada cuenta: "congelada" es
 * la cotizacion "del momento del guardado" (un instante), no la de cada fecha de movimiento como
 * hace `procesarCargas` (que factura fecha por fecha porque el ledger tiene fechas reales
 * distintas). Aca TODAS las filas de una misma corrida representan la MISMA decision tomada en el
 * MISMO momento, asi que comparten el MISMO vector de cuatro tasas.
 *
 * ============================================================================
 * DECISION 2 -- LA FECHA DE CADA FILA
 * ============================================================================
 * decision: el PRIMER DIA del mes proyectado (`new Date(anio, mesIndex, 1)`), igual que ya hace
 * `DEVTOOL_PresupuestoBase.js` (`m.mes` en `_matrizPb`). No es una eleccion nueva: es alinearse
 * con la convencion que YA existe en la misma hoja de destino, para que las dos fuentes de
 * "Proyeccion" (el promedio historico y el guardado manual) sean indistinguibles en su columna
 * Fecha y una futura consulta por mes no tenga que tratarlas distinto.
 *
 * VERIFICADO, no asumido, contra los DOS consumidores reales de "Proyeccion" antes de fijar la
 * convencion:
 *   - `_formulaPresupuestoIp` (DEVTOOL_InicioPresupuesto.js, linea ~518): `desde=DATE(anio,mes,1)`,
 *     `hasta=EOMONTH(desde;0)`, filtra `fecha>=desde` Y `fecha<=hasta`.
 *   - `_bloqueComunTfp` (DEVTOOL_TableroFaltanteProyectado.js, linea ~611): el MISMO patron,
 *     `desde`/`hasta` identicos, mismo filtro de rango inclusivo sobre el mes entero.
 * Los dos filtran por RANGO DE MES completo, nunca por igualdad de fecha exacta: CUALQUIER dia
 * dentro del mes cae en el filtro. El primer dia no es la unica opcion que funciona -- es la que
 * coincide con lo que la hoja ya escribe, y evita que "Proyeccion" tenga dos convenciones de
 * fecha (dia 1 para el base historico, otro dia cualquiera para el guardado manual) sin que
 * ningun consumidor actual lo distinga pero que confundiria a cualquiera que audite la hoja a
 * mano o construya el ABM.
 *
 * ============================================================================
 * DECISION 3 -- EL MARCADO (pensado para el ABM que viene despues)
 * ============================================================================
 * La columna Nota de cada fila nueva lleva:
 *
 *     "<PG_MARCA> <clave-de-periodo> <sello>"   ej. "Presupuesto guardado 2026-09 2026-08-25_1430"
 *
 * Tres piezas, cada una con un trabajo distinto:
 *   - PG_MARCA ("Presupuesto guardado"): identifica el ORIGEN -- distingue estas filas de las de
 *     PB_MARCA ("Presupuesto base historico", DEVTOOL_PresupuestoBase.js) con un `indexOf(...)===0`
 *     que nunca puede confundir una con la otra (los dos textos no son prefijo uno del otro).
 *   - clave-de-periodo ("2026-09", `anio-mes` con cero a la izquierda): identifica el PERIODO.
 *     Es lo que permite encontrar "todas las filas de la proyeccion GUARDADA A MANO de septiembre
 *     2026" con un solo `indexOf(prefijo)===0` sobre la Nota -- sin este campo, el marcado solo
 *     distinguiria "generado por este modulo" de "generado por el otro", nunca UN periodo de otro,
 *     y dos guardados de meses distintos se pisarian entre si al buscar por prefijo.
 *   - sello (fecha_hora de la corrida): "guardada el dia Y". No participa de ninguna busqueda por
 *     prefijo (esas usan solo PG_MARCA+clave); es la traza de CUANDO se tomo esa decision,
 *     visible a simple vista en la hoja.
 *
 * POR QUE ESTO ALCANZA PARA EL ABM (Franco: "en el menu deberiamos poder hacer el ABM de
 * proyecciones elaboradas"): un ABM necesita, como minimo, (a) LISTAR los periodos guardados --
 * se arma escaneando Nota por el prefijo `PG_MARCA+' '` y agrupando por la clave que sigue; (b)
 * EDITAR/BORRAR un periodo puntual -- se arma filtrando por `PG_MARCA+' '+clave+' '` exacto, la
 * MISMA funcion que ya usa este modulo para su propia idempotencia (`_filasPorNotaPrefijoPg`,
 * reusada sin cambios). El ABM no tiene que inventar ninguna busqueda nueva: hereda las dos que
 * este modulo ya construyo y verifico.
 *
 * SE EVALUO usar una columna nueva en vez de Nota (por ejemplo, IMPORTRANGE-visible o una columna
 * oculta con JSON): se descarta porque "Proyeccion" es un espejo EXACTO de "Registros" (columnas
 * B:M, verificado por `_preflightPb` antes de escribir), agregar una columna romperia ese espejo
 * y forzaria a re-versionar TODOS los consumidores existentes (incluido `procesarCargas`, que
 * jamas deberia enterarse de que "Proyeccion" existe). Nota ya es texto libre, ya la usa
 * PresupuestoBase con el mismo patron (`marca + ' ' + sello`), y ya demostro alcanzar en
 * produccion (364 filas, un ano de operacion). Extenderla con una clave de periodo es continuar
 * un patron probado, no inventar uno nuevo.
 *
 * ENMIENDA A LA DECISION 3 (2026-08-29) -- CONTRATO DE NOTAS DE "Proyeccion", DEFINITIVO
 * "Proyeccion" recibe filas de CUATRO origenes, cada uno con su forma de Nota, discriminables
 * sin ambiguedad:
 *   1. Base historico  (DEVTOOL_PresupuestoBase.js):  "<PB_MARCA> <sello>" -- sin clave; el
 *      periodo vive en la columna Fecha.
 *   2. Guardado PG     (este modulo):                 "<PG_MARCA> <clave> <sello>", con sello
 *      yyyy-MM-dd_HHmmss (solo digitos/guiones/underscore; matchea /^\d{4}-/). Nada despues
 *      del sello.
 *   3. Shell puntual   (16_ShellService.js, _filaDeProyeccion):
 *      "<PG_MARCA> <clave> shell_<yyyy-MM-dd_HHmmss>[<mmm>][ <nota libre>]" -- el tercer token
 *      SIEMPRE empieza con "shell_". VINTAGE: los 3 digitos de milisegundos existen desde
 *      v0.59.0; el shell desplegado en v0.56.0-v0.58.0 escribia el sello SIN milisegundos y
 *      esas filas historicas viven en produccion. Todo clasificador del contrato acepta ambos
 *      vintages (6 o 6+3 digitos tras la fecha).
 *   4. Recurrentes     (17_RecurrentesService.js):
 *      "<REC_MARCA> <clave> <sello> - <nombre>[: <nota>]", con REC_MARCA='Gasto recurrente'.
 * INVARIANTES del contrato:
 *   - El discriminador PG-vs-shell es el TERCER TOKEN (lo que sigue a "<PG_MARCA> <clave> "):
 *     empieza con "shell_" => fila del shell; empieza con digito => guardado de este modulo.
 *     `_selloPg` jamas puede producir algo que empiece con "shell_", y el shell jamas puede
 *     producir un sello que no lo haga.
 *   - "shell_" NO se comparte como const de nivel superior entre archivos (cicatriz v0.50.1,
 *     orden alfabetico de carga: 16_ carga antes que DEVTOOL_): es un literal documentado en
 *     ambos lados con @see cruzado.
 *   - REC_MARCA y PB_MARCA quedan fuera de todo retiro por prefijo de este modulo, porque sus
 *     marcas son distintas de PG_MARCA (verificado: ninguna es prefijo de otra).
 *   - "Propia" para el RETIRO (2026-08-29, segunda vuelta) = prefijo exacto de periodo Y resto
 *     que sea EXACTAMENTE un sello /^\d{4}-\d{2}-\d{2}_\d{6}$/ sin cola: la MISMA regla
 *     'guardado' del ABM (@see DEVTOOL_ProyeccionAbm.js, _origenNotaPa). Una nota con marca PG
 *     pero forma irreconocible (cola tras el sello, sello raro: solo alcanzable editando la
 *     Nota a mano) NO se retira nunca -- queda visible y borrable como 'otros' en el ABM, y
 *     este modulo la anuncia como linea informativa en estado/confirm. Antes el retiro era
 *     permisivo (todo lo que no fuera "shell_") y una fila que el ABM le mostraba a Franco
 *     como 'origen no reconocido' desaparecia en el proximo Guardar: dos superficies con
 *     reglas distintas sobre la misma fila.
 *   - ASIMETRIA DELIBERADA del discriminador shell (2026-08-29, NO "corregir" alineando un
 *     lado): `_esNotaShellPg` es LAXO (tercer token que EMPIECE con "shell_") porque su unico
 *     trabajo es EXCLUIR del retiro y contar para el confirm -- el lado que borra nunca debe
 *     borrar de mas; `_origenNotaPa` (ABM) es ESTRICTO (regex completo del sello) porque su
 *     trabajo es CLASIFICAR -- lo dudoso degrada a 'otros', visible y con camino de baja.
 *     Alinear el retiro al criterio estricto borraria de mas ante un drift del formato;
 *     alinear el clasificador al laxo disfrazaria notas invalidas de shell. Cada lado erra
 *     hacia su lado seguro.
 * Consecuencia operativa (retiro SELECTIVO, 2026-08-29): la idempotencia de este modulo retira
 * SOLO sus filas propias (`_filasGuardadoPropioPg`, forma estricta de sello) mas las PB del
 * periodo (decision 4). Las puntuales del shell del mismo mes, el volcado de recurrentes
 * (REC_MARCA) y las PG de forma irreconocible NUNCA se tocan: conviven sumando (las dos
 * primeras) o esperan su baja via ABM (la tercera), y por eso el invariante post-escritura
 * verifica SOLO las filas propias -- el total del mes en "Proyeccion" puede ser mayor que
 * K8/O8/S8 si hay puntuales del shell o recurrentes (semantica decidida: "el shell suma").
 * @see 16_ShellService.js (_filaDeProyeccion, registrarProyecciones)
 *
 * ============================================================================
 * DECISION 4 -- CONVIVENCIA CON EL PRESUPUESTO BASE HISTORICO
 * ============================================================================
 * `DEVTOOL_PresupuestoBase.js` ya carga en "Proyeccion" un promedio movil de 6 meses para los
 * ultimos `PB_MESES_DESTINO`=7 meses (incluido el mes en curso), marcado con `PB_MARCA`. Si
 * Franco guarda a mano la proyeccion de un mes que el base YA cubre, sin intervenir habria DOS
 * proyecciones para el mismo mes y el Tablero las sumaria a las dos -- un numero que no es ni el
 * base ni el deliberado, sino los dos juntos.
 *
 * decision: LA PROYECCION HECHA A MANO GANA. Al guardar el periodo X, este modulo retira (borra)
 * las filas `PB_MARCA` de "Proyeccion" cuya fecha cae DENTRO del mes X, ademas de sus propias
 * filas `PG_MARCA` previas del MISMO periodo (idempotencia: guardar dos veces no duplica, la
 * segunda corrida reemplaza a la primera). Justificacion: el base es un PISO calculado sin
 * criterio humano ("el metodo mas viejo y honesto que hay", su propia cabecera lo dice); un
 * guardado manual es una decision DELIBERADA de Franco mirando el mes de referencia y el
 * ponderado. Una decision deliberada tiene que pesar mas que un promedio generico para el MISMO
 * mes -- no tendria sentido que el Tablero promediara ambos ni que los sumara.
 *
 * QUE FILAS SE RETIRAN, EXACTO: se matchea por MES/ANIO de la fecha de la fila (no por dia
 * exacto -- el base escribe dia 1, este modulo tambien escribe dia 1, pero el matching por
 * mes/anio es robusto igual si algun dia cualquiera de los dos cambiara esa convencion) Y por el
 * prefijo de marca correspondiente. NUNCA se toca una fila sin ninguna de las dos marcas (lo que
 * Franco cargo a mano en el ledger real, o una fila de otro periodo): ese es precisamente el
 * limite que ya respeta `DEVTOOL_PresupuestoBase.js` ("no borra lo que vos hayas cargado a mano").
 *
 * `estadoGuardarProyeccion()` reporta EXACTAS cuantas filas de cada marca se retirarian, con su
 * fecha y monto, ANTES de tocar nada -- pedido explicito del encargo. `aplicarGuardarProyeccion()`
 * respalda el CONTENIDO COMPLETO de esas filas (una hoja oculta, releida y verificada antes de
 * borrar una sola celda -- mismo patron de `_respaldarPm`/`_respaldarPb`, adaptado a filas de
 * VALORES en vez de formulas) para que `revertirGuardarProyeccion()` pueda devolverlas tal cual
 * estaban si algo sale mal.
 *
 * ============================================================================
 * UN QUINTO PUNTO NO PEDIDO EXPLICITAMENTE PERO NECESARIO: LA MONEDA DE K/O/S
 * ============================================================================
 * "Proyeccion" (como "Registros") exige una moneda por fila (MONEDAS_DISPONIBLES, ADR-003). La
 * hoja "Presupuesto" no tiene una columna de moneda POR CUENTA para K/O/S -- solo el selector
 * global J4 (`PM_SELECTORES.moneda`), que es la moneda en la que J/N/R (la referencia que Franco
 * mira mientras decide) YA estan convertidos (`_formulaMontoPm`, DEVTOOL_PresupuestoModo.js). No
 * hay ninguna otra senal de moneda por fila en esta hoja: se asume que K/O/S estan tipeados en la
 * MISMA moneda que Franco tiene en pantalla al decidirlos, J4. Es la unica lectura consistente
 * con la geometria real de la hoja (una sola columna de moneda, no una por cuenta), y significa
 * que TODAS las filas de una misma corrida comparten la misma moneda.
 *
 * ============================================================================
 * EL INVARIANTE (pedido del encargo, mas fuerte de lo pedido)
 * ============================================================================
 * El pedido: "la suma de lo guardado para el periodo tiene que ser igual a K8-O8-S8... convertido
 * a la misma moneda". Como se decidio (punto anterior) que todas las filas quedan en la MISMA
 * moneda que J4 -- la misma en la que ya estan expresados K8/O8/S8, que son SUM(K9:K38) etc.,
 * celdas que ya existen con formula -- no hace falta ninguna conversion: se verifica DIRECTO,
 * SIN GAP, contra las celdas que Franco efectivamente vio en pantalla al aprobar el guardado.
 *
 * Se implementa MAS FUERTE que "el neto cierra": se verifica CADA BLOQUE por separado --
 * suma(filas de Ingresos) == K8, suma(filas de Gastos Fijos) == O8, suma(filas de Gastos
 * Variables) == S8 -- y RECIEN DESPUES el neto, suma(Ingresos)-suma(Fijos)-suma(Variables) ==
 * K8-O8-S8. Si el neto cerrara por casualidad (un bloque de mas compensando uno de menos) el
 * chequeo por bloque lo atrapa igual; el pedido original no lo hubiera detectado.
 *
 * Ademas, ANTES de escribir (parte del preflight, no de la verificacion post-escritura): se
 * confirma que W8 (el agrupado de la etapa 2, DEVTOOL_PresupuestoResumen.js) cierra contra
 * K8-O8-S8 -- si esa cadena aguas arriba ya esta rota, este modulo aborta ANTES de generar una
 * sola fila en vez de persistir un guardado construido sobre un cimiento que no cierra.
 *
 * QUE NO HACE
 * 1. NO toca J/N/R, la columna V, las tablas resumen ni el selector de Modo: son de las etapas 1
 *    y 2, ya desplegadas. Este modulo solo LEE K/O/S/K8/O8/S8/W8.
 * 2. NO agrega ningun boton a la hoja "Presupuesto": solo menu tidetrack Dev (pedido explicito).
 * 3. NO toca "Registros", el Plan de Cuentas, "Tipos de Cambio", "Inicio" ni el Tablero.
 * 4. NO modifica las filas de PresupuestoBase de OTROS periodos, ni ninguna fila sin marca.
 * 5. NO construye el ABM: deja el marcado (decision 3) listo para que un encargo posterior lo use.
 *
 * Reusa de DEVTOOL_PresupuestoModo.js: PM_TITULO, PM_SELECTORES, PM_BLOQUES (tituloBloque,
 * rotuloCuenta, colCuenta, categoria), PM_CLAVES_BLOQUE, PM_FILA_INI, PM_FILA_FIN,
 * PM_UMBRAL_IDENTIDAD (NO reusa `_preflightPm` completo -- ver el preflight propio mas abajo,
 * "por que no se reusa `_preflightPm`").
 * Reusa de DEVTOOL_PresupuestoResumen.js: _bloquesPc() (colProyectar: K/O/S), PC_TITULO_PROYECTAR,
 * PC_COL_PROYECTAR_AGRUPADO.
 * Reusa de DEVTOOL_PresupuestoBase.js: PB_MARCA, _preflightPb (Proyeccion espeja a Registros),
 * _borrarGeneradasPb (borrado bottom-up en bloques contiguos, generico por lista de filas).
 * Reusa de DEVTOOL_InicioPresupuesto.js: IP_MESES. Reusa de DEVTOOL_FormulerioV0111.js:
 * _normalizarRotulo, _rotulosCompatibles, _errorDeCelda, _nombreHojaLibreFormulerio. Reusa de
 * 00_Config.js/03_SheetManager.js: SHEETS, RANGES, MONEDAS_DISPONIBLES, columnLetterToIndex,
 * asegurarCapacidadFilas, invalidarCacheNombresHojas.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoModo.js
 * @see DEVTOOL_PresupuestoResumen.js
 * @see DEVTOOL_PresupuestoBase.js
 * @version 0.50.0
 * @since 2026-08-25
 * @lastModified 2026-08-29
 */

// ============================================
// GEOMETRIA Y MARCADO
// ============================================

const PG_MARCA = 'Presupuesto guardado';
// decision Franco 2026-08-25: NO inicializar un const de nivel superior leyendo un simbolo de
// OTRO archivo. Apps Script evalua los archivos en orden alfabetico y no hay filePushOrder en
// .clasp.json, asi que "...Guardar" corre ANTES que "...Modo" y PM_* todavia no existe. El
// ReferenceError no rompe este modulo: rompe la carga del PROYECTO ENTERO, y con ella todas las
// funciones personalizadas de la planilla (Inicio quedo con #ERROR! en Saldo Actual y Capital
// Acumulado). Se lee al INVOCAR, que es cuando el simbolo ya existe, y asi el orden deja de importar.
function _umbralIdentidadPg() { return PM_UMBRAL_IDENTIDAD; }   // 0.01, definido en DEVTOOL_PresupuestoModo.js

const PG_PROP_PREVIOS = 'presupuesto_guardar_previos';
const PG_PREFIJO_RESPALDO = 'Respaldo presupuesto guardar ';

// ============================================
// PERIODO
// ============================================

/**
 * El periodo A GUARDAR (J2/J3), primer dia del mes -- a diferencia de `_mesRefDesdeSelectoresPm`
 * (DEVTOOL_PresupuestoModo.js), que resta un mes para llegar al MES DE REFERENCIA. Este modulo
 * guarda el periodo que Franco esta presupuestando, no el mes que usa como espejo.
 */
function _periodoDesdeSelectoresPg(mesTexto, anio) {
    const meses = IP_MESES.split(',');
    const idx = meses.map(_normalizarRotulo).indexOf(_normalizarRotulo(mesTexto));
    if (idx === -1 || !isFinite(anio)) return null;
    return new Date(anio, idx, 1);
}

/** Clave estable de periodo para el marcado ('2026-09'). Ver decision 3 en la cabecera. */
function _claveMesPg(fecha) {
    return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
}

/** true si `fecha` cae en el mismo mes/anio que `periodo` (el primer dia de ese mes). */
function _mismoMesPg(fecha, periodo) {
    return fecha instanceof Date && !isNaN(fecha.getTime()) &&
        fecha.getFullYear() === periodo.getFullYear() && fecha.getMonth() === periodo.getMonth();
}

// Resolucion de SEGUNDOS, no de minuto (a diferencia de _selloFormulerio y sellos hermanos): el
// sello es la unica pieza que distingue dos corridas de "aplicar" para el MISMO periodo (revertir
// solo puede deshacer lo que su propio sello identifica, ver revertirGuardarProyeccion). Un
// operador que corrige un tipeo y vuelve a aplicar dentro del mismo minuto -- plausible, un
// dialogo de confirmacion se cierra en segundos -- generaria dos corridas con sello IDENTICO en
// minuto y el revert de la segunda no podria distinguir sus propias filas de las que acaba de
// restaurar de la primera. Con segundos, dos aplicaciones tendrian que caer en el mismo click
// de UI, algo que no ocurre en un flujo manual con dialogo de confirmacion de por medio.
function _selloPg() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
}

// ============================================
// COTIZACIONES CONGELADAS (decision 1)
// ============================================

/**
 * Lee las cuatro tasas EN VIVO, llamando a las custom functions DIRECTO como funciones de Apps
 * Script (nunca como formula de celda: ver decision 1, "nunca 'Loading...'"). Regla Estricta 9:
 * si cualquiera de las tres llamadas falla, la excepcion de `fetchArsRate`/`fetchInternationalRates`
 * (15_ExchangeRateApi.js) sube SIN CAPTURAR -- este modulo no la silencia ni la reemplaza por un
 * valor por defecto.
 */
function _leerCotizacionesVivasPg() {
    const usd = Number(TIDETRACK_USD());
    const aud = Number(TIDETRACK_AUD());
    const eur = Number(TIDETRACK_EUR());
    const chequear = function (nombre, v) {
        if (!isFinite(v) || v <= 0) {
            throw new Error('La cotizacion de ' + nombre + ' no es un numero valido ("' + v + '"): ' +
                'no se congela ningun tipo de cambio ni se escribe nada en "' + SHEETS.PROYECCION + '".');
        }
    };
    chequear('USD', usd);
    chequear('AUD', aud);
    chequear('EUR', eur);
    return { ARS: 1, USD: usd, AUD: aud, EUR: eur };
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * Preflight de "Presupuesto", PROPIO -- deliberadamente NO reusa `_preflightPm`
 * (DEVTOOL_PresupuestoModo.js) entero. Se evaluo reusarlo (ya valida titulo, selectores, los
 * tres bloques y el espejo I/M/Q) pero se descarto: ese preflight tambien exige que el selector
 * de Modo (E7) sea uno de los dos valores validos y que su validacion de datos este correcta --
 * dos condiciones sobre columnas que este modulo JAMAS lee (K/O/S no dependen de Modo, solo
 * J/N/R). Acoplarse a el haria que un E7 roto frenara un guardado que en los hechos no tiene
 * nada que ver con E7 -- un falso negativo que ademas complica cada mock de prueba con datos
 * irrelevantes para lo que este modulo hace. Se construye un preflight mas ANGOSTO, que verifica
 * exactamente lo que este modulo necesita para confiar en lo que lee: identidad de la hoja,
 * selectores de periodo/moneda validos, titulo y rotulo "Cuenta" de los tres bloques, que K7/O7/
 * S7/W7 digan "Monto a Proyectar" (PC_TITULO_PROYECTAR, la MISMA constante que ya valida
 * DEVTOOL_PresupuestoResumen.js -- nunca una segunda constante con un valor "parecido", la
 * leccion de v0.46.0), que la banda de datos (I/M/Q/K/O/S, 9-38) no tenga ninguna celda en error,
 * y que K8/O8/S8/W8 tengan formula (el invariante los necesita).
 */
function _preflightPresupuestoPg(ss) {
    const nombre = SHEETS.PRESUPUESTO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const desvios = [];
    const vivoDe = function (celda) { return hoja.getRange(celda).getValue(); };
    const chequear = function (celda, esperado) {
        const vivo = vivoDe(celda);
        if (!_rotulosCompatibles(vivo, esperado)) {
            desvios.push(celda + ' dice "' + vivo + '" y se esperaba "' + esperado + '"');
        }
    };

    chequear(PM_TITULO.celda, PM_TITULO.esperado);
    chequear(PM_SELECTORES.rotuloPeriodo.celda, PM_SELECTORES.rotuloPeriodo.esperado);
    chequear(PM_SELECTORES.rotuloMoneda.celda, PM_SELECTORES.rotuloMoneda.esperado);

    const mesVivo = String(vivoDe(PM_SELECTORES.mes) || '').trim();
    const mesesNorm = IP_MESES.split(',').map(_normalizarRotulo);
    if (mesesNorm.indexOf(_normalizarRotulo(mesVivo)) === -1) {
        desvios.push(PM_SELECTORES.mes + ' dice "' + mesVivo + '", que no es un mes en espanol');
    }
    const anioVivo = Number(vivoDe(PM_SELECTORES.anio));
    if (!isFinite(anioVivo) || anioVivo < 2000 || anioVivo > 2100) {
        desvios.push(PM_SELECTORES.anio + ' dice "' + vivoDe(PM_SELECTORES.anio) + '", que no es un anio plausible');
    }
    const monedaViva = String(vivoDe(PM_SELECTORES.moneda) || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(monedaViva) === -1) {
        desvios.push(PM_SELECTORES.moneda + ' dice "' + monedaViva + '" y no es ninguna moneda del sistema (' +
            MONEDAS_DISPONIBLES.join(', ') + ')');
    }

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const b = PM_BLOQUES[k];
        chequear(b.tituloBloque.celda, b.tituloBloque.esperado);
        chequear(b.rotuloCuenta.celda, b.rotuloCuenta.esperado);
        chequear(_bloquesPc()[k].colProyectar + '7', PC_TITULO_PROYECTAR);
    });
    chequear(PC_COL_PROYECTAR_AGRUPADO + '7', PC_TITULO_PROYECTAR);

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' +
            desvios.join('; ') + '. No se toco nada.');
    }

    // Ninguna celda en error en la banda que se va a leer: un #REF!/#ERROR! en I/M/Q o K/O/S
    // significaria leer un nombre de cuenta o un monto que no es lo que parece.
    const conError = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        [PM_BLOQUES[k].colCuenta, _bloquesPc()[k].colProyectar].forEach(function (col) {
            for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
                const err = _errorDeCelda(hoja.getRange(col + f));
                if (err) conError.push(col + f + '=' + err);
            }
        });
    });
    if (conError.length) {
        throw new Error('Hay celdas en error en la banda de datos: ' + conError.slice(0, 8).join(', ') +
            (conError.length > 8 ? ' (y ' + (conError.length - 8) + ' mas)' : '') + '. No se toco nada.');
    }

    const sinFormula = [];
    ['K8', 'O8', 'S8', PC_COL_PROYECTAR_AGRUPADO + '8'].forEach(function (celda) {
        if (!hoja.getRange(celda).getFormula()) sinFormula.push(celda);
    });
    if (sinFormula.length) {
        throw new Error('Estas celdas de total no tienen formula: ' + sinFormula.join(', ') +
            '. El invariante de este modulo las necesita. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre };
}

/**
 * Preflight de "Proyeccion": reusa `_preflightPb` (DEVTOOL_PresupuestoBase.js) verbatim -- ya
 * verifica que la hoja exista y espeje los encabezados de "Registros" columna por columna.
 */
function _preflightProyeccionPg(ss) {
    return _preflightPb(ss);
}

// ============================================
// LECTURA DE K/O/S (lo que Franco escribio a mano)
// ============================================

/**
 * Lee, para los tres bloques, cada fila 9-38 con cuenta Y monto -- y separa las anomalias:
 * `montoSinCuenta` (K/O/S con numero pero I/M/Q vacio -- una anomalia real, se aborta antes de
 * escribir nada, ver mas abajo) y `sinDecidir` (cuenta con K/O/S vacio -- normal, Franco todavia
 * no decidio esa linea, no es error).
 */
function _leerFilasPresupuestoPg(hoja) {
    const filas = [];
    const montoSinCuenta = [];
    let sinDecidir = 0;
    const nFilas = PM_FILA_FIN - PM_FILA_INI + 1;

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const colCuenta = PM_BLOQUES[k].colCuenta;
        const colMonto = _bloquesPc()[k].colProyectar;
        const categoria = PM_BLOQUES[k].categoria;
        const tipo = k === 'ingresos' ? 'Ingreso' : 'Egreso';

        const cuentas = hoja.getRange(colCuenta + PM_FILA_INI + ':' + colCuenta + PM_FILA_FIN).getValues();
        const montos = hoja.getRange(colMonto + PM_FILA_INI + ':' + colMonto + PM_FILA_FIN).getValues();

        for (let i = 0; i < nFilas; i++) {
            const fila = PM_FILA_INI + i;
            const cuenta = String(cuentas[i][0] || '').trim();
            const crudo = montos[i][0];
            const tieneMonto = crudo !== '' && crudo !== null && isFinite(Number(crudo));

            if (!cuenta) {
                if (tieneMonto) montoSinCuenta.push({ celda: colMonto + fila, valor: crudo });
                continue;
            }
            if (!tieneMonto) { sinDecidir++; continue; }

            filas.push({ bloque: k, cuenta: cuenta, categoria: categoria, tipo: tipo, monto: Number(crudo) });
        }
    });

    return { filas: filas, montoSinCuenta: montoSinCuenta, sinDecidir: sinDecidir };
}

/** Suma por bloque de las filas leidas -- el lado izquierdo del invariante. */
function _sumarPorBloquePg(filas) {
    const s = { ingresos: 0, fijos: 0, variables: 0 };
    filas.forEach(function (f) { s[f.bloque] += f.monto; });
    return s;
}

// ============================================
// FILAS EXISTENTES EN "PROYECCION" (idempotencia + convivencia, decisiones 3 y 4)
// ============================================

/** Filas de "Proyeccion" cuya Nota empieza con `prefijo` exacto. */
function _filasPorNotaPrefijoPg(hoja, prefijo) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const colNota = columnLetterToIndex(cfg.columns.nota);
    const notas = hoja.getRange(cfg.dataRow, colNota, ultima - cfg.dataRow + 1, 1).getValues();
    const out = [];
    notas.forEach(function (f, i) { if (String(f[0] || '').indexOf(prefijo) === 0) out.push(cfg.dataRow + i); });
    return out;
}

/**
 * true si `nota` es una proyeccion puntual del shell (16_ShellService.js, _filaDeProyeccion):
 * empieza con el marcado de PG pero su sello (tercer token) empieza con 'shell_'. El criterio
 * vive SOLO ACA de este lado; el shell construye el literal en su _filaDeProyeccion. Ver el
 * contrato de notas en la cabecera (enmienda a la decision 3).
 * @see 16_ShellService.js (_filaDeProyeccion, sello 'shell_...')
 */
function _esNotaShellPg(nota) {
    const prefijo = PG_MARCA + ' ';
    const texto = String(nota || '');
    if (texto.indexOf(prefijo) !== 0) return false;
    const resto = texto.slice(prefijo.length);
    const espacio = resto.indexOf(' ');
    if (espacio === -1) return false;
    return resto.slice(espacio + 1).indexOf('shell_') === 0;
}

// decision Franco 2026-08-29: helper NUEVO en vez de mutar _filasPorNotaPrefijoPg. Esa funcion
// la reusan revertirGuardarProyeccion (busca por nota EXACTA prefijo+sello, donde el filtro es
// inocuo: un sello PG empieza con digito y una nota shell sigue con 'shell_', disjuntos) y el
// ABM (_filasDelPeriodoPa, DEVTOOL_ProyeccionAbm.js): cambiarle la semantica al buscador
// generico arreglaria el comportamiento del ABM por efecto colateral silencioso y sin
// especificacion. El retiro selectivo se aplica SOLO donde este modulo decide QUE retirar.
//
// decision Franco 2026-08-29 (segunda vuelta): "propia" es la forma ESTRICTA -- el resto tras
// el prefijo tiene que ser EXACTAMENTE un sello yyyy-MM-dd_HHmmss, sin cola. Es el mismo
// literal-regex de la rama 'guardado' del clasificador del ABM (@see DEVTOOL_ProyeccionAbm.js,
// _origenNotaPa), repetido a proposito y no compartido como const de nivel superior (cicatriz
// v0.50.1, orden alfabetico de carga). Antes el criterio era permisivo ("todo lo que no sea
// shell_") y una nota PG editada a mano -- que el ABM clasifica 'otros' -- se retiraba contada
// como "guardado manual previo": una fila mostrada como irreconocible desaparecia en el
// proximo Guardar. Las filas legitimas de aplicarGuardarProyeccion siempre cumplen la forma
// estricta (_selloPg + _matrizNuevaPg no escriben cola), asi que la idempotencia no cambia.
/** Filas de "Proyeccion" del guardado PROPIO: prefijo exacto de periodo + sello estricto sin cola. */
function _filasGuardadoPropioPg(hoja, prefijo) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const colNota = columnLetterToIndex(cfg.columns.nota);
    const notas = hoja.getRange(cfg.dataRow, colNota, ultima - cfg.dataRow + 1, 1).getValues();
    const out = [];
    notas.forEach(function (f, i) {
        const nota = String(f[0] || '');
        if (nota.indexOf(prefijo) === 0 &&
            /^\d{4}-\d{2}-\d{2}_\d{6}$/.test(nota.slice(prefijo.length))) out.push(cfg.dataRow + i);
    });
    return out;
}

/**
 * Filas del periodo (prefijo exacto) que son puntuales del shell (`_esNotaShellPg`, criterio
 * laxo deliberado -- ver la asimetria declarada en la enmienda a la decision 3). Solo
 * informativas: alimentan estado/confirm/detalle, jamas un retiro.
 */
function _filasShellPeriodoPg(hoja, prefijo) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const colNota = columnLetterToIndex(cfg.columns.nota);
    const notas = hoja.getRange(cfg.dataRow, colNota, ultima - cfg.dataRow + 1, 1).getValues();
    const out = [];
    notas.forEach(function (f, i) {
        const nota = String(f[0] || '');
        if (nota.indexOf(prefijo) === 0 && _esNotaShellPg(nota)) out.push(cfg.dataRow + i);
    });
    return out;
}

/** Filas de "Proyeccion" marcadas PB_MARCA (DEVTOOL_PresupuestoBase.js) cuya fecha cae en `periodo`. */
function _filasBasePorMesPg(hoja, periodo) {
    const cfg = RANGES.REGISTROS;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];
    const nFilas = ultima - cfg.dataRow + 1;
    const colNota = columnLetterToIndex(cfg.columns.nota);
    const colFecha = columnLetterToIndex(cfg.columns.fecha);
    const notas = hoja.getRange(cfg.dataRow, colNota, nFilas, 1).getValues();
    const fechas = hoja.getRange(cfg.dataRow, colFecha, nFilas, 1).getValues();
    const out = [];
    for (let i = 0; i < nFilas; i++) {
        if (String(notas[i][0] || '').indexOf(PB_MARCA) !== 0) continue;
        if (_mismoMesPg(fechas[i][0], periodo)) out.push(cfg.dataRow + i);
    }
    return out;
}

/** Resumen legible (conteo, suma en su propia moneda, rango de fechas) de una lista de filas retiradas. */
function _resumenFilasPg(hoja, filas) {
    if (!filas.length) return { n: 0, texto: 'ninguna' };
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const idxMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
    const idxMoneda = columnLetterToIndex(cfg.columns.moneda) - colIni;
    const porMoneda = {};
    filas.forEach(function (fila) {
        const vals = hoja.getRange(fila, colIni, 1, columnLetterToIndex(cfg.end) - colIni + 1).getValues()[0];
        const moneda = String(vals[idxMoneda] || 'ARS');
        porMoneda[moneda] = (porMoneda[moneda] || 0) + (Number(vals[idxMonto]) || 0);
    });
    const texto = Object.keys(porMoneda).map(function (m) {
        return Math.round(porMoneda[m]).toLocaleString('es-AR') + ' ' + m;
    }).join(' + ');
    return { n: filas.length, texto: texto };
}

// ============================================
// EL PLAN (solo lectura)
// ============================================

/**
 * Arma el plan completo leyendo lo vivo. No escribe nada. Aborta ANTES de devolver el plan si
 * W8 no cierra contra K8-O8-S8 (ver cabecera, "el invariante"): un cimiento roto en la etapa 2
 * no es algo que este modulo pueda o deba tapar generando datos encima.
 */
function _planGuardarPg(ss, prePresupuesto) {
    const hoja = prePresupuesto.hoja;

    const periodo = _periodoDesdeSelectoresPg(hoja.getRange(PM_SELECTORES.mes).getValue(), Number(hoja.getRange(PM_SELECTORES.anio).getValue()));
    if (!periodo) {
        throw new Error('No se pudo determinar el periodo desde ' + PM_SELECTORES.mes + '/' + PM_SELECTORES.anio + '. No se toco nada.');
    }
    const moneda = String(hoja.getRange(PM_SELECTORES.moneda).getValue() || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(moneda) === -1) {
        throw new Error(PM_SELECTORES.moneda + ' dice "' + moneda + '", que no es ninguna moneda del sistema. No se toco nada.');
    }

    const totalesVivos = {
        ingresos: Number(hoja.getRange('K8').getValue()),
        fijos: Number(hoja.getRange('O8').getValue()),
        variables: Number(hoja.getRange('S8').getValue())
    };
    const w8 = Number(hoja.getRange(PC_COL_PROYECTAR_AGRUPADO + '8').getValue());
    const netoEsperado = totalesVivos.ingresos - totalesVivos.fijos - totalesVivos.variables;
    if (Math.abs(w8 - netoEsperado) >= _umbralIdentidadPg()) {
        throw new Error('W8 (' + w8.toFixed(2) + ') no cierra contra K8-O8-S8 (' + netoEsperado.toFixed(2) +
            ') ANTES de guardar nada: el agrupado de la etapa 2 (DEVTOOL_PresupuestoResumen.js) esta ' +
            'roto para el periodo vivo. No se genera ningun guardado sobre un cimiento que no cierra. ' +
            'Revisar "Presupuesto: categorias y resumen" (tidetrack Dev) antes de reintentar.');
    }

    const lectura = _leerFilasPresupuestoPg(hoja);
    if (lectura.montoSinCuenta.length) {
        throw new Error('Hay monto tipeado sin cuenta: ' +
            lectura.montoSinCuenta.map(function (a) { return a.celda + '=' + a.valor; }).join(', ') +
            '. No hay cuenta a la cual asignar ese monto (revisar el espejo del Plan de Cuentas o el ' +
            'valor tipeado). No se escribio nada.');
    }

    const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);
    const clave = _claveMesPg(periodo);
    const prefijoPropio = PG_MARCA + ' ' + clave + ' ';
    // Retiro SELECTIVO (enmienda a la decision 3): las "previas propias" son SOLO las de forma
    // estricta de sello. Estado, confirm y retiro consumen TODOS esta misma lista: lo que se
    // anuncia es exactamente lo que se ejecuta.
    const filasPropiasPrevias = _filasGuardadoPropioPg(hojaProy, prefijoPropio);
    // Informativo (transparencia del estado/confirm): las puntuales del shell de este periodo.
    // NO entran en ningun retiro; matchean el prefijo pero no son propias.
    const filasShellDelPeriodo = _filasShellPeriodoPg(hojaProy, prefijoPropio);
    // Informativo: filas con marca PG del periodo pero forma irreconocible (ni sello estricto
    // ni shell -- una Nota editada a mano). NO se retiran: el ABM las lista como 'otros' y ese
    // es su camino de baja; aca solo se avisa que existen para que la foto del mes cierre.
    const filasPgIrreconocibles = _filasPorNotaPrefijoPg(hojaProy, prefijoPropio)
        .filter(function (f) {
            return filasPropiasPrevias.indexOf(f) === -1 && filasShellDelPeriodo.indexOf(f) === -1;
        });
    const filasBaseDelPeriodo = _filasBasePorMesPg(hojaProy, periodo);
    // Informativo: el volcado de recurrentes de este periodo (17_RecurrentesService.js). Su
    // marca es distinta de PG_MARCA asi que jamas entra a ningun retiro; se releva SOLO para
    // que el operador que aprueba el guardado vea la convivencia completa del mes. REC_MARCA
    // se lee ACA ADENTRO, nunca en un const de nivel superior (cicatriz v0.50.1); el prefijo
    // es el mismo que arma _filasRecPorPrefijo del otro lado, con @see cruzado.
    // @see 17_RecurrentesService.js (_filasRecPorPrefijo, volcarRecurrentesAlMes)
    const filasRecDelPeriodo = _filasPorNotaPrefijoPg(hojaProy, REC_MARCA + ' ' + clave + ' ');

    return {
        periodo: periodo, clave: clave, moneda: moneda, lectura: lectura,
        totalesVivos: totalesVivos, w8: w8, hojaProy: hojaProy,
        prefijoPropio: prefijoPropio, filasPropiasPrevias: filasPropiasPrevias,
        filasShellDelPeriodo: filasShellDelPeriodo,
        filasPgIrreconocibles: filasPgIrreconocibles,
        filasBaseDelPeriodo: filasBaseDelPeriodo,
        filasRecDelPeriodo: filasRecDelPeriodo
    };
}

// ============================================
// RESPALDO DE FILAS RETIRADAS (para poder revertir)
// ============================================

/**
 * Congela el CONTENIDO (B:M, valores crudos) de `filas` de "Proyeccion" en una hoja nueva,
 * oculta, y la RELEE para verificar -- mismo patron de `_respaldarPm`/`_respaldarPb`, adaptado a
 * VALORES (nunca formulas: Proyeccion no lleva formulas en B:M) en vez de texto de formula. Las
 * fechas se serializan a ISO porque JSON no representa objetos Date.
 */
function _respaldarFilasPg(ss, hojaProy, filas, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const nombre = _nombreHojaLibreFormulerio(ss, PG_PREFIJO_RESPALDO + sello);

    const destino = ss.insertSheet(nombre);
    invalidarCacheNombresHojas();
    destino.getRange(1, 1, 1, 2).setValues([['fila_original', 'valores_json']]);

    if (filas.length) {
        const filasVivas = hojaProy.getRange(1, colIni, hojaProy.getLastRow(), ancho).getValues();
        const matrizRespaldo = filas.map(function (fila) {
            const vals = filasVivas[fila - 1];
            const serial = vals.map(function (v) { return v instanceof Date ? { __fecha__: v.toISOString() } : v; });
            return [fila, JSON.stringify(serial)];
        });
        destino.getRange(2, 1, matrizRespaldo.length, 2).setValues(matrizRespaldo);
    }
    SpreadsheetApp.flush();

    const leidas = filas.length ? destino.getRange(2, 1, filas.length, 2).getValues() : [];
    if (leidas.length !== filas.length) {
        throw new Error('El respaldo de filas retiradas quedo en "' + nombre + '" pero NO VERIFICA: ' +
            'se esperaban ' + filas.length + ' fila(s) y se releyeron ' + leidas.length +
            '. No se toco "' + hojaProy.getName() + '".');
    }
    for (let i = 0; i < leidas.length; i++) {
        if (Number(leidas[i][0]) !== filas[i]) {
            throw new Error('El respaldo en "' + nombre + '" no coincide fila por fila con lo esperado. ' +
                'No se toco "' + hojaProy.getName() + '".');
        }
    }

    destino.hideSheet();
    logInfo('_respaldarFilasPg: ' + filas.length + ' fila(s) de "' + hojaProy.getName() + '" respaldadas en "' + nombre + '".');
    return { nombre: nombre, filas: filas.length };
}

/** Reconstruye la matriz de filas (valores crudos, con Date reconstruida) desde una hoja de respaldo. */
function _leerRespaldoFilasPg(hoja) {
    const ultima = hoja.getLastRow();
    if (ultima < 2) return [];
    const datos = hoja.getRange(2, 1, ultima - 1, 2).getValues();
    return datos.map(function (f) {
        const arr = JSON.parse(f[1]);
        return arr.map(function (v) { return (v && typeof v === 'object' && v.__fecha__) ? new Date(v.__fecha__) : v; });
    });
}

// ============================================
// ESCRITURA
// ============================================

/** Arma la matriz de filas nuevas para "Proyeccion" a partir del plan y las cotizaciones congeladas. */
function _matrizNuevaPg(plan, cotizaciones, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const pos = {};
    Object.keys(cfg.columns).forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });
    const nota = PG_MARCA + ' ' + plan.clave + ' ' + sello;

    return plan.lectura.filas.map(function (l) {
        const fila = new Array(ancho).fill('');
        fila[pos.monto] = l.monto;
        fila[pos.tipo] = l.tipo;
        fila[pos.cuenta] = l.cuenta;
        fila[pos.tipo_cuenta] = l.categoria;
        // 'medio' queda vacio a proposito: Presupuesto no captura un medio de pago por cuenta
        // (a diferencia de "Registros"/Cargas), y ningun consumidor actual de "Proyeccion"
        // (_formulaPresupuestoIp, _bloqueComunTfp) lee esta columna -- verificado antes de
        // decidir, no asumido. Escribir un medio inventado seria peor que dejarla vacia.
        fila[pos.medio] = '';
        fila[pos.moneda] = plan.moneda;
        fila[pos.fecha] = plan.periodo;
        fila[pos.nota] = nota;
        fila[pos.tc_ars] = cotizaciones.ARS;
        fila[pos.tc_usd] = cotizaciones.USD;
        fila[pos.tc_aud] = cotizaciones.AUD;
        fila[pos.tc_eur] = cotizaciones.EUR;
        return fila;
    });
}

/** Escribe `matriz` al pie de "Proyeccion" (amplia el grid si hace falta) y devuelve la fila inicial. */
function _escribirAlPieProyeccionPg(hojaProy, matriz) {
    if (!matriz.length) return null;
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const primera = Math.max(hojaProy.getLastRow() + 1, cfg.dataRow);
    if (primera + matriz.length - 1 > hojaProy.getMaxRows()) {
        asegurarCapacidadFilas(hojaProy, primera + matriz.length - 1);
    }
    hojaProy.getRange(primera, colIni, matriz.length, matriz[0].length).setValues(matriz);
    return primera;
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: dice cuantas filas se escribirian, de que periodo, con que cotizaciones, y que filas preexistentes se retirarian. */
function estadoGuardarProyeccion() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const prePresupuesto = _preflightPresupuestoPg(ss);
        _preflightProyeccionPg(ss);
        const plan = _planGuardarPg(ss, prePresupuesto);
        const cotizaciones = _leerCotizacionesVivasPg();
        const suma = _sumarPorBloquePg(plan.lectura.filas);
        const neto = suma.ingresos - suma.fijos - suma.variables;
        const netoVivo = plan.totalesVivos.ingresos - plan.totalesVivos.fijos - plan.totalesVivos.variables;

        const resumenBase = _resumenFilasPg(plan.hojaProy, plan.filasBaseDelPeriodo);
        const resumenPropias = _resumenFilasPg(plan.hojaProy, plan.filasPropiasPrevias);
        const resumenShell = _resumenFilasPg(plan.hojaProy, plan.filasShellDelPeriodo);
        const resumenRec = _resumenFilasPg(plan.hojaProy, plan.filasRecDelPeriodo);
        const resumenIrreconocibles = _resumenFilasPg(plan.hojaProy, plan.filasPgIrreconocibles);

        const l = ['GUARDAR PROYECCION - ESTADO (no se escribio nada)', ''];
        l.push('PERIODO: ' + IP_MESES.split(',')[plan.periodo.getMonth()] + ' ' + plan.periodo.getFullYear() +
            ' (clave "' + plan.clave + '"), moneda ' + plan.moneda + '.');
        l.push('');
        l.push('FILAS A ESCRIBIR EN "' + SHEETS.PROYECCION + '": ' + plan.lectura.filas.length);
        l.push('  Ingresos:         ' + suma.ingresos.toFixed(2) + ' ' + plan.moneda + ' (K8 vivo: ' + plan.totalesVivos.ingresos.toFixed(2) + ')');
        l.push('  Gastos Fijos:     ' + suma.fijos.toFixed(2) + ' ' + plan.moneda + ' (O8 vivo: ' + plan.totalesVivos.fijos.toFixed(2) + ')');
        l.push('  Gastos Variables: ' + suma.variables.toFixed(2) + ' ' + plan.moneda + ' (S8 vivo: ' + plan.totalesVivos.variables.toFixed(2) + ')');
        l.push('  NETO:             ' + neto.toFixed(2) + ' ' + plan.moneda + ' (K8-O8-S8 vivo: ' + netoVivo.toFixed(2) + ')');
        if (plan.lectura.sinDecidir > 0) {
            l.push('');
            l.push(plan.lectura.sinDecidir + ' cuenta(s) con Monto a Proyectar vacio: no se les escribe fila (Franco todavia no las decidio).');
        }
        l.push('');
        l.push('COTIZACIONES QUE SE CONGELARIAN (leidas ahora, pueden variar hasta que se aplique):');
        l.push('  ARS ' + cotizaciones.ARS.toFixed(4) + ' | USD ' + cotizaciones.USD.toFixed(4) +
            ' | AUD ' + cotizaciones.AUD.toFixed(4) + ' | EUR ' + cotizaciones.EUR.toFixed(4));
        l.push('');
        l.push('SE RETIRARIAN de "' + SHEETS.PROYECCION + '" para este periodo:');
        l.push('  Presupuesto base historico (' + PB_MARCA + '): ' + resumenBase.n + ' fila(s)' +
            (resumenBase.n ? ', ' + resumenBase.texto : '') + '.');
        l.push('  Un guardado manual previo de este mismo periodo: ' + resumenPropias.n + ' fila(s)' +
            (resumenPropias.n ? ', ' + resumenPropias.texto : '') + '.');
        l.push('  Proyecciones puntuales del shell de este periodo: ' + resumenShell.n + ' fila(s)' +
            (resumenShell.n ? ', ' + resumenShell.texto : '') + ' -- NO se tocan, conviven sumando.');
        l.push('  Volcado de recurrentes de este periodo: ' + resumenRec.n + ' fila(s)' +
            (resumenRec.n ? ', ' + resumenRec.texto : '') + ' -- NO se tocan, conviven sumando.');
        if (plan.filasPgIrreconocibles.length) {
            l.push('  Filas con marca PG pero forma irreconocible (Nota editada a mano): ' +
                resumenIrreconocibles.n + ' fila(s), ' + resumenIrreconocibles.texto +
                ' -- NO se tocan; revisarlas o borrarlas desde el ABM de Proyecciones Elaboradas (grupo "Otros").');
        }
        if (!plan.lectura.filas.length) {
            l.push('');
            l.push('NADA QUE GUARDAR: ninguna cuenta tiene un Monto a Proyectar cargado para este periodo.');
        }

        const t = l.join('\n');
        _mostrarPg('Guardar Proyeccion - estado', t);
        logInfo('estadoGuardarProyeccion: ' + plan.lectura.filas.length + ' fila(s) a escribir, periodo ' + plan.clave + '.');
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPg('Guardar Proyeccion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica: preflight + cotizaciones + confirmacion + respaldo + retiro + escritura + verificacion + reversion si falla. */
function aplicarGuardarProyeccion() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarGuardarProyeccion necesita UI (menu tidetrack Dev).' }; }

    let ss = null, plan = null, respaldo = null, filasRetiradas = [], filaEscritura = null, matrizNueva = [];
    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const prePresupuesto = _preflightPresupuestoPg(ss);
        _preflightProyeccionPg(ss);
        plan = _planGuardarPg(ss, prePresupuesto);

        if (!plan.lectura.filas.length) {
            const t = 'Ninguna cuenta tiene un Monto a Proyectar cargado para ' + plan.clave + '. No se escribio nada.';
            _mostrarPg('Guardar Proyeccion', t);
            return { ok: false, error: t };
        }

        // Las cotizaciones se leen ANTES de la confirmacion: si la API falla, se corta aca,
        // antes de que el operador confirme un guardado que despues no se puede completar.
        const cotizaciones = _leerCotizacionesVivasPg();

        const suma = _sumarPorBloquePg(plan.lectura.filas);
        const resumenBase = _resumenFilasPg(plan.hojaProy, plan.filasBaseDelPeriodo);
        const resumenPropias = _resumenFilasPg(plan.hojaProy, plan.filasPropiasPrevias);
        const resumenShell = _resumenFilasPg(plan.hojaProy, plan.filasShellDelPeriodo);
        const resumenRec = _resumenFilasPg(plan.hojaProy, plan.filasRecDelPeriodo);
        const filasARetirar = plan.filasBaseDelPeriodo.concat(plan.filasPropiasPrevias)
            .filter(function (v, i, a) { return a.indexOf(v) === i; })
            .sort(function (a, b) { return a - b; });

        const conf = ui.alert('Guardar Proyeccion',
            'Periodo: ' + IP_MESES.split(',')[plan.periodo.getMonth()] + ' ' + plan.periodo.getFullYear() +
            ' (' + plan.moneda + ').\n\n' +
            'Se van a escribir ' + plan.lectura.filas.length + ' fila(s) en "' + SHEETS.PROYECCION + '":\n' +
            '  Ingresos ' + suma.ingresos.toFixed(2) + ' | Fijos ' + suma.fijos.toFixed(2) +
            ' | Variables ' + suma.variables.toFixed(2) + ' ' + plan.moneda + '\n\n' +
            'Cotizaciones que quedan CONGELADAS como valor (no formula):\n' +
            '  ARS ' + cotizaciones.ARS.toFixed(4) + ' | USD ' + cotizaciones.USD.toFixed(4) +
            ' | AUD ' + cotizaciones.AUD.toFixed(4) + ' | EUR ' + cotizaciones.EUR.toFixed(4) + '\n\n' +
            'SE RETIRAN (la proyeccion manual gana sobre el promedio historico para este mes):\n' +
            '  Presupuesto base historico: ' + resumenBase.n + ' fila(s)' + (resumenBase.n ? ' (' + resumenBase.texto + ')' : '') + '\n' +
            '  Guardado manual previo de este mismo periodo: ' + resumenPropias.n + ' fila(s)' + (resumenPropias.n ? ' (' + resumenPropias.texto + ')' : '') + '\n' +
            '  Proyecciones puntuales del shell de este periodo: ' + resumenShell.n + ' fila(s)' +
            (resumenShell.n ? ' (' + resumenShell.texto + ')' : '') + ' -- NO se tocan, conviven sumando.\n' +
            '  Volcado de recurrentes de este periodo: ' + resumenRec.n + ' fila(s)' +
            (resumenRec.n ? ' (' + resumenRec.texto + ')' : '') + ' -- NO se tocan, conviven sumando.\n' +
            (plan.filasPgIrreconocibles.length ?
                '  Filas con marca PG pero forma irreconocible: ' + plan.filasPgIrreconocibles.length +
                ' fila(s) -- NO se tocan; verlas en el ABM (grupo "Otros").\n' : '') + '\n' +
            'NO se toca ningun otro periodo ni ninguna fila sin marca. Continuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const sello = _selloPg();

        // --- Respaldo del contenido que se va a retirar (antes de borrar una sola celda) ---
        respaldo = _respaldarFilasPg(ss, plan.hojaProy, filasARetirar, sello);

        // --- Retiro (bottom-up en bloques contiguos; reusa _borrarGeneradasPb sin cambios) ---
        if (filasARetirar.length) {
            _borrarGeneradasPb(plan.hojaProy, filasARetirar);
            SpreadsheetApp.flush();
            const quedanBase = _filasBasePorMesPg(plan.hojaProy, plan.periodo);
            // Solo las PROPIAS: una fila shell sobreviviente es lo esperado, no un retiro fallido.
            const quedanPropias = _filasGuardadoPropioPg(plan.hojaProy, plan.prefijoPropio);
            if (quedanBase.length || quedanPropias.length) {
                throw new Error('Quedaron filas sin retirar (' + quedanBase.length + ' base + ' +
                    quedanPropias.length + ' propias): se corta antes de escribir para no duplicar. ' +
                    'El respaldo quedo en "' + respaldo.nombre + '".');
            }
        }

        // --- Escritura de las filas nuevas, con las cuatro cotizaciones congeladas ---
        matrizNueva = _matrizNuevaPg(plan, cotizaciones, sello);
        filaEscritura = _escribirAlPieProyeccionPg(plan.hojaProy, matrizNueva);
        SpreadsheetApp.flush();

        // --- Verificacion: releer y comparar contra el invariante (bloque por bloque y neto).
        // Solo las filas PROPIAS: una shell sobreviviente entraria al conteo y a sumaReleida y
        // haria fallar el invariante EN FALSO (auto-revert de un guardado sano). ---
        const escritas = _filasGuardadoPropioPg(plan.hojaProy, plan.prefijoPropio);
        const fallas = [];
        if (escritas.length !== matrizNueva.length) {
            fallas.push('se escribieron ' + matrizNueva.length + ' fila(s) y al releer aparecen ' + escritas.length);
        }
        const cfg = RANGES.REGISTROS;
        const colIni = columnLetterToIndex(cfg.start);
        const idxMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
        const idxCat = columnLetterToIndex(cfg.columns.tipo_cuenta) - colIni;
        const idxTcArs = columnLetterToIndex(cfg.columns.tc_ars) - colIni;
        const idxTcUsd = columnLetterToIndex(cfg.columns.tc_usd) - colIni;
        const idxTcAud = columnLetterToIndex(cfg.columns.tc_aud) - colIni;
        const idxTcEur = columnLetterToIndex(cfg.columns.tc_eur) - colIni;
        const sumaReleida = { ingresos: 0, fijos: 0, variables: 0 };
        const catAClave = { 'Ingreso': 'ingresos', 'Gasto Fijo': 'fijos', 'Gasto Variable': 'variables' };
        escritas.forEach(function (fila) {
            const vals = plan.hojaProy.getRange(fila, colIni, 1, columnLetterToIndex(cfg.end) - colIni + 1).getValues()[0];
            const clave = catAClave[String(vals[idxCat] || '')];
            if (clave) sumaReleida[clave] += Number(vals[idxMonto]) || 0;
            if (Number(vals[idxTcArs]) !== cotizaciones.ARS || Number(vals[idxTcUsd]) !== cotizaciones.USD ||
                Number(vals[idxTcAud]) !== cotizaciones.AUD || Number(vals[idxTcEur]) !== cotizaciones.EUR) {
                fallas.push('la fila ' + fila + ' no releyo el vector de cotizaciones congelado');
            }
        });
        ['ingresos', 'fijos', 'variables'].forEach(function (k) {
            const esperado = plan.totalesVivos[k];
            const desvio = Math.abs(sumaReleida[k] - esperado);
            if (desvio >= _umbralIdentidadPg()) {
                fallas.push(k + ': releido ' + sumaReleida[k].toFixed(2) + ' vs esperado (celda de Presupuesto) ' +
                    esperado.toFixed(2) + ' (desvio ' + desvio.toFixed(2) + ')');
            }
        });
        const netoReleido = sumaReleida.ingresos - sumaReleida.fijos - sumaReleida.variables;
        const netoEsperado = plan.totalesVivos.ingresos - plan.totalesVivos.fijos - plan.totalesVivos.variables;
        if (Math.abs(netoReleido - netoEsperado) >= _umbralIdentidadPg()) {
            fallas.push('neto: releido ' + netoReleido.toFixed(2) + ' vs esperado ' + netoEsperado.toFixed(2));
        }

        if (fallas.length) {
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') +
                '. Se revierte automaticamente.');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PG_PROP_PREVIOS, JSON.stringify({
            respaldo: respaldo.nombre, clave: plan.clave, prefijoPropio: plan.prefijoPropio, sello: sello
        }));

        const detalle = 'GUARDAR PROYECCION APLICADO\n\n' +
            '- Periodo: ' + plan.clave + ' (' + plan.moneda + ')\n' +
            '- Filas escritas y verificadas: ' + matrizNueva.length + '\n' +
            '- Cotizaciones congeladas: ARS ' + cotizaciones.ARS.toFixed(4) + ' | USD ' + cotizaciones.USD.toFixed(4) +
            ' | AUD ' + cotizaciones.AUD.toFixed(4) + ' | EUR ' + cotizaciones.EUR.toFixed(4) + '\n' +
            '- Filas retiradas (base + guardado previo del mismo periodo): ' + filasARetirar.length + '\n' +
            (plan.filasShellDelPeriodo.length ? '- Proyecciones del shell intactas: ' + plan.filasShellDelPeriodo.length + ' fila(s)\n' : '') +
            (plan.filasRecDelPeriodo.length ? '- Volcado de recurrentes intacto: ' + plan.filasRecDelPeriodo.length + ' fila(s)\n' : '') +
            (plan.filasPgIrreconocibles.length ? '- Filas PG de forma irreconocible intactas (ver ABM, grupo "Otros"): ' + plan.filasPgIrreconocibles.length + ' fila(s)\n' : '') +
            '- Respaldo de lo retirado en la hoja oculta "' + respaldo.nombre + '"\n' +
            '- Invariante verificado: Ingresos/Fijos/Variables y el neto cierran contra K8/O8/S8\n\n' +
            'Si algo quedo peor: revertirGuardarProyeccion (menu tidetrack Dev).';

        logSuccess('aplicarGuardarProyeccion: ' + matrizNueva.length + ' fila(s), periodo ' + plan.clave + '.');
        _mostrarPg('Guardar Proyeccion - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && plan && respaldo) {
            try {
                // Solo las PROPIAS: las filas shell no estan en el respaldo (nunca se retiraron),
                // asi que quitarlas aca las PERDERIA -- el mismo bug del retiro ciego, reapareciendo
                // por el camino del error.
                const nuevasVivas = _filasGuardadoPropioPg(plan.hojaProy, plan.prefijoPropio);
                if (nuevasVivas.length) _borrarGeneradasPb(plan.hojaProy, nuevasVivas);
                const backup = ss.getSheetByName(respaldo.nombre);
                const matrizBackup = backup ? _leerRespaldoFilasPg(backup) : [];
                if (matrizBackup.length) _escribirAlPieProyeccionPg(plan.hojaProy, matrizBackup);
                SpreadsheetApp.flush();
                restaurado = ' Se revirtio: se quitaron las filas nuevas y se repusieron las ' +
                    matrizBackup.length + ' fila(s) retiradas, desde "' + respaldo.nombre + '".';
            } catch (e2) {
                restaurado = ' ADEMAS fallo la reversion automatica (' + e2.message + '). El respaldo sigue en "' +
                    (respaldo ? respaldo.nombre : '?') + '": revertirGuardarProyeccion o revision manual.';
            }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarPg('Guardar Proyeccion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Quita lo que escribio la ultima corrida aplicada y repone lo que se habia retirado. */
function revertirGuardarProyeccion() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(PG_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);
        if (!hojaProy) throw new Error('No existe la hoja "' + SHEETS.PROYECCION + '".');

        // Se busca por la Nota EXACTA de ESTA corrida (prefijo de periodo + sello), no solo por
        // el prefijo de periodo: el respaldo que se va a reponer puede a su vez contener filas
        // PG_MARCA del MISMO periodo (una corrida anterior, legitima), y esas NO son "lo que
        // esta corrida escribio" -- confundirlas revertiria de mas o el chequeo final fallaria
        // en falso sobre filas que en realidad son el contenido restaurado.
        const notaExacta = previos.prefijoPropio + previos.sello;
        const nuevas = _filasPorNotaPrefijoPg(hojaProy, notaExacta);
        let quitadas = 0;
        if (nuevas.length) {
            _borrarGeneradasPb(hojaProy, nuevas);
            SpreadsheetApp.flush();
            quitadas = nuevas.length;
        }

        const backup = ss.getSheetByName(previos.respaldo);
        const matrizBackup = backup ? _leerRespaldoFilasPg(backup) : [];
        let repuestas = 0;
        if (matrizBackup.length) {
            _escribirAlPieProyeccionPg(hojaProy, matrizBackup);
            SpreadsheetApp.flush();
            repuestas = matrizBackup.length;
        }

        const quedanNuevas = _filasPorNotaPrefijoPg(hojaProy, notaExacta);
        if (quedanNuevas.length) {
            throw new Error('Quedaron ' + quedanNuevas.length + ' fila(s) del guardado sin quitar. Revisar "' +
                SHEETS.PROYECCION + '" a mano; el respaldo sigue en "' + previos.respaldo + '".');
        }

        props.deleteProperty(PG_PROP_PREVIOS);

        const t = 'GUARDAR PROYECCION REVERTIDO\n\n- Periodo: ' + previos.clave +
            '\n- Filas del guardado quitadas: ' + quitadas +
            '\n- Filas repuestas (base + guardado anterior del mismo periodo): ' + repuestas +
            (backup ? '' : '\n- ATENCION: la hoja de respaldo "' + previos.respaldo + '" ya no existe, no se pudo reponer nada') +
            '\n- Respaldo usado: "' + previos.respaldo + '"';
        logSuccess('revertirGuardarProyeccion: ' + quitadas + ' quitadas, ' + repuestas + ' repuestas.');
        _mostrarPg('Guardar Proyeccion - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPg('Guardar Proyeccion - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPg(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
