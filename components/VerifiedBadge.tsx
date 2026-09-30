import { BadgeCheck } from 'lucide-react';

export function VerifiedBadge() {
  return <span role="img" aria-label="Verificado" title="Verificado" className="inline-flex shrink-0 align-middle"><BadgeCheck size={18} fill="#1d9bf0" color="white" aria-hidden="true" /></span>;
}
