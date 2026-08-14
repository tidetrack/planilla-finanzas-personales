/**
 * ============================================
 * REGISTRO DE ACTUALIZACIONES (CHANGELOG)
 * ============================================
 * Historial descendente de cambios sincronizados al entorno Apps Script.
 * (Añadir nuevos registros arriba)
 *
 * [2026-08-13] v0.10.0 - Migracion historica desde la planilla v03.1:
 * - CONTEXTO: mientras el pipeline estuvo roto (2026-03-29 a 2026-08-13) Franco siguio
 *   cargando sus finanzas en la planilla vieja "PLANILLA FINANZAS_v03.1 | Fran". El ledger
 *   nuevo quedo con un agujero: abril 2026 (106 movimientos), mayo (110), junio (112) y
 *   julio/agosto completos. Casi cinco meses de historia fuera de la planilla.
 * - NUEVO MIGRACION_v031_Historico.js: trio estado/aplicar/revertir. Lee la planilla vieja EN
 *   VIVO con openById (re-ejecutable: si Franco sigue cargando alla, se vuelve a correr y trae
 *   solo lo nuevo). El delta NO se define por rango de fechas sino por AUSENCIA en el destino,
 *   cruzando fecha + monto + sentido con el medio como desempate: de 3.635 filas del origen,
 *   2.896 ya estaban y 632 faltaban. Migrar "toda la BD" habria duplicado ~2.880 movimientos.
 * - Transformacion: monto partido en dos columnas -> Monto + Tipo; Tipo de Cuenta se DEDUCE
 *   contra el Plan de Cuentas (no se copia); moneda inferida del medio; TC congelados tomados
 *   de la hoja Tipos de cambio por fecha; alias de medios unificados (MP -> Mercado Pago y
 *   tres mas, decision Franco).
 * - GUARD DE COBERTURA DE TC (el bloqueante mas caro de la ronda): el Data Lake llega hasta
 *   2026-03-20 (ARS) y 2026-03-29 (USD/AUD/EUR), y 540 de 541 filas del lote son posteriores.
 *   Sin guard, TODAS congelaban una cotizacion de fallback y julio/agosto quedaban valuados a
 *   la de junio. La cotizacion congelada es el unico dato del ledger que despues no se puede
 *   recalcular. Ahora el preflight compara max(fecha del lote) contra max(fecha de cada serie)
 *   y ABORTA indicando correr "Forzar carga historica" primero.
 * - Dos buckets que NO se migran y se reportan uno por uno: filas con MONTO NEGATIVO (hay una
 *   real: -$34.999,97 en "Medicamentos / Accesorios", que migrada con abs() habria entrado como
 *   un ingreso ficticio indistinguible de uno legitimo) y filas con FECHA AMBIGUA (dia <= 12 y
 *   distinto del mes: "12/04/2026" tiene dos lecturas validas y ningun dato resuelve la duda).
 * - Parser de fechas es-AR explicito: cero new Date(string), que interpreta dd/mm con semantica
 *   de EE.UU. y habria duplicado filas cambiandoles el mes.
 * - Respaldo completo de Registros congelado y VERIFICADO antes de mutar: al insertar y
 *   reordenar por fecha las filas migradas quedan intercaladas, asi que no hay vuelta atras por
 *   rango. revertir restaura desde ahi.
 * - RETIRADOS DEL MENU: DEVTOOL_Presupuesto.js y DEVTOOL_CableadoPresupuesto.js quedan en el
 *   repo con cabecera "NO LISTO" y sus bloqueantes enumerados, pero inalcanzables desde la UI.
 *   Tres rondas adversariales no cerraron sus defectos de "declarar exito sin hacer el trabajo"
 *   (el motor informa ok sobre una hoja en ceros; el cableado escribe contra celdas vacias).
 *   Decision Franco: el Presupuesto se retoma en una sesion dedicada, con la planilla completa.
 *
 * ---
 *
 * [2026-08-13] v0.9.9 - Reparacion del formato de cotizaciones + auditoria de respaldos:
 * - HALLAZGO (verificacion post-migracion en vivo): el backfill de la v0.9.5 dejo 791 de 820
 *   filas de la columna Cotizacion de EUR mostrando FECHAS en vez de montos ("25/8/1904" en
 *   lugar de "$1.699,34"). Los valores guardados son correctos: es formato de celda. Causa:
 *   setValues no propaga formato y las filas nuevas heredaron el del grid recien ampliado.
 * - NUEVO repararFormatoCotizacionesV095(): toma como referencia el formato de la PRIMERA fila
 *   de datos de cada bloque (anterior al backfill, ya validada) y lo aplica al resto. Corrige
 *   SOLO formato, nunca valores, y saltea con aviso cualquier bloque sin fila de referencia.
 * - NUEVO estadoRespaldosV095(): lista las hojas de respaldo y marca cuales NO sirven. El
 *   primer intento de aplicar (sello _1721) dejo un RESP_FORMULAS con las formulas VIVAS -- el
 *   defecto que corrigio la v0.9.8 -- que no puede usarse para revertir. No borra nada: borrar
 *   hojas es irreversible y la decision es del operador.
 * - Verificacion independiente de la migracion (por Sheets API, no por el propio modulo): grid
 *   2200 OK; ARS 810 sin duplicados y en orden; las 4 formulas re-apuntadas son CIRUGIA PURA
 *   (unica diferencia contra el respaldo: la referencia de hoja) y sus indices ColN alinean con
 *   el header real; Registros_legacy intacta.
 *
 * ---
 *
 * [2026-08-13] v0.9.8 - El respaldo de formulas se guarda como TEXTO, no como formula viva:
 * - SINTOMA: aplicarMigracionV095() abortaba con "El respaldo de formulas no quedo verificado
 *   en: Tablero!AN4 ... columna 3". Aborto ANTES de mutar, o sea el contrato todo-o-nada
 *   funciono: ninguna celda de las hojas vivas se toco.
 * - CAUSA: setNumberFormat('@') afecta la visualizacion, NO el parseo. setValues con un string
 *   que arranca en "=" lo guarda igual como FORMULA. La celda del respaldo quedaba con la
 *   formula VIVA recalculandose contra Registros_legacy (un respaldo que se corrompe solo:
 *   cicatriz 4 del arnes) y la relectura devolvia el resultado evaluado en vez del texto.
 * - FIX: nuevo _textoLiteralV095() antepone el apostrofo de Sheets a todo valor que empiece
 *   con = + - @ o '. El apostrofo NO forma parte del valor (getValue lo devuelve sin el), asi
 *   que la verificacion sigue comparando contra el string original.
 * - La verificacion ahora exige ademas que NINGUNA celda del respaldo haya quedado como formula
 *   viva (getFormulas sobre las cinco columnas), que es la condicion que de verdad importa.
 * - El guard de respaldos huerfanos deja de bloquear a ciegas: compara el contenido del respaldo
 *   contra la hoja viva. Si coinciden, el respaldo es de un intento que aborto sin mutar y no
 *   bloquea; solo aborta si DIFIEREN, que es la firma de una migracion a medio aplicar.
 *
 * ---
 *
 * [2026-08-13] v0.9.7 - Guards de hoja invalida y stack en el informe de estado:
 * - estadoMigracionV095() fallaba con "TypeError: Cannot read properties of undefined
 *   (reading 'getMaxRows')", un mensaje que no dice que hoja falta.
 * - _contarBloquesTcV095 (cinco llamadores) y _validarRespaldoTcV095 validan su argumento y
 *   fallan nombrando el problema en vez de reventar sobre undefined.
 * - El catch de estadoMigracionV095 devuelve ademas las primeras lineas del stack.
 *
 * ---
 *
 * [2026-08-13] v0.9.6 - Menus separados: "Tidetrack" (uso diario) y "Tidetrack Dev" (desarrollo):
 * - Calcado del patron de planilla-pymes. El menu unico mezclaba la operacion cotidiana con
 *   herramientas que escriben estructura, y "Procesar Cargas" -- la funcion que mas se usa --
 *   estaba rotulada "[Dev]" como si fuera peligrosa.
 * - "Tidetrack": REGISTRAR (Procesar Cargas) + ADMINISTRAR (Plan de Cuentas) + submenu "Ir a
 *   la hoja" (solo hojas confirmadas por el escaneo: Inicio, Tablero, Cargas; quedaron fuera
 *   'Espacio blanco 1' y 'Espacio blanco 3', que ya no existen).
 * - "Tidetrack Dev": migracion v0.9.5, Mirada Interanual, Tipos de cambio, BD Antigua y
 *   mantenimiento, agrupados en submenus por dominio y numerados donde el orden importa.
 * - 00_Config.js: MENU_CONFIG soporta ahora secciones ({seccion}) y submenus ({submenu, items}),
 *   ademas de items y separadores. 12_MenuService.js los arma recursivamente.
 * - NUEVO _menuSeccion(): los rotulos de seccion son items inertes que avisan por toast que son
 *   un titulo (Apps Script no soporta encabezados de menu, y un item que no hace nada se lee
 *   como una falla).
 * - Cada menu se construye en su propio try/catch: si uno rompiera, el otro igual aparece.
 *
 * ---
 *
 * [2026-08-13] v0.9.5 - Adaptacion al layout REAL de la planilla (el pipeline vuelve a poder escribir):
 * - CONTEXTO: la planilla migro a B:M en junio pero el codigo nunca acompanio, asi que
 *   procesarCargas pedia Registros!I:T (col 9-20) sobre una hoja de 14 columnas y tiraba
 *   excepcion. Ultimo registro del ledger: 2026-03-29. Decision Franco 2026-08-13: se adapta
 *   el codigo al layout nuevo, no se revierte la planilla.
 * - 00_Config.js: RANGES.REGISTROS -> B:M (headerRow 5, dataRow 6); RANGES.TC_* -> B:C / E:F /
 *   H:I / K:L (headerRow 6, dataRow 7). Plan de Cuentas y Cargas SIN cambios (no migraron):
 *   sus entradas no declaran headerRow/dataRow y siguen cayendo a los globales 3/4.
 * - 03_SheetManager.js: getTableRange/getTableData/appendRow/appendMassive leen headerRow y
 *   dataRow por tabla, con fallback a los globales. 06_RegistrosService.js: append y sort por
 *   la columna de Fecha del layout nuevo (H). 99_MigrationLogic.js: lecturas y escrituras al
 *   layout nuevo (fecha H=8, valores de moneda J:M=10..13).
 * - 07_MiradaInteranual.js: formulas remapeadas (fecha O->H, monto I->B, tipo de cuenta L->E,
 *   moneda N->G, TC R/S/T->K/L/M) y filas 3 -> 6. Ahora verifica precondiciones antes de
 *   escribir (rotulos C10:C12 y selectores E4/F4/R4), protege setFormula, y NO declara exito
 *   si la celda queda en cualquier valor de error (antes solo miraba #ERROR!, asi que un #REF!
 *   se replicaba a las 36 celdas cantando exito). Nuevo guard que verifica que cada fila
 *   replicada interrogue SU rotulo: hoy las filas 11 y 12 apuntan a $C10 y calcularian todas
 *   Ingresos, tapado por el #ERROR!.
 * - 15_ExchangeRateApi.js: forzarCargaHistorica verifica capacidad Y cobertura ANTES del primer
 *   clearContent (contrato todo-o-nada). Aborta si un bloque viene vacio, si trae menos filas
 *   que las que la hoja ya tiene, o si queda muy por debajo de los demas. fetchArsRate loguea
 *   sus fallbacks (Regla Estricta 9) y deja de devolver el hardcode 1000 como si fuera
 *   cotizacion: lanza, porque un TC inventado se congela en cada registro.
 * - NUEVO MIGRACION_v0.9.5_LayoutNuevo.js: estado/aplicar/revertir con respaldo congelado y
 *   VERIFICADO antes de mutar, respaldo original inmutable ante reintentos, DocumentLock y
 *   contrato {ok, detalle, error}. Amplia el grid de Tipos de cambio (tenia 6 filas libres),
 *   hace backfill idempotente de las 3.151 cotizaciones perdidas desde la hoja legacy, y
 *   re-apunta por cirugia las formulas de Tablero/Inicio/Cargas que aun leen Registros_legacy.
 *
 * ---
 *
 * [2026-08-13] v0.8.4 - Gemelo digital Fase 2 (arnes): scanner de cobertura total:
 * - 98_DevTools_Scanner.js reescrito: mapea TODA celda con valor o formula. El filtro r < 5
 *   de la version anterior dejaba ciegas a las BDs (44 celdas de una hoja Registros de 2879 filas).
 * - NUEVO: valor_mostrado via getDisplayValues() - unico lugar donde viven los errores de
 *   runtime (#N/A, #DIV/0!, #REF!), que el campo valor nunca traia para celdas con formula.
 * - NUEVO: gid (getSheetId()) por hoja en meta. Sin el, un renombre es indistinguible de
 *   borrado + alta y el diff de no-danio reporta destruccion masiva falsa.
 * - Estilo serializado solo si difiere del default; notacion A1 calculada en memoria.
 * - Sin cambios en logica de negocio. Herramientas de soporte fuera de src/: devtools/
 *   (inventario, TSV de auditoria, diff de no-danio) y MAPA_ARQUITECTURA_PLANILLA.md.
 * - HALLAZGO: el primer escaneo en vivo probo que Registros y Tipos de cambio YA ESTAN en el
 *   layout v0.9.x mientras el codigo desplegado asume el viejo. Ver CHANGELOG.md.
 *
 * ---
 *
 * [2026-08-12] v0.8.3 - Gobernanza Fase 1 (arnes): resolver de nombres de hoja + menu sin emojis:
 * - NUEVO: _resolverNombreHoja(alias) + invalidarCacheNombresHojas() en 00_Config.js (portado de pymes).
 *   SHEETS.DATA_ENTRY / TIPOS_CAMBIO / BD_ANTIGUA pasan a getters con alias: corrigen las tres
 *   discrepancias config-planilla detectadas ('Hoja de Cargas' vs 'Cargas'; 'Tipos de cambio' vs
 *   'Tipos de Cambio'; 'BD antigua' vs 'BD Antigua') sin ventana de rotura ante renombres.
 *   Politica: ante ambiguedad gana el alias historico (el que tiene los datos), con log.
 * - RANGES TC_*: sheet pasa a getter para preservar la resolucion perezosa.
 * - NUEVO: SHEETS.MIRADA_INTERANUAL y SHEETS.DEBUG_MIRADA; 07_MiradaInteranual.js deja de
 *   hardcodear nombres de hoja (regla SSOT).
 * - MENU_CONFIG sin emojis (regla cero emojis del arnes, Fase 1).
 * - Sin cambios de logica de negocio: pipeline, FX y migraciones intactos.
 *
 * ---
 *
 * [2026-06-22] v0.8.2 - Módulo Mirada Interanual:
 * - NUEVO: `07_MiradaInteranual.js`. `inicializarMiradaInteranual()` setea las fórmulas LET/SUMPRODUCT
 *   en G10:R14 de la hoja "Mirada Interanual" (Ingresos/Gastos Fijos/Gastos Variables por mes + Resultado).
 * - Lógica: offset mensual vía `COLUMN()-COLUMN($K$10)`, navegación cross-year vía `EDATE`,
 *   conversión multi-moneda vía `tc_tx/tc_sel` (ambas relativas a ARS=1).
 * - Rangos de Registros desde fila 3 (header real en fila 2, datos desde fila 3, auditado sobre la planilla).
 * - FIX locale: el lookup del mes usa `SPLIT("ENERO,...,DICIEMBRE";",")` en vez de array literal `{...}`.
 *   El array literal con comas rompía con "Error de análisis de fórmula" en locale español (separador ";", arrays "\").
 *   Se replica el patrón ya usado en las fórmulas del Tablero.
 * - NUEVO: `diagnosticarMiradaInteranual()` + menú [Dev] "Diagnosticar Mirada Interanual": escribe una hoja
 *   "DEBUG Mirada" con micro-tests (separadores, array literal, SPLIT, lectura de Registros, fórmula completa)
 *   para aislar fallas sin adivinar.
 * - NUEVO: entrada de menú [Dev] → "Inicializar Mirada Interanual" en `00_Config.js`.
 * - Nota: v0.8.1 queda reservada para el track de `06_RegistrosService.js` (prompt separado).
 *
 * ---
 *
 * [2026-06-05] v0.8.0 (mantenimiento) - Sync de metadata y limpieza documental:
 * - Sincronizado `01_Version.js` de 0.1.0 (Sprint 0) a v0.8.0; el changelog embebido ahora apunta a este archivo como fuente de verdad.
 * - Eliminado `docs/permanente/TABLERO_ARQUITECTURA.md` (placeholder vacío de 0 bytes); se recreará al construir el Tablero.
 * - `ESTRUCTURA.md` sincronizado a v0.8.0 (módulos de src/, docs de Cowork, capa .claude/).
 *
 * ---
 *
 * [2026-03-23] v0.8.0 - Herramientas de Escrutinio Arquitectónico:
 * - Módulo DevTools añadido: `98_DevTools_Scanner.js`. 
 * - Permite exportar el 100% de la arquitectura de la planilla (metadatos, fórmulas, colores, offsets) a un snapshot JSON.
 * - Actualización de permisos de Drive en `appsscript.json`.
 * 
 * ---
 *
 * [2026-03-22] v0.7.9 - Fórmulas Nativas Tiempo Real (RealTime API):
 * - Se integraron 3 Custom Functions (`=TIDETRACK_USD()`, `=TIDETRACK_EUR()`, `=TIDETRACK_AUD()`) disponibles globalmente para invocar desde cualquier celda de Google Sheets.
 * 
 * ---
 *
 * [2026-03-21] v0.7.8 - Fix Case Sensitivity en Auto-Sort:
 * - Se detectó que el Auto-Sorting fallaba silenciosamente si la pestaña física se llamaba "Tipos de Cambio" en lugar de "Tipos de cambio". Se aplicó un bypass de casing (`.toLowerCase()`).
 * 
 * ---
 *
 * [2026-03-21] v0.7.7 - Fix Auto-Sort Lag:
 * - Se optimizó el disparador automático de `appendMassive` eliminando el uso asíncrono de `getLastRow()` por un mapeo matemático estricto según la matriz enviada. Garantiza el Z-A de inmediato.
 * 
 * ---
 *
 * [2026-03-21] v0.7.6 - Alerta UI para Protección Multi-celda:
 * - Se reemplazó el Toast pasivo por una alerta UI (`ui.alert()`) intrusiva en la hoja "Plan de Cuentas" cuando se borran/editan múltiples celdas accidentalmente.
 * - Este cambio garantiza que el usuario sea claramente notificado de que debe usar `Ctrl+Z` para recuperar sus datos.
 *
 * ---
 * [2026-03-21] v0.7.5 - Auto-Sort en Tipos de Cambio:
 * - Se le inyectó inteligencia a `appendMassive` para que al apendear hacia cachés `TC_` en la hoja `Tipos de Cambio`, lea la tabla lateral específica y la ordene cronológicamente de la Z a la A por cuenta propia.
 * 
 * ---
 *
 * [2026-03-21] v0.7.4 - Rename Global "Costos" a "Gastos":
 * - Refactorización quirúrgica de constantes, endpoints y strings en frontend y backend (`COSTOS_FIJOS` -> `GASTOS_FIJOS`).
 * - Actualización de las herramientas de deducción en `RegistrosService` y `MigrationEngine`.
 *
 * ---
 *
 * [2026-03-20] v0.7.3 - Fix Dev Toggle Protección Plan Cuentas:
 * - Se corrigió la UX del menú `togglePlanCuentasProtection()` agregando un prompt de confirmación explícito para evitar desactivaciones accidentales.
 * - Se mejoró `handlePlanCuentasEdit()` (onEdit) para detectar ediciones multi-celda y sugerir al usuario el uso de Ctrl+Z dado que Apps Script no provee oldValue para pegados masivos.
 *
 * ---
 *
 * [2026-03-20] v0.7.2 - Recalculador Masivo TC:
 * - Herramienta [Dev] `recalcularTcRegistros()` para aplicar retrospectivamente la lógica base ARS a la hoja Registros.
 * - Ideal para usuarios que ya migraron BD Antigua antes del parche `v0.7.1`.
 *
 * ---
 *
 * [2026-03-20] v0.7.1 - Base Monetaria ARS:
 * - Se invirtió la matemática de Tipos de Cambio. Ahora `TC_ARS` es fijo en 1.0.
 * - `TC_USD` guarda el valor de argentinadatos, y `TC_EUR`/`TC_AUD` triangulan con Frankfurter hacia ARS.
 * - Mayor facilidad estructural para queries (`Value * Exchange Rate = Value in ARS`).
 *
 * ---
 *
 * [2026-03-20] v0.7.0 - Motor de Migración de BD Legacy:
 * - Se introdujo `99_MigrationLogic.js` con soporte para importar bases 2024+.
 * - Identificador y autocompletador de diccionarios faltantes (Cuentas y Medios).
 * - Se extendió `FLOOR_DATE` en `06_RegistrosService.js` y `15_ExchangeRateApi.js` al 01/01/2024.
 *
 * ---
 *
 * [2026-03-20] v0.6.2 - Carga Histórica de TC:
 * - Se añadió la herramienta [Dev] `forzarCargaHistorica()` en `15_ExchangeRateApi.js`.
 * - Permite generar un barrido desde el 01/01/2026 reconstruyendo el historial de las 4 divisas simultáneas con fallback a viernes para fines de semana.
 *
 * ---
 *
 * [2026-03-20] v0.6.1 - Refactor Columnas Cargas y Registros:
 * - Se adaptó `00_Config.js` y `06_RegistrosService.js` para soportar una nueva columna "Tipo de Cuenta" en la DB de Registros.
 * - En la hoja "Cargas", se añadió "Tipo" manualmente y "Tipo de Cuenta" se eliminó (se deduce eficientemente en backend).
 * - Se corrigieron los índices de ordenamiento `sort()` y mapeo en `RANGES.REGISTROS` hasta la columna T. 
 *
 * ---
 *
 * [2026-03-20] v0.6.0 - Sistema de Registros Batch y Arquitectura Multi-Moneda:
 * - Creación de la hoja "Registros" como Data Lake inmutable y "Tipos de Cambio" como caché estructurado.
 * - `06_RegistrosService.js`: Se incorporó `procesarCargas()` para lectura en bloque de `I5:O19`, anexado a `Registros` y ordenamiento inteligente.
 * - `15_ExchangeRateApi.js`: Se añadió fetching de APIs externas con caché temporal en memoria. (DolarApi y Frankfurter) para ARS/USD/EUR/AUD.
 * - El menú de Tidetrack ganó el ítem `🔧 [Dev] Procesar Cargas`.
 *
 * ---
 *
 * [2026-03-20] v0.5.1 - Autocompletado Hoja Cargas:
 * - Se implementó la lógica de autocompletado en `14_EventHandlers.js` para la hoja "Cargas".
 * - El "Tipo" se deduce automáticamente al elegir la "Cuenta" cruzando datos con el Plan de Cuentas.
 * - La "Moneda" se completa automáticamente según el "Medio" seleccionado.
 * - La "Fecha" se autocompleta con el día en curso al ingresar un "Monto".
 *
 * ---
 *
 * [2026-03-20] v0.5.0 - Refactor Arquitectura de Base de Datos Plan de Cuentas:
 * - Se simplificó la captura de datos (ADR): "Moneda" pasa a ser propiedad exclusiva de "Medios Bancarios". Se elimina del ABM para Ingresos y Egresos.
 * - Reasignación de columnas de la BDD (I:J Ingresos, L:M Costos Fijos, O:P Costos Variables, R:T Medios Bancarios, V:W Proyectos).
 * - Adaptación de Frontend y Backend (`getCategoryAccounts`, `saveAbmRecord`) para rutear arreglos dinámicos no simétricos.
 *
 * ---
 *
 * [2026-03-20] v0.4.9 - Optimización de Rendimiento y Ajustes UI en ABM:
 * - Se optimizó drásticamente el guardado (`appendRow` y `getTableData` en `03_SheetManager.js`) empleando una búsqueda inversa (bottom-up), eliminando el cuelgue al guardar registros.
 * - Se corrigió un error JavaScript en `UI_AbmPlanCuentas.html` provocado por la referencia a un elemento HTML eliminado (`groupAbreviacion`).
 * - Se limitaron las monedas disponibles estrictamente a: ARS, USD, AUD, y EUR (como constante en `00_Config.js`).
 * - Se actualizó la etiqueta visual del selector principal a "¿Qué categoría querés gestionar?".
 *
 * ---
 *
 * [2026-03-17] v0.4.8 - Moneda Opcional en ABM Plan de Cuentas:
 * - El campo Moneda en el formulario ya no es obligatorio (ADR-002: Principio de Moneda por Defecto).
 * - Se eliminó el atributo `required` del HTML y la validación `throw` del backend.
 *
 * ---
 *
 * [2026-03-17] v0.4.7 - Opción 3 (Moneda por Defecto, ADR-002) + Validación de Duplicados:
 * - Se documentó la regla en GUIA_ARQUITECTURA.md (ADR-002) y PRINCIPIOS_DISEÑO.md.
 * - Validación de duplicados en `saveAbmRecord` (11_UIService.js): arroja error limpio si el nombre ya existe en el módulo.
 * - Alerta de error visual integrada en el DOM del pop-up (no más alert() nativos).
 * - Se oculta el errorAlert al cambiar entidad o al reintentar guardado.
 *
 * ---
 *
 * [2026-03-17] v0.4.6 - Validación de Duplicados en ABM:
 * - Se agregó una validación en `saveAbmRecord` (11_UIService.js) para evitar la creación de cuentas duplicadas.
 * - Si el usuario intenta registrar el mismo nombre de cuenta en la misma entidad, el sistema arroja error (desde Backend).
 * - Se reemplazó la alerta nativa `alert()` en Frontend por un mensaje de error integrado al diseño (inline UI con SVG y colores semánticos).
 *
 * ---
 *
 * [2026-03-17] v0.4.5 - Ajustes de Proporciones y Paleta de Colores en ABM:
 * - Se ajustó el tamaño del modal Plan de Cuentas de 600x650 a 520x620 para mejorar las proporciones y centrar el foco en el formulario.
 * - Se actualizó la paleta de colores institucional en `UI_SharedStyles.html`: oscureciendo los paneles principales a `#34475d`,
 * implementando un class de botón seleccionado (`.btn-selected`) y halos de foco en formulario con color de acento `#b5bfc6`,
 * y estableciendo el fondo principal a `#eff2f9`.
 *
 * ---
 *
 * [2026-03-17] v0.4.4 - Mejoras UI_AbmPlanCuentas:
 * - Se reemplazaron las alertas JavaScript nativas de "Guardado Exitoso" por un "Success State" visual e integrado en el DOM, utilizando el Design System y permitiendo continuar agregando o cerrar el modal amigablemente.
 *
 * ---
 *
 * [2026-03-17] v0.4.3 - Creación de UI_SharedStyles:
 * - Se agregó el archivo base de CSS `UI_SharedStyles.html` que faltaba en el repositorio.
 * - Esto soluciona la excepción "No se encontró el archivo HTML llamado UI_SharedStyles" al abrir pop-ups.
 *
 * ---
 *
 * [2026-03-17] v0.4.2 - Fix de UI Styles en Pop-ups:
 * - Se corrigió `11_UIService.js` para usar `createTemplateFromFile().evaluate()` en lugar de `createHtmlOutputFromFile`,
 * permitiendo que las etiquetas `<?!= include() ?>` se rendericen y apliquen correctamente el CSS Institucional al Plan de Cuentas.
 *
 * ---
 *
 * [2026-03-17] v0.4.1 - Refactorización de Back-End y Pop-Up de Cuentas:
 * - Se corrigió archivo .claspignore que impedía el push de código local.
 * - Refactorización de `00_Config.js` y `03_SheetManager.js` para dar soporte a 6 nuevas tablas independientes:
 * (Ingresos, Costos Fijos, Costos Variables, Medios_Pago, Monedas y Proyectos).
 * - Creación de `UI_AbmPlanCuentas.html`: Pop-Up interactivo Multi-ABM con lógica de UI Router (mostrar/ocultar campos dinámicamente).
 * - Inyección de endpoints de lectura/escritura en `11_UIService.js` para conectar el HTML con las hojas de cálculo.
 * - Modificación de `12_MenuService.js` para incluir el botón de acceso en el submenú de Tidetrack.
 *
 * ---
 *
 * [2026-03-17] v0.4.0 - Configuración Inicial del Repo Local:
 * - El proyecto migró de formato web a código local mediante Clasp y Node.
 * - Se conectó el proyecto con GitHub mediante un Watcher automático (github-autopilot).
 */
