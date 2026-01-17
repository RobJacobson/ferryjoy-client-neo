/**
 * Cross-platform persisted state hook (web + native).
 *
 * Uses `storageKv` (AsyncStorage under the hood) to load and persist small,
 * non-sensitive settings in a consistent way across platforms.
 *
 * Important:
 * - Storage reads are async; do not assume persisted values are available
 *   on the first render. Use `isHydrated` for gating if needed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ZodType } from "zod";
import { storageKv } from "@/shared/storage";

// ============================================================================
// Types
// ============================================================================

export type UsePersistentStateOptions<T> = Readonly<{
  /**
   * Default value used before hydration and as a fallback when storage is empty.
   */
  defaultValue: T;
  /**
   * Optional schema to validate persisted values.
   */
  schema?: ZodType<T>;
  /**
   * What to do when stored data is invalid JSON or fails schema validation.
   *
   * @default "remove"
   */
  onInvalid?: "remove" | "keep";
}>;

export type PersistentState<T> = Readonly<{
  value: T;
  setValue: (next: T | ((previous: T) => T)) => Promise<void>;
  remove: () => Promise<void>;
  isHydrated: boolean;
  error: Error | null;
}>;

// ============================================================================
// Main hook
// ============================================================================

/**
 * Persist a single value at a storage key.
 *
 * @param storageKey - Fully-qualified storage key (e.g. from `storageKv.makeKey`)
 * @param options - Default value and (optional) validation settings
 * @returns The current value, setters, hydration state, and any error encountered
 */
export const usePersistentState = <T>(
  storageKey: string,
  options: UsePersistentStateOptions<T>
): PersistentState<T> => {
  const { defaultValue, schema, onInvalid } = options;

  const [value, setValueState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef<boolean>(true);
  const valueRef = useRef<T>(defaultValue);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let isCancelled = false;

    const hydrate = async (): Promise<void> => {
      setIsHydrated(false);
      setError(null);

      const result = await storageKv.getJson<T>(storageKey, {
        schema,
        onInvalid,
      });

      if (isCancelled || !isMountedRef.current) {
        return;
      }

      if (result.ok) {
        if (result.value != null) {
          valueRef.current = result.value;
          setValueState(result.value);
        } else {
          valueRef.current = defaultValue;
          setValueState(defaultValue);
        }
      } else {
        setError(result.error);
        valueRef.current = defaultValue;
        setValueState(defaultValue);
      }

      setIsHydrated(true);
    };

    hydrate();

    return () => {
      isCancelled = true;
    };
  }, [defaultValue, onInvalid, schema, storageKey]);

  const setValue = useCallback(
    async (next: T | ((previous: T) => T)): Promise<void> => {
      const resolved =
        typeof next === "function"
          ? (next as (previous: T) => T)(valueRef.current)
          : next;

      valueRef.current = resolved;
      setValueState(resolved);

      try {
        await storageKv.setJson(storageKey, resolved);
        setError(null);
      } catch (error) {
        setError(asError(error));
      }
    },
    [storageKey]
  );

  const remove = useCallback(async (): Promise<void> => {
    valueRef.current = defaultValue;
    setValueState(defaultValue);

    try {
      await storageKv.remove(storageKey);
      setError(null);
    } catch (error) {
      setError(asError(error));
    }
  }, [defaultValue, storageKey]);

  return {
    value,
    setValue,
    remove,
    isHydrated,
    error,
  };
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Normalize unknown thrown values to Error.
 *
 * @param error - Unknown thrown value
 * @returns Normalized Error instance
 */
const asError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "Unknown error");
};
