/**
 * 98_DevTools_Scanner.js
 * MODULO DEVTOOLS: Scanner de Arquitectura Total (gemelo digital)
 *
 * [CONCEPTO DE NEGOCIO]
 * Herramienta de auditoria interna. Produce el "gemelo digital" de la planilla:
 * un JSON con el 100% de las celdas que tienen valor o formula, mas la metadata
 * estructural de cada hoja. Con ese archivo, cualquier sesion (humana o IA) sabe
 * exactamente que hay en cada celda -- donde estan las BDs, los filtros y las
 * formulas -- sin abrir la planilla ni pedirle a nadie que mire.
 *
 * [FUNDAMENTO TEORICO / ADMINISTRATIVO]
 * Trata a Google Sheets como "Infrastructure as Code": el estado vivo se
 * congela en un artefacto versionable, y todo cambio posterior se prueba por
 * diff celda por celda contra el snapshot anterior. El criterio de no-daño no
 * es "quedo bien" sino "cero formulas modificadas fuera de lo esperado y las
 * celdas que desaparecieron son exactamente las esperadas, sin resto".
 * La planilla viva es la unica verdad del estado; este JSON es su evidencia.
 *
 * @see docs/permanente/MAPA_ARQUITECTURA_PLANILLA.md
 * @see docs/permanente/ARNES_TIDETRACK.md (Fase 2 - Gemelo digital)
 *
 * @version 0.8.4
 * @since 0.4.0
 * @lastModified 2026-08-13
 */

// decision Franco 2026-08-13: cobertura total de celdas; el filtro r<5 dejaba ciegas a las BDs (Fase 2 arnes).
// La version anterior mapeaba solo formulas y las primeras 5 filas de valores:
// del ledger de Registros (~2879 filas) el snapshot de 2026-03-23 trajo 44 celdas.
// Para que el JSON no explote de tamano sin ese filtro se compensa por dos lados:
//   1. el estilo se serializa solo cuando difiere del default de Sheets;
//   2. la notacion A1 se calcula en memoria (antes: una llamada a la API por celda).

// decision Franco 2026-08-13: se agrega getDisplayValues() como septima extraccion masiva.
// Sin ella el gemelo quedaba CIEGO al valor calculado de toda celda con formula
// (getValues() lo trae, pero el volcado lo descartaba), y las hojas que son casi
// 100% formula -- Tablero, CALCU, ANUAL, Inicio, los hidden engines del ADR-006 --
// se serializaban sin un solo numero. Contrato de celda resultante:
//   valor          -> valor crudo si NO hay formula, null si la hay (se conserva tal cual
//                     estaba, para no romper a los consumidores del formato viejo);
//   formula        -> string o null;
//   valor_mostrado -> texto tal como se ve en pantalla. Unico lugar donde viven los
//                     errores de runtime (#REF!, #N/A, #DIV/0!, #VALUE!);
//   estilo         -> opcional, solo lo que difiere del default.
// El snapshot de marzo 2026 (formato viejo) NO tiene valor_mostrado: todo consumidor
// (generadores de TSV, diff de no-daño) debe tolerar su ausencia, nunca asumirlo.

// LIMITACION CONOCIDA (heredada del molde de pymes, documentada en el arnes):
// desde v0.8.4, con valor_mostrado, los errores de runtime SI son detectables: un
// #N/A de VLOOKUP, un #DIV/0!, un #VALUE! o un IMPORTRANGE caido aparecen como texto
// en ese campo, y se buscan ahi al analizar el JSON. Lo que sigue SIN venir es:
//   1. las validaciones de datos (data validation) de cada celda. Si se necesitan,
//      se suman como dimension propia con una extraccion masiva mas
//      (getDataValidations), nunca celda por celda;
//   2. el TIPADO del error: valor_mostrado trae la cadena '#N/A', no el errorValue
//      de la API, asi que el analisis es por texto y no distingue un error real de
//      una celda que contiene literalmente ese texto;
//   3. el origen de las celdas de spill de ARRAYFORMULA: getFormulas() devuelve ''
//      en ellas, asi que se serializan como valores literales, indistinguibles de
//      datos tipeados a mano (afecta al bloque "Categorias" de Plan de Cuentas).

// Estilo default de Sheets: si la celda lo tiene, no se serializa.
const SCANNER_DEFAULT_FONDO = '#ffffff';
const SCANNER_DEFAULT_TEXTO = '#000000';
const SCANNER_DEFAULT_NEGRITA = 'normal';
const SCANNER_DEFAULT_TAMANO = 10;

/**
 * Convierte fila/columna (1-indexed) a notacion A1 sin llamadas a la API.
 * Reemplaza a getRange(r, c).getA1Notation(), que costaba un round-trip por celda
 * y hacia inviable la cobertura total sobre una hoja de miles de filas.
 *
 * @param {number} fila Fila 1-indexed
 * @param {number} col Columna 1-indexed
 * @return {string} Referencia A1 (ej: 'I3', 'AA120')
 */
function _refA1(fila, col) {
  let letras = '';
  while (col > 0) {
    letras = String.fromCharCode(65 + ((col - 1) % 26)) + letras;
    col = Math.floor((col - 1) / 26);
  }
  return letras + fila;
}

/**
 * Escanea TODAS las hojas de la planilla activa y exporta el gemelo digital a Drive.
 *
 * Contrato de nombre: MENU_CONFIG (00_Config.js) invoca esta funcion por su nombre
 * exacto ('[DevTools] Exportar Arquitectura' -> exportarArquitecturaTotal).
 * No renombrarla sin actualizar MENU_CONFIG en el mismo commit.
 *
 * No hardcodea nombres de hoja: itera ss.getSheets(), asi que descubre hojas
 * nuevas, renombradas u ocultas por si mismo. Eso es justamente lo que resuelve
 * la incertidumbre sobre el estado de la planilla posterior a marzo 2026.
 *
 * Cada hoja queda indexada por nombre Y por gid (getSheetId(), inmutable ante
 * renombres). Sin el gid un renombre es indistinguible de un borrado + una creacion
 * y el diff de no-daño reporta una hoja entera destruida mas una hoja entera nueva.
 * El gid tambien salda la deuda de MAPA_HOJAS.md ("GID pendiente de re-mapeo").
 *
 * RIESGO DE TIEMPO DE EJECUCION: Apps Script corta a los 6 minutos. La estimacion
 * -- NO verificada todavia contra Sheets, la primera corrida real es la que decide --
 * es que con ~15 hojas y un ledger de ~2879 filas entra: cada hoja cuesta siete
 * llamadas masivas (una por dimension) y el resto es CPU en memoria, sobre una
 * superficie de ~275.000 celdas de grilla segun el snapshot de marzo 2026. Si la
 * corrida se corta, el log de progreso de abajo dice en que hoja murio; recien ahi
 * tiene sentido evaluar particionar por hoja. No se agrega paginacion preventiva:
 * la prioridad es que UNA corrida produzca el snapshot completo.
 */
function exportarArquitecturaTotal() {
  const inicioMs = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojas = ss.getSheets();

  const arquitectura = {
    fecha_exportacion: new Date().toISOString(),
    id_planilla: ss.getId(),
    nombre_planilla: ss.getName(),
    // Alcance exacto de 'total': toda celda con valor o formula, con su valor mostrado.
    // NO incluye la celda que solo tiene estilo y ningun contenido (la hoja PALETAS es
    // literalmente eso), y el estilo se serializa solo cuando difiere del default.
    cobertura: 'total',
    hojas: {}
  };

  _toastScanner(ss, 'Iniciando escaneo de cobertura total...', 3);
  // decision Franco 2026-08-13: se loguea con console.log y no con logInfo/logSuccess
  // de 02_Utils.js (convencion del repo) porque esos helpers arrastran un caracter
  // no-ASCII huerfano (variation selector U+FE0F en 02_Utils.js) y este modulo debe
  // quedar 100% ASCII por la regla de gobernanza 4. Volver a la convencion apenas se
  // limpie 02_Utils.js en su propia pieza.
  console.log('Scanner: ' + hojas.length + ' hojas a escanear en "' + ss.getName() + '".');

  hojas.forEach(function (hoja) {
    const nombre = hoja.getName();
    const lastRow = hoja.getLastRow();
    const lastCol = hoja.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      arquitectura.hojas[nombre] = {
        meta: {
          // gid/indice tambien en la rama vacia: una hoja vacia renombrada tiene que
          // seguir siendo la misma hoja para el diff.
          gid: hoja.getSheetId(),
          indice: hoja.getIndex(),
          filas_totales: lastRow,
          columnas_totales: lastCol,
          filas_congeladas: hoja.getFrozenRows(),
          columnas_congeladas: hoja.getFrozenColumns(),
          es_oculta: hoja.isSheetHidden(),
          reglas_condicionales_qty: hoja.getConditionalFormatRules().length,
          celdas_con_dato: 0
        },
        encabezados: [],
        mapa_celdas: {}
      };
      console.log('Scanner: hoja vacia "' + nombre + '" (0 celdas).');
      return;
    }

    const rango = hoja.getRange(1, 1, lastRow, lastCol);

    // Extracciones masivas: una llamada por dimension por hoja, nunca una por celda.
    const formulas = rango.getFormulas();
    const values = rango.getValues();
    const displays = rango.getDisplayValues();
    const backgrounds = rango.getBackgrounds();
    const fontColors = rango.getFontColors();
    const fontWeights = rango.getFontWeights();
    const fontSizes = rango.getFontSizes();

    const mapaCeldas = {};
    let celdasConDato = 0;

    for (let r = 0; r < lastRow; r++) {
      for (let c = 0; c < lastCol; c++) {
        const formula = formulas[r][c];
        const valor = values[r][c];
        const mostrado = displays[r][c];
        const tieneValor = valor !== '' && valor !== null;

        // Cobertura total: sin filtro de filas. Solo se saltea la celda vacia de verdad.
        if (!formula && !tieneValor) continue;

        const celda = {
          valor: formula ? null : valor,
          formula: formula || null
        };

        // decision Franco 2026-08-13: valor_mostrado se emite SIEMPRE que aporte, y el
        // criterio de "aporta" es distinto segun haya formula o no:
        //   - con formula: siempre, incluso vacio. Es el unico registro del resultado
        //     calculado y de los errores de runtime; un '' significa "la formula no
        //     muestra nada", que es informacion real y no ausencia de dato.
        //   - sin formula: solo si difiere del valor crudo, o sea cuando lo unico que
        //     agrega es el FORMATO (fecha localizada, moneda, porcentaje). Duplicar el
        //     texto identico en ~275.000 celdas engordaria el JSON sin decir nada nuevo.
        // Efecto colateral util: en las fechas, valor_mostrado conserva el dia tal como
        // se ve en la planilla, mientras que valor viaja a ISO UTC al serializar (la
        // cicatriz 7 del arnes: despues de las 21:00 ART el ISO cae al dia siguiente).
        if (formula) {
          celda.valor_mostrado = mostrado;
        } else if (mostrado !== String(valor)) {
          celda.valor_mostrado = mostrado;
        }

        // Estilo: solo las propiedades que difieren del default de Sheets.
        const estilo = {};
        if (backgrounds[r][c] !== SCANNER_DEFAULT_FONDO) estilo.fondo = backgrounds[r][c];
        if (fontColors[r][c] !== SCANNER_DEFAULT_TEXTO) estilo.texto = fontColors[r][c];
        if (fontWeights[r][c] !== SCANNER_DEFAULT_NEGRITA) estilo.negrita = fontWeights[r][c];
        if (fontSizes[r][c] !== SCANNER_DEFAULT_TAMANO) estilo.tamano = fontSizes[r][c];
        if (Object.keys(estilo).length > 0) celda.estilo = estilo;

        mapaCeldas[_refA1(r + 1, c + 1)] = celda;
        celdasConDato++;
      }
    }

    arquitectura.hojas[nombre] = {
      meta: {
        // gid: identidad estable de la hoja. El nombre puede cambiar; el gid no.
        // Es lo que permite al diff distinguir "hoja renombrada" de "hoja borrada +
        // hoja nueva", y lo que salda el "GID pendiente de re-mapeo" de MAPA_HOJAS.md.
        gid: hoja.getSheetId(),
        indice: hoja.getIndex(),
        filas_totales: lastRow,
        columnas_totales: lastCol,
        filas_congeladas: hoja.getFrozenRows(),
        columnas_congeladas: hoja.getFrozenColumns(),
        es_oculta: hoja.isSheetHidden(),
        reglas_condicionales_qty: hoja.getConditionalFormatRules().length,
        celdas_con_dato: celdasConDato
      },
      // encabezados: fila 1 cruda. NO es el header semantico: en esta planilla los
      // headers reales viven mas abajo (Registros fila 2, Plan de Cuentas fila 3,
      // Cargas fila 4). El header semantico lo declara 00_Config.js, no el scanner.
      encabezados: values[0] || [],
      mapa_celdas: mapaCeldas
    };

    // Log de progreso por hoja: si la corrida se corta por el limite de 6 minutos,
    // esto deja registro de hasta donde llego.
    const seg = Math.round((Date.now() - inicioMs) / 1000);
    console.log('Scanner: "' + nombre + '" -> ' + celdasConDato + ' celdas con dato (' + seg + 's acumulados).');
    _toastScanner(ss, 'Escaneada: ' + nombre + ' (' + celdasConDato + ' celdas)', 1);
  });

  const jsonStr = JSON.stringify(arquitectura, null, 2);
  const nombreArchivo = 'TIDETRACK_ARQUITECTURA_ESTRICTA.json';

  // Buscar si ya existe y borrarlo para no llenar el Drive de snapshots viejos.
  const archivosPrevios = DriveApp.getFilesByName(nombreArchivo);
  while (archivosPrevios.hasNext()) {
    archivosPrevios.next().setTrashed(true);
  }

  const archivo = DriveApp.getRootFolder().createFile(nombreArchivo, jsonStr, MimeType.PLAIN_TEXT);
  const pesoMb = Math.round((jsonStr.length / 1024 / 1024) * 100) / 100;
  const totalCeldas = Object.keys(arquitectura.hojas).reduce(function (acc, k) {
    return acc + arquitectura.hojas[k].meta.celdas_con_dato;
  }, 0);
  const duracionSeg = Math.round((Date.now() - inicioMs) / 1000);

  // El ID de Drive es lo que necesita una sesion de Claude Code para bajar el
  // archivo sin abrir la planilla: se loguea explicito, no solo la URL.
  console.log('Arquitectura exportada. Cobertura total.');
  console.log('Hojas: ' + Object.keys(arquitectura.hojas).length + ' | Celdas con dato: ' + totalCeldas);
  console.log('Peso: ' + pesoMb + ' MB | Duracion: ' + duracionSeg + 's');
  console.log('ID de Drive: ' + archivo.getId());
  console.log('URL de descarga directa: ' + archivo.getUrl());

  try {
    SpreadsheetApp.getUi().alert(
      'Arquitectura exportada (cobertura total).\n\n' +
      'Archivo: ' + nombreArchivo + '\n' +
      'Hojas: ' + Object.keys(arquitectura.hojas).length + '\n' +
      'Celdas con dato: ' + totalCeldas + '\n' +
      'Peso: ' + pesoMb + ' MB\n' +
      'Duracion: ' + duracionSeg + 's\n\n' +
      'ID de Drive: ' + archivo.getId() + '\n' +
      'URL: ' + archivo.getUrl()
    );
  } catch (e) {
    // Sin contexto UI (ejecucion desde el editor o por trigger): el log alcanza.
  }
}

/**
 * Toast defensivo: el scanner tambien corre desde el editor, donde no hay UI.
 * @param {Spreadsheet} ss Planilla activa
 * @param {string} mensaje Texto del toast
 * @param {number} segundos Duracion
 */
function _toastScanner(ss, mensaje, segundos) {
  try {
    ss.toast(mensaje, 'DevTools', segundos);
  } catch (e) {
    // Ignorar: sin contexto UI no hay toast, y el escaneo no depende de el.
  }
}
