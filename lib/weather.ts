/**
 * Weather via open-meteo — free, no API key, no rate limits.
 * Default location: Berlin (52.5200° N, 13.4050° E).
 */

const DEFAULT_LAT = 52.52;
const DEFAULT_LON = 13.405;
const DEFAULT_CITY = "Berlin";

interface WeatherCurrent {
  temperature: number;
  apparent: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

interface WeatherDaily {
  date: string;
  tempMin: number;
  tempMax: number;
  weatherCode: number;
  precipitationProbability: number;
}

export interface WeatherReport {
  city: string;
  current: WeatherCurrent;
  daily:   WeatherDaily[];
}

// WMO Weather interpretation codes — German labels.
const WMO_LABELS: Record<number, string> = {
  0:  "klar",
  1:  "ueberwiegend klar",
  2:  "teilweise bewoelkt",
  3:  "bedeckt",
  45: "Nebel",
  48: "gefrierender Nebel",
  51: "leichter Nieselregen",
  53: "Nieselregen",
  55: "starker Nieselregen",
  61: "leichter Regen",
  63: "Regen",
  65: "starker Regen",
  71: "leichter Schneefall",
  73: "Schneefall",
  75: "starker Schneefall",
  80: "leichte Schauer",
  81: "Schauer",
  82: "starke Schauer",
  95: "Gewitter",
  96: "Gewitter mit Hagel",
  99: "starkes Gewitter mit Hagel",
};

export function describeWeatherCode(code: number): string {
  return WMO_LABELS[code] ?? "wechselhaft";
}

export async function getWeather(
  city: string = DEFAULT_CITY,
  lat:  number = DEFAULT_LAT,
  lon:  number = DEFAULT_LON,
): Promise<WeatherReport> {
  // If a city other than Berlin is given, geocode it first
  let resolvedLat = lat;
  let resolvedLon = lon;
  let resolvedCity = city;

  if (city !== DEFAULT_CITY) {
    const geo = await geocode(city);
    if (geo) {
      resolvedLat  = geo.lat;
      resolvedLon  = geo.lon;
      resolvedCity = geo.name;
    }
  }

  const params = new URLSearchParams({
    latitude:  String(resolvedLat),
    longitude: String(resolvedLon),
    current:   "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily:     "temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max",
    timezone:  "Europe/Berlin",
    forecast_days: "4",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`open-meteo: ${res.status}`);
  const data = await res.json();

  const current: WeatherCurrent = {
    temperature: Math.round(data.current?.temperature_2m ?? 0),
    apparent:    Math.round(data.current?.apparent_temperature ?? 0),
    humidity:    Math.round(data.current?.relative_humidity_2m ?? 0),
    windSpeed:   Math.round(data.current?.wind_speed_10m ?? 0),
    weatherCode: data.current?.weather_code ?? 0,
    isDay:       Boolean(data.current?.is_day ?? 1),
  };

  const dailyArr = data.daily ?? {};
  const daily: WeatherDaily[] = (dailyArr.time ?? []).map((d: string, i: number) => ({
    date:                     d,
    tempMin:                  Math.round(dailyArr.temperature_2m_min?.[i] ?? 0),
    tempMax:                  Math.round(dailyArr.temperature_2m_max?.[i] ?? 0),
    weatherCode:              dailyArr.weather_code?.[i] ?? 0,
    precipitationProbability: dailyArr.precipitation_probability_max?.[i] ?? 0,
  }));

  return { city: resolvedCity, current, daily };
}

async function geocode(query: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=de`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const hit = data.results?.[0];
  if (!hit) return null;
  return { lat: hit.latitude, lon: hit.longitude, name: hit.name };
}

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

export function formatWeather(w: WeatherReport): string {
  const today = w.daily[0];
  const lines: string[] = [];

  // Spoken summary
  lines.push(
    `In ${w.city} sind es aktuell ${w.current.temperature} Grad bei ${describeWeatherCode(w.current.weatherCode)}, ` +
    `gefuehlt ${w.current.apparent} Grad. ` +
    `Heute zwischen ${today?.tempMin ?? "–"} und ${today?.tempMax ?? "–"} Grad.`
  );
  lines.push("");

  lines.push(`## Wetter ${w.city}`);
  lines.push("");
  lines.push(`**Jetzt:** ${w.current.temperature}° · ${describeWeatherCode(w.current.weatherCode)} · gefuehlt ${w.current.apparent}° · ${w.current.windSpeed} km/h Wind`);
  lines.push("");
  lines.push("## Vorhersage");
  for (const d of w.daily.slice(0, 4)) {
    const day = new Date(d.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
    const rain = d.precipitationProbability ? ` · ${d.precipitationProbability}% Regen` : "";
    lines.push(`- **${day}** — ${d.tempMin}° bis ${d.tempMax}° · ${describeWeatherCode(d.weatherCode)}${rain}`);
  }

  return lines.join("\n").trim();
}
