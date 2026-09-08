import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'

function logToBody(msg: string) {
  console.error(msg)
  try {
    localStorage.setItem('app_crash', String(msg))
  } catch {
    // ignore
  }
}

window.addEventListener('error', (e) => {
  logToBody(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}`)
})
window.addEventListener('unhandledrejection', (e) => {
  logToBody(`unhandledrejection: ${String(e.reason)}`)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DndProvider backend={HTML5Backend}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </DndProvider>
  </StrictMode>,
)
