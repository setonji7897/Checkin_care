// src/components/AuroraBackground.jsx
// Framer-motion powered aurora blobs — used in the login left panel
import { motion } from "framer-motion";
import "../styles/auth.css";

export default function AuroraBackground() {
  return (
    <div className="aurora-container">
      <div className="aurora-wrapper">
        <motion.div
          className="aurora-blob blob-1"
          animate={{ x: ["0%", "20%", "-20%", "0%"], y: ["0%", "-20%", "20%", "0%"], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="aurora-blob blob-2"
          animate={{ x: ["0%", "-30%", "20%", "0%"], y: ["0%", "30%", "-20%", "0%"], scale: [1, 0.8, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="aurora-blob blob-3"
          animate={{ x: ["0%", "40%", "-40%", "0%"], y: ["0%", "-40%", "40%", "0%"], scale: [1, 1.4, 0.9, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        />
      </div>
    </div>
  );
}
