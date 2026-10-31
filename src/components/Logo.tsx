import { Link } from 'react-router-dom'
import { AudioLines } from 'lucide-react'

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="logo" aria-label="Lyra, inicio">
      <span className="logo__mark" aria-hidden>
        <AudioLines size={20} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="logo__text">
          <span className="logo__name">Lyra</span>
          <span className="logo__tag">Inglés con música</span>
        </span>
      )}
    </Link>
  )
}
