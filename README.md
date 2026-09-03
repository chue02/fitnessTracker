# Fitness Tracker

A full-stack workout tracker for **strength and cardio** training. Django REST
Framework backend + React (Vite) frontend.

Log a dated workout, add exercises, and record either strength sets (reps ×
weight) or cardio segments (distance / duration / heart rate) — a single workout
can mix both. Browse past workouts in the history view.

## Stack

- **Backend:** Django 5 + Django REST Framework + django-filter (SQLite for dev)
- **Frontend:** React 18 + React Router + Vite 4
- No authentication in v1, but the data model is built to add per-user accounts
  later without a migration rewrite (nullable `owner` FK already in place).

## Data model

- **Exercise** — name + `category` (`strength` | `cardio`) + muscle group. Ships
  with a seeded library; users can add custom ones.
- **Workout** — a dated session with notes.
- **WorkoutEntry** — one row per set (strength) or segment (cardio). Strength
  fields (`reps`, `weight`, `weight_unit`, `is_warmup`) and cardio fields
  (`distance`, `distance_unit`, `duration_seconds`, `avg_heart_rate`) share one
  table; only the fields relevant to the exercise's category are filled in.

## Getting started

### Backend

```bash
cd backend
python3 -m venv venv                 # already created if you cloned with it
venv/bin/pip install -r requirements.txt
venv/bin/python manage.py migrate
venv/bin/python manage.py seed_exercises   # load the built-in exercise library
venv/bin/python manage.py runserver        # http://localhost:8000
```

Optional admin: `venv/bin/python manage.py createsuperuser`, then visit
`/admin/`.

### Frontend

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The Vite dev server proxies `/api` to the Django server on port 8000, so run
both at once.

> Node note: the frontend is pinned to Vite 4 / React 18 to support Node 16.
> `npm install` may print an `EBADENGINE` warning from a transitive dependency;
> it is safe to ignore (the build and dev server work on Node 16).

## API

Base path `/api/`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/exercises/` | List / create exercises. Filters: `?category=`, `?muscle_group=`, `?is_custom=` |
| GET/POST | `/workouts/` | List (newest first) / create a workout with nested `entries` |
| GET/PATCH/DELETE | `/workouts/{id}/` | Retrieve / update / delete a workout |

A workout is created in a single POST with its entries nested, e.g.:

```json
{
  "date": "2026-09-01",
  "notes": "Leg day + easy run",
  "entries": [
    { "exercise": 1, "order": 0, "reps": 5, "weight": "185", "weight_unit": "lb" },
    { "exercise": 18, "order": 1, "distance": "5.0", "distance_unit": "km",
      "duration_seconds": 1500, "avg_heart_rate": 145 }
  ]
}
```

## Adding authentication later

The pieces are already staged: set `owner` from `request.user` on create, flip
`DEFAULT_PERMISSION_CLASSES` in `config/settings.py` from `AllowAny` to
`IsAuthenticated`, add DRF token (or session) auth endpoints, and a login page
on the frontend. No model migration churn is needed because `owner` exists.
