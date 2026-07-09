// src/components/MedicationReminder.jsx
import { useEffect, useState } from "react";
import { ref, query, orderByChild, equalTo, get } from "firebase/database";
import { db } from "../firebase/config";

// Helper function to play a 3-tone beep sequence
const playAlarmSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    
    const playTone = (frequency, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTime);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + startTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Play 3 tones: high, higher, highest
    playTone(880, 0, 0.2);      // A5
    playTone(1046.50, 0.2, 0.2); // C6
    playTone(1318.51, 0.4, 0.4); // E6
  } catch (err) {
    console.error("Audio playback failed:", err);
  }
};

export default function MedicationReminder({ currentUser }) {
  const [notifiedDoses, setNotifiedDoses] = useState(new Set());

  useEffect(() => {
    if (!currentUser) return;

    // Request notification permission if needed
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkMedications = async () => {
      try {
        // Resolve patient ID
        const patientQuery = query(
          ref(db, "patients"),
          orderByChild("linkedUid"),
          equalTo(currentUser.uid)
        );
        
        const snap = await get(patientQuery);
        let patientId = currentUser.uid;
        if (snap.exists()) {
          patientId = Object.keys(snap.val())[0];
        }

        // Fetch medications
        const medsQuery = query(
          ref(db, "medications"),
          orderByChild("patientId"),
          equalTo(patientId)
        );
        
        const medsSnap = await get(medsQuery);
        if (!medsSnap.exists()) return;
        
        const meds = medsSnap.val();
        
        // Get current time
        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, "0");
        const currentMinutes = String(now.getMinutes()).padStart(2, "0");
        const currentTimeString = `${currentHours}:${currentMinutes}`;
        const currentDateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        const newNotifiedSet = new Set(notifiedDoses);
        let shouldUpdateSet = false;

        Object.entries(meds).forEach(([id, med]) => {
          // Check date bounds
          if (med.startDate && med.startDate > currentDateString) return;
          if (med.endDate && med.endDate < currentDateString) return;

          const times = Array.isArray(med.reminderTime) 
            ? med.reminderTime 
            : (Array.isArray(med.reminderTimes) ? med.reminderTimes : [med.reminderTime]);

          times.forEach(time => {
            if (!time) return;
            
            // Check if current time matches reminder time
            if (time === currentTimeString) {
              const notificationKey = `${id}_${currentDateString}_${time}`;
              
              if (!newNotifiedSet.has(notificationKey)) {
                console.log(`⏰ Time to take ${med.medicationName || med.name}!`);
                
                // 1. Play Sound
                playAlarmSound();
                
                // 2. Show Browser Notification
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("MedRemind", {
                    body: `Time to take your medication: ${med.medicationName || med.name} (${med.dosage})`,
                    icon: "/favicon.ico", // Ensure you have a favicon
                    requireInteraction: true
                  });
                }
                
                newNotifiedSet.add(notificationKey);
                shouldUpdateSet = true;
              }
            }
          });
        });

        if (shouldUpdateSet) {
          setNotifiedDoses(newNotifiedSet);
        }

      } catch (err) {
        console.error("Error checking medication reminders:", err);
      }
    };

    // Run immediately, then every 10 seconds
    checkMedications();
    const interval = setInterval(checkMedications, 10000);

    return () => clearInterval(interval);
  }, [currentUser, notifiedDoses]);

  return null; // This is a background component, renders nothing
}
