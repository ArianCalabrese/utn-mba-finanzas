import { apiFetch } from './client';

export interface WatchlistMeta {
  id: number;
  name: string;
  description: string;
  item_count: number;
  created_at: string;
}

export interface WatchlistItem {
  id: number;
  ticker: string;
  note: string;
  added_at: string;
  name: string | null;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_pct: number | null;
  day_low: number | null;
  day_high: number | null;
  week_52_low: number | null;
  week_52_high: number | null;
  volume: number | null;
  market_cap: number | null;
  currency: string | null;
}

// ─── Watchlists ──────────────────────────────────────────────────────────────

export function getWatchlists(): Promise<WatchlistMeta[]> {
  return apiFetch('/watchlist/');
}

export function createWatchlist(name: string, description = ''): Promise<WatchlistMeta> {
  return apiFetch('/watchlist/', { method: 'POST', body: JSON.stringify({ name, description }) });
}

export function deleteWatchlist(id: number): Promise<void> {
  return apiFetch(`/watchlist/${id}/`, { method: 'DELETE' });
}

// ─── Items ───────────────────────────────────────────────────────────────────

export function getWatchlistItems(watchlistId: number): Promise<WatchlistItem[]> {
  return apiFetch(`/watchlist/${watchlistId}/items/`);
}

export function addToWatchlist(watchlistId: number, ticker: string, note = ''): Promise<{ id: number; ticker: string; note: string }> {
  return apiFetch(`/watchlist/${watchlistId}/items/`, { method: 'POST', body: JSON.stringify({ ticker, note }) });
}

export function removeFromWatchlist(itemId: number): Promise<void> {
  return apiFetch(`/watchlist/items/${itemId}/`, { method: 'DELETE' });
}

// ─── Para el optimizador ─────────────────────────────────────────────────────

export function getWatchlistTickers(watchlistIds?: number[]): Promise<{ tickers: string[] }> {
  const q = watchlistIds?.length ? `?watchlists=${watchlistIds.join(',')}` : '';
  return apiFetch(`/watchlist/tickers/${q}`);
}
