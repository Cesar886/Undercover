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
