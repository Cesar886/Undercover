import { redirect } from 'next/navigation';
import { hasImageAdminSession, IMAGE_ADMIN_PATH } from '@/lib/imageAdmin';
import { ImageReviewQueue } from '@/components/ImageReviewQueue';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revisión de imágenes', robots: { index: false, follow: false } };
export default async function ImageAdminPage() {
  if (!await hasImageAdminSession()) redirect(IMAGE_ADMIN_PATH + '/login');
  return <ImageReviewQueue />;
}
