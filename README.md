# Golf Kiosk – Kongsvingers Golfklubb

Storskjerm-kiosk-app for golfklubber. Viser starttider fra Golfbox, vær, banestatus og klubbinformasjon på TV-skjermer i klubbhuset.

Bygget for Kongsvingers Golfklubb, men kan enkelt tilpasses andre klubber.

## Funksjoner

- **Starttider fra Golfbox** – live scraping med auto-innlogging, viser spillernavn og HCP
- **Flere baner** – utebane, simulator, demo-modus
- **Værmelding** – time-for-time fra yr.no (MET Locationforecast API)
- **Banestatus** – åpen/stengt, siste klipp, stimp, greener, bunkere
- **Informasjon** – daglig leder-hilsen, viktige meldinger, kontaktinfo
- **Slopetabell** – herrer/damer, roterer automatisk
- **Banemannskap** – bilder og hilsen fra greenkeeperne
- **Admin-panel** – oppdater alt fra nettleser, beskyttet med JWT-autentisering
- **Multi-skjerm** – ulike skjermer med ulikt innhold (tee-off, restaurant, pro shop)
- **Sanntid** – Socket.io pusher endringer til alle skjermer umiddelbart
- **Automatisk skalering** – designet for 1920x1080, skalerer til alle oppløsninger

## Arkitektur

```
┌─────────────────────────────┐
│   Server (Express + Socket) │
│   GCP / lokal maskin        │
└──────────┬──────────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐   ┌────▼────┐
│ Pi #1 │   │ Pi #2   │   ← Chromium kiosk-modus
│ 55"TV │   │ 32"TV   │
└───────┘   └─────────┘
```

### Stack

- **Backend**: Node.js, Express, Socket.io, Cheerio (scraping)
- **Frontend**: Svelte + Vite (bygget til statiske filer)
- **Data**: JSON-fil (ingen database nødvendig)
- **Vær**: yr.no Locationforecast 2.0 (gratis, ingen API-nøkkel)

## Kom i gang

### Forutsetninger

- Node.js 18+
- npm

### Installasjon

```bash
git clone https://github.com/<bruker>/golf-kiosk.git
cd golf-kiosk
npm install
cd client && npm install && cd ..
```

### Konfigurasjon

Kopier `.env.example` til `.env` og fyll inn:

```bash
cp .env.example .env
```

Viktige verdier:
- `ADMIN_PASSWORD` – passord for admin-panelet (hashes med bcrypt ved første innlogging)
- `JWT_SECRET` – hemmelighet for token-signering (generer en tilfeldig streng)
- `CLUB_GUID` / `RESSOURCE_GUID` – fra Golfbox (se under)

### Bygg frontend

```bash
cd client
npx vite build
cd ..

# Kopier bygget til public/
cp -r client/dist/* public/
```

### Start

```bash
npm start
```

Åpne i nettleser:
- **Skjerm**: http://localhost:3001/display/lobby
- **Admin**: http://localhost:3001/admin

## Admin-panel

Tilgjengelig på `/admin`. Standard passord er satt i `.env`.

### Faner

| Fane | Innhold |
|------|---------|
| **Banestatus** | Åpen/stengt, siste klipp, stimp, greener, bunkere |
| **Informasjon** | Daglig leder-hilsen, viktige meldinger, kontaktinfo |
| **Restaurant** | Meny og tilbud (for restaurant-skjermen) |
| **Golfbox** | Tilkobling, innlogging, manuell cookie |
| **Bilder** | Last opp og organiser bilder |
| **Skjermer** | Konfigurer hvilke moduler hver skjerm viser |

## Golfbox-tilkobling

Golfbox krever innlogging for å se bookingdata. Det er to måter:

### 1. Auto-innlogging (anbefalt)
Gå til Admin → Golfbox → skriv inn klubbens Golfbox brukernavn og passord. Serveren logger inn automatisk og fornyer sesjonen ved behov.

### 2. Manuell cookie
Logg inn på golfbox.no i Chrome → F12 → Network → kopier Cookie-headeren → lim inn i Admin → Golfbox → Avansert.

### Finne GUIDs

1. Logg inn på [golfbox.no](https://www.golfbox.no)
2. Gå til Starttidsbestilling → velg bane
3. Se URL-en: `...?Ressource_GUID={DIN-GUID}&Club_GUID={KLUB-GUID}`

## Skjermoppsett (Raspberry Pi)

### 1. Installer Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Chromium kiosk-modus

Opprett `~/.config/autostart/kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Golf Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --app=https://din-server.no/display/lobby
```

### 3. Skru av skjermsparer

```bash
# Legg til i /etc/xdg/lxsession/LXDE-pi/autostart:
@xset s off
@xset -dpms
@xset s noblank
```

## Deploy til sky (GCP)

For produksjon anbefales GCP Compute Engine (e2-micro, gratis tier):

1. Opprett VM med Ubuntu 22.04
2. Installer Node.js 20
3. Klon repo, `npm install`, bygg frontend
4. Sett opp som systemd-service
5. Konfigurer nginx som reverse proxy med HTTPS (Let's Encrypt)
6. Pek Pi-ene mot `https://kiosk.dittdomene.no/display/lobby`

## Mappestruktur

```
golf-kiosk/
├── server/                  # Express backend
│   ├── index.js             # Hovedserver + Socket.io
│   ├── db.js                # JSON-datalagring
│   ├── auth.js              # JWT + bcrypt autentisering
│   ├── routes/
│   │   ├── api.js           # Offentlige API-endepunkter
│   │   └── admin.js         # Beskyttede admin-endepunkter
│   └── scrapers/
│       ├── golfbox.js       # Golfbox scraper + auto-login
│       ├── golfbox-login.js # HTTP-basert innlogging
│       └── weather.js       # yr.no vær-henting
├── client/                  # Svelte + Vite frontend
│   └── src/
│       ├── routes/
│       │   ├── Display.svelte   # Kiosk-skjerm
│       │   └── Admin.svelte     # Admin-panel
│       └── modules/
│           ├── TeeTimes.svelte
│           ├── Weather.svelte
│           ├── CourseStatus.svelte
│           ├── Announcements.svelte
│           └── SlopeTable.svelte
├── public/                  # Bygget frontend + statiske filer
├── Bilder/                  # Lokale bilder (organisert i mapper)
├── .env.example             # Mal for konfigurasjon
├── golf-kiosk-data.json     # Applikasjonsdata (autogenerert)
└── package.json
```

## Tilpasning til annen klubb

1. Endre GUIDs i `.env`
2. Oppdater koordinater for vær (`WEATHER_LAT`, `WEATHER_LON`)
3. Oppdater slopetabell-data i `client/src/modules/SlopeTable.svelte`
4. Bytt logo-URL i `client/src/routes/Display.svelte`
5. Last opp egne bilder via admin-panelet

## Lisens

MIT

## Bidrag

Pull requests er velkomne. For store endringer, opprett en issue først.
