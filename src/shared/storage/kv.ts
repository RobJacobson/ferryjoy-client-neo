/**
 * Cross-platform key/value storage helpers (web + native).
 *
 * This module provides a tiny, swappable boundary over AsyncStorage with:
 * - consistent key namespacing and versioning
 * - safe JSON serialization/parsing helpers
 * - optional Zod validation on reads
 *
 * Notes:
 * - This is intended for non-sensitive settings/state. Do not store secrets here.
 * - AsyncStorage is async on all platforms; do not read during render.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ZodType } from "zod";

// ============================================================================
// Constants & types
// ============================================================================

const APP_STORAGE_PREFIX = "fj";

export type StorageVersion = `v${number}`;

export type StorageKeyParts = Readonly<{
  /**
   * Logical area of the app.
   * Examples: "settings", "map", "vessels", "debug".
   */
  scope: string;
  /**
   * Storage schema version for this scope/key. Bump when the stored shape
   * changes incompatibly.
   */
  version: StorageVersion;
  /**
   * The leaf key within the scope.
   */
  key: string;
}>;

export type GetJsonResult<T> =
  | { ok: true; value: T | null }
  | { ok: false; value: null; error: Error };

export type GetJsonOptions<T> = Readonly<{
  /**
   * Optional schema to validate decoded JSON. If provided and validation fails,
   * `null` is returned and the stored value may be removed (see `onInvalid`).
   */
  schema?: ZodType<T>;
  /**
   * What to do when stored data is invalid JSON or fails schema validation.
   * Removing invalid data prevents repeated parse errors on future reads.
   *
   * @default "remove"
   */
  onInvalid?: "remove" | "keep";
}>;

// ============================================================================
// Main functions
// ============================================================================

/**
 * Build a namespaced, versioned storage key for this app.
 *
 * @param parts - Key parts (scope/version/leaf key)
 * @returns Fully-qualified storage key string
 */
const makeKey = ({ scope, version, key }: StorageKeyParts): string =>
  `${APP_STORAGE_PREFIX}:${scope}:${version}:${key}`;

/**
 * Read a raw string from storage.
 *
 * @param storageKey - Fully-qualified storage key
 * @returns Stored string, or null if not present
 */
const getString = async (storageKey: string): Promise<string | null> => {
  return await AsyncStorage.getItem(storageKey);
};

/**
 * Write a raw string to storage.
 *
 * @param storageKey - Fully-qualified storage key
 * @param value - String value to store
 */
const setString = async (storageKey: string, value: string): Promise<void> => {
  await AsyncStorage.setItem(storageKey, value);
};

/**
 * Remove a single key from storage.
 *
 * @param storageKey - Fully-qualified storage key
 */
const remove = async (storageKey: string): Promise<void> => {
  await AsyncStorage.removeItem(storageKey);
};

/**
 * Clear all keys for the app's storage backend.
 *
 * Important: this clears the entire AsyncStorage namespace, not just `fj:*`
 * keys. Use with care.
 */
const clear = async (): Promise<void> => {
  await AsyncStorage.clear();
};

/**
 * Read and decode a JSON value from storage.
 *
 * If `schema` is provided, the parsed value is validated. Invalid/corrupt data
 * can be removed automatically with `onInvalid`.
 *
 * @param storageKey - Fully-qualified storage key
 * @param options - Optional validation + invalid-data handling behavior
 * @returns A tagged result containing the decoded value (or null) or an error
 */
const getJson = async <T = unknown>(
  storageKey: string,
  options?: GetJsonOptions<T>
): Promise<GetJsonResult<T>> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw == null) {
      return { ok: true, value: null };
    }

    const parsed = safeJsonParse(raw);

    if (!options?.schema) {
      return { ok: true, value: parsed as T };
    }

    const result = options.schema.safeParse(parsed);
    if (result.success) {
      return { ok: true, value: result.data };
    }

    if ((options.onInvalid ?? "remove") === "remove") {
      await AsyncStorage.removeItem(storageKey);
    }

    return {
      ok: false,
      value: null,
      error: new Error(
        `Stored value failed schema validation for key "${storageKey}".`
      ),
    };
  } catch (error) {
    if ((options?.onInvalid ?? "remove") === "remove") {
      // Best-effort cleanup: if data is corrupt, remove it to prevent loops.
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch {
        // Ignore cleanup failures.
      }
    }

    return { ok: false, value: null, error: asError(error) };
  }
};

/**
 * Encode and write a JSON value to storage.
 *
 * @param storageKey - Fully-qualified storage key
 * @param value - JSON-serializable value to store (undefined is rejected)
 */
const setJson = async (storageKey: string, value: unknown): Promise<void> => {
  if (value === undefined) {
    throw new Error(
      `Cannot store undefined for key "${storageKey}". Use null or remove().`
    );
  }

  await AsyncStorage.setItem(storageKey, JSON.stringify(value));
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Parse JSON and throw a descriptive error if invalid.
 *
 * @param raw - Raw JSON string from storage
 * @returns Parsed JSON value
 */
const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Stored value was not valid JSON.");
  }
};

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

// ============================================================================
// Export statement
// ============================================================================

export const storageKv = {
  makeKey,
  getString,
  setString,
  getJson,
  setJson,
  remove,
  clear,
};
