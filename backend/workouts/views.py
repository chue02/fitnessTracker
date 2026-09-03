from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets

from .models import Exercise, Workout
from .serializers import ExerciseSerializer, WorkoutSerializer


class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["category", "muscle_group", "is_custom"]

    def perform_create(self, serializer):
        # User-created exercises are always custom. `owner` stays null until auth lands.
        serializer.save(is_custom=True)


class WorkoutViewSet(viewsets.ModelViewSet):
    queryset = Workout.objects.prefetch_related("entries__exercise").all()
    serializer_class = WorkoutSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["date"]
