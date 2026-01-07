# Environment Variables Setup Guide

## Quick Setup

1. **Copy the example file:**

   ```bash
   cd server
   cp .env.example .env
   ```

2. **Edit `.env` file** with your actual values

3. **Required variables** (minimum to get started):
   - `DATABASE_URL` - Your MySQL connection string
   - `JWT_SECRET` - Random secret for JWT tokens
   - `SESSION_SECRET` - Random secret for sessions

## Required Variables (1-3)

### 1. DATABASE_URL

Your MySQL database connection string.

**Format:**

```
mysql://username:password@host:port/database_name
```

**Examples:**

```env
# Local MySQL
DATABASE_URL="mysql://root:mypassword@localhost:3306/finance_db"

# Remote MySQL
DATABASE_URL="mysql://user:pass@192.168.1.100:3306/finance_db"

# With special characters in password (URL encode them)
DATABASE_URL="mysql://user:p%40ssw0rd@localhost:3306/finance_db"
```

**How to get:**

- Username: Your MySQL username (often `root` for local)
- Password: Your MySQL password
- Host: `localhost` for local, or IP address for remote
- Port: Usually `3306` (MySQL default)
- Database: Name of your database (create it first if it doesn't exist)

### 2. JWT_SECRET

Secret key for signing JWT tokens. **Must be a random, secure string.**

**Generate one:**

```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use any random string generator
```

**Example:**

```env
JWT_SECRET="aB3xK9mP2qR7vT4wY8zN1cF6hJ0lM5sD8gH2kL9pQ4rT7wE1yU6iO3a"
```

### 3. SESSION_SECRET

Secret key for web sessions. **Must be a random, secure string (different from JWT_SECRET).**

**Generate one:**

```bash
openssl rand -base64 32
```

**Example:**

```env
SESSION_SECRET="xY9mK3pR7vT2wE5zN8cF1hJ4lM6sD9gH2kL0pQ3rT6wE8yU1iO4aB7c"
```

## Optional Variables (4-8)

### 4. JWT_EXPIRES_IN

How long JWT tokens are valid. Default: `7d`

**Examples:**

```env
JWT_EXPIRES_IN="7d"    # 7 days
JWT_EXPIRES_IN="24h"   # 24 hours
JWT_EXPIRES_IN="1h"    # 1 hour
```

### 5. PORT

Backend server port. Default: `3000`, recommended: `9001` (to match legacy app)

```env
PORT=9001
```

### 6. NODE_ENV

Environment mode. Default: `development`

```env
NODE_ENV="development"  # For development
NODE_ENV="production"   # For production
```

### 7. USE_SECURE_COOKIES

Enable secure cookies (requires HTTPS). Default: `false`

```env
USE_SECURE_COOKIES="false"  # For development (HTTP)
USE_SECURE_COOKIES="true"   # For production (HTTPS)
```

### 8. LOG_LEVEL

Logging verbosity. Default: `info`

```env
LOG_LEVEL="error"   # Only errors
LOG_LEVEL="warn"    # Warnings and errors
LOG_LEVEL="info"    # Info, warnings, and errors (recommended)
LOG_LEVEL="debug"    # Everything (verbose)
```

## Complete Example

Here's a complete `.env` file example:

```env
# Database
DATABASE_URL="mysql://root:mypassword@localhost:3306/finance_db"

# Secrets (generate your own!)
JWT_SECRET="aB3xK9mP2qR7vT4wY8zN1cF6hJ0lM5sD8gH2kL9pQ4rT7wE1yU6iO3a"
SESSION_SECRET="xY9mK3pR7vT2wE5zN8cF1hJ4lM6sD9gH2kL0pQ3rT6wE8yU1iO4aB7c"

# Server
PORT=9001
NODE_ENV="development"

# Security
USE_SECURE_COOKIES="false"

# Logging
LOG_LEVEL="info"
```

## Verification

After setting up your `.env` file, verify it works:

```bash
cd server
npm run check:db
```

This will:

- ✅ Check if DATABASE_URL is set
- ✅ Test database connection
- ✅ Show users in database
- ✅ Show any issues

## Troubleshooting

### Database Connection Failed

- Check MySQL is running: `mysql -u root -p`
- Verify DATABASE_URL format is correct
- Ensure database exists: `CREATE DATABASE finance_db;`
- Check username/password are correct

### "Cannot connect to server" Error

- Make sure backend is running: `cd server && npm run dev`
- Check PORT in .env matches what you're using
- Verify no firewall blocking port 9001

### Login Fails

- Run `npm run check:db` to see if users exist
- Check if user has `canAccessWeb: true`
- Verify password is correct
- Check browser console for detailed errors
