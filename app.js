
function el(id){return document.getElementById(id)}
function updateSpec(){
  const m=el('mixSelect'),t=el('tempSelect'),r=el('repSelect');
  if(!m||!t||!r)return;
  const go=()=>{ const u=new URL(location.href); u.searchParams.set('mix',m.value);u.searchParams.set('temp',t.value);u.searchParams.set('rep',r.value);location.href=u.toString(); };
  m.onchange=go;t.onchange=go;r.onchange=go;
  const parts=m.options[m.selectedIndex].text.match(/(M\d+) \((\d+)% SCBA, (4M|6M)\)/);
  if(el('mixInfo')&&parts) el('mixInfo').textContent=`SCBA Replacement: ${parts[2]}%   •   NaOH Molarity: ${parts[3]}   •   Fly Ash : GGBS = 70 : 30`;
  if(el('specId'))el('specId').textContent=`${m.value}-${t.value}-${r.value}`;
}
function calcEntry(){
 const load=parseFloat(el('load')?.value),orig=parseFloat(el('orig')?.value);
 if(el('calcStrength'))el('calcStrength').value=Number.isFinite(load)?(load/10).toFixed(2):'';
 if(el('calcResidual'))el('calcResidual').value=Number.isFinite(load)&&Number.isFinite(orig)&&orig>0?((load/10)/orig*100).toFixed(2):'';
}
let chart;
async function makeGraph(){
 const x=el('gx').value,y=el('gy').value,g=el('gg').value;
 const res=await fetch(`/api/graph?x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}&group=${encodeURIComponent(g)}`);
 const data=await res.json();
 const ctx=el('mainChart');
 const datasets=Object.entries(data.series).map(([name,pts],i)=>({label:name,data:pts,borderWidth:3,tension:.25,pointRadius:4,fill:false}));
 if(chart)chart.destroy();
 chart=new Chart(ctx,{type:'line',data:{datasets},options:{responsive:true,parsing:false,scales:{x:{type:'linear',title:{display:true,text:x==='temperature'?'Temperature (°C)':'SCBA Replacement (%)'}},y:{title:{display:true,text:y==='mass'?'Mass Loss (%)':y==='strength'?'Residual Compressive Strength (MPa)':'Residual Compressive Strength (%)'},beginAtZero:true}},plugins:{legend:{position:'bottom'}}}});
 const title=y==='mass'?'Mass Loss':y==='strength'?'Residual Compressive Strength':'Residual Compressive Strength (%)';
 el('chartTitle').textContent=`${title} vs ${x==='temperature'?'Temperature':'SCBA Replacement'}`;
}
function preset(x,y,g){el('gx').value=x;el('gy').value=y;el('gg').value=g;makeGraph()}
function downloadChart(){
 if(!chart)return;
 const a=document.createElement('a');a.href=el('mainChart').toDataURL('image/png');a.download='SCGPC_Graph.png';a.click();
}
document.addEventListener('DOMContentLoaded',()=>{updateSpec();calcEntry();if(el('mainChart'))makeGraph();});
