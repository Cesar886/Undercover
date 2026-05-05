import { Post, PostCategory } from '@/types';

const POSTS_KEY = 'local_posts';
const ANON_KEY  = 'local_anon_id';

export function getAnonId(): string {
  try {
    const stored = localStorage.getItem(ANON_KEY);
    if (stored) return stored;
    const id = `Anónimo #${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(ANON_KEY, id);
    return id;
  } catch {
    return 'Anónimo';
  }
}

export function getAllPosts(): Post[] {
  try {
    return JSON.parse(localStorage.getItem(POSTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function getPost(id: string): Post | null {
  return getAllPosts().find((p) => p.id === id && !p.is_hidden) ?? null;
}

export function createPost(content: string, category: PostCategory): Post {
  const post: Post = {
    id: crypto.randomUUID(),
    anon_id: getAnonId(),
    content,
    category,
    upvotes: 0,
    downvotes: 0,
    report_count: 0,
    is_hidden: false,
    created_at: new Date().toISOString(),
    comment_count: 0,
  };
  const posts = getAllPosts();
  localStorage.setItem(POSTS_KEY, JSON.stringify([post, ...posts]));
  return post;
}

export function castVote(postId: string, type: 'up' | 'down'): { upvotes: number; downvotes: number } {
  const posts = getAllPosts();
  let upvotes = 0;
  let downvotes = 0;
  const updated = posts.map((p) => {
    if (p.id !== postId) return p;
    upvotes   = p.upvotes   + (type === 'up'   ? 1 : 0);
    downvotes = p.downvotes + (type === 'down'  ? 1 : 0);
    return { ...p, upvotes, downvotes };
  });
  localStorage.setItem(POSTS_KEY, JSON.stringify(updated));
  return { upvotes, downvotes };
}

export function hidePost(postId: string): void {
  const posts = getAllPosts().map((p) =>
    p.id === postId ? { ...p, is_hidden: true } : p
  );
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

export function queryPosts(opts: {
  category?: PostCategory | 'all';
  sort?: string;
  q?: string;
  page?: number;
}): { posts: Post[]; hasMore: boolean } {
  const { category = 'all', sort = 'recent', q = '', page = 1 } = opts;
  const limit = 10;

  let list = getAllPosts().filter((p) => !p.is_hidden);

  if (q) {
    const lower = q.toLowerCase();
    list = list.filter((p) => p.content.toLowerCase().includes(lower));
  }

  if (category !== 'all') {
    list = list.filter((p) => p.category === category);
  }

  if (sort === 'top') {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    list = list.filter((p) => new Date(p.created_at).getTime() > cutoff);
    list.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes));
  } else if (sort === 'hot') {
    list.sort((a, b) => (b.upvotes + b.downvotes) - (a.upvotes + a.downvotes));
  } else {
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const start = (page - 1) * limit;
  const slice = list.slice(start, start + limit);
  return { posts: slice, hasMore: slice.length === limit };
}
