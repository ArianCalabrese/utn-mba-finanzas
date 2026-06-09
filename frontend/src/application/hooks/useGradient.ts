import { useState, useCallback } from "react";
import {
  calcGradient,
  type GradientInput,
  type GradientResult,
} from "../../domain";

export function useGradient() {
  const [result, setResult] = useState<GradientResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: GradientInput) => {
    try {
      setError(null);
      setResult(calcGradient(input));
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
