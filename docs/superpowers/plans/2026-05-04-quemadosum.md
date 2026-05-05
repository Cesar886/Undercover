# QuemadosUM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack anonymous social platform for university students where posts appear instantly without login, featuring voting, comments, and auto-moderation.

**Architecture:** Next.js 14 App Router with API routes as the backend, PostgreSQL accessed via raw SQL (no ORM), and in-memory rate limiting per IP. The home page is a client component (manages filter/pagination state); the post detail page is a server component that queries the DB directly and uses `router.refresh()` for comment updates.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, PostgreSQL (`pg`), `date-fns`, `lucide-react`, Jest + @testing-library/react

---

## File Map

```
/home/daniel/QuemadosUm/
├── app/
│   ├── layout.tsx                        # Root layout, metadata, dark bg
│   ├── page.tsx                          # Home feed (client component)
│   ├── globals.css                       # Tailwind directives + scrollbar-hide util
│   ├── api/
│   │   ├── health/route.ts              # GET → { status: 'ok' }
│   │   └── posts/
│   │       ├── route.ts                  # GET list + POST create
│   │       └── [id]/
│   │           ├── vote/route.ts         # PATCH vote
│   │           ├── report/route.ts       # POST report
│   │           └── comments/route.ts     # GET list + POST create
│   └── posts/
│       └── [id]/page.tsx                 # Post detail (server component)
├── components/
│   ├── CategoryPill.tsx                  # Colored badge per category
│   ├── CategoryFilter.tsx                # Horizontal tab filter
│   ├── VoteButtons.tsx                   # Up/down with localStorage guard
│   ├── PostCard.tsx                      # Card: anon_id, pill, content, votes, report
│   ├── PostForm.tsx                      # New post textarea + category + submit
│   ├── CommentList.tsx                   # Renders array of Comment
│   └── CommentForm.tsx                   # Comment textarea + submit (client)
├── lib/
│   ├── db.ts                             # pg Pool + query() + withTransaction()
│   ├── sanitize.ts                       # Strip HTML tags
│   ├── hash.ts                           # SHA-256 voter token + generateAnonId
│   └── rateLimit.ts                      # In-memory 3 req/IP/hour store
├── types/
│   └── index.ts                          # Post, Comment, PostCategory, VoteType
├── sql/
│   └── schema.sql                        # DDL for posts, comments, votes
├── scripts/
│   └── migrate.ts                        # Runs schema.sql against DATABASE_URL
├── __tests__/
│   ├── lib/
│   │   ├── sanitize.test.ts
│   │   ├── hash.test.ts
│   │   └── rateLimit.test.ts
│   └── api/
│       ├── health.test.ts
│       ├── posts.test.ts
│       ├── vote.test.ts
│       ├── report.test.ts
│       └── comments.test.ts
├── .env.example
├── ecosystem.config.js                   # PM2 config
├── jest.config.js
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
└── README.md
```

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `.env.example`

- [ ] **Step 1: Bootstrap the Next.js 14 project**

Run from `/home/daniel/QuemadosUm`:
```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --no-eslint --import-alias "@/*"
```
Expected: Next.js 14 scaffolded with App Router, TypeScript, Tailwind. Accept all defaults.

- [ ] **Step 2: Install additional runtime dependencies**

```bash
npm install pg date-fns lucide-react
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev @types/pg jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-node dotenv
```

- [ ] **Step 4: Replace `jest.config.js` with this content**

```js
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
});
```

- [ ] **Step 5: Create `.env.example`**

```bash
cat > .env.example << 'EOF'
DATABASE_URL=postgresql://user:password@localhost:5432/quemadosum
ANON_SALT=change-me-to-a-long-random-string
EOF
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```
Expected: `ready - started server on 0.0.0.0:3000`. Kill with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git init && git add package.json package-lock.json next.config.js tailwind.config.js postcss.config.js tsconfig.json jest.config.js .env.example .gitignore
git commit -m "chore: initialize Next.js 14 project with Tailwind and Jest"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create `types/index.ts`**

```typescript
export type PostCategory = 'chisme' | 'opinion' | 'queja' | 'confesion' | 'pregunta';
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
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: SQL Schema

**Files:**
- Create: `sql/schema.sql`

- [ ] **Step 1: Create `sql/schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE post_category AS ENUM ('chisme', 'opinion', 'queja', 'confesion', 'pregunta');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE vote_type AS ENUM ('up', 'down');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anon_id VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  category post_category NOT NULL,
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  report_count INT NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  anon_id VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  voter_token VARCHAR(64) NOT NULL,
  vote_type vote_type NOT NULL,
  UNIQUE(post_id, voter_token)
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
```

- [ ] **Step 2: Commit**

```bash
git add sql/schema.sql
git commit -m "feat: add PostgreSQL schema DDL"
```

---

## Task 4: Migration Script

**Files:**
- Create: `scripts/migrate.ts`

- [ ] **Step 1: Create `scripts/migrate.ts`**

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config();

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = readFileSync(join(process.cwd(), 'sql', 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Migration complete');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Add migrate script to `package.json`**

Add inside `"scripts"`:
```json
"migrate": "ts-node --project tsconfig.json -e \"require('dotenv').config()\" scripts/migrate.ts"
```

Full scripts block:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "jest",
  "test:watch": "jest --watch",
  "migrate": "ts-node scripts/migrate.ts"
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate.ts package.json
git commit -m "feat: add database migration script"
```

---

## Task 5: Database Connection Library

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: Create `lib/db.ts`**

```typescript
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add PostgreSQL connection pool with transaction helper"
```

---

## Task 6: Sanitize Utility

**Files:**
- Create: `lib/sanitize.ts`
- Create: `__tests__/lib/sanitize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/sanitize.test.ts
import { sanitize } from '@/lib/sanitize';

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>hello')).toBe('hello');
  });
  it('strips nested tags', () => {
    expect(sanitize('<b><i>bold italic</i></b>')).toBe('bold italic');
  });
  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });
  it('passes through plain text', () => {
    expect(sanitize('hello world')).toBe('hello world');
  });
  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });
  it('strips HTML attributes', () => {
    expect(sanitize('<a href="evil.com">click</a>')).toBe('click');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/sanitize.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/sanitize'`

- [ ] **Step 3: Implement `lib/sanitize.ts`**

```typescript
export function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/sanitize.test.ts --no-coverage
```
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sanitize.ts __tests__/lib/sanitize.test.ts
git commit -m "feat: add HTML sanitizer utility"
```

---

## Task 7: Hash Utility

**Files:**
- Create: `lib/hash.ts`
- Create: `__tests__/lib/hash.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/hash.test.ts
import { hashVoterToken, generateAnonId } from '@/lib/hash';

describe('hashVoterToken', () => {
  it('returns a 64-character hex string', () => {
    const token = hashVoterToken('127.0.0.1', 'post-id-123', 'salt-value');
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });
  it('returns different hashes for different post IDs', () => {
    const a = hashVoterToken('127.0.0.1', 'post-1', 'salt');
    const b = hashVoterToken('127.0.0.1', 'post-2', 'salt');
    expect(a).not.toBe(b);
  });
  it('returns same hash for identical inputs (deterministic)', () => {
    const a = hashVoterToken('127.0.0.1', 'post-1', 'salt');
    const b = hashVoterToken('127.0.0.1', 'post-1', 'salt');
    expect(a).toBe(b);
  });
  it('returns different hashes for different IPs', () => {
    const a = hashVoterToken('192.168.1.1', 'post-1', 'salt');
    const b = hashVoterToken('10.0.0.1', 'post-1', 'salt');
    expect(a).not.toBe(b);
  });
});

describe('generateAnonId', () => {
  it('matches the "Anónimo #XXXX" pattern', () => {
    const id = generateAnonId();
    expect(id).toMatch(/^Anónimo #\d{4}$/);
  });
  it('generates IDs within 1000-9999 range', () => {
    for (let i = 0; i < 20; i++) {
      const id = generateAnonId();
      const num = parseInt(id.replace('Anónimo #', ''), 10);
      expect(num).toBeGreaterThanOrEqual(1000);
      expect(num).toBeLessThanOrEqual(9999);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/hash.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/hash'`

- [ ] **Step 3: Implement `lib/hash.ts`**

```typescript
import crypto from 'crypto';

export function hashVoterToken(ip: string, postId: string, salt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}:${postId}:${salt}`)
    .digest('hex');
}

export function generateAnonId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `Anónimo #${num}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/hash.test.ts --no-coverage
```
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/hash.ts __tests__/lib/hash.test.ts
git commit -m "feat: add SHA-256 voter token hashing and anon ID generator"
```

---

## Task 8: Rate Limit Utility

**Files:**
- Create: `lib/rateLimit.ts`
- Create: `__tests__/lib/rateLimit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/rateLimit.test.ts
import { checkRateLimit, _resetForTesting } from '@/lib/rateLimit';

beforeEach(() => _resetForTesting());

describe('checkRateLimit', () => {
  it('allows first 3 requests from same IP', () => {
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    expect(checkRateLimit('1.2.3.4')).toBe(true);
  });
  it('blocks 4th request from same IP', () => {
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4')).toBe(false);
  });
  it('allows different IPs independently', () => {
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('5.6.7.8')).toBe(true);
  });
  it('resets after the time window', () => {
    jest.useFakeTimers();
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    checkRateLimit('1.2.3.4');
    expect(checkRateLimit('1.2.3.4')).toBe(false);
    jest.advanceTimersByTime(61 * 60 * 1000); // 61 minutes
    expect(checkRateLimit('1.2.3.4')).toBe(true);
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/rateLimit.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/lib/rateLimit'`

- [ ] **Step 3: Implement `lib/rateLimit.ts`**

```typescript
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 3;

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) return false;

  entry.count++;
  return true;
}

export function _resetForTesting() {
  store.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/rateLimit.test.ts --no-coverage
```
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/rateLimit.ts __tests__/lib/rateLimit.test.ts
git commit -m "feat: add in-memory IP rate limiter (3 posts/hour)"
```

---

## Task 9: Health API Route

**Files:**
- Create: `app/api/health/route.ts`
- Create: `__tests__/api/health.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/health.test.ts
import { GET } from '@/app/api/health/route';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
  });
  it('includes a timestamp', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    const body = await res.json();
    expect(typeof body.timestamp).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/health.test.ts --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/api/health/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/health.test.ts --no-coverage
```
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/health/route.ts __tests__/api/health.test.ts
git commit -m "feat: add /api/health endpoint"
```

---

## Task 10: Posts API Route (GET list + POST create)

**Files:**
- Create: `app/api/posts/route.ts`
- Create: `__tests__/api/posts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/posts.test.ts
jest.mock('@/lib/db', () => ({ query: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ checkRateLimit: jest.fn().mockReturnValue(true) }));

import { GET, POST } from '@/app/api/posts/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';

const mockQuery = query as jest.Mock;
const mockRateLimit = checkRateLimit as jest.Mock;

describe('GET /api/posts', () => {
  it('returns posts array', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'abc', content: 'test' }] });
    const req = new NextRequest('http://localhost/api/posts');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toHaveLength(1);
  });

  it('filters by category when provided', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const req = new NextRequest('http://localhost/api/posts?category=chisme&page=2');
    await GET(req);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('$1');
    expect(params).toContain('chisme');
    expect(params).toContain(10); // offset for page 2
  });
});

describe('POST /api/posts', () => {
  it('returns 400 for empty content', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '', category: 'opinion' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid category', async () => {
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'invalid' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockRateLimit.mockReturnValueOnce(false);
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'opinion' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 201 and created post on success', async () => {
    const fakePost = { id: 'uuid', anon_id: 'Anónimo #1234', content: 'hello', category: 'opinion' };
    mockQuery.mockResolvedValue({ rows: [fakePost] });
    const req = new NextRequest('http://localhost/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello', category: 'opinion' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.post.id).toBe('uuid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/posts.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '@/app/api/posts/route'`

- [ ] **Step 3: Implement `app/api/posts/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';
import { generateAnonId } from '@/lib/hash';
import { checkRateLimit } from '@/lib/rateLimit';
import { PostCategory } from '@/types';

const VALID_CATEGORIES: PostCategory[] = ['chisme', 'opinion', 'queja', 'confesion', 'pregunta'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') as PostCategory | null;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;
  const offset = (page - 1) * limit;

  const params: unknown[] = [];
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)::int AS comment_count
    FROM posts p
    WHERE p.is_hidden = false
  `;

  if (category && VALID_CATEGORIES.includes(category)) {
    params.push(category);
    sql += ` AND p.category = $${params.length}`;
  }

  sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return NextResponse.json({ posts: result.rows, page, limit });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiados posts. Intenta más tarde.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const content = sanitize(body.content ?? '');
  const category: PostCategory = body.category;

  if (!content || content.length > 500) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }

  const anonId = generateAnonId();
  const result = await query(
    `INSERT INTO posts (anon_id, content, category) VALUES ($1, $2, $3) RETURNING *`,
    [anonId, content, category]
  );

  return NextResponse.json({ post: result.rows[0] }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/posts.test.ts --no-coverage
```
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/posts/route.ts __tests__/api/posts.test.ts
git commit -m "feat: add GET /api/posts and POST /api/posts routes"
```

---

## Task 11: Vote API Route

**Files:**
- Create: `app/api/posts/[id]/vote/route.ts`
- Create: `__tests__/api/vote.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/vote.test.ts
jest.mock('@/lib/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

import { PATCH } from '@/app/api/posts/[id]/vote/route';
import { NextRequest } from 'next/server';
import { query, withTransaction } from '@/lib/db';

const mockQuery = query as jest.Mock;
const mockTx = withTransaction as jest.Mock;

describe('PATCH /api/posts/[id]/vote', () => {
  const params = { id: 'post-uuid-123' };

  it('returns 400 for invalid vote_type', async () => {
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'sideways' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 409 when voter has already voted', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'existing-vote' }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(409);
  });

  it('returns 200 with updated vote counts on success', async () => {
    mockQuery.mockResolvedValue({ rows: [] }); // no existing vote
    mockTx.mockResolvedValue({ upvotes: 5, downvotes: 1 });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/vote', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote_type: 'up' }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.votes.upvotes).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/vote.test.ts --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create directory and implement route**

```bash
mkdir -p app/api/posts/\[id\]/vote
```

```typescript
// app/api/posts/[id]/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { hashVoterToken } from '@/lib/hash';
import { VoteType } from '@/types';
import { PoolClient } from 'pg';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const postId = params.id;
  const body = await request.json();
  const voteType: VoteType = body.vote_type;

  if (voteType !== 'up' && voteType !== 'down') {
    return NextResponse.json({ error: 'Tipo de voto inválido' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const salt = process.env.ANON_SALT ?? 'default-salt';
  const voterToken = hashVoterToken(ip, postId, salt);

  const existingVote = await query(
    'SELECT id FROM votes WHERE post_id = $1 AND voter_token = $2',
    [postId, voterToken]
  );

  if (existingVote.rows.length > 0) {
    return NextResponse.json({ error: 'Ya votaste en este post' }, { status: 409 });
  }

  // col is safe: derived from validated enum 'up' | 'down', never from raw user input
  const col = voteType === 'up' ? 'upvotes' : 'downvotes';
  const votes = await withTransaction(async (client: PoolClient) => {
    await client.query(
      'INSERT INTO votes (post_id, voter_token, vote_type) VALUES ($1, $2, $3)',
      [postId, voterToken, voteType]
    );
    const res = await client.query(
      `UPDATE posts SET ${col} = ${col} + 1 WHERE id = $1 RETURNING upvotes, downvotes`,
      [postId]
    );
    return res.rows[0];
  });

  return NextResponse.json({ votes });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/vote.test.ts --no-coverage
```
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/api/posts/[id]/vote/route.ts" __tests__/api/vote.test.ts
git commit -m "feat: add PATCH /api/posts/[id]/vote with duplicate vote prevention"
```

---

## Task 12: Report API Route

**Files:**
- Create: `app/api/posts/[id]/report/route.ts`
- Create: `__tests__/api/report.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/report.test.ts
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { POST } from '@/app/api/posts/[id]/report/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;

describe('POST /api/posts/[id]/report', () => {
  const params = { id: 'post-uuid-123' };

  it('returns 404 when post does not exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/report', {
      method: 'POST',
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated report count', async () => {
    mockQuery.mockResolvedValue({ rows: [{ report_count: 3, is_hidden: false }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/report', {
      method: 'POST',
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report_count).toBe(3);
  });

  it('sets is_hidden when report_count reaches 10', async () => {
    mockQuery.mockResolvedValue({ rows: [{ report_count: 10, is_hidden: true }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/report', {
      method: 'POST',
    });
    const res = await POST(req, { params });
    const body = await res.json();
    expect(body.is_hidden).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/report.test.ts --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create directory and implement route**

```bash
mkdir -p app/api/posts/\[id\]/report
```

```typescript
// app/api/posts/[id]/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await query(
    `UPDATE posts
     SET report_count = report_count + 1,
         is_hidden = CASE WHEN report_count + 1 >= 10 THEN true ELSE is_hidden END
     WHERE id = $1
     RETURNING report_count, is_hidden`,
    [params.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...result.rows[0] });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/report.test.ts --no-coverage
```
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/api/posts/[id]/report/route.ts" __tests__/api/report.test.ts
git commit -m "feat: add POST /api/posts/[id]/report with auto-hide at 10 reports"
```

---

## Task 13: Comments API Route

**Files:**
- Create: `app/api/posts/[id]/comments/route.ts`
- Create: `__tests__/api/comments.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/api/comments.test.ts
jest.mock('@/lib/db', () => ({ query: jest.fn() }));

import { GET, POST } from '@/app/api/posts/[id]/comments/route';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

const mockQuery = query as jest.Mock;

describe('GET /api/posts/[id]/comments', () => {
  const params = { id: 'post-uuid-123' };

  it('returns comments array', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'c1', content: 'nice' }] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments');
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comments).toHaveLength(1);
  });
});

describe('POST /api/posts/[id]/comments', () => {
  const params = { id: 'post-uuid-123' };

  it('returns 400 for empty content', async () => {
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 300 chars', async () => {
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'a'.repeat(301) }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it('returns 201 with the new comment', async () => {
    const fakeComment = { id: 'c1', post_id: 'post-uuid-123', anon_id: 'Anónimo #5555', content: 'hello' };
    mockQuery.mockResolvedValue({ rows: [fakeComment] });
    const req = new NextRequest('http://localhost/api/posts/post-uuid-123/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'hello' }),
    });
    const res = await POST(req, { params });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.comment.content).toBe('hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/comments.test.ts --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create directory and implement route**

```bash
mkdir -p app/api/posts/\[id\]/comments
```

```typescript
// app/api/posts/[id]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitize } from '@/lib/sanitize';
import { generateAnonId } from '@/lib/hash';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const result = await query(
    'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC',
    [params.id]
  );
  return NextResponse.json({ comments: result.rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const content = sanitize(body.content ?? '');

  if (!content || content.length > 300) {
    return NextResponse.json({ error: 'Contenido inválido' }, { status: 400 });
  }

  const anonId = generateAnonId();
  const result = await query(
    'INSERT INTO comments (post_id, anon_id, content) VALUES ($1, $2, $3) RETURNING *',
    [params.id, anonId, content]
  );

  return NextResponse.json({ comment: result.rows[0] }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/comments.test.ts --no-coverage
```
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx jest --no-coverage
```
Expected: all tests pass across all files.

- [ ] **Step 6: Commit**

```bash
git add "app/api/posts/[id]/comments/route.ts" __tests__/api/comments.test.ts
git commit -m "feat: add GET/POST /api/posts/[id]/comments routes"
```

---

## Task 14: Root Layout + Global Styles

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QuemadosUM',
  description: 'La voz anónima de la universidad',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: configure dark root layout and global styles"
```

---

## Task 15: CategoryPill Component

**Files:**
- Create: `components/CategoryPill.tsx`
- Create: `__tests__/components/CategoryPill.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/components/CategoryPill.test.tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryPill } from '@/components/CategoryPill';

describe('CategoryPill', () => {
  it('renders the Spanish label for chisme', () => {
    render(<CategoryPill category="chisme" />);
    expect(screen.getByText('Chisme')).toBeInTheDocument();
  });
  it('renders the Spanish label for opinion', () => {
    render(<CategoryPill category="opinion" />);
    expect(screen.getByText('Opinión')).toBeInTheDocument();
  });
  it('renders the Spanish label for queja', () => {
    render(<CategoryPill category="queja" />);
    expect(screen.getByText('Queja')).toBeInTheDocument();
  });
  it('renders the Spanish label for confesion', () => {
    render(<CategoryPill category="confesion" />);
    expect(screen.getByText('Confesión')).toBeInTheDocument();
  });
  it('renders the Spanish label for pregunta', () => {
    render(<CategoryPill category="pregunta" />);
    expect(screen.getByText('Pregunta')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/components/CategoryPill.test.tsx --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/CategoryPill.tsx`**

```typescript
import { PostCategory } from '@/types';

const config: Record<PostCategory, { label: string; className: string }> = {
  chisme:   { label: 'Chisme',    className: 'bg-pink-900/60 text-pink-300 border border-pink-800' },
  opinion:  { label: 'Opinión',   className: 'bg-blue-900/60 text-blue-300 border border-blue-800' },
  queja:    { label: 'Queja',     className: 'bg-red-900/60 text-red-300 border border-red-800' },
  confesion:{ label: 'Confesión', className: 'bg-purple-900/60 text-purple-300 border border-purple-800' },
  pregunta: { label: 'Pregunta',  className: 'bg-amber-900/60 text-amber-300 border border-amber-800' },
};

export function CategoryPill({ category }: { category: PostCategory }) {
  const { label, className } = config[category];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/components/CategoryPill.test.tsx --no-coverage
```
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/CategoryPill.tsx "__tests__/components/CategoryPill.test.tsx"
git commit -m "feat: add CategoryPill component with per-category colors"
```

---

## Task 16: CategoryFilter Component

**Files:**
- Create: `components/CategoryFilter.tsx`

- [ ] **Step 1: Create `components/CategoryFilter.tsx`**

```typescript
'use client';
import { PostCategory } from '@/types';

const FILTERS: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todo' },
  { value: 'chisme',    label: 'Chisme' },
  { value: 'opinion',   label: 'Opinión' },
  { value: 'queja',     label: 'Queja' },
  { value: 'confesion', label: 'Confesión' },
  { value: 'pregunta',  label: 'Pregunta' },
];

interface CategoryFilterProps {
  active: PostCategory | 'all';
  onChange: (value: PostCategory | 'all') => void;
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full transition-colors ${
            active === f.value
              ? 'bg-[#D85A30] text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/CategoryFilter.tsx
git commit -m "feat: add CategoryFilter tab component"
```

---

## Task 17: VoteButtons Component

**Files:**
- Create: `components/VoteButtons.tsx`

- [ ] **Step 1: Create `components/VoteButtons.tsx`**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
}

export function VoteButtons({ postId, upvotes, downvotes }: VoteButtonsProps) {
  const [counts, setCounts] = useState({ upvotes, downvotes });
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('voted_posts') ?? '[]');
      setVoted(stored.includes(postId));
    } catch {
      // localStorage unavailable (SSR or private mode)
    }
  }, [postId]);

  async function handleVote(voteType: 'up' | 'down') {
    if (voted) return;
    try {
      const res = await fetch(`/api/posts/${postId}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data.votes);
        const stored: string[] = JSON.parse(localStorage.getItem('voted_posts') ?? '[]');
        localStorage.setItem('voted_posts', JSON.stringify([...stored, postId]));
        setVoted(true);
      }
    } catch {
      // network error — silently fail
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => handleVote('up')}
        disabled={voted}
        className={`flex items-center gap-1 text-sm transition-colors ${
          voted ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-[#D85A30]'
        }`}
        aria-label="Upvote"
      >
        <ThumbsUp size={14} />
        <span>{counts.upvotes}</span>
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={voted}
        className={`flex items-center gap-1 text-sm transition-colors ${
          voted ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-blue-400'
        }`}
        aria-label="Downvote"
      >
        <ThumbsDown size={14} />
        <span>{counts.downvotes}</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/VoteButtons.tsx
git commit -m "feat: add VoteButtons component with localStorage duplicate-vote guard"
```

---

## Task 18: PostCard Component

**Files:**
- Create: `components/PostCard.tsx`

- [ ] **Step 1: Create `components/PostCard.tsx`**

```typescript
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Flag, MessageCircle } from 'lucide-react';
import { Post } from '@/types';
import { CategoryPill } from './CategoryPill';
import { VoteButtons } from './VoteButtons';

interface PostCardProps {
  post: Post;
  onReport: (id: string) => void;
}

export function PostCard({ post, onReport }: PostCardProps) {
  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-xs">{post.anon_id}</span>
          <CategoryPill category={post.category} />
        </div>
        <span className="text-zinc-700 text-xs">{timeAgo}</span>
      </div>

      <Link href={`/posts/${post.id}`}>
        <p className="text-zinc-100 text-sm leading-relaxed break-words">{post.content}</p>
      </Link>

      <div className="flex items-center justify-between pt-1">
        <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
        <div className="flex items-center gap-3">
          <Link
            href={`/posts/${post.id}`}
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
          >
            <MessageCircle size={13} />
            <span>{post.comment_count ?? 0}</span>
          </Link>
          <button
            onClick={() => onReport(post.id)}
            className="text-zinc-600 hover:text-red-400 transition-colors"
            title="Reportar"
            aria-label="Reportar post"
          >
            <Flag size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PostCard.tsx
git commit -m "feat: add PostCard component"
```

---

## Task 19: PostForm Component

**Files:**
- Create: `components/PostForm.tsx`

- [ ] **Step 1: Create `components/PostForm.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { PostCategory } from '@/types';

const CATEGORIES: { value: PostCategory; label: string }[] = [
  { value: 'chisme',    label: '🗣️ Chisme' },
  { value: 'opinion',   label: '💭 Opinión' },
  { value: 'queja',     label: '😤 Queja' },
  { value: 'confesion', label: '🤫 Confesión' },
  { value: 'pregunta',  label: '❓ Pregunta' },
];

const MAX_CHARS = 500;

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('opinion');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al publicar');
        return;
      }
      setContent('');
      onPostCreated();
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  const remaining = MAX_CHARS - content.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="¿Qué está pasando en la U? 🔥"
        rows={3}
        className="w-full bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#D85A30]"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remaining < 50 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {remaining} restantes
        </span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PostCategory)}
          className="flex-1 bg-zinc-800 text-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D85A30]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-[#D85A30] hover:bg-[#C04A20] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          {loading ? 'Publicando...' : 'Soltar 🔥'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/PostForm.tsx
git commit -m "feat: add PostForm component with character counter and category selector"
```

---

## Task 20: CommentList + CommentForm Components

**Files:**
- Create: `components/CommentList.tsx`
- Create: `components/CommentForm.tsx`

- [ ] **Step 1: Create `components/CommentList.tsx`**

```typescript
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Comment } from '@/types';

export function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) {
    return (
      <p className="text-zinc-600 text-sm text-center py-6">
        Sin comentarios aún. Sé el primero.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-zinc-500 text-xs font-medium uppercase tracking-wide">
        {comments.length} comentario{comments.length !== 1 ? 's' : ''}
      </h2>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">{comment.anon_id}</span>
            <span className="text-zinc-700 text-xs">
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed break-words">{comment.content}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/CommentForm.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_CHARS = 300;

export function CommentForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al comentar');
        return;
      }
      setContent('');
      router.refresh(); // re-fetches server component with new comment
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
        placeholder="Añade un comentario anónimo..."
        rows={2}
        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#D85A30]"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${MAX_CHARS - content.length < 30 ? 'text-amber-400' : 'text-zinc-600'}`}>
          {MAX_CHARS - content.length} restantes
        </span>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-[#D85A30] hover:bg-[#C04A20] disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          {loading ? 'Enviando...' : 'Comentar'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/CommentList.tsx components/CommentForm.tsx
git commit -m "feat: add CommentList and CommentForm components"
```

---

## Task 21: Home Page (Feed)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```typescript
'use client';
import { useState, useCallback, useEffect } from 'react';
import { PostForm } from '@/components/PostForm';
import { PostCard } from '@/components/PostCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import { Post, PostCategory } from '@/types';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState<PostCategory | 'all'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchPosts = useCallback(
    async (cat: PostCategory | 'all', pg: number, replace: boolean) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ page: String(pg) });
        if (cat !== 'all') qs.set('category', cat);
        const res = await fetch(`/api/posts?${qs}`);
        const data = await res.json();
        setPosts((prev) => (replace ? data.posts : [...prev, ...data.posts]));
        setHasMore(data.posts.length === 10);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    fetchPosts(category, 1, true);
  }, [category, fetchPosts]);

  function handleCategoryChange(val: PostCategory | 'all') {
    setCategory(val);
  }

  function handlePostCreated() {
    setPage(1);
    fetchPosts(category, 1, true);
  }

  async function handleReport(postId: string) {
    await fetch(`/api/posts/${postId}/report`, { method: 'POST' });
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchPosts(category, next, false);
  }

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          <span className="text-[#D85A30]">Quemados</span>UM
        </h1>
        <p className="text-zinc-500 text-xs mt-1">La voz anónima de la universidad</p>
      </header>

      <PostForm onPostCreated={handlePostCreated} />
      <CategoryFilter active={category} onChange={handleCategoryChange} />

      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onReport={handleReport} />
        ))}
        {!loading && posts.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">
            No hay posts todavía. ¡Sé el primero en quemar! 🔥
          </p>
        )}
      </div>

      {hasMore && !loading && posts.length > 0 && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          Cargar más...
        </button>
      )}
      {loading && (
        <p className="text-center text-zinc-600 text-sm py-4">Cargando...</p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify dev server renders the page**

```bash
npm run dev
```
Open http://localhost:3000. Expected: dark page with "QuemadosUM" header, post form, and empty feed message. Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: implement home feed with pagination and category filtering"
```

---

## Task 22: Post Detail Page

**Files:**
- Create: `app/posts/[id]/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "app/posts/[id]"
```

- [ ] **Step 2: Create `app/posts/[id]/page.tsx`**

```typescript
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { query } from '@/lib/db';
import { Post, Comment } from '@/types';
import { CategoryPill } from '@/components/CategoryPill';
import { VoteButtons } from '@/components/VoteButtons';
import { CommentList } from '@/components/CommentList';
import { CommentForm } from '@/components/CommentForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export default async function PostPage({ params }: Props) {
  const [postResult, commentsResult] = await Promise.all([
    query('SELECT * FROM posts WHERE id = $1 AND is_hidden = false', [params.id]),
    query('SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC', [params.id]),
  ]);

  if (postResult.rows.length === 0) notFound();

  const post: Post = postResult.rows[0];
  const comments: Comment[] = commentsResult.rows;

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <main className="max-w-[600px] mx-auto px-4 py-6 space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
      >
        <ArrowLeft size={15} />
        Volver al feed
      </Link>

      <article className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">{post.anon_id}</span>
            <CategoryPill category={post.category} />
          </div>
          <span className="text-zinc-700 text-xs">{timeAgo}</span>
        </div>
        <p className="text-zinc-100 leading-relaxed break-words">{post.content}</p>
        <VoteButtons postId={post.id} upvotes={post.upvotes} downvotes={post.downvotes} />
      </article>

      <section className="space-y-4">
        <CommentForm postId={post.id} />
        <CommentList comments={comments} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Verify dev server renders post detail**

```bash
npm run dev
```
Create a post via the home page, click it, and verify the detail page loads with the CommentForm. Kill with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add "app/posts/[id]/page.tsx"
git commit -m "feat: add post detail page with server-rendered comments"
```

---

## Task 23: Deployment Config + README

**Files:**
- Create: `ecosystem.config.js`
- Create: `README.md`

- [ ] **Step 1: Create `ecosystem.config.js`**

```javascript
module.exports = {
  apps: [
    {
      name: 'quemadosum',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

- [ ] **Step 2: Create `README.md`**

````markdown
# QuemadosUM

Anonymous social platform for university students.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- PM2 (`npm install -g pm2`)
- Apache with `mod_proxy` and `mod_headers` enabled

## Local Development

```bash
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and ANON_SALT

npm install
npm run migrate   # Creates tables in your PostgreSQL database
npm run dev       # http://localhost:3000
```

## Running Tests

```bash
npm test
```

## Production Setup (VPS)

### 1. Install dependencies and build

```bash
npm ci
npm run build
```

### 2. Set environment variables

Create `/etc/quemadosum.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/quemadosum
ANON_SALT=your-very-long-random-secret-string
NODE_ENV=production
PORT=3000
```

### 3. Run migrations

```bash
DATABASE_URL=... npm run migrate
```

### 4. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the printed command to auto-start on reboot
```

### 5. Apache Virtual Host

Enable required modules:
```bash
sudo a2enmod proxy proxy_http headers
sudo systemctl restart apache2
```

Create `/etc/apache2/sites-available/quemadosum.conf`:
```apache
<VirtualHost *:80>
    ServerName yourdomain.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # Forward real client IP for rate limiting
    RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"

    ErrorLog ${APACHE_LOG_DIR}/quemadosum-error.log
    CustomLog ${APACHE_LOG_DIR}/quemadosum-access.log combined
</VirtualHost>
```

```bash
sudo a2ensite quemadosum
sudo systemctl reload apache2
```

### 6. HTTPS (recommended)

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com
```

## Environment Variables

| Variable       | Required | Description                                   |
|----------------|----------|-----------------------------------------------|
| `DATABASE_URL` | Yes      | PostgreSQL connection string                  |
| `ANON_SALT`    | Yes      | Secret for SHA-256 voter token (min 32 chars) |

## Architecture Notes

- **Anonymity:** No cookies, no sessions, no user accounts.
- **Voter tokens:** SHA-256 hash of `IP + postId + ANON_SALT`. Raw IPs never stored.
- **Rate limiting:** In-memory, resets on server restart. For multi-instance, replace with Redis.
- **Auto-moderation:** Posts hidden automatically at 10 reports.
````

- [ ] **Step 3: Run full test suite one final time**

```bash
npx jest --no-coverage
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add ecosystem.config.js README.md
git commit -m "chore: add PM2 config and deployment README with Apache reverse proxy setup"
```

---

## Self-Review: Spec Coverage Check

| Spec Requirement | Covered In |
|---|---|
| posts schema (id, anon_id, content, category, upvotes, downvotes, report_count, is_hidden, created_at) | Task 3 |
| comments schema | Task 3 |
| votes schema with UNIQUE constraint | Task 3 |
| Feed ordered by created_at DESC | Task 10 (GET /api/posts) |
| Filter by category | Task 10 |
| 10 posts per page pagination | Task 10 |
| Post card: anon_id, pill, content, timeago, votes, comment count | Task 18 |
| Post creation textarea (500 char) + counter | Task 19 |
| Category selector dropdown | Task 19 |
| "Soltar 🔥" button | Task 19 |
| No login required, server-generated anon_id | Task 7, 10, 13 |
| Rate limit 3 posts/IP/hour | Task 8, 10 |
| Upvote/downvote with localStorage prevention | Task 17 |
| PATCH /api/posts/[id]/vote | Task 11 |
| Post detail page with comments | Task 22 |
| Comment textarea (300 char) + submit | Task 20 |
| Report button (flag icon) | Task 18 |
| POST /api/posts/[id]/report | Task 12 |
| Auto-hide at report_count >= 10 | Task 12 |
| GET /api/posts/[id]/comments | Task 13 |
| POST /api/posts/[id]/comments | Task 13 |
| Dark UI, max-width 600px centered | Task 14, 21 |
| Coral/orange (#D85A30) accent | All components |
| Category pills distinct colors | Task 15 |
| "Anónimo #XXXX" in muted gray | Task 18 |
| No raw IP stored in DB | Task 11 (voter_token is hash) |
| SHA-256 voter token | Task 7, 11 |
| No cookies/sessions/accounts | Architecture — never introduced |
| DATABASE_URL env var | Task 1, 5 |
| ANON_SALT env var | Task 1, 11 |
| HTML sanitization | Task 6, 10, 13 |
| .env.example | Task 1 |
| /api/health endpoint | Task 9 |
| README with setup + Apache config | Task 23 |
| PM2 ecosystem config | Task 23 |
| Mobile-first, max-width 600px | Task 21 (max-w-[600px]) |
| Infinite scroll / pagination (10/page) | Task 21 (load more button) |
