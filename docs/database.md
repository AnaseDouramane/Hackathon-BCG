# Felix Field — Database (consegna per chi prepara il DB)

> **Per chi è:** l'owner del DB (ruolo **#4** in [`spec.md`](../spec.md#10-ruoli-e-ownership)) e chiunque debba capire come sono salvati i dati.
> **Cosa trovi:** cosa creare su Azure, le tabelle con le colonne, lo schema Prisma pronto da copiare, come caricare i dati, le regole per non rompere il DB condiviso e come verificare che tutto funzioni.

---

## Indice
1. [Panoramica](#1-panoramica)
2. [Diagramma delle tabelle](#2-diagramma-delle-tabelle)
3. [Dizionario dati](#3-dizionario-dati)
4. [Cosa NON si salva (valori calcolati)](#4-cosa-non-si-salva-valori-calcolati)
5. [Da schermata a colonna: mappa UI → API → DB](#5-da-schermata-a-colonna)
6. [Schema Prisma](#6-schema-prisma)
7. [Provisioning su Azure, passo per passo](#7-provisioning-su-azure-passo-per-passo)
8. [Connection string e variabili d'ambiente](#8-connection-string-e-variabili-dambiente)
9. [Migrazioni e seed](#9-migrazioni-e-seed)
10. [Regole per il DB condiviso](#10-regole-per-il-db-condiviso)
11. [Definition of done](#11-definition-of-done)
12. [Problemi frequenti](#12-problemi-frequenti)

---

## 1. Panoramica

| Voce | Scelta |
|---|---|
| Servizio | **Azure Database for PostgreSQL – Flexible Server** |
| Versione | PostgreSQL **16** |
| Tier | **Burstable B1ms** (1 vCore, 2 GB RAM): sufficiente per la demo |
| Database | `felix_dev` (condiviso dal team), `felix_prod` (usato dalla demo deployata), `felix_shadow` (d'appoggio per le migrazioni) |
| Accesso dal codice | **Prisma**, solo da `lib/data/prisma-repository.ts` nell'app **Next.js**, deployata su **Vercel** (un solo progetto) |
| Quando si usa | Con `DATA_SOURCE=db`. Con `DATA_SOURCE=memory` (fase 1) l'app legge `seed.json` e il DB non serve |
| Fonte di verità dello schema | `prisma/schema.prisma` + le migrazioni in `prisma/migrations/` (in git) |
| Dati iniziali | `data/seed.json`, lo **stesso file** letto dall'archivio in memoria (`MemoryRepository`) |

**Principio:** il DB salva solo **fatti** (campi, colture, alert, azioni, letture). Tutto ciò che è una **regola** (urgenza, colore del lampione, priorità, statistiche, etichetta di confidenza) si calcola in `lib/domain/`. Così memoria e DB danno sempre gli stessi risultati.

---

## 2. Diagramma delle tabelle

```mermaid
erDiagram
    farmers ||--o{ fields : "possiede"
    fields  ||--o{ plantings : "ha (stagioni)"
    crops   ||--o{ plantings : "coltura di"
    fields  ||--o{ alerts : "ha"
    plantings |o--o{ alerts : "riguarda"
    alerts  ||--o{ actions : "si risolve con"
    fields  ||--o{ actions : "ha"
    fields  ||--o{ sensor_readings : "misurato da"
    fields  ||--o{ weather_forecasts : "previsioni"
    fields  ||--o{ drone_captures : "fotografato da"
    fields  ||--o| lamps : "ha un lampione"
```

In breve:
- un **agricoltore** ha uno o più **campi**;
- un campo ha una **semina** (planting) per stagione, con una **coltura**;
- su un campo si aprono **alert** (malattia, fertilizzante, maturità); ogni alert ha una o più **azioni** in ordine di priorità;
- ogni campo ha **letture dei sensori**, **previsioni meteo**, **catture del drone** e un **lampione**.

---

## 3. Dizionario dati

Convenzioni:
- nomi di tabelle e colonne in `snake_case`;
- le chiavi primarie sono `text`: Prisma genera un UUID in automatico, ma il seed usa id leggibili come `fld_003`;
- tutte le date con ora sono `timestamptz` (UTC), le date senza ora sono `date`.

Legenda: **PK** chiave primaria · **FK** chiave esterna · **UQ** unico · **NN** obbligatorio.

### 3.1 `farmers` — agricoltori
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | es. `frm_001` |
| `name` | text | NN | Nome e cognome |
| `phone` | text | NN | Formato internazionale `+265 ...`, solo testo (nessuna integrazione) |
| `village` | text | NN | Villaggio |
| `created_at` | timestamptz | NN, default `now()` | |

### 3.2 `crops` — colture
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | es. `crp_maize` |
| `code` | text | NN, UQ | `MAIZE`, `SOYBEAN`, `BEANS`, `TOBACCO`, `GROUNDNUT` |
| `name` | text | NN | Nome visualizzato (`Maize`) |
| `cycle_days` | integer | NN | Durata tipica del ciclo, in giorni |

> È una **tabella** e non un enum perché vogliamo poter aggiungere colture senza migrazioni.

### 3.3 `fields` — campi
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | es. `fld_003` |
| `code` | text | NN, UQ | Codice leggibile, es. `KSG-003` |
| `name` | text | NN | es. `Chilanga North` |
| `farmer_id` | text | NN, FK → `farmers.id` | |
| `area_ha` | double precision | NN | Ettari (es. `2.4`) |
| `boundary` | jsonb | NN | Confine come **GeoJSON Polygon**, coordinate `[lng, lat]` |
| `centroid_lat` | double precision | NN | Centro del campo, per lo zoom e i marker |
| `centroid_lng` | double precision | NN | |
| `created_at` | timestamptz | NN, default `now()` | |

> `area_ha` è `double precision` e non `numeric`: Prisma restituirebbe `numeric` come oggetto `Decimal`, scomodo da serializzare in JSON. Per gli ettari la precisione di un `double` basta.
> `boundary` è `jsonb` e non PostGIS: per la demo non servono query geografiche. Se in futuro servissero, PostGIS è un'estensione abilitabile su Azure.

### 3.4 `plantings` — semine (una per campo per stagione)
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | es. `pln_003` |
| `field_id` | text | NN, FK → `fields.id` (cascade) | |
| `crop_id` | text | NN, FK → `crops.id` | |
| `planted_at` | date | NN | Data di semina |
| `expected_harvest_start` | date | NN | Inizio della finestra di raccolto prevista |
| `expected_harvest_end` | date | NN | Fine della finestra di raccolto prevista |
| `growth_stage` | enum `GrowthStage` | NN | `EMERGENCE`, `VEGETATIVE`, `FLOWERING`, `FRUITING`, `MATURITY` |
| `status` | enum `PlantingStatus` | NN, default `ACTIVE` | `ACTIVE`, `HARVESTED` |

> Ogni campo ha **al massimo una semina `ACTIVE`**: la regola è verificata nel seed e nell'API. Un vincolo nel DB non serve per la demo.

### 3.5 `alerts` — problemi rilevati
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | es. `alr_003a` |
| `field_id` | text | NN, FK → `fields.id` (cascade) | |
| `planting_id` | text | FK → `plantings.id` (set null), nullable | Semina a cui si riferisce |
| `category` | enum `AlertCategory` | NN | `DISEASE`, `FERTILIZER`, `MATURITY` |
| `severity` | enum `Severity` | NN | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `title` | text | NN | Titolo breve in inglese |
| `description` | text | NN | Spiegazione per Felix |
| `source` | enum `AlertSource` | NN | `SENSOR`, `DRONE`, `WEATHER`, `MANUAL` |
| `confidence` | double precision | nullable, 0–1 | Confidenza dell'alert automatico (es. `0.78`). `NULL` per gli alert `MANUAL`, cioè confermati da Felix. Vedi spec §6.7 |
| `detected_at` | timestamptz | NN | Quando è stato rilevato |
| `due_at` | timestamptz | nullable | Entro quando agire (serve per l'urgenza) |
| `status` | enum `AlertStatus` | NN, default `OPEN` | `OPEN`, `RESOLVED` |
| `resolved_at` | timestamptz | nullable | |
| `created_at` | timestamptz | NN, default `now()` | |

Indici: `(field_id, status)` per gli alert aperti di un campo, `(category, status)` per le liste per categoria.

> **Regola di onestà (spec §6.7):** gli alert `DISEASE` con fonte `SENSOR` descrivono una **condizione di rischio** ("Conditions favourable to …"), non una malattia. Le prove visive arrivano da `DRONE` o dalla conferma di Felix (`MANUAL`).

### 3.6 `actions` — cosa fare, in ordine di priorità
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | es. `act_003a1` |
| `alert_id` | text | NN, FK → `alerts.id` (cascade) | Alert a cui risponde |
| `field_id` | text | NN, FK → `fields.id` (cascade) | Ridondante ma comodo: tutte le azioni di un campo in una query |
| `priority` | integer | NN | 1 = la più importante **all'interno del campo** |
| `title` | text | NN | es. `Lift groundnuts within 48 hours` |
| `why` | text | NN | Motivazione mostrata a Felix |
| `due_at` | timestamptz | nullable | |
| `done` | boolean | NN, default `false` | Predisposto per "mark as done" |
| `done_at` | timestamptz | nullable | |

Indice: `(field_id, priority)`.

### 3.7 `sensor_readings` — letture dei sensori nel suolo
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | |
| `field_id` | text | NN, FK → `fields.id` (cascade) | |
| `sensor_id` | text | NN | Identificativo del dispositivo |
| `measured_at` | timestamptz | NN | |
| `soil_moisture_pct` | double precision | nullable | Umidità del suolo, % |
| `soil_temp_c` | double precision | nullable | Temperatura del suolo, °C |
| `ph` | double precision | nullable | |
| `n_ppm` | double precision | nullable | Azoto |
| `p_ppm` | double precision | nullable | Fosforo |
| `k_ppm` | double precision | nullable | Potassio |

Indice: `(field_id, measured_at DESC)`, per prendere velocemente l'ultima lettura.

### 3.8 `weather_forecasts` — previsioni meteo giornaliere
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | |
| `field_id` | text | NN, FK → `fields.id` (cascade) | |
| `date` | date | NN | |
| `temp_min_c` | double precision | NN | |
| `temp_max_c` | double precision | NN | |
| `rain_mm` | double precision | NN | |
| `rain_prob_pct` | integer | NN | 0–100 |
| `humidity_pct` | integer | NN | 0–100 |

Vincolo: **UQ `(field_id, date)`**, cioè una sola previsione per campo per giorno.

### 3.9 `drone_captures` — voli del drone
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | |
| `field_id` | text | NN, FK → `fields.id` (cascade) | |
| `captured_at` | timestamptz | NN | |
| `image_url` | text | NN | Per la demo è un percorso statico (`/drone/ksg-003.jpg` in `public/`). In futuro, Azure Blob Storage |
| `ndvi_mean` | double precision | nullable | Indice di vegetazione medio (0–1) |
| `findings` | text | nullable | Cosa ha rilevato l'analisi |

Indice: `(field_id, captured_at DESC)`.

### 3.10 `lamps` — lampioni nei campi (predisposta per l'IoT)
| Colonna | Tipo | Vincoli | Descrizione |
|---|---|---|---|
| `id` | text | PK | |
| `field_id` | text | NN, UQ, FK → `fields.id` (cascade) | Un lampione per campo |
| `device_id` | text | NN, UQ | Identificativo hardware |
| `last_seen_at` | timestamptz | nullable | Ultimo contatto del dispositivo |
| `current_colors` | text[] | NN, default `{}` | Ultimo stato **inviato** al lampione (es. `{PURPLE,BLUE}`) |

> Nella demo l'app **non legge** questa tabella: il colore si calcola dagli alert (§4). La tabella serve in futuro per sapere cosa mostra *fisicamente* il lampione e se è online.

---

## 4. Cosa NON si salva (valori calcolati)

| Valore | Dove si calcola | Perché non sta nel DB |
|---|---|---|
| **Urgenza** di alert e campi | `lib/domain/urgency.ts` | Dipende da "adesso": un alert con scadenza tra 5 giorni diventa urgente fra 2 giorni senza che nessuno lo aggiorni |
| **Colori del lampione / del poligono** | `lib/domain/lamp.ts` | Derivano dagli alert aperti; salvarli significherebbe doverli tenere allineati |
| **Priorità** di alert e campi | `lib/domain/priority.ts` | Stessa logica con memoria e con DB |
| **Statistiche** della dashboard | `lib/domain/stats.ts` | Sono conteggi sugli alert: salvarli sarebbe solo un duplicato |
| **Categorie di un campo** | `lib/domain/build.ts` | Insieme delle `category` degli alert aperti |
| **Etichetta "Suspected · 78%"** | `lib/domain/confidence.ts` | Si ricava da `category` + `confidence`: nel DB c'è solo il numero |

**Unica eccezione:** `actions.priority` è salvata, perché nella demo l'ordine delle azioni è scelto a mano nei contenuti (raccomandazioni statiche).

---

## 5. Da schermata a colonna

Ogni dato mostrato nell'app, con il campo dell'API e la colonna da cui proviene.

| Schermata | Dato mostrato | Campo API | Origine nel DB |
|---|---|---|---|
| Dashboard | Numeri delle 4 KPI | `GET /api/stats` | calcolato da `alerts` (§4) |
| Dashboard / Lista | Poligono sulla mappa | `boundary`, `centroid` | `fields.boundary`, `fields.centroid_lat/lng` |
| Dashboard / Lista | Colore del poligono / lampione | `lampColors`, `isUrgent`, `categories` | calcolato da `alerts` |
| Lista | Codice, nome, ettari | `code`, `name`, `areaHa` | `fields.code`, `.name`, `.area_ha` |
| Lista | Coltura | `crop` | `plantings` (ACTIVE) → `crops` |
| Lista | Agricoltore, villaggio | `farmerName`, `village` | `farmers.name`, `farmers.village` |
| Lista | Alert principale, gravità, scadenza, fonte | `topAlert` | `alerts` (ordinati con §6.4 dello spec) |
| Lista | "+N issues" | `openAlertsCount` | conteggio di `alerts` OPEN |
| Lista / Dettaglio | "Suspected · 78%" / "Estimate · 85%" | `topAlert.confidence`, `alerts[].confidence` | `alerts.confidence` (etichetta calcolata, §4) |
| Dettaglio | Telefono dell'agricoltore | `farmer.phone` | `farmers.phone` |
| Dettaglio | Timeline della coltura | `planting.*` | `plantings.planted_at`, `expected_harvest_start/end`, `growth_stage` |
| Dettaglio | Azioni (titolo, why, scadenza, fatto) | `actions[]` | `actions.*` |
| Dettaglio | Categoria e fonte dell'azione | `actions[].category`, `.source` | dall'alert collegato (`actions.alert_id` → `alerts`) |
| Dettaglio | Sensori | `latestSensorReading` | ultima riga di `sensor_readings` per `measured_at` |
| Dettaglio | Meteo a 5 giorni | `weather[]` | `weather_forecasts` dal giorno di "adesso", 5 righe |
| Dettaglio | Drone | `latestDroneCapture` | ultima riga di `drone_captures` |

---

## 6. Schema Prisma

Da copiare in `prisma/schema.prisma`, alla root del progetto Next.js.

> **Nota sulla versione di Prisma.** Lo schema usa la sintassi classica (URL nel blocco `datasource`). Se al setup si installa una versione di Prisma che sposta la configurazione della connessione in `prisma.config.ts`, si seguono le istruzioni di upgrade ufficiali: **modelli, enum e indici restano identici**, cambia solo dove si dichiarano le URL.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")        // app (utente felix_app)
  directUrl         = env("DIRECT_URL")          // migrazioni (utente felix_migrator)
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL") // solo per `prisma migrate dev` (#4)
}

// ─── Enum ────────────────────────────────────────────────────────────────

enum AlertCategory {
  DISEASE
  FERTILIZER
  MATURITY
}

enum Severity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertSource {
  SENSOR
  DRONE
  WEATHER
  MANUAL
}

enum AlertStatus {
  OPEN
  RESOLVED
}

enum PlantingStatus {
  ACTIVE
  HARVESTED
}

enum GrowthStage {
  EMERGENCE
  VEGETATIVE
  FLOWERING
  FRUITING
  MATURITY
}

// ─── Modelli ─────────────────────────────────────────────────────────────

model Farmer {
  id        String   @id @default(uuid())
  name      String
  phone     String
  village   String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  fields Field[]

  @@map("farmers")
}

model Crop {
  id        String @id @default(uuid())
  code      String @unique
  name      String
  cycleDays Int    @map("cycle_days")

  plantings Planting[]

  @@map("crops")
}

model Field {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  farmerId    String   @map("farmer_id")
  areaHa      Float    @map("area_ha")
  boundary    Json // GeoJSON Polygon, coordinate [lng, lat]
  centroidLat Float    @map("centroid_lat")
  centroidLng Float    @map("centroid_lng")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  farmer           Farmer            @relation(fields: [farmerId], references: [id])
  plantings        Planting[]
  alerts           Alert[]
  actions          Action[]
  sensorReadings   SensorReading[]
  weatherForecasts WeatherForecast[]
  droneCaptures    DroneCapture[]
  lamp             Lamp?

  @@index([farmerId])
  @@map("fields")
}

model Planting {
  id                   String         @id @default(uuid())
  fieldId              String         @map("field_id")
  cropId               String         @map("crop_id")
  plantedAt            DateTime       @map("planted_at") @db.Date
  expectedHarvestStart DateTime       @map("expected_harvest_start") @db.Date
  expectedHarvestEnd   DateTime       @map("expected_harvest_end") @db.Date
  growthStage          GrowthStage    @map("growth_stage")
  status               PlantingStatus @default(ACTIVE)

  field  Field   @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  crop   Crop    @relation(fields: [cropId], references: [id])
  alerts Alert[]

  @@index([fieldId, status])
  @@map("plantings")
}

model Alert {
  id          String        @id @default(uuid())
  fieldId     String        @map("field_id")
  plantingId  String?       @map("planting_id")
  category    AlertCategory
  severity    Severity
  title       String
  description String
  source      AlertSource
  confidence  Float? // 0–1; null = confermato da Felix (MANUAL)
  detectedAt  DateTime      @map("detected_at") @db.Timestamptz
  dueAt       DateTime?     @map("due_at") @db.Timestamptz
  status      AlertStatus   @default(OPEN)
  resolvedAt  DateTime?     @map("resolved_at") @db.Timestamptz
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz

  field    Field     @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  planting Planting? @relation(fields: [plantingId], references: [id], onDelete: SetNull)
  actions  Action[]

  @@index([fieldId, status])
  @@index([category, status])
  @@map("alerts")
}

model Action {
  id       String    @id @default(uuid())
  alertId  String    @map("alert_id")
  fieldId  String    @map("field_id")
  priority Int
  title    String
  why      String
  dueAt    DateTime? @map("due_at") @db.Timestamptz
  done     Boolean   @default(false)
  doneAt   DateTime? @map("done_at") @db.Timestamptz

  alert Alert @relation(fields: [alertId], references: [id], onDelete: Cascade)
  field Field @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@index([fieldId, priority])
  @@map("actions")
}

model SensorReading {
  id              String   @id @default(uuid())
  fieldId         String   @map("field_id")
  sensorId        String   @map("sensor_id")
  measuredAt      DateTime @map("measured_at") @db.Timestamptz
  soilMoisturePct Float?   @map("soil_moisture_pct")
  soilTempC       Float?   @map("soil_temp_c")
  ph              Float?
  nPpm            Float?   @map("n_ppm")
  pPpm            Float?   @map("p_ppm")
  kPpm            Float?   @map("k_ppm")

  field Field @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@index([fieldId, measuredAt(sort: Desc)])
  @@map("sensor_readings")
}

model WeatherForecast {
  id          String   @id @default(uuid())
  fieldId     String   @map("field_id")
  date        DateTime @db.Date
  tempMinC    Float    @map("temp_min_c")
  tempMaxC    Float    @map("temp_max_c")
  rainMm      Float    @map("rain_mm")
  rainProbPct Int      @map("rain_prob_pct")
  humidityPct Int      @map("humidity_pct")

  field Field @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([fieldId, date])
  @@map("weather_forecasts")
}

model DroneCapture {
  id         String   @id @default(uuid())
  fieldId    String   @map("field_id")
  capturedAt DateTime @map("captured_at") @db.Timestamptz
  imageUrl   String   @map("image_url")
  ndviMean   Float?   @map("ndvi_mean")
  findings   String?

  field Field @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@index([fieldId, capturedAt(sort: Desc)])
  @@map("drone_captures")
}

model Lamp {
  id            String    @id @default(uuid())
  fieldId       String    @unique @map("field_id")
  deviceId      String    @unique @map("device_id")
  lastSeenAt    DateTime? @map("last_seen_at") @db.Timestamptz
  currentColors String[]  @default([]) @map("current_colors")

  field Field @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@map("lamps")
}
```

---

## 7. Provisioning su Azure, passo per passo

Tempo stimato: circa 1 ora. Si fa tutto dal **portale Azure** (portal.azure.com).

### 7.1 Prima di iniziare
- [ ] Decidere quale **sottoscrizione** usare: *Azure for Students* (crediti gratuiti) o quella fornita dall'hackathon.
- [ ] Verificare se il B1ms rientra nell'offerta gratuita della sottoscrizione. Gli account free di Azure includono di solito ore gratuite di Flexible Server Burstable B1ms per 12 mesi; **va verificato** sulla propria sottoscrizione.
- [ ] Impostare un **budget alert** (Cost Management → Budgets), ad esempio 20 €, per evitare sorprese.

### 7.2 Creare il server
1. **Resource group:** `rg-felix-field`.
2. Cercare *Azure Database for PostgreSQL flexible servers* → **Create**.
3. Compilare:

| Campo | Valore |
|---|---|
| Server name | `felix-field-db` (diventa `felix-field-db.postgres.database.azure.com`) |
| Region | **South Africa North** (la più vicina al Malawi) oppure **West Europe**, se la sottoscrizione non permette la prima |
| PostgreSQL version | **16** |
| Workload type | Development |
| Compute + storage | **Burstable, Standard_B1ms**, storage **32 GiB**, autogrow off |
| High availability | **Disabled** |
| Authentication | **PostgreSQL authentication only** |
| Admin username | `felixadmin` |
| Password | Generata dal password manager (almeno 20 caratteri). **Mai** in chat o in git |

4. **Networking:**
   - Connectivity method: **Public access (allowed IP addresses)**.
   - Firewall: aggiungere l'IP di ciascun membro del team (*Add current client IP address* per il tuo; gli altri te lo comunicano, lo trovano cercando "what is my ip").
   - Per Vercel aggiungere la regola `AllowVercel` con range **`0.0.0.0` – `255.255.255.255`**. Le funzioni di Vercel non hanno IP fissi, quindi questa è l'unica opzione sui piani gratuiti.

   > ⚠️ **Rischio accettato per l'hackathon:** il server è raggiungibile da qualunque IP. La protezione sta in SSL obbligatorio, password lunghe e utenti con permessi minimi (§7.4). Va scritto anche nelle slide, nella sezione "next steps": in produzione si usa una rete privata.

5. **Backups:** lasciare il default (7 giorni).
6. **Review + create.** La creazione richiede 5–10 minuti.

### 7.3 Impostazioni del server
- **Server parameters → `require_secure_transport` = ON** (SSL obbligatorio; di solito è già il default).
- **PgBouncer:** l'app gira su Vercel serverless, dove ogni istanza apre la sua connessione. Il PgBouncer integrato di Azure **potrebbe non essere disponibile sul tier Burstable**: verificarlo in *Server parameters → `pgbouncer.enabled`*.
  - **Se NON è disponibile (caso atteso):** si limita Prisma a 1 connessione per istanza con `connection_limit=1` nella `DATABASE_URL` (§8). Per il traffico di una demo basta.
  - **Se è disponibile:** si attiva e l'app usa la porta **6432** con `&pgbouncer=true` (§8).

### 7.4 Database e utenti

Collegarsi come `felixadmin`. Si può usare *Connect* nel portale (Cloud Shell), oppure `psql` o pgAdmin dal proprio PC:

```bash
psql "host=felix-field-db.postgres.database.azure.com port=5432 dbname=postgres user=felixadmin sslmode=require"
```

**Passo A — come `felixadmin`, sul database `postgres`:**
```sql
CREATE DATABASE felix_dev;
CREATE DATABASE felix_prod;
CREATE DATABASE felix_shadow;

-- Utente per le migrazioni e il seed: crea e possiede le tabelle
CREATE ROLE felix_migrator LOGIN PASSWORD '<password-migrator>';
-- Utente usato dall'app: legge e scrive i dati, non può cambiare la struttura
CREATE ROLE felix_app LOGIN PASSWORD '<password-app>';
```

**Passo B — come `felixadmin`.** Prima i permessi di connessione, eseguiti una volta da qualunque DB:
```sql
GRANT CONNECT ON DATABASE felix_dev, felix_prod TO felix_migrator, felix_app;
GRANT CONNECT ON DATABASE felix_shadow TO felix_migrator;
```
Poi, **collegati a ciascun DB** (`\c felix_dev`, poi `\c felix_prod`, poi `\c felix_shadow`):
```sql
GRANT USAGE, CREATE ON SCHEMA public TO felix_migrator;
GRANT USAGE ON SCHEMA public TO felix_app;   -- su felix_shadow non serve
```

**Passo C — come `felix_migrator`, su `felix_dev` e su `felix_prod`.** Serve perché le tabelle create dalle migrazioni siano utilizzabili dall'app:
```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO felix_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO felix_app;
```

> `felix_shadow` lo usa **solo Prisma** durante `migrate dev`: lo svuota e lo ricrea ogni volta. Non ci si salvano dati.

### 7.5 Cosa consegnare al team

Quando il provisioning è finito:
- [ ] Le connection string (§8) nel **password manager** condiviso, una voce per DB e per utente.
- [ ] Le env impostate nel **progetto Vercel esistente**, sia in *Production* sia in *Preview*. Il passaggio a `DATA_SOURCE=db` si fa solo dopo le verifiche del §11.
- [ ] La **region delle funzioni** del progetto su Vercel impostata vicino al DB: Cape Town (`cpt1`) per South Africa North, Frankfurt (`fra1`) per West Europe.
- [ ] Gli IP del team aggiunti al firewall. Se qualcuno cambia rete, ad esempio a casa, deve comunicare il nuovo IP.
- [ ] Il risultato delle verifiche del §11 scritto nella PR.

### 7.6 Costi e risparmio
- Il B1ms con 32 GiB costa circa **15–20 €/mese** se sempre acceso, o zero se rientra nell'offerta gratuita.
- Quando il server non serve si può **fermare** (*Overview → Stop*). Azure lo riavvia da solo dopo 7 giorni. **Ricordarsi di riavviarlo prima della demo.**

---

## 8. Connection string e variabili d'ambiente

Formato: `postgresql://UTENTE:PASSWORD@HOST:PORTA/DATABASE?parametri`

> Se la password contiene caratteri speciali (`@ : / ? # %`), va **codificata per URL**: ad esempio `@` diventa `%40`. Il modo più semplice per evitare il problema è generare password solo alfanumeriche e lunghe.

| Variabile | Usata da | Utente | Valore (sostituire `<...>`) |
|---|---|---|---|
| `DATABASE_URL` | app Next.js (runtime, con `DATA_SOURCE=db`) | `felix_app` | `postgresql://felix_app:<pwd>@felix-field-db.postgres.database.azure.com:5432/<db>?sslmode=require&connection_limit=1&pool_timeout=20` |
| `DIRECT_URL` | `prisma migrate`, seed | `felix_migrator` | `postgresql://felix_migrator:<pwd>@felix-field-db.postgres.database.azure.com:5432/<db>?sslmode=require` |
| `SHADOW_DATABASE_URL` | solo `prisma migrate dev` (#4, in locale) | `felix_migrator` | `postgresql://felix_migrator:<pwd>@felix-field-db.postgres.database.azure.com:5432/felix_shadow?sslmode=require` |

- `<db>` vale `felix_dev` in locale e nelle Preview di Vercel, `felix_prod` nella Production di Vercel.
- **Con PgBouncer attivo** (§7.3): in `DATABASE_URL` si usa la porta `6432` e si aggiunge `&pgbouncer=true`. `DIRECT_URL` resta sulla 5432.
- **Su Vercel:** si impostano `DATABASE_URL` e anche `DIRECT_URL`. Prisma richiede che la variabile esista, ma a runtime non la usa: in Vercel le si può dare **lo stesso valore di `DATABASE_URL`**, così le credenziali del migrator non finiscono online. `SHADOW_DATABASE_URL` **non** va su Vercel. Se Prisma si lamenta della variabile mancante, la si imposta uguale a `DATABASE_URL`.

**Chi ha cosa:**

| Persona | `.env` locale con |
|---|---|
| #4 (owner del DB) | Tutte e tre, su `felix_dev` |
| #1 (per la fase 2) | `DATA_SOURCE=db`, `DATABASE_URL` e `DIRECT_URL` su `felix_dev`, entrambe con l'utente **`felix_app`** |
| #2, #3, #5 | Nessuna: lavorano con `DATA_SOURCE=memory` |

---

## 9. Migrazioni e seed

### 9.1 Prima migrazione (#4)
```bash
# dalla root del progetto, con .env puntato su felix_dev
npx prisma migrate dev --name init      # crea prisma/migrations/<data>_init e la applica a felix_dev
npx prisma generate                     # genera il client TypeScript
```
Poi si committa la cartella `prisma/migrations/` nella PR.

### 9.2 Applicare a prod (#4)
```bash
# DIRECT_URL puntata su felix_prod
npx prisma migrate deploy               # applica le migrazioni già create, non ne crea di nuove e non resetta mai
```

### 9.3 Seed (`prisma/seed.ts`)

Comportamento richiesto:
1. Legge `data/seed.json` e lo **valida** con `lib/contract/seed-schema.ts`, lo stesso schema usato dal `MemoryRepository`. Se non è valido, si ferma con un errore.
2. Svuota le tabelle in ordine inverso alle dipendenze: `actions`, `alerts`, `sensor_readings`, `weather_forecasts`, `drone_captures`, `lamps`, `plantings`, `fields`, `crops`, `farmers`.
3. Inserisce i dati in ordine: `farmers`, `crops`, `fields`, `plantings`, `alerts`, `actions`, `sensor_readings`, `weather_forecasts`, `drone_captures`. Usa `createMany`, tutto in **una transazione**. La tabella `lamps` resta vuota nella demo.
4. Stampa un riepilogo con il numero di righe per tabella.

È **idempotente**: si può rilanciare quante volte si vuole e il risultato è sempre lo stesso.

Bozza:
```ts
import { PrismaClient } from "@prisma/client";
import seed from "../data/seed.json";
import { SeedSchema } from "../lib/contract/seed-schema"; // percorsi relativi: tsx non legge gli alias "@/"

const prisma = new PrismaClient();

async function main() {
  const data = SeedSchema.parse(seed);
  await prisma.$transaction([
    prisma.action.deleteMany(), prisma.alert.deleteMany(),
    prisma.sensorReading.deleteMany(), prisma.weatherForecast.deleteMany(),
    prisma.droneCapture.deleteMany(), prisma.lamp.deleteMany(),
    prisma.planting.deleteMany(), prisma.field.deleteMany(),
    prisma.crop.deleteMany(), prisma.farmer.deleteMany(),

    prisma.farmer.createMany({ data: data.farmers }),
    prisma.crop.createMany({ data: data.crops }),
    prisma.field.createMany({ data: data.fields }),
    prisma.planting.createMany({ data: data.plantings }),
    prisma.alert.createMany({ data: data.alerts }),
    prisma.action.createMany({ data: data.actions }),
    prisma.sensorReading.createMany({ data: data.sensorReadings }),
    prisma.weatherForecast.createMany({ data: data.weatherForecasts }),
    prisma.droneCapture.createMany({ data: data.droneCaptures }),
  ]);
  console.log("Seed completed:", { fields: data.fields.length, alerts: data.alerts.length, actions: data.actions.length });
}

main().finally(() => prisma.$disconnect());
```

Le date di `seed.json` sono stringhe ISO: `seed-schema.ts` le converte in `Date` (con `z.coerce.date()`) prima dell'inserimento.

Lo script si registra nel `package.json` del progetto e si lancia con `npm run db:seed`:
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```
Il seed si esegue con `DIRECT_URL` (utente `felix_migrator`), perché svuota le tabelle.

### 9.4 Modificare lo schema in seguito
1. Si apre una PR che modifica `schema.prisma`, con la review di **#1 e #4** (spec §12).
2. #4 esegue `npx prisma migrate dev --name <descrizione>` su `felix_dev` e committa la migrazione.
3. Se cambiano i dati, si aggiornano nella **stessa PR** `seed.json`, `seed-schema.ts`, gli schemi del contratto (`lib/contract/schemas.ts`) ed entrambi i repository (`memory-repository.ts`, `prisma-repository.ts`).
4. Dopo il merge, #4 esegue `migrate deploy` su `felix_prod` e poi `db:seed`.

---

## 10. Regole per il DB condiviso

Il DB `felix_dev` è **uno per tutti**: un errore di una persona lo rompe per tutti.

1. **Solo #4 esegue `prisma migrate dev`, `migrate deploy`, `migrate reset` e `db:seed`.** Se un'altra persona lancia `migrate dev` con uno schema diverso da quello del DB, Prisma può proporre di **cancellare tutti i dati** (reset).
2. Tutti gli altri eseguono **solo** `npx prisma generate`, che genera i tipi senza toccare il DB.
3. **Non si modificano dati a mano** (pgAdmin, Prisma Studio in scrittura): i dati corretti sono in `seed.json`, e per ripristinarli si rilancia `db:seed`.
4. **Nessuna password nel codice, in git o in chat.** Nel repo c'è solo `.env.example` con i segnaposto, e `.env` è nel `.gitignore`.
5. **`felix_prod` lo tocca solo #4**, e solo con `migrate deploy` + `db:seed`.
6. Se il DB non risponde, prima si controlla che il **server non sia fermo** (§7.6) e che il **proprio IP sia nel firewall** (§7.2).

---

## 11. Definition of done

Il DB è "fatto" quando **tutte** queste verifiche passano. Il risultato va incollato nella PR.

- [ ] Il server `felix-field-db` è attivo, con SSL obbligatorio.
- [ ] I database `felix_dev`, `felix_prod` e `felix_shadow` esistono; gli utenti `felix_app` e `felix_migrator` funzionano.
- [ ] Dal PC di #4 e di #1, `npx prisma db pull --print` con `DATABASE_URL` si collega senza errori.
- [ ] La migrazione `init` è applicata a `felix_dev` e `felix_prod` (`npx prisma migrate status` → *Database schema is up to date*).
- [ ] Il seed è caricato su entrambi. Le query qui sotto restituiscono gli stessi numeri di `seed.json`:

```sql
-- 1) Righe per tabella: devono coincidere con le lunghezze delle liste in seed.json
SELECT 'fields' AS tabella, count(*) FROM fields
UNION ALL SELECT 'alerts',  count(*) FROM alerts
UNION ALL SELECT 'actions', count(*) FROM actions;

-- 2) Campi distinti con alert aperti, per categoria
SELECT category, count(DISTINCT field_id) AS campi
FROM alerts WHERE status = 'OPEN'
GROUP BY category;
-- Attesi (spec §9.3): fields 600 · DISEASE 25 · FERTILIZER 22 · MATURITY 18
```

- [ ] `felix_app` **non** può cambiare la struttura: `CREATE TABLE test (id int);` collegati come `felix_app` deve dare *permission denied*.
- [ ] Con `DATA_SOURCE=db`, prima in locale e poi su una Preview di Vercel, `GET /api/stats` restituisce **esattamente** `urgent 8 · disease 25 · fertilizer 22 · maturity 18 · ok 540 · totalFields 600`, gli stessi numeri di `DATA_SOURCE=memory`.
- [ ] Il test Vitest di confronto tra `MemoryRepository` e `PrismaRepository` (spec §6.6) passa.

---

## 12. Problemi frequenti

| Sintomo | Causa probabile | Soluzione |
|---|---|---|
| `Can't reach database server` / timeout | IP non nel firewall, oppure server fermo | Aggiungere l'IP (§7.2) / avviare il server (§7.6) |
| `no pg_hba.conf entry ... SSL off` | Manca `sslmode=require` | Aggiungerlo alla connection string |
| `password authentication failed` | Password con caratteri speciali non codificati, o utente sbagliato | Codificare per URL (§8) o rigenerare una password alfanumerica |
| `permission denied for table ...` (come `felix_app`) | Le tabelle sono state create prima del passo C (§7.4), o da un utente diverso da `felix_migrator` | Come `felix_migrator`: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO felix_app;` |
| `permission denied for schema public` (durante la migrazione) | Manca il passo B (§7.4) | Rieseguire il passo B su quel DB |
| `migrate dev` chiede di resettare il DB | Lo schema nel DB e le migrazioni in git non coincidono | **Fermarsi e avvisare #4.** Non confermare il reset su `felix_dev` senza accordo del team |
| `too many connections` | Troppe istanze serverless aperte | Verificare `connection_limit=1` nella `DATABASE_URL`; valutare PgBouncer (§7.3) |
| Le API rispondono lente (oltre 1 s) | Region di Vercel e del DB lontane | Allineare la region delle funzioni Vercel al DB (§7.5) |
