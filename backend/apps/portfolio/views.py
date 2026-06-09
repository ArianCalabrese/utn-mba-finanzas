from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Portfolio, Transaction
from .serializers import PortfolioSerializer, TransactionSerializer
from .services import (
    optimize_portfolio, compute_var, compute_correlation, backtest_portfolio,
    build_summary,
)


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


# ─── Carteras del usuario (Fase 1) ───────────────────────────────────────────

class PortfolioListView(APIView):
    def get(self, request):
        portfolios = Portfolio.objects.filter(user=request.user)
        return Response(PortfolioSerializer(portfolios, many=True).data)

    def post(self, request):
        serializer = PortfolioSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(user=request.user)
            except Exception:
                return Response({'error': 'Ya tenés una cartera con ese nombre.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PortfolioDetailView(APIView):
    def _get(self, request, pk):
        return Portfolio.objects.filter(pk=pk, user=request.user).first()

    def patch(self, request, pk):
        portfolio = self._get(request, pk)
        if not portfolio:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PortfolioSerializer(portfolio, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        portfolio = self._get(request, pk)
        if not portfolio:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        portfolio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TransactionListView(APIView):
    def get(self, request, pk):
        portfolio = Portfolio.objects.filter(pk=pk, user=request.user).first()
        if not portfolio:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        txns = portfolio.transactions.all()
        return Response(TransactionSerializer(txns, many=True).data)

    def post(self, request, pk):
        portfolio = Portfolio.objects.filter(pk=pk, user=request.user).first()
        if not portfolio:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TransactionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Validar que el ticker exista antes de guardar
        from apps.market.services import get_quote
        raw = serializer.validated_data['ticker']
        try:
            quote = get_quote(raw)
            if not quote.get('price') and not quote.get('name'):
                return Response(
                    {'error': f'"{raw}" no es un ticker válido o no tiene datos disponibles.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception:
            return Response(
                {'error': f'No se pudo verificar el ticker "{raw}". Revisá que sea correcto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save(portfolio=portfolio)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TransactionDetailView(APIView):
    def _get(self, request, pk):
        return Transaction.objects.filter(pk=pk, portfolio__user=request.user).first()

    def patch(self, request, pk):
        txn = self._get(request, pk)
        if not txn:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = TransactionSerializer(txn, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        txn = self._get(request, pk)
        if not txn:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        txn.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PortfolioSummaryView(APIView):
    def get(self, request, pk):
        portfolio = Portfolio.objects.filter(pk=pk, user=request.user).first()
        if not portfolio:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            return Response(build_summary(portfolio))
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class HoldingTickersView(APIView):
    """Tickers únicos del usuario; acepta ?portfolios=1,2,3 para filtrar por cartera."""
    def get(self, request):
        qs = Transaction.objects.filter(portfolio__user=request.user)
        raw = request.query_params.get('portfolios') or request.query_params.get('portfolio')
        if raw:
            ids = [i.strip() for i in raw.split(',') if i.strip().isdigit()]
            if ids:
                qs = qs.filter(portfolio_id__in=ids)
        tickers = sorted({t.upper() for t in qs.values_list('ticker', flat=True)})
        return Response({'tickers': tickers})
