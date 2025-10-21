import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { Toaster } from './components/ui/toaster.tsx'
import { UniversityProvider } from './contexts/UniversityContext.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <UniversityProvider>
        <App />
        <Toaster />
      </UniversityProvider>
    </AuthProvider>
  </React.StrictMode>,
)
