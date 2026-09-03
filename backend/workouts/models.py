from django.conf import settings
from django.db import models
from django.utils import timezone


class Exercise(models.Model):
    """A movement that can be logged. Seeded library items have is_custom=False;
    users can add their own. `category` drives which entry fields are relevant."""

    class Category(models.TextChoices):
        STRENGTH = "strength", "Strength"
        CARDIO = "cardio", "Cardio"

    class MuscleGroup(models.TextChoices):
        CHEST = "chest", "Chest"
        BACK = "back", "Back"
        LEGS = "legs", "Legs"
        SHOULDERS = "shoulders", "Shoulders"
        ARMS = "arms", "Arms"
        CORE = "core", "Core"
        CARDIO = "cardio", "Cardio"
        OTHER = "other", "Other"

    name = models.CharField(max_length=100)
    category = models.CharField(
        max_length=16, choices=Category.choices, default=Category.STRENGTH
    )
    muscle_group = models.CharField(
        max_length=16, choices=MuscleGroup.choices, default=MuscleGroup.OTHER
    )
    is_custom = models.BooleanField(default=True)
    # Nullable now so per-user ownership can be added later without a backfill.
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="exercises",
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "name"], name="unique_exercise_name_per_owner"
            )
        ]

    def __str__(self):
        return self.name


class Workout(models.Model):
    """A dated training session. Can mix strength and cardio entries."""

    date = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="workouts",
    )

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"Workout on {self.date}"


class WorkoutEntry(models.Model):
    """One row = one set (strength) or one segment (cardio) within a workout.

    Strength and cardio share this table; only the fields relevant to the
    exercise's category are populated, the rest stay null."""

    class WeightUnit(models.TextChoices):
        LB = "lb", "lb"
        KG = "kg", "kg"

    class DistanceUnit(models.TextChoices):
        MI = "mi", "mi"
        KM = "km", "km"

    workout = models.ForeignKey(
        Workout, on_delete=models.CASCADE, related_name="entries"
    )
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name="+")
    order = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)

    # Strength fields
    reps = models.PositiveIntegerField(null=True, blank=True)
    weight = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    weight_unit = models.CharField(
        max_length=2, choices=WeightUnit.choices, default=WeightUnit.LB
    )
    is_warmup = models.BooleanField(default=False)

    # Cardio fields
    distance = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    distance_unit = models.CharField(
        max_length=2, choices=DistanceUnit.choices, default=DistanceUnit.MI
    )
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    avg_heart_rate = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.exercise.name} ({self.workout.date})"
