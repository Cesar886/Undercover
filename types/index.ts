export type PostCategory = 'quemones' | 'infieles' | 'confesiones' | 'general';
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
  updated_at: string | null;
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
  updated_at: string | null;
  is_deleted: boolean;
  report_count: number;
  is_hidden: boolean;
}

export type ReportReason =
  | 'spam'
  | 'inappropriate'
  | 'harassment'
  | 'misinformation'
  | 'other';

export interface ReportPayload {
  reason: ReportReason;
  detail?: string;
}
