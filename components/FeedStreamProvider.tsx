'use client';
import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import type { FeedEvent } from '@/lib/events';

type Handler = (event: FeedEvent) => void;

interface FeedStreamContextValue {
  subscribe: (handler: Handler) => () => void;
}

const FeedStreamContext = createContext<FeedStreamContextValue | null>(null);

export function FeedStreamProvider({ children }: { children: React.ReactNode }) {
  // Set de listeners — múltiples componentes pueden suscribirse a una sola conexión.
  const listenersRef = useRef<Set<Handler>>(new Set());

  const subscribe = useCallback((handler: Handler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/stream');

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

    // Suscribir cada tipo de evento (EventSource entrega por nombre).
    const types: FeedEvent['type'][] = ['post:new', 'post:vote', 'post:hidden', 'comment:new'];
    types.forEach((t) => es.addEventListener(t, dispatch as EventListener));

    // EventSource reconecta solo. Solo cerramos en unmount.
    return () => {
      types.forEach((t) => es.removeEventListener(t, dispatch as EventListener));
      es.close();
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
