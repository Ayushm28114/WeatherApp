import React, { useState, useEffect } from 'react'
import HistoricalCharts from '../shared/HistoricalCharts'
import { startOfDay, subMonths, differenceInDays, parse } from 'date-fns'

export default function HistoricalAnalysis() {
  const today = startOfDay(new Date())
  const [start, setStart] = useState(startOfDay(subMonths(today, 1)))
  const [end, setEnd] = useState(today)
  const [coords, setCoords] = useState(null)
  const [error, setError] = useState(null)

  // Get geolocation on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported')
      setCoords({ lat: 51.5074, lon: -0.1278 })
      return
    }
    navigator.geolocation.getCurrentPosition(
      p => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      e => {
        const msg = e.message || 'Unable to get location'
        setError(msg)
        setCoords({ lat: 51.5074, lon: -0.1278 })
      },
      { timeout: 8000 }
    )
  }, [])

  // Validate date range (max 2 years)
  const handleStartChange = d => {
    const s = startOfDay(d)
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
      <style>{`
        .historical h2 {
          font-size: clamp(24px, 6vw, 36px);
          color: var(--muted);
          font-weight: 700;
          margin: 0 0 20px 0;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .historical .date-range-container {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .historical .date-range-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .historical .date-range-header h3 {
          margin: 0;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-weight: 600;
          color: var(--accent-2);
        }

        .historical .date-range-header .range-badge {
          background: rgba(14, 165, 255, 0.15);
          border: 1px solid rgba(14, 165, 255, 0.3);
          color: var(--accent);
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .historical .date-range-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-items: flex-start;
        }

        .historical .date-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
          z-index: auto;
        }

        .historical .date-input-group label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
          color: var(--muted-2);
          display: block;
        }

        .historical .date-input-group .date-label-value {
          font-size: 13px;
          color: var(--accent);
          font-weight: 700;
          min-height: 18px;
          display: block;
          margin-bottom: 4px;
        }

        .historical .date-picker-wrapper {
          position: relative;
          width: 100%;
          overflow: visible;
        }

        .historical .date-picker-wrapper::before {
          content: '📅';
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 16px;
          pointer-events: none;
          z-index: 2;
        }

        .historical .react-datepicker-wrapper input,
        .historical .datepicker-input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 10px 10px 10px 40px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          width: 100%;
          max-width: 100%;
          transition: all 0.28s ease;
          font-family: inherit;
          box-sizing: border-box;
        }

        .historical .react-datepicker-wrapper input:hover,
        .historical .datepicker-input:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .historical .react-datepicker-wrapper input:focus,
        .historical .datepicker-input:focus {
          outline: none;
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(14, 165, 255, 0.1);
        }

        .historical .date-info {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .historical .date-info-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--muted-2);
        }

        .historical .date-info-item strong {
          color: var(--accent);
          font-weight: 700;
        }

        .historical .range-duration {
          background: linear-gradient(90deg, rgba(14, 165, 255, 0.1), rgba(96, 218, 251, 0.05));
          border: 1px solid rgba(96, 218, 251, 0.15);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          color: var(--accent-2);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
        }

        .historical .range-duration::before {
          content: '⏱️';
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .historical .date-range-container {
            padding: 16px;
            gap: 12px;
          }

          .historical .date-range-inputs {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .historical .date-info {
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
          }

          .historical h2 {
            font-size: 24px;
            margin-bottom: 16px;
          }
        }

        @media (max-width: 480px) {
          .historical .date-range-container {
            padding: 12px;
            gap: 10px;
          }

          .historical .date-input-group label {
            font-size: 11px;
          }

          .historical .react-datepicker-wrapper input,
          .historical .datepicker-input {
            font-size: 12px;
            padding: 8px 8px 8px 36px;
          }

          .historical h2 {
            font-size: 20px;
          }

          .historical .date-range-header {
            flex-wrap: wrap;
          }

          .historical .range-badge {
            font-size: 10px;
            padding: 2px 6px;
          }
        }
      `}</style>

      <h2>📊 Historical Analysis</h2>
      
      <div className="date-range-container card">
        <div className="date-range-header">
          <h3>🗓️ Select Date Range</h3>
          <span className="range-badge">Max: 2 Years</span>
        </div>

        <div className="date-range-inputs">
          <div className="date-input-group">
            <label>Start Date</label>
            <span className="date-label-value">{start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            <div className="date-picker-wrapper">
              <input 
                type="text"
                className="datepicker-input"
                value={start.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                onChange={(e) => {
                  try {
                    const parsed = parse(e.target.value, 'dd/MM/yyyy', new Date())
                    const s = startOfDay(parsed)
                    const days = differenceInDays(end, s)
                    if (days > 730) {
                      setStart(startOfDay(subMonths(end, 24)))
                    } else if (!isNaN(parsed.getTime())) {
                      setStart(s)
                    }
                  } catch (err) {
                    // Invalid date, ignore
                  }
                }}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>

          <div className="date-input-group">
            <label>End Date</label>
            <span className="date-label-value">{end.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
            <div className="date-picker-wrapper">
              <input 
                type="text"
                className="datepicker-input"
                value={end.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                onChange={(e) => {
                  try {
                    const parsed = parse(e.target.value, 'dd/MM/yyyy', new Date())
                    const e_date = startOfDay(parsed)
                    const days = differenceInDays(e_date, start)
                    if (days > 730) {
                      setEnd(startOfDay(subMonths(e_date, -24)))
                    } else if (!isNaN(parsed.getTime())) {
                      setEnd(e_date)
                    }
                  } catch (err) {
                    // Invalid date, ignore
                  }
                }}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>
        </div>

        <div className="date-info">
          <div className="date-info-item">
            📍 <strong>{differenceInDays(end, start) + 1}</strong> days selected
          </div>
          <div className="range-duration">
            {Math.floor(differenceInDays(end, start) / 7)} weeks
          </div>
        </div>
      </div>

      {error && (
        <div className="note" style={{ marginBottom: '16px', background: 'rgba(255, 99, 132, 0.1)', border: '1px solid rgba(255, 99, 132, 0.2)', borderRadius: '12px', padding: '12px' }}>
          ⚠️ Location error: <strong>{error}</strong> — using fallback location
        </div>
      )}

      {!coords && (
        <div className="note" style={{ marginBottom: '16px', background: 'rgba(14, 165, 255, 0.1)', border: '1px solid rgba(14, 165, 255, 0.2)', borderRadius: '12px', padding: '12px' }}>
          ⏳ Acquiring location…
        </div>
      )}

      {coords && (
        <HistoricalCharts start={start} end={end} coords={coords} />
      )}
    </div>
  )
}
