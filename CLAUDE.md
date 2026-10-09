# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Full-stack strength + cardio workout tracker: Django 5 / DRF backend (`backend/`, single app `workouts`) and a React 18 + Vite 4 SPA (`frontend/`). SQLite in dev. Frontend is pinned to Vite 4 / React 18 for Node 16 support — don't bump them casually; an `EBADENGINE` warning on `npm install` is expected and harmless.

## Commands

Backend (run from `backend/`, using the checked-in venv):

```bash
venv/bin/pip install -r requirements.txt
venv/bin/python manage.py migrate
venv/bin/python manage.py seed_exercises      # idempotent; re-run after editing the library
venv/bin/python manage.py runserver           # :8000
venv/bin/python manage.py makemigrations workouts

venv/bin/python manage.py test workouts                                   # all tests
venv/bin/python manage.py test workouts.tests.BodyweightTests             # one class
venv/bin/python manage.py test workouts.tests.BodyweightTests.test_same_day_log_replaces_weight  # one test
```

Frontend (run from `frontend/`): `npm run dev` (:5173, proxies `/api` → `localhost:8000`, so run both servers), `npm run build`. There is no linter or frontend test runner configured.

## Architecture

### Backend (`backend/workouts/`)

- `urls.py` mounts a DRF router (`exercises`, `workouts`, `templates`, `bodyweight`) plus `auth/{register,login,logout,me}/` and a singleton `profile/` under `/api/`.
- `auth.py` — token auth (`Authorization: Token <key>`). `DEFAULT_PERMISSION_CLASSES` is `IsAuthenticated`; register/login opt out with `AllowAny`. `/auth/me/` nests the user's profile.
- **Ownership is enforced in `get_queryset`** of each viewset (filter by `request.user`) and `perform_create` sets `owner`. Exercises are special: reads use `Exercise.objects.visible_to(user)` (built-in library where `owner=None, is_custom=False`, plus the user's own); writes only see the user's own rows, so built-ins are read-only. Nested serializers that reference an exercise re-check `visible_to` so users can't log another user's custom exercise.
- **Nested writes replace children wholesale.** `WorkoutSerializer`, `WorkoutTemplateSerializer` and `UserProfileSerializer.favorites` delete and `bulk_create` the child rows on every write that includes them; omitting the nested key on PATCH leaves children untouched. `order` fields carry list position.
- **Strength and cardio share `WorkoutEntry`.** `Exercise.category` decides which fields may be set; `WorkoutEntrySerializer.validate` rejects cross-category fields.
- **`split` is derived, never stored**: `Exercise.MUSCLE_TO_SPLIT` maps muscle group → push/pull/legs/core. The frontend mirrors this map in `format.js` — keep them in sync.
- **Equipment ("resistance") is per set**, not per exercise (`WorkoutEntry.equipment`). Templates and favorites store an optional equipment to identify a lift variant.
- **Bodyweight snapshot model** (most subtle logic; heavily covered by `BodyweightTests`):
  - `BodyweightLog` is dated history, one row per user per day (POST to an existing date updates it). `BodyweightLog.objects.as_of(day)` = latest on/before the day, else earliest.
  - On workout create, `Workout.bodyweight_kg` is copied from `as_of(date)`. It's a snapshot: later history edits don't change it. It's only re-taken if the workout's date changes or it was null.
  - Calisthenics sets: client sends `added_weight`; server computes `weight = bodyweight (in set's unit) + added_weight` via `WorkoutEntry.apply_bodyweight`. Clients can't set the calisthenics total.
  - Logging/editing a bodyweight runs `fill_missing_bodyweights(owner)` to fill workouts that had no snapshot and re-total their calisthenics sets.
- `UserProfile` is get-or-created on first access. Height is always stored in cm; `weight_kg` is read-only (latest `BodyweightLog`). `weight_unit` (`lb`/`kg`) is the display/entry preference (lb ↔ ft/in & mi, kg ↔ cm & km).
- `FavoriteExercise` (max 5, `MAX_PER_USER` mirrored as `MAX_FAVORITES` in `frontend/src/favorites.js`): lifts use `equipment`, cardio uses `min_distance`; the serializer clears whichever doesn't apply. Duplicate detection for null `min_distance` happens in the serializer because DB unique constraints ignore NULLs.
- `management/commands/seed_exercises.py` holds the built-in library (lists `STRENGTH`, `JOURNAL`, `CARDIO`). It upserts by name and prunes built-ins no longer listed unless referenced by a logged entry (`PROTECT` FK).

### Frontend (`frontend/src/`)

- `api.js` — thin `fetch` wrapper (`api.get/post/patch/del`) using relative `/api` paths, attaching the token from `localStorage`; a 401 clears the token. Errors carry `.status` and `.detail` (DRF error body); render them with `errorMessage()` from `format.js`.
- `auth.jsx` — `AuthProvider`/`useAuth()` (`user`, `loading`, `login`, `register`, `logout`, `setProfile`). The user object includes `profile`; call `setProfile` after a profile PATCH so units/favorites update app-wide. `ProtectedRoute` in `App.jsx` waits for `loading` to avoid a login flash. `/` is the only public route and picks `MemberHome` vs `GuestHome`.
- **All stats/PRs are computed client-side** in `stats.js` as pure functions over the full `GET /api/workouts/` list (there are no aggregate endpoints). Key conventions there: DecimalFields arrive as **strings**; units are per set so weights are normalized to lb (`toLb`) for comparison; warmups and null-weight sets are excluded (`isWorkingSet`); PRs are per exercise **and** equipment; cardio records are per session (segments summed). Home cards and the Records page share `prHistory`/`cardioHistory` so they always agree.
- `format.js` — shared display helpers. **Dates are `YYYY-MM-DD` local days**: use `isoDate`/`parseIso`, never `toISOString()` or `new Date('YYYY-MM-DD')` (both shift the day via UTC).
- `NewWorkout.jsx` handles both create and edit (`/workouts/:id/edit`). The editor works on "blocks" (one exercise + its entries); `templates.js` converts between blocks, saved workouts and templates. Drag-and-drop reordering uses `@dnd-kit` via `components/SortableItem.jsx`.
- Styling is a single global `styles.css` with plain class names.
