/**
 * DEVTOOL_PresupuestoPlasmar.js
 * "Plasma" en K/O/S ("Monto a Proyectar", DISENO_HOJA_PRESUPUESTO.md) de la hoja "Presupuesto" lo
 * que ya quedo elaborado en la BD "Proyeccion" para el periodo vivo de J2/J3 -- la operacion
 * INVERSA de aplicarGuardarProyeccion() (DEVTOOL_PresupuestoGuardar.js), que hace el camino
 * K/O/S -> BD. Este modulo hace BD -> K/O/S.
 *
 * [CONCEPTO DE NEGOCIO]
 * Encargo textual de Franco (2026-09-07): "aplicarGuardarProyeccion deberia guardar la
 * informacion registrada manualmente en las columnas de 'Monto a proyectar' y registra todo en
 * la BD. Luego, cuando colocamos Proyecciones Elaboradas, estaria buenisimo poder 'plasmar' los
 * montos proyectados en estas columnas mas 'manuales'. Obvio, deberia haber una advertencia a
 * ejecutar esa funcion dado a que si ya hay informacion cargada, podria sobreescribirse esa
 * informacion." La primera mitad (K/O/S -> BD) ya existe: DEVTOOL_PresupuestoGuardar.js v0.50.0,
 * desplegado. Lo que faltaba era la VUELTA, y es lo que agrega este archivo.
 *
 * ============================================================================
 * DECISION DE PRODUCTO 1 -- QUE SE TRAE AL PLASMAR (el corazon del encargo)
 * ============================================================================
 * Tres lecturas posibles del pedido, evaluadas ANTES de escribir una linea:
 *   a) Solo el grupo 'guardado' (lo que la propia hoja Presupuesto genero la ultima vez que se
 *      corrio "Guardar Proyeccion"). Lectura inicial (ver mas abajo): "CIRCULAR", por traer de
 *      vuelta lo que salio de estas mismas columnas.
 *   b) TODO lo proyectado del mes, sumado por cuenta, a traves de los CINCO origenes que
 *      DEVTOOL_ProyeccionAbm.js ya distingue (guardado / shell / recurrentes / base / otros).
 *   c) Con eleccion de origenes (un selector en el dialogo).
 *
 * PRIMERA VUELTA (v0.66.0, 2026-09-07 AM) -- SE ELIGIO (b). Motivo de entonces: los RECURRENTES
 * (17_RecurrentesService.js) se proyectan SOLOS a la BD "Proyeccion" cada vez que se sincronizan,
 * y NUNCA aparecen en la hoja "Presupuesto" -- Franco no tiene forma de verlos ahi salvo abriendo
 * "Proyeccion" a mano o el ABM. Lo mismo para una proyeccion puntual cargada por el shell: vive
 * en la BD pero es invisible en la hoja de trabajo. Sumar TODO por cuenta hacia visibles esos dos
 * origenes en la columna que Franco edita a mano -- el beneficio concreto que (a) no daba.
 *
 * CORRECCION DE FRANCO (mismo dia, 2026-09-07 PM), TEXTUAL: "Solo lo manual. Lo proyectado no."
 * SE ELIGE (a). El fundamento correcto no es el que la primera vuelta le atribuyo por descarte --
 * plasmar solo 'guardado' NO es circular. Es RESTAURAR y COPIAR HACIA ADELANTE: recuperar la hoja
 * despues de limpiarla (un Sembrar que se quiere deshacer, una edicion que se fue de mano), o
 * arrancar septiembre desde lo que ya se presupuesto en agosto y editar la diferencia -- el mes
 * de origen lo elige el operador corriendo la funcion, no es siempre "el mes en curso". Y el
 * criterio de fondo es de producto, no tecnico: "Monto a Proyectar" (K/O/S) es la superficie de
 * trabajo MANUAL de Franco. Volcar ahi lo que el sistema INFIRIO (recurrentes que se sincronizan
 * solos, el presupuesto base promediado, una proyeccion puntual del shell) borraria la linea
 * entre lo que Franco decidio a mano y lo que el sistema dedujo -- y una vez plasmado en la misma
 * columna, esa distincion ya no se puede reconstruir. Los recurrentes siguen visibles donde ya lo
 * estaban, "Proyecciones Elaboradas" (el ABM): no necesitan invadir tambien la hoja de trabajo.
 * (c) se descarta con el mismo argumento en las dos vueltas: nada en el encargo, ni en su
 * correccion, pide elegir origenes -- agregar esa superficie sin que se pida es la clase de
 * opcion que despues alguien dispara mal.
 *
 * SUMA, NO SIGNO POR TIPO: se replica el MISMO criterio que ya usa `_totalesPorBloquePa`
 * (DEVTOOL_ProyeccionAbm.js) para totalizar "Proyeccion" por bloque -- sumar `monto` crudo de
 * cada fila agrupada por el bloque que deriva `tipoCuenta`, SIN aplicar el signo `tipoQueResta`
 * que si usa el ledger real (_formulaRealidadIp). Sigue aplicando con un solo origen: nada
 * impide que "Proyeccion" tenga MAS DE UNA fila 'guardado' para la misma cuenta y el mismo mes
 * (dos corridas de "Guardar Proyeccion" antes de que el retiro de la primera llegara a
 * completarse, por ejemplo) -- esas filas se suman igual, no se toma la ultima ni se promedia. Se
 * decide replicar y no inventar una TERCERA regla de totalizado: los guardados desde Presupuesto
 * siempre escriben un tipo homogeneo por bloque (`_leerFilasPresupuestoPg`: Ingreso para el
 * bloque ingresos, Egreso para los otros dos), asi que en la practica no hay senal de "reintegro"
 * que perder en este pipeline especifico; si algun dia "Guardar Proyeccion" escribe un tipo
 * contrario dentro de un bloque, ese comportamiento ya esta establecido (y auditado) en Guardar,
 * no se inaugura aca.
 *
 * ============================================================================
 * DECISION DE PRODUCTO 2 -- LA MONEDA, SIN CONVERSION SILENCIOSA (pedido explicito)
 * ============================================================================
 * "Monto a Proyectar" (K/O/S) tiene UNA sola moneda para toda la hoja: el selector J4
 * (PM_SELECTORES.moneda), la MISMA lectura que ya fija DEVTOOL_PresupuestoGuardar.js en su
 * "QUINTO PUNTO" (K/O/S se asume tipeado en la moneda de J4, porque es la unica senal de moneda
 * que la hoja tiene). La BD "Proyeccion", en cambio, puede tener la MISMA cuenta con MAS de una
 * fila 'guardado' para el mismo mes en monedas distintas -- decision de producto 1 achica el
 * universo a un solo origen, pero no lo vuelve un origen unico POR FILA: se guardo el mes dos
 * veces con J4 en monedas distintas, o el retiro de la corrida anterior no llego a completarse
 * antes de la siguiente. La guarda de moneda de esta seccion sigue haciendo falta por eso.
 *
 * Regla, por cuenta, DENTRO de un mismo bloque:
 *   - Si TODAS las filas de esa cuenta para el periodo estan en LA MISMA moneda Y esa moneda es
 *     J4: se suma y se plasma.
 *   - Si estan en UNA sola moneda mas NO es J4: NO se escribe esa celda (no se inventa una tasa de
 *     conversion que nadie pidio). Se cuenta y se reporta como anomalia "moneda distinta".
 *   - Si aparece MAS DE UNA moneda para la misma cuenta: NO se escribe esa celda -- mezclar sin
 *     convertir daria un numero sin sentido, y convertir silenciosamente es exactamente lo que
 *     el encargo prohibe. Se cuenta y reporta como anomalia "mezcla de monedas".
 * Las dos anomalias son INFORMATIVAS, nunca abortan la corrida entera: dejan esa celda como esta
 * (no se pisa un dato ajeno con un numero a medias) y las nombra en el estado/confirmacion/reporte
 * final, con cuenta y montos, para que Franco decida a mano que hacer con esas cuentas puntuales.
 *
 * ============================================================================
 * DECISION DE PRODUCTO 3 -- MODULO PROPIO, NO DEVTOOL_PresupuestoSembrar.js
 * ============================================================================
 * Se evaluo agregar esta operacion a DEVTOOL_PresupuestoSembrar.js, el modulo hermano que ya sabe
 * escribir en K/O/S con el patron correcto (pisa con confirmacion explicita, verificacion por
 * relectura, reversion a un solo nivel que respeta una edicion manual posterior). Se descarta:
 *   - La AFINIDAD real de la FUENTE de datos es con DEVTOOL_PresupuestoGuardar.js (la BD
 *     "Proyeccion", `_preflightPb`, `_periodoDesdeSelectoresPg`, `_claveMesPg`) y con
 *     DEVTOOL_ProyeccionAbm.js (el clasificador de origen por nota `_origenNotaPa`, la lectura
 *     bulk `_leerTodasFilasPa`, el mapeo de categoria `PA_CATEGORIA_A_CLAVE`). Sembrar.js en
 *     cambio lee EXCLUSIVAMENTE J/N/R en vivo, DENTRO de la misma hoja -- cero lectura cruzada de
 *     hojas, cero clasificador de notas. Meter esta logica ahi mezclaria una fuente intra-hoja
 *     (formulas vivas) con una fuente cruzada (una BD con varias poblaciones por nota), en el mismo archivo
 *     que ya documenta extensamente por que NO duplica la geometria de otros dos modulos --
 *     agregarle un tercer conjunto de dependencias cruzadas (Guardar + Abm) le resta, no le suma,
 *     claridad a ese archivo.
 *   - Lo unico que se REUSA de Sembrar es el PATRON (confirmar-solo-si-pisa, verificar releyendo,
 *     revertir a un nivel protegiendo ediciones posteriores) -- se reimplementa aca, angosto a lo
 *     que este modulo necesita, en vez de importar codigo. Ningun modulo hermano de esta familia
 *     reusa la implementacion de otro para escribir en K/O/S (Guardar tampoco reusa el preflight
 *     de Modo, con la misma razon: cada uno valida solo lo que de verdad lee).
 * ProyeccionAbm.js tampoco es candidato: su contrato es `google.script.run` (exito=objeto plano,
 * fallo=throw, CERO `SpreadsheetApp.getUi()`) -- incompatible con la confirmacion `ui.alert`
 * YES_NO que el encargo pide explicitamente ("deberia haber una advertencia a ejecutar").
 *
 * ============================================================================
 * UN MODO DE FALLA QUE LA CORRECCION DE FRANCO ELIMINO (no solo simplifico)
 * ============================================================================
 * La primera vuelta (b) necesitaba una tercera pieza que esta version YA NO TIENE: un aviso de
 * "riesgo de doble conteo" (`_avisoDobleConteoPp`, retirado en la correccion). Vale la pena dejar
 * registrado POR QUE existia y por que dejo de hacer falta, porque es la prueba de que la
 * correccion de Franco no fue solo una preferencia mas simple, sino que cerro un bug latente.
 *
 * `aplicarGuardarProyeccion()` retira, al guardar un mes, sus PROPIAS filas 'guardado' previas y
 * las 'base' de ese mes (decision 4 de su cabecera) -- pero NUNCA toca 'shell', 'recurrentes' ni
 * 'otros': esas "conviven sumando" en el Tablero, por diseno (enmienda a su decision 3). Bajo (b),
 * este modulo plasmaba un total que PODIA incluir shell/recurrentes/otros; si despues Franco
 * corria de nuevo "Guardar Proyeccion" para ese mismo mes, el nuevo guardado (que ya traia esa
 * suma adentro, ahora bajo la marca 'guardado') CONVIVIA en el Tablero con las mismas filas
 * shell/recurrentes/otros que seguian vivas en la BD -- contando esa porcion DOS VECES. Bajo (b)
 * eso no se podia resolver excluyendo esos origenes de la suma (hubiera reintroducido el problema
 * que motivo elegir (b): los recurrentes volverian a ser invisibles), asi que la unica mitigacion
 * posible era TRANSPARENCIA: un aviso explicito, informativo, que no bloqueaba nada.
 *
 * Bajo (a) el modo de falla DESAPARECE, no se mitiga: lo unico que se plasma es 'guardado', y
 * `aplicarGuardarProyeccion()` retira EXACTAMENTE las filas 'guardado' propias de ese mismo mes
 * al volver a guardar (decision 4 de su cabecera, arriba). No hay una porcion que "convive
 * sumando" con lo recien plasmado, porque lo recien plasmado nunca incluyo shell/recurrentes/
 * otros. Por eso `_avisoDobleConteoPp` y su llamador se retiran enteros en vez de quedar
 * apagados: avisar de un riesgo que ya no existe es ruido, no informacion.
 *
 * ============================================================================
 * MENSAJE DIAGNOSTICO CUANDO NO HAY NADA PLASMABLE (pedido de Franco, 2026-09-07)
 * ============================================================================
 * El sintoma que disparo este agregado: Franco conecto el boton y le salio "Ninguna cuenta de
 * 'Presupuesto' tiene un total plasmable para Agosto 2026. No se escribio nada." El mensaje era
 * CORRECTO pero inutil -- verificado: agosto SI tenia 64 filas en "Proyeccion" (el presupuesto
 * base historico), pero NINGUNA de origen 'guardado', que es lo unico que Plasmar trae (decision
 * de producto 1). Franco nunca habia corrido "Guardar Proyeccion" para ese mes, asi que su grupo
 * 'guardado' estaba vacio -- y el mensaje no se lo decia.
 *
 * `_lineasNadaQuePlasmarPp` (compartida por estado y aplicar) distingue DOS situaciones cuando
 * `plan.aPlasmar` queda vacio Y `plan.totalFilasBd` (filas 'guardado' del periodo) es cero:
 *   1. El mes no tiene NINGUNA fila en "Proyeccion" para ese periodo (ni 'guardado' ni ningun
 *      otro origen): se dice eso y listo, no hay nada mas que explicar.
 *   2. El mes SI tiene filas, pero de otros origenes (shell/recurrentes/base/otros -- el
 *      clasificador `_origenNotaPa`, DEVTOOL_ProyeccionAbm.js, ya los distingue): se cuentan POR
 *      ORIGEN y se explica, en una linea, que "Plasmar" solo trae 'guardado' -- lo que sale de
 *      esta misma hoja via "tidetrack Dev > Presupuesto: guardar proyeccion > 2. Aplicar" (ruta
 *      LITERAL de MENU_CONFIG, no una copia: devtools/probar_presupuesto_plasmar.js la cruza
 *      contra el config real, mismo criterio que ya aplica devtools/probar_proyeccion_abm.js
 *      para PA_MSJ_NO_EDITABLE -- "un banco con su propia copia de una ruta miente").
 * Si SI hay filas 'guardado' pero `aPlasmar` sigue vacio, la causa ya la cubren las anomalias
 * (mezcla de moneda, moneda distinta, cuenta inexistente) que `_lineasAnomaliasPp` reporta
 * aparte: no hace falta una tercera rama para ese caso, alcanza con nombrar que ninguna cuenta
 * cerro un total plasmable y dejar que las anomalias digan por que.
 *
 * ============================================================================
 * EL SEGURO: CONFIRMACION EXPLICITA CON NUMEROS CONCRETOS (pedido explicito del encargo)
 * ============================================================================
 * Mismo patron que aplicarPresupuestoSembrar() (DEVTOOL_PresupuestoSembrar.js) y
 * aplicarGuardarProyeccion() (DEVTOOL_PresupuestoGuardar.js): antes de escribir se cuentan las
 * celdas K/O/S que YA TIENEN contenido entre las que se van a plasmar, y se muestran EN NUMEROS
 * (cuantas celdas, cuanto suman los valores que se pierden, cuanto van a quedar) en un
 * `ui.alert` YES_NO cuando hay algo real que perder.
 *
 * decision Franco 2026-09-07 (pedido 2, textual: "si no tiene nada, cargarlo sin problema"):
 * CUANDO NINGUNA celda a plasmar tiene contenido previo, la confirmacion NO SE ELIMINA -- deja de
 * hablar de sobreescritura o de perdida (no hay ninguna) y pasa a ser BREVE: cuantas celdas se
 * van a llenar, "Continuar?". v0.66.0 corria derecho sin dialogo en ese caso (mismo criterio que
 * siguen usando Sembrar y Guardar, sus hermanos, que no se tocan aca). Se revierte SOLO en este
 * modulo: Plasmar siempre escribe sobre la planilla de Franco aunque no pise nada, y el pedido es
 * que la operacion siga pidiendo confirmar -- sin asustar con una perdida que no existe.
 *
 * ESCRIBE VALORES, NUNCA FORMULAS (mismo criterio que Sembrar/Guardar): cada celda usa
 * `setValue(numero)`. El preflight aborta si encuentra una formula viva en la zona K/O/S -- esa
 * zona tiene que ser solo lo que Franco tipea a mano o lo que estos modulos escriben como valor.
 *
 * RESPALDO PARA REVERTIR: PropertiesService, MISMO formato que
 * `PS_PROP_PREVIOS`/`presupuesto_sembrar_previos` (DEVTOOL_PresupuestoSembrar.js) -- por celda,
 * `{celda, valorEscrito, pisa, valorPrevio}`. Deliberadamente NO se usa la boveda de
 * `18_RespaldoService.js`: esa boveda respalda FILAS de una hoja con la geometria de
 * RANGES.REGISTROS (Proyeccion/Registros); este modulo escribe CELDAS SUELTAS de "Presupuesto",
 * exactamente el mismo tipo de escritura que Sembrar, que tampoco usa la boveda. Revertir es a UN
 * SOLO NIVEL y protege una edicion manual posterior: si Franco corrigio una celda a mano despues
 * de plasmar, revertir la deja como esta (mismo criterio, textual, que
 * `revertirPresupuestoSembrar`).
 *
 * NINGUNA CONSTANTE DE NIVEL SUPERIOR de este archivo lee un simbolo de otro archivo (cicatriz
 * v0.50.1: Apps Script evalua src/ en orden alfabetico sin filePushOrder en .clasp.json, y
 * "...Plasmar" ordena DESPUES de "...Modo" pero ANTES de "...Resumen" Y de "DEVTOOL_ProyeccionAbm"
 * -- exactamente los tres archivos de los que este modulo depende para PM_BLOQUES/_bloquesPc/
 * _origenNotaPa/etc. Por eso todos esos simbolos se leen DENTRO de un cuerpo de funcion, nunca en
 * un const/let de nivel superior de este archivo. `PP_UMBRAL_IDENTIDAD` y `PP_PROP_PREVIOS` son
 * literales puros: no leen nada de otro archivo, por eso son seguros como const de nivel superior.
 *
 * QUE NO HACE
 * 1. NO escribe en "Proyeccion": es de solo lectura para este modulo (a diferencia de Guardar,
 *    que retira filas, este NUNCA toca la BD).
 * 2. NO convierte moneda. Ver decision de producto 2.
 * 3. NO toca J/N/R, la columna V/W, las tablas resumen, el selector de Modo ni "Guardar
 *    Proyeccion": son piezas de otros modulos ya desplegados.
 * 4. NO trae recurrentes, presupuesto base, proyecciones sueltas del shell ni las de origen no
 *    reconocido: trae SOLO 'guardado', siempre. Ver decision de producto 1.
 * 5. NO escribe formulas, nunca. Ver "EL SEGURO" arriba.
 *
 * Reusa de DEVTOOL_PresupuestoModo.js: PM_TITULO, PM_SELECTORES, PM_BLOQUES, PM_CLAVES_BLOQUE,
 * PM_FILA_INI, PM_FILA_FIN.
 * Reusa de DEVTOOL_PresupuestoResumen.js: _bloquesPc() (colProyectar: K/O/S), PC_TITULO_PROYECTAR.
 * Reusa de DEVTOOL_PresupuestoGuardar.js: _periodoDesdeSelectoresPg, _claveMesPg.
 * Reusa de DEVTOOL_PresupuestoBase.js: _preflightPb (Proyeccion espeja a Registros).
 * Reusa de DEVTOOL_ProyeccionAbm.js: _leerTodasFilasPa, _origenNotaPa, PA_CATEGORIA_A_CLAVE.
 * Reusa de DEVTOOL_InicioPresupuesto.js: IP_MESES.
 * Reusa de DEVTOOL_FormulerioV0111.js: _rotulosCompatibles, _normalizarRotulo, _errorDeCelda.
 * Reusa de 00_Config.js/03_SheetManager.js: SHEETS, MONEDAS_DISPONIBLES, columnLetterToIndex.
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoGuardar.js (la ida: K/O/S -> BD)
 * @see DEVTOOL_ProyeccionAbm.js (el clasificador de origen por nota, _origenNotaPa)
 * @see DEVTOOL_PresupuestoSembrar.js (el patron de escritura en K/O/S que este modulo imita)
 * @see devtools/probar_presupuesto_plasmar.js
 * @version 0.67.1
 * @since 0.66.0
 * @lastModified 2026-09-07
 */

// ============================================
// CONSTANTES PROPIAS (literales puros: no leen ningun simbolo de otro archivo -- ver cabecera)
// ============================================

const PP_UMBRAL_IDENTIDAD = 0.01;
const PP_PROP_PREVIOS = 'presupuesto_plasmar_previos';

// Rotulo legible de los cuatro origenes que Plasmar NO trae (todo PA_ORIGENES menos 'guardado').
// Literal puro, no lee ningun simbolo de otro archivo: seguro como const de nivel superior. Solo
// se usa para el mensaje diagnostico de "nada que plasmar" (ver cabecera, "MENSAJE DIAGNOSTICO").
const PP_ETIQUETA_ORIGEN = {
    shell: 'cargado puntual (shell)',
    recurrentes: 'recurrentes',
    base: 'presupuesto base historico',
    otros: 'origen no reconocido'
};

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que "Presupuesto" sea la hoja que este modulo cree que es, ANTES de leer o escribir
 * una sola celda -- por ROTULO, como el resto del arnes. Angosto a proposito (mismo criterio que
 * `_preflightPresupuestoPg` de DEVTOOL_PresupuestoGuardar.js, que documenta por que NO reusa el
 * preflight completo de Modo): este modulo no lee el selector de Modo (E7) ni J/N/R, asi que no
 * los valida. Todas las referencias a PM_*, _bloquesPc y PC_TITULO_PROYECTAR van DENTRO del
 * cuerpo (invocacion, no carga) -- ver la cabecera del archivo.
 */
function _preflightPp(ss) {
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

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const bPm = PM_BLOQUES[k];
        const bPc = _bloquesPc()[k];
        chequear(bPm.tituloBloque.celda, bPm.tituloBloque.esperado);
        chequear(bPm.rotuloCuenta.celda, bPm.rotuloCuenta.esperado);
        chequear(bPc.colProyectar + '7', PC_TITULO_PROYECTAR);
    });

    if (desvios.length) {
        throw new Error('La hoja "' + nombre + '" no es la que este modulo espera: ' + desvios.join('; ') +
            '. Hay que volver a medir antes de escribir. No se toco nada.');
    }

    // --- K/O/S (9-38) tienen que ser una zona de VALORES: si alguna celda ya tiene formula, ---
    // --- algo escribio ahi que no es Franco a mano y este modulo no sabe convivir con eso. ---
    // --- Mismo chequeo, mismo mensaje, que _preflightPs (DEVTOOL_PresupuestoSembrar.js). ---
    const conFormula = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = _bloquesPc()[k].colProyectar;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            if (hoja.getRange(col + f).getFormula()) conFormula.push(col + f);
        }
    });
    if (conFormula.length) {
        throw new Error('Hay formulas en la zona de "Monto a Proyectar" (deberia ser solo valores ' +
            'tipeados a mano): ' + conFormula.slice(0, 8).join(', ') +
            (conFormula.length > 8 ? ' (y ' + (conFormula.length - 8) + ' mas)' : '') +
            '. No se toco nada.');
    }

    // --- Ninguna celda en error en I/M/Q (los nombres de cuenta): un #REF!/#ERROR! ahi ---
    // --- significaria buscar coincidencias contra un nombre que no es lo que parece. ---
    const conError = [];
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const col = PM_BLOQUES[k].colCuenta;
        for (let f = PM_FILA_INI; f <= PM_FILA_FIN; f++) {
            const err = _errorDeCelda(hoja.getRange(col + f));
            if (err) conError.push(col + f + '=' + err);
        }
    });
    if (conError.length) {
        throw new Error('Hay celdas en error entre los nombres de cuenta: ' + conError.slice(0, 8).join(', ') +
            (conError.length > 8 ? ' (y ' + (conError.length - 8) + ' mas)' : '') + '. No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre };
}

// ============================================
// PERIODO OBJETIVO (J2/J3/J4 -- el que Franco esta presupuestando, no un mes de referencia)
// ============================================

/**
 * Lee el periodo (J2/J3) y la moneda (J4) vivos de "Presupuesto". Reusa `_periodoDesdeSelectoresPg`
 * / `_claveMesPg` (DEVTOOL_PresupuestoGuardar.js): el mismo periodo que aplicarGuardarProyeccion
 * habria guardado, no `_mesRefDesdeSelectoresPm` (que resta un mes para el MES DE REFERENCIA que
 * usa Sembrar/Modo -- una nocion distinta).
 */
function _periodoObjetivoPp(hoja) {
    const mesTexto = String(hoja.getRange(PM_SELECTORES.mes).getValue() || '').trim();
    const anio = Number(hoja.getRange(PM_SELECTORES.anio).getValue());
    const periodo = _periodoDesdeSelectoresPg(mesTexto, anio);
    if (!periodo) {
        throw new Error('No se pudo determinar el periodo desde ' + PM_SELECTORES.mes + '/' +
            PM_SELECTORES.anio + ' ("' + mesTexto + '" / "' + anio + '"). No se toco nada.');
    }
    const moneda = String(hoja.getRange(PM_SELECTORES.moneda).getValue() || '').trim();
    if (MONEDAS_DISPONIBLES.indexOf(moneda) === -1) {
        throw new Error(PM_SELECTORES.moneda + ' dice "' + moneda + '", que no es ninguna moneda ' +
            'del sistema (' + MONEDAS_DISPONIBLES.join(', ') + '). No se toco nada.');
    }
    return { periodo: periodo, clave: _claveMesPg(periodo), moneda: moneda };
}

/** 'Septiembre 2026', mismo criterio que sus hermanos (IP_MESES, DEVTOOL_InicioPresupuesto.js). */
function _mesLabelPp(periodo) {
    return IP_MESES.split(',')[periodo.getMonth()] + ' ' + periodo.getFullYear();
}

// ============================================
// CUENTAS VIVAS DE "PRESUPUESTO" (I/M/Q -- donde plasmar tiene que aterrizar)
// ============================================

/**
 * { ingresos: {cuentaTrim: fila}, fijos: {...}, variables: {...} } -- la primera fila con ese
 * nombre gana si hubiera un nombre repetido dentro del mismo bloque (no es un caso que este
 * modulo tenga que arbitrar de otra forma: ni Sembrar ni Guardar lo hacen distinto).
 */
function _cuentasPresupuestoPp(hoja) {
    const nFilas = PM_FILA_FIN - PM_FILA_INI + 1;
    const lookup = {};
    PM_CLAVES_BLOQUE.forEach(function (k) {
        const colCuenta = PM_BLOQUES[k].colCuenta;
        const cuentas = hoja.getRange(colCuenta + PM_FILA_INI + ':' + colCuenta + PM_FILA_FIN).getValues();
        lookup[k] = {};
        for (let i = 0; i < nFilas; i++) {
            const cuenta = String(cuentas[i][0] || '').trim();
            if (cuenta && !(cuenta in lookup[k])) lookup[k][cuenta] = PM_FILA_INI + i;
        }
    });
    return lookup;
}

// ============================================
// LECTURA Y CLASIFICACION DE "PROYECCION" (SOLO 'guardado', decision de producto 1)
// ============================================

/**
 * Filas de "Proyeccion" cuya Nota clasifica al periodo `clave` Y cuyo origen es 'guardado'.
 * Reusa `_leerTodasFilasPa`/`_origenNotaPa` (DEVTOOL_ProyeccionAbm.js) verbatim -- el MISMO
 * clasificador que ya audita el ABM, no una segunda version que pueda divergir. Una fila SIN
 * ninguna marca reconocible (`partes === null`) queda fuera, igual que para el ABM: es lo
 * cargado a mano en el ledger real, o ruido.
 *
 * decision Franco 2026-09-07, TEXTUAL: "Solo lo manual. Lo proyectado no." Se trae UNICAMENTE
 * el origen 'guardado' -- lo que salio de estas mismas columnas K/O/S via
 * aplicarGuardarProyeccion. NO se traen recurrentes, presupuesto base, proyecciones sueltas del
 * shell ni las de origen no reconocido.
 * POR QUE, y no es la razon que parece: plasmar solo el guardado NO es circular. Es RESTAURAR y
 * COPIAR HACIA ADELANTE -- recuperar la hoja despues de limpiarla, o arrancar septiembre desde
 * lo que se presupuesto en agosto y editar la diferencia. Por eso el mes lo elige el operador y
 * no es siempre el corriente.
 * Y el criterio de fondo es de producto: K/O/S son la superficie de trabajo MANUAL de Franco.
 * Volcar ahi lo que el sistema infirio (recurrentes, base) borraria la linea entre lo que el
 * decidio y lo que se dedujo, y despues no hay como distinguirlos. Los recurrentes ya se ven en
 * Proyecciones Elaboradas: no necesitan invadir la hoja.
 * @see aplicarGuardarProyeccion en DEVTOOL_PresupuestoGuardar.js (la ida de este viaje)
 * @see decision de producto 1 en la cabecera del archivo (la correccion completa, con la
 * primera lectura que se descarto y por que)
 */
function _filasBdPeriodoPp(hojaProy, clave) {
    const todas = _leerTodasFilasPa(hojaProy);
    const out = [];
    todas.forEach(function (f) {
        const partes = _origenNotaPa(f.nota, f.fecha);
        if (!partes || partes.clave !== clave) return;
        if (partes.origen !== 'guardado') return;
        out.push({
            monto: isFinite(f.monto) ? f.monto : 0,
            tipoCuenta: f.tipoCuenta,
            cuenta: String(f.cuenta || '').trim(),
            moneda: f.moneda || 'ARS'
        });
    });
    return out;
}

/**
 * Cuenta, para `clave`, cuantas filas de "Proyeccion" hay de cada origen DISTINTO de 'guardado'
 * (shell/recurrentes/base/otros) -- alimenta el mensaje diagnostico de "nada que plasmar" (ver
 * cabecera del archivo, "MENSAJE DIAGNOSTICO CUANDO NO HAY NADA PLASMABLE"). Lectura bulk
 * SEPARADA de `_filasBdPeriodoPp` a proposito: esa funcion ya esta probada (banco existente,
 * secciones 1-2) y este agregado no la toca ni le suma una responsabilidad nueva -- el costo de
 * una segunda pasada sobre "Proyeccion" es irrelevante para el volumen real de esta planilla
 * (decenas a un par de cientos de filas), y mezclar las dos en una sola lectura hubiera obligado
 * a retocar una funcion ya verificada solo para ahorrar un recorrido que no pesa.
 */
function _otrosOrigenesPeriodoPp(hojaProy, clave) {
    const todas = _leerTodasFilasPa(hojaProy);
    const conteo = {};
    todas.forEach(function (f) {
        const partes = _origenNotaPa(f.nota, f.fecha);
        if (!partes || partes.clave !== clave || partes.origen === 'guardado') return;
        conteo[partes.origen] = (conteo[partes.origen] || 0) + 1;
    });
    return conteo;
}

/**
 * Agrupa las filas del periodo por bloque y cuenta, acumulando monto POR MONEDA (nunca sumar
 * monedas distintas entre si -- mismo criterio que `_totalesPorBloquePa`). Sigue haciendo falta
 * con un solo origen: nada impide que dos filas 'guardado' distintas (dos corridas de "Guardar
 * Proyeccion", una con J4 distinto de la otra) convivan para la misma cuenta -- ver decision de
 * producto 2 de la cabecera. Separa dos anomalias de entrada, informativas:
 *   - `categoriaDesconocida`: tipoCuenta no mapea a ningun bloque (ver PA_CATEGORIA_A_CLAVE).
 *   - `sinCuentaBd`: tipoCuenta SI mapea pero la fila no trae nombre de cuenta.
 * Ninguna de las dos aborta la corrida: se cuentan y se reportan, el resto del plan sigue.
 */
function _agruparPorCuentaPp(filasBd) {
    const mapaCategoria = PA_CATEGORIA_A_CLAVE;
    const acumulo = { ingresos: {}, fijos: {}, variables: {} };
    const categoriaDesconocida = [];
    const sinCuentaBd = [];

    filasBd.forEach(function (f) {
        const bloque = mapaCategoria[f.tipoCuenta];
        if (!bloque) { categoriaDesconocida.push(f); return; }
        if (!f.cuenta) { sinCuentaBd.push(f); return; }

        if (!acumulo[bloque][f.cuenta]) acumulo[bloque][f.cuenta] = { porMoneda: {} };
        const entrada = acumulo[bloque][f.cuenta];
        entrada.porMoneda[f.moneda] = (entrada.porMoneda[f.moneda] || 0) + f.monto;
    });

    return { acumulo: acumulo, categoriaDesconocida: categoriaDesconocida, sinCuentaBd: sinCuentaBd };
}

// ============================================
// EL PLAN (solo lectura)
// ============================================

/**
 * Arma el plan completo: preflight ya corrido (`pre`), lee el periodo objetivo, colecta y agrupa
 * las filas de "Proyeccion" de ese periodo, las cruza contra las cuentas vivas de "Presupuesto" y
 * decide, cuenta por cuenta, si hay un numero plasmable o una anomalia (ver decision de producto
 * 2 de la cabecera: mezcla de monedas, moneda distinta de J4, o la cuenta ya no existe en el
 * bloque). No escribe nada.
 */
function _planPlasmarPp(ss, pre) {
    const hoja = pre.hoja;
    const obj = _periodoObjetivoPp(hoja);
    const hojaProy = ss.getSheetByName(SHEETS.PROYECCION);   // ya validada por _preflightPb antes de llegar aca

    const filasBd = _filasBdPeriodoPp(hojaProy, obj.clave);
    const agrupado = _agruparPorCuentaPp(filasBd);
    const lookup = _cuentasPresupuestoPp(hoja);
    const otrosOrigenes = _otrosOrigenesPeriodoPp(hojaProy, obj.clave);

    const aPlasmar = [];
    const anomaliaMezclaMoneda = [];
    const anomaliaMonedaDistinta = [];
    const anomaliaCuentaNoExiste = [];

    PM_CLAVES_BLOQUE.forEach(function (k) {
        const colDestino = _bloquesPc()[k].colProyectar;
        Object.keys(agrupado.acumulo[k]).sort().forEach(function (cuenta) {
            const entrada = agrupado.acumulo[k][cuenta];
            const monedas = Object.keys(entrada.porMoneda);

            if (monedas.length > 1) {
                anomaliaMezclaMoneda.push({
                    bloque: k, cuenta: cuenta, monedas: monedas,
                    detalle: monedas.map(function (m) { return m + ' ' + entrada.porMoneda[m].toFixed(2); }).join(' + ')
                });
                return;
            }

            const moneda = monedas[0];
            const total = entrada.porMoneda[moneda];
            if (moneda !== obj.moneda) {
                anomaliaMonedaDistinta.push({ bloque: k, cuenta: cuenta, moneda: moneda, total: total });
                return;
            }

            const filaDestino = lookup[k][cuenta];
            if (!filaDestino) {
                anomaliaCuentaNoExiste.push({ bloque: k, cuenta: cuenta, total: total });
                return;
            }

            const celda = colDestino + filaDestino;
            const crudoDestino = hoja.getRange(celda).getValue();
            const destinoTieneContenido = crudoDestino !== '' && crudoDestino !== null;

            aPlasmar.push({
                celda: celda, bloque: k, fila: filaDestino, cuenta: cuenta, valor: total,
                pisa: destinoTieneContenido,
                valorPrevio: destinoTieneContenido ? crudoDestino : ''
            });
        });
    });

    return {
        periodo: obj.periodo, clave: obj.clave, moneda: obj.moneda,
        aPlasmar: aPlasmar, totalFilasBd: filasBd.length, otrosOrigenes: otrosOrigenes,
        anomaliaMezclaMoneda: anomaliaMezclaMoneda,
        anomaliaMonedaDistinta: anomaliaMonedaDistinta,
        anomaliaCuentaNoExiste: anomaliaCuentaNoExiste,
        categoriaDesconocida: agrupado.categoriaDesconocida,
        sinCuentaBd: agrupado.sinCuentaBd
    };
}

// ============================================
// REPORTE (reusado por estado, confirmacion y aplicado)
// ============================================

/** Nombre de bloque legible, mismo criterio que sus hermanos. */
function _nombreBloquePp(k) {
    return k === 'ingresos' ? 'Ingresos' : (k === 'fijos' ? 'Gastos Fijos' : 'Gastos Variables');
}

/** Texto de las anomalias (si las hay), compartido por estado/confirmacion/aplicado. */
function _lineasAnomaliasPp(plan) {
    const l = [];
    if (plan.anomaliaMezclaMoneda.length) {
        l.push('');
        l.push('MEZCLA DE MONEDAS (no se escriben, no se convierte nada): ' + plan.anomaliaMezclaMoneda.length + ' cuenta(s).');
        plan.anomaliaMezclaMoneda.slice(0, 8).forEach(function (a) {
            l.push('  ' + _nombreBloquePp(a.bloque) + ' / ' + a.cuenta + ': ' + a.detalle);
        });
    }
    if (plan.anomaliaMonedaDistinta.length) {
        l.push('');
        l.push('MONEDA DISTINTA de la del presupuesto (' + plan.moneda + ', no se escriben): ' +
            plan.anomaliaMonedaDistinta.length + ' cuenta(s).');
        plan.anomaliaMonedaDistinta.slice(0, 8).forEach(function (a) {
            l.push('  ' + _nombreBloquePp(a.bloque) + ' / ' + a.cuenta + ': ' + a.total.toFixed(2) + ' ' + a.moneda);
        });
    }
    if (plan.anomaliaCuentaNoExiste.length) {
        l.push('');
        l.push('CUENTA YA NO EXISTE en ese bloque del Plan de Cuentas vivo (no se escriben): ' +
            plan.anomaliaCuentaNoExiste.length + ' cuenta(s).');
        plan.anomaliaCuentaNoExiste.slice(0, 8).forEach(function (a) {
            l.push('  ' + _nombreBloquePp(a.bloque) + ' / ' + a.cuenta + ': ' + a.total.toFixed(2) + ' ' + plan.moneda);
        });
    }
    if (plan.categoriaDesconocida.length) {
        l.push('');
        l.push('CATEGORIA NO RECONOCIDA en "Proyeccion" (no aportan a ningun bloque): ' +
            plan.categoriaDesconocida.length + ' fila(s).');
    }
    if (plan.sinCuentaBd.length) {
        l.push('');
        l.push('FILAS DE "Proyeccion" SIN NOMBRE DE CUENTA para este periodo (no aportan a nada): ' +
            plan.sinCuentaBd.length + ' fila(s).');
    }
    return l;
}

/**
 * Las lineas del diagnostico cuando NO HAY NADA PLASMABLE (`plan.aPlasmar.length === 0`),
 * compartidas por estado y aplicar -- ver cabecera del archivo, "MENSAJE DIAGNOSTICO CUANDO NO
 * HAY NADA PLASMABLE". Distingue el mes sin ninguna fila del mes con filas de otro origen, y en
 * ese segundo caso nombra la ruta REAL de menu (MENU_CONFIG) para generar lo que falta.
 */
function _lineasNadaQuePlasmarPp(plan) {
    const l = [];
    if (!plan.totalFilasBd) {
        const origenes = Object.keys(plan.otrosOrigenes || {}).sort();
        if (!origenes.length) {
            l.push('El mes ' + _mesLabelPp(plan.periodo) + ' no tiene ninguna fila en "' +
                SHEETS.PROYECCION + '": ni "guardado", ni ningun otro origen. No hay nada para plasmar.');
        } else {
            const total = origenes.reduce(function (a, o) { return a + plan.otrosOrigenes[o]; }, 0);
            l.push(_mesLabelPp(plan.periodo) + ' SI tiene ' + total + ' fila(s) en "' + SHEETS.PROYECCION +
                '", pero NINGUNA es del origen "guardado" -- lo unico que "Plasmar" trae (decision de ' +
                'producto 1, ver la cabecera de este modulo). Por origen:');
            origenes.forEach(function (o) {
                l.push('  ' + (PP_ETIQUETA_ORIGEN[o] || o) + ': ' + plan.otrosOrigenes[o] + ' fila(s)');
            });
            l.push('');
            l.push('"Plasmar" solo trae lo que ya se guardo desde ESTA MISMA hoja via ' +
                '"tidetrack Dev > Presupuesto: guardar proyeccion > 2. Aplicar". Corre esa operacion ' +
                'primero si queres que estos numeros aparezcan en "Monto a Proyectar" (o abri ' +
                '"Proyecciones Elaboradas" para verlos sin escribir nada).');
        }
    } else {
        l.push('Ninguna cuenta de "Presupuesto" tiene un total plasmable para ' + _mesLabelPp(plan.periodo) + '.');
    }
    return l;
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: preflight + plan. No escribe nada. */
function estadoPresupuestoPlasmar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPp(ss);
        _preflightPb(ss);   // "Proyeccion" tiene que seguir siendo un espejo exacto de "Registros"
        const plan = _planPlasmarPp(ss, pre);

        const l = ['PRESUPUESTO: PLASMAR PROYECCION ELABORADA - ESTADO (no se escribio nada)', ''];
        l.push('PERIODO: ' + _mesLabelPp(plan.periodo) + ' (clave "' + plan.clave + '"), moneda ' + plan.moneda + '.');
        l.push('Filas "guardado" (Monto a Proyectar) de "' + SHEETS.PROYECCION + '" para este periodo: ' +
            plan.totalFilasBd + '.');
        l.push('');

        const totalVacias = plan.aPlasmar.filter(function (c) { return !c.pisa; }).length;
        const totalPisa = plan.aPlasmar.length - totalVacias;

        if (!plan.aPlasmar.length) {
            l.push('NADA QUE PLASMAR:');
            l.push.apply(l, _lineasNadaQuePlasmarPp(plan));
        } else {
            l.push('CELDAS A PLASMAR: ' + plan.aPlasmar.length + ' -- ' + totalVacias + ' vacia(s) se llenan, ' +
                totalPisa + ' SE PISAN (ya tienen un valor cargado)');
            if (totalPisa) {
                const perdido = plan.aPlasmar.filter(function (c) { return c.pisa; })
                    .reduce(function (a, c) { return a + (isFinite(Number(c.valorPrevio)) ? Number(c.valorPrevio) : 0); }, 0);
                l.push('"2. Aplicar" va a pedir CONFIRMACION EXPLICITA: se van a sobreescribir ' + totalPisa +
                    ' celda(s) que ya tienen monto, por un total de ' + perdido.toFixed(2) + ' ' + plan.moneda + '.');
            }
            l.push('');
            l.push('POR BLOQUE:');
            PM_CLAVES_BLOQUE.forEach(function (k) {
                const deEsteBloque = plan.aPlasmar.filter(function (c) { return c.bloque === k; });
                const vac = deEsteBloque.filter(function (c) { return !c.pisa; }).length;
                l.push('  ' + _nombreBloquePp(k) + ': ' + deEsteBloque.length + ' cuenta(s) -- ' + vac +
                    ' vacia(s), ' + (deEsteBloque.length - vac) + ' SE PISAN');
            });
        }

        l.push.apply(l, _lineasAnomaliasPp(plan));

        const detalle = l.join('\n');
        _mostrarPp('Presupuesto: plasmar proyeccion elaborada - estado', detalle);
        logInfo('estadoPresupuestoPlasmar: ' + plan.aPlasmar.length + ' celda(s) a plasmar (' + totalVacias +
            ' vacias, ' + totalPisa + ' pisan), periodo ' + plan.clave + '.');
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPp('Presupuesto: plasmar proyeccion elaborada - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Plasma en K/O/S el total por cuenta de las filas 'guardado' de "Proyeccion" del periodo vivo
 * (ver decision de producto 1). Pide confirmacion explicita con numeros concretos SOLO cuando hay
 * al menos una celda con contenido previo. Escribe VALORES (setValue), nunca formulas. Verifica
 * releyendo cada celda escrita y revierte el lote entero al estado previo exacto si algo no
 * coincide.
 */
function aplicarPresupuestoPlasmar() {
    let ui = null, hoja = null, escritas = [];
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarPresupuestoPlasmar necesita UI (menu tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightPp(ss);
        _preflightPb(ss);
        hoja = pre.hoja;
        const plan = _planPlasmarPp(ss, pre);

        if (!plan.aPlasmar.length) {
            const l = _lineasNadaQuePlasmarPp(plan);
            l.push('');
            l.push('No se escribio nada.');
            l.push.apply(l, _lineasAnomaliasPp(plan));
            const t = l.join('\n');
            _mostrarPp('Presupuesto: plasmar proyeccion elaborada', t);
            return { ok: true, detalle: t };
        }

        const aPisar = plan.aPlasmar.filter(function (c) { return c.pisa; });

        if (aPisar.length) {
            const perdido = aPisar.reduce(function (a, c) { return a + (isFinite(Number(c.valorPrevio)) ? Number(c.valorPrevio) : 0); }, 0);
            const nuevoDeEsas = aPisar.reduce(function (a, c) { return a + c.valor; }, 0);

            const confirmacion = [
                'Se van a escribir ' + plan.aPlasmar.length + ' celda(s) de "Monto a Proyectar" en "' +
                pre.nombre + '" para ' + _mesLabelPp(plan.periodo) + ' (' + plan.moneda + '), de las cuales',
                aPisar.length + ' celda(s) YA TIENEN MONTO Y SE VAN A SOBREESCRIBIR.',
                '',
                'Lo que se pierde en esas ' + aPisar.length + ' celda(s): ' + perdido.toFixed(2) + ' ' + plan.moneda + ' en total.',
                'Lo que van a quedar valiendo (lo que trae la proyeccion elaborada): ' + nuevoDeEsas.toFixed(2) + ' ' + plan.moneda + ' en total.',
                '',
                'POR BLOQUE (cuentas que se pisan):'
            ];
            PM_CLAVES_BLOQUE.forEach(function (k) {
                const n = aPisar.filter(function (c) { return c.bloque === k; }).length;
                if (n) confirmacion.push('  ' + _nombreBloquePp(k) + ': ' + n + ' cuenta(s)');
            });
            confirmacion.push('');
            confirmacion.push('Si alguna de esas celdas era un numero que Franco escribio a mano y queres');
            confirmacion.push('conservarlo, cancela y anotalo antes de aplicar: "3. Revertir" solo repone el');
            confirmacion.push('estado previo a la corrida MAS RECIENTE, no un historial completo.');
            confirmacion.push('');
            confirmacion.push('Corriste antes "1. Ver estado" y revisaste la lista completa?');
            confirmacion.push('');
            confirmacion.push('Continuar?');

            const conf = ui.alert(
                'Presupuesto: plasmar proyeccion elaborada -- SE VAN A SOBREESCRIBIR ' + aPisar.length + ' CELDA(S)',
                confirmacion.join('\n'), ui.ButtonSet.YES_NO
            );
            if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };
        } else {
            // decision Franco 2026-09-07 (pedido 2, textual: "si no tiene nada, cargarlo sin
            // problema"): ninguna celda a plasmar tiene contenido previo, asi que no hay nada
            // real que perder -- la confirmacion NO SE ELIMINA (sigue escribiendo en la hoja de
            // Franco), pero deja de hablar de sobreescritura y pasa a ser BREVE. Ver la cabecera
            // del archivo, "EL SEGURO", para el porque completo de este cambio de criterio.
            const confirmacionBreve = [
                'Se van a escribir ' + plan.aPlasmar.length + ' celda(s) de "Monto a Proyectar" en "' +
                pre.nombre + '" para ' + _mesLabelPp(plan.periodo) + ' (' + plan.moneda + ').',
                'Ninguna tiene contenido previo: no se pisa nada.',
                '',
                'Continuar?'
            ];
            const confB = ui.alert(
                'Presupuesto: plasmar proyeccion elaborada',
                confirmacionBreve.join('\n'), ui.ButtonSet.YES_NO
            );
            if (confB !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };
        }

        plan.aPlasmar.forEach(function (c) {
            hoja.getRange(c.celda).setValue(c.valor);
            escritas.push(c);
        });
        SpreadsheetApp.flush();

        // Verificacion: se relee el VALOR de vuelta, nunca se asume que setValue funciono.
        const fallas = [];
        escritas.forEach(function (c) {
            const releido = hoja.getRange(c.celda).getValue();
            if (typeof releido !== 'number' || !isFinite(releido) || Math.abs(releido - c.valor) >= PP_UMBRAL_IDENTIDAD) {
                fallas.push(c.celda + ' deberia ser ' + c.valor + ' y quedo ' + JSON.stringify(releido));
            }
        });

        if (fallas.length) {
            // Reversion de TODO el lote al estado previo exacto de cada celda -- nunca "vaciar
            // todo": una celda pisada tenia un numero real antes, hay que reponer ESE numero.
            escritas.forEach(function (c) {
                try {
                    if (c.pisa) hoja.getRange(c.celda).setValue(c.valorPrevio);
                    else hoja.getRange(c.celda).clearContent();
                } catch (e2) { logError('No se pudo reponer ' + c.celda + ' al revertir: ' + e2.message); }
            });
            SpreadsheetApp.flush();
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') + '. Se repuso el estado ' +
                'previo de cada celda de esta corrida (vacia, o el valor que tenia antes).');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(PP_PROP_PREVIOS, JSON.stringify({
            sello: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm'),
            clave: plan.clave,
            celdas: escritas.map(function (c) {
                return { celda: c.celda, valorEscrito: c.valor, pisa: c.pisa, valorPrevio: c.valorPrevio };
            })
        }));

        const l = ['PRESUPUESTO: PROYECCION ELABORADA PLASMADA EN "MONTO A PROYECTAR".', ''];
        l.push('PERIODO: ' + _mesLabelPp(plan.periodo) + ' (' + plan.moneda + ').');
        l.push('');
        l.push('Celdas escritas y verificadas: ' + escritas.length);
        l.push('  vacias que se llenaron: ' + (escritas.length - aPisar.length));
        l.push('  con valor previo que SE SOBREESCRIBIERON: ' + aPisar.length);
        l.push.apply(l, _lineasAnomaliasPp(plan));
        l.push('');
        l.push('Para deshacer: "3. Revertir" (tidetrack Dev). Repone EXACTAMENTE el estado previo a esta');
        l.push('corrida (vacia, o el valor que tenia antes) en cada celda que TODAVIA tenga el numero que');
        l.push('esta corrida escribio -- si corregiste alguna a mano despues, revertir la deja como la dejaste.');
        const detalle = l.join('\n');

        logSuccess('aplicarPresupuestoPlasmar: ' + escritas.length + ' celda(s) plasmadas (' +
            aPisar.length + ' sobreescritas), periodo ' + plan.clave + '.');
        _mostrarPp('Presupuesto: plasmar proyeccion elaborada - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPp('Presupuesto: plasmar proyeccion elaborada - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Deshace la ultima corrida aplicada -- solo celda por celda que TODAVIA tenga exactamente el
 * numero que esa corrida escribio. Una celda que Franco corrigio despues de plasmarla se queda
 * como esta. Repone el estado previo EXACTO: vacia si estaba vacia antes de esa corrida, o el
 * valor que tenia si la corrida la sobreescribio. Mismo patron, textual, que
 * `revertirPresupuestoSembrar` (DEVTOOL_PresupuestoSembrar.js).
 */
function revertirPresupuestoPlasmar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const crudo = props.getProperty(PP_PROP_PREVIOS);
        if (!crudo) throw new Error('No hay ninguna corrida registrada de este modulo.');
        const previos = JSON.parse(crudo);

        const hoja = ss.getSheetByName(SHEETS.PRESUPUESTO);
        if (!hoja) throw new Error('No existe la hoja "' + SHEETS.PRESUPUESTO + '".');

        let restauradas = 0;
        const dejadasComoEstan = [];
        (previos.celdas || []).forEach(function (c) {
            const rango = hoja.getRange(c.celda);
            const vivo = rango.getValue();
            const sigueIgual = typeof vivo === 'number' && isFinite(vivo) &&
                Math.abs(vivo - c.valorEscrito) < PP_UMBRAL_IDENTIDAD;
            if (sigueIgual) {
                if (c.pisa) rango.setValue(c.valorPrevio);
                else rango.clearContent();
                restauradas++;
            } else {
                dejadasComoEstan.push(c.celda);
            }
        });
        SpreadsheetApp.flush();
        props.deleteProperty(PP_PROP_PREVIOS);

        const l = ['PRESUPUESTO: "MONTO A PROYECTAR" (PLASMADO) REVERTIDO.', ''];
        l.push('Corrida original: periodo "' + (previos.clave || '?') + '", sello ' + (previos.sello || '?'));
        l.push('Celdas repuestas a su estado previo: ' + restauradas + ' de ' + (previos.celdas || []).length + ' plasmadas.');
        if (dejadasComoEstan.length) {
            l.push('Celdas que Franco edito despues de plasmarlas y por eso NO se tocaron: ' +
                dejadasComoEstan.slice(0, 8).join(', ') +
                (dejadasComoEstan.length > 8 ? ' (y ' + (dejadasComoEstan.length - 8) + ' mas)' : ''));
        }
        const detalle = l.join('\n');
        logSuccess('revertirPresupuestoPlasmar: ' + restauradas + ' celda(s) repuestas, ' +
            dejadasComoEstan.length + ' dejadas como estan.');
        _mostrarPp('Presupuesto: plasmar proyeccion elaborada - revertido', detalle);
        return { ok: true, detalle: detalle };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarPp('Presupuesto: plasmar proyeccion elaborada - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarPp(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
