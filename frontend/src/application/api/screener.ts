import { apiFetch } from './client';

export type FieldType = 'range' | 'min' | 'max' | 'select';
export type FieldUnit = 'ratio' | 'percent' | 'currency' | 'plain';

export interface FieldOption {
  value: string;
  label: string;
}

export interface ScreenerField {
  key: string;
  label: string;
  category: string;
  yahoo: string;
  type: FieldType;
  unit: FieldUnit;
  scale: number;
  options?: FieldOption[];
}

export interface FieldsCatalog {
  categories: string[];
  fields: ScreenerField[];
  sortable: string[];
  max_size: number;
}

/** Valor de un filtro: select usa `value`; numéricos usan `min`/`max`. */
export interface FilterSpec {
  value?: string;
  min?: number;
  max?: number;
}

export interface ScreenRequest {
  filters: Record<string, FilterSpec>;
  sort?: string;
  sort_asc?: boolean;
  offset?: number;
  size?: number;
}

export interface ScreenRow {
  ticker: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  change_pct: number | null;
  market_cap: number | null;
  pe: number | null;
  forward_pe: number | null;
  pb: number | null;
  dividend_yield: number | null;
  change_52w: number | null;
  eps_ttm: number | null;
}

export interface ScreenResult {
  count: number;
  returned: number;
  offset: number;
  size: number;
  sort: string;
  sort_asc: boolean;
  rows: ScreenRow[];
}

export function getScreenerFields(): Promise<FieldsCatalog> {
  return apiFetch('/screener/fields/');
}

export function runScreen(body: ScreenRequest): Promise<ScreenResult> {
  return apiFetch('/screener/run/', { method: 'POST', body: JSON.stringify(body) });
}
