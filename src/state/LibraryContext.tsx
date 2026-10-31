import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import type { Playlist, Settings, Track, WordEntry } from '../types'
import { uid } from '../lib/format'
import { usePersistentState } from '../lib/storage'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  showTranslation: true,
  englishFirst: true,
  lyricsScale: 1,
  autoScroll: true,
}

interface LibraryApi {
  liked: Track[]
  playlists: Playlist[]
  recent: Track[]
  vocabulary: WordEntry[]
  settings: Settings
  isLiked: (videoId: string) => boolean
  toggleLike: (track: Track) => boolean
  addRecent: (track: Track) => void
  clearRecent: () => void
  createPlaylist: (name: string, tracks?: Track[]) => Playlist
  renamePlaylist: (id: string, name: string) => void
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, track: Track) => 'added' | 'duplicate' | 'missing'
  removeFromPlaylist: (playlistId: string, videoId: string) => void
  saveWord: (entry: Omit<WordEntry, 'id' | 'addedAt' | 'learned' | 'reviews'>) => 'added' | 'duplicate'
  removeWord: (id: string) => void
  reviewWord: (id: string, known: boolean) => void
  updateSettings: (patch: Partial<Settings>) => void
}

const LibraryContext = createContext<LibraryApi | null>(null)

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider')
  return ctx
}

function normalizeTrack(track: Track): Track {
  return {
    videoId: track.videoId,
    title: track.title,
    artist: track.artist || '',
    channel: track.channel || '',
    thumbnail: track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg`,
    duration: track.duration || 0,
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [liked, setLiked] = usePersistentState<Track[]>('liked', [])
  const [playlists, setPlaylists] = usePersistentState<Playlist[]>('playlists', [])
  const [recent, setRecent] = usePersistentState<Track[]>('recent', [])
  const [vocabulary, setVocabulary] = usePersistentState<WordEntry[]>('vocabulary', [])
  const [settings, setSettings] = usePersistentState<Settings>('settings', DEFAULT_SETTINGS)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', settings.theme === 'light' ? '#f5f5f7' : '#08080a')
  }, [settings.theme])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--lyrics-scale',
      String(settings.lyricsScale || 1),
    )
  }, [settings.lyricsScale])

  const isLiked = useCallback(
    (videoId: string) => liked.some((t) => t.videoId === videoId),
    [liked],
  )

  const toggleLike = useCallback(
    (track: Track) => {
      const exists = liked.some((t) => t.videoId === track.videoId)
      if (exists) {
        setLiked((prev) => prev.filter((t) => t.videoId !== track.videoId))
        return false
      }
      setLiked((prev) => [normalizeTrack(track), ...prev])
      return true
    },
    [liked, setLiked],
  )

  const addRecent = useCallback(
    (track: Track) => {
      setRecent((prev) => {
        if (prev[0]?.videoId === track.videoId) return prev
        return [normalizeTrack(track), ...prev.filter((t) => t.videoId !== track.videoId)].slice(
          0,
          40,
        )
      })
    },
    [setRecent],
  )

  const clearRecent = useCallback(() => setRecent([]), [setRecent])

  const createPlaylist = useCallback(
    (name: string, tracks: Track[] = []) => {
      const now = Date.now()
      const playlist: Playlist = {
        id: uid('pl'),
        name: name.trim() || 'Nueva lista',
        tracks: tracks.map(normalizeTrack),
        createdAt: now,
        updatedAt: now,
      }
      setPlaylists((prev) => [playlist, ...prev])
      return playlist
    },
    [setPlaylists],
  )

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p,
        ),
      )
    },
    [setPlaylists],
  )

  const deletePlaylist = useCallback(
    (id: string) => setPlaylists((prev) => prev.filter((p) => p.id !== id)),
    [setPlaylists],
  )

  const addToPlaylist = useCallback(
    (playlistId: string, track: Track): 'added' | 'duplicate' | 'missing' => {
      let result: 'added' | 'duplicate' | 'missing' = 'missing'
      setPlaylists((prev) =>
        prev.map((playlist) => {
          if (playlist.id !== playlistId) return playlist
          if (playlist.tracks.some((t) => t.videoId === track.videoId)) {
            result = 'duplicate'
            return playlist
          }
          result = 'added'
          return {
            ...playlist,
            tracks: [...playlist.tracks, normalizeTrack(track)],
            updatedAt: Date.now(),
          }
        }),
      )
      return result
    },
    [setPlaylists],
  )

  const removeFromPlaylist = useCallback(
    (playlistId: string, videoId: string) => {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlistId
            ? { ...p, tracks: p.tracks.filter((t) => t.videoId !== videoId), updatedAt: Date.now() }
            : p,
        ),
      )
    },
    [setPlaylists],
  )

  const saveWord = useCallback<LibraryApi['saveWord']>(
    (entry) => {
      let status: 'added' | 'duplicate' = 'added'
      setVocabulary((prev) => {
        if (prev.some((w) => w.word.toLowerCase() === entry.word.toLowerCase())) {
          status = 'duplicate'
          return prev
        }
        const word: WordEntry = {
          ...entry,
          id: uid('w'),
          addedAt: Date.now(),
          learned: false,
          reviews: 0,
        }
        return [word, ...prev]
      })
      return status
    },
    [setVocabulary],
  )

  const removeWord = useCallback(
    (id: string) => setVocabulary((prev) => prev.filter((w) => w.id !== id)),
    [setVocabulary],
  )

  const reviewWord = useCallback(
    (id: string, known: boolean) => {
      setVocabulary((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, learned: known, reviews: w.reviews + 1 }
            : w,
        ),
      )
    },
    [setVocabulary],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => ({ ...prev, ...patch }))
    },
    [setSettings],
  )

  const value = useMemo<LibraryApi>(
    () => ({
      liked,
      playlists,
      recent,
      vocabulary,
      settings,
      isLiked,
      toggleLike,
      addRecent,
      clearRecent,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      saveWord,
      removeWord,
      reviewWord,
      updateSettings,
    }),
    [
      liked,
      playlists,
      recent,
      vocabulary,
      settings,
      isLiked,
      toggleLike,
      addRecent,
      clearRecent,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      saveWord,
      removeWord,
      reviewWord,
      updateSettings,
    ],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}
