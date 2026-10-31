import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import type { QueuedTrack, Track } from '../types'
import { clamp, uid } from '../lib/format'
import { usePersistentState } from '../lib/storage'
import { loadYouTubeApi, YT_STATE, youtubeErrorMessage, type YTPlayer } from '../lib/youtube'
import { useLibrary } from './LibraryContext'

export type RepeatMode = 'off' | 'all' | 'one'
export type PlayerSlotKind = 'stage' | 'dock'

export interface PlayerRect {
  top: number
  left: number
  width: number
  height: number
  radius: number
}

interface VideoError {
  code: number
  message: string
}

interface PendingLoad {
  item: QueuedTrack
  autoplay: boolean
}

interface PlayerApi {
  queue: QueuedTrack[]
  index: number
  current: QueuedTrack | null
  playing: boolean
  buffering: boolean
  ready: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  videoError: VideoError | null
  playerInitError: string | null
  playNow: (track: Track, list?: Track[]) => void
  playQueue: (tracks: Track[], startIndex?: number) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  addToQueue: (track: Track, mode?: 'end' | 'next') => void
  removeFromQueue: (entryUid: string) => void
  clearQueue: () => void
  jumpTo: (index: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setPlayerSlot: (kind: PlayerSlotKind, rect: PlayerRect | null) => void
  clearVideoError: () => void
  reloadCurrent: () => void
}

const PlayerContext = createContext<PlayerApi | null>(null)

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider')
  return ctx
}

function toQueued(track: Track): QueuedTrack {
  const existing = track as QueuedTrack
  return { ...track, uid: existing.uid || uid('t') }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { addRecent } = useLibrary()
  const [queue, setQueue] = usePersistentState<QueuedTrack[]>('queue', [])
  const [index, setIndex] = usePersistentState<number>('queue-index', -1)
  const [volume, setVolumeState] = usePersistentState<number>('volume', 75)
  const [shuffle, setShuffle] = usePersistentState<boolean>('shuffle', false)
  const [repeat, setRepeat] = usePersistentState<RepeatMode>('repeat', 'off')

  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [ready, setReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [videoError, setVideoError] = useState<VideoError | null>(null)
  const [playerInitError, setPlayerInitError] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ stage: PlayerRect | null; dock: PlayerRect | null }>({
    stage: null,
    dock: null,
  })

  const queueRef = useRef(queue)
  const indexRef = useRef(index)
  const repeatRef = useRef(repeat)
  const shuffleRef = useRef(shuffle)
  const volumeRef = useRef(volume)
  const playingRef = useRef(false)
  const durationRef = useRef(0)
  const playerRef = useRef<YTPlayer | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const loadedIdRef = useRef<string | null>(null)
  const pendingRef = useRef<PendingLoad | null>(null)
  const addRecentRef = useRef(addRecent)
  const endedRef = useRef<() => void>(() => {})

  addRecentRef.current = addRecent
  repeatRef.current = repeat
  shuffleRef.current = shuffle
  volumeRef.current = volume
  playingRef.current = playing

  const applyQueue = useCallback(
    (next: QueuedTrack[]) => {
      queueRef.current = next
      setQueue(next)
    },
    [setQueue],
  )

  const applyIndex = useCallback(
    (next: number) => {
      indexRef.current = next
      setIndex(next)
    },
    [setIndex],
  )

  const startTrack = useCallback((item: QueuedTrack, autoplay = true) => {
    loadedIdRef.current = item.videoId
    setCurrentTime(0)
    setDuration(item.duration || 0)
    durationRef.current = item.duration || 0
    setBuffering(true)
    setVideoError(null)
    setPlaying(autoplay)
    addRecentRef.current(item)

    const player = playerRef.current
    if (!player) {
      pendingRef.current = { item, autoplay }
      return
    }
    try {
      if (autoplay) player.loadVideoById(item.videoId)
      else player.cueVideoById(item.videoId)
    } catch {
      setBuffering(false)
      setPlaying(false)
      setVideoError({ code: 0, message: 'No se pudo cargar el video en el reproductor.' })
    }
  }, [])

  const current = queue[index] ?? null

  const playQueue = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (!tracks.length) return
      const queued = tracks.map(toQueued)
      const safeIndex = clamp(startIndex, 0, queued.length - 1)
      applyQueue(queued)
      applyIndex(safeIndex)
      startTrack(queued[safeIndex], true)
    },
    [applyIndex, applyQueue, startTrack],
  )

  const playNow = useCallback(
    (track: Track, list?: Track[]) => {
      if (list && list.length) {
        const found = list.findIndex((t) => t.videoId === track.videoId)
        playQueue(list, found >= 0 ? found : 0)
        return
      }
      const existing = queueRef.current.findIndex((t) => t.videoId === track.videoId)
      if (existing >= 0) {
        applyIndex(existing)
        startTrack(queueRef.current[existing], true)
        return
      }
      const queued = toQueued(track)
      applyQueue([...queueRef.current, queued])
      applyIndex(queueRef.current.length)
      startTrack(queued, true)
    },
    [applyIndex, applyQueue, playQueue, startTrack],
  )

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    const item = queueRef.current[indexRef.current]
    if (!item || !player) return
    if (loadedIdRef.current !== item.videoId) {
      startTrack(item, true)
      return
    }
    try {
      const state = player.getPlayerState()
      if (state === YT_STATE.PLAYING) {
        player.pauseVideo()
        setPlaying(false)
      } else {
        if (state === YT_STATE.ENDED) player.seekTo(0, true)
        player.playVideo()
        setPlaying(true)
      }
    } catch {
      startTrack(item, true)
    }
  }, [startTrack])

  const seek = useCallback((time: number) => {
    const player = playerRef.current
    if (!player) return
    const max = durationRef.current || player.getDuration() || 0
    const next = clamp(time, 0, max || time)
    try {
      player.seekTo(next, true)
      setCurrentTime(next)
    } catch {
      /* ignore */
    }
  }, [])

  const pickShuffleIndex = useCallback(() => {
    const q = queueRef.current
    if (q.length < 2) return indexRef.current
    let next = indexRef.current
    while (next === indexRef.current) next = Math.floor(Math.random() * q.length)
    return next
  }, [])

  const next = useCallback(() => {
    const q = queueRef.current
    if (!q.length) return
    if (shuffleRef.current) {
      const target = pickShuffleIndex()
      applyIndex(target)
      startTrack(q[target], true)
      return
    }
    if (indexRef.current < q.length - 1) {
      const target = indexRef.current + 1
      applyIndex(target)
      startTrack(q[target], true)
    } else {
      applyIndex(0)
      startTrack(q[0], true)
    }
  }, [applyIndex, pickShuffleIndex, startTrack])

  const prev = useCallback(() => {
    const q = queueRef.current
    if (!q.length) return
    const player = playerRef.current
    const time = player?.getCurrentTime?.() ?? 0
    if (time > 3) {
      seek(0)
      return
    }
    if (indexRef.current > 0) {
      const target = indexRef.current - 1
      applyIndex(target)
      startTrack(q[target], true)
    } else {
      seek(0)
    }
  }, [applyIndex, seek, startTrack])

  const handleEnded = useCallback(() => {
    const q = queueRef.current
    const i = indexRef.current
    setPlaying(false)
    if (!q.length) return
    if (repeatRef.current === 'one') {
      seek(0)
      playerRef.current?.playVideo()
      setPlaying(true)
      return
    }
    if (shuffleRef.current) {
      const target = pickShuffleIndex()
      applyIndex(target)
      startTrack(q[target], true)
      return
    }
    if (i < q.length - 1) {
      applyIndex(i + 1)
      startTrack(q[i + 1], true)
      return
    }
    if (repeatRef.current === 'all') {
      applyIndex(0)
      startTrack(q[0], true)
      return
    }
    setCurrentTime(durationRef.current)
  }, [applyIndex, pickShuffleIndex, seek, startTrack])

  endedRef.current = handleEnded

  const setVolume = useCallback(
    (value: number) => {
      const next = clamp(Math.round(value), 0, 100)
      setVolumeState(next)
      volumeRef.current = next
      const player = playerRef.current
      if (player) {
        try {
          player.setVolume(next)
          if (next > 0 && player.isMuted()) {
            player.unMute()
            setMuted(false)
          }
        } catch {
          /* ignore */
        }
      }
      if (next > 0) setMuted(false)
    },
    [setVolumeState],
  )

  const toggleMute = useCallback(() => {
    const player = playerRef.current
    setMuted((prev) => {
      const next = !prev
      try {
        if (player) {
          if (next) player.mute()
          else player.unMute()
        }
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const addToQueue = useCallback(
    (track: Track, mode: 'end' | 'next' = 'end') => {
      if (!queueRef.current.length) {
        playNow(track)
        return
      }
      const queued = toQueued(track)
      const q = queueRef.current
      const insertAt = mode === 'next' ? indexRef.current + 1 : q.length
      const nextQueue = [...q.slice(0, insertAt), queued, ...q.slice(insertAt)]
      applyQueue(nextQueue)
    },
    [applyQueue, playNow],
  )

  const removeFromQueue = useCallback(
    (entryUid: string) => {
      const q = queueRef.current
      const removeAt = q.findIndex((t) => t.uid === entryUid)
      if (removeAt < 0) return
      const nextQueue = q.filter((t) => t.uid !== entryUid)

      if (!nextQueue.length) {
        playerRef.current?.stopVideo()
        applyQueue([])
        applyIndex(-1)
        setPlaying(false)
        setCurrentTime(0)
        setDuration(0)
        loadedIdRef.current = null
        return
      }

      if (removeAt < indexRef.current) {
        applyQueue(nextQueue)
        applyIndex(indexRef.current - 1)
        return
      }
      if (removeAt === indexRef.current) {
        const target = Math.min(removeAt, nextQueue.length - 1)
        applyQueue(nextQueue)
        applyIndex(target)
        startTrack(nextQueue[target], playingRef.current)
        return
      }
      applyQueue(nextQueue)
    },
    [applyIndex, applyQueue, startTrack],
  )

  const clearQueue = useCallback(() => {
    try {
      playerRef.current?.stopVideo()
    } catch {
      /* ignore */
    }
    applyQueue([])
    applyIndex(-1)
    setPlaying(false)
    setBuffering(false)
    setCurrentTime(0)
    setDuration(0)
    setVideoError(null)
    loadedIdRef.current = null
  }, [applyIndex, applyQueue])

  const jumpTo = useCallback(
    (target: number) => {
      const item = queueRef.current[target]
      if (!item) return
      applyIndex(target)
      startTrack(item, true)
    },
    [applyIndex, startTrack],
  )

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev)
  }, [setShuffle])

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'))
  }, [setRepeat])

  const setPlayerSlot = useCallback((kind: PlayerSlotKind, rect: PlayerRect | null) => {
    setSlots((prev) => {
      const currentRect = prev[kind]
      const same =
        currentRect === rect ||
        (currentRect &&
          rect &&
          Math.abs(currentRect.top - rect.top) < 0.5 &&
          Math.abs(currentRect.left - rect.left) < 0.5 &&
          Math.abs(currentRect.width - rect.width) < 0.5 &&
          Math.abs(currentRect.height - rect.height) < 0.5 &&
          currentRect.radius === rect.radius)
      if (same) return prev
      return { ...prev, [kind]: rect }
    })
  }, [])

  const clearVideoError = useCallback(() => setVideoError(null), [])

  const reloadCurrent = useCallback(() => {
    const item = queueRef.current[indexRef.current]
    if (item) startTrack(item, true)
  }, [startTrack])

  // Boot the IFrame player once.
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return
        new YT.Player(hostRef.current, {
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 1,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return
              playerRef.current = target
              setReady(true)
              try {
                target.setVolume(volumeRef.current)
              } catch {
                /* ignore */
              }
              const pending = pendingRef.current
              pendingRef.current = null
              if (pending) {
                try {
                  if (pending.autoplay) target.loadVideoById(pending.item.videoId)
                  else target.cueVideoById(pending.item.videoId)
                } catch {
                  setVideoError({ code: 0, message: 'No se pudo cargar el video.' })
                }
              } else {
                const item = queueRef.current[indexRef.current]
                if (item) {
                  try {
                    target.cueVideoById(item.videoId)
                    loadedIdRef.current = item.videoId
                    setDuration(item.duration || 0)
                  } catch {
                    /* ignore */
                  }
                }
              }
            },
            onStateChange: ({ data }) => {
              if (cancelled) return
              if (data === YT_STATE.PLAYING) {
                setPlaying(true)
                setBuffering(false)
                const player = playerRef.current
                const nextDuration = player?.getDuration?.() || 0
                if (nextDuration) {
                  durationRef.current = nextDuration
                  setDuration(nextDuration)
                }
              } else if (data === YT_STATE.PAUSED) {
                setPlaying(false)
                setBuffering(false)
              } else if (data === YT_STATE.BUFFERING) {
                setBuffering(true)
              } else if (data === YT_STATE.CUED) {
                setPlaying(false)
                setBuffering(false)
              } else if (data === YT_STATE.ENDED) {
                endedRef.current()
              }
            },
            onError: ({ data }) => {
              if (cancelled) return
              setVideoError({ code: data, message: youtubeErrorMessage(data) })
              setPlaying(false)
              setBuffering(false)
            },
          },
        })
      })
      .catch((err: Error) => {
        if (!cancelled) setPlayerInitError(err.message)
      })

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
      loadedIdRef.current = null
      setReady(false)
    }
  }, [])

  // Keep the progress clock fresh.
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const player = playerRef.current
      if (!player) return
      try {
        const time = player.getCurrentTime()
        if (Number.isFinite(time)) setCurrentTime(time)
        const total = player.getDuration()
        if (total && Math.abs(total - durationRef.current) > 0.5) {
          durationRef.current = total
          setDuration(total)
        }
      } catch {
        /* ignore */
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [playing])

  // Repair a persisted queue index that no longer points anywhere.
  useEffect(() => {
    if (index >= 0 && index >= queue.length) {
      applyIndex(-1)
    }
  }, [applyIndex, index, queue.length])

  // Media Session integration (OS media keys, lock screen, etc.).
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: 'Lyra',
        artwork: [{ src: current.thumbnail, sizes: '512x512', type: 'image/jpeg' }],
      })
      navigator.mediaSession.setActionHandler('play', () => {
        playerRef.current?.playVideo()
        setPlaying(true)
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        playerRef.current?.pauseVideo()
        setPlaying(false)
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => next())
      navigator.mediaSession.setActionHandler('previoustrack', () => prev())
    } catch {
      /* ignore unsupported browsers */
    }
  }, [current, next, prev])

  useEffect(() => {
    if (current) {
      document.title = `${current.title} · ${current.artist} — Lyra`
    } else {
      document.title = 'Lyra — Aprende inglés con música'
    }
  }, [current])

  const api = useMemo<PlayerApi>(
    () => ({
      queue,
      index,
      current,
      playing,
      buffering,
      ready,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      videoError,
      playerInitError,
      playNow,
      playQueue,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      addToQueue,
      removeFromQueue,
      clearQueue,
      jumpTo,
      toggleShuffle,
      cycleRepeat,
      setPlayerSlot,
      clearVideoError,
      reloadCurrent,
    }),
    [
      queue,
      index,
      current,
      playing,
      buffering,
      ready,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      videoError,
      playerInitError,
      playNow,
      playQueue,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      addToQueue,
      removeFromQueue,
      clearQueue,
      jumpTo,
      toggleShuffle,
      cycleRepeat,
      setPlayerSlot,
      clearVideoError,
      reloadCurrent,
    ],
  )

  const rect = slots.stage ?? slots.dock
  const layerStyle: CSSProperties = rect
    ? {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: `${rect.radius}px`,
      }
    : { opacity: 0, pointerEvents: 'none' }

  return (
    <PlayerContext.Provider value={api}>
      {children}
      <div
        className={`yt-layer${slots.stage ? ' yt-layer--stage' : ''}${current ? ' is-active' : ''}${videoError ? ' is-error' : ''}`}
        style={layerStyle}
        aria-hidden={!current || Boolean(videoError)}
      >
        <div ref={hostRef} className="yt-host" />
        {!slots.stage && current && (
          <Link to="/now" className="yt-layer__catcher" aria-label="Abrir pantalla de reproducción" />
        )}
      </div>
    </PlayerContext.Provider>
  )
}
