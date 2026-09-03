from django.core.management.base import BaseCommand

from workouts.models import Exercise

STRENGTH = [
    ("Back Squat", "legs"),
    ("Front Squat", "legs"),
    ("Leg Press", "legs"),
    ("Lunge", "legs"),
    ("Deadlift", "back"),
    ("Romanian Deadlift", "legs"),
    ("Barbell Row", "back"),
    ("Pull-up", "back"),
    ("Lat Pulldown", "back"),
    ("Bench Press", "chest"),
    ("Overhead Press", "shoulders"),
    ("Face Pull", "shoulders"),
    ("Dumbbell Curl", "arms"),
    ("Tricep Pushdown", "arms"),
    ("Plank", "core"),
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

        for name, muscle_group in STRENGTH:
            _, was_created = Exercise.objects.get_or_create(
                name=name,
                owner=None,
                defaults={
                    "category": Exercise.Category.STRENGTH,
                    "muscle_group": muscle_group,
                    "is_custom": False,
                },
            )
            created += int(was_created)

        for name in CARDIO:
            _, was_created = Exercise.objects.get_or_create(
                name=name,
                owner=None,
                defaults={
                    "category": Exercise.Category.CARDIO,
                    "muscle_group": Exercise.MuscleGroup.CARDIO,
                    "is_custom": False,
                },
            )
            created += int(was_created)

        total = len(STRENGTH) + len(CARDIO)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {created} new, {total - created} already present."
            )
        )
