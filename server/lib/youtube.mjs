import { caches } from './cache.mjs'
import { fetchJson, HttpError, USER_AGENT } from './http.mjs'

const CLIENT_VERSION = process.env.YT_CLIENT_VERSION || '2.20260701.00.00'
const YT_BASE = 'https://www.youtube.com'
const WEB_HEADERS = {
  'content-type': 'application/json',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9,es;q=0.8',
  origin: YT_BASE,
  referer: YT_BASE + '/',
}

function innertubeContext(hl = 'en') {
  return {
    client: {
      clientName: 'WEB',
      clientVersion: CLIENT_VERSION,
      hl,
      gl: 'US',
    },
  }
}

function textOf(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.simpleText) return node.simpleText
  if (Array.isArray(node.runs)) return node.runs.map((r) => r.text || '').join('')
  return ''
}

export function parseDuration(text = '') {
  const parts = String(text)
    .trim()
    .split(':')
    .map((n) => Number(n))
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export function cleanArtist(name = '') {
  return String(name)
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*VEVO$/i, '')
    .replace(/\s*Official$/i, '')
    .trim()
}

function pickThumbnail(thumbnails = []) {
  if (!thumbnails.length) return ''
  const preferred = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault']
  for (const name of preferred) {
    const found = thumbnails.find((t) => typeof t.url === 'string' && t.url.includes(name))
    if (found) return found.url
  }
  return thumbnails[thumbnails.length - 1]?.url || ''
}

function normalizeVideoRenderer(v) {
  const videoId = v.videoId
  const title = textOf(v.title)
  const lengthText = textOf(v.lengthText)
  const author = textOf(v.longBylineText) || textOf(v.ownerText)
  const thumbs = v.thumbnail?.thumbnails || []
  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  return {
    id: videoId,
    videoId,
    title,
    artist: cleanArtist(author),
    channel: author,
    thumbnail: pickThumbnail(thumbs) || fallbackThumb,
    duration: parseDuration(lengthText),
    durationText: lengthText,
    views: textOf(v.viewCountText),
    published: textOf(v.publishedTimeText),
    live: !lengthText,
  }
}

function collectVideoRenderers(node, out) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out)
    return
  }
  for (const key of Object.keys(node)) {
    if (key === 'videoRenderer') {
      const v = normalizeVideoRenderer(node[key])
      if (v.videoId) out.push(v)
    } else {
      collectVideoRenderers(node[key], out)
    }
  }
}

function dedupeTracks(tracks) {
  const seen = new Set()
  return tracks.filter((t) => {
    if (!t.videoId || seen.has(t.videoId)) return false
    seen.add(t.videoId)
    return true
  })
}

function filterTracks(tracks) {
  return tracks.filter((t) => !t.live && t.duration >= 30)
}

/** Search using YouTube's public web client — no API key required. */
async function innertubeSearch(query, limit) {
  const res = await fetchJson(
    `${YT_BASE}/youtubei/v1/search?prettyPrint=false`,
    {
      method: 'POST',
      headers: WEB_HEADERS,
      body: JSON.stringify({
        context: innertubeContext(),
        query,
        params: 'EgIQAQ==', // only videos
      }),
    },
    12000,
    1,
  )
  const found = []
  collectVideoRenderers(res, found)
  // If the first page is mostly irrelevant padding, that's still fine.
  return dedupeTracks(found).slice(0, limit)
}

/** Search using the official Data API when a key is available. */
async function dataApiSearch(query, limit) {
  const key = process.env.YOUTUBE_API_KEY
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.searchParams.set('part', 'snippet')
  searchUrl.searchParams.set('type', 'video')
  searchUrl.searchParams.set('maxResults', String(Math.min(50, Math.max(limit, 10))))
  searchUrl.searchParams.set('q', query)
  searchUrl.searchParams.set('key', key)
  const search = await fetchJson(searchUrl, {}, 9000, 1)
  const ids = (search.items || []).map((i) => i.id?.videoId).filter(Boolean)
  if (!ids.length) return []

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
  videosUrl.searchParams.set('part', 'snippet,contentDetails')
  videosUrl.searchParams.set('id', ids.join(','))
  videosUrl.searchParams.set('key', key)
  const videos = await fetchJson(videosUrl, {}, 9000, 1)

  const byId = new Map((videos.items || []).map((v) => [v.id, v]))
  const out = ids
    .map((id) => {
      const v = byId.get(id)
      if (!v) return null
      const iso = v.contentDetails?.duration || 'PT0S'
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      const duration = m
        ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)
        : 0
      return {
        id,
        videoId: id,
        title: v.snippet?.title || '',
        artist: cleanArtist(v.snippet?.channelTitle || ''),
        channel: v.snippet?.channelTitle || '',
        thumbnail:
          v.snippet?.thumbnails?.maxres?.url ||
          v.snippet?.thumbnails?.high?.url ||
          v.snippet?.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration,
        durationText: '',
        views: '',
        published: v.snippet?.publishedAt ? String(v.snippet.publishedAt).slice(0, 10) : '',
        live: false,
      }
    })
    .filter(Boolean)
  return out
}

export async function searchYouTube(query, limit = 24) {
  const clean = String(query || '').trim()
  if (!clean) throw new HttpError(400, 'Missing search query')
  const cacheKey = `${clean.toLowerCase()}|${limit}`
  const cached = caches.search.get(cacheKey)
  if (cached) return cached

  let tracks = []
  let source = 'youtube-web'
  if (process.env.YOUTUBE_API_KEY) {
    try {
      tracks = await dataApiSearch(clean, limit)
      source = 'youtube-data-api'
    } catch (err) {
      console.warn('[search] Data API failed, falling back to web:', err.message)
    }
  }
  if (!tracks.length) {
    tracks = await innertubeSearch(clean, limit + 8)
    source = 'youtube-web'
  }
  tracks = filterTracks(tracks).slice(0, limit)
  const result = { source, query: clean, tracks }
  caches.search.set(cacheKey, result)
  return result
}

/** Full metadata for one video (also used when adding a video by URL). */
export async function getVideoMeta(videoId) {
  const cached = caches.video.get(videoId)
  if (cached) return cached

  let result = null
  try {
    const res = await fetchJson(
      `${YT_BASE}/youtubei/v1/player?prettyPrint=false`,
      {
        method: 'POST',
        headers: WEB_HEADERS,
        body: JSON.stringify({
          context: innertubeContext(),
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      },
      12000,
      1,
    )
    const details = res.videoDetails
    if (details) {
      const thumbs = details.thumbnail?.thumbnails || []
      result = {
        id: videoId,
        videoId,
        title: details.title || '',
        artist: cleanArtist(details.author || ''),
        channel: details.author || '',
        thumbnail: pickThumbnail(thumbs) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: Number(details.lengthSeconds || 0),
        durationText: '',
        views: '',
        published: '',
        live: Boolean(details.isLiveContent && details.isLive),
        playable: res.playabilityStatus?.status === 'OK',
        playabilityReason: res.playabilityStatus?.reason || '',
      }
    }
  } catch (err) {
    console.warn('[video] innertube failed:', err.message)
  }

  if (!result) {
    const oembed = await getOembed(videoId).catch(() => null)
    if (oembed) {
      result = {
        id: videoId,
        videoId,
        title: oembed.title,
        artist: cleanArtist(oembed.author_name),
        channel: oembed.author_name,
        thumbnail: oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        durationText: '',
        views: '',
        published: '',
        live: false,
        playable: true,
        playabilityReason: '',
      }
    }
  }

  if (!result) throw new HttpError(404, 'No se encontró información de este video')
  caches.video.set(videoId, result)
  return result
}

export async function getOembed(videoId) {
  const url = new URL('https://www.youtube.com/oembed')
  url.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`)
  url.searchParams.set('format', 'json')
  return fetchJson(url, {}, 8000, 0)
}

export function extractVideoId(input) {
  const value = String(input || '').trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/(?:embed|shorts|live|v)\/)([a-zA-Z0-9_-]{11})/,
    /(?:music\.youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
  ]
  for (const re of patterns) {
    const m = value.match(re)
    if (m) return m[1]
  }
  return null
}

/** Fetch suggestions for the search box. Falls back silently. */
export async function searchSuggestions(query) {
  const clean = String(query || '').trim()
  if (!clean) return []
  const key = `suggest|${clean.toLowerCase()}`
  const cached = caches.search.get(key)
  if (cached) return cached
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&q=${encodeURIComponent(clean)}`,
      { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data?.[1]) ? data[1].slice(0, 8) : []
    caches.search.set(key, items, 1000 * 60 * 60)
    return items
  } catch {
    return []
  }
}
