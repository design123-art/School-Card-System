/* ============================================================
   SCHOOL SETTINGS
   ============================================================ */

let currentLogoDataUrl = "";

requireAuth(async () => {
  renderAppShell({ title: "School Settings", activePage: "settings.html" });
  const body = document.getElementById("page-body");
  body.appendChild(document.getElementById("tpl-settings-body").content.cloneNode(true));

  wireSettingsForm();
  await loadSettings();
  updateSettingsPreview();
});

async function loadSettings() {
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    if (!doc.exists) return;
    const s = doc.data();
    document.getElementById("schoolName").value = s.schoolName || "";
    document.getElementById("schoolAddress").value = s.schoolAddress || "";
    document.getElementById("schoolPhone").value = s.schoolPhone || "";
    document.getElementById("schoolEmail").value = s.schoolEmail || "";
    if (s.schoolLogo) {
      currentLogoDataUrl = s.schoolLogo;
      document.getElementById("logoPreview").innerHTML = `<img src="${s.schoolLogo}" alt="">`;
    }
  } catch (err) {
    console.error(err);
    toastError("Couldn't load school settings", err.message);
  }
}

function wireSettingsForm() {
  const logoInput = document.getElementById("logoInput");
  document.getElementById("logoPickBtn").addEventListener("click", () => logoInput.click());

  logoInput.addEventListener("change", async () => {
    const file = logoInput.files[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, { maxDim: 300, quality: 0.8 });
      currentLogoDataUrl = compressed;
      document.getElementById("logoPreview").innerHTML = `<img src="${compressed}" alt="">`;
      updateSettingsPreview();
    } catch (err) {
      toastError("Couldn't process logo", err.message);
    }
  });

  ["schoolName", "schoolAddress", "schoolPhone", "schoolEmail"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateSettingsPreview);
  });

  document.getElementById("settingsForm").addEventListener("submit", handleSaveSettings);
}

function updateSettingsPreview() {
  const school = {
    schoolName: document.getElementById("schoolName").value.trim(),
    schoolAddress: document.getElementById("schoolAddress").value.trim(),
    schoolLogo: currentLogoDataUrl,
  };
  const sampleStudent = {
    studentName: "Sample Student",
    fatherName: "Father Name",
    grNumber: "GR-0000",
    rollNumber: "01",
    class: "5",
    section: "A",
    shift: "Morning",
    dateOfBirth: "2015-01-01",
    parentContact: "0300-0000000",
    address: "Sample address",
  };
  const sampleStaff = {
    staffName: "Sample Staff",
    category: "Teaching",
    designation: "Senior Teacher",
    relationType: "Father",
    relationName: "Relation Name",
    cnic: "XXXXX-XXXXXXX-X",
    mobile: "0300-0000000",
    address: "Sample address",
  };

  const studentHolder = document.getElementById("settingsCardPreviewStudent");
  studentHolder.innerHTML = "";
  studentHolder.appendChild(renderIdCardElement(sampleStudent, school, "student"));

  const staffHolder = document.getElementById("settingsCardPreviewStaff");
  staffHolder.innerHTML = "";
  staffHolder.appendChild(renderIdCardElement(sampleStaff, school, "staff"));
}


function clearSettingsErrors() {
  document.querySelectorAll(".field-error").forEach((e) => e.classList.remove("show"));
  document.querySelectorAll(".input").forEach((e) => e.classList.remove("error"));
}

function showSettingsError(fieldId) {
  document.getElementById(fieldId)?.classList.add("error");
  document.querySelector(`[data-error-for="${fieldId}"]`)?.classList.add("show");
}

async function handleSaveSettings(e) {
  e.preventDefault();
  clearSettingsErrors();

  const values = {
    schoolName: document.getElementById("schoolName").value.trim(),
    schoolAddress: document.getElementById("schoolAddress").value.trim(),
    schoolPhone: document.getElementById("schoolPhone").value.trim(),
    schoolEmail: document.getElementById("schoolEmail").value.trim(),
    schoolLogo: currentLogoDataUrl,
  };

  let valid = true;
  if (!values.schoolName) { showSettingsError("schoolName"); valid = false; }
  if (!values.schoolAddress) { showSettingsError("schoolAddress"); valid = false; }
  if (!values.schoolPhone) { showSettingsError("schoolPhone"); valid = false; }
  if (!valid) {
    toastWarning("Check the form", "Please fill in the required school details.");
    return;
  }

  const btn = document.getElementById("saveSettingsBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Saving...`;

  try {
    await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).set({
      ...values,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    toastSuccess("Settings saved", "All ID cards now reflect the updated school information.");
  } catch (err) {
    console.error(err);
    toastError("Couldn't save settings", err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Changes";
  }
}
