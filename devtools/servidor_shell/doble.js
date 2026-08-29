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
var RECURRENTES_DOBLE = [
  { nombre: 'Netflix', cuenta: 'Subscripciones', monto: 13999, moneda: 'ARS',
    medio: 'NaranjaX', dia: 5, nota: '', activo: true },
  { nombre: 'SportClub', cuenta: 'SportClub', monto: 42000, moneda: 'ARS',
    medio: 'Galicia', dia: 1, nota: 'debito automatico', activo: true },
  { nombre: 'iCloud', cuenta: 'Subscripciones', monto: 2.99, moneda: 'USD',
    medio: 'Dolar Galicia', dia: 28, nota: '', activo: false }
];
var MESES_DOBLE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
  'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
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
                        activo: d.activo === 'Si' };
            var mensaje;
            if (indice === -1) {
              RECURRENTES_DOBLE.push(reg);
              mensaje = 'Listo. Guardaste "' + reg.nombre + '".';
            } else {
              RECURRENTES_DOBLE[indice] = reg;
              mensaje = 'Listo. Actualizaste "' + reg.nombre + '".';
            }
            if (d.activo === 'No') mensaje += ' Quedo pausado: no entra en los proximos volcados.';
            exito({ ok: true, mensaje: mensaje + ' (Entorno de pruebas.)' });
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
              exito({ ok: true, mensaje: 'Listo. Se borro "' + nombre + '". Lo ya volcado a la ' +
                      'proyeccion no se toca. (Entorno de pruebas.)' });
            }
          }, 700);
        },
        estadoVolcadoRecurrentes: function (d) {
          setTimeout(function () {
            var activos = RECURRENTES_DOBLE.filter(function (r) { return r.activo; });
            var total = {};
            activos.forEach(function (r) { total[r.moneda] = (total[r.moneda] || 0) + r.monto; });
            exito({ ok: true,
                    periodo: MESES_DOBLE[d.mes - 1] + ' ' + d.anio,
                    activos: activos.length,
                    totalPorMoneda: total,
                    previasPropias: 0,
                    otrasDelMes: { base: 12, manual: 1 } });
          }, 600);
        },
        volcarRecurrentesAlMes: function (d) {
          setTimeout(function () {
            var activos = RECURRENTES_DOBLE.filter(function (r) { return r.activo; });
            exito({ ok: true, mensaje: 'Listo. Se volcaron ' + activos.length + ' recurrente(s) a ' +
                    MESES_DOBLE[d.mes - 1] + ' ' + d.anio + '. (Entorno de pruebas: no se ' +
                    'escribio en la planilla.)' });
          }, 1200);
        },
        procesarCargasDesdeShell: function () {
          setTimeout(function () { exito({ ok: true }); }, 700);
        },
        abrirAbmDesdeShell: function () {
          setTimeout(function () {
            exito();
            document.getElementById('shellLoader').classList.add('hidden');
            document.getElementById('shellAviso').innerHTML =
              '<div class="alert alert-ok">En la planilla real, esto reemplaza el modal por el ' +
              'ABM del Plan de Cuentas. Aca no, para que puedas seguir comentando.</div>';
          }, 400);
        }
      };
      return api;
    }
    var r = {};
    ['withSuccessHandler','withFailureHandler','obtenerCatalogoShell','registrarMovimientos',
     'registrarTraspasos','registrarProyecciones','obtenerSaldosConciliacion',
     'registrarConciliacion','obtenerRecurrentes','guardarRecurrente','borrarRecurrente',
     'estadoVolcadoRecurrentes','volcarRecurrentesAlMes',
     'procesarCargasDesdeShell','abrirAbmDesdeShell'].forEach(function (m) {
      r[m] = function () { var c = cadena(); return c[m].apply(c, arguments); };
    });
    return r;
  })(),
  host: { close: function () {} }
} };