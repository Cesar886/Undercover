import { redirect } from 'next/navigation';
import { hasImageAdminSession, IMAGE_ADMIN_PATH } from '@/lib/imageAdmin';
import { AdminDashboard } from '@/components/AdminDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel administrativo', robots: { index: false, follow: false } };
export default async function ImageAdminPage() {
  if (!await hasImageAdminSession()) redirect(IMAGE_ADMIN_PATH + '/login');
  return <AdminDashboard />;
}
