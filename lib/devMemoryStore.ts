import { randomUUID } from 'crypto';
import type { Post, PostCategory } from '@/types';

type StoredPost = Post & { owner_token: string | null };

declare global {
  // eslint-disable-next-line no-var
  var __devMemoryPosts: StoredPost[] | undefined;
}

function posts(): StoredPost[] {
  if (!global.__devMemoryPosts) global.__devMemoryPosts = [];
  return global.__devMemoryPosts;
}

export function devMemoryEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function listDevPosts(ownerToken: string | null, category?: PostCategory | null): Post[] {
  return posts()
    .filter((post) => !post.is_hidden && !post.archived)
    .filter((post) => !category || post.category === category)
    .filter((post) => !post.owner_hidden || post.owner_token === ownerToken)
    .sort((a, b) => Date.parse(b.last_bumped_at) - Date.parse(a.last_bumped_at))
    .map(({ owner_token, ...post }) => ({
      ...post,
      is_owner: Boolean(ownerToken && owner_token === ownerToken),
    }));
}

export function createDevPost(input: {
  anonId: string;
  ownerToken: string;
  content: string;
  category: PostCategory;
  isHidden?: boolean;
  ownerHidden?: boolean;
  verified?: boolean;
  badge?: 'trophy' | 'sparkle' | null;
}): Post {
  const now = new Date().toISOString();
  const post: StoredPost = {
    id: randomUUID(),
    anon_id: input.anonId,
    content: input.content,
    verified: Boolean(input.verified),
    badge_type: input.badge ?? null,
    category: input.category,
    upvotes: 0,
    downvotes: 0,
    report_count: 0,
    is_hidden: Boolean(input.isHidden),
    owner_hidden: Boolean(input.ownerHidden),
    owner_token: input.ownerToken,
    is_owner: true,
    image_webp: null,
    created_at: now,
    updated_at: null,
    last_bumped_at: now,
    archived: false,
    comment_count: 0,
    poll: null,
  };
  posts().push(post);
  const { owner_token, ...publicPost } = post;
  return publicPost;
}
