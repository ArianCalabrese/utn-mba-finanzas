import numpy as np
import yfinance as yf
from apps.core.cache import get_cached
from . import indicators as ind

INDICATOR_TTL = 900


def _fetch_ohlcv(ticker: str, period: str = '1y'):
    df = yf.Ticker(ticker).history(period=period, interval='1d')
    if df.empty:
        raise ValueError(f"No data found for ticker '{ticker}'.")
    return df


def _safe_float(series_or_scalar) -> float | None:
    try:
        val = series_or_scalar.iloc[-1] if hasattr(series_or_scalar, 'iloc') else series_or_scalar
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        return round(float(val), 4)
    except Exception:
        return None


def get_indicators(ticker: str) -> dict:
    def fetch():
        df = _fetch_ohlcv(ticker)
        close, high, low = df['Close'], df['High'], df['Low']

        macd_line, signal_line, histogram = ind.macd(close)
        bb_upper, bb_mid, bb_lower = ind.bollinger_bands(close)
        stoch_k, stoch_d = ind.stochastic(high, low, close)

        bb_bandwidth = None
        if bb_mid.iloc[-1] and bb_mid.iloc[-1] != 0:
            bb_bandwidth = round(
                (float(bb_upper.iloc[-1]) - float(bb_lower.iloc[-1])) / float(bb_mid.iloc[-1]) * 100, 4
            )

        return {
            'ticker': ticker.upper(),
            'current_price': _safe_float(close),
            'rsi_14': _safe_float(ind.rsi(close)),
            'macd': {
                'macd': _safe_float(macd_line),
                'signal': _safe_float(signal_line),
                'histogram': _safe_float(histogram),
            },
            'bollinger_bands': {
                'upper': _safe_float(bb_upper),
                'mid': _safe_float(bb_mid),
                'lower': _safe_float(bb_lower),
                'bandwidth_pct': bb_bandwidth,
            },
            'moving_averages': {
                'sma_20': _safe_float(ind.sma(close, 20)),
                'sma_50': _safe_float(ind.sma(close, 50)),
                'sma_200': _safe_float(ind.sma(close, 200)),
                'ema_12': _safe_float(ind.ema(close, 12)),
                'ema_26': _safe_float(ind.ema(close, 26)),
            },
            'atr_14': _safe_float(ind.atr(high, low, close)),
            'stochastic': {
                'k': _safe_float(stoch_k),
                'd': _safe_float(stoch_d),
            },
        }

    return get_cached('indicators', ticker.upper(), INDICATOR_TTL, fetch)


def get_signals(ticker: str) -> dict:
    data = get_indicators(ticker)
    signals: dict = {}

    rsi_val = data['rsi_14']
    if rsi_val is not None:
        signals['rsi'] = {
            'value': rsi_val,
            'signal': 'oversold' if rsi_val < 30 else 'overbought' if rsi_val > 70 else 'neutral',
        }

    hist = data['macd']['histogram']
    macd_val = data['macd']['macd']
    if hist is not None and macd_val is not None:
        signals['macd'] = {
            'value': macd_val,
            'histogram': hist,
            'signal': 'bullish' if hist > 0 else 'bearish',
        }

    price = data['current_price']
    ma = data['moving_averages']
    if price and ma['sma_50'] and ma['sma_200']:
        golden_cross = ma['sma_50'] > ma['sma_200']
        above_200 = price > ma['sma_200']
        signals['moving_averages'] = {
            'above_sma_200': above_200,
            'golden_cross': golden_cross,
            'signal': 'bullish' if golden_cross and above_200 else ('bearish' if not above_200 else 'neutral'),
        }

    bb = data['bollinger_bands']
    if price and bb['upper'] and bb['lower']:
        signals['bollinger'] = {
            'bandwidth_pct': bb['bandwidth_pct'],
            'signal': 'overbought' if price >= bb['upper'] else ('oversold' if price <= bb['lower'] else 'neutral'),
        }

    stoch = data['stochastic']
    if stoch['k'] is not None:
        signals['stochastic'] = {
            'k': stoch['k'],
            'd': stoch['d'],
            'signal': 'oversold' if stoch['k'] < 20 else ('overbought' if stoch['k'] > 80 else 'neutral'),
        }

    bullish = sum(1 for s in signals.values() if s.get('signal') in ('bullish', 'oversold'))
    bearish = sum(1 for s in signals.values() if s.get('signal') in ('bearish', 'overbought'))
    signals['summary'] = {
        'bullish_signals': bullish,
        'bearish_signals': bearish,
        'overall': 'bullish' if bullish > bearish else ('bearish' if bearish > bullish else 'neutral'),
    }

    return {'ticker': ticker.upper(), 'signals': signals}
