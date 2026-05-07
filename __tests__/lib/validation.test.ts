import {
  validatePostInput,
  validateCommentInput,
  validateVoteInput,
  validateReportInput,
  isUuid,
} from '@/lib/validation';

const A_UUID = '11111111-1111-1111-1111-111111111111';

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
    const r = validatePostInput({ content: 'hi', category: 'rumores' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.category).toBe('rumores');
  });
  it('passes image through when provided', () => {
    const r = validatePostInput({ content: 'hi', category: 'rumores', image: 'data:...' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.image).toBe('data:...');
  });
  it('rejects non-object body', () => {
    expect(validatePostInput(null).ok).toBe(false);
    expect(validatePostInput('string').ok).toBe(false);
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
});

describe('validateVoteInput', () => {
  it('accepts up', () => expect(validateVoteInput({ vote_type: 'up' }).ok).toBe(true));
  it('accepts down', () => expect(validateVoteInput({ vote_type: 'down' }).ok).toBe(true));
  it('rejects bogus', () => expect(validateVoteInput({ vote_type: 'sideways' }).ok).toBe(false));
  it('rejects missing', () => expect(validateVoteInput({}).ok).toBe(false));
});

describe('validateReportInput', () => {
  it('accepts empty body', () => expect(validateReportInput(null).ok).toBe(true));
  it('accepts no reason', () => expect(validateReportInput({}).ok).toBe(true));
  it('rejects reason > 200 chars', () => {
    expect(validateReportInput({ reason: 'a'.repeat(201) }).ok).toBe(false);
  });
  it('accepts valid reason', () => {
    const r = validateReportInput({ reason: 'spam' });
    expect(r.ok).toBe(true);
  });
});
