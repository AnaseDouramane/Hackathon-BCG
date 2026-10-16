"""OpenWeather client for Kasungu, Malawi.

Set OPENWEATHER_API_KEY in .env. Standard free endpoints are current weather,
5-day/3-hour forecast, geocoding, and air pollution. Government alerts and
short-interval timelines use One Call 4.0, a separate pay-as-you-call product
with 1,000 free calls per day; additional calls are billed.

Examples:
    python weather.py all
    python weather.py alerts

Library use:
    from weather import OpenWeatherClient
    weather = OpenWeatherClient()
    result = weather.current_weather()
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_KEY_ENV = "OPENWEATHER_API_KEY"
CITY_QUERY = "Kasungu,MW"
GEOCODING_URL = "https://api.openweathermap.org/geo/1.0/direct"
WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution"
AIR_POLLUTION_FORECAST_URL = "https://api.openweathermap.org/data/2.5/air_pollution/forecast"
ONE_CALL_URL = "https://api.openweathermap.org/data/4.0/onecall"


class OpenWeatherError(RuntimeError):
    """Raised when OpenWeather returns an error response."""


def load_env(env_path: str | Path = ".env") -> None:
    """Load KEY=VALUE entries from .env without overriding shell variables."""
    path = Path(env_path)
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if value[:1] == value[-1:] and value[:1] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


class OpenWeatherClient:
    """Small synchronous client for OpenWeather's location and weather APIs."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        city_query: str = CITY_QUERY,
        units: str = "metric",
        language: str = "it",
        timeout: float = 30,
        env_path: str | Path = ".env",
    ) -> None:
        load_env(env_path)
        self.api_key = api_key or os.getenv(API_KEY_ENV)
        if not self.api_key:
            raise ValueError(f"Missing API key. Set {API_KEY_ENV} in .env.")
        if units not in {"standard", "metric", "imperial"}:
            raise ValueError("units must be standard, metric, or imperial.")
        self.city_query = city_query
        self.units = units
        self.language = language
        self.timeout = timeout
        self._location: dict[str, Any] | None = None

    def _get(self, base_url: str, params: Mapping[str, Any]) -> Any:
        query = {key: value for key, value in params.items() if value is not None}
        query["appid"] = self.api_key
        url = f"{base_url}?{urlencode(query)}"
        request = Request(url, headers={"Accept": "application/json"})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                content = response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise OpenWeatherError(f"OpenWeather request failed ({error.code}): {detail}") from error
        except URLError as error:
            raise OpenWeatherError(f"Could not reach OpenWeather: {error.reason}") from error
        return json.loads(content.decode("utf-8")) if content else None

    def geocode(self, query: str | None = None, *, limit: int = 5) -> Any:
        """Resolve a city or place name to coordinates (free Geocoding API)."""
        return self._get(GEOCODING_URL, {"q": query or self.city_query, "limit": limit})

    def _coords(self, latitude: float | None, longitude: float | None) -> tuple[float, float]:
        if (latitude is None) != (longitude is None):
            raise ValueError("Provide both latitude and longitude, or neither.")
        if latitude is not None and longitude is not None:
            return latitude, longitude
        if self._location is None:
            matches = self.geocode(self.city_query, limit=1)
            if not matches:
                raise OpenWeatherError(f"No geocoding result for {self.city_query!r}.")
            self._location = matches[0]
        return float(self._location["lat"]), float(self._location["lon"])

    def current_weather(
        self, latitude: float | None = None, longitude: float | None = None
    ) -> Any:
        """Get current conditions, temperatures, humidity, wind, and precipitation."""
        lat, lon = self._coords(latitude, longitude)
        return self._get(WEATHER_URL, {
            "lat": lat, "lon": lon, "units": self.units, "lang": self.language,
        })

    def forecast_5day(
        self, latitude: float | None = None, longitude: float | None = None
    ) -> Any:
        """Get the free 5-day forecast at 3-hour intervals."""
        lat, lon = self._coords(latitude, longitude)
        return self._get(FORECAST_URL, {
            "lat": lat, "lon": lon, "units": self.units, "lang": self.language,
        })

    def air_pollution(
        self, latitude: float | None = None, longitude: float | None = None
    ) -> Any:
        """Get current air quality and pollutant concentrations."""
        lat, lon = self._coords(latitude, longitude)
        return self._get(AIR_POLLUTION_URL, {"lat": lat, "lon": lon})

    def air_pollution_forecast(
        self, latitude: float | None = None, longitude: float | None = None
    ) -> Any:
        """Get air-quality forecast data (where available for the location)."""
        lat, lon = self._coords(latitude, longitude)
        return self._get(AIR_POLLUTION_FORECAST_URL, {"lat": lat, "lon": lon})

    def one_call_current(
        self,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> Any:
        """Get One Call 4.0 current data, including available alert IDs.

        Requires the separate One Call API subscription. It includes 1,000
        calls/day free; calls beyond that are billed.
        """
        lat, lon = self._coords(latitude, longitude)
        return self._get(f"{ONE_CALL_URL}/current", {
            "lat": lat, "lon": lon, "units": self.units, "lang": self.language,
        })

    def one_call_timeline(
        self,
        step: str,
        latitude: float | None = None,
        longitude: float | None = None,
        *,
        start: int | None = None,
        count: int | None = None,
    ) -> Any:
        """Get One Call 4.0's 1-minute, 15-minute, hourly, or daily timeline."""
        if step not in {"1min", "15min", "1h", "1day"}:
            raise ValueError("step must be one of: 1min, 15min, 1h, 1day.")
        lat, lon = self._coords(latitude, longitude)
        return self._get(f"{ONE_CALL_URL}/timeline/{step}", {
            "lat": lat, "lon": lon, "units": self.units, "lang": self.language,
            "start": start, "cnt": count,
        })

    def alert_details(self, alert_id: str) -> Any:
        """Get the detailed government alert for an alert ID from One Call 4.0."""
        from urllib.parse import quote

        safe_alert_id = quote(alert_id, safe="")
        return self._get(f"{ONE_CALL_URL}/alert/{safe_alert_id}", {})

    def weather_alerts(
        self, latitude: float | None = None, longitude: float | None = None
    ) -> list[dict[str, Any]]:
        """Return full government alerts from One Call 4.0, if available."""
        response = self.one_call_current(latitude, longitude)
        records = response.get("data", []) if isinstance(response, dict) else []
        alert_ids: list[str] = []
        for record in records:
            for alert_id in record.get("alerts", []):
                if alert_id not in alert_ids:
                    alert_ids.append(alert_id)
        return [self.alert_details(alert_id) for alert_id in alert_ids]

    def all_free_data(self) -> dict[str, Any]:
        """Collect location, current weather, 5-day forecast, and air quality."""
        lat, lon = self._coords(None, None)
        return {
            "location": self._location,
            "current_weather": self.current_weather(lat, lon),
            "forecast_5day_3hour": self.forecast_5day(lat, lon),
            "air_pollution": self.air_pollution(lat, lon),
            "air_pollution_forecast": self.air_pollution_forecast(lat, lon),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Weather data for Kasungu, Malawi.")
    parser.add_argument("--env", default=".env", help="Path to .env (default: .env).")
    parser.add_argument("--city", default=CITY_QUERY, help="Place to query, default: Kasungu,MW.")
    parser.add_argument("--lat", type=float, help="Latitude override.")
    parser.add_argument("--lon", type=float, help="Longitude override.")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("geocode", help="Resolve Kasungu or another place to coordinates.")
    commands.add_parser("current", help="Get current weather.")
    commands.add_parser("forecast", help="Get free 5-day forecast, every 3 hours.")
    commands.add_parser("air", help="Get current air quality.")
    commands.add_parser("air-forecast", help="Get air-quality forecast.")
    commands.add_parser("all", help="Get all standard free weather and air-quality data.")
    commands.add_parser("alerts", help="Get alerts via separately enabled One Call 4.0.")
    commands.add_parser("one-call", help="Get One Call 4.0 current weather and alert IDs.")
    timeline_parser = commands.add_parser("timeline", help="Get a One Call 4.0 timeline (separate product).")
    timeline_parser.add_argument("step", choices=("1min", "15min", "1h", "1day"))
    timeline_parser.add_argument("--start", type=int, help="Start timestamp in UTC seconds.")
    timeline_parser.add_argument("--count", type=int, help="Maximum records to request, if supported.")
    alert_parser = commands.add_parser("alert", help="Get details for one One Call 4.0 alert ID.")
    alert_parser.add_argument("alert_id")
    args = parser.parse_args()

    client = OpenWeatherClient(city_query=args.city, env_path=args.env)
    coords = (args.lat, args.lon)
    if args.command == "geocode":
        result = client.geocode()
    elif args.command == "current":
        result = client.current_weather(*coords)
    elif args.command == "forecast":
        result = client.forecast_5day(*coords)
    elif args.command == "air":
        result = client.air_pollution(*coords)
    elif args.command == "air-forecast":
        result = client.air_pollution_forecast(*coords)
    elif args.command == "alerts":
        result = client.weather_alerts(*coords)
    elif args.command == "one-call":
        result = client.one_call_current(*coords)
    elif args.command == "timeline":
        result = client.one_call_timeline(args.step, *coords, start=args.start, count=args.count)
    elif args.command == "alert":
        result = client.alert_details(args.alert_id)
    else:
        result = client.all_free_data()
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
