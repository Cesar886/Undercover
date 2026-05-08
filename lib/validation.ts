import { sanitize } from './sanitize';
import { PostCategory, VoteType } from '@/types';

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CATEGORIES: PostCategory[] = ['quemones', 'infieles', 'confesiones'];

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface PostInput {
  content: string;
  category: PostCategory;
  image?: string;
}

export function validatePostInput(body: unknown): Validated<PostInput> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body inválido', status: 400 };
  }
  const b = body as Record<string, unknown>;

  const rawContent = typeof b.content === 'string' ? b.content : '';
  const content = sanitize(rawContent);
  if (!content) return { ok: false, error: 'Contenido vacío', status: 400 };
  if (content.length > 500) return { ok: false, error: 'Contenido excede 500 caracteres', status: 400 };

  if (!VALID_CATEGORIES.includes(b.category as PostCategory)) {
    return { ok: false, error: 'Categoría inválida', status: 400 };
  }

  const image = typeof b.image === 'string' && b.image.length > 0 ? b.image : undefined;

  return { ok: true, value: { content, category: b.category as PostCategory, image } };
}

export interface CommentInput {
  content: string;
  parent_id: string | null;
  image?: string;
}

export function validateCommentInput(body: unknown): Validated<CommentInput> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body inválido', status: 400 };
  }
  const b = body as Record<string, unknown>;

  const rawContent = typeof b.content === 'string' ? b.content : '';
  const content = sanitize(rawContent);
  if (!content) return { ok: false, error: 'Contenido vacío', status: 400 };
  if (content.length > 300) return { ok: false, error: 'Contenido excede 300 caracteres', status: 400 };

  let parent_id: string | null = null;
  if (b.parent_id !== undefined && b.parent_id !== null) {
    if (!isUuid(b.parent_id)) {
      return { ok: false, error: 'parent_id inválido', status: 400 };
    }
    parent_id = b.parent_id;
  }

  const image = typeof b.image === 'string' && b.image.length > 0 ? b.image : undefined;

  return { ok: true, value: { content, parent_id, image } };
}

export interface VoteInput {
  vote_type: VoteType;
}

export function validateVoteInput(body: unknown): Validated<VoteInput> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body inválido', status: 400 };
  }
  const vt = (body as Record<string, unknown>).vote_type;
  if (vt !== 'up' && vt !== 'down') {
    return { ok: false, error: 'Tipo de voto inválido', status: 400 };
  }
  return { ok: true, value: { vote_type: vt } };
}

export interface ReportInput {
  reason?: string;
}

export function validateReportInput(body: unknown): Validated<ReportInput> {
  if (body === null || body === undefined) return { ok: true, value: {} };
  if (typeof body !== 'object') {
    return { ok: false, error: 'Body inválido', status: 400 };
  }
  const raw = (body as Record<string, unknown>).reason;
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: {} };
  if (typeof raw !== 'string') return { ok: false, error: 'reason inválido', status: 400 };
  const reason = sanitize(raw);
  if (reason.length > 200) return { ok: false, error: 'reason excede 200 caracteres', status: 400 };
  return { ok: true, value: { reason } };
}
