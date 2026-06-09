import { useState } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import {
  optimizePortfolio,
  backtestPortfolio,
  computeCorrelation,
  type OptimizeResult,
  type BacktestResult,
} from '@/application/api/portfolio';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ReferenceLine,
} from 'recharts';

type Tab = 'optimize' | 'backtest' | 'correlation';

function fmt(n: number | null | undefined, dec = 2): string {
  return n == null ? '—' : n.toFixed(dec);
}

export function PortfolioPage() {
  const [tickerInput, setTickerInput] = useState('AAPL,MSFT,GOOGL,SPY');
  const [rfr, setRfr] = useState('0.05');
  const [period, setPeriod] = useState('1y');
  const [activeTab, setActiveTab] = useState<Tab>('optimize');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [optimized, setOptimized] = useState<OptimizeResult | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [correlation, setCorrelation] = useState<{ correlation_matrix: Record<string, Record<string, number>>; beta_vs_benchmark: Record<string, number> } | null>(null);

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
              <input value={tickerInput} onChange={e => setTickerInput(e.target.value)}
                style={{ width: '100%', height: 38, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <Card title="Máximo Sharpe Ratio">
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
              <Card title="Mínima Varianza">
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
              <Card title="Frontera eficiente">
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="volatility" name="Volatilidad" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11 }} label={{ value: 'Volatilidad', position: 'insideBottom', offset: -4, fontSize: 11 }} />
                    <YAxis dataKey="expected_return" name="Retorno" tickFormatter={v => `${(v * 100).toFixed(1)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [`${(v * 100).toFixed(2)}%`, name]} />
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
              <Card title="Curva de capital normalizada (base 1.0)">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={backtest.equity_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} interval={Math.floor(backtest.equity_curve.length / 8)} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} tickFormatter={v => v.toFixed(2)} />
                    <ReferenceLine y={1} stroke="var(--border)" strokeDasharray="4 4" />
                    <Tooltip formatter={(v: number) => [v.toFixed(4), 'Valor']} labelStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}

        {activeTab === 'correlation' && correlation && (
          <Card title="Matriz de correlación">
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
    </>
  );
}
