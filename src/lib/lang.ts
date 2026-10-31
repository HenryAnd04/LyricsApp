import { franc } from 'franc-min'

export const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'Inglés',
  spa: 'Español',
  por: 'Portugués',
  ita: 'Italiano',
  fra: 'Francés',
  deu: 'Alemán',
  nld: 'Neerlandés',
  swe: 'Sueco',
  pol: 'Polaco',
  rus: 'Ruso',
  ukr: 'Ucraniano',
  jpn: 'Japonés',
  kor: 'Coreano',
  zho: 'Chino',
  ara: 'Árabe',
  hin: 'Hindi',
  tur: 'Turco',
  ind: 'Indonesio',
  tha: 'Tailandés',
  vie: 'Vietnamita',
  ell: 'Griego',
  heb: 'Hebreo',
  ron: 'Rumano',
  ces: 'Checo',
  dan: 'Danés',
  fin: 'Finés',
  nor: 'Noruego',
  hun: 'Húngaro',
  cat: 'Catalán',
  fil: 'Filipino',
  und: 'Idioma desconocido',
}

export interface DetectedLanguage {
  code: string
  name: string
  isEnglish: boolean
}

export function detectLanguage(text: string): DetectedLanguage {
  const clean = text.replace(/\[[^\]]*\]/g, ' ').trim()
  if (clean.length < 12) return { code: 'und', name: 'Idioma desconocido', isEnglish: false }
  let code = 'und'
  try {
    code = franc(clean, { minLength: 10, only: Object.keys(LANGUAGE_NAMES) })
  } catch {
    code = 'und'
  }
  if (code === 'und') {
    const printable = clean.replace(/[^\x20-\x7E\n]/g, '').length / clean.length
    if (printable > 0.97) code = 'eng'
  }
  return {
    code,
    name: LANGUAGE_NAMES[code] || 'Idioma desconocido',
    isEnglish: code === 'eng',
  }
}
