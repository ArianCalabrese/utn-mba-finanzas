import type {
  CompoundInterestInput,
  CompoundInterestResult,
  CompoundPeriod,
} from "../models/finance";

/**
 * Interés compuesto con capitalización variable.
 * VF = VA * (1 + r/m)^(m*t)
 * TEA = (1 + r/m)^m - 1
 */
export function calcCompoundInterest(
  input: CompoundInterestInput
): CompoundInterestResult {
  const { principal, rate, time, frequency } = input;

  if (principal <= 0) throw new Error("El capital (P) debe ser mayor que 0.");
  if (time <= 0) throw new Error("El tiempo debe ser mayor que 0.");
  const periodicRate = rate / frequency;
  if (1 + periodicRate <= 0)
    throw new Error(
      "La tasa por período produce un factor negativo. Verifique la tasa nominal."
    );
  const totalPeriods = Math.round(time * frequency);

  const effectiveRate = Math.pow(1 + periodicRate, frequency) - 1;
  const futureValue = principal * Math.pow(1 + periodicRate, totalPeriods);
  const totalInterest = futureValue - principal;

  const schedule: CompoundPeriod[] = [];
  let balance = principal;
  for (let i = 1; i <= totalPeriods; i++) {
    const interest = balance * periodicRate;
    const closing = balance + interest;
    schedule.push({
      period: i,
      openingBalance: balance,
      interest,
      closingBalance: closing,
    });
    balance = closing;
  }

  return { futureValue, totalInterest, effectiveRate, schedule };
}
