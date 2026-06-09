import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getRatios, getDcf, getDividends, type DcfResult } from '@/application/api/fundamental';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

function fmt(n: unknown, dec = 2, prefix = ''): string {
  if (n == null) return '—';
  const num = typeof n === 'number' ? n : Number(n);
  if (isNaN(num)) return '—';
  return `${prefix}${num.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function fmtPct(n: unknown): string {
  if (n == null) return '—';
  const num = typeof n === 'number' ? n : Number(n);
  if (isNaN(num)) return '—';
  return `${(num * 100).toFixed(2)}%`;
}

type Tab = 'ratios' | 'dcf' | 'dividends';

export function FundamentalPage() {
  const [ticker, setTicker] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('ratios');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ratios, setRatios] = useState<Record<string, unknown> | null>(null);
  const [dcf, setDcf] = useState<DcfResult | null>(null);
  const [dividends, setDividends] = useState<Record<string, unknown> | null>(null);

  // DCF params
  const [wacc, setWacc] = useState('0.10');
  const [termGrowth, setTermGrowth] = useState('0.025');
  const [years, setYears] = useState('5');

  const searchRatios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setRatios(null);
    setDcf(null);
    setDividends(null);
    try {
      const [r, div] = await Promise.all([getRatios(ticker), getDividends(ticker)]);
      setRatios(r);
      setDividends(div);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const runDcf = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDcf(ticker, {
        wacc: parseFloat(wacc),
        terminal_growth: parseFloat(termGrowth),
        years: parseInt(years),
      });
      setDcf(result);
      setActiveTab('dcf');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error running DCF.');
    } finally {
      setLoading(false);
    }
  };

  const r = ratios as Record<string, Record<string, number | null>> | null;

  const dcfBarData = dcf
    ? dcf.projected_fcf.map((v, i) => ({
        year: `Año ${i + 1}`,
        fcf: Math.round(v / 1e6),
        pv: Math.round(dcf.pv_fcf[i] / 1e6),
      }))
    : [];

  return (
    <>
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Análisis Fundamental"
        subtitle="Ratios, DCF y dividendos"
      />
      <div className="page-body">
        <form onSubmit={searchRatios} style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
          <input
            placeholder="Ticker (ej: AAPL)"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            style={{ flex: 1, height: 40, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Cargando…' : 'Analizar'}
          </button>
        </form>

        {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>{error}</p>}

        {(ratios || dcf) && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-1)' }}>
            {(['ratios', 'dcf', 'dividends'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 550, background: activeTab === tab ? 'var(--accent-subtle)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.12s' }}
              >
                {tab === 'ratios' ? 'Ratios' : tab === 'dcf' ? 'DCF' : 'Dividendos'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'ratios' && r && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <Card title="Valoración">
              <div className="metrics-grid">
                <Metric label="P/E" value={fmt(r.valuation?.pe_ratio)} />
                <Metric label="Forward P/E" value={fmt(r.valuation?.forward_pe)} />
                <Metric label="PEG" value={fmt(r.valuation?.peg_ratio)} />
                <Metric label="P/B" value={fmt(r.valuation?.price_to_book)} />
                <Metric label="P/S" value={fmt(r.valuation?.price_to_sales)} />
                <Metric label="EV/EBITDA" value={fmt(r.valuation?.ev_to_ebitda)} />
              </div>
            </Card>
            <Card title="Rentabilidad">
              <div className="metrics-grid">
                <Metric label="ROE" value={fmtPct(r.profitability?.roe)} variant="positive" />
                <Metric label="ROA" value={fmtPct(r.profitability?.roa)} />
                <Metric label="Margen bruto" value={fmtPct(r.profitability?.gross_margin)} />
                <Metric label="Margen op." value={fmtPct(r.profitability?.operating_margin)} />
                <Metric label="Margen neto" value={fmtPct(r.profitability?.net_margin)} />
              </div>
            </Card>
            <Card title="Liquidez y solvencia">
              <div className="metrics-grid">
                <Metric label="Current ratio" value={fmt(r.liquidity_solvency?.current_ratio)} />
                <Metric label="Quick ratio" value={fmt(r.liquidity_solvency?.quick_ratio)} />
                <Metric label="Deuda/Equity" value={fmt(r.liquidity_solvency?.debt_to_equity)} />
              </div>
            </Card>
            <Card title="Crecimiento">
              <div className="metrics-grid">
                <Metric label="Rev. Growth" value={fmtPct(r.growth?.revenue_growth)} />
                <Metric label="Earn. Growth" value={fmtPct(r.growth?.earnings_growth)} />
                <Metric label="EPS trailing" value={fmt(r.per_share?.eps_trailing)} />
                <Metric label="EPS forward" value={fmt(r.per_share?.eps_forward)} />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ratios' && ratios && (
          <Card title="Ejecutar DCF" style={{ marginTop: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>WACC</label>
                <input type="number" step="0.01" min="0.01" max="0.5" value={wacc} onChange={e => setWacc(e.target.value)}
                  style={{ width: 90, height: 36, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Crec. terminal</label>
                <input type="number" step="0.001" min="0.001" max="0.10" value={termGrowth} onChange={e => setTermGrowth(e.target.value)}
                  style={{ width: 100, height: 36, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Años</label>
                <input type="number" step="1" min="1" max="15" value={years} onChange={e => setYears(e.target.value)}
                  style={{ width: 70, height: 36, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
              </div>
              <button className="btn btn-primary" onClick={runDcf} disabled={loading} style={{ height: 36 }}>
                Calcular DCF
              </button>
            </div>
          </Card>
        )}

        {activeTab === 'dcf' && dcf && (
          <>
            <div className="metrics-grid" style={{ marginBottom: 'var(--sp-5)' }}>
              <Metric label="Valor intrínseco" value={dcf.intrinsic_value_per_share != null ? `$${dcf.intrinsic_value_per_share.toFixed(2)}` : '—'} variant="accent" />
              <Metric label="Precio actual" value={dcf.current_price != null ? `$${dcf.current_price.toFixed(2)}` : '—'} />
              <Metric label="Margen de seguridad" value={dcf.margin_of_safety_pct != null ? `${dcf.margin_of_safety_pct.toFixed(1)}%` : '—'}
                variant={dcf.margin_of_safety_pct != null ? (dcf.margin_of_safety_pct > 0 ? 'positive' : 'negative') : 'default'} />
              <Metric label="WACC" value={`${(dcf.assumptions.wacc * 100).toFixed(1)}%`} />
              <Metric label="Crec. FCF hist." value={`${(dcf.assumptions.fcf_growth_rate * 100).toFixed(1)}%`} />
              <Metric label="Crec. terminal" value={`${(dcf.assumptions.terminal_growth_rate * 100).toFixed(1)}%`} />
              <Metric label="FCF base" value={`$${(dcf.base_fcf / 1e9).toFixed(2)}B`} />
              <Metric label="Valor terminal PV" value={`$${(dcf.pv_terminal_value / 1e9).toFixed(2)}B`} />
              <Metric label="Equity value" value={`$${(dcf.equity_value / 1e9).toFixed(2)}B`} />
            </div>

            {dcfBarData.length > 0 && (
              <Card title="FCF proyectado vs. PV (en millones USD)">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dcfBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}M`]} />
                    <Bar dataKey="fcf" name="FCF proyectado" fill="var(--accent)" opacity={0.7} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pv" name="Valor presente" fill="var(--positive)" opacity={0.8} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}

        {activeTab === 'dividends' && dividends && (
          <>
            {(dividends as { pays_dividends?: boolean }).pays_dividends === false ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Este ticker no distribuye dividendos.</p>
            ) : (
              <div className="metrics-grid">
                <Metric label="Dividend Yield" value={fmt((dividends as Record<string, unknown>).dividend_yield, 4)} />
                <Metric label="Dividend Rate" value={fmt((dividends as Record<string, unknown>).dividend_rate)} />
                <Metric label="Payout Ratio" value={fmtPct((dividends as Record<string, unknown>).payout_ratio)} />
                <Metric label="5Y Avg Yield" value={fmt((dividends as Record<string, unknown>).five_year_avg_yield, 4)} />
                <Metric label="CAGR Dividendos" value={`${fmt((dividends as Record<string, unknown>).dividend_cagr_pct)}%`} variant="positive" />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
