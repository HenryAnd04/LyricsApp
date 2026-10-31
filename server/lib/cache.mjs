/** Tiny in-memory TTL cache (LRU-ish, capped by insertion order). */
export class TtlCache {
  constructor(max = 400, ttlMs = 1000 * 60 * 30) {
    this.max = max
    this.ttl = ttlMs
    this.map = new Map()
  }

  get(key) {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (hit.expires < Date.now()) {
      this.map.delete(key)
      return undefined
    }
    // refresh recency
    this.map.delete(key)
    this.map.set(key, hit)
    return hit.value
  }

  set(key, value, ttlMs = this.ttl) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, { value, expires: Date.now() + ttlMs })
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      this.map.delete(oldest)
    }
  }
}

export const caches = {
  search: new TtlCache(300, 1000 * 60 * 10),
  lyrics: new TtlCache(300, 1000 * 60 * 60 * 6),
  translation: new TtlCache(500, 1000 * 60 * 60 * 24 * 7),
  word: new TtlCache(500, 1000 * 60 * 60 * 24 * 7),
  video: new TtlCache(500, 1000 * 60 * 60 * 12),
}
