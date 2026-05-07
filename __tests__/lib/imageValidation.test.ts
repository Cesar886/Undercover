import { validateAndConvertImage } from '@/lib/imageValidation';

// 1x1 transparent PNG
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

describe('validateAndConvertImage', () => {
  it('rejects non-string input', async () => {
    const r = await validateAndConvertImage(123 as unknown);
    expect(r.ok).toBe(false);
  });

  it('rejects empty string', async () => {
    const r = await validateAndConvertImage('');
    expect(r.ok).toBe(false);
  });

  it('rejects garbage that is not an image', async () => {
    // 'not an image' base64
    const r = await validateAndConvertImage(Buffer.from('not an image, just text').toString('base64'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/imagen|formato/i);
  });

  it('rejects images larger than 2MB', async () => {
    // 3MB of zeros, base64 encoded — magic bytes will fail too but size check fires first
    const huge = Buffer.alloc(3 * 1024 * 1024).toString('base64');
    const r = await validateAndConvertImage(huge);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2MB/);
  });

  it('accepts a valid PNG and converts to webp', async () => {
    const r = await validateAndConvertImage(PNG_B64);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.webpDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('accepts a data URL prefixed PNG', async () => {
    const r = await validateAndConvertImage(`data:image/png;base64,${PNG_B64}`);
    expect(r.ok).toBe(true);
  });
});
