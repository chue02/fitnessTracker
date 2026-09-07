from django.core.management.base import BaseCommand

from workouts.models import Exercise, WorkoutEntry

# (name, muscle_group, secondary_muscles). Split is DERIVED from muscle_group on
# the model, so it is not stored here. Equipment/resistance is chosen per set
# when logging (see WorkoutEntry.equipment).
# Common movements that don't appear in the user's journal; kept as library extras.
STRENGTH = [
    ("Front Squat", "quads", "Glutes, Hamstrings"),
    ("Romanian Deadlift", "hamstrings", "Glutes, Back"),
    ("Plank", "abs", ""),
]

# Exercises imported from the user's exercise journal (same tuple shape as
# STRENGTH). Muscle is the dominant value observed per exercise; the journal
# spelling is canonical (duplicates of the STRENGTH extras were dropped).
JOURNAL = [
    ("Bayesian Curls", "biceps", "Biceps (Long)"),
    ("Bicep Curl", "biceps", ""),
    ("Calf Raises", "calves", ""),
    ("Chest Press", "chest", "Triceps, Shoulders"),
    ("Concentrated Bicel Curl", "biceps", "Biceps (Short)"),
    ("Concentrated Hammer Curl", "forearms", "Biceps (Long)"),
    ("Crunch", "abs", ""),
    ("Deadlifts", "glutes", "Hamstrings, Quads, Back"),
    ("Dips", "chest", "Chest (Lower), Triceps"),
    ("Face Pulls", "back", "Traps, Rhomboids, Delts"),
    ("Front Raises", "shoulders", ""),
    ("Hack Press", "quads", "Hamstrings, Calves"),
    ("Hammer Curl", "forearms", ""),
    ("High Pec Flys", "chest", "Chest (Lower), Chest (Inner)"),
    ("High Rows", "back", "Traps, Rhomboids"),
    ("Hip Abduction", "glutes", ""),
    ("Hip Adduction", "quads", "Quads (Inner)"),
    ("Incline Bicep Curl", "biceps", "Biceps (Long)"),
    ("Incline Chest Press", "chest", "Chest (Upper), Triceps"),
    ("Incline Pec Flys", "chest", "Chest (Upper), Chest (Inner)"),
    ("Incline Push Ups", "chest", "Chest (Lower), Triceps"),
    ("Incline Row", "back", ""),
    ("Inner Wrist Curl", "forearms", ""),
    ("Iso High Rows", "back", "Traps"),
    ("Iso Lat Pulldown", "back", "Lats, Biceps"),
    ("Iso Low Row", "back", "Lats, Rhomboids"),
    ("Kickback", "triceps", ""),
    ("Lat Pulldown", "back", "Lats, Biceps"),
    ("Lateral Raises", "shoulders", ""),
    ("Leg Curls", "hamstrings", ""),
    ("Leg Extensions", "quads", ""),
    ("Leg Press", "quads", "Hamstrings, Glutes"),
    ("Low Pec Flys", "chest", "Chest (Upper)"),
    ("Low Row", "back", "Lats, Rhomboids"),
    ("Lunges", "glutes", "Quads, Hamstrings"),
    ("Meadows Row", "back", ""),
    ("Mts. Crunch", "abs", ""),
    ("Outer Wrist Curl", "forearms", ""),
    ("Overhead Tricep Extension", "triceps", ""),
    ("Pec Flys", "chest", "Chest (Inner), Shoulders"),
    ("Preacher Bicep Curl", "biceps", ""),
    ("Pull Ups", "back", "Biceps"),
    ("Pullover", "chest", "Chest (Lower)"),
    ("Rear Delts", "back", "Traps, Rhomboids, Delts"),
    ("Reverse Flys", "back", "Traps, Rhomboids, Delts"),
    ("Row", "back", ""),
    ("Shoulder Press", "shoulders", ""),
    ("Shrugs", "back", "Traps"),
    ("Single Romanian Deadlifts", "hamstrings", "Glutes"),
    ("Skull Crushers", "triceps", ""),
    ("Split Squats", "quads", "Glutes, Hamstrings"),
    ("Squats", "quads", "Glutes, Hamstrings"),
    ("Torso Rotation", "abs", "Obliques"),
    ("Tricep Extension", "triceps", ""),
    ("Tricep Pushdown", "triceps", ""),
    ("Upright Rows", "back", "Traps, Delts"),
]

CARDIO = [
    "Running",
    "Treadmill",
    "Cycling",
    "Rowing",
    "Elliptical",
    "Stair Climber",
    "Swimming",
    "Jump Rope",
]


class Command(BaseCommand):
    help = "Seed the built-in strength and cardio exercise library (idempotent)."

    def handle(self, *args, **options):
        created = 0

        # update_or_create so re-running refreshes metadata on existing built-ins.
        for name, muscle_group, secondary in STRENGTH + JOURNAL:
            _, was_created = Exercise.objects.update_or_create(
                name=name,
                owner=None,
                defaults={
                    "category": Exercise.Category.STRENGTH,
                    "muscle_group": muscle_group,
                    "secondary_muscles": secondary,
                    "is_custom": False,
                },
            )
            created += int(was_created)

        for name in CARDIO:
            _, was_created = Exercise.objects.update_or_create(
                name=name,
                owner=None,
                defaults={
                    "category": Exercise.Category.CARDIO,
                    "muscle_group": Exercise.MuscleGroup.CARDIO,
                    "is_custom": False,
                },
            )
            created += int(was_created)

        # Prune built-ins that are no longer canonical (e.g. renamed to match the
        # journal). Skip any still referenced by a logged set (FK is PROTECT).
        canonical = (
            {row[0] for row in STRENGTH}
            | {row[0] for row in JOURNAL}
            | set(CARDIO)
        )
        pruned = 0
        stale = Exercise.objects.filter(
            owner=None, is_custom=False
        ).exclude(name__in=canonical)
        for ex in stale:
            if WorkoutEntry.objects.filter(exercise=ex).exists():
                self.stdout.write(
                    self.style.WARNING(f"Kept '{ex.name}': referenced by a workout.")
                )
                continue
            ex.delete()
            pruned += 1

        total = len(STRENGTH) + len(JOURNAL) + len(CARDIO)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {created} new, {total - created} already present, "
                f"{pruned} pruned."
            )
        )
