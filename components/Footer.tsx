import Link from 'next/link';

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-footer-glow-light dark:hidden" />
      <div className="absolute inset-0 pointer-events-none hidden bg-footer-glow-dark dark:block" />

      <div className="h-px w-full bg-footer-line-light dark:hidden" />
      <div className="hidden h-px w-full bg-footer-line-dark dark:block" />

      <div className="relative max-w-[600px] mx-auto px-4 pt-14 pb-10">
        <div className="mb-3 text-center">
          <p className="font-display select-none text-[clamp(28px,5vw,38px)] font-bold leading-none tracking-tight">
            <span className="footer-wordmark bg-footer-wordmark bg-clip-text text-transparent [-webkit-text-fill-color:transparent]">
              Deep
            </span>
            <span className="text-zinc-800 dark:text-[#e9e5ff]">UM</span>
          </p>
        </div>

        <p className="mb-10 text-center font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-[#3a3860]">
          El foro underground de la U
        </p>

        <div className="mb-10 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-footer-divider-left" />
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-mauve-300 dark:bg-violet-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-mauve-400 dark:bg-violet-700" />
            <div className="w-1 h-1 rounded-full bg-mauve-300 dark:bg-violet-900" />
          </div>
          <div className="h-px flex-1 bg-footer-divider-right" />
        </div>

        <nav className="mb-10 flex items-center justify-center gap-8">
          {[
            { href: '/terminos', label: 'Términos y condiciones' },
            { href: '/privacidad', label: 'Aviso de privacidad' },
            { href: '/reportes', label: 'Reportes' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="group relative font-sans text-[11px] font-medium tracking-[0.02em] text-zinc-400 transition-colors duration-200 hover:text-mauve-600 dark:text-[#4a4870] dark:hover:text-violet-400"
            >
              {label}
              <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-footer-link-underline transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <p className="text-center text-[10px] tracking-[0.06em] text-zinc-300 dark:text-[#2e2b4a]">
          © {YEAR} DeepUM — Todos los derechos reservados
        </p>
      </div>
    </footer>
  );
}
