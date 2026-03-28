import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format } from 'date-fns'

Chart.register(...registerables)
Chart.register(zoomPlugin)

export default function WeatherCharts({ data, unitC, date }) {
  if (!data) return null
  const hours = data.hourly.time.map(t => format(new Date(t), 'HH:mm'))

  const tempData = useMemo(() => ({
    labels: hours,
    datasets: [
      {
        label: 'Temperature',
        data: data.hourly.temperature_2m,
        borderColor: 'rgb(255,99,132)',
        tension: 0.2
      }
    ]
  }), [data])

  const options = useMemo(() => ({
    scales: {
      x: { display: true }
    },
    plugins: {
      zoom: {
        pan: { enabled: true, mode: 'x' },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
      }
    }
  }), [])

  return (
    <div className="charts">
      <h3>Hourly Charts</h3>
      <div className="chart-row">
        <div className="chart-card"><Line data={tempData} options={options} /></div>
        <div className="chart-card"><Line data={{ labels: hours, datasets: [{ label: 'Humidity', data: data.hourly.relativehumidity_2m, borderColor: 'blue' }] }} options={options} /></div>
      </div>
      <div className="chart-row">
        <div className="chart-card"><Line data={{ labels: hours, datasets: [{ label: 'Precipitation', data: data.hourly.precipitation, borderColor: 'navy' }] }} options={options} /></div>
        <div className="chart-card"><Line data={{ labels: hours, datasets: [{ label: 'Visibility', data: data.hourly.visibility, borderColor: 'gray' }] }} options={options} /></div>
      </div>
      <div className="chart-row">
        <div className="chart-card"><Line data={{ labels: hours, datasets: [{ label: 'Wind Speed', data: data.hourly.windspeed_10m, borderColor: 'teal' }] }} options={options} /></div>
        <div className="chart-card"><Line data={{ labels: hours, datasets: [{ label: 'PM10', data: data.hourly.pm10, borderColor: 'orange' }, { label: 'PM2.5', data: data.hourly.pm2_5, borderColor: 'red' }] }} options={options} /></div>
      </div>
    </div>
  )
}
