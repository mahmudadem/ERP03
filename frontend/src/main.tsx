import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/globals.css';
import './i18n/config'; // Initialize i18n
import { ErrorModal } from './components/ErrorModal';
import { setupErrorInterceptor } from './api/errorInterceptor';

// React Query is mounted by App.tsx via providers/QueryProvider.tsx so the
// app has exactly one QueryClientProvider in the tree.

// Setup error handling for API calls
setupErrorInterceptor();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element 'root'");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      containerStyle={{ zIndex: 1000000 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10B981',
            secondary: '#fff',
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#EF4444',
            secondary: '#fff',
          },
        },
      }}
    />
    <ErrorModal />
  </React.StrictMode>
);
