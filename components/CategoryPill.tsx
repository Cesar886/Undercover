import { PostCategory } from '@/types';

const config: Record<PostCategory, { label: string; className: string }> = {
  quemones:    { label: 'Quemones',    className: 'border border-orange-500/40 text-orange-500 bg-orange-500/10' },
  infieles:    { label: 'Infieles',    className: 'border border-pink-500/40 text-pink-500 bg-pink-500/10' },
  confesiones: { label: 'Confesiones', className: 'border border-purple-600/40 text-purple-600 bg-purple-600/10' },
};

export function CategoryPill({ category }: { category: PostCategory }) {
  const { label, className } = config[category];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}
