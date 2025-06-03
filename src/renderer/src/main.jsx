import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CasesProvider } from './context/CasesContext'
import './assets/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CasesProvider>
      <App />
    </CasesProvider>
  </React.StrictMode>
)
