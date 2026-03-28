import React, { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import HistoricalCharts from '../shared/HistoricalCharts'
import { startOfDay } from 'date-fns'

export default function HistoricalAnalysis() {
  const [start, setStart] = useState(startOfDay(new Date()))
  const [end, setEnd] = useState(startOfDay(new Date()))

  return (
    <div className="page historical">
      <h2>Historical Analysis</h2>
      <div className="controls">
        <div>
          <label>Start:</label>
          <DatePicker selected={start} onChange={d => setStart(startOfDay(d))} />
        </div>
        <div>
          <label>End:</label>
          <DatePicker selected={end} onChange={d => setEnd(startOfDay(d))} />
        </div>
      </div>

      <HistoricalCharts start={start} end={end} />
    </div>
  )
}
