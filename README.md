# Fitness Tracker

A full-stack workout tracker for **strength and cardio** training. Django REST
Framework backend + React (Vite) frontend.

Log a dated workout, add exercises, and record either strength sets (reps ×
weight) or cardio segments (distance / duration / heart rate) — a single workout
can mix both. Browse past workouts in the history view.

## Stack

- **Backend:** Django 5 + Django REST Framework + django-filter (SQLite for dev)
- **Frontend:** React 18 + React Router + Vite 4
- **Auth:** open self-registration with DRF token auth. Every data endpoint
  requires a token, and each user only sees their own workouts, templates,
  bodyweight history and custom exercises (the built-in library is shared and
  read-only).

## Data model

- **Exercise** — name + `category` (`strength` | `cardio`) + muscle group. Ships
  with a seeded library; users can add custom ones.
- **Workout** — a dated session with notes.
- **WorkoutEntry** — one row per set (strength) or segment (cardio). Strength
  fields (`reps`, `weight`, `weight_unit`, `is_warmup`) and cardio fields
  (`distance`, `distance_unit`, `duration_seconds`, `avg_heart_rate`) share one
  table; only the fields relevant to the exercise's category are filled in.
- **WorkoutTemplate / TemplateExercise** — a named, ordered list of exercises
  (plus an optional resistance per exercise) for starting a new workout. No
  sets, reps or weight are stored; those are entered fresh each time.
- **UserProfile** — one per user (created on first access): preferred unit
  (`weight_unit`: `lb` → ft/in & mi, `kg` → cm & km), plus optional vitals:
  `height_cm`, `sex`, `date_of_birth`, `avg_bpm` (resting). Height is always
  stored metric; the frontend converts for display. The profile's `weight_kg`
  is read-only: the latest **BodyweightLog** entry.
- **BodyweightLog** — dated bodyweight history, one entry per user per day.
  When a workout is saved, the server copies the weight in effect on its date
  (latest entry on or before it, else the earliest entry) into the workout's
  read-only `bodyweight_kg`. It's a snapshot: editing or deleting history never
  changes a logged workout. It's only re-taken if the workout's date changes.
  Workouts saved with no weight on record are filled in (calisthenics totals
  included) as soon as a weight is logged or corrected.
- **Calisthenics sets** store their total load in `weight` (snapshot
  bodyweight + `added_weight`), computed server-side — e.g. 130 lb bodyweight
  with `added_weight: 25` is stored as `weight: 155`. Clients send only
  `added_weight`; stats read `weight` like any other set.

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

Base path `/api/`. Everything except register and login requires an
`Authorization: Token <token>` header.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register/` | Create an account `{username, password, email?}`; returns `{token, user}` |
| POST | `/auth/login/` | `{username, password}`; returns `{token, user}` |
| POST | `/auth/logout/` | Revoke the current token |
| GET | `/auth/me/` | The signed-in user, with their profile nested |
| GET/POST | `/exercises/` | List built-in + your custom exercises / create a custom one. Filters: `?category=`, `?muscle_group=`, `?is_custom=` |
| GET/POST | `/workouts/` | List (newest first) / create a workout with nested `entries` |
| GET/PATCH/DELETE | `/workouts/{id}/` | Retrieve / update / delete a workout |
| GET/POST | `/templates/` | List / create a workout template with nested `exercises` |
| GET/PATCH/DELETE | `/templates/{id}/` | Retrieve / update / delete a template |
| GET/POST | `/bodyweight/` | Bodyweight history (newest first) / log a `{date, weight_kg}` — replaces that date's entry if one exists |
| GET/PATCH/DELETE | `/bodyweight/{id}/` | Retrieve / correct / delete one entry |
| GET/PATCH | `/profile/` | The signed-in user's unit preference and vitals (also nested on `/auth/me/`) |

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
