/* ============================================================
   FIREBASE CONFIGURATION
   Replace the values below with your own Firebase project config.
   Firebase Console → Project Settings → General → Your apps → SDK setup.
   Only Authentication (Email/Password) and Firestore are used.
   Do NOT enable/require Firebase Storage — images are stored in
   Firestore as compressed base64 strings.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBW9FaqgxKLYxI44mkbBHYZ1PsDE-HaWp8",
  authDomain: "school-info-3a827.firebaseapp.com",
  projectId: "school-info-3a827",
  storageBucket: "school-info-3a827.firebasestorage.app",
  messagingSenderId: "186213848968",
  appId: "1:186213848968:web:5a82524ccb72da37cacc3d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Collections — one school, two record types, one shared settings doc.
const COL_STUDENTS = "students";
const COL_STAFF = "staff";
const COL_SETTINGS = "school_settings";
const SETTINGS_DOC_ID = "school_info";
