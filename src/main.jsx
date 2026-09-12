import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import "./global-mobile.css";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);

// PWA — Stage 10, Punto 2. Solo in produzione: in dev il service worker
// interferirebbe con l'HMR di Vite. Nessuna cache/logica offline (vedi
// public/sw.js) — non tocca in nessun modo Supabase o /api/chat.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[PWA] Registrazione service worker non riuscita:', err);
    });
  });
}
