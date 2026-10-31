import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  Copy,
  ExternalLink,
  Heart,
  ListMusic,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  PlaySquare,
  Share2,
} from 'lucide-react'
import type { Track } from '../types'
import { usePlayer } from '../state/PlayerContext'
import { useLibrary } from '../state/LibraryContext'
import { useToast } from '../state/ToastContext'
import { useUI } from '../state/UIContext'
import { useClickOutside } from '../lib/hooks'
import { cx, formatTime } from '../lib/format'
import { Cover } from './PlayerSlot'

interface TrackRowProps {
  track: Track
  index?: number
  contextList?: Track[]
  onPlay?: () => void
  subtitle?: string
  trailing?: ReactNode
  showIndex?: boolean
  dense?: boolean
}

export function TrackRow({
  track,
  index,
  contextList,
  onPlay,
  subtitle,
  trailing,
  showIndex,
  dense,
}: TrackRowProps) {
  const { current, playing, playNow, addToQueue } = usePlayer()
  const { isLiked, toggleLike } = useLibrary()
  const { openAddToPlaylist } = useUI()
  const { showToast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen)

  const isCurrent = current?.videoId === track.videoId
  const liked = isLiked(track.videoId)

  const start = () => {
    if (onPlay) onPlay()
    else playNow(track, contextList)
  }

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      const menuWidth = 232
      const menuHeight = 292
      const left = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth))
      const fitsBelow = rect.bottom + menuHeight < window.innerHeight - 100
      const top = fitsBelow
        ? rect.bottom + 6
        : Math.max(12, rect.top - menuHeight - 6)
      setMenuPos({ top, left })
    }
    setMenuOpen((prev) => !prev)
  }

  const handleLike = () => {
    const nowLiked = toggleLike(track)
    showToast(nowLiked ? 'Añadida a Me gusta' : 'Eliminada de Me gusta', {
      message: track.title,
      kind: nowLiked ? 'success' : 'info',
    })
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${track.videoId}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      showToast('Enlace copiado')
    } catch {
      showToast('No se pudo copiar el enlace', { kind: 'error' })
    }
    setMenuOpen(false)
  }

  return (
    <div
      className={cx(
        'track-row',
        isCurrent && 'is-current',
        menuOpen && 'is-menu-open',
        dense && 'track-row--dense',
      )}
      onDoubleClick={start}
      data-track-id={track.videoId}
    >
      <button
        type="button"
        className="track-row__lead"
        onClick={start}
        aria-label={`${isCurrent && playing ? 'Pausar' : 'Reproducir'} ${track.title}`}
      >
        <span className="track-row__index">
          {showIndex && index !== undefined ? (
            <span className="track-row__number">{String(index + 1).padStart(2, '0')}</span>
          ) : null}
          <span className="track-row__play">
            {isCurrent && playing ? <Pause size={15} /> : <Play size={15} />}
          </span>
        </span>
        <Cover
          src={track.thumbnail}
          seed={track.videoId}
          alt=""
          className="track-row__cover"
          rounded
        />
      </button>

      <button type="button" className="track-row__info" onClick={start}>
        <span className="track-row__title">{track.title}</span>
        <span className="track-row__artist">{subtitle || track.artist}</span>
      </button>

      {isCurrent && (
        <span className={cx('now-bars', playing && 'is-playing')} aria-label="Sonando ahora">
          <span />
          <span />
          <span />
        </span>
      )}

      <div className="track-row__actions">
        <button
          type="button"
          className={cx('row-action', liked && 'is-liked')}
          onClick={handleLike}
          aria-label={liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
          aria-pressed={liked}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <span className="track-row__duration">{formatTime(track.duration)}</span>
        {trailing}
        <button
          ref={buttonRef}
          type="button"
          className="row-action"
          onClick={openMenu}
          aria-label="Más opciones"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {menuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="row-menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                start()
                setMenuOpen(false)
              }}
            >
              <Play size={15} /> Reproducir ahora
            </button>
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                addToQueue(track, 'next')
                showToast('Se reproducirá a continuación', { message: track.title })
                setMenuOpen(false)
              }}
            >
              <ListPlus size={15} /> Reproducir a continuación
            </button>
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                addToQueue(track)
                showToast('Añadida a la cola', { message: track.title })
                setMenuOpen(false)
              }}
            >
              <ListMusic size={15} /> Añadir a la cola
            </button>
            <div className="row-menu__sep" />
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                openAddToPlaylist(track)
                setMenuOpen(false)
              }}
            >
              <ListPlus size={15} /> Añadir a una lista
            </button>
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                handleLike()
                setMenuOpen(false)
              }}
            >
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
              {liked ? 'Quitar de Me gusta' : 'Añadir a Me gusta'}
            </button>
            <div className="row-menu__sep" />
            <button type="button" className="row-menu__item" onClick={copyLink}>
              {copied ? <Check size={15} /> : <Copy size={15} />} Copiar enlace
            </button>
            <a
              className="row-menu__item"
              href={`https://www.youtube.com/watch?v=${track.videoId}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              <ExternalLink size={15} /> Abrir en YouTube
            </a>
            <button
              type="button"
              className="row-menu__item"
              onClick={() => {
                navigator
                  .share?.({
                    title: track.title,
                    text: `${track.title} — ${track.artist}`,
                    url: `https://www.youtube.com/watch?v=${track.videoId}`,
                  })
                  .catch(() => {})
                setMenuOpen(false)
              }}
            >
              <Share2 size={15} /> Compartir
            </button>
            <div className="row-menu__hint">
              <PlaySquare size={13} /> Video de YouTube
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
