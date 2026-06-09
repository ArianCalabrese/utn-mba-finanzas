from django.urls import path
from .views import AlertListView, AlertDetailView, AlertCheckView

urlpatterns = [
    path('', AlertListView.as_view()),
    path('<int:pk>/', AlertDetailView.as_view()),
    path('<int:pk>/check/', AlertCheckView.as_view()),
]
