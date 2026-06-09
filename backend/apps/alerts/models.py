from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

OPERATOR_CHOICES = [('AND', 'AND'), ('OR', 'OR')]


class Alert(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alerts')
    ticker = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    # conditions: list of {"path": str, "operator": "<"|">"|"<="|">="|"==", "value": float}
    conditions = models.JSONField(default=list)
    operator = models.CharField(max_length=3, choices=OPERATOR_CHOICES, default='AND')
    is_active = models.BooleanField(default=True)
    last_checked = models.DateTimeField(null=True, blank=True)
    last_triggered = models.DateTimeField(null=True, blank=True)
    triggered_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} | {self.ticker} | {self.name}'
