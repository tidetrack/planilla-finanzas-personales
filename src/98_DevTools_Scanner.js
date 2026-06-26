/**
 * 98_DevTools_Scanner.js
 * MÓDULO DEVTOOLS: Scanner de Arquitectura Total
 * 
 * [CONCEPTO DE NEGOCIO]
 * Herramienta de auditoría interna. Extrae el 100% de la arquitectura 
 * de la planilla a un JSON (fórmulas, estilos, configuración) para generar 
 * "Infrastructure as Code" y documentarlo vía IA.
 */

function exportarArquitecturaTotal() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojas = ss.getSheets();
  const arquitectura = {
    fecha_exportacion: new Date().toISOString(),
    id_planilla: ss.getId(),
    hojas: {}
  };

  try { ss.toast("Iniciando escaneo profundo 100%...", "DevTools", 3); } catch(e){}

  hojas.forEach(hoja => {
    const nombre = hoja.getName();
    const lastRow = hoja.getLastRow();
    const lastCol = hoja.getLastColumn();
    
    if (lastRow === 0 || lastCol === 0) return;

    const rango = hoja.getRange(1, 1, lastRow, lastCol);
    
    arquitectura.hojas[nombre] = {
      meta: {
        filas_totales: lastRow,
        columnas_totales: lastCol,
        filas_congeladas: hoja.getFrozenRows(),
        columnas_congeladas: hoja.getFrozenColumns(),
        es_oculta: hoja.isSheetHidden(),
        reglas_condicionales_qty: hoja.getConditionalFormatRules().length
      },
      encabezados: rango.getValues()[0] || [],
      mapa_celdas: {}
    };

    // Extracciones masivas O(1)
    const formulas = rango.getFormulas();
    const values = rango.getValues();
    const backgrounds = rango.getBackgrounds();
    const fontColors = rango.getFontColors();
    const fontWeights = rango.getFontWeights();
    const fontSizes = rango.getFontSizes();

    // Ventana de captura de valores: primeras 12 filas (headers + algunas filas de datos
    // de muestra). Suficiente para reconciliar layout sin inflar el JSON con todo el ledger.
    const FILAS_MUESTRA = 12;
    for (let r = 0; r < lastRow; r++) {
      for (let c = 0; c < lastCol; c++) {
        // Mapeamos todo header/muestra y todas las formulas para no llenar el JSON de strings vacios
        if (formulas[r][c] || (values[r][c] !== "" && r < FILAS_MUESTRA)) {
           let ref = hoja.getRange(r + 1, c + 1).getA1Notation();
           
           arquitectura.hojas[nombre].mapa_celdas[ref] = {
              valor: formulas[r][c] ? null : values[r][c],
              formula: formulas[r][c] || null,
              estilo: {
                fondo: backgrounds[r][c],
                texto: fontColors[r][c],
                negrita: fontWeights[r][c],
                tamaño: fontSizes[r][c]
              }
           };
        }
      }
    }
  });

  const jsonStr = JSON.stringify(arquitectura, null, 2);
  const nombreArchivo = 'TIDETRACK_ARQUITECTURA_ESTRICTA.json';
  
  // Buscar si ya existe y borrarlo para no llenar el Drive
  const archivosPrevios = DriveApp.getFilesByName(nombreArchivo);
  while(archivosPrevios.hasNext()){
    archivosPrevios.next().setTrashed(true);
  }

  const archivo = DriveApp.getRootFolder().createFile(nombreArchivo, jsonStr, MimeType.PLAIN_TEXT);
  
  console.log("✅ Arquitectura exportada con éxito.");
  console.log("URL de descarga directa: " + archivo.getUrl());
  
  try {
    SpreadsheetApp.getUi().alert("✅ Arquitectura exportada. Revisa la raíz de tu Google Drive para encontrar el archivo '" + nombreArchivo + "'.");
  } catch(e) {
    // Ignorar si no hay contexto UI
  }
}
