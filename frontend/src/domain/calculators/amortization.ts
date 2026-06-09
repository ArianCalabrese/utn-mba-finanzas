import type {
  AmortizationInput,
  AmortizationResult,
  AmortizationRow,
} from "../models/finance";

/**
 * Sistema Francés (cuota constante):
 *   C = P * i / [1 - (1+i)^-n]
 *   Interés(t) = Saldo(t-1) * i
 *   Amort(t)   = C - Interés(t)
 *
 * Sistema Alemán (amortización constante):
 *   Amort(t) = P / n
 *   Interés(t) = Saldo(t-1) * i
 *   C(t) = Amort(t) + Interés(t)  (cuota decreciente)
 *
 * Sistema Americano (bullet):
 *   Solo paga intereses hasta el último período.
 *   C(t) = P * i  para t < n
 *   C(n) = P * i + P
 */
export function calcAmortization(
  input: AmortizationInput
): AmortizationResult {
  const { principal, rate, periods, method } = input;

  if (principal <= 0) throw new Error("El capital debe ser mayor que 0.");
  if (rate < 0) throw new Error("La tasa no puede ser negativa.");
  if (periods <= 0 || !Number.isInteger(periods))
    throw new Error("El número de períodos debe ser un entero positivo.");

  const schedule: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;

  if (method === "french") {
    // Caso especial tasa 0: cuota constante = capital / períodos
    const payment =
      rate === 0
        ? principal / periods
        : (principal * rate) / (1 - Math.pow(1 + rate, -periods));
    for (let t = 1; t <= periods; t++) {
      const interest = balance * rate;
      const amort = payment - interest;
      balance = Math.max(balance - amort, 0);
      totalInterest += interest;
      totalPaid += payment;
      schedule.push({ period: t, payment, principal: amort, interest, balance });
    }
    return { schedule, totalInterest, totalPaid, principal, rate, installment: payment };
  } else if (method === "german") {
    const amort = principal / periods;
    for (let t = 1; t <= periods; t++) {
      const interest = balance * rate;
      const payment = amort + interest;
      balance = Math.max(balance - amort, 0);
      totalInterest += interest;
      totalPaid += payment;
      schedule.push({ period: t, payment, principal: amort, interest, balance });
    }
    return { schedule, totalInterest, totalPaid, principal, rate };
  } else {
    // american / bullet
    const interest = principal * rate;
    for (let t = 1; t <= periods; t++) {
      const isLast = t === periods;
      const payment = isLast ? interest + principal : interest;
      const amort = isLast ? principal : 0;
      balance = isLast ? 0 : balance;
      totalInterest += interest;
      totalPaid += payment;
      schedule.push({
        period: t,
        payment,
        principal: amort,
        interest,
        balance: isLast ? 0 : principal,
      });
    }
    return { schedule, totalInterest, totalPaid, principal, rate };
  }
}
