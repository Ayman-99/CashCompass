# Missing Features from Legacy App

This document lists all features from the legacy app that need to be implemented in the Vue version.

## ✅ Already Implemented

- ✅ Login/Authentication
- ✅ Dashboard (basic)
- ✅ Transactions (list, add, edit, delete)
- ✅ Accounts (list, add, edit, delete)
- ✅ Categories (list, add, edit, delete)
- ✅ Admin (user management)
- ✅ Audit Logs (view)
- ✅ Settings (basic profile view)

## ❌ Missing Features

### 1. Currencies Management

- **Status**: Not implemented
- **Location**: Legacy has `/dashboard.html#currencies` and full CRUD
- **Needed**:
  - Currencies view page
  - List all currencies
  - Add/Edit/Delete currencies
  - Exchange rate management
  - Currency service

### 2. Settings Page Enhancements

- **Status**: Partially implemented (only profile view)
- **Missing**:
  - Profile editing (username, email)
  - Password change
  - Export data (CSV/JSON for transactions, accounts, categories, currencies, all)
  - Import data (JSON import with merge)
  - Discord webhook configuration
  - Alert rules management

### 3. Dashboard Enhancements

- **Status**: Basic implementation
- **Missing**:
  - Dark mode/Theme toggle
  - Date range filters
  - Enhanced analytics (Financial Health Score, Net Worth)
  - More detailed charts with zoom
  - Management section within dashboard
  - Better visualizations

### 4. Export/Import Functionality

- **Status**: Not implemented
- **Needed**:
  - Export service
  - Export UI in Settings
  - Import UI in Settings
  - Support for CSV and JSON formats

### 5. Alert Rules Management

- **Status**: Not implemented
- **Needed**:
  - Alert Rules view
  - Create/Edit/Delete alert rules
  - Alert rules service
  - Integration with settings page

### 6. Enhanced Analytics

- **Status**: Basic implementation
- **Missing**:
  - Financial Health Score calculation
  - Net Worth calculation
  - Enhanced charts with date-fns adapter
  - Chart zoom functionality
  - More detailed category breakdowns

## Implementation Priority

1. **High Priority**:

   - Currencies Management
   - Settings enhancements (Export/Import, Webhook, Alert Rules)
   - Dark mode

2. **Medium Priority**:

   - Dashboard enhancements
   - Enhanced analytics

3. **Low Priority**:
   - Chart zoom
   - Advanced visualizations

## Next Steps

1. Create missing services (currencyService, exportService, settingsService)
2. Create missing views (Currencies.vue, enhanced Settings.vue)
3. Add dark mode support
4. Enhance Dashboard with more features
5. Add Export/Import UI
