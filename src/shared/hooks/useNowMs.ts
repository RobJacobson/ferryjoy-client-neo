/**
 * Shared React hook for tracking current time, updated at a fixed interval.
 */

import { useEffect, useState } from "react";

/**
 * Returns the current time in milliseconds, updated every intervalMs.
 *
 * @param intervalMs - Update interval in milliseconds
 * @returns Current timestamp in milliseconds
 */
export const useNowMs = (intervalMs: number) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return nowMs;
};
