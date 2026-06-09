import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Clock } from "lucide-react";
import { useTimeValue } from "@/application";
import type { TimeValueSolveFor } from "@/application";
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
import { formatCurrency, formatPercent, formatNumber } from "@/presentation/utils/format";
import "@/presentation/components/ui.css";

// ─── Per-mode form configs ────────────────────────────────────────────────────

const MODES: { id: TimeValueSolveFor; label: string }[] = [
  { id: "fv",      label: "Calcular VF" },
  { id: "pv",      label: "Calcular VA" },
  { id: "rate",    label: "Calcular Tasa" },
  { id: "periods", label: "Calcular n" },
];

interface RawForm {
  presentValue: string;
  futureValue:  string;
  rate:         string;
  periods:      string;
}

const DEFAULT_VALUES: Record<TimeValueSolveFor, Partial<RawForm>> = {
  fv:      { presentValue: "10000", rate: "8", periods: "5" },
  pv:      { futureValue:  "14693", rate: "8", periods: "5" },
  rate:    { presentValue: "10000", futureValue: "14693", periods: "5" },
  periods: { presentValue: "10000", futureValue: "14693", rate: "8" },
};

// ─── Sub-calculator (keyed per mode so it resets) ────────────────────────────

function TimeValueCalculator({ solveFor }: { solveFor: TimeValueSolveFor }) {
  const { result, error, calculate, reset } = useTimeValue();
  const { register, handleSubmit } = useForm<RawForm>({
    defaultValues: DEFAULT_VALUES[solveFor] as RawForm,
  });

  const onSubmit = (data: RawForm) => {
    const parse = (v: string | undefined) => (!v || v.trim() === "" ? undefined : parseFloat(v));
    calculate({
      solveFor,
      presentValue: parse(data.presentValue),
      futureValue:  parse(data.futureValue),
      rate:         parse(data.rate) !== undefined ? parse(data.rate)! / 100 : undefined,
      periods:      parse(data.periods),
    });
  };

  const handleReset = () => { reset(); };

  // Chart: growth curve from period 0 to n
  const chartData = useMemo(() => {
    if (!result) return [];
    const { presentValue, rate, periods } = result;
    const n = Math.ceil(periods);
    return Array.from({ length: n + 1 }, (_, i) => ({
      period: i,
      Valor: presentValue * Math.pow(1 + rate, i),
    }));
  }, [result]);

  const showPV      = solveFor !== "pv";
  const showFV      = solveFor !== "fv";
  const showRate    = solveFor !== "rate";
  const showPeriods = solveFor !== "periods";

  return (
    <>
      <Card title="Parámetros">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid form-grid-2" style={{ marginBottom: "var(--sp-5)" }}>
            {showPV && (
              <Field label="Valor Actual (VA)" type="number" step="any" hint="Capital presente" {...register("presentValue")} />
            )}
            {showFV && (
              <Field label="Valor Final (VF)" type="number" step="any" hint="Monto futuro" {...register("futureValue")} />
            )}
            {showRate && (
              <Field label="Tasa por período (%)" type="number" step="any" hint="Ingresa en porcentaje: 8 = 8%" {...register("rate")} />
            )}
            {showPeriods && (
              <Field label="Número de períodos (n)" type="number" step="any" hint="Cantidad de períodos" {...register("periods")} />
            )}
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
              <Metric
                label="Valor Actual (VA)"
                value={formatCurrency(result.presentValue)}
                variant={solveFor === "pv" ? "accent" : "default"}
              />
              <Metric
                label="Valor Final (VF)"
                value={formatCurrency(result.futureValue)}
                variant={solveFor === "fv" ? "accent" : "default"}
              />
              <Metric
                label="Tasa por período"
                value={formatPercent(result.rate)}
                variant={solveFor === "rate" ? "accent" : "default"}
              />
              <Metric
                label="Períodos (n)"
                value={formatNumber(result.periods, 4)}
                variant={solveFor === "periods" ? "accent" : "default"}
              />
              <Metric
                label="Rendimiento total"
                value={formatPercent((result.futureValue - result.presentValue) / result.presentValue)}
                sub="Sobre capital inicial"
              />
            </div>
          </Card>

          <Card title="Curva de crecimiento">
            <CapitalLineChart
              data={chartData}
              lines={[{ key: "Valor", label: "Valor", color: "var(--accent)" }]}
              yFormatter={formatCurrency}
            />
          </Card>
        </>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TimeValuePage() {
  const [solveFor, setSolveFor] = useState<TimeValueSolveFor>("fv");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <PageHeader
        icon={<Clock size={22} />}
        title="Valor Actual / Valor Final"
        subtitle="Interés compuesto: VF = VA × (1 + i)ⁿ  —  Resuelve VA, VF, tasa o períodos"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="VA / VF — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés utilizado">
            <InterestBadge type="compound" />
            <p>
              Este módulo usa <strong>exclusivamente interés compuesto</strong>.
              Cada período, el interés se calcula sobre el saldo acumulado,
              no sobre el capital original.
            </p>
          </HelpSection>

          <HelpSection title="Fórmulas">
            <HelpFormula>{`Calcular VF:   VF = VA × (1 + i)^n
Calcular VA:   VA = VF / (1 + i)^n
Calcular i:    i  = (VF / VA)^(1/n) − 1
Calcular n:    n  = ln(VF / VA) / ln(1 + i)

VA = Valor Actual (capital hoy)
VF = Valor Final (monto futuro)
i  = Tasa por período (en decimal, ej: 0,08 para 8%)
n  = Número de períodos`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Ejemplo concreto">
            <HelpExample>{`VA = $10.000 | i = 8% anual | n = 5 años

→ VF = 10.000 × (1,08)^5 = $14.693,28
   (el capital crece de $10.000 a $14.693 en 5 años)

→ Tasa implícita de VF=20.000 con VA=10.000 en n=10:
   i = (20.000/10.000)^(1/10) − 1 = 7,18% anual

→ Períodos para duplicar capital con i=10%:
   n = ln(2) / ln(1,10) ≈ 7,27 períodos`}</HelpExample>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• Tasa ≤ −100%: El factor (1+i)^n sería cero o negativo.
  Ej: i = −100% → (1−1)^n = 0 → no se puede dividir ni elevar.

• n ≤ 0: Debe existir al menos un período.

• Calcular tasa con VA ≥ VF (y esperás tasa positiva):
  La fórmula i = (VF/VA)^(1/n)−1 dará negativa o cero.
  Eso no es un error — significa que el capital perdió valor.

• Calcular n con tasa = 0%:
  Si i = 0, VA siempre iguala a VF independientemente de n.
  La fórmula n = ln(VF/VA) / ln(1) divide por ln(1) = 0. ✗
  Con tasa 0%, usa el módulo de Interés Simple.`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <Tabs
          tabs={MODES}
          active={solveFor}
          onChange={(id) => setSolveFor(id as TimeValueSolveFor)}
        />
        <TimeValueCalculator key={solveFor} solveFor={solveFor} />
      </div>
    </>
  );
}
