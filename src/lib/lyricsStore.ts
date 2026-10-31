import type { LyricsPayload, ManualLyrics } from '../types'
import { hashString } from './format'
import { readJSON, removeKey, writeJSON } from './storage'

const LYRICS_PREFIX = 'lc:'
const TRANSLATION_PREFIX = 'tr:'
const MANUAL_PREFIX = 'manual:'
const OFFSET_PREFIX = 'offset:'
const INDEX_LYRICS = 'lc-index'
const INDEX_TRANSLATIONS = 'tr-index'
const MAX_LYRICS = 80
const MAX_TRANSLATIONS = 100
const WEEK = 1000 * 60 * 60 * 24 * 7

interface IndexEntry {
  id: string
  at: number
}

function touchIndex(indexKey: string, id: string, max: number) {
  const index = readJSON<IndexEntry[]>(indexKey, [])
  const next = [{ id, at: Date.now() }, ...index.filter((e) => e.id !== id)]
  while (next.length > max) {
    const removed = next.pop()
    if (removed) {
      removeKey((indexKey === INDEX_LYRICS ? LYRICS_PREFIX : TRANSLATION_PREFIX) + removed.id)
    }
  }
  writeJSON(indexKey, next)
}

interface CachedLyrics {
  payload: LyricsPayload
  savedAt: number
}

export function getCachedLyrics(videoId: string): LyricsPayload | null {
  const cached = readJSON<CachedLyrics | null>(LYRICS_PREFIX + videoId, null)
  if (!cached) return null
  const ttl = cached.payload?.found ? WEEK : 1000 * 60 * 30
  if (Date.now() - cached.savedAt > ttl) return null
  return cached.payload
}

export function setCachedLyrics(videoId: string, payload: LyricsPayload) {
  writeJSON(LYRICS_PREFIX + videoId, { payload, savedAt: Date.now() } satisfies CachedLyrics)
  touchIndex(INDEX_LYRICS, videoId, MAX_LYRICS)
}

export function clearCachedLyrics(videoId: string) {
  removeKey(LYRICS_PREFIX + videoId)
  const index = readJSON<IndexEntry[]>(INDEX_LYRICS, [])
  writeJSON(
    INDEX_LYRICS,
    index.filter((e) => e.id !== videoId),
  )
}

export function getManualLyrics(videoId: string): ManualLyrics | null {
  return readJSON<ManualLyrics | null>(MANUAL_PREFIX + videoId, null)
}

export function setManualLyrics(videoId: string, text: string) {
  const isLrc = /\[\d{1,3}:\d{1,2}/.test(text)
  writeJSON(MANUAL_PREFIX + videoId, {
    text,
    isLrc,
    updatedAt: Date.now(),
  } satisfies ManualLyrics)
}

export function clearManualLyrics(videoId: string) {
  removeKey(MANUAL_PREFIX + videoId)
}

export function translationSignature(lines: string[], to: string) {
  return `${to}:${lines.length}:${hashString(lines.join('\n'))}`
}

interface CachedTranslations {
  signature: string
  lines: string[]
  savedAt: number
}

export function getCachedTranslations(videoId: string, signature: string): string[] | null {
  const cached = readJSON<CachedTranslations | null>(TRANSLATION_PREFIX + videoId, null)
  if (!cached || cached.signature !== signature) return null
  return cached.lines
}

export function setCachedTranslations(videoId: string, signature: string, lines: string[]) {
  writeJSON(TRANSLATION_PREFIX + videoId, {
    signature,
    lines,
    savedAt: Date.now(),
  } satisfies CachedTranslations)
  touchIndex(INDEX_TRANSLATIONS, videoId, MAX_TRANSLATIONS)
}

export function getLyricsOffset(videoId: string): number {
  const value = readJSON<number>(OFFSET_PREFIX + videoId, 0)
  return Number.isFinite(value) ? value : 0
}

export function setLyricsOffset(videoId: string, offset: number) {
  writeJSON(OFFSET_PREFIX + videoId, Math.round(offset * 10) / 10)
}

export function clearAllLyricsData() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('lyra:lc:') || key?.startsWith('lyra:tr:')) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
