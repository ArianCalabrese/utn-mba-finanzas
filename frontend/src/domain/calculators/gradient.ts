import type {
  GradientInput,
  GradientResult,
  GradientPeriod,
} from "../models/finance";

/**
 * Gradiente Aritmético:
 *   Pago(t) = A + G*(t-1)
 *   VA = A * P/A(i,n) + G * P/G(i,n)
 *   P/G(i,n) = [1/i] * [n/(1+i)^n - (1/i)*((1+i)^n - 1)/(i*(1+i)^n)]
 *            simplificado: [(1+i)^n - i*n - 1] / [i^2 * (1+i)^n]
 *
 * Gradiente Geométrico:
 *   Pago(t) = A * (1+g)^(t-1)
 *   VA = A * [1 - (1+g)^n*(1+i)^-n] / (i - g)   si i ≠ g
 *   VA = A * n / (1 + i)                           si i = g
 */
export function calcGradient(input: GradientInput): GradientResult {
  const { basePayment, gradient, rate, periods, type } = input;

  if (basePayment <= 0) throw new Error("El pago base debe ser mayor que 0.");
  if (periods <= 0 || !Number.isInteger(periods))
    throw new Error("El número de períodos debe ser un entero positivo.");
  if (rate <= -1)
    throw new Error("La tasa (i) debe ser mayor que -100% para evitar división por cero.");

  const schedule: GradientPeriod[] = [];
  let presentValue = 0;

  if (type === "arithmetic") {
    for (let t = 1; t <= periods; t++) {
      const payment = basePayment + gradient * (t - 1);
      const pv = payment / Math.pow(1 + rate, t);
      presentValue += pv;
      schedule.push({ period: t, payment, presentValue: pv });
    }
  } else {
    // geometric
    for (let t = 1; t <= periods; t++) {
      const payment = basePayment * Math.pow(1 + gradient, t - 1);
      const pv = payment / Math.pow(1 + rate, t);
      presentValue += pv;
      schedule.push({ period: t, payment, presentValue: pv });
    }
  }

  const futureValue = presentValue * Math.pow(1 + rate, periods);

  return { presentValue, futureValue, gradient, rate, schedule };
}
