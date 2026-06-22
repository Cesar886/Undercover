import sharp from 'sharp';
import webpmux from 'node-webpmux';

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

// Técnica 1 + 5: Endurece el canal alfa y limpia los píxeles transparentes.
// Píxeles con alfa < 30 → totalmente transparentes (RGB también a 0 para mejor compresión).
// Píxeles con alfa > 220 → totalmente opacos.
// La banda 30-220 se conserva como anillo de antialiasing (1-2 px).
async function hardenAlphaEdges(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = new Uint8Array(data.buffer);
  const s = info.channels; // 4 (RGBA)

  for (let i = 0; i < px.length; i += s) {
    const a = px[i + 3];
    if (a < 30) {
      // Zona exterior: opacidad cero + RGB negro → comprime como bitmap de 1 bit
      px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
    } else if (a > 220) {
      // Interior sólido: opacidad total
      px[i + 3] = 255;
    }
    // 30–220: anillo de antialiasing, se deja intacto
  }

  return sharp(Buffer.from(px.buffer), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  }).png().toBuffer();
}

export async function validateAndConvertImage(input: unknown, category?: string): Promise<ImageValidation> {
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
    let processBuf = buf;
    if (category === 'stickers') {
      try {
        // Técnica 6: Preprocesar antes de quitar fondo.
        // Reducción de ruido leve + normalización de contraste + pre-redimensionado a 512px.
        // Así el removedor recibe una imagen más limpia y procesa menos datos.
        const preprocessed = await sharp(buf)
          .resize({ width: 512, height: 512, fit: 'inside' })
          .median(3)       // reduce ruido de sensor sin borrar bordes
          .normalise()     // contraste automático → silueta más definida
          .png()
          .toBuffer();

        const { removeBackground } = await import('@imgly/background-removal-node');
        const blob = new Blob([new Uint8Array(preprocessed)], { type: 'image/png' });
        const bgRemovedBlob = await removeBackground(blob);
        const arrayBuffer = await bgRemovedBlob.arrayBuffer();
        processBuf = Buffer.from(arrayBuffer);
      } catch (err) {
        console.error('Error removing background:', err);
      }
    }

    let webpBuf: Buffer;

    if (category === 'stickers') {
      // Técnica 1 + 5: Endurecer alfa y limpiar píxeles transparentes
      const hardened = await hardenAlphaEdges(processBuf);

      // Técnica 2: Cuantización de color con imagequant (median-cut + Floyd-Steinberg).
      // 256 colores RGBA bien elegidos → menos entropía → WebP comprime mejor.
      // dither: 0.6 distribuye el error de cuantización en gradientes sin generar ruido
      // de alta frecuencia que perjudique al codificador lossy.
      // Técnica 4: Enfoque sutil antes de exportar (realza bordes sin añadir bytes).
      const quantizedPng = await sharp(hardened, { failOn: 'error' })
        .resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .sharpen({ sigma: 0.8, m1: 0.4, m2: 0.4 })
        .png({ palette: true, colours: 256, dither: 0.6 })
        .toBuffer();

      // Técnica 3: Compresión asimétrica — alfa al 20 % (canal casi binario tras hardenAlphaEdges),
      //            color al 78 % (sube de 60 aprovechando el ahorro del alfa).
      //            effort: 6 → máximo esfuerzo del codificador WebP.
      const resizedWebp = await sharp(quantizedPng)
        .webp({ quality: 78, alphaQuality: 20, effort: 6 })
        .toBuffer();

      // Añadir EXIF metadata para WASticker
      const json = {
        "sticker-pack-id": "quemadosum",
        "sticker-pack-name": "DeepUM",
        "sticker-pack-publisher": "UM",
        "emojis": ["🔥"]
      };
      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00
      ]);
      const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
      const exif = Buffer.concat([exifAttr, jsonBuffer]);
      exif.writeUInt32LE(jsonBuffer.length, 14);

      const img = new webpmux.Image();
      await img.load(resizedWebp);
      img.exif = exif;
      webpBuf = await img.save(null);
    } else {
      webpBuf = await sharp(processBuf, { failOn: 'error' }).webp({ quality: 80 }).toBuffer();
    }

    return { ok: true, webpDataUrl: `data:image/webp;base64,${webpBuf.toString('base64')}` };
  } catch {
    return { ok: false, error: 'No se pudo procesar la imagen' };
  }
}
