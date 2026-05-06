import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Register service worker for PWA (requires vite-plugin-pwa)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Will only work after running: npm install -D vite-plugin-pwa
    // and uncommenting VitePWA block in vite.config.ts
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
