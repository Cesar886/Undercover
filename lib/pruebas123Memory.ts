import { randomUUID } from 'crypto';

export interface Pruebas123Entry {
  id: string;
  content: string;
  created_at: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __pruebas123Entries: Pruebas123Entry[] | undefined;
}

function entries(): Pruebas123Entry[] {
  if (!global.__pruebas123Entries) global.__pruebas123Entries = [];
  return global.__pruebas123Entries;
}

export function listPruebas123Memory(): Pruebas123Entry[] {
  return [...entries()]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 100);
}

export function createPruebas123Memory(content: string): Pruebas123Entry {
  const entry = { id: randomUUID(), content, created_at: new Date().toISOString() };
  entries().push(entry);
  return entry;
}
