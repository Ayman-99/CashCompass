# Quick Deployment Steps

## On Your Server

### 1. Navigate to App Directory

```bash
cd /path/to/FinanceApp-Vue/server
```

### 2. Install Dependencies (if not done)

```bash
npm install
npm run prisma:generate
```

### 3. Set Up Environment

```bash
# Copy env.example if you don't have .env
cp env.example .env

# Edit .env with your settings
nano .env
```

**Minimum required in `.env`:**

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/finance_app"
JWT_SECRET="change-me-to-a-long-random-string"
JWT_EXPIRES_IN=30d
SESSION_SECRET="change-me-to-another-long-random-string"
PORT=9001
LOG_LEVEL=info
USE_SECURE_COOKIES=false
NODE_ENV=production
```

### 4. Test Database Connection

```bash
npm run check:db
```

### 5. Start with PM2

```bash
# Make sure you're in the server directory
cd /path/to/FinanceApp-Vue/server

# Start the backend
pm2 start ecosystem.config.js --env production

# Or from parent directory
cd /path/to/FinanceApp-Vue
pm2 start server/ecosystem.config.js --env production
```

### 6. Save PM2 Config

```bash
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

### 7. Verify It's Running

```bash
# Check status
pm2 status

# Check logs
pm2 logs finance-app-backend

# Test API
curl http://localhost:9001/api/health
```

## Nginx Configuration

Your Nginx should already be configured to proxy to `localhost:9001`. No changes needed if you're replacing the legacy app on the same port.

**Verify Nginx config:**

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Migration from Legacy (Database Already Has Data)

Since your database already has data, the migration is simple:

1. **Stop legacy app:**

   ```bash
   pm2 stop legacy-app-name
   pm2 delete legacy-app-name
   ```

2. **Start new app (uses same database):**

   ```bash
   cd /path/to/FinanceApp-Vue/server
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

3. **Verify data is accessible:**

   ```bash
   # Check logs for successful connection
   pm2 logs finance-app-backend

   # Test API (should return your existing data)
   curl http://localhost:9001/api/health
   ```

4. **Test Scriptable:** Your Scriptable shortcuts should work immediately (same API endpoints, same database)

## Useful PM2 Commands

```bash
pm2 status                    # Check status
pm2 logs finance-app-backend  # View logs
pm2 restart finance-app-backend  # Restart
pm2 stop finance-app-backend     # Stop
pm2 monit                    # Monitor resources
```

## Troubleshooting

**Backend won't start:**

- Check logs: `pm2 logs finance-app-backend`
- Verify .env file exists and has correct values
- Test DB: `cd server && npm run check:db`

**Scriptable not working:**

- Verify backend is running: `pm2 status`
- Test API: `curl http://localhost:9001/api/health`
- Check Nginx is proxying: `curl http://your-domain/api/health`
