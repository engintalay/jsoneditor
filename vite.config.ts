import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST
const appVersion: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 1420,
    strictPort: true,
    // true: tum ag arayuzlerinden dinle (0.0.0.0);
    // TAURI_DEV_HOST verilirse sadece o adrese bagla.
    host: host || true,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
})
