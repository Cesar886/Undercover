import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans } from 'next/font/google';
import './globals.css';
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

export const metadata: Metadata = {
  title: 'QuemonesUM',
  description: 'La voz anónima de la universidad',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${instrumentSans.variable}`}>
      <body className="font-sans bg-stone-50 dark:bg-slate-950 text-stone-900 dark:text-slate-100 min-h-screen pt-12 antialiased transition-colors duration-200">
        <ThemeProvider>
          <FeedStreamProvider>
            <Navbar />
            {children}
          </FeedStreamProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
