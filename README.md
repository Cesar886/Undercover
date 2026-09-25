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

### Image review

New uploads from posts, stickers, comments and replies are stored privately in
`image_reviews` with status `pending`. Public `image_webp` fields stay empty
until approval. Rejection discards the pending bytes; the decision and review
timestamp remain in PostgreSQL. Previously published images remain unchanged.

Open `/imagenes-dnewjlfe99474ef8wu-admin` to sign in and review the queue.
The administrator password is stored as a bcrypt hash in the server-only module
`lib/imageAdmin.ts`. Sessions use random HttpOnly cookies, expire after eight
hours and are persisted as hashes in PostgreSQL. Logout revokes the session.
The page, API and private previews are excluded from the service worker cache.

The application initializes the additive review/session tables on first use,
following the existing schema initialization pattern. They can also be created
explicitly with `sql/migrations/008_image_reviews.sql` before deploying.
No external storage service or new environment variable is required.

Run the focused checks with:

```bash
npm test -- --runInBand __tests__/api/image-moderation.test.ts __tests__/api/image-admin.test.ts __tests__/lib/image-admin-session.test.ts __tests__/lib/validation.test.ts
```

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
SHARE_LINK_SECRET=another-long-random-secret
SHARE_LINK_TTL_SECONDS=7200
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

    # Forward client IP for infrastructure logs only; never use it for identity or limits
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
| `SHARE_LINK_SECRET` | Yes | Secret used to sign temporary share links |
| `SHARE_LINK_TTL_SECONDS` | No | Link lifetime in seconds; defaults to `7200` (two hours) |

## Architecture Notes

- **Anonymous identity:** `deepum_owner_token` in localStorage, sent as `X-Owner-Token`. No IP or anonymous cookies. Clearing storage creates a new identity; quotas and sanctions are evadable. Existing optional account/admin sessions are separate.
- **Voter tokens:** SHA-256 hash of `IP + postId + ANON_SALT`. Raw IPs never stored.
- **Temporary links:** HMAC-signed URLs expire after `SHARE_LINK_TTL_SECONDS` (two hours by default).
- **Rate limiting:** Reports: 10 accepted/hour per browser ID, persisted in PostgreSQL. Other browser quotas are in memory and reset on restart. None uses IP. See `docs/community-moderation.md`.
- **Auto-moderation:** Posts hidden automatically at 10 reports.

## Public anonymity boundaries

Public posts and comments use a server-generated HMAC pseudonym scoped to the
root post ID. The same author has the same alias throughout that thread and a
different alias in another thread. `anon_id` in the public API is this pseudonym,
not the database identity. Legacy usernames are pseudonymized too. Never use a
public alias as proof of ownership: edit/delete checks remain server-side, and
clients display author controls using the server's `is_owner` flag.

`publicOwnedRow` explicitly selects public fields. IPs (including old records),
ownership tokens, account identifiers and future database columns are excluded.
Image moderation events use the same serializer; shared events omit ownership
and personal poll choices. `/api/identity?thread=<post UUID>` returns only the
requester's alias for that thread; without a thread it returns a generic label.
Public aliases depend on the existing required `ANON_SALT`; keep it secret.

This protects against linking authors by a global public identifier. It does not
make activity unlinkable to the database operator: internal identities and
ownership credentials remain for moderation and authorization. Text, images,
timing and copies already obtained can still identify people. This change does
not erase historical data, server logs, backups or permanent image archives.

Validation: `npm test -- --runInBand` and `npx tsc --noEmit`. Deploy a fresh build
so the updated frontend and PWA NetworkOnly rules take effect together.
