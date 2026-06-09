import { apiFetch } from './client';

export interface TechnicalIndicators {
  ticker: string;
  current_price: number | null;
  rsi_14: number | null;
  macd: { macd: number | null; signal: number | null; histogram: number | null };
  bollinger_bands: {
    upper: number | null; mid: number | null; lower: number | null;
    bandwidth_pct: number | null; squeeze: boolean;
  };
  moving_averages: {
    sma_20: number | null; sma_50: number | null; sma_200: number | null;
    ema_12: number | null; ema_26: number | null;
  };
  atr_14: number | null;
  stochastic: { k: number | null; d: number | null };
  adx_14: { adx: number | null; plus_di: number | null; minus_di: number | null; trend_strength: 'strong' | 'weak' };
  obv: number | null;
  z_score_200: number | null;
  drawdown_from_ath: number | null;
}

export type SignalValue =
  | 'bullish' | 'bearish' | 'neutral' | 'oversold' | 'overbought'
  | 'strong_trend' | 'weak_trend' | 'deep_oversold';

export interface TechnicalSignals {
  ticker: string;
  signals: {
    rsi?: { value: number; signal: SignalValue };
    macd?: { value: number; histogram: number; signal: SignalValue };
    moving_averages?: { above_sma_200: boolean; golden_cross: boolean; signal: SignalValue };
    bollinger?: { bandwidth_pct: number | null; squeeze: boolean; signal: SignalValue };
    stochastic?: { k: number; d: number | null; signal: SignalValue };
    adx?: { value: number; plus_di: number | null; minus_di: number | null; signal: SignalValue };
    z_score?: { value: number; signal: SignalValue };
    summary: { bullish_signals: number; bearish_signals: number; overall: SignalValue };
  };
}

export interface ConvictionLayerSignal {
  name: string;
  signal: string;
  value?: number;
  note?: string;
}

export interface ConvictionLayer {
  score: number | null;
  weight: number;
  signals: ConvictionLayerSignal[];
  available?: boolean;
}

export interface ConvictionResult {
  ticker: string;
  conviction: {
    score: number;
    verdict: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'REDUCE' | 'STRONG_REDUCE';
    dca_signal: 'ACCUMULATE' | 'NORMAL' | 'PAUSE';
    layers: {
      trend: ConvictionLayer;
      momentum: ConvictionLayer;
      valuation: ConvictionLayer;
      volatility: ConvictionLayer;
    };
  };
}

export function getIndicators(ticker: string): Promise<TechnicalIndicators> {
  return apiFetch(`/technical/${encodeURIComponent(ticker.toUpperCase())}/indicators/`);
}

export function getSignals(ticker: string): Promise<TechnicalSignals> {
  return apiFetch(`/technical/${encodeURIComponent(ticker.toUpperCase())}/signals/`);
}

export function getConviction(ticker: string): Promise<ConvictionResult> {
  return apiFetch(`/technical/${encodeURIComponent(ticker.toUpperCase())}/conviction/`);
}
