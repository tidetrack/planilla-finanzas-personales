/**
 * DEVTOOL_CategorizarCuentas.js
 * Ordena las cuentas del Plan de Cuentas en CATEGORIAS, en su propio catalogo, separado del de
 * los medios.
 *
 * [CONCEPTO DE NEGOCIO]
 * El Plan de Cuentas tenia 60 cuentas sueltas y las tres columnas "Categoria" de los bloques de
 * cuentas estaban VACIAS -- 0 de 11 en Ingresos, 0 de 15 en Gastos Fijos, 0 de 22 en Variables.
 * Sin ese nivel intermedio no se puede leer nada por encima del detalle: "Nafta" y "Auto" son dos
 * lineas sueltas en vez de "el auto me cuesta tanto".
 *
 * decision Franco 2026-08-19: "Categorias para mis cuentas de Ingresos - Gastos Fijos - Gastos
 * Variables para de ahi poder diferenciar el motivo".
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * La categoria agrupa cuentas por el MOTIVO del movimiento, y puede repetirse en mas de un
 * bloque. Ahi esta el valor: "Vehiculo" figura en Gastos Fijos (Nafta, Auto) y en Variables
 * (Reparaciones, Estacionamiento), y recien con eso la planilla puede contestar cuanto cuesta el
 * auto de verdad -- $4.793.879 en 32 meses, $149.808 por mes, el segundo gasto mas grande
 * despues de los negocios propios. Antes eran cuatro lineas sueltas en dos tablas distintas.
 *
 * ============================================================================
 * DOS EJES INDEPENDIENTES, DOS CATALOGOS SEPARADOS
 * ============================================================================
 * decision Franco 2026-08-19, despues de dudarlo en voz alta y acertar: van SEPARADOS.
 *
 *   EJE DE MEDIOS   -> DONDE ESTA la plata.   Medio -> Categoria (P:Q) -> Tipo/finalidad
 *                      (Ahorros, Inversiones, Financiacion, Hogar). NO SE TOCA.
 *   EJE DE CUENTAS  -> POR QUE entro o salio. Cuenta -> Categoria (catalogo nuevo en U).
 *
 * Son dimensiones INDEPENDIENTES del mismo movimiento, no una anidada en la otra. La nafta se
 * puede pagar con la cuenta cotidiana o con la tarjeta: misma categoria de cuenta, distinta
 * finalidad de medio. Si una determinara a la otra, esa diferencia no se podria representar.
 *
 * Y ese cruce es justamente la informacion que se busca. Medido sobre el ledger: "Alimentacion"
 * se pago casi toda desde medios de finalidad Hogar ($6.961.137), pero $46.300 salieron de un
 * medio de Ahorros. Eso -- comerse los ahorros -- no lo dice ninguno de los dos ejes por
 * separado, solo el cruce.
 *
 * POR ESO LA CATEGORIA DE CUENTA NO LLEVA UN "TIPO" PROPIO: seria un tercer nivel redundante.
 * El agrupamiento que cruza bloques ya sale del NOMBRE: "Vehiculo" figura en Gastos Fijos (Nafta,
 * Auto) y en Variables (Reparaciones, Estacionamiento), y con eso la planilla ya puede sumar los
 * $4.793.879 que cuesta el auto de verdad, sin inventar una capa mas.
 *
 * ============================================================================
 * LA VALIDACION DE LAS COLUMNAS ES PARTE DEL CAMBIO
 * ============================================================================
 * Las columnas de Categoria de los tres bloques tienen un DESPLEGABLE con una lista de valores
 * permitidos. Mientras esa lista sea la vieja, escribir "Vehiculo" es un valor invalido y Sheets
 * lo rechaza -- en la primera corrida lanzo "Los datos ingresados en la celda D8 infringen las
 * reglas de validacion".
 *
 * Cambiar lo que una columna significa incluye cambiar lo que esa columna ACEPTA. Por eso la
 * validacion se reemplaza por la lista de categorias de cuentas ANTES de escribir, y se restaura
 * si algo falla. Es la misma leccion que dejo el eje de medios el mismo dia, en la v0.20.1: una
 * migracion que cambia el dominio de una columna y no toca su validacion no esta terminada.
 *
 * ============================================================================
 * QUE NO HACE
 * ============================================================================
 * 1. NO toca el ledger. Solo escribe en el Plan de Cuentas.
 * 2. NO unifica las cuentas escritas de dos formas ("Pago tarjeta" / "Pago Tarjeta"). Las mapea a
 *    la misma categoria, asi que el agrupamiento ya sale bien, pero el par sigue existiendo como
 *    dos cuentas hasta que se decida cual se queda. @see el informe de duplicados.
 * 3. NO categoriza "Compra USD", a proposito: decision Franco, pasa a ser un traspaso y deja de
 *    existir como cuenta. Categorizarla seria consagrar algo que esta por desaparecer.
 * 4. NO TOCA P:Q. Ese bloque es el eje de los medios y queda exactamente como esta.
 *
 * Contrato: { ok: boolean, detalle?: string, error?: string }.
 *   estadoCategorizar()   -> solo lectura. Se corre PRIMERO.
 *   aplicarCategorizar()  -> respaldo verificado del catalogo + escritura + relectura.
 *
 * @version 0.23.0
 * @since 2026-08-19
 * @lastModified 2026-08-20
 */

const CATZ_PROP_RESPALDO = 'categorizar_respaldo';

/**
 * El mapa completo: bloque, categoria, y las cuentas que la componen.
 *
 * Derivado de 3.458 movimientos sobre 32 meses -- el agrupamiento sigue el uso real, no una
 * taxonomia de manual. Las cuentas que aparecen escritas de dos formas figuran las dos veces a
 * proposito: van a la misma categoria, asi que el agrupamiento sale bien aunque el par todavia
 * no se haya unificado.
 *
 * "Compra USD" NO esta, y es deliberado (ver la cabecera del modulo).
 *
 * La misma categoria puede figurar en mas de un bloque -- "Vehiculo" esta en Gastos Fijos y en
 * Variables -- y eso NO es un error: es el cruce que se busca.
 */
const CATZ_MAPA = [
    // --- INGRESOS ---
    { bloque: 'INGRESOS', categoria: 'Sueldo',
      cuentas: ['Sueldo'] },
    { bloque: 'INGRESOS', categoria: 'Negocios propios',
      cuentas: ['Tidetrack', 'umoh', 'Umoh', 'Ingreso Asesor', 'FF'] },
    { bloque: 'INGRESOS', categoria: 'Ingresos extraordinarios',
      cuentas: ['Ingresos Extra', 'Ingresos extra', 'Ingreso Viejo'] },
    { bloque: 'INGRESOS', categoria: 'Prestamos recibidos',
      cuentas: ['Plata Prestada', 'Plata prestada'] },
    { bloque: 'INGRESOS', categoria: 'Rendimientos financieros',
      cuentas: ['Inversiones', 'Intereses bancos', 'Intereses Bancos', 'Rendimientos'] },
    // "Ajuste" no es un ingreso: es una correccion de saldo contra el banco. Pero vive en el
    // bloque de Ingresos (ahi se dio de alta, porque el signo lo lleva la columna Tipo del
    // movimiento) y sin categoria queda como un hueco a la vista. Su motivo ES la conciliacion.
    { bloque: 'INGRESOS', categoria: 'Conciliacion',
      cuentas: ['Ajuste'] },

    // --- GASTOS FIJOS ---
    { bloque: 'GASTOS_FIJOS', categoria: 'Deuda y financiacion',
      cuentas: ['Pago tarjeta', 'Pago Tarjeta', 'Pago Tarjeta MP', 'Prestamo Galicia',
                'Prestamo Viejo', 'Deuda Eze', 'Deuda Dima', 'Deuda Viejo'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Vehiculo',
      cuentas: ['Nafta', 'Auto'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Salud',
      cuentas: ['Prepaga', 'Salud'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Impuestos',
      cuentas: ['MONOTRIBUTO'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Servicios y suscripciones',
      cuentas: ['Linea telefónica', 'Subscripciones', 'Seguro Compu', 'Seguro Celu'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Bienestar',
      cuentas: ['SportClub', 'Sportclub'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Mascotas',
      cuentas: ['Gatos'] },

    // --- GASTOS VARIABLES ---
    { bloque: 'GASTOS_VARIABLES', categoria: 'Alimentacion y social',
      cuentas: ['Comidas', 'Juntadas', 'Salidas'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Equipamiento',
      cuentas: ['Computación', 'Ropa'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Viajes',
      cuentas: ['Viajes'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Ocio y regalos',
      cuentas: ['Entretenimiento', 'Regalos'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Trabajo y negocio',
      cuentas: ['Trabajo', 'Gastos - TT', 'Gastos - Tidetrack'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Vehiculo',
      cuentas: ['Reparaciones Auto', 'Estacionamiento'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Cuidado personal',
      cuentas: ['Corte Pelo', 'Medicamentos / Higiene', 'Medicamentos / Accesorios'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Formacion',
      cuentas: ['Facultad', 'Entrenamiento'] },
    // "Deudas" comparte categoria con el bloque de fijos pero vive en Variables: la categoria
    // cruza bloques, que es exactamente para lo que sirve. La primera corrida la salteo porque
    // estaba mapeada en el bloque equivocado.
    { bloque: 'GASTOS_VARIABLES', categoria: 'Deuda y financiacion',
      cuentas: ['Deudas'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Otros',
      cuentas: ['Otros', 'Imprevistos', 'Perdidas', 'Impuestos compra Bonos'] }
];

/** Cuentas que a proposito NO se categorizan, con el motivo. */
const CATZ_EXCLUIDAS = {
    'Compra USD': 'pasa a ser un traspaso y deja de existir como cuenta (decision Franco 2026-08-19)'
};

// ============================================
// PUBLICAS
// ============================================

/** Solo lectura: que escribiria. */
function estadoCategorizar() {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planCategorizar(ss);
        const l = ['CATEGORIZAR CUENTAS - ESTADO (no se escribio nada)', ''];
        l.push('Eje de CUENTAS: cuenta -> categoria (por que entro o salio la plata).');
        l.push('El eje de MEDIOS (donde esta la plata) es otro y NO se toca.');
        l.push('');
        l.push('CATEGORIAS a dar de alta en el catalogo de cuentas (columna ' +
            RANGES.CATEGORIAS_CUENTA.columns.nombre + '): ' + plan.categoriasNuevas.length);
        plan.categoriasNuevas.forEach(function (c) { l.push('   ' + c.categoria); });
        l.push('');
        if (plan.cruzan.length) {
            l.push('CATEGORIAS QUE CRUZAN MAS DE UN BLOQUE (es el cruce que se busca):');
            plan.cruzan.forEach(function (c) { l.push('   ' + _padCatz(c.categoria, 24) + c.bloques.join(' + ')); });
            l.push('');
        }
        l.push('CUENTAS a categorizar: ' + plan.asignaciones.length + ' de ' + plan.cuentasCatalogo);
        if (plan.sinCategoria.length) {
            l.push('');
            l.push('Quedan SIN categoria (' + plan.sinCategoria.length + '):');
            plan.sinCategoria.forEach(function (c) {
                l.push('   ' + _padCatz(c.cuenta, 28) + (CATZ_EXCLUIDAS[c.cuenta] || 'no esta en el mapa'));
            });
        }
        if (plan.avisos.length) {
            l.push('');
            l.push('Avisos:');
            plan.avisos.forEach(function (a) { l.push('  - ' + a); });
        }
        const t = l.join('\n');
        _mostrarCatz('Categorizar cuentas - estado', t);
        return { ok: true, detalle: t };
    } catch (e) {
        const msg = 'No se pudo medir: ' + e.message;
        logError(msg, { stack: e.stack });
        _mostrarCatz('Categorizar cuentas - ERROR', msg);
        return { ok: false, error: msg };
    }
}

/** Escribe las categorias en el catalogo y la categoria de cada cuenta. */
function aplicarCategorizar() {
    let ui = null, ss = null, foto = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarCategorizar necesita UI (menu Tidetrack Dev).' }; }

    try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        const plan = _planCategorizar(ss);
        if (!plan.categoriasNuevas.length && !plan.asignaciones.length) {
            const t = 'El Plan de Cuentas ya esta categorizado. No se escribio nada.';
            _mostrarCatz('Categorizar cuentas', t);
            return { ok: true, detalle: t };
        }

        const conf = ui.alert('Ordenar el Plan de Cuentas',
            'Se va a escribir en el Plan de Cuentas:\n\n' +
            '  - ' + plan.categoriasNuevas.length + ' categoria(s) nuevas en el bloque de Categorias, con su tipo\n' +
            '  - la categoria de ' + plan.asignaciones.length + ' cuenta(s) en los tres bloques\n\n' +
            'El bloque de categorias de MEDIOS (P:Q) NO se toca: es otro eje y queda como esta.\n\n' +
            'Tampoco se toca el ledger.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarCatalogo(ss, hojaPC, sello);

        // Las columnas de Categoria tienen un desplegable con la lista vieja: hasta que se
        // reemplace, cada valor nuevo se rechaza (la primera corrida murio en D8).
        foto = _fotografiarBloquesCatz(ss);
        _abrirDominioCatz(ss);

        // --- 1. Alta de las categorias en su propio catalogo (columna U) ---
        const cfgCat = RANGES.CATEGORIAS_CUENTA;
        const colCat = columnLetterToIndex(cfgCat.columns.nombre);
        let fila = _primeraFilaLibre(hojaPC, colCat, getDataRow(cfgCat));
        const escritasCat = [];
        plan.categoriasNuevas.forEach(function (c) {
            hojaPC.getRange(fila, colCat).setValue(c.categoria);
            escritasCat.push({ fila: fila, categoria: c.categoria });
            fila++;
        });

        // --- 2. La categoria de cada cuenta, bloque por bloque y en un solo setValues ---
        const escritasCta = [];
        ['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES'].forEach(function (clave) {
            const cfg = RANGES[clave];
            const col = columnLetterToIndex(cfg.columns.proyecto);
            const desde = getDataRow(cfg);
            const delBloque = plan.asignaciones.filter(function (a) { return a.bloque === clave; });
            if (!delBloque.length) return;
            const maxFila = delBloque.reduce(function (m, a) { return Math.max(m, a.fila); }, desde);
            const alto = maxFila - desde + 1;
            const actual = hojaPC.getRange(desde, col, alto, 1).getValues();
            delBloque.forEach(function (a) {
                actual[a.fila - desde][0] = a.categoria;
                escritasCta.push(a);
            });
            hojaPC.getRange(desde, col, alto, 1).setValues(actual);
        });
        SpreadsheetApp.flush();

        // --- 3. Relectura ---
        const fallas = [];
        escritasCat.forEach(function (w) {
            if (String(hojaPC.getRange(w.fila, colCat).getValue() || '').trim() !== w.categoria) {
                fallas.push('la categoria "' + w.categoria + '" no quedo en la fila ' + w.fila);
            }
        });
        escritasCta.forEach(function (a) {
            const col = columnLetterToIndex(RANGES[a.bloque].columns.proyecto);
            if (String(hojaPC.getRange(a.fila, col).getValue() || '').trim() !== a.categoria) {
                fallas.push(a.cuenta + ' no quedo con su categoria');
            }
        });
        if (fallas.length) {
            _restaurarBloquesCatz(ss, foto);
            foto = null;
            throw new Error('Se escribio pero NO VERIFICA al releer: ' + fallas.slice(0, 6).join('; ') +
                (fallas.length > 6 ? ' (y ' + (fallas.length - 6) + ' mas)' : '') +
                '. El Plan de Cuentas previo esta en el respaldo "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(CATZ_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'PLAN DE CUENTAS ORDENADO\n\n' +
            '- Categorias dadas de alta: ' + escritasCat.length + '\n' +
            '- Cuentas categorizadas: ' + escritasCta.length + '\n' +
            '- Categorias que cruzan mas de un bloque: ' + plan.cruzan.length + '\n' +
            '- Respaldo del catalogo previo: "' + respaldo.nombre + '"\n\n' +
            (plan.sinCategoria.length
                ? 'SIN CATEGORIA a proposito: ' + plan.sinCategoria.map(function (c) { return c.cuenta; }).join(', ') + '\n\n'
                : '') +
            'QUE MIRAR: en el Plan de Cuentas, la columna Categoria de los tres bloques de cuentas\n' +
            'deja de estar vacia, y la columna ' + RANGES.CATEGORIAS_CUENTA.columns.nombre +
            ' tiene el catalogo de categorias de cuentas.\n\n' +
            'La misma categoria puede figurar en dos bloques -- "Vehiculo" esta en Fijos y en\n' +
            'Variables -- y eso es el cruce que permite preguntar cuanto cuesta el auto de verdad.';

        logSuccess('aplicarCategorizar: ' + escritasCat.length + ' categorias, ' + escritasCta.length + ' cuentas.');
        _mostrarCatz('Categorizar cuentas - listo', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        // Si fallo despues de haber empezado a escribir, se devuelve todo a como estaba: una
        // planilla a medio categorizar es peor que una sin categorizar.
        let restaurado = '';
        if (ss && foto) {
            try { _restaurarBloquesCatz(ss, foto); restaurado = ' Se restauraron las columnas a su estado previo.'; }
            catch (e2) { restaurado = ' ADEMAS fallo la restauracion (' + e2.message + '): usar el respaldo.'; }
        }
        const msg = 'NO APLICADO. ' + e.message + restaurado;
        logError(msg, { stack: e.stack });
        _mostrarCatz('Categorizar cuentas - ERROR', msg);
        return { ok: false, error: msg };
    }
}

// ============================================
// PLAN
// ============================================

function _planCategorizar(ss) {
    const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    if (!hojaPC) throw new Error('No existe la hoja "' + SHEETS.PLAN_CUENTAS + '".');
    const avisos = [];

    // Catalogo de categorias de CUENTAS (bloque propio, separado del de medios).
    const cfgCat = RANGES.CATEGORIAS_CUENTA;
    const colCat = columnLetterToIndex(cfgCat.columns.nombre);
    const desdeCat = getDataRow(cfgCat);
    const altoCat = hojaPC.getMaxRows() - desdeCat + 1;
    const yaEnCatalogo = Object.create(null);
    if (altoCat > 0) {
        hojaPC.getRange(desdeCat, colCat, altoCat, 1).getValues().forEach(function (f) {
            const v = String(f[0] || '').trim();
            if (v) yaEnCatalogo[_normalizarRotulo(v)] = v;
        });
    }

    // El bloque de medios NO se toca: solo se lee para poder avisar si un nombre choca.
    const cfgMed = RANGES.PROYECTOS;
    const colMedNombre = columnLetterToIndex(cfgMed.columns.nombre);
    const desdeMed = getDataRow(cfgMed);
    const altoMed = hojaPC.getMaxRows() - desdeMed + 1;
    const catDeMedios = Object.create(null);
    if (altoMed > 0) {
        hojaPC.getRange(desdeMed, colMedNombre, altoMed, 1).getValues().forEach(function (f) {
            const v = String(f[0] || '').trim();
            if (v) catDeMedios[_normalizarRotulo(v)] = v;
        });
    }

    // Cuentas del catalogo, por bloque, con su fila.
    const filaDe = Object.create(null);
    let cuentasCatalogo = 0;
    ['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES'].forEach(function (clave) {
        const cfg = RANGES[clave];
        const col = columnLetterToIndex(cfg.columns.nombre);
        const desde = getDataRow(cfg);
        const alto = hojaPC.getMaxRows() - desde + 1;
        if (alto <= 0) return;
        hojaPC.getRange(desde, col, alto, 1).getValues().forEach(function (f, i) {
            const v = String(f[0] || '').trim();
            if (!v) return;
            cuentasCatalogo++;
            filaDe[clave + ' ' + _normalizarRotulo(v)] = { fila: desde + i, cuenta: v };
        });
    });

    const asignaciones = [];
    const categoriasNuevas = [];
    const vistas = Object.create(null);
    const noEncontradas = [];
    const choques = [];
    CATZ_MAPA.forEach(function (m) {
        const clave = _normalizarRotulo(m.categoria);
        if (catDeMedios[clave]) {
            choques.push('"' + m.categoria + '" ya existe como categoria de MEDIOS. Son dos ejes ' +
                'distintos: conviene que no compartan nombre para no confundirse al leer.');
        }
        if (!yaEnCatalogo[clave] && !vistas[clave]) {
            vistas[clave] = true;
            categoriasNuevas.push({ categoria: m.categoria });
        }
        m.cuentas.forEach(function (c) {
            const ref = filaDe[m.bloque + ' ' + _normalizarRotulo(c)];
            if (!ref) { noEncontradas.push(c); return; }
            asignaciones.push({ bloque: m.bloque, fila: ref.fila, cuenta: ref.cuenta, categoria: m.categoria });
        });
    });
    if (noEncontradas.length) {
        avisos.push('Estas cuentas del mapa no estan en el catalogo y se saltean (probablemente ' +
            'grafias que todavia no se dieron de alta): ' + noEncontradas.join(', ') + '.');
    }
    choques.forEach(function (c) { avisos.push(c); });

    const asignadas = Object.create(null);
    asignaciones.forEach(function (a) { asignadas[a.bloque + ' ' + _normalizarRotulo(a.cuenta)] = true; });
    const sinCategoria = [];
    Object.keys(filaDe).forEach(function (k) {
        if (!asignadas[k]) sinCategoria.push({ cuenta: filaDe[k].cuenta });
    });

    // Categorias que cruzan mas de un bloque: el cruce que da valor al nivel.
    const porCat = Object.create(null);
    CATZ_MAPA.forEach(function (m) {
        const k = _normalizarRotulo(m.categoria);
        if (!porCat[k]) porCat[k] = { categoria: m.categoria, bloques: [] };
        if (porCat[k].bloques.indexOf(m.bloque) === -1) porCat[k].bloques.push(m.bloque);
    });
    const cruzan = Object.keys(porCat).map(function (k) { return porCat[k]; })
        .filter(function (c) { return c.bloques.length > 1; });

    return {
        asignaciones: asignaciones, categoriasNuevas: categoriasNuevas, sinCategoria: sinCategoria,
        cruzan: cruzan, cuentasCatalogo: cuentasCatalogo, avisos: avisos
    };
}

/**
 * Fotografia los cuatro rangos que se van a tocar -- las tres columnas de Categoria y el catalogo
 * nuevo -- con sus VALORES y sus REGLAS DE VALIDACION. Sin las reglas la foto no es un punto de
 * retorno: reponer valores viejos contra una lista nueva los rechaza uno por uno.
 */
function _fotografiarBloquesCatz(ss) {
    const hoja = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    const partes = [];
    _rangosCatz().forEach(function (r) {
        const alto = hoja.getMaxRows() - r.desde + 1;
        if (alto <= 0) return;
        const rango = hoja.getRange(r.desde, r.col, alto, 1);
        let dv = null;
        try { dv = rango.getDataValidations(); } catch (e) { dv = null; }
        partes.push({ col: r.col, desde: r.desde, valores: rango.getValues(), validaciones: dv });
    });
    return partes;
}

/** Los rangos que toca el modulo: las tres columnas de Categoria y el catalogo de categorias. */
function _rangosCatz() {
    const out = [];
    ['INGRESOS', 'GASTOS_FIJOS', 'GASTOS_VARIABLES'].forEach(function (clave) {
        const cfg = RANGES[clave];
        out.push({ col: columnLetterToIndex(cfg.columns.proyecto), desde: getDataRow(cfg), esCategoria: true });
    });
    const cc = RANGES.CATEGORIAS_CUENTA;
    out.push({ col: columnLetterToIndex(cc.columns.nombre), desde: getDataRow(cc), esCategoria: false });
    return out;
}

/**
 * Cambia el DOMINIO de las tres columnas de Categoria: saca la validacion vieja y pone la lista
 * de categorias de cuentas. Se corre ANTES de escribir, o cada valor nuevo se rechaza.
 */
function _abrirDominioCatz(ss) {
    const hoja = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    const lista = [];
    CATZ_MAPA.forEach(function (m) { if (lista.indexOf(m.categoria) === -1) lista.push(m.categoria); });
    const regla = SpreadsheetApp.newDataValidation()
        .requireValueInList(lista, true)
        .setAllowInvalid(false)
        .setHelpText('Categoria de la cuenta: agrupa por el motivo del movimiento')
        .build();
    _rangosCatz().forEach(function (r) {
        if (!r.esCategoria) return;
        const alto = hoja.getMaxRows() - r.desde + 1;
        if (alto <= 0) return;
        const rango = hoja.getRange(r.desde, r.col, alto, 1);
        rango.clearDataValidations();
        rango.setDataValidation(regla);
    });
    SpreadsheetApp.flush();
}

/**
 * Devuelve los cuatro rangos a como estaban. Primero se LIBERA la validacion, despues se escriben
 * los valores, y recien al final se repone la regla vieja: en ese orden, porque escribir los
 * valores viejos con la regla nueva puesta los rechazaria.
 */
function _restaurarBloquesCatz(ss, foto) {
    if (!foto || !foto.length) return;
    const hoja = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
    foto.forEach(function (p) {
        const rango = hoja.getRange(p.desde, p.col, p.valores.length, 1);
        rango.clearDataValidations();
        rango.setValues(p.valores);
    });
    SpreadsheetApp.flush();
    foto.forEach(function (p) {
        if (!p.validaciones) return;
        try { hoja.getRange(p.desde, p.col, p.valores.length, 1).setDataValidations(p.validaciones); }
        catch (e) { logError('_restaurarBloquesCatz: no se pudo reponer la validacion de la columna ' + p.col); }
    });
    SpreadsheetApp.flush();
}

function _padCatz(s, n) {
    let t = String(s);
    while (t.length < n) t += ' ';
    return t;
}

function _mostrarCatz(titulo, mensaje) {
    try { SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK); }
    catch (e) { Logger.log(titulo + '\n' + mensaje); }
}
