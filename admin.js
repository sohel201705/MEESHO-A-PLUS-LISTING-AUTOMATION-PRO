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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));

const money = value => {
  const n = Number(value);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
};

const toJsDate = value => {
  try {
    if (!value) return null;
    const d = value.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const dateText = value => {
  const d = toJsDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const dateTimeText = value => {
  const d = toJsDate(value);
  if (!d) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const toTimestamp = value => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
};

function show(id) {
  document.querySelectorAll(".section").forEach(x => x.classList.add("hidden"));
  const section = $(id);
  if (section) section.classList.remove("hidden");

  document.querySelectorAll(".nav").forEach(x =>
    x.classList.toggle("active", x.dataset.section === id)
  );
}

async function isAdmin(user) {
  const snap = await getDoc(doc(db, "admins", user.uid));
  return snap.exists() && snap.data().active === true;
}

function computedMembershipStatus(d) {
  const raw = String(d?.status || '').toUpperCase();
  if (raw === 'SUSPENDED' || raw === 'REVOKED') return raw;
  const expiry = toJsDate(d?.expiryDate);
  const duration = Number(d?.durationDays ?? -1);
  if (expiry && expiry.getTime() < Date.now()) return 'EXPIRED';
  if (duration === 0 || raw === 'ACTIVE') return 'ACTIVE';
  if (!raw) return 'INACTIVE';
  return raw;
}

function daysRemaining(d) {
  if (Number(d?.durationDays ?? -1) === 0 || !d?.expiryDate) return null;
  const expiry = toJsDate(d.expiryDate);
  if (!expiry) return null;
  return Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000));
}

function statusBadge(status) {
  const value = String(status || "UNKNOWN").toUpperCase();
  const lower = value.toLowerCase();
  const cls =
    lower === "active" || lower === "enabled" || lower === "approved"
      ? "active"
      : lower === "expired" || lower === "disabled" || lower === "rejected"
      ? "expired"
      : "pending";

  return `<span class="badge ${cls}">${esc(value)}</span>`;
}

function toast(message, type = "success") {
  const old = document.querySelector(".toast");
  if (old) old.remove();

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2600);
}

async function loadDashboard() {
  const [users, memberships, plans, promoCodes] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(500))),
    getDocs(query(collection(db, "memberships"), limit(500))),
    getDocs(query(collection(db, "plans"), limit(500))),
    getDocs(query(collection(db, "promoCodes"), limit(500)))
  ]);

  let active = 0;
  let expired = 0;
  let lifetime = 0;
  let activePlans = 0;
  let activePromos = 0;

  memberships.forEach(s => {
    const d = s.data();
    const status = computedMembershipStatus(d);
    if (status === "ACTIVE") active++;
    if (status === "EXPIRED") expired++;
    if (String(d.planId || "").toLowerCase() === "lifetime" || Number(d.durationDays || 0) === 0) lifetime++;
  });


  plans.forEach(s => {
    if (s.data().active !== false) activePlans++;
  });

  promoCodes.forEach(s => {
    if (s.data().active !== false) activePromos++;
  });

  $("dashboard").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Dashboard</h2>
        <p class="muted">MEESHO A+ membership administration</p>
      </div>
      <button id="dashboardRefresh" class="ghost">Refresh</button>
    </div>

    <div class="grid">
      <div class="stat"><span>Users</span><b>${users.size}</b></div>
      <div class="stat"><span>Active Members</span><b>${active}</b></div>
      <div class="stat"><span>Expired</span><b>${expired}</b></div>
      <div class="stat"><span>Lifetime</span><b>${lifetime}</b></div>
      <div class="stat"><span>Active Plans</span><b>${activePlans}</b></div>
      <div class="stat"><span>Active Promo Codes</span><b>${activePromos}</b></div>
      <div class="stat"><span>Activation Mode</span><b>WHATSAPP</b></div>
    </div>

    <div class="panel">
      <div class="notice">
        Admin data is protected by Firestore Rules. Only authorized admin UIDs
        with <b>active: true</b> can use this panel.
      </div>
    </div>
  `;

  $("dashboardRefresh").onclick = () => loadDashboard();
}

async function loadUsers() {
  const [snap, membershipSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(500))),
    getDocs(query(collection(db, "memberships"), limit(500)))
  ]);
  const membershipMap = new Map();
  membershipSnap.forEach(s => membershipMap.set(s.id, { id:s.id, ...s.data() }));
  let rows = "";

  snap.forEach(s => {
    const d = s.data();
    const m = membershipMap.get(s.id) || null;
    const status = m ? computedMembershipStatus(m) : "INACTIVE";
    const planName = m?.planName || m?.planId || d.planName || d.planId || "—";
    rows += `
      <tr>
        <td><strong>${esc(d.name || d.displayName || "-")}</strong><div class="muted tiny">${esc(s.id)}</div></td>
        <td>${esc(d.email || "-")}</td>
        <td>${esc(planName)}</td>
        <td>${statusBadge(status)}</td>
        <td>${esc(dateTimeText(d.lastLoginAt))}</td>
        <td class="row-actions">
          <button data-user="${esc(s.id)}" class="activate-user">Activate</button>
          <button data-user="${esc(s.id)}" class="extend">Extend</button>
          <button data-user="${esc(s.id)}" class="suspend">Suspend</button>
        </td>
      </tr>
    `;
  });

  $("users").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Users</h2>
        <p class="muted">Customer accounts, live membership status and activation controls</p>
      </div>
      <button id="usersRefresh" class="ghost">Refresh</button>
    </div>
    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>User</th><th>Email</th><th>Plan</th><th>Status</th>
            <th>Last Login</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6">No users yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("usersRefresh").onclick = loadUsers;

  document.querySelectorAll(".activate-user").forEach(btn => {
    btn.onclick = async () => {
      try {
        show("memberships");
        await loadMemberships();
        await openActivateMembershipForm(btn.dataset.user);
      } catch (e) {
        toast(e.message || "Could not open activation form.", "error");
      }
    };
  });

  document.querySelectorAll(".suspend").forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.user;
      if (!confirm("Suspend this user and their membership?")) return;
      await updateDoc(doc(db, "users", uid), {
        status: "SUSPENDED",
        membershipStatus: "SUSPENDED",
        updatedAt: serverTimestamp()
      });
      const membershipSnap = await getDoc(doc(db, "memberships", uid));
      if (membershipSnap.exists()) {
        await updateDoc(doc(db, "memberships", uid), { status: "SUSPENDED", updatedAt: serverTimestamp() });
      }
      toast("User suspended.");
      await Promise.all([loadUsers(), loadMemberships(), loadDashboard()]);
    };
  });

  document.querySelectorAll(".extend").forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.user;
      const days = prompt("How many days should be added?", "30");
      const n = Number(days);
      if (!Number.isFinite(n) || n <= 0) return;
      const membershipRef = doc(db, "memberships", uid);
      const ms = await getDoc(membershipRef);
      if (!ms.exists()) {
        toast("No membership found. Use Activate first.", "error");
        return;
      }
      const m = ms.data();
      if (Number(m.durationDays ?? -1) === 0 || !m.expiryDate) {
        toast("Lifetime / Unlimited membership does not need extension.", "error");
        return;
      }
      let expiry = toJsDate(m.expiryDate) || new Date();
      if (expiry < new Date()) expiry = new Date();
      expiry.setDate(expiry.getDate() + n);
      await updateDoc(membershipRef, {
        expiryDate: Timestamp.fromDate(expiry),
        status: "ACTIVE",
        updatedAt: serverTimestamp()
      });
      await updateDoc(doc(db, "users", uid), {
        membershipExpiry: Timestamp.fromDate(expiry),
        membershipStatus: "ACTIVE",
        status: "ACTIVE",
        updatedAt: serverTimestamp()
      });
      toast(`Membership extended by ${n} days.`);
      await Promise.all([loadUsers(), loadMemberships(), loadDashboard()]);
    };
  });
}

function planForm(existing = {}) {
  return `
    <div class="panel form-panel">
      <div class="panel-title">
        <div>
          <h3>${existing.id ? "Edit Plan" : "Create Plan"}</h3>
          <p class="muted">Pricing and duration are controlled here. Customer payment is handled manually in WhatsApp.</p>
        </div>
        <button id="cancelPlan" class="ghost">Cancel</button>
      </div>

      <form id="planForm" class="form-grid">
        <label>Plan ID
          <input id="planId" required value="${esc(existing.id || "")}"
                 ${existing.id ? "readonly" : ""}
                 placeholder="monthly">
        </label>

        <label>Plan Name
          <input id="planName" required value="${esc(existing.name || "")}"
                 placeholder="Monthly">
        </label>

        <label>Customer Description
          <input id="planDescription" value="${esc(existing.description || "")}"
                 placeholder="Full access for 30 days">
        </label>

        <label>Regular Price (₹)
          <input id="regularPrice" type="number" min="0" step="0.01"
                 value="${esc(existing.regularPrice ?? existing.price ?? "")}"
                 placeholder="0">
        </label>

        <label>Offer Price (₹)
          <input id="offerPrice" type="number" min="0" step="0.01"
                 value="${esc(existing.offerPrice ?? "")}"
                 placeholder="Optional">
        </label>

        <label>Discount %
          <input id="discountPercent" type="number" min="0" max="100" step="0.01"
                 value="${esc(existing.discountPercent ?? "")}"
                 placeholder="Optional">
        </label>

        <label>Plan Type
          <select id="planType">
            <option value="custom">Custom duration</option>
            <option value="monthly">Monthly — 30 days</option>
            <option value="yearly">Yearly — 365 days</option>
            <option value="lifetime">Lifetime / Unlimited — No Expiry</option>
          </select>
        </label>

        <label>Duration (Days)
          <input id="durationDays" type="number" min="0" step="1"
                 value="${esc(existing.durationDays ?? "")}"
                 placeholder="Lifetime = 0">
        </label>

        <label>Display Order
          <input id="displayOrder" type="number" min="0" step="1"
                 value="${esc(existing.displayOrder ?? 0)}">
        </label>

        <label>Offer Start
          <input id="offerStart" type="datetime-local"
                 value="${esc(existing.offerStartAt?.toDate ? existing.offerStartAt.toDate().toISOString().slice(0,16) : "")}">
        </label>

        <label>Offer End
          <input id="offerEnd" type="datetime-local"
                 value="${esc(existing.offerEndAt?.toDate ? existing.offerEndAt.toDate().toISOString().slice(0,16) : "")}">
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

async function loadPlans() {
  const snap = await getDocs(query(collection(db, "plans"), limit(500)));
  const plans = [];

  snap.forEach(s => plans.push({ id: s.id, ...s.data() }));
  plans.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

  let rows = "";

  plans.forEach(d => {
    const current = d.offerPrice ?? d.price ?? "";
    rows += `
      <tr>
        <td><code>${esc(d.id)}</code></td>
        <td><strong>${esc(d.name || "-")}</strong></td>
        <td>${money(d.regularPrice ?? d.price)}</td>
        <td>${money(d.offerPrice)}</td>
        <td>${esc(d.discountPercent ?? 0)}%</td>
        <td>${Number(d.durationDays || 0) === 0 ? "Unlimited" : `${esc(d.durationDays)} days`}</td>
        <td>${statusBadge(d.active === false ? "DISABLED" : "ACTIVE")}</td>
        <td class="row-actions">
          <button class="edit-plan" data-id="${esc(d.id)}">Edit</button>
          <button class="toggle-plan" data-id="${esc(d.id)}" data-active="${d.active !== false}">
            ${d.active === false ? "Enable" : "Disable"}
          </button>
          <button class="delete-plan danger-outline" data-id="${esc(d.id)}">Delete</button>
        </td>
      </tr>
    `;
  });

  $("plans").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Plans</h2>
        <p class="muted">Create and control membership plans. Customers purchase through WhatsApp; you activate them here.</p>
      </div>
      <div class="head-actions">
        <button id="newPlan" class="primary compact-btn">+ Add Plan</button>
        <button id="plansRefresh" class="ghost">Refresh</button>
      </div>
    </div>

    <div id="planEditor"></div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Regular</th><th>Offer</th>
            <th>Discount</th><th>Days</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8">No plans yet. Click + Add Plan.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("plansRefresh").onclick = loadPlans;
  $("newPlan").onclick = () => openPlanEditor({});

  document.querySelectorAll(".edit-plan").forEach(btn => {
    btn.onclick = async () => {
      const s = await getDoc(doc(db, "plans", btn.dataset.id));
      if (s.exists()) openPlanEditor({ id: s.id, ...s.data() });
    };
  });

  document.querySelectorAll(".toggle-plan").forEach(btn => {
    btn.onclick = async () => {
      await updateDoc(doc(db, "plans", btn.dataset.id), {
        active: btn.dataset.active !== "true",
        updatedAt: serverTimestamp()
      });
      toast("Plan status updated.");
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

function openPlanEditor(existing) {
  $("planEditor").innerHTML = planForm(existing);

  $("cancelPlan").onclick = () => ($("planEditor").innerHTML = "");
  $("cancelPlan2").onclick = () => ($("planEditor").innerHTML = "");

  const preset = $("planType");
  if (preset) {
    const existingDuration = Number(existing.durationDays ?? -1);
    preset.value = existingDuration === 30 ? "monthly" : existingDuration === 365 ? "yearly" : existingDuration === 0 ? "lifetime" : "custom";
    preset.onchange = () => {
      const map = { monthly: 30, yearly: 365, lifetime: 0 };
      if (preset.value in map) $("durationDays").value = map[preset.value];
    };
  }

  $("planForm").onsubmit = async event => {
    event.preventDefault();

    const id = $("planId").value.trim().toLowerCase().replace(/\s+/g, "-");
    const name = $("planName").value.trim();
    const description = $("planDescription").value.trim();
    const regularPrice = Number($("regularPrice").value || 0);
    const offerRaw = $("offerPrice").value.trim();
    const offerPrice = offerRaw === "" ? null : Number(offerRaw);
    const discountRaw = $("discountPercent").value.trim();
    const discountPercent = discountRaw === "" ? 0 : Number(discountRaw);
    const durationDays = Number($("durationDays").value || 0);
    const displayOrder = Number($("displayOrder").value || 0);

    if (!id || !name) {
      alert("Plan ID and Plan Name are required.");
      return;
    }

    if (!Number.isFinite(regularPrice) || regularPrice < 0) {
      alert("Invalid regular price.");
      return;
    }

    if (offerPrice !== null && (!Number.isFinite(offerPrice) || offerPrice < 0)) {
      alert("Invalid offer price.");
      return;
    }

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      alert("Discount must be between 0 and 100.");
      return;
    }

    if (!Number.isFinite(durationDays) || durationDays < 0) {
      alert("Invalid duration.");
      return;
    }

    const startAt = toTimestamp($("offerStart").value);
    const endAt = toTimestamp($("offerEnd").value);

    if (startAt && endAt && endAt.toMillis() < startAt.toMillis()) {
      alert("Offer End must be after Offer Start.");
      return;
    }

    const data = {
      name,
      description,
      regularPrice,
      price: offerPrice ?? regularPrice,
      offerPrice,
      discountPercent,
      durationDays,
      displayOrder,
      active: $("planActive").checked,
      offerStartAt: startAt,
      offerEndAt: endAt,
      updatedAt: serverTimestamp()
    };

    if (!existing.id) data.createdAt = serverTimestamp();

    await setDoc(doc(db, "plans", id), data, { merge: true });
    toast(existing.id ? "Plan updated." : "Plan created.");
    await loadPlans();
  };
}

function promoForm(existing = {}, planOptions = []) {
  const selectedPlans = Array.isArray(existing.applicablePlans)
    ? existing.applicablePlans
    : [];

  return `
    <div class="panel form-panel">
      <div class="panel-title">
        <div>
          <h3>${existing.id ? "Edit Promo Code" : "Create Promo Code"}</h3>
          <p class="muted">Promo codes are stored in the promoCodes collection.</p>
        </div>
        <button id="cancelPromo" class="ghost">Cancel</button>
      </div>

      <form id="promoForm" class="form-grid">
        <label>Promo Code
          <input id="promoCode" required value="${esc(existing.id || "")}"
                 ${existing.id ? "readonly" : ""}
                 placeholder="WELCOME10">
        </label>

        <label>Discount Type
          <select id="discountType">
            <option value="percentage" ${existing.discountType === "percentage" ? "selected" : ""}>Percentage (%)</option>
            <option value="fixed" ${existing.discountType === "fixed" ? "selected" : ""}>Fixed (₹)</option>
          </select>
        </label>

        <label>Discount Value
          <input id="promoValue" type="number" min="0" step="0.01"
                 required value="${esc(existing.discountValue ?? "")}">
        </label>

        <label>Minimum Amount (₹)
          <input id="minimumAmount" type="number" min="0" step="0.01"
                 value="${esc(existing.minimumAmount ?? 0)}">
        </label>

        <label>Maximum Discount (₹)
          <input id="maximumDiscount" type="number" min="0" step="0.01"
                 value="${esc(existing.maximumDiscount ?? "")}"
                 placeholder="Optional">
        </label>

        <label>Usage Limit
          <input id="usageLimit" type="number" min="0" step="1"
                 value="${esc(existing.usageLimit ?? 0)}"
                 placeholder="0 = unlimited">
        </label>

        <label>Per User Limit
          <input id="perUserLimit" type="number" min="0" step="1"
                 value="${esc(existing.perUserLimit ?? 1)}">
        </label>

        <label>Start Date
          <input id="promoStart" type="datetime-local"
                 value="${esc(existing.startAt?.toDate ? existing.startAt.toDate().toISOString().slice(0,16) : "")}">
        </label>

        <label>Expiry Date
          <input id="promoEnd" type="datetime-local"
                 value="${esc(existing.endAt?.toDate ? existing.endAt.toDate().toISOString().slice(0,16) : "")}">
        </label>

        <div class="full-width">
          <div class="field-label">Applicable Plans</div>
          <div class="plan-checks">
            ${
              planOptions.length
                ? planOptions.map(p => `
                    <label class="check-pill">
                      <input type="checkbox" class="promo-plan"
                        value="${esc(p.id)}"
                        ${selectedPlans.includes(p.id) ? "checked" : ""}>
                      ${esc(p.name || p.id)}
                    </label>
                  `).join("")
                : `<span class="muted">Create Plans first.</span>`
            }
          </div>
        </div>

        <label class="check-row">
          <input id="promoActive" type="checkbox" ${existing.active !== false ? "checked" : ""}>
          Active
        </label>

        <div class="form-actions">
          <button class="primary small-btn" type="submit">Save Promo Code</button>
          <button id="cancelPromo2" class="ghost" type="button">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

async function loadPromoCodes() {
  const [promoSnap, planSnap] = await Promise.all([
    getDocs(query(collection(db, "promoCodes"), limit(500))),
    getDocs(query(collection(db, "plans"), limit(500)))
  ]);

  const plans = [];
  planSnap.forEach(s => plans.push({ id: s.id, ...s.data() }));
  plans.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

  const promos = [];
  promoSnap.forEach(s => promos.push({ id: s.id, ...s.data() }));

  promos.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  let rows = "";

  promos.forEach(d => {
    const plansText =
      Array.isArray(d.applicablePlans) && d.applicablePlans.length
        ? d.applicablePlans.join(", ")
        : "All plans";

    const value =
      d.discountType === "percentage"
        ? `${d.discountValue ?? 0}%`
        : money(d.discountValue);

    rows += `
      <tr>
        <td><strong>${esc(d.id)}</strong></td>
        <td>${esc(d.discountType || "percentage")}</td>
        <td>${esc(value)}</td>
        <td>${esc(plansText)}</td>
        <td>${money(d.minimumAmount || 0)}</td>
        <td>${esc(d.usageLimit || "∞")}</td>
        <td>${esc(d.perUserLimit || "∞")}</td>
        <td>${esc(dateText(d.endAt))}</td>
        <td>${statusBadge(d.active === false ? "DISABLED" : "ACTIVE")}</td>
        <td class="row-actions">
          <button class="edit-promo" data-id="${esc(d.id)}">Edit</button>
          <button class="toggle-promo" data-id="${esc(d.id)}" data-active="${d.active !== false}">
            ${d.active === false ? "Enable" : "Disable"}
          </button>
          <button class="delete-promo danger-outline" data-id="${esc(d.id)}">Delete</button>
        </td>
      </tr>
    `;
  });

  $("promoCodes").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Promo Codes</h2>
        <p class="muted">Create discounts and control where they can be used.</p>
      </div>
      <div class="head-actions">
        <button id="newPromo" class="primary compact-btn">+ Add Promo Code</button>
        <button id="promoRefresh" class="ghost">Refresh</button>
      </div>
    </div>

    <div id="promoEditor"></div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr>
            <th>Code</th><th>Type</th><th>Discount</th><th>Plans</th>
            <th>Min Amount</th><th>Usage</th><th>Per User</th>
            <th>Expiry</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="10">No promo codes yet. Click + Add Promo Code.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("promoRefresh").onclick = loadPromoCodes;
  $("newPromo").onclick = () => openPromoEditor({}, plans);

  document.querySelectorAll(".edit-promo").forEach(btn => {
    btn.onclick = async () => {
      const s = await getDoc(doc(db, "promoCodes", btn.dataset.id));
      if (s.exists()) openPromoEditor({ id: s.id, ...s.data() }, plans);
    };
  });

  document.querySelectorAll(".toggle-promo").forEach(btn => {
    btn.onclick = async () => {
      await updateDoc(doc(db, "promoCodes", btn.dataset.id), {
        active: btn.dataset.active !== "true",
        updatedAt: serverTimestamp()
      });
      toast("Promo code status updated.");
      await loadPromoCodes();
    };
  });

  document.querySelectorAll(".delete-promo").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm(`Delete promo code "${btn.dataset.id}"?`)) return;
      await deleteDoc(doc(db, "promoCodes", btn.dataset.id));
      toast("Promo code deleted.");
      await loadPromoCodes();
    };
  });
}

function openPromoEditor(existing, plans) {
  $("promoEditor").innerHTML = promoForm(existing, plans);

  $("cancelPromo").onclick = () => ($("promoEditor").innerHTML = "");
  $("cancelPromo2").onclick = () => ($("promoEditor").innerHTML = "");

  $("promoForm").onsubmit = async event => {
    event.preventDefault();

    const id = $("promoCode").value.trim().toUpperCase().replace(/\s+/g, "");
    const discountType = $("discountType").value;
    const discountValue = Number($("promoValue").value);
    const minimumAmount = Number($("minimumAmount").value || 0);
    const maxRaw = $("maximumDiscount").value.trim();
    const maximumDiscount = maxRaw === "" ? null : Number(maxRaw);
    const usageLimit = Number($("usageLimit").value || 0);
    const perUserLimit = Number($("perUserLimit").value || 0);
    const startAt = toTimestamp($("promoStart").value);
    const endAt = toTimestamp($("promoEnd").value);
    const applicablePlans = [...document.querySelectorAll(".promo-plan:checked")].map(x => x.value);

    if (!id) {
      alert("Promo code is required.");
      return;
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      alert("Discount value must be greater than 0.");
      return;
    }

    if (discountType === "percentage" && discountValue > 100) {
      alert("Percentage discount cannot exceed 100%.");
      return;
    }

    if (minimumAmount < 0 || usageLimit < 0 || perUserLimit < 0) {
      alert("Invalid numeric value.");
      return;
    }

    if (maximumDiscount !== null && maximumDiscount < 0) {
      alert("Invalid maximum discount.");
      return;
    }

    if (startAt && endAt && endAt.toMillis() < startAt.toMillis()) {
      alert("Expiry Date must be after Start Date.");
      return;
    }

    const data = {
      code: id,
      discountType,
      discountValue,
      minimumAmount,
      maximumDiscount,
      usageLimit,
      perUserLimit,
      applicablePlans,
      startAt,
      endAt,
      active: $("promoActive").checked,
      updatedAt: serverTimestamp()
    };

    if (!existing.id) {
      data.createdAt = serverTimestamp();
      data.usedCount = 0;
    }

    await setDoc(doc(db, "promoCodes", id), data, { merge: true });

    toast(existing.id ? "Promo code updated." : "Promo code created.");
    await loadPromoCodes();
  };
}

function membershipExpiryText(plan, startDate) {
  const days = Math.max(0, Number(plan?.durationDays ?? 0) || 0);
  if (days === 0) return { expiry: null, label: 'NEVER — Lifetime / Unlimited' };
  const expiry = new Date(startDate.getTime());
  expiry.setDate(expiry.getDate() + days);
  return { expiry, label: expiry.toLocaleDateString('en-IN') };
}

async function activateMembershipForUid(uid, planId, options = {}) {
  if (!uid) throw new Error('User is required.');
  if (!planId) throw new Error('Plan is required.');

  const userRef = doc(db, 'users', uid);
  const membershipRef = doc(db, 'memberships', uid);
  const [userSnap, planSnap, membershipSnap] = await Promise.all([
    getDoc(userRef),
    getDoc(doc(db, 'plans', planId)),
    getDoc(membershipRef)
  ]);

  if (!userSnap.exists()) throw new Error('User account not found. Ask the customer to sign in once with Google.');
  if (!planSnap.exists()) throw new Error('Selected plan does not exist.');
  const plan = planSnap.data();
  if (plan.active === false) throw new Error('This plan is disabled. Enable it first.');

  const previous = membershipSnap.exists() ? membershipSnap.data() : null;
  const now = new Date();
  let startDate = now;

  if (options.renewFromCurrent && previous?.expiryDate) {
    const prevExpiry = previous.expiryDate.toDate ? previous.expiryDate.toDate() : new Date(previous.expiryDate);
    if (!Number.isNaN(prevExpiry.getTime()) && prevExpiry > now) startDate = prevExpiry;
  }

  const result = membershipExpiryText(plan, startDate);
  const durationDays = Math.max(0, Number(plan.durationDays ?? 0) || 0);
  const planName = String(plan.name || planId);
  const adminUid = auth.currentUser?.uid || null;

  await setDoc(membershipRef, {
    uid,
    planId,
    planName,
    durationDays,
    status: 'ACTIVE',
    startDate: Timestamp.fromDate(startDate),
    expiryDate: result.expiry ? Timestamp.fromDate(result.expiry) : null,
    activationSource: 'WHATSAPP_MANUAL',
    activatedBy: adminUid,
    activatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    adminNote: String(options.note || '')
  }, { merge: true });

  await setDoc(userRef, {
    status: 'ACTIVE',
    membershipStatus: 'ACTIVE',
    planId,
    planName,
    membershipStart: Timestamp.fromDate(startDate),
    membershipExpiry: result.expiry ? Timestamp.fromDate(result.expiry) : null,
    membershipActivatedAt: serverTimestamp(),
    membershipSource: 'WHATSAPP_MANUAL',
    updatedAt: serverTimestamp()
  }, { merge: true });

  return { plan, startDate, expiry: result.expiry };
}

async function openActivateMembershipForm(presetUid = '') {
  const editor = $('membershipEditor');
  if (!editor) return;
  editor.innerHTML = '<div class="panel"><div class="muted">Loading users and plans…</div></div>';

  const [userSnap, planSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), limit(500))),
    getDocs(query(collection(db, 'plans'), limit(500)))
  ]);

  const users = [];
  userSnap.forEach(s => users.push({ id: s.id, ...s.data() }));
  users.sort((a, b) => String(a.email || a.name || a.id).localeCompare(String(b.email || b.name || b.id)));

  const plans = [];
  planSnap.forEach(s => {
    const d = s.data();
    if (d.active !== false) plans.push({ id: s.id, ...d });
  });
  plans.sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

  if (!users.length) {
    editor.innerHTML = '<div class="panel"><div class="notice">No customer accounts yet. Ask the customer to log in with Google from the extension once, then refresh Users.</div></div>';
    return;
  }
  if (!plans.length) {
    editor.innerHTML = '<div class="panel"><div class="notice">No active plans available. Create/enable a plan in Plans first.</div></div>';
    return;
  }

  const userOptions = users.map(u => `<option value="${esc(u.id)}" ${u.id === presetUid ? 'selected' : ''}>${esc(u.email || u.name || u.id)} — ${esc(u.id)}</option>`).join('');
  const planOptions = plans.map(p => `<option value="${esc(p.id)}">${esc(p.name || p.id)} — ${Number(p.durationDays || 0) === 0 ? 'Lifetime / Unlimited' : `${esc(p.durationDays)} days`} — ${money(p.offerPrice > 0 ? p.offerPrice : p.regularPrice ?? p.price)}</option>`).join('');

  editor.innerHTML = `
    <div class="panel form-panel">
      <div class="panel-title">
        <div>
          <h3>Activate Membership Manually</h3>
          <p class="muted">Customer pays in WhatsApp. After you verify payment, choose the user and plan here and activate access.</p>
        </div>
        <button id="cancelMembershipActivation" class="ghost" type="button">Cancel</button>
      </div>
      <form id="membershipActivationForm" class="form-grid">
        <label>Customer
          <select id="activationUid" required>${userOptions}</select>
        </label>
        <div class="notice full-width" id="activationIdentityHint">Choose the exact Google account that the customer used in the extension. Membership is linked by Firebase UID.</div>
        <label>Plan
          <select id="activationPlanId" required>${planOptions}</select>
        </label>
        <label class="check-row full-width">
          <input type="checkbox" id="renewFromCurrent" checked>
          Renewal: start the new paid plan after the current active expiry when applicable
        </label>
        <label class="full-width">Admin Note
          <textarea id="activationNote" rows="3" placeholder="Example: WhatsApp payment verified on 05-Oct-2026."></textarea>
        </label>
        <div class="form-actions full-width">
          <button class="primary small-btn" type="submit">Approve &amp; Activate Membership</button>
        </div>
      </form>
      <div id="activationPreview" class="notice" style="margin-top:14px;">Select a user and plan.</div>
    </div>
  `;

  const updatePreview = async () => {
    const uid = $('activationUid').value;
    const planId = $('activationPlanId').value;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    let currentText = '';
    const ms = uid ? await getDoc(doc(db, 'memberships', uid)) : null;
    if (ms?.exists()) {
      const md = ms.data();
      currentText = md.expiryDate ? ` Current expiry: ${dateText(md.expiryDate)}.` : ' Current membership is lifetime/unlimited.';
    }
    const days = Math.max(0, Number(plan.durationDays || 0));
    $('activationPreview').textContent = days === 0
      ? `Selected: ${plan.name || plan.id} — Lifetime / Unlimited. Activation starts now.${currentText}`
      : `Selected: ${plan.name || plan.id} — ${days} days. Activation will start now or after the current expiry when Renewal is checked.${currentText}`;
  };

  $('activationUid').onchange = updatePreview;
  $('activationPlanId').onchange = updatePreview;
  $('cancelMembershipActivation').onclick = () => { editor.innerHTML = ''; };
  $('membershipActivationForm').onsubmit = async event => {
    event.preventDefault();
    const uid = $('activationUid').value;
    const planId = $('activationPlanId').value;
    try {
      const result = await activateMembershipForUid(uid, planId, {
        renewFromCurrent: $('renewFromCurrent').checked,
        note: $('activationNote').value.trim()
      });
      toast(`Membership activated: ${result.plan.name || planId}.`);
      editor.innerHTML = '';
      await loadMemberships();
      await loadUsers();
      await loadDashboard();
    } catch (e) {
      toast(e.message || 'Could not activate membership.', 'error');
    }
  };

  await updatePreview();
}

async function loadMemberships() {
  const [snap, userSnap] = await Promise.all([
    getDocs(query(collection(db, "memberships"), limit(500))),
    getDocs(query(collection(db, "users"), limit(500)))
  ]);
  const userMap = new Map();
  userSnap.forEach(u => userMap.set(u.id, u.data()));
  let rows = "";
  snap.forEach(s => {
    const d = s.data();
    const uid = d.uid || s.id;
    const user = userMap.get(uid) || {};
    const expiry = toJsDate(d.expiryDate);
    const expiryLabel = expiry ? dateText(d.expiryDate) : "Lifetime / Unlimited";
    const status = computedMembershipStatus(d);
    const remain = daysRemaining(d);
    const remainLabel = remain === null ? "Unlimited" : `${remain} day${remain === 1 ? "" : "s"} left`;
    rows += `<tr><td><strong>${esc(user.email || user.name || "Unknown user")}</strong><div class="muted tiny">${esc(uid)}</div></td><td>${esc(d.planName || d.planId || "-")}</td><td>${statusBadge(status)}<div class="muted tiny">${esc(remainLabel)}</div></td><td title="${esc(dateTimeText(d.startDate))}">${esc(dateText(d.startDate))}</td><td title="${esc(dateTimeText(d.expiryDate))}">${esc(expiryLabel)}</td><td class="row-actions"><button class="ghost extend-membership" data-uid="${esc(uid)}">Extend</button><button class="ghost suspend-membership" data-uid="${esc(uid)}">Suspend</button></td></tr>`;
  });
  $("memberships").innerHTML=`<div class="page-head"><div><h2>Memberships</h2><p class="muted">Activate verified WhatsApp payments, manage Monthly / Yearly / Lifetime / Unlimited access, extend and suspend memberships. Dates are shown in a compact Indian format.</p></div><div class="head-actions"><button id="activateMembershipBtn" class="primary compact-btn">+ Activate Membership</button><button id="membershipRefresh" class="ghost">Refresh</button></div></div><div class="panel" style="margin-top:0;"><div class="notice"><b>Important:</b> Activate the membership for the same Google account shown in the customer's extension. The UID is the account identity; email is displayed here to help you select the correct customer.</div></div><div id="membershipEditor"></div><div class="panel"><table class="table"><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Start</th><th>Expiry</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No memberships yet.</td></tr>'}</tbody></table></div>`;
  $("membershipRefresh").onclick=loadMemberships;
  $("activateMembershipBtn").onclick=()=>openActivateMembershipForm();
  document.querySelectorAll('.extend-membership').forEach(btn=>{btn.onclick=async()=>{const days=prompt('Add how many days?','30');const n=Number(days);if(!Number.isFinite(n)||n<=0)return;try{const ref=doc(db,'memberships',btn.dataset.uid);const s=await getDoc(ref);if(!s.exists())throw new Error('Membership not found.');const d=s.data();if(!d.expiryDate){toast('Lifetime membership does not need extension.');return;}const current=d.expiryDate.toDate();const expiry=new Date(Math.max(current.getTime(),Date.now()));expiry.setDate(expiry.getDate()+n);await updateDoc(ref,{expiryDate:Timestamp.fromDate(expiry),status:'ACTIVE',updatedAt:serverTimestamp()});await updateDoc(doc(db,'users',btn.dataset.uid),{status:'ACTIVE',membershipStatus:'ACTIVE',membershipExpiry:Timestamp.fromDate(expiry),updatedAt:serverTimestamp()});toast(`Membership extended by ${n} days.`);await loadMemberships();await loadUsers();}catch(e){toast(e.message||'Could not extend.','error');}};});
  document.querySelectorAll('.suspend-membership').forEach(btn=>{btn.onclick=async()=>{if(!confirm('Suspend this membership?'))return;try{await updateDoc(doc(db,'memberships',btn.dataset.uid),{status:'SUSPENDED',updatedAt:serverTimestamp()});await updateDoc(doc(db,'users',btn.dataset.uid),{status:'SUSPENDED',membershipStatus:'SUSPENDED',updatedAt:serverTimestamp()});toast('Membership suspended.');await loadMemberships();await loadUsers();}catch(e){toast(e.message||'Could not suspend.','error');}};});
}

async function loadDevices() {
  const snap = await getDocs(query(collection(db, "devices"), limit(500)));
  let rows = "";

  snap.forEach(s => {
    const d = s.data();

    rows += `
      <tr>
        <td>${esc(d.uid || "-")}</td>
        <td>${esc(d.deviceLabel || d.platform || "-")}</td>
        <td>${esc(dateTimeText(d.lastActiveAt))}</td>
        <td>${statusBadge(d.status || "ACTIVE")}</td>
        <td><button class="ghost reset-device" data-uid="${esc(d.uid || s.id)}">Reset</button></td>
      </tr>
    `;
  });

  $("devices").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Devices</h2>
        <p class="muted">Registered device sessions</p>
      </div>
      <button id="devicesRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr><th>User</th><th>Device</th><th>Last Active</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">No device sessions yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("devicesRefresh").onclick = loadDevices;
  document.querySelectorAll('.reset-device').forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.uid;
      if (!uid || !confirm(`Reset device access for ${uid}?`)) return;
      try {
        await deleteDoc(doc(db, 'devices', uid));
        toast('Device access reset. The user can register the current device on next membership check.');
        await loadDevices();
      } catch (e) {
        toast(e.message || 'Could not reset device.', 'error');
      }
    };
  });
}

async function loadSettings() {
  const s = await getDoc(doc(db, "settings", "general"));
  const d = s.exists() ? s.data() : {};
  $("settings").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Settings</h2>
        <p class="muted">Branding and WhatsApp support settings used by the extension.</p>
      </div>
    </div>
    <div class="panel form-panel">
      <form id="settingsForm" class="form-grid">
        <label>App Name
          <input id="appName" value="${esc(d.appName || 'MEESHO A+ LISTING AUTOMATION PRO')}">
        </label>
        <label>Brand Name
          <input id="brandName" value="${esc(d.brandName || 'Sohel Enterprise')}">
        </label>
        <label>Support Name
          <input id="supportName" value="${esc(d.supportName || 'Sohel Rana')}">
        </label>
        <label>Support Number
          <input id="supportPhone" value="${esc(d.supportPhone || '9064827025')}">
        </label>
        <label>WhatsApp Number
          <input id="whatsapp" value="${esc(d.whatsapp || '919064827025')}">
        </label>
        <label>Support Email
          <input id="supportEmail" type="email" value="${esc(d.supportEmail || 'sohelenterpriseofficial@gmail.com')}">
        </label>
        <label class="full-width">WhatsApp Purchase Message Template
          <textarea id="whatsappPurchaseMessage" rows="5" placeholder="Use {plan}, {price}, {email}, {uid}, {app}, {brand} as placeholders.">${esc(d.whatsappPurchaseMessage || 'Hi, I want to purchase {plan} for {price}. Please send the payment details here. After payment I will send the payment screenshot / UTR in this WhatsApp chat. Please verify and activate my membership.')}</textarea>
          <span class="muted small">The customer sees this message automatically when they click Buy via WhatsApp.</span>
        </label>
        <div class="full-width notice">
          <b>Payment mode: WhatsApp only.</b> The extension does not collect UPI ID, QR code, UTR or receipt uploads. Customers complete payment in WhatsApp and send the payment proof there. You activate the selected plan from Memberships.
        </div>
        <div class="full-width form-actions">
          <button id="saveSettings" type="submit" class="primary small-btn">Save Settings</button>
        </div>
      </form>
    </div>`;

  $("settingsForm").onsubmit = async event => {
    event.preventDefault();
    let whatsapp = $("whatsapp").value.trim().replace(/\D/g, '');
    if (whatsapp.length === 10) whatsapp = `91${whatsapp}`;
    const phone = $("supportPhone").value.trim().replace(/\D/g, '').replace(/^91/, '');
    await setDoc(doc(db, 'settings', 'general'), {
      appName: $("appName").value.trim() || 'MEESHO A+ LISTING AUTOMATION PRO',
      brandName: $("brandName").value.trim() || 'Sohel Enterprise',
      supportName: $("supportName").value.trim() || 'Sohel Rana',
      supportPhone: phone || '9064827025',
      whatsapp: whatsapp || '919064827025',
      supportEmail: $("supportEmail").value.trim() || 'sohelenterpriseofficial@gmail.com',
      whatsappPurchaseMessage: $("whatsappPurchaseMessage").value.trim() || 'Hi, I want to purchase {plan} for {price}. Please send the payment details here. After payment I will send the payment screenshot / UTR in this WhatsApp chat. Please verify and activate my membership.',
      paymentMode: 'WHATSAPP_ONLY',
      updatedAt: serverTimestamp()
    }, { merge: true });
    toast('WhatsApp-only settings saved.');
  };
}

async function refresh(section) {
  if (section === "dashboard") await loadDashboard();
  if (section === "users") await loadUsers();
  if (section === "plans") await loadPlans();
  if (section === "promoCodes") await loadPromoCodes();
  if (section === "memberships") await loadMemberships();
  if (section === "devices") await loadDevices();
  if (section === "settings") await loadSettings();
}

document.querySelectorAll(".nav").forEach(nav => {
  nav.onclick = async () => {
    show(nav.dataset.section);

    try {
      await refresh(nav.dataset.section);
    } catch (error) {
      console.error(error);
      toast(error.message || "Unable to load this section.", "error");
    }
  };
});

$("googleLogin").onclick = async () => {
  try {
    $("loginError").textContent = "";
    await signInWithPopup(auth, provider);
  } catch (e) {
    $("loginError").textContent = e.message || "Login failed.";
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
      $("loginError").textContent =
        "This Google account is not an authorized admin.";
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
    $("loginError").textContent =
      "Admin verification failed: " + (e.message || "unknown error");
  }
});
