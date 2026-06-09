import { useState, useCallback } from "react";
import {
  calcAmortization,
  type AmortizationInput,
  type AmortizationResult,
} from "../../domain";

export function useAmortization() {
  const [result, setResult] = useState<AmortizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: AmortizationInput) => {
    try {
      setError(null);
      setResult(calcAmortization(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setResult(null);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, error, calculate, reset };
}
