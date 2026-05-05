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
  created_at: string;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  anon_id: string;
  content: string;
  created_at: string;
}
