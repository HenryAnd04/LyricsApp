import { ListMusic, Trash2, X } from 'lucide-react'
import { usePlayer } from '../state/PlayerContext'
import { cx, formatTime } from '../lib/format'
import { Cover } from './PlayerSlot'

export function QueueDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { queue, index, current, playing, jumpTo, removeFromQueue, clearQueue } = usePlayer()
  const upcoming = queue.slice(index + 1)

  return (
    <aside className={cx('queue-drawer', open && 'is-open')} aria-hidden={!open}>
      <div className="queue-drawer__head">
        <div>
          <p className="eyebrow">Reproducción</p>
          <h2>Cola</h2>
        </div>
        <div className="queue-drawer__head-actions">
          {queue.length > 0 && (
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={clearQueue}
              aria-label="Vaciar la cola"
              title="Vaciar la cola"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={onClose}
            aria-label="Cerrar la cola"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="queue-drawer__body">
        {!current ? (
          <div className="empty-inline">
            <ListMusic size={26} aria-hidden />
            <p>La cola está vacía.</p>
            <span className="muted">Añade canciones desde Buscar o tus listas.</span>
          </div>
        ) : (
          <>
            <p className="queue-section">Sonando ahora</p>
            <div className="queue-item is-current">
              <Cover src={current.thumbnail} seed={current.videoId} className="queue-item__cover" />
              <div className="queue-item__text">
                <span className="queue-item__title">{current.title}</span>
                <span className="queue-item__artist">{current.artist}</span>
              </div>
              <span className={cx('now-bars', playing && 'is-playing')} aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </div>

            <p className="queue-section">
              A continuación {upcoming.length > 0 && <span>· {upcoming.length}</span>}
            </p>
            {upcoming.length === 0 ? (
              <p className="queue-empty">No hay más canciones en la cola.</p>
            ) : (
              <ul className="queue-list">
                {upcoming.map((track) => (
                  <li key={track.uid} className="queue-item">
                    <button
                      type="button"
                      className="queue-item__main"
                      onClick={() => jumpTo(queue.findIndex((t) => t.uid === track.uid))}
                    >
                      <Cover
                        src={track.thumbnail}
                        seed={track.videoId}
                        className="queue-item__cover"
                      />
                      <span className="queue-item__text">
                        <span className="queue-item__title">{track.title}</span>
                        <span className="queue-item__artist">
                          {track.artist} · {formatTime(track.duration)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="row-action"
                      onClick={() => removeFromQueue(track.uid)}
                      aria-label={`Quitar ${track.title} de la cola`}
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {index > 0 && (
              <p className="queue-hint">
                Las {index} canciones anteriores ya se reprodujeron.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
