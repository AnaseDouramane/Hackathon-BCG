# Felix Field — Specifica di prodotto e tecnica

> Documento di riferimento per il team (5 persone). Descrive **cosa** costruiamo, **con quali strumenti**, **come si incastrano i pezzi** e **chi fa cosa**.
> Il dettaglio del database è in [`docs/database.md`](docs/database.md).
>
> Lingua: lo spec è in italiano; tutti i testi dell'interfaccia sono in **inglese**.

---

## Indice
1. [Il problema e l'utente](#1-il-problema-e-lutente)
2. [Cosa costruiamo (scope)](#2-cosa-costruiamo-scope)
3. [Architettura: contract-first e mock sostituibile](#3-architettura-contract-first-e-mock-sostituibile)
4. [Stack tecnologico](#4-stack-tecnologico)
5. [Struttura del repository](#5-struttura-del-repository)
6. [Regole di dominio (color code, urgenza, priorità)](#6-regole-di-dominio)
7. [Contratto API](#7-contratto-api)
8. [Schermate](#8-schermate)
9. [Dati seed (mock)](#9-dati-seed-mock)
10. [Ruoli e ownership](#10-ruoli-e-ownership)
11. [Fasi e milestone](#11-fasi-e-milestone)
12. [Workflow Git e convenzioni](#12-workflow-git-e-convenzioni)
13. [Variabili d'ambiente e deploy](#13-variabili-dambiente-e-deploy)
14. [Demo script](#14-demo-script)
15. [Roadmap post-hackathon](#15-roadmap-post-hackathon)
16. [Glossario](#16-glossario)

---

## 1. Il problema e l'utente

**Felix Field** è un *Agricultural Extension Officer* nel distretto di **Kasungu (Malawi)**. Segue decine di campi di piccoli agricoltori e deve dire loro cosa fare. I tre problemi che ci ha portato:

| # | Problema | Cosa succede oggi | Cosa vogliamo dargli |
|---|---|---|---|
| 1 | **Crop disease diagnostic** | Fatica a riconoscere le malattie delle colture | Alert di malattia per campo, con causa e azioni |
| 2 | **Soil & fertilizer input advisor** | Non è chiaro quale fertilizzante usare e quando | Raccomandazioni su prodotto, dose e finestra temporale |
| 3 | **Produce maturity check** | Il raccolto viene anticipato o ritardato di settimane | Finestra di raccolto prevista e alert quando si sta chiudendo |

**Fonti dati** (nella demo sono simulate): sensori nel suolo, previsioni meteo, foto da drone (NDVI e riconoscimento visivo).

**Vincoli reali che guidano il design:**
- Felix usa un **tablet**, in campo o in ufficio. Progettiamo per il tablet in orizzontale (circa 1180×820), ma l'interfaccia deve restare usabile anche su desktop.
- Gli **agricoltori non hanno smartphone con internet**: solo chiamate e SMS. Per questo in ogni campo c'è un **lampione** che si accende con lo **stesso color code dell'app**. È il canale verso l'agricoltore.
- Felix contatta gli agricoltori **dal suo telefono, fuori dall'app**. L'app mostra nome e numero solo come testo e non ha funzioni di chiamata o SMS.

---

## 2. Cosa costruiamo (scope)

**Nella demo (in scope)**
- Dashboard con 4 statistiche cliccabili (Urgent, Disease, Fertilizer, Maturity) e una mappa satellitare con i campi cliccabili e colorati.
- Pagina lista: i campi che hanno bisogno di intervento per una categoria, ordinati per priorità.
- Pagina dettaglio campo: le azioni da fare in ordine di priorità, i dati di sensori, meteo e drone, la timeline della coltura e lo stato del lampione (simulato).
- Back-end **mockato** (fase 1), poi sostituito da un'**API reale con DB su Azure** (fase 2) senza modificare il front.

**Fuori scope (solo roadmap)**
- Integrazione con sensori, droni e lampioni fisici.
- Generazione automatica delle raccomandazioni: nella demo sono **statiche nei dati seed**.
- Login e utenti multipli, notifiche, SMS automatici, modalità offline.
- Modifica dei dati dall'app. Unica eccezione opzionale: segnare un'azione come fatta, vedi §15.

---

## 3. Architettura: contract-first e mock sostituibile

```
FASE 1 — demo con mock                          FASE 2 — back reale
┌──────────────────────┐                        ┌──────────────────────┐
│ React app (Vercel)   │                        │ React app (Vercel)   │
│  fetch("/api/...")   │                        │  fetch("<API>/api/…")│
└──────────┬───────────┘                        └──────────┬───────────┘
           │ intercettato nel browser                      │ HTTP
┌──────────▼───────────┐                        ┌──────────▼───────────┐     ┌──────────────────────┐
│ MSW (finto server)   │                        │ Express API (Vercel) │────►│ Azure PostgreSQL     │
│ legge seed.json      │                        │ Prisma               │     │ (dati da seed.json)  │
└──────────┬───────────┘                        └──────────┬───────────┘     └──────────────────────┘
           │                                               │
           └──────────────┬────────────────────────────────┘
                          ▼
        packages/shared  →  schemi Zod (contratto) + tipi TS
                            logica di dominio (urgenza, lampione, priorità, statistiche)
                            seed.json (dati demo)
```

**Come funziona, in parole semplici:**
1. **Prima si scrive il contratto.** Il giorno 1 si decide esattamente quali richieste fa il front (`GET /api/stats`, `GET /api/fields`, `GET /api/fields/:id`) e com'è fatta ogni risposta. Il contratto è scritto in codice (schemi **Zod**) dentro `packages/shared`, così front e back lo leggono dalla stessa fonte.
2. **Fase 1, finto server.** Il front fa già le richieste vere. **MSW** (Mock Service Worker) le intercetta nel browser e risponde con i dati di `seed.json`, trasformati dalla logica di `shared`. Il front non sa di parlare con un mock.
3. **Fase 2, server vero.** Si costruisce l'API Express con le **stesse rotte**. I dati vivono in PostgreSQL su Azure e vengono caricati dallo **stesso `seed.json`**. Anche il calcolo di urgenze, colori e statistiche usa la **stessa logica di `shared`**. Il passaggio si fa con `VITE_USE_MOCKS=false`, senza modificare il codice del front.
4. **Rete di sicurezza.** Se l'API reale non è pronta in tempo, la demo funziona comunque sui mock, perché MSW gira anche nel build di produzione.

**Perché questo approccio:** le 5 persone lavorano in parallelo dal giorno 1. Chi fa il front non aspetta il back, chi fa il back sa esattamente cosa deve restituire, e i numeri mostrati sono identici in fase 1 e in fase 2.

---

## 4. Stack tecnologico

| Area | Scelta | Perché |
|---|---|---|
| Repository | **Monorepo con npm workspaces** | Un solo repo, codice condiviso tra front e back senza pubblicare pacchetti |
| Linguaggio | **TypeScript** ovunque | Un solo linguaggio; gli errori di tipo emergono prima del runtime |
| Front: build | **Vite** + **React** | Avvio rapido, molti tutorial |
| Front: routing | **React Router** | Lo standard per le pagine in React |
| Front: dati | **TanStack Query** | Gestisce loading, errori e cache delle chiamate API |
| Front: stile | **Tailwind CSS** | Stili veloci; i colori del dominio sono definiti in un unico punto |
| Front: mappa | **Leaflet** + **react-leaflet**, tile satellitari **Esri World Imagery** | Poligoni cliccabili su immagini satellitari reali, senza chiavi API |
| Mock | **MSW** (Mock Service Worker) | Simula l'API nel browser senza cambiare il codice del front |
| Contratto | **Zod** | Un solo schema da cui derivano i tipi TS, usato anche per validare le risposte |
| Back | **Node.js** + **Express** | Il framework per API più documentato |
| ORM | **Prisma** | Lo schema del DB è un file leggibile; le migrazioni sono versionate in git |
| Database | **Azure Database for PostgreSQL – Flexible Server** | Vedi [`docs/database.md`](docs/database.md) |
| Test | **Vitest** | Test della logica di dominio (urgenza, lampione, priorità, statistiche) |
| Hosting | **Vercel**: front e API come due progetti; DB su **Azure** | Il front è già su Vercel; ogni PR ha una preview |

> Versioni: al setup (#1) si usano le **ultime versioni stabili** di ciascuna libreria, poi bloccate dal `package-lock.json`. Non si aggiornano librerie durante l'hackathon senza motivo.

---

## 5. Struttura del repository

```
Hackathon-BCG/
├── spec.md                         ← questo documento
├── docs/
│   └── database.md                 ← consegna per chi prepara il DB
├── package.json                    ← workspaces + script comuni
├── .env.example                    ← elenco variabili (senza valori segreti)
│
├── packages/
│   └── shared/                     ← "IL CONTRATTO": modifiche solo con review di #1 e #4
│       ├── src/
│       │   ├── schemas.ts          ← Zod: enum, Stats, FieldSummary, FieldDetail, ApiError
│       │   ├── seed-schema.ts      ← Zod: forma di seed.json (stessa forma delle tabelle DB)
│       │   ├── domain/
│       │   │   ├── colors.ts       ← palette e mappature categoria → colore
│       │   │   ├── urgency.ts      ← isUrgent()
│       │   │   ├── lamp.ts         ← getLampColors()
│       │   │   ├── priority.ts     ← compareAlerts(), sortFields(), sortActions()
│       │   │   ├── stats.ts        ← computeStats()
│       │   │   └── build.ts        ← toFieldSummary(), toFieldDetail()
│       │   └── index.ts
│       ├── data/
│       │   └── seed.json           ← dati demo (vedi §9)
│       └── test/                   ← test Vitest della logica di dominio
│
├── apps/
│   ├── web/                        ← front-end React (progetto Vercel "felix-web")
│   │   ├── public/
│   │   │   ├── mockServiceWorker.js
│   │   │   └── drone/              ← immagini drone della demo
│   │   └── src/
│   │       ├── main.tsx            ← avvia MSW se VITE_USE_MOCKS=true, poi monta React
│   │       ├── App.tsx             ← router + layout
│   │       ├── pages/              ← DashboardPage, IssuesPage, FieldPage, NotFoundPage
│   │       ├── components/
│   │       │   ├── map/            ← FieldMap, FieldPolygon, MapLegend, MapFilters
│   │       │   ├── kpi/            ← KpiCard, KpiRow
│   │       │   ├── issues/         ← IssueRow, CropFilter
│   │       │   ├── field/          ← ActionList, SensorPanel, WeatherStrip, DronePanel, CropTimeline, Lamp
│   │       │   └── ui/             ← Card, Badge, SeverityBadge, CategoryIcon, Spinner, ErrorState
│   │       ├── api/
│   │       │   ├── client.ts       ← wrapper di fetch (base URL, errori, validazione Zod)
│   │       │   └── queries.ts      ← useStats(), useFields(), useField()
│   │       └── mocks/
│   │           ├── browser.ts      ← setup MSW
│   │           └── handlers.ts     ← implementazione mock delle 3 rotte
│   │
│   └── api/                        ← back-end Express (progetto Vercel "felix-api") — fase 2
│       ├── src/
│       │   ├── app.ts              ← app Express: CORS, rotte, gestione errori
│       │   ├── server.ts           ← avvio locale (npm run dev:api)
│       │   ├── routes/             ← stats.ts, fields.ts
│       │   └── services/           ← fieldRepository.ts (query Prisma → forma di dominio)
│       └── prisma/
│           ├── schema.prisma       ← schema DB (fonte di verità, vedi docs/database.md)
│           ├── migrations/
│           └── seed.ts             ← carica seed.json nel DB
```

**Regola d'oro:** le pagine e i componenti non chiamano mai `fetch` direttamente, usano solo gli hook di `api/queries.ts`. Quando si passa dal mock all'API reale non cambia nient'altro.

---

## 6. Regole di dominio

Tutte le regole sono implementate **una sola volta** in `packages/shared/src/domain/` e coperte da test.

### 6.1 Categorie e colori

| Categoria | Codice | Colore | Hex | Icona (suggerita) |
|---|---|---|---|---|
| Urgent | (derivata) | Rosso | `#E53935` | triangolo di avviso |
| Disease | `DISEASE` | Viola | `#8E44AD` | foglia con macchia / batterio |
| Fertilizer | `FERTILIZER` | Blu | `#2E86DE` | sacco / beuta |
| Maturity | `MATURITY` | Ambra | `#F5A623` | spiga |
| OK | (nessun alert aperto) | Verde | `#43A047` | spunta |

- Il colore è **sempre accompagnato da un'icona e da un testo**, per l'accessibilità (daltonismo).
- **Il rosso è riservato alle urgenze** e nessun'altra categoria lo usa.

### 6.2 Urgenza (calcolata, mai salvata)

Un alert è **urgente** se è aperto (`status = OPEN`) **e** vale almeno una di queste condizioni:
- `severity = CRITICAL`, oppure
- `dueAt` è entro **72 ore** da "adesso".

Un **campo è urgente** se ha almeno un alert urgente.

> **"Adesso" nella demo è fisso:** `DEMO_NOW = 2027-03-01T05:00:00Z` (07:00 ora del Malawi), la stessa in front, mock e API. Così le urgenze non cambiano a seconda del giorno in cui si fa la demo. In produzione si userà l'ora reale.

### 6.3 Colore del lampione e del campo sulla mappa — `getLampColors(alerts, now)`

| Situazione del campo | Lampione | Poligono sulla mappa |
|---|---|---|
| Almeno un alert urgente | `["RED"]`, **rosso fisso** | Riempimento rosso pieno |
| Un solo tipo di problema aperto | `["PURPLE"]` / `["BLUE"]` / `["AMBER"]`, fisso | Riempimento del colore della categoria |
| Più tipi di problema aperti | Es. `["PURPLE","BLUE"]`: **alterna i colori ogni 1,5 s** | **Strisce** diagonali con i colori delle categorie |
| Nessun alert aperto | `["GREEN"]`, fisso | Riempimento verde |

L'ordine dei colori nell'array è fisso: `DISEASE → FERTILIZER → MATURITY`.

> Implementazione delle strisce in Leaflet: si definiscono dei `<pattern>` SVG nella mappa e si applicano ai poligoni con una classe CSS. Se richiedono troppo tempo, il **fallback** è che anche il poligono alterni i colori come il lampione.

### 6.4 Priorità

**Ordinamento degli alert** (`compareAlerts`): si passa al criterio successivo solo a parità del precedente.
1. Prima gli **urgenti**.
2. Poi per **gravità**: `CRITICAL > HIGH > MEDIUM > LOW`.
3. Poi per **scadenza** più vicina (`dueAt` crescente; se manca la scadenza, l'alert va in fondo).
4. Poi per **categoria**: `DISEASE > MATURITY > FERTILIZER`. Le malattie si diffondono e il raccolto ha finestre rigide, quindi vengono prima.

**Ordinamento dei campi** (`sortFields`): ogni campo prende il suo alert più prioritario e si ordinano i campi confrontando quegli alert con `compareAlerts`.

**Ordinamento delle azioni nel dettaglio** (`sortActions`): prima le azioni non fatte, poi per `priority` crescente (1 = la più importante). La `priority` è scritta nei dati seed.

### 6.5 Statistiche — `computeStats(fields, now)`

| Statistica | Definizione |
|---|---|
| `urgent` | n° di campi con almeno un alert urgente |
| `disease` | n° di campi con almeno un alert `DISEASE` aperto (urgenti inclusi) |
| `fertilizer` | n° di campi con almeno un alert `FERTILIZER` aperto (urgenti inclusi) |
| `maturity` | n° di campi con almeno un alert `MATURITY` aperto (urgenti inclusi) |
| `ok` | n° di campi senza alert aperti |
| `totalFields` | n° totale di campi |

Un campo con più problemi viene contato in più statistiche: le statistiche **non** si sommano al totale.

### 6.6 Test minimi obbligatori (Vitest, owner #4)

| Caso | Atteso |
|---|---|
| Alert `CRITICAL` senza scadenza | urgente |
| Alert `HIGH` con scadenza tra 48 h | urgente |
| Alert `HIGH` con scadenza tra 5 giorni | non urgente |
| Alert `CRITICAL` ma `RESOLVED` | non urgente |
| Campo con un alert DISEASE e uno FERTILIZER | lampione `["PURPLE","BLUE"]` |
| Campo con un alert MATURITY urgente e uno DISEASE | lampione `["RED"]` |
| Campo senza alert aperti | lampione `["GREEN"]` |
| `computeStats` su `seed.json` | i numeri attesi del §9.3 |

---

## 7. Contratto API

- Base path: `/api`. Tutte le risposte sono in JSON e le date in ISO 8601 UTC.
- Nomi delle chiavi in **camelCase**.
- I valori di categoria **nell'URL e nei parametri di query** sono minuscoli (`urgent`, `disease`, `fertilizer`, `maturity`); **nei dati** sono maiuscoli (`DISEASE`, ...).
- Ogni risposta è validata con lo schema Zod corrispondente di `packages/shared/src/schemas.ts`, nei mock come nell'API reale.

### 7.1 Tipi comuni

```ts
type Category    = "DISEASE" | "FERTILIZER" | "MATURITY";
type Severity    = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type AlertSource = "SENSOR" | "DRONE" | "WEATHER" | "MANUAL";
type LampColor   = "RED" | "PURPLE" | "BLUE" | "AMBER" | "GREEN";
type CropCode    = "MAIZE" | "SOYBEAN" | "BEANS" | "TOBACCO" | "GROUNDNUT";
type GrowthStage = "EMERGENCE" | "VEGETATIVE" | "FLOWERING" | "FRUITING" | "MATURITY";

type AlertDto = {
  id: string;
  category: Category;
  severity: Severity;
  title: string;          // "Fall armyworm outbreak"
  description: string;    // spiegazione breve per Felix
  source: AlertSource;
  detectedAt: string;     // ISO
  dueAt: string | null;   // entro quando agire
  isUrgent: boolean;      // calcolato (§6.2)
};
```

### 7.2 `GET /api/stats`

Restituisce i numeri delle 4 statistiche della dashboard.

```json
{
  "urgent": 3,
  "disease": 6,
  "fertilizer": 5,
  "maturity": 4,
  "ok": 7,
  "totalFields": 20,
  "asOf": "2027-03-01T05:00:00Z"
}
```

### 7.3 `GET /api/fields?category=&crop=`

Restituisce la lista dei campi già **ordinata per priorità** (§6.4). Si usa sia per la mappa sia per le liste.

| Parametro | Valori | Default | Effetto |
|---|---|---|---|
| `category` | `urgent` \| `disease` \| `fertilizer` \| `maturity` | nessuno (tutti i campi) | Solo i campi con almeno un alert aperto di quella categoria (o urgente) |
| `crop` | `MAIZE` \| `SOYBEAN` \| `BEANS` \| `TOBACCO` \| `GROUNDNUT` | nessuno | Solo i campi con quella coltura attiva |

```json
[
  {
    "id": "fld_003",
    "code": "KSG-003",
    "name": "Chilanga North",
    "crop": { "code": "GROUNDNUT", "name": "Groundnut" },
    "areaHa": 2.4,
    "farmerName": "Grace Banda",
    "village": "Chilanga",
    "boundary": {
      "type": "Polygon",
      "coordinates": [[[33.471, -13.018], [33.475, -13.018], [33.475, -13.022], [33.471, -13.022], [33.471, -13.018]]]
    },
    "centroid": { "lat": -13.020, "lng": 33.473 },
    "categories": ["MATURITY"],
    "isUrgent": true,
    "lampColors": ["RED"],
    "openAlertsCount": 1,
    "topAlert": {
      "id": "alr_003a",
      "category": "MATURITY",
      "severity": "CRITICAL",
      "title": "Harvest now: heavy rain in 48h",
      "dueAt": "2027-03-03T00:00:00Z",
      "isUrgent": true
    }
  }
]
```

Note:
- `topAlert` è `null` se il campo non ha alert aperti.
- `boundary` è un **GeoJSON Polygon** e le coordinate sono `[lng, lat]`. Attenzione: Leaflet usa invece `[lat, lng]`, quindi la conversione va fatta nel componente mappa.
- Un `category` non valido restituisce **400**.

### 7.4 `GET /api/fields/:id`

Restituisce tutto ciò che serve alla pagina di dettaglio: i campi di `FieldSummary`, più quelli elencati qui sotto.

```json
{
  "...": "tutti i campi di FieldSummary",
  "farmer": { "name": "Grace Banda", "phone": "+265 991 234 567", "village": "Chilanga" },
  "planting": {
    "crop": { "code": "GROUNDNUT", "name": "Groundnut" },
    "plantedAt": "2026-11-28",
    "expectedHarvestStart": "2027-02-25",
    "expectedHarvestEnd": "2027-03-08",
    "growthStage": "MATURITY"
  },
  "alerts": [ { "id": "alr_003a", "category": "MATURITY", "severity": "CRITICAL", "title": "...", "description": "...", "source": "WEATHER", "detectedAt": "...", "dueAt": "...", "isUrgent": true } ],
  "actions": [
    {
      "id": "act_003a1",
      "alertId": "alr_003a",
      "priority": 1,
      "title": "Lift groundnuts within 48 hours",
      "why": "Pods are mature (inner shell dark) and 45 mm of rain is forecast on 3 March. Wet pods left in the soil develop aflatoxin.",
      "dueAt": "2027-03-03T00:00:00Z",
      "category": "MATURITY",
      "source": "WEATHER",
      "done": false
    }
  ],
  "latestSensorReading": {
    "measuredAt": "2027-03-01T04:00:00Z",
    "soilMoisturePct": 31, "soilTempC": 23.5, "ph": 5.8,
    "nPpm": 18, "pPpm": 12, "kPpm": 95
  },
  "weather": [
    { "date": "2027-03-01", "tempMinC": 17, "tempMaxC": 27, "rainMm": 2,  "rainProbPct": 30, "humidityPct": 70 },
    { "date": "2027-03-02", "tempMinC": 18, "tempMaxC": 26, "rainMm": 8,  "rainProbPct": 60, "humidityPct": 78 },
    { "date": "2027-03-03", "tempMinC": 18, "tempMaxC": 24, "rainMm": 45, "rainProbPct": 90, "humidityPct": 92 },
    { "date": "2027-03-04", "tempMinC": 17, "tempMaxC": 25, "rainMm": 20, "rainProbPct": 75, "humidityPct": 88 },
    { "date": "2027-03-05", "tempMinC": 17, "tempMaxC": 27, "rainMm": 3,  "rainProbPct": 35, "humidityPct": 72 }
  ],
  "latestDroneCapture": {
    "capturedAt": "2027-02-27T09:30:00Z",
    "imageUrl": "/drone/ksg-003.jpg",
    "ndviMean": 0.41,
    "findings": "Canopy senescence across 80% of the field, consistent with maturity."
  }
}
```

- `actions` è già ordinato (§6.4). `latestSensorReading` e `latestDroneCapture` possono essere `null`.
- `weather` contiene sempre 5 giorni, a partire da "adesso".
- Se l'id non esiste, la risposta è **404**: `{ "error": "FIELD_NOT_FOUND", "message": "Field fld_999 not found" }`.

### 7.5 Errori

Formato unico per tutti gli errori: `{ "error": "<CODICE>", "message": "<testo leggibile>" }`.

| Status | Codice | Quando |
|---|---|---|
| 400 | `INVALID_QUERY` | `category` o `crop` non validi |
| 404 | `FIELD_NOT_FOUND` | id del campo inesistente |
| 500 | `INTERNAL_ERROR` | qualsiasi altro errore |

### 7.6 Regola di congelamento

Il contratto si **congela alla fine della Fase 0**. Dopo, ogni modifica:
1. si propone in una PR che tocca `packages/shared/src/schemas.ts`;
2. deve essere approvata da **#1 e #4**;
3. aggiorna nella stessa PR gli handler MSW e, se esiste già, l'API reale.

---

## 8. Schermate

Rotte del front:

| Rotta | Pagina | Dati |
|---|---|---|
| `/` | Dashboard | `useStats()`, `useFields()` |
| `/issues/:category` | Lista per categoria (`urgent` \| `disease` \| `fertilizer` \| `maturity`) | `useFields({ category, crop })` |
| `/fields/:id` | Dettaglio campo | `useField(id)` |
| `*` | Not found | — |

Ogni pagina gestisce tre stati: **loading** (skeleton o spinner), **errore** (messaggio + pulsante "Retry"), **vuoto** (es. "No fields need attention 🎉").

### 8.1 Dashboard `/`

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  FELIX FIELD · Kasungu District                    Mon 1 Mar 2027 · 27°C · 2 mm    │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────┤
│ ▲ URGENT        3 │ ● DISEASE       6 │ ● FERTILIZER    5 │ ● MATURITY           4 │
│ act within 72h    │ fields affected   │ fields affected   │ fields affected        │
│ (rosso)           │ (viola)           │ (blu)             │ (ambra)                │
├───────────────────┴───────────────────┴───────────────────┴──┬─────────────────────┤
│                                                              │ TODAY'S PRIORITIES  │
│                                                              │                     │
│              MAPPA SATELLITARE (Kasungu)                     │ 1 ▲ KSG-001 Maize   │
│                                                              │   Fall armyworm     │
│      ▓▓ KSG-001        ░░ KSG-007 (strisce)                  │ 2 ▲ KSG-003 G.nut   │
│               ██ KSG-003                                     │   Harvest now       │
│                         ▒▒ KSG-012                           │ 3 ▲ KSG-002 Maize   │
│                                                              │   Top-dress urea    │
│  ┌ Legend ─────────────────────────────┐                     │ 4 ● KSG-004 ...     │
│  │ ■ Urgent ■ Disease ■ Fertilizer     │                     │ 5 ● ...             │
│  │ ■ Maturity ■ OK  ▨ Multiple issues  │                     │                     │
│  └─────────────────────────────────────┘                     │ [See all →]         │
│  Filters: [✓]Disease [✓]Fertilizer [✓]Maturity [✓]OK         │                     │
└──────────────────────────────────────────────────────────────┴─────────────────────┘
```

**Comportamento**
- **KPI card**: mostrano numero, etichetta e colore della categoria. Il tap porta a `/issues/<category>`. Ordine fisso: Urgent, Disease, Fertilizer, Maturity.
- **Mappa**:
  - si apre centrata su Kasungu (circa `-13.03, 33.48`), con zoom sui campi (`fitBounds`);
  - ogni poligono è colorato secondo il §6.3;
  - al tap su un poligono si apre un **popup** con codice, nome, coltura, alert principale e il pulsante **"Open field"**, che porta a `/fields/:id`.
- **Filtri**: nascondono o mostrano i poligoni per categoria. Il filtro è solo lato client e non fa nuove chiamate.
- **Today's priorities**: i primi 5 campi della lista ordinata. Il tap apre il dettaglio del campo.

**Done quando:** i numeri delle KPI coincidono con `GET /api/stats`; ogni poligono ha il colore giusto; il tap su KPI, poligono e priorità porta alla pagina giusta.

### 8.2 Lista per categoria `/issues/:category`

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ ← Dashboard        ● DISEASE · 6 fields need attention          Crop: [All     ▾]  │
├──────────────────────────────────────────────────────────┬─────────────────────────┤
│ ▲ KSG-001 · Kaluluma West · Maize · 3.1 ha               │                         │
│   Fall armyworm outbreak · CRITICAL · source: Drone      │     MINI-MAPPA          │
│   Due: today                                    [ ⦿ ]    │   (solo i campi della   │
├──────────────────────────────────────────────────────────┤    lista; il campo      │
│ ● KSG-004 · Santhe South · Maize · 1.8 ha                │    selezionato è        │
│   Grey leaf spot · HIGH · source: Drone                  │    evidenziato)         │
│   Due: 6 Mar                                    [ ⦿ ]    │                         │
├──────────────────────────────────────────────────────────┤                         │
│ ▨ KSG-005 · Chamama · Tobacco · 2.2 ha   +1 issue        │                         │
│   Black shank · MEDIUM · source: Sensor                  │                         │
│   Due: 9 Mar                                    [ ⦿ ]    │                         │
└──────────────────────────────────────────────────────────┴─────────────────────────┘
```

**Comportamento**
- Mostra le righe nell'ordine restituito dall'API (già ordinate per priorità).
- Ogni riga mostra:
  - un indicatore lampione in miniatura, con gli stessi colori del §6.3;
  - codice, nome, coltura ed ettari;
  - l'alert principale **della categoria della pagina**;
  - gravità, fonte e scadenza (in forma relativa: "today", "in 2 days");
  - un badge "+N issues" se il campo ha altri problemi.
- Il tap su una riga apre `/fields/:id`. Passando sopra una riga (o selezionandola) il campo si evidenzia nella mini-mappa.
- Il filtro coltura aggiorna l'URL (`?crop=MAIZE`), così la vista si può condividere.
- Nella pagina `urgent`, l'header è rosso e ogni riga mostra la categoria dell'alert urgente.

**Done quando:** il numero di righe è uguale al numero della KPI corrispondente; l'ordinamento rispetta il §6.4; il filtro coltura funziona.

### 8.3 Dettaglio campo `/fields/:id`

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ ← Back     KSG-003 · Chilanga North                                 LAMP  ( ● )    │
│            Groundnut · 2.4 ha · Chilanga                            rosso fisso    │
│            Farmer: Grace Banda · +265 991 234 567                                  │
├────────────────────────────────────────────────────────────────────────────────────┤
│ CROP TIMELINE   planted 28 Nov ──── flowering ──── pod fill ────●[harvest 25 Feb–8 Mar]│
│                                                              today                 │
├──────────────────────────────────────────────────────┬─────────────────────────────┤
│ WHAT TO DO (by priority)                             │ SOIL SENSORS  (1 Mar 06:00) │
│                                                      │ Moisture 31%   Temp 23.5°C  │
│ 1 ▲ Lift groundnuts within 48 hours     due 3 Mar    │ pH 5.8                      │
│     Why: pods are mature and 45 mm of rain is        │ N 18  P 12  K 95 ppm        │
│     forecast on 3 Mar → aflatoxin risk.              ├─────────────────────────────┤
│     Source: Weather + Drone                          │ WEATHER (5 days)            │
│                                                      │ Mon Tue Wed Thu Fri         │
│ 2 ● Dry pods on racks/tarpaulin, not on bare soil    │ 2mm 8mm 45mm 20mm 3mm       │
│     Why: ...                                         ├─────────────────────────────┤
│                                                      │ DRONE (27 Feb)              │
│ 3 ● ...                                              │ [ immagine ]  NDVI 0.41     │
│                                                      │ Canopy senescence 80%       │
└──────────────────────────────────────────────────────┴─────────────────────────────┘
```

**Comportamento**
- **Lampione** (componente `Lamp`): simula il lampione fisico. È un cerchio luminoso con un effetto glow e, sotto, la scritta che spiega lo stato ("Red — urgent action needed"). Con più colori li alterna ogni 1,5 s, tramite un'animazione CSS.
- **Azioni**: lista numerata in ordine di priorità (§6.4). Ogni azione mostra:
  - titolo, **perché** e scadenza;
  - fonte del dato (Sensor, Drone, Weather);
  - icona della categoria (se l'alert è urgente, il bordo è rosso).
- **Timeline della coltura**: data di semina, fase attuale e finestra di raccolto prevista, con il marker "today".
- **Sensori, meteo, drone**: mostrano i dati più recenti. Se un dato manca, compare "No data".
- Nome e telefono dell'agricoltore compaiono **solo come testo**: niente pulsanti di chiamata o SMS.

**Done quando:** tutte le sezioni mostrano i dati del campo; il lampione corrisponde al colore del poligono sulla mappa; un id inesistente mostra la pagina "Field not found".

### 8.4 Linee guida UI (tablet)
- Le aree toccabili sono di almeno **44×44 px**; il testo base è di **16 px**.
- Contrasto alto: l'app si usa anche all'aperto. Si parte con il tema chiaro.
- I colori del dominio si importano da `shared/domain/colors.ts` e si espongono come token Tailwind (`bg-disease`, `bg-urgent`, ...). Gli hex non si scrivono a mano nei componenti.

---

## 9. Dati seed (mock)

### 9.1 Forma del file
`packages/shared/data/seed.json` ha **la stessa forma delle tabelle del DB** (vedi [`docs/database.md`](docs/database.md)): una lista per ogni tabella, con chiavi in camelCase e id leggibili. Così i mock e il DB partono dagli stessi dati.

```json
{
  "demoNow": "2027-03-01T05:00:00Z",
  "farmers":          [ { "id": "frm_001", "name": "Grace Banda", "phone": "+265 991 234 567", "village": "Chilanga" } ],
  "crops":            [ { "id": "crp_groundnut", "code": "GROUNDNUT", "name": "Groundnut", "cycleDays": 120 } ],
  "fields":           [ { "id": "fld_003", "code": "KSG-003", "name": "Chilanga North", "farmerId": "frm_001", "areaHa": 2.4, "boundary": { "type": "Polygon", "coordinates": [] }, "centroidLat": -13.02, "centroidLng": 33.473 } ],
  "plantings":        [ { "id": "pln_003", "fieldId": "fld_003", "cropId": "crp_groundnut", "plantedAt": "2026-11-28", "expectedHarvestStart": "2027-02-25", "expectedHarvestEnd": "2027-03-08", "growthStage": "MATURITY", "status": "ACTIVE" } ],
  "alerts":           [ { "id": "alr_003a", "fieldId": "fld_003", "plantingId": "pln_003", "category": "MATURITY", "severity": "CRITICAL", "title": "...", "description": "...", "source": "WEATHER", "detectedAt": "...", "dueAt": "...", "status": "OPEN", "resolvedAt": null } ],
  "actions":          [ { "id": "act_003a1", "alertId": "alr_003a", "fieldId": "fld_003", "priority": 1, "title": "...", "why": "...", "dueAt": "...", "done": false, "doneAt": null } ],
  "sensorReadings":   [ ],
  "weatherForecasts": [ ],
  "droneCaptures":    [ ]
}
```

`seed-schema.ts` valida il file: un test Vitest fallisce se `seed.json` è malformato.

### 9.2 Come si producono i dati (flusso #5 → #4)
1. **#5** compila un **foglio condiviso** (Google Sheets) con una riga per campo e per alert/azione, usando la tabella del §9.4 come base. Il testo va scritto in inglese semplice, come lo direbbe un agronomo a Felix.
2. **#5** disegna i poligoni su [geojson.io](https://geojson.io) sopra terreni agricoli veri intorno a Kasungu (circa `-13.03, 33.48`), con campi da 0,5 a 5 ha, ed esporta il GeoJSON.
3. **#4** converte foglio + GeoJSON in `seed.json` (anche a mano o con un piccolo script) e verifica che i test passino.

### 9.3 Scenario della demo (20 campi)

Data della demo: **1 marzo 2027**, piena stagione delle piogge. È un momento in cui i tre problemi sono plausibili insieme.

| Campo | Coltura | Scenario | Categorie | Urgente |
|---|---|---|---|---|
| KSG-001 | Maize | Focolaio di fall armyworm nel 30% delle piante (drone) | DISEASE (CRITICAL) | ✅ |
| KSG-002 | Maize | Carenza di azoto, finestra per l'urea in copertura che si chiude; pioggia forte domani dilaverebbe il fertilizzante dopo | FERTILIZER (HIGH, scadenza 48 h) | ✅ |
| KSG-003 | Groundnut | Baccelli maturi + 45 mm di pioggia tra 48 h → rischio aflatossine | MATURITY (CRITICAL) | ✅ |
| KSG-004 | Maize | Grey leaf spot | DISEASE (HIGH) | |
| KSG-005 | Tobacco | Black shank + carenza di potassio | DISEASE + FERTILIZER | |
| KSG-006 | Soybean | Primi sintomi di ruggine della soia | DISEASE (MEDIUM) | |
| KSG-007 | Beans | Angular leaf spot + maturità in arrivo | DISEASE + MATURITY | |
| KSG-008 | Maize | pH basso (5,0): calce consigliata prima della prossima stagione | FERTILIZER (LOW) | |
| KSG-009 | Soybean | Carenza di fosforo | FERTILIZER (MEDIUM) | |
| KSG-010 | Tobacco | Foglie basse mature: iniziare la raccolta (priming) | MATURITY (MEDIUM) | |
| KSG-011 | Groundnut | Groundnut rosette virus (afidi) | DISEASE (HIGH) | |
| KSG-012 | Soybean | Stadio R7, finestra di raccolto tra circa 10 giorni, rischio deiscenza dei baccelli | MATURITY (LOW) | |
| KSG-013 | Maize | Seconda copertura con urea tra 5 giorni | FERTILIZER (MEDIUM) | |
| KSG-014 … KSG-020 | Mix delle 5 colture | Nessun problema | — | |

**Numeri attesi** (usati nei test e nella demo): `urgent 3 · disease 6 · fertilizer 5 · maturity 4 · ok 7 · totalFields 20`.

Ogni campo con alert ha **2–4 azioni**. Ogni campo ha almeno 1 lettura dei sensori, 5 giorni di meteo e (non tutti) una cattura del drone.

### 9.4 Problemi realistici per coltura (base per i contenuti)

| Coltura | Malattie / parassiti | Fertilizzazione | Maturità e raccolto |
|---|---|---|---|
| **Maize** | Fall armyworm, grey leaf spot, maize streak virus | Fondo NPK 23:21:0+4S alla semina; **urea in copertura** a 3–4 settimane (altezza ginocchio) | Black layer sulla granella; raccolta con umidità ~20–25% |
| **Soybean** | Ruggine della soia, frogeye leaf spot | Inoculo (rizobi) alla semina, fosforo | Stadio R8 (95% dei baccelli maturi); raccogliere presto per evitare la deiscenza |
| **Beans** | Angular leaf spot, antracnosi, bean stem maggot | Fosforo alla semina | Baccelli secchi, foglie gialle; raccogliere prima della pioggia (marciume del seme) |
| **Tobacco** | Black shank, frogeye, mosaico (TMV) | Concime composto specifico per tabacco, potassio | Maturazione delle foglie dal basso: priming progressivo |
| **Groundnut** | Rosette virus (afidi), early/late leaf spot | Gesso (calcio) alla fioritura | Guscio interno scuro; raccolta tardiva + pioggia = **aflatossine** |

> I contenuti vanno resi credibili (#5) usando fonti come la *Guide to Agricultural Production and Natural Resources Management in Malawi*. Restano comunque **dati dimostrativi**.

---

## 10. Ruoli e ownership

Ogni persona ha un'**area di proprietà**: decide e fa la review su quell'area, e da lì parte dal giorno 1 senza aspettare nessuno.

### #1 — Tech lead + Front core (Diana)
**Possiede:** `apps/web` (struttura, routing, layout), `apps/web/src/api/`, la configurazione di Tailwind e dei token, la configurazione di Vercel.
- **Fase 0:**
  - creare il monorepo (workspaces, TypeScript, lint/format);
  - creare l'app Vite + React con React Router, Tailwind, TanStack Query e MSW, con una rotta di esempio funzionante;
  - collegare il progetto Vercel esistente a `apps/web` (Root Directory);
  - scrivere il contratto (§7) insieme a #4.
- **Fase 1:** layout e header, `client.ts` e `queries.ts`, componenti `ui/`, pagina Not found, review delle PR.
- **Fase 2:** passaggio a `VITE_USE_MOCKS=false`, configurazione delle env Vercel, verifica end-to-end.

### #2 — Front: mappa e dashboard
**Possiede:** `components/map/`, `components/kpi/`, `pages/DashboardPage.tsx`.
- **Fase 1:**
  - `FieldMap` con tile Esri, poligoni colorati, strisce per i campi con più problemi, popup con "Open field";
  - `MapLegend` e `MapFilters`;
  - `KpiRow` e `KpiCard`;
  - pannello "Today's priorities".
- **Primo task del giorno 1:** mappa centrata su Kasungu con 2 poligoni finti presi da `seed.json`.
- **Fase 2/3:** rifinitura visiva, animazioni, prove su tablet reale.

### #3 — Front: liste e dettaglio
**Possiede:** `components/issues/`, `components/field/`, `pages/IssuesPage.tsx`, `pages/FieldPage.tsx`.
- **Fase 1:**
  - pagina Lista con filtro coltura e mini-mappa (riusa `FieldMap` di #2);
  - pagina Dettaglio con `Lamp`, `ActionList`, `CropTimeline`, `SensorPanel`, `WeatherStrip`, `DronePanel`.
- **Primo task del giorno 1:** il componente `Lamp` (solo CSS) e `ActionList` con dati scritti a mano.
- **Fase 2/3:** stati di loading, errore e vuoto; rifinitura.

### #4 — Data, back-end e owner del DB
**Possiede:** `packages/shared`, `apps/web/src/mocks/`, `apps/api`, il database Azure.
- **Fase 0:**
  - scrivere il contratto (§7) con #1, come schemi Zod;
  - avviare il provisioning Azure seguendo [`docs/database.md`](docs/database.md).
- **Fase 1:**
  - logica di dominio (§6) con test Vitest;
  - `seed-schema.ts`;
  - handler MSW;
  - conversione dei contenuti di #5 in `seed.json`.
- **Fase 2:**
  - API Express, `schema.prisma`, migrazioni e seed su Azure;
  - deploy dell'API come secondo progetto Vercel;
  - verifica che i numeri dell'API reale siano uguali a quelli dei mock.

### #5 — Prodotto, contenuti e pitch
**Possiede:** contenuti agronomici, foglio dati, poligoni, presentazione.
- **Fase 1:**
  - foglio con 20 campi, alert e azioni (§9.3–9.4);
  - poligoni su geojson.io;
  - test di usabilità: chiedere a 2–3 persone esterne di completare i 3 flussi e annotare dove si bloccano.
- **Primo task del giorno 1:** i 3 campi urgenti scritti per intero (alert + azioni + "why"), perché sono il cuore della demo.
- **Fase 2/3:**
  - business case: impatto (resa salvata, perdite da aflatossine evitate), costo del lampione e dei sensori per campo, scalabilità su più officer e distretti;
  - slide, demo script (§14), preparazione delle domande della giuria.

### Matrice delle dipendenze

| Chi | Ha bisogno di | Da chi | Quando |
|---|---|---|---|
| #2, #3 | Tipi e hook (`useFields`, `useField`, `useStats`) | #1, #4 | Fine Fase 0 |
| #2, #3 | Mock funzionanti con qualche campo | #4 | Inizio Fase 1 (bastano 3 campi) |
| #4 | Contenuti + poligoni | #5 | Metà Fase 1 (i 3 urgenti subito) |
| #1 | API reale deployata | #4 | Fase 2 |
| #5 | App stabile per le prove | tutti | Fase 3 |

---

## 11. Fasi e milestone

| Fase | Obiettivo | Done quando |
|---|---|---|
| **0 — Setup** (mezza giornata, tutti) | Tutti hanno letto lo spec; contratto congelato; repo pronto | Ognuno ha l'app avviata in locale e vede una rotta mock rispondere; il contratto è mergiato su `main` |
| **1 — Front su mock** | Le 3 schermate funzionano con `seed.json` completo | Demo cliccabile end-to-end **deployata su Vercel**; test della logica di dominio verdi |
| **2 — Back reale** | API Express + Azure PostgreSQL al posto di MSW | Con `VITE_USE_MOCKS=false` le schermate e i numeri sono **identici** alla Fase 1 |
| **3 — Rifinitura e prove** | Demo solida | Demo provata almeno 3 volte con il timer; piano B pronto (mock attivi) |

**Piano B:** se a metà della Fase 2 l'API non è stabile, si presenta con `VITE_USE_MOCKS=true`. Nella pitch l'architettura con il DB si mostra come slide.

---

## 12. Workflow Git e convenzioni

- **Branch:** `main` è protetto e sempre deployabile. Si lavora su branch `feat/<cosa>`, `fix/<cosa>`, `docs/<cosa>` (es. `feat/field-map-polygons`).
- **Pull Request:**
  - si fanno PR piccole, al massimo un componente o una feature ciascuna;
  - serve **almeno 1 review** prima del merge;
  - Vercel crea una **preview** per ogni PR, da allegare nella descrizione con uno screenshot;
  - per toccare `packages/shared` o `schema.prisma` serve la review di **#1 e #4**.
- **Commit:** messaggi in inglese all'imperativo (`Add lamp component`, `Fix KPI count`).
- **Codice:**
  - nomi in inglese;
  - componenti in `PascalCase.tsx`, un componente per file;
  - gli hook iniziano con `use`;
  - niente colori hex nei componenti, solo token;
  - niente `fetch` fuori da `api/`.
- **Prima di aprire una PR:** eseguire `npm run lint`, `npm run typecheck` e `npm test`.

Script previsti nel `package.json` di root:

| Script | Cosa fa |
|---|---|
| `npm run dev` | Avvia il front (con MSW se `VITE_USE_MOCKS=true`) |
| `npm run dev:api` | Avvia l'API in locale |
| `npm test` | Test Vitest (shared) |
| `npm run lint` / `npm run typecheck` | Controlli di qualità |
| `npm run db:generate` | Genera il client Prisma (**tutti**) |
| `npm run db:migrate` | Crea e applica una migrazione (**solo #4**) |
| `npm run db:seed` | Ricarica i dati demo nel DB (**solo #4**) |
| `npm run db:studio` | Interfaccia grafica per esplorare il DB |

---

## 13. Variabili d'ambiente e deploy

Il file `.env.example` (committato) elenca le variabili; i valori veri stanno nei `.env` locali (**mai committati**) e nelle impostazioni di Vercel. I segreti si condividono con un password manager, mai in chat.

| Variabile | Dove | Esempio | Note |
|---|---|---|---|
| `VITE_USE_MOCKS` | web | `true` | `true` = MSW attivo (fase 1 e piano B) |
| `VITE_API_BASE_URL` | web | `https://felix-api.vercel.app` | Usata solo se `VITE_USE_MOCKS=false` |
| `VITE_DEMO_NOW` | web | `2027-03-01T05:00:00Z` | "Adesso" della demo |
| `DEMO_NOW` | api | `2027-03-01T05:00:00Z` | Deve essere uguale a `VITE_DEMO_NOW` |
| `CORS_ORIGIN` | api | `https://felix-web.vercel.app` | Dominio del front autorizzato |
| `DATABASE_URL` | api | vedi `docs/database.md` | Connessione dell'app |
| `DIRECT_URL` | api | vedi `docs/database.md` | Connessione per le migrazioni |
| `SHADOW_DATABASE_URL` | solo #4 in locale | vedi `docs/database.md` | DB d'appoggio per `prisma migrate dev` |

**Deploy su Vercel**

Ci sono due progetti, collegati allo stesso repo GitHub:

| Progetto | Root Directory | Cosa contiene |
|---|---|---|
| `felix-web` (già esistente) | `apps/web` | Il front |
| `felix-api` (nuovo, fase 2) | `apps/api` | L'API. Vercel supporta Express esportando l'app da un entry point |

- Si imposta la **region delle funzioni** dell'API vicino a quella del DB (vedi `docs/database.md`), per ridurre la latenza.
- MSW in produzione: `mockServiceWorker.js` sta in `apps/web/public/` e `main.tsx` lo avvia quando `VITE_USE_MOCKS=true`, anche nel build di produzione.

---

## 14. Demo script (circa 2 minuti)

1. **Contesto (15 s):** "Felix segue più di 20 campi a Kasungu. Oggi scopre i problemi quando è troppo tardi."
2. **Dashboard (20 s):** si vede la mappa satellitare dei campi colorati, con 3 campi urgenti in rosso. "In un colpo d'occhio Felix sa dove andare oggi."
3. **Tap su "Urgent" (15 s):** la lista mostra i 3 campi, ordinati per priorità.
4. **Tap su KSG-003, arachidi (40 s):** il lampione è rosso. L'azione n° 1 dice di raccogliere entro 48 h, perché sono previsti 45 mm di pioggia e c'è rischio aflatossine. Si vedono le prove: meteo, drone, timeline della coltura.
5. **Il lampione (15 s):** "Grace non ha uno smartphone, ma vede il lampione rosso dal suo campo: sa che deve chiamare Felix o che Felix sta arrivando."
6. **Un campo a strisce (15 s):** KSG-005, tabacco, ha due problemi e il lampione alterna viola e blu.
7. **Chiusura (20 s):** impatto, costi e scalabilità (slide di #5).

---

## 15. Roadmap post-hackathon

- **Dati reali:**
  - sensori IoT (umidità, NPK, pH) via LoRaWAN o GSM;
  - API meteo (es. Open-Meteo);
  - pipeline per i droni: NDVI e un modello di computer vision per le malattie.
- **Motore di raccomandazione:** regole agronomiche, poi modelli predittivi, che generano alert e azioni al posto dei dati statici.
- **Controller dei lampioni:** il back invia lo stato (`lamps.current_colors`) al dispositivo via GSM o LoRa.
- **SMS automatici** agli agricoltori (es. gateway Africa's Talking) in inglese e chichewa.
- **"Mark as done"** sulle azioni (`PATCH /api/actions/:id`), con lo storico degli interventi.
- **PWA offline** per le zone senza copertura; login per più extension officer e più distretti.

---

## 16. Glossario

| Termine | Significato |
|---|---|
| **API** | L'insieme delle "richieste" che il front può fare al back (es. "dammi la lista dei campi") |
| **Contratto** | La definizione esatta di richieste e risposte, concordata prima di scrivere il codice |
| **Mock / MSW** | Un finto server che risponde con dati preparati, così il front si sviluppa senza il back vero |
| **Seed** | I dati iniziali di esempio (`seed.json`), caricati nei mock e nel DB |
| **Zod** | Libreria che descrive la forma dei dati e controlla che i dati la rispettino |
| **ORM / Prisma** | Strumento che permette di leggere e scrivere il DB con codice TypeScript invece che con SQL a mano |
| **Migrazione** | Un file che descrive una modifica alla struttura del DB (es. "aggiungi la tabella alerts"), applicato in ordine |
| **GeoJSON** | Formato standard per descrivere forme geografiche (i confini dei campi) |
| **NDVI** | Indice di "verde" della vegetazione calcolato dalle immagini del drone: basso = pianta stressata o secca |
| **Preview deploy** | La versione temporanea del sito che Vercel crea per ogni PR |
