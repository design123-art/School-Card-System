/* ============================================================
   ID CARD RENDERING
   One source of truth for building ID card markup for BOTH
   record types (student / staff), used in: live form previews,
   "View card" modals, and the bulk print / PDF export page.
   ============================================================ */

const PLACEHOLDER_LOGO = "🏫";
const PLACEHOLDER_PHOTO_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240"><rect width="200" height="240" fill="%23EEF1F8"/><circle cx="100" cy="95" r="42" fill="%23CBD5E1"/><rect x="35" y="150" width="130" height="70" rx="35" fill="%23CBD5E1"/></svg>';

/* Staff categories — covers teaching and non-teaching (support) staff.
   value: stored in Firestore. label: shown in dropdowns/table.
   tag: short badge text printed on the ID card itself. */
const STAFF_CATEGORIES = [
  { value: "Teaching",  label: "Teaching Staff (Teacher)", tag: "TEACHER" },
  { value: "Admin",     label: "Admin / Office Staff",     tag: "OFFICE STAFF" },
  { value: "Peon",      label: "Peon",                     tag: "PEON" },
  { value: "Worker",    label: "Worker",                   tag: "WORKER" },
  { value: "Cleaner",   label: "Cleaner / Sweeper",        tag: "CLEANER" },
  { value: "Guard",     label: "Security Guard",           tag: "SECURITY" },
  { value: "Driver",    label: "Driver",                   tag: "DRIVER" },
  { value: "Lab",       label: "Lab Assistant",            tag: "LAB STAFF" },
  { value: "Librarian", label: "Librarian",                tag: "LIBRARIAN" },
  { value: "Other",     label: "Other Staff",              tag: "STAFF" },
];

function categoryTag(value) {
  return (STAFF_CATEGORIES.find((c) => c.value === value) || {}).tag || "STAFF";
}
function categoryLabel(value) {
  return (STAFF_CATEGORIES.find((c) => c.value === value) || {}).label || "Other Staff";
}

/**
 * Builds the field list + role tag + subtitle for a record, based on type.
 * This is the one place that knows the difference between a student card
 * and a staff card — everything downstream (screen / print) is generic.
 */
function describeCard(person = {}, type) {
  if (type === "staff") {
    const relationLabel = person.relationType === "Husband" ? "Husband" : "Father";
    return {
      roleTag: categoryTag(person.category),
      name: person.staffName || "Staff Name",
      subtitle: person.designation || categoryLabel(person.category),
      fields: [
        { k: relationLabel, v: person.relationName },
        { k: "CNIC", v: person.cnic },
        { k: "Mobile", v: person.mobile },
        { k: "Address", v: truncate(person.address, 46), span2: true },
      ],
    };
  }

  // type === "student"
  const classSection = [person.class, person.section].filter(Boolean).join(" - ") || "—";
  return {
    roleTag: "STUDENT",
    name: person.studentName || "Student Name",
    subtitle: `Class ${classSection}`,
    fields: [
      { k: "Father", v: person.fatherName },
      { k: "GR No", v: person.grNumber },
      { k: "Roll No", v: person.rollNumber },
      { k: "Shift", v: person.shift },
      { k: "D.O.B", v: formatDob(person.dateOfBirth) },
      { k: "Contact", v: person.parentContact, span2: true },
    ],
  };
}

/** Builds the inner HTML for a screen-preview ID card (.id-card). */
function buildIdCardHtml(person, school, type) {
  return buildCardMarkup(person, school, type, {
    header: "id-card-header",
    strip: "id-card-strip",
    body: "id-card-body",
    photo: "id-card-photo",
    info: "id-card-info",
    footer: "id-card-footer",
    grid: "id-grid",
  });
}

/** Builds the inner HTML for a print-resolution card (.pcard). */
function buildPrintCardHtml(person, school, type) {
  return buildCardMarkup(person, school, type, {
    header: "pcard-header",
    strip: "pcard-strip",
    body: "pcard-body",
    photo: "pcard-photo",
    info: "pcard-info",
    footer: "pcard-footer",
    grid: "pgrid",
  });
}

function buildCardMarkup(person = {}, school = {}, type, cls) {
  const schoolName = escapeHtml(school.schoolName || "Your School Name");
  const schoolAddress = escapeHtml(school.schoolAddress || "School address goes here");
  const logo = school.schoolLogo
    ? `<img src="${school.schoolLogo}" alt="">`
    : PLACEHOLDER_LOGO;

  const photoSrc = person.photo || PLACEHOLDER_PHOTO_SVG;
  const card = describeCard(person, type);

  const gridHtml = card.fields.map((f) => `
    <div class="cell ${f.span2 ? "span2" : ""}">
      <span class="k">${escapeHtml(f.k)}</span>
      <span class="v">${escapeHtml(f.v || "—")}</span>
    </div>
  `).join("");

  return `
    <div class="${cls.header}">
      <div class="logo">${logo}</div>
      <div>
        <div class="school-name">${schoolName}</div>
        <div class="school-addr">${schoolAddress}</div>
      </div>
    </div>
    <div class="${cls.strip}"></div>
    <div class="${cls.body}">
      <img class="${cls.photo}" src="${photoSrc}" alt="">
      <div class="${cls.info}">
        <span class="role-tag">${escapeHtml(card.roleTag)}</span>
        <div class="t-name">${escapeHtml(card.name)}</div>
        <div class="t-sub">${escapeHtml(card.subtitle)}</div>
        <div class="${cls.grid}">${gridHtml}</div>
      </div>
    </div>
    <div class="${cls.footer}">
      <div class="sig"><div class="line"></div>Principal</div>
      <div class="sig"><div class="line"></div>OIC</div>
    </div>
  `;
}

function truncate(str, len) {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function formatDob(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB"); // dd/mm/yyyy
}

/** Renders one .id-card element for screen use and returns it. */
function renderIdCardElement(person, school, type) {
  const el = document.createElement("div");
  el.className = "id-card";
  el.innerHTML = buildIdCardHtml(person, school, type);
  return el;
}
