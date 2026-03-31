import React, { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import HistoricalCharts from '../shared/HistoricalCharts'
import { startOfDay, subMonths, differenceInDays } from 'date-fns'

export default function HistoricalAnalysis() {
  const today = startOfDay(new Date())
  const [start, setStart] = useState(startOfDay(subMonths(today, 1)))
  const [end, setEnd] = useState(today)
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)

  // On mount, try to get geolocation automatically
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported')
      // fallback to London
      setCoords({ lat: 51.5074, lon: -0.1278 })
      return
    }
    navigator.geolocation.getCurrentPosition(
      p => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      e => {
        const msg = e.message || 'Unable to get location'
        setError(msg)
        // fallback to central London to ensure historical data loads
        setCoords({ lat: 51.5074, lon: -0.1278 })
      },
      { timeout: 8000 }
    )
  }, [])

  // Ensure selected range is not greater than 2 years
  const handleStartChange = d => {
    const s = startOfDay(d)
    // clamp: if difference > 730 days -> set start to end - 2 years
    const days = differenceInDays(end, s)
    if (days > 730) {
      setStart(startOfDay(subMonths(end, 24)))
    } else {
      setStart(s)
    }
  }

  const handleEndChange = d => {
    const e = startOfDay(d)
    const days = differenceInDays(e, start)
    if (days > 730) {
      setEnd(startOfDay(subMonths(e, -24)))
    } else {
      setEnd(e)
    }
  }

  return (
    <div className="page historical">
      <h2>Historical Analysis</h2>
      <div className="controls">
        <div>
          <label>Start:</label>
          <DatePicker selected={start} onChange={handleStartChange} />
        </div>
        <div>
          <label>End:</label>
          <DatePicker selected={end} onChange={handleEndChange} />
        </div>
      </div>

      {error && <div className="note">Location error: {error} — using fallback location</div>}

      {!coords && <div className="note">Acquiring location…</div>}

      {coords && (
        <HistoricalCharts start={start} end={end} coords={coords} />
      )}
    </div>
  )
}
