# Script Python di riferimento (Anase)

Client originali per i servizi esterni. L'app Next.js usa le loro traduzioni TypeScript in `lib/external/`
(`weather.ts`, `isda.ts`, `crophealth.ts`, `risk.ts`), collegate dalla pipeline in `lib/pipeline/`
(bottone "Update" in dashboard); questi script restano per prove manuali dal terminale.

| Script | Servizio | Chiave in `.env` |
|---|---|---|
| `crophealth.py` | Kindwise crop.health (malattie da foto) | `CROP_HEALTH_API_KEY` |
| `weather.py` | OpenWeather (meteo Kasungu) | `OPENWEATHER_API_KEY` |
| `isda.py` | iSDA Virtual Agronomist (piano di concimazione) | `ISDA_USERNAME`, `ISDA_PASSWORD` |
| `risk.py` | Claude (flag di rischio per campo) | `ANTHROPIC_API_KEY` |

I dataset sono in `data/kasungu/`. Esempio dalla radice del repo:

```bash
python tools/python/risk.py --env-file .env.local \
  --fields-csv data/kasungu/kasungu_fields.csv --zones-csv data/kasungu/kasungu_zones.csv \
  --gateways-csv data/kasungu/kasungu_gateways.csv --geojson data/kasungu/kasungu_monitoring_area.geojson
```
