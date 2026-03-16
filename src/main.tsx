import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onRegisteredSW(_swScriptUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 1000); // check every 60 seconds
    }
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
