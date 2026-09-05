from rest_framework import serializers

from .models import Exercise, Workout, WorkoutEntry


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = [
            "id",
            "name",
            "category",
            "muscle_group",
            "circuit",
            "secondary_muscles",
            "is_custom",
        ]


class WorkoutEntrySerializer(serializers.ModelSerializer):
    # Read-only convenience fields so the frontend can render without a second lookup.
    exercise_name = serializers.CharField(source="exercise.name", read_only=True)
    exercise_category = serializers.CharField(
        source="exercise.category", read_only=True
    )
    exercise_circuit = serializers.CharField(
        source="exercise.circuit", read_only=True
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
            "exercise_circuit",
            "exercise_muscle_group",
            "exercise_secondary_muscles",
            "order",
            "notes",
            "reps",
            "weight",
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

        if exercise.category == Exercise.Category.CARDIO:
            if attrs.get("reps") is not None or attrs.get("weight") is not None:
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
        fields = ["id", "date", "notes", "created_at", "entries"]
        read_only_fields = ["created_at"]

    def create(self, validated_data):
        entries_data = validated_data.pop("entries", [])
        workout = Workout.objects.create(**validated_data)
        self._sync_entries(workout, entries_data)
        return workout

    def update(self, instance, validated_data):
        entries_data = validated_data.pop("entries", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if entries_data is not None:
            # Simplest correct strategy: replace the child set on every write.
            instance.entries.all().delete()
            self._sync_entries(instance, entries_data)
        return instance

    @staticmethod
    def _sync_entries(workout, entries_data):
        WorkoutEntry.objects.bulk_create(
            [WorkoutEntry(workout=workout, **entry) for entry in entries_data]
        )
