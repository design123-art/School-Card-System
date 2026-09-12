/* ============================================================
   SHARED UTILITIES
   Toasts, confirm modal, image compression, CNIC helpers,
   debounce, and small DOM helpers used across every page.
   ============================================================ */

/* ---------- Toast notifications ---------- */
function ensureToastStack() {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function showToast(type, title, desc = "", duration = 4200) {
  const stack = ensureToastStack();
  const icons = { success: "✓", error: "!", warning: "⚠", info: "i" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="ic">${icons[type] || icons.info}</span>
    <div>
      <div class="msg-t">${escapeHtml(title)}</div>
      ${desc ? `<div class="msg-d">${escapeHtml(desc)}</div>` : ""}
    </div>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s ease, transform .25s ease";
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 260);
  }, duration);
}

const toastSuccess = (t, d) => showToast("success", t, d);
const toastError = (t, d) => showToast("error", t, d);
const toastWarning = (t, d) => showToast("warning", t, d);

/* ---------- Confirm modal (used for delete etc.) ---------- */
function confirmModal({ title, desc, confirmLabel = "Delete", cancelLabel = "Cancel", danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay show";
    overlay.innerHTML = `
      <div class="modal-box" role="alertdialog" aria-modal="true">
        <div class="modal-icon" style="${danger ? "" : "background:var(--royal-100);color:var(--royal-700);"}">${danger ? "⚠" : "?"}</div>
        <h3>${escapeHtml(title)}</h3>
        <p class="desc">${escapeHtml(desc)}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-act="cancel">${escapeHtml(cancelLabel)}</button>
          <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.dataset.act === "cancel") {
        overlay.remove();
        resolve(false);
      } else if (e.target.dataset.act === "confirm") {
        overlay.remove();
        resolve(true);
      }
    });
  });
}

/* ---------- Generic modal shell (for view card, print preview) ---------- */
function openModal(innerHtml, { large = false } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay show";
  overlay.innerHTML = `<div class="modal-box ${large ? "modal-lg" : ""}">
      <button class="modal-close" data-act="close">✕</button>
      ${innerHtml}
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.dataset.act === "close") overlay.remove();
  });
  return overlay;
}

/* ---------- Escaping ---------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Debounce ---------- */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ---------- CNIC formatting / validation ---------- */
function formatCnicInput(el) {
  el.addEventListener("input", () => {
    let digits = el.value.replace(/\D/g, "").slice(0, 13);
    let out = digits;
    if (digits.length > 5) out = digits.slice(0, 5) + "-" + digits.slice(5);
    if (digits.length > 12) out = out.slice(0, 13) + "-" + digits.slice(12);
    el.value = out;
  });
}
function isValidCnic(value) {
  return /^\d{5}-\d{7}-\d{1}$/.test(value.trim());
}

/* ---------- Image compression ----------
   Reads a File, draws it to a canvas at a max dimension,
   and returns a compressed base64 JPEG data URL. Keeping
   images small is essential since they're stored directly
   in Firestore documents (1 MiB per-document limit). */
function compressImageFile(file, { maxDim = 480, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided"));
    if (!file.type.startsWith("image/")) return reject(new Error("File is not an image"));
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/* Rough size check for a base64 data URL, in KB */
function dataUrlSizeKb(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.split(",")[1] || "";
  return Math.round((base64.length * 0.75) / 1024);
}

/* ---------- Initials fallback for avatars ---------- */
function initialsOf(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

/* ---------- Relative time ---------- */
function timeAgo(date) {
  if (!date) return "";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

/* ---------- Firestore Timestamp → Date ---------- */
function toJsDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return new Date(ts);
}

/* ---------- Full-page loader ---------- */
function showPageLoader(text = "Loading...") {
  let el = document.getElementById("page-loader");
  if (!el) {
    el = document.createElement("div");
    el.id = "page-loader";
    el.className = "page-loader";
    el.innerHTML = `<div class="brand-mark">🪪</div><div class="spinner dark"></div><div class="txt">${escapeHtml(text)}</div>`;
    document.body.appendChild(el);
  }
  el.classList.remove("hidden");
}
function hidePageLoader() {
  const el = document.getElementById("page-loader");
  if (el) el.classList.add("hidden");
}
