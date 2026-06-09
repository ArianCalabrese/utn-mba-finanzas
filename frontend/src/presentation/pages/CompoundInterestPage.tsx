import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { BarChart3 } from "lucide-react";
import { useCompoundInterest } from "@/application";
import { FREQUENCY_LABELS, type Frequency } from "@/domain";
import {
  Field,
  SelectField,
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

const FREQ_OPTIONS = (
  Object.entries(FREQUENCY_LABELS) as [string, string][]
).map(([value, label]) => ({ value: Number(value), label }));

const schema = z.object({
  principal: z.coerce.number().positive("El capital debe ser mayor que 0"),
  rate: z.coerce
    .number()
    .min(0, "La tasa no puede ser negativa")
    .max(100, "Ingresa en porcentaje"),
  time: z.coerce.number().positive("El tiempo debe ser mayor que 0"),
  frequency: z.coerce.number(),
});

type FormValues = z.infer<typeof schema>;

export function CompoundInterestPage() {
  const { result, error, calculate, reset } = useCompoundInterest();
  const [showHelp, setShowHelp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetForm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { principal: 10000, rate: 8, time: 5, frequency: 12 },
  });

  const onSubmit = (data: FormValues) => {
    calculate({
      principal: data.principal,
      rate: data.rate / 100,
      time: data.time,
      frequency: data.frequency as Frequency,
    });
  };

  const handleReset = () => { resetForm(); reset(); };

  // Limit chart to max 120 rows for readability
  const MAX_CHART = 120;
  const chartData = result
    ? (result.schedule.length > MAX_CHART
        ? result.schedule.filter((_, i) => i % Math.ceil(result.schedule.length / MAX_CHART) === 0)
        : result.schedule
      ).map((r) => ({
        period: r.period,
        "Saldo": r.closingBalance,
        "Interés": r.interest,
      }))
    : [];

  return (
    <>
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Interés Compuesto"
        subtitle="VF = VA · (1 + r/m)^(m·t)  —  El interés se capitaliza sobre el saldo acumulado"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="Interés Compuesto — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés">
            <InterestBadge type="compound" />
            <p>
              El interés de cada período se agrega al capital, y en el período siguiente
              ese interés también genera nuevos intereses (<em>interés sobre interés</em>).
            </p>
          </HelpSection>

          <HelpSection title="Fórmulas">
            <HelpFormula>{`VF  = P × (1 + r/m)^(m × t)
TEA = (1 + r/m)^m − 1

P   = Capital inicial
r   = Tasa nominal anual (en decimal, ej: 0,08 para 8%)
m   = Capitalización por año (12 = mensual, 4 = trimestral…)
t   = Tiempo en años
TEA = Tasa Efectiva Anual (la tasa anual real)`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Ejemplo concreto">
            <HelpExample>{`P = $10.000 | r = 8% anual | m = 12 (mensual) | t = 5 años

Tasa mensual  = 8% / 12 = 0,6667%
Períodos tot. = 12 × 5 = 60
VF = 10.000 × (1,006667)^60 = $14.898,46
TEA = (1,006667)^12 − 1 = 8,30%

→ Comparación con Interés SIMPLE al 8% durante 5 años:
  VF simple = 10.000 × (1 + 0,08×5) = $14.000
  El compuesto genera $898 adicionales gracias a la reinversión.`}</HelpExample>
          </HelpSection>

          <HelpSection title="¿Por qué capitalizar más frecuente da más?">
            <p>
              Con la misma tasa nominal, capitalizar mensualmente genera más que capitalizar
              anualmente porque el interés se reinvierte antes y trabaja durante más tiempo.
              La TEA refleja el rendimiento real sin importar la frecuencia.
            </p>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• Capital ≤ 0: No hay base sobre la que calcular interés.
• Tiempo ≤ 0: Debe transcurrir al menos un período.
• Tasa tan negativa que (1 + r/m) ≤ 0: El factor de capitalización
  sería cero o negativo, lo que no tiene sentido matemático.
  Ej: tasa = −150% con capitalización anual → 1 + (−1,50) = −0,50 ✗`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <Card title="Parámetros">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-grid form-grid-2" style={{ marginBottom: "var(--sp-5)" }}>
              <Field
                label="Capital inicial (P)"
                type="number"
                step="any"
                error={errors.principal?.message}
                {...register("principal")}
              />
              <Field
                label="Tasa nominal anual (%)"
                type="number"
                step="any"
                error={errors.rate?.message}
                hint="Se convertirá a tasa por período"
                {...register("rate")}
              />
              <Field
                label="Tiempo (años)"
                type="number"
                step="any"
                error={errors.time?.message}
                {...register("time")}
              />
              <SelectField
                label="Capitalización"
                options={FREQ_OPTIONS}
                error={errors.frequency?.message}
                {...register("frequency")}
              />
            </div>
            <div className="row-gap">
              <button type="submit" className="btn btn-primary">Calcular</button>
              <button type="button" className="btn btn-ghost" onClick={handleReset}>Limpiar</button>
            </div>
          </form>
        </Card>

        {error && <Alert message={error} />}

        {result && (
          <>
            <Card title="Resultados">
              <div className="metrics-grid">
                <Metric label="Valor futuro" value={formatCurrency(result.futureValue)} variant="accent" />
                <Metric label="Interés total" value={formatCurrency(result.totalInterest)} variant="positive" />
                <Metric
                  label="Tasa efectiva anual (TEA)"
                  value={formatPercent(result.effectiveRate)}
                  sub="Equivalente anual real"
                />
                <Metric
                  label="Rendimiento sobre capital"
                  value={formatPercent(result.totalInterest / (result.futureValue - result.totalInterest))}
                />
              </div>
            </Card>

            <Card title="Evolución del saldo">
              <CapitalLineChart
                data={chartData}
                lines={[
                  { key: "Saldo", label: "Saldo acumulado", color: "var(--accent)" },
                  { key: "Interés", label: "Interés del período", color: "var(--positive)" },
                ]}
              />
            </Card>

            <Card title="Tabla de capitalización">
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
                {result.schedule.length > 50
                  ? `Mostrando primeros y últimos 25 de ${result.schedule.length} períodos`
                  : `${result.schedule.length} períodos`}
              </p>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Saldo inicial</th>
                      <th>Interés</th>
                      <th>Saldo final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.schedule.length > 50
                      ? [
                          ...result.schedule.slice(0, 25),
                          ...result.schedule.slice(-25),
                        ]
                      : result.schedule
                    ).map((row, idx, arr) => (
                      <>
                        {idx === 25 && result.schedule.length > 50 && (
                          <tr key="ellipsis">
                            <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--sans)" }}>
                              · · · {result.schedule.length - 50} períodos omitidos · · ·
                            </td>
                          </tr>
                        )}
                        <tr key={row.period}>
                          <td>{row.period}</td>
                          <td>{formatCurrency(row.openingBalance)}</td>
                          <td>{formatCurrency(row.interest)}</td>
                          <td>{formatCurrency(row.closingBalance)}</td>
                        </tr>
                      </>
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
