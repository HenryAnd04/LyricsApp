import { ListMusic } from 'lucide-react'
import type { Playlist } from '../types'
import { cx } from '../lib/format'
import { Cover } from './PlayerSlot'

export function PlaylistCover({
  playlist,
  className,
}: {
  playlist: Playlist
  className?: string
}) {
  const covers = playlist.tracks.slice(0, 4)
  if (covers.length >= 4) {
    return (
      <div className={cx('playlist-cover', 'playlist-cover--mosaic', className)}>
        {covers.map((track) => (
          <Cover key={track.videoId} src={track.thumbnail} seed={track.videoId} />
        ))}
      </div>
    )
  }
  if (covers.length > 0) {
    return (
      <div className={cx('playlist-cover', className)}>
        <Cover src={covers[0].thumbnail} seed={covers[0].videoId} />
      </div>
    )
  }
  return (
    <div className={cx('playlist-cover', 'playlist-cover--empty', className)}>
      <ListMusic size={18} aria-hidden />
    </div>
  )
}
