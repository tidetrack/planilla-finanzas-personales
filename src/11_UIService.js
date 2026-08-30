/**
 * 11_UIService.js
 * Servicio para gestión de interfaces de usuario (HTML Service)
 * 
 * @version 0.63.0
 * @since 0.4.0
 * @lastModified 2026-08-29
 */

// [AGILE-VALOR] Punto de entrada para la UI de los módulos validados.

/**
 * Incluye el contenido de un archivo HTML dentro de otro (para CSS/JS parciales)
 * Uso: <?!= include('FileName'); ?>
 */
function include(filename) {
 return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// PLAN DE CUENTAS - ABM API
// ============================================

/**
 * ALIAS DE COMPATIBILIDAD hacia la vista 'cuentas' del shell.
 *
 * decision Franco 2026-08-29: la botonera de dibujos publicada en la planilla referencia esta
 * funcion POR NOMBRE y no es editable ni auditable desde el repo (los drawings con script
 * asignado no son accesibles ni por Sheets API ni por Apps Script). Un dibujo apuntando a una
 * funcion inexistente falla en silencio o con un error criptico, asi que el nombre se conserva
 * aunque el modal que abria (UI_AbmPlanCuentas, 520x750) ya no se use. Borrar recien despues
 * de reasignar los dibujos en la planilla viva a abrirPlanCuentas.
 *
 * @see 16_ShellService.js (abrirPlanCuentas -> vista 'cuentas')
 */
function showAbmPlanCuentas() { abrirPlanCuentas(); }

/**
 * Obtiene los dominios para poblar los Selects del Pop-Up ABM.
 *
 * Son TRES dominios distintos y cada uno tiene su fuente:
 *   - monedas          -> MONEDAS_DISPONIBLES, constante de backend (ADR-003)
 *   - categoriasCuenta -> la columna P del Plan, que es el catalogo de categorias de cuenta
 *   - tiposMedio       -> TIPOS_MEDIO, constante de backend
 *
 * decision Franco 2026-08-20: antes habia UN solo desplegable ("proyectos") que se leia de la
 * tabla PROYECTOS y alimentaba dos campos con semanticas distintas: la Categoria de una cuenta
 * (correcto) y el Tipo de un medio (incorrecto). Como la tabla PROYECTOS apunta a la misma
 * columna P que el catalogo de categorias, el ABM del menu diario permitia dejar un medio con
 * tipo "Alimentacion y social". Son dos ejes independientes y ahora tienen dos dominios.
 */
function getAbmFormData() {
 try {
 // Monedas: servidas desde constante de backend (ADR-003)
 const monedas = MONEDAS_DISPONIBLES;

 // Categorias de cuenta: leidas de su propia tabla, no de la legacy PROYECTOS.
 let dataCategorias = [];
 try { dataCategorias = getTableData('CATEGORIAS_CUENTA'); } catch(e) {}
 const categoriasCuenta = dataCategorias.map(row => row[0]).filter(x => x);

 return {
 monedas: monedas,
 categoriasCuenta: categoriasCuenta,
 tiposMedio: TIPOS_MEDIO
 };
 } catch (e) {
 Logger.log('Error getAbmFormData: ' + e.toString());
 return { monedas: MONEDAS_DISPONIBLES, categoriasCuenta: [], tiposMedio: TIPOS_MEDIO };
 }
}

/**
 * Recibe un payload desde el UI y lo anexa al carril/tabla correspondiente 
 * @param {Object} payload 
 */
function saveAbmRecord(payload) {
 try {
 if (!payload.nombre || payload.nombre.trim() === '') {
 throw new Error('El nombre es un campo obligatorio.');
 }

 const entity = payload.entityType;

 // Validar que no exista un registro con el mismo nombre en esta entidad
 let existingData = [];
 try { existingData = getTableData(entity); } catch(e) {}
 
 const existingNames = existingData.map(row => (row[0] || '').toString().trim().toLowerCase());
 if (existingNames.includes(payload.nombre.trim().toLowerCase())) {
 throw new Error(`No es posible hacer este ajuste: La cuenta "${payload.nombre}" ya existe en este módulo.`);
 }

 let rowData = [];
 
        switch(entity) {
            case 'INGRESOS':
            case 'GASTOS_FIJOS':
            case 'GASTOS_VARIABLES':
                rowData = [
                    payload.nombre.trim(), 
                    payload.proyectoRelacionado || ''
                ];
                break;
            
            case 'MEDIOS_PAGO':
                rowData = [
                    payload.nombre.trim(), 
                    payload.monedaRelacionada || '', 
                    payload.proyectoRelacionado || ''
                ];
                break;
            
            // "PROYECTOS" se retiro del ABM el 2026-08-20 y aca se RECHAZA explicitamente en vez
            // de simplemente no estar: RANGES.PROYECTOS sigue apuntando a P:Q, que desde el
            // rediseno es el catalogo de CATEGORIAS DE CUENTA. Un alta escribia el nombre al
            // final de ese catalogo y el tipo suelto en una columna que ya no pertenece a
            // ninguna tabla; una baja borraba una categoria de cuenta. Sin este case, un cliente
            // viejo con la entidad cacheada caeria en el default -- que tambien lanza -- pero el
            // mensaje no diria por que. Que lo diga.
            case 'PROYECTOS':
                throw new Error('La entidad "Proyectos" ya no se administra desde este ABM: esa ' +
                    'tabla es hoy el catalogo de Categorias de Cuenta. Usar tidetrack Dev > ' +
                    'Categorizar cuentas.');
            
            default:
                throw new Error('Entidad desconocida: ' + entity);
        }

 appendRow(entity, rowData);
 
 return {
 success: true,
 entityType: entity,
 nombre: payload.nombre
 };
 
 } catch (e) {
 Logger.log('Error saveAbmRecord: ' + e.toString());
 throw new Error(e.message);
 }
}

/**
 * Obtiene todas las cuentas de una categoría específica para el selector de "Modificar"
 */
function getCategoryAccounts(entityType) {
 try {
 const data = getTableData(entityType);
 const result = [];
 
 data.forEach((row, index) => {
            const nombre = row[0] ? row[0].toString().trim() : '';
            if (nombre) {
                let moneda = '';
                let proyecto = '';
                let tipo = '';
                
                if (entityType === 'MEDIOS_PAGO') {
                    moneda = row[1] || '';
                    proyecto = row[2] || '';
                } else if (entityType === 'PROYECTOS') {
                    tipo = row[1] || '';
                } else {
                    // INGRESOS, GASTOS_FIJOS, GASTOS_VARIABLES
                    proyecto = row[1] || '';
                }

                result.push({
                    rowIndex: index,
                    nombre: nombre,
                    moneda: moneda,
                    proyecto: proyecto,
                    tipo: tipo
                });
            }
        });
 
 return result;
 } catch (e) {
 throw new Error('Error al obtener cuentas: ' + e.message);
 }
}

/**
 * Actualiza un registro ABM existente de forma segura
 */
function updateAbmRecord(payload) {
 try {
 if (!payload.rowIndex && payload.rowIndex !== "0" && payload.rowIndex !== 0) {
 throw new Error('Falta el índice de la cuenta a modificar.');
 }
 
 if (!payload.nombre || payload.nombre.trim() === '') {
 throw new Error('El nombre es un campo obligatorio.');
 }

 const entity = payload.entityType;
 const rowIndexA = parseInt(payload.rowIndex);
 const proposedName = payload.nombre.trim().toLowerCase();
 
 // Validación de duplicados (excluye al registro actual)
 const existingData = getTableData(entity);
 existingData.forEach((row, idx) => {
 if (idx !== rowIndexA) {
 const rowName = (row[0] || '').toString().trim().toLowerCase();
 if (rowName === proposedName && rowName !== '') {
 throw new Error(`El nombre "${payload.nombre}" ya existe en este módulo.`);
 }
 }
 });
 
        let rowData = [];
        switch(entity) {
            case 'INGRESOS': 
            case 'GASTOS_FIJOS': 
            case 'GASTOS_VARIABLES': 
                rowData = [payload.nombre.trim(), payload.proyectoRelacionado || ''];
                break;
            case 'MEDIOS_PAGO':
                rowData = [payload.nombre.trim(), payload.monedaRelacionada || '', payload.proyectoRelacionado || ''];
                break;
            // "PROYECTOS" se retiro del ABM el 2026-08-20 y aca se RECHAZA explicitamente en vez
            // de simplemente no estar: RANGES.PROYECTOS sigue apuntando a P:Q, que desde el
            // rediseno es el catalogo de CATEGORIAS DE CUENTA. Un alta escribia el nombre al
            // final de ese catalogo y el tipo suelto en una columna que ya no pertenece a
            // ninguna tabla; una baja borraba una categoria de cuenta. Sin este case, un cliente
            // viejo con la entidad cacheada caeria en el default -- que tambien lanza -- pero el
            // mensaje no diria por que. Que lo diga.
            case 'PROYECTOS':
                throw new Error('La entidad "Proyectos" ya no se administra desde este ABM: esa ' +
                    'tabla es hoy el catalogo de Categorias de Cuenta. Usar tidetrack Dev > ' +
                    'Categorizar cuentas.');
            default: 
                throw new Error('Entidad desconocida: ' + entity);
        }
 
 updateRow(entity, rowIndexA, rowData);
 return { success: true, nombre: payload.nombre, entityType: entity };
 } catch (e) {
 throw new Error(e.message);
 }
}

/**
 * Elimina un registro ABM existente
 */
function deleteAbmRecord(payload) {
 try {
 if (!payload.rowIndex && payload.rowIndex !== "0" && payload.rowIndex !== 0) {
 throw new Error('Falta el índice de la cuenta a eliminar.');
 }
 deleteRow(payload.entityType, parseInt(payload.rowIndex));
 return { success: true, entityType: payload.entityType };
 } catch (e) {
 throw new Error(e.message);
 }
}

// ============================================
// PROYECCIONES ELABORADAS - ABM API
// ============================================
//
// decision Franco 2026-08-25: los endpoints de DATOS de este ABM (listar, ver detalle,
// corregir un monto, borrar un periodo, revertir) NO tienen wrapper aca. En Apps Script
// CUALQUIER funcion global es invocable por google.script.run exista o no un wrapper en este
// archivo -- un wrapper pass-through no reduce la superficie expuesta ni un poco, solo daria la
// sensacion de reducirla, que es peor que nada. Esas seis funciones ya viven como globales en
// DEVTOOL_ProyeccionAbm.js (listarPeriodosProyeccion, detalleFilasPeriodoProyeccion,
// eliminarPeriodoProyeccion, revertirBajaProyeccionAbm, actualizarMontoFilaProyeccion,
// revertirEdicionMontoProyeccion) y su consumidor las llama DIRECTO. Lo unico que si vale la
// pena aca es la DESCUBRIBILIDAD -- que quien audite este catalogo sepa donde mirar -- y eso
// es este comentario, no seis funciones que solo reenvian argumentos.
//
// decision Franco 2026-08-29: el consumidor de esas seis funciones es AHORA src/UI_Shell.html
// (vista 'proyecciones', prefijo pabm*), no UI_AbmProyeccionElaborada.html: ese modal fue
// absorbido por el shell en v0.63.0. El contrato del servidor no cambio ni una linea.
// @see DEVTOOL_ProyeccionAbm.js @see UI_Shell.html (vista 'proyecciones')

/**
 * ALIAS DE COMPATIBILIDAD hacia la vista 'proyecciones' del shell.
 *
 * decision Franco 2026-08-29: misma razon que showAbmPlanCuentas -- la botonera de dibujos
 * publicada en la planilla referencia esta funcion POR NOMBRE y no es editable ni auditable
 * desde el repo (los drawings con script asignado no son accesibles ni por Sheets API ni por
 * Apps Script), y un dibujo apuntando a una funcion inexistente falla en silencio o con un
 * error criptico. El modal que abria (UI_AbmProyeccionElaborada, 720x680) fue absorbido por
 * la vista 'proyecciones' del shell (v0.63.0). Borrar recien despues de reasignar los dibujos
 * en la planilla viva a abrirProyeccionesElaboradas.
 *
 * @see 16_ShellService.js (abrirProyeccionesElaboradas -> vista 'proyecciones')
 */
function showAbmProyeccionElaborada() { abrirProyeccionesElaboradas(); }
