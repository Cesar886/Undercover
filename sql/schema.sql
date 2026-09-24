-- Bootstrap for a NEW PostgreSQL database. Incremental migrations follow this file.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username VARCHAR(30) UNIQUE NOT NULL,
 password TEXT, email TEXT UNIQUE, google_id TEXT UNIQUE,
 trust_score INT NOT NULL DEFAULT 0, trust_unlocked BOOLEAN NOT NULL DEFAULT false,
 is_suspended BOOLEAN NOT NULL DEFAULT false, suspension_end TIMESTAMPTZ,
 suspension_count INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS posts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), anon_id TEXT NOT NULL, content TEXT NOT NULL,
 category TEXT NOT NULL, image_webp TEXT, upvotes INT NOT NULL DEFAULT 0,
 downvotes INT NOT NULL DEFAULT 0, report_count INT NOT NULL DEFAULT 0,
 is_hidden BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ,
 milestone_5_rewarded BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS comments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, anon_id TEXT NOT NULL, content TEXT NOT NULL,
 image_webp TEXT, upvotes INT NOT NULL DEFAULT 0, downvotes INT NOT NULL DEFAULT 0,
 report_count INT NOT NULL DEFAULT 0, is_hidden BOOLEAN NOT NULL DEFAULT false,
 is_deleted BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS votes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 voter_token TEXT NOT NULL, vote_type TEXT NOT NULL CHECK (vote_type IN ('up','down')),
 UNIQUE(post_id, voter_token)
);
CREATE TABLE IF NOT EXISTS comment_votes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 voter_token TEXT NOT NULL, vote_type TEXT NOT NULL CHECK (vote_type IN ('up','down')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(comment_id, voter_token)
);
CREATE TABLE IF NOT EXISTS post_reactions (
 post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, voter_token TEXT NOT NULL,
 emoji TEXT NOT NULL, PRIMARY KEY(post_id, voter_token)
);
CREATE TABLE IF NOT EXISTS comment_reactions (
 comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE, voter_token TEXT NOT NULL,
 emoji TEXT NOT NULL, PRIMARY KEY(comment_id, voter_token)
);
CREATE TABLE IF NOT EXISTS reports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), target_type TEXT NOT NULL CHECK(target_type IN ('post','comment')),
 target_id UUID NOT NULL, reason TEXT NOT NULL, detail TEXT, reporter_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type,target_id);
