import { useState } from "react";
import { useForm } from "react-hook-form";
import { Infinity as InfinityIcon } from "lucide-react";
import { usePerpetuity } from "@/application";
import { Field, Card, Metric, Alert, PageHeader } from "@/presentation/components/ui";
import {
  HelpModal,
  HelpSection,
  HelpFormula,
  HelpExample,
  HelpWarning,
  InterestBadge,
} from "@/presentation/components/HelpModal";
import { formatCurrency, formatPercent } from "@/presentation/utils/format";
import "@/presentation/components/ui.css";

interface ConstantForm {
  payment: string;
  rate:    string;
}

interface GrowingForm {
  payment:    string;
  rate:       string;
  growthRate: string;
}

function ConstantPerpetuity() {
  const { result, error, calculate, reset } = usePerpetuity();
  const { register, handleSubmit } = useForm<ConstantForm>({
    defaultValues: { payment: "500", rate: "5" },
  });

  const onSubmit = (data: ConstantForm) => {
    calculate({
      payment:    parseFloat(data.payment),
      rate:       parseFloat(data.rate) / 100,
      growthRate: 0,
    });
  };

  // Build sensitivity table: VA at different rates
  const payment = result?.payment ?? 500;
  const rates = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.10, 0.12, 0.15];

  return (
    <>
      <Card title="Parámetros">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid form-grid-2" style={{ marginBottom: "var(--sp-5)" }}>
            <Field
              label="Pago periódico (C)"
              type="number"
              step="any"
              hint="Flujo constante por período"
              {...register("payment")}
            />
            <Field
              label="Tasa por período (%)"
              type="number"
              step="any"
              hint="Tasa de descuento requerida"
              {...register("rate")}
            />
          </div>
          <div className="row-gap">
            <button type="submit" className="btn btn-primary">Calcular</button>
            <button type="button" className="btn btn-ghost" onClick={reset}>Limpiar</button>
          </div>
        </form>
      </Card>

      {error && <Alert message={error} />}

      {result && (
        <>
          <Card title="Resultado">
            <div className="metrics-grid">
              <Metric label="Valor Actual (VA)" value={formatCurrency(result.presentValue)} variant="accent" />
              <Metric label="Pago periódico"    value={formatCurrency(result.payment)} />
              <Metric label="Tasa de descuento" value={formatPercent(result.rate)} />
              <Metric label="Fórmula" value="C / i" sub="VA = Pago / Tasa" />
            </div>
          </Card>

          <Card title="Sensibilidad: VA según tasa de descuento">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tasa (%)</th>
                    <th>Valor Actual</th>
                    <th>Diferencia vs tasa base</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => {
                    const va = payment / r;
                    const diff = va - result.presentValue;
                    return (
                      <tr key={r} style={{ fontWeight: Math.abs(r - result.rate) < 0.0001 ? 600 : undefined }}>
                        <td className="mono">{formatPercent(r)}</td>
                        <td className="mono">{formatCurrency(va)}</td>
                        <td className={`mono ${diff >= 0 ? "text-positive" : "text-negative"}`}>
                          {diff >= 0 ? "+" : ""}{formatCurrency(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

function GrowingPerpetuity() {
  const { result, error, calculate, reset } = usePerpetuity();
  const { register, handleSubmit } = useForm<GrowingForm>({
    defaultValues: { payment: "500", rate: "8", growthRate: "3" },
  });

  const onSubmit = (data: GrowingForm) => {
    calculate({
      payment:    parseFloat(data.payment),
      rate:       parseFloat(data.rate) / 100,
      growthRate: parseFloat(data.growthRate) / 100,
    });
  };

  // Sensitivity: different growth rates
  const payment    = result?.payment    ?? 500;
  const baseRate   = result?.rate       ?? 0.08;
  const growthRates = [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07];

  return (
    <>
      <Card title="Parámetros">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid form-grid-3" style={{ marginBottom: "var(--sp-5)" }}>
            <Field
              label="Primer pago (C₁)"
              type="number"
              step="any"
              hint="Pago al final del primer período"
              {...register("payment")}
            />
            <Field
              label="Tasa de descuento (%)"
              type="number"
              step="any"
              hint="Debe ser mayor que la tasa de crecimiento"
              {...register("rate")}
            />
            <Field
              label="Tasa de crecimiento (%)"
              type="number"
              step="any"
              hint="g < i para que la serie converja"
              {...register("growthRate")}
            />
          </div>
          <div className="row-gap">
            <button type="submit" className="btn btn-primary">Calcular</button>
            <button type="button" className="btn btn-ghost" onClick={reset}>Limpiar</button>
          </div>
        </form>
      </Card>

      {error && <Alert message={error} />}

      {result && (
        <>
          <Card title="Resultado">
            <div className="metrics-grid">
              <Metric label="Valor Actual (VA)"      value={formatCurrency(result.presentValue)} variant="accent" />
              <Metric label="Primer pago"            value={formatCurrency(result.payment)} />
              <Metric label="Tasa de descuento (i)"  value={formatPercent(result.rate)} />
              <Metric label="Tasa de crecimiento (g)" value={formatPercent(result.growthRate ?? 0)} />
              <Metric label="Spread (i - g)"         value={formatPercent(result.rate - (result.growthRate ?? 0))} />
              <Metric label="Fórmula" value="C / (i − g)" sub="Modelo de Gordon" />
            </div>
          </Card>

          <Card title="Sensibilidad: VA según tasa de crecimiento">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>g (%)</th>
                    <th>Spread (i−g)</th>
                    <th>Valor Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {growthRates
                    .filter((g) => g < baseRate)
                    .map((g) => {
                      const va = payment / (baseRate - g);
                      const isCurrent = Math.abs(g - (result.growthRate ?? 0)) < 0.0001;
                      return (
                        <tr key={g} style={{ fontWeight: isCurrent ? 600 : undefined }}>
                          <td className="mono">{formatPercent(g)}</td>
                          <td className="mono">{formatPercent(baseRate - g)}</td>
                          <td className="mono text-accent">{formatCurrency(va)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

export function PerpetuityPage() {
  const [mode, setMode] = useState<"constant" | "growing">("constant");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <PageHeader
        icon={<InfinityIcon size={22} />}
        title="Perpetuidades"
        subtitle="Serie infinita de pagos — constante (VA = C/i) o creciente (VA = C/(i−g))"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="Perpetuidades — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés utilizado">
            <InterestBadge type="compound" />
            <p>
              Una perpetuidad es una renta que dura indefinidamente.
              Su valor actual se obtiene descontando todos los flujos futuros al infinito,
              lo que converge a una fórmula cerrada muy simple.
            </p>
          </HelpSection>

          <HelpSection title="Fórmulas">
            <HelpFormula>{`Constante:  VA = C / i
Creciente:  VA = C / (i − g)   ← Modelo de Gordon

C = Pago del primer período
i = Tasa de descuento (decimal)
g = Tasa de crecimiento perpetuo del pago (decimal)
    Condición obligatoria: i > g`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Ejemplo constante">
            <HelpExample>{`C = $500/año | i = 5% anual

VA = 500 / 0,05 = $10.000

Interpretación: para recibir $500 para siempre,
asumiendo un costo de capital del 5%,
deberías pagar hoy exactamente $10.000.`}</HelpExample>
          </HelpSection>

          <HelpSection title="Ejemplo creciente (Modelo de Gordon)">
            <HelpExample>{`C₁ = $500 (primer pago) | i = 8% | g = 3%

VA = 500 / (0,08 − 0,03) = 500 / 0,05 = $10.000

Los pagos crecen 3% cada año: $500, $515, $530,45...
pero al descontarlos al 8%, su VA converge a $10.000.`}</HelpExample>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• i = 0% (constante): VA = C / 0 → división por cero.
  Si no hay tasa de descuento, los $500 anuales no tienen
  valor presente finito — la suma es infinita.

• i ≤ g (creciente): Si el crecimiento supera o iguala a la
  tasa de descuento, la serie diverge (los pagos crecen más
  rápido de lo que se descuentan → VA infinito).
  Siempre debe cumplirse i > g para que el modelo sea válido.
  Ej: i=5%, g=5% → VA = C/0 ✗ (diverge)
      i=5%, g=6% → VA = C/(−0,01) < 0 ✗ (sin sentido económico)`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <div className="tabs">
          <button
            className={`tab${mode === "constant" ? " active" : ""}`}
            onClick={() => setMode("constant")}
          >
            Constante
          </button>
          <button
            className={`tab${mode === "growing" ? " active" : ""}`}
            onClick={() => setMode("growing")}
          >
            Creciente
          </button>
        </div>
        {mode === "constant" ? (
          <ConstantPerpetuity key="constant" />
        ) : (
          <GrowingPerpetuity key="growing" />
        )}
      </div>
    </>
  );
}
