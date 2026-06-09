import type { TimeValueInput, TimeValueResult } from "../models/finance";

/**
 * Valor Actual y Valor Final — resuelve cualquier variable faltante.
 * VF = VA * (1 + i)^n
 * VA = VF / (1 + i)^n
 */
export function calcTimeValue(input: TimeValueInput): TimeValueResult {
  const { rate, periods } = input;
  let { presentValue, futureValue } = input;

  if (rate <= -1)
    throw new Error("La tasa (i) debe ser mayor que -100% para evitar división por cero.");
  if (periods <= 0) throw new Error("El número de períodos (n) debe ser mayor que 0.");

  const factor = Math.pow(1 + rate, periods);

  if (factor === 0)
    throw new Error("El factor (1+i)^n resultó en 0. Verifique la tasa y los períodos.");

  if (presentValue !== undefined && futureValue === undefined) {
    futureValue = presentValue * factor;
  } else if (futureValue !== undefined && presentValue === undefined) {
    presentValue = futureValue / factor;
  }

  return {
    presentValue: presentValue!,
    futureValue: futureValue!,
    rate,
    periods,
  };
}

/**
 * Resuelve la tasa dado VA, VF y n.
 * i = (VF/VA)^(1/n) - 1
 */
export function solveRate(
  presentValue: number,
  futureValue: number,
  periods: number
): number {
  if (presentValue <= 0)
    throw new Error("El VA debe ser positivo para calcular la tasa.");
  if (futureValue <= 0)
    throw new Error("El VF debe ser positivo para calcular la tasa.");
  if (periods <= 0)
    throw new Error("El número de períodos (n) debe ser mayor que 0.");
  return Math.pow(futureValue / presentValue, 1 / periods) - 1;
}

/**
 * Resuelve el número de períodos dado VA, VF e i.
 * n = ln(VF/VA) / ln(1 + i)
 */
export function solvePeriods(
  presentValue: number,
  futureValue: number,
  rate: number
): number {
  if (presentValue <= 0)
    throw new Error("El VA debe ser positivo para calcular los períodos.");
  if (futureValue <= 0)
    throw new Error("El VF debe ser positivo para calcular los períodos.");
  if (rate === 0)
    throw new Error(
      "Con tasa 0% los períodos son indeterminados (el capital no crece)."
    );
  if (rate <= -1)
    throw new Error("La tasa (i) debe ser mayor que -100%.");
  const ratio = futureValue / presentValue;
  if (ratio <= 0)
    throw new Error("La relación VF/VA debe ser positiva para calcular períodos.");
  return Math.log(ratio) / Math.log(1 + rate);
}
