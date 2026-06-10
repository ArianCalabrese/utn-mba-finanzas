import numpy as np
import pandas as pd
import yfinance as yf
from scipy.optimize import minimize
from apps.core.cache import get_cached
from apps.market.services import get_quote

PORTFOLIO_TTL = 900
FX_TTL = 900


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


# ─── Simulación Monte Carlo ──────────────────────────────────────────────────

TRADING_DAYS_PER_MONTH = 21


def simulate_montecarlo(
    tickers: list[str],
    weights: list[float],
    initial_investment: float = 10_000,
    monthly_contribution: float = 0,
    years: int = 10,
    n_sims: int = 1_000,
    target_value: float | None = None,
    method: str = 'bootstrap',
) -> dict:
    """Proyecta el valor futuro de una cartera con aportes mensuales (DCA).

    - 'bootstrap': remuestrea retornos diarios históricos (5 años) de la
      cartera ponderada, sin asumir normalidad (conserva colas gordas).
    - 'normal': GBM clásico con media/volatilidad log-normales históricas.

    El aporte mensual se acredita al cierre de cada mes, después del retorno.
    """
    years = int(max(1, min(years, 40)))
    n_sims = int(max(100, min(n_sims, 5_000)))
    months = years * 12

    returns = _daily_returns(tickers, period='5y')
    available = [t.upper() for t in tickers if t.upper() in returns.columns]
    if not available:
        raise ValueError('No price data retrieved for the provided tickers.')

    w = np.array(weights[: len(available)], dtype=float)
    w /= w.sum()
    port_ret = (returns[available].to_numpy() @ w)

    log_ret = np.log1p(port_ret)
    mu_ann = float(log_ret.mean()) * 252
    sigma_ann = float(log_ret.std()) * np.sqrt(252)

    rng = np.random.default_rng()
    if method == 'normal':
        monthly_log = rng.normal(
            mu_ann / 12, sigma_ann / np.sqrt(12), size=(n_sims, months),
        )
        growth = np.exp(monthly_log)
    else:
        # iid bootstrap de días históricos, agregados en meses de 21 ruedas
        sampled = rng.choice(port_ret, size=(n_sims, months, TRADING_DAYS_PER_MONTH), replace=True)
        growth = np.prod(1 + sampled, axis=2)

    values = np.empty((n_sims, months + 1))
    values[:, 0] = initial_investment
    for m in range(1, months + 1):
        values[:, m] = values[:, m - 1] * growth[:, m - 1] + monthly_contribution

    percentiles = {p: np.percentile(values, p, axis=0) for p in (5, 25, 50, 75, 95)}
    invested = initial_investment + monthly_contribution * np.arange(months + 1)

    # Muestreo de la línea de tiempo: mensual hasta 10 años, trimestral después.
    step = 1 if months <= 120 else 3
    timeline = [
        {
            'month': m,
            'invested': round(float(invested[m]), 2),
            'p5': round(float(percentiles[5][m]), 2),
            'p25': round(float(percentiles[25][m]), 2),
            'p50': round(float(percentiles[50][m]), 2),
            'p75': round(float(percentiles[75][m]), 2),
            'p95': round(float(percentiles[95][m]), 2),
        }
        for m in range(0, months + 1, step)
    ]
    if timeline[-1]['month'] != months:
        timeline.append({
            'month': months,
            'invested': round(float(invested[months]), 2),
            **{f'p{p}': round(float(percentiles[p][months]), 2) for p in (5, 25, 50, 75, 95)},
        })

    finals = values[:, -1]
    invested_total = float(invested[-1])
    final = {
        'mean': round(float(finals.mean()), 2),
        **{f'p{p}': round(float(np.percentile(finals, p)), 2) for p in (5, 25, 50, 75, 95)},
        'prob_loss_pct': round(float((finals < invested_total).mean() * 100), 1),
        'median_multiple': round(float(np.median(finals)) / invested_total, 2) if invested_total else None,
    }
    if target_value:
        final['target_value'] = float(target_value)
        final['prob_target_pct'] = round(float((finals >= target_value).mean() * 100), 1)

    return {
        'method': method,
        'years': years,
        'months': months,
        'n_sims': n_sims,
        'initial_investment': initial_investment,
        'monthly_contribution': monthly_contribution,
        'invested_total': round(invested_total, 2),
        'weights': {t: round(float(wi), 4) for t, wi in zip(available, w)},
        'historical': {
            'annual_return_pct': round(float(np.exp(mu_ann) - 1) * 100, 2),
            'annual_volatility_pct': round(float(sigma_ann) * 100, 2),
        },
        'timeline': timeline,
        'final': final,
    }


# ─── Seguimiento de tenencias reales (Fase 1) ────────────────────────────────

def get_fx_rate(frm: str, to: str) -> float | None:
    """Devuelve cuántas unidades de `to` equivale 1 unidad de `frm`.

    Usa el par FX de Yahoo (ej. 'USDARS=X'). None si no hay cotización.
    """
    frm, to = frm.upper().strip(), to.upper().strip()
    if not frm or not to or frm == to:
        return 1.0

    def fetch():
        df = yf.Ticker(f'{frm}{to}=X').history(period='5d', interval='1d')
        if df.empty:
            return None
        closes = df['Close'].dropna()
        return float(closes.iloc[-1]) if not closes.empty else None

    return get_cached('fx', f'{frm}:{to}', FX_TTL, fetch)


def _derive_positions(transactions: list) -> dict:
    """Reduce los movimientos (orden cronológico) a posiciones por ticker.

    Usa costo promedio ponderado: cada compra recalcula el promedio (DCA),
    cada venta libera costo al promedio vigente y acumula P&L realizado.
    """
    positions: dict[str, dict] = {}
    ordered = sorted(transactions, key=lambda t: (t.trade_date, t.created_at))

    for txn in ordered:
        ticker = txn.ticker.upper()
        pos = positions.setdefault(ticker, {
            'qty': 0.0, 'cost': 0.0, 'realized': 0.0, 'currency': txn.currency or 'USD',
        })
        if txn.currency:
            pos['currency'] = txn.currency
        qty, price, fees = float(txn.quantity), float(txn.price), float(txn.fees or 0)

        if txn.side == 'BUY':
            pos['qty'] += qty
            pos['cost'] += qty * price + fees
        else:  # SELL
            if pos['qty'] > 0:
                avg = pos['cost'] / pos['qty']
                sell_qty = min(qty, pos['qty'])
                pos['realized'] += (price * sell_qty - fees) - avg * sell_qty
                pos['qty'] -= sell_qty
                pos['cost'] -= avg * sell_qty

    return positions


def build_summary(portfolio) -> dict:
    """Construye el resumen de una cartera con precios en vivo y P&L.

    Valores nativos en la moneda de cada activo, convertidos a la moneda base
    de la cartera para los totales consolidados.
    """
    base = (portfolio.base_currency or 'USD').upper()
    derived = _derive_positions(list(portfolio.transactions.all()))

    positions = []
    fx_warning = False
    total_invested = total_value = total_realized = 0.0

    for ticker, pos in derived.items():
        realized = round(pos['realized'], 2)
        # Sumamos P&L realizado aunque la posición esté cerrada.
        if pos['qty'] <= 1e-9:
            if abs(realized) > 1e-9:
                total_realized += realized  # convertido abajo si hace falta
            continue

        avg_cost = pos['cost'] / pos['qty']
        invested_native = pos['cost']

        price = None
        currency = pos['currency']
        name = None
        try:
            quote = get_quote(ticker)
            price = quote.get('price')
            currency = quote.get('currency') or currency
            name = quote.get('name')
        except Exception:
            pass

        price_available = price is not None
        market_value_native = (price * pos['qty']) if price_available else invested_native
        unrealized_native = market_value_native - invested_native
        unrealized_pct = (unrealized_native / invested_native * 100) if invested_native else 0.0

        fx = get_fx_rate(currency, base)
        if fx is None:
            fx_warning = True
            fx = 1.0
        invested_base = invested_native * fx
        value_base = market_value_native * fx

        total_invested += invested_base
        total_value += value_base
        total_realized += realized * fx

        positions.append({
            'ticker': ticker,
            'name': name,
            'quantity': round(pos['qty'], 6),
            'avg_cost': round(avg_cost, 4),
            'currency': currency,
            'current_price': round(price, 4) if price_available else None,
            'price_available': price_available,
            'invested_native': round(invested_native, 2),
            'market_value_native': round(market_value_native, 2),
            'unrealized_native': round(unrealized_native, 2),
            'unrealized_pct': round(unrealized_pct, 2),
            'distance_to_entry_pct': round((price - avg_cost) / avg_cost * 100, 2) if price_available and avg_cost else None,
            'dca_opportunity': bool(price_available and price < avg_cost),
            'realized_native': realized,
            'fx_rate': round(fx, 6),
            'invested_base': round(invested_base, 2),
            'market_value_base': round(value_base, 2),
            'unrealized_base': round(value_base - invested_base, 2),
        })

    # Pesos sobre el valor de mercado consolidado.
    for p in positions:
        p['weight_pct'] = round(p['market_value_base'] / total_value * 100, 2) if total_value else 0.0

    positions.sort(key=lambda p: p['market_value_base'], reverse=True)

    total_unrealized = total_value - total_invested
    return {
        'portfolio': {
            'id': portfolio.id,
            'name': portfolio.name,
            'category': portfolio.category,
            'base_currency': base,
        },
        'positions': positions,
        'totals': {
            'base_currency': base,
            'invested': round(total_invested, 2),
            'market_value': round(total_value, 2),
            'unrealized': round(total_unrealized, 2),
            'unrealized_pct': round(total_unrealized / total_invested * 100, 2) if total_invested else 0.0,
            'realized': round(total_realized, 2),
            'fx_warning': fx_warning,
        },
    }
