import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Repeat } from "lucide-react";
import { useAnnuity } from "@/application";
import type { AnnuityType } from "@/domain";
import { Field, Card, Metric, Alert, PageHeader, Tabs } from "@/presentation/components/ui";
import {
  HelpModal,
  HelpSection,
  HelpFormula,
  HelpExample,
  HelpWarning,
  InterestBadge,
} from "@/presentation/components/HelpModal";
import { StackedBarChart } from "@/presentation/components/Charts";
import { formatCurrency, formatPercent } from "@/presentation/utils/format";
import "@/presentation/components/ui.css";

interface RawForm {
  payment: string;
  rate:    string;
  periods: string;
}

const TYPES: { id: AnnuityType; label: string }[] = [
  { id: "ordinary", label: "Ordinaria (vencida)" },
  { id: "due",      label: "Anticipada (adelantada)" },
];

function AnnuityCalculator({ type }: { type: AnnuityType }) {
  const { result, error, calculate, reset } = useAnnuity();
  const { register, handleSubmit, watch } = useForm<RawForm>({
    defaultValues: { payment: "1000", rate: "8", periods: "12" },
  });

  const rateStr = watch("rate");

  const onSubmit = (data: RawForm) => {
    calculate({
      payment: parseFloat(data.payment),
      rate:    parseFloat(data.rate) / 100,
      periods: parseInt(data.periods, 10),
      type,
    });
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.schedule.map((row) => ({
      period:    row.period,
      Principal: row.principalReduction,
      Interés:   row.interest,
    }));
  }, [result]);

  return (
    <>
      <Card title="Parámetros">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid form-grid-3" style={{ marginBottom: "var(--sp-5)" }}>
            <Field
              label="Cuota por período"
              type="number"
              step="any"
              hint="Pago por cada período"
              {...register("payment")}
            />
            <Field
              label="Tasa por período (%)"
              type="number"
              step="any"
              hint="Ej: 8 = 8% por período"
              {...register("rate")}
            />
            <Field
              label="Número de períodos"
              type="number"
              step="1"
              min="1"
              hint="Cantidad de cuotas"
              {...register("periods")}
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
          <Card title="Resultados">
            <div className="metrics-grid">
              <Metric label="Valor Actual (VA)"      value={formatCurrency(result.presentValue)} variant="accent" />
              <Metric label="Valor Final (VF)"       value={formatCurrency(result.futureValue)} />
              <Metric label="Total pagado"           value={formatCurrency(result.totalPayments)} />
              <Metric label="Total intereses"        value={formatCurrency(result.totalInterest)} variant="negative" />
              <Metric label="Tasa por período"       value={formatPercent(parseFloat(rateStr) / 100)} />
              <Metric
                label="Costo del dinero"
                value={formatPercent(result.totalInterest / result.totalPayments)}
                sub="Interés / Total pagado"
              />
            </div>
          </Card>

          <Card title="Composición por período">
            <StackedBarChart
              data={chartData.slice(0, 120)}
              bars={[
                { key: "Principal", label: "Principal", color: "var(--accent)" },
                { key: "Interés",   label: "Interés",   color: "var(--negative)" },
              ]}
              yFormatter={formatCurrency}
            />
          </Card>

          <Card title="Tabla de pagos">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Cuota</th>
                    <th>Principal</th>
                    <th>Interés</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((row) => (
                    <tr key={row.period}>
                      <td className="mono">{row.period}</td>
                      <td className="mono">{formatCurrency(row.payment)}</td>
                      <td className="mono">{formatCurrency(row.principalReduction)}</td>
                      <td className="mono text-negative">{formatCurrency(row.interest)}</td>
                      <td className="mono">{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

export function AnnuityPage() {
  const [type, setType] = useState<AnnuityType>("ordinary");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <PageHeader
        icon={<Repeat size={22} />}
        title="Anualidades"
        subtitle="Interés compuesto — serie de pagos iguales y periódicos"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="Anualidades — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés utilizado">
            <InterestBadge type="compound" />
            <p>
              Los pagos se descuentan/capitalizan con <strong>interés compuesto</strong>.
              Cada cuota se actualiza al período 0 (VA) o se proyecta al final (VF).
            </p>
          </HelpSection>

          <HelpSection title="Tipos de anualidad">
            <p>
              <strong>Ordinaria (vencida):</strong> el pago ocurre al <em>final</em> de cada período.
              Es la más común (cuotas de préstamos, hipotecas).
            </p>
            <p>
              <strong>Anticipada:</strong> el pago ocurre al <em>inicio</em> de cada período.
              Equivale a multiplicar la ordinaria por (1 + i), ya que cada pago se actualiza un período menos.
            </p>
          </HelpSection>

          <HelpSection title="Fórmulas (anualidad ordinaria)">
            <HelpFormula>{`VA = C × [1 − (1 + i)^−n] / i
VF = C × [(1 + i)^n − 1] / i

C = Cuota (pago por período)
i = Tasa por período (decimal)
n = Número de períodos

Anticipada: multiplicar VA o VF por (1 + i)`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Ejemplo concreto">
            <HelpExample>{`C = $1.000/mes | i = 8% anual → 0,6667%/mes | n = 12 meses

VA = 1.000 × [1 − (1,006667)^−12] / 0,006667
   = 1.000 × [1 − 0,9234] / 0,006667
   = 1.000 × 11,496 = $11.495,78

VF = 1.000 × [(1,006667)^12 − 1] / 0,006667
   = 1.000 × 12,508 = $12.507,60

Total pagado      = $1.000 × 12 = $12.000
Intereses totales = $12.507,60 − $12.000 = $507,60`}</HelpExample>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• Cuota ≤ 0: Los pagos deben ser positivos.
• Períodos no enteros: Se requiere un número entero de cuotas.
  No existe "2,5 cuotas" — redondea al entero más próximo.
• Tasa = 0%: Caso especial válido. La calculadora lo maneja:
  VA = VF = C × n (sin descuento ni capitalización).`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <Tabs
          tabs={TYPES}
          active={type}
          onChange={(id) => setType(id as AnnuityType)}
        />
        <AnnuityCalculator key={type} type={type} />
      </div>
    </>
  );
}
