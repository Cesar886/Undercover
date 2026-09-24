import { redirect } from 'next/navigation';
import { hasImageAdminSession, IMAGE_ADMIN_PATH } from '@/lib/imageAdmin';
import { ImageAdminLogin } from '@/components/ImageAdminLogin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acceso a revisión de imágenes', robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (await hasImageAdminSession()) redirect(IMAGE_ADMIN_PATH);
  return <ImageAdminLogin />;
}
