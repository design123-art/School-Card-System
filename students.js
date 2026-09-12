/* ============================================================
   STUDENT RECORDS PAGE
   Loads all students once, then filters/sorts/paginates
   client-side. Handles view / edit / delete / print, plus
   class and section filter dropdowns populated from the data.
   ============================================================ */

const PAGE_SIZE = 10;

let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
let sortField = "studentName";
let sortDir = "asc";
let schoolSettings = {};
const selectedIds = new Set();

requireAuth(async () => {
  renderAppShell({ title: "Student Records", activePage: "students.html" });
  const body = document.getElementById("page-body");
  body.appendChild(document.getElementById("tpl-students-body").content.cloneNode(true));

  wireStudentsPage();
  await loadSchoolSettings();
  await loadStudents();
});

async function loadSchoolSettings() {
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    schoolSettings = doc.exists ? doc.data() : {};
  } catch (err) {
    console.error(err);
  }
}

async function loadStudents() {
  const tbody = document.getElementById("studentsTbody");
  try {
    const snap = await db.collection(COL_STUDENTS).get();
    allStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    populateClassSectionFilters();
    applyFilters();
  } catch (err) {
    console.error(err);
    toastError("Couldn't load student records", err.message);
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ic">⚠</div><div class="t">Couldn't load records</div></div></td></tr>`;
  }
}

function populateClassSectionFilters() {
  const classes = [...new Set(allStudents.map((s) => s.class).filter(Boolean))].sort();
  const sections = [...new Set(allStudents.map((s) => s.section).filter(Boolean))].sort();

  const classSelect = document.getElementById("classFilter");
  const sectionSelect = document.getElementById("sectionFilter");
  const prevClass = classSelect.value;
  const prevSection = sectionSelect.value;

  classSelect.innerHTML = `<option value="">All classes</option>` +
    classes.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  sectionSelect.innerHTML = `<option value="">All sections</option>` +
    sections.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  if (classes.includes(prevClass)) classSelect.value = prevClass;
  if (sections.includes(prevSection)) sectionSelect.value = prevSection;
}

function wireStudentsPage() {
  document.getElementById("searchInput").addEventListener("input", debounce(() => {
    currentPage = 1;
    applyFilters();
  }, 220));

  document.getElementById("classFilter").addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
  });
  document.getElementById("sectionFilter").addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
  });

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
    rowsOnPage.forEach((s) => {
      if (e.target.checked) selectedIds.add(s.id);
      else selectedIds.delete(s.id);
    });
    renderTable();
  });

  document.getElementById("printSelectedBtn").addEventListener("click", () => {
    if (!selectedIds.size) {
      toastWarning("No students selected", "Tick the checkbox next to one or more students first.");
      return;
    }
    sessionStorage.setItem("printSelection", JSON.stringify([...selectedIds].map((id) => ({ type: "student", id }))));
    window.location.href = "print.html?mode=selected";
  });
}

function applyFilters() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const classFilter = document.getElementById("classFilter").value;
  const sectionFilter = document.getElementById("sectionFilter").value;

  filteredStudents = allStudents.filter((s) => {
    if (classFilter && s.class !== classFilter) return false;
    if (sectionFilter && s.section !== sectionFilter) return false;
    if (!q) return true;
    return (
      (s.studentName || "").toLowerCase().includes(q) ||
      (s.grNumber || "").toLowerCase().includes(q) ||
      (s.class || "").toLowerCase().includes(q) ||
      (s.fatherName || "").toLowerCase().includes(q)
    );
  });

  filteredStudents.sort((a, b) => {
    const va = (a[sortField] || "").toString().toLowerCase();
    const vb = (b[sortField] || "").toString().toLowerCase();
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  document.getElementById("studentCountLabel").textContent =
    `${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`;

  renderTable();
}

function paginatedSlice() {
  const start = (currentPage - 1) * PAGE_SIZE;
  return filteredStudents.slice(start, start + PAGE_SIZE);
}

function renderTable() {
  const tbody = document.getElementById("studentsTbody");
  const rows = paginatedSlice();

  if (!filteredStudents.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="ic">🎓</div>
      <div class="t">No students found</div>
      <div class="d">Try a different search or filter, or add a new student.</div>
      <a href="add-student.html" class="btn btn-primary btn-sm">＋ Add Student</a>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = rows.map((s) => `
      <tr>
        <td class="checkbox-cell"><input type="checkbox" class="select-box row-select" data-id="${s.id}" ${selectedIds.has(s.id) ? "checked" : ""}></td>
        <td>${s.photo
          ? `<img class="table-thumb" src="${s.photo}" alt="">`
          : `<div class="table-thumb" style="display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:var(--royal-700);">${initialsOf(s.studentName)}</div>`}
        </td>
        <td>
          <div class="cell-student">
            <div>
              <div class="name">${escapeHtml(s.studentName || "—")}</div>
              <div class="desig">${escapeHtml(s.parentContact || "")}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(s.fatherName || "—")}</td>
        <td><span class="badge">${escapeHtml(s.class || "—")}</span></td>
        <td><span class="badge">${escapeHtml(s.section || "—")}</span></td>
        <td class="mono">${escapeHtml(s.grNumber || "—")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="View card" data-view="${s.id}">🪪</button>
            <a class="icon-btn" title="Edit" href="add-student.html?id=${s.id}">✎</a>
            <button class="icon-btn" title="Print" data-print="${s.id}">🖶</button>
            <button class="icon-btn danger" title="Delete" data-delete="${s.id}">🗑</button>
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
      sessionStorage.setItem("printSelection", JSON.stringify([{ type: "student", id: btn.dataset.print }]));
      window.location.href = "print.html?mode=selected";
    });
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteStudent(btn.dataset.delete));
  });
}

function viewCard(id) {
  const student = allStudents.find((s) => s.id === id);
  if (!student) return;
  const overlay = openModal(`
    <h3 style="margin-bottom:16px;">${escapeHtml(student.studentName)}'s ID Card</h3>
    <div style="display:flex;justify-content:center;padding:6px 0 4px;" id="cardHolder"></div>
    <div class="modal-actions" style="margin-top:18px;">
      <a class="btn btn-secondary" href="add-student.html?id=${id}">Edit</a>
      <button class="btn btn-primary" id="modalPrintBtn">Print this card</button>
    </div>
  `);
  overlay.querySelector("#cardHolder").appendChild(renderIdCardElement(student, schoolSettings, "student"));
  overlay.querySelector("#modalPrintBtn").addEventListener("click", () => {
    sessionStorage.setItem("printSelection", JSON.stringify([{ type: "student", id }]));
    window.location.href = "print.html?mode=selected";
  });
}

async function deleteStudent(id) {
  const student = allStudents.find((s) => s.id === id);
  const ok = await confirmModal({
    title: "Are you sure you want to delete this student record?",
    desc: `This will permanently remove ${student ? `"${student.studentName}"` : "this student"} and their ID card data. This cannot be undone.`,
    confirmLabel: "Delete",
  });
  if (!ok) return;

  try {
    await db.collection(COL_STUDENTS).doc(id).delete();
    allStudents = allStudents.filter((s) => s.id !== id);
    selectedIds.delete(id);
    populateClassSectionFilters();
    applyFilters();
    toastSuccess("Student deleted", "The record has been removed.");
  } catch (err) {
    console.error(err);
    toastError("Couldn't delete student", err.message);
  }
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  document.getElementById("pageInfo").textContent = filteredStudents.length
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
