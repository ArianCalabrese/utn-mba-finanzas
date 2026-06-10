import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, Plus, X, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import {
  getUniverses, runScan,
  type UniverseMeta, type ScanResult, type ScanRow, type ScanSource, type Verdict, type DcaSignal,
} from '@/application/api/scanner';
import { getWatchlists, type WatchlistMeta } from '@/application/api/watchlist';
import { getPortfolios, type Portfolio } from '@/application/api/portfolio';
import { usePageStore } from '@/application/stores/pageStore';
import { PageHeader, Card, Metric } from '@/presentation/components/ui';
import { TickerInput } from '@/presentation/components/TickerInput';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const inp: React.CSSProperties = {
  height: 36, padding: '0 10px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

const VERDICT_STYLE: Record<Verdict, { label: string; color: string }> = {
  STRONG_BUY: { label: 'Compra Fuerte', color: 'var(--positive)' },
  BUY: { label: 'Compra', color: '#4ade80' },
  HOLD: { label: 'Mantener', color: 'var(--text-muted)' },
  REDUCE: { label: 'Reducir', color: '#f97316' },
  STRONG_REDUCE: { label: 'Reducir Fuerte', color: 'var(--negative)' },
};

const DCA_STYLE: Record<DcaSignal, { label: string; color: string }> = {
  ACCUMULATE: { label: 'Acumular', color: 'var(--positive)' },
  NORMAL: { label: 'Normal', color: 'var(--text-muted)' },
  PAUSE: { label: 'Pausar', color: 'var(--negative)' },
};

const SOURCES: { id: ScanSource; label: string }[] = [
  { id: 'universe', label: 'Universo' },
  { id: 'watchlist', label: 'Mis watchlists' },
  { id: 'portfolio', label: 'Mi portafolio' },
  { id: 'custom', label: 'Manual' },
];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
      color, background: 'var(--bg-base)', padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 65 ? 'var(--positive)' : score >= 42 ? '#f59e0b' : 'var(--negative)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>
        {score.toFixed(1)}
      </span>
      <div style={{ width: 56, height: 6, borderRadius: 100, background: 'var(--bg-base)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, score))}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

type Filter = 'all' | 'buy' | 'dca';

export function OpportunityRadarPage() {
  const { radar: stored, setRadar } = usePageStore();
  const navigate = useNavigate();
  const toast = useToast();
  const { setTechnical } = usePageStore();

  const [source, setSource] = useState<ScanSource>(stored.source as ScanSource);
  const [universes, setUniverses] = useState<UniverseMeta[]>([]);
  const [universe, setUniverse] = useState(stored.universe);
  const [watchlists, setWatchlists] = useState<WatchlistMeta[]>([]);
  const [watchlistId, setWatchlistId] = useState(stored.watchlistId);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioId, setPortfolioId] = useState(stored.portfolioId);
  const [manualTickers, setManualTickers] = useState<string[]>(stored.manualTickers);
  const [manualInput, setManualInput] = useState('');

  const [result, setResult] = useState<ScanResult | null>(stored.result);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    getUniverses().then(setUniverses).catch(() => {});
    getWatchlists().then(setWatchlists).catch(() => {});
    getPortfolios().then(setPortfolios).catch(() => {});
  }, []);

  const addManual = () => {
    const t = manualInput.trim().toUpperCase();
    if (!t) return;
    if (!manualTickers.includes(t)) {
      const next = [...manualTickers, t];
      setManualTickers(next);
      setRadar({ manualTickers: next });
    }
    setManualInput('');
  };

  const removeManual = (t: string) => {
    const next = manualTickers.filter(x => x !== t);
    setManualTickers(next);
    setRadar({ manualTickers: next });
  };

  const scan = async () => {
    const body =
      source === 'universe' ? { source, universe }
      : source === 'watchlist' ? { source, watchlists: watchlistId ? [Number(watchlistId)] : undefined }
      : source === 'portfolio' ? { source, portfolios: portfolioId ? [Number(portfolioId)] : undefined }
      : { source, tickers: manualTickers };

    if (source === 'custom' && manualTickers.length === 0) {
      toast.error('Agregá al menos un ticker para escanear.');
      return;
    }

    setLoading(true);
    try {
      const data = await runScan(body);
      setResult(data);
      setRadar({ source, universe, watchlistId, portfolioId, result: data });
      if (data.failed.length > 0) {
        toast.info(`${data.failed.length} ticker(s) sin datos: ${data.failed.map(f => f.ticker).join(', ')}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Error ejecutando el escaneo.');
    } finally {
      setLoading(false);
    }
  };

  const goToTechnical = (ticker: string) => {
    setTechnical({ ticker, indicators: null, signals: null, conviction: null });
    navigate('/mercado/tecnico');
  };

  const rows = useMemo(() => {
    if (!result) return [];
    if (filter === 'buy') return result.results.filter(r => r.verdict === 'BUY' || r.verdict === 'STRONG_BUY');
    if (filter === 'dca') return result.results.filter(r => r.dca_signal === 'ACCUMULATE');
    return result.results;
  }, [result, filter]);

  const stats = useMemo(() => {
    if (!result) return null;
    const buy = result.results.filter(r => r.verdict === 'BUY' || r.verdict === 'STRONG_BUY').length;
    const dca = result.results.filter(r => r.dca_signal === 'ACCUMULATE').length;
    const avg = result.results.length
      ? result.results.reduce((a, r) => a + r.score, 0) / result.results.length
      : 0;
    return { buy, dca, avg };
  }, [result]);

  const isPortfolioScan = result?.source === 'portfolio';
  const scanLabel =
    source === 'universe' ? universes.find(u => u.key === universe)?.label
    : source === 'watchlist' ? (watchlistId ? watchlists.find(w => String(w.id) === watchlistId)?.name : 'todas mis listas')
    : source === 'portfolio' ? (portfolioId ? portfolios.find(p => String(p.id) === portfolioId)?.name : 'todas mis carteras')
    : `${manualTickers.length} tickers`;

  return (
    <>
      <PageHeader
        icon={<Radar size={22} />}
        title="Radar de Oportunidades"
        subtitle="Escaneo masivo por score de convicción: tendencia, momentum, valuación y volatilidad"
      />
      <div className="page-body">

        {/* ── Configuración del escaneo ── */}
        <Card title="Fuente del escaneo" style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--sp-4)' }}>
            {SOURCES.map(s => (
              <button
                key={s.id}
                type="button"
                className={`btn ${source === s.id ? 'btn-primary' : ''}`}
                onClick={() => { setSource(s.id); setRadar({ source: s.id }); }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {source === 'universe' && (
              <div style={{ minWidth: 260 }}>
                <label style={lbl}>Universo</label>
                <select
                  style={{ ...inp, width: '100%' }}
                  value={universe}
                  onChange={e => { setUniverse(e.target.value); setRadar({ universe: e.target.value }); }}
                >
                  {universes.map(u => (
                    <option key={u.key} value={u.key}>{u.label} ({u.count} tickers)</option>
                  ))}
                </select>
              </div>
            )}

            {source === 'watchlist' && (
              <div style={{ minWidth: 260 }}>
                <label style={lbl}>Lista</label>
                <select
                  style={{ ...inp, width: '100%' }}
                  value={watchlistId}
                  onChange={e => { setWatchlistId(e.target.value); setRadar({ watchlistId: e.target.value }); }}
                >
                  <option value="">Todas mis listas</option>
                  {watchlists.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.item_count} tickers)</option>
                  ))}
                </select>
              </div>
            )}

            {source === 'portfolio' && (
              <div style={{ minWidth: 260 }}>
                <label style={lbl}>Cartera</label>
                <select
                  style={{ ...inp, width: '100%' }}
                  value={portfolioId}
                  onChange={e => { setPortfolioId(e.target.value); setRadar({ portfolioId: e.target.value }); }}
                >
                  <option value="">Todas mis carteras</option>
                  {portfolios.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {source === 'custom' && (
              <div style={{ flex: 1, minWidth: 280 }}>
                <label style={lbl}>Agregar ticker</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 160 }}>
                    <TickerInput style={inp} value={manualInput} onChange={setManualInput} onSelect={() => {}} onEnter={addManual} />
                  </div>
                  <button type="button" className="btn" onClick={addManual} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={14} /> Agregar
                  </button>
                </div>
                {manualTickers.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {manualTickers.map(t => (
                      <span key={t} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                        fontFamily: 'var(--mono)', fontWeight: 600, background: 'var(--bg-base)',
                        padding: '3px 8px', borderRadius: 100,
                      }}>
                        {t}
                        <button type="button" onClick={() => removeManual(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 0, display: 'flex' }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-primary" onClick={scan} disabled={loading} style={{ height: 36 }}>
              {loading ? 'Escaneando…' : 'Escanear'}
            </button>
          </div>

          {source === 'universe' && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--sp-3)' }}>
              {universes.find(u => u.key === universe)?.description}
            </p>
          )}
        </Card>

        {loading && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Calculando convicción para {scanLabel}… esto puede tardar un momento la primera vez.
          </p>
        )}

        {/* ── Resultados ── */}
        {result && !loading && stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              <Card><Metric label="Tickers escaneados" value={String(result.count)} /></Card>
              <Card><Metric label="Señal de compra" value={String(stats.buy)} variant={stats.buy > 0 ? 'positive' : 'default'} sub="BUY o STRONG_BUY" /></Card>
              <Card><Metric label="DCA: Acumular" value={String(stats.dca)} variant={stats.dca > 0 ? 'positive' : 'default'} sub="momento de aumentar cuota" /></Card>
              <Card><Metric label="Score promedio" value={stats.avg.toFixed(1)} /></Card>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--sp-3)', flexWrap: 'wrap' }}>
              {([
                { id: 'all', label: `Todos (${result.count})` },
                { id: 'buy', label: `Solo compra (${stats.buy})` },
                { id: 'dca', label: `Solo DCA acumular (${stats.dca})` },
              ] as { id: Filter; label: string }[]).map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn ${filter === f.id ? 'btn-primary' : ''}`}
                  style={{ fontSize: 12, height: 30, padding: '0 12px' }}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Ningún ticker cumple este filtro.</p>
            ) : (
              <Card style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'right', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px' }}>#</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px' }}>Activo</th>
                      <th style={{ padding: '8px 12px' }}>Precio</th>
                      <th style={{ padding: '8px 12px' }}>Hoy</th>
                      <th style={{ padding: '8px 12px' }}>Score</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px' }}>Veredicto</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px' }}>DCA</th>
                      <th style={{ padding: '8px 12px' }}>RSI</th>
                      <th style={{ padding: '8px 12px' }}>DD vs ATH</th>
                      {isPortfolioScan && <th style={{ padding: '8px 12px' }}>vs costo prom.</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: ScanRow, i: number) => {
                      const up = r.change_pct != null && r.change_pct >= 0;
                      return (
                        <tr key={r.ticker} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                          <td style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>{i + 1}</td>
                          <td style={{ textAlign: 'left', padding: '10px 12px' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{r.ticker}</div>
                            {r.name && <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                            {r.price != null ? `${fmt(r.price)} ${r.currency ?? ''}` : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: r.change_pct == null ? 'var(--text-muted)' : up ? 'var(--positive)' : 'var(--negative)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              {r.change_pct != null && (up ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                              {r.change_pct != null ? `${up ? '+' : ''}${fmt(r.change_pct)}%` : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}><ScoreBar score={r.score} /></td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <Badge {...VERDICT_STYLE[r.verdict]} />
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <Badge {...DCA_STYLE[r.dca_signal]} />
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: r.rsi_14 != null && r.rsi_14 < 35 ? 'var(--positive)' : r.rsi_14 != null && r.rsi_14 > 70 ? 'var(--negative)' : undefined }}>
                            {fmt(r.rsi_14, 1)}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: r.drawdown_from_ath != null && r.drawdown_from_ath < -20 ? 'var(--positive)' : undefined }}>
                            {r.drawdown_from_ath != null ? `${fmt(r.drawdown_from_ath, 1)}%` : '—'}
                          </td>
                          {isPortfolioScan && (
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 12, color: r.vs_avg_cost_pct == null ? 'var(--text-muted)' : r.vs_avg_cost_pct < 0 ? 'var(--positive)' : undefined }}>
                              {r.vs_avg_cost_pct != null ? `${r.vs_avg_cost_pct > 0 ? '+' : ''}${fmt(r.vs_avg_cost_pct, 1)}%` : '—'}
                            </td>
                          )}
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              onClick={() => goToTechnical(r.ticker)}
                              title="Ver análisis técnico completo"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}
                            >
                              <ExternalLink size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            )}

            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--sp-3)' }}>
              Score 0–100 ponderado: tendencia 30% · momentum 25% · valuación 25% · volatilidad 20%.
              {isPortfolioScan && ' "vs costo prom." negativo = el precio está debajo de tu costo promedio (oportunidad de DCA).'}
              {result.truncated && ` Se escaneó un máximo de ${result.max_tickers} tickers.`}
            </p>
          </>
        )}
      </div>
    </>
  );
}
