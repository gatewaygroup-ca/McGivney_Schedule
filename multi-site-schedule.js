/* ============================================================
   MULTI-SITE SCHEDULE ENGINE
   Shared by McGivney and Kiwanis — each project supplies its own
   PROJECT / HOLIDAYS / BASELINE_SITES / BASELINE_PHOTOS via its own
   -data.js file, loaded before this one. Firebase path comes from
   PROJECT.firebasePath, so each project's data lives at its own
   root in the same shared database (separate from 43 Munn's
   "schedule" node and from the shared "roles" node).

   Unlike 43 Munn, tasks here are NOT duration+dependency-cascaded —
   each task has its own directly-editable start/end date, matching
   how these two projects' schedules actually work (independently
   sequenced trade windows, not a chained critical path).
   ============================================================ */

const STATE = {
  sites: deepClone(BASELINE_SITES),
  holidays: deepClone(HOLIDAYS),
  photos: deepClone(BASELINE_PHOTOS),
  activity: [],
  activityPage: 1,
  lastUpdated: new Date(),
  userEmail: null,
  userRole: null,
  editMode: false,
  openSiteId: null,
  openMilestoneId: null,
  openPhotoId: null,
};

const ACTIVITY_PAGE_SIZE = 5;
const TASK_STATUS_OPTIONS = ["complete", "inprog", "high", "med", "low"];
const TASK_STATUS_LABEL = { complete: "Complete", inprog: "In Progress", high: "High Priority", med: "Medium Priority", low: "Low Priority" };
const TASK_STATUS_DOT = { complete: "dot-complete", inprog: "dot-inprog", high: "dot-high", med: "dot-med", low: "dot-low" };

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDate(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function fmtDateShort(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function calendarDaysInclusive(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000) + 1; }

/* ============================================================
   DERIVED METRICS
   ============================================================ */

function siteProgress(site) {
  const total = site.milestones.length;
  if (!total) return 0;
  const done = site.milestones.filter(m => m.status === "complete").length;
  return Math.round((done / total) * 100);
}
function overallProgress() {
  const all = STATE.sites.flatMap(s => s.milestones);
  if (!all.length) return 0;
  return Math.round((all.filter(m => m.status === "complete").length / all.length) * 100);
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

/* ============================================================
   FIREBASE — sanitize/rehydrate, save/listen, auth
   ============================================================ */

function sanitizeMilestone(m) {
  return { id: m.id, task: m.task || "", start: m.start, end: m.end, status: m.status || "low", notes: m.notes || "" };
}
function sanitizeSite(s) {
  return {
    siteId: s.siteId, name: s.name || "", addr: s.addr || "", type: s.type || "",
    target: s.target || "", winterRisk: !!s.winterRisk, badgeText: s.badgeText || "", note: s.note || "",
    milestones: (Array.isArray(s.milestones) ? s.milestones : []).map(sanitizeMilestone),
  };
}
function sanitizePhoto(p) {
  return {
    photoId: p.photoId, siteId: (p.siteId === undefined ? null : p.siteId),
    caption: p.caption || "", fileName: p.fileName || "", uploadedAt: p.uploadedAt || new Date().toISOString(),
  };
}

const LOCAL_PHOTO_URLS = {}; // session-only object URLs, keyed by photoId — never synced to Firebase

function firebaseSave(force) {
  if (typeof db === "undefined") return;
  if (!force && !isEditingNow()) {
    console.warn("Blocked a write attempt: not in Edit Mode, or role doesn't permit editing.");
    alert(canEdit() ? 'Click "Edit Schedule" to make changes.' : "You're signed in as a Viewer and can't make changes to this project.");
    return;
  }
  const payload = {
    sites: STATE.sites.map(sanitizeSite),
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
      STATE.sites = deepClone(BASELINE_SITES);
      STATE.holidays = deepClone(HOLIDAYS);
      STATE.photos = deepClone(BASELINE_PHOTOS);
      STATE.activity = [];
      STATE.lastUpdated = new Date();
      logActivity(`Schedule loaded — baseline for ${PROJECT.name}.`);
      firebaseSave(true);
      return;
    }
    STATE.sites = (val.sites || deepClone(BASELINE_SITES)).map(sanitizeSite);
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
  if (typeof auth === "undefined") {
    gate.innerHTML = '<div class="auth-gate-inner">Authentication isn\'t available right now. Please try again shortly.</div>';
    return;
  }
  auth.onAuthStateChanged((user) => {
    if (!user) { window.location.href = "login.html"; return; }
    STATE.userEmail = user.email;
    db.ref("roles/" + user.uid).once("value").then((snap) => {
      const role = snap.val();
      if (!role) {
        gate.innerHTML = `<div class="auth-gate-inner">Your account (${escapeHtml(user.email)}) doesn't have access to this project yet.<br>Contact your Gateway admin to be assigned a role.<br><br><button class="btn" id="btnGateLogout">Log Out</button></div>`;
        document.getElementById("btnGateLogout").onclick = () => auth.signOut().then(() => window.location.href = "login.html");
        return;
      }
      STATE.userRole = role;
      gate.style.display = "none";
      appWrap.style.display = "block";
      init();
      document.getElementById("userEmailLabel").textContent = user.email;
      document.getElementById("userRoleBadge").textContent = role;
      document.getElementById("btnLogout").onclick = () => auth.signOut().then(() => window.location.href = "login.html");
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
  if (STATE.activity.length === 0) {
    el.innerHTML = `<div class="empty-note">No changes yet this session.</div>`;
    updatePager(1, 1);
    return;
  }
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
   RENDERING — header, site cards, per-site schedule, gallery
   ============================================================ */

function renderAll() {
  renderHeader();
  renderSiteCards();
  renderSiteSections();
  renderGallery();
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
          <button class="btn edit-only" data-saction="edit-site" data-site="${site.siteId}">Edit Site Info</button>
          <button class="btn primary edit-only" data-saction="add-task" data-site="${site.siteId}">+ Add Task</button>
        </div>
      </div>
      <div class="site-note">${escapeHtml(site.note)}</div>
      <div class="site-task-table-wrap">
        <table class="site-task-table">
          <thead><tr><th>Task</th><th>Dates</th><th>Duration</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
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
  }
}

/* ============================================================
   TASK MODAL — add / edit a milestone task
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
    const oldRange = `${m.start} → ${m.end}`;
    m.task = task; m.start = start; m.end = end; m.status = status; m.notes = notes;
    logActivity(`${site.name}: "${task}" updated (${oldRange} → ${start} → ${end})`);
  } else {
    const id = nextMilestoneId(site);
    site.milestones.push({ id, task, start, end, status, notes });
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
   SITE INFO MODAL
   ============================================================ */

function openSiteInfoModal(siteId) {
  STATE.openSiteId = siteId;
  const site = STATE.sites.find(s => s.siteId === siteId);
  document.getElementById("siteModalTitle").textContent = `Edit Site — ${site.name}`;
  document.getElementById("siName").value = site.name;
  document.getElementById("siAddr").value = site.addr;
  document.getElementById("siType").value = site.type;
  document.getElementById("siTarget").value = site.target;
  document.getElementById("siWinterRisk").checked = site.winterRisk;
  document.getElementById("siBadge").value = site.badgeText || "";
  document.getElementById("siNote").value = site.note;
  document.getElementById("siteModalOverlay").classList.add("show");
}
function closeSiteInfoModal() { document.getElementById("siteModalOverlay").classList.remove("show"); }

function saveSiteInfoModal() {
  const site = STATE.sites.find(s => s.siteId === STATE.openSiteId);
  site.name = document.getElementById("siName").value.trim();
  site.addr = document.getElementById("siAddr").value.trim();
  site.type = document.getElementById("siType").value.trim();
  site.target = document.getElementById("siTarget").value.trim();
  site.winterRisk = document.getElementById("siWinterRisk").checked;
  site.badgeText = document.getElementById("siBadge").value.trim();
  site.note = document.getElementById("siNote").value.trim();
  STATE.lastUpdated = new Date();
  logActivity(`${site.name}: site information updated`);
  firebaseSave();
  renderAll();
  closeSiteInfoModal();
}

/* ============================================================
   GALLERY
   ============================================================ */

let PENDING_PHOTO_FILE = null;

function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";
  STATE.photos.forEach(p => {
    const url = LOCAL_PHOTO_URLS[p.photoId];
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.onclick = () => openLightbox(p.photoId);
    if (url) {
      item.innerHTML = `<img src="${url}" alt="${escapeHtml(p.caption)}"><div class="gallery-item-cap">${escapeHtml(p.caption) || "Untitled"}</div>`;
    } else {
      item.innerHTML = `<div class="gallery-empty-tile">📷<br>${escapeHtml(p.fileName) || "Photo"}<br><span style="opacity:.7;">not available in this session</span></div><div class="gallery-item-cap">${escapeHtml(p.caption) || "Untitled"}</div>`;
    }
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
  const p = STATE.photos.find(x => x.photoId === photoId);
  const url = LOCAL_PHOTO_URLS[photoId];
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
  const siteChoice = prompt(`Which site is this photo for? Type one of: ${STATE.sites.map(s => s.siteId).join(", ")} — or leave blank for general project photos.`, "") || "";
  const siteId = STATE.sites.some(s => s.siteId === siteChoice) ? siteChoice : null;
  const photoId = nextPhotoId();
  LOCAL_PHOTO_URLS[photoId] = URL.createObjectURL(file);
  STATE.photos.push({ photoId, siteId, caption, fileName: file.name, uploadedAt: new Date().toISOString() });
  STATE.lastUpdated = new Date();
  logActivity(`Photo added to gallery${siteId ? " (" + siteId + ")" : ""}${caption ? ": " + caption : ""}`);
  firebaseSave();
  renderAll();
}

/* ============================================================
   INIT
   ============================================================ */

function init() {
  document.getElementById("photoFileInput").onchange = (e) => { handlePhotoFileChosen(e.target.files[0]); e.target.value = ""; };
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
  firebaseListen();
}

document.addEventListener("DOMContentLoaded", initAuthGate);
