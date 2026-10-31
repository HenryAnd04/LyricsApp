import { franc } from 'franc-min'
import { caches } from './cache.mjs'
import { fetchJson, fetchWithTimeout, normalizeText, similarity, USER_AGENT } from './http.mjs'

const LRCLIB = 'https://lrclib.net/api'
const LRCLIB_HEADERS = {
  Accept: 'application/json',
  'User-Agent': USER_AGENT,
  'Lrclib-Client': USER_AGENT,
}

const LANGUAGE_NAMES = {
  eng: 'Inglés',
  spa: 'Español',
  por: 'Portugués',
  ita: 'Italiano',
  fra: 'Francés',
  deu: 'Alemán',
  nld: 'Neerlandés',
  swe: 'Sueco',
  pol: 'Polaco',
  rus: 'Ruso',
  ukr: 'Ucraniano',
  jpn: 'Japonés',
  kor: 'Coreano',
  zho: 'Chino',
  ara: 'Árabe',
  hin: 'Hindi',
  tur: 'Turco',
  ind: 'Indonesio',
  tha: 'Tailandés',
  vie: 'Vietnamita',
  ell: 'Griego',
  heb: 'Hebreo',
  ron: 'Rumano',
  ces: 'Checo',
  dan: 'Danés',
  fin: 'Finés',
  nor: 'Noruego',
  hun: 'Húngaro',
  cat: 'Catalán',
  fil: 'Filipino',
}
const LANGUAGE_CODES = {
  eng: 'en', spa: 'es', por: 'pt', ita: 'it', fra: 'fr', deu: 'de', nld: 'nl',
  swe: 'sv', pol: 'pl', rus: 'ru', ukr: 'uk', jpn: 'ja', kor: 'ko', zho: 'zh-CN',
  ara: 'ar', hin: 'hi', tur: 'tr', ind: 'id', tha: 'th', vie: 'vi', ell: 'el',
  heb: 'he', ron: 'ro', ces: 'cs', dan: 'da', fin: 'fi', nor: 'no', hun: 'hu',
  cat: 'ca', fil: 'tl',
}

const NOISE_PATTERN =
  /\b(official|oficial|video|vídeo|videoclip|lyric[s]?|letra|audio|visualizer|visualiser|hd|hq|4k|remaster(ed)?|en vivo|live|performance|mv|m\/v|clip officiel|paroles|subtitulad[oa]s?|traducci[oó]n|color coded|clean|explicit)\b/i

/** Remove "Official Video", "[Lyrics]", "| Album" and similar noise from a YouTube title. */
export function cleanTrackTitle(rawTitle = '') {
  let title = String(rawTitle)
  // Drop bracketed/parenthesised chunks that are pure noise (keep "[Remix]" etc.)
  title = title.replace(/[([{]([^)\]}]*)[)\]}]/g, (full, inner) =>
    NOISE_PATTERN.test(inner) ? ' ' : full,
  )
  // Drop "| Album Name" tail only when it follows the main title with a pipe.
  title = title.replace(/\s*\|\s*[^|]*$/g, ' ')
  return title.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim()
}

function stripFeat(title) {
  return title
    .replace(/\s*[([]?\s*(feat\.?|ft\.?|featuring)\s+[^)\]]+[)\]]?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Best-effort split of "Artist - Song" / "Song | Artist" YouTube titles. */
export function guessTrackInfo(rawTitle = '', channel = '') {
  let title = cleanTrackTitle(rawTitle)
  let artist = String(channel || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim()

  const channelNorm = normalizeText(artist)
  const parts = title.split(/\s+[-–—]\s+/)
  if (parts.length >= 2) {
    const left = parts[0].trim()
    const right = parts.slice(1).join(' - ').trim()
    const leftNorm = normalizeText(left)
    const looksLikeChannel =
      channelNorm && (channelNorm.includes(leftNorm) || leftNorm.includes(channelNorm))
    if (looksLikeChannel && right.length > 1) {
      title = right
    } else if (!channelNorm && left.length <= 40) {
      artist = left
      title = right
    }
  }

  // "Song | Artist" style
  if (title.includes('|')) {
    const [first, ...rest] = title.split('|').map((s) => s.trim())
    const tail = rest.join(' | ').trim()
    if (tail && channelNorm && normalizeText(tail).includes(channelNorm.slice(0, 8))) {
      title = first
    }
  }

  title = stripFeat(cleanTrackTitle(title))
  if (artist) artist = stripFeat(artist)
  return { title: title || String(rawTitle), artist }
}

function normalizeLyricsText(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function detectLanguage(text) {
  if (!text || text.length < 12) {
    return { code: 'und', iso: '', name: 'Desconocido', isEnglish: false }
  }
  let code = 'und'
  try {
    code = franc(text, { minLength: 10, only: Object.keys(LANGUAGE_NAMES) })
  } catch {
    code = 'und'
  }
  if (code === 'und') {
    const ascii = text.replace(/[^\x20-\x7E\n]/g, '').length / text.length
    if (ascii > 0.97) code = 'eng'
  }
  const isEnglish = code === 'eng'
  return {
    code,
    iso: LANGUAGE_CODES[code] || '',
    name: LANGUAGE_NAMES[code] || 'Desconocido',
    isEnglish,
  }
}

function scoreCandidate(candidate, wanted) {
  const title = candidate.trackName || candidate.title || ''
  const artist = candidate.artistName || candidate.artist || ''
  let score = similarity(wanted.title, title) * 0.62
  if (wanted.artist) score += similarity(wanted.artist, artist) * 0.26
  else score += 0.13
  if (wanted.duration && candidate.duration) {
    const diff = Math.abs(Number(wanted.duration) - Number(candidate.duration))
    score += Math.max(0, 1 - diff / 25) * 0.12
  }
  if (candidate.syncedLyrics) score += 0.06
  if (candidate.instrumental) score -= 0.25
  return Math.min(1, score)
}

function shapeCandidate(c) {
  const synced = c.syncedLyrics ? normalizeLyricsText(c.syncedLyrics) : ''
  const plain = c.plainLyrics ? normalizeLyricsText(c.plainLyrics) : ''
  return {
    id: c.id,
    source: 'lrclib',
    title: c.trackName || '',
    artist: c.artistName || '',
    album: c.albumName || '',
    duration: c.duration || 0,
    synced: Boolean(synced),
    instrumental: Boolean(c.instrumental),
    lrc: synced,
    plain,
    score: 0,
  }
}

async function lrclibSearch(params) {
  const url = new URL(`${LRCLIB}/search`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  try {
    const data = await fetchJson(url, { headers: LRCLIB_HEADERS }, 9000, 1)
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.warn('[lyrics] lrclib search failed:', err.message)
    return []
  }
}

async function lrclibGet(id) {
  try {
    return await fetchJson(`${LRCLIB}/get/${encodeURIComponent(id)}`, { headers: LRCLIB_HEADERS }, 9000, 1)
  } catch (err) {
    console.warn('[lyrics] lrclib get failed:', err.message)
    return null
  }
}

async function lyricsOvh(artist, title) {
  if (!artist || !title) return null
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 8000, 0)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.lyrics) return null
    return normalizeLyricsText(data.lyrics)
  } catch (err) {
    console.warn('[lyrics] lyrics.ovh failed:', err.message)
    return null
  }
}

function buildAlternative(c) {
  return {
    id: c.id,
    title: c.title || c.trackName,
    artist: c.artist || c.artistName,
    album: c.album || c.albumName,
    duration: c.duration || 0,
    synced: Boolean(c.synced ?? c.syncedLyrics),
  }
}

/**
 * Find the best lyrics match for a track.
 * @param {{artist?:string,title:string,album?:string,duration?:number}} track
 */
export async function findLyrics(track) {
  const wanted = {
    title: cleanTrackTitle(track.title || ''),
    artist: String(track.artist || '').trim(),
    duration: Number(track.duration) || 0,
  }
  const cacheKey = `${normalizeText(wanted.artist)}|${normalizeText(wanted.title)}|${Math.round(wanted.duration / 2)}`
  const cached = caches.lyrics.get(cacheKey)
  if (cached) return cached

  const queries = []
  const seenQueries = new Set()
  const addQuery = (params) => {
    const key = JSON.stringify(params)
    if (seenQueries.has(key)) return
    seenQueries.add(key)
    queries.push(params)
  }
  if (wanted.artist && wanted.title) addQuery({ track_name: wanted.title, artist_name: wanted.artist })
  if (wanted.artist && wanted.title) addQuery({ track_name: stripFeat(wanted.title), artist_name: wanted.artist })
  if (wanted.title) addQuery({ q: `${wanted.artist} ${wanted.title}`.trim() })
  if (wanted.title) addQuery({ q: wanted.title })

  const settled = await Promise.allSettled(queries.slice(0, 4).map((q) => lrclibSearch(q)))
  const raw = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  const seen = new Set()
  const candidates = []
  for (const item of raw) {
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    const shaped = shapeCandidate(item)
    shaped.score = scoreCandidate(item, wanted)
    candidates.push(shaped)
  }
  candidates.sort((a, b) => b.score - a.score)
  const usable = candidates.filter((c) => c.plain || c.lrc || c.instrumental)
  const best = usable[0]

  let payload = null
  if (best && best.score >= 0.42) {
    payload = {
      found: true,
      ...best,
      requested: wanted,
      alternatives: usable.slice(1, 7).map(buildAlternative),
    }
  } else {
    // Last-resort plain lyrics provider.
    const plain = await lyricsOvh(wanted.artist, wanted.title)
    if (plain) {
      payload = {
        found: true,
        id: null,
        source: 'lyrics.ovh',
        title: wanted.title,
        artist: wanted.artist,
        album: '',
        duration: wanted.duration,
        synced: false,
        instrumental: false,
        lrc: '',
        plain,
        score: 0,
        requested: wanted,
        alternatives: usable.slice(0, 6).map(buildAlternative),
      }
    } else {
      payload = {
        found: false,
        requested: wanted,
        alternatives: usable.slice(0, 6).map(buildAlternative),
        message: 'No encontramos la letra de esta canción en las fuentes disponibles.',
      }
    }
  }

  if (payload.found && !payload.instrumental) {
    const sample = payload.plain || payload.lrc
    const language = detectLanguage(sample)
    payload.language = language.code
    payload.languageIso = language.iso
    payload.languageName = language.name
    payload.isEnglish = language.isEnglish
    if (payload.isEnglish && payload.plain) {
      payload.plain = payload.plain
    }
  }

  caches.lyrics.set(cacheKey, payload)
  return payload
}

export async function getLyricsById(id) {
  const data = await lrclibGet(id)
  if (!data) return null
  const shaped = shapeCandidate(data)
  const sample = shaped.plain || shaped.lrc
  const language = detectLanguage(sample)
  return {
    found: true,
    ...shaped,
    language: language.code,
    languageIso: language.iso,
    languageName: language.name,
    isEnglish: language.isEnglish,
    alternatives: [],
  }
}

export { detectLanguage }
