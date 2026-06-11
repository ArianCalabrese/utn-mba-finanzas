from django.urls import path
from .views import FieldsView, ScreenView

urlpatterns = [
    path('fields/', FieldsView.as_view()),
    path('run/', ScreenView.as_view()),
]
