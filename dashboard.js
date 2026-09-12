/* ============================================================
   DASHBOARD LOGIC (combined students + staff)
   ============================================================ */

requireAuth(async () => {
  renderAppShell({ title: "Dashboard", activePage: "dashboard.html" });

  const body = document.getElementById("page-body");
  const tpl = document.getElementById("tpl-dashboard-body");
  body.appendChild(tpl.content.cloneNode(true));

  await Promise.all([loadStatsAndRecent(), loadSchoolSummary()]);
});

async function loadStatsAndRecent() {
  try {
    const [studentsSnap, staffSnap] = await Promise.all([
      db.collection(COL_STUDENTS).orderBy("createdAt", "desc").get(),
      db.collection(COL_STAFF).orderBy("createdAt", "desc").get(),
    ]);

    const students = studentsSnap.docs.map((d) => ({ id: d.id, type: "student", ...d.data() }));
    const staff = staffSnap.docs.map((d) => ({ id: d.id, type: "staff", ...d.data() }));

    document.getElementById("statTotalStudents").textContent = students.length;
    document.getElementById("statTotalStaff").textContent = staff.length;
    document.getElementById("statTotalCards").textContent = students.length + staff.length;

    const now = new Date();
    const isThisMonth = (rec) => {
      const d = toJsDate(rec.createdAt);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const addedThisMonth = students.filter(isThisMonth).length + staff.filter(isThisMonth).length;
    document.getElementById("statAddedThisMonth").textContent = addedThisMonth;

    const combined = [...students, ...staff]
      .sort((a, b) => (toJsDate(b.createdAt) || 0) - (toJsDate(a.createdAt) || 0))
      .slice(0, 8);
    renderRecentList(combined);
  } catch (err) {
    console.error(err);
    toastError("Couldn't load dashboard data", err.message);
    document.getElementById("recentList").innerHTML =
      `<div class="empty-state"><div class="ic">⚠</div><div class="t">Couldn't load records</div></div>`;
  }
}

function renderRecentList(records) {
  const list = document.getElementById("recentList");
  if (!records.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="ic">🪪</div>
      <div class="t">No records yet</div>
      <div class="d">Add your first student or staff member to generate an ID card.</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">
        <a href="add-student.html" class="btn btn-secondary btn-sm">＋ Add Student</a>
        <a href="add-staff.html" class="btn btn-primary btn-sm">＋ Add Staff</a>
      </div>
    </div>`;
    return;
  }
  list.innerHTML = records.map((r) => {
    const isStudent = r.type === "student";
    const name = isStudent ? r.studentName : r.staffName;
    const meta = isStudent
      ? ([r.class, r.section].filter(Boolean).join(" - ") || "Student")
      : categoryLabel(r.category);
    return `
    <div class="recent-row">
      ${r.photo
        ? `<img class="recent-thumb" src="${r.photo}" alt="">`
        : `<div class="recent-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--royal-700);">${initialsOf(name)}</div>`
      }
      <div>
        <div class="name">${escapeHtml(name || "Unnamed")}</div>
        <div class="meta">${escapeHtml(meta)} <span class="badge" style="margin-left:4px;">${isStudent ? "Student" : "Staff"}</span></div>
      </div>
      <div class="when">${timeAgo(toJsDate(r.createdAt))}</div>
    </div>
  `;
  }).join("");
}

async function loadSchoolSummary() {
  const el = document.getElementById("schoolSummary");
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    if (!doc.exists || !doc.data().schoolName) {
      el.innerHTML = `<div class="empty-state">
        <div class="ic">🏫</div>
        <div class="t">School profile not set up</div>
        <div class="d">Add your school name, address and logo so it appears on every ID card.</div>
        <a href="settings.html" class="btn btn-primary btn-sm">Set up now</a>
      </div>`;
      return;
    }
    const s = doc.data();
    el.innerHTML = `
      <div style="display:flex;gap:14px;align-items:center;">
        <div style="width:56px;height:56px;border-radius:12px;background:var(--surface-alt);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:1px solid var(--border);">
          ${s.schoolLogo ? `<img src="${s.schoolLogo}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:22px;">🏫</span>`}
        </div>
        <div>
          <div style="font-weight:700;font-family:var(--font-display);color:var(--royal-900);">${escapeHtml(s.schoolName)}</div>
          <div style="font-size:13px;color:var(--ink-soft);margin-top:2px;">${escapeHtml(s.schoolAddress || "")}</div>
          ${s.schoolPhone ? `<div style="font-size:12.5px;color:var(--ink-faint);margin-top:2px;">${escapeHtml(s.schoolPhone)}</div>` : ""}
        </div>
      </div>
      <a href="settings.html" class="btn btn-secondary btn-sm" style="margin-top:16px;">Edit school info</a>
    `;
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="empty-state"><div class="ic">⚠</div><div class="t">Couldn't load school info</div></div>`;
  }
}
