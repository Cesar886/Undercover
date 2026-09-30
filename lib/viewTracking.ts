'use client';

import { ownerTokenHeaders } from './ownerToken';

const KEY_PREFIX = 'quemadosum:viewed';
const pending = new Set<string>();
const confirmed = new Set<string>();

function wasAlreadyViewed(key: string): boolean {
  try {
    const storageKey = `${KEY_PREFIX}:${key}`;
    return Boolean(window.localStorage.getItem(storageKey));
  } catch {
    return false;
  }
}

function rememberView(key: string) {
  try {
    window.localStorage.setItem(`${KEY_PREFIX}:${key}`, new Date().toISOString());
  } catch {
    // El contador sigue funcionando aunque el navegador bloquee localStorage.
  }
}

async function trackOnce(key: string, url: string) {
  if (pending.has(key) || confirmed.has(key) || wasAlreadyViewed(key)) return;

  pending.add(key);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: ownerTokenHeaders(),
      cache: 'no-store',
      keepalive: true,
    });
    if (response.ok) {
      confirmed.add(key);
      rememberView(key);
    }
  } catch {
    // No se marca localmente para permitir otro intento cuando vuelva a aparecer.
  } finally {
    pending.delete(key);
  }
}

export function trackPostViewOnce(postId: string) {
  if (!postId) return;
  void trackOnce(`post:${postId}`, `/api/posts/${postId}/views`);
}

// Una instancia por apertura del detalle. No comparte la marca permanente
// del feed y evita duplicados por renders, votos o efectos de Strict Mode.
export function createPostVisitTracker() {
  const pendingVisits = new Set<string>();
  const recordedVisits = new Set<string>();

  return async (postId: string) => {
    if (!postId || pendingVisits.has(postId) || recordedVisits.has(postId)) return;
    pendingVisits.add(postId);
    try {
      const response = await fetch(`/api/posts/${postId}/views`, {
        method: 'POST',
        headers: ownerTokenHeaders(),
        cache: 'no-store',
        keepalive: true,
      });
      if (response.ok) recordedVisits.add(postId);
    } catch {
      // Permitir otro intento si la petición no llegó al servidor.
    } finally {
      pendingVisits.delete(postId);
    }
  };
}

export function trackCommentViewOnce(postId: string, commentId: string) {
  if (!postId || !commentId) return;
  void trackOnce(`comment:${commentId}`, `/api/posts/${postId}/comments/${commentId}/views`);
}
