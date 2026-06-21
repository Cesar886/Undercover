import { NextRequest } from 'next/server';
import { subscribeFeed, FeedEvent } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller already closed
        }
      };

      const sendEvent = (ev: FeedEvent) => {
        if (ev.type === 'notification:new') return;
        safeEnqueue(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      };

      safeEnqueue(`event: ready\ndata: {}\n\n`);

      const unsubscribe = subscribeFeed(sendEvent);
      const heartbeat = setInterval(() => safeEnqueue(`: ping\n\n`), 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
