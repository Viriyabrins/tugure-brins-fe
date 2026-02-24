import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

import { initKeycloak } from './lib/keycloak'

console.log('Frontend env', {
  mode: import.meta.env.MODE,
  apiProxy: import.meta.env.VITE_API_PROXY,
  database: import.meta.env.DATABASE_URL
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element with id "root" not found')
}

const renderApp = () => {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

initKeycloak()
  .then(() => {
    renderApp()
  })
  .catch((error) => {
    console.error('Keycloak init failed, app render aborted:', error)
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-xl w-full bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-lg font-semibold text-red-700 mb-2">Authentication initialization failed</h1>
            <p className="text-sm text-slate-700 mb-2">
              Keycloak could not complete login bootstrap. This is commonly caused by Keycloak client CORS / Web Origins configuration.
            </p>
            <p className="text-xs text-slate-500">
              Check Keycloak client settings: Valid Redirect URIs and Web Origins for http://localhost:5173.
            </p>
          </div>
        </div>
      </React.StrictMode>
    )
  })
