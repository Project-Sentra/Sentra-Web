/**
 * main.jsx - Application Entry Point
 * ====================================
 * Mounts the React app into the DOM. Wraps the App component with:
 *   - StrictMode:     Enables additional development warnings
 *   - BrowserRouter:  Provides client-side routing via React Router
 *
 * The root element (#root) is defined in index.html.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
