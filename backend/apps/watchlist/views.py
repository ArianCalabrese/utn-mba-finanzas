from concurrent.futures import ThreadPoolExecutor, as_completed
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Watchlist, WatchlistItem
from apps.market.services import get_quote


def _fetch_prices(tickers: list[str]) -> dict:
    results = {}
    if not tickers:
        return results
    with ThreadPoolExecutor(max_workers=min(len(tickers), 10)) as ex:
        futures = {ex.submit(get_quote, t): t for t in tickers}
        for future in as_completed(futures):
            t = futures[future]
            try:
                results[t] = future.result()
            except Exception:
                results[t] = {}
    return results


def _enrich(item: WatchlistItem, prices: dict) -> dict:
    q = prices.get(item.ticker) or {}
    price = q.get('price')
    prev = q.get('previous_close')
    change = round(price - prev, 4) if price and prev else None
    change_pct = round((price - prev) / prev * 100, 2) if price and prev else None
    return {
        'id': item.id,
        'ticker': item.ticker,
        'note': item.note,
        'added_at': item.added_at.isoformat(),
        'name': q.get('name'),
        'price': price,
        'previous_close': prev,
        'change': change,
        'change_pct': change_pct,
        'day_low': q.get('day_low'),
        'day_high': q.get('day_high'),
        'week_52_low': q.get('week_52_low'),
        'week_52_high': q.get('week_52_high'),
        'volume': q.get('volume'),
        'market_cap': q.get('market_cap'),
        'currency': q.get('currency'),
    }


# ─── Watchlists ──────────────────────────────────────────────────────────────

class WatchlistListView(APIView):
    def get(self, request):
        wls = Watchlist.objects.filter(user=request.user)
        return Response([
            {
                'id': w.id, 'name': w.name, 'description': w.description,
                'item_count': w.items.count(), 'created_at': w.created_at.isoformat(),
            }
            for w in wls
        ])

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'El nombre es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        description = (request.data.get('description') or '').strip()[:300]
        try:
            wl = Watchlist.objects.create(user=request.user, name=name, description=description)
        except Exception:
            return Response({'error': 'Ya tenés una lista con ese nombre.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {'id': wl.id, 'name': wl.name, 'description': wl.description, 'item_count': 0},
            status=status.HTTP_201_CREATED,
        )


class WatchlistDetailView(APIView):
    def _get(self, request, pk):
        return Watchlist.objects.filter(pk=pk, user=request.user).first()

    def patch(self, request, pk):
        wl = self._get(request, pk)
        if not wl:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if 'name' in request.data:
            name = (request.data['name'] or '').strip()
            if not name:
                return Response({'error': 'El nombre no puede estar vacío.'}, status=status.HTTP_400_BAD_REQUEST)
            wl.name = name
        if 'description' in request.data:
            wl.description = (request.data['description'] or '').strip()[:300]
        wl.save()
        return Response({'id': wl.id, 'name': wl.name, 'description': wl.description})

    def delete(self, request, pk):
        wl = self._get(request, pk)
        if not wl:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        wl.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Items dentro de una watchlist ───────────────────────────────────────────

class WatchlistItemListView(APIView):
    def _get_wl(self, request, pk):
        return Watchlist.objects.filter(pk=pk, user=request.user).first()

    def get(self, request, pk):
        wl = self._get_wl(request, pk)
        if not wl:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        items = list(wl.items.all())
        prices = _fetch_prices([i.ticker for i in items])
        return Response([_enrich(i, prices) for i in items])

    def post(self, request, pk):
        wl = self._get_wl(request, pk)
        if not wl:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        raw = (request.data.get('ticker') or '').strip().upper()
        if not raw:
            return Response({'error': 'ticker requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validar que el ticker exista en Yahoo Finance
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

        note = (request.data.get('note') or '').strip()[:200]
        item, created = WatchlistItem.objects.get_or_create(
            watchlist=wl, ticker=raw, defaults={'note': note},
        )
        if not created:
            return Response({'error': f'{raw} ya está en esta lista.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {'id': item.id, 'ticker': item.ticker, 'note': item.note},
            status=status.HTTP_201_CREATED,
        )


class WatchlistItemDetailView(APIView):
    def _get(self, request, pk):
        return WatchlistItem.objects.filter(pk=pk, watchlist__user=request.user).first()

    def delete(self, request, pk):
        item = self._get(request, pk)
        if not item:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        item = self._get(request, pk)
        if not item:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        item.note = (request.data.get('note') or '').strip()[:200]
        item.save(update_fields=['note'])
        return Response({'id': item.id, 'ticker': item.ticker, 'note': item.note})


class AllWatchlistTickersView(APIView):
    """Tickers únicos del usuario; acepta ?watchlists=1,2,3 para filtrar."""
    def get(self, request):
        qs = WatchlistItem.objects.filter(watchlist__user=request.user)
        raw = request.query_params.get('watchlists')
        if raw:
            ids = [i.strip() for i in raw.split(',') if i.strip().isdigit()]
            if ids:
                qs = qs.filter(watchlist_id__in=ids)
        tickers = sorted(set(qs.values_list('ticker', flat=True)))
        return Response({'tickers': tickers})
