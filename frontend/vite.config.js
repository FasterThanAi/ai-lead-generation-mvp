import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: Number(env.VITE_FRONTEND_PORT) || 5173,
      strictPort: true,
      // Same-origin /api in development, like nginx in production: the app works
      // without VITE_API_BASE_URL as long as the backend runs on this target.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true
        }
      }
    }
  }
})
