import { useState, useEffect, useCallback } from 'react';
import { Eye, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import {
  getWatchlists, createWatchlist, deleteWatchlist,
  getWatchlistItems, addToWatchlist, removeFromWatchlist,
  type WatchlistMeta, type WatchlistItem,
} from '@/application/api/watchlist';
import { PageHeader, Card } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtLarge(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

const inp: React.CSSProperties = {
  height: 36, padding: '0 10px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', width: '100%',
};
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

export function WatchlistPage() {
  const [lists, setLists] = useState<WatchlistMeta[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New watchlist form
  const [showNewWL, setShowNewWL] = useState(false);
  const [wlName, setWlName] = useState('');
  const [wlDesc, setWlDesc] = useState('');
  const [wlError, setWlError] = useState<string | null>(null);

  // New ticker form
  const [showAddTicker, setShowAddTicker] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newNote, setNewNote] = useState('');
  const [tickerError, setTickerError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const toast = useToast();
  const selected = lists.find(l => l.id === selectedId) ?? null;

  useEffect(() => {
    getWatchlists()
      .then(data => {
        setLists(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setError('Error cargando las listas.'))
      .finally(() => setLoadingLists(false));
  }, []);

  const loadItems = useCallback(async (id: number) => {
    setLoadingItems(true);
    setError(null);
    try {
      setItems(await getWatchlistItems(id));
    } catch {
      setError('Error cargando las cotizaciones.');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId != null) loadItems(selectedId);
    else setItems([]);
  }, [selectedId, loadItems]);

  const handleCreateWL = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlName.trim()) { setWlError('El nombre es obligatorio.'); return; }
    setWlError(null);
    try {
      const created = await createWatchlist(wlName.trim(), wlDesc.trim());
      setLists(prev => [...prev, created]);
      setSelectedId(created.id);
      setShowNewWL(false);
      setWlName(''); setWlDesc('');
      toast.success(`Lista "${created.name}" creada.`);
    } catch (e) {
      setWlError(e instanceof ApiError ? e.message : 'Error creando la lista.');
    }
  };

  const handleDeleteWL = async () => {
    if (!selected) return;
    if (!confirm(`¿Eliminar la lista "${selected.name}" y todos sus tickers?`)) return;
    try {
      await deleteWatchlist(selected.id);
      const rest = lists.filter(l => l.id !== selected.id);
      setLists(rest);
      setSelectedId(rest.length ? rest[0].id : null);
      toast.success(`Lista "${selected.name}" eliminada.`);
    } catch {
      toast.error('Error eliminando la lista.');
    }
  };

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId == null) return;
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) { setTickerError('Ingresá un ticker.'); return; }
    setAdding(true); setTickerError(null);
    try {
      await addToWatchlist(selectedId, ticker, newNote.trim());
      setNewTicker(''); setNewNote('');
      setShowAddTicker(false);
      await loadItems(selectedId);
      setLists(prev => prev.map(l => l.id === selectedId ? { ...l, item_count: l.item_count + 1 } : l));
      toast.success(`${ticker} agregado a la lista.`);
    } catch (e) {
      setTickerError(e instanceof ApiError ? e.message : 'Error agregando el ticker.');
    } finally { setAdding(false); }
  };

  const handleRemove = async (itemId: number, ticker: string) => {
    try {
      await removeFromWatchlist(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      setLists(prev => prev.map(l => l.id === selectedId ? { ...l, item_count: Math.max(0, l.item_count - 1) } : l));
      toast.info(`${ticker} quitado de la lista.`);
    } catch {
      toast.error('Error al quitar el ticker.');
    }
  };

  return (
    <>
      <PageHeader
        icon={<Eye size={22} />}
        title="Lista de Seguimiento"
        subtitle="Monitorea tickers con cotizaciones frescas, sin necesidad de invertir"
      />
      <div className="page-body">

        {/* ── Selector de lista ── */}
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--sp-5)' }}>
          {lists.length > 0 && (
            <div style={{ minWidth: 220 }}>
              <label style={lbl}>Lista</label>
              <select
                value={selectedId ?? ''}
                onChange={e => setSelectedId(Number(e.target.value))}
                style={{ ...inp, width: 'auto', minWidth: 220 }}
              >
                {lists.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.item_count} tickers)
                  </option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => setShowNewWL(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Nueva lista
          </button>
          {selected && (
            <>
              <button className="btn" onClick={() => selectedId && loadItems(selectedId)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={14} /> Actualizar precios
              </button>
              <button className="btn" onClick={handleDeleteWL} style={{ color: 'var(--negative)' }} title="Eliminar lista">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {selected?.description && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--sp-4)', marginTop: '-var(--sp-3)' }}>
            {selected.description}
          </p>
        )}

        {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>{error}</p>}

        {/* ── Form nueva lista ── */}
        {showNewWL && (
          <Card title="Nueva lista de seguimiento" style={{ marginBottom: 'var(--sp-5)' }}>
            <form onSubmit={handleCreateWL}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <div>
                  <label style={lbl}>Nombre *</label>
                  <input style={inp} placeholder="Ej: Value picks" value={wlName} onChange={e => setWlName(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Descripción (opcional)</label>
                  <input style={inp} placeholder="Acciones que sigo para posible entrada..." value={wlDesc} onChange={e => setWlDesc(e.target.value)} />
                </div>
              </div>
              {wlError && <p style={{ color: 'var(--negative)', fontSize: 12, marginBottom: 8 }}>{wlError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit">Crear lista</button>
                <button className="btn" type="button" onClick={() => { setShowNewWL(false); setWlError(null); }}>Cancelar</button>
              </div>
            </form>
          </Card>
        )}

        {/* ── Contenido de la lista seleccionada ── */}
        {loadingLists ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando…</p>
        ) : lists.length === 0 && !showNewWL ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
            <Eye size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No tenés listas de seguimiento.</p>
            <p style={{ fontSize: 12, marginTop: 4, marginBottom: 16 }}>Creá una para empezar a monitorear tickers.</p>
            <button className="btn btn-primary" onClick={() => setShowNewWL(true)}>
              <Plus size={14} /> Nueva lista
            </button>
          </div>
        ) : selected && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {items.length} {items.length === 1 ? 'ticker' : 'tickers'} en esta lista
              </span>
              <button className="btn btn-primary" onClick={() => setShowAddTicker(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Agregar ticker
              </button>
            </div>

            {showAddTicker && (
              <Card title="Agregar ticker" style={{ marginBottom: 'var(--sp-4)' }}>
                <form onSubmit={handleAddTicker}>
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--sp-3)' }}>
                    <div style={{ width: 120 }}>
                      <label style={lbl}>Ticker</label>
                      <input style={inp} placeholder="AAPL" value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())} />
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <label style={lbl}>Nota (opcional)</label>
                      <input style={inp} placeholder="¿Por qué la seguís?" value={newNote} onChange={e => setNewNote(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={adding}>{adding ? 'Agregando…' : 'Agregar'}</button>
                    <button className="btn" type="button" onClick={() => { setShowAddTicker(false); setTickerError(null); }}>Cancelar</button>
                  </div>
                  {tickerError && <p style={{ color: 'var(--negative)', fontSize: 12 }}>{tickerError}</p>}
                </form>
              </Card>
            )}

            {loadingItems ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando cotizaciones…</p>
            ) : items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--text-muted)', fontSize: 13 }}>
                Lista vacía. Agregá tickers con el botón de arriba.
              </div>
            ) : (
              <Card style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px' }}>Activo</th>
                      <th style={{ padding: '8px 12px' }}>Precio</th>
                      <th style={{ padding: '8px 12px' }}>Cambio hoy</th>
                      <th style={{ padding: '8px 12px' }}>Mín / Máx día</th>
                      <th style={{ padding: '8px 12px' }}>52w Low / High</th>
                      <th style={{ padding: '8px 12px' }}>Market Cap</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px' }}>Nota</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const up = item.change != null && item.change >= 0;
                      const hasChange = item.change != null;
                      return (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                          <td style={{ textAlign: 'left', padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{item.ticker}</div>
                            {item.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                            {item.price != null ? `${fmt(item.price)} ${item.currency ?? ''}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', color: !hasChange ? 'var(--text-muted)' : up ? 'var(--positive)' : 'var(--negative)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              {hasChange && (up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                              {hasChange ? `${up ? '+' : ''}${fmt(item.change)} (${up ? '+' : ''}${fmt(item.change_pct)}%)` : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {fmt(item.day_low)} / {fmt(item.day_high)}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {fmt(item.week_52_low)} / {fmt(item.week_52_high)}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)' }}>{fmtLarge(item.market_cap)}</td>
                          <td style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', maxWidth: 160, fontSize: 12 }}>{item.note || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => handleRemove(item.id, item.ticker)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 4 }} title="Quitar">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
