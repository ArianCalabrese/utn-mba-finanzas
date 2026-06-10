from django.urls import path
from .views import QuoteView, HistoryView, CompareView, SearchView

urlpatterns = [
    path('search/', SearchView.as_view()),
    path('quote/<str:ticker>/', QuoteView.as_view()),
    path('history/<str:ticker>/', HistoryView.as_view()),
    path('compare/', CompareView.as_view()),
]
