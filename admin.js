import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, limit, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
const ADMIN_UID = "1xoVNw3HMcdmO0n7dB0iDMDYj9r1";

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? `₹${n.toLocaleString('en-IN')}` : 'Contact Admin'; };
const dateObj = v => { if (!v) return null; if (v.toDate) return v.toDate(); const d = new Date(v); return Number.isFinite(d.getTime()) ? d : null; };
const dateText = v => { const d = dateObj(v); if (!d || d.getFullYear() < 2000) return '—'; return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); };
const dateTimeText = v => { const d = dateObj(v); if (!d || d.getFullYear() < 2000) return '—'; return d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
const toDateInput = v => { const d = dateObj(v); if (!d) return ''; const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const statusBadge = s => { const x=String(s||'UNKNOWN').toUpperCase(); const cls=x==='ACTIVE'||x==='AVAILABLE'?'active':x==='EXPIRED'||x==='REVOKED'?'expired':'pending'; return `<span class="badge ${cls}">${esc(x)}</span>`; };
const toast = (message, type='success') => { let el=$('toast'); if(!el){el=document.createElement('div');el.id='toast';document.body.appendChild(el);} el.textContent=message; el.className=`toast ${type}`; clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.className='toast',3200); };

function show(id){ document.querySelectorAll('.section').forEach(x=>x.classList.add('hidden')); $(id)?.classList.remove('hidden'); document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.section===id)); }
async function isAdmin(user){ if(!user || user.uid!==ADMIN_UID) return false; const s=await getDoc(doc(db,'admins',user.uid)); return s.exists() && s.data().active===true && s.data().role==='admin'; }
async function getUsers(){ const s=await getDocs(query(collection(db,'users'),limit(1000))); return s.docs.map(x=>({id:x.id,...x.data()})); }
async function getPlans(){ const s=await getDocs(query(collection(db,'plans'),limit(500))); return s.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>Number(a.displayOrder||0)-Number(b.displayOrder||0)); }
async function getMemberships(){ const s=await getDocs(query(collection(db,'memberships'),limit(1000))); return s.docs.map(x=>({id:x.id,...x.data()})); }
async function getKeys(){ const s=await getDocs(query(collection(db,'activationKeys'),limit(1000))); return s.docs.map(x=>({id:x.id,...x.data()})); }
function computedMembershipStatus(m){
  const s=String(m?.status||'').toUpperCase();
  if(s==='SUSPENDED'||s==='REVOKED') return s;
  const days=Number(m?.durationDays ?? -1);
  if(days===0 || !m?.expiryDate) return s==='ACTIVE'?'ACTIVE':s||'INACTIVE';
  const d=dateObj(m.expiryDate); if(!d) return 'INACTIVE';
  return d.getTime() < Date.now() ? 'EXPIRED' : (s==='ACTIVE'?'ACTIVE':s||'INACTIVE');
}
function randomCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=new Uint8Array(12); crypto.getRandomValues(bytes);
  let raw=''; for(let i=0;i<bytes.length;i++) raw += alphabet[bytes[i]%alphabet.length];
  return `MEESHO-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`;
}
function waHref(phone, text){ const digits=String(phone||'').replace(/\D/g,''); const intl=digits.length===10?`91${digits}`:digits; return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`; }

async function loadDashboard(){
  const [users, members, plans, keys] = await Promise.all([getUsers(),getMemberships(),getPlans(),getKeys()]);
  let active=0,expired=0,lifetime=0,available=0,redeemed=0;
  members.forEach(m=>{const st=computedMembershipStatus(m); if(st==='ACTIVE')active++; if(st==='EXPIRED')expired++; if(Number(m.durationDays||-1)===0)lifetime++;});
  keys.forEach(k=>{if(k.status==='AVAILABLE')available++; if(k.status==='REDEEMED')redeemed++;});
  $('dashboard').innerHTML=`
    <div class="page-head"><div><h2>Dashboard</h2><p class="muted">Complete Gmail-bound activation and unified Autofill + Shipping membership.</p></div><button id="dashboardRefresh" class="ghost">Refresh</button></div>
    <div class="grid">
      <div class="stat"><span>Customers</span><b>${users.length}</b></div>
      <div class="stat"><span>Active Members</span><b>${active}</b></div>
      <div class="stat"><span>Expired</span><b>${expired}</b></div>
      <div class="stat"><span>Lifetime</span><b>${lifetime}</b></div>
      <div class="stat"><span>Active Plans</span><b>${plans.filter(p=>p.active!==false).length}</b></div>
      <div class="stat"><span>Available Keys</span><b>${available}</b></div>
      <div class="stat"><span>Redeemed Keys</span><b>${redeemed}</b></div>
    </div>
    <div class="panel"><div class="notice"><b>WhatsApp payment mode:</b> payment is handled outside the extension. Admin verifies payment, generates a one-time activation code for the customer's Gmail, and sends it on WhatsApp.</div></div>`;
  $('dashboardRefresh').onclick=loadDashboard;
}

async function loadUsers(){
  const [users,members]=await Promise.all([getUsers(),getMemberships()]);
  const map=new Map(members.map(m=>[m.id,m]));
  $('users').innerHTML=`
    <div class="page-head"><div><h2>Users</h2><p class="muted">Search any customer Gmail and open activation controls.</p></div><button id="usersRefresh" class="ghost">Refresh</button></div>
    <div class="panel"><input id="userSearch" class="search" placeholder="Search Gmail, name or UID…"></div>
    <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Email</th><th>Plan</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead><tbody id="usersRows"></tbody></table></div></div>`;
  const render=()=>{ const q=String($('userSearch').value||'').trim().toLowerCase(); const rows=users.filter(u=>!q || `${u.name||''} ${u.displayName||''} ${u.email||''} ${u.id}`.toLowerCase().includes(q)).map(u=>{const m=map.get(u.id); const st=m?computedMembershipStatus(m):'INACTIVE'; return `<tr><td><strong>${esc(u.name||u.displayName||'—')}</strong><div class="muted tiny">${esc(u.id)}</div></td><td>${esc(u.email||'—')}</td><td>${esc(m?.planName||m?.planId||'—')}</td><td>${statusBadge(st)}</td><td>${esc(dateTimeText(u.lastLoginAt))}</td><td class="row-actions"><button class="primary tiny-btn activate-from-user" data-email="${esc(u.email||'')}" data-uid="${esc(u.id)}">Generate Key</button><button class="ghost tiny-btn suspend-user" data-uid="${esc(u.id)}">${st==='SUSPENDED'?'Unsuspend':'Suspend'}</button></td></tr>`}).join(''); $('usersRows').innerHTML=rows||'<tr><td colspan="6">No matching users.</td></tr>'; wireUserActions(); };
  $('userSearch').oninput=render; $('usersRefresh').onclick=loadUsers; render();
}
function wireUserActions(){
  document.querySelectorAll('.activate-from-user').forEach(b=>b.onclick=()=>{show('activationKeys'); loadActivationKeys(b.dataset.email,b.dataset.uid);});
  document.querySelectorAll('.suspend-user').forEach(b=>b.onclick=async()=>{const uid=b.dataset.uid; const ms=await getDoc(doc(db,'memberships',uid)); const target=ms.exists()?String(ms.data().status||'ACTIVE').toUpperCase()!=='SUSPENDED':'none'; try{await updateDoc(doc(db,'users',uid),{status:target?'SUSPENDED':'ACTIVE',updatedAt:serverTimestamp()}); if(ms.exists()) await updateDoc(doc(db,'memberships',uid),{status:target?'SUSPENDED':'ACTIVE',updatedAt:serverTimestamp()}); toast(target?'User suspended.':'User reactivated.'); await Promise.all([loadUsers(),loadMemberships(),loadDashboard()]);}catch(e){toast(e.message,'error');}});
}

function planForm(existing={}){
  return `<div class="panel form-panel"><div class="panel-title"><div><h3>${existing.id?'Edit Plan':'Create Plan'}</h3><p class="muted">Plans control price, duration, Shipping Optimizer access and device policy.</p></div><button id="cancelPlan" class="ghost">Cancel</button></div>
  <form id="planForm" class="form-grid">
    <label>Plan ID<input id="planId" required value="${esc(existing.id||'')}" ${existing.id?'readonly':''} placeholder="monthly"></label>
    <label>Plan Name<input id="planName" required value="${esc(existing.name||'')}" placeholder="Monthly"></label>
    <label>Description<input id="planDescription" value="${esc(existing.description||'')}" placeholder="Full access for 30 days"></label>
    <label>Regular Price (₹)<input id="regularPrice" type="number" min="0" step="0.01" value="${esc(existing.regularPrice??existing.price??0)}"></label>
    <label>Offer Price (₹)<input id="offerPrice" type="number" min="0" step="0.01" value="${esc(existing.offerPrice??0)}"></label>
    <label>Discount %<input id="discountPercent" type="number" min="0" max="100" step="0.01" value="${esc(existing.discountPercent??0)}"></label>
    <label>Duration (Days)<input id="durationDays" type="number" min="0" step="1" value="${esc(existing.durationDays??30)}"><small>0 = Lifetime / Unlimited</small></label>
    <label>Display Order<input id="displayOrder" type="number" min="0" step="1" value="${esc(existing.displayOrder??0)}"></label>
    <label>Device Limit<input id="deviceLimit" type="number" min="1" step="1" value="${esc(existing.deviceLimit??1)}"><small>Current extension supports one bound device; admin can reset it.</small></label>
    <label class="check-row"><input id="shippingEnabled" type="checkbox" ${existing.shippingEnabled!==false?'checked':''}> Shipping Optimizer Included</label>
    <label class="check-row"><input id="planActive" type="checkbox" ${existing.active!==false?'checked':''}> Active</label>
    <label class="check-row"><input id="visibleToCustomers" type="checkbox" ${existing.visibleToCustomers!==false?'checked':''}> Visible to Customers</label>
    <label>Offer Start<input id="offerStart" type="datetime-local" value="${esc(toDateInput(existing.offerStartAt))}"></label>
    <label>Offer End<input id="offerEnd" type="datetime-local" value="${esc(toDateInput(existing.offerEndAt))}"></label>
    <div class="form-actions"><button class="primary" type="submit">Save Plan</button><button id="cancelPlan2" class="ghost" type="button">Cancel</button></div>
  </form></div>`;
}
async function loadPlans(){
  const plans=await getPlans();
  $('plans').innerHTML=`<div class="page-head"><div><h2>Plans</h2><p class="muted">Create Monthly, Yearly, Lifetime or any custom duration. Shipping is attached to the same membership.</p></div><div class="head-actions"><button id="addPlan" class="primary">+ Add Plan</button><button id="plansRefresh" class="ghost">Refresh</button></div></div><div id="planEditor"></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Regular</th><th>Offer</th><th>Days</th><th>Shipping</th><th>Status</th><th>Actions</th></tr></thead><tbody>${plans.map(p=>`<tr><td><code>${esc(p.id)}</code></td><td><strong>${esc(p.name||p.id)}</strong><div class="muted tiny">${esc(p.description||'')}</div></td><td>${money(p.regularPrice??p.price)}</td><td>${money(p.offerPrice)}</td><td>${Number(p.durationDays||0)===0?'Unlimited':esc(p.durationDays)}</td><td>${p.shippingEnabled!==false?'Included':'Not included'}</td><td>${statusBadge(p.active===false?'DISABLED':'ACTIVE')}</td><td class="row-actions"><button class="ghost tiny-btn edit-plan" data-id="${esc(p.id)}">Edit</button><button class="ghost tiny-btn toggle-plan" data-id="${esc(p.id)}" data-active="${p.active!==false}">${p.active===false?'Enable':'Disable'}</button><button class="danger-outline tiny-btn delete-plan" data-id="${esc(p.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="8">No plans yet.</td></tr>'}</tbody></table></div></div>`;
  const open=(p={})=>{ $('planEditor').innerHTML=planForm(p); $('cancelPlan').onclick=()=>{$('planEditor').innerHTML='';}; $('cancelPlan2').onclick=()=>{$('planEditor').innerHTML='';}; $('planForm').onsubmit=async e=>{e.preventDefault(); const id=$('planId').value.trim().toLowerCase(); const days=Math.max(0,Number($('durationDays').value||0)); const data={name:$('planName').value.trim(),description:$('planDescription').value.trim(),regularPrice:Math.max(0,Number($('regularPrice').value||0)),offerPrice:Math.max(0,Number($('offerPrice').value||0)),discountPercent:Math.max(0,Number($('discountPercent').value||0)),durationDays:days,displayOrder:Math.max(0,Number($('displayOrder').value||0)),deviceLimit:Math.max(1,Number($('deviceLimit').value||1)),shippingEnabled:$('shippingEnabled').checked,active:$('planActive').checked,visibleToCustomers:$('visibleToCustomers').checked,updatedAt:serverTimestamp()}; const os=$('offerStart').value, oe=$('offerEnd').value; data.offerStartAt=os?Timestamp.fromDate(new Date(os)):null; data.offerEndAt=oe?Timestamp.fromDate(new Date(oe)):null; try{await setDoc(doc(db,'plans',id),data,{merge:true}); toast('Plan saved.'); $('planEditor').innerHTML=''; await Promise.all([loadPlans(),loadDashboard()]);}catch(err){toast(err.message,'error');}}; };
  $('addPlan').onclick=()=>open({durationDays:30,deviceLimit:1,shippingEnabled:true,active:true,visibleToCustomers:true}); $('plansRefresh').onclick=loadPlans;
  document.querySelectorAll('.edit-plan').forEach(b=>b.onclick=async()=>{const s=await getDoc(doc(db,'plans',b.dataset.id)); if(s.exists()) open({id:s.id,...s.data()});});
  document.querySelectorAll('.toggle-plan').forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,'plans',b.dataset.id),{active:b.dataset.active!=='true'?true:false,updatedAt:serverTimestamp()}); toast('Plan status updated.'); await Promise.all([loadPlans(),loadDashboard()]);});
  document.querySelectorAll('.delete-plan').forEach(b=>b.onclick=async()=>{if(!confirm(`Delete plan ${b.dataset.id}?`))return; await deleteDoc(doc(db,'plans',b.dataset.id)); toast('Plan deleted.'); await Promise.all([loadPlans(),loadDashboard()]);});
}

async function loadActivationKeys(presetEmail='', presetUid=''){
  const [users,plans,keys,members,settingsSnap]=await Promise.all([getUsers(),getPlans(),getKeys(),getMemberships(),getDoc(doc(db,'settings','general'))]);
  const settings=settingsSnap.exists()?settingsSnap.data():{}; const waNumber=String(settings.whatsapp||'919064827025').replace(/\D/g,'');
  const activePlans=plans.filter(p=>p.active!==false);
  const chosenUser=users.find(u=>u.email===presetEmail || u.id===presetUid);
  $('activationKeys').innerHTML=`<div class="page-head"><div><h2>Activation Keys</h2><p class="muted">Generate a one-time Gmail-bound code after WhatsApp payment.</p></div><button id="keysRefresh" class="ghost">Refresh</button></div>
  <div class="panel form-panel"><div class="panel-title"><div><h3>Generate Activation</h3><p class="muted">Search an existing customer Gmail or type a new Gmail manually.</p></div></div>
    <form id="keyForm" class="form-grid">
      <label class="span-2">Search Customer Gmail / Name / UID<input id="customerSearch" class="search" value="${esc(presetEmail||'')}" placeholder="Type to search…"><div id="customerSuggestions" class="suggestions"></div></label>
      <label>Customer Gmail<input id="targetEmail" type="email" required value="${esc(chosenUser?.email||presetEmail||'')}" placeholder="customer@gmail.com"></label>
      <label>Linked UID (optional)<input id="targetUid" value="${esc(chosenUser?.id||presetUid||'')}" placeholder="Filled automatically for existing users"></label>
      <label>Plan<select id="keyPlan">${activePlans.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)} · ${Number(p.durationDays||0)===0?'Lifetime / Unlimited':`${p.durationDays} days`} · ${money(p.offerPrice>0?p.offerPrice:p.regularPrice??p.price)}</option>`).join('')}</select></label>
      <label>Key Valid For (Days)<input id="keyValidDays" type="number" min="1" max="365" value="7"><small>Recommended: generate after payment.</small></label>
      <label class="check-row"><input id="renewExisting" type="checkbox" ${chosenUser ? ((()=>{const mm=members.find(m=>m.id===chosenUser.id); return mm && String(computedMembershipStatus(mm))==='ACTIVE' && Number(mm.durationDays||0)!==0 ? 'checked' : '';})()) : ''}> Renew existing membership from its current expiry when applicable</label>
      <label class="check-row"><input id="keyShipping" type="checkbox" checked> Shipping Optimizer Included (snapshot from selected plan)</label>
      <div class="form-actions"><button class="primary" type="submit">Generate Activation Key</button></div>
    </form>
    <div id="generatedKeyBox" class="generated-key hidden"></div>
  </div>
  <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Customer</th><th>Plan</th><th>Status</th><th>Key Expiry</th><th>Membership</th><th>Actions</th></tr></thead><tbody>${keys.sort((a,b)=>dateObj(b.createdAt)?.getTime()-dateObj(a.createdAt)?.getTime()).map(k=>{const phone=waNumber; const msg=`Hi,\n\nYour MEESHO A+ LISTING AUTOMATION PRO activation code is:\n${k.id}\n\nGoogle account: ${k.targetEmail}\nPlan: ${k.planName}\nShipping Optimizer: ${k.shippingEnabled!==false?'Included':'Not Included'}\n\nEnter this code in the extension after signing in with the same Google account.\n\nSohel Enterprise`; return `<tr><td><code>${esc(k.id)}</code></td><td><strong>${esc(k.targetEmail||'—')}</strong><div class="muted tiny">${esc(k.targetUid||'Gmail-bound')}</div></td><td>${esc(k.planName||k.planId||'—')}</td><td>${statusBadge(k.status)}</td><td>${esc(dateText(k.keyExpiresAt))}</td><td>${Number(k.durationDays||0)===0?'Lifetime / Unlimited':`${esc(dateText(k.membershipStartAt))} → ${esc(dateText(k.membershipExpiryAt))}`}</td><td class="row-actions"><button class="ghost tiny-btn copy-key" data-code="${esc(k.id)}">Copy</button><a class="ghost tiny-btn" target="_blank" href="${waHref(phone,msg)}">WhatsApp</a>${k.status==='AVAILABLE'?`<button class="danger-outline tiny-btn revoke-key" data-code="${esc(k.id)}">Revoke</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="7">No activation keys yet.</td></tr>'}</tbody></table></div></div>`;
  const search=$('customerSearch'), sug=$('customerSuggestions');
  const renderSuggestions=()=>{const q=String(search.value||'').toLowerCase().trim(); const m=users.filter(u=>q && `${u.email||''} ${u.name||''} ${u.id}`.toLowerCase().includes(q)).slice(0,8); sug.innerHTML=m.map(u=>`<button type="button" class="suggestion" data-email="${esc(u.email||'')}" data-uid="${esc(u.id)}"><strong>${esc(u.email||'—')}</strong><span>${esc(u.name||'')} · ${esc(u.id.slice(0,10))}</span></button>`).join(''); sug.querySelectorAll('.suggestion').forEach(b=>b.onclick=()=>{$('targetEmail').value=b.dataset.email;$('targetUid').value=b.dataset.uid;search.value=b.dataset.email;sug.innerHTML='';});};
  search.oninput=renderSuggestions;
  $('keyPlan').onchange=()=>{const p=activePlans.find(x=>x.id===$('keyPlan').value); if(p) $('keyShipping').checked=p.shippingEnabled!==false;};
  $('keyForm').onsubmit=async e=>{e.preventDefault(); const email=$('targetEmail').value.trim().toLowerCase(); const uid=$('targetUid').value.trim(); const plan=activePlans.find(x=>x.id===$('keyPlan').value); if(!plan){toast('Create/enable a plan first.','error');return;} if(!email||!email.includes('@')){toast('Enter a valid customer Gmail.','error');return;}
    const now=new Date(); const old=uid?members.find(m=>m.id===uid):members.find(m=>String(m.email||'').toLowerCase()===email); let membershipBase=now; if($('renewExisting').checked && old && old.expiryDate && Number(old.durationDays||-1)!==0){const od=dateObj(old.expiryDate); if(od && od.getTime()>membershipBase.getTime()) membershipBase=od;}
    if($('renewExisting').checked && old && Number(old.durationDays||-1)===0 && Number(plan.durationDays||0)>0){toast('Cannot renew a Lifetime membership with a finite plan. Create a separate upgrade key instead.','error');return;}
    const duration=Math.max(0,Number(plan.durationDays||0)); const membershipExpiry=duration===0?null:new Date(membershipBase.getTime()+duration*86400000); const keyValid=Math.max(1,Number($('keyValidDays').value||7)); const keyExpires=new Date(now.getTime()+keyValid*86400000); const code=randomCode();
    const snap={targetEmail:email,targetUid:uid||null,planId:plan.id,planName:plan.name||plan.id,regularPrice:Number(plan.regularPrice??plan.price??0),offerPrice:Number(plan.offerPrice??0),durationDays:duration,shippingEnabled:$('keyShipping').checked,deviceLimit:Math.max(1,Number(plan.deviceLimit||1)),status:'AVAILABLE',createdAt:serverTimestamp(),createdByUid:auth.currentUser.uid,createdByEmail:auth.currentUser.email||'',keyExpiresAt:Timestamp.fromDate(keyExpires),membershipStartAt:Timestamp.fromDate(now),membershipExpiryAt:membershipExpiry?Timestamp.fromDate(membershipExpiry):null,source:'WHATSAPP_MANUAL',renewal:!!$('renewExisting').checked,notes:''};
    try{await setDoc(doc(db,'activationKeys',code),snap); const box=$('generatedKeyBox'); box.classList.remove('hidden'); box.innerHTML=`<div class="generated-key-title">Activation Key Created</div><div class="generated-code">${esc(code)}</div><div class="muted small">For ${esc(email)} · ${esc(plan.name||plan.id)} · ${duration===0?'Lifetime / Unlimited':`${duration} days`} · Shipping ${snap.shippingEnabled?'Included':'Not Included'}</div><div class="head-actions" style="margin-top:10px;"><button id="copyGenerated" class="primary">Copy Key</button><a id="waGenerated" class="ghost" target="_blank">Open WhatsApp</a></div>`; const msg=`Hi,\n\nYour MEESHO A+ LISTING AUTOMATION PRO activation code is:\n${code}\n\nGoogle account: ${email}\nPlan: ${plan.name||plan.id}\nShipping Optimizer: ${snap.shippingEnabled?'Included':'Not Included'}\n\nSign in with the same Google account in the extension and enter the code.\n\nSohel Enterprise`; $('waGenerated').href=waHref(waNumber,msg); $('copyGenerated').onclick=()=>navigator.clipboard?.writeText(code); toast('Activation key generated.'); await Promise.all([loadActivationKeys(email,uid),loadDashboard()]); }catch(err){toast(err.message||'Could not generate key.','error');}
  };
  $('keysRefresh').onclick=()=>loadActivationKeys();
  document.querySelectorAll('.copy-key').forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(b.dataset.code).then(()=>toast('Key copied.')));
  document.querySelectorAll('.revoke-key').forEach(b=>b.onclick=async()=>{if(!confirm(`Revoke ${b.dataset.code}?`))return; await updateDoc(doc(db,'activationKeys',b.dataset.code),{status:'REVOKED',revokedAt:serverTimestamp(),revokedByUid:auth.currentUser.uid}); toast('Activation key revoked.'); await Promise.all([loadActivationKeys(),loadDashboard()]);});
}

async function loadMemberships(){
  const [members,users]=await Promise.all([getMemberships(),getUsers()]); const map=new Map(users.map(u=>[u.id,u]));
  const rows=members.map(m=>{const u=map.get(m.id); const st=computedMembershipStatus(m); const exp=Number(m.durationDays||0)===0?null:dateObj(m.expiryDate); const remain=exp?Math.max(0,Math.ceil((exp.getTime()-Date.now())/86400000)):null; return `<tr><td><strong>${esc(u?.email||m.email||'—')}</strong><div class="muted tiny">${esc(m.id)}</div></td><td>${esc(m.planName||m.planId||'—')}</td><td>${statusBadge(st)}<div class="muted tiny">${remain!==null?(remain>0?`${remain} days left`:'Expired'): 'Lifetime / Unlimited'}</div></td><td>${esc(dateText(m.startDate))}</td><td>${esc(Number(m.durationDays||0)===0?'Lifetime / Unlimited':dateText(m.expiryDate))}</td><td>${m.shippingEnabled!==false?'Included':'Not Included'}</td><td class="row-actions"><button class="ghost tiny-btn membership-key" data-email="${esc(u?.email||m.email||'')}" data-uid="${esc(m.id)}">Generate Key</button><button class="ghost tiny-btn extend-membership" data-uid="${esc(m.id)}">Extend</button><button class="danger-outline tiny-btn suspend-membership" data-uid="${esc(m.id)}">Suspend</button></td></tr>`}).join('');
  $('memberships').innerHTML=`<div class="page-head"><div><h2>Memberships</h2><p class="muted">The single membership controls both Autofill and Shipping Optimizer access.</p></div><div class="head-actions"><button id="membershipRefresh" class="ghost">Refresh</button></div></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Customer Gmail</th><th>Plan</th><th>Status</th><th>Start</th><th>Expiry</th><th>Shipping</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No memberships yet.</td></tr>'}</tbody></table></div></div>`;
  $('membershipRefresh').onclick=loadMemberships;
  document.querySelectorAll('.membership-key').forEach(b=>b.onclick=()=>{show('activationKeys'); loadActivationKeys(b.dataset.email,b.dataset.uid);});
  document.querySelectorAll('.extend-membership').forEach(b=>b.onclick=async()=>{const s=await getDoc(doc(db,'memberships',b.dataset.uid)); if(!s.exists())return; const m=s.data(); if(Number(m.durationDays||0)===0){toast('Lifetime membership does not need extension.','error');return;} const days=Number(prompt('Add how many days?','30')); if(!Number.isFinite(days)||days<=0)return; const old=dateObj(m.expiryDate)||new Date(); const base=old.getTime()>Date.now()?old:new Date(); base.setDate(base.getDate()+days); await updateDoc(doc(db,'memberships',b.dataset.uid),{expiryDate:Timestamp.fromDate(base),status:'ACTIVE',updatedAt:serverTimestamp()}); await Promise.all([loadMemberships(),loadDashboard()]); toast(`Membership extended by ${days} days.`);});
  document.querySelectorAll('.suspend-membership').forEach(b=>b.onclick=async()=>{if(!confirm('Suspend this membership?'))return; await updateDoc(doc(db,'memberships',b.dataset.uid),{status:'SUSPENDED',updatedAt:serverTimestamp()}); await updateDoc(doc(db,'users',b.dataset.uid),{status:'SUSPENDED',updatedAt:serverTimestamp()}); toast('Membership suspended.'); await Promise.all([loadMemberships(),loadDashboard(),loadUsers()]);});
}

async function loadDevices(){
  const [snap,users]=await Promise.all([getDocs(query(collection(db,'devices'),limit(500))),getUsers()]); const map=new Map(users.map(u=>[u.id,u]));
  const rows=snap.docs.map(s=>{const d=s.data();return `<tr><td><strong>${esc(map.get(s.id)?.email||d.email||s.id)}</strong><div class="muted tiny">${esc(s.id)}</div></td><td>${esc(d.deviceLabel||'Chrome Extension')}</td><td>${esc(d.deviceId||'—')}</td><td>${esc(dateTimeText(d.lastActiveAt))}</td><td>${statusBadge(d.status||'ACTIVE')}</td><td><button class="danger-outline tiny-btn reset-device" data-uid="${esc(s.id)}">Reset Device</button></td></tr>`}).join('');
  $('devices').innerHTML=`<div class="page-head"><div><h2>Devices</h2><p class="muted">One bound customer device at a time. Admin reset is available.</p></div><button id="devicesRefresh" class="ghost">Refresh</button></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Customer</th><th>Device</th><th>ID</th><th>Last Active</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No device sessions yet.</td></tr>'}</tbody></table></div></div>`;
  $('devicesRefresh').onclick=loadDevices; document.querySelectorAll('.reset-device').forEach(b=>b.onclick=async()=>{if(!confirm('Reset this customer device binding?'))return; await deleteDoc(doc(db,'devices',b.dataset.uid)); toast('Device reset.'); await Promise.all([loadDevices(),loadDashboard()]);});
}

async function loadSettings(){
  const s=await getDoc(doc(db,'settings','general')); const d=s.exists()?s.data():{};
  $('settings').innerHTML=`<div class="page-head"><div><h2>Settings</h2><p class="muted">Brand and WhatsApp support details used by the extension and activation messages.</p></div></div><div class="panel form-panel"><form id="settingsForm" class="form-grid"><label>App Name<input id="appName" value="${esc(d.appName||'MEESHO A+ LISTING AUTOMATION PRO')}"></label><label>Brand Name<input id="brandName" value="${esc(d.brandName||'Sohel Enterprise')}"></label><label>Support Name<input id="supportName" value="${esc(d.supportName||'Sohel Rana')}"></label><label>WhatsApp Number<input id="whatsapp" value="${esc(d.whatsapp||'9064827025')}"></label><label>Phone Number<input id="supportPhone" value="${esc(d.supportPhone||'9064827025')}"></label><label>Support Email<input id="supportEmail" type="email" value="${esc(d.supportEmail||'sohelenterpriseofficial@gmail.com')}"></label><label class="span-2">WhatsApp Purchase Message<textarea id="whatsappPurchaseMessage" rows="6">${esc(d.whatsappPurchaseMessage||'Hi, I want to purchase {plan} for {price}. My Google account is {email}. Please send the payment details here. After payment, please verify and send my activation code.')}</textarea><small>Placeholders: {plan} {price} {email} {uid} {app} {brand}</small></label><div class="form-actions"><button class="primary" type="submit">Save Settings</button></div></form></div>`;
  $('settingsForm').onsubmit=async e=>{e.preventDefault(); let wa=$('whatsapp').value.trim().replace(/\D/g,''); if(wa.length===10)wa=`91${wa}`; let phone=$('supportPhone').value.trim().replace(/\D/g,''); if(phone.startsWith('91')&&phone.length===12)phone=phone.slice(2); await setDoc(doc(db,'settings','general'),{appName:$('appName').value.trim(),brandName:$('brandName').value.trim(),supportName:$('supportName').value.trim(),whatsapp:wa||'919064827025',supportPhone:phone||'9064827025',supportEmail:$('supportEmail').value.trim(),whatsappPurchaseMessage:$('whatsappPurchaseMessage').value.trim(),updatedAt:serverTimestamp()},{merge:true}); toast('Settings saved.');};
}

async function refresh(section){
  if(section==='dashboard') await loadDashboard();
  if(section==='users') await loadUsers();
  if(section==='plans') await loadPlans();
  if(section==='activationKeys') await loadActivationKeys();
  if(section==='memberships') await loadMemberships();
  if(section==='devices') await loadDevices();
  if(section==='settings') await loadSettings();
}
document.querySelectorAll('.nav').forEach(n=>n.onclick=async()=>{show(n.dataset.section); await refresh(n.dataset.section);});
$('googleLogin').onclick=async()=>{try{$('loginError').textContent='';await signInWithPopup(auth,provider);}catch(e){$('loginError').textContent=e.message||'Login failed.';}};
$('logout').onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{if(!user){$('loginView').classList.remove('hidden');$('adminView').classList.add('hidden');return;} try{if(!(await isAdmin(user))){await signOut(auth);$('loginError').textContent='This Google account is not an authorized admin.';return;} $('adminEmail').textContent=user.email||''; $('loginView').classList.add('hidden'); $('adminView').classList.remove('hidden'); show('dashboard'); await loadDashboard();}catch(e){await signOut(auth);$('loginError').textContent='Admin verification failed: '+(e.message||'unknown error');}});
