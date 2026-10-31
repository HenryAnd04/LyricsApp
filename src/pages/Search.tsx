import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  Link2,
  ListMusic,
  Loader2,
  Play,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import type { Track } from '../types'
import { getSuggestions, getTrackMeta, searchTracks, ApiError } from '../lib/api'
import { useDebouncedValue, useClickOutside } from '../lib/hooks'
import { cx } from '../lib/format'
import { usePersistentState } from '../lib/storage'
import { usePlayer } from '../state/PlayerContext'
import { useToast } from '../state/ToastContext'
import { TrackRow } from '../components/TrackRow'
import { Modal } from '../components/Modal'

const IDEAS = [
  'songs to learn english',
  'pop en inglés',
  'ed sheeran',
  'coldplay lyrics',
  'bad bunny',
  'billie eilish',
  'the beatles',
  'indie folk',
]

type Status = 'idle' | 'loading' | 'success' | 'error'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const { playQueue, addToQueue, playNow } = usePlayer()
  const { showToast } = useToast()
  const [input, setInput] = useState(params.get('q') || '')
  const [results, setResults] = useState<Track[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [history, setHistory] = usePersistentState<string[]>('search-history', [])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const lastQueryRef = useRef('')
  const debouncedInput = useDebouncedValue(input, 550)
  const suggestionsSource = useDebouncedValue(input, 220)

  useClickOutside(wrapRef, () => setFocused(false), focused)

  const runSearch = useCallback(
    async (raw: string, options: { push?: boolean } = {}) => {
      const query = raw.trim()
      if (query.length < 2) return
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      lastQueryRef.current = query
      setStatus('loading')
      setError('')
      setFocused(false)
      if (options.push) setParams({ q: query }, { replace: false })
      setHistory((prev) => [query, ...prev.filter((item) => item !== query)].slice(0, 12))
      try {
        const response = await searchTracks(query, 30, controller.signal)
        if (controller.signal.aborted) return
        setResults(response.tracks)
        setStatus('success')
        if (!response.tracks.length) {
          setError('No encontramos videos para esa búsqueda. Prueba con otras palabras.')
        }
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === 'AbortError') return
        setError((err as ApiError).message || 'No se pudo buscar. Inténtalo de nuevo.')
        setStatus('error')
      }
    },
    [setHistory, setParams],
  )

  // Deep link: ?q=...
  useEffect(() => {
    const q = params.get('q') || ''
    if (!q) return
    if (q === lastQueryRef.current) return
    setInput(q)
    void runSearch(q)
  }, [params, runSearch])

  // Debounced live search while typing.
  useEffect(() => {
    if (debouncedInput.trim().length < 2) return
    if (debouncedInput.trim() === lastQueryRef.current) return
    void runSearch(debouncedInput)
  }, [debouncedInput, runSearch])

  // Suggestions.
  useEffect(() => {
    const q = suggestionsSource.trim()
    if (!focused || q.length < 2) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    getSuggestions(q, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setSuggestions(response.items.slice(0, 7))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [focused, suggestionsSource])

  useEffect(() => setHighlighted(-1), [suggestions])

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault()
    if (highlighted >= 0 && suggestions[highlighted]) {
      selectSuggestion(suggestions[highlighted])
      return
    }
    void runSearch(input, { push: true })
  }

  const selectSuggestion = (value: string) => {
    setInput(value)
    setSuggestions([])
    void runSearch(value, { push: true })
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((prev) => Math.max(prev - 1, -1))
    } else if (event.key === 'Escape') {
      setFocused(false)
    }
  }

  const openLink = async () => {
    const value = linkValue.trim()
    if (!value) return
    setLinkBusy(true)
    setLinkError('')
    try {
      const track = await getTrackMeta(value)
      playNow(track)
      showToast('Reproduciendo desde el enlace', {
        message: `${track.title} · ${track.artist}`,
        kind: 'success',
      })
      setLinkOpen(false)
      setLinkValue('')
    } catch (err) {
      setLinkError((err as Error).message || 'No se pudo leer ese enlace.')
    } finally {
      setLinkBusy(false)
    }
  }

  const showSuggestions = focused && suggestions.length > 0
  const showIntro = status === 'idle' && !input.trim()

  return (
    <div className="page search-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Buscar</p>
          <h1>Encuentra tu próxima canción</h1>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLinkOpen(true)}>
          <Link2 size={15} /> Añadir por enlace
        </button>
      </header>

      <div className="search-wrap" ref={wrapRef}>
        <form className={cx('search-bar', focused && 'is-focused')} onSubmit={submit}>
          <Search size={19} className="search-bar__icon" aria-hidden />
          <input
            ref={inputRef}
            id="search-input"
            className="search-bar__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Canciones, artistas, versiones con letra…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar música en YouTube"
          />
          {input && (
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => {
                setInput('')
                setResults([])
                setStatus('idle')
                lastQueryRef.current = ''
                setParams({}, { replace: true })
                inputRef.current?.focus()
              }}
              aria-label="Borrar búsqueda"
            >
              <X size={15} />
            </button>
          )}
          <button type="submit" className="btn btn--primary btn--sm search-bar__go">
            Buscar
          </button>
        </form>

        {showSuggestions && (
          <div className="suggestions" role="listbox">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                role="option"
                aria-selected={highlighted === index}
                className={cx('suggestion', highlighted === index && 'is-highlighted')}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => selectSuggestion(suggestion)}
              >
                <Search size={15} />
                <span>{suggestion}</span>
                <ArrowRight size={14} className="suggestion__arrow" />
              </button>
            ))}
          </div>
        )}
      </div>

      {showIntro && (
        <div className="search-intro">
          {history.length > 0 && (
            <section className="search-block">
              <div className="section-head">
                <h2>
                  <Clock3 size={16} /> Búsquedas recientes
                </h2>
                <button type="button" className="text-link" onClick={() => setHistory([])}>
                  Borrar
                </button>
              </div>
              <div className="quick-chips">
                {history.map((query) => (
                  <button
                    key={query}
                    type="button"
                    className="chip chip--action"
                    onClick={() => {
                      setInput(query)
                      void runSearch(query, { push: true })
                    }}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="search-block">
            <div className="section-head">
              <h2>
                <Sparkles size={16} /> Ideas para practicar
              </h2>
            </div>
            <div className="quick-chips">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className="chip chip--action"
                  onClick={() => {
                    setInput(idea)
                    void runSearch(idea, { push: true })
                  }}
                >
                  {idea}
                </button>
              ))}
            </div>
          </section>

          <div className="notice-card">
            <ListMusic size={20} />
            <div>
              <strong>Mejores resultados con letra</strong>
              <p>
                Añade <em>“lyrics”</em> o <em>“letra”</em> a la búsqueda para encontrar videos
                con la letra en pantalla. Lyra busca la letra por título y artista, así que
                cualquier video de la canción suele funcionar.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'loading' && (
        <div className="skeleton-list" aria-live="polite" aria-busy="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="skeleton-row">
              <span className="skeleton skeleton--thumb" />
              <span className="skeleton-row__text">
                <span className="skeleton skeleton--line" style={{ width: `${50 + ((index * 13) % 35)}%` }} />
                <span className="skeleton skeleton--line skeleton--short" />
              </span>
            </div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="error-card">
          <AlertCircle size={20} />
          <div>
            <strong>No se pudo completar la búsqueda</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="btn btn--subtle btn--sm" onClick={() => runSearch(input, { push: true })}>
            Reintentar
          </button>
        </div>
      )}

      {status === 'success' && results.length > 0 && (
        <>
          <div className="results-head">
            <div>
              <h2>Resultados</h2>
              <p>
                {results.length} videos · elige cualquiera, la letra se busca por canción y
                artista
              </p>
            </div>
            <div className="results-head__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={() => playQueue(results, 0)}>
                <Play size={14} fill="currentColor" /> Reproducir todo
              </button>
              <button
                type="button"
                className="btn btn--subtle btn--sm"
                onClick={() => {
                  results.forEach((track) => addToQueue(track))
                  showToast('Añadidas a la cola', {
                    message: `${results.length} canciones`,
                    kind: 'success',
                  })
                }}
              >
                <ListMusic size={14} /> Añadir a la cola
              </button>
            </div>
          </div>
          <div className="track-list">
            {results.map((track, index) => (
              <TrackRow
                key={`${track.videoId}-${index}`}
                track={track}
                index={index}
                contextList={results}
                subtitle={`${track.artist}${track.views ? ` · ${track.views}` : ''}`}
                showIndex={false}
              />
            ))}
          </div>
          <p className="results-foot">
            Los videos se reproducen con el reproductor oficial de YouTube. Algunos pueden no
            permitir inserción; en ese caso prueba otra versión del mismo tema.
          </p>
        </>
      )}

      {status === 'success' && results.length === 0 && (
        <div className="empty-state">
          <Search size={24} />
          <h2>Sin resultados</h2>
          <p>{error || 'Prueba con el nombre del artista y la canción.'}</p>
        </div>
      )}

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Añadir por enlace"
        description="Pega la URL de un video de YouTube o su ID."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setLinkOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={openLink}
              disabled={!linkValue.trim() || linkBusy}
            >
              {linkBusy ? <Loader2 size={15} className="spin" /> : <Play size={15} fill="currentColor" />}
              Reproducir
            </button>
          </>
        }
      >
        <label className="field">
          <span className="field__label">Enlace de YouTube</span>
          <input
            className="input"
            data-autofocus
            value={linkValue}
            onChange={(event) => {
              setLinkValue(event.target.value)
              setLinkError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') openLink()
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            spellCheck={false}
          />
        </label>
        <p className="field__hint">
          También sirve <code>youtu.be/ID</code> o el ID de 11 caracteres.
        </p>
        {linkError && (
          <p className="field__error">
            <AlertCircle size={14} /> {linkError}
          </p>
        )}
      </Modal>
    </div>
  )
}
