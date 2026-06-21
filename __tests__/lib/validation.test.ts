import { containsUrl } from '@/lib/linkDetection';

import {
  validatePostInput,
  validateCommentInput,
  validateVoteInput,
  validateReportInput,
  validateEditPostInput,
  validateEditCommentInput,
  isUuid,
} from '@/lib/validation';

const A_UUID = '11111111-1111-1111-1111-111111111111';


describe('containsUrl', () => {
  it('detects common and obfuscated URLs', () => {
    expect(containsUrl('mira https://example.com')).toBe(true);
    expect(containsUrl('mira hxxps://example.com')).toBe(true);
    expect(containsUrl('mira http : // example.com')).toBe(true);
    expect(containsUrl('mira www . ejemplo . com')).toBe(true);
    expect(containsUrl('mira ejemplo dot com')).toBe(true);
    expect(containsUrl('mira ejemplo punto mx')).toBe(true);
    expect(containsUrl('correo test@example.com')).toBe(true);
  });

  it('does not reject normal text without URLs', () => {
    expect(containsUrl('hoy tengo clase a las 10.5 y no quiero ir')).toBe(false);
    expect(containsUrl('me gusta programar pero no pongo links')).toBe(false);
  });
});

describe('isUuid', () => {
  it('accepts a valid uuid', () => expect(isUuid(A_UUID)).toBe(true));
  it('rejects garbage', () => expect(isUuid('not-a-uuid')).toBe(false));
  it('rejects non-strings', () => expect(isUuid(123 as unknown)).toBe(false));
});

describe('validatePostInput', () => {
  it('rejects empty content', () => {
    const r = validatePostInput({ content: '', category: 'quemones' });
    expect(r.ok).toBe(false);
  });
  it('rejects content > 500 chars', () => {
    const r = validatePostInput({ content: 'a'.repeat(501), category: 'quemones' });
    expect(r.ok).toBe(false);
  });
  it('rejects invalid category', () => {
    const r = validatePostInput({ content: 'hi', category: 'fake' });
    expect(r.ok).toBe(false);
  });
  it('accepts valid input', () => {
    const r = validatePostInput({ content: 'hi', category: 'quemones' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('quemones');
  });
  it('passes image through when provided', () => {
    const r = validatePostInput({ content: 'hi', category: 'quemones', image: 'data:...' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.image).toBe('data:...');
  });
  it('accepts a poll with 2 to 6 options', () => {
    const r = validatePostInput({
      content: 'voten',
      category: 'general',
      poll_options: ['uno', 'dos', 'tres', 'cuatro', 'cinco'],
      poll_question: '¿Cuál prefieres?',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.poll_options).toHaveLength(5);
  });
  it('rejects polls without pregunta', () => {
    const r = validatePostInput({ content: 'voten', category: 'general', poll_options: ['uno', 'dos'] });
    expect(r.ok).toBe(false);
  });
  it('rejects polls with fewer than 2 options', () => {
    const r = validatePostInput({ content: 'voten', category: 'general', poll_options: ['uno'], poll_question: '¿Cuál?' });
    expect(r.ok).toBe(false);
  });
  it('rejects polls with more than 6 options', () => {
    const r = validatePostInput({
      content: 'voten',
      category: 'general',
      poll_options: ['1', '2', '3', '4', '5', '6', '7'],
      poll_question: '¿Cuál?',
    });
    expect(r.ok).toBe(false);
  });
  it('rejects duplicate or URL poll options', () => {
    expect(validatePostInput({ content: 'voten', category: 'general', poll_options: ['uno', 'Uno'], poll_question: '¿Cuál?' }).ok).toBe(false);
    expect(validatePostInput({ content: 'voten', category: 'general', poll_options: ['uno', 'google.com'], poll_question: '¿Cuál?' }).ok).toBe(false);
  });
  it('rejects non-object body', () => {
    expect(validatePostInput(null).ok).toBe(false);
    expect(validatePostInput('string').ok).toBe(false);
  });
  it('rejects URLs in content', () => {
    expect(validatePostInput({ content: 'visita https://google.com', category: 'quemones' }).ok).toBe(false);
    expect(validatePostInput({ content: 'mi sitio www.ejemplo.com', category: 'quemones' }).ok).toBe(false);
    expect(validatePostInput({ content: 'hola dominio.com.mx jaja', category: 'quemones' }).ok).toBe(false);
    expect(validatePostInput({ content: 'hola dominio punto com jaja', category: 'quemones' }).ok).toBe(false);
    expect(validatePostInput({ content: 'hola test@example.com jaja', category: 'quemones' }).ok).toBe(false);
  });
});

describe('validateCommentInput', () => {
  it('rejects empty content with no image', () => {
    expect(validateCommentInput({ content: '' }).ok).toBe(false);
  });
  it('rejects content > 300 chars', () => {
    expect(validateCommentInput({ content: 'a'.repeat(301) }).ok).toBe(false);
  });
  it('rejects invalid parent_id', () => {
    expect(validateCommentInput({ content: 'hi', parent_id: 'nope' }).ok).toBe(false);
  });
  it('accepts valid uuid parent_id', () => {
    const r = validateCommentInput({ content: 'hi', parent_id: A_UUID });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.parent_id).toBe(A_UUID);
  });
  it('accepts null parent_id', () => {
    const r = validateCommentInput({ content: 'hi', parent_id: null });
    expect(r.ok).toBe(true);
  });
  it('rejects URLs in content', () => {
    expect(validateCommentInput({ content: 'visita https://google.com' }).ok).toBe(false);
  });
});

describe('validateVoteInput', () => {
  it('accepts up', () => expect(validateVoteInput({ vote_type: 'up' }).ok).toBe(true));
  it('accepts down', () => expect(validateVoteInput({ vote_type: 'down' }).ok).toBe(true));
  it('rejects bogus', () => expect(validateVoteInput({ vote_type: 'sideways' }).ok).toBe(false));
  it('rejects missing', () => expect(validateVoteInput({}).ok).toBe(false));
});

describe('validateReportInput', () => {
  it('rejects empty body', () => expect(validateReportInput(null).ok).toBe(false));
  it('rejects missing reason', () => expect(validateReportInput({}).ok).toBe(false));
  it('rejects unknown reason', () => {
    expect(validateReportInput({ reason: 'because' }).ok).toBe(false);
  });
  it('accepts spam', () => {
    expect(validateReportInput({ reason: 'spam' }).ok).toBe(true);
  });
  it('accepts inappropriate', () => {
    expect(validateReportInput({ reason: 'inappropriate' }).ok).toBe(true);
  });
  it('rejects detail when reason !== other', () => {
    expect(validateReportInput({ reason: 'spam', detail: 'meh' }).ok).toBe(false);
  });
  it('accepts other with detail', () => {
    const r = validateReportInput({ reason: 'other', detail: 'me explico' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.detail).toBe('me explico');
  });
  it('rejects other with detail > 200 chars', () => {
    expect(validateReportInput({ reason: 'other', detail: 'a'.repeat(201) }).ok).toBe(false);
  });
  it('rejects other with detail containing URL', () => {
    expect(validateReportInput({ reason: 'other', detail: 'mira esto google.com' }).ok).toBe(false);
  });
});

describe('validateEditPostInput', () => {
  it('rejects empty content', () => {
    expect(validateEditPostInput({ content: '' }).ok).toBe(false);
  });
  it('rejects content > 500 chars', () => {
    expect(validateEditPostInput({ content: 'a'.repeat(501) }).ok).toBe(false);
  });
  it('accepts valid content', () => {
    const r = validateEditPostInput({ content: 'editado' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.content).toBe('editado');
  });
  it('rejects URLs in content', () => {
    expect(validateEditPostInput({ content: 'visita https://google.com' }).ok).toBe(false);
  });
});

describe('validateEditCommentInput', () => {
  it('rejects empty content', () => {
    expect(validateEditCommentInput({ content: '' }).ok).toBe(false);
  });
  it('rejects content > 300 chars', () => {
    expect(validateEditCommentInput({ content: 'a'.repeat(301) }).ok).toBe(false);
  });
  it('accepts valid content', () => {
    const r = validateEditCommentInput({ content: 'editado' });
    expect(r.ok).toBe(true);
  });
  it('rejects URLs in content', () => {
    expect(validateEditCommentInput({ content: 'visita https://google.com' }).ok).toBe(false);
  });
});
