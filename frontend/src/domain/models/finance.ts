// ─────────────────────────────────────────────────────────────────────────────
// Domain Models — pure TypeScript, zero React/UI dependencies
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared ───────────────────────────────────────────────────────────────────

/** Frequency of compounding or payment periods per year */
export type Frequency = 1 | 2 | 4 | 12 | 52 | 365;

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  1: "Anual",
  2: "Semestral",
  4: "Trimestral",
  12: "Mensual",
  52: "Semanal",
  365: "Diario",
};

// ── Simple Interest ───────────────────────────────────────────────────────────

export interface SimpleInterestInput {
  principal: number;   // P — Capital inicial
  rate: number;        // r — Tasa de interés (decimal, e.g. 0.05 = 5%)
  time: number;        // t — Tiempo en años
}

export interface SimpleInterestResult {
  interest: number;    // I = P * r * t
  amount: number;      // M = P + I
  schedule: SimpleInterestPeriod[];
}

export interface SimpleInterestPeriod {
  period: number;
  interest: number;
  amount: number;
}

// ── Compound Interest ─────────────────────────────────────────────────────────

export interface CompoundInterestInput {
  principal: number;
  rate: number;           // Tasa nominal anual (decimal)
  time: number;           // Tiempo en años
  frequency: Frequency;   // Capitalización por año
}

export interface CompoundInterestResult {
  futureValue: number;
  totalInterest: number;
  effectiveRate: number;  // TEA
  schedule: CompoundPeriod[];
}

export interface CompoundPeriod {
  period: number;
  openingBalance: number;
  interest: number;
  closingBalance: number;
}

// ── Present Value / Future Value ──────────────────────────────────────────────

export interface TimeValueInput {
  presentValue?: number;
  futureValue?: number;
  rate: number;      // Tasa por período (decimal)
  periods: number;
}

export interface TimeValueResult {
  presentValue: number;
  futureValue: number;
  rate: number;
  periods: number;
}

// ── Annuities ─────────────────────────────────────────────────────────────────

export type AnnuityType = "ordinary" | "due";  // Vencida | Anticipada

export interface AnnuityInput {
  payment: number;
  rate: number;       // Tasa por período (decimal)
  periods: number;
  type: AnnuityType;
}

export interface AnnuityResult {
  presentValue: number;
  futureValue: number;
  totalPayments: number;
  totalInterest: number;
  schedule: AnnuityPeriod[];
}

export interface AnnuityPeriod {
  period: number;
  payment: number;
  interest: number;
  principalReduction: number;
  balance: number;
}

// ── Perpetuities ──────────────────────────────────────────────────────────────

export interface PerpetuityInput {
  payment: number;
  rate: number;       // Tasa por período (decimal)
  growthRate?: number; // g — para perpetuidad creciente (decimal)
}

export interface PerpetuityResult {
  presentValue: number;
  type: "constant" | "growing";
  payment: number;
  rate: number;
  growthRate?: number;
}

// ── Gradients ─────────────────────────────────────────────────────────────────

export type GradientType = "arithmetic" | "geometric";

export interface GradientInput {
  basePayment: number;  // A — Pago base del período 1
  gradient: number;     // G (aritmético) o g decimal (geométrico)
  rate: number;         // Tasa por período (decimal)
  periods: number;
  type: GradientType;
}

export interface GradientResult {
  presentValue: number;
  futureValue: number;
  gradient: number;
  rate: number;
  schedule: GradientPeriod[];
}

export interface GradientPeriod {
  period: number;
  payment: number;
  presentValue: number;
}

// ── Amortization ──────────────────────────────────────────────────────────────

export type AmortizationMethod = "french" | "german" | "american";

export interface AmortizationInput {
  principal: number;
  rate: number;       // Tasa por período (decimal)
  periods: number;
  method: AmortizationMethod;
}

export interface AmortizationResult {
  schedule: AmortizationRow[];
  totalInterest: number;
  totalPaid: number;
  principal: number;
  rate: number;
  installment?: number;  // Solo sistema francés (cuota fija)
}

export interface AmortizationRow {
  period: number;
  payment: number;         // Cuota total
  principal: number;       // Amortización de capital
  interest: number;        // Interés del período
  balance: number;         // Saldo restante
}

// ── NPV / IRR ─────────────────────────────────────────────────────────────────

export interface CashFlow {
  period: number;
  amount: number;
}

export interface NpvInput {
  rate: number;          // Tasa de descuento (decimal)
  cashFlows: CashFlow[]; // Incluye inversión inicial en period 0 (negativo)
}

export interface NpvResult {
  npv: number;
  discountedFlows: CashFlow[];
}

export interface IrrInput {
  cashFlows: CashFlow[];
}

export interface IrrResult {
  irr: number | null;    // null si no converge
  iterations: number;
}

export interface NpvSensitivity {
  rate: number;
  npv: number;
}
