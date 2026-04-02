import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import axios from 'axios'
import { Line, Bar } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format, differenceInCalendarDays, addDays } from 'date-fns'

Chart.register(...registerables)
Chart.register(zoomPlugin)

// Chart configuration
const createChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'nearest', intersect: false },
  scales: {
    x: { 
      display: true, 
      grid: { display: false, drawBorder: false },
      ticks: { maxTicksLimit: 8, color: 'rgba(255, 255, 255, 0.4)', font: { size: 10 } } 
    },
    y: { 
      display: true, 
      grid: { display: true, color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
      ticks: { maxTicksLimit: 5, color: 'rgba(255, 255, 255, 0.4)', font: { size: 10 } } 
    }
  },
  plugins: {
    zoom: { 
      pan: { enabled: true, mode: 'x' }, 
      zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } 
    },
    legend: {
      display: true,
      labels: {
        usePointStyle: true,
        padding: 12,
        font: { size: 11 },
        color: 'rgba(255, 255, 255, 0.8)'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: 'rgba(14, 165, 255, 0.3)',
      borderWidth: 1,
      padding: 10,
      displayColors: true,
      cornerRadius: 8
    }
  }
})

// Chart color schemes
const CHART_COLORS = {
  temperature: { border: 'rgb(255, 99, 132)', bg: 'rgba(255, 99, 132, 0.1)' },
  humidity: { border: 'rgb(54, 162, 235)', bg: 'rgba(54, 162, 235, 0.1)' },
  precipitation: { border: 'rgb(75, 192, 192)', bg: 'rgba(75, 192, 192, 0.1)' },
  visibility: { border: 'rgb(153, 102, 255)', bg: 'rgba(153, 102, 255, 0.1)' },
  wind: { border: 'rgb(255, 159, 64)', bg: 'rgba(255, 159, 64, 0.1)' },
  pm10: { border: 'rgb(255, 193, 7)', bg: 'rgba(255, 193, 7, 0.1)' },
  pm25: { border: 'rgb(244, 67, 54)', bg: 'rgba(244, 67, 54, 0.1)' }
}

// Request cache for historical data
const historicalCache = new Map()

export default function HistoricalCharts({ start, end, coords: propsCoords }) {
  const [coords, setCoords] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tempUnitC, setTempUnitC] = useState(true)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    if (propsCoords) {
      setCoords(propsCoords)
      return
    }
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(p => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }))
  }, [propsCoords])

  const getCacheKey = useCallback((lat, lon, startDate, endDate) => {
    return `${lat}-${lon}-${startDate}-${endDate}`
  }, [])

  useEffect(() => {
    if (!coords || !start || !end) return
    const fetch = async () => {
      setLoading(true)
      setError(null)
      setData(null)
      try {
        const s = format(start, 'yyyy-MM-dd')
        const e = format(end, 'yyyy-MM-dd')
        const days = differenceInCalendarDays(end, start) + 1
        const lat = Number(coords.lat).toFixed(6)
        const lon = Number(coords.lon).toFixed(6)
        const cacheKey = getCacheKey(lat, lon, s, e)

        // Check cache first
        if (historicalCache.has(cacheKey)) {
          setData(historicalCache.get(cacheKey))
          setLoading(false)
          return
        }

        // Cancel previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        const buildEraUrl = (startDate, endDate) => `https://api.open-meteo.com/v1/era5?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,windspeed_10m_max&timezone=auto`
        const buildForecastUrl = (startDate, endDate) => `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,windspeed_10m_max&timezone=auto`

        const tryEra5Single = async () => {
          const url = buildEraUrl(s, e)
          const r = await axios.get(url, { timeout: 10000, signal: abortControllerRef.current?.signal })
          if (r.status !== 200) throw new Error(`HTTP ${r.status}`)
          if (!r.data?.daily?.time) throw new Error('Invalid response from ERA5 API')
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
          const parts = []
          for (const r of ranges) {
            const url = buildEraUrl(r.s, r.e)
            const res = await axios.get(url, { timeout: 10000, signal: abortControllerRef.current?.signal })
            if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
            if (!res.data?.daily?.time) throw new Error('Invalid response from ERA5 API chunk')
            parts.push(res.data.daily)
          }

          const keys = Object.keys(parts[0])
          const combined = { time: [] }
          for (const k of keys) combined[k] = []

          for (const p of parts) {
            for (const k of Object.keys(p)) {
              combined[k] = combined[k].concat(p[k])
            }
          }

          return { daily: combined }
        }

        try {
          const eraData = await tryEra5Single()
          historicalCache.set(cacheKey, eraData)
          setData(eraData)
          return
        } catch (innerErr) {
          const status = innerErr.response?.status
          if (axios.isCancel(innerErr)) return

          if (status === 404 && days > 31) {
            try {
              const chunked = await tryEra5Chunked()
              historicalCache.set(cacheKey, chunked)
              setData(chunked)
              return
            } catch (chunkErr) {
              if (axios.isCancel(chunkErr)) return
            }
          }

          if (status === 404 || days <= 31) {
            try {
              const fUrl = buildForecastUrl(s, e)
              const fr = await axios.get(fUrl, { timeout: 10000, signal: abortControllerRef.current?.signal })
              if (fr.status !== 200) throw new Error(`Forecast HTTP ${fr.status}`)
              if (!fr.data?.daily?.time) throw new Error('Invalid response from forecast API')

              const fd = fr.data
              if (!fd.daily.temperature_2m_mean && fd.daily.temperature_2m_max && fd.daily.temperature_2m_min) {
                fd.daily.temperature_2m_mean = fd.daily.temperature_2m_max.map((max, i) => {
                  const min = fd.daily.temperature_2m_min[i]
                  if (typeof max !== 'number' || typeof min !== 'number') return null
                  return (max + min) / 2
                })
              }

              historicalCache.set(cacheKey, fd)
              setData(fd)
              return
            } catch (fbErr) {
              if (axios.isCancel(fbErr)) return
              throw fbErr
            }
          }

          throw innerErr
        }
      } catch (err) {
        if (axios.isCancel(err)) return
        console.error('Historical fetch error', err)
        const status = err.response?.status
        setError(status ? `Request failed with status code ${status}` : (err.message || 'Failed to load historical data'))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [coords, start, end, getCacheKey])

  // ensure hooks are called in same order every render
  const labels = useMemo(() => {
    return (data && data.daily && data.daily.time) ? data.daily.time.map(t => format(new Date(t), 'yyyy-MM-dd')) : []
  }, [data])

  const temp = useMemo(() => ({
    labels,
    datasets: [
      { label: 'Mean Temp', data: data?.daily?.temperature_2m_mean || [], borderColor: 'orange', tension: 0.1, fill: false, pointRadius: 2 },
      { label: 'Max Temp', data: data?.daily?.temperature_2m_max || [], borderColor: 'red', tension: 0.1, fill: false, pointRadius: 2 },
      { label: 'Min Temp', data: data?.daily?.temperature_2m_min || [], borderColor: 'blue', tension: 0.1, fill: false, pointRadius: 2 }
    ]
  }), [data, labels])

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

  // Hourly labels and datasets (defensive, with enhanced colors and options)
  const hourlyLabels = useMemo(() => (data?.hourly?.time ?? []).map(t => format(new Date(t), 'HH:mm')), [data])

  const hourlyTempDataset = useMemo(() => ({ 
    labels: hourlyLabels, 
    datasets: [{ 
      label: 'Temperature (°C)', 
      data: (data?.hourly?.temperature_2m ?? []).map(v => tempUnitC ? v : (v * 9/5 + 32)), 
      borderColor: CHART_COLORS.temperature.border,
      backgroundColor: CHART_COLORS.temperature.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2
    }] 
  }), [data, hourlyLabels, tempUnitC])

  const hourlyHumidityDataset = useMemo(() => ({ 
    labels: hourlyLabels, 
    datasets: [{ 
      label: 'Humidity (%)', 
      data: data?.hourly?.relativehumidity_2m ?? [], 
      borderColor: CHART_COLORS.humidity.border,
      backgroundColor: CHART_COLORS.humidity.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2
    }] 
  }), [data, hourlyLabels])

  const hourlyPrecipDataset = useMemo(() => ({ 
    labels: hourlyLabels, 
    datasets: [{ 
      label: 'Precipitation (mm)', 
      data: data?.hourly?.precipitation ?? [], 
      borderColor: CHART_COLORS.precipitation.border,
      backgroundColor: CHART_COLORS.precipitation.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2
    }] 
  }), [data, hourlyLabels])

  const hourlyVisibilityDataset = useMemo(() => ({ 
    labels: hourlyLabels, 
    datasets: [{ 
      label: 'Visibility (m)', 
      data: data?.hourly?.visibility ?? [], 
      borderColor: CHART_COLORS.visibility.border,
      backgroundColor: CHART_COLORS.visibility.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2
    }] 
  }), [data, hourlyLabels])

  const hourlyWindDataset = useMemo(() => ({ 
    labels: hourlyLabels, 
    datasets: [{ 
      label: 'Wind Speed (m/s)', 
      data: data?.hourly?.windspeed_10m ?? [], 
      borderColor: CHART_COLORS.wind.border,
      backgroundColor: CHART_COLORS.wind.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      borderWidth: 2
    }] 
  }), [data, hourlyLabels])

  const hourlyPMDataset = useMemo(() => ({ 
    labels: hourlyLabels, 
    datasets: [
      { 
        label: 'PM10 (µg/m³)', 
        data: data?.hourly?.pm10 ?? [], 
        borderColor: CHART_COLORS.pm10.border,
        backgroundColor: CHART_COLORS.pm10.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 1.5,
        pointHoverRadius: 4,
        borderWidth: 2
      }, 
      { 
        label: 'PM2.5 (µg/m³)', 
        data: data?.hourly?.pm2_5 ?? [], 
        borderColor: CHART_COLORS.pm25.border,
        backgroundColor: CHART_COLORS.pm25.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 1.5,
        pointHoverRadius: 4,
        borderWidth: 2
      } 
    ] 
  }), [data, hourlyLabels])

  const chartOptions = createChartOptions()

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
          <div className="hourly-chart-container"><Line data={hourlyTempDataset} options={chartOptions} /></div>
        </div>

        <div>
          <h4>Hourly Humidity</h4>
          <div className="hourly-chart-container"><Line data={hourlyHumidityDataset} options={chartOptions} /></div>
        </div>

        <div>
          <h4>Hourly Precipitation</h4>
          <div className="hourly-chart-container"><Bar data={hourlyPrecipDataset} options={chartOptions} /></div>
        </div>

        <div>
          <h4>Hourly Visibility</h4>
          <div className="hourly-chart-container"><Line data={hourlyVisibilityDataset} options={chartOptions} /></div>
        </div>

        <div>
          <h4>Hourly Wind Speed</h4>
          <div className="hourly-chart-container"><Line data={hourlyWindDataset} options={chartOptions} /></div>
        </div>

        <div>
          <h4>PM10 & PM2.5</h4>
          <div className="hourly-chart-container"><Line data={hourlyPMDataset} options={chartOptions} /></div>
        </div>
      </div>
    </div>
  )
}

