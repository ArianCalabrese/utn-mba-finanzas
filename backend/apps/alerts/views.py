from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Alert
from .serializers import AlertSerializer
from .engine import evaluate_alert
from apps.technical.services import get_indicators, get_conviction


class AlertListView(APIView):
    def get(self, request):
        alerts = Alert.objects.filter(user=request.user)
        return Response(AlertSerializer(alerts, many=True).data)

    def post(self, request):
        serializer = AlertSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AlertDetailView(APIView):
    def _get_alert(self, request, pk):
        try:
            return Alert.objects.get(pk=pk, user=request.user)
        except Alert.DoesNotExist:
            return None

    def patch(self, request, pk):
        alert = self._get_alert(request, pk)
        if not alert:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AlertSerializer(alert, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        alert = self._get_alert(request, pk)
        if not alert:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        alert.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AlertCheckView(APIView):
    def get(self, request, pk):
        try:
            alert = Alert.objects.get(pk=pk, user=request.user)
        except Alert.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            indicators = get_indicators(alert.ticker)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        needs_conviction = any(c.get('path', '').startswith('conviction.') for c in alert.conditions)
        conviction = None
        if needs_conviction:
            try:
                conviction = get_conviction(alert.ticker)
            except Exception:
                pass

        result = evaluate_alert(alert, indicators, conviction)

        now = timezone.now()
        alert.last_checked = now
        if result['triggered']:
            alert.last_triggered = now
            alert.triggered_count += 1
        alert.save(update_fields=['last_checked', 'last_triggered', 'triggered_count'])

        return Response({
            'alert_id': alert.pk,
            'ticker': alert.ticker,
            'name': alert.name,
            **result,
        })
