from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import get_indicators, get_signals


class IndicatorsView(APIView):
    def get(self, request, ticker):
        try:
            return Response(get_indicators(ticker))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SignalsView(APIView):
    def get(self, request, ticker):
        try:
            return Response(get_signals(ticker))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
