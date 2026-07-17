import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// ختم بناء يتغيّر مع كل عملية بناء — يظهر داخل التطبيق ليتأكّد المستخدم أن
// النسخة الجديدة وصلت فعلاً للجهاز (يُحسب لحظة بدء البناء).
const BUILD_STAMP = new Date()
  .toLocaleString('en-GB', { hour12: false })
  .replace(',', '')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_STAMP__: JSON.stringify(BUILD_STAMP),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // فصل مكتبات الطرف الثالث لتقليل حجم الحزمة الرئيسية.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          maps: ['@react-google-maps/api'],
        },
      },
    },
  },
})
