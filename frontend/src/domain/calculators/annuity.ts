import type {
  AnnuityInput,
  AnnuityResult,
  AnnuityPeriod,
} from "../models/finance";

/**
 * Anualidad ordinaria (vencida): pagos al final del período.
 * VA = C * [1 - (1+i)^-n] / i
 * VF = C * [(1+i)^n - 1] / i
 *
 * Anualidad anticipada (due): pagos al inicio del período.
 * VA_due = VA_ord * (1 + i)
 * VF_due = VF_ord * (1 + i)
 */
export function calcAnnuity(input: AnnuityInput): AnnuityResult {
  const { payment, rate, periods, type } = input;

  if (payment <= 0) throw new Error("El pago (C) debe ser mayor que 0.");
  if (periods <= 0 || !Number.isInteger(periods))
    throw new Error("El número de períodos debe ser un entero positivo.");
  if (rate < 0) throw new Error("La tasa no puede ser negativa.");

  const dueMultiplier = type === "due" ? 1 + rate : 1;

  // Caso especial: tasa 0 → límite de la fórmula cuando i→0 es VA = VF = C*n
  if (rate === 0) {
    const total = payment * periods;
    const schedule: AnnuityPeriod[] = Array.from({ length: periods }, (_, i) => ({
      period: i + 1,
      payment,
      interest: 0,
      principalReduction: payment,
      balance: total - payment * (i + 1),
    }));
    return { presentValue: total, futureValue: total, totalPayments: total, totalInterest: 0, schedule };
  }

  const factor = Math.pow(1 + rate, periods);
  const pvOrd = payment * ((1 - Math.pow(1 + rate, -periods)) / rate);
  const fvOrd = payment * ((factor - 1) / rate);

  const presentValue = pvOrd * dueMultiplier;
  const futureValue = fvOrd * dueMultiplier;
  const totalPayments = payment * periods;
  const totalInterest = futureValue - totalPayments;

  // Tabla de reducción de saldo basada en VA
  const schedule: AnnuityPeriod[] = [];
  let balance = presentValue;

  for (let i = 1; i <= periods; i++) {
    const interest = balance * rate;
    const principalReduction = payment - interest;
    balance = Math.max(balance - principalReduction, 0);
    schedule.push({
      period: i,
      payment,
      interest,
      principalReduction,
      balance,
    });
  }

  return { presentValue, futureValue, totalPayments, totalInterest, schedule };
}

/**
 * Calcula el pago periódico dada VA o VF.
 */
export function solveAnnuityPayment(params: {
  presentValue?: number;
  futureValue?: number;
  rate: number;
  periods: number;
  type: "ordinary" | "due";
}): number {
  const { rate, periods, type } = params;

  if (periods <= 0) throw new Error("El número de períodos debe ser mayor que 0.");
  if (rate < 0) throw new Error("La tasa no puede ser negativa.");

  // Caso especial tasa 0: C = VA/n  o  C = VF/n
  if (rate === 0) {
    if (params.presentValue !== undefined) return params.presentValue / periods;
    return params.futureValue! / periods;
  }

  const dueMultiplier = type === "due" ? 1 + rate : 1;
  const factor = Math.pow(1 + rate, periods);

  if (params.presentValue !== undefined) {
    return (params.presentValue * rate) / ((1 - Math.pow(1 + rate, -periods)) * dueMultiplier);
  }
  return (params.futureValue! * rate) / ((factor - 1) * dueMultiplier);
}
