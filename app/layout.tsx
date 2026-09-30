import type { Metadata, Viewport } from 'next';
import { Fraunces, Instrument_Sans } from 'next/font/google';
import './globals.css';
import '@mantine/core/styles.css';
import { MantineSetup } from '@/components/MantineSetup';
import { Navbar } from '@/components/Navbar';
import { FeedStreamProvider } from '@/components/FeedStreamProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Footer } from '@/components/Footer';
import { DevServiceWorkerCleanup } from '@/components/DevServiceWorkerCleanup';

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
    default: 'DeepUM – Anonimo',
    template: '%s | DeepUM',
  },
  description:
    'El foro anónimo de los estudiantes de la UM.',
  keywords: [
    'quemones',
    'quemones UM',
    'quemonesum',
  ],
  authors: [{ name: 'DeepUM', url: SITE_URL }],
  creator: 'DeepUM',
  publisher: 'DeepUM',
  applicationName: 'DeepUM',
  category: 'community',
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
  },
  appleWebApp: {
    capable: true,
    title: 'DeepUM',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
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
    siteName: 'DeepUM',
    title: 'DeepUM – Anonimo',
    description:
      'El foro anónimo de los estudiantes de la UM.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DeepUM – Anonimo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeepUM – Anonimo',
    description:
      'El foro anónimo.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
};


export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F9F9' },
    { media: '(prefers-color-scheme: dark)', color: '#06050f' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-mantine-color-scheme="auto" suppressHydrationWarning className={`${fraunces.variable} ${instrumentSans.variable}`}>
      <body suppressHydrationWarning className="font-sans bg-[#F9F9F9] dark:bg-[#06050f] text-stone-900 dark:text-[#e9e5ff] min-h-screen antialiased selection:bg-mauve-200 selection:text-mauve-900 dark:selection:bg-violet-600/30 dark:selection:text-violet-100 transition-colors duration-200">
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var s=localStorage.getItem('theme'),p=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';if((s||p)==='dark')document.documentElement.classList.add('dark');}catch(e){}})();" }} />
        <DevServiceWorkerCleanup />
        <div className="fixed inset-0 z-[-1] pointer-events-none hidden dark:block bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/50 via-[#06050f] to-[#06050f]"></div>
        <div className="fixed bottom-0 left-1/2 z-[-1] hidden h-[300px] w-[600px] -translate-x-1/2 bg-app-bottom-glow-dark pointer-events-none dark:block"></div>
        <MantineSetup>
          <ThemeProvider>
            <FeedStreamProvider>
              <Navbar />
              {children}
              <Footer />
            </FeedStreamProvider>
          </ThemeProvider>
        </MantineSetup>
      </body>
    </html>
  );
}
