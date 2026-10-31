import type { LyricsPayload, Track, WordLookup } from '../types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError('No se pudo conectar con el servidor. ¿Está corriendo la API?', 0)
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* empty or non-JSON */
  }
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error || `El servidor respondió ${res.status}`
    throw new ApiError(message, res.status)
  }
  return body as T
}

export interface SearchResponse {
  source: string
  query: string
  tracks: Track[]
}

export function searchTracks(query: string, limit = 24, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query, limit: String(limit) })
  return request<SearchResponse>(`/api/search?${params}`, { signal })
}

export function getSuggestions(query: string, signal?: AbortSignal) {
  return request<{ items: string[] }>(`/api/suggest?q=${encodeURIComponent(query)}`, { signal })
}

export function getTrackMeta(videoIdOrUrl: string) {
  return request<Track>(`/api/track?url=${encodeURIComponent(videoIdOrUrl)}`)
}

export async function getLyrics(
  track: Track,
  signal?: AbortSignal,
): Promise<LyricsPayload> {
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artist || track.channel || '',
    duration: String(track.duration || 0),
  })
  return request<LyricsPayload>(`/api/lyrics?${params}`, { signal })
}

export function getLyricsById(id: number) {
  return request<LyricsPayload>(`/api/lyrics?id=${id}`)
}

export function translateLines(
  lines: string[],
  to = 'en',
  from = 'auto',
  signal?: AbortSignal,
) {
  return request<{ translations: string[] }>('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lines, to, from }),
    signal,
  })
}

export function lookupWord(word: string, to = 'es') {
  return request<WordLookup>(`/api/word?w=${encodeURIComponent(word)}&to=${to}`)
}

export function getHealth() {
  return request<{ ok: boolean; version: string; searchProvider: string }>('/api/health')
}
