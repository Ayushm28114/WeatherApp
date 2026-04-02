import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart, registerables } from 'chart.js'
import zoomPlugin from 'chartjs-plugin-zoom'
import { format } from 'date-fns'

Chart.register(...registerables)
Chart.register(zoomPlugin)

// Chart configuration
const createChartOptions = (accentColor = 'rgb(14, 165, 255)') => ({
  responsive: true,
  maintainAspectRatio: false,    animation: false,
  interaction: { mode: 'nearest', intersect: false },
  scales: {
    x: { 
      display: true,
      grid: { 
        display: false,
        drawBorder: false
      },
      ticks: { 
        maxTicksLimit: 6,
        color: 'rgba(255, 255, 255, 0.4)',
        font: { size: 11 }
      } 
    },
    y: {
      display: true,
      grid: { 
        display: true,
        color: 'rgba(255, 255, 255, 0.05)', // Very subtle grid
        drawBorder: false
      },
      ticks: { 
        maxTicksLimit: 5,
        color: 'rgba(255, 255, 255, 0.4)',
        font: { size: 11 }
      }
    }
  },
  plugins: {
    filler: { propagate: true },
    zoom: {
      pan: { enabled: true, mode: 'x' },
      zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
    },
    legend: {
      display: true,
      labels: {
        usePointStyle: true,
        padding: 12,
        font: { size: 12 },
        color: 'rgba(255, 255, 255, 0.8)'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: accentColor,
      borderWidth: 1,
      padding: 10,
      displayColors: true,
      cornerRadius: 8
    }
  }
})

// Chart color schemes with gradient support
const CHART_COLORS = {
  temperature: { border: 'rgb(255, 99, 132)', bg: 'rgba(255, 99, 132, 0.1)', accent: 'rgb(255, 99, 132)' },
  humidity: { border: 'rgb(54, 162, 235)', bg: 'rgba(54, 162, 235, 0.1)', accent: 'rgb(54, 162, 235)' },
  precipitation: { border: 'rgb(75, 192, 192)', bg: 'rgba(75, 192, 192, 0.1)', accent: 'rgb(75, 192, 192)' },
  visibility: { border: 'rgb(153, 102, 255)', bg: 'rgba(153, 102, 255, 0.1)', accent: 'rgb(153, 102, 255)' },
  wind: { border: 'rgb(255, 159, 64)', bg: 'rgba(255, 159, 64, 0.1)', accent: 'rgb(255, 159, 64)' },
  pm10: { border: 'rgb(255, 193, 7)', bg: 'rgba(255, 193, 7, 0.1)', accent: 'rgb(255, 193, 7)' },
  pm25: { border: 'rgb(244, 67, 54)', bg: 'rgba(244, 67, 54, 0.1)', accent: 'rgb(244, 67, 54)' }
}

const WeatherCharts = React.memo(function WeatherCharts({ data, unitC, date }) {
  if (!data?.hourly?.time) return null
  
  const hours = useMemo(() => 
    data.hourly.time.map(t => format(new Date(t), 'HH:mm')),
    [data.hourly.time]
  )

  const tempData = useMemo(() => ({
    labels: hours,
    datasets: [
      {
        label: 'Temperature',
        data: data.hourly?.temperature_2m || [],
        borderColor: CHART_COLORS.temperature.border,
        backgroundColor: CHART_COLORS.temperature.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: CHART_COLORS.temperature.accent,
        borderWidth: 2
      }
    ]
  }), [data, hours])

  const humidityData = useMemo(() => ({
    labels: hours,
    datasets: [{
      label: 'Humidity (%)',
      data: data.hourly?.relativehumidity_2m || [],
      borderColor: CHART_COLORS.humidity.border,
      backgroundColor: CHART_COLORS.humidity.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: CHART_COLORS.humidity.accent,
      borderWidth: 2
    }]
  }), [data, hours])

  const precipData = useMemo(() => ({
    labels: hours,
    datasets: [{
      label: 'Precipitation (mm)',
      data: data.hourly?.precipitation || [],
      borderColor: CHART_COLORS.precipitation.border,
      backgroundColor: CHART_COLORS.precipitation.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: CHART_COLORS.precipitation.accent,
      borderWidth: 2
    }]
  }), [data, hours])

  const visibilityData = useMemo(() => ({
    labels: hours,
    datasets: [{
      label: 'Visibility (m)',
      data: data.hourly?.visibility || [],
      borderColor: CHART_COLORS.visibility.border,
      backgroundColor: CHART_COLORS.visibility.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: CHART_COLORS.visibility.accent,
      borderWidth: 2
    }]
  }), [data, hours])

  const windData = useMemo(() => ({
    labels: hours,
    datasets: [{
      label: 'Wind Speed (m/s)',
      data: data.hourly?.windspeed_10m || [],
      borderColor: CHART_COLORS.wind.border,
      backgroundColor: CHART_COLORS.wind.bg,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
      pointBackgroundColor: CHART_COLORS.wind.accent,
      borderWidth: 2
    }]
  }), [data, hours])

  const airQualityData = useMemo(() => ({
    labels: hours,
    datasets: [
      {
        label: 'PM10 (µg/m³)',
        data: data.hourly?.pm10 || [],
        borderColor: CHART_COLORS.pm10.border,
        backgroundColor: CHART_COLORS.pm10.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 1.5,
        pointHoverRadius: 4,
        pointBackgroundColor: CHART_COLORS.pm10.accent,
        borderWidth: 2
      },
      {
        label: 'PM2.5 (µg/m³)',
        data: data.hourly?.pm2_5 || [],
        borderColor: CHART_COLORS.pm25.border,
        backgroundColor: CHART_COLORS.pm25.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 1.5,
        pointHoverRadius: 4,
        pointBackgroundColor: CHART_COLORS.pm25.accent,
        borderWidth: 2
      }
    ]
  }), [data, hours])

  const chartOptions = createChartOptions()

  return (
    <div className="charts">
      <h3>Hourly Charts</h3>
      <div className="chart-row">
        <div className="chart-card"><Line data={tempData} options={chartOptions} /></div>
        <div className="chart-card"><Line data={humidityData} options={chartOptions} /></div>
      </div>
      <div className="chart-row">
        <div className="chart-card"><Line data={precipData} options={chartOptions} /></div>
        <div className="chart-card"><Line data={visibilityData} options={chartOptions} /></div>
      </div>
      <div className="chart-row">
        <div className="chart-card"><Line data={windData} options={chartOptions} /></div>
        <div className="chart-card"><Line data={airQualityData} options={chartOptions} /></div>
      </div>
    </div>
  )
})

export default WeatherCharts
