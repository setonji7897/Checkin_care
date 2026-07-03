// src/firebase/config.js
//
// PURPOSE: This is the single entry point for everything Firebase.
// We initialise the Firebase app ONCE here, then export the specific
// services (auth, database, messaging) so any other file can import
// just what it needs without re-initialising Firebase.
//
// HOW TO FILL IN YOUR KEYS:
//  1. Go to https://console.firebase.google.com
//  2. Select your project → Project Settings → General → "Your apps"
//  3. Click the </> (Web) icon, register a web app, copy the config object.
//  4. Replace every value below with your own.
//
// ⚠️  NEVER commit real API keys to a public repo.
//     In production, move these into a .env file (see .env.example).

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCCxT6jmVbyszfiMHsyXiBtXtqjOE5kGPk",
  authDomain: "smart-medication-reminde-d7f30.firebaseapp.com",
  databaseURL: "https://smart-medication-reminde-d7f30-default-rtdb.firebaseio.com",
  projectId: "smart-medication-reminde-d7f30",
  storageBucket: "smart-medication-reminde-d7f30.firebasestorage.app",
  messagingSenderId: "1018909313942",
  appId: "1:1018909313942:web:cb3c8e0baa08aa63002bb7"
};

// Initialise the Firebase app safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase Authentication
export const auth = getAuth(app);

// Firebase Realtime Database
export const db = getDatabase(app);

// Firebase Cloud Messaging — browser push notifications
// NOTE: getMessaging() only works in a browser with Service Worker support.
// We wrap it in a try/catch so Vite's SSR / build step doesn't crash.
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn("FCM not available in this environment:", err.message);
}
export { messaging };

export default app;
