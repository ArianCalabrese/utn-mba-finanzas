import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Trash2, RefreshCw, TrendingDown } from 'lucide-react';
import {
  getPortfolios, createPortfolio, deletePortfolio,
  getTransactions, createTransaction, deleteTransaction,
  getPortfolioSummary,
  type Portfolio, type Transaction, type PortfolioSummary, type TxnSide,
} from '@/application/api/portfolio';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';

const CURRENCIES = ['USD', 'ARS', 'EUR', 'BRL', 'GBP', 'MXN', 'CLP'];

function money(value: number, currency: string, decimals = 2): string {
  if (!isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${value.toFixed(decimals)} ${currency}`;
  }
}

const inputStyle: React.CSSProperties = {
  height: 36, padding: '0 10px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', width: '100%',
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyTxn = () => ({
  ticker: '', side: 'BUY' as TxnSide, quantity: '', price: '',
  fees: '0', currency: 'USD', trade_date: today(), note: '',
});

export function MyPortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-portfolio form
  const [showNewPf, setShowNewPf] = useState(false);
  const [pfName, setPfName] = useState('');
  const [pfCategory, setPfCategory] = useState('');
  const [pfCurrency, setPfCurrency] = useState('USD');

  // New-transaction form
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txn, setTxn] = useState(emptyTxn());
  const [txnError, setTxnError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTxns, setShowTxns] = useState(false);

  const selected = portfolios.find(p => p.id === selectedId) ?? null;

  useEffect(() => {
    getPortfolios()
      .then(pf => {
        setPortfolios(pf);
        if (pf.length > 0) setSelectedId(pf[0].id);
      })
      .catch(() => setError('Error cargando carteras.'))
      .finally(() => setLoading(false));
  }, []);

  const loadSummary = useCallback(async (id: number) => {
    setSummaryLoading(true);
    try {
      const [s, txns] = await Promise.all([getPortfolioSummary(id), getTransactions(id)]);
      setSummary(s);
      setTransactions(txns);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error cargando el resumen.');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId != null) loadSummary(selectedId);
    else { setSummary(null); setTransactions([]); }
  }, [selectedId, loadSummary]);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfName.trim()) return;
    try {
      const created = await createPortfolio({ name: pfName.trim(), category: pfCategory.trim(), base_currency: pfCurrency });
      setPortfolios(prev => [...prev, created]);
      setSelectedId(created.id);
      setShowNewPf(false);
      setPfName(''); setPfCategory(''); setPfCurrency('USD');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error creando la cartera.');
    }
  };

  const handleDeletePortfolio = async () => {
    if (!selected) return;
    if (!confirm(`¿Eliminar la cartera "${selected.name}" y todos sus movimientos?`)) return;
    try {
      await deletePortfolio(selected.id);
      const rest = portfolios.filter(p => p.id !== selected.id);
      setPortfolios(rest);
      setSelectedId(rest.length ? rest[0].id : null);
    } catch {
      setError('Error eliminando la cartera.');
    }
  };

  const handleCreateTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId == null) return;
    const quantity = parseFloat(txn.quantity);
    const price = parseFloat(txn.price);
    if (!txn.ticker.trim() || !(quantity > 0) || !(price >= 0)) {
      setTxnError('Completá ticker, cantidad (> 0) y precio.');
      return;
    }
    setSaving(true);
    setTxnError(null);
    try {
      await createTransaction(selectedId, {
        ticker: txn.ticker.toUpperCase().trim(),
        side: txn.side,
        quantity,
        price,
        fees: parseFloat(txn.fees) || 0,
        currency: txn.currency,
        trade_date: txn.trade_date,
        note: txn.note.trim(),
      });
      setTxn(emptyTxn());
      setShowTxnForm(false);
      await loadSummary(selectedId);
      setPortfolios(prev => prev.map(p => p.id === selectedId ? { ...p, transaction_count: p.transaction_count + 1 } : p));
    } catch (e) {
      setTxnError(e instanceof ApiError ? e.message : 'Error guardando el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTxn = async (id: number) => {
    if (selectedId == null) return;
    try {
      await deleteTransaction(id);
      await loadSummary(selectedId);
    } catch { /* noop */ }
  };

  const base = summary?.totals.base_currency ?? selected?.base_currency ?? 'USD';
  const totals = summary?.totals;

  return (
    <>
      <PageHeader
        icon={<Briefcase size={22} />}
        title="Mi Portafolio"
        subtitle="Seguí tus tenencias reales y tu P&L según tu precio de entrada"
      />
      <div className="page-body">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando…</p>
        ) : portfolios.length === 0 && !showNewPf ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
            <Briefcase size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>Todavía no tenés carteras.</p>
            <p style={{ fontSize: 12, marginTop: 4, marginBottom: 16 }}>Creá una para empezar a cargar tus compras.</p>
            <button className="btn btn-primary" onClick={() => setShowNewPf(true)}>
              <Plus size={14} /> Nueva cartera
            </button>
          </div>
        ) : (
          <>
            {/* Selector de cartera + acciones */}
            <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 'var(--sp-5)' }}>
              <div style={{ minWidth: 220 }}>
                <label style={labelStyle}>Cartera</label>
                <select
                  value={selectedId ?? ''}
                  onChange={e => setSelectedId(Number(e.target.value))}
                  style={{ ...inputStyle, width: 'auto', minWidth: 220 }}
                >
                  {portfolios.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.category ? ` · ${p.category}` : ''} ({p.base_currency})
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => setShowNewPf(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Nueva cartera
              </button>
              {selected && (
                <>
                  <button className="btn" onClick={() => selectedId && loadSummary(selectedId)} title="Actualizar precios" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} /> Actualizar
                  </button>
                  <button className="btn" onClick={handleDeletePortfolio} title="Eliminar cartera" style={{ color: 'var(--negative)' }}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>

            {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>{error}</p>}

            {/* Form nueva cartera */}
            {showNewPf && (
              <Card title="Nueva cartera" style={{ marginBottom: 'var(--sp-5)' }}>
                <form onSubmit={handleCreatePortfolio}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                    <div>
                      <label style={labelStyle}>Nombre</label>
                      <input style={inputStyle} placeholder="Largo plazo" value={pfName} onChange={e => setPfName(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Categoría / sector (opcional)</label>
                      <input style={inputStyle} placeholder="Tech, Bancos…" value={pfCategory} onChange={e => setPfCategory(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Moneda base</label>
                      <select style={inputStyle} value={pfCurrency} onChange={e => setPfCurrency(e.target.value)}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" type="submit">Crear cartera</button>
                    <button className="btn" type="button" onClick={() => setShowNewPf(false)}>Cancelar</button>
                  </div>
                </form>
              </Card>
            )}

            {selected && (
              <>
                {/* Totales */}
                <div className="metrics-grid" style={{ marginBottom: 'var(--sp-5)' }}>
                  <Metric label={`Invertido (${base})`} value={totals ? money(totals.invested, base) : '—'} />
                  <Metric label={`Valor de mercado (${base})`} value={totals ? money(totals.market_value, base) : '—'} variant="accent" />
                  <Metric
                    label="P&L no realizado"
                    value={totals ? `${money(totals.unrealized, base)} (${totals.unrealized_pct >= 0 ? '+' : ''}${totals.unrealized_pct}%)` : '—'}
                    variant={totals && totals.unrealized >= 0 ? 'positive' : 'negative'}
                  />
                  <Metric
                    label="P&L realizado"
                    value={totals ? money(totals.realized, base) : '—'}
                    variant={totals && totals.realized >= 0 ? 'positive' : 'negative'}
                  />
                </div>

                {totals?.fx_warning && (
                  <p style={{ fontSize: 12, color: 'var(--warning, #d97706)', marginBottom: 'var(--sp-4)' }}>
                    ⚠ No se pudo obtener el tipo de cambio de algún activo; esos montos se consolidan sin conversión.
                  </p>
                )}

                {/* Acción para cargar movimiento */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {summary?.positions.length ?? 0} {summary?.positions.length === 1 ? 'posición abierta' : 'posiciones abiertas'}
                  </span>
                  <button className="btn btn-primary" onClick={() => setShowTxnForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> Cargar movimiento
                  </button>
                </div>

                {/* Form nuevo movimiento */}
                {showTxnForm && (
                  <Card title="Nuevo movimiento" style={{ marginBottom: 'var(--sp-5)' }}>
                    <form onSubmit={handleCreateTxn}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                        <div>
                          <label style={labelStyle}>Ticker</label>
                          <input style={inputStyle} placeholder="AAPL" value={txn.ticker} onChange={e => setTxn({ ...txn, ticker: e.target.value.toUpperCase() })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Tipo</label>
                          <select style={inputStyle} value={txn.side} onChange={e => setTxn({ ...txn, side: e.target.value as TxnSide })}>
                            <option value="BUY">Compra</option>
                            <option value="SELL">Venta</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Cantidad</label>
                          <input style={inputStyle} type="number" step="any" placeholder="10" value={txn.quantity} onChange={e => setTxn({ ...txn, quantity: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Precio de entrada</label>
                          <input style={inputStyle} type="number" step="any" placeholder="150.25" value={txn.price} onChange={e => setTxn({ ...txn, price: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Comisiones</label>
                          <input style={inputStyle} type="number" step="any" value={txn.fees} onChange={e => setTxn({ ...txn, fees: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Moneda</label>
                          <select style={inputStyle} value={txn.currency} onChange={e => setTxn({ ...txn, currency: e.target.value })}>
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Fecha</label>
                          <input style={inputStyle} type="date" value={txn.trade_date} onChange={e => setTxn({ ...txn, trade_date: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Nota (opcional)</label>
                          <input style={inputStyle} placeholder="DCA mensual" value={txn.note} onChange={e => setTxn({ ...txn, note: e.target.value })} />
                        </div>
                      </div>
                      {txnError && <p style={{ color: 'var(--negative)', fontSize: 12, marginBottom: 8 }}>{txnError}</p>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar movimiento'}</button>
                        <button className="btn" type="button" onClick={() => setShowTxnForm(false)}>Cancelar</button>
                      </div>
                    </form>
                  </Card>
                )}

                {/* Tabla de posiciones */}
                {summaryLoading && !summary ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Calculando posiciones…</p>
                ) : summary && summary.positions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--text-muted)', fontSize: 13 }}>
                    Sin posiciones abiertas. Cargá tu primera compra con “Cargar movimiento”.
                  </div>
                ) : summary && (
                  <Card style={{ marginBottom: 'var(--sp-5)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'right' }}>
                          <th style={{ textAlign: 'left', padding: '6px 10px' }}>Activo</th>
                          <th style={{ padding: '6px 10px' }}>Cant.</th>
                          <th style={{ padding: '6px 10px' }}>Costo prom.</th>
                          <th style={{ padding: '6px 10px' }}>Precio actual</th>
                          <th style={{ padding: '6px 10px' }}>vs entrada</th>
                          <th style={{ padding: '6px 10px' }}>Valor ({base})</th>
                          <th style={{ padding: '6px 10px' }}>P&L ({base})</th>
                          <th style={{ padding: '6px 10px' }}>Peso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.positions.map(p => {
                          const pnlPos = p.unrealized_base >= 0;
                          return (
                            <tr key={p.ticker} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                              <td style={{ textAlign: 'left', padding: '8px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{p.ticker}</span>
                                  {p.dca_opportunity && (
                                    <span title="Cotiza por debajo de tu costo promedio" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: 'var(--positive)', background: 'rgba(74,222,128,0.12)', padding: '1px 6px', borderRadius: 100 }}>
                                      <TrendingDown size={11} /> DCA
                                    </span>
                                  )}
                                </div>
                                {p.name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.name}</div>}
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>{p.quantity}</td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>{money(p.avg_cost, p.currency, 2)}</td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>
                                {p.price_available ? money(p.current_price as number, p.currency, 2) : <span style={{ color: 'var(--text-muted)' }}>s/d</span>}
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', color: p.distance_to_entry_pct == null ? 'var(--text-muted)' : p.distance_to_entry_pct >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                {p.distance_to_entry_pct == null ? '—' : `${p.distance_to_entry_pct >= 0 ? '+' : ''}${p.distance_to_entry_pct}%`}
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>{money(p.market_value_base, base)}</td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)', color: pnlPos ? 'var(--positive)' : 'var(--negative)' }}>
                                {pnlPos ? '+' : ''}{money(p.unrealized_base, base)}<br />
                                <span style={{ fontSize: 11 }}>{p.unrealized_pct >= 0 ? '+' : ''}{p.unrealized_pct}%</span>
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>{p.weight_pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}

                {/* Historial de movimientos */}
                {transactions.length > 0 && (
                  <Card title={`Movimientos (${transactions.length})`}>
                    <button onClick={() => setShowTxns(v => !v)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showTxns ? 'var(--sp-3)' : 0 }}>
                      {showTxns ? 'Ocultar' : 'Ver historial'}
                    </button>
                    {showTxns && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'right' }}>
                              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Fecha</th>
                              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Tipo</th>
                              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Ticker</th>
                              <th style={{ padding: '6px 10px' }}>Cant.</th>
                              <th style={{ padding: '6px 10px' }}>Precio</th>
                              <th style={{ padding: '6px 10px' }}>Com.</th>
                              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Nota</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map(t => (
                              <tr key={t.id} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                                <td style={{ textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--mono)' }}>{t.trade_date}</td>
                                <td style={{ textAlign: 'left', padding: '6px 10px', color: t.side === 'BUY' ? 'var(--positive)' : 'var(--negative)', fontWeight: 600 }}>{t.side === 'BUY' ? 'Compra' : 'Venta'}</td>
                                <td style={{ textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--mono)', fontWeight: 600 }}>{t.ticker}</td>
                                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{t.quantity}</td>
                                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{money(t.price, t.currency)}</td>
                                <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)' }}>{t.fees}</td>
                                <td style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)' }}>{t.note}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <button onClick={() => handleDeleteTxn(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 2 }} title="Eliminar">
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
