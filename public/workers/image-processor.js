// Web Worker: procesa imágenes con OffscreenCanvas sin bloquear el hilo principal.
// Recibe un ImageBitmap transferible, redimensiona y exporta WebP.
self.onmessage = async (e) => {
  const { bitmap, width, height, quality } = e.data;
  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
    const buf = await blob.arrayBuffer();
    self.postMessage({ ok: true, buf }, [buf]);
  } catch (err) {
    self.postMessage({ ok: false, error: err?.message ?? 'Error en worker' });
  }
};
