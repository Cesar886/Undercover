'use client';
import { useState, useEffect } from 'react';
import { anonDisplayName } from '@/lib/anonDisplay';

function readAnonPub(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)anon_pub=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export function useAnonId() {
  const [anonId, setAnonId] = useState('');

  useEffect(() => {
    setAnonId(readAnonPub());
  }, []);

  return {
    anonId,
    displayName: anonId ? anonDisplayName(anonId) : 'Anónimo',
  };
}
