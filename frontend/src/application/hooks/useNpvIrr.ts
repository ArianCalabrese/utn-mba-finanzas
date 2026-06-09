import { useState, useCallback } from "react";
import {
  calcNpv,
  calcIrr,
  calcNpvSensitivity,
  type CashFlow,
  type NpvResult,
  type IrrResult,
  type NpvSensitivity,
} from "../../domain";

export interface NpvIrrResult {
  npv: NpvResult;
  irr: IrrResult;
  sensitivity: NpvSensitivity[];
}

export function useNpvIrr() {
  const [result, setResult] = useState<NpvIrrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(
    (cashFlows: CashFlow[], discountRate: number) => {
      try {
        setError(null);
        const npv = calcNpv({ rate: discountRate, cashFlows });
        const irr = calcIrr({ cashFlows });

        // Rango de sensibilidad: 0% a max(discountRate*3, 50%)
        const rateMax = Math.min(Math.max(discountRate * 3, 0.5), 2);
        const sensitivity = calcNpvSensitivity(cashFlows, 0, rateMax, 60);

        setResult({ npv, irr, sensitivity });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
        setResult(null);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, calculate, reset };
}
