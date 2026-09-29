'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, ExternalLink, Flag, Image as ImageIcon, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { AdminViewsPanel } from '@/components/AdminViewsPanel';
import { AdminReportsPanel } from '@/components/AdminReportsPanel';
import { ImageReviewQueue } from '@/components/ImageReviewQueue';

const ADMIN = '/imagenes-dnewjlfe99474ef8wu-admin';
type Section = 'images' | 'reports' | 'views';
const sections = [
  { id: 'images' as const, label: 'Imágenes', description: 'Moderación visual', icon: ImageIcon },
  { id: 'reports' as const, label: 'Reportes', description: 'Contenido señalado', icon: Flag },
  { id: 'views' as const, label: 'Analíticas', description: 'Visitas y alcance', icon: BarChart3 },
];

export function AdminDashboard() {
  const [section, setSection] = useState<Section>('images');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  async function logout() {
    setLogoutBusy(true);
    try {
      const response = await fetch('/api/image-admin/session', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      window.location.replace(ADMIN + '/login');
    } catch { setLogoutBusy(false); }
  }

  const active = sections.find((item) => item.id === section)!;
  return <main className="relative isolate min-h-[calc(100vh-5rem)] overflow-hidden px-3 py-5 sm:px-5 sm:py-8 lg:px-8">
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_35%_0%,rgba(139,92,246,0.13),transparent_60%)] dark:bg-[radial-gradient(circle_at_35%_0%,rgba(124,58,237,0.18),transparent_60%)]" />
    <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/90 shadow-[0_24px_80px_rgba(60,42,86,0.10)] backdrop-blur dark:border-violet-400/15 dark:bg-[#090712]/95 dark:shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
      <header className="flex h-16 items-center justify-between border-b border-stone-200/70 px-4 dark:border-violet-400/10 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen((value) => !value)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-600 dark:border-violet-400/15 dark:text-violet-200 lg:hidden" aria-label="Abrir navegación">{mobileOpen ? <X size={18} /> : <Menu size={18} />}</button>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mauve-600 to-violet-700 text-white shadow-lg shadow-violet-700/15"><ShieldCheck size={18} /></span>
          <div><p className="text-sm font-bold tracking-tight text-stone-900 dark:text-[#f0edff]">DeepUM Admin</p><p className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 sm:block">Centro de moderación</p></div>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/" target="_blank" className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-violet-700 dark:text-[#8e88aa] dark:hover:bg-white/5 dark:hover:text-violet-300"><ExternalLink size={14} /><span className="hidden sm:inline">Ver sitio</span></Link>
          <button onClick={logout} disabled={logoutBusy} className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-stone-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-[#8e88aa] dark:hover:bg-red-400/10 dark:hover:text-red-300"><LogOut size={14} /><span className="hidden sm:inline">Cerrar sesión</span></button>
        </div>
      </header>
      <div className="relative grid min-h-[720px] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className={`${mobileOpen ? 'flex' : 'hidden'} absolute inset-x-0 top-0 z-30 flex-col border-b border-stone-200 bg-white p-3 shadow-xl dark:border-violet-400/10 dark:bg-[#0b0916] lg:static lg:flex lg:border-b-0 lg:border-r lg:shadow-none`}>
          <div className="mb-3 hidden items-center gap-2 px-3 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 lg:flex"><LayoutDashboard size={13} />Panel</div>
          <nav className="space-y-1" aria-label="Secciones administrativas">{sections.map((item) => { const Icon = item.icon; const selected = section === item.id; return <button key={item.id} onClick={() => { setSection(item.id); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${selected ? 'bg-violet-50 text-violet-800 shadow-sm ring-1 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/10' : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-[#817b9d] dark:hover:bg-white/[0.035] dark:hover:text-[#e9e5ff]'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-violet-600 text-white' : 'bg-stone-100 dark:bg-white/5'}`}><Icon size={17} /></span><span><span className="block text-xs font-bold">{item.label}</span><span className="mt-0.5 block text-[10px] opacity-65">{item.description}</span></span></button>; })}</nav>
          <div className="mt-auto hidden rounded-2xl border border-violet-100 bg-violet-50/60 p-4 dark:border-violet-400/10 dark:bg-violet-400/[0.04] lg:block"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Sesión protegida</p><p className="mt-1.5 text-[11px] leading-5 text-stone-500 dark:text-[#777294]">Las acciones se aplican inmediatamente al contenido público.</p></div>
        </aside>
        <section className="min-w-0 bg-stone-50/55 px-4 py-6 dark:bg-white/[0.012] sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Panel administrativo</p><h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-[#f0edff] sm:text-3xl">{active.label}</h1><p className="mt-1 text-sm text-stone-500 dark:text-[#777294]">{active.description} de la comunidad en un solo lugar.</p></div>
          {section === 'images' && <ImageReviewQueue embedded />}
          {section === 'reports' && <AdminReportsPanel />}
          {section === 'views' && <AdminViewsPanel />}
        </section>
      </div>
    </div>
  </main>;
}
