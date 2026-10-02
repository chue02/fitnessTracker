from django.contrib.auth.models import User
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from .models import BodyweightLog, Exercise, Workout, WorkoutEntry, WorkoutTemplate


class ExerciseModelTests(APITestCase):
    def test_new_fields_default_blank(self):
        """secondary_muscles is optional; split is blank when muscle has no split."""
        ex = Exercise.objects.create(name="Some Lift")  # muscle_group='other'
        self.assertEqual(ex.split, "")
        self.assertEqual(ex.secondary_muscles, "")

    def test_granular_muscle_group_accepted(self):
        ex = Exercise.objects.create(
            name="Preacher Curl", muscle_group=Exercise.MuscleGroup.BICEPS
        )
        self.assertEqual(ex.muscle_group, "biceps")

    def test_split_is_derived_from_muscle_group(self):
        cases = {"chest": "push", "back": "pull", "quads": "legs", "abs": "core"}
        for muscle, split in cases.items():
            ex = Exercise.objects.create(name=f"Test {muscle}", muscle_group=muscle)
            self.assertEqual(ex.split, split)


class AuthedTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("alice", password="pw")
        self.client.force_authenticate(self.user)


class ExerciseApiTests(AuthedTestCase):
    def test_create_exercise_derives_split(self):
        resp = self.client.post(
            "/api/exercises/",
            {
                "name": "Incline Bicep Curl",
                "category": "strength",
                "muscle_group": "biceps",
                "split": "legs",  # ignored: split is read-only / derived
                "secondary_muscles": "Biceps (Long)",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        # Derived from muscle_group (biceps -> pull), NOT the posted "legs".
        self.assertEqual(resp.data["split"], "pull")
        self.assertEqual(resp.data["secondary_muscles"], "Biceps (Long)")
        self.assertTrue(resp.data["is_custom"])
        # Equipment is no longer a property of the exercise.
        self.assertNotIn("equipment", resp.data)


class WorkoutEntryEquipmentTests(AuthedTestCase):
    def test_log_set_with_resistance(self):
        """Resistance is chosen per set and round-trips through the workout API."""
        ex = Exercise.objects.create(
            name="Bicep Curl", muscle_group="biceps", is_custom=False
        )
        resp = self.client.post(
            "/api/workouts/",
            {
                "date": "2026-09-04",
                "entries": [
                    {"exercise": ex.id, "reps": 10, "weight": "40.0",
                     "equipment": "dumbbell"},
                    {"exercise": ex.id, "reps": 8, "weight": "60.0",
                     "equipment": "barbell"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        equip = [e["equipment"] for e in resp.data["entries"]]
        self.assertEqual(equip, ["dumbbell", "barbell"])

    def test_equipment_optional(self):
        ex = Exercise.objects.create(name="Plank", muscle_group="abs")
        entry = WorkoutEntry.objects.create(
            workout=Workout.objects.create(), exercise=ex, reps=1
        )
        self.assertEqual(entry.equipment, "")


class SeedExercisesTests(APITestCase):
    def test_seed_uses_journal_names_and_is_idempotent(self):
        call_command("seed_exercises")
        call_command("seed_exercises")  # second run must not duplicate

        # Journal spelling is canonical; the hand-seed duplicates are absent.
        self.assertTrue(Exercise.objects.filter(name="Squats", owner=None).exists())
        self.assertTrue(Exercise.objects.filter(name="Bicep Curl", owner=None).exists())
        self.assertFalse(Exercise.objects.filter(name="Back Squat").exists())
        self.assertFalse(Exercise.objects.filter(name="Dumbbell Curl").exists())

        lat = Exercise.objects.get(name="Lat Pulldown", owner=None)
        self.assertEqual(lat.split, "pull")
        self.assertEqual(lat.muscle_group, "back")
        self.assertEqual(lat.secondary_muscles, "Lats, Biceps")
        self.assertFalse(lat.is_custom)

        self.assertEqual(
            Exercise.objects.filter(name="Lat Pulldown", owner=None).count(), 1
        )

    def test_seed_keeps_referenced_stale_exercise(self):
        """A built-in that a workout references is pruned-safe (FK is PROTECT)."""
        stale = Exercise.objects.create(
            name="Legacy Move", is_custom=False, owner=None
        )
        WorkoutEntry.objects.create(
            workout=Workout.objects.create(), exercise=stale, reps=5
        )
        call_command("seed_exercises")
        self.assertTrue(Exercise.objects.filter(name="Legacy Move").exists())


class OwnershipTests(AuthedTestCase):
    def setUp(self):
        super().setUp()
        self.bob = User.objects.create_user("bob", password="pw")
        self.builtin = Exercise.objects.create(name="Squats", is_custom=False)
        self.bobs_ex = Exercise.objects.create(name="Bob Lift", owner=self.bob)
        self.bobs_workout = Workout.objects.create(owner=self.bob)

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/workouts/").status_code, 401)
        self.assertEqual(self.client.get("/api/exercises/").status_code, 401)

    def test_sees_builtins_and_own_exercises_only(self):
        self.client.post(
            "/api/exercises/", {"name": "Alice Lift"}, format="json"
        )
        names = {e["name"] for e in self.client.get("/api/exercises/").data}
        self.assertEqual(names, {"Squats", "Alice Lift"})

    def test_cannot_read_or_modify_others_workouts(self):
        self.assertEqual(self.client.get("/api/workouts/").data, [])
        url = f"/api/workouts/{self.bobs_workout.id}/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)

    def test_new_workout_is_owned_by_creator(self):
        resp = self.client.post(
            "/api/workouts/", {"date": "2026-09-04", "entries": []}, format="json"
        )
        self.assertEqual(Workout.objects.get(pk=resp.data["id"]).owner, self.user)

    def test_cannot_edit_builtin_or_others_exercise(self):
        for ex in (self.builtin, self.bobs_ex):
            resp = self.client.patch(
                f"/api/exercises/{ex.id}/", {"name": "x"}, format="json"
            )
            self.assertEqual(resp.status_code, 404)

    def test_cannot_log_others_custom_exercise(self):
        resp = self.client.post(
            "/api/workouts/",
            {"date": "2026-09-04", "entries": [{"exercise": self.bobs_ex.id, "reps": 5}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_duplicate_exercise_name_is_a_validation_error(self):
        self.client.post("/api/exercises/", {"name": "Alice Lift"}, format="json")
        resp = self.client.post("/api/exercises/", {"name": "Alice Lift"}, format="json")
        self.assertEqual(resp.status_code, 400)
        # Another user may reuse the name.
        self.client.force_authenticate(self.bob)
        resp = self.client.post("/api/exercises/", {"name": "Alice Lift"}, format="json")
        self.assertEqual(resp.status_code, 201)


class WorkoutTemplateTests(AuthedTestCase):
    def setUp(self):
        super().setUp()
        self.bench = Exercise.objects.create(name="Bench", muscle_group="chest", is_custom=False)
        self.row = Exercise.objects.create(name="Row", muscle_group="back", is_custom=False)

    def test_create_keeps_exercise_order_only(self):
        resp = self.client.post(
            "/api/templates/",
            {
                "name": "Push A",
                "exercises": [
                    {"exercise": self.row.id, "order": 0},
                    {"exercise": self.bench.id, "order": 1, "equipment": "dumbbell"},
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual([e["exercise_name"] for e in resp.data["exercises"]], ["Row", "Bench"])
        self.assertEqual(resp.data["exercises"][1]["equipment"], "dumbbell")
        # A skeleton: no set/rep/weight data exists on the template.
        self.assertNotIn("reps", resp.data["exercises"][0])
        self.assertEqual(WorkoutTemplate.objects.get().owner, self.user)

    def test_update_replaces_exercises(self):
        t = self.client.post(
            "/api/templates/",
            {"name": "T", "exercises": [{"exercise": self.bench.id}]},
            format="json",
        ).data
        resp = self.client.patch(
            f"/api/templates/{t['id']}/",
            {"exercises": [{"exercise": self.row.id, "order": 0}]},
            format="json",
        )
        self.assertEqual([e["exercise"] for e in resp.data["exercises"]], [self.row.id])

    def test_empty_template_rejected(self):
        resp = self.client.post(
            "/api/templates/", {"name": "T", "exercises": []}, format="json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_templates_are_private(self):
        bob = User.objects.create_user("bob", password="pw")
        bobs_ex = Exercise.objects.create(name="Bob Lift", owner=bob)
        bobs = WorkoutTemplate.objects.create(name="Bob's", owner=bob)
        self.assertEqual(self.client.get("/api/templates/").data, [])
        self.assertEqual(self.client.get(f"/api/templates/{bobs.id}/").status_code, 404)
        resp = self.client.post(
            "/api/templates/",
            {"name": "T", "exercises": [{"exercise": bobs_ex.id}]},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class UserProfileTests(AuthedTestCase):
    def test_profile_created_on_first_read_with_defaults(self):
        resp = self.client.get("/api/profile/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["weight_unit"], "lb")
        self.assertIsNone(resp.data["height_cm"])
        self.assertIsNone(resp.data["avg_bpm"])

    def test_patch_vitals_round_trip(self):
        resp = self.client.patch(
            "/api/profile/",
            {
                "weight_unit": "kg",
                "height_cm": "180.3",
                "sex": "female",
                "date_of_birth": "1995-04-12",
                "avg_bpm": 62,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        profile = self.client.get("/api/profile/").data
        self.assertEqual(profile["weight_unit"], "kg")
        self.assertEqual(profile["height_cm"], "180.3")
        self.assertEqual(profile["sex"], "female")
        self.assertEqual(profile["avg_bpm"], 62)

    def test_fields_can_be_cleared(self):
        self.client.patch("/api/profile/", {"avg_bpm": 60, "sex": "male"}, format="json")
        resp = self.client.patch("/api/profile/", {"avg_bpm": None, "sex": ""}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertIsNone(resp.data["avg_bpm"])
        self.assertEqual(resp.data["sex"], "")

    def test_implausible_values_rejected(self):
        for field, value in [
            ("height_cm", "5"),
            ("avg_bpm", 400),
            ("weight_unit", "stone"),
            ("date_of_birth", "2999-01-01"),
        ]:
            resp = self.client.patch("/api/profile/", {field: value}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, field)

    def test_me_includes_profile(self):
        self.client.patch("/api/profile/", {"weight_unit": "kg"}, format="json")
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.data["profile"]["weight_unit"], "kg")

    def test_profile_is_per_user(self):
        self.client.patch("/api/profile/", {"avg_bpm": 55}, format="json")
        bob = User.objects.create_user("bob", password="pw")
        self.client.force_authenticate(bob)
        self.assertIsNone(self.client.get("/api/profile/").data["avg_bpm"])

    def test_requires_login(self):
        self.client.force_authenticate(None)
        resp = self.client.get("/api/profile/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class BodyweightTests(AuthedTestCase):
    def setUp(self):
        super().setUp()
        self.pullups = Exercise.objects.create(
            name="Pull Ups", muscle_group="back", is_custom=False
        )

    def log(self, date, kg):
        return self.client.post(
            "/api/bodyweight/", {"date": date, "weight_kg": kg}, format="json"
        )

    def pullup_set(self, added=None, **extra):
        return {
            "exercise": self.pullups.id,
            "reps": 8,
            "equipment": "calisthenics",
            "weight_unit": "lb",
            "added_weight": added,
            **extra,
        }

    def make_workout(self, date, *entries):
        resp = self.client.post(
            "/api/workouts/",
            {"date": date, "entries": list(entries) or [self.pullup_set()]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return resp.data["id"]

    def get(self, workout_id):
        return self.client.get(f"/api/workouts/{workout_id}/").data

    def test_later_weight_does_not_change_earlier_workouts(self):
        """200 lb in September, 190 lb in October: each month keeps its own."""
        self.log("2026-09-01", "90.72")  # 200 lb
        sept = self.make_workout("2026-09-15")
        self.log("2026-10-01", "86.18")  # 190 lb
        octo = self.make_workout("2026-10-05")

        self.assertEqual(self.get(sept)["bodyweight_kg"], "90.72")
        self.assertEqual(self.get(sept)["entries"][0]["weight"], "200.00")
        self.assertEqual(self.get(octo)["entries"][0]["weight"], "190.00")

    def test_added_weight_is_stored_as_total(self):
        """130 lb bodyweight + 25 lb attached is stored as 155 lb."""
        self.log("2026-10-01", "58.97")  # 130 lb
        wid = self.make_workout("2026-10-05", self.pullup_set(added="25"))
        entry = self.get(wid)["entries"][0]
        self.assertEqual(entry["weight"], "155.00")
        self.assertEqual(entry["added_weight"], "25.00")

    def test_total_in_kg_for_kg_sets(self):
        self.log("2026-10-01", "58.97")
        wid = self.make_workout("2026-10-05", self.pullup_set(added="10", weight_unit="kg"))
        self.assertEqual(self.get(wid)["entries"][0]["weight"], "68.97")

    def test_client_cannot_set_calisthenics_total(self):
        self.log("2026-10-01", "58.97")
        wid = self.make_workout("2026-10-05", self.pullup_set(added="25", weight="999"))
        self.assertEqual(self.get(wid)["entries"][0]["weight"], "155.00")

    def test_deleting_history_does_not_change_logged_workouts(self):
        self.log("2026-09-01", "90.72")
        entry_id = BodyweightLog.objects.get(owner=self.user).id
        wid = self.make_workout("2026-09-15", self.pullup_set(added="25"))
        self.client.delete(f"/api/bodyweight/{entry_id}/")

        workout = self.get(wid)
        self.assertEqual(workout["bodyweight_kg"], "90.72")
        self.assertEqual(workout["entries"][0]["weight"], "225.00")

        # Re-saving the workout (the editor resends every entry) keeps it too.
        resp = self.client.patch(
            f"/api/workouts/{wid}/",
            {"notes": "edited", "entries": [self.pullup_set(added="25")]},
            format="json",
        )
        self.assertEqual(resp.data["bodyweight_kg"], "90.72")
        self.assertEqual(resp.data["entries"][0]["weight"], "225.00")

    def test_changing_history_does_not_change_logged_workouts(self):
        self.log("2026-09-01", "90.72")
        wid = self.make_workout("2026-09-15")
        self.log("2026-09-01", "80")  # correct that day's entry
        self.log("2026-09-10", "85")  # backfill one closer to the workout
        self.client.patch(
            f"/api/workouts/{wid}/", {"entries": [self.pullup_set()]}, format="json"
        )
        self.assertEqual(self.get(wid)["entries"][0]["weight"], "200.00")

    def test_backdated_workout_uses_weight_from_its_date(self):
        self.log("2026-09-01", "90.72")
        self.log("2026-10-01", "86.18")
        late = self.make_workout("2026-09-20")
        self.assertEqual(self.get(late)["bodyweight_kg"], "90.72")

    def test_moving_workout_to_another_date_resnapshots(self):
        self.log("2026-09-01", "90.72")
        self.log("2026-10-01", "86.18")
        wid = self.make_workout("2026-09-15", self.pullup_set(added="25"))
        resp = self.client.patch(f"/api/workouts/{wid}/", {"date": "2026-10-05"}, format="json")
        self.assertEqual(resp.data["bodyweight_kg"], "86.18")
        self.assertEqual(resp.data["entries"][0]["weight"], "215.00")

    def test_logging_weight_fills_workouts_without_one(self):
        """Workouts saved before any weight was on record pick it up as soon
        as one is logged, calisthenics totals included."""
        aug = self.make_workout("2026-08-01", self.pullup_set(added="25"))
        sept = self.make_workout("2026-09-20")
        self.assertIsNone(self.get(aug)["bodyweight_kg"])
        self.assertIsNone(self.get(aug)["entries"][0]["weight"])

        self.log("2026-09-10", "90.72")  # 200 lb

        # Each resolves by its own date (Aug predates the log: earliest entry).
        self.assertEqual(self.get(aug)["bodyweight_kg"], "90.72")
        self.assertEqual(self.get(aug)["entries"][0]["weight"], "225.00")
        self.assertEqual(self.get(sept)["entries"][0]["weight"], "200.00")
        self.assertEqual(self.get(aug)["entries"][0]["added_weight"], "25.00")

    def test_logging_weight_leaves_existing_snapshots_alone(self):
        self.log("2026-09-01", "90.72")
        wid = self.make_workout("2026-09-15")
        self.log("2026-09-10", "85")  # closer to the workout's date
        self.log("2026-09-01", "80")  # same-day correction
        self.assertEqual(self.get(wid)["bodyweight_kg"], "90.72")
        self.assertEqual(self.get(wid)["entries"][0]["weight"], "200.00")

    def test_editing_a_log_entry_fills_workouts_without_one(self):
        wid = self.make_workout("2026-09-15")
        bob = User.objects.create_user("bob", password="pw")
        entry = BodyweightLog.objects.create(owner=self.user, date="2026-09-01", weight_kg="90")
        self.client.patch(f"/api/bodyweight/{entry.id}/", {"weight_kg": "90.72"}, format="json")
        self.assertEqual(self.get(wid)["entries"][0]["weight"], "200.00")
        # Another user's history never fills this user's workouts, or vice versa.
        self.client.force_authenticate(bob)
        self.assertIsNone(self.get(self.make_workout("2026-09-15"))["bodyweight_kg"])

    def test_added_weight_only_kept_for_calisthenics(self):
        self.log("2026-10-01", "58.97")
        wid = self.make_workout(
            "2026-10-05",
            self.pullup_set(added="25", equipment="barbell", weight="100"),
        )
        entry = self.get(wid)["entries"][0]
        self.assertEqual(entry["weight"], "100.00")
        self.assertIsNone(entry["added_weight"])

    def test_same_day_log_replaces_weight(self):
        self.assertEqual(self.log("2026-10-01", "86").status_code, status.HTTP_201_CREATED)
        resp = self.log("2026-10-01", "85.5")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(BodyweightLog.objects.filter(owner=self.user).count(), 1)
        self.assertEqual(resp.data["weight_kg"], "85.50")

    def test_profile_reports_latest_weight_read_only(self):
        self.log("2026-09-01", "90.72")
        self.log("2026-10-01", "86.18")
        self.assertEqual(self.client.get("/api/profile/").data["weight_kg"], "86.18")
        self.client.patch("/api/profile/", {"weight_kg": "50"}, format="json")
        self.assertEqual(self.client.get("/api/profile/").data["weight_kg"], "86.18")

    def test_implausible_weight_rejected(self):
        self.assertEqual(self.log("2026-10-01", "1000").status_code, status.HTTP_400_BAD_REQUEST)

    def test_history_is_private(self):
        self.log("2026-10-01", "86")
        bob = User.objects.create_user("bob", password="pw")
        self.client.force_authenticate(bob)
        self.assertEqual(self.client.get("/api/bodyweight/").data, [])
        self.assertIsNone(self.get(self.make_workout("2026-10-05"))["bodyweight_kg"])
