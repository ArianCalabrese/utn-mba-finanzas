from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def health(_request):
    return Response({'status': 'ok'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health),
    path('api/auth/', include('apps.users.urls')),
    path('api/market/', include('apps.market.urls')),
    path('api/technical/', include('apps.technical.urls')),
    path('api/fundamental/', include('apps.fundamental.urls')),
    path('api/portfolio/', include('apps.portfolio.urls')),
    path('api/bonds/', include('apps.bonds.urls')),
    path('api/macro/', include('apps.macro.urls')),
    path('api/alerts/', include('apps.alerts.urls')),
    path('api/watchlist/', include('apps.watchlist.urls')),
    path('api/scanner/', include('apps.scanner.urls')),
]
