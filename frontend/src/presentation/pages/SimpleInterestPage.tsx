import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { TrendingUp } from "lucide-react";
import { useSimpleInterest } from "@/application";
import {
  Field,
  Card,
  Metric,
  Alert,
  PageHeader,
} from "@/presentation/components/ui";
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

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  principal: z.coerce.number().positive("El capital debe ser mayor que 0"),
  rate: z.coerce
    .number()
    .min(0, "La tasa no puede ser negativa")
    .max(100, "Ingresa la tasa en porcentaje (ej: 5 para 5%)"),
  time: z.coerce.number().positive("El tiempo debe ser mayor que 0"),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ───────────────────────────────────────────────────────────────

export function SimpleInterestPage() {
  const { result, error, calculate, reset } = useSimpleInterest();
  const [showHelp, setShowHelp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { principal: 10000, rate: 5, time: 3 },
  });

  const onSubmit = (data: FormValues) => {
    calculate({
      principal: data.principal,
      rate: data.rate / 100, // UI en % → decimal
      time: data.time,
    });
  };

  const handleReset = () => {
    resetForm();
    reset();
  };

  // Chart data
  const chartData = result?.schedule.map((r) => ({
    period: r.period,
    Capital: result.schedule[0].amount - (r.interest - result.schedule[0].interest + 0),
    Monto: r.amount,
    Interés: r.interest,
  })) ?? [];

  return (
    <>
      <PageHeader
        icon={<TrendingUp size={22} />}
        title="Interés Simple"
        subtitle="I = P · r · t  —  El interés se calcula siempre sobre el capital inicial"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="Interés Simple — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés">
            <InterestBadge type="simple" />
            <p>
              El interés se calcula siempre sobre el capital original.
              No hay reinversión: el interés de cada período es siempre el mismo monto.
            </p>
          </HelpSection>

          <HelpSection title="Fórmulas">
            <HelpFormula>{`I  = P × r × t
VF = P × (1 + r × t)
VF = P + I

P  = Capital inicial (principal)
r  = Tasa de interés por período (en decimal, ej: 0,05 para 5%)
t  = Tiempo (en períodos)
I  = Interés total generado`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Ejemplo concreto">
            <HelpExample>{`P = $10.000 | r = 5% anual | t = 3 años

I  = 10.000 × 0,05 × 3 = $1.500
VF = 10.000 + 1.500     = $11.500

Año 1: interés = $500   → saldo = $10.500
Año 2: interés = $500   → saldo = $11.000  (¡siempre sobre $10.000!)
Año 3: interés = $500   → saldo = $11.500`}</HelpExample>
          </HelpSection>

          <HelpSection title="Diferencia con interés compuesto">
            <p>
              Con el mismo ejemplo al 5% compuesto (capitalización anual):
            </p>
            <HelpExample>{`Año 1: $10.000 × 5% = $500   → saldo = $10.500
Año 2: $10.500 × 5% = $525   → saldo = $11.025  (interés sobre $10.500)
Año 3: $11.025 × 5% = $551,25 → saldo = $11.576,25

Simple:   $11.500  |  Compuesto: $11.576,25
Diferencia: $76,25 más con interés compuesto.`}</HelpExample>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• Capital ≤ 0: Sin capital no hay base para calcular interés.
• Tasa negativa: La tasa puede ser 0% (sin rendimiento), pero no
  puede ser negativa en este contexto.
• Tiempo ≤ 0: Debe transcurrir al menos un período.`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        {/* ── Form ── */}
        <Card title="Parámetros">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-grid form-grid-3" style={{ marginBottom: "var(--sp-5)" }}>
              <Field
                label="Capital inicial (P)"
                type="number"
                step="any"
                error={errors.principal?.message}
                hint="En la moneda que prefieras"
                {...register("principal")}
              />
              <Field
                label="Tasa de interés anual (%)"
                type="number"
                step="any"
                error={errors.rate?.message}
                hint="Ingresa en porcentaje: 5 = 5%"
                {...register("rate")}
              />
              <Field
                label="Tiempo (años)"
                type="number"
                step="any"
                error={errors.time?.message}
                hint="Puede ser decimal: 0.5 = 6 meses"
                {...register("time")}
              />
            </div>
            <div className="row-gap">
              <button type="submit" className="btn btn-primary">
                Calcular
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleReset}>
                Limpiar
              </button>
            </div>
          </form>
        </Card>

        {/* ── Error ── */}
        {error && <Alert message={error} />}

        {/* ── Results ── */}
        {result && (
          <>
            <Card title="Resultados">
              <div className="metrics-grid">
                <Metric
                  label="Monto final"
                  value={formatCurrency(result.amount)}
                  variant="accent"
                />
                <Metric
                  label="Interés total"
                  value={formatCurrency(result.interest)}
                  variant="positive"
                />
                <Metric
                  label="Capital inicial"
                  value={formatCurrency(result.schedule[0]?.amount - result.interest)}
                />
                <Metric
                  label="Tasa efectiva total"
                  value={formatPercent(result.interest / (result.amount - result.interest))}
                  sub="Sobre capital inicial"
                />
              </div>
            </Card>

            {/* ── Chart ── */}
            <Card title="Evolución del capital">
              <CapitalLineChart
                data={chartData}
                lines={[
                  { key: "Monto", label: "Monto acumulado", color: "var(--accent)" },
                  { key: "Interés", label: "Interés acumulado", color: "var(--positive)" },
                ]}
              />
            </Card>

            {/* ── Table ── */}
            <Card title="Tabla por período">
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Interés acumulado</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.schedule.map((row) => (
                      <tr key={row.period}>
                        <td>{row.period}</td>
                        <td>{formatCurrency(row.interest)}</td>
                        <td>{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
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
