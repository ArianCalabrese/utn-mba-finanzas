import type {
  NpvInput,
  NpvResult,
  IrrInput,
  IrrResult,
  NpvSensitivity,
  CashFlow,
} from "../models/finance";

/**
 * Valor Actual Neto (VAN / NPV):
 *   NPV = Σ [ CF(t) / (1 + r)^t ]
 */
export function calcNpv(input: NpvInput): NpvResult {
  const { rate, cashFlows } = input;

  if (rate <= -1)
    throw new Error("La tasa de descuento debe ser mayor que -100%.");
  if (cashFlows.length === 0)
    throw new Error("Se requiere al menos un flujo de caja.");

  let npv = 0;
  const discountedFlows: CashFlow[] = cashFlows.map(({ period, amount }) => {
    const discounted = amount / Math.pow(1 + rate, period);
    npv += discounted;
    return { period, amount: discounted };
  });

  return { npv, discountedFlows };
}

/**
 * Tasa Interna de Retorno (TIR / IRR) — método Newton-Raphson.
 * Converge cuando |NPV| < ε o se agota el máximo de iteraciones.
 */
export function calcIrr(input: IrrInput): IrrResult {
  const { cashFlows } = input;
  const MAX_ITER = 1000;
  const EPSILON = 1e-7;
  // La TIR requiere al menos un flujo negativo (inversión) y uno positivo
  if (cashFlows.length < 2)
    return { irr: null, iterations: 0 };
  const hasNegative = cashFlows.some((cf) => cf.amount < 0);
  const hasPositive = cashFlows.some((cf) => cf.amount > 0);
  if (!hasNegative || !hasPositive)
    return { irr: null, iterations: 0 };

  let rate = 0.1; // Semilla inicial 10%

  const npvAt = (r: number) =>
    cashFlows.reduce(
      (acc, { period, amount }) => acc + amount / Math.pow(1 + r, period),
      0
    );

  const dnpvAt = (r: number) =>
    cashFlows.reduce(
      (acc, { period, amount }) =>
        acc - (period * amount) / Math.pow(1 + r, period + 1),
      0
    );

  for (let i = 0; i < MAX_ITER; i++) {
    const npv = npvAt(rate);
    const dnpv = dnpvAt(rate);
    if (Math.abs(dnpv) < EPSILON) break;
    const nextRate = rate - npv / dnpv;
    // Clamp para evitar que Newton-Raphson cruce a tasas imposibles (< -100%)
    const clampedRate = Math.max(nextRate, -0.9999);
    if (Math.abs(clampedRate - rate) < EPSILON) {
      return { irr: clampedRate, iterations: i + 1 };
    }
    rate = clampedRate;
  }

  // Verificación final: si no convergió a una solución válida
  const finalNpv = Math.abs(npvAt(rate));
  if (finalNpv > 0.01 || rate < -1) {
    return { irr: null, iterations: MAX_ITER };
  }

  return { irr: rate, iterations: MAX_ITER };
}

/**
 * Genera curva de sensibilidad del VAN para un rango de tasas.
 * Útil para visualizar dónde cruza cero (= TIR).
 */
export function calcNpvSensitivity(
  cashFlows: CashFlow[],
  rateMin: number,
  rateMax: number,
  steps: number = 50
): NpvSensitivity[] {
  const step = (rateMax - rateMin) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const rate = rateMin + i * step;
    const { npv } = calcNpv({ rate, cashFlows });
    return { rate, npv };
  });
}
