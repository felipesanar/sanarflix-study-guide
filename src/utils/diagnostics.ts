import React from 'react';
import ReactDOM from 'react-dom/client';

export const runStartupDiagnostics = (): boolean => {
  const diagnostics = {
    reactLoaded: typeof React !== 'undefined' && React.createElement !== undefined,
    reactDomLoaded: typeof ReactDOM !== 'undefined' && ReactDOM.createRoot !== undefined,
    localStorage: typeof localStorage !== 'undefined',
    sessionStorage: typeof sessionStorage !== 'undefined',
    broadcastChannel: typeof BroadcastChannel !== 'undefined',
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  console.log('🔍 Startup Diagnostics:', diagnostics);

  if (!diagnostics.reactLoaded || !diagnostics.reactDomLoaded) {
    console.error('❌ CRITICAL: React not loaded properly');
    return false;
  }

  return true;
};
