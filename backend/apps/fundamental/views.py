from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import get_ratios, get_statements, get_dividends, get_dcf


class RatiosView(APIView):
    def get(self, request, ticker):
        try:
            return Response(get_ratios(ticker))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StatementsView(APIView):
    def get(self, request, ticker):
        try:
            return Response(get_statements(ticker))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DividendsView(APIView):
    def get(self, request, ticker):
        try:
            return Response(get_dividends(ticker))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DCFView(APIView):
    def get(self, request, ticker):
        # Absent / empty / "auto" WACC -> estimate it bottom-up via CAPM.
        wacc_param = request.query_params.get('wacc')
        try:
            wacc = float(wacc_param) if wacc_param not in (None, '', 'auto') else None
            terminal_growth = float(request.query_params.get('terminal_growth', 0.025))
            years = int(request.query_params.get('years', 5))
        except (ValueError, TypeError):
            return Response({'error': 'wacc and terminal_growth must be floats, years must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if wacc is not None and not (0.01 <= wacc <= 0.50):
            return Response({'error': 'wacc must be between 0.01 and 0.50.'}, status=status.HTTP_400_BAD_REQUEST)
        if not (0.001 <= terminal_growth <= 0.10):
            return Response({'error': 'terminal_growth must be between 0.001 and 0.10.'}, status=status.HTTP_400_BAD_REQUEST)
        if not (1 <= years <= 15):
            return Response({'error': 'years must be between 1 and 15.'}, status=status.HTTP_400_BAD_REQUEST)
        if wacc is not None and terminal_growth >= wacc:
            return Response({'error': 'terminal_growth must be strictly less than wacc.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            return Response(get_dcf(ticker, wacc, terminal_growth, years))
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
