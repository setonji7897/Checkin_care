// public/firebase-messaging-sw.js
//
// PURPOSE: Stage 6 — Firebase Cloud Messaging Service Worker
//
// WHY A SERVICE WORKER?
//   Push notifications must be received by a background process that runs even
//   when the browser tab is closed. The browser registers a Service Worker (SW)
//   which lives independently of the React app. Firebase reads this file at the
//   exact path "/firebase-messaging-sw.js" — this CANNOT be renamed.
//
// HOW IT WORKS:
//   1. Firebase SDK sends a push to the browser via FCM.
//   2. The browser routes the push to this SW.
//   3. If the tab is in the background, we call showNotification() here.
//   4. If the tab is in the foreground, the onMessage() handler in the React
//      app handles it instead (see useFCMNotifications hook).
//
// IMPORTANT:
//   The Firebase config MUST be duplicated here (importScripts cannot import
//   ES modules). Keep these values in sync with src/firebase/config.js.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCCxT6jmVbyszfiMHsyXiBtXtqjOE5kGPk",
  authDomain: "smart-medication-reminde-d7f30.firebaseapp.com",
  databaseURL: "https://smart-medication-reminde-d7f30-default-rtdb.firebaseio.com",
  projectId: "smart-medication-reminde-d7f30",
  storageBucket: "smart-medication-reminde-d7f30.firebasestorage.app",
  messagingSenderId: "1018909313942",
  appId: "1:1018909313942:web:cb3c8e0baa08aa63002bb7"
});

const messaging = firebase.messaging();

// Handle background messages (tab closed or not focused)
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background FCM message received:", payload);

  const title = payload.notification?.title || "MedRemind Reminder";
  const options = {
    body: payload.notification?.body || "You have a medication due soon.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: payload.data?.medicationId || "med-reminder",  // deduplicates identical notifications
    data: payload.data || {},
    requireInteraction: true,  // notification stays until user dismisses it
    actions: [
      { action: "taken", title: "✅ Taken" },
      { action: "snooze", title: "⏰ Snooze 10min" }
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle notification click — open/focus the app tab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  const targetUrl = "/patient"; // Default: open patient dashboard

  if (action === "taken") {
    console.log("[SW] User marked dose as taken from notification.");
    // The in-app handler in TodaySchedule.jsx will log the adherence entry
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
