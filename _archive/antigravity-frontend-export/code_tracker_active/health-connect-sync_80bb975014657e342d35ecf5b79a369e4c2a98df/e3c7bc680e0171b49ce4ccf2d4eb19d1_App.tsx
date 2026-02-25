�import { useState } from 'react'
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
          icon="🏠"
          label="Home"
          isActive={currentScreen === 'home'}
          onClick={() => setCurrentScreen('home')}
        />
        <NavItem
          icon="🍽"
          label="Meal"
          isActive={currentScreen === 'meal'}
          onClick={() => setCurrentScreen('meal')}
        />
        <NavItem
          icon="🏃"
          label="Exercise"
          isActive={currentScreen === 'exercise'}
          onClick={() => setCurrentScreen('exercise')}
        />
        <NavItem
          icon="❤️"
          label="Health"
          isActive={currentScreen === 'health'}
          onClick={() => setCurrentScreen('health')}
        />
        <NavItem
          icon="🤖"
          label="AI"
          isActive={currentScreen === 'ai'}
          onClick={() => setCurrentScreen('ai')}
        />
      </nav>
    </div>
  )
}

function NavItem({ icon, label, isActive, onClick }: { icon: string, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div className={`nav-item ${isActive ? 'active' : ''}`} onClick={onClick}>
      <span className="nav-item-icon">{icon}</span>
      <span className="nav-item-label">{label}</span>
    </div>
  )
}

export default App
�"(80bb975014657e342d35ecf5b79a369e4c2a98df2=file:///C:/Users/user/health-connect-sync/web-app/src/App.tsx:)file:///C:/Users/user/health-connect-sync