import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const ADMIN_UID = "ANzaRtHgkJXlcPO8NmhzuAJ0b5C3";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[c]));

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
}

function asDate(value) {
  if (!value) return null;
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function dateText(value) {
  const d = asDate(value);
  return d ? d.toLocaleDateString("en-IN") : "—";
}

function dateTimeText(value) {
  const d = asDate(value);
  return d ? d.toLocaleString("en-IN") : "—";
}

function dateTimeLocalValue(value) {
  const d = asDate(value) || new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function tsFromInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
}

function addDays(dateLike, days) {
  const d = asDate(dateLike) || new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return Timestamp.fromDate(d);
}

function membershipPeriod(start, durationDays) {
  return Number(durationDays) === 0 ? null : addDays(start, durationDays);
}

function statusBadge(status) {
  const value = String(status || "UNKNOWN").toUpperCase();
  const cls =
    ["ACTIVE", "AVAILABLE", "REDEEMED", "ENABLED"].includes(value) ? "active" :
    ["EXPIRED", "SUSPENDED", "REVOKED", "BLOCKED", "DISABLED"].includes(value) ? "expired" :
    "pending";
  return `<span class="badge ${cls}">${esc(value)}</span>`;
}

function toast(message, type = "success") {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function show(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  $(id)?.classList.remove("hidden");
  document.querySelectorAll(".nav").forEach(n =>
    n.classList.toggle("active", n.dataset.section === id)
  );
}

async function isAdmin(user) {
  if (!user || user.uid !== ADMIN_UID) return false;
  const snap = await getDoc(doc(db, "admins", user.uid));
  return snap.exists() && snap.data().active === true && snap.data().role === "admin";
}

async function readCollection(name, max = 500) {
  const snap = await getDocs(query(collection(db, name), limit(max)));
  return snap.docs.map(s => ({ id: s.id, ...s.data() }));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validGmail(value) {
  return /^[^@\s]+@gmail\.com$/i.test(value);
}

function generateKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = len => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `MEESHO-${block(4)}-${block(4)}-${block(4)}`;
}

/* ---------------- Dashboard ---------------- */

async function loadDashboard() {
  const [users, memberships, plans, keys] = await Promise.all([
    readCollection("users"),
    readCollection("memberships"),
    readCollection("plans"),
    readCollection("activationKeys")
  ]);

  let active = 0, expired = 0, suspended = 0, lifetime = 0;

  memberships.forEach(m => {
    const s = String(m.status || "").toUpperCase();
    if (s === "ACTIVE") active++;
    if (s === "EXPIRED") expired++;
    if (s === "SUSPENDED") suspended++;
    if (s === "ACTIVE" && String(m.planId || "").toLowerCase() === "lifetime") lifetime++;
  });

  const available = keys.filter(k => String(k.status || "").toUpperCase() === "AVAILABLE").length;
  const redeemed = keys.filter(k => String(k.status || "").toUpperCase() === "REDEEMED").length;
  const activePlans = plans.filter(p => p.active !== false).length;

  $("dashboard").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Dashboard</h2>
        <p class="muted">MEESHO A+ membership administration</p>
      </div>
      <button id="dashRefresh" class="ghost">Refresh</button>
    </div>

    <div class="grid">
      <div class="stat"><span>Users</span><b>${users.length}</b></div>
      <div class="stat"><span>Active Members</span><b>${active}</b></div>
      <div class="stat"><span>Expired</span><b>${expired}</b></div>
      <div class="stat"><span>Suspended</span><b>${suspended}</b></div>
      <div class="stat"><span>Lifetime</span><b>${lifetime}</b></div>
      <div class="stat"><span>Available Keys</span><b>${available}</b></div>
      <div class="stat"><span>Redeemed Keys</span><b>${redeemed}</b></div>
      <div class="stat"><span>Active Plans</span><b>${activePlans}</b></div>
    </div>

    <div class="panel">
      <div class="notice">
        Firebase membership is the source of truth. Autofill, Shipping Optimizer,
        and the 3-device entitlement are managed from the same membership.
      </div>
    </div>
  `;

  $("dashRefresh").onclick = loadDashboard;
}

/* ---------------- Users ---------------- */

async function loadUsers() {
  const [users, memberships] = await Promise.all([
    readCollection("users"),
    readCollection("memberships")
  ]);

  const mm = new Map(memberships.map(m => [m.id, m]));

  let rows = "";
  users.forEach(u => {
    const m = mm.get(u.id) || {};
    rows += `
      <tr>
        <td><strong>${esc(u.name || u.displayName || "—")}</strong></td>
        <td>${esc(u.email || "—")}</td>
        <td>${esc(m.planName || m.planId || "—")}</td>
        <td>${statusBadge(m.status || "—")}</td>
        <td>${esc(dateTimeText(u.lastLoginAt))}</td>
        <td class="row-actions">
          <button class="user-key" data-email="${esc(u.email || "")}" data-uid="${esc(u.id)}">Activation Key</button>
          <button class="user-membership" data-email="${esc(u.email || "")}" data-uid="${esc(u.id)}">Membership</button>
        </td>
      </tr>
    `;
  });

  $("users").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Users</h2>
        <p class="muted">Search existing customer Gmail, name or UID.</p>
      </div>
      <button id="usersRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel">
      <input id="userSearch" class="search" placeholder="Search Gmail / Name / UID">
    </div>

    <div class="panel table-wrap">
      <table class="table" id="usersTable">
        <thead>
          <tr>
            <th>User</th><th>Email</th><th>Plan</th><th>Status</th><th>Last Login</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6">No users yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("usersRefresh").onclick = loadUsers;
  $("userSearch").oninput = () => {
    const q = $("userSearch").value.trim().toLowerCase();
    document.querySelectorAll("#usersTable tbody tr").forEach(row => {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  };

  document.querySelectorAll(".user-key").forEach(btn => {
    btn.onclick = async () => {
      show("activationKeys");
      await renderActivation(btn.dataset.email, btn.dataset.uid);
    };
  });

  document.querySelectorAll(".user-membership").forEach(btn => {
    btn.onclick = async () => {
      show("memberships");
      await renderMembershipEditor(btn.dataset.email, btn.dataset.uid);
    };
  });
}

/* ---------------- Plans ---------------- */

function planSelectOptions(plans, selected = "") {
  return activePlans(plans).map(p =>
    `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.name || p.id)} — ${money(p.offerPrice ?? p.price)}</option>`
  ).join("");
}

function activePlans(plans) {
  return plans
    .filter(p => p.active !== false)
    .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
}

async function loadPlans() {
  const plans = (await readCollection("plans"))
    .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

  let rows = "";
  plans.forEach(p => {
    rows += `
      <tr>
        <td><code>${esc(p.id)}</code></td>
        <td><strong>${esc(p.name || "—")}</strong></td>
        <td>${money(p.price)}</td>
        <td>${money(p.offerPrice)}</td>
        <td>${p.durationDays === 0 ? "Lifetime" : esc(p.durationDays) + " days"}</td>
        <td>${p.shippingEnabled ? "Included" : "Off"}</td>
        <td>${esc(p.deviceLimit ?? 3)}</td>
        <td>${statusBadge(p.active === false ? "DISABLED" : "ACTIVE")}</td>
        <td class="row-actions">
          <button class="edit-plan" data-id="${esc(p.id)}">Edit</button>
          <button class="toggle-plan" data-id="${esc(p.id)}" data-active="${p.active !== false}">
            ${p.active === false ? "Enable" : "Disable"}
          </button>
          <button class="delete-plan danger-outline" data-id="${esc(p.id)}">Delete</button>
        </td>
      </tr>
    `;
  });

  $("plans").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Plans</h2>
        <p class="muted">Final pricing schema: price + offerPrice only.</p>
      </div>
      <button id="newPlan" class="primary compact-btn">+ Add Plan</button>
    </div>

    <div id="planEditor"></div>

    <div class="panel table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Price</th><th>Offer</th><th>Duration</th>
            <th>Shipping</th><th>Devices</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9">No plans found.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("newPlan").onclick = () => openPlanEditor({});
  document.querySelectorAll(".edit-plan").forEach(btn => {
    btn.onclick = async () => {
      const snap = await getDoc(doc(db, "plans", btn.dataset.id));
      if (snap.exists()) openPlanEditor({ id: snap.id, ...snap.data() });
    };
  });

  document.querySelectorAll(".toggle-plan").forEach(btn => {
    btn.onclick = async () => {
      const active = btn.dataset.active !== "true";
      await updateDoc(doc(db, "plans", btn.dataset.id), { active });
      toast(`Plan ${active ? "enabled" : "disabled"}.`);
      await loadPlans();
    };
  });

  document.querySelectorAll(".delete-plan").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm(`Delete plan "${btn.dataset.id}"?`)) return;
      await deleteDoc(doc(db, "plans", btn.dataset.id));
      toast("Plan deleted.");
      await loadPlans();
    };
  });
}

function planEditor(existing = {}) {
  return `
    <div class="panel form-panel">
      <div class="panel-title">
        <div>
          <h3>${existing.id ? "Edit Plan" : "Create Plan"}</h3>
          <p class="muted">Only the final approved plan fields are editable.</p>
        </div>
        <button id="cancelPlan" class="ghost">Cancel</button>
      </div>

      <form id="planForm" class="form-grid">
        <label>Plan ID
          <input id="planId" required value="${esc(existing.id || "")}" ${existing.id ? "readonly" : ""}>
        </label>

        <label>Plan Name
          <input id="planName" required value="${esc(existing.name || "")}">
        </label>

        <label>Price (₹)
          <input id="planPrice" type="number" min="0" step="1" required value="${esc(existing.price ?? "")}">
        </label>

        <label>Offer Price (₹)
          <input id="planOffer" type="number" min="0" step="1" required value="${esc(existing.offerPrice ?? "")}">
        </label>

        <label>Duration (Days)
          <input id="planDuration" type="number" min="0" step="1" required value="${esc(existing.durationDays ?? 0)}">
        </label>

        <label>Display Order
          <input id="planOrder" type="number" min="0" step="1" required value="${esc(existing.displayOrder ?? 1)}">
        </label>

        <label>Device Limit
          <input id="planDevices" type="number" min="1" step="1" required value="${esc(existing.deviceLimit ?? 3)}">
        </label>

        <label class="check-row">
          <input id="planShipping" type="checkbox" ${existing.shippingEnabled !== false ? "checked" : ""}>
          Shipping Optimizer Included
        </label>

        <label class="check-row">
          <input id="planActive" type="checkbox" ${existing.active !== false ? "checked" : ""}>
          Active
        </label>

        <div class="form-actions">
          <button class="primary small-btn" type="submit">Save Plan</button>
          <button id="cancelPlan2" class="ghost" type="button">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

function openPlanEditor(existing) {
  $("planEditor").innerHTML = planEditor(existing);
  $("cancelPlan").onclick = () => ($("planEditor").innerHTML = "");
  $("cancelPlan2").onclick = () => ($("planEditor").innerHTML = "");

  $("planForm").onsubmit = async e => {
    e.preventDefault();

    const id = $("planId").value.trim().toLowerCase();
    const name = $("planName").value.trim();
    const price = Number($("planPrice").value);
    const offerPrice = Number($("planOffer").value);
    const durationDays = Number($("planDuration").value);
    const displayOrder = Number($("planOrder").value);
    const deviceLimit = Number($("planDevices").value);

    if (!id || !name) return toast("Plan ID and name are required.", "error");
    if (![price, offerPrice, durationDays, displayOrder, deviceLimit].every(Number.isFinite)) {
      return toast("Invalid plan values.", "error");
    }
    if (price < 0 || offerPrice < 0 || durationDays < 0 || displayOrder < 0 || deviceLimit < 1) {
      return toast("Invalid plan values.", "error");
    }

    await setDoc(doc(db, "plans", id), {
      name,
      price,
      offerPrice,
      durationDays,
      displayOrder,
      active: $("planActive").checked,
      shippingEnabled: $("planShipping").checked,
      deviceLimit
    }, { merge: true });

    toast(existing.id ? "Plan updated." : "Plan created.");
    await loadPlans();
  };
}

/* ---------------- Activation Keys ---------------- */

async function renderActivation(prefillEmail = "", prefillUid = "") {
  const plans = activePlans(await readCollection("plans"));

  $("activationKeys").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Activation Keys</h2>
        <p class="muted">Generate a one-time Gmail-bound code after WhatsApp payment.</p>
      </div>
      <button id="activationRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel form-panel">
      <h3>Generate Activation</h3>

      <div class="form-grid">
        <label>Search Customer Gmail / Name / UID
          <input id="customerSearch" placeholder="Search existing customer">
        </label>

        <label>Customer Gmail
          <input id="actEmail" value="${esc(prefillEmail)}" placeholder="customer@gmail.com">
        </label>

        <label>Linked UID (optional)
          <input id="actUid" value="${esc(prefillUid)}" placeholder="Firebase UID">
        </label>

        <label>Plan
          <select id="actPlan">${planSelectOptions(plans)}</select>
        </label>

        <label>Key Valid For (Days)
          <input id="actKeyDays" type="number" min="1" value="7">
        </label>

        <label>Notes
          <input id="actNotes" placeholder="Optional">
        </label>

        <label class="check-row">
          <input id="actRenewal" type="checkbox">
          Renewal / Upgrade Key
        </label>
      </div>

      <div id="customerSearchResults" class="search-results"></div>
      <div id="actPreview" class="notice preview"></div>

      <div class="form-actions">
        <button id="generateAct" class="primary small-btn">Generate Activation Key</button>
      </div>

      <div id="generatedAct"></div>
    </div>

    <div class="panel table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Code</th><th>Customer</th><th>Plan</th><th>Status</th>
            <th>Key Expiry</th><th>Redeemed</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="activationRows"></tbody>
      </table>
    </div>
  `;

  const planMap = new Map(plans.map(p => [p.id, p]));

  function updatePreview() {
    const p = planMap.get($("actPlan").value);
    if (!p) {
      $("actPreview").textContent = "No active plan.";
      return;
    }
    $("actPreview").innerHTML = `
      <strong>${esc(p.name)}</strong> · Price ${money(p.price)} · Offer ${money(p.offerPrice)}
      · ${p.durationDays === 0 ? "Lifetime / Unlimited" : `${p.durationDays} days`}
      · Shipping ${p.shippingEnabled ? "Included" : "Off"}
      · Devices ${esc(p.deviceLimit ?? 3)}
    `;
  }

  $("actPlan").onchange = updatePreview;
  updatePreview();

  $("customerSearch").oninput = async () => {
    const term = $("customerSearch").value.trim().toLowerCase();
    if (term.length < 2) {
      $("customerSearchResults").innerHTML = "";
      return;
    }

    const users = await readCollection("users");
    const matches = users.filter(u =>
      [u.email, u.name, u.displayName, u.uid, u.id]
        .some(v => String(v || "").toLowerCase().includes(term))
    ).slice(0, 10);

    $("customerSearchResults").innerHTML = matches.length
      ? matches.map(u => `
        <button class="result-card" data-email="${esc(u.email || "")}" data-uid="${esc(u.id)}">
          <strong>${esc(u.name || u.displayName || "Customer")}</strong>
          <span>${esc(u.email || "—")}</span>
          <small>${esc(u.id)}</small>
        </button>
      `).join("")
      : `<div class="muted">No existing user found. You can enter a new Gmail manually.</div>`;

    document.querySelectorAll(".result-card").forEach(btn => {
      btn.onclick = () => {
        $("actEmail").value = btn.dataset.email;
        $("actUid").value = btn.dataset.uid;
        $("customerSearchResults").innerHTML = "";
      };
    });
  };

  $("generateAct").onclick = async () => {
    const email = normalizeEmail($("actEmail").value);
    const uid = $("actUid").value.trim();
    const plan = planMap.get($("actPlan").value);
    const keyDays = Number($("actKeyDays").value || 7);

    if (!validGmail(email)) return toast("Enter a valid Gmail.com address.", "error");
    if (!plan) return toast("Select an active plan.", "error");
    if (!Number.isInteger(keyDays) || keyDays < 1) return toast("Key validity must be at least 1 day.", "error");

    const code = generateKey();
    const start = Timestamp.now();
    const membershipExpiry = membershipPeriod(start, plan.durationDays);

    const data = {
      code,
      targetEmail: email,
      status: "AVAILABLE",

      planId: plan.id,
      planName: plan.name || plan.id,
      price: Number(plan.price || 0),
      offerPrice: Number(plan.offerPrice ?? plan.price ?? 0),
      durationDays: Number(plan.durationDays || 0),

      shippingEnabled: plan.shippingEnabled !== false,
      deviceLimit: Number(plan.deviceLimit ?? 3),

      keyExpiresAt: addDays(Timestamp.now(), keyDays),

      // These are kept as the approved schema snapshot fields.
      // They are not used as the customer's real start time until redemption.
      membershipStartAt: null,
      membershipExpiryAt: null,

      createdAt: serverTimestamp(),
      createdByUid: auth.currentUser?.uid || "",
      createdByEmail: auth.currentUser?.email || "",

      redeemedAt: null,
      redeemedByUid: null,
      redeemedEmail: null,

      renewal: $("actRenewal").checked,
      notes: $("actNotes").value.trim()
    };

    if (uid) data.targetUid = uid;

    await setDoc(doc(db, "activationKeys", code), data);

    const msg = [
      "Hello,",
      "",
      "Your MEESHO A+ LISTING AUTOMATION PRO activation details:",
      "",
      `Gmail: ${email}`,
      `Plan: ${data.planName}`,
      `Price: ${money(data.offerPrice)}`,
      `Duration: ${data.durationDays === 0 ? "Lifetime / Unlimited" : `${data.durationDays} Days`}`,
      `Shipping Optimizer: ${data.shippingEnabled ? "Included" : "Not Included"}`,
      `Device Limit: ${data.deviceLimit}`,
      `Activation Code: ${code}`,
      "",
      "Login with the same Google account and enter this activation code.",
      "",
      "Sohel Enterprise"
    ].join("\n");

    $("generatedAct").innerHTML = `
      <div class="generated">
        <div class="generated-code">${esc(code)}</div>
        <div class="generated-meta">${esc(email)} · ${esc(data.planName)} · ${esc(data.durationDays === 0 ? "Lifetime" : `${data.durationDays} days`)}</div>
        <div class="row-actions">
          <button id="copyAct">Copy Key</button>
          <button id="copyMsg">Copy WhatsApp Message</button>
          <button id="openWA">Open WhatsApp</button>
        </div>
      </div>
    `;

    $("copyAct").onclick = async () => {
      await navigator.clipboard.writeText(code);
      toast("Activation key copied.");
    };

    $("copyMsg").onclick = async () => {
      await navigator.clipboard.writeText(msg);
      toast("WhatsApp message copied.");
    };

    $("openWA").onclick = () => {
      window.open(`https://wa.me/9064827025?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    };

    toast("Activation key generated.");
    await loadActivationRows();
  };

  $("activationRefresh").onclick = loadActivationRows;
  await loadActivationRows();
}

async function loadActivationRows() {
  const keys = (await readCollection("activationKeys"))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  if (!$("activationRows")) return;

  $("activationRows").innerHTML = keys.length
    ? keys.map(k => `
      <tr>
        <td><code>${esc(k.code || k.id)}</code></td>
        <td>${esc(k.targetEmail || "—")}</td>
        <td>${esc(k.planName || k.planId || "—")}</td>
        <td>${statusBadge(k.status)}</td>
        <td>${esc(dateText(k.keyExpiresAt))}</td>
        <td>${k.redeemedAt ? esc(dateTimeText(k.redeemedAt)) : "Not redeemed"}</td>
        <td class="row-actions">
          <button class="copy-key" data-code="${esc(k.code || k.id)}">Copy</button>
          ${String(k.status || "").toUpperCase() === "AVAILABLE"
            ? `<button class="revoke-key danger-outline" data-code="${esc(k.code || k.id)}">Revoke</button>`
            : ""}
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="7">No activation keys yet.</td></tr>';

  document.querySelectorAll(".copy-key").forEach(btn => {
    btn.onclick = async () => {
      await navigator.clipboard.writeText(btn.dataset.code);
      toast("Key copied.");
    };
  });

  document.querySelectorAll(".revoke-key").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Revoke this activation key?")) return;
      await updateDoc(doc(db, "activationKeys", btn.dataset.code), {
        status: "REVOKED",
        revokedAt: serverTimestamp(),
        revokedByUid: auth.currentUser?.uid || ""
      });
      toast("Activation key revoked.");
      await loadActivationRows();
    };
  });
}

/* ---------------- Memberships ---------------- */

async function renderMembershipEditor(prefillEmail = "", prefillUid = "") {
  const plans = activePlans(await readCollection("plans"));

  $("memberships").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Memberships</h2>
        <p class="muted">Admin-only activate, renew, suspend and revoke controls.</p>
      </div>
      <button id="membershipRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel form-panel">
      <h3>Manual Activate / Update</h3>

      <div class="form-grid">
        <label>Customer Gmail
          <input id="memEmail" value="${esc(prefillEmail)}" placeholder="customer@gmail.com">
        </label>

        <label>Firebase UID
          <input id="memUid" value="${esc(prefillUid)}" placeholder="Existing logged-in customer UID">
        </label>

        <label>Plan
          <select id="memPlan">${planSelectOptions(plans)}</select>
        </label>

        <label>Start Date
          <input id="memStart" type="datetime-local">
        </label>
      </div>

      <div id="memPreview" class="notice preview"></div>
      <div class="form-actions">
        <button id="manualActivate" class="primary small-btn">Activate / Update Membership</button>
      </div>
    </div>

    <div class="panel">
      <input id="membershipSearch" class="search" placeholder="Search Gmail / UID / plan">
    </div>

    <div class="panel table-wrap">
      <table class="table" id="membershipTable">
        <thead>
          <tr>
            <th>Customer</th><th>Plan</th><th>Status</th><th>Start</th><th>Expiry</th>
            <th>Shipping</th><th>Devices</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="membershipRows"></tbody>
      </table>
    </div>
  `;

  $("memStart").value = dateTimeLocalValue();

  const planMap = new Map(plans.map(p => [p.id, p]));

  function preview() {
    const p = planMap.get($("memPlan").value);
    $("memPreview").innerHTML = p
      ? `${esc(p.name)} · ${money(p.offerPrice ?? p.price)} · ${p.durationDays === 0 ? "Lifetime / Unlimited" : `${p.durationDays} days`} · Shipping ${p.shippingEnabled ? "Included" : "Off"} · Devices ${esc(p.deviceLimit ?? 3)}`
      : "No active plan.";
  }

  $("memPlan").onchange = preview;
  preview();

  $("membershipRefresh").onclick = loadMembershipRows;

  $("manualActivate").onclick = async () => {
    const email = normalizeEmail($("memEmail").value);
    const uid = $("memUid").value.trim();
    const p = planMap.get($("memPlan").value);
    const start = tsFromInput($("memStart").value);

    if (!validGmail(email)) return toast("Enter a valid Gmail.com address.", "error");
    if (!uid) return toast("Firebase UID is required for manual admin activation.", "error");
    if (!p || !start) return toast("Plan and Start Date are required.", "error");

    const expiry = membershipPeriod(start, p.durationDays);

    await setDoc(doc(db, "memberships", uid), {
      uid,
      email,
      planId: p.id,
      planName: p.name || p.id,
      price: Number(p.price || 0),
      offerPrice: Number(p.offerPrice ?? p.price ?? 0),
      durationDays: Number(p.durationDays || 0),
      status: "ACTIVE",
      shippingEnabled: p.shippingEnabled !== false,
      deviceLimit: Number(p.deviceLimit ?? 3),
      startDate: start,
      expiryDate: expiry,
      activationKeyId: "",
      source: "ADMIN",
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    toast("Membership activated/updated.");
    await loadMembershipRows();
  };

  $("membershipSearch").oninput = filterTable("membershipTable");

  await loadMembershipRows();
}

function filterTable(tableId) {
  return () => {
    const q = document.getElementById(tableId.replace("Table", "Search"))?.value?.toLowerCase?.() || "";
    document.querySelectorAll(`#${tableId} tbody tr`).forEach(r => {
      r.style.display = !q || r.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  };
}

async function loadMembershipRows() {
  const memberships = await readCollection("memberships");

  if (!$("membershipRows")) return;

  $("membershipRows").innerHTML = memberships.length
    ? memberships.map(m => `
      <tr>
        <td><strong>${esc(m.email || "—")}</strong><br><span class="muted">${esc(m.uid || m.id)}</span></td>
        <td>${esc(m.planName || m.planId || "—")}</td>
        <td>${statusBadge(m.status)}</td>
        <td>${esc(dateText(m.startDate))}</td>
        <td>${m.expiryDate ? esc(dateText(m.expiryDate)) : "Lifetime"}</td>
        <td>${m.shippingEnabled ? "Included" : "Off"}</td>
        <td>${esc(m.deviceLimit ?? 3)}</td>
        <td class="row-actions">
          <button class="extend-member" data-uid="${esc(m.id)}">Extend</button>
          <button class="suspend-member" data-uid="${esc(m.id)}">Suspend</button>
          <button class="revoke-member danger-outline" data-uid="${esc(m.id)}">Revoke</button>
          <button class="edit-member" data-uid="${esc(m.id)}" data-email="${esc(m.email || "")}">Edit</button>
        </td>
      </tr>
    `).join("")
    : '<tr><td colspan="8">No memberships yet.</td></tr>';

  document.querySelectorAll(".extend-member").forEach(btn => {
    btn.onclick = async () => {
      const days = Number(prompt("Add how many days?", "30"));
      if (!Number.isInteger(days) || days <= 0) return;

      const ref = doc(db, "memberships", btn.dataset.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return toast("Membership not found.", "error");

      const m = snap.data();
      const currentExpiry = asDate(m.expiryDate);
      if (Number(m.durationDays) === 0) {
        toast("Lifetime membership does not need extending.", "error");
        return;
      }

      const base = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
      await updateDoc(ref, {
        expiryDate: addDays(base, days),
        status: "ACTIVE",
        updatedAt: serverTimestamp()
      });

      toast(`Membership extended by ${days} days.`);
      await loadMembershipRows();
    };
  });

  document.querySelectorAll(".suspend-member").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Suspend this membership?")) return;
      await updateDoc(doc(db, "memberships", btn.dataset.uid), {
        status: "SUSPENDED",
        updatedAt: serverTimestamp()
      });
      toast("Membership suspended.");
      await loadMembershipRows();
    };
  });

  document.querySelectorAll(".revoke-member").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Revoke this membership?")) return;
      await updateDoc(doc(db, "memberships", btn.dataset.uid), {
        status: "REVOKED",
        updatedAt: serverTimestamp()
      });
      toast("Membership revoked.");
      await loadMembershipRows();
    };
  });

  document.querySelectorAll(".edit-member").forEach(btn => {
    btn.onclick = async () => {
      const snap = await getDoc(doc(db, "memberships", btn.dataset.uid));
      if (!snap.exists()) return;
      const m = snap.data();
      $("memEmail").value = m.email || btn.dataset.email || "";
      $("memUid").value = btn.dataset.uid;
      await loadMembershipPlansIntoForm(m.planId);
      $("memStart").value = dateTimeLocalValue(m.startDate);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

async function loadMembershipPlansIntoForm(selectedId = "") {
  const plans = activePlans(await readCollection("plans"));
  const select = $("memPlan");
  if (select) select.innerHTML = planSelectOptions(plans, selectedId);
}

/* ---------------- Devices ---------------- */

async function loadDevices() {
  let sessions = [];
  try {
    const snap = await getDocs(query(collectionGroup(db, "sessions"), limit(500)));
    sessions = snap.docs.map(s => ({ id: s.id, path: s.ref.path, ...s.data() }));
  } catch (e) {
    console.error(e);
  }

  $("devices").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Devices</h2>
        <p class="muted">Maximum 3 active device slots per membership.</p>
      </div>
      <button id="devicesRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel">
      <input id="deviceSearch" class="search" placeholder="Search Gmail / UID / Device ID">
    </div>

    <div class="panel table-wrap">
      <table class="table" id="deviceTable">
        <thead>
          <tr><th>UID</th><th>Slot</th><th>Device</th><th>Platform</th><th>Status</th><th>Last Active</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${sessions.length ? sessions.map(s => {
            const parts = s.path.split("/");
            const uid = parts[1] || s.uid || "—";
            const slot = parts[3] || s.slot || "—";
            return `<tr>
              <td>${esc(uid)}</td>
              <td>${esc(slot)}</td>
              <td>${esc(s.deviceLabel || s.deviceId || "—")}</td>
              <td>${esc(s.platform || "—")}</td>
              <td>${statusBadge(s.status || "ACTIVE")}</td>
              <td>${esc(dateTimeText(s.lastActiveAt))}</td>
              <td class="row-actions">
                <button class="reset-device" data-path="${esc(s.path)}">Reset</button>
                <button class="block-device danger-outline" data-path="${esc(s.path)}">Block</button>
              </td>
            </tr>`;
          }).join("") : '<tr><td colspan="7">No device sessions yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  $("devicesRefresh").onclick = loadDevices;

  $("deviceSearch").oninput = () => {
    const q = $("deviceSearch").value.trim().toLowerCase();
    document.querySelectorAll("#deviceTable tbody tr").forEach(row => {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  };

  document.querySelectorAll(".reset-device").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Reset this device slot? The customer can use the slot again on another device.")) return;
      const segments = btn.dataset.path.split("/");
      if (segments.length !== 4) return;
      await deleteDoc(doc(db, "devices", segments[1], "sessions", segments[3]));
      toast("Device slot reset.");
      await loadDevices();
    };
  });

  document.querySelectorAll(".block-device").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Block this device?")) return;
      const segments = btn.dataset.path.split("/");
      if (segments.length !== 4) return;
      await updateDoc(doc(db, "devices", segments[1], "sessions", segments[3]), {
        status: "BLOCKED",
        updatedAt: serverTimestamp()
      });
      toast("Device blocked.");
      await loadDevices();
    };
  });
}

/* ---------------- Settings ---------------- */

async function loadSettings() {
  const snap = await getDoc(doc(db, "settings", "general"));
  const d = snap.exists() ? snap.data() : {};

  $("settings").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Settings</h2>
        <p class="muted">Final branding, support and WhatsApp configuration.</p>
      </div>
    </div>

    <div class="panel form-panel">
      <div class="form-grid">
        <label>App Name<input id="setAppName" value="${esc(d.appName || "MEESHO A+ LISTING AUTOMATION PRO")}"></label>
        <label>Brand Name<input id="setBrandName" value="${esc(d.brandName || "Sohel Enterprise")}"></label>
        <label>Support Name<input id="setSupportName" value="${esc(d.supportName || "Sohel Rana")}"></label>
        <label>Email<input id="setEmail" value="${esc(d.email || "sohelenterpriseofficial@gmail.com")}"></label>
        <label>Phone<input id="setPhone" value="${esc(d.phone || "9064827025")}"></label>
        <label>WhatsApp<input id="setWhatsApp" value="${esc(d.whatsapp || "9064827025")}"></label>
        <label>Payment Mode<input id="setPaymentMode" value="${esc(d.paymentMode || "WHATSAPP")}"></label>
      </div>

      <div class="form-actions">
        <button id="saveSettings" class="primary small-btn">Save Settings</button>
      </div>
    </div>
  `;

  $("saveSettings").onclick = async () => {
    await setDoc(doc(db, "settings", "general"), {
      appName: $("setAppName").value.trim(),
      brandName: $("setBrandName").value.trim(),
      supportName: $("setSupportName").value.trim(),
      email: $("setEmail").value.trim(),
      phone: $("setPhone").value.trim(),
      whatsapp: $("setWhatsApp").value.trim(),
      paymentMode: $("setPaymentMode").value.trim() || "WHATSAPP"
    }, { merge: true });

    toast("Settings saved.");
  };
}

/* ---------------- Navigation / Auth ---------------- */

document.querySelectorAll(".nav").forEach(nav => {
  nav.onclick = async () => {
    show(nav.dataset.section);
    try {
      if (nav.dataset.section === "dashboard") await loadDashboard();
      if (nav.dataset.section === "users") await loadUsers();
      if (nav.dataset.section === "plans") await loadPlans();
      if (nav.dataset.section === "activationKeys") await renderActivation();
      if (nav.dataset.section === "memberships") await renderMembershipEditor();
      if (nav.dataset.section === "devices") await loadDevices();
      if (nav.dataset.section === "settings") await loadSettings();
    } catch (e) {
      console.error(e);
      toast(e.message || "Unable to load this section.", "error");
    }
  };
});

$("googleLogin").onclick = async () => {
  $("loginError").textContent = "";
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    $("loginError").textContent = e.message || "Google sign-in failed.";
  }
};

$("logout").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  if (!user) {
    $("loginView").classList.remove("hidden");
    $("adminView").classList.add("hidden");
    return;
  }

  try {
    if (!(await isAdmin(user))) {
      await signOut(auth);
      $("loginError").textContent = "This Google account is not an authorized admin.";
      return;
    }

    $("adminEmail").textContent = user.email || "";
    $("loginView").classList.add("hidden");
    $("adminView").classList.remove("hidden");

    show("dashboard");
    await loadDashboard();
  } catch (e) {
    console.error(e);
    await signOut(auth);
    $("loginError").textContent = "Admin verification failed: " + (e.message || "unknown error");
  }
});
