import { useMemo, useState } from 'react';
import { Dices, Plus, Trash2, Scale } from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { simulateMonteCarlo, type MonteCarloResult, type MonteCarloMethod } from '@/application/api/portfolio';
import { usePageStore } from '@/application/stores/pageStore';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { TickerInput } from '@/presentation/components/TickerInput';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

const inp: React.CSSProperties = {
  height: 36, padding: '0 10px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', width: '100%',
};
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

interface Row { ticker: string; weight: string }

export function MonteCarloPage() {
  const { montecarlo: stored, setMonteCarlo } = usePageStore();
  const toast = useToast();

  const [rows, setRows] = useState<Row[]>(stored.rows);
  const [initial, setInitial] = useState(stored.initial);
  const [monthly, setMonthly] = useState(stored.monthly);
  const [years, setYears] = useState(stored.years);
  const [target, setTarget] = useState(stored.target);
  const [method, setMethod] = useState<MonteCarloMethod>(stored.method as MonteCarloMethod);
  const [nSims, setNSims] = useState(stored.nSims);
  const [result, setResult] = useState<MonteCarloResult | null>(stored.result);
  const [loading, setLoading] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    setRows(next);
    setMonteCarlo({ rows: next });
  };

  const addRow = () => {
    const next = [...rows, { ticker: '', weight: '' }];
    setRows(next);
    setMonteCarlo({ rows: next });
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    setRows(next.length ? next : [{ ticker: '', weight: '' }]);
    setMonteCarlo({ rows: next });
  };

  const equalize = () => {
    const filled = rows.filter(r => r.ticker.trim());
    if (!filled.length) return;
    const w = (100 / filled.length).toFixed(1);
    const next = rows.map(r => (r.ticker.trim() ? { ...r, weight: w } : r));
    setRows(next);
    setMonteCarlo({ rows: next });
  };

  const run = async () => {
    const filled = rows.filter(r => r.ticker.trim());
    if (!filled.length) { toast.error('Agregá al menos un ticker.'); return; }

    const weights = filled.map(r => parseFloat(r.weight) || 0);
    if (weights.every(w => w <= 0)) { toast.error('Asigná pesos mayores a cero (o usá "Equiponderar").'); return; }

    const ini = parseFloat(initial) || 0;
    const mon = parseFloat(monthly) || 0;
    if (ini <= 0 && mon <= 0) { toast.error('Indicá capital inicial y/o aporte mensual.'); return; }

    setLoading(true);
    try {
      const data = await simulateMonteCarlo({
        tickers: filled.map(r => r.ticker.trim().toUpperCase()),
        weights,
        initial_investment: ini,
        monthly_contribution: mon,
        years: parseInt(years) || 10,
        n_sims: parseInt(nSims) || 1000,
        target_value: target ? parseFloat(target) : null,
        method,
      });
      setResult(data);
      setMonteCarlo({ initial, monthly, years, target, method, nSims, result: data });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error ejecutando la simulación.');
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.timeline.map(p => ({
      month: p.month,
      band90: [p.p5, p.p95],
      band50: [p.p25, p.p75],
      p50: p.p50,
      invested: p.invested,
    }));
  }, [result]);

  const f = result?.final;

  return (
    <>
      <PageHeader
        icon={<Dices size={22} />}
        title="Simulador Monte Carlo"
        subtitle="Proyección probabilística de tu cartera con aportes mensuales (DCA)"
      />
      <div className="page-body">

        {/* ── Parámetros ── */}
        <Card title="Cartera a simular" style={{ marginBottom: 'var(--sp-4)' }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end', marginBottom: 'var(--sp-2)' }}>
              <div style={{ width: 160 }}>
                {i === 0 && <label style={lbl}>Ticker</label>}
                <TickerInput style={inp} value={r.ticker} onChange={v => setRow(i, { ticker: v })} />
              </div>
              <div style={{ width: 110 }}>
                {i === 0 && <label style={lbl}>Peso %</label>}
                <input
                  style={inp} type="number" min="0" max="100" step="0.1" placeholder="25"
                  value={r.weight} onChange={e => setRow(i, { weight: e.target.value })}
                />
              </div>
              <button
                type="button" onClick={() => removeRow(i)} title="Quitar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 8 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-2)' }}>
            <button type="button" className="btn" onClick={addRow} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Agregar activo
            </button>
            <button type="button" className="btn" onClick={equalize} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Scale size={14} /> Equiponderar
            </button>
          </div>
        </Card>

        <Card title="Parámetros de la simulación" style={{ marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--sp-3)' }}>
            <div>
              <label style={lbl}>Capital inicial (USD)</label>
              <input style={inp} type="number" min="0" value={initial} onChange={e => setInitial(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Aporte mensual (USD)</label>
              <input style={inp} type="number" min="0" value={monthly} onChange={e => setMonthly(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Horizonte (años)</label>
              <input style={inp} type="number" min="1" max="40" value={years} onChange={e => setYears(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Objetivo (USD, opcional)</label>
              <input style={inp} type="number" min="0" placeholder="Ej: 100000" value={target} onChange={e => setTarget(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Método</label>
              <select style={inp} value={method} onChange={e => setMethod(e.target.value as MonteCarloMethod)}>
                <option value="bootstrap">Bootstrap histórico</option>
                <option value="normal">Normal (GBM)</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Simulaciones</label>
              <select style={inp} value={nSims} onChange={e => setNSims(e.target.value)}>
                <option value="500">500</option>
                <option value="1000">1.000</option>
                <option value="2000">2.000</option>
                <option value="5000">5.000</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={loading} style={{ marginTop: 'var(--sp-4)' }}>
            {loading ? 'Simulando…' : 'Simular'}
          </button>
        </Card>

        {/* ── Resultados ── */}
        {result && f && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <Card><Metric label="Total invertido" value={fmtMoney(result.invested_total)} sub={`${result.years} años de aportes`} /></Card>
              <Card><Metric label="Mediana (P50)" value={fmtMoney(f.p50)} variant="accent" sub={f.median_multiple ? `${f.median_multiple}x lo invertido` : undefined} /></Card>
              <Card><Metric label="Pesimista (P5)" value={fmtMoney(f.p5)} variant="negative" sub="solo 5% termina peor" /></Card>
              <Card><Metric label="Optimista (P95)" value={fmtMoney(f.p95)} variant="positive" sub="solo 5% termina mejor" /></Card>
              <Card><Metric label="Prob. de pérdida" value={`${f.prob_loss_pct}%`} variant={f.prob_loss_pct > 25 ? 'negative' : 'default'} sub="terminar debajo de lo invertido" /></Card>
              {f.prob_target_pct != null && (
                <Card><Metric label="Prob. de objetivo" value={`${f.prob_target_pct}%`} variant={f.prob_target_pct >= 50 ? 'positive' : 'default'} sub={`alcanzar ${fmtMoney(f.target_value)}`} /></Card>
              )}
            </div>

            <Card title="Proyección del valor de la cartera" style={{ marginBottom: 'var(--sp-4)' }}>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    ticks={chartData.filter(p => p.month % 12 === 0).map(p => p.month)}
                    tickFormatter={(m: number) => `${(m / 12).toFixed(0)}a`}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={fmtCompact}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-primary)',
                    }}
                    labelFormatter={(m) => `Mes ${m} (año ${((m as number) / 12).toFixed(1)})`}
                    formatter={(value, name) => {
                      if (Array.isArray(value)) return [`${fmtCompact(value[0] as number)} – ${fmtCompact(value[1] as number)}`, name];
                      return [fmtCompact(value as number), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area dataKey="band90" name="P5–P95 (90% de escenarios)" stroke="none" fill="var(--accent)" fillOpacity={0.12} />
                  <Area dataKey="band50" name="P25–P75 (50% central)" stroke="none" fill="var(--accent)" fillOpacity={0.22} />
                  <Line dataKey="p50" name="Mediana" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  <Line dataKey="invested" name="Capital aportado" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
                {result.n_sims.toLocaleString('es-AR')} simulaciones · método {result.method === 'bootstrap' ? 'bootstrap de retornos históricos (5 años)' : 'normal / GBM'} ·
                retorno histórico anual {result.historical.annual_return_pct}% · volatilidad {result.historical.annual_volatility_pct}% ·
                pesos: {Object.entries(result.weights).map(([t, w]) => `${t} ${(w * 100).toFixed(0)}%`).join(' · ')}
              </p>
            </Card>

            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              La simulación proyecta retornos pasados hacia el futuro: es una herramienta de planificación,
              no una garantía. Los aportes mensuales se acreditan al cierre de cada mes.
            </p>
          </>
        )}
      </div>
    </>
  );
}
