import { EventEmitter } from 'events';
import { Comment, Notification, Post, PostPoll, ReactionCounts } from '@/types';

export type FeedEvent =
  | { type: 'post:new'; post: Post }
  | { type: 'post:vote'; postId: string; upvotes: number; downvotes: number }
  | { type: 'post:hidden'; postId: string }
  | { type: 'post:edited'; post: Post }
  | { type: 'post:reaction'; postId: string; counts: ReactionCounts }
  | { type: 'post:poll'; postId: string; poll: PostPoll }
  | {
      type: 'comment:new';
      postId: string;
      comment: Comment;
    }
  | { type: 'comment:edited'; postId: string; comment: Comment }
  | { type: 'comment:deleted'; postId: string; commentId: string; soft: boolean }
  | { type: 'notification:new'; recipient: string; notification: Notification }
  | { type: 'quema:total' };

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
