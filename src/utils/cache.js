// Simple in-memory cache with TTL (Time To Live)
class Cache {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map()
    this.defaultTTL = defaultTTL
  }

  // Generate cache key from params
  generateKey(key, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&')
    return `${key}${paramStr ? `?${paramStr}` : ''}`
  }

  // Get cached value
  get(key, params = {}) {
    const cacheKey = this.generateKey(key, params)
    const item = this.cache.get(cacheKey)
    
    if (!item) return null
    
    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(cacheKey)
      return null
    }
    
    return item.value
  }

  // Set cached value
  set(key, value, params = {}, ttl = null) {
    const cacheKey = this.generateKey(key, params)
    const expiresAt = Date.now() + (ttl || this.defaultTTL)
    
    this.cache.set(cacheKey, {
      value,
      expiresAt,
      cachedAt: Date.now()
    })
  }

  // Clear specific cache entry
  clear(key, params = {}) {
    const cacheKey = this.generateKey(key, params)
    this.cache.delete(cacheKey)
  }

  // Clear all cache
  clearAll() {
    this.cache.clear()
  }

  // Clear expired entries
  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats
  getStats() {
    this.cleanup()
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }
}

// Create singleton instance
const cache = new Cache()

// Cache wrapper for async functions
export function cached(key, fn, ttl = null) {
  return async (...args) => {
    const params = args.length > 0 ? args[0] : {}
    const cachedValue = cache.get(key, params)
    
    if (cachedValue !== null) {
      return cachedValue
    }
    
    const result = await fn(...args)
    cache.set(key, result, params, ttl)
    return result
  }
}

export default cache

