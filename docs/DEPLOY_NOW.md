# Deploy Now - Database Already Ready

Since your database already has data, here's the fastest way to deploy:

## Quick Steps

```bash
# 1. Navigate to server directory
cd /path/to/FinanceApp-Vue/server

# 2. Create .env file with your settings
cat > .env << 'EOF'
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/finance_app"
JWT_SECRET="change-me-to-a-long-random-string"
JWT_EXPIRES_IN=30d
SESSION_SECRET="change-me-to-another-long-random-string"
PORT=9001
LOG_LEVEL=info
USE_SECURE_COOKIES=false
NODE_ENV=production
EOF

# 3. Install dependencies (if not done)
npm install

# 4. Generate Prisma client (required)
npm run prisma:generate

# 5. Test database connection (should show your existing data)
npm run check:db

# 6. Stop legacy app (if running)
pm2 stop legacy-app-name
pm2 delete legacy-app-name

# 7. Start new backend
pm2 start ecosystem.config.js --env production

# 8. Save PM2 config
pm2 save

# 9. Verify it's running
pm2 status
pm2 logs finance-app-backend --lines 50
```

## Verify Everything Works

```bash
# Check backend is running
pm2 status

# Test health endpoint
curl http://localhost:9001/api/health

# Test login (use your existing credentials)
curl -X POST http://localhost:9001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'

# View logs
pm2 logs finance-app-backend
```

## Important Notes

✅ **No database migration needed** - Your existing database will work as-is  
✅ **Same API endpoints** - Scriptable will work immediately  
✅ **Same port (9001)** - Nginx config doesn't need changes  
✅ **All your data is preserved** - Accounts, transactions, categories, etc.

## If Something Goes Wrong

```bash
# Check PM2 logs
pm2 logs finance-app-backend --lines 100

# Check database connection
cd server && npm run check:db

# Restart backend
pm2 restart finance-app-backend

# Check if port 9001 is in use
lsof -i :9001
```

## Enable Auto-Start on Reboot

```bash
pm2 startup
# Follow the instructions it shows, then:
pm2 save
```

That's it! Your backend should now be running with all your existing data.
