"""Classify field-level agricultural alerts with Claude.

Reads the Kasungu field, zone, gateway and monitoring-area datasets. Optional
observations can be supplied as JSON, for example:

{
  "fields": {
    "F01": {
      "diseases": [{"name": "leaf spot", "confirmed": true, "severity": "high"}],
      "soil_issues": [{"nutrient": "nitrogen", "severity": "moderate", "evidence": "iSDA result"}],
      "fertilizer_issues": [],
      "maturity": {"stage": "mature", "harvest_ready": true, "evidence": "field visit"},
      "weather_alerts": [{"event": "heavy rain", "severity": "high", "active": true}]
    }
  },
  "zones": {"Z1": {"weather_alerts": [{"event": "flood warning", "active": true}]}}
}

Any JSON object under fields/zones/gateways is passed through as evidence. The
program never treats crop type or location alone as evidence of a risk.
Set ANTHROPIC_API_KEY in .env before running. Results are written to JSON;
flagged_fields contains only fields with at least one of the four alert flags.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


API_KEY_ENV = "ANTHROPIC_API_KEY"
API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-6"
ALLOWED_FLAGS = {"Urgent", "Fertilizer", "Disease", "Maturity"}
SEVERITIES = {"none", "low", "moderate", "high", "critical"}


class RiskAnalysisError(RuntimeError):
    """Raised when risk inputs or the Claude response cannot be processed."""


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
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        raise RiskAnalysisError(f"Dataset non trovato: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _read_geojson(path: Path) -> dict[str, dict[str, Any]]:
    if not path.is_file():
        raise RiskAnalysisError(f"Dataset non trovato: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RiskAnalysisError(f"GeoJSON non valido ({path}): {error}") from error
    features: dict[str, dict[str, Any]] = {}
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        field_id = props.get("field_id")
        if props.get("kind") == "field" and field_id:
            # The polygon is already represented by min/max coordinates in the CSV;
            # keep only compact descriptive properties, not hundreds of vertices.
            features[str(field_id)] = {
                key: value for key, value in props.items()
                if key not in {"farmer", "group_leader", "group_name"}
            }
    return features


def build_field_contexts(
    fields_path: Path,
    zones_path: Path,
    gateways_path: Path,
    geojson_path: Path,
    observations_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Join the four supplied datasets and optional observations by field/zone."""
    fields = _read_csv(fields_path)
    zones = {row["zone_id"]: row for row in _read_csv(zones_path)}
    gateways = {row["gateway_id"]: row for row in _read_csv(gateways_path)}
    geo_fields = _read_geojson(geojson_path)
    observations: dict[str, Any] = {}
    if observations_path:
        try:
            observations = json.loads(observations_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise RiskAnalysisError(f"Impossibile leggere observations JSON: {error}") from error
        if not isinstance(observations, dict):
            raise RiskAnalysisError("Il file observations deve contenere un oggetto JSON.")

    by_field = observations.get("fields", {})
    by_zone = observations.get("zones", {})
    by_gateway = observations.get("gateways", {})
    contexts: list[dict[str, Any]] = []
    for row in fields:
        field_id = row.get("field_id", "")
        zone_id = row.get("zone_id", "")
        gateway_id = row.get("gateway_id", "")
        # Exclude personal names and group leadership details from the Claude request.
        static = {
            key: row.get(key, "") for key in (
                "field_id", "field_name", "crop", "lat", "lon", "min_lat", "max_lat",
                "min_lon", "max_lon", "area_ha", "zone_id", "zone_code",
                "weather_station_id", "gateway_id", "soil_node_id", "pole_id",
                "shared_water_channel", "neighbours",
            )
        }
        zone = zones.get(zone_id, {})
        gateway = gateways.get(gateway_id, {})
        contexts.append({
            "field": static,
            "zone_context": {
                "zone_id": zone_id,
                "zone_name": zone.get("name", ""),
                "weather_station_id": zone.get("weather_station_id", ""),
                "weather_station_lat": zone.get("weather_station_lat", ""),
                "weather_station_lon": zone.get("weather_station_lon", ""),
                "zone_observations": by_zone.get(zone_id, {}),
            },
            "gateway_context": {
                "gateway_id": gateway_id,
                "shared_water_channel": gateway.get("shared_water_channel", ""),
                "gateway_observations": by_gateway.get(gateway_id, {}),
            },
            "monitoring_area_properties": geo_fields.get(field_id, {}),
            "observations": by_field.get(field_id, {}),
        })
    if not contexts:
        raise RiskAnalysisError("Il CSV dei campi non contiene campi da analizzare.")
    return contexts


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise RiskAnalysisError(f"Claude non ha restituito JSON valido: {error}") from error


class ClaudeRiskClient:
    """Minimal Anthropic Messages API client using only the Python standard library."""

    def __init__(self, api_key: str | None = None, *, model: str = DEFAULT_MODEL,
                 timeout: float = 90, max_tokens: int = 8192) -> None:
        self.api_key = api_key or os.getenv(API_KEY_ENV)
        if not self.api_key:
            raise RiskAnalysisError(f"Chiave Claude mancante: imposta {API_KEY_ENV} nel file .env.")
        self.model = model
        self.timeout = timeout
        self.max_tokens = max_tokens

    def classify(self, fields: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Ask Claude for evidence-grounded alert classifications for one batch."""
        system = (
            "Sei un analista agronomico prudente. Valuta esclusivamente le evidenze JSON fornite. "
            "Le caratteristiche statiche (coltura, coordinate, vicinanza, nomi) non provano da sole "
            "un problema. Non inventare diagnosi, allerte, carenze, stadi o azioni già avvenute. "
            "Disease richiede una malattia/parassita osservato o un risultato diagnostico esplicito. "
            "Fertilizer richiede un problema esplicito di suolo/nutrienti o fertilizzazione. "
            "Maturity richiede uno stadio o una prontezza di raccolta esplicitamente osservati. "
            "Urgent si assegna solo con evidenza di criticità immediata, per esempio malattia grave "
            "insieme a un'allerta meteo attiva pertinente, oppure altra emergenza esplicita. "
            "Una previsione o condizione meteo generica non basta. Se mancano prove, flags deve essere []. "
            "Severity descrive il rischio più alto supportato; none se nessun flag. "
            "Restituisci solo JSON valido, senza markdown, nella forma: "
            '{"results":[{"field_id":"...","flags":["Disease"],"severity":"moderate",'
            '"alerts":[{"type":"Disease","severity":"moderate","evidence":"...",'
            '"rationale":"...","recommended_action":"..."}]}]}. '
            "Ogni campo del batch deve apparire una sola volta. Gli alert devono giustificare i flag; "
            "evidence deve riferire un fatto presente nei dati, non un'ipotesi. Rispondi in italiano."
        )
        request_body = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": system,
            "messages": [{
                "role": "user",
                "content": "Analizza questi campi e restituisci il JSON richiesto:\n" +
                           json.dumps(fields, ensure_ascii=False, separators=(",", ":")),
            }],
        }
        request = Request(
            API_URL,
            data=json.dumps(request_body, ensure_ascii=False).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "accept": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RiskAnalysisError(f"Errore Claude API HTTP {error.code}: {detail}") from error
        except URLError as error:
            raise RiskAnalysisError(f"Impossibile raggiungere Claude API: {error.reason}") from error
        except (TimeoutError, json.JSONDecodeError) as error:
            raise RiskAnalysisError(f"Risposta Claude non valida o timeout: {error}") from error
        text = "".join(
            block.get("text", "") for block in payload.get("content", [])
            if block.get("type") == "text"
        )
        decoded = _extract_json(text)
        results = decoded.get("results") if isinstance(decoded, dict) else None
        if not isinstance(results, list):
            raise RiskAnalysisError("Risposta Claude priva della lista 'results'.")
        return results


def _validate_result(result: dict[str, Any], expected_ids: set[str]) -> dict[str, Any]:
    field_id = str(result.get("field_id", ""))
    if field_id not in expected_ids:
        raise RiskAnalysisError(f"Claude ha restituito un field_id inatteso: {field_id!r}.")
    flags = result.get("flags", [])
    alerts = result.get("alerts", [])
    if not isinstance(flags, list) or not isinstance(alerts, list):
        raise RiskAnalysisError(f"Formato flags/alerts non valido per {field_id}.")
    normalized_flags = list(dict.fromkeys(flag for flag in flags if flag in ALLOWED_FLAGS))
    valid_alerts = []
    for alert in alerts:
        if not isinstance(alert, dict) or alert.get("type") not in ALLOWED_FLAGS:
            continue
        evidence = str(alert.get("evidence", "")).strip()
        if not evidence:
            continue
        alert_severity = alert.get("severity", "moderate")
        valid_alerts.append({
            "type": alert["type"],
            "severity": alert_severity if alert_severity in SEVERITIES - {"none"} else "moderate",
            "evidence": evidence,
            "rationale": str(alert.get("rationale", "")).strip(),
            "recommended_action": str(alert.get("recommended_action", "")).strip(),
        })
    evidence_flags = {alert["type"] for alert in valid_alerts}
    normalized_flags = [flag for flag in normalized_flags if flag in evidence_flags]
    normalized_flags.extend(flag for flag in evidence_flags if flag not in normalized_flags)
    severity = result.get("severity", "none")
    if severity not in SEVERITIES:
        severity = "none" if not normalized_flags else "moderate"
    if not normalized_flags:
        severity = "none"
    return {
        "field_id": field_id,
        "flags": normalized_flags,
        "severity": severity,
        "alerts": valid_alerts,
    }


def analyze_fields(contexts: list[dict[str, Any]], client: ClaudeRiskClient,
                   batch_size: int = 30) -> list[dict[str, Any]]:
    if batch_size < 1:
        raise ValueError("batch_size deve essere almeno 1.")
    output: dict[str, dict[str, Any]] = {}
    for start in range(0, len(contexts), batch_size):
        batch = contexts[start:start + batch_size]
        expected_ids = {str(item["field"]["field_id"]) for item in batch}
        print(f"Analisi Claude: campi {start + 1}-{start + len(batch)} di {len(contexts)}", file=sys.stderr)
        raw_results = client.classify(batch)
        for raw in raw_results:
            if not isinstance(raw, dict):
                raise RiskAnalysisError("Claude ha restituito un elemento di risultato non valido.")
            validated = _validate_result(raw, expected_ids)
            if validated["field_id"] in output:
                raise RiskAnalysisError(f"Claude ha duplicato il campo {validated['field_id']}.")
            output[validated["field_id"]] = validated
        missing = expected_ids - output.keys()
        if missing:
            raise RiskAnalysisError("Risposta Claude incompleta; campi mancanti: " + ", ".join(sorted(missing)))
    return list(output.values())


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analizza con Claude i rischi agricoli dei campi di Kasungu."
    )
    parser.add_argument("--fields-csv", type=Path, default=Path("kasungu_fields.csv"))
    parser.add_argument("--zones-csv", type=Path, default=Path("kasungu_zones.csv"))
    parser.add_argument("--gateways-csv", type=Path, default=Path("kasungu_gateways.csv"))
    parser.add_argument("--geojson", type=Path, default=Path("kasungu_monitoring_area.geojson"))
    parser.add_argument("--observations", type=Path,
                        help="JSON con osservazioni/risultati iSDA, CropHealth, meteo, maturità.")
    parser.add_argument("--output", type=Path, default=Path("risk_analysis.json"))
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--batch-size", type=int, default=30)
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    args = parser.parse_args()

    try:
        load_env(args.env_file)
        contexts = build_field_contexts(
            args.fields_csv, args.zones_csv, args.gateways_csv, args.geojson, args.observations
        )
        client = ClaudeRiskClient(model=args.model)
        analyses = analyze_fields(contexts, client, args.batch_size)
        flagged = [item for item in analyses if item["flags"]]
        document = {
            "model": args.model,
            "field_count": len(analyses),
            "flagged_count": len(flagged),
            "flag_counts": {
                flag: sum(flag in item["flags"] for item in analyses)
                for flag in ("Urgent", "Fertilizer", "Disease", "Maturity")
            },
            "flagged_fields": flagged,
            "analyses": analyses,
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Analisi completata: {len(flagged)} campi con allerta su {len(analyses)}.")
        print(f"Risultati: {args.output.resolve()}")
        return 0
    except (RiskAnalysisError, OSError, ValueError) as error:
        print(f"Errore: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
