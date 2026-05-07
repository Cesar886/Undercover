import { EventEmitter } from 'events';
import { Post } from '@/types';

export type FeedEvent =
  | { type: 'post:new'; post: Post }
  | { type: 'post:vote'; postId: string; upvotes: number; downvotes: number }
  | { type: 'post:hidden'; postId: string }
  | {
      type: 'comment:new';
      postId: string;
      comment: {
        id: string;
        post_id: string;
        parent_id: string | null;
        anon_id: string;
        content: string;
        created_at: string;
      };
    };

// Persistir el bus a través de hot-reload en dev, evita listeners huérfanos.
const globalForBus = globalThis as unknown as { __feedBus?: EventEmitter };
const bus = globalForBus.__feedBus ?? new EventEmitter();
bus.setMaxListeners(0);
if (process.env.NODE_ENV !== 'production') globalForBus.__feedBus = bus;

const CHANNEL = 'feed';

export function emitFeed(event: FeedEvent): void {
  bus.emit(CHANNEL, event);
}

export function subscribeFeed(handler: (event: FeedEvent) => void): () => void {
  bus.on(CHANNEL, handler);
  return () => {
    bus.off(CHANNEL, handler);
  };
}
