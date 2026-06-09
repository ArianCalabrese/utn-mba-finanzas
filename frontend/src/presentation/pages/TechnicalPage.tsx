import { useState } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  getIndicators, getSignals, getConviction,
  type TechnicalIndicators, type TechnicalSignals, type ConvictionResult,
} from '@/application/api/technical';
import { PageHeader, Card, Metric, Tabs } from '@/presentation/components/ui';
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
    deep_oversold: 'var(--positive)',
    near_oversold: 'var(--positive)',
    strong_trend: 'var(--accent)',
    undervalued: 'var(--positive)',
    discount: 'var(--positive)',
    deep_discount: 'var(--positive)',
    earnings_growth: 'var(--positive)',
    bearish: 'var(--negative)',
    overbought: 'var(--negative)',
    overvalued: 'var(--negative)',
    near_ath: 'var(--negative)',
    earnings_decline: 'var(--negative)',
    neutral: 'var(--text-muted)',
    weak_trend: 'var(--text-muted)',
    fair: 'var(--text-muted)',
    stable: 'var(--text-muted)',
    squeeze: 'var(--accent)',
    low_vol: 'var(--text-muted)',
  };
  const labels: Record<string, string> = {
    deep_oversold: 'muy sobrevendido',
    near_oversold: 'cerca sobrevendido',
    strong_trend: 'tendencia fuerte',
    weak_trend: 'tendencia débil',
    undervalued: 'subvalorado',
    overvalued: 'sobrevalorado',
    deep_discount: 'descuento fuerte',
    discount: 'descuento',
    near_ath: 'cerca de máx.',
    earnings_growth: 'crecimiento EPS',
    earnings_decline: 'caída EPS',
    low_vol: 'baja volatilidad',
    squeeze: 'squeeze',
  };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.05em', color: colors[signal] ?? 'var(--text-muted)',
      background: 'var(--bg-base)', padding: '2px 8px', borderRadius: 100,
    }}>
      {labels[signal] ?? signal}
    </span>
  );
}

// ── Conviction score gauge ────────────────────────────────────────────────────

const VERDICT_COLORS: Record<string, string> = {
  STRONG_BUY: 'var(--positive)',
  BUY: '#4ade80',
  HOLD: 'var(--text-muted)',
  REDUCE: '#f97316',
  STRONG_REDUCE: 'var(--negative)',
};

const VERDICT_LABELS: Record<string, string> = {
  STRONG_BUY: 'Compra Fuerte',
  BUY: 'Compra',
  HOLD: 'Mantener',
  REDUCE: 'Reducir',
  STRONG_REDUCE: 'Reducir Fuerte',
};

const DCA_LABELS: Record<string, { label: string; color: string }> = {
  ACCUMULATE: { label: 'Acumular — aumentá la cuota', color: 'var(--positive)' },
  NORMAL: { label: 'Normal — cuota estándar', color: 'var(--text-secondary)' },
  PAUSE: { label: 'Pausar — esperá mejor precio', color: 'var(--negative)' },
};

function ConvictionGauge({ score }: { score: number }) {
  const color = score >= 65 ? 'var(--positive)' : score >= 42 ? '#f59e0b' : 'var(--negative)';
  const pct = `${score}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: `conic-gradient(${color} ${pct}, var(--bg-raised) 0)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
           <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{score}</span>
         <span style={{ fontSize: 10,  color: 'var(--text-primary)'}}>/100</span>
        </div>
      </div>
    </div>
  );
}

function LayerBar({ label, score, weight }: { label: string; score: number | null; weight: number }) {
  if (score === null) return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sin datos ({(weight * 100).toFixed(0)}%)</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-raised)', borderRadius: 3 }} />
    </div>
  );
  const color = score >= 65 ? 'var(--positive)' : score >= 42 ? '#f59e0b' : 'var(--negative)';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ color, fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {score.toFixed(1)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({(weight * 100).toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-raised)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Help content ──────────────────────────────────────────────────────────────

type HelpKey = 'rsi' | 'macd' | 'bb' | 'sma' | 'atr' | 'stoch' | 'signals' | 'adx' | 'zscore' | 'conviction';

const HELP: Record<HelpKey, { title: string; content: React.ReactNode }> = {
  signals: {
    title: 'Resumen de señales',
    content: (
      <>
        <HelpSection title="¿Qué muestra?">
          <p>Consolida las señales de los principales indicadores técnicos. Cada indicador emite una señal individual y el sistema genera un veredicto global por mayoría.</p>
        </HelpSection>
        <HelpSection title="Señales posibles">
          <p><strong style={{ color: 'var(--positive)' }}>Bullish / Oversold</strong>: momentum alcista o activo sobrevendido.<br />
          <strong style={{ color: 'var(--negative)' }}>Bearish / Overbought</strong>: momentum bajista o activo sobrecomprado.<br />
          <strong style={{ color: 'var(--text-muted)' }}>Neutral</strong>: sin señal clara.</p>
        </HelpSection>
      </>
    ),
  },
  rsi: {
    title: 'RSI — Relative Strength Index',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Oscilador de momento (0-100) que mide velocidad y magnitud de cambios de precio.</p>
        </HelpSection>
        <HelpSection title="Fórmula">
          <HelpFormula>RSI = 100 − (100 / (1 + RS))<br />RS = Ganancia promedio (14 días) / Pérdida promedio (14 días)</HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>{'< 30'}</strong> — Sobrevendido: posible rebote.<br />
          <strong style={{ color: 'var(--negative)' }}>{'> 70'}</strong> — Sobrecomprado: posible corrección.</p>
        </HelpSection>
      </>
    ),
  },
  macd: {
    title: 'MACD — Moving Average Convergence Divergence',
    content: (
      <>
        <HelpSection title="Componentes">
          <HelpFormula>
            Línea MACD = EMA(12) − EMA(26)<br />
            Señal = EMA(9) de la línea MACD<br />
            Histograma = MACD − Señal
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>Histograma {'>'} 0</strong>: momentum alcista.<br />
          <strong style={{ color: 'var(--negative)' }}>Histograma {'<'} 0</strong>: momentum bajista.</p>
        </HelpSection>
      </>
    ),
  },
  bb: {
    title: 'Bollinger Bands (20, 2σ)',
    content: (
      <>
        <HelpSection title="Fórmula">
          <HelpFormula>
            Superior = SMA(20) + 2σ | Inferior = SMA(20) − 2σ
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Squeeze">
          <p>Cuando el bandwidth está en su mínimo histórico, se detecta un <strong>Squeeze</strong>: el mercado está comprimido y se espera una expansión de volatilidad inminente. No indica dirección.</p>
        </HelpSection>
      </>
    ),
  },
  sma: {
    title: 'Medias Móviles (SMA / EMA)',
    content: (
      <>
        <HelpSection title="Señales clave">
          <p><strong style={{ color: 'var(--positive)' }}>Golden Cross</strong>: SMA(50) cruza hacia arriba SMA(200) → alcista de largo plazo.<br />
          <strong style={{ color: 'var(--negative)' }}>Death Cross</strong>: SMA(50) cruza hacia abajo SMA(200) → bajista.<br />
          Precio por encima de SMA(200) = tendencia alcista general.</p>
        </HelpSection>
      </>
    ),
  },
  atr: {
    title: 'ATR — Average True Range',
    content: (
      <>
        <HelpSection title="Uso práctico">
          <p>Mide volatilidad. Útil para dimensionar stops: Stop = precio ± 2×ATR.<br />
          ATR alto → mercado volátil → stops más amplios necesarios.</p>
        </HelpSection>
      </>
    ),
  },
  stoch: {
    title: 'Oscilador Estocástico (%K / %D)',
    content: (
      <>
        <HelpSection title="Fórmula">
          <HelpFormula>
            %K = (Cierre − Mínimo 14p) / (Máximo 14p − Mínimo 14p) × 100<br />
            %D = SMA(3) de %K
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>%K {'<'} 20</strong>: sobrevendido.<br />
          <strong style={{ color: 'var(--negative)' }}>%K {'>'} 80</strong>: sobrecomprado.</p>
        </HelpSection>
      </>
    ),
  },
  adx: {
    title: 'ADX — Average Directional Index',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Mide la <strong>fuerza</strong> de la tendencia, no la dirección. Va de 0 a 100.</p>
        </HelpSection>
        <HelpSection title="Componentes">
          <p><strong>+DI</strong>: presión compradora. <strong>-DI</strong>: presión vendedora.<br />
          Si +DI {'>'} -DI → tendencia alcista; si -DI {'>'} +DI → tendencia bajista.</p>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--accent)' }}>ADX {'>'} 25</strong>: tendencia fuerte → señales de momentum son más confiables.<br />
          <strong style={{ color: 'var(--text-muted)' }}>ADX {'<'} 20</strong>: mercado en rango → usá estrategias de reversión a la media, no de seguimiento.</p>
        </HelpSection>
      </>
    ),
  },
  zscore: {
    title: 'Z-Score vs SMA200',
    content: (
      <>
        <HelpSection title="¿Qué mide?">
          <p>Cuántas desviaciones estándar está el precio por encima/debajo de su SMA(200). Ideal para DCA: mide si el precio está "estadísticamente barato o caro".</p>
        </HelpSection>
        <HelpSection title="Fórmula">
          <HelpFormula>Z = (Precio − SMA200) / σ(200)</HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p><strong style={{ color: 'var(--positive)' }}>Z {'<'} −1.5</strong>: precio muy por debajo de la media → zona de acumulación histórica.<br />
          <strong style={{ color: 'var(--negative)' }}>Z {'>'} 2</strong>: precio muy por encima → sobreextendido, posible corrección.<br />
          Valores entre −1 y +1 son normales.</p>
        </HelpSection>
      </>
    ),
  },
  conviction: {
    title: 'Conviction Score',
    content: (
      <>
        <HelpSection title="¿Qué es?">
          <p>Un score de 0 a 100 que combina múltiples capas de análisis en un solo número. Cuanto más alto, más señales independientes coinciden en que el activo está en zona de compra.</p>
        </HelpSection>
        <HelpSection title="Capas y pesos">
          <p><strong>Tendencia (30%)</strong>: precio vs SMA200, golden cross, ADX, Z-score.<br />
          <strong>Momentum (25%)</strong>: RSI, MACD histograma, Estocástico.<br />
          <strong>Valuación (25%)</strong>: DCF margen de seguridad, drawdown desde ATH, P/E relativo.<br />
          <strong>Volatilidad (20%)</strong>: Bollinger squeeze, bandwidth.</p>
        </HelpSection>
        <HelpSection title="Señal DCA">
          <p><strong style={{ color: 'var(--positive)' }}>Acumular</strong>: score alto o caída severa con momentum no agotado → aumentá la cuota.<br />
          <strong>Normal</strong>: condiciones promedio → cuota estándar.<br />
          <strong style={{ color: 'var(--negative)' }}>Pausar</strong>: sobrecomprado o score muy bajo → esperá mejor precio.</p>
        </HelpSection>
      </>
    ),
  },
};

// ── Main component ────────────────────────────────────────────────────────────

export function TechnicalPage() {
  const [ticker, setTicker] = useState('');
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [signals, setSignals] = useState<TechnicalSignals | null>(null);
  const [conviction, setConviction] = useState<ConvictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHelp, setOpenHelp] = useState<HelpKey | null>(null);
  const [tab, setTab] = useState('indicadores');

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setIndicators(null);
    setSignals(null);
    setConviction(null);
    try {
      const [ind, sig, conv] = await Promise.all([
        getIndicators(ticker.trim()),
        getSignals(ticker.trim()),
        getConviction(ticker.trim()),
      ]);
      setIndicators(ind);
      setSignals(sig);
      setConviction(conv);
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
        subtitle="Indicadores, señales y conviction score"
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

        {(indicators || signals || conviction) && (
          <Tabs
            tabs={[
              { id: 'indicadores', label: 'Indicadores' },
              { id: 'conviction', label: 'Conviction Score' },
            ]}
            active={tab}
            onChange={setTab}
          />
        )}

        {/* ── Tab: Indicadores ── */}
        {tab === 'indicadores' && (
          <>
            {signals && (
              <Card title="Resumen de señales" style={{ margin: 'var(--sp-4) 0' }} onHelp={() => setOpenHelp('signals')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center', marginBottom: 'var(--sp-4)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Señal global:</span>
                  <SignalBadge signal={signals.signals.summary.overall} />
                  <span style={{ fontSize: 12, color: 'var(--positive)' }}>{signals.signals.summary.bullish_signals} alcistas</span>
                  <span style={{ fontSize: 12, color: 'var(--negative)' }}>{signals.signals.summary.bearish_signals} bajistas</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--sp-3)' }}>
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
                      <div style={{ fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 4 }}>
                        {signals.signals.moving_averages.golden_cross ? 'Golden cross' : 'Death cross'}
                      </div>
                      <SignalBadge signal={signals.signals.moving_averages.signal} />
                    </div>
                  )}
                  {signals.signals.bollinger && (
                    <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bollinger</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 4 }}>
                        BW: {fmt(signals.signals.bollinger.bandwidth_pct)}%
                        {signals.signals.bollinger.squeeze && <span style={{ marginLeft: 4, color: 'var(--accent)', fontWeight: 700 }}>⚡</span>}
                      </div>
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
                  {signals.signals.adx && (
                    <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ADX (14)</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(signals.signals.adx.value)}</div>
                      <SignalBadge signal={signals.signals.adx.signal} />
                    </div>
                  )}
                  {signals.signals.z_score && (
                    <div style={{ background: 'var(--bg-raised)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Z-Score</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(signals.signals.z_score.value, 2)}</div>
                      <SignalBadge signal={signals.signals.z_score.signal} />
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
                  <Metric label="ADX (14)" value={fmt(indicators.adx_14?.adx)}
                    variant={indicators.adx_14?.adx ? (indicators.adx_14.adx > 25 ? 'accent' : 'default') : 'default'} />
                  <Metric label="Z-Score vs SMA200" value={fmt(indicators.z_score_200, 2)}
                    variant={indicators.z_score_200 !== null ? (indicators.z_score_200 < -1.5 ? 'positive' : indicators.z_score_200 > 2 ? 'negative' : 'default') : 'default'} />
                  <Metric label="Drawdown vs ATH" value={indicators.drawdown_from_ath != null ? `${fmt(indicators.drawdown_from_ath)}%` : '—'}
                    variant={indicators.drawdown_from_ath !== null ? (indicators.drawdown_from_ath < -20 ? 'positive' : 'default') : 'default'} />
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

                  <Card title="ADX (14)" onHelp={() => setOpenHelp('adx')}>
                    <div className="metrics-grid">
                      <Metric label="ADX" value={fmt(indicators.adx_14?.adx)}
                        variant={indicators.adx_14?.adx ? (indicators.adx_14.adx > 25 ? 'accent' : 'default') : 'default'} />
                      <Metric label="+DI" value={fmt(indicators.adx_14?.plus_di)} variant="positive" />
                      <Metric label="-DI" value={fmt(indicators.adx_14?.minus_di)} variant="negative" />
                      <Metric label="Tendencia" value={indicators.adx_14?.trend_strength === 'strong' ? 'Fuerte' : 'Débil'} />
                    </div>
                  </Card>

                  <Card title="Z-Score vs SMA200" onHelp={() => setOpenHelp('zscore')}>
                    <div className="metrics-grid">
                      <Metric label="Z-Score" value={fmt(indicators.z_score_200, 2)}
                        variant={indicators.z_score_200 !== null ? (indicators.z_score_200 < -1.5 ? 'positive' : indicators.z_score_200 > 2 ? 'negative' : 'default') : 'default'} />
                      <Metric label="Zona" value={
                        indicators.z_score_200 == null ? '—'
                        : indicators.z_score_200 < -2 ? 'Muy sobrevendido'
                        : indicators.z_score_200 < -1 ? 'Sobrevendido'
                        : indicators.z_score_200 > 2 ? 'Sobrecomprado'
                        : 'Normal'
                      } />
                      <Metric label="Drawdown ATH" value={indicators.drawdown_from_ath != null ? `${fmt(indicators.drawdown_from_ath)}%` : '—'}
                        variant={indicators.drawdown_from_ath !== null ? (indicators.drawdown_from_ath < -20 ? 'positive' : 'default') : 'default'} />
                    </div>
                  </Card>

                  <Card title="Bollinger Bands (20, 2σ)" onHelp={() => setOpenHelp('bb')}>
                    <div className="metrics-grid">
                      <Metric label="Superior" value={fmt(indicators.bollinger_bands.upper)} />
                      <Metric label="Media (SMA20)" value={fmt(indicators.bollinger_bands.mid)} />
                      <Metric label="Inferior" value={fmt(indicators.bollinger_bands.lower)} />
                      <Metric label="Bandwidth %" value={fmt(indicators.bollinger_bands.bandwidth_pct)} />
                      <Metric label="Squeeze" value={indicators.bollinger_bands.squeeze ? 'Sí ⚡' : 'No'}
                        variant={indicators.bollinger_bands.squeeze ? 'accent' : 'default'} />
                    </div>
                  </Card>

                  <Card title="ATR (14)" onHelp={() => setOpenHelp('atr')}>
                    <div className="metrics-grid">
                      <Metric label="ATR" value={fmt(indicators.atr_14)} />
                      <Metric label="Stop sugerido (2×ATR)" value={indicators.atr_14 && indicators.current_price ? `±${fmt(indicators.atr_14 * 2)}` : '—'} />
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
          </>
        )}

        {/* ── Tab: Conviction Score ── */}
        {tab === 'conviction' && conviction && (
          <div style={{ marginTop: 'var(--sp-5)' }}>
            <Card title="Conviction Score" onHelp={() => setOpenHelp('conviction')} style={{ marginBottom: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 140 }}>
                  <ConvictionGauge score={conviction.conviction.score} />
                  <div style={{
                    fontSize: 15, fontWeight: 700,
                    color: VERDICT_COLORS[conviction.conviction.verdict],
                  }}>
                    {VERDICT_LABELS[conviction.conviction.verdict]}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ marginBottom: 'var(--sp-4)', padding: 'var(--sp-3)', background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${DCA_LABELS[conviction.conviction.dca_signal].color}` }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Señal DCA</div>
                    <div style={{ fontWeight: 600, color: DCA_LABELS[conviction.conviction.dca_signal].color }}>
                      {DCA_LABELS[conviction.conviction.dca_signal].label}
                    </div>
                  </div>
                  <LayerBar label="Tendencia" score={conviction.conviction.layers.trend.score} weight={conviction.conviction.layers.trend.weight} />
                  <LayerBar label="Momentum" score={conviction.conviction.layers.momentum.score} weight={conviction.conviction.layers.momentum.weight} />
                  <LayerBar label="Valuación" score={conviction.conviction.layers.valuation.available !== false ? conviction.conviction.layers.valuation.score : null} weight={conviction.conviction.layers.valuation.weight} />
                  <LayerBar label="Volatilidad" score={conviction.conviction.layers.volatility.available !== false ? conviction.conviction.layers.volatility.score : null} weight={conviction.conviction.layers.volatility.weight} />
                </div>
              </div>
            </Card>

            {/* Layer detail cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--sp-4)' }}>
              {(['trend', 'momentum', 'valuation', 'volatility'] as const).map((key) => {
                const layer = conviction.conviction.layers[key];
                const layerLabels = { trend: 'Tendencia', momentum: 'Momentum', valuation: 'Valuación', volatility: 'Volatilidad' };
                if (!layer.signals.length) return null;
                return (
                  <Card key={key} title={`${layerLabels[key]} — ${layer.score?.toFixed(1) ?? 'N/A'}/100`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {layer.signals.map((sig, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{sig.name}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {sig.value !== undefined && (
                              <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>{sig.value}</span>
                            )}
                            <SignalBadge signal={sig.signal} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
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
