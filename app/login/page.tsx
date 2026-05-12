'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: 'Cancelaste el inicio de sesión con Google.',
  google_failed: 'Hubo un error con Google. Intenta de nuevo.',
  email_not_allowed:
    'Solo se aceptan correos institucionales (@alumno.um.edu.mx). Tu cuenta de Google no es válida para esta plataforma.',
};

function LoginForm() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get('error') ?? '';
  const errorMsg = ERROR_MESSAGES[errorKey] ?? '';

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">

          <div className="px-8 pt-8 pb-6 text-center">
            <p className="text-3xl mb-3">🔥</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-zinc-100">QuemonesUM</h1>
          </div>

          <div className="px-8 pb-2">
            <ul className="flex flex-col gap-2 text-xs text-gray-500 dark:text-zinc-400 text-center">
              <li>Solo aceptamos estudiantes de la universidad.</li>
              <li>Publicas con un alias anónimo, nadie sabe quién eres.</li>
            </ul>
          </div>

          <div className="px-8 pt-5 pb-8 flex flex-col gap-4">
            {errorMsg && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-center">
                {errorMsg}
              </div>
            )}

            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-3 w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-zinc-200 transition-colors shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              Verificar que soy estudiante
            </a>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                Solo acepta correos institucionales
              </p>
              <p className="font-mono text-xs text-orange-600 dark:text-orange-500 mt-0.5">
                1234567@alumno.um.edu.mx
              </p>
            </div>

            <div className="text-center text-sm text-gray-600 dark:text-zinc-400 mt-2">
              ¿No tienes cuenta?{' '}
              <Link href="/registro" className="text-orange-600 hover:text-orange-500 font-medium dark:text-orange-500 dark:hover:text-orange-400">
                Regístrate aquí
              </Link>
            </div>

            <div className="border-t border-gray-100 dark:border-zinc-800 pt-4 mt-2">
              <p className="text-xs text-center text-gray-400 dark:text-zinc-600 leading-relaxed">
                Un lugar para expresarte libremente como alumno de la UM. Comparte pensamientos, experiencias o secretos bajo total anonimato. Explora y descubre lo que realmente pasa en la universidad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
