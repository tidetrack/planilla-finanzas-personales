/**
 * DEVTOOL_RiquezaYCategorias.js
 * Lleva la definicion de RIQUEZA de lista negra a lista blanca, y llena la columna del Tipo
 * en el bloque de categorias del Tablero.
 *
 * [CONCEPTO DE NEGOCIO]
 * "Cuanto tengo" y "cuanto gasto" son dos preguntas distintas y la planilla las mezclaba.
 * Hasta hoy el capital acumulado se calculaba como "todo lo que no sea Hogar", asi que una
 * TARJETA DE CREDITO sumaba como patrimonio. Una tarjeta es un pasivo: lo que debe entrar a la
 * situacion patrimonial es lo que efectivamente construye riqueza -- Ahorros e Inversiones --
 * y nada mas. El resto de los tipos (Hogar, Financiacion, y los que se agreguen) son
 * macrosegmentaciones de analisis: sirven para leer en que se va la plata, no para sumar
 * capital.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es la distincion contable entre situacion patrimonial y flujo de fondos. Arnes Tidetrack
 * seccion 6: la regla de negocio vive en el SSOT (TIPOS_RIQUEZA en 00_Config.js), no repartida
 * por catorce formulas. Cicatriz 5: el verificador comprueba el VALOR resultante, no solo que
 * el texto haya ido y vuelto.
 *
 * ============================================================================
 * DOS USOS DEL TIPO DE CATEGORIA QUE SE PARECEN Y NO SE TOCAN IGUAL
 * ============================================================================
 * Esta es LA trampa de este cambio, y la razon por la que el modulo trabaja sobre una lista
 * cerrada de seis celdas en vez de barrer la planilla reemplazando "Hogar":
 *
 *   (a) "ES RIQUEZA?"  -> pasa a lista blanca. Son las que ligan cond_riqueza / cond_ahorro:
 *       "Inicio"!F8 (Capital Acumulado), "Tablero"!N19 (Capitalizacion real) y
 *       "Tablero"!AG9:AG12 (capital por moneda). SEIS celdas.
 *
 *   (b) "ES FLUJO COTIDIANO?" -> sigue siendo Hogar y NO SE TOCA. Son los bloques que dejan
 *       entrar los arrastres 'Inicio Mes' cuando el medio es de casa ("Inicio"!C13/F13/C15/F15,
 *       "Tablero"!R9/U9/X9) y los saldos cotidianos ("Inicio"!C8, "Tablero"!AF9:AF12, que
 *       ademas filtran por NOMBRE de categoria y no por tipo). DIEZ celdas.
 *
 * Confundirlas romperia el saldo cotidiano, que hoy cierra al centavo contra el ledger.
 * Por eso la lista de celdas es explicita y el preflight verifica que cada una contenga el
 * patron que se va a reemplazar antes de tocarla.
 *
 * ============================================================================
 * LA COLUMNA DEL TIPO EN EL BLOQUE DE CATEGORIAS
 * ============================================================================
 * "Tablero"!AA9 derrama tres columnas: AA=categoria, AB=vacia, AC=monto. El rotulo AB8 YA DICE
 * "Tipo" desde el rediseno -- la columna se diseno para eso y quedo sin llenar, con una
 * variable que la formula llama literalmente `columna_ak_vacia` y que devuelve "" siempre.
 * Este modulo la llena con el tipo de cada categoria y le pone un nombre honesto.
 *
 * Y le saca el filtro por tipo: el bloque mostraba solo las categorias que NO eran Hogar. Con
 * el Tipo a la vista, el bloque pasa a ser la lectura completa por macrosegmento -- que es
 * justamente para lo que sirve tener el tipo al lado. Si Franco prefiere que siga ocultando el
 * gasto de casa, se revierte el filtro y listo: es una linea.
 *
 * ============================================================================
 * QUE NO HACE
 * ============================================================================
 * 1. NO toca el catalogo. La decision de si 'Financiacion' debe partirse en 'Tarjetas' y
 *    'Financiamiento' quedo tomada el 2026-08-19: se deja como esta.
 * 2. NO redacta formulas enteras. Todo es cirugia de tokens sobre el texto que ya vive en la
 *    celda; lo unico que se autoriza es el fragmento del VLOOKUP del tipo, y su validez la
 *    comprueba la relectura del valor.
 * 3. NO cambia como se computa el saldo por medio ni el bloque de Movimientos del Mes. Son
 *    otros dos frentes abiertos, con sus propias decisiones.
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoRiquezaCategorias()    -> solo lectura, dice que cambiaria. Se corre PRIMERO.
 *   aplicarRiquezaCategorias()   -> preflight + respaldo verificado + escritura + relectura.
 *   revertirRiquezaCategorias()  -> restaura desde el respaldo de la ultima corrida.
 *
 * DEPENDE de tres helpers ya probados de DEVTOOL_FormulerioV0111.js: _respaldarFormulerio
 * (congela y verifica todas las formulas de las dos hojas), _leerRespaldoFormulerio y
 * _errorDeCelda. Se reusan a proposito en vez de duplicarlos: son genericos y estan probados
 * en produccion. Si ese modulo se retira, estos tres helpers se mudan, no se copian.
 *
 * ============================================================================
 * ESTADO AL 2026-08-21 -- RIQ_CELDAS quedo en gran parte OBSOLETO, y se deja asi a proposito
 * ============================================================================
 * Medido contra el gemelo del 2026-08-21 (docs/permanente/celdas.tsv) con devtools/probar_riqueza.js:
 *
 *   - "Inicio"!F8 ya NO es la formula que este modulo espera reemplazar. Desde v0.32.0 la
 *     mantiene DEVTOOL_InicioPresupuesto.js, con una estructura completamente distinta (ya trae
 *     el filtro Ahorros+Inversiones incorporado). El patron `_aListaBlanca` no matchea porque no
 *     hay nada que matchear: la celda pertenece a otro modulo. No se toca.
 *   - "Tablero"!AG9:AG12 tampoco son las que se buscan. En este layout viven CUATRO CELDAS con
 *     ese nombre de coordenada, en dos bloques distintos: filas 9-12 es "Tipo de Medios" (bloque
 *     nuevo, DEVTOOL_StockYFlujo.js SYF_TIPOS_TABLERO, agrupa por Ahorros/Financiacion/Hogar/
 *     Inversiones) y filas 18-21 es "Saldos Actuales" (SYF_SALDOS_TABLERO), que es el sucesor real
 *     de lo que esta constante llama "Capital ARS/USD/AUD/EUR". El bloque que RIQ_CELDAS declara
 *     administrar en AG9:AG12 se corrio a AG18:AG21 cuando "Tipo de Medios" se inserto arriba
 *     -- y esa correccion ya no es trabajo de este modulo: DEVTOOL_StockYFlujo.js escribe y
 *     verifica ese bloque con su propio preflight por rotulo.
 *   - "Tablero"!N19 (Capitalizacion real del mes) esta VACIA (sin formula, sin valor): la celda
 *     de este concepto es hoy "Tablero"!O19, y la escribe DEVTOOL_Capitalizacion.js (decision
 *     Franco 2026-08-20: "N19 no debe ser una resta de descarte. Aca si va el valor registrado
 *     del mes").
 *
 * Ninguna de las tres se corrige aca: no le pertenecen mas a este modulo, y reapuntarlas
 * duplicaria el trabajo que YA hacen DEVTOOL_InicioPresupuesto.js, DEVTOOL_StockYFlujo.js y
 * DEVTOOL_Capitalizacion.js con su propia geometria medida en vivo. Se documenta aca para que la
 * proxima persona que mida "por que RIQ_CELDAS no cambia nada" no repita la investigacion.
 *
 * RIQ_BLOQUE_CATEGORIAS se corrio de fila por el mismo rediseno del 2026-08-21 (ver
 * DEVTOOL_FormulerioV0111.js, "EL RECORRIDO DEL 2026-08-21"): AA9 -> AA10, AB8 -> AB9.
 *
 * CORRECCION 2026-08-21: hasta hoy esta cabecera afirmaba que AA10 era "EXCLUSIVA de este modulo
 * (ningun otro la escribe)". ERA FALSO: la declaraban tambien DEVTOOL_FormulerioV0111.js
 * (FORM_CELDAS) y DEVTOOL_BloqueCategorias.js (BCAT_CELDA). Por decision de Franco del 2026-08-21
 * el duenio unico es DEVTOOL_BloqueCategorias.js, y este modulo dejo de tocarla (ver _planRiqueza).
 *
 * CONSECUENCIA: con RIQ_CELDAS retirada y AA10 fuera de jurisdiccion, ESTE MODULO NO ADMINISTRA
 * NINGUNA CELDA. Sus tres publicas siguen existiendo y contestan explicitamente que no les queda
 * trabajo. Retirarlo del menu (00_Config.js, submenu "Riqueza y categorias") y del repo es una
 * decision aparte, pendiente de Franco: es sacar un modulo, no reapuntar una coordenada.
 *
 * @version 0.13.1
 * @since 2026-08-19
 * @lastModified 2026-08-21
 * @see docs/permanente/FUNCIONALIDADES.md
 */

// ============================================
// CONSTANTES
// ============================================

const RIQ_PROP_APLICADO = 'riqueza_categorias_aplicado';
const RIQ_PROP_RESPALDO = 'riqueza_categorias_respaldo';

/**
 * Grupo (a): las celdas que responden "esto es riqueza?". Son las UNICAS que cambian de
 * criterio. La lista es explicita y cerrada a proposito (ver cabecera).
 */
/**
 * RETIRADA COMPLETA EL 2026-08-21 -- decision Franco. La lista queda VACIA a proposito.
 *
 * Las seis coordenadas que vivian aca (Inicio!F8, Tablero!N19 y Tablero!AG9:AG12) no se sacaron
 * por estar rotas: las seis tienen hoy otro duenio, verificado contra el gemelo celda por celda
 * (el detalle esta en la cabecera de este archivo, seccion "ESTADO AL 2026-08-21"). Se dejaban
 * declaradas "para no decidir por Franco"; el costo era que devtools/probar_riqueza.js arrancaba
 * con seis fallas fijas que habia que aprender a ignorar -- y un banco con rojo de fondo es
 * exactamente donde se esconde el rojo nuevo. Esa es la leccion cara de la v0.38.4, donde un banco
 * en verde tapo que StockYFlujo apuntaba a la celda equivocada.
 *
 * Los duenios reales: Inicio!F8 -> DEVTOOL_StockYFlujo.js; Tablero!N19 -> DEVTOOL_Capitalizacion.js
 * (en O19); Tablero!AG9:AG12 -> DEVTOOL_StockYFlujo.js (esas filas son hoy "Tipo de Medios",
 * SYF_TIPOS_TABLERO; el "Capital" que esta lista describia vive en AG18:AG21, SYF_SALDOS_TABLERO).
 *
 * La lista se deja declarada y vacia en vez de borrarse: si alguna vez vuelve a haber una celda de
 * riqueza que sea de este modulo, entra aca. `_aListaBlanca` se conserva por la misma razon y
 * porque devtools/probar_riqueza.js la sigue probando como regresion.
 */
const RIQ_CELDAS = [];

/**
 * El bloque de categorias del Tablero: donde vive la columna del Tipo.
 *
 * Corrido de fila el 2026-08-21 (AA9 -> AA10, AB8 -> AB9): Franco le agrego una fila al bloque
 * para dejar lugar al "Faltante proyectado" (ver DEVTOOL_TableroFaltanteProyectado.js), y el
 * header que rotulaba la columna del Tipo bajo con el resto. celdaRotuloTipo sigue siendo la
 * defensa: si el rotulo vivo no dice "Tipo", el preflight aborta sin tocar nada.
 */
const RIQ_BLOQUE_CATEGORIAS = {
    hoja: 'TABLERO',
    celda: 'AA10',
    celdaRotuloTipo: 'AB9',
    rotuloTipoEsperado: 'Tipo',
    varVieja: 'columna_ak_vacia',
    varNueva: 'columna_tipo'
};

// ============================================
// PUBLICAS
// ============================================

/**
 * Solo lectura. Reporta que cambiaria, celda por celda, y con que impacto. No escribe nada.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function estadoRiquezaCategorias() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightRiqueza(ss);
        const plan = _planRiqueza(ss, pre);

        const lineas = [];
        lineas.push('RIQUEZA Y CATEGORIAS - ESTADO (no se escribio ninguna celda)');
        lineas.push('');
        lineas.push('Definicion de riqueza que se va a aplicar:');
        lineas.push('  ANTES: todo tipo de categoria que no sea "Hogar" (lista negra)');
        lineas.push('  AHORA: solo ' + TIPOS_RIQUEZA.join(' + ') + ' (lista blanca)');
        lineas.push('');
        lineas.push('Catalogo vivo: ' + pre.resumenCatalogo);
        lineas.push('');

        if (!plan.cambios.length) {
            // Con RIQ_CELDAS vacia y AA10 fuera de jurisdiccion, este modulo quedo SIN CELDAS.
            // Decirlo explicito en vez de "nada que hacer": un modulo que contesta lo mismo cuando
            // ya trabajo y cuando no le queda nada que hacer no le sirve a nadie.
            lineas.push('MODULO SIN CELDAS A CARGO. Las seis celdas de RIQ_CELDAS y el bloque de');
            lineas.push('categorias (' + RIQ_BLOQUE_CATEGORIAS.celda + ') se retiraron el 2026-08-21');
            lineas.push('(decision Franco): cada una tiene hoy otro duenio.');
            lineas.push('  Inicio!F8 y Tablero!AG9:AG12  -> DEVTOOL_StockYFlujo.js');
            lineas.push('  Tablero!N19 (hoy O19)         -> DEVTOOL_Capitalizacion.js');
            lineas.push('  Tablero!' + RIQ_BLOQUE_CATEGORIAS.celda + ' (categorias)      -> DEVTOOL_BloqueCategorias.js');
            lineas.push('');
            lineas.push('No hay nada que aplicar ni que revertir desde aca.');
            const t = lineas.join('\n');
            _mostrarRiqueza('Riqueza y categorias - estado', t);
            return { ok: true, detalle: t };
        }

        lineas.push('CAMBIOS PENDIENTES: ' + plan.cambios.length + ' celda(s)');
        lineas.push('');
        plan.cambios.forEach(function (c) {
            lineas.push('  ' + c.nombreHoja + '!' + c.celda + '  (' + c.nota + ')');
            lineas.push('      ' + c.resumen);
        });

        if (pre.fueraDeRiqueza.length) {
            lineas.push('');
            lineas.push('Lo que SALE del capital con este cambio (categorias que hoy suman y no deberian):');
            pre.fueraDeRiqueza.forEach(function (x) { lineas.push('  - ' + x); });
        }

        if (plan.avisos.length) {
            lineas.push('');
            lineas.push('Avisos:');
            plan.avisos.forEach(function (a) { lineas.push('  - ' + a); });
        }

        lineas.push('');
        lineas.push('NO se tocan las 10 celdas que preguntan por flujo cotidiano (Inicio C8/C13/F13/');
        lineas.push('C15/F15 y Tablero R9/U9/X9/AF9:AF12): esas siguen rigiendose por el tipo Hogar.');

        const detalle = lineas.join('\n');
        _mostrarRiqueza('Riqueza y categorias - estado', detalle);
        logInfo('estadoRiquezaCategorias: ' + plan.cambios.length + ' celda(s) pendientes.');
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarRiqueza('Riqueza y categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Aplica el cambio. Preflight que aborta sin tocar nada, respaldo congelado y VERIFICADO,
 * escritura, y relectura del VALOR de cada celda: si alguna queda en error, se revierte el
 * lote entero.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function aplicarRiquezaCategorias() {
    const escritas = [];
    let ss = null;
    let yaRevertido = false;
    let ui = null;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        return { ok: false, error: 'aplicarRiquezaCategorias necesita UI (correr desde el menu Tidetrack Dev).' };
    }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightRiqueza(ss);
        const plan = _planRiqueza(ss, pre);

        if (!plan.cambios.length) {
            const yaHecho = 'Ya estaba aplicado: las celdas de riqueza usan la lista blanca (' +
                TIPOS_RIQUEZA.join(' + ') + ') y el bloque de categorias ya trae el Tipo. ' +
                'No se escribio nada.';
            _mostrarRiqueza('Riqueza y categorias', yaHecho);
            return { ok: true, detalle: yaHecho };
        }

        const confirmacion = ui.alert(
            'Riqueza: pasar a lista blanca',
            'Se van a reescribir ' + plan.cambios.length + ' formula(s).\n\n' +
            'CAMBIA UN NUMERO QUE VENIS MIRANDO: el capital acumulado deja de incluir todo lo ' +
            'que no sea Hogar y pasa a incluir SOLO ' + TIPOS_RIQUEZA.join(' + ') + '. ' +
            'Concretamente, la Financiacion (tarjetas y prestamos) sale del patrimonio.\n\n' +
            'Antes de tocar nada se congela un respaldo de todas las formulas de "Inicio" y ' +
            '"Tablero" y se verifica releyendolo.\n\nCorriste antes "1. Ver estado"?\n\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (confirmacion !== ui.Button.YES) {
            return { ok: false, error: 'Cancelado por el operador. No se escribio ninguna celda.' };
        }

        const sello = _selloRiqueza();
        const respaldo = _respaldarFormulerio(ss, sello);

        plan.cambios.forEach(function (c) {
            const rango = ss.getSheetByName(c.nombreHoja).getRange(c.celda);
            const errorPrevio = _errorDeCelda(rango);
            rango.setFormula(c.formulaNueva);
            escritas.push({
                nombreHoja: c.nombreHoja, celda: c.celda,
                previa: c.formulaActual, nueva: c.formulaNueva, errorPrevio: errorPrevio
            });
        });

        SpreadsheetApp.flush();

        const fallas = _verificarEscrituraRiqueza(ss, escritas);
        if (fallas.length) {
            _revertirEscriturasRiqueza(ss, escritas);
            yaRevertido = true;
            throw new Error('Las formulas se escribieron pero NO VERIFICAN al releerlas: ' +
                fallas.join('; ') + '. Se restauro cada celda a su formula previa. ' +
                'El respaldo quedo en "' + respaldo.nombre + '".');
        }

        const props = PropertiesService.getDocumentProperties();
        props.setProperty(RIQ_PROP_APLICADO, sello);
        props.setProperty(RIQ_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'RIQUEZA Y CATEGORIAS APLICADO\n\n' +
            '- Celdas reescritas y verificadas: ' + escritas.length + '\n' +
            '- Riqueza = ' + TIPOS_RIQUEZA.join(' + ') + ' (antes: todo lo que no fuera Hogar)\n' +
            '- Respaldo congelado y verificado en la hoja oculta "' + respaldo.nombre + '"\n\n' +
            'QUE MIRAR AHORA:\n' +
            '  1. "Tablero"!AB9 y abajo: la columna Tipo del bloque de categorias, hasta hoy vacia.\n' +
            '  2. "Tablero"!N19 (Capitalizacion) e "Inicio"!F8 (Capital Acumulado): cambian, y en\n' +
            '     algunos meses bastante. Es el efecto buscado, no un error.\n' +
            '  3. Lo que NO tiene que haberse movido: "Inicio"!C8 y "Tablero"!AF9:AF12 (saldos\n' +
            '     cotidianos) y N16/N17/N18 (ingresos y gastos del mes). Si esos cambiaron, avisa:\n' +
            '     significa que se toco una celda del grupo equivocado.\n\n' +
            'Si algo quedo peor: Tidetrack Dev > Riqueza y categorias > 3. Revertir.';

        logSuccess('aplicarRiquezaCategorias: ' + escritas.length + ' celda(s) reparadas y verificadas.');
        _mostrarRiqueza('Riqueza y categorias - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        let restaurado = '';
        if (ss && escritas.length && !yaRevertido) {
            try {
                _revertirEscriturasRiqueza(ss, escritas);
                restaurado = ' Se restauraron las ' + escritas.length + ' celda(s) ya escritas.';
            } catch (e2) {
                restaurado = ' ADEMAS fallo la restauracion de las ' + escritas.length +
                    ' celda(s) ya escritas (' + e2.message + '): revisar el respaldo a mano.';
            }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack, escritas: escritas.length });
        _mostrarRiqueza('Riqueza y categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Restaura las formulas desde el respaldo de la ultima corrida aplicada.
 * @returns {{ok: boolean, detalle?: string, error?: string}}
 */
function revertirRiquezaCategorias() {
    let ui = null;
    try {
        ui = SpreadsheetApp.getUi();
    } catch (e) {
        return { ok: false, error: 'revertirRiquezaCategorias necesita UI (correr desde el menu Tidetrack Dev).' };
    }
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const props = PropertiesService.getDocumentProperties();
        const nombre = props.getProperty(RIQ_PROP_RESPALDO);
        if (!nombre) throw new Error('No hay ninguna corrida registrada, asi que no hay respaldo al que volver.');
        const hoja = ss.getSheetByName(nombre);
        if (!hoja) {
            throw new Error('La corrida registrada apunta al respaldo "' + nombre +
                '" y esa hoja ya no existe. No hay desde donde restaurar.');
        }
        const filas = _leerRespaldoFormulerio(hoja);
        if (!filas.length) throw new Error('El respaldo "' + nombre + '" no tiene ninguna formula registrada.');

        const conf = ui.alert(
            'Revertir riqueza y categorias',
            'Se van a restaurar ' + filas.length + ' formula(s) desde el respaldo "' + nombre +
            '".\n\nEso devuelve el capital acumulado a la definicion vieja, en la que la ' +
            'Financiacion (tarjetas y prestamos) vuelve a sumar como patrimonio, y vacia otra vez ' +
            'la columna Tipo del bloque de categorias.\n\nContinuar?',
            ui.ButtonSet.YES_NO
        );
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado por el operador. No se restauro nada.' };

        let n = 0;
        const noRestauradas = [];
        filas.forEach(function (f) {
            const h = ss.getSheetByName(f.nombreHoja);
            if (!h) { noRestauradas.push(f.nombreHoja + '!' + f.celda); return; }
            h.getRange(f.celda).setFormula(f.formula);
            n++;
        });
        SpreadsheetApp.flush();
        props.deleteProperty(RIQ_PROP_APLICADO);

        const detalle = 'REVERTIDO\n\n- Formulas restauradas: ' + n + ' de ' + filas.length + '\n' +
            (noRestauradas.length ? '- NO restauradas: ' + noRestauradas.join(', ') + '\n' : '') +
            '- Respaldo usado: "' + nombre + '" (se conserva)';
        logSuccess('revertirRiquezaCategorias: ' + n + ' formula(s) restauradas.');
        _mostrarRiqueza('Riqueza y categorias - revertido', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarRiqueza('Riqueza y categorias - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica que la planilla sea la que este modulo cree que es. Aborta lanzando ante cualquier
 * discrepancia: preferimos no hacer nada a escribir sobre una geometria que no entendemos.
 * @throws {Error}
 */
function _preflightRiqueza(ss) {
    const nombreInicio = NAV_CONFIG.SHEETS.INICIO;
    const nombreTablero = NAV_CONFIG.SHEETS.TABLERO;
    const hojaInicio = ss.getSheetByName(nombreInicio);
    const hojaTablero = ss.getSheetByName(nombreTablero);
    if (!hojaInicio) throw new Error('No existe la hoja "' + nombreInicio + '".');
    if (!hojaTablero) throw new Error('No existe la hoja "' + nombreTablero + '".');

    if (!TIPOS_RIQUEZA || !TIPOS_RIQUEZA.length) {
        throw new Error('TIPOS_RIQUEZA esta vacia en 00_Config.js. Con una lista blanca vacia ' +
            'el capital acumulado daria cero en todos los meses.');
    }

    // --- El catalogo tiene que contener los tipos de la lista blanca ---
    const cfg = RANGES.PROYECTOS;
    const hojaPC = ss.getSheetByName(cfg.sheet);
    if (!hojaPC) throw new Error('No existe la hoja "' + cfg.sheet + '".');
    const colIni = columnLetterToIndex(cfg.start);
    const nCols = columnLetterToIndex(cfg.end) - colIni + 1;
    const filaDatos = getDataRow(cfg);
    const alto = hojaPC.getMaxRows() - filaDatos + 1;
    const porTipo = {};
    const sinNombre = [];
    if (alto > 0) {
        hojaPC.getRange(filaDatos, colIni, alto, nCols).getValues().forEach(function (f) {
            const nombre = String(f[0] || '').trim();
            const tipo = String(f[1] || '').trim();
            if (!nombre && !tipo) return;
            if (!nombre) { sinNombre.push(tipo); return; }
            if (!porTipo[tipo]) porTipo[tipo] = [];
            porTipo[tipo].push(nombre);
        });
    }

    const faltantes = TIPOS_RIQUEZA.filter(function (t) { return !porTipo[t] || !porTipo[t].length; });
    if (faltantes.length) {
        throw new Error('El Plan de Cuentas no tiene ninguna categoria de tipo ' +
            faltantes.join(' ni ') + '. Aplicar la lista blanca dejaria el capital acumulado ' +
            'en cero. Tipos que si existen: ' +
            (Object.keys(porTipo).join(', ') || '(ninguno)') + '.');
    }

    // Lo que SALE de riqueza con el cambio: se reporta para que Franco lo vea antes de aplicar.
    const fueraDeRiqueza = [];
    Object.keys(porTipo).forEach(function (t) {
        if (t === 'Hogar') return;                       // ya estaba fuera
        if (TIPOS_RIQUEZA.indexOf(t) !== -1) return;     // sigue dentro
        fueraDeRiqueza.push('tipo "' + t + '": ' + porTipo[t].join(', '));
    });

    const resumen = Object.keys(porTipo).map(function (t) {
        return t + ' (' + porTipo[t].length + ')';
    }).join(', ') + (sinNombre.length ? ' | ' + sinNombre.length + ' fila(s) con tipo y sin nombre' : '');

    // --- El rotulo de la columna del Tipo tiene que decir lo que creemos ---
    const b = RIQ_BLOQUE_CATEGORIAS;
    const rotulo = String(hojaTablero.getRange(b.celdaRotuloTipo).getValue() || '').trim();
    const rotuloOk = _normalizarRotulo(rotulo) === _normalizarRotulo(b.rotuloTipoEsperado);

    return {
        nombreInicio: nombreInicio,
        nombreTablero: nombreTablero,
        resumenCatalogo: resumen,
        fueraDeRiqueza: fueraDeRiqueza,
        rotuloTipoOk: rotuloOk,
        rotuloTipoVivo: rotulo
    };
}

// ============================================
// PLAN
// ============================================

function _planRiqueza(ss, pre) {
    const cambios = [];
    const avisos = [];

    // --- Grupo (a): las seis celdas que miden riqueza ---
    RIQ_CELDAS.forEach(function (spec) {
        const nombreHoja = spec.hoja === 'INICIO' ? pre.nombreInicio : pre.nombreTablero;
        const actual = ss.getSheetByName(nombreHoja).getRange(spec.celda).getFormula();
        if (!actual) {
            avisos.push(nombreHoja + '!' + spec.celda + ' (' + spec.nota + ') no tiene formula: se saltea.');
            return;
        }
        const nueva = _aListaBlanca(actual);
        if (nueva === actual) {
            if (actual.indexOf('tipos_proy') === -1) {
                avisos.push(nombreHoja + '!' + spec.celda + ' no menciona el tipo de categoria: ' +
                    'no es la formula que este modulo espera. Se saltea SIN tocarla.');
            }
            return;
        }
        cambios.push({
            nombreHoja: nombreHoja, celda: spec.celda, nota: spec.nota,
            formulaActual: actual, formulaNueva: nueva,
            resumen: 'condicion de riqueza: lista negra (no-Hogar) -> lista blanca (' + TIPOS_RIQUEZA.join(' + ') + ')'
        });
    });

    // --- El bloque de categorias (Tablero!AA10): YA NO SE TOCA DESDE ACA ---
    // decision Franco 2026-08-21, duenio unico: TRES modulos declaraban AA10 -- este,
    // DEVTOOL_FormulerioV0111.js y DEVTOOL_BloqueCategorias.js -- mientras la cabecera de este
    // archivo afirmaba que la celda era "EXCLUSIVA de este modulo (ningun otro la escribe)". Esa
    // frase era falsa y esta corregida arriba.
    //
    // Gana DEVTOOL_BloqueCategorias.js: es el unico con trabajo VIGENTE ahi (cambia el eje de
    // agrupacion al de la categoria de la CUENTA, con su propio preflight por rotulo contra AA9
    // "Nombre" y su propio respaldo). Lo que hacia este modulo -- `columna_ak_vacia` ->
    // `columna_tipo` -- ya esta aplicado: medido contra el gemelo del 2026-08-21, el AA10 vivo no
    // contiene `columna_ak_vacia`. Por eso el banco lo reportaba como "SIN CAMBIO" en cada corrida.
    //
    // `_conTipoEnCategorias` y RIQ_BLOQUE_CATEGORIAS se conservan (no se borran) porque
    // devtools/probar_riqueza.js los sigue probando como regresion y porque documentan la
    // transformacion historica.
    avisos.push('El bloque de categorias (' + pre.nombreTablero + '!' + RIQ_BLOQUE_CATEGORIAS.celda +
        ') NO lo administra mas este modulo: su duenio unico es DEVTOOL_BloqueCategorias.js ' +
        '(decision Franco 2026-08-21). Para tocarlo, usar el menu "Bloque Categorias".');

    return { cambios: cambios, avisos: avisos };
}

/**
 * Cambia la condicion de riqueza de lista negra a lista blanca.
 *
 * Reemplazo por FUNCION, nunca por string de reemplazo: en String.replace un string interpreta
 * el '$', y en este proyecto toda formula lleva '$' por todos lados. Es la leccion de la
 * v0.12.0, que escribio tres formulas que no parseaban por exactamente eso.
 */
function _aListaBlanca(formula) {
    const blanca = '(' + TIPOS_RIQUEZA.map(function (t) {
        return '(tipos_proy="' + t + '")';
    }).join(' + ') + ') > 0';

    // (tipos_proy<>"Hogar") * (tipos_proy<>"") > 0   ->   ((tipos_proy="Ahorros") + ...) > 0
    return formula.replace(
        /\(\s*tipos_proy\s*<>\s*"Hogar"\s*\)\s*\*\s*\(\s*tipos_proy\s*<>\s*""\s*\)\s*>\s*0/g,
        function () { return blanca; }
    );
}

/**
 * Llena la columna del Tipo en el bloque de categorias y le saca el filtro por tipo.
 *
 * Es el UNICO lugar del modulo donde se autoriza un fragmento de formula nuevo (el VLOOKUP).
 * Se construye desde el config -- nombre de hoja y columnas -- para no hardcodear geometria
 * (regla SSOT), y se escribe con separador ";" porque es la notacion que devuelve y acepta
 * getFormula/setFormula en esta planilla es_AR. Si esa premisa fuera falsa, la formula no
 * parsearia y la relectura del VALOR aborta el lote entero: el modo de falla es seguro.
 */
function _conTipoEnCategorias(formula) {
    // UNA CELDA SIN FORMULA NO ES UN ERROR, ES UN ESTADO (mismo criterio que _repararFormula en
    // DEVTOOL_FormulerioV0111.js, cicatriz del 2026-08-21): si la geometria se movio y la celda
    // que RIQ_BLOQUE_CATEGORIAS declara ya no tiene formula, esta funcion no puede morirse -- eso
    // tapa justo la senal que importa. El diagnostico de "por que esta vacia" lo hace quien llama.
    if (typeof formula !== 'string' || !formula) return formula;
    const b = RIQ_BLOQUE_CATEGORIAS;
    const cfg = RANGES.PROYECTOS;
    const rango = "'" + cfg.sheet + "'!" + cfg.start + ':' + cfg.end;
    const colTipo = columnLetterToIndex(cfg.columns.tipo) - columnLetterToIndex(cfg.start) + 1;
    let out = formula;

    // 1. La columna vacia pasa a traer el tipo de cada categoria del resultado.
    out = out.replace(
        /ARRAYFORMULA\(\s*IF\(\s*columna_aj\s*<>\s*""\s*;\s*""\s*;\s*""\s*\)\s*\)/g,
        function () {
            return 'ARRAYFORMULA(IFERROR(VLOOKUP(columna_aj; ' + rango + '; ' + colTipo + '; 0); ""))';
        }
    );

    // 2. El nombre de la variable deja de mentir.
    out = out.split(b.varVieja).join(b.varNueva);

    // 3. El bloque deja de ocultar el gasto de casa: con el Tipo a la vista, mostrar todas las
    //    categorias es la lectura por macrosegmento que se busca.
    out = out.replace(
        /\(\s*proyecto\s*<>\s*""\s*\)\s*\*\s*\(\s*tipo_proy\s*<>\s*"Hogar"\s*\)\s*>\s*0/g,
        function () { return 'proyecto<>""'; }
    );

    return out;
}

// ============================================
// VERIFICACION
// ============================================

/**
 * Relee cada celda escrita: que la formula quedo, QUE CALCULA, y que la semantica del cambio
 * se cumple. Comprobar que escribiste lo que querias escribir no es comprobar que funciona.
 */
function _verificarEscrituraRiqueza(ss, escritas) {
    const fallas = [];
    escritas.forEach(function (w) {
        const rango = ss.getSheetByName(w.nombreHoja).getRange(w.celda);
        const leida = rango.getFormula();
        const ref = w.nombreHoja + '!' + w.celda;

        if (!leida) { fallas.push(ref + ' quedo SIN formula'); return; }
        if (_normalizarFormula(leida) !== _normalizarFormula(w.nueva)) {
            fallas.push(ref + ' no coincide con lo que se le escribio');
            return;
        }
        if (leida.indexOf('#REF!') !== -1) fallas.push(ref + ' quedo con un #REF!');

        // La garantia semantica: ninguna celda de riqueza puede seguir preguntando por
        // "todo lo que no sea Hogar".
        if (/tipos_proy\s*<>\s*"Hogar"/.test(leida)) {
            fallas.push(ref + ' todavia usa la lista negra (tipos_proy<>"Hogar")');
        }

        const err = _errorDeCelda(rango);
        if (err) {
            fallas.push(ref + ' quedo en ' + err +
                (w.errorPrevio ? ' (ya estaba en ' + w.errorPrevio + ' antes)' : ' (ANTES CALCULABA BIEN: la rompio esta corrida)'));
        }
    });
    return fallas;
}

function _revertirEscriturasRiqueza(ss, escritas) {
    escritas.forEach(function (w) {
        try {
            ss.getSheetByName(w.nombreHoja).getRange(w.celda).setFormula(w.previa);
        } catch (e) {
            logError('No se pudo restaurar ' + w.nombreHoja + '!' + w.celda + ': ' + e.message);
        }
    });
    SpreadsheetApp.flush();
}

// ============================================
// AUXILIARES
// ============================================

function _selloRiqueza() {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
}

function _mostrarRiqueza(titulo, mensaje) {
    try {
        SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        Logger.log(titulo + '\n' + mensaje);
    }
}
