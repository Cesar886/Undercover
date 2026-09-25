'use client';
import { ownerTokenHeaders } from '@/lib/ownerToken';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Lock,
  Server,
  ShieldCheck,
  User,
} from 'lucide-react';

const ADMIN = '/imagenes-dnewjlfe99474ef8wu-admin';

export function ImageAdminLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/image-admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ownerTokenHeaders() },
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password'),
        }),
      });

      if (res.ok) {
        window.location.replace(ADMIN);
        return;
      }

      const response = await res.json().catch(() => null) as { error?: string } | null;
      setError(response?.error ?? 'No se pudo iniciar sesión.');
    } catch {
      setError('No se pudo conectar. Intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate overflow-hidden px-4 py-10 sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.16),transparent_62%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.22),transparent_62%)]" />

      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_28px_90px_rgba(60,42,86,0.12)] dark:border-violet-400/15 dark:bg-[#0b0916] dark:shadow-[0_28px_100px_rgba(0,0,0,0.5)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden min-h-[590px] overflow-hidden bg-[#171124] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:38px_38px]" />

          <div className="relative">
            <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold tracking-wide text-violet-200 backdrop-blur">
              <ShieldCheck size={14} />
              ÁREA RESTRINGIDA
            </div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-violet-700 shadow-[0_12px_35px_rgba(124,58,237,0.38)]">
              <ImageIcon size={27} strokeWidth={1.7} />
            </div>
            <h1 className="max-w-sm font-display text-4xl font-semibold leading-[1.08] tracking-tight">
              Control visual de DeepUM
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-violet-100/65">
              Revisa el contenido visual antes de que llegue a la comunidad. Cada decisión se aplica de inmediato.
            </p>
          </div>

          <div className="relative space-y-4">
            <div className="flex items-center gap-3 text-sm text-violet-100/75">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"><Lock size={15} /></span>
              Credenciales verificadas en el servidor
            </div>
            <div className="flex items-center gap-3 text-sm text-violet-100/75">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"><Clock size={15} /></span>
              Sesión privada con duración de 8 horas
            </div>
            <div className="flex items-center gap-3 text-sm text-violet-100/75">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]"><Server size={15} /></span>
              Las imágenes pendientes no son públicas
            </div>
          </div>
        </div>

        <div className="flex min-h-[590px] flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 transition-colors hover:text-mauve-700 dark:text-[#5f5b80] dark:hover:text-violet-300"
              >
                <ArrowLeft size={14} />
                Volver a DeepUM
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Seguro
              </span>
            </div>

            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-mauve-100 text-mauve-700 dark:bg-violet-500/10 dark:text-violet-300 lg:hidden">
                <ImageIcon size={23} />
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-mauve-600 dark:text-violet-400">Moderación visual</p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-stone-900 dark:text-[#f0edff]">Entrar al panel</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-[#777294]">
                Usa las credenciales administrativas para continuar.
              </p>
            </div>

            <form onSubmit={login} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-stone-700 dark:text-[#bbb5d7]">Usuario</span>
                <span className="group relative block">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-violet-500 dark:text-[#575373]" size={18} />
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    autoFocus
                    placeholder="Tu usuario administrativo"
                    className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-11 pr-4 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-300 hover:border-stone-300 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-violet-400/15 dark:bg-white/[0.035] dark:text-[#f0edff] dark:placeholder:text-[#45415f] dark:hover:border-violet-400/25 dark:focus:border-violet-500 dark:focus:bg-white/[0.05]"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-stone-700 dark:text-[#bbb5d7]">Contraseña</span>
                <span className="group relative block">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-violet-500 dark:text-[#575373]" size={18} />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Tu contraseña"
                    aria-describedby={error ? 'image-admin-error' : undefined}
                    className="h-12 w-full rounded-xl border border-stone-200 bg-stone-50/70 pl-11 pr-12 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-300 hover:border-stone-300 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 dark:border-violet-400/15 dark:bg-white/[0.035] dark:text-[#f0edff] dark:placeholder:text-[#45415f] dark:hover:border-violet-400/25 dark:focus:border-violet-500 dark:focus:bg-white/[0.05]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-[#575373] dark:hover:bg-violet-400/10 dark:hover:text-violet-300"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {error && (
                <div id="image-admin-error" role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 dark:border-red-400/15 dark:bg-red-400/[0.08] dark:text-red-300">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mauve-700 to-violet-700 text-sm font-bold text-white shadow-[0_10px_28px_rgba(92,72,117,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(92,72,117,0.32)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:from-violet-700 dark:to-violet-600 dark:shadow-[0_10px_30px_rgba(124,58,237,0.22)]"
              >
                {busy ? <><Loader2 size={17} className="animate-spin" /> Verificando…</> : <><ShieldCheck size={17} /> Entrar al panel</>}
              </button>
            </form>

            <p className="mt-7 text-center text-[11px] leading-5 text-stone-400 dark:text-[#4d4968]">
              Acceso exclusivo para moderación. Los intentos están limitados por seguridad.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
