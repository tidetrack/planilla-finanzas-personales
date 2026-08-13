# ARNES TIDETRACK — paquete de arranque para planilla-finanzas-personales

> **Qué es este documento.** El destilado ejecutable de todo el arnés de gestión
> inteligente construido en `planilla-pymes` (repo hermano) durante la campaña
> Castellino (v1.9 → v1.47, jul-ago 2026): gemelo digital por JSON, scanner vivo
> por n8n, gobernanza de repo, contratos de motores, verificación adversarial y
> la metodología de diseño del plan de cuentas. Escrito el 2026-08-12 por pedido
> de Franco para que este repo pueda construirse "con esta facilidad".
>
> **Cómo usarlo.** Una sesión de Claude Code parada en ESTE repo ejecuta las
> fases EN ORDEN. Cada fase cierra con: verificación explícita + commit con la
> convención universal (`tipo(scope): descripción en español`) + changelog dual.
> No se salta a la fase N+1 con la N sin verificar. Las fases 5 y 6 requieren
> decisiones de Franco (marcadas como DECISION); el resto es ejecutable directo.
>
> **Repo de referencia** (todos los paths de abajo son relativos a él):
> `/Users/francodiazpizarro/Desktop/Antigravity/planilla-pymes`

---

## 0. Fuentes de verdad y lecturas obligadas

Antes de escribir una línea, la sesión que ejecute esto lee:

1. **La metodología** (vault Cluster, `/Users/francodiazpizarro/Desktop/Obsidian./Cluster`):
   - `01 REGISTRO/2026-08-12-informe-minado-castellino-indias.md` — metodología
     financiera Tidetrack completa: cómo se diseña un plan de cuentas desde datos
     reales, reglas de derivación, verificación numérica del modelo.
   - `01 REGISTRO/2026-08-12-informe-castellino-implementacion-planilla.md` —
     nivel código de la campaña: contratos, guards, rangos, y el catálogo de
     defectos que la verificación adversarial encontró (las "cicatrices").
2. **El contrato del repo de referencia**: `legacy/CLAUDE.md` de planilla-pymes
   (secciones 5.x: triangulación, cascada FX, contrato de fragmentos, escritura
   remota, espejo, contrato de motores).
3. **La página de producto** de este repo en el vault:
   `04 RECURSOS/productos/Planilla Finanzas.md` (roadmap, decisiones, fricción UX).

Regla permanente heredada: **toda decisión de arquitectura relevante se
documenta en la página de producto del vault** (doble escritura), y en el código
como comentario `// decisión Franco YYYY-MM-DD: <razón>`.

---

## 1. El arnés en una página

El arnés son SEIS componentes que se refuerzan entre sí:

| # | Componente | Qué resuelve | Pieza central |
|---|---|---|---|
| 1 | **Gobernanza de repo** | Que el repo y la planilla nunca diverjan y que cada cambio quede trazado | CLAUDE.md contrato + changelog dual + drift-check pre-push |
| 2 | **Gemelo digital (JSON)** | Que Claude vea cada celda "con los ojos de Franco" sin abrir la planilla | Scanner cobertura total + MAPA semántico + inventario generado |
| 3 | **Estado vivo (n8n)** | Que el gemelo no envejezca: snapshot fresco sin intervención humana | Workflow scanner literal programado |
| 4 | **Contratos de motores** | Que ninguna operación financiera pueda fallar en silencio ni duplicarse | `{ok, cargados, error}` + locks + preflight + respaldo congelado |
| 5 | **Centro de Operaciones** | Que el operador nunca necesite tocar la hoja para operar | Shell con router + fragmentos con contrato |
| 6 | **Metodología del plan** | Que el catálogo salga de la operación real, no de un nomenclador teórico | Minado de histórico + reglas de naturaleza |

El principio unificador, aprendido a los golpes: **la planilla productiva es la
única verdad del estado; el repo es la única verdad del código; el vault es la
única verdad de las decisiones.** Todo el arnés existe para mantener esas tres
verdades sincronizadas de forma verificable.

---

## 2. Fase 0 — Reconciliación (drift primero, siempre)

Este repo YA tiene drift al momento de escribir esto: el clon local quedó en
`0dfacea` (v0.8.0) mientras `origin/main` está en `6af54fd` (v0.9.4), con WIP
local sin commitear (`docs/permanente/MAPA_HOJAS.md` modificado + 3 docs sin
trackear + `notas fran.md`). Y la planilla productiva puede estar adelante del
repo (en pymes ese drift casi cuesta un módulo entero en producción).

Pasos:

1. **Checkpoint del WIP local**: commitear lo local coherente en una rama
   (`wip/pre-arnes`) o stashear con nombre. Nada se pierde, nada se pisa.
2. **Reconciliar con origin**: `git fetch` + merge/rebase de main. Si hay
   conflicto en docs, gana el más nuevo y se anota.
3. **Drift-check contra la planilla**: `clasp pull` a un directorio temporal
   (NUNCA sobre `src/`) y comparación archivo por archivo contra el repo. Si el
   remoto está adelante: adoptar el remoto como baseline verbatim en un commit
   propio (`chore: sync desde produccion`) ANTES de cualquier cambio.
   Referencia del procedimiento: en pymes, `legacy/CLAUDE.md` regla anti-drift.
4. **Identidades**: confirmar y registrar `scriptId` (está en `.clasp.json`) y
   `sheets_id` de la planilla productiva (HOY figura `pendiente-confirmar` en la
   página de producto del vault — cerrarlo acá). Crear `targets.yaml` en la raíz:

   ```yaml
   # Fuente única de targets de deploy (equivalente a clients/*.yaml de pymes)
   targets:
     - nombre: personal
       estado: activo
       script_id: "<del .clasp.json>"
       sheet_id: "<confirmar>"
   ```

Cierre de fase: repo == origin == planilla, identidades registradas, commit.

---

## 3. Fase 1 — Gobernanza

Portar el sistema de reglas de pymes, adaptado. Son ocho piezas:

1. **CLAUDE.md contrato** — reescribir el CLAUDE.md de este repo con la
   estructura del `legacy/CLAUDE.md` de pymes: qué vive acá, comandos, archivos
   bajo jurisdicción, modelo de datos (el de ESTE repo: headers fila 3, datos
   fila 4, tablas I:J / L:M / O:P / R:T / V:W), lógica crítica, reglas
   inquebrantables, cuándo no actuar. Conservar lo que ya está bien del CLAUDE.md
   actual (esquema, ADRs) — es actualización, no borrón.
2. **Changelog dual obligatorio**: todo cambio a `src/` actualiza
   `ZZ_Changelog.js` (al tope, SemVer) Y `docs/permanente/CHANGELOG.md` (o el
   HISTORIAL que se defina). Sin esto la tarea NO está cerrada.
3. **Decisiones inline**: `// decisión Franco YYYY-MM-DD: <razón>` en cada
   elección estructural. Son el changelog real dentro del código.
4. **Cero emojis** en código, UI, logs, commits, docs.
5. **Cabecera de contexto** en todo archivo nuevo: `[CONCEPTO DE NEGOCIO]` +
   `[FUNDAMENTO TEORICO / ADMINISTRATIVO]` + `@see`.
6. **SSOT en 00_Config.js**: nombres de hoja y rangos SIEMPRE vía config, nunca
   hardcodeados (este repo ya lo hace con SHEETS/RANGES — mantenerlo y agregar
   `_resolverNombreHoja(alias)` de pymes `legacy/src/00_Config.js` para
   renombres de pestañas sin ventana de rotura; política: si conviven nombre
   nuevo y viejo, gana el histórico, el que tiene los datos).
7. **Deploy con red** — portar `legacy/sync_clients.command` como
   `sync_targets.command`: lee `targets.yaml`, muestra qué va a pushear, pide
   confirmación, `clasp push -f` por target, `trap` que restaura `.clasp.json`
   ante interrupción, exit 1 si algo falla. Aunque hoy haya UN solo target: la
   red vale desde el primer día y el multi-target queda gratis. `npm run sync`
   en watch queda solo para desarrollo contra un sandbox declarado.
8. **Drift-check pre-push como hábito**: antes de todo deploy, `clasp pull` a
   temporal y comparar (la planilla puede tener cambios manuales o de otra
   sesión). En pymes esto se ejecutó antes de CADA deploy de la campaña.

Cierre de fase: CLAUDE.md nuevo + script de deploy probado en seco + commit.

---

## 4. Fase 2 — Gemelo digital (JSON)

Objetivo: que cualquier sesión sepa exactamente qué hay en cada celda, dónde
están las BDs, los filtros y las fórmulas, sin abrir la planilla.

1. **Scanner cobertura total** — reemplazar `98_DevTools_Scanner.js` (versión
   vieja) por el port de `legacy/src/devtools/ScannerArquitectura.js` de pymes:
   - TODA celda con valor o fórmula (sin filtro de filas — la versión vieja de
     pymes solo tomaba 5 filas y dejaba ciegas a las BDs).
   - Estilo serializado solo si difiere del default (control de tamaño).
   - Notación A1 calculada en memoria (sin una llamada API por celda).
   - Metadata: nombre_planilla, cobertura, celdas_con_dato por hoja, peso en MB.
   - Salida: `TIDETRACK_ARQUITECTURA_ESTRICTA.json` en Drive → se versiona en
     `docs/permanente/`.
2. **Inventario auto-generado** — portar
   `legacy/devtools/generar_inventario_planilla.py`: del JSON produce
   `INVENTARIO_CELDAS.md` (fórmulas deduplicadas por patrón con sus celdas,
   QUERYs con staging estimado y mapeo columna a columna, matriz de
   dependencias entre hojas, detección de referencias rotas).
3. **MAPA semántico** — escribir `MAPA_ARQUITECTURA_PLANILLA.md` a mano (capa
   curada): qué es cada hoja, celdas de control, bloques de staging, recetas
   para tareas frecuentes. Usar el de pymes
   (`legacy/docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md`) como molde.
4. **TSV aplanado para auditoría** — del JSON generar `celdas.tsv`
   (hoja / celda / fórmula / formattedValue) para auditar con awk/grep sin que
   el JSON entre nunca al contexto de una sesión. Es el método con el que se
   auditó Castellino (volcado de 8,2 MB → TSV indexable).
5. **Diff celda por celda como prueba de no-daño**: después de cualquier cambio
   manual o migración, re-escanear y comparar contra el snapshot previo. El
   criterio de éxito no es "quedó bien" sino "cero fórmulas modificadas fuera
   de lo esperado y las celdas que desaparecieron son exactamente las
   esperadas, sin resto".
6. **Protocolo de actualización** (documentarlo en el MAPA): re-escanear →
   copiar JSON → correr el generador → si cambió la lógica, actualizar el MAPA
   a mano → commitear los tres juntos.

Limitación conocida del scanner (anotarla): no trae validaciones de datos ni
`errorValue` — los `#REF` se buscan por `formattedValue`.

Cierre de fase: primer escaneo completo versionado + inventario + MAPA inicial.

---

## 5. Fase 3 — n8n: estado vivo siempre actualizado

La pieza que pidió Franco explícitamente: "vía JSON y n8n para estar siempre
actualizado a los cambios". El gemelo estático envejece; el workflow lo
refresca solo.

1. **Instancia**: usar el **n8n interno del Cluster** — NO la instancia de
   clientes `n8n-clientes.tidetrack.com.ar` (esa es exclusiva de clientes
   Tidetrack como Castellino; regla de la casa: no mezclar).
2. **Workflow "Scanner literal — Finanzas Personales"**: clonar el patrón del
   workflow `q8eV9R3omEu9R6GI` ("Scanner literal — Castellino (EBA + Socios)")
   de la instancia de clientes: nodos Google Sheets que leen cada hoja de la
   planilla (valores + fórmulas) y arman el volcado literal → JSON al staging
   (Drive o directo al repo vía commit). Programado (cron semanal o a demanda
   vía webhook).
3. **Credencial**: Google Sheets OAuth propia para la cuenta dueña de la
   planilla personal. LECCION CRITICA de Castellino: si la app OAuth del
   proyecto está en modo *Testing*, el refresh token caduca cada 7 días y el
   workflow muere solo — verificar que esté **En producción** antes de
   depender de él.
4. **Consumo**: la sesión de Claude Code lee el último snapshot (JSON/TSV) en
   vez de pedirle a Franco que escanee a mano. El scanner de Apps Script (Fase
   2) queda como método manual de respaldo y para el diff de no-daño.

Cierre de fase: workflow activo, primera ejecución verificada, snapshot
llegando al lugar acordado, y el método documentado en el MAPA.

---

## 6. Fase 4 — Contratos de motores (retrofit del pipeline)

El pipeline de este repo (`06_RegistrosService.procesarCargas`) se retrofitea
con los contratos que en pymes eliminaron clases enteras de errores:

1. **Contrato de resultado**: todo motor devuelve
   `{ok: boolean, cargados?: number, error?: string}` en TODAS las salidas.
   Ningún llamador asume éxito: verifica `res.ok`. Los mensajes de error dicen
   "no se pudo confirmar" — nunca "no se registró" (la falla pudo ser después
   de escribir; afirmar lo contrario invita a reprocesar y duplicar).
2. **DocumentLock en todo motor** que escriba BD, con parámetro `yaConLock`
   para llamadores que ya tienen la sección crítica (el LockService de Apps
   Script NO es reentrante). Siembra + procesamiento = UNA sección crítica.
3. **Preflight que aborta sin tocar nada** + **respaldo congelado antes de
   mutar**: respaldos primero y aplanados a valores (PASTE_VALUES, nombre
   fechado, hoja oculta); recién después el clearContent. Nada de verificar
   después de borrar.
4. **Ingesta tolerante**: la validación de negocio vive en la capa UI/backend
   del formulario, no dentro del motor; el motor persiste lo que llega y la
   auditoría se hace sobre la BD (batch_id).
5. **Gobernanza por fila** (adoptar de pymes si todavía no está): columnas
   batch_id / timestamp / usuario al final de la BD de registros — habilitan
   auditoría y el diff de no-daño.
6. **Migraciones idempotentes**: toda mutación estructural de la planilla es un
   `MIGRACION_vX_Y_Z.js` con bandera en DocumentProperties, funciones
   aplicar / estado ("qué cambiaría", sin escribir) / revertir, expuestas en un
   menú Dev POR HOJA con bloques por versión (lo más nuevo arriba).
7. **Devtools reversibles**: toda herramienta que reescriba fórmulas guarda las
   originales en DocumentProperties (aplicar/revertir/estado) y hace **cirugía
   sobre fórmulas vivas, nunca reescritura completa**, con guard anti-drift que
   verifica la fórmula esperada antes de pisar — recordando que una celda
   VACIA no es drift, es un alta.
8. **Menú por detección**: cada módulo declara qué hojas necesita
   (`MODULOS_*` en config) y el menú solo lo muestra si existen. Un solo código
   sirve para N planillas sin tabla de clientes.
9. **FX**: el motor de este repo ya replica la cascada (live → caché →
   histórico → fallback → 1); asegurar que TODO fallback se loguea y que las
   cotizaciones nuevas se persistan en batch (una inserción, no una por fila).

Cierre de fase: motores con contrato + locks + al menos un test de humo en node
con `SpreadsheetApp` mockeado (patrón banco de pruebas de pymes: capturar todas
las escrituras y fórmulas antes de tocar una planilla real).

---

## 7. Fase 5 — Centro de Operaciones (DECISION de Franco)

Pymes tiene un shell único (modal 1000x760 con router de vistas) desde el que
se opera todo sin tocar la hoja: cargas guiadas, altas, apertura, traspasos,
ABM, conciliación. Las piezas a portar si Franco lo aprueba para personales:

- `legacy/src/00_UI_Estilos.html` — design system compartido (o adaptar el
  neumórfico existente: DECISION — un solo design system, no dos).
- `legacy/src/07_UI_Shell.html` + `07_Backend_AccesosRapidos.js` — shell,
  router, catálogo en un round-trip, cargas guiadas con `_sembrarYProcesar`.
- **Contrato de fragmentos** (pymes `legacy/CLAUDE.md` 5.5): cada vista es un
  fragmento `*_Vista.html` consumido por el shell y por un wrapper standalone;
  sin estilos base propios, init perezoso con guarda, `salirDeVista()` nunca
  `close()`, IDs prefijados. Verificación obligatoria pre-deploy:
  `legacy/devtools/verificar_modales.py` (portarlo).
- El Home agrupado por naturaleza (Registración / Estructura), como quedó en
  pymes v1.41.

Para el objetivo de producto de ESTE repo (registro < 3 segundos, máximo 2
toques), el shell es la base pero NO el techo: la carga guiada de pymes pide 6+
campos; acá el diseño debe partir del principio de fricción mínima (defaults
agresivos, herencia de fila anterior, un toque para repetir el último gasto).

---

## 8. Fase 6 — Plan de cuentas con la metodología Castellino

La metodología completa está en el informe de minado (lectura obligada §0).
Resumen operativo aplicado a finanzas personales:

1. **Minar el histórico propio**: exportar la BD histórica (este repo ya tiene
   `99_MigrationLogic.js` para BD 2024+) a CSV; contar frecuencia de conceptos
   por columna; clasificar cada concepto por NATURALEZA (gasto real / traspaso
   entre cajas / tercero en tránsito); condensar por afinidad; dejar las
   ambigüedades como preguntas numeradas a Franco antes de congelar.
2. **Reglas de diseño que viajan tal cual**:
   - El ingreso es UNO (una cuenta por tipo de ingreso; el desagregado vive en
     los costos/gastos). Verificar el modelo numéricamente con un caso real.
   - Cuentas de Movimientos NEUTRAS (traspasos, apertura, compra-venta USD,
     préstamos entre cajas): no afectan resultado; misma cuenta con signo
     invertido en vez de pares otorgar/devolver.
   - Resultados mínimos obligatorios: `Ajuste por Conciliacion` (si se porta el
     módulo de conciliación, el motor la busca POR NOMBRE — crear la migración
     que la garantiza) y `Diferencia de cambio` (sin ella, en un sistema
     bimonetario la cotización ensucia el margen operativo).
   - Derivación de Proyecto: si la BD de movimientos no lleva proyecto, se
     deriva del medio de pago — entonces cada "bolsillo" con proyecto propio
     necesita medio propio.
   - Nomenclatura con prefijos por bloque (`Ingreso-`, `Gasto-`, `Mov-`,
     `PR-`, prefijo de moneda en medios) aplicada por el sistema, idempotente,
     nunca por el operador.
   - Unidades cerradas (concepto CONFIG.PRORRATEO.unidadesCerradas de pymes):
     si aparece una dimensión que no debe absorber ni aportar estructura
     compartida (el caso FECA), se declara cerrada en config, no se resuelve a
     mano en fórmulas.
3. **Informe de diseño al usuario** (aunque el usuario sea Franco): qué es el
   plan y por qué importa → decisiones de fondo en lenguaje llano → ejemplo
   numérico → tablas de cuentas → consultas abiertas.

---

## 9. Verificación transversal (aplica a TODAS las fases)

1. **Verificación adversarial antes de cada deploy**: agentes refutadores
   independientes con schema de veredicto (`{refuted, bloqueantes[], menores[]}`),
   y la regla emergente de Castellino: la ronda N+1 revisa SOLO las correcciones
   de la ronda N — que son lo que nadie miró todavía. En v1.39 tres rondas
   encontraron defectos de pérdida de datos que ningún test hubiera visto.
2. **Auditoría contra el estado vivo, no contra el repo**: el snapshot del
   scanner (n8n o manual) es la verdad; el diff celda por celda es la prueba.
3. **Sintaxis siempre**: `node --check` en cada .js; verificador de modales si
   hay fragmentos; test de humo en node con mocks para lógica pura (fechas,
   prefijos, generadores de fórmulas — chequear balanceo de comillas y
   paréntesis de toda fórmula generada).
4. **Reporte con autocrítica explícita**: cada entrega separa lo verificado, lo
   que necesita decisión humana y lo que no se puede afirmar ("nadie ejecutó
   este código contra Sheets todavía").

---

## 10. Qué NO portar (y por qué)

- **Espejo IMPORTRANGE + gateway n8n de escritura** (v1.39/v1.40 de pymes): es
  arquitectura multi-planilla epicentro/nodos para clientes con operadores
  separados. Finanzas personales es una sola planilla y un solo operador. Si
  algún día aparece un segundo nodo (ej. planilla compartida de la pareja), el
  runbook completo está en `legacy/docs/permanente/RUNBOOK_ESPEJO_EBA.md` y el
  motor en `legacy/src/MIGRACION_v1.39_EspejoBDs.js` — con la advertencia de
  que el espejo monta SIN filtro (el nodo ve todo el epicentro).
- **Prorrateo de Estructura Compartida entre UEN**: solo si el plan personal
  termina teniendo unidades de negocio reales (ej. "personal" vs "profesional").
  Si aplica, el molde es `legacy/src/06_Panel_ProrrateoUEN.js`.
- **Cronograma de Pagos como hoja**: se construyó y se retiró en pymes
  (v1.46→v1.47) por criterio de producto. Si acá se quiere vista de
  vencimientos, aprender de sus 5 defectos documentados en el changelog de
  pymes (sobre todo: qué guarda cada columna de la BD antes de filtrar, y qué
  significa de verdad cada celda de panel antes de anclarla).

---

## 11. Correspondencia archivo a archivo (pymes → personales)

| Origen (planilla-pymes) | Destino acá | Modo |
|---|---|---|
| `legacy/src/devtools/ScannerArquitectura.js` | `src/98_DevTools_Scanner.js` | Reemplazo (adaptar nombres de hojas) |
| `legacy/devtools/generar_inventario_planilla.py` | `devtools/generar_inventario_planilla.py` | Copia (ajustar paths) |
| `legacy/devtools/verificar_modales.py` | `devtools/verificar_modales.py` | Copia si hay fragmentos (Fase 5) |
| `legacy/sync_clients.command` | `sync_targets.command` | Adaptación (targets.yaml) |
| `legacy/CLAUDE.md` | `CLAUDE.md` | Molde (contenido propio) |
| `legacy/docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md` | `docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md` | Molde (contenido propio) |
| `legacy/src/00_Config.js` (`_resolverNombreHoja`, MODULOS_*, PRORRATEO) | `src/00_Config.js` | Injerto selectivo |
| `legacy/src/00_UI_Estilos.html` + `07_UI_Shell.html` + `07_Backend_AccesosRapidos.js` | Fase 5 | Port por decisión |
| `legacy/src/Carga_Registros.js` (contrato, locks, FX batch, gobernanza) | `src/06_RegistrosService.js` | Retrofit de patrones |
| Patrón `MIGRACION_v*.js` (bandera + aplicar/estado/revertir) | `src/MIGRACION_*.js` | Patrón a adoptar |
| Workflow n8n `q8eV9R3omEu9R6GI` (instancia clientes) | n8n interno Cluster | Clonar patrón, credencial propia |

---

## 12. Cicatrices (por qué cada regla existe)

Estas no son burocracia — cada una costó datos o casi:

1. **Drift repo↔planilla**: pymes estuvo 7 versiones desplegando solo a una
   planilla por usar `clasp push` directo; y el repo estuvo 2 versiones atrás
   de producción — un deploy ciego habría destruido el módulo de Conciliación.
   De ahí: deploy solo por script + drift-check antes de todo push.
2. **BDs huérfanas**: en modo remoto los motores retornaban al confirmar el
   gateway y las BDs locales de EBA quedaron congeladas SIN AVISO — los paneles
   mostraban datos viejos como si fueran verdad. De ahí: toda fuente de datos
   tiene UN dueño explícito, y una hoja con datos propios es un pasivo.
3. **El cero del gateway**: `resultado.cargados || conteoLocal` trataba un cero
   informado como "no vino el dato" y reportaba éxito sobre cero filas — con el
   bloque de cargas ya limpiado. De ahí: cero explícito es fallo, y el chequeo
   va ANTES de limpiar.
4. **Verificar después de borrar**: el preflight original del espejo verificaba
   después del clearContent; los respaldos copiaban fórmulas vivas que se
   recalculaban contra una BD ya espejada (se corrompían solos). De ahí:
   respaldo congelado a valores primero, verificación antes de mutar.
5. **Guard con alert en modo lote = éxito falso**: un guard que aborta con
   alert, dentro de un paquete en modo lote que acepta todo diálogo, se reporta
   como paso exitoso siendo un no-op. Y una celda vacía no es "fórmula
   desconocida": vacío no es drift, es un alta.
6. **`node --check` no alcanza**: dos regresiones reales pasaron la sintaxis —
   una constante borrada con lecturas vivas (ReferenceError en ejecución) y un
   guard sobre una variable declarada 15 líneas después (undefined silencioso).
   De ahí: banco de pruebas con mocks + verificación adversarial.
7. **Fechas y zona horaria**: `toISOString()` corre la fecha un día después de
   las 21:00 en UTC-3, y `setMonth(+1)` sobre un 31 desborda de mes. De ahí:
   fechas locales formateadas a mano, mediodía en vez de medianoche, y clamp al
   fin de mes.
8. **Listas congeladas en HTML**: el ABM de pymes tenía 10 categorías
   hardcodeadas mientras el config declaraba 11 — y agregar la que faltaba sin
   arreglar el backend habría corrompido la hoja. De ahí: toda lista de UI se
   genera desde config, y los guards de escritura son por geometría del bloque
   (colCols), no por lista de excepciones.

---

*Paquete generado desde planilla-pymes v1.47.0 (rama feat/cierre-agosto-compromisos)
el 2026-08-12. Ante cualquier duda entre este documento y el repo de referencia,
gana el repo de referencia — y se corrige este documento en el mismo commit.*
