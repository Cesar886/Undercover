'use client';

const KEY_PREFIX = 'quemadosum:viewed';

function markOnce(key: string): boolean {
  try {
    const storageKey = `${KEY_PREFIX}:${key}`;
    if (window.localStorage.getItem(storageKey)) return false;
    window.localStorage.setItem(storageKey, new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

export function trackPostViewOnce(postId: string) {
  if (!postId || !markOnce(`post:${postId}`)) return;
  void fetch(`/api/posts/${postId}/views`, { method: 'POST', cache: 'no-store', keepalive: true }).catch(() => {});
}

export function trackCommentViewOnce(postId: string, commentId: string) {
  if (!postId || !commentId || !markOnce(`comment:${commentId}`)) return;
  void fetch(`/api/posts/${postId}/comments/${commentId}/views`, {
    method: 'POST',
    cache: 'no-store',
    keepalive: true,
  }).catch(() => {});
}
