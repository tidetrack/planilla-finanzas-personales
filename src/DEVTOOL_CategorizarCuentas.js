/**
 * DEVTOOL_CategorizarCuentas.js
 * Ordena las cuentas del Plan de Cuentas en CATEGORIAS, y le da a cada categoria su TIPO.
 *
 * [CONCEPTO DE NEGOCIO]
 * El Plan de Cuentas tenia 60 cuentas sueltas y las tres columnas "Categoria" de los bloques de
 * cuentas estaban VACIAS -- 0 de 11 en Ingresos, 0 de 15 en Gastos Fijos, 0 de 22 en Variables.
 * Sin ese nivel intermedio no se puede leer nada por encima del detalle: "Nafta" y "Auto" son dos
 * lineas sueltas en vez de "el auto me cuesta tanto".
 *
 * decision Franco 2026-08-19: "lo que necesito es ordenar las cuentas que tengo en distintas
 * categorias y tipo de categorias".
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Es un plan de cuentas de tres niveles, el mismo esquema de cualquier contabilidad:
 *   CUENTA (Nafta)  ->  CATEGORIA (Vehiculo)  ->  TIPO (Vehiculo)
 * La categoria agrupa cuentas dentro de su bloque; el TIPO es la macro-segmentacion y CRUZA los
 * bloques. Ese cruce es todo el valor del nivel de arriba: "Vehiculo" junta Nafta y Auto (fijos)
 * con Reparaciones y Estacionamiento (variables), y recien ahi la planilla puede contestar cuanto
 * cuesta el auto de verdad -- $4.793.879 en 32 meses, $149.808 por mes, el segundo gasto mas
 * grande despues de los negocios propios.
 *
 * ============================================================================
 * LOS DOS VOCABULARIOS DE "TIPO", Y POR QUE NO SON EL MISMO
 * ============================================================================
 * En P:Q ya vivian cuatro tipos -- Ahorros, Inversiones, Financiacion, Hogar -- pero fueron
 * pensados para los MEDIOS DE PAGO: contestan DONDE ESTA la plata (patrimonial). Las categorias
 * de CUENTAS contestan otra cosa: PARA QUE se usa. Tres de los cuatro sirven para las dos
 * preguntas (Financiacion, Hogar, Inversiones) y se reutilizan tal cual; "Ahorros" queda solo
 * para medios, porque ninguna cuenta de gasto o ingreso es un vehiculo de ahorro.
 *
 * Los ocho tipos que se agregan (Ingresos, Negocios, Vehiculo, Salud, Bienestar, Obligaciones,
 * Equipamiento, Otros) son los que faltaban para cubrir el lado del uso. Forzar las cuentas
 * dentro de los cuatro viejos habria puesto "Sueldo" y "Nafta" bajo etiquetas que no significan
 * nada para ellas.
 *
 * Ambos vocabularios conviven en la MISMA tabla P:Q sin chocar: un medio busca su propia
 * categoria y una cuenta la suya. Lo unico que no puede pasar es que dos categorias distintas se
 * llamen igual, y el preflight lo verifica.
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
 * 4. NO borra ni renombra ninguna categoria existente de P:Q.
 *
 * Contrato: { ok: boolean, detalle?: string, error?: string }.
 *   estadoCategorizar()   -> solo lectura. Se corre PRIMERO.
 *   aplicarCategorizar()  -> respaldo verificado del catalogo + escritura + relectura.
 *
 * @version 0.19.0
 * @since 2026-08-19
 * @lastModified 2026-08-19
 */

const CATZ_PROP_RESPALDO = 'categorizar_respaldo';

/**
 * El mapa completo: bloque, categoria, tipo, y las cuentas que la componen.
 *
 * Derivado de 3.458 movimientos sobre 32 meses -- el agrupamiento sigue el uso real, no una
 * taxonomia de manual. Las cuentas que aparecen escritas de dos formas figuran las dos veces a
 * proposito: van a la misma categoria, asi que el agrupamiento sale bien aunque el par todavia
 * no se haya unificado.
 *
 * "Compra USD" NO esta, y es deliberado (ver la cabecera del modulo).
 */
const CATZ_MAPA = [
    // --- INGRESOS ---
    { bloque: 'INGRESOS', categoria: 'Sueldo', tipo: 'Ingresos',
      cuentas: ['Sueldo'] },
    { bloque: 'INGRESOS', categoria: 'Negocios propios', tipo: 'Negocios',
      cuentas: ['Tidetrack', 'umoh', 'Umoh', 'Ingreso Asesor', 'FF'] },
    { bloque: 'INGRESOS', categoria: 'Ingresos extraordinarios', tipo: 'Ingresos',
      cuentas: ['Ingresos Extra', 'Ingresos extra', 'Ingreso Viejo'] },
    { bloque: 'INGRESOS', categoria: 'Prestamos recibidos', tipo: 'Financiación',
      cuentas: ['Plata Prestada', 'Plata prestada'] },
    { bloque: 'INGRESOS', categoria: 'Rendimientos financieros', tipo: 'Inversiones',
      cuentas: ['Inversiones', 'Intereses bancos', 'Intereses Bancos', 'Rendimientos'] },

    // --- GASTOS FIJOS ---
    { bloque: 'GASTOS_FIJOS', categoria: 'Deuda y financiacion', tipo: 'Financiación',
      cuentas: ['Pago tarjeta', 'Pago Tarjeta', 'Pago Tarjeta MP', 'Prestamo Galicia',
                'Prestamo Viejo', 'Deuda Eze', 'Deuda Dima', 'Deuda Viejo', 'Deudas'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Vehiculo', tipo: 'Vehículo',
      cuentas: ['Nafta', 'Auto'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Salud', tipo: 'Salud',
      cuentas: ['Prepaga', 'Salud'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Impuestos', tipo: 'Obligaciones',
      cuentas: ['MONOTRIBUTO'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Servicios y suscripciones', tipo: 'Hogar',
      cuentas: ['Linea telefónica', 'Subscripciones', 'Seguro Compu', 'Seguro Celu'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Bienestar', tipo: 'Bienestar',
      cuentas: ['SportClub', 'Sportclub'] },
    { bloque: 'GASTOS_FIJOS', categoria: 'Mascotas', tipo: 'Hogar',
      cuentas: ['Gatos'] },

    // --- GASTOS VARIABLES ---
    { bloque: 'GASTOS_VARIABLES', categoria: 'Alimentacion y social', tipo: 'Hogar',
      cuentas: ['Comidas', 'Juntadas', 'Salidas'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Equipamiento', tipo: 'Equipamiento',
      cuentas: ['Computación', 'Ropa'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Viajes', tipo: 'Bienestar',
      cuentas: ['Viajes'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Ocio y regalos', tipo: 'Bienestar',
      cuentas: ['Entretenimiento', 'Regalos'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Trabajo y negocio', tipo: 'Negocios',
      cuentas: ['Trabajo', 'Gastos - TT', 'Gastos - Tidetrack'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Vehiculo', tipo: 'Vehículo',
      cuentas: ['Reparaciones Auto', 'Estacionamiento'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Cuidado personal', tipo: 'Salud',
      cuentas: ['Corte Pelo', 'Medicamentos / Higiene', 'Medicamentos / Accesorios'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Formacion', tipo: 'Bienestar',
      cuentas: ['Facultad', 'Entrenamiento'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Costos de inversion', tipo: 'Inversiones',
      cuentas: ['Impuestos compra Bonos'] },
    { bloque: 'GASTOS_VARIABLES', categoria: 'Otros', tipo: 'Otros',
      cuentas: ['Otros', 'Imprevistos', 'Perdidas'] }
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
        l.push('Estructura: CUENTA -> CATEGORIA -> TIPO. La categoria agrupa dentro del bloque;');
        l.push('el tipo es la macro-segmentacion y CRUZA los bloques.');
        l.push('');
        l.push('CATEGORIAS a dar de alta en el catalogo: ' + plan.categoriasNuevas.length);
        plan.categoriasNuevas.forEach(function (c) { l.push('   ' + _padCatz(c.categoria, 28) + ' tipo: ' + c.tipo); });
        l.push('');
        l.push('TIPOS que se usan: ' + plan.tipos.length + ' (' + plan.tiposNuevos.length + ' nuevos)');
        plan.tipos.forEach(function (t) {
            l.push('   ' + _padCatz(t.tipo, 16) + (t.esNuevo ? 'NUEVO    ' : 'ya existe') + '  ' + t.categorias.join(', '));
        });
        l.push('');
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
    let ui = null;
    try { ui = SpreadsheetApp.getUi(); }
    catch (e) { return { ok: false, error: 'aplicarCategorizar necesita UI (menu Tidetrack Dev).' }; }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
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
            'Tipos que se usan: ' + plan.tipos.map(function (t) { return t.tipo; }).join(', ') + '\n' +
            '(' + plan.tiposNuevos.length + ' son nuevos; los otros ya existian en tu catalogo)\n\n' +
            'No se toca el ledger, ni se borra ni se renombra ninguna categoria existente.\n\nContinuar?',
            ui.ButtonSet.YES_NO);
        if (conf !== ui.Button.YES) return { ok: false, error: 'Cancelado. No se escribio nada.' };

        const hojaPC = ss.getSheetByName(SHEETS.PLAN_CUENTAS);
        const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        const respaldo = _respaldarCatalogo(ss, hojaPC, sello);

        // --- 1. Alta de las categorias nuevas en P:Q ---
        const cfgCat = RANGES.PROYECTOS;
        const colNombre = columnLetterToIndex(cfgCat.columns.nombre);
        const colTipo = columnLetterToIndex(cfgCat.columns.tipo);
        let fila = _primeraFilaLibre(hojaPC, colNombre, getDataRow(cfgCat));
        const escritasCat = [];
        plan.categoriasNuevas.forEach(function (c) {
            hojaPC.getRange(fila, colNombre).setValue(c.categoria);
            hojaPC.getRange(fila, colTipo).setValue(c.tipo);
            escritasCat.push({ fila: fila, categoria: c.categoria, tipo: c.tipo });
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
            if (String(hojaPC.getRange(w.fila, colNombre).getValue() || '').trim() !== w.categoria) {
                fallas.push('la categoria "' + w.categoria + '" no quedo en la fila ' + w.fila);
            }
            if (String(hojaPC.getRange(w.fila, colTipo).getValue() || '').trim() !== w.tipo) {
                fallas.push('el tipo de "' + w.categoria + '" no quedo escrito');
            }
        });
        escritasCta.forEach(function (a) {
            const col = columnLetterToIndex(RANGES[a.bloque].columns.proyecto);
            if (String(hojaPC.getRange(a.fila, col).getValue() || '').trim() !== a.categoria) {
                fallas.push(a.cuenta + ' no quedo con su categoria');
            }
        });
        if (fallas.length) {
            throw new Error('Se escribio pero NO VERIFICA al releer: ' + fallas.slice(0, 6).join('; ') +
                (fallas.length > 6 ? ' (y ' + (fallas.length - 6) + ' mas)' : '') +
                '. El Plan de Cuentas previo esta en el respaldo "' + respaldo.nombre + '".');
        }

        PropertiesService.getDocumentProperties().setProperty(CATZ_PROP_RESPALDO, respaldo.nombre);

        const detalle = 'PLAN DE CUENTAS ORDENADO\n\n' +
            '- Categorias dadas de alta: ' + escritasCat.length + '\n' +
            '- Cuentas categorizadas: ' + escritasCta.length + '\n' +
            '- Tipos en uso: ' + plan.tipos.length + ' (' + plan.tiposNuevos.length + ' nuevos)\n' +
            '- Respaldo del catalogo previo: "' + respaldo.nombre + '"\n\n' +
            (plan.sinCategoria.length
                ? 'SIN CATEGORIA a proposito: ' + plan.sinCategoria.map(function (c) { return c.cuenta; }).join(', ') + '\n\n'
                : '') +
            'QUE MIRAR: en el Plan de Cuentas, la columna Categoria de los tres bloques de cuentas\n' +
            'deja de estar vacia, y el bloque de Categorias tiene las nuevas con su tipo.\n\n' +
            'El TIPO cruza los bloques: "Vehiculo" junta Nafta y Auto (fijos) con Reparaciones y\n' +
            'Estacionamiento (variables). Ese cruce es el que permite preguntar cuanto cuesta el auto.';

        logSuccess('aplicarCategorizar: ' + escritasCat.length + ' categorias, ' + escritasCta.length + ' cuentas.');
        _mostrarCatz('Categorizar cuentas - listo', detalle);
        return { ok: true, detalle: detalle };

    } catch (e) {
        const msg = 'NO APLICADO. ' + e.message;
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

    // Categorias que ya existen en P:Q, con su tipo.
    const cfgCat = RANGES.PROYECTOS;
    const colCatNombre = columnLetterToIndex(cfgCat.columns.nombre);
    const colCatTipo = columnLetterToIndex(cfgCat.columns.tipo);
    const desdeCat = getDataRow(cfgCat);
    const altoCat = hojaPC.getMaxRows() - desdeCat + 1;
    const catExistentes = Object.create(null);
    const tiposExistentes = Object.create(null);
    if (altoCat > 0) {
        const vals = hojaPC.getRange(desdeCat, colCatNombre, altoCat, colCatTipo - colCatNombre + 1).getValues();
        vals.forEach(function (f) {
            const nombre = String(f[0] || '').trim();
            const tipo = String(f[f.length - 1] || '').trim();
            if (nombre) catExistentes[_normalizarRotulo(nombre)] = { nombre: nombre, tipo: tipo };
            if (tipo) tiposExistentes[_normalizarRotulo(tipo)] = tipo;
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
            filaDe[clave + ' ' + _normalizarRotulo(v)] = { fila: desde + i, cuenta: v };
        });
    });

    // Asignaciones y categorias nuevas.
    const asignaciones = [];
    const categoriasNuevas = [];
    const vistasCat = Object.create(null);
    const noEncontradas = [];
    CATZ_MAPA.forEach(function (m) {
        const clave = _normalizarRotulo(m.categoria);
        // Choque de nombre: una categoria de cuentas que se llama igual que una de medios pero
        // con otro tipo dejaria el catalogo con dos verdades para el mismo nombre.
        const yaEsta = catExistentes[clave];
        if (yaEsta && _normalizarRotulo(yaEsta.tipo) !== _normalizarRotulo(m.tipo)) {
            throw new Error('La categoria "' + m.categoria + '" ya existe en el catalogo con tipo "' +
                yaEsta.tipo + '" y el mapa la quiere con tipo "' + m.tipo + '". Dos verdades para el ' +
                'mismo nombre romperian toda formula que cruce por categoria. No se escribe nada.');
        }
        if (!yaEsta && !vistasCat[clave]) {
            vistasCat[clave] = true;
            categoriasNuevas.push({ categoria: m.categoria, tipo: m.tipo });
        }
        m.cuentas.forEach(function (c) {
            const ref = filaDe[m.bloque + ' ' + _normalizarRotulo(c)];
            if (!ref) { noEncontradas.push(c); return; }
            asignaciones.push({ bloque: m.bloque, fila: ref.fila, cuenta: ref.cuenta, categoria: m.categoria, tipo: m.tipo });
        });
    });
    if (noEncontradas.length) {
        avisos.push('Estas cuentas del mapa no estan en el catalogo y se saltean (probablemente ' +
            'grafias que todavia no se dieron de alta): ' + noEncontradas.join(', ') + '.');
    }

    // Cuentas del catalogo que quedan sin categoria.
    const asignadas = Object.create(null);
    asignaciones.forEach(function (a) { asignadas[a.bloque + ' ' + _normalizarRotulo(a.cuenta)] = true; });
    const sinCategoria = [];
    Object.keys(filaDe).forEach(function (k) {
        if (!asignadas[k]) sinCategoria.push({ cuenta: filaDe[k].cuenta });
    });

    // Resumen de tipos.
    const porTipo = Object.create(null);
    CATZ_MAPA.forEach(function (m) {
        if (!porTipo[m.tipo]) porTipo[m.tipo] = { tipo: m.tipo, categorias: [], esNuevo: !tiposExistentes[_normalizarRotulo(m.tipo)] };
        if (porTipo[m.tipo].categorias.indexOf(m.categoria) === -1) porTipo[m.tipo].categorias.push(m.categoria);
    });
    const tipos = Object.keys(porTipo).map(function (k) { return porTipo[k]; });
    tipos.sort(function (a, b) { return a.tipo.localeCompare(b.tipo); });

    return {
        asignaciones: asignaciones, categoriasNuevas: categoriasNuevas, sinCategoria: sinCategoria,
        tipos: tipos, tiposNuevos: tipos.filter(function (t) { return t.esNuevo; }),
        cuentasCatalogo: cuentasCatalogo, avisos: avisos
    };
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
