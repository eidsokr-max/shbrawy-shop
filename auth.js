// ==========================================================================
// M.G.STORE — Firebase Auth (v9 modular SDK) — Phase 1
// Sign Up / Sign In / Admin Role Detection
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// --------------------------------------------------------------------------
// 1. FIREBASE CONFIG — تم وضع بيانات مشروعك الحقيقية
// --------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCGJQVtLATT1yFdkR58JyTxJ0kbQhnLVRg",
  authDomain: "shbrawy-shop.firebaseapp.com",
  projectId: "shbrawy-shop",
  storageBucket: "shbrawy-shop.firebasestorage.app",
  messagingSenderId: "619982205483",
  appId: "1:619982205483:web:cab9426ce2888220ef306e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --------------------------------------------------------------------------
// 2. ADMIN CONFIG
// --------------------------------------------------------------------------
const ADMIN_EMAILS = [
  "admin@mgstore.com",
  // يمكنك إضافة بريدك الشخصي هنا لكي تظهر لك لوحة التحكم كـ Admin
];

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

// --------------------------------------------------------------------------
// 3. DOM REFERENCES
// --------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const signupOverlay = $("signupOverlay");
const loginOverlay = $("loginOverlay");

const signupForm = $("signupForm");
const loginForm = $("loginForm");

const signupMessage = $("signupMessage");
const loginMessage = $("loginMessage");

const signupSubmitBtn = $("signupSubmitBtn");
const loginSubmitBtn = $("loginSubmitBtn");

const authActions = $("authActions");
const userActions = $("userActions");
const userEmailLabel = $("userEmailLabel");
const roleBadge = $("roleBadge");

const guestView = $("guestView");
const memberView = $("memberView");
const memberWelcome = $("memberWelcome");
const adminPanel = $("adminPanel");

// --------------------------------------------------------------------------
// 4. MODAL HELPERS
// --------------------------------------------------------------------------
function openModal(overlay) {
  clearMessages();
  overlay.classList.remove("hidden");
}

function closeModal(overlay) {
  overlay.classList.add("hidden");
}

function clearMessages() {
  setMessage(signupMessage, "", null);
  setMessage(loginMessage, "", null);
}

function setMessage(el, text, type) {
  el.textContent = text;
  el.classList.remove("error", "success");
  if (type) el.classList.add(type);
}

$("btnShowSignup").addEventListener("click", () => openModal(signupOverlay));
$("btnShowLogin").addEventListener("click", () => openModal(loginOverlay));

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal($(btn.dataset.close)));
});

// click outside modal to close
[signupOverlay, loginOverlay].forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
});

$("switchToLogin").addEventListener("click", (e) => {
  e.preventDefault();
  closeModal(signupOverlay);
  openModal(loginOverlay);
});

$("switchToSignup").addEventListener("click", (e) => {
  e.preventDefault();
  closeModal(loginOverlay);
  openModal(signupOverlay);
});

// --------------------------------------------------------------------------
// 5. BUTTON LOADING STATE
// --------------------------------------------------------------------------
function setLoading(button, isLoading) {
  button.disabled = isLoading;
  button.querySelector(".btn-text").style.opacity = isLoading ? 0.6 : 1;
  button.querySelector(".spinner").classList.toggle("hidden", !isLoading);
}

// --------------------------------------------------------------------------
// 6. FRIENDLY ERROR MESSAGES
// --------------------------------------------------------------------------
function friendlyAuthError(error) {
  const code = error?.code || "";
  const map = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password should be at least 8 characters.",
    "auth/missing-password": "Please enter a password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/user-disabled": "This account has been disabled.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// --------------------------------------------------------------------------
// 7. CLIENT-SIDE VALIDATION HELPERS
// --------------------------------------------------------------------------
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --------------------------------------------------------------------------
// 8. SIGN UP HANDLER
// --------------------------------------------------------------------------
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;

  if (!isValidEmail(email)) {
    setMessage(signupMessage, "Please enter a valid email address.", "error");
    return;
  }
  if (password.length < 8) {
    setMessage(signupMessage, "Password must be at least 8 characters.", "error");
    return;
  }
  if (password !== confirm) {
    setMessage(signupMessage, "Passwords do not match.", "error");
    return;
  }

  setLoading(signupSubmitBtn, true);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    setMessage(signupMessage, "Account created successfully!", "success");
    signupForm.reset();
    setTimeout(() => closeModal(signupOverlay), 700);
  } catch (error) {
    console.error("Signup error:", error);
    setMessage(signupMessage, friendlyAuthError(error), "error");
  } finally {
    setLoading(signupSubmitBtn, false);
  }
});

// --------------------------------------------------------------------------
// 9. LOGIN HANDLER
// --------------------------------------------------------------------------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessages();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!isValidEmail(email)) {
    setMessage(loginMessage, "Please enter a valid email address.", "error");
    return;
  }
  if (!password) {
    setMessage(loginMessage, "Please enter your password.", "error");
    return;
  }

  setLoading(loginSubmitBtn, true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    setMessage(loginMessage, "Logged in successfully!", "success");
    loginForm.reset();
    setTimeout(() => closeModal(loginOverlay), 500);
  } catch (error) {
    console.error("Login error:", error);
    setMessage(loginMessage, friendlyAuthError(error), "error");
  } finally {
    setLoading(loginSubmitBtn, false);
  }
});

// --------------------------------------------------------------------------
// 10. LOGOUT HANDLER
// --------------------------------------------------------------------------
$("btnLogout").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// --------------------------------------------------------------------------
// 11. AUTH STATE OBSERVER
// --------------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (user) {
    authActions.classList.add("hidden");
    userActions.classList.remove("hidden");
    guestView.classList.add("hidden");
    memberView.classList.remove("hidden");

    userEmailLabel.textContent = user.email;
    memberWelcome.textContent = `Signed in as ${user.email}`;

    const admin = isAdminEmail(user.email);
    roleBadge.classList.toggle("hidden", !admin);
    adminPanel.classList.toggle("hidden", !admin);
  } else {
    authActions.classList.remove("hidden");
    userActions.classList.add("hidden");
    guestView.classList.remove("hidden");
    memberView.classList.add("hidden");

    roleBadge.classList.add("hidden");
    adminPanel.classList.add("hidden");
  }
});
