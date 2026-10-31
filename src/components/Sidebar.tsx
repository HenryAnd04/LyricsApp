import { NavLink, Link } from 'react-router-dom'
import {
  GraduationCap,
  Home,
  Info,
  Keyboard,
  Library,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { useUI } from '../state/UIContext'
import { cx } from '../lib/format'
import { Logo } from './Logo'
import { PlaylistCover } from './PlaylistCover'

const NAV = [
  { to: '/', label: 'Escuchar', icon: Home, end: true },
  { to: '/search', label: 'Buscar', icon: Search, end: false },
  { to: '/library', label: 'Biblioteca', icon: Library, end: false },
  { to: '/vocabulary', label: 'Vocabulario', icon: GraduationCap, end: false },
]

export function Sidebar() {
  const { playlists, vocabulary, settings, updateSettings } = useLibrary()
  const { openCreatePlaylist, openShortcuts, openAbout } = useUI()

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <Logo />
      </div>

      <nav className="sidebar__nav" aria-label="Principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx('nav-item', isActive && 'is-active')}
          >
            <Icon size={18} strokeWidth={2.1} />
            <span>{label}</span>
            {label === 'Vocabulario' && vocabulary.length > 0 && (
              <span className="nav-item__badge">{vocabulary.length}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__section">
        <div className="sidebar__section-head">
          <span>Tus listas</span>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => openCreatePlaylist()}
            aria-label="Crear lista"
            title="Crear lista"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar__playlists">
          {playlists.length === 0 ? (
            <p className="sidebar__empty">
              Crea una lista para agrupar las canciones que quieres estudiar.
            </p>
          ) : (
            playlists.map((playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="side-playlist">
                <PlaylistCover playlist={playlist} className="side-playlist__cover" />
                <span className="side-playlist__text">
                  <strong>{playlist.name}</strong>
                  <span>
                    {playlist.tracks.length}{' '}
                    {playlist.tracks.length === 1 ? 'canción' : 'canciones'}
                  </span>
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      <div className="sidebar__footer">
        <button
          type="button"
          className="nav-item nav-item--quiet"
          onClick={() =>
            updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          }
        >
          {settings.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          <span>{settings.theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span>
        </button>
        <button type="button" className="nav-item nav-item--quiet" onClick={openShortcuts}>
          <Keyboard size={17} />
          <span>Atajos</span>
        </button>
        <button type="button" className="nav-item nav-item--quiet" onClick={openAbout}>
          <Info size={17} />
          <span>Acerca de</span>
        </button>
        <p className="sidebar__legal">Uso personal · Sin fines comerciales</p>
      </div>
    </aside>
  )
}

export function MobileNav() {
  return (
    <header className="mobile-nav">
      <Logo compact />
      <nav aria-label="Principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx('mobile-nav__item', isActive && 'is-active')}
            aria-label={label}
            title={label}
          >
            <Icon size={20} />
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
