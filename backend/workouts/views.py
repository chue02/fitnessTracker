from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.permissions import SAFE_METHODS

from .models import Exercise, Workout
from .serializers import ExerciseSerializer, WorkoutSerializer


class ExerciseViewSet(viewsets.ModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["category", "muscle_group", "is_custom"]

    def get_queryset(self):
        # Everyone sees the built-in library; custom exercises only to their owner.
        # Built-ins are read-only, so writes are limited to the user's own rows.
        if self.request.method in SAFE_METHODS:
            return Exercise.objects.visible_to(self.request.user)
        return Exercise.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # User-created exercises are always custom.
        serializer.save(is_custom=True, owner=self.request.user)


class WorkoutViewSet(viewsets.ModelViewSet):
    queryset = Workout.objects.all()
    serializer_class = WorkoutSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["date"]

    def get_queryset(self):
        return Workout.objects.filter(owner=self.request.user).prefetch_related(
            "entries__exercise"
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
