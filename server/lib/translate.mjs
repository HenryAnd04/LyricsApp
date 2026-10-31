import { createHash } from 'node:crypto'
import { caches } from './cache.mjs'
import { fetchWithTimeout, HttpError, USER_AGENT } from './http.mjs'

const GTX = 'https://translate.googleapis.com/translate_a/single'
const MAX_CHUNK = 1600
const SECTION_TAG = /^\s*[\[(].*[\])]\s*$/
const MUSICAL_MARK = /^[\s♪♫•\-–—.,!?]+$/

function hash(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 24)
}

function parseGtx(data) {
  if (!Array.isArray(data?.[0])) return ''
  return data[0].map((segment) => (Array.isArray(segment) ? segment[0] || '' : '')).join('')
}

/** Google's public translate endpoint (same one used by the web widget). */
export async function gtxTranslate(text, to = 'en', from = 'auto') {
  const url = new URL(GTX)
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', from)
  url.searchParams.set('tl', to)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/json,text/plain,*/*',
      },
    },
    12000,
    0,
  )
  if (!res.ok) throw new HttpError(res.status, `Translate service responded ${res.status}`)
  const data = await res.json()
  const translated = parseGtx(data)
  if (!translated) throw new HttpError(502, 'Translate service returned an empty result')
  return {
    text: translated,
    detected: typeof data?.[2] === 'string' ? data[2] : '',
  }
}

async function myMemoryTranslate(text, to, from = 'en') {
  const url = new URL('https://api.mymemory.translated.net/get')
  url.searchParams.set('q', text.slice(0, 500))
  url.searchParams.set('langpair', `${from === 'auto' ? 'en' : from}|${to}`)
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 8000, 0)
  if (!res.ok) throw new HttpError(res.status, 'Translation fallback failed')
  const data = await res.json()
  const translated = data?.responseData?.translatedText
  if (!translated) throw new HttpError(502, 'Translation fallback returned nothing')
  return String(translated)
}

/** Translate a single word or short phrase, with caching. */
export async function translateShort(text, to = 'es', from = 'auto') {
  const clean = String(text || '').trim()
  if (!clean) return ''
  const key = `s|${from}|${to}|${clean.toLowerCase()}`
  const cached = caches.translation.get(key)
  if (cached) return cached
  let value = ''
  try {
    const result = await gtxTranslate(clean, to, from)
    value = result.text.trim()
  } catch (err) {
    console.warn('[translate] gtx failed:', err.message)
    try {
      value = await myMemoryTranslate(clean, to, from === 'auto' ? 'en' : from)
    } catch (fallbackErr) {
      console.warn('[translate] fallback failed:', fallbackErr.message)
    }
  }
  if (value) caches.translation.set(key, value)
  return value
}

function splitIntoChunks(lines, limit) {
  const chunks = []
  let current = []
  let size = 0
  for (const line of lines) {
    const add = line.length + 1
    if (current.length && size + add > limit) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(line)
    size += add
  }
  if (current.length) chunks.push(current)
  return chunks
}

async function translateChunk(lines, to, from) {
  const joined = lines.join('\n')
  const key = `l|${from}|${to}|${hash(joined)}`
  const cached = caches.translation.get(key)
  if (cached) return cached

  let result
  try {
    const { text } = await gtxTranslate(joined, to, from)
    let out = text.replace(/\r/g, '').split('\n')
    // Trim artifacts while keeping line-level alignment.
    out = out.map((line) => line.replace(/^\s+|\s+$/g, ''))
    if (out.length !== lines.length) {
      // Alignment broke (rare): translate every line individually.
      out = await Promise.all(
        lines.map((line) =>
          gtxTranslate(line, to, from)
            .then((r) => r.text.trim())
            .catch(() => ''),
        ),
      )
    }
    result = out
  } catch (err) {
    console.warn('[translate] chunk failed, trying per-line:', err.message)
    result = await Promise.all(
      lines.map((line) =>
        translateShort(line, to, from === 'auto' ? 'en' : from).catch(() => ''),
      ),
    )
  }
  if (result.every((line) => !line)) throw new HttpError(502, 'No se pudo traducir la letra')
  caches.translation.set(key, result)
  return result
}

/**
 * Translate lyric lines preserving one-to-one alignment.
 * Section tags and blank lines are left untouched (mapped to "").
 */
export async function translateLyricLines(lines, to = 'en', from = 'auto') {
  if (!Array.isArray(lines)) throw new HttpError(400, 'lines must be an array')
  if (lines.length > 800) throw new HttpError(413, 'Too many lines')
  const translations = new Array(lines.length).fill('')

  const indexes = []
  const payload = []
  lines.forEach((line, i) => {
    const text = String(line ?? '').trim()
    if (!text || SECTION_TAG.test(text) || MUSICAL_MARK.test(text)) return
    indexes.push(i)
    payload.push(text)
  })
  if (!payload.length) return translations

  const chunks = splitIntoChunks(payload, MAX_CHUNK)
  let cursor = 0
  // Sequential on purpose: keeps ordering and is gentle on the public endpoint.
  for (const chunk of chunks) {
    const translated = await translateChunk(chunk, to, from)
    for (let i = 0; i < chunk.length; i++) {
      translations[indexes[cursor + i]] = translated[i] || ''
    }
    cursor += chunk.length
  }
  return translations
}

const DICT_API = 'https://api.dictionaryapi.dev/api/v2/entries/en'

export async function lookupWord(rawWord, to = 'es') {
  const word = String(rawWord || '')
    .trim()
    .replace(/^[^\p{L}]+|[^\p{L}']+$/gu, '')
  if (!word || word.length > 40) throw new HttpError(400, 'Palabra no válida')
  const key = `w|${to}|${word.toLowerCase()}`
  const cached = caches.word.get(key)
  if (cached) return cached

  const [translation, dictionary] = await Promise.allSettled([
    translateShort(word, to, 'en'),
    fetchWithTimeout(
      `${DICT_API}/${encodeURIComponent(word.toLowerCase())}`,
      { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } },
      7000,
      0,
    ).then(async (res) => {
      if (!res.ok) return null
      return res.json()
    }),
  ])

  const entries = dictionary.status === 'fulfilled' ? dictionary.value : null
  const first = Array.isArray(entries) ? entries[0] : null
  const phonetic =
    first?.phonetic || first?.phonetics?.find((p) => p?.text)?.text || ''
  const audio =
    first?.phonetics?.find((p) => p?.audio)?.audio || ''
  const meanings = []
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const meaning of entry.meanings || []) {
      const def = meaning.definitions?.[0]
      if (!def) continue
      meanings.push({
        partOfSpeech: meaning.partOfSpeech || '',
        definition: def.definition || '',
        example: def.example || '',
      })
      if (meanings.length >= 4) break
    }
    if (meanings.length >= 4) break
  }

  const result = {
    word,
    translation: translation.status === 'fulfilled' ? translation.value : '',
    phonetic,
    audio,
    meanings,
    found: Boolean(translation.value || meanings.length),
  }
  if (result.found) caches.word.set(key, result)
  return result
}
