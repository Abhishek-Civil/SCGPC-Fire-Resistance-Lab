function el(id){return document.getElementById(id)}
function updateSpec(){
  const m=el('mixSelect'),t=el('tempSelect'),r=el('repSelect');
  if(!m||!t||!r)return;
  const go=()=>{const u=new URL(location.href);u.searchParams.set('mix',m.value);u.searchParams.set('temp',t.value);u.searchParams.set('rep',r.value);location.href=u.toString()};
  m.onchange=go;t.onchange=go;r.onchange=go;
  const parts=m.options[m.selectedIndex].text.match(/(M\d+) \((\d+)% SCBA, (4M|6M)\)/);
  if(el('mixInfo')&&parts)el('mixInfo').textContent=`SCBA Replacement: ${parts[2]}%   •   NaOH Molarity: ${parts[3]}   •   Fly Ash : GGBS = 70 : 30`;
  if(el('specId'))el('specId').textContent=`${m.value}-${t.value}-${r.value}`;
}
function calcEntry(){
  const load=parseFloat(el('load')?.value),orig=parseFloat(el('orig')?.value);
  if(el('calcStrength'))el('calcStrength').value=Number.isFinite(load)?(load/10).toFixed(2):'';
  if(el('calcResidual'))el('calcResidual').value=Number.isFinite(load)&&Number.isFinite(orig)&&orig>0?((load/10)/orig*100).toFixed(2):'';
}
document.addEventListener('DOMContentLoaded',()=>{updateSpec();calcEntry()});

