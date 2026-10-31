export interface YTPlayer {
  loadVideoById: (videoId: string) => void
  cueVideoById: (videoId: string) => void
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  setVolume: (volume: number) => void
  getVolume: () => number
  mute: () => void
  unMute: () => void
  isMuted: () => boolean
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  destroy: () => void
}

export interface YTPlayerOptions {
  width?: string | number
  height?: string | number
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: { target: YTPlayer }) => void
    onStateChange?: (event: { data: number; target: YTPlayer }) => void
    onError?: (event: { data: number; target: YTPlayer }) => void
  }
}

interface YTNamespace {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

let apiPromise: Promise<YTNamespace> | null = null

/** Loads the official YouTube IFrame Player API once. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      apiPromise = null
      reject(new Error('YouTube tardó demasiado en cargar. Revisa tu conexión.'))
    }, 20000)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timeout)
      if (window.YT?.Player) resolve(window.YT)
      else {
        apiPromise = null
        reject(new Error('YouTube no está disponible en este navegador.'))
      }
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => {
        window.clearTimeout(timeout)
        apiPromise = null
        reject(
          new Error(
            'No se pudo cargar YouTube. Puede que un bloqueador de anuncios o la red lo esté impidiendo.',
          ),
        )
      }
      document.head.appendChild(script)
    }
  })

  return apiPromise
}

export function youtubeErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return 'El enlace del video no es válido.'
    case 5:
      return 'El reproductor de HTML5 no pudo iniciarse.'
    case 100:
      return 'El video no existe o es privado.'
    case 101:
    case 150:
      return 'El dueño de este video no permite reproducirlo fuera de YouTube. Prueba con otra versión (por ejemplo, un lyric video).'
    default:
      return 'YouTube no pudo reproducir este video.'
  }
}
