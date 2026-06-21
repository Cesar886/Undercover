import Link from 'next/link';

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden">

      {/* Atmospheric glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(114,91,144,0.07) 0%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 pointer-events-none dark:block hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124,58,237,0.14) 0%, transparent 70%)',
        }}
      />

      {/* Top gradient line */}
      <div
        className="h-px w-full dark:hidden"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(170,151,194,0.25) 30%, rgba(114,91,144,0.45) 50%, rgba(170,151,194,0.25) 70%, transparent 100%)',
        }}
      />
      <div
        className="h-px w-full hidden dark:block"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.2) 30%, rgba(167,139,250,0.5) 50%, rgba(139,92,246,0.2) 70%, transparent 100%)',
        }}
      />

      <div className="relative max-w-[600px] mx-auto px-4 pt-14 pb-10">

        {/* Wordmark */}
        <div className="text-center mb-3">
          <p
            className="font-display font-bold tracking-tight select-none"
            style={{ fontSize: 'clamp(28px, 5vw, 38px)', lineHeight: 1 }}
          >
            <span
              className="footer-wordmark"
              style={{
                backgroundImage: 'linear-gradient(135deg, #aa97c2 0%, #725b90 45%, #43325a 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Deep
            </span>
            <span className="text-zinc-800 dark:text-[#e9e5ff]">UM</span>
          </p>
        </div>

        {/* Tagline */}
        <p
          className="text-center font-sans text-zinc-400 dark:text-[#3a3860] mb-10"
          style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 500 }}
        >
          El foro underground de la Universidad de Montemorelos
        </p>

        {/* Decorative node row */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.15))' }} />
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-mauve-300 dark:bg-violet-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-mauve-400 dark:bg-violet-700" />
            <div className="w-1 h-1 rounded-full bg-mauve-300 dark:bg-violet-900" />
          </div>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, transparent, rgba(139,92,246,0.15))' }} />
        </div>

        {/* Nav links */}
        <nav className="flex items-center justify-center gap-8 mb-10">
          {[
            { href: '/terminos',  label: 'Términos y condiciones' },
            { href: '/privacidad', label: 'Aviso de privacidad' },
            { href: '/reportes',  label: 'Reportes' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="group relative font-sans text-zinc-400 dark:text-[#4a4870] transition-colors duration-200 hover:text-mauve-600 dark:hover:text-violet-400"
              style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em' }}
            >
              {label}
              <span
                className="absolute -bottom-0.5 left-0 w-0 group-hover:w-full transition-all duration-300"
                style={{ height: '1px', background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}
              />
            </Link>
          ))}
        </nav>

        {/* Bottom copyright */}
        <p
          className="text-center text-zinc-300 dark:text-[#2e2b4a]"
          style={{ fontSize: '10px', letterSpacing: '0.06em' }}
        >
          © {YEAR} DeepUM — Todos los derechos reservados
        </p>

      </div>
    </footer>
  );
}
