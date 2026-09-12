/* ============================================================
   AUTHENTICATION
   Email/password login, forgot password, remember me,
   session persistence, and route guarding.
   ============================================================ */

const REMEMBER_KEY = "tidc_remember_email";

/* Call at the top of every protected page (dashboard, students, etc.)
   Redirects to login if nobody is signed in. */
function requireAuth(onReady) {
  showPageLoader("Checking your session...");
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    hidePageLoader();
    if (typeof onReady === "function") onReady(user);
  });
}

/* Call on the login page — if already signed in, skip straight to dashboard. */
function redirectIfAuthed() {
  auth.onAuthStateChanged((user) => {
    if (user) window.location.href = "dashboard.html";
  });
}

function wireLogout(selector = "[data-logout]") {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ok = await confirmModal({
        title: "Log out?",
        desc: "You'll need to sign in again to access the dashboard.",
        confirmLabel: "Log out",
        danger: false,
      });
      if (!ok) return;
      await auth.signOut();
      window.location.href = "index.html";
    });
  });
}

/* ---------- Login page wiring ---------- */
function initLoginPage() {
  redirectIfAuthed();

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberInput = document.getElementById("rememberMe");
  const errorBanner = document.getElementById("authErrorBanner");
  const submitBtn = document.getElementById("loginSubmit");
  const toggleBtn = document.getElementById("togglePassword");
  const forgotLink = document.getElementById("forgotPasswordLink");

  const savedEmail = localStorage.getItem(REMEMBER_KEY);
  if (savedEmail) {
    emailInput.value = savedEmail;
    rememberInput.checked = true;
  }

  toggleBtn?.addEventListener("click", () => {
    const isPw = passwordInput.type === "password";
    passwordInput.type = isPw ? "text" : "password";
    toggleBtn.textContent = isPw ? "Hide" : "Show";
  });

  function setError(msg) {
    if (!msg) {
      errorBanner.classList.remove("show");
      errorBanner.textContent = "";
      return;
    }
    errorBanner.textContent = msg;
    errorBanner.classList.add("show");
  }

  function friendlyAuthError(err) {
    const map = {
      "auth/invalid-email": "That email address doesn't look right.",
      "auth/user-disabled": "This admin account has been disabled.",
      "auth/user-not-found": "No admin account matches that email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
      "auth/network-request-failed": "Network error — check your connection and try again.",
    };
    return map[err.code] || "Sign-in failed. Please try again.";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setError("Please enter both your email and password.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Signing in...`;

    try {
      const persistence = rememberInput.checked
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      await auth.setPersistence(persistence);

      if (rememberInput.checked) {
        localStorage.setItem(REMEMBER_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err));
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Sign in";
    }
  });

  forgotLink?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
      setError("Enter your email address above first, then tap \u201cForgot password\u201d.");
      emailInput.focus();
      return;
    }
    setError("");
    forgotLink.textContent = "Sending...";
    try {
      await auth.sendPasswordResetEmail(email);
      toastSuccess("Reset email sent", `Check ${email} for a link to reset your password.`);
    } catch (err) {
      console.error(err);
      setError(friendlyAuthError(err));
    } finally {
      forgotLink.textContent = "Forgot password?";
    }
  });
}
