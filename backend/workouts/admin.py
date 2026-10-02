from django.contrib import admin

from .models import (
    Exercise,
    TemplateExercise,
    UserProfile,
    Workout,
    WorkoutEntry,
    WorkoutTemplate,
)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "weight_unit", "height_cm", "weight_kg", "sex", "avg_bpm")


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "muscle_group", "is_custom", "owner")
    list_filter = ("category", "muscle_group", "is_custom")
    search_fields = ("name",)


class WorkoutEntryInline(admin.TabularInline):
    model = WorkoutEntry
    extra = 0


@admin.register(Workout)
class WorkoutAdmin(admin.ModelAdmin):
    list_display = ("date", "notes", "created_at", "owner")
    list_filter = ("date",)
    inlines = [WorkoutEntryInline]


class TemplateExerciseInline(admin.TabularInline):
    model = TemplateExercise
    extra = 0


@admin.register(WorkoutTemplate)
class WorkoutTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "owner")
    inlines = [TemplateExerciseInline]
