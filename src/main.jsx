import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PixelGrove from './pixel-grove/PixelGrove.jsx'

const App = window.location.pathname.startsWith('/classic')
  ? (await import('./App.jsx')).default
  : PixelGrove

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
