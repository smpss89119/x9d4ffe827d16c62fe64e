'use strict';
const $=id=>document.getElementById(id), te=new TextEncoder(), LS='bkk_cred_v1';
const ub=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)), bu=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
let V=null,KEY=null,RAW=null,M=null,blobs=[],hiddenAt=0,tab='home',dayIdx=null;
async function aesKey(raw,use){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,use)}
async function pbk(pw,w){const base=await crypto.subtle.importKey('raw',te.encode(pw),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:ub(w.salt),iterations:w.it},base,256))}
async function unwrapPw(pw,w){const k=await aesKey(await pbk(pw,w),['decrypt']);
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(w.iv)},k,ub(w.ct)))}
async function prfKey(out){const b=await crypto.subtle.importKey('raw',out,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:te.encode('bkk-trip-v1'),info:te.encode('kek')},b,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function dec(name){const r=await fetch('d/'+name);if(!r.ok)throw Error('fetch '+name);const b=new Uint8Array(await r.arrayBuffer());
 return crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},KEY,b.slice(12))}
function err(m){$('lerr').textContent=m}
async function open(raw){KEY=await aesKey(raw,['decrypt']);M=JSON.parse(new TextDecoder().decode(await dec(V.m)));}
async function start(){
 V=await (await fetch('vault.json',{cache:'no-cache'})).json().catch(()=>null)||V;
 const cred=localStorage.getItem(LS), h=new URLSearchParams(location.hash.slice(1)), s=h.get('s');
 if(s){history.replaceState(null,'',location.pathname);try{RAW=await unwrapPw(s,V.setup);$('lmsg').textContent='設定連結正確喵！';$('setupBox').hidden=false}catch(e){err('設定連結不對喵')}}
 if(cred){$('bFace').hidden=false;$('lmsg').textContent='用 Face ID 解鎖喵～'}
 else if(!s)$('lmsg').textContent='請用設定連結開啟，或輸入復原密語喵';
}
async function enroll(){try{
 if(!window.PublicKeyCredential)throw Error('這個瀏覽器不支援通行金鑰');
 const salt=ub(V.prfSalt);
 const c=await navigator.credentials.create({publicKey:{rp:{name:'曼谷喵導遊'},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:'bkk-trip',displayName:'曼谷旅遊'},
  challenge:crypto.getRandomValues(new Uint8Array(32)),pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
  authenticatorSelection:{residentKey:'required',userVerification:'required'},extensions:{prf:{eval:{first:salt}}}}});
 const ext=c.getClientExtensionResults();
 if(ext.prf&&ext.prf.enabled===false)throw Error('裝置不支援 PRF（需要 iOS 18 以上）');
 let out=ext.prf&&ext.prf.results&&ext.prf.results.first;
 if(!out)out=await prfGet(c.rawId);
 const kek=await prfKey(out), iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},kek,RAW);
 localStorage.setItem(LS,JSON.stringify({id:bu(c.rawId),iv:bu(iv),ct:bu(ct)}));
 await open(RAW);RAW=null;show();
}catch(e){err('設定失敗喵：'+e.message)}}
async function prfGet(rawId){const a=await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),
 allowCredentials:[{type:'public-key',id:rawId}],userVerification:'required',extensions:{prf:{eval:{first:ub(V.prfSalt)}}}}});
 const r=a.getClientExtensionResults().prf;if(!r||!r.results)throw Error('沒有拿到 PRF 結果（需要 iOS 18 以上）');return r.results.first}
async function face(){try{const c=JSON.parse(localStorage.getItem(LS));const out=await prfGet(ub(c.id));
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:ub(c.iv)},await prfKey(out),ub(c.ct));await open(raw);show()}catch(e){err('解鎖失敗喵：'+e.message)}}
async function pass(){try{err('解密中，請稍等喵…');const raw=await unwrapPw($('pp').value.trim(),V.pass);$('pp').value='';err('');
 if(!localStorage.getItem(LS)){RAW=raw;$('setupBox').hidden=false;$('lmsg').textContent='密語正確！可以順便設定 Face ID 喵'}
 await open(raw);if(!RAW)show();else{$('bSkip')||addSkip()}}catch(e){err('密語不對喵')}}
function addSkip(){const b=document.createElement('button');b.id='bSkip';b.textContent='先不要，直接看';b.onclick=()=>{RAW=null;show()};$('setupBox').append(b)}
function lock(){KEY=null;M=null;RAW=null;blobs.forEach(u=>URL.revokeObjectURL(u));blobs=[];$('main').innerHTML='';$('vbody').innerHTML='';$('viewer').hidden=true;
 $('app').hidden=true;$('lock').hidden=false;$('setupBox').hidden=true;err('');start()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(KEY&&hiddenAt&&Date.now()-hiddenAt>5*60e3)lock()});
setInterval(()=>{if(KEY&&document.hidden&&Date.now()-hiddenAt>5*60e3)lock()},15e3);
async function imgs(root){for(const im of root.querySelectorAll('img[data-enc]')){const n=im.dataset.enc;im.removeAttribute('data-enc');
 const u=URL.createObjectURL(new Blob([await dec(n)]));blobs.push(u);im.src=u}}
const fmt=(d,tz)=>d.toLocaleString('zh-TW',{timeZone:tz,month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
function events(){return M.days.flatMap(d=>d.events.map(e=>({...e,day:d.n,ts:Date.parse(e.t)}))).sort((a,b)=>a.ts-b.ts)}
function cd(ms){const m=Math.floor(ms/6e4),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return (d?d+' 天 ':'')+(h?h+' 小時 ':'')+(m%60)+' 分'}
function home(){const now=Date.now(),E=events(),i=E.findIndex(e=>e.ts>now),nx=E[i],cur=E[i-1];
 const tz=now<Date.parse('2026-10-31T13:50:00+08:00')||now>Date.parse('2026-11-07T19:15:00+08:00')?'Asia/Taipei':'Asia/Bangkok';
 let h=`<div class="card"><div>🐾 現在 ${tz==='Asia/Taipei'?'台北':'曼谷'}時間 <b>${fmt(new Date(),tz)}</b></div><div style="font-size:13px">曼谷 ${fmt(new Date(),'Asia/Bangkok')}｜台北 ${fmt(new Date(),'Asia/Taipei')}</div></div>`;
 if(nx){h+=`<div class="card"><div>下一站喵 👉（第 ${nx.day} 天）</div><div class="big">${cd(nx.ts-now)} 後</div><div>${esc(nx.label)}</div>
 <div style="font-size:13px">${fmt(new Date(nx.ts),nx.t.endsWith('+08:00')?'Asia/Taipei':'Asia/Bangkok')}（${nx.t.endsWith('+08:00')?'台北':'曼谷'}時間）</div>${nx.nav?`<a target="_blank" rel="noopener noreferrer" href="${nx.nav}">📍導航過去</a>`:''}</div>`;
 if(cur&&nx.ts-cur.ts<864e5)h+=`<div class="card" style="opacity:.7">剛剛／進行中：${esc(cur.label)}</div>`;
 const up=E.slice(i+1,i+4);if(up.length)h+=`<div class="card"><b>接下來</b>${up.map(e=>`<div class="ev"><b>${e.t.slice(11,16)}</b><span>${esc(e.label)}</span></div>`).join('')}</div>`}
 else h+='<div class="card big">旅程結束，回家囉喵 🏡</div>';
 h+=`<div class="card"><b>☀️ 曼谷天氣</b><div id="wx"><button id="bWx" class="small">查詢天氣（open-meteo）</button></div></div>`;
 $('main').innerHTML=h;$('bWx').onclick=wx}
async function wx(){try{const r=await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.7352&longitude=100.5603&current=temperature_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=7')).json();
 $('wx').innerHTML=`現在 ${r.current.temperature_2m}°C，降雨 ${r.current.precipitation} mm<br>`+r.daily.time.map((t,i)=>`${t.slice(5)}：${r.daily.temperature_2m_min[i]}–${r.daily.temperature_2m_max[i]}°C，降雨機率 ${r.daily.precipitation_probability_max[i]}%`).join('<br>')}
 catch(e){$('wx').textContent='天氣抓不到喵（離線？）'}}
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function days(){if(dayIdx===null){const now=Date.now();dayIdx=Math.max(0,M.days.findIndex(d=>d.events.length&&Date.parse(d.events[d.events.length-1].t)>now));}
 const d=M.days[dayIdx];$('main').innerHTML=`<div class="chips">${M.days.map((x,i)=>`<button data-d="${i}" class="${i===dayIdx?'':'off'}">第${x.n}天 ${x.title.match(/\d+\/\d+/)[0]}</button>`).join('')}</div><h2>${esc(d.title)}</h2><div>${d.html}</div>`;
 $('main').querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{dayIdx=+b.dataset.d;days();scrollTo(0,0)});imgs($('main'))}
function docs(){let h='<h2>🎫 票券與預約</h2><p style="font-size:13px">點一下打開原始憑證，QR Code 可以直接給店家掃喵</p>',cat='';
 M.docs.forEach((d,i)=>{if(d.cattitle!==cat){cat=d.cattitle;h+=`<h3>${esc(cat)}</h3>`}
 h+=`<div class="card doc"><div><b>${esc(d.title)}</b><br><span style="font-size:13px">${esc(d.when||'')}｜代號 ${esc(d.code||'')}</span></div><button class="small" data-i="${i}">打開 ${d.pages.length} 頁</button></div>`});
 $('main').innerHTML=h;$('main').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>viewDoc(M.docs[+b.dataset.i]))}
function viewDoc(d){$('vbody').innerHTML=`<h3>${esc(d.title)}</h3>${d.note?`<p>${esc(d.note)}</p>`:''}`+d.pages.map(p=>`<img data-enc="${p}" alt="">`).join('');$('viewer').hidden=false;imgs($('vbody'))}
function tel(){$('main').innerHTML='<h2>📞 一鍵撥號</h2>'+M.contacts.map(c=>`<div class="card"><b>${esc(c.name)}</b><br>${c.phone?`<a class="tel" href="tel:${c.phone.replace(/ /g,'')}">📞 ${c.phone}</a><br>`:''}<span style="font-size:13px">${esc(c.note||'')}</span>${c.nav?`<br><a target="_blank" rel="noopener noreferrer" href="${c.nav}">📍導航</a>`:''}</div>`).join('')}
function info(){$('main').innerHTML=`<div class="card">${M.intro}</div>`+M.others.map((o,i)=>`<details class="card"><summary><b>${esc(o.title)}</b></summary>${o.html}</details>`).join('');imgs($('main'))}
const T={home,days,docs,tel,info};
function go(t){tab=t;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));T[t]();scrollTo(0,0)}
function show(){$('lock').hidden=true;$('app').hidden=false;go('home')}
setInterval(()=>{if(KEY){$('clock').textContent='🐱 曼谷 '+fmt(new Date(),'Asia/Bangkok');if(tab==='home'&&!document.hidden&&!$('wx').textContent.includes('°'))home()}},30e3);
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>go(b.dataset.t));
$('bFace').onclick=face;$('bEnroll').onclick=enroll;$('bPass').onclick=pass;$('pp').onkeydown=e=>{if(e.key==='Enter')pass()};
$('bLock').onclick=lock;$('vclose').onclick=()=>{$('viewer').hidden=true;$('vbody').innerHTML=''};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
start();
