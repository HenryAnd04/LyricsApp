import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock3,
  Heart,
  ListMusic,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { useUI } from '../state/UIContext'
import { useToast } from '../state/ToastContext'
import { TrackRow } from '../components/TrackRow'
import { PlaylistCover } from '../components/PlaylistCover'
import { cx, formatTime, pluralize } from '../lib/format'

type Tab = 'liked' | 'playlists' | 'recent'

export function LibraryPage() {
  const { liked, playlists, recent, clearRecent } = useLibrary()
  const { playQueue } = usePlayer()
  const { openCreatePlaylist } = useUI()
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('liked')

  const likedDuration = useMemo(
    () => liked.reduce((total, track) => total + (track.duration || 0), 0),
    [liked],
  )

  const playShuffled = () => {
    if (!liked.length) return
    const start = Math.floor(Math.random() * liked.length)
    playQueue(liked, start)
  }

  return (
    <div className="page library-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h1>Tu música para estudiar</h1>
          <p className="page-head__sub">Todo se guarda en este navegador, sin cuentas.</p>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="Secciones de la biblioteca">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'liked'}
          className={cx('segmented__item', tab === 'liked' && 'is-active')}
          onClick={() => setTab('liked')}
        >
          <Heart size={15} /> Me gusta
          {liked.length > 0 && <span className="segmented__count">{liked.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'playlists'}
          className={cx('segmented__item', tab === 'playlists' && 'is-active')}
          onClick={() => setTab('playlists')}
        >
          <ListMusic size={15} /> Listas
          {playlists.length > 0 && <span className="segmented__count">{playlists.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recent'}
          className={cx('segmented__item', tab === 'recent' && 'is-active')}
          onClick={() => setTab('recent')}
        >
          <Clock3 size={15} /> Recientes
        </button>
      </div>

      {tab === 'liked' && (
        <section className="library-section">
          {liked.length === 0 ? (
            <div className="empty-state">
              <Heart size={24} />
              <h2>Aún no tienes favoritas</h2>
              <p>Pulsa el corazón en cualquier canción para guardarla aquí.</p>
              <Link to="/search" className="btn btn--primary">
                <Search size={16} /> Buscar música
              </Link>
            </div>
          ) : (
            <>
              <div className="collection-head">
                <div className="collection-head__cover collection-head__cover--liked">
                  <Heart size={38} fill="currentColor" />
                </div>
                <div className="collection-head__text">
                  <p className="eyebrow">Colección</p>
                  <h2>Canciones que te gustan</h2>
                  <p>
                    {pluralize(liked.length, 'canción', 'canciones')} ·{' '}
                    {formatTime(likedDuration)} de práctica
                  </p>
                </div>
                <div className="collection-head__actions">
                  <button type="button" className="btn btn--primary" onClick={() => playQueue(liked, 0)}>
                    <Play size={16} fill="currentColor" /> Reproducir
                  </button>
                  <button type="button" className="btn btn--subtle" onClick={playShuffled}>
                    <Shuffle size={16} /> Aleatorio
                  </button>
                </div>
              </div>
              <div className="track-list">
                {liked.map((track, index) => (
                  <TrackRow
                    key={track.videoId}
                    track={track}
                    index={index}
                    contextList={liked}
                    showIndex
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'playlists' && (
        <section className="library-section">
          <div className="section-head">
            <h2>Tus listas</h2>
            <button type="button" className="btn btn--subtle btn--sm" onClick={() => openCreatePlaylist()}>
              <Plus size={15} /> Nueva lista
            </button>
          </div>
          <div className="playlist-grid playlist-grid--large">
            <button type="button" className="playlist-card playlist-card--new" onClick={() => openCreatePlaylist()}>
              <span className="playlist-card__new-icon">
                <Plus size={22} />
              </span>
              <span className="playlist-card__text">
                <strong>Crear lista</strong>
                <span>Agrupa canciones por tema o nivel</span>
              </span>
            </button>
            {playlists.map((playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="playlist-card">
                <PlaylistCover playlist={playlist} className="playlist-card__cover" />
                <div className="playlist-card__text">
                  <strong>{playlist.name}</strong>
                  <span>{pluralize(playlist.tracks.length, 'canción', 'canciones')}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {tab === 'recent' && (
        <section className="library-section">
          <div className="section-head">
            <h2>Escuchado recientemente</h2>
            {recent.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  clearRecent()
                  showToast('Historial borrado')
                }}
              >
                <Trash2 size={14} /> Borrar historial
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <Clock3 size={24} />
              <h2>Todavía no has escuchado nada</h2>
              <p>Las canciones que reproduzcas aparecerán aquí.</p>
              <Link to="/search" className="btn btn--primary">
                <Search size={16} /> Descubrir música
              </Link>
            </div>
          ) : (
            <>
              <div className="collection-head collection-head--compact">
                <div className="collection-head__text">
                  <p className="eyebrow">Historial</p>
                  <h2>Las últimas {recent.length}</h2>
                </div>
                <div className="collection-head__actions">
                  <button type="button" className="btn btn--primary btn--sm" onClick={() => playQueue(recent, 0)}>
                    <Play size={14} fill="currentColor" /> Reproducir
                  </button>
                </div>
              </div>
              <div className="track-list">
                {recent.map((track, index) => (
                  <TrackRow key={track.videoId} track={track} index={index} contextList={recent} />
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
