from django.urls import path
from .views import (
    OptimizeView, VaRView, CorrelationView, BacktestView,
    PortfolioListView, PortfolioDetailView,
    TransactionListView, TransactionDetailView,
    PortfolioSummaryView, HoldingTickersView,
)

urlpatterns = [
    # Análisis (sin estado)
    path('optimize/', OptimizeView.as_view()),
    path('var/', VaRView.as_view()),
    path('correlation/', CorrelationView.as_view()),
    path('backtest/', BacktestView.as_view()),
    # Seguimiento de tenencias (persistido por usuario)
    path('portfolios/', PortfolioListView.as_view()),
    path('portfolios/<int:pk>/', PortfolioDetailView.as_view()),
    path('portfolios/<int:pk>/transactions/', TransactionListView.as_view()),
    path('portfolios/<int:pk>/summary/', PortfolioSummaryView.as_view()),
    path('transactions/<int:pk>/', TransactionDetailView.as_view()),
    path('tickers/', HoldingTickersView.as_view()),
]
