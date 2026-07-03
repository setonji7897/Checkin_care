// src/utils/firebaseErrors.js
//
// PURPOSE: A shared utility helper to map standard Firebase Auth and Realtime Database
// error codes to clear, friendly, and plain English messages for user presentation.

export function getFriendlyErrorMessage(code) {
  const map = {
    // Auth errors
    "auth/email-already-in-use": "That email address is already registered. Try logging in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters long and contain at least one number.",
    "auth/user-not-found": "No account was found with that email address.",
    "auth/wrong-password": "The password you entered is incorrect. Please try again.",
    "auth/invalid-credential": "The email or password you entered is incorrect.",
    "auth/too-many-requests": "Too many failed login attempts. Access has been temporarily disabled. Please reset your password or try again later.",
    "auth/user-disabled": "This account has been disabled. Please contact support.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled. Please contact your administrator.",
    
    // Database and permission errors
    "permission-denied": "You do not have permission to perform this database action.",
    "database/permission-denied": "Database write access denied. Please verify your role authentication.",
  };

  return map[code] || "An unexpected error occurred. Please verify your connection and try again.";
}
