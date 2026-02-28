import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Initialize local notifications on startup (optional feature)
if (typeof window !== 'undefined') {
  // Lazy-load to avoid affecting startup render on desktop
  import('./services/notifications').then((m) => m?.initNotifications?.());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

// Hide web splash once app loads
window.addEventListener('load', () => {
  const splash = document.getElementById('web-splash');
  if (splash) splash.style.display = 'none';
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
