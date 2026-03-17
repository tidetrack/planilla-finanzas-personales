/**
 * Inicializa monedas básicas (ARS, USD, EUR)
 * Inserción usando createMoneda con auto-IDs
 */
function initializeMonedasDirect() {
    const sheet = getSheet();

    // Verificar primero si B4 ya tiene datos REALES
    const checkCell = sheet.getRange('B4').getValue();
    if (checkCell && checkCell.toString().trim() !== '') {
        logInfo(`DB_MONEDAS ya tiene datos (B4="${checkCell}"), saltando inicialización`);
        showToast('Monedas ya existen', 'Info', 3);
        return;
    }

    // Crear monedas usando el servicio (con auto-IDs)
    createMoneda('Peso argentino', '$');              // MON-001
    createMoneda('Dólar estadounidense', 'US$');      // MON-002
    createMoneda('Euro', '€');                        // MON-003

    logSuccess('Monedas básicas inicializadas: MON-001, MON-002, MON-003');
    showToast('3 monedas inicializadas correctamente', 'Setup Completo', 5);
}

/**
 * Inicializa configuración DIRECTA en AO4:AQ4
 */
function initializeConfigDirect() {
    const sheet = getSheet();

    // Verificar si AO4 ya tiene datos REALES  
    const checkCell = sheet.getRange('AO4').getValue();
    if (checkCell && checkCell.toString().trim() !== '' && checkCell.toString().startsWith('CFG')) {
        logInfo(`DB_CONFIG ya tiene datos (AO4="${checkCell}"), saltando inicialización`);
        showToast('Config ya existe', 'Info', 3);
        return;
    }

    // Verificar que exista al menos una moneda (debe ejecutarse después de monedas)
    const monedaCheck = sheet.getRange('B4').getValue();
    if (!monedaCheck || monedaCheck.toString().trim() === '') {
        throw new Error('No hay monedas. Ejecutar initializeMonedasDirect() primero.');
    }

    // Obtener el ID de la primera moneda para usarla como base
    const primeraMoneda = monedaCheck.toString();

    // Datos: config_id auto-generado, base_moneda=primera moneda, fuente=oficial
    const configData = [[generateNextId('CONFIG', 'CFG', 3), primeraMoneda, 'oficial']];

    // Insertar en AO4:AQ4
    const targetRange = sheet.getRange('AO4:AQ4');
    targetRange.setValues(configData);

    logSuccess(`Config inicializada: base=${primeraMoneda}, fuente=oficial`);
    showToast('Configuración inicializada correctamente', 'Setup Completo', 5);
}

/**
 * Setup completo del sistema en un solo comando
 * Ejecuta monedas + config en orden
 * 
 * NOTA: CONFIG ya no se inicializa (hardcodeado en 00_Config.js)
 * MONEDAS ya no se usa (hardcodeado en CURRENCIES)
 */
function setupCompleto() {
    logInfo('='.repeat(50));
    logInfo('Iniciando setup completo del sistema');
    logInfo('='.repeat(50));

    // Paso 1: Monedas - YA NO SE USA (hardcodeadas en CURRENCIES)
    logInfo('Paso 1/2: Monedas hardcodeadas en CURRENCIES, saltando...');

    // Paso 2: Config - YA NO SE USA (hardcodeado en getConfig())
    logInfo('Paso 2/2: Config hardcodeada en getConfig(), saltando...');

    logInfo('='.repeat(50));
    logSuccess('✅ Setup completo finalizado (sin inicialización de BD)');
    logInfo('='.repeat(50));

    showToast('Sistema listo (monedas y config hardcodeadas)', 'Setup Completo', 8);
}
