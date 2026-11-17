import type { Metadata } from 'next';
import { Fraunces, Spectral, Work_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers/providers';
import '@/styles/globals.css';

const display = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '600'],
  variable: '--font-display',
  fallback: ['Georgia', 'serif'],
});

const body = Spectral({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  fallback: ['Georgia', 'serif'],
});

const ui = Work_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-ui',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Bouléplan',
  description: 'Gerenciador pessoal de iniciativas e tarefas.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${ui.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
