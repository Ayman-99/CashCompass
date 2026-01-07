// Background sync utility for refreshing data in the background
class BackgroundSync {
  constructor() {
    this.syncInterval = null
    this.syncCallbacks = new Map()
    this.isActive = false
    this.lastSyncTime = null
    this.syncIntervalMs = 5 * 60 * 1000 // 5 minutes default
  }

  // Register a sync callback
  register(key, callback, intervalMs = null) {
    this.syncCallbacks.set(key, {
      callback,
      interval: intervalMs || this.syncIntervalMs,
      lastRun: null
    })
  }

  // Unregister a sync callback
  unregister(key) {
    this.syncCallbacks.delete(key)
  }

  // Start background sync
  start(intervalMs = null) {
    if (this.isActive) return
    
    if (intervalMs) {
      this.syncIntervalMs = intervalMs
    }
    
    this.isActive = true
    this.syncInterval = setInterval(() => {
      this.sync()
    }, this.syncIntervalMs)
    
    // Run initial sync
    this.sync()
  }

  // Stop background sync
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    this.isActive = false
  }

  // Execute sync for all registered callbacks
  async sync() {
    const now = Date.now()
    const promises = []
    
    for (const [key, { callback, interval, lastRun }] of this.syncCallbacks.entries()) {
      // Check if enough time has passed since last run
      if (!lastRun || (now - lastRun) >= interval) {
        promises.push(
          Promise.resolve(callback())
            .then(() => {
              const entry = this.syncCallbacks.get(key)
              if (entry) {
                entry.lastRun = now
              }
            })
            .catch(err => {
              console.error(`Background sync error for ${key}:`, err)
            })
        )
      }
    }
    
    await Promise.all(promises)
    this.lastSyncTime = now
  }

  // Force immediate sync
  async forceSync() {
    await this.sync()
  }

  // Get sync status
  getStatus() {
    return {
      isActive: this.isActive,
      lastSyncTime: this.lastSyncTime,
      registeredCallbacks: Array.from(this.syncCallbacks.keys()),
      interval: this.syncIntervalMs
    }
  }
}

// Create singleton instance
const backgroundSync = new BackgroundSync()

export default backgroundSync

