/**
 * In-memory cache with TTL support.
 * Reduces GoMarble MCP API calls by caching responses.
 */

class Cache {
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.store = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate a cache key from endpoint + params
   */
  makeKey(endpoint, params = {}) {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${endpoint}:${paramStr}`;
  }

  /**
   * Get a cached value if it exists and hasn't expired
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Store a value with optional custom TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now(),
    });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Remove a specific key
   */
  invalidate(key) {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    let valid = 0;
    let expired = 0;
    const now = Date.now();
    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) expired++;
      else valid++;
    }
    return { total: this.store.size, valid, expired };
  }
}

// Singleton cache instance
const cache = new Cache();

// TTL presets for different data types
export const TTL = {
  ACCOUNT_STRUCTURE: 30 * 60 * 1000, // 30 min — campaigns/adsets/ads list
  INSIGHTS_REALTIME: 5 * 60 * 1000,  // 5 min  — live metrics
  INSIGHTS_HISTORIC: 60 * 60 * 1000, // 60 min — historical data
  CREATIVE_DETAILS: 60 * 60 * 1000,  // 60 min — creative content rarely changes
};

export default cache;
