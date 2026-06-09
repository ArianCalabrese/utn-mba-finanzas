from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import get_market_regime, get_relative_strength


class MarketRegimeView(APIView):
    def get(self, request):
        try:
            return Response(get_market_regime())
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RelativeStrengthView(APIView):
    def get(self, request, ticker):
        benchmark = request.query_params.get('benchmark', '^GSPC')
        period = request.query_params.get('period', '6mo')
        try:
            return Response(get_relative_strength(ticker, benchmark, period))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
