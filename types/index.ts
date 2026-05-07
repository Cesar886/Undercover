export type PostCategory = 'quemones' | 'infieles' | 'confesiones' | 'rumores';
export type VoteType = 'up' | 'down';

export interface Post {
  id: string;
  anon_id: string;
  content: string;
  category: PostCategory;
  upvotes: number;
  downvotes: number;
  report_count: number;
  is_hidden: boolean;
  image_webp: string | null;
  created_at: string;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_id?: string | null;
  anon_id: string;
  content: string;
  image_webp: string | null;
  created_at: string;
}
