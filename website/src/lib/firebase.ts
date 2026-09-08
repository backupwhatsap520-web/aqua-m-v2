/*  Firebase v11, modular imports only.
 *
 *  The whole point of this module is that a missing or half-filled .env is a
 *  normal, survivable state — not a crash. `isConfigured` is exported so the UI
 *  can say "cannot reach the database" instead of rendering a white screen,
 *  which is exactly what a judge sees if the venue Wi-Fi misbehaves.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/*  databaseURL is the only field this dashboard genuinely cannot work without:
 *  everything it reads and writes lives in the Realtime Database. */
export const isConfigured = Boolean(cfg.databaseURL && cfg.apiKey);

let app: FirebaseApp | null = null;
let db: Database | null = null;

if (isConfigured) {
  try {
    app = initializeApp(cfg);
    db = getDatabase(app);
  } catch (err) {
    //  A malformed URL throws here. Report it and stay in the degraded state
    //  rather than taking the page down.
    console.error('[firebase] init failed, dashboard will run degraded:', err);
    app = null;
    db = null;
  }
}

export { app, db };
