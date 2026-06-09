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

export interface DcfResult {
  ticker: string;
  assumptions: { wacc: number; terminal_growth_rate: number; fcf_growth_rate: number; projection_years: number };
  base_fcf: number;
  projected_fcf: number[];
  pv_fcf: number[];
  terminal_value: number;
  pv_terminal_value: number;
  total_pv: number;
  net_debt: number;
  equity_value: number;
  shares_outstanding: number | null;
  intrinsic_value_per_share: number | null;
  current_price: number | null;
  margin_of_safety_pct: number | null;
}

export function getDcf(ticker: string, params: DcfParams = {}): Promise<DcfResult> {
  const qs = new URLSearchParams();
  if (params.wacc !== undefined) qs.set('wacc', String(params.wacc));
  if (params.terminal_growth !== undefined) qs.set('terminal_growth', String(params.terminal_growth));
  if (params.years !== undefined) qs.set('years', String(params.years));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/fundamental/${encodeURIComponent(ticker.toUpperCase())}/dcf/${query}`);
}
