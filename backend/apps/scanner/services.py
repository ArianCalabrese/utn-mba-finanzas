"""Radar de Oportunidades: escaneo masivo de tickers rankeado por convicción.

Reutiliza el score de convicción multicapa de apps.technical (tendencia,
momentum, valuación, volatilidad) y lo aplica en paralelo sobre un conjunto
de tickers, para detectar oportunidades sin revisar ticker por ticker.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed

from apps.market.services import get_quote
from apps.technical.services import get_conviction, get_indicators

MAX_TICKERS = 40
_WORKERS = 8


def _scan_one(ticker: str) -> dict:
    conv = get_conviction(ticker)['conviction']
    # get_conviction ya calculó los indicadores: esta llamada sale del caché.
    ind = get_indicators(ticker)

    quote = {}
    try:
        quote = get_quote(ticker) or {}
    except Exception:
        pass

    price = ind.get('current_price') or quote.get('price')
    prev = quote.get('previous_close')
    change_pct = round((price - prev) / prev * 100, 2) if price and prev else None

    layers = conv['layers']
    return {
        'ticker': ticker,
        'name': quote.get('name'),
        'currency': quote.get('currency'),
        'price': price,
        'change_pct': change_pct,
        'score': conv['score'],
        'verdict': conv['verdict'],
        'dca_signal': conv['dca_signal'],
        'trend_score': layers['trend']['score'],
        'momentum_score': layers['momentum']['score'],
        'valuation_score': layers['valuation']['score'],
        'volatility_score': layers['volatility']['score'],
        'rsi_14': ind.get('rsi_14'),
        'drawdown_from_ath': ind.get('drawdown_from_ath'),
        'z_score_200': ind.get('z_score_200'),
    }


def scan_tickers(tickers: list[str]) -> dict:
    """Escanea `tickers` en paralelo y devuelve el ranking por score."""
    unique = list(dict.fromkeys(t.upper().strip() for t in tickers if t and t.strip()))
    truncated = len(unique) > MAX_TICKERS
    unique = unique[:MAX_TICKERS]

    results: list[dict] = []
    failed: list[dict] = []
    if unique:
        with ThreadPoolExecutor(max_workers=min(len(unique), _WORKERS)) as ex:
            futures = {ex.submit(_scan_one, t): t for t in unique}
            for future in as_completed(futures):
                t = futures[future]
                try:
                    results.append(future.result())
                except Exception as e:
                    failed.append({'ticker': t, 'error': str(e)})

    results.sort(key=lambda r: r['score'], reverse=True)
    return {
        'count': len(results),
        'truncated': truncated,
        'max_tickers': MAX_TICKERS,
        'results': results,
        'failed': failed,
    }
