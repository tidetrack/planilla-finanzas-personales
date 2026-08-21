/**
 * DEVTOOL_FormatoMedios.js
 * Pinta cada medio del bloque "Medios Bancarios." del Tablero con el color de su tipo.
 *
 * [CONCEPTO DE NEGOCIO]
 * El bloque "Medios Bancarios." lista los medios con saldo, y el bloque "Tipo de Medios." dice
 * en que finalidad esta la plata (hoy Ahorros / Financiacion / Hogar / Inversiones). Franco
 * pinto a mano el nombre de cada tipo con un color. Este modulo extiende ese lenguaje: cada
 * medio del bloque de saldos se pinta con el color de SU tipo, para que la finalidad de cada
 * peso se vea de un vistazo, sin ir a buscarla al Plan de Cuentas.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Dos fuentes de verdad, y ninguna copia en el codigo:
 *   - EL COLOR de cada tipo es el formato que Franco le puso al rotulo en el bloque "Tipo de
 *     Medios." (las filas de SYF_TIPOS_TABLERO). Se lee EN VIVO con getFontColorObject() al
 *     momento de aplicar; jamas un hex hardcodeado. Si Franco cambia un color y re-corre el
 *     modulo, se re-sincroniza.
 *     decision Franco 2026-08-20: el color lo gobierna su formato en la hoja, no una constante.
 *   - EL TIPO de cada medio es la columna Tipo del catalogo de medios del Plan de Cuentas
 *     (RANGES.MEDIOS_PAGO; la clave interna se llama 'proyecto' por historia, el header vivo
 *     dice "Tipo"). La regla lo consulta por VLOOKUP con rango de filas ABIERTO: cuando Franco
 *     agregue el medio numero 29, entra solo, sin tocar codigo.
 *
 * COMO: cuatro reglas de formato condicional (una por tipo) sobre la columna Medio del bloque
 * (C18:E29, DERIVADO de SYF_BLOQUE_MEDIOS: cada fila de datos esta combinada C:E y el formato
 * pinta la combinada completa al cubrir las tres columnas). Formato condicional y no pintura
 * directa de celdas: el bloque es un derrame que se reordena por saldo en cada recalculo, y una
 * pintura estatica quedaria pegada a la FILA; la regla queda pegada al MEDIO.
 *
 * decision Franco 2026-08-20: no hay atajo "nada que hacer" en aplicar; se rehacen siempre
 * (quitar las propias, agregarlas frescas), que es idempotente por construccion y garantiza la
 * sincronizacion con el color vivo de cada rotulo.
 *
 * CORRECCION 2026-08-21: la version anterior de esta nota justificaba lo de arriba diciendo que
 * "la API de Apps Script no permite leer el formato de una regla ya existente". Es FALSO:
 * BooleanCondition expone getBackgroundObject() y getFontColorObject(), y de hecho el estado de
 * este modulo ahora los usa para reportar con que color quedo pintado cada tipo. La conclusion
 * (rehacer siempre) sigue siendo la correcta por simple; el motivo que la sostenia, no.
 *
 * QUE NO HACE
 * 1. NO escribe ninguna celda: ni formulas ni valores. Solo reglas de formato condicional.
 * 2. NO toca las reglas de formato condicional AJENAS de la hoja. setConditionalFormatRules
 *    reemplaza TODAS las reglas de la hoja, asi que las ajenas se reponen intactas y en su
 *    orden; perderlas seria un destrozo silencioso.
 * 3. NO inventa colores: si Franco dejo un tipo en negro default, sus medios quedan en negro.
 *
 * Contrato de las tres publicas: { ok: boolean, detalle?: string, error?: string }.
 *   estadoFormatoMedios()    -> solo lectura. Se corre PRIMERO.
 *   aplicarFormatoMedios()   -> preflight por rotulo + reglas nuevas + verificacion +
 *                               restauracion completa si no verifica.
 *   revertirFormatoMedios()  -> quita SOLO las reglas de este modulo.
 *
 * Reusa helpers probados del repo: _normalizarRotulo (DEVTOOL_FormulerioV0111), _refHoja y
 * _canonizarFormula (DEVTOOL_StockYFlujo), getDataRow / columnLetterToIndex /
 * columnIndexToLetter (03_SheetManager), y la geometria SYF_* medida en vivo el 2026-08-20.
 *
 * @see docs/permanente/FORMULAS_TABLERO.md
 * @version 0.31.0
 * @since 2026-08-20
 * @lastModified 2026-08-20
 */

// ============================================
// CONSTANTES
// ============================================

/** Registro de la ultima aplicacion (sello y colores), para trazabilidad en el estado. */
const FMT_PROP_APLICADO = 'formato_medios_aplicado';

// ============================================
// GEOMETRIA DERIVADA (nada hardcodeado)
// ============================================

/**
 * El rango que cubren las reglas: la columna Medio del bloque de medios, filas de datos.
 *
 * La columna Medio ocupa desde colIni del bloque hasta la columna anterior al segundo grupo
 * (Moneda): cada fila de datos esta combinada C:E segun DEVTOOL_StockYFlujo, y la regla tiene
 * que cubrir las tres columnas para que la combinada entera tome el formato. Hoy da C18:E29.
 */
function _rangoMediosFmt() {
    const b = SYF_BLOQUE_MEDIOS;
    const colFin = columnIndexToLetter(columnLetterToIndex(b.columnas[1].col) - 1);
    return b.columnas[0].col + b.filaDatos + ':' + colFin + b.filaFin;
}

/**
 * El catalogo de medios del Plan, como lo consulta la regla: "'Plan de Cuentas'!$L$8:$N".
 * Columnas absolutas, filas ABIERTAS: el catalogo termina hoy en la fila 35, pero un rango
 * cerrado se pudre el dia que Franco agrega un medio. Derivado entero de RANGES.MEDIOS_PAGO.
 */
function _catalogoMediosFmt() {
    const cfg = RANGES.MEDIOS_PAGO;
    return _refHoja(cfg.sheet) + '!$' + cfg.columns.nombre + '$' + getDataRow(cfg) + ':$' + cfg.end;
}

/** Indice de la columna Tipo dentro del catalogo (hoy 3: L nombre, M moneda, N tipo). */
function _indiceTipoMedioFmt() {
    const cfg = RANGES.MEDIOS_PAGO;
    return columnLetterToIndex(cfg.columns.proyecto) - columnLetterToIndex(cfg.columns.nombre) + 1;
}

// ============================================
// LA FORMULA DE CADA REGLA
// ============================================

/**
 * La formula de la regla de UN tipo. Ejemplo (tipo Ahorros):
 *
 *   =VLOOKUP($C18; INDIRECT("'Plan de Cuentas'!$L$8:$N"); 3; 0)="Ahorros"
 *
 * EL INDIRECT NO ES DECORATIVO. Una formula de formato condicional NO PUEDE referenciar otra
 * hoja de forma directa: es una limitacion vieja y documentada de Google Sheets, y la unica
 * salida es envolver la referencia foranea en INDIRECT() para que se resuelva en tiempo de
 * evaluacion. Sin el, la regla se crea sin protestar y NUNCA pinta nada -- ni un error, ni una
 * celda en rojo: simplemente no pasa nada, que es el peor modo de fallar de esta planilla y ya
 * nos costo una hoja vaciada en silencio. El precio del INDIRECT es que el rango deja de
 * seguir a la hoja si Franco inserta columnas en el Plan de Cuentas; a cambio, el preflight
 * verifica los rotulos vivos del catalogo antes de escribir nada.
 * decision Franco 2026-08-21: se referencia con INDIRECT y se verifica MIRANDO la hoja.
 *
 * $C18: columna ABSOLUTA (aunque la regla cubre C:E por las combinadas, siempre se evalua la
 * celda del Medio) y fila RELATIVA (cada fila del rango evalua su propio medio). Si la celda
 * esta vacia el VLOOKUP da #N/A, la condicion da falso y la fila no se pinta: las filas libres
 * del bloque quedan como estan.
 *
 * NO HAY EXCEPCION A LA REGLA DE LOCALE. Hasta v0.33.0 este comentario afirmaba que
 * whenFormulaSatisfied recibia sintaxis canonica EN-US con COMA, y que la traduccion al locale
 * ocurria recien en la capa de UI. Es FALSO, y costo que las cuatro reglas existieran sin
 * pintar nada. La formula de una regla se guarda VERBATIM y se evalua en el locale de la
 * planilla: con comas, en una planilla es_AR, no parsea -- y una regla que no parsea no da
 * error, simplemente nunca se cumple.
 *
 * Medido en la planilla el 2026-08-21, sobre C18:E29 y con los cuatro medios de tipo Hogar
 * como testigo (Frasco Transitorio NaranjaX, Efectivo, NaranjaX, YPF):
 *   =VLOOKUP($C18, INDIRECT("..."), 3, 0)="Hogar"   -> se acepta, no pinta NADA
 *   =VLOOKUP($C18; INDIRECT("..."); 3; 0)="Hogar"   -> pinta exactamente esos cuatro
 *   =VLOOKUP($C18; 'Plan de Cuentas'!$L$8:$N; 3; 0) -> "Formula no valida", Sheets la rechaza
 * La tercera linea es la que prueba que el INDIRECT de arriba no es decorativo.
 *
 * O sea: esta fabrica sigue la MISMA regla que el resto del repo (';'), y ademas necesita el
 * INDIRECT. Las dos cosas, no una.
 *
 * El rotulo del tipo se recibe LEIDO de la hoja (bloque "Tipo de Medios."), nunca de una lista
 * propia: si Franco renombra un tipo, la proxima corrida genera la regla con el nombre nuevo.
 */
function _formulaReglaFmt(tipo) {
    // Comillas dobladas por si un rotulo llegara a tener comillas; reemplazo por funcion
    // (trampa 7: un reemplazo por string expande los $ del texto).
    const rotulo = String(tipo).replace(/"/g, function () { return '""'; });
    const b = SYF_BLOQUE_MEDIOS;
    return '=VLOOKUP($' + b.columnas[0].col + b.filaDatos + '; INDIRECT("' + _catalogoMediosFmt() +
        '"); ' + _indiceTipoMedioFmt() + '; 0)="' + rotulo + '"';
}

// ============================================
// IDENTIFICACION DE LAS REGLAS PROPIAS
// ============================================

/** La formula de una regla booleana, o '' si no la tiene (reglas de gradiente). */
function _formulaDeReglaFmt(regla) {
    const cond = regla.getBooleanCondition && regla.getBooleanCondition();
    if (!cond) return '';
    const valores = cond.getCriteriaValues() || [];
    return valores.length ? String(valores[0]) : '';
}

/**
 * Una regla es de este modulo si cumple LAS DOS: es whenFormulaSatisfied con VLOOKUP al
 * catalogo de medios del Plan, Y su rango es exactamente la columna Medio del bloque. La
 * segunda condicion es la que salva a una regla ajena que casualmente consulte el mismo
 * catalogo desde otro rango: esa no se toca.
 */
function _esReglaPropiaFmt(regla) {
    const cond = regla.getBooleanCondition && regla.getBooleanCondition();
    if (!cond) return false;
    if (String(cond.getCriteriaType()) !== 'CUSTOM_FORMULA') return false;
    const formula = _formulaDeReglaFmt(regla);
    if (formula.indexOf('VLOOKUP') === -1) return false;
    // Ni el INDIRECT ni el separador entran en la identificacion, A PROPOSITO. La corrida del
    // 2026-08-21 dejo cuatro reglas MUDAS (con coma, que no parsean en es_AR) y antes de eso
    // pudo haber quedado alguna con la referencia directa. Si aca exigieramos la forma correcta,
    // esas reglas rotas dejarian de reconocerse como propias y quedarian huerfanas: ni se
    // reemplazan al aplicar ni se quitan al revertir. Se identifica por lo que NO cambia -- el
    // VLOOKUP contra el catalogo de medios, y el rango exacto del bloque.
    if (formula.indexOf(_catalogoMediosFmt()) === -1) return false;
    const rangos = (regla.getRanges() || []).map(function (r) { return r.getA1Notation(); });
    return rangos.length === 1 && rangos[0] === _rangoMediosFmt();
}

/** Separa las reglas de la hoja en propias (de este modulo) y ajenas (intocables). */
function _clasificarReglasFmt(reglas) {
    const propias = [], ajenas = [];
    reglas.forEach(function (r) { (_esReglaPropiaFmt(r) ? propias : ajenas).push(r); });
    return { propias: propias, ajenas: ajenas };
}

/**
 * Canonizacion para VERIFICAR una formula de regla releida. Sobre la comun agrega tolerancia
 * de separadores: si la capa de Sheets re-serializara la formula al locale (';' o coma sin
 * espacio), la comparacion textual cruda revertiria reglas correctas -- la misma leccion de
 * _canonizarFormula con las comillas de nombre de hoja. Ningun rotulo de tipo lleva comas ni
 * punto y coma, asi que la normalizacion no puede confundir dos reglas distintas.
 */
function _canonizarFormulaCondFmt(f) {
    return _canonizarFormula(f)
        .replace(/;/g, function () { return ','; })
        .replace(/,\s+/g, function () { return ','; });
}

// ============================================
// COLORES (SSOT: el formato de Franco)
// ============================================

/** '#AARRGGBB' -> '#rrggbb', y todo a minusculas: setFontColor no quiere canal alfa. */
function _normalizarHexFmt(hex) {
    let h = String(hex || '').toLowerCase();
    if (h.length === 9) h = '#' + h.slice(3);
    return h;
}

/**
 * El color de fuente de una celda, como hex. Aborta claro si el color es de TEMA: un color de
 * tema no se puede convertir a RGB por la API (asRgbColor lanza), y adivinarle un hex seria
 * inventar un color que Franco no eligio.
 */
function _leerColorTipoFmt(hoja, celda) {
    const color = hoja.getRange(celda).getFontColorObject();
    if (String(color.getColorType()) !== 'RGB') {
        throw new Error('El color del rotulo en ' + celda + ' es de tema (' +
            String(color.getColorType()) + ') y la API no lo traduce a RGB. Elegir para ese ' +
            'rotulo un color personalizado en la paleta y volver a correr. No se toco nada.');
    }
    return _normalizarHexFmt(color.asRgbColor().asHexString());
}

// ============================================
// PREFLIGHT
// ============================================

/**
 * Verifica por ROTULO que los dos bloques sigan donde el gemelo los midio (2026-08-20):
 * titulo "Tipo de Medios." en AE7, cuatro tipos no vacios en AE9:AE12, header "Medio" en C17.
 * El titulo real termina en punto, por eso se compara por contencion normalizada.
 */
function _preflightFmt(ss) {
    const nombre = NAV_CONFIG.SHEETS.TABLERO;
    const hoja = ss.getSheetByName(nombre);
    if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

    const t = SYF_TIPOS_TABLERO;
    const celdaTitulo = t.colTipo + t.filaTitulo;
    const titulo = String(hoja.getRange(celdaTitulo).getValue() || '');
    if (_normalizarRotulo(titulo).indexOf(_normalizarRotulo(t.tituloEsperado)) === -1) {
        throw new Error('En ' + celdaTitulo + ' se esperaba el titulo "' + t.tituloEsperado +
            '" y dice "' + titulo + '". El bloque se movio: volver a medir. No se toco nada.');
    }

    const tipos = [];
    const vistos = {};
    t.filas.forEach(function (fila) {
        const celda = t.colTipo + fila;
        const rotulo = String(hoja.getRange(celda).getValue() || '').trim();
        if (!rotulo) {
            throw new Error('El rotulo de tipo en ' + celda + ' esta vacio y este modulo lee ' +
                'de ahi el nombre y el color de cada tipo. No se toco nada.');
        }
        const clave = _normalizarRotulo(rotulo);
        if (vistos[clave]) {
            throw new Error('El tipo "' + rotulo + '" aparece dos veces en el bloque "' +
                t.tituloEsperado + '" (' + vistos[clave] + ' y ' + celda + '): dos reglas con ' +
                'la misma condicion no tienen orden definido. No se toco nada.');
        }
        vistos[clave] = celda;
        tipos.push({ celda: celda, rotulo: rotulo });
    });

    const b = SYF_BLOQUE_MEDIOS;
    const celdaMedio = b.columnas[0].col + b.filaHeader;
    const header = String(hoja.getRange(celdaMedio).getValue() || '');
    if (_normalizarRotulo(header) !== _normalizarRotulo(b.columnas[0].rotulo)) {
        throw new Error('En ' + celdaMedio + ' se esperaba el header "' + b.columnas[0].rotulo +
            '" y dice "' + header + '". El bloque de medios se movio. No se toco nada.');
    }

    // El destino del VLOOKUP tiene que existir; si no, las cuatro reglas evaluarian #REF!
    // en silencio y ningun medio se pintaria jamas.
    if (!ss.getSheetByName(RANGES.MEDIOS_PAGO.sheet)) {
        throw new Error('No existe la hoja "' + RANGES.MEDIOS_PAGO.sheet +
            '" (catalogo de medios). No se toco nada.');
    }

    return { hoja: hoja, nombre: nombre, tipos: tipos };
}

// ============================================
// PLAN
// ============================================

/**
 * Arma el plan completo: los colores leidos en vivo, la formula de cada tipo, y la foto de las
 * reglas actuales separada en propias y ajenas. No escribe nada.
 */
function _planFmt(pre) {
    const todas = pre.hoja.getConditionalFormatRules();
    const clases = _clasificarReglasFmt(todas);
    const nuevas = pre.tipos.map(function (tp) {
        return {
            tipo: tp.rotulo,
            celdaColor: tp.celda,
            color: _leerColorTipoFmt(pre.hoja, tp.celda),
            formula: _formulaReglaFmt(tp.rotulo)
        };
    });
    return { todasPrevias: todas, ajenas: clases.ajenas, propiasPrevias: clases.propias, nuevas: nuevas };
}

/** Los tipos cuyo color se repite (o quedo en negro default), para avisarlo sin abortar. */
function _avisosDeColorFmt(nuevas) {
    const avisos = [];
    const porColor = {};
    nuevas.forEach(function (p) { (porColor[p.color] = porColor[p.color] || []).push(p.tipo); });
    Object.keys(porColor).forEach(function (c) {
        if (porColor[c].length > 1) {
            avisos.push('los tipos ' + porColor[c].join(' y ') + ' comparten el color ' + c +
                ': sus medios van a ser indistinguibles');
        }
    });
    return avisos;
}

/** Construye la regla viva de un item del plan. Las propias van DESPUES de las ajenas:
 *  conservan su orden y prioridad, y entre si las cuatro son mutuamente excluyentes
 *  (un medio tiene un solo tipo), asi que su orden interno no decide nada. */
function _construirReglaFmt(hoja, item) {
    return SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(item.formula)
        .setFontColor(item.color)
        .setRanges([hoja.getRange(_rangoMediosFmt())])
        .build();
}

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura. */
function estadoFormatoMedios() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightFmt(ss);
        const plan = _planFmt(pre);

        const l = ['FORMATO DE MEDIOS POR TIPO - ESTADO (no se escribio nada)', ''];
        l.push('Rango a pintar: ' + pre.nombre + '!' + _rangoMediosFmt() +
            ' (columna Medio del bloque "Medios Bancarios.")');
        l.push('');
        l.push('Colores leidos EN VIVO del bloque "Tipo de Medios." (la SSOT es ese formato):');
        plan.nuevas.forEach(function (p) {
            l.push('  ' + p.celdaColor + '  ' + p.tipo.padEnd(16) + ' -> ' + p.color);
        });
        _avisosDeColorFmt(plan.nuevas).forEach(function (a) { l.push('  AVISO: ' + a + '.'); });
        l.push('');
        l.push('Reglas de formato condicional hoy en ' + pre.nombre + ': ' +
            plan.todasPrevias.length + ' (de este modulo: ' + plan.propiasPrevias.length +
            ', ajenas: ' + plan.ajenas.length + ' -- las ajenas no se tocan)');
        const sello = PropertiesService.getDocumentProperties().getProperty(FMT_PROP_APLICADO);
        if (sello) l.push('Ultima aplicacion registrada: ' + sello);
        l.push('');
        l.push('Formula de muestra (";" como en todo el repo, y la referencia al Plan de Cuentas');
        l.push('envuelta en INDIRECT: sin eso la regla no pinta. Ver la nota en _formulaReglaFmt):');
        l.push('  ' + plan.nuevas[0].formula);
        l.push('');
        l.push('Aplicar SIEMPRE rehace las cuatro reglas propias: es idempotente, y garantiza que');
        l.push('los colores queden sincronizados con los rotulos de "Tipo de Medios." de hoy.');

        const t = l.join('\n');
        _mostrarFmt('Formato de medios - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarFmt('Formato de medios - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Aplica las cuatro reglas (quita antes las propias previas), con verificacion y restauracion. */
function aplicarFormatoMedios() {
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarFormatoMedios necesita UI (menu Tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const pre = _preflightFmt(ss);
        const plan = _planFmt(pre);

        const conf = ui.alert('Formato de medios por tipo',
            'Se van a escribir ' + plan.nuevas.length + ' reglas de formato condicional sobre ' +
            pre.nombre + '!' + _rangoMediosFmt() + ' (una por tipo), pintando cada medio del ' +
            'color de su tipo:\n\n' +
            plan.nuevas.map(function (p) { return '  ' + p.tipo + ' -> ' + p.color; }).join('\n') +
            '\n\nLos colores se leyeron RECIEN del bloque "Tipo de Medios.": si cambias uno, ' +
            're-corre este paso y se re-sincroniza.\n' +
            (plan.propiasPrevias.length
                ? 'Las ' + plan.propiasPrevias.length + ' regla(s) previas de este modulo se reemplazan.\n'
                : '') +
            'Las otras ' + plan.ajenas.length + ' regla(s) de la hoja se reponen intactas.\n' +
            'No se escribe ninguna celda.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const nuevas = plan.nuevas.map(function (p) { return _construirReglaFmt(pre.hoja, p); });
        pre.hoja.setConditionalFormatRules(plan.ajenas.concat(nuevas));
        SpreadsheetApp.flush();

        // Verificacion por relectura: las ajenas sobrevivieron todas, y las propias son
        // exactamente las cuatro formulas que se mandaron, una vez cada una.
        const despues = _clasificarReglasFmt(pre.hoja.getConditionalFormatRules());
        const fallas = [];
        if (despues.ajenas.length !== plan.ajenas.length) {
            fallas.push('las reglas ajenas pasaron de ' + plan.ajenas.length + ' a ' +
                despues.ajenas.length);
        }
        if (despues.propias.length !== plan.nuevas.length) {
            fallas.push('quedaron ' + despues.propias.length + ' reglas propias y se esperaban ' +
                plan.nuevas.length);
        }
        const vivas = despues.propias.map(function (r) {
            return _canonizarFormulaCondFmt(_formulaDeReglaFmt(r));
        });
        plan.nuevas.forEach(function (p) {
            if (vivas.indexOf(_canonizarFormulaCondFmt(p.formula)) === -1) {
                fallas.push('falta la regla del tipo "' + p.tipo + '"');
            }
        });
        if (fallas.length) {
            let restaurado = ' Se restauraron las reglas previas de la hoja.';
            try {
                pre.hoja.setConditionalFormatRules(plan.todasPrevias);
                SpreadsheetApp.flush();
            } catch (e2) {
                restaurado = ' ADEMAS fallo la restauracion (' + e2.message + ').';
            }
            throw new Error('Se escribio pero NO VERIFICA: ' + fallas.join('; ') + '.' + restaurado);
        }

        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        PropertiesService.getDocumentProperties().setProperty(FMT_PROP_APLICADO,
            sello + ' ' + plan.nuevas.map(function (p) { return p.tipo + '=' + p.color; }).join(' '));

        const detalle = 'FORMATO DE MEDIOS APLICADO\n\n' +
            '- Reglas propias escritas y verificadas: ' + plan.nuevas.length + ' (una por tipo)\n' +
            '- Reglas ajenas repuestas intactas: ' + plan.ajenas.length + '\n' +
            '- Colores sincronizados desde "Tipo de Medios.":\n' +
            plan.nuevas.map(function (p) { return '    ' + p.tipo + ' -> ' + p.color; }).join('\n') +
            '\n\nQUE MIRAR:\n' +
            '  1. Cada medio de "Medios Bancarios." queda del color del nombre de su tipo, y el\n' +
            '     color lo sigue aunque el bloque se reordene por saldo: la regla mira el medio,\n' +
            '     no la fila.\n' +
            '  2. Un medio sin pintar es informacion: o no esta en el catalogo del Plan de\n' +
            '     Cuentas, o su Tipo no coincide con ningun rotulo del bloque de tipos.\n' +
            '  3. Si cambias un color en "Tipo de Medios.", re-corre este paso: se re-sincroniza.\n\n' +
            'Para deshacer: revertirFormatoMedios (quita solo las reglas de este modulo).';

        logSuccess('aplicarFormatoMedios: ' + plan.nuevas.length + ' regla(s), ' +
            plan.ajenas.length + ' ajena(s) intactas.');
        _mostrarFmt('Formato de medios - aplicado', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarFmt('Formato de medios - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/**
 * Quita SOLO las reglas de este modulo. A proposito NO exige el preflight de rotulos: si los
 * bloques se movieron, lo que corresponde es justamente poder sacar las reglas viejas.
 */
function revertirFormatoMedios() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const nombre = NAV_CONFIG.SHEETS.TABLERO;
        const hoja = ss.getSheetByName(nombre);
        if (!hoja) throw new Error('No existe la hoja "' + nombre + '".');

        const clases = _clasificarReglasFmt(hoja.getConditionalFormatRules());
        if (!clases.propias.length) {
            const t = 'No hay reglas de este modulo en ' + nombre + '. Las ' +
                clases.ajenas.length + ' regla(s) ajenas quedan como estan.';
            _mostrarFmt('Formato de medios - nada que revertir', t);
            return { ok: true, detalle: t };
        }

        hoja.setConditionalFormatRules(clases.ajenas);
        SpreadsheetApp.flush();

        const despues = _clasificarReglasFmt(hoja.getConditionalFormatRules());
        if (despues.propias.length || despues.ajenas.length !== clases.ajenas.length) {
            throw new Error('La relectura no coincide: quedaron ' + despues.propias.length +
                ' regla(s) propias y ' + despues.ajenas.length + ' ajena(s) (se esperaban 0 y ' +
                clases.ajenas.length + ').');
        }
        PropertiesService.getDocumentProperties().deleteProperty(FMT_PROP_APLICADO);

        const t = 'FORMATO DE MEDIOS REVERTIDO\n\n- Reglas propias quitadas: ' +
            clases.propias.length + '\n- Reglas ajenas intactas: ' + clases.ajenas.length +
            '\n\nLos medios vuelven al color que tenian por defecto.';
        logSuccess('revertirFormatoMedios: ' + clases.propias.length + ' regla(s) quitadas.');
        _mostrarFmt('Formato de medios - revertido', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'NO SE REVIRTIO. ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarFmt('Formato de medios - ERROR', msg);
        return { ok: false, error: msg };
    }
}

function _mostrarFmt(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
