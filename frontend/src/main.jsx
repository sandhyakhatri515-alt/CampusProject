import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ConfirmProvider } from './components/Confirm';
import { LookupProvider } from './context/LookupContext';
import { AuthProvider } from './context/AuthContext';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LookupProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </LookupProvider>
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'Nunito, sans-serif', fontWeight: 700, borderRadius: 14 } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
