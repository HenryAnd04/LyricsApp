import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { usePlayer, type PlayerSlotKind } from '../state/PlayerContext'

const GRADIENTS = [
  'linear-gradient(135deg,#ff5f6d,#ff2d55 55%,#7a2cff)',
  'linear-gradient(135deg,#00c6ff,#0072ff 55%,#5f2eea)',
  'linear-gradient(135deg,#f9d423,#ff4e50 55%,#b02a7a)',
  'linear-gradient(135deg,#43e97b,#38f9d7 55%,#1467ff)',
  'linear-gradient(135deg,#fa709a,#fee140 55%,#ff5f6d)',
  'linear-gradient(135deg,#30cfd0,#330867 55%,#5f2eea)',
]

export function gradientFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[hash % GRADIENTS.length]
}

interface Props {
  kind: PlayerSlotKind
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Reserves a hole in the layout and keeps the fixed YouTube layer on top of it.
 * Both the dock slot and the stage slot can be mounted; the stage wins.
 */
export function PlayerSlot({ kind, className, style, children }: Props) {
  const { setPlayerSlot } = usePlayer()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) {
        setPlayerSlot(kind, null)
        return
      }
      setPlayerSlot(kind, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        radius: kind === 'dock' ? 10 : 18,
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const interval = window.setInterval(update, 1200)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.clearInterval(interval)
      setPlayerSlot(kind, null)
    }
  }, [kind, setPlayerSlot])

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}

interface CoverProps {
  src?: string
  alt?: string
  seed?: string
  className?: string
  rounded?: boolean
}

export function Cover({ src, alt = '', seed = 'lyra', className, rounded }: CoverProps) {
  return (
    <div
      className={`cover${rounded ? ' cover--rounded' : ''}${className ? ` ${className}` : ''}`}
      style={{ background: gradientFor(seed) }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      ) : null}
    </div>
  )
}
