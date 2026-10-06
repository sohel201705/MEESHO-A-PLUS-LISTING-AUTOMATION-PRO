import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[c]));

const css = document.createElement("style");
css.textContent = `
  .email-device-manager{margin:0 0 18px}
  .email-device-manager .manager-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
  .email-device-manager .manager-head h3{margin:0;font-size:17px}
  .email-device-manager .manager-head p{margin:4px 0 0;color:#7a8797;font-size:12px}
  .email-device-manager .manager-search{width:100%;padding:10px 12px;border:1px solid #dce3ec;border-radius:10px;margin-bottom:12px;background:#fff}
  .email-device-manager .manager-scroll{overflow-x:auto}
  .email-device-manager table{width:100%;border-collapse:collapse;min-width:760px}
  .email-device-manager th,.email-device-manager td{padding:11px 10px;border-bottom:1px solid #edf1f5;text-align:left;font-size:12px;white-space:nowrap}
  .email-device-manager th{font-size:11px;color:#667386;text-transform:uppercase;letter-spacing:.04em}
  .email-device-manager .limit-control{display:inline-flex;align-items:center;border:1px solid #d9e2ed;border-radius:10px;overflow:hidden;background:#fff}
  .email-device-manager .limit-control button{width:32px;height:32px;border:0;background:#f4f7fb;font-size:18px;cursor:pointer}
  .email-device-manager .limit-control button:hover{background:#eaf2ff}
  .email-device-manager .limit-value{min-width:42px;text-align:center;font-weight:900;color:#152033}
  .email-device-manager .usage{font-weight:800}
  .email-device-manager .muted{color:#7a8797}
  .email-device-manager .ok{color:#15803d;font-weight:800}
  .email-device-manager .warn{color:#b45309;font-weight:800}
  .email-device-manager .busy{opacity:.55;pointer-events:none}
`;
document.head.appendChild(css);

let customersCache = [];
let loading = false;

function isAdminUser(user) {
  // Firestore Rules remain the authoritative admin boundary.
  return Boolean(user);
}

async function loadCustomers() {
  if (!isAdminUser(auth.currentUser) || loading) return;
  loading = true;
  const root = $("devices");
  if (!root) { loading = false; return; }

  try {
    const snap = await getDocs(query(collection(db, "customers"), limit(500)));
    const rows = [];

    for (const item of snap.docs) {
      const d = item.data();
      let activeDevices = 0;
      try {
        const ds = await getDocs(query(collection(db, "customers", item.id, "devices"), limit(50)));
        ds.forEach(device => {
          if (String(device.data().status || "ACTIVE").toUpperCase() === "ACTIVE") activeDevices++;
        });
      } catch (_) {}

      rows.push({
        id: item.id,
        email: d.email || item.id,
        planName: d.planName || d.planId || "—",
        status: String(d.status || "UNKNOWN").toUpperCase(),
        limit: Math.max(1, Math.min(20, Number(d.deviceLimit || 3))),
        activeDevices
      });
    }

    customersCache = rows.sort((a,b) => a.email.localeCompare(b.email));
    render();
  } catch (error) {
    console.error("[Device Limit Manager]", error);
    const box = root.querySelector("#emailDeviceManager");
    if (box) box.innerHTML = `<div class="panel"><div class="muted">Unable to load email memberships: ${esc(error?.message || "permission error")}</div></div>`;
  } finally {
    loading = false;
  }
}

function render() {
  const root = $("devices");
  if (!root) return;

  let manager = root.querySelector("#emailDeviceManager");
  if (!manager) {
    manager = document.createElement("div");
    manager.id = "emailDeviceManager";
    manager.className = "email-device-manager";
    root.prepend(manager);
  }

  manager.innerHTML = `
    <div class="panel">
      <div class="manager-head">
        <div>
          <h3>Email Membership Device Limits</h3>
          <p>Membership is keyed by Gmail/email. Change the allowed device count without changing the plan price.</p>
        </div>
        <button id="emailDeviceRefresh" class="ghost">Refresh</button>
      </div>

      <input id="emailDeviceSearch" class="manager-search" placeholder="Search customer Gmail / plan">

      <div class="manager-scroll">
        <table>
          <thead>
            <tr>
              <th>Customer Gmail</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Used</th>
              <th>Device Limit</th>
            </tr>
          </thead>
          <tbody id="emailDeviceRows"></tbody>
        </table>
      </div>
    </div>
  `;

  const drawRows = () => {
    const q = String($("emailDeviceSearch")?.value || "").trim().toLowerCase();
    const filtered = customersCache.filter(x =>
      x.email.toLowerCase().includes(q) || x.planName.toLowerCase().includes(q)
    );

    $("emailDeviceRows").innerHTML = filtered.length
      ? filtered.map(x => `
          <tr data-email="${esc(x.email)}">
            <td><strong>${esc(x.email)}</strong></td>
            <td>${esc(x.planName)}</td>
            <td>${esc(x.status)}</td>
            <td class="usage ${x.activeDevices >= x.limit ? "warn" : "ok"}">${x.activeDevices} / ${x.limit}</td>
            <td>
              <span class="limit-control">
                <button class="limit-minus" data-email="${esc(x.email)}" aria-label="Decrease device limit">−</button>
                <span class="limit-value">${x.limit}</span>
                <button class="limit-plus" data-email="${esc(x.email)}" aria-label="Increase device limit">+</button>
              </span>
            </td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" class="muted">No email memberships found.</td></tr>`;

    manager.querySelectorAll(".limit-minus").forEach(btn => btn.onclick = () => changeLimit(btn.dataset.email, -1));
    manager.querySelectorAll(".limit-plus").forEach(btn => btn.onclick = () => changeLimit(btn.dataset.email, +1));
  };

  $("emailDeviceSearch").oninput = drawRows;
  $("emailDeviceRefresh").onclick = loadCustomers;
  drawRows();
}

async function changeLimit(email, delta) {
  const item = customersCache.find(x => x.email === email);
  if (!item) return;

  const next = Math.max(1, Math.min(20, item.limit + delta));
  if (next === item.limit) return;

  const row = document.querySelector(`tr[data-email="${CSS.escape(email)}"]`);
  row?.classList.add("busy");
  try {
    await updateDoc(doc(db, "customers", email), {
      deviceLimit: next,
      updatedAt: serverTimestamp(),
      deviceLimitUpdatedBy: auth.currentUser?.uid || ""
    });
    item.limit = next;
    render();
  } catch (error) {
    alert(`Device limit update failed: ${error?.message || "Permission denied"}`);
    row?.classList.remove("busy");
  }
}

onAuthStateChanged(auth, user => {
  if (!user) return;

  const loadWhenVisible = () => {
    const devices = $("devices");
    if (devices && !devices.classList.contains("hidden")) {
      loadCustomers();
    }
  };

  // Initial load when the admin panel is already on Devices.
  loadWhenVisible();

  // Current admin panel navigation stays intact; we only observe the Devices click.
  document.querySelectorAll('.nav[data-section="devices"]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(loadWhenVisible, 120);
    });
  });
});
