'use client';
import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import type { FeedEvent } from '@/lib/events';

type Handler = (event: FeedEvent) => void;

interface FeedStreamContextValue {
  subscribe: (handler: Handler) => () => void;
}

const FeedStreamContext = createContext<FeedStreamContextValue | null>(null);

export function FeedStreamProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Set<Handler>>(new Set());
  const esRef = useRef<EventSource | null>(null);

  const subscribe = useCallback((handler: Handler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    let aborted = false;

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (aborted || !data.user) return;

        const es = new EventSource('/api/stream');
        esRef.current = es;

        const dispatch = (raw: MessageEvent) => {
          try {
            const ev = JSON.parse(raw.data) as FeedEvent;
            listenersRef.current.forEach((h) => {
              try {
                h(ev);
              } catch {
                // listener buggy → no romper el resto
              }
            });
          } catch {
            // payload inválido
          }
        };

        const types: FeedEvent['type'][] = [
          'post:new',
          'post:vote',
          'post:hidden',
          'post:edited',
          'comment:new',
          'comment:edited',
          'comment:deleted',
        ];
        types.forEach((t) => es.addEventListener(t, dispatch as EventListener));
      })
      .catch(() => {});

    return () => {
      aborted = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, []);

  return (
    <FeedStreamContext.Provider value={{ subscribe }}>
      {children}
    </FeedStreamContext.Provider>
  );
}

export function useFeedEvents(handler: Handler) {
  const ctx = useContext(FeedStreamContext);
  // Estabilizar el handler: si el caller no usa useCallback, evitamos re-suscribir cada render.
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!ctx) return;
    const unsubscribe = ctx.subscribe((ev) => ref.current(ev));
    return unsubscribe;
  }, [ctx]);
}
