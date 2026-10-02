from django.urls import path
from rest_framework.routers import DefaultRouter

from . import auth, views

router = DefaultRouter()
router.register(r"exercises", views.ExerciseViewSet)
router.register(r"workouts", views.WorkoutViewSet)
router.register(r"templates", views.WorkoutTemplateViewSet)
router.register(r"bodyweight", views.BodyweightLogViewSet)

urlpatterns = [
    path("auth/register/", auth.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", auth.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", auth.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", auth.MeView.as_view(), name="auth-me"),
    path("profile/", views.ProfileView.as_view(), name="profile"),
] + router.urls
