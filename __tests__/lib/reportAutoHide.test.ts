import { evaluatePostAutoHideAfterReport } from '@/lib/reportAutoHide';

function makeClient(results: Array<{ rows: unknown[] }>) {
  return {
    query: jest.fn().mockImplementation(() => {
      const result = results.shift();
      if (!result) throw new Error('Unexpected query');
      return Promise.resolve(result);
    }),
  };
}

describe('evaluatePostAutoHideAfterReport', () => {
  it('returns false without evaluating when the post is already hidden', async () => {
    const client = makeClient([
      { rows: [] },
      { rows: [{ column_name: 'is_hidden' }] },
      { rows: [{ id: 'p1', anon_id: 'author', created_at: new Date(), is_hidden: true }] },
    ]);

    const hidden = await evaluatePostAutoHideAfterReport(client as never, 'p1', 'user:r1');

    expect(hidden).toBe(false);
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it('hides the post and adjusts trust when weighted reports reach the threshold', async () => {
    const client = makeClient([
      { rows: [] },
      { rows: [{ column_name: 'is_hidden' }, { column_name: 'hide_reason' }, { column_name: 'hidden_at' }] },
      { rows: [{ id: 'p1', anon_id: 'author', created_at: new Date(), is_hidden: false }] },
      { rows: [{ count: '1' }] },
      { rows: [] },
      { rows: [{ reporter_count: '3' }] },
      {
        rows: [
          { reporter_id: 'user:r1', reason: 'spam', created_at: new Date(), trust_score: 3, ignored_reports_24h: 0 },
          { reporter_id: 'user:r2', reason: 'spam', created_at: new Date(), trust_score: 1, ignored_reports_24h: 0 },
        ],
      },
      { rows: [{ comment_count: 0 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    const hidden = await evaluatePostAutoHideAfterReport(client as never, 'p1', 'user:r1');

    expect(hidden).toBe(true);
    const updatePostSql = client.query.mock.calls[8][0] as string;
    expect(updatePostSql).toContain('SET is_hidden = true, hide_reason = $2, hidden_at = NOW()');
    expect(client.query.mock.calls[9][1]).toEqual([['author'], -2]);
    expect(client.query.mock.calls[10][1]).toEqual([['r1', 'r2'], 1]);
  });

  it('pauses evaluation for suspected brigading', async () => {
    const client = makeClient([
      { rows: [] },
      { rows: [{ column_name: 'is_hidden' }] },
      { rows: [{ id: 'p1', anon_id: 'author', created_at: new Date(), is_hidden: false }] },
      { rows: [{ count: '1' }] },
      { rows: [] },
      { rows: [{ reporter_count: '5' }] },
      { rows: [] },
    ]);

    const hidden = await evaluatePostAutoHideAfterReport(client as never, 'p1', 'user:r1');

    expect(hidden).toBe(false);
    expect(client.query.mock.calls[6][0]).toMatch(/INSERT INTO post_report_evaluation_state/);
  });
});
