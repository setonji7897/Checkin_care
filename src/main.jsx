// src/main.jsx
//
// PURPOSE: The JavaScript entry point — the first file that runs.
// Vite reads this file (referenced in index.html) to boot the React app.
//
// THREE THINGS HAPPEN HERE:
//   1. We import global CSS (index.css applies to every page)
//   2. We wrap the app in <BrowserRouter> so React Router works everywhere
//   3. We wrap the app in <AuthProvider> so auth state is available everywhere
//
// WHY WRAP IN MAIN.JSX RATHER THAN APP.JSX?
//   By wrapping at the very root level we guarantee that every single
//   component — including App itself — can call useAuth() and useNavigate().
//   If we put the providers inside App.jsx we'd have to be careful about
//   component ordering. Putting them here is simpler and safer.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* BrowserRouter enables HTML5 history-based routing (clean URLs, no #) */}
    <BrowserRouter>
      {/* AuthProvider makes currentUser + userRole available to every child */}
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
