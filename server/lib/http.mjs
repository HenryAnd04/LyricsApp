export const USER_AGENT =
  'LyricsApp/1.0 (personal English-learning music player; contact: local)'

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

/** fetch with an abort timeout and one retry for idempotent GETs. */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 9000, retries = 0) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
        signal: controller.signal,
      })
      clearTimeout(timer)
      return res
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed')
}

export async function fetchJson(url, options = {}, timeoutMs = 9000, retries = 0) {
  const res = await fetchWithTimeout(url, options, timeoutMs, retries)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new HttpError(res.status, `Upstream responded ${res.status}`, body.slice(0, 300))
  }
  return res.json()
}

/** Strip accents, punctuation and noise so titles can be compared. */
export function normalizeText(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(feat|ft|featuring)\b[^)\]]*/g, ' ')
    .replace(/\b(official|oficial|video|lyric|lyrics|letra|audio|visualizer|hd|hq|remaster(ed)?|version|en vivo|live)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Sørensen–Dice coefficient over word bigrams + words. 0..1 */
export function similarity(a, b) {
  const x = normalizeText(a)
  const y = normalizeText(b)
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) return 0.85
  const grams = (s) => {
    const words = s.split(' ').filter(Boolean)
    const set = new Set(words)
    for (let i = 0; i < words.length - 1; i++) set.add(words[i] + ' ' + words[i + 1])
    return set
  }
  const gx = grams(x)
  const gy = grams(y)
  let overlap = 0
  for (const g of gx) if (gy.has(g)) overlap++
  return (2 * overlap) / (gx.size + gy.size)
}
