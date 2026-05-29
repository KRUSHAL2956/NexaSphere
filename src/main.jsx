import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./i18n";
import { registerSW } from "virtual:pwa-register";
import { initializeSentry } from "./utils/errorTracking.js";
import * as Sentry from "@sentry/react";

initializeSentry();

window.addEventListener("unhandledrejection", (event) => {
  Sentry.captureException(event.reason, {
    tags: { type: "unhandledrejection" },
  });
});

window.addEventListener("error", (event) => {
  Sentry.captureException(event.error, { tags: { type: "uncaughterror" } });
});

// Apply saved theme before React renders — prevents flash of wrong theme
const savedTheme = localStorage.getItem("ns-theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

// Register service worker
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <GlobalErrorBoundary>
          <App />
        </GlobalErrorBoundary>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>
);
