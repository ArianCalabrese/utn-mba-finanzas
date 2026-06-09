import { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Target, Plus, Trash2 } from "lucide-react";
import { useNpvIrr } from "@/application";
import type { CashFlow } from "@/domain";
import { Card, Field, Metric, Alert, PageHeader } from "@/presentation/components/ui";
import {
  HelpModal,
  HelpSection,
  HelpFormula,
  HelpExample,
  HelpWarning,
} from "@/presentation/components/HelpModal";
import { CapitalLineChart } from "@/presentation/components/Charts";
import { formatCurrency, formatPercent } from "@/presentation/utils/format";
import "@/presentation/components/ui.css";

interface FlowRow {
  amount: string;
}

interface FormValues {
  discountRate: string;
  flows:        FlowRow[];
}

const DEFAULT_FLOWS: FlowRow[] = [
  { amount: "-50000" },
  { amount: "15000" },
  { amount: "18000" },
  { amount: "20000" },
  { amount: "22000" },
];

export function NpvIrrPage() {
  const { result, error, calculate, reset } = useNpvIrr();
  const [hasCalculated, setHasCalculated] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const { register, control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { discountRate: "10", flows: DEFAULT_FLOWS },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "flows" });

  const flows = watch("flows");
  const discountRate = watch("discountRate");

  // Recalculate automatically whenever inputs change (debounced via useEffect key)
  const cashFlows: CashFlow[] = useMemo(
    () =>
      flows
        .map((f, i) => ({ period: i, amount: parseFloat(f.amount) }))
        .filter((f) => isFinite(f.amount)),
    [flows]
  );

  const onSubmit = (data: FormValues) => {
    const rate = parseFloat(data.discountRate) / 100;
    const cf: CashFlow[] = data.flows
      .map((f, i) => ({ period: i, amount: parseFloat(f.amount) }))
      .filter((f) => isFinite(f.amount));
    calculate(cf, rate);
    setHasCalculated(true);
  };

  const handleReset = () => {
    reset();
    setHasCalculated(false);
  };

  // Shorthand for nested result fields
  const npvValue  = result?.npv.npv ?? 0;
  const irrValue  = result?.irr.irr ?? null;

  // Sensitivity chart data
  const sensitivityData = useMemo(() => {
    if (!result?.sensitivity) return [];
    return result.sensitivity.map((pt) => ({
      rate: parseFloat((pt.rate * 100).toFixed(2)),
      VAN:  pt.npv,
    }));
  }, [result]);

  // Discounted cash flow table
  const dcfRows = useMemo(() => {
    if (!result) return [];
    const rate = parseFloat(discountRate) / 100;
    return cashFlows.map((cf) => ({
      period:    cf.period,
      nominal:   cf.amount,
      discounted: cf.amount / Math.pow(1 + rate, cf.period),
    }));
  }, [result, cashFlows, discountRate]);

  return (
    <>
      <PageHeader
        icon={<Target size={22} />}
        title="VAN / TIR"
        subtitle="Valor Actual Neto y Tasa Interna de Retorno — evaluación de proyectos de inversión"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="VAN / TIR — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="¿Qué mide el VAN?">
            <p>
              El <strong>Valor Actual Neto (VAN)</strong> mide cuánto valor crea un proyecto
              por encima del costo de capital. Un VAN positivo significa que el proyecto
              genera más retorno que la alternativa de invertir al costo de capital.
            </p>
            <HelpFormula>{`VAN = Σ  CFt / (1 + r)^t    (t = 0, 1, 2, ..., n)

CFt = Flujo de caja del período t (negativo si es inversión)
r   = Tasa de descuento (costo de capital / WACC)
t   = Período (el flujo 0 no se descuenta: t=0 → CF₀/1 = CF₀)`}</HelpFormula>
          </HelpSection>

          <HelpSection title="¿Qué mide la TIR?">
            <p>
              La <strong>Tasa Interna de Retorno (TIR)</strong> es la tasa de descuento
              que hace el VAN igual a cero. Se calcula numéricamente (Newton-Raphson).
            </p>
            <HelpFormula>{`TIR: tasa r* tal que VAN = 0

Regla de decisión:
  VAN > 0  Y  TIR > costo de capital  →  Aceptar proyecto
  VAN < 0  O  TIR < costo de capital  →  Rechazar proyecto`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Ejemplo concreto">
            <HelpExample>{`Inversión inicial (período 0): −$50.000
Flujos futuros: $15.000 | $18.000 | $20.000 | $22.000
Tasa de descuento (r): 10%

VAN = −50.000 + 15.000/1,1 + 18.000/1,1² + 20.000/1,1³ + 22.000/1,1⁴
    = −50.000 + 13.636 + 14.876 + 15.026 + 15.026
    = $8.564  →  Proyecto rentable ✓

TIR ≈ 21,2%  (> 10% de costo de capital)  →  Aceptar ✓`}</HelpExample>
          </HelpSection>

          <HelpSection title="Errores y casos especiales">
            <HelpWarning>{`• Sin flujo negativo: No hay inversión inicial identificable.
  El VAN se calcula igual, pero la TIR puede no converger.

• Sin flujo positivo: No hay retorno — VAN siempre negativo,
  la TIR no tiene solución real.

• TIR no converge: Ocurre cuando hay múltiples cambios de signo
  en los flujos (ej: flujos + − + − ...). En ese caso puede
  haber múltiples TIR o ninguna; usa solo el VAN como criterio.

• Solo 1 flujo: Se necesitan al menos 2 períodos (la inversión
  en período 0 y al menos un retorno posterior).

• VAN = 0 exactamente: El proyecto da exactamente el costo de
  capital — indiferente desde el punto de vista del VAN.`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <Card title="Flujos de caja y tasa de descuento">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Discount rate */}
            <div style={{ marginBottom: "var(--sp-5)", maxWidth: 240 }}>
              <Field
                label="Tasa de descuento (%)"
                type="number"
                step="any"
                hint="Costo de capital / WACC"
                {...register("discountRate")}
              />
            </div>

            {/* Cash flows */}
            <div style={{ marginBottom: "var(--sp-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Flujos de caja ({fields.length} períodos)
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => append({ amount: "" })}
                >
                  <Plus size={13} style={{ marginRight: 4 }} />
                  Agregar período
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: "var(--sp-2)",
                }}
              >
                {fields.map((field, index) => (
                  <div key={field.id} className="field" style={{ margin: 0 }}>
                    <label className="field-label" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Período {index}</span>
                      {fields.length > 2 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--negative)", padding: 0 }}
                          aria-label={`Eliminar período ${index}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="field-input"
                      placeholder={index === 0 ? "Inversión inicial (negativo)" : "Flujo"}
                      {...register(`flows.${index}.amount`)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="row-gap" style={{ marginTop: "var(--sp-5)" }}>
              <button type="submit" className="btn btn-primary">Calcular</button>
              <button type="button" className="btn btn-ghost" onClick={handleReset}>Limpiar</button>
            </div>
          </form>
        </Card>

        {error && <Alert message={error} />}

        {hasCalculated && result && (
          <>
            <Card title="Resultados">
              <div className="metrics-grid">
                <Metric
                  label="VAN"
                  value={formatCurrency(npvValue)}
                  variant={npvValue >= 0 ? "positive" : "negative"}
                  sub={npvValue >= 0 ? "Proyecto viable" : "Proyecto no viable"}
                />
                {irrValue !== null ? (
                  <Metric
                    label="TIR"
                    value={formatPercent(irrValue)}
                    variant={irrValue >= parseFloat(discountRate) / 100 ? "positive" : "negative"}
                    sub={
                      irrValue >= parseFloat(discountRate) / 100
                        ? "TIR ≥ costo de capital ✓"
                        : "TIR < costo de capital ✗"
                    }
                  />
                ) : (
                  <Metric label="TIR" value="No convergió" variant="negative" sub="Sin solución única" />
                )}
                <Metric label="Tasa de descuento" value={formatPercent(parseFloat(discountRate) / 100)} />
                <Metric label="Períodos" value={`${cashFlows.length}`} sub="Flujos ingresados" />
                <Metric
                  label="Inversión inicial"
                  value={formatCurrency(Math.abs(cashFlows[0]?.amount ?? 0))}
                  sub="Flujo 0 (período inicial)"
                />
                <Metric
                  label="Suma flujos positivos"
                  value={formatCurrency(
                    cashFlows.slice(1).reduce((s, f) => s + Math.max(0, f.amount), 0)
                  )}
                />
              </div>
            </Card>

            {sensitivityData.length > 0 && (
              <Card title="Curva de sensibilidad del VAN">
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
                  El VAN cruza cero en la TIR. El proyecto es viable en las tasas donde VAN &gt; 0.
                </p>
                <CapitalLineChart
                  data={sensitivityData}
                  xDataKey="rate"
                  xLabel="Tasa de descuento (%)"
                  xFormatter={(v) => `${v}%`}
                  lines={[{ key: "VAN", label: "VAN", color: "var(--accent)" }]}
                  yFormatter={formatCurrency}
                  referenceY={0}
                />
              </Card>
            )}

            <Card title="Flujos descontados">
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Flujo nominal</th>
                      <th>Factor descuento</th>
                      <th>Flujo descontado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dcfRows.map((row) => {
                      const rate = parseFloat(discountRate) / 100;
                      const factor = 1 / Math.pow(1 + rate, row.period);
                      return (
                        <tr key={row.period}>
                          <td className="mono">{row.period}</td>
                          <td className={`mono ${row.nominal < 0 ? "text-negative" : ""}`}>
                            {formatCurrency(row.nominal)}
                          </td>
                          <td className="mono">{factor.toFixed(6)}</td>
                          <td className={`mono ${row.discounted < 0 ? "text-negative" : "text-positive"}`}>
                            {formatCurrency(row.discounted)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={3} style={{ textAlign: "right", paddingRight: "var(--sp-4)" }}>
                        VAN Total
                      </td>
                      <td className={`mono ${npvValue >= 0 ? "text-positive" : "text-negative"}`}>
                        {formatCurrency(npvValue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
