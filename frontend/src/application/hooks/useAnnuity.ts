import { useState, useCallback } from "react";
import {
  calcAnnuity,
  type AnnuityInput,
  type AnnuityResult,
} from "../../domain";

export function useAnnuity() {
  const [result, setResult] = useState<AnnuityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: AnnuityInput) => {
    try {
      setError(null);
      setResult(calcAnnuity(input));
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
