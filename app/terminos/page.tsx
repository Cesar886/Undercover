import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y condiciones de uso de QuemonesUM.',
};

export default function TerminosPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-6 inline-block"
      >
        ← Volver
      </Link>

      <h1 className="font-display text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-1">
        Términos y Condiciones
      </h1>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-8">
        Última actualización: mayo 2025
      </p>

      <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none space-y-6 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">1. Uso de la plataforma</h2>
          <p>
            QuemonesUM es una plataforma de publicación anónima dirigida a estudiantes de la Universidad de Montemorelos.
            Al usar este sitio, aceptas publicar contenido de forma responsable y respetuosa. No se permite publicar
            contenido que sea ilegal, difamatorio, obsceno, amenazante o que viole los derechos de terceros.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">2. Anonimato y responsabilidad</h2>
          <p>
            Aunque las publicaciones son anónimas para otros usuarios, QuemonesUM puede conservar información técnica
            (como identificadores de sesión) con fines de moderación. El anonimato no exime al usuario de la
            responsabilidad legal por el contenido que publique.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">3. Moderación y eliminación de contenido</h2>
          <p>
            QuemonesUM se reserva el derecho de eliminar cualquier publicación o comentario que viole estos términos,
            sin previo aviso. Los usuarios pueden reportar contenido inapropiado usando el ícono de bandera disponible
            en cada publicación.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">4. Propiedad intelectual</h2>
          <p>
            El contenido publicado por los usuarios es responsabilidad exclusiva de quien lo publica. Al publicar,
            otorgas a QuemonesUM una licencia no exclusiva para mostrar dicho contenido en la plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">5. Modificaciones</h2>
          <p>
            QuemonesUM puede actualizar estos términos en cualquier momento. El uso continuo de la plataforma
            implica la aceptación de los términos vigentes.
          </p>
        </section>

      </div>
    </main>
  );
}
