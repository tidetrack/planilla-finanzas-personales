/**
 * ============================================
 * REGISTRO DE ACTUALIZACIONES (CHANGELOG)
 * ============================================
 * Historial descendente de cambios sincronizados al entorno Apps Script.
 * (Añadir nuevos registros arriba)
 *
 * [2026-08-19] v0.13.0 - Riqueza por lista blanca, y el Tipo a la vista en el bloque de categorias.
 * - CAMBIO DE DEFINICION, no correccion de bug (decision de Franco del 2026-08-19). Hasta hoy el
 *   capital acumulado se calculaba como "todo tipo de categoria que NO sea Hogar". Eso hacia que
 *   la FINANCIACION -- Tarjeta de Credito, Prestamo Mac -- sumara como patrimonio. Una tarjeta es
 *   un pasivo. Riqueza pasa a definirse por LISTA BLANCA: solo Ahorros e Inversiones.
 * - POR QUE LISTA BLANCA Y NO ARREGLAR LA NEGRA: con "todo lo que no sea Hogar", cualquier tipo
 *   nuevo del catalogo entraba a riqueza sin que nadie lo decidiera, por el solo hecho de no
 *   llamarse Hogar. Una lista blanca obliga a decidir. La regla vive en TIPOS_RIQUEZA
 *   (00_Config.js), no repartida por seis formulas.
 * - LA TRAMPA DE ESTE CAMBIO, y por que el modulo trabaja sobre una lista cerrada de celdas en
 *   vez de barrer la planilla reemplazando "Hogar": hay DOS usos del tipo de categoria que se
 *   parecen y no se corrigen igual. (a) "es riqueza?" -> las seis celdas que ligan cond_riqueza /
 *   cond_ahorro: Inicio!F8, Tablero!N19 y Tablero!AG9:AG12. (b) "es flujo cotidiano?" -> las diez
 *   que dejan entrar los arrastres 'Inicio Mes' cuando el medio es de casa (Inicio!C13/F13/C15/F15,
 *   Tablero!R9/U9/X9) y los saldos cotidianos (Inicio!C8, Tablero!AF9:AF12, que ademas filtran por
 *   NOMBRE de categoria y no por tipo). Las (b) NO se tocan: romperlas romperia el saldo cotidiano,
 *   que hoy cierra al centavo contra el ledger.
 * - IMPACTO MEDIDO sobre el ledger crudo antes de aplicar: el cambio mueve meses enteros --
 *   marzo 2026 -$567.974, abril +$332.974, junio +$200.000, agosto -$230.000 -- aunque en el
 *   acumulado historico la Financiacion neta solo +$230.000 en 7 filas. Es el efecto buscado.
 * - LA COLUMNA DEL TIPO. Tablero!AA9 derrama AA=categoria, AB=vacia, AC=monto, y el rotulo AB8 YA
 *   DECIA "Tipo" desde el rediseno: la columna se diseno para eso y quedo sin llenar, con una
 *   variable que la formula llamaba literalmente columna_ak_vacia y devolvia "" siempre. Ahora
 *   trae el tipo de cada categoria (VLOOKUP al catalogo) y la variable se llama columna_tipo.
 *   Ademas el bloque deja de filtrar las categorias de tipo Hogar: con el Tipo a la vista, mostrar
 *   todas es la lectura por macrosegmento que se buscaba. Si se prefiere lo otro, es una linea.
 * - CATALOGO: se deja 'Financiacion' como un solo tipo (decision de Franco). No se parte en
 *   'Tarjetas' y 'Financiamiento'.
 * - VERIFICACION: preflight que exige que el catalogo tenga al menos una categoria de cada tipo de
 *   la lista blanca (si no, el capital daria cero) y que el rotulo AB8 diga "Tipo"; respaldo
 *   congelado y releido antes de mutar; y relectura del VALOR de cada celda escrita, con reversion
 *   del lote entero si alguna queda en error. Mas devtools/probar_riqueza.js, que corre las
 *   transformaciones reales contra las formulas reales del gemelo ANTES de desplegar.
 *
 * [2026-08-19] v0.12.1 - Reparar la reparacion: el modulo que arreglo el formulerio rompio tres
 * celdas, y su verificador lo dejo pasar.
 * - QUE PASO: Franco corrio "Aplicar reparacion" y el modulo declaro exito. La auditoria sobre
 *   la planilla viva encontro que "Tablero"!O23, O24 y O25 habian pasado de #REF! a #ERROR!
 *   (Formula parse error): quedaron PEOR que antes. Las otras 24 celdas quedaron bien, y las
 *   siete agregaciones que se recalcularon contra el ledger cierran AL CENTAVO.
 * - EL BUG, en una linea: en _reponerReferencias habia dos reemplazos que usaban string de
 *   reemplazo en vez de funcion --  out.replace(/(\$N\$10\s*-\s*)#REF!/g, '$1$N$17'). En un
 *   string de reemplazo '$1' es el grupo capturado, '$N' es literal y '$17' vuelve a ser el
 *   grupo 1 seguido de un 7. En vez de "$N$10 - $N$17" escribio "$N$10 - $N$N$10 - 7". Las
 *   otras cuatro sustituciones de esa funcion zafaron por casualidad: dos no tienen grupos (y
 *   un '$4' sin grupo queda literal) y dos llevan el '$1' al final.
 * - LO GRAVE NO ES EL BUG SINO QUE PASO EL GUARD. _verificarEscrituraFormulerio comparaba el
 *   TEXTO releido contra el texto escrito y exigia cero #REF!, cero 'Liquidez' y cero anclas
 *   viejas. El texto corrupto cumple las cuatro. Comprobar que escribiste lo que querias
 *   escribir NO ES comprobar que funciona. Es la cicatriz 5 del arnes -- "un guard que reporta
 *   exito sin hacer el trabajo es peor que no tener guard" -- cometida por el modulo que la
 *   cita en su propia cabecera.
 * - CORRECCION EN TRES CAPAS, ninguna apoyada en la otra: (a) TODOS los reemplazos van por
 *   funcion de reemplazo, asi el valor devuelto se inserta tal cual y el problema no puede
 *   existir en un proyecto donde toda formula lleva '$'; (b) el verificador LEE EL VALOR
 *   RESULTANTE de cada celda y revierte el lote entero si alguna quedo en error, distinguiendo
 *   "ya estaba rota" de "la rompi yo"; (c) devtools/probar_formulerio.js corre las
 *   transformaciones REALES contra las formulas REALES del gemelo antes de desplegar. Esa
 *   tercera capa habria cortado el bug en diez segundos: no correrla fue el error de fondo.
 * - REPARACION DEL DANIO: el modulo reconoce y deshace el artefacto "$N$N$10 - 7" que aquella
 *   corrida dejo escrito. Sin eso, re-correr "Aplicar" contestaria "nada que hacer" con tres
 *   celdas rotas a la vista -- otra vez el mismo modo de falla.
 * - SEXTO DEFECTO, hallado por la misma auditoria y reparado aca: las columnas "Valor en X" de
 *   "Inicio" (AF8 y AT8) NO CONVIERTEN MONEDA. Leen la moneda de la columna de CUENTA (V y AJ)
 *   en vez de la de MONEDA (Y y AM), asi que ninguna rama del IF se cumple, tasa_origen cae al
 *   literal 1 y la columna es un passthrough del monto crudo: todo movimiento en moneda
 *   extranjera entra a C13, F13, C15 y F15 A VALOR NOMINAL. Un cobro de 200 USD cuenta como 200
 *   pesos. Medido en junio de 2026: ~$376.740 de ingreso desaparecido, el 23% del mes. AT8
 *   ademas tomaba la moneda de DESTINO de Y13 -- que no es un selector sino la celda con la
 *   moneda del sexto movimiento del mes actual --, y el rotulo AT7 repetia la referencia.
 * - QUINTO DEFECTO diagnosticado pero NO reparado: "Inicio"!C15/F15 devuelven siempre "0%
 *   respecto del mes anterior" aunque la variacion real sea de +155%. Causa: cuatro condiciones
 *   se ligan a variables de LET sin ARRAYFORMULA, la comparacion se evalua por interseccion
 *   implicita, FILTER recibe una condicion de una fila y tira error de tamanio, y el IFERROR
 *   externo lo vuelve 0. Queda para una pasada propia: es otro mecanismo de falla y muestra un
 *   rotulo feo, no un numero equivocado en una cifra de portada.
 *
 * [2026-08-19] v0.12.0 - Formulerio reparado: "Inicio" y "Tablero" dejan de mentir.
 * - CONTEXTO: el swap v0.11 movio las celdas de las dos hojas que Franco MIRA y las formulas se
 *   copiaron apuntando a las direcciones viejas. El resultado no eran errores -- eso hubiera
 *   sido benigno -- sino numeros plausibles calculados sobre datos mal apareados. Solo cuatro
 *   celdas mostraban un error visible (#REF!/#VALUE! en el Tablero); el resto mentia en silencio.
 * - DEFECTO 1, EL DE FONDO: "Tablero"!AJ6 es el motor entero de la hoja, un unico QUERY sobre
 *   Registros!B6:M que DERRAMA doce columnas desde la fila 6. Quince formulas consumidoras
 *   pedian la fila 9 (AK9:AK, AO9:AO, AR9:AR...), asi que cada monto se apareaba con el tipo, la
 *   moneda y la cotizacion del movimiento TRES FILAS MAS ABAJO. De ahi que N19 declarara
 *   $63.567.848 de capitalizacion en un mes: montos en pesos multiplicados por la cotizacion del
 *   dolar porque cayeron en el bucket de moneda equivocado.
 * - DEFECTO 2: el selector de moneda vivia en $I$9 y el rediseno lo movio a N4; las formulas
 *   portadas quedaron con #REF! en su lugar -- diecisiete tokens en ocho celdas. Donde el #REF!
 *   estaba envuelto en IFERROR se degradaba en silencio: AV6 ("Valor en ARS") devolvia una
 *   columna entera de ceros, y con ella S7/V7/Y7, N16/N17/N18 y O16:O19, o sea el bloque
 *   "Movimientos del mes" completo. Donde no lo estaba, propagaba (O23:O25 = #REF!).
 * - DEFECTO 3: el bloque "Disponibilidad de fondos" quedo rotado UNA POSICION respecto de sus
 *   rotulos. El rediseno reordeno las etiquetas (el orden viejo empezaba por Ahorro, el nuevo
 *   por Gastos Fijos) pero las formulas se pegaron en el orden viejo: la de Capacidad de Ahorro
 *   terminó en la fila de Gastos Fijos. Cada una calculaba bien lo suyo, en la fila del vecino.
 * - DEFECTO 4: catorce celdas comparaban contra el tipo de categoria 'Liquidez', que el Plan de
 *   Cuentas nuevo ya no tiene (sus tipos son Ahorros / Inversiones / Financiacion / Hogar).
 *   'Hogar' es su equivalente 1:1 -- ambos con una sola categoria, "Medio Cotidiano". Al no
 *   cumplirse nunca la condicion, el gasto cotidiano se contaba como capital acumulado y los
 *   arrastres de "Inicio Mes" que si debian entrar quedaban todos afuera.
 * - COMO SE REPARA, Y POR QUE ASI: el modulo NO redacta ni una formula. Lee cada celda con
 *   getFormula(), reemplaza los tokens equivocados y la escribe de vuelta. El bloque rotado no
 *   se reescribe: se INTERCAMBIA. Es deliberado y evita de raiz la trampa de locale de
 *   07_MiradaInteranual -- la planilla es es_AR y setFormula no traduce los arrays literales {},
 *   que media docena de estas formulas usan. Al no autorizar ninguna, el ida y vuelta es
 *   identidad.
 * - GUARDS QUE ABORTAN SIN ESCRIBIR: el mapeo de columnas del motor se deriva de
 *   RANGES.REGISTROS.columns y se contrasta rotulo por rotulo contra el header del ledger (un
 *   mapeo supuesto y no verificado ya nos costo una vez); la rotacion se decide por el ROTULO de
 *   cada fila y no por su posicion; el catalogo debe tener cero 'Liquidez' y al menos un 'Hogar';
 *   el selector N4 debe contener una moneda del sistema. Y el re-apuntado toca UNICAMENTE rangos
 *   abiertos de dos letras (AK9:AK), nunca celdas sueltas: AF9:AF12 y $AF$17:$AF$19 son otro
 *   bloque de la hoja, hoy funcionan, y un reemplazo numerico 9->6 a ciegas los corrompia.
 * - RESPALDO: congela TODAS las formulas de las dos hojas como texto (apostrofo inicial, no
 *   setNumberFormat: ya nos paso en v0.9.8 que un respaldo "de texto" quedara vivo y
 *   recalculando) y lo RELEE antes de mutar. Si la relectura posterior a escribir no verifica, o
 *   si setFormula lanza a mitad del lote, cada celda vuelve a su formula previa.
 * - LO QUE NO TOCA, A PROPOSITO: AF9:AF12 e "Inicio"!C8 filtran por el NOMBRE de la categoria en
 *   vez de por su tipo -- fragil, pero hoy dan el numero correcto, y fragil no es roto. Tampoco
 *   limpia el Plan de Cuentas (fila huerfana P19/Q19, duplicado "Meta de Ahorro 3"): eso es dato
 *   de Franco. Ni el "0%" de "Inicio"!C15/F15, que es un quinto defecto y merece su diagnostico.
 *
 * [2026-08-18] v0.11.1 - Armas descargadas: se neutralizan las vias de escritura peligrosas
 * que quedaron vivas despues del swap, y se cierra el camino lateral que encontro la auditoria:
 * - CONTEXTO: con el swap v0.11 ya aplicado en produccion, la planilla quedo rodeada de codigo
 *   que sigue existiendo, sigue siendo invocable y escribe con la geometria vieja. Cuatro vias
 *   se neutralizaron en esta ronda; una auditoria adversarial posterior encontro que la
 *   neutralizacion principal se podia esquivar.
 * - VIA 1 - COTIZACIONES INVENTADAS (99_MigrationLogic). migrarBdAntigua y
 *   recalcularTcRegistros rellenaban las fechas sin cotizacion con 1050/650/1100: numeros sin
 *   ningun respaldo que quedaban CONGELADOS en el ledger, que es el unico dato que despues no
 *   se puede recalcular. Ahora ante una sola fecha faltante se aborta TODO-O-NADA, sin escribir
 *   una celda, listando las fechas y remitiendo a "Forzar carga historica".
 * - VIA 2 - FALLBACK MUDO DE FX (15_ExchangeRateApi). fetchArsRate devolvia la cotizacion mas
 *   reciente disponible sin emitir un solo log (verificado: fetchArsRate('2026-12-31')
 *   devolvia 1510, la del 17, sin rastro). Ahora: formato invalido -> lanza; fecha FUTURA ->
 *   lanza (el TC de un dia que no ocurrio no existe); cotizacion de otra fecha -> queda
 *   registrada, una linea por cotizacion ancla mas un resumen de lote (resumirFallbacksArs).
 * - VIA 3 - RECALCULO SIN AVISO (99_MigrationLogic). recalcularTcRegistros sobreescribe los TC
 *   congelados de todo el ledger de una sola vez: ahora pide confirmacion explicita NOMBRANDO
 *   cuantas filas va a pisar y el rango exacto. Ademas (a) las filas sin fecha legible se
 *   SALTEAN conservando sus cotizaciones -- antes recibian vacios en J:M en silencio y el
 *   cierre las contaba como recalculadas -- y se cuentan y se nombran; (b) el alto sale de la
 *   ultima fila con dato en la columna FECHA y no de getLastRow(), que mide cualquier columna:
 *   un valor suelto en T40 hacia escribir J7:M40, 34 filas para 2 registros reales.
 * - VIA 4 - MIGRACION v0.9.5 OBSOLETA. Su geometria caduco con el swap y revertir habria pisado
 *   la fila 7 (encabezados) y corrido el Data Lake una columna a la izquierda, destruyendo la
 *   columna Fecha de los cuatro bloques. Se le puso un guard que se deriva del CONFIG
 *   (_geometriaObsoletaV095 cruza el mapa del modulo contra RANGES y se apaga solo si algun dia
 *   vuelven a coincidir).
 * - LO QUE ENCONTRO LA AUDITORIA: el guard de la via 4 estaba SOLO en las tres entradas
 *   publicas. cuerpoRevertirV095_ -- que es la que hace todo el trabajo destructivo -- era
 *   invocable directo, no pasaba por el guard, escribia setValues sobre Tipos de Cambio B7:C1000
 *   y equivalentes en E/H/K, y encima devolvia ok:true con "MIGRACION v0.9.5 REVERTIDA".
 *   Exactamente el dano que el guard dice evitar, reportado como exito.
 * - DATO DE PLATAFORMA QUE LO CAUSABA: en Google Apps Script una funcion es privada cuando su
 *   nombre TERMINA en guion bajo (nombre_), NO cuando empieza (_nombre). Todas las funciones
 *   _algo del proyecto son PUBLICAS: aparecen en el dropdown "Ejecutar" del editor. Toda
 *   defensa apoyada en "es interna porque empieza con guion bajo" era falsa.
 * - CORRECCION EN DOS CAPAS, ninguna apoyada en la otra: (a) el guard vive ahora en TODA funcion
 *   que escribe -- las 22 escrituras del modulo v0.9.5 estan en 7 funciones y las 7 abortan al
 *   entrar, mas el guardado de estado y el cuerpo de aplicar; (b) esas funciones se renombraron
 *   para TERMINAR en guion bajo, que es lo unico que de verdad las saca del dropdown. Las cinco
 *   entradas publicas conservan su nombre porque el menu las invoca por string. Mismo criterio
 *   aplicado a MIGRACION_v0.11 y MIGRACION_v031: sus helpers que escriben se renombraron, y los
 *   dos cuerpos de v031 (aplicar/revertir) abortan explicito si se los invoca sin su testigo de
 *   progreso en vez de depender de un TypeError accidental.
 * - MENU DEL SWAP v0.11 REDUCIDO a lo que todavia tiene trabajo. Salen "2. Sincronizar BDs"
 *   (su docstring ya afirmaba estar fuera del menu mientras el item seguia vivo en
 *   00_Config.js: la afirmacion era falsa, ahora es verdadera), "3. Aplicar" (no se aplica dos
 *   veces) y "4. Revertir", que era la unica del quinteto que funcionaba entera y NO pedia
 *   ninguna confirmacion: un clic devolvia la planilla al layout viejo contra un config que
 *   describe el nuevo. Revertir sigue invocable como salida de emergencia deliberada y ahora
 *   exige confirmacion (o revertirSwapV011(true) sin UI). Quedan "Ver estado" (solo lectura) y
 *   "Purgar respaldos", que es el paso que le falta a Franco tras validar los tableros.
 * - La precondicion de sincronizar chequeaba las dos hojas Fix con && ("faltan las dos"): con
 *   una sola presente seguia y trabajaba a medias. Ahora aborta si falta cualquiera.
 * - procesarCargas: el toast de fallbacks contaba LLAMADAS A LA API (una por fecha distinta),
 *   asi que cinco movimientos de la misma fecha decian "1 fila(s)". Ahora cruza las fechas del
 *   lote contra las que cayeron en fallback e informa filas afectadas sobre el total.
 * - MODO DE FALLA NUEVO, documentado: una sola fecha futura tipeada en la grilla de Cargas
 *   ABORTA EL LOTE COMPLETO (correcto como todo-o-nada, pero es nuevo en el habito diario; la
 *   grilla queda intacta para corregir y reprocesar). @see FUNCIONALIDADES.md seccion 04.
 *
 * [2026-08-18] v0.11.0 - Swap de hojas Fix: el rediseno de Franco pasa a ser canonico:
 * - CONTEXTO: Franco rediseno la planilla duplicando hojas con sufijo " - Fix" (mas
 *   "Presupuesto - New") y las declaro definitivas. El layout se corrio entero: Plan de
 *   Cuentas reestructurado (bloques C:D/F:G/I:J/L:N/P:Q, headers fila 7, datos fila 8;
 *   "Proyecto" pasa a llamarse "Categoria" y aparecen los tipos generales
 *   Ahorros/Inversiones/Financiacion/Hogar), Cargas con grilla C7:I21, Registros con datos
 *   desde fila 7 y Tipos de Cambio en C:D/F:G/I:J/L:M con datos desde fila 8.
 * - NUEVO MIGRACION_v0.11_SwapHojasFix.js: quinteto estado / sincronizar / aplicar /
 *   revertir / purgar. Aplicar renombra las viejas a "<nombre> (anterior YYYY-MM-DD)" y las
 *   oculta, renombra las Fix a canonicas, repuntea las formulas y reconstruye los dropdowns.
 *   Los respaldos NO se borran: la purga es un paso aparte que exige cero referencias vivas
 *   y confirmacion del operador.
 * - SINCRONIZAR cubre la ventana export->swap: todo lo cargado en las BDs viejas despues de
 *   la duplicacion (movimientos y cotizaciones) se copia a las Fix cruzando por AUSENCIA
 *   (multiconjunto fecha+monto+tipo+cuenta+medio; fechas por dia en TC), nunca por rango.
 *   Filas presentes solo en la Fix abortan el swap: una diferencia no entendida no se pisa.
 * - REPUNTEO SEMANTICO, no textual a ciegas: dos reglas derivadas del censo real de
 *   referencias. (1) Plan viejo: 'Plan de Cuentas'!R:T y !V:W (columnas completas) se
 *   remapean a la posicion nueva de los mismos bloques (L:N y P:Q). (2) Registros: TODAS las
 *   referencias reales son ancladas por fila (B5:M1005, $B$6:$B883...) y la BD nueva corrio
 *   una fila (header 5->6, datos 6->7): se reescriben celda por celda sumando 1 a cada numero
 *   de fila, guardando la formula anterior para el rollback. Toda referencia que ninguna
 *   regla cubre queda apuntando al respaldo y se LISTA en el informe en vez de adivinarse.
 * - El bloque residual C1005:N1033 que el Plan Fix arrastra se mueve a una hoja de CUARENTENA
 *   oculta (getLastRow/appendRow del ABM y los dropdowns lo ingeririan como catalogo). Nada
 *   se borra: la cuarentena queda para decision de Franco.
 * - La columna Y del Plan viejo (consolidacion de cuentas de los 4 bloques, fuente del
 *   dropdown de Cuenta en Cargas) se recrea como columna S del Plan nuevo. La formula se
 *   escribe con ";" y FLATTEN de argumentos multiples (sin array literal) por la trampa de
 *   locale es_AR verificada en vivo (setFormula no traduce separadores), y la escritura se
 *   VERIFICA leyendo la celda. Dropdowns de Cargas reconstruidos (Cuenta -> Plan!S, Medio ->
 *   Plan!L, ambos acotados a la fila 1000) porque las fuentes de Validacion de Datos siguen
 *   al objeto hoja, no al nombre.
 * - Maquina de estados sin callejones: una corrida muerta sin catch (timeout de 6 min, corte
 *   manual) deja estado "en vuelo" y "4. Revertir" la RECONCILIA mirando que hoja quedo con
 *   que nombre; el rollback del catch deshace repunteos ademas de renombres y solo marca
 *   revertido si quedo completo. La comparacion de BDs usa la fila COMPLETA (12 columnas)
 *   como clave y detecta cotizaciones divergentes por fecha: toda diferencia no entendida
 *   frena el swap en vez de pisarse.
 * - 00_Config.js remapeado a la geometria Fix EN EL MISMO RELEASE (regla: config y planilla
 *   cambian juntos). HEADER_ROW/DATA_START_ROW 3/4 -> 7/8; canonico de TC ahora
 *   'Tipos de Cambio' (la grafia vieja queda de alias). Entre el push y aplicarSwapV011 el
 *   sistema queda intencionalmente inconsistente: el swap se corre inmediatamente despues.
 * - RETIRADOS DEL MENU la Migracion v0.9.5 y 'Robustez de vistas': ambos tienen anclas de la
 *   geometria pre-Fix (la v0.9.5 en su preflight contra RANGES; RobustezVistas en su lista
 *   cerrada RV_CELDAS: Tablero!AN4, Inicio!Y4/AM4, Cargas!R5) y post-swap operarian sobre
 *   celdas equivocadas. Los archivos se conservan enteros como historia.
 * - PENDIENTES CONOCIDOS que el swap NO resuelve (fase formulerio, hoja por hoja): la
 *   condicion 'Liquidez' de Inicio quedo huerfana (el tipo ya no existe en la taxonomia
 *   nueva; 'Medio Cotidiano' ahora es 'Hogar'), el Tablero Fix tiene #REF!/#VALUE! y su
 *   columna 'Valor en ARS' esta en ceros sin formula, Presupuesto es un cascaron sin motor,
 *   el calendario de Inicio es estatico, y 07_MiradaInteranual espera anclajes viejos (su
 *   preflight bloquea sin escribir). Detalle en docs/permanente/FUNCIONALIDADES.md.
 *
 * ---
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
