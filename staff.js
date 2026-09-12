/* ============================================================
   STAFF RECORDS PAGE
   Loads all staff once, then filters/sorts/paginates
   client-side (fine for the hundreds-of-records scale this
   app targets). Also handles view / edit / delete / print.
   ============================================================ */

const PAGE_SIZE = 10;

let allStaff = [];
let filteredStaff = [];
let currentPage = 1;
let sortField = "staffName";
let sortDir = "asc";
let schoolSettings = {};
const selectedIds = new Set();

requireAuth(async () => {
  renderAppShell({ title: "Staff Records", activePage: "staff.html" });
  const body = document.getElementById("page-body");
  body.appendChild(document.getElementById("tpl-staff-body").content.cloneNode(true));

  wireStaffPage();
  await loadSchoolSettings();
  await loadStaff();
});

async function loadSchoolSettings() {
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    schoolSettings = doc.exists ? doc.data() : {};
  } catch (err) {
    console.error(err);
  }
}

async function loadStaff() {
  const tbody = document.getElementById("staffTbody");
  try {
    const snap = await db.collection(COL_STAFF).get();
    allStaff = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    applyFilters();
  } catch (err) {
    console.error(err);
    toastError("Couldn't load staff records", err.message);
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="ic">⚠</div><div class="t">Couldn't load records</div></div></td></tr>`;
  }
}

function wireStaffPage() {
  const categorySelect = document.getElementById("categoryFilter");
  categorySelect.insertAdjacentHTML(
    "beforeend",
    STAFF_CATEGORIES.map((c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`).join("")
  );
  categorySelect.addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
  });

  document.getElementById("searchInput").addEventListener("input", debounce(() => {
    currentPage = 1;
    applyFilters();
  }, 220));

  document.querySelectorAll("[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortField = field;
        sortDir = "asc";
      }
      document.querySelectorAll("[data-sort] .arrow").forEach((a) => (a.textContent = ""));
      th.querySelector(".arrow").textContent = sortDir === "asc" ? "▾" : "▴";
      applyFilters();
    });
  });

  document.getElementById("selectAllBox").addEventListener("change", (e) => {
    const rowsOnPage = paginatedSlice();
    rowsOnPage.forEach((t) => {
      if (e.target.checked) selectedIds.add(t.id);
      else selectedIds.delete(t.id);
    });
    renderTable();
  });

  document.getElementById("printSelectedBtn").addEventListener("click", () => {
    if (!selectedIds.size) {
      toastWarning("No staff selected", "Tick the checkbox next to one or more staff first.");
      return;
    }
    sessionStorage.setItem("printSelection", JSON.stringify([...selectedIds].map((id) => ({ type: "staff", id }))));
    window.location.href = "print.html?mode=selected";
  });
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const categoryFilter = document.getElementById("categoryFilter").value;

  filteredStaff = allStaff.filter((t) => {
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (!q) return true;
    return (
      (t.staffName || "").toLowerCase().includes(q) ||
      (t.cnic || "").toLowerCase().includes(q) ||
      (t.designation || "").toLowerCase().includes(q) ||
      categoryLabel(t.category).toLowerCase().includes(q)
    );
  });

  filteredStaff.sort((a, b) => {
    const va = (a[sortField] || "").toString().toLowerCase();
    const vb = (b[sortField] || "").toString().toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  document.getElementById("staffCountLabel").textContent =
    `${filteredStaff.length} staff${filteredStaff.length === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`;

  renderTable();
}

function paginatedSlice() {
  const start = (currentPage - 1) * PAGE_SIZE;
  return filteredStaff.slice(start, start + PAGE_SIZE);
}

function renderTable() {
  const tbody = document.getElementById("staffTbody");
  const rows = paginatedSlice();

  if (!filteredStaff.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="ic">🧑‍🏫</div>
      <div class="t">No staff found</div>
      <div class="d">Try a different search or category, or add a new staff member.</div>
      <a href="add-staff.html" class="btn btn-primary btn-sm">＋ Add Staff</a>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = rows.map((t) => `
      <tr>
        <td class="checkbox-cell"><input type="checkbox" class="select-box row-select" data-id="${t.id}" ${selectedIds.has(t.id) ? "checked" : ""}></td>
        <td>${t.photo
          ? `<img class="table-thumb" src="${t.photo}" alt="">`
          : `<div class="table-thumb" style="display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--royal-700);">${initialsOf(t.staffName)}</div>`}
        </td>
        <td>
          <div class="cell-staff">
            <div>
              <div class="name">${escapeHtml(t.staffName || "—")}</div>
              <div class="desig">${escapeHtml(t.mobile || "")}</div>
            </div>
          </div>
        </td>
        <td><span class="badge">${escapeHtml(categoryLabel(t.category))}</span></td>
        <td><span class="badge">${escapeHtml(t.relationType || "—")}</span></td>
        <td>${escapeHtml(t.relationName || "—")}</td>
        <td class="mono">${escapeHtml(t.cnic || "—")}</td>
        <td>${escapeHtml(t.designation || "—")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="View card" data-view="${t.id}">🪪</button>
            <a class="icon-btn" title="Edit" href="add-staff.html?id=${t.id}">✎</a>
            <button class="icon-btn" title="Print" data-print="${t.id}">🖶</button>
            <button class="icon-btn danger" title="Delete" data-delete="${t.id}">🗑</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  renderPagination();
  wireRowActions();
}

function wireRowActions() {
  document.querySelectorAll(".row-select").forEach((box) => {
    box.addEventListener("change", () => {
      if (box.checked) selectedIds.add(box.dataset.id);
      else selectedIds.delete(box.dataset.id);
    });
  });

  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => viewCard(btn.dataset.view));
  });

  document.querySelectorAll("[data-print]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sessionStorage.setItem("printSelection", JSON.stringify([{ type: "staff", id: btn.dataset.print }]));
      window.location.href = "print.html?mode=selected";
    });
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteStaff(btn.dataset.delete));
  });
}

function viewCard(id) {
  const staff = allStaff.find((t) => t.id === id);
  if (!staff) return;
  const overlay = openModal(`
    <h3 style="margin-bottom:16px;">${escapeHtml(staff.staffName)}'s ID Card</h3>
    <div style="display:flex;justify-content:center;padding:6px 0 4px;" id="cardHolder"></div>
    <div class="modal-actions" style="margin-top:18px;">
      <a class="btn btn-secondary" href="add-staff.html?id=${id}">Edit</a>
      <button class="btn btn-primary" id="modalPrintBtn">Print this card</button>
    </div>
  `);
  overlay.querySelector("#cardHolder").appendChild(renderIdCardElement(staff, schoolSettings, "staff"));
  overlay.querySelector("#modalPrintBtn").addEventListener("click", () => {
    sessionStorage.setItem("printSelection", JSON.stringify([{ type: "staff", id }]));
    window.location.href = "print.html?mode=selected";
  });
}

async function deleteStaff(id) {
  const staff = allStaff.find((t) => t.id === id);
  const ok = await confirmModal({
    title: "Are you sure you want to delete this staff record?",
    desc: `This will permanently remove ${staff ? `"${staff.staffName}"` : "this staff"} and their ID card data. This cannot be undone.`,
    confirmLabel: "Delete",
  });
  if (!ok) return;

  try {
    await db.collection(COL_STAFF).doc(id).delete();
    allStaff = allStaff.filter((t) => t.id !== id);
    selectedIds.delete(id);
    applyFilters();
    toastSuccess("Staff deleted", "The record has been removed.");
  } catch (err) {
    console.error(err);
    toastError("Couldn't delete staff", err.message);
  }
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  document.getElementById("pageInfo").textContent = filteredStaff.length
    ? `Page ${currentPage} of ${totalPages}`
    : "";

  const pag = document.getElementById("pagination");
  if (totalPages <= 1) {
    pag.innerHTML = "";
    return;
  }
  let html = `<button class="icon-btn" ${currentPage === 1 ? "disabled" : ""} id="prevPageBtn">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      html += `<button class="btn btn-sm ${i === currentPage ? "btn-primary" : "btn-secondary"}" data-page="${i}">${i}</button>`;
    } else if (Math.abs(i - currentPage) === 2) {
      html += `<span style="padding:0 4px;color:var(--ink-faint);">…</span>`;
    }
  }
  html += `<button class="icon-btn" ${currentPage === totalPages ? "disabled" : ""} id="nextPageBtn">›</button>`;
  pag.innerHTML = html;

  pag.querySelectorAll("[data-page]").forEach((b) => {
    b.addEventListener("click", () => { currentPage = Number(b.dataset.page); renderTable(); });
  });
  document.getElementById("prevPageBtn")?.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderTable(); } });
  document.getElementById("nextPageBtn")?.addEventListener("click", () => { if (currentPage < totalPages) { currentPage++; renderTable(); } });
}
