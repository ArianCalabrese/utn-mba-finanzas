import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter, Search, RotateCcw, ChevronDown, ChevronRight,
  LineChart, BookOpen, TrendingUp, TrendingDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  getScreenerFields, runScreen,
  type FieldsCatalog, type ScreenerField, type FilterSpec,
  type ScreenResult, type ScreenRow,
} from '@/application/api/screener';
import { usePageStore } from '@/application/stores/pageStore';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';

const PAGE_SIZE = 25;

const inp: React.CSSProperties = {
  height: 34, padding: '0 10px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', width: '100%',
};
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtMarketCap(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} B`;   // billón (millón de millones)
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} MM`;     // mil millones
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} M`;
  return fmt(n, 0);
}

// Columnas de la tabla y a qué clave ordenable mapean (si aplica).
const COLUMNS: { key: string; label: string; sortKey?: string; align?: 'left' | 'right' }[] = [
  { key: 'ticker', label: 'Activo', align: 'left' },
  { key: 'price', label: 'Precio', sortKey: 'price', align: 'right' },
  { key: 'change_pct', label: 'Hoy', align: 'right' },
  { key: 'market_cap', label: 'Cap. Mdo.', sortKey: 'marketcap', align: 'right' },
  { key: 'pe', label: 'P/E', sortKey: 'pe', align: 'right' },
  { key: 'pb', label: 'P/B', sortKey: 'pb', align: 'right' },
  { key: 'dividend_yield', label: 'Div. Yield', sortKey: 'dividend_yield', align: 'right' },
  { key: 'change_52w', label: '52 sem.', sortKey: 'change_52w', align: 'right' },
];

export function ScreenerPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { screener: stored, setScreener, setTechnical, setFundamental } = usePageStore();

  const [catalog, setCatalog] = useState<FieldsCatalog | null>(null);
  const [filters, setFilters] = useState<Record<string, FilterSpec>>(stored.filters ?? {});
  const [sort, setSort] = useState<string>(stored.sort ?? 'marketcap');
  const [sortAsc, setSortAsc] = useState<boolean>(stored.sortAsc ?? false);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ScreenResult | null>(stored.result ?? null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getScreenerFields().then(setCatalog).catch(() => toast.error('No se pudo cargar el catálogo de filtros.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldsByCategory = useMemo(() => {
    const map: Record<string, ScreenerField[]> = {};
    catalog?.fields.forEach(f => { (map[f.category] ??= []).push(f); });
    return map;
  }, [catalog]);

  const activeCount = useMemo(
    () => Object.values(filters).filter(
      s => s && (s.value != null && s.value !== '' || s.min != null || s.max != null),
    ).length,
    [filters],
  );

  const setFilter = (key: string, patch: Partial<FilterSpec>) => {
    setFilters(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      // Limpiar entradas vacías para no ensuciar el request ni el conteo.
      const spec = next[key];
      if (spec && spec.value == null && spec.min == null && spec.max == null) delete next[key];
      else if (spec && spec.value === '') delete next[key];
      return next;
    });
  };

  const run = async (nextOffset = 0, nextSort = sort, nextAsc = sortAsc) => {
    setLoading(true);
    try {
      const data = await runScreen({
        filters, sort: nextSort, sort_asc: nextAsc, offset: nextOffset, size: PAGE_SIZE,
      });
      setResult(data);
      setOffset(nextOffset);
      setScreener({ filters, sort: nextSort, sortAsc: nextAsc, result: data });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error ejecutando el screener.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (sortKey: string) => {
    const asc = sort === sortKey ? !sortAsc : false;
    setSort(sortKey);
    setSortAsc(asc);
    run(0, sortKey, asc);
  };

  const clearFilters = () => {
    setFilters({});
    setResult(null);
    setScreener({ filters: {}, result: null });
  };

  const goTechnical = (ticker: string) => {
    setTechnical({ ticker, indicators: null, signals: null, conviction: null });
    navigate('/mercado/tecnico');
  };
  const goFundamental = (ticker: string) => {
    setFundamental({ ticker, ratios: null, dcf: null, dividends: null });
    navigate('/mercado/fundamental');
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.count / PAGE_SIZE)) : 1;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const renderField = (f: ScreenerField) => {
    const spec = filters[f.key] ?? {};
    const suffix = f.unit === 'percent' ? '%' : f.unit === 'currency' ? 'M USD' : '';
    return (
      <div key={f.key} style={{ marginBottom: 'var(--sp-3)' }}>
        <label style={lbl}>{f.label}{suffix && <span style={{ opacity: 0.6 }}> ({suffix})</span>}</label>
        {f.type === 'select' ? (
          <select
            style={inp}
            value={spec.value ?? ''}
            onChange={e => setFilter(f.key, { value: e.target.value })}
          >
            <option value="">Cualquiera</option>
            {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {(f.type === 'range' || f.type === 'min') && (
              <input
                type="number" style={inp} placeholder="mín"
                value={spec.min ?? ''}
                onChange={e => setFilter(f.key, { min: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            )}
            {(f.type === 'range' || f.type === 'max') && (
              <input
                type="number" style={inp} placeholder="máx"
                value={spec.max ?? ''}
                onChange={e => setFilter(f.key, { max: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        icon={<Filter size={22} />}
        title="Screener Fundamental"
        subtitle="Filtrá todo el universo de mercado por valuación, rentabilidad, salud financiera, márgenes, crecimiento y técnico"
      />
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 'var(--sp-5)', alignItems: 'start' }}>

          {/* ── Panel de filtros ── */}
          <Card title={`Filtros${activeCount ? ` (${activeCount})` : ''}`}>
            {!catalog ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando filtros…</p>
            ) : (
              <>
                {catalog.categories.map(cat => {
                  const isCollapsed = collapsed[cat];
                  return (
                    <div key={cat} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
                      <button
                        type="button"
                        onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                        }}
                      >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        {cat}
                      </button>
                      {!isCollapsed && (
                        <div style={{ paddingTop: 'var(--sp-2)' }}>
                          {fieldsByCategory[cat]?.map(renderField)}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-3)' }}>
                  <button className="btn btn-primary" onClick={() => run(0)} disabled={loading} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Search size={14} /> {loading ? 'Buscando…' : 'Buscar'}
                  </button>
                  <button className="btn" onClick={clearFilters} disabled={loading} title="Limpiar filtros" style={{ display: 'flex', alignItems: 'center' }}>
                    <RotateCcw size={14} />
                  </button>
                </div>
              </>
            )}
          </Card>

          {/* ── Resultados ── */}
          <div>
            {!result && !loading && (
              <Card>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                  Ajustá los filtros y tocá <strong>Buscar</strong>. El motor consulta el universo completo de Yahoo Finance del lado del servidor.
                </p>
              </Card>
            )}

            {loading && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Filtrando el universo…</p>
            )}

            {result && !loading && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                  <Card><Metric label="Coincidencias" value={result.count.toLocaleString('en-US')} sub="en todo el universo" /></Card>
                  <Card><Metric label="Mostrando" value={`${result.returned}`} sub={`página ${currentPage} de ${totalPages}`} /></Card>
                  <Card><Metric label="Filtros activos" value={String(activeCount)} /></Card>
                </div>

                {result.rows.length === 0 ? (
                  <Card><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Ningún activo cumple estos filtros. Probá relajar algún criterio.</p></Card>
                ) : (
                  <Card style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                          {COLUMNS.map(col => (
                            <th
                              key={col.key}
                              onClick={col.sortKey ? () => toggleSort(col.sortKey!) : undefined}
                              style={{
                                textAlign: col.align ?? 'right', padding: '8px 12px',
                                cursor: col.sortKey ? 'pointer' : 'default', whiteSpace: 'nowrap',
                                userSelect: 'none',
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: col.align === 'left' ? 'flex-start' : 'flex-end' }}>
                                {col.label}
                                {col.sortKey && sort === col.sortKey && (sortAsc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                              </span>
                            </th>
                          ))}
                          <th style={{ padding: '8px 12px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((r: ScreenRow) => {
                          const up = r.change_pct != null && r.change_pct >= 0;
                          return (
                            <tr key={r.ticker} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ textAlign: 'left', padding: '10px 12px' }}>
                                <div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{r.ticker}</div>
                                {r.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>}
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                                {r.price != null ? `${fmt(r.price)} ${r.currency ?? ''}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: r.change_pct == null ? 'var(--text-muted)' : up ? 'var(--positive)' : 'var(--negative)' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  {r.change_pct != null && (up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                                  {r.change_pct != null ? `${up ? '+' : ''}${fmt(r.change_pct)}%` : '—'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)' }}>{fmtMarketCap(r.market_cap)}</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)' }}>{fmt(r.pe, 1)}</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)' }}>{fmt(r.pb, 1)}</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)' }}>{r.dividend_yield != null ? `${fmt(r.dividend_yield)}%` : '—'}</td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: r.change_52w == null ? undefined : r.change_52w >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                {r.change_52w != null ? `${r.change_52w >= 0 ? '+' : ''}${fmt(r.change_52w)}%` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', padding: '10px 12px', whiteSpace: 'nowrap' }}>
                                <button onClick={() => goTechnical(r.ticker)} title="Análisis técnico" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                                  <LineChart size={15} />
                                </button>
                                <button onClick={() => goFundamental(r.ticker)} title="Análisis fundamental" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                                  <BookOpen size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                )}

                {result.count > PAGE_SIZE && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 'var(--sp-4)' }}>
                    <button className="btn" disabled={offset === 0 || loading} onClick={() => run(Math.max(0, offset - PAGE_SIZE))}>← Anterior</button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Página {currentPage} de {totalPages}</span>
                    <button className="btn" disabled={currentPage >= totalPages || loading} onClick={() => run(offset + PAGE_SIZE)}>Siguiente →</button>
                  </div>
                )}

                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--sp-3)' }}>
                  Filtrás por todos los criterios; las columnas muestran los datos nativos del screener de Yahoo (precio, P/E, P/B, dividend yield, %52 sem.).
                  Usá los íconos para abrir el análisis técnico o fundamental completo de cada activo.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
