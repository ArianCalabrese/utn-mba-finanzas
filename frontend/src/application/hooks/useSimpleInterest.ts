import { useState, useCallback } from "react";
import {
  calcSimpleInterest,
  type SimpleInterestInput,
  type SimpleInterestResult,
} from "../../domain";

export function useSimpleInterest() {
  const [result, setResult] = useState<SimpleInterestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: SimpleInterestInput) => {
    try {
      setError(null);
      setResult(calcSimpleInterest(input));
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
