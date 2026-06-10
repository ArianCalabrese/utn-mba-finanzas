from django.urls import path
from .views import UniversesView, ScanView

urlpatterns = [
    path('universes/', UniversesView.as_view()),
    path('scan/', ScanView.as_view()),
]
