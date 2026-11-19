import type { MetadataRoute } from 'next';

// The spec allows a space-separated list; Next's type only lists single values.
const PURPOSE = 'any maskable' as 'maskable';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bouléplan',
    short_name: 'Bouléplan',
    description: 'Gerenciador pessoal de iniciativas e tarefas.',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    // A manifest takes literal colors: these are papel.
    background_color: '#F3ECDF',
    theme_color: '#F3ECDF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: PURPOSE },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: PURPOSE },
    ],
  };
}
