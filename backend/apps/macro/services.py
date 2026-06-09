import numpy as np
import yfinance as yf
from apps.core.cache import get_cached

MACRO_TTL = 1800  # 30 min

SECTOR_ETFS = {
    'Tecnología': 'XLK',
    'Salud': 'XLV',
    'Financiero': 'XLF',
    'Energía': 'XLE',
    'Cons. Discr.': 'XLY',
    'Cons. Básico': 'XLP',
    'Industrial': 'XLI',
    'Utilities': 'XLU',
    'Comm. Serv.': 'XLC',
}


def _vix_signal(vix: float) -> str:
    if vix < 12:
        return 'complacency'
    if vix < 20:
        return 'low_fear'
    if vix < 30:
        return 'elevated'
    if vix < 40:
        return 'high_fear'
    return 'extreme_fear'


def get_market_regime() -> dict:
    def fetch():
        # SP500
        sp_hist = yf.Ticker('^GSPC').history(period='1y', interval='1d')
        sp_close = sp_hist['Close']
        sp_price = float(sp_close.iloc[-1])
        sp_sma200 = float(sp_close.rolling(200).mean().iloc[-1])
        sp_sma50 = float(sp_close.rolling(50).mean().iloc[-1])
        sp_above_200 = sp_price > sp_sma200
        sp_ytd_start = sp_close[sp_close.index.year == sp_close.index[-1].year].iloc[0]
        sp_ytd = round((sp_price / float(sp_ytd_start) - 1) * 100, 2)
        sp_ret_1m = round((sp_price / float(sp_close.iloc[-21]) - 1) * 100, 2)

        # VIX
        vix_hist = yf.Ticker('^VIX').history(period='1y', interval='1d')
        vix_current = float(vix_hist['Close'].iloc[-1])
        vix_avg = float(vix_hist['Close'].mean())
        vix_percentile = float(
            np.percentile(vix_hist['Close'].dropna(), 50)
        )

        # Overall regime
        if sp_above_200 and vix_current < 25:
            regime = 'bull'
            regime_label = 'Mercado alcista'
        elif not sp_above_200 and vix_current > 28:
            regime = 'bear'
            regime_label = 'Mercado bajista'
        else:
            regime = 'uncertain'
            regime_label = 'Mercado incierto'

        # Sector performance
        sectors = {}
        for name, etf in SECTOR_ETFS.items():
            try:
                hist = yf.Ticker(etf).history(period='3mo', interval='1d')
                if hist.empty or len(hist) < 5:
                    continue
                c = hist['Close']
                ret_1m = round((float(c.iloc[-1]) / float(c.iloc[max(-21, -len(c))]) - 1) * 100, 2)
                ret_3m = round((float(c.iloc[-1]) / float(c.iloc[0]) - 1) * 100, 2)
                sectors[name] = {
                    'etf': etf,
                    'price': round(float(c.iloc[-1]), 2),
                    'return_1m': ret_1m,
                    'return_3m': ret_3m,
                }
            except Exception:
                pass

        # DCA macro filter: is it a good macro environment to be adding?
        dca_macro = 'favorable' if (sp_above_200 and vix_current > 20) or vix_current > 30 else \
                    'neutral' if sp_above_200 and vix_current < 20 else 'caution'

        return {
            'regime': regime,
            'regime_label': regime_label,
            'dca_macro_filter': dca_macro,
            'sp500': {
                'price': round(sp_price, 2),
                'sma_50': round(sp_sma50, 2),
                'sma_200': round(sp_sma200, 2),
                'above_sma200': sp_above_200,
                'return_ytd': sp_ytd,
                'return_1m': sp_ret_1m,
            },
            'vix': {
                'current': round(vix_current, 2),
                'avg_52w': round(vix_avg, 2),
                'median_52w': round(vix_percentile, 2),
                'signal': _vix_signal(vix_current),
                'vs_avg_pct': round((vix_current / vix_avg - 1) * 100, 1),
            },
            'sectors': sectors,
        }

    return get_cached('macro', 'regime', MACRO_TTL, fetch)


def get_relative_strength(ticker: str, benchmark: str = '^GSPC', period: str = '6mo') -> dict:
    cache_key = f"{ticker.upper()}:{benchmark}:{period}"

    def fetch():
        t_hist = yf.Ticker(ticker).history(period=period, interval='1d')
        b_hist = yf.Ticker(benchmark).history(period=period, interval='1d')

        if t_hist.empty or b_hist.empty:
            raise ValueError('No data available for relative strength calculation.')

        t_ret = (t_hist['Close'].iloc[-1] / t_hist['Close'].iloc[0] - 1) * 100
        b_ret = (b_hist['Close'].iloc[-1] / b_hist['Close'].iloc[0] - 1) * 100

        rs_ratio = float(t_hist['Close'].iloc[-1] / b_hist['Close'].iloc[-1])
        outperforming = float(t_ret) > float(b_ret)

        return {
            'ticker': ticker.upper(),
            'benchmark': benchmark,
            'period': period,
            'ticker_return_pct': round(float(t_ret), 2),
            'benchmark_return_pct': round(float(b_ret), 2),
            'alpha_pct': round(float(t_ret) - float(b_ret), 2),
            'outperforming': outperforming,
            'rs_ratio': round(rs_ratio, 6),
        }

    return get_cached('rs', cache_key, MACRO_TTL, fetch)
