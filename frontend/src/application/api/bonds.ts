import { apiFetch } from './client';

export interface BondPriceResult {
  price: number;
  face_value: number;
  coupon_rate: number;
  coupon_payment: number;
  periods: number;
  frequency: number;
  ytm: number;
  cash_flows: { period: number; cash_flow: number; present_value: number }[];
}

export interface BondYtmResult {
  market_price: number;
  face: number;
  ytm_annual: number;
  ytm_periodic: number;
  frequency: number;
  coupon_rate: number;
  periods: number;
}

export interface BondDurationResult {
  price: number;
  macaulay_duration: number;
  modified_duration: number;
  convexity: number;
  dv01: number;
  ytm: number;
  frequency: number;
}

export function getBondPrice(payload: {
  face: number; coupon_rate: number; periods: number; frequency: number; ytm: number;
}): Promise<BondPriceResult> {
  return apiFetch('/bonds/price/', { method: 'POST', body: JSON.stringify(payload) });
}

export function getBondYtm(payload: {
  market_price: number; face: number; coupon_rate: number; periods: number; frequency: number;
}): Promise<BondYtmResult> {
  return apiFetch('/bonds/ytm/', { method: 'POST', body: JSON.stringify(payload) });
}

export function getBondDuration(payload: {
  face: number; coupon_rate: number; periods: number; frequency: number; ytm: number;
}): Promise<BondDurationResult> {
  return apiFetch('/bonds/duration/', { method: 'POST', body: JSON.stringify(payload) });
}
