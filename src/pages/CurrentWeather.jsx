import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format, startOfDay } from 'date-fns'
import WeatherCharts from '../shared/WeatherCharts'

const DEFAULT_PARAMS = {
  hourly: 'temperature_2m,relativehumidity_2m,precipitation,visibility,windspeed_10m,pm10,pm2_5',
  daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,apparent_temperature_max,sunrise,sunset,precipitation_sum,windspeed_10m_max,precipitation_probability_max',
  current_weather: true,
  timezone: 'auto'
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

  const requestLocation = () => {
    if (!('geolocation' in navigator)) return alert('Geolocation not available')
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords
      setCoords({ lat: latitude, lon: longitude })
    }, err => console.warn(err))
  }

  function applyManualCoords() {
    const lat = parseFloat(manualLat)
    const lon = parseFloat(manualLon)
    if (!isFinite(lat) || !isFinite(lon)) return setGeoError('Enter valid numeric coordinates')
    setCoords({ lat, lon })
    setGeoError(null)
  }

  useEffect(() => {
    if (!coords) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const isoDate = format(date, 'yyyy-MM-dd')
        // sanitize and format coords; keep request minimal to avoid 400 errors
        const lat = Number(coords.lat).toFixed(6)
        const lon = Number(coords.lon).toFixed(6)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&start_date=${encodeURIComponent(isoDate)}&end_date=${encodeURIComponent(isoDate)}&hourly=${encodeURIComponent(DEFAULT_PARAMS.hourly)}&daily=${encodeURIComponent(DEFAULT_PARAMS.daily)}&current_weather=true&timezone=${encodeURIComponent(DEFAULT_PARAMS.timezone)}`
        // use a forgiving timeout and single retry
        let resp
        try {
          resp = await axios.get(url, { timeout: 10000 })
        } catch (err) {
          // retry once
          resp = await axios.get(url, { timeout: 10000 })
        }
        setData(resp.data)
      } catch (e) {
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
             <div>
               <button onClick={() => setUnitC(u => !u)} className="btn small">{unitC ? '°C' : '°F'}</button>
             </div>
           </div>
         </div>

         {/* show geo error + manual coordinate inputs when geolocation fails */}
         {geoError && (
          <div className="center" style={{marginTop:12,flexDirection:'column'}}>
            <div className="note" style={{marginBottom:8}}>Location error: <span style={{color:'#ffb86b',fontWeight:700}}>{geoError}</span></div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input placeholder="Latitude" value={manualLat} onChange={e => setManualLat(e.target.value)} className="input" style={{width:120}} />
              <input placeholder="Longitude" value={manualLon} onChange={e => setManualLon(e.target.value)} className="input" style={{width:120}} />
              <button className="btn" onClick={applyManualCoords}>Use coords</button>
              <button className="btn" onClick={()=>{setGeoError(null); navigator.geolocation.getCurrentPosition(p=>{setCoords({lat:p.coords.latitude, lon:p.coords.longitude}); setGeoError(null)}, err=>setGeoError(err.message), {timeout:8000})}} style={{background:'transparent',border:'1px solid rgba(255,255,255,0.06)',color:'var(--muted)'}}>Retry</button>
            </div>
          </div>
         )}

         {loading && (
           <div className="loading-state center">
             <div className="skeleton temp-skel" />
           </div>
         )}

         {!data && !loading && !geoError && (
          <div className="empty-state center">
            <div className="empty-inner">
              <h2 className="city-name">Find your location</h2>
              <p className="note">Allow location access or click the button to search for your current weather.</p>
              <button className="btn" onClick={requestLocation} style={{marginTop:16}}>Search Location</button>
            </div>
          </div>
         )}

        {data && (
          <section className="bento-grid" aria-live="polite">
            <div className="card hero-card" style={{gridArea:'hero'}}>
              <div className="hero-top">
                <div>
                  <div className="small-pill">Today • {format(date, 'yyyy-MM-dd')}</div>
                  <div className="city-name">{data.timezone || 'Local'}</div>
                </div>
                <div className="align-right">
                  <div className="temp-large" aria-label="Current temperature">{displayTemp(current.temperature)}{unitC ? '°C' : '°F'}</div>
                  <div className="note">Feels like {displayTemp(data.hourly.apparent_temperature ? data.hourly.apparent_temperature[0] : current.temperature)}</div>
                </div>
              </div>
              <div className="hero-bottom">
                <div className="small-pill">UV {data.daily.uv_index_max ? data.daily.uv_index_max[0] : 'N/A'}</div>
                <div className="note">Sunrise: {data.daily.sunrise[0]} • Sunset: {data.daily.sunset[0]}</div>
              </div>
            </div>

            <div className="card square-tile" style={{gridArea:'side1'}}>
              <h4 className="note">Wind</h4>
              <div className="value-strong">{data.daily.windspeed_10m_max[0]} m/s</div>
            </div>

            <div className="card square-tile" style={{gridArea:'side2'}}>
              <h4 className="note">Humidity</h4>
              <div className="value-strong">{data.hourly.relativehumidity_2m[0]}%</div>
            </div>

            <div className="card square-tile" style={{gridArea:'side3'}}>
              <h4 className="note">Visibility</h4>
              <div className="value-strong">{data.hourly.visibility ? data.hourly.visibility[0] : 'N/A'} m</div>
            </div>

            <div className="card wide-card" style={{gridArea:'aq'}}>
              <h4 className="note">Air Quality</h4>
              <div>
                <span className={data.hourly.pm2_5 && data.hourly.pm2_5[0] > 75 ? 'aqi-poor' : data.hourly.pm2_5 && data.hourly.pm2_5[0] > 35 ? 'aqi-moderate' : 'aqi-good'}>
                  PM2.5: {data.hourly.pm2_5 ? data.hourly.pm2_5[0] : 'N/A'}
                </span>
                <span className="note" style={{marginLeft:12}}>PM10: {data.hourly.pm10 ? data.hourly.pm10[0] : 'N/A'}</span>
              </div>
            </div>

            <div className="card chart-area" style={{gridArea:'chart'}}>
              <WeatherCharts data={data} unitC={unitC} date={date} />
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
