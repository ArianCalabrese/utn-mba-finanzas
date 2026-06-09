import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Activity } from "lucide-react";
import { useGradient } from "@/application";
import type { GradientType } from "@/domain";
import { Field, Card, Metric, Alert, PageHeader, Tabs } from "@/presentation/components/ui";
import {
  HelpModal,
  HelpSection,
  HelpFormula,
  HelpExample,
  HelpWarning,
  InterestBadge,
} from "@/presentation/components/HelpModal";
import { CapitalLineChart } from "@/presentation/components/Charts";
import { formatCurrency, formatPercent } from "@/presentation/utils/format";
import "@/presentation/components/ui.css";

interface ArithmeticForm {
  basePayment: string;
  gradient:    string;
  rate:        string;
  periods:     string;
}

interface GeometricForm {
  basePayment: string;
  gradient:    string;
  rate:        string;
  periods:     string;
}

const TYPES: { id: GradientType; label: string }[] = [
  { id: "arithmetic", label: "Aritmético" },
  { id: "geometric",  label: "Geométrico" },
];

function GradientCalculator({ type }: { type: GradientType }) {
  const { result, error, calculate, reset } = useGradient();
  const isArithmetic = type === "arithmetic";

  const { register, handleSubmit } = useForm<ArithmeticForm | GeometricForm>({
    defaultValues: isArithmetic
      ? { basePayment: "1000", gradient: "100", rate: "8", periods: "8" }
      : { basePayment: "1000", gradient: "5",   rate: "8", periods: "8" },
  });

  const onSubmit = (data: ArithmeticForm | GeometricForm) => {
    calculate({
      basePayment: parseFloat(data.basePayment),
      gradient:    isArithmetic
        ? parseFloat(data.gradient)
        : parseFloat(data.gradient) / 100,
      rate:        parseFloat(data.rate) / 100,
      periods:     parseInt(data.periods, 10),
      type,
    });
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.schedule.map((row) => ({
      period:     row.period,
      Pago:       row.payment,
      "VA Pago":  row.presentValue,
    }));
  }, [result]);

  return (
    <>
      <Card title="Parámetros">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid form-grid-2" style={{ marginBottom: "var(--sp-5)" }}>
            <Field
              label="Pago base (A₁)"
              type="number"
              step="any"
              hint="Pago del primer período"
              {...register("basePayment")}
            />
            <Field
              label={isArithmetic ? "Gradiente G (monto por período)" : "Gradiente g (% de crecimiento)"}
              type="number"
              step="any"
              hint={isArithmetic ? "Incremento absoluto por período" : "Tasa de crecimiento del pago (ej: 5 = 5%)"}
              {...register("gradient")}
            />
            <Field
              label="Tasa de descuento (%)"
              type="number"
              step="any"
              hint="Tasa por período"
              {...register("rate")}
            />
            <Field
              label="Número de períodos"
              type="number"
              step="1"
              min="1"
              hint="Duración del gradiente"
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
              <Metric label="Valor Actual (VA)"  value={formatCurrency(result.presentValue)} variant="accent" />
              <Metric label="Valor Final (VF)"   value={formatCurrency(result.futureValue)} />
              <Metric label="Primer pago"        value={formatCurrency(result.schedule[0]?.payment ?? 0)} />
              <Metric label="Último pago"        value={formatCurrency(result.schedule[result.schedule.length - 1]?.payment ?? 0)} />
              <Metric label="Gradiente aplicado" value={isArithmetic
                ? formatCurrency(result.gradient)
                : formatPercent(result.gradient)
              } />
              <Metric label="Tasa de descuento" value={formatPercent(result.rate)} />
            </div>
          </Card>

          <Card title="Pagos por período">
            <CapitalLineChart
              data={chartData}
              lines={[
                { key: "Pago",      label: "Pago nominal",    color: "var(--accent)" },
                { key: "VA Pago",   label: "Valor actual",    color: "var(--positive)" },
              ]}
              yFormatter={formatCurrency}
            />
          </Card>

          <Card title="Tabla de flujos">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Pago</th>
                    <th>VA del pago</th>
                    <th>VA acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.map((row, idx) => (
                    <tr key={row.period}>
                      <td className="mono">{row.period}</td>
                      <td className="mono">{formatCurrency(row.payment)}</td>
                      <td className="mono">{formatCurrency(row.presentValue)}</td>
                      <td className="mono">{formatCurrency(
                        result.schedule.slice(0, idx + 1).reduce((acc, r) => acc + r.presentValue, 0)
                      )}</td>
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

export function GradientPage() {
  const [type, setType] = useState<GradientType>("arithmetic");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <PageHeader
        icon={<Activity size={22} />}
        title="Gradientes"
        subtitle="Interés compuesto — pagos que crecen período a período (aritmético o geométrico)"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="Gradientes — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés utilizado">
            <InterestBadge type="compound" />
            <p>
              Cada pago individual se descuenta al presente usando <strong>interés compuesto</strong>.
              El VA total es la suma de los valores actuales de cada flujo.
            </p>
          </HelpSection>

          <HelpSection title="¿Qué es un gradiente?">
            <p>
              Una serie de pagos en la que cada cuota es mayor (o menor) que la anterior
              en una cantidad o porcentaje constante.
            </p>
          </HelpSection>

          <HelpSection title="Gradiente Aritmético">
            <HelpFormula>{`Pago del período t: A + G × (t − 1)

A = Pago del primer período (base)
G = Incremento absoluto por período (puede ser negativo)
t = Número de período (t = 1, 2, 3, ...)

VA = Σ [A + G(t−1)] / (1+i)^t   (suma para t=1..n)`}</HelpFormula>
            <HelpExample>{`A = $1.000 | G = $100 | i = 8% | n = 8 períodos

Pagos: $1.000, $1.100, $1.200, $1.300, ..., $1.700
Cada período, la cuota sube exactamente $100.`}</HelpExample>
          </HelpSection>

          <HelpSection title="Gradiente Geométrico">
            <HelpFormula>{`Pago del período t: A × (1 + g)^(t − 1)

A = Pago del primer período (base)
g = Tasa de crecimiento por período (decimal)
    Ej: 5% → ingresar 5 en la calculadora

VA = Σ [A × (1+g)^(t−1)] / (1+i)^t   (suma para t=1..n)`}</HelpFormula>
            <HelpExample>{`A = $1.000 | g = 5%/período | i = 8% | n = 8 períodos

Pagos: $1.000, $1.050, $1.102,50, $1.157,63, ..., $1.340,10
Cada período, la cuota sube un 5% sobre la cuota anterior.`}</HelpExample>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• n < 1: Debe haber al menos un período.
• Tasa ≤ −100%: El factor de descuento (1+i)^t sería cero o
  negativo — no existe un valor actual válido.
• Pago base ≤ 0: El primer pago debe ser positivo.
• Gradiente geométrico con g muy alto: El cálculo es válido para
  cualquier g, pero si g > i los pagos futuros dominan cada vez
  más y el VA puede resultar muy grande.`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <Tabs
          tabs={TYPES}
          active={type}
          onChange={(id) => setType(id as GradientType)}
        />
        <GradientCalculator key={type} type={type} />
      </div>
    </>
  );
}
