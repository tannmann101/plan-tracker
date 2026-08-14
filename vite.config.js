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
        name: 'Secretary',
        short_name: 'Secretary',
        description: "A head-of-household management layer -- Goals, Plans, Sessions, Tasks, weekly-meeting capture, and triage",
        theme_color: '#2E4A5E',
        background_color: '#F2EEE3',
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
