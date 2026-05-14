import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad',
  description: 'Aviso de privacidad de QuemonesUM.',
};

export default function PrivacidadPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-6 inline-block"
      >
        ← Volver
      </Link>

      <h1 className="font-display text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-1">
        Aviso de Privacidad
      </h1>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-8">
        Última actualización: mayo 2025
      </p>

      <div className="space-y-6 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">Limitación de responsabilidad</h2>
          <p>
            QuemonesUM no se hace responsable del mal uso que los usuarios puedan dar a esta plataforma.
            El contenido publicado es responsabilidad exclusiva de quien lo genera. Cualquier uso indebido
            del sitio recae únicamente sobre el usuario que lo realice.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">Finalidad del tratamiento</h2>
          <p>Los datos se usan exclusivamente para:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500 dark:text-zinc-500">
            <li>Gestionar tu cuenta y sesión</li>
            <li>Moderar el contenido de la plataforma</li>
            <li>Prevenir el abuso y garantizar el cumplimiento de los términos de uso</li>
          </ul>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">Cookies y almacenamiento local</h2>
          <p>
            Utilizamos cookies de sesión estrictamente necesarias para mantener tu sesión activa.
            No utilizamos cookies de seguimiento ni publicidad.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">Derechos ARCO</h2>
          <p>
            Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus datos.
            Para ejercer estos derechos, puedes usar el ícono de reporte en cualquier publicación
            o eliminar tu cuenta desde tu perfil.
          </p>
        </section>

        <section>
          <h2 className="text-zinc-800 dark:text-zinc-200 font-semibold text-base mb-2">Cambios a este aviso</h2>
          <p>
            Cualquier modificación a este aviso de privacidad será publicada en esta misma página.
          </p>
        </section>

      </div>
    </main>
  );
}
