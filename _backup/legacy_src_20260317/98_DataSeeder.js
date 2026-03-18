/**
 * 98_DataSeeder.js
 * Utilidades para poblar la base de datos con datos de prueba
 * Genera transacciones aleatorias realistas para testing y demos
 * 
 * @version 0.3.0
 * @since 0.3.0
 * @lastModified 2026-01-18
 */

// [AGILE-VALOR] Herramienta robusta de testing y populación de datos controlada.

// ============================================
// UI WRAPPERS
// ============================================

/**
 * Wrapper para ejecutar seed desde menú UI con confirmación
 */
function runDataSeedWithConfirmation() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        'Seed Datos Demo',
        '¿Deseas generar datos de demostración? Esto creará 10 transacciones aleatorias.',
        ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
        try {
            // Las monedas ahora están hardcodeadas, ya no hay seed de monedas
            // Verificar si hay cuentas y medios, si no, ejecutar seed completo
            try {
                const medios = getAllMediosPago();
                const cuentas = getAllCuentas();
                if (medios.length === 0 || cuentas.length === 0) {
                    ui.alert('No se detectaron catálogos. Ejecutando inicialización completa...');
                    seedCompleto();
                }
            } catch (e) {
                ui.alert('Catálogos no inicializados. Ejecutando inicialización completa...');
                seedCompleto();
            }

            const result = seedTransacciones(10);
            ui.alert(`✅ Datos de demostración creados exitosamente.\n\nCreadas: ${result.creadas}\nErrores: ${result.errores}`);
        } catch (error) {
            ui.alert('❌ Error: ' + error.message);
        }
    }
}

// ============================================
// FUNCIONES HELPER - GENERACIÓN ALEATORIA
// ============================================

/**
 * Genera sentido aleatorio (70% Egreso, 30% Ingreso)
 * @returns {string} 'Ingreso' o 'Egreso'
 */
function randomSentido() {
    return Math.random() < 0.7 ? 'Egreso' : 'Ingreso';
}

/**
 * Genera una fecha aleatoria dentro del mes actual
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function randomDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11
    const currentDay = now.getDate();

    // Generar día aleatorio entre 1 y el día actual
    const randomDay = Math.floor(Math.random() * currentDay) + 1;

    // Crear fecha en el mes actual
    const date = new Date(year, month, randomDay);

    return formatDate(date, 'yyyy-MM-dd');
}

/**
 * Selecciona una cuenta aleatoria coherente con el sentido
 * @param {Array<Object>} cuentas Lista de cuentas disponibles
 * @param {string} sentido 'Ingreso' o 'Egreso'
 * @returns {string} cuenta_id
 */
function randomCuenta(cuentas, sentido) {
    const filtered = cuentas.filter(c => {
        if (sentido === 'Ingreso') {
            return c.macro_tipo === 'Ingreso';
        } else {
            // Egresos: cualquier macro_tipo que no sea Ingreso
            return c.macro_tipo !== 'Ingreso';
        }
    });

    if (filtered.length === 0) {
        throw new Error(`No hay cuentas disponibles para sentido: ${sentido}`);
    }

    return filtered[Math.floor(Math.random() * filtered.length)].cuenta_id;
}

/**
 * Selecciona un medio de pago aleatorio
 * @param {Array<Object>} medios Lista de medios disponibles
 * @returns {string} medio_id
 */
function randomMedio(medios) {
    return medios[Math.floor(Math.random() * medios.length)].medio_id;
}

/**
 * Genera un monto realista según el sentido
 * @param {string} sentido 'Ingreso' o 'Egreso'
 * @returns {number} Monto
 */
function randomMonto(sentido) {
    if (sentido === 'Egreso') {
        // Egresos: 500 - 50,000 ARS
        return Math.floor(Math.random() * 49500) + 500;
    } else {
        // Ingresos: 50,000 - 500,000 ARS
        return Math.floor(Math.random() * 450000) + 50000;
    }
}

/**
 * Genera una descripción aleatoria coherente con el sentido
 * @param {string} sentido 'Ingreso' o 'Egreso'
 * @returns {string} Descripción
 */
function randomDescripcion(sentido) {
    const egresosDesc = [
        'Supermercado Carrefour',
        'Almacén del barrio',
        'Verdulería',
        'Uber',
        'Taxi',
        'Nafta YPF',
        'Estacionamiento',
        'Restaurante',
        'Café',
        'Netflix',
        'Spotify',
        'Gimnasio',
        'Farmacia',
        'Ropa H&M',
        'Zapatillas Nike',
        'Librería',
        'Cine',
        'Peluquería'
    ];

    const ingresosDesc = [
        'Sueldo mes',
        'Aguinaldo',
        'Pago freelance proyecto web',
        'Consultoría IT',
        'Venta producto usado',
        'Bono performance',
        'Comisión ventas',
        'Pago clases particulares',
        'Ingreso extra'
    ];

    const list = sentido === 'Egreso' ? egresosDesc : ingresosDesc;
    return list[Math.floor(Math.random() * list.length)];
}

/**
 * Selecciona una moneda aleatoria (80% base, 20% otras)
 * @param {Array<Object>} monedas Lista de monedas disponibles
 * @param {string} baseMonedaId ID de la moneda base
 * @returns {string} moneda_id
 */
function randomMoneda(monedas, baseMonedaId) {
    if (Math.random() < 0.8) {
        return baseMonedaId;
    }
    return monedas[Math.floor(Math.random() * monedas.length)].id; // Usar .id en lugar de .moneda_id
}

/**
 * Genera un boolean aleatorio con probabilidad configurable
 * @param {number} probability Probabilidad de true (0-1, default: 0.5)
 * @returns {boolean}
 */
function randomBoolean(probability = 0.5) {
    return Math.random() < probability;
}

// ============================================
// SEED COMPLETO DE CATÁLOGOS
// ============================================

/**
 * Ejecuta setup completo del sistema (catálogos básicos)
 * Inicializa: Monedas, Config, Medios de Pago, Cuentas
 */
function seedCompleto() {
    logInfo('='.repeat(60));
    logInfo('INICIANDO SEED COMPLETO DEL SISTEMA');
    logInfo('='.repeat(60));

    try {
        // 1. Setup básico (Monedas + Config)
        logInfo('\n[1/4] Setup básico (Monedas + Config)...');
        setupCompleto();

        // 2. Medios de pago
        logInfo('\n[2/4] Inicializando medios de pago...');
        initializeMediosPagoBasicos();

        // 3. Cuentas
        logInfo('\n[3/4] Inicializando cuentas...');
        initializeCuentasBasicas();

        // 4. Tipos de cambio (opcional - puede tardar)
        logInfo('\n[4/4] Tipos de cambio...');
        const incluirAPI = false; // Cambiar a true si quieres fetch de API
        if (incluirAPI) {
            logInfo('Fetching tipos de cambio desde API...');
            fetchExchangeRatesFromAPI('USD', 'oficial');
        } else {
            logInfo('Saltando fetch de API. Crear TCs manualmente si es necesario.');
        }

        logInfo('\n' + '='.repeat(60));
        logSuccess('✅ SEED COMPLETO FINALIZADO EXITOSAMENTE');
        logInfo('='.repeat(60));

        // Resumen
        const medios = getAllMediosPago();
        const cuentas = getAllCuentas();

        logInfo('\n📊 RESUMEN:');
        logInfo(`   - Monedas: 5 (hardcodeadas: ${AVAILABLE_CURRENCY_IDS.join(', ')})`);
        logInfo(`   - Medios de Pago: ${medios.length}`);
        logInfo(`   - Cuentas: ${cuentas.length}`);
        logInfo(`   - Moneda Base: ${BASE_CURRENCY}`);

        showToast('Sistema inicializado correctamente', 'Seed Completo', 10);

    } catch (e) {
        logError('Error en seed completo', { error: e.toString() });
        showAlert(`Error en seed: ${e.message}`, 'Error');
        throw e;
    }
}

// ============================================
// TRANSACCIONES
// ============================================

/**
 * Genera N transacciones aleatorias
 * @param {number} cantidad Cantidad de transacciones (default: 100)
 * @param {number} diasAtras Rango de fechas (default: 90 días)
 */
function seedTransacciones(cantidad = 100, diasAtras = 90) {
    logInfo('='.repeat(60));
    logInfo(`GENERANDO ${cantidad} TRANSACCIONES ALEATORIAS`);
    logInfo('='.repeat(60));

    try {
        // Verificar pre-requisitos
        checkPrerequisites();

        // Obtener catálogos
        const monedas = Object.values(CURRENCIES); // Usar monedas hardcodeadas
        const medios = getAllMediosPago();
        const cuentas = getAllCuentas();

        logInfo(`\n📊 Catálogos cargados:`);
        logInfo(`   - Monedas: ${monedas.length} (hardcodeadas)`);
        logInfo(`   - Medios: ${medios.length}`);
        logInfo(`   - Cuentas: ${cuentas.length}`);
        logInfo(`   - Base: ${BASE_CURRENCY}\n`);

        let creadas = 0;
        let errores = 0;

        for (let i = 0; i < cantidad; i++) {
            try {
                const sentido = randomSentido();

                const trx = {
                    fecha: randomDate(diasAtras),
                    sentido: sentido,
                    cuenta_id: randomCuenta(cuentas, sentido),
                    medio_id: randomMedio(medios),
                    monto: randomMonto(sentido),
                    moneda_id: randomMoneda(monedas, BASE_CURRENCY),
                    nota: randomDescripcion(sentido)
                };

               // Si moneda != base, obtener fx_id
                if (trx.moneda_id !== BASE_CURRENCY) {
                    const fx = getLatestRate(BASE_CURRENCY, trx.moneda_id, 'oficial');
                    if (!fx) {
                        logError(`No hay TC para ${BASE_CURRENCY}/${trx.moneda_id}, saltando`);
                        errores++;
                        continue;
                    }
                    trx.fx_id = fx.fx_id;
                }

                // Crear transacción
                createTransaccion(trx);
                creadas++;

                // Log cada 25 transacciones
                if (creadas % 25 === 0) {
                    logInfo(`   ✓ ${creadas} transacciones creadas...`);
                }

            } catch (e) {
                logError(`Error creando transacción ${i + 1}`, { error: e.toString() });
                errores++;
            }
        }

        logInfo('\n' + '='.repeat(60));
        logSuccess(`✅ SEED TRANSACCIONES COMPLETO`);
        logInfo(`   Creadas: ${creadas}`);
        logInfo(`   Errores: ${errores}`);
        logInfo('='.repeat(60));

        showToast(`${creadas} transacciones generadas`, 'Seed Completo', 8);

        return { creadas, errores };

    } catch (e) {
        logError('Error en seedTransacciones', { error: e.toString() });
        showAlert(`Error: ${e.message}`, 'Error Seed');
        throw e;
    }
}

/**
 * Limpia todas las transacciones
 */
function clearAllTransacciones() {
    logInfo('Limpiando todas las transacciones...');

    try {
        clearAllTransacciones();
        logSuccess('Transacciones eliminadas');
        showToast('Transacciones borradas', 'Clear OK', 5);
    } catch (e) {
        logError('Error limpiando transacciones', { error: e.toString() });
        showAlert(`Error: ${e.message}`, 'Error');
        throw e;
    }
}

// ============================================
// UTILIDADES DE VERIFICACIÓN
// ============================================

/**
 * Verifica que todos los catálogos estén inicializados
 * @returns {boolean} true si todo está OK
 */
function checkPrerequisites() {
    const errors = [];

    try {
        // Monedas ahora están hardcodeadas, siempre hay 5
        const monedas = Object.values(CURRENCIES);
        if (monedas.length === 0) {
            errors.push('No hay monedas hardcodeadas en CURRENCIES');
        }
    } catch (e) {
        errors.push('Error accediendo monedas hardcodeadas: ' + e.message);
    }

    try {
        const medios = getAllMediosPago();
        if (medios.length === 0) {
            errors.push('No hay medios de pago. Ejecutar initializeMediosPagoBasicos()');
        }
    } catch (e) {
        errors.push('Error leyendo medios: ' + e.message);
    }

    try {
        const cuentas = getAllCuentas();
        if (cuentas.length === 0) {
            errors.push('No hay cuentas. Ejecutar initializeCuentasBasicas()');
        }
    } catch (e) {
        errors.push('Error leyendo cuentas: ' + e.message);
    }

    if (errors.length > 0) {
        const errorMsg = 'Pre-requisitos no cumplidos:\n- ' + errors.join('\n- ');
        logError('checkPrerequisites falló', { errors });
        throw new Error(errorMsg);
    }

    return true;
}
