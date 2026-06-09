from django.urls import path
from .views import OptimizeView, VaRView, CorrelationView, BacktestView

urlpatterns = [
    path('optimize/', OptimizeView.as_view()),
    path('var/', VaRView.as_view()),
    path('correlation/', CorrelationView.as_view()),
    path('backtest/', BacktestView.as_view()),
]
