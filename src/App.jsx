import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import CurrentWeather from './pages/CurrentWeather'
import HistoricalAnalysis from './pages/HistoricalAnalysis'

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
        <Routes>
          <Route path="/" element={<CurrentWeather />} />
          <Route path="/historical" element={<HistoricalAnalysis />} />
        </Routes>
      </main>
    </div>
  )
}
