import React, { useEffect, useMemo, useState } from 'react'
import './App.css'
import HomeScreen from './screens/HomeScreen'
import type { HomeNavigateTarget } from './screens/HomeScreen'
import MealScreen from './screens/MealScreen'
import ExerciseScreen from './screens/ExerciseScreen'
import HealthScreen from './screens/HealthScreen'
import MyScreen from './screens/MyScreen'
import SetupScreen from './screens/SetupScreen'
import { DateProvider } from './context/DateContext'
import { fetchProfile } from './api/healthApi'
import type { ProfileResponse } from './api/types'

type ScreenType = 'home' | 'meal' | 'exercise' | 'health' | 'my'
type InstallChoice = 'accepted' | 'dismissed'
type SetupGate = 'checking' | 'required' | 'completed'

const SETUP_COMPLETED_KEY = 'healthos.setup.completed'

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: InstallChoice; platform: string }>
  prompt: () => Promise<void>
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home')
  const [healthInitialTab, setHealthInitialTab] = useState<'composition' | 'circulation' | 'sleep'>('composition')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showInstallHint, setShowInstallHint] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [setupGate, setSetupGate] = useState<SetupGate>('checking')
  const [setupProfile, setSetupProfile] = useState<ProfileResponse | null>(null)

  const onHomeNavigate = (target: HomeNavigateTarget) => {
    if (target.tab === 'health' && target.innerTab) {
      if (target.innerTab === 'vital') {
        setHealthInitialTab('circulation')
      } else {
        setHealthInitialTab(target.innerTab)
      }
    }
    setCurrentScreen(target.tab)
  }

  useEffect(() => {
    let mounted = true
    const completedOnClient = window.localStorage.getItem(SETUP_COMPLETED_KEY) === '1'
    if (completedOnClient) {
      setSetupGate('completed')
      return () => {
        mounted = false
      }
    }

    const checkSetup = async () => {
      try {
        const profile = await fetchProfile()
        if (!mounted) {
          return
        }
        setSetupProfile(profile)
        if (hasSetupData(profile)) {
          window.localStorage.setItem(SETUP_COMPLETED_KEY, '1')
          setSetupGate('completed')
          return
        }
        setSetupGate('required')
      } catch {
        if (mounted) {
          setSetupGate('required')
        }
      }
    }

    void checkSetup()
    return () => {
      mounted = false
    }
  }, [])

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
  const isSetupActive = setupGate !== 'completed'
  const canShowInstallCta = !isSetupActive && !isStandalone && (showInstallHint || Boolean(deferredPrompt) || isiOS)

  const renderScreen = () => {
    if (setupGate === 'checking') {
      return (
        <div className="setup-loading-card">
          初期設定の状態を確認しています...
        </div>
      )
    }

    if (setupGate === 'required') {
      return (
        <SetupScreen
          initialProfile={setupProfile}
          onComplete={(profile) => {
            setSetupProfile(profile)
            window.localStorage.setItem(SETUP_COMPLETED_KEY, '1')
            setSetupGate('completed')
            setCurrentScreen('home')
          }}
          onSkip={() => {
            window.localStorage.setItem(SETUP_COMPLETED_KEY, '1')
            setSetupGate('completed')
            setCurrentScreen('home')
          }}
        />
      )
    }

    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={onHomeNavigate} />
      case 'meal':
        return <MealScreen />
      case 'exercise':
        return <ExerciseScreen />
      case 'health':
        return <HealthScreen initialTab={healthInitialTab} />
      case 'my':
        return <MyScreen />
      default:
        return <HomeScreen onNavigate={onHomeNavigate} />
    }
  }

  return (
    <DateProvider>
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
          <div className="header-title">{isSetupActive ? '初回セットアップ' : 'Health AI Advisor'}</div>
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
        {!isSetupActive ? (
          <nav className="bottom-nav">
            <NavItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              }
              label="コンディション"
              isActive={currentScreen === 'health'}
              onClick={() => setCurrentScreen('health')}
            />
            <NavItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
              }
              label="アクティビティ"
              isActive={currentScreen === 'exercise'}
              onClick={() => setCurrentScreen('exercise')}
            />
            <NavItem
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              }
              label="プロフィール"
              isActive={currentScreen === 'my'}
              onClick={() => setCurrentScreen('my')}
            />
          </nav>
        ) : null}
      </div>
    </DateProvider>
  )
}

function hasSetupData(profile: ProfileResponse | null): boolean {
  if (!profile) {
    return false
  }

  const hasBasic =
    (typeof profile.age === 'number' && profile.age > 0) ||
    profile.gender != null ||
    (typeof profile.height_cm === 'number' && profile.height_cm > 0)
  const hasLens =
    profile.lens_weight === 1 ||
    profile.lens_bp === 1 ||
    profile.lens_sleep === 1 ||
    profile.lens_performance === 1
  const hasExercise =
    (profile.exercise_freq != null && profile.exercise_freq !== 'none') ||
    (profile.exercise_type != null && profile.exercise_type !== 'none') ||
    (profile.exercise_intensity != null && profile.exercise_intensity !== 'moderate')

  return hasBasic || hasLens || hasExercise
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
