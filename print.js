/* ============================================================
   PRINT / PDF EXPORT (combined students + staff)
   Renders students and/or staff into fixed A4 sheets of 8 cards
   (2 columns x 4 rows), each record carrying its own "type" so
   the right field set + role tag renders per card. Supports the
   browser print dialog and a jsPDF + html2canvas PDF download.
   ============================================================ */

const CARDS_PER_PAGE = 8;

let printRecords = []; // [{ type: "student"|"staff", ...fields }]
let schoolSettings = {};
let currentMode = "students"; // "students" | "staff" | "both" | "selected"

requireAuth(async () => {
  renderAppShell({ title: "Print Cards", activePage: "print.html" });
  const body = document.getElementById("page-body");
  body.appendChild(document.getElementById("tpl-print-body").content.cloneNode(true));

  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode");
  currentMode = ["students", "staff", "both", "selected"].includes(requestedMode) ? requestedMode : "students";

  wirePrintControls();
  await loadSchoolSettings();
  await loadAndRender();
});

async function loadSchoolSettings() {
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    schoolSettings = doc.exists ? doc.data() : {};
  } catch (err) {
    console.error(err);
  }
}

function wirePrintControls() {
  document.getElementById("modeStudentsBtn").addEventListener("click", () => setMode("students"));
  document.getElementById("modeStaffBtn").addEventListener("click", () => setMode("staff"));
  document.getElementById("modeBothBtn").addEventListener("click", () => setMode("both"));
  document.getElementById("modeSelectedBtn").addEventListener("click", () => setMode("selected"));
  document.getElementById("printPreviewBtn").addEventListener("click", () => {
    document.getElementById("printPreviewWrap").scrollIntoView({ behavior: "smooth" });
    toastSuccess("Preview ready", "Scroll through the sheets below exactly as they'll print.");
  });
  document.getElementById("printNowBtn").addEventListener("click", () => window.print());
  document.getElementById("downloadPdfBtn").addEventListener("click", downloadPdf);
}

function setMode(mode) {
  currentMode = mode;
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  window.history.replaceState({}, "", url);
  loadAndRender();
}

function updateModeButtons() {
  const map = {
    students: "modeStudentsBtn",
    staff: "modeStaffBtn",
    both: "modeBothBtn",
    selected: "modeSelectedBtn",
  };
  Object.entries(map).forEach(([mode, id]) => {
    const btn = document.getElementById(id);
    btn.classList.toggle("btn-primary", currentMode === mode);
    btn.classList.toggle("btn-secondary", currentMode !== mode);
  });
}

async function loadAndRender() {
  updateModeButtons();
  showPageLoader("Loading ID cards...");
  try {
    if (currentMode === "selected") {
      printRecords = await loadSelectedRecords();
    } else if (currentMode === "staff") {
      const snap = await db.collection(COL_STAFF).orderBy("staffName").get();
      printRecords = snap.docs.map((d) => ({ id: d.id, type: "staff", ...d.data() }));
    } else if (currentMode === "both") {
      const [studentsSnap, staffSnap] = await Promise.all([
        db.collection(COL_STUDENTS).orderBy("studentName").get(),
        db.collection(COL_STAFF).orderBy("staffName").get(),
      ]);
      const students = studentsSnap.docs.map((d) => ({ id: d.id, type: "student", ...d.data() }));
      const staff = staffSnap.docs.map((d) => ({ id: d.id, type: "staff", ...d.data() }));
      printRecords = [...students, ...staff];
    } else {
      // "students" (default)
      const snap = await db.collection(COL_STUDENTS).orderBy("studentName").get();
      printRecords = snap.docs.map((d) => ({ id: d.id, type: "student", ...d.data() }));
    }
    renderSheets();
  } catch (err) {
    console.error(err);
    toastError("Couldn't load cards for printing", err.message);
  } finally {
    hidePageLoader();
  }
}

async function loadSelectedRecords() {
  const raw = JSON.parse(sessionStorage.getItem("printSelection") || "[]");
  if (!raw.length) return [];

  const studentIds = raw.filter((r) => r.type === "student").map((r) => r.id);
  const staffIds = raw.filter((r) => r.type === "staff").map((r) => r.id);

  const [studentDocs, staffDocs] = await Promise.all([
    Promise.all(studentIds.map((id) => db.collection(COL_STUDENTS).doc(id).get())),
    Promise.all(staffIds.map((id) => db.collection(COL_STAFF).doc(id).get())),
  ]);

  const students = studentDocs.filter((d) => d.exists).map((d) => ({ id: d.id, type: "student", ...d.data() }));
  const staff = staffDocs.filter((d) => d.exists).map((d) => ({ id: d.id, type: "staff", ...d.data() }));
  return [...students, ...staff];
}

function renderSheets() {
  const area = document.getElementById("printArea");
  document.getElementById("cardCountChip").textContent = `${printRecords.length} card${printRecords.length === 1 ? "" : "s"}`;

  if (!printRecords.length) {
    const emptyMessages = {
      students: "Add students first to generate ID cards.",
      staff: "Add staff first to generate ID cards.",
      both: "Add students or staff first to generate ID cards.",
      selected: "Go back to Student Records or Staff Records and select at least one record.",
    };
    area.innerHTML = `<div class="panel no-print" style="max-width:480px;margin:0 auto;"><div class="empty-state">
      <div class="ic">🖶</div>
      <div class="t">No cards to print</div>
      <div class="d">${emptyMessages[currentMode]}</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <a href="students.html" class="btn btn-secondary btn-sm">Student Records</a>
        <a href="staff.html" class="btn btn-primary btn-sm">Staff Records</a>
      </div>
    </div></div>`;
    return;
  }

  const sheets = [];
  for (let i = 0; i < printRecords.length; i += CARDS_PER_PAGE) {
    sheets.push(printRecords.slice(i, i + CARDS_PER_PAGE));
  }

  area.innerHTML = sheets.map((group) => `
    <div class="print-sheet">
      ${group.map((r) => `<div class="pcard">${buildPrintCardHtml(r, schoolSettings, r.type)}</div>`).join("")}
      ${Array.from({ length: CARDS_PER_PAGE - group.length }).map(() => `<div class="pcard" style="visibility:hidden;"></div>`).join("")}
    </div>
  `).join("");
}

async function downloadPdf() {
  if (!printRecords.length) {
    toastWarning("Nothing to export", "There are no cards to include in the PDF.");
    return;
  }
  const btn = document.getElementById("downloadPdfBtn");
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner dark"></span> Generating PDF...`;

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const sheets = document.querySelectorAll(".print-sheet");

    for (let i = 0; i < sheets.length; i++) {
      const canvas = await html2canvas(sheets[i], { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
    }

    pdf.save(`school-id-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
    toastSuccess("PDF downloaded", `${sheets.length} page${sheets.length === 1 ? "" : "s"} exported at print quality.`);
  } catch (err) {
    console.error(err);
    toastError("Couldn't generate PDF", err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}
