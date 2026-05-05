import { PostCategory } from '@/types';

const config: Record<PostCategory, { label: string; className: string }> = {
  chisme:    { label: 'Chisme',    className: 'bg-pink-900/60 text-pink-300 border border-pink-800' },
  opinion:   { label: 'Opinión',   className: 'bg-blue-900/60 text-blue-300 border border-blue-800' },
  queja:     { label: 'Queja',     className: 'bg-red-900/60 text-red-300 border border-red-800' },
  confesion: { label: 'Confesión', className: 'bg-purple-900/60 text-purple-300 border border-purple-800' },
  pregunta:  { label: 'Pregunta',  className: 'bg-amber-900/60 text-amber-300 border border-amber-800' },
};

export function CategoryPill({ category }: { category: PostCategory }) {
  const { label, className } = config[category];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}
