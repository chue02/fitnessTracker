from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0003_remove_exercise_equipment_workoutentry_equipment'),
    ]

    operations = [
        migrations.RenameField(
            model_name='exercise',
            old_name='circuit',
            new_name='split',
        ),
    ]
