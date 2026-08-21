/**
 * devtools/probar_riqueza.js
 * Banco de pruebas de DEVTOOL_RiquezaYCategorias.js.
 *
 * Corre las transformaciones REALES del modulo contra las formulas REALES de la planilla,
 * llevadas antes a su estado post-formulerio (porque el gemelo se exporto ANTES de esa
 * reparacion). Muestra el antes y el despues de cada celda para poder mirarlo con los ojos.
 *
 * Existe por la misma cicatriz que probar_formulerio.js: la v0.12.0 escribio formulas que no
 * parseaban porque nadie corrio las transformaciones contra una entrada real antes de deployar.
 *
 * CICATRIZ DEL 2026-08-21: una celda declarada (Tablero!AA9, Tablero!N19) que perdio su formula
 * porque el Tablero se reacomodo se leia como "sin snapshot" y el banco seguia de largo SIN
 * marcar falla -- el mismo agujero que se corrigio en probar_stock_flujo.js el mismo dia. "La
 * celda que el modulo declara administrar no tiene formula" es una senal, no un estado benigno:
 * ahora CUALQUIER declaracion de RIQ_CELDAS o RIQ_BLOQUE_CATEGORIAS sin formula viva es FALLA, y
 * el mensaje dice que hay hoy en su lugar (rotulo o valor) para no tener que ir a mirar el gemelo
 * a mano. De paso, `_conTipoEnCategorias` se probaba solo con una formula viva de verdad: ahora
 * tambien se prueba que sobrevive a una celda sin formula sin explotar (ver seccion 2).
 *
 * USO:  node devtools/probar_riqueza.js       (exit 0 si pasa, 1 si algo sale invalido)
 *
 * @version 0.14.0
 * @since 2026-08-19
 * @see src/DEVTOOL_RiquezaYCategorias.js
 */
const fs=require('fs'), vm=require('vm'), path=require('path');
// La raiz se deriva de la ubicacion de ESTE archivo, no se hardcodea. Hasta el 2026-08-21 era la
// ruta absoluta de un worktree concreto: correr el banco desde cualquier otro leia el src de ese
// worktree y validaba codigo que no era el que se estaba editando.
const RAIZ=path.resolve(__dirname,'..');
const ctx={console,
  MONEDAS_DISPONIBLES:['ARS','USD','AUD','EUR'], TIPOS_RIQUEZA:['Ahorros','Inversiones'],
  NAV_CONFIG:{SHEETS:{INICIO:'Inicio',TABLERO:'Tablero'}},
  RANGES:{REGISTROS:{sheet:'Registros',start:'B',end:'M',headerRow:6,dataRow:7,
    columns:{monto:'B',tipo:'C',cuenta:'D',tipo_cuenta:'E',medio:'F',moneda:'G',fecha:'H',nota:'I',tc_ars:'J',tc_usd:'K',tc_aud:'L',tc_eur:'M'}},
    PROYECTOS:{sheet:'Plan de Cuentas',start:'P',end:'Q',columns:{nombre:'P',tipo:'Q'}}},
  columnLetterToIndex(l){let i=0;for(let k=0;k<l.length;k++)i=i*26+(l.charCodeAt(k)-64);return i;},
  columnIndexToLetter(n){let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;},
  getDataRow:c=>c.dataRow||8, logInfo(){},logError(){},logSuccess(){},
  SpreadsheetApp:{},PropertiesService:{},Utilities:{},Session:{},Logger:{log(){}}};
vm.createContext(ctx);
const src = fs.readFileSync(path.join(RAIZ,'src/DEVTOOL_FormulerioV0111.js'),'utf8')
          + '\n' + fs.readFileSync(path.join(RAIZ,'src/DEVTOOL_RiquezaYCategorias.js'),'utf8')
          + '\n;Object.assign(globalThis,{FORM_CELDAS,RIQ_CELDAS,RIQ_BLOQUE_CATEGORIAS});';
vm.runInContext(src, ctx);

// F: formula viva por celda. V: VALOR vivo por celda (formula o literal) -- para poder decir QUE
// hay hoy en una celda que perdio su formula, no solo que la perdio.
const tsv=fs.readFileSync(path.join(RAIZ,'docs/permanente/celdas.tsv'),'utf8').split('\n');
const F={}, V={};
for(const l of tsv){
  const p=l.split('\t'); if(p.length<4) continue;
  const clave=p[0]+'!'+p[1];
  if(p[2]) F[clave]=p[2].replace(/\\\\/g,'\x00').replace(/\\n/g,'\n').replace(/\x00/g,'\\');
  if(p[3]) V[clave]=p[3];
}
/** Que hay HOY en una celda, para el mensaje de falla ("y que se encontro en su lugar"). */
function queHayEn(clave){
  if(V[clave]) return 'hoy tiene "'+V[clave]+'"';
  return 'esta vacia';
}
const pre={anclas:ctx._anclasMotorTablero(), nombreInicio:'Inicio', nombreTablero:'Tablero'};
// llevar cada formula a su estado POST-formulerio, que es contra el que corre este modulo
function viva(clave){
  const spec=ctx.FORM_CELDAS.find(s=>((s.hoja==='INICIO'?'Inicio':'Tablero')+'!'+s.celda)===clave);
  return spec ? ctx._repararFormula(F[clave],spec,pre) : F[clave];
}
let fallas=0;
function chequear(n,d,exig){
  const p=[];
  if(/\$N\$N/.test(d)) p.push('firma $N$N del bug de escape');
  if(/#REF!/.test(d)) p.push('quedo #REF!');
  if(exig.sinListaNegra && /tipos_proy\s*<>\s*"Hogar"/.test(d)) p.push('sigue con lista negra');
  let dep=0,str=false;
  for(const ch of d){ if(ch==='"')str=!str; else if(!str&&ch==='(')dep++; else if(!str&&ch===')')dep--; if(dep<0)break; }
  if(dep!==0)p.push('parentesis desbalanceados ('+dep+')');
  if(str)p.push('comillas sin cerrar');
  if(p.length){fallas++;console.log('\n### FALLA '+n+': '+p.join(', '));console.log(d);}
  return !p.length;
}
console.log('=== 1. RIQ_CELDAS: retirada el 2026-08-21, tiene que seguir vacia ===');
// GUARD DE RETIRADA. Las seis coordenadas salieron por decision de Franco (cada una tiene otro
// duenio; ver la cabecera de DEVTOOL_RiquezaYCategorias.js). Que la lista este vacia se AFIRMA,
// no se asume: si alguien vuelve a agregar una celda aca, tiene que ser una decision consciente y
// este banco la obliga a pasar por sus chequeos en vez de entrar sin que nadie mire.
if(!ctx.RIQ_CELDAS.length){
  console.log('  OK  RIQ_CELDAS vacia: el modulo no declara administrar ninguna celda de riqueza');
} else {
  // NO es un aviso: es FALLA, y es una FALLA DELIBERADA. El loop de abajo sigue verificando cada
  // entrada una por una, asi que la celda nueva SI se revisa -- lo que esta falla agrega es que
  // reponer una coordenada retirada no pueda pasar en silencio. Las seis salieron el 2026-08-21
  // porque cada una tiene otro duenio; volver a poner una es reabrir esa decision, y tiene que
  // costar una linea roja que obligue a justificarlo.
  fallas++;
  console.log('  ### FALLA RIQ_CELDAS volvio a tener '+ctx.RIQ_CELDAS.length+' entrada(s) ('+
    ctx.RIQ_CELDAS.map(function(x){return x.hoja+'!'+x.celda;}).join(', ')+'). Se retiraron el '+
    '2026-08-21 por decision de Franco: cada una tiene hoy otro duenio. Si vuelve a ser de este '+
    'modulo, actualizar la cabecera de DEVTOOL_RiquezaYCategorias.js y este guard en el mismo cambio.');
}
// _aListaBlanca se conserva y se prueba como REGRESION, con una entrada sintetica: la
// transformacion tiene que seguir siendo correcta aunque hoy no se aplique a ninguna celda viva.
{
  const sintetica='=LET(cond; (tipos_proy<>"Hogar") * (tipos_proy<>"") > 0; SUM(cond))';
  const t=ctx._aListaBlanca(sintetica);
  if(t===sintetica){fallas++;console.log('  ### FALLA _aListaBlanca ya no transforma la forma que declara transformar');}
  else if(/tipos_proy<>"Hogar"/.test(t)){fallas++;console.log('  ### FALLA _aListaBlanca dejo la lista negra puesta: '+t);}
  else console.log('  OK  _aListaBlanca sigue convirtiendo lista negra -> lista blanca (regresion)');
}
for(const spec of ctx.RIQ_CELDAS){
  const clave=(spec.hoja==='INICIO'?'Inicio':'Tablero')+'!'+spec.celda;
  const antes=viva(clave);
  if(!antes){
    fallas++;
    console.log('  ### FALLA (sin formula) '+clave+' ('+spec.nota+'): '+queHayEn(clave)+
      '. RIQ_CELDAS declara administrar esta celda y no hay nada que reescribir.');
    continue;
  }
  const desp=ctx._aListaBlanca(antes);
  if(desp===antes){console.log('  !!! SIN CAMBIO: '+clave+' -- el patron no matcheo');fallas++;continue;}
  if(chequear(clave,desp,{sinListaNegra:true})){
    const l=desp.split('\n').find(x=>/cond_riqueza|cond_ahorro/.test(x));
    console.log('  OK  '+clave.padEnd(14)+(l?l.trim():''));
  }
}
console.log('\n=== 2. El bloque de categorias (AA10): retirado, su duenio es BloqueCategorias ===');
// decision Franco 2026-08-21, duenio unico: AA10 la declaraban TRES modulos. Gana
// DEVTOOL_BloqueCategorias.js (unico con trabajo vigente ahi). Este banco dejo de exigir que la
// celda viva tenga la forma que ESTE modulo esperaba -- exigirlo era pedirle a una celda ajena que
// se comporte como propia, y producia una FALLA permanente que no significaba nada.
const claveCat='Tablero!'+ctx.RIQ_BLOQUE_CATEGORIAS.celda;
// (a) La seguridad ante entrada vacia se conserva: es la cicatriz del 2026-08-21.
if(ctx._conTipoEnCategorias(undefined)!==undefined || ctx._conTipoEnCategorias('')!==''){
  fallas++; console.log('  ### FALLA _conTipoEnCategorias no es segura ante entrada vacia/undefined');
} else {
  console.log('  OK  _conTipoEnCategorias(undefined) y (\'\') no explotan (devuelven la entrada intacta)');
}
// (b) La transformacion historica ya esta APLICADA en la celda viva: se afirma por su invariante
//     (no queda el nombre viejo de la variable), no re-corriendola. Eso es lo que de verdad
//     importa despues de la retirada, y es exactamente lo que el "SIN CAMBIO" queria decir.
const vivaCat=F[claveCat];
if(!vivaCat){
  fallas++;
  console.log('  ### FALLA '+claveCat+' no tiene formula viva: '+queHayEn(claveCat)+
    '. Aunque el duenio sea otro modulo, esa celda tiene que tener su formula.');
} else if(/columna_ak_vacia/.test(vivaCat)){
  fallas++;
  console.log('  ### FALLA '+claveCat+' todavia tiene el nombre viejo "columna_ak_vacia": la '+
    'transformacion historica NO estaba aplicada y este modulo era el unico que la hacia.');
} else {
  console.log('  OK  '+claveCat+' ya no tiene "columna_ak_vacia": la transformacion historica esta aplicada');
}
// (c) Regresion de _conTipoEnCategorias contra una entrada sintetica con la forma vieja.
{
  const sint='=LET(columna_ak_vacia; A1:A; SUM(columna_ak_vacia))';
  const t=ctx._conTipoEnCategorias(sint);
  if(/columna_ak_vacia/.test(t)){fallas++;console.log('  ### FALLA _conTipoEnCategorias ya no renombra la variable vieja');}
  else console.log('  OK  _conTipoEnCategorias sigue renombrando columna_ak_vacia -> columna_tipo (regresion)');
}

console.log('\n=== 3. Idempotencia ===');
let ni=0;
for(const spec of ctx.RIQ_CELDAS){
  const clave=(spec.hoja==='INICIO'?'Inicio':'Tablero')+'!'+spec.celda;
  if(!F[clave])continue;   // sin formula: ya se marco FALLA en la seccion 1, aca no hay nada que reaplicar
  const a=ctx._aListaBlanca(viva(clave)); if(a!==ctx._aListaBlanca(a)){console.log('  NO IDEMPOTENTE '+clave);ni++;}
}
// Las dos transformaciones ya no se aplican a ninguna celda viva de este modulo, asi que la
// idempotencia se prueba sobre entradas sinteticas: re-aplicar sobre lo ya transformado no puede
// cambiar nada. Es la propiedad que importa si alguna de las dos vuelve a usarse.
{
  const t1=ctx._aListaBlanca('=LET(cond; (tipos_proy<>"Hogar") * (tipos_proy<>"") > 0; SUM(cond))');
  if(t1!==ctx._aListaBlanca(t1)){console.log('  NO IDEMPOTENTE _aListaBlanca');ni++;}
  const t2=ctx._conTipoEnCategorias('=LET(columna_ak_vacia; A1:A; SUM(columna_ak_vacia))');
  if(t2!==ctx._conTipoEnCategorias(t2)){console.log('  NO IDEMPOTENTE _conTipoEnCategorias');ni++;}
}
console.log(ni===0?'  OK  todas idempotentes':'  '+ni+' no idempotentes');
console.log('\n'+(fallas+ni===0?'===> SIN FALLAS':'===> '+(fallas+ni)+' FALLA(S)'));
process.exit(fallas+ni===0?0:1);
