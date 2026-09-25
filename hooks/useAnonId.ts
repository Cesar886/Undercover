'use client';
import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/apiClient';
import { anonDisplayName } from '@/lib/anonDisplay';

export function useAnonId(threadId?: string) {
  const [anonId, setAnonId] = useState('');

  useEffect(() => {
    let active = true;
    setAnonId('');
    apiGet<{ anonId: string }>(threadId ? `/api/identity?thread=${encodeURIComponent(threadId)}` : '/api/identity').then(result => {
      if (active && result.ok) setAnonId(result.data.anonId);
    });
    return () => { active = false; };
  }, [threadId]);

  return {
    anonId,
    displayName: anonId ? anonDisplayName(anonId) : 'Anónimo',
  };
}
