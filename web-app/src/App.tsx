import React, { useEffect, useMemo, useState } from 'react'
import './App.css'
import HomeScreen from './screens/HomeScreen'
import MealScreen from './screens/MealScreen'
import ExerciseScreen from './screens/ExerciseScreen'
import HealthScreen from './screens/HealthScreen'
import AiScreen from './screens/AiScreen'

type ScreenType = 'home' | 'meal' | 'exercise' | 'health' | 'ai'
type InstallChoice = 'accepted' | 'dismissed'

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: InstallChoice; platform: string }>
  prompt: () => Promise<void>
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showInstallHint, setShowInstallHint] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')

    const updateStandalone = () => {
      const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
      setIsStandalone(media.matches || iosStandalone)
    }

    updateStandalone()
    media.addEventListener('change', updateStandalone)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShowInstallHint(true)
    }

    const onAppInstalled = () => {
      setDeferredPrompt(null)
      setShowInstallHint(false)
      setShowIosHelp(false)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      media.removeEventListener('change', updateStandalone)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const isiOS = useMemo(() => /iphone|ipad|ipod/i.test(window.navigator.userAgent), [])
  const canShowInstallCta = !isStandalone && (showInstallHint || Boolean(deferredPrompt) || isiOS)

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen />
      case 'meal':
        return <MealScreen />
      case 'exercise':
        return <ExerciseScreen />
      case 'health':
        return <HealthScreen />
      case 'ai':
        return <AiScreen />
      default:
        return <HomeScreen />
    }
  }

  return (
    <div className="app-container">
      {canShowInstallCta ? (
        <InstallBanner
          isiOS={isiOS}
          deferredPrompt={deferredPrompt}
          onHide={() => {
            setShowInstallHint(false)
            setShowIosHelp(false)
          }}
          onPromptStateChange={(prompt) => setDeferredPrompt(prompt)}
          showIosHelp={showIosHelp}
          onShowIosHelp={() => setShowIosHelp(true)}
        />
      ) : null}

      {/* Header */}
      <header className="header">
        <div className="header-title">Health AI Advisor</div>
        <div className="header-settings">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content">
        {renderScreen()}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <NavItem
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          }
          label="ホーム"
          isActive={currentScreen === 'home'}
          onClick={() => setCurrentScreen('home')}
        />
        <NavItem
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path>
              <path d="M7 2v20"></path>
              <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"></path>
            </svg>
          }
          label="食事"
          isActive={currentScreen === 'meal'}
          onClick={() => setCurrentScreen('meal')}
        />
        <NavItem
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="14" cy="4" r="1.5"></circle>
              <path d="M12 7.5l-2.5 4.5 4 .5"></path>
              <path d="M14 8l2.5-2"></path>
              <path d="M9.5 12l-2.5 2.5"></path>
              <path d="M13.5 13L15 18l2-1"></path>
              <path d="M13.5 13L11 18l-2.5-.5"></path>
            </svg>
          }
          label="運動"
          isActive={currentScreen === 'exercise'}
          onClick={() => setCurrentScreen('exercise')}
        />
        <NavItem
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <polyline points="6 10 9 7 11 12 14 8 16 10 18 10"></polyline>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          }
          label="健康"
          isActive={currentScreen === 'health'}
          onClick={() => setCurrentScreen('health')}
        />
        <NavItem
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <polyline points="8 17 10.5 13 13 15.5 15 12"></polyline>
              <path d="M18 3l.5 1.5L20 5l-1.5.5L18 7l-.5-1.5L16 5l1.5-.5z" strokeWidth="1.2"></path>
            </svg>
          }
          label="AIカルテ"
          isActive={currentScreen === 'ai'}
          onClick={() => setCurrentScreen('ai')}
        />
      </nav>
    </div>
  )
}

type InstallBannerProps = {
  readonly isiOS: boolean
  readonly deferredPrompt: BeforeInstallPromptEvent | null
  readonly onHide: () => void
  readonly onPromptStateChange: (prompt: BeforeInstallPromptEvent | null) => void
  readonly showIosHelp: boolean
  readonly onShowIosHelp: () => void
}

function InstallBanner({
  isiOS,
  deferredPrompt,
  onHide,
  onPromptStateChange,
  showIosHelp,
  onShowIosHelp,
}: InstallBannerProps) {
  const onInstallClick = async () => {
    if (!deferredPrompt) {
      if (isiOS) {
        onShowIosHelp()
      }
      return
    }

    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      onHide()
    }
    onPromptStateChange(null)
  }

  return (
    <section className="install-banner" role="status" aria-live="polite">
      <div className="install-banner-text">
        <p className="install-banner-title">アプリをホーム画面に追加</p>
        <p className="install-banner-caption">
          オフラインでも起動しやすくなります。
        </p>
        {isiOS && showIosHelp ? (
          <p className="install-banner-ios-help">
            Safari の共有メニューから「ホーム画面に追加」を選択してください。
          </p>
        ) : null}
      </div>
      <div className="install-banner-actions">
        <button type="button" className="install-button" onClick={onInstallClick}>
          追加する
        </button>
        <button type="button" className="dismiss-install-button" onClick={onHide} aria-label="インストール案内を閉じる">
          ×
        </button>
      </div>
    </section>
  )
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div className={`nav-item ${isActive ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </div>
  )
}

export default App
