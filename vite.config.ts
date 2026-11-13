import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {VitePWA} from 'vite-plugin-pwa'
export default defineConfig({base: './', plugins: [react(), VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {name: 'Engineering Toolbox', short_name: 'Toolbox', description: 'Strumenti e formulario scientifico-ingegneristico, offline',
    lang: 'it', start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#14161a', theme_color: '#14161a',
    icons: [{src: 'icon-192.png', sizes: '192x192', type: 'image/png'}, {src: 'icon-512.png', sizes: '512x512', type: 'image/png'}, {src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}]},
  workbox: {globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, navigateFallback: 'index.html', cleanupOutdatedCaches: true}})]})
