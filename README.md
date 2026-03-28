# Weather Dashboard

A responsive ReactJS application that displays current and historical weather using the Open‑Meteo APIs. The prototype auto-detects the user's location (browser GPS) and renders hourly and range-based charts with zoom/pan support.

---

## Features

- Auto-detect location via browser Geolocation API
- Current weather + hourly charts (temperature, humidity, precipitation, visibility, wind, PM10/PM2.5)
- Historical analysis view (date range up to 2 years): temperature (mean/max/min), sunrise/sunset (IST), precipitation totals, wind trends, PM trends
- Interactive charts with horizontal scrolling and zoom (Chart.js + chartjs-plugin-zoom)
- Mobile-responsive layout and chart stacking
- Uses Open‑Meteo endpoints (no API key required)

---

## Tech stack

- React 18 (Vite)
- Axios for HTTP
- Chart.js + react-chartjs-2 + chartjs-plugin-zoom
- react-datepicker for date selection
- date-fns for date utilities
- react-router-dom for client routes

---

## Prerequisites

- Node.js 16+ (Node 18 or 20 recommended)
- npm (bundled with Node)
- Git (if you will push to remote)

---

## Setup (PowerShell on Windows)

1. Open PowerShell and change to project folder:

   cd "F:\Full Stack\WeatherApp"

2. Install dependencies:

   npm install

   - If you encounter peer dependency errors, try:

     npm install --legacy-peer-deps

3. Start dev server (Vite):

   npm run dev

   - Vite prints a local URL (usually http://localhost:5173). Open this in your browser.

4. Build production bundle:

   npm run build

5. Preview production build locally:

   npm run preview

---

## Notes on Geolocation and Browser

- The app uses `navigator.geolocation.getCurrentPosition`. Browsers prompt the user for permission. Localhost is treated as a secure origin so geolocation will work when served from the dev server.
- If the browser blocks location or you deny permission, the app will show a message "Waiting for location or error fetching data." Use the date picker to fetch other dates once location is available.

---

## Open‑Meteo endpoints used

- Current & hourly forecast (prototype): https://api.open-meteo.com/v1/forecast
  - hourly: temperature_2m, relativehumidity_2m, precipitation, visibility, windspeed_10m, pm10, pm2_5
  - daily: temperature_2m_max, temperature_2m_min, uv_index_max, sunrise, sunset, precipitation_sum, windspeed_10m_max
- Historical (ERA5): https://api.open-meteo.com/v1/era5
  - daily: temperature_2m_mean, temperature_2m_max, temperature_2m_min, sunrise, sunset, precipitation_sum, windspeed_10m_max

Limitations:
- Some pollutants (CO, CO2, NO2, SO2) and a computed AQI are not always available via Open‑Meteo. These are shown as N/A in the UI. To include them, integrate an AQ provider (OpenAQ, BreezoMeter, IQAir, etc.). See "Adding another AQ provider" below.

---

## Performance (500 ms requirement)

- The 500 ms full-load requirement is aggressive for client-only apps calling remote APIs. Network latency and API response time are usually the bottleneck.
- Recommended measures to meet 500 ms in real deployment:
  - Add an edge cache or serverless proxy (CDN) that caches Open‑Meteo responses.
  - Use stale-while-revalidate caching strategies and local IndexedDB for instant UI with background refresh.
  - Optimize bundle (code-splitting, tree-shaking), enable gzip/brotli on host, and serve from a fast CDN.

---

## How to add an external Air Quality API (example)

1. Obtain API key from provider (e.g., OpenAQ, IQAir, BreezoMeter).
2. Store the key in an environment file (do not commit):

   .env
   REACT_APP_AQ_API_KEY=your_key_here

3. Add a small serverless endpoint or proxy to keep the key secret and add caching. Example endpoint: `/api/aq?lat=...&lon=...`.
4. Call that endpoint from the React app and merge results into the Air Quality card.

---

## Git quick steps (create repo and push)

1. Initialize and commit (if not already):

   git init
   git add .
   git commit -m "Initial commit"

2. Add remote and push (replace <REMOTE_URL>):

   git branch -M main
   git remote add origin <REMOTE_URL>
   git push -u origin main

Authentication:
- For HTTPS use a Personal Access Token (GitHub) when prompted for password.
- For SSH ensure your SSH key is added to your account.

---

## Files of interest

- `src/pages/CurrentWeather.jsx` — geolocation, forecast call, overview cards
- `src/shared/WeatherCharts.jsx` — hourly charts
- `src/pages/HistoricalAnalysis.jsx` — date range UI
- `src/shared/HistoricalCharts.jsx` — historical ERA5 charts
- `src/styles.css` — main styling
- `index.html` and `src/main.jsx` — app entry

---

## Known issues & next tasks

- Temperature toggle exists but charts currently plot raw temperatures; implement conversion for chart datasets.
- Enforce client-side 2-year max for historical date-range selection.
- Add server-side/edge caching to meet strict 500 ms load requirement.
- Integrate a dedicated AQ provider for missing pollutants and AQI calculation.
- Improve accessibility, localization, and unit formatting.

If you want, I can implement any of the above improvements — indicate which one and I will proceed.

---

## License

MIT

---

## Contact / Issues

Open an issue in the repository or paste terminal/browser console logs here and the exact error and I'll assist.
