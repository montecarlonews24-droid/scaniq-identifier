// SCANIQ — application logic: UI rendering, scanning, all feature modes.
// Depends on the globals defined in archive-data.js, which must load first.

let globalRank=1;
const cg=document.getElementById('cats-grid');
TIERS.forEach(tier=>{
  /* Tier label spanning all 3 cols */
  const lbl=document.createElement('div');
  lbl.className='tier-sep '+tier.tcls;
  lbl.innerHTML=tier.label+' <span></span>';
  cg.appendChild(lbl);
  /* Cards */
  tier.keys.forEach(key=>{
    const cat=CATS.find(c=>c.key===key);
    if(!cat)return;
    const rank=globalRank++;
    const d=document.createElement('div');
    d.className='cat-card '+tier.tcls;
    d.innerHTML='<div class="cat-rank">#'+rank+'</div><div class="be">'+cat.e+'</div><div class="cn">'+cat.n+'</div>';
    d.onclick=()=>{
      sp('scan',document.querySelector('.nav-btn'));
      document.querySelectorAll('.cat-chip').forEach(ch=>ch.classList.remove('active'));
      const chip=document.querySelector('[data-cat="'+cat.key+'"]');
      if(chip){chip.classList.add('active');chip.scrollIntoView({behavior:'smooth',inline:'center'});}
      selCat=cat.key;
    };
    cg.appendChild(d);
  });
});

/* Build archive info page */
const ail=document.getElementById('archive-info-list');
if(ail){
CATS.forEach(c=>{
  const arc=ARCHIVE_DB[c.key];
  if(!arc)return;
  const div=document.createElement('div');
  div.className='arc-info-card';
  const tags=arc.sources.map(s=>'<span class="arc-info-tag">'+s.icon+' '+s.name+'</span>').join('');
  div.innerHTML='<div class="arc-info-cat">'+c.e+' '+c.key.toUpperCase()+'</div><div class="arc-info-title">'+c.n+'</div><div class="arc-info-sources">'+tags+'</div>';
  ail.appendChild(div);
});
}

/* ===== NAV ===== */

function sp(n,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+n).classList.add('active');
  if(el)el.classList.add('active');
  if(n==='hist')renderFullHist();
}
const fi=document.getElementById('file-input');
const dz=document.getElementById('drop-zone');
const pi=document.getElementById('preview-img');
const dph=document.getElementById('drop-ph');
const tgt=document.getElementById('tgt');
fi.addEventListener('change',e=>{if(e.target.files[0])loadImg(e.target.files[0]);});
dz.addEventListener('dragover',e=>{e.preventDefault();dz.style.borderColor='var(--cyan)';});
dz.addEventListener('dragleave',()=>dz.style.borderColor='');
dz.addEventListener('drop',e=>{e.preventDefault();dz.style.borderColor='';const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadImg(f);});
function loadImg(f){
  imgMime=f.type||'image/jpeg';
  const r=new FileReader();
  r.onload=ev=>{
    imgB64=ev.target.result.split(',')[1];
    pi.src=ev.target.result;pi.style.display='block';
    dph.style.display='none';tgt.style.display='none';
    dz.classList.add('has-image');
    document.getElementById('btn-scan').disabled=false;
    document.getElementById('results-wrap').style.display='none';
    document.getElementById('err-box').classList.remove('show');
  };
  r.readAsDataURL(f);
}
const ficEl=document.getElementById('file-input-cam');
if(ficEl)ficEl.addEventListener('change',e=>{if(e.target.files[0])loadImg(e.target.files[0]);});

const cs=document.getElementById('cat-scroll');
function mkChip(key,e,n){
  const d=document.createElement('div');
  d.className='chip'+(key==='auto'?' active':'');d.dataset.cat=key;
  d.innerHTML=e+' '+n;
  d.onclick=()=>{document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));d.classList.add('active');selCat=key;};
  cs.appendChild(d);
}
mkChip('auto','&#129302;','Auto');
CATS.forEach(c=>mkChip(c.key,c.e,c.n));

function buildPrompt(cat){
  const arc=getArchive(cat);
  const info=CATS.find(c=>c.key===cat);
  const ctx=info?'Category: "'+info.n+'"':'Auto-detect category';
  const dims=arc.dims;
  const needsLive=arc.live;
  const srcInstr=arc.sources.map(s=>'- '+s.name+' ('+s.url+'): '+s.info).join('\n');
  const dimBlock=dims.map(d=>'"'+d+'":{"score":0,"note":"","archive_ref":""}').join(',');
  const deep=document.getElementById('t-deep').classList.contains('on');
  return 'You are SCANIQ, the world\'s most advanced visual intelligence system.\n'+ctx+'\n\n'+
    '=== KNOWLEDGE ARCHIVES ===\nReason with expert knowledge from these authoritative sources:\n'+srcInstr+'\n\n'+
    'Apply their classification standards, grading systems, and pricing methodologies precisely.\n\n'+
    '=== OUTPUT: PURE JSON ONLY — NO MARKDOWN ===\n'+
    '{\n"name":"",\n"subtitle":"scientific name / model number / catalog ID",\n"category":"",\n"category_emoji":"",\n'+
    '"confidence":"High|Medium|Low",\n'+
    '"price":{"value":"price or N/A","unit":"per unit/kg/m2 etc","note":"retail/auction/estimated","is_live_needed":'+needsLive+'},\n'+
    '"description":"'+(deep?'4-5':'2-3')+' expert sentences",\n'+
    '"details":[{"label":"Classification / ID","value":"e.g. IUCN LC · NGC MS65"},{"label":"Origin","value":""},{"label":"Era / Date","value":""},{"label":"Material","value":""}],\n'+
    '"value_matrix":{'+dimBlock+'},\n'+
    '"overall_value_score":0,\n"overall_verdict":"short punchy phrase",\n"overall_explanation":"1-2 sentences",\n'+
    '"legal_status":"cite laws if applicable, else empty",\n"market_note":"market dynamics",\n'+
    '"facts":["fact 1","fact 2","fact 3"'+(deep?',"fact 4","fact 5"':'')+']\n}\n\n'+
    'MATRIX: score 0-10 integer, note=one precise sentence with archive reference, archive_ref=source name, overall_value_score=weighted 0-100';
}

async function runScan(){
  if(!imgB64){showErr('No image loaded. Please select an image first.');return;}
  const deep=document.getElementById('t-deep').classList.contains('on');
  const scanB64=imgB64, scanMime=imgMime; /* snapshot at button-press time */
  document.getElementById('loading').classList.add('show');
  document.getElementById('results-wrap').style.display='none';
  document.getElementById('err-box').classList.remove('show');
  document.getElementById('btn-scan').disabled=true;
  dz.classList.add('scanning');
  const arc=getArchive(selCat);
  document.getElementById('lt').textContent='SCANNING...';
  document.getElementById('ls').textContent='Please wait';
  const msgs=[['VISUAL ANALYSIS','Claude Vision mapping image'],['ARCHIVE QUERY','Cross-referencing '+arc.sources.length+' knowledge bases'],['VALUE MATRIX','Multi-dimensional assessment'],['COMPILING','Finalizing intelligence report']];
  let mi=0;
  const it=setInterval(()=>{mi=(mi+1)%msgs.length;document.getElementById('lt').textContent=msgs[mi][0];document.getElementById('ls').textContent=msgs[mi][1];},2000);
  const needsLive=arc.live&&document.getElementById('t-live').classList.contains('on');
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:deep?4000:2000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:scanMime,data:scanB64}},
      {type:'text',text:buildPrompt(selCat)}
    ]}]};
    if(needsLive)body.tools=[{type:'web_search_20250305',name:'web_search'}];
    const bodyStr=JSON.stringify(body);
    let raw='',lastErr;
    for(let attempt=0;attempt<3;attempt++){
      try{
        if(attempt>0){document.getElementById('lt').textContent='RETRY '+attempt+' OF 3';document.getElementById('ls').textContent='High demand — please wait...';await new Promise(r=>setTimeout(r,2500));}
        const resp=await fetch(API_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:bodyStr});
        const data=await resp.json();
        const errMsg=data.error?.message||'';
        if(!resp.ok||errMsg){lastErr=new Error(errMsg||'API Error '+resp.status);continue;}
        raw='';for(const b of(data.content||[])){if(b.type==='text')raw+=b.text;}
        break;
      }catch(e){lastErr=e;}
    }
    if(!raw)throw lastErr||new Error('Connection failed. Check internet.');
    const clean=raw
      .replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'')
      .replace(/[\u2018\u2019]/g,"'")
      .replace(/[\u201C\u201D]/g,'"')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'')
      .trim();
    let result;
    try{const m=clean.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON found');result=JSON.parse(m[0]);}catch{throw new Error('Parse error. Retry.');}
    clearInterval(it);dz.classList.remove('scanning');document.getElementById('loading').classList.remove('show');
    try{scanCount++;localStorage.setItem('sq4_cnt',scanCount);}catch{}
    document.getElementById('scan-counter').textContent=scanCount;
    const item={id:Date.now(),thumb:pi.src,result,ts:new Date().toISOString(),cat:selCat};
    renderResult(result,needsLive,selCat);
    if(document.getElementById('t-hist').classList.contains('on')){
      hist.unshift(item);
      if(hist.length>20)hist=hist.slice(0,20);
      let saved=false;
      while(!saved){
        try{localStorage.setItem('sq4_hist',JSON.stringify(hist));saved=true;}
        catch{if(hist.length>1){hist=hist.slice(0,Math.ceil(hist.length/2));}else{hist=[];saved=true;}}
      }
    }
    renderRecentHist();
    document.getElementById('btn-scan').disabled=false;
    /* Reset file inputs so re-selecting the same image triggers change event */
    try{fi.value='';}catch{}
    try{if(ficEl)ficEl.value='';}catch{}
  }catch(err){
    clearInterval(it);dz.classList.remove('scanning');
    document.getElementById('loading').classList.remove('show');
    document.getElementById('btn-scan').disabled=false;
    showErr(err.message);
  }
}

function renderResult(r,isLive,cat){
  const showMatrix=document.getElementById('t-matrix').classList.contains('on');
  const dims=getDims(cat==='auto'?'default':cat);
  const vm=r.value_matrix||{};
  const ov=Math.min(100,Math.max(0,parseInt(r.overall_value_score)||0));
  const rc=ov>=80?'var(--cyan)':ov>=60?'var(--green)':ov>=40?'#f59e0b':'var(--red)';
  const circ=2*Math.PI*29,dash=circ*(ov/100);
  let matrixHtml='';
  if(showMatrix&&dims.length){
    const rows=dims.map((dk,ri)=>{
      const dv=vm[dk]||{score:0,note:'',archive_ref:''};
      const meta=DMETA[dk]||{e:'·',l:dk,c:'#8ab0cc'};
      const sc=Math.min(10,Math.max(0,parseInt(dv.score)||0));
      const bc=sc>=8?'vs-top':sc>=6?'vs-hi':sc>=4?'vs-mid':'vs-low';
      const full=Math.floor(sc/2),half=sc%2===1;
      const stars=Array.from({length:5},(_,i)=>{
        const dl=(ri*5+i)*0.05+'s';
        if(i<full)return'<span class="st" style="animation-delay:'+dl+'">&#11088;</span>';
        if(i===full&&half)return'<span class="st" style="animation-delay:'+dl+'">&#127775;</span>';
        return'<span class="st" style="animation-delay:'+dl+';opacity:.12;filter:grayscale(1)">&#11088;</span>';
      }).join('');
      return'<div class="vm-row"><div class="vm-row-top"><div class="vm-label">'+meta.e+' '+meta.l+'</div><span class="vm-score '+bc+'">'+sc+'/10</span></div>'+
        '<div class="vm-bar-track"><div class="vm-bar-fill" style="--tw:'+(sc*10)+'%;background:'+meta.c+'"></div></div>'+
        '<div class="vm-stars">'+stars+'</div>'+
        (dv.note?'<div class="vm-note">'+dv.note+(dv.archive_ref?' <em style="color:var(--violet2);font-style:normal">// '+dv.archive_ref+'</em>':'')+'</div>':'')+
      '</div>';
    }).join('');
    matrixHtml='<div class="score-wrap"><div class="score-ring"><svg width="66" height="66" viewBox="0 0 66 66"><circle class="sr-bg" cx="33" cy="33" r="29"/><circle class="sr-fill" cx="33" cy="33" r="29" stroke="'+rc+'" stroke-dasharray="'+dash+' '+circ+'" stroke-dashoffset="0"/></svg><div class="sr-text" style="color:'+rc+'">'+ov+'</div></div><div class="score-info"><div class="score-eye">OVERALL VALUE</div><div class="score-verdict" style="color:'+rc+'">'+(r.overall_verdict||'—')+'</div><div class="score-exp">'+(r.overall_explanation||'')+'</div></div></div>'+
      '<div class="vm-wrap"><div class="vm-head">VALUE MATRIX</div>'+rows+'</div>';
  }
  const priceHtml=r.price?.value&&r.price.value!=='N/A'?'<div class="price-card"><div class="price-eye">ESTIMATED MARKET VALUE</div><div class="price-val">'+r.price.value+'</div><div class="price-note">'+(r.price.unit||'')+' · '+(r.price.note||'')+'</div>'+(isLive?'<div class="live-pill">LIVE FEED</div>':'<div class="est-pill">ESTIMATED</div>')+'</div>':'';
  const detsHtml=(r.details||[]).map(d=>'<div class="det-item"><div class="det-label">'+d.label+'</div><div class="det-val">'+(d.value||'—')+'</div></div>').join('');
  const factsHtml=(r.facts||[]).map(f=>'<div class="fact"><div class="fact-dot"></div><div>'+f+'</div></div>').join('');
  document.getElementById('result-card').innerHTML=
    '<div class="result-header"><span class="id-badge">&#10003; IDENTIFIED</span><span style="font-size:.88rem">'+(r.category_emoji||'&#128300;')+' '+(r.category||'')+'</span><span class="conf-badge">'+(r.confidence||'')+'</span></div>'+
    '<div class="result-body">'+
      '<div class="result-name">'+(r.name||'Unknown')+'</div>'+
      '<div class="result-sub">'+(r.subtitle||'')+'</div>'+
      priceHtml+
      '<div class="result-desc">'+(r.description||'')+'</div>'+
      matrixHtml+
      (r.legal_status?'<div class="legal-card"><div class="legal-eye">PROTECTION STATUS</div>'+r.legal_status+'</div>':'')+
      (detsHtml?'<div class="det-grid">'+detsHtml+'</div>':'')+
      (r.market_note?'<div class="market-card"><div class="market-eye">MARKET INTELLIGENCE</div><div style="font-size:.8rem;color:var(--text2)">'+r.market_note+'</div></div>':'')+
      (factsHtml?'<div class="facts-head">KEY INTELLIGENCE</div>'+factsHtml:'')+
    '</div>';
  document.getElementById('results-wrap').style.display='block';
  document.getElementById('results-wrap').scrollIntoView({behavior:'smooth',block:'start'});
  renderScanChat(r,'default');
}

function histHtml(h,full){
  return `<div class="hist-item" onclick="replayResult(${h.id})"><img class="hist-thumb" src="${h.thumb}" alt="" onerror="this.style.display='none'"><div class="hist-info"><div class="hist-name">${h.result?.name||'Unknown'}</div><div class="hist-meta">${h.result?.category||''}${full?' · '+(h.result?.overall_value_score||'?'):''}  ${timeAgo(h.ts)}</div></div><div class="hist-price">${h.result?.price?.value||''}</div></div>`;
}
function renderRecentHist(){
  const sec=document.getElementById('hist-section');
  if(!hist.length){sec.classList.remove('show');return;}
  sec.classList.add('show');
  document.getElementById('hist-list').innerHTML=hist.slice(0,5).map(h=>histHtml(h,false)).join('');
}
function renderFullHist(){
  const g=document.getElementById('full-hist');
  if(!hist.length){g.innerHTML='<div style="padding:48px 0;text-align:center;color:var(--text3);font-family:JetBrains Mono,monospace;font-size:.76rem">// ARCHIVE EMPTY<br>Initialize first scan</div>';return;}
  g.innerHTML='<div style="display:flex;flex-direction:column;gap:7px;padding-bottom:20px;">'+hist.map(h=>histHtml(h,true)).join('')+'</div>';
}
function replayResult(id){
  const item=hist.find(h=>h.id===id);if(!item)return;
  sp('scan',document.querySelector('.nav-btn'));
  pi.src=item.thumb;pi.style.display='block';dph.style.display='none';tgt.style.display='none';
  dz.classList.add('has-image');
  renderResult(item.result,false,item.cat||'auto');
  document.getElementById('results-wrap').scrollIntoView({behavior:'smooth'});
}
function clearHist(){if(confirm('Clear all scan history?')){hist=[];localStorage.removeItem('sq4_hist');renderRecentHist();renderFullHist();}}
function timeAgo(iso){const d=Date.now()-new Date(iso).getTime(),m=Math.floor(d/60000);if(m<1)return'now';if(m<60)return m+'m';const h=Math.floor(m/60);if(h<24)return h+'h';return Math.floor(h/24)+'d';}
function showErr(msg){const b=document.getElementById('err-box');b.textContent='ERROR // '+msg;b.classList.add('show');b.scrollIntoView({behavior:'smooth'});}
renderRecentHist();

/* ===== MODE SWITCHING ===== */
function switchMode(m){
  ['scan','face','facematch','auth','nutri','ocr','qr'].forEach(id=>{
    const el=document.getElementById('mode-'+id);if(el)el.style.display=(id===m)?'block':'none';
    const t=document.getElementById('tab-'+id);if(t)t.classList.toggle('active',id===m);
  });
}

/* ===== NUTRITION SCAN ===== */
let nutriB64=null,nutriMime='image/jpeg';
let foodLog=JSON.parse(localStorage.getItem('sq4_food_log')||'[]');
let lastNutriResult=null;
document.getElementById('fi-nutri').addEventListener('change',e=>{if(e.target.files[0])loadNutriImg(e.target.files[0]);});
document.getElementById('fi-nutri-cam').addEventListener('change',e=>{if(e.target.files[0])loadNutriImg(e.target.files[0]);});
function loadNutriImg(f){
  nutriMime=f.type||'image/jpeg';
  const r=new FileReader();
  r.onload=ev=>{
    nutriB64=ev.target.result.split(',')[1];
    const img=document.getElementById('prev-nutri');
    img.src=ev.target.result;img.style.display='block';
    document.getElementById('dph-nutri').style.display='none';
    document.getElementById('drop-zone-nutri').classList.add('has-image');
    document.getElementById('btn-nutri').disabled=false;
    document.getElementById('nutri-result').style.display='none';
  };r.readAsDataURL(f);
}
async function runNutriScan(){
  document.getElementById('loading-nutri').classList.add('show');
  document.getElementById('btn-nutri').disabled=true;
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:nutriMime,data:nutriB64}},
      {type:'text',text:'You are a professional nutritionist AI. Analyze this food image and return PURE JSON ONLY:\n{"food_identified":true,"dish_name":"","cuisine":"","serving_estimate":"e.g. 1 plate ~350g","calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"sugar_g":0,"sodium_mg":0,"vitamins":[""],"health_score":0,"health_label":"Excellent|Good|Moderate|Poor","ingredients_detected":[""],"allergens":[""],"diet_tags":["Vegan","Gluten-Free","etc"],"tips":["healthy tip 1","tip 2"],"disclaimer":"Estimates may vary. Consult a dietitian for medical advice."}\nhealth_score 0-100. If no food visible set food_identified:false.'}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok)throw new Error('API Error '+resp.status);
    const data=await resp.json();
    let raw='';for(const b of(data.content||[]))if(b.type==='text')raw+=b.text;
    const r=JSON.parse((()=>{const c=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').trim();const m=c.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON found');return m[0];})());
    document.getElementById('btn-nutri').disabled=false;
    if(!r.food_identified){showErrBox('err-nutri','No food detected. Try a clearer photo of your meal.');return;}
    lastNutriResult=r;
    const hc=r.health_score>=80?'var(--green)':r.health_score>=60?'#f59e0b':'var(--red)';
    const macros=[
      {l:'Calories',v:r.calories,u:'kcal',c:'#f59e0b'},
      {l:'Protein',v:r.protein_g,u:'g',c:'var(--cyan)'},
      {l:'Carbs',v:r.carbs_g,u:'g',c:'var(--gold)'},
      {l:'Fat',v:r.fat_g,u:'g',c:'var(--violet2)'},
    ];
    const macroHtml=macros.map(m=>`<div class="nutri-macro"><div class="nutri-macro-val" style="color:${m.c}">${m.v}</div><div class="nutri-macro-lbl">${m.l}<br>${m.u}</div></div>`).join('');
    const total=r.protein_g+r.carbs_g+r.fat_g||1;
    const bars=[
      {l:'Protein',v:r.protein_g,pct:Math.round(r.protein_g/total*100),c:'var(--cyan)'},
      {l:'Carbs',v:r.carbs_g,pct:Math.round(r.carbs_g/total*100),c:'var(--gold)'},
      {l:'Fat',v:r.fat_g,pct:Math.round(r.fat_g/total*100),c:'var(--violet2)'},
      {l:'Fiber',v:r.fiber_g,pct:Math.min(100,Math.round(r.fiber_g/30*100)),c:'var(--green)'},
    ];
    const barsHtml=bars.map(b=>`<div class="nutri-bar-wrap"><div class="nutri-bar-label"><span>${b.l} ${b.v}g</span><span style="color:var(--text3)">${b.pct}%</span></div><div class="nutri-bar-track"><div class="nutri-bar-fill" style="--tw:${b.pct}%;background:${b.c}"></div></div></div>`).join('');
    const tags=(r.diet_tags||[]).map(t=>`<span style="padding:3px 9px;border-radius:50px;border:1px solid var(--rim);background:var(--card2);font-size:.64rem;color:var(--text3)">${t}</span>`).join('');
    const allergens=(r.allergens||[]).filter(Boolean);
    const tips=(r.tips||[]).map(t=>`<div class="fact"><div class="fact-dot"></div><div>${t}</div></div>`).join('');
    document.getElementById('nutri-card-content').innerHTML=`
      <div class="nutri-card">
        <div class="nutri-eye">NUTRITION INTELLIGENCE</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div><div class="nutri-name">${r.dish_name||'Unknown Food'}</div><div style="font-size:.7rem;color:var(--text3)">${r.cuisine||''} · ${r.serving_estimate||''}</div></div>
          <div style="text-align:center;background:var(--card2);border-radius:8px;padding:6px 10px;min-width:52px"><div style="font-family:Orbitron,monospace;font-size:.95rem;font-weight:700;color:${hc}">${r.health_score}</div><div style="font-size:.56rem;color:var(--text3)">HEALTH</div></div>
        </div>
        <div class="nutri-macros">${macroHtml}</div>
        ${barsHtml}
        ${tags?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">${tags}</div>`:''}
        ${allergens.length?`<div style="margin-top:8px;padding:7px 10px;border-radius:8px;background:rgba(255,68,102,.07);border:1px solid rgba(255,68,102,.15);font-size:.72rem;color:#ff8899">⚠️ Allergens: ${allergens.join(', ')}</div>`:''}
        <button class="nutri-log-btn" onclick="logFood()">+ Add to Today's Food Log</button>
      </div>
      ${tips?`<div class="facts-head" style="color:var(--green)">NUTRITION TIPS</div>${tips}`:''}
      <div style="font-size:.64rem;color:var(--text3);margin-top:10px;font-family:JetBrains Mono,monospace">// ${r.disclaimer||'Estimates only'}</div>`;
    document.getElementById('nutri-result').style.display='block';
    renderFoodLog();
    renderScanChat(r,'nutri');
  }catch(err){
    document.getElementById('loading-nutri').classList.remove('show');
    document.getElementById('btn-nutri').disabled=false;
    showErrBox('err-nutri',err.message);
  }
}
function logFood(){
  if(!lastNutriResult)return;
  const today=new Date().toDateString();
  foodLog=foodLog.filter(x=>x.date===today);
  foodLog.push({date:today,name:lastNutriResult.dish_name||'Food',cal:lastNutriResult.calories||0,ts:Date.now()});
  try{localStorage.setItem('sq4_food_log',JSON.stringify(foodLog));}catch{if(foodLog.length>1){foodLog=foodLog.slice(0,Math.ceil(foodLog.length/2));try{localStorage.setItem('sq4_food_log',JSON.stringify(foodLog));}catch{}}}
  renderFoodLog();
  const btn=document.querySelector('.nutri-log-btn');if(btn)btn.textContent='✅ Added!';
}
function renderFoodLog(){
  const today=new Date().toDateString();
  const todayItems=foodLog.filter(x=>x.date===today);
  const sec=document.getElementById('food-log-section');
  if(!todayItems.length){sec.style.display='none';return;}
  sec.style.display='block';
  document.getElementById('food-log-date').textContent=today;
  const total=todayItems.reduce((a,b)=>a+b.cal,0);
  document.getElementById('food-log-list').innerHTML=todayItems.map(i=>`<div class="food-log-item"><span>${i.name}</span><span class="food-log-cal">${i.cal} kcal</span></div>`).join('');
  document.getElementById('food-log-total').textContent=total+' kcal';
}

/* ===== OCR + DOCUMENT SCANNER ===== */
let ocrB64=null,ocrMime='image/jpeg',ocrExtractedText='',ocrSummary='',ocrTodos=[];
document.getElementById('fi-ocr').addEventListener('change',e=>{if(e.target.files[0])loadOCRImg(e.target.files[0]);});
document.getElementById('fi-ocr-cam').addEventListener('change',e=>{if(e.target.files[0])loadOCRImg(e.target.files[0]);});
function loadOCRImg(f){
  ocrMime=f.type||'image/jpeg';
  const r=new FileReader();
  r.onload=ev=>{
    ocrB64=ev.target.result.split(',')[1];
    const img=document.getElementById('prev-ocr');
    img.src=ev.target.result;img.style.display='block';
    document.getElementById('dph-ocr').style.display='none';
    document.getElementById('drop-zone-ocr').classList.add('has-image');
    document.getElementById('btn-ocr').disabled=false;
    document.getElementById('ocr-result').classList.remove('show');
  };r.readAsDataURL(f);
}
async function runOCR(){
  document.getElementById('loading-ocr').classList.add('show');
  document.getElementById('btn-ocr').disabled=true;
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:3000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:ocrMime,data:ocrB64}},
      {type:'text',text:'You are an expert OCR and document analysis AI. Extract ALL text from this image and return PURE JSON ONLY:\n{"extracted_text":"full text verbatim preserving line breaks","summary":"2-4 sentence summary of the document","key_points":["point 1","point 2","point 3"],"todos":["actionable item 1","item 2"],"doc_type":"Invoice|Letter|Note|Article|Form|Receipt|Book|Other","language_detected":"English|Arabic|etc","word_count":0}\nIf no text found set extracted_text to empty string.'}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok)throw new Error('API Error '+resp.status);
    const data=await resp.json();
    let raw='';for(const b of(data.content||[]))if(b.type==='text')raw+=b.text;
    const r=JSON.parse((()=>{const c=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').trim();const m=c.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON found');return m[0];})());
    document.getElementById('loading-ocr').classList.remove('show');
    document.getElementById('btn-ocr').disabled=false;
    if(!r.extracted_text){showErrBox('err-ocr','No text detected. Try a clearer image.');return;}
    ocrExtractedText=r.extracted_text;
    ocrSummary=r.summary||'';
    ocrTodos=r.todos||[];
    document.getElementById('ocr-text-content').textContent=r.extracted_text;
    document.getElementById('ocr-summary-content').innerHTML=`<div style="font-size:.7rem;color:var(--text3);font-family:JetBrains Mono,monospace;margin-bottom:8px">${r.doc_type||'Document'} · ${r.language_detected||'Unknown'} · ${r.word_count||0} words</div><p>${r.summary||''}</p>${(r.key_points||[]).map(p=>`<div class="fact" style="margin-top:5px"><div class="fact-dot"></div><div>${p}</div></div>`).join('')}`;
    document.getElementById('ocr-todos-content').innerHTML=ocrTodos.length?ocrTodos.map((t,i)=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-top:1px solid var(--rim2)"><input type="checkbox" id="todo-${i}" style="margin-top:4px;accent-color:var(--cyan)"><label for="todo-${i}" style="font-size:.82rem;color:var(--text2);cursor:pointer">${t}</label></div>`).join(''):'<div style="color:var(--text3);font-size:.78rem;padding:10px 0">No action items detected</div>';
    document.getElementById('ocr-result').classList.add('show');
    buildOCRChat(r);
  }catch(err){
    document.getElementById('loading-ocr').classList.remove('show');
    document.getElementById('btn-ocr').disabled=false;
    showErrBox('err-ocr',err.message);
  }
}
function switchOcrTab(name,el){
  document.querySelectorAll('.ocr-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.ocr-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ocr-panel-'+name).classList.add('active');
}
function copyOCR(){navigator.clipboard.writeText(ocrExtractedText).then(()=>{const b=document.querySelector('.ocr-act');if(b)b.textContent='✅ Copied!';setTimeout(()=>{if(b)b.textContent='📋 Copy All';},2000);});}
function shareOCR(){if(navigator.share)navigator.share({text:ocrExtractedText});else navigator.clipboard.writeText(ocrExtractedText);}
async function runTranslate(){
  if(!ocrExtractedText){alert('Extract text first.');return;}
  const lang=document.getElementById('translate-lang').value;
  const wrap=document.getElementById('ocr-translate-content');
  const loading=document.getElementById('loading-translate');
  wrap.textContent='';loading.classList.add('show');
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:`Translate the following text to ${lang}. Return ONLY the translated text, no explanations:\n\n${ocrExtractedText}`}]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok)throw new Error('API Error '+resp.status);
    const data=await resp.json();
    let translated='';for(const b of(data.content||[]))if(b.type==='text')translated+=b.text;
    loading.classList.remove('show');
    wrap.innerHTML=`<div class="ocr-text-area">${translated}</div><div class="ocr-action-row"><button class="ocr-act" onclick="navigator.clipboard.writeText(this.closest('.ocr-panel').querySelector('.ocr-text-area').textContent).then(()=>this.textContent='✅ Copied!')">📋 Copy</button></div>`;
  }catch(err){loading.classList.remove('show');wrap.textContent='Error: '+err.message;}
}
function buildOCRChat(ocrData){
  const wrap=document.getElementById('ocr-chat-wrap');
  wrap.innerHTML=`<div class="chat-wrap show">
    <div class="chat-head">ASK ABOUT THIS DOCUMENT</div>
    <div class="chat-suggestions" id="ocr-chat-sugs">
      <div class="chat-sug" onclick="sendOCRChat('Summarize this in bullet points')">📋 Bullet summary</div>
      <div class="chat-sug" onclick="sendOCRChat('What are the key dates mentioned?')">📅 Key dates</div>
      <div class="chat-sug" onclick="sendOCRChat('Who are the people mentioned?')">👤 People</div>
      <div class="chat-sug" onclick="sendOCRChat('What action is required from me?')">✅ Actions needed</div>
    </div>
    <div class="chat-messages" id="ocr-chat-messages"></div>
    <div class="chat-input-row">
      <input class="chat-inp" id="ocr-chat-inp" placeholder="Ask about this document..." onkeydown="if(event.key==='Enter')sendOCRChat()">
      <button class="chat-send" id="ocr-chat-send" onclick="sendOCRChat()">Send</button>
    </div>
  </div>`;
  window._ocrChatContext=[{role:'user',content:`Here is extracted text from a document:\n\n${ocrExtractedText}\n\nAnswer questions about it.`},{role:'assistant',content:`I've analyzed the document. It's a ${ocrData.doc_type||'document'} in ${ocrData.language_detected||'English'}. Ask me anything about it!`}];
}
let _ocrChatHistory=[];
async function sendOCRChat(preset){
  const inp=document.getElementById('ocr-chat-inp');
  const msg=preset||(inp?inp.value.trim():'');
  if(!msg)return;
  if(inp)inp.value='';
  const msgs=document.getElementById('ocr-chat-messages');
  if(!msgs)return;
  msgs.innerHTML+=`<div class="chat-msg user">${msg}</div>`;
  msgs.innerHTML+=`<div class="chat-msg ai typing" id="ocr-typing">Thinking...</div>`;
  msgs.scrollTop=msgs.scrollHeight;
  const send=document.getElementById('ocr-chat-send');if(send)send.disabled=true;
  _ocrChatHistory.push({role:'user',content:msg});
  try{
    const context=window._ocrChatContext||[];
    const body={model:'claude-sonnet-4-6',max_tokens:1000,messages:[...context,..._ocrChatHistory]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    let reply='';for(const b of(data.content||[]))if(b.type==='text')reply+=b.text;
    _ocrChatHistory.push({role:'assistant',content:reply});
    const typing=document.getElementById('ocr-typing');
    if(typing){typing.classList.remove('typing');typing.id='';typing.innerHTML=reply;}
    if(send)send.disabled=false;msgs.scrollTop=msgs.scrollHeight;
  }catch(err){
    const typing=document.getElementById('ocr-typing');
    if(typing){typing.classList.remove('typing');typing.id='';typing.textContent='Error: '+err.message;}
    if(send)send.disabled=false;
  }
}

/* ===== FOLLOW-UP CHAT (Main Scanner) ===== */
let scanChatHistory=[],scanChatContext='';
function renderScanChat(result,mode){
  const wrap=document.getElementById('scan-chat-wrap');
  if(!wrap)return;
  scanChatHistory=[];
  scanChatContext=`You are SCANIQ, the world's most advanced product intelligence AI. The user just scanned: "${result.dish_name||result.name||'an item'}". Full scan data: ${JSON.stringify(result)}. When answering follow-up questions, provide DEEP, DETAILED, EXPERT-LEVEL answers. Include specific facts, prices, history, where to buy, rarity, tips, comparisons, warnings, and any other relevant intelligence. Never give short vague answers — always be thorough and informative.`;
  const suggestions={
    nutri:['🍳 How do I cook this?','💪 Is this healthy for weight loss?','🔄 What are similar alternatives?','🥗 Suggest a balanced meal'],
    default:['💰 What is a fair price?','🛒 Where can I buy this?','📊 How rare is this?','🔍 Tell me more about this'],
  };
  const sugs=suggestions[mode]||suggestions.default;
  document.getElementById('scan-chat-suggestions').innerHTML=sugs.map(s=>`<div class="chat-sug" onclick="sendScanChat('${s}')">${s}</div>`).join('');
  document.getElementById('scan-chat-messages').innerHTML='';
  wrap.classList.add('show');
}
async function sendScanChat(preset){
  const inp=document.getElementById('scan-chat-inp');
  const msg=preset||(inp?inp.value.trim():'');
  if(!msg)return;
  if(inp&&!preset)inp.value='';
  const msgs=document.getElementById('scan-chat-messages');
  if(!msgs)return;
  msgs.innerHTML+=`<div class="chat-msg user">${msg}</div>`;
  msgs.innerHTML+=`<div class="chat-msg ai typing" id="scan-typing">Thinking...</div>`;
  msgs.scrollTop=msgs.scrollHeight;
  const send=document.getElementById('scan-chat-send');if(send)send.disabled=true;
  scanChatHistory.push({role:'user',content:msg});
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:scanChatContext},{role:'assistant',content:'Understood. I have the full scan analysis ready and will provide deep, detailed expert-level answers to all questions.'},...scanChatHistory]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    if(data.error?.message)throw new Error(data.error.message);
    let reply='';for(const b of(data.content||[]))if(b.type==='text')reply+=b.text;
    if(!reply)throw new Error('Empty response. Please try again.');
    scanChatHistory.push({role:'assistant',content:reply});
    const typing=document.getElementById('scan-typing');
    if(typing){typing.classList.remove('typing');typing.id='';typing.innerHTML=reply.replace(/\n/g,'<br>');}
    if(send)send.disabled=false;msgs.scrollTop=msgs.scrollHeight;
  }catch(err){
    scanChatHistory.pop();
    const typing=document.getElementById('scan-typing');
    if(typing){typing.classList.remove('typing');typing.id='';typing.textContent='Error: '+err.message;}
    if(send)send.disabled=false;
  }
}

/* ===== FACE AI ===== */
let faceB64=null,faceMime='image/jpeg';
document.getElementById('fi-face').addEventListener('change',e=>{if(e.target.files[0])loadFaceImg(e.target.files[0]);});
document.getElementById('fi-face-cam').addEventListener('change',e=>{if(e.target.files[0])loadFaceImg(e.target.files[0]);});
function loadFaceImg(f){
  faceMime=f.type||'image/jpeg';
  const r=new FileReader();
  r.onload=ev=>{
    faceB64=ev.target.result.split(',')[1];
    const img=document.getElementById('prev-face');
    img.src=ev.target.result;img.style.display='block';
    document.getElementById('dph-face').style.display='none';
    document.getElementById('drop-zone-face').classList.add('has-image');
    document.getElementById('btn-face').disabled=false;
    document.getElementById('face-result').style.display='none';
  };r.readAsDataURL(f);
}
async function runFaceScan(){
  document.getElementById('loading-face').classList.add('show');
  document.getElementById('btn-face').disabled=true;
  document.getElementById('drop-zone-face').classList.add('scanning');
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:faceMime,data:faceB64}},
      {type:'text',text:'You are an expert facial aesthetics AI. Analyze this face image and return PURE JSON ONLY — no markdown:\n{"face_found":true,"gender_presentation":"Male|Female|Androgynous","estimated_age_range":"20-25","symmetry_score":0,"attractiveness_score":0,"facial_features":{"face_shape":"","eye_description":"","nose_type":"","lip_type":"","skin_quality":"","jawline":""},"aesthetic_metrics":[{"label":"Facial Symmetry","score":0,"note":""},{"label":"Golden Ratio Alignment","score":0,"note":""},{"label":"Skin Quality","score":0,"note":""},{"label":"Feature Harmony","score":0,"note":""},{"label":"Expression Energy","score":0,"note":""}],"strengths":["","",""],"overall_verdict":"short descriptive phrase","disclaimer":"For entertainment purposes only. Not a medical assessment."}\nAll scores 0-100. If no face found set face_found:false.'}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok)throw new Error('API Error '+resp.status);
    const data=await resp.json();
    let raw='';for(const b of(data.content||[]))if(b.type==='text')raw+=b.text;
    const r=JSON.parse(raw.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)[0]);
    document.getElementById('loading-face').classList.remove('show');
    document.getElementById('drop-zone-face').classList.remove('scanning');
    document.getElementById('btn-face').disabled=false;
    if(!r.face_found){showErrBox('err-face','No face detected. Try a clearer portrait photo.');return;}
    const metrics=(r.aesthetic_metrics||[]).map(m=>{const pct=Math.min(100,Math.max(0,m.score));return`<div class="face-metric"><div class="face-metric-label">${m.label}</div><div class="face-metric-val">${pct}/100</div><div class="face-score-bar"><div class="face-score-fill" style="width:${pct}%"></div></div><div style="font-size:.66rem;color:var(--text3);margin-top:3px">${m.note||''}</div></div>`;}).join('');
    const strengths=(r.strengths||[]).map(s=>`<div class="fact"><div class="fact-dot"></div><div>${s}</div></div>`).join('');
    document.getElementById('face-result').innerHTML=`<div class="face-card"><div class="face-eye">FACE INTELLIGENCE</div><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><div style="background:var(--card2);border-radius:50%;width:64px;height:64px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0">🧬</div><div><div style="font-family:Orbitron,monospace;font-size:1rem;font-weight:700;color:var(--violet2)">${r.overall_verdict||''}</div><div style="font-size:.72rem;color:var(--text3);margin-top:3px">${r.gender_presentation||''} · Est. age ${r.estimated_age_range||'?'}</div><div style="font-size:.72rem;color:var(--cyan);margin-top:2px">Symmetry ${r.symmetry_score||0}/100 · Aesthetic ${r.attractiveness_score||0}/100</div></div></div><div class="face-metrics">${metrics}</div></div>${strengths?'<div class="facts-head">KEY FEATURES</div>'+strengths:''}<div style="font-size:.64rem;color:var(--text3);margin-top:10px;font-family:JetBrains Mono,monospace">// ${r.disclaimer||'For entertainment only'}</div>`;
    document.getElementById('face-result').style.display='block';
  }catch(err){
    document.getElementById('loading-face').classList.remove('show');
    document.getElementById('drop-zone-face').classList.remove('scanning');
    document.getElementById('btn-face').disabled=false;
    showErrBox('err-face',err.message);
  }
}

/* ===== FACE MATCH ===== */
let fm1B64=null,fm2B64=null,fm1Mime='image/jpeg',fm2Mime='image/jpeg';
['1','2'].forEach(n=>{
  document.getElementById('fi-fm'+n).addEventListener('change',e=>{if(e.target.files[0])loadFmImg(n,e.target.files[0]);});
});
function loadFmImg(n,f){
  const r=new FileReader();
  r.onload=ev=>{
    const b64=ev.target.result.split(',')[1];
    const img=document.getElementById('fm-img'+n);
    const slot=document.getElementById('fm-slot-'+n);
    img.src=ev.target.result;img.style.display='block';
    const ico=slot.querySelector('.fm-slot-ico');const lbl=slot.querySelector('.fm-slot-label');
    if(ico)ico.style.display='none';if(lbl)lbl.style.display='none';
    slot.classList.add('loaded');
    if(n==='1'){fm1B64=b64;fm1Mime=f.type||'image/jpeg';}else{fm2B64=b64;fm2Mime=f.type||'image/jpeg';}
    document.getElementById('btn-fm').disabled=!(fm1B64&&fm2B64);
  };r.readAsDataURL(f);
}
async function runFaceMatch(){
  document.getElementById('loading-fm').classList.add('show');
  document.getElementById('btn-fm').disabled=true;
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:fm1Mime,data:fm1B64}},
      {type:'image',source:{type:'base64',media_type:fm2Mime,data:fm2B64}},
      {type:'text',text:'You are a facial comparison AI. Analyze BOTH faces and return PURE JSON ONLY:\n{"similarity_score":0,"relationship_prediction":"Siblings|Parent-Child|Twins|Unrelated|Cousins","confidence":"High|Medium|Low","shared_features":["","",""],"differences":["","",""],"person_a":{"dominant_feature":"","face_shape":""},"person_b":{"dominant_feature":"","face_shape":""},"verdict":"short description","disclaimer":"For entertainment only. Not DNA or identity verification."}\nsimilarity_score 0-100.'}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok)throw new Error('API Error '+resp.status);
    const data=await resp.json();
    let raw='';for(const b of(data.content||[]))if(b.type==='text')raw+=b.text;
    const r=JSON.parse(raw.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)[0]);
    document.getElementById('loading-fm').classList.remove('show');
    document.getElementById('btn-fm').disabled=false;
    const sim=Math.min(100,Math.max(0,r.similarity_score||0));
    const simColor=sim>=70?'var(--cyan)':sim>=40?'#f59e0b':'var(--text2)';
    const shared=(r.shared_features||[]).map(s=>`<div class="fact"><div class="fact-dot"></div><div>${s}</div></div>`).join('');
    const diffs=(r.differences||[]).map(s=>`<div class="fact"><div style="width:5px;height:5px;border-radius:50%;background:var(--red);flex-shrink:0;margin-top:8px"></div><div>${s}</div></div>`).join('');
    document.getElementById('fm-result').innerHTML=`<div class="face-card"><div class="face-eye">FACE MATCH RESULT</div><div style="text-align:center;margin-bottom:14px"><div style="font-family:Orbitron,monospace;font-size:2rem;font-weight:900;color:${simColor}">${sim}%</div><div style="font-size:.72rem;color:var(--text3);font-family:JetBrains Mono,monospace">SIMILARITY SCORE</div><div style="font-size:.9rem;font-weight:600;color:var(--text);margin-top:5px">${r.relationship_prediction||''}</div><div style="font-size:.7rem;color:var(--text3);margin-top:2px">Confidence: ${r.confidence||'Medium'}</div></div><div style="font-size:.82rem;color:var(--text2);line-height:1.6;margin-bottom:10px">${r.verdict||''}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><div class="face-metric"><div class="face-metric-label">PERSON A</div><div style="font-size:.78rem;color:var(--text)">${r.person_a?.dominant_feature||'—'}</div><div style="font-size:.66rem;color:var(--text3)">${r.person_a?.face_shape||''}</div></div><div class="face-metric"><div class="face-metric-label">PERSON B</div><div style="font-size:.78rem;color:var(--text)">${r.person_b?.dominant_feature||'—'}</div><div style="font-size:.66rem;color:var(--text3)">${r.person_b?.face_shape||''}</div></div></div></div>${shared?'<div class="facts-head">SHARED FEATURES</div>'+shared:''}${diffs?'<div class="facts-head" style="color:var(--red);margin-top:8px">DIFFERENCES</div>'+diffs:''}<div style="font-size:.64rem;color:var(--text3);margin-top:10px;font-family:JetBrains Mono,monospace">// ${r.disclaimer||'Entertainment only'}</div>`;
    document.getElementById('fm-result').style.display='block';
  }catch(err){
    document.getElementById('loading-fm').classList.remove('show');
    document.getElementById('btn-fm').disabled=false;
    showErrBox('err-fm',err.message);
  }
}

/* ===== AUTHENTICITY ===== */
let authB64=null,authMime='image/jpeg';
document.getElementById('fi-auth').addEventListener('change',e=>{if(e.target.files[0])loadAuthImg(e.target.files[0]);});
document.getElementById('fi-auth-cam').addEventListener('change',e=>{if(e.target.files[0])loadAuthImg(e.target.files[0]);});
function loadAuthImg(f){
  authMime=f.type||'image/jpeg';
  const r=new FileReader();
  r.onload=ev=>{
    authB64=ev.target.result.split(',')[1];
    const img=document.getElementById('prev-auth');
    img.src=ev.target.result;img.style.display='block';
    document.getElementById('dph-auth').style.display='none';
    document.getElementById('drop-zone-auth').classList.add('has-image');
    document.getElementById('btn-auth').disabled=false;
    document.getElementById('auth-result').style.display='none';
  };r.readAsDataURL(f);
}
async function runAuthScan(){
  document.getElementById('loading-auth').classList.add('show');
  document.getElementById('btn-auth').disabled=true;
  document.getElementById('drop-zone-auth').classList.add('scanning');
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:authMime,data:authB64}},
      {type:'text',text:'You are an expert authenticity and counterfeit detection AI. Return PURE JSON ONLY:\n{"item_identified":"","authenticity_verdict":"GENUINE|FAKE|UNCERTAIN","confidence_score":0,"authenticity_markers":{"positive":[""],"suspicious":[""]},"red_flags":[""],"recommendation":"Buy safely|Avoid|Get physical inspection","detail_assessment":"2-3 sentences","disclaimer":"Visual analysis only. Physical inspection recommended for high-value items."}\nconfidence_score 0-100. Check: logos, stitching, fonts, materials, holograms, serial numbers, quality.'}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!resp.ok)throw new Error('API Error '+resp.status);
    const data=await resp.json();
    let raw='';for(const b of(data.content||[]))if(b.type==='text')raw+=b.text;
    const r=JSON.parse((()=>{const c=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').trim();const m=c.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON found');return m[0];})());
    document.getElementById('loading-auth').classList.remove('show');
    document.getElementById('drop-zone-auth').classList.remove('scanning');
    document.getElementById('btn-auth').disabled=false;
    const vc=r.authenticity_verdict==='GENUINE'?'genuine':r.authenticity_verdict==='FAKE'?'fake':'uncertain';
    const vcIcon=vc==='genuine'?'✅':vc==='fake'?'❌':'⚠️';
    const vcColor=vc==='genuine'?'var(--green)':vc==='fake'?'var(--red)':'#f59e0b';
    const pos=(r.authenticity_markers?.positive||[]).filter(Boolean).map(s=>`<div class="fact"><div style="width:5px;height:5px;border-radius:50%;background:var(--green);flex-shrink:0;margin-top:8px"></div><div>${s}</div></div>`).join('');
    const sus=(r.authenticity_markers?.suspicious||[]).filter(Boolean).map(s=>`<div class="fact"><div style="width:5px;height:5px;border-radius:50%;background:var(--red);flex-shrink:0;margin-top:8px"></div><div>${s}</div></div>`).join('');
    const flags=(r.red_flags||[]).filter(Boolean).map(s=>`<div class="fact"><div class="fact-dot"></div><div>${s}</div></div>`).join('');
    document.getElementById('auth-result').innerHTML=`<div class="auth-card"><div class="auth-eye">AUTHENTICITY ANALYSIS</div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:2rem">${vcIcon}</span><div><div class="auth-verdict ${vc}">${r.authenticity_verdict||'UNCERTAIN'}</div><div style="font-size:.7rem;color:var(--text3)">Confidence: ${r.confidence_score||0}/100 · ${r.item_identified||'Item'}</div></div></div><div class="auth-detail">${r.detail_assessment||''}</div><div style="margin-top:10px;background:var(--card2);border-radius:8px;padding:8px 12px;font-size:.78rem"><span style="color:var(--text3);font-family:JetBrains Mono,monospace;font-size:.6rem">RECOMMENDATION // </span><span style="color:${vcColor};font-weight:600">${r.recommendation||''}</span></div></div>${pos?'<div class="facts-head" style="color:var(--green)">AUTHENTIC MARKERS</div>'+pos:''}${sus?'<div class="facts-head" style="color:var(--red);margin-top:8px">SUSPICIOUS ELEMENTS</div>'+sus:''}${flags?'<div class="facts-head" style="color:var(--red);margin-top:8px">RED FLAGS</div>'+flags:''}<div style="font-size:.64rem;color:var(--text3);margin-top:10px;font-family:JetBrains Mono,monospace">// ${r.disclaimer||'Visual analysis only'}</div>`;
    document.getElementById('auth-result').style.display='block';
  }catch(err){
    document.getElementById('loading-auth').classList.remove('show');
    document.getElementById('drop-zone-auth').classList.remove('scanning');
    document.getElementById('btn-auth').disabled=false;
    showErrBox('err-auth',err.message);
  }
}

/* ===== QR / BARCODE ===== */
let qrImgFile=null;
document.getElementById('fi-qr').addEventListener('change',e=>{if(e.target.files[0])loadQRImg(e.target.files[0]);});
function loadQRImg(f){
  qrImgFile=f;
  const r=new FileReader();
  r.onload=ev=>{
    const img=document.getElementById('prev-qr');
    img.src=ev.target.result;img.style.display='block';
    document.getElementById('dph-qr').style.display='none';
    document.getElementById('drop-zone-qr').classList.add('has-image');
    document.getElementById('btn-qr').disabled=false;
    document.getElementById('qr-result').classList.remove('show');
  };r.readAsDataURL(f);
}
async function decodeQR(){
  if(!qrImgFile){showErrBox('err-qr','No image loaded.');return;}
  document.getElementById('btn-qr').disabled=true;
  document.getElementById('qr-result').classList.remove('show');
  showErrBox('err-qr','');
  try{
    const img=new Image();img.src=URL.createObjectURL(qrImgFile);
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;});
    const canvas=document.getElementById('qr-canvas');
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    document.getElementById('qr-canvas').getContext('2d').drawImage(img,0,0);
    let decoded=null,type='QR CODE';
    if('BarcodeDetector' in window){
      try{
        const bd=new BarcodeDetector({formats:['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e','data_matrix','pdf417','aztec','itf']});
        const results=await bd.detect(img);
        if(results.length>0){decoded=results[0].rawValue;type=results[0].format.toUpperCase().replace(/_/g,' ');}
      }catch(e){}
    }
    document.getElementById('btn-qr').disabled=false;
    if(!decoded){showErrBox('err-qr','Could not decode. Ensure good lighting and focus on the code. BarcodeDetector may not be available on all browsers.');return;}
    document.getElementById('qr-type').textContent=type;
    document.getElementById('qr-val').textContent=decoded;
    const isURL=/^https?:\/\//i.test(decoded)||/^www\./i.test(decoded);
    const isEmail=/^mailto:|^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(decoded);
    const isPhone=/^tel:|^\+[\d\s\-\(\)]{7,}$/.test(decoded);
    const safe=decoded.replace(/'/g,"\\'");
    let acts=`<button class="qr-act-btn" onclick="navigator.clipboard.writeText('${safe}').then(()=>this.textContent='✅ Copied!')">📋 Copy</button>`;
    if(isURL)acts+=`<button class="qr-act-btn" onclick="window.open('${decoded.startsWith('http')?decoded:'https://'+decoded}','_blank')">🌐 Open</button>`;
    if(isEmail)acts+=`<button class="qr-act-btn" onclick="window.open('mailto:${decoded.replace('mailto:','')}')">✉️ Email</button>`;
    if(isPhone)acts+=`<button class="qr-act-btn" onclick="window.open('tel:${decoded.replace('tel:','')}')">📞 Call</button>`;
    document.getElementById('qr-actions').innerHTML=acts;
    document.getElementById('qr-result').classList.add('show');
  }catch(err){
    document.getElementById('btn-qr').disabled=false;
    showErrBox('err-qr','Error: '+err.message);
  }
}

/* ===== COLLECTIONS ===== */
let collections=JSON.parse(localStorage.getItem('sq4_coll')||'[]');
function saveColl(){try{localStorage.setItem('sq4_coll',JSON.stringify(collections));}catch{}}
function renderCollections(){
  const g=document.getElementById('coll-grid');if(!g)return;g.innerHTML='';
  collections.forEach((c,i)=>{
    const thumbs=c.items.slice(0,4);
    const thumbHtml=Array.from({length:4},(_,ti)=>{const item=thumbs[ti];return item?`<img src="${item.thumb}" onerror="this.style.display='none'" alt="">`:`<div class="coll-ph">${c.icon||'📁'}</div>`;}).join('');
    const d=document.createElement('div');d.className='coll-card';
    d.innerHTML=`<div class="coll-thumb-row">${thumbHtml}</div><div class="coll-info"><div class="coll-name">${c.name}</div><div class="coll-count">${c.items.length} items</div></div>`;
    d.onclick=()=>openCollection(i);g.appendChild(d);
  });
  const add=document.createElement('div');add.className='coll-card coll-add-btn';
  add.innerHTML='<span class="coll-add-ico">➕</span><span>New Collection</span>';
  add.onclick=createCollection;g.appendChild(add);
}
function createCollection(){
  const name=prompt('Collection name:');if(!name||!name.trim())return;
  const icons=['📁','⭐','🔬','💎','🎨','🌿','🚗','🏆','📚','🧬'];
  collections.push({name:name.trim(),icon:icons[Math.floor(Math.random()*icons.length)],items:[],created:Date.now()});
  saveColl();renderCollections();
}
function openCollection(i){
  const c=collections[i];
  if(!hist.length){alert('No scans in history yet. Scan items first!');return;}
  const options=hist.map((h,hi)=>`${hi+1}. ${h.result?.name||'Scan'} — ${timeAgo(h.ts)}`).join('\n');
  const choice=prompt(`Add scan to "${c.name}":\n\n${options}\n\nEnter number:`);
  const n=parseInt(choice);if(isNaN(n)||n<1||n>hist.length)return;
  const item=hist[n-1];
  if(c.items.find(x=>x.id===item.id)){alert('Already in this collection.');return;}
  c.items.unshift({id:item.id,thumb:item.thumb,name:item.result?.name||'Scan',ts:item.ts});
  saveColl();renderCollections();alert(`Added to "${c.name}" ✅`);
}

/* ===== HELPER ===== */
function showErrBox(id,msg){const b=document.getElementById(id);if(!b)return;if(!msg){b.classList.remove('show');b.textContent='';return;}b.textContent='ERROR // '+msg;b.classList.add('show');}

/* patch sp for collections */
const _sp0=sp;
sp=function(n,el){_sp0(n,el);if(n==='coll')renderCollections();};
