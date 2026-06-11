"""Screener fundamental: traduce filtros declarativos al motor de screening
server-side de Yahoo (`yfinance.EquityQuery` + `yf.screen`).

A diferencia del Radar de Oportunidades (apps.scanner), que calcula convicción
ticker por ticker sobre universos acotados, acá Yahoo filtra TODO su universo
del lado del servidor en una sola llamada. Ideal como primera etapa del embudo:
acotar miles de papeles a un puñado de candidatos.
"""

import hashlib
import json

import yfinance as yf

from apps.core.cache import get_cached
from .fields import FIELDS_BY_KEY, SORTABLE

EQ = yf.EquityQuery

SCREEN_TTL = 600          # 10 min: las combinaciones de filtros se reutilizan.
MAX_SIZE = 100            # tope por página (Yahoo admite hasta 250).
DEFAULT_SIZE = 50


def _build_query(filters: dict) -> EQ:
    """Traduce el dict de filtros del frontend a un EquityQuery combinado con AND.

    Estructura esperada de cada filtro:
        select  -> {"value": "us"}
        min     -> {"min": 15}
        max     -> {"max": 100}
        range   -> {"min": 5, "max": 25}  (cualquiera de los dos es opcional)
    """
    conds: list[EQ] = []

    for key, spec in filters.items():
        field = FIELDS_BY_KEY.get(key)
        if not field or not isinstance(spec, dict):
            continue

        yahoo = field['yahoo']
        scale = field['scale']
        ftype = field['type']

        if ftype == 'select':
            value = spec.get('value')
            if value not in (None, ''):
                conds.append(EQ('eq', [yahoo, value]))
            continue

        # Numéricos: min / max / range
        lo = spec.get('min')
        hi = spec.get('max')
        lo = float(lo) * scale if lo not in (None, '') else None
        hi = float(hi) * scale if hi not in (None, '') else None

        if lo is not None and hi is not None:
            conds.append(EQ('btwn', [yahoo, lo, hi]))
        elif lo is not None:
            conds.append(EQ('gt', [yahoo, lo]))
        elif hi is not None:
            conds.append(EQ('lt', [yahoo, hi]))

    # Yahoo rechaza queries vacías: si no hay filtros, traemos todo el universo
    # de equities con capitalización positiva.
    if not conds:
        conds.append(EQ('gt', ['intradaymarketcap', 0]))

    return conds[0] if len(conds) == 1 else EQ('and', conds)


def _row(q: dict) -> dict:
    """Normaliza un quote del screener a las columnas que mostramos."""
    return {
        'ticker': q.get('symbol'),
        'name': q.get('shortName') or q.get('longName') or q.get('displayName'),
        'exchange': q.get('fullExchangeName') or q.get('exchange'),
        'currency': q.get('currency'),
        'price': q.get('regularMarketPrice'),
        'change_pct': q.get('regularMarketChangePercent'),
        'market_cap': q.get('marketCap'),
        'pe': q.get('trailingPE'),
        'forward_pe': q.get('forwardPE'),
        'pb': q.get('priceToBook'),
        'dividend_yield': q.get('dividendYield'),
        'change_52w': q.get('fiftyTwoWeekChangePercent'),
        'eps_ttm': q.get('epsTrailingTwelveMonths'),
    }


def run_screen(
    filters: dict,
    sort: str | None = None,
    sort_asc: bool = False,
    offset: int = 0,
    size: int = DEFAULT_SIZE,
) -> dict:
    size = max(1, min(int(size or DEFAULT_SIZE), MAX_SIZE))
    offset = max(0, int(offset or 0))
    sort_field = SORTABLE.get(sort or '', 'intradaymarketcap')

    # La clave de caché identifica la consulta completa (filtros + orden + página).
    cache_payload = json.dumps(
        {'f': filters, 's': sort_field, 'a': sort_asc, 'o': offset, 'z': size},
        sort_keys=True, default=str,
    )
    cache_key = hashlib.sha1(cache_payload.encode()).hexdigest()

    def fetch():
        query = _build_query(filters)
        res = yf.screen(
            query, offset=offset, size=size,
            sortField=sort_field, sortAsc=sort_asc,
        )
        quotes = res.get('quotes', []) or []
        return {
            'count': res.get('total', len(quotes)),
            'returned': len(quotes),
            'offset': offset,
            'size': size,
            'sort': sort or 'marketcap',
            'sort_asc': sort_asc,
            'rows': [_row(q) for q in quotes],
        }

    return get_cached('screener', cache_key, SCREEN_TTL, fetch)
