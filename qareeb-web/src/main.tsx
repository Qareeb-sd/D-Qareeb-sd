import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
// خط العلامة المستدير (مضمَّن داخل التطبيق — يعمل بلا إنترنت)
import '@fontsource/baloo-bhaijaan-2/arabic-800.css'

// Service Worker: تخزين مؤقت (فتح سريع على شبكة ضعيفة) + استقبال إشعارات Push.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
