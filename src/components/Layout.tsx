import { useCallback, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { usePlayer } from '../state/PlayerContext'
import { useLibrary } from '../state/LibraryContext'
import { useToast } from '../state/ToastContext'
import { useUI } from '../state/UIContext'
import { isTypingTarget } from '../lib/format'
import { MobileNav, Sidebar } from '../components/Sidebar'
import { PlayerBar } from '../components/PlayerBar'
import { QueueDrawer } from '../components/QueueDrawer'

function isInteractive(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  return Boolean(
    el.closest(
      'button, a, input, textarea, select, [role="button"], [role="slider"], [contenteditable="true"]',
    ),
  )
}

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const player = usePlayer()
  const { current, togglePlay, seek, next, prev, setVolume, toggleMute, volume } = player
  const { toggleLike } = useLibrary()
  const { showToast } = useToast()
  const { openShortcuts, queueOpen, toggleQueue, closeQueue } = useUI()

  useEffect(() => {
    closeQueue()
  }, [closeQueue, location.pathname])

  const likeCurrent = useCallback(() => {
    if (!current) return
    const nowLiked = toggleLike(current)
    showToast(nowLiked ? 'Añadida a Me gusta' : 'Eliminada de Me gusta', {
      message: current.title,
      kind: nowLiked ? 'success' : 'info',
    })
  }, [current, showToast, toggleLike])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modalOpen = Boolean(document.querySelector('.modal-backdrop'))
      if (event.key === 'Escape') {
        if (modalOpen) return
        if (queueOpen) {
          closeQueue()
          return
        }
        if (location.pathname === '/now') {
          navigate(-1)
        }
        return
      }
      if (modalOpen) return
      if (isTypingTarget(event.target) || isInteractive(event.target)) return

      const key = event.key
      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault()
        togglePlay()
      } else if (key === 'ArrowRight') {
        event.preventDefault()
        seek((player.currentTime || 0) + (event.shiftKey ? 15 : 5))
      } else if (key === 'ArrowLeft') {
        event.preventDefault()
        seek((player.currentTime || 0) - (event.shiftKey ? 15 : 5))
      } else if (key === 'ArrowUp') {
        event.preventDefault()
        setVolume(Math.min(100, volume + 5))
      } else if (key === 'ArrowDown') {
        event.preventDefault()
        setVolume(Math.max(0, volume - 5))
      } else if (key === 'm' || key === 'M') {
        toggleMute()
      } else if (key === 'n' || key === 'N') {
        next()
      } else if (key === 'p' || key === 'P') {
        prev()
      } else if (key === 'l' || key === 'L') {
        likeCurrent()
      } else if (key === 'f' || key === 'F') {
        if (location.pathname === '/now') navigate(-1)
        else navigate('/now')
      } else if (key === '/') {
        event.preventDefault()
        navigate('/search')
        window.requestAnimationFrame(() => {
          document.getElementById('search-input')?.focus()
        })
      } else if (key === '?') {
        event.preventDefault()
        openShortcuts()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    likeCurrent,
    location.pathname,
    navigate,
    next,
    openShortcuts,
    player.currentTime,
    prev,
    queueOpen,
    closeQueue,
    seek,
    setVolume,
    toggleMute,
    togglePlay,
    volume,
  ])
  useEffect(() => {
    document.body.classList.add('has-player')
    return () => document.body.classList.remove('has-player')
  }, [])

  const stageOpen = location.pathname === '/now'

  return (
    <div className={`app${stageOpen ? ' app--stage' : ''}`}>
      <Sidebar />
      <div className="app__main">
        <MobileNav />
        <main className="app__scroll" id="main-scroll">
          <Outlet />
        </main>
      </div>
      <PlayerBar onToggleQueue={toggleQueue} queueOpen={queueOpen} />
      <QueueDrawer open={queueOpen} onClose={closeQueue} />
    </div>
  )
}
