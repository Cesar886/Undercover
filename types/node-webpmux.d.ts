declare module 'node-webpmux' {
  class Image {
    exif: Buffer | null;
    load(buf: Buffer): Promise<void>;
    save(path: string | null): Promise<Buffer>;
  }

  const TYPE_LOSSY: number;
  const TYPE_LOSSLESS: number;
  const TYPE_EXTENDED: number;

  export { Image, TYPE_LOSSY, TYPE_LOSSLESS, TYPE_EXTENDED };
}
