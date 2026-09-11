/**
 * In-Memory Intelligence Cache with TTL and Selective Invalidation
 */

const cacheStore = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const intelligenceCache = {
  get(key) {
    const entry = cacheStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      cacheStore.delete(key);
      return null;
    }
    return entry.value;
  },

  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    cacheStore.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      savedAt: Date.now(),
    });
  },

  invalidate(pattern = null) {
    if (!pattern) {
      const count = cacheStore.size;
      cacheStore.clear();
      console.log(`[Intelligence Cache] Flushed all ${count} entries.`);
      return count;
    }
    let cleared = 0;
    for (const key of cacheStore.keys()) {
      if (key.includes(pattern)) {
        cacheStore.delete(key);
        cleared++;
      }
    }
    console.log(`[Intelligence Cache] Invalidated ${cleared} entries matching pattern "${pattern}".`);
    return cleared;
  },

  size() {
    return cacheStore.size;
  }
};
