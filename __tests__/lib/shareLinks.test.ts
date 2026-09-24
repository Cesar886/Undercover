import { createShareToken, shareLinkTtlSeconds, verifyShareToken } from '@/lib/shareLinks';

const originalSecret = process.env.SHARE_LINK_SECRET;
const originalTtl = process.env.SHARE_LINK_TTL_SECONDS;

describe('temporary share tokens', () => {
  beforeEach(() => {
    process.env.SHARE_LINK_SECRET = 'test-share-secret-at-least-32-characters';
    delete process.env.SHARE_LINK_TTL_SECONDS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SHARE_LINK_SECRET;
    else process.env.SHARE_LINK_SECRET = originalSecret;
    if (originalTtl === undefined) delete process.env.SHARE_LINK_TTL_SECONDS;
    else process.env.SHARE_LINK_TTL_SECONDS = originalTtl;
  });

  it('creates a grant valid for two hours by default', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const created = createShareToken({ kind: 'post', postId: 'post-id' });

    expect(shareLinkTtlSeconds()).toBe(7200);
    expect(verifyShareToken(created.token)).toEqual({
      kind: 'post',
      postId: 'post-id',
      exp: 1_700_007_200,
    });
  });

  it('still accepts an explicit positive duration override', () => {
    process.env.SHARE_LINK_TTL_SECONDS = '900';
    expect(shareLinkTtlSeconds()).toBe(900);
  });

  it('rejects a modified signature', () => {
    const { token } = createShareToken({ kind: 'post', postId: 'post-id' });
    const [payload, signature] = token.split('.');
    const first = signature[0] === 'a' ? 'b' : 'a';

    expect(verifyShareToken(`${payload}.${first}${signature.slice(1)}`)).toBeNull();
  });

  it('rejects a token once its two hours have elapsed', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { token } = createShareToken({
      kind: 'comment',
      postId: 'post-id',
      commentId: 'comment-id',
    });
    now.mockReturnValue(1_700_007_200_000);

    expect(verifyShareToken(token)).toBeNull();
  });
});
