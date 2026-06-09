import { useState, useCallback } from "react";
import {
  calcPerpetuity,
  type PerpetuityInput,
  type PerpetuityResult,
} from "../../domain";

export function usePerpetuity() {
  const [result, setResult] = useState<PerpetuityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: PerpetuityInput) => {
    try {
      setError(null);
      setResult(calcPerpetuity(input));
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
