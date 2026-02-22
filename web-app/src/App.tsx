import React, { useState } from 'react'
import './App.css'
import HomeScreen from './screens/HomeScreen'
import MealScreen from './screens/MealScreen'
import ExerciseScreen from './screens/ExerciseScreen'
import HealthScreen from './screens/HealthScreen'
import AiScreen from './screens/AiScreen'

type ScreenType = 'home' | 'meal' | 'exercise' | 'health' | 'ai'

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home')

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
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          }
          label="運動"
          isActive={currentScreen === 'exercise'}
          onClick={() => setCurrentScreen('exercise')}
        />
        <NavItem
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
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
              <polyline points="8 16 11 12 14 15 16 11"></polyline>
            </svg>
          }
          label="AIレポート"
          isActive={currentScreen === 'ai'}
          onClick={() => setCurrentScreen('ai')}
        />
      </nav>
    </div>
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
