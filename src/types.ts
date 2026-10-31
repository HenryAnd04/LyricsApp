export interface Track {
  videoId: string
  title: string
  artist: string
  channel?: string
  thumbnail: string
  duration: number
  durationText?: string
  views?: string
  published?: string
}

export interface QueuedTrack extends Track {
  uid: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  tracks: Track[]
  createdAt: number
  updatedAt: number
}

export interface WordEntry {
  id: string
  word: string
  translation: string
  phonetic?: string
  audio?: string
  definition?: string
  example?: string
  sourceTitle?: string
  sourceArtist?: string
  sourceVideoId?: string
  addedAt: number
  learned: boolean
  reviews: number
}

export interface Settings {
  theme: 'dark' | 'light'
  showTranslation: boolean
  englishFirst: boolean
  lyricsScale: number
  autoScroll: boolean
}

export interface LyricLine {
  time: number | null
  text: string
  translation?: string
}

export interface LyricsAlternative {
  id: number | null
  title: string
  artist: string
  album?: string
  duration: number
  synced: boolean
}

export interface LyricsPayload {
  found: boolean
  id: number | null
  source: string
  title: string
  artist: string
  album?: string
  duration: number
  synced: boolean
  instrumental: boolean
  lrc: string
  plain: string
  language?: string
  languageIso?: string
  languageName?: string
  isEnglish?: boolean
  alternatives: LyricsAlternative[]
  message?: string
  guessed?: { title: string; artist: string }
  error?: string
}

export interface ManualLyrics {
  text: string
  isLrc: boolean
  updatedAt: number
}

export interface WordLookup {
  word: string
  translation: string
  phonetic: string
  audio: string
  meanings: Array<{ partOfSpeech: string; definition: string; example: string }>
}
