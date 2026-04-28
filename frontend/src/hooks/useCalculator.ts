import { useCallback, useState } from "react";

import { api } from "@/lib/api";

export function useCalculator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(path: string, body: unknown): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<T>(path, body);
      return data;
    } catch (e: unknown) {
      const msg =
        typeof e === "object" && e !== null && "response" in e
          ? String((e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? "Request failed")
          : "Request failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateEmi = useCallback((body: unknown) => run("/api/calculate/emi", body), [run]);
  const calculateEligibility = useCallback((body: unknown) => run("/api/calculate/eligibility", body), [run]);
  const calculateCompare = useCallback((body: unknown) => run("/api/calculate/compare", body), [run]);
  const calculateSip = useCallback((body: unknown) => run("/api/calculate/sip", body), [run]);
  const calculateFd = useCallback((body: unknown) => run("/api/calculate/fd", body), [run]);
  const calculateCibil = useCallback((body: unknown) => run("/api/calculate/cibil", body), [run]);

  return {
    loading,
    error,
    calculateEmi,
    calculateEligibility,
    calculateCompare,
    calculateSip,
    calculateFd,
    calculateCibil,
  };
}
