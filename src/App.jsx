import React, { Suspense, lazy } from 'react'
import { Routes, Route, Link } from 'react-router-dom'

// Lazy load pages
const CurrentWeather = lazy(() => import('./pages/CurrentWeather'))
const HistoricalAnalysis = lazy(() => import('./pages/HistoricalAnalysis'))

const LoadingFallback = () => (
  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-2)' }}>
    Loading weather data...
  </div>
)

export default function App() {
  return (
    <div className="app">
      <nav className="topbar">
        <h1>Weather Dashboard</h1>
        <div className="nav-links">
          <Link to="/">Current</Link>
          <Link to="/historical">Historical</Link>
        </div>
      </nav>
      <main>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<CurrentWeather />} />
            <Route path="/historical" element={<HistoricalAnalysis />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
