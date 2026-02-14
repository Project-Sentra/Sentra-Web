/**
 * vite.config.js - Vite Build Configuration
 * Plugins: React (JSX transforms + Fast Refresh), Tailwind CSS v4
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),        // Enables JSX and React Fast Refresh (HMR)
    tailwindcss(),  // Tailwind CSS v4 Vite integration
  ],
})
