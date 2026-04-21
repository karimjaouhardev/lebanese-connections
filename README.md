# Lebanese Connections

A bilingual (Arabic/English) word-connections game built with React + TypeScript + Vite.

## What this app now includes

- Daily-style 4x4 connections gameplay (from `public/puzzle.json`)
- Arabic/English toggle with RTL/LTR support
- Firebase Authentication:
  - Google sign-in
  - Username/password sign-up and sign-in
- Persistent login (users stay signed in on the same browser)
- Per-user stats stored in Firestore:
  - current streak
  - best streak
  - wins
  - losses
  - games played

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill in Firebase values in `.env.local`.

4. Start dev server:

```bash
npm run dev
```

## Firebase setup (quick)

1. Create a Firebase project at https://console.firebase.google.com
2. Add a **Web App** and copy its config values into `.env.local`.
3. Enable Authentication providers:
   - `Authentication` -> `Sign-in method`
   - Enable `Google`
   - Enable `Email/Password`
4. Create Firestore database:
   - `Firestore Database` -> `Create database`
   - Start in production mode
5. Set Firestore rules using `firestore.rules` in this repo:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/dailyProgress/{puzzleDate} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Username/password behavior

Firebase email/password auth is used under the hood.

- If the user enters a plain username (for example `karim`), the app maps it to an internal email format: `karim@family.local`.
- This keeps sign-up simple for family while still using standard Firebase auth.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Puzzle data format

Puzzle groups come from `public/puzzle.json`:

- 4 words per group
- each group has `id`, `title`, `solvedColor`, and `words`
- each word supports:
  - `arabic` (required)
  - `arabeezy` (optional)
