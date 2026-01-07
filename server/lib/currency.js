/**
 * Currency exchange rate helper - reads from database
 * Rates are managed through the currency management page
 */

const prisma = require('./prisma');

/**
 * Get exchange rate from one currency to another from database
 * @param {number} userId - User ID
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Destination currency code
 * @returns {Promise<number|null>} - Exchange rate (from -> to), or null if error
 */
async function getExchangeRate(userId, fromCurrency, toCurrency) {
  // Same currency
  if (fromCurrency === toCurrency) {
    return 1.0;
  }

  try {
    // Get both currencies from database (single-user system, no userId filter)
    let fromCurr, toCurr;
    
    try {
      [fromCurr, toCurr] = await Promise.all([
        prisma.currency.findFirst({
          where: {
            code: fromCurrency.toUpperCase(),
            isActive: true
          }
        }),
        prisma.currency.findFirst({
          where: {
            code: toCurrency.toUpperCase(),
            isActive: true
          }
        })
      ]);
    } catch (dbError) {
      console.error('Database error fetching currencies:', dbError);
      console.error('Database error details:', {
        message: dbError.message,
        code: dbError.code,
        stack: dbError.stack
      });
      // Return null instead of throwing to prevent 500 errors
      return null;
    }

    if (!fromCurr) {
      console.error(`Currency not found: ${fromCurrency}`);
      return null;
    }
    
    if (!toCurr) {
      console.error(`Currency not found: ${toCurrency}`);
      return null;
    }
    
    // Validate rateToILS exists and is not null
    if (fromCurr.rateToILS === null || fromCurr.rateToILS === undefined) {
      console.error(`Currency ${fromCurrency} has no rateToILS value`);
      return null;
    }
    
    if (toCurr.rateToILS === null || toCurr.rateToILS === undefined) {
      console.error(`Currency ${toCurrency} has no rateToILS value`);
      return null;
    }

    // Both rates are relative to ILS
    // Rate from A to B = (1 A in ILS) / (1 B in ILS)
    // Convert Prisma Decimal to number properly
    // Prisma Decimal can be a Decimal object (with .toNumber()) or already a number/string
    let fromRate, toRate;
    try {
      // Handle Prisma Decimal type - it might be a Decimal object with toNumber() method
      // Prisma Decimal objects have a toNumber() method, but also toString() and valueOf()
      if (fromCurr.rateToILS && typeof fromCurr.rateToILS === 'object') {
        // Check for toNumber method (Prisma Decimal)
        if (typeof fromCurr.rateToILS.toNumber === 'function') {
          fromRate = fromCurr.rateToILS.toNumber();
        } else if (typeof fromCurr.rateToILS.toString === 'function') {
          fromRate = parseFloat(fromCurr.rateToILS.toString());
        } else {
          fromRate = parseFloat(String(fromCurr.rateToILS));
        }
      } else {
        fromRate = parseFloat(String(fromCurr.rateToILS || 0));
      }
      
      if (toCurr.rateToILS && typeof toCurr.rateToILS === 'object') {
        // Check for toNumber method (Prisma Decimal)
        if (typeof toCurr.rateToILS.toNumber === 'function') {
          toRate = toCurr.rateToILS.toNumber();
        } else if (typeof toCurr.rateToILS.toString === 'function') {
          toRate = parseFloat(toCurr.rateToILS.toString());
        } else {
          toRate = parseFloat(String(toCurr.rateToILS));
        }
      } else {
        toRate = parseFloat(String(toCurr.rateToILS || 0));
      }
    } catch (conversionError) {
      console.error('Error converting Decimal to number:', conversionError);
      console.error(`Conversion error details:`, {
        error: conversionError.message,
        stack: conversionError.stack,
        fromCurrency: fromCurrency,
        toCurrency: toCurrency,
        fromCurrType: typeof fromCurr.rateToILS,
        fromCurrValue: fromCurr.rateToILS,
        toCurrType: typeof toCurr.rateToILS,
        toCurrValue: toCurr.rateToILS
      });
      return null;
    }
    
    // Validate rates are valid numbers
    if (isNaN(fromRate) || isNaN(toRate) || !isFinite(fromRate) || !isFinite(toRate)) {
      console.error(`Invalid rate values: ${fromCurrency}=${fromCurr.rateToILS} (${typeof fromCurr.rateToILS}) -> ${fromRate}, ${toCurrency}=${toCurr.rateToILS} (${typeof toCurr.rateToILS}) -> ${toRate}`);
      return null;
    }
    
    if (toRate === 0) {
      console.error(`Invalid rate for ${toCurrency}: rateToILS is zero`);
      return null;
    }
    
    if (fromRate === 0) {
      console.error(`Invalid rate for ${fromCurrency}: rateToILS is zero`);
      return null;
    }

    const calculatedRate = fromRate / toRate;
    
    // Validate calculated rate is valid
    if (isNaN(calculatedRate) || !isFinite(calculatedRate)) {
      console.error(`Invalid calculated rate: ${fromRate} / ${toRate} = ${calculatedRate}`);
      return null;
    }

    return calculatedRate;
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      fromCurrency: fromCurrency,
      toCurrency: toCurrency,
      userId: userId
    });
    // Always return null instead of throwing to prevent 500 errors
    // The route handler will convert null to a 400 response
    return null;
  }
}

/**
 * Convert amount from one currency to another
 * @param {number} userId - User ID
 * @param {number} amount - Amount in source currency
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Destination currency code
 * @returns {Promise<number|null>} - Converted amount, or null if conversion not possible
 */
async function convertCurrency(userId, amount, fromCurrency, toCurrency) {
  const rate = await getExchangeRate(userId, fromCurrency, toCurrency);
  if (rate === null) {
    return null;
  }
  return parseFloat(amount) * rate;
}

/**
 * Check if currency is configured for user
 * @param {number} userId - User ID
 * @param {string} currency - Currency code
 * @returns {Promise<boolean>}
 */
async function isCurrencySupported(userId, currency) {
  // Note: userId parameter kept for API compatibility but not used (single-user system)
  try {
    const currencyRecord = await prisma.currency.findFirst({
      where: {
        code: currency.toUpperCase(),
        isActive: true
      }
    });
    return !!currencyRecord;
  } catch (error) {
    console.error('Error checking currency:', error);
    return false;
  }
}

/**
 * Get all active currencies for user
 * @param {number} userId - User ID
 * @returns {Promise<Array>}
 */
async function getUserCurrencies(userId) {
  // Note: userId parameter kept for API compatibility but not used (single-user system)
  try {
    return await prisma.currency.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { isBase: 'desc' },
        { code: 'asc' }
      ]
    });
  } catch (error) {
    console.error('Error getting user currencies:', error);
    return [];
  }
}

module.exports = {
  getExchangeRate,
  convertCurrency,
  isCurrencySupported,
  getUserCurrencies
};

