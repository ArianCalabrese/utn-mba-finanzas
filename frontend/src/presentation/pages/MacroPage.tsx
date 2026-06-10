import { useState } from 'react';
import { Globe } from 'lucide-react';
import { getMarketRegime, getRelativeStrength, type MarketRegimeData, type RelativeStrengthData } from '@/application/api/macro';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { TickerInput } from '@/presentation/components/TickerInput';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';

function fmt(n: number | null | undefined, dec = 2): string {
  return n == null ? '—' : n.toFixed(dec);
}

function pctColor(v: number): string {
  return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--text-muted)';
}

const VIX_LABELS: Record<string, { label: string; color: string; hint: string }> = {
  complacency: { label: 'Complacencia', color: '#a78bfa', hint: 'VIX muy bajo — mercado ignora riesgos' },
  low_fear: { label: 'Calma', color: 'var(--positive)', hint: 'VIX normal — buen contexto de mercado' },
  elevated: { label: 'Elevado', color: '#f59e0b', hint: 'VIX alto — incertidumbre, oportunidad para DCA' },
  high_fear: { label: 'Miedo', color: '#f97316', hint: 'VIX muy alto — pánico de mercado, zona de acumulación histórica' },
  extreme_fear: { label: 'Pánico extremo', color: 'var(--negative)', hint: 'VIX extremo — capitulación, zona de compra agresiva' },
};

const REGIME_STYLES: Record<string, { label: string; color: string }> = {
  bull: { label: 'Mercado alcista', color: 'var(--positive)' },
  bear: { label: 'Mercado bajista', color: 'var(--negative)' },
  uncertain: { label: 'Mercado incierto', color: '#f59e0b' },
};

const DCA_MACRO_LABELS: Record<string, { label: string; color: string; hint: string }> = {
  favorable: { label: 'Favorable', color: 'var(--positive)', hint: 'Hay pánico o caída con tendencia sana — buen momento para DCA' },
  neutral: { label: 'Neutral', color: 'var(--text-secondary)', hint: 'Mercado tranquilo y caro — DCA normal' },
  caution: { label: 'Precaución', color: 'var(--negative)', hint: 'Mercado débil sin señales de miedo — mejor esperar confirmación' },
};

function VixGauge({ vix }: { vix: number }) {
  const clamped = Math.min(Math.max(vix, 10), 60);
  const pct = ((clamped - 10) / 50) * 100;
  const color = vix < 15 ? '#a78bfa' : vix < 20 ? 'var(--positive)' : vix < 30 ? '#f59e0b' : vix < 40 ? '#f97316' : 'var(--negative)';
  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        <span>10 (calma)</span>
        <span>60 (pánico)</span>
      </div>
      <div style={{ height: 10, background: 'var(--bg-raised)', borderRadius: 5, position: 'relative', overflow: 'visible' }}>
        <div style={{
          position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)',
          width: 16, height: 16, borderRadius: '50%', background: color,
          boxShadow: `0 0 8px ${color}`, zIndex: 1,
        }} />
        <div style={{ height: '100%', background: `linear-gradient(to right, var(--positive), #f59e0b, var(--negative))`, borderRadius: 5, opacity: 0.3 }} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 28, fontWeight: 800, fontFamily: 'var(--mono)', color }}>
        {fmt(vix, 1)}
      </div>
    </div>
  );
}

export function MacroPage() {
  const [regime, setRegime] = useState<MarketRegimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [rsTicker, setRsTicker] = useState('');
  const [rsPeriod, setRsPeriod] = useState('6mo');
  const [rs, setRs] = useState<RelativeStrengthData | null>(null);
  const [rsLoading, setRsLoading] = useState(false);
  const toast = useToast();

  const loadRegime = async () => {
    setLoading(true);
    try {
      setRegime(await getMarketRegime());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Error cargando datos macro.');
    } finally {
      setLoading(false);
    }
  };

  const checkRs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsTicker.trim()) return;
    setRsLoading(true);
    try {
      setRs(await getRelativeStrength(rsTicker.trim(), '%5EGSPC', rsPeriod));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Error cargando fuerza relativa.');
    } finally {
      setRsLoading(false);
    }
  };

  const vixInfo = regime ? VIX_LABELS[regime.vix.signal] : null;
  const regimeInfo = regime ? REGIME_STYLES[regime.regime] : null;
  const dcaInfo = regime ? DCA_MACRO_LABELS[regime.dca_macro_filter] : null;

  const sortedSectors = regime
    ? Object.entries(regime.sectors).sort((a, b) => b[1].return_1m - a[1].return_1m)
    : [];

  return (
    <>
      <PageHeader
        icon={<Globe size={22} />}
        title="Régimen de Mercado"
        subtitle="VIX, SP500, rotación sectorial y contexto macro para DCA"
      />
      <div className="page-body">
        {!regime && (
          <button className="btn btn-primary" onClick={loadRegime} disabled={loading} style={{ marginBottom: 'var(--sp-5)' }}>
            {loading ? 'Cargando datos macro…' : 'Cargar datos de mercado'}
          </button>
        )}

        {regime && (
          <>
            {/* Régimen general */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <Card>
                <Metric
                  label="Régimen actual"
                  value={regimeInfo?.label ?? '—'}
                  variant={regime.regime === 'bull' ? 'positive' : regime.regime === 'bear' ? 'negative' : 'default'}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  SP500 {regime.sp500.above_sma200 ? 'sobre' : 'bajo'} SMA200
                </div>
              </Card>
              <Card>
                <Metric
                  label="Filtro macro DCA"
                  value={dcaInfo?.label ?? '—'}
                  variant={regime.dca_macro_filter === 'favorable' ? 'positive' : regime.dca_macro_filter === 'caution' ? 'negative' : 'default'}
                />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{dcaInfo?.hint}</div>
              </Card>
              <Card>
                <div className="metrics-grid">
                  <Metric label="SP500" value={`$${fmt(regime.sp500.price, 0)}`} />
                  <Metric label="YTD" value={`${regime.sp500.return_ytd > 0 ? '+' : ''}${fmt(regime.sp500.return_ytd)}%`}
                    variant={regime.sp500.return_ytd >= 0 ? 'positive' : 'negative'} />
                  <Metric label="Último mes" value={`${regime.sp500.return_1m > 0 ? '+' : ''}${fmt(regime.sp500.return_1m)}%`}
                    variant={regime.sp500.return_1m >= 0 ? 'positive' : 'negative'} />
                  <Metric label="SMA200" value={`$${fmt(regime.sp500.sma_200, 0)}`} />
                </div>
              </Card>
            </div>

            {/* VIX */}
            <Card title="VIX — Índice de Volatilidad (Miedo/Codicia)" style={{ marginBottom: 'var(--sp-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)', alignItems: 'start' }}>
                <div>
                  <VixGauge vix={regime.vix.current} />
                  {vixInfo && (
                    <div style={{
                      textAlign: 'center', padding: 'var(--sp-2) var(--sp-3)',
                      background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)',
                      borderLeft: `3px solid ${vixInfo.color}`,
                    }}>
                      <div style={{ fontWeight: 700, color: vixInfo.color, marginBottom: 2 }}>{vixInfo.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{vixInfo.hint}</div>
                    </div>
                  )}
                </div>
                <div className="metrics-grid">
                  <Metric label="VIX actual" value={fmt(regime.vix.current, 1)} />
                  <Metric label="Promedio 52 sem." value={fmt(regime.vix.avg_52w, 1)} />
                  <Metric label="Mediana 52 sem." value={fmt(regime.vix.median_52w, 1)} />
                  <Metric label="vs Promedio" value={`${regime.vix.vs_avg_pct > 0 ? '+' : ''}${fmt(regime.vix.vs_avg_pct)}%`}
                    variant={regime.vix.vs_avg_pct > 20 ? 'positive' : regime.vix.vs_avg_pct < -20 ? 'negative' : 'default'} />
                </div>
              </div>
            </Card>

            {/* Rotación sectorial */}
            {sortedSectors.length > 0 && (
              <Card title="Rotación Sectorial (SP500)" style={{ marginBottom: 'var(--sp-5)' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>Sector</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>ETF</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>1 mes</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 500 }}>3 meses</th>
                        <th style={{ padding: '6px 8px' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSectors.map(([name, data]) => (
                        <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{name}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>{data.etf}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--mono)', color: pctColor(data.return_1m) }}>
                            {data.return_1m > 0 ? '+' : ''}{fmt(data.return_1m)}%
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'var(--mono)', color: pctColor(data.return_3m) }}>
                            {data.return_3m > 0 ? '+' : ''}{fmt(data.return_3m)}%
                          </td>
                          <td style={{ padding: '8px', width: 80 }}>
                            <div style={{ height: 6, background: 'var(--bg-raised)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${Math.min(Math.abs(data.return_1m) * 4, 100)}%`,
                                background: data.return_1m >= 0 ? 'var(--positive)' : 'var(--negative)',
                                marginLeft: data.return_1m < 0 ? 'auto' : undefined,
                                borderRadius: 3,
                              }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            <button
              className="btn"
              onClick={loadRegime}
              disabled={loading}
              style={{ fontSize: 12, marginBottom: 'var(--sp-5)' }}
            >
              {loading ? 'Actualizando…' : 'Actualizar datos'}
            </button>
          </>
        )}

        {/* Fuerza relativa */}
        <Card title="Fuerza Relativa vs SP500" style={{ marginBottom: 'var(--sp-5)' }}>
          <form onSubmit={checkRs} style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <TickerInput
              placeholder="Ticker (ej: AAPL)"
              value={rsTicker}
              onChange={setRsTicker}
              style={{ minWidth: 120, height: 36, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}
            />
            <select
              value={rsPeriod}
              onChange={e => setRsPeriod(e.target.value)}
              style={{ height: 36, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            >
              <option value="1mo">1 mes</option>
              <option value="3mo">3 meses</option>
              <option value="6mo">6 meses</option>
              <option value="1y">1 año</option>
            </select>
            <button className="btn btn-primary" type="submit" disabled={rsLoading} style={{ fontSize: 13, padding: '0 var(--sp-4)' }}>
              {rsLoading ? 'Calculando…' : 'Calcular'}
            </button>
          </form>
          {rs && (
            <div className="metrics-grid">
              <Metric label={rs.ticker} value={`${rs.ticker_return_pct > 0 ? '+' : ''}${fmt(rs.ticker_return_pct)}%`}
                variant={rs.ticker_return_pct >= 0 ? 'positive' : 'negative'} />
              <Metric label="SP500" value={`${rs.benchmark_return_pct > 0 ? '+' : ''}${fmt(rs.benchmark_return_pct)}%`}
                variant={rs.benchmark_return_pct >= 0 ? 'positive' : 'negative'} />
              <Metric label="Alpha" value={`${rs.alpha_pct > 0 ? '+' : ''}${fmt(rs.alpha_pct)}%`}
                variant={rs.alpha_pct > 0 ? 'positive' : rs.alpha_pct < 0 ? 'negative' : 'default'} />
              <Metric label="¿Supera al índice?" value={rs.outperforming ? 'Sí' : 'No'}
                variant={rs.outperforming ? 'positive' : 'negative'} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
