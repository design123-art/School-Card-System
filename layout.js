/* ============================================================
   APP SHELL
   Renders the sidebar + topbar into #app-shell on every
   protected page. Nav is grouped into Students / Staff /
   shared sections so both record types feel first-class.
   ============================================================ */

const NAV_GROUPS = [
  {
    label: "Overview",
    links: [{ href: "dashboard.html", icon: "▦", label: "Dashboard" }],
  },
  {
    label: "Students",
    links: [
      { href: "students.html", icon: "🎓", label: "Student Records" },
      { href: "add-student.html", icon: "＋", label: "Add Student" },
    ],
  },
  {
    label: "Staff",
    links: [
      { href: "staff.html", icon: "🧑‍💼", label: "Staff Records" },
      { href: "add-staff.html", icon: "＋", label: "Add Staff" },
    ],
  },
  {
    label: "School",
    links: [
      { href: "print.html", icon: "🖶", label: "Print Cards" },
      { href: "settings.html", icon: "⚙", label: "School Settings" },
    ],
  },
];

function renderAppShell({ title, activePage }) {
  const shell = document.getElementById("app-shell");
  if (!shell) return;

  const currentPage = activePage || window.location.pathname.split("/").pop();

  const navHtml = NAV_GROUPS.map((group) => `
    <div class="sidebar-section-label">${escapeHtml(group.label)}</div>
    ${group.links.map((link) => {
      const isActive = link.href === currentPage;
      return `<a class="sidebar-link ${isActive ? "active" : ""}" href="${link.href}">
        <span class="ic">${link.icon}</span><span>${link.label}</span>
      </a>`;
    }).join("")}
  `).join("");

  shell.innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay"></div>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-mark">🪪</div>
        <span>School ID System<small>Students &amp; Staff</small></span>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-foot" id="schoolFootName">Loading school...</div>
    </aside>

    <div class="main-area">
      <header class="topbar">
        <div class="topbar-left">
          <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">☰</button>
          <div class="topbar-title">${escapeHtml(title || "")}</div>
        </div>
        <div class="topbar-right">
          <div class="admin-chip">
            <div class="admin-avatar" id="adminAvatar">A</div>
            <div class="who">
              <div id="adminEmail">admin</div>
              <small>Administrator</small>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" data-logout>Log out</button>
        </div>
      </header>
      <main class="page-body" id="page-body"></main>
    </div>
  `;

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  document.getElementById("menuToggle")?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });
  overlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  });

  wireLogout();

  auth.onAuthStateChanged((user) => {
    if (user?.email) {
      document.getElementById("adminEmail").textContent = user.email.split("@")[0];
      document.getElementById("adminAvatar").textContent = user.email[0].toUpperCase();
    }
  });

  db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get().then((doc) => {
    const footEl = document.getElementById("schoolFootName");
    if (!footEl) return;
    if (doc.exists && doc.data().schoolName) {
      footEl.textContent = `© ${new Date().getFullYear()} ${doc.data().schoolName}`;
    } else {
      footEl.textContent = `© ${new Date().getFullYear()} Your School`;
    }
  }).catch(() => {});
}
