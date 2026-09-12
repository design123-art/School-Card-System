/* ============================================================
   ADD / EDIT STUDENT
   Same page handles both flows: ?id=<docId> loads an existing
   record for editing; no id means a fresh "Add Student" form.
   ============================================================ */

let editingId = null;
let schoolSettings = {};
let currentPhotoDataUrl = "";

requireAuth(async () => {
  const params = new URLSearchParams(window.location.search);
  editingId = params.get("id");

  renderAppShell({
    title: editingId ? "Edit Student" : "Add Student",
    activePage: editingId ? "students.html" : "add-student.html",
  });

  const body = document.getElementById("page-body");
  body.appendChild(document.getElementById("tpl-add-student-body").content.cloneNode(true));

  document.getElementById("formTitle").textContent = editingId ? "Edit Student" : "Add Student";
  document.getElementById("saveBtn").textContent = editingId ? "Update Student" : "Save Student";

  await loadSchoolSettings();
  updatePreview();
  wireForm();

  if (editingId) {
    await loadExistingStudent(editingId);
  }
});

async function loadSchoolSettings() {
  try {
    const doc = await db.collection(COL_SETTINGS).doc(SETTINGS_DOC_ID).get();
    schoolSettings = doc.exists ? doc.data() : {};
  } catch (err) {
    console.error(err);
  }
}

async function loadExistingStudent(id) {
  showPageLoader("Loading student record...");
  try {
    const doc = await db.collection(COL_STUDENTS).doc(id).get();
    if (!doc.exists) {
      toastError("Student not found", "This record may have been deleted.");
      window.location.href = "students.html";
      return;
    }
    const s = doc.data();
    document.getElementById("studentName").value = s.studentName || "";
    document.getElementById("fatherName").value = s.fatherName || "";
    document.getElementById("grNumber").value = s.grNumber || "";
    document.getElementById("rollNumber").value = s.rollNumber || "";
    document.getElementById("class").value = s.class || "";
    document.getElementById("section").value = s.section || "";
    document.getElementById("shift").value = s.shift || "Morning";
    document.getElementById("dateOfBirth").value = s.dateOfBirth || "";
    document.getElementById("parentContact").value = s.parentContact || "";
    document.getElementById("address").value = s.address || "";
    if (s.photo) {
      currentPhotoDataUrl = s.photo;
      setPhotoPreview(s.photo);
    }
    updatePreview();
  } catch (err) {
    console.error(err);
    toastError("Couldn't load student", err.message);
  } finally {
    hidePageLoader();
  }
}

function wireForm() {
  const form = document.getElementById("studentForm");
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

  [
    "studentName", "fatherName", "grNumber", "rollNumber", "class",
    "section", "shift", "dateOfBirth", "parentContact", "address",
  ].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", updatePreview);
    el.addEventListener("change", updatePreview);
  });

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
  const student = collectFormValues();
  const holder = document.getElementById("cardPreviewHolder");
  holder.innerHTML = "";
  holder.appendChild(renderIdCardElement(student, schoolSettings, "student"));
}

function collectFormValues() {
  return {
    studentName: document.getElementById("studentName").value.trim(),
    fatherName: document.getElementById("fatherName").value.trim(),
    grNumber: document.getElementById("grNumber").value.trim(),
    rollNumber: document.getElementById("rollNumber").value.trim(),
    class: document.getElementById("class").value.trim(),
    section: document.getElementById("section").value.trim(),
    shift: document.getElementById("shift").value,
    dateOfBirth: document.getElementById("dateOfBirth").value,
    parentContact: document.getElementById("parentContact").value.trim(),
    address: document.getElementById("address").value.trim(),
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
  if (!values.studentName) { showFieldError("studentName"); valid = false; }
  if (!values.fatherName) { showFieldError("fatherName"); valid = false; }
  if (!values.grNumber) { showFieldError("grNumber"); valid = false; }
  if (!values.rollNumber) { showFieldError("rollNumber"); valid = false; }
  if (!values.class) { showFieldError("class"); valid = false; }
  if (!values.section) { showFieldError("section"); valid = false; }
  if (!values.dateOfBirth) { showFieldError("dateOfBirth"); valid = false; }
  if (!values.parentContact) { showFieldError("parentContact"); valid = false; }
  if (!values.address) { showFieldError("address"); valid = false; }
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
      await db.collection(COL_STUDENTS).doc(editingId).update(payload);
      toastSuccess("Student updated", `${values.studentName}'s record has been saved.`);
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(COL_STUDENTS).add(payload);
      toastSuccess("Student added", `${values.studentName} has been added and their ID card is ready.`);
    }
    window.location.href = "students.html";
  } catch (err) {
    console.error(err);
    toastError("Couldn't save student", err.message);
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}
