import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Landmark } from "lucide-react";
import { useAmortization } from "@/application";
import type { AmortizationMethod } from "@/domain";
import { Field, Card, Metric, Alert, PageHeader, Tabs } from "@/presentation/components/ui";
import {
  HelpModal,
  HelpSection,
  HelpFormula,
  HelpExample,
  HelpWarning,
  InterestBadge,
} from "@/presentation/components/HelpModal";
import { CapitalLineChart, StackedBarChart } from "@/presentation/components/Charts";
import { formatCurrency, formatPercent } from "@/presentation/utils/format";
import "@/presentation/components/ui.css";

interface RawForm {
  principal: string;
  rate:      string;
  periods:   string;
}

const METHODS: { id: AmortizationMethod; label: string }[] = [
  { id: "french",   label: "Francés (cuota fija)" },
  { id: "german",   label: "Alemán (amortiz. fija)" },
  { id: "american", label: "Americano (bullet)" },
];

const MAX_TABLE_ROWS = 100;

function AmortizationCalculator({ method }: { method: AmortizationMethod }) {
  const { result, error, calculate, reset } = useAmortization();
  const { register, handleSubmit } = useForm<RawForm>({
    defaultValues: { principal: "100000", rate: "8", periods: "12" },
  });

  const onSubmit = (data: RawForm) => {
    calculate({
      principal: parseFloat(data.principal),
      rate:      parseFloat(data.rate) / 100,
      periods:   parseInt(data.periods, 10),
      method,
    });
  };

  const lineData = useMemo(() => {
    if (!result) return [];
    return [
      { period: 0, Saldo: result.principal },
      ...result.schedule.map((r) => ({ period: r.period, Saldo: r.balance })),
    ];
  }, [result]);

  const barData = useMemo(() => {
    if (!result) return [];
    return result.schedule.slice(0, 120).map((r) => ({
      period:      r.period,
      Amortización: r.principal,
      Interés:      r.interest,
    }));
  }, [result]);

  const tableRows = result
    ? result.schedule.length > MAX_TABLE_ROWS
      ? result.schedule.slice(0, MAX_TABLE_ROWS)
      : result.schedule
    : [];
  const truncated = (result?.schedule.length ?? 0) > MAX_TABLE_ROWS;

  return (
    <>
      <Card title="Parámetros">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-grid form-grid-3" style={{ marginBottom: "var(--sp-5)" }}>
            <Field
              label="Capital (principal)"
              type="number"
              step="any"
              hint="Monto del préstamo"
              {...register("principal")}
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
          <Card title="Resumen">
            <div className="metrics-grid">
              <Metric label="Capital inicial"   value={formatCurrency(result.principal)} />
              <Metric label="Total pagado"      value={formatCurrency(result.totalPaid)} />
              <Metric label="Total intereses"   value={formatCurrency(result.totalInterest)} variant="negative" />
              {result.installment !== undefined && (
                <Metric label="Cuota fija"      value={formatCurrency(result.installment)} variant="accent" />
              )}
              <Metric label="Tasa por período"  value={formatPercent(result.rate)} />
              <Metric
                label="Costo del crédito"
                value={formatPercent(result.totalInterest / result.principal)}
                sub="Interés / Capital"
              />
            </div>
          </Card>

          <Card title="Evolución del saldo">
            <CapitalLineChart
              data={lineData}
              lines={[{ key: "Saldo", label: "Saldo pendiente", color: "var(--accent)" }]}
              yFormatter={formatCurrency}
            />
          </Card>

          <Card title="Composición de pagos">
            <StackedBarChart
              data={barData}
              bars={[
                { key: "Amortización", label: "Amortización", color: "var(--accent)" },
                { key: "Interés",      label: "Interés",      color: "var(--negative)" },
              ]}
              yFormatter={formatCurrency}
            />
          </Card>

          <Card title="Tabla de amortización">
            {truncated && (
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>
                Mostrando los primeros {MAX_TABLE_ROWS} de {result.schedule.length} períodos.
              </p>
            )}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Cuota</th>
                    <th>Amortización</th>
                    <th>Interés</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.period}>
                      <td className="mono">{row.period}</td>
                      <td className="mono">{formatCurrency(row.payment)}</td>
                      <td className="mono">{formatCurrency(row.principal)}</td>
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

export function AmortizationPage() {
  const [method, setMethod] = useState<AmortizationMethod>("french");
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <PageHeader
        icon={<Landmark size={22} />}
        title="Amortización"
        subtitle="Interés compuesto — tabla de pagos para préstamos"
        onHelp={() => setShowHelp(true)}
      />

      {showHelp && (
        <HelpModal title="Amortización — Guía" onClose={() => setShowHelp(false)}>
          <HelpSection title="Tipo de interés utilizado">
            <InterestBadge type="compound" />
            <p>
              El interés de cada período se calcula sobre el saldo pendiente con
              <strong> interés compuesto</strong>. Los tres sistemas difieren en cómo
              se distribuye la amortización del capital.
            </p>
          </HelpSection>

          <HelpSection title="Sistema Francés (cuota fija)">
            <HelpFormula>{`Cuota = P × [i × (1 + i)^n] / [(1 + i)^n − 1]

• La cuota es constante en todos los períodos.
• Al inicio, la mayor parte es interés.
• Al final, la mayor parte es amortización.
• El más común en préstamos hipotecarios.`}</HelpFormula>
            <HelpExample>{`P = $100.000 | i = 8% | n = 12

Cuota = 100.000 × [0,08×(1,08)^12] / [(1,08)^12 − 1]
      = $13.269,50/período
Total pagado  = $13.269,50 × 12 = $159.234
Total interés = $59.234`}</HelpExample>
          </HelpSection>

          <HelpSection title="Sistema Alemán (amortización fija)">
            <HelpFormula>{`Amortización por período = P / n (constante)
Interés del período t   = Saldo(t−1) × i
Cuota del período t     = P/n + Saldo(t−1) × i

• La amortización es fija; el interés y la cuota decrecen.
• La primera cuota es la más alta; la última, la más baja.`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Sistema Americano (bullet)">
            <HelpFormula>{`Períodos 1 a n−1: pago = P × i  (solo interés)
Período n:        pago = P × i + P  (interés + capital completo)

• Solo se pagan intereses durante toda la vida del préstamo.
• El capital se devuelve íntegramente al vencimiento.
• Común en bonos corporativos.`}</HelpFormula>
          </HelpSection>

          <HelpSection title="Errores y valores inválidos">
            <HelpWarning>{`• Capital ≤ 0: Sin deuda que amortizar.
• Tasa = 0% con sistema Francés: cuota = P/n (caso especial,
  la calculadora lo maneja automáticamente).
• Períodos no enteros: se requiere un entero (no hay "2,5 cuotas").
• Tasa negativa: sin sentido económico en un préstamo.`}</HelpWarning>
          </HelpSection>
        </HelpModal>
      )}

      <div className="page-body section-gap">
        <Tabs
          tabs={METHODS}
          active={method}
          onChange={(id) => setMethod(id as AmortizationMethod)}
        />
        <AmortizationCalculator key={method} method={method} />
      </div>
    </>
  );
}
