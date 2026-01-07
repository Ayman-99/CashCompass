# Scriptable Integration Guide

## Overview

Scriptable is an iOS app that allows you to run JavaScript on your iPhone. This guide shows you how to use Scriptable to handle Finance App API calls, making your Shortcuts simpler and more reliable.

## Benefits of Using Scriptable

✅ **Token Management** - Automatically stores and validates tokens  
✅ **Error Handling** - Better error handling and retry logic  
✅ **Security** - Stores tokens securely in iOS Keychain  
✅ **Reusability** - One script handles all API operations  
✅ **Simpler Shortcuts** - Shortcuts just call the script with parameters

---

## Setup

### 1. Install Scriptable

Download **Scriptable** from the App Store (free).

### 2. Add the Script

1. Open Scriptable app
2. Tap the **+** button to create a new script
3. Name it: `Finance App`
4. Copy the entire contents of `SCRIPTABLE_FINANCE_APP.js` into the script
5. **Important:** Update the `SERVER_URL` in the `CONFIG` section:
   ```javascript
   SERVER_URL: 'https://your-server.com', // Change this!
   ```
6. Save the script

### 3. Configure Credentials (Optional)

You can either:

- **Option A:** Hardcode credentials in the script (less secure but simpler)
- **Option B:** Pass credentials from Shortcuts each time (more secure)

---

## Usage from Shortcuts

### Example 1: Create Expense Transaction

**Shortcut Steps:**

1. **Run Script** action

   - Script: `Finance App`
   - Input: Dictionary with:
     ```json
     {
       "action": "create_transaction",
       "account_name": "Reflect",
       "amount": 50.0,
       "type": "Expense",
       "category_name": "Food",
       "person_company": "Supermarket",
       "description": "Lunch"
     }
     ```

2. **Get Value** from Script Output

   - Key: `success`

3. **If** success is `true`
   - Show notification: "Transaction created!"
   - **Else**
   - Show alert: Error message

**Complete Shortcut JSON:**

```json
{
  "action": "create_transaction",
  "account_name": "Reflect",
  "amount": 50.0,
  "type": "Expense",
  "category_name": "Food",
  "person_company": "Supermarket",
  "description": "Lunch"
}
```

---

### Example 2: Create Income Transaction

**Shortcut Steps:**

1. **Ask for Input** - Amount (Number)
2. **Ask for Input** - Category (Text)
3. **Ask for Input** - Person/Company (Text)
4. **Run Script** action:
   ```json
   {
     "action": "create_transaction",
     "account_name": "Arab ILS",
     "amount": [Amount from step 1],
     "type": "Income",
     "category_name": [Category from step 2],
     "person_company": [Person from step 3]
   }
   ```

---

### Example 3: Create Transfer

**Shortcut Steps:**

1. **Ask for Input** - From Account (Text)
2. **Ask for Input** - To Account (Text)
3. **Ask for Input** - Amount (Number)
4. **Run Script** action:
   ```json
   {
     "action": "create_transfer",
     "from_account_name": [From Account],
     "to_account_name": [To Account],
     "amount": [Amount]
   }
   ```

---

### Example 4: Get Accounts List

**Shortcut Steps:**

1. **Run Script** action:

   ```json
   {
     "action": "get_accounts"
   }
   ```

2. **Get Value** from Script Output

   - Key: `accounts`

3. **Choose from List** - Use the accounts dictionary

---

## Available Actions

### 1. `create_transaction`

Creates an Income or Expense transaction.

**Required Parameters:**

- `action`: `"create_transaction"`
- `account_name`: Account name (string)
- `amount`: Transaction amount (number)
- `type`: `"Income"` or `"Expense"` (string)
- `category_name`: Category name (string)
- `person_company`: Person/company name (string)

**Optional Parameters:**

- `description`: Transaction description (string)
- `subcategory`: Subcategory name (string)
- `date_iso`: ISO date string (string)
- `currency`: Currency code (string)

**Response:**

```json
{
  "success": true,
  "transaction": { ... },
  "message": "Expense transaction created successfully"
}
```

---

### 2. `create_transfer`

Creates a transfer between accounts.

**Required Parameters:**

- `action`: `"create_transfer"`
- `from_account_name`: Source account name (string)
- `to_account_name`: Destination account name (string)
- `amount`: Transfer amount (number)

**Optional Parameters:**

- `description`: Transfer description (string)
- `date_iso`: ISO date string (string)
- `exchange_rate`: Exchange rate for different currencies (number)

**Response:**

```json
{
  "success": true,
  "transfer": { ... },
  "summary": { ... },
  "message": "Transfer created successfully"
}
```

---

### 3. `get_accounts`

Gets list of all account names.

**Required Parameters:**

- `action`: `"get_accounts"`

**Response:**

```json
{
  "success": true,
  "accounts": {
    "Reflect": "Reflect",
    "Cash": "Cash",
    "Arab ILS": "Arab ILS"
  }
}
```

---

### 4. `get_categories`

Gets list of categories.

**Required Parameters:**

- `action`: `"get_categories"`

**Optional Parameters:**

- `type`: Filter by type (`"Income"` or `"Expense"`)

**Response:**

```json
{
  "success": true,
  "categories": [
    {
      "id": 1,
      "name": "Food",
      "type": "Expense"
    }
  ]
}
```

---

### 5. `login`

Forces a new login (refreshes token).

**Required Parameters:**

- `action`: `"login"`

**Optional Parameters:**

- `username`: Username (string)
- `password`: Password (string)

**Response:**

```json
{
  "success": true,
  "token": "...",
  "user": { ... }
}
```

---

## Token Management

The script automatically:

1. **Stores** tokens in iOS Keychain (secure storage)
2. **Validates** stored tokens before use
3. **Refreshes** tokens automatically if expired
4. **Handles** login errors gracefully

You don't need to manage tokens manually - the script does it for you!

---

## Error Handling

All actions return a consistent response format:

**Success:**

```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "error": "Error message here"
}
```

In your Shortcuts, always check the `success` field before proceeding.

---

## Advanced: Passing Credentials from Shortcuts

If you want to pass credentials from Shortcuts (more secure):

1. In Shortcuts, use **Ask for Input** for username/password
2. Pass them in the script parameters:
   ```json
   {
     "action": "create_transaction",
     "username": [Username],
     "password": [Password],
     "account_name": "Reflect",
     ...
   }
   ```

---

## Example: Complete Expense Shortcut

**Shortcut Flow:**

1. **Ask for Input** - Amount (Number)
2. **Ask for Input** - Category (Text)
3. **Ask for Input** - Person/Company (Text)
4. **Ask for Input** - Description (Text, optional)
5. **Run Script** - Finance App
   - Input: Dictionary
     ```json
     {
       "action": "create_transaction",
       "account_name": "Reflect",
       "amount": [Amount],
       "type": "Expense",
       "category_name": [Category],
       "person_company": [Person/Company],
       "description": [Description]
     }
     ```
6. **Get Value** from Script Output - Key: `success`
7. **If** success equals `true`
   - **Show Notification**: "✅ Transaction created!"
   - **Get Value** from Script Output - Key: `transaction.id`
   - **Show Alert**: "Transaction ID: [ID]"
8. **Otherwise**
   - **Get Value** from Script Output - Key: `error`
   - **Show Alert**: "❌ Error: [Error]"

---

## Troubleshooting

### Token Expired

- The script automatically refreshes tokens
- If login fails, check your credentials in the script

### Network Error

- Check your `SERVER_URL` in the script
- Make sure your server is accessible from your iPhone

### Account Not Found

- Use `get_accounts` action to see available accounts
- Make sure account name matches exactly (case-sensitive)

### Category Auto-Creation

- Categories are automatically created if they don't exist
- Make sure `category_name` is provided

---

## Security Notes

1. **Keychain Storage**: Tokens are stored securely in iOS Keychain
2. **HTTPS**: Use HTTPS for production (update `SERVER_URL`)
3. **Credentials**: Consider passing credentials from Shortcuts instead of hardcoding
4. **Token Validation**: Script validates tokens before each API call

---

## Next Steps

1. Install Scriptable app
2. Copy the script from `SCRIPTABLE_FINANCE_APP.js`
3. Update `SERVER_URL` in the script
4. Test with a simple Shortcut
5. Build your custom Shortcuts using the script!
