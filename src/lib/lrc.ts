import type { LyricLine } from '../types'

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
const OFFSET = /^\[offset:\s*(-?\d+)\s*\]$/i
const METADATA = /^\[(ar|ti|al|by|re|ve|length|offset):.*\]$/i
const WORD_TAG = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g

function timestampToSeconds(minutes: string, seconds: string, fraction?: string): number {
  const m = Number(minutes) || 0
  const s = Number(seconds) || 0
  let ms = 0
  if (fraction) {
    if (fraction.length === 1) ms = Number(fraction) * 100
    else if (fraction.length === 2) ms = Number(fraction) * 10
    else ms = Number(fraction.slice(0, 3))
  }
  return m * 60 + s + ms / 1000
}

/** Parse an LRC file into time-stamped lines. Returns [] when no timestamps exist. */
export function parseLrc(raw: string): { lines: LyricLine[]; offset: number } {
  if (!raw) return { lines: [], offset: 0 }
  const source = raw.replace(/\r\n?/g, '\n')
  let offset = 0
  for (const line of source.split('\n')) {
    const match = line.trim().match(OFFSET)
    if (match) offset = Number(match[1]) / 1000
  }

  const collected: LyricLine[] = []
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('{')) continue
    if (METADATA.test(line)) continue
    const stamps: number[] = []
    TIMESTAMP.lastIndex = 0
    let match: RegExpExecArray | null
    let lastIndex = 0
    while ((match = TIMESTAMP.exec(line))) {
      stamps.push(timestampToSeconds(match[1], match[2], match[3]))
      lastIndex = TIMESTAMP.lastIndex
    }
    if (!stamps.length) continue
    const text = line.slice(lastIndex).replace(WORD_TAG, '').trim()
    if (!text) continue
    for (const time of stamps) collected.push({ time: time + offset, text })
  }

  if (!collected.length) return { lines: [], offset }
  collected.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))

  const deduped: LyricLine[] = []
  for (const line of collected) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.time === line.time && prev.text === line.text) continue
    deduped.push(line)
  }
  return { lines: deduped, offset }
}

const FOOTER_PATTERNS = [
  /^paroles de la chanson .+ par .+$/i,
  /^lyrics powered by/i,
  /^\d+ contributors?$/i,
  /^embed$/i,
  /^you might also like$/i,
]

export function cleanPlainLyrics(raw: string): string {
  if (!raw) return ''
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, '').replace(/^\s+/g, ''))
    .filter((line) => !FOOTER_PATTERNS.some((re) => re.test(line)))
  while (lines.length && !lines[0]) lines.shift()
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  const output: string[] = []
  for (const line of lines) {
    if (!line && !output[output.length - 1]) continue
    output.push(line)
  }
  return output.join('\n')
}

export function plainToLines(plain: string): LyricLine[] {
  return cleanPlainLyrics(plain)
    .split('\n')
    .map((text) => ({ time: null, text }))
}

/** Build displayable lines from a lyrics payload. */
export function buildLyricLines(payload: {
  lrc?: string
  plain?: string
  synced?: boolean
}): { lines: LyricLine[]; synced: boolean } {
  if (payload.synced && payload.lrc) {
    const parsed = parseLrc(payload.lrc)
    if (parsed.lines.length) {
      return { lines: parsed.lines, synced: true }
    }
  }
  const plain = cleanPlainLyrics(payload.plain || '')
  const fallback = plain || payload.lrc || ''
  return { lines: plainToLines(fallback), synced: false }
}

/** Index of the line that should be highlighted at `time`. */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  if (!lines.length || lines[0].time === null) return -1
  let low = 0
  let high = lines.length - 1
  let found = -1
  while (low <= high) {
    const mid = (low + high) >> 1
    const t = lines[mid].time ?? 0
    if (t <= time + 0.001) {
      found = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return found
}
