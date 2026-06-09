import { apiFetch } from './client';

export interface TechnicalIndicators {
  ticker: string;
  current_price: number | null;
  rsi_14: number | null;
  macd: { macd: number | null; signal: number | null; histogram: number | null };
  bollinger_bands: { upper: number | null; mid: number | null; lower: number | null; bandwidth_pct: number | null };
  moving_averages: {
    sma_20: number | null; sma_50: number | null; sma_200: number | null;
    ema_12: number | null; ema_26: number | null;
  };
  atr_14: number | null;
  stochastic: { k: number | null; d: number | null };
}

export type SignalValue = 'bullish' | 'bearish' | 'neutral' | 'oversold' | 'overbought';

export interface TechnicalSignals {
  ticker: string;
  signals: {
    rsi?: { value: number; signal: SignalValue };
    macd?: { value: number; histogram: number; signal: SignalValue };
    moving_averages?: { above_sma_200: boolean; golden_cross: boolean; signal: SignalValue };
    bollinger?: { bandwidth_pct: number | null; signal: SignalValue };
    stochastic?: { k: number; d: number | null; signal: SignalValue };
    summary: { bullish_signals: number; bearish_signals: number; overall: SignalValue };
  };
}

export function getIndicators(ticker: string): Promise<TechnicalIndicators> {
  return apiFetch(`/technical/${encodeURIComponent(ticker.toUpperCase())}/indicators/`);
}

export function getSignals(ticker: string): Promise<TechnicalSignals> {
  return apiFetch(`/technical/${encodeURIComponent(ticker.toUpperCase())}/signals/`);
}
