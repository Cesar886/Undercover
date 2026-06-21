'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const isRegistered = searchParams?.get('registered') === 'true';
    
    if (isRegistered) {
      setIsOpen(true);
    }
  }, [searchParams]);

  const handleClose = () => {
    localStorage.setItem('hasSeenWelcomeModal', 'true');
    setIsOpen(false);
    
    // Remove the ?registered=true from URL without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('registered');
    router.replace(newUrl.pathname + newUrl.search);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-white dark:bg-[#0d0b1a] dark:border dark:border-violet-500/20 dark:shadow-[0_8px_40px_rgba(124,58,237,0.2)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 dark:text-[#4a4870] hover:text-gray-600 dark:hover:text-violet-300 transition-colors text-lg leading-none"
        >
          ✕
        </button>

        <div className="text-center space-y-4 pt-2">
          <p className="text-4xl">🔥</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#e9e5ff] font-display">
            Bienvenido a DeepUM
          </h2>
          <div className="text-sm text-gray-600 dark:text-[#6b6a8f] space-y-3 text-justify">
            <p>
              En nuestra web, creemos que todos necesitamos un lugar donde expresarnos libremente. Esta plataforma está diseñada exclusivamente para los alumnos de la UM, donde puedes compartir tus pensamientos, experiencias o secretos bajo total anonimato.
            </p>
            <p>
              Explora, comenta y descubre lo que realmente pasa en nuestra universidad.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleClose}
            className="w-full bg-mauve-600 hover:bg-mauve-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Empezar      
          </button>
        </div>
      </div>
    </div>
  );
}
