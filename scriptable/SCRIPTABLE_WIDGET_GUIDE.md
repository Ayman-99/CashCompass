# Scriptable Widget Guide - Account Balances

This guide explains how to use the `SCRIPTABLE_ACCOUNT_WIDGET.js` script to display account balances in iOS widgets.

## Setup

### 1. Install Scriptable App

Download the **Scriptable** app from the App Store (free).

### 2. Add the Script

1. Open Scriptable app
2. Tap the **+** button to create a new script
3. Copy and paste the contents of `SCRIPTABLE_ACCOUNT_WIDGET.js`
4. Update the `CONFIG` section with your server URL and credentials (replace the placeholders):
   ```javascript
   const CONFIG = {
     SERVER_URL: "https://your-api-host.com",
     USERNAME: "YOUR_USERNAME",
     PASSWORD: "YOUR_PASSWORD",
     TOKEN_KEY: "finance_app_token",
   };
   ```
5. Save the script (tap the name at the top to rename it, e.g., "Account Balances")

### 3. Test the Script

1. Tap the **▶️** play button in Scriptable
2. The script will fetch your accounts and display them
3. If it works, you're ready to create a widget!

## Creating an iOS Widget

### Option 1: Simple Text Widget (Recommended)

1. **Add Widget to Home Screen:**

   - Long press on home screen
   - Tap the **+** button in top-left
   - Search for "Scriptable"
   - Select **Scriptable** widget
   - Choose widget size (Small, Medium, or Large)

2. **Configure Widget:**
   - Tap the widget after adding it
   - Select your "Account Balances" script
   - Choose "Run Script" as the parameter
   - The widget will run the script and display results

### Option 2: Custom Widget with List

Create a custom widget script that uses the account data:

```javascript
// In Scriptable, create a new script for the widget
const SCRIPT_NAME = "Account Balances"; // Your script name

// Run the account balances script
const accountScript = await importModule(SCRIPT_NAME);
const data = await accountScript.getAccountBalances();

if (data.success) {
  // Create widget
  const widget = new ListWidget();

  // Add title
  const title = widget.addText("💰 Account Balances");
  title.font = Font.boldSystemFont(18);
  title.textColor = Color.white();

  widget.addSpacer(10);

  // Add accounts
  data.accounts.forEach((account) => {
    const row = widget.addStack();
    row.layoutHorizontally();

    const nameText = row.addText(account.name);
    nameText.font = Font.systemFont(14);
    nameText.textColor = Color.white();

    row.addSpacer();

    const balanceText = row.addText(account.formatted);
    balanceText.font = Font.boldSystemFont(14);
    balanceText.textColor = account.balance >= 0 ? Color.green() : Color.red();
  });

  widget.addSpacer(10);

  // Add totals
  const totalsTitle = widget.addText("📊 Totals:");
  totalsTitle.font = Font.boldSystemFont(14);
  totalsTitle.textColor = Color.white();

  data.totals.forEach((total) => {
    const totalRow = widget.addStack();
    totalRow.layoutHorizontally();

    const currencyText = totalRow.addText(total.currency + ":");
    currencyText.font = Font.systemFont(12);
    currencyText.textColor = Color.lightGray();

    totalRow.addSpacer();

    const amountText = totalRow.addText(total.formatted);
    amountText.font = Font.boldSystemFont(12);
    amountText.textColor = Color.white();
  });

  // Set background
  const gradient = new LinearGradient();
  gradient.colors = [new Color("#667eea"), new Color("#764ba2")];
  gradient.locations = [0.0, 1.0];
  widget.backgroundGradient = gradient;

  // Set widget
  Script.setWidget(widget);
  Script.complete();
} else {
  // Error widget
  const widget = new ListWidget();
  const errorText = widget.addText("❌ Error: " + data.error);
  errorText.textColor = Color.red();
  Script.setWidget(widget);
  Script.complete();
}
```

## Widget Features

### Data Returned

The script returns:

- **accounts**: Array of account objects with:
  - `id`: Account ID
  - `name`: Account name
  - `balance`: Numeric balance
  - `currency`: Currency code
  - `formatted`: Formatted balance string (e.g., "₪1,234.56")
- **totals**: Array of totals by currency
- **totalAccounts**: Number of accounts
- **lastUpdated**: ISO timestamp

### Example Output

```json
{
  "success": true,
  "accounts": [
    {
      "id": 1,
      "name": "Reflect",
      "balance": 5000.0,
      "currency": "ILS",
      "formatted": "₪5,000.00"
    },
    {
      "id": 2,
      "name": "Cash",
      "balance": 500.5,
      "currency": "ILS",
      "formatted": "₪500.50"
    }
  ],
  "totals": [
    {
      "currency": "ILS",
      "amount": 5500.5,
      "formatted": "₪5,500.50"
    }
  ],
  "totalAccounts": 2,
  "lastUpdated": "2026-01-03T10:30:00.000Z"
}
```

## Troubleshooting

### Widget Shows "Error: Failed to authenticate"

- Check your `USERNAME` and `PASSWORD` in the CONFIG
- Verify your server URL is correct
- Make sure the API user has proper permissions

### Widget Not Updating

- Widgets update automatically, but you can force refresh by:
  - Long press the widget
  - Tap "Edit Widget"
  - The script will run again

### Network Timeout

- Increase `timeoutInterval` in the script if you have slow network
- Default is 10 seconds which should be sufficient

## Advanced: Multiple Widgets

You can create different widget scripts for different purposes:

- **All Accounts**: Shows all account balances
- **Top Accounts**: Shows only accounts with highest balances
- **Single Account**: Shows balance for one specific account
- **Total Only**: Shows just the total balance

Modify the script to filter accounts as needed!
