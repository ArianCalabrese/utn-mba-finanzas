import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { getBondPrice, getBondYtm, getBondDuration, type BondPriceResult, type BondYtmResult, type BondDurationResult } from '@/application/api/bonds';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { HelpModal, HelpSection, HelpFormula } from '@/presentation/components/HelpModal';
import { ApiError } from '@/application/api/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type Mode = 'price' | 'ytm' | 'duration';
type HelpKey = 'price' | 'ytm' | 'duration';

const HELP: Record<HelpKey, { title: string; content: React.ReactNode }> = {
  price: {
    title: 'Precio del Bono',
    content: (
      <>
        <HelpSection title="¿Cómo se calcula?">
          <HelpFormula>
            Precio = Σ [C / (1 + YTM/f)^t] + VN / (1 + YTM/f)^n
          </HelpFormula>
          <p>Donde C = cupón por período, VN = valor nominal, f = frecuencia, n = total períodos.</p>
        </HelpSection>
        <HelpSection title="Relación precio/YTM">
          <p>Cuando el YTM <strong>sube</strong>, el precio del bono <strong>baja</strong> (relación inversa).<br />
          Si YTM = tasa cupón → precio = valor nominal (par).<br />
          Si YTM {'>'} tasa cupón → precio {'<'} par (descuento).<br />
          Si YTM {'<'} tasa cupón → precio {'>'} par (prima).</p>
        </HelpSection>
        <HelpSection title="Ejemplo">
          <p>Bono de $1.000, cupón 6% semestral, 10 períodos, YTM 7%:<br />
          Cupón = $30 cada 6 meses. Precio ≈ $929.</p>
        </HelpSection>
      </>
    ),
  },
  ytm: {
    title: 'YTM — Yield to Maturity',
    content: (
      <>
        <HelpSection title="¿Qué es?">
          <p>La <strong>tasa interna de retorno</strong> del bono: la tasa de descuento que iguala el precio de mercado con el valor presente de todos los flujos futuros.</p>
        </HelpSection>
        <HelpSection title="¿Cómo se calcula?">
          <p>Se resuelve numéricamente (método de Brentq/bisección) ya que no tiene solución analítica cerrada:</p>
          <HelpFormula>Precio = Σ [C / (1+y)^t] + VN/(1+y)^n → despejar y</HelpFormula>
        </HelpSection>
        <HelpSection title="Interpretación">
          <p>El YTM es el retorno anualizado que obtendría un inversor si compra el bono al precio de mercado y lo mantiene hasta el vencimiento, reinvirtiendo los cupones a la misma tasa.</p>
        </HelpSection>
      </>
    ),
  },
  duration: {
    title: 'Duración, Duración Modificada y Convexidad',
    content: (
      <>
        <HelpSection title="Duración de Macaulay">
          <HelpFormula>D = Σ [t × PV(Flujo_t)] / Precio</HelpFormula>
          <p>Tiempo promedio ponderado para recibir los flujos de caja, en años. Un bono cero cupón tiene duración = vencimiento.</p>
        </HelpSection>
        <HelpSection title="Duración Modificada">
          <HelpFormula>DM = D_Macaulay / (1 + YTM/f)</HelpFormula>
          <p>Sensibilidad del precio del bono ante cambios en la tasa de interés.<br />
          Si DM = 5 y el YTM sube 1%, el precio cae ≈ 5%.</p>
        </HelpSection>
        <HelpSection title="Convexidad">
          <p>Corrección de segundo orden. Cuanta más convexidad, menor la caída real del precio ante subas de tasas (y mayor la suba ante bajas). Un bono con alta convexidad es más valioso.</p>
        </HelpSection>
        <HelpSection title="DV01">
          <HelpFormula>DV01 = DM × Precio × 0.0001</HelpFormula>
          <p>Cambio en el precio del bono ante un movimiento de 1 punto base (0.01%) en el YTM. Útil para gestión de riesgo de cartera de renta fija.</p>
        </HelpSection>
      </>
    ),
  },
};

function fmt(n: number | null | undefined, dec = 4): string {
  return n == null ? '—' : n.toFixed(dec);
}

const FREQUENCY_OPTIONS = [
  { label: 'Anual (1)', value: 1 },
  { label: 'Semestral (2)', value: 2 },
  { label: 'Trimestral (4)', value: 4 },
  { label: 'Mensual (12)', value: 12 },
];

export function BondsApiPage() {
  const [mode, setMode] = useState<Mode>('price');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openHelp, setOpenHelp] = useState<HelpKey | null>(null);

  const [form, setForm] = useState({
    face: '1000',
    coupon_rate: '0.06',
    periods: '10',
    frequency: '2',
    ytm: '0.07',
    market_price: '950',
  });

  const [priceResult, setPriceResult] = useState<BondPriceResult | null>(null);
  const [ytmResult, setYtmResult] = useState<BondYtmResult | null>(null);
  const [durationResult, setDurationResult] = useState<BondDurationResult | null>(null);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const payload = () => ({
    face: parseFloat(form.face),
    coupon_rate: parseFloat(form.coupon_rate),
    periods: parseInt(form.periods),
    frequency: parseInt(form.frequency),
    ytm: parseFloat(form.ytm),
  });

  const calculate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === 'price') {
        setPriceResult(await getBondPrice(payload()));
      } else if (mode === 'ytm') {
        setYtmResult(await getBondYtm({ ...payload(), market_price: parseFloat(form.market_price) }));
      } else {
        setDurationResult(await getBondDuration(payload()));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error en el cálculo.');
    } finally {
      setLoading(false);
    }
  };

  const cfData = priceResult?.cash_flows?.map(cf => ({
    period: `P${cf.period}`,
    cash_flow: cf.cash_flow,
    pv: cf.present_value,
  })) ?? [];

  return (
    <>
      <PageHeader icon={<Wallet size={22} />} title="Bonos" subtitle="Precio, YTM, Duración y Convexidad" />
      <div className="page-body">
        <Card style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
            {(['price', 'ytm', 'duration'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 550, background: mode === m ? 'var(--accent-subtle)' : 'var(--bg-raised)', color: mode === m ? 'var(--accent)' : 'var(--text-muted)' }}>
                {m === 'price' ? 'Precio' : m === 'ytm' ? 'YTM' : 'Duración'}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
            {[
              { label: 'Valor nominal', field: 'face' as const },
              { label: 'Tasa cupón (dec.)', field: 'coupon_rate' as const },
              { label: 'N° períodos', field: 'periods' as const },
              ...(mode !== 'ytm' ? [{ label: 'YTM (dec.)', field: 'ytm' as const }] : []),
              ...(mode === 'ytm' ? [{ label: 'Precio de mercado', field: 'market_price' as const }] : []),
            ].map(({ label, field }) => (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</label>
                <input type="number" step="any" value={form[field]} onChange={setField(field)}
                  style={{ height: 38, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Frecuencia</label>
              <select value={form.frequency} onChange={setField('frequency')}
                style={{ height: 38, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }}>
                {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {error && <p style={{ color: 'var(--negative)', fontSize: 13, marginBottom: 'var(--sp-3)' }}>{error}</p>}
          <button className="btn btn-primary" onClick={calculate} disabled={loading}>
            {loading ? 'Calculando…' : 'Calcular'}
          </button>
        </Card>

        {mode === 'price' && priceResult && (
          <>
            <Card title="Resultado" style={{ marginBottom: 'var(--sp-5)' }} onHelp={() => setOpenHelp('price')}>
              <div className="metrics-grid">
                <Metric label="Precio" value={`$${fmt(priceResult.price)}`} variant="accent" />
                <Metric label="Prima / Descuento" value={`$${fmt(priceResult.face_value - priceResult.price)}`}
                  variant={priceResult.price >= priceResult.face_value ? 'positive' : 'negative'} />
                <Metric label="Pago de cupón" value={`$${fmt(priceResult.coupon_payment)}`} />
                <Metric label="YTM" value={`${(priceResult.ytm * 100).toFixed(3)}%`} />
              </div>
            </Card>
            {cfData.length > 0 && cfData.length <= 30 && (
              <Card title="Flujos de caja y valor presente">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cfData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => [`$${(v as number).toFixed(2)}`]} />
                    <Bar dataKey="cash_flow" name="Flujo de caja" fill="var(--accent)" opacity={0.7} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pv" name="Valor presente" fill="var(--positive)" opacity={0.8} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </>
        )}

        {mode === 'ytm' && ytmResult && (
          <Card title="Resultado" onHelp={() => setOpenHelp('ytm')}>
            <div className="metrics-grid">
              <Metric label="YTM Anual" value={`${(ytmResult.ytm_annual * 100).toFixed(4)}%`} variant="accent" />
              <Metric label="YTM Periódico" value={`${(ytmResult.ytm_periodic * 100).toFixed(4)}%`} />
              <Metric label="Precio de mercado" value={`$${fmt(ytmResult.market_price)}`} />
              <Metric label="Valor nominal" value={`$${fmt(ytmResult.face)}`} />
            </div>
          </Card>
        )}

        {mode === 'duration' && durationResult && (
          <Card title="Resultado" onHelp={() => setOpenHelp('duration')}>
            <div className="metrics-grid">
              <Metric label="Precio" value={`$${fmt(durationResult.price)}`} />
              <Metric label="Dur. Macaulay" value={`${fmt(durationResult.macaulay_duration)} años`} variant="accent" />
              <Metric label="Dur. Modificada" value={fmt(durationResult.modified_duration)} />
              <Metric label="Convexidad" value={fmt(durationResult.convexity)} />
              <Metric label="DV01" value={`$${fmt(durationResult.dv01)}`} sub="Cambio precio por +1bp de YTM" />
            </div>
          </Card>
        )}

        {openHelp && HELP[openHelp] && (
          <HelpModal title={HELP[openHelp].title} onClose={() => setOpenHelp(null)}>
            {HELP[openHelp].content}
          </HelpModal>
        )}
      </div>
    </>
  );
}
