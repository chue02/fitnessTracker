from django.core.management.base import BaseCommand

from workouts.models import Exercise, WorkoutEntry

# (name, muscle_group, circuit, secondary_muscles). Equipment/resistance is NOT
# stored here — it is chosen per set when logging (see WorkoutEntry.equipment).
# Common movements that don't appear in the user's journal; kept as library extras.
STRENGTH = [
    ("Front Squat", "quads", "legs", "Glutes, Hamstrings"),
    ("Romanian Deadlift", "hamstrings", "legs", "Glutes, Back"),
    ("Barbell Row", "back", "pull", "Lats, Biceps"),
    ("Plank", "abs", "core", ""),
]

# Exercises imported from the user's exercise journal (same tuple shape as
# STRENGTH). Muscle/circuit are the dominant value observed per exercise; the
# journal spelling is canonical (duplicates of the STRENGTH extras were dropped).
JOURNAL = [
    ("Bayesian Curls", "biceps", "pull", "Biceps (Long)"),
    ("Bicep Curl", "biceps", "pull", ""),
    ("Calf Raises", "calves", "legs", ""),
    ("Chest Press", "chest", "push", "Triceps, Shoulders"),
    ("Concentrated Bicel Curl", "biceps", "pull", "Biceps (Short)"),
    ("Concentrated Hammer Curl", "forearms", "pull", "Biceps (Long)"),
    ("Crunch", "abs", "core", ""),
    ("Deadlifts", "glutes", "legs", "Hamstrings, Quads, Back"),
    ("Dips", "chest", "push", "Chest (Lower), Triceps"),
    ("Face Pulls", "back", "pull", "Traps, Rhomboids, Delts"),
    ("Front Raises", "shoulders", "push", ""),
    ("Hack Press", "quads", "legs", "Hamstrings, Calves"),
    ("Hammer Curl", "forearms", "pull", ""),
    ("High Pec Flys", "chest", "push", "Chest (Lower), Chest (Inner)"),
    ("High Rows", "back", "pull", "Traps, Rhomboids"),
    ("Hip Abduction", "glutes", "legs", ""),
    ("Hip Adduction", "quads", "legs", "Quads (Inner)"),
    ("Incline Bicep Curl", "biceps", "pull", "Biceps (Long)"),
    ("Incline Chest Press", "chest", "push", "Chest (Upper), Triceps"),
    ("Incline Pec Flys", "chest", "push", "Chest (Upper), Chest (Inner)"),
    ("Incline Push Ups", "chest", "push", "Chest (Lower), Triceps"),
    ("Incline Row", "back", "pull", ""),
    ("Inner Wrist Curl", "forearms", "pull", ""),
    ("Iso High Rows", "back", "pull", "Traps"),
    ("Iso Lat Pulldown", "back", "pull", "Lats, Biceps"),
    ("Iso Low Row", "back", "pull", "Lats, Rhomboids"),
    ("Kickback", "triceps", "push", ""),
    ("Lat Pulldown", "back", "pull", "Lats, Biceps"),
    ("Lateral Raises", "shoulders", "push", ""),
    ("Leg Curls", "hamstrings", "legs", ""),
    ("Leg Extensions", "quads", "legs", ""),
    ("Leg Press", "quads", "legs", "Hamstrings, Glutes"),
    ("Low Pec Flys", "chest", "push", "Chest (Upper)"),
    ("Low Row", "back", "pull", "Lats, Rhomboids"),
    ("Lunges", "glutes", "legs", "Quads, Hamstrings"),
    ("Meadows Row", "back", "pull", ""),
    ("Mts. Crunch", "abs", "core", ""),
    ("Outer Wrist Curl", "forearms", "pull", ""),
    ("Overhead Tricep Extension", "triceps", "push", ""),
    ("Pec Flys", "chest", "push", "Chest (Inner), Shoulders"),
    ("Preacher Bicep Curl", "biceps", "pull", ""),
    ("Pull Ups", "back", "pull", "Biceps"),
    ("Pullover", "chest", "push", "Chest (Lower)"),
    ("Rear Delts", "back", "pull", "Traps, Rhomboids, Delts"),
    ("Reverse Flys", "back", "pull", "Traps, Rhomboids, Delts"),
    ("Row", "back", "pull", ""),
    ("Shoulder Press", "shoulders", "push", ""),
    ("Shrugs", "back", "pull", "Traps"),
    ("Single Romanian Deadlifts", "hamstrings", "legs", "Glutes"),
    ("Skull Crushers", "triceps", "push", ""),
    ("Split Squats", "quads", "legs", "Glutes, Hamstrings"),
    ("Squats", "quads", "legs", "Glutes, Hamstrings"),
    ("Torso Rotation", "abs", "core", "Obliques"),
    ("Tricep Extension", "triceps", "push", ""),
    ("Tricep Pushdown", "triceps", "push", ""),
    ("Upright Rows", "back", "pull", "Traps, Delts"),
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
        for name, muscle_group, circuit, secondary in STRENGTH + JOURNAL:
            _, was_created = Exercise.objects.update_or_create(
                name=name,
                owner=None,
                defaults={
                    "category": Exercise.Category.STRENGTH,
                    "muscle_group": muscle_group,
                    "circuit": circuit,
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
