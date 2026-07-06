// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, db } from "../firebase/config";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userRoles, setUserRoles] = useState({}); // { patient: true, caregiver: true }
  const [activeRole, setActiveRole] = useState(null); // The current active workspace ("patient" | "caregiver" | "clinician")
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserData = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        try {
          const userRef = ref(db, `users/${user.uid}`);
          unsubscribeUserData = onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              setUserData(data);
              
              // Migrate old role formats to the current roles map shape.
              const rolesMap = Array.isArray(data.roles)
                ? data.roles.reduce((acc, role) => ({ ...acc, [role]: true }), {})
                : data.roles || { [data.role || "patient"]: true };
              setUserRoles(rolesMap);

              setActiveRole(prevRole => {
                const cachedRole = localStorage.getItem(`activeRole_${user.uid}`);
                if (cachedRole && rolesMap[cachedRole]) {
                  return cachedRole;
                } else if (!prevRole || !rolesMap[prevRole]) {
                  const firstRole = Object.keys(rolesMap).find(role => rolesMap[role] === true);
                  return firstRole || null;
                }
                return prevRole;
              });
            } else {
              setUserData(null);
              setUserRoles({});
              setActiveRole(null);
            }
            setLoading(false);
          });
        } catch (err) {
          console.error("Error setting up user workspace session:", err);
          setUserData(null);
          setUserRoles({});
          setActiveRole(null);
          setLoading(false);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserData(null);
        setUserRoles({});
        setActiveRole(null);
        if (unsubscribeUserData) {
          unsubscribeUserData();
          unsubscribeUserData = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserData) {
        unsubscribeUserData();
      }
    };
  }, []);

  const updateActiveRole = (newRole) => {
    if (currentUser && userRoles[newRole]) {
      setActiveRole(newRole);
      localStorage.setItem(`activeRole_${currentUser.uid}`, newRole);
    }
  };

  const value = {
    currentUser,
    userData,
    userRoles,
    activeRole,
    updateActiveRole,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
