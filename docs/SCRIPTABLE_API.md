# Scriptable API Documentation

This document describes the API endpoints that are compatible with Scriptable (iOS automation) and iPhone Shortcuts.

## Authentication

Scriptable uses JWT token-based authentication. The API supports both GET and POST methods for login (GET is preferred for Scriptable compatibility).

### Login (GET) - Recommended for Scriptable

```javascript
// Scriptable example
const url = `${SERVER_URL}/api/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
const request = new Request(url);
request.method = 'GET';
request.headers = {
  'Accept': 'application/json',
  'Cache-Control': 'no-cache'
};
const response = await request.loadJSON();
const token = response.token;
```

**Endpoint:** `GET /api/auth/login?username={username}&password={password}`

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com"
  }
}
```

### Login (POST) - Alternative

**Endpoint:** `POST /api/auth/login`

**Body:**
```json
{
  "username": "admin",
  "password": "password"
}
```

### Validate Token

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com"
  }
}
```

## Transactions

### Create Transaction

**Endpoint:** `POST /api/transactions`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "account_id": 1,
  "category_id": 2,
  "date_iso": "2026-01-15T10:30:00Z",
  "amount": 25.50,
  "currency": "ILS",
  "converted_amount": 25.50,
  "type": "Expense",
  "description": "Coffee",
  "subcategory": "Food",
  "person_company": "Starbucks"
}
```

**Response:**
```json
{
  "success": true,
  "transaction": {
    "id": 123,
    "account_id": 1,
    "category_id": 2,
    "date_iso": "2026-01-15T10:30:00.000Z",
    "amount": "25.50",
    "type": "Expense",
    "description": "Coffee"
  }
}
```

### Get Transactions

**Endpoint:** `GET /api/transactions`

**Query Parameters:**
- `account_id` (optional) - Filter by account
- `category_id` (optional) - Filter by category
- `type` (optional) - Filter by type (Income, Expense, Transfer)
- `startDate` (optional) - Start date (ISO format)
- `endDate` (optional) - End date (ISO format)
- `limit` (optional) - Number of results (default: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Example:**
```
GET /api/transactions?type=Expense&limit=10
```

## Accounts

### Get All Accounts

**Endpoint:** `GET /api/accounts`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "accounts": [
    {
      "id": 1,
      "name": "Cash",
      "currency": "ILS",
      "balance": "1000.00"
    }
  ]
}
```

### Get Single Account

**Endpoint:** `GET /api/accounts/:id`

## Categories

### Get All Categories

**Endpoint:** `GET /api/categories`

**Query Parameters:**
- `type` (optional) - Filter by type (Income, Expense)

**Example:**
```
GET /api/categories?type=Expense
```

## Currencies

### Get All Currencies

**Endpoint:** `GET /api/currencies`

### Get Exchange Rate

**Endpoint:** `GET /api/currencies/exchange?from=USD&to=ILS`

**Response:**
```json
{
  "from": "USD",
  "to": "ILS",
  "rate": 3.65
}
```

## Analytics

### Get Analytics Data

**Endpoint:** `GET /api/analytics`

**Query Parameters:**
- `startDate` (optional) - Start date (ISO format)
- `endDate` (optional) - End date (ISO format)

### Get Predictions

**Endpoint:** `GET /api/predictions`

### Get Savings Tips

**Endpoint:** `GET /api/tips`

## Complete Scriptable Example

```javascript
// Configuration
const CONFIG = {
  SERVER_URL: 'https://your-server.com',
  USERNAME: 'your-username',
  PASSWORD: 'your-password',
  TOKEN_KEY: 'finance_app_token'
};

// Get or login to get token
async function getValidToken() {
  // Try stored token first
  let token = Keychain.get(CONFIG.TOKEN_KEY);
  
  if (token) {
    // Validate token
    const url = `${CONFIG.SERVER_URL}/api/auth/me`;
    const request = new Request(url);
    request.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    try {
      const response = await request.loadJSON();
      if (response.user) {
        return token; // Token is valid
      }
    } catch (error) {
      // Token invalid, need to login
    }
  }
  
  // Login to get new token
  const loginUrl = `${CONFIG.SERVER_URL}/api/auth/login?username=${encodeURIComponent(CONFIG.USERNAME)}&password=${encodeURIComponent(CONFIG.PASSWORD)}`;
  const loginRequest = new Request(loginUrl);
  loginRequest.method = 'GET';
  loginRequest.headers = {
    'Accept': 'application/json'
  };
  
  const loginResponse = await loginRequest.loadJSON();
  token = loginResponse.token;
  
  // Store token
  Keychain.set(CONFIG.TOKEN_KEY, token);
  
  return token;
}

// Create a transaction
async function createTransaction(accountId, amount, description, type = 'Expense') {
  const token = await getValidToken();
  
  const url = `${CONFIG.SERVER_URL}/api/transactions`;
  const request = new Request(url);
  request.method = 'POST';
  request.headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  request.body = JSON.stringify({
    account_id: accountId,
    date_iso: new Date().toISOString(),
    amount: amount,
    currency: 'ILS',
    converted_amount: amount,
    type: type,
    description: description
  });
  
  const response = await request.loadJSON();
  return response;
}

// Usage
const result = await createTransaction(1, 25.50, 'Coffee', 'Expense');
console.log('Transaction created:', result);
```

## Error Handling

All endpoints return standard HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Server Error

Error responses follow this format:
```json
{
  "error": "Error message description"
}
```

## Rate Limiting

Login endpoints are rate-limited to 5 attempts per 15 minutes per IP address.

## Notes

1. **GET vs POST for Login**: Scriptable has limitations with POST requests, so the API supports GET for login with query parameters. This is less secure but necessary for Scriptable compatibility.

2. **Token Storage**: Store tokens securely in Scriptable's Keychain, not in plain text.

3. **Token Expiration**: JWT tokens expire after 7 days by default. The app will automatically re-authenticate when needed.

4. **IP Whitelisting**: API access can be restricted by IP address. Make sure your IP is whitelisted in the user settings.

5. **CORS**: The API supports CORS for cross-origin requests, but Scriptable doesn't use browsers, so CORS is not a concern.

