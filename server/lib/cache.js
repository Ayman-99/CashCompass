/**
 * Simple in-memory cache with TTL (Time To Live)
 * Used for caching frequently accessed data like categories, currencies, accounts
 */

class Cache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  /**
   * Set a value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttl = 5 * 60 * 1000) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set the value
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });

    // Set timer to auto-delete
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.store.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.store.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.store.clear();
  }

  /**
   * Check if key exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const item = this.store.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const item of this.store.values()) {
      if (now > item.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.store.size,
      valid,
      expired
    };
  }
}

// Create singleton instance
const cache = new Cache();

// Clean up expired entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of cache.store.entries()) {
    if (now > item.expiresAt) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000);

module.exports = cache;

