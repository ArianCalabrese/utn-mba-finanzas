import { useState, useCallback } from "react";
import {
  calcCompoundInterest,
  type CompoundInterestInput,
  type CompoundInterestResult,
} from "../../domain";

export function useCompoundInterest() {
  const [result, setResult] = useState<CompoundInterestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: CompoundInterestInput) => {
    try {
      setError(null);
      setResult(calcCompoundInterest(input));
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
