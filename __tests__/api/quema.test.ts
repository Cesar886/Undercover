jest.mock('@/lib/quema', () => ({ runQuema: jest.fn(), isQuemaTime: jest.fn() }));
jest.mock('@/lib/events', () => ({ emitFeed: jest.fn() }));
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/cron/quema/route';
import { runQuema, isQuemaTime } from '@/lib/quema';
import { emitFeed } from '@/lib/events';
const request = (suffix = '', authorized = true) => new NextRequest('http://localhost/api/cron/quema' + suffix, {
  method: 'POST', headers: authorized ? { authorization: 'Bearer test-secret' } : {},
});
beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret';
  delete process.env.WEEKLY_CLEANUP_ENABLED;
  (isQuemaTime as jest.Mock).mockReturnValue(true);
  (runQuema as jest.Mock).mockResolvedValue({ skipped: false, counts: {} });
});
afterEach(() => { delete process.env.CRON_SECRET; delete process.env.WEEKLY_CLEANUP_ENABLED; });
it('requires authorization even for simulation', async () => {
  expect((await POST(request('', false))).status).toBe(401);
  expect(runQuema).not.toHaveBeenCalled();
});
it('defaults to simulation and allows it outside scheduled time without feed events', async () => {
  (isQuemaTime as jest.Mock).mockReturnValue(false);
  expect((await POST(request())).status).toBe(200);
  expect(runQuema).toHaveBeenCalledWith({ dryRun: true });
  expect(emitFeed).not.toHaveBeenCalled();
});
it('requires explicit activation for destructive runs', async () => {
  expect((await POST(request('?dryRun=false'))).status).toBe(409);
  expect(runQuema).not.toHaveBeenCalled();
});
it('never deletes outside Monterrey schedule', async () => {
  process.env.WEEKLY_CLEANUP_ENABLED = 'true';
  (isQuemaTime as jest.Mock).mockReturnValue(false);
  expect((await (await POST(request('?dryRun=false'))).json()).skipped).toBe(true);
  expect(runQuema).not.toHaveBeenCalled();
});
it('only emits feed reset after a successful real run', async () => {
  process.env.WEEKLY_CLEANUP_ENABLED = 'true';
  await POST(request('?dryRun=false'));
  expect(runQuema).toHaveBeenCalledWith({ dryRun: false });
  expect(emitFeed).toHaveBeenCalledTimes(1);
  (runQuema as jest.Mock).mockResolvedValue({ skipped: true });
  await POST(request('?dryRun=false'));
  expect(emitFeed).toHaveBeenCalledTimes(1);
});
