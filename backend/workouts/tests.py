from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Exercise, Workout, WorkoutEntry


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


class ExerciseApiTests(APITestCase):
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


class WorkoutEntryEquipmentTests(APITestCase):
    def test_log_set_with_resistance(self):
        """Resistance is chosen per set and round-trips through the workout API."""
        ex = Exercise.objects.create(name="Bicep Curl", muscle_group="biceps")
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
