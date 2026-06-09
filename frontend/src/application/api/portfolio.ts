import { apiFetch } from './client';

export interface OptimizeResult {
  tickers: string[];
  risk_free_rate: number;
  max_sharpe: PortfolioStats;
  min_variance: PortfolioStats;
  efficient_frontier: { expected_return: number; volatility: number }[];
}

export interface PortfolioStats {
  weights: Record<string, number>;
  expected_annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
}

export function optimizePortfolio(
  tickers: string[],
  risk_free_rate = 0.05,
): Promise<OptimizeResult> {
  return apiFetch('/portfolio/optimize/', {
    method: 'POST',
    body: JSON.stringify({ tickers, risk_free_rate }),
  });
}

export function computeVaR(
  tickers: string[],
  weights: number[],
  portfolio_value = 100_000,
): Promise<Record<string, unknown>> {
  return apiFetch('/portfolio/var/', {
    method: 'POST',
    body: JSON.stringify({ tickers, weights, portfolio_value }),
  });
}

export function computeCorrelation(
  tickers: string[],
  benchmark = 'SPY',
): Promise<{ correlation_matrix: Record<string, Record<string, number>>; beta_vs_benchmark: Record<string, number>; benchmark: string }> {
  return apiFetch('/portfolio/correlation/', {
    method: 'POST',
    body: JSON.stringify({ tickers, benchmark }),
  });
}

export interface BacktestResult {
  weights: Record<string, number>;
  total_return_pct: number;
  annual_return_pct: number;
  annual_volatility_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number | null;
  equity_curve: { date: string; value: number }[];
}

export function backtestPortfolio(
  tickers: string[],
  weights: number[],
  period = '1y',
): Promise<BacktestResult> {
  return apiFetch('/portfolio/backtest/', {
    method: 'POST',
    body: JSON.stringify({ tickers, weights, period }),
  });
}
