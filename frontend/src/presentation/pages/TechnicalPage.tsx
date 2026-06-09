import { useState } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import { getIndicators, getSignals, type TechnicalIndicators, type TechnicalSignals } from '@/application/api/technical';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';

function fmt(n: number | null | undefined, dec = 2): string {
  return n == null ? '—' : n.toFixed(dec);
}

type SignalStr = string | undefined;

function SignalBadge({ signal }: { signal: SignalStr }) {
  if (!signal) return null;
  const colors: Record<string, string> = {
    bullish: 'var(--positive)',
    oversold: 'var(--positive)',
    bearish: 'var(--negative)',
    overbought: 'var(--negative)',
    neutral: 'var(--text-muted)',
  };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors[signal] ?? 'var(--text-muted)', background: 'var(--bg-raised)', padding: '2px 8px', borderRadius: 100 }}>
      {signal}
    </span>
  );
}

export function TechnicalPage() {
  const [ticker, setTicker] = useState('');
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [signals, setSignals] = useState<TechnicalSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setIndicators(null);
    setSignals(null);
    try {
      const [ind, sig] = await Promise.all([
        getIndicators(ticker.trim()),
        getSignals(ticker.trim()),
      ]);
      setIndicators(ind);
      setSignals(sig);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<LineChartIcon size={22} />}
        title="Análisis Técnico"
        subtitle="Indicadores calculados sobre el historial de precios"
      />
      <div className="page-body">
        <form onSubmit={search} style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
          <input
            placeholder="Ticker (ej: AAPL)"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            style={{ flex: 1, height: 40, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Calculando…' : 'Analizar'}
          </button>
        </form>

        {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>{error}</p>}

        {signals && (
          <Card title="Resumen de señales" style={{ marginBottom: 'var(--sp-5)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Señal global:</span>
              <SignalBadge signal={signals.signals.summary.overall} />
              <span style={{ fontSize: 12, color: 'var(--positive)' }}>{signals.signals.summary.bullish_signals} alcistas</span>
              <span style={{ fontSize: 12, color: 'var(--negative)' }}>{signals.signals.summary.bearish_signals} bajistas</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--sp-3)' }}>
              {signals.signals.rsi && (
                <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>RSI (14)</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(signals.signals.rsi.value)}</div>
                  <SignalBadge signal={signals.signals.rsi.signal} />
                </div>
              )}
              {signals.signals.macd && (
                <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MACD</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(signals.signals.macd.value)}</div>
                  <SignalBadge signal={signals.signals.macd.signal} />
                </div>
              )}
              {signals.signals.moving_averages && (
                <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Medias Móviles</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--mono)', marginBottom: 4 }}>
                    {signals.signals.moving_averages.golden_cross ? 'Golden cross' : 'Death cross'}
                  </div>
                  <SignalBadge signal={signals.signals.moving_averages.signal} />
                </div>
              )}
              {signals.signals.bollinger && (
                <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bollinger Bands</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--mono)', marginBottom: 4 }}>BW: {fmt(signals.signals.bollinger.bandwidth_pct)}%</div>
                  <SignalBadge signal={signals.signals.bollinger.signal} />
                </div>
              )}
              {signals.signals.stochastic && (
                <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estocástico</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>%K {fmt(signals.signals.stochastic.k)}</div>
                  <SignalBadge signal={signals.signals.stochastic.signal} />
                </div>
              )}
            </div>
          </Card>
        )}

        {indicators && (
          <>
            <div className="metrics-grid" style={{ marginBottom: 'var(--sp-5)' }}>
              <Metric label="Precio actual" value={fmt(indicators.current_price)} />
              <Metric label="RSI (14)" value={fmt(indicators.rsi_14)} variant={indicators.rsi_14 !== null ? (indicators.rsi_14 < 30 ? 'positive' : indicators.rsi_14 > 70 ? 'negative' : 'default') : 'default'} />
              <Metric label="ATR (14)" value={fmt(indicators.atr_14)} />
              <Metric label="Stoch %K" value={fmt(indicators.stochastic.k)} />
              <Metric label="Stoch %D" value={fmt(indicators.stochastic.d)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <Card title="MACD">
                <Metric label="MACD" value={fmt(indicators.macd.macd, 4)} />
                <Metric label="Signal" value={fmt(indicators.macd.signal, 4)} />
                <Metric label="Histogram" value={fmt(indicators.macd.histogram, 4)} variant={indicators.macd.histogram !== null ? (indicators.macd.histogram > 0 ? 'positive' : 'negative') : 'default'} />
              </Card>
              <Card title="Bollinger Bands (20, 2σ)">
                <Metric label="Upper" value={fmt(indicators.bollinger_bands.upper)} />
                <Metric label="Mid (SMA20)" value={fmt(indicators.bollinger_bands.mid)} />
                <Metric label="Lower" value={fmt(indicators.bollinger_bands.lower)} />
                <Metric label="BW %" value={fmt(indicators.bollinger_bands.bandwidth_pct)} />
              </Card>
              <Card title="Medias móviles">
                <Metric label="SMA 20" value={fmt(indicators.moving_averages.sma_20)} />
                <Metric label="SMA 50" value={fmt(indicators.moving_averages.sma_50)} />
                <Metric label="SMA 200" value={fmt(indicators.moving_averages.sma_200)} />
                <Metric label="EMA 12" value={fmt(indicators.moving_averages.ema_12)} />
                <Metric label="EMA 26" value={fmt(indicators.moving_averages.ema_26)} />
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
