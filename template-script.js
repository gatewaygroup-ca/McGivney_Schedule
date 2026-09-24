/* ============================================================
   GATEWAY PROJECT TEMPLATE — SCHEDULE + TRADES ENGINE
   Reusable across new Gateway projects. Properties are freely
   addable/editable/removable from the live site (no code editing
   needed). Trades carry full financial tracking (contract, change
   orders, invoices, payments) same as 43 Munn — Budget vs Actual is
   intentionally left out of this template. A trade can link to zero
   or more properties (many-to-many), matching Munn's model.

   Task dates within a property are directly editable (no
   dependency-cascade engine) — same design as McGivney/Kiwanis,
   since a freely-added property has no inherent dependency chain.
   ============================================================ */

const STATE = {
  sites: deepClone(BASELINE_PROPERTIES),
  trades: deepClone(BASELINE_TRADES),
  holidays: deepClone(HOLIDAYS),
  photos: deepClone(BASELINE_PHOTOS),
  activity: [],
  activityPage: 1,
  lastUpdated: new Date(),
  userEmail: null,
  userRole: null,
  editMode: false,
  statusFilter: "All",
  tradeFilter: "active",
  openSiteId: null,
  openMilestoneId: null,
  openPhotoId: null,
  openTradeId: null,
};

const ACTIVITY_PAGE_SIZE = 5;
const TASK_STATUS_OPTIONS = ["complete", "inprog", "high", "med", "low"];
const TASK_STATUS_LABEL = { complete: "Complete", inprog: "In Progress", high: "High Priority", med: "Medium Priority", low: "Low Priority" };
const TASK_STATUS_DOT = { complete: "dot-complete", inprog: "dot-inprog", high: "dot-high", med: "dot-med", low: "dot-low" };
const WORK_STATUS_OPTIONS = ["Not Started", "In Progress", "Complete", "On Hold"];

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDate(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function fmtDateShort(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function fmtMoney(n) { return (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }); }
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function calendarDaysInclusive(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000) + 1; }

/* ============================================================
   DERIVED METRICS — schedule
   ============================================================ */

function siteProgress(site) {
  const total = site.milestones.length;
  if (!total) return 0;
  return Math.round((site.milestones.filter(m => m.status === "complete").length / total) * 100);
}
function overallProgress() {
  const all = STATE.sites.flatMap(s => s.milestones);
  if (!all.length) return 0;
  return Math.round((all.filter(m => m.status === "complete").length / all.length) * 100);
}
function nextSiteId() {
  let max = 0;
  STATE.sites.forEach(s => { const m = /^site-(\d+)$/.exec(s.siteId || ""); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return "site-" + String(max + 1).padStart(3, "0");
}
function nextMilestoneId(site) {
  let max = 0;
  site.milestones.forEach(m => { if (m.id > max) max = m.id; });
  return max + 1;
}
function nextPhotoId() {
  let max = 0;
  STATE.photos.forEach(p => { if (p.photoId > max) max = p.photoId; });
  return max + 1;
}
function siteName(siteId) {
  const s = STATE.sites.find(x => x.siteId === siteId);
  return s ? s.name : "—";
}
function siteNamesList(ids) {
  if (!ids || !ids.length) return "—";
  return ids.map(id => siteName(id)).join(", ");
}

/* ============================================================
   DERIVED METRICS — trades / financials (no budget)
   ============================================================ */

function activeTrades() { return STATE.trades.filter(t => t.active); }
function approvedChangeOrderTotal(t) {
  return (t.changeOrders || []).filter(c => c.status === "Approved").reduce((s, c) => s + (Number(c.amount) || 0), 0);
}
function revisedContractValue(t) { return (Number(t.contractAmount) || 0) + (Number(t.hst) || 0) + approvedChangeOrderTotal(t); }
function tradeTotalInvoiced(t) { return (t.invoices || []).reduce((s, inv) => s + (Number(inv.total) || 0), 0); }
function tradeTotalPaid(t) { return (t.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0); }
function tradeOutstanding(t) { return revisedContractValue(t) - tradeTotalPaid(t); }
function invoicePaidAmount(t, invoiceId) { return (t.payments || []).filter(p => p.invoiceId === invoiceId).reduce((s, p) => s + (Number(p.amount) || 0), 0); }
function invoiceBalance(t, inv) { return (Number(inv.total) || 0) - invoicePaidAmount(t, inv.invoiceId); }
function invoiceOverdue(t, inv) {
  if (!inv.dueDate) return false;
  if (invoiceBalance(t, inv) <= 0) return false;
  return parseISO(inv.dueDate) < new Date();
}
function tradePaymentStatus(t) {
  const invoices = t.invoices || [], payments = t.payments || [];
  if (invoices.length === 0 && payments.length === 0) return "Not Invoiced";
  if (invoices.some(inv => invoiceOverdue(t, inv))) return "Overdue";
  const paid = tradeTotalPaid(t), revised = revisedContractValue(t);
  if (paid <= 0) return "Unpaid";
  if (revised > 0 && paid >= revised) return "Paid";
  return "Partially Paid";
}
function pendingInvoiceCount() {
  let n = 0;
  activeTrades().forEach(t => (t.invoices || []).forEach(inv => { if (invoiceBalance(t, inv) > 0) n++; }));
  return n;
}
function financialTotals() {
  return activeTrades().reduce((acc, t) => {
    acc.contract += revisedContractValue(t); acc.invoiced += tradeTotalInvoiced(t);
    acc.paid += tradeTotalPaid(t); acc.outstanding += tradeOutstanding(t);
    return acc;
  }, { contract: 0, invoiced: 0, paid: 0, outstanding: 0 });
}
function tradesForSite(siteId) { return STATE.trades.filter(t => (t.siteIds || []).includes(siteId)); }
function nextTradeId() {
  let max = 0;
  STATE.trades.forEach(t => { const m = /^TRD-(\d+)$/.exec(t.tradeId || ""); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return "TRD-" + String(max + 1).padStart(3, "0");
}
let FIN_ID_SEQ = Date.now();
function nextFinId() { return ++FIN_ID_SEQ; }
const LOCAL_INVOICE_FILES = {};
const LOCAL_PHOTO_URLS = {};

/* ============================================================
   FIREBASE — sanitize / rehydrate / save / listen / auth
   ============================================================ */

function sanitizeMilestone(m) { return { id: m.id, task: m.task || "", start: m.start, end: m.end, status: m.status || "low", notes: m.notes || "" }; }
function sanitizeSite(s) {
  return {
    siteId: s.siteId, name: s.name || "", addr: s.addr || "", type: s.type || "",
    target: s.target || "", winterRisk: !!s.winterRisk, badgeText: s.badgeText || "", note: s.note || "",
    milestones: (Array.isArray(s.milestones) ? s.milestones : []).map(sanitizeMilestone),
  };
}
function sanitizePhoto(p) { return { photoId: p.photoId, siteId: (p.siteId === undefined ? null : p.siteId), caption: p.caption || "", fileName: p.fileName || "", uploadedAt: p.uploadedAt || new Date().toISOString() }; }

function sanitizeTradeChangeOrder(c) {
  return { changeOrderId: c.changeOrderId, description: c.description || "", date: c.date || null, amount: Number(c.amount) || 0, approvedBy: c.approvedBy || "", status: c.status || "Pending", notes: c.notes || "" };
}
function sanitizeTradeInvoice(inv) {
  return { invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber || "", vendor: inv.vendor || "", invoiceDate: inv.invoiceDate || null, dueDate: inv.dueDate || null, subtotal: Number(inv.subtotal) || 0, hst: Number(inv.hst) || 0, total: Number(inv.total) || 0, fileName: inv.fileName || "", notes: inv.notes || "" };
}
function sanitizeTradePayment(p) {
  return { paymentId: p.paymentId, invoiceId: (p.invoiceId === undefined || p.invoiceId === null) ? null : p.invoiceId, amount: Number(p.amount) || 0, date: p.date || null, method: p.method || "", reference: p.reference || "", notes: p.notes || "" };
}
function normalizeSiteIds(t) {
  if (Array.isArray(t.siteIds)) return t.siteIds.filter(id => id !== null && id !== undefined);
  return [];
}
function sanitizeTrade(t) {
  return {
    tradeId: t.tradeId, tradeName: t.tradeName || "", vendor: t.vendor || "", scope: t.scope || "",
    siteIds: normalizeSiteIds(t), contractAmount: Number(t.contractAmount) || 0, hst: Number(t.hst) || 0,
    workStatus: t.workStatus || "Not Started", paymentTerms: t.paymentTerms || "", poNumber: t.poNumber || "", notes: t.notes || "",
    active: t.active === undefined ? true : !!t.active, createdAt: t.createdAt || new Date().toISOString(), updatedAt: t.updatedAt || new Date().toISOString(),
    changeOrders: (Array.isArray(t.changeOrders) ? t.changeOrders : []).map(sanitizeTradeChangeOrder),
    invoices: (Array.isArray(t.invoices) ? t.invoices : []).map(sanitizeTradeInvoice),
    payments: (Array.isArray(t.payments) ? t.payments : []).map(sanitizeTradePayment),
  };
}
function rehydrateTrade(t) {
  return { ...t, siteIds: normalizeSiteIds(t), vendor: t.vendor || "", scope: t.scope || "", paymentTerms: t.paymentTerms || "", poNumber: t.poNumber || "", notes: t.notes || "", active: t.active === undefined ? true : !!t.active,
    changeOrders: Array.isArray(t.changeOrders) ? t.changeOrders.map(sanitizeTradeChangeOrder) : [],
    invoices: Array.isArray(t.invoices) ? t.invoices.map(sanitizeTradeInvoice) : [],
    payments: Array.isArray(t.payments) ? t.payments.map(sanitizeTradePayment) : [] };
}

function firebaseSave(force) {
  if (typeof db === "undefined") return;
  if (!force && !isEditingNow()) {
    console.warn("Blocked a write attempt: not in Edit Mode, or role doesn't permit editing.");
    alert(canEdit() ? 'Click "Edit Schedule" to make changes.' : "You're signed in as a Viewer and can't make changes to this project.");
    return;
  }
  const payload = {
    sites: STATE.sites.map(sanitizeSite),
    trades: STATE.trades.map(sanitizeTrade),
    holidays: STATE.holidays,
    photos: STATE.photos.map(sanitizePhoto),
    activity: STATE.activity.map(a => ({ text: a.text, time: a.time.toISOString() })),
    lastUpdated: STATE.lastUpdated.toISOString(),
  };
  db.ref(PROJECT.firebasePath).set(payload).catch((err) => {
    console.error("Firebase save failed:", err);
    alert("Couldn't sync to the live database: " + err.message + "\n\nYour change is only visible in this browser until this is fixed.");
  });
}

function firebaseListen() {
  db.ref(PROJECT.firebasePath).on("value", (snapshot) => {
    const val = snapshot.val();
    if (!val) {
      STATE.sites = deepClone(BASELINE_PROPERTIES);
      STATE.trades = deepClone(BASELINE_TRADES);
      STATE.holidays = deepClone(HOLIDAYS);
      STATE.photos = deepClone(BASELINE_PHOTOS);
      STATE.activity = [];
      STATE.lastUpdated = new Date();
      logActivity(`Schedule loaded — baseline for ${PROJECT.name}.`);
      firebaseSave(true);
      return;
    }
    STATE.sites = (val.sites || deepClone(BASELINE_PROPERTIES)).map(sanitizeSite);
    STATE.trades = (val.trades || []).map(rehydrateTrade);
    STATE.holidays = val.holidays || deepClone(HOLIDAYS);
    STATE.photos = (val.photos || []).map(sanitizePhoto);
    STATE.activity = (val.activity || []).map(a => ({ text: a.text, time: new Date(a.time) }));
    STATE.lastUpdated = val.lastUpdated ? new Date(val.lastUpdated) : new Date();
    FIREBASE_READY = true;
    renderAll();
  }, (err) => console.error("Firebase listen failed:", err));
}

let FIREBASE_READY = false;
function canEdit() { return STATE.userRole === "admin" || STATE.userRole === "editor"; }
function isEditingNow() { return canEdit() && STATE.editMode; }

function setEditModeUI() {
  document.body.classList.toggle("mode-view", !isEditingNow());
  const banner = document.getElementById("viewModeBanner");
  const toggleBtn = document.getElementById("btnEditModeToggle");
  if (canEdit()) {
    toggleBtn.style.display = "inline-block";
    toggleBtn.textContent = STATE.editMode ? "Exit Edit Mode" : "Edit Schedule";
    banner.style.display = STATE.editMode ? "none" : "block";
    banner.textContent = '👁 VIEW MODE — click "Edit Schedule" to make changes.';
  } else {
    toggleBtn.style.display = "none";
    banner.style.display = "block";
    banner.textContent = "👁 VIEW MODE — you're signed in as a Viewer. Changes are read-only.";
  }
}

function initAuthGate() {
  const gate = document.getElementById("authGate");
  const appWrap = document.getElementById("appWrap");
  const LOGIN_URL = "https://gatewaygroup-ca.github.io/43-Munn-Schedule/login.html";
  if (typeof auth === "undefined") {
    gate.innerHTML = '<div class="auth-gate-inner">Authentication isn\'t available right now. Please try again shortly.</div>';
    return;
  }
  auth.onAuthStateChanged((user) => {
    if (!user) { window.location.href = LOGIN_URL; return; }
    STATE.userEmail = user.email;
    db.ref("roles/" + user.uid).once("value").then((snap) => {
      const role = snap.val();
      if (!role) {
        gate.innerHTML = `<div class="auth-gate-inner">Your account (${escapeHtml(user.email)}) doesn't have access to this project yet.<br>Contact your Gateway admin to be assigned a role.<br><br><button class="btn" id="btnGateLogout">Log Out</button></div>`;
        document.getElementById("btnGateLogout").onclick = () => auth.signOut().then(() => window.location.href = LOGIN_URL);
        return;
      }
      STATE.userRole = role;
      gate.style.display = "none";
      appWrap.style.display = "block";
      init();
      document.getElementById("userEmailLabel").textContent = user.email;
      document.getElementById("userRoleBadge").textContent = role;
      document.getElementById("btnLogout").onclick = () => auth.signOut().then(() => window.location.href = LOGIN_URL);
      document.getElementById("btnEditModeToggle").onclick = () => { STATE.editMode = !STATE.editMode; setEditModeUI(); };
      setEditModeUI();
    }).catch((err) => { gate.innerHTML = `<div class="auth-gate-inner">Error checking permissions: ${escapeHtml(err.message)}</div>`; });
  });
}

/* ============================================================
   ACTIVITY FEED
   ============================================================ */

function logActivity(text) {
  STATE.activity.unshift({ text, time: new Date() });
  if (STATE.activity.length > 200) STATE.activity.pop();
  STATE.activityPage = 1;
}
function renderActivity() {
  const el = document.getElementById("activityList");
  if (!el) return;
  el.innerHTML = "";
  if (STATE.activity.length === 0) { el.innerHTML = `<div class="empty-note">No changes yet this session.</div>`; updatePager(1, 1); return; }
  const totalPages = Math.max(1, Math.ceil(STATE.activity.length / ACTIVITY_PAGE_SIZE));
  STATE.activityPage = Math.min(Math.max(1, STATE.activityPage), totalPages);
  const start = (STATE.activityPage - 1) * ACTIVITY_PAGE_SIZE;
  STATE.activity.slice(start, start + ACTIVITY_PAGE_SIZE).forEach(a => {
    const row = document.createElement("div");
    row.className = "activity-row";
    row.innerHTML = `<span class="activity-dot"></span><span class="activity-text">${escapeHtml(a.text)}</span><span class="activity-time">${a.time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>`;
    el.appendChild(row);
  });
  updatePager(STATE.activityPage, totalPages);
}
function updatePager(page, totalPages) {
  const pager = document.getElementById("activityPager");
  if (!pager) return;
  pager.style.display = totalPages > 1 ? "flex" : "none";
  document.getElementById("activityPageLabel").textContent = `Page ${page} of ${totalPages}`;
  document.getElementById("btnActivityPrev").disabled = page <= 1;
  document.getElementById("btnActivityNext").disabled = page >= totalPages;
}

/* ============================================================
   RENDERING — header, property cards, per-property schedule
   ============================================================ */

function renderAll() {
  renderHeader();
  renderSiteCards();
  renderSiteSections();
  renderGallery();
  renderFinancialSummary();
  renderTradeCostTable();
  renderActivity();
  const el = document.getElementById("lastUpdated");
  if (el) el.textContent = "Last updated: " + STATE.lastUpdated.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const syncEl = document.getElementById("syncStatus");
  if (syncEl) syncEl.textContent = FIREBASE_READY ? "🔥 Live sync on" : "Local mode";
  const progEl = document.getElementById("overallProgress");
  if (progEl) progEl.textContent = overallProgress() + "%";
}

function renderHeader() {
  document.getElementById("projName").textContent = PROJECT.name;
  document.getElementById("projDesc").textContent = PROJECT.description;
  document.getElementById("ccContract").textContent = PROJECT.contract;
  document.getElementById("ccPurchaser").textContent = PROJECT.purchaser;
  document.getElementById("ccOccupancy").textContent = PROJECT.occupancyTarget;
  document.getElementById("ccSupplier").textContent = PROJECT.supplier;
  const winterEl = document.getElementById("winterNote");
  if (PROJECT.winterNote) { winterEl.style.display = "flex"; winterEl.innerHTML = `❄️ <span>${escapeHtml(PROJECT.winterNote)}</span>`; }
  else winterEl.style.display = "none";
}

function renderSiteCards() {
  const el = document.getElementById("siteCards");
  el.innerHTML = "";
  if (STATE.sites.length === 0) {
    el.innerHTML = `<div class="empty-note">No properties yet. Click "+ Add Property" to create one.</div>`;
    return;
  }
  STATE.sites.forEach(site => {
    const card = document.createElement("div");
    card.className = "site-card" + (site.winterRisk ? " winter-risk" : "");
    card.onclick = () => document.getElementById("site-" + site.siteId).scrollIntoView({ behavior: "smooth", block: "start" });
    card.innerHTML = `
      <div class="site-card-addr">${escapeHtml(site.addr)}</div>
      <div class="site-card-type">${escapeHtml(site.type)}</div>
      <div class="site-card-target">Target: ${escapeHtml(site.target)}</div>
      <div class="progress-track"><div class="progress-fill fill-green" style="width:${siteProgress(site)}%"></div></div>
      <div class="metric-note">${siteProgress(site)}% complete${site.badgeText ? " · " + escapeHtml(site.badgeText) : ""}</div>
      ${site.winterRisk ? `<div class="site-card-winter">❄️ Crosses winter shutdown</div>` : ""}
    `;
    el.appendChild(card);
  });
}

function renderSiteSections() {
  const container = document.getElementById("siteSections");
  container.innerHTML = "";
  STATE.sites.forEach(site => {
    const section = document.createElement("div");
    section.className = "card site-section";
    section.id = "site-" + site.siteId;
    const rows = site.milestones.map(m => `
      <tr>
        <td><span class="task-status-dot ${TASK_STATUS_DOT[m.status] || "dot-low"}"></span>${escapeHtml(m.task)}</td>
        <td>${fmtDateShort(parseISO(m.start))} – ${fmtDateShort(parseISO(m.end))}</td>
        <td>${calendarDaysInclusive(m.start, m.end)}d</td>
        <td>${TASK_STATUS_LABEL[m.status] || m.status}</td>
        <td>${escapeHtml(m.notes)}</td>
        <td class="edit-only"><button data-maction="edit" data-site="${site.siteId}" data-mid="${m.id}">Edit</button> <button class="danger" data-maction="delete" data-site="${site.siteId}" data-mid="${m.id}">Delete</button></td>
      </tr>
    `).join("");
    section.innerHTML = `
      <div class="site-section-head">
        <h2 style="margin:0;">${escapeHtml(site.name)} <span class="metric-note">${escapeHtml(site.addr)}</span></h2>
        <div style="display:flex; gap:8px;">
          <button class="btn edit-only" data-saction="edit-site" data-site="${site.siteId}">Edit Property Info</button>
          <button class="btn edit-only danger" data-saction="delete-site" data-site="${site.siteId}">Delete Property</button>
          <button class="btn primary edit-only" data-saction="add-task" data-site="${site.siteId}">+ Add Task</button>
        </div>
      </div>
      <div class="site-note">${escapeHtml(site.note)}</div>
      <div class="site-task-table-wrap">
        <table class="site-task-table">
          <thead><tr><th>Task</th><th>Dates</th><th>Duration</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="empty-note">No tasks yet.</td></tr>`}</tbody>
        </table>
      </div>
    `;
    container.appendChild(section);
  });
  container.onclick = handleSiteSectionClick;
}

function handleSiteSectionClick(e) {
  const mBtn = e.target.closest("[data-maction]");
  if (mBtn) {
    const siteId = mBtn.dataset.site, mid = Number(mBtn.dataset.mid), action = mBtn.dataset.maction;
    if (action === "edit") return openTaskModal(siteId, mid);
    if (action === "delete") return deleteTask(siteId, mid);
  }
  const sBtn = e.target.closest("[data-saction]");
  if (sBtn) {
    const siteId = sBtn.dataset.site, action = sBtn.dataset.saction;
    if (action === "add-task") return openTaskModal(siteId, null);
    if (action === "edit-site") return openSiteInfoModal(siteId);
    if (action === "delete-site") return deleteSite(siteId);
  }
}

/* ============================================================
   TASK MODAL
   ============================================================ */

function openTaskModal(siteId, milestoneId) {
  STATE.openSiteId = siteId;
  STATE.openMilestoneId = milestoneId;
  const site = STATE.sites.find(s => s.siteId === siteId);
  const m = milestoneId ? site.milestones.find(x => x.id === milestoneId) : null;
  document.getElementById("taskModalTitle").textContent = m ? `Edit — ${m.task}` : `Add Task — ${site.name}`;
  document.getElementById("tkTask").value = m ? m.task : "";
  document.getElementById("tkStart").value = m ? m.start : "";
  document.getElementById("tkEnd").value = m ? m.end : "";
  document.getElementById("tkStatus").value = m ? m.status : "low";
  document.getElementById("tkNotes").value = m ? m.notes : "";
  document.getElementById("tkError").textContent = "";
  document.getElementById("taskModalOverlay").classList.add("show");
}
function closeTaskModal() { document.getElementById("taskModalOverlay").classList.remove("show"); }

function saveTaskModal() {
  const task = document.getElementById("tkTask").value.trim();
  const start = document.getElementById("tkStart").value;
  const end = document.getElementById("tkEnd").value;
  const status = document.getElementById("tkStatus").value;
  const notes = document.getElementById("tkNotes").value.trim();
  const errEl = document.getElementById("tkError");
  if (!task) { errEl.textContent = "Task name is required."; return; }
  if (!start || !end) { errEl.textContent = "Start and end dates are required."; return; }
  if (parseISO(end) < parseISO(start)) { errEl.textContent = "End date can't be before start date."; return; }
  const site = STATE.sites.find(s => s.siteId === STATE.openSiteId);
  if (STATE.openMilestoneId) {
    const m = site.milestones.find(x => x.id === STATE.openMilestoneId);
    m.task = task; m.start = start; m.end = end; m.status = status; m.notes = notes;
    logActivity(`${site.name}: "${task}" updated`);
  } else {
    site.milestones.push({ id: nextMilestoneId(site), task, start, end, status, notes });
    logActivity(`${site.name}: new task added — "${task}"`);
  }
  STATE.lastUpdated = new Date();
  firebaseSave();
  renderAll();
  closeTaskModal();
}

function deleteTask(siteId, milestoneId) {
  const site = STATE.sites.find(s => s.siteId === siteId);
  const m = site.milestones.find(x => x.id === milestoneId);
  if (!m) return;
  if (!confirm(`Delete task "${m.task}"?`)) return;
  site.milestones = site.milestones.filter(x => x.id !== milestoneId);
  STATE.lastUpdated = new Date();
  logActivity(`${site.name}: task deleted — "${m.task}"`);
  firebaseSave();
  renderAll();
}

/* ============================================================
   PROPERTY (SITE) MODAL — add / edit / delete
   ============================================================ */

function openSiteInfoModal(siteId) {
  STATE.openSiteId = siteId || null;
  const site = siteId ? STATE.sites.find(s => s.siteId === siteId) : null;
  document.getElementById("siteModalTitle").textContent = site ? `Edit Property — ${site.name}` : "Add Property";
  document.getElementById("siName").value = site ? site.name : "";
  document.getElementById("siAddr").value = site ? site.addr : "";
  document.getElementById("siType").value = site ? site.type : "";
  document.getElementById("siTarget").value = site ? site.target : "";
  document.getElementById("siWinterRisk").checked = site ? site.winterRisk : false;
  document.getElementById("siBadge").value = site ? (site.badgeText || "") : "";
  document.getElementById("siNote").value = site ? site.note : "";
  document.getElementById("siError").textContent = "";
  document.getElementById("siteModalOverlay").classList.add("show");
}
function closeSiteInfoModal() { document.getElementById("siteModalOverlay").classList.remove("show"); }

function saveSiteInfoModal() {
  const name = document.getElementById("siName").value.trim();
  if (!name) { document.getElementById("siError").textContent = "Property name is required."; return; }
  let site = STATE.openSiteId ? STATE.sites.find(s => s.siteId === STATE.openSiteId) : null;
  const isNew = !site;
  if (isNew) {
    site = { siteId: nextSiteId(), milestones: [] };
    STATE.sites.push(site);
  }
  site.name = name;
  site.addr = document.getElementById("siAddr").value.trim();
  site.type = document.getElementById("siType").value.trim();
  site.target = document.getElementById("siTarget").value.trim();
  site.winterRisk = document.getElementById("siWinterRisk").checked;
  site.badgeText = document.getElementById("siBadge").value.trim();
  site.note = document.getElementById("siNote").value.trim();
  STATE.lastUpdated = new Date();
  logActivity(isNew ? `New property added: ${site.name}` : `${site.name}: property information updated`);
  firebaseSave();
  renderAll();
  closeSiteInfoModal();
}

function deleteSite(siteId) {
  const site = STATE.sites.find(s => s.siteId === siteId);
  if (!site) return;
  const linkedTrades = tradesForSite(siteId);
  const warn = linkedTrades.length ? ` ${linkedTrades.length} trade(s) are linked to this property — they will stay, just unlinked from it.` : "";
  if (!confirm(`Delete property "${site.name}" and all ${site.milestones.length} of its tasks? This cannot be undone.${warn}`)) return;
  STATE.sites = STATE.sites.filter(s => s.siteId !== siteId);
  STATE.trades.forEach(t => { t.siteIds = (t.siteIds || []).filter(id => id !== siteId); });
  STATE.lastUpdated = new Date();
  logActivity(`Property deleted: ${site.name}`);
  firebaseSave();
  renderAll();
}

/* ============================================================
   TRADE FINANCIAL SUMMARY + TRADE COSTS TABLE  (no budget)
   ============================================================ */

function statusPillClass(status) {
  const map = { "Paid": "st-paid", "Partially Paid": "st-partial", "Unpaid": "st-unpaid", "Overdue": "st-overdue", "Pending": "st-pending", "Approved": "st-approved", "Rejected": "st-rejected", "Not Invoiced": "st-gray" };
  return map[status] || "st-pending";
}
function visibleTrades() {
  if (STATE.tradeFilter === "archived") return STATE.trades.filter(t => !t.active);
  if (STATE.tradeFilter === "all") return STATE.trades;
  return STATE.trades.filter(t => t.active);
}
function renderTradeFilterTabs() {
  const el = document.getElementById("tradeFilterTabs");
  if (!el) return;
  el.innerHTML = "";
  [["active", "Active"], ["archived", "Archived"], ["all", "All"]].forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (STATE.tradeFilter === key ? " active" : "");
    btn.textContent = label;
    btn.onclick = () => { STATE.tradeFilter = key; renderTradeCostTable(); renderTradeFilterTabs(); };
    el.appendChild(btn);
  });
}

function renderFinancialSummary() {
  const totals = financialTotals();
  const el = document.getElementById("finSummaryMetrics");
  if (!el) return;
  el.innerHTML = `
    <div class="metric-card"><div class="metric-label">Total Contract Value</div><div class="metric-value">${fmtMoney(totals.contract)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Invoiced</div><div class="metric-value">${fmtMoney(totals.invoiced)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Paid</div><div class="metric-value green">${fmtMoney(totals.paid)}</div></div>
    <div class="metric-card"><div class="metric-label">Total Outstanding</div><div class="metric-value ${totals.outstanding > 0 ? "red" : ""}">${fmtMoney(totals.outstanding)}</div></div>
    <div class="metric-card"><div class="metric-label">Pending Invoices</div><div class="metric-value">${pendingInvoiceCount()}</div></div>
  `;
}

function renderTradeCostTable() {
  const body = document.getElementById("tradeCostTableBody");
  if (!body) return;
  body.innerHTML = "";
  const list = visibleTrades();
  if (list.length === 0) { body.innerHTML = `<tr><td colspan="11" class="empty-note">No trades yet. Click "+ Add Trade" to create one.</td></tr>`; return; }
  list.forEach(t => {
    const invoiced = tradeTotalInvoiced(t), paid = tradeTotalPaid(t), outstanding = tradeOutstanding(t), status = tradePaymentStatus(t);
    const tr = document.createElement("tr");
    tr.className = "clickable" + (t.active ? "" : " archived-row");
    tr.onclick = (e) => { if (!e.target.closest("button")) openTradeModal(t.tradeId); };
    tr.innerHTML = `
      <td>${escapeHtml(t.tradeName)}</td><td>${escapeHtml(t.vendor) || "—"}</td><td>${escapeHtml(t.scope) || "—"}</td>
      <td>${escapeHtml(siteNamesList(t.siteIds))}</td>
      <td class="num">${fmtMoney(revisedContractValue(t))}</td><td class="num">${fmtMoney(invoiced)}</td>
      <td class="num">${fmtMoney(paid)}</td><td class="num">${fmtMoney(outstanding)}</td><td class="num">${(t.invoices || []).length}</td>
      <td><span class="status-pill ${statusPillClass(status)}">${status}</span>${!t.active ? '<span class="status-pill st-gray" style="margin-left:4px;">Archived</span>' : ""}</td>
      <td class="trade-actions-cell">
        <button data-taction="edit" data-tid="${t.tradeId}">Edit</button>
        ${t.active ? `<button data-taction="archive" data-tid="${t.tradeId}">Archive</button>` : `<button data-taction="restore" data-tid="${t.tradeId}">Restore</button>`}
      </td>`;
    body.appendChild(tr);
  });
}
function handleTradeTableClick(e) {
  const btn = e.target.closest("[data-taction]");
  if (!btn) return;
  e.stopPropagation();
  const tid = btn.dataset.tid, action = btn.dataset.taction;
  if (action === "edit") openTradeModal(tid);
  if (action === "archive") archiveTradePrompt(tid);
  if (action === "restore") restoreTrade(tid);
}

/* ============================================================
   TRADE MODAL — add / edit / archive / delete
   ============================================================ */

function getOpenTrade() { return STATE.trades.find(t => t.tradeId === STATE.openTradeId) || null; }
function siteCheckboxesHtml(selectedIds) {
  const sel = selectedIds || [];
  return STATE.sites.map(s => `<label class="checkbox-row"><input type="checkbox" class="tSiteCheck" value="${s.siteId}" ${sel.includes(s.siteId) ? "checked" : ""}><span>${escapeHtml(s.name)}</span></label>`).join("");
}

function openTradeModal(tradeId, presetSiteId) {
  STATE.openTradeId = tradeId || null;
  document.getElementById("tradeModalOverlay").classList.add("show");
  renderTradeModal(presetSiteId);
}
function closeTradeModal() { document.getElementById("tradeModalOverlay").classList.remove("show"); STATE.openTradeId = null; }

let PENDING_INVOICE_FILE = null;
let PENDING_ATTACH_INVOICE_ID = null;

function renderTradeModal(presetSiteId) {
  const t = getOpenTrade();
  const isNew = !t;
  document.getElementById("tradeModalTitle").textContent = isNew ? "Add Trade" : t.tradeName;
  const body = document.getElementById("tradeModalBody");

  const changeOrdersHtml = t && (t.changeOrders || []).length ? t.changeOrders.map(c => `
    <div class="fin-list-item">
      <div class="fin-list-item-top"><strong>${escapeHtml(c.description) || "Change order"}</strong><span class="status-pill ${statusPillClass(c.status)}">${c.status}</span></div>
      <div class="fin-list-item-meta">${c.date ? fmtDate(parseISO(c.date)) : "No date"} · ${fmtMoney(c.amount)}${c.approvedBy ? " · Approved by " + escapeHtml(c.approvedBy) : ""}</div>
      <div class="fin-list-actions">
        <select data-caction="co-status" data-id="${c.changeOrderId}"><option value="Pending" ${c.status === "Pending" ? "selected" : ""}>Pending</option><option value="Approved" ${c.status === "Approved" ? "selected" : ""}>Approved</option><option value="Rejected" ${c.status === "Rejected" ? "selected" : ""}>Rejected</option></select>
        <button class="danger" data-caction="co-delete" data-id="${c.changeOrderId}">Delete</button>
      </div>
    </div>`).join("") : `<div class="empty-note">No change orders yet.</div>`;

  const invoicesHtml = t && (t.invoices || []).length ? t.invoices.map(inv => {
    const bal = invoiceBalance(t, inv), overdue = invoiceOverdue(t, inv);
    const dispStatus = overdue ? "Overdue" : (bal <= 0 ? "Paid" : (bal < inv.total ? "Partially Paid" : "Unpaid"));
    const hasLocalFile = !!LOCAL_INVOICE_FILES[inv.invoiceId];
    return `<div class="fin-list-item">
      <div class="fin-list-item-top"><strong>${escapeHtml(inv.invoiceNumber) || "Invoice"}</strong><span class="status-pill ${statusPillClass(dispStatus)}">${dispStatus}</span></div>
      <div class="fin-list-item-meta">${escapeHtml(inv.vendor) || t.vendor || ""} · ${fmtMoney(inv.total)}${inv.dueDate ? " · Due " + fmtDate(parseISO(inv.dueDate)) : ""} · Balance ${fmtMoney(bal)}</div>
      <div class="fin-list-item-meta">${inv.fileName ? "📎 " + escapeHtml(inv.fileName) + (hasLocalFile ? "" : " (preview not available in this session)") : "No file attached"}</div>
      <div class="fin-list-actions">
        ${hasLocalFile ? `<button data-caction="inv-view" data-id="${inv.invoiceId}">View</button><button data-caction="inv-download" data-id="${inv.invoiceId}">Download</button>` : ""}
        <button data-caction="inv-attach" data-id="${inv.invoiceId}">${inv.fileName ? "Replace file" : "Attach PDF"}</button>
        <button class="danger" data-caction="inv-delete" data-id="${inv.invoiceId}">Delete</button>
      </div>
    </div>`;
  }).join("") : `<div class="empty-note">No invoices yet.</div>`;

  const paymentsHtml = t && (t.payments || []).length ? t.payments.map(p => {
    const inv = (t.invoices || []).find(i => i.invoiceId === p.invoiceId);
    return `<div class="fin-list-item">
      <div class="fin-list-item-top"><strong>${fmtMoney(p.amount)}</strong><span class="fin-list-item-meta">${p.date ? fmtDate(parseISO(p.date)) : "No date"}</span></div>
      <div class="fin-list-item-meta">${inv ? "Applied to " + escapeHtml(inv.invoiceNumber) : "Not linked to an invoice"}${p.method ? " · " + escapeHtml(p.method) : ""}${p.reference ? " · Ref " + escapeHtml(p.reference) : ""}</div>
      ${p.notes ? `<div class="fin-list-item-meta">${escapeHtml(p.notes)}</div>` : ""}
      <div class="fin-list-actions"><button class="danger" data-caction="pay-delete" data-id="${p.paymentId}">Delete</button></div>
    </div>`;
  }).join("") : `<div class="empty-note">No payments recorded yet.</div>`;

  const invoiceOptionsForPayment = t ? `<option value="">— Not linked to an invoice —</option>` + t.invoices.map(inv => `<option value="${inv.invoiceId}">${escapeHtml(inv.invoiceNumber)} (${fmtMoney(invoiceBalance(t, inv))} owing)</option>`).join("") : "";

  const summaryBlock = t ? `
    <div class="fin-grid">
      <div class="fin-stat"><div class="fin-stat-label">Revised Contract</div><div class="fin-stat-val">${fmtMoney(revisedContractValue(t))}</div></div>
      <div class="fin-stat"><div class="fin-stat-label">Total Invoiced</div><div class="fin-stat-val">${fmtMoney(tradeTotalInvoiced(t))}</div></div>
      <div class="fin-stat"><div class="fin-stat-label">Total Paid</div><div class="fin-stat-val">${fmtMoney(tradeTotalPaid(t))}</div></div>
      <div class="fin-stat"><div class="fin-stat-label">Outstanding</div><div class="fin-stat-val">${fmtMoney(tradeOutstanding(t))}</div></div>
    </div>
    <div class="fin-stat" style="margin-bottom:16px;"><div class="fin-stat-label">Payment Status</div><div class="fin-stat-val"><span class="status-pill ${statusPillClass(tradePaymentStatus(t))}">${tradePaymentStatus(t)}</span></div></div>` : "";

  body.innerHTML = `
    <div class="fin-section">
      <div class="fin-section-title">Trade Details ${t ? `<span class="trade-id-tag">${t.tradeId}</span>` : ""}</div>
      <div class="field"><label>Trade Name *</label><input type="text" id="tName" value="${t ? escapeHtml(t.tradeName) : ""}" placeholder="e.g. Roofing"></div>
      <div class="field-row">
        <div class="field"><label>Vendor / Contractor</label><input type="text" id="tVendor" value="${t ? escapeHtml(t.vendor) : ""}"></div>
        <div class="field"><label>Scope of Work</label><input type="text" id="tScope" value="${t ? escapeHtml(t.scope) : ""}"></div>
      </div>
      <div class="field"><label>Properties (a trade can link to more than one)</label><div class="checkbox-list">${siteCheckboxesHtml(t ? t.siteIds : (presetSiteId ? [presetSiteId] : []))}</div></div>
      <div class="field-row">
        <div class="field"><label>Contract Amount</label><input type="number" id="tContract" min="0" step="1" value="${t ? t.contractAmount : ""}"></div>
        <div class="field"><label>HST</label><input type="number" id="tHst" min="0" step="1" value="${t ? t.hst : ""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Payment Terms</label><input type="text" id="tTerms" value="${t ? escapeHtml(t.paymentTerms) : ""}" placeholder="e.g. Net 30"></div>
        <div class="field"><label>PO Number</label><input type="text" id="tPo" value="${t ? escapeHtml(t.poNumber) : ""}"></div>
      </div>
      <div class="field"><label>Status</label><select id="tWorkStatus">${WORK_STATUS_OPTIONS.map(s => `<option ${t && t.workStatus === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field"><label>Notes</label><textarea id="tNotes">${t ? escapeHtml(t.notes) : ""}</textarea></div>
      <div class="modal-error" id="tError"></div>
      <button class="btn primary" data-taction="save">${isNew ? "Save Trade" : "Save Changes"}</button>
    </div>
    ${t ? `
    <div class="fin-section">${summaryBlock}</div>
    <div class="fin-section">
      <div class="fin-section-title">Change Orders</div>${changeOrdersHtml}
      <div class="fin-add-form">
        <div class="field"><label>Description</label><input type="text" id="coDescription"></div>
        <div class="field-row"><div class="field"><label>Date</label><input type="date" id="coDate"></div><div class="field"><label>Amount</label><input type="number" id="coAmount" min="0" step="1"></div></div>
        <div class="field-row"><div class="field"><label>Approved By</label><input type="text" id="coApprovedBy"></div><div class="field"><label>Status</label><select id="coStatus"><option>Pending</option><option>Approved</option><option>Rejected</option></select></div></div>
        <div class="field"><label>Notes</label><textarea id="coNotes"></textarea></div>
        <button class="btn" data-taction="co-add">Add Change Order</button>
      </div>
    </div>
    <div class="fin-section">
      <div class="fin-section-title">Invoices</div>${invoicesHtml}
      <div class="fin-add-form">
        <div class="fin-dropzone" id="invDropzone">Drag &amp; drop a PDF here, or <span style="color:var(--accent); font-weight:600;">browse files</span><input type="file" id="invFileInput" accept="application/pdf" style="display:none;"></div>
        <div class="fin-note" id="invFileStatus" style="display:none;"></div>
        <div class="field-row"><div class="field"><label>Invoice Number</label><input type="text" id="invNumber"></div><div class="field"><label>Vendor</label><input type="text" id="invVendor" value="${escapeHtml(t.vendor)}"></div></div>
        <div class="field-row"><div class="field"><label>Invoice Date</label><input type="date" id="invDate"></div><div class="field"><label>Due Date</label><input type="date" id="invDue"></div></div>
        <div class="field-row"><div class="field"><label>Subtotal</label><input type="number" id="invSubtotal" min="0" step="1"></div><div class="field"><label>HST</label><input type="number" id="invHst" min="0" step="1"></div></div>
        <div class="field"><label>Total (subtotal + HST)</label><div class="dep-static" id="invTotalDisplay">$0</div></div>
        <div class="field"><label>Notes</label><textarea id="invNotes"></textarea></div>
        <button class="btn" data-taction="inv-add">Add Invoice</button>
      </div>
    </div>
    <div class="fin-section">
      <div class="fin-section-title">Payments</div>${paymentsHtml}
      <div class="fin-add-form">
        <div class="field-row"><div class="field"><label>Amount</label><input type="number" id="payAmount" min="0" step="1"></div><div class="field"><label>Date</label><input type="date" id="payDate"></div></div>
        <div class="field"><label>Applies to Invoice</label><select id="payInvoice">${invoiceOptionsForPayment}</select></div>
        <div class="field-row"><div class="field"><label>Payment Method</label><input type="text" id="payMethod" placeholder="e.g. E-transfer"></div><div class="field"><label>Payment Reference</label><input type="text" id="payReference"></div></div>
        <div class="field"><label>Notes</label><textarea id="payNotes"></textarea></div>
        ${t.invoices.length === 0 ? `<div class="fin-note">This trade has no invoices yet — you can still record a payment, but consider adding the invoice first for a full paper trail.</div>` : ""}
        <button class="btn" data-taction="pay-add">Add Payment</button>
      </div>
    </div>
    <div class="fin-section">
      <div class="fin-section-title">Trade Status</div>
      ${t.active ? `<button class="btn danger" data-taction="archive-open">Archive Trade</button>` : `<button class="btn primary" data-taction="restore-open">Restore Trade</button>`}
      <button class="link-btn" style="margin-top:10px;" data-taction="delete-open">Permanently delete this trade instead</button>
    </div>` : ""}
  `;
  wireTradeModalInputs(t);
}

function wireTradeModalInputs(t) {
  const body = document.getElementById("tradeModalBody");
  body.onclick = (e) => handleTradeModalClick(e);
  body.onchange = (e) => handleTradeModalChange(e);
  if (!t) return;
  const subtotalEl = document.getElementById("invSubtotal"), hstEl = document.getElementById("invHst"), totalDisplay = document.getElementById("invTotalDisplay");
  const updateTotal = () => { totalDisplay.textContent = fmtMoney((Number(subtotalEl.value) || 0) + (Number(hstEl.value) || 0)); };
  subtotalEl.addEventListener("input", updateTotal);
  hstEl.addEventListener("input", updateTotal);
  const dropzone = document.getElementById("invDropzone"), fileInput = document.getElementById("invFileInput"), fileStatus = document.getElementById("invFileStatus");
  const showStaged = () => {
    if (PENDING_INVOICE_FILE) { fileStatus.style.display = "block"; fileStatus.textContent = `Staged: ${PENDING_INVOICE_FILE.file.name} — will attach when you click "Add Invoice."`; }
    else fileStatus.style.display = "none";
  };
  const stageFile = (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Please choose a PDF file."); return; }
    if (PENDING_INVOICE_FILE) URL.revokeObjectURL(PENDING_INVOICE_FILE.objectUrl);
    PENDING_INVOICE_FILE = { file, objectUrl: URL.createObjectURL(file) };
    showStaged();
  };
  dropzone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => stageFile(e.target.files[0]);
  dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); };
  dropzone.ondragleave = () => dropzone.classList.remove("drag-over");
  dropzone.ondrop = (e) => { e.preventDefault(); dropzone.classList.remove("drag-over"); stageFile(e.dataTransfer.files[0]); };
  showStaged();
}

function handleTradeModalClick(e) {
  const btn = e.target.closest("[data-taction], [data-caction]");
  if (!btn) return;
  const taction = btn.dataset.taction, caction = btn.dataset.caction, id = btn.dataset.id;
  if (taction === "save") return saveTradeModal();
  if (taction === "co-add") return addChangeOrder();
  if (taction === "inv-add") return addInvoice();
  if (taction === "pay-add") return addPayment();
  if (taction === "archive-open") return archiveTradePrompt(STATE.openTradeId);
  if (taction === "restore-open") return restoreTrade(STATE.openTradeId);
  if (taction === "delete-open") return deleteTradePrompt(STATE.openTradeId);
  if (caction === "co-delete") return deleteChangeOrder(id);
  if (caction === "inv-delete") return deleteInvoice(id);
  if (caction === "inv-view") return viewInvoiceFile(id);
  if (caction === "inv-download") return downloadInvoiceFile(id);
  if (caction === "inv-attach") return attachInvoiceFile(id);
  if (caction === "pay-delete") return deletePayment(id);
}

function handleTradeModalChange(e) {
  const el = e.target;
  if (el.dataset.caction === "co-status") {
    const t = getOpenTrade(), c = t.changeOrders.find(x => x.changeOrderId === el.dataset.id);
    if (!c) return;
    const old = c.status; c.status = el.value;
    STATE.lastUpdated = new Date();
    logActivity(`Trade cost updated: ${t.tradeName} (change order "${c.description || c.changeOrderId}" ${old} → ${c.status})`);
    firebaseSave(); renderAll(); renderTradeModal();
  }
  if (el.id === "invFileInputHidden") {
    const file = el.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Please choose a PDF file."); return; }
    const t = getOpenTrade(), inv = t.invoices.find(x => x.invoiceId === PENDING_ATTACH_INVOICE_ID);
    if (!inv) return;
    if (LOCAL_INVOICE_FILES[inv.invoiceId]) URL.revokeObjectURL(LOCAL_INVOICE_FILES[inv.invoiceId]);
    LOCAL_INVOICE_FILES[inv.invoiceId] = URL.createObjectURL(file);
    inv.fileName = file.name;
    STATE.lastUpdated = new Date();
    logActivity(`Invoice attached to: ${t.tradeName} (${inv.invoiceNumber})`);
    firebaseSave(); renderAll(); renderTradeModal();
    alert("Invoice uploaded successfully.");
  }
}

function saveTradeModal() {
  const errEl = document.getElementById("tError");
  const tradeName = document.getElementById("tName").value.trim();
  if (!tradeName) { errEl.textContent = "Trade Name is required."; return; }
  const vendor = document.getElementById("tVendor").value.trim();
  const scope = document.getElementById("tScope").value.trim();
  const siteIds = Array.from(document.querySelectorAll(".tSiteCheck:checked")).map(cb => cb.value);
  const contractAmount = Number(document.getElementById("tContract").value) || 0;
  const hst = Number(document.getElementById("tHst").value) || 0;
  const paymentTerms = document.getElementById("tTerms").value.trim();
  const poNumber = document.getElementById("tPo").value.trim();
  const workStatus = document.getElementById("tWorkStatus").value;
  const notes = document.getElementById("tNotes").value.trim();
  let t = getOpenTrade();
  const now = new Date().toISOString();
  if (!t) {
    t = { tradeId: nextTradeId(), tradeName, vendor, scope, siteIds, contractAmount, hst, workStatus, paymentTerms, poNumber, notes, active: true, createdAt: now, updatedAt: now, changeOrders: [], invoices: [], payments: [] };
    STATE.trades.push(t);
    logActivity(`New trade added: ${tradeName}`);
    STATE.openTradeId = t.tradeId;
  } else {
    const nameChanged = t.tradeName !== tradeName, oldName = t.tradeName;
    t.tradeName = tradeName; t.vendor = vendor; t.scope = scope; t.siteIds = siteIds;
    t.contractAmount = contractAmount; t.hst = hst; t.paymentTerms = paymentTerms; t.poNumber = poNumber; t.workStatus = workStatus; t.notes = notes; t.updatedAt = now;
    logActivity(nameChanged ? `Trade name changed: ${oldName} → ${tradeName}` : `Trade cost updated: ${tradeName}`);
  }
  STATE.lastUpdated = new Date();
  firebaseSave(); renderAll(); renderTradeModal();
}

function addChangeOrder() {
  const t = getOpenTrade();
  const description = document.getElementById("coDescription").value.trim();
  if (!description) { alert("Enter a description for the change order."); return; }
  const date = document.getElementById("coDate").value || null;
  const amount = Number(document.getElementById("coAmount").value) || 0;
  const approvedBy = document.getElementById("coApprovedBy").value.trim();
  const status = document.getElementById("coStatus").value;
  const notes = document.getElementById("coNotes").value.trim();
  t.changeOrders.push({ changeOrderId: nextFinId(), description, date, amount, approvedBy, status, notes });
  t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Trade cost updated: ${t.tradeName} (change order added — ${description}, ${fmtMoney(amount)})`);
  firebaseSave(); renderAll(); renderTradeModal();
}
function deleteChangeOrder(coId) {
  const t = getOpenTrade(), c = t.changeOrders.find(x => x.changeOrderId === coId);
  if (!c || !confirm(`Delete change order "${c.description}"?`)) return;
  t.changeOrders = t.changeOrders.filter(x => x.changeOrderId !== coId);
  t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Trade cost updated: ${t.tradeName} (change order deleted — ${c.description})`);
  firebaseSave(); renderAll(); renderTradeModal();
}

function addInvoice() {
  const t = getOpenTrade();
  const invoiceNumber = document.getElementById("invNumber").value.trim();
  if (!invoiceNumber) { alert("Enter an invoice number."); return; }
  const vendor = document.getElementById("invVendor").value.trim();
  const invoiceDate = document.getElementById("invDate").value || null;
  const dueDate = document.getElementById("invDue").value || null;
  const subtotal = Number(document.getElementById("invSubtotal").value) || 0;
  const hst = Number(document.getElementById("invHst").value) || 0;
  const total = subtotal + hst;
  if (total <= 0) { alert("Invoice total must be greater than $0."); return; }
  const notes = document.getElementById("invNotes").value.trim();
  const invoiceId = nextFinId();
  const fileName = PENDING_INVOICE_FILE ? PENDING_INVOICE_FILE.file.name : "";
  if (PENDING_INVOICE_FILE) { LOCAL_INVOICE_FILES[invoiceId] = PENDING_INVOICE_FILE.objectUrl; PENDING_INVOICE_FILE = null; }
  t.invoices.push({ invoiceId, invoiceNumber, vendor, invoiceDate, dueDate, subtotal, hst, total, fileName, notes });
  t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Invoice attached to: ${t.tradeName} (${invoiceNumber}, ${fmtMoney(total)})`);
  firebaseSave(); renderAll(); renderTradeModal();
  if (fileName) alert("Invoice uploaded successfully.");
}
function deleteInvoice(invId) {
  const t = getOpenTrade(), inv = t.invoices.find(x => x.invoiceId === invId);
  if (!inv) return;
  const linkedPayments = t.payments.filter(p => p.invoiceId === invId).length;
  const warn = linkedPayments ? ` This invoice has ${linkedPayments} payment(s) recorded against it — they will stay on the trade but become unlinked.` : "";
  if (!confirm(`Delete invoice "${inv.invoiceNumber}"?${warn}`)) return;
  if (LOCAL_INVOICE_FILES[invId]) { URL.revokeObjectURL(LOCAL_INVOICE_FILES[invId]); delete LOCAL_INVOICE_FILES[invId]; }
  t.invoices = t.invoices.filter(x => x.invoiceId !== invId);
  t.payments.forEach(p => { if (p.invoiceId === invId) p.invoiceId = null; });
  t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Trade cost updated: ${t.tradeName} (invoice deleted — ${inv.invoiceNumber})`);
  firebaseSave(); renderAll(); renderTradeModal();
}
function attachInvoiceFile(invId) {
  PENDING_ATTACH_INVOICE_ID = invId;
  let hidden = document.getElementById("invFileInputHidden");
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "file"; hidden.accept = "application/pdf"; hidden.id = "invFileInputHidden"; hidden.style.display = "none";
    document.getElementById("tradeModalBody").appendChild(hidden);
    hidden.addEventListener("change", handleTradeModalChange);
  }
  hidden.click();
}
function viewInvoiceFile(invId) {
  const url = LOCAL_INVOICE_FILES[invId];
  if (!url) { alert("This PDF is only available in the browser session it was uploaded in. Real file storage is needed to make invoices viewable everywhere."); return; }
  window.open(url, "_blank");
}
function downloadInvoiceFile(invId) {
  const t = getOpenTrade(), inv = t.invoices.find(x => x.invoiceId === invId), url = LOCAL_INVOICE_FILES[invId];
  if (!url || !inv) { alert("This PDF is only available in the browser session it was uploaded in."); return; }
  const a = document.createElement("a");
  a.href = url; a.download = inv.fileName || "invoice.pdf";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function addPayment() {
  const t = getOpenTrade();
  const amount = Number(document.getElementById("payAmount").value) || 0;
  if (amount <= 0) { alert("Payment amount must be greater than $0."); return; }
  const date = document.getElementById("payDate").value || null;
  const invoiceIdRaw = document.getElementById("payInvoice").value;
  const invoiceId = invoiceIdRaw ? Number(invoiceIdRaw) : null;
  const method = document.getElementById("payMethod").value.trim();
  const reference = document.getElementById("payReference").value.trim();
  const notes = document.getElementById("payNotes").value.trim();
  if (!invoiceId && t.invoices.length > 0) { if (!confirm("This payment isn't linked to a specific invoice. Add it anyway?")) return; }
  t.payments.push({ paymentId: nextFinId(), invoiceId, amount, date, method, reference, notes });
  t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Payment added to: ${t.tradeName} (${fmtMoney(amount)})`);
  firebaseSave(); renderAll(); renderTradeModal();
}
function deletePayment(payId) {
  const t = getOpenTrade(), p = t.payments.find(x => x.paymentId === payId);
  if (!p || !confirm(`Delete this ${fmtMoney(p.amount)} payment?`)) return;
  t.payments = t.payments.filter(x => x.paymentId !== payId);
  t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Trade cost updated: ${t.tradeName} (payment deleted — ${fmtMoney(p.amount)})`);
  firebaseSave(); renderAll(); renderTradeModal();
}

/* ============================================================
   ARCHIVE / RESTORE / DELETE TRADE
   ============================================================ */

function archiveTradePrompt(tradeId) { const t = STATE.trades.find(x => x.tradeId === tradeId); if (t) openRemoveTradeModal(t); }
function deleteTradePrompt(tradeId) { const t = STATE.trades.find(x => x.tradeId === tradeId); if (t) openRemoveTradeModal(t, true); }
function hasFinancialHistory(t) { return (t.invoices || []).length > 0 || (t.payments || []).length > 0 || (t.changeOrders || []).length > 0; }

function openRemoveTradeModal(t, forceDeleteView) {
  const overlay = document.getElementById("removeTradeOverlay"), body = document.getElementById("removeTradeBody");
  overlay.classList.add("show");
  const hasHistory = hasFinancialHistory(t), showDelete = forceDeleteView || !hasHistory;
  const summary = `
    <div class="fin-stat" style="margin-bottom:14px;"><div class="fin-stat-label">Trade</div><div class="fin-stat-val" style="font-size:15px;">${escapeHtml(t.tradeName)}</div></div>
    <div class="fin-grid">
      <div class="fin-stat"><div class="fin-stat-label">Contract Amount</div><div class="fin-stat-val">${fmtMoney(revisedContractValue(t))}</div></div>
      <div class="fin-stat"><div class="fin-stat-label">Invoices</div><div class="fin-stat-val">${(t.invoices || []).length}</div></div>
      <div class="fin-stat"><div class="fin-stat-label">Payments</div><div class="fin-stat-val">${(t.payments || []).length}</div></div>
      <div class="fin-stat"><div class="fin-stat-label">Change Orders</div><div class="fin-stat-val">${(t.changeOrders || []).length}</div></div>
    </div>`;
  if (!showDelete) {
    body.innerHTML = `<p>Remove this trade?</p>${summary}<div class="fin-note">This trade has financial history, so it will be <strong>archived</strong> instead of deleted — its invoices, payments, and change orders stay fully intact and accessible, and you can restore it any time from the "Archived" filter.</div>
      <div class="modal-foot" style="padding:16px 0 0; border-top:none;"><button class="btn" data-raction="cancel">Cancel</button><button class="btn primary" data-raction="archive">Archive Trade</button></div>`;
  } else {
    body.innerHTML = `<p>${hasHistory ? `This trade has ${(t.invoices||[]).length} invoice(s) and ${(t.payments||[]).length} payment(s). Permanently deleting it will remove its associated records.` : "Remove this trade permanently? This cannot be undone."}</p>${summary}
      ${hasHistory ? `<div class="field"><label>Type DELETE to confirm permanent deletion</label><input type="text" id="deleteConfirmInput" placeholder="DELETE"></div>` : ""}
      <div class="modal-foot" style="padding:16px 0 0; border-top:none;"><button class="btn" data-raction="cancel">Cancel</button>${hasHistory ? `<button class="btn" data-raction="archive">Archive Instead</button>` : ""}<button class="btn danger" data-raction="delete-confirm">Permanently Delete</button></div>`;
  }
  body.onclick = (e) => {
    const btn = e.target.closest("[data-raction]");
    if (!btn) return;
    const action = btn.dataset.raction;
    if (action === "cancel") return closeRemoveTradeModal();
    if (action === "archive") return doArchiveTrade(t.tradeId);
    if (action === "delete-confirm") {
      if (hasHistory) {
        const input = document.getElementById("deleteConfirmInput");
        if (!input || input.value.trim().toUpperCase() !== "DELETE") { alert('Type "DELETE" exactly to confirm permanent deletion.'); return; }
      }
      return doDeleteTrade(t.tradeId);
    }
  };
}
function closeRemoveTradeModal() { document.getElementById("removeTradeOverlay").classList.remove("show"); }

function doArchiveTrade(tradeId) {
  const t = STATE.trades.find(x => x.tradeId === tradeId);
  if (!t) return;
  t.active = false; t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Trade archived: ${t.tradeName}`);
  firebaseSave(); closeRemoveTradeModal(); closeTradeModal(); renderAll();
}
function doDeleteTrade(tradeId) {
  const t = STATE.trades.find(x => x.tradeId === tradeId);
  if (!t) return;
  (t.invoices || []).forEach(inv => { if (LOCAL_INVOICE_FILES[inv.invoiceId]) { URL.revokeObjectURL(LOCAL_INVOICE_FILES[inv.invoiceId]); delete LOCAL_INVOICE_FILES[inv.invoiceId]; } });
  STATE.trades = STATE.trades.filter(x => x.tradeId !== tradeId);
  STATE.lastUpdated = new Date();
  logActivity(`Trade permanently deleted: ${t.tradeName}`);
  firebaseSave(); closeRemoveTradeModal(); closeTradeModal(); renderAll();
}
function restoreTrade(tradeId) {
  const t = STATE.trades.find(x => x.tradeId === tradeId);
  if (!t) return;
  t.active = true; t.updatedAt = new Date().toISOString();
  STATE.lastUpdated = new Date();
  logActivity(`Trade restored: ${t.tradeName}`);
  firebaseSave(); renderAll();
  if (STATE.openTradeId === tradeId) renderTradeModal();
}

/* ============================================================
   GALLERY
   ============================================================ */

function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";
  STATE.photos.forEach(p => {
    const url = LOCAL_PHOTO_URLS[p.photoId];
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.onclick = () => openLightbox(p.photoId);
    item.innerHTML = url
      ? `<img src="${url}" alt="${escapeHtml(p.caption)}"><div class="gallery-item-cap">${escapeHtml(p.caption) || "Untitled"}</div>`
      : `<div class="gallery-empty-tile">📷<br>${escapeHtml(p.fileName) || "Photo"}<br><span style="opacity:.7;">not available in this session</span></div><div class="gallery-item-cap">${escapeHtml(p.caption) || "Untitled"}</div>`;
    grid.appendChild(item);
  });
  const uploadTile = document.createElement("div");
  uploadTile.className = "gallery-empty-tile edit-only";
  uploadTile.style.cursor = "pointer";
  uploadTile.innerHTML = "+ Add Photo";
  uploadTile.onclick = () => document.getElementById("photoFileInput").click();
  grid.appendChild(uploadTile);
}
function openLightbox(photoId) {
  const p = STATE.photos.find(x => x.photoId === photoId), url = LOCAL_PHOTO_URLS[photoId];
  if (!url) { alert("This photo is only available in the browser it was uploaded in — persistent photo storage isn't wired up yet."); return; }
  document.getElementById("lightboxImg").src = url;
  document.getElementById("lightboxCap").textContent = p.caption || "";
  document.getElementById("lightboxOverlay").classList.add("show");
}
function closeLightbox() { document.getElementById("lightboxOverlay").classList.remove("show"); }
function handlePhotoFileChosen(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
  const caption = prompt("Caption for this photo (optional):", "") || "";
  const siteChoice = prompt(`Which property is this photo for? Type one of: ${STATE.sites.map(s => s.siteId).join(", ")} — or leave blank for general project photos.`, "") || "";
  const siteId = STATE.sites.some(s => s.siteId === siteChoice) ? siteChoice : null;
  const photoId = nextPhotoId();
  LOCAL_PHOTO_URLS[photoId] = URL.createObjectURL(file);
  STATE.photos.push({ photoId, siteId, caption, fileName: file.name, uploadedAt: new Date().toISOString() });
  STATE.lastUpdated = new Date();
  logActivity(`Photo added to gallery${siteId ? " (" + siteId + ")" : ""}${caption ? ": " + caption : ""}`);
  firebaseSave(); renderAll();
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  document.getElementById("photoFileInput").onchange = (e) => { handlePhotoFileChosen(e.target.files[0]); e.target.value = ""; };
  document.getElementById("btnAddProperty").onclick = () => openSiteInfoModal(null);
  document.getElementById("btnCloseTaskModal").onclick = closeTaskModal;
  document.getElementById("btnCancelTaskModal").onclick = closeTaskModal;
  document.getElementById("btnSaveTaskModal").onclick = saveTaskModal;
  document.getElementById("taskModalOverlay").onclick = (e) => { if (e.target.id === "taskModalOverlay") closeTaskModal(); };
  document.getElementById("btnCloseSiteModal").onclick = closeSiteInfoModal;
  document.getElementById("btnCancelSiteModal").onclick = closeSiteInfoModal;
  document.getElementById("btnSaveSiteModal").onclick = saveSiteInfoModal;
  document.getElementById("siteModalOverlay").onclick = (e) => { if (e.target.id === "siteModalOverlay") closeSiteInfoModal(); };
  document.getElementById("lightboxOverlay").onclick = (e) => { if (e.target.id === "lightboxOverlay") closeLightbox(); };
  document.getElementById("btnCloseLightbox").onclick = closeLightbox;
  document.getElementById("btnActivityPrev").onclick = () => { STATE.activityPage--; renderActivity(); };
  document.getElementById("btnActivityNext").onclick = () => { STATE.activityPage++; renderActivity(); };

  document.getElementById("btnAddTrade").onclick = () => openTradeModal(null);
  document.getElementById("tradeCostTableBody").onclick = handleTradeTableClick;
  document.getElementById("btnCloseTradeModal").onclick = closeTradeModal;
  document.getElementById("btnCancelTradeModal").onclick = closeTradeModal;
  document.getElementById("tradeModalOverlay").onclick = (e) => { if (e.target.id === "tradeModalOverlay") closeTradeModal(); };
  document.getElementById("removeTradeOverlay").onclick = (e) => { if (e.target.id === "removeTradeOverlay") closeRemoveTradeModal(); };

  renderTradeFilterTabs();
  firebaseListen();
}

document.addEventListener("DOMContentLoaded", initAuthGate);
