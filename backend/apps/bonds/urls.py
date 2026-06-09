from django.urls import path
from .views import BondPriceView, BondYTMView, BondDurationView

urlpatterns = [
    path('price/', BondPriceView.as_view()),
    path('ytm/', BondYTMView.as_view()),
    path('duration/', BondDurationView.as_view()),
]
