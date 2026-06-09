import { useState } from 'react';
import { Search } from 'lucide-react';
import { getQuote, type Quote } from '@/application/api/market';
import { getHistory } from '@/application/api/market';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { HelpModal, HelpSection, HelpFormula } from '@/presentation/components/HelpModal';
import { ApiError } from '@/application/api/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtLarge(n: number | null | undefined): string {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

type HelpKey = 'session' | 'stats' | 'chart';

const HELP: Record<HelpKey, { title: string; content: React.ReactNode }> = {
  session: {
    title: 'Sesión actual',
    content: (
      <>
        <HelpSection title="Apertura">
          <p>Precio al que se negoció el primer trade del día en la bolsa. Puede diferir del cierre anterior por noticias o movimientos pre-market.</p>
        </HelpSection>
        <HelpSection title="Mínimo y Máximo del día">
          <p>Rango de precios en el que se ha negociado el activo durante la sesión actual. Indica la volatilidad intradía.</p>
        </HelpSection>
        <HelpSection title="Volumen">
          <p>Cantidad total de acciones (o contratos) negociadas en la sesión actual. Un volumen alto suele confirmar la fuerza de un movimiento de precio.</p>
        </HelpSection>
        <HelpSection title="Volumen promedio">
          <p>Media diaria de volumen de los últimos 30–90 días según el proveedor. Comparar el volumen actual con el promedio indica si hay actividad inusual.</p>
        </HelpSection>
      </>
    ),
  },
  stats: {
    title: 'Estadísticas del activo',
    content: (
      <>
        <HelpSection title="52-Week Low / High">
          <p>Precio mínimo y máximo registrado en los últimos 52 semanas (un año). Útil para identificar si el activo está cerca de sus extremos históricos anuales.</p>
        </HelpSection>
        <HelpSection title="Market Cap">
          <HelpFormula>Market Cap = Precio × Acciones en circulación</HelpFormula>
          <p>Valoración total de la empresa en el mercado. Permite clasificarla (Large Cap {'>'} $10B, Mid Cap $2–10B, Small Cap {'<'} $2B).</p>
        </HelpSection>
        <HelpSection title="Beta">
          <HelpFormula>β = Cov(activo, mercado) / Var(mercado)</HelpFormula>
          <p><strong>β = 1</strong>: el activo se mueve igual que el mercado (ej. S&P 500).<br />
          <strong>β {'>'} 1</strong>: más volátil que el mercado (mayor riesgo y potencial retorno).<br />
          <strong>β {'<'} 1</strong>: menos volátil (más estable).<br />
          <strong>β {'<'} 0</strong>: se mueve en dirección opuesta al mercado (cobertura natural).</p>
        </HelpSection>
        <HelpSection title="Ejemplo">
          <p>Una acción con β = 1.5 tiende a subir 1.5% cuando el mercado sube 1%, y a bajar 1.5% cuando el mercado cae 1%.</p>
        </HelpSection>
      </>
    ),
  },
  chart: {
    title: 'Precio — últimos 12 meses',
    content: (
      <>
        <HelpSection title="¿Qué muestra?">
          <p>Evolución del precio de cierre diario ajustado en los últimos 12 meses. Los precios ajustados incorporan dividendos y splits para una comparación histórica consistente.</p>
        </HelpSection>
        <HelpSection title="Cómo leerlo">
          <p>Observá la tendencia general (serie de máximos y mínimos ascendentes = alcista; descendentes = bajista). Los picos y valles pronunciados suelen coincidir con eventos corporativos o macroeconómicos relevantes.</p>
        </HelpSection>
      </>
    ),
  },
};

export function MarketQuotePage() {
  const [ticker, setTicker] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<{ date: string; close: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHelp, setOpenHelp] = useState<HelpKey | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setHistory([]);
    try {
      const [q, hist] = await Promise.all([
        getQuote(ticker.trim()),
        getHistory(ticker.trim(), '1y', '1d'),
      ]);
      setQuote(q);
      setHistory(hist.map(b => ({ date: b.date.slice(0, 10), close: b.close })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error fetching data.');
    } finally {
      setLoading(false);
    }
  };

  const change = quote?.price && quote?.previous_close
    ? quote.price - quote.previous_close
    : null;
  const changePct = change && quote?.previous_close
    ? (change / quote.previous_close) * 100
    : null;

  const helpInfo = openHelp ? HELP[openHelp] : null;

  return (
    <>
      <PageHeader
        icon={<Search size={22} />}
        title="Cotización"
        subtitle="Datos de mercado en tiempo real"
      />
      <div className="page-body">
        <form onSubmit={search} style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
          <input
            placeholder="Ej: AAPL, MSFT, SPY, BTC-USD"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            style={{ flex: 1, height: 40, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-4)' }}>{error}</p>}

        {quote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            {/* ── Price header ── */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--mono)' }}>
                    {quote.ticker}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {quote.name ?? ''} · {quote.exchange} · {quote.currency}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--text-primary)' }}>
                    {fmt(quote.price)}
                  </div>
                  {change !== null && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: change >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                      {change >= 0 ? '+' : ''}{fmt(change)} ({change >= 0 ? '+' : ''}{fmt(changePct)}%)
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* ── Session metrics ── */}
            <Card title="Sesión actual" onHelp={() => setOpenHelp('session')}>
              <div className="metrics-grid">
                <Metric label="Apertura"    value={fmt(quote.open)} />
                <Metric label="Mín. día"    value={fmt(quote.day_low)} />
                <Metric label="Máx. día"    value={fmt(quote.day_high)} />
                <Metric label="Volumen"     value={quote.volume ? quote.volume.toLocaleString() : '—'} />
                <Metric label="Vol. promedio" value={quote.avg_volume ? quote.avg_volume.toLocaleString() : '—'} />
              </div>
            </Card>

            {/* ── Asset stats ── */}
            <Card title="Estadísticas del activo" onHelp={() => setOpenHelp('stats')}>
              <div className="metrics-grid">
                <Metric label="52w Low"    value={fmt(quote.week_52_low)} />
                <Metric label="52w High"   value={fmt(quote.week_52_high)} />
                <Metric label="Market Cap" value={fmtLarge(quote.market_cap)} />
                <Metric label="Beta"       value={fmt(quote.beta)}
                  variant={quote.beta != null ? (quote.beta > 1.2 ? 'negative' : quote.beta < 0.8 ? 'positive' : 'default') : 'default'} />
              </div>
            </Card>

            {/* ── Price chart ── */}
            {history.length > 0 && (
              <Card title="Precio — últimos 12 meses" onHelp={() => setOpenHelp('chart')}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} interval={Math.floor(history.length / 8)} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v) => [`$${(v as number).toFixed(2)}`, 'Close']} labelStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}
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
