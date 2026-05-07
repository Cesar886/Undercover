import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { FeedStreamProvider } from '@/components/FeedStreamProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QuemadosUM',
  description: 'La voz anónima de la universidad',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900 min-h-screen pt-12`}>
        <FeedStreamProvider>
          <Navbar />
          {children}
        </FeedStreamProvider>
      </body>
    </html>
  );
}
