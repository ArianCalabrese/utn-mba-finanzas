from django.urls import path
from .views import IndicatorsView, SignalsView, ConvictionView

urlpatterns = [
    path('<str:ticker>/indicators/', IndicatorsView.as_view()),
    path('<str:ticker>/signals/', SignalsView.as_view()),
    path('<str:ticker>/conviction/', ConvictionView.as_view()),
]
