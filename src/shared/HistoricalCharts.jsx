import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { Line, Bar } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format, differenceInCalendarDays, addDays } from 'date-fns'

Chart.register(...registerables)
Chart.register(zoomPlugin)

export default function HistoricalCharts({ start, end, coords: propsCoords }) {
  const [coords, setCoords] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tempUnitC, setTempUnitC] = useState(true) // true = Celsius, false = Fahrenheit

  useEffect(() => {
    if (propsCoords) {
      setCoords(propsCoords)
      return
    }
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(p => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }))
  }, [propsCoords])

  useEffect(() => {
    if (!coords || !start || !end) return
    const fetch = async () => {
      setLoading(true)
      setError(null)
      setData(null)
      try {
        const s = format(start, 'yyyy-MM-dd')
        const e = format(end, 'yyyy-MM-dd')
        // compute inclusive day count
        const days = differenceInCalendarDays(end, start) + 1
        // sanitize coords
        const lat = Number(coords.lat).toFixed(6)
        const lon = Number(coords.lon).toFixed(6)

        const buildEraUrl = (startDate, endDate) => `https://api.open-meteo.com/v1/era5?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,windspeed_10m_max&timezone=auto`
        const buildForecastUrl = (startDate, endDate) => `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,windspeed_10m_max&timezone=auto`

        // Try ERA5; if the range is >31 days and ERA5 returns 404, attempt chunked ERA5 requests of <=31 days
        const tryEra5Single = async () => {
          const url = buildEraUrl(s, e)
          const r = await axios.get(url, { timeout: 15000 })
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          if (!r.data || !r.data.daily || !r.data.daily.time) throw new Error('Invalid response from ERA5 API')
          return r.data
        }

        const tryEra5Chunked = async () => {
          const maxChunk = 31
          const ranges = []
          let cursor = new Date(start)
          while (cursor <= end) {
            const chunkEnd = addDays(cursor, maxChunk - 1)
            const actualEnd = chunkEnd > end ? end : chunkEnd
            ranges.push({ s: format(cursor, 'yyyy-MM-dd'), e: format(actualEnd, 'yyyy-MM-dd') })
            cursor = addDays(actualEnd, 1)
          }
          // fetch all chunks sequentially to be kind to the API (can be parallel if desired)
          const parts = []
          for (const r of ranges) {
            const url = buildEraUrl(r.s, r.e)
            const res = await axios.get(url, { timeout: 15000 })
            if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
            if (!res.data || !res.data.daily || !res.data.daily.time) throw new Error('Invalid response from ERA5 API chunk')
            parts.push(res.data.daily)
          }

          // combine parts into one daily object
          const keys = Object.keys(parts[0])
          const combined = { time: [], }
          for (const k of keys) combined[k] = []

          for (const p of parts) {
            for (const k of Object.keys(p)) {
              combined[k] = combined[k].concat(p[k])
            }
          }

          // Build a full response-like object
          return { daily: combined }
        }

        try {
          // prefer single call
          const eraData = await tryEra5Single()
          setData(eraData)
          return
        } catch (innerErr) {
          const status = innerErr.response?.status
          console.warn('ERA5 single call failed', innerErr.message || innerErr)

          // If 404 and range >31 days, attempt chunked ERA5
          if (status === 404 && days > 31) {
            try {
              const chunked = await tryEra5Chunked()
              setData(chunked)
              return
            } catch (chunkErr) {
              console.warn('ERA5 chunked fetch failed', chunkErr)
              // fall through to forecast fallback
            }
          }

          // If small range (<=31) or chunking failed, and status was 404 or data missing, try forecast fallback
          if (status === 404 || days <= 31) {
            try {
              const fUrl = buildForecastUrl(s, e)
              const fr = await axios.get(fUrl, { timeout: 15000 })
              if (fr.status !== 200) throw new Error(`Forecast HTTP ${fr.status}`)
              if (!fr.data || !fr.data.daily || !fr.data.daily.time) throw new Error('Invalid response from forecast API')

              const fd = fr.data
              if (!fd.daily.temperature_2m_mean && fd.daily.temperature_2m_max && fd.daily.temperature_2m_min) {
                fd.daily.temperature_2m_mean = fd.daily.temperature_2m_max.map((max, i) => {
                  const min = fd.daily.temperature_2m_min[i]
                  // handle null/undefined values defensively
                  if (typeof max !== 'number' || typeof min !== 'number') return null
                  return (max + min) / 2
                })
              }

              setData(fd)
              return
            } catch (fbErr) {
              console.warn('Forecast fallback failed', fbErr)
              throw fbErr
            }
          }

          // otherwise rethrow
          throw innerErr
        }
      } catch (err) {
        console.error('Historical fetch error', err)
        const status = err.response?.status
        setError(status ? `Request failed with status code ${status}` : (err.message || 'Failed to load historical data'))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [coords, start, end])

  // ensure hooks are called in same order every render
  const labels = useMemo(() => {
    return (data && data.daily && data.daily.time) ? data.daily.time.map(t => format(new Date(t), 'yyyy-MM-dd')) : []
  }, [data])

  const temp = useMemo(() => ({
    labels,
    datasets: [
      { label: 'Mean Temp', data: data?.daily?.temperature_2m_mean || [], borderColor: 'orange' },
      { label: 'Max Temp', data: data?.daily?.temperature_2m_max || [], borderColor: 'red' },
      { label: 'Min Temp', data: data?.daily?.temperature_2m_min || [], borderColor: 'blue' }
    ]
  }), [data, labels])

  const options = useMemo(() => ({ plugins: { zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }, scales: { x: { display: true } }, maintainAspectRatio: false }), [])

  // index for the 'current' / last day in the returned daily arrays
  const todayIndex = useMemo(() => {
    if (!data || !data.daily || !data.daily.time) return -1
    return Math.max(0, data.daily.time.length - 1)
  }, [data])

  // compute visibility mean for the selected/current day from hourly data (if available)
  const visibilityToday = useMemo(() => {
    try {
      const day = data?.daily?.time?.[todayIndex]
      if (!day || !data?.hourly?.time || !data.hourly.visibility) return null
      const times = data.hourly.time
      const vis = data.hourly.visibility
      let sum = 0, count = 0
      for (let i = 0; i < times.length; i++) {
        if (String(times[i]).startsWith(day)) {
          const v = vis[i]
          if (typeof v === 'number') { sum += v; count++ }
        }
      }
      return count ? Math.round(sum / count) : null
    } catch (e) { return null }
  }, [data, todayIndex])

  const todayValues = useMemo(() => {
    if (!data || !data.daily) return {}
    const i = todayIndex
    const d = data.daily
    const pick = (arr) => (Array.isArray(arr) && i >= 0 && i < arr.length ? arr[i] : null)

    return {
      temp_min: pick(d.temperature_2m_min),
      temp_max: pick(d.temperature_2m_max),
      temp_mean: pick(d.temperature_2m_mean),
      precipitation: pick(d.precipitation_sum),
      wind_max: pick(d.windspeed_10m_max),
      visibility: null, // placeholder — computed separately from hourly data
      sunrise: pick(d.sunrise),
      sunset: pick(d.sunset),
      // optional fields (may not exist)
      relative_humidity: pick(d.relativehumidity_2m_mean) || null,
      uv_index: pick(d.uv_index_max) || null,
      precip_prob_max: pick(d.precipitation_probability_max) || null,
      // air quality
      aqi: pick(d.aqi) || null,
      pm10: pick(d.pm10) || null,
      pm2_5: pick(d.pm2_5) || null,
      co: pick(d.co) || null,
      co2: pick(d.co2) || null,
      no2: pick(d.no2) || null,
      so2: pick(d.so2) || null
    }
  }, [data, todayIndex])

  const fmtTime = (iso) => {
    if (!iso) return 'N/A'
    try {
      const dt = new Date(iso)
      return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) { return 'N/A' }
  }

  const toUnit = (v) => {
    if (v === null || v === undefined) return 'N/A'
    if (typeof v !== 'number') return v
    if (tempUnitC) return `${Math.round(v)}°C`
    return `${Math.round(v * 9/5 + 32)}°F`
  }

  // Hourly labels and datasets (defensive)
  const hourlyLabels = useMemo(() => (data?.hourly?.time ?? []).map(t => format(new Date(t), 'yyyy-MM-dd HH:mm')), [data])

  const hourlyTempDataset = useMemo(() => ({ labels: hourlyLabels, datasets: [ { label: 'Temp (hourly)', data: (data?.hourly?.temperature_2m ?? []).map(v => tempUnitC ? v : (v * 9/5 + 32)), borderColor: 'orange', fill: false } ] }), [data, hourlyLabels, tempUnitC])

  const hourlyHumidityDataset = useMemo(() => ({ labels: hourlyLabels, datasets: [ { label: 'Relative Humidity', data: data?.hourly?.relativehumidity_2m ?? [], borderColor: 'blue', fill: false } ] }), [data, hourlyLabels])

  const hourlyPrecipDataset = useMemo(() => ({ labels: hourlyLabels, datasets: [ { label: 'Precipitation', data: data?.hourly?.precipitation ?? [], borderColor: 'navy', fill: false } ] }), [data, hourlyLabels])

  const hourlyVisibilityDataset = useMemo(() => ({ labels: hourlyLabels, datasets: [ { label: 'Visibility', data: data?.hourly?.visibility ?? [], borderColor: 'purple', fill: false } ] }), [data, hourlyLabels])

  const hourlyWindDataset = useMemo(() => ({ labels: hourlyLabels, datasets: [ { label: 'Wind Speed (10m)', data: data?.hourly?.windspeed_10m ?? [], borderColor: 'teal', fill: false } ] }), [data, hourlyLabels])

  const hourlyPMDataset = useMemo(() => ({ labels: hourlyLabels, datasets: [ { label: 'PM10', data: data?.hourly?.pm10 ?? [], borderColor: 'orange', fill: false }, { label: 'PM2.5', data: data?.hourly?.pm2_5 ?? [], borderColor: 'red', fill: false } ] }), [data, hourlyLabels])

  if (loading) return <div className="note">Loading historical data…</div>
  if (error) return <div className="note">Error: {error}</div>
  if (!data) return <div className="note">Waiting for data...</div>

  return (
    <div className="historical-charts">
      {/* Enhanced responsive styles for weather app UI */}
      <style>{`
        .historical-charts {
          padding: 8px 0;
        }
        .historical-charts h3 {
          margin: 20px 0 12px 0;
          font-size: clamp(18px, 5vw, 24px);
          color: var(--muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .historical-charts h4 {
          margin: 0 0 8px 0;
          font-size: clamp(14px, 4vw, 16px);
          color: var(--accent);
          font-weight: 600;
        }
        
        /* Bento grid for individual weather variables */
        .bento-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .bento-grid .card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          min-height: 80px;
          transition: all 0.3s ease;
          cursor: default;
        }
        
        .bento-grid .card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(2, 6, 23, 0.4);
        }
        
        .bento-grid .card strong {
          font-size: clamp(11px, 2.5vw, 12px);
          color: var(--muted-2);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 6px;
          font-weight: 600;
        }
        
        .bento-grid .card div {
          font-size: clamp(16px, 4vw, 20px);
          color: var(--accent);
          font-weight: 700;
        }
        
        /* Visibility summary card */
        .visibility-summary {
          margin-top: 12px;
          margin-bottom: 12px;
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .visibility-summary .card {
          background: linear-gradient(135deg, rgba(96, 218, 251, 0.08), rgba(14, 165, 255, 0.05));
          border: 1px solid rgba(96, 218, 251, 0.2);
          flex: 1;
          min-width: 200px;
          padding: 12px 14px;
        }
        
        .visibility-summary .card strong {
          color: var(--accent-2);
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        
        .visibility-summary .card div {
          font-size: 18px;
          color: var(--accent);
          font-weight: 700;
        }
        
        /* Temperature toggle button */
        .temp-toggle {
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          color: #071226;
          border: 0;
          padding: 8px 12px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.25s ease;
          white-space: nowrap;
        }
        
        .temp-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(14, 165, 255, 0.3);
        }
        
        .temp-toggle:active {
          transform: translateY(0);
        }
        
        /* Hourly charts grid */
        .hourly-charts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 12px;
        }
        
        .hourly-charts > div {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 12px;
          transition: all 0.3s ease;
        }
        
        .hourly-charts > div:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.12);
        }
        
        .hourly-chart-container {
          height: 220px;
          border-radius: 8px;
          overflow: hidden;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 1024px) {
          .bento-grid {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          }
          
          .hourly-charts {
            grid-template-columns: 1fr;
          }
          
          .hourly-chart-container {
            height: 200px;
          }
        }
        
        @media (max-width: 768px) {
          .historical-charts {
            padding: 4px 0;
          }
          
          .historical-charts h3 {
            margin: 16px 0 10px 0;
            font-size: 18px;
          }
          
          .historical-charts h4 {
            font-size: 14px;
          }
          
          .bento-grid {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
            margin-bottom: 12px;
          }
          
          .bento-grid .card {
            padding: 10px 8px;
            min-height: 70px;
          }
          
          .bento-grid .card strong {
            font-size: 10px;
            margin-bottom: 4px;
          }
          
          .bento-grid .card div {
            font-size: 16px;
          }
          
          .visibility-summary {
            margin: 10px 0;
          }
          
          .visibility-summary .card {
            min-width: 100%;
          }
          
          .hourly-charts {
            grid-template-columns: 1fr;
            gap: 12px;
            margin-top: 8px;
          }
          
          .hourly-charts > div {
            padding: 10px;
            border-radius: 12px;
          }
          
          .hourly-chart-container {
            height: 180px;
          }
        }
        
        @media (max-width: 480px) {
          .historical-charts h3 {
            font-size: 16px;
          }
          
          .bento-grid {
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 6px;
          }
          
          .bento-grid .card {
            padding: 8px 6px;
            min-height: 60px;
            border-radius: 12px;
          }
          
          .bento-grid .card strong {
            font-size: 9px;
            margin-bottom: 3px;
          }
          
          .bento-grid .card div {
            font-size: 14px;
          }
          
          .hourly-charts > div {
            padding: 8px;
            border-radius: 10px;
          }
          
          .hourly-chart-container {
            height: 150px;
          }
          
          .temp-toggle {
            padding: 6px 10px;
            font-size: 11px;
          }
        }
        
        /* Utility: note for empty states */
        .note {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 16px;
          border-radius: 14px;
          color: var(--muted-2);
          text-align: center;
          font-size: 14px;
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
        <h3 style={{ margin: 0 }}>Individual Weather Variables (Current Day)</h3>
        <button className="temp-toggle" onClick={() => setTempUnitC(u => !u)}>
          {tempUnitC ? '°F' : '°C'}
        </button>
      </div>

      <div className="bento-grid">
        <div className="card"> <strong>Temp (Min)</strong><div>{toUnit(todayValues.temp_min)}</div></div>
        <div className="card"> <strong>Temp (Max)</strong><div>{toUnit(todayValues.temp_max)}</div></div>
        <div className="card"> <strong>Temp (Now)</strong><div>{toUnit(todayValues.temp_mean)}</div></div>

        <div className="card"> <strong>Precipitation</strong><div>{todayValues.precipitation ?? 'N/A'} mm</div></div>
        <div className="card"> <strong>Humidity</strong><div>{todayValues.relative_humidity ?? 'N/A'}%</div></div>
        <div className="card"> <strong>UV Index</strong><div>{todayValues.uv_index ?? 'N/A'}</div></div>

        <div className="card"> <strong>Sunrise</strong><div>{fmtTime(todayValues.sunrise)}</div></div>
        <div className="card"> <strong>Sunset</strong><div>{fmtTime(todayValues.sunset)}</div></div>

        <div className="card"> <strong>Wind Speed</strong><div>{todayValues.wind_max ?? 'N/A'} m/s</div></div>
        <div className="card"> <strong>Precip Prob</strong><div>{todayValues.precip_prob_max ?? 'N/A'}%</div></div>

        <div className="card"> <strong>AQI</strong><div>{todayValues.aqi ?? 'N/A'}</div></div>
        <div className="card"> <strong>PM10</strong><div>{todayValues.pm10 ?? 'N/A'}</div></div>
        <div className="card"> <strong>PM2.5</strong><div>{todayValues.pm2_5 ?? 'N/A'}</div></div>
        <div className="card"> <strong>CO</strong><div>{todayValues.co ?? 'N/A'}</div></div>
        <div className="card"> <strong>CO₂</strong><div>{todayValues.co2 ?? 'N/A'}</div></div>
        <div className="card"> <strong>NO₂</strong><div>{todayValues.no2 ?? 'N/A'}</div></div>
        <div className="card"> <strong>SO₂</strong><div>{todayValues.so2 ?? 'N/A'}</div></div>
      </div>

      {/* Visibility summary placed above the hourly charts for prominence */}
      <div className="visibility-summary">
        <div className="card">
          <strong>Visibility (avg today)</strong>
          <div>{visibilityToday ?? 'N/A'} km</div>
        </div>
      </div>

      <hr style={{ margin: '16px 0', border: '0', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
      <h3>2. Hourly Data Visualizations</h3>
      <div style={{ marginBottom: 8, color: 'var(--muted-2)', fontSize: '12px' }}>Hourly breakdown for the selected date range (if data available)</div>

      <div className="hourly-charts">
        <div>
          <h4>Hourly Temperature</h4>
          <div className="hourly-chart-container"><Line data={hourlyTempDataset} options={options} /></div>
        </div>

        <div>
          <h4>Hourly Humidity</h4>
          <div className="hourly-chart-container"><Line data={hourlyHumidityDataset} options={options} /></div>
        </div>

        <div>
          <h4>Hourly Precipitation</h4>
          <div className="hourly-chart-container"><Bar data={hourlyPrecipDataset} options={options} /></div>
        </div>

        <div>
          <h4>Hourly Visibility</h4>
          <div className="hourly-chart-container"><Line data={hourlyVisibilityDataset} options={options} /></div>
        </div>

        <div>
          <h4>Hourly Wind Speed</h4>
          <div className="hourly-chart-container"><Line data={hourlyWindDataset} options={options} /></div>
        </div>

        <div>
          <h4>PM10 & PM2.5</h4>
          <div className="hourly-chart-container"><Line data={hourlyPMDataset} options={options} /></div>
        </div>
      </div>
    </div>
  )
}
