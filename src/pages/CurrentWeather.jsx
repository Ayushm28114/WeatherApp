import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import axios from 'axios'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format, startOfDay } from 'date-fns'
import WeatherCharts from '../shared/WeatherCharts'

const DEFAULT_PARAMS = {
  hourly: 'temperature_2m,relativehumidity_2m,precipitation,visibility,windspeed_10m,pm10,pm2_5,apparent_temperature',
  daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,apparent_temperature_max,sunrise,sunset,precipitation_sum,windspeed_10m_max,precipitation_probability_max',
  current_weather: true,
  timezone: 'auto'
}

// Sample location for demo/testing (San Francisco)
const SAMPLE_COORDS = { lat: 37.7749, lon: -122.4194 }

// Simple cache to prevent duplicate API requests
const requestCache = new Map()
const getCacheKey = (lat, lon, date) => `${lat}-${lon}-${date}`

// SVG Weather Icons with animations
const WeatherIcon = ({ type, className = '' }) => {
  const iconStyles = {
    display: 'inline-block',
    width: '32px',
    height: '32px',
    animation: 'float 3s ease-in-out infinite'
  }

  switch (type) {
    case 'thermometer':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyles} className={className}>
          <path d="M12 2v20M9 5a3 3 0 0 1 6 0v11a3 3 0 0 1-6 0V5Z" />
        </svg>
      )
    case 'droplet':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyles} className={className}>
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.32 0z" />
        </svg>
      )
    case 'wind':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyles} className={className}>
          <path d="M9.59 4.59A2 2 0 1 1 7 7m11.36-2a2 2 0 1 0 2.83 2.83M21 13a2 2 0 0 0-2-2H7a2 2 0 0 0 0 4h12a2 2 0 0 0 2-2" />
        </svg>
      )
    case 'eye':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={iconStyles} className={className}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'sun':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyles} className={className}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" />
          <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'leaf':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={iconStyles} className={className}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8" />
        </svg>
      )
    default:
      return null
  }
}

export default function CurrentWeather() {
  const [coords, setCoords] = useState(null)
  const [date, setDate] = useState(startOfDay(new Date()))
  const [data, setData] = useState(null)
  const [unitC, setUnitC] = useState(true)
  const [loading, setLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not available')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lon: longitude })
        setGeoError(null)
      },
      err => {
        console.warn('Geolocation error', err)
        setGeoError(err.message || 'Unable to get location')
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }, [])

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return alert('Geolocation not available')
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords
      setCoords({ lat: latitude, lon: longitude })
    }, err => console.warn(err))
  }, [])

  const applyManualCoords = useCallback(() => {
    const lat = parseFloat(manualLat)
    const lon = parseFloat(manualLon)
    if (!isFinite(lat) || !isFinite(lon)) return setGeoError('Enter valid numeric coordinates')
    setCoords({ lat, lon })
    setGeoError(null)
  }, [manualLat, manualLon])

  useEffect(() => {
    if (!coords) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const isoDate = format(date, 'yyyy-MM-dd')
        const lat = Number(coords.lat).toFixed(6)
        const lon = Number(coords.lon).toFixed(6)
        const cacheKey = getCacheKey(lat, lon, isoDate)

        // Check cache first
        if (requestCache.has(cacheKey)) {
          setData(requestCache.get(cacheKey))
          setLoading(false)
          return
        }

        // Cancel previous request if exists
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${encodeURIComponent(isoDate)}&end_date=${encodeURIComponent(isoDate)}&hourly=${encodeURIComponent(DEFAULT_PARAMS.hourly)}&daily=${encodeURIComponent(DEFAULT_PARAMS.daily)}&current_weather=true&timezone=${encodeURIComponent(DEFAULT_PARAMS.timezone)}`
        
        const resp = await axios.get(url, { 
          timeout: 5000,
          signal: abortControllerRef.current.signal
        })
        
        requestCache.set(cacheKey, resp.data)
        setData(resp.data)
      } catch (e) {
        if (axios.isCancel(e)) return // Request was cancelled
        console.error('Fetch error', e)
        setGeoError('Failed to fetch weather data — try again or enter coordinates manually')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [coords, date])

  const current = useMemo(() => {
    if (!data) return null
    return data.current_weather || {}
  }, [data])

  const toF = c => (c * 9) / 5 + 32
  const displayTemp = v => {
    if (v === undefined || v === null) return '-'
    return unitC ? Math.round(v) : Math.round(toF(v))
  }

  return (
    <div className="page current">
      <style>{`
        .current {
          padding: 8px 0;
        }
        
        .current .glass-shell {
          background: rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 16px;
          border-radius: 16px;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(14, 165, 255, 0.3); }
          50% { box-shadow: 0 0 30px rgba(14, 165, 255, 0.5); }
        }
        
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .current .controls {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .current .input-inline {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .current .input-inline label {
          font-size: 12px;
          color: var(--muted-2);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
        }
        
        .current .datepicker-wrap .react-datepicker__input {
          background: rgba(255, 255, 255, 0.04) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #fff !important;
          padding: 8px 10px !important;
          border-radius: 10px !important;
          font-size: 13px;
        }
        
        .current .datepicker-wrap .react-datepicker__input::placeholder {
          color: rgba(255, 255, 255, 0.35) !important;
        }
        
        .current .btn.small {
          padding: 8px 12px;
          font-size: 12px;
        }
        
        /* Geo error & manual inputs */
        .current .center {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .current .note {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px;
          border-radius: 12px;
          color: var(--muted-2);
          font-size: 13px;
        }
        
        .current .manual-inputs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 12px;
        }
        
        .current .manual-inputs input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 12px;
          width: 120px;
        }
        
        .current .manual-inputs input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
        
        .current .empty-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 300px;
          flex-direction: column;
        }
        
        .current .empty-inner {
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 32px 24px;
          border-radius: 16px;
          max-width: 400px;
        }
        
        .current .city-name {
          margin: 0;
          font-size: clamp(20px, 6vw, 32px);
          color: #fff;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .current .small-pill {
          display: inline-block;
          background: rgba(14, 165, 255, 0.1);
          border: 1px solid rgba(14, 165, 255, 0.3);
          color: var(--accent-2);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        
        .current .hero-card {
          background: linear-gradient(135deg, rgba(14, 165, 255, 0.08), rgba(96, 218, 251, 0.05));
          border: 1px solid rgba(96, 218, 251, 0.2);
          padding: 24px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 220px;
        }
        
        .current .hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        
        .current .hero-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
        }
        
        .current .temp-large {
          font-size: clamp(32px, 8vw, 48px);
          color: var(--accent);
          font-weight: 700;
          line-height: 1;
        }
        
        .current .value-strong {
          font-size: clamp(20px, 5vw, 28px);
          color: var(--accent);
          font-weight: 700;
          margin-top: 8px;
        }
        
        .current .align-right {
          text-align: right;
        }
        
        /* Bento grid for current weather */
        .current .bento-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-areas:
            "hero hero side1"
            "hero hero side2"
            "side3 aq aq"
            "chart chart chart";
          gap: 14px;
          margin-top: 16px;
        }
        
        .current .hero-card {
          grid-area: hero;
        }
        
        .current .square-tile {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 16px;
          border-radius: 14px;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
        }
        
        .current .square-tile-icon {
          color: var(--accent);
          font-size: 20px;
          opacity: 0.9;
        }
        
        .current .square-tile:nth-of-type(2) { grid-area: side1; }
        .current .square-tile:nth-of-type(3) { grid-area: side2; }
        .current .square-tile:nth-of-type(4) { grid-area: side3; }
        
        .current .square-tile:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          transform: translateY(-4px);
        }
        
        .current .square-tile h4 {
          margin: 0 0 8px 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
          color: var(--muted-2);
        }
        
        .current .wide-card {
          grid-area: aq;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        
        .current .wide-card h4 {
          margin: 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 600;
          color: var(--muted-2);
          min-width: 80px;
        }
        
        .current .wide-card > div {
          display: flex;
          gap: 12px;
          align-items: center;
          flex: 1;
        }
        
        .current .aqi-good {
          color: var(--success);
          font-weight: 700;
          font-size: 14px;
        }
        
        .current .aqi-moderate {
          color: #fbbf24;
          font-weight: 700;
          font-size: 14px;
        }
        
        .current .aqi-poor {
          color: #f87171;
          font-weight: 700;
          font-size: 14px;
        }
        
        .current .chart-area {
          grid-area: chart;
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 12px;
          border-radius: 14px;
        }
        
        /* Loading skeleton */
        .current .loading-state {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          flex-direction: column;
        }
        
        .current .temp-skel {
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        /* Responsive breakpoints */
        @media (max-width: 1024px) {
          .current .bento-grid {
            grid-template-columns: repeat(2, 1fr);
            grid-template-areas:
              "hero hero"
              "side1 side2"
              "side3 aq"
              "chart chart";
          }
          
          .current .hero-card {
            min-height: 180px;
          }
        }
        
        @media (max-width: 768px) {
          .current .glass-shell {
            padding: 12px;
            border-radius: 12px;
          }
          
          .current .controls {
            gap: 12px;
            margin-bottom: 12px;
            padding-bottom: 8px;
          }
          
          .current .bento-grid {
            grid-template-columns: 1fr;
            grid-template-areas:
              "hero"
              "side1"
              "side2"
              "side3"
              "aq"
              "chart";
            gap: 10px;
            margin-top: 12px;
          }
          
          .current .hero-card {
            min-height: 160px;
            padding: 16px;
          }
          
          .current .hero-top {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .current .align-right {
            text-align: left;
          }
          
          .current .hero-bottom {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .current .temp-large {
            font-size: 32px;
          }
          
          .current .value-strong {
            font-size: 20px;
          }
          
          .current .square-tile {
            padding: 12px;
            border-radius: 12px;
          }
          
          .current .wide-card {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .current .wide-card > div {
            flex-direction: column;
            width: 100%;
          }
          
          .current .empty-inner {
            padding: 24px 16px;
            border-radius: 12px;
          }
        }
        
        @media (max-width: 480px) {
          .current .controls {
            flex-direction: column;
            gap: 8px;
          }
          
          .current .input-inline {
            width: 100%;
          }
          
          .current .city-name {
            font-size: 20px;
          }
          
          .current .temp-large {
            font-size: 28px;
          }
          
          .current .value-strong {
            font-size: 18px;
          }
          
          .current .manual-inputs {
            flex-direction: column;
            width: 100%;
          }
          
          .current .manual-inputs input {
            width: 100%;
          }
          
          .current .hero-top {
            gap: 8px;
          }
          
          .current .hero-bottom {
            gap: 8px;
            font-size: 12px;
          }
          
          .current .empty-inner {
            padding: 20px 12px;
          }
        }
      `}</style>

      <div className="glass-shell card">
        <div className="controls">
          <div className="input-inline">
            <label>Select date:</label>
            <div className="datepicker-wrap">
              <DatePicker selected={date} onChange={d => setDate(startOfDay(d))} className="input" />
            </div>
          </div>
          <div className="input-inline">
            <label>Units:</label>
            <button onClick={() => setUnitC(u => !u)} className="btn small">{unitC ? '°F' : '°C'}</button>
          </div>
          {!coords && !geoError && (
            <div className="input-inline">
              <label>&nbsp;</label>
              <button 
                onClick={() => setCoords(SAMPLE_COORDS)} 
                className="btn small" 
                style={{ background: 'linear-gradient(90deg, rgba(14, 165, 255, 0.6), rgba(96, 218, 251, 0.5))', border: '1px solid rgba(96, 218, 251, 0.3)' }}
              >
                📍 Demo Location
              </button>
            </div>
          )}
        </div>

        {/* show geo error + manual coordinate inputs when geolocation fails */}
        {geoError && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="note">Location error: <span style={{ color: '#ffb86b', fontWeight: 700 }}>{geoError}</span></div>
            <div className="manual-inputs">
              <input placeholder="Latitude" value={manualLat} onChange={e => setManualLat(e.target.value)} />
              <input placeholder="Longitude" value={manualLon} onChange={e => setManualLon(e.target.value)} />
              <button className="btn" onClick={applyManualCoords} style={{ flex: '0 0 auto' }}>Use Coords</button>
              <button className="btn" onClick={() => { setGeoError(null); navigator.geolocation.getCurrentPosition(p => { setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }); setGeoError(null) }, err => setGeoError(err.message), { timeout: 8000 }) }} style={{ flex: '0 0 auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--muted)' }}>Retry</button>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="temp-skel" style={{ width: '100%', maxWidth: 300 }} />
          </div>
        )}

        {!data && !loading && !geoError && (
          <div className="empty-state">
            <div className="empty-inner">
              <h2 className="city-name">Find Your Location</h2>
              <p className="note" style={{ marginTop: 12, marginBottom: 0 }}>Allow location access or enter coordinates manually.</p>
              <button className="btn" onClick={requestLocation} style={{ marginTop: 16 }}>🌍 Use My Location</button>
            </div>
          </div>
        )}

        {data && (
          <section className="bento-grid" aria-live="polite">
            <div className="card hero-card">
              <div className="hero-top">
                <div>
                  <div className="small-pill">Today • {format(date, 'yyyy-MM-dd')}</div>
                  <div className="city-name" style={{ marginTop: 8 }}>{data.timezone || 'Local'}</div>
                </div>
                <div className="align-right">
                  <div className="temp-large" aria-label="Current temperature">{displayTemp(current?.temperature)}{unitC ? '°C' : '°F'}</div>
                  <div className="note" style={{ marginTop: 4, fontSize: '12px' }}>Feels like {displayTemp(data.hourly?.apparent_temperature?.[0] ?? current?.temperature)}</div>
                </div>
              </div>
              <div className="hero-bottom">
                <div className="small-pill">UV {data.daily?.uv_index_max?.[0] ?? 'N/A'}</div>
                <div className="note" style={{ fontSize: '12px' }}>🌅 {data.daily?.sunrise?.[0] || 'N/A'} • 🌇 {data.daily?.sunset?.[0] || 'N/A'}</div>
              </div>
            </div>

            <div className="card square-tile">
              <div className="square-tile-icon"><WeatherIcon type="wind" /></div>
              <h4>Wind Speed</h4>
              <div className="value-strong">{data.daily?.windspeed_10m_max?.[0] ?? 'N/A'} m/s</div>
            </div>

            <div className="card square-tile">
              <div className="square-tile-icon"><WeatherIcon type="droplet" /></div>
              <h4>Humidity</h4>
              <div className="value-strong">{data.hourly?.relativehumidity_2m?.[0] ?? 'N/A'}%</div>
            </div>

            <div className="card square-tile">
              <div className="square-tile-icon"><WeatherIcon type="eye" /></div>
              <h4>Visibility</h4>
              <div className="value-strong">{data.hourly?.visibility?.[0] ? (data.hourly.visibility[0] / 1000).toFixed(1) : 'N/A'} km</div>
            </div>

            <div className="card wide-card">
              <h4>Air Quality</h4>
              <div>
                {(() => {
                  const pm25 = data.hourly?.pm2_5?.[0]
                  const aqi = typeof pm25 === 'number' ? (pm25 > 75 ? 'aqi-poor' : pm25 > 35 ? 'aqi-moderate' : 'aqi-good') : 'aqi-good'
                  return (
                    <span className={aqi}>
                      PM2.5: {typeof pm25 === 'number' ? pm25.toFixed(1) : 'N/A'} µg/m³
                    </span>
                  )
                })()}
                <span className="note" style={{ marginLeft: 0 }}>PM10: {typeof data.hourly?.pm10?.[0] === 'number' ? data.hourly.pm10[0].toFixed(1) : 'N/A'} µg/m³</span>
              </div>
            </div>

            <div className="card chart-area">
              <WeatherCharts data={data} unitC={unitC} date={date} />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
