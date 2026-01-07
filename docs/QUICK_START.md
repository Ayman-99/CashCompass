# Quick Start Guide

## Prerequisites

- Node.js (v16 or higher)
- MySQL database
- npm or yarn

## Setup Steps

### 1. Install Frontend Dependencies

```bash
cd "FinanceApp Vue"
npm install
```

### 2. Setup Backend

```bash
cd server
npm install
```

### 3. Configure Environment

Create a `.env` file in the `server/` directory:

```bash
cd server
cp .env.example .env
```

Then edit `server/.env` and update **at minimum these 3 required values**:

```env
# 1. Database (REQUIRED)
DATABASE_URL="mysql://user:password@localhost:3306/finance_db"

# 2. JWT Secret (REQUIRED) - Generate with: openssl rand -base64 32
JWT_SECRET="your-random-secret-key-here"

# 3. Session Secret (REQUIRED) - Generate with: openssl rand -base64 32
SESSION_SECRET="your-random-session-secret-here"
```

**Important:**

- The `.env` file must be in the `server/` directory (not the root of the project)
- See `server/ENV_SETUP.md` for detailed explanation of all 8 variables
- Generate secure secrets: `openssl rand -base64 32`

### 4. Setup Database

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
```

### 5. (Optional) Seed Data

If you have existing data from the legacy app, you can seed it:

```bash
cd server
npm run prisma:seed
```

### 6. Start Development Servers

**Option 1: Run both together (Recommended):**

```bash
npm run dev:all
```

This will start both the frontend (port 5173) and backend (port 9001) in a single terminal.

**Option 2: Run separately (if you prefer):**

**Terminal 1 - Backend:**

```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

### 7. Access the App

- Frontend: http://localhost:5173
- Backend API: http://localhost:9001

### 8. Create Admin User

If you need to create an admin user with web access:

```bash
cd server
node scripts/setup-web-user.js admin
```

Then login with the credentials you set.

## Troubleshooting

### Login Failed / Database Connection Issues

**First, check if database is connected:**

```bash
cd server
npm run check:db
```

This will show:

- ✅ If database connection works
- 👥 All users and their web access status
- ⚠️ Any issues found

**Common Issues:**

1. **Database not connected:**

   - Verify MySQL is running
   - Check DATABASE_URL in `server/.env` is correct
   - Ensure database exists
   - Run `npm run prisma:generate` and `npm run prisma:migrate`

2. **No users in database:**

   ```bash
   cd server
   npm run prisma:seed
   ```

   This creates an admin user (username: `admin`, password: `admin`)

3. **User exists but can't login:**

   - User might not have `canAccessWeb: true`
   - Enable web access: `node scripts/setup-web-user.js <username>`

4. **Network/CORS errors:**
   - Make sure backend is running on port 9001
   - Check browser console for detailed errors
   - Verify Vite proxy is configured correctly

### Port Already in Use

- Change PORT in `server/.env`
- Or kill the process using the port

### CORS Errors

- Ensure backend is running on port 9001
- Check vite.config.js proxy settings
- Verify CORS is enabled in server.js

### Authentication Issues

- Clear browser cookies
- Check session secret in `.env`
- Verify user has `canAccessWeb: true` in database
