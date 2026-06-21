import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

const sections = [
  {
    emoji: '🚫',
    title: 'Contenido',
    lines: [
      'Sin datos personales, fotos privadas ni nombres reales.',
      'Sin acoso, amenazas, odio ni contenido gráfico.',
      'Sin spam, publicidad ni información falsa.',
    ],
  },
  {
    emoji: '👁️',
    title: 'Confianza invisible',
    lines: [
      'Cada ID empieza con 1 punto (rango −5 a +5).',
      'Reportar bien sube; abusar o que te oculten baja.',
      'Más confianza = reportes más pesados.',
    ],
  },
  {
    emoji: '🚩',
    title: 'Reportes',
    lines: [
      'Sin revisión humana. El umbral oculta automático.',
      'Oculto = permanente. Máx. 10 reportes/hora.',
    ],
  },
  {
    emoji: '🔥',
    title: 'Quema total',
    lines: [
      'Cada lunes 5 AM todo se borra. Sin archivo, sin historial.',
    ],
  },
  {
    emoji: '⚡',
    title: 'Sanciones',
    lines: [
      '3 ocultos → 1 h · 5 ocultos → 24 h · 10 ocultos → 7 días.',
    ],
  },
];

export function RulesCard() {
  return (
    <aside className="lg:sticky lg:top-24">
      <section className="bg-white dark:bg-[#0d0b1a] border border-black/[0.04] dark:border-violet-500/10 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.03] dark:border-violet-500/10 flex items-center gap-2">
          <ShieldCheck size={15} strokeWidth={1.7} className="text-mauve-600 dark:text-violet-400 flex-shrink-0" />
          <h2 className="text-sm font-bold text-stone-800 dark:text-[#e9e5ff]">Reglas</h2>
        </div>

        <div className="px-4 py-3 space-y-3.5 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
          {sections.map((s) => (
            <div key={s.title}>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-stone-700 dark:text-violet-200">
                <span>{s.emoji}</span>
                {s.title}
              </p>
              <ul className="space-y-0.5">
                {s.lines.map((line) => (
                  <li key={line} className="text-[11.5px] leading-snug text-stone-400 dark:text-[#7a75a8]">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="pt-1.5 flex items-center gap-3 text-[11px]">
            <Link href="/terminos" className="text-stone-400 dark:text-[#6b6a8f] hover:text-mauve-700 dark:hover:text-violet-300 transition-colors">
              Términos
            </Link>
            <Link href="/reportes" className="text-stone-400 dark:text-[#6b6a8f] hover:text-red-500 dark:hover:text-red-400 transition-colors">
              Reportes
            </Link>
          </div>
        </div>
      </section>
    </aside>
  );
}
