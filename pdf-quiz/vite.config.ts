import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** GitHub Pages proje sitesi: /repo-adı/ — CI’da VITE_BASE_URL ile verilir */
const base = process.env.VITE_BASE_URL?.replace(/\/?$/, '/') || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
