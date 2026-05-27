import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ChunkLoadErrorBoundary } from './components/ChunkLoadErrorBoundary';
import { runStartupDiagnostics } from './utils/diagnostics';
import { preloadCommonResources, setupLinkPrefetch } from './utils/preload';
import { registerServiceWorker } from './utils/serviceWorker';
import { env } from './config/env';

function renderFatalScreen(title: string, body: string) {
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui, sans-serif;">
      <div style="max-width: 480px;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">${title}</h1>
        <p style="margin-bottom: 24px; color: #666;">${body}</p>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
          Recarregar
        </button>
      </div>
    </div>
  `;
}

// Run diagnostics before rendering
if (!runStartupDiagnostics()) {
  renderFatalScreen('Erro de Carregamento', 'Por favor, recarregue a página.');
} else if (!env.IS_VALID) {
  renderFatalScreen(
    'Configuração de ambiente ausente',
    'O aplicativo não pôde inicializar porque variáveis de ambiente estão faltando. Tente novamente em alguns instantes ou contate o suporte.',
  );
} else {
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center;">
      <div>
        <h1 style="font-size: 24px; margin-bottom: 16px;">Erro de Carregamento</h1>
        <p style="margin-bottom: 24px; color: #666;">Por favor, recarregue a página.</p>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
          Recarregar
        </button>
      </div>
    </div>
  `;
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
