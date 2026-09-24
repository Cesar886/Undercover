import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/validation';
import sharp from 'sharp';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const result = await query(
    `SELECT image_webp FROM posts WHERE id = $1 AND category = 'stickers' AND is_hidden = false`,
    [params.id]
  );

  if (result.rows.length === 0 || !result.rows[0].image_webp) {
    return NextResponse.json({ error: 'Sticker no encontrado' }, { status: 404 });
  }

  const dataUrl: string = result.rows[0].image_webp;
  const base64 = dataUrl.replace(/^data:image\/webp;base64,/, '');
  const stickerBuf = Buffer.from(base64, 'base64');

  // Tray icon: 96×96 WebP requerido por WhatsApp para la vista previa del pack
  const trayBuf = await sharp(stickerBuf)
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80 })
    .toBuffer();

  const metadata = {
    identifier:              `quemadosum_${params.id}`,
    name:                    'Sticker UM',
    publisher:               'QuemadosUM',
    tray_image_file:         'tray.webp',
    publisher_email:         '',
    publisher_website:       '',
    privacy_policy_website:  '',
    license_agreement_website: '',
    image_data_version:      '1',
    avoid_cache:             false,
    animated_sticker_pack:   false,
    stickers: [
      { image_file: 'sticker.webp', emojis: ['🔥'] },
    ],
  };

  const zip = new JSZip();
  zip.file('sticker.webp', stickerBuf);
  zip.file('tray.webp', trayBuf);
  zip.file('metadata.json', JSON.stringify(metadata));

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return new NextResponse(zipBuf.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.whatsapp.sticker-pack',
      'Content-Disposition': `attachment; filename="sticker-um-${params.id}.wastickers"`,
      'Cache-Control':       'public, max-age=86400',
    },
  });
}
