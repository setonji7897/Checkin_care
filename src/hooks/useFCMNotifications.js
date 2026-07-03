// src/hooks/useFCMNotifications.js
//
// PURPOSE: Stage 6 — React hook that manages the entire FCM push notification
// lifecycle for the currently logged-in patient.
//
// WHAT THIS HOOK DOES:
//   1. Checks if the browser supports Notifications and Service Workers
//   2. Requests permission from the user (one-time browser prompt)
//   3. Retrieves the unique FCM device token for this browser
//   4. Saves the token to: /users/{uid}/fcmTokens/{token} = true
//      This lets Cloud Functions target this device when sending pushes.
//   5. Listens for FOREGROUND messages (when the tab IS open) and shows
//      a styled in-app toast notification instead of a browser popup.
//
// USAGE (in any dashboard component):
//   import { useFCMNotifications } from "../../hooks/useFCMNotifications";
//   useFCMNotifications(); // call once inside a dashboard component

import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { ref, set } from "firebase/database";
import { messaging, db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

// ⚠️  Replace this with your VAPID key from Firebase Console:
//     Console → Project Settings → Cloud Messaging → Web Push certificates
//     → Generate key pair → copy the "Key pair" value
const VAPID_KEY = "BPtPEsNGUOlVdcDtZaa1_yZTdh8DjGevfG9ZXlR3iddMFhogrBOeTqHrzqBuyiV6OZ3LLfY0BTcMz3O5yJa0xVk";

export function useFCMNotifications() {
  const { currentUser } = useAuth();
  const [permission, setPermission] = useState(Notification.permission);
  const [fcmToken, setFcmToken] = useState(null);
  const [foregroundMessage, setForegroundMessage] = useState(null);

  useEffect(() => {
    if (!currentUser || !messaging) return;

    // FCM requires Service Worker support and HTTPS (or localhost)
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      console.warn("[FCM] Notifications not supported in this environment.");
      return;
    }

    async function initFCM() {
      try {
        // 1. Request notification permission
        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm !== "granted") {
          console.warn("[FCM] Notification permission denied.");
          return;
        }

        // 2. Register the service worker (Vite serves from /public automatically)
        const swRegistration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );

        // 3. Get the FCM device token
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration
        });

        if (token) {
          setFcmToken(token);

          // 4. Save token to Realtime Database under the user's profile
          //    Using the token itself as the key avoids duplicates if this
          //    device registers again.
          await set(
            ref(db, `users/${currentUser.uid}/fcmTokens/${token}`),
            true
          );

          console.log("[FCM] Token registered:", token);
        } else {
          console.warn("[FCM] No token received.");
        }
      } catch (err) {
        console.warn("[FCM] Initialization error:", err.message);
      }
    }

    initFCM();
  }, [currentUser]);

  // 5. Listen for FOREGROUND messages and surface them as in-app state
  useEffect(() => {
    if (!messaging || !currentUser) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);
      setForegroundMessage({
        title: payload.notification?.title || "MedRemind",
        body: payload.notification?.body || "Medication reminder",
        data: payload.data || {}
      });

      // Auto-clear toast after 8 seconds
      setTimeout(() => setForegroundMessage(null), 8000);
    });

    return unsubscribe;
  }, [currentUser]);

  return { permission, fcmToken, foregroundMessage, setForegroundMessage };
}
