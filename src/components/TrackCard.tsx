import { Pause, Play } from 'lucide-react'
import type { Track } from '../types'
import { usePlayer } from '../state/PlayerContext'
import { cx, formatTime } from '../lib/format'
import { Cover } from './PlayerSlot'

interface TrackCardProps {
  track: Track
  contextList?: Track[]
  className?: string
  subtitle?: string
}

export function TrackCard({ track, contextList, className, subtitle }: TrackCardProps) {
  const { current, playing, playNow, togglePlay } = usePlayer()
  const isCurrent = current?.videoId === track.videoId
  const isPlaying = isCurrent && playing

  return (
    <article
      className={cx('track-card', isCurrent && 'is-current', className)}
      onDoubleClick={() => playNow(track, contextList)}
    >
      <button
        type="button"
        className="track-card__art"
        onClick={() => (isCurrent ? togglePlay() : playNow(track, contextList))}
        aria-label={`${isPlaying ? 'Pausar' : 'Reproducir'} ${track.title}`}
      >
        <Cover src={track.thumbnail} seed={track.videoId} />
        <span className="track-card__overlay">
          <span className="play-orb play-orb--sm">
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </span>
        </span>
        {track.duration > 0 && <span className="track-card__time">{formatTime(track.duration)}</span>}
      </button>
      <div className="track-card__meta">
        <button
          type="button"
          className="track-card__title"
          onClick={() => playNow(track, contextList)}
          title={track.title}
        >
          {track.title}
        </button>
        <p className="track-card__artist" title={subtitle || track.artist}>
          {subtitle || track.artist}
        </p>
      </div>
    </article>
  )
}
