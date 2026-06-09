import { useState, useCallback } from "react";
import {
  calcTimeValue,
  solveRate,
  solvePeriods,
  type TimeValueInput,
  type TimeValueResult,
} from "../../domain";

export type TimeValueSolveFor = "pv" | "fv" | "rate" | "periods";

export interface TimeValueFormInput {
  solveFor: TimeValueSolveFor;
  presentValue?: number;
  futureValue?: number;
  rate?: number;
  periods?: number;
}

export interface TimeValueHookResult extends TimeValueResult {
  solvedFor: TimeValueSolveFor;
}

export function useTimeValue() {
  const [result, setResult] = useState<TimeValueHookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback((input: TimeValueFormInput) => {
    try {
      setError(null);
      const { solveFor, presentValue, futureValue, rate, periods } = input;

      let tvResult: TimeValueResult;

      if (solveFor === "rate") {
        if (
          presentValue === undefined ||
          futureValue === undefined ||
          periods === undefined
        )
          throw new Error("Se requieren VA, VF y n para resolver la tasa.");
        const r = solveRate(presentValue, futureValue, periods);
        tvResult = { presentValue, futureValue, rate: r, periods };
      } else if (solveFor === "periods") {
        if (
          presentValue === undefined ||
          futureValue === undefined ||
          rate === undefined
        )
          throw new Error("Se requieren VA, VF e i para resolver períodos.");
        const n = solvePeriods(presentValue, futureValue, rate);
        tvResult = { presentValue, futureValue, rate, periods: n };
      } else {
        const tvInput: TimeValueInput = {
          presentValue: solveFor === "pv" ? undefined : presentValue,
          futureValue: solveFor === "fv" ? undefined : futureValue,
          rate: rate!,
          periods: periods!,
        };
        tvResult = calcTimeValue(tvInput);
      }

      setResult({ ...tvResult, solvedFor: solveFor });
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
