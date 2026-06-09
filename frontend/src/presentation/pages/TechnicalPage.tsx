import { useState } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import { getIndicators, getSignals, type TechnicalIndicators, type TechnicalSignals } from '@/application/api/technical';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { HelpModal, HelpSection, HelpFormula } from '@/presentation/components/HelpModal';
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
    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors[signal] ?? 'var(--text-muted)', background: 'var(--bg-base)', padding: '2px 8px', borderRadius: 100 }}>
      {signal}
    </span>
  );
}

type HelpKey = 'rsi' | 'macd' | 'bb' | 'sma' | 'atr' | 'stoch';

const HELP: Record<HelpKey, { title: string; content: React.ReactNode }> = {
  rsi: {
    title: 'RSI — Relative Strength Index',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Oscilador de momento que mide la velocidad y magnitud de los cambios de precio recientes. Va de 0 a 100.</p>
        </HelpSection>
        <HelpSection title="Fórmula">
          <HelpFormula>RSI = 100 − (100 / (1 + RS))<br />RS = Ganancia promedio (14 días) / Pérdida promedio (14 días)</HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>{'< 30 — Sobrevendido'}</strong>: el activo puede estar barato; posible rebote.<br />
          <strong style={{ color: 'var(--negative)' }}>{'> 70 — Sobrecomprado'}</strong>: el activo puede estar caro; posible corrección.<br />
          Entre 30 y 70 se considera zona neutral.</p>
        </HelpSection>
      </>
    ),
  },
  macd: {
    title: 'MACD — Moving Average Convergence Divergence',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Indica la relación entre dos medias móviles exponenciales del precio. Útil para detectar cambios de tendencia.</p>
        </HelpSection>
        <HelpSection title="Componentes">
          <HelpFormula>
            Línea MACD = EMA(12) − EMA(26)<br />
            Señal = EMA(9) de la línea MACD<br />
            Histograma = MACD − Señal
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>Histograma {'>'} 0</strong>: momentum alcista.<br />
          <strong style={{ color: 'var(--negative)' }}>Histograma {'<'} 0</strong>: momentum bajista.<br />
          El cruce de MACD sobre la señal es señal de entrada/salida.</p>
        </HelpSection>
      </>
    ),
  },
  bb: {
    title: 'Bollinger Bands (20, 2σ)',
    content: (
      <>
        <HelpSection title="¿Qué miden?">
          <p>Bandas de volatilidad alrededor de una media móvil. Se ensanchan cuando el mercado es volátil y se contraen en calma.</p>
        </HelpSection>
        <HelpSection title="Fórmula">
          <HelpFormula>
            Banda superior = SMA(20) + 2 × σ(20)<br />
            Banda media = SMA(20)<br />
            Banda inferior = SMA(20) − 2 × σ(20)
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p>Precio tocando banda superior → sobrecomprado.<br />
          Precio tocando banda inferior → sobrevendido.<br />
          <strong>Bandwidth %</strong>: mide el ancho relativo de las bandas. Valores bajos indican baja volatilidad (posible expansión inminente).</p>
        </HelpSection>
      </>
    ),
  },
  sma: {
    title: 'Medias Móviles (SMA / EMA)',
    content: (
      <>
        <HelpSection title="SMA — Simple Moving Average">
          <HelpFormula>SMA(n) = Promedio de los últimos n precios de cierre</HelpFormula>
          <p>Suaviza el ruido del precio. Las más usadas: 20 (corto), 50 (medio), 200 (largo plazo).</p>
        </HelpSection>
        <HelpSection title="EMA — Exponential Moving Average">
          <p>Da más peso a los precios recientes. Reacciona más rápido a los cambios.</p>
        </HelpSection>
        <HelpSection title="Señales clave">
          <p><strong style={{ color: 'var(--positive)' }}>Golden Cross</strong>: SMA(50) cruza hacia arriba la SMA(200) → señal alcista de largo plazo.<br />
          <strong style={{ color: 'var(--negative)' }}>Death Cross</strong>: SMA(50) cruza hacia abajo la SMA(200) → señal bajista.<br />
          Precio por encima de SMA(200) = tendencia alcista general.</p>
        </HelpSection>
      </>
    ),
  },
  atr: {
    title: 'ATR — Average True Range',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Mide la volatilidad del mercado como el rango promedio de movimiento en los últimos 14 períodos. No indica dirección.</p>
        </HelpSection>
        <HelpSection title="Fórmula">
          <HelpFormula>
            True Range = max(High−Low, |High−Close anterior|, |Low−Close anterior|)<br />
            ATR(14) = Media móvil de 14 períodos del True Range
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Uso práctico">
          <p>ATR alto → mercado volátil → stops más amplios necesarios.<br />
          ATR bajo → mercado tranquilo → stops más ajustados son válidos.<br />
          Útil para dimensionar posiciones: Stop = precio ± N × ATR.</p>
        </HelpSection>
      </>
    ),
  },
  stoch: {
    title: 'Oscilador Estocástico (%K / %D)',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Compara el precio de cierre actual con el rango de precios de los últimos 14 períodos. Va de 0 a 100.</p>
        </HelpSection>
        <HelpSection title="Fórmula">
          <HelpFormula>
            %K = (Cierre − Mínimo 14p) / (Máximo 14p − Mínimo 14p) × 100<br />
            %D = SMA(3) de %K
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>%K {'<'} 20 — Sobrevendido</strong>: posible rebote.<br />
          <strong style={{ color: 'var(--negative)' }}>%K {'>'} 80 — Sobrecomprado</strong>: posible corrección.<br />
          El cruce de %K sobre %D en zona sobrevendida es señal de compra.</p>
        </HelpSection>
      </>
    ),
  },
};

export function TechnicalPage() {
  const [ticker, setTicker] = useState('');
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [signals, setSignals] = useState<TechnicalSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHelp, setOpenHelp] = useState<HelpKey | null>(null);

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

  const helpInfo = openHelp ? HELP[openHelp] : null;

  return (
    <>
      <PageHeader
        icon={<LineChartIcon size={22} />}
        title="Análisis Técnico"
        subtitle="Indicadores calculados sobre el historial de precios"
      />
      <div className="page-body">
        <form onSubmit={search} style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--sp-3)' }}>
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
              <Metric label="RSI (14)" value={fmt(indicators.rsi_14)}
                variant={indicators.rsi_14 !== null ? (indicators.rsi_14 < 30 ? 'positive' : indicators.rsi_14 > 70 ? 'negative' : 'default') : 'default'} />
              <Metric label="ATR (14)" value={fmt(indicators.atr_14)} />
              <Metric label="Stoch %K" value={fmt(indicators.stochastic.k)} />
              <Metric label="Stoch %D" value={fmt(indicators.stochastic.d)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
              <Card title="MACD" onHelp={() => setOpenHelp('macd')}>
                <div className="metrics-grid">
                  <Metric label="MACD" value={fmt(indicators.macd.macd, 4)} />
                  <Metric label="Señal" value={fmt(indicators.macd.signal, 4)} />
                  <Metric label="Histograma" value={fmt(indicators.macd.histogram, 4)}
                    variant={indicators.macd.histogram !== null ? (indicators.macd.histogram > 0 ? 'positive' : 'negative') : 'default'} />
                </div>
              </Card>

              <Card title="Bollinger Bands (20, 2σ)" onHelp={() => setOpenHelp('bb')}>
                <div className="metrics-grid">
                  <Metric label="Superior" value={fmt(indicators.bollinger_bands.upper)} />
                  <Metric label="Media (SMA20)" value={fmt(indicators.bollinger_bands.mid)} />
                  <Metric label="Inferior" value={fmt(indicators.bollinger_bands.lower)} />
                  <Metric label="Bandwidth %" value={fmt(indicators.bollinger_bands.bandwidth_pct)} />
                </div>
              </Card>

              <Card title="ATR (14)" onHelp={() => setOpenHelp('atr')}>
                <div className="metrics-grid">
                  <Metric label="ATR" value={fmt(indicators.atr_14)} />
                  <Metric label="Stop sugerido (2×ATR)" value={indicators.atr_14 && indicators.current_price
                    ? `±${fmt(indicators.atr_14 * 2)}`
                    : '—'} />
                </div>
              </Card>

              <Card title="Medias Móviles" onHelp={() => setOpenHelp('sma')}>
                <div className="metrics-grid">
                  <Metric label="SMA 20" value={fmt(indicators.moving_averages.sma_20)} />
                  <Metric label="SMA 50" value={fmt(indicators.moving_averages.sma_50)} />
                  <Metric label="SMA 200" value={fmt(indicators.moving_averages.sma_200)} />
                  <Metric label="EMA 12" value={fmt(indicators.moving_averages.ema_12)} />
                  <Metric label="EMA 26" value={fmt(indicators.moving_averages.ema_26)} />
                </div>
              </Card>

              <Card title="Estocástico (%K / %D)" onHelp={() => setOpenHelp('stoch')}>
                <div className="metrics-grid">
                  <Metric label="%K" value={fmt(indicators.stochastic.k)}
                    variant={indicators.stochastic.k !== null ? (indicators.stochastic.k < 20 ? 'positive' : indicators.stochastic.k > 80 ? 'negative' : 'default') : 'default'} />
                  <Metric label="%D" value={fmt(indicators.stochastic.d)} />
                </div>
              </Card>

              <Card title="RSI (14)" onHelp={() => setOpenHelp('rsi')}>
                <div className="metrics-grid">
                  <Metric label="RSI" value={fmt(indicators.rsi_14)}
                    variant={indicators.rsi_14 !== null ? (indicators.rsi_14 < 30 ? 'positive' : indicators.rsi_14 > 70 ? 'negative' : 'default') : 'default'} />
                  <Metric label="Zona" value={
                    indicators.rsi_14 == null ? '—'
                    : indicators.rsi_14 < 30 ? 'Sobrevendido'
                    : indicators.rsi_14 > 70 ? 'Sobrecomprado'
                    : 'Neutral'
                  } />
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {helpInfo && (
        <HelpModal title={helpInfo.title} onClose={() => setOpenHelp(null)}>
          {helpInfo.content}
        </HelpModal>
      )}
    </>
  );
}

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
