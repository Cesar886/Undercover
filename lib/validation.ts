import { sanitize } from './sanitize';
import { PostCategory, ReportReason, VoteType } from '@/types';
import { containsUrl } from './linkDetection';

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_CATEGORIES: PostCategory[] = ['general', 'quemones', 'infieles', 'confesiones'];
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 6;
const MAX_POLL_OPTION_CHARS = 80;
const MAX_POLL_QUESTION_CHARS = 150;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface PostInput {
  content: string;
  category: PostCategory;
  image?: string;
  poll_options?: string[];
  poll_question?: string;
}

function validatePollOptions(raw: unknown): Validated<string[] | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };

  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Opciones de encuesta inválidas', status: 400 };
  }

  const options = raw
    .map((option) => sanitize(typeof option === 'string' ? option : ''))
    .filter(Boolean);

  if (options.length === 0) return { ok: true, value: undefined };

  if (options.length < MIN_POLL_OPTIONS) {
    return { ok: false, error: 'La encuesta necesita al menos 2 opciones', status: 400 };
  }

  if (options.length > MAX_POLL_OPTIONS) {
    return { ok: false, error: 'La encuesta permite máximo 6 opciones', status: 400 };
  }

  for (const option of options) {
    if (option.length > MAX_POLL_OPTION_CHARS) {
      return { ok: false, error: 'Cada opción de encuesta debe tener máximo 80 caracteres', status: 400 };
    }
    if (containsUrl(option)) {
      return { ok: false, error: 'No se permiten enlaces ni URLs en la encuesta', status: 400 };
    }
  }

  const normalized = options.map((option) => option.toLocaleLowerCase('es-MX'));
  if (new Set(normalized).size !== normalized.length) {
    return { ok: false, error: 'Las opciones de encuesta no pueden repetirse', status: 400 };
  }

  return { ok: true, value: options };
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
  if (containsUrl(content)) return { ok: false, error: 'No se permiten enlaces ni URLs en el contenido', status: 400 };

  if (!VALID_CATEGORIES.includes(b.category as PostCategory)) {
    return { ok: false, error: 'Categoría inválida', status: 400 };
  }

  const image = typeof b.image === 'string' && b.image.length > 0 ? b.image : undefined;
  const pollOptions = validatePollOptions(b.poll_options);
  if (!pollOptions.ok) return pollOptions;

  let poll_question: string | undefined;
  if (pollOptions.value) {
    const rawQuestion = typeof b.poll_question === 'string' ? sanitize(b.poll_question) : '';
    if (!rawQuestion) {
      return { ok: false, error: 'La encuesta necesita una pregunta', status: 400 };
    }
    if (rawQuestion.length > MAX_POLL_QUESTION_CHARS) {
      return { ok: false, error: `La pregunta de la encuesta debe tener máximo ${MAX_POLL_QUESTION_CHARS} caracteres`, status: 400 };
    }
    if (containsUrl(rawQuestion)) {
      return { ok: false, error: 'No se permiten enlaces ni URLs en la pregunta', status: 400 };
    }
    poll_question = rawQuestion;
  }

  return {
    ok: true,
    value: {
      content,
      category: b.category as PostCategory,
      image,
      ...(pollOptions.value ? { poll_options: pollOptions.value, poll_question } : {}),
    },
  };
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
  if (containsUrl(content)) return { ok: false, error: 'No se permiten enlaces ni URLs en el contenido', status: 400 };

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

export interface EditPostInput {
  content: string;
}

export function validateEditPostInput(body: unknown): Validated<EditPostInput> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body inválido', status: 400 };
  }
  const raw = (body as Record<string, unknown>).content;
  const content = sanitize(typeof raw === 'string' ? raw : '');
  if (!content) return { ok: false, error: 'Contenido vacío', status: 400 };
  if (content.length > 500) return { ok: false, error: 'Contenido excede 500 caracteres', status: 400 };
  if (containsUrl(content)) return { ok: false, error: 'No se permiten enlaces ni URLs en el contenido', status: 400 };
  return { ok: true, value: { content } };
}

export interface EditCommentInput {
  content: string;
}

export function validateEditCommentInput(body: unknown): Validated<EditCommentInput> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body inválido', status: 400 };
  }
  const raw = (body as Record<string, unknown>).content;
  const content = sanitize(typeof raw === 'string' ? raw : '');
  if (!content) return { ok: false, error: 'Contenido vacío', status: 400 };
  if (content.length > 300) return { ok: false, error: 'Contenido excede 300 caracteres', status: 400 };
  if (containsUrl(content)) return { ok: false, error: 'No se permiten enlaces ni URLs en el contenido', status: 400 };
  return { ok: true, value: { content } };
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
  reason: ReportReason;
  detail?: string;
}

const VALID_REASONS: ReportReason[] = [
  'spam',
  'inappropriate',
  'harassment',
  'misinformation',
  'other',
];

export function validateReportInput(body: unknown): Validated<ReportInput> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Razón requerida', status: 400 };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.reason !== 'string' || !VALID_REASONS.includes(b.reason as ReportReason)) {
    return { ok: false, error: 'Razón inválida', status: 400 };
  }
  const reason = b.reason as ReportReason;

  let detail: string | undefined;
  if (b.detail !== undefined && b.detail !== null && b.detail !== '') {
    if (reason !== 'other') {
      return { ok: false, error: 'Detalle sólo permitido con razón "other"', status: 400 };
    }
    if (typeof b.detail !== 'string') {
      return { ok: false, error: 'Detalle inválido', status: 400 };
    }
    const cleaned = sanitize(b.detail);
    if (cleaned.length > 200) {
      return { ok: false, error: 'Detalle excede 200 caracteres', status: 400 };
    }
    if (containsUrl(cleaned)) {
      return { ok: false, error: 'No se permiten enlaces ni URLs en el detalle', status: 400 };
    }
    detail = cleaned || undefined;
  }

  return { ok: true, value: detail ? { reason, detail } : { reason } };
}
