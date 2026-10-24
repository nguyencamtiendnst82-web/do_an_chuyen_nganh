import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tailwind CSS v4 plugin cho Vite
  ],
  server: {
    port: 5173,
    // Cho phép truy cập qua tunnel khi test trên điện thoại
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'],
    proxy: {
      // Proxy API calls tới backend
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          // Backend chỉ chấp nhận Origin http://localhost:5173.
          // Khi truy cập qua tunnel, ghi đè lại Origin cho request gửi sang backend.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://localhost:5173')
          })
        },
      },
    },
  },
})