import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { registerServiceWorker } from './lib/push'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// تسجيل Service Worker للإشعارات الخلفية (اختياري — يفشل بهدوء إن لم يُدعم).
void registerServiceWorker()
