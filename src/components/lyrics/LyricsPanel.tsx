import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react'
import {
  AlertCircle,
  ArrowDownUp,
  Check,
  Clock3,
  Languages,
  Loader2,
  Minus,
  MoreHorizontal,
  Music2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react'
import type { LyricsAlternative, LyricsPayload, Track } from '../../types'
import { usePlayer } from '../../state/PlayerContext'
import { useLibrary } from '../../state/LibraryContext'
import { useToast } from '../../state/ToastContext'
import { activeLineIndex } from '../../lib/lrc'
import { getLyricsOffset, setLyricsOffset } from '../../lib/lyricsStore'
import { getLyricsById } from '../../lib/api'
import { useClickOutside } from '../../lib/hooks'
import { clamp, cx } from '../../lib/format'
import { Modal } from '../Modal'
import { WordPopover } from './WordPopover'
import { useLyrics, useLyricsTranslation } from './useLyrics'

const TAG_PATTERN = /^\s*[\[(][^\])]*[\])]\s*$/
const WORD_TOKEN = /(\p{L}[\p{L}\p{M}'’\-]*)/u

function tokenize(text: string) {
  return text.split(WORD_TOKEN).filter((part) => part.length > 0)
}

function normalizeLine(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

interface LineProps {
  text: string
  translation: string
  active: boolean
  timed: boolean
  isEnglish: boolean
  englishFirst: boolean
  showOriginal: boolean
  showEnglish: boolean
  wordsEnabled: boolean
  hasTranslation: boolean
  onSeek: (time: number) => void
  time: number | null
  onWord: (word: string, event: MouseEvent<HTMLElement>) => void
}

const LyricLineView = memo(function LyricLineView({
  text,
  translation,
  active,
  timed,
  isEnglish,
  englishFirst,
  showOriginal,
  showEnglish,
  wordsEnabled,
  hasTranslation,
  onSeek,
  time,
  onWord,
}: LineProps) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const wordEl = target.closest<HTMLElement>('[data-word]')
    if (wordEl && wordsEnabled) {
      onWord(wordEl.textContent || '', event)
      return
    }
    if (timed && time !== null) onSeek(time)
  }

  const englishText = isEnglish ? text : translation || text
  // Some sources (and Google) return the same English line for lines that are
  // already in English. Avoid showing the same text twice.
  const alreadyEnglish =
    !isEnglish && Boolean(translation) && normalizeLine(text) === normalizeLine(translation)

  return (
    <div
      className={cx('lyric-line', active && 'is-active', timed && 'is-timed')}
      onClick={handleClick}
      role={timed ? 'button' : undefined}
      tabIndex={timed ? 0 : undefined}
      onKeyDown={(event) => {
        if (timed && time !== null && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onSeek(time)
        }
      }}
    >
      {isEnglish || alreadyEnglish ? (
        <p className="lyric-en">
          <Worlds text={englishText} enabled={wordsEnabled} />
        </p>
      ) : !showEnglish ? (
        <p className="lyric-original lyric-original--solo">
          <Worlds text={text} enabled={false} />
        </p>
      ) : (
        <>
          {!englishFirst && showOriginal && <p className="lyric-original">{text}</p>}
          <p className="lyric-en">
            <Worlds text={englishText} enabled={wordsEnabled && hasTranslation} />
          </p>
          {englishFirst && showOriginal && <p className="lyric-original">{text}</p>}
        </>
      )}
    </div>
  )
})

function Worlds({ text, enabled }: { text: string; enabled: boolean }) {
  if (!enabled) return <>{text}</>
  const parts = tokenize(text)
  return (
    <>
      {parts.map((part, index) =>
        WORD_TOKEN.test(part) ? (
          <span key={index} data-word className="lyric-word">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

export function LyricsPanel({ track }: { track: Track | null }) {
  const { currentTime, seek } = usePlayer()
  const { settings, updateSettings } = useLibrary()
  const { showToast } = useToast()
  const lyrics = useLyrics(track)
  const [showOriginal, setShowOriginal] = useState(true)
  const [offset, setOffset] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualText, setManualText] = useState('')
  const [altOpen, setAltOpen] = useState(false)
  const [altLoading, setAltLoading] = useState<number | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [wordPopup, setWordPopup] = useState<{ word: string; x: number; y: number } | null>(null)
  const [autoPaused, setAutoPaused] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pauseUntilRef = useRef(0)
  const syncRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useClickOutside(syncRef, () => setSyncOpen(false), syncOpen)
  useClickOutside(moreRef, () => setMoreOpen(false), moreOpen)

  const lineTexts = useMemo(() => lyrics.lines.map((line) => line.text), [lyrics.lines])
  const translation = useLyricsTranslation(
    track,
    lyrics.data,
    lineTexts,
    settings.showTranslation,
  )

  const bilingual = !lyrics.isEnglish
  const translationReady = translation.translations.length === lyrics.lines.length
  const hasTranslation = bilingual && translationReady
  const effectiveTime = currentTime + offset
  const active = useMemo(
    () => (lyrics.synced ? activeLineIndex(lyrics.lines, effectiveTime) : -1),
    [lyrics.synced, lyrics.lines, effectiveTime],
  )

  useEffect(() => {
    setOffset(track ? getLyricsOffset(track.videoId) : 0)
    setAutoPaused(false)
    setWordPopup(null)
  }, [track?.videoId])

  useEffect(() => {
    if (!lyrics.synced || active < 0) return
    if (!settings.autoScroll || autoPaused) return
    const container = scrollRef.current
    const element = lineRefs.current.get(active)
    if (!container || !element) return
    const target = element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2
    container.scrollTo({
      top: Math.max(0, target),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [active, autoPaused, lyrics.synced, settings.autoScroll])

  useEffect(() => {
    if (!autoPaused) return
    const timer = window.setInterval(() => {
      if (Date.now() > pauseUntilRef.current) setAutoPaused(false)
    }, 800)
    return () => window.clearInterval(timer)
  }, [autoPaused])

  const pauseAutoScroll = () => {
    pauseUntilRef.current = Date.now() + 6000
    setAutoPaused(true)
  }

  const resumeAutoScroll = () => {
    pauseUntilRef.current = 0
    setAutoPaused(false)
    const container = scrollRef.current
    const element = active >= 0 ? lineRefs.current.get(active) : null
    if (container && element) {
      container.scrollTo({
        top: element.offsetTop - container.clientHeight / 2 + element.clientHeight / 2,
        behavior: 'smooth',
      })
    }
  }

  const changeOffset = (delta: number) => {
    if (!track) return
    const next = clamp(Math.round((offset + delta) * 10) / 10, -20, 20)
    setOffset(next)
    setLyricsOffset(track.videoId, next)
  }

  const handleWord = useCallback((word: string, event: MouseEvent<HTMLElement>) => {
    if (!word) return
    setWordPopup({ word, x: event.clientX, y: event.clientY })
  }, [])

  const handleSeek = useCallback(
    (time: number) => {
      seek(time)
    },
    [seek],
  )

  const openManual = () => {
    const prefill =
      lyrics.data?.source === 'manual'
        ? (lyrics.data.lrc || lyrics.data.plain)
        : lyrics.data?.lrc || lyrics.data?.plain || ''
    setManualText(prefill)
    setManualOpen(true)
    setMoreOpen(false)
  }

  const saveManual = () => {
    const text = manualText.trim()
    if (text.length < 8) return
    lyrics.applyManual(text)
    setManualOpen(false)
    showToast('Letra guardada', {
      message: /\[\d{1,3}:\d{1,2}/.test(text)
        ? 'La letra tiene marcas de tiempo: se mostrará sincronizada.'
        : 'La letra no tiene tiempos: se mostrará sin resaltado.',
      kind: 'success',
    })
  }

  const chooseAlternative = async (alt: LyricsAlternative) => {
    if (!alt.id) return
    setAltLoading(alt.id)
    try {
      const payload: LyricsPayload = await getLyricsById(alt.id)
      lyrics.applyPayload(payload)
      setAltOpen(false)
      showToast('Letra actualizada', {
        message: `${payload.title} · ${payload.artist}`,
        kind: 'success',
      })
    } catch (err) {
      showToast('No se pudo cargar esa versión', {
        message: (err as Error).message,
        kind: 'error',
      })
    } finally {
      setAltLoading(null)
    }
  }

  const retranslate = () => {
    translation.retry()
  }

  const syncOffsetLabel =
    offset === 0 ? '0 s' : `${offset > 0 ? '+' : ''}${offset.toFixed(1)} s`

  const statusChip = lyrics.synced ? (
    <span className="chip chip--tiny chip--ok">
      <Sparkles size={11} /> Sincronizada
    </span>
  ) : lyrics.status === 'ready' ? (
    <span className="chip chip--tiny">Sin sincronía</span>
  ) : null

  return (
    <section className="lyrics-panel" aria-label="Letra de la canción">
      <header className="lyrics-head">
        <div className="lyrics-head__left">
          <div className="lyrics-head__title">
            <span className="eyebrow">Letra</span>
            {statusChip}
          </div>
          <p className="lyrics-head__lang">
            {lyrics.isEnglish ? 'Inglés' : `${lyrics.languageName} → Inglés`}
            {lyrics.data?.source === 'lrclib' && <span className="dot-sep">·</span>}
            {lyrics.data?.source === 'lrclib' && 'LRCLIB'}
            {lyrics.data?.source === 'lyrics.ovh' && '· lyrics.ovh'}
            {lyrics.data?.source === 'manual' && '· Letra manual'}
            {translation.status === 'loading' && (
              <span className="lyrics-head__loading">
                <Loader2 size={12} className="spin" /> traduciendo
              </span>
            )}
          </p>
        </div>

        <div className="lyrics-tools">
          {bilingual && (
            <button
              type="button"
              className={cx('tool-pill', settings.showTranslation && 'is-active')}
              onClick={() => updateSettings({ showTranslation: !settings.showTranslation })}
              aria-pressed={settings.showTranslation}
              title="Mostrar u ocultar la traducción al inglés"
            >
              <Languages size={14} /> EN
            </button>
          )}
          {bilingual && (
            <button
              type="button"
              className={cx('tool-pill', showOriginal && 'is-active')}
              onClick={() => setShowOriginal((prev) => !prev)}
              aria-pressed={showOriginal}
              title="Mostrar u ocultar la letra original"
            >
              Original
            </button>
          )}
          <div className="tool-group">
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => updateSettings({ lyricsScale: clamp(settings.lyricsScale - 0.1, 0.8, 1.4) })}
              aria-label="Reducir el tamaño de la letra"
              disabled={settings.lyricsScale <= 0.8}
            >
              <Minus size={14} />
            </button>
            <Type size={15} className="muted" aria-hidden />
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => updateSettings({ lyricsScale: clamp(settings.lyricsScale + 0.1, 0.8, 1.4) })}
              aria-label="Aumentar el tamaño de la letra"
              disabled={settings.lyricsScale >= 1.4}
            >
              <Plus size={14} />
            </button>
          </div>

          {lyrics.synced && (
            <div className="tool-anchor" ref={syncRef}>
              <button
                type="button"
                className={cx('icon-btn icon-btn--sm', offset !== 0 && 'is-active')}
                onClick={() => setSyncOpen((prev) => !prev)}
                aria-label="Ajustar la sincronía de la letra"
                title={`Sincronía: ${syncOffsetLabel}`}
              >
                <Clock3 size={15} />
              </button>
              {syncOpen && (
                <div className="mini-popover sync-popover">
                  <p className="mini-popover__title">Ajustar sincronía</p>
                  <p className="mini-popover__hint">
                    Si la letra se resalta antes o después de lo que suena, corrígela aquí.
                  </p>
                  <div className="sync-popover__row">
                    <button type="button" className="btn btn--subtle btn--sm" onClick={() => changeOffset(-0.5)}>
                      −0,5 s
                    </button>
                    <span className="sync-popover__value">{syncOffsetLabel}</span>
                    <button type="button" className="btn btn--subtle btn--sm" onClick={() => changeOffset(0.5)}>
                      +0,5 s
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--full"
                    onClick={() => changeOffset(-offset)}
                    disabled={offset === 0}
                  >
                    <RotateCcw size={13} /> Restablecer
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="tool-anchor" ref={moreRef}>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-label="Más opciones de la letra"
              title="Más opciones"
            >
              <MoreHorizontal size={16} />
            </button>
            {moreOpen && (
              <div className="mini-popover more-popover">
                {bilingual && (
                  <button
                    type="button"
                    className="mini-popover__item"
                    onClick={() => {
                      updateSettings({ englishFirst: !settings.englishFirst })
                      setMoreOpen(false)
                    }}
                  >
                    <ArrowDownUp size={15} />
                    {settings.englishFirst ? 'Original primero' : 'Inglés primero'}
                  </button>
                )}
                <button type="button" className="mini-popover__item" onClick={openManual}>
                  <Upload size={15} /> Pegar letra manualmente
                </button>
                {(lyrics.data?.alternatives?.length || 0) > 0 && (
                  <button
                    type="button"
                    className="mini-popover__item"
                    onClick={() => {
                      setAltOpen(true)
                      setMoreOpen(false)
                    }}
                  >
                    <Music2 size={15} /> Elegir otra versión
                  </button>
                )}
                <button
                  type="button"
                  className="mini-popover__item"
                  onClick={() => {
                    lyrics.reload()
                    setMoreOpen(false)
                  }}
                >
                  <RefreshCw size={15} /> Recargar letra
                </button>
                {lyrics.isManual && (
                  <button
                    type="button"
                    className="mini-popover__item"
                    onClick={() => {
                      lyrics.removeManual()
                      setMoreOpen(false)
                      showToast('Letra manual eliminada')
                    }}
                  >
                    <RotateCcw size={15} /> Usar letra automática
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {translation.status === 'error' && bilingual && (
        <div className="lyrics-banner">
          <AlertCircle size={15} />
          <span>No se pudo traducir la letra.</span>
          <button type="button" className="btn btn--subtle btn--sm" onClick={retranslate}>
            Reintentar
          </button>
        </div>
      )}
      {lyrics.isManual && (
        <div className="lyrics-banner lyrics-banner--soft">
          <Check size={15} />
          <span>Estás usando una letra guardada en este dispositivo.</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={lyrics.removeManual}>
            Restaurar automática
          </button>
        </div>
      )}

      <div className="lyrics-body">
        {lyrics.status === 'loading' && (
          <div className="lyrics-skeleton" aria-live="polite">
            <p className="lyrics-skeleton__label">
              <Loader2 size={14} className="spin" /> Buscando la letra…
            </p>
            {[72, 54, 64, 40, 78, 58, 66, 44].map((width, index) => (
              <span key={index} style={{ width: `${width}%` }} className="skeleton-line" />
            ))}
          </div>
        )}

        {lyrics.status === 'error' && (
          <div className="lyrics-empty">
            <AlertCircle size={22} />
            <h3>No pudimos cargar la letra</h3>
            <p>{lyrics.error}</p>
            <div className="lyrics-empty__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={lyrics.reload}>
                <RefreshCw size={14} /> Reintentar
              </button>
              <button type="button" className="btn btn--subtle btn--sm" onClick={openManual}>
                <Upload size={14} /> Pegar letra
              </button>
            </div>
          </div>
        )}

        {lyrics.status === 'empty' && (
          <div className="lyrics-empty">
            <Music2 size={22} />
            <h3>No encontramos la letra</h3>
            <p>
              {lyrics.data?.instrumental
                ? 'Esta canción parece ser instrumental.'
                : 'Puede que no esté en las fuentes públicas o que sea otra versión del video.'}
            </p>
            <div className="lyrics-empty__actions">
              {(lyrics.data?.alternatives?.length || 0) > 0 && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setAltOpen(true)}>
                  <Music2 size={14} /> Ver {lyrics.data?.alternatives.length} versiones
                </button>
              )}
              <button type="button" className="btn btn--subtle btn--sm" onClick={openManual}>
                <Upload size={14} /> Pegar letra
              </button>
              {track && (
                <a
                  className="btn btn--ghost btn--sm"
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    `${track.artist} ${track.title} lyrics`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Search size={14} /> Buscar en Google
                </a>
              )}
            </div>
            <p className="lyrics-empty__hint">
              Consejo: pega la letra con marcas de tiempo como <code>[01:23.45]</code> para
              sincronizarla automáticamente.
            </p>
          </div>
        )}

        {lyrics.status === 'ready' && lyrics.data?.instrumental && (
          <div className="lyrics-empty">
            <Music2 size={22} />
            <h3>Canción instrumental</h3>
            <p>Esta pista no tiene letra. Cambia de canción o busca otra versión.</p>
          </div>
        )}

        {lyrics.status === 'ready' && !lyrics.data?.instrumental && lyrics.lines.length > 0 && (
          <div
            className={cx('lyrics-scroll', !lyrics.synced && 'lyrics-scroll--plain')}
            ref={scrollRef}
            onWheel={pauseAutoScroll}
            onTouchMove={pauseAutoScroll}
          >
            <div className="lyrics-spacer" aria-hidden />
            {lyrics.lines.map((line, index) => {
              if (!line.text) {
                return <div key={index} className="lyric-gap" aria-hidden />
              }
              if (TAG_PATTERN.test(line.text) && line.text.length < 42) {
                return (
                  <p key={index} className="lyric-tag">
                    {line.text}
                  </p>
                )
              }
              const isActive = lyrics.synced && index === active
              return (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) lineRefs.current.set(index, el)
                    else lineRefs.current.delete(index)
                  }}
                >
                  <LyricLineView
                    text={line.text}
                    translation={translation.translations[index] || ''}
                    active={isActive}
                    timed={lyrics.synced}
                    isEnglish={lyrics.isEnglish}
                    englishFirst={settings.englishFirst}
                    showOriginal={showOriginal}
                    showEnglish={
                      lyrics.isEnglish ||
                      (settings.showTranslation && translation.status !== 'error')
                    }
                    wordsEnabled={
                      lyrics.isEnglish || (bilingual && settings.showTranslation && translationReady)
                    }
                    hasTranslation={hasTranslation}
                    onSeek={handleSeek}
                    onWord={handleWord}
                    time={line.time}
                  />
                </div>
              )
            })}
            <div className="lyrics-spacer lyrics-spacer--end" aria-hidden />
          </div>
        )}

        {autoPaused && lyrics.synced && (
          <button type="button" className="lyrics-resume" onClick={resumeAutoScroll}>
            <ArrowDownUp size={13} /> Volver a la línea actual
          </button>
        )}

        {lyrics.status === 'ready' && !lyrics.isEnglish && !settings.showTranslation && (
          <div className="lyrics-footnote">
            Traducción oculta. Actívala con el botón <strong>EN</strong>.
          </div>
        )}
        {lyrics.status === 'ready' && lyrics.isEnglish && (
          <div className="lyrics-footnote">
            Esta canción ya está en inglés, así que no hace falta duplicar la letra.
          </div>
        )}
        {lyrics.status === 'ready' && !lyrics.synced && !lyrics.data?.instrumental && (
          <div className="lyrics-footnote">
            Sin tiempos disponibles: puedes seguir la letra, pero no se resalta automáticamente.
          </div>
        )}
      </div>

      <WordPopover
        word={wordPopup?.word || ''}
        x={wordPopup?.x || 0}
        y={wordPopup?.y || 0}
        track={track}
        onClose={() => setWordPopup(null)}
      />

      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Pegar letra manualmente"
        description="Pega la letra de la canción. Se guardará solo en este navegador para este video."
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setManualOpen(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveManual}
              disabled={manualText.trim().length < 8}
            >
              Guardar letra
            </button>
          </>
        }
      >
        <textarea
          className="input textarea"
          value={manualText}
          onChange={(event) => setManualText(event.target.value)}
          placeholder={'[00:12.30] Primera línea\n[00:15.10] Segunda línea\n\nO pega la letra sin tiempos.'}
          rows={14}
          spellCheck={false}
        />
        <p className="field__hint">
          Formato LRC opcional: cada línea empieza con <code>[minutos:segundos.centésimas]</code>.
          Si no hay marcas de tiempo, la letra se mostrará completa sin resaltado.
        </p>
        {lyrics.isManual && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              lyrics.removeManual()
              setManualOpen(false)
            }}
          >
            <RotateCcw size={14} /> Eliminar esta letra manual
          </button>
        )}
      </Modal>

      <Modal
        open={altOpen}
        onClose={() => setAltOpen(false)}
        title="Otras versiones de la letra"
        description="Resultados de LRCLIB que podrían coincidir con esta canción."
        size="md"
      >
        {(lyrics.data?.alternatives?.length || 0) === 0 ? (
          <p className="muted">No hay versiones alternativas guardadas.</p>
        ) : (
          <ul className="alt-list">
            {lyrics.data?.alternatives.map((alt) => (
              <li key={`${alt.id}-${alt.title}`}>
                <button
                  type="button"
                  className="alt-row"
                  onClick={() => chooseAlternative(alt)}
                  disabled={!alt.id || altLoading === alt.id}
                >
                  <span className="alt-row__icon">
                    {altLoading === alt.id ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Music2 size={16} />
                    )}
                  </span>
                  <span className="alt-row__text">
                    <strong>{alt.title}</strong>
                    <span>{alt.artist}</span>
                  </span>
                  {alt.synced && <span className="chip chip--tiny chip--ok">Sincronizada</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  )
}
