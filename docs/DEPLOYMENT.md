# Production Deployment Guide

## Overview

This guide helps you deploy the Finance App backend to your server using PM2, with Nginx as a reverse proxy. The backend runs on port 9001 (same as legacy) to maintain compatibility with Scriptable.

## Prerequisites

- Node.js (v18+ recommended)
- PM2 installed globally: `npm install -g pm2`
- MySQL database running
- Nginx installed and configured

## Step 1: Prepare the Server

### 1.1 Upload Files to Server

Upload the entire `FinanceApp Vue` folder to your server, or clone the repository:

```bash
# On your server
cd /path/to/your/apps
git clone <your-repo-url> FinanceApp-Vue
cd FinanceApp-Vue
```

### 1.2 Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Generate Prisma client
npm run prisma:generate
```

### 1.3 Set Up Environment Variables

```bash
cd server
cp .env.example .env
nano .env  # or use your preferred editor
```

**Required `.env` variables:**

```env
# Database (use same database as legacy app for migration)
DATABASE_URL="mysql://username:password@localhost:3306/finance_db"

# Secrets (generate new ones or reuse from legacy)
JWT_SECRET="your-jwt-secret-here"
SESSION_SECRET="your-session-secret-here"

# Server
PORT=9001
NODE_ENV="production"

# Security (set to true if using HTTPS)
USE_SECURE_COOKIES="true"

# Logging
LOG_LEVEL="info"
```

**Generate secrets:**

```bash
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET
```

### 1.4 Run Database Migrations

If you're using the same database as the legacy app, the tables should already exist. If not:

```bash
cd server
npm run prisma:migrate
```

**Important:** The new app uses the same database schema as the legacy app, so you can use the same database without migration issues.

## Step 2: Configure PM2

### 2.1 Install PM2 (if not already installed)

```bash
npm install -g pm2
```

### 2.2 Start with PM2

From the `FinanceApp Vue` directory:

```bash
# Start the backend
pm2 start server/ecosystem.config.js --env production

# Or use the ecosystem config directly
cd server
pm2 start ecosystem.config.js --env production
```

### 2.3 PM2 Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs finance-app-backend

# Restart
pm2 restart finance-app-backend

# Stop
pm2 stop finance-app-backend

# Delete from PM2
pm2 delete finance-app-backend

# Save PM2 configuration (auto-start on reboot)
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

## Step 3: Configure Nginx

### 3.1 Nginx Configuration

Your Nginx config should proxy to `localhost:9001`. Example configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or your IP

    # Increase body size for large imports
    client_max_body_size 50M;

    # Backend API
    location /api {
        proxy_pass http://localhost:9001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send        _timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend (if serving Vue app from Nginx)
    location / {
        root /path/to/FinanceApp-Vue/dist;
        try_files $uri $uri/ /index.html;
    }

    # Or if frontend is on a different port/server
    # location / {
    #     proxy_pass http://localhost:5173;  # Vite dev server
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    #     proxy_cache_bypass $http_upgrade;
    # }
}
```

### 3.2 Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
# or
sudo service nginx reload
```

## Step 4: Migration from Legacy App

### 4.1 Stop Legacy App

```bash
# If legacy app is running with PM2
pm2 stop legacy-app-name
pm2 delete legacy-app-name

# Or if running directly
# Find and kill the process
ps aux | grep node
kill <pid>
```

### 4.2 Verify Database Connection

```bash
cd server
npm run check:db
```

This should show your existing users and data from the legacy app.

### 4.3 Start New Backend

```bash
pm2 start server/ecosystem.config.js --env production
pm2 save
```

### 4.4 Test API Endpoints

```bash
# Health check
curl http://localhost:9001/api/health

# Test login (replace with your credentials)
curl -X POST http://localhost:9001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'
```

## Step 5: Scriptable Compatibility

The new backend maintains **100% API compatibility** with the legacy app. Your Scriptable shortcuts should work without any changes.

### 5.1 Verify Scriptable Endpoints

All Scriptable endpoints are available:

- `POST /api/auth/login` - Get JWT token
- `POST /api/transactions` - Create transaction
- `POST /api/transactions/transfer` - Create transfer
- `GET /api/accounts` - List accounts
- `GET /api/categories` - List categories
- `GET /api/currencies/exchange` - Get exchange rate

### 5.2 Test Scriptable Connection

Use the same URL and token as before. The API endpoints are identical.

## Step 6: Frontend Deployment (Optional)

If you want to serve the Vue frontend from your server:

### 6.1 Build Frontend

```bash
cd /path/to/FinanceApp-Vue
npm install
npm run build
```

This creates a `dist` folder with production files.

### 6.2 Serve with Nginx

Update your Nginx config to serve the `dist` folder (see Step 3.1).

### 6.3 Or Use PM2 for Frontend (Development)

```bash
# In FinanceApp Vue directory
pm2 start npm --name "finance-app-frontend" -- run dev
```

## Step 7: Monitoring and Maintenance

### 7.1 PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View detailed info
pm2 show finance-app-backend

# View logs
pm2 logs finance-app-backend --lines 100
```

### 7.2 Application Logs

Logs are stored in:

- `server/logs/` - Application logs (Winston)
- PM2 logs - Process logs

### 7.3 Health Checks

``bash

# Check if backend is running

curl http://localhost:9001/api/health

# Check database connection

cd server && npm run check:db

````

## Troubleshooting

### Backend Won't Start

1. Check PM2 logs: `pm2 logs finance-app-backend`
2. Verify `.env` file exists and has correct values
3. Test database connection: `cd server && npm run check:db`
4. Check port 9001 is not in use: `lsof -i :9001`

### Scriptable Requests Fail

1. Verify backend is running: `pm2 status`
2. Check Nginx is proxying correctly: `curl http://localhost:9001/api/health`
3. Verify JWT token is valid
4. Check IP whitelist in user settings (if configured)

### Database Connection Issues

1. Verify MySQL is running: `sudo systemctl status mysql`
2. Check DATABASE_URL in `.env` is correct
3. Test connection: `cd server && npm run check:db`
4. Verify database exists and user has permissions

### Nginx 502 Bad Gateway

1. Check backend is running: `pm2 status`
2. Verify backend is on port 9001: `netstat -tulpn | grep 9001`
3. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
4. Verify proxy_pass URL in Nginx config

## Quick Reference

```bash
# Start backend
pm2 start server/ecosystem.config.js --env production

# Restart backend
pm2 restart finance-app-backend

# View logs
pm2 logs finance-app-backend

# Stop backend
pm2 stop finance-app-backend

# Check status
pm2 status

# Save PM2 config
pm2 save

# Enable auto-start on reboot
pm2 startup
pm2 save
````

## Security Notes

1. **Use HTTPS:** Configure SSL certificates in Nginx for production
2. **Firewall:** Only expose port 80/443, not 9001 directly
3. **Secrets:** Use strong, unique secrets for JWT_SECRET and SESSION_SECRET
4. **Database:** Use a dedicated database user with minimal permissions
5. **Updates:** Keep Node.js and dependencies updated

## Support

If you encounter issues:

1. Check PM2 logs: `pm2 logs finance-app-backend`
2. Check application logs: `tail -f server/logs/*.log`
3. Verify environment variables: `cd server && cat .env`
4. Test database: `cd server && npm run check:db`
