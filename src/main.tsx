import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary';
import { runStartupDiagnostics } from './utils/diagnostics';
import { preloadCommonResources, setupLinkPrefetch } from './utils/preload';
import { registerServiceWorker } from './utils/serviceWorker';
import { env } from './config/env';

function renderFatalScreen() {
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui, -apple-system, sans-serif; background: #fafafa;">
      <div style="max-width: 520px;">
        <div style="font-size: 64px; margin-bottom: 24px;">📡</div>
        <h1 style="font-size: 28px; margin-bottom: 12px; color: #111;">Estamos fora do ar</h1>
        <p style="margin-bottom: 28px; color: #666; line-height: 1.5;">
          Nosso sistema está temporariamente indisponível. Já estamos trabalhando para normalizar o acesso. Por favor, tente novamente em alguns instantes.
        </p>
        <button onclick="window.location.reload()" style="padding: 12px 28px; background: #111; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 500;">
          Tentar novamente
        </button>
      </div>
    </div>
  `;
}

// Run diagnostics before rendering
if (!runStartupDiagnostics()) {
  renderFatalScreen();
} else if (!env.IS_VALID) {
  renderFatalScreen();
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ChunkLoadErrorBoundary>
        <App />
      </ChunkLoadErrorBoundary>
    </React.StrictMode>,
  );

  // Iniciar preload de recursos após montagem inicial
  if (document.readyState === 'complete') {
    preloadCommonResources();
    setupLinkPrefetch();
    registerServiceWorker();
  } else {
    window.addEventListener('load', () => {
      preloadCommonResources();
      setupLinkPrefetch();
      registerServiceWorker();
    });
  }
}
