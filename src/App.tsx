import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { ToastProvider } from './state/ToastContext'
import { LibraryProvider } from './state/LibraryContext'
import { UIProvider } from './state/UIContext'
import { PlayerProvider } from './state/PlayerContext'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { SearchPage } from './pages/Search'
import { LibraryPage } from './pages/Library'
import { PlaylistPage } from './pages/Playlist'
import { VocabularyPage } from './pages/Vocabulary'
import { NowPlayingPage } from './pages/NowPlaying'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <Compass size={24} />
        <h2>Esta página no existe</h2>
        <p>Puede que el enlace esté roto o que la página se haya movido.</p>
        <Link to="/" className="btn btn--primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <LibraryProvider>
          <UIProvider>
            <PlayerProvider>
              <ScrollToTop />
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="library" element={<LibraryPage />} />
                  <Route path="playlist/:id" element={<PlaylistPage />} />
                  <Route path="vocabulary" element={<VocabularyPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                <Route path="/now" element={<NowPlayingPage />} />
              </Routes>
            </PlayerProvider>
          </UIProvider>
        </LibraryProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
