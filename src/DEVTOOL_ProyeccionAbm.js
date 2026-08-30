/**
 * DEVTOOL_ProyeccionAbm.js
 * Capa de datos del ABM de "proyecciones elaboradas": ver, corregir y borrar lo que ya esta
 * guardado en la hoja-BD "Proyeccion", desde un modal del menu Tidetrack (no desde tidetrack Dev).
 *
 * [CONCEPTO DE NEGOCIO]
 * Franco, textual (encargo relayado por appscript-ui, coordinando la feature completa UI+backend):
 * "en el menu deberiamos poder hacer el ABM de proyecciones elaboradas". "Proyeccion" ya recibe
 * datos por DOS caminos: el promedio historico automatico (DEVTOOL_PresupuestoBase.js, marca
 * PB_MARCA) y el guardado manual deliberado desde la hoja "Presupuesto"
 * (DEVTOOL_PresupuestoGuardar.js, marca PG_MARCA). Ninguno de los dos ofrece hoy una forma de
 * REVISAR lo que quedo escrito sin abrir la hoja "Proyeccion" a mano y leer filas crudas. Este
 * modulo es la capa de datos que hace eso posible desde un modal: listar por periodo, ver el
 * detalle de un periodo, corregir un monto puntual y borrar un periodo completo.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Arnes Tidetrack seccion 6: preflight por ROTULO (reusa `_preflightPb`, que ya verifica que
 * "Proyeccion" siga siendo un espejo exacto de "Registros"), respaldo verificado antes de mutar,
 * verificacion del VALOR resultante, reversion completa. Regla Estricta 1: nombres de hoja y
 * columnas SIEMPRE via SHEETS/RANGES, nunca hardcodeados.
 *
 * ============================================================================
 * TRES DECISIONES YA TOMADAS (appscript-ui, coordinando el encargo) -- NO SE REABREN AQUI
 * ============================================================================
 *
 * DECISION 1 -- ALTA: NO EXISTE EN ESTE ABM.
 * El alta ya existe: se elabora en la hoja "Presupuesto" (tres etapas, DEVTOOL_PresupuestoModo.js
 * / DEVTOOL_PresupuestoResumen.js / DEVTOOL_PresupuestoGuardar.js) y se guarda con
 * `aplicarGuardarProyeccion()` (hoy en el menu tidetrack Dev; Franco: "luego va a tener su
 * boton"). Reconstruir esa logica en un modal -- leer K/O/S, congelar cotizaciones via las custom
 * functions, verificar el invariante contra W8 -- duplicaria superficie peligrosa de escritura
 * sobre una BD de produccion, con dos caminos que podrian divergir con el tiempo. Este ABM asume
 * que las filas YA estan escritas por ese camino y trabaja sobre eso: ver, corregir, borrar.
 *
 * DECISION 2 -- MODIFICACION: SOLO MONTO, SOLO EN FILAS "GUARDADO A MANO" (marca PG_MARCA).
 * Nunca en filas PB_MARCA (presupuesto base historico, promedio automatico): editarlas a mano las
 * dejaria con la marca "presupuesto base historico" en la Nota pero un valor que ya no es ese
 * promedio -- una mentira en la hoja, indistinguible de un dato genuino hasta que alguien audite
 * a mano. Si Franco quiere reemplazar un mes de base por una decision deliberada, el mecanismo ya
 * existe: guardar ese mes desde "Presupuesto", que retira las filas base de ese mes por diseno
 * (decision 4 de DEVTOOL_PresupuestoGuardar.js, "la proyeccion manual gana"). Por eso
 * `actualizarMontoFilaProyeccion` verifica la marca de la fila ANTES de escribir, del lado del
 * servidor -- no confia en que el cliente ya haya filtrado por `editable`. Desde 2026-08-29 el
 * gate es POR ORIGEN (clasificador `_origenNotaPa`): 'guardado' y 'shell' se editan (ambas son
 * decisiones deliberadas del usuario, ambas llevan PG_MARCA); 'base', 'recurrentes' y 'otros'
 * se rechazan cada una con su mensaje propio.
 *
 * DECISION 3 -- BAJA: POR PERIODO COMPLETO (clave+origen), CON RESPALDO Y REVERSION.
 * Misma disciplina que `aplicarGuardarProyeccion`/`revertirGuardarProyeccion`. Aplica a los
 * CINCO origenes (desde 2026-08-29): hoy no existe forma de borrar SOLO un mes del presupuesto
 * base (`quitarPresupuestoBase()`, DEVTOOL_PresupuestoBase.js, borra TODOS los meses de una
 * corrida), asi que este ABM llena ese hueco real. Nunca se borra una fila individual: la
 * unidad minima es "todas las filas de una clave de periodo, para un origen". CAMBIO DE
 * SEMANTICA declarado: la baja de 'guardado' ya no arrastra las filas del shell del mismo mes
 * (antes las borraba en el mismo acto sin distinguirlas); vaciar un mes entero ahora requiere
 * una baja por origen.
 *
 * ============================================================================
 * QUE ES UN "PERIODO" Y COMO SE AGRUPA (cinco poblaciones desde 2026-08-29)
 * ============================================================================
 * "Proyeccion" NO tiene una columna de periodo: la clave se deriva de la Nota (y de la Fecha
 * para el base) con el clasificador `_origenNotaPa`, que reconoce el contrato de notas completo
 * (DEVTOOL_PresupuestoGuardar.js, enmienda a su decision 3) por la FORMA del sello:
 *   - 'guardado'    (PG_MARCA): "<PG_MARCA> <YYYY-MM> <sello>" con sello /^\d{4}-\d{2}-\d{2}_\d{6}$/
 *     y NADA despues del sello (aplicarGuardarProyeccion nunca escribe cola; si hay cola, la
 *     nota fue editada a mano y va a 'otros', no se disfraza de guardado).
 *   - 'shell'       (PG_MARCA + sello shell): "<PG_MARCA> <YYYY-MM> shell_<...>[ <nota libre>]"
 *     con sello /^shell_\d{4}-\d{2}-\d{2}_\d{6}(?:\d{3})?$/ (fuente del formato:
 *     16_ShellService.js, registrarProyecciones: 'shell_' + yyyy-MM-dd_HHmmss + 3 digitos de
 *     milisegundos DESDE v0.59.0; el shell desplegado en v0.56.0-v0.58.0 escribia el sello SIN
 *     milisegundos, y esas filas historicas viven en produccion -- por eso los milisegundos
 *     son OPCIONALES en el regex, ambos vintages clasifican 'shell'). El sello es UN token de
 *     forma conocida y la nota libre es todo lo que sigue: las filas historicas con la nota
 *     pegada tras el sello parsean bien.
 *   - 'recurrentes' (REC_MARCA): "<REC_MARCA> <YYYY-MM> <sello> - <nombre>[: <nota>]"
 *     (17_RecurrentesService.js). Antes de 2026-08-29 eran INVISIBLES para este ABM.
 *   - 'base'        (PB_MARCA): "<PB_MARCA> <sello>", clave derivada de la columna Fecha con
 *     `_claveMesPg` (como siempre).
 *   - 'otros': cualquier nota CON alguna de las tres marcas pero de forma irreconocible
 *     (clave invalida, sello irreconocible, PG con cola, PB sin fecha valida). Nunca
 *     invisible: se lista y se puede borrar por mes; clave = la del token si parseo, si no la
 *     del mes de la Fecha, si no el literal 'sin-fecha'.
 * Una fila SIN ninguna de las tres marcas no entra en ningun grupo: es lo cargado a mano en el
 * ledger real, o ruido. Nunca se toca, nunca se cuenta -- fuera del alcance de este ABM.
 *
 * ============================================================================
 * TOTALES POR BLOQUE Y MONEDA (nunca sumar monedas distintas entre si, ADR-003)
 * ============================================================================
 * Cada fila se ubica en un bloque (ingresos/fijos/variables) segun su columna `tipo_cuenta`
 * (`PA_CATEGORIA_A_CLAVE`). Una fila cuyo `tipo_cuenta` no es ninguna de las tres claves NUNCA se
 * descarta en silencio: se cuenta en `otrasFilas` y se reporta. Los totales se acumulan POR
 * MONEDA dentro de cada bloque -- jamas se convierte ni se suma ARS con USD, la misma disciplina
 * que ya aplica `_ajustarSinDesahorroPb` (DEVTOOL_PresupuestoBase.js) al recortar el presupuesto
 * base, y que aplica `aplicarGuardarProyeccion` al verificar su invariante bloque por bloque. El
 * `neto` (ingresos-fijos-variables) se calcula POR MONEDA sobre la UNION de monedas que aparecen
 * en cualquiera de los tres bloques del grupo: una moneda sin movimiento en un bloque cuenta como
 * 0 en ESE bloque para el neto, nunca se omite de el.
 *
 * QUE NO HACE
 * 1. NO escribe nunca en filas PB_MARCA: ni un monto, ni nada. Son de solo lectura para este ABM.
 * 2. NO reconstruye el guardado (decision 1): no lee K/O/S de "Presupuesto", no llama a las custom
 *    functions de cotizacion, no escribe una fila nueva.
 * 3. NO toca "Registros", el Plan de Cuentas, "Tipos de Cambio" ni la hoja "Presupuesto".
 * 4. NO usa `SpreadsheetApp.getUi()`: este modulo se llama desde `google.script.run` (un modal
 *    HtmlService, cableado por appscript-ui en 11_UIService.js), no desde el menu -- exito
 *    devuelve un objeto plano, fallo lanza `Error` (convencion de `UI_AbmPlanCuentas.html` /
 *    `saveAbmRecord`/`updateAbmRecord`/`deleteAbmRecord` en 11_UIService.js, NO el patron
 *    `{ok:false,error}` de los modulos DEVTOOL_Presupuesto*, que es para `ui.alert()` de menu).
 *
 * Reusa de DEVTOOL_PresupuestoGuardar.js: PG_MARCA, _claveMesPg,
 * _leerRespaldoFilasPg, _escribirAlPieProyeccionPg.
 * Reusa de 17_RecurrentesService.js: REC_MARCA (leida dentro de cuerpos de funcion).
 * Reusa de DEVTOOL_PresupuestoBase.js: PB_MARCA, _preflightPb, _borrarGeneradasPb.
 * Reusa de DEVTOOL_InicioPresupuesto.js: IP_MESES.
 * Reusa de DEVTOOL_FormulerioV0111.js: _nombreHojaLibreFormulerio.
 * Reusa de 00_Config.js/03_SheetManager.js: SHEETS, RANGES, MONEDAS_DISPONIBLES,
 * columnLetterToIndex, invalidarCacheNombresHojas.
 *
 * NO reusa `_respaldarFilasPg` (DEVTOOL_PresupuestoGuardar.js) tal cual: esa funcion hardcodea
 * `PG_PREFIJO_RESPALDO` en el nombre de la hoja de respaldo, y este modulo necesita el suyo
 * propio (`PA_PREFIJO_RESPALDO`) para no confundir, en la lista de hojas ocultas, un respaldo de
 * "Guardar Proyeccion" con uno de este ABM. `_respaldarFilasPa` es una copia deliberada del MISMO
 * algoritmo (escribir, `flush`, releer, verificar fila por fila, ocultar) con esa unica variable
 * cambiada -- no una reinvencion.
 *
 * ============================================================================
 * [INCIDENTE 2026-08-25 -- EXPERIMENTO DECISIVO: CANAL ENTERO VS. ESTA FUNCION/RESPUESTA]
 * ============================================================================
 * v0.56.0 le agrego 3 reintentos con espera creciente a `listarPeriodosProyeccion()` desde el
 * modal (ver UI_AbmProyeccionElaborada.html) contra un PERMISSION_DENIED reproducible al abrir.
 * Medido en produccion: LOS TRES INTENTOS FALLARON (10764 ms) -- eso refuta que sea una demora
 * fija de negociacion del canal que un reintento alcance a cubrir, pero deja abiertas DOS
 * hipotesis distintas que un solo dato no separa: (a) el canal `google.script.run` de ESTE modal
 * esta roto para CUALQUIER llamada, o (b) el canal esta bien y lo que falla es especifico de
 * `listarPeriodosProyeccion()` -- su tamanio, algo en su respuesta que no serializa. Confundir las
 * dos lleva a arreglar lo que no es: reintentar mas tampoco arregla (a), y cambiar el canal
 * (mover el disparo, esperar un gesto) no arregla (b).
 * `pingProyeccionAbm()` (mas abajo) es el separador: no lee nada, no llama a `SpreadsheetApp` ni a
 * ninguna API, devuelve siempre el mismo objeto minimo. El modal la llama PRIMERO. Si el ping
 * TAMBIEN falla, es (a) y esta funcion queda descartada como sospechosa. Si el ping anda y
 * `listarPeriodosProyeccion()` sigue fallando, es (b) -- y ahi el primer sospechoso es el TAMANIO:
 * `listarPeriodosProyeccion()` arma sus grupos leyendo `crudasFilas` de cada mes (potencialmente
 * cientos de filas con fecha y montos), aunque -- verificado releyendo `armarGrupo` mas abajo --
 * `crudasFilas` en si NUNCA sale de la funcion: se usa solo para calcular `monedas` y `totales`,
 * el objeto `grupo` que se retorna no la incluye. Una medicion local (mock con la MISMA forma que
 * el DIAG en produccion: 370 filas, 7 grupos base, 0 guardado) dio un payload de apenas ~5KB / 123
 * nodos -- del mismo orden que el caso exitoso que midio el Shell (1723 bytes / 85 nodos), no dos
 * o tres ordenes de magnitud mas grande. Si el DIAG confirma ese orden en produccion (ver el nuevo
 * paso 5b de DEVTOOL_DIAG_PermisoProyeccionAbm.js, `JSON.stringify(resultado).length`), el tamanio
 * queda descartado como sospechoso PARA ESTA FUNCION -- haria falta mirar contenido, no tamanio.
 *
 * FORMA NUEVA DEL PAYLOAD (2026-08-29, cinco poblaciones): la respuesta de
 * `listarPeriodosProyeccion` dejo de escalar con el numero de filas y es O(grupos) puro. Cada
 * grupo trae EXACTAMENTE { clave, mesLabel, nFilas, corridas, ultimoSello, totales, otrasFilas }
 * -- se quitaron filas[] (en el mock de referencia, 370 numeros ~1.5-2KB de los ~5KB medidos),
 * monedas[], anio, sello y sellos[], que la pantalla no pintaba; se agregan nFilas+corridas (dos
 * enteros) y ultimoSello (~25-35 bytes). Grupo resultante ~300-350 bytes; el mock de referencia
 * baja de ~5KB a ~3KB. Peor caso realista (12 meses x 5 origenes = 60 grupos): ~20KB, mismo
 * orden que lo ya medido como exitoso. El detalle fila a fila sigue viajando en requests
 * separados por grupo (`detalleFilasPeriodoProyeccion`), como siempre. Tambien se quitaron
 * vacioGuardado/vacioBase: el cliente usa grupos.<origen>.length (las dos puntas salen juntas
 * en el mismo deploy).
 *
 * @see docs/permanente/DISENO_HOJA_PRESUPUESTO.md
 * @see DEVTOOL_PresupuestoGuardar.js
 * @see DEVTOOL_PresupuestoBase.js
 * @see DEVTOOL_DIAG_PermisoProyeccionAbm.js (paso 5b: tamanio real del payload en produccion)
 * @see UI_AbmProyeccionElaborada.html (llama pingProyeccionAbm() antes de listarPeriodosProyeccion())
 * @version 0.53.0
 * @since 2026-08-25
 * @lastModified 2026-08-29
 */

// ============================================
// CONSTANTES PROPIAS (namespace PA_, no colisiona con PG_/PB_ de los modulos hermanos)
// ============================================

const PA_PROP_PREVIOS_BAJA = 'proyeccion_abm_baja_previos';
const PA_PROP_PREVIOS_EDICION = 'proyeccion_abm_edicion_previos';
const PA_PREFIJO_RESPALDO = 'Respaldo proyeccion abm ';

// Literal propio: no lee ningun simbolo de otro archivo, es seguro como const de nivel superior.
const PA_CATEGORIA_A_CLAVE = { 'Ingreso': 'ingresos', 'Gasto Fijo': 'fijos', 'Gasto Variable': 'variables' };

// Los cinco origenes que este ABM reconoce (literal puro, mismo criterio que arriba). El orden
// es el de presentacion en el modal: guardado a mano, manual del shell, recurrentes, base, otros.
const PA_ORIGENES = ['guardado', 'shell', 'recurrentes', 'base', 'otros'];

// decision Franco 2026-08-25: PG_MARCA, PB_MARCA, IP_MESES, RANGES, SHEETS, MONEDAS_DISPONIBLES y
// cualquier funcion de otro archivo (DEVTOOL_PresupuestoGuardar.js, DEVTOOL_PresupuestoBase.js,
// DEVTOOL_InicioPresupuesto.js, 00_Config.js, 03_SheetManager.js) se leen SOLO dentro de cuerpos
// de funcion en este archivo, nunca en un const/let de nivel superior. Apps Script evalua los
// archivos del proyecto en orden alfabetico (sin filePushOrder en .clasp.json): un const de
// nivel superior que lea un simbolo de un archivo que carga DESPUES revienta con ReferenceError
// al EVALUAR el proyecto entero -- no solo este modulo, TODAS las custom functions de la
// planilla quedan en #ERROR!. Paso en produccion el 2026-08-25 con
// DEVTOOL_PresupuestoGuardar.js/PM_UMBRAL_IDENTIDAD (ver su cabecera, decision de "_umbralIdentidadPg").
// En este caso puntual los simbolos que se reusan SI cargan antes por orden alfabetico
// ("PresupuestoBase"/"PresupuestoGuardar"/"InicioPresupuesto" < "ProyeccionAbm"), pero la regla
// se respeta igual: un archivo que se renombre manana no deberia poder romper la carga del
// proyecto por una diferencia de una letra.

// ============================================
// CLAVE DE PERIODO Y ROTULO DE MES
// ============================================

/**
 * Convierte una clave 'YYYY-MM' al primer dia de ese mes, o null si el formato no es exacto o el
 * mes no es plausible (01-12). Es la validacion de entrada de `detalleFilasPeriodoProyeccion`,
 * `eliminarPeriodoProyeccion` y el parseo interno de grupos "base".
 */
function _fechaDesdeClavePa(clave) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(clave || ''));
    if (!m) return null;
    const anio = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    if (mes < 1 || mes > 12) return null;
    return new Date(anio, mes - 1, 1);
}

/** 'Septiembre 2026', reusando IP_MESES (DEVTOOL_InicioPresupuesto.js) igual que estadoGuardarProyeccion. */
function _mesLabelPa(anio, mesIndex) {
    return IP_MESES.split(',')[mesIndex] + ' ' + anio;
}

/**
 * EL CLASIFICADOR DE NOTAS (2026-08-29): clasifica una fila de "Proyeccion" por su origen,
 * leyendo la Nota (y la Fecha, para el base y los fallbacks). Devuelve null SOLO si la nota no
 * empieza con ninguna de las tres marcas (PG_MARCA, PB_MARCA, REC_MARCA): esas filas siguen
 * fuera del alcance de este ABM, exactamente como siempre (decision de la cabecera, no se
 * reabre). Con marca devuelve { origen, clave, sello, notaLibre }, con origen uno de
 * PA_ORIGENES. Las reglas y los regex estan documentados en la cabecera ("QUE ES UN PERIODO").
 *
 * Las marcas se leen DENTRO del cuerpo (cicatriz v0.50.1: nunca en un const de nivel superior
 * que lea otro archivo) y los regex viven aca como literales. La clave se corta por el PROXIMO
 * espacio, nunca por una regex sobre la Nota entera (el sello tambien tiene guiones y numeros).
 *
 * decision Franco 2026-08-29: el regex del sello shell acepta 6 digitos tras la fecha (HHmmss)
 * con 3 mas opcionales (SSS). Los milisegundos existen desde v0.59.0; el shell desplegado en
 * v0.56.0-v0.58.0 (produccion confirmada por targets) escribia el sello SIN milisegundos, y
 * esas filas historicas tienen que clasificar 'shell' -- editables y bajo su rotulo -- no
 * degradar a 'otros'. Si la otra linea de trabajo cambiara el formato a una TERCERA forma,
 * esas filas nuevas caerian en 'otros' (degradacion visible, no perdida): la fuente del
 * formato es 16_ShellService.js, registrarProyecciones.
 * @see 16_ShellService.js (_filaDeProyeccion: fuente del formato shell)
 * @see DEVTOOL_PresupuestoGuardar.js (contrato de notas, enmienda a su decision 3)
 * @see 17_RecurrentesService.js (formato del volcado de recurrentes)
 */
function _origenNotaPa(nota, fecha) {
    const texto = String(nota || '');
    const fechaValida = (fecha instanceof Date) && !isNaN(fecha.getTime());
    const claveFallback = function (claveTok) {
        if (claveTok && _fechaDesdeClavePa(claveTok)) return claveTok;
        if (fechaValida) return _claveMesPg(fecha);
        return 'sin-fecha';
    };
    const partirTokens = function (resto) {
        const esp1 = resto.indexOf(' ');
        if (esp1 === -1) return { claveTok: resto, selloTok: '', cola: '' };
        const resto2 = resto.slice(esp1 + 1);
        const esp2 = resto2.indexOf(' ');
        if (esp2 === -1) return { claveTok: resto.slice(0, esp1), selloTok: resto2, cola: '' };
        return { claveTok: resto.slice(0, esp1), selloTok: resto2.slice(0, esp2), cola: resto2.slice(esp2 + 1) };
    };

    const prefijoPg = PG_MARCA + ' ';
    if (texto.indexOf(prefijoPg) === 0) {
        const resto = texto.slice(prefijoPg.length);
        const t = partirTokens(resto);
        if (_fechaDesdeClavePa(t.claveTok)) {
            if (/^shell_\d{4}-\d{2}-\d{2}_\d{6}(?:\d{3})?$/.test(t.selloTok)) {
                // Parseo TOLERANTE del formato historico: la nota libre pegada tras el sello
                // parsea bien porque el sello es UN token de forma conocida.
                return { origen: 'shell', clave: t.claveTok, sello: t.selloTok, notaLibre: t.cola.trim() };
            }
            if (/^\d{4}-\d{2}-\d{2}_\d{6}$/.test(t.selloTok) && t.cola.trim() === '') {
                return { origen: 'guardado', clave: t.claveTok, sello: t.selloTok, notaLibre: '' };
            }
        }
        return { origen: 'otros', clave: claveFallback(t.claveTok), sello: null, notaLibre: resto };
    }

    const prefijoRec = REC_MARCA + ' ';
    if (texto.indexOf(prefijoRec) === 0) {
        const resto = texto.slice(prefijoRec.length);
        const t = partirTokens(resto);
        if (_fechaDesdeClavePa(t.claveTok) && /^\d{4}-\d{2}-\d{2}_\d{6}$/.test(t.selloTok)) {
            // La cola es '- <nombre>[: <nota>]': se quita SOLO el primer separador.
            const notaLibre = t.cola.indexOf('- ') === 0 ? t.cola.slice(2) : t.cola.trim();
            return { origen: 'recurrentes', clave: t.claveTok, sello: t.selloTok, notaLibre: notaLibre };
        }
        return { origen: 'otros', clave: claveFallback(t.claveTok), sello: null, notaLibre: resto };
    }

    if (texto.indexOf(PB_MARCA) === 0) {
        const sello = texto.slice(PB_MARCA.length).trim();
        if (fechaValida) {
            return { origen: 'base', clave: _claveMesPg(fecha), sello: sello, notaLibre: '' };
        }
        // Antes estas filas eran invisibles (fecha invalida = descartada); "nunca invisible"
        // las cubre: clave 'sin-fecha', solo listables y borrables desde 'otros'.
        return { origen: 'otros', clave: 'sin-fecha', sello: null, notaLibre: sello };
    }

    return null;
}

// ============================================
// LECTURA CRUDA DE "PROYECCION"
// ============================================

/** Lee TODA la banda de datos de "Proyeccion" (B:M) de una sola vez, con el numero de fila real. */
function _leerTodasFilasPa(hoja) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const ultima = hoja.getLastRow();
    if (ultima < cfg.dataRow) return [];

    const pos = {};
    Object.keys(cfg.columns).forEach(function (k) { pos[k] = columnLetterToIndex(cfg.columns[k]) - colIni; });

    const valores = hoja.getRange(cfg.dataRow, colIni, ultima - cfg.dataRow + 1, ancho).getValues();
    return valores.map(function (v, i) {
        return {
            fila: cfg.dataRow + i,
            monto: Number(v[pos.monto]),
            tipo: String(v[pos.tipo] || ''),
            cuenta: String(v[pos.cuenta] || ''),
            tipoCuenta: String(v[pos.tipo_cuenta] || ''),
            medio: String(v[pos.medio] || ''),
            moneda: String(v[pos.moneda] || '') || 'ARS',
            fecha: v[pos.fecha],
            nota: String(v[pos.nota] || ''),
            tcArs: v[pos.tc_ars], tcUsd: v[pos.tc_usd], tcAud: v[pos.tc_aud], tcEur: v[pos.tc_eur]
        };
    });
}

/**
 * Numeros de fila de "Proyeccion" que pertenecen a `clave`+`origen`, con el clasificador: el
 * MISMO criterio nota-por-fila del retiro selectivo de PG, llevado a nivel de origen. La baja
 * de 'guardado' ya no arrastra filas shell, la de 'shell' borra solo shell, y 'recurrentes' y
 * 'otros' se vuelven borrables. Para 'base' el resultado es identico al historico.
 */
function _filasDelPeriodoPa(hoja, clave, origen) {
    return _leerTodasFilasPa(hoja).filter(function (f) {
        const partes = _origenNotaPa(f.nota, f.fecha);
        return !!partes && partes.origen === origen && partes.clave === clave;
    }).map(function (f) { return f.fila; });
}

// ============================================
// TOTALES POR BLOQUE Y MONEDA (nunca sumar monedas distintas, ver cabecera)
// ============================================

/** Ordena una lista de monedas segun MONEDAS_DISPONIBLES, para que la salida sea determinista. */
function _ordenMonedasPa(monedas) {
    const orden = MONEDAS_DISPONIBLES;
    return monedas.slice().sort(function (a, b) { return orden.indexOf(a) - orden.indexOf(b); });
}

/** Las monedas que aparecen en un conjunto de filas crudas, en el orden de MONEDAS_DISPONIBLES. */
function _monedasEnFilasPa(filasCrudas) {
    const vistas = {};
    filasCrudas.forEach(function (f) { if (f.moneda) vistas[f.moneda] = true; });
    return _ordenMonedasPa(Object.keys(vistas));
}

/**
 * { ingresos: [{moneda,monto}], fijos: [...], variables: [...], neto: [...], otrasFilas: N }.
 * Ver cabecera: nunca suma monedas distintas entre si; el neto cubre la UNION de monedas de los
 * tres bloques, con 0 por defecto en el bloque donde una moneda no tuvo movimiento.
 */
function _totalesPorBloquePa(filasCrudas) {
    const acumIngresos = {}, acumFijos = {}, acumVariables = {};
    const acumPorBloque = { ingresos: acumIngresos, fijos: acumFijos, variables: acumVariables };
    let otrasFilas = 0;

    filasCrudas.forEach(function (f) {
        const bloque = PA_CATEGORIA_A_CLAVE[f.tipoCuenta];
        if (!bloque) { otrasFilas++; return; }
        const moneda = f.moneda || 'ARS';
        const monto = isFinite(f.monto) ? f.monto : 0;
        acumPorBloque[bloque][moneda] = (acumPorBloque[bloque][moneda] || 0) + monto;
    });

    const arrayDe = function (acum) {
        return _ordenMonedasPa(Object.keys(acum)).map(function (m) { return { moneda: m, monto: acum[m] }; });
    };

    const monedasUnion = {};
    [acumIngresos, acumFijos, acumVariables].forEach(function (acum) {
        Object.keys(acum).forEach(function (m) { monedasUnion[m] = true; });
    });
    const neto = _ordenMonedasPa(Object.keys(monedasUnion)).map(function (m) {
        return { moneda: m, monto: (acumIngresos[m] || 0) - (acumFijos[m] || 0) - (acumVariables[m] || 0) };
    });

    return { ingresos: arrayDe(acumIngresos), fijos: arrayDe(acumFijos), variables: arrayDe(acumVariables),
              neto: neto, otrasFilas: otrasFilas };
}

// ============================================
// SELLO Y RESPALDO (copia deliberada de _respaldarFilasPg con PA_PREFIJO_RESPALDO, ver cabecera)
// ============================================

// Resolucion de segundos, mismo criterio y misma razon que _selloPg (DEVTOOL_PresupuestoGuardar.js):
// es la unica pieza que distingue dos operaciones de este ABM que caigan en el mismo minuto.
function _selloPa() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
}

/**
 * Congela el contenido (B:M, valores crudos) de `filas` de "Proyeccion" en una hoja nueva,
 * oculta, y la RELEE para verificar. Copia deliberada de `_respaldarFilasPg`
 * (DEVTOOL_PresupuestoGuardar.js) con `PA_PREFIJO_RESPALDO` en vez de `PG_PREFIJO_RESPALDO`: esa
 * funcion hardcodea su propio prefijo, asi que no se puede parametrizar sin tocar ese archivo.
 */
function _respaldarFilasPa(ss, hojaProy, filas, sello) {
    const cfg = RANGES.REGISTROS;
    const colIni = columnLetterToIndex(cfg.start);
    const ancho = columnLetterToIndex(cfg.end) - colIni + 1;
    const nombre = _nombreHojaLibreFormulerio(ss, PA_PREFIJO_RESPALDO + sello);

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
        throw new Error('El respaldo de filas quedo en "' + nombre + '" pero NO VERIFICA: ' +
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
    logInfo('_respaldarFilasPa: ' + filas.length + ' fila(s) de "' + hojaProy.getName() + '" respaldadas en "' + nombre + '".');
    return { nombre: nombre, filas: filas.length };
}

// ============================================
// PUBLICAS -- consumidas via google.script.run desde 11_UIService.js (appscript-ui)
// ============================================

/**
 * Ping trivial para el experimento de aislamiento del canal `google.script.run` (ver cabecera:
 * INCIDENTE 2026-08-25). NO toca `SpreadsheetApp`, `PropertiesService` ni ninguna API externa --
 * no lee absolutamente nada, siempre devuelve el mismo objeto minimo y constante. El modal la
 * llama PRIMERO, antes de `listarPeriodosProyeccion()`: si este ping tambien falla via
 * `google.script.run`, el canal de este modal esta roto para CUALQUIER llamada y
 * `listarPeriodosProyeccion()` no tiene nada que ver; si el ping anda y el listado sigue
 * fallando, el canal esta bien y el problema es especifico de esa funcion o de su respuesta.
 */
// decision Franco 2026-08-25: el ping deja una HUELLA del lado del servidor antes de devolver
// nada. Sirve para bisecar el fallo del canal sin depender de ningun gesto: si la huella aparece,
// la llamada LLEGO y la funcion CORRIO, y el problema esta en el viaje de VUELTA (respuesta,
// serializacion, canal de retorno). Si no aparece, la llamada nunca salio del cliente y el
// problema esta en la IDA -- y entonces lo que devuelva la funcion es irrelevante.
// La huella la lee Y LA BORRA el DIAG (DEVTOOL_DIAG_PermisoProyeccionAbm.js), para que cada
// medicion empiece en cero: leer la marca de la corrida anterior seria concluir "llego" cuando
// no llego.
const PA_PROP_HUELLA_PING = 'ping_abm_ultimo';

function pingProyeccionAbm() {
    // El instrumento NO puede romper lo que mide: si escribir la huella fallara, el ping tiene
    // que llegar igual a devolver su respuesta, porque lo que se esta midiendo es el canal y no
    // el almacenamiento. El riesgo de tragarse el error -- leer "no hay huella" y concluir "no
    // llego" cuando en realidad si llego y fallo la escritura -- lo cubre el DIAG por otro lado:
    // su paso 2 verifica de forma independiente que PropertiesService sea accesible, y hoy
    // reporta 36 propiedades guardadas. Si ese paso dijera que no es accesible, la huella no
    // seria concluyente y hay que decirlo antes de interpretar nada.
    try {
        PropertiesService.getDocumentProperties()
            .setProperty(PA_PROP_HUELLA_PING, String(new Date().getTime()));
    } catch (e) {
        Logger.log('[pingProyeccionAbm] no se pudo sellar la huella: ' + e.message);
    }
    return { mensaje: 'pong', ts: Date.now() };
}

/**
 * Agrupa TODAS las filas de "Proyeccion" en las cinco poblaciones de PA_ORIGENES, en una sola
 * pasada con el clasificador. Solo lectura. Una hoja "Proyeccion" que no existe o dejo de
 * espejar a "Registros" hace TIRAR esta funcion (via `_preflightPb`, con un mensaje que ya
 * nombra el desvio exacto).
 *
 * PAYLOAD ACOTADO (ver INCIDENTE en la cabecera): `crudasFilas` es interno -- alimenta los
 * totales y NUNCA sale en la respuesta. Cada grupo devuelve EXACTAMENTE
 * { clave, mesLabel, nFilas, corridas, ultimoSello, totales, otrasFilas }: la respuesta es
 * O(grupos), no escala con el numero de filas.
 */
function listarPeriodosProyeccion() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const todas = _leerTodasFilasPa(pre.hoja);

    const mapas = { guardado: {}, shell: {}, recurrentes: {}, base: {}, otros: {} };
    todas.forEach(function (f) {
        const partes = _origenNotaPa(f.nota, f.fecha);
        // Sin ninguna marca: cargado a mano en el ledger real, o ruido. Fuera del alcance de
        // este ABM -- nunca se toca, nunca se cuenta (ver cabecera).
        if (!partes) return;
        const mapa = mapas[partes.origen];
        if (!mapa[partes.clave]) mapa[partes.clave] = { crudasFilas: [], sellos: {} };
        mapa[partes.clave].crudasFilas.push(f);
        if (partes.sello) mapa[partes.clave].sellos[partes.sello] = true;
    });

    const armarGrupo = function (clave, datos) {
        const periodo = _fechaDesdeClavePa(clave);
        const totales = _totalesPorBloquePa(datos.crudasFilas);
        // Dentro de un grupo todos los sellos comparten forma, asi que el orden lexicografico
        // ES el cronologico: el ultimo del sort es la corrida mas reciente.
        const sellos = Object.keys(datos.sellos).sort();
        return {
            clave: clave,
            mesLabel: periodo ? _mesLabelPa(periodo.getFullYear(), periodo.getMonth()) : 'Sin mes reconocible',
            nFilas: datos.crudasFilas.length,
            corridas: sellos.length,
            ultimoSello: sellos.length ? sellos[sellos.length - 1] : null,
            totales: totales,
            otrasFilas: totales.otrasFilas
        };
    };

    // Orden desc por clave (mas reciente primero): 'YYYY-MM' ordena lexicograficamente igual
    // que cronologicamente. 'sin-fecha' (solo posible en 'otros') va SIEMPRE al final.
    const clavesDesc = function (mapa) {
        const claves = Object.keys(mapa).filter(function (c) { return c !== 'sin-fecha'; }).sort().reverse();
        if (mapa['sin-fecha']) claves.push('sin-fecha');
        return claves;
    };

    const grupos = {};
    PA_ORIGENES.forEach(function (origen) {
        grupos[origen] = clavesDesc(mapas[origen]).map(function (c) { return armarGrupo(c, mapas[origen][c]); });
    });

    return { grupos: grupos };
}

/**
 * Valida el par `clave`+`origen` de detalle/baja: origen debe ser uno de PA_ORIGENES; la clave
 * es 'YYYY-MM' valida, o el literal 'sin-fecha' SOLO con origen 'otros' (la validacion de
 * `_fechaDesdeClavePa` no se relaja para los demas origenes). Tira nombrando el desvio.
 */
function _validarClaveOrigenPa(clave, origen) {
    if (PA_ORIGENES.indexOf(origen) === -1) {
        throw new Error('origen invalido: "' + origen + '" (debe ser uno de: ' + PA_ORIGENES.join(', ') + ').');
    }
    if (clave === 'sin-fecha') {
        if (origen !== 'otros') {
            throw new Error('la clave "sin-fecha" solo existe para el origen "otros".');
        }
        return;
    }
    if (!_fechaDesdeClavePa(clave)) {
        throw new Error('clave invalida: "' + clave + '" (formato esperado "YYYY-MM").');
    }
}

/**
 * El detalle fila por fila de un periodo+origen puntual. Solo lectura. `clave`+`origen` invalidos
 * tiran; una clave+origen SIN ninguna fila (carrera con otra pestana, doble click) NO es un
 * error: devuelve `filas: []`. Cada fila suma `notaLibre` (la nota del shell o el nombre del
 * recurrente) y `editable`: solo 'guardado' y 'shell' se editan -- las del shell son decisiones
 * deliberadas del usuario; base sigue igual; recurrentes y otros NO son editables.
 */
function detalleFilasPeriodoProyeccion(clave, origen) {
    _validarClaveOrigenPa(clave, origen);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const todas = _leerTodasFilasPa(pre.hoja);

    const delGrupo = [];
    todas.forEach(function (f) {
        const partes = _origenNotaPa(f.nota, f.fecha);
        if (partes && partes.origen === origen && partes.clave === clave) {
            delGrupo.push({ f: f, notaLibre: partes.notaLibre || '' });
        }
    });
    delGrupo.sort(function (a, b) { return a.f.fila - b.f.fila; });

    const editable = (origen === 'guardado' || origen === 'shell');
    const filas = delGrupo.map(function (par) {
        const f = par.f;
        return {
            fila: f.fila, cuenta: f.cuenta, tipoCuenta: f.tipoCuenta, tipo: f.tipo, monto: f.monto,
            moneda: f.moneda,
            fecha: (f.fecha instanceof Date && !isNaN(f.fecha.getTime())) ? f.fecha.toISOString() : null,
            tcArs: f.tcArs, tcUsd: f.tcUsd, tcAud: f.tcAud, tcEur: f.tcEur,
            notaLibre: par.notaLibre,
            editable: editable
        };
    });

    const periodo = clave === 'sin-fecha' ? null : _fechaDesdeClavePa(clave);
    return {
        clave: clave, origen: origen,
        mesLabel: periodo ? _mesLabelPa(periodo.getFullYear(), periodo.getMonth()) : 'Sin mes reconocible',
        filas: filas, totales: _totalesPorBloquePa(delGrupo.map(function (par) { return par.f; }))
    };
}

/**
 * Borra TODAS las filas de `clave`+`origen`, con respaldo previo y verificacion. Si algo no
 * verifica, intenta reponer desde el respaldo automaticamente antes de tirar. Solo la ULTIMA
 * baja aplicada es reversible (`revertirBajaProyeccionAbm`): guardar una nueva PISA el registro
 * de la anterior sin avisar -- misma limitacion que `revertirGuardarProyeccion`.
 */
function eliminarPeriodoProyeccion(clave, origen) {
    _validarClaveOrigenPa(clave, origen);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const hoja = pre.hoja;

    const filas = _filasDelPeriodoPa(hoja, clave, origen);
    if (!filas.length) {
        throw new Error('No hay ninguna fila de "' + clave + '" (' + origen + ') en "' + SHEETS.PROYECCION +
            '" para borrar: probablemente ya se borro en otra pestana o es un doble click. No se hizo nada.');
    }

    const sello = _selloPa();
    let respaldo = null;
    try {
        respaldo = _respaldarFilasPa(ss, hoja, filas, sello);

        _borrarGeneradasPb(hoja, filas);
        SpreadsheetApp.flush();

        const quedan = _filasDelPeriodoPa(hoja, clave, origen);
        if (quedan.length) {
            throw new Error('Quedaron ' + quedan.length + ' fila(s) sin borrar de "' + clave + '" (' + origen + ').');
        }
    } catch (e) {
        let restaurado = '';
        if (respaldo) {
            try {
                const backup = ss.getSheetByName(respaldo.nombre);
                const matrizBackup = backup ? _leerRespaldoFilasPg(backup) : [];
                if (matrizBackup.length) {
                    const yaQuedan = _filasDelPeriodoPa(hoja, clave, origen);
                    if (yaQuedan.length) _borrarGeneradasPb(hoja, yaQuedan);
                    _escribirAlPieProyeccionPg(hoja, matrizBackup);
                    SpreadsheetApp.flush();
                }
                restaurado = ' Se revirtio: se repusieron las filas desde el respaldo "' + respaldo.nombre + '".';
            } catch (e2) {
                restaurado = ' ADEMAS fallo la reversion automatica (' + e2.message + '). El respaldo sigue en "' +
                    respaldo.nombre + '": revision manual.';
            }
        }
        throw new Error('NO SE BORRO "' + clave + '" (' + origen + '): ' + e.message + restaurado);
    }

    PropertiesService.getDocumentProperties().setProperty(PA_PROP_PREVIOS_BAJA, JSON.stringify({
        respaldo: respaldo.nombre, clave: clave, origen: origen, filas: filas.length
    }));

    logSuccess('eliminarPeriodoProyeccion: ' + filas.length + ' fila(s) de ' + clave + ' (' + origen + ') borradas.');
    return { clave: clave, origen: origen, filasBorradas: filas.length, respaldo: respaldo.nombre };
}

/** Repone la ULTIMA baja aplicada por este ABM (solo una, ver `eliminarPeriodoProyeccion`). */
function revertirBajaProyeccionAbm() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();
    const crudo = props.getProperty(PA_PROP_PREVIOS_BAJA);
    if (!crudo) throw new Error('No hay ninguna baja de este ABM para revertir.');
    const previos = JSON.parse(crudo);

    const pre = _preflightPb(ss);
    const hoja = pre.hoja;

    const backup = ss.getSheetByName(previos.respaldo);
    if (!backup) {
        throw new Error('La hoja de respaldo "' + previos.respaldo + '" ya no existe: no se puede revertir la ' +
            'baja de "' + previos.clave + '" (' + previos.origen + ').');
    }
    const matrizBackup = _leerRespaldoFilasPg(backup);
    if (!matrizBackup.length) {
        throw new Error('El respaldo "' + previos.respaldo + '" esta vacio: no hay nada que reponer.');
    }

    _escribirAlPieProyeccionPg(hoja, matrizBackup);
    SpreadsheetApp.flush();

    // decision Franco 2026-08-29: la verificacion compara contra el conteo de filas del
    // RESPALDO que clasifican a (clave, origen), no contra previos.filas. Un respaldo legado
    // (una baja 'guardado' pre-cambio que arrastro filas shell mezcladas) se repone ENTERO,
    // pero el conteo por origen puro daria menos que previos.filas y esto fallaria en falso
    // con las filas ya repuestas.
    const cfgRv = RANGES.REGISTROS;
    const colIniRv = columnLetterToIndex(cfgRv.start);
    const idxNotaRv = columnLetterToIndex(cfgRv.columns.nota) - colIniRv;
    const idxFechaRv = columnLetterToIndex(cfgRv.columns.fecha) - colIniRv;
    let esperadas = 0;
    matrizBackup.forEach(function (vals) {
        const partes = _origenNotaPa(vals[idxNotaRv], vals[idxFechaRv]);
        if (partes && partes.origen === previos.origen && partes.clave === previos.clave) esperadas++;
    });

    const repuestas = _filasDelPeriodoPa(hoja, previos.clave, previos.origen);
    if (repuestas.length < esperadas) {
        throw new Error('Se intento reponer ' + matrizBackup.length + ' fila(s) pero solo se verifican ' +
            repuestas.length + ' de "' + previos.clave + '" (' + previos.origen + ') contra ' + esperadas +
            ' esperadas del respaldo. Revisar "' + SHEETS.PROYECCION + '" a mano; el respaldo sigue en "' +
            previos.respaldo + '".');
    }

    props.deleteProperty(PA_PROP_PREVIOS_BAJA);

    logSuccess('revertirBajaProyeccionAbm: ' + matrizBackup.length + ' fila(s) repuestas de ' + previos.clave + ' (' + previos.origen + ').');
    return { clave: previos.clave, origen: previos.origen, filasRepuestas: matrizBackup.length };
}

/**
 * Valida `nuevoMonto` como numero finito, o devuelve null. NO usa `isFinite(Number(v))` solo:
 * `Number('')` da 0 (finito) en JS, asi que un campo vacio pasaria como "monto cero" en vez de
 * rechazarse -- exactamente lo que el encargo pide rechazar ("vacio"). Se corta ANTES de convertir.
 */
function _montoValidoPa(v) {
    if (v === null || v === undefined) return null;
    if (String(v).trim() === '') return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
}

/**
 * Corrige el monto de UNA fila, con el gate de seguridad del lado del servidor (decision 2),
 * ahora POR ORIGEN via el clasificador: solo 'guardado' y 'shell' se editan (las del shell son
 * decisiones deliberadas del usuario). 'base', 'recurrentes', 'otros' y sin-marca se rechazan
 * cada una con su mensaje propio, y cualquier `nuevoMonto` que no sea un numero finito tambien
 * (ver `_montoValidoPa`). Respalda la fila completa antes de escribir. El retorno agrega
 * `origen` para el mensaje del cliente; el resto es identico al historico.
 */
function actualizarMontoFilaProyeccion(fila, nuevoMonto) {
    const filaNum = parseInt(fila, 10);
    if (!isFinite(filaNum)) throw new Error('El numero de fila "' + fila + '" no es valido.');

    const montoNuevoNum = _montoValidoPa(nuevoMonto);
    if (montoNuevoNum === null) {
        throw new Error('El nuevo monto "' + nuevoMonto + '" no es un numero valido.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const pre = _preflightPb(ss);
    const hoja = pre.hoja;
    const cfg = RANGES.REGISTROS;

    const ultima = hoja.getLastRow();
    if (filaNum < cfg.dataRow || filaNum > ultima) {
        throw new Error('La fila ' + filaNum + ' esta fuera del rango de datos vivo de "' + SHEETS.PROYECCION +
            '" (' + cfg.dataRow + ' a ' + ultima + ').');
    }

    const colNota = columnLetterToIndex(cfg.columns.nota);
    const colFecha = columnLetterToIndex(cfg.columns.fecha);
    const nota = String(hoja.getRange(filaNum, colNota).getValue() || '');
    const partes = _origenNotaPa(nota, hoja.getRange(filaNum, colFecha).getValue());
    const origen = partes ? partes.origen : null;
    if (origen === 'base') {
        throw new Error('Esta fila no es un guardado manual: las filas de presupuesto base se recalculan ' +
            'corriendo de nuevo ese modulo, no se editan a mano.');
    }
    if (origen === 'recurrentes') {
        throw new Error('Esta fila es un volcado de recurrentes: el monto se corrige en la vista de ' +
            'Recurrentes y se vuelve a volcar el mes.');
    }
    if (origen !== 'guardado' && origen !== 'shell') {
        throw new Error('No se reconoce el origen de esta fila: no se edita desde este ABM.');
    }

    const colMonto = columnLetterToIndex(cfg.columns.monto);
    const colCuenta = columnLetterToIndex(cfg.columns.cuenta);
    const colMoneda = columnLetterToIndex(cfg.columns.moneda);
    const montoAnterior = Number(hoja.getRange(filaNum, colMonto).getValue());
    const cuenta = String(hoja.getRange(filaNum, colCuenta).getValue() || '');
    const moneda = String(hoja.getRange(filaNum, colMoneda).getValue() || '');

    const sello = _selloPa();
    const respaldo = _respaldarFilasPa(ss, hoja, [filaNum], sello);

    try {
        hoja.getRange(filaNum, colMonto).setValue(montoNuevoNum);
        SpreadsheetApp.flush();

        const releido = Number(hoja.getRange(filaNum, colMonto).getValue());
        if (releido !== montoNuevoNum) {
            throw new Error('el monto releido (' + releido + ') no coincide con el escrito (' + montoNuevoNum + ')');
        }
    } catch (e) {
        let restaurado = '';
        try {
            hoja.getRange(filaNum, colMonto).setValue(montoAnterior);
            SpreadsheetApp.flush();
            restaurado = ' Se revirtio al valor anterior (' + montoAnterior + ').';
        } catch (e2) {
            restaurado = ' ADEMAS fallo la reversion automatica (' + e2.message + '). El respaldo sigue en "' +
                respaldo.nombre + '": revision manual.';
        }
        throw new Error('NO SE ACTUALIZO la fila ' + filaNum + ': ' + e.message + restaurado);
    }

    PropertiesService.getDocumentProperties().setProperty(PA_PROP_PREVIOS_EDICION, JSON.stringify({
        respaldo: respaldo.nombre, fila: filaNum, montoAnterior: montoAnterior, montoNuevo: montoNuevoNum
    }));

    logSuccess('actualizarMontoFilaProyeccion: fila ' + filaNum + ' de ' + montoAnterior + ' a ' + montoNuevoNum + '.');
    return { fila: filaNum, cuenta: cuenta, clave: partes ? partes.clave : null, origen: origen,
              moneda: moneda, montoAnterior: montoAnterior, montoNuevo: montoNuevoNum };
}

/** Repone la ULTIMA edicion de monto aplicada por este ABM, leyendo el valor original del respaldo. */
function revertirEdicionMontoProyeccion() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const props = PropertiesService.getDocumentProperties();
    const crudo = props.getProperty(PA_PROP_PREVIOS_EDICION);
    if (!crudo) throw new Error('No hay ninguna edicion de este ABM para revertir.');
    const previos = JSON.parse(crudo);

    const pre = _preflightPb(ss);
    const hoja = pre.hoja;
    const cfg = RANGES.REGISTROS;

    const ultima = hoja.getLastRow();
    if (previos.fila < cfg.dataRow || previos.fila > ultima) {
        throw new Error('La fila ' + previos.fila + ' de la edicion registrada ya no existe en "' +
            SHEETS.PROYECCION + '". No se pudo revertir.');
    }

    const backup = ss.getSheetByName(previos.respaldo);
    if (!backup) {
        throw new Error('La hoja de respaldo "' + previos.respaldo + '" ya no existe: no se puede revertir la ' +
            'edicion de la fila ' + previos.fila + '.');
    }
    const matrizBackup = _leerRespaldoFilasPg(backup);
    if (!matrizBackup.length) {
        throw new Error('El respaldo "' + previos.respaldo + '" esta vacio: no hay nada que reponer.');
    }

    const colIni = columnLetterToIndex(cfg.start);
    const idxMonto = columnLetterToIndex(cfg.columns.monto) - colIni;
    const montoOriginal = Number(matrizBackup[0][idxMonto]);
    const colMonto = columnLetterToIndex(cfg.columns.monto);

    hoja.getRange(previos.fila, colMonto).setValue(montoOriginal);
    SpreadsheetApp.flush();

    const releido = Number(hoja.getRange(previos.fila, colMonto).getValue());
    if (releido !== montoOriginal) {
        throw new Error('Se intento revertir la fila ' + previos.fila + ' pero el monto releido (' + releido +
            ') no coincide con el original del respaldo (' + montoOriginal + '). Revisar "' + SHEETS.PROYECCION +
            '" a mano; el respaldo sigue en "' + previos.respaldo + '".');
    }

    props.deleteProperty(PA_PROP_PREVIOS_EDICION);

    logSuccess('revertirEdicionMontoProyeccion: fila ' + previos.fila + ' restaurada a ' + montoOriginal + '.');
    return { fila: previos.fila, montoRestaurado: montoOriginal };
}
