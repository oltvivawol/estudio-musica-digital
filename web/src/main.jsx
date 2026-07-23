import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'
import { AuthVawolProvider } from './context/AuthVawol.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthVawolProvider>
        <App />
        <Toaster theme="dark" position="bottom-right" />
      </AuthVawolProvider>
    </BrowserRouter>
  </StrictMode>,
)
