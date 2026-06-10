import yfinance as yf
import pandas as pd
from apps.core.cache import get_cached

QUOTE_TTL = 300
HISTORY_TTL = 900
SEARCH_TTL = 3600


def get_quote(ticker: str) -> dict:
    def fetch():
        info = yf.Ticker(ticker).info
        return {
            'ticker': ticker.upper(),
            'name': info.get('longName') or info.get('shortName'),
            'price': info.get('currentPrice') or info.get('regularMarketPrice'),
            'previous_close': info.get('previousClose'),
            'open': info.get('open'),
            'day_low': info.get('dayLow'),
            'day_high': info.get('dayHigh'),
            'week_52_low': info.get('fiftyTwoWeekLow'),
            'week_52_high': info.get('fiftyTwoWeekHigh'),
            'volume': info.get('volume'),
            'avg_volume': info.get('averageVolume'),
            'market_cap': info.get('marketCap'),
            'beta': info.get('beta'),
            'currency': info.get('currency'),
            'exchange': info.get('exchange'),
        }

    return get_cached('quotes', ticker.upper(), QUOTE_TTL, fetch)


def get_history(ticker: str, period: str = '1y', interval: str = '1d') -> list[dict]:
    cache_key = f"{ticker.upper()}:{period}:{interval}"

    def fetch():
        df = yf.Ticker(ticker).history(period=period, interval=interval)
        if df.empty:
            return []
        df = df.reset_index()
        df['Date'] = df['Date'].astype(str)
        return (
            df[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']]
            .rename(columns={
                'Date': 'date', 'Open': 'open', 'High': 'high',
                'Low': 'low', 'Close': 'close', 'Volume': 'volume',
            })
            .round(4)
            .to_dict(orient='records')
        )

    return get_cached('history', cache_key, HISTORY_TTL, fetch)


def search_tickers(query: str, limit: int = 8) -> list[dict]:
    """Autocomplete: return ticker candidates matching `query` via Yahoo Finance search."""
    q = query.strip()
    cache_key = f"{q.lower()}:{limit}"

    def fetch():
        results = yf.Search(q, max_results=limit).quotes
        out = []
        for r in results:
            symbol = r.get('symbol')
            if not symbol:
                continue
            out.append({
                'symbol': symbol,
                'name': r.get('longname') or r.get('shortname') or '',
                'exchange': r.get('exchDisp') or r.get('exchange') or '',
                'type': r.get('typeDisp') or r.get('quoteType') or '',
            })
        return out

    return get_cached('search', cache_key, SEARCH_TTL, fetch)


def get_compare(tickers: list[str], period: str = '1y') -> dict:
    cache_key = f"{','.join(sorted(t.upper() for t in tickers))}:{period}"

    def fetch():
        result = {}
        for ticker in tickers:
            df = yf.Ticker(ticker).history(period=period, interval='1d')
            if df.empty:
                continue
            normalized = (df['Close'] / df['Close'].iloc[0] * 100).reset_index()
            normalized['Date'] = normalized['Date'].astype(str)
            result[ticker.upper()] = (
                normalized[['Date', 'Close']]
                .rename(columns={'Date': 'date', 'Close': 'value'})
                .round(4)
                .to_dict(orient='records')
            )
        return result

    return get_cached('compare', cache_key, HISTORY_TTL, fetch)
