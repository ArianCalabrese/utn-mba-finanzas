import { useState, useEffect, useRef } from 'react';
import { PieChart as PieChartIcon, ChevronDown } from 'lucide-react';
import {
  optimizePortfolio,
  backtestPortfolio,
  computeCorrelation,
  getHoldingTickers,
  getPortfolios,
  type Portfolio,
  type OptimizeResult,
  type BacktestResult,
} from '@/application/api/portfolio';
import { getWatchlistTickers, getWatchlists, type WatchlistMeta } from '@/application/api/watchlist';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { HelpModal, HelpSection, HelpFormula } from '@/presentation/components/HelpModal';
import { ApiError } from '@/application/api/client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ReferenceLine,
} from 'recharts';

type Tab = 'optimize' | 'backtest' | 'correlation';
type HelpKey = 'sharpe' | 'minvar' | 'frontier' | 'backtest' | 'var' | 'correlation';

const HELP: Record<HelpKey, { title: string; content: React.ReactNode }> = {
  sharpe: {
    title: 'Portafolio de Máximo Sharpe Ratio',
    content: (
      <>
        <HelpSection title="¿Qué es el Sharpe Ratio?">
          <HelpFormula>Sharpe = (Retorno esperado − Tasa libre de riesgo) / Volatilidad</HelpFormula>
          <p>Mide el retorno por unidad de riesgo. A mayor Sharpe, mejor relación riesgo/retorno. {'> 1'} se considera bueno.</p>
        </HelpSection>
        <HelpSection title="Optimización">
          <p>Se busca la combinación de pesos que <strong>maximiza el Sharpe ratio</strong>, usando el algoritmo SLSQP. No puede haber posiciones cortas (todos los pesos ≥ 0).</p>
        </HelpSection>
      </>
    ),
  },
  minvar: {
    title: 'Portafolio de Mínima Varianza',
    content: (
      <>
        <HelpSection title="¿Qué es?">
          <p>La combinación de pesos que <strong>minimiza la volatilidad</strong> del portafolio, sin importar el retorno esperado. Es el punto más a la izquierda de la frontera eficiente.</p>
        </HelpSection>
        <HelpSection title="¿Cuándo usarlo?">
          <p>Ideal para inversores conservadores que priorizan la estabilidad por encima del retorno. Muy útil en mercados volátiles o como portafolio defensivo.</p>
        </HelpSection>
      </>
    ),
  },
  frontier: {
    title: 'Frontera Eficiente de Markowitz',
    content: (
      <>
        <HelpSection title="¿Qué es?">
          <p>Conjunto de portafolios que ofrecen el <strong>máximo retorno para cada nivel de riesgo</strong> dado (o mínimo riesgo para cada nivel de retorno). Propuesto por Harry Markowitz en 1952.</p>
        </HelpSection>
        <HelpSection title="¿Cómo se construye?">
          <p>Se resuelven 25 optimizaciones, cada una fijando un retorno objetivo diferente entre el mínimo y máximo posible, y minimizando la volatilidad para ese retorno.</p>
        </HelpSection>
        <HelpSection title="Diversificación">
          <p>La clave de Markowitz es que activos correlacionados negativamente reducen el riesgo total. El portafolio óptimo no es simplemente el activo con mayor retorno.</p>
        </HelpSection>
      </>
    ),
  },
  backtest: {
    title: 'Backtest Histórico del Portafolio',
    content: (
      <>
        <HelpSection title="¿Qué hace?">
          <p>Simula cómo hubiera rendido el portafolio con los pesos del Máximo Sharpe en el período histórico seleccionado, recalculando los pesos diariamente.</p>
        </HelpSection>
        <HelpSection title="Métricas">
          <p><strong>Max Drawdown</strong>: caída máxima desde un pico. Ej: -20% significa que en algún momento el portafolio cayó 20% desde su máximo histórico.<br />
          <strong>Sharpe anualizado</strong>: retorno ajustado por riesgo en el período.<br />
          <strong>Curva de capital</strong>: evolución del valor del portafolio normalizado a 1.0.</p>
        </HelpSection>
        <HelpSection title="Advertencia">
          <p>El backtest no garantiza resultados futuros. Los pesos óptimos históricos pueden no ser óptimos en el futuro.</p>
        </HelpSection>
      </>
    ),
  },
  var: {
    title: 'VaR — Value at Risk',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Pérdida máxima esperada del portafolio en un día, con un nivel de confianza dado.</p>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong>VaR 95%</strong>: en el 95% de los días, la pérdida no superará este valor.<br />
          <strong>VaR 99%</strong>: en el 99% de los días, la pérdida no superará este valor.<br />
          <strong>Histórico</strong>: usa los retornos pasados reales.<br />
          <strong>Paramétrico</strong>: asume distribución normal.</p>
        </HelpSection>
      </>
    ),
  },
  correlation: {
    title: 'Matriz de Correlación y Beta',
    content: (
      <>
        <HelpSection title="Correlación">
          <HelpFormula>ρ(A,B) = Cov(A,B) / (σ_A × σ_B) ∈ [−1, 1]</HelpFormula>
          <p><strong>+1</strong>: se mueven exactamente igual.<br />
          <strong>0</strong>: sin relación lineal.<br />
          <strong>−1</strong>: se mueven exactamente opuesto (máxima diversificación).</p>
        </HelpSection>
        <HelpSection title="Beta vs benchmark">
          <HelpFormula>β = Cov(activo, benchmark) / Var(benchmark)</HelpFormula>
          <p><strong>β {'>'} 1</strong>: el activo se mueve más que el mercado (más riesgo).<br />
          <strong>β {'<'} 1</strong>: el activo se mueve menos (más estable).<br />
          <strong>β {'<'} 0</strong>: el activo se mueve en dirección opuesta al mercado.</p>
        </HelpSection>
      </>
    ),
  },
};

function fmt(n: number | null | undefined, dec = 2): string {
  return n == null ? '—' : n.toFixed(dec);
}

// ─── Multi-select dropdown ────────────────────────────────────────────────────

interface CheckItem { id: number; name: string; }

function MultiCheckDropdown({
  label, items, onLoad,
}: {
  label: string;
  items: CheckItem[];
  onLoad: (ids: number[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const allSelected = items.length > 0 && selected.size === items.length;

  const handleLoad = async () => {
    if (selected.size === 0) return;
    setConfirming(true);
    try { await onLoad([...selected]); } finally { setConfirming(false); }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
        {label}
        <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 220, zIndex: 300,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          padding: '6px 0',
        }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 14px', whiteSpace: 'nowrap' }}>
              No hay elementos disponibles.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 14px 6px', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
                <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)))}
                  style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {allSelected ? 'Ninguno' : 'Todos'}
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
              </div>

              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {items.map(item => (
                  <label key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
                    cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)}
                      style={{ accentColor: 'var(--accent)', flexShrink: 0 }} />
                    {item.name}
                  </label>
                ))}
              </div>

              <div style={{ padding: '6px 14px 2px', borderTop: '1px solid var(--border)', marginTop: 2 }}>
                <button type="button" className="btn btn-primary" onClick={handleLoad}
                  disabled={selected.size === 0 || confirming}
                  style={{ width: '100%', fontSize: 12 }}>
                  {confirming ? 'Cargando…' : `Cargar tickers${selected.size > 0 ? ` (${selected.size})` : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PortfolioPage ────────────────────────────────────────────────────────────

export function PortfolioPage() {
  const [tickerInput, setTickerInput] = useState('AAPL,MSFT,GOOGL,SPY');
  const [rfr, setRfr] = useState('0.05');
  const [period, setPeriod] = useState('1y');
  const [activeTab, setActiveTab] = useState<Tab>('optimize');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHelp, setOpenHelp] = useState<HelpKey | null>(null);

  const [optimized, setOptimized] = useState<OptimizeResult | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [correlation, setCorrelation] = useState<{ correlation_matrix: Record<string, Record<string, number>>; beta_vs_benchmark: Record<string, number> } | null>(null);

  const [portfoliosList, setPortfoliosList] = useState<Portfolio[]>([]);
  const [watchlistsList, setWatchlistsList] = useState<WatchlistMeta[]>([]);

  useEffect(() => {
    getPortfolios().then(setPortfoliosList).catch(() => {});
    getWatchlists().then(setWatchlistsList).catch(() => {});
  }, []);

  const tickers = tickerInput.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);

  const runOptimize = async () => {
    if (tickers.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const [opt, corr] = await Promise.all([
        optimizePortfolio(tickers, parseFloat(rfr)),
        computeCorrelation(tickers),
      ]);
      setOptimized(opt);
      setCorrelation(corr);
      setActiveTab('optimize');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error.');
    } finally {
      setLoading(false);
    }
  };

  const loadMyTickers = async (ids: number[]) => {
    setError(null);
    try {
      const { tickers } = await getHoldingTickers(ids);
      if (tickers.length === 0) {
        setError('Las carteras seleccionadas no tienen tenencias cargadas.');
        return;
      }
      setTickerInput(tickers.join(','));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar tus acciones.');
    }
  };

  const loadWatchlistTickers = async (ids: number[]) => {
    setError(null);
    try {
      const { tickers } = await getWatchlistTickers(ids);
      if (tickers.length === 0) {
        setError('Las listas seleccionadas están vacías.');
        return;
      }
      setTickerInput(tickers.join(','));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la lista de seguimiento.');
    }
  };

  const runBacktest = async () => {
    if (!optimized || tickers.length < 2) return;
    setLoading(true);
    setError(null);
    const weights = tickers.map(t => optimized.max_sharpe.weights[t] ?? 0);
    try {
      const result = await backtestPortfolio(tickers, weights, period);
      setBacktest(result);
      setActiveTab('backtest');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error.');
    } finally {
      setLoading(false);
    }
  };

  const frontierData = optimized?.efficient_frontier ?? [];

  return (
    <>
      <PageHeader icon={<PieChartIcon size={22} />} title="Portafolio" subtitle="Optimización Markowitz, frontera eficiente y backtest" />
      <div className="page-body">
        <Card style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tickers (separados por coma)</label>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <input value={tickerInput} onChange={e => setTickerInput(e.target.value)}
                  style={{ flex: 1, height: 38, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
                <MultiCheckDropdown
                  label="Mis acciones"
                  items={portfoliosList.map(p => ({ id: p.id, name: p.name }))}
                  onLoad={loadMyTickers}
                />
                <MultiCheckDropdown
                  label="Mi seguimiento"
                  items={watchlistsList.map(w => ({ id: w.id, name: w.name }))}
                  onLoad={loadWatchlistTickers}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tasa libre de riesgo</label>
              <input type="number" step="0.01" value={rfr} onChange={e => setRfr(e.target.value)}
                style={{ width: 90, height: 38, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Período</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                style={{ height: 38, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}>
                {['1y', '2y', '3y', '5y'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={runOptimize} disabled={loading}>{loading ? 'Calculando…' : 'Optimizar'}</button>
            {optimized && <button className="btn btn-ghost" onClick={runBacktest} disabled={loading}>Backtest (Max Sharpe)</button>}
          </div>
        </Card>

        {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>{error}</p>}

        {(optimized || backtest) && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-1)' }}>
            {(['optimize', 'backtest', 'correlation'] as Tab[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 550, background: activeTab === tab ? 'var(--accent-subtle)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)' }}>
                {tab === 'optimize' ? 'Optimización' : tab === 'backtest' ? 'Backtest' : 'Correlación'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'optimize' && optimized && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <Card title="Máximo Sharpe Ratio" onHelp={() => setOpenHelp('sharpe')}>
                <div className="metrics-grid" style={{ marginBottom: 'var(--sp-4)' }}>
                  <Metric label="Retorno esperado" value={`${(optimized.max_sharpe.expected_annual_return * 100).toFixed(2)}%`} variant="positive" />
                  <Metric label="Volatilidad" value={`${(optimized.max_sharpe.annual_volatility * 100).toFixed(2)}%`} />
                  <Metric label="Sharpe ratio" value={fmt(optimized.max_sharpe.sharpe_ratio)} variant="accent" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {Object.entries(optimized.max_sharpe.weights).map(([t, w]) => (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{t}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${w * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', minWidth: 40, textAlign: 'right' }}>{(w * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Mínima Varianza" onHelp={() => setOpenHelp('minvar')}>
                <div className="metrics-grid" style={{ marginBottom: 'var(--sp-4)' }}>
                  <Metric label="Retorno esperado" value={`${(optimized.min_variance.expected_annual_return * 100).toFixed(2)}%`} />
                  <Metric label="Volatilidad" value={`${(optimized.min_variance.annual_volatility * 100).toFixed(2)}%`} variant="positive" />
                  <Metric label="Sharpe ratio" value={fmt(optimized.min_variance.sharpe_ratio)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                  {Object.entries(optimized.min_variance.weights).map(([t, w]) => (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                      <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{t}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${w * 100}%`, height: '100%', background: 'var(--positive)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', minWidth: 40, textAlign: 'right' }}>{(w * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {frontierData.length > 0 && (
              <Card title="Frontera eficiente" onHelp={() => setOpenHelp('frontier')}>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="volatility" name="Volatilidad" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11 }} label={{ value: 'Volatilidad', position: 'insideBottom', offset: -4, fontSize: 11 }} />
                    <YAxis dataKey="expected_return" name="Retorno" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, name) => [`${((v as number) * 100).toFixed(2)}%`, name as string]} />
                    <Scatter data={frontierData} fill="var(--accent)" opacity={0.85} />
                  </ScatterChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}

        {activeTab === 'backtest' && backtest && (
          <>
            <div className="metrics-grid" style={{ marginBottom: 'var(--sp-5)' }}>
              <Metric label="Retorno total" value={`${fmt(backtest.total_return_pct)}%`} variant={backtest.total_return_pct >= 0 ? 'positive' : 'negative'} />
              <Metric label="Retorno anual" value={`${fmt(backtest.annual_return_pct)}%`} variant={backtest.annual_return_pct >= 0 ? 'positive' : 'negative'} />
              <Metric label="Volatilidad anual" value={`${fmt(backtest.annual_volatility_pct)}%`} />
              <Metric label="Max. Drawdown" value={`${fmt(backtest.max_drawdown_pct)}%`} variant="negative" />
              <Metric label="Sharpe ratio" value={fmt(backtest.sharpe_ratio)} variant="accent" />
            </div>
            {backtest.equity_curve.length > 0 && (
              <Card title="Curva de capital normalizada (base 1.0)" onHelp={() => setOpenHelp('backtest')}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={backtest.equity_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} interval={Math.floor(backtest.equity_curve.length / 8)} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v.toFixed(2)} />
                    <ReferenceLine y={1} stroke="var(--border)" strokeDasharray="4 4" />
                    <Tooltip formatter={(v) => [(v as number).toFixed(4), 'Valor']} labelStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}

        {activeTab === 'correlation' && correlation && (
          <Card title="Matriz de correlación" onHelp={() => setOpenHelp('correlation')}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, fontFamily: 'var(--mono)' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}></th>
                    {Object.keys(correlation.correlation_matrix).map(t => (
                      <th key={t} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(correlation.correlation_matrix).map(([row, cols]) => (
                    <tr key={row}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{row}</td>
                      {Object.entries(cols).map(([col, val]) => {
                        const abs = Math.abs(val);
                        const bg = row === col ? 'var(--accent-subtle)' : abs > 0.7 ? 'rgba(220,38,38,0.1)' : abs > 0.4 ? 'rgba(217,119,6,0.08)' : 'transparent';
                        return (
                          <td key={col} style={{ padding: '8px 12px', textAlign: 'center', background: bg, borderRadius: 4 }}>{val.toFixed(3)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Object.keys(correlation.beta_vs_benchmark).length > 0 && (
              <div style={{ marginTop: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                {Object.entries(correlation.beta_vs_benchmark).map(([t, beta]) => (
                  <div key={t} style={{ background: 'var(--bg-raised)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t}</span>
                    <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', color: Math.abs(beta) > 1 ? 'var(--negative)' : 'var(--positive)' }}>β = {beta.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {openHelp && HELP[openHelp] && (
        <HelpModal title={HELP[openHelp].title} onClose={() => setOpenHelp(null)}>
          {HELP[openHelp].content}
        </HelpModal>
      )}
    </>
  );
}
