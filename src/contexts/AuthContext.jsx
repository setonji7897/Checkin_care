// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snapshot = await get(ref(db, `users/${user.uid}`));
          if (snapshot.exists()) {
            const data = snapshot.val();
            setUserData(data);
            
            // Migrate old role formats to the current roles map shape.
            const rolesMap = Array.isArray(data.roles)
              ? data.roles.reduce((acc, role) => ({ ...acc, [role]: true }), {})
              : data.roles || { [data.role || "patient"]: true };
            setUserRoles(rolesMap);

            // Fetch stored session active role preference if it matches user's roles
            const cachedRole = localStorage.getItem(`activeRole_${user.uid}`);
            if (cachedRole && rolesMap[cachedRole]) {
              setActiveRole(cachedRole);
            } else {
              // Default to the first truthy role
              const firstRole = Object.keys(rolesMap).find(role => rolesMap[role] === true);
              setActiveRole(firstRole || null);
            }
          } else {
            setUserData(null);
            setUserRoles({});
            setActiveRole(null);
          }
        } catch (err) {
          console.error("Error setting up user workspace session:", err);
          setUserData(null);
          setUserRoles({});
          setActiveRole(null);
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserData(null);
        setUserRoles({});
        setActiveRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
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
