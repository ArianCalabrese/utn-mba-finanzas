from django.urls import path
from .views import (
    WatchlistListView, WatchlistDetailView,
    WatchlistItemListView, WatchlistItemDetailView,
    AllWatchlistTickersView,
)

urlpatterns = [
    path('', WatchlistListView.as_view()),
    path('<int:pk>/', WatchlistDetailView.as_view()),
    path('<int:pk>/items/', WatchlistItemListView.as_view()),
    path('items/<int:pk>/', WatchlistItemDetailView.as_view()),
    path('tickers/', AllWatchlistTickersView.as_view()),
]
