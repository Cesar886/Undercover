'use client';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-300 dark:text-zinc-600 hover:text-gray-500 dark:hover:text-zinc-400 transition-colors text-lg leading-none"
        >
          ✕
        </button>

        <div className="text-center space-y-1 pt-1">
          <p className="text-3xl mb-2">🔥</p>
          <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100">
            Para publicar necesitas una cuenta
          </h2>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => router.push('/registro')}
            className="w-full border border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 text-gray-700 dark:text-zinc-300 py-2.5 rounded-xl text-sm font-medium transition-colors dark:hover:bg-zinc-800"
          >
            Crear cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
