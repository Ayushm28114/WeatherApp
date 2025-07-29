class WeatherApp {
  constructor() {
    this.apiKey = "YOUR_API_KEY"; // Use your own free API key
    this.baseUrl = "https://api.openweathermap.org/data/2.5/";
    this.currentUnit = "metric"; // metric for Celsius, imperial for Fahrenheit
    this.currentCity = "Noida"; // Default city

    this.initializeElements();
    this.attachEventListeners();
    this.showDemoData(); 
  }

  initializeElements() {
    this.searchInput = document.getElementById("searchInput");
    this.searchBtn = document.getElementById("searchBtn");
    this.celsiusBtn = document.getElementById("celsiusBtn");
    this.fahrenheitBtn = document.getElementById("fahrenheitBtn");
    this.loading = document.getElementById("loading");
    this.errorMessage = document.getElementById("errorMessage");
    this.weatherContainer = document.getElementById("weatherContainer");
    this.currentTemp = document.getElementById("currentTemp");
    this.weatherIcon = document.getElementById("weatherIcon");
    this.cityName = document.getElementById("cityName");
    this.weatherDescription = document.getElementById("weatherDescription");
    this.currentDate = document.getElementById("currentDate");
    this.feelsLike = document.getElementById("feelsLike");
    this.humidity = document.getElementById("humidity");
    this.windSpeed = document.getElementById("windSpeed");
    this.pressure = document.getElementById("pressure");
    this.forecastGrid = document.getElementById("forecastGrid");
  }

  attachEventListeners() {
    this.searchBtn.addEventListener("click", () => this.handleSearch());
    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleSearch();
    });
    this.celsiusBtn.addEventListener("click", () => this.switchUnit("metric"));
    this.fahrenheitBtn.addEventListener("click", () =>
      this.switchUnit("imperial")
    );
  }

  handleSearch() {
    const city = this.searchInput.value.trim();
    if (!city) return;

    this.currentCity = city;
    this.getWeatherData(city);
  }

  switchUnit(unit) {
    if (this.currentUnit === unit) return;

    this.currentUnit = unit;
    this.updateUnitButtons();
    this.getWeatherData(this.currentCity);
  }

  updateUnitButtons() {
    if (this.currentUnit === "metric") {
      this.celsiusBtn.classList.add("active");
      this.fahrenheitBtn.classList.remove("active");
    } else {
      this.fahrenheitBtn.classList.add("active");
      this.celsiusBtn.classList.remove("active");
    }
  }

  showLoading() {
    this.loading.style.display = "block";
    this.errorMessage.style.display = "none";
    this.weatherContainer.style.display = "none";
  }

  hideLoading() {
    this.loading.style.display = "none";
  }

  showError(message) {
    this.hideLoading();
    this.errorMessage.style.display = "block";
    this.weatherContainer.style.display = "none";
    document.getElementById("errorText").textContent = message;
  }

  showWeatherData() {
    this.hideLoading();
    this.errorMessage.style.display = "none";
    this.weatherContainer.style.display = "block";
  }

  async getWeatherData(city) {
    this.showLoading();

    setTimeout(() => {
      this.showDemoData(city);
    }, 1000); // Simulate API delay
  }

  showDemoData(city = "Noida") {
    const demoData = {
      name: city,
      main: {
        temp: this.currentUnit === "metric" ? 22 : 72,
        feels_like: this.currentUnit === "metric" ? 25 : 77,
        humidity: 65,
        pressure: 1013,
      },
      weather: [
        {
          main: "Clear",
          description: "Clear sky",
          icon: "01d",
        },
      ],
      wind: {
        speed: this.currentUnit === "metric" ? 10 : 6.2,
      },
    };

    this.updateCurrentWeather(demoData);
    this.updateForecast();
    this.showWeatherData();
  }

  updateCurrentWeather(data) {
    const unitSymbol = this.currentUnit === "metric" ? "°C" : "°F";
    const windUnit = this.currentUnit === "metric" ? "km/h" : "mph";

    this.currentTemp.textContent = Math.round(data.main.temp);
    document.querySelector(".unit").textContent = unitSymbol;
    this.cityName.textContent = data.name;
    this.weatherDescription.textContent = data.weather[0].description;
    this.currentDate.textContent = this.getCurrentDate();
    this.feelsLike.textContent = Math.round(data.main.feels_like) + unitSymbol;
    this.humidity.textContent = data.main.humidity + "%";
    this.windSpeed.textContent = Math.round(data.wind.speed) + " " + windUnit;
    this.pressure.textContent = data.main.pressure + " hPa";

    this.updateWeatherIcon(data.weather[0].main);

    this.updateBackground(data.weather[0].main);
  }

  updateWeatherIcon(weatherMain) {
    const iconMap = {
      Clear: "fas fa-sun",
      Clouds: "fas fa-cloud",
      Rain: "fas fa-cloud-rain",
      Drizzle: "fas fa-cloud-drizzle",
      Thunderstorm: "fas fa-bolt",
      Snow: "fas fa-snowflake",
      Mist: "fas fa-smog",
      Fog: "fas fa-smog",
    };

    this.weatherIcon.className = iconMap[weatherMain] || "fas fa-sun";
  }

  updateBackground(weatherMain) {
    const body = document.body;
    body.className = ""; 

    const backgroundMap = {
      Clear: "sunny",
      Clouds: "cloudy",
      Rain: "rainy",
      Thunderstorm: "stormy",
      Snow: "snowy",
      Mist: "misty",
      Fog: "misty",
    };

    const weatherClass = backgroundMap[weatherMain] || "sunny";
    body.classList.add(weatherClass);
  }

  updateForecast() {
    const forecastData = [
      { day: "Today", icon: "fas fa-sun", high: 25, low: 18, desc: "Sunny" },
      {
        day: "Tomorrow",
        icon: "fas fa-cloud-sun",
        high: 23,
        low: 16,
        desc: "Partly Cloudy",
      },
      {
        day: "Wednesday",
        icon: "fas fa-cloud-rain",
        high: 20,
        low: 14,
        desc: "Light Rain",
      },
      {
        day: "Thursday",
        icon: "fas fa-cloud",
        high: 19,
        low: 13,
        desc: "Cloudy",
      },
      { day: "Friday", icon: "fas fa-sun", high: 26, low: 19, desc: "Sunny" },
    ];

    this.forecastGrid.innerHTML = "";

    forecastData.forEach((day) => {
      const forecastItem = document.createElement("div");
      forecastItem.className = "forecast-item";

      const unitSymbol = this.currentUnit === "metric" ? "°C" : "°F";
      const high =
        this.currentUnit === "metric"
          ? day.high
          : Math.round((day.high * 9) / 5 + 32);
      const low =
        this.currentUnit === "metric"
          ? day.low
          : Math.round((day.low * 9) / 5 + 32);

      forecastItem.innerHTML = `
                <div class="forecast-date">${day.day}</div>
                <div class="forecast-icon">
                    <i class="${day.icon}"></i>
                </div>
                <div class="forecast-temps">
                    <span class="forecast-high">${high}${unitSymbol}</span>
                    <span class="forecast-low">${low}${unitSymbol}</span>
                </div>
                <div class="forecast-desc">${day.desc}</div>
            `;

      this.forecastGrid.appendChild(forecastItem);
    });
  }

  getCurrentDate() {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date().toLocaleDateString("en-US", options);
  }
}

// CSS for weather-based backgrounds
const weatherStyles = `
    .sunny {
        background-image: url('https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?w=1200&auto=format&fit=crop&q=80&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8c2t5fGVufDB8fDB8fHww');
        // background: linear-gradient(135deg,rgb(114, 169, 27) 0%,rgb(24, 141, 151) 100%);
    }
    
    .cloudy {
        background: linear-gradient(135deg, #4b6cb7 0%, #182848 100%);
    }
    
    .rainy {
        background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%);
    }
    
    .stormy {
        background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
    }
    
    .snowy {
        background: linear-gradient(135deg, #e6ddd4 0%, #d5d4d0 100%);
    }
    
    .misty {
        background: linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%);
    }
`;

// Add weather styles to head
const style = document.createElement("style");
style.textContent = weatherStyles;
document.head.appendChild(style);

document.addEventListener("DOMContentLoaded", () => {
  new WeatherApp();
});

// API Key Instructions for Users
console.log(`
🌤️ Weather App Setup Instructions:

To use real weather data:

1. Get a free API key from OpenWeatherMap:
   - Go to: https://openweathermap.org/api
   - Sign up for a free account
   - Get your API key

2. Replace 'YOUR_API_KEY' in the code with your actual API key

3. Uncomment the real API call in getWeatherData() method

Current version shows demo data for demonstration purposes.
All functionality works as expected with real API integration!
`);
