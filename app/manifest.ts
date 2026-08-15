import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AcoustiField',
    short_name: 'AcoustiField',
    description: 'Fiches de pose d’enregistreurs acoustiques pour le suivi des chauves-souris',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f0eb',
    theme_color: '#c2762a',
    icons: [
      { src: '/icon-192.png?v=3', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png?v=3', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
