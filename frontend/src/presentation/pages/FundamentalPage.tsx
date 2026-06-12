import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { getRatios, getDcf, getDividends, type DcfResult } from '@/application/api/fundamental';
import { usePageStore } from '@/application/stores/pageStore';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { HelpModal, HelpSection, HelpFormula } from '@/presentation/components/HelpModal';
import { TickerInput } from '@/presentation/components/TickerInput';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

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
type HelpKey = 'valuation' | 'profitability' | 'liquidity' | 'growth' | 'dcf' | 'dividends' | 'montecarlo' | 'wacc' | 'dcfChart' | 'dcfResult';

const HELP: Record<HelpKey, { title: string; content: React.ReactNode }> = {
  valuation: {
    title: 'Ratios de Valoración',
    content: (
      <>
        <HelpSection title="P/E — Price to Earnings">
          <HelpFormula>P/E = Precio / EPS (ganancias por acción)</HelpFormula>
          <p>Indica cuánto paga el mercado por cada $1 de ganancia. P/E alto puede indicar sobrevaluación o altas expectativas de crecimiento.</p>
        </HelpSection>
        <HelpSection title="P/B — Price to Book">
          <HelpFormula>P/B = Precio / Valor en libros por acción</HelpFormula>
          <p>{'< 1'} sugiere que cotiza por debajo de su valor contable (posible oportunidad o empresa en problemas).</p>
        </HelpSection>
        <HelpSection title="EV/EBITDA">
          <HelpFormula>EV/EBITDA = Valor empresa / EBITDA</HelpFormula>
          <p>Alternativa al P/E que ignora la estructura de capital. {'< 10'} se considera razonable en muchos sectores.</p>
        </HelpSection>
        <HelpSection title="PEG">
          <HelpFormula>PEG = P/E / Tasa de crecimiento esperada (%)</HelpFormula>
          <p>{'< 1'} sugiere acción potencialmente subvaluada dado su crecimiento.</p>
        </HelpSection>
      </>
    ),
  },
  profitability: {
    title: 'Ratios de Rentabilidad',
    content: (
      <>
        <HelpSection title="ROE — Return on Equity">
          <HelpFormula>ROE = Utilidad neta / Patrimonio neto</HelpFormula>
          <p>Mide la rentabilidad generada por cada $1 del accionista. {'> 15%'} es generalmente bueno.</p>
        </HelpSection>
        <HelpSection title="ROA — Return on Assets">
          <HelpFormula>ROA = Utilidad neta / Activos totales</HelpFormula>
          <p>Mide cuán eficientemente la empresa usa sus activos para generar ganancias.</p>
        </HelpSection>
        <HelpSection title="Márgenes">
          <p><strong>Margen bruto</strong> = (Ingresos − COGS) / Ingresos<br />
          <strong>Margen operativo</strong> = EBIT / Ingresos<br />
          <strong>Margen neto</strong> = Utilidad neta / Ingresos</p>
        </HelpSection>
      </>
    ),
  },
  liquidity: {
    title: 'Liquidez y Solvencia',
    content: (
      <>
        <HelpSection title="Current Ratio">
          <HelpFormula>Current Ratio = Activos corrientes / Pasivos corrientes</HelpFormula>
          <p>{'> 1'} indica que la empresa puede cubrir sus deudas de corto plazo. {'< 1'} puede ser señal de problemas de liquidez.</p>
        </HelpSection>
        <HelpSection title="Deuda/Equity">
          <HelpFormula>D/E = Deuda total / Patrimonio neto</HelpFormula>
          <p>Mide el apalancamiento. Alto D/E implica mayor riesgo financiero pero puede ser normal en ciertos sectores (utilities, bancos).</p>
        </HelpSection>
      </>
    ),
  },
  growth: {
    title: 'Crecimiento',
    content: (
      <>
        <HelpSection title="Revenue Growth">
          <p>Variación porcentual de los ingresos respecto al año anterior. Indica si la empresa está expandiendo sus ventas.</p>
        </HelpSection>
        <HelpSection title="EPS">
          <HelpFormula>EPS = Utilidad neta / Acciones en circulación</HelpFormula>
          <p><strong>EPS trailing</strong>: basado en los últimos 12 meses reales.<br />
          <strong>EPS forward</strong>: estimado por analistas para los próximos 12 meses.</p>
        </HelpSection>
      </>
    ),
  },
  dcf: {
    title: 'DCF — Discounted Cash Flow',
    content: (
      <>
        <HelpSection title="¿Qué calcula?">
          <p>Estima el valor intrínseco de una acción proyectando los flujos de caja libre futuros y descontándolos al presente.</p>
        </HelpSection>
        <HelpSection title="Fórmula simplificada">
          <HelpFormula>
            Valor empresa = Σ FCF_t / (1+WACC)^t + Valor terminal / (1+WACC)^n<br />
            Valor terminal = FCF_n × (1+g) / (WACC − g)<br />
            Valor intrínseco = (Valor empresa − Deuda neta) / Acciones
          </HelpFormula>
        </HelpSection>
        <HelpSection title="Cómo construimos el modelo">
          <p><strong>FCF base normalizado</strong>: usamos el margen FCF mediano de los últimos años × ingresos actuales, en vez de un solo período (evita anomalías de CapEx/working capital).<br />
          <strong>Crecimiento desde ingresos</strong>: tomamos el CAGR de ventas (más estable que el del FCF) y lo desvanecemos linealmente hasta la tasa terminal.<br />
          <strong>WACC (CAPM)</strong>: si dejás "Auto", lo estimamos con beta, tasa libre de riesgo y prima de riesgo, ponderando equity y deuda.</p>
        </HelpSection>
        <HelpSection title="Parámetros clave">
          <p><strong>WACC</strong>: costo promedio ponderado de capital (tasa de descuento).<br />
          <strong>g</strong>: tasa de crecimiento terminal (debe ser {'<'} WACC).<br />
          <strong>Margen de seguridad</strong>: (Intrínseco − Precio) / Intrínseco. {'>'} 0 = subvaluado.<br />
          <strong>Peso del valor terminal</strong>: si supera ~85%, el resultado depende casi todo del supuesto terminal — interpretá con cuidado.</p>
        </HelpSection>
        <HelpSection title="Rango Monte Carlo">
          <p>Simulamos 10.000 escenarios variando crecimiento, WACC y tasa terminal para mostrar un rango Bear / Mediana / Bull y la probabilidad de que la acción esté infravalorada. El DCF es muy sensible a los supuestos: pensá en rangos, no en un único número.</p>
        </HelpSection>
      </>
    ),
  },
  dcfResult: {
    title: 'Resultado del DCF — qué significa cada valor',
    content: (
      <>
        <HelpSection title="Valor intrínseco">
          <p>El valor "justo" por acción que arroja el modelo: cuánto vale la empresa hoy según los flujos de caja que esperamos que genere. Es nuestra estimación, no un precio de mercado.</p>
          <HelpFormula>Valor intrínseco = (Valor empresa − Deuda neta) / Acciones</HelpFormula>
        </HelpSection>
        <HelpSection title="Precio actual">
          <p>El precio al que cotiza la acción en el mercado ahora mismo. Es la referencia contra la que comparamos el valor intrínseco.</p>
        </HelpSection>
        <HelpSection title="Margen de seguridad">
          <p>Cuánto más barata (o cara) está la acción respecto de su valor intrínseco. <strong>Positivo (verde)</strong> = cotiza por debajo de su valor → potencialmente infravalorada. <strong>Negativo (rojo)</strong> = cotiza por encima.</p>
          <HelpFormula>Margen = (Valor intrínseco − Precio) / Valor intrínseco</HelpFormula>
          <p>Ejemplo: intrínseco $120 y precio $90 → margen +25%.</p>
        </HelpSection>
        <HelpSection title="WACC (CAPM)">
          <p>La tasa de descuento usada para traer los flujos futuros a hoy. Si dice "(CAPM)" la estimamos automáticamente; si no, es el valor que ingresaste. Mirá su card dedicada para el desglose completo.</p>
        </HelpSection>
        <HelpSection title="Crecimiento inicial vs. terminal">
          <p><strong>Crec. inicial</strong>: ritmo al que crecen los flujos en el primer año proyectado (lo sacamos del CAGR de ingresos). <strong>Crec. terminal</strong>: ritmo perpetuo al que asumimos que crece la empresa después del período proyectado (debe ser menor que el WACC). Entre uno y otro el crecimiento se desvanece gradualmente.</p>
        </HelpSection>
        <HelpSection title="FCF base (normalizado)">
          <p>El flujo de caja libre de partida sobre el que proyectamos. En vez de tomar un único año (que puede ser atípico), usamos el margen FCF mediano de varios años × los ingresos actuales, para suavizar anomalías de CapEx o capital de trabajo.</p>
        </HelpSection>
        <HelpSection title="Peso del valor terminal">
          <p>Qué porción del valor total proviene del valor terminal (todo lo posterior al período proyectado) frente al período explícito. Es normal que sea alto (60–85%); si supera ~85% lo marcamos en rojo, porque el resultado depende casi por completo de un supuesto a perpetuidad y es menos confiable.</p>
        </HelpSection>
        <HelpSection title="Equity value">
          <p>El valor total del patrimonio de la empresa (no por acción): el valor empresa menos la deuda neta. Dividido por la cantidad de acciones da el valor intrínseco por acción.</p>
          <HelpFormula>Equity value = Valor empresa − Deuda neta</HelpFormula>
        </HelpSection>
      </>
    ),
  },
  wacc: {
    title: 'WACC — Costo Promedio Ponderado de Capital',
    content: (
      <>
        <HelpSection title="¿Qué representa?">
          <p>Es la tasa de descuento del DCF: el rendimiento mínimo que la empresa debe generar para satisfacer a sus accionistas y acreedores. Combina el costo del capital propio (equity) y el de la deuda, ponderados por su peso en la estructura de financiamiento. Si dejás "Auto", lo estimamos abajo con el modelo CAPM.</p>
        </HelpSection>
        <HelpSection title="Cómo se calcula">
          <HelpFormula>{`WACC = (E/V) × Re + (D/V) × Rd × (1 − impuesto)

Re (costo de equity, vía CAPM) = Rf + β × ERP
E = capitalización de mercado   D = deuda total   V = E + D`}</HelpFormula>
          <p><strong>Rf</strong>: tasa libre de riesgo (~4,3%, bono del Tesoro a 10 años).<br />
          <strong>β (beta)</strong>: sensibilidad de la acción frente al mercado. β {'>'} 1 = más volátil que el mercado.<br />
          <strong>ERP</strong>: prima de riesgo de mercado (~5,5%), el extra que exige el inversor por encima de Rf.<br />
          <strong>Rd</strong>: costo de la deuda (Rf + spread), que se ajusta por el ahorro fiscal de los intereses.</p>
        </HelpSection>
        <HelpSection title="Ejemplo (tipo Coca-Cola)">
          <p>β ≈ 0,6 → Re = 4,3% + 0,6 × 5,5% ≈ <strong>7,6%</strong>. Con poca deuda, el WACC queda cerca de <strong>6–7%</strong>. Una empresa más volátil (β ≈ 1,3, tipo Tesla) tendría Re ≈ 11,5% y un WACC mayor. Subir el WACC un par de puntos puede reducir el valor intrínseco a la mitad.</p>
        </HelpSection>
      </>
    ),
  },
  montecarlo: {
    title: 'Rango de valoración — Monte Carlo',
    content: (
      <>
        <HelpSection title="¿Qué representa?">
          <p>Un único valor intrínseco da una falsa sensación de precisión: el DCF es extremadamente sensible a los supuestos. En vez de un solo número, simulamos 10.000 escenarios variando los supuestos al azar y mostramos el <strong>rango</strong> de valores resultante.</p>
        </HelpSection>
        <HelpSection title="Cómo se calcula">
          <HelpFormula>{`Por cada una de las 10.000 corridas se sortea:
  crecimiento inicial ~ Normal(g₀, 3%)
  WACC               ~ Normal(WACC, 1%)
  crec. terminal     ~ Normal(g, 0,4%)
y se recalcula el valor intrínseco por acción.`}</HelpFormula>
          <p>Con la distribución de los 10.000 resultados tomamos los percentiles:<br />
          <strong>Bear (p25)</strong>: 25% de los escenarios quedan por debajo — caso pesimista.<br />
          <strong>Mediana (p50)</strong>: el valor central, el más representativo.<br />
          <strong>Bull (p75)</strong>: caso optimista; solo 25% de los escenarios lo superan.<br />
          <strong>Prob. infravalorada</strong>: % de escenarios donde el valor intrínseco supera al precio actual.</p>
        </HelpSection>
        <HelpSection title="Cómo leerlo">
          <p>Si el precio actual cae dentro de la franja Bear–Bull, la acción cotiza dentro de lo razonable. Si está muy por encima del Bull, el mercado descuenta supuestos más agresivos que los nuestros. Pensá en rangos, no en un número exacto.</p>
        </HelpSection>
      </>
    ),
  },
  dcfChart: {
    title: 'FCF proyectado vs. Valor Presente',
    content: (
      <>
        <HelpSection title="¿Qué representa?">
          <p>Para cada año proyectado se muestran dos barras: el <strong>FCF proyectado</strong> (el flujo de caja libre que esperamos que genere la empresa ese año) y su <strong>Valor Presente</strong> (ese mismo flujo descontado a hoy con el WACC).</p>
        </HelpSection>
        <HelpSection title="Cómo se calcula">
          <HelpFormula>{`FCF proyectado_t = FCF base × Π (1 + g_t)
Valor Presente_t = FCF proyectado_t / (1 + WACC)^t`}</HelpFormula>
          <p>El crecimiento <strong>g</strong> se desvanece año a año desde el crecimiento inicial hasta la tasa terminal. El descuento crece con el tiempo: un dólar dentro de 5 años vale menos hoy que uno dentro de 1 año.</p>
        </HelpSection>
        <HelpSection title="Cómo leerlo">
          <p>La diferencia entre ambas barras es el efecto del descuento, y se agranda con cada año. Es solo el período explícito; el valor terminal (lo que vale la empresa más allá del último año) se muestra aparte y suele pesar la mayor parte del valor total.</p>
        </HelpSection>
      </>
    ),
  },
  dividends: {
    title: 'Análisis de Dividendos',
    content: (
      <>
        <HelpSection title="Dividend Yield">
          <HelpFormula>Yield = Dividendo anual por acción / Precio de la acción</HelpFormula>
          <p>Retorno por dividendos como % del precio. Valores muy altos pueden indicar un dividendo insostenible.</p>
        </HelpSection>
        <HelpSection title="Payout Ratio">
          <HelpFormula>Payout = Dividendos pagados / Utilidad neta</HelpFormula>
          <p>{'< 60%'} se considera sostenible. {'> 100%'} implica que la empresa paga más de lo que gana (insostenible a largo plazo).</p>
        </HelpSection>
        <HelpSection title="CAGR de dividendos">
          <HelpFormula>CAGR = (Dividendo final / Dividendo inicial)^(1/n) − 1</HelpFormula>
          <p>Tasa de crecimiento anual compuesta del dividendo. Refleja el compromiso histórico con el accionista.</p>
        </HelpSection>
      </>
    ),
  },
};

export function FundamentalPage() {
  const { fundamental: stored, setFundamental: saveFundamental } = usePageStore();

  const [ticker, setTicker] = useState(stored.ticker);
  const [activeTab, setActiveTab] = useState<Tab>((stored.activeTab as Tab) || 'ratios');
  const [loading, setLoading] = useState(false);
  const [openHelp, setOpenHelp] = useState<HelpKey | null>(null);
  const toast = useToast();

  const [ratios, setRatios] = useState<Record<string, unknown> | null>(stored.ratios);
  const [dcf, setDcf] = useState<DcfResult | null>(stored.dcf);
  const [dividends, setDividends] = useState<Record<string, unknown> | null>(stored.dividends);

  // DCF params
  const [waccAuto, setWaccAuto] = useState(true);
  const [wacc, setWacc] = useState('0.10');
  const [termGrowth, setTermGrowth] = useState('0.025');
  const [years, setYears] = useState('5');

  const changeTab = (t: Tab) => {
    setActiveTab(t);
    saveFundamental({ activeTab: t });
  };

  const searchRatios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setRatios(null);
    setDcf(null);
    setDividends(null);
    try {
      const [r, div] = await Promise.all([getRatios(ticker), getDividends(ticker)]);
      setRatios(r);
      setDividends(div);
      saveFundamental({ ticker: ticker.trim(), ratios: r, dividends: div, dcf: null, activeTab: 'ratios' });
      setActiveTab('ratios');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error obteniendo análisis fundamental.');
    } finally {
      setLoading(false);
    }
  };

  const runDcf = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    try {
      const result = await getDcf(ticker, {
        wacc: waccAuto ? undefined : parseFloat(wacc),
        terminal_growth: parseFloat(termGrowth),
        years: parseInt(years),
      });
      setDcf(result);
      setActiveTab('dcf');
      saveFundamental({ dcf: result, activeTab: 'dcf' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error ejecutando el DCF.');
    } finally {
      setLoading(false);
    }
  };

  const r = ratios as Record<string, Record<string, number | null>> | null;

  const dcfBarData = dcf && dcf.applicable !== false && dcf.projected_fcf && dcf.pv_fcf
    ? dcf.projected_fcf.map((v, i) => ({
        year: `Año ${i + 1}`,
        fcf: Math.round(v / 1e6),
        pv: Math.round(dcf.pv_fcf![i] / 1e6),
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
          <TickerInput
            placeholder="Ticker (ej: AAPL)"
            value={ticker}
            onChange={setTicker}
            style={{ height: 40, padding: '0 var(--sp-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--sans)', outline: 'none' }}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Cargando…' : 'Analizar'}
          </button>
        </form>


        {(ratios || dcf) && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-1)' }}>
            {(['ratios', 'dcf', 'dividends'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => changeTab(tab)}
                style={{ padding: '6px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 550, background: activeTab === tab ? 'var(--accent-subtle)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.12s' }}
              >
                {tab === 'ratios' ? 'Ratios' : tab === 'dcf' ? 'DCF' : 'Dividendos'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'ratios' && r && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--sp-4)' }}>
            <Card title="Valoración" onHelp={() => setOpenHelp('valuation')}>
              <div className="metrics-grid">
                <Metric label="P/E" value={fmt(r.valuation?.pe_ratio)} />
                <Metric label="Forward P/E" value={fmt(r.valuation?.forward_pe)} />
                <Metric label="PEG" value={fmt(r.valuation?.peg_ratio)} />
                <Metric label="P/B" value={fmt(r.valuation?.price_to_book)} />
                <Metric label="P/S" value={fmt(r.valuation?.price_to_sales)} />
                <Metric label="EV/EBITDA" value={fmt(r.valuation?.ev_to_ebitda)} />
              </div>
            </Card>
            <Card title="Rentabilidad" onHelp={() => setOpenHelp('profitability')}>
              <div className="metrics-grid">
                <Metric label="ROE" value={fmtPct(r.profitability?.roe)} variant="positive" />
                <Metric label="ROA" value={fmtPct(r.profitability?.roa)} />
                <Metric label="Margen bruto" value={fmtPct(r.profitability?.gross_margin)} />
                <Metric label="Margen op." value={fmtPct(r.profitability?.operating_margin)} />
                <Metric label="Margen neto" value={fmtPct(r.profitability?.net_margin)} />
              </div>
            </Card>
            <Card title="Liquidez y Solvencia" onHelp={() => setOpenHelp('liquidity')}>
              <div className="metrics-grid">
                <Metric label="Current ratio" value={fmt(r.liquidity_solvency?.current_ratio)} />
                <Metric label="Quick ratio" value={fmt(r.liquidity_solvency?.quick_ratio)} />
                <Metric label="Deuda/Equity" value={fmt(r.liquidity_solvency?.debt_to_equity)} />
              </div>
            </Card>
            <Card title="Crecimiento" onHelp={() => setOpenHelp('growth')}>
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
          <Card title="Ejecutar DCF" style={{ marginTop: 'var(--sp-5)' }} onHelp={() => setOpenHelp('dcf')}>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>WACC</label>
                <input type="number" step="0.01" min="0.01" max="0.5" value={wacc} disabled={waccAuto}
                  onChange={e => setWacc(e.target.value)}
                  style={{ width: 90, height: 36, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: waccAuto ? 'var(--bg-subtle)' : 'var(--bg-raised)', color: waccAuto ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--sans)', outline: 'none' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={waccAuto} onChange={e => setWaccAuto(e.target.checked)} />
                  Auto (CAPM)
                </label>
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

        {activeTab === 'dcf' && dcf && dcf.applicable === false && (
          <Card title="DCF no aplicable">
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>{dcf.reason}</p>
            {dcf.latest_fcf != null && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                FCF más reciente: ${(dcf.latest_fcf / 1e9).toFixed(2)}B
              </p>
            )}
          </Card>
        )}

        {activeTab === 'dcf' && dcf && dcf.applicable !== false && (
          <>
            <Card title="Resultado del DCF" style={{ marginBottom: 'var(--sp-5)' }} onHelp={() => setOpenHelp('dcfResult')}>
              <div className="metrics-grid">
                <Metric label="Valor intrínseco" value={dcf.intrinsic_value_per_share != null ? `$${dcf.intrinsic_value_per_share.toFixed(2)}` : '—'} variant="accent" />
                <Metric label="Precio actual" value={dcf.current_price != null ? `$${dcf.current_price.toFixed(2)}` : '—'} />
                <Metric label="Margen de seguridad" value={dcf.margin_of_safety_pct != null ? `${dcf.margin_of_safety_pct.toFixed(1)}%` : '—'}
                  variant={dcf.margin_of_safety_pct != null ? (dcf.margin_of_safety_pct > 0 ? 'positive' : 'negative') : 'default'} />
                <Metric label={`WACC${dcf.wacc_breakdown?.method === 'capm' ? ' (CAPM)' : ''}`} value={`${(dcf.assumptions.wacc * 100).toFixed(1)}%`} />
                <Metric label="Crec. inicial" value={`${(dcf.assumptions.fcf_growth_rate * 100).toFixed(1)}%`} />
                <Metric label="Crec. terminal" value={`${(dcf.assumptions.terminal_growth_rate * 100).toFixed(1)}%`} />
                <Metric label="FCF base (norm.)" value={`$${(dcf.base_fcf / 1e9).toFixed(2)}B`} />
                <Metric label="Peso valor terminal" value={dcf.terminal_value_weight_pct != null ? `${dcf.terminal_value_weight_pct.toFixed(0)}%` : '—'}
                  variant={dcf.terminal_value_weight_pct != null && dcf.terminal_value_weight_pct > 85 ? 'negative' : 'default'} />
                <Metric label="Equity value" value={`$${(dcf.equity_value / 1e9).toFixed(2)}B`} />
              </div>
            </Card>

            {dcf.monte_carlo && (
              <Card title={`Rango de valoración — Monte Carlo (${dcf.monte_carlo.runs.toLocaleString()} simulaciones)`} style={{ marginBottom: 'var(--sp-5)' }} onHelp={() => setOpenHelp('montecarlo')}>
                <div className="metrics-grid" style={{ marginBottom: 'var(--sp-4)' }}>
                  <Metric label="Bear (p25)" value={`$${dcf.monte_carlo.intrinsic_value_per_share.bear.toFixed(2)}`} variant="negative" />
                  <Metric label="Mediana (p50)" value={`$${dcf.monte_carlo.intrinsic_value_per_share.median.toFixed(2)}`} variant="accent" />
                  <Metric label="Bull (p75)" value={`$${dcf.monte_carlo.intrinsic_value_per_share.bull.toFixed(2)}`} variant="positive" />
                  {dcf.monte_carlo.prob_undervalued_pct != null && (
                    <Metric label="Prob. infravalorada" value={`${dcf.monte_carlo.prob_undervalued_pct.toFixed(0)}%`}
                      variant={dcf.monte_carlo.prob_undervalued_pct > 50 ? 'positive' : 'negative'} />
                  )}
                </div>
                {(() => {
                  const mc = dcf.monte_carlo.intrinsic_value_per_share;
                  const price = dcf.current_price;
                  const lo = mc.p10;
                  const hi = mc.p90;
                  const span = hi - lo || 1;
                  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / span) * 100))}%`;
                  return (
                    <div style={{ position: 'relative', height: 56, marginTop: 8 }}>
                      <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, var(--negative), var(--accent), var(--positive))', opacity: 0.35 }} />
                      <div style={{ position: 'absolute', top: 18, left: pos(mc.bear), width: 2, height: 20, background: 'var(--text-muted)' }} />
                      <div style={{ position: 'absolute', top: 18, left: pos(mc.bull), width: 2, height: 20, background: 'var(--text-muted)' }} />
                      <div style={{ position: 'absolute', top: 14, left: pos(mc.median), width: 3, height: 28, background: 'var(--accent)', borderRadius: 2 }} title="Mediana" />
                      <span style={{ position: 'absolute', top: 0, left: pos(mc.median), transform: 'translateX(-50%)', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>Mediana ${mc.median.toFixed(0)}</span>
                      {price != null && (
                        <>
                          <div style={{ position: 'absolute', top: 14, left: pos(price), width: 3, height: 28, background: 'var(--text-primary)', borderRadius: 2 }} title="Precio actual" />
                          <span style={{ position: 'absolute', bottom: 0, left: pos(price), transform: 'translateX(-50%)', fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Precio ${price.toFixed(0)}</span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </Card>
            )}

            {dcf.wacc_breakdown?.method === 'capm' && (
              <Card title="Desglose del WACC (CAPM)" style={{ marginBottom: 'var(--sp-5)' }} onHelp={() => setOpenHelp('wacc')}>
                <div className="metrics-grid">
                  <Metric label="Beta" value={dcf.wacc_breakdown.beta?.toFixed(2) ?? '—'} />
                  <Metric label="Tasa libre de riesgo" value={dcf.wacc_breakdown.risk_free_rate != null ? `${(dcf.wacc_breakdown.risk_free_rate * 100).toFixed(1)}%` : '—'} />
                  <Metric label="Prima de riesgo (ERP)" value={dcf.wacc_breakdown.equity_risk_premium != null ? `${(dcf.wacc_breakdown.equity_risk_premium * 100).toFixed(1)}%` : '—'} />
                  <Metric label="Costo de equity" value={dcf.wacc_breakdown.cost_of_equity != null ? `${(dcf.wacc_breakdown.cost_of_equity * 100).toFixed(1)}%` : '—'} />
                  <Metric label="Costo deuda (post-imp.)" value={dcf.wacc_breakdown.cost_of_debt_after_tax != null ? `${(dcf.wacc_breakdown.cost_of_debt_after_tax * 100).toFixed(1)}%` : '—'} />
                  <Metric label="Peso equity / deuda" value={`${((dcf.wacc_breakdown.weight_equity ?? 0) * 100).toFixed(0)}% / ${((dcf.wacc_breakdown.weight_debt ?? 0) * 100).toFixed(0)}%`} />
                </div>
              </Card>
            )}

            {dcfBarData.length > 0 && (
              <Card title="FCF proyectado vs. PV (en millones USD)" onHelp={() => setOpenHelp('dcfChart')}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 var(--sp-3)' }}>
                  Para cada año: <strong style={{ color: 'var(--accent)' }}>FCF proyectado</strong> = flujo de caja libre esperado, y{' '}
                  <strong style={{ color: 'var(--positive)' }}>Valor presente</strong> = ese flujo descontado a hoy con el WACC. La brecha entre ambas barras es el efecto del descuento y crece con los años.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dcfBarData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: 'var(--text-primary)', opacity: 0.06 }}
                      contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)' }}
                      labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ padding: 0 }}
                      formatter={(v) => [`$${(v as number).toLocaleString()}M`]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                    <Bar dataKey="fcf" name="FCF proyectado (flujo esperado)" fill="var(--accent)" opacity={0.7} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pv" name="Valor presente (descontado a hoy)" fill="var(--positive)" opacity={0.8} radius={[4, 4, 0, 0]} />
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
              <Card title="Dividendos" onHelp={() => setOpenHelp('dividends')}>
                <div className="metrics-grid">
                  <Metric label="Dividend Yield" value={fmt((dividends as Record<string, unknown>).dividend_yield, 4)} />
                  <Metric label="Dividend Rate" value={fmt((dividends as Record<string, unknown>).dividend_rate)} />
                  <Metric label="Payout Ratio" value={fmtPct((dividends as Record<string, unknown>).payout_ratio)} />
                  <Metric label="5Y Avg Yield" value={fmt((dividends as Record<string, unknown>).five_year_avg_yield, 4)} />
                  <Metric label="CAGR Dividendos" value={`${fmt((dividends as Record<string, unknown>).dividend_cagr_pct)}%`} variant="positive" />
                </div>
              </Card>
            )}
          </>
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
