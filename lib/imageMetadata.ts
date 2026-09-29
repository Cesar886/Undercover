import crypto from 'crypto';
import sharp from 'sharp';
import * as exifr from 'exifr';

export type ImageMetadata = Record<string, unknown>;

type UploadContext = {
  uploaderIp?: string | null;
  originalName?: string | null;
};

const AI_TEXT_KEYS = ['prompt', 'negative prompt', 'negative_prompt', 'steps', 'sampler', 'cfg scale', 'cfg_scale', 'seed', 'model', 'parameters'];

function detectMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.subarray(8, 12).toString('ascii').toLowerCase();
    if (brand.includes('heic') || brand.includes('heix') || brand.includes('hevc') || brand.includes('heif') || brand.includes('mif1')) return 'image/heif';
    if (brand.includes('avif')) return 'image/avif';
  }
  return null;
}

function dataUrlMime(input: string): string | null {
  return input.match(/^data:([^;]+);base64,/)?.[1] ?? null;
}

function cleanValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return { bytes: value.length, sha256: crypto.createHash('sha256').update(value).digest('hex') };
  if (ArrayBuffer.isView(value)) return { length: value.byteLength };
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) out[key] = cleanValue(child);
    return out;
  }
  return value ?? null;
}

function pick(raw: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (raw[key] !== undefined) return cleanValue(raw[key]);
  return null;
}

function parseExifDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

function findAiParameters(raw: Record<string, unknown>) {
  const found: Record<string, unknown> = {};
  const flat = JSON.stringify(raw).toLowerCase();
  for (const key of AI_TEXT_KEYS) {
    if (flat.includes(key)) found[key] = true;
  }
  return Object.keys(found).length ? found : null;
}

function gpsDecimal(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function extractImageMetadata(input: string, buf: Buffer, context: UploadContext = {}): Promise<ImageMetadata> {
  const mime = dataUrlMime(input) ?? detectMime(buf);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const md5 = crypto.createHash('md5').update(buf).digest('hex');

  let sharpMeta = {} as Partial<sharp.Metadata>;
  try { sharpMeta = await sharp(buf, { failOn: 'none' }).metadata(); } catch {}

  let parsed: Record<string, unknown> = {};
  try {
    parsed = await exifr.parse(buf, {
      tiff: true, ifd0: true, ifd1: true, exif: true, gps: true, interop: true,
      makerNote: true, userComment: true, xmp: true, iptc: true, icc: true,
      jfif: true, ihdr: true, reviveValues: false, translateValues: true, mergeOutput: true,
    } as never) as Record<string, unknown> ?? {};
  } catch {}

  const raw = cleanValue(parsed) as Record<string, unknown>;
  const imageDescription = pick(parsed, 'ImageDescription', 'description', 'Description');
  const userComment = pick(parsed, 'UserComment', 'userComment');
  const documentId = pick(parsed, 'DocumentID', 'DocumentId', 'documentID');
  const instanceId = pick(parsed, 'InstanceID', 'InstanceId', 'instanceID');
  const creatorTool = pick(parsed, 'CreatorTool', 'Software', 'ProcessingSoftware');

  return {
    exif: {
      device: {
        make: pick(parsed, 'Make'),
        model: pick(parsed, 'Model'),
        body_serial_number: pick(parsed, 'BodySerialNumber', 'SerialNumber', 'CameraSerialNumber'),
        lens: pick(parsed, 'LensModel', 'Lens', 'LensInfo'),
        lens_serial_number: pick(parsed, 'LensSerialNumber'),
        software_firmware: pick(parsed, 'Software', 'Firmware'),
      },
      capture_settings: {
        exposure_time: pick(parsed, 'ExposureTime'),
        aperture: pick(parsed, 'FNumber', 'ApertureValue'),
        iso: pick(parsed, 'ISO', 'ISOSpeedRatings', 'PhotographicSensitivity'),
        focal_length: pick(parsed, 'FocalLength'),
        focal_length_35mm: pick(parsed, 'FocalLengthIn35mmFormat'),
        exposure_compensation: pick(parsed, 'ExposureCompensation', 'ExposureBiasValue'),
        metering_mode: pick(parsed, 'MeteringMode'),
        exposure_mode: pick(parsed, 'ExposureMode', 'ExposureProgram'),
        white_balance: pick(parsed, 'WhiteBalance'),
        flash: pick(parsed, 'Flash'),
        scene_capture_type: pick(parsed, 'SceneCaptureType'),
        subject_distance: pick(parsed, 'SubjectDistance'),
        digital_zoom_ratio: pick(parsed, 'DigitalZoomRatio'),
        orientation: pick(parsed, 'Orientation'),
      },
      datetime: {
        original: parseExifDate(pick(parsed, 'DateTimeOriginal', 'CreateDate')),
        digitized: parseExifDate(pick(parsed, 'DateTimeDigitized')),
        modified: parseExifDate(pick(parsed, 'ModifyDate', 'DateTime')),
        timezone_offset: pick(parsed, 'OffsetTime', 'OffsetTimeOriginal', 'TimeZoneOffset'),
        subseconds: pick(parsed, 'SubSecTime', 'SubSecTimeOriginal', 'SubSecTimeDigitized'),
      },
      image: {
        width: sharpMeta.width ?? pick(parsed, 'ExifImageWidth', 'ImageWidth'),
        height: sharpMeta.height ?? pick(parsed, 'ExifImageHeight', 'ImageHeight'),
        resolution_x: pick(parsed, 'XResolution'),
        resolution_y: pick(parsed, 'YResolution'),
        resolution_unit: pick(parsed, 'ResolutionUnit'),
        color_space: pick(parsed, 'ColorSpace') ?? sharpMeta.space ?? null,
        compression: pick(parsed, 'Compression') ?? sharpMeta.compression ?? null,
        bits_per_sample: pick(parsed, 'BitsPerSample') ?? sharpMeta.depth ?? null,
        embedded_thumbnail: Boolean(sharpMeta.hasProfile || parsed.ThumbnailOffset || parsed.ThumbnailLength),
      },
      raw,
    },
    gps: {
      latitude: gpsDecimal(parsed.latitude) ?? pick(parsed, 'GPSLatitude'),
      longitude: gpsDecimal(parsed.longitude) ?? pick(parsed, 'GPSLongitude'),
      altitude: pick(parsed, 'GPSAltitude'),
      speed: pick(parsed, 'GPSSpeed'),
      camera_direction: pick(parsed, 'GPSImgDirection'),
      precision: pick(parsed, 'GPSHPositioningError', 'GPSDOP'),
      datetime_utc: pick(parsed, 'GPSDateStamp', 'GPSTimeStamp'),
      map_datum: pick(parsed, 'GPSMapDatum'),
      place_name: pick(parsed, 'Location', 'City', 'Sub-location', 'Province-State', 'Country-PrimaryLocationName'),
    },
    maker_notes: {
      raw: pick(parsed, 'MakerNote') ?? null,
      shutter_count: pick(parsed, 'ShutterCount', 'ImageCount'),
      focus_points: pick(parsed, 'FocusPoints', 'AFPointsUsed', 'AFPoint'),
      focus_mode: pick(parsed, 'FocusMode', 'AFMode'),
      picture_style: pick(parsed, 'PictureStyle', 'FilmSimulation', 'CreativeStyle'),
      noise_reduction: pick(parsed, 'NoiseReduction'),
      hdr: pick(parsed, 'HDR', 'HDRMode'),
      burst_mode: pick(parsed, 'BurstMode', 'DriveMode'),
      stabilization: pick(parsed, 'ImageStabilization', 'Stabilization'),
      camera_temperature: pick(parsed, 'CameraTemperature'),
      owner_name: pick(parsed, 'OwnerName', 'CameraOwnerName'),
    },
    iptc: {
      title: pick(parsed, 'ObjectName', 'Headline', 'Title'),
      description_caption: pick(parsed, 'Caption-Abstract', 'Caption', 'Description'),
      keywords: pick(parsed, 'Keywords', 'Subject'),
      author_photographer: pick(parsed, 'By-line', 'Creator', 'Artist'),
      credit_source: pick(parsed, 'Credit', 'Source'),
      copyright: pick(parsed, 'CopyrightNotice', 'Copyright'),
      contact: pick(parsed, 'Contact', 'CreatorContactInfo'),
      city: pick(parsed, 'City'),
      state: pick(parsed, 'Province-State', 'State'),
      country: pick(parsed, 'Country-PrimaryLocationName', 'Country'),
      country_code: pick(parsed, 'Country-PrimaryLocationCode'),
      category_rating: pick(parsed, 'Category', 'Rating'),
      usage_instructions: pick(parsed, 'SpecialInstructions', 'Instructions'),
      creation_date: pick(parsed, 'DateCreated', 'CreateDate'),
    },
    xmp: {
      edit_history: pick(parsed, 'History', 'DerivedFrom'),
      develop_settings: pick(parsed, 'Exposure2012', 'Contrast2012', 'ToneCurve', 'ProcessVersion'),
      color_labels_ratings: { label: pick(parsed, 'Label'), rating: pick(parsed, 'Rating') },
      original_file_name: pick(parsed, 'OriginalDocumentID', 'PreservedFileName', 'OriginalFileName'),
      document_id: documentId,
      instance_id: instanceId,
      creator_tool: creatorTool,
      face_regions: pick(parsed, 'RegionInfo', 'Regions'),
      crop_region: pick(parsed, 'CropTop', 'CropLeft', 'CropBottom', 'CropRight', 'CropAngle'),
      license: pick(parsed, 'License', 'UsageTerms', 'WebStatement'),
    },
    icc: {
      profile_name: sharpMeta.icc ? 'embedded' : pick(parsed, 'ProfileDescription', 'ICCProfileName'),
      profile_size: sharpMeta.icc?.length ?? null,
      manufacturer: pick(parsed, 'ProfileCopyright', 'ProfileCreator'),
      white_point: pick(parsed, 'MediaWhitePoint'),
      primaries: pick(parsed, 'RedMatrixColumn', 'GreenMatrixColumn', 'BlueMatrixColumn'),
      gamma_curve: pick(parsed, 'ToneCurve', 'Gamma'),
    },
    format_specific: {
      mime,
      format: sharpMeta.format ?? null,
      jpeg: { jfif: pick(parsed, 'JFIFVersion'), comment: pick(parsed, 'Comment'), chroma_subsampling: pick(parsed, 'YCbCrSubSampling') },
      png: { text_chunks_or_ai_parameters: findAiParameters(raw), gamma: pick(parsed, 'Gamma'), physical_pixel_dimensions: pick(parsed, 'PixelsPerUnitX', 'PixelsPerUnitY') },
      heic_heif: { depth_map: pick(parsed, 'DepthMap'), live_photo_video: pick(parsed, 'MotionPhoto', 'LivePhoto') },
      gif: { pages_frames: sharpMeta.pages ?? null, loop: sharpMeta.loop ?? null, delay: sharpMeta.delay ?? null },
      tiff: { pages: sharpMeta.pages ?? null, compression: sharpMeta.compression ?? null },
      raw: { sensor_data: pick(parsed, 'SensorInfo'), color_matrix: pick(parsed, 'ColorMatrix1', 'ColorMatrix2'), black_level: pick(parsed, 'BlackLevel') },
    },
    ai_generation: {
      prompt: pick(parsed, 'Prompt', 'prompt'),
      negative_prompt: pick(parsed, 'NegativePrompt', 'negativePrompt'),
      steps: pick(parsed, 'Steps', 'steps'),
      sampler: pick(parsed, 'Sampler', 'sampler'),
      cfg_scale: pick(parsed, 'CFGScale', 'cfgScale'),
      seed: pick(parsed, 'Seed', 'seed'),
      model: pick(parsed, 'Model', 'model'),
      generator_tool: pick(parsed, 'Generator', 'CreatorTool', 'Software'),
      detected_parameters: findAiParameters(raw),
    },
    c2pa_content_credentials: {
      present: Boolean(JSON.stringify(raw).toLowerCase().includes('c2pa') || buf.includes(Buffer.from('c2pa'))),
      digital_signature: pick(parsed, 'DigitalSignature'),
      provenance_chain: pick(parsed, 'Provenance', 'Ingredients'),
      ai_generated_indicator: pick(parsed, 'AIGenerated', 'DigitalSourceType'),
      signer_certificate: pick(parsed, 'Certificate', 'Signer'),
    },
    filesystem_upload: {
      original_name: context.originalName ?? null,
      path: null,
      size_bytes: buf.length,
      created_at: null,
      modified_at: null,
      accessed_at: null,
      permissions: null,
      owner: null,
      mime_type: mime,
      sha256,
      md5,
      uploader_ip: context.uploaderIp ?? null,
    },
    other: {
      user_comment: userComment,
      image_description: imageDescription,
      image_unique_id: pick(parsed, 'ImageUniqueID'),
      panorama_360: pick(parsed, 'ProjectionType', 'UsePanoramaViewer'),
      drone: {
        relative_altitude: pick(parsed, 'RelativeAltitude'),
        gimbal_angle: pick(parsed, 'GimbalPitchDegree', 'GimbalYawDegree', 'GimbalRollDegree'),
        drone_id: pick(parsed, 'DroneID', 'SerialNumber'),
      },
      associated_video: pick(parsed, 'MotionPhoto', 'LivePhoto', 'MicroVideo'),
    },
  };
}
