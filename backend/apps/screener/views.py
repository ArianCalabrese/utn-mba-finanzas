from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .fields import FIELDS, CATEGORY_ORDER, SORTABLE
from .services import run_screen, MAX_SIZE


class FieldsView(APIView):
    """Catálogo de filtros para que el frontend arme el formulario dinámicamente."""

    def get(self, request):
        return Response({
            'categories': CATEGORY_ORDER,
            'fields': FIELDS,
            'sortable': sorted(SORTABLE.keys()),
            'max_size': MAX_SIZE,
        })


class ScreenView(APIView):
    """Ejecuta la pantalla de filtros contra el screener de Yahoo."""

    def post(self, request):
        data = request.data or {}
        filters = data.get('filters', {})
        if not isinstance(filters, dict):
            return Response(
                {'error': '"filters" debe ser un objeto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = run_screen(
                filters=filters,
                sort=data.get('sort'),
                sort_asc=bool(data.get('sort_asc', False)),
                offset=data.get('offset', 0),
                size=data.get('size', 50),
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result)
