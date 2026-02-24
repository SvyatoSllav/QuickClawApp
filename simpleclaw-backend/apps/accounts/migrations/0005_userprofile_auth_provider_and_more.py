# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_merge_20260218_1013'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='auth_provider',
            field=models.CharField(blank=True, choices=[('google', 'Google'), ('apple', 'Apple')], max_length=10),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='last_oauth_verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
