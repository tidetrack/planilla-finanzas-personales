/* ENTORNO DE PRUEBAS -- no hay servidor.
   Se reemplaza google.script.run por un doble que devuelve el catalogo REAL de la planilla
   (sacado del gemelo digital) con la latencia medida en vivo: 537 ms para el catalogo. Asi lo
   que se prueba es la interfaz de verdad, con los tiempos de verdad, y no una maqueta. */
/* El catalogo del doble es el CONTRATO del backend: EXACTAMENTE los campos que devuelve
   obtenerCatalogoShell (probar_shell.js cruza las claves). La poda 2026-08-29 retiro
   planilla, version, categorias, comodines y libres: campos sin ningun consumidor en el
   cliente -- el guard campo->consumidor de probar_shell.js impide que vuelvan sin lector. */
var CATALOGO_REAL = {"ingresos": ["Tidetrack", "Umoh", "Ingresos Extra", "Intereses bancos", "Ingreso Asesor", "Plata Prestada", "Sueldo", "FF", "Ingreso Viejo", "Inversiones", "Rendimientos", "Ajuste"], "fijos": ["Auto", "Gatos", "Linea telefónica", "MONOTRIBUTO", "Nafta", "Pago tarjeta", "Prepaga Salud", "SportClub", "Prestamo Galicia", "Deuda Eze", "Deuda Viejo", "Deuda Dima", "Prestamo Viejo", "Subscripciones", "Seguro Compu", "Seguro Celu", "Pago Tarjeta MP"], "variables": ["Comidas", "Computación", "Corte Pelo", "Entretenimiento", "Estacionamiento", "Facultad", "Imprevistos", "Juntadas", "Medicamentos / Higiene", "Regalos", "Reparaciones Auto", "Ropa", "Trabajo", "Viajes", "Salidas", "Compra USD", "Entrenamiento", "Impuestos", "Otros"], "medios": [{"nombre": "Dolar Cash", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar Galicia", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar Mercado Pago", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar NaranjaX", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar Patagonia", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Efectivo", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Frasco Transitorio NaranjaX", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Frascos Naranja X", "moneda": "ARS", "tipo": "Ahorros"}, {"nombre": "Frascos Nx - Préstamo", "moneda": "ARS", "tipo": "Financiación"}, {"nombre": "Galicia", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Mercado Pago", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "NaranjaX", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Patagonia", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Ualá", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "YPF", "moneda": "ARS", "tipo": "Hogar"}], "monedas": ["ARS", "USD", "AUD", "EUR"], "filasGrilla": 15, "ok": true};
/* Datos de ejemplo de las tres vistas nuevas, coherentes con el catalogo de arriba.
   Los recurrentes viven MUTABLES en memoria para que guardar/borrar/volcar se sientan de
   verdad dentro de una misma sesion de pruebas; los saldos son un snapshot verosimil con
   la moneda de cada medio del catalogo. La tolerancia es la del backend (SHELL_CONC_TOLERANCIA). */
/* MODELO NUEVO (v0.64.0): cada recurrente lleva su vigencia 'YYYY-MM' ('' = desde siempre /
   sin fin). El doble trae los tres casos que importan mirar en local: uno sin vigencia, uno
   que arranca en un mes futuro y uno pausado con fecha de fin. */
var RECURRENTES_DOBLE = [
  { nombre: 'Netflix', cuenta: 'Subscripciones', monto: 13999, moneda: 'ARS',
    medio: 'NaranjaX', dia: 5, nota: '', activo: true, desde: '', hasta: '' },
  { nombre: 'SportClub', cuenta: 'SportClub', monto: 42000, moneda: 'ARS',
    medio: 'Galicia', dia: 1, nota: 'debito automatico', activo: true,
    desde: '2026-09', hasta: '' },
  { nombre: 'iCloud', cuenta: 'Subscripciones', monto: 2.99, moneda: 'USD',
    medio: 'Dolar Galicia', dia: 28, nota: '', activo: false, desde: '', hasta: '2027-03' }
];
/* La ventana del horizonte del doble: 12 meses desde el mes en curso, igual que
   REC_HORIZONTE_MESES del backend. `RECURRENTES_SYNC_DOBLE` es cuantos meses estan escritos:
   arranca CORTO a proposito (10 de 12) para poder ver en local el estado "desincronizado" y su
   boton, que es justo el que no se puede fabricar a mano en la planilla. */
var REC_HORIZONTE_DOBLE = 12;
var REC_MESES_ESCRITOS_DOBLE = 10;
function recClavesVentanaDoble() {
  var hoy = new Date(), claves = [];
  for (var i = 0; i < REC_HORIZONTE_DOBLE; i++) {
    var d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    claves.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return claves;
}
function recCorreEnDoble(r, clave) {
  if (!r.activo) return false;
  if (r.desde && r.desde > clave) return false;
  if (r.hasta && clave > r.hasta) return false;
  return true;
}
function estadoHorizonteDoble() {
  var claves = recClavesVentanaDoble();
  var activos = RECURRENTES_DOBLE.filter(function (r) { return r.activo; });
  var total = {};
  activos.forEach(function (r) { total[r.moneda] = (total[r.moneda] || 0) + r.monto; });
  var filas = 0, faltantes = [];
  claves.forEach(function (c, i) {
    var corren = RECURRENTES_DOBLE.filter(function (r) { return recCorreEnDoble(r, c); }).length;
    if (i < REC_MESES_ESCRITOS_DOBLE) filas += corren;
    else faltantes.push(c);
  });
  // Sobrantes: filas de recurrentes en meses POSTERIORES a la ventana, que el horizonte no
  // toca. En el doble son fijas y a proposito distintas de cero: es un estado que en la planilla
  // solo aparece si alguien volco a un mes lejano con el modelo viejo, y sin esto no se puede
  // mirar el aviso en local.
  var lejano = new Date();
  lejano = new Date(lejano.getFullYear(), lejano.getMonth() + REC_HORIZONTE_DOBLE + 1, 1);
  var claveLejana = lejano.getFullYear() + '-' + String(lejano.getMonth() + 1).padStart(2, '0');
  return { ok: true,
           ventana: { desde: claves[0], hasta: claves[claves.length - 1] },
           activos: activos.length,
           pausados: RECURRENTES_DOBLE.length - activos.length,
           totalPorMoneda: total,
           filasEnVentana: filas,
           mesesFaltantes: faltantes,
           sobrantes: 2,
           mesesSobrantes: [claveLejana],
           desincronizado: faltantes.length > 0 };
}
var SALDOS_CONC_DOBLE = {
  ok: true,
  tolerancia: 0.005,
  ultimaFechaLedger: '12/08/2026',
  hoy: (function () {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  })(),
  saldos: [
    { medio: 'Dolar Cash', moneda: 'USD', saldo: 1430 },
    { medio: 'Dolar Galicia', moneda: 'USD', saldo: 210.55 },
    { medio: 'Dolar Mercado Pago', moneda: 'USD', saldo: 0 },
    { medio: 'Dolar NaranjaX', moneda: 'USD', saldo: 18.9 },
    { medio: 'Dolar Patagonia', moneda: 'USD', saldo: 0 },
    { medio: 'Efectivo', moneda: 'ARS', saldo: 25400 },
    { medio: 'Frasco Transitorio NaranjaX', moneda: 'ARS', saldo: 0 },
    { medio: 'Frascos Naranja X', moneda: 'ARS', saldo: 500000 },
    { medio: 'Frascos Nx - Préstamo', moneda: 'ARS', saldo: -120000 },
    { medio: 'Galicia', moneda: 'ARS', saldo: 319569.7 },
    { medio: 'Mercado Pago', moneda: 'ARS', saldo: 12874.31 },
    { medio: 'NaranjaX', moneda: 'ARS', saldo: 17433.79 },
    { medio: 'Patagonia', moneda: 'ARS', saldo: 88000 },
    { medio: 'Ualá', moneda: 'ARS', saldo: 0 },
    { medio: 'YPF', moneda: 'ARS', saldo: 3120 }
  ]
};
/* EL ABM DEL PLAN DE CUENTAS (vista 'cuentas'). Contrato DISTINTO al del resto del shell y
   por eso se doble tal cual: getAbmFormData devuelve el objeto de dominios PELADO (sin ok),
   getCategoryAccounts devuelve un ARRAY, y los tres de escritura devuelven {success:true} y
   LANZAN ante cualquier rechazo -- que aca se simula llamando al handler de falla, porque el
   doble responde por setTimeout y un throw no llegaria a ningun lado.
   Las filas salen del catalogo real de arriba, con rowIndex igual al indice de la fila en la
   tabla del Plan, que es lo que updateRow/deleteRow reciben. Mutan en memoria para que un
   alta y su re-listado se sientan de verdad dentro de una misma sesion de pruebas. */
var ABM_DOMINIOS_DOBLE = {
  monedas: CATALOGO_REAL.monedas,
  categoriasCuenta: ['Trabajo y negocio', 'Vehiculo', 'Salud', 'Alimentacion y social',
                     'Hogar', 'Educacion', 'Deudas'],
  tiposMedio: ['Hogar', 'Ahorros', 'Inversiones', 'Financiación']
};
var ABM_FILAS_DOBLE = (function () {
  var cuenta = function (nombres, categoria) {
    return nombres.map(function (n) {
      return { nombre: n, moneda: '', proyecto: categoria, tipo: '' };
    });
  };
  return {
    INGRESOS: cuenta(CATALOGO_REAL.ingresos, 'Trabajo y negocio'),
    GASTOS_FIJOS: cuenta(CATALOGO_REAL.fijos, 'Hogar'),
    GASTOS_VARIABLES: cuenta(CATALOGO_REAL.variables, 'Alimentacion y social'),
    MEDIOS_PAGO: CATALOGO_REAL.medios.map(function (m) {
      return { nombre: m.nombre, moneda: m.moneda, proyecto: m.tipo, tipo: '' };
    })
  };
})();
/* PROYECCIONES ELABORADAS (vista 'proyecciones'). Contrato de DEVTOOL_ProyeccionAbm.js: en
   exito devuelven el objeto de datos PELADO (sin campo ok) y en fallo LANZAN -- que aca se
   simula llamando al handler de falla, porque el doble responde por setTimeout y un throw no
   llegaria a ningun lado. Los datos imitan el estado REAL de produccion: mucho presupuesto
   base, poco guardado a mano, un mes del shell y uno de recurrentes; y un grupo 'otros' con
   clave 'sin-fecha' para poder mirar ese caso limite sin fabricarlo a mano.
   Muta en memoria: borrar un periodo y deshacerlo se sienten de verdad en una misma sesion. */
var PABM_MES_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function pabmMesLabelDoble(clave) {
  var m = /^(\d{4})-(\d{2})$/.exec(clave || '');
  if (!m) return 'Sin mes reconocible';
  return PABM_MES_ES[Number(m[2]) - 1] + ' ' + m[1];
}
/* Cada fila del doble es una fila real de "Proyeccion": los totales y el detalle se DERIVAN
   de estas filas, nunca se escriben a mano, para que una baja o una edicion muevan los dos. */
var PROY_FILAS_DOBLE = (function () {
  var filas = [];
  var n = 100;
  var poner = function (clave, origen, sello, cuenta, tipoCuenta, monto, moneda, notaLibre) {
    filas.push({ fila: n++, clave: clave, origen: origen, sello: sello, cuenta: cuenta,
                 tipoCuenta: tipoCuenta, tipo: tipoCuenta === 'Ingreso' ? 'Ingreso' : 'Egreso',
                 monto: monto, moneda: moneda, notaLibre: notaLibre || '' });
  };
  var CLAVES_BASE = ['2026-09', '2026-10', '2026-11'];
  CLAVES_BASE.forEach(function (clave, i) {
    poner(clave, 'base', '2026-08-01_090000', 'Sueldo', 'Ingreso', 1850000 + i * 1000, 'ARS');
    poner(clave, 'base', '2026-08-01_090000', 'Nafta', 'Gasto Fijo', 92000, 'ARS');
    poner(clave, 'base', '2026-08-01_090000', 'Prepaga Salud', 'Gasto Fijo', 148000, 'ARS');
    poner(clave, 'base', '2026-08-01_090000', 'Comidas', 'Gasto Variable', 310000, 'ARS');
    poner(clave, 'base', '2026-08-01_090000', 'Viajes', 'Categoria Rara', 40000, 'ARS');
  });
  poner('2026-09', 'guardado', '2026-08-20_143012', 'Sueldo', 'Ingreso', 2100000, 'ARS');
  poner('2026-09', 'guardado', '2026-08-20_143012', 'Alquiler', 'Gasto Fijo', 480000, 'ARS');
  poner('2026-09', 'guardado', '2026-08-28_101500', 'Subscripciones', 'Gasto Fijo', 2.99, 'USD');
  poner('2026-09', 'shell', 'shell_2026-08-29_181203445', 'Regalos', 'Gasto Variable', 65000,
        'ARS', 'cumple de mama');
  poner('2026-10', 'shell', 'shell_2026-08-29_181500', 'Viajes', 'Gasto Variable', 900, 'USD',
        'pasaje Bariloche');
  poner('2026-09', 'recurrentes', '2026-08-27_120000', 'Subscripciones', 'Gasto Fijo', 13999,
        'ARS', 'Netflix');
  poner('2026-09', 'recurrentes', '2026-08-27_120000', 'SportClub', 'Gasto Fijo', 42000, 'ARS',
        'SportClub: debito automatico');
  poner('sin-fecha', 'otros', null, 'Imprevistos', 'Gasto Variable', 15000, 'ARS');
  return filas;
})();
var PROY_ORIGENES_DOBLE = ['guardado', 'shell', 'recurrentes', 'base', 'otros'];
/* EDICION RESTRINGIDA POR ORIGEN (2026-08-30). Solo 'shell' se edita: es la unica poblacion
   que no tiene un documento aguas arriba con el que pueda discrepar. Los cuatro mensajes son
   copia LITERAL de PA_MSJ_NO_EDITABLE (DEVTOOL_ProyeccionAbm.js), porque el doble tiene que
   mentir lo menos posible: probar_shell.js no los cruza, pero mirar la vista en local con un
   texto distinto al de produccion es exactamente como se valida la pantalla equivocada. */
var PA_MSJ_NO_EDITABLE_DOBLE = {
  guardado: 'Esta fila viene de la hoja Presupuesto y su nota afirma que cerro contra ese total. ' +
    'Se corrige en la hoja Presupuesto y se vuelve a guardar el mes: ' +
    'tidetrack Dev > Presupuesto: guardar proyeccion > 2. Aplicar.',
  recurrentes: 'Esta fila la mantiene la vista de Gastos recurrentes. ' +
    'Se corrige en Gastos recurrentes: cambia el monto y la proyeccion se actualiza sola.',
  base: 'Esta fila es del presupuesto base historico (un promedio automatico). ' +
    'El presupuesto base se recalcula corriendo de nuevo ese modulo: ' +
    'tidetrack Dev > Presupuesto base (desde el historial).',
  otros: 'No se reconoce el origen de esta fila. Solo se puede borrar el mes completo.'
};
var PA_MSJ_BAJA_REC_DOBLE = 'Este mes lo mantiene la vista de Gastos recurrentes. Para que ' +
  'deje de proyectarse, pausalo o ponele fecha de fin alli.';
/* La baja de un mes de 'recurrentes' se bloquea DENTRO de la ventana del horizonte y se
   permite fuera (historia congelada). Es el mismo criterio de _motivoBajaBloqueadaPa. */
function proyBajaBloqueadaDoble(clave, origen) {
  if (origen !== 'recurrentes') return '';
  return recClavesVentanaDoble().indexOf(clave) === -1 ? '' : PA_MSJ_BAJA_REC_DOBLE;
}
var PROY_PAPELERA_DOBLE = null;   // la ULTIMA baja, unica reversible (como el servidor)
var PROY_EDICION_DOBLE = null;    // la ULTIMA edicion de monto
function proyTotalesDoble(filas) {
  var mapa = { 'Ingreso': 'ingresos', 'Gasto Fijo': 'fijos', 'Gasto Variable': 'variables' };
  var acum = { ingresos: {}, fijos: {}, variables: {} }, otrasFilas = 0;
  filas.forEach(function (f) {
    var bloque = mapa[f.tipoCuenta];
    if (!bloque) { otrasFilas++; return; }
    acum[bloque][f.moneda] = (acum[bloque][f.moneda] || 0) + f.monto;
  });
  var orden = CATALOGO_REAL.monedas;
  var arr = function (a) {
    return Object.keys(a).sort(function (x, y) { return orden.indexOf(x) - orden.indexOf(y); })
      .map(function (m) { return { moneda: m, monto: a[m] }; });
  };
  var union = {};
  var bloques = [acum.ingresos, acum.fijos, acum.variables];
  bloques.forEach(function (a) {
    Object.keys(a).forEach(function (m) { union[m] = true; });
  });
  var neto = Object.keys(union).sort(function (x, y) { return orden.indexOf(x) - orden.indexOf(y); })
    .map(function (m) {
      return { moneda: m, monto: (acum.ingresos[m] || 0) - (acum.fijos[m] || 0) - (acum.variables[m] || 0) };
    });
  return { ingresos: arr(acum.ingresos), fijos: arr(acum.fijos), variables: arr(acum.variables),
           neto: neto, otrasFilas: otrasFilas };
}
function proyDelGrupoDoble(clave, origen) {
  return PROY_FILAS_DOBLE.filter(function (f) { return f.clave === clave && f.origen === origen; });
}
window.google = { script: {
  run: (function () {
    function cadena() {
      var exito = function () {}, falla = function () {};
      var api = {
        withSuccessHandler: function (f) { exito = f; return api; },
        withFailureHandler: function (f) { falla = f; return api; },
        obtenerCatalogoShell: function () {
          setTimeout(function () { exito(JSON.parse(JSON.stringify(CATALOGO_REAL))); }, 537);
        },
        registrarMovimientos: function (lista) {
          setTimeout(function () {
            exito({ ok: true, mensaje: 'Listo. Cargaste ' + lista.length + ' movimiento(s). ' +
                    '(Entorno de pruebas: no se escribio en la planilla.)' });
          }, 900);
        },
        // decision Franco 2026-08-25: el doble sigue al SHELL, no al backend. El shell paso a
        // carga MULTIPLE de traspasos (v0.53.0) y llama registrarTraspasos; los endpoints
        // singulares (registrarMovimiento/registrarTraspaso) se retiraron del backend el
        // 2026-08-29 por tener CERO llamadores. Un stub que nadie llama solo sirve para que
        // la proxima auditoria lo confunda con cobertura -- que es exactamente lo que paso aca.
        registrarTraspasos: function (lista) {
          setTimeout(function () {
            exito({ ok: true, mensaje: 'Listo. Registraste ' + lista.length + ' traspaso(s). ' +
                    '(Entorno de pruebas: no se escribio en la planilla.)' });
          }, 900);
        },
        registrarProyecciones: function (lista) {
          setTimeout(function () {
            exito({ ok: true, mensaje: 'Listo. Guardaste ' + lista.length + ' proyeccion(es). ' +
                    '(Entorno de pruebas: no se escribio en la planilla.)' });
          }, 900);
        },
        obtenerSaldosConciliacion: function () {
          // La medicion real lee el ledger entero: es la llamada mas cara del shell.
          setTimeout(function () { exito(JSON.parse(JSON.stringify(SALDOS_CONC_DOBLE))); }, 1600);
        },
        registrarConciliacion: function (lista) {
          setTimeout(function () {
            exito({ ok: true, mensaje: 'Listo. Se cargaron ' + lista.length + ' ajuste(s). ' +
                    '(Entorno de pruebas: no se escribio en la planilla.)' });
          }, 1400);
        },
        obtenerRecurrentes: function () {
          setTimeout(function () {
            exito({ ok: true, recurrentes: JSON.parse(JSON.stringify(RECURRENTES_DOBLE)) });
          }, 600);
        },
        guardarRecurrente: function (d) {
          // Upsert por nombre, como el backend, para que editar y re-listar se vean de verdad.
          setTimeout(function () {
            var indice = -1;
            RECURRENTES_DOBLE.forEach(function (r, i) {
              if (indice === -1 && r.nombre.toLowerCase() === String(d.nombre || '').trim().toLowerCase()) indice = i;
            });
            var reg = { nombre: String(d.nombre || '').trim(), cuenta: d.cuenta, monto: d.monto,
                        moneda: d.moneda, medio: d.medio, dia: d.dia, nota: d.nota || '',
                        activo: d.activo === 'Si',
                        desde: String(d.desde || ''), hasta: String(d.hasta || '') };
            var mensaje;
            if (indice === -1) {
              RECURRENTES_DOBLE.push(reg);
              mensaje = 'Listo. Guardaste "' + reg.nombre + '".';
            } else {
              RECURRENTES_DOBLE[indice] = reg;
              mensaje = 'Listo. Actualizaste "' + reg.nombre + '".';
            }
            if (d.activo === 'No') mensaje += ' Quedo pausado: sale de los meses futuros.';
            // FASE 2. El nombre "Fase2" en el recurrente dispara el camino que NO se puede
            // provocar a mano: la escritura entro, la sincronizacion no. Sirve para mirar en
            // local que el aviso con reintento aparece y que el recurrente NO se pierde.
            if (/fase2/i.test(reg.nombre)) {
              exito({ ok: true, mensaje: mensaje + ' (Entorno de pruebas.)',
                      sincronizado: false,
                      aviso: 'La proyeccion no se actualizo: la cotizacion del dia no se pudo ' +
                             'resolver. El recurrente quedo guardado igual.' });
              return;
            }
            REC_MESES_ESCRITOS_DOBLE = REC_HORIZONTE_DOBLE;
            exito({ ok: true, mensaje: mensaje + ' (Entorno de pruebas.)', sincronizado: true });
          }, 700);
        },
        borrarRecurrente: function (nombre) {
          setTimeout(function () {
            var antes = RECURRENTES_DOBLE.length;
            RECURRENTES_DOBLE = RECURRENTES_DOBLE.filter(function (r) {
              return r.nombre.toLowerCase() !== String(nombre || '').trim().toLowerCase();
            });
            if (RECURRENTES_DOBLE.length === antes) {
              exito({ ok: false, error: 'No existe un recurrente llamado "' + nombre + '".' });
            } else {
              REC_MESES_ESCRITOS_DOBLE = REC_HORIZONTE_DOBLE;
              exito({ ok: true, sincronizado: true,
                      mensaje: 'Listo. Se borro "' + nombre + '". Lo proyectado en meses ' +
                      'pasados no se toca. (Entorno de pruebas.)' });
            }
          }, 700);
        },
        estadoHorizonteRecurrentes: function () {
          // SOLO LECTURA: al entrar a la vista no se escribe nada, ni en el doble.
          setTimeout(function () { exito(estadoHorizonteDoble()); }, 500);
        },
        sincronizarRecurrentes: function () {
          setTimeout(function () {
            REC_MESES_ESCRITOS_DOBLE = REC_HORIZONTE_DOBLE;
            var e = estadoHorizonteDoble();
            exito({ ok: true, mensaje: 'Listo. La proyeccion queda al dia hasta ' +
                    e.ventana.hasta + ': ' + e.filasEnVentana + ' fila(s). (Entorno de pruebas: ' +
                    'no se escribio en la planilla.)' });
          }, 1200);
        },
        procesarCargasDesdeShell: function () {
          setTimeout(function () {
            exito({ ok: true, mensaje: 'Listo. Se procesaron 3 fila(s) de la hoja de Cargas. ' +
                    '(Entorno de pruebas: no se escribio en la planilla.)' });
          }, 700);
        },
        // -- ABM del Plan de Cuentas: contrato {success}/throw, ver la nota de arriba --
        getAbmFormData: function () {
          setTimeout(function () { exito(JSON.parse(JSON.stringify(ABM_DOMINIOS_DOBLE))); }, 480);
        },
        getCategoryAccounts: function (entidad) {
          setTimeout(function () {
            if (!ABM_FILAS_DOBLE[entidad]) {
              falla(new Error('Error al obtener cuentas: tabla desconocida: ' + entidad));
              return;
            }
            exito(ABM_FILAS_DOBLE[entidad].map(function (f, i) {
              return { rowIndex: i, nombre: f.nombre, moneda: f.moneda,
                       proyecto: f.proyecto, tipo: f.tipo };
            }));
          }, 620);
        },
        saveAbmRecord: function (p) {
          setTimeout(function () {
            var filas = ABM_FILAS_DOBLE[p.entityType];
            if (p.entityType === 'PROYECTOS') {
              falla(new Error('La entidad "Proyectos" ya no se administra desde este ABM.'));
              return;
            }
            if (!filas) { falla(new Error('Entidad desconocida: ' + p.entityType)); return; }
            var nombre = String(p.nombre || '').trim();
            if (nombre === '') { falla(new Error('El nombre es un campo obligatorio.')); return; }
            var repetido = filas.some(function (f) {
              return f.nombre.trim().toLowerCase() === nombre.toLowerCase();
            });
            if (repetido) {
              falla(new Error('No es posible hacer este ajuste: La cuenta "' + nombre +
                              '" ya existe en este modulo.'));
              return;
            }
            filas.push({ nombre: nombre, moneda: p.monedaRelacionada || '',
                         proyecto: p.proyectoRelacionado || '', tipo: '' });
            exito({ success: true, entityType: p.entityType, nombre: nombre });
          }, 800);
        },
        updateAbmRecord: function (p) {
          setTimeout(function () {
            var filas = ABM_FILAS_DOBLE[p.entityType];
            if (!filas) { falla(new Error('Entidad desconocida: ' + p.entityType)); return; }
            var i = parseInt(p.rowIndex, 10);
            if (isNaN(i) || !filas[i]) {
              falla(new Error('Falta el indice de la cuenta a modificar.'));
              return;
            }
            var nombre = String(p.nombre || '').trim();
            var choca = filas.some(function (f, j) {
              return j !== i && f.nombre.trim().toLowerCase() === nombre.toLowerCase();
            });
            if (choca) {
              falla(new Error('El nombre "' + nombre + '" ya existe en este modulo.'));
              return;
            }
            filas[i] = { nombre: nombre, moneda: p.monedaRelacionada || '',
                         proyecto: p.proyectoRelacionado || '', tipo: '' };
            exito({ success: true, nombre: nombre, entityType: p.entityType });
          }, 800);
        },
        deleteAbmRecord: function (p) {
          setTimeout(function () {
            var filas = ABM_FILAS_DOBLE[p.entityType];
            var i = parseInt(p.rowIndex, 10);
            if (!filas || isNaN(i) || !filas[i]) {
              falla(new Error('Falta el indice de la cuenta a eliminar.'));
              return;
            }
            filas.splice(i, 1);
            exito({ success: true, entityType: p.entityType });
          }, 800);
        },
        // -- Proyecciones Elaboradas: contrato "objeto pelado / throw", ver la nota de arriba --
        listarPeriodosProyeccion: function () {
          setTimeout(function () {
            var grupos = {};
            PROY_ORIGENES_DOBLE.forEach(function (origen) {
              var porClave = {};
              PROY_FILAS_DOBLE.forEach(function (f) {
                if (f.origen !== origen) return;
                if (!porClave[f.clave]) porClave[f.clave] = [];
                porClave[f.clave].push(f);
              });
              var claves = Object.keys(porClave).filter(function (c) { return c !== 'sin-fecha'; })
                .sort().reverse();
              if (porClave['sin-fecha']) claves.push('sin-fecha');
              grupos[origen] = claves.map(function (c) {
                var filas = porClave[c];
                var sellos = {};
                filas.forEach(function (f) { if (f.sello) sellos[f.sello] = true; });
                var lista = Object.keys(sellos).sort();
                var totales = proyTotalesDoble(filas);
                return { clave: c, mesLabel: pabmMesLabelDoble(c), nFilas: filas.length,
                         corridas: lista.length,
                         ultimoSello: lista.length ? lista[lista.length - 1] : null,
                         totales: totales, otrasFilas: totales.otrasFilas };
              });
            });
            exito({ grupos: grupos });
          }, 900);
        },
        detalleFilasPeriodoProyeccion: function (clave, origen) {
          setTimeout(function () {
            if (PROY_ORIGENES_DOBLE.indexOf(origen) === -1) {
              falla(new Error('origen invalido: "' + origen + '".'));
              return;
            }
            var filas = proyDelGrupoDoble(clave, origen);
            // Solo 'shell' se edita: el mismo gate que aplica el servidor.
            var editable = (origen === 'shell');
            exito({ clave: clave, origen: origen, mesLabel: pabmMesLabelDoble(clave),
                    editable: editable,
                    motivoNoEditable: editable ? '' : PA_MSJ_NO_EDITABLE_DOBLE[origen],
                    bajaBloqueada: proyBajaBloqueadaDoble(clave, origen),
                    filas: filas.map(function (f) {
                      return { fila: f.fila, cuenta: f.cuenta, tipoCuenta: f.tipoCuenta,
                               tipo: f.tipo, monto: f.monto, moneda: f.moneda, fecha: null,
                               notaLibre: f.notaLibre, editable: editable };
                    }),
                    totales: proyTotalesDoble(filas) });
          }, 620);
        },
        eliminarPeriodoProyeccion: function (clave, origen) {
          setTimeout(function () {
            var bloqueada = proyBajaBloqueadaDoble(clave, origen);
            if (bloqueada) { falla(new Error(bloqueada)); return; }
            var filas = proyDelGrupoDoble(clave, origen);
            if (!filas.length) {
              falla(new Error('No hay ninguna fila de "' + clave + '" (' + origen +
                              ') para borrar: probablemente ya se borro. No se hizo nada.'));
              return;
            }
            PROY_PAPELERA_DOBLE = { clave: clave, origen: origen, filas: filas };
            PROY_FILAS_DOBLE = PROY_FILAS_DOBLE.filter(function (f) {
              return !(f.clave === clave && f.origen === origen);
            });
            // `respaldo` es un TOKEN (el sello), ya no un nombre de hoja: la boveda de
            // respaldos (18_RespaldoService.js) puede resolverlo en propiedades o en la hoja.
            exito({ clave: clave, origen: origen, filasBorradas: filas.length,
                    respaldo: '2026-08-29_120000' });
          }, 1100);
        },
        revertirBajaProyeccionAbm: function () {
          setTimeout(function () {
            if (!PROY_PAPELERA_DOBLE) {
              falla(new Error('No hay ninguna baja de este ABM para revertir.'));
              return;
            }
            PROY_FILAS_DOBLE = PROY_FILAS_DOBLE.concat(PROY_PAPELERA_DOBLE.filas);
            var previo = PROY_PAPELERA_DOBLE;
            PROY_PAPELERA_DOBLE = null;
            exito({ clave: previo.clave, origen: previo.origen,
                    filasRepuestas: previo.filas.length });
          }, 900);
        },
        actualizarMontoFilaProyeccion: function (fila, nuevoMonto) {
          setTimeout(function () {
            var f = null;
            PROY_FILAS_DOBLE.forEach(function (x) { if (String(x.fila) === String(fila)) f = x; });
            if (!f) { falla(new Error('La fila ' + fila + ' esta fuera del rango de datos vivo.')); return; }
            // El gate del SERVIDOR, no el del cliente: aunque la vista mande la edicion de una
            // fila que pinto como no editable, aca se rechaza con el motivo de ese origen.
            if (f.origen !== 'shell') {
              falla(new Error(PA_MSJ_NO_EDITABLE_DOBLE[f.origen] ||
                              PA_MSJ_NO_EDITABLE_DOBLE.otros));
              return;
            }
            var n = Number(nuevoMonto);
            if (String(nuevoMonto).trim() === '' || !isFinite(n)) {
              falla(new Error('El nuevo monto "' + nuevoMonto + '" no es un numero valido.'));
              return;
            }
            PROY_EDICION_DOBLE = { fila: f.fila, montoAnterior: f.monto };
            var anterior = f.monto;
            f.monto = n;
            exito({ fila: f.fila, cuenta: f.cuenta, clave: f.clave, origen: f.origen,
                    moneda: f.moneda, montoAnterior: anterior, montoNuevo: n });
          }, 900);
        },
        revertirEdicionMontoProyeccion: function () {
          setTimeout(function () {
            if (!PROY_EDICION_DOBLE) {
              falla(new Error('No hay ninguna edicion de este ABM para revertir.'));
              return;
            }
            var previo = PROY_EDICION_DOBLE;
            PROY_EDICION_DOBLE = null;
            PROY_FILAS_DOBLE.forEach(function (x) {
              if (x.fila === previo.fila) x.monto = previo.montoAnterior;
            });
            exito({ fila: previo.fila, montoRestaurado: previo.montoAnterior });
          }, 900);
        }
      };
      return api;
    }
    var r = {};
    ['withSuccessHandler','withFailureHandler','obtenerCatalogoShell','registrarMovimientos',
     'registrarTraspasos','registrarProyecciones','obtenerSaldosConciliacion',
     'registrarConciliacion','obtenerRecurrentes','guardarRecurrente','borrarRecurrente',
     'estadoHorizonteRecurrentes','sincronizarRecurrentes',
     'procesarCargasDesdeShell',
     'getAbmFormData','getCategoryAccounts','saveAbmRecord','updateAbmRecord',
     'deleteAbmRecord',
     'listarPeriodosProyeccion','detalleFilasPeriodoProyeccion','eliminarPeriodoProyeccion',
     'revertirBajaProyeccionAbm','actualizarMontoFilaProyeccion',
     'revertirEdicionMontoProyeccion'].forEach(function (m) {
      r[m] = function () { var c = cadena(); return c[m].apply(c, arguments); };
    });
    return r;
  })(),
  host: { close: function () {} }
} };