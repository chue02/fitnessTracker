from django.utils import timezone
from rest_framework import serializers

from .models import (
    BodyweightLog,
    Exercise,
    TemplateExercise,
    UserProfile,
    Workout,
    WorkoutEntry,
    WorkoutTemplate,
)


class ExerciseSerializer(serializers.ModelSerializer):
    # Derived from muscle_group on the model; read-only, never accepted on write.
    split = serializers.ReadOnlyField()

    class Meta:
        model = Exercise
        fields = [
            "id",
            "name",
            "category",
            "muscle_group",
            "split",
            "secondary_muscles",
            "is_custom",
        ]

    def validate_name(self, value):
        # Mirrors the (owner, name) unique constraint, which DRF can't check
        # itself because `owner` isn't a serializer field.
        user = self.context["request"].user
        clash = Exercise.objects.filter(owner=user, name=value)
        if self.instance is not None:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("You already have an exercise with this name.")
        return value


class WorkoutEntrySerializer(serializers.ModelSerializer):
    # Read-only convenience fields so the frontend can render without a second lookup.
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    exercise_category = serializers.CharField(
        source="exercise.category", read_only=True
    )
    exercise_split = serializers.CharField(
        source="exercise.split", read_only=True
    )
    exercise_muscle_group = serializers.CharField(
        source="exercise.muscle_group", read_only=True
    )
    exercise_secondary_muscles = serializers.CharField(
        source="exercise.secondary_muscles", read_only=True
    )

    class Meta:
        model = WorkoutEntry
        fields = [
            "id",
            "exercise",
            "exercise_name",
            "exercise_category",
            "exercise_split",
            "exercise_muscle_group",
            "exercise_secondary_muscles",
            "order",
            "notes",
            "reps",
            "weight",
            "added_weight",
            "weight_unit",
            "equipment",
            "is_warmup",
            "distance",
            "distance_unit",
            "duration_seconds",
            "avg_heart_rate",
        ]

    def validate(self, attrs):
        """Keep strength and cardio metrics on the right kind of exercise.

        Only enforced when we can resolve the exercise's category (i.e. on create
        or when `exercise` is supplied); lenient otherwise for partial updates."""
        exercise = attrs.get("exercise")
        if exercise is None:
            return attrs

        user = self.context["request"].user
        if not Exercise.objects.visible_to(user).filter(pk=exercise.pk).exists():
            raise serializers.ValidationError({"exercise": "Unknown exercise."})

        if exercise.category == Exercise.Category.CARDIO:
            if any(attrs.get(f) is not None for f in ("reps", "weight", "added_weight")):
                raise serializers.ValidationError(
                    "Cardio entries cannot have reps or weight."
                )
        else:  # strength
            cardio_only = ("distance", "duration_seconds", "avg_heart_rate")
            if any(attrs.get(f) is not None for f in cardio_only):
                raise serializers.ValidationError(
                    "Strength entries cannot have distance, duration, or heart rate."
                )
        return attrs


class WorkoutSerializer(serializers.ModelSerializer):
    entries = WorkoutEntrySerializer(many=True)

    class Meta:
        model = Workout
        fields = ["id", "date", "notes", "created_at", "bodyweight_kg", "entries"]
        # bodyweight_kg is a server-side snapshot of the owner's history.
        read_only_fields = ["created_at", "bodyweight_kg"]

    @staticmethod
    def _bodyweight_on(owner, day):
        entry = BodyweightLog.objects.filter(owner=owner).as_of(day)
        return entry.weight_kg if entry else None

    def create(self, validated_data):
        entries_data = validated_data.pop("entries", [])
        validated_data["bodyweight_kg"] = self._bodyweight_on(
            validated_data.get("owner"), validated_data.get("date", timezone.localdate())
        )
        workout = Workout.objects.create(**validated_data)
        self._sync_entries(workout, entries_data)
        return workout

    def update(self, instance, validated_data):
        entries_data = validated_data.pop("entries", None)
        date_changed = "date" in validated_data and validated_data["date"] != instance.date
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Keep the snapshot unless the workout moved to another day (a
        # different day can mean a different weight) or none was on record
        # when it was first saved. Never cleared: if history no longer covers
        # the date, the existing snapshot stands.
        bodyweight_changed = False
        if date_changed or instance.bodyweight_kg is None:
            bodyweight = self._bodyweight_on(instance.owner, instance.date)
            if bodyweight is not None and bodyweight != instance.bodyweight_kg:
                instance.bodyweight_kg = bodyweight
                bodyweight_changed = True
        instance.save()

        if entries_data is not None:
            # Simplest correct strategy: replace the child set on every write.
            instance.entries.all().delete()
            self._sync_entries(instance, entries_data)
        elif bodyweight_changed:
            # Entries weren't resent, so re-total the stored calisthenics sets.
            instance.retotal_calisthenics()
        return instance

    @staticmethod
    def _sync_entries(workout, entries_data):
        entries = [WorkoutEntry(workout=workout, **entry) for entry in entries_data]
        # Calisthenics totals are always computed here from the snapshot, never
        # taken from the client.
        for entry in entries:
            entry.apply_bodyweight(workout.bodyweight_kg)
        WorkoutEntry.objects.bulk_create(entries)


class TemplateExerciseSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    exercise_category = serializers.CharField(
        source="exercise.category", read_only=True
    )
    exercise_split = serializers.CharField(source="exercise.split", read_only=True)
    exercise_muscle_group = serializers.CharField(
        source="exercise.muscle_group", read_only=True
    )
    exercise_secondary_muscles = serializers.CharField(
        source="exercise.secondary_muscles", read_only=True
    )

    class Meta:
        model = TemplateExercise
        fields = [
            "id",
            "exercise",
            "exercise_name",
            "exercise_category",
            "exercise_split",
            "exercise_muscle_group",
            "exercise_secondary_muscles",
            "order",
            "equipment",
        ]

    def validate_exercise(self, exercise):
        user = self.context["request"].user
        if not Exercise.objects.visible_to(user).filter(pk=exercise.pk).exists():
            raise serializers.ValidationError("Unknown exercise.")
        return exercise


class WorkoutTemplateSerializer(serializers.ModelSerializer):
    exercises = TemplateExerciseSerializer(many=True)

    class Meta:
        model = WorkoutTemplate
        fields = ["id", "name", "created_at", "exercises"]
        read_only_fields = ["created_at"]

    def validate_exercises(self, value):
        if not value:
            raise serializers.ValidationError("A template needs at least one exercise.")
        return value

    def create(self, validated_data):
        exercises_data = validated_data.pop("exercises", [])
        template = WorkoutTemplate.objects.create(**validated_data)
        self._sync_exercises(template, exercises_data)
        return template

    def update(self, instance, validated_data):
        exercises_data = validated_data.pop("exercises", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if exercises_data is not None:
            instance.exercises.all().delete()
            self._sync_exercises(instance, exercises_data)
        return instance

    @staticmethod
    def _sync_exercises(template, exercises_data):
        TemplateExercise.objects.bulk_create(
            [TemplateExercise(template=template, **ex) for ex in exercises_data]
        )


class UserProfileSerializer(serializers.ModelSerializer):
    # Sanity bounds that catch unit mix-ups (e.g. lb typed into a kg field)
    # without rejecting any plausible adult or child.
    height_cm = serializers.DecimalField(
        max_digits=5, decimal_places=1, min_value=50, max_value=275,
        required=False, allow_null=True,
    )
    # Latest logged bodyweight. Read-only: weight changes go through
    # /bodyweight/ so they land as dated history instead of overwriting it.
    weight_kg = serializers.SerializerMethodField()
    avg_bpm = serializers.IntegerField(
        min_value=25, max_value=220, required=False, allow_null=True
    )

    class Meta:
        model = UserProfile
        fields = [
            "weight_unit",
            "height_cm",
            "weight_kg",
            "sex",
            "date_of_birth",
            "avg_bpm",
        ]

    def get_weight_kg(self, profile):
        latest = BodyweightLog.objects.filter(owner=profile.user).first()
        return str(latest.weight_kg) if latest else None

    def validate_date_of_birth(self, value):
        if value is not None and value > timezone.localdate():
            raise serializers.ValidationError("Date of birth can't be in the future.")
        return value


class BodyweightLogSerializer(serializers.ModelSerializer):
    # Same sanity bounds as the rest of the profile.
    weight_kg = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=20, max_value=450
    )

    class Meta:
        model = BodyweightLog
        fields = ["id", "date", "weight_kg"]
