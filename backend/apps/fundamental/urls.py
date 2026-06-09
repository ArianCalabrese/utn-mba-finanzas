from django.urls import path
from .views import RatiosView, StatementsView, DividendsView, DCFView

urlpatterns = [
    path('<str:ticker>/ratios/', RatiosView.as_view()),
    path('<str:ticker>/statements/', StatementsView.as_view()),
    path('<str:ticker>/dividends/', DividendsView.as_view()),
    path('<str:ticker>/dcf/', DCFView.as_view()),
]
