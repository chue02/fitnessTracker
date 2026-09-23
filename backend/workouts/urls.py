from django.urls import path
from rest_framework.routers import DefaultRouter

from . import auth, views

router = DefaultRouter()
router.register(r"exercises", views.ExerciseViewSet)
router.register(r"workouts", views.WorkoutViewSet)

urlpatterns = [
    path("auth/register/", auth.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", auth.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", auth.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", auth.MeView.as_view(), name="auth-me"),
] + router.urls
