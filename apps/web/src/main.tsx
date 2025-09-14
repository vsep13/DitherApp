import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { ToastProvider } from './ui/ToastProvider';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles/tailwind.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <ErrorBoundary>
    <ToastProvider>
      <App />
    </ToastProvider>
  </ErrorBoundary>
);
