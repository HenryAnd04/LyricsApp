import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extractVideoId, getVideoMeta, searchSuggestions, searchYouTube } from './lib/youtube.mjs'
import { findLyrics, getLyricsById, guessTrackInfo } from './lib/lyrics.mjs'
import { lookupWord, translateLyricLines } from './lib/translate.mjs'
import { HttpError } from './lib/http.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8787)

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  const origin = req.headers.origin
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
  }
  const started = Date.now()
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`)
    }
  })
  next()
})

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: '1.0.0',
    searchProvider: process.env.YOUTUBE_API_KEY ? 'youtube-data-api' : 'youtube-web',
    time: new Date().toISOString(),
  })
})

app.get(
  '/api/search',
  asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q) throw new HttpError(400, 'Falta el término de búsqueda')
    const limit = Math.min(40, Math.max(1, Number(req.query.limit) || 24))
    const result = await searchYouTube(q, limit)
    res.json(result)
  }),
)

app.get(
  '/api/suggest',
  asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').trim()
    const items = q ? await searchSuggestions(q) : []
    res.json({ items })
  }),
)

app.get(
  '/api/track',
  asyncRoute(async (req, res) => {
    const raw = String(req.query.url || req.query.id || '').trim()
    const videoId = extractVideoId(raw)
    if (!videoId) throw new HttpError(400, 'Enlace de YouTube no válido')
    const meta = await getVideoMeta(videoId)
    res.json(meta)
  }),
)

app.get(
  '/api/lyrics',
  asyncRoute(async (req, res) => {
    const id = String(req.query.id || '').trim()
    if (id) {
      const found = await getLyricsById(id)
      if (!found) throw new HttpError(404, 'No se encontró esa letra')
      return res.json(found)
    }

    const rawTitle = String(req.query.title || '').trim()
    if (!rawTitle) throw new HttpError(400, 'Falta el título de la canción')
    const artist = String(req.query.artist || '').trim()
    const album = String(req.query.album || '').trim()
    const duration = Number(req.query.duration) || 0
    const guessed = guessTrackInfo(rawTitle, artist)

    const result = await findLyrics({
      title: guessed.title || rawTitle,
      artist: artist || guessed.artist,
      album,
      duration,
    })
    res.json({ ...result, guessed })
  }),
)

app.post(
  '/api/translate',
  asyncRoute(async (req, res) => {
    const { lines, to = 'en', from = 'auto' } = req.body || {}
    if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
      throw new HttpError(400, 'Se esperaba un array de líneas de texto')
    }
    if (!/^[a-zA-Z-]{2,8}$/.test(String(to))) throw new HttpError(400, 'Idioma destino no válido')
    const translations = await translateLyricLines(lines, String(to), String(from))
    res.json({ to, from, translations })
  }),
)

app.get(
  '/api/word',
  asyncRoute(async (req, res) => {
    const word = String(req.query.w || '').trim()
    if (!word) throw new HttpError(400, 'Falta la palabra')
    const to = String(req.query.to || 'es')
    const result = await lookupWord(word, to)
    if (!result.found) throw new HttpError(404, 'No encontramos esa palabra')
    res.json(result)
  }),
)

// Production: serve the built SPA.
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(
    express.static(DIST, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
      },
    }),
  )
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(DIST, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send(
        'LyricsApp API funcionando. En desarrollo abre http://localhost:5173 (npm run dev).\n' +
          'Para servir la app compilada: npm run build && npm start.',
      )
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' })
})

app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : err.status || 500
  if (status >= 500) console.error('[api error]', err)
  res.status(status).json({
    error: err.message || 'Error inesperado',
    ...(err.details ? { details: err.details } : {}),
  })
})

const server = app.listen(PORT, () => {
  console.log(`\n  LyricsApp API → http://localhost:${PORT}`)
  console.log(`  Búsqueda: ${process.env.YOUTUBE_API_KEY ? 'YouTube Data API' : 'YouTube web (sin API key)'}`)
  console.log(`  Frontend: ${fs.existsSync(path.join(DIST, 'index.html')) ? 'dist compilado' : 'usa npm run dev (Vite)'}\n`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
