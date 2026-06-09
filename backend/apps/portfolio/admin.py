from django.contrib import admin
from .models import Portfolio, Transaction


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'category', 'base_currency', 'created_at')
    list_filter = ('base_currency',)
    search_fields = ('name', 'user__username')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('ticker', 'side', 'quantity', 'price', 'currency', 'trade_date', 'portfolio')
    list_filter = ('side', 'currency')
    search_fields = ('ticker', 'portfolio__name')
