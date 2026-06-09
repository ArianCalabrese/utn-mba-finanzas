from django.urls import path
from .views import MarketRegimeView, RelativeStrengthView

urlpatterns = [
    path('regime/', MarketRegimeView.as_view()),
    path('rs/<str:ticker>/', RelativeStrengthView.as_view()),
]
