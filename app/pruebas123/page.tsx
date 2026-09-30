import type { Metadata } from 'next';
import { Pruebas123Wall } from '@/components/Pruebas123Wall';

export const metadata: Metadata = {
  title: 'Pruebas 123',
  robots: { index: false, follow: false, noarchive: true },
};

export default function Pruebas123Page() {
  return <Pruebas123Wall />;
}
