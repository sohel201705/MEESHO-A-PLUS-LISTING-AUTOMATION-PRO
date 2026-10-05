import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, limit, query,
  serverTimestamp, Timestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[c]));

const money = value => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
};

const dateText = value => {
  if (!value) return "—";
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN");
  } catch { return "—"; }
};

const dateTimeText = value => {
  if (!value) return "—";
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN");
  } catch { return "—"; }
};

const tsFromInput = value => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
};

function addDays(timestamp, days) {
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  d.setDate(d.getDate() + Number(days || 0));
  return Timestamp.fromDate(d);
}

function show(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
  document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n.dataset.section === id));
}

function statusBadge(status) {
  const v = String(status || "UNKNOWN").toUpperCase();
  const cls = ["ACTIVE", "AVAILABLE", "REDEEMED", "ENABLED"].includes(v)
    ? "active"
    : ["EXPIRED", "SUSPENDED", "REVOKED", "BLOCKED"].includes(v)
    ? "expired" : "pending";
  return `<span class="badge ${cls}">${esc(v)}</span>`;
}

function toast(message, type = "success") {
  document.querySelector(".toast")?.remove();
  const e = document.createElement("div");
  e.className = `toast ${type}`;
  e.textContent = message;
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 2600);
}

async function isAdmin(user) {
  const snap = await getDoc(doc(db, "admins", user.uid));
  return snap.exists() && snap.data().active === true && snap.data().role === "admin";
}

async function allDocs(name, n = 500) {
  const snap = await getDocs(query(collection(db, name), limit(n)));
  const out = [];
  snap.forEach(s => out.push({ id: s.id, ...s.data() }));
  return out;
}

function codeBlock() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = n => Array.from({length:n}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
  return `MEESHO-${block(4)}-${block(4)}-${block(4)}`;
}

function activePlans(plans) {
  return plans.filter(p => p.active !== false).sort((a,b) => Number(a.displayOrder||0)-Number(b.displayOrder||0));
}

async function loadDashboard() {
  const [users, memberships, plans, keys] = await Promise.all([
    allDocs("users"), allDocs("memberships"), allDocs("plans"), allDocs("activationKeys")
  ]);
  let active=0, expired=0, suspended=0, lifetime=0;
  memberships.forEach(m => {
    const s = String(m.status||"").toUpperCase();
    if (s==="ACTIVE") active++;
    if (s==="EXPIRED") expired++;
    if (s==="SUSPENDED") suspended++;
    if (s==="ACTIVE" && String(m.planId||"").toLowerCase()==="lifetime") lifetime++;
  });
  const available = keys.filter(k => String(k.status||"").toUpperCase()==="AVAILABLE").length;
  const redeemed = keys.filter(k => String(k.status||"").toUpperCase()==="REDEEMED").length;
  $("dashboard").innerHTML = `
    <div class="page-head"><div><h2>Dashboard</h2><p class="muted">MEESHO A+ membership administration</p></div>
    <button id="dashRefresh" class="ghost">Refresh</button></div>
    <div class="grid">
      <div class="stat"><span>Users</span><b>${users.length}</b></div>
      <div class="stat"><span>Active Members</span><b>${active}</b></div>
      <div class="stat"><span>Expired</span><b>${expired}</b></div>
      <div class="stat"><span>Suspended</span><b>${suspended}</b></div>
      <div class="stat"><span>Lifetime</span><b>${lifetime}</b></div>
      <div class="stat"><span>Available Keys</span><b>${available}</b></div>
      <div class="stat"><span>Redeemed Keys</span><b>${redeemed}</b></div>
      <div class="stat"><span>Active Plans</span><b>${plans.filter(p=>p.active!==false).length}</b></div>
    </div>
    <div class="panel"><div class="notice">Firebase is the source of truth. One membership controls Autofill, Shipping Optimizer, and the 3-device entitlement.</div></div>`;
  $("dashRefresh").onclick = loadDashboard;
}

async function loadUsers() {
  const [users, memberships] = await Promise.all([allDocs("users"), allDocs("memberships")]);
  const mm = new Map(memberships.map(x => [x.id, x]));
  let rows = "";
  users.forEach(u => {
    const m = mm.get(u.id) || {};
    rows += `<tr>
      <td>${esc(u.name||u.displayName||"—")}</td><td>${esc(u.email||"—")}</td>
      <td>${esc(m.planName||m.planId||"—")}</td><td>${statusBadge(m.status||"—")}</td>
      <td>${esc(dateTimeText(u.lastLoginAt))}</td>
      <td class="row-actions">
        <button class="user-key" data-email="${esc(u.email||"")}" data-uid="${esc(u.id)}">Activation Key</button>
        <button class="user-manual" data-email="${esc(u.email||"")}" data-uid="${esc(u.id)}">Manual Activate</button>
      </td></tr>`;
  });

  $("users").innerHTML = `
    <div class="page-head"><div><h2>Users</h2><p class="muted">Search existing customer Gmail, name, or UID.</p></div>
    <button id="usersRefresh" class="ghost">Refresh</button></div>
    <div class="panel"><input id="userSearch" class="search" placeholder="Search Gmail / Name / UID"></div>
    <div class="panel table-wrap"><table class="table" id="usersTable">
      <thead><tr><th>User</th><th>Email</th><th>Plan</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6">No users yet. Use Activation Keys to create a key for a new Gmail.</td></tr>'}</tbody>
    </table></div>`;
  $("usersRefresh").onclick = loadUsers;
  $("userSearch").oninput = () => {
    const q = $("userSearch").value.toLowerCase();
    document.querySelectorAll("#usersTable tbody tr").forEach(r => r.style.display = !q || r.textContent.toLowerCase().includes(q) ? "" : "none");
  };
  document.querySelectorAll(".user-key").forEach(b => b.onclick = async () => {
    show("activationKeys"); await renderActivation(b.dataset.email, b.dataset.uid);
  });
  document.querySelectorAll(".user-manual").forEach(b => b.onclick = async () => {
    show("memberships"); await renderMembershipEditor(b.dataset.email, b.dataset.uid);
  });
}

function planOptions(plans) {
  return activePlans(plans).map(p => `<option value="${esc(p.id)}">${esc(p.name||p.id)} — ${money(p.offerPrice ?? p.price)} — ${p.durationDays===0 ? "Lifetime" : `${p.durationDays} days`}</option>`).join("");
}

async function loadPlans() {
  const plans = activePlans(await allDocs("plans"));
  let rows = plans.map(p => `<tr>
    <td><code>${esc(p.id)}</code></td><td><strong>${esc(p.name||"—")}</strong></td>
    <td>${money(p.price)}</td><td>${money(p.offerPrice)}</td>
    <td>${p.durationDays===0 ? "Lifetime" : esc(p.durationDays)}</td>
    <td>${p.shippingEnabled ? "Included" : "Off"}</td><td>${esc(p.deviceLimit ?? 3)}</td>
    <td>${statusBadge(p.active===false?"DISABLED":"ACTIVE")}</td>
    <td class="row-actions"><button class="toggle-plan" data-id="${esc(p.id)}">Disable</button></td>
  </tr>`).join("");
  $("plans").innerHTML = `
    <div class="page-head"><div><h2>Plans</h2><p class="muted">Pricing uses price + offerPrice only. Every plan has 3 devices.</p></div>
    <button id="plansRefresh" class="ghost">Refresh</button></div>
    <div class="panel table-wrap"><table class="table"><thead>
      <tr><th>ID</th><th>Name</th><th>Price</th><th>Offer</th><th>Duration</th><th>Shipping</th><th>Devices</th><th>Status</th><th>Actions</th></tr>
    </thead><tbody>${rows||'<tr><td colspan="9">No plans found.</td></tr>'}</tbody></table></div>`;
  $("plansRefresh").onclick = loadPlans;
  document.querySelectorAll(".toggle-plan").forEach(b => b.onclick = async () => {
    await updateDoc(doc(db,"plans",b.dataset.id), {active:false});
    toast("Plan disabled.");
    await loadPlans();
  });
}

async function renderActivation(prefillEmail="", prefillUid="") {
  const plans = activePlans(await allDocs("plans"));
  $("activationKeys").innerHTML = `
    <div class="page-head"><div><h2>Activation Keys</h2><p class="muted">One-time Gmail-bound code after WhatsApp payment.</p></div>
    <button id="activationRefresh" class="ghost">Refresh</button></div>
    <div class="panel form-panel">
      <h3>Generate Activation</h3>
      <p class="muted">Search an existing customer or enter a new Gmail manually.</p>
      <div class="form-grid">
        <label>Customer Gmail<input id="actEmail" value="${esc(prefillEmail)}" placeholder="customer@gmail.com"></label>
        <label>Linked UID (optional)<input id="actUid" value="${esc(prefillUid)}" placeholder="Firebase UID"></label>
        <label>Plan<select id="actPlan">${planOptions(plans)}</select></label>
        <label>Key Validity (Days)<input id="actKeyDays" type="number" min="1" value="7"></label>
        <label>Notes<input id="actNotes" placeholder="Optional"></label>
        <label class="check-row"><input id="actRenewal" type="checkbox"> Renewal / upgrade key</label>
      </div>
      <div id="actPreview" class="notice preview"></div>
      <div class="form-actions"><button id="generateAct" class="primary small-btn">Generate Activation Key</button></div>
      <div id="generatedAct"></div>
    </div>
    <div class="panel table-wrap"><table class="table"><thead>
      <tr><th>Code</th><th>Customer</th><th>Plan</th><th>Status</th><th>Key Expiry</th><th>Membership</th><th>Actions</th></tr>
    </thead><tbody id="actRows"></tbody></table></div>`;

  const byId = new Map(plans.map(p=>[p.id,p]));
  const preview = () => {
    const p = byId.get($("actPlan").value);
    $("actPreview").innerHTML = p ? `${esc(p.name)} · ${money(p.price)} → ${money(p.offerPrice ?? p.price)} · ${p.durationDays===0?"Lifetime / Unlimited":`${p.durationDays} days`} · Shipping: ${p.shippingEnabled?"Included":"Off"} · Devices: ${esc(p.deviceLimit??3)}` : "No active plan.";
  };
  $("actPlan").onchange = preview; preview();

  $("generateAct").onclick = async () => {
    const email = $("actEmail").value.trim().toLowerCase();
    const uid = $("actUid").value.trim();
    const p = byId.get($("actPlan").value);
    const keyDays = Number($("actKeyDays").value||7);
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return toast("Enter a valid Gmail.", "error");
    if (!p) return toast("Select a plan.", "error");
    if (!Number.isInteger(keyDays) || keyDays < 1) return toast("Key validity must be at least 1 day.", "error");

    const code = codeBlock();
    const start = Timestamp.now();
    const expiry = Number(p.durationDays||0)===0 ? null : addDays(start, p.durationDays);
    const data = {
      code, targetEmail: email, status:"AVAILABLE",
      planId:p.id, planName:p.name||p.id, price:Number(p.price||0), offerPrice:Number(p.offerPrice??p.price??0),
      durationDays:Number(p.durationDays||0),
      shippingEnabled:p.shippingEnabled !== false, deviceLimit:Number(p.deviceLimit??3),
      keyExpiresAt:addDays(Timestamp.now(), keyDays),
      membershipStartAt:start, membershipExpiryAt:expiry,
      createdAt:serverTimestamp(), createdByUid:auth.currentUser?.uid||"", createdByEmail:auth.currentUser?.email||"",
      redeemedAt:null, redeemedByUid:null, redeemedEmail:null,
      renewal:$("actRenewal").checked, notes:$("actNotes").value.trim()
    };
    if (uid) data.targetUid = uid;
    await setDoc(doc(db,"activationKeys",code),data);

    const msg = [
      "Hello,","",
      "Your MEESHO A+ LISTING AUTOMATION PRO activation details:","",
      `Gmail: ${email}`,`Plan: ${data.planName}`,`Price: ${money(data.offerPrice)}`,
      `Duration: ${data.durationDays===0?"Lifetime / Unlimited":`${data.durationDays} Days`}`,
      `Shipping Optimizer: ${data.shippingEnabled?"Included":"Not Included"}`,
      `Device Limit: ${data.deviceLimit}`,`Activation Code: ${code}`,"",
      "Login with the same Google account and enter this activation code.","","Sohel Enterprise"
    ].join("\\n");

    $("generatedAct").innerHTML = `<div class="generated"><div class="generated-code">${esc(code)}</div>
      <div class="generated-meta">${esc(email)} · ${esc(data.planName)}</div>
      <div class="row-actions"><button id="copyAct">Copy</button><button id="copyMsg">Copy WhatsApp Message</button><button id="openWA">WhatsApp</button></div></div>`;
    $("copyAct").onclick = async () => {await navigator.clipboard.writeText(code); toast("Key copied.")};
    $("copyMsg").onclick = async () => {await navigator.clipboard.writeText(msg); toast("Message copied.")};
    $("openWA").onclick = () => window.open(`https://wa.me/9064827025?text=${encodeURIComponent(msg)}`,"_blank","noopener,noreferrer");
    toast("Activation key generated.");
    await loadActivationRows();
  };

  $("activationRefresh").onclick = loadActivationRows;
  await loadActivationRows();
}

async function loadActivationRows() {
  const keys = await allDocs("activationKeys");
  $("actRows").innerHTML = keys.length ? keys.map(k => `<tr>
    <td><code>${esc(k.code||k.id)}</code></td><td>${esc(k.targetEmail||"—")}</td>
    <td>${esc(k.planName||k.planId||"—")}</td><td>${statusBadge(k.status)}</td>
    <td>${esc(dateText(k.keyExpiresAt))}</td>
    <td>${k.durationDays===0?"Lifetime / Unlimited":`${esc(k.durationDays??"—")} days`}<br><span class="muted">${esc(dateText(k.membershipStartAt))} → ${k.membershipExpiryAt?esc(dateText(k.membershipExpiryAt)):"Lifetime"}</span></td>
    <td class="row-actions"><button class="copy-key" data-code="${esc(k.code||k.id)}">Copy</button>
      ${String(k.status||"").toUpperCase()==="AVAILABLE"?`<button class="revoke-key danger-outline" data-code="${esc(k.code||k.id)}">Revoke</button>`:""}</td>
  </tr>`).join("") : '<tr><td colspan="7">No activation keys yet.</td></tr>';
  document.querySelectorAll(".copy-key").forEach(b => b.onclick = async()=>{await navigator.clipboard.writeText(b.dataset.code);toast("Key copied.")});
  document.querySelectorAll(".revoke-key").forEach(b => b.onclick = async()=>{
    if(!confirm("Revoke this activation key?")) return;
    await updateDoc(doc(db,"activationKeys",b.dataset.code),{status:"REVOKED",revokedAt:serverTimestamp(),revokedByUid:auth.currentUser?.uid||""});
    toast("Key revoked."); await loadActivationRows();
  });
}

async function renderMembershipEditor(prefillEmail="", prefillUid="") {
  const plans = activePlans(await allDocs("plans"));
  $("memberships").innerHTML = `
    <div class="page-head"><div><h2>Memberships</h2><p class="muted">Admin activation and membership control.</p></div>
    <button id="memberRefresh" class="ghost">Refresh</button></div>
    <div class="panel form-panel"><h3>Manual Activate / Edit Membership</h3>
      <div class="form-grid">
        <label>Customer Gmail<input id="memEmail" value="${esc(prefillEmail)}"></label>
        <label>Firebase UID<input id="memUid" value="${esc(prefillUid)}" placeholder="Required for manual activation"></label>
        <label>Plan<select id="memPlan">${planOptions(plans)}</select></label>
        <label>Start Date<input id="memStart" type="datetime-local"></label>
      </div>
      <div id="memPreview" class="notice preview"></div>
      <div class="form-actions"><button id="manualActivate" class="primary small-btn">Activate / Update</button></div>
    </div>
    <div class="panel table-wrap"><table class="table"><thead>
      <tr><th>Customer</th><th>Plan</th><th>Status</th><th>Start</th><th>Expiry</th><th>Shipping</th><th>Devices</th><th>Actions</th></tr>
    </thead><tbody id="memRows"></tbody></table></div>`;

  $("memStart").value = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  const byId = new Map(plans.map(p=>[p.id,p]));
  const preview = () => {
    const p=byId.get($("memPlan").value);
    $("memPreview").innerHTML = p ? `${esc(p.name)} · ${money(p.offerPrice??p.price)} · ${p.durationDays===0?"Lifetime / Unlimited":`${p.durationDays} days`} · Shipping: ${p.shippingEnabled?"Included":"Off"} · Devices: ${esc(p.deviceLimit??3)}` : "No plan.";
  };
  $("memPlan").onchange=preview; preview();

  $("manualActivate").onclick = async()=>{
    const email=$("memEmail").value.trim().toLowerCase(), uid=$("memUid").value.trim(), p=byId.get($("memPlan").value), start=tsFromInput($("memStart").value);
    if(!uid||!email||!p||!start) return toast("Gmail, UID, Plan and Start Date are required.","error");
    const expiry=p.durationDays===0?null:addDays(start,p.durationDays);
    await setDoc(doc(db,"memberships",uid),{
      uid,email,planId:p.id,planName:p.name||p.id,price:Number(p.price||0),offerPrice:Number(p.offerPrice??p.price??0),
      durationDays:Number(p.durationDays||0),status:"ACTIVE",shippingEnabled:p.shippingEnabled!==false,deviceLimit:Number(p.deviceLimit??3),
      startDate:start,expiryDate:expiry,activationKeyId:"",source:"ADMIN",activatedAt:serverTimestamp(),updatedAt:serverTimestamp()
    },{merge:true});
    toast("Membership activated."); await loadMembershipRows();
  };
  $("memberRefresh").onclick=loadMembershipRows;
  await loadMembershipRows();
}

async function loadMembershipRows() {
  const memberships=await allDocs("memberships");
  $("memRows").innerHTML = memberships.length ? memberships.map(m=>`<tr>
    <td><strong>${esc(m.email||"—")}</strong><br><span class="muted">${esc(m.uid||m.id)}</span></td>
    <td>${esc(m.planName||m.planId||"—")}</td><td>${statusBadge(m.status)}</td>
    <td>${esc(dateText(m.startDate))}</td><td>${m.expiryDate?esc(dateText(m.expiryDate)):"Lifetime"}</td>
    <td>${m.shippingEnabled?"Included":"Off"}</td><td>${esc(m.deviceLimit??3)}</td>
    <td class="row-actions"><button class="suspend-m" data-uid="${esc(m.id)}">Suspend</button><button class="revoke-m danger-outline" data-uid="${esc(m.id)}">Revoke</button></td>
  </tr>`).join("") : '<tr><td colspan="8">No memberships yet.</td></tr>';

  document.querySelectorAll(".suspend-m").forEach(b=>b.onclick=async()=>{
    await updateDoc(doc(db,"memberships",b.dataset.uid),{status:"SUSPENDED",updatedAt:serverTimestamp()});
    toast("Membership suspended."); await loadMembershipRows();
  });
  document.querySelectorAll(".revoke-m").forEach(b=>b.onclick=async()=>{
    await updateDoc(doc(db,"memberships",b.dataset.uid),{status:"REVOKED",updatedAt:serverTimestamp()});
    toast("Membership revoked."); await loadMembershipRows();
  });
}

async function loadDevices() {
  $("devices").innerHTML = `<div class="page-head"><div><h2>Devices</h2><p class="muted">3-device entitlement. Session management will be connected to the final extension device module.</p></div>
    <button id="deviceRefresh" class="ghost">Refresh</button></div>
    <div class="panel"><div class="notice">No device sessions are registered yet.</div></div>`;
  $("deviceRefresh").onclick=loadDevices;
}

async function loadSettings() {
  const s=await getDoc(doc(db,"settings","general"));
  const d=s.exists()?s.data():{};
  $("settings").innerHTML = `<div class="page-head"><div><h2>Settings</h2><p class="muted">Branding, support and WhatsApp configuration.</p></div></div>
    <div class="panel form-panel"><div class="form-grid">
      <label>App Name<input id="setAppName" value="${esc(d.appName||"")}"></label>
      <label>Brand Name<input id="setBrandName" value="${esc(d.brandName||"")}"></label>
      <label>Support Name<input id="setSupportName" value="${esc(d.supportName||"")}"></label>
      <label>Email<input id="setEmail" value="${esc(d.email||"")}"></label>
      <label>Phone<input id="setPhone" value="${esc(d.phone||"")}"></label>
      <label>WhatsApp<input id="setWhatsApp" value="${esc(d.whatsapp||"")}"></label>
      <label>Payment Mode<input id="setPaymentMode" value="${esc(d.paymentMode||"WHATSAPP")}"></label>
    </div>
    <div class="form-actions"><button id="saveSettings" class="primary small-btn">Save Settings</button></div></div>`;
  $("saveSettings").onclick=async()=>{
    await setDoc(doc(db,"settings","general"),{
      appName:$("setAppName").value.trim(), brandName:$("setBrandName").value.trim(), supportName:$("setSupportName").value.trim(),
      email:$("setEmail").value.trim(), phone:$("setPhone").value.trim(), whatsapp:$("setWhatsApp").value.trim(),
      paymentMode:$("setPaymentMode").value.trim()||"WHATSAPP"
    },{merge:true});
    toast("Settings saved.");
  };
}

document.querySelectorAll(".nav").forEach(n=>n.onclick=async()=>{
  show(n.dataset.section);
  try{
    if(n.dataset.section==="dashboard")await loadDashboard();
    if(n.dataset.section==="users")await loadUsers();
    if(n.dataset.section==="plans")await loadPlans();
    if(n.dataset.section==="activationKeys")await renderActivation();
    if(n.dataset.section==="memberships")await renderMembershipEditor();
    if(n.dataset.section==="devices")await loadDevices();
    if(n.dataset.section==="settings")await loadSettings();
  }catch(e){console.error(e);toast(e.message||"Unable to load section.","error")}
});

$("googleLogin").onclick=async()=>{
  $("loginError").textContent="";
  try{await signInWithPopup(auth,provider)}catch(e){$("loginError").textContent=e.message||"Google sign-in failed."}
};
$("logout").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
  if(!user){$("loginView").classList.remove("hidden");$("adminView").classList.add("hidden");return;}
  try{
    if(!(await isAdmin(user))){
      await signOut(auth); $("loginError").textContent="This Google account is not an authorized admin."; return;
    }
    $("adminEmail").textContent=user.email||"";
    $("loginView").classList.add("hidden");$("adminView").classList.remove("hidden");
    show("dashboard"); await loadDashboard();
  }catch(e){
    console.error(e); await signOut(auth);
    $("loginError").textContent="Admin verification failed: "+(e.message||"unknown error");
  }
});
