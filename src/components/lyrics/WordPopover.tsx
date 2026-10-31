import { useEffect, useState } from 'react'
import { BookmarkPlus, Check, Loader2, Volume2, X } from 'lucide-react'
import type { Track, WordLookup } from '../../types'
import { lookupWord } from '../../lib/api'
import { useLibrary } from '../../state/LibraryContext'
import { useToast } from '../../state/ToastContext'
import { cx } from '../../lib/format'
import { speakWord } from '../../lib/speech'

interface Props {
  word: string
  x: number
  y: number
  track: Track | null
  onClose: () => void
}

const memo = new Map<string, WordLookup>()

export function WordPopover({ word, x, y, track, onClose }: Props) {
  const [data, setData] = useState<WordLookup | null>(() => memo.get(word.toLowerCase()) || null)
  const [loading, setLoading] = useState(!memo.has(word.toLowerCase()))
  const [error, setError] = useState('')
  const { vocabulary, saveWord } = useLibrary()
  const { showToast } = useToast()

  const saved = vocabulary.some((entry) => entry.word.toLowerCase() === word.toLowerCase())

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!word) {
      setData(null)
      setLoading(false)
      setError('')
      return
    }
    const key = word.toLowerCase()
    const cached = memo.get(key)
    if (cached) {
      setData(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    lookupWord(word, 'es')
      .then((result) => {
        if (cancelled) return
        memo.set(key, result)
        setData(result)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message || 'No se encontró la palabra.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [word])

  const speak = () => speakWord(word, data?.audio)

  const handleSave = () => {
    if (!data) return
    const result = saveWord({
      word: data.word,
      translation: data.translation,
      phonetic: data.phonetic,
      audio: data.audio,
      definition: data.meanings[0]?.definition,
      example: data.meanings[0]?.example,
      sourceTitle: track?.title,
      sourceArtist: track?.artist,
      sourceVideoId: track?.videoId,
    })
    if (result === 'duplicate') {
      showToast('Ya está en tu vocabulario', { message: data.word })
    } else {
      showToast('Guardada en tu vocabulario', {
        message: `${data.word} · ${data.translation || 'sin traducción'}`,
        kind: 'success',
      })
    }
  }

  if (!word) return null

  const left = Math.min(Math.max(12, x - 158), window.innerWidth - 332)
  const top = Math.min(Math.max(12, y + 14), window.innerHeight - 336)

  return (
    <>
      <button type="button" className="popover-shade" onClick={onClose} aria-label="Cerrar" />
      <div className="word-popover" style={{ left, top }} role="dialog" aria-label={`Palabra ${word}`}>
        <div className="word-popover__head">
          <div className="word-popover__word">
            <span>{word}</span>
            {data?.phonetic && <span className="word-popover__phonetic">{data.phonetic}</span>}
          </div>
          <div className="word-popover__head-actions">
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={speak}
              aria-label="Escuchar pronunciación"
              title="Escuchar"
            >
              <Volume2 size={16} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="word-popover__loading">
            <Loader2 size={16} className="spin" /> Buscando significado…
          </div>
        )}

        {error && !loading && (
          <p className="word-popover__error">{error}</p>
        )}

        {data && !loading && (
          <>
            <p className="word-popover__translation">{data.translation || '—'}</p>
            {data.meanings.length > 0 && (
              <ul className="word-popover__meanings">
                {data.meanings.slice(0, 2).map((meaning, index) => (
                  <li key={index}>
                    {meaning.partOfSpeech && (
                      <span className="word-popover__pos">{meaning.partOfSpeech}</span>
                    )}
                    <p>{meaning.definition}</p>
                    {meaning.example && <em>“{meaning.example}”</em>}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className={cx('btn', 'btn--subtle', 'btn--full', saved && 'is-saved')}
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? <Check size={15} /> : <BookmarkPlus size={15} />}
              {saved ? 'Ya está en tu vocabulario' : 'Guardar en vocabulario'}
            </button>
          </>
        )}
      </div>
    </>
  )
}
