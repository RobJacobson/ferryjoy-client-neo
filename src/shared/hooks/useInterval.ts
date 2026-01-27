/**
 * Shared React hook for running a callback on an interval.
 *
 * This is intentionally implemented without `useCallback` to play nicely with
 * React Compiler; it stores the latest callback in a ref and only recreates the
 * timer when the delay changes.
 */

import { useEffect, useRef } from "react";

/**
 * Runs a callback repeatedly with a fixed time delay between calls.
 *
 * Pass `null` to pause the interval.
 *
 * @param callback - Function to execute on each interval tick
 * @param delayMs - Delay in milliseconds, or `null` to disable
 */
export const useInterval = (callback: () => void, delayMs: number | null) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => {
      callbackRef.current();
    }, delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
};
