from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('servers', '0001_add_gateway_token'),
    ]

    operations = [
        migrations.AddField(
            model_name='server',
            name='deployment_stage',
            field=models.CharField(
                blank=True,
                choices=[
                    ('', 'Нет'),
                    ('pool_assigned', 'Сервер назначен'),
                    ('configuring_keys', 'Настройка ключей'),
                    ('deploying_openclaw', 'Развёртывание OpenClaw'),
                    ('installing_agents', 'Установка агентов'),
                    ('configuring_search', 'Настройка поиска'),
                    ('ready', 'Готов'),
                ],
                default='',
                max_length=30,
            ),
        ),
    ]
