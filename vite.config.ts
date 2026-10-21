/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'Thet Naing Service', short_name: 'Thet Naing',
      description: 'Appliance and industrial machine repair workshop',
      theme_color: '#193d68', background_color: '#f3f6fa', display: 'standalone', start_url: '/',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallbackDenylist: [/^\/api\//] },
  })],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
})
