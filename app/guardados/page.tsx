import Link from 'next/link';
import { Bookmark } from 'lucide-react';

export default function GuardadosPage() {
  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bookmark size={16} className="text-orange-500" fill="currentColor" />
        <h1 className="text-gray-900 font-semibold text-sm">Guardados</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl py-14 text-center shadow-sm">
        <p className="text-gray-400 text-sm">Función no disponible por ahora.</p>
        <Link href="/" className="text-orange-500 text-sm hover:underline mt-2 inline-block">
          Volver al feed
        </Link>
      </div>
    </main>
  );
}
