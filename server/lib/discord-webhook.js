const https = require('https');
const logger = require('./logger');

/**
 * Send a Discord webhook message
 * @param {string} webhookUrl - Discord webhook URL
 * @param {Object} embed - Discord embed object
 * @returns {Promise<boolean>} - Success status
 */
async function sendDiscordWebhook(webhookUrl, embed) {
  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    logger.warn('Invalid Discord webhook URL');
    return false;
  }

  const payload = JSON.stringify({
    embeds: [embed]
  });

  return new Promise((resolve) => {
    const url = new URL(webhookUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logger.info('Discord webhook sent successfully');
          resolve(true);
        } else {
          logger.error(`Discord webhook failed: ${res.statusCode} - ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      logger.error('Discord webhook request error:', error);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Create a Discord embed for transaction alerts
 * @param {Object} options - Alert options
 * @returns {Object} - Discord embed object
 */
function createTransactionAlertEmbed(options) {
  const {
    title,
    description,
    color = 0xff9900, // Orange default
    transaction,
    rule,
    fields = []
  } = options;

  const embed = {
    title: title || 'Transaction Alert',
    description: description || '',
    color: color,
    timestamp: new Date().toISOString(),
    fields: [
      {
        name: 'Transaction Details',
        value: `**Amount:** ${transaction.amount} ${transaction.currency}\n` +
               `**Type:** ${transaction.type}\n` +
               `**Category:** ${transaction.category || 'N/A'}\n` +
               `**Account:** ${transaction.account || 'N/A'}\n` +
               `**Date:** ${new Date(transaction.dateIso).toLocaleDateString()}`,
        inline: false
      }
    ],
    footer: {
      text: 'Finance App Alert System'
    }
  };

  if (transaction.description) {
    embed.fields[0].value += `\n**Description:** ${transaction.description}`;
  }

  if (transaction.personCompany) {
    embed.fields[0].value += `\n**Merchant:** ${transaction.personCompany}`;
  }

  if (rule) {
    embed.fields.push({
      name: 'Rule Triggered',
      value: `**Rule:** ${rule.name}\n**Threshold:** ${rule.threshold}\n**Current Value:** ${rule.currentValue}`,
      inline: false
    });
  }

  // Add custom fields
  fields.forEach(field => {
    embed.fields.push(field);
  });

  return embed;
}

/**
 * Send budget warning alert
 */
async function sendBudgetWarning(webhookUrl, transaction, rule, currentSpending, budgetLimit, alertPercentage = null) {
  const percentage = alertPercentage || ((currentSpending / budgetLimit) * 100).toFixed(1);
  const isWarning = alertPercentage === 90;
  const isExceeded = alertPercentage === 100 || (alertPercentage === null && currentSpending >= budgetLimit);
  
  const embed = createTransactionAlertEmbed({
    title: isWarning ? '⚠️ Budget Warning (90%)' : (isExceeded ? '🚨 Budget Exceeded (100%+)' : '⚠️ Budget Warning'),
    description: isWarning 
      ? `You've reached **90%** of your budget limit for **${rule.categoryName || 'this category'}**`
      : `You've ${isExceeded ? 'exceeded' : 'reached'} your budget limit for **${rule.categoryName || 'this category'}**`,
    color: isWarning ? 0xff9900 : 0xff0000, // Orange for 90%, Red for 100%+
    transaction,
    rule: {
      name: rule.name,
      threshold: `${budgetLimit} ${transaction.currency}`,
      currentValue: `${currentSpending.toFixed(2)} ${transaction.currency} (${percentage}%)`
    },
    fields: [
      {
        name: 'Budget Status',
        value: `**Limit:** ${budgetLimit} ${transaction.currency}\n**Spent:** ${currentSpending.toFixed(2)} ${transaction.currency} (${percentage}%)\n**Remaining:** ${Math.max(0, budgetLimit - currentSpending).toFixed(2)} ${transaction.currency}`,
        inline: false
      }
    ]
  });

  return await sendDiscordWebhook(webhookUrl, embed);
}

/**
 * Send large transaction alert
 */
async function sendLargeTransactionAlert(webhookUrl, transaction, threshold) {
  const embed = createTransactionAlertEmbed({
    title: '💸 Large Transaction Detected',
    description: `A large transaction was detected that exceeds your threshold of **${threshold} ${transaction.currency}**`,
    color: 0xff9900, // Orange
    transaction,
    fields: [
      {
        name: 'Threshold',
        value: `${threshold} ${transaction.currency}`,
        inline: true
      },
      {
        name: 'Transaction Amount',
        value: `${transaction.amount} ${transaction.currency}`,
        inline: true
      }
    ]
  });

  return await sendDiscordWebhook(webhookUrl, embed);
}

/**
 * Send monthly spending limit alert
 */
async function sendMonthlyLimitAlert(webhookUrl, transaction, currentSpending, monthlyLimit, alertPercentage = null) {
  const percentage = alertPercentage || ((currentSpending / monthlyLimit) * 100).toFixed(1);
  const isWarning = alertPercentage === 90;
  const isExceeded = alertPercentage === 100 || (alertPercentage === null && currentSpending >= monthlyLimit);
  
  const embed = createTransactionAlertEmbed({
    title: isWarning ? '📊 Monthly Limit Warning (90%)' : (isExceeded ? '🚨 Monthly Limit Exceeded (100%+)' : '📊 Monthly Limit Reached'),
    description: isWarning 
      ? `You've reached **90%** of your monthly spending limit`
      : `You've ${isExceeded ? 'exceeded' : 'reached'} your monthly spending limit`,
    color: isWarning ? 0xff9900 : 0xff0000, // Orange for 90%, Red for 100%+
    transaction,
    fields: [
      {
        name: 'Monthly Status',
        value: `**Limit:** ${monthlyLimit} ${transaction.currency}\n**Spent:** ${currentSpending.toFixed(2)} ${transaction.currency} (${percentage}%)\n**Remaining:** ${Math.max(0, monthlyLimit - currentSpending).toFixed(2)} ${transaction.currency}`,
        inline: false
      }
    ]
  });

  return await sendDiscordWebhook(webhookUrl, embed);
}

/**
 * Send account balance warning
 */
async function sendAccountBalanceWarning(webhookUrl, transaction, accountName, currentBalance, threshold) {
  const embed = createTransactionAlertEmbed({
    title: '🏦 Account Balance Warning',
    description: `Account **${accountName}** balance is below the warning threshold`,
    color: 0xff9900, // Orange
    transaction,
    fields: [
      {
        name: 'Account Status',
        value: `**Account:** ${accountName}\n**Current Balance:** ${currentBalance} ${transaction.currency}\n**Threshold:** ${threshold} ${transaction.currency}`,
        inline: false
      }
    ]
  });

  return await sendDiscordWebhook(webhookUrl, embed);
}

/**
 * Send recurring transaction detected alert
 */
async function sendRecurringTransactionAlert(webhookUrl, transaction, pattern) {
  const embed = createTransactionAlertEmbed({
    title: '🔄 Recurring Transaction Detected',
    description: `A recurring transaction pattern has been detected`,
    color: 0x0099ff, // Blue
    transaction,
    fields: [
      {
        name: 'Pattern Details',
        value: `**Frequency:** Every ~${pattern.intervalDays} days\n**Occurrences:** ${pattern.count} times\n**Average Amount:** ${pattern.avgAmount} ${transaction.currency}`,
        inline: false
      }
    ]
  });

  return await sendDiscordWebhook(webhookUrl, embed);
}

module.exports = {
  sendDiscordWebhook,
  createTransactionAlertEmbed,
  sendBudgetWarning,
  sendLargeTransactionAlert,
  sendMonthlyLimitAlert,
  sendAccountBalanceWarning,
  sendRecurringTransactionAlert
};

