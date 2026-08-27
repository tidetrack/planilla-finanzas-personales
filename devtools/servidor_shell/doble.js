/* ENTORNO DE PRUEBAS -- no hay servidor.
   Se reemplaza google.script.run por un doble que devuelve el catalogo REAL de la planilla
   (sacado del gemelo digital) con la latencia medida en vivo: 537 ms para el catalogo. Asi lo
   que se prueba es la interfaz de verdad, con los tiempos de verdad, y no una maqueta. */
/* filasGrilla y categorias vienen de obtenerCatalogoShell y faltaban aca. filasGrilla no se
   notaba porque el shell tiene fallback duro a 15 y RANGES.CARGAS.filas hoy vale 15: la
   cuenta de tandas coincidia por casualidad, no porque el dato viajara. categorias todavia
   no la lee ninguna vista, pero el doble es el contrato del backend y la vista que la use
   manana no tiene que descubrir en local que llega undefined.
   version es un dato que el shell NO lee -- el pie lo resuelve el regenerador desde
   01_Version.js. Se actualiza igual para que el catalogo no mienta si alguien lo inspecciona. */
var CATALOGO_REAL = {"ingresos": ["Tidetrack", "Umoh", "Ingresos Extra", "Intereses bancos", "Ingreso Asesor", "Plata Prestada", "Sueldo", "FF", "Ingreso Viejo", "Inversiones", "Rendimientos", "Ajuste"], "fijos": ["Auto", "Gatos", "Linea telefónica", "MONOTRIBUTO", "Nafta", "Pago tarjeta", "Prepaga Salud", "SportClub", "Prestamo Galicia", "Deuda Eze", "Deuda Viejo", "Deuda Dima", "Prestamo Viejo", "Subscripciones", "Seguro Compu", "Seguro Celu", "Pago Tarjeta MP"], "variables": ["Comidas", "Computación", "Corte Pelo", "Entretenimiento", "Estacionamiento", "Facultad", "Imprevistos", "Juntadas", "Medicamentos / Higiene", "Regalos", "Reparaciones Auto", "Ropa", "Trabajo", "Viajes", "Salidas", "Compra USD", "Entrenamiento", "Impuestos", "Otros"], "medios": [{"nombre": "Dolar Cash", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar Galicia", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar Mercado Pago", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar NaranjaX", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Dolar Patagonia", "moneda": "USD", "tipo": "Ahorros"}, {"nombre": "Efectivo", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Frasco Transitorio NaranjaX", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Frascos Naranja X", "moneda": "ARS", "tipo": "Ahorros"}, {"nombre": "Frascos Nx - Préstamo", "moneda": "ARS", "tipo": "Financiación"}, {"nombre": "Galicia", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Mercado Pago", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "NaranjaX", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Patagonia", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "Ualá", "moneda": "ARS", "tipo": "Hogar"}, {"nombre": "YPF", "moneda": "ARS", "tipo": "Hogar"}], "monedas": ["ARS", "USD", "AUD", "EUR"], "comodines": ["Traspaso", "Inicio Mes"], "libres": 15, "filasGrilla": 15, "categorias": ["Alimentacion y social", "Bienestar", "Conciliacion", "Cuidado personal", "Deuda y financiacion", "Equipamiento", "Formacion", "Impuestos", "Ingresos extraordinarios", "Mascotas", "Negocios propios", "Ocio y regalos", "Otros", "Prestamos recibidos", "Rendimientos financieros", "Salud", "Servicios y suscripciones", "Sueldo", "Trabajo y negocio", "Vehiculo", "Viajes", "Seguros"], "ok": true, "planilla": "PLANILLA FINANZAS_v4 .WIP | Personal", "version": "0.55.1"};
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
        // carga MULTIPLE de traspasos (v0.53.0) y llama registrarTraspasos; el singular
        // registrarTraspaso sigue existiendo en 16_ShellService.js como una linea que delega
        // en el plural, pero ya nadie lo invoca desde la interfaz, asi que no se dobla: un
        // stub que nadie llama solo sirve para que la proxima auditoria lo confunda con
        // cobertura -- que es exactamente lo que paso aca.
        registrarTraspasos: function (lista) {
          setTimeout(function () {
            exito({ ok: true, mensaje: 'Listo. Registraste ' + lista.length + ' traspaso(s). ' +
                    '(Entorno de pruebas: no se escribio en la planilla.)' });
          }, 900);
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
     'registrarTraspasos','procesarCargasDesdeShell','abrirAbmDesdeShell'].forEach(function (m) {
      r[m] = function () { var c = cadena(); return c[m].apply(c, arguments); };
    });
    return r;
  })(),
  host: { close: function () {} }
} };