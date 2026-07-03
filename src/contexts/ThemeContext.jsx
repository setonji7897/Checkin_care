import { createContext, useContext, useState, useEffect } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase/config";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [userId, setUserId] = useState(null);
  const { currentUser } = useAuth();

  // Load from Firebase on mount
  const loadSettings = async (uid) => {
    setUserId(uid);
    try {
      const snap = await get(ref(db, "users/" + uid + "/settings"));
      if (snap.exists()) {
        const s = snap.val();
        setDarkMode(s.darkMode || false);
        setLargeText(s.largeText || false);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (currentUser) {
      loadSettings(currentUser.uid);
    } else {
      setUserId(null);
      setDarkMode(false);
      setLargeText(false);
    }
  }, [currentUser]);

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    if (userId) await set(ref(db, "users/" + userId + "/settings/darkMode"), next);
  };

  const toggleLargeText = async () => {
    const next = !largeText;
    setLargeText(next);
    if (userId) await set(ref(db, "users/" + userId + "/settings/largeText"), next);
  };

  // Apply to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    document.documentElement.setAttribute("data-large-text", largeText ? "true" : "false");
  }, [darkMode, largeText]);

  return (
    <ThemeContext.Provider value={{ darkMode, largeText, toggleDarkMode, toggleLargeText, loadSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}
