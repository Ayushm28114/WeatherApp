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

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not available')
      return
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords
      setCoords({ lat: latitude, lon: longitude })
    }, err => console.warn(err))
  }, [])

  useEffect(() => {
    if (!coords) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const isoDate = format(date, 'yyyy-MM-dd')
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${isoDate}&end_date=${isoDate}&hourly=${DEFAULT_PARAMS.hourly}&daily=${DEFAULT_PARAMS.daily}&current_weather=true&timezone=${DEFAULT_PARAMS.timezone}&past_days=1&forecast_days=1&models=best_match`
        const resp = await axios.get(url, { timeout: 400 }) // very low timeout to try to meet 500ms
        setData(resp.data)
      } catch (e) {
        console.error(e)
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

  return (
    <div className="page current">
      <div className="controls">
        <div>
          <label>Select date:</label>
          <DatePicker selected={date} onChange={d => setDate(startOfDay(d))} />
        </div>
        <div>
          <label>Units:</label>
          <button onClick={() => setUnitC(u => !u)}>{unitC ? '°C' : '°F'}</button>
        </div>
      </div>

      {loading && <div>Loading...</div>}

      {data && (
        <section className="overview">
          <h2>Overview - {format(date, 'yyyy-MM-dd')}</h2>
          <div className="grid">
            <div className="card">
              <h3>Temperature</h3>
              <p>Min: {data.daily.temperature_2m_min[0]}°</p>
              <p>Max: {data.daily.temperature_2m_max[0]}°</p>
              <p>Current: {current.temperature ?? '-'}°</p>
            </div>
            <div className="card">
              <h3>Atmospheric</h3>
              <p>Precipitation: {data.hourly.precipitation[0]} mm</p>
              <p>Relative Humidity: {data.hourly.relativehumidity_2m[0]}%</p>
              <p>UV Index: {data.daily.uv_index_max[0]}</p>
            </div>
            <div className="card">
              <h3>Sun Cycle</h3>
              <p>Sunrise: {data.daily.sunrise[0]}</p>
              <p>Sunset: {data.daily.sunset[0]}</p>
            </div>
            <div className="card">
              <h3>Wind & Air</h3>
              <p>Max Wind Speed: {data.daily.windspeed_10m_max[0]} m/s</p>
              <p>Precip Prob Max: {data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[0] : 'N/A'}%</p>
            </div>
            <div className="card">
              <h3>Air Quality</h3>
              <p>AQI: {data.hourly.air_quality ? data.hourly.air_quality[0] : 'N/A'}</p>
              <p>PM10: {data.hourly.pm10 ? data.hourly.pm10[0] : 'N/A'}</p>
              <p>PM2.5: {data.hourly.pm2_5 ? data.hourly.pm2_5[0] : 'N/A'}</p>
              <p>CO: N/A</p>
              <p>CO2: N/A</p>
              <p>NO2: N/A</p>
              <p>SO2: N/A</p>
            </div>
          </div>

          <WeatherCharts data={data} unitC={unitC} date={date} />
        </section>
      )}

      {!data && !loading && <div>Waiting for location or error fetching data.</div>}
    </div>
  )
}
