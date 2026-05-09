'use client';

export default function RegistroPage() {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">

          <div className="px-8 pt-8 pb-6 text-center">
            <p className="text-3xl mb-3">🔥</p>
            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Entrar a QuemonesUM</h1>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              Tu correo verifica. Tu alias publica.
            </p>
          </div>

          <div className="px-8 pb-8 flex flex-col gap-4">
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-3 w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 dark:text-slate-200 transition-colors shadow-sm"
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
              <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">Solo acepta correos institucionales</p>
              <p className="font-mono text-xs text-orange-600 dark:text-orange-500 mt-0.5">1234567@alumno.um.edu.mx</p>
            </div>

            <p className="text-xs text-center text-gray-400 dark:text-slate-600">
              Solo usamos tu correo para confirmar que eres alumno. Publicas con un alias anónimo.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
