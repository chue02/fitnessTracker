from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, status, viewsets
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from .models import BodyweightLog, Exercise, UserProfile, Workout, WorkoutTemplate
from .serializers import (
    BodyweightLogSerializer,
    ExerciseSerializer,
    UserProfileSerializer,
    WorkoutSerializer,
    WorkoutTemplateSerializer,
)


class BodyweightLogViewSet(viewsets.ModelViewSet):
    """The user's dated bodyweight history, newest first. One entry per day:
    POSTing a date that already has one replaces its weight."""

    queryset = BodyweightLog.objects.all()
    serializer_class = BodyweightLogSerializer

    def get_queryset(self):
        return BodyweightLog.objects.filter(owner=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry, created = BodyweightLog.objects.update_or_create(
            owner=request.user,
            date=serializer.validated_data["date"],
            defaults={"weight_kg": serializer.validated_data["weight_kg"]},
        )
        return Response(
            self.get_serializer(entry).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH the signed-in user's profile. There's exactly one per user,
    so there's no id in the URL; it's created on first access."""

    serializer_class = UserProfileSerializer

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile


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

    def get_serializer_context(self):
        # Each workout reports the bodyweight in effect on its date; load the
        # history once here instead of once per workout.
        context = super().get_serializer_context()
        if self.request.user.is_authenticated:
            context["bodyweights"] = list(
                BodyweightLog.objects.filter(owner=self.request.user)
                .order_by("date")
                .values_list("date", "weight_kg")
            )
        return context

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class WorkoutTemplateViewSet(viewsets.ModelViewSet):
    queryset = WorkoutTemplate.objects.all()
    serializer_class = WorkoutTemplateSerializer

    def get_queryset(self):
        return WorkoutTemplate.objects.filter(owner=self.request.user).prefetch_related(
            "exercises__exercise"
        )

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
