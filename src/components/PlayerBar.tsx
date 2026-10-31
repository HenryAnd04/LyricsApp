import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Heart,
  ListMusic,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { usePlayer } from '../state/PlayerContext'
import { useLibrary } from '../state/LibraryContext'
import { useToast } from '../state/ToastContext'
import { cx, formatTime } from '../lib/format'
import { Cover, PlayerSlot } from './PlayerSlot'
import { Slider } from './Slider'

interface Props {
  onToggleQueue: () => void
  queueOpen: boolean
}

export function PlayerBar({ onToggleQueue, queueOpen }: Props) {
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
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer()
  const { isLiked, toggleLike } = useLibrary()
  const { showToast } = useToast()
  const [scrub, setScrub] = useState<number | null>(null)

  const liked = current ? isLiked(current.videoId) : false
  const total = duration || current?.duration || 0
  const displayTime = scrub ?? currentTime
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 45 ? Volume1 : Volume2

  const handleLike = () => {
    if (!current) return
    const nowLiked = toggleLike(current)
    showToast(nowLiked ? 'Añadida a Me gusta' : 'Eliminada de Me gusta', {
      message: current.title,
      kind: nowLiked ? 'success' : 'info',
    })
  }

  return (
    <footer className="player-bar" aria-label="Reproductor">
      <div className="player-bar__inner">
        <div className="player-bar__now">
          <PlayerSlot kind="dock" className="dock-slot">
            {current ? (
              <Cover src={current.thumbnail} seed={current.videoId} className="dock-slot__cover" rounded />
            ) : (
              <div className="dock-slot__empty" aria-hidden>
                <ListMusic size={18} />
              </div>
            )}
          </PlayerSlot>
          <div className="now-meta">
            {current ? (
              <>
                <Link to="/now" className="now-meta__title" title={current.title}>
                  {current.title}
                </Link>
                <span className="now-meta__artist" title={current.artist}>
                  {current.artist}
                </span>
              </>
            ) : (
              <>
                <span className="now-meta__title now-meta__title--muted">Nada sonando</span>
                <span className="now-meta__artist">Elige una canción para empezar</span>
              </>
            )}
          </div>
          <button
            type="button"
            className={cx('row-action', 'now-like', liked && 'is-liked')}
            onClick={handleLike}
            disabled={!current}
            aria-label={liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
            aria-pressed={liked}
          >
            <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="player-bar__center">
          <div className="transport">
            <button
              type="button"
              className={cx('icon-btn', shuffle && 'is-active')}
              onClick={toggleShuffle}
              aria-label="Aleatorio"
              aria-pressed={shuffle}
              title="Aleatorio"
            >
              <Shuffle size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={prev}
              aria-label="Anterior"
              title="Anterior"
              disabled={!current}
            >
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              type="button"
              className="play-btn"
              onClick={togglePlay}
              aria-label={playing ? 'Pausar' : 'Reproducir'}
              disabled={!current}
            >
              {buffering && playing ? (
                <Loader2 size={19} className="spin" />
              ) : playing ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" className="play-icon" />
              )}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={next}
              aria-label="Siguiente"
              title="Siguiente"
              disabled={!current}
            >
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button
              type="button"
              className={cx('icon-btn', repeat !== 'off' && 'is-active')}
              onClick={cycleRepeat}
              aria-label={
                repeat === 'off'
                  ? 'Repetir desactivado'
                  : repeat === 'all'
                    ? 'Repetir toda la cola'
                    : 'Repetir esta canción'
              }
              aria-pressed={repeat !== 'off'}
              title={repeat === 'one' ? 'Repetir canción' : 'Repetir'}
            >
              {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          </div>

          <div className="timeline">
            <span className="timeline__time">{formatTime(displayTime)}</span>
            <Slider
              value={displayTime}
              max={total || 1}
              ariaLabel="Posición de la canción"
              className="timeline__slider"
              disabled={!current}
              onChange={setScrub}
              onCommit={(value) => {
                seek(value)
                setScrub(null)
              }}
            />
            <span className="timeline__time">{formatTime(total)}</span>
          </div>
        </div>

        <div className="player-bar__right">
          <button
            type="button"
            className={cx('icon-btn', queueOpen && 'is-active')}
            onClick={onToggleQueue}
            aria-label="Ver cola de reproducción"
            aria-pressed={queueOpen}
            title="Cola"
          >
            <ListMusic size={18} />
          </button>
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
          <Link
            to="/now"
            className={cx('icon-btn', 'expand-btn')}
            aria-label="Abrir pantalla de reproducción"
            title="Pantalla completa"
          >
            <Maximize2 size={17} />
          </Link>
        </div>
      </div>
    </footer>
  )
}
