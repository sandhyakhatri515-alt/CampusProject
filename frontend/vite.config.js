import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server proxies API and upload requests to the Express backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/uploads': 'http://127.0.0.1:5000'
    }
  }
})
