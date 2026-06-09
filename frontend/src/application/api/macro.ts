import { apiFetch } from './client';

export type VixSignal = 'complacency' | 'low_fear' | 'elevated' | 'high_fear' | 'extreme_fear';
export type MarketRegime = 'bull' | 'bear' | 'uncertain';
export type DcaMacroFilter = 'favorable' | 'neutral' | 'caution';

export interface SectorData {
  etf: string;
  price: number;
  return_1m: number;
  return_3m: number;
}

export interface MarketRegimeData {
  regime: MarketRegime;
  regime_label: string;
  dca_macro_filter: DcaMacroFilter;
  sp500: {
    price: number;
    sma_50: number;
    sma_200: number;
    above_sma200: boolean;
    return_ytd: number;
    return_1m: number;
  };
  vix: {
    current: number;
    avg_52w: number;
    median_52w: number;
    signal: VixSignal;
    vs_avg_pct: number;
  };
  sectors: Record<string, SectorData>;
}

export interface RelativeStrengthData {
  ticker: string;
  benchmark: string;
  period: string;
  ticker_return_pct: number;
  benchmark_return_pct: number;
  alpha_pct: number;
  outperforming: boolean;
  rs_ratio: number;
}

export function getMarketRegime(): Promise<MarketRegimeData> {
  return apiFetch('/macro/regime/');
}

export function getRelativeStrength(
  ticker: string,
  benchmark = '%5EGSPC',
  period = '6mo',
): Promise<RelativeStrengthData> {
  return apiFetch(
    `/macro/rs/${encodeURIComponent(ticker.toUpperCase())}/?benchmark=${benchmark}&period=${period}`,
  );
}
