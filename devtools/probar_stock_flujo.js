/**
 * devtools/probar_stock_flujo.js
 * Banco de pruebas de DEVTOOL_StockYFlujo.js. Genera las formulas REALES que el modulo va a
 * escribir y las revisa antes de que toquen la planilla: separadores es_AR, parentesis y comillas
 * balanceados, ausencia de arrays literales autorados, referencias derivadas del config, y que
 * las transformaciones de token sobre las formulas vivas hagan lo que dicen.
 *
 * Existe por la cicatriz de la v0.12.0: una formula que no parseaba llego a produccion porque
 * nadie corrio la transformacion contra una entrada real antes de deployar.
 *
 * USO:  node devtools/probar_stock_flujo.js
 * @version 0.15.0
 * @since 2026-08-19
 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const RAIZ='/Users/francodiazpizarro/Desktop/Antigravity/planilla-finanzas-personales/.claude/worktrees/gracious-kalam-00e92c';
const ctx={console,
  MONEDAS_DISPONIBLES:['ARS','USD','AUD','EUR'], TIPOS_RIQUEZA:['Ahorros','Inversiones'],
  CUENTA_ARRASTRE:'Inicio Mes',
  NAV_CONFIG:{SHEETS:{INICIO:'Inicio',TABLERO:'Tablero'}},
  RANGES:{REGISTROS:{sheet:'Registros',start:'B',end:'M',headerRow:6,dataRow:7,
      columns:{monto:'B',tipo:'C',cuenta:'D',tipo_cuenta:'E',medio:'F',moneda:'G',fecha:'H',nota:'I',tc_ars:'J',tc_usd:'K',tc_aud:'L',tc_eur:'M'}},
    PROYECTOS:{sheet:'Plan de Cuentas',start:'P',end:'Q',columns:{nombre:'P',tipo:'Q'}},
    MEDIOS_PAGO:{sheet:'Plan de Cuentas',start:'L',end:'N',columns:{nombre:'L',moneda:'M',proyecto:'N'}}},
  columnLetterToIndex(l){let i=0;for(let k=0;k<l.length;k++)i=i*26+(l.charCodeAt(k)-64);return i;},
  columnIndexToLetter(n){let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;},
  getDataRow:c=>c.dataRow||8, logInfo(){},logError(){},logSuccess(){},
  SpreadsheetApp:{},PropertiesService:{},Utilities:{},Session:{},Logger:{log(){}}};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(RAIZ,'src/DEVTOOL_FormulerioV0111.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(RAIZ,'src/DEVTOOL_TipoDeMedios.js'),'utf8')+'\n'+
  fs.readFileSync(path.join(RAIZ,'src/DEVTOOL_StockYFlujo.js'),'utf8')+
  '\n;Object.assign(globalThis,{FORM_CELDAS,SYF_SALDOS_TABLERO,SYF_TIPOS_TABLERO,SYF_FILA_RESIDUO,SYF_BLOQUE_MEDIOS,TDM_TIPOS});', ctx);

const tsv=fs.readFileSync(path.join(RAIZ,'docs/permanente/celdas.tsv'),'utf8').split('\n');
const F={}; for(const l of tsv){const p=l.split('\t'); if(p.length<3||!p[2])continue;
  F[p[0]+'!'+p[1]]=p[2].replace(/\\\\/g,'\x00').replace(/\\n/g,'\n').replace(/\x00/g,'\\');}
const pre={anclas:ctx._anclasMotorTablero()};
function viva(clave){
  const spec=ctx.FORM_CELDAS.find(s=>((s.hoja==='INICIO'?'Inicio':'Tablero')+'!'+s.celda)===clave);
  return spec?ctx._repararFormula(F[clave],spec,pre):F[clave];
}
let fallas=0;
function revisar(nombre,f,opts){
  opts=opts||{}; const p=[];
  if(!f||!f.startsWith('=')) p.push('no empieza con =');
  if(/\$N\$N/.test(f)) p.push('firma $N$N del bug de escape');
  if(/#REF!/.test(f)) p.push('tiene #REF!');
  if(/,\s*(0|1|"")\s*\)/.test(f) && !/TEXT\(/.test(f)) p.push('posible separador COMA (locale en-US)');
  if(!opts.permiteLlaves && /\{/.test(f)) p.push('array literal autorado (trampa de locale)');
  let d=0,str=false;
  for(const ch of f){ if(ch==='"')str=!str; else if(!str&&ch==='(')d++; else if(!str&&ch===')')d--; if(d<0)break; }
  if(d!==0)p.push('parentesis desbalanceados ('+d+')');
  if(str)p.push('comillas sin cerrar');
  const let_=(f.match(/\bLET\(/g)||[]).length;
  if(let_ && !/;/.test(f)) p.push('LET sin separador ;');
  // --- Dos guards nacidos de la corrida fallida del 2026-08-19 17:23 ---
  // (a) Sheets le SACA las comillas a los nombres de hoja que no las necesitan, y despues la
  //     verificacion compara texto contra texto y no coincide: revirtio 10 formulas correctas.
  const comillasDeMas=(f.match(/'[A-Za-z_][A-Za-z0-9_]*'!/g)||[]);
  if(comillasDeMas.length) p.push('nombre de hoja entrecomillado sin necesidad: '+comillasDeMas[0]+' (Sheets se las va a sacar)');
  // (b) Un nombre de variable LET que colisiona con una funcion de Sheets hace que la formula
  //     entera no parsee. 'n' choca con N(): dejo L29 sin nada.
  const FUNCS=new Set(['N','T','PI','ROW','COLUMN','NOW','TODAY','RAND','SIGN','ABS','SUM','MIN','MAX',
    'IF','AND','OR','NOT','TEXT','VALUE','LEN','LEFT','RIGHT','MID','TRIM','DAY','MONTH','YEAR','DATE',
    'TIME','LOG','LN','EXP','SIN','COS','TAN','SQRT','INT','MOD','ODD','EVEN','FACT','DELTA','CODE','CHAR']);
  const cuerpoLet=f.replace(/^=\s*LET\(/,'');
  (cuerpoLet.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/gm)||[]).forEach(m=>{
    const v=m.replace(/[\s;]/g,'');
    if(FUNCS.has(v.toUpperCase())) p.push('variable LET "'+v+'" colisiona con la funcion '+v.toUpperCase()+'() de Sheets');
    else if(v.length<=2) p.push('variable LET "'+v+'" es demasiado corta: alto riesgo de chocar con una funcion');
  });
  if(p.length){fallas++; console.log('\n### FALLA '+nombre+': '+p.join(', ')); console.log(f);}
  return !p.length;
}
console.log('=== 1a. La suma POR TIPO DE MEDIO (bloque "Tipo de Medios") ===');
const t=ctx.SYF_TIPOS_TABLERO;
// Los rotulos los pone Franco en la hoja; el bench simula los que se midieron el 2026-08-20.
const TIPOS_EN_HOJA=['Ahorros','Financiación','Hogar','Inversiones'];
t.filas.forEach((fila,i)=>{
  const celdaTipo=t.colTipo+fila;
  const f=ctx._formulaSaldoPorTipo(celdaTipo,'$N$4');
  if(revisar(t.colMonto+fila,f)) console.log('  OK  '+(t.colMonto+fila).padEnd(6)+TIPOS_EN_HOJA[i].padEnd(14)+'lee su tipo de '+celdaTipo);
  if(f.indexOf('tipo_fila='+celdaTipo)===-1){console.log('  !!! '+t.colMonto+fila+' no filtra por el rotulo de al lado');fallas++;}
  // Ni una coordenada de cotizacion: son las que se pudren cuando el bloque se mueve.
  if(/\$AF\$\d+/.test(f)){console.log('  !!! '+t.colMonto+fila+' apunta a una celda de cotizacion por coordenada');fallas++;}
  if(!/TIDETRACK_USD\(\)/.test(f)){console.log('  !!! '+t.colMonto+fila+' no convierte con las custom functions');fallas++;}
});
if(t.colMonto==='AF'){console.log('  !!! la columna Monto no puede ser AF: es la mitad muda de la combinada AE:AF');fallas++;}
else console.log('  OK  el monto va en '+t.colMonto+' (ancla), no en la mitad muda de la combinada');

console.log('\n=== 1b. STOCKS: saldos por moneda (bloque "Saldos Actuales") ===');
const s=ctx.SYF_SALDOS_TABLERO;
if(s.filas[0]===t.filas[0]){console.log('  !!! los dos bloques ocupan las mismas filas: uno pisa al otro');fallas++;}
else console.log('  OK  bloques separados: tipos en filas '+t.filas.join(',')+', monedas en '+s.filas.join(','));
s.filas.forEach(fila=>{
  ['flujo','capital'].forEach(k=>{
    const esRiq=k==='capital';
    const col=esRiq?s.colCapital:s.colFlujo;
    const f=ctx._formulaSaldoPorMoneda(esRiq,s.colMoneda+fila);
    if(revisar(col+fila,f)) console.log('  OK  '+(col+fila).padEnd(6)+k);
  });
});

console.log('\n=== 2. STOCKS convertidos (Inicio C8 / F8) ===');
[['Inicio!C8',false],['Inicio!F8',true]].forEach(([c,r])=>{
  const f=ctx._formulaSaldoConvertido(r,'$G$4');
  if(revisar(c,f)) console.log('  OK  '+c);
});
console.log('\n=== 3. Saldo actual POR MEDIO y el diagnostico ===');
// TRES formulas de UNA columna: el bloque son celdas combinadas y un derrame de 3 columnas
// solo entra la primera (defecto de la v0.16.0).
const cols=ctx.SYF_BLOQUE_MEDIOS.columnas;
const matrices=new Set();
cols.forEach(c=>{
  const f=ctx._formulaSaldoPorMedio(c.indice);
  const ref=c.col+ctx.SYF_BLOQUE_MEDIOS.filaDatos;
  if(revisar('Tablero!'+ref,f)) console.log('  OK  Tablero!'+ref+'  ('+c.rotulo+', INDEX col '+c.indice+')');
  if(!new RegExp('INDEX\\(tabla; 0; '+c.indice+'\\)').test(f)){console.log('  !!! '+ref+' no toma la columna '+c.indice);fallas++;}
  matrices.add(f.replace(/INDEX\(tabla; 0; \d+\)/,'INDEX(tabla; 0; K)'));
});
if(matrices.size!==1){console.log('  !!! las tres columnas NO derivan de la misma matriz: se pueden desincronizar');fallas++;}
else console.log('  OK  las tres columnas derivan de la MISMA matriz ordenada (filas sincronizadas)');
const dg=ctx._formulaDiagnosticoSyf();
if(revisar('Tablero!L29',dg)) console.log('  OK  Tablero!L29');
// Invariantes del modelo de saldo validado contra los saldos reales de Franco (v0.16.0).
[[t.colMonto+t.filas[0],t.colTipo+t.filas[0]],[t.colMonto+t.filas[1],t.colTipo+t.filas[1]]].forEach(([c,ct])=>{
  const f=ctx._formulaSaldoPorTipo(ct,'$N$4');
  const chk=[
    [/corte_fila<>""/, 'exige que el medio exista en el Plan'],
    [/col_cuenta="Inicio Mes"/, 'usa el ultimo Inicio Mes como punto de corte'],
    [/col_fecha>=corte_fila/, 'suma solo lo posterior al corte'],
    [/vigente/, 'aplica el filtro vigente'],
  ];
  chk.forEach(([re,d])=>{ if(!re.test(f)){console.log('  !!! '+c+' NO '+d);fallas++;} });
  if(chk.every(([re])=>re.test(f))) console.log('  OK  '+c+' — corte por ultimo Inicio Mes + medio valido');
});
const pm2=ctx._formulaSaldoPorMedio();
if(!/con_saldo/.test(pm2)){console.log('  !!! C18 no filtra los medios en cero');fallas++;}
else console.log('  OK  C18 muestra solo medios con saldo distinto de cero');
console.log('\n=== 4. Condiciones derivadas de TIPOS_RIQUEZA (tienen que ser complementarias) ===');
console.log('  riqueza:   '+ctx._condTipoSyf(true,'tipo_cat'));
console.log('  cotidiano: '+ctx._condTipoSyf(false,'tipo_cat'));
console.log('\n=== 5. Apagar el arrastre en las formulas vivas ===');
[['Tablero!R9'],['Tablero!U9'],['Tablero!X9'],['Inicio!C13'],['Inicio!F13'],['Inicio!C15'],['Inicio!F15']].forEach(([c])=>{
  const antes=viva(c); if(!antes){console.log('  (sin snapshot) '+c);return;}
  const desp=ctx._apagarArrastreSyf(antes);
  if(desp===antes){
    // El gemelo se refresca en vivo desde el 2026-08-20: si la formula YA viene transformada
    // (excluye el arrastre), "sin cambio" es idempotencia y no una falla. Falla solo si la
    // formula viva no tiene la transformacion Y la funcion tampoco se la pone.
    if(/Inicio Mes/.test(antes)){console.log('  OK  '+c.padEnd(12)+'ya transformada en la planilla viva (idempotente)');return;}
    console.log('  !!! SIN CAMBIO '+c+' y la formula viva NO excluye el arrastre');fallas++;return;
  }
  if(/OR Col5|tipo_proy_\w+\s*=/.test(desp)){console.log('  !!! quedo la clausula vieja en '+c);fallas++;return;}
  if(revisar(c,desp,{permiteLlaves:true})){
    const l=desp.split('\n').find(x=>/Inicio Mes/.test(x));
    console.log('  OK  '+c.padEnd(12)+(l?l.trim():''));
  }
  if(ctx._apagarArrastreSyf(desp)!==desp){console.log('  !!! NO IDEMPOTENTE '+c);fallas++;}
});
console.log('\n'+(fallas===0?'===> SIN FALLAS':'===> '+fallas+' FALLA(S)'));
process.exit(fallas===0?0:1);
