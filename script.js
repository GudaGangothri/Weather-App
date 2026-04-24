// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const errorMessage = document.getElementById('error-message');
const weatherContent = document.getElementById('weather-content');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');

// Weather Details Elements
const cityNameEl = document.getElementById('city-name');
const currentDateEl = document.getElementById('current-date');
const temperatureEl = document.getElementById('temperature');
const weatherDescriptionEl = document.getElementById('weather-description');
const mainWeatherIcon = document.getElementById('main-weather-icon');

// Secondary Details
const feelsLikeEl = document.getElementById('feels-like');
const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('wind-speed');
const visibilityEl = document.getElementById('visibility');

// Forecast
const forecastContainer = document.getElementById('forecast-container');

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

async function handleSearch() {
    const city = cityInput.value.trim();
    if (!city) return;

    // Show Loading
    emptyState.classList.add('hidden');
    weatherContent.classList.add('hidden');
    errorMessage.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');

    try {
        // Step 1: Geocoding - Get Coordinates for City
        const geoData = await fetchCoordinates(city);
        if (!geoData || geoData.length === 0) {
            throw new Error('City not found');
        }

        const { latitude, longitude, name, country } = geoData[0];

        // Step 2: Get Weather Data
        const weatherData = await fetchWeather(latitude, longitude);

        // Step 3: Update UI
        updateUI(name, country, weatherData);

    } catch (error) {
        console.error('Error fetching weather:', error);
        errorMessage.textContent = 'City not found. Please try again.';
        errorMessage.classList.remove('hidden');
        emptyState.classList.remove('hidden');
    } finally {
        loadingSpinner.classList.add('hidden');
    }
}

async function fetchCoordinates(city) {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const response = await fetch(geoUrl);
    if (!response.ok) throw new Error('Geocoding API failed');
    const data = await response.json();
    return data.results;
}

async function fetchWeather(lat, lon) {
    // Fetch current weather and 7 days daily forecast
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error('Weather API failed');
    return await response.json();
}

function updateUI(city, country, data) {
    const current = data.current;
    const daily = data.daily;
    
    // 1. Set Location and Date
    cityNameEl.textContent = `${city}, ${country}`;
    const date = new Date(current.time);
    currentDateEl.textContent = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

    // 2. Set Current Weather
    temperatureEl.textContent = `${Math.round(current.temperature_2m)}°`;
    
    // Map WMO Code to Description and Icon
    const weatherInfo = getWeatherInfo(current.weather_code, current.is_day);
    weatherDescriptionEl.textContent = weatherInfo.description;
    
    // Update Icon
    mainWeatherIcon.className = `fa-solid ${weatherInfo.icon}`;
    
    // Update Background
    document.body.className = weatherInfo.bgClass;

    // 3. Set Secondary Details
    feelsLikeEl.textContent = `${Math.round(current.apparent_temperature)}°`;
    humidityEl.textContent = `${current.relative_humidity_2m}%`;
    windSpeedEl.textContent = `${current.wind_speed_10m} km/h`;
    
    // Open-Meteo free doesn't easily provide visibility in the same endpoint without adding more params, 
    // so we can use precipitation as an alternative or just mock visibility based on conditions.
    const precip = current.precipitation || 0;
    visibilityEl.textContent = precip > 0 ? `${precip} mm rain` : 'Clear';

    // 4. Set Forecast
    renderForecast(daily);

    // Show Content
    weatherContent.classList.remove('hidden');
}

function renderForecast(daily) {
    forecastContainer.innerHTML = ''; // Clear previous
    
    // Open-Meteo returns arrays of daily values. Skip today (index 0).
    for (let i = 1; i < 7; i++) {
        if (!daily.time[i]) break;
        
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const weatherInfo = getWeatherInfo(daily.weather_code[i], 1); // assume day for forecast
        
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';
        forecastItem.innerHTML = `
            <span class="f-day">${dayName}</span>
            <i class="fa-solid ${weatherInfo.icon}"></i>
            <span class="f-temp">${maxTemp}°<span style="font-size: 0.8em; color: var(--text-secondary); margin-left: 4px;">${minTemp}°</span></span>
        `;
        forecastContainer.appendChild(forecastItem);
    }
}

// Map WMO Weather codes to UI specifics
function getWeatherInfo(code, isDay) {
    let info = { description: 'Unknown', icon: 'fa-circle-question', bgClass: 'weather-default' };

    switch (true) {
        case (code === 0):
            info.description = 'Clear Sky';
            info.icon = isDay ? 'fa-sun' : 'fa-moon';
            info.bgClass = 'weather-clear';
            break;
        case (code === 1 || code === 2 || code === 3):
            info.description = code === 1 ? 'Mainly Clear' : (code === 2 ? 'Partly Cloudy' : 'Overcast');
            info.icon = isDay ? 'fa-cloud-sun' : 'fa-cloud-moon';
            info.bgClass = 'weather-clouds';
            break;
        case (code === 45 || code === 48):
            info.description = 'Fog';
            info.icon = 'fa-smog';
            info.bgClass = 'weather-clouds';
            break;
        case (code >= 51 && code <= 57):
            info.description = 'Drizzle';
            info.icon = 'fa-cloud-rain';
            info.bgClass = 'weather-rain';
            break;
        case (code >= 61 && code <= 67):
            info.description = 'Rain';
            info.icon = 'fa-cloud-showers-heavy';
            info.bgClass = 'weather-rain';
            break;
        case (code >= 71 && code <= 77):
            info.description = 'Snow';
            info.icon = 'fa-snowflake';
            info.bgClass = 'weather-snow';
            break;
        case (code >= 80 && code <= 82):
            info.description = 'Rain Showers';
            info.icon = 'fa-cloud-showers-water';
            info.bgClass = 'weather-rain';
            break;
        case (code === 85 || code === 86):
            info.description = 'Snow Showers';
            info.icon = 'fa-snowflake';
            info.bgClass = 'weather-snow';
            break;
        case (code >= 95 && code <= 99):
            info.description = 'Thunderstorm';
            info.icon = 'fa-cloud-bolt';
            info.bgClass = 'weather-thunder';
            break;
        default:
            info.description = 'Unknown';
            info.icon = 'fa-cloud';
            info.bgClass = 'weather-default';
    }

    return info;
}

// Initial default state
document.body.className = 'weather-default';
