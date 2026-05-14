import type { Metadata } from 'next';
import Link from 'next/link';
import { Flag } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Reportes',
  description: 'Cómo reportar contenido inapropiado en QuemonesUM.',
};

export default function ReportesPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-6 inline-block"
      >
        ← Volver
      </Link>

      <h1 className="font-display text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-1">
        Reportes
      </h1>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-8">
        Cómo reportar contenido inapropiado
      </p>

      <div className="space-y-6 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">

        <p>
          Si encuentras una publicación o comentario que viole nuestros{' '}
          <Link href="/terminos" className="text-mauve-600 dark:text-mauve-400 hover:underline">
            Términos y Condiciones
          </Link>
          , puedes reportarlo directamente desde la plataforma.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-sm">
            Cómo reportar una publicación
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-zinc-500 dark:text-zinc-500">
            <li>Abre la publicación que deseas reportar.</li>
            <li>
              Presiona el ícono de bandera{' '}
              <Flag className="inline-block w-3.5 h-3.5 mb-0.5 text-zinc-400" />{' '}
              que aparece en la esquina de la publicación.
            </li>
            <li>Selecciona el motivo del reporte.</li>
            <li>El reporte se envía de forma anónima al equipo de moderación.</li>
          </ol>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-sm">
            ¿Qué se puede reportar?
          </h2>
          <ul className="list-disc list-inside space-y-1 text-zinc-500 dark:text-zinc-500">
            <li>Contenido ofensivo, acoso o bullying</li>
            <li>Información falsa o engañosa</li>
            <li>Spam o publicidad no solicitada</li>
            <li>Contenido que exponga información personal de terceros</li>
            <li>Cualquier contenido que viole la ley</li>
          </ul>
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Todos los reportes son revisados por el equipo de moderación. El abuso del sistema de reportes
          puede resultar en la suspensión de tu cuenta.
        </p>

      </div>
    </main>
  );
}
