from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

SIDE_CHOICES = [('BUY', 'Compra'), ('SELL', 'Venta')]


class Portfolio(models.Model):
    """Una cartera del usuario. Permite separar tenencias por estrategia o sector."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolios')
    name = models.CharField(max_length=100)
    # Agrupación libre: "Tech", "Bancos", "Largo plazo", etc.
    category = models.CharField(max_length=60, blank=True)
    # Moneda en la que se consolidan los totales de la cartera.
    base_currency = models.CharField(max_length=3, default='USD')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = [('user', 'name')]

    def __str__(self):
        return f'{self.user} | {self.name}'


class Transaction(models.Model):
    """Movimiento individual (compra/venta). Las posiciones se derivan de estos."""
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='transactions')
    ticker = models.CharField(max_length=20)
    side = models.CharField(max_length=4, choices=SIDE_CHOICES, default='BUY')
    quantity = models.FloatField()
    # Precio por unidad en la moneda del activo (currency).
    price = models.FloatField()
    fees = models.FloatField(default=0)
    # Moneda del activo; si queda vacía se infiere de la cotización en vivo.
    currency = models.CharField(max_length=3, default='USD')
    trade_date = models.DateField()
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-trade_date', '-created_at']

    def __str__(self):
        return f'{self.portfolio.name} | {self.side} {self.quantity} {self.ticker} @ {self.price}'
