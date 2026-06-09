import numpy as np
import pandas as pd
import yfinance as yf
from scipy.optimize import minimize
from apps.core.cache import get_cached

PORTFOLIO_TTL = 900


def _daily_returns(tickers: list[str], period: str = '2y') -> pd.DataFrame:
    frames = {}
    for ticker in tickers:
        df = yf.Ticker(ticker).history(period=period, interval='1d')
        if not df.empty:
            frames[ticker.upper()] = df['Close']
    if not frames:
        raise ValueError('No price data retrieved for the provided tickers.')
    prices = pd.DataFrame(frames).dropna()
    return prices.pct_change().dropna()


def optimize_portfolio(tickers: list[str], risk_free_rate: float = 0.05) -> dict:
    cache_key = f"opt:{','.join(sorted(t.upper() for t in tickers))}:{risk_free_rate}"

    def fetch():
        returns = _daily_returns(tickers)
        tickers_list = list(returns.columns)
        n = len(tickers_list)

        # Convert to plain numpy to avoid pandas 3.x / numpy interaction quirks
        ann_ret: np.ndarray = returns.mean().to_numpy() * 252
        ann_cov: np.ndarray = returns.cov().to_numpy() * 252

        def stats(w: np.ndarray) -> tuple[float, float, float]:
            ret = float(w @ ann_ret)
            vol = float(np.sqrt(w @ ann_cov @ w))
            sharpe = (ret - risk_free_rate) / vol if vol > 0 else 0.0
            return ret, vol, sharpe

        constraints = [{'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0}]
        bounds = [(0.0, 1.0)] * n
        w0 = np.full(n, 1.0 / n)

        res_sharpe = minimize(
            lambda w: -stats(w)[2], w0,
            method='SLSQP', bounds=bounds, constraints=constraints,
        )
        res_minvar = minimize(
            lambda w: stats(w)[1], w0,
            method='SLSQP', bounds=bounds, constraints=constraints,
        )

        def _portfolio_dict(weights: np.ndarray) -> dict:
            ret, vol, sharpe = stats(weights)
            return {
                'weights': {t: round(float(w), 4) for t, w in zip(tickers_list, weights)},
                'expected_annual_return': round(ret, 4),
                'annual_volatility': round(vol, 4),
                'sharpe_ratio': round(sharpe, 4),
            }

        target_rets = np.linspace(float(ann_ret.min()), float(ann_ret.max()), 25)
        frontier = []
        for target in target_rets:
            cons = constraints + [{'type': 'eq', 'fun': lambda w, t=target: w @ ann_ret - t}]
            res = minimize(lambda w: stats(w)[1], w0, method='SLSQP', bounds=bounds, constraints=cons)
            if res.success:
                frontier.append({
                    'expected_return': round(float(target), 4),
                    'volatility': round(float(res.fun), 4),
                })

        return {
            'tickers': tickers_list,
            'risk_free_rate': risk_free_rate,
            'max_sharpe': _portfolio_dict(res_sharpe.x),
            'min_variance': _portfolio_dict(res_minvar.x),
            'efficient_frontier': frontier,
        }

    return get_cached('portfolio_opt', cache_key, PORTFOLIO_TTL, fetch)


def compute_var(
    tickers: list[str],
    weights: list[float],
    portfolio_value: float = 100_000,
) -> dict:
    returns = _daily_returns(tickers)
    available = [t.upper() for t in tickers if t.upper() in returns.columns]

    w = np.array(weights[: len(available)], dtype=float)
    w /= w.sum()

    port_ret = returns[available].values @ w
    mu = float(port_ret.mean())
    sigma = float(port_ret.std())

    def _var_row(z: float):
        hist_pct = float(np.percentile(port_ret, (1 - z) * 100))
        param_pct = mu - abs(np.percentile(np.random.standard_normal(100_000), (1 - z) * 100)) * sigma
        return {
            'pct': round(hist_pct * 100, 3),
            'usd': round(hist_pct * portfolio_value, 2),
            'param_pct': round(param_pct * 100, 3),
            'param_usd': round(param_pct * portfolio_value, 2),
        }

    return {
        'portfolio_value': portfolio_value,
        'annual_volatility': round(sigma * np.sqrt(252), 4),
        'var_95': _var_row(0.95),
        'var_99': _var_row(0.99),
    }


def compute_correlation(tickers: list[str], benchmark: str = 'SPY') -> dict:
    all_tickers = list({t.upper() for t in tickers} | {benchmark.upper()})
    returns = _daily_returns(all_tickers)

    corr = returns.corr().round(4)
    bench = benchmark.upper()
    beta = {}
    if bench in returns.columns:
        bench_var = float(returns[bench].var())
        for t in [t.upper() for t in tickers]:
            if t in returns.columns and bench_var:
                if t == bench:
                    beta[t] = 1.0
                else:
                    # Use Series.cov(Series) to guarantee a scalar result
                    cov = float(returns[t].cov(returns[bench]))
                    beta[t] = round(cov / bench_var, 4)

    return {
        'correlation_matrix': corr.to_dict(),
        'beta_vs_benchmark': beta,
        'benchmark': bench,
    }


def backtest_portfolio(
    tickers: list[str],
    weights: list[float],
    period: str = '1y',
) -> dict:
    returns = _daily_returns(tickers, period=period)
    available = [t.upper() for t in tickers if t.upper() in returns.columns]

    w = np.array(weights[: len(available)], dtype=float)
    w /= w.sum()

    port_ret = returns[available] @ w
    cum = (1 + port_ret).cumprod()

    total_return = float(cum.iloc[-1]) - 1
    n_days = len(port_ret)
    annual_return = (1 + total_return) ** (252 / n_days) - 1
    annual_vol = float(port_ret.std()) * np.sqrt(252)
    max_drawdown = float(((cum - cum.cummax()) / cum.cummax()).min())
    sharpe = (annual_return - 0.05) / annual_vol if annual_vol > 0 else None

    curve = cum.reset_index()
    curve.columns = ['date', 'value']
    curve['date'] = curve['date'].astype(str)
    curve['value'] = curve['value'].round(6)

    return {
        'weights': {t: round(float(wi), 4) for t, wi in zip(available, w)},
        'total_return_pct': round(total_return * 100, 2),
        'annual_return_pct': round(annual_return * 100, 2),
        'annual_volatility_pct': round(annual_vol * 100, 2),
        'max_drawdown_pct': round(max_drawdown * 100, 2),
        'sharpe_ratio': round(sharpe, 4) if sharpe is not None else None,
        'equity_curve': curve.to_dict(orient='records'),
    }
