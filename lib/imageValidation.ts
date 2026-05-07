import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageValidation =
  | { ok: true; webpDataUrl: string }
  | { ok: false; error: string };

function decodeBase64Image(input: string): Buffer | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const dataUrlMatch = trimmed.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  const base64 = dataUrlMatch ? dataUrlMatch[1] : trimmed;

  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d) return true;
  // RIFF (WebP): "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  // ISO BMFF (AVIF/HEIC): bytes 4-7 = "ftyp"
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;
  return false;
}

export async function validateAndConvertImage(input: unknown): Promise<ImageValidation> {
  if (typeof input !== 'string') return { ok: false, error: 'Imagen inválida' };

  const buf = decodeBase64Image(input);
  if (!buf || buf.length === 0) return { ok: false, error: 'Imagen inválida' };

  if (buf.length > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Imagen excede 2MB' };
  }

  if (!looksLikeImage(buf)) {
    return { ok: false, error: 'Formato de imagen no soportado' };
  }

  try {
    const webp = await sharp(buf, { failOn: 'error' }).webp({ quality: 80 }).toBuffer();
    return { ok: true, webpDataUrl: `data:image/webp;base64,${webp.toString('base64')}` };
  } catch {
    return { ok: false, error: 'No se pudo procesar la imagen' };
  }
}
