import { useState, useEffect } from 'react';
import { Bell, Trash2, Play, ToggleLeft, ToggleRight, Plus } from 'lucide-react';
import {
  getAlerts, createAlert, toggleAlert, deleteAlert, checkAlert,
  INDICATOR_PATHS, ALERT_TEMPLATES,
  type Alert, type AlertCondition, type AlertOperator, type ConditionOperator, type AlertCheckResult,
} from '@/application/api/alerts';
import { PageHeader, Card } from '@/presentation/components/ui';
import { ApiError } from '@/application/api/client';
import { useToast } from '@/application/stores/toastStore';

function fmt(n: number | null | undefined): string {
  return n == null ? 'nunca' : new Date(n as unknown as string).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function ConditionRow({
  cond, index, onChange, onRemove,
}: {
  cond: AlertCondition;
  index: number;
  onChange: (i: number, c: AlertCondition) => void;
  onRemove: (i: number) => void;
}) {
  const selectStyle: React.CSSProperties = {
    height: 34, padding: '0 8px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
  };
  const inputStyle: React.CSSProperties = {
    width: 80, height: 34, padding: '0 8px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--mono)', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
      <select style={{ ...selectStyle, flex: 1, minWidth: 160 }}
        value={cond.path}
        onChange={e => onChange(index, { ...cond, path: e.target.value })}
      >
        {INDICATOR_PATHS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <select style={selectStyle}
        value={cond.operator}
        onChange={e => onChange(index, { ...cond, operator: e.target.value as ConditionOperator })}
      >
        {(['<', '>', '<=', '>=', '=='] as ConditionOperator[]).map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      <input type="number" style={inputStyle}
        value={cond.value}
        onChange={e => onChange(index, { ...cond, value: parseFloat(e.target.value) || 0 })}
      />
      <button onClick={() => onRemove(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 4 }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function AlertCard({ alert, onToggle, onDelete, onCheck }: {
  alert: Alert;
  onToggle: (id: number, active: boolean) => void;
  onDelete: (id: number, name: string) => void;
  onCheck: (id: number) => void;
}) {
  const [checkResult, setCheckResult] = useState<AlertCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await checkAlert(alert.id);
      setCheckResult(result);
      onCheck(alert.id);
    } catch {
      // silently fail
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--sp-4)',
      opacity: alert.is_active ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 100,
              background: 'var(--bg-raised)', color: 'var(--accent)',
              fontFamily: 'var(--mono)',
            }}>{alert.ticker}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Operador: <strong>{alert.operator}</strong> · Disparado: <strong>{alert.triggered_count}x</strong>
            {alert.last_triggered && ` · Último: ${fmt(alert.last_triggered as unknown as number)}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onToggle(alert.id, !alert.is_active)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: alert.is_active ? 'var(--positive)' : 'var(--text-muted)', padding: 4 }} title={alert.is_active ? 'Desactivar' : 'Activar'}>
            {alert.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
          <button onClick={handleCheck} disabled={checking} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }} title="Verificar ahora">
            <Play size={14} />
          </button>
          <button onClick={() => onDelete(alert.id, alert.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--negative)', padding: 4 }} title="Eliminar">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Conditions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {alert.conditions.map((c, i) => {
          const pathLabel = INDICATOR_PATHS.find(p => p.value === c.path)?.label ?? c.path;
          return (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--mono)' }}>
              {pathLabel} {c.operator} {c.value}
            </div>
          );
        })}
      </div>

      {/* Check result */}
      {checkResult && (
        <div style={{
          marginTop: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)',
          borderRadius: 'var(--radius-sm)',
          background: checkResult.triggered ? 'rgba(74, 222, 128, 0.1)' : 'var(--bg-raised)',
          borderLeft: `3px solid ${checkResult.triggered ? 'var(--positive)' : 'var(--border)'}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: checkResult.triggered ? 'var(--positive)' : 'var(--text-muted)' }}>
            {checkResult.triggered ? '⚡ Condición cumplida' : 'No cumplida'}
            {checkResult.missing_data && ' (datos parciales)'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {checkResult.results.map((r, i) => {
              const pathLabel = INDICATOR_PATHS.find(p => p.value === r.condition.path)?.label ?? r.condition.path;
              return (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 4 }}>
                  <span>{r.result === null ? '?' : r.result ? '✓' : '✗'}</span>
                  <span>{pathLabel} {r.condition.operator} {r.condition.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  // Form state
  const [formTicker, setFormTicker] = useState('');
  const [formName, setFormName] = useState('');
  const [formConditions, setFormConditions] = useState<AlertCondition[]>([
    { path: 'rsi_14', operator: '<', value: 35 },
  ]);
  const [formOperator, setFormOperator] = useState<AlertOperator>('AND');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .catch(() => toast.error('Error cargando alertas.'))
      .finally(() => setLoading(false));
  }, []);

  const applyTemplate = (idx: number) => {
    const t = ALERT_TEMPLATES[idx];
    setFormName(t.name);
    setFormConditions(t.conditions.map(c => ({ ...c })));
    setFormOperator(t.operator);
  };

  const addCondition = () => {
    if (formConditions.length >= 6) return;
    setFormConditions(prev => [...prev, { path: 'rsi_14', operator: '<', value: 40 }]);
  };

  const updateCondition = (i: number, c: AlertCondition) => {
    setFormConditions(prev => prev.map((x, idx) => idx === i ? c : x));
  };

  const removeCondition = (i: number) => {
    setFormConditions(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTicker.trim() || !formName.trim() || formConditions.length === 0) {
      setFormError('Completá ticker, nombre y al menos una condición.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createAlert({
        ticker: formTicker.toUpperCase(),
        name: formName,
        conditions: formConditions,
        operator: formOperator,
      });
      setAlerts(prev => [created, ...prev]);
      setShowForm(false);
      setFormTicker('');
      setFormName('');
      setFormConditions([{ path: 'rsi_14', operator: '<', value: 35 }]);
      setFormOperator('AND');
      toast.success(`Alerta "${created.name}" creada.`);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Error creando alerta.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      const updated = await toggleAlert(id, active);
      setAlerts(prev => prev.map(a => a.id === id ? updated : a));
      toast.info(active ? 'Alerta activada.' : 'Alerta pausada.');
    } catch {
      toast.error('Error actualizando la alerta.');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success(`Alerta "${name}" eliminada.`);
    } catch {
      toast.error('Error eliminando la alerta.');
    }
  };

  return (
    <>
      <PageHeader
        icon={<Bell size={22} />}
        title="Alertas de Inversión"
        subtitle="Configura condiciones y evalúa oportunidades de DCA"
      />
      <div className="page-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'} configuradas
          </span>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} />
            Nueva alerta
          </button>
        </div>


        {/* Create form */}
        {showForm && (
          <Card title="Nueva alerta" style={{ marginBottom: 'var(--sp-5)' }}>
            {/* Templates */}
            <div style={{ marginBottom: 'var(--sp-4)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Plantillas predefinidas:</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ALERT_TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => applyTemplate(i)}
                    style={{
                      fontSize: 12, padding: '4px 10px', borderRadius: 100,
                      border: '1px solid var(--border)', background: 'var(--bg-raised)',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}
                    title={t.description}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ticker</label>
                  <input
                    placeholder="AAPL"
                    value={formTicker}
                    onChange={e => setFormTicker(e.target.value.toUpperCase())}
                    style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
                  <input
                    placeholder="Mi alerta DCA"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 'var(--sp-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Condiciones</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Combinar con:</span>
                    {(['AND', 'OR'] as AlertOperator[]).map(op => (
                      <button
                        key={op} type="button"
                        onClick={() => setFormOperator(op)}
                        style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: formOperator === op ? 'var(--accent)' : 'var(--bg-raised)',
                          color: formOperator === op ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer', fontWeight: 600,
                        }}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>
                {formConditions.map((c, i) => (
                  <ConditionRow key={i} cond={c} index={i} onChange={updateCondition} onRemove={removeCondition} />
                ))}
                {formConditions.length < 6 && (
                  <button type="button" onClick={addCondition}
                    style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={12} /> Agregar condición
                  </button>
                )}
              </div>

              {formError && <p style={{ color: 'var(--negative)', fontSize: 12, marginBottom: 8 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar alerta'}</button>
                <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </Card>
        )}

        {/* Alert list */}
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cargando alertas…</p>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
            <Bell size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 14 }}>No tenés alertas configuradas.</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Creá una para recibir señales de compra/venta.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onCheck={() => { /* refresh is handled inside AlertCard */ }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
