import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  GraduationCap,
  Heart,
  ListMusic,
  Play,
  Search,
  Sparkles,
} from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { TrackCard as TrackCardComponent } from '../components/TrackCard'
import { TrackRow } from '../components/TrackRow'
import { PlaylistCover } from '../components/PlaylistCover'
import { greeting } from '../lib/format'

const IDEAS = [
  'pop songs in english',
  'indie folk lyrics',
  'classic rock 80s',
  'acoustic covers english',
  'hip hop english lyrics',
]

export function HomePage() {
  const navigate = useNavigate()
  const { recent, liked, playlists, vocabulary } = useLibrary()
  const { playQueue, playNow } = usePlayer()

  const hasContent = recent.length > 0 || liked.length > 0

  return (
    <div className="page home">
      <header className="home-hero">
        <div className="home-hero__text">
          <p className="eyebrow">Escuchar</p>
          <h1>{greeting()}</h1>
          <p className="home-hero__subtitle">
            Aprende inglés con las canciones que ya te gustan. La letra en inglés siempre va
            primero.
          </p>
        </div>
        <div className="home-hero__glow" aria-hidden />
      </header>

      <button type="button" className="search-trigger" onClick={() => navigate('/search')}>
        <Search size={18} />
        <span>Busca una canción, artista o pega un enlace de YouTube…</span>
        <kbd>/</kbd>
      </button>

      <div className="quick-chips" aria-label="Ideas para buscar">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            className="chip chip--action"
            onClick={() => navigate(`/search?q=${encodeURIComponent(idea)}`)}
          >
            <Sparkles size={12} /> {idea}
          </button>
        ))}
      </div>

      {!hasContent && (
        <section className="onboarding card">
          <div className="onboarding__intro">
            <span className="onboarding__icon">
              <GraduationCap size={24} />
            </span>
            <div>
              <h2>Tu primera canción para practicar</h2>
              <p>
                Busca cualquier canción en YouTube. Verás el video y, debajo, la letra
                sincronizada en inglés y en su idioma original.
              </p>
            </div>
          </div>
          <ol className="onboarding__steps">
            <li>
              <span>1</span>
              <div>
                <strong>Busca y reproduce</strong>
                <p>Escribe el nombre de una canción o pega el enlace del video.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Sigue la letra</strong>
                <p>La línea actual se ilumina. Toca una línea para saltar a ese momento.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Aprende palabras</strong>
                <p>Pulsa cualquier palabra en inglés para ver su significado y guardarla.</p>
              </div>
            </li>
          </ol>
          <div className="onboarding__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => navigate('/search')}
            >
              <Search size={16} /> Buscar mi primera canción
            </button>
            <Link to="/vocabulary" className="btn btn--ghost">
              Ver vocabulario
            </Link>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Sigue escuchando</h2>
            <button type="button" className="text-link" onClick={() => navigate('/library')}>
              Ver todo <ArrowRight size={14} />
            </button>
          </div>
          <div className="shelf">
            {recent.slice(0, 10).map((track) => (
              <TrackCardComponent key={track.videoId} track={track} contextList={recent} />
            ))}
          </div>
        </section>
      )}

      {liked.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div className="section-head__title">
              <Heart size={18} className="accent" />
              <h2>Tus me gusta</h2>
            </div>
            <div className="section-head__actions">
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                onClick={() => playQueue(liked, 0)}
              >
                <Play size={14} fill="currentColor" /> Reproducir
              </button>
              <Link to="/library" className="text-link">
                Ver todo <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div className="track-list track-list--flat">
            {liked.slice(0, 5).map((track) => (
              <TrackRow key={track.videoId} track={track} contextList={liked} />
            ))}
          </div>
        </section>
      )}

      {playlists.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Tus listas</h2>
            <Link to="/library" className="text-link">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          <div className="playlist-grid">
            {playlists.slice(0, 6).map((playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="playlist-card">
                <PlaylistCover playlist={playlist} className="playlist-card__cover" />
                <div className="playlist-card__text">
                  <strong>{playlist.name}</strong>
                  <span>
                    {playlist.tracks.length}{' '}
                    {playlist.tracks.length === 1 ? 'canción' : 'canciones'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {liked.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Vuelve a escuchar</h2>
          </div>
          <div className="card-strip">
            <button
              type="button"
              className="study-card"
              onClick={() => playNow(liked[0], liked)}
            >
              <span className="study-card__icon">
                <Play size={18} fill="currentColor" />
              </span>
              <span>
                <strong>Aleatorio de tus me gusta</strong>
                <span>{liked.length} canciones para practicar</span>
              </span>
            </button>
            <Link to="/vocabulary" className="study-card">
              <span className="study-card__icon">
                <GraduationCap size={18} />
              </span>
              <span>
                <strong>Tu vocabulario</strong>
                <span>
                  {vocabulary.length > 0
                    ? `${vocabulary.length} palabras guardadas`
                    : 'Guarda palabras mientras escuchas'}
                </span>
              </span>
            </Link>
            <Link to="/library" className="study-card">
              <span className="study-card__icon">
                <ListMusic size={18} />
              </span>
              <span>
                <strong>Tus listas</strong>
                <span>{playlists.length} listas de estudio</span>
              </span>
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
