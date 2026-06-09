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


def get_dcf(
    ticker: str,
    wacc: float = 0.10,
    terminal_growth: float = 0.025,
    years: int = 5,
) -> dict:
    cache_key = f"{ticker.upper()}:{wacc}:{terminal_growth}:{years}"

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

        fcf_series = (cf.loc[ocf_row] + cf.loc[capex_row]).dropna()
        if fcf_series.empty:
            raise ValueError('No FCF data available after combining OCF and CapEx.')

        base_fcf = float(fcf_series.iloc[0])
        fcf_values = fcf_series.values.astype(float)

        if len(fcf_values) >= 2:
            positive = fcf_values[fcf_values > 0]
            if len(positive) >= 2:
                n = len(positive) - 1
                hist_growth = (positive[-1] / positive[0]) ** (1 / n) - 1
            else:
                hist_growth = float(info.get('revenueGrowth') or 0.05)
            growth_rate = float(np.clip(hist_growth, -0.20, 0.30))
        else:
            growth_rate = float(info.get('revenueGrowth') or 0.05)

        projected_fcf = [base_fcf * (1 + growth_rate) ** i for i in range(1, years + 1)]
        pv_fcf = [fcf / (1 + wacc) ** i for i, fcf in enumerate(projected_fcf, 1)]

        terminal_value = projected_fcf[-1] * (1 + terminal_growth) / (wacc - terminal_growth)
        pv_terminal = terminal_value / (1 + wacc) ** years

        total_pv = sum(pv_fcf) + pv_terminal
        net_debt = float((info.get('totalDebt') or 0) - (info.get('totalCash') or 0))
        equity_value = total_pv - net_debt

        shares = info.get('sharesOutstanding') or info.get('impliedSharesOutstanding')
        intrinsic_value = (equity_value / shares) if shares else None

        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        margin_of_safety = None
        if intrinsic_value and current_price and intrinsic_value > 0:
            margin_of_safety = round((intrinsic_value - current_price) / intrinsic_value * 100, 2)

        return {
            'ticker': ticker.upper(),
            'assumptions': {
                'wacc': wacc,
                'terminal_growth_rate': terminal_growth,
                'fcf_growth_rate': round(growth_rate, 4),
                'projection_years': years,
            },
            'base_fcf': round(base_fcf, 0),
            'projected_fcf': [round(v, 0) for v in projected_fcf],
            'pv_fcf': [round(v, 0) for v in pv_fcf],
            'terminal_value': round(terminal_value, 0),
            'pv_terminal_value': round(pv_terminal, 0),
            'total_pv': round(total_pv, 0),
            'net_debt': round(net_debt, 0),
            'equity_value': round(equity_value, 0),
            'shares_outstanding': shares,
            'intrinsic_value_per_share': round(intrinsic_value, 2) if intrinsic_value else None,
            'current_price': current_price,
            'margin_of_safety_pct': margin_of_safety,
        }

    return get_cached('dcf', cache_key, FUNDAMENTAL_TTL, fetch)
