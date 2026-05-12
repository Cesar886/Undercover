import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans } from 'next/font/google';
import './globals.css';
import '@mantine/core/styles.css';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import { Suspense } from 'react';
import { MantineSetup } from '@/components/MantineSetup';
import { Navbar } from '@/components/Navbar';
import { WelcomeModal } from '@/components/WelcomeModal';
import { FeedStreamProvider } from '@/components/FeedStreamProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT', 'opsz'],
  display: 'optional',
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'optional',
});

const SITE_URL = 'https://quemonesum.site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'QuemonesUM – Confesiones Anónimas de la Universidad de Montemorelos',
    template: '%s | QuemonesUM',
  },
  description:
    'El foro anónimo de los estudiantes de la UM. Lee y comparte quemones, confesiones e infieles de la Universidad de Montemorelos, Nuevo León, México.',
  keywords: [
    'quemones',
    'quemones UM',
    'quemones universidad de montemorelos',
    'quemones montemorelos',
    'confesiones universidad montemorelos',
    'chismes UM Nuevo León',
    'foro estudiantes montemorelos',
    'Universidad de Montemorelos',
    'quemonesum',
    'anécdotas universitarias montemorelos',
  ],
  authors: [{ name: 'QuemonesUM', url: SITE_URL }],
  creator: 'QuemonesUM',
  publisher: 'QuemonesUM',
  category: 'community',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: SITE_URL,
    siteName: 'QuemonesUM',
    title: 'QuemonesUM – Confesiones Anónimas de la Universidad de Montemorelos',
    description:
      'El foro anónimo de los estudiantes de la UM. Lee y comparte quemones, confesiones e infieles de la Universidad de Montemorelos.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QuemonesUM – Foro anónimo de la Universidad de Montemorelos',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuemonesUM – Confesiones Anónimas de la UM',
    description:
      'El foro anónimo de los estudiantes de la Universidad de Montemorelos, Nuevo León.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" {...mantineHtmlProps} className={`${fraunces.variable} ${instrumentSans.variable}`}>
      <head />
      <body className="font-sans bg-[#F9F9F9] dark:bg-[#030303] text-stone-900 dark:text-zinc-100 min-h-screen pt-12 antialiased selection:bg-orange-200 selection:text-orange-900 dark:selection:bg-orange-500/30 dark:selection:text-orange-100 transition-colors duration-200">
        <div className="fixed inset-0 z-[-1] pointer-events-none hidden dark:block bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900/40 via-[#030303] to-[#030303]"></div>
        <ColorSchemeScript />
        <MantineSetup>
          <ThemeProvider>
            <FeedStreamProvider>
              <Navbar />
              <Suspense fallback={null}>
                <WelcomeModal />
              </Suspense>
              {children}
            </FeedStreamProvider>
          </ThemeProvider>
        </MantineSetup>
      </body>
    </html>
  );
}
