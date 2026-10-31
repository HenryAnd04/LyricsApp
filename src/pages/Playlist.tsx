import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ListMusic,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Shuffle,
  Trash2,
  X,
} from 'lucide-react'
import { useLibrary } from '../state/LibraryContext'
import { usePlayer } from '../state/PlayerContext'
import { useToast } from '../state/ToastContext'
import { useClickOutside } from '../lib/hooks'
import { TrackRow } from '../components/TrackRow'
import { PlaylistCover } from '../components/PlaylistCover'
import { Modal } from '../components/Modal'
import { formatTime, pluralize } from '../lib/format'
import { useRef } from 'react'

export function PlaylistPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { playlists, renamePlaylist, deletePlaylist, removeFromPlaylist } = useLibrary()
  const { playQueue } = usePlayer()
  const { showToast } = useToast()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen)

  const playlist = playlists.find((item) => item.id === id)
  const totalDuration = useMemo(
    () => (playlist?.tracks || []).reduce((total, track) => total + (track.duration || 0), 0),
    [playlist],
  )

  if (!playlist) {
    return (
      <div className="page">
        <div className="empty-state">
          <ListMusic size={24} />
          <h2>Esta lista no existe</h2>
          <p>Puede que la hayas eliminado o que el enlace sea antiguo.</p>
          <Link to="/library" className="btn btn--primary">
            Ir a tu biblioteca
          </Link>
        </div>
      </div>
    )
  }

  const playAll = () => {
    if (playlist.tracks.length) playQueue(playlist.tracks, 0)
  }

  const playShuffled = () => {
    if (!playlist.tracks.length) return
    playQueue(playlist.tracks, Math.floor(Math.random() * playlist.tracks.length))
  }

  const openRename = () => {
    setName(playlist.name)
    setRenameOpen(true)
    setMenuOpen(false)
  }

  return (
    <div className="page playlist-page">
      <header className="playlist-hero">
        <PlaylistCover playlist={playlist} className="playlist-hero__cover" />
        <div className="playlist-hero__info">
          <p className="eyebrow">Lista de estudio</p>
          <h1>{playlist.name}</h1>
          <p className="playlist-hero__meta">
            {pluralize(playlist.tracks.length, 'canción', 'canciones')}
            {playlist.tracks.length > 0 && <span> · {formatTime(totalDuration)}</span>}
            <span> · Creada el {new Date(playlist.createdAt).toLocaleDateString('es')}</span>
          </p>
          <div className="playlist-hero__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={playAll}
              disabled={!playlist.tracks.length}
            >
              <Play size={16} fill="currentColor" /> Reproducir
            </button>
            <button
              type="button"
              className="btn btn--subtle"
              onClick={playShuffled}
              disabled={!playlist.tracks.length}
            >
              <Shuffle size={16} />
            </button>
            <Link to="/search" className="btn btn--subtle">
              <Plus size={16} /> Añadir canciones
            </Link>
            <div className="tool-anchor" ref={menuRef}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Opciones de la lista"
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="mini-popover more-popover">
                  <button type="button" className="mini-popover__item" onClick={openRename}>
                    <Pencil size={15} /> Cambiar nombre
                  </button>
                  <button
                    type="button"
                    className="mini-popover__item mini-popover__item--danger"
                    onClick={() => {
                      setDeleteOpen(true)
                      setMenuOpen(false)
                    }}
                  >
                    <Trash2 size={15} /> Eliminar lista
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {playlist.tracks.length === 0 ? (
        <div className="empty-state">
          <ListMusic size={24} />
          <h2>Esta lista está vacía</h2>
          <p>Añade canciones desde Buscar o desde el menú de cualquier canción.</p>
          <Link to="/search" className="btn btn--primary">
            <Search size={16} /> Buscar canciones
          </Link>
        </div>
      ) : (
        <div className="track-list">
          {playlist.tracks.map((track, index) => (
            <TrackRow
              key={track.videoId}
              track={track}
              index={index}
              contextList={playlist.tracks}
              showIndex
              trailing={
                <button
                  type="button"
                  className="row-action"
                  onClick={() => {
                    removeFromPlaylist(playlist.id, track.videoId)
                    showToast('Canción quitada de la lista', { message: track.title })
                  }}
                  aria-label={`Quitar ${track.title} de la lista`}
                >
                  <X size={15} />
                </button>
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Cambiar nombre"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setRenameOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                if (!name.trim()) return
                renamePlaylist(playlist.id, name)
                setRenameOpen(false)
                showToast('Lista renombrada')
              }}
              disabled={!name.trim()}
            >
              Guardar
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) {
                renamePlaylist(playlist.id, name)
                setRenameOpen(false)
              }
            }}
            maxLength={60}
          />
        </label>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="¿Eliminar esta lista?"
        description="Las canciones seguirán existiendo; solo se borra la lista."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                deletePlaylist(playlist.id)
                showToast('Lista eliminada')
                navigate('/library')
              }}
            >
              <Trash2 size={15} /> Eliminar
            </button>
          </>
        }
      >
        <p className="muted">
          “{playlist.name}” tiene {pluralize(playlist.tracks.length, 'canción', 'canciones')}.
        </p>
      </Modal>
    </div>
  )
}
