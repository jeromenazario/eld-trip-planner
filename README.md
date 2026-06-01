# ELD Trip Planner

A full-stack app that takes a truck driver's trip details and generates a **route map with required stops** and **filled-out FMCSA daily log sheets** — fully compliant with federal Hours-of-Service (HOS) rules for property-carrying drivers.

**🔗 Live demo:** https://eld-trip-planner-sooty.vercel.app/
**🎥 Loom walkthrough:** _<add your Loom link here>_

Built with **Django** (REST API) and **React** (Vite).

---

## What it does

Enter four inputs:

- Current location
- Pickup location
- Drop-off location
- Current cycle used (hours)

…and the app produces:

- An interactive **route map** with fuel stops, rest stops, pickup and drop-off
- **Daily ELD log sheets** drawn on the real FMCSA grid (one per day, multiple for longer trips)
- A **trip summary** — total days, driving hours, and cycle hours remaining

---

## Features

- **Accurate HOS engine** — enforces the 11-hour driving limit, 14-hour on-duty window, 30-minute break, 10-hour reset, and 70-hour / 8-day cycle.
- **Real driving time** — driving hours are derived from the map provider's actual route duration, not a flat speed assumption.
- **Route selection** — choose between fastest, no-tolls, and alternate routes; the plan re-calculates for the chosen route.
- **Real stops** — fuel stops are placed so no leg exceeds 1,000 miles and snapped to the nearest real gas station; rest stops are placed where a federal limit forces a reset, snapped to nearby truck stops/rest areas.
- **Hand-drawn ELD logs** — the duty-status grid is rendered as resolution-independent SVG (prints cleanly to PDF).
- **Mobile responsive** — sidebar collapses to a drawer, layouts stack on phones.
- **Fast & safe** — parallelized geocoding/route/Places lookups, per-IP rate limiting, validated and bounded inputs, no secrets in the repo.

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Django, Django REST Framework, Gunicorn |
| Frontend | React, Vite, `@react-google-maps/api`, Axios, Lucide icons |
| Maps | Google Maps Platform — Geocoding, Directions, Places, Maps JS |
| Hosting | Backend on **Render**, frontend on **Vercel** |

> The app is **stateless** — no database. Each request is a pure input → output calculation.

---

## HOS rules implemented (49 CFR §395)

| Rule | Value |
|---|---|
| Driving cycle | 70 hours / 8 days (property-carrying) |
| Max driving per shift | 11 hours |
| On-duty window | 14 hours |
| Mandatory break | 30 minutes after 8 cumulative driving hours |
| Required reset | 10 hours (8h sleeper berth + 2h off-duty) |

**Assumptions** (per the assessment): property-carrying driver, no adverse driving conditions, fueling at least every 1,000 miles, and 1 hour each for pickup and drop-off.

---

## Project structure

```
eld-trip-planner/
├── backend/                 # Django REST API
│   ├── api/
│   │   ├── hos.py           # Hours-of-Service calculation engine
│   │   ├── views.py         # geocoding, routing, Places lookups, plan endpoint
│   │   ├── serializers.py   # request validation
│   │   └── urls.py
│   ├── backend/settings.py
│   ├── requirements.txt
│   └── render.yaml          # Render deploy config
└── frontend/                # React + Vite app
    ├── src/
    │   ├── components/       # TripForm, ELDLogSheet, RouteMap, ...
    │   ├── pages/            # RouteSelect, Settings, Profile, ...
    │   ├── utils/            # adapter, profile store
    │   └── App.jsx
    └── vercel.json
```

---

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/plan-trip/` | Generate a trip plan (route, stops, ELD logs, summary). Rate-limited to 10 req/min per IP. |
| `GET`  | `/api/health/` | Lightweight liveness probe. |

---

## Running locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# create backend/.env.local (see backend/.env.example)
python manage.py runserver
```

Runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install

# create frontend/.env.local (see frontend/.env.example)
npm run dev
```

Runs at `http://localhost:5173`.

---

## Environment variables

**Backend** (`backend/.env.local`)

| Key | Description |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Server key — enable Geocoding, Directions, Places |
| `DJANGO_SECRET_KEY` | Django secret |
| `DEBUG` | `True` locally, `False` in production |
| `ALLOWED_HOSTS` | `*` (or your domain) |
| `CORS_ALLOWED_ORIGINS` | Your frontend URL (blank = allow all) |

**Frontend** (`frontend/.env.local`)

| Key | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (e.g. your Render URL) |
| `VITE_GOOGLE_MAPS_API_KEY` | Browser key — enable Maps JavaScript + Places, restrict by HTTP referrer |

---

## Deployment

- **Backend → Render**: root directory `backend`, Python runtime, `pip install -r requirements.txt`, start `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT`. Config in `render.yaml`.
- **Frontend → Vercel**: root directory `frontend`, Vite preset. Set `VITE_API_URL` to the Render URL and `VITE_GOOGLE_MAPS_API_KEY`.
- After the frontend deploys, set `CORS_ALLOWED_ORIGINS` on Render to the Vercel domain.

---

## Notes

- HOS rules are **US / FMCSA** specific; the app is scoped to United States trips.
- Driving distance and duration come from the Google Directions API for the selected route.
