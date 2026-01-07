# CashCompass 💰

A comprehensive personal finance management application with advanced analytics, budgeting, and multi-currency support. Built with Vue 3 and Node.js, featuring a modern dashboard, transaction tracking, and iOS integration via Scriptable.

![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js)
![Node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8+-4479A1?logo=mysql)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [iOS Integration](#-ios-integration)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [Security](#-security)
- [Contributing](#-contributing)

## ✨ Features

### 🎯 Core Features

- **🔐 Authentication & Authorization**

  - Web-based session authentication
  - JWT token-based API authentication
  - Multi-user support with role-based access
  - Session management with auto-logout after 2 days of inactivity
  - IP-based access control

- **💳 Transaction Management**

  - Full CRUD operations (Create, Read, Update, Delete)
  - Support for Income and Expense transactions
  - Multi-currency transactions with automatic conversion
  - Transaction categorization with subcategories
  - Person/Company tracking for transactions
  - Date-based filtering and search
  - Bulk operations support

- **🏦 Account Management**

  - Multiple account support (bank accounts, cash, credit cards, etc.)
  - Per-account currency configuration
  - Account balance tracking
  - Account-specific transaction filtering
  - Account distribution visualization

- **📂 Category Management**

  - Income and Expense categories
  - Subcategory support
  - Category-based spending analysis
  - Top categories tracking
  - Category trends over time

- **💱 Currency Management**
  - Multi-currency support
  - Exchange rate management
  - Base currency configuration
  - Automatic currency conversion
  - Real-time exchange rate updates (via API integration)

### 📊 Analytics & Insights

- **📈 Dashboard Analytics**

  - **Net Worth Calculation**: Total net worth across all accounts with currency conversion
  - **Financial Health Score**: 0-100 score based on savings rate, expense diversity, and spending patterns
  - **Spending Velocity**: Daily spending rate calculation
  - **Top Spending Day**: Identifies day with highest expenses
  - **Month Split Analysis**: First half vs second half spending comparison
  - **Day of Week Breakdown**: Spending patterns by weekday
  - **Key Insights**: AI-powered financial insights and recommendations

- **📉 Advanced Charts & Visualizations**

  - **Monthly Trends Chart**: Line chart showing income/expense trends over time
  - **Category Spending Chart**: Doughnut chart for expense category breakdown
  - **Income Categories Chart**: Doughnut chart for income sources
  - **Account Distribution Chart**: Visual representation of account balances
  - **Period Comparison Chart**: Current period vs previous period comparison
  - **Category Trends Chart**: Category spending trends over time
  - **Cash Flow Calendar**: Heatmap showing daily transaction activity
  - **Sankey Chart**: Flow diagram for money movement
  - **Heatmap Chart**: Visual spending patterns

- **📋 Detailed Reports**
  - Total income and expenses
  - Net balance calculation
  - Transaction count and statistics
  - Average daily income/expense
  - Savings rate calculation
  - Top 10 expense categories
  - Top 10 income categories
  - Account summary with income/expense/transfers per account
  - Spending by person/company
  - Loans and debts tracking
  - Expense breakdown by person

### 💰 Budgeting & Alerts

- **📊 Budget Rules**

  - Monthly budget limits
  - Category-based budgets
  - Account-based budgets
  - Overall spending budgets
  - Budget status tracking (On Track / Warning / Exceeded)
  - Visual progress indicators
  - Budget period configuration (Monthly, Weekly, etc.)

- **🔔 Alert System**
  - Budget threshold alerts
  - Category spending alerts
  - Account balance alerts
  - Discord webhook integration for notifications
  - Real-time alert checking
  - Customizable alert rules

### 👥 User Management

- **👤 Admin Panel**

  - User creation and management
  - User role assignment
  - Web access control
  - IP-based access restrictions
  - User activity monitoring

- **📝 Audit Logging**
  - Complete audit trail of all actions
  - User activity tracking
  - Request logging
  - Error logging
  - Searchable audit logs

### ⚙️ Settings & Configuration

- **👤 Profile Management**

  - Username and email editing
  - Password change functionality
  - Account preferences

- **📤 Data Export**

  - Export transactions (CSV/JSON)
  - Export accounts (JSON)
  - Export categories (JSON)
  - Export currencies (JSON)
  - Export all data (JSON)
  - Custom date range exports

- **📥 Data Import**

  - JSON data import
  - Merge mode for existing data
  - Transaction import
  - Account import
  - Category import

- **🔗 Integrations**
  - Discord webhook configuration
  - Alert rule management
  - API token management

### 📱 iOS Integration

- **📲 Scriptable Support**
  - iPhone Shortcuts integration
  - iOS widget support (budget and dashboard widgets)
  - Quick transaction creation from iOS
  - Account balance widgets
  - Token-based authentication
  - Offline token caching

### 🎨 User Interface

- **🌓 Theme Support**

  - Dark mode / Light mode toggle
  - System preference detection
  - Persistent theme selection

- **📱 Responsive Design**

  - Mobile-friendly interface
  - Tablet optimization
  - Desktop experience
  - Touch-friendly controls

- **⚡ Performance**
  - Fast page loads
  - Optimized API calls
  - Background data synchronization
  - Client-side caching

## 🛠 Tech Stack

### Frontend

- **Vue 3** - Progressive JavaScript framework with Composition API
- **Vite** - Next-generation frontend build tool
- **Pinia** - State management for Vue
- **Vue Router** - Official router for Vue.js
- **Chart.js** - Beautiful, responsive charts
- **Vue ChartJS** - Vue wrapper for Chart.js
- **Axios** - HTTP client for API requests
- **date-fns** - Modern JavaScript date utility library

### Backend

- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **Prisma** - Next-generation ORM
- **MySQL** - Relational database
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **Winston** - Logging library
- **express-session** - Session management
- **express-rate-limit** - Rate limiting middleware

### Development Tools

- **PM2** - Process manager for production
- **concurrently** - Run multiple commands concurrently
- **dotenv** - Environment variable management
- **nodemon** - Development server auto-reload

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher
- **npm** (comes with Node.js)
- **MySQL** 8.0 or higher
- **Git** (for cloning the repository)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/CashCompass.git
cd CashCompass
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

### 4. Set Up Environment Variables

```bash
cd server
cp env.example .env
```

Edit `server/.env` with your configuration (see [Configuration](#-configuration) section).

### 5. Set Up Database

```bash
cd server

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Seed database with sample data
npm run prisma:seed
```

**Note**: The seed script creates an admin user with:

- Username: `admin`
- Password: `admin`
- **Change these credentials before deploying to production!**

## ⚙️ Configuration

### Environment Variables (`server/.env`)

Create a `.env` file in the `server/` directory with the following variables:

```env
# Database Configuration
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME"

# Authentication Secrets (Generate strong random strings)
JWT_SECRET="your-super-secret-jwt-key-change-this"
SESSION_SECRET="your-super-secret-session-key-change-this"
JWT_EXPIRES_IN="7d"

# Server Configuration
PORT=9001
NODE_ENV=production

# Cookie Settings
USE_SECURE_COOKIES=false  # Set to true if using HTTPS

# Logging
LOG_LEVEL=info
```

### Generating Secure Secrets

Use the following commands to generate secure secrets:

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate SESSION_SECRET
openssl rand -base64 32
```

### Database URL Format

```
mysql://username:password@host:port/database_name
```

Example:

```
DATABASE_URL="mysql://finance_user:secure_password@localhost:3306/finance_db"
```

## 💻 Usage

### Development Mode

Start both frontend and backend together:

```bash
npm run dev:all
```

This will start:

- Frontend development server on `http://localhost:5173`
- Backend API server on `http://localhost:9001`

Or run them separately:

**Frontend only:**

```bash
npm run dev
```

**Backend only:**

```bash
cd server
npm run dev
```

### Production Build

**Build frontend:**

```bash
npm run build
```

The built files will be in the `dist/` directory.

**Start backend:**

```bash
cd server
npm start
```

Or use PM2 for process management:

```bash
cd server
pm2 start ecosystem.config.js --env production
pm2 save
```

### Accessing the Application

1. Open your browser and navigate to `http://localhost:5173` (development) or your production URL
2. Login with your credentials (default: `admin`/`admin` - change in production!)
3. Start managing your finances!

## 📚 API Documentation

### Authentication Endpoints

#### Web Login (Session-based)

```
POST /api/auth/web-login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

#### API Login (JWT Token)

```
GET /api/auth/login?username=admin&password=password
# or
POST /api/auth/api-login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

#### Validate Token

```
GET /api/auth/me
Authorization: Bearer {token}
```

### Transaction Endpoints

- `GET /api/transactions` - List all transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:id` - Get transaction by ID
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Analytics Endpoints

- `GET /api/analytics` - Get analytics data
- `GET /api/analytics/predictions` - Get spending predictions
- `GET /api/analytics/tips` - Get savings tips
- `GET /api/analytics/advanced` - Get advanced analytics
- `GET /api/analytics/recurring` - Get recurring transactions
- `GET /api/analytics/health` - Get financial health score

### Other Endpoints

- `GET /api/accounts` - List accounts
- `GET /api/categories` - List categories
- `GET /api/currencies` - List currencies
- `GET /api/admin/users` - List users (admin only)
- `GET /api/audit` - Get audit logs
- `GET /api/settings/webhook` - Get webhook settings
- `POST /api/settings/webhook` - Update webhook settings
- `GET /api/settings/alert-rules` - Get alert rules
- `POST /api/settings/alert-rules` - Create alert rule
- `PUT /api/settings/alert-rules/:id` - Update alert rule
- `DELETE /api/settings/alert-rules/:id` - Delete alert rule

For complete API documentation, see [`docs/SCRIPTABLE_API.md`](./docs/SCRIPTABLE_API.md).

## 📱 iOS Integration

CashCompass includes full support for iOS automation via Scriptable and iPhone Shortcuts.

### Setup Scriptable

1. Install the **Scriptable** app from the App Store
2. Copy the scripts from the `scriptable/` directory
3. Update the `CONFIG` section with your server URL and credentials
4. Run the scripts or add them as widgets

### Available Scripts

- **SCRIPTABLE_FINANCE_APP.js** - Main script for transaction creation and account management
- **SCRIPTABLE_FINANCE_DASHBOARD_WIDGET.js** - Widget script for iOS home screen widgets

### Widget Types

- **Budget Widget**: Shows budget status and alerts
- **Dashboard Widget**: Shows net worth, income, expenses, and recent transactions

For detailed setup instructions, see:

- [`scriptable/SCRIPTABLE_GUIDE.md`](./scriptable/SCRIPTABLE_GUIDE.md)
- [`scriptable/SCRIPTABLE_WIDGET_GUIDE.md`](./scriptable/SCRIPTABLE_WIDGET_GUIDE.md)
- [`docs/SCRIPTABLE_API.md`](./docs/SCRIPTABLE_API.md)

## 🚢 Deployment

### Quick Deployment

See [`docs/QUICK_DEPLOY.md`](./docs/QUICK_DEPLOY.md) for a quick deployment guide.

### Full Deployment Guide

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for complete deployment instructions including:

- PM2 process management
- Nginx reverse proxy configuration
- SSL/HTTPS setup
- Database migration
- Environment configuration

### Production Checklist

- [ ] Change default admin credentials
- [ ] Generate strong JWT_SECRET and SESSION_SECRET
- [ ] Set USE_SECURE_COOKIES=true if using HTTPS
- [ ] Configure database backups
- [ ] Set up log rotation
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts

## 📁 Project Structure

```
CashCompass/
├── src/                    # Frontend source code
│   ├── components/        # Vue components
│   │   ├── charts/       # Chart components
│   │   └── *.vue         # Other components
│   ├── views/            # Page components
│   ├── services/         # API services
│   ├── stores/           # Pinia stores
│   ├── router/           # Vue Router config
│   └── utils/            # Utility functions
├── server/               # Backend server
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   ├── lib/             # Core libraries
│   ├── prisma/          # Database schema & migrations
│   └── server.js        # Server entry point
├── scriptable/          # iOS Scriptable scripts
├── docs/                # Documentation
└── public/              # Static assets
```

## 🔒 Security

### Security Best Practices

1. **Never commit `.env` files** - They contain sensitive credentials
2. **Use strong secrets** - Generate random strings for JWT_SECRET and SESSION_SECRET
3. **Change default passwords** - Update admin credentials before production
4. **Enable HTTPS** - Use SSL/TLS in production
5. **Set secure cookies** - Enable USE_SECURE_COOKIES in production
6. **Regular updates** - Keep dependencies up to date
7. **Database security** - Use strong database passwords and restrict access
8. **Rate limiting** - Already configured for login endpoints
9. **Input validation** - All inputs are validated on the backend
10. **Audit logging** - All actions are logged for security auditing

### Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT token authentication
- ✅ Session-based authentication
- ✅ Rate limiting on login endpoints
- ✅ CORS protection
- ✅ SQL injection protection (via Prisma)
- ✅ XSS protection
- ✅ CSRF protection (via SameSite cookies)
- ✅ Audit logging
- ✅ IP-based access control

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow Vue 3 Composition API best practices
- Use TypeScript-style JSDoc comments
- Write clear commit messages
- Test your changes thoroughly
- Update documentation as needed

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙌 Creator

CashCompass is crafted by **Ayman Honjol**, who brought together a full-stack analytics dashboard, rich budgeting workflows, and thoughtful iOS automation support—turning a complex finance toolchain into a polished, user-friendly product.

## 🙏 Acknowledgments

- Built with [Vue.js](https://vuejs.org/)
- Charts powered by [Chart.js](https://www.chartjs.org/)
- Database management with [Prisma](https://www.prisma.io/)
- iOS integration via [Scriptable](https://scriptable.app/)

## 📞 Support

For issues, questions, or contributions:

- Open an issue on GitHub
- Check the [documentation](./docs/) folder
- Review the [API documentation](./docs/SCRIPTABLE_API.md)

---

**Made with ❤️ for better financial management**
