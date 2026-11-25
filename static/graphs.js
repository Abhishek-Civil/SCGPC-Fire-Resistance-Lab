(() => {
  const catalog = window.GRAPH_CATALOG || [];
  const categories = window.GRAPH_CATEGORIES || [];
  const colors = ['#0878f9','#15a66a','#f08a16','#8852df','#e84b63','#13a8aa','#6a7dcb','#b46d36','#e351a4','#7ca51c','#52647c','#e45c35'];
  let records = [];
  let specimenSummary = {};
  let activeCategory = categories[0]?.id || 'strength';
  let activeChart = null;
  let activeAnalysis = catalog[0] || null;

  const byId = (id) => document.getElementById(id);
  const round = (value, places=1) => Number.isFinite(value) ? Number(value.toFixed(places)) : null;
  const mean = (values) => values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : null;
  const sd = (values) => values.length > 1 ? Math.sqrt(values.reduce((sum,value)=>sum+(value-mean(values))**2,0)/(values.length-1)) : null;
  const metricLabel = (metric) => ({residual:'Residual strength (%)',strength:'Compressive strength (MPa)',mass_loss:'Mass loss (%)',completion:'Recorded specimens',condition:'Specimen condition',multi:'Normalized performance index'}[metric] || 'Measured value');
  const metricValue = (row,metric) => metric === 'mass_loss' || metric === 'strength' || metric === 'residual' ? row[metric] : null;
  const mixOrder = new Map((window.GRAPH_MIXES || []).map((mix,index)=>[mix.id,index]));
  const mixInfo = new Map((window.GRAPH_MIXES || []).map(mix=>[mix.id,mix]));

  function selectedMixes(){ return [...document.querySelectorAll('.mix-checkbox:checked')].map(input=>input.value); }
  function selectedTemperatures(){ return [...document.querySelectorAll('.temperature-checkbox:checked')].map(input=>Number(input.value)); }
  function currentRows(){
    const mixes=new Set(selectedMixes()),temperatures=new Set(selectedTemperatures());
    return records.filter(row=>mixes.has(row.mix)&&temperatures.has(row.temperature));
  }
  function currentMetricRows(rows,metric){ return rows.map(row=>({row,value:metricValue(row,metric)})).filter(item=>Number.isFinite(item.value)); }
  function formatValue(value,places=1){ return Number.isFinite(value) ? Number(value).toFixed(places) : '—'; }
  function xToken(row,field){
    if(field==='mix')return {key:row.mix,label:row.mix,value:mixOrder.get(row.mix) ?? 0};
    if(field==='temperature')return {key:String(row.temperature),label:`${row.temperature}°C`,value:row.temperature};
    if(field==='scba')return {key:String(row.scba),label:`${row.scba}%`,value:row.scba};
    if(field==='molarity')return {key:row.molarity,label:row.molarity,value:row.molarity==='4M'?4:6};
    if(field==='replicate')return {key:String(row.replicate),label:`R${row.replicate}`,value:row.replicate};
    if(field==='mass_loss')return {key:String(round(row.mass_loss,2)),label:formatValue(row.mass_loss,2),value:row.mass_loss};
    return {key:String(row.temperature),label:`${row.temperature}°C`,value:row.temperature};
  }
  function groupToken(row,group){
    if(group==='mix')return row.mix;
    if(group==='temperature')return `${row.temperature}°C`;
    if(group==='molarity')return row.molarity;
    if(group==='scba')return `${row.scba}% SCBA`;
    return 'All selected specimens';
  }
  function orderedTokens(map,field){
    const tokens=[...map.values()];
    return tokens.sort((a,b)=>{
      if(field==='mix')return (mixOrder.get(a.key)??999)-(mixOrder.get(b.key)??999);
      return (typeof a.value==='number'&&typeof b.value==='number')?a.value-b.value:String(a.label).localeCompare(String(b.label));
    });
  }
  function readConfig(){
    const mixes=selectedMixes(),temps=selectedTemperatures();
    if(!mixes.length){setStatus('Select at least one mix.',true);return null;}
    if(!temps.length){setStatus('Select at least one temperature.',true);return null;}
    const analysis=catalog.find(item=>item.id===byId('analysisSelect').value);
    if(!analysis){setStatus('Choose an analysis.',true);return null;}
    return {analysis,mixes,temps,display:document.querySelector('input[name="dataDisplay"]:checked')?.value||'average',errorBars:byId('showErrorBars').checked};
  }
  function setStatus(message,isError=false){
    const status=byId('graphDataStatus');
    if(status){status.textContent=message;status.style.color=isError?'#c43a3a':'';}
  }
  function updatePickerSummaries(){
    const mixes=selectedMixes(),temps=selectedTemperatures();
    byId('mixSummary').innerHTML=`${mixes.length} mix${mixes.length===1?'':'es'} selected <span>⌄</span>`;
    byId('temperatureSummary').innerHTML=temps.length===4?'All Temperatures (200°C – 800°C)':`${temps.map(temp=>`${temp}°C`).join(', ')||'No temperatures'} <span>⌄</span>`;
  }
  function refreshAnalysisOptions(preferredId){
    const typeSelect=byId('graphTypeSelect'),analysisSelect=byId('analysisSelect');
    const categoryItems=catalog.filter(item=>item.category===activeCategory);
    const types=[...new Set(categoryItems.map(item=>normalizedType(item.type)))];
    typeSelect.innerHTML=types.map(type=>`<option value="${type}">${typeLabel(type)}</option>`).join('');
    let chosen=categoryItems.find(item=>item.id===preferredId)||categoryItems[0];
    if(!chosen){analysisSelect.innerHTML='';return;}
    typeSelect.value=normalizedType(chosen.type);
    fillAnalyses(chosen.id);
  }
  function fillAnalyses(preferredId){
    const type=byId('graphTypeSelect').value;
    const options=catalog.filter(item=>item.category===activeCategory&&normalizedType(item.type)===type);
    byId('analysisSelect').innerHTML=options.map(item=>`<option value="${item.id}">${item.name}</option>`).join('');
    const chosen=options.find(item=>item.id===preferredId)||options[0];
    if(chosen){byId('analysisSelect').value=chosen.id;activeAnalysis=chosen;}
  }
  function normalizedType(type){ return type==='pie'||type==='doughnut'?'pie-doughnut':type; }
  function typeLabel(type){ return ({line:'Line Graph',bar:'Bar / Column',scatter:'Scatter Plot',error:'Statistical Error Bar',heatmap:'Heatmap',"pie-doughnut":'Pie / Doughnut Chart',box:'Box Plot',radar:'Radar Chart'})[type]||type; }
  function renderChosenAnalysis(){
    const config=readConfig();
    if(!config)return;
    renderGraph(config);
  }

  function errorBarPlugin(){
    return {id:'scgpcErrorBars',afterDatasetsDraw(chart){
      const ctx=chart.ctx;
      chart.data.datasets.forEach((dataset,index)=>{
        if(!dataset.customErrors)return;
        const meta=chart.getDatasetMeta(index),scale=chart.scales.y;
        meta.data.forEach((point,pointIndex)=>{
          const error=dataset.customErrors[pointIndex],value=dataset.data[pointIndex];
          if(!point||!Number.isFinite(error)||!Number.isFinite(value))return;
          const yTop=scale.getPixelForValue(value+error),yBottom=scale.getPixelForValue(value-error),x=point.x;
          ctx.save();ctx.strokeStyle=dataset.borderColor||'#43536d';ctx.lineWidth=1.4;
          ctx.beginPath();ctx.moveTo(x,yTop);ctx.lineTo(x,yBottom);ctx.moveTo(x-4,yTop);ctx.lineTo(x+4,yTop);ctx.moveTo(x-4,yBottom);ctx.lineTo(x+4,yBottom);ctx.stroke();ctx.restore();
        });
      });
    }};
  }
  function destroyChart(){ if(activeChart){activeChart.destroy();activeChart=null;} }
  function setChartMode(mode){
    byId('mainChart').hidden=mode!=='chart';byId('heatmapView').hidden=true;byId('boxPlotView').hidden=true;byId('chartEmpty').hidden=true;
  }
  function renderGraph(config){
    const rows=currentRows(),analysis=config.analysis;
    activeAnalysis=analysis;
    byId('chartTitle').textContent=analysis.name;
    byId('chartSubtitle').textContent=`${metricLabel(analysis.metric)} · ${config.display==='average'?'Mean across measured replicates':'Individual replicate records'}${config.temps.length<4?` · ${config.temps.map(t=>`${t}°C`).join(', ')}`:''}`;
    if(analysis.type==='heatmap'){
      destroyChart();byId('mainChart').hidden=true;byId('boxPlotView').hidden=true;byId('heatmapView').hidden=false;byId('chartEmpty').hidden=true;
      const count=renderHeatmap(analysis,rows);updateTableAndInsights(analysis,rows,config);if(count)setStatus(`${count} measured observations shown`);return;
    }
    if(analysis.type==='box'){
      destroyChart();byId('mainChart').hidden=true;byId('heatmapView').hidden=true;byId('boxPlotView').hidden=false;byId('chartEmpty').hidden=true;
      const count=renderBoxPlot(analysis,rows);updateTableAndInsights(analysis,rows,config);
      if(!count)showEmpty();else setStatus(`${count} measured observations shown`);return;
    }
    setChartMode('chart');destroyChart();
    const chartData=buildChartData(analysis,rows,config);
    if(!chartData.datasets.length||!chartData.hasValues){showEmpty();updateTableAndInsights(analysis,rows,config);return;}
    const isScatter=analysis.type==='scatter';
    const chartType=analysis.type==='pie'?'pie':analysis.type==='doughnut'?'doughnut':analysis.type==='radar'?'radar':analysis.type==='bar'?'bar':analysis.type==='error'&&analysis.id==='replicate-strength'?'bar':isScatter?'scatter':analysis.type==='error'?'line':'line';
    const datasets=chartData.datasets.map((dataset,index)=>({
      ...dataset,
      backgroundColor:chartType==='pie'||chartType==='doughnut'?colors:colorWithAlpha(index,.18),
      borderColor:chartType==='pie'||chartType==='doughnut'?colors[index%colors.length]:colors[index%colors.length],
      borderWidth:chartType==='radar'?2:2,
      pointRadius:isScatter?4:(chartType==='radar'?3:3),
      pointHoverRadius:6,
      tension:.22,
      fill:chartType==='radar'?true:false,
      customErrors:config.errorBars&&config.display==='average'?dataset.errors:null,
    }));
    const numericX=isScatter;
    const options={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:chartType==='pie'||chartType==='doughnut'?'right':'bottom',labels:{usePointStyle:true,boxWidth:9,font:{size:11}}},tooltip:{callbacks:{label:(context)=>{
      const raw=context.raw;
      if(isScatter&&raw&&typeof raw==='object')return `${context.dataset.label}: (${formatValue(raw.x,2)}, ${formatValue(raw.y,2)})`;
      return `${context.dataset.label}: ${formatValue(context.parsed?.y??context.parsed,2)}`;
    }}}},scales:{}};
    if(chartType==='pie'||chartType==='doughnut'){
      options.scales=undefined;
      options.plugins.legend.position='right';
    }else if(chartType==='radar'){
      options.scales={r:{beginAtZero:true,suggestedMax:analysis.id==='radar-multi'?100:undefined,grid:{color:'#e2eaf4'},angleLines:{color:'#d8e2ef'},pointLabels:{font:{size:11}}}};
    }else if(isScatter){
      options.parsing=false;options.scales={x:{type:'linear',title:{display:true,text:xAxisLabel(analysis.x)},grid:{color:'#e8eef5'}},y:{beginAtZero:true,title:{display:true,text:metricLabel(analysis.metric)},grid:{color:'#e8eef5'}}};
    }else{
      options.scales={x:{title:{display:true,text:xAxisLabel(analysis.x)},grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:metricLabel(analysis.metric)},grid:{color:'#e8eef5'}}};
      if(chartType==='bar')options.datasets={bar:{maxBarThickness:34,borderRadius:3}};
    }
    activeChart=new Chart(byId('mainChart'),{type:chartType,data:{labels:chartData.labels,datasets},options,plugins:[errorBarPlugin()]});
    updateTableAndInsights(analysis,rows,config);
    setStatus(`${chartData.valueCount} measured observations shown · ${config.mixes.length} mixes · ${config.temps.length} temperatures`);
  }
  function colorWithAlpha(index,alpha){ const hex=colors[index%colors.length].replace('#','');const n=parseInt(hex,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`; }
  function xAxisLabel(field){ return ({temperature:'Temperature (°C)',scba:'SCBA replacement (%)',mix:'Mix',molarity:'NaOH molarity',replicate:'Replicate',mass_loss:'Mass loss (%)',parameter:'Performance parameter'})[field]||field; }
  function showEmpty(){
    destroyChart();byId('mainChart').hidden=true;byId('heatmapView').hidden=true;byId('boxPlotView').hidden=true;byId('chartEmpty').hidden=false;
    setStatus('No measured values match the selected filters.',true);
  }
  function buildChartData(analysis,rows,config){
    if(analysis.type==='pie'||analysis.type==='doughnut')return buildConditionData(analysis,rows);
    if(analysis.type==='radar'&&analysis.id==='radar-multi')return buildMultiRadar(rows,config);
    if(analysis.type==='scatter')return buildScatterData(analysis,rows);
    const metric=analysis.metric;
    let usable=currentMetricRows(rows,metric);
    if(analysis.id==='replicate-strength'){
      usable=usable.map(item=>({...item,group:`${item.row.mix}`,x:{key:String(item.row.replicate),label:`R${item.row.replicate}`,value:item.row.replicate},replicate:item.row.replicate}));
    }
    if(!usable.length)return {labels:[],datasets:[],hasValues:false,valueCount:0};
    const specialAverage=analysis.x===analysis.group&&config.display==='average';
    const datasetsMap=new Map(),xMap=new Map();
    usable.forEach(({row,value,group,replicate})=>{
      const x=analysis.id==='replicate-strength'?{key:String(row.replicate),label:`R${row.replicate}`,value:row.replicate}:xToken(row,analysis.x);
      xMap.set(x.key,x);
      const groupName=specialAverage?'Average':(group||groupToken(row,analysis.group));
      const seriesName=config.display==='individual'&&!specialAverage?`${groupName} · R${row.replicate}`:groupName;
      const key=seriesName;
      if(!datasetsMap.has(key))datasetsMap.set(key,new Map());
      const series=datasetsMap.get(key);
      if(!series.has(x.key))series.set(x.key,[]);
      series.get(x.key).push(value);
    });
    const tokens=orderedTokens(xMap,analysis.x);
    const labels=tokens.map(token=>token.label);
    const datasetList=[...datasetsMap.entries()].sort(([a],[b])=>{
      const am=a.match(/^(M\d+)/)?.[1],bm=b.match(/^(M\d+)/)?.[1];
      return (mixOrder.get(am)??99)-(mixOrder.get(bm)??99)||a.localeCompare(b);
    }).map(([name,series],index)=>{
      const vals=tokens.map(token=>mean(series.get(token.key)||[]));
      const errors=tokens.map(token=>sd(series.get(token.key)||[]));
      return {label:name,data:vals,errors,borderColor:colors[index%colors.length]};
    });
    const valueCount=usable.length;
    return {labels,datasets:datasetList,hasValues:datasetList.some(d=>d.data.some(Number.isFinite)),valueCount};
  }
  function buildScatterData(analysis,rows){
    const metricRows=currentMetricRows(rows,analysis.metric);
    const byGroup=new Map();
    metricRows.forEach(({row,value})=>{
      let x;
      if(analysis.x==='mass_loss')x=row.mass_loss;
      else if(analysis.x==='scba')x=row.scba;
      else if(analysis.x==='temperature')x=row.temperature;
      else return;
      if(!Number.isFinite(x))return;
      const name=row.mix;
      if(!byGroup.has(name))byGroup.set(name,[]);
      byGroup.get(name).push({x,y:value,replicate:row.replicate,temperature:row.temperature});
    });
    const datasets=[...byGroup.entries()].sort(([a],[b])=>(mixOrder.get(a)??99)-(mixOrder.get(b)??99)).map(([name,data],index)=>({label:name,data,borderColor:colors[index%colors.length],backgroundColor:colorWithAlpha(index,.55),showLine:false}));
    return {labels:[],datasets,hasValues:datasets.some(dataset=>dataset.data.length),valueCount:metricRows.length};
  }
  function buildConditionData(analysis,rows){
    const counts=new Map();
    if(analysis.id==='completion'){
      rows.forEach(row=>{const label=row.present?'Recorded':'Not recorded';counts.set(label,(counts.get(label)||0)+1);});
    }else{
      rows.filter(row=>row.present).forEach(row=>counts.set(row.condition,(counts.get(row.condition)||0)+1));
    }
    const labels=[...counts.keys()],data=labels.map(label=>counts.get(label));
    const datasets=labels.length?[{label:analysis.name,data,backgroundColor:labels.map((_,index)=>colors[index%colors.length]),borderColor:'#fff',borderWidth:2}]:[];
    return {labels,datasets,hasValues:data.some(value=>value>0),valueCount:data.reduce((a,b)=>a+b,0)};
  }
  function buildMultiRadar(rows,config){
    const metrics=[['Strength (MPa)','strength',false],['Residual strength (%)','residual',false],['Mass retention (%)','mass_loss',true]];
    const selected=selectedMixes();
    const aggregate=selected.map(mix=>({mix,values:metrics.map(([,metric,inverse])=>{
      const values=currentMetricRows(rows,metric).filter(item=>item.row.mix===mix).map(item=>item.value);
      const avg=mean(values);
      return {avg:avg===null?null:(inverse?100-avg:avg)};
    })}));
    const ranges=metrics.map((_,index)=>{
      const values=aggregate.map(item=>item.values[index].avg).filter(Number.isFinite);
      return {min:Math.min(...values),max:Math.max(...values)};
    });
    const datasets=aggregate.map((item,index)=>({label:item.mix,data:item.values.map((entry,metricIndex)=>{
      if(entry.avg===null)return null;
      const range=ranges[metricIndex],span=range.max-range.min;
      return span?((entry.avg-range.min)/span)*100:50;
    }),borderColor:colors[index%colors.length]}));
    const labels=metrics.map(item=>item[0]);
    return {labels,datasets,hasValues:datasets.some(dataset=>dataset.data.some(Number.isFinite)),valueCount:aggregate.reduce((count,item)=>count+item.values.filter(value=>value.avg!==null).length,0)};
  }
  function renderHeatmap(analysis,rows){
    const metricRows=currentMetricRows(rows,analysis.metric);
    const labels=[...new Set(selectedTemperatures())].sort((a,b)=>a-b);
    const groups=analysis.group==='scba'?
      [...new Set(selectedMixes().map(mix=>mixInfo.get(mix)?.scba).filter(Number.isFinite))].sort((a,b)=>a-b).map(value=>({key:String(value),label:`${value}% SCBA`,matches:row=>row.scba===value})):
      selectedMixes().map(mix=>({key:mix,label:mix,matches:row=>row.mix===mix}));
    const matrix=groups.map(group=>labels.map(temp=>mean(metricRows.filter(item=>item.row.temperature===temp&&group.matches(item.row)).map(item=>item.value))));
    const valid=matrix.flat().filter(Number.isFinite);
    if(!valid.length){showEmpty();return 0;}
    const low=Math.min(...valid),high=Math.max(...valid),div=high-low||1;
    const canvas=byId('mainChart');
    const area=canvas.parentElement;
    const width=area.clientWidth||800,height=area.clientHeight||318,dpr=window.devicePixelRatio||1;
    canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width='100%';canvas.style.height='100%';
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
    const left=68,top=24,right=16,bottom=42,usableW=width-left-right,usableH=height-top-bottom;
    ctx.font='12px Inter, Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#203650';ctx.fillText(xAxisLabel(analysis.x),left+usableW/2,height-14);
    ctx.textAlign='right';ctx.fillText(analysis.group==='scba'?'SCBA content':'Mix',left-12,top+usableH/2);
    const cellW=usableW/labels.length,cellH=usableH/groups.length;
    labels.forEach((temp,column)=>{ctx.fillStyle='#243954';ctx.textAlign='center';ctx.fillText(`${temp}°C`,left+column*cellW+cellW/2,top-9);});
    groups.forEach((group,rowIndex)=>{
      ctx.fillStyle='#263954';ctx.textAlign='right';ctx.fillText(group.label,left-9,top+rowIndex*cellH+cellH/2);
      labels.forEach((_,column)=>{
        const value=matrix[rowIndex][column],ratio=Number.isFinite(value)?(value-low)/div:0;
        const hue=Math.round(218-155*ratio),light=96-33*ratio;
        ctx.fillStyle=Number.isFinite(value)?`hsl(${hue} 76% ${light}%)`:'#f1f4f8';
        ctx.fillRect(left+column*cellW+2,top+rowIndex*cellH+2,Math.max(0,cellW-4),Math.max(0,cellH-4));
        ctx.fillStyle='#122640';ctx.textAlign='center';ctx.fillText(formatValue(value,1),left+column*cellW+cellW/2,top+rowIndex*cellH+cellH/2);
      });
    });
    canvas.hidden=false;return metricRows.length;
  }
  function renderBoxPlot(analysis,rows){
    const metricRows=currentMetricRows(rows,analysis.metric);
    const field=analysis.x,groupMap=new Map();
    metricRows.forEach(({row,value})=>{
      const token=xToken(row,field);if(!groupMap.has(token.key))groupMap.set(token.key,{token,values:[]});groupMap.get(token.key).values.push(value);
    });
    const groups=orderedTokens(groupMap,field).map(token=>groupMap.get(token.key)).filter(group=>group.values.length);
    if(!groups.length)return 0;
    const canvas=byId('boxPlotView'),area=canvas.parentElement,width=area.clientWidth||800,height=area.clientHeight||318,dpr=window.devicePixelRatio||1;
    canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.width='100%';canvas.style.height='100%';
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,height);
    const left=67,right=18,top=20,bottom=49,plotW=width-left-right,plotH=height-top-bottom;
    const all=groups.flatMap(group=>group.values),min=Math.min(0,...all),max=Math.max(...all),span=max-min||1;
    const y=value=>top+plotH-(value-min)/span*plotH;
    ctx.strokeStyle='#dce5ef';ctx.fillStyle='#344966';ctx.font='11px Inter, Arial';ctx.textAlign='right';ctx.textBaseline='middle';
    for(let step=0;step<=4;step++){const value=min+(span*step/4),py=y(value);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(width-right,py);ctx.stroke();ctx.fillText(formatValue(value,1),left-7,py);}
    const cellW=plotW/groups.length,boxW=Math.min(34,cellW*.45);
    groups.forEach((group,index)=>{
      const sorted=[...group.values].sort((a,b)=>a-b),quantile=q=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];
      const low=sorted[0],high=sorted[sorted.length-1],q1=quantile(.25),median=quantile(.5),q3=quantile(.75),cx=left+cellW*index+cellW/2;
      ctx.strokeStyle=colors[index%colors.length];ctx.fillStyle=colorWithAlpha(index,.22);ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cx,y(high));ctx.lineTo(cx,y(low));ctx.moveTo(cx-boxW*.25,y(high));ctx.lineTo(cx+boxW*.25,y(high));ctx.moveTo(cx-boxW*.25,y(low));ctx.lineTo(cx+boxW*.25,y(low));ctx.stroke();
      ctx.fillRect(cx-boxW/2,y(q3),boxW,Math.max(2,y(q1)-y(q3)));ctx.strokeRect(cx-boxW/2,y(q3),boxW,Math.max(2,y(q1)-y(q3)));
      ctx.beginPath();ctx.moveTo(cx-boxW/2,y(median));ctx.lineTo(cx+boxW/2,y(median));ctx.stroke();
      ctx.fillStyle='#263d5c';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(group.token.label,cx,height-bottom+8);
    });
    updateTableAndInsights(analysis,rows,{display:'individual'});setStatus(`${metricRows.length} specimen observations · whiskers show measured range`);return metricRows.length;
  }
  function updateTableAndInsights(analysis,rows,config){
    renderDataTable(analysis,rows,config);
    renderInsights(analysis,rows);
  }
  function renderDataTable(analysis,rows,config){
    const table=byId('graphDataTable');
    if(analysis.type==='pie'||analysis.type==='doughnut'){
      const chartData=buildConditionData(analysis,rows);
      table.innerHTML=`<thead><tr><th>Category</th><th>Specimens</th><th>Share</th></tr></thead><tbody>${chartData.labels.map((label,index)=>`<tr><td>${escapeHtml(label)}</td><td>${chartData.datasets[0].data[index]}</td><td>${formatValue(chartData.datasets[0].data[index]/Math.max(chartData.valueCount,1)*100,1)}%</td></tr>`).join('')}</tbody>`;
      return;
    }
    if(analysis.id==='radar-multi'){
      table.innerHTML='<thead><tr><th>Mix</th><th>Strength (MPa)</th><th>Residual strength (%)</th><th>Mass loss (%)</th></tr></thead><tbody>'+selectedMixes().map(mix=>{
        const vals=['strength','residual','mass_loss'].map(metric=>mean(currentMetricRows(rows,metric).filter(item=>item.row.mix===mix).map(item=>item.value)));
        return `<tr><td>${mix}</td>${vals.map(value=>`<td>${formatValue(value,2)}</td>`).join('')}</tr>`;
      }).join('')+'</tbody>';return;
    }
    const metric=analysis.metric,temperatures=selectedTemperatures().sort((a,b)=>a-b),mixes=selectedMixes();
    if(analysis.id==='replicate-strength'){
      const reps=[1,2,3];
      table.innerHTML=`<thead><tr><th>Mix</th>${reps.map(rep=>`<th>R${rep} (MPa)</th>`).join('')}</tr></thead><tbody>${mixes.map(mix=>`<tr><td>${mix}</td>${reps.map(rep=>{const values=rows.filter(row=>row.mix===mix&&row.replicate===rep).map(row=>row.strength).filter(Number.isFinite);return `<td>${formatValue(mean(values),2)}</td>`;}).join('')}</tr>`).join('')}</tbody>`;return;
    }
    const unit=metric==='strength'?'MPa':metric==='mass_loss'?'%':'%';
    table.innerHTML=`<thead><tr><th rowspan="2">Mix</th><th colspan="${Math.max(1,temperatures.length)}">${escapeHtml(metricLabel(metric))} — Mean ± SD (${unit})</th></tr><tr>${temperatures.map(temp=>`<th>${temp}°C</th>`).join('')}</tr></thead><tbody>${mixes.map(mix=>`<tr><td>${mix}</td>${temperatures.map(temp=>{
      const values=rows.filter(row=>row.mix===mix&&row.temperature===temp).map(row=>metricValue(row,metric)).filter(Number.isFinite);
      return `<td class="${values.length?'':'empty-cell'}">${values.length?`${formatValue(mean(values),1)} ± ${formatValue(sd(values),1)}`:'—'}</td>`;
    }).join('')}</tr>`).join('')}</tbody>`;
  }
  function renderInsights(analysis,rows){
    const list=byId('graphInsights'),items=[],measured=currentMetricRows(rows,analysis.metric);
    const selected=selectedMixes().length*selectedTemperatures().length*3;
    if(analysis.id==='completion'){
      const count=rows.filter(row=>row.present).length,percent=rows.length?count/rows.length*100:0;
      items.push(`${count} of ${rows.length} selected specimen slots have recorded measurements (${formatValue(percent,1)}%).`);
      items.push(`${rows.length-count} selected specimen slots have no measured values yet.`);
    }else if(analysis.id==='condition-distribution'){
      const observed=rows.filter(row=>row.present),conditions=new Map();observed.forEach(row=>conditions.set(row.condition,(conditions.get(row.condition)||0)+1));
      const top=[...conditions.entries()].sort((a,b)=>b[1]-a[1])[0];
      items.push(`${observed.length} specimens with recorded measurements are included in the condition distribution.`);
      if(top)items.push(`Most frequent recorded condition: ${top[0]} (${top[1]} specimens).`);
      items.push('Specimens without measurements are excluded from the condition categories.');
    }else if(!measured.length){
      items.push('No measured values are available for this analysis and filter selection.');
      items.push('Missing measurements are left blank and are not counted as zero.');
    }else{
      items.push(`${measured.length} measured values from ${rows.length} selected specimen slots are included.`);
      const mixMeans=selectedMixes().map(mix=>({mix,value:mean(measured.filter(item=>item.row.mix===mix).map(item=>item.value))})).filter(item=>Number.isFinite(item.value));
      if(mixMeans.length){
        const best=mixMeans.reduce((a,b)=>b.value>a.value?b:a),worst=mixMeans.reduce((a,b)=>b.value<a.value?b:a);
        items.push(`${best.mix} has the highest selected mean ${metricLabel(analysis.metric).toLowerCase()} (${formatValue(best.value,2)}); ${worst.mix} has ${formatValue(worst.value,2)}.`);
      }
      if(analysis.metric==='residual'){
        const lowTemp=Math.min(...selectedTemperatures()),highTemp=Math.max(...selectedTemperatures());
        const low=mean(measured.filter(item=>item.row.temperature===lowTemp).map(item=>item.value)),high=mean(measured.filter(item=>item.row.temperature===highTemp).map(item=>item.value));
        if(lowTemp!==highTemp&&Number.isFinite(low)&&Number.isFinite(high))items.push(`Across selected mixes, mean residual strength changes from ${formatValue(low,1)}% at ${lowTemp}°C to ${formatValue(high,1)}% at ${highTemp}°C.`);
      }else if(analysis.metric==='mass_loss'){
        const tempValues=selectedTemperatures().map(temp=>({temp,value:mean(measured.filter(item=>item.row.temperature===temp).map(item=>item.value))})).filter(item=>Number.isFinite(item.value));
        if(tempValues.length>1){const top=tempValues.reduce((a,b)=>b.value>a.value?b:a);items.push(`Highest average mass loss among selected temperatures: ${formatValue(top.value,2)}% at ${top.temp}°C.`);}
      }
      if(analysis.id==='radar-multi')items.push('Radar values are normalized from 0 to 100 within this selection; mass retention is shown as 100 minus mass loss.');
    }
    if(items.length<3)items.push(`Selection covers ${selected} planned specimen slots (${selectedMixes().length} mixes × ${selectedTemperatures().length} temperatures × 3 replicates).`);
    list.innerHTML=items.slice(0,3).map(item=>`<li>${escapeHtml(item)}</li>`).join('');
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

  function bindPage(){
    document.querySelectorAll('.graph-category-tab').forEach(button=>button.addEventListener('click',()=>{
      activeCategory=button.dataset.category;
      document.querySelectorAll('.graph-category-tab').forEach(tab=>tab.classList.toggle('active',tab===button));
      refreshAnalysisOptions();
      renderChosenAnalysis();
    }));
    byId('graphTypeSelect').addEventListener('change',()=>{fillAnalyses();renderChosenAnalysis();});
    byId('analysisSelect').addEventListener('change',()=>{activeAnalysis=catalog.find(item=>item.id===byId('analysisSelect').value);if(activeAnalysis)byId('graphTypeSelect').value=normalizedType(activeAnalysis.type);renderChosenAnalysis();});
    byId('generateGraph').addEventListener('click',renderChosenAnalysis);
    document.querySelectorAll('.mix-checkbox,.temperature-checkbox,input[name="dataDisplay"],#showErrorBars').forEach(input=>input.addEventListener('change',()=>{updatePickerSummaries();setStatus('Options updated · Generate graph to apply them.');}));
    document.querySelectorAll('.graph-data-tab').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('.graph-data-tab').forEach(tab=>tab.classList.toggle('active',tab===button));
    }));
    byId('resetGraph').addEventListener('click',()=>{
      document.querySelectorAll('.mix-checkbox').forEach(input=>input.checked=['M0','M2','M4','M6','M8'].includes(input.value));
      document.querySelectorAll('.temperature-checkbox').forEach(input=>input.checked=true);
      document.querySelector('input[name="dataDisplay"][value="average"]').checked=true;byId('showErrorBars').checked=true;
      activeCategory='strength';document.querySelectorAll('.graph-category-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.category===activeCategory));refreshAnalysisOptions('residual-temperature');updatePickerSummaries();renderChosenAnalysis();
    });
    byId('downloadPng').addEventListener('click',downloadPng);
    byId('exportExcel').addEventListener('click',exportExcel);
    byId('saveGraph').addEventListener('click',saveGraph);
    window.addEventListener('resize',()=>{if(activeAnalysis&&activeAnalysis.type==='heatmap')renderChosenAnalysis();else if(activeAnalysis&&activeAnalysis.type==='box')renderChosenAnalysis();});
  }
  function downloadPng(){
    const canvas=byId('mainChart').hidden?byId('boxPlotView'):byId('mainChart');
    if(!canvas||canvas.hidden)return;
    const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download=`SCGPC_${(activeAnalysis?.id||'Graph').replace(/[^a-z0-9-]/gi,'_')}.png`;link.click();
  }
  function exportExcel(){
    const params=new URLSearchParams({mixes:selectedMixes().join(','),temperatures:selectedTemperatures().join(',')});
    window.location.href=`/export/graphs.xlsx?${params.toString()}`;
  }
  function saveGraph(){
    const analysis=catalog.find(item=>item.id===byId('analysisSelect').value);if(!analysis)return;
    const saved=JSON.parse(localStorage.getItem('scgpc-saved-graphs')||'[]');
    saved.unshift({analysis:analysis.id,mixes:selectedMixes(),temperatures:selectedTemperatures(),display:document.querySelector('input[name="dataDisplay"]:checked')?.value||'average',savedAt:new Date().toISOString()});
    localStorage.setItem('scgpc-saved-graphs',JSON.stringify(saved.slice(0,20)));
    const button=byId('saveGraph'),original=button.innerHTML;button.innerHTML='✓ <span>Saved locally</span>';setTimeout(()=>button.innerHTML=original,1800);
  }
  async function init(){
    bindPage();updatePickerSummaries();refreshAnalysisOptions('residual-temperature');
    try{
      const response=await fetch('/api/graphs/data',{credentials:'same-origin'});
      if(!response.ok)throw new Error(`Graph data request failed (${response.status})`);
      const payload=await response.json();records=payload.records||[];specimenSummary=payload.summary||{};
      byId('specimenTotal').textContent=specimenSummary.specimens??144;
      byId('completionSummary').textContent=`${specimenSummary.mixes??12} × ${specimenSummary.temperatures??4} × ${specimenSummary.replicates??3}`;
      renderChosenAnalysis();
    }catch(error){
      setStatus(error.message||'Unable to load specimen data.',true);showEmpty();
    }
  }
  document.addEventListener('DOMContentLoaded',init);
})();

