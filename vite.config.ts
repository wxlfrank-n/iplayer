import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Threaded wasm (onnxruntime) needs cross-origin isolation.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
})
