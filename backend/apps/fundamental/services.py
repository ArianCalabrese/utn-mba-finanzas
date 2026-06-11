import numpy as np
import pandas as pd
import yfinance as yf
from apps.core.cache import get_cached

FUNDAMENTAL_TTL = 3600


def get_ratios(ticker: str) -> dict:
    def fetch():
        info = yf.Ticker(ticker).info
        return {
            'ticker': ticker.upper(),
            'valuation': {
                'pe_ratio': info.get('trailingPE'),
                'forward_pe': info.get('forwardPE'),
                'peg_ratio': info.get('pegRatio'),
                'price_to_book': info.get('priceToBook'),
                'price_to_sales': info.get('priceToSalesTrailing12Months'),
                'ev_to_ebitda': info.get('enterpriseToEbitda'),
                'ev_to_revenue': info.get('enterpriseToRevenue'),
                'enterprise_value': info.get('enterpriseValue'),
            },
            'profitability': {
                'roe': info.get('returnOnEquity'),
                'roa': info.get('returnOnAssets'),
                'gross_margin': info.get('grossMargins'),
                'operating_margin': info.get('operatingMargins'),
                'net_margin': info.get('profitMargins'),
                'ebitda_margin': info.get('ebitdaMargins'),
            },
            'liquidity_solvency': {
                'current_ratio': info.get('currentRatio'),
                'quick_ratio': info.get('quickRatio'),
                'debt_to_equity': info.get('debtToEquity'),
                'total_debt': info.get('totalDebt'),
                'cash': info.get('totalCash'),
            },
            'growth': {
                'revenue_growth': info.get('revenueGrowth'),
                'earnings_growth': info.get('earningsGrowth'),
                'earnings_quarterly_growth': info.get('earningsQuarterlyGrowth'),
            },
            'per_share': {
                'eps_trailing': info.get('trailingEps'),
                'eps_forward': info.get('forwardEps'),
                'book_value': info.get('bookValue'),
                'revenue_per_share': info.get('revenuePerShare'),
            },
        }

    return get_cached('ratios', ticker.upper(), FUNDAMENTAL_TTL, fetch)


def get_statements(ticker: str) -> dict:
    def fetch():
        t = yf.Ticker(ticker)

        def _df_to_dict(df: pd.DataFrame | None) -> dict:
            if df is None or df.empty:
                return {}
            df = df.copy()
            df.columns = [str(c)[:10] for c in df.columns]
            result = {}
            for row in df.index:
                result[str(row)] = {
                    col: (None if pd.isna(val) else round(float(val), 0))
                    for col, val in df.loc[row].items()
                }
            return result

        return {
            'income_statement': _df_to_dict(t.financials),
            'balance_sheet': _df_to_dict(t.balance_sheet),
            'cash_flow': _df_to_dict(t.cashflow),
        }

    return get_cached('statements', ticker.upper(), FUNDAMENTAL_TTL, fetch)


def get_dividends(ticker: str) -> dict:
    def fetch():
        t = yf.Ticker(ticker)
        info = t.info
        hist = t.dividends

        if hist.empty:
            return {'ticker': ticker.upper(), 'pays_dividends': False}

        hist_annual = hist.resample('YE').sum()
        cagr = None
        if len(hist_annual) >= 2:
            first = float(hist_annual.iloc[0])
            last = float(hist_annual.iloc[-1])
            years = len(hist_annual) - 1
            if first > 0:
                cagr = round(((last / first) ** (1 / years) - 1) * 100, 2)

        records = hist.reset_index()
        records['Date'] = records['Date'].astype(str)

        return {
            'ticker': ticker.upper(),
            'pays_dividends': True,
            'dividend_yield': info.get('dividendYield'),
            'dividend_rate': info.get('dividendRate'),
            'payout_ratio': info.get('payoutRatio'),
            'five_year_avg_yield': info.get('fiveYearAvgDividendYield'),
            'dividend_cagr_pct': cagr,
            'history': (
                records[['Date', 'Dividends']]
                .rename(columns={'Dividends': 'amount'})
                .to_dict(orient='records')
            ),
        }

    return get_cached('dividends', ticker.upper(), FUNDAMENTAL_TTL, fetch)


# --- DCF assumptions / CAPM defaults -----------------------------------------
RISK_FREE_RATE = 0.043          # ~10Y US Treasury (2026)
EQUITY_RISK_PREMIUM = 0.055     # historical US equity risk premium
DEFAULT_TAX_RATE = 0.21         # US statutory corporate rate
CREDIT_SPREAD = 0.015           # pre-tax spread over risk-free for cost of debt
MC_RUNS = 10000                 # Monte Carlo simulations


def _ordered_series(series: pd.Series) -> pd.Series:
    """Drop NaNs and force most-recent-first order regardless of yfinance version."""
    s = series.dropna()
    return s.reindex(sorted(s.index, reverse=True))


def _revenue_series(t) -> pd.Series | None:
    """Annual Total Revenue, most-recent-first, or None if unavailable."""
    for attr in ('financials', 'income_stmt'):
        stmt = getattr(t, attr, None)
        if stmt is None or getattr(stmt, 'empty', True):
            continue
        for row in ('Total Revenue', 'TotalRevenue', 'Revenue'):
            if row in stmt.index:
                rev = _ordered_series(stmt.loc[row].astype(float))
                if not rev.empty:
                    return rev
    return None


def _estimate_wacc(info: dict, terminal_growth: float) -> tuple[float, dict]:
    """Estimate WACC bottom-up via CAPM + after-tax cost of debt."""
    beta = info.get('beta')
    beta = float(beta) if beta else 1.0
    beta = float(np.clip(beta, 0.3, 2.5))

    cost_of_equity = RISK_FREE_RATE + beta * EQUITY_RISK_PREMIUM
    cost_of_debt_after_tax = (RISK_FREE_RATE + CREDIT_SPREAD) * (1 - DEFAULT_TAX_RATE)

    equity = float(info.get('marketCap') or 0)
    debt = float(info.get('totalDebt') or 0)
    total = equity + debt

    if total <= 0:
        wacc = cost_of_equity
        w_equity, w_debt = 1.0, 0.0
    else:
        w_equity, w_debt = equity / total, debt / total
        wacc = w_equity * cost_of_equity + w_debt * cost_of_debt_after_tax

    wacc = float(np.clip(wacc, 0.05, 0.18))
    if wacc <= terminal_growth:
        wacc = terminal_growth + 0.03

    breakdown = {
        'method': 'capm',
        'risk_free_rate': round(RISK_FREE_RATE, 4),
        'beta': round(beta, 3),
        'equity_risk_premium': round(EQUITY_RISK_PREMIUM, 4),
        'cost_of_equity': round(cost_of_equity, 4),
        'cost_of_debt_after_tax': round(cost_of_debt_after_tax, 4),
        'tax_rate': DEFAULT_TAX_RATE,
        'weight_equity': round(w_equity, 4),
        'weight_debt': round(w_debt, 4),
    }
    return wacc, breakdown


def _fade_growth_path(g0: float, terminal_growth: float, years: int) -> list[float]:
    """Linear fade: year 1 = g0, last year = terminal_growth."""
    if years <= 1:
        return [terminal_growth]
    return [g0 + (terminal_growth - g0) * (i / (years - 1)) for i in range(years)]


def _monte_carlo_dcf(base_fcf, g0, wacc_base, tg_base, years, net_debt, shares, current_price):
    """Vectorised Monte Carlo over growth / WACC / terminal growth -> value distribution."""
    if not shares or shares <= 0:
        return None

    rng = np.random.default_rng(42)
    g0d = np.clip(rng.normal(g0, 0.03, MC_RUNS), -0.10, 0.35)
    waccd = np.clip(rng.normal(wacc_base, 0.01, MC_RUNS), 0.04, 0.20)
    tgd = np.clip(rng.normal(tg_base, 0.004, MC_RUNS), 0.005, 0.035)
    waccd = np.maximum(waccd, tgd + 0.005)  # keep Gordon formula valid

    yrs = np.arange(years)
    frac = yrs / (years - 1) if years > 1 else np.zeros(1)
    growth = g0d[:, None] + (tgd[:, None] - g0d[:, None]) * frac[None, :]
    fcf_path = base_fcf * np.cumprod(1 + growth, axis=1)

    disc = (1 + waccd[:, None]) ** (yrs + 1)[None, :]
    pv = np.sum(fcf_path / disc, axis=1)
    terminal = fcf_path[:, -1] * (1 + tgd) / (waccd - tgd)
    pv_term = terminal / (1 + waccd) ** years
    equity = pv + pv_term - net_debt
    per_share = equity / shares

    p10, bear, median, bull, p90 = np.percentile(per_share, [10, 25, 50, 75, 90])
    result = {
        'runs': MC_RUNS,
        'intrinsic_value_per_share': {
            'p10': round(float(p10), 2),
            'bear': round(float(bear), 2),
            'median': round(float(median), 2),
            'bull': round(float(bull), 2),
            'p90': round(float(p90), 2),
        },
    }
    if current_price and current_price > 0:
        result['prob_undervalued_pct'] = round(float(np.mean(per_share > current_price) * 100), 1)
    return result


def get_dcf(
    ticker: str,
    wacc: float | None = None,
    terminal_growth: float = 0.025,
    years: int = 5,
) -> dict:
    cache_key = f"{ticker.upper()}:{wacc if wacc is not None else 'auto'}:{terminal_growth}:{years}"

    def fetch():
        t = yf.Ticker(ticker)
        info = t.info
        cf = t.cashflow

        if cf is None or cf.empty:
            raise ValueError('No cash flow statement available for this ticker.')

        # Resolve row names across yfinance versions
        ocf_candidates = ['Operating Cash Flow', 'Total Cash From Operating Activities']
        capex_candidates = ['Capital Expenditure', 'Capital Expenditures']

        ocf_row = next((r for r in ocf_candidates if r in cf.index), None)
        capex_row = next((r for r in capex_candidates if r in cf.index), None)

        if not ocf_row or not capex_row:
            raise ValueError('Could not locate FCF rows in the cash flow statement.')

        fcf_series = _ordered_series(cf.loc[ocf_row] + cf.loc[capex_row])
        if fcf_series.empty:
            raise ValueError('No FCF data available after combining OCF and CapEx.')

        latest_fcf = float(fcf_series.iloc[0])
        rev_series = _revenue_series(t)

        shares = info.get('sharesOutstanding') or info.get('impliedSharesOutstanding')
        net_debt = float((info.get('totalDebt') or 0) - (info.get('totalCash') or 0))
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')

        # --- Normalised base FCF -------------------------------------------------
        # Prefer a normalised FCF margin (median margin x latest revenue): this keeps
        # the base at current scale while smoothing out one-off CapEx / WC swings.
        base_method = 'median_fcf'
        fcf_margin_used = None
        base_fcf = None
        if rev_series is not None:
            aligned = pd.concat([fcf_series, rev_series], axis=1, join='inner').dropna()
            if not aligned.empty:
                margins = (aligned.iloc[:, 0] / aligned.iloc[:, 1]).replace([np.inf, -np.inf], np.nan).dropna()
                latest_rev = float(rev_series.iloc[0])
                if len(margins) >= 2 and latest_rev > 0:
                    fcf_margin_used = float(margins.median())
                    base_fcf = fcf_margin_used * latest_rev
                    base_method = 'normalized_fcf_margin'
        if base_fcf is None:
            window = fcf_series.head(min(4, len(fcf_series)))
            base_fcf = float(window.median())

        # Companies that burn cash are not suitable for a classic FCF DCF.
        if base_fcf <= 0:
            return {
                'ticker': ticker.upper(),
                'applicable': False,
                'reason': 'Base FCF is not positive — a classic DCF is not applicable to a cash-burning company.',
                'latest_fcf': round(latest_fcf, 0),
                'base_fcf': round(base_fcf, 0),
                'current_price': current_price,
            }

        # --- Initial growth from revenue CAGR (more stable than FCF) -------------
        growth_source = 'revenue_cagr'
        g0 = None
        if rev_series is not None and len(rev_series) >= 2:
            rev_recent, rev_old = float(rev_series.iloc[0]), float(rev_series.iloc[-1])
            n = len(rev_series) - 1
            if rev_recent > 0 and rev_old > 0:
                g0 = (rev_recent / rev_old) ** (1 / n) - 1
        if g0 is None:
            g0 = float(info.get('revenueGrowth') or 0.05)
            growth_source = 'revenue_growth_ttm'
        g0 = float(np.clip(g0, -0.05, 0.25))

        # --- WACC: user-supplied or bottom-up CAPM -------------------------------
        if wacc is not None:
            wacc_used = float(wacc)
            wacc_breakdown = {'method': 'user'}
        else:
            wacc_used, wacc_breakdown = _estimate_wacc(info, terminal_growth)

        # --- Deterministic projection with fading growth -------------------------
        growth_path = _fade_growth_path(g0, terminal_growth, years)
        projected_fcf, prev = [], base_fcf
        for g in growth_path:
            prev = prev * (1 + g)
            projected_fcf.append(prev)
        pv_fcf = [fcf / (1 + wacc_used) ** i for i, fcf in enumerate(projected_fcf, 1)]

        terminal_value = projected_fcf[-1] * (1 + terminal_growth) / (wacc_used - terminal_growth)
        pv_terminal = terminal_value / (1 + wacc_used) ** years

        total_pv = sum(pv_fcf) + pv_terminal
        equity_value = total_pv - net_debt
        intrinsic_value = (equity_value / shares) if shares else None

        margin_of_safety = None
        if intrinsic_value and current_price and intrinsic_value > 0:
            margin_of_safety = round((intrinsic_value - current_price) / intrinsic_value * 100, 2)

        monte_carlo = _monte_carlo_dcf(
            base_fcf, g0, wacc_used, terminal_growth, years, net_debt, shares, current_price
        )

        return {
            'ticker': ticker.upper(),
            'applicable': True,
            'assumptions': {
                'wacc': round(wacc_used, 4),
                'terminal_growth_rate': terminal_growth,
                'fcf_growth_rate': round(g0, 4),
                'projection_years': years,
            },
            'wacc_breakdown': wacc_breakdown,
            'base_fcf': round(base_fcf, 0),
            'base_fcf_method': base_method,
            'latest_fcf': round(latest_fcf, 0),
            'fcf_margin_used': round(fcf_margin_used, 4) if fcf_margin_used is not None else None,
            'growth_source': growth_source,
            'growth_path': [round(g, 4) for g in growth_path],
            'projected_fcf': [round(v, 0) for v in projected_fcf],
            'pv_fcf': [round(v, 0) for v in pv_fcf],
            'terminal_value': round(terminal_value, 0),
            'pv_terminal_value': round(pv_terminal, 0),
            'terminal_value_weight_pct': round(pv_terminal / total_pv * 100, 1) if total_pv else None,
            'total_pv': round(total_pv, 0),
            'net_debt': round(net_debt, 0),
            'equity_value': round(equity_value, 0),
            'shares_outstanding': shares,
            'intrinsic_value_per_share': round(intrinsic_value, 2) if intrinsic_value else None,
            'current_price': current_price,
            'margin_of_safety_pct': margin_of_safety,
            'monte_carlo': monte_carlo,
        }

    return get_cached('dcf', cache_key, FUNDAMENTAL_TTL, fetch)
