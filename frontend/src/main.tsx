import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ShopSettingsProvider } from './contexts/ShopSettingsContext';
import App from './App';
import './index.css';

// HashRouter required for file:// protocol (Electron packaged app)
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ShopSettingsProvider>
          <App />
        </ShopSettingsProvider>
      </AuthProvider>
    </Router>
  </StrictMode>
);
