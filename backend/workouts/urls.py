from rest_framework.routers import DefaultRouter

from .views import ExerciseViewSet, WorkoutViewSet

router = DefaultRouter()
router.register(r"exercises", ExerciseViewSet)
router.register(r"workouts", WorkoutViewSet)

urlpatterns = router.urls
