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
  const ctx=info?'Category: "'+info.n+'"':'Auto-detect category — identify everything visible';
  const dims=arc.dims;
  const needsLive=arc.live;
  const srcInstr=arc.sources.map(s=>'- '+s.name+' ('+s.url+'): '+s.info).join('\n');
  const dimBlock=dims.map(d=>'"'+d+'":{"score":0,"note":"","archive_ref":""}').join(',');
  const deep=document.getElementById('t-deep').classList.contains('on');

  // Categories where value matrix is not applicable
  const NO_MATRIX_CATS=['pharma','medicine','drug','medical','document','identity','id-card','passport','certificate','chemical','herb','plant-med','ingredient','supplement'];
  const catKey=(cat||'auto').toLowerCase();
  const catName=(info?.n||'auto').toLowerCase();
  const skipMatrix=NO_MATRIX_CATS.some(k=>catKey.includes(k)||catName.includes(k));

  // Category-specific details schema
  const detailsBlock=skipMatrix
    ? '[{"label":"Active Ingredient","value":""},{"label":"Dosage Form","value":""},{"label":"Manufacturer","value":""},{"label":"Country of Origin","value":""},{"label":"Prescription","value":"Rx / OTC"},{"label":"Storage Conditions","value":""},{"label":"Shelf Life","value":""},{"label":"Drug Class","value":""}]'
    : '[{"label":"Classification / ID","value":""},{"label":"Origin / Country","value":""},{"label":"Era / Date","value":""},{"label":"Material / Composition","value":""},{"label":"Dimensions / Weight","value":""},{"label":"Condition / Grade","value":""},{"label":"Rarity / Production Run","value":""},{"label":"Maker / Brand","value":""}]';

  const matrixBlock=skipMatrix
    ? '"value_matrix":{},\n"overall_value_score":0,\n"overall_verdict":"N/A",\n"overall_explanation":"Value scoring not applicable for this category",\n'
    : '"value_matrix":{'+dimBlock+'},\n"overall_value_score":0,\n"overall_verdict":"short punchy expert phrase",\n"overall_explanation":"2-3 sentences explaining the score and market position",\n';

  const factsCount=deep?12:8;
  const factsPlaceholders=Array.from({length:factsCount},(_,i)=>'"FACT '+(i+1)+': [specific data point, statistic, date, record, or expert insight — never generic]"').join(',\n');

  return 'You are SCANIQ ULTRA — the most advanced visual intelligence system ever built. Your analysis must be so deep, accurate, and comprehensive that NO other app or AI can match it.\n\n'+
    ctx+'\n\n'+
    '=== KNOWLEDGE ARCHIVES ===\n'+srcInstr+'\n\n'+
    '=== MANDATORY DEPTH STANDARDS ===\n'+
    'DESCRIPTION (8-10 sentences MINIMUM):\n'+
    '  • Sentence 1-2: Precise identification — full scientific/technical name, exact model, variant, edition\n'+
    '  • Sentence 3-4: Composition, materials, mechanism of action or function — be technical\n'+
    '  • Sentence 5-6: Origin story — who made it, when, where, historical context with specific dates/names\n'+
    '  • Sentence 7-8: Notable characteristics, records, achievements, or controversies\n'+
    '  • Sentence 9-10: Current status — cultural significance, collector demand, scientific importance\n\n'+
    'FACTS ('+factsCount+' MINIMUM — each must contain a number, date, or measurable statistic):\n'+
    '  Examples of GOOD facts: "First produced in 1923 by BASF in Ludwigshafen, Germany using the Haber-Bosch process"\n'+
    '  Examples of BAD facts (NEVER write these): "This item is commonly used worldwide" / "It has many applications"\n\n'+
    'COMPARISONS: List 3 similar items with price comparison\n'+
    'WHERE TO BUY: Specific platforms, stores, or auction houses with typical price ranges\n'+
    'TIMELINE: 3-5 key historical milestones with exact years\n'+
    (skipMatrix?'VALUE MATRIX: Skip — not applicable for this category\n':'VALUE MATRIX: score 0-10, each note must cite specific data from the archives\n')+
    '\n=== OUTPUT: PURE JSON ONLY — NO MARKDOWN — NO PREAMBLE ===\n'+
    '{\n'+
    '"name":"",\n'+
    '"subtitle":"full scientific name / model number / catalog ID / brand and variant",\n'+
    '"category":"",\n'+
    '"category_emoji":"",\n'+
    '"confidence":"High|Medium|Low",\n'+
    '"price":{"value":"specific range e.g. $120–$450","unit":"per unit/kg/oz/pack","note":"where: retail/auction/pharmacy/online — cite platform","is_live_needed":'+needsLive+'},\n'+
    '"description":"8-10 sentences — technical, historical, scientific, no filler",\n'+
    '"details":'+detailsBlock+',\n'+
    matrixBlock+
    '"comparisons":[{"name":"similar item 1","difference":"key distinction","price":"$X–$Y"},{"name":"similar item 2","difference":"key distinction","price":"$X–$Y"},{"name":"similar item 3","difference":"key distinction","price":"$X–$Y"}],\n'+
    '"where_to_buy":[{"platform":"e.g. eBay / Amazon / Sothebys","url":"https://...","price_range":"$X–$Y","notes":"e.g. best for rare editions"}],\n'+
    '"timeline":[{"year":"YYYY","event":"specific milestone"},{"year":"YYYY","event":""},{"year":"YYYY","event":""}],\n'+
    '"expert_opinion":"2-3 sentences of what a leading expert in this field would say about this specific item — include expert perspective on value, significance, or authenticity",\n'+
    '"risk_warnings":"any safety, legal, health, or fraud risks — empty string if none",\n'+
    '"legal_status":"cite specific laws or regulations by name if applicable — empty if none",\n'+
    '"market_note":"specific market dynamics: recent price trends, demand drivers, regional price differences",\n'+
    '"facts":[\n'+factsPlaceholders+'\n]\n'+
    '}\n';
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
  // ===== PHARMACEUTICAL CHECK =====
  const isPharma=(r.category||'').toLowerCase().includes('pharma')||(r.category||'').toLowerCase().includes('medic')||(r.subcategory||'').toLowerCase().includes('pharma')||(r.subcategory||'').toLowerCase().includes('medic')||(r.category||'').toLowerCase().includes('drug');
  let matrixHtml='';
  if(isPharma){
    // Medical Info Panel بدلاً من Value Matrix للأدوية
    const genericName=r.subtitle||r.name||'';
    const dosage=(r.details||[]).find(d=>d.label&&d.label.toLowerCase().includes('dos'))?.value||'';
    const origin=(r.details||[]).find(d=>d.label&&d.label.toLowerCase().includes('origin'))?.value||'';
    const priceNote=r.price?.note||'';
    const priceVal=r.price?.value||'';
    const warnings=(r.facts||[]).filter(f=>/warn|caution|risk|side|prescription|consult/i.test(f));
    const generics=(r.facts||[]).filter(f=>/generic|equivalent|alternative/i.test(f));
    matrixHtml='<div class="med-panel">'+
      '<div class="med-panel-head">💊 MEDICAL INTELLIGENCE</div>'+
      '<div class="med-grid">'+
        (genericName?'<div class="med-item"><div class="med-item-label">GENERIC NAME</div><div class="med-item-val">'+genericName+'</div></div>':'')+
        (dosage?'<div class="med-item"><div class="med-item-label">DOSAGE FORM</div><div class="med-item-val">'+dosage+'</div></div>':'')+
        (origin?'<div class="med-item"><div class="med-item-label">MANUFACTURER</div><div class="med-item-val">'+origin+'</div></div>':'')+
        ((priceVal&&priceVal!=='N/A')?'<div class="med-item"><div class="med-item-label">💰 PRICE RANGE</div><div class="med-item-val">'+priceVal+(priceNote?' · '+priceNote:'')+'</div></div>':'')+
      '</div>'+
      (warnings.length?'<div class="med-warn"><div class="med-warn-head">⚠️ WARNINGS</div>'+warnings.map(w=>'<div class="med-warn-item">'+w+'</div>').join('')+'</div>':'')+
      (generics.length?'<div class="med-gen"><div class="med-gen-head">🔄 GENERIC ALTERNATIVES</div>'+generics.map(g=>'<div class="med-gen-item">'+g+'</div>').join('')+'</div>':'')+
      '<div class="med-disclaimer">⚕️ Always consult a licensed physician or pharmacist before use.</div>'+
    '</div>';
  } else if(showMatrix&&dims.length){
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
  // ── Timeline HTML ──
  const timelineHtml=(r.timeline||[]).length?
    '<div class="section-head">📅 TIMELINE</div><div class="timeline-wrap">'+
    (r.timeline||[]).map(t=>'<div class="tl-row"><div class="tl-year">'+(t.year||'')+'</div><div class="tl-event">'+(t.event||'')+'</div></div>').join('')+
    '</div>':'';

  // ── Comparisons HTML ──
  const comparisonsHtml=(r.comparisons||[]).length?
    '<div class="section-head">⚖️ SIMILAR ITEMS</div><div class="cmp-wrap">'+
    (r.comparisons||[]).map(c=>'<div class="cmp-row"><div class="cmp-name">'+(c.name||'')+'</div><div class="cmp-diff">'+(c.difference||'')+'</div><div class="cmp-price">'+(c.price||'')+'</div></div>').join('')+
    '</div>':'';

  // ── Where to Buy HTML ──
  const buyHtml=(r.where_to_buy||[]).length?
    '<div class="section-head">🛒 WHERE TO BUY</div><div class="buy-wrap">'+
    (r.where_to_buy||[]).map(b=>'<div class="buy-row"><div class="buy-platform">'+(b.platform||'')+'</div><div class="buy-price">'+(b.price_range||'')+'</div>'+(b.notes?'<div class="buy-note">'+(b.notes||'')+'</div>':'')+'</div>').join('')+
    '</div>':'';

  // ── Expert Opinion HTML ──
  const expertHtml=r.expert_opinion?
    '<div class="expert-card"><div class="expert-eye">🎓 EXPERT OPINION</div><div class="expert-text">'+(r.expert_opinion||'')+'</div></div>':'';

  // ── Risk Warnings HTML ──
  const riskHtml=r.risk_warnings?
    '<div class="risk-card"><div class="risk-eye">⚠️ RISK & WARNINGS</div><div class="risk-text">'+(r.risk_warnings||'')+'</div></div>':'';

  document.getElementById('result-card').innerHTML=
    '<div class="result-header"><span class="id-badge">&#10003; IDENTIFIED</span><span style="font-size:.88rem">'+(r.category_emoji||'&#128300;')+' '+(r.category||'')+'</span><span class="conf-badge">'+(r.confidence||'')+'</span></div>'+
    '<div class="result-body">'+
      '<div class="result-name">'+(r.name||'Unknown')+'</div>'+
      '<div class="result-sub">'+(r.subtitle||'')+'</div>'+
      priceHtml+
      '<div class="result-desc">'+(r.description||'')+'</div>'+
      matrixHtml+
      (detsHtml?'<div class="det-grid">'+detsHtml+'</div>':'')+
      expertHtml+
      timelineHtml+
      comparisonsHtml+
      buyHtml+
      (r.legal_status?'<div class="legal-card"><div class="legal-eye">⚖️ LEGAL STATUS</div>'+r.legal_status+'</div>':'')+
      riskHtml+
      (r.market_note?'<div class="market-card"><div class="market-eye">📈 MARKET INTELLIGENCE</div><div style="font-size:.8rem;color:var(--text2)">'+r.market_note+'</div></div>':'')+
      (factsHtml?'<div class="facts-head">🔬 KEY INTELLIGENCE</div>'+factsHtml:'')+
    '</div>';
  document.getElementById('results-wrap').style.display='block';
  document.getElementById('results-wrap').scrollIntoView({behavior:'smooth',block:'start'});
  const _rab=document.getElementById('result-action-bar');if(_rab)_rab.classList.add('show');
  window._lastResult=r;
  // Build clean translate text from structured result data (avoids JSON bleed)
  if(typeof window._scanRawText!=='undefined'){
    const _p=[];
    if(r.name)_p.push('Name: '+r.name);
    if(r.subtitle)_p.push('Category: '+r.subtitle);
    if(r.price?.value&&r.price.value!=='N/A')_p.push('Market Value: '+r.price.value+(r.price.note?' — '+r.price.note:''));
    if(r.description)_p.push('\n'+r.description);
    if(r.overall_verdict&&r.overall_verdict!=='N/A')_p.push('Overall Value: '+r.overall_verdict+(r.overall_explanation?' — '+r.overall_explanation:''));
    if(r.details?.length)_p.push('\nDetails:\n'+r.details.map(d=>d.label+': '+(d.value||'—')).join('\n'));
    if(r.facts?.length)_p.push('\nKey Facts:\n'+r.facts.join('\n'));
    if(r.market_note)_p.push('\nMarket: '+r.market_note);
    if(r.legal_status)_p.push('\nLegal: '+r.legal_status);
    if(r.expert_opinion)_p.push('\nExpert: '+r.expert_opinion);
    if(r.risk_warnings)_p.push('\nRisks: '+r.risk_warnings);
    if((r.comparisons||[]).length)_p.push('\nSimilar Items:\n'+r.comparisons.map(c=>c.name+' — '+c.difference+' ('+c.price+')').join('\n'));
    if((r.timeline||[]).length)_p.push('\nTimeline:\n'+r.timeline.map(t=>t.year+': '+t.event).join('\n'));
    window._scanRawText=_p.join('\n');
  }
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
  if(m!=='ar')stopAR();
  ['scan','face','facematch','auth','nutri','ocr','qr','ar','batch','compare'].forEach(id=>{
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
  const itemName=result.dish_name||result.name||'an item';
  const itemCategory=result.category||result.subcategory||'';
  const itemBrand=result.brand||result.manufacturer||'';
  const itemCountry=result.origin||result.country||'';
  scanChatContext=`You are SCANIQ, the world's most advanced product intelligence AI. The user scanned: "${itemName}" ${itemBrand?'by '+itemBrand:''} ${itemCategory?'('+itemCategory+')':''} ${itemCountry?'from '+itemCountry:''}.

Full scan data: ${JSON.stringify(result)}.

CRITICAL RULES:
- PRICE questions: Give SPECIFIC real price ranges. Mention prices in USD AND local currency if the product origin is known. Cover pharmacy, online, and supermarket prices. Include average, discount, and premium price ranges. Never say "it depends" without giving actual numbers.
- WHERE TO BUY: Name SPECIFIC real stores and websites globally — including Amazon, eBay, local pharmacies, regional supermarkets, and country-specific platforms (e.g. Noon, Souq, Carrefour for Middle East; Boots, Tesco for UK; etc). If prescription required, say so clearly.
- LOCATION AWARENESS: If the product origin or brand suggests a specific region, tailor buying advice to that region first, then globally.
- All answers: Be SPECIFIC, FACTUAL, ACTIONABLE. Use real data. No vague answers.
- Format with short clear paragraphs.`;
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
    // Add "Scan with SCANIQ" button for product barcodes
    const isProduct=/^[0-9]{8,14}$/.test(decoded.trim());
    if(isProduct||!isURL){
      const safeBarcode=decoded.replace(/'/g,"\'");
      acts+=`<button class="qr-act-btn" style="border-color:var(--cyan);color:var(--cyan)" onclick="scanBarcodeWithSCANIQ('${safeBarcode}')">🔍 SCAN WITH SCANIQ</button>`;
    }
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

/* ===== HISTORY SEARCH ===== */
function filterHist(q){
  const g=document.getElementById('full-hist');
  if(!hist.length)return;
  const term=q.toLowerCase().trim();
  const filtered=term?hist.filter(h=>(h.result?.name||'').toLowerCase().includes(term)||(h.result?.category||'').toLowerCase().includes(term)):hist;
  if(!filtered.length){g.innerHTML='<div style="padding:32px 0;text-align:center;color:var(--text3);font-family:JetBrains Mono,monospace;font-size:.76rem">// NO RESULTS</div>';return;}
  g.innerHTML='<div style="display:flex;flex-direction:column;gap:7px;padding-bottom:20px;">'+filtered.map(h=>histHtml(h,true)).join('')+'</div>';
}

/* ===== SAVE TO COLLECTION FROM RESULT ===== */
function saveToCollection(){
  if(!window._lastResult){alert('No scan result to save.');return;}
  if(!collections.length){
    const name=prompt('No collections yet. Enter name for new collection:');
    if(!name||!name.trim())return;
    const icons=['📁','⭐','🔬','💎','🎨','🌿','🚗','🏆','📚','🧬'];
    collections.push({name:name.trim(),icon:icons[Math.floor(Math.random()*icons.length)],items:[],created:Date.now()});
    saveColl();
  }
  const opts=collections.map((c,i)=>`${i+1}. ${c.icon} ${c.name} (${c.items.length} items)`).join('\n');
  const choice=prompt('Save to collection:\n\n'+opts+'\n\nEnter number:');
  const n=parseInt(choice);if(isNaN(n)||n<1||n>collections.length)return;
  const c=collections[n-1];
  const thumb=document.getElementById('preview-img')?.src||'';
  const id=Date.now();
  if(c.items.find(x=>x.name===window._lastResult.name)){alert('Already saved.');return;}
  c.items.unshift({id,thumb,name:window._lastResult.name||'Scan',ts:new Date().toISOString()});
  saveColl();
  const btn=document.querySelector('#result-action-bar button');
  if(btn){const orig=btn.textContent;btn.textContent='✅ SAVED!';setTimeout(()=>btn.textContent=orig,2000);}
}

/* ===== SHARE RESULT ===== */
function shareResult(){
  if(!window._lastResult){return;}
  const r=window._lastResult;
  const text=`🔍 SCANIQ RESULT\n\n${r.category_emoji||'📦'} ${r.name||'Unknown'}\n${r.subtitle||''}\n\n${r.description||''}\n\nPrice: ${r.price?.value||'N/A'}\nValue: ${r.overall_verdict||''}\n\nScanned with SCANIQ`;
  if(navigator.share){navigator.share({title:'SCANIQ — '+r.name,text}).catch(()=>{});}
  else{navigator.clipboard.writeText(text).then(()=>alert('Result copied to clipboard! ✅')).catch(()=>alert('Could not share.'));}
}

/* ===== QR → SCANIQ SCAN ===== */
function scanBarcodeWithSCANIQ(barcode){
  // Switch to scanner tab with barcode as context
  sp('scan',document.querySelector('.nav-btn'));
  // Pre-fill a text scan using the barcode number
  const img=document.getElementById('preview-img');
  const qrImg=document.getElementById('prev-qr');
  if(qrImg&&qrImg.src&&qrImg.src!==window.location.href){
    img.src=qrImg.src;img.style.display='block';
    document.getElementById('drop-ph').style.display='none';
    document.getElementById('tgt').style.display='none';
    document.getElementById('drop-zone').classList.add('has-image');
    document.getElementById('btn-scan').disabled=false;
    imgB64=qrImg.src.split(',')[1]||null;
    imgMime='image/jpeg';
  }
  // Show barcode context
  const bar=document.getElementById('result-action-bar');if(bar)bar.classList.remove('show');
  window._barcodeContext=barcode;
  alert('Image loaded. Tap SCAN NOW — SCANIQ will analyze the product with barcode: '+barcode);
}

/* ===== HELPER ===== */
function showErrBox(id,msg){const b=document.getElementById(id);if(!b)return;if(!msg){b.classList.remove('show');b.textContent='';return;}b.textContent='ERROR // '+msg;b.classList.add('show');}

/* patch sp for collections */
const _sp0=sp;
sp=function(n,el){_sp0(n,el);if(n==='coll')renderCollections();if(n==='portfolio')renderPortfolio();};

/* ===== TEXT SEARCH (no image needed) ===== */
async function runTextSearch(){
  const q=(document.getElementById('text-search-inp')||{}).value?.trim();
  if(!q)return;
  const btn=document.getElementById('text-search-btn');
  const deep=document.getElementById('t-deep').classList.contains('on');
  btn.disabled=true;btn.textContent='SEARCHING...';
  document.getElementById('loading').classList.add('show');
  document.getElementById('results-wrap').style.display='none';
  document.getElementById('err-box').classList.remove('show');
  const arc=getArchive(selCat);
  const srcInstr=arc.sources.map(s=>'- '+s.name+' ('+s.url+'): '+s.info).join('\n');
  const dims=arc.dims;
  const dimBlock=dims.map(d=>'"'+d+'":{"score":0,"note":"","archive_ref":""}').join(',');
  const factsCount=deep?12:8;
  const factsPlaceholders=Array.from({length:factsCount},(_,i)=>'"FACT '+(i+1)+': [specific data, statistic, or date]"').join(',\n');
  const prompt='You are SCANIQ ULTRA — the world\'s most advanced intelligence system. The user is searching for: "'+q+'".\n\n'+
    'Identify and analyze this item as if you visually scanned it. Use all knowledge available.\n\n'+
    '=== KNOWLEDGE ARCHIVES ===\n'+srcInstr+'\n\n'+
    '=== OUTPUT: PURE JSON ONLY ===\n'+
    '{"name":"","subtitle":"full scientific/technical name","category":"","category_emoji":"","confidence":"High|Medium|Low",'+
    '"price":{"value":"$X–$Y","unit":"","note":"retail/market platform","is_live_needed":false},'+
    '"description":"8-10 expert sentences — technical, historical, scientific depth",'+
    '"details":[{"label":"Classification","value":""},{"label":"Origin","value":""},{"label":"Era/Date","value":""},{"label":"Material","value":""},{"label":"Dimensions","value":""},{"label":"Condition","value":""},{"label":"Rarity","value":""},{"label":"Maker","value":""}],'+
    '"value_matrix":{'+dimBlock+'},'+
    '"overall_value_score":0,"overall_verdict":"","overall_explanation":"",'+
    '"comparisons":[{"name":"","difference":"","price":""},{"name":"","difference":"","price":""},{"name":"","difference":"","price":""}],'+
    '"where_to_buy":[{"platform":"","url":"","price_range":"","notes":""}],'+
    '"timeline":[{"year":"","event":""},{"year":"","event":""},{"year":"","event":""}],'+
    '"expert_opinion":"","risk_warnings":"","legal_status":"","market_note":"",'+
    '"facts":[\n'+factsPlaceholders+'\n]}';
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:deep?4000:2500,messages:[{role:'user',content:prompt}]};
    body.tools=[{type:'web_search_20250305',name:'web_search'}];
    const resp=await fetch(API_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    let raw='';for(const b of(data.content||[])){if(b.type==='text')raw+=b.text;}
    if(!raw)throw new Error('No response');
    const clean=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
    const m=clean.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON');
    const result=JSON.parse(m[0]);
    document.getElementById('loading').classList.remove('show');
    btn.disabled=false;btn.textContent='🔍 SEARCH';
    renderResult(result,true,selCat);
    // Save to history
    if(document.getElementById('t-hist').classList.contains('on')){
      const item={id:Date.now(),thumb:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="%23162032"/><text x="30" y="38" font-size="24" text-anchor="middle">🔍</text></svg>',result,ts:new Date().toISOString(),cat:selCat};
      hist.unshift(item);if(hist.length>20)hist=hist.slice(0,20);
      try{localStorage.setItem('sq4_hist',JSON.stringify(hist));}catch{}
      renderRecentHist();
    }
  }catch(err){
    document.getElementById('loading').classList.remove('show');
    btn.disabled=false;btn.textContent='🔍 SEARCH';
    showErr('Search failed: '+err.message);
  }
}

/* ===== WEB ENRICHMENT (deepen result after scan) ===== */
async function enrichResultWithWeb(){
  if(!window._lastResult)return;
  const r=window._lastResult;
  const btn=document.getElementById('enrich-btn');
  if(btn){btn.disabled=true;btn.textContent='⏳ SEARCHING WEB...';}
  try{
    const prompt='Search the web for the most current, accurate information about: "'+r.name+(r.subtitle?' ('+r.subtitle+')':'')+'".\n\n'+
      'Return PURE JSON ONLY:\n'+
      '{"current_price":"most recent market price with source","recent_news":["news item 1","news item 2"],"buy_links":[{"platform":"","url":"https://","price":""}],"additional_facts":["specific fact with number","specific fact with number","specific fact with number"],"price_trend":"rising/falling/stable and why"}';
    const body={model:'claude-sonnet-4-6',max_tokens:1500,
      messages:[{role:'user',content:prompt}],
      tools:[{type:'web_search_20250305',name:'web_search'}]};
    const resp=await fetch(API_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    let raw='';for(const b of(data.content||[])){if(b.type==='text')raw+=b.text;}
    const clean=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').trim();
    const m=clean.match(/\{[\s\S]*\}/);if(!m)throw new Error('no json');
    const web=JSON.parse(m[0]);
    // Inject enrichment into result card
    let enrichDiv=document.getElementById('web-enrichment');
    if(!enrichDiv){enrichDiv=document.createElement('div');enrichDiv.id='web-enrichment';document.getElementById('result-card').querySelector('.result-body').appendChild(enrichDiv);}
    enrichDiv.innerHTML=
      '<div class="section-head">🌐 LIVE WEB INTELLIGENCE</div>'+
      (web.current_price?'<div class="enrich-row"><span class="enrich-label">Current Price</span><span class="enrich-val">'+web.current_price+'</span></div>':'')+
      (web.price_trend?'<div class="enrich-row"><span class="enrich-label">Price Trend</span><span class="enrich-val">'+web.price_trend+'</span></div>':'')+
      ((web.recent_news||[]).length?'<div class="section-head" style="margin-top:10px">📰 RECENT NEWS</div>'+web.recent_news.map(n=>'<div class="fact"><div class="fact-dot" style="background:var(--violet2)"></div><div>'+n+'</div></div>').join(''):'')+
      ((web.additional_facts||[]).length?'<div class="section-head" style="margin-top:10px">🔍 NEW FACTS</div>'+web.additional_facts.map(f=>'<div class="fact"><div class="fact-dot" style="background:var(--cyan)"></div><div>'+f+'</div></div>').join(''):'')+
      ((web.buy_links||[]).length?'<div class="section-head" style="margin-top:10px">🛒 LIVE LISTINGS</div>'+web.buy_links.map(b=>'<div class="buy-row"><div class="buy-platform">'+b.platform+'</div><div class="buy-price">'+b.price+'</div></div>').join(''):'')+
      '<div style="font-size:.6rem;color:var(--text3);font-family:JetBrains Mono,monospace;margin-top:8px">// WEB ENRICHED '+new Date().toLocaleTimeString()+'</div>';
    if(btn){btn.textContent='✅ WEB ENRICHED';setTimeout(()=>{btn.disabled=false;btn.textContent='🌐 ENRICH WITH WEB';},3000);}
  }catch(err){
    if(btn){btn.disabled=false;btn.textContent='🌐 ENRICH WITH WEB';}
  }
}


/* ══════════════════════════════════════════════════
   AR LIVE CAMERA ENGINE
══════════════════════════════════════════════════ */
let _arStream=null, _arAutoTimer=null, _arRunning=false, _arAnalyzing=false, _arLastResult=null;

async function startAR(){
  const btn=document.getElementById('ar-start-btn');
  const snapBtn=document.getElementById('ar-snap-btn');
  const autoBtn=document.getElementById('ar-auto-btn');
  const video=document.getElementById('ar-video');
  const status=document.getElementById('ar-status');
  try{
    if(_arStream){stopAR();return;}
    btn.textContent='⏳ STARTING...';btn.disabled=true;
    _arStream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},audio:false
    });
    video.srcObject=_arStream;
    await new Promise(r=>{video.onloadedmetadata=r;});
    _arRunning=true;
    btn.textContent='⏹ STOP CAMERA';btn.disabled=false;btn.style.borderColor='var(--red)';btn.style.color='var(--red)';
    snapBtn.disabled=false;autoBtn.disabled=false;
    status.textContent='CAMERA ACTIVE — SNAP TO ANALYZE';
    status.style.color='var(--cyan)';
    showErrBox('err-ar','');
  }catch(e){
    btn.textContent='▶ START CAMERA';btn.disabled=false;
    showErrBox('err-ar','Camera access denied. Please allow camera permission.');
  }
}

function stopAR(){
  if(_arStream){_arStream.getTracks().forEach(t=>t.stop());_arStream=null;}
  if(_arAutoTimer){clearInterval(_arAutoTimer);_arAutoTimer=null;}
  _arRunning=false;_arAnalyzing=false;
  const btn=document.getElementById('ar-start-btn');
  const snapBtn=document.getElementById('ar-snap-btn');
  const autoBtn=document.getElementById('ar-auto-btn');
  const status=document.getElementById('ar-status');
  if(btn){btn.textContent='▶ START CAMERA';btn.disabled=false;btn.style.borderColor='';btn.style.color='';}
  if(snapBtn)snapBtn.disabled=true;
  if(autoBtn){autoBtn.disabled=true;autoBtn.classList.remove('active');}
  if(status){status.textContent='CAMERA READY — TAP SCAN';status.style.color='';}
  const sl=document.getElementById('ar-scanline');if(sl)sl.classList.remove('active');
  const counter=document.getElementById('ar-counter-label');if(counter)counter.textContent='';
}

function captureARframe(){
  const video=document.getElementById('ar-video');
  const canvas=document.getElementById('ar-canvas');
  canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.82).split(',')[1];
}

async function arSnap(){
  if(!_arRunning||_arAnalyzing)return;
  _arAnalyzing=true;
  const status=document.getElementById('ar-status');
  const sl=document.getElementById('ar-scanline');
  const overlay=document.getElementById('ar-overlay');
  const snapBtn=document.getElementById('ar-snap-btn');
  snapBtn.disabled=true;snapBtn.textContent='⏳ ANALYZING...';
  if(sl)sl.classList.add('active');
  if(status){status.textContent='AI ANALYZING...';status.style.color='var(--violet2)';}

  try{
    const frameB64=captureARframe();
    const arc=getArchive(selCat);
    const dims=arc.dims;
    const dimBlock=dims.map(d=>'"'+d+'":{"score":0,"note":"","archive_ref":""}').join(',');
    // Compact prompt for speed
    const prompt='You are SCANIQ AR. Analyze this camera frame instantly. Return PURE JSON ONLY:\n'+

      '{"name":"","subtitle":"","category":"","category_emoji":"","confidence":"High|Medium|Low",'+
      '"price":{"value":"","unit":"","note":"","is_live_needed":false},'+
      '"description":"4-6 expert sentences with technical depth",'+
      '"details":[{"label":"Classification","value":""},{"label":"Origin","value":""},{"label":"Material","value":""},{"label":"Rarity","value":""}],'+
      '"value_matrix":{'+dimBlock+'},'+
      '"overall_value_score":0,"overall_verdict":"","overall_explanation":"",'+
      '"comparisons":[{"name":"","difference":"","price":""}],'+
      '"where_to_buy":[{"platform":"","url":"","price_range":"","notes":""}],'+
      '"timeline":[{"year":"","event":""}],'+
      '"expert_opinion":"","risk_warnings":"","legal_status":"","market_note":"",'+
      '"facts":["specific fact 1 with number","specific fact 2","specific fact 3","specific fact 4","specific fact 5","specific fact 6"]}';

    const body={model:'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:'image/jpeg',data:frameB64}},
      {type:'text',text:prompt}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    let raw='';for(const b of(data.content||[])){if(b.type==='text')raw+=b.text;}
    const clean=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
    const m=clean.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON');
    const r=JSON.parse(m[0]);
    _arLastResult=r;

    // Show mini overlay on viewfinder
    if(overlay){
      overlay.style.display='block';
      document.getElementById('ar-overlay-name').textContent=r.name||'Unknown';
      document.getElementById('ar-overlay-conf').textContent=(r.confidence||'')+'  '+( r.category_emoji||'');
      document.getElementById('ar-overlay-cat').textContent=r.category||'';
      document.getElementById('ar-overlay-price').textContent=r.price?.value&&r.price.value!=='N/A'?'💰 '+r.price.value:'';
      document.getElementById('ar-overlay-desc').textContent=(r.description||'').substring(0,120)+'...';
    }

    // Show full result below
    const wrap=document.getElementById('ar-result-wrap');
    const card=document.getElementById('ar-result-card');
    if(wrap&&card){
      // Reuse renderResult logic but into ar-result-card
      const detsHtml=(r.details||[]).map(d=>'<div class="det-item"><div class="det-label">'+d.label+'</div><div class="det-val">'+(d.value||'—')+'</div></div>').join('');
      const factsHtml=(r.facts||[]).map(f=>'<div class="fact"><div class="fact-dot"></div><div>'+f+'</div></div>').join('');
      const timelineHtml=(r.timeline||[]).filter(t=>t.year&&t.event).length?
        '<div class="section-head">📅 TIMELINE</div><div class="timeline-wrap">'+(r.timeline||[]).map(t=>'<div class="tl-row"><div class="tl-year">'+t.year+'</div><div class="tl-event">'+t.event+'</div></div>').join('')+'</div>':'';
      const comparisonsHtml=(r.comparisons||[]).filter(c=>c.name).length?
        '<div class="section-head">⚖️ SIMILAR</div><div class="cmp-wrap">'+(r.comparisons||[]).map(c=>'<div class="cmp-row"><div class="cmp-name">'+c.name+'</div><div class="cmp-diff">'+c.difference+'</div><div class="cmp-price">'+c.price+'</div></div>').join('')+'</div>':'';
      const expertHtml=r.expert_opinion?'<div class="expert-card"><div class="expert-eye">🎓 EXPERT</div><div class="expert-text">'+r.expert_opinion+'</div></div>':'';
      const priceHtml=r.price?.value&&r.price.value!=='N/A'?'<div class="price-card"><div class="price-eye">ESTIMATED VALUE</div><div class="price-val">'+r.price.value+'</div><div class="price-note">'+(r.price.note||'')+'</div></div>':'';

      card.innerHTML=
        '<div class="result-header"><span class="id-badge">✓ AR SCAN</span><span>'+(r.category_emoji||'📦')+' '+(r.category||'')+'</span><span class="conf-badge">'+(r.confidence||'')+'</span></div>'+
        '<div class="result-body">'+
          '<div class="result-name">'+(r.name||'Unknown')+'</div>'+
          '<div class="result-sub">'+(r.subtitle||'')+'</div>'+
          priceHtml+
          '<div class="result-desc">'+(r.description||'')+'</div>'+
          (detsHtml?'<div class="det-grid">'+detsHtml+'</div>':'')+
          expertHtml+timelineHtml+comparisonsHtml+
          (r.market_note?'<div class="market-card"><div class="market-eye">📈 MARKET</div><div style="font-size:.8rem;color:var(--text2)">'+r.market_note+'</div></div>':'')+
          (factsHtml?'<div class="facts-head">🔬 KEY INTELLIGENCE</div>'+factsHtml:'')+
        '</div>';
      wrap.style.display='block';
      wrap.scrollIntoView({behavior:'smooth',block:'start'});
    }

    if(status){status.textContent='✅ '+( r.name||'Identified')+' — '+( r.confidence||'')+' confidence';status.style.color='var(--green)';}
  }catch(e){
    if(status){status.textContent='⚠ Analysis failed — try again';status.style.color='var(--red)';}
  }finally{
    _arAnalyzing=false;
    if(sl)sl.classList.remove('active');
    if(snapBtn){snapBtn.disabled=false;snapBtn.textContent='⚡ SNAP & ANALYZE';}
  }
}

let _arAutoCountdown=0,_arCountdownTimer=null;
function toggleARauto(){
  const btn=document.getElementById('ar-auto-btn');
  const counter=document.getElementById('ar-counter-label');
  if(_arAutoTimer){
    clearInterval(_arAutoTimer);_arAutoTimer=null;
    if(_arCountdownTimer){clearInterval(_arCountdownTimer);_arCountdownTimer=null;}
    btn.classList.remove('active');btn.textContent='AUTO';
    if(counter)counter.textContent='';
  }else{
    const ms=parseInt(document.getElementById('ar-interval').value)||5000;
    const secs=ms/1000;
    btn.classList.add('active');btn.textContent='AUTO ON';
    _arAutoCountdown=secs;
    if(counter)counter.textContent='Next: '+_arAutoCountdown+'s';
    _arCountdownTimer=setInterval(()=>{
      _arAutoCountdown--;
      if(counter)counter.textContent='Next: '+_arAutoCountdown+'s';
      if(_arAutoCountdown<=0)_arAutoCountdown=secs;
    },1000);
    _arAutoTimer=setInterval(()=>{
      if(!_arAnalyzing&&_arRunning)arSnap();
    },ms);
  }
}

function useARresult(){
  if(!_arLastResult)return;
  // Transfer AR result to main scanner and switch to scan mode
  switchMode('scan');
  // Capture a still from the camera as the "scanned image"
  const canvas=document.getElementById('ar-canvas');
  if(canvas&&canvas.width>0){
    const dataUrl=canvas.toDataURL('image/jpeg',0.9);
    const img=document.getElementById('preview-img');
    if(img){img.src=dataUrl;img.style.display='block';}
    document.getElementById('drop-ph').style.display='none';
    document.getElementById('tgt').style.display='none';
    document.getElementById('drop-zone').classList.add('has-image');
    imgB64=dataUrl.split(',')[1];imgMime='image/jpeg';
  }
  renderResult(_arLastResult,false,selCat);
  window._lastResult=_arLastResult;
  document.getElementById('results-wrap').style.display='block';
}


/* ══════════════════════════════════════════════════
   BATCH SCAN ENGINE
══════════════════════════════════════════════════ */
let _batchImgs=[]; // {b64, mime, dataUrl, result}

document.getElementById('fi-batch')?.addEventListener('change',e=>{addBatchImages(e.target.files);e.target.value='';});
document.getElementById('fi-batch-cam')?.addEventListener('change',e=>{addBatchImages(e.target.files);e.target.value='';});

function addBatchImages(files){
  const remaining=5-_batchImgs.length;
  const toAdd=Array.from(files).slice(0,remaining);
  let loaded=0;
  toAdd.forEach(f=>{
    const r=new FileReader();
    r.onload=ev=>{
      _batchImgs.push({b64:ev.target.result.split(',')[1],mime:f.type||'image/jpeg',dataUrl:ev.target.result,result:null});
      loaded++;
      if(loaded===toAdd.length)renderBatchGrid();
    };
    r.readAsDataURL(f);
  });
}

function renderBatchGrid(){
  const grid=document.getElementById('batch-grid');
  grid.innerHTML=_batchImgs.map((img,i)=>
    '<div class="batch-cell"><img src="'+img.dataUrl+'"><button class="batch-del" onclick="removeBatchImg('+i+')">✕</button>'+
    (img.result?'<div class="batch-status" style="color:var(--green)">✓ '+(img.result.name||'Done').substring(0,14)+'</div>':'')+
    '</div>'
  ).join('');
  if(_batchImgs.length<5){
    grid.innerHTML+='<div class="batch-add" onclick="document.getElementById(\'fi-batch\').click()">➕</div>';
  }
  document.getElementById('btn-batch').disabled=_batchImgs.length===0;
}

function removeBatchImg(i){_batchImgs.splice(i,1);renderBatchGrid();document.getElementById('batch-results').innerHTML='';}

async function runBatchScan(){
  if(!_batchImgs.length)return;
  const btn=document.getElementById('btn-batch');
  const loading=document.getElementById('batch-loading');
  btn.disabled=true;loading.style.display='block';
  showErrBox('err-batch','');
  document.getElementById('batch-results').innerHTML='';
  const arc=getArchive(selCat);
  const dims=arc.dims;
  const dimBlock=dims.map(d=>'"'+d+'":{"score":0,"note":"","archive_ref":""}').join(',');
  const compactPrompt='You are SCANIQ. Identify this item. Return PURE JSON ONLY:\n'+
    '{"name":"","subtitle":"","category":"","category_emoji":"","confidence":"High|Medium|Low",'+
    '"price":{"value":"","unit":"","note":"","is_live_needed":false},'+
    '"description":"4-5 expert sentences",'+
    '"details":[{"label":"Classification","value":""},{"label":"Origin","value":""},{"label":"Material","value":""}],'+
    '"value_matrix":{'+dimBlock+'},"overall_value_score":0,"overall_verdict":"","overall_explanation":"",'+
    '"facts":["fact 1 with data","fact 2","fact 3","fact 4"]}';

  for(let i=0;i<_batchImgs.length;i++){
    document.getElementById('batch-lt').textContent='SCANNING '+(i+1)+' / '+_batchImgs.length;
    const img=_batchImgs[i];
    try{
      const body={model:'claude-sonnet-4-6',max_tokens:1800,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:img.mime,data:img.b64}},
        {type:'text',text:compactPrompt}
      ]}]};
      const resp=await fetch(API_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await resp.json();
      let raw='';for(const b of(data.content||[])){if(b.type==='text')raw+=b.text;}
      const clean=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
      const m=clean.match(/\{[\s\S]*\}/);
      img.result=m?JSON.parse(m[0]):null;
    }catch(e){img.result=null;}
    renderBatchGrid();
    renderBatchResults();
  }
  loading.style.display='none';
  btn.disabled=false;
  // Save each to history
  _batchImgs.forEach(img=>{
    if(img.result&&document.getElementById('t-hist').classList.contains('on')){
      hist.unshift({id:Date.now()+Math.random(),thumb:img.dataUrl,result:img.result,ts:new Date().toISOString(),cat:selCat});
    }
  });
  if(hist.length>20)hist=hist.slice(0,20);
  try{localStorage.setItem('sq4_hist',JSON.stringify(hist));}catch{}
  renderRecentHist();
}

function renderBatchResults(){
  const wrap=document.getElementById('batch-results');
  wrap.innerHTML=_batchImgs.filter(i=>i.result).map((img,idx)=>{
    const r=img.result;
    return '<div class="batch-result-item"><img src="'+img.dataUrl+'"><div style="flex:1;min-width:0">'+
      '<div style="font-weight:700;font-size:.86rem;color:var(--text)">'+(r.category_emoji||'📦')+' '+(r.name||'Unknown')+'</div>'+
      '<div style="font-size:.72rem;color:var(--text3);font-family:JetBrains Mono,monospace;margin:2px 0">'+(r.category||'')+' · '+(r.confidence||'')+'</div>'+
      (r.price?.value&&r.price.value!=='N/A'?'<div style="font-size:.8rem;color:var(--green);font-weight:600">'+r.price.value+'</div>':'')+
      '<div style="font-size:.72rem;color:var(--text2);line-height:1.5;margin-top:3px">'+(r.description||'').substring(0,110)+'...</div>'+
      '</div></div>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   COMPARE ENGINE (Scan vs Scan)
══════════════════════════════════════════════════ */
let _cmpA=null,_cmpB=null; // {b64, mime, dataUrl}

document.getElementById('fi-cmp-a')?.addEventListener('change',e=>{if(e.target.files[0])loadCmpImg(e.target.files[0],'a');e.target.value='';});
document.getElementById('fi-cmp-b')?.addEventListener('change',e=>{if(e.target.files[0])loadCmpImg(e.target.files[0],'b');e.target.value='';});

function loadCmpImg(f,slot){
  const r=new FileReader();
  r.onload=ev=>{
    const obj={b64:ev.target.result.split(',')[1],mime:f.type||'image/jpeg',dataUrl:ev.target.result};
    if(slot==='a')_cmpA=obj;else _cmpB=obj;
    const prev=document.getElementById('cmp-prev-'+slot);
    const ph=document.getElementById('cmp-ph-'+slot);
    prev.src=ev.target.result;prev.style.display='block';ph.style.display='none';
    document.getElementById('btn-compare').disabled=!(_cmpA&&_cmpB);
  };
  r.readAsDataURL(f);
}

async function runCompare(){
  if(!_cmpA||!_cmpB)return;
  const btn=document.getElementById('btn-compare');
  const loading=document.getElementById('compare-loading');
  btn.disabled=true;loading.style.display='block';
  showErrBox('err-compare','');
  document.getElementById('compare-result').innerHTML='';
  const prompt='You are SCANIQ COMPARE. Two items are shown (Image 1 = Item A, Image 2 = Item B). '+
    'Analyze BOTH and determine which is the better value/quality/choice. Return PURE JSON ONLY:\n'+
    '{"item_a":{"name":"","category":"","price":"","value_score":0,"key_strength":"","key_weakness":""},'+
    '"item_b":{"name":"","category":"","price":"","value_score":0,"key_strength":"","key_weakness":""},'+
    '"winner":"A|B|Tie","winner_reason":"2-3 sentences explaining which wins and why",'+
    '"comparison_points":[{"aspect":"e.g. Value","a_rating":"","b_rating":"","note":""},{"aspect":"Quality","a_rating":"","b_rating":"","note":""},{"aspect":"Rarity","a_rating":"","b_rating":"","note":""}],'+
    '"recommendation":"which to buy/keep and for whom","value_scores":{"a":0,"b":0}}';
  try{
    const body={model:'claude-sonnet-4-6',max_tokens:2500,messages:[{role:'user',content:[
      {type:'text',text:'Item A (first image):'},
      {type:'image',source:{type:'base64',media_type:_cmpA.mime,data:_cmpA.b64}},
      {type:'text',text:'Item B (second image):'},
      {type:'image',source:{type:'base64',media_type:_cmpB.mime,data:_cmpB.b64}},
      {type:'text',text:prompt}
    ]}]};
    const resp=await fetch(API_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await resp.json();
    let raw='';for(const b of(data.content||[])){if(b.type==='text')raw+=b.text;}
    const clean=raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g,'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').trim();
    const m=clean.match(/\{[\s\S]*\}/);if(!m)throw new Error('No JSON');
    const r=JSON.parse(m[0]);
    loading.style.display='none';btn.disabled=false;
    renderCompareResult(r);
  }catch(e){
    loading.style.display='none';btn.disabled=false;
    showErrBox('err-compare','Compare failed: '+e.message);
  }
}

function renderCompareResult(r){
  const wrap=document.getElementById('compare-result');
  const winner=r.winner||'Tie';
  const winnerName=winner==='A'?(r.item_a?.name||'Item A'):winner==='B'?(r.item_b?.name||'Item B'):'Tie';
  const sa=parseInt(r.value_scores?.a??r.item_a?.value_score)||0;
  const sb=parseInt(r.value_scores?.b??r.item_b?.value_score)||0;
  const pointsHtml=(r.comparison_points||[]).map(p=>
    '<div style="border-top:1px solid var(--rim2);padding:8px 0"><div style="font-family:JetBrains Mono,monospace;font-size:.62rem;color:var(--cyan);letter-spacing:.15em;margin-bottom:4px">'+(p.aspect||'').toUpperCase()+'</div>'+
    '<div style="display:flex;gap:10px;font-size:.76rem"><div style="flex:1"><span style="color:var(--text3)">A:</span> <span style="color:var(--text2)">'+(p.a_rating||'—')+'</span></div>'+
    '<div style="flex:1"><span style="color:var(--text3)">B:</span> <span style="color:var(--text2)">'+(p.b_rating||'—')+'</span></div></div>'+
    (p.note?'<div style="font-size:.68rem;color:var(--text3);margin-top:3px">'+p.note+'</div>':'')+'</div>'
  ).join('');

  wrap.innerHTML=
    '<div class="cmp-winner"><div style="font-family:JetBrains Mono,monospace;font-size:.62rem;color:var(--green);letter-spacing:.2em;margin-bottom:5px">🏆 WINNER</div>'+
    '<div style="font-family:Orbitron,monospace;font-size:1.1rem;font-weight:900;color:var(--green)">'+(winner==='Tie'?'IT\'S A TIE':winnerName)+'</div>'+
    '<div style="font-size:.78rem;color:var(--text2);margin-top:6px;line-height:1.6">'+(r.winner_reason||'')+'</div></div>'+
    // Score bars
    '<div class="cmp-verdict-card"><div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.76rem"><span style="color:'+(winner==='A'?'var(--green)':'var(--text2)')+'">🅰️ '+(r.item_a?.name||'Item A')+'</span><span style="font-weight:700;color:var(--cyan)">'+sa+'/100</span></div>'+
    '<div style="background:var(--card2);border-radius:6px;height:8px;overflow:hidden;margin-bottom:12px"><div style="width:'+sa+'%;height:100%;background:'+(winner==='A'?'var(--green)':'var(--cyan)')+'"></div></div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:.76rem"><span style="color:'+(winner==='B'?'var(--green)':'var(--text2)')+'">🅱️ '+(r.item_b?.name||'Item B')+'</span><span style="font-weight:700;color:var(--cyan)">'+sb+'/100</span></div>'+
    '<div style="background:var(--card2);border-radius:6px;height:8px;overflow:hidden"><div style="width:'+sb+'%;height:100%;background:'+(winner==='B'?'var(--green)':'var(--cyan)')+'"></div></div></div>'+
    // Detail comparison
    '<div class="cmp-verdict-card">'+pointsHtml+'</div>'+
    // Recommendation
    (r.recommendation?'<div class="expert-card"><div class="expert-eye">💡 RECOMMENDATION</div><div class="expert-text" style="font-style:normal">'+r.recommendation+'</div></div>':'');
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ══════════════════════════════════════════════════
   PDF REPORT EXPORT
══════════════════════════════════════════════════ */
async function exportResultPDF(){
  if(!window._lastResult){alert('No result to export.');return;}
  const r=window._lastResult;
  const btn=event?.target;
  if(btn){btn.disabled=true;btn.textContent='⏳ GENERATING...';}
  try{
    const { jsPDF }=window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'a4'});
    const W=doc.internal.pageSize.getWidth();
    const H=doc.internal.pageSize.getHeight();
    const M=40; let y=M;
    const line=(txt,size,color,bold,gap)=>{
      doc.setFontSize(size||11);
      doc.setTextColor(color||'#1a1a2e');
      doc.setFont('helvetica',bold?'bold':'normal');
      const lines=doc.splitTextToSize(txt,W-M*2);
      lines.forEach(ln=>{if(y>H-M){doc.addPage();y=M;}doc.text(ln,M,y);y+=(size||11)*1.35;});
      if(gap)y+=gap;
    };
    // Header band
    doc.setFillColor('#0a1220');doc.rect(0,0,W,70,'F');
    doc.setTextColor('#00e5ff');doc.setFontSize(22);doc.setFont('helvetica','bold');
    doc.text('SCANIQ',M,42);
    doc.setTextColor('#8ab0cc');doc.setFontSize(9);doc.setFont('helvetica','normal');
    doc.text('INTELLIGENCE REPORT',M,56);
    doc.setTextColor('#8ab0cc');doc.setFontSize(8);
    doc.text(new Date().toLocaleString(),W-M-120,56);
    y=95;
    // Image thumb
    try{const img=document.getElementById('preview-img');if(img&&img.src&&img.src.startsWith('data:')){doc.addImage(img.src,'JPEG',W-M-110,y,110,110);}}catch(e){}
    // Name & category
    line((r.category_emoji||'')+' '+(r.category||''),9,'#00b8d4',true,2);
    line(r.name||'Unknown',18,'#0a1220',true,2);
    if(r.subtitle)line(r.subtitle,10,'#666',false,8);
    // Price
    if(r.price?.value&&r.price.value!=='N/A'){line('MARKET VALUE: '+r.price.value+(r.price.note?' ('+r.price.note+')':''),12,'#00875a',true,8);}
    // Value score
    if(r.overall_verdict&&r.overall_verdict!=='N/A'){line('VALUE: '+r.overall_verdict+' — '+(r.overall_value_score||0)+'/100',11,'#6d28d9',true,8);}
    y+=4;
    // Description
    line('DESCRIPTION',10,'#00b8d4',true,3);
    line(r.description||'',10,'#333',false,10);
    // Details
    if((r.details||[]).length){
      line('DETAILS',10,'#00b8d4',true,3);
      (r.details||[]).forEach(d=>{if(d.value&&d.value!=='—')line('• '+d.label+': '+d.value,10,'#333',false,0);});
      y+=8;
    }
    // Expert opinion
    if(r.expert_opinion){line('EXPERT OPINION',10,'#00b8d4',true,3);line(r.expert_opinion,10,'#333',false,10);}
    // Timeline
    if((r.timeline||[]).filter(t=>t.year&&t.event).length){
      line('TIMELINE',10,'#00b8d4',true,3);
      (r.timeline||[]).forEach(t=>{if(t.year&&t.event)line('• '+t.year+': '+t.event,10,'#333',false,0);});
      y+=8;
    }
    // Comparisons
    if((r.comparisons||[]).filter(c=>c.name).length){
      line('SIMILAR ITEMS',10,'#00b8d4',true,3);
      (r.comparisons||[]).forEach(c=>{if(c.name)line('• '+c.name+' — '+(c.difference||'')+' ('+(c.price||'')+')',10,'#333',false,0);});
      y+=8;
    }
    // Facts
    if((r.facts||[]).length){
      line('KEY INTELLIGENCE',10,'#00b8d4',true,3);
      (r.facts||[]).forEach(f=>line('• '+f,10,'#333',false,0));
      y+=8;
    }
    // Market note
    if(r.market_note){line('MARKET INTELLIGENCE',10,'#00b8d4',true,3);line(r.market_note,10,'#333',false,8);}
    // Legal / risk
    if(r.legal_status){line('LEGAL STATUS',10,'#d97706',true,3);line(r.legal_status,10,'#333',false,6);}
    if(r.risk_warnings){line('RISK & WARNINGS',10,'#dc2626',true,3);line(r.risk_warnings,10,'#333',false,6);}
    // Footer
    doc.setFontSize(8);doc.setTextColor('#999');
    doc.text('Generated by SCANIQ · MonteCarlo News24 · AI-powered visual intelligence',M,H-20);
    const fname='SCANIQ_'+(r.name||'report').replace(/[^a-z0-9]/gi,'_').substring(0,30)+'.pdf';
    doc.save(fname);
    if(btn){btn.textContent='✅ SAVED';setTimeout(()=>{btn.disabled=false;btn.textContent='📄 PDF REPORT';},2000);}
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='📄 PDF REPORT';}
    alert('PDF generation failed: '+e.message);
  }
}

/* ══════════════════════════════════════════════════
   SHARE CARD (Instagram/WhatsApp-ready image)
══════════════════════════════════════════════════ */
async function shareResultCard(){
  if(!window._lastResult){alert('No result to share.');return;}
  const r=window._lastResult;
  const btn=event?.target;
  if(btn){btn.disabled=true;btn.textContent='⏳ CREATING...';}
  try{
    const canvas=document.getElementById('share-card-canvas');
    const W=1080,Hc=1350;
    canvas.width=W;canvas.height=Hc;
    const ctx=canvas.getContext('2d');
    // Background gradient
    const g=ctx.createLinearGradient(0,0,W,Hc);
    g.addColorStop(0,'#0a1220');g.addColorStop(1,'#111a2e');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,Hc);
    // Grid lines subtle
    ctx.strokeStyle='rgba(0,229,255,0.05)';ctx.lineWidth=1;
    for(let i=0;i<W;i+=60){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,Hc);ctx.stroke();}
    for(let i=0;i<Hc;i+=60){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(W,i);ctx.stroke();}
    // Logo
    ctx.fillStyle='#00e5ff';ctx.font='bold 64px Arial';ctx.fillText('SCANIQ',60,110);
    ctx.fillStyle='#8ab0cc';ctx.font='24px monospace';ctx.fillText('UNIVERSAL INTELLIGENCE',60,148);
    // Image
    const previewImg=document.getElementById('preview-img');
    let imgBottom=200;
    if(previewImg&&previewImg.src&&previewImg.src.startsWith('data:')){
      await new Promise(res=>{
        const im=new Image();im.onload=()=>{
          const size=560,ix=(W-size)/2,iy=200;
          ctx.save();
          ctx.beginPath();
          if(ctx.roundRect)ctx.roundRect(ix,iy,size,size,28);else ctx.rect(ix,iy,size,size);
          ctx.clip();
          const ar=im.width/im.height;let dw=size,dh=size,dx=ix,dy=iy;
          if(ar>1){dh=size;dw=size*ar;dx=ix-(dw-size)/2;}else{dw=size;dh=size/ar;dy=iy-(dh-size)/2;}
          ctx.drawImage(im,dx,dy,dw,dh);
          ctx.restore();
          ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;
          if(ctx.roundRect){ctx.beginPath();ctx.roundRect(ix,iy,size,size,28);ctx.stroke();}
          imgBottom=iy+size;res();
        };im.onerror=res;im.src=previewImg.src;
      });
    }
    let y=imgBottom+70;
    // Category
    ctx.fillStyle='#00b8d4';ctx.font='28px monospace';
    ctx.fillText((r.category_emoji||'')+' '+(r.category||'').toUpperCase(),60,y);y+=60;
    // Name
    ctx.fillStyle='#ffffff';ctx.font='bold 52px Arial';
    const nameLines=wrapText(ctx,r.name||'Unknown',W-120,52);
    nameLines.slice(0,2).forEach(ln=>{ctx.fillText(ln,60,y);y+=62;});
    y+=10;
    // Price
    if(r.price?.value&&r.price.value!=='N/A'){
      ctx.fillStyle='#00dc96';ctx.font='bold 44px Arial';
      ctx.fillText('💰 '+r.price.value,60,y);y+=64;
    }
    // Value verdict
    if(r.overall_verdict&&r.overall_verdict!=='N/A'){
      ctx.fillStyle='#a78bfa';ctx.font='34px Arial';
      const vLines=wrapText(ctx,'⭐ '+r.overall_verdict,W-120,34);
      vLines.slice(0,1).forEach(ln=>{ctx.fillText(ln,60,y);y+=48;});
    }
    // Footer
    ctx.fillStyle='#5a7a94';ctx.font='24px monospace';
    ctx.fillText('Scanned with SCANIQ · Get it on Google Play',60,Hc-50);
    // Export
    canvas.toBlob(async(blob)=>{
      const file=new File([blob],'scaniq-card.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        try{await navigator.share({files:[file],title:'SCANIQ Result'});}catch(e){}
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='scaniq-card.png';a.click();
        URL.revokeObjectURL(url);
      }
      if(btn){btn.textContent='✅ DONE';setTimeout(()=>{btn.disabled=false;btn.textContent='🖼️ SHARE CARD';},2000);}
    },'image/png');
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='🖼️ SHARE CARD';}
    alert('Card creation failed: '+e.message);
  }
}

function wrapText(ctx,text,maxW,fontSize){
  const words=(text||'').split(' ');const lines=[];let cur='';
  words.forEach(w=>{
    const test=cur?cur+' '+w:w;
    if(ctx.measureText(test).width>maxW&&cur){lines.push(cur);cur=w;}else{cur=test;}
  });
  if(cur)lines.push(cur);
  return lines;
}

/* ══════════════════════════════════════════════════
   PORTFOLIO TRACKER
══════════════════════════════════════════════════ */
let portfolio=JSON.parse(localStorage.getItem('sq4_portfolio')||'[]');
function savePortfolio(){try{localStorage.setItem('sq4_portfolio',JSON.stringify(portfolio));}catch{}}

// Parse a price string like "$120–$450" or "$3,200" → average numeric value
function parsePriceValue(priceStr){
  if(!priceStr||priceStr==='N/A')return 0;
  const nums=(priceStr.match(/[\d,]+(?:\.\d+)?/g)||[]).map(n=>parseFloat(n.replace(/,/g,''))).filter(n=>!isNaN(n));
  if(!nums.length)return 0;
  if(nums.length>=2)return (nums[0]+nums[1])/2; // average of range
  return nums[0];
}

function addToPortfolio(){
  if(!window._lastResult){alert('No result to add.');return;}
  const r=window._lastResult;
  const priceVal=parsePriceValue(r.price?.value);
  if(priceVal<=0){
    const manual=prompt('No price detected. Enter estimated value in USD (numbers only):');
    const mv=parseFloat((manual||'').replace(/[^\d.]/g,''));
    if(isNaN(mv)||mv<=0)return;
    _doAddPortfolio(r,mv);
  }else{
    _doAddPortfolio(r,priceVal);
  }
}

function _doAddPortfolio(r,value){
  const thumb=document.getElementById('preview-img')?.src||'';
  const entry={
    id:Date.now(),
    name:r.name||'Unknown',
    category:r.category||'Other',
    emoji:r.category_emoji||'📦',
    value:value,
    priceStr:r.price?.value||('$'+value),
    thumb:thumb.startsWith('data:')?thumb:'',
    ts:new Date().toISOString()
  };
  portfolio.unshift(entry);
  savePortfolio();
  const btn=event?.target;
  if(btn){btn.textContent='✅ ADDED — $'+value.toLocaleString();setTimeout(()=>{btn.textContent='💼 ADD TO PORTFOLIO';},2500);}
}

function removeFromPortfolio(id){
  portfolio=portfolio.filter(p=>p.id!==id);
  savePortfolio();renderPortfolio();
}

function renderPortfolio(){
  const c=document.getElementById('portfolio-content');
  if(!c)return;
  if(!portfolio.length){
    c.innerHTML='<div class="pf-empty">💼 YOUR PORTFOLIO IS EMPTY<br><br>Scan any valuable item, then tap<br>"💼 ADD TO PORTFOLIO" to track its value here.</div>';
    return;
  }
  const total=portfolio.reduce((s,p)=>s+(p.value||0),0);
  // Group by category
  const cats={};
  portfolio.forEach(p=>{
    const k=p.category||'Other';
    if(!cats[k])cats[k]={name:k,emoji:p.emoji,value:0,count:0};
    cats[k].value+=p.value||0;cats[k].count++;
  });
  const catArr=Object.values(cats).sort((a,b)=>b.value-a.value);
  const top=[...portfolio].sort((a,b)=>b.value-a.value)[0];
  const fmt=v=>'$'+Math.round(v).toLocaleString();

  let hero='<div class="pf-hero"><div class="pf-total-lbl">TOTAL PORTFOLIO VALUE</div><div class="pf-total">'+fmt(total)+'</div>'+
    '<div class="pf-meta">'+portfolio.length+' items · '+catArr.length+' categories</div></div>';

  // Category breakdown
  let catHtml='<div class="pf-section-head">📊 By Category</div>';
  catArr.forEach(cat=>{
    const pct=total>0?Math.round(cat.value/total*100):0;
    catHtml+='<div class="pf-cat-row"><div class="pf-cat-ico">'+(cat.emoji||'📦')+'</div>'+
      '<div class="pf-cat-info"><div class="pf-cat-name">'+cat.name+'</div>'+
      '<div class="pf-cat-bar"><div class="pf-cat-fill" style="width:'+pct+'%"></div></div></div>'+
      '<div class="pf-cat-val"><div class="pf-cat-amount">'+fmt(cat.value)+'</div><div class="pf-cat-pct">'+pct+'% · '+cat.count+'</div></div></div>';
  });

  // Top item
  let topHtml='';
  if(top){
    topHtml='<div class="pf-section-head">🏆 Top Item</div>'+
      '<div class="pf-item" style="border-color:rgba(251,191,36,.3)">'+
      (top.thumb?'<img src="'+top.thumb+'">':'<div style="width:48px;height:48px;border-radius:9px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">'+(top.emoji||'📦')+'</div>')+
      '<div class="pf-item-info"><div class="pf-item-name">'+top.name+'</div><div class="pf-item-cat">'+top.category+'</div></div>'+
      '<div class="pf-item-val">'+fmt(top.value)+'</div></div>';
  }

  // All items
  let itemsHtml='<div class="pf-section-head">💼 All Holdings</div>';
  portfolio.forEach(p=>{
    itemsHtml+='<div class="pf-item">'+
      (p.thumb?'<img src="'+p.thumb+'">':'<div style="width:48px;height:48px;border-radius:9px;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">'+(p.emoji||'📦')+'</div>')+
      '<div class="pf-item-info"><div class="pf-item-name">'+p.name+'</div><div class="pf-item-cat">'+p.emoji+' '+p.category+'</div></div>'+
      '<div class="pf-item-val">'+fmt(p.value)+'</div>'+
      '<button class="pf-item-del" onclick="removeFromPortfolio('+p.id+')">✕</button></div>';
  });

  c.innerHTML=hero+catHtml+topHtml+itemsHtml;
}
