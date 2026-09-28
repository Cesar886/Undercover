'use client';

import { useEffect } from 'react';

export function DevServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;

    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return;

    async function cleanup() {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((name) => /next|workbox|webpack|pwa|deepum|quem/i.test(name))
            .map((name) => caches.delete(name))
        );
      }
    }

    cleanup().catch(() => {
      // Dev-only best effort cleanup; stale cache should not break rendering.
    });
  }, []);

  return null;
}
