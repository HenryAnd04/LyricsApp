import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LyricsPayload, ManualLyrics, Track } from '../../types'
import { getLyrics, translateLines } from '../../lib/api'
import { buildLyricLines, cleanPlainLyrics } from '../../lib/lrc'
import { detectLanguage } from '../../lib/lang'
import {
  clearCachedLyrics,
  clearManualLyrics,
  getCachedLyrics,
  getCachedTranslations,
  getManualLyrics,
  setCachedLyrics,
  setCachedTranslations,
  setManualLyrics,
  translationSignature,
} from '../../lib/lyricsStore'

export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

function withLanguage(payload: LyricsPayload): LyricsPayload {
  const text = payload.plain || payload.lrc || ''
  const detected = payload.isEnglish === undefined || !payload.languageName
    ? detectLanguage(text)
    : null
  return {
    ...payload,
    isEnglish: payload.isEnglish ?? detected?.isEnglish ?? false,
    languageName: payload.languageName || detected?.name || 'Idioma desconocido',
    language: payload.language || detected?.code || 'und',
  }
}

function manualPayload(track: Track, manual: ManualLyrics): LyricsPayload {
  const isLrc = manual.isLrc
  const built = buildLyricLines({
    lrc: isLrc ? manual.text : '',
    plain: isLrc ? '' : manual.text,
    synced: isLrc,
  })
  const language = detectLanguage(manual.text)
  return {
    found: true,
    id: null,
    source: 'manual',
    title: track.title,
    artist: track.artist,
    album: '',
    duration: track.duration,
    synced: built.synced,
    instrumental: false,
    lrc: isLrc ? manual.text : '',
    plain: isLrc ? '' : cleanPlainLyrics(manual.text),
    language: language.code,
    languageName: language.name,
    isEnglish: language.isEnglish,
    alternatives: [],
    message: '',
    error: '',
    guessed: { title: track.title, artist: track.artist },
  }
}

export interface LyricsState {
  status: LyricsStatus
  data: LyricsPayload | null
  lines: ReturnType<typeof buildLyricLines>['lines']
  synced: boolean
  isEnglish: boolean
  languageName: string
  isManual: boolean
  error: string
  reload: () => void
  applyPayload: (payload: LyricsPayload) => void
  applyManual: (text: string) => void
  removeManual: () => void
}

export function useLyrics(track: Track | null): LyricsState {
  const [status, setStatus] = useState<LyricsStatus>('idle')
  const [data, setData] = useState<LyricsPayload | null>(null)
  const [error, setError] = useState('')
  const [token, setToken] = useState(0)
  const [override, setOverride] = useState<LyricsPayload | null>(null)
  const [manual, setManual] = useState<ManualLyrics | null>(null)
  const skipCacheRef = useRef(false)

  useEffect(() => {
    setOverride(null)
    setToken(0)
    setData(null)
    setError('')
    setStatus(track ? 'loading' : 'idle')
  }, [track?.videoId])

  useEffect(() => {
    if (!track) {
      setStatus('idle')
      setData(null)
      return
    }
    const manualLyrics = getManualLyrics(track.videoId)
    setManual(manualLyrics)
    if (manualLyrics) {
      const payload = manualPayload(track, manualLyrics)
      setData(payload)
      setStatus(payload.plain || payload.lrc ? 'ready' : 'empty')
      return
    }
    if (override) {
      setData(override)
      setStatus('ready')
      return
    }

    if (!skipCacheRef.current) {
      const cached = getCachedLyrics(track.videoId)
      if (cached) {
        const shaped = withLanguage(cached)
        setData(shaped)
        setStatus(shaped.found ? 'ready' : 'empty')
        return
      }
    }
    skipCacheRef.current = false

    const controller = new AbortController()
    setStatus('loading')
    setError('')
    getLyrics(track, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return
        const shaped = withLanguage(payload)
        setCachedLyrics(track.videoId, shaped)
        setData(shaped)
        if (!shaped.found) setStatus('empty')
        else if (shaped.instrumental) setStatus('ready')
        else if (!shaped.plain && !shaped.lrc) setStatus('empty')
        else setStatus('ready')
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || err.name === 'AbortError') return
        setError(err.message || 'No se pudo cargar la letra.')
        setStatus('error')
      })
    return () => controller.abort()
  }, [track, token, override])

  const built = useMemo(() => {
    if (!data) return { lines: [], synced: false }
    if (data.instrumental) return { lines: [], synced: false }
    return buildLyricLines({ lrc: data.lrc, plain: data.plain, synced: data.synced })
  }, [data])

  const reload = useCallback(() => {
    if (track) {
      clearCachedLyrics(track.videoId)
      setOverride(null)
      setData(null)
    }
    skipCacheRef.current = true
    setToken((prev) => prev + 1)
  }, [track])

  const applyPayload = useCallback(
    (payload: LyricsPayload) => {
      if (!track) return
      const shaped = withLanguage(payload)
      setCachedLyrics(track.videoId, shaped)
      setOverride(shaped)
      setData(shaped)
      setError('')
      setStatus(shaped.found ? 'ready' : 'empty')
    },
    [track],
  )

  const applyManual = useCallback(
    (text: string) => {
      if (!track) return
      setManualLyrics(track.videoId, text)
      const payload = manualPayload(track, {
        text,
        isLrc: /\[\d{1,3}:\d{1,2}/.test(text),
        updatedAt: Date.now(),
      })
      setData(payload)
      setStatus(payload.plain || payload.lrc ? 'ready' : 'empty')
      setManual(getManualLyrics(track.videoId))
    },
    [track],
  )

  const removeManual = useCallback(() => {
    if (!track) return
    clearManualLyrics(track.videoId)
    setManual(null)
    setData(null)
    setOverride(null)
    setToken((prev) => prev + 1)
  }, [track])

  return {
    status,
    data,
    lines: built.lines,
    synced: built.synced,
    isEnglish: Boolean(data?.isEnglish),
    languageName: data?.languageName || 'Idioma desconocido',
    isManual: data?.source === 'manual' || Boolean(manual),
    error,
    reload,
    applyPayload,
    applyManual,
    removeManual,
  }
}

export interface TranslationState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  translations: string[]
  error: string
  retry: () => void
}

export function useLyricsTranslation(
  track: Track | null,
  data: LyricsPayload | null,
  syncLines: string[],
  enabled: boolean,
): TranslationState {
  const [status, setStatus] = useState<TranslationState['status']>('idle')
  const [translations, setTranslations] = useState<string[]>([])
  const [error, setError] = useState('')
  const [retryToken, setRetryToken] = useState(0)

  const signature = useMemo(
    () => (syncLines.length ? translationSignature(syncLines, 'en') : ''),
    [syncLines],
  )

  useEffect(() => {
    setTranslations([])
    setError('')
    if (!track || !data || !syncLines.length || data.instrumental || data.isEnglish || !enabled) {
      setStatus('idle')
      return
    }
    const cached = getCachedTranslations(track.videoId, signature)
    if (cached && cached.length === syncLines.length) {
      setTranslations(cached)
      setStatus('ready')
      return
    }
    const controller = new AbortController()
    setStatus('loading')
    translateLines(syncLines, 'en', data.languageIso || 'auto', controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        const lines = syncLines.map((_, i) => result.translations[i] || '')
        setTranslations(lines)
        setStatus('ready')
        setCachedTranslations(track.videoId, signature, lines)
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || err.name === 'AbortError') return
        setError(err.message || 'No se pudo traducir la letra.')
        setStatus('error')
      })
    return () => controller.abort()
  }, [data, enabled, signature, syncLines, track, retryToken])

  return {
    status,
    translations,
    error,
    retry: () => setRetryToken((prev) => prev + 1),
  }
}
