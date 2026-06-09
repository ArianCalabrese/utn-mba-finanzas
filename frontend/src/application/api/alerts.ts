import { apiFetch } from './client';

export type AlertOperator = 'AND' | 'OR';
export type ConditionOperator = '<' | '>' | '<=' | '>=' | '==';

export const INDICATOR_PATHS: { value: string; label: string }[] = [
  { value: 'rsi_14', label: 'RSI (14)' },
  { value: 'z_score_200', label: 'Z-Score vs SMA200' },
  { value: 'drawdown_from_ath', label: 'Drawdown desde ATH (%)' },
  { value: 'current_price', label: 'Precio actual' },
  { value: 'macd.histogram', label: 'MACD Histograma' },
  { value: 'macd.macd', label: 'MACD Línea' },
  { value: 'bollinger_bands.bandwidth_pct', label: 'Bollinger Bandwidth (%)' },
  { value: 'stochastic.k', label: 'Estocástico %K' },
  { value: 'stochastic.d', label: 'Estocástico %D' },
  { value: 'adx_14.adx', label: 'ADX (14)' },
  { value: 'adx_14.plus_di', label: '+DI (14)' },
  { value: 'adx_14.minus_di', label: '-DI (14)' },
  { value: 'moving_averages.sma_50', label: 'SMA 50' },
  { value: 'moving_averages.sma_200', label: 'SMA 200' },
  { value: 'conviction.score', label: 'Conviction Score (0-100)' },
];

export const ALERT_TEMPLATES = [
  {
    name: 'Zona DCA',
    description: 'RSI < 40 y caída > 15% desde ATH',
    conditions: [
      { path: 'rsi_14', operator: '<' as ConditionOperator, value: 40 },
      { path: 'drawdown_from_ath', operator: '<' as ConditionOperator, value: -15 },
    ],
    operator: 'AND' as AlertOperator,
  },
  {
    name: 'Pánico — Compra Agresiva',
    description: 'RSI extremo y caída severa desde ATH',
    conditions: [
      { path: 'rsi_14', operator: '<' as ConditionOperator, value: 30 },
      { path: 'drawdown_from_ath', operator: '<' as ConditionOperator, value: -30 },
    ],
    operator: 'AND' as AlertOperator,
  },
  {
    name: 'Sobrecomprado — Pausa DCA',
    description: 'RSI elevado y baja volatilidad',
    conditions: [
      { path: 'rsi_14', operator: '>' as ConditionOperator, value: 72 },
      { path: 'stochastic.k', operator: '>' as ConditionOperator, value: 80 },
    ],
    operator: 'AND' as AlertOperator,
  },
  {
    name: 'Alta Convicción',
    description: 'Conviction Score elevado',
    conditions: [
      { path: 'conviction.score', operator: '>' as ConditionOperator, value: 65 },
    ],
    operator: 'AND' as AlertOperator,
  },
];

export interface AlertCondition {
  path: string;
  operator: ConditionOperator;
  value: number;
}

export interface Alert {
  id: number;
  ticker: string;
  name: string;
  conditions: AlertCondition[];
  operator: AlertOperator;
  is_active: boolean;
  last_checked: string | null;
  last_triggered: string | null;
  triggered_count: number;
  created_at: string;
}

export interface AlertCheckResult {
  alert_id: number;
  ticker: string;
  name: string;
  triggered: boolean;
  missing_data: boolean;
  results: { condition: AlertCondition; result: boolean | null }[];
}

export function getAlerts(): Promise<Alert[]> {
  return apiFetch('/alerts/');
}

export function createAlert(data: {
  ticker: string;
  name: string;
  conditions: AlertCondition[];
  operator: AlertOperator;
}): Promise<Alert> {
  return apiFetch('/alerts/', { method: 'POST', body: JSON.stringify(data) });
}

export function toggleAlert(id: number, is_active: boolean): Promise<Alert> {
  return apiFetch(`/alerts/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
}

export function deleteAlert(id: number): Promise<void> {
  return apiFetch(`/alerts/${id}/`, { method: 'DELETE' });
}

export function checkAlert(id: number): Promise<AlertCheckResult> {
  return apiFetch(`/alerts/${id}/check/`);
}
