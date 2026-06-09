from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import get_quote, get_history, get_compare

VALID_PERIODS = {'1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'}
VALID_INTERVALS = {'1m', '2m', '5m', '15m', '30m', '60m', '1h', '1d', '1wk', '1mo'}


class QuoteView(APIView):
    def get(self, request, ticker):
        try:
            data = get_quote(ticker)
            if data.get('price') is None:
                return Response({'error': 'Ticker not found or no price data available.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HistoryView(APIView):
    def get(self, request, ticker):
        period = request.query_params.get('period', '1y')
        interval = request.query_params.get('interval', '1d')
        if period not in VALID_PERIODS:
            return Response({'error': f'Invalid period. Valid options: {sorted(VALID_PERIODS)}'}, status=status.HTTP_400_BAD_REQUEST)
        if interval not in VALID_INTERVALS:
            return Response({'error': f'Invalid interval. Valid options: {sorted(VALID_INTERVALS)}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            data = get_history(ticker, period, interval)
            if not data:
                return Response({'error': 'No historical data found for this ticker.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CompareView(APIView):
    def get(self, request):
        raw = request.query_params.get('tickers', '')
        tickers = [t.strip().upper() for t in raw.split(',') if t.strip()]
        if not tickers or len(tickers) < 2:
            return Response({'error': 'Provide at least 2 tickers via ?tickers=AAPL,MSFT'}, status=status.HTTP_400_BAD_REQUEST)
        if len(tickers) > 10:
            return Response({'error': 'Maximum 10 tickers allowed.'}, status=status.HTTP_400_BAD_REQUEST)
        period = request.query_params.get('period', '1y')
        if period not in VALID_PERIODS:
            return Response({'error': f'Invalid period. Valid options: {sorted(VALID_PERIODS)}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(get_compare(tickers, period))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
