import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { PrefsProvider } from './prefs.jsx';
import { AuthProvider, SocketProvider, ToastProvider } from './context.jsx';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/onest';
import './styles.css';
import './layout.css';
import './theme.css';
import './pending.css';
import './settings.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrefsProvider>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
    </PrefsProvider>
  </StrictMode>
);
