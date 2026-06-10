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

// ─── Simulación Monte Carlo ──────────────────────────────────────────────────

export type MonteCarloMethod = 'bootstrap' | 'normal';

export interface MonteCarloPoint {
  month: number;
  invested: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface MonteCarloResult {
  method: MonteCarloMethod;
  years: number;
  months: number;
  n_sims: number;
  initial_investment: number;
  monthly_contribution: number;
  invested_total: number;
  weights: Record<string, number>;
  historical: { annual_return_pct: number; annual_volatility_pct: number };
  timeline: MonteCarloPoint[];
  final: {
    mean: number;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
    prob_loss_pct: number;
    median_multiple: number | null;
    target_value?: number;
    prob_target_pct?: number;
  };
}

export function simulateMonteCarlo(params: {
  tickers: string[];
  weights: number[];
  initial_investment: number;
  monthly_contribution: number;
  years: number;
  n_sims?: number;
  target_value?: number | null;
  method?: MonteCarloMethod;
}): Promise<MonteCarloResult> {
  return apiFetch('/portfolio/montecarlo/', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ─── Seguimiento de tenencias reales ─────────────────────────────────────────

export type TxnSide = 'BUY' | 'SELL';

export interface Portfolio {
  id: number;
  name: string;
  category: string;
  base_currency: string;
  transaction_count: number;
  created_at: string;
}

export interface Transaction {
  id: number;
  ticker: string;
  side: TxnSide;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  trade_date: string;
  note: string;
  created_at: string;
}

export interface Position {
  ticker: string;
  name: string | null;
  quantity: number;
  avg_cost: number;
  currency: string;
  current_price: number | null;
  price_available: boolean;
  invested_native: number;
  market_value_native: number;
  unrealized_native: number;
  unrealized_pct: number;
  distance_to_entry_pct: number | null;
  dca_opportunity: boolean;
  realized_native: number;
  fx_rate: number;
  invested_base: number;
  market_value_base: number;
  unrealized_base: number;
  weight_pct: number;
}

export interface PortfolioSummary {
  portfolio: { id: number; name: string; category: string; base_currency: string };
  positions: Position[];
  totals: {
    base_currency: string;
    invested: number;
    market_value: number;
    unrealized: number;
    unrealized_pct: number;
    realized: number;
    fx_warning: boolean;
  };
}

export function getPortfolios(): Promise<Portfolio[]> {
  return apiFetch('/portfolio/portfolios/');
}

export function createPortfolio(data: {
  name: string;
  category?: string;
  base_currency?: string;
}): Promise<Portfolio> {
  return apiFetch('/portfolio/portfolios/', { method: 'POST', body: JSON.stringify(data) });
}

export function updatePortfolio(
  id: number,
  data: Partial<Pick<Portfolio, 'name' | 'category' | 'base_currency'>>,
): Promise<Portfolio> {
  return apiFetch(`/portfolio/portfolios/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deletePortfolio(id: number): Promise<void> {
  return apiFetch(`/portfolio/portfolios/${id}/`, { method: 'DELETE' });
}

export function getTransactions(portfolioId: number): Promise<Transaction[]> {
  return apiFetch(`/portfolio/portfolios/${portfolioId}/transactions/`);
}

export function createTransaction(
  portfolioId: number,
  data: {
    ticker: string;
    side: TxnSide;
    quantity: number;
    price: number;
    fees?: number;
    currency?: string;
    trade_date: string;
    note?: string;
  },
): Promise<Transaction> {
  return apiFetch(`/portfolio/portfolios/${portfolioId}/transactions/`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id: number): Promise<void> {
  return apiFetch(`/portfolio/transactions/${id}/`, { method: 'DELETE' });
}

export function getPortfolioSummary(portfolioId: number): Promise<PortfolioSummary> {
  return apiFetch(`/portfolio/portfolios/${portfolioId}/summary/`);
}

export function getHoldingTickers(portfolioIds?: number[]): Promise<{ tickers: string[] }> {
  const q = portfolioIds?.length ? `?portfolios=${portfolioIds.join(',')}` : '';
  return apiFetch(`/portfolio/tickers/${q}`);
}
