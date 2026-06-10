import { apiFetch } from './client';

export type ScanSource = 'custom' | 'universe' | 'watchlist' | 'portfolio';

export type Verdict = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'REDUCE' | 'STRONG_REDUCE';
export type DcaSignal = 'ACCUMULATE' | 'NORMAL' | 'PAUSE';

export interface UniverseMeta {
  key: string;
  label: string;
  description: string;
  count: number;
}

export interface ScanRow {
  ticker: string;
  name: string | null;
  currency: string | null;
  price: number | null;
  change_pct: number | null;
  score: number;
  verdict: Verdict;
  dca_signal: DcaSignal;
  trend_score: number | null;
  momentum_score: number | null;
  valuation_score: number | null;
  volatility_score: number | null;
  rsi_14: number | null;
  drawdown_from_ath: number | null;
  z_score_200: number | null;
  /** Solo presentes cuando la fuente es "portfolio". */
  avg_cost?: number | null;
  vs_avg_cost_pct?: number | null;
}

export interface ScanResult {
  count: number;
  truncated: boolean;
  max_tickers: number;
  source: ScanSource;
  results: ScanRow[];
  failed: { ticker: string; error: string }[];
}

export interface ScanRequest {
  source: ScanSource;
  tickers?: string[];
  universe?: string;
  watchlists?: number[];
  portfolios?: number[];
}

export function getUniverses(): Promise<UniverseMeta[]> {
  return apiFetch('/scanner/universes/');
}

export function runScan(body: ScanRequest): Promise<ScanResult> {
  return apiFetch('/scanner/scan/', { method: 'POST', body: JSON.stringify(body) });
}
