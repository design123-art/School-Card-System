# School ID Card Management System (Students + Staff)

A single, self-contained school admin website that manages **both student
and staff ID cards** side by side — one login, one dashboard, one school
profile, two record types. Built with vanilla HTML/CSS/JS, Firebase
Authentication, and Cloud Firestore (no frameworks, no build step, no
Firebase Storage).

## 1. Firebase project setup

1. Go to the [Firebase console](https://console.firebase.google.com) and create a new project.
2. **Authentication** → Sign-in method → enable **Email/Password**.
3. Create your first admin user: Authentication → Users → Add user (enter the
   admin's email + password). There's no public sign-up — admins are created
   directly in the Firebase console.
4. **Firestore Database** → Create database → start in production mode (rules
   are provided below).
5. Project settings → General → "Your apps" → Add app → Web → copy the config
   object it gives you.
6. Paste that config into `js/firebase-config.js`, replacing the placeholder
   values.

## 2. Firestore security rules

Paste this into Firestore → Rules. It restricts every read/write — for both
collections — to signed-in admins only; public/anonymous users cannot access
any data.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{studentId} {
      allow read, write: if request.auth != null;
    }
    match /staff/{staffId} {
      allow read, write: if request.auth != null;
    }
    match /school_settings/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 3. Running the site

No build step is required — it's plain HTML/CSS/JS.

- **Locally:** open `index.html` with a local static server (e.g. the VS Code
  "Live Server" extension, or `npx serve`). Opening the file directly with
  `file://` can cause issues with some browsers' security rules for fetches.
- **Hosting:** deploy the whole folder to Firebase Hosting, Netlify, Vercel, or
  any static host. If you use Firebase Hosting, run `firebase init hosting`
  in this folder and set the public directory to `.`.

## 4. First-time use

1. Sign in with the admin account you created in step 1.3.
2. Go to **School Settings** first and fill in the school name, address,
   phone, and logo — this appears on the header of every ID card (both
   student and staff) and updates them automatically. The settings page
   shows a live preview of each card type so you can check both at once.
3. Add your first records:
   - **Add Student** — name, father name, GR number, roll number, class,
     section, shift, date of birth, address, and parent contact.
   - **Add Staff** — name, staff category (Teaching Staff, Admin, Peon,
     Worker, Cleaner, Security Guard, Driver, Lab Assistant, Librarian,
     Other), relation type/name, address, CNIC, and optional
     mobile/designation.
4. **Student Records** and **Staff Records** are separate tables (search,
   filter, sort, edit, delete, and per-row print all work independently),
   each with its own "Add" page and its own live ID card preview.
5. Go to **Print Cards** to generate A4 sheets (8 cards per page). Choose
   from four modes:
   - **All Students** — every student, one sheet after another.
   - **All Staff** — every staff member, one sheet after another.
   - **All (Students + Staff)** — a combined run, useful for printing a
     whole school's cards in one PDF.
   - **Selected Only** — whatever you ticked on the Student Records or
     Staff Records page (you can select from both before printing — a
     mixed batch prints correctly, with each card showing the right
     fields for its type).

## 5. Project structure

```
index.html              Admin login (email/password, forgot password, remember me)
dashboard.html           Combined stats (students, staff, total cards), recent activity feed
students.html            Student records table (search/filter by class & section, sort, paginate)
add-student.html         Add + edit student form (?id= toggles edit mode) with live card preview
staff.html               Staff records table (search/filter by category, sort, paginate)
add-staff.html           Add + edit staff form (?id= toggles edit mode) with live card preview
settings.html            School name/address/phone/email/logo, previews both card types
print.html               8-cards-per-A4 print layout — students, staff, both, or a mixed selection

css/style.css            Design system (color, type, components) — includes both card layouts
css/print.css            Exact A4 / 90mm×55mm card print layout for both card types

js/firebase-config.js    Firebase project keys (edit this first) — students, staff & settings collections
js/utils.js              Toasts, confirm modal, image compression, CNIC helpers
js/auth.js               Login, forgot password, session guard, logout
js/layout.js             Shared sidebar/topbar shell, grouped nav (Students / Staff / School)
js/idcard.js             Single source of truth for BOTH card types — one function decides
                         the field set and role tag based on a "student" or "staff" type
js/dashboard.js          Combined dashboard logic
js/students.js           Student records table logic
js/add-student.js        Add/edit student form logic
js/staff.js              Staff records table logic
js/add-staff.js          Add/edit staff form logic
js/settings.js           School settings logic
js/print.js              Print/PDF logic, aware of mixed student+staff selections
```

## 6. How students and staff share the system

- **One Firestore project, two collections:** `students` and `staff`, plus a
  single shared `school_settings` document. Editing school info in one place
  updates both card types instantly.
- **One ID card renderer:** `js/idcard.js` exports `renderIdCardElement(person,
  school, type)` and `buildPrintCardHtml(person, school, type)`, where `type`
  is `"student"` or `"staff"`. The header, footer, and general card shell are
  identical — only the role tag and the field grid change per type. This
  means a school-info change, a card-size tweak, or a new color scheme only
  needs to be edited once and both card types stay visually consistent.
- **Independent record management:** students and staff each get their own
  table, search, filters, and add/edit form, since their fields differ
  significantly (academic info vs. CNIC/relation info). They're linked only
  through the shared dashboard, settings, and print page.
- **Staff categories** (set in `STAFF_CATEGORIES` at the top of
  `js/idcard.js`) cover both teaching and non-teaching staff — Teacher, Admin
  staff, Peon, Worker, Cleaner, Security Guard, Driver, Lab Assistant,
  Librarian, and Other. The category drives the printed role tag (e.g.
  "TEACHER", "PEON", "SECURITY").

## 7. Notes on image storage

Per the brief, **Firebase Storage is not used**. Photos (student and staff)
and the school logo are compressed client-side (resized + JPEG-compressed to
a small data URL) and stored directly as strings inside the Firestore
document.

- Firestore documents have a 1 MiB limit — the compression settings (480px
  max dimension for photos, 300px for the logo, ~70–80% JPEG quality) keep
  images comfortably under a few hundred KB, even at a large-school scale.
- If you need higher-resolution photos for print, raise `maxDim`/`quality` in
  the `compressImageFile()` calls in `js/add-student.js`, `js/add-staff.js`,
  and `js/settings.js`, while keeping an eye on document size.

## 8. Card & print specs

- Screen ID card preview: 336×212px for both card types.
- Print card: 90mm × 55mm, arranged 2 columns × 4 rows on a 210×297mm A4
  sheet with 12mm/10mm page margins — exactly 8 cards per page (mixed
  student/staff sheets are supported), with automatic overflow onto
  additional pages.
- PDF export uses `html2canvas` (3x scale) + `jsPDF` to rasterize each A4
  sheet at print quality, one PDF page per sheet.
