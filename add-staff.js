/* ============================================================
   ADD / EDIT STAFF MEMBER
   Same page handles both flows: ?id=<docId> loads an existing
   record for editing; no id means a fresh "Add Staff" form.
   ============================================================ */

let editingId = null;
let schoolSettings = {};
let currentPhotoDataUrl = "";

requireAuth(async () => {
  const params = new URLSearchParams(window.location.search);
  editingId = params.get("id");

  renderAppShell({
    title: editingId ? "Edit Staff" : "Add Staff",
    activePage: editingId ? "staff.html" : "add-staff.html",
  });

  const body = document.getElementById("page-body");
  body.appendChild(document.getElementById("tpl-add-staff-body").content.cloneNode(true));

  document.getElementById("formTitle").textContent = editingId ? "Edit Staff" : "Add Staff";
  document.getElementById("saveBtn").textContent = editingId ? "Update Staff" : "Save Staff";

  formatCnicInput(document.getElementById("cnic"));
  populateCategoryDropdown();

  await loadSchoolSettings();
  updatePreview();
  wireForm();

  if (editingId) {
    await loadExistingStaff(editingId);
  }
});

function populateCategoryDropdown() {
  const select = document.getElementById("category");
  select.innerHTML = STAFF_CATEGORIES.map(
    (c) => `<option value="${c.value}">${escapeHtml(c.label)}</option>`
  ).join("");
}

async function loadSchoolSettings() {
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    schoolSettings = doc.exists ? doc.data() : {};
  } catch (err) {
    console.error(err);
  }
}

async function loadExistingStaff(id) {
  showPageLoader("Loading staff record...");
  try {
    const doc = await db.collection(COL_STAFF).doc(id).get();
    if (!doc.exists) {
      toastError("Staff not found", "This record may have been deleted.");
      window.location.href = "staff.html";
      return;
    }
    const t = doc.data();
    document.getElementById("staffName").value = t.staffName || "";
    document.getElementById("category").value = t.category || "Teaching";
    document.getElementById("relationType").value = t.relationType || "Father";
    document.getElementById("relationName").value = t.relationName || "";
    document.getElementById("address").value = t.address || "";
    document.getElementById("cnic").value = t.cnic || "";
    document.getElementById("mobile").value = t.mobile || "";
    document.getElementById("designation").value = t.designation || "";
    document.getElementById("joiningDate").value = t.joiningDate || "";
    if (t.photo) {
      currentPhotoDataUrl = t.photo;
      setPhotoPreview(t.photo);
    }
    updatePreview();
  } catch (err) {
    console.error(err);
    toastError("Couldn't load staff", err.message);
  } finally {
    hidePageLoader();
  }
}

function wireForm() {
  const form = document.getElementById("staffForm");
  const photoInput = document.getElementById("photoInput");

  document.getElementById("photoPickBtn").addEventListener("click", () => photoInput.click());
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, { maxDim: 480, quality: 0.72 });
      currentPhotoDataUrl = compressed;
      setPhotoPreview(compressed);
      updatePreview();
    } catch (err) {
      toastError("Couldn't process photo", err.message);
    }
  });

  ["staffName", "relationType", "relationName", "address", "cnic", "mobile", "designation"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updatePreview);
  });
  document.getElementById("relationType").addEventListener("change", updatePreview);
  document.getElementById("category").addEventListener("change", updatePreview);

  document.getElementById("resetBtn").addEventListener("click", () => {
    form.reset();
    currentPhotoDataUrl = "";
    setPhotoPreview(null);
    clearErrors();
    updatePreview();
  });

  form.addEventListener("submit", handleSubmit);
}

function setPhotoPreview(dataUrl) {
  const preview = document.getElementById("photoPreview");
  preview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="">` : "📷";
}

function updatePreview() {
  const staff = collectFormValues();
  const holder = document.getElementById("cardPreviewHolder");
  holder.innerHTML = "";
  holder.appendChild(renderIdCardElement(staff, schoolSettings, "staff"));
}

function collectFormValues() {
  return {
    staffName: document.getElementById("staffName").value.trim(),
    category: document.getElementById("category").value,
    relationType: document.getElementById("relationType").value,
    relationName: document.getElementById("relationName").value.trim(),
    address: document.getElementById("address").value.trim(),
    cnic: document.getElementById("cnic").value.trim(),
    mobile: document.getElementById("mobile").value.trim(),
    designation: document.getElementById("designation").value.trim(),
    joiningDate: document.getElementById("joiningDate").value,
    photo: currentPhotoDataUrl,
  };
}

function clearErrors() {
  document.querySelectorAll(".field-error").forEach((e) => e.classList.remove("show"));
  document.querySelectorAll(".input").forEach((e) => e.classList.remove("error"));
}

function showFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const err = document.querySelector(`[data-error-for="${fieldId}"]`);
  input?.classList.add("error");
  err?.classList.add("show");
}

function validateForm(values) {
  clearErrors();
  let valid = true;
  if (!values.staffName) { showFieldError("staffName"); valid = false; }
  if (!values.category) { showFieldError("category"); valid = false; }
  if (!values.relationName) { showFieldError("relationName"); valid = false; }
  if (!values.address) { showFieldError("address"); valid = false; }
  if (!isValidCnic(values.cnic)) { showFieldError("cnic"); valid = false; }
  return valid;
}

async function handleSubmit(e) {
  e.preventDefault();
  const values = collectFormValues();
  if (!validateForm(values)) {
    toastWarning("Check the form", "Some required fields need your attention.");
    return;
  }

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.innerHTML = `<span class="spinner"></span> Saving...`;

  try {
    const payload = {
      ...values,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (editingId) {
      await db.collection(COL_STAFF).doc(editingId).update(payload);
      toastSuccess("Staff updated", `${values.staffName}'s record has been saved.`);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(COL_STAFF).add(payload);
      toastSuccess("Staff added", `${values.staffName} has been added and their ID card is ready.`);
    }
    window.location.href = "staff.html";
  } catch (err) {
    console.error(err);
    toastError("Couldn't save staff", err.message);
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}
