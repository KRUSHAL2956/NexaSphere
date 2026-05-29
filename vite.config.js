import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  resolve: {
    alias: {
      'next/image': '/src/shared/next-image.jsx',
      'next/dynamic': '/src/shared/next-dynamic.jsx',
    }
  },
  // Supports Vercel (/) and GitHub Pages (/NexaSphere/) via env var
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "nexasphere",
      project: process.env.SENTRY_PROJECT || "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN
    }),
    VitePWA({
      // PWA is ENABLED for production-grade offline-first support
      disable: false,

      // Use injectManifest so we control the SW file entirely.
      // This avoids the Workbox generateSW bug with paths containing apostrophes.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw-nexasphere.js',

      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Assets to include in the precache manifest
      includeAssets: [
        'favicon.ico',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'offline.html',
      ],

      // Web App Manifest
      manifest: {
        id: '/',
        name: 'NexaSphere — Connecting GL Bajaj Tech Ecosystem',
        short_name: 'NexaSphere',
        description: 'The premier tech community of GL Bajaj Group of Institutions — connecting students through hackathons, codathons, workshops, and more.',
        theme_color: '#E63946',
        background_color: '#0A0A0A',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['education', 'productivity', 'social'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Open your NexaSphere dashboard',
            url: '/dashboard',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'View Events',
            short_name: 'Events',
            description: 'Browse upcoming events',
            url: '/events',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ],
        prefer_related_applications: false,
      },

      // injectManifest config: tell Workbox which glob patterns to include
      // in the precache manifest injected into sw-nexasphere.js
      injectManifest: {
        // Glob patterns for build assets to precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp,woff,woff2}'],
        // Increase limit to 3MB to accommodate larger app images
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Exclude extra-large raw source images that are served via runtime cache
        globIgnores: [
          '**/nexasphere-logo*',
          '**/logo-full*',
          '**/logo-icon*',
          '**/glbajaj-logo*',
          '**/ayush*',
          '**/tushar*',
          '**/default-project*',
        ],
      },

      // Enable in dev mode for testing
      devOptions: {
        enabled: false,
        type: 'module',
      },
    })
  ],
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
    },
  },
})
