import { NextRequest, NextResponse } from 'next/server';
import { subscribeFeed, FeedEvent } from '@/lib/events';
import { getSessionUsername } from '@/lib/auth';

// Streaming requiere runtime Node y respuesta dinámica.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await getSessionUsername())) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller ya cerrado
        }
      };

      const sendEvent = (ev: FeedEvent) => {
        safeEnqueue(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
      };

      // Saludo inicial — fuerza al cliente a confirmar conexión y evita buffering en proxies.
      safeEnqueue(`event: ready\ndata: {}\n\n`);

      const unsubscribe = subscribeFeed(sendEvent);

      // Heartbeat cada 25s para mantener viva la conexión a través de proxies.
      const heartbeat = setInterval(() => safeEnqueue(`: ping\n\n`), 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ya cerrado
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
