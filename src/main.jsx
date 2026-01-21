import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

console.log('Frontend env', {
  mode: import.meta.env.MODE,
  base44Proxy: import.meta.env.VITE_BASE44_APP_BASE_URL,
  database: import.meta.env.DATABASE_URL
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
