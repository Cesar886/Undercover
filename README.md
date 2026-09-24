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
| `SHARE_LINK_SECRET` | Yes | Secret used to sign temporary share links |
| `SHARE_LINK_TTL_SECONDS` | No | Link lifetime; use `60` for testing and `7200` for two hours |

## Architecture Notes

- **Anonymity:** No cookies, no sessions, no user accounts.
- **Voter tokens:** SHA-256 hash of `IP + postId + ANON_SALT`. Raw IPs never stored.
- **Temporary links:** HMAC-signed URLs expire after `SHARE_LINK_TTL_SECONDS` (60 seconds by default for testing).
- **Rate limiting:** In-memory, resets on server restart. For multi-instance, replace with Redis.
- **Auto-moderation:** Posts hidden automatically at 10 reports.
