import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { Line, Bar } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format } from 'date-fns'

Chart.register(...registerables)
Chart.register(zoomPlugin)

export default function HistoricalCharts({ start, end }) {
  const [coords, setCoords] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(p => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }))
  }, [])

  useEffect(() => {
    if (!coords || !start || !end) return
    const fetch = async () => {
      const s = format(start, 'yyyy-MM-dd')
      const e = format(end, 'yyyy-MM-dd')
      const url = `https://api.open-meteo.com/v1/era5?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${s}&end_date=${e}&daily=temperature_2m_mean,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,windspeed_10m_max&timezone=Asia/Kolkata`
      const r = await axios.get(url)
      setData(r.data)
    }
    fetch()
  }, [coords, start, end])

  if (!data) return <div>Waiting for data...</div>

  const labels = data.daily.time.map(t => format(new Date(t), 'yyyy-MM-dd'))

  const temp = useMemo(() => ({ labels, datasets: [ { label: 'Mean Temp', data: data.daily.temperature_2m_mean, borderColor: 'orange' }, { label: 'Max Temp', data: data.daily.temperature_2m_max, borderColor: 'red' }, { label: 'Min Temp', data: data.daily.temperature_2m_min, borderColor: 'blue' } ] }), [data])

  const options = useMemo(() => ({ plugins: { zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }, scales: { x: { display: true } } }), [])

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
