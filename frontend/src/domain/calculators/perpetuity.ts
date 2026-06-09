import type { PerpetuityInput, PerpetuityResult } from "../models/finance";

/**
 * Perpetuidad constante:  VA = C / i
 * Perpetuidad creciente:  VA = C / (i - g)   donde g < i
 */
export function calcPerpetuity(input: PerpetuityInput): PerpetuityResult {
  const { payment, rate, growthRate } = input;

  if (payment <= 0) throw new Error("El pago (C) debe ser mayor que 0.");
  if (rate <= 0)
    throw new Error(
      "La tasa de descuento debe ser mayor que 0% para una perpetuidad (valor infinito de otro modo)."
    );

  if (growthRate !== undefined && growthRate !== 0) {
    if (growthRate >= rate) {
      throw new Error(
        "La tasa de crecimiento (g) debe ser menor que la tasa de descuento (i)."
      );
    }
    return {
      presentValue: payment / (rate - growthRate),
      type: "growing",
      payment,
      rate,
      growthRate,
    };
  }

  return {
    presentValue: payment / rate,
    type: "constant",
    payment,
    rate,
  };
}
