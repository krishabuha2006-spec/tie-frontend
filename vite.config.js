import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'https://tie-backend-ruddy.vercel.app',
        changeOrigin: true,
        secure: false,

        timeout: 60000,
        proxyTimeout: 60000,
      },
    },
  },
})
