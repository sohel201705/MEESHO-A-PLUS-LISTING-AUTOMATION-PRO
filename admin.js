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
  orderBy,
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

const dateText = value => {
  try {
    if (!value) return "—";
    const d = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
};

const dateTimeText = value => {
  try {
    if (!value) return "—";
    const d = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN");
  } catch {
    return "—";
  }
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
  const [users, payments, memberships, plans, promoCodes] = await Promise.all([
    getDocs(query(collection(db, "users"), limit(500))),
    getDocs(query(collection(db, "payments"), limit(500))),
    getDocs(query(collection(db, "memberships"), limit(500))),
    getDocs(query(collection(db, "plans"), limit(500))),
    getDocs(query(collection(db, "promoCodes"), limit(500)))
  ]);

  let active = 0;
  let expired = 0;
  let lifetime = 0;
  let pending = 0;
  let activePlans = 0;
  let activePromos = 0;

  memberships.forEach(s => {
    const d = s.data();
    const status = String(d.status || "").toUpperCase();
    if (status === "ACTIVE") active++;
    if (status === "EXPIRED") expired++;
    if (String(d.planId || "").toLowerCase() === "lifetime") lifetime++;
  });

  payments.forEach(s => {
    if (String(s.data().status || "").toUpperCase() === "PENDING") pending++;
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
      <div class="stat"><span>Pending Payments</span><b>${pending}</b></div>
      <div class="stat"><span>Active Plans</span><b>${activePlans}</b></div>
      <div class="stat"><span>Active Promo Codes</span><b>${activePromos}</b></div>
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
  const snap = await getDocs(query(collection(db, "users"), limit(500)));
  let rows = "";

  snap.forEach(s => {
    const d = s.data();
    rows += `
      <tr>
        <td>${esc(d.name || d.displayName || "-")}</td>
        <td>${esc(d.email || "-")}</td>
        <td>${esc(d.planId || "-")}</td>
        <td>${statusBadge(d.status || d.membershipStatus || "-")}</td>
        <td>${esc(dateTimeText(d.lastLoginAt))}</td>
        <td class="row-actions">
          <button data-user="${s.id}" class="extend">Extend</button>
          <button data-user="${s.id}" class="suspend">Suspend</button>
        </td>
      </tr>
    `;
  });

  $("users").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Users</h2>
        <p class="muted">Customer accounts and membership status</p>
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

  document.querySelectorAll(".suspend").forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.user;
      if (!confirm("Suspend this user?")) return;
      await updateDoc(doc(db, "users", uid), {
        status: "SUSPENDED",
        updatedAt: serverTimestamp()
      });
      toast("User suspended.");
      await loadUsers();
    };
  });

  document.querySelectorAll(".extend").forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.user;
      const days = prompt("How many days should be added?", "30");
      const n = Number(days);
      if (!Number.isFinite(n) || n <= 0) return;

      const ref = doc(db, "users", uid);
      const userSnap = await getDoc(ref);
      if (!userSnap.exists()) return;

      const d = userSnap.data();
      let expiry = d.membershipExpiry?.toDate
        ? d.membershipExpiry.toDate()
        : d.membershipExpiry
        ? new Date(d.membershipExpiry)
        : new Date();

      if (Number.isNaN(expiry.getTime()) || expiry < new Date()) expiry = new Date();
      expiry.setDate(expiry.getDate() + n);

      await updateDoc(ref, {
        membershipExpiry: Timestamp.fromDate(expiry),
        status: "ACTIVE",
        updatedAt: serverTimestamp()
      });

      toast(`Membership extended by ${n} days.`);
      await loadUsers();
    };
  });
}

function planForm(existing = {}) {
  return `
    <div class="panel form-panel">
      <div class="panel-title">
        <div>
          <h3>${existing.id ? "Edit Plan" : "Create Plan"}</h3>
          <p class="muted">Pricing is controlled from Firestore through this admin panel.</p>
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
        <td>${esc(d.durationDays ?? "∞")}</td>
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
        <p class="muted">Create and control Monthly, Yearly and Lifetime pricing.</p>
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

  $("planForm").onsubmit = async event => {
    event.preventDefault();

    const id = $("planId").value.trim().toLowerCase().replace(/\s+/g, "-");
    const name = $("planName").value.trim();
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

async function loadPayments() {
  let snap;

  try {
    snap = await getDocs(
      query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(200))
    );
  } catch {
    snap = await getDocs(query(collection(db, "payments"), limit(200)));
  }

  let rows = "";

  snap.forEach(s => {
    const d = s.data();

    rows += `
      <tr>
        <td>${esc(d.userEmail || d.uid || "-")}</td>
        <td>${esc(d.planId || "-")}</td>
        <td>${money(d.amount)}</td>
        <td>${statusBadge(d.status || "PENDING")}</td>
        <td>${esc(d.utr || "-")}</td>
        <td class="row-actions">
          <button data-pay="${s.id}" class="approve">Approve</button>
          <button data-pay="${s.id}" class="reject">Reject</button>
        </td>
      </tr>
    `;
  });

  $("payments").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Payments</h2>
        <p class="muted">Manual UPI/payment approval queue</p>
      </div>
      <button id="paymentsRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>UTR</th><th>Actions</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6">No payment requests.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("paymentsRefresh").onclick = loadPayments;

  document.querySelectorAll(".approve").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.pay;
      if (!confirm("Approve this payment?")) return;

      await updateDoc(doc(db, "payments", id), {
        status: "APPROVED",
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.uid || null
      });

      toast("Payment approved.");
      await loadPayments();
    };
  });

  document.querySelectorAll(".reject").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.pay;
      if (!confirm("Reject this payment?")) return;

      await updateDoc(doc(db, "payments", id), {
        status: "REJECTED",
        rejectedAt: serverTimestamp(),
        rejectedBy: auth.currentUser?.uid || null
      });

      toast("Payment rejected.");
      await loadPayments();
    };
  });
}

async function loadMemberships() {
  const snap = await getDocs(query(collection(db, "memberships"), limit(500)));
  let rows = "";

  snap.forEach(s => {
    const d = s.data();

    rows += `
      <tr>
        <td>${esc(d.uid || s.id)}</td>
        <td>${esc(d.planId || "-")}</td>
        <td>${statusBadge(d.status || "-")}</td>
        <td>${esc(dateText(d.startDate))}</td>
        <td>${esc(dateText(d.expiryDate) === "—" ? "NEVER" : dateText(d.expiryDate))}</td>
      </tr>
    `;
  });

  $("memberships").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Memberships</h2>
        <p class="muted">Current membership records</p>
      </div>
      <button id="membershipRefresh" class="ghost">Refresh</button>
    </div>

    <div class="panel">
      <table class="table">
        <thead>
          <tr><th>UID</th><th>Plan</th><th>Status</th><th>Start</th><th>Expiry</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">No memberships yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("membershipRefresh").onclick = loadMemberships;
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
          <tr><th>User</th><th>Device</th><th>Last Active</th><th>Status</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4">No device sessions yet.</td></tr>'}</tbody>
      </table>
    </div>
  `;

  $("devicesRefresh").onclick = loadDevices;
}

async function loadSettings() {
  const s = await getDoc(doc(db, "settings", "general"));
  const d = s.exists() ? s.data() : {};

  $("settings").innerHTML = `
    <div class="page-head">
      <div>
        <h2>Settings</h2>
        <p class="muted">Support and payment information used by the system.</p>
      </div>
    </div>

    <div class="panel">
      <div class="form-grid">
        <label>Support Number
          <input id="supportPhone" value="${esc(d.supportPhone || "")}">
        </label>

        <label>WhatsApp Number
          <input id="whatsapp" value="${esc(d.whatsapp || "")}">
        </label>

        <label>Support Email
          <input id="supportEmail" value="${esc(d.supportEmail || "")}">
        </label>

        <label>UPI ID
          <input id="upiId" value="${esc(d.upiId || "")}">
        </label>

        <div class="form-actions">
          <button id="saveSettings" class="primary small-btn">Save Settings</button>
        </div>
      </div>
    </div>
  `;

  $("saveSettings").onclick = async () => {
    await setDoc(
      doc(db, "settings", "general"),
      {
        supportPhone: $("supportPhone").value.trim(),
        whatsapp: $("whatsapp").value.trim(),
        supportEmail: $("supportEmail").value.trim(),
        upiId: $("upiId").value.trim(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    toast("Settings saved.");
  };
}

async function refresh(section) {
  if (section === "dashboard") await loadDashboard();
  if (section === "users") await loadUsers();
  if (section === "plans") await loadPlans();
  if (section === "promoCodes") await loadPromoCodes();
  if (section === "payments") await loadPayments();
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
