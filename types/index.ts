export type PostCategory = 'quemones' | 'infieles' | 'confesiones' | 'general';
export type VoteType = 'up' | 'down';
export type ReactionEmoji = '❤️' | '😂' | '🤯' | '🫶' | '🙃' | '🫪';
export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

export interface PollOption {
  id: string;
  label: string;
  votes: number;
  position: number;
}

export interface PostPoll {
  id: string;
  post_id: string;
  question: string;
  options: PollOption[];
  total_votes: number;
  user_vote_option_id?: string | null;
}

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
  last_bumped_at: string;
  archived: boolean;
  comment_count?: number;
  trust_score?: number;
  trust_unlocked?: boolean;
  poll?: PostPoll | null;
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
  trust_score?: number;
  trust_unlocked?: boolean;
  upvotes?: number;
  downvotes?: number;
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

export type NotificationType = 'post_like' | 'post_comment' | 'comment_reply' | 'comment_like';

export interface Notification {
  id: string;
  recipient_username: string;
  type: NotificationType;
  post_id: string;
  comment_id: string | null;
  actor_username: string | null;
  is_read: boolean;
  created_at: string;
}
