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

  const options = useMemo(() => ({ plugins: { zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }, scales: { x: { display: true } } }), [])

  if (loading) return <div className="note">Loading historical data…</div>
  if (error) return <div className="note">Error: {error}</div>
  if (!data) return <div className="note">Waiting for data...</div>

  return (
    <div className="historical-charts">
      <h3>Temperature</h3>
      <Line data={temp} options={options} />

      <h3>Sunrise / Sunset (IST)</h3>
      <Bar data={{ labels, datasets: [ { label: 'Sunrise', data: data.daily.sunrise.map(s => new Date(s).getHours() + new Date(s).getMinutes()/60), backgroundColor: 'yellow' }, { label: 'Sunset', data: data.daily.sunset.map(s => new Date(s).getHours() + new Date(s).getMinutes()/60), backgroundColor: 'orange' } ] }} options={options} />

      <h3>Precipitation Total</h3>
      <Bar data={{ labels, datasets: [{ label: 'Precipitation', data: data.daily.precipitation_sum, backgroundColor: 'navy' }] }} options={options} />

      <h3>Wind</h3>
      <Line data={{ labels, datasets: [{ label: 'Max Wind', data: data.daily.windspeed_10m_max, borderColor: 'teal' }] }} options={options} />

      <h3>Air Quality (PM10 / PM2.5)</h3>
      <Line data={{ labels, datasets: [{ label: 'PM10', data: data.daily.pm10 || [], borderColor: 'orange' }, { label: 'PM2.5', data: data.daily.pm2_5 || [], borderColor: 'red' }] }} options={options} />
    </div>
  )
}
