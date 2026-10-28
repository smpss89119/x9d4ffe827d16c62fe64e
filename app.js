'use strict';
const $=id=>document.getElementById(id), te=new TextEncoder(), LS='bkk_cred_v1', LOCK_MS=5*60e3;
const ub=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)), bu=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ROLE='',CODE='',SHT=null,V=null,KEY=null,RAW=null,M=null,blobs=new Map(),hiddenAt=0,ST={v:'home'},IDX=null;
/* ---------- crypto ---------- */
const aesKey=(raw,use)=>crypto.subtle.importKey('raw',raw,'AES-GCM',false,use);
async function pbk(pw,w){const b=await crypto.subtle.importKey('raw',te.encode(pw),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:ub(w.salt),iterations:w.it},b,256))}
async function unwrapPw(pw,w){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(w.iv)},await aesKey(await pbk(pw,w),['decrypt']),ub(w.ct)))}
async function prfKey(out){const b=await crypto.subtle.importKey('raw',out,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:te.encode('bkk-trip-v1'),info:te.encode('kek')},b,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function dec(name){const r=await fetch('d/'+name);if(!r.ok)throw Error('讀取失敗 '+r.status);const b=new Uint8Array(await r.arrayBuffer());
 return crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},KEY,b.slice(12))}
async function blobUrl(n){if(!blobs.has(n))blobs.set(n,URL.createObjectURL(new Blob([await dec(n)],{type:'image/png'})));return blobs.get(n)}
const err=m=>$('lerr').textContent=m||'';
async function openWith(raw){KEY=await aesKey(raw,['decrypt']);M=JSON.parse(new TextDecoder().decode(await dec(V.m)));IDX=null}
const normCode=v=>String(v).toUpperCase().replace(/[^A-Z0-9]/g,''),CODE_RE=/^[A-HJKMNP-Z2-9]{20}$/;
/* ---------- companion invite (owner side: needs a fresh Face ID check) ---------- */
function shareHide(){if(SHT){clearInterval(SHT);SHT=null}const s=$('share');if(!s)return;s.hidden=true;$('shareOut').hidden=true;$('shareCode').textContent='';$('shareErr').textContent='';const c=$('shareQr');c.width=c.height=1;c.removeAttribute('data-link');$('bShareAuth').hidden=false}
function shareOpen(){if(!KEY||ROLE==='c')return;shareHide();$('share').hidden=false}
function drawQR(cv,text){const q=qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount(),m=4,sc=Math.max(4,Math.floor(720/(n+2*m)));cv.width=cv.height=(n+2*m)*sc;
 const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,cv.width,cv.height);g.fillStyle='#000';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))g.fillRect((c+m)*sc,(r+m)*sc,sc,sc)}
async function shareAuth(){const E=m=>$('shareErr').textContent=m||'';let raw=null;try{E();
 const cred=JSON.parse(localStorage.getItem(LS)||'null');if(!cred)throw Error('這支手機還沒設定 Face ID，請先鎖定後用復原密語設定');
 if(cred.r==='c')throw Error('旅伴的手機不能再分享');
 const out=await prfGet(ub(cred.id));       // fresh passkey assertion (Face ID) every time
 raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(cred.iv)},await prfKey(out),ub(cred.ct)));
 const hk=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveKey']),ik=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:te.encode('bkk-trip-v1'),info:te.encode('invite')},hk,{name:'AES-GCM',length:256},false,['decrypt']);
 const r=await fetch('d/'+V.inv);if(!r.ok)throw Error('讀取邀請失敗');const b=new Uint8Array(await r.arrayBuffer());
 const code=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},ik,b.slice(12)))).c;
 const link=location.origin+location.pathname+'#c='+code+'&e='+(Date.now()+10*60e3);
 drawQR($('shareQr'),link);$('shareQr').dataset.link=link;$('shareCode').textContent=code.match(/.{5}/g).join('-');
 $('bShareAuth').hidden=true;$('shareOut').hidden=false;let left=180;const T=()=>{$('shareTimer').textContent='這個畫面 '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+' 後自動關閉'};T();
 SHT=setInterval(()=>{left--;if(left<=0)shareHide();else T()},1000)}
 catch(e){E('無法顯示：'+(e&&e.message||e))}finally{if(raw)raw.fill(0)}}
/* ---------- lock screen ---------- */
async function initLock(){
 try{V=await (await fetch('vault.json',{cache:'no-cache'})).json()}catch(e){if(!V){err('離線又沒有快取，請連網再開一次喵');return}}
 const cred=localStorage.getItem(LS), HP=new URLSearchParams(location.hash.slice(1)), s=HP.get('s');
 $('bFace').hidden=!cred;$('setupBox').hidden=true;$('bSkip').hidden=true;
 $('lmsg').textContent=cred?'用 Face ID 解鎖喵～':'請用設定連結開啟，或輸入復原密語喵';
 $('bCopy').hidden=true;
 if(s){history.replaceState(null,'',location.pathname);try{RAW=await unwrapPw(s,V.setup);$('lmsg').textContent='設定連結正確喵！';$('setupBox').hidden=false}catch(e){err('設定連結不對喵')}}
 const c=HP.get('c'),ex=+HP.get('e')||0;
 if(c){history.replaceState(null,'',location.pathname);
  if(ex&&Date.now()>ex)err('這個邀請 QR 已過期，請對方重新顯示一張新的喵');
  else if(!V.comp)err('這個版本不支援旅伴邀請喵');
  else try{RAW=await unwrapPw(normCode(c),V.comp);ROLE='c';CODE=normCode(c);$('lmsg').textContent='旅伴邀請正確喵！先加到主畫面，再設定你自己的 Face ID';$('setupBox').hidden=false;$('bCopy').hidden=false}catch(e){err('邀請連結不對或已作廢喵')}}
}
async function prfGet(rawId){const a=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),
 allowCredentials:[{type:'public-key',id:rawId}],userVerification:'required',extensions:{prf:{eval:{first:ub(V.prfSalt)}}}}});
 const r=a.getClientExtensionResults().prf;if(!r||!r.results)throw Error('沒有拿到 PRF（需要 iOS 18 以上）');return r.results.first}
async function enroll(){try{err();if(!window.PublicKeyCredential)throw Error('這個瀏覽器不支援通行金鑰');
 const c=await navigator.credentials.create({publicKey:{rp:{name:'曼谷喵導遊'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'bkk-trip',displayName:'曼谷旅遊'},
  challenge:crypto.getRandomValues(new Uint8Array(32)),pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
  authenticatorSelection:{residentKey:'required',userVerification:'required'},extensions:{prf:{eval:{first:ub(V.prfSalt)}}}}});
 const ext=c.getClientExtensionResults();if(ext.prf&&ext.prf.enabled===false)throw Error('裝置不支援 PRF（需要 iOS 18 以上）');
 const out=(ext.prf&&ext.prf.results&&ext.prf.results.first)||await prfGet(c.rawId);
 const iv=crypto.getRandomValues(new Uint8Array(12)),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await prfKey(out),RAW);
 localStorage.setItem(LS,JSON.stringify({id:bu(c.rawId),iv:bu(iv),ct:bu(ct),r:ROLE}));CODE='';$('bCopy').hidden=true;
 if(!KEY)await openWith(RAW);RAW=null;unlocked()}catch(e){err('設定失敗喵：'+e.message)}}
async function face(){try{err();const c=JSON.parse(localStorage.getItem(LS));ROLE=c.r||'';const out=await prfGet(ub(c.id));
 await openWith(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(c.iv)},await prfKey(out),ub(c.ct)));unlocked()}catch(e){err('解鎖失敗喵：'+e.message)}}
async function pass(){const v=$('pp').value.trim();if(!v)return;try{err('解密中，請稍等喵…');let raw=null;const nc=normCode(v);if(V.comp&&CODE_RE.test(nc)){try{raw=await unwrapPw(nc,V.comp);ROLE='c';CODE=nc}catch(e){raw=null}}
 if(!raw)raw=await unwrapPw(v,V.pass);$('pp').value='';$('pp').blur();err();
 await openWith(raw);if(!localStorage.getItem(LS)){RAW=raw;$('setupBox').hidden=false;$('bSkip').hidden=false;$('lmsg').textContent=ROLE==='c'?'邀請碼正確！請設定你自己的 Face ID 喵':'密語正確！可以順便設定 Face ID 喵'}else unlocked()}catch(e){err('密語不對喵')}}
function unlocked(){RAW=null;$('lock').hidden=true;$('app').hidden=false;hiddenAt=0;
 const s=history.state&&history.state.v?history.state:{v:'home'};history.replaceState(s,'');render(s);tick()}
function lock(){shareHide();ROLE='';CODE='';KEY=null;M=null;RAW=null;IDX=null;blobs.forEach(u=>URL.revokeObjectURL(u));blobs.clear();
 LASTKEY='';$('main').innerHTML='';$('sBody').innerHTML='';$('qrImg').removeAttribute('src');$('sheet').hidden=$('qr').hidden=true;$('app').hidden=true;$('lock').hidden=false;err();initLock()}
/* auto-lock only after >=5 min truly in background */
function onHide(){shareHide();if(KEY&&!hiddenAt)hiddenAt=Date.now()}
function onShow(){if(!KEY){hiddenAt=0;return}if(hiddenAt&&Date.now()-hiddenAt>=LOCK_MS)lock();hiddenAt=0}
document.addEventListener('visibilitychange',()=>document.visibilityState==='hidden'?onHide():onShow());
window.addEventListener('pagehide',onHide);window.addEventListener('pageshow',e=>{if(e.persisted)onShow()});
/* ---------- time helpers ---------- */
const TZ=e=>e.t.endsWith('+08:00')?'Asia/Taipei':'Asia/Bangkok';
const fmt=(d,tz,o)=>new Date(d).toLocaleString('zh-TW',Object.assign({timeZone:tz,hour12:false},o||{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}));
const hm=(d,tz)=>fmt(d,tz,{hour:'2-digit',minute:'2-digit'});
function allEv(){return M.days.flatMap((d,di)=>d.events.map((e,ei)=>({...e,di,ei,ts:Date.parse(e.t)}))).sort((a,b)=>a.ts-b.ts)}
function cd(ms){const m=Math.max(0,Math.ceil(ms/6e4)),d=Math.floor(m/1440),h=Math.floor(m%1440/60),mm=m%60;return d?`${d} 天 ${h} 小時`:h?`${h} 小時 ${mm} 分`:`${mm} 分鐘`}
const lab=e=>e.label.replace(/^(約\s*)?\d{1,2}:\d{2}(\s*[–-]\s*\d{1,2}:\d{2})?\s*/,'');
const phones=s=>[...s.matchAll(/\+(?:66|886)[\d ]{7,14}\d/g)].map(m=>m[0]);
function todayIdx(){const now=Date.now();let i=M.days.findIndex(d=>d.events.length&&Date.parse(d.events[d.events.length-1].t)+36e5*3>now);return i<0?M.days.length-1:i}
/* ---------- router (SPA, history API; no reloads) ---------- */
function nav(s,replace){s=Object.assign({},s);replace?history.replaceState(s,''):history.pushState(s,'');render(s)}
window.addEventListener('popstate',e=>{if(KEY)render(e.state||{v:'home'})});
let LASTKEY='';
function render(s){ST=s;const V2={home,days,docs,tel,info,search}[s.v]||home,key=[s.v,s.d,s.o,s.q,s.open].join('|');
 document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===s.v));
 if(s.sheetDoc==null){$('sheet').hidden=true;$('sBody').innerHTML=''}
 if(!s.qr){$('qr').hidden=true;$('qrImg').removeAttribute('src')}
 if(key!==LASTKEY||!$('main').firstChild){LASTKEY=key;V2(s);scrollTo(0,0)}
 if(s.sheetDoc!=null&&($('sheet').hidden||$('sheet').dataset.i!=s.sheetDoc))openSheet(s.sheetDoc);if(s.qr)showQR(s.qr)}
/* ---------- views ---------- */
function evRow(e,now){const p=phones(e.label),past=e.ts+30*6e4<now&&!(e.next),isNext=e.next;
 return `<div class="ev ${isNext?'now':past?'past':''}"><div class="t">${esc(hm(e.ts,TZ(e)))}${TZ(e)==='Asia/Taipei'?'<div class="tz">台北</div>':''}</div><span class="dot"></span><div class="b"><p>${esc(lab(e))}</p>`+
 ((e.nav||p.length)?`<div class="acts">${e.nav?`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(e.nav)}">📍 導航</a>`:''}${p.map(x=>`<a class="btn sm" href="tel:${x.replace(/ /g,'')}">📞 ${esc(x)}</a>`).join('')}</div>`:'')+`</div></div>`}
function home(){const now=Date.now(),E=allEv(),i=E.findIndex(e=>e.ts>now),nx=E[i],cur=i>0?E[i-1]:null;$('ttl').textContent='曼谷喵導遊';
 const start=Date.parse('2026-10-31T05:45:00+08:00');let h='';
 if(nx){const before=now<start;h+=`<div class="card hero"><div class="k">${before?'🧳 出發倒數':'🐾 下一站喵'}・第 ${nx.di+1} 天</div><div class="big">${cd(nx.ts-now)}</div>
  <div class="lab">${esc(lab(nx))}</div><div class="k">${esc(fmt(nx.ts,TZ(nx)))}（${TZ(nx)==='Asia/Taipei'?'台北':'曼谷'}時間）</div>
  <div class="acts">${nx.nav?`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(nx.nav)}">📍 導航</a>`:''}<button class="btn sm" data-go="day" data-d="${nx.di}">看當天行程 ›</button></div></div>`;
  if(cur&&nx.ts-cur.ts<864e5&&now-cur.ts<6*36e5)h+=`<div class="card"><div class="sec" style="margin:0 0 4px">現在大概在</div>${esc(lab(cur))}</div>`}
 else h+=`<div class="card hero"><div class="big">旅程結束 🏡</div><div class="lab">平安回家囉喵，辛苦了！</div></div>`;
 h+=`<div class="sec">快速功能</div><div class="grid2">
  <a class="qa" target="_blank" rel="noopener noreferrer" href="${esc(M.contacts[0].nav)}"><b>🏨</b>回飯店導航</a>
  <a class="qa" href="tel:${M.contacts[0].phone.replace(/ /g,'')}"><b>📞</b>打給飯店</a>
  <button class="qa" data-go="qrcat" data-c="esim"><b>📶</b>eSIM QR Code</button>
  <button class="qa" data-go="qrdoc" data-t="TDAC"><b>🛂</b>入境卡 TDAC QR</button>
  <button class="qa" data-go="docs"><b>🎫</b>票券錢包</button>${V.comp&&V.inv&&ROLE!=='c'?'<button class="qa" data-go="share"><b>👫</b>分享給旅伴</button>':''}</div>`;
 if(nx){const di=nx.di,d=M.days[di],ev=E.filter(e=>e.di===di).slice(0,40);
  h+=`<div class="sec">第 ${di+1} 天・${esc(dayDate(d))}</div><div class="tl">${ev.map(e=>evRow({...e,next:e===nx},now)).join('')}</div>`}
 h+=`<div class="sec">曼谷天氣</div><div class="card wx" id="wx"><button class="btn sm" id="bWx">☀️ 查看 7 天天氣（open-meteo）</button></div>`;
 $('main').innerHTML=h;bind();$('bWx').onclick=wx}
async function wx(){$('wx').textContent='查詢中喵…';try{const r=await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.7352&longitude=100.5603&current=temperature_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=7')).json();
 $('wx').innerHTML=`<div><b>現在 ${r.current.temperature_2m}°C</b>・降雨 ${r.current.precipitation} mm</div>`+r.daily.time.map((t,i)=>`<div class="wxr"><span>${t.slice(5).replace('-','/')}</span><span>${Math.round(r.daily.temperature_2m_min[i])}–${Math.round(r.daily.temperature_2m_max[i])}°C</span><span>☔ ${r.daily.precipitation_probability_max[i]}%</span></div>`).join('')}
 catch(e){$('wx').textContent='天氣抓不到喵（可能離線）'}}
const dayDate=d=>(d.title.match(/\d+\/\d+（.）/)||[''])[0];
const daySub=d=>d.title.split('｜')[1].replace(/^\d+\/\d+（.）/,'');
function days(s){const di=s.d??todayIdx(),d=M.days[di],now=Date.now(),E=allEv(),nx=E.find(e=>e.ts>now);$('ttl').textContent='每日行程';
 let h=`<div class="chips" id="chips">${M.days.map((x,i)=>`<button class="chip ${i===di?'on':''}" data-go="day" data-d="${i}" data-r="1">第${x.n}天<small>${esc(dayDate(x))}</small></button>`).join('')}</div>
 <h2 class="dayh">第 ${d.n} 天・${esc(dayDate(d))}</h2><p class="daysub">${esc(daySub(d))}</p>
 <div class="tl">${E.filter(e=>e.di===di).map(e=>evRow({...e,next:nx&&e.t===nx.t&&e.label===nx.label},now)).join('')||'<div class="empty">這天沒有固定時間喵</div>'}</div>
 <details class="notes" id="notes" ${s.open?'open':''}><summary>📝 完整行程說明與備註</summary><div class="card prose">${d.html}</div></details>
 <div class="acts" style="justify-content:space-between;margin-top:12px">${di>0?`<button class="btn sm" data-go="day" data-d="${di-1}" data-r="1">‹ 第 ${di} 天</button>`:'<span></span>'}${di<M.days.length-1?`<button class="btn sm" data-go="day" data-d="${di+1}" data-r="1">第 ${di+2} 天 ›</button>`:''}</div>`;
 $('main').innerHTML=h;bind();loadImgs($('main'));const c=$('chips').querySelector('.on');c&&c.scrollIntoView({inline:'center',block:'nearest'});
 if(s.q){$('notes').open=true;setTimeout(()=>hl($('notes'),s.q),50)}}
function hl(root,q){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const i=n.data.toLowerCase().indexOf(q.toLowerCase());if(i>=0){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+q.length);const m=document.createElement('mark');r.surroundContents(m);m.scrollIntoView({block:'center'});return}}}
const CATC={flight:'c-flight',stay:'c-stay',tours:'c-tours',esim:'c-esim',ins:'c-ins'};
function docs(){$('ttl').textContent='票券錢包';let h='',cat='';
 M.docs.forEach((d,i)=>{if(d.cattitle!==cat){cat=d.cattitle;h+=`<div class="sec">${esc(cat)}</div>`}
  h+=`<div class="wallet"><div class="stripe ${CATC[d.cat]||''}"></div><div class="wb"><div class="wt">${esc(d.title)}</div><div class="code">${esc(d.code||'')}</div><div class="wm">🗓️ ${esc(d.when||'')}</div>
  <div class="acts">${d.qrs.length?`<button class="btn sm primary" data-go="qr" data-i="${i}">▣ QR 全螢幕${d.qrs.length>1?`（${d.qrs.length}）`:''}</button>`:''}<button class="btn sm" data-go="sheet" data-i="${i}">📄 原始憑證（${d.pages.length} 頁）</button></div></div></div>`});
 $('main').innerHTML=`<p class="daysub">共 ${M.docs.length} 份文件、${M.docs.reduce((a,d)=>a+d.qrs.length,0)} 個 QR Code，離線也能打開喵</p>`+h;bind()}
async function openSheet(i){const d=M.docs[i];$('sheet').dataset.i=i;$('sTitle').textContent=d.title;$('sheet').hidden=false;
 $('sBody').innerHTML=`${d.note?`<p class="daysub">${esc(d.note)}</p>`:''}<div class="wallet"><div class="stripe ${CATC[d.cat]}"></div><div class="wb"><div class="code">${esc(d.code||'')}</div><div class="wm">${esc(d.when||'')}</div>${d.qrs.length?`<div class="acts"><button class="btn sm primary" id="sQR">▣ QR 全螢幕</button></div>`:''}</div></div>`+d.pages.map(p=>`<img class="pg" data-enc="${p}" alt="憑證頁面">`).join('');
 $('sBody').scrollTop=0;const q=$('sQR');if(q)q.onclick=()=>nav({...ST,qr:{i,k:0}});loadImgs($('sBody'))}
async function showQR(q){const d=M.docs[q.i],k=q.k||0;$('qr').hidden=false;$('qrCap').textContent=d.qrlabels&&d.qrlabels[k]?`${d.title}｜${d.qrlabels[k]}（${k+1}/${d.qrs.length}）`:`${d.title}${d.qrs.length>1?`（${k+1}/${d.qrs.length}）`:''}`;
 $('qrNav').innerHTML=d.qrs.length>1?`<button class="btn sm" id="qP" ${k?'':'disabled'}>‹ 上一個</button><button class="btn sm" id="qN" ${k<d.qrs.length-1?'':'disabled'}>下一個 ›</button>`:'';
 if($('qP')){$('qP').onclick=()=>nav({...ST,qr:{i:q.i,k:k-1}},true);$('qN').onclick=()=>nav({...ST,qr:{i:q.i,k:k+1}},true)}
 $('qrImg').src=await blobUrl(d.qrs[k].img)}
function tel(){$('ttl').textContent='聯絡與電話';$('main').innerHTML=`<p class="daysub">點一下直接撥號喵（泰國號碼要開漫遊或用 eSIM）</p>`+M.contacts.map(c=>{const [ic,...nm]=c.name.split(' ');
 return `<div class="card ct"><div class="ci">${ic}</div><div class="cb"><div class="cn">${esc(nm.join(' '))}</div>${c.note?`<div class="cs">${esc(c.note)}</div>`:''}<div class="acts">${c.phone?`<a class="btn sm primary" href="tel:${c.phone.replace(/ /g,'')}">📞 ${esc(c.phone)}</a>`:''}${c.nav?`<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(c.nav)}">📍 導航</a>`:''}</div></div></div>`}).join('')}
function info(s){$('ttl').textContent='旅遊資訊';$('main').innerHTML=`<div class="card prose">${M.intro}</div>`+M.others.map((o,i)=>`<details class="notes" ${s.o===i?'open':''}><summary>${esc(o.title)}</summary><div class="card prose">${o.html}</div></details>`).join('');
 document.querySelectorAll('#main details').forEach(dt=>dt.addEventListener('toggle',()=>{if(dt.open)loadImgs(dt)}));
 if(s.q!=null&&s.o!=null){const dt=$('main').querySelectorAll('details')[s.o];loadImgs(dt);setTimeout(()=>hl(dt,s.q),50)}}
function index(){if(IDX)return IDX;IDX=[];const P=new DOMParser();
 const add=(html,meta)=>P.parseFromString(html,'text/html').body.querySelectorAll('li,p,td,h3,h4').forEach(n=>{if(n.querySelector('li'))return;const t=n.textContent.trim();if(t)IDX.push({t,...meta})});
 M.days.forEach((d,i)=>add(d.html,{k:'day',d:i,w:`第 ${d.n} 天`}));M.others.forEach((o,i)=>add(o.html,{k:'info',o:i,w:o.title}));
 M.docs.forEach((d,i)=>IDX.push({t:`${d.title} ${d.code||''} ${d.when||''}`,k:'doc',i,w:'票券'}));M.contacts.forEach(c=>IDX.push({t:`${c.name} ${c.phone||''} ${c.note||''}`,k:'tel',w:'聯絡'}));return IDX}
function search(s){$('ttl').textContent='搜尋';$('main').innerHTML=`<input id="q" class="srch" type="search" placeholder="搜尋地點、餐廳、訂位代號…" value="${esc(s.q||'')}" enterkeyhint="search"><div id="hits"></div>`;
 const run=()=>{const q=$('q').value.trim();ST={...ST,q};history.replaceState(ST,'');LASTKEY=[ST.v,ST.d,ST.o,ST.q,ST.open].join('|');if(!q){$('hits').innerHTML='<div class="empty">輸入關鍵字喵，例如「火鍋」「QR」「訂位代號」</div>';return}
  const ql=q.toLowerCase(),r=index().filter(x=>x.t.toLowerCase().includes(ql)).slice(0,60);
  $('hits').innerHTML=r.length?r.map((x,j)=>{const i=x.t.toLowerCase().indexOf(ql),a=Math.max(0,i-24);return `<button class="hit" data-h="${j}"><small>${esc(x.w)}</small><br>${a?'…':''}${esc(x.t.slice(a,i))}<mark>${esc(x.t.slice(i,i+q.length))}</mark>${esc(x.t.slice(i+q.length,i+q.length+60))}…</button>`}).join(''):'<div class="empty">找不到喵 😿</div>';
  $('hits').querySelectorAll('.hit').forEach(b=>b.onclick=()=>{const x=r[+b.dataset.h];
   if(x.k==='day')nav({v:'days',d:x.d,q,open:1});else if(x.k==='info')nav({v:'info',o:x.o,q});else if(x.k==='doc')nav({v:'docs',sheetDoc:x.i});else nav({v:'tel'})})};
 $('q').oninput=run;run();if(!s.q)setTimeout(()=>$('q').focus(),50)}
function bind(){$('main').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const g=b.dataset.go,i=+b.dataset.i;
 if(g==='day')nav({v:'days',d:+b.dataset.d},!!b.dataset.r&&ST.v==='days');else if(g==='docs')nav({v:'docs'});
 else if(g==='sheet')nav({...ST,keepScroll:1,sheetDoc:i});else if(g==='qr')nav({...ST,keepScroll:1,qr:{i,k:0}});
 else if(g==='share')shareOpen();
 else if(g==='qrdoc'){const j=M.docs.findIndex(d=>d.title.includes(b.dataset.t)&&d.qrs.length);if(j>=0)nav({...ST,keepScroll:1,qr:{i:j,k:0}})}
 else if(g==='qrcat'){const j=M.docs.findIndex(d=>d.cat===b.dataset.c&&d.qrs.length);nav({...ST,keepScroll:1,qr:{i:j,k:0}})}})}
async function loadImgs(root){for(const im of root.querySelectorAll('img[data-enc]')){const n=im.dataset.enc;im.removeAttribute('data-enc');try{im.src=await blobUrl(n)}catch(e){}}}
/* ---------- chrome ---------- */
document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>{if(ST.v===b.dataset.t&&!ST.sheetDoc&&!ST.qr){scrollTo({top:0,behavior:'smooth'});return}nav({v:b.dataset.t})});
$('shareClose').onclick=shareHide;$('bShareAuth').onclick=shareAuth;$('bCopy').onclick=async()=>{try{await navigator.clipboard.writeText(CODE.match(/.{5}/g).join('-'));$('lmsg').textContent='已複製邀請碼！加到主畫面後貼上喵'}catch(e){$('lmsg').textContent='無法複製，請手動記下：'+CODE.match(/.{5}/g).join('-')}};
$('sClose').onclick=()=>history.back();$('qClose').onclick=()=>history.back();
$('bSearch').onclick=()=>nav({v:'search'});$('bLock').onclick=lock;
$('bFace').onclick=face;$('bEnroll').onclick=enroll;$('bSkip').onclick=unlocked;$('bPass').onclick=pass;$('pp').onkeydown=e=>{if(e.key==='Enter')pass()};
function tick(){if(!KEY)return;$('clock').textContent='曼谷 '+hm(Date.now(),'Asia/Bangkok');if(ST.v==='home'&&!ST.qr&&!ST.sheetDoc&&!document.hidden&&!($('wx')&&$('wx').textContent.includes('°'))){const y=scrollY;home();scrollTo(0,y)}}
setInterval(tick,30e3);
const setHH=()=>document.documentElement.style.setProperty('--hh',$('top').offsetHeight+'px');addEventListener('resize',setHH);new ResizeObserver(setHH).observe($('top'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
initLock();
