import type {
  SimpleInterestInput,
  SimpleInterestResult,
  SimpleInterestPeriod,
} from "../models/finance";

/**
 * Calcula interés simple y genera tabla de progresión período a período.
 * I = P * r * t   |   M = P * (1 + r * t)
 */
export function calcSimpleInterest(
  input: SimpleInterestInput
): SimpleInterestResult {
  const { principal, rate, time } = input;

  if (principal <= 0) throw new Error("El capital (P) debe ser mayor que 0.");
  if (rate < 0) throw new Error("La tasa (r) no puede ser negativa.");
  if (time <= 0) throw new Error("El tiempo (t) debe ser mayor que 0.");

  const interest = principal * rate * time;
  const amount = principal + interest;

  // Tabla anual (cada período = 1 año)
  const periods = Math.ceil(time);
  const schedule: SimpleInterestPeriod[] = Array.from(
    { length: periods },
    (_, i) => {
      const t = Math.min(i + 1, time);
      const periodInterest = principal * rate * t;
      return {
        period: i + 1,
        interest: periodInterest,
        amount: principal + periodInterest,
      };
    }
  );

  return { interest, amount, schedule };
}
