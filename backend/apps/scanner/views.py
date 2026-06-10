from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.portfolio.models import Transaction
from apps.portfolio.services import _derive_positions
from apps.watchlist.models import WatchlistItem
from .services import scan_tickers, MAX_TICKERS
from .universes import UNIVERSES

VALID_SOURCES = {'custom', 'universe', 'watchlist', 'portfolio'}


def _ids_from(value) -> list[int]:
    if not isinstance(value, list):
        return []
    return [int(v) for v in value if isinstance(v, (int, str)) and str(v).isdigit()]


class UniversesView(APIView):
    def get(self, request):
        return Response([
            {
                'key': key,
                'label': u['label'],
                'description': u['description'],
                'count': len(u['tickers']),
            }
            for key, u in UNIVERSES.items()
        ])


class ScanView(APIView):
    def post(self, request):
        source = request.data.get('source', 'custom')
        if source not in VALID_SOURCES:
            return Response(
                {'error': f'source inválido. Opciones: {sorted(VALID_SOURCES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        avg_costs: dict[str, float] = {}

        if source == 'custom':
            raw = request.data.get('tickers', [])
            if not isinstance(raw, list) or not raw:
                return Response({'error': 'Indicá al menos un ticker.'}, status=status.HTTP_400_BAD_REQUEST)
            tickers = [str(t) for t in raw]

        elif source == 'universe':
            key = request.data.get('universe', '')
            universe = UNIVERSES.get(key)
            if not universe:
                return Response(
                    {'error': f'Universo desconocido. Opciones: {sorted(UNIVERSES)}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tickers = universe['tickers']

        elif source == 'watchlist':
            qs = WatchlistItem.objects.filter(watchlist__user=request.user)
            ids = _ids_from(request.data.get('watchlists'))
            if ids:
                qs = qs.filter(watchlist_id__in=ids)
            tickers = sorted({t.upper() for t in qs.values_list('ticker', flat=True)})
            if not tickers:
                return Response(
                    {'error': 'No hay tickers en tus listas de seguimiento.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        else:  # portfolio
            qs = Transaction.objects.filter(portfolio__user=request.user)
            ids = _ids_from(request.data.get('portfolios'))
            if ids:
                qs = qs.filter(portfolio_id__in=ids)
            positions = _derive_positions(list(qs))
            # Solo posiciones abiertas; el costo promedio alimenta la señal DCA.
            avg_costs = {
                t: pos['cost'] / pos['qty']
                for t, pos in positions.items()
                if pos['qty'] > 1e-9
            }
            tickers = sorted(avg_costs)
            if not tickers:
                return Response(
                    {'error': 'No tenés posiciones abiertas en tus carteras.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            data = scan_tickers(tickers)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if avg_costs:
            for row in data['results']:
                avg = avg_costs.get(row['ticker'])
                row['avg_cost'] = round(avg, 4) if avg else None
                price = row.get('price')
                row['vs_avg_cost_pct'] = (
                    round((price - avg) / avg * 100, 2) if avg and price else None
                )

        data['source'] = source
        return Response(data)
