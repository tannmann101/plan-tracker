import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Base must match your GitHub Pages repo name, e.g. https://<user>.github.io/plan-tracker/
export default defineConfig({
  base: '/plan-tracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '3-Year Plan Tracker',
        short_name: 'Plan Tracker',
        description: 'Shared goal/task intake for a household 3-year plan',
        theme_color: '#1A1A1A',
        background_color: '#F6F6F4',
        display: 'standalone',
        start_url: '/plan-tracker/',
        scope: '/plan-tracker/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
