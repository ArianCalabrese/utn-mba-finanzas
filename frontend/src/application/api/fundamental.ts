import { apiFetch } from './client';

export function getRatios(ticker: string): Promise<Record<string, unknown>> {
  return apiFetch(`/fundamental/${encodeURIComponent(ticker.toUpperCase())}/ratios/`);
}

export function getStatements(ticker: string): Promise<Record<string, unknown>> {
  return apiFetch(`/fundamental/${encodeURIComponent(ticker.toUpperCase())}/statements/`);
}

export function getDividends(ticker: string): Promise<Record<string, unknown>> {
  return apiFetch(`/fundamental/${encodeURIComponent(ticker.toUpperCase())}/dividends/`);
}

export interface DcfParams {
  wacc?: number;
  terminal_growth?: number;
  years?: number;
}

export interface WaccBreakdown {
  method: 'capm' | 'user';
  risk_free_rate?: number;
  beta?: number;
  equity_risk_premium?: number;
  cost_of_equity?: number;
  cost_of_debt_after_tax?: number;
  tax_rate?: number;
  weight_equity?: number;
  weight_debt?: number;
}

export interface MonteCarloDcf {
  runs: number;
  intrinsic_value_per_share: { p10: number; bear: number; median: number; bull: number; p90: number };
  prob_undervalued_pct?: number;
}

export interface DcfResult {
  ticker: string;
  applicable: boolean;
  reason?: string;
  assumptions: { wacc: number; terminal_growth_rate: number; fcf_growth_rate: number; projection_years: number };
  wacc_breakdown?: WaccBreakdown;
  base_fcf: number;
  base_fcf_method?: 'normalized_fcf_margin' | 'median_fcf';
  latest_fcf?: number;
  fcf_margin_used?: number | null;
  growth_source?: 'revenue_cagr' | 'revenue_growth_ttm';
  growth_path?: number[];
  projected_fcf?: number[];
  pv_fcf?: number[];
  terminal_value: number;
  pv_terminal_value: number;
  terminal_value_weight_pct?: number | null;
  total_pv: number;
  net_debt: number;
  equity_value: number;
  shares_outstanding: number | null;
  intrinsic_value_per_share: number | null;
  current_price: number | null;
  margin_of_safety_pct: number | null;
  monte_carlo?: MonteCarloDcf | null;
}

export function getDcf(ticker: string, params: DcfParams = {}): Promise<DcfResult> {
  const qs = new URLSearchParams();
  if (params.wacc !== undefined) qs.set('wacc', String(params.wacc));
  if (params.terminal_growth !== undefined) qs.set('terminal_growth', String(params.terminal_growth));
  if (params.years !== undefined) qs.set('years', String(params.years));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/fundamental/${encodeURIComponent(ticker.toUpperCase())}/dcf/${query}`);
}
