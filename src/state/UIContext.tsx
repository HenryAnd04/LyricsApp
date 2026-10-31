import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ListMusic, Plus, ShieldCheck } from 'lucide-react'
import type { Track } from '../types'
import { Modal } from '../components/Modal'
import { useLibrary } from './LibraryContext'
import { useToast } from './ToastContext'

interface UIApi {
  openAddToPlaylist: (track: Track) => void
  openCreatePlaylist: (track?: Track) => void
  openShortcuts: () => void
  openAbout: () => void
  queueOpen: boolean
  toggleQueue: () => void
  closeQueue: () => void
}

const UIContext = createContext<UIApi | null>(null)

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}

const SHORTCUTS: Array<[string, string]> = [
  ['Espacio', 'Reproducir / pausar'],
  ['← / →', 'Retroceder / avanzar 5 segundos'],
  ['Mayús + ← / →', 'Retroceder / avanzar 15 segundos'],
  ['↑ / ↓', 'Subir / bajar el volumen'],
  ['M', 'Silenciar'],
  ['N / P', 'Siguiente / anterior'],
  ['L', 'Me gusta / quitar me gusta'],
  ['F', 'Abrir la pantalla de reproducción'],
  ['/', 'Buscar'],
  ['?', 'Ver estos atajos'],
  ['Esc', 'Cerrar ventanas'],
]

export function UIProvider({ children }: { children: ReactNode }) {
  const { playlists, addToPlaylist, createPlaylist } = useLibrary()
  const { showToast } = useToast()
  const [addTrack, setAddTrack] = useState<Track | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createPending, setCreatePending] = useState<Track | undefined>(undefined)
  const [playlistName, setPlaylistName] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  const openAddToPlaylist = useCallback((track: Track) => {
    setAddTrack(track)
  }, [])

  const openCreatePlaylist = useCallback((track?: Track) => {
    setAddTrack(null)
    setCreatePending(track)
    setPlaylistName('')
    setCreateOpen(true)
  }, [])

  const closeCreate = useCallback(() => {
    setCreateOpen(false)
    setCreatePending(undefined)
  }, [])

  const toggleQueue = useCallback(() => setQueueOpen((prev) => !prev), [])
  const closeQueue = useCallback(() => setQueueOpen(false), [])

  const handleCreate = useCallback(() => {
    const name = playlistName.trim()
    if (!name) return
    const playlist = createPlaylist(name, createPending ? [createPending] : [])
    showToast('Lista creada', {
      message: createPending
        ? `“${playlist.name}” · 1 canción`
        : `“${playlist.name}” está lista para recibir canciones.`,
      kind: 'success',
    })
    closeCreate()
  }, [closeCreate, createPending, createPlaylist, playlistName, showToast])

  useEffect(() => {
    if (!addTrack) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAddTrack(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addTrack])

  const api = useMemo<UIApi>(
    () => ({
      openAddToPlaylist,
      openCreatePlaylist,
      openShortcuts: () => setShortcutsOpen(true),
      openAbout: () => setAboutOpen(true),
      queueOpen,
      toggleQueue,
      closeQueue,
    }),
    [openAddToPlaylist, openCreatePlaylist, queueOpen, toggleQueue, closeQueue],
  )

  return (
    <UIContext.Provider value={api}>
      {children}

      <Modal
        open={Boolean(addTrack)}
        onClose={() => setAddTrack(null)}
        title="Añadir a una lista"
        description={addTrack ? `${addTrack.title} · ${addTrack.artist}` : undefined}
        size="sm"
      >
        {playlists.length === 0 ? (
          <div className="empty-inline">
            <ListMusic size={26} aria-hidden />
            <p>Todavía no tienes listas.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => addTrack && openCreatePlaylist(addTrack)}
            >
              <Plus size={16} /> Crear una lista
            </button>
          </div>
        ) : (
          <ul className="picker-list">
            {playlists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  className="picker-row"
                  onClick={() => {
                    if (!addTrack) return
                    const result = addToPlaylist(playlist.id, addTrack)
                    if (result === 'added') {
                      showToast('Añadida a la lista', {
                        message: `“${playlist.name}”`,
                        kind: 'success',
                      })
                      setAddTrack(null)
                    } else if (result === 'duplicate') {
                      showToast('Ya estaba en esa lista', { message: playlist.name })
                    }
                  }}
                >
                  <span className="picker-row__icon">
                    <ListMusic size={16} />
                  </span>
                  <span className="picker-row__text">
                    <strong>{playlist.name}</strong>
                    <span>
                      {playlist.tracks.length}{' '}
                      {playlist.tracks.length === 1 ? 'canción' : 'canciones'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {playlists.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--full"
            onClick={() => addTrack && openCreatePlaylist(addTrack)}
          >
            <Plus size={16} /> Nueva lista
          </button>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title="Nueva lista"
        description="Ponle un nombre. Podrás añadir más canciones después."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={closeCreate}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleCreate}
              disabled={!playlistName.trim()}
            >
              Crear
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field__label">Nombre</span>
          <input
            className="input"
            data-autofocus
            value={playlistName}
            onChange={(event) => setPlaylistName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleCreate()
            }}
            placeholder="Inglés con Bad Bunny"
            maxLength={60}
          />
        </label>
        {createPending && (
          <p className="field__hint">
            Se añadirá “{createPending.title}” a la nueva lista.
          </p>
        )}
      </Modal>

      <Modal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        title="Atajos de teclado"
        description="Funcionan en cualquier pantalla, salvo mientras escribes."
        size="sm"
      >
        <ul className="shortcut-list">
          {SHORTCUTS.map(([key, label]) => (
            <li key={key}>
              <span>{label}</span>
              <kbd>{key}</kbd>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="Acerca de Lyra"
        description="Un reproductor personal para aprender inglés con música."
        size="md"
      >
        <div className="about">
          <div className="about__badge">
            <ShieldCheck size={18} />
            <span>Hecho para uso personal, sin anuncios propios ni fines comerciales.</span>
          </div>
          <h3>Cómo funciona</h3>
          <ul>
            <li>
              La reproducción usa el reproductor oficial de YouTube incrustado. Lyra no descarga
              audio, no bloquea anuncios y no aloja ningún video.
            </li>
            <li>
              Las letras provienen de <strong>LRCLIB</strong> (base de datos abierta) y, como
              respaldo, de <strong>lyrics.ovh</strong>. Si no hay letra, puedes pegarla tú mismo.
            </li>
            <li>
              Las traducciones usan el servicio público de Google Translate. Son automáticas y
              pueden contener errores: úsalas como apoyo, no como texto definitivo.
            </li>
            <li>
              Tus me gusta, listas, historial y vocabulario se guardan solo en este navegador
              (localStorage). No hay cuentas ni servidores propios de datos.
            </li>
          </ul>
          <h3>Consejos para aprender</h3>
          <ul>
            <li>Lee primero la línea en inglés e intenta deducir el significado antes de mirar el original.</li>
            <li>Pulsa cualquier palabra en inglés para ver su traducción y guardarla en tu vocabulario.</li>
            <li>Usa el control de sincronía si la letra se adelanta o se atrasa respecto al video.</li>
            <li>Repite canciones: la letra se guarda en caché y se carga al instante.</li>
          </ul>
          <p className="about__muted">
            Lyra no está afiliada a YouTube, Google ni Apple. Las marcas pertenecen a sus dueños.
          </p>
        </div>
      </Modal>
    </UIContext.Provider>
  )
}
