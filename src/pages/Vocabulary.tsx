import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Check,
  GraduationCap,
  Headphones,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-react'
import type { WordEntry } from '../types'
import { useLibrary } from '../state/LibraryContext'
import { useToast } from '../state/ToastContext'
import { getTrackMeta } from '../lib/api'
import { speakWord } from '../lib/speech'
import { cx } from '../lib/format'
import { usePlayer } from '../state/PlayerContext'

export function VocabularyPage() {
  const { vocabulary, removeWord } = useLibrary()
  const { playNow } = usePlayer()
  const { showToast } = useToast()
  const [filter, setFilter] = useState('')
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [loadingSong, setLoadingSong] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return vocabulary
    return vocabulary.filter(
      (word) =>
        word.word.toLowerCase().includes(query) ||
        word.translation.toLowerCase().includes(query) ||
        (word.definition || '').toLowerCase().includes(query),
    )
  }, [filter, vocabulary])

  const learned = vocabulary.filter((word) => word.learned).length

  const playContext = async (word: WordEntry) => {
    if (!word.sourceVideoId) return
    setLoadingSong(word.id)
    try {
      const track = await getTrackMeta(word.sourceVideoId)
      playNow(track)
      showToast('Escuchando la canción', { message: track.title })
    } catch (err) {
      showToast('No se pudo abrir la canción', {
        message: (err as Error).message,
        kind: 'error',
      })
    } finally {
      setLoadingSong(null)
    }
  }

  return (
    <div className="page vocabulary-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Aprender</p>
          <h1>Tu vocabulario</h1>
          <p className="page-head__sub">
            Las palabras que guardas mientras escuchas. Repásalas cuando quieras.
          </p>
        </div>
        <div className="page-head__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setPracticeOpen(true)}
            disabled={vocabulary.length === 0}
          >
            <GraduationCap size={16} /> Practicar
          </button>
        </div>
      </header>

      {vocabulary.length > 0 && (
        <div className="vocab-stats">
          <div className="stat-card">
            <span className="stat-card__value">{vocabulary.length}</span>
            <span className="stat-card__label">palabras guardadas</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{learned}</span>
            <span className="stat-card__label">marcadas como aprendidas</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{vocabulary.length - learned}</span>
            <span className="stat-card__label">por repasar</span>
          </div>
          <div className="stat-card stat-card--wide">
            <Sparkles size={18} className="accent" />
            <span className="stat-card__label">
              Toca las palabras en la letra mientras escuchas para añadir más.
            </span>
          </div>
        </div>
      )}

      {vocabulary.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={24} />
          <h2>Tu vocabulario está vacío</h2>
          <p>
            Mientras escuchas una canción, pulsa cualquier palabra en inglés de la letra. Verás su
            traducción y podrás guardarla aquí.
          </p>
          <Link to="/" className="btn btn--primary">
            <Headphones size={16} /> Escuchar música
          </Link>
          <Link to="/search" className="btn btn--ghost">
            <Search size={16} /> Buscar una canción
          </Link>
        </div>
      ) : (
        <>
          {vocabulary.length > 8 && (
            <label className="filter-field">
              <Search size={16} />
              <input
                className="input input--bare"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filtrar palabras…"
                aria-label="Filtrar vocabulario"
              />
              {filter && (
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => setFilter('')}
                  aria-label="Borrar filtro"
                >
                  <X size={14} />
                </button>
              )}
            </label>
          )}

          {filtered.length === 0 ? (
            <p className="muted center">No hay palabras que coincidan con “{filter}”.</p>
          ) : (
            <ul className="vocab-grid">
              {filtered.map((word) => (
                <li key={word.id} className={cx('vocab-card', word.learned && 'is-learned')}>
                  <div className="vocab-card__head">
                    <span className="vocab-card__word">{word.word}</span>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => speakWord(word.word, word.audio)}
                      aria-label={`Escuchar ${word.word}`}
                      title="Escuchar pronunciación"
                    >
                      <Volume2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      onClick={() => {
                        removeWord(word.id)
                        showToast('Palabra eliminada', { message: word.word })
                      }}
                      aria-label={`Eliminar ${word.word}`}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="vocab-card__meta">
                    {word.phonetic && <span className="vocab-card__phonetic">{word.phonetic}</span>}
                    {word.learned && (
                      <span className="chip chip--tiny chip--ok">
                        <Check size={11} /> Aprendida
                      </span>
                    )}
                  </div>
                  <p className="vocab-card__translation">{word.translation || '—'}</p>
                  {word.definition && <p className="vocab-card__definition">{word.definition}</p>}
                  {word.example && <p className="vocab-card__example">“{word.example}”</p>}
                  <div className="vocab-card__foot">
                    {word.sourceVideoId ? (
                      <button
                        type="button"
                        className="text-link text-link--small"
                        onClick={() => playContext(word)}
                        disabled={loadingSong === word.id}
                        title={word.sourceTitle}
                      >
                        {loadingSong === word.id ? (
                          <Loader2 size={12} className="spin" />
                        ) : (
                          <Headphones size={12} />
                        )}
                        {word.sourceTitle || 'Escuchar en contexto'}
                      </button>
                    ) : (
                      <span className="vocab-card__source">{word.sourceTitle || 'Sin canción'}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <PracticeSession
        open={practiceOpen}
        onClose={() => setPracticeOpen(false)}
        words={vocabulary}
      />
    </div>
  )
}

function PracticeSession({
  open,
  onClose,
  words,
}: {
  open: boolean
  onClose: () => void
  words: WordEntry[]
}) {
  const { reviewWord } = useLibrary()
  const [order, setOrder] = useState<WordEntry[]>([])
  const [position, setPosition] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [stats, setStats] = useState({ known: 0, again: 0 })
  const [finished, setFinished] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef(words)
  wordsRef.current = words

  useEffect(() => {
    if (!open) return
    const currentWords = wordsRef.current
    const shuffled = [...currentWords].sort((a, b) => Number(a.learned) - Number(b.learned))
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    setOrder(shuffled)
    setPosition(0)
    setRevealed(false)
    setStats({ known: 0, again: 0 })
    setFinished(false)
  }, [open])

  const current = order[position]

  useEffect(() => {
    if (!open) return
    cardRef.current?.focus()
  }, [open, position])

  const answer = (known: boolean) => {
    if (!current) return
    reviewWord(current.id, known)
    setStats((prev) =>
      known ? { ...prev, known: prev.known + 1 } : { ...prev, again: prev.again + 1 },
    )
    if (!known) {
      setOrder((prev) => [...prev, current])
    }
    setRevealed(false)
    setPosition((prev) => prev + 1)
    if (position + 1 >= order.length && known) {
      setFinished(true)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (finished) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (!revealed) setRevealed(true)
      } else if ((event.key === '1' || event.key === '2') && revealed) {
        answer(event.key === '2')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  const progress = order.length ? Math.min(position, order.length) / order.length : 0

  return (
    <div className="practice" role="dialog" aria-modal="true" aria-label="Practicar vocabulario">
      <div className="practice__backdrop" onClick={onClose} />
      <div className="practice__panel">
        <header className="practice__head">
          <div>
            <p className="eyebrow">Práctica</p>
            <h2>Repaso de vocabulario</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar práctica">
            <X size={18} />
          </button>
        </header>

        <div className="practice__progress" aria-hidden>
          <span style={{ width: `${progress * 100}%` }} />
        </div>

        {finished ? (
          <div className="practice__done">
            <span className="practice__done-icon">
              <Check size={26} />
            </span>
            <h3>Ronda completada</h3>
            <p>
              {stats.known} {stats.known === 1 ? 'palabra sabida' : 'palabras sabidas'} ·{' '}
              {stats.again} por repasar.
            </p>
            <div className="practice__done-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const shuffled = [...wordsRef.current].sort(() => Math.random() - 0.5)
                  setOrder(shuffled)
                  setPosition(0)
                  setStats({ known: 0, again: 0 })
                  setRevealed(false)
                  setFinished(false)
                }}
              >
                <RotateCcw size={15} /> Otra ronda
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : current ? (
          <div className="practice__body">
            <p className="practice__counter">
              {Math.min(position + 1, order.length)} de {order.length}
            </p>
            <div
              className="practice__card"
              ref={cardRef}
              tabIndex={0}
              onClick={() => setRevealed((prev) => !prev)}
            >
              <span className="practice__word">{current.word}</span>
              {current.phonetic && <span className="practice__phonetic">{current.phonetic}</span>}
              <button
                type="button"
                className="icon-btn"
                onClick={(event) => {
                  event.stopPropagation()
                  speakWord(current.word, current.audio)
                }}
                aria-label="Escuchar pronunciación"
              >
                <Volume2 size={18} />
              </button>

              {!revealed ? (
                <p className="practice__hint">
                  Pulsa <kbd>Espacio</kbd> o toca la tarjeta para ver el significado
                </p>
              ) : (
                <div className="practice__answer">
                  <p className="practice__translation">{current.translation || '—'}</p>
                  {current.definition && <p className="practice__definition">{current.definition}</p>}
                  {current.example && <p className="practice__example">“{current.example}”</p>}
                  {current.sourceTitle && (
                    <p className="practice__source">De: {current.sourceTitle}</p>
                  )}
                </div>
              )}
            </div>
            <div className="practice__actions">
              <button
                type="button"
                className="btn btn--subtle practice__again"
                onClick={() => answer(false)}
                disabled={!revealed}
              >
                Otra vez <kbd>1</kbd>
              </button>
              <button
                type="button"
                className="btn btn--primary practice__known"
                onClick={() => answer(true)}
                disabled={!revealed}
              >
                La sé <kbd>2</kbd>
              </button>
            </div>
            <div className="practice__stats">
              <span>
                <Check size={13} /> {stats.known} sabidas
              </span>
              <span>
                <RotateCcw size={13} /> {stats.again} por repasar
              </span>
            </div>
          </div>
        ) : (
          <div className="practice__done">
            <p>No hay palabras para practicar.</p>
            <button type="button" className="btn btn--primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
