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
const RAIZ='/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c';
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
console.log('=== 1. Las 6 celdas de RIQUEZA: lista negra -> lista blanca ===');
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
console.log('\n=== 2. El bloque de categorias (RIQ_BLOQUE_CATEGORIAS) ===');
// La celda se lee de la CONSTANTE, no se hardcodea: si RIQ_BLOQUE_CATEGORIAS.celda se corrige (o
// se corre de nuevo), este banco prueba automaticamente contra la celda correcta.
const claveCat='Tablero!'+ctx.RIQ_BLOQUE_CATEGORIAS.celda;
const a9=viva(claveCat);
let d9;
if(!a9){
  fallas++;
  console.log('  ### FALLA (sin formula) '+claveCat+': '+queHayEn(claveCat)+
    '. RIQ_BLOQUE_CATEGORIAS declara administrar esta celda y no hay nada que reescribir.');
} else {
  // _conTipoEnCategorias tiene que sobrevivir a una entrada vacia sin explotar (cicatriz del
  // 2026-08-21): se prueba aca, con el mismo helper, antes de usarlo con la formula real.
  if(ctx._conTipoEnCategorias(undefined)!==undefined || ctx._conTipoEnCategorias('')!==''){
    fallas++; console.log('  ### FALLA _conTipoEnCategorias no es segura ante entrada vacia/undefined');
  } else {
    console.log('  OK  _conTipoEnCategorias(undefined) y (\'\') no explotan (devuelven la entrada intacta)');
  }
  d9=ctx._conTipoEnCategorias(a9);
  if(d9===a9){console.log('  !!! SIN CAMBIO '+claveCat);fallas++;}
  else if(chequear(claveCat,d9,{})){
    d9.split('\n').filter(x=>/condicion;|columna_tipo|columna_aj \\|columna_ak_vacia/.test(x)).forEach(x=>console.log('     '+x.trim()));
    if(/columna_ak_vacia/.test(d9)){console.log('  !!! quedo el nombre viejo de la variable');fallas++;}
  }
}
console.log('\n=== 3. Idempotencia ===');
let ni=0;
for(const spec of ctx.RIQ_CELDAS){
  const clave=(spec.hoja==='INICIO'?'Inicio':'Tablero')+'!'+spec.celda;
  if(!F[clave])continue;   // sin formula: ya se marco FALLA en la seccion 1, aca no hay nada que reaplicar
  const a=ctx._aListaBlanca(viva(clave)); if(a!==ctx._aListaBlanca(a)){console.log('  NO IDEMPOTENTE '+clave);ni++;}
}
if(a9 && d9!==ctx._conTipoEnCategorias(d9)){console.log('  NO IDEMPOTENTE '+claveCat);ni++;}
console.log(ni===0?'  OK  todas idempotentes':'  '+ni+' no idempotentes');
console.log('\n'+(fallas+ni===0?'===> SIN FALLAS':'===> '+(fallas+ni)+' FALLA(S)'));
process.exit(fallas+ni===0?0:1);
