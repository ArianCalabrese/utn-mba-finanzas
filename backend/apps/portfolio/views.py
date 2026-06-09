from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import optimize_portfolio, compute_var, compute_correlation, backtest_portfolio


class OptimizeView(APIView):
    def post(self, request):
        tickers = request.data.get('tickers', [])
        risk_free_rate = float(request.data.get('risk_free_rate', 0.05))
        if not isinstance(tickers, list) or len(tickers) < 2:
            return Response({'error': 'Provide at least 2 tickers in a JSON array.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(tickers) > 20:
            return Response({'error': 'Maximum 20 tickers allowed.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(optimize_portfolio(tickers, risk_free_rate))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VaRView(APIView):
    def post(self, request):
        tickers = request.data.get('tickers', [])
        weights = request.data.get('weights', [])
        portfolio_value = float(request.data.get('portfolio_value', 100_000))
        if not tickers or not weights or len(tickers) != len(weights):
            return Response(
                {'error': 'tickers and weights must be non-empty arrays of equal length.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return Response(compute_var(tickers, weights, portfolio_value))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CorrelationView(APIView):
    def post(self, request):
        tickers = request.data.get('tickers', [])
        benchmark = request.data.get('benchmark', 'SPY')
        if not isinstance(tickers, list) or len(tickers) < 2:
            return Response({'error': 'Provide at least 2 tickers.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(compute_correlation(tickers, benchmark))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BacktestView(APIView):
    def post(self, request):
        tickers = request.data.get('tickers', [])
        weights = request.data.get('weights', [])
        period = request.data.get('period', '1y')
        if not tickers or not weights or len(tickers) != len(weights):
            return Response(
                {'error': 'tickers and weights must be non-empty arrays of equal length.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return Response(backtest_portfolio(tickers, weights, period))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
