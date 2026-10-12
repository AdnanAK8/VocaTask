import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// ponytail: enable basicSsl when HTTPS=true or --https flag is used for Android/iOS mic testing
const isHttps = process.env.HTTPS === 'true' || process.env.SSL === 'true' || process.argv.includes('--https');

export default defineConfig({
  plugins: [
    react(),
    ...(isHttps ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'VocaTask - Voice Task Manager',
        short_name: 'VocaTask',
        description: 'Speak in any language to automatically create and schedule organized tasks.',
        theme_color: '#4a6b5d',
        background_color: '#f7f8f5',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    host: true, // Listen on all network interfaces (0.0.0.0) so phone can connect on Wi-Fi
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
});
