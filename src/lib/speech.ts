let currentAudio: HTMLAudioElement | null = null

/** Plays a pronunciation clip, falling back to speech synthesis. */
export function speakWord(word: string, audioUrl?: string) {
  if (audioUrl) {
    try {
      currentAudio?.pause()
      const audio = new Audio(audioUrl)
      currentAudio = audio
      const promise = audio.play()
      if (promise) {
        promise.catch(() => speechFallback(word))
        return
      }
      return
    } catch {
      /* fall back */
    }
  }
  speechFallback(word)
}

function speechFallback(word: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
