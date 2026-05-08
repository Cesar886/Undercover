import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans } from 'next/font/google';
import './globals.css';
import '@mantine/core/styles.css';
import { ColorSchemeScript, MantineProvider, createTheme, mantineHtmlProps } from '@mantine/core';
import { Navbar } from '@/components/Navbar';
import { FeedStreamProvider } from '@/components/FeedStreamProvider';
import { ThemeProvider } from '@/components/ThemeProvider';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['SOFT', 'opsz'],
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const theme = createTheme({});

export const metadata: Metadata = {
  title: 'QuemonesUM',
  description: 'La voz anónima de la universidad',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" {...mantineHtmlProps} className={`${fraunces.variable} ${instrumentSans.variable}`}>
      <head />
      <body className="font-sans bg-stone-50 dark:bg-slate-950 text-stone-900 dark:text-slate-100 min-h-screen pt-12 antialiased transition-colors duration-200">
        <ColorSchemeScript />
        <MantineProvider theme={theme}>
          <ThemeProvider>
            <FeedStreamProvider>
              <Navbar />
              {children}
            </FeedStreamProvider>
          </ThemeProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
