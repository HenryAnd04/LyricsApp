import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { usePlayer } from '../state/PlayerContext'
import { useLibrary } from '../state/LibraryContext'
import { useUI } from '../state/UIContext'
import { useToast } from '../state/ToastContext'
import { cx, formatTime } from '../lib/format'
import { Cover, PlayerSlot } from '../components/PlayerSlot'
import { Slider } from '../components/Slider'
import { LyricsPanel } from '../components/lyrics/LyricsPanel'
import { QueueDrawer } from '../components/QueueDrawer'
import type { Track } from '../types'

export function NowPlayingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    current,
    playing,
    buffering,
    currentTime,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    videoError,
    playerInitError,
    togglePlay,
    prev,
    next,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    reloadCurrent,
    clearVideoError,
  } = usePlayer()
  const { isLiked, toggleLike } = useLibrary()
  const { openAddToPlaylist, queueOpen, toggleQueue, closeQueue } = useUI()
  const { showToast } = useToast()
  const [scrub, setScrub] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.classList.add('is-stage')
    return () => document.body.classList.remove('is-stage')
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    setScrub(null)
  }, [current?.videoId])

  const close = useCallback(() => {
    if (location.key === 'default') navigate('/')
    else navigate(-1)
  }, [location.key, navigate])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.modal-backdrop') || document.querySelector('.word-popover')) return
      if (queueOpen) {
        closeQueue()
        return
      }
      if (document.fullscreenElement) return
      close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, closeQueue, queueOpen])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await stageRef.current?.requestFullscreen()
    } catch {
      showToast('Tu navegador no permitió la pantalla completa', { kind: 'error' })
    }
  }

  if (!current) {
    return (
      <div className="stage stage--empty">
        <header className="stage__top">
          <button type="button" className="icon-btn" onClick={close} aria-label="Cerrar">
            <ChevronDown size={20} />
          </button>
        </header>
        <div className="stage-empty">
          <span className="stage-empty__icon">
            <Music2 size={30} />
          </span>
          <h1>Nada en reproducción</h1>
          <p>Busca una canción para ver el video, la letra bilingüe y practicar inglés.</p>
          <Link to="/search" className="btn btn--primary">
            <Search size={16} /> Buscar música
          </Link>
        </div>
      </div>
    )
  }

  const liked = isLiked(current.videoId)
  const total = duration || current.duration || 0
  const displayedTime = scrub ?? currentTime
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 45 ? Volume1 : Volume2

  const handleLike = () => {
    const nowLiked = toggleLike(current)
    showToast(nowLiked ? 'Añadida a Me gusta' : 'Eliminada de Me gusta', {
      message: current.title,
      kind: nowLiked ? 'success' : 'info',
    })
  }

  return (
    <div className="stage" ref={stageRef}>
      <div
        className="stage__ambient"
        style={{ backgroundImage: `url("${current.thumbnail}")` }}
        aria-hidden
      />
      <div className="stage__scrim" aria-hidden />

      <header className="stage__top">
        <div className="stage__top-left">
          <button type="button" className="icon-btn" onClick={close} aria-label="Cerrar reproductor">
            <ChevronDown size={20} />
          </button>
          <div className="stage__track">
            <p className="eyebrow">Reproduciendo</p>
            <h1 title={current.title}>{current.title}</h1>
            <p className="stage__artist" title={current.artist}>
              {current.artist}
            </p>
          </div>
        </div>
        <div className="stage__top-actions">
          <button
            type="button"
            className={cx('icon-btn', liked && 'is-liked')}
            onClick={handleLike}
            aria-label={liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
            aria-pressed={liked}
            title="Me gusta"
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => openAddToPlaylist(current)}
            aria-label="Añadir a una lista"
            title="Añadir a una lista"
          >
            <ListPlus size={18} />
          </button>
          <button
            type="button"
            className={cx('icon-btn', queueOpen && 'is-active')}
            onClick={toggleQueue}
            aria-label="Ver la cola"
            title="Cola"
          >
            <ListMusic size={18} />
          </button>
          <a
            className="icon-btn"
            href={`https://www.youtube.com/watch?v=${current.videoId}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir en YouTube"
            title="Abrir en YouTube"
          >
            <ExternalLink size={17} />
          </a>
          <button
            type="button"
            className="icon-btn stage__fullscreen"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      <StageVideo
        track={current}
        error={videoError?.message || playerInitError || ''}
        onRetry={() => {
          clearVideoError()
          if (playerInitError) window.location.reload()
          else reloadCurrent()
        }}
        onSearch={() =>
          navigate(`/search?q=${encodeURIComponent(`${current.artist} ${current.title}`)}`)
        }
      />

      <div className="stage__transport">
        <div className="stage__timeline">
          <span>{formatTime(displayedTime)}</span>
          <Slider
            value={displayedTime}
            max={total || 1}
            ariaLabel="Posición de la canción"
            className="stage__progress"
            onChange={setScrub}
            onCommit={(value) => {
              seek(value)
              setScrub(null)
            }}
          />
          <span>{formatTime(total)}</span>
        </div>
        <div className="stage__controls">
          <button
            type="button"
            className={cx('icon-btn', shuffle && 'is-active')}
            onClick={toggleShuffle}
            aria-label="Aleatorio"
            aria-pressed={shuffle}
            title="Aleatorio"
          >
            <Shuffle size={17} />
          </button>
          <button type="button" className="icon-btn" onClick={prev} aria-label="Anterior" title="Anterior">
            <SkipBack size={21} fill="currentColor" />
          </button>
          <button
            type="button"
            className="play-btn play-btn--lg"
            onClick={togglePlay}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
          >
            {buffering && playing ? (
              <Loader2 size={22} className="spin" />
            ) : playing ? (
              <Pause size={22} fill="currentColor" />
            ) : (
              <Play size={22} fill="currentColor" />
            )}
          </button>
          <button type="button" className="icon-btn" onClick={next} aria-label="Siguiente" title="Siguiente">
            <SkipForward size={21} fill="currentColor" />
          </button>
          <button
            type="button"
            className={cx('icon-btn', repeat !== 'off' && 'is-active')}
            onClick={cycleRepeat}
            aria-label="Repetir"
            aria-pressed={repeat !== 'off'}
            title={repeat === 'one' ? 'Repetir canción' : 'Repetir'}
          >
            {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
          </button>

          <div className="stage__volume">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleMute}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              title={muted ? 'Activar sonido' : 'Silenciar'}
            >
              <VolumeIcon size={18} />
            </button>
            <Slider
              value={muted ? 0 : volume}
              max={100}
              ariaLabel="Volumen"
              className="volume-slider"
              onChange={setVolume}
            />
          </div>
        </div>
      </div>

      <LyricsPanel track={current} />
      <QueueDrawer open={queueOpen} onClose={closeQueue} />
    </div>
  )
}

function StageVideo({
  track,
  error,
  onRetry,
  onSearch,
}: {
  track: Track
  error: string
  onRetry: () => void
  onSearch: () => void
}) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 10 || rect.height < 10) return
      const width = Math.min(rect.width, rect.height * (16 / 9))
      setBox({ width: Math.floor(width), height: Math.floor(width * (9 / 16)) })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="video-area" ref={areaRef}>
      <PlayerSlot
        kind="stage"
        className="video-slot"
        style={{ width: box.width || undefined, height: box.height || undefined }}
      >
        <div className="video-slot__fallback">
          <Cover src={track.thumbnail} seed={track.videoId} />
        </div>
      </PlayerSlot>
      {error && (
        <div className="video-error" role="alert">
          <span className="video-error__icon">
            <AlertTriangle size={24} />
          </span>
          <h2>Este video no se puede reproducir aquí</h2>
          <p>{error}</p>
          <div className="video-error__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={onRetry}>
              Reintentar
            </button>
            <button type="button" className="btn btn--subtle btn--sm" onClick={onSearch}>
              <Search size={14} /> Buscar otra versión
            </button>
            <a
              className="btn btn--ghost btn--sm"
              href={`https://www.youtube.com/watch?v=${track.videoId}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} /> Ver en YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
