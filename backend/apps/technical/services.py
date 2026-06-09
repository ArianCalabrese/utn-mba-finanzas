import numpy as np
import yfinance as yf
from apps.core.cache import get_cached
from . import indicators as ind

INDICATOR_TTL = 900
CONVICTION_TTL = 900


def _fetch_ohlcv(ticker: str, period: str = '2y'):
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
        close, high, low, volume = df['Close'], df['High'], df['Low'], df['Volume']

        macd_line, signal_line, histogram = ind.macd(close)
        bb_upper, bb_mid, bb_lower = ind.bollinger_bands(close)
        stoch_k, stoch_d = ind.stochastic(high, low, close)
        adx_val, plus_di, minus_di = ind.adx(high, low, close)
        obv_series = ind.obv(close, volume)
        z_series = ind.z_score(close)

        bb_bandwidth = None
        if bb_mid.iloc[-1] and bb_mid.iloc[-1] != 0:
            bb_bandwidth = round(
                (float(bb_upper.iloc[-1]) - float(bb_lower.iloc[-1])) / float(bb_mid.iloc[-1]) * 100, 4
            )

        # Bollinger squeeze: current bandwidth below 20th percentile of last year
        bb_squeeze = False
        bw_series = ((bb_upper - bb_lower) / bb_mid.replace(0, np.nan) * 100).dropna()
        if len(bw_series) >= 20 and bb_bandwidth is not None:
            threshold = float(np.percentile(bw_series.tail(252), 20))
            bb_squeeze = bb_bandwidth < threshold

        # Drawdown from all-time high in the dataset
        ath = close.expanding().max()
        drawdown_series = (close - ath) / ath * 100
        drawdown_from_ath = _safe_float(drawdown_series)

        adx_current = _safe_float(adx_val)
        trend_strength = 'strong' if adx_current and adx_current > 25 else 'weak'

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
                'squeeze': bb_squeeze,
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
            'adx_14': {
                'adx': adx_current,
                'plus_di': _safe_float(plus_di),
                'minus_di': _safe_float(minus_di),
                'trend_strength': trend_strength,
            },
            'obv': _safe_float(obv_series),
            'z_score_200': _safe_float(z_series),
            'drawdown_from_ath': drawdown_from_ath,
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
            'squeeze': bb['squeeze'],
            'signal': 'overbought' if price >= bb['upper'] else ('oversold' if price <= bb['lower'] else 'neutral'),
        }

    stoch = data['stochastic']
    if stoch['k'] is not None:
        signals['stochastic'] = {
            'k': stoch['k'],
            'd': stoch['d'],
            'signal': 'oversold' if stoch['k'] < 20 else ('overbought' if stoch['k'] > 80 else 'neutral'),
        }

    adx_data = data['adx_14']
    if adx_data['adx'] is not None:
        adx_v = adx_data['adx']
        signals['adx'] = {
            'value': adx_v,
            'plus_di': adx_data['plus_di'],
            'minus_di': adx_data['minus_di'],
            'signal': 'strong_trend' if adx_v > 25 else 'weak_trend',
        }

    z = data['z_score_200']
    if z is not None:
        signals['z_score'] = {
            'value': z,
            'signal': 'oversold' if z < -2 else ('overbought' if z > 2 else 'neutral'),
        }

    bullish = sum(1 for s in signals.values() if s.get('signal') in ('bullish', 'oversold'))
    bearish = sum(1 for s in signals.values() if s.get('signal') in ('bearish', 'overbought'))
    signals['summary'] = {
        'bullish_signals': bullish,
        'bearish_signals': bearish,
        'overall': 'bullish' if bullish > bearish else ('bearish' if bearish > bullish else 'neutral'),
    }

    return {'ticker': ticker.upper(), 'signals': signals}


def get_conviction(ticker: str) -> dict:
    def fetch():
        data = get_indicators(ticker)

        try:
            from apps.fundamental.services import get_ratios, get_dcf
            ratios = get_ratios(ticker)
            dcf = get_dcf(ticker)
        except Exception:
            ratios = None
            dcf = None

        price = data['current_price']
        ma = data['moving_averages']
        adx_data = data['adx_14']
        adx_v = adx_data.get('adx')
        z = data.get('z_score_200')
        rsi_val = data.get('rsi_14')
        drawdown = data.get('drawdown_from_ath')

        # ── Layer 1: Trend (30%) ──────────────────────────────────────────────
        trend_scores: list[float] = []
        trend_signals: list[dict] = []

        if price and ma.get('sma_200'):
            above_200 = price > ma['sma_200']
            trend_scores.append(70 if above_200 else 30)
            trend_signals.append({'name': 'Precio vs SMA200', 'signal': 'bullish' if above_200 else 'bearish'})

        if ma.get('sma_50') and ma.get('sma_200'):
            golden = ma['sma_50'] > ma['sma_200']
            trend_scores.append(75 if golden else 25)
            trend_signals.append({'name': 'Golden/Death Cross', 'signal': 'bullish' if golden else 'bearish'})

        if adx_v is not None:
            if adx_v > 25:
                trend_scores.append(70)
                trend_signals.append({'name': 'ADX (14)', 'signal': 'strong_trend', 'value': round(adx_v, 1)})
            else:
                trend_scores.append(35)
                trend_signals.append({'name': 'ADX (14)', 'signal': 'weak_trend', 'value': round(adx_v, 1)})

        if z is not None:
            if z < -2:
                trend_scores.append(82)
                trend_signals.append({'name': 'Z-Score vs SMA200', 'signal': 'deep_oversold', 'value': round(z, 2)})
            elif z < -1:
                trend_scores.append(65)
                trend_signals.append({'name': 'Z-Score vs SMA200', 'signal': 'oversold', 'value': round(z, 2)})
            elif z > 2:
                trend_scores.append(18)
                trend_signals.append({'name': 'Z-Score vs SMA200', 'signal': 'overbought', 'value': round(z, 2)})
            else:
                trend_scores.append(50)
                trend_signals.append({'name': 'Z-Score vs SMA200', 'signal': 'neutral', 'value': round(z, 2)})

        trend_layer = round(sum(trend_scores) / len(trend_scores), 1) if trend_scores else 50.0

        # ── Layer 2: Momentum (25%) ───────────────────────────────────────────
        momentum_scores: list[float] = []
        momentum_signals: list[dict] = []

        if rsi_val is not None:
            if rsi_val < 30:
                s = 85
            elif rsi_val < 40:
                s = 68
            elif rsi_val > 70:
                s = 15
            elif rsi_val > 60:
                s = 32
            else:
                s = 50
            momentum_scores.append(s)
            sig = 'oversold' if rsi_val < 30 else ('near_oversold' if rsi_val < 40 else 'overbought' if rsi_val > 70 else 'neutral')
            momentum_signals.append({'name': 'RSI (14)', 'signal': sig, 'value': round(rsi_val, 1)})

        hist = data['macd']['histogram']
        if hist is not None:
            momentum_scores.append(68 if hist > 0 else 32)
            momentum_signals.append({
                'name': 'MACD Histograma',
                'signal': 'bullish' if hist > 0 else 'bearish',
                'value': round(hist, 4),
            })

        stoch_k = data['stochastic']['k']
        if stoch_k is not None:
            if stoch_k < 20:
                s = 78
            elif stoch_k > 80:
                s = 22
            else:
                s = 50
            momentum_scores.append(s)
            momentum_signals.append({
                'name': 'Estocástico %K',
                'signal': 'oversold' if stoch_k < 20 else ('overbought' if stoch_k > 80 else 'neutral'),
                'value': round(stoch_k, 1),
            })

        momentum_layer = round(sum(momentum_scores) / len(momentum_scores), 1) if momentum_scores else 50.0

        # ── Layer 3: Valuación (25%) ──────────────────────────────────────────
        valuation_scores: list[float] = []
        valuation_signals: list[dict] = []

        if dcf and dcf.get('margin_of_safety_pct') is not None:
            mos = dcf['margin_of_safety_pct']
            if mos > 30:
                s = 90
            elif mos > 15:
                s = 75
            elif mos > 0:
                s = 60
            elif mos > -20:
                s = 38
            else:
                s = 15
            valuation_scores.append(s)
            valuation_signals.append({
                'name': 'DCF Margen de Seguridad',
                'signal': 'undervalued' if mos > 15 else ('overvalued' if mos < 0 else 'fair'),
                'value': round(mos, 1),
            })

        if drawdown is not None:
            if drawdown < -40:
                s = 90
            elif drawdown < -30:
                s = 80
            elif drawdown < -20:
                s = 68
            elif drawdown < -10:
                s = 55
            else:
                s = 38
            valuation_scores.append(s)
            valuation_signals.append({
                'name': 'Drawdown desde ATH',
                'signal': 'deep_discount' if drawdown < -30 else ('discount' if drawdown < -10 else 'near_ath'),
                'value': round(drawdown, 1),
            })

        if ratios:
            pe = ratios.get('valuation', {}).get('pe_ratio')
            fpe = ratios.get('valuation', {}).get('forward_pe')
            if pe and fpe and pe > 0 and fpe > 0:
                if fpe < pe * 0.85:
                    valuation_scores.append(70)
                    valuation_signals.append({'name': 'Forward P/E vs P/E', 'signal': 'earnings_growth', 'value': round(fpe, 1)})
                elif fpe > pe * 1.15:
                    valuation_scores.append(30)
                    valuation_signals.append({'name': 'Forward P/E vs P/E', 'signal': 'earnings_decline', 'value': round(fpe, 1)})
                else:
                    valuation_scores.append(50)
                    valuation_signals.append({'name': 'Forward P/E vs P/E', 'signal': 'stable', 'value': round(fpe, 1)})

        valuation_layer = round(sum(valuation_scores) / len(valuation_scores), 1) if valuation_scores else None

        # ── Layer 4: Volatilidad / Volumen (20%) ──────────────────────────────
        vol_scores: list[float] = []
        vol_signals: list[dict] = []

        bb = data['bollinger_bands']
        squeeze = bb.get('squeeze', False)
        bw = bb.get('bandwidth_pct')

        if squeeze:
            vol_scores.append(62)
            vol_signals.append({'name': 'Bollinger Squeeze', 'signal': 'squeeze', 'note': 'Expansión inminente'})
        elif bw is not None:
            vol_scores.append(50)
            vol_signals.append({'name': 'BB Bandwidth', 'signal': 'low_vol' if bw < 5 else 'normal', 'value': round(bw, 1)})

        vol_layer = round(sum(vol_scores) / len(vol_scores), 1) if vol_scores else None

        # ── Weighted score ────────────────────────────────────────────────────
        base_weights = {'trend': 0.30, 'momentum': 0.25, 'valuation': 0.25, 'volatility': 0.20}
        layers = {
            'trend': (trend_layer, base_weights['trend']),
            'momentum': (momentum_layer, base_weights['momentum']),
            'valuation': (valuation_layer, base_weights['valuation']),
            'volatility': (vol_layer, base_weights['volatility']),
        }

        active = {k: v for k, v in layers.items() if v[0] is not None}
        total_w = sum(v[1] for v in active.values())
        score = round(sum(v[0] * v[1] / total_w for v in active.values()), 1) if total_w > 0 else 50.0

        if score >= 70:
            verdict = 'STRONG_BUY'
        elif score >= 58:
            verdict = 'BUY'
        elif score >= 42:
            verdict = 'HOLD'
        elif score >= 30:
            verdict = 'REDUCE'
        else:
            verdict = 'STRONG_REDUCE'

        # DCA signal: accelerate on deep discounts + fear; pause on greed
        if score >= 65 or (drawdown is not None and drawdown < -20 and (rsi_val is None or rsi_val < 60)):
            dca_signal = 'ACCUMULATE'
        elif score <= 35 or (rsi_val is not None and rsi_val > 73):
            dca_signal = 'PAUSE'
        else:
            dca_signal = 'NORMAL'

        return {
            'ticker': ticker.upper(),
            'conviction': {
                'score': score,
                'verdict': verdict,
                'dca_signal': dca_signal,
                'layers': {
                    'trend': {
                        'score': trend_layer,
                        'weight': base_weights['trend'],
                        'signals': trend_signals,
                    },
                    'momentum': {
                        'score': momentum_layer,
                        'weight': base_weights['momentum'],
                        'signals': momentum_signals,
                    },
                    'valuation': {
                        'score': valuation_layer,
                        'weight': base_weights['valuation'],
                        'signals': valuation_signals,
                        'available': valuation_layer is not None,
                    },
                    'volatility': {
                        'score': vol_layer,
                        'weight': base_weights['volatility'],
                        'signals': vol_signals,
                        'available': vol_layer is not None,
                    },
                },
            },
        }

    return get_cached('conviction', ticker.upper(), CONVICTION_TTL, fetch)
