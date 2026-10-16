"""Client for the Kindwise crop.health API.

Set CROP_HEALTH_API_KEY in a .env file before using this module:

    CROP_HEALTH_API_KEY=your_api_key

Example:

    from crophealth import CropHealthClient

    client = CropHealthClient()
    result = client.identify_file("leaf.jpg", details=["taxonomy", "wiki_url"])
    print(result)
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Any, Iterable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_URL = "https://crop.kindwise.com/api/v1"
API_KEY_ENV = "CROP_HEALTH_API_KEY"


class CropHealthError(RuntimeError):
    """Raised when the crop.health API returns an error response."""


def load_env(env_path: str | Path = ".env") -> None:
    """Load simple KEY=VALUE entries from a .env file without overriding the shell."""
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


class CropHealthClient:
    """Small synchronous wrapper around every crop.health v1 endpoint."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str = BASE_URL,
        timeout: float = 30,
        env_path: str | Path = ".env",
    ) -> None:
        load_env(env_path)
        self.api_key = api_key or os.getenv(API_KEY_ENV)
        if not self.api_key:
            raise ValueError(
                f"Missing API key. Add {API_KEY_ENV}=... to .env or pass api_key explicitly."
            )
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        body: Mapping[str, Any] | None = None,
    ) -> Any:
        query = {key: value for key, value in (params or {}).items() if value is not None}
        url = f"{self.base_url}{path}"
        if query:
            url = f"{url}?{urlencode(query, doseq=True)}"

        payload = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Api-Key": self.api_key, "Accept": "application/json"}
        if payload is not None:
            headers["Content-Type"] = "application/json"

        request = Request(url, data=payload, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                content = response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise CropHealthError(f"{method} {path} failed ({error.code}): {detail}") from error
        except URLError as error:
            raise CropHealthError(f"Could not reach crop.health: {error.reason}") from error

        if not content:
            return None
        return json.loads(content.decode("utf-8"))

    # GET /identification/details
    def available_details(self) -> dict[str, Any]:
        """Return optional detail fields accepted by identification endpoints."""
        return self._request("GET", "/identification/details")

    # POST /identification
    def identify(
        self,
        images: Iterable[str],
        *,
        details: Iterable[str] | None = None,
        language: str | Iterable[str] | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        similar_images: bool | None = None,
        custom_id: str | int | None = None,
        asynchronous: bool | None = None,
    ) -> dict[str, Any]:
        """Identify crop and disease suggestions from base64 images or image URLs."""
        body: dict[str, Any] = {"images": list(images)}
        if latitude is not None:
            body["latitude"] = latitude
        if longitude is not None:
            body["longitude"] = longitude
        if similar_images is not None:
            body["similar_images"] = similar_images
        if custom_id is not None:
            body["custom_id"] = custom_id

        params: dict[str, Any] = {}
        if details:
            params["details"] = ",".join(details)
        if language:
            params["language"] = ",".join(language) if not isinstance(language, str) else language
        if asynchronous is not None:
            params["async"] = str(asynchronous).lower()
        return self._request("POST", "/identification", params=params, body=body)

    def identify_file(self, image_path: str | Path, **kwargs: Any) -> dict[str, Any]:
        """Base64-encode an image file and submit it for crop/disease identification."""
        encoded = base64.b64encode(Path(image_path).read_bytes()).decode("ascii")
        return self.identify([encoded], **kwargs)

    # GET /identification/{access_token_or_custom_id}
    def get_identification(
        self,
        access_token_or_custom_id: str | int,
        *,
        details: Iterable[str] | None = None,
        language: str | Iterable[str] | None = None,
    ) -> dict[str, Any]:
        """Retrieve a stored identification by access token or custom ID."""
        params: dict[str, Any] = {}
        if details:
            params["details"] = ",".join(details)
        if language:
            params["language"] = ",".join(language) if not isinstance(language, str) else language
        return self._request("GET", f"/identification/{access_token_or_custom_id}", params=params)

    # DELETE /identification/{access_token_or_custom_id}
    def delete_identification(self, access_token_or_custom_id: str | int) -> None:
        """Delete a stored identification by access token or custom ID."""
        self._request("DELETE", f"/identification/{access_token_or_custom_id}")

    # POST /identification/{access_token_or_custom_id}/feedback
    def feedback(
        self,
        access_token_or_custom_id: str | int,
        *,
        rating: int | None = None,
        comment: str | None = None,
    ) -> dict[str, Any] | None:
        """Send a rating (typically 1-5), a comment, or both for an identification."""
        if rating is None and not comment:
            raise ValueError("Provide at least one of rating or comment.")
        body = {key: value for key, value in {"rating": rating, "comment": comment}.items() if value is not None}
        return self._request("POST", f"/identification/{access_token_or_custom_id}/feedback", body=body)

    # GET /usage_info
    def usage_info(self) -> dict[str, Any]:
        """Return API-key usage and remaining credit information."""
        return self._request("GET", "/usage_info")


def main() -> None:
    parser = argparse.ArgumentParser(description="Call the Kindwise crop.health API.")
    parser.add_argument("--env", default=".env", help="Path to the .env file (default: .env).")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("details", help="List supported identification detail fields.")
    commands.add_parser("usage", help="Show API-key usage information.")

    identify_parser = commands.add_parser("identify", help="Identify a crop image.")
    identify_parser.add_argument("image", help="Local image file path.")
    identify_parser.add_argument("--details", nargs="*", help="Requested result detail fields.")
    identify_parser.add_argument("--language", help="Response language, e.g. en or it.")

    get_parser = commands.add_parser("get", help="Retrieve an identification.")
    get_parser.add_argument("token", help="Access token or custom ID.")
    get_parser.add_argument("--details", nargs="*")
    get_parser.add_argument("--language")

    delete_parser = commands.add_parser("delete", help="Delete an identification.")
    delete_parser.add_argument("token", help="Access token or custom ID.")

    feedback_parser = commands.add_parser("feedback", help="Send identification feedback.")
    feedback_parser.add_argument("token", help="Access token or custom ID.")
    feedback_parser.add_argument("--rating", type=int)
    feedback_parser.add_argument("--comment")

    args = parser.parse_args()
    client = CropHealthClient(env_path=args.env)

    if args.command == "details":
        result = client.available_details()
    elif args.command == "usage":
        result = client.usage_info()
    elif args.command == "identify":
        result = client.identify_file(args.image, details=args.details, language=args.language)
    elif args.command == "get":
        result = client.get_identification(args.token, details=args.details, language=args.language)
    elif args.command == "delete":
        result = client.delete_identification(args.token)
    else:
        result = client.feedback(args.token, rating=args.rating, comment=args.comment)

    if result is not None:
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
