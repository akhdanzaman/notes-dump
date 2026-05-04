import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import CallbackPage from './components/CallbackPage';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const RootComponent = () => {
  if (window.location.pathname === '/auth/callback') {
    return <CallbackPage />;
  }
  return <App />;
};

root.render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);