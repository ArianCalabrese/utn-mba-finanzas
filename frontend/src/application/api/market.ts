import { apiFetch } from './client';

export type Period = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max';
export type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo';

export interface Quote {
  ticker: string;
  name: string | null;
  price: number | null;
  previous_close: number | null;
  open: number | null;
  day_low: number | null;
  day_high: number | null;
  week_52_low: number | null;
  week_52_high: number | null;
  volume: number | null;
  avg_volume: number | null;
  market_cap: number | null;
  beta: number | null;
  currency: string | null;
  exchange: string | null;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function getQuote(ticker: string): Promise<Quote> {
  return apiFetch(`/market/quote/${encodeURIComponent(ticker.toUpperCase())}/`);
}

export function getHistory(
  ticker: string,
  period: Period = '1y',
  interval: Interval = '1d',
): Promise<OHLCVBar[]> {
  return apiFetch(
    `/market/history/${encodeURIComponent(ticker.toUpperCase())}/?period=${period}&interval=${interval}`,
  );
}

export function getCompare(
  tickers: string[],
  period: Period = '1y',
): Promise<Record<string, { date: string; value: number }[]>> {
  return apiFetch(
    `/market/compare/?tickers=${tickers.map(t => t.toUpperCase()).join(',')}&period=${period}`,
  );
}
