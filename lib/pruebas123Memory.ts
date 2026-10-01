import { randomUUID } from 'crypto';
export interface Pruebas123Entry {
  id: string; content: string; created_at: string;
  thread_id?: string | null; alias?: string; verified?: boolean; badge_type?: 'trophy' | 'sparkle' | null;
}
declare global {
  // eslint-disable-next-line no-var
  var __pruebas123Entries: Pruebas123Entry[] | undefined;
}
export function listPruebas123Memory(): Pruebas123Entry[] {
  return [...(global.__pruebas123Entries ?? [])].reverse();
}
export function createPruebas123Memory(content: string, fields: Partial<Pruebas123Entry> = {}): Pruebas123Entry {
  const entry = { id: randomUUID(), content, created_at: new Date().toISOString(), ...fields };
  (global.__pruebas123Entries ??= []).push(entry);
  return entry;
}
