import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp, cx } from '../lib/format'

interface SliderProps {
  value: number
  max: number
  min?: number
  step?: number
  ariaLabel: string
  className?: string
  disabled?: boolean
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
}

export function Slider({
  value,
  max,
  min = 0,
  step,
  ariaLabel,
  className,
  disabled,
  onChange,
  onCommit,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const display = preview ?? value
  const range = max - min || 1
  const ratio = clamp((display - min) / range, 0, 1)
  const keyboardStep = step ?? Math.max(range / 100, 0.01)

  const valueFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return min
    const ratioFromX = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    return min + ratioFromX * range
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = valueFromPointer(event)
    setDragging(true)
    setPreview(next)
    onChange?.(next)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return
    const next = valueFromPointer(event)
    setPreview(next)
    onChange?.(next)
  }

  const finish = () => {
    if (!dragging) return
    const next = preview ?? value
    setDragging(false)
    setPreview(null)
    onCommit?.(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = display + keyboardStep
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = display - keyboardStep
    if (event.key === 'Home') next = min
    if (event.key === 'End') next = max
    if (next === null) return
    event.preventDefault()
    const clamped = clamp(next, min, max)
    onChange?.(clamped)
    onCommit?.(clamped)
  }

  return (
    <div
      ref={trackRef}
      className={cx('slider', dragging && 'is-dragging', disabled && 'is-disabled', className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={handleKeyDown}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(display)}
      aria-disabled={disabled}
    >
      <div className="slider__rail">
        <div className="slider__fill" style={{ width: `${ratio * 100}%` }} />
        <div className="slider__thumb" style={{ left: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}
