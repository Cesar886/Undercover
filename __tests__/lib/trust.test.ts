import {
  applyTrustDelta,
  shouldApplyTrustForVote,
  formatSuspensionDate,
} from '@/lib/trust';

// ---------------------------------------------------------------------------
// Helper: creates a minimal PoolClient mock
// First call to query() returns the SELECT result, second returns UPDATE result
// ---------------------------------------------------------------------------
function makeClient(userData: {
  trust_score: number;
  trust_unlocked?: boolean;
  is_suspended?: boolean;
  suspension_end?: Date | null;
  suspension_count?: number;
}) {
  const row = {
    trust_score: userData.trust_score,
    trust_unlocked: userData.trust_unlocked ?? false,
    is_suspended: userData.is_suspended ?? false,
    suspension_end: userData.suspension_end ?? null,
    suspension_count: userData.suspension_count ?? 0,
  };

  let callCount = 0;
  const calls: unknown[][] = [];

  const query = jest.fn((...args: unknown[]) => {
    calls.push(args);
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ rows: [row] });
    }
    return Promise.resolve({ rows: [] });
  });

  // Expose internal arrays so tests can inspect the UPDATE call
  return { query, calls } as unknown as { query: jest.Mock; calls: unknown[][] } & import('pg').PoolClient;
}

function makeEmptyClient() {
  const query = jest.fn(() => Promise.resolve({ rows: [] }));
  return { query } as unknown as import('pg').PoolClient;
}

// ---------------------------------------------------------------------------
// applyTrustDelta
// ---------------------------------------------------------------------------
describe('applyTrustDelta', () => {
  it('1. fase lenta positiva: score=9, baseDelta=+2 → delta=+1, newScore=10, shouldUnlock=true', async () => {
    const client = makeClient({ trust_score: 9, trust_unlocked: false });
    await applyTrustDelta('user1', 2, client as unknown as import('pg').PoolClient);

    // Second call is the UPDATE
    const updateArgs = (client as { calls: unknown[][] }).calls[1][1] as unknown[];
    const [newScore, shouldUnlock] = updateArgs as [number, boolean, ...unknown[]];
    expect(newScore).toBe(10);           // 9 + floor(2/2) = 9 + 1 = 10
    expect(shouldUnlock).toBe(true);
  });

  it('2. penalización aumentada: score=-1, baseDelta=-2 → delta=-3, newScore=-4, primera suspensión 24h', async () => {
    const client = makeClient({
      trust_score: -1,
      is_suspended: false,
      suspension_count: 0,
    });
    const before = Date.now();
    await applyTrustDelta('user1', -2, client as unknown as import('pg').PoolClient);
    const after = Date.now();

    const updateArgs = (client as { calls: unknown[][] }).calls[1][1] as unknown[];
    const [newScore, , newIsSuspended, newSuspensionEnd] = updateArgs as [number, boolean, boolean, Date | null, ...unknown[]];

    // ceil(-2 * 1.5) = ceil(-3) = -3; -1 + (-3) = -4
    expect(newScore).toBe(-4);
    expect(newIsSuspended).toBe(true);
    // suspension_end should be ~24h from now
    expect(newSuspensionEnd).toBeInstanceOf(Date);
    const endMs = (newSuspensionEnd as Date).getTime();
    expect(endMs).toBeGreaterThanOrEqual(before + 23 * 60 * 60 * 1000);
    expect(endMs).toBeLessThanOrEqual(after + 25 * 60 * 60 * 1000);
  });

  it('5. primera suspensión 24h: score=-1, baseDelta=-2, is_suspended=false, suspension_count=0', async () => {
    const client = makeClient({
      trust_score: -1,
      is_suspended: false,
      suspension_count: 0,
    });
    const before = Date.now();
    await applyTrustDelta('user1', -2, client as unknown as import('pg').PoolClient);
    const after = Date.now();

    const updateArgs = (client as { calls: unknown[][] }).calls[1][1] as unknown[];
    const [, , newIsSuspended, newSuspensionEnd] = updateArgs as [number, boolean, boolean, Date | null, ...unknown[]];
    expect(newIsSuspended).toBe(true);
    const endMs = (newSuspensionEnd as Date).getTime();
    const h24 = 24 * 60 * 60 * 1000;
    expect(endMs).toBeGreaterThanOrEqual(before + h24 - 1000);
    expect(endMs).toBeLessThanOrEqual(after + h24 + 1000);
  });

  it('6. primera suspensión 7d: score=-11, baseDelta=-1, is_suspended=false, suspension_count=0', async () => {
    // score=-11, baseDelta=-1 → since trust_score<0, delta=ceil(-1*1.5)=ceil(-1.5)=-1
    // newScore = -11 + (-1) = -12, which is <= -11 → 7 days
    const client = makeClient({
      trust_score: -11,
      is_suspended: false,
      suspension_count: 0,
    });
    const before = Date.now();
    await applyTrustDelta('user1', -1, client as unknown as import('pg').PoolClient);
    const after = Date.now();

    const updateArgs = (client as { calls: unknown[][] }).calls[1][1] as unknown[];
    const [, , newIsSuspended, newSuspensionEnd] = updateArgs as [number, boolean, boolean, Date | null, ...unknown[]];
    expect(newIsSuspended).toBe(true);
    const endMs = (newSuspensionEnd as Date).getTime();
    const d7 = 7 * 24 * 60 * 60 * 1000;
    expect(endMs).toBeGreaterThanOrEqual(before + d7 - 1000);
    expect(endMs).toBeLessThanOrEqual(after + d7 + 1000);
  });

  it('7. permanente por reincidencia: score=-5, baseDelta=-1, suspension_count=1', async () => {
    // score=-5, baseDelta=-1 → trust_score<0, delta=ceil(-1*1.5)=ceil(-1.5)=-1
    // newScore=-6, is_suspended=false (fresh), suspension_count=1 → permanent
    const client = makeClient({
      trust_score: -5,
      is_suspended: false,
      suspension_count: 1,
    });
    await applyTrustDelta('user1', -1, client as unknown as import('pg').PoolClient);

    const updateArgs = (client as { calls: unknown[][] }).calls[1][1] as unknown[];
    const [, , newIsSuspended, newSuspensionEnd] = updateArgs as [number, boolean, boolean, Date | null, ...unknown[]];
    expect(newIsSuspended).toBe(true);
    expect(newSuspensionEnd).toBeNull();
  });

  it('8. suspensión expirada tratada como no-suspendida: is_suspended=true, suspension_end=ayer → nueva suspensión 24h', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1);
    const client = makeClient({
      trust_score: -5,
      is_suspended: true,
      suspension_end: yesterday,
      suspension_count: 0,
    });
    const before = Date.now();
    await applyTrustDelta('user1', -2, client as unknown as import('pg').PoolClient);
    const after = Date.now();

    const updateArgs = (client as { calls: unknown[][] }).calls[1][1] as unknown[];
    const [, , newIsSuspended, newSuspensionEnd] = updateArgs as [number, boolean, boolean, Date | null, ...unknown[]];

    // suspensionIsActive=false (expired) → enters !suspensionIsActive branch
    // suspension_count=0, newScore=-5+ceil(-2*1.5)=-5+-3=-8 → between -11 and 0 → 24h
    expect(newIsSuspended).toBe(true);
    expect(newSuspensionEnd).toBeInstanceOf(Date);
    // Must NOT be null (not promoted to permanent)
    expect(newSuspensionEnd).not.toBeNull();
    const endMs = (newSuspensionEnd as Date).getTime();
    const h24 = 24 * 60 * 60 * 1000;
    expect(endMs).toBeGreaterThanOrEqual(before + h24 - 1000);
    expect(endMs).toBeLessThanOrEqual(after + h24 + 1000);
  });

  it('9. usuario no existe: rows vacías → retorna sin UPDATE', async () => {
    const client = makeEmptyClient();
    await applyTrustDelta('ghost', -1, client as unknown as import('pg').PoolClient);

    // Only the SELECT was called, no UPDATE
    expect((client as unknown as { query: jest.Mock }).query).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// shouldApplyTrustForVote
// ---------------------------------------------------------------------------
describe('shouldApplyTrustForVote', () => {
  it('3. auto-voto → false', () => {
    expect(shouldApplyTrustForVote('user1', 'user1')).toBe(false);
  });

  it('4. anónimo vota → true', () => {
    expect(shouldApplyTrustForVote(null, 'user1')).toBe(true);
  });

  it('usuario diferente vota → true', () => {
    expect(shouldApplyTrustForVote('user2', 'user1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatSuspensionDate
// ---------------------------------------------------------------------------
describe('formatSuspensionDate', () => {
  it('formatea una fecha en DD/MM/YYYY HH:mm', () => {
    // Use a fixed date to avoid timezone surprises
    const d = new Date(2024, 0, 5, 9, 7); // 05/01/2024 09:07
    const result = formatSuspensionDate(d);
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    // day and month should be zero-padded
    expect(result).toContain('05/01/2024');
    expect(result).toContain('09:07');
  });

  it('acepta un string ISO y retorna el formato correcto', () => {
    const result = formatSuspensionDate('2024-06-15T14:30:00');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
});
