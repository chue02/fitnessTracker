from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class ExerciseQuerySet(models.QuerySet):
    def visible_to(self, user):
        """The shared built-in library plus the user's own custom exercises."""
        return self.filter(
            models.Q(owner__isnull=True, is_custom=False) | models.Q(owner=user)
        )


class Exercise(models.Model):
    """A movement that can be logged. Seeded library items have is_custom=False;
    users can add their own. `category` drives which entry fields are relevant."""

    objects = ExerciseQuerySet.as_manager()

    class Category(models.TextChoices):
        STRENGTH = "strength", "Strength"
        CARDIO = "cardio", "Cardio"

    class MuscleGroup(models.TextChoices):
        CHEST = "chest", "Chest"
        BACK = "back", "Back"
        SHOULDERS = "shoulders", "Shoulders"
        BICEPS = "biceps", "Biceps"
        TRICEPS = "triceps", "Triceps"
        FOREARMS = "forearms", "Forearms"
        QUADS = "quads", "Quads"
        HAMSTRINGS = "hamstrings", "Hamstrings"
        GLUTES = "glutes", "Glutes"
        CALVES = "calves", "Calves"
        ABS = "abs", "Abs"
        CARDIO = "cardio", "Cardio"
        OTHER = "other", "Other"

    class Split(models.TextChoices):
        PULL = "pull", "Pull"
        PUSH = "push", "Push"
        LEGS = "legs", "Legs"
        CORE = "core", "Core"

    # A muscle group belongs to exactly one split, so `split` is DERIVED from
    # muscle_group (see the property below) and never stored — this makes an
    # inconsistent pairing (e.g. a "chest" exercise tagged "pull") impossible.
    # NOTE: a few movements (e.g. deadlift) arguably span splits; that edge case
    # is intentionally deferred — split follows the primary muscle group for now.
    MUSCLE_TO_SPLIT = {
        "chest": "push", "shoulders": "push", "triceps": "push",
        "back": "pull", "biceps": "pull", "forearms": "pull",
        "quads": "legs", "hamstrings": "legs", "glutes": "legs", "calves": "legs",
        "abs": "core",
    }

    name = models.CharField(max_length=100)
    category = models.CharField(
        max_length=16, choices=Category.choices, default=Category.STRENGTH
    )
    muscle_group = models.CharField(
        max_length=16, choices=MuscleGroup.choices, default=MuscleGroup.OTHER
    )
    # Comma-separated secondary muscles worked, e.g. "Lats, Biceps".
    secondary_muscles = models.CharField(max_length=255, blank=True)
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

    @property
    def split(self):
        """Push/pull/legs/core, derived from muscle_group ("" for cardio/other)."""
        return self.MUSCLE_TO_SPLIT.get(self.muscle_group, "")

    def __str__(self):
        return self.name


LB_PER_KG = Decimal("2.20462")


def bodyweight_in(weight_kg, unit):
    """A kg bodyweight in `unit`. lb is rounded to 0.1 so a weight entered in
    lb survives its trip through kg (130 lb -> 58.97 kg -> 130.0 lb)."""
    if unit == "lb":
        return (weight_kg * LB_PER_KG).quantize(Decimal("0.1"))
    return weight_kg


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
    # The owner's bodyweight for this workout, copied from their history
    # (BodyweightLog.as_of the workout's date) when the workout is saved. A
    # snapshot, not a reference: editing or deleting history afterwards never
    # changes a logged workout. Null if no weight was on record.
    bodyweight_kg = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"Workout on {self.date}"

    def retotal_calisthenics(self):
        """Recompute stored calisthenics totals from the current snapshot."""
        entries = list(self.entries.filter(equipment=WorkoutEntry.Equipment.CALISTHENICS))
        for entry in entries:
            entry.apply_bodyweight(self.bodyweight_kg)
        WorkoutEntry.objects.bulk_update(entries, ["weight"])


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

    class Equipment(models.TextChoices):
        """How the set was loaded (the journal's "Resistance"). Chosen per set;
        every exercise can be performed with any of these."""

        BARBELL = "barbell", "Barbell"
        DUMBBELL = "dumbbell", "Dumbbell"
        CABLE = "cable", "Cable"
        MACHINE = "machine", "Machine"
        PLATES_MACHINE = "plates_machine", "Plate Loaded Machine"
        CALISTHENICS = "calisthenics", "Calisthenics"

    workout = models.ForeignKey(
        Workout, on_delete=models.CASCADE, related_name="entries"
    )
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name="+")
    order = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)

    # Strength fields
    reps = models.PositiveIntegerField(null=True, blank=True)
    # The load moved. For calisthenics this is the TOTAL — the workout's
    # bodyweight plus `added_weight` — computed when saved (see apply_bodyweight).
    weight = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    # Calisthenics only: what the user entered, e.g. +25 for a weighted
    # pull-up. Kept so the set can be edited as "+25" again.
    added_weight = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    weight_unit = models.CharField(
        max_length=2, choices=WeightUnit.choices, default=WeightUnit.LB
    )
    # Resistance used for this set; optional (e.g. cardio, bodyweight).
    equipment = models.CharField(
        max_length=16, choices=Equipment.choices, blank=True
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

    def apply_bodyweight(self, bodyweight_kg):
        """Set a calisthenics set's total `weight` from a bodyweight (kg) and
        its `added_weight`. Unknown bodyweight leaves the total unknown."""
        if self.equipment != self.Equipment.CALISTHENICS:
            self.added_weight = None
            return
        if bodyweight_kg is None:
            self.weight = None
        else:
            self.weight = bodyweight_in(bodyweight_kg, self.weight_unit) + (
                self.added_weight or 0
            )


class BodyweightLogQuerySet(models.QuerySet):
    def as_of(self, day):
        """The weight in effect on `day`: the latest entry on or before it,
        falling back to the earliest entry for days before any were logged.
        None if the user has never logged a weight."""
        on_or_before = self.filter(date__lte=day).order_by("-date").first()
        return on_or_before or self.order_by("date").first()


class BodyweightLog(models.Model):
    """A user's bodyweight as of a date. Logging a new weight adds a row for
    that day and never touches earlier ones. Workouts copy the weight in
    effect on their date when saved (Workout.bodyweight_kg), so changing this
    history later doesn't alter workouts already logged."""

    objects = BodyweightLogQuerySet.as_manager()

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bodyweights",
    )
    date = models.DateField(default=timezone.localdate)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "date"], name="unique_bodyweight_per_day"
            )
        ]

    def __str__(self):
        return f"{self.owner} {self.weight_kg} kg on {self.date}"


def fill_missing_bodyweights(owner):
    """Give the owner's workouts that have NO bodyweight snapshot one from
    their current history, and total their calisthenics sets. Run whenever a
    weight is logged. Workouts that already have a snapshot are left alone, so
    logging, correcting or deleting history never rewrites them."""
    history = BodyweightLog.objects.filter(owner=owner)
    for workout in Workout.objects.filter(owner=owner, bodyweight_kg__isnull=True):
        entry = history.as_of(workout.date)
        if entry is None:
            return  # no history at all, so nothing can be filled
        workout.bodyweight_kg = entry.weight_kg
        workout.save(update_fields=["bodyweight_kg"])
        workout.retotal_calisthenics()


class UserProfile(models.Model):
    """Per-user preferences and body vitals. Every field is optional so a new
    account works before the profile is filled in.

    Height is stored in cm regardless of `weight_unit`; the frontend converts
    for display. Weight isn't stored here at all — it changes over time, so it
    lives in BodyweightLog and the profile reports the latest entry."""

    class Sex(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    # Display/entry unit: lb pairs with ft/in for height, kg with cm. Also the
    # default unit for newly logged sets.
    weight_unit = models.CharField(
        max_length=2,
        choices=WorkoutEntry.WeightUnit.choices,
        default=WorkoutEntry.WeightUnit.LB,
    )
    height_cm = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    sex = models.CharField(max_length=8, choices=Sex.choices, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    # Average resting heart rate, in beats per minute.
    avg_bpm = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self):
        return f"Profile of {self.user}"


class FavoriteExercise(models.Model):
    """An exercise the user pinned to track its PR on the home screen.

    For a lift it's the exercise plus an optional resistance, like a template
    slot: with one, the PR is for that variant; blank means the best on any.
    For cardio it's the exercise plus an optional minimum distance: its fastest
    pace only counts sessions at least that long, so a short sprint can't hold
    the record for a long run. The same exercise can be pinned more than once
    with different variants (e.g. runs of 5 km+ and of 10 km+)."""

    MAX_PER_USER = 5

    profile = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="favorites"
    )
    # CASCADE rather than PROTECT: deleting a custom exercise just unpins it.
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name="+")
    # Strength only.
    equipment = models.CharField(
        max_length=16, choices=WorkoutEntry.Equipment.choices, blank=True
    )
    # Cardio only; null means sessions of any distance count.
    min_distance = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    min_distance_unit = models.CharField(
        max_length=2,
        choices=WorkoutEntry.DistanceUnit.choices,
        default=WorkoutEntry.DistanceUnit.MI,
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        # NULL min_distances never collide in the database, so duplicates of an
        # "any distance" favorite are caught by the profile serializer instead.
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "exercise", "equipment", "min_distance", "min_distance_unit"],
                name="unique_favorite_per_profile",
            )
        ]

    def __str__(self):
        return f"{self.exercise.name} (favorite of {self.profile.user})"


class WorkoutTemplate(models.Model):
    """A reusable workout skeleton: an ordered list of exercises and nothing
    else. Sets, reps and weight are deliberately not stored — they're entered
    fresh each time a workout is started from the template."""

    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="templates",
    )

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class TemplateExercise(models.Model):
    """One exercise slot in a template."""

    template = models.ForeignKey(
        WorkoutTemplate, on_delete=models.CASCADE, related_name="exercises"
    )
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name="+")
    order = models.PositiveIntegerField(default=0)
    # Resistance to pre-select on the first set (e.g. dumbbell vs barbell
    # bench) — which variant of the lift, not how much of it. Optional.
    equipment = models.CharField(
        max_length=16, choices=WorkoutEntry.Equipment.choices, blank=True
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.exercise.name} ({self.template.name})"
