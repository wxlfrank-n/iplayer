/**
 * Application entry point.
 *
 * Sets up:
 * - React StrictMode for development warnings
 * - Error Boundary to catch and display render errors
 * - Global error handlers for uncaught exceptions
 * - Error logging to localStorage for debugging on mobile
 */

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import './index.css';
import App from './App.tsx';
import {ThemeProvider} from './ThemeProvider.tsx';
import {ErrorBoundary} from './ErrorBoundary.tsx';
import {store} from './store/store.ts';
import {ConfiguredI18nProvider} from './i18n/ConfiguredI18nProvider.tsx';

/**
 * Logs errors to console and localStorage.
 * Helps with debugging on mobile devices that don't have devtools.
 */
function logToBody(msg: string) {
  console.error(msg);
  try {
    localStorage.setItem('app_crash', String(msg));
  } catch {
    // ignore
  }
}

window.addEventListener('error', e => {
  logToBody(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', e => {
  logToBody(`unhandledrejection: ${String(e.reason)}`);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ConfiguredI18nProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </ConfiguredI18nProvider>
    </Provider>
  </StrictMode>,
);
