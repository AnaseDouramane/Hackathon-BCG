"""Client for the iSDA Virtual Agronomist API.

Authentication uses the registered ISDA username and password to obtain a
short-lived JWT. Put them in .env as ISDA_USERNAME and ISDA_PASSWORD.

Example:
    from isda import ISDAClient

    client = ISDAClient()
    print(client.list_crops())
    plan = client.nutrient_plan(
        "maize",
        {"Yield_Now_User": 3},
        coordinates={"latitude": 6.9487309, "longitude": -0.4300185},
    )
"""

from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


BASE_URL = "https://api.isda-africa.com/virtual-agronomist/v1"


class ISDAError(RuntimeError):
    """Raised when the iSDA API returns an error response."""


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


class ISDAClient:
    """Synchronous client for all public Virtual Agronomist API operations."""

    def __init__(
        self,
        username: str | None = None,
        password: str | None = None,
        *,
        base_url: str = BASE_URL,
        timeout: float = 45,
        env_path: str | Path = ".env",
    ) -> None:
        load_env(env_path)
        self.username = username or os.getenv("ISDA_USERNAME")
        self.password = password or os.getenv("ISDA_PASSWORD")
        if not self.username or not self.password:
            raise ValueError(
                "Missing ISDA credentials. Set ISDA_USERNAME and ISDA_PASSWORD in .env."
            )
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._access_token: str | None = None
        self._token_expires_at = 0.0

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: Mapping[str, Any] | None = None,
        form: Mapping[str, str] | None = None,
        authenticated: bool = False,
        retry_auth: bool = True,
    ) -> Any:
        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}
        if authenticated:
            self._ensure_token()
            headers["Authorization"] = f"Bearer {self._access_token}"

        if form is not None:
            data = urlencode(form).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        elif body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            data = None

        request = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                content = response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            if authenticated and error.code == 401 and retry_auth:
                self._access_token = None
                self._token_expires_at = 0
                return self._request(
                    method,
                    path,
                    body=body,
                    form=form,
                    authenticated=True,
                    retry_auth=False,
                )
            raise ISDAError(f"{method} {path} failed ({error.code}): {detail}") from error
        except URLError as error:
            raise ISDAError(f"Could not reach the iSDA API: {error.reason}") from error

        if not content:
            return None
        return json.loads(content.decode("utf-8"))

    def login(self) -> dict[str, Any]:
        """Exchange the .env username and password for a JWT access token."""
        result = self._request(
            "POST",
            "/login",
            form={"username": self.username or "", "password": self.password or ""},
        )
        token = result.get("access_token") if isinstance(result, dict) else None
        if not token:
            raise ISDAError("Login response did not contain an access_token.")
        expires_in = int(result.get("expires_in", 3600))
        self._access_token = token
        self._token_expires_at = time.monotonic() + max(0, expires_in - 60)
        return result

    def _ensure_token(self) -> None:
        if not self._access_token or time.monotonic() >= self._token_expires_at:
            self.login()

    def list_crops(self) -> Any:
        """GET /crops: list supported crops and their slugs."""
        return self._request("GET", "/crops", authenticated=True)

    def list_tools(self, crop_slug: str) -> Any:
        """GET /crops/{crop_slug}/tools: list tools available for a crop."""
        slug = quote(crop_slug.strip(), safe="")
        return self._request("GET", f"/crops/{slug}/tools", authenticated=True)

    def nutrient_plan(
        self,
        crop_slug: str,
        input_data: Mapping[str, Any],
        *,
        coordinates: Mapping[str, float] | None = None,
        polygon: Mapping[str, Any] | None = None,
        soil_properties: Mapping[str, Any] | None = None,
        fertilisers: list[Mapping[str, Any]] | None = None,
        max_basal_products: int | None = None,
    ) -> Any:
        """POST /crops/{crop_slug}/nutrient-plan using the crop's input schema."""
        if not any((coordinates, polygon, soil_properties)):
            raise ValueError("Provide at least one of coordinates, polygon, or soil_properties.")
        if not isinstance(input_data, Mapping):
            raise TypeError("input_data must be a mapping of crop-specific input fields.")
        if crop_slug.strip().lower() == "lowland-rice" and "Rainfed_or_Irrigated" not in input_data:
            raise ValueError("Lowland Rice requires input_data['Rainfed_or_Irrigated'].")
        if max_basal_products is not None and max_basal_products not in (1, 2, 3):
            raise ValueError("max_basal_products must be 1, 2, or 3.")

        payload: dict[str, Any] = {"input": dict(input_data)}
        if coordinates is not None:
            payload["coordinates"] = dict(coordinates)
        if polygon is not None:
            payload["polygon"] = dict(polygon)
        if soil_properties is not None:
            payload["soil_properties"] = dict(soil_properties)
        if fertilisers is not None:
            payload["fertilisers"] = [dict(item) for item in fertilisers]
        if max_basal_products is not None:
            payload["max_basal_products"] = max_basal_products

        slug = quote(crop_slug.strip(), safe="")
        return self._request(
            "POST", f"/crops/{slug}/nutrient-plan", body=payload, authenticated=True
        )


def _load_json(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Call the iSDA Virtual Agronomist API.")
    parser.add_argument("--env", default=".env", help="Path to .env (default: .env).")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("login", help="Get a JWT access token.")
    commands.add_parser("crops", help="List supported crops.")
    tools_parser = commands.add_parser("tools", help="List tools supported for a crop.")
    tools_parser.add_argument("crop_slug")
    plan_parser = commands.add_parser("nutrient-plan", help="Generate a crop nutrient plan.")
    plan_parser.add_argument("crop_slug")
    plan_parser.add_argument("request_json", help="JSON file with the endpoint request body.")
    args = parser.parse_args()

    client = ISDAClient(env_path=args.env)
    if args.command == "login":
        result = client.login()
    elif args.command == "crops":
        result = client.list_crops()
    elif args.command == "tools":
        result = client.list_tools(args.crop_slug)
    else:
        request_data = _load_json(args.request_json)
        if not isinstance(request_data, dict):
            raise ValueError("The nutrient plan JSON file must contain an object.")
        # The JSON file follows the API request schema: input plus one or more
        # of coordinates, polygon, soil_properties, fertilisers, max_basal_products.
        input_data = request_data.pop("input", None)
        if input_data is None:
            raise ValueError("The nutrient plan JSON object must include 'input'.")
        location_options = {
            key: request_data.pop(key, None)
            for key in ("coordinates", "polygon", "soil_properties")
        }
        result = client.nutrient_plan(args.crop_slug, input_data, **location_options, **request_data)

    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
