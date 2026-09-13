/**
 * Application entry point.
 *
 * Sets up:
 * - React StrictMode for development warnings
 * - React Dnd (Drag and Drop) for file/track dragging
 * - Error Boundary to catch and display render errors
 * - Global error handlers for uncaught exceptions
 * - Error logging to localStorage for debugging on mobile
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { store } from "./store/store.ts";

/**
 * Logs errors to console and localStorage.
 * Helps with debugging on mobile devices that don't have devtools.
 */
function logToBody(msg: string) {
  console.error(msg);
  try {
    localStorage.setItem("app_crash", String(msg));
  } catch {
    // ignore
  }
}

window.addEventListener("error", (e) => {
  logToBody(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener("unhandledrejection", (e) => {
  logToBody(`unhandledrejection: ${String(e.reason)}`);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </DndProvider>
    </Provider>
  </StrictMode>,
);
